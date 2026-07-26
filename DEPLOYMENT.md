# 部署方案对比：Web 网页 vs 微信小程序

## 一、Web 网页部署

### 技术栈
- 前端：React + Konva.js + Zustand（纯静态 SPA）
- 后端：无（或仅需 LLM API 代理，如 Cloudflare Workers / Vercel Serverless）
- 部署：Vercel / Netlify / Cloudflare Pages

### 部署步骤

#### 1. 准备项目
```bash
# 初始化 React 项目
npm create vite@latest home-design-tool -- --template react-ts
cd home-design-tool
npm install konva react-konva zustand

# 开发
npm run dev
```

#### 2. 构建
```bash
npm run build
# 输出在 dist/ 目录
```

#### 3. 部署到 Vercel（推荐，免费）
```
1. 注册 vercel.com（GitHub 登录）
2. npm install -g vercel
3. vercel --prod
   → 自动检测 Vite 项目，一键部署
   → 获得 https://xxx.vercel.app 域名
```

#### 4. 自定义域名（可选）
```
1. 购买域名（阿里云/腾讯云/Namecheap 约 50-100 元/年）
2. 在 Vercel 控制台添加自定义域名
3. 配置 DNS CNAME 记录指向 cname.vercel-dns.com
4. 自动获取 HTTPS 证书
```

#### 5. LLM API 代理（如需 AI 功能）
```javascript
// 方案 A：Vercel Serverless Function
// api/suggest-layout.js
export default async function handler(req, res) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', messages: [...] })
  });
  res.json(await response.json());
}

// 方案 B：Cloudflare Workers（免费额度更高）
// 方案 C：直接用 EdgeOne Pages 等国内服务（国内访问更快）
```

### 费用估算
| 项目 | 费用 |
|------|------|
| 域名 | 50-100 元/年 |
| 托管（Vercel 免费层） | 0 元 |
| LLM API（GPT-4o） | ~0.1 元/次建议 |
| SSL 证书 | 0 元（自动） |
| **首年总成本** | **< 200 元** |

### 优点
- ✅ 零门槛访问（浏览器打开即用）
- ✅ 开发成本最低
- ✅ 部署最简单（Vercel 一键）
- ✅ 可分享链接、SEO 友好
- ✅ PC + 手机自适应
- ✅ 免费 HTTPS

### 缺点
- ❌ 微信生态内分享体验一般
- ❌ 无微信支付、无消息推送
- ❌ 国内访问 Vercel 偶有延迟（可换 Cloudflare Pages 或国内服务）

---

## 二、微信小程序部署

### 技术栈选项

| 方案 | 说明 | 推荐度 |
|------|------|--------|
| **原生小程序** | WXML + WXSS + JS | ⭐⭐ 学习成本高 |
| **Taro** | React 语法 → 编译为小程序 | ⭐⭐⭐⭐⭐ 推荐 |
| **uni-app** | Vue 语法 → 编译为小程序 | ⭐⭐⭐⭐ |

### 部署步骤

#### 1. 开发环境准备
```bash
# 使用 Taro（React 语法，与 Web 版代码复用度高）
npm install -g @tarojs/cli
taro init home-design-miniapp
# 选择：React + TypeScript + Webpack

# 安装 Canvas 替代方案（小程序不支持 Konva.js DOM Canvas）
# 需要使用小程序的 <canvas> 组件或 echarts-for-weixin 的 Canvas 封装
```

#### 2. 关键适配：Canvas 编辑器

**最大挑战**：微信小程序不支持标准 DOM Canvas API，Konva.js 无法直接使用。

**解决方案**：
| 方案 | 说明 | 工作量 |
|------|------|--------|
| 方案 A：小程序原生 Canvas 2D | 使用 `<canvas type="2d">` API，手动实现拖拽/吸附 | 大（4-6 周额外） |
| 方案 B：WebView 内嵌 | 将 Web 版放在 `<web-view>` 中 | 小（但体验受限） |
| 方案 C：使用 kbone | 腾讯官方方案，将 Web 代码适配到小程序 | 中 |

**推荐方案 B（MVP）**：先用 WebView 跑通流程，后续逐步迁移到原生 Canvas。

#### 3. 注册与审核
```
1. 注册微信小程序账号（mp.weixin.qq.com）
   → 个人主体：免费，功能受限（无微信支付）
   → 企业主体：300 元认证费/年

2. 提交代码审核（1-7 个工作日）
   → 家居设计类目无需特殊资质

3. 发布上线
```

#### 4. 后端服务
```bash
# 小程序必须使用 HTTPS 后端，域名需备案
# 推荐：微信云开发（免服务器运维）
# 或：腾讯云/阿里云 + 已备案域名
```

### 费用估算
| 项目 | 费用 |
|------|------|
| 小程序认证（企业） | 300 元/年 |
| 云开发/服务器 | 50-200 元/月 |
| 域名 + 备案 | 50-100 元/年 |
| SSL 证书 | 0 元（云服务自带） |
| LLM API | ~0.1 元/次 |
| **首年总成本** | **~1,000-3,000 元** |

### 优点
- ✅ 微信生态内传播（朋友圈、群聊、公众号）
- ✅ 微信登录（一键授权）
- ✅ 微信支付（可收费）
- ✅ 订阅消息推送
- ✅ 用户体验流畅（无需跳出微信）

### 缺点
- ❌ Canvas 适配成本高（Konva.js 不兼容）
- ❌ 审核流程（每次更新需审核）
- ❌ 封闭生态（无法分享到微信外）
- ❌ 个人主体限制多（无支付、部分 API 不可用）
- ❌ 域名需 ICP 备案（约 2-4 周）

---

## 三、推荐方案

### 🏆 推荐：先 Web，后小程序扩展

```
Phase 1：Web 版（快速验证）
  ├── 开发成本最低
  ├── 部署最简单
  ├── 快速获取用户反馈
  └── 验证产品价值后决定是否扩展

Phase 2（验证后）：小程序版
  ├── 微信生态传播
  ├── 可使用 WebView 快速上线
  └── 逐步迁移核心交互到原生
```

### 决策矩阵

| 维度 | Web 网页 | 微信小程序 |
|------|----------|------------|
| 开发成本 | ⭐⭐⭐⭐⭐ 低 | ⭐⭐ 高（Canvas 适配） |
| 部署难度 | ⭐⭐⭐⭐⭐ 极简 | ⭐⭐ 需审核+备案 |
| 用户触达 | ⭐⭐⭐⭐ 链接分享 | ⭐⭐⭐⭐⭐ 微信生态 |
| 变现能力 | ⭐⭐⭐ 支付宝/Stripe | ⭐⭐⭐⭐⭐ 微信支付 |
| PC 端体验 | ⭐⭐⭐⭐⭐ 优秀 | ⭐⭐ 仅手机 |
| 国际化 | ⭐⭐⭐⭐⭐ 全球可访问 | ⭐ 仅微信用户 |

### 时间线建议

```
第 1-2 月：Web MVP（户型编辑器 + AI 建议）
第 2-3 月：Web 优化 + 用户测试
第 3-4 月：评估是否做小程序
  ├── 数据好 → Phase 2：小程序 WebView 版（1 月）
  └── 数据一般 → 继续迭代 Web 版
```

---

## 四、国内部署加速方案

如果主要面向国内用户，推荐以下组合：

```
托管：   Cloudflare Pages（国内访问比 Vercel 快）
      或 腾讯云 EdgeOne Pages（国内节点）
      或 阿里云 OSS + CDN

域名：   阿里云/腾讯云（需备案）

API：    Cloudflare Workers（免费 10 万次/天）
      或 微信云开发
```
