
export enum AppMode {
  PLANNING = 'PLANNING',     // Visual Planning (Was Director)
  FUSION = 'FUSION',         // Scene Fusion (New)
  RETOUCHING = 'RETOUCHING', // HD Upscale (Was Editor)
  SEAT_COVER = 'SEAT_COVER', // Seat Cover Fit (New)
  COPYWRITING = 'COPYWRITING', // Listing Copilot (New)
  IMAGE_CLEAN = 'IMAGE_CLEAN', // Image Cleanup Tool (Replaces Video)
  MODEL_TRANSFER = 'MODEL_TRANSFER', // Model Transfer
  MODEL_POSE_FISSION = 'MODEL_POSE_FISSION', // Model Pose Fission
  MODEL_ORIGINAL_PASTE_BACK = 'MODEL_ORIGINAL_PASTE_BACK', // Model Original Paste Back
  PRODUCT_REPAIR = 'PRODUCT_REPAIR', // 产品修复 (Product Repair) [deprecated]
  OUTFIT_EXTRACTION = 'OUTFIT_EXTRACTION', // 搭配提取 (Outfit Extraction)
  RATIO_QUERY = 'RATIO_QUERY', // Aspect Ratio Query (New)
  PRODUCT_SWAP = 'PRODUCT_SWAP', // Product Replacement Agent (New)
  INPAINTING = 'INPAINTING', // 局部替换 (Inpainting)
  STORYBOARD = 'STORYBOARD', // 分镜创作 (Storyboard)
  SCENE_GENERATION = 'SCENE_GENERATION' // 场景图生成
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE_3_2 = '3:2',
  PORTRAIT_2_3 = '2:3',
  LANDSCAPE_4_3 = '4:3',
  PORTRAIT_3_4 = '3:4',
  LANDSCAPE_5_4 = '5:4',
  PORTRAIT_4_5 = '4:5',
  LANDSCAPE_16_9 = '16:9',
  PORTRAIT_9_16 = '9:16',
  LANDSCAPE_21_9 = '21:9'
}

export enum ImageResolution {
  RES_05K = '0.5K',
  RES_1K = '1K',
  RES_2K = '2K',
  RES_4K = '4K'
}

export interface DirectorAnalysis {
  product: string;
  concept: string;
  model: string;
  prompt: string;
}

export interface LogMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export interface EditPoint {
  id: number;
  x: number;
  y: number;
  snapshot?: string;
}
