// ============================================================
//  🏠 房间改造工具 — 主入口
//  技术栈: Konva.js · TypeScript · Vite
//  模式: 画户型 | 放家具 | 智能布局
// ============================================================

import Konva from 'konva';
import { state, pushUndo, clearSelection, saveToStorage, loadFromStorage, clearStorage } from './state/store';
import type { EditorMode, WallSegment, Point } from './engine/types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, WALL_COLOR, WALL_SELECTED_COLOR,
  WALL_CLOSE_RADIUS, DOOR_DEFAULT_WIDTH, WINDOW_DEFAULT_WIDTH,
  FURNITURE_DEFS, WALL_THICKNESS, MIN_DOOR_WIDTH, MAX_DOOR_WIDTH,
} from './engine/constants';
import {
  dist, snapToGrid, angleBetween, clonePoints,
  pointToSegmentDist, getWallPos, findNearestWall,
  updateWallPointsFromSegments, syncConnectedSegments,
  snapSegmentEndpoints, resizeWallSegment as resizeWallSegmentGeom,
} from './engine/geometry';
import { rebuildWallSegments, createRoomFromDimensions } from './engine/walls';
import { rebuildDoorsAndWindowsData } from './engine/openings';
import { runSmartLayout } from './engine/layout';
import { log } from './engine/logger';
import { drawGrid } from './renderer/gridLayer';
import {
  renderWalls, renderWallPolygon, updateSelectionHandles,
  updateSelectionHandlesPosition, updateConnectedWallVisuals,
} from './renderer/wallLayer';
import { renderFurniture, placeFurniture as renderPlaceFurniture } from './renderer/furnitureLayer';
import {
  renderDoor, renderWindow, updateDoorArc,
  renderDoorSelectionHandles, renderWindowSelectionHandles,
} from './renderer/doorLayer';
import { showPreviewGhost, hidePreviewGhost } from './renderer/previewLayer';
import { setStatus } from './ui/statusBar';
import { bindToolbarEvents, updateUndoRedoButtons } from './ui/toolbar';
import { bindSidebarEvents } from './ui/sidebar';
import './styles/main.css';

// ============================================================
//  预设模板
// ============================================================

interface RoomTemplate {
  label: string;
  width: number;   // cm
  height: number;  // cm
  furniture: Array<{ type: string; x: number; y: number }>;
}

const ROOM_TEMPLATES: Record<string, RoomTemplate> = {
  children: {
    label: '儿童房 4m×3m',
    width: 400,
    height: 300,
    furniture: [
      { type: 'bed', x: 240, y: 200 },
      { type: 'desk', x: 500, y: 170 },
      { type: 'wardrobe', x: 240, y: 400 },
      { type: 'chair', x: 520, y: 250 },
    ],
  },
  bedroom: {
    label: '主卧 5m×4m',
    width: 500,
    height: 400,
    furniture: [
      { type: 'bed', x: 240, y: 200 },
      { type: 'wardrobe', x: 600, y: 200 },
      { type: 'desk', x: 240, y: 480 },
      { type: 'chair', x: 280, y: 500 },
      { type: 'sofa', x: 600, y: 480 },
    ],
  },
  study: {
    label: '书房 3m×3m',
    width: 300,
    height: 300,
    furniture: [
      { type: 'desk', x: 250, y: 180 },
      { type: 'chair', x: 260, y: 250 },
      { type: 'wardrobe', x: 200, y: 260 },
    ],
  },
  living: {
    label: '客厅 6m×4m',
    width: 600,
    height: 400,
    furniture: [
      { type: 'sofa', x: 300, y: 200 },
      { type: 'desk', x: 500, y: 350 },
      { type: 'chair', x: 550, y: 380 },
      { type: 'wardrobe', x: 200, y: 350 },
    ],
  },
};

// ============================================================
//  localStorage 自动保存 (防抖)
// ============================================================

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function triggerSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveToStorage();
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = '💾 已自动保存';
      setTimeout(() => {
        const text = document.getElementById('status-text');
        if (text && text.textContent === '💾 已自动保存') {
          // Flash indicator — will be overwritten by next user action
        }
      }, 1200);
    }
  }, 500);
}

// ============================================================
//  Konva 初始化
// ============================================================

const container = document.getElementById('canvas-stage')!;
const stage = new Konva.Stage({
  container: 'canvas-stage',
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
});

// 图层
const gridLayer = new Konva.Layer();
const wallLayer = new Konva.Layer();
const furnitureLayer = new Konva.Layer();
const overlayLayer = new Konva.Layer();
const previewLayer = new Konva.Layer();

stage.add(gridLayer);
stage.add(wallLayer);
stage.add(furnitureLayer);
stage.add(overlayLayer);
stage.add(previewLayer);

// ============================================================
//  核心重建函数
// ============================================================

/** 重建所有墙段 (Konva) */
function rebuildWallSegmentsFull(): void {
  // 清除旧墙段
  wallLayer.destroyChildren();

  state.wallSegments = [];
  state.selectedWallId = null;
  clearSelection();
  document.getElementById('door-panel')!.style.display = 'none';
  overlayLayer.destroyChildren();

  const pts = state.wallPoints;
  if (pts.length < 2) {
    wallLayer.batchDraw();
    return;
  }

  // 重建墙段数据
  const segs = rebuildWallSegments(pts, state.isClosed, state.nextWallId);
  state.wallSegments = segs;
  state.nextWallId += segs.length;

  // 渲染墙段
  for (const seg of segs) {
    renderSingleWallSegment(seg);
  }

  // 绘制填充多边形
  if (state.isClosed && pts.length >= 3) {
    renderWallPolygon(wallLayer, pts);
  }

  // 重绘门/窗
  rebuildDoorsAndWindowsFull();

  wallLayer.batchDraw();
}

/** 渲染单个墙段 */
function renderSingleWallSegment(seg: WallSegment): void {
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
    stroke: WALL_COLOR,
    strokeWidth: 0,
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

  wallLayer.add(group);

  // 保存 group 引用到 seg
  (seg as WallSegment & { group: Konva.Group }).group = group;

  // ---- 墙段点击选中 ----
  rect.on('click', function() {
    if (state.mode !== 'draw') return;
    selectWallSegment(seg);
  });

  // ---- 墙段拖拽 ----
  group.on('dragstart', function() {
    if (state.mode !== 'draw') return;
    selectWallSegment(seg);
  });

  group.on('dragmove', function() {
    if (state.mode !== 'draw') return;
    const gx = group.x();
    const gy = group.y();
    const expectedCx = (seg.p1.x + seg.p2.x) / 2;
    const expectedCy = (seg.p1.y + seg.p2.y) / 2;
    const offsetX = gx - expectedCx;
    const offsetY = gy - expectedCy;

    seg.p1.x += offsetX;
    seg.p1.y += offsetY;
    seg.p2.x += offsetX;
    seg.p2.y += offsetY;

    state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
    syncConnectedSegments(seg, state.wallSegments);

    if (state.selectedWallId === seg.id) {
      updateSelectionHandlesPosition(seg, overlayLayer);
    }

    updateDoorsWindowsOnSegments();
  });

  group.on('dragend', function() {
    if (state.mode !== 'draw') return;
    snapSegmentEndpoints(seg);
    state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
    syncConnectedSegments(seg, state.wallSegments);
    rebuildWallSegmentsFull();
    pushUndo();
    updateUndoRedoButtons();
    triggerSave();
  });

  // ---- 右键删除墙段 ----
  group.on('contextmenu', function(e: Konva.KonvaEventObject<PointerEvent>) {
    e.evt.preventDefault();
    if (state.mode !== 'draw') return;
    if (state.wallPoints.length < 2) return;
    pushUndo();
    const segIdx = state.wallSegments.indexOf(seg);
    if (segIdx !== -1) {
      const ptIdx = (segIdx + 1) % state.wallPoints.length;
      if (state.isClosed && state.wallPoints.length <= 3) {
        state.isClosed = false;
      }
      state.wallPoints.splice(ptIdx, 1);
      if (state.wallPoints.length < 3) state.isClosed = false;
    }
    rebuildWallSegmentsFull();
    updateUndoRedoButtons();
    triggerSave();
  });
}

/** 选中墙段 */
function selectWallSegment(seg: WallSegment): void {
  clearSelectionFull();
  state.selectedWallId = seg.id;
  const segWithGroup = seg as WallSegment & { group: Konva.Group };
  const rect = segWithGroup.group?.findOne('.wall-body') as Konva.Rect | undefined;
  if (rect) rect.stroke(WALL_SELECTED_COLOR);

  updateSelectionHandles(
    seg, overlayLayer, container, stage,
    // onResizeP1
    (x: number, y: number) => {
      const snapped = { x: snapToGrid(x), y: snapToGrid(y) };
      seg.p1.x = snapped.x;
      seg.p1.y = snapped.y;
      updateWallSegmentVisual(seg);
      syncConnectedSegments(seg, state.wallSegments);
      updateConnectedWallVisuals(seg, state.wallSegments);
      updateDoorsWindowsOnSegments();
      updateSelectionHandlesPosition(seg, overlayLayer);
      wallLayer.batchDraw();
    },
    // onResizeP1End
    () => {
      state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
      rebuildWallSegmentsFull();
      const newSeg = state.wallSegments.find(s => s.id === seg.id);
      if (newSeg) selectWallSegment(newSeg);
      pushUndo();
      updateUndoRedoButtons();
      triggerSave();
    },
    // onResizeP2
    (x: number, y: number) => {
      const snapped = { x: snapToGrid(x), y: snapToGrid(y) };
      seg.p2.x = snapped.x;
      seg.p2.y = snapped.y;
      updateWallSegmentVisual(seg);
      syncConnectedSegments(seg, state.wallSegments);
      updateConnectedWallVisuals(seg, state.wallSegments);
      updateDoorsWindowsOnSegments();
      updateSelectionHandlesPosition(seg, overlayLayer);
      wallLayer.batchDraw();
    },
    // onResizeP2End
    () => {
      state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
      rebuildWallSegmentsFull();
      const newSeg = state.wallSegments.find(s => s.id === seg.id);
      if (newSeg) selectWallSegment(newSeg);
      pushUndo();
      updateUndoRedoButtons();
      triggerSave();
    },
    // onRotate
    (newAngle: number) => {
      const deg = Konva.Util.radToDeg(newAngle);
      const snapped = Math.round(deg / 15) * 15;
      const rad = Konva.Util.degToRad(snapped);
      const cx = (seg.p1.x + seg.p2.x) / 2;
      const cy = (seg.p1.y + seg.p2.y) / 2;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const half = seg.length / 2;
      seg.p1.x = cx - half * cos;
      seg.p1.y = cy - half * sin;
      seg.p2.x = cx + half * cos;
      seg.p2.y = cy + half * sin;
      seg.angle = rad;
      updateWallSegmentVisual(seg);
      state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
      syncConnectedSegments(seg, state.wallSegments);
      updateConnectedWallVisuals(seg, state.wallSegments);
      updateDoorsWindowsOnSegments();
      updateSelectionHandlesPosition(seg, overlayLayer);
      wallLayer.batchDraw();
    },
    // onRotateEnd
    () => {
      state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
      rebuildWallSegmentsFull();
      const newSeg = state.wallSegments.find(s => s.id === seg.id);
      if (newSeg) selectWallSegment(newSeg);
      pushUndo();
      updateUndoRedoButtons();
      triggerSave();
    },
    // onLengthChange
    (newLen: number) => {
      resizeWallSegmentGeom(seg, newLen);
      state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
      syncConnectedSegments(seg, state.wallSegments);
      rebuildWallSegmentsFull();
      const newSeg = state.wallSegments.find(s => s.id === seg.id);
      if (newSeg) selectWallSegment(newSeg);
      pushUndo();
      updateUndoRedoButtons();
      triggerSave();
    }
  );

  wallLayer.batchDraw();
  log('选中墙段', { id: seg.id, length: seg.length });
}

/** 更新单个墙段视觉 (不重建) */
function updateWallSegmentVisual(seg: WallSegment): void {
  const segWithGroup = seg as WallSegment & { group: Konva.Group };
  const group = segWithGroup.group;
  if (!group) return;
  const cx = (seg.p1.x + seg.p2.x) / 2;
  const cy = (seg.p1.y + seg.p2.y) / 2;
  group.x(cx);
  group.y(cy);
  group.rotation(Konva.Util.radToDeg(seg.angle));
  const rect = group.findOne('.wall-body') as Konva.Rect | undefined;
  if (rect) {
    rect.x(-seg.length / 2);
    rect.width(seg.length);
  }
  const endpoints = group.find('.wall-endpoint') as Konva.Circle[] | undefined;
  if (endpoints && endpoints.length >= 2) {
    endpoints[0]?.x(-seg.length / 2);
    endpoints[1]?.x(seg.length / 2);
  }
}

/** 清除选中 (完整版) */
function clearSelectionFull(): void {
  // 清除墙选中
  if (state.selectedWallId !== null) {
    const oldSeg = state.wallSegments.find(s => s.id === state.selectedWallId);
    if (oldSeg) {
      const segWithGroup = oldSeg as WallSegment & { group: Konva.Group };
      const rect = segWithGroup.group?.findOne('.wall-body') as Konva.Rect | undefined;
      if (rect) rect.stroke(WALL_COLOR);
    }
  }
  clearSelection();
  document.getElementById('door-panel')!.style.display = 'none';
  overlayLayer.destroyChildren();
  overlayLayer.batchDraw();
}

// ============================================================
//  门/窗系统
// ============================================================

/** 创建门 (Konva) */
function createDoorFull(wallIdx: number, t: number, width: number, swingInward: boolean, hingeSide: 'left' | 'right' = 'left'): void {
  const seg = state.wallSegments[wallIdx];
  if (!seg) return;

  const w = width || DOOR_DEFAULT_WIDTH;
  const sw = swingInward !== undefined ? swingInward : true;
  log('创建门', { wallIdx, t, width: w, swingInward: sw, hingeSide });

  const pos = getWallPos(wallIdx, t, state.wallSegments);
  if (!pos) return;

  const id = state.nextDoorId++;

  const doorData = {
    id,
    wallIdx,
    t,
    width: w,
    swingInward: sw,
    hingeSide,
    hingeX: pos.x,
    hingeY: pos.y,
  };
  state.doors.push(doorData);

  // 渲染门
  renderDoor(
    doorData, seg, wallLayer,
    (did: number) => selectDoor(did),
    (did: number, gx: number, gy: number) => {
      const door = state.doors.find(d => d.id === did);
      if (!door) return;
      const result = findNearestWall(gx, gy, state.wallSegments);
      if (result && result.idx === wallIdx) {
        const newPos = getWallPos(wallIdx, result.t, state.wallSegments);
        if (newPos) {
          door.t = result.t;
          door.hingeX = newPos.x;
          door.hingeY = newPos.y;
        }
      }
    },
    () => {
      rebuildDoorsAndWindowsFull();
    }
  );

  wallLayer.batchDraw();
  triggerSave();
}

/** 创建窗户 (Konva) */
function createWindowFull(wallIdx: number, t: number, width: number): void {
  const seg = state.wallSegments[wallIdx];
  if (!seg) return;

  const w = width || WINDOW_DEFAULT_WIDTH;
  log('创建窗户', { wallIdx, t, width: w });

  const pos = getWallPos(wallIdx, t, state.wallSegments);
  if (!pos) return;

  const id = state.nextWindowId++;

  const winData = {
    id,
    wallIdx,
    t,
    width: w,
  };
  state.windows.push(winData);

  // 渲染窗户
  renderWindow(
    winData, seg, wallLayer,
    (wid: number) => selectWindow(wid),
    (wid: number, gx: number, gy: number) => {
      const win = state.windows.find(w => w.id === wid);
      if (!win) return;
      const result = findNearestWall(gx, gy, state.wallSegments);
      if (result && result.idx === wallIdx) {
        const newPos = getWallPos(wallIdx, result.t, state.wallSegments);
        if (newPos) {
          win.t = result.t;
        }
      }
    },
    () => {
      rebuildDoorsAndWindowsFull();
    }
  );

  wallLayer.batchDraw();
  triggerSave();
}

/** 选中门 */
function selectDoor(id: number): void {
  clearSelectionFull();
  const door = state.doors.find(d => d.id === id);
  if (!door) return;
  state.selectedElementId = id;
  state.selectedElementType = 'door';
  log('选中门', { id, swingInward: door.swingInward, hingeSide: door.hingeSide });

  // 显示门参数面板
  const panel = document.getElementById('door-panel')!;
  panel.style.display = 'block';

  // 宽度输入
  const widthInput = document.getElementById('door-width-input') as HTMLInputElement;
  widthInput.value = String(door.width);

  // 铰链侧按钮
  const hingeBtn = document.getElementById('btn-door-hinge')!;
  hingeBtn.textContent = door.hingeSide === 'left' ? '铰链: 左' : '铰链: 右';

  // 开门方向按钮
  const dirBtn = document.getElementById('btn-door-dir')!;
  dirBtn.textContent = door.swingInward ? '向内开' : '向外开';

  renderDoorSelectionHandles(door, state.wallSegments, overlayLayer, (newWidth: number) => {
    door.width = newWidth;
    rebuildDoorsAndWindowsFull();
    selectDoor(id);
  });

  wallLayer.batchDraw();
}

/** 选中窗户 */
function selectWindow(id: number): void {
  clearSelectionFull();
  const win = state.windows.find(w => w.id === id);
  if (!win) return;
  state.selectedElementId = id;
  state.selectedElementType = 'window';
  log('选中窗户', { id });

  renderWindowSelectionHandles(win, state.wallSegments, overlayLayer, (newWidth: number) => {
    win.width = newWidth;
    rebuildDoorsAndWindowsFull();
    selectWindow(id);
  });

  wallLayer.batchDraw();
}

/** 重建门/窗 (在墙段重建后调用) */
function rebuildDoorsAndWindowsFull(): void {
  if (state._rebuildingDoorsWindows) return;
  state._rebuildingDoorsWindows = true;

  // 保存门/窗数据
  const { doors: doorData, windows: winData } = rebuildDoorsAndWindowsData(
    state.doors, state.windows, state.wallSegments
  );

  // 销毁旧门/窗 (Konva groups)
  wallLayer.find('Group').forEach(g => {
    const name = g.name();
    if (name && (name.startsWith('door-') || name.startsWith('window-'))) {
      g.destroy();
    }
  });
  state.doors = [];
  state.windows = [];

  // 重新创建门/窗
  for (const dd of doorData) {
    createDoorFull(dd.wallIdx, dd.t, dd.width, dd.swingInward, dd.hingeSide);
  }
  for (const wd of winData) {
    createWindowFull(wd.wallIdx, wd.t, wd.width);
  }

  state._rebuildingDoorsWindows = false;
}

/** 更新门/窗位置 (墙段移动后) */
function updateDoorsWindowsOnSegments(): void {
  // Find door/window groups and update their positions
  wallLayer.find('Group').forEach(g => {
    const name = g.name();
    if (name && name.startsWith('door-')) {
      const id = parseInt(name.replace('door-', ''), 10);
      const door = state.doors.find(d => d.id === id);
      if (!door) return;
      const seg = state.wallSegments[door.wallIdx];
      if (!seg) return;
      const pos = getWallPos(door.wallIdx, door.t, state.wallSegments);
      if (pos) {
        g.x(pos.x);
        g.y(pos.y);
        g.rotation(Konva.Util.radToDeg(seg.angle));
      }
    }
    if (name && name.startsWith('window-')) {
      const id = parseInt(name.replace('window-', ''), 10);
      const win = state.windows.find(w => w.id === id);
      if (!win) return;
      const seg = state.wallSegments[win.wallIdx];
      if (!seg) return;
      const pos = getWallPos(win.wallIdx, win.t, state.wallSegments);
      if (pos) {
        g.x(pos.x);
        g.y(pos.y);
        g.rotation(Konva.Util.radToDeg(seg.angle));
      }
    }
  });
}

// ============================================================
//  家具系统
// ============================================================

/** 移除家具 */
function removeFurniture(group: Konva.Group): void {
  const idx = state.furnitureItems.findIndex(f => {
    // Match by checking if the group is the same
    return false; // We'll use a different approach
  });
  // Find by iterating
  for (let i = 0; i < state.furnitureItems.length; i++) {
    const item = state.furnitureItems[i];
    if (item && item.type === group.name().replace('furniture-', '')) {
      // Check position match
      if (Math.abs(item.x - group.x()) < 1 && Math.abs(item.y - group.y()) < 1) {
        state.furnitureItems.splice(i, 1);
        break;
      }
    }
  }
  group.destroy();
  furnitureLayer.batchDraw();
  log('移除家具');
  triggerSave();
}

/** 放置家具 */
function placeFurnitureFull(type: string, x: number, y: number, rotation?: number): void {
  const group = renderPlaceFurniture(furnitureLayer, type, x, y, rotation || 0, stage, removeFurniture);
  if (!group) return;
  state.furnitureItems.push({ type, x: group.x(), y: group.y(), rotation: rotation || 0 });
  furnitureLayer.batchDraw();
  log('放置家具', { type, x, y });
  triggerSave();
}

// ============================================================
//  智能布局
// ============================================================

function runSmartLayoutFull(): void {
  log('智能布局开始', { furniture: state.furnitureItems.length });
  if (state.wallPoints.length < 3) {
    setStatus('⚠️ 请先绘制房间墙线再运行智能布局', 'idle');
    return;
  }

  const results = runSmartLayout(state.wallPoints, state.furnitureItems);

  for (let i = 0; i < results.length; i++) {
    const item = state.furnitureItems[i];
    const result = results[i];
    if (!item || !result) continue;

    // Find the Konva group for this furniture item
    furnitureLayer.find('Group').forEach(g => {
      const name = g.name();
      if (name && name === 'furniture-' + item.type) {
        // Check if this is the right one by position proximity
        if (Math.abs(g.x() - item.x) < 5 && Math.abs(g.y() - item.y) < 5) {
          new Konva.Tween({
            node: g,
            duration: 0.3,
            x: result.x,
            y: result.y,
            easing: Konva.Easings.EaseOut,
          }).play();
        }
      }
    });

    item.x = result.x;
    item.y = result.y;
  }

  log('智能布局完成', { items: state.furnitureItems.length });
  setStatus('✨ 智能布局完成！家具已沿墙排列', 'success');
  triggerSave();
}

// ============================================================
//  清除全部
// ============================================================

function clearAllFull(): void {
  if (!confirm('确定要清除全部内容吗？')) return;
  log('清除全部');

  state.wallPoints = [];
  state.wallSegments = [];
  state.isClosed = false;
  state.undoStack = [];
  state.redoStack = [];

  state.doors = [];
  state.windows = [];

  state.furnitureItems = [];

  state.selectedWallId = null;
  state.selectedElementId = null;
  state.selectedElementType = null;
  state.placingElementType = null;
  document.querySelectorAll('#building-catalog .furniture-card').forEach(c => c.classList.remove('placing-active'));
  document.getElementById('door-panel')!.style.display = 'none';

  wallLayer.destroyChildren();
  furnitureLayer.destroyChildren();
  overlayLayer.destroyChildren();
  previewLayer.destroyChildren();

  wallLayer.batchDraw();
  furnitureLayer.batchDraw();
  updateUndoRedoButtons();
  clearStorage();
  setStatus('已清除全部 — 点击画布开始绘制墙线', 'idle');
}

// ============================================================
//  模式切换
// ============================================================

function setMode(mode: EditorMode): void {
  log('模式切换 → ' + mode);
  state.mode = mode;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
  });

  const catalog = document.getElementById('furniture-catalog')!;
  catalog.classList.toggle('visible', mode === 'place');

  const layoutBtn = document.getElementById('btn-layout')!;
  layoutBtn.style.display = mode === 'layout' ? 'block' : 'none';

  const containerEl = stage.container();
  if (mode === 'draw') {
    containerEl.style.cursor = 'crosshair';
    setStatus('画户型模式 — 点击画布放置墙点，点击起点闭合房间', 'drawing');
  } else if (mode === 'place') {
    containerEl.style.cursor = 'default';
    setStatus('放家具模式 — 从左侧目录拖拽或点击放置家具', 'placing');
  } else {
    containerEl.style.cursor = 'default';
    setStatus('智能布局模式 — 点击「智能布局」按钮运行算法', 'idle');
    // Run smart layout immediately when switching to layout mode
    runSmartLayoutFull();
  }

  // Update furniture draggability
  furnitureLayer.find('Group').forEach(g => {
    g.draggable(mode === 'place');
  });
  triggerSave();
}

// ============================================================
//  墙绘制逻辑
// ============================================================

function addWallPoint(x: number, y: number): void {
  if (state.isClosed) return;

  const sx = snapToGrid(x);
  const sy = snapToGrid(y);
  const newPt = { x: sx, y: sy };

  // 检查是否点击了第一个点 (闭合)
  if (state.wallPoints.length >= 3) {
    const first = state.wallPoints[0];
    if (first && dist(newPt, first) < WALL_CLOSE_RADIUS) {
      pushUndo();
      state.isClosed = true;
      state.wallPoints.push({ x: first.x, y: first.y });
      rebuildWallSegmentsFull();
      log('房间已闭合', { walls: state.wallSegments.length });
      setStatus('✅ 房间已闭合！切换到「放家具」模式添加家具', 'success');
      triggerSave();
      return;
    }
  }

  pushUndo();
  state.wallPoints.push(newPt);
  log('添加墙点', { x: sx, y: sy, total: state.wallPoints.length });
  rebuildWallSegmentsFull();
  updateUndoRedoButtons();
  triggerSave();
}

// ============================================================
//  事件绑定
// ============================================================

// ---- 画布点击 ----
stage.on('click', function(e) {
  const targetName = e.target.name();
  if (targetName === 'rot-handle' || targetName === 'del-handle' ||
      targetName === 'resize-handle' || targetName === 'door-resize' ||
      targetName === 'win-resize') return;

  const pos = stage.getPointerPosition();
  if (!pos) return;

  // 如果正在放置门/窗，优先处理
  if (state.mode === 'draw' && state.placingElementType) {
    if (state.placingElementType === 'door') {
      const result = findNearestWall(pos.x, pos.y, state.wallSegments);
      if (result && result.dist < 30) {
        createDoorFull(result.idx, result.t, DOOR_DEFAULT_WIDTH, true, 'left');
        setStatus('门已放置 — 点击继续放置，Esc 退出', 'success');
        log('门已放置', { wallIdx: result.idx, t: result.t });
      }
      return;
    }
    if (state.placingElementType === 'window') {
      const result = findNearestWall(pos.x, pos.y, state.wallSegments);
      if (result && result.dist < 30) {
        createWindowFull(result.idx, result.t, WINDOW_DEFAULT_WIDTH);
        setStatus('窗户已放置 — 点击继续放置，Esc 退出', 'success');
        log('窗户已放置', { wallIdx: result.idx, t: result.t });
      }
      return;
    }
    return;
  }

  // 如果点击的是墙段、门、窗，让它们自己的事件处理
  if (targetName === 'wall-body' || targetName === 'wall-endpoint' ||
      targetName === 'door-body' || targetName === 'door-hinge' ||
      targetName === 'door-arc' || targetName === 'window-frame' ||
      targetName === 'window-line') return;

  if (state.mode === 'draw') {
    addWallPoint(pos.x, pos.y);
  } else if (state.mode === 'place' && state.dragFurnitureType) {
    placeFurnitureFull(state.dragFurnitureType, pos.x, pos.y);
    state.dragFurnitureType = null;
    setStatus('放家具模式 — 从左侧目录拖拽或点击放置家具', 'placing');
  } else {
    clearSelectionFull();
    wallLayer.batchDraw();
  }
});

// ---- 门/窗预览幽灵 (mousemove) ----
stage.on('mousemove', function() {
  hidePreviewGhost(previewLayer);
  if (!state.placingElementType || state.mode !== 'draw') return;

  const pos = stage.getPointerPosition();
  if (!pos) return;
  const result = findNearestWall(pos.x, pos.y, state.wallSegments);
  if (result && result.dist < 30) {
    const seg = state.wallSegments[result.idx];
    if (!seg) return;
    showPreviewGhost(state.placingElementType, result.projX, result.projY, seg.angle, previewLayer);
  }
});

// ---- 画布接收拖拽 ----
stage.on('dragover', function(e: Konva.KonvaEventObject<DragEvent>) {
  e.evt.preventDefault();
});

stage.on('drop', function(e: Konva.KonvaEventObject<DragEvent>) {
  e.evt.preventDefault();
  if (state.mode !== 'place') return;
  const type = e.evt.dataTransfer?.getData('text/plain');
  if (type && FURNITURE_DEFS[type]) {
    const pos = stage.getPointerPosition();
    if (pos) {
      placeFurnitureFull(type, pos.x, pos.y);
    }
  }
});

// ---- 键盘快捷键 ----
document.addEventListener('keydown', function(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (state.mode === 'draw') {
      // Trigger undo via custom event
      const undoBtn = document.getElementById('btn-undo');
      if (undoBtn) undoBtn.click();
    }
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    if (state.mode === 'draw') {
      const redoBtn = document.getElementById('btn-redo');
      if (redoBtn) redoBtn.click();
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.mode === 'place') {
      const selected = (furnitureLayer.find('Group') as Konva.Group[]).filter(g => {
        const rect = g.findOne('Rect') as Konva.Rect | undefined;
        return rect && rect.stroke() === '#3498db';
      });
      selected.forEach(g => removeFurniture(g));
    }
    if (state.mode === 'draw' && state.selectedElementId !== null) {
      if (state.selectedElementType === 'door') {
        const door = state.doors.find(d => d.id === state.selectedElementId);
        if (door) {
          state.doors = state.doors.filter(d => d.id !== door.id);
          clearSelectionFull();
          rebuildDoorsAndWindowsFull();
          triggerSave();
          return;
        }
      }
      if (state.selectedElementType === 'window') {
        const win = state.windows.find(w => w.id === state.selectedElementId);
        if (win) {
          state.windows = state.windows.filter(w => w.id !== win.id);
          clearSelectionFull();
          rebuildDoorsAndWindowsFull();
          triggerSave();
          return;
        }
      }
    }
  }
  if (e.key === 'Escape') {
    state.dragFurnitureType = null;
    if (state.placingElementType) {
      state.placingElementType = null;
      hidePreviewGhost(previewLayer);
      document.querySelectorAll('#building-catalog .furniture-card').forEach(c => c.classList.remove('placing-active'));
      setStatus('退出放置模式', 'idle');
    } else {
      clearSelectionFull();
      wallLayer.batchDraw();
      setStatus('放家具模式 — 从左侧目录拖拽或点击放置家具', 'placing');
    }
  }
});

// ---- 窗口级 Escape 监听 ----
window.addEventListener('keydown', function(e: KeyboardEvent) {
  if (e.key === 'Escape' && state.placingElementType) {
    state.placingElementType = null;
    hidePreviewGhost(previewLayer);
    document.querySelectorAll('#building-catalog .furniture-card').forEach(c => c.classList.remove('placing-active'));
    setStatus('退出放置模式', 'idle');
  }
});

// ---- 滚轮缩放 ----
stage.on('wheel', function(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault();
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  if (!pointer) return;
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };

  let newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
  newScale = Math.max(0.3, Math.min(3, newScale));

  stage.scale({ x: newScale, y: newScale });
  stage.position({
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  });
  stage.batchDraw();
});

// ---- 监听 wall-changed 事件 (用于撤销/重做) ----
document.addEventListener('wall-changed', function() {
  rebuildWallSegmentsFull();
  updateUndoRedoButtons();
  triggerSave();
});

// ---- 监听 door-changed 事件 (用于门方向切换) ----
document.addEventListener('door-changed', function() {
  const id = state.selectedElementId;
  if (id === null || state.selectedElementType !== 'door') return;
  rebuildDoorsAndWindowsFull();
  selectDoor(id);
  triggerSave();
});

// ============================================================
//  绑定 UI 事件
// ============================================================

bindToolbarEvents({
  onSetMode: setMode,
  onRebuildWalls: rebuildWallSegmentsFull,
  onClearAll: clearAllFull,
  onDrawGrid: () => drawGrid(gridLayer, state.showGrid),
  onUpdateUndoRedo: updateUndoRedoButtons,
});

bindSidebarEvents({
  onPlaceDoor: (wallIdx: number, t: number) => createDoorFull(wallIdx, t, DOOR_DEFAULT_WIDTH, true, 'left'),
  onPlaceWindow: (wallIdx: number, t: number) => createWindowFull(wallIdx, t, WINDOW_DEFAULT_WIDTH),
  onPlaceFurniture: (type: string, x: number, y: number) => placeFurnitureFull(type, x, y),
  onStartDragFromCatalog: (type: string) => {
    state.dragFurnitureType = type;
  },
});

// ---- 门参数面板事件 ----
document.getElementById('btn-door-hinge')!.addEventListener('click', function() {
  const id = state.selectedElementId;
  if (id === null || state.selectedElementType !== 'door') return;
  const door = state.doors.find(d => d.id === id);
  if (!door) return;
  door.hingeSide = door.hingeSide === 'left' ? 'right' : 'left';
  this.textContent = door.hingeSide === 'left' ? '铰链: 左' : '铰链: 右';
  rebuildDoorsAndWindowsFull();
  selectDoor(id);
  triggerSave();
});

document.getElementById('door-width-input')!.addEventListener('change', function() {
  const id = state.selectedElementId;
  if (id === null || state.selectedElementType !== 'door') return;
  const door = state.doors.find(d => d.id === id);
  if (!door) return;
  const input = this as HTMLInputElement;
  let val = parseInt(input.value, 10);
  if (isNaN(val)) val = DOOR_DEFAULT_WIDTH;
  val = Math.max(MIN_DOOR_WIDTH, Math.min(MAX_DOOR_WIDTH, val));
  input.value = String(val);
  door.width = val;
  rebuildDoorsAndWindowsFull();
  selectDoor(id);
  triggerSave();
});

// ============================================================
//  初始化
// ============================================================

drawGrid(gridLayer, state.showGrid);
updateUndoRedoButtons();

// 尝试从 localStorage 恢复状态
const saved = loadFromStorage();
if (saved) {
  // 恢复状态
  state.wallPoints = saved.wallPoints;
  state.isClosed = saved.isClosed;
  state.doors = saved.doors;
  state.windows = saved.windows;
  state.furnitureItems = saved.furnitureItems;
  state.mode = saved.mode;
  state.showGrid = saved.showGrid;
  state.nextWallId = saved.nextWallId;
  state.nextDoorId = saved.nextDoorId;
  state.nextWindowId = saved.nextWindowId;

  // 重建墙段
  rebuildWallSegmentsFull();

  // 重新渲染家具 (state.furnitureItems 已恢复，只需创建 Konva 图形)
  for (const item of saved.furnitureItems) {
    renderPlaceFurniture(furnitureLayer, item.type, item.x, item.y, item.rotation, stage, removeFurniture);
  }
  furnitureLayer.batchDraw();

  // 恢复网格
  drawGrid(gridLayer, state.showGrid);

  // 恢复模式 UI
  state.mode = saved.mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === saved.mode);
  });
  const catalog = document.getElementById('furniture-catalog')!;
  catalog.classList.toggle('visible', saved.mode === 'place');
  const layoutBtn = document.getElementById('btn-layout')!;
  layoutBtn.style.display = saved.mode === 'layout' ? 'block' : 'none';
  const containerEl = stage.container();
  if (saved.mode === 'draw') {
    containerEl.style.cursor = 'crosshair';
  } else if (saved.mode === 'place') {
    containerEl.style.cursor = 'default';
  } else {
    containerEl.style.cursor = 'default';
  }
  // Update furniture draggability
  furnitureLayer.find('Group').forEach(g => {
    g.draggable(saved.mode === 'place');
  });

  setStatus('📂 已恢复上次保存的房间', 'success');
  log('已从 localStorage 恢复状态');
} else {
  // 首次访问 — 创建默认示例房间
  setMode('draw');

  // 添加示例墙 (400x300 房间)
  const demoWalls = [
    { x: 200, y: 150 },
    { x: 600, y: 150 },
    { x: 600, y: 450 },
    { x: 200, y: 450 },
  ];
  for (const p of demoWalls) {
    state.wallPoints.push({ x: p.x, y: p.y });
  }
  state.isClosed = true;
  rebuildWallSegmentsFull();

  // 添加示例门 (在底部墙上，t=0.3)
  createDoorFull(3, 0.3, 80, true);

  // 添加示例窗户 (在顶部墙上，t=0.5)
  createWindowFull(0, 0.5, 100);

  // 添加示例家具
  placeFurnitureFull('bed', 240, 200);
  placeFurnitureFull('desk', 480, 170);
  placeFurnitureFull('wardrobe', 240, 420);
  placeFurnitureFull('chair', 500, 260);
  placeFurnitureFull('sofa', 420, 370);

  setStatus('🏠 欢迎！已加载示例房间。试试切换模式或拖拽家具', 'idle');
}

// ---- AI 输入框 ----
const aiInput = document.getElementById('ai-input') as HTMLInputElement;
if (aiInput) {
  aiInput.addEventListener('keydown', function(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const text = aiInput.value.trim();
      if (!text) return;
      log('用户AI输入', { text });
      setStatus(`已记录需求：${text.slice(0, 40)}... — AI 功能开发中`, 'success');
      aiInput.value = '';
    }
  });
}

// ---- 预设模板按钮 ----
document.querySelectorAll('.template-btn').forEach((btn) => {
  btn.addEventListener('click', function(this: HTMLElement) {
    const templateKey = this.dataset.template;
    if (!templateKey) return;
    const tmpl = ROOM_TEMPLATES[templateKey];
    if (!tmpl) return;

    log('加载模板', { template: tmpl.label });

    // Clear everything
    state.wallPoints = [];
    state.wallSegments = [];
    state.isClosed = false;
    state.undoStack = [];
    state.redoStack = [];
    state.doors = [];
    state.windows = [];
    state.furnitureItems = [];
    state.selectedWallId = null;
    state.selectedElementId = null;
    state.selectedElementType = null;
    state.placingElementType = null;
    document.querySelectorAll('#building-catalog .furniture-card').forEach(c => c.classList.remove('placing-active'));
    document.getElementById('door-panel')!.style.display = 'none';
    wallLayer.destroyChildren();
    furnitureLayer.destroyChildren();
    overlayLayer.destroyChildren();
    previewLayer.destroyChildren();

    // Create room from template dimensions
    const pts = createRoomFromDimensions(tmpl.width, tmpl.height);
    for (const p of pts) {
      state.wallPoints.push({ x: p.x, y: p.y });
    }
    state.isClosed = true;
    rebuildWallSegmentsFull();

    // Place template furniture
    for (const furn of tmpl.furniture) {
      placeFurnitureFull(furn.type, furn.x, furn.y);
    }

    updateUndoRedoButtons();
    wallLayer.batchDraw();
    furnitureLayer.batchDraw();
    clearStorage();
    triggerSave();
    setStatus(`已加载模板：${tmpl.label} — 可自由编辑`, 'success');
  });
});

log('房间改造工具已加载');
console.log('模式: 画户型 | 放家具 | 智能布局');
console.log('快捷键: Ctrl+Z 撤销, Ctrl+Y 重做, Delete 删除选中, Escape 取消');
