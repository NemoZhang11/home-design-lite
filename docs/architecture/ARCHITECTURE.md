# 架构设计文档

> 版本: 1.0 | 更新: 2026-07-26 | 项目: home-design-lite

---

## 一、技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言 | TypeScript | 5.7 | strict 模式，零 `any` |
| Canvas 渲染 | Konva.js | 9.3 (npm) | 5 层 Canvas 2D 渲染 |
| 构建 | Vite | 6.0 | 零配置打包，HMR 开发服务器 |
| 单元测试 | Vitest | 4.1 | 63 个纯函数用例，386ms 跑完 |
| E2E 测试 | Playwright (Node) | 1.62 | 28 个浏览器交互用例 |
| 部署 | GitHub Pages | — | gh-pages 分支自动部署 |
| 包管理 | npm | — | ESM 模块 |

**不引入的依赖**：React、Zustand、后端服务器。保持零框架，降低复杂度。

---

## 二、目录结构

```
home-design-tool/
├── index.html                    # Vite 入口 HTML
├── package.json                  # 依赖与脚本
├── tsconfig.json                 # TypeScript strict 配置
├── vite.config.ts                # Vite 构建配置（含 GitHub Pages base）
├── vitest.config.ts              # 单元测试配置
├── vercel.json                   # Vercel 备选部署（当前不用）
├── .github/workflows/deploy.yml  # GitHub Actions 自动部署
├── public/favicon.svg            # SVG 图标
│
├── src/
│   ├── main.ts                   # 主入口：Konva 初始化 + 事件绑定 + 业务编排
│   │
│   ├── engine/                   # 🧠 引擎层 — 纯函数，零 Konva/DOM 依赖
│   │   ├── types.ts              #   所有 TypeScript 接口定义
│   │   ├── constants.ts          #   配置常量 + 家具定义
│   │   ├── logger.ts             #   日志系统（带时间戳）
│   │   ├── geometry.ts           #   几何运算（距离、角度、吸附、投影）
│   │   ├── walls.ts              #   墙段构造逻辑
│   │   ├── openings.ts           #   门/窗数据创建与重建
│   │   ├── layout.ts             #   智能布局算法（贪心 + 碰撞检测）
│   │   ├── geometry.test.ts      #   15 个单元测试
│   │   ├── walls.test.ts         #    9 个单元测试
│   │   ├── openings.test.ts      #   12 个单元测试
│   │   └── layout.test.ts        #   27 个单元测试
│   │
│   ├── state/
│   │   └── store.ts              # 📦 状态层 — 全局可变状态 + 撤销栈
│   │
│   ├── renderer/                 # 🎨 渲染层 — Konva 绘制逻辑
│   │   ├── gridLayer.ts          #   网格渲染（可开关）
│   │   ├── wallLayer.ts          #   墙段 + 多边形填充 + 选中手柄
│   │   ├── furnitureLayer.ts     #   家具渲染（拖拽、双击删除）
│   │   ├── doorLayer.ts          #   门/窗渲染 + 选中手柄 + 弧度绘制
│   │   └── previewLayer.ts       #   放置预览幽灵
│   │
│   ├── ui/                       # 🖥️ UI 层 — DOM 事件绑定
│   │   ├── toolbar.ts            #   模式切换 / 撤销重做 / 清除 / 网格 / 房间创建
│   │   ├── sidebar.ts            #   家具目录 / 建筑元素目录点击与拖拽
│   │   └── statusBar.ts          #   状态栏更新
│   │
│   └── styles/
│       └── main.css              # 全局样式（~170 行）
│
├── demo/
│   └── index.html                # 极简原型（2535 行单文件，保留参考）
│
├── test/
│   ├── test.js                   # Playwright E2E 脚本
│   └── test-results.txt          # 最后一次测试结果
│
├── docs/
│   ├── architecture/
│   │   └── ARCHITECTURE.md       # 本文件
│   └── 产品需求和项目管理/         # 产品文档
│       ├── 产品定位与路线图.md
│       ├── 核心功能与交互流程.md
│       └── 风险评估报告.md
│
└── dist/                         # 构建产物（gitignore）
```

---

## 三、分层架构

```
┌────────────────────────────────────────────────────┐
│                     main.ts                        │
│         业务编排：初始化 → 事件绑定 → 启动         │
└────┬──────────────┬──────────────┬────────────────┘
     │ import       │ import       │ import
     ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│   ui/    │  │renderer/ │  │  state/  │
│ DOM 事件  │  │ Konva 绘制│  │ 全局状态  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
     │    调用       │    读取       │    读取/写入
     ▼              ▼              ▼
     ┌──────────────────────────────┐
     │         engine/ 🧠           │
     │  纯 TypeScript 函数           │
     │  零 Konva / 零 DOM           │
     │                              │
     │  geometry  walls  openings   │
     │  layout    types   constants │
     │  logger                      │
     └──────────────────────────────┘
```

**核心原则**：

1. **engine/ 是纯函数层** — 输入数据，输出数据，无副作用。可直接用 Vitest 单元测试，无需浏览器。
2. **state/ 是单例可变状态** — 持有所有运行时数据，提供 `pushUndo()` / `popUndo()` 操作。
3. **renderer/ 是视图层** — 把 engine 的纯计算结果渲染为 Konva 图形对象。
4. **ui/ 是控制层** — 绑定 DOM 事件，调用 engine 计算，更新 state，触发 renderer 重绘。
5. **main.ts 是编排层** — 连接所有模块，初始化 stage，注册事件处理器。

---

## 四、数据流

### 典型交互流程（用户点击画布添加墙点）

```
用户点击画布
  │
  ▼
stage.on('click')                    ← main.ts 事件处理
  │
  ├─ snapToGrid(x, y)               ← engine/geometry.ts 纯函数
  ├─ dist(newPt, firstPt) < radius  ← engine/geometry.ts 碰撞检测
  │
  ▼
pushUndo()                           ← state/store.ts 记录快照
state.wallPoints.push(newPt)         ← state/store.ts 更新数据
  │
  ▼
rebuildWallSegmentsFull()            ← main.ts 业务编排
  ├─ rebuildWallSegments(pts)        ← engine/walls.ts 计算墙段
  ├─ renderSingleWallSegment(seg)    ← main.ts → Konva 渲染
  └─ rebuildDoorsAndWindowsFull()    ← main.ts 重建门/窗
```

### 门/窗放置流程

```
用户点击门图标
  │
  ▼
bindSidebarEvents()                  ← ui/sidebar.ts
  ├─ state.placingElementType = 'door'
  │
  ▼
stage.on('mousemove')               ← main.ts
  ├─ findNearestWall(x, y)          ← engine/geometry.ts
  └─ showPreviewGhost(...)          ← renderer/previewLayer.ts 蓝色半透明预览
  │
  ▼
用户点击墙上某位置
  │
  ▼
stage.on('click')
  ├─ createDoorFull(wallIdx, t)     ← main.ts
  │   ├─ state.doors.push({...})    ← 记录数据
  │   ├─ renderDoor(...)            ← renderer/doorLayer.ts
  │   └─ rebuildWallSegmentsFull()  ← 显示墙段缺口
  └─ setStatus('门已放置')          ← ui/statusBar.ts
```

---

## 五、关键算法

### 5.1 墙段闭合检测

用户点击位置与第一个墙点距离 < `WALL_CLOSE_RADIUS (15px)` 时触发闭合。闭合后最后一个点复制第一个点坐标，`isClosed = true`。

### 5.2 门/窗吸附到墙

`findNearestWall(px, py, segments)` 遍历所有墙段，调用 `pointToSegmentDist()` 计算点到线段投影：
- 返回最近墙段索引 `idx`
- 投影参数 `t`（0~1，沿墙位置比例）
- 垂直距离 `dist`

放置时检查 `dist < 30px` 才允许放置。拖拽时 `dragmove` 事件持续调用 `findNearestWall`，将门/窗沿墙滑动。

### 5.3 智能布局算法

贪心策略，按家具优先级依次放置：

1. 计算房间包围盒（minX, minY, maxX, maxY）
2. 对每件家具，沿四边生成候选位置（按 `GRID_SIZE=10px` 步进）
3. 去重后按顺序检查：**在房间内** + **不与已放置家具碰撞**
4. 第一个满足的位置即选中
5. 若无候选，回退到房间中心纵向堆叠

碰撞检测：矩形 AABB 加上 `FURNITURE_GAP=20px` 的安全间距。

### 5.4 撤销/重做

每次修改前调用 `pushUndo()`，将当前 `wallPoints` 深拷贝存入 `undoStack`（最多 100 层）。Ctrl+Z 触发 `popUndo()` → 恢复 → 重建所有墙段和门/窗。

---

## 六、渲染管线

Konva Stage 包含 5 个 Layer，从下到上：

| 层级 | Layer | 功能 | 优化 |
|---|---|---|---|
| 1 | `gridLayer` | 网格背景 | `listening: false`，仅 `showGrid=true` 时绘制 |
| 2 | `wallLayer` | 墙段 + 房间填充 + 门 + 窗 | 主要交互层，处理 drag/click |
| 3 | `furnitureLayer` | 家具矩形 | `place` 模式可拖拽 |
| 4 | `overlayLayer` | 选中手柄 + 长度输入框 | 动态创建/销毁 |
| 5 | `previewLayer` | 门/窗放置预览幽灵 | mousemove 时更新，半透明 |

### 墙段渲染

每个墙段是一个 `Konva.Group`，包含：
- `Konva.Rect` — 墙主体（`WALL_THICKNESS=12px` 厚度）
- 2 × `Konva.Circle` — 端点圆（r=3）

Group 的 `x, y` 设为墙段中点，`rotation` 设为墙段角度。这样拖拽时 group 整体移动，内部形状坐标不变。

### 门渲染

一个 `Konva.Group` 包含：
- `Konva.Rect` — 门体（宽度 × 墙体厚度）
- `Konva.Circle` — 铰链点
- `Konva.Arc` — 开门方向弧线
- `Konva.Rect` — 拖拽调整宽度的手柄

### 窗户渲染

类似门，但增加了多条横线表示窗格。

---

## 七、状态管理

```typescript
interface EditorState {
  // 模式
  mode: EditorMode;                     // 'draw' | 'place' | 'layout'

  // 墙
  wallPoints: Point[];                  // 原始墙点（含闭合重复点）
  wallSegments: WallSegment[];          // 派生墙段（id, p1, p2, angle, length）
  isClosed: boolean;                    // 是否闭合
  selectedWallId: number | null;        // 当前选中墙段

  // 门/窗
  doors: Door[];                        // 已放置的门
  windows: Window[];                    // 已放置的窗户
  selectedElementId: number | null;     // 选中门/窗的 id
  selectedElementType: 'door' | 'window' | null;
  placingElementType: 'door' | 'window' | null;  // 放置模式

  // 家具
  furnitureItems: FurnitureItem[];      // 已放置的家具
  dragFurnitureType: string | null;     // 从目录拖拽中的家具类型

  // 撤销
  undoStack: Point[][];                 // 墙点快照栈（最多 100）
  redoStack: Point[][];

  // 计数器
  nextWallId: number;
  nextDoorId: number;
  nextWindowId: number;

  // 其他
  showGrid: boolean;
  isDrawing: boolean;
}
```

**设计决策**：
- 不使用 immutable 状态库 — 直接可变对象，`pushUndo` 时深拷贝快照
- 不使用 Zustand/Redux — 当前规模不需要响应式订阅，直接读取 `state.wallPoints` 即可
- 门/窗数据与 Konva 渲染分离：state 存纯数据，renderer 层管理 Konva Group 引用

---

## 八、测试策略

| 测试类型 | 框架 | 覆盖范围 | 用例数 |
|---|---|---|---|
| 单元测试 | Vitest | `engine/` 所有纯函数 | 63 |
| E2E 测试 | Playwright (Node) | 浏览器完整交互流程 | 28 |

### 单元测试覆盖

```
engine/geometry.ts   →  15 个用例（snapToGrid, dist, angleBetween, pointToSegmentDist,
                                   findNearestWall, syncConnectedSegments, resizeWallSegment...）
engine/walls.ts      →   9 个用例（rebuildWallSegments 闭合/开放、createRoomFromDimensions）
engine/openings.ts   →  12 个用例（createDoorData, createWindowData, rebuildDoorsAndWindowsData）
engine/layout.ts     →  27 个用例（边界约束、碰撞检测、未知类型、拥挤回落）
```

### E2E 测试覆盖

完整用户旅程：加载页面 → 验证 UI 元素 → 一键创建房间 → 放置门/窗/家具 → 智能布局 → 撤销 → 清除全部 → 截图。

运行：`npm test`（单元） / `npm run test:e2e`（端到端）

---

## 九、部署架构

```
开发者推送 master 分支
  │
  ▼
GitHub Actions (deploy.yml)
  ├─ npm install
  ├─ npm run build (tsc + vite build)
  └─ 推送 dist/ → gh-pages 分支
       │
       ▼
GitHub Pages CDN
  └─ https://nemozhang11.github.io/home-design-lite/
```

构建产物：
- `dist/index.html` — 6.57 KB
- `dist/assets/index-*.css` — 4.14 KB
- `dist/assets/index-*.js` — 226.69 KB (68 KB gzipped)

---

## 十、关键约束与设计决策

| 编号 | 决策 | 理由 |
|---|---|---|
| D01 | engine 层禁止 import Konva 或 DOM API | 保证可单元测试、可跨平台复用 |
| D02 | 使用可变全局状态而非 immutable | 当前规模不需要，减少抽象层 |
| D03 | 不引入 React/Vue 框架 | 编辑器以 Canvas 为主，DOM 仅辅助，框架收益低 |
| D04 | TypeScript strict 模式 | 编译期捕获类型错误 |
| D05 | 1px = 1cm 比例尺 | 与中国家居尺寸惯例一致，家具定义天然是 cm |
| D06 | GRID_SIZE = 10px (10cm) 吸附 | 精度适中，10cm 是家居布置的最小有效精度 |
| D07 | `_rebuildingDoorsWindows` 递归守卫 | 防止 createDoor → rebuildWallSegments → rebuildDoorsAndWindows → createDoor 死循环 |
