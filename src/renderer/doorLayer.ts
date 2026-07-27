// ============================================================
//  🏠 房间改造工具 — 门/窗渲染
// ============================================================

import Konva from 'konva';
import type { Door, Window, WallSegment } from '../engine/types';
import { WALL_THICKNESS, HANDLE_RADIUS, MIN_DOOR_WIDTH, MAX_DOOR_WIDTH, MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH, DOOR_FILL, DOOR_ARC_FILL, DOOR_BODY_HEIGHT, WINDOW_FRAME_FILL, WINDOW_FRAME_HEIGHT } from '../engine/constants';
import { getWallPos, pointToSegmentDist } from '../engine/geometry';

/** 渲染门 */
export function renderDoor(
  door: Door,
  seg: WallSegment,
  layer: Konva.Layer,
  onSelect: (id: number) => void,
  onDragMove: (id: number, x: number, y: number) => void,
  onDragEnd: () => void
): Konva.Group {
  const pos = getWallPos(door.wallIdx, door.t, [seg]);
  if (!pos) {
    throw new Error(`Cannot render door: invalid position for wallIdx ${door.wallIdx}`);
  }

  const angle = seg.angle;
  const halfW = door.width / 2;

  const group = new Konva.Group({
    x: pos.x,
    y: pos.y,
    rotation: Konva.Util.radToDeg(angle),
    draggable: true,
    name: 'door-' + door.id,
  });

  // 门体 — 使用 DOOR_FILL 颜色，高度大于墙厚以突出显示
  const doorRect = new Konva.Rect({
    x: -halfW,
    y: -DOOR_BODY_HEIGHT / 2,
    width: door.width,
    height: DOOR_BODY_HEIGHT,
    fill: DOOR_FILL,
    stroke: '#C0392B',
    strokeWidth: 2,
    cornerRadius: 3,
    name: 'door-body',
  });
  group.add(doorRect);

  // 门文字标签
  const label = new Konva.Text({
    x: -halfW,
    y: -6,
    width: door.width,
    height: 12,
    text: '门',
    fontSize: 10,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fill: '#FFFFFF',
    align: 'center',
    verticalAlign: 'middle',
    listening: false,
    fontStyle: 'bold',
  });
  group.add(label);

  // 铰链点 — 位置取决于 hingeSide
  const hingeX = door.hingeSide === 'left' ? -halfW : halfW;
  const hinge = new Konva.Circle({
    x: hingeX,
    y: 0,
    radius: 4,
    fill: '#FFFFFF',
    stroke: '#C0392B',
    strokeWidth: 2,
    name: 'door-hinge',
  });
  group.add(hinge);

  // 门弧 — 使用 DOOR_ARC_FILL，位置取决于 hingeSide
  const arc = new Konva.Arc({
    x: hingeX,
    y: 0,
    innerRadius: 0,
    outerRadius: door.width,
    angle: 90,
    fill: DOOR_ARC_FILL,
    stroke: '#E74C3C',
    strokeWidth: 2,
    dash: [5, 3],
    name: 'door-arc',
  });
  group.add(arc);

  // 设置弧方向 (hingeSide + swingInward)
  updateDoorArc(group, door.swingInward, door.hingeSide);

  // 事件
  group.on('click', () => onSelect(door.id));
  group.on('dblclick', function() {
    const event = new CustomEvent('element-dblclick', { detail: { type: 'door', id: door.id } });
    document.dispatchEvent(event);
  });
  group.on('dragstart', () => onSelect(door.id));
  group.on('dragmove', function() {
    onDragMove(door.id, this.x(), this.y());
  });
  group.on('dragend', onDragEnd);

  layer.add(group);
  return group;
}

/** 更新门弧方向 */
export function updateDoorArc(group: Konva.Group, swingInward: boolean, hingeSide: 'left' | 'right' = 'left'): void {
  const arc = group.findOne('.door-arc') as Konva.Arc | undefined;
  if (!arc) return;
  // 基础旋转: hingeSide 决定弧的朝向
  let baseRotation = hingeSide === 'right' ? 180 : 0;
  // swingInward: true=向内(0), false=向外(180)
  let swingRotation = swingInward ? 0 : 180;
  arc.rotation(baseRotation + swingRotation);
}

/** 渲染窗户 */
export function renderWindow(
  win: Window,
  seg: WallSegment,
  layer: Konva.Layer,
  onSelect: (id: number) => void,
  onDragMove: (id: number, x: number, y: number) => void,
  onDragEnd: () => void
): Konva.Group {
  const pos = getWallPos(win.wallIdx, win.t, [seg]);
  if (!pos) {
    throw new Error(`Cannot render window: invalid position for wallIdx ${win.wallIdx}`);
  }

  const angle = seg.angle;
  const halfW = win.width / 2;

  const group = new Konva.Group({
    x: pos.x,
    y: pos.y,
    rotation: Konva.Util.radToDeg(angle),
    draggable: true,
    name: 'window-' + win.id,
  });

  // 窗体外框 — 使用 WINDOW_FRAME_FILL，高度 WINDOW_FRAME_HEIGHT 以突出显示
  const frame = new Konva.Rect({
    x: -halfW,
    y: -WINDOW_FRAME_HEIGHT / 2,
    width: win.width,
    height: WINDOW_FRAME_HEIGHT,
    fill: WINDOW_FRAME_FILL,
    stroke: '#2980B9',
    strokeWidth: 2,
    cornerRadius: 2,
    name: 'window-frame',
  });
  group.add(frame);

  // 3条竖线 (玻璃分隔) — 更粗更亮
  for (let i = 1; i <= 3; i++) {
    const lineX = -halfW + (win.width / 4) * i;
    const line = new Konva.Line({
      points: [lineX, -WINDOW_FRAME_HEIGHT / 2 + 2, lineX, WINDOW_FRAME_HEIGHT / 2 - 2],
      stroke: '#2980B9',
      strokeWidth: 1.2,
      name: 'window-line',
    });
    group.add(line);
  }

  // 事件
  group.on('click', () => onSelect(win.id));
  group.on('dblclick', function() {
    const event = new CustomEvent('element-dblclick', { detail: { type: 'window', id: win.id } });
    document.dispatchEvent(event);
  });
  group.on('dragstart', () => onSelect(win.id));
  group.on('dragmove', function() {
    onDragMove(win.id, this.x(), this.y());
  });
  group.on('dragend', onDragEnd);

  layer.add(group);
  return group;
}

/** 渲染门选中手柄 */
export function renderDoorSelectionHandles(
  door: Door,
  segs: WallSegment[],
  overlayLayer: Konva.Layer,
  onResize: (newWidth: number) => void
): void {
  overlayLayer.destroyChildren();
  const seg = segs[door.wallIdx];
  if (!seg) return;

  const angle = seg.angle;
  const halfW = door.width / 2;
  const pos = getWallPos(door.wallIdx, door.t, segs);
  if (!pos) return;

  // 左侧手柄
  const lx = pos.x - halfW * Math.cos(angle);
  const ly = pos.y - halfW * Math.sin(angle);
  const lh = new Konva.Circle({
    x: lx, y: ly,
    radius: HANDLE_RADIUS + 1,
    fill: '#3498db',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'door-resize',
    draggable: true,
  });
  overlayLayer.add(lh);

  // 右侧手柄
  const rx = pos.x + halfW * Math.cos(angle);
  const ry = pos.y + halfW * Math.sin(angle);
  const rh = new Konva.Circle({
    x: rx, y: ry,
    radius: HANDLE_RADIUS + 1,
    fill: '#3498db',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'door-resize',
    draggable: true,
  });
  overlayLayer.add(rh);

  // 宽度标签 (位置调整到门上方，因为门现在更高了)
  const wM = door.width.toFixed(0);
  const wLabel = new Konva.Text({
    x: pos.x - 30,
    y: pos.y - 30,
    text: wM + 'cm',
    fontSize: 12,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fill: '#3498db',
    align: 'center',
    width: 60,
    listening: false,
  });
  overlayLayer.add(wLabel);

  // 拖拽事件
  lh.on('dragmove', function() {
    const p = this.position();
    const segRef = segs[door.wallIdx];
    if (!segRef) return;
    const result = pointToSegmentDist(p.x, p.y, segRef.p1.x, segRef.p1.y, segRef.p2.x, segRef.p2.y);
    const newHalf = Math.abs(result.t - door.t) * segRef.length;
    let newWidth = Math.max(MIN_DOOR_WIDTH, Math.min(MAX_DOOR_WIDTH, newHalf * 2));
    onResize(newWidth);
  });

  rh.on('dragmove', function() {
    const p = this.position();
    const segRef = segs[door.wallIdx];
    if (!segRef) return;
    const result = pointToSegmentDist(p.x, p.y, segRef.p1.x, segRef.p1.y, segRef.p2.x, segRef.p2.y);
    const newHalf = Math.abs(result.t - door.t) * segRef.length;
    let newWidth = Math.max(MIN_DOOR_WIDTH, Math.min(MAX_DOOR_WIDTH, newHalf * 2));
    onResize(newWidth);
  });

  overlayLayer.batchDraw();
}

/** 渲染窗户选中手柄 */
export function renderWindowSelectionHandles(
  win: Window,
  segs: WallSegment[],
  overlayLayer: Konva.Layer,
  onResize: (newWidth: number) => void
): void {
  overlayLayer.destroyChildren();
  const seg = segs[win.wallIdx];
  if (!seg) return;

  const angle = seg.angle;
  const halfW = win.width / 2;
  const pos = getWallPos(win.wallIdx, win.t, segs);
  if (!pos) return;

  const lx = pos.x - halfW * Math.cos(angle);
  const ly = pos.y - halfW * Math.sin(angle);
  const lh = new Konva.Circle({
    x: lx, y: ly,
    radius: HANDLE_RADIUS + 1,
    fill: '#3498db',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'win-resize',
    draggable: true,
  });
  overlayLayer.add(lh);

  const rx = pos.x + halfW * Math.cos(angle);
  const ry = pos.y + halfW * Math.sin(angle);
  const rh = new Konva.Circle({
    x: rx, y: ry,
    radius: HANDLE_RADIUS + 1,
    fill: '#3498db',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'win-resize',
    draggable: true,
  });
  overlayLayer.add(rh);

  const wM = win.width.toFixed(0);
  const wLabel = new Konva.Text({
    x: pos.x - 30,
    y: pos.y - 25,
    text: wM + 'cm',
    fontSize: 12,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fill: '#3498db',
    align: 'center',
    width: 60,
    listening: false,
  });
  overlayLayer.add(wLabel);

  lh.on('dragmove', function() {
    const p = this.position();
    const segRef = segs[win.wallIdx];
    if (!segRef) return;
    const result = pointToSegmentDist(p.x, p.y, segRef.p1.x, segRef.p1.y, segRef.p2.x, segRef.p2.y);
    const newHalf = Math.abs(result.t - win.t) * segRef.length;
    let newWidth = Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_WIDTH, newHalf * 2));
    onResize(newWidth);
  });

  rh.on('dragmove', function() {
    const p = this.position();
    const segRef = segs[win.wallIdx];
    if (!segRef) return;
    const result = pointToSegmentDist(p.x, p.y, segRef.p1.x, segRef.p1.y, segRef.p2.x, segRef.p2.y);
    const newHalf = Math.abs(result.t - win.t) * segRef.length;
    let newWidth = Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_WIDTH, newHalf * 2));
    onResize(newWidth);
  });

  overlayLayer.batchDraw();
}
