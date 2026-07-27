// ============================================================
//  🏠 房间改造工具 — Step 3: 布局方案面板
// ============================================================

import { state, pushUndo, saveToStorage } from '../state/store';
import { setStatus, setStatusForTab } from './statusBar';
import { setActiveTab } from './stepPanel';
import { getSelectedFurniture } from './step2Furniture';

interface SchemeInfo {
  id: string;
  name: string;
  desc: string;
  recommended: boolean;
  meta: string;
}

const SCHEMES: SchemeInfo[] = [
  {
    id: 'A',
    name: '方案A ★推荐',
    desc: '家具贴墙放，中间宽敞',
    recommended: true,
    meta: '✓ 通道 65cm  ✓ 床不靠窗',
  },
  {
    id: 'B',
    name: '方案B',
    desc: '分区布局，动静分离',
    recommended: false,
    meta: '✓ 通道 72cm  ⚠ 衣柜贴窗边',
  },
];

// 保存多个方案结果
interface SchemeSnapshot {
  schemeId: string;
  furniture: Array<{ type: string; x: number; y: number; rotation: number }>;
}

let _schemeResults: SchemeSnapshot[] = [];
let _currentSchemeIdx = 0;

export interface Step3Callbacks {
  onApplyScheme: (idx: number) => void;
  onRelayout: () => void;
  onRestoreDefault: () => void;
}

/** 渲染 Step 3 面板 */
export function renderStep3Panel(container: HTMLElement, callbacks: Step3Callbacks): void {
  container.innerHTML = '';

  refreshSchemeCards(container, callbacks);

  // 操作按钮
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:8px;';

  const relayoutBtn = document.createElement('button');
  relayoutBtn.className = 'action-btn full-width';
  relayoutBtn.textContent = '🔄 重新排一下';
  relayoutBtn.addEventListener('click', () => callbacks.onRelayout());
  btnRow.appendChild(relayoutBtn);

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'action-btn full-width';
  restoreBtn.textContent = '↺ 恢复默认';
  restoreBtn.addEventListener('click', () => callbacks.onRestoreDefault());
  btnRow.appendChild(restoreBtn);

  // 返回选择家具
  const backLink = document.createElement('a');
  backLink.style.cssText = 'font-size:12px; color:#3498db; cursor:pointer; text-align:center; margin-top:8px;';
  backLink.textContent = '← 回去调家具';
  backLink.addEventListener('click', (e) => { e.preventDefault(); setActiveTab('furniture'); });
  btnRow.appendChild(backLink);

  container.appendChild(btnRow);
}

function refreshSchemeCards(container: HTMLElement, callbacks: Step3Callbacks): void {
  // 移除旧卡片
  const oldCards = container.querySelectorAll('.scheme-card');
  oldCards.forEach(c => c.remove());

  for (let i = 0; i < SCHEMES.length; i++) {
    const scheme = SCHEMES[i]!;
    const card = document.createElement('div');
    card.className = 'scheme-card' + (i === _currentSchemeIdx ? ' selected' : '');

    const nameSpan = document.createElement('div');
    nameSpan.className = 'scheme-name';
    nameSpan.textContent = scheme.name;
    if (scheme.recommended) {
      const recBadge = document.createElement('span');
      recBadge.className = 'scheme-recommended';
      recBadge.textContent = '推荐';
      nameSpan.appendChild(recBadge);
    }
    card.appendChild(nameSpan);

    const descSpan = document.createElement('div');
    descSpan.className = 'scheme-desc';
    descSpan.textContent = scheme.desc;
    card.appendChild(descSpan);

    const metaSpan = document.createElement('div');
    metaSpan.className = 'scheme-meta';
    metaSpan.textContent = scheme.meta;
    card.appendChild(metaSpan);

    card.addEventListener('click', () => {
      _currentSchemeIdx = i;
      callbacks.onApplyScheme(i);
      refreshSchemeCards(container, callbacks);
    });

    container.insertBefore(card, container.querySelector('.scheme-card') || container.firstChild);
  }
}

/** 存储方案结果 */
export function setSchemeResults(results: SchemeSnapshot[]): void {
  _schemeResults = results;
  _currentSchemeIdx = 0;
}

/** 获取当前方案 */
export function getCurrentScheme(): SchemeSnapshot | undefined {
  return _schemeResults[_currentSchemeIdx];
}

/** 获取当前方案索引 */
export function getCurrentSchemeIdx(): number {
  return _currentSchemeIdx;
}

/** 获取方案数量 */
export function getSchemeCount(): number {
  return SCHEMES.length;
}

// ---- 键盘导航 ----
export function initSchemeKeyboardNav(callbacks: Step3Callbacks): void {
  document.addEventListener('keydown', function(e: KeyboardEvent) {
    if (state.activeTab !== 'layout') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (e.key === 'ArrowLeft') {
        _currentSchemeIdx = Math.max(0, _currentSchemeIdx - 1);
      } else {
        _currentSchemeIdx = Math.min(SCHEMES.length - 1, _currentSchemeIdx + 1);
      }
      callbacks.onApplyScheme(_currentSchemeIdx);
      const container = document.getElementById('panel-layout')!;
      refreshSchemeCards(container, callbacks);
    }
  });
}
