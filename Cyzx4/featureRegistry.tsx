import React, { lazy } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Camera,
  Crop,
  Expand,
  Film,
  ImagePlus,
  Layers3,
  PackageCheck,
  Paintbrush,
  Palette,
  ScanSearch,
  Scissors,
  Sparkles,
  Store,
  UserRoundCog,
  Shirt,
  LayoutTemplate,
} from 'lucide-react';
import { AppMode } from './types';

export type FeatureCategory = 'core' | 'marketing' | 'model' | 'tools';

export interface CreativeFeature {
  mode: AppMode;
  title: string;
  englishTitle: string;
  description: string;
  category: FeatureCategory;
  keywords: string[];
  cover: string;
  icon: LucideIcon;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
}

export const FEATURE_CATEGORIES: Array<{
  id: FeatureCategory;
  label: string;
  eyebrow: string;
}> = [
  { id: 'core', label: '核心创作', eyebrow: 'CREATE' },
  { id: 'marketing', label: '电商营销', eyebrow: 'COMMERCE' },
  { id: 'model', label: '模特服装', eyebrow: 'FASHION' },
  { id: 'tools', label: '效率工具', eyebrow: 'UTILITY' },
];

const FusionTab = lazy(() => import('./components/FusionTab'));
const ProductSwapTab = lazy(() => import('./components/ProductSwapTab'));
const PlanningAgentTab = lazy(() =>
  import('./components/PlanningAgentTab').then((module) => ({ default: module.PlanningAgentTab })),
);
const InpaintingTab = lazy(() => import('./components/InpaintingTab'));
const ImageCleanTab = lazy(() => import('./components/ImageCleanTab'));
const WhiteBackgroundRetouchTab = lazy(() => import('./components/WhiteBackgroundRetouchTab'));
const ProductVideoTab = lazy(() => import('./components/ProductVideoTab'));
const SceneGenerationTab = lazy(() => import('./components/SceneGenerationTab'));
const StyleReplicateTab = lazy(() => import('./components/StyleReplicateTab'));
const ModelTransferTab = lazy(() => import('./components/ModelTransferTab'));
const SingleItemTryOnTab = lazy(() => import('./components/SingleItemTryOnTab'));
const EcommerceHeroTab = lazy(() => import('./components/EcommerceHeroTab'));
const ModelPoseFissionTab = lazy(() => import('./components/ModelPoseFissionTab'));
const ModelSceneFissionTab = lazy(() => import('./components/ModelSceneFissionTab'));
const ModelOriginalPasteBackTab = lazy(() => import('./components/ModelOriginalPasteBackTab'));
const ModelFaceSwapTab = lazy(() => import('./components/ModelFaceSwapTab'));
const OutfitExtractionTab = lazy(() => import('./components/OutfitExtractionTab'));
const HDUpscaleTab = lazy(() => import('./components/HDUpscaleTab'));
const AspectRatioTab = lazy(() => import('./components/AspectRatioTab'));

export const CREATIVE_FEATURES: CreativeFeature[] = [
  {
    mode: AppMode.FUSION,
    title: '图像生成',
    englishTitle: 'Image Studio',
    description: '融合多张参考素材，快速构建完整商业画面。',
    category: 'core',
    keywords: ['生图', '融合', '参考图', '商业图片'],
    cover: './creative-covers/image-studio.webp',
    icon: Layers3,
    component: FusionTab,
  },
  {
    mode: AppMode.PRODUCT_SWAP,
    title: '产品替换',
    englishTitle: 'Product Swap',
    description: '保留原图构图与氛围，一键替换画面产品。',
    category: 'core',
    keywords: ['换产品', '产品迁移', '替换商品'],
    cover: './creative-covers/product-swap.webp',
    icon: ArrowLeftRight,
    component: ProductSwapTab,
  },
  {
    mode: AppMode.PLANNING,
    title: '视觉策划',
    englishTitle: 'Visual Planning',
    description: '从商品信息出发，梳理创意方向与视觉方案。',
    category: 'core',
    keywords: ['策划', '视觉方案', '创意方向', '分析'],
    cover: './creative-covers/visual-planning.webp',
    icon: Camera,
    component: PlanningAgentTab,
  },
  {
    mode: AppMode.INPAINTING,
    title: '局部替换',
    englishTitle: 'Smart Inpainting',
    description: '精确圈选局部区域，按指令完成自然替换。',
    category: 'core',
    keywords: ['局部修改', '重绘', '蒙版', '替换'],
    cover: './creative-covers/inpainting.webp',
    icon: Paintbrush,
    component: InpaintingTab,
  },
  {
    mode: AppMode.WHITE_BG_RETOUCH,
    title: '通用白底图精修',
    englishTitle: 'White Packshot',
    description: '面向八大商品品类，批量生成专业白底精修图。',
    category: 'marketing',
    keywords: ['白底图', '产品精修', '珠宝', '五金', '美妆', '3C', '服饰', '鞋类'],
    cover: './creative-covers/white-packshot.webp',
    icon: PackageCheck,
    component: WhiteBackgroundRetouchTab,
  },
  {
    mode: AppMode.PRODUCT_VIDEO,
    title: 'AI生成产品视频',
    englishTitle: 'Product Motion',
    description: '从产品素材到分镜方案，批量生成商业展示视频。',
    category: 'marketing',
    keywords: ['产品视频', '展示视频', '图生视频', '分镜', '视频生成'],
    cover: './creative-covers/product-video.webp',
    icon: Film,
    component: ProductVideoTab,
  },
  {
    mode: AppMode.IMAGE_CLEAN,
    title: '主图生成',
    englishTitle: 'Hero Image',
    description: '面向电商平台，生成清晰聚焦的高转化主图。',
    category: 'marketing',
    keywords: ['电商主图', '白底图', '商品图', '首图'],
    cover: './creative-covers/hero-image.webp',
    icon: ImagePlus,
    component: ImageCleanTab,
  },
  {
    mode: AppMode.ECOMMERCE_HERO,
    title: '生成电商主图',
    englishTitle: 'Ecommerce Hero',
    description: '融合产品信息、目标平台与多语言文案，生成高转化电商主视觉。',
    category: 'marketing',
    keywords: ['生成电商主图', '电商主图', '平台主图', '多语言', '淘宝', '亚马逊', 'SHEIN'],
    cover: './creative-covers/ecommerce-hero.webp',
    icon: LayoutTemplate,
    component: EcommerceHeroTab,
  },
  {
    mode: AppMode.SCENE_GENERATION,
    title: '场景图生成',
    englishTitle: 'Scene Builder',
    description: '将产品自然放入匹配卖点的商业生活场景。',
    category: 'marketing',
    keywords: ['场景图', '商品场景', '营销图', '生活方式'],
    cover: './creative-covers/scene-builder.webp',
    icon: Store,
    component: SceneGenerationTab,
  },
  {
    mode: AppMode.COPYWRITING,
    title: '风格复刻',
    englishTitle: 'Style Replica',
    description: '提取参考图片语言，复刻统一的商业视觉风格。',
    category: 'marketing',
    keywords: ['风格迁移', '复刻', '参考图', '同款'],
    cover: './creative-covers/style-replica.webp',
    icon: Palette,
    component: StyleReplicateTab,
  },
  {
    mode: AppMode.SINGLE_ITEM_TRY_ON,
    title: '单品试穿',
    englishTitle: 'Product Try-On',
    description: '从商品多角度素材出发，生成自然可信的试戴与试穿效果。',
    category: 'model',
    keywords: ['试穿', '试戴', '首饰', '配饰', '服装', '鞋包', '虚拟试穿'],
    cover: './creative-covers/single-item-try-on.webp',
    icon: Shirt,
    component: SingleItemTryOnTab,
  },
  {
    mode: AppMode.MODEL_TRANSFER,
    title: '模特迁移',
    englishTitle: 'Model Transfer',
    description: '迁移服装与模特呈现，扩展商品拍摄素材。',
    category: 'model',
    keywords: ['换模特', '服装迁移', '人物', '试穿'],
    cover: './creative-covers/model-transfer.webp',
    icon: UserRoundCog,
    component: ModelTransferTab,
  },
  {
    mode: AppMode.MODEL_FACE_SWAP,
    title: '模特换脸',
    englishTitle: 'Face Swap',
    description: '上传带模特图与参考人脸，支持模特库与场景深度定制，一键批量自然换脸。',
    category: 'model',
    keywords: ['模特换脸', '换脸', '人脸迁移', '人脸替换', '服装模特'],
    cover: './creative-covers/model-transfer.webp',
    icon: UserRoundCog,
    component: ModelFaceSwapTab,
  },
  {
    mode: AppMode.MODEL_POSE_FISSION,
    title: '模特姿势裂变',
    englishTitle: 'Pose Fission',
    description: '基于同一模特生成多角度、多姿势商品素材。',
    category: 'model',
    keywords: ['姿势', '动作', '裂变', '多角度'],
    cover: './creative-covers/pose-fission.webp',
    icon: Sparkles,
    component: ModelPoseFissionTab,
  },
  {
    mode: AppMode.MODEL_SCENE_FISSION,
    title: '模特场景图裂变',
    englishTitle: 'Scene Photo Fission',
    description: '单张图裂变生成 9 个不同机位、景别与动作姿势的高清大图。',
    category: 'model',
    keywords: ['模特裂变', '景别裂变', '多机位', '多姿势', '九宫格', '9图裂变'],
    cover: './creative-covers/pose-fission.webp',
    icon: Sparkles,
    component: ModelSceneFissionTab,
  },
  {
    mode: AppMode.MODEL_ORIGINAL_PASTE_BACK,
    title: '模特原图贴回',
    englishTitle: 'Detail Restore',
    description: '将原图细节精准贴回，修复生成图关键区域。',
    category: 'model',
    keywords: ['贴回', '高清修复', '原图', '细节'],
    cover: './creative-covers/detail-restore.webp',
    icon: ScanSearch,
    component: ModelOriginalPasteBackTab,
  },
  {
    mode: AppMode.OUTFIT_EXTRACTION,
    title: '搭配提取',
    englishTitle: 'Outfit Extract',
    description: '从模特造型中提取单品与整套搭配信息。',
    category: 'model',
    keywords: ['搭配', '服装提取', '单品', '穿搭'],
    cover: './creative-covers/outfit-extract.webp',
    icon: Scissors,
    component: OutfitExtractionTab,
  },
  {
    mode: AppMode.RETOUCHING,
    title: '高清放大',
    englishTitle: 'HD Upscale',
    description: '提升图片分辨率，增强商品纹理与边缘细节。',
    category: 'tools',
    keywords: ['放大', '高清', '清晰度', '修复', '分辨率'],
    cover: './creative-covers/hd-upscale.webp',
    icon: Expand,
    component: HDUpscaleTab,
  },
  {
    mode: AppMode.RATIO_QUERY,
    title: '比例查询',
    englishTitle: 'Ratio Guide',
    description: '快速分析画幅比例，并获得常用平台尺寸建议。',
    category: 'tools',
    keywords: ['尺寸', '比例', '画幅', '像素', '裁切'],
    cover: './creative-covers/ratio-guide.webp',
    icon: Crop,
    component: AspectRatioTab,
  },
];

export const getFeatureByMode = (mode: AppMode | null) =>
  CREATIVE_FEATURES.find((feature) => feature.mode === mode);
