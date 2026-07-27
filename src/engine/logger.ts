// ============================================================
//  🏠 房间改造工具 — 日志系统
// ============================================================

const LOG_PREFIX = '[房间改造工具]';

export function log(msg: string, data?: unknown): void {
  const ts = new Date().toISOString().slice(11, 23);
  const fullMsg = `${LOG_PREFIX} ${ts} ${msg}`;
  if (data !== undefined) {
    console.log(fullMsg, data);
  } else {
    console.log(fullMsg);
  }
  // 同时追加到应用内日志面板
  const entries = document.getElementById('log-entries');
  if (entries) {
    const line = document.createElement('div');
    line.textContent = data ? `${fullMsg} ${JSON.stringify(data)}` : fullMsg;
    entries.prepend(line);
    if (entries.children.length > 50) entries.lastChild?.remove();
  }
}
