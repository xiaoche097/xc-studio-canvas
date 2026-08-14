import type { AspectRatio, ImageResolution } from '../types';

export type EcommerceHeroStep = 'input' | 'analyzing' | 'confirm' | 'generating' | 'complete';
export type EcommerceHeroMode = 'standard' | 'advanced';
export type EcommerceImageModelId = 'gpt-image-2' | 'gemini-3.1-flash-image-preview' | 'qwen-image-3.0-pro';
export type EcommerceResultStatus = 'pending' | 'submitting' | 'processing' | 'compositing' | 'done' | 'error' | 'cancelled';

export type EcommerceLanguageId =
  | 'none' | 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'ar' | 'ru'
  | 'th' | 'id' | 'vi' | 'ro' | 'es' | 'ms' | 'it' | 'he' | 'pt' | 'fil' | 'hi'
  | 'pl' | 'tr' | 'nl';

export type EcommercePlatformId =
  | 'smart' | 'taobao' | '1688' | 'tmall' | 'pinduoduo' | 'jd' | 'douyin'
  | 'amazon-aplus' | 'temu' | 'emag' | 'ebay' | 'shein' | 'shopee' | 'lazada'
  | 'tiktok' | 'ozon';

export interface EcommerceUploadedImage {
  id: string;
  name: string;
  mime: string;
  base64: string;
  preview: string;
}

export interface EcommerceCopyPlan {
  headline: string;
  subheadline: string;
  badges: string[];
}

export interface EcommerceHeroAnalysis {
  productIdentity: string;
  productName: string;
  productCategory: string;
  materialColor: string;
  nativeBrandMarks: string[];
  sellingPoints: string[];
  targetAudience: string;
  recommendedPlatform: EcommercePlatformId;
  platformReason: string;
  platformVisualStrategy: string;
  backgroundComposition: string;
  typographySafeZone: 'top' | 'bottom' | 'left' | 'right';
  copy: EcommerceCopyPlan;
  imagePlans: string[];
  riskWarnings: string[];
}

export interface EcommerceStyleAnalysis {
  palette: string;
  lighting: string;
  background: string;
  composition: string;
  propDensity: string;
  typographyDensity: string;
  forbiddenElements: string[];
  promptBlock: string;
}

export interface EcommerceCustomStyle {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail: string;
  referenceImages: string[];
  analysis: EcommerceStyleAnalysis;
}

export interface EcommerceHeroResult {
  id: string;
  status: EcommerceResultStatus;
  prompt: string;
  baseImageUrl?: string;
  imageUrl?: string;
  error?: string;
}

export interface EcommerceHeroRecord {
  id: string;
  createdAt: number;
  step: EcommerceHeroStep;
  mode: EcommerceHeroMode;
  productImages: EcommerceUploadedImage[];
  requirements: string;
  language: EcommerceLanguageId;
  platform: EcommercePlatformId;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  modelId: EcommerceImageModelId;
  outputCount: number;
  oneClick: boolean;
  selectedPresetId: string | null;
  selectedCustomStyleId: string | null;
  analysis: EcommerceHeroAnalysis | null;
  results: EcommerceHeroResult[];
  error: string;
}
