# AI LOOK PRESET STUDIO
## AI Reference-to-Preset Photography Workspace

**PRD Version：** V1.0  
**产品类型：** Web AI 摄影调色 / 摄影效果管理工具  
**核心定位：** Reference Image → AI Learn Look → Preset → Apply Everywhere

---

# 1. 产品定义

AI LOOK PRESET STUDIO 是一款基于参考图片学习摄影视觉风格的 AI 图片处理工具。

用户无需理解 Lightroom、LUT、曲线、HSL、色彩分级或相机参数。

用户只需要：

**上传参考照片 → AI 学习摄影效果 → 保存为 Preset → 上传任意照片 → 一键统一成相同摄影感觉**

核心不是：

> AI 重新生成一张相似图片。

而是：

> AI 理解参考照片背后的摄影语言，并将它转换成可以长期调用的摄影预设。

---

# 2. 核心用户需求

传统工作流：

```text
看到喜欢的照片
↓
猜滤镜
↓
猜 Lightroom 参数
↓
手动调节
↓
每张照片重新调整
↓
不同照片效果漂移
```

AI LOOK PRESET 工作流：

```text
找到喜欢的参考图
↓
拖入 3–10 张
↓
AI ANALYZE
↓
CREATE LOOK
↓
保存 Preset
↓
任何新照片
↓
APPLY
```

用户不再寻找：

- 色温多少？
- 曲线怎么调？
- HSL 怎么调？
- 颗粒多少？
- 是什么胶片？
- 什么镜头？
- 怎么让所有图片统一？

这些全部交给 AI。

---

# 3. 产品核心价值

## 3.1 Reference → Preset

这是整个产品最重要的能力。

用户可以上传：

**1–12 张 Reference Images**

AI 自动判断这些照片的共同视觉语言，而不是简单平均颜色。

提取：

### LIGHT

- 光线方向
- 光线高度
- 光线软硬
- 光比
- 环境补光
- 阴影颜色
- 高光颜色

### CAMERA

- 镜头视觉焦段
- 景深
- 光圈感觉
- 快门视觉
- ISO / grain 感觉
- Optical softness
- Lens contrast

### COLOR

- White Balance
- Tint
- Exposure
- Contrast
- Highlight
- Shadow
- Black Point
- White Point

### COLOR SCIENCE

- Red
- Orange
- Yellow
- Green
- Aqua
- Blue
- Purple
- Magenta

分别分析：

Hue / Saturation / Luminance

### FILM

- Grain
- Grain Size
- Grain Roughness
- Halation
- Bloom
- Fade
- Highlight Roll-off
- Shadow response

### TEXTURE

- Sharpness
- Clarity
- Micro Contrast
- Skin rendering
- Digital / Film characteristics

最终生成：

```text
AI PRESET
```

---

# 4. 最重要的技术原则

## 不应该完全依赖生成式 Prompt

如果采用：

```text
原图
+
“请调整成这种胶片色调”
+
AI Image Generation
```

存在很大问题：

- 五官发生变化
- 产品发生变化
- 衣服纹理变化
- 图案变化
- 建筑变化
- 颜色漂移
- 每次生成结果不同

因此正式产品必须采用：

# HYBRID AI COLOR ENGINE

也就是：

```text
REFERENCE IMAGES
        ↓
AI LOOK ANALYSIS
        ↓
COLOR PROFILE
        ↓
LUT / CURVES / HSL / WB
        ↓
DETERMINISTIC IMAGE PROCESSING
        ↓
OPTIONAL AI RELIGHTING
```

---

# 5. 两种编辑模式

必须将产品拆成两个模式。

---

## MODE A
# COLOR MATCH

### 色彩匹配

用于：

参考图和目标照片光线条件大致一致。

例如：

参考：

晴天户外。

目标：

也是晴天户外。

此时：

**不调用生成式生图模型。**

只处理：

- White Balance
- Tone Curve
- Exposure
- RGB Curve
- HSL
- Color Grading
- Selective Color
- Grain
- Halation
- Sharpen
- Texture

优势：

### 几乎 100% 保留原图片内容。

人物不会变化。

服装不会变化。

产品不会变化。

---

## MODE B
# LIGHT MATCH

### 光感重建

例如：

Reference：

```text
强烈地中海太阳
硬光
蓝色天空
明显阴影
```

Target：

```text
阴天
平光
灰色环境
```

单纯调 LUT 无法得到同一种摄影效果。

此时 AI 提示：

> 当前照片的光线与该 Preset 差异较大，是否启用 AI Light Match？

开启以后：

```text
原图
↓
主体锁定
↓
AI Relighting
↓
重新建立太阳方向
↓
重建 Highlight / Shadow
↓
再应用 Color Preset
```

这个模式才调用生成式 AI。

---

# 6. 用户第一使用场景

用户进入：

# CREATE PRESET

页面。

---

## STEP 01

标题：

# What look do you want?

副标题：

**Drop in photos you love. AI will learn the photographic look.**

中央巨大 Drop Zone：

```text
┌─────────────────────────────┐
│                             │
│      + Add Reference        │
│                             │
│   JPG / PNG / WEBP / RAW    │
│                             │
│         1–12 images         │
│                             │
└─────────────────────────────┘
```

---

## STEP 02

用户上传：

```text
● ● ● ● ● ●
6 References
```

出现：

# Analyze Look

按钮。

---

## STEP 03

AI 分析动画。

不要显示：

```text
Processing 38%
```

建议做得更摄影化：

```text
Reading light...

Matching color response...

Analyzing film texture...

Building camera profile...

Creating your look...
```

---

# 7. AI 分析完成界面

页面左侧：

参考照片 Grid。

右侧：

# YOUR LOOK

例如：

```text
COSTA 135

Mediterranean Sun Film

Warm Sunlight
Dusty Cyan
35mm Grain
Medium Contrast
Warm Skin
Soft Highlight Roll-off
```

下面：

```text
[ SAVE PRESET ]

[ TRY ON A PHOTO ]
```

---

# 8. AI 自动命名

这是一个很好的产品体验。

用户不必自己命名。

AI 根据视觉风格自动产生：

## NAME

COSTA 135

## DESCRIPTION

Mediterranean Sun Film

---

另外例如：

```text
MILANO 400
Italian City Editorial

PARIS 200
Soft Overcast Film

SOHO 800
Downtown Flash

MALIBU 160
Warm Coastal Daylight

NOIR 800
Night Flash Film
```

数字可以作为品牌视觉语言。

不一定代表真正 ISO。

而是一种：

**摄影 Preset Naming System**

---

# 9. 主工作台

主页面：

# STUDIO

建议采用三栏结构。

```text
┌──────────────┬────────────────────────────┬──────────────┐
│              │                            │              │
│ LIBRARY      │         CANVAS             │   PRESET     │
│              │                            │              │
│ Photos       │                            │ COSTA 135    │
│              │        IMAGE               │              │
│ Looks        │                            │ Strength     │
│              │                            │ ━━━━━●━━━    │
│ Favorites    │                            │              │
│              │                            │ Exposure     │
│              │                            │ Contrast     │
│              │                            │ Grain        │
│              │                            │ Warmth       │
│              │                            │              │
│              │                            │ [ Apply ]    │
└──────────────┴────────────────────────────┴──────────────┘
```

---

# 10. UI 风格

视觉可以参考专业摄影产品的克制感，但不要直接复制 VSCO。

整体关键词：

**Minimal / Editorial / Quiet / Photography First**

---

## COLOR

主背景：

```text
#F4F3EF
```

暖灰白。

深色文字：

```text
#161616
```

辅助文字：

```text
#77746E
```

边框：

```text
#D9D7D0
```

Canvas 深色模式：

```text
#151515
```

图片成为页面最大的颜色来源。

UI 自己不要抢图片。

---

# 11. Typography

Logo / Heading：

现代 grotesk sans-serif。

推荐视觉：

- Helvetica Now
- Inter
- Neue Haas Grotesk 类似风格
- Geist

标题：

```text
LOOKS
STUDIO
CREATE
COSTA 135
```

全部尽量简洁。

正文不要过多。

---

# 12. UI 元素原则

避免：

- 大量渐变
- 紫蓝 AI 风
- 发光按钮
- 玻璃拟态
- 五颜六色 AI 图标
- ChatGPT 式聊天页面

产品应该像：

> 一个摄影师的软件。

而不是：

> 一个 AI 玩具。

---

# 13. HOME

首页第一屏不需要解释很多。

建议：

```text
AI LOOK

Turn reference photography
into reusable presets.

[ Create a Look ]
```

下面直接出现作品。

例如：

```text
COSTA 135
████ ████ ████

SOHO 800
████ ████ ████

MILANO 400
████ ████ ████
```

图片优先。

---

# 14. LOOK LIBRARY

核心模块：

# MY LOOKS

卡片：

```text
┌─────────────────┐

     PHOTO

     PHOTO

COSTA 135

Mediterranean Sun

6 References

└─────────────────┘
```

鼠标 Hover：

```text
APPLY
EDIT
DUPLICATE
...
```

---

# 15. PRESET DETAIL

点击：

COSTA 135

进入详情：

```text
COSTA 135
Mediterranean Sun Film

Created from 6 references
```

顶部大面积展示：

Reference Mosaic。

下面：

```text
LIGHT
Hard Mediterranean Sun

COLOR
Warm Ivory / Dusty Cyan

FILM
35mm Fine Grain

CONTRAST
Medium High
```

再下面：

# TRY THIS LOOK

拖照片即可测试。

---

# 16. Apply 页面

拖入目标图片：

```text
ORIGINAL             COSTA 135

████████              ████████
████████       →      ████████
████████              ████████
```

中间：

Before / After Slider。

底部只显示：

```text
Strength

0 ━━━━━━━━━●━━━━ 100
```

初级用户只需要一个参数。

---

# 17. Advanced Controls

点击：

**Fine Tune**

才展开：

```text
Light
Exposure
Contrast
Highlights
Shadows

Color
Temperature
Tint
Saturation

Film
Grain
Fade
Halation

Detail
Sharpness
Texture
```

默认全部隐藏。

避免吓到普通用户。

---

# 18. Preset Strength

Strength 不是简单透明度。

例如：

```text
20
40
60
80
100
```

应该分别控制：

Color Transform

Tone Curve

Film Texture

Color Grading

而不是：

Original × 20%
Preset × 80%

需要插值计算。

---

# 19. AI AUTO MATCH

每次上传 Target 图片之后：

AI 首先判断：

```text
Lighting Similarity     78%
Color Compatibility     91%
Exposure Compatibility  84%
```

如果高：

直接：

# COLOR MATCH

如果低：

弹出：

```text
LIGHT DIFFERENCE DETECTED

This image was photographed
under significantly different light.

[ Color only ]

[ Match Light + Color ]
```

这是非常重要的 UX。

---

# 20. Batch Edit

用户可以一次上传：

```text
1
5
10
20
50
100
```

张。

界面：

```text
32 PHOTOS

Preset
COSTA 135

Consistency
● LOCKED

[ APPLY TO ALL ]
```

---

# 21. Collection Consistency

增加：

# LOOK LOCK

默认开启。

作用：

整组照片先进行 Global Analysis。

确定统一：

- Skin baseline
- White point
- Black point
- Exposure range
- Blue response
- Green response

再分别转换。

避免：

第一张很黄。

第二张很冷。

第三张曝光很亮。

---

# 22. 智能主体保护

必须默认开启：

# CONTENT LOCK

保护：

- Face Identity
- Body
- Clothing
- Product
- Logo
- Pattern
- Texture
- Geometry

Color Mode 下：

原则上不得改变像素结构。

Light Match 下：

使用 Mask / Segmentation / Structural Reference 约束 AI。

---

# 23. AI Preset Data Structure

每个 Look 不应该保存成一大段 Prompt。

建议数据结构：

```json
{
  "id": "costa135",
  "name": "COSTA 135",

  "wb": {
    "temperature": 5450,
    "tint": 4
  },

  "tone": {
    "exposure": -0.15,
    "contrast": 14,
    "highlights": -24,
    "shadows": -12,
    "whites": -8,
    "blacks": -3
  },

  "film": {
    "grain": 24,
    "grainSize": 22,
    "roughness": 45
  },

  "lighting": {
    "type": "hard_daylight",
    "direction": "upper_side",
    "ratio": 5
  },

  "embedding": "...",

  "referenceImages": []
}
```

---

# 24. 更重要的数据

建议每个 Look 同时保存：

# LOOK EMBEDDING

也就是 AI 从全部参考照片抽取的风格向量。

Preset 实际由：

```text
Structured Parameters
+
3D LUT
+
Tone Curve
+
Style Embedding
+
Reference Thumbnails
```

组成。

这样未来升级模型以后：

Preset 不需要重新制作。

---

# 25. Reference Analysis Pipeline

系统：

```text
Reference 01
Reference 02
Reference 03
Reference 04
Reference 05
Reference 06
       ↓
Semantic Analysis
       ↓
Outlier Detection
       ↓
Common Look Extraction
       ↓
Lighting Profile
       ↓
Color Profile
       ↓
Camera Profile
       ↓
Film Profile
       ↓
LOOK EMBEDDING
       ↓
PRESET
```

---

# 26. Outlier Detection

例如用户上传 8 张。

其中：

7 张：

暖阳胶片。

1 张：

夜景闪光灯。

AI 不应该平均。

应该提示：

```text
1 image doesn't appear to belong
to this visual set.

[ Remove ]
[ Keep ]
```

这会显著提高 Preset 准确度。

---

# 27. 三种创建 Preset 的方式

CREATE 页面：

```text
Create Look
```

进入以后：

### FROM REFERENCES

上传参考图学习。

这是核心。

---

### FROM ONE PHOTO

从单张照片快速创建。

精度较低。

---

### FROM TEXT

例如：

```text
1990s Mediterranean
35mm summer editorial
```

AI 创建 Look。

这是辅助功能。

---

# 28. Marketplace / Preset Library

后续可以发展：

# DISCOVER

摄影师可以发布自己的 Preset。

例如：

```text
SUMMER 135
by XXXX

PARIS 400
by XXXX

FLASH 800
by XXXX
```

其他用户：

```text
SAVE LOOK
```

甚至可以售卖 Preset。

但不属于 MVP。

---

# 29. MVP V1

第一版不要做太多。

只做：

### 01
上传 Reference

### 02
AI Analyze

### 03
Create Preset

### 04
保存 Preset

### 05
上传 Target

### 06
Apply Preset

### 07
Before / After

### 08
Strength

### 09
Batch 1–10 Images

### 10
Export

做到这十个功能，产品逻辑已经成立。

---

# 30. MVP 页面结构

```text
/
Home

/studio
Photo Editor

/looks
Preset Library

/looks/create
Create Look

/looks/:id
Preset Detail
```

只有四个核心页面。

---

# 31. Navigation

顶部：

```text
AI LOOK

Studio
Looks
Create

                         Account
```

不要侧边栏堆很多东西。

保持克制。

---

# 32. Desktop Studio UI

建议：

```text
┌─────────────────────────────────────────────────────────┐
│ AI LOOK       STUDIO     LOOKS     CREATE               │
├───────────┬───────────────────────────────┬─────────────┤
│           │                               │             │
│ PHOTOS    │                               │ LOOK        │
│           │                               │             │
│ IMG 01    │                               │ COSTA 135   │
│ IMG 02    │            IMAGE              │             │
│ IMG 03    │                               │ Strength    │
│           │                               │ ━━━━━●━━    │
│           │                               │             │
│           │                               │ Light Match │
│           │                               │ ○           │
│           │                               │             │
│           │                               │ Fine Tune > │
│           │                               │             │
│           │                               │ APPLY       │
├───────────┴───────────────────────────────┴─────────────┤
│ ORIGINAL                                       EDITED   │
└─────────────────────────────────────────────────────────┘
```

---

# 33. 产品与 VSCO 的核心区别

VSCO：

```text
Preset Library
↓
用户选择已有 Preset
↓
调整
```

AI LOOK：

```text
用户提供任何视觉参考
↓
AI 学习
↓
创建自己的 Preset
↓
永久保存
↓
批量复用
```

这是产品最核心的差异。

---

# 34. 核心宣传语

推荐：

# Turn any photograph into a preset.

中文：

# 让任何照片，都成为你的摄影预设。

副标题：

**Show AI the photography you love.  
Create the look once. Use it everywhere.**

---

# 35. 产品第一原则

AI LOOK 的目标不是：

**Generate a new photograph.**

而是：

# Preserve the photograph. Transform the photography.

即：

**保留照片本身，改变它的摄影语言。**

这应该成为整个产品最重要的设计原则。