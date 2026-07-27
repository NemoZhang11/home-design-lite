// ============================================================
//  🏠 房间改造工具 — 状态栏 (12种上下文消息)
// ============================================================

import { state } from '../state/store';
import type { ActiveTab } from '../state/store';

type StatusContext =
  | 'no-room'
  | 'room-created'
  | 'drawing-walls'
  | 'placing-door-window'
  | 'selecting-furniture'
  | 'furniture-selected'
  | 'browsing-layouts'
  | 'adjusting'
  | 'placing-furniture'
  | 'collision'
  | 'idle';

const MESSAGES: Record<StatusContext, string> = {
  'no-room': '选择一个模板开始，或自定义房间尺寸',
  'room-created': '双击墙面添加门窗，或切换到「选择家具」',
  'drawing-walls': '点击画布放置墙点，点击起点闭合房间',
  'placing-door-window': '点击墙面放置，Esc 退出',
  'selecting-furniture': '点击 [+] 选择需要的家具',
  'furniture-selected': '✨ 排一下 生成布局方案',
  'browsing-layouts': '← → 切换方案，满意后进入微调',
  'adjusting': '拖拽移动家具，滚轮缩放',
  'placing-furniture': '点击画布放置家具，Esc 取消',
  'collision': '家具重叠了，已自动调整位置',
  'idle': '选择一个模板开始，或自定义房间尺寸',
};

/** 设置状态栏文本 */
export function setStatus(text: string, dotClass: string = 'idle'): void {
  const textEl = document.getElementById('status-text');
  const dot = document.getElementById('status-dot');
  if (textEl) textEl.textContent = text;
  if (dot) {
    dot.className = 'status-dot ' + dotClass;
  }
}

/** 根据当前标签和上下文设置状态栏 */
export function setStatusForTab(tab: ActiveTab): void {
  const hasRoom = state.isClosed && state.wallPoints.length >= 3;

  if (!hasRoom) {
    setStatus(MESSAGES['no-room'], 'idle');
    return;
  }

  if (state.placingElementType) {
    setStatus(MESSAGES['placing-door-window'], 'placing');
    return;
  }

  if (state.isDrawing) {
    setStatus(MESSAGES['drawing-walls'], 'drawing');
    return;
  }

  switch (tab) {
    case 'room':
      setStatus(MESSAGES['room-created'], 'idle');
      break;
    case 'furniture':
      const hasSelected = Object.values(state.furnitureQuantities).some(v => v > 0);
      setStatus(
        hasSelected ? MESSAGES['furniture-selected'] : MESSAGES['selecting-furniture'],
        'idle'
      );
      break;
    case 'layout':
      setStatus(MESSAGES['browsing-layouts'], 'idle');
      break;
    case 'adjust':
      setStatus(MESSAGES['adjusting'], 'idle');
      break;
  }
}

/** 设置碰撞状态 (临时) */
export function setCollisionStatus(): void {
  setStatus(MESSAGES['collision'], 'drawing');
}

/** 设置放置家具状态 */
export function setPlacingFurnitureStatus(): void {
  setStatus(MESSAGES['placing-furniture'], 'placing');
}

/** 初始化快捷键提示按钮 */
export function initShortcutHint(): void {
  const hint = document.getElementById('shortcut-hint');
  const modal = document.getElementById('modal-shortcuts');
  const closeBtn = document.getElementById('btn-shortcuts-close');

  if (hint && modal) {
    hint.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (modal) {
    modal.addEventListener('click', function(e: MouseEvent) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
}
