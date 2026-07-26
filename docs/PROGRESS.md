# 项目进度与下一步计划

> 更新: 2026-07-27 | 仓库: [home-design-lite](https://github.com/NemoZhang11/home-design-lite) | 在线: https://nemozhang11.github.io/home-design-lite/

---

## 一、已完成里程碑

### Phase 0 — 极简原型开发 ✅

**日期**: 2026-07-26

- [x] 单文件 Konva.js Demo（`demo/index.html`，2535 行）
- [x] 墙段系统：独立可拖拽/旋转/缩放的墙段，闭合多边形房间，一键创建矩形房间
- [x] 门系统：吸附到墙、沿墙拖动、内外开方向切换、铰链侧(左/右)切换、可调宽度
- [x] 窗户系统：吸附到墙、沿墙拖动、可调宽度、玻璃窗格渲染
- [x] 家具系统：5 种家具，拖拽放置、旋转、删除
- [x] 智能布局：贪心算法沿墙排列
- [x] 网格系统：100px 主网格 + 10px 吸附
- [x] 日志系统：带时间戳，17+ 关键操作点
- [x] 一键清除、撤销/重做（Ctrl+Z/Y）
- [x] Playwright E2E 测试：28 个用例全部通过

### Phase 0.5 — 工程化重构 ✅

**日期**: 2026-07-26

- [x] 比例尺修正：20px=1m → 1px=1cm，单位统一厘米
- [x] 门/窗 UX 重做：连续放置模式 + 蓝色半透明预览幽灵 + Esc 退出
- [x] 门/窗可见性增强：加高至 20px（墙厚 12px），醒目配色
- [x] TypeScript + Vite 模块化：18 个源文件，5 层架构
- [x] Vitest 单元测试：63 个用例，386ms 跑完
- [x] Git 统一仓库 → GitHub (`NemoZhang11/home-design-lite`)
- [x] CI/CD：GitHub Actions → gh-pages 自动部署
- [x] 架构文档：[ARCHITECTURE.md](architecture/ARCHITECTURE.md)

### Phase 0.6 — 上线准备 ✅

**日期**: 2026-07-27

- [x] GitHub Pages 部署上线：https://nemozhang11.github.io/home-design-lite/
- [x] 反馈入口：状态栏 `💬 反馈` → GitHub Issues
- [x] AI 输入框 + 4 个预设房间模板（儿童房/主卧/书房/客厅），一键创建

---

### 文档结构（2026-07-26 重新组织）

```
docs/
├── README.md                         ← 入口导航 ← 新
├── PROGRESS.md                       ← 项目进度（本文档）
├── 产品需求和项目管理/                 ← 方案设计
│   ├── 产品定位与路线图.md
│   ├── 核心功能与交互流程.md
│   └── 风险评估报告.md
├── architecture/
│   └── ARCHITECTURE.md               ← 技术架构
└── 反馈与迭代/                        ← 使用反馈 ← 新
    └── 反馈记录.md                    反馈汇总、bug跟踪、决策记录
```

**本文件建议**：定期进入会话时先看 `PROGRESS.md`（进度）和 `反馈与迭代/反馈记录.md`（反馈），再决定下一步。

---

## 二、当前状态

```
✅ Phase 0   — 极简原型
✅ Phase 0.5 — 工程化重构
✅ Phase 0.6 — 上线 + 反馈入口 + 模板
⏳ Phase 0.7 — localStorage 自动保存（进行中）
⬜ Phase 0.8 — 埋点 + 反馈增强
⬜ Phase 1a  — LLM 离线解析验证
⬜ Phase 2   — 约束求解引擎
⬜ Phase 3   — 界面整合上线
⬜ Phase 4   — 商业化验证
```

### 技术指标

| 指标 | 值 |
|---|---|
| TypeScript 严格模式 | ✅ strict，零 `any` |
| 单元测试 | 63 个用例，386ms |
| E2E 测试 | 28 个用例 |
| 构建产物 | 68 KB gzipped |
| 构建时间 | < 1 秒 |
| npm 依赖 | konva + vite + typescript + vitest + playwright |
| 部署 | GitHub Pages (gh-pages 分支) |

### 代码统计

```
src/engine/        8 files   ~500 行  纯函数引擎
src/state/         1 file    ~120 行  状态管理
src/renderer/      5 files   ~500 行  Konva 渲染
src/ui/            3 files   ~200 行  DOM 事件
src/main.ts        ~1100 行           业务编排
src/styles/        1 file    ~180 行  CSS
src/engine/*test   4 files   ~500 行  单元测试
────────────────────────────────────────
总计              22 files  ~3100 行
```

---

## 三、下一步计划

### 立即（本周）— Phase 0.7~0.8

| 优先级 | 事项 | 说明 | 验收标准 |
|---|---|---|---|
| 🔴 P0 | **localStorage 自动保存** | 关掉浏览器回来状态不丢失 | 刷新页面恢复上次状态 |
| 🟡 P1 | **简单埋点** | Cloudflare Web Analytics 或一行 `<img>` 信标 | 能看到 PV/UV |
| 🟡 P1 | **反馈改为无需登录** | GitHub Issues 需要登录，改为页面内嵌 textarea + localStorage | 反馈率 > 0 |
| 🟢 P2 | **明确分发渠道** | 确定发到哪里（群/论坛/朋友圈）、预期触达人数 | 有第一批真实用户 |

### Phase 1a — LLM 离线验证（2 周内）

| 事项 | 说明 | 验收标准 |
|---|---|---|
| 找 5-10 个朋友手动测试 | 每人给 5-10 个房间需求 | 收集 50+ 条语料 |
| LLM 接口封装 | GPT-4o / Claude → "自然语言 → JSON" | 调用成功率 100% |
| Prompt 工程 + 离线验证 | 用收集的语料测试解析准确率 | ≥ 85% |

> **启动条件**：Phase 1a 仅在 localStorage + 埋点完成后启动。需先确认有人使用、数据可收集。

### Phase 2 — 约束求解引擎（3-5 周）

| 事项 | 说明 |
|---|---|
| 约束形式化 | "床不靠窗" → 数学不等式 |
| 求解器 | 纯 JS 实现 |
| 多方案生成 | 同一输入 2-3 套不同布局 |

> **⚠️ 启动门槛**：两个条件同时满足才启动 Phase 2：
> 1. LLM 解析准确率 ≥ 85%（Phase 1a 离线验证）
> 2. 假 AI 界面有 ≥ N 人输入过文字（Phase 0.8 埋点数据验证）
>
> 任一不满足 → 停止，重新评估方向，不盲目投入。

### Phase 3 — 界面整合上线（3-4 周）

自然语言输入框集成、方案浏览器（2-3 套对比）、移动端响应式、视口裁剪优化。

### Phase 4 — 商业化验证（2-4 周）

50 人内测、付费模型（免费 3 次/天 + 会员不限次）、国内 CDN + 备案域名。

---

## 四、技术债务

| 序号 | 问题 | 严重程度 | 计划 |
|---|---|---|---|
| T1 | `main.ts` ~1100 行过于臃肿 | 中 | Phase 3 前拆分 action 模块 |
| T2 | 家具碰撞检测仅 AABB，不支持旋转 | 低 | Phase 2 引入 SAT 算法 |
| T3 | 门/窗拖拽沿墙滑动锁在同一墙上 | 低 | 允许跨墙拖拽 |
| T4 | 智能布局仅沿墙排列，不够智能 | 中 | Phase 2 约束求解器替代 |
| T5 | 无房间自动检测（需手动闭合） | 中 | Phase 2 引入图循环检测 |
| T6 | 无流量数据 | 高 | Phase 0.8 加埋点 |
| T7 | 反馈需 GitHub 登录 | 高 | Phase 0.8 改为无需登录方案 |
| T8 | 无多楼层支持 | 低 | Phase 3+ |

---

## 五、关键决策记录

| 编号 | 决策 | 结论 | 日期 |
|---|---|---|---|
| D06 | 上线前先加 localStorage 保存 | 防流失，优先级高于 LLM | 2026-07-27 |
| D07 | Phase 2 启动门槛 | LLM ≥ 85% + 用户使用输入框，缺一不可 | 2026-07-27 |
| D08 | 反馈改无需登录 | GitHub Issues 门槛太高，改为页面内嵌 | 2026-07-27 |
