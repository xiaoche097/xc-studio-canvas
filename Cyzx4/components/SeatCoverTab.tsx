import React, { useState } from 'react';
import { generateSeatCoverFit, blobToBase64, compressImage } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import { CarFront, Upload, Loader2, AlertCircle, Eye, Image as ImageIcon, Sparkles, Check, Monitor, Grid, Key, ChevronDown, Maximize2, Download, RefreshCw, X, Box } from 'lucide-react';
import { storageService } from '../../services/storageService';

const anglePresets = [
  {
    group: "单品座椅 (Single Seat)",
    options: [
      { id: "S1 Front View", label: "S1 - 正面视角 (Front View)", thumb: "/thumbnails/thumb_s1.webp" },
      { id: "S2 3/4 Front Angle", label: "S2 - 3/4侧前视角 (3/4 Front)", thumb: "/thumbnails/thumb_s2.webp" },
      { id: "S3 Rear 3/4 View", label: "S3 - 背面视角 (Rear 3/4)", thumb: "/thumbnails/thumb_s3.webp" }
    ]
  },
  {
    group: "整套座椅 (Full Set)",
    options: [
      { id: "SET1 Side View Left", label: "SET1 - 侧面左侧 (Side Left)", thumb: "/thumbnails/thumb_set1.webp" },
      { id: "SET2 Side View Right", label: "SET2 - 侧面右侧 (Side Right)", thumb: "/thumbnails/thumb_set2.webp" }
    ]
  },
  {
    group: "车内前排 (Front Interior)",
    options: [
      { id: "F1 High-Angle Top-Down", label: "F1 - 高角度俯视 (Main/Top-down)", thumb: "/thumbnails/thumb_f1.webp" },
      { id: "F2 Driver Side Profile", label: "F2 - 主驾侧平视 (Driver Profile)", thumb: "/thumbnails/thumb_f2.webp" },
      { id: "F3 Passenger Front-Quarter", label: "F3 - 副驾侧斜前 (Passenger Front)", thumb: "/thumbnails/thumb_f3.webp" },
      { id: "F4 Rear-to-Front View", label: "F4 - 后排看前排 (Rear-to-Front)", thumb: "/thumbnails/thumb_f4.webp" }
    ]
  },
  {
    group: "车内后排 (Rear Interior)",
    options: [
      { id: "R6 Rear 3/4 View", label: "R6 - 后侧3/4视角 (Rear 3/4)", thumb: "/thumbnails/thumb_r6.webp" },
      { id: "R1 Rear Front Close-up", label: "R1 - 后排正面特写 (Front Close-up)", thumb: "/thumbnails/thumb_r1.webp" },
      { id: "R2 Rear Side Left", label: "R2 - 后排左侧 (Rear Left)", thumb: "/thumbnails/thumb_r2.webp" },
      { id: "R3 Rear Side Right", label: "R3 - 后排右侧 (Rear Right)", thumb: "/thumbnails/thumb_r3.webp" },
      { id: "R4 Rear Folded View", label: "R4 - 后排平放折叠 (Seats Fold-Flat)", thumb: "/thumbnails/thumb_r4.webp" },
      { id: "R7 Rear Tip-Up View", label: "R7 - 后排坐垫翻起 (Seats Tip-Up)", thumb: "/thumbnails/thumb_r7.webp" },
      { id: "R5 Top-Down Reclined", label: "R5 - 高角度俯视放倒 (Top-Down Reclined)", thumb: "/thumbnails/thumb_r5.webp" }
    ]
  },
  {
    group: "扶手箱 (Armrest Box)",
    options: [
      { id: "A0 Armrest Front", label: "A0 - 单品正面视角 (Front Product)", thumb: "/thumbnails/thumb_a0.svg" },
      { id: "A1 Armrest 3/4 Front", label: "A1 - 单品3/4视角 (3/4 Front Product)", thumb: "/thumbnails/thumb_a1.svg" },
      { id: "A2 Armrest Top-Down 60", label: "A2 - 俯视60° (Top-Down 60°)", thumb: "/thumbnails/thumb_a2.svg" },
      { id: "A3 Armrest Passenger Side", label: "A3 - 副驾侧平视 (Passenger Side Eye-Level)", thumb: "/thumbnails/thumb_a3.svg" },
      { id: "A4 Armrest Passenger Front 30", label: "A4 - 副驾侧前30° (Passenger Front 30°)", thumb: "/thumbnails/thumb_a4.svg" },
      { id: "A5 Armrest Passenger Side 90", label: "A5 - 副驾正侧面 (Passenger Side 90°)", thumb: "/thumbnails/thumb_a5.svg" },
      { id: "A6 Armrest Passenger Wheel", label: "A6 - 副驾侧含方向盘 (Passenger Side w/ Wheel)", thumb: "/thumbnails/thumb_a6.svg" },
      { id: "A7 Armrest Top Rear 50", label: "A7 - 俯视后侧50°特写 (Top Rear 50° Close-up)", thumb: "/thumbnails/thumb_a7.svg" },
      { id: "A8 Armrest Top-Down 45", label: "A8 - 俯视45° (Top-Down 45°)", thumb: "/thumbnails/thumb_a8.svg" },
      { id: "A9 Armrest Rear View", label: "A9 - 后排向前视角 (Rear to Front)", thumb: "/thumbnails/thumb_a9.svg" }
    ]
  }
];

const SeatCoverTab: React.FC = () => {
  const [seatFiles, setSeatFiles] = useState<File[]>([]);
  const [seatPreviews, setSeatPreviews] = useState<string[]>([]);
  const [carModel, setCarModel] = useState('');
  const [year, setYear] = useState('');
  const [seatConfig, setSeatConfig] = useState('5-Seater');
  const [productCategory, setProductCategory] = useState('Seat Cover'); // New State
  const [targetRow, setTargetRow] = useState('F1 High-Angle Top-Down');
  const [angleMode, setAngleMode] = useState<'PRESET' | 'REFERENCE'>('PRESET');
  const [anglePreset, setAnglePreset] = useState("Follow Focus Row");
  const [angleRefFiles, setAngleRefFiles] = useState<File[]>([]);
  const [angleRefPreviews, setAngleRefPreviews] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [qualityMode, setQualityMode] = useState<ImageResolution>(ImageResolution.RES_1K);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTargetRowOpen, setIsTargetRowOpen] = useState(false);
  const [hoveredTargetThumb, setHoveredTargetThumb] = useState<string | null>(null);

  // Zoom & Download Helpers
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [error, setError] = useState<string | null>(null);

  const handleSeatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combinedFiles = [...seatFiles, ...newFiles].slice(0, 5); // Max 5
      setSeatFiles(combinedFiles);

      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setSeatPreviews(prev => [...prev, ...newPreviews].slice(0, 5));
      setError(null);
    }
  };

  const removeSeatFile = (index: number) => {
    setSeatFiles(prev => prev.filter((_, i) => i !== index));
    setSeatPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAngleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combinedFiles = [...angleRefFiles, ...newFiles].slice(0, 5); // Max 5 total

      setAngleRefFiles(combinedFiles);

      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setAngleRefPreviews(prev => [...prev, ...newPreviews].slice(0, 5));
    }
  };

  const removeAngleRef = (index: number) => {
    setAngleRefFiles(prev => prev.filter((_, i) => i !== index));
    setAngleRefPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (seatFiles.length === 0 || !carModel || !year) {
      setError("请填写所有必填项（产品图、车型、年份）。");
      return;
    }

    if (angleMode === 'REFERENCE' && angleRefFiles.length === 0) {
      setError("选择参考图模式时，必须上传至少一张参考图。");
      return;
    }

    if ((window as any).aistudio) {
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) { }
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);

    try {
      // Optimize: Compress seat images before upload to speed up API request
      const seatImagePromises = seatFiles.map(async (file) => {
        return await compressImage(file);
      });
      const seatImages = await Promise.all(seatImagePromises);

      let angleValue: string | { base64: string, mime: string }[] = anglePreset;

      if (angleMode === 'REFERENCE' && angleRefFiles.length > 0) {
        // Optimize: Compress reference images too
        const refPromises = angleRefFiles.map(async (file) => {
          return await compressImage(file);
        });
        angleValue = await Promise.all(refPromises);
      }

      let visualGuide: { base64: string, mime: string } | undefined = undefined;

      // UNIVERSAL VISUAL GUIDE INJECTION
      // If a preset is selected, ALWAYS try to fetch its thumbnail to use as a strict visual guide.
      // This ensures "1:1 Match" behavior for all presets.
      if (angleMode === 'PRESET' && targetRow) {
        // Find the current target row option to get the thumb path
        const allOptions = anglePresets.flatMap(g => g.options);
        const selectedOption = allOptions.find(o => o.id === targetRow);

        if (selectedOption && selectedOption.thumb) {
          try {
            const response = await fetch(selectedOption.thumb);
            if (response.ok) {
              const blob = await response.blob();
              const mime = blob.type || 'image/png';

              // Gemini does not support SVG for input images.
              // Only use it as a visual guide if it is a raster image (jpeg, png, webp).
              if (!mime.includes('svg')) {
                const base64 = await blobToBase64(blob);
                visualGuide = { base64, mime };
                console.log("Injected Visual Guide for Preset:", targetRow);
              } else {
                console.log("Skipping Visual Guide injection for SVG thumbnail:", targetRow);
              }
            }
          } catch (e) {
            console.warn("Visual Guide fetch failed", e);
          }
        }
      }

      const images = await generateSeatCoverFit(
        seatImages,
        productCategory,
        carModel,
        year,
        seatConfig,
        targetRow,
        angleMode,
        angleValue,
        aspectRatio,
        qualityMode,
        visualGuide // Pass strict visual guide
      );
      setGeneratedImages(images);

      // Save Project
      await storageService.saveProject({
        id: crypto.randomUUID(),
        type: 'SEAT_COVER',
        createdAt: Date.now(),
        thumbnail: images[0], // Use first image as thumbnail
        assets: {
          original: seatPreviews,
          generated: images
        },
        metadata: {
          prompt: `${year} ${carModel} Seat Cover Fit`,
          params: {
            productCategory, carModel, year, seatConfig, targetRow, angleMode, aspectRatio, qualityMode
          }
        }
      });
    } catch (error: any) {
      const isPermissionError = error.status === 403 || (error.message && error.message.includes("permission"));
      if (isPermissionError) {
        setError("权限不足：需要配置 API Key。");
      } else {
        setError("生成失败: " + (error.message || "未知错误"));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-y-auto p-4 md:p-6">
      {/* Left Column: Configuration Wizard */}
      <div className="space-y-6">
        <div className="bg-pastel-card p-6 rounded-xl border border-pastel-border shadow-sm">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-pastel-text">
            <CarFront className="w-5 h-5 text-pastel-highlight" />
            座套试装配置
          </h2>

          {/* === Section 1: Product & Car Info === */}
          <div className="mb-6">
            <h3 className="text-pastel-highlight font-bold uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-pastel-bg border border-pastel-pink flex items-center justify-center text-[10px] text-pastel-highlight">1</span>
              产品与车型信息
            </h3>

            <div className="mb-4">
              <label className="block text-xs text-pastel-muted mb-2">产品类别 (Select Product Type)</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setProductCategory("Seat Cover")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${productCategory === "Seat Cover"
                    ? "border-pastel-highlight bg-orange-50 text-pastel-highlight"
                    : "border-pastel-border bg-white text-pastel-muted hover:border-pastel-pink"
                    }`}
                >
                  <CarFront className={`w-5 h-5`} />
                  <span className="text-sm font-semibold">座套 (Seat Cover)</span>
                </button>

                <button
                  onClick={() => setProductCategory("Armrest Box")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${productCategory === "Armrest Box"
                    ? "border-pastel-highlight bg-orange-50 text-pastel-highlight"
                    : "border-pastel-border bg-white text-pastel-muted hover:border-pastel-pink"
                    }`}
                >
                  <Box className={`w-5 h-5`} />
                  <span className="text-sm font-semibold">扶手箱 (Armrest Box)</span>
                </button>
              </div>
            </div>
            <label className="block text-sm font-medium text-pastel-muted mb-2">上传产品白底图</label>
            <div className="space-y-3 mb-4">
              <div className="relative group cursor-pointer border-2 border-dashed border-pastel-border rounded-lg p-3 transition-colors hover:border-pastel-pink hover:bg-pastel-bg">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSeatFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={seatFiles.length >= 5}
                />
                <div className="flex flex-col items-center justify-center py-4 text-pastel-muted">
                  <Upload className={`w-6 h-6 mb-2 ${seatFiles.length >= 5 ? 'opacity-20' : 'text-pastel-highlight'}`} />
                  <p className="text-sm font-medium text-pastel-text">
                    {seatFiles.length >= 5 ? '已达到5张限制' : '点击上传座套图片 (最多5张)'}
                  </p>
                  <p className="text-xs mt-1">支持多角度/细节图上传</p>
                </div>
              </div>

              {/* Seat Previews Grid */}
              {seatPreviews.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {seatPreviews.map((preview, idx) => (
                    <div key={idx} className="relative aspect-square rounded border border-pastel-border overflow-hidden group bg-gray-50">
                      <img src={preview} alt={`Seat ${idx}`} className="w-full h-full object-contain" />
                      <button
                        onClick={() => removeSeatFile(idx)}
                        className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {seatPreviews.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-green-500 mt-1">
                  <Check className="w-3 h-3" /> <span>已加载 {seatPreviews.length} 张座套素材</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-pastel-muted mb-1">车型型号 (Model)</label>
                <input
                  type="text"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="例如: Tesla Model Y"
                  className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text"
                />
              </div>
              <div>
                <label className="block text-xs text-pastel-muted mb-1">年份 (Year)</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="例如: 2023"
                  className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-pastel-muted mb-1">座椅布局 (Config)</label>
              <select
                value={seatConfig}
                onChange={(e) => setSeatConfig(e.target.value)}
                className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text"
              >
                <option value="Single Seat">Single Seat (单品座椅)</option>
                <option value="5-Seater">5-Seater (五座)</option>
                <option value="7-Seater">7-Seater (七座)</option>
                <option value="8-Seater">8-Seater (八座)</option>
                <option value="Captain Seats">Captain Seats (独立航空座椅)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-pastel-border my-6"></div>

          {/* === Section 2: Camera & View Control === */}
          <div className="mb-6">
            <h3 className="text-pastel-highlight font-bold uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-pastel-bg border border-pastel-pink flex items-center justify-center text-[10px] text-pastel-highlight">2</span>
              镜头与视角控制
            </h3>

            <div className="mb-4">
              <label className="block text-xs text-pastel-muted mb-1">对焦区域 (Focus Row)</label>
              {/* Custom Dropdown for Live Preview */}
              <div className="relative">
                <button
                  onClick={() => setIsTargetRowOpen(!isTargetRowOpen)}
                  className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm text-pastel-text flex items-center justify-between focus:ring-1 focus:ring-pastel-pink transition-all"
                >
                  <span className="truncate">
                    {anglePresets.flatMap(g => g.options).find(o => o.id === targetRow)?.label || targetRow}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-pastel-muted transition-transform ${isTargetRowOpen ? "rotate-180" : ""}`} />
                </button>

                {isTargetRowOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsTargetRowOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-pastel-border rounded-lg shadow-lg z-40 max-h-64 overflow-y-auto">
                      {anglePresets.map((group) => (
                        <div key={group.group}>
                          <div className="px-3 py-1.5 text-xs font-bold text-pastel-muted bg-gray-50 uppercase tracking-wider sticky top-0 bg-white border-b border-pastel-border/50">
                            {group.group}
                          </div>
                          {group.options.map((option) => (
                            <div
                              key={option.id}
                              onClick={() => {
                                setTargetRow(option.id);
                                setIsTargetRowOpen(false);
                              }}
                              onMouseEnter={() => setHoveredTargetThumb(option.thumb)}
                              onMouseLeave={() => setHoveredTargetThumb(null)}
                              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${targetRow === option.id
                                ? 'bg-pastel-pink/10 text-pastel-pink'
                                : 'text-pastel-text hover:bg-pastel-bg'
                                }`}
                            >
                              <span>{option.label}</span>
                              {targetRow === option.id && <Check className="w-4 h-4" />}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Floating Thumbnail Preview */}
                    {hoveredTargetThumb && (
                      <div
                        className="absolute z-50 pointer-events-none bg-white p-1 rounded-lg shadow-xl border border-pastel-border animate-in fade-in zoom-in-95 duration-150"
                        style={{
                          left: "102%",
                          top: "0",
                          width: "140px"
                        }}
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-gray-100">
                          <img
                            src={hoveredTargetThumb}
                            alt="Angle Preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-1">
                            <span className="text-[10px] text-white font-medium">预览参考图</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <label className="block text-xs text-pastel-muted mb-2">视角模式 (Angle Mode)</label>
            <div className="flex bg-pastel-bg p-1 rounded-lg mb-4 border border-pastel-border">
              <button
                onClick={() => setAngleMode('PRESET')}
                className={`flex-1 text-xs py-2 rounded transition-all ${angleMode === 'PRESET' ? 'bg-white text-pastel-text shadow-sm' : 'text-pastel-muted hover:text-pastel-text'}`}
              >
                预设视角
              </button>
              <button
                onClick={() => setAngleMode('REFERENCE')}
                className={`flex-1 text-xs py-2 rounded transition-all ${angleMode === 'REFERENCE' ? 'bg-white text-pastel-text shadow-sm' : 'text-pastel-muted hover:text-pastel-text'}`}
              >
                参考图匹配
              </button>
            </div>

            {angleMode === 'PRESET' ? (
              <div>
                <select
                  value={anglePreset}
                  onChange={(e) => setAnglePreset(e.target.value)}
                  className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text"
                >
                  <option value="Follow Focus Row">自动匹配对焦区域 + 智能参考 (1:1 Match Reference)</option>
                  <option value="Driver's View">主驾驶视角 (Driver's View)</option>
                  <option value="Rear Row Perspective">后排视角 (Rear Row Perspective)</option>
                  <option value="Side Open Door View">侧开门视角 (Side Open Door View)</option>
                  <option value="Top Down View">俯视视角 (Top Down View)</option>
                  <option value="Detail Shot of Stitching">细节特写 (Detail Shot)</option>
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative group cursor-pointer border-2 border-dashed border-pastel-border rounded-lg p-3 transition-colors hover:border-pastel-pink hover:bg-pastel-bg">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAngleRefFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={angleRefFiles.length >= 5}
                  />
                  <div className="flex flex-col items-center justify-center py-4 text-pastel-muted">
                    <ImageIcon className={`w-6 h-6 mb-2 ${angleRefFiles.length >= 5 ? 'opacity-20' : 'opacity-50 text-pastel-highlight'}`} />
                    <p className="text-xs">
                      {angleRefFiles.length >= 5 ? '已达到5张限制' : '点击上传/拖入参考图 (最多5张)'}
                    </p>
                  </div>
                </div>

                {/* Previews Grid */}
                {angleRefPreviews.length > 0 && (
                  <div className="grid grid-cols-5 gap-2">
                    {angleRefPreviews.map((preview, idx) => (
                      <div key={idx} className="relative aspect-square rounded border border-pastel-border overflow-hidden group">
                        <img src={preview} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeAngleRef(idx)}
                          className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-pastel-border my-6"></div>

          {/* === Section 3: Output Settings === */}
          <div className="mb-8">
            <h3 className="text-pastel-highlight font-bold uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-pastel-bg border border-pastel-pink flex items-center justify-center text-[10px] text-pastel-highlight">3</span>
              输出设置
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-pastel-muted mb-1 flex items-center gap-1"><Grid className="w-3 h-3" /> 图片比例</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text"
                >
                  <option value={AspectRatio.SQUARE}>1:1 (亚马逊主图)</option>
                  <option value={AspectRatio.PORTRAIT_9_16}>9:16 (手机/TikTok)</option>
                  <option value={AspectRatio.LANDSCAPE_16_9}>16:9 (横屏/Banner)</option>
                  <option value={AspectRatio.LANDSCAPE_4_3}>4:3 (标准)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-pastel-muted mb-1 flex items-center gap-1"><Monitor className="w-3 h-3" /> 画质精度</label>
                <select
                  value={qualityMode}
                  onChange={(e) => setQualityMode(e.target.value as ImageResolution)}
                  className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text"
                >
                  <option value={ImageResolution.RES_1K}>标准 Pro (Gemini 3 Pro) - 推荐</option>
                  <option value={ImageResolution.RES_2K}>高清 Pro (2K Resolution)</option>
                  <option value={ImageResolution.RES_4K}>超清 Pro (商业海报级)</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-2 text-sm text-red-600">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
              {(error.includes("403") || error.includes("权限")) && (
                <button
                  onClick={() => (window as any).aistudio?.openSelectKey()}
                  className="ml-7 px-3 py-1.5 bg-white border border-red-200 rounded text-xs font-medium text-red-500 hover:bg-red-50 transition-colors w-fit shadow-sm flex items-center gap-1"
                >
                  <Key className="w-3 h-3" /> 更换 API 密钥
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={seatFiles.length === 0 || isGenerating}
            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm ${seatFiles.length === 0 || isGenerating ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-pastel-pink hover:brightness-95 text-pastel-text'
              }`}
          >
            {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> 正在渲染座舱...</> : <><Sparkles className="w-5 h-5" /> 生成试装效果图</>}
          </button>
        </div>
      </div>

      {/* Right Column: Output */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="bg-pastel-card p-6 rounded-xl border border-pastel-border shadow-sm flex-1 flex flex-col overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 flex-shrink-0 text-pastel-text">
            <Eye className="w-5 h-5 text-pastel-highlight" />
            渲染结果 (Gemini 3 Pro)
          </h2>

          <div className="flex-1 bg-pastel-bg rounded-lg border border-pastel-border overflow-hidden relative flex flex-col p-2">
            {generatedImages.length > 0 ? (
              <div className="w-full h-full overflow-y-auto px-3 py-2">
                {generatedImages.map((imgSrc, idx) => (
                  <div key={idx} className="mb-6 last:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Image Container */}
                    <div className="relative rounded-xl overflow-hidden border border-pastel-border shadow-sm bg-white group">
                      <img
                        src={imgSrc}
                        alt="Seat Fit Result"
                        className="w-full h-auto cursor-zoom-in hover:brightness-[1.02] transition-all duration-300"
                        onClick={() => setZoomImage(imgSrc)}
                      />
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between mt-3 bg-white p-2 rounded-lg border border-pastel-border shadow-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setZoomImage(imgSrc)}
                          className="flex items-center gap-1.5 text-xs font-medium text-pastel-text hover:text-pastel-highlight px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                          title="放大查看"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          放大
                        </button>
                        <button
                          onClick={() => downloadImage(imgSrc, `seat-fit-${carModel}-${Date.now()}.png`)}
                          className="flex items-center gap-1.5 text-xs font-medium text-pastel-text hover:text-pastel-highlight px-3 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                          title="下载原图"
                        >
                          <Download className="w-3.5 h-3.5" />
                          下载
                        </button>
                      </div>

                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-pastel-highlight hover:bg-orange-600 px-4 py-1.5 rounded-md transition-all shadow-sm disabled:opacity-50 active:scale-95"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                        {isGenerating ? '渲染中...' : '重新生成'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-pastel-muted p-8">
                {isGenerating ? (
                  <>
                    <div className="w-12 h-12 border-4 border-pastel-pink border-t-pastel-highlight rounded-full animate-spin mb-4"></div>
                    <p className="text-sm">正在计算座舱光影与材质贴合...</p>
                  </>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-full mb-4 shadow-sm border border-pastel-border text-pastel-highlight">
                      <CarFront className="w-8 h-8" />
                    </div>
                    <p className="text-sm">试装效果图将显示在这里</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setZoomImage(null)}>
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors bg-white/10 p-2 rounded-full backdrop-blur-md"
            onClick={() => setZoomImage(null)}
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={zoomImage}
            alt="Full Screen Preview"
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            <button
              onClick={(e) => { e.stopPropagation(); downloadImage(zoomImage, `seat-fit-zoom-${Date.now()}.png`); }}
              className="bg-white text-black px-6 py-2.5 rounded-full font-medium shadow-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> 下载原图
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeatCoverTab;