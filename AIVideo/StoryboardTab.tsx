import React, { useState, useRef, useCallback } from 'react';
import { generateImageToImage, blobToBase64 } from '../Cyzx4/services/geminiService';
import { getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import {
  Clapperboard, Upload, Loader2, AlertCircle, X, Sparkles, Key,
  Image as ImageIcon, Download, Cpu, Grid3X3, LayoutGrid, Maximize2,
  Tag, ShoppingBag, Tv, Pencil, RefreshCw
} from 'lucide-react';
import { AspectRatio } from '../Cyzx4/types';

// 香蕉图标（复用）
const BananaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ color: '#fbbf24' }}>
    <path d="M4 11s2.5-3 6.5-3 7.5 5 7.5 5 1.5 6-3.5 8-10.5-2-10.5-2" />
    <path d="M15 3s-1.5 1-2 3" />
  </svg>
);

type GridMode = '3x3' | '4x4';
type StoryboardRatio = '9:16' | '16:9';

interface PanelState {
  storyboardPreview: string | null; // 从整体图裁切的预览
  generatedImage: string | null;    // 单独生成的高清图
  isGenerating: boolean;
  description: string;              // AI 生成的该格描述
}

const StoryboardTab: React.FC = () => {
  // 产品信息
  const [productName, setProductName] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [contentDescription, setContentDescription] = useState('');

  // 产品图
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [productUrls, setProductUrls] = useState<string[]>([]);

  // 配置
  const [gridMode, setGridMode] = useState<GridMode>('3x3');
  const [ratio, setRatio] = useState<StoryboardRatio>('16:9');
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-image-preview');

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyboardImage, setStoryboardImage] = useState<string | null>(null);
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  // 交互状态
  const [hoveredPanel, setHoveredPanel] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [editingPanel, setEditingPanel] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  const productInputRef = useRef<HTMLInputElement>(null);

  const panelCount = gridMode === '3x3' ? 9 : 16;
  const gridCols = gridMode === '3x3' ? 3 : 4;
  const gridRows = gridMode === '3x3' ? 3 : 4;

  // 产品图操作
  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (productFiles.length + files.length > 6) {
        setError('产品图最多6张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setProductFiles(prev => [...prev, ...files]);
      setProductUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeProductImage = (idx: number) => {
    URL.revokeObjectURL(productUrls[idx]);
    setProductFiles(prev => prev.filter((_, i) => i !== idx));
    setProductUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // 构建分镜 Prompt
  const buildStoryboardPrompt = () => {
    const gridLabel = gridMode === '3x3' ? '3×3 九宫格' : '4×4 十六宫格';
    const panelList = Array.from({ length: panelCount }, (_, i) => `[Panel ${i + 1}]: [自动适配的电影级分镜画面]`).join('\n');

    return `
**角色**: 你是一位资深跨境电商 TVC 广告分镜师。
**任务**: 根据以下产品信息，直接生成一张高质量的 ${gridLabel} 电影级分镜图。

**产品名称**: ${productName}
**产品卖点**: ${sellingPoints}
**展示内容/风格**: ${contentDescription || '电商广告大片风格'}

**生成要求**:
- 生成一张 ${ratio} 画幅的 ${gridLabel} 分镜图 (cohesive ${gridMode === '3x3' ? '3x3' : '4x4'} grid storyboard image)
- 8K 分辨率, 电影级广告质感, 照片级写实
- 严格保持产品外观、光线氛围、色彩基调在所有面板中绝对一致
- 每个面板使用不同的电影级景别（微距、特写、中景、广角、俯拍、侧拍等）
- 面板之间具有丰富的视觉节奏和叙事逻辑
- 如果提供了产品图片，必须确保生成的产品与参考图完全一致
    `.trim();
  };

  // 生成整体分镜图
  const handleGenerate = async () => {
    if (!productName.trim()) {
      setError('请输入产品名称');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setStoryboardImage(null);
    setPanels([]);

    try {
      // 准备产品图
      setProgress('正在处理产品图...');
      const productImagesData: { base64: string; mimeType: string }[] = [];
      for (const file of productFiles) {
        const base64 = await blobToBase64(file);
        productImagesData.push({ base64, mimeType: file.type });
      }

      const prompt = buildStoryboardPrompt();
      const aspectRatio = ratio === '16:9' ? AspectRatio.LANDSCAPE_16_9 : AspectRatio.PORTRAIT_9_16;

      setProgress('正在生成分镜图 (预计 60-120 秒)...');
      const results = await generateImageToImage(
        productImagesData,
        prompt,
        { aspectRatio, resolution: '1K' as any, modelId: selectedModel }
      );

      if (results.length > 0) {
        setStoryboardImage(results[0]);
        // 初始化面板状态
        setPanels(Array.from({ length: panelCount }, () => ({
          storyboardPreview: null,
          generatedImage: null,
          isGenerating: false,
          description: ''
        })));
        setProgress('分镜图生成完成！点击任意格子可生成高清单张。');
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  // 生成单张分镜图
  const handleGenerateSingle = async (panelIndex: number, customPrompt?: string) => {
    if (!storyboardImage) return;

    setPanels(prev => prev.map((p, i) =>
      i === panelIndex ? { ...p, isGenerating: true } : p
    ));

    try {
      const productImagesData: { base64: string; mimeType: string }[] = [];
      for (const file of productFiles) {
        const base64 = await blobToBase64(file);
        productImagesData.push({ base64, mimeType: file.type });
      }

      // 提取整体分镜图 base64
      const storyboardBase64 = storyboardImage.split(',')[1];
      const allImages = [
        { base64: storyboardBase64, mimeType: 'image/png' },
        ...productImagesData
      ];

      const panelNum = panelIndex + 1;
      const singlePrompt = customPrompt || `
基于这张分镜图中第 ${panelNum} 格的画面，生成一张独立的高质量单张图片。
产品：${productName}
要求：
- 精确还原分镜图中第 ${panelNum} 格的构图、景别、光线和氛围
- 产品外观必须与参考产品图完全一致
- 8K 电影级质感，广告大片级别画质
- 保持与整体分镜图一致的视觉风格
      `.trim();

      const aspectRatio = ratio === '16:9' ? AspectRatio.LANDSCAPE_16_9 : AspectRatio.PORTRAIT_9_16;
      const results = await generateImageToImage(
        allImages,
        singlePrompt,
        { aspectRatio, resolution: '1K' as any, modelId: selectedModel }
      );

      if (results.length > 0) {
        setPanels(prev => prev.map((p, i) =>
          i === panelIndex ? { ...p, generatedImage: results[0], isGenerating: false } : p
        ));
      }
    } catch (err: any) {
      setError(`第 ${panelIndex + 1} 格生成失败: ${getErrorMessage(err)}`);
      setPanels(prev => prev.map((p, i) =>
        i === panelIndex ? { ...p, isGenerating: false } : p
      ));
    }

    setEditingPanel(null);
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-pastel-bg text-pastel-text">
      {/* Header */}
      <div className="px-6 py-4 bg-pastel-card border-b border-pastel-border flex items-center justify-between shrink-0">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-pastel-text">
          <Clapperboard className="w-5 h-5 text-pastel-highlight" />
          分镜创作 (Storyboard)
        </h2>
        <div className="text-sm text-pastel-muted">
          产品信息 → 选择宫格 → 生成分镜 → 点击生成单张
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full min-h-[600px]">

          {/* Left: Input Panel (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">

            {/* 产品信息 */}
            <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
              <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> 产品名称 *
              </label>
              <input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="例如：便携式筋膜枪 Pro Max"
                className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all"
              />
            </div>

            <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
              <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> 产品卖点
              </label>
              <textarea
                value={sellingPoints}
                onChange={e => setSellingPoints(e.target.value)}
                placeholder="例如：超静音电机、6 档可调、Type-C 快充、航空级铝合金机身"
                className="w-full min-h-[70px] bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm outline-none resize-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all"
              />
            </div>

            <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
              <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5" /> 展现内容/风格
              </label>
              <textarea
                value={contentDescription}
                onChange={e => setContentDescription(e.target.value)}
                placeholder="例如：暗色系科技感、运动场景、生活方式..."
                className="w-full min-h-[70px] bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm outline-none resize-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all"
              />
            </div>

            {/* 产品图固定区 */}
            <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
              <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> 产品图固定（多角度，确保一致性）
              </label>
              <div className="flex flex-wrap gap-2">
                {productUrls.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-pastel-border group/pimg">
                    <img src={url} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5">
                      {['正面', '侧面', '背面', '俯视', '细节', '场景'][idx] || `角度${idx + 1}`}
                    </div>
                    <button
                      onClick={() => removeProductImage(idx)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/pimg:opacity-100 transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {productFiles.length < 6 && (
                  <button
                    onClick={() => productInputRef.current?.click()}
                    className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-pastel-bg hover:border-pastel-highlight/50 transition-colors text-pastel-muted hover:text-pastel-highlight"
                  >
                    <Upload className="w-4 h-4 mb-0.5 opacity-50" />
                    <span className="text-[8px]">添加</span>
                  </button>
                )}
              </div>
              <input ref={productInputRef} type="file" multiple accept="image/*" onChange={handleProductUpload} className="hidden" />
              {productFiles.length > 0 && <p className="text-[10px] text-pastel-muted mt-1.5">已固定 {productFiles.length} 张产品图</p>}
            </div>

            {/* 模式 + 比例 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl border border-pastel-border shadow-sm">
                <label className="block text-[10px] font-bold text-pastel-muted mb-2">宫格模式</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGridMode('3x3')}
                    className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-bold transition-all ${gridMode === '3x3' ? 'border-orange-400 bg-orange-50 text-orange-700 ring-1 ring-orange-200' : 'border-pastel-border bg-pastel-bg text-pastel-muted hover:border-orange-200'}`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    九宫格
                  </button>
                  <button
                    onClick={() => setGridMode('4x4')}
                    className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-bold transition-all ${gridMode === '4x4' ? 'border-orange-400 bg-orange-50 text-orange-700 ring-1 ring-orange-200' : 'border-pastel-border bg-pastel-bg text-pastel-muted hover:border-orange-200'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    十六宫格
                  </button>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-pastel-border shadow-sm">
                <label className="block text-[10px] font-bold text-pastel-muted mb-2">画幅比例</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRatio('16:9')}
                    className={`flex-1 p-2 rounded-lg border text-xs font-bold transition-all ${ratio === '16:9' ? 'border-purple-400 bg-purple-50 text-purple-700 ring-1 ring-purple-200' : 'border-pastel-border bg-pastel-bg text-pastel-muted hover:border-purple-200'}`}
                  >
                    16:9
                  </button>
                  <button
                    onClick={() => setRatio('9:16')}
                    className={`flex-1 p-2 rounded-lg border text-xs font-bold transition-all ${ratio === '9:16' ? 'border-purple-400 bg-purple-50 text-purple-700 ring-1 ring-purple-200' : 'border-pastel-border bg-pastel-bg text-pastel-muted hover:border-purple-200'}`}
                  >
                    9:16
                  </button>
                </div>
              </div>
            </div>

            {/* 模型选择 */}
            <div className="bg-white p-3 rounded-xl border border-pastel-border shadow-sm">
              <label className="block text-[10px] font-bold text-pastel-muted mb-2 flex items-center gap-1"><Cpu className="w-3 h-3" /> 图像模型</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')} className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-bold transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700 ring-1 ring-purple-100' : 'border-pastel-border bg-pastel-bg text-pastel-muted'}`}>
                  <BananaIcon className="w-3.5 h-3.5" /> Nano Banana 2
                </button>
                <button onClick={() => setSelectedModel('gemini-3-pro-image-preview')} className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-bold transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700 ring-1 ring-purple-100' : 'border-pastel-border bg-pastel-bg text-pastel-muted'}`}>
                  <BananaIcon className="w-3.5 h-3.5" /> Nano Banana Pro
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="flex-1">{error}</p>
              </div>
            )}

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={!productName.trim() || isGenerating}
              className={`w-full py-3.5 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${!productName.trim() || isGenerating
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-orange-500/25 hover:shadow-orange-500/40 hover:brightness-105'
                }`}
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clapperboard className="w-5 h-5" />}
              {isGenerating ? '正在生成分镜...' : `生成${gridMode === '3x3' ? '九宫格' : '十六宫格'}分镜`}
            </button>
          </div>

          {/* Right: Grid Panel (3 cols) */}
          <div className="lg:col-span-3 flex flex-col bg-pastel-card rounded-xl border border-pastel-border p-5 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-pastel-text flex items-center gap-2">
                <Clapperboard className="w-5 h-5 text-pastel-highlight" />
                分镜面板
              </h3>
              {progress && <span className="text-xs text-pastel-muted">{progress}</span>}
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden">
              {storyboardImage ? (
                <div className="w-full h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                  {/* 整体分镜预览 */}
                  <div className="relative rounded-lg overflow-hidden border border-pastel-border shadow-md group/full">
                    <img src={storyboardImage} alt="Storyboard" className="w-full h-auto" />
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/full:opacity-100 transition-opacity">
                      <button onClick={() => setZoomImage(storyboardImage)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-all">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => downloadImage(storyboardImage, `storyboard_${gridMode}_${Date.now()}.png`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-all">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 宫格交互网格 */}
                  <div className="mt-2">
                    <h4 className="text-xs font-bold text-pastel-muted mb-2">🎬 点击格子生成独立高清分镜：</h4>
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
                    >
                      {panels.map((panel, idx) => (
                        <div
                          key={idx}
                          className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 group/panel ${
                            hoveredPanel === idx
                              ? 'border-orange-400 shadow-lg shadow-orange-200/50 scale-[1.02] z-10'
                              : 'border-pastel-border hover:border-orange-300'
                          } ${panel.generatedImage ? 'bg-white' : 'bg-pastel-bg'}`}
                          style={{ aspectRatio: ratio === '16:9' ? '16/9' : '9/16' }}
                          onMouseEnter={() => setHoveredPanel(idx)}
                          onMouseLeave={() => setHoveredPanel(null)}
                          onClick={() => {
                            if (panel.isGenerating) return;
                            if (panel.generatedImage) {
                              setZoomImage(panel.generatedImage);
                            } else {
                              setEditingPanel(idx);
                            }
                          }}
                        >
                          {/* 格子内容 */}
                          {panel.generatedImage ? (
                            <img src={panel.generatedImage} alt={`Panel ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : panel.isGenerating ? (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-pastel-highlight mb-1" />
                              <span className="text-[9px] text-pastel-muted">生成中...</span>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2">
                              <span className="text-lg font-black text-pastel-border">{idx + 1}</span>
                              <span className="text-[8px] text-pastel-muted mt-1">点击生成</span>
                            </div>
                          )}

                          {/* Hover 高亮覆盖层 */}
                          {hoveredPanel === idx && !panel.isGenerating && (
                            <div className="absolute inset-0 bg-gradient-to-t from-orange-500/30 to-transparent flex items-end justify-center pb-2 transition-all">
                              <span className="text-[10px] font-bold text-white bg-black/40 px-2 py-0.5 rounded-full">
                                {panel.generatedImage ? '🔍 查看大图' : '🎨 生成单张'}
                              </span>
                            </div>
                          )}

                          {/* 已生成标记 */}
                          {panel.generatedImage && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-[8px]">✓</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-pastel-muted">
                  <div className="w-24 h-24 bg-pastel-bg border-2 border-dashed border-pastel-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Clapperboard className="w-12 h-12 text-pastel-border" />
                  </div>
                  <p className="text-sm">
                    {isGenerating && progress ? progress : '分镜图将显示在这里'}
                  </p>
                  {isGenerating && (
                    <div className="mt-4 flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-pastel-highlight" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 单格编辑弹窗 */}
      {editingPanel !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8 animate-in fade-in duration-200"
          onClick={() => setEditingPanel(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-pastel-text mb-4 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-pastel-highlight" />
              第 {editingPanel + 1} 格 — 生成/修改
            </h3>
            <textarea
              value={editPrompt}
              onChange={e => setEditPrompt(e.target.value)}
              placeholder="可选：描述这个格子要生成什么画面...（留空则自动按分镜逻辑生成）"
              className="w-full min-h-[100px] bg-pastel-bg border border-pastel-border rounded-xl p-3 text-sm outline-none resize-none focus:ring-2 focus:ring-pastel-highlight/30 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditingPanel(null)}
                className="flex-1 py-2.5 rounded-xl border border-pastel-border text-sm font-medium text-pastel-muted hover:bg-pastel-bg transition-all"
              >
                取消
              </button>
              <button
                onClick={() => handleGenerateSingle(editingPanel, editPrompt.trim() || undefined)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm font-bold hover:brightness-105 transition-all"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> 生成
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8 animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomImage}
            alt="Zoomed"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => downloadImage(zoomImage, `storyboard_panel_${Date.now()}.png`)}
            className="absolute bottom-6 right-6 flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Download className="w-4 h-4" /> 下载
          </button>
        </div>
      )}
    </div>
  );
};

export default StoryboardTab;
