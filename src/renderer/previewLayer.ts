// ============================================================
//  🏠 房间改造工具 — 预览幽灵渲染
// ============================================================

import Konva from 'konva';
import { WALL_THICKNESS, DOOR_DEFAULT_WIDTH, WINDOW_DEFAULT_WIDTH } from '../engine/constants';

/** 显示门/窗预览幽灵 */
export function showPreviewGhost(
  type: 'door' | 'window',
  projX: number,
  projY: number,
  wallAngle: number,
  layer: Konva.Layer
): void {
  // 清除旧预览
  hidePreviewGhost(layer);

  const width = type === 'door' ? DOOR_DEFAULT_WIDTH : WINDOW_DEFAULT_WIDTH;
  const halfW = width / 2;

  const ghostGroup = new Konva.Group({
    x: projX,
    y: projY,
    rotation: Konva.Util.radToDeg(wallAngle),
    name: 'preview-ghost',
  });

  const ghost = new Konva.Rect({
    x: -halfW,
    y: type === 'window' ? -WALL_THICKNESS / 2 - 2 : -WALL_THICKNESS / 2,
    width: width,
    height: WALL_THICKNESS + (type === 'window' ? 4 : 0),
    fill: type === 'door' ? 'rgba(52,152,219,0.35)' : 'rgba(214,234,248,0.5)',
    stroke: type === 'door' ? 'rgba(52,152,219,0.7)' : 'rgba(127,140,141,0.6)',
    strokeWidth: 1.5,
    cornerRadius: 2,
    name: 'preview-ghost',
    listening: false,
  });
  ghostGroup.add(ghost);
  layer.add(ghostGroup);
  layer.batchDraw();
}

/** 清除预览幽灵 */
export function hidePreviewGhost(layer: Konva.Layer): void {
  layer.find('.preview-ghost').forEach(g => g.destroy());
  layer.batchDraw();
}
