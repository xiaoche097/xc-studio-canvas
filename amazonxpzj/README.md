# SKYSPER 选品专家系统 (Product Selection Expert)

## 系统概述

SKYSPER 选品专家是一个基于 AI 的跨境电商选品分析系统，通过多智能体协作完成关键词分析、商品搜索、市场洞察和选品报告生成。

## 核心功能

### 1. 智能任务规划
- 自动将用户需求拆解为4个子任务
- 任务包括：关键词分析、商品搜索、市场分析、报告生成

### 2. 关键词深度分析
- 搜索排名分析
- 12个月趋势数据
- 类目分布分析
- 月搜索量、在售商品数、中国卖家占比、竞争指数
- 每个关键词显示3-6个商品预览

### 3. 商品列表获取
- 完整的商品信息（图片、标题、价格、评分等）
- 销量排名（近30天）
- 类目路径
- 上架时间

### 4. 市场洞察分析
- 市场规模评估
- 竞争格局分析
- 价格带分布
- 中国卖家占比

### 5. 选品报告生成
- 市场概览
- 细分赛道分析（带机会评级）
- 关键词洞察
- 竞品分析
- 行动建议（按优先级排序）

## 技术架构

### 智能体系统

```
Orchestrator (主控智能体)
    ├── Keyword Agent (关键词分析)
    ├── Product Agent (商品搜索)
    ├── Market Agent (市场分析)
    └── Report Agent (报告生成)
```

### 数据流

```
用户输入 → Orchestrator 规划
    ↓
Keyword Agent → 关键词数据 + 商品预览
    ↓
Product Agent → 完整商品列表
    ↓
Market Agent → 市场洞察
    ↓
Report Agent → 选品报告
    ↓
UI 展示（带详情弹窗）
```

## 使用方法

### 1. 启动开发服务器

```bash
npm run dev
```

访问：http://localhost:3001

### 2. 进入选品专家

- 点击首页的"选品专家"卡片
- 或点击"图搜全球商机"卡片

### 3. 输入搜索条件

```
关键词：Hiking Backpack
平台：Amazon
国家：United States
联网搜索：开启/关闭
```

### 4. 查看分析结果

- **任务规划**：显示4个子任务
- **关键词分析**：显示关键词数据和商品预览
  - 点击"查看全部关键词数据"查看详情
- **商品列表**：显示热销商品
  - 点击"查看完整商品列表"查看详情
- **市场分析**：显示市场洞察
- **选品报告**：显示完整报告
  - 点击"查看详情"查看完整报告

## 配置说明

### 环境变量 (.env.local)

```bash
# Gemini API Key
VITE_GEMINI_API_KEY=your_api_key_here

# Gemini Model
VITE_GEMINI_MODEL=gemini-3-pro-preview

# Mock Mode (true=使用测试数据, false=使用真实API)
VITE_USE_MOCK_AGENTS=false
```

### Mock 模式 vs 真实 API 模式

**Mock 模式** (`VITE_USE_MOCK_AGENTS=true`)
- 使用预设的测试数据
- 快速响应，无需 API Key
- 适合开发和测试

**真实 API 模式** (`VITE_USE_MOCK_AGENTS=false`)
- 调用 Gemini API 生成真实分析
- 需要有效的 API Key
- 根据用户输入生成定制化分析

## 数据结构

### KeywordData

```typescript
interface KeywordData {
  keyword: string;                    // 关键词
  searchRank: number;                 // 搜索排名
  trendData: number[];                // 12个月趋势数据
  categoryDistribution: {             // 类目分布
    category: string;
    percentage: number;
  }[];
  monthlySearchVolume?: string;       // 月搜索量 (如 "€101.3w+")
  productCount?: string;              // 在售商品数 (如 "2.6w+")
  chineseSellerRatio?: string;        // 中国卖家占比 (如 "64.8%")
  competitionIndex?: number;          // 竞争指数 (如 33168)
  products?: Product[];               // 商品预览 (3-6个)
}
```

### Product

```typescript
interface Product {
  id: string;                         // 商品ID
  image: string;                      // 商品图片URL
  title: string;                      // 商品标题
  rating: string | number;            // 评分
  reviewCount: string | number;       // 评论数
  currency: string;                   // 货币符号
  price: string;                      // 价格
  listingDate: string;                // 上架时间
  salesRankLast30Days?: string;       // 近30天销量排名
  country?: string;                   // 国家
  platform?: string;                  // 平台
  category?: string;                  // 类目路径
}
```

## 组件说明

### 核心组件

- **LandingPage**: 首页，选择分析类型
- **RequirementsForm**: 需求表单，输入搜索条件
- **AgentExecutionView**: 智能体执行视图，显示分析过程
- **DetailModal**: 详情弹窗，显示关键词/商品/报告详情
- **FullReportView**: 完整报告视图

### 分析组件

- **TaskPlanner**: 任务规划展示
- **KeywordAnalysis**: 关键词分析表格
- **ProductList**: 商品列表表格
- **MarketInsight**: 市场洞察卡片
- **Sparkline**: 趋势图组件
- **CategoryPath**: 类目路径组件

## Agent Prompts

### Orchestrator Prompt
- 任务规划和拆解
- 智能调度子 Agent
- 结果整合

### Keyword Agent Prompt
- 关键词扩展
- 搜索排名分析
- 趋势预测
- 类目分布
- 商品预览生成

### Product Agent Prompt
- 商品搜索
- 详细信息获取
- 竞品对比
- 统计分析

### Market Agent Prompt
- 市场规模评估
- 竞争格局分析
- 价格分析

### Report Agent Prompt
- 数据整合
- 报告撰写
- 行动建议生成

## 开发指南

### 添加新的分析类型

1. 在 `constants.ts` 中添加新的 `LANDING_FEATURES`
2. 在 `RequirementsForm.tsx` 中添加对应的表单字段
3. 在 `orchestrator.ts` 中添加新的任务类型
4. 创建新的 Agent 类和 Prompt

### 自定义 UI 样式

所有样式使用 Tailwind CSS，主题色定义在 `tailwind.config.js`:

```javascript
colors: {
  'brand-orange': '#ED6D46',
  'brand-blue': '#4A90E2',
  'brand-dark': '#0A0A0A',
  'sky-light': '#F8FAFC'
}
```

### 调试技巧

1. **查看 Agent 执行日志**
   - 打开浏览器控制台
   - 查看 `[Orchestrator]`, `[KeywordAgent]` 等日志

2. **检查数据格式**
   - 在 `analysisStore.ts` 中添加 `console.log`
   - 查看 Agent 返回的原始数据

3. **测试 Mock 数据**
   - 设置 `VITE_USE_MOCK_AGENTS=true`
   - 修改 `mockData.ts` 中的测试数据

## 常见问题

### Q: 为什么关键词详情弹窗显示不完整？
A: 检查 `KeywordData` 类型是否包含所有必需字段，确保 Agent 返回了完整数据。

### Q: 商品图片无法显示？
A: 确保 `Product.image` 字段包含有效的图片 URL，系统会自动显示占位符。

### Q: Agent 返回的数据格式不正确？
A: 检查 Agent Prompt 中的输出格式要求，确保 JSON 格式正确。

### Q: 如何切换到真实 API 模式？
A: 在 `.env.local` 中设置 `VITE_USE_MOCK_AGENTS=false`，并配置有效的 `VITE_GEMINI_API_KEY`。

## 性能优化

1. **懒加载**: 详情弹窗按需加载
2. **虚拟滚动**: 大量数据使用虚拟滚动
3. **缓存**: Agent 结果缓存15分钟
4. **并行执行**: 独立任务并行执行

## 安全性

1. **API Key 保护**: 使用环境变量存储
2. **输入验证**: 所有用户输入都经过验证
3. **XSS 防护**: 使用 React 自动转义
4. **CORS**: 配置正确的 CORS 策略

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

© 2024 SKYSPER Cross-Border AI. All rights reserved.

## 联系方式

- 项目主页: https://github.com/skysper/ai-studio
- 问题反馈: https://github.com/skysper/ai-studio/issues
- 邮箱: support@skysper.com
