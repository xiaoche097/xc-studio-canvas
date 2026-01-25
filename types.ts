import { ReactNode } from "react";

export type Role = 'user' | 'ai';

export interface Message {
  id: string;
  role: Role;
  content: string;
  image?: string | null;
  images?: string[];
  component?: ReactNode;
  timestamp: number;
}

export enum WorkflowStep {
  INIT = 0,
  LAUNCH_PACKAGE = 1,
  STRATEGY_P0 = 2,
  VISUAL_P1 = 3,
  COPY_P2 = 4,
  PRODUCTION_SELECT = 5,  // 用户选择生成哪些图片
  P3_MAIN_IMAGE = 6,      // P3 主图生成
  P4_SECONDARY = 7,       // P4 副图生成
  P5_APLUS = 8,           // P5 A+生成
  PRODUCTION_P3_P5 = 9,   // 兼容旧版：全部生成
  COMPLETED = 10,
  MODEL_TRY_ON = 11,
  VIDEO_GENERATION = 12,
  MARKETING_IMAGE_GENERATION = 13,
  AMAZON_SELECTION = 14
}

// 生产选择类型
export type ProductionChoice = 'main' | 'secondary' | 'aplus' | 'all';


export interface CardProps {
  onConfirm: () => void;
  onRegenerate?: () => void;
  image?: string | null;
  launchData?: {
    productName: string;
    market: string;
    features: string[];
    material?: string;
    category?: string;
    targetAudience?: string;
  };
  strategyData?: {
    positioning: string;
    keywords: string;
    sellingPoints: string[];
  };
  visualData?: {
    lighting: string;
    levitation: string;
    colors: string[];
  };
  copyData?: {
    title: string;
    sellingPoints: { title: string; content: string }[];
  };
}