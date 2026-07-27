// ============================================================
//  🏠 房间改造工具 — Step 1: 房间设置面板
// ============================================================

import { state, pushUndo, saveToStorage, clearStorage } from '../state/store';
import { DOOR_DEFAULT_WIDTH, WINDOW_DEFAULT_WIDTH } from '../engine/constants';
import { createRoomFromDimensions } from '../engine/walls';
import { setStatus, setStatusForTab } from './statusBar';
import { log } from '../engine/logger';

interface RoomTemplate {
  emoji: string;
  name: string;
  size: string;
  width: number;
  height: number;
  furniture: Array<{ type: string; x: number; y: number }>;
}

const TEMPLATES: RoomTemplate[] = [
  { emoji: '👶', name: '儿童房', size: '4×3m', width: 400, height: 300, furniture: [
    { type: 'bed', x: 240, y: 200 }, { type: 'desk', x: 500, y: 170 },
    { type: 'wardrobe', x: 240, y: 400 }, { type: 'chair', x: 520, y: 250 },
  ]},
  { emoji: '🛏️', name: '主卧', size: '5×4m', width: 500, height: 400, furniture: [
    { type: 'bed', x: 240, y: 200 }, { type: 'wardrobe', x: 600, y: 200 },
    { type: 'desk', x: 240, y: 480 }, { type: 'chair', x: 280, y: 500 },
    { type: 'sofa', x: 600, y: 480 },
  ]},
  { emoji: '📚', name: '书房', size: '3×3m', width: 300, height: 300, furniture: [
    { type: 'desk', x: 250, y: 180 }, { type: 'chair', x: 260, y: 250 },
    { type: 'wardrobe', x: 200, y: 260 },
  ]},
  { emoji: '🛋️', name: '客厅', size: '6×4m', width: 600, height: 400, furniture: [
    { type: 'sofa', x: 300, y: 200 }, { type: 'desk', x: 500, y: 350 },
    { type: 'chair', x: 550, y: 380 }, { type: 'wardrobe', x: 200, y: 350 },
  ]},
];

export interface Step1Callbacks {
  onLoadTemplate: (width: number, height: number, furniture: Array<{ type: string; x: number; y: number }>) => void;
  onCreateRoom: (width: number, height: number) => void;
  onClearAll: () => void;
  onStartManualDraw: () => void;
  onPlaceDoor: () => void;
  onPlaceWindow: () => void;
}

/** 渲染 Step 1 面板内容 */
export function renderStep1Panel(container: HTMLElement, callbacks: Step1Callbacks): void {
  container.innerHTML = '';

  // ---- 快速开始 ----
  const quickSection = document.createElement('div');
  quickSection.className = 'panel-section';

  const quickTitle = document.createElement('div');
  quickTitle.className = 'panel-section-title';
  quickTitle.textContent = '快速开始';
  quickSection.appendChild(quickTitle);

  const grid = document.createElement('div');
  grid.className = 'template-grid';

  for (const tmpl of TEMPLATES) {
    const card = document.createElement('div');
    card.className = 'template-mini-card';
    card.innerHTML = `
      <span class="mini-emoji">${tmpl.emoji}</span>
      <span class="mini-name">${tmpl.name}</span>
      <span class="mini-size">${tmpl.size}</span>
    `;
    card.addEventListener('click', () => {
      if (state.isClosed && state.wallPoints.length >= 3) {
        if (!confirm('当前房间将被替换，确定吗？')) return;
      }
      callbacks.onLoadTemplate(tmpl.width, tmpl.height, tmpl.furniture);
    });
    grid.appendChild(card);
  }
  quickSection.appendChild(grid);
  container.appendChild(quickSection);

  // ---- 自定义尺寸 ----
  const customSection = document.createElement('div');
  customSection.className = 'panel-section';

  const customTitle = document.createElement('div');
  customTitle.className = 'panel-section-title';
  customTitle.textContent = '✏️ 自定义尺寸';
  customSection.appendChild(customTitle);

  const dimRow = document.createElement('div');
  dimRow.className = 'dim-input-row';
  dimRow.innerHTML = `
    <span>宽</span>
    <input type="number" id="custom-room-w" min="10" max="5000" step="10" value="400">
    <span>长</span>
    <input type="number" id="custom-room-h" min="10" max="5000" step="10" value="300">
    <span>cm</span>
  `;
  customSection.appendChild(dimRow);

  const createBtn = document.createElement('button');
  createBtn.className = 'action-btn primary full-width';
  createBtn.textContent = '创建房间';
  createBtn.addEventListener('click', () => {
    const wInput = document.getElementById('custom-room-w') as HTMLInputElement;
    const hInput = document.getElementById('custom-room-h') as HTMLInputElement;
    const w = parseInt(wInput?.value || '', 10);
    const h = parseInt(hInput?.value || '', 10);
    if (isNaN(w) || isNaN(h) || w < 20 || h < 20) {
      setStatus('⚠️ 请输入有效的房间尺寸 (≥20cm)', 'idle');
      return;
    }
    if (w * h < 40000) {
      setStatus('⚠️ 建议至少 2×2m (40000cm²)', 'idle');
      return;
    }
    if (state.isClosed && state.wallPoints.length >= 3) {
      if (!confirm('当前房间将被替换，确定吗？')) return;
    }
    callbacks.onCreateRoom(w, h);
  });
  customSection.appendChild(createBtn);
  container.appendChild(customSection);

  // ---- 当前房间 ----
  const infoSection = document.createElement('div');
  infoSection.className = 'panel-section';
  infoSection.id = 'room-info-section';
  infoSection.style.display = state.isClosed ? 'block' : 'none';

  const infoTitle = document.createElement('div');
  infoTitle.className = 'panel-section-title';
  infoTitle.textContent = '当前房间';
  infoSection.appendChild(infoTitle);

  const infoLine = document.createElement('div');
  infoLine.className = 'room-info';
  infoLine.id = 'room-info-line';
  infoSection.appendChild(infoLine);

  // 重置房间
  const resetBtn = document.createElement('button');
  resetBtn.className = 'action-btn full-width';
  resetBtn.textContent = '重置房间';
  resetBtn.addEventListener('click', () => {
    if (!confirm('确定要清除当前房间吗？')) return;
    callbacks.onClearAll();
  });
  infoSection.appendChild(resetBtn);

  container.appendChild(infoSection);

  // ---- 门/窗快速入口 ----
  const dwSection = document.createElement('div');
  dwSection.className = 'panel-section';
  dwSection.id = 'dw-section';
  dwSection.style.display = state.isClosed ? 'block' : 'none';

  const dwBtnRow = document.createElement('div');
  dwBtnRow.style.cssText = 'display:flex; gap:6px;';

  const doorBtn = document.createElement('button');
  doorBtn.className = 'action-btn';
  doorBtn.style.cssText = 'flex:1;';
  doorBtn.textContent = '🚪 添加门';
  doorBtn.addEventListener('click', () => callbacks.onPlaceDoor());
  dwBtnRow.appendChild(doorBtn);

  const winBtn = document.createElement('button');
  winBtn.className = 'action-btn';
  winBtn.style.cssText = 'flex:1;';
  winBtn.textContent = '🪟 添加窗';
  winBtn.addEventListener('click', () => callbacks.onPlaceWindow());
  dwBtnRow.appendChild(winBtn);

  dwSection.appendChild(dwBtnRow);
  container.appendChild(dwSection);

  // ---- 手动绘制 ----
  const drawBtn = document.createElement('button');
  drawBtn.className = 'action-btn full-width';
  drawBtn.textContent = '✏️ 手动绘制墙线';
  drawBtn.addEventListener('click', () => callbacks.onStartManualDraw());
  container.appendChild(drawBtn);

  // 初始化信息行
  updateRoomInfo();
}

/** 更新房间信息行 */
export function updateRoomInfo(): void {
  const infoLine = document.getElementById('room-info-line');
  const infoSection = document.getElementById('room-info-section');
  const dwSection = document.getElementById('dw-section');

  if (infoSection) {
    infoSection.style.display = state.isClosed ? 'block' : 'none';
  }
  if (dwSection) {
    dwSection.style.display = state.isClosed ? 'block' : 'none';
  }

  if (infoLine && state.isClosed && state.wallPoints.length >= 3) {
    const pts = state.wallPoints;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    const w = Math.round(maxX - minX);
    const h = Math.round(maxY - minY);
    const dc = state.doors.length;
    const wc = state.windows.length;
    infoLine.textContent = `${w}×${h} cm | 门×${dc} 窗×${wc}`;
  }
}
