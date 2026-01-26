# SKYSPER 选品专家系统 - 快速开始指南

## 5分钟快速上手

### 第一步：启动应用 (30秒)

```bash
# 确保你在项目根目录
cd d:/skysper-ai-studio

# 启动开发服务器
npm run dev
```

等待服务器启动，看到：
```
✓ ready in 414 ms
➜ Local:   http://localhost:3001/
```

### 第二步：打开应用 (10秒)

在浏览器中访问：**http://localhost:3001**

你会看到 SKYSPER 首页，显示：
- 🎨 SKYSPER 大标题
- Blue Ocean · Trending · Redesign AI Selection Expert
- 搜索框
- 5个功能卡片

### 第三步：进入选品专家 (10秒)

点击 **"图搜全球商机"** 卡片（标记为 HOT 🔥）

### 第四步：输入搜索条件 (30秒)

在搜索框中输入：
```
关键词：Hiking Backpack
平台：Amazon
国家：United States
```

点击右侧的 **橙色圆形搜索按钮** ⬆️

### 第五步：查看分析结果 (3分钟)

系统会自动执行以下步骤：

#### 1. 任务规划 ✅
显示4个任务：
- 德国站关键词趋势分析
- 市场规模与竞争格局分析
- 竞品深度分析
- 生成选品分析报告

#### 2. 关键词分析 ✅
显示：
- 关键词列表（前2个）
- 每个关键词下的商品预览图（3-6个）
- "查看全部关键词数据" 按钮

**点击按钮查看详情**：
- 关键词名称
- 搜索排名
- 趋势图
- 月搜索量
- 在售商品数
- 中国卖家占比
- 竞争指数
- 类目分布

#### 3. 商品列表 ✅
显示：
- 商品预览网格（前4个）
- "查看完整商品列表" 按钮

**点击按钮查看详情**：
- 商品图片
- 商品标题
- 国家、平台、类目
- 上架时间
- 销量排名
- 评分和评论数
- 价格

#### 4. 选品报告 ✅
显示：
- 紫色渐变卡片
- 报告摘要
- "查看详情" 按钮

**点击按钮查看完整报告**：
- 市场概览
- 细分赛道分析
- 关键词洞察
- 竞品分析
- 行动建议

---

## 常见问题

### Q: 为什么看到的是德国市场数据？
A: 默认使用 Mock 数据进行演示。要使用真实 API，请：
1. 编辑 `.env.local` 文件
2. 设置 `VITE_USE_MOCK_AGENTS=false`
3. 配置 `VITE_GEMINI_API_KEY=your_api_key`
4. 重启服务器

### Q: 如何测试不同的关键词？
A: 在搜索框中输入任何关键词，例如：
- Wireless Earbuds
- Yoga Mat
- Coffee Maker
- Running Shoes

### Q: 商品图片无法显示？
A: 这是正常的，系统会自动显示占位符。真实部署时会使用实际的商品图片。

### Q: 如何返回首页？
A: 点击左上角的 **"← 返回选品专家"** 按钮

---

## 下一步

### 1. 阅读完整文档
- [README.md](README.md) - 系统概述和功能介绍
- [TESTING_GUIDE.md](../TESTING_GUIDE.md) - 详细测试指南
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南

### 2. 自定义配置
- 修改 `.env.local` 配置真实 API
- 调整 `constants.ts` 中的功能卡片
- 自定义 `tailwind.config.js` 中的主题色

### 3. 开发新功能
- 添加新的分析类型
- 集成真实的 Amazon API
- 添加数据导出功能

---

## 快速命令参考

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 运行测试
npm test

# 代码格式化
npm run format

# 代码检查
npm run lint
```

---

## 技术支持

遇到问题？
- 📧 Email: support@skysper.com
- 🐛 Issues: https://github.com/skysper/ai-studio/issues
- 💬 Community: https://community.skysper.com

---

**祝你使用愉快！🎉**

© 2024-2026 SKYSPER Cross-Border AI. All rights reserved.
