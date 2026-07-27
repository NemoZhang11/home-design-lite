// ============================================================
//  🏠 房间改造工具 — 状态管理 (v5.1)
//  4-tab: room | furniture | layout | adjust
//  统一撤销栈: 50步全状态快照
// ============================================================

import type { Point, WallSegment, Door, Window, FurnitureItem, EditorMode } from '../engine/types';
import { clonePoints } from '../engine/geometry';

// 保留 EditorMode 用于向后兼容 (main.ts 内部使用)
export type ActiveTab = 'room' | 'furniture' | 'layout' | 'adjust';

/** 完整状态快照 (用于撤销) */
export interface StateSnapshot {
  wallPoints: Point[];
  isClosed: boolean;
  doors: Door[];
  windows: Window[];
  furnitureItems: FurnitureItem[];
}

export interface EditorState {
  mode: EditorMode;
  activeTab: ActiveTab;
  hasEverHadRoom: boolean;  // 用于判断是否显示模板浮层
  wallPoints: Point[];
  wallSegments: WallSegment[];
  isClosed: boolean;
  doors: Door[];
  windows: Window[];
  furnitureItems: FurnitureItem[];
  selectedWallId: number | null;
  selectedElementId: number | null;
  selectedElementType: 'door' | 'window' | 'furniture' | null;
  placingElementType: 'door' | 'window' | 'furniture' | null;
  showGrid: boolean;
  nextWallId: number;
  nextDoorId: number;
  nextWindowId: number;
  undoStack: StateSnapshot[];
  redoStack: StateSnapshot[];
  isDrawing: boolean;
  dragFurnitureType: string | null;
  _rebuildingDoorsWindows: boolean;
  // 家具选择数量 (step2)
  furnitureQuantities: Record<string, number>;
}

const MAX_UNDO_STEPS = 50;

export const state: EditorState = {
  mode: 'draw',
  activeTab: 'room',
  hasEverHadRoom: false,
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
  furnitureQuantities: {
    bed: 0,
    desk: 0,
    wardrobe: 0,
    chair: 0,
    sofa: 0,
  },
};

/** 保存撤销快照 (全状态) */
export function pushUndo(): void {
  const snapshot: StateSnapshot = {
    wallPoints: clonePoints(state.wallPoints),
    isClosed: state.isClosed,
    doors: JSON.parse(JSON.stringify(state.doors)),
    windows: JSON.parse(JSON.stringify(state.windows)),
    furnitureItems: JSON.parse(JSON.stringify(state.furnitureItems)),
  };
  state.undoStack.push(snapshot);
  if (state.undoStack.length > MAX_UNDO_STEPS) {
    state.undoStack.shift();
  }
  state.redoStack = [];
}

/** 撤销 */
export function popUndo(): StateSnapshot | undefined {
  const snapshot = state.undoStack.pop();
  if (snapshot) {
    const current: StateSnapshot = {
      wallPoints: clonePoints(state.wallPoints),
      isClosed: state.isClosed,
      doors: JSON.parse(JSON.stringify(state.doors)),
      windows: JSON.parse(JSON.stringify(state.windows)),
      furnitureItems: JSON.parse(JSON.stringify(state.furnitureItems)),
    };
    state.redoStack.push(current);
  }
  return snapshot;
}

/** 重做 */
export function popRedo(): StateSnapshot | undefined {
  const snapshot = state.redoStack.pop();
  if (snapshot) {
    const current: StateSnapshot = {
      wallPoints: clonePoints(state.wallPoints),
      isClosed: state.isClosed,
      doors: JSON.parse(JSON.stringify(state.doors)),
      windows: JSON.parse(JSON.stringify(state.windows)),
      furnitureItems: JSON.parse(JSON.stringify(state.furnitureItems)),
    };
    state.undoStack.push(current);
  }
  return snapshot;
}

/** 清除选中状态 (不清除家具选中 — 跨标签保留) */
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
  activeTab: ActiveTab;
  hasEverHadRoom: boolean;
  showGrid: boolean;
  nextWallId: number;
  nextDoorId: number;
  nextWindowId: number;
  furnitureQuantities: Record<string, number>;
}

export function saveToStorage(): void {
  try {
    const data: SaveData = {
      wallPoints: state.wallPoints,
      isClosed: state.isClosed,
      doors: state.doors,
      windows: state.windows,
      furnitureItems: state.furnitureItems,
      mode: state.mode,
      activeTab: state.activeTab,
      hasEverHadRoom: state.hasEverHadRoom,
      showGrid: state.showGrid,
      nextWallId: state.nextWallId,
      nextDoorId: state.nextDoorId,
      nextWindowId: state.nextWindowId,
      furnitureQuantities: state.furnitureQuantities,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

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

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
