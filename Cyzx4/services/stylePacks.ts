export interface StyleVariant {
  id: string;
  name: string;
  whenToUse: string[];
  promptTemplate: string;
  negativePromptAdd: string;
  config: {
    model: string;
    config: {
      numberOfImages: number;
      aspectRatio: string;
      personGeneration: string;
      safetyFilterLevel: string;
      outputMimeType: string;
      outputCompressionQuality: number;
      language: string;
    };
  };
}

export interface StylePack {
  stylePackName: string;
  purpose: string;
  globalRules: {
    mustHave: string[];
    textPolicy: string;
    badgePolicy: string;
  };
  promptBlocks: Record<string, string>;
  negativePromptGlobal: string;
  styleVariants: StyleVariant[];
}

export const PLUSHTOY_STYLE_PACK: StylePack = {
  "stylePackName": "PlushToy-Brand-StylePack-v1 (GUND-like)",
  "purpose": "把玩偶/毛绒玩具做成“高级、治愈、礼物感强”的商业图片：可用于Amazon主图/A+/社媒/品牌KV。所有风格都保证：玩偶质感清晰、画面干净、可抱可亲。",
  "globalRules": {
    "mustHave": [
      "plush texture tack-sharp (fur fibers, stitching visible)",
      "clean uncluttered background",
      "gentle soft lighting (high-key, creamy whites)",
      "natural skin tones when people included",
      "toy is the emotional centerpiece and clearly visible"
    ],
    "textPolicy": "模型不生成任何可读文字；需要文案的地方用“negative space for headline (no text)”，文字后期叠加。",
    "badgePolicy": "允许“badge placeholder / circular empty space”，但不让模型生成奖章/可读字。"
  },
  "promptBlocks": {
    "BASE_STYLE": "premium plush toy commercial photography, soft diffused lighting, high-key creamy look, warm neutral palette with gentle pastels, clean composition, crisp plush fur texture and stitching, natural skin tones, minimal clutter, professional retouch, shallow depth of field with creamy bokeh, editorial advertising quality, ultra high resolution",
    "COPY_SPACE": "clean composition with generous negative space for headline overlay (no text)",
    "BADGE_PLACEHOLDER": "leave a clean circular space in the top-right corner for an award badge overlay (no text)",
    "HEART_DOODLE_OPTIONAL": "subtle hand-drawn heart doodles (no words, no letters)"
  },
  "negativePromptGlobal": "text, words, letters, logo, watermark, signature, misspelled words, copyright marks, UI elements, border, frame, blurry, low quality, pixelated, jpeg artifacts, noisy, harsh shadows, strong contrast, underexposed, overexposed, cluttered background, messy room, dirty fabric, lint, stains, plastic shine, oversaturated, color shift, distorted, deformed, melted plush, uncanny, creepy, scary, extra limbs, bad anatomy, malformed hands",
  "styleVariants": [
    {
      "id": "V1_WHITEBG_CATALOG",
      "name": "白底电商主图（最稳）",
      "whenToUse": ["Amazon主图", "电商SKU主图", "详情页参数图底图"],
      "promptTemplate": "[SUBJECT/PLUSH TOY] on pure white seamless background, centered composition, high-key softbox studio lighting, minimal soft shadow under product, crisp sharp focus showing plush fur fibers and stitching, accurate colors, e-commerce catalog product photography, clean and professional, ultra high resolution",
      "negativePromptAdd": "room background, props, gradients with noise, reflections, heavy shadows",
      "config": {
        "model": "imagen-3.0-generate-001",
        "config": {
          "numberOfImages": 4,
          "aspectRatio": "1:1",
          "personGeneration": "dont_allow",
          "safetyFilterLevel": "block_medium_and_above",
          "outputMimeType": "image/jpeg",
          "outputCompressionQuality": 95,
          "language": "auto"
        }
      }
    },
    {
      "id": "V2_PREMIUM_BABY_HOME",
      "name": "高端母婴家居（柔光治愈）",
      "whenToUse": ["品牌调性图", "A+场景图", "母婴内容营销"],
      "promptTemplate": "A tender moment of a baby/toddler cuddling [PLUSH TOY] in a bright neutral home interior (sofa, curtains, knit blanket), soft diffused window light, high-key creamy whites, warm beige and pastel palette, shallow depth of field with creamy bokeh, plush toy clearly visible with crisp texture, minimal uncluttered background, [COPY_SPACE], [BASE_STYLE]",
      "negativePromptAdd": "dark room, harsh flash, messy props, gritty film grain",
      "config": {
        "model": "imagen-3.0-generate-001",
        "config": {
          "numberOfImages": 4,
          "aspectRatio": "4:3",
          "personGeneration": "allow_all",
          "safetyFilterLevel": "block_medium_and_above",
          "outputMimeType": "image/jpeg",
          "outputCompressionQuality": 90,
          "language": "auto"
        }
      }
    },
    {
      "id": "V3_PASTEL_KAWAII_SOCIAL",
      "name": "社媒软萌（粉彩+玩偶堆叠）",
      "whenToUse": ["Instagram内容", "节日主题（Easter/礼物季）", "儿童向传播图"],
      "promptTemplate": "A smiling child cuddling a pile of colorful [PLUSH TOYS] on a bed/sofa, pastel palette (blush pink, lavender, baby blue, mint), soft diffused daylight, high-key clean look, toys framing the face, plush textures crisp and clean, cheerful wholesome mood, [COPY_SPACE], [BASE_STYLE]",
      "negativePromptAdd": "messy bed, cluttered room, overly saturated neon colors",
      "config": {
        "model": "imagen-3.0-generate-001",
        "config": {
          "numberOfImages": 4,
          "aspectRatio": "1:1",
          "personGeneration": "allow_all",
          "safetyFilterLevel": "block_medium_and_above",
          "outputMimeType": "image/jpeg",
          "outputCompressionQuality": 92,
          "language": "auto"
        }
      }
    },
    {
      "id": "V4_GRAPHIC_COLORBLOCK_KV",
      "name": "平面花朵色块KV（强设计感）",
      "whenToUse": ["活动KV", "电商banner", "社媒封面", "需要强识别度的系列图"],
      "promptTemplate": "[PLUSH TOY] centered, clean cutout look, on a flat graphic background with diagonal color blocks (peach pink top, warm yellow middle, coral red bottom), simple white daisy shapes in corners, even studio lighting, soft shadow under the toy, crisp plush fur texture, bright cheerful kid-friendly commercial design, [COPY_SPACE], no text",
      "negativePromptAdd": "photorealistic room background, complex patterns, clutter, realistic floor",
      "config": {
        "model": "imagen-3.0-generate-001",
        "config": {
          "numberOfImages": 4,
          "aspectRatio": "4:3",
          "personGeneration": "dont_allow",
          "safetyFilterLevel": "block_medium_and_above",
          "outputMimeType": "image/png",
          "outputCompressionQuality": 95,
          "language": "auto"
        }
      }
    }
  ]
};

export const STYLE_PACKS = [PLUSHTOY_STYLE_PACK];
