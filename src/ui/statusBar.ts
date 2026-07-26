// ============================================================
//  🏠 房间改造工具 — 状态栏
// ============================================================

/** 设置状态栏 */
export function setStatus(text: string, dotClass: string = 'idle'): void {
  const textEl = document.getElementById('status-text');
  const dot = document.getElementById('status-dot');
  if (textEl) textEl.textContent = text;
  if (dot) {
    dot.className = 'status-dot ' + dotClass;
  }
}
