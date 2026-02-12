# 🧠 Prompt Optimization Engine V2.0

> **版本**: 2.1.0  
> **状态**: 已发布  
> **核心依赖**: Google Gemini 1.5 Pro / Flash

我们的 AI Studio 现已集成了第二代提示词优化引擎，能够将用户简短、泛泛的输入转化为符合专业摄影与商业设计标准的 Prompt，从而极大提升生成图像的质量。

## 🔥 核心特性

### 1. 文生图 (Text-to-Image) - 精准描述专家 (Precision Description Expert)

当您在 **"创意中心 (FusionTab)"** 或 **"编辑器 (EditorTab)"** 中输入纯文本描述（无参考图）并点击 Smart Optimization 时，系统会激活此模式。

- **工作原理**:
  - 系统内置了基于 Imagen 3.0 Nano Banana Skills 的专业知识库 (光影、构图、风格)。
  - **Analyze**: 识别抽象概念 (e.g., "好看的照片")。
  - **Expand**: 自动补全缺失的视觉要素 (光影类型、镜头焦段、材质细节)。
  - **Format**: 输出符合 Golden Formula 的结构化 Prompt。

- **示例**:
  - **输入**: "一只狗在车里"
  - **优化后**: "A golden retriever sitting in the back seat of a vintage car, golden hour lighting, shot on 85mm portrait lens, f/1.8, cinematic atmosphere, 8k resolution."

### 2. 图生图 (Image-to-Image) - 意图识别引擎 (Intent Recognition Engine)

当您在 **"编辑器 (Editor)"** 有底图的情况下，或者在 **"创意中心"** 上传了参考图时，系统会自动切换至此模式。

- **设计哲学**:
  - 许多 AI 工具会错误地将"修改指令"当作"画面描述"来处理。我们的引擎专注于 **意图识别**。
  - **四大核心指令**:
    1. **Add (添加)**: "Add [Object] at [Location]..."
    2. **Remove (删除)**: "Remove [Object], naturally fill background..."
    3. **Replace (替换)**: "Replace [Object] with [New Object]..."
    4. **Enhance (增强)**: "Enhance [Feature] to be [Adjective]..."

- **示例**:
  - **输入**: "把背景换成海滩" (当前有模特图)
  - **优化后**: "Replace background with a sunny beach scenery, soft bokeh, natural lighting integration, ensuring seamless blend with the model."

## 📚 知识库集成

Prompt Engine V2.0 集成了以下专业领域的知识库：

1. **💡 光影系统**: Natural (Golden Hour, Blue Hour), Artificial (Studio, Neon, Volumetric)
2. **📷 摄影机位**: Eye-level, Low angle, High angle, Dutch angle, Macro
3. **🎨 艺术风格**: Editorial, Commercial Product, Minimalist, Cyberpunk, Oil Painting
4. **💎 质量增强**: 8k resolution, highly detailed, sharp focus, masterpiece

## 🛠️ 如何使用

### 在编辑器中 (EditorTab)

1. 点击右侧边栏的 **"✨ AI 润色"** 按钮。
2. 输入您的修改意图 (e.g., "更亮一点", "加个太阳")。
3. 系统将自动生成优化后的英文指令。
4. 确认后，点击 **"生成 (Generate)"** 或 **"微调 (Refine)"**。

### 在创意中心 (FusionTab)

1. 开启底部的 **"✨ 智能优化"** 开关。
2. 输入简单的创意描述。
3. 点击 **"生成"**。
4. 系统将在后台自动优化 Prompt，并在生成前展示给您。

---

**技术实现路径**: `Cyzx4/services/geminiService.ts` -> `optimizePrompt` & `optimizeImageToImagePrompt`
