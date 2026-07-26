// ============================================================
//  🏠 房间改造工具 — TypeScript 类型定义
// ============================================================

import type Konva from 'konva';

export interface Point {
  x: number;
  y: number;
}

export interface WallSegment {
  id: number;
  p1: Point;
  p2: Point;
  angle: number;
  length: number;
  wallIdx: number;
  group?: Konva.Group;
}

export interface Door {
  id: number;
  wallIdx: number;
  t: number;
  width: number;
  swingInward: boolean;
  hingeSide: 'left' | 'right';
  hingeX: number;
  hingeY: number;
}

export interface Window {
  id: number;
  wallIdx: number;
  t: number;
  width: number;
}

export interface FurnitureItem {
  type: string;
  x: number;
  y: number;
  rotation: number;
}

export interface FurnitureDef {
  color: string;
  w: number;
  h: number;
  label: string;
}

export type EditorMode = 'draw' | 'place' | 'layout';

export interface PlacedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PointToSegmentResult {
  dist: number;
  t: number;
  projX: number;
  projY: number;
}

export interface NearestWallResult {
  idx: number;
  t: number;
  dist: number;
  projX: number;
  projY: number;
}

export interface DoorData {
  id: number;
  wallIdx: number;
  t: number;
  width: number;
  swingInward: boolean;
  hingeSide: 'left' | 'right';
}

export interface WindowData {
  id: number;
  wallIdx: number;
  t: number;
  width: number;
}
