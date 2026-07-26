// ============================================================
//  🏠 房间改造工具 — 墙段渲染
// ============================================================

import Konva from 'konva';
import type { WallSegment, Point } from '../engine/types';
import { WALL_THICKNESS, WALL_COLOR, WALL_SELECTED_COLOR, HANDLE_RADIUS } from '../engine/constants';
import { dist, angleBetween } from '../engine/geometry';

/** 渲染所有墙段 */
export function renderWalls(
  layer: Konva.Layer,
  segs: WallSegment[],
  selectedId: number | null,
  onSelect: (seg: WallSegment) => void,
  onDragMove: (seg: WallSegment) => void,
  onDragEnd: (seg: WallSegment) => void,
  onContextMenu: (seg: WallSegment) => void
): void {
  for (const seg of segs) {
    createWallGroup(layer, seg, selectedId, onSelect, onDragMove, onDragEnd, onContextMenu);
  }
  layer.batchDraw();
}

/** 创建单个墙段 Group */
function createWallGroup(
  layer: Konva.Layer,
  seg: WallSegment,
  selectedId: number | null,
  onSelect: (seg: WallSegment) => void,
  onDragMove: (seg: WallSegment) => void,
  onDragEnd: (seg: WallSegment) => void,
  onContextMenu: (seg: WallSegment) => void
): Konva.Group {
  const cx = (seg.p1.x + seg.p2.x) / 2;
  const cy = (seg.p1.y + seg.p2.y) / 2;

  const group = new Konva.Group({
    x: cx,
    y: cy,
    rotation: Konva.Util.radToDeg(seg.angle),
    draggable: true,
    name: 'wall-segment-' + seg.id,
  });

  // 墙主体
  const rect = new Konva.Rect({
    x: -seg.length / 2,
    y: -WALL_THICKNESS / 2,
    width: seg.length,
    height: WALL_THICKNESS,
    fill: WALL_COLOR,
    stroke: selectedId === seg.id ? WALL_SELECTED_COLOR : WALL_COLOR,
    strokeWidth: selectedId === seg.id ? 2 : 0,
    cornerRadius: 2,
    name: 'wall-body',
  });
  group.add(rect);

  // 端点圆
  const end1 = new Konva.Circle({
    x: -seg.length / 2,
    y: 0,
    radius: 3,
    fill: '#2c3e50',
    stroke: '#fff',
    strokeWidth: 1.5,
    name: 'wall-endpoint',
  });
  group.add(end1);

  const end2 = new Konva.Circle({
    x: seg.length / 2,
    y: 0,
    radius: 3,
    fill: '#2c3e50',
    stroke: '#fff',
    strokeWidth: 1.5,
    name: 'wall-endpoint',
  });
  group.add(end2);

  layer.add(group);

  // 事件
  rect.on('click', () => onSelect(seg));
  group.on('dragstart', () => onSelect(seg));
  group.on('dragmove', () => onDragMove(seg));
  group.on('dragend', () => onDragEnd(seg));
  group.on('contextmenu', (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    onContextMenu(seg);
  });

  return group;
}

/** 渲染墙多边形填充 */
export function renderWallPolygon(layer: Konva.Layer, points: Point[]): Konva.Line | null {
  if (points.length < 3) return null;
  const flat = points.flatMap(p => [p.x, p.y]);
  const polygon = new Konva.Line({
    points: flat,
    closed: true,
    fill: 'rgba(255,255,255,0.15)',
    stroke: 'transparent',
    strokeWidth: 0,
    listening: false,
  });
  layer.add(polygon);
  return polygon;
}

/** 更新选中墙段的手柄 */
export function updateSelectionHandles(
  seg: WallSegment,
  overlayLayer: Konva.Layer,
  container: HTMLElement,
  stage: Konva.Stage,
  onResizeP1: (x: number, y: number) => void,
  onResizeP1End: () => void,
  onResizeP2: (x: number, y: number) => void,
  onResizeP2End: () => void,
  onRotate: (angle: number) => void,
  onRotateEnd: () => void,
  onLengthChange: (newLen: number) => void
): void {
  overlayLayer.destroyChildren();

  const cx = (seg.p1.x + seg.p2.x) / 2;
  const cy = (seg.p1.y + seg.p2.y) / 2;

  // 端点1 手柄
  const h1 = new Konva.Circle({
    x: seg.p1.x,
    y: seg.p1.y,
    radius: HANDLE_RADIUS + 1,
    fill: '#3498db',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'resize-handle',
    draggable: true,
  });
  overlayLayer.add(h1);

  // 端点2 手柄
  const h2 = new Konva.Circle({
    x: seg.p2.x,
    y: seg.p2.y,
    radius: HANDLE_RADIUS + 1,
    fill: '#3498db',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'resize-handle',
    draggable: true,
  });
  overlayLayer.add(h2);

  // 旋转手柄
  const rotHandle = new Konva.Circle({
    x: cx,
    y: cy - 20,
    radius: HANDLE_RADIUS + 1,
    fill: '#e67e22',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'rot-handle',
    draggable: true,
  });
  overlayLayer.add(rotHandle);

  // 旋转手柄连接线
  const rotLine = new Konva.Line({
    points: [cx, cy, cx, cy - 20],
    stroke: '#e67e22',
    strokeWidth: 1,
    dash: [3, 3],
    listening: false,
  });
  overlayLayer.add(rotLine);

  // 长度标签
  const lenM = seg.length.toFixed(0);
  const lenLabel = new Konva.Text({
    x: cx - 30,
    y: cy + 10,
    text: lenM + 'cm',
    fontSize: 12,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fill: '#3498db',
    align: 'center',
    width: 60,
    listening: false,
  });
  overlayLayer.add(lenLabel);

  // 长度输入框
  const inputDiv = document.createElement('div');
  inputDiv.id = 'wall-length-input';
  inputDiv.style.cssText = 'position:absolute; z-index:100; display:none;';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = seg.length.toFixed(0);
  input.style.cssText = 'width:60px; padding:2px 4px; border:1px solid #3498db; border-radius:4px; font-size:12px; text-align:center; outline:none;';
  inputDiv.appendChild(input);
  container.appendChild(inputDiv);

  const stageBox = stage.container().getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const relX = stageBox.left - containerRect.left + cx;
  const relY = stageBox.top - containerRect.top + cy + 30;
  inputDiv.style.left = (relX - 30) + 'px';
  inputDiv.style.top = relY + 'px';
  inputDiv.style.display = 'block';

  input.addEventListener('keydown', function(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const val = parseFloat(this.value);
      if (!isNaN(val) && val > 0) {
        onLengthChange(val);
      }
      inputDiv.style.display = 'none';
      inputDiv.remove();
    }
  });
  input.addEventListener('blur', function() {
    inputDiv.style.display = 'none';
    inputDiv.remove();
  });
  input.focus();
  input.select();

  // 端点拖拽事件
  h1.on('dragmove', function() {
    const pos = this.position();
    onResizeP1(pos.x, pos.y);
  });
  h1.on('dragend', onResizeP1End);

  h2.on('dragmove', function() {
    const pos = this.position();
    onResizeP2(pos.x, pos.y);
  });
  h2.on('dragend', onResizeP2End);

  // 旋转手柄
  rotHandle.on('dragmove', function() {
    const mx = stage.getPointerPosition()?.x ?? 0;
    const my = stage.getPointerPosition()?.y ?? 0;
    const newAngle = Math.atan2(my - cy, mx - cx);
    onRotate(newAngle);
  });
  rotHandle.on('dragend', onRotateEnd);

  overlayLayer.batchDraw();
}

/** 更新选中手柄位置 (不销毁重建) */
export function updateSelectionHandlesPosition(seg: WallSegment, overlayLayer: Konva.Layer): void {
  const handles = overlayLayer.find('.resize-handle');
  const rotHandles = overlayLayer.find('.rot-handle');
  if (handles.length >= 2) {
    handles[0]?.x(seg.p1.x);
    handles[0]?.y(seg.p1.y);
    handles[1]?.x(seg.p2.x);
    handles[1]?.y(seg.p2.y);
  }
  const cx = (seg.p1.x + seg.p2.x) / 2;
  const cy = (seg.p1.y + seg.p2.y) / 2;
  if (rotHandles.length > 0) {
    rotHandles[0]?.x(cx);
    rotHandles[0]?.y(cy - 20);
  }
  overlayLayer.batchDraw();
}

/** 更新与指定墙段相连的所有墙段的视觉外观 (不重建) */
export function updateConnectedWallVisuals(movedSeg: WallSegment, segs: WallSegment[]): void {
  for (const seg of segs) {
    if (seg.id === movedSeg.id) continue;
    seg.angle = angleBetween(seg.p1, seg.p2);
    seg.length = dist(seg.p1, seg.p2);
    const cx = (seg.p1.x + seg.p2.x) / 2;
    const cy = (seg.p1.y + seg.p2.y) / 2;
    seg.group?.x(cx);
    seg.group?.y(cy);
    seg.group?.rotation(Konva.Util.radToDeg(seg.angle));
    const rect = seg.group?.findOne('.wall-body') as Konva.Rect | undefined;
    if (rect) {
      rect.x(-seg.length / 2);
      rect.width(seg.length);
    }
    const endpoints = seg.group?.find('.wall-endpoint') as Konva.Circle[] | undefined;
    if (endpoints && endpoints.length >= 2) {
      endpoints[0]?.x(-seg.length / 2);
      endpoints[1]?.x(seg.length / 2);
    }
  }
}
