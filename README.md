# 家装改造工具 — 项目背景

## 项目概述

一个网页版房间改造工具，用户通过可视化编辑器绘制户型图，输入改造需求，系统自动生成优化布局建议。

**核心流程**：画户型 → 提需求 → 出方案

## 市场定位

### 痛点
现有工具要么太重（酷家乐面向专业设计师），要么付费墙严重（Planner 5D、RoomSketcher）。缺少一个**轻量、免费起步、AI 辅助、专注单房间改造**的普通人工具。

### 目标用户
- 想做儿童房/书房/客厅改造的普通家庭
- 租房党布置房间
- 小型装修需求，不需要全屋设计

### 国内竞品
| 产品 | 定位 | 弱点 |
|------|------|------|
| 酷家乐 | 全屋设计、3D 渲染 | 学习曲线陡、偏专业 |
| 住小帮 | AI 搭配、内容社区 | 编辑器不是核心功能 |
| 三维家 | 定制家具设计 | 面向 B 端 |

### 国际竞品
| 产品 | 定位 | 弱点 |
|------|------|------|
| Floorplanner | 简单易用 | 免费版有水印、功能限制 |
| Planner 5D | 2D/3D 双模式 | 付费墙严重 |
| RoomSketcher | 专业级 | 按年订阅 |

### 差异化方向
- ✅ 极简上手（3 步完成）
- ✅ AI 布局建议（非手动摆放）
- ✅ 免费起步
- ✅ 专注单房间改造场景

---

## 技术可行性

### 结论：完全可行，难度中等偏高

### 技术栈推荐

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18+ | 生态最丰富 |
| Canvas | Konva.js + react-konva | 专为交互编辑器设计，官方 React 绑定 |
| 状态管理 | Zustand | 轻量、适合编辑器场景 |
| UI 组件 | 任意（shadcn/ui、Ant Design） | 看偏好 |
| 部署 | Vercel / Netlify | 免费层足够起步 |

**为什么选 Konva.js 而不是其他？**
- Konva.js：专为交互编辑器设计（拖拽、缩放、旋转、吸附），npm 下载量最高的 Canvas 2D 库
- Fabric.js：更适合 SVG 导入导出和图片编辑，大量对象时性能不如 Konva
- PixiJS：更适合 2D 游戏，React 集成不友好
- Three.js：适合 3D 预览，不是 2D 平面图首选

### 已有开源项目可参考

| 项目 | Stars | 技术栈 | 许可证 |
|------|-------|--------|--------|
| [Arcada](https://github.com/mehanix/arcada) | 384 ⭐ | React + PixiJS + Zustand | Apache 2.0 |
| [arcada-planner](https://github.com/fedepaj/arcada-planner) | 7 ⭐ | React + Konva.js + Zustand | MIT |
| [react-planner](https://github.com/cvdlab/react-planner) | — | React + Three.js | MIT |
| [floorist](https://github.com/AimTune/floorist/) | — | 零依赖 Web Component | MIT |

**关键发现**：Arcada 作者是个人开发者，README 中写道 *"大部分户型设计工具要么付费，要么太难用，所以我决定自己写一个"* — 384 stars 证明了需求存在，技术门槛可跨越。

---

## AI 布局建议 — 技术路线

### 路线 A：LLM + 规则引擎（推荐 MVP，难度中）

```
用户需求（自然语言）
    ↓
LLM（GPT-4o/Claude）解析 → 结构化数据（家具列表、初始位置）
    ↓
贪心规则引擎精修（碰撞检测 + 贴墙对齐 + 通道间距）
    ↓
输出最终布局
```

**参考论文**：[Text-to-Layout (2025)](https://ar5iv.labs.arxiv.org/html/2509.00543) — LLM 生成初始布局 + 贪心算法精修，已验证可行。

- 每次调用 LLM 成本约几分钱
- 精修算法核心代码 200-300 行
- 可在本地 demo 中用纯规则引擎模拟（无需 API）

### 路线 B：LLM + 约束优化（进阶）

- [FlairGPT (2024)](https://flairgpt.github.io/)：LLM 提取约束 → 逐步优化 → 效果显著优于纯 LLM
- [Co-Layout (AAAI 2025)](https://github.com/xccElephant/co-layout)：LLM + 网格整数规划 → 可输出到 Blender 3D

### 路线 C：端到端 ML（研究级，不推荐 MVP）

- OptiScene (NeurIPS 2025)：微调 LLM 直接输出布局
- 需要大量训练数据和 GPU

---

## 工期估算（1 人全职）

| 模块 | 工期 | 难度 |
|------|------|------|
| 户型编辑器（画墙/门窗/家具） | 4-8 周 | ⭐⭐⭐ |
| 需求引导流程 | 1-2 周 | ⭐ |
| AI 布局建议 | 4-8 周 | ⭐⭐⭐⭐ |
| 结果展示与交互优化 | 2-3 周 | ⭐⭐ |
| 部署上线 | 1 周 | ⭐ |
| **合计** | **12-22 周（3-5.5 月）** | |

---

## 项目结构

```
home-design-tool/
├── README.md           # 本文档：项目背景与技术可行性
├── DEPLOYMENT.md       # 部署方案对比（Web vs 微信小程序）
└── demo/
    └── index.html      # 极简 demo：单文件户型编辑器
```

## 下一步

1. 运行 `demo/index.html` 体验极简原型
2. 根据体验决定是否投入正式开发
3. 正式开发建议基于 arcada-planner（MIT）改造
