// ============================================================
//  🏠 layout.ts 单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { runSmartLayout } from './layout';
import type { Point, FurnitureItem } from './types';
import { FURNITURE_GAP } from './constants';

// ============================================================
describe('runSmartLayout', () => {
  const room4x3: Point[] = [
    { x: 200, y: 150 },   // top-left
    { x: 600, y: 150 },   // top-right (400cm wide)
    { x: 600, y: 450 },   // bottom-right (300cm tall)
    { x: 200, y: 450 },   // bottom-left
    { x: 200, y: 150 },   // close
  ];

  it('returns empty for fewer than 3 wall points', () => {
    const items: FurnitureItem[] = [
      { type: 'bed', x: 0, y: 0, rotation: 0 },
    ];
    expect(runSmartLayout([], items)).toEqual([]);
    expect(runSmartLayout([{ x: 0, y: 0 }, { x: 1, y: 1 }], items)).toEqual([]);
  });

  it('places furniture within room bounds', () => {
    const items: FurnitureItem[] = [
      { type: 'bed', x: 0, y: 0, rotation: 0 },
      { type: 'desk', x: 0, y: 0, rotation: 0 },
    ];
    const results = runSmartLayout(room4x3, items);
    expect(results).toHaveLength(2);

    for (const r of results) {
      expect(r.x).toBeGreaterThanOrEqual(200 + FURNITURE_GAP);
      expect(r.y).toBeGreaterThanOrEqual(150 + FURNITURE_GAP);
    }
  });

  it('returns positions snapped to grid', () => {
    const items: FurnitureItem[] = [
      { type: 'chair', x: 0, y: 0, rotation: 0 },
    ];
    const results = runSmartLayout(room4x3, items);
    expect(results).toHaveLength(1);
    // chair is 40x40, GRID_SIZE=10, positions should be multiples of 10
    expect(results[0]!.x % 10).toBe(0);
    expect(results[0]!.y % 10).toBe(0);
  });

  it('handles items with unknown type gracefully', () => {
    const items: FurnitureItem[] = [
      { type: 'nonexistent_furniture', x: 100, y: 100, rotation: 0 },
    ];
    const results = runSmartLayout(room4x3, items);
    expect(results).toHaveLength(1);
    // Unknown type should return original x,y
    expect(results[0]!.x).toBe(100);
    expect(results[0]!.y).toBe(100);
  });

  it('places all standard furniture types', () => {
    const items: FurnitureItem[] = [
      { type: 'bed', x: 0, y: 0, rotation: 0 },
      { type: 'sofa', x: 0, y: 0, rotation: 0 },
      { type: 'desk', x: 0, y: 0, rotation: 0 },
      { type: 'wardrobe', x: 0, y: 0, rotation: 0 },
      { type: 'chair', x: 0, y: 0, rotation: 0 },
    ];
    const results = runSmartLayout(room4x3, items);
    expect(results).toHaveLength(5);
    // All should have positions (no nulls)
    for (const r of results) {
      expect(r.x).toBeDefined();
      expect(r.y).toBeDefined();
    }
  });

  it('produces non-overlapping placements (using FURNITURE_GAP)', () => {
    // Place 2 items that would overlap if not gapped
    const items: FurnitureItem[] = [
      { type: 'chair', x: 0, y: 0, rotation: 0 },
      { type: 'chair', x: 0, y: 0, rotation: 0 },
    ];
    const results = runSmartLayout(room4x3, items);
    expect(results).toHaveLength(2);
    const [a, b] = results;
    // chair is 40x40 with FURNITURE_GAP=20
    // If placed at same position, they'd overlap
    // The algorithm should place them at different positions
    const samePosition = a!.x === b!.x && a!.y === b!.y;
    expect(samePosition).toBe(false);
  });

  it('handles many items by falling back to center stacking', () => {
    // Force many items into a small room to trigger fallback
    const smallRoom: Point[] = [
      { x: 300, y: 250 },
      { x: 500, y: 250 }, // 200x200 room
      { x: 500, y: 450 },
      { x: 300, y: 450 },
      { x: 300, y: 250 },
    ];
    const items: FurnitureItem[] = [
      { type: 'sofa', x: 0, y: 0, rotation: 0 },  // 180x80
      { type: 'bed', x: 0, y: 0, rotation: 0 },    // 160x200
      { type: 'desk', x: 0, y: 0, rotation: 0 },    // 120x60
      { type: 'wardrobe', x: 0, y: 0, rotation: 0 }, // 100x60
      { type: 'chair', x: 0, y: 0, rotation: 0 },    // 40x40
    ];
    const results = runSmartLayout(smallRoom, items);
    expect(results).toHaveLength(5);
    // Just verify it doesn't crash — the fallback center stacking is intentional
  });
});
