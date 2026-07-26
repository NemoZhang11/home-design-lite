// ============================================================
//  🏠 geometry.ts 单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  dist,
  angleBetween,
  clonePoints,
  pointToSegmentDist,
  getWallPos,
  findNearestWall,
  updateWallPointsFromSegments,
  syncConnectedSegments,
  snapSegmentEndpoints,
  resizeWallSegment,
} from './geometry';
import type { WallSegment } from './types';
import { GRID_SIZE } from './constants';

// ---- helpers ----
function makeSeg(
  id: number,
  x1: number, y1: number,
  x2: number, y2: number,
  extra: Partial<WallSegment> = {}
): WallSegment {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    id,
    p1: { x: x1, y: y1 },
    p2: { x: x2, y: y2 },
    angle: Math.atan2(dy, dx),
    length: Math.hypot(dx, dy),
    wallIdx: extra.wallIdx ?? 0,
    ...extra,
  };
}

// ============================================================
describe('snapToGrid', () => {
  it('snaps to nearest grid multiple', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(5)).toBe(10);          // rounds to nearest
    expect(snapToGrid(14)).toBe(10);
    expect(snapToGrid(15)).toBe(20);         // exactly halfway → 20
    expect(snapToGrid(20)).toBe(20);
    expect(snapToGrid(104)).toBe(100);
  });

  it('handles negative values', () => {
    // Math.round(-0.5) === -0 in IEEE 754, value is 0
    expect(snapToGrid(-5)).toBeCloseTo(0);
    expect(snapToGrid(-14)).toBe(-10);
  });
});

// ============================================================
describe('dist', () => {
  it('calculates euclidean distance', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(dist({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(dist({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe(100);
  });

  it('handles negative coordinates', () => {
    expect(dist({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5);
  });
});

// ============================================================
describe('angleBetween', () => {
  it('returns radians for horizontal/vertical lines', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(0);
    expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 100 })).toBeCloseTo(Math.PI / 2);
    expect(angleBetween({ x: 0, y: 0 }, { x: -100, y: 0 })).toBeCloseTo(Math.PI);
  });

  it('returns correct angle for diagonal', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(Math.PI / 4);
  });
});

// ============================================================
describe('clonePoints', () => {
  it('deep copies point array', () => {
    const original = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    const cloned = clonePoints(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
  });

  it('returns empty for empty input', () => {
    expect(clonePoints([])).toEqual([]);
  });
});

// ============================================================
describe('pointToSegmentDist', () => {
  const seg = { ax: 0, ay: 0, bx: 100, by: 0 };

  it('point directly on segment', () => {
    const r = pointToSegmentDist(50, 0, seg.ax, seg.ay, seg.bx, seg.by);
    expect(r.dist).toBeCloseTo(0);
    expect(r.t).toBeCloseTo(0.5);
    expect(r.projX).toBeCloseTo(50);
    expect(r.projY).toBeCloseTo(0);
  });

  it('point perpendicular above segment', () => {
    const r = pointToSegmentDist(50, 30, seg.ax, seg.ay, seg.bx, seg.by);
    expect(r.dist).toBeCloseTo(30);
    expect(r.t).toBeCloseTo(0.5);
  });

  it('point beyond start (clamped to t=0)', () => {
    const r = pointToSegmentDist(-10, 0, seg.ax, seg.ay, seg.bx, seg.by);
    expect(r.t).toBe(0);
    expect(r.projX).toBeCloseTo(0);
  });

  it('point beyond end (clamped to t=1)', () => {
    const r = pointToSegmentDist(120, 0, seg.ax, seg.ay, seg.bx, seg.by);
    expect(r.t).toBe(1);
    expect(r.projX).toBeCloseTo(100);
  });

  it('zero-length segment returns distance to point', () => {
    const r = pointToSegmentDist(30, 40, 10, 10, 10, 10);
    expect(r.dist).toBeCloseTo(Math.hypot(20, 30));
    expect(r.t).toBe(0);
  });
});

// ============================================================
describe('getWallPos', () => {
  it('returns position at parameter t along wall', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)];
    const pos = getWallPos(0, 0.5, segs);
    expect(pos!.x).toBeCloseTo(50);
    expect(pos!.y).toBeCloseTo(0);
  });

  it('returns null for out-of-bounds wallIdx', () => {
    expect(getWallPos(99, 0.5, [])).toBeNull();
  });

  it('t=0 returns start point', () => {
    const segs = [makeSeg(0, 10, 20, 100, 200)];
    const pos = getWallPos(0, 0, segs);
    expect(pos!.x).toBe(10);
    expect(pos!.y).toBe(20);
  });

  it('t=1 returns end point', () => {
    const segs = [makeSeg(0, 10, 20, 100, 200)];
    const pos = getWallPos(0, 1, segs);
    expect(pos!.x).toBe(100);
    expect(pos!.y).toBe(200);
  });
});

// ============================================================
describe('findNearestWall', () => {
  it('finds nearest wall to a point', () => {
    const segs: WallSegment[] = [
      makeSeg(0, 0, 0, 100, 0),     // horizontal top
      makeSeg(1, 100, 0, 100, 100), // vertical right
      makeSeg(2, 100, 100, 0, 100), // horizontal bottom
    ];
    const r = findNearestWall(50, 5, segs);
    expect(r).not.toBeNull();
    expect(r!.idx).toBe(0);        // closest to top wall
    expect(r!.dist).toBeCloseTo(5);
  });

  it('returns null for empty segments', () => {
    expect(findNearestWall(0, 0, [])).toBeNull();
  });

  it('handles segments with gaps (sparse array)', () => {
    // sparse array: idx 0 valid, idx 1 undefined, idx 2 valid
    const segs: WallSegment[] = [];
    segs[0] = makeSeg(0, 0, 0, 100, 0);
    // skip idx 1
    segs[2] = makeSeg(2, 100, 100, 0, 100);
    const r = findNearestWall(50, 5, segs);
    expect(r).not.toBeNull();
    expect(r!.idx).toBe(0);
  });
});

// ============================================================
describe('updateWallPointsFromSegments', () => {
  it('closed polygon: duplicates first p1 at end', () => {
    const segs = [
      makeSeg(0, 0, 0, 100, 0),
      makeSeg(1, 100, 0, 100, 100),
      makeSeg(2, 100, 100, 0, 100),
      makeSeg(3, 0, 100, 0, 0),
    ];
    const pts = updateWallPointsFromSegments(segs, true);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[4]).toEqual({ x: 0, y: 0 }); // duplicated p1 of first
  });

  it('open polyline: appends last p2', () => {
    const segs = [
      makeSeg(0, 0, 0, 100, 0),
      makeSeg(1, 100, 0, 200, 0),
    ];
    const pts = updateWallPointsFromSegments(segs, false);
    expect(pts).toHaveLength(3);
    expect(pts[2]).toEqual({ x: 200, y: 0 }); // last segment's p2
  });

  it('empty segments returns empty', () => {
    expect(updateWallPointsFromSegments([], false)).toEqual([]);
  });
});

// ============================================================
describe('syncConnectedSegments', () => {
  it('updates adjacent segment when endpoint moves', () => {
    const seg1 = makeSeg(0, 0, 0, 100, 0);
    const seg2 = makeSeg(1, 100, 0, 200, 100); // p1 == seg1.p2 originally

    // move seg1's p2 by a tiny amount (< 1px, within sync threshold)
    seg1.p2.x = 100.3;
    seg1.p2.y = 0.2;

    syncConnectedSegments(seg1, [seg1, seg2]);

    // seg2's p1 should now match seg1's p2 within the sync threshold
    expect(seg2.p1.x).toBe(100.3);
    expect(seg2.p1.y).toBe(0.2);
  });

  it('does not modify non-adjacent segments', () => {
    const seg1 = makeSeg(0, 0, 0, 100, 0);
    const seg2 = makeSeg(1, 200, 200, 300, 300); // far away
    const seg2P1 = { x: seg2.p1.x, y: seg2.p1.y };

    seg1.p2.x = 110;
    syncConnectedSegments(seg1, [seg1, seg2]);

    // seg2 should be unchanged
    expect(seg2.p1.x).toBe(seg2P1.x);
    expect(seg2.p1.y).toBe(seg2P1.y);
  });

  it('does not modify the moved segment itself', () => {
    const seg1 = makeSeg(0, 0, 0, 100, 0);
    const p1Before = { x: seg1.p1.x, y: seg1.p1.y };
    seg1.p2.x = 110;
    syncConnectedSegments(seg1, [seg1]);
    expect(seg1.p1.x).toBe(p1Before.x);
    expect(seg1.p1.y).toBe(p1Before.y);
  });
});

// ============================================================
describe('snapSegmentEndpoints', () => {
  it('snaps both endpoints to grid', () => {
    const seg = makeSeg(0, 3, 7, 102, 203);
    snapSegmentEndpoints(seg);
    expect(seg.p1.x).toBe(0);   // 3 → 0
    expect(seg.p1.y).toBe(10);  // 7 → 10
    expect(seg.p2.x).toBe(100); // 102 → 100
    expect(seg.p2.y).toBe(200); // 203 → 200
  });

  it('recalculates angle and length after snap', () => {
    const seg = makeSeg(0, 0, 0, 103, 7);
    snapSegmentEndpoints(seg);
    // snapToGrid(103) → Math.round(10.3)*10 = 100
    // snapToGrid(7)   → Math.round(0.7)*10 = 10
    expect(seg.p2.x).toBe(100);
    expect(seg.p2.y).toBe(10);
    expect(seg.angle).toBeCloseTo(Math.atan2(10, 100));
    expect(seg.length).toBeCloseTo(Math.hypot(100, 10));
  });
});

// ============================================================
describe('resizeWallSegment', () => {
  it('extends segment from center', () => {
    const seg = makeSeg(0, 0, 0, 100, 0);
    resizeWallSegment(seg, 200);
    expect(seg.p1.x).toBeCloseTo(-50);
    expect(seg.p2.x).toBeCloseTo(150);
    expect(seg.length).toBeCloseTo(200);
  });

  it('shrinks segment from center', () => {
    const seg = makeSeg(0, 0, 0, 100, 0);
    resizeWallSegment(seg, 50);
    expect(seg.p1.x).toBeCloseTo(25);
    expect(seg.p2.x).toBeCloseTo(75);
    expect(seg.length).toBeCloseTo(50);
  });

  it('maintains angle when resizing', () => {
    const seg = makeSeg(0, 0, 0, 0, 100); // vertical
    resizeWallSegment(seg, 200);
    expect(seg.p1.y).toBeCloseTo(-50);
    expect(seg.p2.y).toBeCloseTo(150);
    expect(seg.p1.x).toBeCloseTo(0);
    expect(seg.p2.x).toBeCloseTo(0);
  });
});
