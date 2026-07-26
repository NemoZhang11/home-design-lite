// ============================================================
//  🏠 房间改造工具 — 常量与配置
// ============================================================

import type { FurnitureDef } from './types';

export const GRID_SIZE = 10;           // 网格大小 (px) — 10px = 10cm
export const MAJOR_GRID_INTERVAL = 10; // 每10格一条主网格线 (100px = 1m)
export const WALL_THICKNESS = 12;      // 墙线粗细 (cm)
export const WALL_COLOR = '#7f8c8d';   // 墙线颜色
export const WALL_SELECTED_COLOR = '#3498db'; // 选中墙颜色
export const WALL_CLOSE_RADIUS = 15;   // 闭合检测半径 (px)
export const FURNITURE_GAP = 20;       // 家具间距 (px/cm)
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const SCALE = 1;                // 1px = 1cm
export const HANDLE_RADIUS = 5;        // 拖拽手柄半径
export const DOOR_DEFAULT_WIDTH = 80;  // 门默认宽度 (cm)
export const WINDOW_DEFAULT_WIDTH = 100; // 窗默认宽度 (cm)
export const MIN_DOOR_WIDTH = 40;
export const MAX_DOOR_WIDTH = 200;
export const MIN_WINDOW_WIDTH = 40;
export const MAX_WINDOW_WIDTH = 200;

// 门/窗视觉常量 (比墙更突出)
export const DOOR_FILL = '#C0392B';
export const DOOR_ARC_FILL = 'rgba(192, 57, 43, 0.2)';
export const DOOR_BODY_HEIGHT = 20;
export const WINDOW_FRAME_FILL = '#85C1E9';
export const WINDOW_FRAME_HEIGHT = 20;

// 家具定义: 类型 → { 颜色, 宽, 高, 中文名 }
export const FURNITURE_DEFS: Record<string, FurnitureDef> = {
  bed:      { color: '#E8D5B7', w: 160, h: 200, label: '床' },
  desk:     { color: '#C4A882', w: 120, h: 60,  label: '书桌' },
  wardrobe: { color: '#A8D8EA', w: 100, h: 60,  label: '衣柜' },
  chair:    { color: '#B5EAD7', w: 40,  h: 40,  label: '椅子' },
  sofa:     { color: '#FFD3B6', w: 180, h: 80,  label: '沙发' },
};
