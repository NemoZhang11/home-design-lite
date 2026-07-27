// ============================================================
//  🏠 房间改造工具 — 标签面板管理
// ============================================================

import { state } from '../state/store';
import type { ActiveTab } from '../state/store';
import { setStatusForTab } from './statusBar';

const TAB_CLASS_MAP: Record<ActiveTab, string> = {
  room: '🏠 房间设置',
  furniture: '🪑 选择家具',
  layout: '✨ 布局方案',
  adjust: '✋ 微调',
};

/** 设置当前标签页 (切换到指定标签) */
export function setActiveTab(tab: ActiveTab): void {
  state.activeTab = tab;

  // 更新顶栏按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const btnTab = (btn as HTMLElement).dataset.tab;
    if (btnTab === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 切换侧边栏面板: 显示对应面板，隐藏其他
  const hasRoom = state.isClosed && state.wallPoints.length >= 3;

  if (!hasRoom && tab !== 'room') {
    // 无房间时，非房间标签显示引导
    showPanel('no-room');
  } else {
    showPanel(tab);
  }

  // 更新状态栏上下文
  setStatusForTab(tab);

  // 更新家具可拖拽性
  const isAdjust = tab === 'adjust';
  // furnitureLayer 的 draggable 在 main.ts 中通过查询模式控制，这里不改
}

/** 显示指定面板，隐藏其他 */
function showPanel(tab: ActiveTab | 'no-room'): void {
  const panels = ['room', 'furniture', 'layout', 'adjust', 'no-room'] as const;
  for (const p of panels) {
    const el = document.getElementById(`panel-${p}`);
    if (el) el.style.display = p === tab ? 'flex' : 'none';
  }
}

/** 获取当前标签 */
export function getActiveTab(): ActiveTab {
  return state.activeTab;
}

/** 检查是否需要显示无房间引导 */
export function roomExists(): boolean {
  return state.isClosed && state.wallPoints.length >= 3;
}

/** 初始化标签事件 */
export function initStepPanel(): void {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function(this: HTMLElement) {
      const tab = this.dataset.tab as ActiveTab;
      if (tab) setActiveTab(tab);
    });
  });
}
