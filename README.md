<div align="center">
  <br />
  <img src="./public/xiaoche-logo.png" alt="小彻工作台 Logo" width="220" />
  <h1>小彻工作台</h1>
  <p><strong>XcAI Studio · AI 电商视觉生产中枢</strong></p>
  <p>
    面向跨境电商、服装品牌、内容团队和视觉运营的一站式 AI 工作台。<br />
    从商品图、模特图、动作姿势、场景氛围到短视频策划，集中完成高质量商业视觉生产。
  </p>

  <p>
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=111827" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img alt="Gemini" src="https://img.shields.io/badge/Gemini-Image_AI-8E75B2?style=flat-square&logo=google&logoColor=white" />
    <img alt="DeepSeek" src="https://img.shields.io/badge/DeepSeek-Agent-4D6BFE?style=flat-square" />
    <img alt="Virse" src="https://img.shields.io/badge/Virse-Creative_Platform-FF6B35?style=flat-square" />
    <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white" />
    <img alt="License" src="https://img.shields.io/badge/License-Proprietary-111827?style=flat-square" />
  </p>

  <p>
    <a href="#近期更新2026-年-8-月9-月">近期更新</a>
    ·
    <a href="#核心能力">核心能力</a>
    ·
    <a href="#视觉创作-agent">视觉创作 Agent</a>
    ·
    <a href="#创意中心">创意中心</a>
    ·
    <a href="#模特姿势裂变">模特姿势裂变</a>
    ·
    <a href="#技术架构">技术架构</a>
    ·
    <a href="#快速开始">快速开始</a>
    ·
    <a href="#部署">部署</a>
  </p>
  <br />
</div>

---

## 产品定位

XcAI Studio 不是单点生图工具，而是一套为真实电商视觉流水线设计的 AI 工作台。

它把商品素材、模特身份、服装结构、动作姿势、场景光影、平台风格和生成结果管理放在同一个界面里，帮助团队更快完成从“素材输入”到“可用于投放或上架的视觉方案”的探索。

核心原则：

- **商业可用**：优先服务主图、副图、A+、独立站、社媒短视频等实际业务场景。
- **参考图分工明确**：商品图管产品，模特图管身份，场景图管环境，动作图管姿势。
- **一致性优先**：模特长相、肤色、体型、服装版型、面料纹理和原场景调性不随意漂移。
- **AI 生成 + 人工控制**：生成后支持预览、重生成、下载、裁图等二次控制。
- **记忆必须可控**：候选稿、批准稿和拒绝稿分开管理，只有用户明确采纳的结果才能成为后续视觉锚点。

## 近期更新（2026 年 8 月—9 月）

| 方向 | 最近完成的更新 |
| --- | --- |
| 视觉创作 Agent | 接入 DeepSeek 原生 Agent 工作流、工具调用、任务计划、长文本上下文和多轮项目记忆 |
| 记忆与 Visual RAG | 项目约束、品牌规范、参考摘要和已批准资产可按当前任务检索；候选稿与拒绝稿不会污染正向参考 |
| 人工反馈闭环 | Agent 回复支持 👍 采纳和 👎 拒绝，反馈直接更新项目记忆和后续视觉锚点 |
| 统一图片模型路由 | 创意中心统一模型选择入口，可按当前通道加载 Gemini、GPT Image、Midjourney、Qwen、FLUX、Seedream 等模型 |
| Virse 创意平台 | 支持账户、工作区、画布与实时模型同步；改进限流轮询、失效画布清理、参考图和蒙版原生上传 |
| 精准蒙版编辑 | 万物上身与局部重绘支持画笔涂抹、擦除、触控操作和蒙版引导，未涂抹区域保持不变 |
| 模特姿势裂变 | 新增动作参考图反推，可识别裁图边界、人物占比、朝向、重心和肢体关系并输出可复制提示词 |
| 虚拟模特工作室 | 支持多参考图生成、模特选角、面部朝向、景别校验、四视图联系表和手动场景裁剪 |
| 模特迁移与服装解构 | 加强跨域图片处理、多参考图保真、服装拆解与独立生成任务稳定性 |

## 核心能力

| 能力 | 说明 | 适合场景 |
| --- | --- | --- |
| AI Agent 首页 | DeepSeek / Gemini 文本对话、视觉分析、工具调用、任务计划、项目记忆 | 日常视觉策划与连续创作 |
| 创意中心 | 主图生成、产品替换、局部替换、高清放大、风格复刻、场景图生成 | 电商图片批量生产 |
| 模特姿势裂变 | 保持模特与场景风格，迁移动作参考图姿势 | 服装模特图扩展 |
| 动作反推 | 从参考图提取裁图、人物角度、重心、肢体和视线提示词 | 精准复刻姿势与构图 |
| 虚拟模特工作室 | 多参考选角、面部方向、景别、动作和四视图生成 | 品牌模特资产建设 |
| 模特迁移 / 服装解构 | 迁移服装与模特关系，拆分多件穿搭并保持产品细节 | 商品重组与素材扩展 |
| 模特原图贴回 | 将生成效果回贴到原图语境中 | 精修与一致性回收 |
| 商业动作库 | 按品类、风格和平台组织动作预设 | 无动作参考图时自动补齐 |
| 视频站 / AI 视频 | 脚本、分镜、素材规划与短视频生成辅助 | TikTok、Amazon、独立站内容 |
| 精修工作台 | 玩偶、毛绒、钥匙扣类商品图处理 | 礼品与玩具电商 |
| 摄影实验室 | 摄影预设分析、影调匹配与批量处理 | 品牌影像风格建设 |
| 灵感库与 XC AI Clipper | 从受支持站点采集视觉参考、回到工作台继续创作 | 灵感沉淀与 Visual RAG |
| API Studio | DeepSeek、Virse、Gemini 原生与兼容中转服务统一配置 | 文本与图片模型独立路由 |

## 视觉创作 Agent

Agent 不再只是聊天入口，而是负责理解需求、选择专业角色、组织参考图、调用创作工具并维护项目连续性的执行层。

### 对话与执行能力

- 支持需求澄清、任务规划、视觉提示词、图片编辑、多图关系编排和基于上一版的迭代校准。
- 可调用计划更新、图片生成、视频生成、智能编辑、文案生成、文字提取、区域分析和触控编辑工具。
- 内置 Coco、Campaign、Clothing Studio、Poster、Vireo、Package、Motion、Cameron 等专业 Agent 角色。
- DeepSeek 工作流保留最近 16 条编排消息，并在 18K 字符预算内构造近期对话；单次用户请求安全保留到 64K 字符。
- 图片生成和文本推理解耦：DeepSeek 可负责 Agent 规划，Virse、Gemini、Qwen 或其他已配置通道负责媒体生成。

### 项目记忆与反馈

上下文按照以下优先级执行：

```text
本轮明确要求 > 本轮附件 > 已确认硬约束 > 已批准资产 > 项目记忆 > 通用知识
```

- “这次、临时、先试一版”等指令只在当前任务生效。
- “记住、以后、固定、品牌规范”等明确规则才会进入持久项目记忆。
- 新生成图片先作为候选稿，不会自动成为后续参考。
- 点击 👍 会将结果加入已批准资产和主体锚点；点击 👎 会记录失败方向并阻止该稿成为正向参考。
- Visual RAG 会按当前任务检索相关约束和视觉资产，同时过滤候选、废弃和过期记忆。

> 当前项目记忆保存在浏览器 LocalStorage / IndexedDB 中，适合同一设备上的连续创作；跨设备同步和团队级云端记忆仍在 Roadmap 中。

## 创意中心

创意中心是 XcAI Studio 的核心生产台，围绕“上传参考图 -> 构建商业画面 -> 生成结果 -> 精修复用”的流程设计。

### 主图生成

- 支持 `1:1`、`2:3`、`3:4`、`9:16`、`16:9` 等常用电商比例。
- 支持 Amazon、SHEIN、Temu、天猫淘宝、独立站等平台风格。
- 支持商品图、模特图、场景参考图、动作参考图、配饰参考图组合输入。
- 支持按当前图片通道切换远端模型，并记住每个通道独立的首选模型。
- 支持输出质量与分辨率控制；可用模型能力以当前通道实时返回结果为准。
- 服装商品优先保持版型、领口、袖口、腰线、纹理、图案、面料和颜色。
- 可通过补充说明约束正面、背面、侧面、半身、全身、坐姿、走路、靠墙等生成方向。

### 图像工具

| 工具 | 用途 |
| --- | --- |
| 产品替换 | 将商品自然替换到指定人物或场景中 |
| 局部替换 / 蒙版涂抹 | 用画笔精确指定重绘区域，保留未涂抹区域；支持鼠标与触控操作 |
| 高清放大 | 提升图片清晰度和商业质感 |
| 风格复刻 | 参考已有视觉风格批量生成同调性图片 |
| 场景图生成 | 根据产品和场景参考生成营销环境图 |
| 万物上身 / 单品试穿 | 支持服装、鞋靴、配饰与一件式商品的多参考试穿和姿态锁定 |
| 模特迁移 | 在保持服装与主体特征的前提下迁移模特、场景和展示方式 |
| 服装解构 | 从穿搭图识别并拆分服装单品，生成可复用的产品素材 |
| 比例查询 | 辅助判断平台画幅与素材适配 |

## 模特姿势裂变

这是当前重点能力：在不破坏原模特身份和原场景风格的前提下，让 AI 学习动作参考图的姿势、构图和身体关系。

### 生成优先级

1. **模特整体参考图权重最高**  
   脸型、发型、肤色、体型、服装、光线和主场景调性必须优先保持。

2. **动作参考图只控制姿势与构图**  
   动作图用于提取身体角度、四肢关系、镜头范围、站姿、坐姿、倚靠方式，不复制参考图人物身份。

3. **场景允许轻量适配**  
   当动作需要墙面、椅子、沙发、桌沿或扶手等支撑关系时，允许在原场景风格内增加或调整支撑物，但不应大幅更换场景。

4. **拒绝原图直出**  
   结果不能只是返回原模特图，必须体现动作参考图的关键姿势变化。

5. **裁图后置处理**  
   生成结果可按当前画幅比例锁定裁切，方便输出平台所需构图。

### 动作反推工作流

- 将上传图片标记为“动作反推”，Agent 会逐张分析真实可见的裁图范围和人物画面占比。
- 反推内容覆盖身体朝向、人物斜度、重心、四肢关系、手部位置、视线、镜头距离和支撑物接触点。
- 反推结果可直接复制，也可加入动作提示词后继续生成；用户原始提示词会原样保留，不被 Agent 擅自改写。
- 多张生成采用单任务队列，上一张结束后再提交下一张，降低 Virse 并发限流影响。

### 动作库

动作库按商品品类和风格组织，适合用户未上传动作参考图时自动补齐商业姿势。

| 动作库 | 风格方向 |
| --- | --- |
| 通用服装动作库 | 百搭站姿、走路、半身、全身 |
| 男士衬衫 / Polo / T 恤 | 度假、街拍、咖啡厅、城市通勤 |
| 男士短裤 / 长裤 / 泳裤 | 运动、休闲、沙滩、户外 |
| 长裙 / 连衣裙 | 优雅、坐姿、侧身、裙摆展示 |
| Suri Mira 宫廷法式复古连衣裙 | 法式复古、宫廷感、花园、窗边、沙发、墙面倚靠 |
| 大码女装 / Y2K Editorial | 自信展示、高街、杂志感 |

## 技术架构

```mermaid
flowchart TD
    A[Browser UI] --> B[React Workspaces]
    B --> C[Visual Agent]
    B --> D[Creative Center]
    B --> E[Video / Doll / Model Workspaces]
    C --> F[DeepSeek / Text Providers]
    C --> G[Agent Harness + Tool Calls]
    D --> H[Unified Image Model Router]
    D --> I[Pose / Scene / Product Analysis]
    H --> J[Virse Creative Platform]
    H --> K[Gemini / Qwen / Relay APIs]
    B --> L[LocalStorage / IndexedDB]
    L --> M[Settings, Projects, Assets, Topic Memory]
    M --> N[Visual RAG Context]
    N --> C
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6 |
| UI | Utility CSS, Framer Motion, Lucide React |
| AI | DeepSeek Agent、Virse、`@google/genai`、`@google/generative-ai`、Vercel AI SDK |
| Storage / Memory | LocalStorage、IndexedDB、`idb`、项目记忆与 Visual RAG |
| State | React State, Zustand |
| Markdown | React Markdown, Remark GFM |
| Deployment | Vercel, Docker, Nginx, Static Hosting |

## 目录结构

```text
.
├── App.tsx                    # 根应用与工作台路由
├── components/                # 首页、聊天、设置、历史、通用 UI
├── Cyzx4/                     # 创意中心
│   ├── components/            # 主图、场景、姿势、修复、迁移等功能页
│   │   └── image-models/       # 创意图片模型选择、供应商识别与通道路由
│   ├── constants/             # 动作库与预设数据
│   ├── services/              # Agent、记忆、Visual RAG、生图与分析服务
│   │   └── agents/runtime/     # DeepSeek 适配、工具循环、上下文构建
│   ├── hooks/                 # 创意中心 hooks
│   ├── types/                 # 领域类型
│   └── utils/                 # API 路由、图片压缩、图像工具
├── AIVideo/                   # AI 视频工作台
├── DollFactory/               # 精修工作台
├── ModelFactory/              # 摄影实验室
├── XcAISTUDIO-main/           # 视频站
├── services/                  # Virse、请求错误处理等跨模块服务
├── public/                    # 静态资源
├── docs/                      # 文档与辅助资料
├── Dockerfile                 # 生产镜像
├── docker-compose.yml         # Docker 本地部署
├── vercel.json                # Vercel SPA rewrite
└── vite.config.ts             # Vite 配置
```

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- 至少配置一个文本 / Agent 服务和一个图片生成服务
- 可选：DeepSeek API Key、Virse API Key、Gemini API Key 或兼容中转服务 Key

### 安装依赖

```bash
npm install
```

### 配置环境变量

在根目录创建 `.env.local`：

```env
GEMINI_API_KEY=your_gemini_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

也可以不写环境变量，直接在应用的设置面板中填写 API Key、Base URL 和模型配置。

### 本地开发

```bash
npm run dev
```

默认开发服务端口为：

```text
http://localhost:3000
```

### 生产构建

```bash
npm run build
```

### 本地预览

```bash
npm run preview
```

## 部署

### Vercel

项目包含 `vercel.json`，已配置 SPA fallback。

| Setting | Value |
| --- | --- |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### Docker

```bash
docker compose up --build
```

启动后访问：

```text
http://localhost:8080
```

### 静态托管

本项目是 Vite SPA。任意静态托管平台都可以部署 `dist/`，但需要将所有路由回退到 `index.html`。

## 配置说明

设置面板会将 API、模型、工作区与 Agent 配置保存在浏览器本地。文本 / Agent 路由与图片生成路由相互独立。

| Key | 用途 |
| --- | --- |
| `user_api_key` / `user_gemini_api_key` | Gemini 原生 API Key（前者为当前统一设置键，后者兼容旧配置） |
| `user_gemini_base_url` | Gemini 原生 Base URL |
| `text_api_provider` | 文本 / Agent 服务选择 |
| `deepseek_enabled` | 是否启用 DeepSeek 原生 Agent |
| `deepseek_api_key` | DeepSeek API Key |
| `deepseek_base_url` | DeepSeek Base URL |
| `deepseek_model` | DeepSeek Agent 模型 |
| `deepseek_reasoning_effort` | DeepSeek 推理强度 |
| `virse_enabled` | 是否将 Virse 设为主要图片生成通道 |
| `virse_api_key` | Virse API Key |
| `virse_base_url` | Virse 正式或开发 API 节点 |
| `virse_space_id` / `virse_canvas_id` | 当前 Virse 工作区与画布 |
| `virse_model` | 当前 Virse 图片模型 |
| `yunwu_api_key` | 云雾中转 Key |
| `yunwu_base_url` | 云雾中转 Base URL |
| `plato_api_key` | 柏拉图中转 Key |
| `plato_base_url` | 柏拉图中转 Base URL |
| `jijing_api_key` | No.1 图中转 Key |
| `jijing_base_url` | No.1 图中转 Base URL |
| `agentName` | 自定义 Agent 名称 |
| `agentRole` | 自定义 Agent 角色 |
| `agentCapabilities` | 自定义 Agent 能力提示词 |

## 质量原则

- 模特图优先保持脸型、发型、肤色、体型比例和人物气质。
- 产品图优先保持结构、面料、纹理、图案、颜色和版型。
- 场景变化必须服务动作与构图，不应无意义更换背景。
- 动作参考图只提取姿势和身体关系，不复制人物和场景。
- 蒙版编辑只改变选区，未涂抹区域应尽可能保持原图。
- Agent 候选结果必须经过 👍 明确采纳后，才能成为长期视觉锚点。
- 生成结果必须经过人工复核后再用于付费投放或正式上架。

## 常见问题

| 问题 | 排查方向 |
| --- | --- |
| 生图失败 | 检查 API Key、Base URL、模型与中转启用状态 |
| 结果像原图没变化 | 检查动作参考图是否清晰，或补充说明明确“必须改变姿势” |
| 靠墙/坐姿悬空 | 动作参考图需要有明确接触点，也可补充要求同风格支撑物 |
| 商品细节漂移 | 增加商品细节图，并在补充说明中锁定版型和纹理 |
| Virse 蒙版图无法上传 | 确认已选择有效工作区/画布并重新测试连接；当前版本会通过 Virse 原生上传接口传输蒙版与参考图 |
| Virse 返回 429 / 502 | 生成任务会继续轮询而不会重复提交；等待当前队列结束后再重试失败项 |
| Agent 没记住临时指令 | “本次/这张/试一版”不会写入长期记忆；需要长期保留时明确使用“记住/以后/固定/品牌规范” |
| Agent 继续参考不满意的图 | 对该回复点击 👎；满意结果点击 👍 后才会成为后续视觉锚点 |
| 构建出现大 chunk 警告 | 多工作台体量较大，警告不等于构建失败 |

## Roadmap

- 生成结果自动 QA：身份一致性、产品一致性、动作匹配度、场景兼容度。
- 统一 Agent Skill 与运行时工具目录，扩展可安全执行的视觉工具覆盖率。
- 将用户反馈、失败原因和批准资产沉淀为可评测数据，为后训练与提示词回归测试做准备。
- Visual RAG 升级为语义检索、重排序和可解释引用。
- 更细的商业动作库：按平台、品类、季节、风格和镜头范围组合。
- 品牌视觉资产包：固定光线、色调、模特、场景、构图规则和批准资产。
- 团队级素材库与云端记忆：跨设备历史、多人协作、版本管理。
- 自动化冒烟测试：覆盖创意中心关键生图链路。

## License

This repository is proprietary unless a license file is added.

---

<div align="center">
  <strong>XcAI Studio</strong>
  <br />
  Fast, controlled and commercially usable AI visual production.
</div>
