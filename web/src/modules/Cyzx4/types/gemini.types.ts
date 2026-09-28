/**
 * Gemini API 相关的类型定义
 * 用于替代 as any，提升类型安全
 */

import { AspectRatio, ImageResolution } from '../types';

// ==================== 通用响应类型 ====================

export interface GeminiResponse {
    candidates?: GeminiCandidate[];
    text?: string;
    groundingMetadata?: GroundingMetadata;
}

export interface GeminiCandidate {
    content?: {
        parts?: GeminiPart[];
    };
    finishReason?: string;
    groundingMetadata?: GroundingMetadata;
}

export interface GeminiPart {
    text?: string;
    inlineData?: {
        data: string;
        mimeType: string;
    };
}

export interface GroundingMetadata {
    groundingChunks?: any[];
}

// ==================== 图像生成配置 ====================

export interface ImageGenerationConfig {
    imageConfig?: {
        aspectRatio?: AspectRatio | string;
        imageSize?: ImageResolution | string;
        negativePrompt?: string;
        sampleCount?: number;
    };
    temperature?: number;
    safetySettings?: SafetySetting[];
    candidateCount?: number;
    responseModalities?: string[];
}

export interface SafetySetting {
    category: string;
    threshold: string;
}

// ==================== 内容生成请求 ====================

export interface GenerateContentRequest {
    model: string;
    contents: ContentPart | ContentPart[];
    config?: ImageGenerationConfig;
}

export interface ContentPart {
    role?: string;
    parts: Part[];
}

export interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

// ==================== 图像引用 ====================

export interface ImageReference {
    base64: string;
    mimeType: string;
}

// ==================== 分析结果类型 ====================

export interface ProductAnalysisResult {
    scene_atmosphere?: string;
    model_outfit?: string;
    outfit_recommendation?: string;
    lighting_tone?: string;
    visual_vibe?: string;
    final_prompt: string;
}

// ==================== 生成选项 ====================

export interface GenerationOptions {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    count?: number;
    model?: string;
    retouch?: boolean;
}

// ==================== Prompt 优化 ====================

export interface PromptOptimizationParams {
    rawPrompt: string;
    refImages?: ImageReference[];
    refineInstruction?: string;
}

// ==================== 风格复刻 ====================

export interface StyleReplicationParams {
    styleReference: ImageReference;
    productImages: ImageReference[];
    customPrompt?: string;
    options?: GenerationOptions;
}

// ==================== 视频脚本 ====================

export interface VideoScriptScene {
    time: string;
    visual: string;
    audio: string;
    overlay: string;
}

// ==================== 座套生成参数 ====================

export interface SeatCoverGenerationParams {
    seatCoverImages: ImageReference[];
    productCategory: string;
    carModel: string;
    year: string;
    seatConfig: string;
    targetRow: string;
    angleMode: "PRESET" | "REFERENCE";
    angleValue: string | ImageReference[];
    aspectRatio: AspectRatio;
    resolution: ImageResolution;
    customRequest?: string;
    visualGuide?: ImageReference;
}

// ==================== 实时音频 ====================

export interface LiveSessionConfig {
    model: string;
    config: {
        responseModalities: string[];
        speechConfig?: {
            voiceConfig: {
                prebuiltVoiceConfig: {
                    voiceName: string;
                };
            };
        };
        systemInstruction?: {
            parts: Part[];
        };
    };
    callbacks: {
        onopen?: () => void;
        onmessage?: (message: any) => void;
        onclose?: () => void;
        onerror?: (error: any) => void;
    };
}

// ==================== 搜索结果 ====================

export interface SearchResult {
    text: string;
    grounding: any[];
}

export type WorkflowHint = 
  | 'inpainting'
  | 'pose-transfer' 
  | 'pose-fission'
  | 'storyboard-grid'
  | 'pose-replication-lock'
  | 'model-original-paste-back'
  | 'hero-pose-lock' 
  | 'main-angle-lock' 
  | 'scene-product-lock' 
  | 'strict-geometry-lock' 
  | 'clothing-effect' 
  | 'garment-replacement' 
  | 'garment-extraction'
  | 'magic-mannequin' 
  | 'clothing-modification' 
  | 'doll-modification' 
  | 'doll-retouching'
  | 'product-modification'
  | 'product-retouching'
  | 'listing-optimization'
  | 'face-lock'
  | 'lighting-replication'
  | 'photography-preset'
  | 'reference-refinement'
  | 'structural-repair-v2'
  | 'model-transfer'
  | 'single-item-try-on'
  | 'ecommerce-hero'
  | 'model-modification'
  | 'model-retouching';
