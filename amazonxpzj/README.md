# 🛒 Amazon Selection Agent (亚马逊智能选品系统)

基于 Google Gemini 3 Pro 模型构建的多智能体协作选品分析系统。通过多 Agent 协同工作，实现从关键词挖掘、商品检索到市场洞察的全链路选品分析。

## 🌟 核心特性 (Key Features)

### 🤖 多智能体架构 (Multi-Agent System)

系统由主控智能体（Orchestrator）指挥调度，协调多个专业子智能体完成复杂任务：

1.  **Orchestrator Agent (主控)**
    - 核心大脑，负责用户意图识别、任务拆解与动态规划。
    - 基于上下文实时调整执行策略。

2.  **Keyword Agent (关键词专家)**
    - 关键词挖掘与扩展（同义词、场景词）。
    - 搜索排名 (SEO) 分析与趋势预测。

3.  **Product Agent (商品专家)**
    - 多维度商品检索与过滤。
    - 畅销榜 (Best Sellers) 与新品 (New Releases) 分析。
    - 竞品深度对比分析。

4.  **Market Agent (市场分析师)**
    - [New] 全新集成。
    - 市场规模估算与增长态势分析。
    - 竞争格局与机会风险评估 (SWOT)。

5.  **Report Agent (报告生成器)**
    - 数据清洗与结构化整合。
    - 生成包含图表洞察的专业选品报告。

### 🧠 模型驱动

- **Core Model**: 集成 `gemini-3-pro-preview` 模型，提供强大的逻辑推理与长上下文处理能力。
- **JSON Mode**: 全程采用 JSON 结构化输出，确保数据处理的稳定性。
- **Real-time Planning**: 并非死板的工作流，而是根据用户输入动态生成的执行计划。

## 📂 项目结构

```
amazonxpzj/
├── services/
│   ├── agents/          # Agent 核心逻辑
│   │   ├── orchestrator.ts  # 任务编排
│   │   ├── prompts.ts       # System Prompts 定义
│   │   └── *Agent.ts        # 各子 Agent 实现
│   └── geminiService.ts # Gemini API 封装 (支持 gemini-3-pro)
├── stores/
│   └── analysisStore.ts # 状态管理与执行引擎
└── components/          # Agent 执行可视化组件
```

## 🚀 快速开始

### 1. 环境变量配置

确保根目录 `.env.local` 包含以下配置：

```env
VITE_GEMINI_API_KEY=your_api_key_here
VITE_GEMINI_MODEL=gemini-3-pro-preview
```

### 2. 启动服务

在项目根目录运行：

```bash
npm run dev
```

进入系统后，选择 "选品分析" 模块，输入您的选品需求（例如："分析美国市场的 Yoga Mats 机遇"），观察 Agent 团队的实时协作。

---

© 2026 SKYSPER AI Studio
