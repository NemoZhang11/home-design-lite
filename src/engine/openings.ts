// ============================================================
//  🏠 房间改造工具 — 门/窗数据逻辑 (纯数据)
// ============================================================

import type { WallSegment, Door, Window, DoorData, WindowData } from './types';
import { getWallPos } from './geometry';
import { DOOR_DEFAULT_WIDTH, WINDOW_DEFAULT_WIDTH } from './constants';

/** 创建门数据 (不涉及 Konva) */
export function createDoorData(
  wallIdx: number,
  t: number,
  width: number,
  swingInward: boolean,
  segs: WallSegment[],
  nextId: number,
  hingeSide: 'left' | 'right' = 'left'
): Door | null {
  const seg = segs[wallIdx];
  if (!seg) return null;

  const w = width || DOOR_DEFAULT_WIDTH;
  const pos = getWallPos(wallIdx, t, segs);
  if (!pos) return null;

  return {
    id: nextId,
    wallIdx,
    t,
    width: w,
    swingInward,
    hingeSide,
    hingeX: pos.x,
    hingeY: pos.y,
  };
}

/** 创建窗户数据 (不涉及 Konva) */
export function createWindowData(
  wallIdx: number,
  t: number,
  width: number,
  segs: WallSegment[],
  nextId: number
): Window | null {
  const seg = segs[wallIdx];
  if (!seg) return null;

  const w = width || WINDOW_DEFAULT_WIDTH;
  const pos = getWallPos(wallIdx, t, segs);
  if (!pos) return null;

  return {
    id: nextId,
    wallIdx,
    t,
    width: w,
  };
}

/** 重建门/窗数据 (在墙段重建后调用，过滤无效索引) */
export function rebuildDoorsAndWindowsData(
  doors: Door[],
  windows: Window[],
  segs: WallSegment[]
): { doors: DoorData[]; windows: WindowData[] } {
  const doorData: DoorData[] = doors
    .filter(d => d.wallIdx < segs.length)
    .map(d => ({
      id: d.id,
      wallIdx: d.wallIdx,
      t: d.t,
      width: d.width,
      swingInward: d.swingInward,
      hingeSide: d.hingeSide,
    }));

  const winData: WindowData[] = windows
    .filter(w => w.wallIdx < segs.length)
    .map(w => ({
      id: w.id,
      wallIdx: w.wallIdx,
      t: w.t,
      width: w.width,
    }));

  return { doors: doorData, windows: winData };
}
