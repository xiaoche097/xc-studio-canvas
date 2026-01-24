# 🎯 SKYSPER AI Studio

> **Venture Lightly** —— 为 SKYSPER 品牌打造的一站式电商视觉资产自动化实验室。

<div align="center">
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" width="100%" alt="SKYSPER AI Studio Banner" />
</div>

## 📖 项目简介

SKYSPER AI Studio 是一个基于 Google Gemini Pro 多模态模型驱动的智能电商助理系统。它模拟了完整的品牌视觉开发链路，从产品初期的市场调研、策略定位，到视觉规范制定、文案产出，最后自动生成符合亚马逊合规标准的主图、附图及 A+ 页面资产。

项目核心使命是践行 **"Venture Lightly"** 的品牌理念，通过 AI 技术实现视觉效果的“轻量化”与“高端化”。

## 🚀 核心工作流

系统严格遵循 P0 到 P5 的专业电商产研工作流：

1.  **📦 启动包 (Launch Package)**：自动提取产品卖点、材质、类目及全球市场定位。
2.  **🧠 P0 电商策略**：多维度市场分析，确定差异化定位与核心关键词。
3.  **🎨 P1 品牌视觉**：定义品牌色系、灯光基调、构图逻辑及悬浮效果规范。
4.  **✍️ P2 营销文案**：生成符合多语言合规标准的标题、五点描述及 A+ 模块文案。
5.  **🎯 生产选择**：
    - **📸 P3 主图**：Amazon 合规纯白背景 (RGB 255,255,255) + 智能悬浮效果。
    - **🖼️ P4 副图序列**：生成 6 张“无声销售员”序列图（信息图/场景图/细节图）。
    - **🏗️ P5 A+ 架构**：模块化生成 Premium A+ 设计方案与视觉提示词。

## ✨ 特色功能

- **全链路角色模拟**：内置 P0-P5 多个专家级 Prompt，每个阶段由特定的 AI 专家负责。
- **智能悬浮引擎**：严格遵循品牌规范中的 15° 左偏及 3-5° 前倾悬浮参数。
- **交互式图像生成**：支持“点击生成”模式。用户可对 P3/P4/P5 的设计方案进行分步确认，并实时触发 AI 生成图片预览。
- **副图实时预览**：支持 S1-S6 副图序列点击切换，即时查看不同设计方案的视觉效果。
- **品牌合规检查**：内置 Amazon 主图合规性预检机制。

## 🛠️ 技术栈

- **框架**: React + Vite
- **AI 模型**: Google Gemini 1.5 Pro / Flash
- **动画**: Framer Motion
- **样式**: Vanilla CSS + Tailwind-like Glassmorphism 设计
- **部署**: Vercel

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

## ☁️ 部署到 Vercel

本项目支持一键部署到 Vercel：

1.  上传代码到 GitHub。
2.  在 Vercel 导入该仓库。
3.  在 Project Settings -> Environment Variables 中添加 `VITE_GEMINI_API_KEY`。
4.  点击 **Deploy**。

---

© 2026 SKYSPER Team. Venture Lightly.
