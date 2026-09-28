import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, Upload, X, Camera, Zap, CheckCircle2, Image as ImageIcon, Sparkles, AlertCircle } from 'lucide-react';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { saveGeneratedProject } from '../../services/projectHistoryService';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  base64?: string;
  mimeType?: string;
}

const STRUCTURE_LOCK = `[STRICT PRODUCT IDENTITY LOCK]:
The first set of images are the PRODUCT REFERENCES (Identity & Appearance). 
You MUST preserve the physical appearance, color, textures, eyes, mouth, and specific design details 100%. 
However, you MUST ignore the orientation/angle of these references and strictly apply the angle from the target reference below.
`;

const ANGLE_INSTRUCTION = `[MANDATORY ANGLE & VIEWPOINT MAPPING]:
The last image is the ANGLE/POSTURE REFERENCE (Spatial Orientation).
Analyze the 3D orientation, tilt, rotation, and camera viewpoint of the subject in this reference.
CRITICAL: Map the product's identity onto this EXACT 3D orientation. The result must have the same silhouette and perspective as this reference.
`;

const ECOMMERCE_STYLE = `pure white seamless background, soft even studio lighting, minimal soft shadow directly under the toy, accurate color, sharp focus, high resolution, clean e-commerce product photography.`;

const DollAngleReferenceTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const [productImages, setProductImages] = useState<ImageItem[]>([]);
  const [angleImages, setAngleImages] = useState<ImageItem[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);
  const [detailDescription, setDetailDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // To handle global paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isActive || e.defaultPrevented) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      
      if (files.length > 0) {
        e.preventDefault();
        // Decide where to put pasted files based on which list is not full, prioritizing product images
        if (productImages.length < 5) {
          handleProductFiles(files);
        } else if (angleImages.length < 10) {
          handleAngleFiles(files);
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isActive, productImages.length, angleImages.length]);

  const createItems = async (files: File[]): Promise<ImageItem[]> => {
    const items: ImageItem[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      // Pre-compress to save time during generation
      const compressed = await compressImage(f, 2048, 0.95);
      items.push({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        url: URL.createObjectURL(f),
        base64: compressed.base64,
        mimeType: compressed.mime
      });
    }
    return items;
  };

  const handleProductFiles = useCallback(async (files: File[]) => {
    const remainingCount = 5 - productImages.length;
    const filesToAdd = files.slice(0, remainingCount);
    if (filesToAdd.length > 0) {
      const newItems = await createItems(filesToAdd);
      setProductImages(prev => [...prev, ...newItems]);
    }
  }, [productImages.length]);

  const handleAngleFiles = useCallback(async (files: File[]) => {
    const remainingCount = 10 - angleImages.length;
    const filesToAdd = files.slice(0, remainingCount);
    if (filesToAdd.length > 0) {
      const newItems = await createItems(filesToAdd);
      setAngleImages(prev => [...prev, ...newItems]);
    }
  }, [angleImages.length]);

  const handleGenerate = async () => {
    if (productImages.length === 0) {
      alert('请至少上传一张产品主图');
      return;
    }
    if (angleImages.length === 0) {
      alert('请至少上传一张角度参考图');
      return;
    }

    setIsGenerating(true);
    setResultImages([]);
    setStatusMessage('准备数据并分发并发请求...');

    try {
      const productRefs = productImages.map(img => ({ base64: img.base64!, mimeType: img.mimeType! }));
      
      // Each generation task will correspond to EXACTLY ONE angle image
      setStatusMessage(`正在为您并行转换 ${angleImages.length} 组视角 (1:1 匹配中)...`);

      const generationTasks = angleImages.map((angleImg, idx) => {
        const refsForThisTask = [
          ...productRefs,
          { base64: angleImg.base64!, mimeType: angleImg.mimeType! }
        ];

        const prompt = `[DOLL POSE & VIEWPOINT TRANSFER]
        
[IDENTITY - HIGHEST PRIORITY]: The first ${productRefs.length} images are the ABSOLUTE source of truth. Maintain 100% identity, color, and texture consistency.
[SINGLE OBJECT RULE]: ONLY the product from the reference images is allowed. NO other toys, NO background dolls, NO extra plushies.
[POSE]: Replicate the EXACT 3D orientation, camera tilt, and body posture of the LAST reference image.
[MANDATORY]: The final image MUST have the same silhouette and perspective as the LAST image. 

[STYLE]: ${ECOMMERCE_STYLE}
`;

        return generateImageToImage(
          refsForThisTask,
          prompt,
          {
            aspectRatio: outputAspectRatio,
            resolution: resolution,
            modelId: selectedModel,
            negativePrompt: 'other toys, extra dolls, background plushies, second toy, multiple toys, front-facing, looking at camera, standard pose, symmetrical, redesign, different toy, different proportions, warped, deformed',
            workflowHint: 'doll-modification',
            sampleCount: 1
          }
        );
      });

      const allResults = await Promise.allSettled(generationTasks);
      
      const successfulImages: string[] = [];
      allResults.forEach(res => {
        if (res.status === 'fulfilled' && res.value && res.value.length > 0) {
          successfulImages.push(res.value[0]);
        } else if (res.status === 'rejected') {
          console.error("Parallel generation task failed:", res.reason);
        }
      });

      if (successfulImages.length > 0) {
        setResultImages(successfulImages);
        await saveGeneratedProject({
          type: 'RETOUCHING',
          generated: successfulImages,
          original: [
            ...productImages.map(img => `data:${img.mimeType};base64,${img.base64}`),
            ...angleImages.map(img => `data:${img.mimeType};base64,${img.base64}`)
          ],
          prompt: `[DOLL POSE & VIEWPOINT TRANSFER]\n${detailDescription || ''}`,
          params: {
            source: 'DollFactory/DollAngleReferenceTab',
            model: selectedModel,
            aspectRatio: outputAspectRatio,
            resolution,
            productCount: productImages.length,
            angleCount: angleImages.length
          }
        });
      } else {
        throw new Error('所有并行生成任务均失败，未能返回图片');
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `doll-angle-reference-${index + 1}-${Date.now()}.png`;
      a.click();
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const downloadAll = () => {
    resultImages.forEach((url, i) => {
      setTimeout(() => downloadImage(url, i), i * 300);
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#FAFAFA] text-slate-800 font-sans">
      {/* Left Control Panel */}
      <div className="w-full md:w-[500px] flex flex-col border-r border-gray-200 bg-white overflow-y-auto custom-scrollbar shadow-sm z-10">
        <div className="p-6 space-y-8 flex-1">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#F5B27A]">
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Angle Reference</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-800">角度参考</h3>
            <p className="text-xs leading-5 text-slate-500">
              上传产品主图以锁定结构，上传角度参考图提取姿势。支持最高 10 线程并行生成。您可以直接拖拽或 Ctrl+V 粘贴图片。
            </p>
          </div>

          {/* Product Images Area (Max 5) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                1. 玩偶产品主图 (必须)
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">{productImages.length}/5 张</span>
            </div>
            <p className="text-[10px] text-slate-400">提供多角度主图帮助 AI 更好地理解玩偶 3D 结构，严防样貌改变。</p>
            
            <div className="grid grid-cols-4 gap-2">
              {productImages.map((img, i) => (
                <div key={img.id} className="relative aspect-square rounded-xl border-2 border-gray-200 overflow-hidden group">
                  <img src={img.url} className="w-full h-full object-cover" alt="product" />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1 rounded backdrop-blur-sm">
                    主图 {i+1}
                  </div>
                  <button 
                    onClick={() => setProductImages(prev => prev.filter(p => p.id !== img.id))}
                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {productImages.length < 5 && (
                <label 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) handleProductFiles(Array.from(e.dataTransfer.files)); }}
                  className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-purple-50/30 hover:bg-purple-50 hover:border-purple-300 transition-all cursor-pointer"
                >
                  <input type="file" className="hidden" onChange={(e) => e.target.files && handleProductFiles(Array.from(e.target.files))} accept="image/*" multiple />
                  <Upload className="w-4 h-4 text-purple-300 mb-1" />
                  <span className="text-[9px] font-medium text-slate-400">拖拽或粘贴</span>
                </label>
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Angle Images Area (Max 10) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#F5B27A]" />
                2. 期望角度参考图 (必须)
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">{angleImages.length}/10 张</span>
            </div>
            <p className="text-[10px] text-slate-400">上传您期望的姿势或角度图片。AI 将并行参考这些角度为您生成变体。</p>
            
            <div className="grid grid-cols-4 gap-2">
              {angleImages.map((img, i) => (
                <div key={img.id} className="relative aspect-square rounded-xl border-2 border-gray-200 overflow-hidden group">
                  <img src={img.url} className="w-full h-full object-cover" alt="angle" />
                  <div className="absolute top-1 left-1 bg-[#F5B27A]/90 text-white text-[9px] font-bold px-1 rounded backdrop-blur-sm">
                    角度 {i+1}
                  </div>
                  <button 
                    onClick={() => setAngleImages(prev => prev.filter(p => p.id !== img.id))}
                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {angleImages.length < 10 && (
                <label 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) handleAngleFiles(Array.from(e.dataTransfer.files)); }}
                  className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-[#F5B27A]/5 hover:bg-[#F5B27A]/10 hover:border-[#F5B27A]/50 transition-all cursor-pointer"
                >
                  <input type="file" className="hidden" onChange={(e) => e.target.files && handleAngleFiles(Array.from(e.target.files))} accept="image/*" multiple />
                  <Upload className="w-4 h-4 text-[#F5B27A]/50 mb-1" />
                  <span className="text-[9px] font-medium text-slate-400">拖拽或粘贴</span>
                </label>
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Model Selection UI */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
             <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
               模型选择与画质
             </label>
             <div className="grid grid-cols-2 gap-2">
               <button
                 onClick={() => setSelectedModel('gpt-image-2')}
                 className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${selectedModel === 'gpt-image-2' ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-sm' : 'border-gray-200 text-slate-500 hover:bg-gray-50'}`}
               >
                 GPT-Image 2 (更稳)
               </button>
               <button
                 onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                 className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-sm' : 'border-gray-200 text-slate-500 hover:bg-gray-50'}`}
               >
                 Gemini 3.1 Flash
               </button>
             </div>
             <div className="grid grid-cols-3 gap-2 mt-2">
               {[
                 { id: AspectRatio.SQUARE, label: '1:1 正方' },
                 { id: AspectRatio.PORTRAIT_3_4, label: '3:4 竖图' },
                 { id: AspectRatio.PORTRAIT_2_3, label: '2:3 社媒' }
               ].map(item => (
                 <button
                   key={item.id}
                   onClick={() => setOutputAspectRatio(item.id)}
                   className={`py-2 rounded-xl border text-xs font-bold transition-all ${outputAspectRatio === item.id ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-sm' : 'border-gray-200 text-slate-500 hover:bg-gray-50'}`}
                 >
                   {item.label}
                 </button>
               ))}
             </div>
             <select
               value={resolution}
               onChange={(e) => setResolution(e.target.value as ImageResolution)}
               className="w-full bg-slate-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-medium outline-none focus:border-[#F5B27A] mt-2"
             >
               <option value={ImageResolution.RES_4K}>4K 超清画质 (细节更优)</option>
             </select>
          </div>

          {/* Detail Description Area */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              补充细节描述 (可选)
            </label>
            <textarea
              value={detailDescription}
              onChange={(e) => setDetailDescription(e.target.value)}
              placeholder="例如：玩偶是坐着的，头稍微向左偏，或者描述一些图片中不明显的特征..."
              className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 px-4 text-xs font-medium outline-none focus:border-purple-300 min-h-[100px] resize-none transition-all"
            />
            <p className="text-[10px] text-slate-400">文字描述可以辅助 AI 更好地理解您想要的角度和细节特征。</p>
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-5 border-t border-gray-200 bg-white sticky bottom-0 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || productImages.length === 0 || angleImages.length === 0}
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-900 shadow-xl shadow-slate-800/20 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> 并行生成中...</>
            ) : (
              <><Zap className="w-5 h-5 text-[#F5B27A]" /> 开始并行角度转换</>
            )}
          </button>
        </div>
      </div>

      {/* Main Content (Results Area) */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto relative bg-slate-50/50">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-6 p-16 bg-white rounded-3xl border border-gray-100 shadow-xl max-w-lg w-full m-auto">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-[#F5B27A]/20 border-t-[#F5B27A] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#F5B27A]" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-xl font-bold text-slate-800">10 线程并行锁定中...</h3>
              <p className="text-slate-500 text-sm font-medium animate-pulse">
                {statusMessage}
              </p>
            </div>
          </div>
        ) : resultImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-slate-400 h-full w-full max-w-sm m-auto text-center">
             <div className="w-24 h-24 rounded-3xl bg-white border-2 border-dashed border-gray-200 flex items-center justify-center mb-6 shadow-sm">
               <Camera className="w-10 h-10 text-slate-300" />
             </div>
             <p className="text-lg font-bold text-slate-600 mb-2">等待角度参考</p>
             <p className="text-xs leading-relaxed font-medium">请在左侧上传您的玩偶产品图和所需的角度参考图。AI 会锁定产品外观，让玩偶摆出目标姿势。</p>
          </div>
        ) : (
          <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
            <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
               <div className="flex items-center gap-4">
                 <div className="bg-[#F5B27A]/10 p-2.5 rounded-xl">
                   <CheckCircle2 className="w-6 h-6 text-[#F5B27A]" />
                 </div>
                 <div>
                   <h3 className="text-base font-bold text-slate-800">并发生成完成</h3>
                   <p className="text-[11px] text-slate-500">共成功生成 {resultImages.length} 组角度变体</p>
                 </div>
               </div>
               
               <button 
                 onClick={downloadAll}
                 className="px-5 py-2.5 bg-[#F6F2ED] text-slate-800 border border-[#F3E4D7] rounded-xl text-sm font-bold hover:bg-[#F3E4D7] transition-colors flex items-center gap-2"
               >
                 <Download className="w-4 h-4" /> 全部下载
               </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {resultImages.map((img, idx) => (
                 <div key={idx} className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col">
                    <div 
                      className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-50 mb-3 border border-gray-100 cursor-zoom-in"
                      onClick={() => setPreviewUrl(img)}
                    >
                      <img src={img} className="w-full h-full object-contain" alt={`Result ${idx}`} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3">
                         <button 
                           onClick={(e) => { e.stopPropagation(); downloadImage(img, idx); }}
                           className="bg-white text-slate-800 p-2.5 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all"
                         >
                           <Download className="w-5 h-5" />
                         </button>
                         <button 
                           className="bg-white text-slate-800 p-2.5 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all"
                         >
                           <Zap className="w-5 h-5 text-[#F5B27A]" />
                         </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-2">
                       <span className="text-xs font-bold text-slate-500">角度变体 #{idx + 1}</span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-300">
            <img 
              src={previewUrl} 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" 
              alt="Preview" 
            />
            <button 
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-12 right-0 text-white hover:text-[#F5B27A] transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
               <button 
                 onClick={(e) => { e.stopPropagation(); downloadImage(previewUrl, 0); }}
                 className="px-6 py-2 bg-white text-slate-800 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#F5B27A] hover:text-white transition-all shadow-xl"
               >
                 <Download className="w-4 h-4" /> 下载此图
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DollAngleReferenceTab;
