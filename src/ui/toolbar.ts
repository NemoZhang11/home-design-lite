// ============================================================
//  🏠 房间改造工具 — 工具栏事件绑定
// ============================================================

import { state, pushUndo, popUndo, popRedo, clearSelection } from '../state/store';
import { EditorMode } from '../engine/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../engine/constants';
import { createRoomFromDimensions } from '../engine/walls';
import { setStatus } from './statusBar';
import { log } from '../engine/logger';

export interface ToolbarCallbacks {
  onSetMode: (mode: EditorMode) => void;
  onRebuildWalls: () => void;
  onClearAll: () => void;
  onDrawGrid: () => void;
  onUpdateUndoRedo: () => void;
}

/** 更新撤销/重做按钮状态 */
export function updateUndoRedoButtons(): void {
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;
  if (undoBtn) undoBtn.disabled = state.undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
}

/** 绑定所有工具栏事件 */
export function bindToolbarEvents(callbacks: ToolbarCallbacks): void {
  // 模式按钮
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function(this: HTMLElement) {
      const mode = this.dataset.mode as EditorMode;
      callbacks.onSetMode(mode);
    });
  });

  // 智能布局按钮
  const layoutBtn = document.getElementById('btn-layout');
  if (layoutBtn) {
    layoutBtn.addEventListener('click', function() {
      callbacks.onSetMode('layout');
    });
  }

  // 网格切换
  const gridBtn = document.getElementById('btn-grid');
  if (gridBtn) {
    gridBtn.addEventListener('click', function() {
      state.showGrid = !state.showGrid;
      callbacks.onDrawGrid();
      this.textContent = state.showGrid ? '▣ 网格' : '▣ 网格隐藏';
    });
  }

  // 撤销
  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) {
    undoBtn.addEventListener('click', undoWallPoint);
  }

  // 重做
  const redoBtn = document.getElementById('btn-redo');
  if (redoBtn) {
    redoBtn.addEventListener('click', redoWallPoint);
  }

  // 清除
  const clearBtn = document.getElementById('btn-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', callbacks.onClearAll);
  }

  // 一键创建房间
  const createBtn = document.getElementById('btn-create-room');
  if (createBtn) {
    createBtn.addEventListener('click', function() {
      const wInput = document.getElementById('room-width') as HTMLInputElement | null;
      const hInput = document.getElementById('room-height') as HTMLInputElement | null;
      if (!wInput || !hInput) return;

      const w = parseFloat(wInput.value);
      const h = parseFloat(hInput.value);
      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
        setStatus('⚠️ 请输入有效的房间尺寸', 'idle');
        return;
      }

      // 清除现有
      callbacks.onClearAll();

      // 创建矩形房间
      state.wallPoints = createRoomFromDimensions(w, h, CANVAS_WIDTH, CANVAS_HEIGHT);
      state.isClosed = true;
      state.undoStack = [];
      state.redoStack = [];
      callbacks.onRebuildWalls();
      callbacks.onUpdateUndoRedo();

      log('一键创建房间', { width: w + 'cm', height: h + 'cm' });
      setStatus(`✅ 已创建 ${w}cm × ${h}cm 房间 — 点击墙段选中编辑，或切换到「放家具」模式`, 'success');
    });
  }

  // 门方向切换
  const doorDirBtn = document.getElementById('btn-door-dir');
  if (doorDirBtn) {
    doorDirBtn.addEventListener('click', function() {
      // 找到选中的门
      if (state.selectedElementType !== 'door' || state.selectedElementId === null) return;
      const door = state.doors.find(d => d.id === state.selectedElementId);
      if (!door) return;
      door.swingInward = !door.swingInward;
      this.textContent = door.swingInward ? '向内开 ▼' : '向外开 ▼';
      // The arc update is handled by the renderer when we call rebuildDoorsAndWindows
      // For immediate visual update, we need to trigger a re-render
      // This will be handled by the main module via a callback
    });
  }
}

/** 撤销墙点 */
function undoWallPoint(): void {
  if (state.undoStack.length === 0) return;
  const snapshot = popUndo();
  if (!snapshot) return;
  state.wallPoints = snapshot;
  if (state.isClosed && state.wallPoints.length < 3) {
    state.isClosed = false;
  }
  if (state.isClosed) {
    state.isClosed = false;
  }
  // Trigger rebuild via event
  document.dispatchEvent(new CustomEvent('wall-changed'));
  setStatus('已撤销 — 点击继续添加墙点', 'drawing');
  log('撤销');
}

/** 重做墙点 */
function redoWallPoint(): void {
  if (state.redoStack.length === 0) return;
  const snapshot = popRedo();
  if (!snapshot) return;
  state.wallPoints = snapshot;
  // Trigger rebuild via event
  document.dispatchEvent(new CustomEvent('wall-changed'));
  log('重做');
}
