import React, { useRef, useState } from 'react';
import {
  Download,
  Eye,
  Loader2,
  Maximize2,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Scissors,
  Shirt,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
  Cpu,
  Ratio,
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';
import { storageService } from '../services/storageService';

type ResultItem = {
  sourceIndex: number;
  sourceUrl: string;
  resultUrl: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
};

type PreviewState = {
  src: string;
  title: string;
  subtitle?: string;
} | null;

const MAX_SOURCES = 10;

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

const whiteCanvasStyle: React.CSSProperties = {
  backgroundColor: '#fff',
};

const buildExtractionPrompt = () => `
Perform an exact in-place garment extraction from the provided original image.

ABSOLUTE GOAL:
- Keep the clothing exactly where it is in the original image.
- Preserve the original camera angle, pose-driven shape, perspective, folds, stretch, wrinkles, drape, shadows on the fabric, and occlusion contours.
- Do NOT straighten, rotate, recenter, resize, redraw, complete, beautify, or redesign the clothing.
- The output must look like the original image with every non-clothing pixel painted pure white.

KEEP ONLY:
- all visible clothing pixels exactly as they appear in the source image, including tops, pants, skirts, dresses, coats, visible layered garments, hems, seams, buttons, zippers, labels, embroidery, prints, color, fabric texture, folds, drape, wrinkles, and construction details.
- if multiple garments are worn together in the image, keep them in their original relative positions and original shapes.

REMOVE COMPLETELY:
- every non-clothing element: human body, skin, face, head, hair, hands, arms, legs, feet, background, room, studio, floor, props, accessories, jewelry, bag, phone, hanger, mannequin, text, watermark, logo overlays, UI elements.
- for areas hidden by the body, hair, arms, hands, face, props, or background, do not hallucinate missing fabric; replace those removed/occluded areas with pure white.

OUTPUT:
- same garment placement and angle as the original source image.
- pure white background (#FFFFFF), not transparent, not checkerboard.
- no person, no body parts, no mannequin, no hanger, no extra objects.
- preserve pixel-level alignment as closely as possible; the garment mask must match the original clothing boundary with no visible offset.
`;

const buildCleanupPrompt = () => `
Clean up this garment extraction result with strict in-place masking.

TASK:
- Keep only clothing pixels that are already visible in this image.
- Paint every remaining non-clothing pixel pure white (#FFFFFF).

REMOVE ANY LEFTOVER:
- face, neck, chin, shoulders, arms, elbows, wrists, hands, fingers, torso skin, waist skin, legs, feet, hair, skin-colored patches.
- jewelry, necklace, earrings, straps that are not part of the garment, bags, props, background, shadows outside the garment.

DO NOT CHANGE THE CLOTHING:
- Do not move, rotate, resize, straighten, recenter, redraw, complete, smooth, or redesign any garment.
- Do not fill missing fabric where a body part or object was removed; those areas must stay pure white.
- Preserve the existing garment edges, folds, seams, texture, color, pants/top overlap, and original pose-driven shape.

OUTPUT:
- Same canvas, same garment location, pure white background only.
- No human parts or extra elements should remain.
`;

const dataUrlToImageReference = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const OriginalGarmentExtractTab: React.FC = () => {
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [preview, setPreview] = useState<PreviewState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addSourceFiles = (files: File[]) => {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const remaining = MAX_SOURCES - sourceFiles.length;
    const allowedFiles = validFiles.slice(0, remaining);
    if (allowedFiles.length === 0) return;

    setSourceFiles(prev => [...prev, ...allowedFiles]);
    setSourceUrls(prev => [...prev, ...allowedFiles.map(file => URL.createObjectURL(file))]);
    setResults([]);
  };

  useImagePaste((files) => addSourceFiles(files));

  const handleSourceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addSourceFiles(Array.from(event.target.files));
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files) addSourceFiles(Array.from(event.dataTransfer.files));
  };

  const removeSource = (index: number) => {
    setSourceFiles(prev => prev.filter((_, i) => i !== index));
    setSourceUrls(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index]);
      next.splice(index, 1);
      return next;
    });
    setResults([]);
  };

  const clearSources = () => {
    sourceUrls.forEach(url => URL.revokeObjectURL(url));
    setSourceFiles([]);
    setSourceUrls([]);
    setResults([]);
  };

  const performSingleExtraction = async (index: number) => {
    try {
      setResults(prev => prev.map((result, i) => (
        i === index ? { ...result, status: 'generating', error: undefined } : result
      )));

      const sourceFile = sourceFiles[index];
      if (!sourceFile) throw new Error('Source image not found.');

      const compressed = await compressImage(sourceFile, 2048, 0.96);
      const inputImages = [{ base64: compressed.base64, mimeType: compressed.mime }];
      const fallbackModels = [
        selectedModel,
        selectedModel === 'gemini-3.1-flash-image-preview'
          ? 'gemini-3-pro-image-preview'
          : 'gemini-3.1-flash-image-preview',
      ] as const;

      let output: string[] = [];
      let lastError: any = null;
      let successfulModelId = selectedModel;

      for (const modelId of fallbackModels) {
        try {
          output = await generateImageToImage(
            inputImages,
            buildExtractionPrompt(),
            {
              modelId,
              aspectRatio: outputAspectRatio,
              resolution,
              workflowHint: 'garment-extraction',
              negativePrompt:
                'person, human, face, head, hair, hands, arms, legs, feet, skin, mannequin, hanger, background, floor, wall, props, jewelry, bag, phone, watermark, text, logo, transparent background, checkerboard background, centered product cutout, recentered garment, rotated garment, straightened garment, resized garment, completed missing fabric, invented clothing, duplicate garments, changed garment design, altered color, simplified fabric texture',
            }
          );
          if (output.length > 0) {
            successfulModelId = modelId;
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn(`[GarmentExtract] Model ${modelId} failed:`, error);
        }
      }

      if (output.length === 0) {
        throw new Error(`Extraction failed: ${getErrorMessage(lastError)}`);
      }

      const cleanupInput = dataUrlToImageReference(output[0]);
      if (cleanupInput) {
        try {
          const cleanedOutput = await generateImageToImage(
            [cleanupInput],
            buildCleanupPrompt(),
            {
              modelId: successfulModelId,
              aspectRatio: outputAspectRatio,
              resolution,
              workflowHint: 'garment-extraction',
              negativePrompt:
                'face, neck, chin, shoulder skin, arm, hand, finger, skin, hair, torso, leg, foot, jewelry, necklace, earring, bag, prop, background, non-white background, transparent background, checkerboard background, moved garment, rotated garment, recentered garment, completed missing fabric, invented fabric, changed garment design',
            }
          );
          if (cleanedOutput.length > 0) {
            output = cleanedOutput;
          }
        } catch (cleanupError) {
          console.warn(`[GarmentExtract] Cleanup pass failed for source ${index + 1}:`, cleanupError);
        }
      }

      setResults(prev => prev.map((result, i) => (
        i === index ? { ...result, status: 'done', resultUrl: output[0] } : result
      )));

      try {
        await storageService.saveProject({
          id: crypto.randomUUID(),
          type: 'MODEL',
          createdAt: Date.now(),
          thumbnail: output[0],
          assets: {
            original: [sourceUrls[index]],
            generated: output,
          },
          metadata: {
            subType: 'original_garment_extract',
            resolution,
            aspectRatio: outputAspectRatio,
            modelId: selectedModel,
          },
        });
      } catch (error) {
        console.error('Failed to save garment extraction project', error);
      }
    } catch (error: any) {
      console.error(`[GarmentExtract] Source ${index + 1} failed:`, error);
      setResults(prev => prev.map((result, i) => (
        i === index ? { ...result, status: 'error', error: getErrorMessage(error) } : result
      )));
    }
  };

  const handleGenerate = async () => {
    if (sourceFiles.length === 0) {
      alert('请先上传原图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('正在批量提取原图服装...');
    setResults(sourceUrls.map((url, index) => ({
      sourceIndex: index,
      sourceUrl: url,
      resultUrl: null,
      status: 'pending',
    })));

    try {
      await Promise.all(sourceFiles.map((_, index) => performSingleExtraction(index)));
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleRegenerateSingle = async (index: number) => {
    await performSingleExtraction(index);
  };

  const downloadAllResults = () => {
    results.forEach((item, index) => {
      if (!item.resultUrl) return;
      setTimeout(() => {
        const anchor = document.createElement('a');
        anchor.href = item.resultUrl!;
        anchor.download = `original-garment-extract-${index + 1}-${Date.now()}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }, index * 250);
    });
  };

  const doneCount = results.filter(result => result.status === 'done').length;

  return (
    <div className="flex h-full bg-pastel-bg overflow-hidden text-pastel-text">
      <div className="w-[420px] border-r border-pastel-border bg-pastel-card flex flex-col overflow-y-auto custom-scrollbar shadow-sm z-10">
        <div className="p-6 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Shirt className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Garment Extract</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">原图服装提取</h2>
            <p className="text-xs text-pastel-muted leading-relaxed">
              批量上传模特原图，AI 将按原位置和原角度保留衣服，其他所有元素直接变为纯白底。生成后会自动二次清理残留的人体、皮肤、头发和配饰。
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-3 h-3" />
                1. 批量上传原图 ({sourceFiles.length}/{MAX_SOURCES})
              </h3>
              {sourceFiles.length > 0 && (
                <button
                  type="button"
                  onClick={clearSources}
                  className="text-[10px] text-pastel-highlight hover:underline font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  清空
                </button>
              )}
            </div>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="space-y-4"
            >
              {sourceUrls.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {sourceUrls.map((url, index) => (
                    <div key={url} className="relative aspect-square rounded-lg border border-pastel-border overflow-hidden group bg-white shadow-sm">
                      <img src={url} className="w-full h-full object-cover" alt={`source-${index + 1}`} />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">
                        #{index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSource(index)}
                        className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {sourceFiles.length < MAX_SOURCES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-pastel-border flex items-center justify-center text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-all bg-white/50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {sourceFiles.length === 0 && (
                <label className="flex flex-col items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed border-pastel-border bg-white hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group shadow-inner">
                  <input type="file" multiple className="hidden" onChange={handleSourceChange} accept="image/*" />
                  <div className="w-12 h-12 mb-3 bg-pastel-bg rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold">批量上传含服装的原图</span>
                  <span className="text-[10px] text-pastel-muted mt-1">支持拖拽、粘贴或点击上传，最多 10 张</span>
                </label>
              )}
              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleSourceChange} accept="image/*" />
            </div>
          </div>

          <div className="space-y-6 pt-4 border-t border-pastel-border">
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Ratio className="w-3 h-3" />
                输出比例
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: AspectRatio.SQUARE, label: '1:1', desc: '单品' },
                  { value: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '竖版' },
                  { value: AspectRatio.PORTRAIT_4_5, label: '4:5', desc: '电商' },
                  { value: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '修长' },
                ].map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setOutputAspectRatio(item.value)}
                    className={`rounded-xl border py-2 text-center transition-all ${
                      outputAspectRatio === item.value
                        ? 'bg-pastel-pink border-pastel-border text-pastel-text shadow-sm'
                        : 'bg-white text-pastel-muted border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <MonitorSmartphone className="w-3 h-3" />
                清晰度
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: ImageResolution.RES_1K, label: '1K', desc: '快速' },
                  { value: ImageResolution.RES_2K, label: '2K', desc: '高清' },
                  { value: ImageResolution.RES_4K, label: '4K', desc: '精细' },
                ].map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setResolution(item.value)}
                    className={`rounded-xl border py-2 text-center transition-all ${
                      resolution === item.value
                        ? 'bg-pastel-pink border-pastel-border text-pastel-text shadow-sm'
                        : 'bg-white text-pastel-muted border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-pastel-border shadow-sm space-y-3">
              <label className="block text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> 图像模型选择
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', version: '3.1 Flash' },
                  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', version: '3.0 Pro' },
                  { id: 'gpt-image-2', label: 'GPT Image 2', version: 'Ultra Quality' },
                ].map(model => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModel(model.id)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      selectedModel === model.id
                        ? 'border-purple-300 bg-purple-50 ring-2 ring-purple-100'
                        : 'border-gray-100 bg-pastel-bg'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {model.id === 'gpt-image-2'
                        ? <Sparkles className="w-3 h-3 text-orange-500" />
                        : <BananaIcon className="w-3 h-3" />}
                      <span className={`text-[10px] font-black ${selectedModel === model.id ? 'text-purple-700' : 'text-pastel-text'}`}>
                        {model.label}
                      </span>
                    </div>
                    <span className="text-[8px] text-pastel-muted font-bold">{model.version}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-pastel-border bg-white/70 p-4 text-xs text-pastel-muted leading-relaxed">
              <div className="flex items-center gap-2 font-black text-pastel-text mb-1">
                <Eye className="w-3.5 h-3.5 text-pastel-highlight" />
                输出说明
              </div>
              输出为纯白底 PNG。衣服会尽量保持在原图中的位置、角度、褶皱和遮挡边界，非衣服区域全部留白；系统会再跑一次清理，专门擦除残留皮肤、脸、手臂、头发和饰品。
            </div>
          </div>
        </div>

        <div className="p-6 mt-auto border-t border-pastel-border bg-white/50 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || sourceFiles.length === 0}
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:bg-slate-900 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {statusMessage || '正在提取...'}</>
            ) : (
              <><Zap className="w-5 h-5 fill-white" /> 一键批量提取 ({sourceFiles.length}张)</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white/30 backdrop-blur-[2px]">
        {results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-pastel-muted text-center max-w-sm mx-auto">
            <div className="w-24 h-24 mb-6 bg-white rounded-[40px] shadow-sm border border-pastel-border flex items-center justify-center opacity-40">
              <Shirt className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-pastel-text mb-2">等待上传并提取</h3>
            <p className="text-xs leading-relaxed">上传原图后，系统将按原位置保留图中的服装，其他区域直接变为纯白底 PNG。</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Scissors className="w-5 h-5 text-pastel-highlight" />
                提取结果 ({doneCount}/{results.length})
              </h2>
              {doneCount > 0 && (
                <button
                  type="button"
                  onClick={downloadAllResults}
                  className="text-xs font-bold flex items-center gap-2 bg-white border border-pastel-border text-pastel-text px-4 py-2 rounded-lg hover:bg-pastel-bg hover:text-pastel-highlight transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  全部下载
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {results.map((item, index) => (
                <div key={index} className="group relative bg-white rounded-3xl border border-pastel-border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-xl animate-in fade-in zoom-in-95 duration-300">
                  <div className="aspect-square relative overflow-hidden" style={whiteCanvasStyle}>
                    {item.status === 'pending' || item.status === 'generating' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70">
                        <div className="w-8 h-8 rounded-full border-4 border-pastel-highlight/20 border-t-pastel-highlight animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-pastel-muted animate-pulse">
                          {item.status === 'pending' ? 'Pending...' : 'Extracting...'}
                        </span>
                      </div>
                    ) : item.status === 'error' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-red-50">
                        <X className="w-8 h-8 text-red-500 mb-2" />
                        <span className="text-[10px] text-red-500 font-bold leading-tight">{item.error}</span>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingle(index)}
                          className="mt-4 px-4 py-2 bg-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-pastel-bg transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <img src={item.resultUrl!} className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-105" alt={`result-${index + 1}`} />
                    )}

                    <div className="absolute top-3 left-3 w-8 h-8 rounded-lg border border-white shadow-md overflow-hidden z-10">
                      <img src={item.sourceUrl} className="w-full h-full object-cover" alt={`source-${index + 1}`} />
                    </div>

                    {item.status === 'done' && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                        <button
                          type="button"
                          onClick={() => setPreview({ src: item.resultUrl!, title: `服装提取结果 #${index + 1}` })}
                          className="p-2.5 bg-white rounded-full hover:scale-110 transition-transform shadow-xl"
                        >
                          <Maximize2 className="w-4 h-4 text-slate-800" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingle(index)}
                          className="p-2.5 bg-white rounded-full hover:scale-110 transition-transform shadow-xl"
                        >
                          <RefreshCw className="w-4 h-4 text-slate-800" />
                        </button>
                        <a
                          href={item.resultUrl!}
                          download={`original-garment-extract-${index + 1}.png`}
                          className="p-2.5 bg-pastel-highlight rounded-full hover:scale-110 transition-transform shadow-xl text-white"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex items-center justify-between border-t border-pastel-border bg-white">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-pastel-pink rounded-md text-pastel-text">
                        <Shirt className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-pastel-text leading-tight">原图服装 #{index + 1}</span>
                        <span className="text-[8px] text-pastel-muted">PNG cutout</span>
                      </div>
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-wider ${item.status === 'done' ? 'text-green-500' : 'text-pastel-muted'}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md" onClick={() => setPreview(null)}>
          <div className="relative max-w-full max-h-full flex flex-col items-center" onClick={event => event.stopPropagation()}>
            <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white">
              <div className="flex flex-col">
                <span className="font-bold text-lg">{preview.title}</span>
                {preview.subtitle && <span className="text-sm opacity-80">{preview.subtitle}</span>}
              </div>
              <button type="button" onClick={() => setPreview(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="rounded-2xl border-4 border-white/10 shadow-2xl overflow-hidden" style={whiteCanvasStyle}>
              <img src={preview.src} className="max-w-full max-h-[85vh] object-contain" alt="Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OriginalGarmentExtractTab;
