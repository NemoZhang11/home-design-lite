// ============================================================
//  🏠 房间改造工具 — 智能布局算法 (纯数据)
// ============================================================

import type { Point, FurnitureItem, PlacedRect } from './types';
import { FURNITURE_DEFS, FURNITURE_GAP, GRID_SIZE } from './constants';
import { snapToGrid } from './geometry';

/** 碰撞检测 */
function collides(r1: PlacedRect, r2: PlacedRect): boolean {
  const gap = FURNITURE_GAP;
  return !(r1.x + r1.w + gap <= r2.x ||
           r2.x + r2.w + gap <= r1.x ||
           r1.y + r1.h + gap <= r2.y ||
           r2.y + r2.h + gap <= r1.y);
}

function collidesAny(r: PlacedRect, placed: PlacedRect[]): boolean {
  for (const p of placed) {
    if (collides(r, p)) return true;
  }
  return false;
}

function insideRoom(r: PlacedRect, minX: number, minY: number, maxX: number, maxY: number, pad: number): boolean {
  return r.x >= minX + pad &&
         r.y >= minY + pad &&
         r.x + r.w <= maxX - pad &&
         r.y + r.h <= maxY - pad;
}

export interface LayoutResult {
  x: number;
  y: number;
}

/**
 * 智能布局算法 — 计算家具在房间内的最佳位置
 * 返回每个家具的新位置 (x, y)
 */
export function runSmartLayout(
  wallPoints: Point[],
  furnitureItems: FurnitureItem[]
): LayoutResult[] {
  if (wallPoints.length < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of wallPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const pad = FURNITURE_GAP;
  const placed: PlacedRect[] = [];
  const results: LayoutResult[] = [];

  for (let idx = 0; idx < furnitureItems.length; idx++) {
    const item = furnitureItems[idx];
    if (!item) continue;
    const def = FURNITURE_DEFS[item.type];
    if (!def) {
      results.push({ x: item.x, y: item.y });
      continue;
    }

    const fw = def.w;
    const fh = def.h;

    const candidates: PlacedRect[] = [];

    // 沿墙候选位置 (上、下、左、右)
    for (let x = minX + pad; x + fw <= maxX - pad; x += GRID_SIZE) {
      candidates.push({ x, y: minY + pad, w: fw, h: fh });
    }
    for (let x = minX + pad; x + fw <= maxX - pad; x += GRID_SIZE) {
      candidates.push({ x, y: maxY - pad - fh, w: fw, h: fh });
    }
    for (let y = minY + pad; y + fh <= maxY - pad; y += GRID_SIZE) {
      candidates.push({ x: minX + pad, y, w: fw, h: fh });
    }
    for (let y = minY + pad; y + fh <= maxY - pad; y += GRID_SIZE) {
      candidates.push({ x: maxX - pad - fw, y, w: fw, h: fh });
    }

    // 去重
    const seen = new Set<string>();
    const unique: PlacedRect[] = [];
    for (const c of candidates) {
      const key = `${snapToGrid(c.x)},${snapToGrid(c.y)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }

    let placedPos: PlacedRect | null = null;
    for (const c of unique) {
      if (insideRoom(c, minX, minY, maxX, maxY, pad) && !collidesAny(c, placed)) {
        placedPos = c;
        break;
      }
    }

    if (placedPos) {
      const targetX = snapToGrid(placedPos.x);
      const targetY = snapToGrid(placedPos.y);
      results.push({ x: targetX, y: targetY });
      placed.push({ x: targetX, y: targetY, w: fw, h: fh });
    } else {
      const cx = snapToGrid((minX + maxX) / 2 - fw / 2);
      const cy = snapToGrid((minY + maxY) / 2 - fh / 2 + idx * (fh + FURNITURE_GAP));
      results.push({ x: cx, y: cy });
      placed.push({ x: cx, y: cy, w: fw, h: fh });
    }
  }

  return results;
}

/**
 * 布局变体 B — 分区策略，与方案 A 产生不同的家具排列
 * 从反方向开始枚举候选位置，产生不同的摆放结果
 */
export function runSmartLayoutB(
  wallPoints: Point[],
  furnitureItems: FurnitureItem[]
): LayoutResult[] {
  if (wallPoints.length < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of wallPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const pad = FURNITURE_GAP;
  const placed: PlacedRect[] = [];
  const results: LayoutResult[] = [];

  // 方案 B: 按家具尺寸从大到小排列，优先靠右/靠下放置
  interface ItemWithIdx extends FurnitureItem { _origIdx: number }
  const sorted: ItemWithIdx[] = furnitureItems.map((item, idx) => ({ ...item, _origIdx: idx }));
  sorted.sort((a, b) => {
    const da = FURNITURE_DEFS[a.type];
    const db = FURNITURE_DEFS[b.type];
    return (db ? db.w * db.h : 0) - (da ? da.w * da.h : 0);
  });

  const resultMap = new Map<number, LayoutResult>();

  for (let si = 0; si < sorted.length; si++) {
    const item = sorted[si]!;
    const def = FURNITURE_DEFS[item.type];
    if (!def) {
      resultMap.set(item._origIdx, { x: item.x, y: item.y });
      continue;
    }

    const fw = def.w;
    const fh = def.h;
    const candidates: PlacedRect[] = [];

    // 方案 B 候选顺序：右墙 → 左墙 → 底墙 → 顶墙 (与 A 相反)
    for (let y = minY + pad; y + fh <= maxY - pad; y += GRID_SIZE) {
      candidates.push({ x: maxX - pad - fw, y, w: fw, h: fh });
    }
    for (let y = minY + pad; y + fh <= maxY - pad; y += GRID_SIZE) {
      candidates.push({ x: minX + pad, y, w: fw, h: fh });
    }
    for (let x = minX + pad; x + fw <= maxX - pad; x += GRID_SIZE) {
      candidates.push({ x, y: maxY - pad - fh, w: fw, h: fh });
    }
    for (let x = minX + pad; x + fw <= maxX - pad; x += GRID_SIZE) {
      candidates.push({ x, y: minY + pad, w: fw, h: fh });
    }

    const seen = new Set<string>();
    const unique: PlacedRect[] = [];
    for (const c of candidates) {
      const key = `${snapToGrid(c.x)},${snapToGrid(c.y)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }

    let placedPos: PlacedRect | null = null;
    for (const c of unique) {
      if (insideRoom(c, minX, minY, maxX, maxY, pad) && !collidesAny(c, placed)) {
        placedPos = c;
        break;
      }
    }

    if (placedPos) {
      const tx = snapToGrid(placedPos.x);
      const ty = snapToGrid(placedPos.y);
      resultMap.set(item._origIdx, { x: tx, y: ty });
      placed.push({ x: tx, y: ty, w: fw, h: fh });
    } else {
      const cx = snapToGrid((minX + maxX) / 2 - fw / 2);
      const cy = snapToGrid((minY + maxY) / 2 - fh / 2 + si * (fh + FURNITURE_GAP));
      resultMap.set(item._origIdx, { x: cx, y: cy });
      placed.push({ x: cx, y: cy, w: fw, h: fh });
    }
  }

  // 恢复原始顺序
  for (let i = 0; i < furnitureItems.length; i++) {
    const fi = furnitureItems[i]!;
    results.push(resultMap.get(i) || { x: fi.x, y: fi.y });
  }
  return results;
}
