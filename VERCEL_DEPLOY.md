# Vercel 纯前端部署指南 (XC-Studio Canvas)

本项目前端位于 `web` 目录，专为 Vercel 托管进行了优化。

---

## 🚀 部署步骤

1. 登录 [Vercel 控制台](https://vercel.com/)，点击 **Add New...** ➔ **Project**；
2. 导入 GitHub 仓库：`xiaoche097/xc-studio-canvas`；
3. 在 **Configure Project** 界面进行如下配置：
   - **Root Directory**：点击 **Edit**，选择并输入 **`web`**（必须设置此项，代表只部署前端工程）；
   - **Framework Preset**：会自动识别为 **Vite**；
   - **Build Command**：保持默认关闭（默认执行 `vite build` 或 `npm run build`，**无需手动填写任何命令**）；
   - **Output Directory**：保持默认关闭（默认输出至 `dist`）；
4. **Environment Variables（环境变量）**（展开后按需添加）：
   - `GEMINI_API_KEY`（或 `VITE_GEMINI_API_KEY`）：您的 Google Gemini 密钥
   - `DEEPSEEK_API_KEY`：DeepSeek API 密钥（供前端 Serverless 路由使用）
   - `IMGBB_API_KEY`：备用图床 Key
5. 点击 **Deploy**，约 1 分钟即可部署成功！

---

## 🛠️ 常见报错说明

- **报错：`sh: line 1: cd: web: No such file or directory`**
  - **原因**：当 Vercel 的 Root Directory 设置为 `web` 时，工作目录已经在 `web` 文件夹内。如果项目根目录有 `cd web` 的旧命令就会冲突。
  - **解决**：我们已彻底清理了根目录冲突文件，仅保留 `web/vercel.json`，Vercel 会自动以标准 Vite 模式运行，不会再报此错误。
