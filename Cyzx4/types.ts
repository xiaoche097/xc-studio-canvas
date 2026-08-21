import type { Content } from '@google/genai';

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
  SCENE_GENERATION = 'SCENE_GENERATION', // 场景图生成
  INSTAGRAM_SCENE = 'INSTAGRAM_SCENE', // 摄影预设实验室（保留枚举值以兼容旧导航状态）
  WHITE_BG_RETOUCH = 'WHITE_BG_RETOUCH', // 通用白底图精修
  PRODUCT_VIDEO = 'PRODUCT_VIDEO', // AI 生成产品视频
  SINGLE_ITEM_TRY_ON = 'SINGLE_ITEM_TRY_ON', // 单品试穿
  ECOMMERCE_HERO = 'ECOMMERCE_HERO', // 生成电商主图
  MODEL_SCENE_FISSION = 'MODEL_SCENE_FISSION', // 模特场景图裂变
  MODEL_FACE_SWAP = 'MODEL_FACE_SWAP', // 模特换脸
  UNIVERSAL_TRY_ON = 'UNIVERSAL_TRY_ON', // 万物上身 (模特换衣 / 人台换衣 / 鞋靴试穿)
  MODEL_ANGLE_CONTROL = 'MODEL_ANGLE_CONTROL' // 模特角度控制
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

// --------------------------------------------------------
// XC-STUDIO Canvas 画布全量类型定义
// --------------------------------------------------------

export type ImageModel =
  | 'Nano Banana Pro'
  | 'NanoBanana2'
  | 'GPT Image 1.5'
  | 'Flux.2 Max'
  | 'Seedream5.0'
  | string;

export type VideoModel =
  | 'Veo 3.1'
  | 'Veo 3.1 Fast'
  | 'Seedance 2.0 Fast'
  | 'Sora 2.0'
  | 'Sora 2'
  | 'Kling 2.0'
  | 'kling-3.0'
  | string;

export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'square'
  | 'arrow-right'
  | 'arrow-left'
  | 'bubble'
  | string;

export interface Marker {
  id: number | string;
  elementId: string;
  x: number;
  y: number;
  label?: string;
  description?: string;
  analysis?: any;
  cropUrl?: string;
}

export interface CanvasElement {
  id: string;
  type: 'image' | 'text' | 'shape' | 'video' | 'gen-image' | 'gen-video' | 'group' | string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  url?: string;
  originalUrl?: string;
  proxyUrl?: string;
  originalWidth?: number;
  originalHeight?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  lineHeight?: any;
  letterSpacing?: any;
  textTransform?: string;
  shapeType?: ShapeType;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  videoUri?: string;
  prompt?: string;
  aspectRatio?: string;
  imageModel?: ImageModel;
  videoModel?: VideoModel;
  duration?: string;
  resolution?: any;
  genModel?: string;
  genStartFrame?: string;
  genEndFrame?: string;
  genVideoRefs?: any;
  genRefImages?: any;
  genRefImage?: any;
  genAspectRatio?: string;
  genDuration?: string;
  genPrompt?: string;
  genResolution?: any;
  genQuality?: any;
  genFirstLastMode?: any;
  generatingType?: string;
  aspectRatioLocked?: boolean;
  status?: 'idle' | 'generating' | 'success' | 'error' | string;
  errorMessage?: string;
  children?: string[];
  isCollapsed?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  groupId?: string;
  rotation?: number;
  opacity?: number;
  isGenerating?: boolean;
  genError?: string;
  originalChildData?: any;
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
  };
}

export interface Template {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface InputBlock {
  id: string;
  type: 'text' | 'file' | string;
  text?: string;
  file?: File;
  previewUrl?: string;
  name?: string;
  size?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'model' | string;
  content?: string;
  text?: string;
  timestamp: number;
  attachments?: any;
  attachmentMetadata?: any;
  inputBlocks?: InputBlock[];
  thinking?: string;
  suggestedPrompts?: string[];
  agentData?: any;
  skillData?: any;
  kind?: string;
  workflowUi?: any;
  error?: boolean | string;
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  systemInstruction?: string;
}

export interface Project {
  id: string;
  title: string;
  updatedAt: string;
  createdAt?: string;
  elements: CanvasElement[];
  markers?: Marker[];
  conversations?: ConversationSession[];
  activeConversationId?: string;
  thumbnail?: string;
}

export * from './types/common';
export * from './types/agent.types';
export * from './types/skill.types';
