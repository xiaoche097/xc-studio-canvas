import React, { useState } from 'react';
import { Upload, X, Zap, Loader2, Bookmark, FolderHeart, Maximize2, Download } from 'lucide-react';
import { generateImageToImage, analyzeFissionContext } from '../Cyzx4/services/geminiService';
import { getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import PoseGrid from './PoseGrid';
import PoseLibraryModal, { savePoseSet } from './components/PoseLibraryModal';

// 亚马逊固定角度定义
const AMAZON_ANGLES = [
  { id: 'A', label: '正面近景 + 肩背包带', prompt: "front view, straight-on, torso cropped from just below the mouth to upper thighs, shoulders level, slight S-curve posture, both arms placed behind the back, wearing a delicate silver necklace, black leather shoulder bag on the model’s left shoulder with visible strap and buckle" },
  { id: 'B', label: '背面正对', prompt: "back view, straight-on, torso cropped from just below the mouth to mid-thigh, shoulders square to camera, arms relaxed down along the sides, hands near outer thighs" },
  { id: 'C', label: '正面全正 + 双手自然下垂', prompt: "front view, straight-on, torso cropped from just below the mouth to mid-thigh, shoulders square, arms relaxed down, both hands resting near outer thighs" },
  { id: 'D', label: '正面微转 + 一手搭腰', prompt: "front view with slight turn 10–15 degrees to camera-left, torso cropped from just below the mouth to mid-thigh, right hand placed on the waistband/hip with elbow bent, left arm relaxed down" },
  { id: 'E', label: '正面近景 (主图感)', prompt: "front view, straight-on, slightly closer crop (from collarbones to upper thighs), arms relaxed down, subtle natural posture" },
  { id: 'F', label: '侧前 3/4', prompt: "three-quarter view, body rotated 35–45 degrees to camera-right, head/face cropped out, torso cropped from just below the mouth to mid-thigh, arms relaxed down, posture upright" },
  { id: 'G', label: '拉拽下摆展示弹力', prompt: "three-quarter view, body rotated 20–30 degrees to camera-right, torso cropped from just below the mouth to mid-thigh, both hands pulling the bottom hem of the tube top downward and slightly outward to show stretch, skirt remains in place" },
];

const AMAZON_MOTHER_PROMPT = "Studio e-commerce fashion photo on pure white seamless background, adult female model, eye-level camera, straight horizon, 85mm lens look, medium shot, centered composition, soft even studio lighting, minimal shadows, sharp focus, high resolution, Amazon catalog style, model’s face cropped out (frame cuts at the mouth/chin), same pose and camera angle as specified.";

const PoseFissionTab: React.FC = () => {
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [accessoryImages, setAccessoryImages] = useState<string[]>([]);
  
  const [bodyInfo, setBodyInfo] = useState('');
  const [specificFeatures, setSpecificFeatures] = useState('');
  const [modelType, setModelType] = useState('gemini-3.1-flash-image-preview');
  const [resolution, setResolution] = useState('2K');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedGridImage, setGeneratedGridImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isAmazonEnabled, setIsAmazonEnabled] = useState(false);
  const [selectedAmazonAngles, setSelectedAmazonAngles] = useState<string[]>(AMAZON_ANGLES.map(a => a.id));

  // --- Drag and Drop States ---
  const [draggedIdx, setDraggedIdx] = useState<{type: 'model'|'product'|'accessory', idx: number} | null>(null);
  const [isDragOverModel, setIsDragOverModel] = useState(false);
  const [isDragOverProduct, setIsDragOverProduct] = useState(false);
  const [isDragOverAccessory, setIsDragOverAccessory] = useState(false);

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
  const handleDragOverArea = (e: React.DragEvent, type: 'model' | 'product' | 'accessory') => {
    e.preventDefault();
    if (type === 'model') setIsDragOverModel(true);
    if (type === 'product') setIsDragOverProduct(true);
    if (type === 'accessory') setIsDragOverAccessory(true);
  };
  const handleDragLeaveArea = (type: 'model' | 'product' | 'accessory') => {
    if (type === 'model') setIsDragOverModel(false);
    if (type === 'product') setIsDragOverProduct(false);
    if (type === 'accessory') setIsDragOverAccessory(false);
  };
  const handleDropArea = (e: React.DragEvent, type: 'model' | 'product' | 'accessory', setter: React.Dispatch<React.SetStateAction<string[]>>, maxLimit: number, currentList: string[]) => {
    e.preventDefault();
    handleDragLeaveArea(type);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files), setter, maxLimit, currentList);
    }
  };

  // --- Reorder Sorting Handlers ---
  const handleDragStartItem = (e: React.DragEvent, type: 'model'|'product'|'accessory', idx: number) => {
    setDraggedIdx({ type, idx });
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { (e.target as HTMLElement).classList.add('opacity-30'); }, 0);
  };

  const handleDragEnterItem = (e: React.DragEvent, type: 'model'|'product'|'accessory', targetIdx: number) => {
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
    setIsGenerating(true);
    setStatusMessage("正在由 AI 视觉大脑分析产品细节与规划姿势...");
    
    try {
      const apiImages = [...modelImages, ...productImages, ...accessoryImages].map(imgUrl => {
         const match = imgUrl.match(/^data:(image\/[a-zA-Z]*);base64,(.*)$/);
         if (match) {
           return { mimeType: match[1], base64: match[2] };
         }
         return { mimeType: 'image/jpeg', base64: imgUrl.split(',')[1] || imgUrl };
      });

      // 第二步：智能视觉分析
      const analysis = await analyzeFissionContext(apiImages, aspectRatio);
      
      setStatusMessage("分析完成！正在根据动态姿势规划进行最终生成...");

      const isHorizontal = aspectRatio === '16:9';
      const totalPoses = isHorizontal ? 8 : 12;

      // Ensure poses_list is always a string for gridRules
      let basePoses = analysis.poses_list;
      if (Array.isArray(basePoses)) {
        basePoses = basePoses.join('\n');
      }

      // --- 亚马逊固定角度逻辑处理 ---
      let finalPosesList = basePoses;
      let promptPrefix = "";
      
      if (isAmazonEnabled && selectedAmazonAngles.length > 0) {
        promptPrefix = AMAZON_MOTHER_PROMPT + "\n";
        // 构造亚马逊姿势列表
        const selectedPrompts = AMAZON_ANGLES
          .filter(a => selectedAmazonAngles.includes(a.id))
          .map(a => a.prompt.replace(/\[产品：[^\]]*\]/g, analysis.product_description).replace(/\[产品\]/g, analysis.product_description));
        
        // 如果选定的角度不足以填满网格，则循环填充或补充 AI 姿势
        let combinedPoses = [...selectedPrompts];
        while (combinedPoses.length < totalPoses) {
          // 优先从 AI 生成的姿势列表中补充不重复的内容
          const rawPoses = analysis.poses_list;
          const aiPoses = Array.isArray(rawPoses) 
            ? rawPoses 
            : (typeof rawPoses === 'string' ? rawPoses.split('\n') : []);
          
          const validAiPoses = aiPoses.filter((p: any) => typeof p === 'string' && p.trim() !== '');
          const nextAiPose = validAiPoses[combinedPoses.length % Math.max(1, validAiPoses.length)] || "Natural fashion pose";
          combinedPoses.push(nextAiPose);
        }
        
        finalPosesList = combinedPoses.map((p, i) => `Pose ${i + 1}: ${p}`).join('\n');
      }

      const gridRules = isHorizontal
        ? `[GRID CONFIG]: Strictly 4x2 matrix (4 columns, 2 rows). Total 8 UNIQUE images.
[PROPORTION LOCK]: CRITICAL! EVERY single cell in the grid MUST have EXACTLY the matching aspect ratio. Draw mathematically straight, perfectly even dividing lines. NO organic, asymmetrical or squashed cell sizes.
[SEAMLESS]: NO black lines, NO borders, NO gaps. 
[SHOT ASSIGNMENT]: Result(0,0)=Ref Image 1, Result(0,1)=Ref Image 2. All 8 cells MUST show the MODEL wearing the product. NO standalone accessory shots (even if a Ref Image is just an accessory).
[POSES]: Plan 8 dynamic fashion poses based on: ${finalPosesList}`
        : `[GRID CONFIG]: Strictly 3x4 matrix (3 columns, 4 rows). Total 12 UNIQUE images.
[PROPORTION LOCK]: CRITICAL! EVERY single cell in the grid MUST have EXACTLY the matching aspect ratio. Draw mathematically straight, perfectly even dividing lines. NO organic, asymmetrical or squashed cell sizes.
[SEAMLESS]: NO black lines, NO borders, NO gaps.
[SHOT ASSIGNMENT]: Result(0,0)=Ref Image 1, Result(0,1)=Ref Image 2. All 12 cells MUST show the MODEL wearing the product. NO standalone accessory shots (even if a Ref Image is just an accessory).
[POSES]: Plan 12 dynamic fashion poses based on: ${finalPosesList}`;

      // --- 动态图像索引计算 (用于精确引导 AI) ---
      const modelCount = modelImages.length;
      const productCount = productImages.length;
      const accessoryCount = accessoryImages.length;
      
      const productIdxRange = productCount > 0 
        ? `Image ${modelCount + 1}${productCount > 1 ? ` to Image ${modelCount + productCount}` : ""}`
        : "None";
      
      const accessoryIdxRange = accessoryCount > 0
        ? `Image ${modelCount + productCount + 1}${accessoryCount > 1 ? ` to Image ${modelCount + productCount + accessoryCount}` : ""}`
        : "None";

      const prompt = `${promptPrefix}[IDENTITY LOCK]: CRITICAL: The model MUST be the EXACT SAME person as shown in the model reference images (Image 1 to Image ${modelCount}). Zero identity drift. 
- Model Traits (Auto-Analysis): ${analysis.model_identity}
- Model Traits (User Input): ${specificFeatures}
[BODY DIMENSIONS]: Match the model's build, height, and proportions exactly as shown in the model reference.
- Build/Measurements (User Input): ${bodyInfo}
[OUTFIT REPLACEMENT - MANDATORY]:
- **STRIP AND IGNORE**: CRITICAL: Completely STRIP and IGNORE the original clothing/garment pixels worn by the model in Image 1 to Image ${modelCount}. 
- **BASE BODY ONLY**: Treat the model in reference images as a blank 'base body' or nude mannequin. 
- **REPLACE FROM SCRATCH**: Dress the model from scratch using ONLY the items in ${productIdxRange} AND ${accessoryIdxRange}.
[PRODUCT CLONE - STRUCTURAL IDENTITY]:
- **MATCH PRODUCT 1:1**: The model MUST wear the EXACT SAME product shown in ${productIdxRange}.
- **STRUCTURAL CONSISTENCY**: 1:1 exact replication of garment structure, seams, buttons, texture, and fit. NO alterations, NO deformations.
[ENSEMBLE PIECES & ACCESSORIES - MANDATORY]:
- **COMPLETE LOOK**: EVERY SINGLE GRID CELL MUST show the model wearing the **COMPLETE LOOK** of ALL items provided.
- **MANDATORY LOWER GARMENT**: If a lower garment (e.g., JEANS, SKIRT, PANTS) is present in ${accessoryIdxRange}, the model MUST wear it. DO NOT generate alternative or matching-color leggings.
- **MATERIAL INDEPENDENCE**: Maintain the specific material of each piece. If ${accessoryIdxRange} shows BLUE DENIM JEANS, they MUST be rendered as BLUE DENIM, not pink leggings matching the top.
- **ACCESSORY SYNC**: All other items in ${accessoryIdxRange} (bags, shoes, jewelry) MUST be worn/carried in every cell.
- Accessory Detail: ${analysis.accessory_description}.
[VISUAL ANALYSIS]:
- Product Detail: ${analysis.product_description}
- Accessories: ${analysis.accessory_description}
${gridRules}
[ANGLE SYNC]: EVERY grid cell MUST follow the angles (Front/Side/Back) identified in the dynamic poses above. 
[COMPOSITION]: 
- EVERY grid cell MUST show the MODEL wearing the product. 
- ABSOLUTELY NO standalone product shots (NO shoes/bags/accessories only).
- TREAT ACCESSORIES AS WEARABLES. Even if a reference image shows just shoes/bags, ALWAYS show them ON THE MODEL in the final grid.
- DO NOT ZOOM IN ON FACE. Focus on showing the WHOLE garment and fit.
- Full-body or 3/4 shots are preferred to showcase the product.
- Background: PURE WHITE (#FFFFFF). NO shadows.
- Each model must fit perfectly within their mathematically divided grid cell, maintaining 100% accurate human body proportions (no stretching/squashing).
- **CRITICAL**: This rule applies to both 16:9 (horizontal) and 9:16 (vertical) layouts. Consistency is mandatory across all ${totalPoses} cells.
[OUTPUT]: Generate a single ${isHorizontal ? '3:2' : '9:16'} image containing the requested grid pattern.`;

      const result = await generateImageToImage(apiImages, prompt, {
        aspectRatio: isHorizontal ? "3:2" as any : "9:16" as any,
        resolution: resolution as any,
        modelId: modelType
      });
      
      if (result && result.length > 0) {
        setGeneratedGridImage(result[0]);
        setAnalysisResult(analysis);
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
    setGeneratedGridImage(preset.coverImage);
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

          <div className="space-y-3 bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pastel-highlight flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> 亚马逊固定角度
              </h3>
              <button 
                onClick={() => setIsAmazonEnabled(!isAmazonEnabled)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${isAmazonEnabled ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}
              >
                {isAmazonEnabled ? '已启用' : '已关闭'}
              </button>
            </div>
            
            {isAmazonEnabled && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {AMAZON_ANGLES.map(angle => (
                  <button
                    key={angle.id}
                    onClick={() => {
                      setSelectedAmazonAngles(prev => 
                        prev.includes(angle.id) ? prev.filter(id => id !== angle.id) : [...prev, angle.id]
                      );
                    }}
                    title={angle.label}
                    className={`h-8 text-xs font-bold rounded-lg border transition-all ${
                      selectedAmazonAngles.includes(angle.id) 
                        ? 'border-orange-400 bg-orange-50 text-orange-600' 
                        : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-200'
                    }`}
                  >
                    {angle.id}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-pastel-muted italic mt-1">
              {isAmazonEnabled ? '已锁定 7 个专业电商角度，将覆盖自动分析的姿势。' : '当前使用 AI 全自动姿势裂变。'}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">生成画幅比例</h3>
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
                    生成排版中...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    生成裂变矩阵 ({aspectRatio})
                  </>
                )}
             </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Grid View */}
      <div className="flex-1 flex p-6 overflow-hidden relative items-center justify-center bg-transparent">
        {isGenerating ? (
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
