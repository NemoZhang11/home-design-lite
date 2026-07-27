// ============================================================
//  🏠 房间改造工具 — Step 2: 家具选择面板
// ============================================================

import { state, saveToStorage } from '../state/store';
import { FURNITURE_DEFS } from '../engine/constants';
import { setStatus, setStatusForTab } from './statusBar';
import { setActiveTab } from './stepPanel';

const FURNITURE_ORDER = ['bed', 'desk', 'wardrobe', 'chair', 'sofa'] as const;

const FURNITURE_EMOJI: Record<string, string> = {
  bed: '🛏️',
  desk: '📝',
  wardrobe: '🗄️',
  chair: '💺',
  sofa: '🛋️',
};

export interface Step2Callbacks {
  onLayout: () => void;
}

/** 渲染 Step 2 面板 */
export function renderStep2Panel(container: HTMLElement, callbacks: Step2Callbacks): void {
  container.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'panel-section-title';
  title.textContent = '需要哪些家具？选好自动排进房间';
  container.appendChild(title);

  // 家具选择卡片
  for (const type of FURNITURE_ORDER) {
    const def = FURNITURE_DEFS[type];
    if (!def) continue;

    const card = document.createElement('div');
    card.className = 'furniture-select-card';

    // 左侧: 信息
    const info = document.createElement('div');
    info.className = 'furn-info';
    info.innerHTML = `
      <span class="furn-emoji">${FURNITURE_EMOJI[type] || ''}</span>
      <span class="furn-name">${def.label}</span>
      <span class="furn-size">${def.w}×${def.h}</span>
    `;
    card.appendChild(info);

    // 右侧: 数量控件
    const qtyControl = document.createElement('div');
    qtyControl.className = 'qty-control';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'qty-btn';
    minusBtn.textContent = '−';
    minusBtn.addEventListener('click', () => {
      changeQuantity(type, -1);
    });
    qtyControl.appendChild(minusBtn);

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'qty-input';
    qtyInput.min = '0';
    qtyInput.max = '99';
    qtyInput.value = String(state.furnitureQuantities[type] || 0);
    qtyInput.addEventListener('input', () => {
      let val = parseInt(qtyInput.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(99, val));
      state.furnitureQuantities[type] = val;
      updateSummary();
      updateLayoutButton(callbacks);
    });
    qtyInput.addEventListener('blur', () => {
      qtyInput.value = String(state.furnitureQuantities[type] || 0);
      saveToStorage();
    });
    qtyControl.appendChild(qtyInput);

    const plusBtn = document.createElement('button');
    plusBtn.className = 'qty-btn';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      changeQuantity(type, 1);
    });
    qtyControl.appendChild(plusBtn);

    card.appendChild(qtyControl);
    container.appendChild(card);
  }

  // ---- 选择汇总 ----
  const summary = document.createElement('div');
  summary.className = 'furniture-summary';
  summary.id = 'furniture-summary';
  container.appendChild(summary);
  updateSummary();

  // 操作按钮
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; flex-direction:column; gap:6px;';

  const layoutBtn = document.createElement('button');
  layoutBtn.className = 'action-btn primary full-width';
  layoutBtn.id = 'btn-do-layout';
  layoutBtn.textContent = '✨ 排一下';
  layoutBtn.addEventListener('click', () => {
    callbacks.onLayout();
    setActiveTab('layout');
  });
  btnRow.appendChild(layoutBtn);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'action-btn full-width';
  clearBtn.textContent = '清空选择';
  clearBtn.addEventListener('click', () => {
    for (const type of FURNITURE_ORDER) {
      state.furnitureQuantities[type] = 0;
    }
    container.querySelectorAll('.qty-input').forEach(inp => {
      (inp as HTMLInputElement).value = '0';
    });
    updateSummary();
    updateLayoutButton(callbacks);
    saveToStorage();
  });
  btnRow.appendChild(clearBtn);

  container.appendChild(btnRow);
  updateLayoutButton(callbacks);
}

function changeQuantity(type: string, delta: number): void {
  const current = state.furnitureQuantities[type] || 0;
  state.furnitureQuantities[type] = Math.max(0, Math.min(99, current + delta));
  // 更新输入框
  const inputs = document.querySelectorAll('.qty-input');
  const cards = document.querySelectorAll('.furniture-select-card');
  const keys = FURNITURE_ORDER;
  for (let i = 0; i < Math.min(cards.length, keys.length); i++) {
    if (keys[i] === type) {
      (inputs[i] as HTMLInputElement).value = String(state.furnitureQuantities[type]);
      break;
    }
  }
  updateSummary();
  saveToStorage();
}

function updateSummary(): void {
  const summary = document.getElementById('furniture-summary');
  if (!summary) return;
  const parts: string[] = [];
  for (const type of FURNITURE_ORDER) {
    const qty = state.furnitureQuantities[type] || 0;
    if (qty > 0) {
      const def = FURNITURE_DEFS[type];
      parts.push(`${def?.label || type}×${qty}`);
    }
  }
  summary.textContent = parts.length > 0 ? `已选: ${parts.join(' ')}` : '已选: —';
}

function updateLayoutButton(callbacks: Step2Callbacks): void {
  const btn = document.getElementById('btn-do-layout');
  if (!btn) return;
  const hasSelected = Object.values(state.furnitureQuantities).some(v => v > 0);
  (btn as HTMLButtonElement).disabled = !hasSelected;
  // Update button text to show count
  const total = Object.values(state.furnitureQuantities).reduce((a, b) => a + b, 0);
  btn.textContent = `✨ 排一下${total > 0 ? ` (${total}件)` : ''}`;
}

/** 获取选中的家具列表 (用于布局) */
export function getSelectedFurniture(): Array<{ type: string }> {
  const result: Array<{ type: string }> = [];
  for (const type of FURNITURE_ORDER) {
    const qty = state.furnitureQuantities[type] || 0;
    for (let i = 0; i < qty; i++) {
      result.push({ type });
    }
  }
  return result;
}
