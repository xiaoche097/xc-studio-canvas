import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateImageToImage, blobToBase64 } from '../services/geminiService';
import {
  buildSceneGenerationPrompt,
  buildSceneGenerationNegativePrompt,
  SceneGenerationProductType,
  SceneGenerationBoardType,
  buildGoldenFormula,
  enhancePrompt,
  QUALITY_BOOSTERS
} from '../services/promptUtils';
import { STYLE_PACKS, StylePack, StyleVariant } from '../services/stylePacks';
import { analyzeProductForScene, SceneAnalysisResult, analyzeReferenceScene } from '../services/sceneAnalyzer';
import { getErrorMessage, compressImage } from '../utils/apiHelpers';
import { storageService } from '../../services/storageService';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import {
  Sparkles,
  Upload,
  Package,
  Store,
  Users,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  Loader2,
  X,
  AlertCircle,
  Image as ImageIcon,
  FileText,
  ScanSearch,
  Wand2,
  Brain,
  Edit3,
  Check,
  RefreshCw,
  MessageSquare,
  Zap,
  Ruler,
} from 'lucide-react';

type BoardType = 'main' | 'aplus' | 'social' | 'story' | 'asset' | 'mobile';

interface UploadedImage {
  file: File;
  preview: string;
}

// Simplified form — only user-override fields + generation settings
interface SceneFormState {
  userHint: string;           // One-line scene description
  batchCount: number;
  // AI-inferred fields (editable overrides)
  productName: string;
  productCategory: string;
  productType: SceneGenerationProductType;
  productSize: string;
  sellingPoints: string;
  sceneDirection: string;
  targetAudience: string;
  modelPersonaPreset: string;
  modelEthnicity: string;
  modelAgeGroup: string;
  modelFamilyStructure: string;
  modelLifestyle: string;
  modelPersonaNotes: string;
  material: string;
  colorStyle: string;
  usageScenario: string;
  brandTone: string;
  avoidElements: string;
  copyIntent: string;
  extraNotes: string;
  interactionHint: string;
  sizeCategory: 'tiny' | 'small' | 'medium' | 'large' | 'wearable';
  cameraDevice: string;
  shotType: string;
}

const BananaIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ color: '#fbbf24' }}
  >
    <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
    <path d="M15 3s-1.5 1-2 3" />
  </svg>
);

const initialForm: SceneFormState = {
  userHint: '',
  batchCount: 1,
  productName: '',
  productCategory: '',
  productType: 'general',
  productSize: '',
  sellingPoints: '',
  sceneDirection: '',
  targetAudience: '',
  modelPersonaPreset: '美国都市女性',
  modelEthnicity: '自动匹配',
  modelAgeGroup: '20-30岁',
  modelFamilyStructure: '单人',
  modelLifestyle: '都市通勤',
  modelPersonaNotes: '',
  material: '',
  colorStyle: '',
  usageScenario: '',
  brandTone: '',
  avoidElements: '',
  copyIntent: '',
  extraNotes: '',
  interactionHint: '',
  sizeCategory: 'medium',
  cameraDevice: '默认',
  shotType: '默认',
};

const BOARD_CONFIG: Record<BoardType, { label: string; description: string; aspectRatio: AspectRatio; icon: string }> = {
  main: {
    label: '副图',
    description: '亚马逊主副图场景，适合卖点强化与点击转化',
    aspectRatio: AspectRatio.SQUARE,
    icon: '🛒',
  },
  aplus: {
    label: 'A+',
    description: '详情页横幅场景，适合叙事化展示与品牌表达',
    aspectRatio: AspectRatio.LANDSCAPE_16_9,
    icon: '✨',
  },
  social: {
    label: '社媒买家秀',
    description: '更生活化的人物/使用场景，适合种草与社媒传播',
    aspectRatio: AspectRatio.PORTRAIT_3_4,
    icon: '📱',
  },
  story: {
    label: '品牌故事',
    description: '电影级超宽场景，适合展示品牌深度、空间感与氛围感',
    aspectRatio: AspectRatio.LANDSCAPE_21_9,
    icon: '🎬',
  },
  asset: {
    label: '品牌资产卡',
    description: '2:3 竖向场景图，适合高转化竖向内容与品牌资产沉淀',
    aspectRatio: AspectRatio.PORTRAIT_2_3,
    icon: '🎴',
  },
  mobile: {
    label: '手机比例',
    description: '9:16 竖向手机场景，适合移动端详情页与垂直社媒展示',
    aspectRatio: AspectRatio.PORTRAIT_9_16,
    icon: '🤳',
  },
};

// AI Analysis card field labels
const ANALYSIS_FIELD_LABELS: Record<string, string> = {
  productName: '产品名称',
  productCategory: '产品品类',
  productType: '产品类型',
  productSize: '预估尺寸',
  material: '材质识别',
  sellingPoints: '核心卖点',
  sceneDirection: '推荐场景',
  modelPersonaPreset: '推荐人群',
  colorStyle: '色调风格',
  brandTone: '品牌调性',
  interactionHint: '交互方式',
  sizeCategory: '尺寸分类',
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  plush: '毛绒公仔',
  apparel: '服装',
  general: '通用产品',
};

const SIZE_CATEGORY_LABELS: Record<string, string> = {
  tiny: '微型 (<10cm)',
  small: '小型 (10-25cm)',
  medium: '中型 (25-50cm)',
  large: '大型 (>50cm)',
  wearable: '穿戴类',
};

const PERSONA_PRESETS: Record<string, {
  modelEthnicity: string;
  modelAgeGroup: string;
  modelFamilyStructure: string;
  modelLifestyle: string;
}> = {
  // 女性
  '美国都市女性': { modelEthnicity: '自动匹配', modelAgeGroup: '20-30岁', modelFamilyStructure: '单人', modelLifestyle: '都市通勤' },
  '美国职场女性': { modelEthnicity: '自动匹配', modelAgeGroup: '25-35岁', modelFamilyStructure: '单人', modelLifestyle: '职场商务' },
  '美国瑜伽/健身女性': { modelEthnicity: '自动匹配', modelAgeGroup: '20-35岁', modelFamilyStructure: '单人', modelLifestyle: '健身运动' },
  '美国居家主妇': { modelEthnicity: '自动匹配', modelAgeGroup: '30-45岁', modelFamilyStructure: '三口之家', modelLifestyle: '居家休闲' },
  '美国文艺女青年': { modelEthnicity: '自动匹配', modelAgeGroup: '20-30岁', modelFamilyStructure: '单人', modelLifestyle: '文艺生活' },
  // 男性
  '美国都市男性': { modelEthnicity: '自动匹配', modelAgeGroup: '25-35岁', modelFamilyStructure: '单人', modelLifestyle: '都市通勤' },
  '美国居家休闲男性': { modelEthnicity: '自动匹配', modelAgeGroup: '20-30岁', modelFamilyStructure: '单人', modelLifestyle: '居家休闲' },
  '美国运动型男性': { modelEthnicity: '自动匹配', modelAgeGroup: '20-35岁', modelFamilyStructure: '单人', modelLifestyle: '健身运动' },
  '美国职场商务男性': { modelEthnicity: '自动匹配', modelAgeGroup: '30-45岁', modelFamilyStructure: '单人', modelLifestyle: '职场商务' },
  '美国户外冒险男性': { modelEthnicity: '自动匹配', modelAgeGroup: '25-40岁', modelFamilyStructure: '单人', modelLifestyle: '户外露营' },
  // 情侣 / 组合
  '美国年轻情侣': { modelEthnicity: '自动匹配', modelAgeGroup: '20-30岁', modelFamilyStructure: '情侣', modelLifestyle: '居家休闲' },
  '美国新婚夫妇': { modelEthnicity: '自动匹配', modelAgeGroup: '25-35岁', modelFamilyStructure: '情侣', modelLifestyle: '新居生活' },
  '美国闺蜜/好友': { modelEthnicity: '自动匹配', modelAgeGroup: '20-30岁', modelFamilyStructure: '好友组合', modelLifestyle: '社交聚会' },
  '美国跨族裔情侣': { modelEthnicity: '混合族裔美国人', modelAgeGroup: '20-35岁', modelFamilyStructure: '情侣', modelLifestyle: '都市通勤' },
  // 家庭
  '美国郊区家庭': { modelEthnicity: '自动匹配', modelAgeGroup: '30-45岁', modelFamilyStructure: '三口之家', modelLifestyle: '郊区家庭' },
  '美国年轻妈妈与儿童': { modelEthnicity: '自动匹配', modelAgeGroup: '30-45岁', modelFamilyStructure: '亲子', modelLifestyle: '郊区家庭' },
  '美国年轻爸爸与儿童': { modelEthnicity: '自动匹配', modelAgeGroup: '30-45岁', modelFamilyStructure: '亲子', modelLifestyle: '户外露营' },
  '美国多孩家庭': { modelEthnicity: '自动匹配', modelAgeGroup: '35-50岁', modelFamilyStructure: '多孩家庭', modelLifestyle: '郊区家庭' },
  '美国三代同堂': { modelEthnicity: '自动匹配', modelAgeGroup: '多年龄段', modelFamilyStructure: '祖孙三代', modelLifestyle: '节日聚会' },
  // 学生 / 青少年 / 儿童
  '美国校园学生': { modelEthnicity: '自动匹配', modelAgeGroup: '18-25岁', modelFamilyStructure: '单人', modelLifestyle: '校园' },
  '美国青少年': { modelEthnicity: '自动匹配', modelAgeGroup: '13-18岁', modelFamilyStructure: '单人', modelLifestyle: '校园' },
  '美国小孩': { modelEthnicity: '自动匹配', modelAgeGroup: '5-12岁', modelFamilyStructure: '单人', modelLifestyle: '校园' },
  '美国婴幼儿与妈妈': { modelEthnicity: '自动匹配', modelAgeGroup: '0-3岁', modelFamilyStructure: '亲子', modelLifestyle: '居家休闲' },
  // 中老年
  '美国中年专业人士': { modelEthnicity: '自动匹配', modelAgeGroup: '40-55岁', modelFamilyStructure: '单人', modelLifestyle: '职场商务' },
  '美国银发族': { modelEthnicity: '自动匹配', modelAgeGroup: '60岁以上', modelFamilyStructure: '老年伴侣', modelLifestyle: '退休生活' },
  // 特殊场景
  '美国宠物主人': { modelEthnicity: '自动匹配', modelAgeGroup: '20-40岁', modelFamilyStructure: '人与宠物', modelLifestyle: '宠物生活' },
  '美国户外露营家庭': { modelEthnicity: '自动匹配', modelAgeGroup: '30-45岁', modelFamilyStructure: '三口之家', modelLifestyle: '户外露营' },
  '美国派对/聚会人群': { modelEthnicity: '混合族裔美国人', modelAgeGroup: '20-35岁', modelFamilyStructure: '多人社交', modelLifestyle: '社交聚会' },
  '无模特（纯产品）': { modelEthnicity: '无', modelAgeGroup: '无', modelFamilyStructure: '无', modelLifestyle: '无' },
};

const SceneGenerationTab: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refSceneInputRef = useRef<HTMLInputElement>(null);

  const [boardType, setBoardType] = useState<BoardType>('main');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [form, setForm] = useState<SceneFormState>(initialForm);
  const [thinkingDraft, setThinkingDraft] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SceneAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showAnalysisDetail, setShowAnalysisDetail] = useState(true);
  const [selectedStylePack, setSelectedStylePack] = useState<StylePack | null>(null);
  const [selectedStyleVariant, setSelectedStyleVariant] = useState<StyleVariant | null>(null);
  const [referenceSceneImage, setReferenceSceneImage] = useState<UploadedImage | null>(null);
  const [isAnalyzingReference, setIsAnalyzingReference] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<'product' | 'reference' | null>(null);

  const currentBoard = BOARD_CONFIG[boardType];
  const aspectRatio = currentBoard.aspectRatio;

  // Can generate if we have images and some analysis/info
  const canGenerate = uploadedImages.length > 0 && (analysisResult || form.productName.trim()) && !isGenerating;

  const businessGoal = useMemo(() => {
    if (boardType === 'main') return '生成高点击率亚马逊副图场景，突出产品主体、核心卖点与电商可读性';
    if (boardType === 'aplus') return '生成适合 A+ 模块的横版场景图，强调品牌感、故事感与细节质感';
    if (boardType === 'story') return '生成电影宽画幅品牌场景，强调史诗感、空间深度与品牌故事张力';
    if (boardType === 'asset') return '生成 2:3 竖版品牌资产卡，适合高转化营销传播与竖屏内容资产';
    if (boardType === 'mobile') return '生成 9:16 手机竖向场景，优化移动端视觉体验与沉浸式社交分享';
    return '生成接近真实买家秀/社媒传播风格的生活化场景图，增强代入感与分享感';
  }, [boardType]);

  const getSizeCategoryFromStr = (sizeStr: string): 'tiny' | 'small' | 'medium' | 'large' | 'wearable' => {
    const s = sizeStr.toLowerCase().replace(/\s/g, '');
    const cmMatch = s.match(/(\d+(?:\.\d+)?)\s*cm/i);
    const inchMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")/i);
    
    let cm = 0;
    if (cmMatch) cm = parseFloat(cmMatch[1]);
    else if (inchMatch) cm = parseFloat(inchMatch[1]) * 2.54;
    else {
      const bareMatch = s.match(/^(\d+(?:\.\d+)?)$/);
      if (bareMatch) cm = parseFloat(bareMatch[1]);
    }

    if (cm <= 0) return 'medium'; // fallback
    if (cm <= 10) return 'tiny';
    if (cm <= 25) return 'small';
    if (cm <= 50) return 'medium';
    return 'large';
  };

  const updateForm = (key: keyof SceneFormState, value: string | number) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // Auto-update sizeCategory if productSize changes
      if (key === 'productSize' && typeof value === 'string') {
        next.sizeCategory = getSizeCategoryFromStr(value);
      }
      return next;
    });
  };

  // ==================== File Handling ====================

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    const nextFiles = validFiles.slice(0, Math.max(0, 10 - uploadedImages.length));
    if (nextFiles.length === 0) return;

    const mapped = nextFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setUploadedImages(prev => [...prev, ...mapped].slice(0, 10));
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
  };

  useImagePaste((files) => {
    if (hoveredSlot === 'reference') {
      handleReferenceSceneFile(files[0]);
    } else {
      addFiles(files);
    }
  });

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
    // If no images left, clear analysis and form
    if (uploadedImages.length <= 1) {
      setAnalysisResult(null);
      setForm(initialForm);
    }
  };

  const handleReferenceSceneFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const uploaded = {
      file,
      preview: URL.createObjectURL(file),
    };
    setReferenceSceneImage(uploaded);
    // runReferenceAnalysis(uploaded); // DISABLED: Manual trigger only per user request
  };

  // ==================== AI Auto-Analysis ====================

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    
    if (uploadedImages.length === 0) {
      setIsAnalyzing(false);
      return;
    }
    
    try {
      const images = await Promise.all(
        uploadedImages.map(async item => ({
          base64: await blobToBase64(item.file),
          mimeType: item.file.type,
        }))
      );
      
      const refImgData = referenceSceneImage ? {
        base64: await blobToBase64(referenceSceneImage.file),
        mimeType: referenceSceneImage.file.type
      } : undefined;
      
      const result = await analyzeProductForScene(images, form.userHint, boardType, refImgData, form.productSize);
      
      // Update analysis result card with the new unified results
      setAnalysisResult(result);
      
      // Apply analysis results to form
      setForm(prev => {
        return {
          ...prev,
          productName: prev.productName || result.productName,
          productCategory: prev.productCategory || result.productCategory,
          productType: result.productType,
          productSize: prev.productSize || result.productSize,
          material: prev.material || result.material,
          sellingPoints: prev.sellingPoints || result.sellingPoints,
          // Now these will reflect the reference image if it was provided
          sceneDirection: result.sceneDirection,
          interactionHint: result.interactionHint,
          colorStyle: result.colorStyle,
          modelPersonaPreset: result.modelPersonaPreset,
          
          targetAudience: prev.targetAudience || result.targetAudience,
          modelEthnicity: result.modelEthnicity,
          modelAgeGroup: result.modelAgeGroup,
          modelFamilyStructure: result.modelFamilyStructure,
          modelLifestyle: result.modelLifestyle,
          usageScenario: prev.usageScenario || result.usageScenario,
          brandTone: prev.brandTone || result.brandTone,
          sizeCategory: prev.productSize ? getSizeCategoryFromStr(prev.productSize) : result.sizeCategory,
          // Auto-fill Camera and Shot Type if they are set to 'auto'
          cameraDevice: prev.cameraDevice === 'auto' ? result.recommendedCamera : prev.cameraDevice,
          shotType: prev.shotType === 'auto' ? result.recommendedShotType : prev.shotType,
        };
      });

      // Update analysis result card to show correct category based on user size
      if (form.productSize) {
        result.sizeCategory = getSizeCategoryFromStr(form.productSize);
      }
      setAnalysisResult(result);
    } catch (err: any) {
      console.error('AI analysis failed:', err);
      setError('AI 分析失败，请手动填写信息或重试');
    } finally {
      setIsAnalyzing(false);
    }
  }, [uploadedImages, form.userHint, form.productSize, boardType, referenceSceneImage]);

  const runReferenceAnalysis = useCallback(async (image: UploadedImage) => {
    setIsAnalyzingReference(true);
    setError(null);
    try {
      const base64 = await blobToBase64(image.file);
      const result = await analyzeReferenceScene({
        base64,
        mimeType: image.file.type
      });
      if (result) {
        setForm(prev => ({ 
          ...prev, 
          sceneDirection: result.sceneDirection,
          interactionHint: result.interactionHint || prev.interactionHint,
          colorStyle: result.colorStyle || prev.colorStyle,
          modelPersonaPreset: (result.modelPersonaPreset && result.modelPersonaPreset !== '无模特（纯产品）') 
            ? result.modelPersonaPreset 
            : prev.modelPersonaPreset
        }));
        
        setAnalysisResult(prev => {
          const baseResult = prev || {
            productName: '商品',
            productCategory: '通用产品',
            productType: 'general',
            productSize: '',
            material: '',
            sellingPoints: '',
            sceneDirection: result.sceneDirection,
            targetAudience: '',
            modelPersonaPreset: result.modelPersonaPreset || '美国都市女性',
            modelEthnicity: '自动匹配',
            modelAgeGroup: '20-30岁',
            modelFamilyStructure: '单人',
            modelLifestyle: '居家休闲',
            colorStyle: result.colorStyle || '',
            usageScenario: '',
            brandTone: '',
            interactionHint: result.interactionHint || 'naturally interacting with the product',
            recommendedCamera: 'iphone',
            recommendedShotType: 'medium',
            sizeCategory: 'medium',
          };
          return { 
            ...baseResult, 
            sceneDirection: result.sceneDirection,
            interactionHint: result.interactionHint || baseResult.interactionHint,
            colorStyle: result.colorStyle || baseResult.colorStyle,
            modelPersonaPreset: (result.modelPersonaPreset && result.modelPersonaPreset !== '无模特（纯产品）') 
              ? result.modelPersonaPreset 
              : baseResult.modelPersonaPreset
          };
        });
        setShowAnalysisDetail(true);
      }
    } catch (err) {
      console.error('Reference scene analysis failed:', err);
      setError('参考场景分析失败，请重试');
    } finally {
      setIsAnalyzingReference(false);
    }
  }, [analysisResult]);

  // Auto-trigger analysis when images are uploaded - DISABLED by user request for manual control
  /* 
  useEffect(() => {
    if (uploadedImages.length > 0 && !analysisResult && !isAnalyzing) {
      const debounce = setTimeout(() => {
        runAnalysis();
      }, 800);
      return () => clearTimeout(debounce);
    }
  }, [uploadedImages.length, analysisResult, isAnalyzing, runAnalysis]);
  */


  // ==================== Prompt Building ====================

  const buildThinkingPrompt = () => {
    const goldenPrompt = buildGoldenFormula({
      subject: [form.productName, form.productCategory, form.productSize].filter(Boolean).join('，') || '电商产品',
      action: form.copyIntent || '展示产品在真实使用场景中的卖点',
      environment: [form.userHint, form.sceneDirection, form.usageScenario, form.targetAudience].filter(Boolean).join('，') || '适配产品定位的高转化场景',
      style: [form.brandTone, form.colorStyle, ['social', 'mobile'].includes(boardType) ? '真实买家秀视觉' : '高转化电商视觉'].filter(Boolean).join('，') || 'premium ecommerce photography',
      lighting: ['social', 'mobile'].includes(boardType)
        ? 'natural lifestyle lighting, candid social content feel'
        : boardType === 'aplus'
          ? 'cinematic commercial lighting, premium storytelling atmosphere'
          : 'clean commercial lighting, clear product focus, conversion-driven composition',
      composition: boardType === 'main'
        ? 'centered hero composition, product first, amazon secondary image style'
        : boardType === 'aplus'
          ? 'wide banner composition, layered environment, premium ecommerce storytelling'
          : boardType === 'mobile'
            ? 'vertical mobile framing, 9:16 screen optimized, lifestyle usage moment'
            : 'portrait framing, lifestyle usage moment, authentic buyer-show composition',
      qualityBooster: 'PRODUCT',
    });

    const productTitleContext = [form.productName, form.productCategory, form.sellingPoints].filter(Boolean).join(' — ') || '电商产品';

    const boardSpecificNote = boardType === 'social'
      ? `买家秀策略：生成真实买家手机拍摄感的图片，场景必须贴近「${productTitleContext}」的实际使用场景。`
      : boardType === 'aplus'
        ? `A+策略：内容必须紧扣产品标题「${productTitleContext}」，讲述产品的使用故事。`
        : boardType === 'asset'
          ? `资产卡策略：生成 2:3 竖版场景，内容必须紧扣产品「${productTitleContext}」的核心资产展示。`
          : boardType === 'mobile'
            ? `手机比例策略：生成 9:16 竖屏场景，内容必须紧扣产品「${productTitleContext}」以高度匹配移动端和垂直社媒。`
            : `副图策略：内容必须紧扣产品标题「${productTitleContext}」的核心卖点。`;

    const strategy = [
      `运营目标：面向${currentBoard.label}板块，输出符合美国真实生活场景的高转化营销图。`,
      `标题关联：所有图片内容必须与产品「${productTitleContext}」紧密相关。`,
      boardSpecificNote,
      `场景策略：${form.userHint ? `【用户描述优先】${form.userHint} (参考方向: ${form.sceneDirection})` : (form.sceneDirection || '围绕产品卖点构建真实生活方式场景')}。`,
      `产品锁定：先锁定颜色、材质、结构与细节，再扩展场景。`,
      `人物画像：${form.modelPersonaPreset}。`,
      `真实感约束：${form.interactionHint || '自然交互'}，尺寸类别=${form.sizeCategory}。`,
      `内部摄影草案：${enhancePrompt(goldenPrompt, 'PRODUCT')}, ${QUALITY_BOOSTERS.EDITORIAL}`,
    ].filter(Boolean);

    return strategy.join('\n');
  };

  const buildGenerationPrompt = () => {
    return buildSceneGenerationPrompt({
      boardType,
      productType: form.productType,
      productName: form.productName,
      productCategory: form.productCategory,
      productSize: form.productSize,
      sellingPoints: form.sellingPoints,
      sceneDirection: form.userHint ? `${form.userHint}, ${form.sceneDirection}` : form.sceneDirection,
      targetAudience: form.targetAudience,
      modelPersonaPreset: form.modelPersonaPreset,
      modelEthnicity: form.modelEthnicity,
      modelAgeGroup: form.modelAgeGroup,
      modelFamilyStructure: form.modelFamilyStructure,
      modelLifestyle: form.modelLifestyle,
      modelPersonaNotes: form.modelPersonaNotes,
      material: form.material,
      colorStyle: form.colorStyle,
      usageScenario: form.usageScenario,
      brandTone: form.brandTone,
      avoidElements: form.avoidElements,
      copyIntent: form.copyIntent,
      extraNotes: form.extraNotes,
      interactionHint: form.interactionHint,
      sizeCategory: form.sizeCategory,
      stylePackId: selectedStylePack?.stylePackName,
      styleVariantId: selectedStyleVariant?.id,
      cameraDevice: form.cameraDevice,
      shotType: form.shotType,
    });
  };

  // ==================== Generation ====================

  const handleGenerate = async () => {
    if (!canGenerate) {
      setError('请至少上传产品图');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const thinkingSummary = buildThinkingPrompt();
      const rawGenerationPrompt = buildGenerationPrompt();
      const negativePrompt = buildSceneGenerationNegativePrompt({
        boardType,
        productType: form.productType,
        avoidElements: form.avoidElements,
        stylePackId: selectedStylePack?.stylePackName,
        styleVariantId: selectedStyleVariant?.id,
      });

      setThinkingDraft(thinkingSummary);

      let finalPrompt = rawGenerationPrompt;

      const images = await Promise.all(
        uploadedImages.map(async item => ({
          base64: await blobToBase64(item.file),
          mimeType: item.file.type,
        }))
      );

      // 并行生成多张图片
      const batchPromises = Array.from({ length: form.batchCount }, () =>
        generateImageToImage(images, finalPrompt, {
          aspectRatio,
          resolution,
          modelId: selectedModel,
          negativePrompt,
          workflowHint: 'scene-product-lock',
        })
      );

      const batchResults = await Promise.all(batchPromises);
      const allResults = batchResults.flat();

      setGeneratedImages(allResults);

      await storageService.saveProject({
        id: crypto.randomUUID(),
        type: 'MARKETING',
        createdAt: Date.now(),
        thumbnail: allResults[0],
        assets: {
          original: uploadedImages.map(item => item.preview),
          generated: allResults,
        },
        metadata: {
          subType: 'scene_generation',
          boardType,
          aspectRatio,
          resolution,
          model: selectedModel,
          prompt: finalPrompt,
          negativePrompt,
          form,
          batchCount: form.batchCount,
        },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `scene-generation-${boardType}-${Date.now()}-${index + 1}.png`;
    link.click();
  };

  // ==================== Analysis Card Edit Helpers ====================

  const handleAnalysisFieldEdit = (field: string, value: string) => {
    // Update form
    updateForm(field as keyof SceneFormState, value);
    // Update analysis result to keep in sync
    if (analysisResult) {
      setAnalysisResult(prev => prev ? { ...prev, [field]: value } : prev);
    }
    setEditingField(null);
  };

  // ==================== Render ====================

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white">
      {/* Header */}
      <div className="text-center py-6 px-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-pastel-border rounded-full text-sm text-pastel-muted mb-3 shadow-sm">
          <Sparkles className="w-4 h-4 text-pastel-highlight" />
          AI 智能场景
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-pastel-text mb-2">一键生成高转化场景图</h1>
        <p className="text-pastel-muted max-w-2xl mx-auto text-sm">
          上传产品图 → AI 自动分析场景方案 → 一键生成。无需手动填写大量表单。
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ========== LEFT COLUMN: Input ========== */}
          <div className="space-y-4">

            {/* Board Type Selection */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Store className="w-4 h-4 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text text-sm">场景板块</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(Object.keys(BOARD_CONFIG) as BoardType[]).map((key) => {
                  const item = BOARD_CONFIG[key];
                  const active = boardType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setBoardType(key)}
                      className={`rounded-xl border p-3 text-center transition-all ${active
                        ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                        : 'border-pastel-border bg-pastel-bg hover:border-purple-200'}`}
                    >
                      <div className="text-lg mb-0.5">{item.icon}</div>
                      <div className={`font-semibold text-sm ${active ? 'text-purple-700' : 'text-pastel-text'}`}>{item.label}</div>
                      <div className="text-[10px] text-pastel-muted mt-0.5">{item.aspectRatio}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Upload */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text text-sm">产品素材图</h3>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
                  disabled={isAnalyzing || uploadedImages.length === 0}
                  className="ml-auto text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 font-bold px-2 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 border border-purple-200"
                >
                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {analysisResult ? '重新分析' : '智能策划场景'}
                </button>
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setHoveredSlot('product'); }}
                onDrop={handleDrop}
                onMouseEnter={() => setHoveredSlot('product')}
                onMouseLeave={() => setHoveredSlot(null)}
                className="relative border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-bg/50 rounded-lg p-3 cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadedImages.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative group/item">
                        <img src={img.preview} alt={`product-${index}`} className="w-full h-20 object-cover rounded-lg border border-pastel-border" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(index);
                          }}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {uploadedImages.length < 10 && (
                      <div className="w-full h-20 border-2 border-dashed border-pastel-border rounded-lg flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-colors">
                        <Upload className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <Upload className="w-7 h-7 mx-auto mb-2 text-pastel-muted" />
                    <p className="text-sm text-pastel-highlight font-medium">上传产品图片</p>
                    <p className="text-xs text-pastel-muted mt-1">支持拖拽、粘贴，JPG / PNG / WEBP（最多10张）</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reference Scene Upload */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                <h3 className="font-semibold text-pastel-text text-sm">参考场景图 (可选)</h3>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (referenceSceneImage) runReferenceAnalysis(referenceSceneImage); }}
                  disabled={isAnalyzingReference || !referenceSceneImage}
                  className="ml-auto text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 font-bold px-2 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 border border-purple-200"
                >
                  {isAnalyzingReference ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  分析场景元素
                </button>
              </div>
              <div
                onClick={() => refSceneInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setHoveredSlot('reference'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleReferenceSceneFile(file);
                }}
                onMouseEnter={() => setHoveredSlot('reference')}
                onMouseLeave={() => setHoveredSlot(null)}
                className="relative border-2 border-dashed border-pastel-border hover:border-purple-300 hover:bg-purple-50/30 rounded-lg p-3 cursor-pointer transition-all"
              >
                <input
                  ref={refSceneInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReferenceSceneFile(file);
                  }}
                  className="hidden"
                />
                {referenceSceneImage ? (
                  <div className="relative group/ref">
                    <img src={referenceSceneImage.preview} alt="reference-scene" className="w-full h-32 object-cover rounded-lg border border-pastel-border" />
                    {isAnalyzingReference && (
                      <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center rounded-lg">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
                        <span className="text-[10px] text-purple-600 font-medium">正在像素级分析场景...</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        URL.revokeObjectURL(referenceSceneImage.preview);
                        setReferenceSceneImage(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/ref:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {!isAnalyzingReference && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (referenceSceneImage) runReferenceAnalysis(referenceSceneImage);
                        }}
                        className="absolute top-2 left-2 p-1.5 bg-purple-600 hover:bg-purple-700 backdrop-blur-md border border-white/20 rounded-full text-white transition-opacity opacity-0 group-hover/ref:opacity-100 flex items-center gap-1 px-2.5 shadow-lg"
                        title="分析场景"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span className="text-[10px] font-medium">分析场景</span>
                      </button>
                    )}
                    {!isAnalyzingReference && (
                      <div className="absolute bottom-2 left-2 right-2 bg-black/50 backdrop-blur-sm rounded px-2 py-1">
                        <p className="text-[9px] text-white truncate">已提取参考信息，可在下方“场景描述”调整</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Wand2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <p className="text-xs text-purple-600 font-medium">上传参考图</p>
                    <p className="text-[10px] text-pastel-muted mt-1">自动分析并同步构图与光影方案</p>
                  </div>
                )}
              </div>
            </div>

            {/* One-line Description */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text text-sm">一句话描述场景（选填）</h3>
              </div>
              <div className="flex gap-2">
                <input
                  value={form.userHint}
                  onChange={(e) => updateForm('userHint', e.target.value)}
                  placeholder="例如：圣诞节送礼场景、居家休闲使用、亲子互动..."
                  className="flex-1 bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                />
                {uploadedImages.length > 0 && (
                  <button
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap border shadow-sm ${
                      !analysisResult 
                        ? 'bg-purple-600 border-purple-700 text-white hover:bg-purple-700' 
                        : 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100'
                    }`}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : !analysisResult ? (
                      <Brain className="w-3.5 h-3.5" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {isAnalyzing ? '分析中...' : !analysisResult ? '开始 AI 自动分析' : '重新分析'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['圣诞送礼', '居家休闲', '亲子陪伴', '户外野餐', '生日派对', '开箱体验'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => updateForm('userHint', tag)}
                    className="px-2.5 py-1 bg-pastel-bg border border-pastel-border rounded-full text-xs text-pastel-muted hover:border-purple-200 hover:text-purple-600 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Size Control — KEY for proportion accuracy */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="w-4 h-4 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text text-sm">产品尺寸</h3>
                <span className="text-[10px] text-orange-500 font-medium bg-orange-50 px-1.5 py-0.5 rounded">影响比例精度</span>
              </div>
              <p className="text-[11px] text-pastel-muted mb-2">填写产品实际尺寸，AI 会按此精确控制场景中产品与人物的比例关系</p>
              <div className="flex gap-2">
                <input
                  value={form.productSize}
                  onChange={(e) => updateForm('productSize', e.target.value)}
                  placeholder="例如：40cm、25x15cm、16inches"
                  className="flex-1 bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300 placeholder-pastel-muted font-medium"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: '微型 8cm', value: '8cm' },
                  { label: '小型 15cm', value: '15cm' },
                  { label: '中小 25cm', value: '25cm' },
                  { label: '中型 35cm', value: '35cm' },
                  { label: '大型 50cm', value: '50cm' },
                  { label: '超大 70cm', value: '70cm' },
                ].map(size => (
                  <button
                    key={size.value}
                    onClick={() => updateForm('productSize', size.value)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${
                      form.productSize === size.value
                        ? 'bg-orange-50 border-orange-300 text-orange-700 font-medium'
                        : 'bg-pastel-bg border-pastel-border text-pastel-muted hover:border-orange-200 hover:text-orange-600'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
              {form.productSize && (() => {
                const cm = parseFloat(form.productSize);
                if (isNaN(cm)) return null;
                const bodyPct = Math.round((cm / 170) * 100);
                const torsoPct = Math.round((cm / 55) * 100);
                return (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded-lg">
                    <p className="text-[11px] text-orange-700">
                      📐 {cm}cm ≈ 成人身高的 <strong>{bodyPct}%</strong>，约躯干的 <strong>{torsoPct}%</strong>
                      {cm <= 10 && ' → 可单手握住的小物件'}
                      {cm > 10 && cm <= 25 && ' → 单手可持的小型产品'}
                      {cm > 25 && cm <= 40 && ' → 需双手或单臂的中型产品'}
                      {cm > 40 && cm <= 60 && ' → 需要双臂环抱的大型产品'}
                      {cm > 60 && ' → 覆盖身体大面积的超大产品'}
                    </p>
                  </div>
                );
              })()}
            </div>


            {/* Camera / Device Selection */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-purple-500 text-lg">📷</span>
                <h3 className="font-semibold text-pastel-text text-sm">设备预设 (Camera / Device)</h3>
                {!!analysisResult && <span className="text-[10px] text-orange-500 font-medium bg-orange-50 px-1.5 py-0.5 rounded animate-pulse">AI 已锁定建议</span>}
                <span className="text-[10px] text-purple-500 font-medium bg-purple-50 px-1.5 py-0.5 rounded">影响质感色调</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { value: 'auto', label: '智能推荐', desc: '根据场景匹配' },
                  { value: 'iphone', label: 'iPhone 实拍', desc: '手机真实抓拍感' },
                  { value: 'fuji', label: '富士胶片', desc: '复古色调颗粒' },
                  { value: 'canon', label: '单反人像', desc: '唯美肤色虚化' },
                  { value: 'sony', label: '微单高清', desc: '极致高清锐度' },
                  { value: 'polaroid', label: '拍立得', desc: '拍立得一次成像' },
                ].map(cam => (
                  <button
                    key={cam.value}
                    onClick={() => updateForm('cameraDevice', cam.value)}
                    disabled={!!analysisResult}
                    className={`flex flex-col items-start p-2 rounded-lg border text-left transition-all ${
                      form.cameraDevice === cam.value
                        ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                        : 'bg-white border-pastel-border text-pastel-muted hover:border-purple-200 hover:bg-purple-50/30'
                    } ${!!analysisResult ? 'opacity-60 cursor-not-allowed grayscale-[0.3]' : ''}`}
                  >
                    <span className="text-sm font-medium">{cam.label}</span>
                    <span className="text-[10px] opacity-70 mt-0.5">{cam.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Shot Type Selection */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-500 text-lg">🖼️</span>
                <h3 className="font-semibold text-pastel-text text-sm">画面景别 (Shot Type)</h3>
                {!!analysisResult && <span className="text-[10px] text-orange-500 font-medium bg-orange-50 px-1.5 py-0.5 rounded animate-pulse">AI 已锁定建议</span>}
                <span className="text-[10px] text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded">影响构图远近</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'auto', label: '智能推荐' },
                  { value: 'wide', label: '远景环境' },
                  { value: 'medium', label: '中景半身' },
                  { value: 'close', label: '近景特写' },
                  { value: 'macro', label: '微距细节' },
                ].map(shot => (
                  <button
                    key={shot.value}
                    onClick={() => updateForm('shotType', shot.value)}
                    disabled={!!analysisResult}
                    className={`px-3 py-2 rounded-lg text-sm transition-all border ${
                      form.shotType === shot.value
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium shadow-sm'
                        : 'bg-white border-pastel-border text-pastel-muted hover:border-blue-200 hover:bg-blue-50/30'
                    } ${!!analysisResult ? 'opacity-60 cursor-not-allowed grayscale-[0.3]' : ''}`}
                  >
                    {shot.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Style Packs */}

            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <h3 className="font-semibold text-pastel-text text-sm">品牌风格包</h3>
                    {selectedStylePack && (
                        <button 
                            onClick={() => { setSelectedStylePack(null); setSelectedStyleVariant(null); }}
                            className="ml-auto text-[10px] text-red-500 hover:underline"
                        >
                            清除选择
                        </button>
                    )}
                </div>
                
                <div className="space-y-3">
                    <select
                        value={selectedStylePack?.stylePackName || ''}
                        onChange={(e) => {
                            const pack = STYLE_PACKS.find(p => p.stylePackName === e.target.value);
                            setSelectedStylePack(pack || null);
                            setSelectedStyleVariant(pack ? pack.styleVariants[0] : null);
                        }}
                        className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-300"
                    >
                        <option value="">-- 选择品牌风格包 --</option>
                        {STYLE_PACKS.map(p => (
                            <option key={p.stylePackName} value={p.stylePackName}>{p.stylePackName}</option>
                        ))}
                    </select>

                    {selectedStylePack && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {selectedStylePack.styleVariants.map(variant => (
                                <button
                                    key={variant.id}
                                    onClick={() => {
                                        setSelectedStyleVariant(variant);
                                        // Sync config
                                        if (variant.config?.config?.numberOfImages) {
                                            updateForm('batchCount', variant.config.config.numberOfImages);
                                        }
                                        // Attempt to match boardType based on aspectRatio
                                        if (variant.config?.config?.aspectRatio === '1:1') setBoardType('main');
                                        else if (variant.config?.config?.aspectRatio === '16:9') setBoardType('aplus');
                                        else if (variant.config?.config?.aspectRatio === '3:4') setBoardType('social');
                                        else if (variant.config?.config?.aspectRatio === '9:16') setBoardType('mobile');
                                        else if (variant.config?.config?.aspectRatio === '4:3') setBoardType('aplus'); // 4:3 is close to aplus/landscape
                                    }}
                                    className={`relative p-2.5 rounded-xl border text-left transition-all ${
                                        selectedStyleVariant?.id === variant.id
                                            ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                                            : 'border-pastel-border bg-white hover:border-purple-200'
                                    }`}
                                >
                                    <div className={`text-xs font-bold mb-1 ${selectedStyleVariant?.id === variant.id ? 'text-purple-700' : 'text-pastel-text'}`}>
                                        {variant.name}
                                    </div>
                                    <div className="text-[10px] text-pastel-muted line-clamp-2">
                                        适用：{variant.whenToUse.join('、')}
                                    </div>
                                    {selectedStyleVariant?.id === variant.id && (
                                        <div className="absolute top-1 right-1">
                                            <Check className="w-3 h-3 text-purple-500" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {selectedStyleVariant && (
                        <div className="mt-2 p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                            <p className="text-[11px] text-purple-700 leading-relaxed italic">
                                ✨ 已应用风格预设："{selectedStyleVariant.name}"。生成时将自动优化光影、质感、构图和负向提示词，确保品牌一致性。
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Analysis Result Card */}
            {(isAnalyzing || analysisResult) && (
              <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <h3 className="font-semibold text-purple-700 text-sm">AI 场景方案</h3>
                  {isAnalyzing && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-purple-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      正在分析产品...
                    </span>
                  )}
                  {analysisResult && !isAnalyzing && (
                    <button
                      onClick={() => setShowAnalysisDetail(prev => !prev)}
                      className="ml-auto text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1"
                    >
                      {showAnalysisDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showAnalysisDetail ? '收起' : '展开'}
                    </button>
                  )}
                </div>

                {isAnalyzing && !analysisResult && (
                  <div className="flex items-center justify-center py-6">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
                      <p className="text-sm text-purple-500">AI 正在分析产品图片...</p>
                      <p className="text-xs text-purple-400 mt-1">自动推断产品类型、场景、人群等</p>
                    </div>
                  </div>
                )}

                {analysisResult && showAnalysisDetail && (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ANALYSIS_FIELD_LABELS).map(([field, label]) => {
                      const value = (analysisResult as any)[field] || '';
                      const displayValue = field === 'productType'
                        ? PRODUCT_TYPE_LABELS[value] || value
                        : field === 'sizeCategory'
                          ? SIZE_CATEGORY_LABELS[value] || value
                          : value;
                      const isEditing = editingField === field;
                      const isWide = ['sceneDirection', 'interactionHint', 'sellingPoints'].includes(field);

                      return (
                        <div
                          key={field}
                          className={`bg-white rounded-lg border border-purple-100 p-2 group/card hover:border-purple-300 transition-colors ${isWide ? 'col-span-2' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-purple-400 font-medium">{label}</span>
                            {!isEditing && (
                              <button
                                onClick={() => setEditingField(field)}
                                className="opacity-0 group-hover/card:opacity-100 transition-opacity p-0.5"
                              >
                                <Edit3 className="w-2.5 h-2.5 text-purple-400" />
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input
                                autoFocus
                                defaultValue={value}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAnalysisFieldEdit(field, (e.target as HTMLInputElement).value);
                                  }
                                  if (e.key === 'Escape') setEditingField(null);
                                }}
                                className="flex-1 bg-purple-50 border border-purple-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300"
                              />
                              <button
                                onClick={(e) => {
                                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                  handleAnalysisFieldEdit(field, input.value);
                                }}
                                className="p-1 text-purple-500 hover:text-purple-700"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-pastel-text truncate" title={displayValue}>{displayValue || '—'}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {analysisResult && !showAnalysisDetail && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">{analysisResult.productName}</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">{PRODUCT_TYPE_LABELS[analysisResult.productType]}</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">{analysisResult.sceneDirection}</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">{analysisResult.modelPersonaPreset}</span>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Settings (collapsed) */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
              <button
                onClick={() => setShowAdvanced(prev => !prev)}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <ScanSearch className="w-4 h-4 text-pastel-highlight" />
                  <h3 className="font-semibold text-pastel-text text-sm">高级设置</h3>
                  <span className="text-[10px] text-pastel-muted">（手动覆盖 AI 推断 / 模型选择）</span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('确定要清空所有高级设置和 AI 分析结果吗？')) {
                        setForm(initialForm);
                        setAnalysisResult(null);
                      }
                    }}
                    className="text-[11px] text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    清空全部设置
                  </div>
                  {showAdvanced ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                </div>
              </button>
              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  {/* Model Selection */}
                  <div>
                    <label className="text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5 px-1">
                      <Cpu className="w-3.5 h-3.5" /> 图像模型
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                          ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                          : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'}`}
                      >
                        <div className="flex items-center gap-1">
                          <BananaIcon className="w-3 h-3" />
                          <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>Banana 2</span>
                        </div>
                        <span className="text-[8px] text-pastel-muted">3.1 Flash</span>
                      </button>
                      <button
                        onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                          ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                          : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'}`}
                      >
                        <div className="flex items-center gap-1">
                          <BananaIcon className="w-3 h-3" />
                          <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>Banana Pro</span>
                        </div>
                        <span className="text-[8px] text-pastel-muted">3 Pro</span>
                      </button>
                      <button
                        onClick={() => setSelectedModel('gpt-image-2')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gpt-image-2'
                          ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                          : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'}`}
                      >
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-orange-500" />
                          <span className={`text-[10px] font-bold ${selectedModel === 'gpt-image-2' ? 'text-purple-700' : 'text-pastel-text'}`}>GPT Image 2</span>
                        </div>
                        <span className="text-[8px] text-pastel-muted">Ultra Quality</span>
                      </button>
                    </div>
                  </div>

                  {/* Resolution & Batch */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-pastel-muted mb-1 block">清晰度</label>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value as ImageResolution)}
                        className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                      >
                        <option value={ImageResolution.RES_1K}>1K 标准</option>
                        <option value={ImageResolution.RES_2K}>2K 高清</option>
                        <option value={ImageResolution.RES_4K}>4K 超清</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-pastel-muted mb-1 block">批量生成</label>
                      <select
                        value={form.batchCount}
                        onChange={(e) => updateForm('batchCount', Number(e.target.value))}
                        className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                          <option key={num} value={num}>{num} 张{num > 1 ? '（并行）' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Manual Override Fields */}
                  <div className="border-t border-pastel-border pt-3">
                    <p className="text-xs text-pastel-muted mb-2 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      手动覆盖（填写后将覆盖 AI 推断）
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <SmallInput label="产品名称" value={form.productName} onChange={(v) => updateForm('productName', v)} placeholder="AI 自动推断" />
                      <SmallInput label="产品品类" value={form.productCategory} onChange={(v) => updateForm('productCategory', v)} placeholder="AI 自动推断" />
                      <div>
                        <label className="text-[10px] text-pastel-muted mb-0.5 block">人群模板</label>
                        <select
                          value={form.modelPersonaPreset}
                          onChange={(e) => {
                            const preset = e.target.value;
                            const mapped = PERSONA_PRESETS[preset];
                            setForm(prev => ({
                              ...prev,
                              modelPersonaPreset: preset,
                              ...(mapped || {}),
                            }));
                          }}
                          className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                        >
                          {Object.keys(PERSONA_PRESETS).map((preset) => (
                            <option key={preset} value={preset}>{preset}</option>
                          ))}
                        </select>
                      </div>
                      <SmallInput label="核心卖点" value={form.sellingPoints} onChange={(v) => updateForm('sellingPoints', v)} placeholder="AI 自动推断" />
                    </div>
                    <div className="mt-2">
                      <label className="text-[10px] text-pastel-muted mb-0.5 block">禁忌元素</label>
                      <input
                        value={form.avoidElements}
                        onChange={(e) => updateForm('avoidElements', e.target.value)}
                        placeholder="例如：避免复杂背景、避免暗黑风"
                        className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                      />
                    </div>
                    <div className="mt-2">
                      <label className="text-[10px] text-pastel-muted mb-0.5 block">补充说明</label>
                      <textarea
                        value={form.extraNotes}
                        onChange={(e) => updateForm('extraNotes', e.target.value)}
                        placeholder="更多运营信息、参考关键词、希望突出的镜头语言等"
                        className="w-full h-16 bg-pastel-bg border border-pastel-border rounded-lg p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="space-y-2">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isGenerating ? `生成 ${currentBoard.label} 场景图中...` : `生成 ${form.batchCount} 张 ${currentBoard.label} 场景图`}
              </button>
              <p className="text-center text-[10px] text-pastel-muted">
                当前：{currentBoard.label} / {currentBoard.aspectRatio} / {resolution} / {selectedModel.includes('flash') ? 'Flash 极速' : 'Pro 推荐'}
              </p>
            </div>
          </div>

          {/* ========== RIGHT COLUMN: Output ========== */}
          <div className="space-y-4">

            {/* AI Thinking Draft */}
            {thinkingDraft && (
              <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-pastel-highlight" />
                  <h3 className="font-semibold text-pastel-text text-sm">AI 运营思路</h3>
                </div>
                <pre className="w-full bg-pastel-bg border border-pastel-border rounded-lg p-3 text-xs text-pastel-text whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
                  {thinkingDraft}
                </pre>
              </div>
            )}

            {/* Generated Results */}
            <div className="bg-white rounded-xl border border-pastel-border p-4 shadow-sm min-h-[520px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pastel-highlight" />
                  <h3 className="font-semibold text-pastel-text text-sm">生成结果</h3>
                </div>
                {generatedImages.length > 0 && !isGenerating && (
                  <button
                    onClick={() => {
                      generatedImages.forEach((img, idx) => handleDownload(img, idx));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    全部下载
                  </button>
                )}
              </div>

              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-pastel-muted">
                  <Loader2 className="w-10 h-10 animate-spin text-purple-400 mb-3" />
                  <p className="font-medium">正在生成 {currentBoard.label} 场景图</p>
                  <p className="text-sm mt-1">AI 分析完成，正在调用图像生成模型...</p>
                </div>
              ) : generatedImages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generatedImages.map((image, index) => (
                    <div key={index} className="relative group border border-pastel-border rounded-xl overflow-hidden bg-pastel-bg">
                      <img
                        src={image}
                        alt={`generated-${index}`}
                        className="w-full h-auto object-contain cursor-zoom-in"
                        onClick={() => setSelectedPreview(image)}
                      />
                      <button
                        onClick={() => handleDownload(image, index)}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-pastel-muted border-2 border-dashed border-pastel-border rounded-xl bg-pastel-bg/50 py-16">
                  <ImageIcon className="w-12 h-12 mb-3 text-pastel-muted" />
                  <p className="font-medium">生成的图片将显示在这里</p>
                  <p className="text-sm mt-1">当前板块：{currentBoard.label} / {currentBoard.aspectRatio}</p>
                  <div className="mt-4 text-xs space-y-1 text-pastel-muted/70 max-w-xs">
                    <p>① 上传产品图 → AI 自动分析</p>
                    <p>② 可选 — 补充场景描述</p>
                    <p>③ 点击生成 🚀</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {selectedPreview && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedPreview(null)}
        >
          <img src={selectedPreview} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
};

// ==================== Small Input Component ====================

const SmallInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-[10px] text-pastel-muted mb-0.5 block">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
    />
  </div>
);

export default SceneGenerationTab;
