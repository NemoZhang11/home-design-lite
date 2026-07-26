// ============================================================
//  🏠 房间改造工具 — 侧边栏事件绑定
// ============================================================

import { state } from '../state/store';
import { FURNITURE_DEFS } from '../engine/constants';
import { setStatus } from './statusBar';
import { log } from '../engine/logger';

export interface SidebarCallbacks {
  onPlaceDoor: (wallIdx: number, t: number) => void;
  onPlaceWindow: (wallIdx: number, t: number) => void;
  onPlaceFurniture: (type: string, x: number, y: number) => void;
  onStartDragFromCatalog: (type: string) => void;
}

/** 绑定侧边栏事件 */
export function bindSidebarEvents(callbacks: SidebarCallbacks): void {
  // 建筑元素目录 (门/窗)
  document.querySelectorAll('#building-catalog .furniture-card').forEach(card => {
    card.addEventListener('click', function(this: HTMLElement) {
      if (state.mode !== 'draw') {
        setStatus('⚠️ 请先切换到「画户型」模式', 'idle');
        return;
      }
      const type = this.dataset.type;
      if (!type) return;

      // 切换行为：如果已激活同类型，则取消
      if ((type === 'door' && state.placingElementType === 'door') ||
          (type === 'window' && state.placingElementType === 'window')) {
        state.placingElementType = null;
        document.querySelectorAll('#building-catalog .furniture-card').forEach(c => c.classList.remove('placing-active'));
        setStatus('已退出放置模式', 'idle');
        log('取消放置模式', { type });
        return;
      }

      state.placingElementType = type as 'door' | 'window';
      document.querySelectorAll('#building-catalog .furniture-card').forEach(c => c.classList.remove('placing-active'));
      this.classList.add('placing-active');

      if (type === 'door') {
        setStatus('点击墙放置门 — Esc 退出', 'placing');
        log('点击墙放置门');
      } else if (type === 'window') {
        setStatus('点击墙放置窗户 — Esc 退出', 'placing');
        log('点击墙放置窗户');
      }
    });
  });

  // 家具目录
  document.querySelectorAll('#furniture-catalog .furniture-card').forEach(card => {
    card.addEventListener('click', function(this: HTMLElement) {
      if (state.mode !== 'place') {
        setStatus('⚠️ 请先切换到「放家具」模式', 'idle');
        return;
      }
      const type = this.dataset.type;
      if (!type) return;
      startDragFromCatalog(type, callbacks);
    });

    card.addEventListener('dragstart', function(this: HTMLElement, e: Event) {
      if (state.mode !== 'place') {
        e.preventDefault();
        return;
      }
      const type = this.dataset.type;
      if (!type) return;
      const dt = (e as DragEvent).dataTransfer;
      if (dt) {
        dt.setData('text/plain', type);
        dt.effectAllowed = 'copy';
      }
    });
  });
}

/** 从目录拖拽放置 */
function startDragFromCatalog(type: string, callbacks: SidebarCallbacks): void {
  state.dragFurnitureType = type;
  const def = FURNITURE_DEFS[type];
  if (def) {
    setStatus(`点击画布放置 ${def.label}，或拖拽目录卡片到画布`, 'placing');
  }
}
