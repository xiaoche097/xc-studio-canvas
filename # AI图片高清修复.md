# AI图片高清修复工作流 - Web应用开发文档

## 项目概述

构建一个基于 **Gemini 3 Pro Image** 的图片高清修复Web应用，通过多步骤AI处理流程实现图片智能放大与修复。

---

## 技术栈

- **前端**: React/Vue + TailwindCSS
- **后端**: Node.js / Python FastAPI
- **AI模型**: Gemini 3 Pro Image (Google AI)
- **存储**: 临时文件存储 + Base64处理

---

## 工作流程图

```plain
用户上传图片
     ↓
[Step 0] 图像质量预评估
     ↓
[Step 1] 反推提示词（风格分析）
     ↓
[Step 2] 生成颜色稿
     ↓
[Step 3] 生成线稿
     ↓
[Step 4] 高清重建合成
     ↓
[Step 5] 相似度校验（可选迭代）
     ↓
输出高清图片
```

---

## Step 0: 图像质量预评估

### 功能说明

在处理前分析原图质量，为后续步骤提供参数依据。

### Prompt

````plain
你是一个专业的图像质量分析专家。请对上传的图片进行全面的质量评估。

## 分析维度

### 1. 基础参数
- 图片分辨率（宽 x 高）
- 文件格式
- 色彩模式（RGB/CMYK/灰度）
- 色彩深度

### 2. 质量评估（每项1-10分）
- 清晰度评分：检测模糊程度
- 噪点评分：检测噪点/颗粒程度
- 压缩损失评分：检测JPEG压缩伪影
- 曝光评分：检测过曝/欠曝区域
- 色彩饱和度评分

### 3. 处理建议
根据评估结果，输出JSON格式的处理参数建议：

```json
{
  "original_resolution": "宽x高",
  "quality_score": 0-100,
  "denoise_strength": 0-1,
  "sharpen_strength": 0-1,
  "color_correction_needed": true/false,
  "recommended_upscale_factor": 2/4/8,
  "processing_difficulty": "low/medium/high"
}
````

请直接输出分析结果，不要有多余解释。

```plain
---

## Step 1: 反推提示词（风格分析）

### 功能说明
深度分析原图的风格、结构、内容，生成可用于重建的完整提示词。

### Prompt
```

你是一位专业的AI绘画提示词工程师，擅长从图像中逆向推导出精准的生成提示词。请对上传的图片进行全面深度分析。

## 分析框架

### 模块一：主体内容描述

- 画面主体是什么（人物/动物/场景/物品）
- 主体的具体特征（外貌、服装、姿态、表情）
- 主体在画面中的位置和占比
- 主体与背景的关系

### 模块二：艺术风格识别

- 整体艺术风格（写实/动漫/插画/油画/水彩/赛博朋克/奇幻等）
- 具体风格流派或参考艺术家风格
- 线条特点（粗细、流畅度、风格化程度）
- 笔触质感（细腻/粗犷/平涂/渐变）

### 模块三：色彩与光影

- 主色调和配色方案
- 色彩饱和度和明度倾向
- 光源方向和类型（自然光/人工光/环境光）
- 光影对比度和氛围感
- 特殊光效（逆光/霓虹/发光效果）

### 模块四：构图与技术参数

- 构图方式（中心构图/三分法/对角线/框架式）
- 视角和镜头感（俯视/仰视/平视/广角/特写）
- 景深效果（背景虚化程度）
- 画面比例

### 模块五：氛围与情感

- 整体氛围（温馨/冷峻/神秘/活泼/忧郁）
- 传达的情感或故事感
- 时间感（白天/黄昏/夜晚/季节）

## 输出格式

请按以下JSON结构输出：

```json
{
  "positive_prompt": {
    "main": "主提示词，英文，包含所有关键描述，按重要性排序",
    "style_tags": ["风格标签1", "风格标签2"],
    "quality_tags": ["masterpiece", "best quality", "其他质量词"]
  },
  "negative_prompt": "应避免的元素，英文",
  "style_summary": "风格总结，中文，50字以内",
  "key_features": ["关键特征1", "关键特征2", "关键特征3"],
  "recommended_params": {
    "aspect_ratio": "宽高比",
    "style_weight": 0-1,
    "content_weight": 0-1
  }
}
```

请确保提示词精准、专业，可直接用于AI图像生成。

```plain
---

## Step 2: 生成颜色稿

### 功能说明
将原图转换为简化的色块/颜色稿，保留主要色彩分布信息。

### Prompt
```

你是一位专业的色彩分析与提取专家。请将上传的图片转换为颜色稿（色块图）。

## 处理要求

### 核心原则

1. 提取画面中的主要色彩区域，简化为清晰的色块
2. 保持原图的色彩面积比例关系
3. 保留画面主体的色彩辨识度
4. 去除细节纹理，只保留色彩分布信息

### 技术规范

- 色彩数量：根据画面复杂度，提取8-16个主要色彩
- 边缘处理：色块边缘保持平滑，可适度简化轮廓
- 渐变处理：大面积渐变区域可保留2-3个过渡色阶
- 输出分辨率：与原图保持一致

### 色彩保真度

- 保持原图的整体色调倾向（冷/暖）
- 保持主要色彩的色相准确性
- 保持明暗关系的基本分布
- 高光和阴影区域用对应的亮色/暗色块表示

### 输出要求

- 直接生成颜色稿图片
- 图片格式：PNG（保持色彩准确）
- 保持原图宽高比

请直接输出处理后的颜色稿图片。

```plain
---

## Step 3: 生成线稿

### 功能说明
从原图提取清晰的线稿，保留结构和轮廓信息。

### Prompt
```

你是一位专业的线稿提取专家。请将上传的图片转换为高质量线稿。

## 处理要求

### 核心原则

1. 提取画面中所有重要的轮廓线和结构线
2. 线条清晰、干净，无杂点和断线
3. 保持原图的结构完整性和空间关系
4. 输出纯净的黑白线稿（白底黑线）

### 线条层级规范

- **主轮廓线**：画面主体的外轮廓，线宽2-3px，最粗最实
- **结构线**：主体内部的重要结构分界，线宽1-2px
- **细节线**：五官、纹理等细节，线宽1px
- **辅助线**：背景和次要元素，线宽0.5-1px，可适度简化

### 处理细节

- 对于复杂纹理区域（如头发、毛发、草地），提取代表性结构线而非全部细节
- 保持线条的流畅性和连贯性
- 交叉线条处理清晰，避免糊成一团
- 保持原图的宽高比

### 输出要求

- 背景：纯白色 (#FFFFFF)
- 线条：纯黑色 (#000000)
- 格式：PNG
- 分辨率：与原图一致

请直接输出处理后的线稿图片。

```plain
---

## Step 4: 高清重建合成

### 功能说明
综合利用颜色稿、线稿和反推提示词，重建高清图片。

### Prompt
```

你是一位专业的AI图像重建专家。请根据提供的素材重建一张高清图片。

## 输入素材

1. **原图**：作为整体参考
2. **颜色稿**：提供色彩分布指导
3. **线稿**：提供结构和轮廓指导
4. **风格提示词**：{step1\_positive\_prompt}
5. **目标分辨率**：{target\_resolution}

## 重建要求

### 核心原则

1. 严格遵循线稿的结构和轮廓
2. 严格遵循颜色稿的色彩分布
3. 在此基础上添加细节和质感
4. 保持与原图高度一致的风格

### 质量要求

- 输出分辨率：原图的 {upscale\_factor} 倍
- 细节丰富度：在保持原图风格的前提下，适度增强细节
- 清晰度：边缘锐利，无模糊
- 无伪影：无AI生成常见的变形、多余肢体等问题

### 风格保持

- 严格匹配原图的艺术风格
- 保持原图的光影氛围
- 保持原图的色彩倾向
- 不要添加原图没有的元素

### 输出要求

- 格式：PNG
- 色彩模式：RGB
- 直接输出重建后的高清图片

## 负面约束

{step1\_negative\_prompt}

请直接输出重建后的高清图片。

```plain
---

## Step 5: 相似度校验（可选）

### 功能说明
对比原图与生成图的相似度，决定是否需要迭代优化。

### Prompt
```

你是一位专业的图像对比分析专家。请对比原图和生成图的相似度。

## 对比维度

### 1. 结构相似度 (0-100)

- 主体轮廓是否一致
- 构图是否一致
- 各元素位置关系是否正确

### 2. 色彩相似度 (0-100)

- 主色调是否一致
- 色彩分布是否一致
- 明暗关系是否一致

### 3. 风格相似度 (0-100)

- 艺术风格是否一致
- 笔触/质感是否一致
- 氛围是否一致

### 4. 细节保真度 (0-100)

- 关键细节是否保留
- 是否有明显错误或变形
- 是否有多余元素

## 输出格式

```json
{
  "structure_score": 0-100,
  "color_score": 0-100,
  "style_score": 0-100,
  "detail_score": 0-100,
  "overall_score": 0-100,
  "pass": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["优化建议1", "优化建议2"]
}
```

通过阈值：overall\_score >= 85

请直接输出JSON格式的评估结果。

````plain
---

## API 调用结构

### 统一请求格式

```javascript
// Gemini 3 Pro Image API 调用示例
async function callGeminiImage(prompt, images, options = {}) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-3-pro-image:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          ...images.map(img => ({
            inline_data: {
              mime_type: img.mimeType,
              data: img.base64Data
            }
          }))
        ]
      }],
      generationConfig: {
        temperature: options.temperature || 0.4,
        topP: options.topP || 0.95,
        maxOutputTokens: options.maxTokens || 8192
      }
    })
  });
  
  return response.json();
}
````

### 工作流调用顺序

```javascript
async function processImage(originalImage) {
  // Step 0: 质量预评估
  const qualityAssessment = await callGeminiImage(PROMPT_STEP0, [originalImage]);
  
  // Step 1: 反推提示词
  const styleAnalysis = await callGeminiImage(PROMPT_STEP1, [originalImage]);
  
  // Step 2: 生成颜色稿
  const colorMap = await callGeminiImage(PROMPT_STEP2, [originalImage]);
  
  // Step 3: 生成线稿
  const lineArt = await callGeminiImage(PROMPT_STEP3, [originalImage]);
  
  // Step 4: 高清重建
  const hdImage = await callGeminiImage(
    PROMPT_STEP4.replace('{step1_positive_prompt}', styleAnalysis.positive_prompt)
                .replace('{step1_negative_prompt}', styleAnalysis.negative_prompt),
    [originalImage, colorMap, lineArt]
  );
  
  // Step 5: 相似度校验（可选）
  const validation = await callGeminiImage(PROMPT_STEP5, [originalImage, hdImage]);
  
  if (validation.overall_score < 85) {
    // 迭代优化逻辑
  }
  
  return hdImage;
}
```

---

## UI 组件设计

### 页面布局

```plain
┌─────────────────────────────────────────────────────────┐
│  Header: AI图片高清修复工具                               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────────────┐   │
│  │             │  │  处理进度                        │   │
│  │  上传区域    │  │  ○ 质量评估  ○ 风格分析          │   │
│  │  拖拽/点击   │  │  ○ 颜色稿    ○ 线稿             │   │
│  │             │  │  ○ 高清重建  ○ 校验完成          │   │
│  └─────────────┘  └─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  处理结果预览                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │ 原图 │ │颜色稿│ │ 线稿 │ │ 重建 │ │ 对比 │          │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘          │
├─────────────────────────────────────────────────────────┤
│  参数设置                                               │
│  放大倍数: [2x] [4x] [8x]    质量优先 ←──●──→ 速度优先   │
│  [开始处理]                  [下载结果]                  │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

```jsx
// 主要组件结构
<ImageUploader />           // 图片上传组件
<ProcessingProgress />      // 处理进度显示
<ResultPreview />           // 结果预览（支持切换查看各步骤输出）
<ComparisonSlider />        // 原图/结果对比滑块
<ParameterPanel />          // 参数设置面板
<DownloadButton />          // 下载按钮
```

---

## 错误处理

```javascript
const ERROR_HANDLERS = {
  'IMAGE_TOO_LARGE': '图片尺寸过大，请上传小于10MB的图片',
  'INVALID_FORMAT': '不支持的图片格式，请上传JPG/PNG/WEBP',
  'API_TIMEOUT': '处理超时，请稍后重试',
  'GENERATION_FAILED': '生成失败，正在重试...',
  'LOW_QUALITY_RESULT': '生成质量不达标，正在优化重试...'
};
```

---

## 部署注意事项

1. **API密钥安全**：Gemini API Key 存储在后端环境变量，不暴露给前端
2. **文件大小限制**：建议限制上传图片 ≤ 10MB
3. **并发控制**：单用户同时处理任务数限制
4. **缓存策略**：中间结果（颜色稿、线稿）可缓存复用
5. **超时处理**：单步骤超时30秒，整体流程超时3分钟

---

## 扩展功能（可选）

- [ ] 局部修复：用户框选区域单独处理
- [ ] 批量处理：支持多图队列处理
- [ ] 风格迁移：应用其他图片的风格
- [ ] 历史记录：保存处理历史和参数
- [ ] 自定义提示词：高级用户可编辑提示词
  

