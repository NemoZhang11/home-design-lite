// ============================================================
//  🏠 openings.ts 单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { createDoorData, createWindowData, rebuildDoorsAndWindowsData } from './openings';
import type { WallSegment, Door, Window } from './types';
import { DOOR_DEFAULT_WIDTH, WINDOW_DEFAULT_WIDTH } from './constants';

// ---- helpers ----
function makeSeg(id: number, x1: number, y1: number, x2: number, y2: number): WallSegment {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    id,
    p1: { x: x1, y: y1 },
    p2: { x: x2, y: y2 },
    angle: Math.atan2(dy, dx),
    length: Math.hypot(dx, dy),
    wallIdx: 0,
  };
}

// ============================================================
describe('createDoorData', () => {
  it('creates door at midpoint of a wall', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)];
    const door = createDoorData(0, 0.5, 80, true, segs, 1);
    expect(door).not.toBeNull();
    expect(door!.id).toBe(1);
    expect(door!.wallIdx).toBe(0);
    expect(door!.t).toBe(0.5);
    expect(door!.width).toBe(80);
    expect(door!.swingInward).toBe(true);
    expect(door!.hingeX).toBeCloseTo(50);
    expect(door!.hingeY).toBeCloseTo(0);
  });

  it('uses default width when width is falsy/0', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)];
    const door1 = createDoorData(0, 0.5, 0, true, segs, 5);
    expect(door1!.width).toBe(DOOR_DEFAULT_WIDTH); // DOOR_DEFAULT_WIDTH=80

    const door2 = createDoorData(0, 0.5, 60, true, segs, 6);
    expect(door2!.width).toBe(60); // explicit width
  });

  it('returns null for invalid wallIdx', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)];
    expect(createDoorData(99, 0.5, 80, true, segs, 1)).toBeNull();
  });

  it('creates door at start of wall (t=0)', () => {
    const segs = [makeSeg(0, 10, 20, 110, 120)];
    const door = createDoorData(0, 0, 80, false, segs, 3);
    expect(door!.hingeX).toBe(10);
    expect(door!.hingeY).toBe(20);
  });

  it('creates door at end of wall (t=1)', () => {
    const segs = [makeSeg(0, 10, 20, 110, 120)];
    const door = createDoorData(0, 1, 80, false, segs, 3);
    expect(door!.hingeX).toBe(110);
    expect(door!.hingeY).toBe(120);
  });
});

// ============================================================
describe('createWindowData', () => {
  it('creates window at midpoint of a wall', () => {
    const segs = [makeSeg(0, 0, 100, 0, 100)];
    const win = createWindowData(0, 0.3, 100, segs, 1);
    expect(win).not.toBeNull();
    expect(win!.id).toBe(1);
    expect(win!.wallIdx).toBe(0);
    expect(win!.t).toBe(0.3);
    expect(win!.width).toBe(100);
  });

  it('uses default width when width is 0', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)];
    const win = createWindowData(0, 0.5, 0, segs, 2);
    expect(win!.width).toBe(WINDOW_DEFAULT_WIDTH); // WINDOW_DEFAULT_WIDTH=100
  });

  it('returns null for invalid wallIdx', () => {
    expect(createWindowData(0, 0.5, 100, [], 1)).toBeNull();
  });

  it('stores t parameter correctly', () => {
    const segs = [makeSeg(0, 0, 0, 200, 0)];
    const win = createWindowData(0, 0.75, 80, segs, 5);
    expect(win!.t).toBe(0.75);
  });
});

// ============================================================
describe('rebuildDoorsAndWindowsData', () => {
  function makeDoor(id: number, wallIdx: number, t: number, width: number = 80, swingInward: boolean = true): Door {
    return { id, wallIdx, t, width, swingInward, hingeSide: 'left', hingeX: 0, hingeY: 0 };
  }
  function makeWin(id: number, wallIdx: number, t: number, width: number = 100): Window {
    return { id, wallIdx, t, width };
  }

  it('filters out references to non-existent walls', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)]; // only 1 wall (idx 0)
    const doors = [makeDoor(1, 0, 0.5), makeDoor(2, 5, 0.3)];  // door 2 → wall idx 5 (invalid)
    const windows = [makeWin(1, 3, 0.5)];                        // window → wall idx 3 (invalid)

    const result = rebuildDoorsAndWindowsData(doors, windows, segs);
    expect(result.doors).toHaveLength(1);
    expect(result.doors[0]!.id).toBe(1);
    expect(result.windows).toHaveLength(0);
  });

  it('preserves all doors/windows when all wall indices are valid', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0), makeSeg(1, 100, 0, 100, 100)];
    const doors = [makeDoor(1, 0, 0.3), makeDoor(2, 1, 0.7)];
    const windows = [makeWin(1, 0, 0.5), makeWin(2, 1, 0.2)];

    const result = rebuildDoorsAndWindowsData(doors, windows, segs);
    expect(result.doors).toHaveLength(2);
    expect(result.windows).toHaveLength(2);
  });

  it('returns empty arrays for empty inputs', () => {
    const segs: WallSegment[] = [];
    const result = rebuildDoorsAndWindowsData([], [], segs);
    expect(result.doors).toEqual([]);
    expect(result.windows).toEqual([]);
  });

  it('preserves door properties', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)];
    const doors = [makeDoor(42, 0, 0.25, 60, false)];
    const result = rebuildDoorsAndWindowsData(doors, [], segs);
    expect(result.doors[0]).toEqual({
      id: 42,
      wallIdx: 0,
      t: 0.25,
      width: 60,
      swingInward: false,
      hingeSide: 'left',
    });
  });

  it('preserves window properties', () => {
    const segs = [makeSeg(0, 0, 0, 100, 0)];
    const windows = [makeWin(99, 0, 0.88, 120)];
    const result = rebuildDoorsAndWindowsData([], windows, segs);
    expect(result.windows[0]).toEqual({
      id: 99,
      wallIdx: 0,
      t: 0.88,
      width: 120,
    });
  });
});
