import React, { useMemo, useRef, useState } from 'react';
import { optimizePrompt, generateImageToImage, blobToBase64 } from '../services/geminiService';
import {
  buildSceneGenerationPrompt,
  buildSceneGenerationNegativePrompt,
  SceneGenerationProductType,
  buildGoldenFormula,
  enhancePrompt,
  QUALITY_BOOSTERS
} from '../services/promptUtils';
import { getErrorMessage } from '../utils/apiHelpers';
import { storageService } from '../../services/storageService';
import { AspectRatio, ImageResolution } from '../types';
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
} from 'lucide-react';

type BoardType = 'main' | 'aplus' | 'social';

interface UploadedImage {
  file: File;
  preview: string;
}

interface SceneFormState {
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
  batchCount: number;
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
  batchCount: 1,
};

const BOARD_CONFIG: Record<BoardType, { label: string; description: string; aspectRatio: AspectRatio }> = {
  main: {
    label: '副图',
    description: '亚马逊主副图场景，适合卖点强化与点击转化',
    aspectRatio: AspectRatio.SQUARE,
  },
  aplus: {
    label: 'A+',
    description: '详情页横幅场景，适合叙事化展示与品牌表达',
    aspectRatio: AspectRatio.LANDSCAPE_16_9,
  },
  social: {
    label: '社媒买家秀',
    description: '更生活化的人物/使用场景，适合种草与社媒传播',
    aspectRatio: AspectRatio.PORTRAIT_3_4,
  },
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

  const [boardType, setBoardType] = useState<BoardType>('main');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-image-preview');
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [form, setForm] = useState<SceneFormState>(initialForm);
  const [thinkingDraft, setThinkingDraft] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const currentBoard = BOARD_CONFIG[boardType];
  const aspectRatio = currentBoard.aspectRatio;

  const canGenerate = uploadedImages.length > 0 && (form.productName.trim() || form.productCategory.trim()) && !isGenerating;

  const businessGoal = useMemo(() => {
    if (boardType === 'main') return '生成高点击率亚马逊副图场景，突出产品主体、核心卖点与电商可读性';
    if (boardType === 'aplus') return '生成适合 A+ 模块的横版场景图，强调品牌感、故事感与细节质感';
    return '生成接近真实买家秀/社媒传播风格的生活化场景图，增强代入感与分享感';
  }, [boardType]);

  const updateForm = (key: keyof SceneFormState, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const applyPersonaPreset = (preset: string) => {
    const mapped = PERSONA_PRESETS[preset];
    setForm(prev => ({
      ...prev,
      modelPersonaPreset: preset,
      ...(mapped || {}),
    }));
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    const nextFiles = validFiles.slice(0, Math.max(0, 5 - uploadedImages.length));
    if (nextFiles.length === 0) return;

    const mapped = nextFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setUploadedImages(prev => [...prev, ...mapped].slice(0, 5));
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
  };

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
  };

  const buildThinkingPrompt = () => {
    const goldenPrompt = buildGoldenFormula({
      subject: [form.productName, form.productCategory, form.productSize].filter(Boolean).join('，') || '电商产品',
      action: form.copyIntent || '展示产品在真实使用场景中的卖点',
      environment: [form.sceneDirection, form.usageScenario, form.targetAudience].filter(Boolean).join('，') || '适配产品定位的高转化场景',
      style: [form.brandTone, form.colorStyle, boardType === 'social' ? '真实买家秀视觉' : '高转化电商视觉'].filter(Boolean).join('，') || 'premium ecommerce photography',
      lighting: boardType === 'social'
        ? 'natural lifestyle lighting, candid social content feel'
        : boardType === 'aplus'
          ? 'cinematic commercial lighting, premium storytelling atmosphere'
          : 'clean commercial lighting, clear product focus, conversion-driven composition',
      composition: boardType === 'main'
        ? 'centered hero composition, product first, amazon secondary image style'
        : boardType === 'aplus'
          ? 'wide banner composition, layered environment, premium ecommerce storytelling'
          : 'portrait framing, lifestyle usage moment, authentic buyer-show composition',
      qualityBooster: 'PRODUCT',
    });

    const productTitleContext = [form.productName, form.productCategory, form.sellingPoints].filter(Boolean).join(' — ') || '电商产品';

    const boardSpecificNote = boardType === 'social'
      ? `买家秀策略：生成真实买家手机拍摄感的图片，场景必须贴近「${productTitleContext}」的实际使用场景，画面必须有真实生活痕迹（个人物品、不完美构图、自然光线），避免棚拍/专业摄影感。每张图的室内家具、墙面装饰、颜色风格必须不同，模拟不同买家的不同家庭环境。`
      : boardType === 'aplus'
        ? `A+策略：内容必须紧扣产品标题「${productTitleContext}」，讲述产品的使用故事。每张图的场景布局、家具选择和装饰风格必须有明显差异，避免重复。`
        : `副图策略：内容必须紧扣产品标题「${productTitleContext}」的核心卖点。每张图的背景场景元素（沙发、装饰、地毯等）必须有差异，避免批量生成看起来雷同。`;

    const strategy = [
      `运营目标：面向${currentBoard.label}板块，输出符合美国真实生活场景与美国市场人物气质的高转化营销图。`,
      `标题关联：所有图片内容必须与产品「${productTitleContext}」紧密相关。`,
      boardSpecificNote,
      `场景策略：${form.sceneDirection || '围绕产品卖点构建真实生活方式场景'}，突出${form.sellingPoints || '产品主体和使用价值'}。`,
      `场景多样性：每张生成图的家具款式/颜色、墙面装饰、地毯/织物、灯具、植物、小道具必须随机变化，杜绝雷同。`,
      `产品锁定：本次生成以参考产品为唯一标准，先锁定颜色、材质、结构与细节，再扩展美国生活方式场景和人物互动。`,
      `模特画像：${[form.modelPersonaPreset, form.modelEthnicity, form.modelAgeGroup, form.modelFamilyStructure, form.modelLifestyle].filter(Boolean).join(' / ')}。`,
      `执行重点：保持产品颜色、结构、材质一致；强化${form.productType === 'plush' ? '毛绒绒感、绣线与抱持互动' : form.productType === 'apparel' ? '版型、褶皱和上身真实感' : '真实材质和生活化互动'}；人物与环境必须符合美国真实生活场景。`,
      form.avoidElements ? `禁忌：${form.avoidElements}。` : '',
      form.modelPersonaNotes ? `人群补充：${form.modelPersonaNotes}。` : '',
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
      sceneDirection: form.sceneDirection,
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
    });
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      setError('请至少上传产品图，并填写产品名称或品类');
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
      });

      setThinkingDraft(thinkingSummary);

      let finalPrompt = rawGenerationPrompt;

      if (isThinkingEnabled) {
        setThinkingDraft(`${thinkingSummary}\n\nAI 正在强化美国生活方式场景与商业摄影执行细节，产品颜色/材质/结构将以参考图为唯一标准锁定...`);
      }

      setThinkingDraft(thinkingSummary);

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
          thinkingEnabled: isThinkingEnabled,
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

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white">
      <div className="text-center py-8 px-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-pastel-border rounded-full text-sm text-pastel-muted mb-4 shadow-sm">
          <Sparkles className="w-4 h-4 text-pastel-highlight" />
          AI 场景运营
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-pastel-text mb-3">一键生成高转化场景图</h1>
        <p className="text-pastel-muted max-w-3xl mx-auto text-sm md:text-base">
          只需上传产品图并填写基础信息，系统会按亚马逊副图 / A+ / 社媒买家秀的运营逻辑，自动整理场景方案并生成对应画面。
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Store className="w-5 h-5 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text">场景板块选择</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(BOARD_CONFIG) as BoardType[]).map((key) => {
                  const item = BOARD_CONFIG[key];
                  const active = boardType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setBoardType(key)}
                      className={`rounded-xl border p-3 text-left transition-all ${active
                        ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                        : 'border-pastel-border bg-pastel-bg hover:border-purple-200'}`}
                    >
                      <div className={`font-semibold text-sm ${active ? 'text-purple-700' : 'text-pastel-text'}`}>{item.label}</div>
                      <div className="text-xs text-pastel-muted mt-1">{item.aspectRatio}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-pastel-muted mt-3">{currentBoard.description}</p>
            </div>

            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text">产品素材图</h3>
              </div>
              <p className="text-xs text-pastel-muted mb-3">上传产品图后，系统将结合尺寸和卖点来思考场景方案（最多5张）</p>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-bg/50 rounded-lg p-4 cursor-pointer transition-all"
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
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative group/item">
                        <img src={img.preview} alt={`product-${index}`} className="w-full h-24 object-cover rounded-lg border border-pastel-border" />
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
                    {uploadedImages.length < 5 && (
                      <div className="w-full h-24 border-2 border-dashed border-pastel-border rounded-lg flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-colors">
                        <Upload className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-pastel-muted" />
                    <p className="text-sm text-pastel-highlight">上传产品图片</p>
                    <p className="text-xs text-pastel-muted mt-1">支持 JPG、PNG、WEBP</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text">基础信息</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="产品名称" value={form.productName} onChange={(value) => updateForm('productName', value)} placeholder="例如：毛绒小熊公仔" />
                <Input label="产品品类" value={form.productCategory} onChange={(value) => updateForm('productCategory', value)} placeholder="例如：毛绒公仔 / 女装卫衣" />
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">产品类型</label>
                  <select
                    value={form.productType}
                    onChange={(e) => updateForm('productType', e.target.value as SceneGenerationProductType)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                  >
                    <option value="general">通用产品</option>
                    <option value="plush">毛绒公仔</option>
                    <option value="apparel">服装</option>
                  </select>
                </div>
                <Input label="产品尺寸" value={form.productSize} onChange={(value) => updateForm('productSize', value)} placeholder="例如：40cm / M-L" />
                <Input label="核心卖点" value={form.sellingPoints} onChange={(value) => updateForm('sellingPoints', value)} placeholder="例如：柔软、礼赠、治愈感" />
              </div>
              <div className="mt-3">
                <label className="text-xs text-pastel-muted mb-1 block">想要的场景方向</label>
                <textarea
                  value={form.sceneDirection}
                  onChange={(e) => updateForm('sceneDirection', e.target.value)}
                  placeholder="例如：温暖卧室、节日礼盒开箱、模特抱着公仔的生活方式场景"
                  className="w-full h-24 bg-pastel-bg border border-pastel-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text">模特人群控制</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">人群模板</label>
                  <select
                    value={form.modelPersonaPreset}
                    onChange={(e) => applyPersonaPreset(e.target.value)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                  >
                    {Object.keys(PERSONA_PRESETS).map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">族裔</label>
                  <select
                    value={form.modelEthnicity}
                    onChange={(e) => updateForm('modelEthnicity', e.target.value)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                  >
                    {['自动匹配', '白人美国人', '黑人美国人', '拉丁裔美国人', '亚裔美国人', '中东裔美国人', '南亚裔美国人', '太平洋岛民', '混合族裔美国人', '无（纯产品图）'].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">年龄层</label>
                  <select
                    value={form.modelAgeGroup}
                    onChange={(e) => updateForm('modelAgeGroup', e.target.value)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                  >
                    {['自动匹配', '0-3岁', '3-6岁', '5-12岁', '13-18岁', '18-25岁', '20-30岁', '25-35岁', '30-45岁', '40-55岁', '55-70岁', '60岁以上', '多年龄段'].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">家庭结构</label>
                  <select
                    value={form.modelFamilyStructure}
                    onChange={(e) => updateForm('modelFamilyStructure', e.target.value)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                  >
                    {['自动匹配', '单人', '情侣', '亲子', '三口之家', '多孩家庭', '好友组合', '多人社交', '祖孙三代', '老年伴侣', '人与宠物', '无（纯产品图）'].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">生活方式</label>
                  <select
                    value={form.modelLifestyle}
                    onChange={(e) => updateForm('modelLifestyle', e.target.value)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                  >
                    {['自动匹配', '都市通勤', '职场商务', '郊区家庭', '校园', '健身运动', '居家休闲', '户外露营', '旅行度假', '宠物生活', '文艺生活', '新居生活', '退休生活', '社交聚会', '节日聚会', '节日送礼', '派对庆祝', '下午茶/咖啡', '车内场景', '无（纯产品图）'].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-pastel-muted mb-1 block">补充人群说明</label>
                  <textarea
                    value={form.modelPersonaNotes}
                    onChange={(e) => updateForm('modelPersonaNotes', e.target.value)}
                    placeholder="例如：纽约公寓里的亚裔美国年轻情侣，自然互动，不要太像棚拍图库"
                    className="w-full h-20 bg-pastel-bg border border-pastel-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
              <button
                onClick={() => setShowAdvanced(prev => !prev)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ScanSearch className="w-5 h-5 text-pastel-highlight" />
                  <h3 className="font-semibold text-pastel-text">高级补充信息</h3>
                </div>
                {showAdvanced ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <Input label="目标人群" value={form.targetAudience} onChange={(value) => updateForm('targetAudience', value)} placeholder="例如：送礼女生、年轻妈妈" icon={<Users className="w-3.5 h-3.5" />} />
                  <Input label="材质/面料" value={form.material} onChange={(value) => updateForm('material', value)} placeholder="例如：水晶超柔绒 / 纯棉" />
                  <Input label="颜色/视觉风格" value={form.colorStyle} onChange={(value) => updateForm('colorStyle', value)} placeholder="例如：奶油色、暖调、ins 风" />
                  <Input label="使用场景" value={form.usageScenario} onChange={(value) => updateForm('usageScenario', value)} placeholder="例如：卧室陪伴、居家穿搭" />
                  <Input label="品牌调性" value={form.brandTone} onChange={(value) => updateForm('brandTone', value)} placeholder="例如：治愈、轻奢、少女感" />
                  <Input label="文案诉求" value={form.copyIntent} onChange={(value) => updateForm('copyIntent', value)} placeholder="例如：礼物感、节日促销、舒适穿搭" />
                  <div className="md:col-span-2">
                    <label className="text-xs text-pastel-muted mb-1 block">禁忌元素</label>
                    <textarea
                      value={form.avoidElements}
                      onChange={(e) => updateForm('avoidElements', e.target.value)}
                      placeholder="例如：避免复杂背景、避免暗黑风、避免过度节日元素"
                      className="w-full h-20 bg-pastel-bg border border-pastel-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-pastel-muted mb-1 block">补充说明</label>
                    <textarea
                      value={form.extraNotes}
                      onChange={(e) => updateForm('extraNotes', e.target.value)}
                      placeholder="可填写更完整的运营信息、参考关键词、希望突出的镜头语言等"
                      className="w-full h-24 bg-pastel-bg border border-pastel-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm space-y-5">
              <div>
                <label className="text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5 px-1">
                  <Cpu className="w-3.5 h-3.5" /> 图像模型选择
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                      ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                      : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <BananaIcon className="w-3.5 h-3.5" />
                      <span className={`text-xs font-bold ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>Nano Banana 2</span>
                    </div>
                    <span className="text-[9px] text-pastel-muted">3.1 Flash (极速)</span>
                  </button>
                  <button
                    onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                      ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                      : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <BananaIcon className="w-3.5 h-3.5" />
                      <span className={`text-xs font-bold ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>Nano Banana Pro</span>
                    </div>
                    <span className="text-[9px] text-pastel-muted">3 Pro (推荐)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">输出比例</label>
                  <div className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm text-pastel-text font-medium">
                    {currentBoard.aspectRatio}（由{currentBoard.label}板块自动决定）
                  </div>
                </div>
                <div>
                  <label className="text-xs text-pastel-muted mb-1 block">清晰度</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as ImageResolution)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                  >
                    <option value={ImageResolution.RES_1K}>1K 标准</option>
                    <option value={ImageResolution.RES_2K}>2K 高清</option>
                    <option value={ImageResolution.RES_4K}>4K 超清</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-pastel-muted mb-1 block">批量生成数量</label>
                <select
                  value={form.batchCount}
                  onChange={(e) => updateForm('batchCount', e.target.value)}
                  className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight"
                >
                  <option value={1}>1 张</option>
                  <option value={2}>2 张（并行）</option>
                  <option value={3}>3 张（并行）</option>
                  <option value={4}>4 张（并行）</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-pastel-border bg-pastel-bg px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-pastel-text flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-pastel-highlight" />
                    AI 运营思考
                  </div>
                  <div className="text-xs text-pastel-muted mt-1">自动整理场景策略、真实感约束与美国生活方式 Prompt 草案</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${isThinkingEnabled ? 'bg-pastel-highlight' : 'bg-gray-200'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isThinkingEnabled ? 'translate-x-5' : ''}`} />
                    <input type="checkbox" checked={isThinkingEnabled} onChange={(e) => setIsThinkingEnabled(e.target.checked)} className="sr-only" />
                  </div>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full py-4 rounded-xl bg-pastel-text text-white font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pastel-highlight transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? `生成 ${currentBoard.label} 场景图中...` : `生成 ${form.batchCount} 张 ${currentBoard.label} 场景图`}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ScanSearch className="w-5 h-5 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text">AI 思考后的场景方案</h3>
              </div>
              <textarea
                value={thinkingDraft}
                readOnly
                placeholder="点击生成后，这里会展示系统整理出的运营目标、场景策略，以及符合美国真实生活场景的人物与画面执行重点。"
                className="w-full h-56 bg-pastel-bg border border-pastel-border rounded-lg p-3 text-sm resize-none focus:outline-none text-pastel-text placeholder-pastel-muted"
              />
            </div>

            <div className="bg-white rounded-xl border border-pastel-border p-5 shadow-sm min-h-[520px] flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-5 h-5 text-pastel-highlight" />
                <h3 className="font-semibold text-pastel-text">生成结果</h3>
              </div>

              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-pastel-muted">
                  <Loader2 className="w-10 h-10 animate-spin text-pastel-highlight mb-3" />
                  <p className="font-medium">正在生成 {currentBoard.label} 场景图</p>
                  <p className="text-sm mt-1">系统会先整理运营思路，再调用现有生成能力输出图片</p>
                </div>
              ) : generatedImages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generatedImages.map((image, index) => (
                    <div key={index} className="relative group border border-pastel-border rounded-xl overflow-hidden bg-pastel-bg">
                      <img
                        src={image}
                        alt={`generated-${index}`}
                        className="w-full aspect-[4/4] object-cover cursor-zoom-in"
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
                <div className="flex-1 flex flex-col items-center justify-center text-center text-pastel-muted border-2 border-dashed border-pastel-border rounded-xl bg-pastel-bg/50">
                  <ImageIcon className="w-12 h-12 mb-3 text-pastel-muted" />
                  <p className="font-medium">生成的图片将显示在这里</p>
                  <p className="text-sm mt-1">当前板块：{currentBoard.label} / {currentBoard.aspectRatio}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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

const Input: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}> = ({ label, value, onChange, placeholder, icon }) => (
  <div>
    <label className="text-xs text-pastel-muted mb-1 flex items-center gap-1 block">
      {icon}
      <span>{label}</span>
    </label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-pastel-bg border border-pastel-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pastel-highlight placeholder-pastel-muted"
    />
  </div>
);

export default SceneGenerationTab;
