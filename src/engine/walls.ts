// ============================================================
//  🏠 房间改造工具 — 墙构造逻辑 (纯数据)
// ============================================================

import type { Point, WallSegment } from './types';
import { dist, angleBetween, snapToGrid } from './geometry';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

/** 从 wallPoints 重建所有墙段 (纯数据，不涉及 Konva) */
export function rebuildWallSegments(
  points: Point[],
  isClosed: boolean,
  nextId: number
): WallSegment[] {
  const segments: WallSegment[] = [];
  if (points.length < 2) return segments;

  const endIdx = isClosed ? points.length : points.length;
  let id = nextId;

  for (let i = 0; i < endIdx; i++) {
    const p1 = points[i];
    if (!p1) continue;
    const nextIdx = (i + 1) === points.length ? 0 : i + 1;
    const p2 = points[nextIdx];
    if (!p2) continue;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    segments.push({
      id: id++,
      p1: { x: p1.x, y: p1.y },
      p2: { x: p2.x, y: p2.y },
      angle,
      length,
      wallIdx: i,
    });
  }

  return segments;
}

/** 创建矩形房间点集 (居中于画布) */
export function createRoomFromDimensions(
  w: number,
  h: number,
  canvasW: number = CANVAS_WIDTH,
  canvasH: number = CANVAS_HEIGHT
): Point[] {
  const startX = Math.round((canvasW - w) / 2 / 10) * 10;
  const startY = Math.round((canvasH - h) / 2 / 10) * 10;

  return [
    { x: startX, y: startY },
    { x: startX + w, y: startY },
    { x: startX + w, y: startY + h },
    { x: startX, y: startY + h },
    { x: startX, y: startY },
  ];
}
