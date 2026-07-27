# home-design-tool — AI 家居设计助手

> **一句话**：输入自然语言 → AI 自动生成房间布局方案。  
> 当前状态：极简原型已验证，进入 Phase 1 验证阶段。详见 [docs/](docs/) 目录。

---

## 项目概述

一个 AI 驱动的单房间布局工具。用户用一句话描述需求（"3m×4m 儿童房，需要床、书桌、衣柜，床不要靠窗"），系统自动生成多套布局方案。

**核心流程**：输入需求 → AI 解析 → 自动布局 → 浏览方案 → 修改迭代

**不做**：全屋设计、3D 渲染、施工图、社交社区、移动 App。

---

## 快速体验

```bash
# 方式一：打开极简原型 demo（无需安装）
open demo/index.html

# 方式二：运行模块化 TypeScript 版（推荐）
cd home-design-tool
npm install
npm run dev

# 运行自动化测试
npm test
```

### ⚠️ Windows 本地开发注意

`npm run dev` 启动的 Vite 开发服务器是**前台常驻进程**。如果在终端中直接运行，关闭终端窗口后服务会停止。推荐以下方式启动：

**PowerShell（推荐）**：
```powershell
cd D:\home\家装布置\home-design-tool
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Minimized
```
这会在一个最小化的独立 PowerShell 窗口中运行 dev server，不受当前终端影响。打开 `http://localhost:3000/home-design-lite/` 访问。

> **为什么需要这样**：Vite dev server 是长期运行的进程，不能放在有超时限制的终端里（如 IDE 内置终端、CI pipeline）。`Start-Process` 把它放到独立进程里，保证稳定运行。

---

## 文档体系

| 文档 | 内容 | 
|------|------|
| [产品定位与路线图](docs/产品需求和项目管理/产品定位与路线图.md) | 目标用户、差异化、4阶段开发计划、移动端策略、MVP范围 |
| [核心功能与交互流程](docs/产品需求和项目管理/核心功能与交互流程.md) | 用户旅程、功能清单、设备分工、数据流 |
| [风险评估报告](docs/产品需求和项目管理/风险评估报告.md) | 四大风险分析、止损红线、务实判断 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 部署方案对比（保留，待 Phase 3 参考） |

---

## 项目状态

| 阶段 | 状态 | 时间 |
|------|------|------|
| 极简原型开发 | ✅ 完成 | 2026-07 |
| 真实案例验证（次卧改儿童房） | ✅ 完成 | 2026-07 |
| 产品定位与风险评估 | ✅ 完成 | 2026-07 |
| Phase 1 — LLM 解析验证 | ⏳ **待开始** | 预计 2-3 周 |
| Phase 2 — 约束求解引擎 | ⬜ | 预计 3-5 周 |
| Phase 3 — 界面整合上线 | ⬜ | 预计 3-4 周 |
| Phase 4 — 端到端验证+商业化 | ⬜ | 预计 2-4 周 |

> 每阶段有明确验收标准和止损红线，不通过则停止或降级。详见 [风险评估报告](docs/产品需求和项目管理/风险评估报告.md)。

---

## 快速部署

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

一键部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/home-design-tool)

---

## 技术选型（决定）

| 层级 | 技术 | 说明 |
|------|------|------|
| UI 渲染 | HTML/CSS + 响应式布局 | MVP 不迁 React，降低开发成本 |
| Canvas | **Konva.js** (npm) | 编辑器交互已验证，TypeScript 严格模式，5 层渲染 |
| LLM 解析 | GPT-4o / Claude | 仅做"自然语言 → 结构化数据"翻译 |
| 布局引擎 | **纯前端 JS 约束求解** | 不依赖 LLM 做布局，零算力成本 |
| 部署 | Vercel / Netlify | 免费层足够起步 |

**关键原则**：LLM 只做语义理解翻译，不做空间决策。布局由确定性算法完成，确保结果可复现、可离线降级。

---

## 项目结构

```
home-design-tool/
├── README.md                    # 本文件
├── DEPLOYMENT.md                # 部署方案对比
├── package.json                 # 依赖配置
├── tsconfig.json                # TypeScript 配置
├── vite.config.ts               # Vite 构建配置
├── vercel.json                  # Vercel 部署配置
├── index.html                   # Vite 入口 HTML
├── public/
│   └── favicon.svg              # SVG 图标
├── src/
│   ├── main.ts                  # 主入口：Konva 初始化、事件绑定
│   ├── engine/                  # 纯函数引擎（无 Konva、无 DOM）
│   │   ├── types.ts             # TypeScript 类型定义
│   │   ├── constants.ts         # 常量与家具定义
│   │   ├── logger.ts            # 日志系统
│   │   ├── geometry.ts          # 几何/数学工具函数
│   │   ├── walls.ts             # 墙构造逻辑
│   │   ├── openings.ts          # 门/窗数据逻辑
│   │   └── layout.ts            # 智能布局算法
│   ├── state/
│   │   └── store.ts             # 状态管理
│   ├── renderer/                # Konva 渲染层
│   │   ├── gridLayer.ts         # 网格渲染
│   │   ├── wallLayer.ts         # 墙段渲染
│   │   ├── furnitureLayer.ts    # 家具渲染
│   │   ├── doorLayer.ts         # 门/窗渲染
│   │   └── previewLayer.ts      # 预览幽灵渲染
│   ├── ui/                      # DOM 事件处理
│   │   ├── toolbar.ts           # 工具栏事件
│   │   ├── sidebar.ts           # 侧边栏事件
│   │   └── statusBar.ts         # 状态栏更新
│   └── styles/
│       └── main.css             # 全局样式
├── demo/
│   └── index.html               # 极简原型（保留，2535 行 Konva.js）
├── test/
│   ├── test.js                  # Playwright 自动化测试
│   └── test-results.txt          # 测试结果
├── docs/
│   └── 产品需求和项目管理/
│       ├── 产品定位与路线图.md    # 定位、路线图、策略
│       ├── 核心功能与交互流程.md   # 功能规格、交互流程
│       └── 风险评估报告.md       # 风险与止损
│   └── architecture/             # (待补充)
└── 次卧改儿童房/                  # 真实案例验证数据
    ├── 次卧改儿童房.md             # 原始需求
    ├── 房间布局设计工作流.md        # 标准化流程（Agent 行为模板）
    └── layout_all.py              # matplotlib 出图脚本
```

---

## 关键决策记录

| 序号 | 决策 | 结论 |
|------|------|------|
| 01 | 移动端策略 | 一套响应式 Web，不做独立移动版/小程序 |
| 02 | 编辑器框架 | 基于现有 demo 封装 API，暂不迁 React |
| 03 | LLM 定位 | 只做语义翻译，不做布局决策 |
| 04 | 开源策略 | 编辑器开源，AI 引擎闭源 |
| 05 | 验证顺序 | LLM 解析 → 布局引擎 → 界面整合 → 商业化验证 |
