// ============================================================
//  🏠 房间改造工具 — 状态管理
// ============================================================

import type { Point, WallSegment, Door, Window, FurnitureItem, EditorMode } from '../engine/types';
import { clonePoints } from '../engine/geometry';

export interface EditorState {
  mode: EditorMode;
  wallPoints: Point[];
  wallSegments: WallSegment[];
  isClosed: boolean;
  doors: Door[];
  windows: Window[];
  furnitureItems: FurnitureItem[];
  selectedWallId: number | null;
  selectedElementId: number | null;
  selectedElementType: 'door' | 'window' | null;
  placingElementType: 'door' | 'window' | null;
  showGrid: boolean;
  nextWallId: number;
  nextDoorId: number;
  nextWindowId: number;
  undoStack: Point[][];
  redoStack: Point[][];
  isDrawing: boolean;
  dragFurnitureType: string | null;
  _rebuildingDoorsWindows: boolean;
}

export const state: EditorState = {
  mode: 'draw',
  wallPoints: [],
  wallSegments: [],
  isClosed: false,
  doors: [],
  windows: [],
  furnitureItems: [],
  selectedWallId: null,
  selectedElementId: null,
  selectedElementType: null,
  placingElementType: null,
  showGrid: true,
  nextWallId: 0,
  nextDoorId: 0,
  nextWindowId: 0,
  undoStack: [],
  redoStack: [],
  isDrawing: false,
  dragFurnitureType: null,
  _rebuildingDoorsWindows: false,
};

/** 保存撤销快照 */
export function pushUndo(): void {
  state.undoStack.push(clonePoints(state.wallPoints));
  state.redoStack = [];
}

/** 撤销 */
export function popUndo(): Point[] | undefined {
  const snapshot = state.undoStack.pop();
  if (snapshot) {
    state.redoStack.push(clonePoints(state.wallPoints));
  }
  return snapshot;
}

/** 重做 */
export function popRedo(): Point[] | undefined {
  const snapshot = state.redoStack.pop();
  if (snapshot) {
    state.undoStack.push(clonePoints(state.wallPoints));
  }
  return snapshot;
}

/** 清除选中状态 */
export function clearSelection(): void {
  state.selectedWallId = null;
  state.selectedElementId = null;
  state.selectedElementType = null;
}

// ============================================================
//  localStorage 自动保存/恢复
// ============================================================

export const STORAGE_KEY = 'home-design-tool-state';

export interface SaveData {
  wallPoints: Point[];
  isClosed: boolean;
  doors: Door[];
  windows: Window[];
  furnitureItems: FurnitureItem[];
  mode: EditorMode;
  showGrid: boolean;
  nextWallId: number;
  nextDoorId: number;
  nextWindowId: number;
}

/** Save current state to localStorage */
export function saveToStorage(): void {
  try {
    const data: SaveData = {
      wallPoints: state.wallPoints,
      isClosed: state.isClosed,
      doors: state.doors,
      windows: state.windows,
      furnitureItems: state.furnitureItems,
      mode: state.mode,
      showGrid: state.showGrid,
      nextWallId: state.nextWallId,
      nextDoorId: state.nextDoorId,
      nextWindowId: state.nextWindowId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Load state from localStorage. Returns null if no saved data. */
export function loadFromStorage(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data.wallPoints || !Array.isArray(data.wallPoints)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Clear saved state */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
