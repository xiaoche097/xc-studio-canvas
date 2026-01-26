# SKYSPER 选品专家系统 - 部署指南

## 部署前准备

### 1. 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **内存**: >= 2GB RAM
- **磁盘空间**: >= 500MB

### 2. 必需的环境变量

创建 `.env.production` 文件：

```bash
# Gemini API Configuration
VITE_GEMINI_API_KEY=your_production_api_key_here
VITE_GEMINI_MODEL=gemini-3-pro-preview
VITE_USE_MOCK_AGENTS=false
```

---

## 快速部署

### 方式 1: Vercel 部署（推荐）

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 方式 2: Netlify 部署

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 部署
netlify deploy --prod
```

---

## 部署后检查清单

### 功能测试
- [ ] 首页正常加载
- [ ] 选品专家功能正常
- [ ] 关键词分析正常
- [ ] 商品列表正常
- [ ] 选品报告正常

### 性能测试
- [ ] 首页加载时间 < 3秒
- [ ] Lighthouse 性能分数 > 90
- [ ] 移动端性能良好

### 安全测试
- [ ] HTTPS 启用
- [ ] API Key 未暴露
- [ ] CORS 配置正确

---

## 支持和联系

- 📧 技术支持: support@skysper.com
- 🐛 问题报告: https://github.com/skysper/ai-studio/issues

---

© 2024-2026 SKYSPER Cross-Border AI. All rights reserved.
