// ============================================================
//  🏠 房间改造工具 — 家具渲染
// ============================================================

import Konva from 'konva';
import type { FurnitureItem, EditorMode } from '../engine/types';
import { FURNITURE_DEFS } from '../engine/constants';
import { snapToGrid } from '../engine/geometry';

/** 渲染所有家具 */
export function renderFurniture(
  layer: Konva.Layer,
  items: FurnitureItem[],
  mode: EditorMode,
  stage: Konva.Stage,
  onRemove: (group: Konva.Group) => void
): void {
  for (const item of items) {
    createFurnitureGroup(layer, item, mode, stage, onRemove);
  }
  layer.batchDraw();
}

/** 创建单个家具 Group */
function createFurnitureGroup(
  layer: Konva.Layer,
  item: FurnitureItem,
  mode: EditorMode,
  stage: Konva.Stage,
  onRemove: (group: Konva.Group) => void
): Konva.Group {
  const def = FURNITURE_DEFS[item.type];
  if (!def) {
    throw new Error(`Unknown furniture type: ${item.type}`);
  }

  const group = new Konva.Group({
    x: item.x,
    y: item.y,
    rotation: item.rotation || 0,
    draggable: mode === 'place',
    name: 'furniture-' + item.type,
  });

  // 主体矩形
  const rect = new Konva.Rect({
    width: def.w,
    height: def.h,
    fill: def.color,
    stroke: '#8B7355',
    strokeWidth: 1.5,
    cornerRadius: 4,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowBlur: 6,
    shadowOffsetY: 2,
  });
  group.add(rect);

  // 文字标签
  const label = new Konva.Text({
    text: def.label,
    fontSize: 14,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fill: '#5D4E37',
    align: 'center',
    verticalAlign: 'middle',
    width: def.w,
    height: def.h,
    listening: false,
  });
  group.add(label);

  // 旋转手柄
  const rotHandle = new Konva.Circle({
    x: def.w / 2,
    y: -12,
    radius: 5,
    fill: '#3498db',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'rot-handle',
    draggable: true,
  });
  group.add(rotHandle);

  // 删除按钮
  const delBtn = new Konva.Circle({
    x: def.w / 2,
    y: def.h + 12,
    radius: 7,
    fill: '#e74c3c',
    stroke: '#fff',
    strokeWidth: 2,
    name: 'del-handle',
  });
  group.add(delBtn);

  const delX = new Konva.Text({
    x: def.w / 2 - 4,
    y: def.h + 8,
    text: '✕',
    fontSize: 10,
    fill: '#fff',
    name: 'del-handle',
    listening: false,
  });
  group.add(delX);

  // 拖拽吸附网格
  group.on('dragmove', function() {
    const pos = group.position();
    group.position({
      x: snapToGrid(pos.x),
      y: snapToGrid(pos.y),
    });
  });

  // 旋转手柄拖拽
  rotHandle.on('dragmove', function() {
    const parent = this.getParent() as Konva.Group;
    const cx = parent.x();
    const cy = parent.y();
    const mx = stage.getPointerPosition()?.x ?? 0;
    const my = stage.getPointerPosition()?.y ?? 0;
    const angle = Math.atan2(my - cy, mx - cx);
    const deg = Konva.Util.radToDeg(angle);
    const snapped = Math.round(deg / 45) * 45;
    parent.rotation(snapped);
    layer.batchDraw();
  });

  // 删除按钮点击
  delBtn.on('click', function() {
    const parent = this.getParent() as Konva.Group;
    onRemove(parent);
  });
  delBtn.on('tap', function() {
    const parent = this.getParent() as Konva.Group;
    onRemove(parent);
  });

  // 右键删除
  group.on('contextmenu', function(e: Konva.KonvaEventObject<PointerEvent>) {
    e.evt.preventDefault();
    onRemove(this);
  });

  // 点击选中效果
  group.on('click', function() {
    (layer.find('Group') as Konva.Group[]).forEach(g => {
      const r = g.findOne('Rect') as Konva.Rect | undefined;
      if (r) r.stroke('#8B7355');
    });
    const r = this.findOne('Rect') as Konva.Rect | undefined;
    if (r) r.stroke('#3498db');
    layer.batchDraw();
  });

  layer.add(group);
  return group;
}

/** 在画布上放置家具 */
export function placeFurniture(
  layer: Konva.Layer,
  type: string,
  x: number,
  y: number,
  rotation: number,
  stage: Konva.Stage,
  onRemove: (group: Konva.Group) => void
): Konva.Group | null {
  const def = FURNITURE_DEFS[type];
  if (!def) return null;

  const item: FurnitureItem = { type, x: snapToGrid(x), y: snapToGrid(y), rotation: rotation || 0 };
  const group = createFurnitureGroup(layer, item, 'place', stage, onRemove);
  layer.batchDraw();
  return group;
}
