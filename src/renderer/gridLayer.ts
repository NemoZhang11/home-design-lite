// ============================================================
//  🏠 房间改造工具 — 网格渲染
// ============================================================

import Konva from 'konva';
import { GRID_SIZE, MAJOR_GRID_INTERVAL, CANVAS_WIDTH, CANVAS_HEIGHT } from '../engine/constants';

export function drawGrid(layer: Konva.Layer, showGrid: boolean): void {
  layer.destroyChildren();
  if (!showGrid) {
    layer.batchDraw();
    return;
  }

  // 竖线
  for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
    const isMajor = (x / GRID_SIZE) % MAJOR_GRID_INTERVAL === 0;
    layer.add(new Konva.Line({
      points: [x, 0, x, CANVAS_HEIGHT],
      stroke: isMajor ? '#d0c9c2' : '#e0dbd4',
      strokeWidth: isMajor ? 1.0 : 0.5,
    }));
  }
  // 横线
  for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
    const isMajor = (y / GRID_SIZE) % MAJOR_GRID_INTERVAL === 0;
    layer.add(new Konva.Line({
      points: [0, y, CANVAS_WIDTH, y],
      stroke: isMajor ? '#d0c9c2' : '#e0dbd4',
      strokeWidth: isMajor ? 1.0 : 0.5,
    }));
  }
  layer.batchDraw();
}
