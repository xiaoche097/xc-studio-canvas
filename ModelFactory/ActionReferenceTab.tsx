import React, { useState } from 'react';
import { Download, Loader2, Maximize2, Sparkles, Upload, X, Zap, Move, CheckCircle2, AlertCircle, Images } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';

type ResultItem = {
  refIndex: number;
  refUrl: string;
  resultUrl: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
};

type PreviewState = {
  src: string;
  title: string;
  subtitle?: string;
} | null;

const ActionReferenceTab: React.FC = () => {
  // Model image (identity source)
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  // Action reference images (up to 10)
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);

  // Settings
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_2_3);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);

  // Preview modal
  const [preview, setPreview] = useState<PreviewState>(null);

  const MAX_REFS = 10;

  // ---- Model image handlers ----
  const setModelFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    setModelFile(file);
    setModelUrl(URL.createObjectURL(file));
    setResults([]);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setModelFromFile(file);
    e.target.value = '';
  };

  const handleModelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setModelFromFile(file);
  };

  const removeModel = () => {
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    setModelFile(null);
    setModelUrl(null);
    setResults([]);
  };

  // ---- Reference images handlers ----
  const addRefFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (refFiles.length + validFiles.length > MAX_REFS) {
      alert(`最多支持 ${MAX_REFS} 张动作参考图`);
      return;
    }
    const newFiles = [...refFiles];
    const newUrls = [...refUrls];
    validFiles.forEach(file => {
      newFiles.push(file);
      newUrls.push(URL.createObjectURL(file));
    });
    setRefFiles(newFiles);
    setRefUrls(newUrls);
    setResults([]);
  };

  const handleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addRefFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addRefFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeRef = (index: number) => {
    URL.revokeObjectURL(refUrls[index]);
    setRefFiles(prev => prev.filter((_, i) => i !== index));
    setRefUrls(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  };

  const removeAllRefs = () => {
    refUrls.forEach(url => URL.revokeObjectURL(url));
    setRefFiles([]);
    setRefUrls([]);
    setResults([]);
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

  const downloadAllResults = () => {
    results.forEach((item, i) => {
      if (item.resultUrl) {
        setTimeout(() => {
          downloadImage(item.resultUrl!, `action-ref-${i + 1}-${Date.now()}.png`);
        }, i * 300);
      }
    });
  };

  // ---- Prompt engineering ----
  const buildPrompt = () => {
    return `[STRICT POSE TRANSFER — CLOTHING INTEGRITY LOCK]

TASK: Place the EXACT person and EXACT outfit from the Identity Source (Image 3) into the pose/angle/framing shown in the Pose Reference (Image 1 & 2).

=== CLOTHING PRESERVATION (NON-NEGOTIABLE) ===
The output must show the EXACT SAME clothing as Image 3, including:
- SAME garment type, color, fabric, texture, pattern, and structure
- SAME tuck/untuck: if the shirt is TUCKED INTO pants in Image 3, it MUST be tucked in the output
- SAME hem position: if the hem sits above/at/below the waistband in Image 3, keep it IDENTICAL
- SAME sleeve state: rolled up, folded, or down — match Image 3 exactly
- SAME neckline shape and collar position
- SAME accessories (necklace, belt, bracelet, bag) — keep or remove to match Image 3
- SAME pants/bottoms style and fit

=== POSE TRANSFER (NON-NEGOTIABLE) ===
- Copy Image 1 & 2's EXACT: body angle, arm positions, hand placement, leg stance, head tilt, shoulder slope
- Copy Image 1 & 2's EXACT: camera distance, crop boundaries, subject placement, framing composition
- ABANDON Image 3's pose entirely. Only keep its identity and clothing.

=== ABSOLUTE PROHIBITIONS ===
- NEVER copy clothing from Image 1 & 2. Their clothes are IRRELEVANT.
- NEVER change the tuck/untuck of the shirt. If tucked in Image 3, it stays tucked.
- NEVER change the hem length or position relative to the waistband.
- NEVER add or remove accessories that differ from Image 3.
- NEVER change the garment color, pattern, or fabric texture.

VERIFICATION CHECKLIST:
1. Is the person's face from Image 3? ✓
2. Is the clothing IDENTICAL to Image 3 (color, style, tuck, hem, sleeves)? ✓
3. Is the pose matching Image 1 & 2 (arms, legs, angle)? ✓
4. Is the framing matching Image 1 & 2 (crop, distance, composition)? ✓
5. Is there ZERO clothing from Image 1 & 2 in the output? ✓`;
  };

  const buildNegativePrompt = () => [
    'copying Pose Reference clothing',
    'copying Pose Reference garment color',
    'copying Pose Reference accessories',
    'copying Pose Reference neckline',
    'wearing Pose Reference outfit',
    'changed hem position',
    'shirt untucked when source is tucked',
    'shirt tucked when source is untucked',
    'different clothing from source',
    'different garment color',
    'different fabric texture',
    'added accessories not in source',
    'removed accessories from source',
    'different identity',
    'different hairstyle',
    'same pose as Identity Source',
    'unchanged framing from Identity Source',
    'extra fingers',
    'deformed hands',
  ].join(', ');

  // ---- Batch parallel generation ----
  const handleGenerate = async () => {
    if (!modelFile) {
      alert('请上传模特原图');
      return;
    }
    if (refFiles.length === 0) {
      alert('请至少上传 1 张动作参考图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage(`正在并行生成 ${refFiles.length} 张动作迁移结果...`);

    // Initialize results
    const initialResults: ResultItem[] = refUrls.map((url, i) => ({
      refIndex: i,
      refUrl: url,
      resultUrl: null,
      status: 'pending',
    }));
    setResults(initialResults);

    try {
      // Compress model image once
      const modelImage = await compressImage(modelFile, 2048, 0.96);

      const prompt = buildPrompt();
      const negativePrompt = buildNegativePrompt();
      const fallbackModels = ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] as const;

      // Generate all in parallel
      await Promise.all(refFiles.map(async (refFile, index) => {
        // Mark as generating
        setResults(prev => prev.map((r, i) => i === index ? { ...r, status: 'generating' } : r));

        try {
          const refImage = await compressImage(refFile, 2048, 0.96);

          // Image order: [Pose ref, Identity source] — pose-transfer workflow reorders to [ref, ref, source]
          const inputImages = [
            { base64: refImage.base64, mimeType: refImage.mime },
            { base64: modelImage.base64, mimeType: modelImage.mime },
          ];

          let result: string[] = [];
          let lastError: any = null;

          for (const [modelIdx, modelId] of fallbackModels.entries()) {
            try {
              result = await generateImageToImage(
                inputImages,
                prompt,
                {
                  aspectRatio: outputAspectRatio,
                  resolution: resolution as any,
                  modelId,
                  negativePrompt,
                  workflowHint: 'pose-transfer',
                }
              );
              if (result && result.length > 0) break;
            } catch (error) {
              lastError = error;
              console.warn(`[Action Ref #${index + 1}] ${modelId} failed`, error);
            }
          }

          if (result && result.length > 0) {
            setResults(prev => prev.map((r, i) => i === index ? { ...r, resultUrl: result[0], status: 'done' } : r));
          } else {
            throw lastError || new Error('模型未返回图片');
          }
        } catch (err: any) {
          console.error(`[Action Ref #${index + 1}] Error:`, err);
          setResults(prev => prev.map((r, i) => i === index ? { ...r, status: 'error', error: getErrorMessage(err) } : r));
        }
      }));

      setStatusMessage('全部生成完成！');
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
      setStatusMessage('');
    } finally {
      setIsGenerating(false);
    }
  };

  const completedCount = results.filter(r => r.status === 'done').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalCount = results.length;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* Sidebar - Inputs */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Move className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Action Reference</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">动作参考</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              上传一张模特原图，再上传最多10张动作参考图。
              AI会按每张参考图的动作、画幅、比例，批量并行生成结果。
            </p>
          </div>

          {/* 模特原图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>模特原图（锁定身份与服装）</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            <div className="flex flex-col gap-2">
              {modelUrl ? (
                <div
                  className="relative group w-full aspect-[4/3] rounded-2xl border border-pastel-border shadow-sm overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleModelDrop}
                >
                  <img src={modelUrl} alt="model" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <label
                      className="cursor-pointer bg-white p-2 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="file" className="hidden" onChange={handleModelChange} accept="image/*" />
                      <Upload className="w-4 h-4" />
                    </label>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview(modelUrl, '模特原图'); }}
                      className="bg-white p-2 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeModel(); }}
                      className="bg-white p-2 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleModelDrop}
                  className="relative flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                >
                  <input type="file" className="hidden" onChange={handleModelChange} accept="image/*" />
                  <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-pastel-text">点击或拖拽模特原图到此处</span>
                  <span className="text-xs text-pastel-muted mt-1 px-4 text-center">人物长相、服装结构保持不变</span>
                </label>
              )}
            </div>
          </div>

          {/* 动作参考图上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>动作参考图（最多{MAX_REFS}张）</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-normal text-pastel-muted">{refFiles.length}/{MAX_REFS}</span>
                {refFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={removeAllRefs}
                    className="text-[10px] text-red-400 hover:text-red-500 font-bold"
                  >
                    清空全部
                  </button>
                )}
              </div>
            </h3>

            {/* Reference image grid */}
            <div className="grid grid-cols-3 gap-2">
              {refUrls.map((url, i) => (
                <div key={i} className="relative group aspect-[3/4] rounded-xl border border-pastel-border shadow-sm overflow-hidden bg-white">
                  <img src={url} alt={`ref-${i + 1}`} className="w-full h-full object-cover" />
                  {/* Index badge */}
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    #{i + 1}
                  </div>
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => openPreview(url, `动作参考 #${i + 1}`)}
                      className="bg-white p-1.5 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRef(i)}
                      className="bg-white p-1.5 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add more slot */}
              {refFiles.length < MAX_REFS && (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleRefDrop}
                  className="relative flex flex-col items-center justify-center aspect-[3/4] rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                >
                  <input type="file" className="hidden" onChange={handleRefChange} accept="image/*" multiple />
                  <Upload className="w-5 h-5 text-pastel-muted group-hover:text-pastel-highlight transition-colors" />
                  <span className="text-[9px] text-pastel-muted mt-1 font-bold">添加参考</span>
                </label>
              )}
            </div>
          </div>

          {/* 输出画幅 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出画幅 (ASPECT RATIO)</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: AspectRatio.PORTRAIT_2_3, label: '2:3', badge: '默认' },
                { value: AspectRatio.PORTRAIT_3_4, label: '3:4' },
                { value: AspectRatio.PORTRAIT_4_5, label: '4:5' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setOutputAspectRatio(item.value)}
                  className={`relative rounded-xl border py-2.5 text-xs font-bold transition-all ${outputAspectRatio === item.value
                    ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm'
                    : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'
                    }`}
                >
                  {item.label}
                  {item.badge && outputAspectRatio === item.value && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出分辨率 (RESOLUTION)</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: ImageResolution.RES_1K, label: '1K' },
                { value: ImageResolution.RES_2K, label: '2K' },
                { value: ImageResolution.RES_4K, label: '4K', badge: '默认' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setResolution(item.value)}
                  className={`relative rounded-xl border py-2.5 text-xs font-bold transition-all ${resolution === item.value
                    ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm'
                    : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'
                    }`}
                >
                  {item.label}
                  {item.badge && resolution === item.value && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Footer Button */}
        <div className="p-5 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !modelFile || refFiles.length === 0}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all active:scale-[0.98] hover:shadow-orange-500/40 hover:brightness-105"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                正在生成 {completedCount}/{totalCount}...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                批量生成动作迁移 ({refFiles.length}张)
              </>
            )}
          </button>
          {statusMessage && (
            <p className="text-[10px] text-pastel-muted text-center mt-2 animate-pulse">{statusMessage}</p>
          )}
        </div>
      </div>

      {/* Main Panel - Results Gallery */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden relative bg-transparent">
        {results.length === 0 && !isGenerating ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center text-pastel-muted w-full h-full">
            <div className="w-24 h-24 rounded-3xl bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-6 transition-all hover:scale-105 hover:border-pastel-highlight hover:shadow-lg hover:shadow-pastel-highlight/20 shadow-sm">
              <Move className="w-10 h-10 text-pastel-border" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-black text-pastel-text">等待上传并生成</p>
              <p className="text-xs tracking-wide opacity-70 text-center">
                请在左侧上传模特原图和动作参考图<br />
                AI会自动按每张参考图生成对应的动作迁移结果
              </p>
            </div>
          </div>
        ) : (
          /* Results grid */
          <div className="w-full h-full flex flex-col overflow-hidden">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4 px-2 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pastel-highlight" />
                  <span className="text-sm font-black text-slate-800 tracking-tight">
                    生成结果 ({completedCount}/{totalCount})
                  </span>
                </div>
                {errorCount > 0 && (
                  <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full">
                    {errorCount} 张失败
                  </span>
                )}
              </div>
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={downloadAllResults}
                  className="flex items-center gap-2 rounded-xl border border-pastel-highlight/20 bg-pastel-highlight/10 px-4 py-2 text-xs font-bold text-pastel-highlight transition-colors hover:bg-pastel-highlight/15 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  全部下载
                </button>
              )}
            </div>

            {/* Scrollable results grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                {results.map((item, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    {/* Reference → Result comparison */}
                    <div className="relative aspect-[2/3] rounded-2xl border border-pastel-border bg-white shadow-sm overflow-hidden group">
                      {item.status === 'done' && item.resultUrl ? (
                        <>
                          <img
                            src={item.resultUrl}
                            alt={`result-${i + 1}`}
                            className="w-full h-full object-cover cursor-zoom-in"
                            onClick={() => openPreview(item.resultUrl, `生成结果 #${i + 1}`)}
                          />
                          {/* Success badge */}
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            #{i + 1}
                          </div>
                          {/* Hover controls */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => openPreview(item.resultUrl, `生成结果 #${i + 1}`)}
                              className="bg-white p-2 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadImage(item.resultUrl!, `action-ref-${i + 1}-${Date.now()}.png`)}
                              className="bg-white p-2 text-pastel-text hover:text-green-500 rounded-full shadow-lg transition-transform hover:scale-110"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : item.status === 'generating' || item.status === 'pending' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-white/80">
                          {item.status === 'generating' ? (
                            <>
                              <Loader2 className="w-8 h-8 text-pastel-highlight animate-spin mb-3" />
                              <span className="text-[10px] font-bold text-pastel-muted">生成中...</span>
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 rounded-full border-2 border-dashed border-pastel-border flex items-center justify-center mb-3">
                                <span className="text-[10px] font-black text-pastel-muted">#{i + 1}</span>
                              </div>
                              <span className="text-[10px] font-bold text-pastel-muted">等待中...</span>
                            </>
                          )}
                        </div>
                      ) : (
                        /* Error state */
                        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50/50 p-4">
                          <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
                          <span className="text-[10px] font-bold text-red-500 text-center">#{i + 1} 生成失败</span>
                          <span className="text-[8px] text-red-400 mt-1 text-center line-clamp-2">{item.error}</span>
                        </div>
                      )}
                    </div>

                    {/* Reference thumbnail below */}
                    <div
                      className="relative aspect-[3/4] rounded-xl border border-pastel-border bg-white shadow-sm overflow-hidden cursor-pointer hover:border-pastel-highlight transition-colors"
                      onClick={() => openPreview(item.refUrl, `动作参考 #${i + 1}`)}
                    >
                      <img src={item.refUrl} alt={`ref-${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                        <span className="text-[8px] font-bold text-white">参考 #{i + 1}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              <button type="button" onClick={() => downloadImage(preview.src, `${preview.title}-${Date.now()}.png`)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-black text-white transition-all hover:brightness-110 shadow-lg shadow-orange-500/20 active:scale-95">
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

export default ActionReferenceTab;
