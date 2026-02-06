import React, { useState } from 'react';
import { generateSeatCoverFit, blobToBase64, compressImage, optimizePrompt, editGeneratedImage } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import { CarFront, Upload, Loader2, AlertCircle, Eye, Image as ImageIcon, Sparkles, Check, Monitor, Grid, Key, ChevronDown, Maximize2, Download, RefreshCw, X, Box, Wand2 } from 'lucide-react';
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
      { id: "A01 White Background 1", label: "A01 - 白底悬浮展示 (White BG Floating)", thumb: "/thumbnails/1.jpg" },
      { id: "A02 White Background 2", label: "A02 - 白底平铺展示 (White BG Flat)", thumb: "/thumbnails/2.jpg" },
      { id: "A03 Rear Closed View", label: "A03 - 后排安装视角-闭合 (Rear Closed)", thumb: "/thumbnails/3.jpg" },
      { id: "A04 Rear Open View", label: "A04 - 后排功能视角-打开 (Rear Open)", thumb: "/thumbnails/4.jpg" },
      { id: "A05 Driver Side View", label: "A05 - 驾驶侧视角 (Driver Side)", thumb: "/thumbnails/5.jpg" },
      { id: "A06 Passenger Side View", label: "A06 - 副驾侧视角 (Passenger Side)", thumb: "/thumbnails/6.jpg" },
      { id: "A07 Top-Down View", label: "A07 - 垂直俯视 (Top-Down)", thumb: "/thumbnails/7.jpg" },
      { id: "A08 Rear Diagonal", label: "A08 - 后侧方斜视 (Rear Diagonal)", thumb: "/thumbnails/8.jpg" },
      { id: "A09 Material Close-up", label: "A09 - 材质特写 (Material Close-up)", thumb: "/thumbnails/9.jpg" },
      { id: "A10 Driving Scenario", label: "A10 - 驾驶场景-握盘 (Driving Scenario)", thumb: "/thumbnails/10.jpg" },
      { id: "A11 Rear Standard", label: "A11 - 后排标准俯视 (Rear Standard)", thumb: "/thumbnails/11.jpg" },
      { id: "A12 Pet Interaction Paws", label: "A12 - 宠物互动-趴姿 (Pet Paws)", thumb: "/thumbnails/12.jpg" },
      { id: "A13 Waterproof Wipe", label: "A13 - 防水擦拭演示 (Waterproof Wipe)", thumb: "/thumbnails/13.jpg" },
      { id: "A14 Installation Demo", label: "A14 - 安装演示 (Installation Demo)", thumb: "/thumbnails/14.jpg" },
      { id: "A15 Arm Rest Comfort", label: "A15 - 手臂倚靠舒适度 (Arm Comfort)", thumb: "/thumbnails/15.jpg" },
      { id: "A16 Rear Ajar View", label: "A16 - 后排-半开展示 (Rear Ajar)", thumb: "/thumbnails/16.jpg" },
      { id: "A17 Driver High Angle", label: "A17 - 驾驶侧-高角度 (Driver High Angle)", thumb: "/thumbnails/17.jpg" },
      { id: "A18 Pet Interaction Sitting", label: "A18 - 宠物互动-坐姿 (Pet Sitting)", thumb: "/thumbnails/18.jpg" }
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
  const [customRequest, setCustomRequest] = useState<string>("");
  const [targetRow, setTargetRow] = useState('F1 High-Angle Top-Down');
  const [angleMode, setAngleMode] = useState<'PRESET' | 'REFERENCE'>('PRESET');
  const [anglePreset, setAnglePreset] = useState("Follow Focus Row");
  const [angleRefFiles, setAngleRefFiles] = useState<File[]>([]);
  const [angleRefPreviews, setAngleRefPreviews] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [qualityMode, setQualityMode] = useState<ImageResolution>(ImageResolution.RES_1K);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTargetRowOpen, setIsTargetRowOpen] = useState(false);
  const [hoveredTargetThumb, setHoveredTargetThumb] = useState<string | null>(null);
  interface EditPoint {
    id: number;
    x: number;
    y: number;
    snapshot?: string;
  }

  const [editPrompts, setEditPrompts] = useState<Record<number, string>>({});
  const [isEditing, setIsEditing] = useState<Record<number, boolean>>({});
  const [selectedPoints, setSelectedPoints] = useState<Record<number, EditPoint[]>>({});
  const [editRefFiles, setEditRefFiles] = useState<Record<number, File[]>>({});
  const [editRefPreviews, setEditRefPreviews] = useState<Record<number, string[]>>({});
  const [showEditRefineInput, setShowEditRefineInput] = useState<Record<number, boolean>>({});
  const [editRefineInstructions, setEditRefineInstructions] = useState<Record<number, string>>({});
  const [isOptimizingEdit, setIsOptimizingEdit] = useState<Record<number, boolean>>({});

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

  const handleCategoryChange = (cat: string) => {
    setProductCategory(cat);
    if (cat === "Armrest Box") {
      setSeatConfig("Armrest Box");
      setTargetRow("A01 White Background 1");
      setAnglePreset("Follow Focus Row"); // FORCE FOLLOW FOCUS for Armrest logic
    } else {
      setSeatConfig("5-Seater");
      setTargetRow("F1 High-Angle Top-Down");
      setAnglePreset("Follow Focus Row");
    }
  };

  const capturePointSnapshot = (img: HTMLImageElement, xPct: number, yPct: number) => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;

      const size = 120; // Snapshot size
      canvas.width = size;
      canvas.height = size;

      const itemsX = (xPct / 100) * img.naturalWidth;
      const itemsY = (yPct / 100) * img.naturalHeight;

      if (!itemsX || !itemsY) return undefined;

      // Draw crop
      ctx.drawImage(
        img,
        itemsX - size / 2, itemsY - size / 2, size, size, // Source
        0, 0, size, size // Dest
      );

      // Add crosshair
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(size / 2 - 5, size / 2); ctx.lineTo(size / 2 + 5, size / 2);
      ctx.moveTo(size / 2, size / 2 - 5); ctx.lineTo(size / 2, size / 2 + 5);
      ctx.stroke();

      return canvas.toDataURL("image/jpeg", 0.8);
    } catch (e) {
      console.error("Snapshot failed", e);
      return undefined;
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const imgElement = e.currentTarget.querySelector('img');
      const snapshot = imgElement ? capturePointSnapshot(imgElement, x, y) : undefined;

      setSelectedPoints(prev => {
        const currentPoints = prev[index] || [];
        if (currentPoints.length >= 10) return prev; // Max 10 limit

        return {
          ...prev,
          [index]: [...currentPoints, { id: Date.now(), x, y, snapshot }]
        };
      });
    }
  };

  const removePoint = (imgIndex: number, pointId: number) => {
    setSelectedPoints(prev => ({
      ...prev,
      [imgIndex]: prev[imgIndex]?.filter(p => p.id !== pointId) || []
    }));
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setEditRefFiles(prev => ({
        ...prev,
        [index]: [...(prev[index] || []), ...newFiles].slice(0, 5)
      }));

      const newPreviews = newFiles.map(f => URL.createObjectURL(f));
      setEditRefPreviews(prev => ({
        ...prev,
        [index]: [...(prev[index] || []), ...newPreviews].slice(0, 5)
      }));
    }
  };

  const removeEditFile = (imgIndex: number, fileIndex: number) => {
    setEditRefFiles(prev => ({
      ...prev,
      [imgIndex]: prev[imgIndex]?.filter((_, i) => i !== fileIndex) || []
    }));
    setEditRefPreviews(prev => ({
      ...prev,
      [imgIndex]: prev[imgIndex]?.filter((_, i) => i !== fileIndex) || []
    }));
  };

  const handleOptimizeEditPrompt = async (index: number) => {
    const prompt = editPrompts[index];
    if (!prompt) return;
    setIsOptimizingEdit(prev => ({ ...prev, [index]: true }));
    try {
      const optimized = await optimizePrompt(prompt);
      const cleanOptimized = optimized.replace(/^#+\s.*\\n/gm, '').replace(/\\*\\*.*\\*\\*\\n/gm, '').trim();
      setEditPrompts(prev => ({ ...prev, [index]: cleanOptimized }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsOptimizingEdit(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleRefineEditPrompt = async (index: number) => {
    const prompt = editPrompts[index];
    const instruction = editRefineInstructions[index];
    if (!instruction || !prompt) return;
    setIsOptimizingEdit(prev => ({ ...prev, [index]: true }));
    try {
      const optimized = await optimizePrompt(prompt, undefined, instruction);
      const cleanOptimized = optimized.replace(/^#+\s.*\\n/gm, '').replace(/\\*\\*.*\\*\\*\\n/gm, '').trim();
      setEditPrompts(prev => ({ ...prev, [index]: cleanOptimized }));
      setEditRefineInstructions(prev => ({ ...prev, [index]: '' }));
      setShowEditRefineInput(prev => ({ ...prev, [index]: false }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsOptimizingEdit(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleRefineRefineEdit = async (index: number) => {
    const rawInstruction = editRefineInstructions[index];
    const currentPrompt = editPrompts[index];

    if (!rawInstruction || !currentPrompt) return;

    setIsOptimizingEdit(prev => ({ ...prev, [index]: true }));
    try {
      // Use previous prompt as base and new instruction as refinement
      const optimized = await optimizePrompt(currentPrompt, undefined, rawInstruction);
      const cleanOptimized = optimized.replace(/^#+\s.*\\n/gm, '').replace(/\\*\\*.*\\*\\*\\n/gm, '').trim();

      setEditPrompts(prev => ({ ...prev, [index]: cleanOptimized }));
      // Clear instruction but keep input open for more refining
      setEditRefineInstructions(prev => ({ ...prev, [index]: '' }));
    } catch (e) {
      console.error("Optimization failed", e);
    } finally {
      setIsOptimizingEdit(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleEditImage = async (index: number) => {
    const rawPrompt = editPrompts[index];
    const image = generatedImages[index];
    if (!rawPrompt || !image) return;

    // Inject spatial context if points are selected
    const points = selectedPoints[index] || [];
    let finalPrompt = rawPrompt;

    if (points.length > 0) {
      const pointDetails = points.map((p, i) => `Point ${i + 1}: [x:${p.x.toFixed(1)}%, y:${p.y.toFixed(1)}%]`).join(", ");
      finalPrompt = `The user has marked specific points on the image: ${pointDetails}. Please focus your edit on the areas around these points. Instruction: ${rawPrompt}`;
    }

    setIsEditing(prev => ({ ...prev, [index]: true }));
    setError(null);

    try {
      const base64 = image.includes(',') ? image.split(',')[1] : image;
      const mime = image.includes('image/webp') ? 'image/webp' : 'image/png';

      // Note: In future, we can pass editRefFiles[index] to the service here
      const newImages = await editGeneratedImage(base64, mime, finalPrompt);
      if (newImages && newImages.length > 0) {
        const updatedImages = [...generatedImages];
        updatedImages[index] = newImages[0];
        setGeneratedImages(updatedImages);
        // Clear prompt and point after success
        setEditPrompts(prev => ({ ...prev, [index]: '' }));
        setSelectedPoints(prev => ({ ...prev, [index]: [] }));
        setEditRefFiles(prev => ({ ...prev, [index]: [] }));
        setEditRefPreviews(prev => ({ ...prev, [index]: [] }));
      }
    } catch (e: any) {
      setError("微调失败: " + (e.message || "未知错误"));
    } finally {
      setIsEditing(prev => ({ ...prev, [index]: false }));
    }
  };

  const isFormValid = seatFiles.length > 0 &&
    carModel.trim() !== '' &&
    year.trim() !== '' &&
    (angleMode !== 'REFERENCE' || angleRefFiles.length > 0);

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

      // REFERENCE MODE OPTIMIZATION:
      // If the user uploads a reference image, we MUST treat it as the "Master Layout Reference"
      // to ensure the AI locks the camera angle 1:1 with the uploaded image.
      if (angleMode === 'REFERENCE' && angleValue && Array.isArray(angleValue) && angleValue.length > 0) {
        visualGuide = angleValue[0];
        console.log("Promoted Reference Image to Master Visual Guide for 1:1 matching.");
      }

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
        seatImages, // Image Array
        productCategory,
        carModel,
        year,
        seatConfig,
        targetRow,
        angleMode,
        angleValue, // Defined above
        aspectRatio,
        qualityMode,
        customRequest, // NEW: Custom Request
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
    <>
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
                    onClick={() => handleCategoryChange("Seat Cover")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${productCategory === "Seat Cover"
                      ? "border-pastel-highlight bg-orange-50 text-pastel-highlight"
                      : "border-pastel-border bg-white text-pastel-muted hover:border-pastel-pink"
                      }`}
                  >
                    <CarFront className={`w-5 h-5`} />
                    <span className="text-sm font-semibold">座套 (Seat Cover)</span>
                  </button>

                  <button
                    onClick={() => handleCategoryChange("Armrest Box")}
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
              <label className="block text-xs text-pastel-muted mb-2 flex items-center justify-between">
                <span>上传产品白底图 (Required)</span>
                {seatFiles.length > 0 ? <Check className="w-3.5 h-3.5 text-green-500 stroke-[3px]" /> : <span className="text-red-500 font-bold">*</span>}
              </label>
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
              </div>

              {/* Custom Request Input */}
              {/* Custom Request Input (Redesigned) */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-pastel-muted uppercase tracking-widest flex items-center gap-2">
                    额外描述 / 自定义需求
                    <div className="w-1.5 h-1.5 bg-pastel-pink rounded-full"></div>
                  </label>

                  {/* AI Polish Button used to be here, now inside textarea */}
                </div>

                <div className="relative group">
                  <div className={`
                    relative bg-white border transition-all duration-300 rounded-[1.2rem] overflow-hidden
                    ${isOptimizing ? 'border-pastel-pink shadow-[0_0_20px_rgba(212,134,159,0.2)]' : 'border-pastel-border focus-within:border-pastel-pink focus-within:ring-4 focus-within:ring-pastel-pink/10 shadow-sm'}
                  `}>
                    <textarea
                      value={customRequest}
                      onChange={(e) => setCustomRequest(e.target.value)}
                      placeholder="例如: 请加上一只狗在后排 / 增加夕阳氛围 (Use natural language to describe changes)"
                      className="w-full min-h-[100px] p-4 pr-12 bg-transparent border-none outline-none resize-none text-sm text-pastel-text placeholder:text-pastel-muted/60 font-medium leading-relaxed"
                      disabled={isOptimizing}
                    />

                    {/* Embedded Actions */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!customRequest) return;
                          setIsOptimizing(true);
                          try {
                            const optimized = await optimizePrompt(customRequest);
                            setCustomRequest(optimized.replace(/^#+\s.*\\n/gm, '').replace(/\\*\\*.*\\*\\*\\n/gm, '').trim());
                          } catch (e: any) {
                            setError("优化提示词失败: " + (e.message || "未知错误"));
                            setTimeout(() => setError(null), 3000);
                          } finally {
                            setIsOptimizing(false);
                          }
                        }}
                        disabled={!customRequest || isOptimizing}
                        title="AI 智能润色"
                        className={`
                          h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300
                          ${isOptimizing
                            ? 'bg-pastel-bg text-pastel-muted cursor-wait animate-spin'
                            : 'bg-pastel-text text-white hover:bg-gradient-to-r hover:from-pastel-pink hover:to-pastel-highlight hover:scale-110 shadow-md'}
                        `}
                      >
                        {isOptimizing ? <Loader2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* === Section 2: Model & Year === */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-pastel-muted mb-1 flex items-center justify-between">
                  <span>车型型号 (Model)</span>
                  {carModel.trim() !== '' ? <Check className="w-3 h-3 text-green-500 stroke-[3px]" /> : <span className="text-red-500 font-bold">*</span>}
                </label>
                <input
                  type="text"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="例如: Tesla Model Y"
                  className="w-full bg-pastel-input border border-pastel-border rounded-lg p-2 text-sm focus:ring-1 focus:ring-pastel-pink outline-none text-pastel-text"
                />
              </div>
              <div>
                <label className="block text-xs text-pastel-muted mb-1 flex items-center justify-between">
                  <span>年份 (Year)</span>
                  {year.trim() !== '' ? <Check className="w-3 h-3 text-green-500 stroke-[3px]" /> : <span className="text-red-500 font-bold">*</span>}
                </label>
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
                <option value="Armrest Box">Armrest Box (扶手箱单品)</option>
              </select>
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
                        {anglePresets
                          .filter(group => {
                            if (productCategory === "Armrest Box") {
                              return group.group.includes("Armrest Box");
                            } else {
                              return !group.group.includes("Armrest Box");
                            }
                          })
                          .map((group) => (
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
                                  <div>
                                    <span>{option.label}</span>
                                    {/* Debug: Show Filename */}
                                    <span className="ml-2 text-[10px] text-gray-400 font-mono">
                                      ({option.thumb?.split('/').pop()})
                                    </span>
                                  </div>
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

              <label className="block text-xs text-pastel-muted mb-2 flex items-center justify-between">
                <span>视角模式 (Angle Mode)</span>
                {angleMode === 'REFERENCE' ? (
                  angleRefFiles.length > 0 ? <Check className="w-3.5 h-3.5 text-green-500 stroke-[3px]" /> : <span className="text-red-500 font-bold">*</span>
                ) : null}
              </label>
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
          </div>

          <div className="mt-6">
            <button
              onClick={handleGenerate}
              disabled={!isFormValid || isGenerating}
              className={`w-full py-4 px-6 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group relative ${isFormValid && !isGenerating
                ? "bg-pastel-highlight text-white hover:bg-orange-600 shadow-[0_4px_14px_0_rgba(255,107,107,0.39)] hover:shadow-[0_6px_20px_rgba(255,107,107,0.23)] active:scale-[0.98] cursor-pointer"
                : "bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200"
                }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="tracking-wide">正在极速生成 (Generating...)</span>
                </>
              ) : (
                <>
                  <div className={`absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none opacity-50`}></div>
                  <Sparkles className={`w-5 h-5 ${isFormValid ? "animate-pulse" : ""}`} />
                  <span className="tracking-wide">开始渲染效果 (Start Render)</span>
                </>
              )}
            </button>
            {!isFormValid && !isGenerating && (
              <p className="text-center text-[10px] text-pastel-muted mt-3 animate-pulse font-medium bg-gray-50/50 py-1 rounded-full border border-gray-100 italic">
                💡 请填完所有 <span className="text-red-500 font-bold text-xs">*</span> 必填项以激活渲染
              </p>
            )}
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
                      <div
                        className="relative rounded-xl overflow-hidden border border-pastel-border shadow-sm bg-white group cursor-crosshair"
                        onClick={(e) => handleImageClick(e, idx)}
                        onMouseDown={(e) => e.ctrlKey && e.preventDefault()} // Prevent selection
                      >
                        <img
                          src={imgSrc}
                          alt="Seat Fit Result"
                          className="w-full h-auto cursor-zoom-in hover:brightness-[1.02] transition-all duration-300"
                          onClick={(e) => !e.ctrlKey && setZoomImage(imgSrc)}
                        />

                        {/* Multi-Point Markers */}
                        {selectedPoints[idx]?.map((point, pIndex) => (
                          <div
                            key={point.id}
                            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-in zoom-in duration-300"
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                          >
                            <div className="relative group/point">
                              <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] text-white font-bold">
                                {pIndex + 1}
                              </div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-blue-500/30 rounded-full animate-ping"></div>

                              {/* Snapshot Tooltip on Hover */}
                              {point.snapshot && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/point:block bg-white p-1 rounded-md shadow-lg border border-gray-100 z-50">
                                  <img src={point.snapshot} className="w-16 h-16 object-cover rounded" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                            <Key className="w-3 h-3" />
                            <span>Ctrl + 点击添加标记点 ({selectedPoints[idx]?.length || 0}/10)</span>
                          </div>
                        </div>
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

                      {/* Enhanced Edit Prompt Area */}
                      <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">

                        {/* Selected Points Chips */}
                        {selectedPoints[idx]?.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-thin">
                            {selectedPoints[idx]!.map((p, i) => (
                              <div key={p.id} className="flex-shrink-0 flex items-center gap-2 bg-white px-2 py-1 rounded-md border border-blue-200 shadow-sm min-w-[120px]">
                                {p.snapshot && <img src={p.snapshot} className="w-8 h-8 rounded border border-gray-100 object-cover" />}
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-blue-600">Point #{i + 1}</span>
                                  <span className="text-[9px] text-gray-400">已选定区域</span>
                                </div>
                                <button
                                  onClick={() => removePoint(idx, p.id)}
                                  className="ml-auto text-gray-400 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reference Images for Edit */}
                        <div className="mb-2">
                          <div className="flex gap-2 items-center overflow-x-auto pb-1 min-h-[32px]">
                            {editRefPreviews[idx]?.map((preview, fIdx) => (
                              <div key={fIdx} className="relative group/editref w-10 h-10 rounded border border-gray-200 overflow-hidden flex-shrink-0">
                                <img src={preview} className="w-full h-full object-cover" />
                                <button onClick={() => removeEditFile(idx, fIdx)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover/editref:opacity-100 flex items-center justify-center text-xs">×</button>
                              </div>
                            ))}

                            <label className="cursor-pointer flex items-center gap-1 text-[10px] text-pastel-highlight border border-pastel-highlight/30 px-2 py-1.5 rounded bg-orange-50 hover:bg-orange-100 transition-colors">
                              <Upload className="w-3 h-3" />
                              <span>加参考图</span>
                              <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleEditFileChange(e, idx)} />
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold text-pastel-muted uppercase tracking-wider">微调指令</span>
                              {!showEditRefineInput[idx] && (
                                <button
                                  onClick={() => setShowEditRefineInput(prev => ({ ...prev, [idx]: true }))}
                                  className="text-[9px] font-bold text-pastel-highlight hover:text-pastel-text transition-colors flex items-center gap-1"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  继续优化
                                </button>
                              )}
                            </div>

                            <div className="relative group">
                              <div className={`
                                relative bg-white border transition-all duration-300 rounded-xl overflow-hidden
                                ${isOptimizingEdit[idx] ? 'border-pastel-pink shadow-[0_0_15px_rgba(212,134,159,0.15)]' : 'border-gray-200 focus-within:border-pastel-pink focus-within:ring-2 focus-within:ring-pastel-pink/5 shadow-sm'}
                              `}>
                                <textarea
                                  value={editPrompts[idx] || ''}
                                  onChange={(e) => setEditPrompts(prev => ({ ...prev, [idx]: e.target.value }))}
                                  placeholder={selectedPoints[idx]?.length
                                    ? `[已标记 ${selectedPoints[idx]?.length} 处区域] 请描述修改内容...`
                                    : "在此输入微调指令 (例如: 座椅换成深红色 / 增加车内光照 / 放置一个手提袋)"}
                                  className="w-full text-xs bg-transparent border-none outline-none p-3 pr-10 min-h-[80px] text-pastel-text placeholder:text-gray-400 group-disabled:opacity-50"
                                  disabled={isOptimizingEdit[idx]}
                                />
                                {/* Embedded Polish Button */}
                                <div className="absolute bottom-2 right-2">
                                  <button
                                    onClick={() => handleOptimizeEditPrompt(idx)}
                                    disabled={!editPrompts[idx] || isOptimizingEdit[idx]}
                                    title="AI 智能润色"
                                    className={`
                                      h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300
                                      ${isOptimizingEdit[idx]
                                        ? 'bg-pastel-bg text-pastel-muted cursor-wait animate-spin'
                                        : 'bg-pastel-text text-white hover:bg-gradient-to-r hover:from-pastel-pink hover:to-pastel-highlight shadow-sm'}
                                    `}
                                  >
                                    {isOptimizingEdit[idx] ? <Loader2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>

                              {/* Per-image refinement input section */}
                              {showEditRefineInput[idx] && (
                                <div className="mt-1.5 animate-in slide-in-from-top-1 duration-200">
                                  <div className="flex gap-1.5 p-1 bg-pastel-bg/50 rounded-lg border border-pastel-border/50">
                                    <input
                                      value={editRefineInstructions[idx] || ''}
                                      onChange={(e) => setEditRefineInstructions(prev => ({ ...prev, [idx]: e.target.value }))}
                                      onKeyDown={(e) => e.key === 'Enter' && handleRefineEditPrompt(idx)}
                                      placeholder="优化指令..."
                                      className="flex-1 bg-transparent px-2 py-1 text-[10px] font-medium text-pastel-text focus:outline-none placeholder:text-pastel-muted/70"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleRefineEditPrompt(idx)} // Initial refine
                                      disabled={!editRefineInstructions[idx] || isOptimizingEdit[idx]}
                                      className="px-2 py-0.5 bg-white border border-pastel-border rounded-md text-[10px] font-bold text-pastel-highlight hover:bg-pastel-highlight hover:text-white transition-all shadow-sm"
                                    >
                                      {editPrompts[idx] ? "继续优化" : "发送"}
                                    </button>
                                    <button
                                      onClick={() => setShowEditRefineInput(prev => ({ ...prev, [idx]: false }))}
                                      className="p-1 text-pastel-muted"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleEditImage(idx)}
                            disabled={!editPrompts[idx] || isEditing[idx] || isOptimizingEdit[idx]}
                            className={`h-[80px] w-[80px] rounded-lg font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 flex-shrink-0 mt-[22px] ${editPrompts[idx] && !isEditing[idx] && !isOptimizingEdit[idx]
                              ? "bg-pastel-pink text-white hover:bg-orange-600 shadow-md"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                              }`}
                          >
                            {isEditing[idx] ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            <span className="text-[10px]">微调生成</span>
                          </button>
                        </div>
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
            </div >
          </div >


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
      </div>
    </>
  );
};

export default SeatCoverTab;