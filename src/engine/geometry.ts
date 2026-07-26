// ============================================================
//  🏠 房间改造工具 — 纯几何/数学函数
// ============================================================

import type { Point, WallSegment, PointToSegmentResult, NearestWallResult } from './types';
import { GRID_SIZE } from './constants';

/** 吸附到网格 */
export function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

/** 两点距离 */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 两点间角度 (弧度) */
export function angleBetween(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/** 深拷贝墙点 */
export function clonePoints(pts: Point[]): Point[] {
  return pts.map(p => ({ x: p.x, y: p.y }));
}

/** 点到线段的最近距离和投影参数 t */
export function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): PointToSegmentResult {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { dist: Math.hypot(px - ax, py - ay), t: 0, projX: ax, projY: ay };
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return { dist: Math.hypot(px - projX, py - projY), t, projX, projY };
}

/** 根据墙索引和参数 t 获取绝对位置 */
export function getWallPos(wallIdx: number, t: number, segments: WallSegment[]): Point | null {
  const seg = segments[wallIdx];
  if (!seg) return null;
  return {
    x: seg.p1.x + t * (seg.p2.x - seg.p1.x),
    y: seg.p1.y + t * (seg.p2.y - seg.p1.y),
  };
}

/** 查找最近的墙段 */
export function findNearestWall(
  px: number, py: number, segments: WallSegment[]
): NearestWallResult | null {
  let best: NearestWallResult | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const result = pointToSegmentDist(px, py, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
    if (result.dist < bestDist) {
      bestDist = result.dist;
      best = { idx: i, ...result };
    }
  }
  return best;
}

/** 从墙段更新 wallPoints */
export function updateWallPointsFromSegments(
  segs: WallSegment[], isClosed: boolean
): Point[] {
  if (segs.length === 0) return [];
  const pts: Point[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg) {
      pts.push({ x: seg.p1.x, y: seg.p1.y });
    }
  }
  if (isClosed && segs.length > 0) {
    const first = segs[0];
    if (first) {
      pts.push({ x: first.p1.x, y: first.p1.y });
    }
  } else if (segs.length > 0) {
    const last = segs[segs.length - 1];
    if (last) {
      pts.push({ x: last.p2.x, y: last.p2.y });
    }
  }
  return pts;
}

/** 同步连接的墙段 (当一段移动时，更新相邻段的端点) */
export function syncConnectedSegments(movedSeg: WallSegment, segs: WallSegment[]): void {
  for (const seg of segs) {
    if (seg.id === movedSeg.id) continue;
    // 检查 seg 的 p1 是否接近 movedSeg 的 p1
    if (dist(seg.p1, movedSeg.p1) < 1) {
      seg.p1.x = movedSeg.p1.x;
      seg.p1.y = movedSeg.p1.y;
      seg.angle = angleBetween(seg.p1, seg.p2);
      seg.length = dist(seg.p1, seg.p2);
    }
    // 检查 seg 的 p1 是否接近 movedSeg 的 p2
    if (dist(seg.p1, movedSeg.p2) < 1) {
      seg.p1.x = movedSeg.p2.x;
      seg.p1.y = movedSeg.p2.y;
      seg.angle = angleBetween(seg.p1, seg.p2);
      seg.length = dist(seg.p1, seg.p2);
    }
    // 检查 seg 的 p2 是否接近 movedSeg 的 p1
    if (dist(seg.p2, movedSeg.p1) < 1) {
      seg.p2.x = movedSeg.p1.x;
      seg.p2.y = movedSeg.p1.y;
      seg.angle = angleBetween(seg.p1, seg.p2);
      seg.length = dist(seg.p1, seg.p2);
    }
    // 检查 seg 的 p2 是否接近 movedSeg 的 p2
    if (dist(seg.p2, movedSeg.p2) < 1) {
      seg.p2.x = movedSeg.p2.x;
      seg.p2.y = movedSeg.p2.y;
      seg.angle = angleBetween(seg.p1, seg.p2);
      seg.length = dist(seg.p1, seg.p2);
    }
  }
}

/** 吸附墙段端点到网格 */
export function snapSegmentEndpoints(seg: WallSegment): void {
  seg.p1.x = snapToGrid(seg.p1.x);
  seg.p1.y = snapToGrid(seg.p1.y);
  seg.p2.x = snapToGrid(seg.p2.x);
  seg.p2.y = snapToGrid(seg.p2.y);
  seg.angle = angleBetween(seg.p1, seg.p2);
  seg.length = dist(seg.p1, seg.p2);
}

/** 按新长度调整墙段 (中点固定) */
export function resizeWallSegment(seg: WallSegment, newLen: number): void {
  const cx = (seg.p1.x + seg.p2.x) / 2;
  const cy = (seg.p1.y + seg.p2.y) / 2;
  const angle = seg.angle;
  const half = newLen / 2;
  seg.p1.x = cx - half * Math.cos(angle);
  seg.p1.y = cy - half * Math.sin(angle);
  seg.p2.x = cx + half * Math.cos(angle);
  seg.p2.y = cy + half * Math.sin(angle);
  seg.length = newLen;
}
