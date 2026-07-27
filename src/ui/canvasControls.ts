// ============================================================
//  🏠 房间改造工具 — 画布控件 (铺满画布/缩放/平移)
// ============================================================

import Konva from 'konva';

interface CanvasControlsConfig {
  stage: Konva.Stage;
  container: HTMLElement;
  zoomLabel: HTMLElement;
  fitBtn: HTMLElement;
  /** 获取房间包围盒 (cm坐标) */
  getRoomBounds: () => { minX: number; minY: number; maxX: number; maxY: number } | null;
}

const PADDING = 40;       // 铺满画布内边距
const MIN_SCALE = 0.2;
const MAX_SCALE = 4.0;

/** 初始化画布控件: 铺满画布 + 缩放 + 平移 */
export function initCanvasControls(config: CanvasControlsConfig): void {
  const { stage, container, zoomLabel, fitBtn } = config;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let stageStartX = 0;
  let stageStartY = 0;

  // ---- 铺满画布 ----
  function fitToCanvas(): void {
    const bounds = config.getRoomBounds();
    if (!bounds) return;

    const roomW = bounds.maxX - bounds.minX;
    const roomH = bounds.maxY - bounds.minY;
    if (roomW <= 0 || roomH <= 0) return;

    const availW = container.clientWidth - PADDING * 2;
    const availH = container.clientHeight - PADDING * 2;
    const scale = Math.min(availW / roomW, availH / roomH);

    const targetX = (container.clientWidth - roomW * scale) / 2 - bounds.minX * scale;
    const targetY = (container.clientHeight - roomH * scale) / 2 - bounds.minY * scale;

    // 动画
    new Konva.Tween({
      node: stage,
      duration: 0.3,
      x: targetX,
      y: targetY,
      scaleX: scale,
      scaleY: scale,
      easing: Konva.Easings.EaseOut,
      onUpdate: () => {
        updateZoomLabel();
        stage.batchDraw();
      },
      onFinish: () => {
        stage.x(targetX);
        stage.y(targetY);
        stage.scale({ x: scale, y: scale });
        updateZoomLabel();
        stage.batchDraw();
      },
    }).play();
  }

  function updateZoomLabel(): void {
    const pct = Math.round(stage.scaleX() * 100);
    zoomLabel.textContent = `${pct}%`;
  }

  // Fit button
  fitBtn.addEventListener('click', () => fitToCanvas());

  // Ctrl+0 铺满
  document.addEventListener('keydown', function(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      fitToCanvas();
    }
  });

  // Double-click zoom label → reset to 100%
  zoomLabel.addEventListener('dblclick', () => {
    new Konva.Tween({
      node: stage,
      duration: 0.3,
      scaleX: 1,
      scaleY: 1,
      easing: Konva.Easings.EaseOut,
      onUpdate: () => {
        updateZoomLabel();
        stage.batchDraw();
      },
      onFinish: () => {
        stage.scale({ x: 1, y: 1 });
        updateZoomLabel();
        stage.batchDraw();
      },
    }).play();
  });

  // ---- 滚轮缩放 ----
  stage.on('wheel', function(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    // 如果正在平移，不缩放
    if (isPanning) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY > 0 ? oldScale * 0.92 : oldScale * 1.08;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    updateZoomLabel();
    stage.batchDraw();
  });

  // ---- 平移 (中键拖拽) ----
  const canvasEl = stage.container();

  canvasEl.addEventListener('mousedown', function(e: MouseEvent) {
    if (e.button === 1) { // 中键
      e.preventDefault();
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      stageStartX = stage.x();
      stageStartY = stage.y();
      canvasEl.style.cursor = 'grabbing';
    }
  });

  document.addEventListener('mousemove', function(e: MouseEvent) {
    if (!isPanning) return;
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    stage.x(stageStartX + dx);
    stage.y(stageStartY + dy);
    stage.batchDraw();
  });

  document.addEventListener('mouseup', function() {
    if (isPanning) {
      isPanning = false;
      canvasEl.style.cursor = '';
    }
  });

  // 防止中键默认滚动行为
  canvasEl.addEventListener('wheel', function(e: WheelEvent) {
    if (e.button === 1) e.preventDefault();
  });

  // ---- 空格+左键拖拽平移 (替代方案) ----
  let spaceHeld = false;
  let spacePanStartX = 0;
  let spacePanStartY = 0;
  let spaceStageStartX = 0;
  let spaceStageStartY = 0;
  let spaceDragging = false;

  document.addEventListener('keydown', function(e: KeyboardEvent) {
    if (e.key === ' ' && !e.repeat && !spaceHeld) {
      // 只在没有输入框焦点时激活
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      spaceHeld = true;
      canvasEl.style.cursor = 'grab';
    }
  });

  document.addEventListener('keyup', function(e: KeyboardEvent) {
    if (e.key === ' ') {
      spaceHeld = false;
      if (spaceDragging) {
        spaceDragging = false;
      }
      canvasEl.style.cursor = '';
    }
  });

  // 初始化缩放标签
  updateZoomLabel();
}

/** 计算房间包围盒 (以 wallPoints 为准) */
export function computeRoomBounds(wallPoints: Array<{ x: number; y: number }>) {
  if (wallPoints.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of wallPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
