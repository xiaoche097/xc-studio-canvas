import React, { useState } from 'react';
import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, Edit2, X } from 'lucide-react';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { DollImageEditor, EditorBox } from './components/DollImageEditor';

const DollMainAdjustTab: React.FC = () => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [guidance, setGuidance] = useState('');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');

  // Reference Images (Up to 3)
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorBoxes, setEditorBoxes] = useState<EditorBox[]>([]);

  const dataURLtoFile = (dataUrl: string, filename: string) => {
    let arr = dataUrl.split(','),
        mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png',
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  };

  const setSourceFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (sourceUrl && sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setResultImage(null);
    setEditorBoxes([]); // Reset boxes on new image
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSourceFromFile(file);
    e.target.value = '';
  };

  const handleSourceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setSourceFromFile(file);
  };

  const addRefFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (refFiles.length >= 3) return; // Limit to 3 files
    setRefFiles(prev => [...prev, file]);
    setRefUrls(prev => [...prev, URL.createObjectURL(file)]);
  };
  
  const removeRefFile = (index: number) => {
     setRefFiles(prev => prev.filter((_, i) => i !== index));
     setRefUrls(prev => {
        const newUrls = [...prev];
        URL.revokeObjectURL(newUrls[index]);
        newUrls.splice(index, 1);
        return newUrls;
     });
  };

  const handleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => addRefFile(file));
    e.target.value = '';
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files || []).forEach(file => addRefFile(file));
  };

  const downloadImage = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `doll-adjust-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleGenerate = async () => {
    if (!sourceFile) {
      alert('请上传玩偶原图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('正在分析玩偶原图结构属性，调整生成参数...');

    try {
      // Import here to avoid early hydration issues if any
      const { generateImageToImage, analyzeDollModification } = await import('../Cyzx4/services/geminiService');
      
      const compressedImage = await compressImage(sourceFile, 2048, 0.96);
      const inputImages = [{ base64: compressedImage.base64, mimeType: compressedImage.mime }];
      
      const refInputImages: { base64: string; mimeType: string }[] = [];
      for (const file of refFiles) {
         const compressedRef = await compressImage(file, 2048, 0.96);
         inputImages.push({ base64: compressedRef.base64, mimeType: compressedRef.mime });
         refInputImages.push({ base64: compressedRef.base64, mimeType: compressedRef.mime });
      }

      let prompt = `[DOLL MAIN IMAGE ENHANCEMENT]\nOptimizing the main display image for a toy/doll.\nUser instruction: ${guidance || 'Enhance lighting, details and background to make it look professional for e-commerce, retaining the core features of the doll.'}`;
      let negativePrompt = 'deformed anatomy, totally different doll, distorted shape, extra limbs, bad lighting, text, watermark';

      // ==========================================
      // [NEW] Agentic Pre-analysis for Precision Locality
      // ==========================================
      if (editorBoxes.length > 0 && refInputImages.length > 0) {
        setStatusMessage('🌍 Agent 正在深度分析框选区域与参考图语义...');
        // Execute Vision Pre-processing
        const analysis = await analyzeDollModification(
          { base64: compressedImage.base64, mimeType: compressedImage.mime },
          refInputImages,
          editorBoxes.map((b, i) => {
             const colors = ['Red', 'Yellow', 'Blue'];
             return { ...b, color: colors[i % 3] };
          }),
          guidance
        );
        
        if (analysis && analysis.engineered_prompt) {
           prompt = `[PRECISION INPAINTING MODE]\n` + analysis.engineered_prompt;
           if (analysis.reasoning) {
             console.log("Agent Reasoning:", analysis.reasoning);
           }
        }
      } else if (refInputImages.length > 0) {
        // Fallback for global reference without specific boxes
        prompt += `\nCRITICAL: You have been provided ${refFiles.length} additional input image(s) acting as STYLE/EFFECT REFERENCES. Please seamlessly blend their visual features globally onto the main doll.`;
      }
      
      setStatusMessage(`正在使用 ${selectedModel} 生成高质量玩偶主图...`);
      
      const result = await generateImageToImage(
        inputImages,
        prompt,
        {
          aspectRatio: outputAspectRatio,
          resolution: resolution,
          modelId: selectedModel,
          negativePrompt,
          workflowHint: 'doll-modification'
        }
      );

      if (result && result.length > 0) {
        setResultImage(result[0]);
        setStatusMessage('生成成功！');
      } else {
        throw new Error('未返回任何图片');
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* 左侧控制栏 */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Doll Adjustment</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">玩偶主图调整</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传基础的玩偶草图或原片，AI 结合提示词为您生成精美、专业的商业展示主图。
            </p>
          </div>

          {/* 原图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>基础玩偶原图</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            {sourceUrl ? (
              <div 
                className="relative group w-full aspect-square rounded-[24px] border border-pastel-border shadow-sm overflow-hidden bg-white"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
              >
                <img src={sourceUrl} alt="source" className="w-full h-full object-contain" />
                
                {/* Delete button (Top Right) */}
                <button 
                  onClick={() => { setSourceUrl(null); setSourceFile(null); setEditorBoxes([]); }}
                  className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100 z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Edit Button overlay (Bottom Right) */}
                <button 
                  onClick={() => setIsEditorOpen(true)}
                  className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-black/90 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-10 backdrop-blur-sm border border-white/10"
                >
                  编辑
                </button>
                
                {/* Draw Boxes Preview (optional, visual only) */}
                <div className="absolute inset-0 pointer-events-none">
                   {editorBoxes.map((b, i) => {
                      const colors = [
                         { border: 'border-red-500', bg: 'bg-red-500', text: 'text-white' },
                         { border: 'border-yellow-400', bg: 'bg-yellow-400', text: 'text-black' },
                         { border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-white' }
                      ];
                      const style = colors[i % 3];
                      return (
                      <div 
                         key={b.id} 
                         className={`absolute border-2 ${style.border} ${style.bg}/10 pointer-events-none flex items-start justify-start overflow-hidden`}
                         style={{ left: `${b.x*100}%`, top: `${b.y*100}%`, width: `${b.w*100}%`, height: `${b.h*100}%` }}
                      >
                         <span className={`${style.bg} ${style.text} text-[8px] font-bold px-1 rounded-br-sm`}>{i+1}</span>
                      </div>
                   )})}
                </div>
              </div>
            ) : (
              <label 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
                className="relative flex flex-col items-center justify-center w-full aspect-square rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
              >
                <input type="file" className="hidden" onChange={handleSourceChange} accept="image/*" />
                <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-pastel-text">点击或拖拽原图到此处</span>
              </label>
            )}
          </div>

          {/* 参考图上传 (可选) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>参考效果图 <span className="opacity-60 font-normal">({refFiles.length}/3)</span></span>
              <span className="text-[10px] font-normal text-pastel-muted">可选</span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
               {refUrls.map((url, i) => {
                  const colors = ['bg-red-500', 'bg-yellow-400', 'bg-blue-500'];
                  return (
                  <div 
                    key={i}
                    className="relative group w-full aspect-square rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-white flex items-center justify-center p-1"
                  >
                    <img src={url} alt={`reference-${i}`} className="max-w-full max-h-full object-contain" />
                    
                    {/* Color badge mapper */}
                    <span className={`absolute top-1 left-1 w-3.5 h-3.5 ${colors[i % 3]} rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[8px] font-bold text-white`}>
                      {i+1}
                    </span>

                    <button 
                      onClick={() => removeRefFile(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black/80 transition-colors bg-opacity-0 opacity-0 group-hover:opacity-100 z-10"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
               )})}

               {refFiles.length < 3 && (
                 <label 
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={handleRefDrop}
                   className="relative flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                 >
                   <input type="file" className="hidden" onChange={handleRefChange} accept="image/*" multiple />
                   <div className="w-6 h-6 mb-1 bg-white shadow-sm rounded-md flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                     <ImageIcon className="w-3 h-3" />
                   </div>
                   <span className="text-[9px] font-bold text-pastel-text opacity-70">上传参考</span>
                 </label>
               )}
            </div>
          </div>

          {/* 画幅选择 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出画幅 (Aspect Ratio)</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: AspectRatio.SQUARE, label: '1:1' },
                { value: AspectRatio.PORTRAIT_3_4, label: '3:4' },
                { value: AspectRatio.PORTRAIT_4_5, label: '4:5' },
                { value: AspectRatio.PORTRAIT_9_16, label: '9:16' }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setOutputAspectRatio(item.value)}
                  className={`rounded-xl border py-2 text-xs font-bold transition-all ${outputAspectRatio === item.value ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
             <h3 className="text-xs font-bold text-pastel-muted mb-2">生成画质</h3>
             <select
               value={resolution}
               onChange={(e) => setResolution(e.target.value as ImageResolution)}
               className="w-full bg-white border border-pastel-border rounded-xl py-2.5 px-3 text-xs font-bold outline-none transition-all"
             >
               <option value={ImageResolution.RES_2K}>2K (快速清晰)</option>
               <option value={ImageResolution.RES_4K}>4K (极致细节)</option>
             </select>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">补充提示词 (可选)</h3>
            <textarea
              rows={3}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="例如：毛绒材质、明亮的暖色调灯光、背景是童话房间..."
              className="w-full bg-white border border-pastel-border rounded-xl py-3 px-4 text-xs focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
            />
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
             <label className="block text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5">
               <Cpu className="w-3.5 h-3.5" /> 模型选择
             </label>
             <div className="grid grid-cols-2 gap-3">
               <button
                 onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                 className={`py-2 rounded-xl border text-xs font-bold transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-pastel-border text-pastel-muted'}`}
               >
                 3.1 Flash (极速)
               </button>
               <button
                 onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                 className={`py-2 rounded-xl border text-xs font-bold transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-pastel-border text-pastel-muted'}`}
               >
                 3.0 Pro (推荐)
               </button>
             </div>
           </div>

        </div>

        <div className="p-5 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10 shadow-sm">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all hover:brightness-105 active:scale-[0.98]"
          >
            {isGenerating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> 正在生成玩偶主图...</>
            ) : (
              <><Zap className="h-5 w-5" /> 立即生成</>
            )}
          </button>
        </div>
      </div>

      {/* 右侧展示区 */}
      <div className="flex-1 flex px-6 py-6 overflow-hidden relative items-center justify-center bg-transparent">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-6 p-12 bg-white/50 backdrop-blur-md rounded-3xl border border-white shadow-xl max-w-md w-full">
              <Loader2 className="w-16 h-16 text-pastel-highlight animate-spin" />
              <div className="text-center space-y-3">
                <h3 className="text-xl font-black text-pastel-highlight">处理中...</h3>
                <p className="text-pastel-text/80 text-sm font-medium animate-pulse">
                  {statusMessage}
                </p>
              </div>
            </div>
          </div>
        ) : !resultImage ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted w-full h-full">
             <div className="w-24 h-24 rounded-3xl bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-6 shadow-sm">
               <Zap className="w-10 h-10 text-pastel-border" />
             </div>
             <p className="text-lg font-black text-pastel-text">等待生成</p>
             <p className="text-xs mt-2 opacity-70">请在左侧上传玩偶底图并点击生成</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-between w-full max-w-2xl px-2">
               <div className="flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-pastel-highlight" />
                 <span className="text-sm font-black text-slate-800 tracking-tight">生成结果</span>
               </div>
               <button
                 onClick={downloadImage}
                 className="flex items-center justify-center gap-2 rounded-xl border border-pastel-highlight/20 bg-pastel-highlight/10 px-4 py-2 text-xs font-bold text-pastel-highlight hover:bg-pastel-highlight/15 shadow-sm"
               >
                 <Download className="h-3.5 w-3.5" /> 下载
               </button>
            </div>
            
            <div className="relative group max-h-[85%] overflow-hidden rounded-[24px] border border-white bg-white/80 shadow-xl backdrop-blur-md transition-all hover:shadow-2xl">
              <img
                src={resultImage}
                alt="Doll Result"
                className="max-h-full w-auto object-contain bg-slate-50"
              />
            </div>
          </div>
        )}
      </div>

      {isEditorOpen && sourceUrl && (
        <DollImageEditor
           initialImage={sourceUrl}
           initialBoxes={editorBoxes}
           onClose={() => setIsEditorOpen(false)}
           onApplyCrop={(base64) => {
              setSourceUrl(base64);
              setSourceFile(dataURLtoFile(base64, 'cropped_doll.png'));
           }}
           onApplyBoxes={(boxes) => {
              setEditorBoxes(boxes);
           }}
        />
      )}
    </div>
  );
};

export default DollMainAdjustTab;
