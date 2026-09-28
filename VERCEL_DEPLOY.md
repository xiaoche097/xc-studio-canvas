# Vercel 部署指南 (XC-Studio Canvas)

本项目前端已针对 Vercel 部署进行全面适配，支持开箱即用。

---

## 方式一：推荐部署方式（设置 Root Directory 为 `web`）

1. 登录 [Vercel 控制台](https://vercel.com/)，点击 **Add New...** -> **Project**。
2. 关联并导入您的 GitHub 仓库：`xiaoche097/xc-studio-canvas`。
3. 在 **Configure Project** 页面：
   - **Root Directory**：点击 Edit，选择并输入 **`web`**。
   - **Framework Preset**：Vercel 会自动识别为 **Vite**。
   - **Build Command**：默认即可（`vite build` 或 `npm run build`）。
   - **Output Directory**：默认即可（`dist`）。
4. 在 **Environment Variables** 添加以下环境变量（按需）：
   - `GEMINI_API_KEY`（或 `VITE_GEMINI_API_KEY`）：您的 Google Gemini 密钥
   - `DEEPSEEK_API_KEY`：DeepSeek API 密钥（供 `/api/deepseek/chat` 使用）
   - `IMGBB_API_KEY`：ImgBB 免费图床 API 密钥（备用图床）
5. 点击 **Deploy**，等待 1~2 分钟即可完成部署上线！

---

## 方式二：根目录直接部署（无需修改 Root Directory）

项目根目录已预设 `package.json` 与 `vercel.json`：
- 直接点击 **Deploy**，Vercel 会自动进入 `web` 目录完成依赖安装与编译，并输出至 `web/dist`。

---

## 常见注意事项

- **SPA 页面刷新 404**：`vercel.json` 已配置 `rewrites: [{ "source": "/(.*)", "destination": "/" }]`，确保任意二级路由刷新均正常。
- **Serverless 接口**：`api/` 下的 Node.js 函数会自动由 Vercel 解析为 Serverless Functions，处理 DeepSeek 对话流与图片中转下载。
