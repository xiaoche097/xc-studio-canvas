import React, { useState, useRef, useCallback, useEffect } from 'react';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import { downloadImageFile } from '../utils/imageDownload';
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Loader2,
  Download,
  ZoomIn,
  RefreshCw,
  X,
  Zap,
  AlertCircle,
  Layers,
  Palette,
  UserRoundCog,
  Shirt,
  Footprints,
  CheckCircle2,
  Plus,
  Trash2,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Camera,
  Grid3x3,
  Check,
  Eye,
  Lock,
  Gem,
  Scissors,
  Crop,
  Undo2,
  Paintbrush,
} from 'lucide-react';
import {
  generateUniversalTryOn,
  type UniversalTryOnProductImage,
} from '../services/geminiService';
import { compressImage, getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import MaskPaintEditor, { type SavedPaintMask } from './MaskPaintEditor';

export type UniversalTryOnSubMode = 'model' | 'mannequin' | 'shoes';
export type ClothingType = 'two-piece' | 'one-piece';
export type ActiveUploadTarget = 'top' | 'bottom' | 'accessory' | 'full' | 'shoes' | 'model';
export type ProductAngle = 'front' | 'back' | 'side' | 'detail' | 'outfit';

const ANGLE_CONFIG: Record<ProductAngle, { label: string; bgClass: string; desc?: string }> = {
  front: { label: '正面', bgClass: 'bg-emerald-500/90 hover:bg-emerald-600', desc: '单品正面展示' },
  back: { label: '背面', bgClass: 'bg-indigo-500/90 hover:bg-indigo-600', desc: '单品背面展示' },
  side: { label: '侧面', bgClass: 'bg-amber-500/90 hover:bg-amber-600', desc: '单品侧面展示' },
  detail: { label: '细节', bgClass: 'bg-rose-500/90 hover:bg-rose-600', desc: '局部细节特写' },
  outfit: { label: '搭配', bgClass: 'bg-purple-500/90 hover:bg-purple-600', desc: '整套搭配/套餐图 (引导 AI 精准提取目标单品)' },
};

const NEXT_ANGLE_MAP: Record<ProductAngle, ProductAngle> = {
  front: 'back',
  back: 'side',
  side: 'detail',
  detail: 'outfit',
  outfit: 'front',
};

const AngleBadgeButton: React.FC<{
  angle?: ProductAngle;
  onClick: (e: React.MouseEvent) => void;
}> = ({ angle = 'front', onClick }) => {
  const config = ANGLE_CONFIG[angle] || ANGLE_CONFIG.front;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`absolute left-1 top-1 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6rem] font-black text-white shadow-md transition-all duration-200 border border-white/20 backdrop-blur-xs active:scale-95 cursor-pointer ${config.bgClass}`}
      title="点击切换商品视角 (正面 ➔ 背面 ➔ 侧面 ➔ 细节 ➔ 搭配)"
    >
      <Camera className="h-2.5 w-2.5 text-white/90" />
      <span>{config.label}</span>
      <span className="text-[0.55rem] opacity-80">🔄</span>
    </button>
  );
};

type Stage = 1 | 2 | 3 | 4;
type SelectionModalType = 'model' | 'ratio' | 'resolution' | null;
type ShoeViewSlot = 0 | 1 | 2;

interface UploadedImage {
  id?: string;
  file?: File;
  preview: string;
  base64: string;
  mime: string;
  name?: string;
  width?: number;
  height?: number;
  angle?: ProductAngle;
  shoeViewSlot?: ShoeViewSlot;
  targetMaskBase64?: string;
  targetMaskPreview?: string;
  targetMaskOpacity?: number;
}

interface TryOnResultItem {
  id: string;
  modelReferenceId: string | null;
  modelPreview: string | null;
  url: string | null;
  originalUrl?: string;
  isNeckCropped?: boolean;
  status: 'generating' | 'done' | 'error';
  error?: string;
  requestId: string;
}

const cropTopNeckIfGenerated = (imageUrl: string, topCropRatio = 0.12): Promise<string> => {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(imageUrl);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        const cropY = Math.round(origH * topCropRatio);
        const targetH = origH - cropY;
        canvas.width = origW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageUrl);
        ctx.drawImage(img, 0, cropY, origW, targetH, 0, 0, origW, targetH);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Canvas 顶部去除脖子裁切失败:', err);
        resolve(imageUrl);
      }
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
};

interface UniversalTask {
  id: string;
  createdAt: number;
  subMode: UniversalTryOnSubMode;
  clothingType: ClothingType;
  shoeCategory?: string;
  shoeAngle?: string;
  shoeViewMode?: 'single' | 'multi';
  lockCropping?: boolean;
  status: 'editing' | 'generating' | 'done' | 'error';
  topImages: UploadedImage[];
  bottomImages: UploadedImage[];
  accessoryImages: UploadedImage[];
  fullImages: UploadedImage[];
  shoesImages: UploadedImage[];
  productImages: UploadedImage[];
  modelReferences: UploadedImage[];
  customPrompt: string;
  selectedModel: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  count: number;
  stage: Stage;
  agentStatus: string;
  agentLog: string[];
  cotStep: number;
  generatedResults: string[];
  resultItems: TryOnResultItem[];
}

const SUB_MODE_OPTIONS: Array<{
  id: UniversalTryOnSubMode;
  title: string;
  subtitle: string;
  icon: any;
  promptExample: string;
}> = [
  {
    id: 'model',
    title: '模特换衣',
    subtitle: '真人/模特服装穿搭拟真迁移',
    icon: Shirt,
    promptExample: '保持模特面部肤色与动作，服装自然贴合身体，呈现微风垂坠褶皱感。',
  },
  {
    id: 'mannequin',
    title: '人台换衣',
    subtitle: '人台服饰转化商业模特实穿',
    icon: Layers,
    promptExample: '将人台上的服装转换为时尚商业街拍模特穿着，呈现高级光影质感。',
  },
  {
    id: 'shoes',
    title: '鞋靴试穿',
    subtitle: '腿部/脚部鞋靴真实上脚试穿',
    icon: Footprints,
    promptExample: '鞋靴精准贴合模特双脚与踝关节透视，保持鞋面皮质光彩与地面对接阴影。',
  },
];

const MODEL_OPTIONS = [
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image',
    hint: '推荐',
    desc: '面部细节与面料纹理精准锁定，极致高精试穿算法',
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image',
    hint: '旗舰商业级',
    desc: '专业级画质细节 · 超强构图与高精度材质渲染',
  },
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    hint: '高清逼真',
    desc: '商业摄影级画质 · 适合大牌时尚 Lookbook 与时尚海报',
  },
  {
    id: 'qwen-image-3.0-pro',
    label: '千问3.0pro',
    hint: '千问图像旗舰',
    desc: '高质量图像生成与多参考图编辑',
  },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3 竖版', desc: '经典单反人像与海报首选' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4 竖版', desc: '电商时尚主图与模特常用' },
  { id: AspectRatio.SQUARE, label: '1:1 方版', desc: '正方形商品排版' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16 竖屏', desc: '手机全屏与短视频展示' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9 横版', desc: '画册长图与横屏展示' },
] as const;

const RESOLUTION_OPTIONS = [
  { id: ImageResolution.RES_2K, label: '2K 高清 (推荐)', desc: '标准电商画质与快速交付' },
  { id: ImageResolution.RES_4K, label: '4K 超清', desc: '极致 8K 放大面料与缝线纹理' },
] as const;

// Inline SVG Preset Recommendations
const SVG_TOP_PRESETS = [
  {
    name: '经典黑白拼袖T恤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" fill="%23f8fafc"><rect width="300" height="400" fill="%23f1f5f9"/><path d="M70,80 L110,60 L190,60 L230,80 L250,140 L210,160 L200,120 L200,320 L100,320 L100,120 L90,160 L50,140 Z" fill="%23ffffff" stroke="%23334155" stroke-width="4"/><path d="M70,80 L110,60 L130,100 L90,160 Z" fill="%230f172a"/><path d="M230,80 L190,60 L170,100 L210,160 Z" fill="%230f172a"/><path d="M130,60 Q150,85 170,60" fill="none" stroke="%23334155" stroke-width="4"/><text x="150" y="370" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23475569">上装 · 时尚T恤</text></svg>',
  },
  {
    name: '牛仔外套',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" fill="%23e0f2fe"><rect width="300" height="400" fill="%23f0f9ff"/><path d="M60,80 L110,50 L190,50 L240,80 L260,180 L210,190 L195,130 L195,330 L105,330 L105,130 L90,190 L40,180 Z" fill="%230284c7" stroke="%230369a1" stroke-width="4"/><line x1="150" y1="50" x2="150" y2="330" stroke="%230369a1" stroke-width="3"/><rect x="115" y="140" width="30" height="35" fill="%230369a1" rx="4"/><rect x="155" y="140" width="30" height="35" fill="%230369a1" rx="4"/><text x="150" y="370" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%230369a1">上装 · 复古牛仔</text></svg>',
  },
  {
    name: '真丝白衬衫',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fafafa"/><path d="M65,75 L110,55 L190,55 L235,75 L255,200 L215,205 L195,130 L195,340 L105,340 L105,130 L85,205 L45,200 Z" fill="%23ffffff" stroke="%2364748b" stroke-width="3"/><path d="M110,55 L150,110 L190,55 L170,55 L150,90 L130,55 Z" fill="%23e2e8f0" stroke="%2364748b" stroke-width="2"/><line x1="150" y1="110" x2="150" y2="340" stroke="%2394a3b8" stroke-width="2" stroke-dasharray="4 4"/><text x="150" y="375" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23475569">上装 · 法式衬衫</text></svg>',
  },
  {
    name: '条纹针织衫',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f8fafc"/><path d="M65,75 L110,55 L190,55 L235,75 L255,200 L215,205 L195,130 L195,330 L105,330 L105,130 L85,205 L45,200 Z" fill="%231e3a8a" stroke="%231e293b" stroke-width="3"/><line x1="105" y1="150" x2="195" y2="150" stroke="%23ffffff" stroke-width="10"/><line x1="105" y1="190" x2="195" y2="190" stroke="%23ffffff" stroke-width="10"/><line x1="105" y1="230" x2="195" y2="230" stroke="%23ffffff" stroke-width="10"/><line x1="105" y1="270" x2="195" y2="270" stroke="%23ffffff" stroke-width="10"/><text x="150" y="375" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%231e3a8a">上装 · 条纹毛衣</text></svg>',
  },
];

const SVG_BOTTOM_PRESETS = [
  {
    name: '浅蓝水洗牛仔裤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f0f9ff"/><path d="M100,60 L200,60 L215,350 L160,350 L150,140 L140,350 L85,350 Z" fill="%2338bdf8" stroke="%230284c7" stroke-width="4"/><line x1="150" y1="60" x2="150" y2="140" stroke="%230369a1" stroke-width="3"/><rect x="100" y="60" width="100" height="20" fill="%230284c7" rx="3"/><text x="150" y="380" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%230284c7">下装 · 牛仔阔腿裤</text></svg>',
  },
  {
    name: '米白色休凉西裤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fefce8"/><path d="M105,60 L195,60 L210,350 L158,350 L150,150 L142,350 L90,350 Z" fill="%23fef08a" stroke="%23ca8a04" stroke-width="3"/><line x1="125" y1="80" x2="125" y2="340" stroke="%23eab308" stroke-width="1 stroke-dasharray=3"/><line x1="175" y1="80" x2="175" y2="340" stroke="%23eab308" stroke-width="1 stroke-dasharray=3"/><text x="150" y="380" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23ca8a04">下装 · 垂感西裤</text></svg>',
  },
  {
    name: '高腰百褶半身裙',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fdf2f8"/><path d="M110,60 L190,60 L230,280 L70,280 Z" fill="%23f472b6" stroke="%23db2777" stroke-width="3"/><line x1="120" y1="60" x2="90" y2="280" stroke="%23be185d" stroke-width="2"/><line x1="140" y1="60" x2="130" y2="280" stroke="%23be185d" stroke-width="2"/><line x1="160" y1="60" x2="170" y2="280" stroke="%23be185d" stroke-width="2"/><line x1="180" y1="60" x2="210" y2="280" stroke="%23be185d" stroke-width="2"/><text x="150" y="340" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23db2777">下装 · 高腰半身裙</text></svg>',
  },
];

const SVG_FULL_PRESETS = [
  {
    name: '法式印花连衣裙',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23faf5ff"/><path d="M110,50 L190,50 L210,120 L240,340 L60,340 L90,120 Z" fill="%23c084fc" stroke="%239333ea" stroke-width="3"/><path d="M110,50 Q150,90 190,50" fill="none" stroke="%237e22ce" stroke-width="3"/><circle cx="120" cy="180" r="8" fill="%23ffffff"/><circle cx="180" cy="220" r="8" fill="%23ffffff"/><circle cx="140" cy="280" r="8" fill="%23ffffff"/><text x="150" y="375" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%239333ea">连体 · 优雅连衣裙</text></svg>',
  },
  {
    name: '干练工装连体裤',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f0fdf4"/><path d="M100,50 L200,50 L220,130 L210,350 L155,350 L150,180 L145,350 L90,350 L80,130 Z" fill="%234ade80" stroke="%2316a34a" stroke-width="3"/><rect x="110" y="90" width="35" height="30" fill="%2316a34a" rx="4"/><rect x="155" y="90" width="35" height="30" fill="%2316a34a" rx="4"/><text x="150" y="380" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%2316a34a">连体 · 工装裤</text></svg>',
  },
];

export const SVG_SHOES_PRESETS = [
  {
    name: '时尚小白鞋/运动鞋',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f8fafc"/><path d="M50,220 C70,160 140,150 200,160 C240,165 260,180 270,220 C275,245 250,260 220,260 L60,260 Z" fill="%23ffffff" stroke="%23334155" stroke-width="4"/><path d="M50,250 L270,250 C270,265 250,275 220,275 L60,275 Z" fill="%23e2e8f0" stroke="%23334155" stroke-width="3"/><line x1="120" y1="170" x2="135" y2="210" stroke="%23334155" stroke-width="3"/><line x1="145" y1="170" x2="160" y2="210" stroke="%23334155" stroke-width="3"/><line x1="170" y1="170" x2="185" y2="210" stroke="%23334155" stroke-width="3"/><text x="150" y="340" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%230f172a">鞋靴 · 时尚小白鞋</text></svg>',
  },
  {
    name: '高级皮质短靴/马丁靴',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fafaf9"/><path d="M90,90 L160,90 C165,150 170,170 210,180 C245,190 265,210 265,240 C265,260 240,270 200,270 L85,270 Z" fill="%231c1917" stroke="%230c0a09" stroke-width="4"/><rect x="80" y="265" width="190" height="15" fill="%2344403c" rx="3"/><line x1="125" y1="100" x2="125" y2="220" stroke="%2378716c" stroke-width="2" stroke-dasharray="4 4"/><text x="150" y="340" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%231c1917">鞋靴 · 复古马丁短靴</text></svg>',
  },
  {
    name: '优雅尖头高跟鞋',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fff1f2"/><path d="M60,160 C90,160 130,210 180,225 C220,235 270,240 280,240 C275,250 250,255 210,255 C160,255 110,230 80,180 Z" fill="%23f43f5e" stroke="%23be123c" stroke-width="3"/><path d="M75,175 L65,275 L80,275 L85,185 Z" fill="%23be123c"/><text x="150" y="340" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%23be123c">鞋靴 · 尖头高跟鞋</text></svg>',
  },
  {
    name: '英伦复古乐福鞋',
    preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23fefce8"/><path d="M70,180 C90,140 160,145 200,160 C240,170 265,190 270,225 C275,245 250,255 210,255 L70,255 Z" fill="%2378350f" stroke="%23451a03" stroke-width="4"/><rect x="150" y="170" width="35" height="15" fill="%23f59e0b" rx="3"/><rect x="65" y="255" width="210" height="12" fill="%23451a03" rx="2"/><text x="150" y="340" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="%2378350f">鞋靴 · 复古乐福鞋</text></svg>',
  },
];

export const SHOE_CATEGORY_OPTIONS = [
  { id: 'sneakers', label: '板鞋/运动鞋', icon: '👟', prompt: 'commercial lifestyle sneakers, clean outsole' },
  { id: 'heels', label: '高跟鞋/单鞋', icon: '👠', prompt: 'elegant high heels, sleek ankle profile' },
  { id: 'boots', label: '短靴/马丁靴', icon: '🥾', prompt: 'stylish leather ankle boots, structured silhouette' },
  { id: 'loafers', label: '乐福鞋/皮鞋', icon: '👞', prompt: 'classic leather loafers, refined metallic accent' },
  { id: 'sandals', label: '凉鞋/拖鞋', icon: '👡', prompt: 'casual summer sandals, elegant strap structure' },
] as const;

export const SHOE_ANGLE_OPTIONS = [
  { id: 'close-up', label: '腿部/脚部特写', desc: '聚焦下半身腿部与脚部关节', prompt: 'close-up shot focusing on legs and footwear' },
  { id: 'walking', label: '迈步动态走姿', desc: '展现真实侧身迈步动感与拉长伸展', prompt: 'full body dynamic walking pose, leg extending forward' },
  { id: 'sitting', label: '优雅坐姿露脚', desc: '坐在椅边或阶梯，脚踝自然悬空倾斜', prompt: 'sitting elegantly on edge with ankle angled naturally' },
  { id: 'full-body', label: '全身立姿穿搭', desc: '全身穿搭视效，突出整体比例配合', prompt: 'full length standing pose showcasing complete outfit & footwear' },
] as const;

export const MULTI_SHOES_PRESETS = [
  {
    name: 'Adidas 经典复古运动鞋 (多视角组)',
    group: [
      {
        name: '45度透视主视角',
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f1f5f9"/><path d="M40,160 C60,110 130,100 200,120 C240,130 260,150 270,190 C275,215 250,230 210,230 L50,230 Z" fill="%23ffffff" stroke="%230f172a" stroke-width="4"/><path d="M40,220 L270,220 C270,235 250,245 210,245 L50,245 Z" fill="%231e293b"/><line x1="120" y1="130" x2="150" y2="185" stroke="%230f172a" stroke-width="5"/><line x1="145" y1="130" x2="175" y2="185" stroke="%230f172a" stroke-width="5"/><line x1="170" y1="130" x2="200" y2="185" stroke="%230f172a" stroke-width="5"/><text x="150" y="270" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="%23475569">视角1 · 45°透视</text></svg>',
      },
      {
        name: '外侧平视角度',
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f1f5f9"/><path d="M50,180 C80,140 140,140 200,150 C240,155 265,175 270,205 C270,220 250,230 210,230 L50,230 Z" fill="%23ffffff" stroke="%230f172a" stroke-width="4"/><path d="M50,220 L270,220 C270,230 250,240 210,240 L50,240 Z" fill="%231e293b"/><line x1="130" y1="150" x2="150" y2="200" stroke="%230f172a" stroke-width="5"/><line x1="155" y1="150" x2="175" y2="200" stroke="%230f172a" stroke-width="5"/><line x1="180" y1="150" x2="200" y2="200" stroke="%230f172a" stroke-width="5"/><text x="150" y="270" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="%23475569">视角2 · 外侧正视</text></svg>',
      },
      {
        name: '内侧平视角度',
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f1f5f9"/><path d="M250,180 C220,140 160,140 100,150 C60,155 35,175 30,205 C30,220 50,230 90,230 L250,230 Z" fill="%23ffffff" stroke="%230f172a" stroke-width="4"/><path d="M250,220 L30,220 C30,230 50,240 90,240 L250,240 Z" fill="%231e293b"/><line x1="170" y1="150" x2="150" y2="200" stroke="%230f172a" stroke-width="5"/><line x1="145" y1="150" x2="125" y2="200" stroke="%230f172a" stroke-width="5"/><line x1="120" y1="150" x2="100" y2="200" stroke="%230f172a" stroke-width="5"/><text x="150" y="270" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="%23475569">视角3 · 内侧正视</text></svg>',
      },
    ],
  },
  {
    name: '棕色复古慢跑鞋 (多视角组)',
    group: [
      {
        name: '斜俯视角度',
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23fef3c7"/><path d="M60,150 C80,100 150,90 210,110 C250,120 270,140 275,180 C275,210 250,225 210,225 L60,225 Z" fill="%23b45309" stroke="%2378350f" stroke-width="4"/><text x="150" y="270" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="%2378350f">视角1 · 斜俯视</text></svg>',
      },
      {
        name: '正侧面角度',
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23fef3c7"/><path d="M50,175 C80,135 140,135 200,145 C240,150 265,170 270,200 C270,215 250,225 210,225 L50,225 Z" fill="%23d97706" stroke="%2378350f" stroke-width="4"/><text x="150" y="270" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="%2378350f">视角2 · 经典侧面</text></svg>',
      },
      {
        name: '侧后视角',
        preview: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23fef3c7"/><path d="M90,120 L210,120 L225,230 L75,230 Z" fill="%23b45309" stroke="%2378350f" stroke-width="4"/><text x="150" y="270" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="%2378350f">视角3 · 侧后视角</text></svg>',
      },
    ],
  },
];

const SelectionModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div
      className="w-full max-w-2xl overflow-hidden rounded-3xl border border-pastel-border bg-white shadow-2xl dark:bg-[#10192b]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-pastel-border px-6 py-4">
        <h3 className="text-base font-black text-pastel-text">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-pastel-bg text-pastel-muted hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
    </div>
  </div>
);

const COT_STEPS = [
  { id: 1, label: "服饰/鞋靴结构解构", desc: "正在分析商品剪裁、领口/鞋楦版型与印花特征..." },
  { id: 2, label: "模特体态与骨架匹配", desc: "正在分析人体 3D 透视骨架、脚部关节与肤色光照..." },
  { id: 3, label: "三维物理拟合与变态重绘", desc: "正在将服装/鞋靴柔性弯曲变形并包裹人体曲面..." },
  { id: 4, label: "环境光影与阴影重构", desc: "正在匹配现场主光、环境软光与脚部/贴身阴影..." },
  { id: 5, label: "材质纹理与缝线增强", desc: "正在渲染 8K 级面料织纹、皮质光泽与金属扣细节..." },
  { id: 6, label: "边缘自然融合", desc: "正在平滑衣领、袖口与脚踝边界，消除违和痕迹..." },
  { id: 7, label: "Color Guard 色彩调和", desc: "正在校准商品原色，防止色偏与皮肤泛红..." },
  { id: 8, label: "商业级高保真交付", desc: "正在生成高清试穿效果大图..." },
];

const createNewTask = (subMode: UniversalTryOnSubMode = 'model'): UniversalTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  subMode,
  clothingType: 'two-piece',
  shoeCategory: undefined,
  shoeAngle: undefined,
  shoeViewMode: 'single',
  lockCropping: true,
  status: 'editing',
  topImages: [],
  bottomImages: [],
  accessoryImages: [],
  fullImages: [],
  shoesImages: [],
  productImages: [],
  modelReferences: [],
  customPrompt: '',
  selectedModel: MODEL_OPTIONS[0].id,
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  count: 1,
  stage: 1,
  agentStatus: '输入准备 Agent · 等待素材',
  agentLog: ['已初始化万物上身任务'],
  cotStep: 0,
  generatedResults: [],
  resultItems: [],
});

interface UniversalTryOnTabProps {
  isActive?: boolean;
}

interface TryOnGenerationContext {
  productImgs: UniversalTryOnProductImage[];
  fullPrompt: string;
}

const UniversalTryOnTab: React.FC<UniversalTryOnTabProps> = ({ isActive = true }) => {
  const [tasks, setTasks] = useState<UniversalTask[]>(() => [createNewTask('model')]);
  const [activeTaskId, setActiveTaskId] = useState<string>(() => tasks[0].id);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [selectionModal, setSelectionModal] = useState<SelectionModalType>(null);
  const [activeUploadTarget, setActiveUploadTarget] = useState<ActiveUploadTarget>('top');
  const [activeShoeSlot, setActiveShoeSlot] = useState<ShoeViewSlot>(0);

  const currentTask = tasks.find((t) => t.id === activeTaskId) || tasks[0];
  const accessoryImages = currentTask.accessoryImages ?? [];
  const legacyShoeImages = currentTask.shoesImages.filter((image) => image.shoeViewSlot === undefined);
  const shoeImagesBySlot = ([0, 1, 2] as ShoeViewSlot[]).map(
    (slot) => currentTask.shoesImages.find((image) => image.shoeViewSlot === slot) ?? legacyShoeImages[slot]
  );

  const generationControllersRef = useRef(new Map<string, { taskId: number; controller: AbortController }>());
  const generationSequenceRef = useRef(0);
  const isLoading = currentTask.status === 'generating';

  const startGenerationTask = (taskId: string) => {
    const controller = new AbortController();
    const generationId = ++generationSequenceRef.current;
    generationControllersRef.current.set(taskId, { taskId: generationId, controller });
    return { taskId: generationId, signal: controller.signal };
  };

  const cancelGenerationTask = (taskId: string) => {
    generationControllersRef.current.get(taskId)?.controller.abort();
  };

  const finishGenerationTask = (taskId: string, generationId: number) => {
    if (generationControllersRef.current.get(taskId)?.taskId === generationId) {
      generationControllersRef.current.delete(taskId);
    }
  };

  useEffect(() => {
    if (!tasks.some((task) => task.status === 'generating')) return;
    const preventAccidentalUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventAccidentalUnload);
    return () => window.removeEventListener('beforeunload', preventAccidentalUnload);
  }, [tasks]);
  const [error, setError] = useState<string | null>(null);

  // Lightbox Zoom Modal Image State (For ALL images)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [maskEditorImageId, setMaskEditorImageId] = useState<string | null>(null);

  // File input refs
  const topInputRef = useRef<HTMLInputElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const accessoryInputRef = useRef<HTMLInputElement>(null);
  const fullInputRef = useRef<HTMLInputElement>(null);
  const shoesInputRef = useRef<HTMLInputElement>(null);
  const shoeUploadSlotRef = useRef<ShoeViewSlot>(0);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const generationContextsRef = useRef<Map<string, TryOnGenerationContext>>(new Map());

  // Drag states
  const [isDraggingTop, setIsDraggingTop] = useState(false);
  const [isDraggingBottom, setIsDraggingBottom] = useState(false);
  const [isDraggingAccessory, setIsDraggingAccessory] = useState(false);
  const [isDraggingFull, setIsDraggingFull] = useState(false);
  const [isDraggingShoes, setIsDraggingShoes] = useState(false);
  const [isDraggingModel, setIsDraggingModel] = useState(false);

  useEffect(() => {
    if (currentTask.subMode === 'shoes') {
      setActiveUploadTarget('shoes');
      return;
    }

    if (currentTask.subMode === 'mannequin' || currentTask.clothingType === 'one-piece') {
      setActiveUploadTarget('full');
      return;
    }

    setActiveUploadTarget('top');
  }, [activeTaskId, currentTask.subMode, currentTask.clothingType]);

  const updateCurrentTask = useCallback((updater: (task: UniversalTask) => UniversalTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTaskId ? updater(t) : t))
    );
  }, [activeTaskId]);

  const maskEditorImage = currentTask.modelReferences.find((image) => image.id === maskEditorImageId) || null;

  const saveModelReferenceMask = useCallback((mask: SavedPaintMask) => {
    if (!maskEditorImageId) return;
    updateCurrentTask((task) => ({
      ...task,
      modelReferences: task.modelReferences.map((image) => image.id === maskEditorImageId
        ? {
            ...image,
            targetMaskBase64: mask.base64,
            targetMaskPreview: mask.preview,
            targetMaskOpacity: mask.opacity,
          }
        : image),
      generatedResults: [],
      resultItems: [],
      status: 'editing',
      stage: 1,
      agentStatus: mask.base64 ? '输入准备 Agent · 已保存模特图涂抹区域' : '输入准备 Agent · 已清除模特图涂抹区域',
    }));
    setMaskEditorImageId(null);
  }, [maskEditorImageId, updateCurrentTask]);

  const [angleModal, setAngleModal] = useState<{
    target: ActiveUploadTarget | 'top' | 'bottom' | 'full' | 'accessory' | 'shoes';
    index: number;
    currentAngle: ProductAngle;
  } | null>(null);

  const handleSetAngle = useCallback((
    target: ActiveUploadTarget | 'top' | 'bottom' | 'full' | 'accessory' | 'shoes',
    index: number,
    newAngle: ProductAngle
  ) => {
    updateCurrentTask((t) => {
      const updateList = (list: UploadedImage[]) =>
        list.map((img, i) => {
          if (i !== index) return img;
          return { ...img, angle: newAngle };
        });

      if (target === 'top') return { ...t, topImages: updateList(t.topImages) };
      if (target === 'bottom') return { ...t, bottomImages: updateList(t.bottomImages) };
      if (target === 'full') return { ...t, fullImages: updateList(t.fullImages) };
      if (target === 'accessory') return { ...t, accessoryImages: updateList(t.accessoryImages ?? []) };
      if (target === 'shoes') {
        return {
          ...t,
          shoesImages: (t.shoesImages ?? []).map((image, imageIndex) =>
            (image.shoeViewSlot ?? imageIndex) === index ? { ...image, angle: newAngle } : image
          ),
        };
      }
      return t;
    });
  }, [updateCurrentTask]);

  const handleAddNewTask = (mode: UniversalTryOnSubMode = 'model') => {
    const newTask = createNewTask(mode);
    setTasks((prev) => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
  };

  const handleDeleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tasks.length <= 1) {
      const resetTask = createNewTask('model');
      setTasks([resetTask]);
      setActiveTaskId(resetTask.id);
      return;
    }
    const nextTasks = tasks.filter((t) => t.id !== id);
    setTasks(nextTasks);
    if (activeTaskId === id) {
      setActiveTaskId(nextTasks[0].id);
    }
  };

  const processImageFile = async (file: File): Promise<UploadedImage> => {
    const { base64, mime } = await compressImage(file, 2048, 0.92);
    const preview = `data:${mime};base64,${base64}`;
    const dimensions = await new Promise<{ width?: number; height?: number }>((resolve) => {
      const image = new window.Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({});
      image.src = preview;
    });
    return {
      id: crypto.randomUUID(),
      file,
      preview,
      base64,
      mime,
      name: file.name,
      ...dimensions,
    };
  };

  const getClosestAspectRatio = (image: UploadedImage): AspectRatio | null => {
    if (!image.width || !image.height) return null;
    const sourceRatio = image.width / image.height;
    const supportedRatios = ASPECT_RATIO_OPTIONS.map((option) => {
      const [width, height] = option.id.split(':').map(Number);
      return { id: option.id, value: width / height };
    });
    return supportedRatios.reduce((closest, candidate) =>
      Math.abs(candidate.value - sourceRatio) < Math.abs(closest.value - sourceRatio)
        ? candidate
        : closest
    ).id;
  };

  const handleUploadTarget = async (
    files: FileList | File[],
    target: ActiveUploadTarget,
    shoeStartSlot?: ShoeViewSlot
  ) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) return;
    try {
      const processed = await Promise.all(fileList.slice(0, 6).map(processImageFile));
      updateCurrentTask((task) => {
        if (target === 'top') {
          return { ...task, topImages: [...task.topImages, ...processed].slice(0, 6) };
        } else if (target === 'bottom') {
          return { ...task, bottomImages: [...task.bottomImages, ...processed].slice(0, 6) };
        } else if (target === 'accessory') {
          return { ...task, accessoryImages: [...(task.accessoryImages ?? []), ...processed].slice(0, 6) };
        } else if (target === 'full') {
          return { ...task, fullImages: [...task.fullImages, ...processed].slice(0, 6) };
        } else if (target === 'shoes') {
          const startSlot = shoeStartSlot ?? 0;
          const normalizedExisting = (task.shoesImages || []).slice(0, 3).map((image, index) => ({
            ...image,
            shoeViewSlot: image.shoeViewSlot ?? (index as ShoeViewSlot),
          }));
          const incoming = processed.slice(0, 3 - startSlot).map((image, offset) => ({
            ...image,
            shoeViewSlot: (startSlot + offset) as ShoeViewSlot,
          }));
          const replacedSlots = new Set(incoming.map((image) => image.shoeViewSlot));
          const shoesImages = normalizedExisting
            .filter((image) => !replacedSlots.has(image.shoeViewSlot))
            .concat(incoming)
            .sort((left, right) => (left.shoeViewSlot ?? 0) - (right.shoeViewSlot ?? 0));
          return { ...task, shoesImages };
        } else {
          const modelReferences = [...task.modelReferences, ...processed].slice(0, 6);
          const lockedAspectRatio = getClosestAspectRatio(modelReferences[0]);
          return {
            ...task,
            modelReferences,
            aspectRatio: task.lockCropping && lockedAspectRatio
              ? lockedAspectRatio
              : task.aspectRatio,
          };
        }
      });
    } catch (err: any) {
      setError('图像处理失败，请重试');
    }
  };

  const handlePresetSelect = async (preset: { name: string; preview: string }, target: ActiveUploadTarget) => {
    const base64 = preset.preview.startsWith('data:')
      ? preset.preview.split(',')[1] || ''
      : preset.preview;
    const item: UploadedImage = {
      id: crypto.randomUUID(),
      preview: preset.preview,
      base64,
      mime: 'image/svg+xml',
      name: preset.name,
    };

    updateCurrentTask((task) => {
      if (target === 'top') {
        return { ...task, topImages: [...task.topImages, item].slice(0, 6) };
      } else if (target === 'bottom') {
        return { ...task, bottomImages: [...task.bottomImages, item].slice(0, 6) };
      } else if (target === 'full') {
        return { ...task, fullImages: [...task.fullImages, item].slice(0, 6) };
      } else if (target === 'shoes') {
        const normalizedExisting = (task.shoesImages || []).slice(0, 3).map((image, index) => ({
          ...image,
          shoeViewSlot: image.shoeViewSlot ?? (index as ShoeViewSlot),
        }));
        const itemForSlot = { ...item, shoeViewSlot: activeShoeSlot };
        return {
          ...task,
          shoesImages: normalizedExisting
            .filter((image) => image.shoeViewSlot !== activeShoeSlot)
            .concat(itemForSlot)
            .sort((left, right) => (left.shoeViewSlot ?? 0) - (right.shoeViewSlot ?? 0)),
        };
      } else {
        return { ...task, modelReferences: [...task.modelReferences, item].slice(0, 6) };
      }
    });
  };

  useImagePaste((files) => {
    if (files.length > 0) {
      handleUploadTarget(
        files,
        activeUploadTarget,
        activeUploadTarget === 'shoes' ? activeShoeSlot : undefined
      );
    }
  }, isActive && !isLoading);

  const activateShoeSlot = (slot: ShoeViewSlot) => {
    shoeUploadSlotRef.current = slot;
    setActiveShoeSlot(slot);
    setActiveUploadTarget('shoes');
  };

  const openShoeFilePicker = (slot: ShoeViewSlot) => {
    activateShoeSlot(slot);
    shoesInputRef.current?.click();
  };

  const handleShoeSlotDrop = (event: React.DragEvent<HTMLElement>, slot: ShoeViewSlot) => {
    event.preventDefault();
    event.stopPropagation();
    activateShoeSlot(slot);
    setIsDraggingShoes(false);
    if (event.dataTransfer.files.length > 0) {
      void handleUploadTarget(event.dataTransfer.files, 'shoes', slot);
    }
  };

  const removeShoeImageAtSlot = (slot: ShoeViewSlot) => {
    updateCurrentTask((task) => ({
      ...task,
      shoesImages: task.shoesImages.filter(
        (image, index) => (image.shoeViewSlot ?? index) !== slot
      ),
    }));
  };

  const handleStartTryOn = async () => {
    let productImgs: UniversalTryOnProductImage[] = [];
    let customPromptAddon = '';

    if (currentTask.subMode === 'shoes') {
      const shoesList = (currentTask.shoesImages && currentTask.shoesImages.length > 0)
        ? currentTask.shoesImages
        : [
            ...currentTask.topImages,
            ...currentTask.bottomImages,
            ...currentTask.fullImages,
            ...currentTask.productImages,
          ];
      if (shoesList.length === 0) {
        setError('请在【鞋靴素材】区域至少上传一张鞋履平铺/白底图');
        return;
      }
      productImgs = [...shoesList]
        .sort((left, right) => (left.shoeViewSlot ?? 0) - (right.shoeViewSlot ?? 0))
        .map((img) => ({
        base64: img.base64,
        mime: img.mime,
        role: 'shoes',
        angle: img.angle || 'front',
        }));
      const categoryObj = SHOE_CATEGORY_OPTIONS.find((c) => c.id === currentTask.shoeCategory);
      const angleObj = SHOE_ANGLE_OPTIONS.find((a) => a.id === currentTask.shoeAngle);
      customPromptAddon = `[Footwear Try-On Agent]: Realistically fit the footwear onto model's feet. ${categoryObj?.prompt || ''}. ${angleObj?.prompt || ''}. Precise ankle orientation and realistic ground contact shadow.`;
    } else if (currentTask.subMode === 'model') {
      if (currentTask.clothingType === 'two-piece') {
        if (currentTask.topImages.length === 0 && currentTask.bottomImages.length === 0) {
          setError('请至少在【上装】或【下装】中上传一张服装素材图');
          return;
        }
        productImgs = [
          ...currentTask.topImages.map((img) => ({
            base64: img.base64,
            mime: img.mime,
            role: 'top' as const,
            angle: img.angle || 'front',
          })),
          ...currentTask.bottomImages.map((img) => ({
            base64: img.base64,
            mime: img.mime,
            role: 'bottom' as const,
            angle: img.angle || 'front',
          })),
          ...accessoryImages.map((img) => ({
            base64: img.base64,
            mime: img.mime,
            role: 'accessory' as const,
            angle: img.angle || 'front',
          })),
        ];
        customPromptAddon = `[Two-Piece Try-On]: Replace the upper garment using TOP references and the lower garment using BOTTOM references. Apply ACCESSORY references only to anatomically correct locations without changing the pose. 
FRAME & TOP-EDGE LOCK: Preserve the target model image's (Image 1) exact top/bottom/side crop boundaries and subject scale. IF IMAGE 1 HAS NO NECK VISIBLE (cropped at chest/shoulders), THE OUTPUT MUST ALSO HAVE NO NECK VISIBLE and clip at the exact same chest/shoulder boundary. NEVER generate a neck, collarbone, chin or head if it was not in Image 1. If a replacement top has a collar or high neck, surgically clip the collar at Image 1's top edge boundary instead of extending the canvas upward to draw a neck. For BOTTOM/trouser references, lock the original waistband, crotch, knees, trouser hems, feet and floor-contact coordinates, and never reveal additional torso above or floor below the source crop. A straight flat-lay or mannequin trouser silhouette is garment-pattern evidence only, never pose evidence: articulate each trouser leg independently around the model's original hip, knee and ankle joints. Preserve bent, crossed, stepped, asymmetrical and weight-bearing leg poses exactly, even when this makes the worn trouser outline differ from the product photo.`;
      } else {
        if (currentTask.fullImages.length === 0) {
          setError('请在【连体/连衣裙】区域上传至少一张服装素材图');
          return;
        }
        productImgs = [
          ...currentTask.fullImages.map((img) => ({
            base64: img.base64,
            mime: img.mime,
            role: 'full' as const,
            angle: img.angle || 'front',
          })),
          ...accessoryImages.map((img) => ({
            base64: img.base64,
            mime: img.mime,
            role: 'accessory' as const,
            angle: img.angle || 'front',
          })),
        ];
        customPromptAddon = `[One-Piece Try-On]: Fit the full dress/suit onto the model while preserving the target image's exact crop boundaries and subject scale. Clip any unseen garment portion at the original frame edge; never expand the body or scene to show the whole outfit.`;
      }
    } else {
      const combined = [
        ...currentTask.topImages,
        ...currentTask.bottomImages,
        ...currentTask.fullImages,
        ...currentTask.productImages,
      ];
      if (combined.length === 0) {
        setError('请至少上传一张商品/服饰素材图');
        return;
      }
      productImgs = combined.map((img) => ({
        base64: img.base64,
        mime: img.mime,
        role: 'product',
        angle: img.angle || 'front',
      }));
    }

    const targetModelReferences: Array<UploadedImage | null> = currentTask.modelReferences.length > 0
      ? currentTask.modelReferences
      : [null];
    const resultItems: TryOnResultItem[] = targetModelReferences.map((modelReference) => ({
      id: crypto.randomUUID(),
      modelReferenceId: modelReference?.id || null,
      modelPreview: modelReference?.preview || null,
      url: null,
      status: 'generating',
      requestId: crypto.randomUUID(),
    }));

    setError(null);
    const { taskId, signal } = startGenerationTask(currentTask.id);
    const fullPrompt = `${currentTask.customPrompt} ${customPromptAddon}`.trim();
    generationContextsRef.current.set(currentTask.id, { productImgs, fullPrompt });

    updateCurrentTask((t) => ({
      ...t,
      status: 'generating',
      stage: 2,
      cotStep: 1,
      generatedResults: [],
      resultItems,
      agentStatus: `AI 试穿 Agent · 正在对「${SUB_MODE_OPTIONS.find((s) => s.id === t.subMode)?.title}」素材进行 CoT 思维链解构...`,
      agentLog: [...t.agentLog, `开始执行「${SUB_MODE_OPTIONS.find((s) => s.id === t.subMode)?.title}」算法推理`],
    }));

    const stepInterval = setInterval(() => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => {
          if (task.id === activeTaskId && task.cotStep < 7) {
            const nextStep = task.cotStep + 1;
            const nextStage = nextStep >= 7 ? 4 : nextStep >= 4 ? 3 : 2;
            return {
              ...task,
              cotStep: nextStep,
              stage: nextStage as Stage,
              agentStatus: `AI 试穿 Agent · Step ${nextStep}: ${COT_STEPS[nextStep - 1]?.label}`,
              agentLog: [...task.agentLog, COT_STEPS[nextStep - 1]?.desc || '处理中...'],
            };
          }
          return task;
        })
      );
    }, 1800);

    try {
      const settled = await Promise.allSettled(
        targetModelReferences.map(async (modelReference, index) => {
          const resultItem = resultItems[index];
          try {
            const results = await generateUniversalTryOn(
              productImgs,
              modelReference ? {
                base64: modelReference.base64,
                mime: modelReference.mime,
                targetMaskBase64: modelReference.targetMaskBase64,
                targetMaskMime: modelReference.targetMaskBase64 ? 'image/png' : undefined,
              } : null,
              currentTask.subMode,
              fullPrompt,
              {
                aspectRatio: modelReference && (currentTask.lockCropping || modelReference.targetMaskBase64)
                  ? getClosestAspectRatio(modelReference) || currentTask.aspectRatio
                  : currentTask.aspectRatio,
                resolution: currentTask.resolution,
                count: 1,
                model: currentTask.selectedModel,
                lockCropping: currentTask.lockCropping ?? true,
                signal,
              }
            );
            let url = results[0];
            if (!url) throw new Error('模型未返回图片');
            const rawOriginalUrl = url;
            setTasks((previousTasks) => previousTasks.map((task) => {
              if (task.id !== currentTask.id) return task;
              const nextItems = task.resultItems.map((item) => item.id === resultItem.id && item.requestId === resultItem.requestId
                ? { ...item, url, originalUrl: rawOriginalUrl, isNeckCropped: false, status: 'done' as const, error: undefined }
                : item);
              return {
                ...task,
                resultItems: nextItems,
                generatedResults: nextItems.flatMap((item) => item.url ? [item.url] : []),
              };
            }));
            return url;
          } catch (generationError) {
            if (!isAbortError(generationError)) {
              const message = getErrorMessage(generationError);
              setTasks((previousTasks) => previousTasks.map((task) => task.id === currentTask.id
                ? {
                    ...task,
                    resultItems: task.resultItems.map((item) => item.id === resultItem.id && item.requestId === resultItem.requestId
                      ? { ...item, status: 'error' as const, error: message }
                      : item),
                  }
                : task));
            }
            throw generationError;
          }
        })
      );

      clearInterval(stepInterval);
      const successfulResults = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      setTasks((previousTasks) => previousTasks.map((task) => task.id === currentTask.id
        ? {
            ...task,
            resultItems: task.resultItems.map((item) => {
              const initialIndex = resultItems.findIndex((initialItem) => initialItem.id === item.id);
              const initialItem = initialIndex >= 0 ? resultItems[initialIndex] : null;
              const settledResult = initialIndex >= 0 ? settled[initialIndex] : null;
              if (
                initialItem
                && item.requestId === initialItem.requestId
                && item.status === 'generating'
                && settledResult?.status === 'rejected'
              ) {
                return {
                  ...item,
                  status: 'error' as const,
                  error: isAbortError(settledResult.reason) ? '任务已取消' : getErrorMessage(settledResult.reason),
                };
              }
              return item;
            }),
          }
        : task));
      setTasks((previousTasks) => previousTasks.map((task) => task.id === currentTask.id
        ? {
            ...task,
            status: task.resultItems.some((item) => item.status === 'generating')
              ? 'generating'
              : task.resultItems.some((item) => item.url) ? 'done' : 'error',
            stage: task.resultItems.some((item) => item.url) ? 4 : 1,
            cotStep: task.resultItems.some((item) => item.url) ? 8 : task.cotStep,
            generatedResults: task.resultItems.flatMap((item) => item.url ? [item.url] : []),
            agentStatus: task.resultItems.some((item) => item.status === 'generating')
              ? '独立重新生成任务仍在进行'
              : task.resultItems.some((item) => item.url)
                ? `已完成 ${task.resultItems.filter((item) => item.url).length}/${resultItems.length} 张试穿图`
                : '批量生成失败，可在结果卡片中逐张重新生成',
          }
        : task));

      if (successfulResults.length > 0) {
        try {
          await saveGeneratedProject({
            type: 'MODEL',
            generated: successfulResults,
            original: [
              ...targetModelReferences.flatMap((image) => image ? [image.preview] : []),
              ...productImgs.map((img) => `data:${img.mime};base64,${img.base64}`),
            ],
            prompt: fullPrompt,
            params: {
              subMode: currentTask.subMode,
              clothingType: currentTask.clothingType,
              model: currentTask.selectedModel,
              aspectRatio: currentTask.aspectRatio,
              resolution: currentTask.resolution,
              modelReferenceCount: targetModelReferences.filter(Boolean).length,
              paintedModelReferenceCount: targetModelReferences.filter((image) => image?.targetMaskBase64).length,
            },
          });
        } catch (historyError) {
          console.warn('保存项目历史失败:', historyError);
        }
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      if (isAbortError(err)) {
        setTasks((previousTasks) => previousTasks.map((task) => task.id === currentTask.id
          ? {
              ...task,
              status: 'editing',
              stage: 1,
              agentStatus: '任务已被用户手动取消',
              agentLog: [...task.agentLog, '用户终止了生成任务'],
            }
          : task));
      } else {
        const msg = getErrorMessage(err);
        setError(msg);
        setTasks((previousTasks) => previousTasks.map((task) => task.id === currentTask.id
          ? {
              ...task,
              status: 'error',
              stage: 1,
              agentStatus: `生成错误: ${msg}`,
              agentLog: [...task.agentLog, `错误提示: ${msg}`],
            }
          : task));
      }
    } finally {
      finishGenerationTask(currentTask.id, taskId);
    }
  };

  const handleRegenerateResult = async (resultId: string) => {
    const taskSnapshot = tasks.find((task) => task.id === activeTaskId);
    const resultSnapshot = taskSnapshot?.resultItems.find((item) => item.id === resultId);
    const context = taskSnapshot ? generationContextsRef.current.get(taskSnapshot.id) : null;
    if (!taskSnapshot || !resultSnapshot || !context) {
      setError('当前任务缺少生成上下文，请重新发起一次批量生成。');
      return;
    }

    const requestId = crypto.randomUUID();
    const modelReference = resultSnapshot.modelReferenceId
      ? taskSnapshot.modelReferences.find((image) => image.id === resultSnapshot.modelReferenceId) || null
      : null;

    setTasks((previousTasks) => previousTasks.map((task) => task.id === taskSnapshot.id
      ? {
          ...task,
          status: 'generating',
          resultItems: task.resultItems.map((item) => item.id === resultId
            ? { ...item, status: 'generating' as const, error: undefined, requestId }
            : item),
        }
      : task));

    try {
      const results = await generateUniversalTryOn(
        context.productImgs,
        modelReference ? {
          base64: modelReference.base64,
          mime: modelReference.mime,
          targetMaskBase64: modelReference.targetMaskBase64,
          targetMaskMime: modelReference.targetMaskBase64 ? 'image/png' : undefined,
        } : null,
        taskSnapshot.subMode,
        context.fullPrompt,
        {
          aspectRatio: modelReference && (taskSnapshot.lockCropping || modelReference.targetMaskBase64)
            ? getClosestAspectRatio(modelReference) || taskSnapshot.aspectRatio
            : taskSnapshot.aspectRatio,
          resolution: taskSnapshot.resolution,
          count: 1,
          model: taskSnapshot.selectedModel,
          lockCropping: taskSnapshot.lockCropping ?? true,
        }
      );
      let url = results[0];
      if (!url) throw new Error('模型未返回图片');
      const rawOriginalUrl = url;
      setTasks((previousTasks) => previousTasks.map((task) => {
        if (task.id !== taskSnapshot.id) return task;
        const nextItems = task.resultItems.map((item) => item.id === resultId && item.requestId === requestId
          ? { ...item, url, originalUrl: rawOriginalUrl, isNeckCropped: false, status: 'done' as const, error: undefined }
          : item);
        const stillGenerating = nextItems.some((item) => item.status === 'generating');
        return {
          ...task,
          status: stillGenerating ? 'generating' : 'done',
          resultItems: nextItems,
          generatedResults: nextItems.flatMap((item) => item.url ? [item.url] : []),
          agentStatus: stillGenerating ? '其他图片仍在并行生成' : '全部试穿图片已完成',
        };
      }));
    } catch (regenerationError) {
      const message = getErrorMessage(regenerationError);
      setTasks((previousTasks) => previousTasks.map((task) => {
        if (task.id !== taskSnapshot.id) return task;
        const nextItems = task.resultItems.map((item) => item.id === resultId && item.requestId === requestId
          ? { ...item, status: 'error' as const, error: message }
          : item);
        const stillGenerating = nextItems.some((item) => item.status === 'generating');
        return {
          ...task,
          status: stillGenerating ? 'generating' : nextItems.some((item) => item.url) ? 'done' : 'error',
          resultItems: nextItems,
          agentStatus: stillGenerating ? '其他图片仍在并行生成' : '部分图片生成失败，可单独重试',
        };
      }));
    }
  };

  const toggleNeckCrop = (resultId: string) => {
    setTasks((previousTasks) =>
      previousTasks.map((task) => {
        if (task.id !== activeTaskId) return task;
        return {
          ...task,
          resultItems: task.resultItems.map((item) =>
            item.id === resultId
              ? { ...item, isNeckCropped: !(item.isNeckCropped ?? false) }
              : item
          ),
        };
      })
    );
  };

  const handleDownloadAllResults = async () => {
    const completedItems = currentTask.resultItems.filter((item) => item.status === 'done' && item.url);
    if (completedItems.length === 0) return;
    try {
      for (let index = 0; index < completedItems.length; index += 1) {
        const item = completedItems[index];
        const cropRatio = item.isNeckCropped ? 0.12 : 0;
        await downloadImageFile(item.url!, `万物上身-模特-${index + 1}.png`, cropRatio);
      }
    } catch (downloadError) {
      console.error('Failed to download all try-on results.', downloadError);
      setError('批量下载失败，请检查网络后重试。');
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'generating':
        return '试穿渲染中';
      case 'done':
        return '已生成';
      case 'error':
        return '需要重试';
      default:
        return '编辑中';
    }
  };

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-pastel-text dark:bg-[#080808]">
      <div className="mx-auto w-full max-w-[108rem] px-3 py-5 sm:px-5 lg:px-7">
        {/* HEADER SECTION - 1:1 Matched with ModelSceneFissionTab */}
        <header className="mb-6 text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-bold text-pastel-muted">
            <Sparkles className="h-4 w-4 text-[#ed6d46]" />
            AI 服饰视觉工坊
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">AI 万物上身</h1>
          <p className="mt-1 text-sm text-pastel-muted">
            模特换装 · 人台试穿 · 鞋靴上脚，Agent 全流程自然拟合交付高清大图
          </p>

          {/* STEP PROGRESS BAR */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-pastel-muted sm:gap-4">
            {(['素材输入', '试穿拟合方案', 'CoT光影渲染', '高清成果交付'] as const).map((label, index) => {
              const step = (index + 1) as Stage;
              const isCurrent = currentTask.stage === step;
              return (
                <React.Fragment key={label}>
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                      isCurrent
                        ? 'bg-[#172238] text-white shadow-sm ring-2 ring-[#172238]/20'
                        : currentTask.stage > step
                        ? 'bg-pastel-card text-pastel-text'
                        : 'bg-pastel-card/50 text-pastel-muted opacity-50'
                    }`}
                  >
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-black ${
                        isCurrent ? 'bg-white text-[#172238]' : 'bg-slate-200 dark:bg-slate-700 text-pastel-text'
                      }`}
                    >
                      {step}
                    </span>
                    <span className="text-xs font-bold">{label}</span>
                  </div>
                  {index < 3 && <span className="h-px w-3 bg-pastel-border sm:w-7" />}
                </React.Fragment>
              );
            })}
          </div>
        </header>

        {/* FLOATING HISTORY TOGGLE BUTTON */}
        {!historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-pastel-card px-4 text-sm font-black shadow-lg md:left-[16.25rem] lg:left-[17rem]"
          >
            <PanelLeftOpen className="h-4 w-4" />
            生成记录{' '}
            <span className="rounded-full bg-pastel-bg px-2 py-1 text-xs">{tasks.length}</span>
          </button>
        )}

        {historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            aria-label="关闭生成记录"
            className="fixed inset-0 z-[59] bg-black/30 xl:hidden"
          />
        )}

        {/* ERROR BANNER */}
        {error && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* THREE-COLUMN GRID - 1:1 Matched Width & Proportions */}
        <div
          className={`grid grid-cols-1 gap-4 ${
            historyOpen
              ? 'xl:grid-cols-[16rem_30rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[30rem_minmax(0,1fr)]'
          }`}
        >
          {/* 1. LEFT SIDEBAR: GENERATION HISTORY */}
          {historyOpen && (
            <aside className="no-scrollbar fixed inset-y-3 left-3 z-[60] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card p-3 shadow-xl xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-black text-pastel-text">生成记录</h2>
                  <p className="text-xs text-pastel-muted">可同时开多个试穿任务</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border hover:bg-pastel-bg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleAddNewTask(currentTask.subMode)}
                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172238] text-sm font-black text-white disabled:opacity-50 hover:bg-[#1f2e4c] transition"
              >
                <Plus className="h-4 w-4" />
                新开任务
              </button>

              <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {tasks.map((task) => {
                  const cover =
                    task.generatedResults[0] ||
                    task.topImages[0]?.preview ||
                    task.fullImages[0]?.preview ||
                    task.productImages[0]?.preview;
                  const subModeInfo = SUB_MODE_OPTIONS.find((s) => s.id === task.subMode);
                  return (
                    <div key={task.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setActiveTaskId(task.id)}
                        className={`block w-full overflow-hidden rounded-xl border text-left transition ${
                          task.id === activeTaskId
                            ? 'border-pastel-highlight ring-2 ring-orange-100'
                            : 'border-pastel-border hover:border-orange-300'
                        }`}
                      >
                        <div className="relative aspect-square bg-white dark:bg-slate-800">
                          {cover ? (
                            <img src={cover} alt="任务预览" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-pastel-border" />
                          )}
                          <span className="absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center gap-1 bg-[#172238]/90 text-xs font-black text-white">
                            {task.status === 'generating' && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {statusLabel(task.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] text-pastel-muted">
                          <span className="font-bold">{subModeInfo?.title}</span>
                          <span>
                            {task.subMode === 'model' && task.clothingType === 'two-piece'
                              ? `${task.topImages.length + task.bottomImages.length}张`
                              : `${task.fullImages.length || task.topImages.length}张`}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        disabled={isLoading && task.id === activeTaskId}
                        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 shadow transition hover:bg-red-500 group-hover:opacity-100 disabled:opacity-30"
                        title="删除任务"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* 2. MIDDLE COLUMN: FORM CONFIG CARDS */}
          <div className="space-y-4">
            {/* Step 1 Card: 试穿模式 */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="flex items-center gap-2 font-black text-pastel-text">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#172238] text-sm text-white">
                  1
                </span>
                试穿模式
              </h2>
              <p className="mt-1 text-xs text-pastel-muted">
                选择欲上身拟合的场景模式：模特换衣、人台转化或鞋靴试穿
              </p>
              <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-pastel-bg p-1">
                {SUB_MODE_OPTIONS.map((sub) => {
                  const Icon = sub.icon;
                  const active = currentTask.subMode === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => updateCurrentTask((t) => ({ ...t, subMode: sub.id }))}
                      className={`min-h-11 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-pastel-card shadow-sm text-pastel-text'
                          : 'text-pastel-muted hover:text-pastel-text'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {sub.title}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 2 Card: 平铺/人台/鞋靴商品图上传 Card (完全对齐用户参考截图 1, 2, 3) */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-pastel-border pb-3">
                <h2 className="font-black text-pastel-text text-sm flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#17243c] text-xs font-black text-white dark:bg-white dark:text-[#17243c]">
                    01
                  </span>
                  {currentTask.subMode === 'shoes' ? '鞋靴商品图' : '平铺 / 人台图'}
                </h2>
                {/* Sub-tabs for Clothing Type in 模特换衣 */}
                {currentTask.subMode === 'model' && (
                  <div className="flex items-center gap-1 rounded-xl bg-pastel-bg p-1">
                    <button
                      type="button"
                      onClick={() => {
                        updateCurrentTask((t) => ({ ...t, clothingType: 'two-piece' }));
                        setActiveUploadTarget('top');
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        currentTask.clothingType === 'two-piece'
                          ? 'bg-pastel-card text-pastel-text shadow-xs border-b-2 border-[#17243c]'
                          : 'text-pastel-muted hover:text-pastel-text'
                      }`}
                    >
                      <Shirt className="h-3.5 w-3.5 text-orange-500" />
                      换上下装
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateCurrentTask((t) => ({ ...t, clothingType: 'one-piece' }));
                        setActiveUploadTarget('full');
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        currentTask.clothingType === 'one-piece'
                          ? 'bg-pastel-card text-pastel-text shadow-xs border-b-2 border-[#17243c]'
                          : 'text-pastel-muted hover:text-pastel-text'
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5 text-purple-500" />
                      换连体
                    </button>
                  </div>
                )}
              </div>

              {/* RENDER MODE A: 换上下装 (TWO-PIECE) */}
              {currentTask.subMode === 'model' && currentTask.clothingType === 'two-piece' ? (
                <div className="space-y-4">
                  {/* 【上装】 BOX */}
                  <div
                    onMouseEnter={() => setActiveUploadTarget('top')}
                    onClick={() => setActiveUploadTarget('top')}
                    className={`rounded-[1.5rem] border bg-white p-4 shadow-xs transition-all dark:bg-[#11151c] ${
                      activeUploadTarget === 'top'
                        ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                        : 'border-pastel-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shirt className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-black text-pastel-text">
                          上传 / 拖拽 / 粘贴【上装】
                        </span>
                      </div>
                      <span className="text-xs font-bold text-pastel-muted">
                        {currentTask.topImages.length} / 6 张
                      </span>
                    </div>

                    {/* Recommendation Presets Bar */}
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl bg-pastel-bg/80 p-2">
                      <div className="flex items-center gap-1 text-[0.65rem] font-bold text-pastel-muted shrink-0">
                        <Eye className="h-3.5 w-3.5 text-orange-500" />
                        推荐示例
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {SVG_TOP_PRESETS.map((preset, idx) => (
                          <div key={idx} className="group relative shrink-0">
                            <img
                              src={preset.preview}
                              alt={preset.name}
                              onClick={() => handlePresetSelect(preset, 'top')}
                              className="h-10 w-10 cursor-pointer rounded-lg border border-pastel-border object-cover transition hover:scale-105 hover:border-orange-500"
                              title={`点击使用: ${preset.name}`}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(preset.preview);
                              }}
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                              title="点击放大查看"
                            >
                              <ZoomIn className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Image Dropzone & Thumbnails (Matches Screenshot 2) */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingTop(true);
                      }}
                      onDragLeave={() => setIsDraggingTop(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingTop(false);
                        if (e.dataTransfer.files?.length) {
                          handleUploadTarget(e.dataTransfer.files, 'top');
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                        isDraggingTop
                          ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                          : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                      }`}
                    >
                      {currentTask.topImages.length > 0 ? (
                        <div className="w-full">
                          <div className="no-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                            {currentTask.topImages.map((img, idx) => (
                              <div
                                key={img.id || idx}
                                className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                              >
                                <AngleBadgeButton
                                  angle={img.angle}
                                  onClick={() => setAngleModal({ target: 'top', index: idx, currentAngle: img.angle || 'front' })}
                                />
                                <img
                                  src={img.preview}
                                  alt={`Top ${idx}`}
                                  onClick={() => setZoomedImage(img.preview)}
                                  className="h-full w-full object-cover cursor-pointer"
                                  title="点击放大预览"
                                />
                                <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                                  #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCurrentTask((t) => ({
                                      ...t,
                                      topImages: t.topImages.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                            {currentTask.topImages.length < 6 && (
                              <button
                                type="button"
                                onClick={() => topInputRef.current?.click()}
                                className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#ed6d46] hover:text-[#ed6d46] transition"
                              >
                                <Plus className="h-6 w-6" />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                            点击预览大图 · 支持拖拽和复制粘贴
                          </p>
                        </div>
                      ) : (
                        <div
                          onClick={() => topInputRef.current?.click()}
                          className="flex flex-col items-center justify-center py-3 cursor-pointer"
                        >
                          <Upload className="h-6 w-6 text-[#ed6d46] mb-1.5" />
                          <p className="text-xs font-bold text-pastel-text">
                            点击、拖拽或粘贴【上装】款式图
                          </p>
                          <p className="mt-1 text-[0.62rem] text-pastel-muted">
                            款式图无遮挡、无褶皱，生成效果更好
                          </p>
                        </div>
                      )}
                      <input
                        ref={topInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'top')}
                      />
                    </div>
                  </div>

                  {/* 【下装】 BOX */}
                  <div
                    onMouseEnter={() => setActiveUploadTarget('bottom')}
                    onClick={() => setActiveUploadTarget('bottom')}
                    className={`rounded-[1.5rem] border bg-white p-4 shadow-xs transition-all dark:bg-[#11151c] ${
                      activeUploadTarget === 'bottom'
                        ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                        : 'border-pastel-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-black text-pastel-text">
                          上传 / 拖拽 / 粘贴【下装】
                        </span>
                      </div>
                      <span className="text-xs font-bold text-pastel-muted">
                        {currentTask.bottomImages.length} / 6 张
                      </span>
                    </div>

                    {/* Recommendation Presets Bar */}
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl bg-pastel-bg/80 p-2">
                      <div className="flex items-center gap-1 text-[0.65rem] font-bold text-pastel-muted shrink-0">
                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                        推荐示例
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {SVG_BOTTOM_PRESETS.map((preset, idx) => (
                          <div key={idx} className="group relative shrink-0">
                            <img
                              src={preset.preview}
                              alt={preset.name}
                              onClick={() => handlePresetSelect(preset, 'bottom')}
                              className="h-10 w-10 cursor-pointer rounded-lg border border-pastel-border object-cover transition hover:scale-105 hover:border-blue-500"
                              title={`点击使用: ${preset.name}`}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(preset.preview);
                              }}
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                              title="点击放大查看"
                            >
                              <ZoomIn className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Image Dropzone & Thumbnails */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingBottom(true);
                      }}
                      onDragLeave={() => setIsDraggingBottom(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingBottom(false);
                        if (e.dataTransfer.files?.length) {
                          handleUploadTarget(e.dataTransfer.files, 'bottom');
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                        isDraggingBottom
                          ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                          : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                      }`}
                    >
                      {currentTask.bottomImages.length > 0 ? (
                        <div className="w-full">
                          <div className="no-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                            {currentTask.bottomImages.map((img, idx) => (
                              <div
                                key={img.id || idx}
                                className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                              >
                                <AngleBadgeButton
                                  angle={img.angle}
                                  onClick={() => setAngleModal({ target: 'bottom', index: idx, currentAngle: img.angle || 'front' })}
                                />
                                <img
                                  src={img.preview}
                                  alt={`Bottom ${idx}`}
                                  onClick={() => setZoomedImage(img.preview)}
                                  className="h-full w-full object-cover cursor-pointer"
                                  title="点击放大预览"
                                />
                                <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                                  #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCurrentTask((t) => ({
                                      ...t,
                                      bottomImages: t.bottomImages.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                            {currentTask.bottomImages.length < 6 && (
                              <button
                                type="button"
                                onClick={() => bottomInputRef.current?.click()}
                                className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#ed6d46] hover:text-[#ed6d46] transition"
                              >
                                <Plus className="h-6 w-6" />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                            点击预览大图 · 支持拖拽和复制粘贴
                          </p>
                        </div>
                      ) : (
                        <div
                          onClick={() => bottomInputRef.current?.click()}
                          className="flex flex-col items-center justify-center py-3 cursor-pointer"
                        >
                          <Upload className="h-6 w-6 text-blue-500 mb-1.5" />
                          <p className="text-xs font-bold text-pastel-text">
                            点击、拖拽或粘贴【下装】款式图
                          </p>
                          <p className="mt-1 text-[0.62rem] text-pastel-muted">
                            支持裤装、半身裙平铺图或细节素材
                          </p>
                        </div>
                      )}
                      <input
                        ref={bottomInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'bottom')}
                      />
                    </div>
                  </div>

                </div>
              ) : null}

              {/* RENDER MODE B: 换连体 (ONE-PIECE / FULL OUTFIT - 仅非鞋靴模式渲染) */}
              {currentTask.subMode !== 'shoes' && (currentTask.clothingType === 'one-piece' || currentTask.subMode === 'mannequin') && (
                <div
                  onMouseEnter={() => setActiveUploadTarget('full')}
                  onClick={() => setActiveUploadTarget('full')}
                  className={`rounded-[1.5rem] border bg-white p-4 shadow-xs transition-all dark:bg-[#11151c] ${
                    activeUploadTarget === 'full'
                      ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                      : 'border-pastel-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-black text-pastel-text">
                        上传 / 拖拽 / 粘贴【连体/连衣裙】
                      </span>
                    </div>
                    <span className="text-xs font-bold text-pastel-muted">
                      {currentTask.fullImages.length} / 6 张
                    </span>
                  </div>

                  {/* Recommendation Presets Bar */}
                  <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl bg-pastel-bg/80 p-2">
                    <div className="flex items-center gap-1 text-[0.65rem] font-bold text-pastel-muted shrink-0">
                      <Eye className="h-3.5 w-3.5 text-purple-500" />
                      推荐示例
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {SVG_FULL_PRESETS.map((preset, idx) => (
                        <div key={idx} className="group relative shrink-0">
                          <img
                            src={preset.preview}
                            alt={preset.name}
                            onClick={() => handlePresetSelect(preset, 'full')}
                            className="h-10 w-10 cursor-pointer rounded-lg border border-pastel-border object-cover transition hover:scale-105 hover:border-purple-500"
                            title={`点击使用: ${preset.name}`}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedImage(preset.preview);
                            }}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                            title="点击放大查看"
                          >
                            <ZoomIn className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Image Dropzone & Thumbnails */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFull(true);
                    }}
                    onDragLeave={() => setIsDraggingFull(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFull(false);
                      if (e.dataTransfer.files?.length) {
                        handleUploadTarget(e.dataTransfer.files, 'full');
                      }
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                      isDraggingFull
                        ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                        : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                    }`}
                  >
                    {currentTask.fullImages.length > 0 ? (
                      <div className="w-full">
                        <div className="no-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                          {currentTask.fullImages.map((img, idx) => (
                            <div
                              key={img.id || idx}
                              className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                            >
                              <AngleBadgeButton
                                angle={img.angle}
                                onClick={() => setAngleModal({ target: 'full', index: idx, currentAngle: img.angle || 'front' })}
                              />
                              <img
                                src={img.preview}
                                alt={`Full ${idx}`}
                                onClick={() => setZoomedImage(img.preview)}
                                className="h-full w-full object-cover cursor-pointer"
                                title="点击放大预览"
                              />
                              <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                                #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCurrentTask((t) => ({
                                    ...t,
                                    fullImages: t.fullImages.filter((_, i) => i !== idx),
                                  }))
                                }
                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}

                          {currentTask.fullImages.length < 6 && (
                            <button
                              type="button"
                              onClick={() => fullInputRef.current?.click()}
                              className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#ed6d46] hover:text-[#ed6d46] transition"
                            >
                              <Plus className="h-6 w-6" />
                            </button>
                          )}
                        </div>
                        <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                          点击预览大图 · 支持拖拽和复制粘贴
                        </p>
                      </div>
                    ) : (
                      <div
                        onClick={() => fullInputRef.current?.click()}
                        className="flex flex-col items-center justify-center py-4 cursor-pointer"
                      >
                        <Upload className="h-6 w-6 text-purple-500 mb-1.5" />
                        <p className="text-xs font-bold text-pastel-text">
                          点击、拖拽或粘贴【连体/连衣裙】款式图
                        </p>
                        <p className="mt-1 text-[0.62rem] text-pastel-muted">
                          支持连体裤、连衣裙、大衣套装平铺图
                        </p>
                      </div>
                    )}
                    <input
                      ref={fullInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'full')}
                    />
                  </div>
                </div>
              )}

              {/* Shared accessories for both model clothing modes. */}
              {currentTask.subMode === 'model' && (
                <div
                  onMouseEnter={() => setActiveUploadTarget('accessory')}
                  onClick={() => setActiveUploadTarget('accessory')}
                  onFocusCapture={() => setActiveUploadTarget('accessory')}
                  className={`rounded-[1.5rem] border bg-white p-4 shadow-xs transition-all dark:bg-[#11151c] ${
                    activeUploadTarget === 'accessory'
                      ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30'
                      : 'border-pastel-border'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gem className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-black text-pastel-text">
                        上传 / 拖拽 / 粘贴【搭配】（可选）
                      </span>
                    </div>
                    <span className="text-xs font-bold text-pastel-muted">
                      {accessoryImages.length} / 6 张
                    </span>
                  </div>

                  <p className="mb-3 text-[0.68rem] leading-5 text-pastel-muted">
                    支持鞋子、包、帽子、腰带、项链、耳饰、手表等配饰；建议使用单品白底图。
                  </p>

                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDraggingAccessory(true);
                    }}
                    onDragLeave={() => setIsDraggingAccessory(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDraggingAccessory(false);
                      if (event.dataTransfer.files?.length) {
                        handleUploadTarget(event.dataTransfer.files, 'accessory');
                      }
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                      isDraggingAccessory
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                        : 'border-amber-300 bg-amber-50/60 hover:border-amber-500 dark:border-amber-500/30 dark:bg-amber-500/5'
                    }`}
                  >
                    {accessoryImages.length > 0 ? (
                      <div className="w-full">
                        <div className="no-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                          {accessoryImages.map((image, index) => (
                            <div
                              key={image.id || index}
                              className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                            >
                              <AngleBadgeButton
                                angle={image.angle}
                                onClick={() => setAngleModal({ target: 'accessory', index: index, currentAngle: image.angle || 'front' })}
                              />
                              <img
                                src={image.preview}
                                alt={`Accessory ${index + 1}`}
                                onClick={() => setZoomedImage(image.preview)}
                                className="h-full w-full cursor-pointer object-cover"
                                title="点击放大预览"
                              />
                              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                                #{index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  updateCurrentTask((task) => ({
                                    ...task,
                                    accessoryImages: (task.accessoryImages ?? []).filter((_, itemIndex) => itemIndex !== index),
                                  }));
                                }}
                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                                aria-label={`移除搭配素材 ${index + 1}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}

                          {accessoryImages.length < 6 && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                accessoryInputRef.current?.click();
                              }}
                              className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 text-amber-500 transition hover:border-amber-500"
                              aria-label="继续添加搭配素材"
                            >
                              <Plus className="h-6 w-6" />
                            </button>
                          )}
                        </div>
                        <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                          配饰将按类别放到脚部、肩部、手腕、颈部等正确位置
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          accessoryInputRef.current?.click();
                        }}
                        className="flex flex-col items-center justify-center py-3"
                      >
                        <Upload className="mb-1.5 h-6 w-6 text-amber-500" />
                        <span className="text-xs font-bold text-pastel-text">
                          点击、拖拽或粘贴鞋包与饰品素材
                        </span>
                      </button>
                    )}
                    <input
                      ref={accessoryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => event.target.files && handleUploadTarget(event.target.files, 'accessory')}
                    />
                  </div>
                </div>
              )}

              {/* RENDER MODE C: 鞋靴试穿 (单视角图 / 多视角图) - 1:1 还原用户参考截图 1, 2, 3 */}
              {currentTask.subMode === 'shoes' && (
                <div
                  onMouseEnter={() => setActiveUploadTarget('shoes')}
                  onPointerDown={() => setActiveUploadTarget('shoes')}
                  onFocusCapture={() => setActiveUploadTarget('shoes')}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setActiveUploadTarget('shoes');
                    setIsDraggingShoes(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                    setActiveUploadTarget('shoes');
                    setIsDraggingShoes(true);
                  }}
                  onDragLeave={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                      setIsDraggingShoes(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveUploadTarget('shoes');
                    setIsDraggingShoes(false);
                    if (event.dataTransfer.files.length > 0) {
                      void handleUploadTarget(event.dataTransfer.files, 'shoes', activeShoeSlot);
                    }
                  }}
                  className={`rounded-2xl border bg-[#f8fafc] p-3 shadow-xs space-y-3 transition-all dark:bg-[#111622] ${
                    isDraggingShoes
                      ? 'border-[#ed6d46] bg-[#fff8f3] ring-2 ring-[#ed6d46]/25 dark:bg-[#ed6d46]/10'
                      : 'border-[#e2e8f0] dark:border-white/10'
                  }`}
                >
                  {/* Header Sub-tabs */}
                  <div className="flex items-center justify-center gap-8 border-b border-[#e2e8f0] dark:border-white/10 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        activateShoeSlot(0);
                        updateCurrentTask((t) => ({ ...t, shoeViewMode: 'single' }));
                      }}
                      className={`flex items-center gap-1.5 text-xs font-bold transition relative pb-1.5 ${
                        (currentTask.shoeViewMode || 'single') === 'single'
                          ? 'text-slate-900 font-black dark:text-white'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      <Footprints className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                      单视角图
                      {(currentTask.shoeViewMode || 'single') === 'single' && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-9 h-0.5 bg-slate-900 dark:bg-white rounded-full" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        activateShoeSlot(0);
                        updateCurrentTask((t) => ({ ...t, shoeViewMode: 'multi' }));
                      }}
                      className={`flex items-center gap-1.5 text-xs font-bold transition relative pb-1.5 ${
                        currentTask.shoeViewMode === 'multi'
                          ? 'text-slate-900 font-black dark:text-white'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      多视角图
                      {currentTask.shoeViewMode === 'multi' && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-9 h-0.5 bg-slate-900 dark:bg-white rounded-full" />
                      )}
                    </button>
                  </div>

                  {/* Mode A: 单视角图 (完全还原截图 2) */}
                  {(currentTask.shoeViewMode || 'single') === 'single' ? (
                    <div className="space-y-2">
                      <div
                        onMouseEnter={() => activateShoeSlot(0)}
                        onDragEnter={(event) => {
                          event.preventDefault();
                          activateShoeSlot(0);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleShoeSlotDrop(event, 0)}
                        className="relative min-h-[220px] rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 flex items-center justify-center overflow-hidden"
                      >
                        {shoeImagesBySlot[0] ? (
                          <div className="group relative w-full h-full min-h-[200px] flex items-center justify-center">
                            <AngleBadgeButton
                              angle={shoeImagesBySlot[0]!.angle}
                              onClick={() => setAngleModal({ target: 'shoes', index: 0, currentAngle: shoeImagesBySlot[0]!.angle || 'front' })}
                            />
                            <img
                              src={shoeImagesBySlot[0]!.preview}
                              alt="Shoe Single View"
                              onClick={() => setZoomedImage(shoeImagesBySlot[0]!.preview)}
                              className="max-h-[220px] w-auto object-contain cursor-pointer transition hover:scale-105"
                            />
                            {/* 右上角关闭/删除图标 */}
                            <button
                              type="button"
                              onClick={() => removeShoeImageAtSlot(0)}
                              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-lg bg-black/70 text-white hover:bg-red-500 transition"
                            >
                              <X className="h-4 w-4" />
                            </button>

                            {/* 悬浮胶囊按钮组：资源仓库 & 再次上传 */}
                            <div className="absolute bottom-3 right-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (SVG_SHOES_PRESETS.length > 0) {
                                    handlePresetSelect(SVG_SHOES_PRESETS[Math.floor(Math.random() * SVG_SHOES_PRESETS.length)], 'shoes');
                                  }
                                }}
                                className="rounded-xl bg-[#292524]/85 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-black transition backdrop-blur-xs"
                              >
                                资源仓库
                              </button>
                              <button
                                type="button"
                                onClick={() => openShoeFilePicker(0)}
                                className="rounded-xl bg-[#292524]/85 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-black transition backdrop-blur-xs"
                              >
                                再次上传
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => openShoeFilePicker(0)}
                            className="flex flex-col items-center justify-center py-6 cursor-pointer text-center"
                          >
                            <Upload className="h-7 w-7 text-slate-400 mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              点击、拖拽或粘贴【鞋靴】商品款式图
                            </p>
                            <p className="mt-1 text-[0.65rem] text-slate-400">
                              支持单鞋、短靴、运动鞋、高跟鞋白底图
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 底部提示与更多 */}
                      <div className="flex items-center justify-between text-[0.68rem] font-bold text-slate-500 pt-1">
                        <span><strong className="text-slate-900 dark:text-white">Tips.</strong> 20M以下，jpg、jpeg、png、avif等常见格式</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (SVG_SHOES_PRESETS.length > 0) {
                              handlePresetSelect(SVG_SHOES_PRESETS[Math.floor(Math.random() * SVG_SHOES_PRESETS.length)], 'shoes');
                            }
                          }}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-0.5"
                        >
                          更换推荐预设 &gt;
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Mode B: 多视角图 (完全还原截图 3) */
                    <div className="space-y-3">
                      {/* 多视角网格布局 */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* 1. 主角度大框 */}
                        <div
                          onMouseEnter={() => activateShoeSlot(0)}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            activateShoeSlot(0);
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleShoeSlotDrop(event, 0)}
                          className={`col-span-2 relative min-h-[160px] rounded-xl border bg-white p-2 dark:bg-slate-900 flex items-center justify-center transition ${
                            activeShoeSlot === 0
                              ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/25'
                              : 'border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {shoeImagesBySlot[0] ? (
                            <div className="group relative w-full h-full flex items-center justify-center">
                              <img
                                src={shoeImagesBySlot[0]!.preview}
                                alt="Shoe Main Angle"
                                onClick={() => setZoomedImage(shoeImagesBySlot[0]!.preview)}
                                className="max-h-[150px] w-auto object-contain cursor-pointer"
                              />
                              <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[0.62rem] font-bold text-white">
                                视角 1 · 主视角
                              </span>
                              <button
                                type="button"
                                onClick={() => removeShoeImageAtSlot(0)}
                                className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => openShoeFilePicker(0)}
                              className="flex flex-col items-center justify-center py-4 cursor-pointer text-center"
                            >
                              <Upload className="h-6 w-6 text-slate-400 mb-1" />
                              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                点击上传【45°主透视角度图】
                              </p>
                            </div>
                          )}
                        </div>

                        {/* 2. 辅视角小框 1 */}
                        <div
                          onMouseEnter={() => activateShoeSlot(1)}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            activateShoeSlot(1);
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleShoeSlotDrop(event, 1)}
                          className={`relative min-h-[110px] rounded-xl border bg-white p-2 dark:bg-slate-900 flex items-center justify-center transition ${
                            activeShoeSlot === 1
                              ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/25'
                              : 'border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {shoeImagesBySlot[1] ? (
                            <div className="group relative w-full h-full flex items-center justify-center">
                              <img
                                src={shoeImagesBySlot[1]!.preview}
                                alt="Shoe Side Angle 1"
                                onClick={() => setZoomedImage(shoeImagesBySlot[1]!.preview)}
                                className="max-h-[100px] w-auto object-contain cursor-pointer"
                              />
                              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                                视角 2 · 外侧面
                              </span>
                              <button
                                type="button"
                                onClick={() => removeShoeImageAtSlot(1)}
                                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => openShoeFilePicker(1)}
                              className="flex flex-col items-center justify-center py-2 cursor-pointer text-center"
                            >
                              <Plus className="h-5 w-5 text-slate-400 mb-0.5" />
                              <p className="text-[0.68rem] font-bold text-slate-500">
                                视角 2 · 外侧正视
                              </p>
                            </div>
                          )}
                        </div>

                        {/* 3. 辅视角小框 2 */}
                        <div
                          onMouseEnter={() => activateShoeSlot(2)}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            activateShoeSlot(2);
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleShoeSlotDrop(event, 2)}
                          className={`relative min-h-[110px] rounded-xl border bg-white p-2 dark:bg-slate-900 flex items-center justify-center transition ${
                            activeShoeSlot === 2
                              ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/25'
                              : 'border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {shoeImagesBySlot[2] ? (
                            <div className="group relative w-full h-full flex items-center justify-center">
                              <img
                                src={shoeImagesBySlot[2]!.preview}
                                alt="Shoe Side Angle 2"
                                onClick={() => setZoomedImage(shoeImagesBySlot[2]!.preview)}
                                className="max-h-[100px] w-auto object-contain cursor-pointer"
                              />
                              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                                视角 3 · 内侧/后跟
                              </span>
                              <button
                                type="button"
                                onClick={() => removeShoeImageAtSlot(2)}
                                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => openShoeFilePicker(2)}
                              className="flex flex-col items-center justify-center py-2 cursor-pointer text-center"
                            >
                              <Plus className="h-5 w-5 text-slate-400 mb-0.5" />
                              <p className="text-[0.68rem] font-bold text-slate-500">
                                视角 3 · 内侧/俯视角
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 多视角【推荐示例】栏 (1:1 还原截图 3) */}
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[0.68rem] font-bold text-slate-500 flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" /> 推荐多视角组示例
                          </span>
                          <span className="text-[0.6rem] text-slate-400">点击一次载入全角度参考</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {MULTI_SHOES_PRESETS.map((presetGroup, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const newItems: UploadedImage[] = presetGroup.group.slice(0, 3).map((item, itemIndex) => ({
                                  id: crypto.randomUUID(),
                                  preview: item.preview,
                                  base64: item.preview.split(',')[1] || '',
                                  mime: 'image/svg+xml',
                                  name: item.name,
                                  shoeViewSlot: itemIndex as ShoeViewSlot,
                                }));
                                updateCurrentTask((t) => ({ ...t, shoesImages: newItems }));
                              }}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 p-1.5 transition hover:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                              title={`使用 ${presetGroup.name}`}
                            >
                              {presetGroup.group.slice(0, 3).map((item, i) => (
                                <img
                                  key={i}
                                  src={item.preview}
                                  alt={item.name}
                                  className="h-8 w-8 rounded object-cover border border-slate-200"
                                />
                              ))}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 底部提示 */}
                      <div className="flex items-center justify-between text-[0.68rem] font-bold text-slate-500 pt-1">
                        <span><strong className="text-slate-900 dark:text-white">Tips.</strong> 20M以下，jpg、jpeg、png、avif等常见格式</span>
                        <span className="text-slate-400">更多 &gt;</span>
                      </div>
                    </div>
                  )}
                  <input
                    ref={shoesInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files?.length) {
                        void handleUploadTarget(event.target.files, 'shoes', shoeUploadSlotRef.current);
                      }
                      event.target.value = '';
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[0.68rem] text-pastel-muted font-bold pt-1">
                <span>Tips. 款式图上传无遮挡、无褶皱，生成效果更好~</span>
              </div>
            </section>

            {/* 鞋靴试穿专属参数与视角面板 (放置于 01 鞋靴商品图下方，选项目为纯可选/可取消选择) */}
            {currentTask.subMode === 'shoes' && (
              <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm space-y-3 dark:bg-amber-950/10">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <h3 className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Footprints className="h-4 w-4 text-amber-500" />
                    鞋靴试穿专属偏好与镜头视角
                  </h3>
                  <span className="text-[0.65rem] font-bold text-pastel-muted">Agent 自动对齐脚踝与地面对接阴影</span>
                </div>

                <div>
                  <label className="text-[0.68rem] font-bold text-pastel-muted mb-1.5 block">1. 选择鞋款品类偏好 (可选)</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {SHOE_CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          updateCurrentTask((t) => ({
                            ...t,
                            shoeCategory: t.shoeCategory === opt.id ? undefined : opt.id,
                          }))
                        }
                        className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition border ${
                          currentTask.shoeCategory === opt.id
                            ? 'bg-amber-500 text-white font-black border-amber-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-pastel-text border-pastel-border hover:border-amber-400'
                        }`}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <span className="text-[0.62rem] truncate w-full mt-1 font-bold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[0.68rem] font-bold text-pastel-muted mb-1.5 block">2. 选择试穿镜头视角 / 动作姿势 (可选)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SHOE_ANGLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          updateCurrentTask((t) => ({
                            ...t,
                            shoeAngle: t.shoeAngle === opt.id ? undefined : opt.id,
                          }))
                        }
                        className={`flex items-center justify-between rounded-xl p-2.5 text-left transition border ${
                          currentTask.shoeAngle === opt.id
                            ? 'bg-[#172238] text-white font-black border-[#172238] shadow-sm ring-1 ring-amber-400/50'
                            : 'bg-white dark:bg-slate-800 text-pastel-text border-pastel-border hover:border-slate-400'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-black">{opt.label}</div>
                          <div className="text-[0.6rem] opacity-75">{opt.desc}</div>
                        </div>
                        {currentTask.shoeAngle === opt.id && (
                          <Check className="h-4 w-4 text-amber-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Step 2 Sub Card: 模特/姿势参考图 (选填) - 支持鼠标悬停自动聚焦粘贴，无文字提示 */}
            <section
              onMouseEnter={() => setActiveUploadTarget('model')}
              onClick={() => setActiveUploadTarget('model')}
              className="rounded-[1.5rem] border border-pastel-border bg-white p-4 shadow-sm transition-all dark:bg-[#11151c]"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#17243c] text-xs font-black text-white dark:bg-white dark:text-[#17243c]">
                    02
                  </span>
                  <h3 className="text-sm font-black text-pastel-text">
                    {currentTask.subMode === 'shoes'
                      ? '模特腿部/脚部参考图 (选填)'
                      : currentTask.subMode === 'mannequin'
                      ? '人台或目标模特参考图 (选填)'
                      : '带模特图 (选填)'}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateCurrentTask((task) => {
                        const lockCropping = !(task.lockCropping ?? true);
                        const lockedAspectRatio = task.modelReferences[0]
                          ? getClosestAspectRatio(task.modelReferences[0])
                          : null;
                        return {
                          ...task,
                          lockCropping,
                          aspectRatio: lockCropping && lockedAspectRatio
                            ? lockedAspectRatio
                            : task.aspectRatio,
                        };
                      });
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                      (currentTask.lockCropping ?? true)
                        ? 'bg-[#172238] text-white border-[#2c3b59] hover:bg-[#1f2d4a] shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title="点击切换：开启可 100% 锁死原图构图比例与视角，关闭则允许自由扩展全视角"
                  >
                    {(currentTask.lockCropping ?? true) ? (
                      <>
                        <Lock className="h-3.5 w-3.5 text-emerald-400" />
                        <span>姿态锁定: ON</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5 text-slate-400 opacity-60" />
                        <span>姿态锁定: OFF</span>
                      </>
                    )}
                  </button>
                </div>
                {currentTask.modelReferences.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMaskEditorImageId(null);
                      updateCurrentTask((task) => ({ ...task, modelReferences: [] }));
                    }}
                    className="text-[0.68rem] font-bold text-red-500 hover:underline"
                  >
                    全部移除
                  </button>
                )}
              </div>
              <p className="mb-3 text-xs text-pastel-muted">
                {currentTask.modelReferences.length > 0
                  ? `Agent 已识别 ${currentTask.modelReferences.length} 张模特图，将并行生成 ${currentTask.modelReferences.length} 张上身图片；每张都可独立重新生成。`
                  : '可上传最多 6 张模特照片；不上传则由 AI 自动生成模特。'}
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingModel(true);
                }}
                onDragLeave={() => setIsDraggingModel(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingModel(false);
                  if (e.dataTransfer.files?.length) {
                    handleUploadTarget(e.dataTransfer.files, 'model');
                  }
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition ${
                  isDraggingModel
                    ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                    : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                }`}
              >
                {currentTask.modelReferences.length > 0 ? (
                  <div className="w-full">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {currentTask.modelReferences.map((modelReference, index) => (
                        <div key={modelReference.id || index} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800">
                          <img
                            src={modelReference.preview}
                            alt={`Model Reference ${index + 1}`}
                            onClick={() => setZoomedImage(modelReference.preview)}
                            className="h-full w-full cursor-pointer object-cover"
                            title="点击放大预览"
                          />
                          {modelReference.targetMaskPreview && (
                            <img
                              src={modelReference.targetMaskPreview}
                              alt={`模特 ${index + 1} 已涂抹区域`}
                              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                            />
                          )}
                          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold text-white">
                            #{index + 1}
                          </span>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={(event) => {
                              event.stopPropagation();
                              setMaskEditorImageId(modelReference.id || null);
                            }}
                            className={`absolute bottom-1 right-1 flex min-h-7 items-center gap-1 rounded-md px-1.5 text-[0.58rem] font-black text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50 ${modelReference.targetMaskBase64 ? 'bg-[#ed6d46]' : 'bg-[#17243c]/88 hover:bg-[#ed6d46]'}`}
                            title={modelReference.targetMaskBase64 ? '修改涂抹区域' : '涂抹换装区域'}
                          >
                            <Paintbrush className="h-3 w-3" />
                            {modelReference.targetMaskBase64 ? '已涂抹' : '涂抹'}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (maskEditorImageId === modelReference.id) setMaskEditorImageId(null);
                              updateCurrentTask((task) => ({
                                ...task,
                                modelReferences: task.modelReferences.filter((image) => image.id !== modelReference.id),
                              }));
                            }}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100"
                            title="移除此模特"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {currentTask.modelReferences.length < 6 && (
                        <button
                          type="button"
                          onClick={() => modelInputRef.current?.click()}
                          className="flex aspect-[3/4] items-center justify-center rounded-xl border-2 border-dashed border-[#f48c68] text-[#ed6d46] hover:bg-orange-50"
                          title="继续添加模特"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-[0.68rem] font-bold text-pastel-muted">
                      已添加 {currentTask.modelReferences.length}/6 张 · 可继续拖拽、粘贴或点击加号添加
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => modelInputRef.current?.click()}
                    className="flex flex-col items-center justify-center py-4 cursor-pointer"
                  >
                    <Upload className="h-6 w-6 text-[#ed6d46] mb-1.5" />
                    <p className="text-xs font-bold text-pastel-text">
                      点击、拖拽或粘贴【模特/人体参考图】
                    </p>
                    <p className="mt-1 text-[0.62rem] text-pastel-muted">
                      图片支持全屏放大预览查看
                    </p>
                  </div>
                )}
                <input
                  ref={modelInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleUploadTarget(e.target.files, 'model')}
                />
              </div>
            </section>

            {/* Step 3 Card: 你的试穿要求 (选填) */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-black text-pastel-text">你的试穿要求（选填）</h2>
                <button
                  type="button"
                  onClick={() => {
                    const example = SUB_MODE_OPTIONS.find((s) => s.id === currentTask.subMode)?.promptExample || '';
                    updateCurrentTask((t) => ({ ...t, customPrompt: example }));
                  }}
                  className="text-[0.68rem] font-bold text-[#ed6d46] hover:underline"
                >
                  填入参考提示
                </button>
              </div>
              <textarea
                value={currentTask.customPrompt}
                onChange={(e) => updateCurrentTask((t) => ({ ...t, customPrompt: e.target.value }))}
                rows={3}
                placeholder="例如：保持模特姿态与气场，服装自然贴合透气，呈现高级商业街拍全景效果..."
                className="w-full rounded-xl border border-pastel-border bg-pastel-bg p-3 text-xs text-pastel-text placeholder-pastel-muted outline-none focus:border-orange-500"
              />
            </section>

            {/* Step 4 Card: 图像与试穿参数 */}
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="font-black text-pastel-text">图像与试穿参数</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {/* 1. 生成模型 Modal Button */}
                <CreativeImageModelSelector value={currentTask.selectedModel} onChange={(selectedModel) => updateCurrentTask((task) => ({ ...task, selectedModel }))} title="" compact className="col-span-2 border-0 bg-transparent p-0 shadow-none" />
                <button
                  type="button"
                  onClick={() => setSelectionModal('model')}
                  className="hidden"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">生成模型</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span className="flex items-center gap-2">
                      {MODEL_OPTIONS.find((m) => m.id === currentTask.selectedModel)?.label || currentTask.selectedModel}
                      <span className="rounded-full bg-[#ed6d46]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#ed6d46]">
                        {MODEL_OPTIONS.find((m) => m.id === currentTask.selectedModel)?.hint}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>

                {/* 2. 尺寸比例 Modal Button */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('ratio')}
                  className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span>
                      {ASPECT_RATIO_OPTIONS.find((r) => r.id === currentTask.aspectRatio)?.label || currentTask.aspectRatio}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>

                {/* 3. 试穿分辨率 Modal Button */}
                <button
                  type="button"
                  onClick={() => setSelectionModal('resolution')}
                  className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]"
                >
                  <span className="text-[0.68rem] font-bold text-pastel-muted">试穿分辨率</span>
                  <span className="mt-1 flex items-center justify-between text-sm font-black text-pastel-text">
                    <span>
                      {RESOLUTION_OPTIONS.find((res) => res.id === currentTask.resolution)?.label || currentTask.resolution}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-pastel-muted" />
                  </span>
                </button>
              </div>
            </section>

            {/* ACTION BUTTON */}
            {isLoading ? (
              <button
                type="button"
                onClick={() => cancelGenerationTask(currentTask.id)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-black text-white shadow transition hover:bg-red-600"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                终止试穿 Agent (点击取消)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTryOn}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#172238] text-sm font-black text-white shadow transition hover:bg-[#1f2e4c] active:scale-[0.99]"
              >
                <Sparkles className="h-4 w-4 text-orange-400" />
                一键 AI 万物上身
              </button>
            )}
          </div>

          {/* 3. RIGHT COLUMN: AGENT OUTPUT PANEL */}
          <div className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm min-h-[35rem] flex flex-col">
            {/* Output Display / Loading State / Empty State */}
            <div className="flex-1 flex flex-col">
              {currentTask.resultItems.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-pastel-text text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      并行试穿任务 ({currentTask.resultItems.filter((item) => item.status === 'done').length}/{currentTask.resultItems.length} 张已完成)
                    </h3>
                    <button
                      type="button"
                      onClick={() => void handleDownloadAllResults()}
                      disabled={!currentTask.resultItems.some((item) => item.status === 'done' && item.url)}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-[#172238] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#243554] disabled:cursor-not-allowed disabled:opacity-40"
                      title="下载所有已完成的试穿图片"
                    >
                      <Download className="h-4 w-4 text-orange-400" />
                      全部下载
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {currentTask.resultItems.map((item, i) => {
                      const isCropped = item.isNeckCropped ?? false;
                      return (
                        <div
                          key={item.id}
                          className="group relative aspect-[2/3] w-full max-w-sm justify-self-center overflow-hidden rounded-2xl border border-pastel-border bg-[#faf7f3] shadow-sm transition hover:shadow-md dark:bg-slate-900"
                        >
                          {item.url ? (
                            <div className="absolute inset-0 overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                              <img
                                src={item.url}
                                alt={`Result ${i + 1}`}
                                className={`w-full h-full object-contain transition-all duration-300 ${
                                  isCropped ? 'scale-[1.14] -translate-y-[6%]' : ''
                                }`}
                              />
                            </div>
                          ) : item.status === 'generating' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-orange-50/70 p-6 text-center dark:bg-orange-500/10">
                              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                              <p className="text-xs font-black text-pastel-text">模特 #{i + 1} 正在独立生成</p>
                              <p className="text-[0.68rem] text-pastel-muted">其他模特任务会同时进行，无需等待</p>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-50/70 p-6 text-center dark:bg-red-500/10">
                              <AlertCircle className="h-8 w-8 text-red-500" />
                              <p className="text-xs font-black text-red-600">生成失败</p>
                              <p className="line-clamp-3 text-[0.68rem] text-red-500">{item.error || '请重新生成此图片'}</p>
                            </div>
                          )}

                          {/* 顶部浮动栏：左侧模特参考图缩略图，右侧一键无损去除/恢复脖子胶囊按钮 */}
                          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/60 via-black/20 to-transparent z-10">
                            {item.modelPreview ? (
                              <img src={item.modelPreview} alt={`Model ${i + 1}`} className="h-10 w-8 rounded-md border border-white/80 object-cover shadow-sm" />
                            ) : (
                              <span className="rounded-md bg-black/50 px-2 py-0.5 text-[0.65rem] font-bold text-white/90 backdrop-blur-xs">
                                模特 #{i + 1}
                              </span>
                            )}

                            {item.url && (
                              <button
                                type="button"
                                onClick={() => toggleNeckCrop(item.id)}
                                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-bold backdrop-blur-md transition-all shadow-sm border ${
                                  isCropped
                                    ? 'bg-[#ed6d46] text-white border-orange-400 shadow-orange-500/30 ring-2 ring-orange-400/20'
                                    : 'bg-black/60 text-white/80 border-white/20 hover:bg-black/80 hover:text-white'
                                }`}
                                title="点击一键无损切除/恢复顶端脖子与领口区域"
                              >
                                <Scissors className="h-3 w-3" />
                                <span>{isCropped ? '已切除脖子' : '去除脖子'}</span>
                              </button>
                            )}
                          </div>

                          {/* 底部浮动操作栏：极简规整 */}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-8 z-10">
                            <span className="text-[0.68rem] font-bold text-white/90">
                              {isCropped ? '平直裁切(无脖子)' : '完整显示'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {item.url && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setZoomedImage(item.url)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 transition backdrop-blur-xs"
                                    title="放大预览"
                                  >
                                    <ZoomIn className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void downloadImageFile(item.url!, `万物上身-${i + 1}.png`, isCropped ? 0.12 : 0)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/40 transition backdrop-blur-xs"
                                    title="下载高清试穿图"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleRegenerateResult(item.id)}
                                disabled={item.status === 'generating'}
                                className="flex h-7 items-center justify-center gap-1 rounded-lg bg-white/90 px-2.5 text-[0.65rem] font-black text-[#172238] hover:bg-white transition disabled:opacity-50 shadow-xs"
                                title="仅重新生成这一张"
                              >
                                <RefreshCw className={`h-3 w-3 ${item.status === 'generating' ? 'animate-spin' : ''}`} />
                                <span>{item.status === 'generating' ? '生成中' : '重新生成'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : currentTask.status === 'generating' || isLoading ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-orange-500/30 bg-white/75 p-8 text-center shadow-xs dark:bg-slate-900/50">
                  <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                  <h3 className="mt-4 text-lg font-black text-pastel-text">AI 试穿 Agent 正在创建并行任务</h3>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-pastel-muted">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pastel-bg text-pastel-border">
                    <Grid3x3 className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-bold max-w-sm text-pastel-text">
                    上传模特/产品图片并完成左侧配置后，AI 试穿 Agent 将为您输出高保真试穿效果大图
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PARAMETER SELECTION MODALS */}
      {/* 1. Model Selection Modal */}
      {selectionModal === 'model' && (
        <SelectionModal title="选择生成模型" onClose={() => setSelectionModal(null)}>
          <div className="space-y-3">
            {MODEL_OPTIONS.map((item) => {
              const isSelected = currentTask.selectedModel === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    updateCurrentTask((t) => ({ ...t, selectedModel: item.id }));
                    setSelectionModal(null);
                  }}
                  className={`relative flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-pastel-text">{item.label}</span>
                      <span className="rounded-full bg-[#ed6d46]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#ed6d46]">
                        {item.hint}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-pastel-muted">{item.desc}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-[#172238] dark:text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* 2. Aspect Ratio Selection Modal */}
      {selectionModal === 'ratio' && (
        <SelectionModal title="选择尺寸比例" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ASPECT_RATIO_OPTIONS.map((ratio) => {
              const [w, h] = ratio.id.split(':').map(Number);
              const scale = 50 / Math.max(w, h);
              const isSelected = currentTask.aspectRatio === ratio.id;
              return (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => {
                    updateCurrentTask((t) => ({ ...t, aspectRatio: ratio.id as AspectRatio }));
                    setSelectionModal(null);
                  }}
                  className={`relative flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-transparent bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <span
                    className="block rounded border-2 border-slate-700 dark:border-slate-300"
                    style={{ width: Math.max(20, Math.round(w * scale)), height: Math.max(20, Math.round(h * scale)) }}
                  />
                  <strong className="mt-3 text-xs font-black text-pastel-text">{ratio.label}</strong>
                  <span className="mt-1 text-[0.65rem] text-pastel-muted">{ratio.desc}</span>
                  {isSelected && (
                    <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-[#172238] dark:text-white" />
                  )}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* 3. Resolution Selection Modal */}
      {selectionModal === 'resolution' && (
        <SelectionModal title="选择试穿分辨率" onClose={() => setSelectionModal(null)}>
          <div className="space-y-3">
            {RESOLUTION_OPTIONS.map((item) => {
              const isSelected = currentTask.resolution === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    updateCurrentTask((t) => ({ ...t, resolution: item.id as ImageResolution }));
                    setSelectionModal(null);
                  }}
                  className={`relative flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
                    isSelected
                      ? 'border-[#172238] bg-sky-50/60 shadow-md dark:bg-slate-800'
                      : 'border-pastel-border bg-pastel-bg hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span className="text-sm font-black text-pastel-text">{item.label}</span>
                    <p className="mt-1 text-xs text-pastel-muted">{item.desc}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-[#172238] dark:text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {maskEditorImage && (
        <MaskPaintEditor
          imageUrl={maskEditorImage.preview}
          imageName={maskEditorImage.name}
          initialPreview={maskEditorImage.targetMaskPreview}
          initialOpacity={maskEditorImage.targetMaskOpacity}
          onClose={() => setMaskEditorImageId(null)}
          onSave={saveModelReferenceMask}
        />
      )}

      {/* FULLSCREEN LIGHTBOX ZOOM MODAL (Applies to ALL Images) */}
      {zoomedImage !== null && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-5xl overflow-hidden rounded-3xl bg-pastel-card p-3 shadow-2xl flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              title="关闭预览"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={zoomedImage}
              alt="High-Res Zoom View"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-md"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void downloadImageFile(zoomedImage, '高清素材图片.png')}
                className="flex items-center gap-1.5 rounded-full bg-[#17243c] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#25395c]"
              >
                <Download className="h-3.5 w-3.5" /> 下载高清原图
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANGLE SELECTION MODAL POPUP */}
      {angleModal && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setAngleModal(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-[#131a27]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white">选择商品视角打标</h4>
                  <p className="text-[0.65rem] font-bold text-slate-400">帮助 AI 精准识别单品视角结构与搭配套装提取</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAngleModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {(['front', 'back', 'side', 'detail', 'outfit'] as ProductAngle[]).map((angleKey) => {
                const cfg = ANGLE_CONFIG[angleKey];
                const isSelected = angleModal.currentAngle === angleKey;
                return (
                  <button
                    key={angleKey}
                    type="button"
                    onClick={() => {
                      handleSetAngle(angleModal.target, angleModal.index, angleKey);
                      setAngleModal(null);
                    }}
                    className={`flex items-center gap-2.5 rounded-2xl p-3 text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                      angleKey === 'outfit' ? 'col-span-2' : ''
                    } ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-500/20 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-500/60 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full shrink-0 ${cfg.bgClass.split(' ')[0]}`} />
                    <div className="flex-1 text-left">
                      <span className="font-black block">{cfg.label}</span>
                      {cfg.desc && <span className="text-[0.62rem] text-slate-400 font-normal block leading-tight mt-0.5">{cfg.desc}</span>}
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    ) : (
                      <span className="text-[0.62rem] text-slate-400 shrink-0">选择</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalTryOnTab;
