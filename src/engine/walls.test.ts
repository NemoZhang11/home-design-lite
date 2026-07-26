// ============================================================
//  🏠 walls.ts 单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { rebuildWallSegments, createRoomFromDimensions } from './walls';
import type { Point } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

// ============================================================
describe('rebuildWallSegments', () => {
  it('creates correct number of segments for closed polygon', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },   // duplicate to close
    ];
    const segs = rebuildWallSegments(pts, true, 0);
    // With 5 points, isClosed=true → endIdx=5 → i from 0..4
    // i=4: p1=(0,100), p2=(0,0), so 5 segments total
    expect(segs).toHaveLength(5);
  });

  it('assigns sequential IDs starting from nextId', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 0 },
    ];
    const segs = rebuildWallSegments(pts, true, 10);
    expect(segs[0]!.id).toBe(10);
    expect(segs[1]!.id).toBe(11);
    expect(segs[2]!.id).toBe(12);
  });

  it('returns empty for fewer than 2 points', () => {
    expect(rebuildWallSegments([], true, 0)).toEqual([]);
    expect(rebuildWallSegments([{ x: 0, y: 0 }], true, 0)).toEqual([]);
  });

  it('calculates correct length and angle for horizontal segment', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const segs = rebuildWallSegments(pts, false, 0);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.length).toBeCloseTo(100);
    expect(segs[0]!.angle).toBeCloseTo(0);
  });

  it('calculates correct length and angle for vertical segment', () => {
    const pts: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 200 },
    ];
    const segs = rebuildWallSegments(pts, false, 0);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.length).toBeCloseTo(200);
    expect(segs[0]!.angle).toBeCloseTo(Math.PI / 2);
  });

  it('handles open polyline (non-wrapping last segment)', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    // isClosed=false, endIdx=3 → segments: (0→1), (1→2), (2→0) — wait
    // Actually: endIdx=3, nextIdx = (2+1)==3 == points.length → 0
    // So i=2: p1=(100,100), p2=(0,0) — wraps around!
    const segs = rebuildWallSegments(pts, false, 0);
    expect(segs).toHaveLength(3);
    expect(segs[0]!.p1).toEqual({ x: 0, y: 0 });
    expect(segs[0]!.p2).toEqual({ x: 100, y: 0 });
    expect(segs[1]!.p1).toEqual({ x: 100, y: 0 });
    expect(segs[1]!.p2).toEqual({ x: 100, y: 100 });
    expect(segs[2]!.p1).toEqual({ x: 100, y: 100 });
    expect(segs[2]!.p2).toEqual({ x: 0, y: 0 });
  });
});

// ============================================================
describe('createRoomFromDimensions', () => {
  it('creates 5 points for a rectangular room (centered)', () => {
    const pts = createRoomFromDimensions(400, 300, 800, 600);
    // width=400, height=300, canvas=800x600
    // startX = (800-400)/2 = 200, startY = (600-300)/2 = 150
    expect(pts).toHaveLength(5);
  });

  it('centers room on canvas', () => {
    const pts = createRoomFromDimensions(200, 200, 800, 600);
    // startX = (800-200)/2 = 300 → snapToGrid(300) = 300
    // startY = (600-200)/2 = 200 → snapToGrid(200) = 200
    expect(pts[0]).toEqual({ x: 300, y: 200 });
    expect(pts[2]).toEqual({ x: 500, y: 400 });
  });

  it('snaps to grid', () => {
    const pts = createRoomFromDimensions(101, 99, 800, 600);
    // (800-101)/2 = 349.5 → round and then snap → round(349.5) = 350, 350/10*10 = 350
    // But createRoomFromDimensions uses Math.round( / 2 / 10) * 10
    expect(pts[0]!.x % 10).toBe(0);
    expect(pts[0]!.y % 10).toBe(0);
  });

  it('first and last point are identical (closes polygon)', () => {
    const pts = createRoomFromDimensions(300, 200);
    expect(pts[0]).toEqual(pts[4]);
  });

  it('corners form a rectangle', () => {
    const pts = createRoomFromDimensions(200, 100);
    const [a, b, c, d, e] = pts;
    expect(a).toEqual(e);                          // closed
    expect(b!.x).toBeGreaterThan(a!.x);            // right
    expect(b!.y).toBe(a!.y);                       // same y
    expect(c!.x).toBe(b!.x);                       // same x
    expect(c!.y).toBeGreaterThan(b!.y);            // down
    expect(d!.x).toBe(a!.x);                       // back to left
    expect(d!.y).toBe(c!.y);                       // same y
  });
});
