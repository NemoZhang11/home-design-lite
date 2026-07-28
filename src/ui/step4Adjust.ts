// ============================================================
//  🏠 房间改造工具 — Step 4: 微调面板
// ============================================================

import Konva from 'konva';
import { state, pushUndo, saveToStorage } from '../state/store';
import { FURNITURE_DEFS } from '../engine/constants';
import { setStatus, setStatusForTab } from './statusBar';
import { setActiveTab } from './stepPanel';

const FURNITURE_EMOJI: Record<string, string> = {
  bed: '🛏️', desk: '📝', wardrobe: '🗄️', chair: '💺', sofa: '🛋️',
};

export interface Step4Callbacks {
  onSelectFurniture: (index: number) => void;
  onRemoveFurniture: (index: number) => void;
  onRotateFurniture: (index: number) => void;
  onRestoreLayout: () => void;
  onAddFurniture: () => void;
  onQuickPlaceFurniture: (type: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

let _selectedFurnitureIdx = -1;

/** 渲染 Step 4 面板 */
export function renderStep4Panel(container: HTMLElement, callbacks: Step4Callbacks): void {
  container.innerHTML = '';

  // ---- 快速添加家具 (快捷放置) ----
  const quickTitle = document.createElement('div');
  quickTitle.className = 'panel-section-title';
  quickTitle.textContent = '快速添加';
  container.appendChild(quickTitle);

  const quickGrid = document.createElement('div');
  quickGrid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px;';

  const types = ['bed', 'desk', 'wardrobe', 'chair', 'sofa'] as const;
  const emoji: Record<string, string> = { bed: '🛏️', desk: '📝', wardrobe: '🗄️', chair: '💺', sofa: '🛋️' };

  for (const type of types) {
    const def = FURNITURE_DEFS[type];
    if (!def) continue;
    const card = document.createElement('div');
    card.style.cssText = 'display:flex; align-items:center; gap:4px; padding:5px 8px; background:#fff; border:1px solid #e8e2dc; border-radius:6px; cursor:pointer; font-size:12px;';
    card.innerHTML = `<span>${emoji[type]}</span><span style="font-weight:500;">${def.label}</span><span style="color:#95a5a6; margin-left:auto;">${def.w}×${def.h}</span>`;
    card.addEventListener('click', () => {
      // Enter placement mode
      callbacks.onQuickPlaceFurniture(type);
    });
    quickGrid.appendChild(card);
  }
  container.appendChild(quickGrid);

  const title = document.createElement('div');
  title.className = 'panel-section-title';
  title.textContent = '已放置家具';
  container.appendChild(title);

  // 家具列表容器
  const listContainer = document.createElement('div');
  listContainer.id = 'adjust-furniture-list';
  listContainer.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
  container.appendChild(listContainer);

  refreshFurnitureList(listContainer, callbacks);

  // 添加家具
  const addBtn = document.createElement('button');
  addBtn.className = 'action-btn full-width';
  addBtn.style.marginTop = '8px';
  addBtn.textContent = '+ 添加家具';
  addBtn.addEventListener('click', () => callbacks.onAddFurniture());
  container.appendChild(addBtn);

  // 操作按钮行
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:6px; margin-top:4px;';

  const undoBtn = document.createElement('button');
  undoBtn.className = 'action-btn';
  undoBtn.style.cssText = 'flex:1;';
  undoBtn.textContent = '↩ 撤销';
  undoBtn.addEventListener('click', () => callbacks.onUndo());
  btnRow.appendChild(undoBtn);

  const redoBtn = document.createElement('button');
  redoBtn.className = 'action-btn';
  redoBtn.style.cssText = 'flex:1;';
  redoBtn.textContent = '↪ 重做';
  redoBtn.addEventListener('click', () => callbacks.onRedo());
  btnRow.appendChild(redoBtn);

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'action-btn';
  restoreBtn.style.cssText = 'flex:1;';
  restoreBtn.textContent = '↺ 恢复';
  restoreBtn.addEventListener('click', () => callbacks.onRestoreLayout());
  btnRow.appendChild(restoreBtn);

  container.appendChild(btnRow);

  // 返回看方案
  const backLink = document.createElement('a');
  backLink.style.cssText = 'font-size:12px; color:#3498db; cursor:pointer; text-align:center; margin-top:8px; display:block;';
  backLink.textContent = '← 回去看方案';
  backLink.addEventListener('click', (e) => { e.preventDefault(); setActiveTab('layout'); });
  container.appendChild(backLink);
}

function refreshFurnitureList(container: HTMLElement, callbacks: Step4Callbacks): void {
  container.innerHTML = '';
  const items = state.furnitureItems;

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px; color:#95a5a6; padding:8px; text-align:center;';
    empty.textContent = '还没有放置家具';
    container.appendChild(empty);
    return;
  }

  // 统计同类家具数量用于编号
  const counts: Record<string, number> = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const def = FURNITURE_DEFS[item.type];
    if (!def) continue;

    counts[item.type] = (counts[item.type] || 0) + 1;
    const cnt = counts[item.type]!;
    const label = cnt > 1 ? `${def.label} #${cnt}` : def.label;

    const row = document.createElement('div');
    row.className = 'furniture-adjust-item' + (i === _selectedFurnitureIdx ? ' selected' : '');
    row.innerHTML = `
      <span style="font-size:14px;">${FURNITURE_EMOJI[item.type] || ''}</span>
      <span style="font-size:12px; font-weight:500;">${label}</span>
      <span style="font-size:11px; color:#95a5a6;">${def.w}×${def.h} ${item.rotation || 0}°</span>
      <span style="margin-left:auto; font-size:11px; color:#e74c3c; cursor:pointer; padding:0 4px;"
            class="furn-del-btn" data-idx="${i}">×</span>
    `;

    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('furn-del-btn')) return;
      _selectedFurnitureIdx = i;
      callbacks.onSelectFurniture(i);
      refreshFurnitureList(container, callbacks);
    });

    container.appendChild(row);
  }

  // 删除按钮事件
  container.querySelectorAll('.furn-del-btn').forEach(btn => {
    btn.addEventListener('click', function(this: HTMLElement) {
      const idx = parseInt(this.dataset.idx || '-1', 10);
      if (idx >= 0) {
        callbacks.onRemoveFurniture(idx);
      }
    });
  });
}

/** 更新选中索引 */
export function setSelectedFurnitureIdx(idx: number): void {
  _selectedFurnitureIdx = idx;
}

/** 获取选中索引 */
export function getSelectedFurnitureIdx(): number {
  return _selectedFurnitureIdx;
}

/** 刷新家具列表 */
export function refreshAdjustPanel(): void {
  const container = document.getElementById('adjust-furniture-list');
  if (!container) return;
  // Re-render with current callbacks ref — we need a way to get current callbacks
  // For now, just re-render when tab switches
}
