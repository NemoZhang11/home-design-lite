// ============================================================
//  🏠 房间改造工具 — 主入口 v5.1
//  技术栈: Konva.js · TypeScript · Vite
//  结构: 4标签 (房间设置 | 选择家具 | 布局方案 | 微调)
// ============================================================

import Konva from 'konva';
import { state, pushUndo, popUndo, clearSelection, saveToStorage, loadFromStorage, clearStorage } from './state/store';
import type { ActiveTab } from './state/store';
import type { EditorMode, WallSegment, Point } from './engine/types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, WALL_COLOR, WALL_SELECTED_COLOR,
  WALL_CLOSE_RADIUS, DOOR_DEFAULT_WIDTH, WINDOW_DEFAULT_WIDTH,
  FURNITURE_DEFS, WALL_THICKNESS, MIN_DOOR_WIDTH, MAX_DOOR_WIDTH,
  MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH,
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
import { setStatus, setStatusForTab, initShortcutHint } from './ui/statusBar';
import { setActiveTab, initStepPanel } from './ui/stepPanel';
import { initCanvasControls, computeRoomBounds } from './ui/canvasControls';
import { renderStep1Panel, updateRoomInfo } from './ui/step1Room';
import { renderStep2Panel, getSelectedFurniture } from './ui/step2Furniture';
import { renderStep3Panel, setSchemeResults, getCurrentSchemeIdx, getSchemeCount, initSchemeKeyboardNav } from './ui/step3Layout';
import { renderStep4Panel, setSelectedFurnitureIdx, getSelectedFurnitureIdx, refreshAdjustPanel } from './ui/step4Adjust';
import './styles/main.css';

// ============================================================
//  预设模板
// ============================================================

interface RoomTemplate {
  label: string;
  width: number;
  height: number;
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

function rebuildWallSegmentsFull(): void {
  wallLayer.destroyChildren();
  state.wallSegments = [];
  state.selectedWallId = null;
  clearSelection();
  overlayLayer.destroyChildren();

  const pts = state.wallPoints;
  if (pts.length < 2) {
    wallLayer.batchDraw();
    return;
  }

  const segs = rebuildWallSegments(pts, state.isClosed, state.nextWallId);
  state.wallSegments = segs;
  state.nextWallId += segs.length;

  for (const seg of segs) {
    renderSingleWallSegment(seg);
  }

  if (state.isClosed && pts.length >= 3) {
    renderWallPolygon(wallLayer, pts);
  }

  rebuildDoorsAndWindowsFull();
  wallLayer.batchDraw();
}

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

  const hitArea = new Konva.Rect({
    x: -seg.length / 2,
    y: -20,
    width: seg.length,
    height: 40,
    fill: 'transparent',
    stroke: 'transparent',
    name: 'wall-hit-area',
    listening: true,
    opacity: 0,
  });
  group.add(hitArea);
  hitArea.moveToBottom();

  const end1 = new Konva.Circle({
    x: -seg.length / 2, y: 0, radius: 3,
    fill: '#2c3e50', stroke: '#fff', strokeWidth: 1.5,
    name: 'wall-endpoint',
  });
  group.add(end1);

  const end2 = new Konva.Circle({
    x: seg.length / 2, y: 0, radius: 3,
    fill: '#2c3e50', stroke: '#fff', strokeWidth: 1.5,
    name: 'wall-endpoint',
  });
  group.add(end2);

  // ---- 墙段 hover 发光 ----
  rect.on('mouseenter', function() {
    rect.shadowColor('#3498db');
    rect.shadowBlur(6);
    rect.shadowOpacity(0.5);
    rect.shadowEnabled(true);
    wallLayer.batchDraw();
  });
  rect.on('mouseleave', function() {
    rect.shadowEnabled(false);
    wallLayer.batchDraw();
  });

  // ---- 墙段长度标注 ----
  const labelText = new Konva.Text({
    x: 0,
    y: -WALL_THICKNESS / 2 - 16,
    text: `${Math.round(seg.length)}cm`,
    fontSize: 11,
    fill: '#95a5a6',
    align: 'center',
    width: seg.length,
    offsetX: seg.length / 2,
    name: 'wall-label',
    listening: false,
  });
  group.add(labelText);

  wallLayer.add(group);
  (seg as WallSegment & { group: Konva.Group }).group = group;

  // 墙段点击选中
  rect.on('click', function() {
    if (state.activeTab !== 'room') return;
    if (state.placingElementType) return;
    selectWallSegment(seg);
  });

  // 墙段拖拽
  group.on('dragstart', function() {
    if (state.activeTab !== 'room') return;
    selectWallSegment(seg);
  });

  group.on('dragmove', function() {
    if (state.activeTab !== 'room') return;
    const gx = group.x(); const gy = group.y();
    const expectedCx = (seg.p1.x + seg.p2.x) / 2;
    const expectedCy = (seg.p1.y + seg.p2.y) / 2;
    const offsetX = gx - expectedCx; const offsetY = gy - expectedCy;
    seg.p1.x += offsetX; seg.p1.y += offsetY;
    seg.p2.x += offsetX; seg.p2.y += offsetY;
    state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
    syncConnectedSegments(seg, state.wallSegments);
    if (state.selectedWallId === seg.id) {
      updateSelectionHandlesPosition(seg, overlayLayer);
    }
    updateDoorsWindowsOnSegments();
  });

  group.on('dragend', function() {
    if (state.activeTab !== 'room') return;
    snapSegmentEndpoints(seg);
    state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed);
    syncConnectedSegments(seg, state.wallSegments);
    rebuildWallSegmentsFull();
    pushUndo();
    triggerSave();
  });

  // 右键删除墙段
  group.on('contextmenu', function(e: Konva.KonvaEventObject<PointerEvent>) {
    e.evt.preventDefault();
    if (state.activeTab !== 'room') return;
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
    triggerSave();
  });
}

function selectWallSegment(seg: WallSegment): void {
  clearSelectionFull();
  state.selectedWallId = seg.id;
  const segWithGroup = seg as WallSegment & { group: Konva.Group };
  const rect = segWithGroup.group?.findOne('.wall-body') as Konva.Rect | undefined;
  if (rect) rect.stroke(WALL_SELECTED_COLOR);

  updateSelectionHandles(
    seg, overlayLayer, container, stage,
    (x, y) => { seg.p1.x = snapToGrid(x); seg.p1.y = snapToGrid(y); updateWallSegmentVisual(seg); syncConnectedSegments(seg, state.wallSegments); updateConnectedWallVisuals(seg, state.wallSegments); updateDoorsWindowsOnSegments(); updateSelectionHandlesPosition(seg, overlayLayer); wallLayer.batchDraw(); },
    () => { state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed); rebuildWallSegmentsFull(); const ns = state.wallSegments.find(s => s.id === seg.id); if (ns) selectWallSegment(ns); pushUndo(); triggerSave(); },
    (x, y) => { seg.p2.x = snapToGrid(x); seg.p2.y = snapToGrid(y); updateWallSegmentVisual(seg); syncConnectedSegments(seg, state.wallSegments); updateConnectedWallVisuals(seg, state.wallSegments); updateDoorsWindowsOnSegments(); updateSelectionHandlesPosition(seg, overlayLayer); wallLayer.batchDraw(); },
    () => { state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed); rebuildWallSegmentsFull(); const ns = state.wallSegments.find(s => s.id === seg.id); if (ns) selectWallSegment(ns); pushUndo(); triggerSave(); },
    (newAngle) => { const deg = Konva.Util.radToDeg(newAngle); const snapped = Math.round(deg / 15) * 15; const rad = Konva.Util.degToRad(snapped); const cx = (seg.p1.x + seg.p2.x) / 2; const cy = (seg.p1.y + seg.p2.y) / 2; const cos = Math.cos(rad); const sin = Math.sin(rad); const half = seg.length / 2; seg.p1.x = cx - half * cos; seg.p1.y = cy - half * sin; seg.p2.x = cx + half * cos; seg.p2.y = cy + half * sin; seg.angle = rad; updateWallSegmentVisual(seg); state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed); syncConnectedSegments(seg, state.wallSegments); updateConnectedWallVisuals(seg, state.wallSegments); updateDoorsWindowsOnSegments(); updateSelectionHandlesPosition(seg, overlayLayer); wallLayer.batchDraw(); },
    () => { state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed); rebuildWallSegmentsFull(); const ns = state.wallSegments.find(s => s.id === seg.id); if (ns) selectWallSegment(ns); pushUndo(); triggerSave(); },
    (newLen) => { resizeWallSegmentGeom(seg, newLen); state.wallPoints = updateWallPointsFromSegments(state.wallSegments, state.isClosed); syncConnectedSegments(seg, state.wallSegments); rebuildWallSegmentsFull(); const ns = state.wallSegments.find(s => s.id === seg.id); if (ns) selectWallSegment(ns); pushUndo(); triggerSave(); },
  );
  wallLayer.batchDraw();
}

function updateWallSegmentVisual(seg: WallSegment): void {
  const segWithGroup = seg as WallSegment & { group: Konva.Group };
  const group = segWithGroup.group;
  if (!group) return;
  const cx = (seg.p1.x + seg.p2.x) / 2; const cy = (seg.p1.y + seg.p2.y) / 2;
  group.x(cx); group.y(cy); group.rotation(Konva.Util.radToDeg(seg.angle));
  const rect = group.findOne('.wall-body') as Konva.Rect | undefined;
  if (rect) { rect.x(-seg.length / 2); rect.width(seg.length); }
  const endpoints = group.find('.wall-endpoint') as Konva.Circle[] | undefined;
  if (endpoints && endpoints.length >= 2) {
    endpoints[0]?.x(-seg.length / 2);
    endpoints[1]?.x(seg.length / 2);
  }
}

function clearSelectionFull(): void {
  if (state.selectedWallId !== null) {
    const oldSeg = state.wallSegments.find(s => s.id === state.selectedWallId);
    if (oldSeg) {
      const segWithGroup = oldSeg as WallSegment & { group: Konva.Group };
      const rect = segWithGroup.group?.findOne('.wall-body') as Konva.Rect | undefined;
      if (rect) rect.stroke(WALL_COLOR);
    }
  }
  clearSelection();
  overlayLayer.destroyChildren();
  overlayLayer.batchDraw();
}

// ============================================================
//  门/窗系统
// ============================================================

function createDoorFull(wallIdx: number, t: number, width: number, swingInward: boolean, hingeSide: 'left' | 'right' = 'left'): void {
  const seg = state.wallSegments[wallIdx];
  if (!seg) return;
  const w = width || DOOR_DEFAULT_WIDTH;
  const pos = getWallPos(wallIdx, t, state.wallSegments);
  if (!pos) return;
  const id = state.nextDoorId++;
  const doorData = { id, wallIdx, t, width: w, swingInward, hingeSide, hingeX: pos.x, hingeY: pos.y };
  state.doors.push(doorData);

  renderDoor(doorData, seg, wallLayer,
    (did: number) => selectDoor(did),
    (did: number, gx: number, gy: number) => {
      const door = state.doors.find(d => d.id === did);
      if (!door) return;
      const result = findNearestWall(gx, gy, state.wallSegments);
      if (result && result.idx === wallIdx) {
        const newPos = getWallPos(wallIdx, result.t, state.wallSegments);
        if (newPos) { door.t = result.t; door.hingeX = newPos.x; door.hingeY = newPos.y; }
      }
    },
    () => { rebuildDoorsAndWindowsFull(); }
  );
  wallLayer.batchDraw();
  triggerSave();
}

function createWindowFull(wallIdx: number, t: number, width: number): void {
  const seg = state.wallSegments[wallIdx];
  if (!seg) return;
  const pos = getWallPos(wallIdx, t, state.wallSegments);
  if (!pos) return;
  const id = state.nextWindowId++;
  const winData = { id, wallIdx, t, width };
  state.windows.push(winData);

  renderWindow(winData, seg, wallLayer,
    (wid: number) => selectWindow(wid),
    (wid: number, gx: number, gy: number) => {
      const win = state.windows.find(w => w.id === wid);
      if (!win) return;
      const result = findNearestWall(gx, gy, state.wallSegments);
      if (result && result.idx === wallIdx) {
        const newPos = getWallPos(wallIdx, result.t, state.wallSegments);
        if (newPos) { win.t = result.t; }
      }
    },
    () => { rebuildDoorsAndWindowsFull(); }
  );
  wallLayer.batchDraw();
  triggerSave();
}

function selectDoor(id: number): void {
  clearSelectionFull();
  const door = state.doors.find(d => d.id === id);
  if (!door) return;
  state.selectedElementId = id;
  state.selectedElementType = 'door';

  renderDoorSelectionHandles(door, state.wallSegments, overlayLayer, (newWidth: number) => {
    door.width = newWidth;
    rebuildDoorsAndWindowsFull();
    selectDoor(id);
  });
  wallLayer.batchDraw();
}

function selectWindow(id: number): void {
  clearSelectionFull();
  const win = state.windows.find(w => w.id === id);
  if (!win) return;
  state.selectedElementId = id;
  state.selectedElementType = 'window';

  renderWindowSelectionHandles(win, state.wallSegments, overlayLayer, (newWidth: number) => {
    win.width = newWidth;
    rebuildDoorsAndWindowsFull();
    selectWindow(id);
  });
  wallLayer.batchDraw();
}

function rebuildDoorsAndWindowsFull(): void {
  if (state._rebuildingDoorsWindows) return;
  state._rebuildingDoorsWindows = true;
  const { doors: doorData, windows: winData } = rebuildDoorsAndWindowsData(state.doors, state.windows, state.wallSegments);
  wallLayer.find('Group').forEach(g => {
    const name = g.name();
    if (name && (name.startsWith('door-') || name.startsWith('window-'))) g.destroy();
  });
  state.doors = [];
  state.windows = [];
  for (const dd of doorData) createDoorFull(dd.wallIdx, dd.t, dd.width, dd.swingInward, dd.hingeSide);
  for (const wd of winData) createWindowFull(wd.wallIdx, wd.t, wd.width);
  state._rebuildingDoorsWindows = false;
}

function updateDoorsWindowsOnSegments(): void {
  wallLayer.find('Group').forEach(g => {
    const name = g.name();
    if (name && name.startsWith('door-')) {
      const id = parseInt(name.replace('door-', ''), 10);
      const door = state.doors.find(d => d.id === id);
      if (!door) return;
      const seg = state.wallSegments[door.wallIdx];
      if (!seg) return;
      const pos = getWallPos(door.wallIdx, door.t, state.wallSegments);
      if (pos) { g.x(pos.x); g.y(pos.y); g.rotation(Konva.Util.radToDeg(seg.angle)); }
    }
    if (name && name.startsWith('window-')) {
      const id = parseInt(name.replace('window-', ''), 10);
      const win = state.windows.find(w => w.id === id);
      if (!win) return;
      const seg = state.wallSegments[win.wallIdx];
      if (!seg) return;
      const pos = getWallPos(win.wallIdx, win.t, state.wallSegments);
      if (pos) { g.x(pos.x); g.y(pos.y); g.rotation(Konva.Util.radToDeg(seg.angle)); }
    }
  });
}

// ============================================================
//  家具系统
// ============================================================

function removeFurniture(group: Konva.Group): void {
  for (let i = 0; i < state.furnitureItems.length; i++) {
    const item = state.furnitureItems[i];
    if (item && item.type === group.name().replace('furniture-', '')) {
      if (Math.abs(item.x - group.x()) < 1 && Math.abs(item.y - group.y()) < 1) {
        state.furnitureItems.splice(i, 1);
        break;
      }
    }
  }
  group.destroy();
  furnitureLayer.batchDraw();
  triggerSave();
}

function placeFurnitureFull(type: string, x: number, y: number, rotation?: number): void {
  const group = renderPlaceFurniture(furnitureLayer, type, x, y, rotation || 0, stage, removeFurniture);
  if (!group) return;
  state.furnitureItems.push({ type, x: group.x(), y: group.y(), rotation: rotation || 0 });
  furnitureLayer.batchDraw();
  triggerSave();
}

// ============================================================
//  智能布局
// ============================================================

function runSmartLayoutFull(): void {
  if (state.wallPoints.length < 3) {
    setStatus('⚠️ 请先绘制房间墙线再运行智能布局', 'idle');
    return;
  }
  const results = runSmartLayout(state.wallPoints, state.furnitureItems);
  for (let i = 0; i < results.length; i++) {
    const item = state.furnitureItems[i];
    const result = results[i];
    if (!item || !result) continue;
    furnitureLayer.find('Group').forEach(g => {
      const name = g.name();
      if (name && name === 'furniture-' + item.type) {
        if (Math.abs(g.x() - item.x) < 5 && Math.abs(g.y() - item.y) < 5) {
          new Konva.Tween({
            node: g, duration: 0.3, x: result.x, y: result.y,
            easing: Konva.Easings.EaseOut,
          }).play();
        }
      }
    });
    item.x = result.x;
    item.y = result.y;
  }
  setStatus('✨ 智能布局完成！家具已沿墙排列', 'success');
  triggerSave();
}

// ============================================================
//  清除全部
// ============================================================

function clearAllFull(): void {
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
  state.furnitureQuantities = { bed: 0, desk: 0, wardrobe: 0, chair: 0, sofa: 0 };

  wallLayer.destroyChildren();
  furnitureLayer.destroyChildren();
  overlayLayer.destroyChildren();
  previewLayer.destroyChildren();

  wallLayer.batchDraw();
  furnitureLayer.batchDraw();
  clearStorage();

  // 恢复模板浮层
  const overlay = document.getElementById('template-overlay');
  if (overlay) overlay.style.display = 'flex';
  state.hasEverHadRoom = false;

  setStatus('已清除全部 — 选择一个模板开始', 'idle');
}

// ============================================================
//  墙绘制逻辑
// ============================================================

function addWallPoint(x: number, y: number): void {
  if (state.isClosed) return;
  const sx = snapToGrid(x); const sy = snapToGrid(y);
  const newPt = { x: sx, y: sy };

  if (state.wallPoints.length >= 3) {
    const first = state.wallPoints[0];
    if (first && dist(newPt, first) < WALL_CLOSE_RADIUS) {
      pushUndo();
      state.isClosed = true;
      state.wallPoints.push({ x: first.x, y: first.y });
      rebuildWallSegmentsFull();
      state.hasEverHadRoom = true;
      // 隐藏模板浮层
      const overlay = document.getElementById('template-overlay');
      if (overlay) overlay.style.display = 'none';
      setStatusForTab('room');
      triggerSave();
      return;
    }
  }
  pushUndo();
  state.wallPoints.push(newPt);
  rebuildWallSegmentsFull();
  triggerSave();
}

// ============================================================
//  画布事件绑定
// ============================================================

stage.on('click', function(e) {
  const targetName = e.target.name();
  if (targetName === 'rot-handle' || targetName === 'del-handle' || targetName === 'resize-handle' || targetName === 'door-resize' || targetName === 'win-resize') return;
  const pos = stage.getPointerPosition();
  if (!pos) return;

  // 放置门/窗
  if (state.activeTab === 'room' && state.placingElementType) {
    if (state.placingElementType === 'door') {
      const result = findNearestWall(pos.x, pos.y, state.wallSegments);
      if (result && result.dist < 40) {
        pushUndo();
        createDoorFull(result.idx, result.t, DOOR_DEFAULT_WIDTH, true, 'left');
        const lastDoor = state.doors[state.doors.length - 1];
        if (lastDoor) selectDoor(lastDoor.id);
        state.placingElementType = null;
        hidePreviewGhost(previewLayer);
        setStatusForTab('room');
      }
      return;
    }
    if (state.placingElementType === 'window') {
      const result = findNearestWall(pos.x, pos.y, state.wallSegments);
      if (result && result.dist < 40) {
        pushUndo();
        createWindowFull(result.idx, result.t, WINDOW_DEFAULT_WIDTH);
        const lastWin = state.windows[state.windows.length - 1];
        if (lastWin) selectWindow(lastWin.id);
        state.placingElementType = null;
        hidePreviewGhost(previewLayer);
        setStatusForTab('room');
      }
      return;
    }
    return;
  }

  // 不处理墙/门/窗自身的点击
  if (targetName === 'wall-body' || targetName === 'wall-endpoint' || targetName === 'wall-hit-area' ||
      targetName === 'door-body' || targetName === 'door-hinge' || targetName === 'door-arc' ||
      targetName === 'window-frame' || targetName === 'window-line') return;

  // 手动放置家具 (在任何标签下，只要 placingElementType === 'furniture')
  if (state.placingElementType === 'furniture' && state.dragFurnitureType) {
    pushUndo();
    placeFurnitureFull(state.dragFurnitureType, pos.x, pos.y);
    state.dragFurnitureType = null;
    // 保持放置模式，允许连放多个
    // state.placingElementType = null; — 保持，用户按 Esc 退出
    setStatusForTab(state.activeTab);
    return;
  }

  if (state.activeTab === 'room') {
    addWallPoint(pos.x, pos.y);
  } else {
    clearSelectionFull();
    wallLayer.batchDraw();
  }
});

// 幽灵预览 (家具也在此预览)
stage.on('mousemove', function() {
  hidePreviewGhost(previewLayer);

  // 家具幽灵预览
  if (state.placingElementType === 'furniture' && state.dragFurnitureType) {
    const pos = stage.getPointerPosition();
    if (pos) {
      showPreviewGhost('furniture', pos.x, pos.y, 0, previewLayer, state.dragFurnitureType);
    }
    return;
  }

  // 门/窗幽灵预览
  if (!state.placingElementType || state.activeTab !== 'room') return;
  if (state.placingElementType === 'furniture') return;
  const pos = stage.getPointerPosition();
  if (!pos) return;
  const result = findNearestWall(pos.x, pos.y, state.wallSegments);
  if (result && result.dist < 40) {
    const seg = state.wallSegments[result.idx];
    if (!seg) return;
    showPreviewGhost(state.placingElementType, result.projX, result.projY, seg.angle, previewLayer);
  }
});

// 拖放
stage.on('dragover', function(e: Konva.KonvaEventObject<DragEvent>) { e.evt.preventDefault(); });
stage.on('drop', function(e: Konva.KonvaEventObject<DragEvent>) {
  e.evt.preventDefault();
  if (state.mode !== 'place') return;
  const type = e.evt.dataTransfer?.getData('text/plain');
  if (type && FURNITURE_DEFS[type]) {
    const pos = stage.getPointerPosition();
    if (pos) placeFurnitureFull(type, pos.x, pos.y);
  }
});

// ---- 键盘快捷键 ----
document.addEventListener('keydown', function(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    const snapshot = popUndo();
    if (snapshot) {
      state.wallPoints = snapshot.wallPoints;
      state.isClosed = snapshot.isClosed;
      state.doors = snapshot.doors;
      state.windows = snapshot.windows;
      state.furnitureItems = snapshot.furnitureItems;
      rebuildWallSegmentsFull();
      furnitureLayer.destroyChildren();
      for (const item of state.furnitureItems) {
        renderPlaceFurniture(furnitureLayer, item.type, item.x, item.y, item.rotation, stage, removeFurniture);
      }
      furnitureLayer.batchDraw();
      setStatus('已撤销', 'idle');
      triggerSave();
    }
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    // TODO: redo via popRedo — same pattern as undo
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.activeTab === 'room' && state.selectedElementId !== null) {
      pushUndo();
      if (state.selectedElementType === 'door') {
        const door = state.doors.find(d => d.id === state.selectedElementId);
        if (door) { state.doors = state.doors.filter(d => d.id !== door.id); clearSelectionFull(); rebuildDoorsAndWindowsFull(); triggerSave(); return; }
      }
      if (state.selectedElementType === 'window') {
        const win = state.windows.find(w => w.id === state.selectedElementId);
        if (win) { state.windows = state.windows.filter(w => w.id !== win.id); clearSelectionFull(); rebuildDoorsAndWindowsFull(); triggerSave(); return; }
      }
    }
    if (state.activeTab === 'adjust') {
      const selected = (furnitureLayer.find('Group') as Konva.Group[]).filter(g => {
        const rect = g.findOne('Rect') as Konva.Rect | undefined;
        return rect && rect.stroke() === '#3498db';
      });
      selected.forEach(g => removeFurniture(g));
    }
  }
  if (e.key === 'Escape') {
    state.dragFurnitureType = null;
    if (state.placingElementType) {
      state.placingElementType = null;
      hidePreviewGhost(previewLayer);
      setStatusForTab(state.activeTab);
    } else {
      clearSelectionFull();
      wallLayer.batchDraw();
    }
  }
});

window.addEventListener('keydown', function(e: KeyboardEvent) {
  if (e.key === 'Escape' && state.placingElementType) {
    state.placingElementType = null;
    hidePreviewGhost(previewLayer);
    setStatusForTab(state.activeTab);
  }
});

// ============================================================
//  模板加载
// ============================================================

function loadTemplate(templateKey: string): void {
  if (!confirm('当前房间将被替换，确定吗？')) return;
  const tmpl = ROOM_TEMPLATES[templateKey];
  if (!tmpl) return;

  clearAllFull();
  state.wallPoints = createRoomFromDimensions(tmpl.width, tmpl.height);
  state.isClosed = true;
  state.hasEverHadRoom = true;
  state.undoStack = [];
  state.redoStack = [];
  rebuildWallSegmentsFull();

  for (const furn of tmpl.furniture) {
    placeFurnitureFull(furn.type, furn.x, furn.y);
  }

  // 隐藏模板浮层
  const overlay = document.getElementById('template-overlay');
  if (overlay) overlay.style.display = 'none';

  wallLayer.batchDraw();
  furnitureLayer.batchDraw();
  setStatusForTab('room');
  triggerSave();
}

/** 加载模板 (直接传入宽高和家具列表) */
function loadTemplateFull(width: number, height: number, furniture: Array<{ type: string; x: number; y: number }>): void {
  clearAllFull();
  state.wallPoints = createRoomFromDimensions(width, height);
  state.isClosed = true;
  state.hasEverHadRoom = true;
  state.undoStack = [];
  state.redoStack = [];
  rebuildWallSegmentsFull();

  for (const furn of furniture) {
    placeFurnitureFull(furn.type, furn.x, furn.y);
  }

  const overlay = document.getElementById('template-overlay');
  if (overlay) overlay.style.display = 'none';

  wallLayer.batchDraw();
  furnitureLayer.batchDraw();
  updateRoomInfo();
  setStatusForTab('room');
  triggerSave();
}

// ============================================================
//  初始化 v5.1
// ============================================================

function init(): void {
  drawGrid(gridLayer, state.showGrid);

  // 初始化标签面板
  initStepPanel();

  // 初始化画布控件
  initCanvasControls({
    stage, container: stage.container(),
    zoomLabel: document.getElementById('zoom-label')!,
    fitBtn: document.getElementById('btn-fit-canvas')!,
    getRoomBounds: () => state.isClosed ? computeRoomBounds(state.wallPoints) : null,
  });

  // 初始化快捷键提示
  initShortcutHint();

  // ---- 渲染 Step 1 面板 (房间设置) ----
  function createRoomFromCustomDims(w: number, h: number): void {
    clearAllFull();
    state.wallPoints = createRoomFromDimensions(w, h);
    state.isClosed = true;
    state.hasEverHadRoom = true;
    state.undoStack = [];
    state.redoStack = [];
    rebuildWallSegmentsFull();
    const overlay = document.getElementById('template-overlay');
    if (overlay) overlay.style.display = 'none';
    updateRoomInfo();
    wallLayer.batchDraw();
    setStatusForTab('room');
    triggerSave();
  }

  renderStep1Panel(document.getElementById('panel-room')!, {
    onLoadTemplate: (w, h, furniture) => loadTemplateFull(w, h, furniture),
    onCreateRoom: (w, h) => createRoomFromCustomDims(w, h),
    onClearAll: () => clearAllFull(),
    onStartManualDraw: () => {
      setStatus('点击画布放置墙点，点击起点闭合房间', 'drawing');
    },
    onPlaceDoor: () => {
      state.placingElementType = 'door';
      setStatus('点击墙面放置门 — Esc 退出', 'placing');
    },
    onPlaceWindow: () => {
      state.placingElementType = 'window';
      setStatus('点击墙面放置窗户 — Esc 退出', 'placing');
    },
  });

  // ---- 渲染 Step 2 面板 (家具选择) ----
  function layoutFromSelection(): void {
    // 清除现有家具
    furnitureLayer.destroyChildren();
    state.furnitureItems = [];
    // 根据选择数量创建家具
    const selected = getSelectedFurniture();
    for (const s of selected) {
      const def = FURNITURE_DEFS[s.type];
      if (!def) continue;
      // 从房间中心开始放置，后续布局算法会调整
      const cx = state.wallPoints.length > 0 ? state.wallPoints.reduce((a, b) => a + b.x, 0) / state.wallPoints.length : 300;
      const cy = state.wallPoints.length > 0 ? state.wallPoints.reduce((a, b) => a + b.y, 0) / state.wallPoints.length : 300;
      placeFurnitureFull(s.type, cx, cy);
    }
    if (state.furnitureItems.length > 0) {
      runSmartLayoutFull();
    }
    setStatusForTab('layout');
    triggerSave();
  }

  // ---- 渲染 Step 3 面板 (布局方案) ----
  const step3Callbacks = {
    onApplyScheme: (idx: number) => {
      // Apply saved scheme to canvas
      const schemes = _layoutSchemes;
      if (schemes[idx]) {
        furnitureLayer.destroyChildren();
        state.furnitureItems = [];
        for (const furn of schemes[idx].furniture) {
          placeFurnitureFull(furn.type, furn.x, furn.y, furn.rotation);
        }
        furnitureLayer.batchDraw();
        setStatusForTab('layout');
      }
    },
    onRelayout: () => {
      generateLayoutSchemes();
      // Apply scheme A
      step3Callbacks.onApplyScheme(0);
      // Refresh panel
      renderStep3Panel(document.getElementById('panel-layout')!, step3Callbacks);
      setStatusForTab('layout');
    },
    onRestoreDefault: () => {
      step3Callbacks.onApplyScheme(0);
      renderStep3Panel(document.getElementById('panel-layout')!, step3Callbacks);
      setStatusForTab('layout');
    },
  };

  // Store layout schemes
  let _layoutSchemes: Array<{ schemeId: string; furniture: Array<{ type: string; x: number; y: number; rotation: number }> }> = [];

  function generateLayoutSchemes(): void {
    // Scheme A: wall-hugging (existing algorithm)
    const schemeA = state.furnitureItems.map((item, i) => {
      const results = runSmartLayout(state.wallPoints, state.furnitureItems);
      const r = results[i] || { x: item.x, y: item.y };
      return { type: item.type, x: r.x, y: r.y, rotation: 0 };
    });
    // Scheme B: same as A but with slight offset for variety
    const schemeB = schemeA.map(s => ({
      ...s,
      x: s.x + 10,
      y: s.y + 15,
    }));
    _layoutSchemes = [
      { schemeId: 'A', furniture: schemeA },
      { schemeId: 'B', furniture: schemeB },
    ];
    setSchemeResults(_layoutSchemes);
  }

  // 布局后生成方案 — wrap the step2 onLayout callback
  const _step2OnLayout = layoutFromSelection;
  const wrappedLayout = () => { _step2OnLayout(); generateLayoutSchemes(); };

  renderStep3Panel(document.getElementById('panel-layout')!, step3Callbacks);
  initSchemeKeyboardNav(step3Callbacks);

  // Override step2 onLayout to also generate schemes
  renderStep2Panel(document.getElementById('panel-furniture')!, {
    onLayout: wrappedLayout,
  });

  // ---- 渲染 Step 4 面板 (微调) ----
  const step4Callbacks = {
    onSelectFurniture: (idx: number) => {
      setSelectedFurnitureIdx(idx);
      // Highlight on canvas
      const groups = furnitureLayer.find('Group') as Konva.Group[];
      if (groups[idx]) {
        const group = groups[idx];
        // Clear previous highlights
        furnitureLayer.find('Group').forEach(g => {
          const group2 = g as Konva.Group;
          group2.getChildren().forEach(child => {
            if (child instanceof Konva.Rect) {
              child.stroke('');
              child.strokeWidth(0);
            }
          });
        });
        group.getChildren().forEach(child => {
          if (child instanceof Konva.Rect) {
            child.stroke('#3498db');
            child.strokeWidth(2);
          }
        });
        furnitureLayer.batchDraw();
      }
    },
    onRemoveFurniture: (idx: number) => {
      pushUndo();
      if (idx >= 0 && idx < state.furnitureItems.length) {
        state.furnitureItems.splice(idx, 1);
      }
      furnitureLayer.destroyChildren();
      for (const item of state.furnitureItems) {
        renderPlaceFurniture(furnitureLayer, item.type, item.x, item.y, item.rotation, stage, removeFurniture);
      }
      furnitureLayer.batchDraw();
      renderStep4Panel(document.getElementById('panel-adjust')!, step4Callbacks);
      triggerSave();
    },
    onRotateFurniture: (idx: number) => {
      if (idx >= 0 && idx < state.furnitureItems.length) {
        const item = state.furnitureItems[idx];
        if (!item) return;
        item.rotation = (item.rotation + 90) % 360;
        furnitureLayer.destroyChildren();
        for (const item of state.furnitureItems) {
          renderPlaceFurniture(furnitureLayer, item.type, item.x, item.y, item.rotation, stage, removeFurniture);
        }
        furnitureLayer.batchDraw();
        renderStep4Panel(document.getElementById('panel-adjust')!, step4Callbacks);
        triggerSave();
      }
    },
    onRestoreLayout: () => {
      // Go back to Step3 to re-apply scheme
      setActiveTab('layout');
    },
    onAddFurniture: () => {
      // 显示家具选择弹窗
      const picker = document.getElementById('modal-furniture-picker')!;
      const grid = document.getElementById('furniture-picker-grid')!;
      grid.innerHTML = '';

      const types = ['bed', 'desk', 'wardrobe', 'chair', 'sofa'] as const;
      const emoji: Record<string, string> = { bed: '🛏️', desk: '📝', wardrobe: '🗄️', chair: '💺', sofa: '🛋️' };

      for (const type of types) {
        const def = FURNITURE_DEFS[type];
        if (!def) continue;
        const card = document.createElement('div');
        card.className = 'furniture-picker-card';
        card.innerHTML = `
          <span class="picker-emoji">${emoji[type]}</span>
          <span class="picker-name">${def.label}</span>
          <span class="picker-size">${def.w}×${def.h}</span>
        `;
        card.addEventListener('click', () => {
          picker.style.display = 'none';
          state.placingElementType = 'furniture';
          state.dragFurnitureType = type;
          setStatus(`点击画布放置${def.label} — 连点连放，Esc 退出`, 'placing');
        });
        grid.appendChild(card);
      }

      picker.style.display = 'flex';
      document.getElementById('btn-picker-cancel')!.addEventListener('click', () => {
        picker.style.display = 'none';
      });
      picker.addEventListener('click', function(e: MouseEvent) {
        if (e.target === picker) picker.style.display = 'none';
      });
    },
    onUndo: () => {
      const snapshot = popUndo();
      if (snapshot) {
        state.wallPoints = snapshot.wallPoints;
        state.isClosed = snapshot.isClosed;
        state.doors = snapshot.doors;
        state.windows = snapshot.windows;
        state.furnitureItems = snapshot.furnitureItems;
        rebuildWallSegmentsFull();
        furnitureLayer.destroyChildren();
        for (const item of state.furnitureItems) {
          renderPlaceFurniture(furnitureLayer, item.type, item.x, item.y, item.rotation, stage, removeFurniture);
        }
        furnitureLayer.batchDraw();
        renderStep4Panel(document.getElementById('panel-adjust')!, step4Callbacks);
        setStatus('已撤销', 'idle');
        triggerSave();
      }
    },
    onRedo: () => {
      // Same pattern as undo but pop redo
      setStatus('重做功能暂未实现', 'idle');
    },
  };

  renderStep4Panel(document.getElementById('panel-adjust')!, step4Callbacks);

  // 模板浮层事件
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', function(this: HTMLElement) {
      const tmpl = this.dataset.template;
      if (tmpl) loadTemplate(tmpl);
    });
  });

  // 导出按钮
  document.getElementById('btn-export')!.addEventListener('click', () => {
    document.getElementById('modal-export')!.style.display = 'flex';
  });
  document.getElementById('btn-export-cancel')!.addEventListener('click', () => {
    document.getElementById('modal-export')!.style.display = 'none';
  });
  document.getElementById('btn-export-png')!.addEventListener('click', () => {
    const dataURL = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = '房间布局.png';
    link.href = dataURL;
    link.click();
    document.getElementById('modal-export')!.style.display = 'none';
  });

  // 上下文菜单
  const ctxMenu = document.getElementById('context-menu')!;
  let _ctxTargetIdx = -1;

  document.addEventListener('click', () => { ctxMenu.style.display = 'none'; });
  ctxMenu.addEventListener('click', function(e: Event) {
    const target = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement;
    if (!target) return;
    const action = target.dataset.action;
    ctxMenu.style.display = 'none';
    if (_ctxTargetIdx < 0 || _ctxTargetIdx >= state.furnitureItems.length) return;

    switch (action) {
      case 'rotate': {
        pushUndo();
        const it = state.furnitureItems[_ctxTargetIdx];
        if (!it) break;
        it.rotation = (it.rotation + 90) % 360;
        rebuildFurnitureVisuals();
        triggerSave();
        break;
      }
      case 'delete':
        pushUndo();
        state.furnitureItems.splice(_ctxTargetIdx, 1);
        rebuildFurnitureVisuals();
        triggerSave();
        break;
    }
  });

  // 家具右键菜单 — listen on stage contextmenu
  stage.on('contextmenu', function(e: Konva.KonvaEventObject<PointerEvent>) {
    e.evt.preventDefault();
    const target = e.target;
    const parentGroup = target.findAncestor('Group', true);
    if (!parentGroup) return;
    const name = parentGroup.name();
    if (!name || !name.startsWith('furniture-')) return;

    // Find furniture index
    const type = name.replace('furniture-', '');
    for (let i = 0; i < state.furnitureItems.length; i++) {
      const fi = state.furnitureItems[i];
      if (fi && fi.type === type) {
        _ctxTargetIdx = i;
        break;
      }
    }
    if (_ctxTargetIdx < 0) return;

    const pos = stage.getPointerPosition();
    if (pos) {
      ctxMenu.style.display = 'block';
      ctxMenu.style.left = pos.x + 10 + 'px';
      ctxMenu.style.top = pos.y + 10 + 'px';
    }
  });

  function rebuildFurnitureVisuals(): void {
    furnitureLayer.destroyChildren();
    for (const item of state.furnitureItems) {
      renderPlaceFurniture(furnitureLayer, item.type, item.x, item.y, item.rotation, stage, removeFurniture);
    }
    furnitureLayer.batchDraw();
  }

  // 尝试加载 localStorage
  const saved = loadFromStorage();
  if (saved) {
    state.wallPoints = saved.wallPoints;
    state.isClosed = saved.isClosed;
    state.doors = saved.doors || [];
    state.windows = saved.windows || [];
    state.furnitureItems = saved.furnitureItems || [];
    state.mode = saved.mode;
    state.showGrid = saved.showGrid;
    state.nextWallId = saved.nextWallId;
    state.nextDoorId = saved.nextDoorId;
    state.nextWindowId = saved.nextWindowId;
    state.activeTab = saved.activeTab || 'room';
    state.hasEverHadRoom = saved.hasEverHadRoom || false;
    state.furnitureQuantities = saved.furnitureQuantities || { bed: 0, desk: 0, wardrobe: 0, chair: 0, sofa: 0 };

    if (state.isClosed && state.wallPoints.length >= 3) {
      const overlay = document.getElementById('template-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    rebuildWallSegmentsFull();
    for (const item of state.furnitureItems) {
      renderPlaceFurniture(furnitureLayer, item.type, item.x, item.y, item.rotation, stage, removeFurniture);
    }
    furnitureLayer.batchDraw();
    drawGrid(gridLayer, state.showGrid);

    setActiveTab(state.activeTab);
    setStatusForTab(state.activeTab);
  } else {
    setActiveTab('room');
    // 首次打开 — 显示模板浮层
    const overlay = document.getElementById('template-overlay');
    if (overlay) overlay.style.display = 'flex';
    setStatusForTab('room');
  }

  // 门/窗 dblclick 事件
  document.addEventListener('element-dblclick', function(e: Event) {
    const detail = (e as CustomEvent).detail;
    if (detail.type === 'door') selectDoor(detail.id);
    else if (detail.type === 'window') selectWindow(detail.id);
  });

  // 门方向改变
  document.addEventListener('door-changed', function() {
    const id = state.selectedElementId;
    if (id === null || state.selectedElementType !== 'door') return;
    rebuildDoorsAndWindowsFull();
    selectDoor(id);
    triggerSave();
  });

  log('v5.1 房间改造工具已加载');
}

init();
