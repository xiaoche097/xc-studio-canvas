import React, { useState } from 'react';
import { Download, Loader2, Maximize2, Shirt, Sparkles, Upload, X, Zap } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';

type ClothingAspectRatio =
  | AspectRatio.PORTRAIT_2_3
  | AspectRatio.PORTRAIT_3_4
  | AspectRatio.PORTRAIT_4_5;

type ClothingResolution = '1K' | '2K' | '4K';

type PreviewState = {
  src: string;
  title: string;
  subtitle?: string;
} | null;

const ClothingEffectTab: React.FC = () => {
  // Source image (original photo)
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  // Reference image (desired clothing effect)
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  // Settings
  const [outputAspectRatio, setOutputAspectRatio] = useState<ClothingAspectRatio>(AspectRatio.PORTRAIT_2_3);
  const [resolution, setResolution] = useState<ClothingResolution>('4K');
  const [guidance, setGuidance] = useState('');
  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);

  const resetResult = () => {
    setResultImage(null);
    setStatusMessage('');
  };

  // ---- Source image handlers ----
  const setSourceFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    resetResult();
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

  const removeSource = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(null);
    setSourceUrl(null);
    resetResult();
  };

  // ---- Reference image handlers ----
  const setRefFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (refUrl) URL.revokeObjectURL(refUrl);
    setRefFile(file);
    setRefUrl(URL.createObjectURL(file));
    resetResult();
  };

  const handleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setRefFromFile(file);
    e.target.value = '';
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setRefFromFile(file);
  };

  const removeRef = () => {
    if (refUrl) URL.revokeObjectURL(refUrl);
    setRefFile(null);
    setRefUrl(null);
    resetResult();
  };

  // ---- Preview & Download ----
  const openPreview = (src: string | null, title: string, subtitle?: string) => {
    if (!src) return;
    setPreview({ src, title, subtitle });
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ---- Prompt: Face-swap onto reference ----
  const buildClothingEffectPrompt = (userGuidance: string) => {
    const extra = userGuidance.trim();
    return `REPRODUCE Image 1/2/3 exactly. Clone the entire photo — the garment, its texture, fit, drape, wrinkles, hem position, and styling. 

The ONLY modification: replace the person's face and hairstyle with the person from Image 4.

Output = Image 1/2/3's clothing (pixel-perfect) + Image 4's face and hair.

${extra ? `Additional note: ${extra}` : ''}

Do NOT reinterpret the clothing. Do NOT generate a "similar" garment. CLONE Image 1/2/3's garment exactly as-is.`;
  };

  const buildNegativePrompt = () => [
    'different garment from reference',
    'reinterpreted clothing design',
    'smoothed texture',
    'different knit pattern',
    'different hem position',
    'different fit',
    'extra fingers',
    'deformed hands',
    'blurry',
    'low quality',
  ].join(', ');

  // ---- Generate ----
  const handleGenerate = async () => {
    if (!sourceFile || !refFile) {
      alert('请上传原图和衣服效果参考图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('正在克隆参考图衣服效果，替换为原图人物...');

    try {
      const [sourceImage, refImage] = await Promise.all([
        compressImage(sourceFile, 2048, 0.96),
        compressImage(refFile, 2048, 0.96),
      ]);

      setStatusMessage('正在生成：保持参考图衣服 + 原图人物脸部...');

      const prompt = buildClothingEffectPrompt(guidance);
      const negativePrompt = buildNegativePrompt();

      // Image order: [source (face donor), reference (clothing master)]
      // The 'clothing-effect' workflowHint will reorder to [ref, ref, ref, source] internally
      // The model reproduces the reference and only swaps the face from source
      const inputImages = [
        { base64: sourceImage.base64, mimeType: sourceImage.mime },
        { base64: refImage.base64, mimeType: refImage.mime },
      ];

      const fallbackModels = ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] as const;

      let result: string[] = [];
      let lastError: any = null;

      for (const [index, modelId] of fallbackModels.entries()) {
        try {
          if (index > 0) {
            setStatusMessage(`主模型不可用，正在切换到 ${modelId} 重试...`);
          }

          result = await generateImageToImage(
            inputImages,
            prompt,
            {
              aspectRatio: outputAspectRatio,
              resolution: resolution as any,
              modelId,
              negativePrompt,
              workflowHint: 'clothing-effect',
            }
          );

          if (result && result.length > 0) break;
        } catch (error) {
          lastError = error;
          console.warn(`[Clothing Effect] ${modelId} failed`, error);
        }
      }

      if (result && result.length > 0) {
        setResultImage(result[0]);
        setStatusMessage('衣服效果调整完成！可以放大查看细节。');
      } else {
        throw lastError || new Error('模型未返回任何图片，请稍后重试');
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
      setStatusMessage('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* Sidebar - Inputs */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Shirt className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Clothing Effect</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">衣服效果调整</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传原图（提供人脸）和衣服上身效果参考图（提供衣服效果），
              AI会保持参考图的衣服效果不变，只替换为原图中的人物。
            </p>
          </div>

          {/* 原图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>原图（提供人脸与身份）</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            <div className="flex flex-col gap-2">
              {sourceUrl ? (
                <div
                  className="relative group w-full aspect-[4/3] rounded-2xl border border-pastel-border shadow-sm overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleSourceDrop}
                >
                  <img src={sourceUrl} alt="source" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <label
                      className="cursor-pointer bg-white p-2 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="file" className="hidden" onChange={handleSourceChange} accept="image/*" />
                      <Upload className="w-4 h-4" />
                    </label>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview(sourceUrl, '原图'); }}
                      className="bg-white p-2 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeSource(); }}
                      className="bg-white p-2 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleSourceDrop}
                  className="relative flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                >
                  <input type="file" className="hidden" onChange={handleSourceChange} accept="image/*" />
                  <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-pastel-text">点击或拖拽原图到此处</span>
                  <span className="text-xs text-pastel-muted mt-1 px-4 text-center">仅提取人脸和头发，身体与衣服不使用</span>
                </label>
              )}
            </div>
          </div>

          {/* 参考图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>衣服效果参考图</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            <div className="flex flex-col gap-2">
              {refUrl ? (
                <div
                  className="relative group w-full aspect-[4/3] rounded-2xl border border-pastel-border shadow-sm overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleRefDrop}
                >
                  <img src={refUrl} alt="reference" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <label
                      className="cursor-pointer bg-white p-2 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="file" className="hidden" onChange={handleRefChange} accept="image/*" />
                      <Upload className="w-4 h-4" />
                    </label>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview(refUrl, '衣服效果参考图'); }}
                      className="bg-white p-2 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRef(); }}
                      className="bg-white p-2 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleRefDrop}
                  className="relative flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                >
                  <input type="file" className="hidden" onChange={handleRefChange} accept="image/*" />
                  <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Shirt className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-pastel-text">点击或拖拽效果参考图到此处</span>
                  <span className="text-xs text-pastel-muted mt-1 px-4 text-center">此图效果将被完整保留，仅替换人脸</span>
                </label>
              )}
            </div>
          </div>

          {/* 输出画幅 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出画幅 (Aspect Ratio)</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: AspectRatio.PORTRAIT_2_3, label: '2:3', isDefault: true },
                { value: AspectRatio.PORTRAIT_3_4, label: '3:4', isDefault: false },
                { value: AspectRatio.PORTRAIT_4_5, label: '4:5', isDefault: false },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setOutputAspectRatio(item.value as ClothingAspectRatio)}
                  className={`rounded-xl border py-2.5 text-xs font-bold transition-all relative ${outputAspectRatio === item.value ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
                >
                  {item.label}
                  {item.isDefault && (
                    <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-pastel-highlight text-white px-1.5 py-0.5 rounded-full font-bold">默认</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出分辨率 (Resolution)</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: '1K' as ClothingResolution, label: '1K', desc: '标准' },
                { value: '2K' as ClothingResolution, label: '2K', desc: '高清' },
                { value: '4K' as ClothingResolution, label: '4K', desc: '超高清' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setResolution(item.value)}
                  className={`rounded-xl border py-2.5 text-xs font-bold transition-all relative ${resolution === item.value ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
                >
                  {item.label}
                  {item.value === '4K' && (
                    <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-pastel-highlight text-white px-1.5 py-0.5 rounded-full font-bold">默认</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 补充提示 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted mb-2">补充说明（可选）</h3>
            <textarea
              rows={3}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="例如：只调整袖子的挽起效果，或者衬衫下摆塞入裤腰..."
              className="w-full bg-white border border-pastel-border rounded-xl py-3 px-4 text-xs focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
            />
          </div>
        </div>

        {/* Sticky Footer Button */}
        <div className="p-5 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 disabled:opacity-50 transition-all active:scale-[0.98] hover:shadow-violet-500/40 hover:brightness-105"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                正在调整衣服效果...
              </>
            ) : (
              <>
                <Shirt className="h-5 w-5" />
                生成衣服效果调整
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Panel - Result Workspace */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden relative items-center justify-center bg-transparent">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-6 p-12 bg-white/50 backdrop-blur-md rounded-3xl border border-white shadow-xl max-w-md w-full">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-violet-500 animate-spin" />
                <Shirt className="w-6 h-6 text-fuchsia-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-xl font-black text-violet-600 tracking-tight">调整衣服效果中...</h3>
                <p className="text-pastel-text/80 text-sm font-medium animate-pulse transition-all duration-500">
                  {statusMessage || '正在智能分析衣服效果差异，精准调整穿着效果...'}
                </p>
              </div>
            </div>
          </div>
        ) : !resultImage ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted w-full h-full">
            <div className="w-24 h-24 rounded-3xl bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-6 transition-all hover:scale-105 hover:border-violet-400 hover:shadow-lg hover:shadow-violet-400/20 shadow-sm">
              <Shirt className="w-10 h-10 text-pastel-border" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-black text-pastel-text">等待上传并生成</p>
              <p className="text-xs tracking-wide opacity-70 text-center">
                请先在左侧上传原图与衣服效果参考图<br />
                AI会智能分析需要调整的区域并生成结果
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-between w-full max-w-[720px] mb-2 px-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-black text-slate-800 tracking-tight">生成结果 (Clothing Effect Result)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openPreview(resultImage, '生成结果')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-pastel-border bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 shadow-sm"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  放大
                </button>
                <button
                  type="button"
                  onClick={() => downloadImage(resultImage, `clothing-effect-${Date.now()}.png`)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-500/15 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </button>
              </div>
            </div>

            <div className="relative group max-h-[80%] overflow-hidden rounded-[40px] border border-white bg-white/80 shadow-[0_40px_100px_-30px_rgba(15,23,42,0.3)] backdrop-blur-md transition-all hover:shadow-2xl">
              <img
                src={resultImage}
                alt="result"
                className="max-h-full w-auto object-contain bg-slate-50 cursor-zoom-in"
                onClick={() => openPreview(resultImage, '生成结果')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-xl" onClick={() => setPreview(null)}>
          <button type="button" onClick={() => setPreview(null)} className="absolute right-6 top-6 rounded-full border border-white/15 bg-white/10 p-4 text-white transition-colors hover:bg-white/20 shadow-2xl">
            <X className="h-8 w-8" />
          </button>

          <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[40px] border border-white/10 bg-[#0d1117] shadow-[0_60px_150px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-8 py-6 text-white bg-white/5">
              <div>
                <div className="text-xl font-black tracking-tight">{preview.title}</div>
                {preview.subtitle && <div className="mt-1 text-xs text-white/50">{preview.subtitle}</div>}
              </div>
              <button type="button" onClick={() => downloadImage(preview.src, `${preview.title}-${Date.now()}.png`)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-black text-white transition-all hover:brightness-110 shadow-lg shadow-violet-500/20 active:scale-95">
                <Download className="h-4 w-4" />
                下载图片
              </button>
            </div>

            <div className="flex-1 overflow-auto p-10 flex items-center justify-center bg-[#080b10]">
              <img src={preview.src} className="h-full w-full object-contain" alt={preview.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClothingEffectTab;
