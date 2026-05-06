import React, { useState } from 'react';
import { Upload, X, Zap, Loader2, FolderHeart } from 'lucide-react';
import { generateImageToImage, analyzeFissionContext } from '../Cyzx4/services/geminiService';
import { AspectRatio } from '../Cyzx4/types';
import { getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { storageService } from '../services/storageService';
import MainAngleGallery from './MainAngleGallery';
import PoseGrid from './PoseGrid';
import PoseLibraryModal, { savePoseSet } from './components/PoseLibraryModal';

type AngleThumbSpec = {
  view: 'front' | 'back' | 'threeQuarter';
  hands: 'down' | 'pockets' | 'behindBack' | 'hip' | 'pullHem';
  crop: 'tight' | 'mid';
};

const AngleThumb: React.FC<{ spec: AngleThumbSpec; active?: boolean }> = ({ spec, active }) => {
  // Simple SVG wireframe thumbnail: locks only pose/framing cues, not identity/outfit.
  const stroke = active ? '#f97316' : '#94a3b8'; // orange-500 / slate-400
  const fill = active ? 'rgba(249,115,22,0.06)' : 'rgba(148,163,184,0.06)';

  const hasHead = true;
  const isBack = spec.view === 'back';
  const is3q = spec.view === 'threeQuarter';
  const isTight = spec.crop === 'tight';

  // Coordinate system: viewBox 0 0 60 80
  // Framing: tight -> larger torso, less legs
  const torsoTop = isTight ? 14 : 12;
  const torsoBottom = isTight ? 58 : 62;
  const hipY = isTight ? 44 : 48;

  // Body tilt for 3/4
  const tiltX = is3q ? 3 : 0;

  // Arms
  const armMode = spec.hands;

  return (
    <svg viewBox="0 0 60 80" className="w-10 h-14 rounded-md border border-slate-200 bg-white" aria-hidden="true">
      <rect x="1" y="1" width="58" height="78" rx="8" fill={fill} stroke="none" />

      {/* head */}
      {hasHead && (
        <circle cx={30 + tiltX} cy={10} r={6} fill="none" stroke={stroke} strokeWidth={2} opacity={0.9} />
      )}

      {/* neck/shoulders */}
      <path
        d={`M ${22 + tiltX} ${torsoTop} Q ${30 + tiltX} ${torsoTop - 6} ${38 + tiltX} ${torsoTop}`}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        opacity={0.9}
      />

      {/* torso */}
      <path
        d={`M ${20 + tiltX} ${torsoTop} L ${17 + tiltX} ${hipY} Q ${30 + tiltX} ${torsoBottom} ${43 + tiltX} ${hipY} L ${40 + tiltX} ${torsoTop}`}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        opacity={0.9}
      />

      {/* back cue */}
      {isBack && (
        <path
          d={`M ${30 + tiltX} ${torsoTop + 6} L ${30 + tiltX} ${hipY - 4}`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          opacity={0.7}
          strokeDasharray="2 2"
        />
      )}

      {/* arms/hands */}
      {armMode === 'down' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 8} L ${13 + tiltX} ${hipY + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 8} L ${47 + tiltX} ${hipY + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}
      {armMode === 'pockets' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 10} L ${24 + tiltX} ${hipY + 4}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 10} L ${36 + tiltX} ${hipY + 4}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${23 + tiltX} ${hipY + 4} L ${27 + tiltX} ${hipY + 8}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${37 + tiltX} ${hipY + 4} L ${33 + tiltX} ${hipY + 8}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}
      {armMode === 'behindBack' && (
        <>
          <path d={`M ${18 + tiltX} ${torsoTop + 10} Q ${30 + tiltX} ${hipY + 10} ${42 + tiltX} ${torsoTop + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.75} />
          <circle cx={30 + tiltX} cy={hipY + 10} r={2} fill={stroke} opacity={0.75} />
        </>
      )}
      {armMode === 'hip' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 10} L ${26 + tiltX} ${hipY + 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${26 + tiltX} ${hipY + 2} L ${22 + tiltX} ${hipY + 6}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 8} L ${47 + tiltX} ${hipY + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}
      {armMode === 'pullHem' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 10} L ${16 + tiltX} ${torsoBottom - 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 10} L ${44 + tiltX} ${torsoBottom - 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${16 + tiltX} ${torsoBottom - 2} L ${12 + tiltX} ${torsoBottom + 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${44 + tiltX} ${torsoBottom - 2} L ${48 + tiltX} ${torsoBottom + 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}

      {/* legs hint (for mid crop only) */}
      {!isTight && (
        <>
          <path d={`M ${27 + tiltX} ${torsoBottom - 2} L ${24 + tiltX} 74`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.65} />
          <path d={`M ${33 + tiltX} ${torsoBottom - 2} L ${36 + tiltX} 74`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.65} />
        </>
      )}
    </svg>
  );
};

type AngleDef = {
  id: string;
  label: string;
  prompt: string;
  thumb?: AngleThumbSpec;
  refImageUrl?: string;
};

type AnglePreset = {
  id: 'ai' | 'amazon' | 'main';
  label: string;
  motherPrompt?: string;
  angles: AngleDef[];
};

type GeneratedMainAngle = AngleDef & {
  imageUrl: string;
};

const ANGLE_META_LABELS = {
  view: {
    front: '正面',
    back: '背面',
    threeQuarter: '3/4 侧前',
  },
  hands: {
    down: '手臂下垂',
    pockets: '双手插袋',
    behindBack: '双手背后',
    hip: '单手搭腰',
    pullHem: '拉摆动作',
  },
  crop: {
    tight: '近景',
    mid: '半身',
  },
} as const;

const getAngleMeta = (thumb?: AngleThumbSpec) => {
  if (!thumb) {
    return [];
  }

  return [
    ANGLE_META_LABELS.view[thumb.view],
    ANGLE_META_LABELS.hands[thumb.hands],
    ANGLE_META_LABELS.crop[thumb.crop],
  ];
};

// 亚马逊固定角度定义
const AMAZON_ANGLES: AngleDef[] = [
  {
    id: 'A',
    label: '正面近景 + 肩背包带',
    prompt:
      "front view, straight-on, torso cropped from just below the mouth to upper thighs, shoulders level, slight S-curve posture, both arms placed behind the back, wearing a delicate silver necklace, black leather shoulder bag on the model’s left shoulder with visible strap and buckle",
    thumb: { view: 'front', hands: 'behindBack', crop: 'tight' },
  },
  {
    id: 'B',
    label: '背面正对',
    prompt:
      "back view, straight-on, torso cropped from just below the mouth to mid-thigh, shoulders square to camera, arms relaxed down along the sides, hands near outer thighs",
    thumb: { view: 'back', hands: 'down', crop: 'mid' },
  },
  {
    id: 'C',
    label: '正面全正 + 双手自然下垂',
    prompt:
      "front view, straight-on, torso cropped from just below the mouth to mid-thigh, shoulders square, arms relaxed down, both hands resting near outer thighs",
    thumb: { view: 'front', hands: 'down', crop: 'mid' },
  },
  {
    id: 'D',
    label: '正面微转 + 一手搭腰',
    prompt:
      "front view with slight turn 10–15 degrees to camera-left, torso cropped from just below the mouth to mid-thigh, right hand placed on the waistband/hip with elbow bent, left arm relaxed down",
    thumb: { view: 'threeQuarter', hands: 'hip', crop: 'mid' },
  },
  {
    id: 'E',
    label: '正面近景 (主图感)',
    prompt:
      "front view, straight-on, slightly closer crop (from collarbones to upper thighs), arms relaxed down, subtle natural posture",
    thumb: { view: 'front', hands: 'down', crop: 'tight' },
  },
  {
    id: 'F',
    label: '侧前 3/4',
    prompt:
      "three-quarter view, body rotated 35–45 degrees to camera-right, head/face cropped out, torso cropped from just below the mouth to mid-thigh, arms relaxed down, posture upright",
    thumb: { view: 'threeQuarter', hands: 'down', crop: 'mid' },
  },
  {
    id: 'G',
    label: '拉拽下摆展示弹力',
    prompt:
      "three-quarter view, body rotated 20–30 degrees to camera-right, torso cropped from just below the mouth to mid-thigh, both hands pulling the bottom hem of the tube top downward and slightly outward to show stretch, skirt remains in place",
    thumb: { view: 'threeQuarter', hands: 'pullHem', crop: 'mid' },
  },
];

const AMAZON_MOTHER_PROMPT =
  "Studio e-commerce fashion photo on pure white seamless background, adult female model, eye-level camera, straight horizon, 85mm lens look, medium shot, centered composition, soft even studio lighting, minimal shadows, sharp focus, high resolution, Amazon catalog style, model’s face cropped out (frame cuts at the mouth/chin), same pose and camera angle as specified.";

// 主图角度（参考图一致的“角度/构图/姿势/比例”锁定）
const MAIN_IMAGE_ANGLES: AngleDef[] = [
  {
    id: 'M1',
    label: '主图-背面回眸（半身）',
    prompt:
      "back view, torso-focused main image framing, crop from just above the top of the head to upper thighs, shoulders level, arms relaxed down, natural stance, head turned slightly to camera-left (subtle over-shoulder feel), keep the same camera height and framing",
    thumb: { view: 'back', hands: 'down', crop: 'mid' },
    refImageUrl: '/main-angle-refs/HM9A1177.jpg',
  },
  {
    id: 'M2',
    label: '主图-正面插袋（半身）',
    prompt:
      "front view, straight-on, main image framing, crop from just above the top of the head to upper thighs, both hands placed inside front jean pockets, elbows angled outward slightly, chest open, neutral confident stance, camera at chest level, centered composition",
    thumb: { view: 'front', hands: 'pockets', crop: 'mid' },
    refImageUrl: '/main-angle-refs/HM9A1197.jpg',
  },
  {
    id: 'M3',
    label: '主图-正面插袋（更近景）',
    prompt:
      "front view, straight-on, closer main image crop (from upper chest to upper thighs), both hands inside front pockets, shoulders relaxed, minimal body twist, centered composition, keep proportions natural",
    thumb: { view: 'front', hands: 'pockets', crop: 'tight' },
    refImageUrl: '/main-angle-refs/HM9A1202.jpg',
  },
  {
    id: 'M4',
    label: '主图-正面站姿（自然下垂）',
    prompt:
      "front view, straight-on, main image framing, crop from just above the top of the head to upper thighs, arms relaxed down, hands near outer thighs, neutral stance, centered composition, camera eye-level",
    thumb: { view: 'front', hands: 'down', crop: 'mid' },
    refImageUrl: '/main-angle-refs/HM9A1282.jpg',
  },
  {
    id: 'M5',
    label: '主图-侧前 3/4（插袋）',
    prompt:
      "three-quarter front view, body rotated about 30–40 degrees to camera-left, main image framing crop from just above the top of the head to upper thighs, both hands inside front pockets, weight shifted slightly to one leg, shoulders relaxed, centered composition",
    thumb: { view: 'threeQuarter', hands: 'pockets', crop: 'mid' },
    refImageUrl: '/main-angle-refs/HM9A1290.jpg',
  },
  {
    id: 'M6',
    label: '主图-侧前 3/4（视线侧看）',
    prompt:
      "three-quarter front view, body rotated about 30–40 degrees to camera-right, main image framing crop from just above the top of the head to upper thighs, arms relaxed down, head turned to look off-camera, neutral stance, centered composition",
    thumb: { view: 'threeQuarter', hands: 'down', crop: 'mid' },
    refImageUrl: '/main-angle-refs/HM9A1307.jpg',
  },
];

const MAIN_IMAGE_MOTHER_PROMPT =
  "Studio e-commerce main-image style photo on pure white seamless background, adult female model, eye-level camera, straight horizon, clean centered composition, soft even studio lighting, minimal shadows, sharp focus, high resolution. IMPORTANT: Lock only the camera angle + framing/crop + pose/stance + body proportions to match the selected main-image angle specification exactly. Do NOT copy identity/outfit from any reference; only match angle/framing/pose.";

const ANGLE_PRESETS: AnglePreset[] = [
  { id: 'ai', label: 'AI 自动', angles: [] },
  { id: 'amazon', label: '亚马逊固定角度', motherPrompt: AMAZON_MOTHER_PROMPT, angles: AMAZON_ANGLES },
  { id: 'main', label: '主图角度', motherPrompt: MAIN_IMAGE_MOTHER_PROMPT, angles: MAIN_IMAGE_ANGLES },
];

const PoseFissionTab: React.FC = () => {
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [accessoryImages, setAccessoryImages] = useState<string[]>([]);
  const [modelOutfitImages, setModelOutfitImages] = useState<string[]>([]);
  const [sceneImages, setSceneImages] = useState<string[]>([]);
  const [scenePrompt, setScenePrompt] = useState<string>('');

  const [bodyInfo, setBodyInfo] = useState('');
  const [specificFeatures, setSpecificFeatures] = useState('');
  const [detailPrompt, setDetailPrompt] = useState('');
  const [modelType, setModelType] = useState('gemini-3.1-flash-image-preview');
  const [resolution, setResolution] = useState('2K');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [mainAspectRatio, setMainAspectRatio] = useState<'2:3' | '3:4' | '4:5'>('2:3');

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedGridImage, setGeneratedGridImage] = useState<string | null>(null);
  const [generatedMainAngles, setGeneratedMainAngles] = useState<GeneratedMainAngle[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const [selectedPresetId, setSelectedPresetId] = useState<AnglePreset['id']>('ai');
  const [selectedAngleIds, setSelectedAngleIds] = useState<string[]>(AMAZON_ANGLES.map(a => a.id));

  const currentPreset = ANGLE_PRESETS.find(p => p.id === selectedPresetId) || ANGLE_PRESETS[0];
  const presetAngles = currentPreset.angles;
  const isMainPreset = selectedPresetId === 'main';
  const displayedMainAngles = isMainPreset
    ? presetAngles
        .filter(angle => selectedAngleIds.includes(angle.id))
        .map(angle => ({
          ...angle,
          imageUrl: generatedMainAngles.find(result => result.id === angle.id)?.imageUrl || null,
        }))
    : [];

  const handleSelectPreset = (presetId: AnglePreset['id']) => {
    setSelectedPresetId(presetId);
    const preset = ANGLE_PRESETS.find(p => p.id === presetId);
    if (!preset || presetId === 'ai') {
      setSelectedAngleIds([]);
      return;
    }
    setSelectedAngleIds(preset.angles.map(a => a.id));
  };

  const toggleAngleId = (angleId: string) => {
    setSelectedAngleIds(prev => (prev.includes(angleId) ? prev.filter(id => id !== angleId) : [...prev, angleId]));
  };

  // --- Drag and Drop States ---
  const [draggedIdx, setDraggedIdx] = useState<{type: 'model'|'product'|'accessory'|'outfit'|'scene', idx: number} | null>(null);
  const [isDragOverModel, setIsDragOverModel] = useState(false);
  const [isDragOverProduct, setIsDragOverProduct] = useState(false);
  const [isDragOverAccessory, setIsDragOverAccessory] = useState(false);
  const [isDragOverOutfit, setIsDragOverOutfit] = useState(false);
  const [isDragOverScene, setIsDragOverScene] = useState(false);

  const processFiles = (files: File[], setter: React.Dispatch<React.SetStateAction<string[]>>, maxLimit: number, currentList: string[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (currentList.length + validFiles.length > maxLimit) {
      alert(`最多支持 ${maxLimit} 张图片`);
      return;
    }
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setter(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // --- Upload Drop Area Handlers ---
  const handleDragOverArea = (e: React.DragEvent, type: 'model' | 'product' | 'accessory' | 'outfit' | 'scene') => {
    e.preventDefault();
    if (type === 'model') setIsDragOverModel(true);
    if (type === 'product') setIsDragOverProduct(true);
    if (type === 'accessory') setIsDragOverAccessory(true);
    if (type === 'outfit') setIsDragOverOutfit(true);
    if (type === 'scene') setIsDragOverScene(true);
  };
  const handleDragLeaveArea = (type: 'model' | 'product' | 'accessory' | 'outfit' | 'scene') => {
    if (type === 'model') setIsDragOverModel(false);
    if (type === 'product') setIsDragOverProduct(false);
    if (type === 'accessory') setIsDragOverAccessory(false);
    if (type === 'outfit') setIsDragOverOutfit(false);
    if (type === 'scene') setIsDragOverScene(false);
  };
  const handleDropArea = (e: React.DragEvent, type: 'model' | 'product' | 'accessory' | 'outfit' | 'scene', setter: React.Dispatch<React.SetStateAction<string[]>>, maxLimit: number, currentList: string[]) => {
    e.preventDefault();
    handleDragLeaveArea(type);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files), setter, maxLimit, currentList);
    }
  };

  // --- Reorder Sorting Handlers ---
  const handleDragStartItem = (e: React.DragEvent, type: 'model'|'product'|'accessory'|'outfit'|'scene', idx: number) => {
    setDraggedIdx({ type, idx });
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { (e.target as HTMLElement).classList.add('opacity-30'); }, 0);
  };

  const handleDragEnterItem = (e: React.DragEvent, type: 'model'|'product'|'accessory'|'outfit'|'scene', targetIdx: number) => {
    e.preventDefault();
    if (!draggedIdx || draggedIdx.type !== type || draggedIdx.idx === targetIdx) return;
    
    if (type === 'model') {
       setModelImages(prev => {
         const newList = [...prev];
         const [draggedImg] = newList.splice(draggedIdx.idx, 1);
         newList.splice(targetIdx, 0, draggedImg);
         return newList;
       });
    } else if (type === 'product') {
       setProductImages(prev => {
         const newList = [...prev];
         const [draggedImg] = newList.splice(draggedIdx.idx, 1);
         newList.splice(targetIdx, 0, draggedImg);
         return newList;
       });
    } else if (type === 'outfit') {
       setModelOutfitImages(prev => {
         const newList = [...prev];
         const [draggedImg] = newList.splice(draggedIdx.idx, 1);
         newList.splice(targetIdx, 0, draggedImg);
         return newList;
       });
     } else if (type === 'scene') {
       setSceneImages(prev => {
         const newList = [...prev];
         const [draggedImg] = newList.splice(draggedIdx.idx, 1);
         newList.splice(targetIdx, 0, draggedImg);
         return newList;
       });
     } else {
       setAccessoryImages(prev => {
         const newList = [...prev];
         const [draggedImg] = newList.splice(draggedIdx.idx, 1);
         newList.splice(targetIdx, 0, draggedImg);
         return newList;
       });
    }
    setDraggedIdx({ type, idx: targetIdx });
  };

  const handleDragEndItem = (e: React.DragEvent) => {
    setDraggedIdx(null);
    (e.target as HTMLElement).classList.remove('opacity-30');
  };




  const removeImage = (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (productImages.length === 0 && modelImages.length === 0) {
      alert("请提供至少 1 张主产品或模特的图片");
      return;
    }

    if (selectedPresetId !== 'ai' && selectedAngleIds.length === 0) {
      alert(isMainPreset ? "请至少选择 1 个主图角度" : "请至少选择 1 个固定角度");
      return;
    }

    setIsGenerating(true);
    setStatusMessage(isMainPreset ? "正在分析参考图并锁定主图角度..." : "正在由 AI 视觉大脑分析产品细节与规划姿势...");
    
    try {
      const apiImages = [...productImages, ...modelOutfitImages, ...modelImages, ...accessoryImages, ...sceneImages].map(imgUrl => {
         const match = imgUrl.match(/^data:(image\/[a-zA-Z]*);base64,(.*)$/);
         if (match) {
           return { mimeType: match[1], base64: match[2] };
         }
         return { mimeType: 'image/jpeg', base64: imgUrl.split(',')[1] || imgUrl };
      });

      const analysis = await analyzeFissionContext(apiImages, isMainPreset ? '9:16' : aspectRatio, {
        productCount: productImages.length,
        outfitCount: modelOutfitImages.length,
        modelCount: modelImages.length,
        accessoryCount: accessoryImages.length,
      });
      setAnalysisResult(analysis);

      const modelCount = modelImages.length;
      const productCount = productImages.length;
      const outfitCount = modelOutfitImages.length;
      const accessoryCount = accessoryImages.length;
      const sceneCount = sceneImages.length;

      const productStartIdx = 1;
      const outfitStartIdx = productCount + 1;
      const modelStartIdx = productCount + outfitCount + 1;
      const accessoryStartIdx = productCount + outfitCount + modelCount + 1;
      const sceneStartIdx = productCount + outfitCount + modelCount + accessoryCount + 1;

      const productIdxRange = productCount > 0
        ? `Image ${productStartIdx}${productCount > 1 ? ` to Image ${productCount}` : ""}`
        : "None";

      const outfitIdxRange = outfitCount > 0
        ? `Image ${outfitStartIdx}${outfitCount > 1 ? ` to Image ${outfitStartIdx + outfitCount - 1}` : ""}`
        : "None";

      const modelIdxRange = modelCount > 0
        ? `Image ${modelStartIdx}${modelCount > 1 ? ` to Image ${modelStartIdx + modelCount - 1}` : ""}`
        : "None";

      const accessoryIdxRange = accessoryCount > 0
        ? `Image ${accessoryStartIdx}${accessoryCount > 1 ? ` to Image ${accessoryStartIdx + accessoryCount - 1}` : ""}`
        : "None";

      const sceneIdxRange = sceneCount > 0
        ? `Image ${sceneStartIdx}${sceneCount > 1 ? ` to Image ${sceneStartIdx + sceneCount - 1}` : ""}`
        : "None";

      const wardrobeLock = `[WARDROBE WHITELIST / SOURCE OUTFIT REMOVAL]:
- Clothing from the model identity reference images (${modelIdxRange}) is NEVER allowed to remain in the result.
- Treat model reference images as identity/body/proportion references only. Their original clothes, inner layers, sleeves, pants, skirts, bras, slips, and styling must be ignored and removed.
- Outfit effect references (${outfitIdxRange}) define the DESIRED WEARING RESULT only: use them to match how the product should be worn, layered, tucked, draped, cropped, fitted, and styled on the body, but do not copy the person, background, or unrelated garments from those images.
- The ONLY allowed visible wardrobe items are:
  1. the PRIMARY PRODUCT from ${productIdxRange}
  2. optional accessories / extra wearable items from ${accessoryIdxRange}
- If any visible garment is not present in the product or accessory references, remove it completely.
- Do not preserve any underlayer, undershirt, base tee, original sleeve, original collar, or original hem from the model reference.
- If the PRIMARY PRODUCT is sleeveless / strapless / cropped / open-back, the result must keep that exact exposed structure with no extra fabric added underneath.`;

      const identityLock = modelCount > 0
        ? `[IDENTITY LOCK]: CRITICAL: The model MUST be the EXACT SAME person as shown in the model identity reference images (${modelIdxRange}). Zero identity drift.
- Model Traits (Auto-Analysis): ${analysis.model_identity}
- Model Traits (User Input): ${specificFeatures || "None"}`
        : `[MODEL CREATION]: No dedicated model identity references were provided.
- Build one consistent adult female model based on garment fit, user notes, and any visible person in the reference set.
- Model Traits (User Input): ${specificFeatures || "None"}`;

      const outfitEffectLock = outfitCount > 0
        ? `[OUTFIT EFFECT LOCK]: Match the desired wearing result from ${outfitIdxRange} as closely as possible.
- Follow the clothing presentation shown there for silhouette, styling, layering outcome, tuck/untuck behavior, garment tension, exposed areas, hem behavior, sleeve behavior, and how the product sits on the body.
- Keep the exact product design from ${productIdxRange}; use ${outfitIdxRange} only as a wear-result blueprint, not as a replacement product source.
- Do not copy the outfit-effect model's identity, background, lighting, or unrelated garments.`
        : `[OUTFIT EFFECT LOCK]: No dedicated outfit-effect reference was provided. Infer the final wearing result from the product images and user notes.`;

      const sceneLock = sceneCount > 0 || scenePrompt
        ? `[SCENE & BACKGROUND]: ${sceneCount > 0 ? `Match the environment, lighting, and general background vibe from ${sceneIdxRange}. CRITICAL: If there are any people or models visible in the scene reference images (${sceneIdxRange}), you MUST IGNORE THEM. Treat the scene reference as an empty environment. Do NOT copy the identity, pose, or clothing of any person from the scene reference images.` : ''} ${scenePrompt ? `Additional scene requirements: ${scenePrompt}.` : ''}`
        : `[SCENE & BACKGROUND]: PURE WHITE (#FFFFFF), clean studio lighting, minimal shadows.`;

      const baseNegativePrompt = [
        "original outfit",
        "keep original clothes",
        "different clothing",
        "wrong garment",
        "source clothing remnants",
        "visible undershirt",
        "inner tee",
        "extra sleeves",
        "added underlayer",
        "leftover model-reference clothes",
        "wrong pants",
        "wrong skirt",
        "unreferenced clothing",
        "copy/paste reference",
        "duplicate reference image",
        "wrong styling result",
        "wrong layering",
        "wrong tuck",
        "wrong drape",
        "multiple people",
        "extra people",
        "people in background"
      ].join(", ");

      if (isMainPreset) {
        const mainAngles = currentPreset.angles.filter(angle => selectedAngleIds.includes(angle.id));
        setGeneratedGridImage(null);
        
        setStatusMessage(`正在并行生成 ${mainAngles.length} 个主图角度 (预计 15-30 秒)...`);
        setGeneratedMainAngles(mainAngles.map(a => ({ ...a, imageUrl: '' } as GeneratedMainAngle)));

        await Promise.all(mainAngles.map(async (angle) => {
          let angleApiImages = [...apiImages];
          let explicitReferencePrompt = "";

          // Fetch the rigid reference image if available
          if (angle.refImageUrl) {
            try {
              const res = await fetch(angle.refImageUrl);
              const blob = await res.blob();
              const base64String = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              
              angleApiImages.push({
                mimeType: blob.type,
                base64: base64String.split(',')[1],
              });
              
              const totalImages = angleApiImages.length;
              explicitReferencePrompt = `\n[EXACT POSE & FRAMING REFERENCE]: Image ${totalImages} is the STRICT layout blueprint.\n- The output MUST exactly match Image ${totalImages}'s body pose, arm angles, leg placement, camera angle, subject scaling, body tilt, and crop boundaries.\n- The output MUST maintain a 1:1 identical visual framing to Image ${totalImages}.\n- DO NOT inherit any clothing style, identity, or background from Image ${totalImages}. Use it ONLY to enforce the exact geometric proportions and pose placement.\n`;
            } catch (err) {
              console.warn(`Failed to fetch angle reference image for ${angle.id}:`, err);
            }
          }

          const mainPrompt = `${currentPreset.motherPrompt || MAIN_IMAGE_MOTHER_PROMPT}
[SHOT TYPE]: Single fashion catalog main image only. No collage, no grid, no multi-angle sheet.
[SELECTED ANGLE]: ${angle.id} - ${angle.label}
[ANGLE BLUEPRINT]: ${angle.prompt}

[NON-NEGOTIABLE ANGLE LOCK]:
- Match the selected angle blueprint as literally as possible.
- Preserve the exact view direction, crop distance, head visibility, body rotation, shoulder line, hand placement, and white-space balance.
- Keep the model centered on a portrait ${mainAspectRatio} canvas.
- Maintain the same half-body / close crop level described above. Do NOT zoom wider or tighter.
- Do not improvise a new pose, camera height, lens feel, or composition.${explicitReferencePrompt}

${identityLock}
${outfitEffectLock}
[BODY DIMENSIONS]: Match the model's build, height, and proportions exactly as shown in the reference images.
- Build/Measurements (User Input): ${bodyInfo || "Use the reference images."}
- Detail Prompt (User Input): ${detailPrompt || "None"}

[PRIMARY PRODUCT (NON-NEGOTIABLE)]:
- The PRIMARY PRODUCT is shown in ${productIdxRange}. It MUST appear on the model exactly.
- 1:1 match of garment structure, seams, buttons, texture, print/pattern, color, and fit. NO substitutions.

[OUTFIT RULE]:
- If the model identity reference already wears the primary product, preserve it exactly.
- Otherwise, replace any original outfit using ONLY the primary product reference images in ${productIdxRange}.
${wardrobeLock}

[ACCESSORIES]:
- Accessories shown in ${accessoryIdxRange} may be used when present and worn naturally on the model.
- Accessory Detail (Auto-Analysis): ${analysis.accessory_description}
- Never let accessories change the required pose or crop.

[VISUAL ANALYSIS]:
- Product Detail: ${analysis.product_description}
- Model Traits (Auto-Analysis): ${analysis.model_identity}
${sceneLock}

[STRICT NEGATIVE RULES]:
- NO grid, NO collage, NO multi-panel layout.
- NO standing full body if the blueprint is half body.
- NO beauty close-up, NO face zoom, NO tilted camera, NO high angle, NO low angle.
- NO pose invention, NO hand changes, NO crop drift, NO landscape framing.
- The result must read as one clean e-commerce main image for angle ${angle.id}.

[OUTPUT]: Generate one standalone ${mainAspectRatio} portrait main image that follows the selected blueprint exactly.`;

          const mainNegativePrompt = [
            baseNegativePrompt,
            "grid collage",
            "multi-panel layout",
            "wrong camera angle",
            "wrong crop",
            "full body",
            "landscape framing",
            "beauty close-up",
            "changed hand pose",
            "pose drift",
          ].join(", ");

          const targetAspect = mainAspectRatio === '2:3' 
            ? AspectRatio.PORTRAIT_2_3 
            : mainAspectRatio === '3:4' 
              ? AspectRatio.PORTRAIT_3_4 
              : AspectRatio.PORTRAIT_4_5;

          const result = await generateImageToImage(angleApiImages, mainPrompt, {
            aspectRatio: targetAspect,
            resolution: resolution as any,
            modelId: modelType,
            negativePrompt: mainNegativePrompt,
            workflowHint: 'main-angle-lock',
          });

          setGeneratedMainAngles(prev => 
            prev.map(item => item.id === angle.id ? { ...angle, imageUrl: result[0] } : item)
          );

          // Save each main angle to recent projects
          try {
            await storageService.saveProject({
              id: crypto.randomUUID(),
              type: 'MODEL',
              createdAt: Date.now(),
              thumbnail: result[0],
              assets: {
                original: modelImages.length > 0 ? [modelImages[0]] : productImages,
                generated: result,
              },
              metadata: {
                subType: 'pose_fission_main_angle',
                angleId: angle.id,
                angleLabel: angle.label,
                resolution,
                modelId: modelType,
              },
            });
          } catch (e) {
            console.error("Failed to save project", e);
          }
        }));

        return;
      }

      setStatusMessage("分析完成！正在根据动态姿势规划进行最终生成...");

      const isHorizontal = aspectRatio === '16:9';
      const totalPoses = isHorizontal ? 8 : 12;

      let basePoses = analysis.poses_list;
      if (Array.isArray(basePoses)) {
        basePoses = basePoses.join('\n');
      }

      let finalPosesList = basePoses;
      let promptPrefix = "";
      let poseFramingLock = "";

      if (selectedPresetId !== 'ai' && selectedAngleIds.length > 0) {
        const preset = ANGLE_PRESETS.find(p => p.id === selectedPresetId);
        if (preset && preset.angles.length > 0) {
          promptPrefix = (preset.motherPrompt || "") + "\n";
          poseFramingLock =
            "[POSE & FRAMING LOCK]: MUST match the selected angle preset exactly (camera angle, crop/framing distance, stance, hand placement).\n";

          const selectedPrompts = preset.angles
            .filter(a => selectedAngleIds.includes(a.id))
            .map(a => a.prompt.replace(/\[产品：[^\]]*\]/g, analysis.product_description).replace(/\[产品\]/g, analysis.product_description));

          let combinedPoses = [...selectedPrompts];
          while (combinedPoses.length < totalPoses) {
            const rawPoses = analysis.poses_list;
            const aiPoses = Array.isArray(rawPoses)
              ? rawPoses
              : typeof rawPoses === 'string'
                ? rawPoses.split('\n')
                : [];

            const validAiPoses = aiPoses.filter((p: any) => typeof p === 'string' && p.trim() !== '');
            const nextAiPose = validAiPoses[combinedPoses.length % Math.max(1, validAiPoses.length)] || 'Natural fashion pose';
            combinedPoses.push(nextAiPose);
          }

          finalPosesList = combinedPoses.map((p, i) => `Pose ${i + 1}: ${p}`).join('\n');
        }
      }

      const gridRules = isHorizontal
        ? `[GRID CONFIG]: Strictly 4x2 matrix (4 columns, 2 rows). Total 8 UNIQUE images.
[PROPORTION LOCK]: CRITICAL! EVERY single cell in the grid MUST have EXACTLY the matching aspect ratio. Draw mathematically straight, perfectly even dividing lines. NO organic, asymmetrical or squashed cell sizes.
[SEAMLESS]: NO black lines, NO borders, NO gaps.
[REFERENCE USAGE]: Reference images are for guidance ONLY. Do NOT paste/copy any reference image into any grid cell. Every cell must be newly generated.
[PRODUCT PRIORITY]: The PRIMARY PRODUCT must match the provided product reference images 1:1 and MUST be visible in every cell.
[POSES]: Plan 8 dynamic fashion poses based on: ${finalPosesList}`
        : `[GRID CONFIG]: Strictly 3x4 matrix (3 columns, 4 rows). Total 12 UNIQUE images.
[PROPORTION LOCK]: CRITICAL! EVERY single cell in the grid MUST have EXACTLY the matching aspect ratio. Draw mathematically straight, perfectly even dividing lines. NO organic, asymmetrical or squashed cell sizes.
[SEAMLESS]: NO black lines, NO borders, NO gaps.
[REFERENCE USAGE]: Reference images are for guidance ONLY. Do NOT paste/copy any reference image into any grid cell. Every cell must be newly generated.
[PRODUCT PRIORITY]: The PRIMARY PRODUCT must match the provided product reference images 1:1 and MUST be visible in every cell.
[POSES]: Plan 12 dynamic fashion poses based on: ${finalPosesList}`;

      const prompt = `${promptPrefix}${poseFramingLock}${identityLock}
${outfitEffectLock}
[BODY DIMENSIONS]: Match the model's build, height, and proportions exactly as shown in the reference images.
- Build/Measurements (User Input): ${bodyInfo || "Use the reference images."}
- Detail Prompt (User Input): ${detailPrompt || "None"}

[PRIMARY PRODUCT (NON-NEGOTIABLE)]:
- The PRIMARY PRODUCT is shown in ${productIdxRange}. It MUST be applied in EVERY grid cell.
- 1:1 match of garment structure, seams, buttons, texture, print/pattern, and fit. NO substitutions.

[OUTFIT RULE]:
- If the model identity reference already wears the primary product, preserve it exactly.
- Otherwise, replace any original outfit using ONLY the primary product reference images in ${productIdxRange}.
${wardrobeLock}

[ACCESSORIES]:
- Optional: Accessories shown in ${accessoryIdxRange} should be used when possible, but the PRIMARY PRODUCT takes absolute priority.
- Accessory Detail (Auto-Analysis): ${analysis.accessory_description}.

[VISUAL ANALYSIS]:
- Product Detail: ${analysis.product_description}
- Accessories: ${analysis.accessory_description}
${gridRules}
[ANGLE SYNC]: EVERY grid cell MUST follow the angles (Front/Side/Back) identified in the dynamic poses above.
[COMPOSITION]:
- EVERY grid cell MUST show the MODEL wearing the PRIMARY PRODUCT.
- ABSOLUTELY NO standalone product shots (NO shoes/bags/accessories only).
- DO NOT ZOOM IN ON FACE. Focus on showing the WHOLE garment and fit.
- Full-body or 3/4 shots are preferred to showcase the product.
${sceneLock}
- Each model must fit perfectly within their mathematically divided grid cell, maintaining 100% accurate human body proportions (no stretching/squashing).
- **CRITICAL**: This rule applies to both 16:9 (horizontal) and 9:16 (vertical) layouts. Consistency is mandatory across all ${totalPoses} cells.
[OUTPUT]: Generate a single ${isHorizontal ? '3:2' : '9:16'} image containing the requested grid pattern.`;

      setGeneratedMainAngles([]);

      const result = await generateImageToImage(apiImages, prompt, {
        aspectRatio: isHorizontal ? "3:2" as any : "9:16" as any,
        resolution: resolution as any,
        modelId: modelType,
        negativePrompt: baseNegativePrompt,
      });
      
      if (result && result.length > 0) {
        setGeneratedGridImage(result[0]);

        // Save grid to recent projects
        try {
          await storageService.saveProject({
            id: crypto.randomUUID(),
            type: 'MODEL',
            createdAt: Date.now(),
            thumbnail: result[0],
            assets: {
              original: modelImages.length > 0 ? [modelImages[0]] : productImages,
              generated: result,
            },
            metadata: {
              subType: 'pose_fission_grid',
              aspectRatio,
              resolution,
              modelId: modelType,
            },
          });
        } catch (e) {
          console.error("Failed to save project", e);
        }
      } else {
        throw new Error("模型未返回任何图片，请稍后重试");
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePreset = () => {
    if (!generatedGridImage || !analysisResult || !analysisResult.poses_list) return;
    
    // 生成封面缩略图并保存预设
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // 降低分辨率作为封面 (1500px 足以支撑还原为网格全图并在网格中进行截取重绘，平衡了 localStorage 的压力)
      const maxWidth = 1500;
      canvas.width = maxWidth;
      canvas.height = img.height * (maxWidth / img.width);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const cover = canvas.toDataURL("image/jpeg", 0.75);
      
      const rawPoses = analysisResult.poses_list;
      const poses = Array.isArray(rawPoses) 
        ? rawPoses 
        : (typeof rawPoses === 'string' ? rawPoses.split('\n') : []);
      
      const validPoses = poses.filter((p: any) => typeof p === 'string' && p.trim() !== '');
      
      try {
        savePoseSet({
          id: Date.now().toString(),
          name: `${new Date().toLocaleDateString()} ${aspectRatio} 自动预设大图`,
          aspectRatio,
          coverImage: cover,
          poses: validPoses,
          createdAt: Date.now()
        });
        alert("🎁 这张整版生成的原图已存入您的历史动作库，以后随时可以打开它进行单独裁切生图！");
      } catch (err) {
        alert("保存失败：可能是由于浏览器存储空间不足导致。请先在动作库中删除一些旧的预设。");
      }
    };
    img.src = generatedGridImage;
  };

  const handleLoadPreset = (preset: any) => {
    setIsLibraryOpen(false);
    setSelectedPresetId('ai');
    setSelectedAngleIds([]);
    setGeneratedGridImage(preset.coverImage);
    setGeneratedMainAngles([]);
    setAspectRatio(preset.aspectRatio as '9:16' | '16:9');
    setAnalysisResult({ ...analysisResult, poses_list: preset.poses.join('\n') });
    setStatusMessage("✅ 已成功载入历史生成大图！现在您可以把鼠标悬停在图内任何一个小人偶上，点击右上角的“魔法棒”进入单图重绘啦！");
    // setTimeout to clear status
    setTimeout(() => setStatusMessage(""), 5000);
  };


  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* Left Panel - Inputs */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>模特三视图（支持全身/半身图）</span>
              <span className="text-[10px] font-normal text-pastel-muted">最多3张 ({modelImages.length}/3)</span>
            </h3>
            <p className="text-[10px] leading-5 text-pastel-muted">
              这些图只用于锁定模特身份、体型和比例，不会保留图里的原衣服。最终穿搭只允许来自主产品图和你上传的配饰图。
            </p>
            <div 
              className={`flex gap-2 flex-wrap min-h-[5rem] p-2 -m-2 rounded-xl border-2 transition-all ${isDragOverModel ? 'border-dashed border-pastel-highlight bg-pastel-highlight/5' : 'border-transparent'}`}
              onDragOver={(e) => handleDragOverArea(e, 'model')}
              onDragLeave={() => handleDragLeaveArea('model')}
              onDrop={(e) => handleDropArea(e, 'model', setModelImages, 3, modelImages)}
            >
              {modelImages.map((img, idx) => (
                <div 
                  key={idx} 
                  draggable
                  onDragStart={(e) => handleDragStartItem(e, 'model', idx)}
                  onDragEnter={(e) => handleDragEnterItem(e, 'model', idx)}
                  onDragEnd={handleDragEndItem}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-pastel-border shadow-sm group cursor-move hover:ring-2 hover:ring-pastel-highlight/50 transition-all"
                >
                  <img src={img} alt="preview" className="w-full h-full object-cover pointer-events-none" />
                  <button
                    onClick={() => removeImage(idx, setModelImages)}
                    className="absolute z-10 top-1 right-1 bg-black/50 p-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {modelImages.length < 3 && (
                <label className="relative w-20 h-20 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group">
                  <input type="file" multiple className="hidden" onChange={(e) => { if(e.target.files) processFiles(Array.from(e.target.files), setModelImages, 3, modelImages); e.target.value = ''; }} accept="image/*" />
                  <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                  <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">拖拽或点击</span>
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>主打产品视图（核心重点）</span>
              <span className="text-[10px] font-normal text-pastel-muted">最多6张 ({productImages.length}/6)</span>
            </h3>
            <div 
              className={`flex gap-2 flex-wrap min-h-[5rem] p-2 -m-2 rounded-xl border-2 transition-all ${isDragOverProduct ? 'border-dashed border-pastel-highlight bg-pastel-highlight/5' : 'border-transparent'}`}
              onDragOver={(e) => handleDragOverArea(e, 'product')}
              onDragLeave={() => handleDragLeaveArea('product')}
              onDrop={(e) => handleDropArea(e, 'product', setProductImages, 6, productImages)}
            >
              {productImages.map((img, idx) => (
                <div 
                  key={idx} 
                  draggable
                  onDragStart={(e) => handleDragStartItem(e, 'product', idx)}
                  onDragEnter={(e) => handleDragEnterItem(e, 'product', idx)}
                  onDragEnd={handleDragEndItem}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-pastel-border shadow-sm group cursor-move hover:ring-2 hover:ring-pastel-highlight/50 transition-all"
                >
                  <img src={img} alt="preview" className="w-full h-full object-cover pointer-events-none" />
                  <button
                    onClick={() => removeImage(idx, setProductImages)}
                    className="absolute z-10 top-1 right-1 bg-black/50 p-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {productImages.length < 6 && (
                <label className="relative w-20 h-20 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group">
                  <input type="file" multiple className="hidden" onChange={(e) => { if(e.target.files) processFiles(Array.from(e.target.files), setProductImages, 6, productImages); e.target.value = ''; }} accept="image/*" />
                  <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                  <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">拖拽或点击</span>
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>模特服装效果</span>
              <span className="text-[10px] font-normal text-pastel-muted">最多3张 ({modelOutfitImages.length}/3)</span>
            </h3>
            <p className="text-[10px] leading-5 text-pastel-muted">
              这里上传模特实际上身后的效果参考图，用来告诉模型你想要的穿戴状态、层次、松紧、露肤范围和整体呈现效果。
            </p>
            <div
              className={`flex gap-2 flex-wrap min-h-[5rem] p-2 -m-2 rounded-xl border-2 transition-all ${isDragOverOutfit ? 'border-dashed border-pastel-highlight bg-pastel-highlight/5' : 'border-transparent'}`}
              onDragOver={(e) => handleDragOverArea(e, 'outfit')}
              onDragLeave={() => handleDragLeaveArea('outfit')}
              onDrop={(e) => handleDropArea(e, 'outfit', setModelOutfitImages, 3, modelOutfitImages)}
            >
              {modelOutfitImages.map((img, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStartItem(e, 'outfit', idx)}
                  onDragEnter={(e) => handleDragEnterItem(e, 'outfit', idx)}
                  onDragEnd={handleDragEndItem}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-pastel-border shadow-sm group cursor-move hover:ring-2 hover:ring-pastel-highlight/50 transition-all"
                >
                  <img src={img} alt="preview" className="w-full h-full object-cover pointer-events-none" />
                  <button
                    onClick={() => removeImage(idx, setModelOutfitImages)}
                    className="absolute z-10 top-1 right-1 bg-black/50 p-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {modelOutfitImages.length < 3 && (
                <label className="relative w-20 h-20 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group">
                  <input type="file" multiple className="hidden" onChange={(e) => { if(e.target.files) processFiles(Array.from(e.target.files), setModelOutfitImages, 3, modelOutfitImages); e.target.value = ''; }} accept="image/*" />
                  <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                  <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">拖拽或点击</span>
                </label>
              )}
            </div>
          </div>

          {/* 配饰搭配 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>附加配饰图（支持耳饰、项链、戒指、包配等）</span>
              <span className="text-[10px] font-normal text-pastel-muted">最多10张 ({accessoryImages.length}/10)</span>
            </h3>
            <div 
              className={`flex gap-2 flex-wrap min-h-[5rem] p-2 -m-2 rounded-xl border-2 transition-all ${isDragOverAccessory ? 'border-dashed border-pastel-highlight bg-pastel-highlight/5' : 'border-transparent'}`}
              onDragOver={(e) => handleDragOverArea(e, 'accessory')}
              onDragLeave={() => handleDragLeaveArea('accessory')}
              onDrop={(e) => handleDropArea(e, 'accessory', setAccessoryImages, 10, accessoryImages)}
            >
              {accessoryImages.map((img, idx) => (
                <div 
                  key={idx} 
                  draggable
                  onDragStart={(e) => handleDragStartItem(e, 'accessory', idx)}
                  onDragEnter={(e) => handleDragEnterItem(e, 'accessory', idx)}
                  onDragEnd={handleDragEndItem}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-pastel-border shadow-sm group cursor-move hover:ring-2 hover:ring-pastel-highlight/50 transition-all"
                >
                  <img src={img} alt="preview" className="w-full h-full object-cover pointer-events-none" />
                  <button
                    onClick={() => removeImage(idx, setAccessoryImages)}
                    className="absolute z-10 top-1 right-1 bg-black/50 p-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {accessoryImages.length < 10 && (
                <label className="relative w-20 h-20 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group">
                  <input type="file" multiple className="hidden" onChange={(e) => { if(e.target.files) processFiles(Array.from(e.target.files), setAccessoryImages, 10, accessoryImages); e.target.value = ''; }} accept="image/*" />
                  <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                  <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">拖拽或点击</span>
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>场景参考图（可选）</span>
              <span className="text-[10px] font-normal text-pastel-muted">最多3张 ({sceneImages.length}/3)</span>
            </h3>
            <div 
              className={`flex gap-2 flex-wrap min-h-[5rem] p-2 -m-2 rounded-xl border-2 transition-all ${isDragOverScene ? 'border-dashed border-pastel-highlight bg-pastel-highlight/5' : 'border-transparent'}`}
              onDragOver={(e) => handleDragOverArea(e, 'scene')}
              onDragLeave={() => handleDragLeaveArea('scene')}
              onDrop={(e) => handleDropArea(e, 'scene', setSceneImages, 3, sceneImages)}
            >
              {sceneImages.map((img, idx) => (
                <div 
                  key={idx} 
                  draggable
                  onDragStart={(e) => handleDragStartItem(e, 'scene', idx)}
                  onDragEnter={(e) => handleDragEnterItem(e, 'scene', idx)}
                  onDragEnd={handleDragEndItem}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-pastel-border shadow-sm group cursor-move hover:ring-2 hover:ring-pastel-highlight/50 transition-all"
                >
                  <img src={img} alt="preview" className="w-full h-full object-cover pointer-events-none" />
                  <button
                    onClick={() => removeImage(idx, setSceneImages)}
                    className="absolute z-10 top-1 right-1 bg-black/50 p-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {sceneImages.length < 3 && (
                <label className="relative w-20 h-20 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group">
                  <input type="file" multiple className="hidden" onChange={(e) => { if(e.target.files) processFiles(Array.from(e.target.files), setSceneImages, 3, sceneImages); e.target.value = ''; }} accept="image/*" />
                  <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                  <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">拖拽或点击</span>
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">场景描述提示词（可选）</h3>
            <input 
              type="text" 
              placeholder="例如：阳光明媚的海滩、现代简约咖啡厅、复古街道..." 
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
              className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 transition-all"
            />
          </div>


          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">模特三维信息</h3>
            <input 
              type="text" 
              placeholder="例如：身高175cm、大码、娇小..." 
              value={bodyInfo}
              onChange={(e) => setBodyInfo(e.target.value)}
              className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 transition-all"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">具体特征/发型描述</h3>
            <textarea
              rows={3}
              placeholder="例如：亚裔、卷发、阳光气质、皮肤白皙..."
              value={specificFeatures}
              onChange={(e) => setSpecificFeatures(e.target.value)}
              className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">细节补充提示词</h3>
            <textarea
              rows={4}
              placeholder="例如：衣摆自然贴合腰部，胸口不要空鼓，袖口不要卷边，裤腰完整露出，包包自然垂落在左肩..."
              value={detailPrompt}
              onChange={(e) => setDetailPrompt(e.target.value)}
              className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
            />
          </div>

          <div className="space-y-3 bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pastel-highlight flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> 角度模板
              </h3>
            </div>

            <div className="flex gap-2">
              {ANGLE_PRESETS.map(preset => {
                const active = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`flex-1 py-2 text-[11px] font-bold rounded-xl border transition-all ${
                      active
                        ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-pastel-highlight/40'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {selectedPresetId !== 'ai' && (
              <>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-[10px] font-bold text-pastel-muted">
                    已选 {selectedAngleIds.length}/{presetAngles.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedAngleIds(presetAngles.map(a => a.id))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:border-pastel-highlight/40"
                    >
                      全选
                    </button>
                    <button
                      onClick={() => setSelectedAngleIds([])}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:border-pastel-highlight/40"
                    >
                      全不选
                    </button>
                  </div>
                </div>

                <div className={`grid gap-2 mt-3 ${isMainPreset ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {presetAngles.map(angle => {
                    const active = selectedAngleIds.includes(angle.id);
                    const angleMeta = getAngleMeta(angle.thumb);
                    return (
                      <button
                        key={angle.id}
                        onClick={() => toggleAngleId(angle.id)}
                        title={angle.label}
                        className={`w-full rounded-2xl border p-3 transition-all text-left ${
                          active
                            ? 'border-orange-400 bg-orange-50/70 shadow-sm'
                            : 'border-gray-200 bg-gray-50 hover:border-orange-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {angle.thumb ? (
                            <AngleThumb spec={angle.thumb} active={active} />
                          ) : (
                            <div className="w-10 h-14 rounded-md border border-slate-200 bg-white" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-[0.18em] ${active ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                                    {angle.id}
                                  </span>
                                  <div className={`text-[11px] font-black ${active ? 'text-orange-700' : 'text-gray-700'}`}>
                                    {angle.label}
                                  </div>
                                </div>
                                {angleMeta.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {angleMeta.map(meta => (
                                      <span key={`${angle.id}-${meta}`} className="rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-gray-500 ring-1 ring-gray-200">
                                        {meta}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div
                                className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center text-[10px] font-black ${
                                  active
                                    ? 'bg-orange-500 border-orange-500 text-white'
                                    : 'bg-white border-gray-300 text-gray-300'
                                }`}
                              >
                                ✓
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-2 line-clamp-3">
                              {angle.prompt}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10px] text-pastel-muted italic mt-2">
                  {isMainPreset
                    ? '主图角度模式会固定按 4:5 单张输出，只生成你勾选的角度，不再自动补齐其它姿势。'
                    : '模板模式会优先覆盖姿势规划；不足网格数量时会用 AI 自动姿势补齐。'}
                </p>
              </>
            )}

            {selectedPresetId === 'ai' && (
              <p className="text-[10px] text-pastel-muted italic mt-2">当前使用 AI 全自动姿势裂变。</p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">生成画幅比例</h3>
            {isMainPreset ? (
               <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-orange-700">主图生成画幅</span>
                  <select 
                    value={mainAspectRatio}
                    onChange={(e) => setMainAspectRatio(e.target.value as any)}
                    className="bg-white border text-orange-700 border-orange-300 rounded-lg px-2 py-1 outline-none font-bold text-xs focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="2:3">2:3 (标准竖版 - 推荐)</option>
                    <option value="3:4">3:4 (较宽竖版)</option>
                    <option value="4:5">4:5 (原固定画幅)</option>
                  </select>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-orange-600/80 italic">
                  主图模式不采用平头宫格缝合，而是为您单独生成多张独立图片。
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${aspectRatio === '9:16' ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/50 hover:bg-white'}`}
                >
                  <div className="w-3 h-4 border-2 border-current rounded-[2px]"></div>
                  9:16 (竖版 3x4)
                </button>
                <button 
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${aspectRatio === '16:9' ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/50 hover:bg-white'}`}
                >
                  <div className="w-5 h-3 border-2 border-current rounded-[2px]"></div>
                  16:9 (横版 4x2)
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-pastel-muted mb-2 bg-white p-3 border border-pastel-border rounded-xl shadow-sm">
                <span className="block mb-2">图像模型</span>
                <select 
                  value={modelType} 
                  onChange={(e) => setModelType(e.target.value)}
                  className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2 px-2 text-xs font-bold focus:ring-2 focus:ring-pastel-highlight/20 outline-none"
                >
                  <option value="gemini-3.1-flash-image-preview">nanobanana2 (Flash)</option>
                  <option value="gemini-3-pro-image-preview">nanobananapro (Pro)</option>
                </select>
              </h3>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-pastel-muted mb-2 bg-white p-3 border border-pastel-border rounded-xl shadow-sm">
                <span className="block mb-2">生成画质</span>
                <select 
                  value={resolution} 
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2 px-2 text-xs font-bold focus:ring-2 focus:ring-pastel-highlight/20 outline-none"
                >
                  <option value="2K">2K (默认)</option>
                  <option value="4K">4K (超清)</option>
                </select>
              </h3>
            </div>
          </div>

        </div>

        <div className="p-5 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col gap-3">
          <div className="flex gap-2">
             <button
                onClick={() => setIsLibraryOpen(true)}
                className="w-1/3 py-3.5 bg-white text-pink-500 border border-pink-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-pink-50 hover:border-pink-300 transition-all active:scale-[0.98] shadow-sm"
             >
                <FolderHeart className="w-5 h-5" /> 动作库
             </button>
             <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all active:scale-[0.98] hover:shadow-orange-500/40 hover:brightness-105"
             >
                 {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {isMainPreset ? '并行生成主图中...' : '生成排版中...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    {isMainPreset ? `生成主图角度 (${selectedAngleIds.length} 张并跑)` : `生成裂变矩阵 (${aspectRatio})`}
                  </>
                )}
             </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Grid View */}
      <div className="flex-1 flex p-6 overflow-hidden relative items-center justify-center bg-transparent">
        {isMainPreset ? (
           <MainAngleGallery
            items={displayedMainAngles}
            isGenerating={isGenerating}
            statusMessage={statusMessage}
            aspectRatio={mainAspectRatio}
          />
        ) : isGenerating ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-6 p-12 bg-white/50 backdrop-blur-md rounded-3xl border border-white shadow-xl">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-pastel-highlight animate-spin" />
                <Zap className="w-6 h-6 text-yellow-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-xl font-bold text-pastel-highlight tracking-tight">矩阵裂变中...</h3>
                <p className="text-pastel-text/80 text-sm font-medium animate-pulse transition-all duration-500 max-w-[280px]">
                  {statusMessage || "正在分析细节并规划不重复姿势..."}
                </p>
              </div>
            </div>
          </div>
        ) : !generatedGridImage ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted h-full w-full">
            <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-4 transition-all hover:scale-105 hover:border-pastel-highlight hover:shadow-lg hover:shadow-pastel-highlight/20">
               <Zap className="w-10 h-10 text-pastel-border" />
            </div>
            <p className="text-sm font-medium tracking-wide">填入侧边栏信息并点击“生成裂变矩阵”<br/><span className="text-xs opacity-70">或打开动作库生成单图</span></p>
          </div>

        ) : (
          <PoseGrid 
            imageUrl={generatedGridImage} 
            aspectRatio={aspectRatio} 
            analysisContext={analysisResult}
            bodyInfo={bodyInfo}
            specificFeatures={specificFeatures}
            onSavePreset={handleSavePreset}
          />
        )}
      </div>
      
      {/* 动作库模态框 */}
      <PoseLibraryModal 
         isOpen={isLibraryOpen} 
         onClose={() => setIsLibraryOpen(false)} 
         onLoadPreset={handleLoadPreset} 
      />
    </div>
  );
};

export default PoseFissionTab;
