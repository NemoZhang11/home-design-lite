// ============================================================
//  🏠 房间改造工具 — 预览幽灵渲染
// ============================================================

import Konva from 'konva';
import { WALL_THICKNESS, DOOR_DEFAULT_WIDTH, WINDOW_DEFAULT_WIDTH, FURNITURE_DEFS } from '../engine/constants';

export type GhostType = 'door' | 'window' | 'furniture';

/** 显示门/窗/家具预览幽灵 */
export function showPreviewGhost(
  type: GhostType,
  x: number,
  y: number,
  angle: number,
  layer: Konva.Layer,
  furnitureType?: string,
): void {
  hidePreviewGhost(layer);

  const ghostGroup = new Konva.Group({
    x,
    y,
    rotation: Konva.Util.radToDeg(angle),
    name: 'preview-ghost',
  });

  if (type === 'furniture' && furnitureType) {
    const def = FURNITURE_DEFS[furnitureType];
    if (!def) return;
    const ghost = new Konva.Rect({
      x: -def.w / 2,
      y: -def.h / 2,
      width: def.w,
      height: def.h,
      fill: 'rgba(52,152,219,0.25)',
      stroke: 'rgba(52,152,219,0.6)',
      strokeWidth: 2,
      cornerRadius: 2,
      dash: [6, 3],
      name: 'preview-ghost',
      listening: false,
    });
    ghostGroup.add(ghost);
    // 尺寸标签
    const label = new Konva.Text({
      x: 0,
      y: -def.h / 2 - 16,
      text: `${def.w}×${def.h}`,
      fontSize: 10,
      fill: '#3498db',
      align: 'center',
      width: def.w,
      offsetX: def.w / 2,
      name: 'preview-ghost',
      listening: false,
    });
    ghostGroup.add(label);
  } else {
    const width = type === 'door' ? DOOR_DEFAULT_WIDTH : WINDOW_DEFAULT_WIDTH;
    const halfW = width / 2;
    const ghost = new Konva.Rect({
      x: -halfW,
      y: type === 'window' ? -WALL_THICKNESS / 2 - 2 : -WALL_THICKNESS / 2,
      width,
      height: WALL_THICKNESS + (type === 'window' ? 4 : 0),
      fill: type === 'door' ? 'rgba(52,152,219,0.35)' : 'rgba(214,234,248,0.5)',
      stroke: type === 'door' ? 'rgba(52,152,219,0.7)' : 'rgba(127,140,141,0.6)',
      strokeWidth: 1.5,
      cornerRadius: 2,
      name: 'preview-ghost',
      listening: false,
    });
    ghostGroup.add(ghost);
  }

  layer.add(ghostGroup);
  layer.batchDraw();
}

/** 清除预览幽灵 */
export function hidePreviewGhost(layer: Konva.Layer): void {
  layer.find('.preview-ghost').forEach(g => g.destroy());
  layer.batchDraw();
}
