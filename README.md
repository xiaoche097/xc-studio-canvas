# 🎯 SKYSPER AI Studio

> **Venture Lightly** —— 为 SKYSPER 品牌打造的一站式电商视觉与数据分析智能工作台。

<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/xiaoche0907/pic-bed@main/img_1769494458618_350_ScreenShot_2026-01-27_141346_943.png" width="100%" alt="SKYSPER AI Studio Banner" />
</div>

## 📖 项目简介

SKYSPER AI Studio 是一个集成化智能系统，专为跨境电商（特别是 Amazon 平台）设计。它结合了 Google Gemini Pro 的多模态能力，打通了从**市场数据分析**到**品牌视觉落地**的全链路流程。

项目旨在通过 AI 技术赋能品牌运营，将“数据洞察”与“创意生产”深度结合，实现高效、标准化的品牌资产构建。

## 🚀 核心模块

### 1. ✨ SKYSPER 视觉系统 (Visual System)
包含完整的 P0-P5 电商视觉工业化生产链路：
- **📦 启动包 (Launch Package)**：自动提取产品卖点、材质及全球定位。
- **🧠 P0 电商策略**：制定市场定位与核心差异化策略。
- **🎨 P1 品牌视觉**：定义符合品牌调性的光影、构图与色彩规范。
- **✍️ P2 营销文案**：生成多语言标题、五点描述与 A+ 文案。
- **📸 P3 主图生成**：Amazon 合规纯白背景悬浮主图生成。
- **🖼️ P4/P5 场景生成**：自动生成副图序列与 A+ 页面模块设计图。

### 2. 📊 分析专家 (Analysis Expert)
深度市场洞察智能体，提供数据驱动的决策支持：
- **🔍 关键词分析**：搜索热度、竞争程度及趋势预测。
- **🛒 选品机会发现**：挖掘蓝海市场与细分品类机会。
- **📈 市场深度报告**：生成包含供需关系、垄断系数及竞争格局的专业分析报告。

### 3. 🎬 视频工作站 (Video Station)
利用 AI 技术自动化生成电商短视频，支持：
- 脚本智能生成。
- 视频素材剪辑与合成。
- 营销短视频批量生产。

### 4. 💡 创意中心 (Creative Center)
集灵感管理与资产迭代于一体：
- 创意素材库管理。
- 历史设计资产回溯。
- 跨平台创意适配。

## 📂 项目管理 (Project History)
内置本地化 IndexedDB 存储系统，完整记录所有生成历史：
- **分类管理**：支持按类型筛选（SKYSPER 视觉系统、分析专家、营销图等）。
- **资产详情**：查看生成的高清图片及分析报告原文。
- **数据持久化**：所有对话、图像及报告数据自动保存，随时回溯。

## 🛠️ 技术栈

- **前端框架**: React 18 + Vite 5 + TypeScript
- **AI 驱动**: Google Gemini 1.5 Pro / Flash (Web Stream API)
- **样式方案**: TailwindCSS + Framer Motion (Glassmorphism 风格)
- **数据存储**: IndexedDB (idb) 本地持久化
- **图表可视化**: Recharts + Sparklines

## 💻 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/xiaoche0907/skysper-ai-studio.git
cd skysper-ai-studio
```

### 2. 配置环境变量

在根目录创建 `.env.local` 文件并填入您的 API Key：

```env
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
VITE_GEMINI_MODEL=gemini-1.5-pro-latest
```

### 3. 安装依赖并启动

```bash
npm install
npm run dev
```

## ☁️ 部署与架构

本项目采用纯前端架构（Client-side only），利用 Edge AI 能力直接调用模型 API，无需后端中转，保护数据隐私并降低部署成本。支持一键部署至 Vercel/Netlify。

---

© 2026 SKYSPER Team. Venture Lightly.
