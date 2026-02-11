
export enum AppMode {
  PLANNING = 'PLANNING',     // Visual Planning (Was Director)
  FUSION = 'FUSION',         // Scene Fusion (New)
  RETOUCHING = 'RETOUCHING', // HD Upscale (Was Editor)
  SEAT_COVER = 'SEAT_COVER', // Seat Cover Fit (New)
  COPYWRITING = 'COPYWRITING', // Listing Copilot (New)
  VIDEO = 'VIDEO',           // Video Studio (New)
  TRENDS = 'TRENDS',         // Trend Insights (Kept)
  PRODUCT_SWAP = 'PRODUCT_SWAP', // Product Replacement Agent (New)
  SETTINGS = 'SETTINGS'      // Settings (New)
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
