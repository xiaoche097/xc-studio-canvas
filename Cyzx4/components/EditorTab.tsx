import React, { useState, useEffect } from 'react';
import { editGeneratedImage, blobToBase64, inpaintImage, estimateCameraAngle, optimizePrompt } from '../services/geminiService';
import { ImageResolution, AspectRatio } from '../types';
import { Wand2, Image as ImageIcon, Loader2, Save, AlertCircle, Key, MousePointer2, Eraser, Trash2, Crosshair, RotateCcw, Sparkles, Upload, CheckCircle2, X, Camera, Compass } from 'lucide-react';

interface EditorTabProps {
  initialImage: string | null;
}

const getFriendlyErrorMessage = (error: any): string => {
  const message = error.message || JSON.stringify(error);
  if (message.includes('403')) return "权限不足 (403)。请检查您的 API 密钥。";
  if (message.includes('401')) return "身份验证失败 (401)。";
  return `操作失败: ${message.substring(0, 150)}...`;
};

interface EditPoint {
  id: number;
  x: number;
  y: number;
  snapshot?: string;
}

const EditorTab: React.FC<EditorTabProps> = ({ initialImage }) => {
  const [currentImage, setCurrentImage] = useState<string | null>(initialImage);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New States for Marker & Eraser & Camera
  const [mode, setMode] = useState<'move' | 'point' | 'eraser' | 'camera'>('move');
  const [cameraAngle, setCameraAngle] = useState({ yaw: 0, pitch: 0, zoom: 1 });

  const [points, setPoints] = useState<EditPoint[]>([]);
  const [brushSize, setBrushSize] = useState(40);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<ImageResolution>(ImageResolution.RES_1K);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [preEditImage, setPreEditImage] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = React.useRef(0);
  // NEW: Reference Images State
  const [referenceImages, setReferenceImages] = useState<{ id: string; base64: string; mimeType: string }[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  // NEW: Refinement State
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');

  useEffect(() => {
    if (initialImage) {
      setCurrentImage(initialImage);

      // Auto-detect Aspect Ratio
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        let bestMatch = AspectRatio.SQUARE;
        let minDiff = Infinity;

        const ratios = [
          { r: 1, v: AspectRatio.SQUARE },
          { r: 3 / 4, v: AspectRatio.PORTRAIT_3_4 },
          { r: 4 / 3, v: AspectRatio.LANDSCAPE_4_3 },
          { r: 9 / 16, v: AspectRatio.PORTRAIT_9_16 },
          { r: 16 / 9, v: AspectRatio.LANDSCAPE_16_9 },
          { r: 21 / 9, v: AspectRatio.LANDSCAPE_21_9 },
        ];

        for (const item of ratios) {
          const diff = Math.abs(ratio - item.r);
          if (diff < minDiff) {
            minDiff = diff;
            bestMatch = item.v;
          }
        }
        setSelectedAspectRatio(bestMatch);
      };
      img.src = initialImage;
    }
  }, [initialImage]);

  // Helper to get angle description based on new 360 system
  const getAngleDescription = () => {
    const { yaw, pitch, zoom } = cameraAngle;

    // Azimuth (Yaw) Description
    let horizontal = 'Front View (0°)';
    if (yaw > 315 || yaw <= 45) horizontal = 'Front View';
    else if (yaw > 45 && yaw <= 135) horizontal = 'Right Side View';
    else if (yaw > 135 && yaw <= 225) horizontal = 'Back View';
    else if (yaw > 225 && yaw <= 315) horizontal = 'Left Side View';

    horizontal += ` (Azimuth ${yaw}°)`;

    // Elevation (Pitch) Description
    // Low Angle (-30°): Camera below subject, looking up.
    // High Angle (60°): Camera above subject, looking down.
    let vertical = 'Eye-Level (0°)';
    if (pitch < -10) vertical = `Low Angle / Worm's Eye View (Camera at ${pitch}°) - Look Up`;
    else if (pitch > 10) vertical = `High Angle / Bird's Eye View (Camera at ${pitch}°) - Look Down`;

    return `Camera Angle: ${horizontal}, ${vertical}. Distance: ${zoom}x.`;
  };

  const handleAutoDetectAngle = async () => {
    if (!currentImage) return;
    setIsEditing(true);
    try {
      const matches = currentImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        const estimated = await estimateCameraAngle(matches[2], matches[1]);
        setCameraAngle(estimated);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsEditing(false);
    }
  };

  const handleCameraShift = async () => {
    if (!currentImage) return;
    setIsEditing(true);
    try {
      const angleDesc = getAngleDescription();
      const prompt = `Novel View Synthesis Task: Physically relocate the camera to a new 3D position.
      
      TARGET SPECIFICATIONS:
      - AZIMUTH (Horizontal): ${cameraAngle.yaw}° (0=Front, 90=Right, 180=Back, 270=Left).
      - ELEVATION (Vertical): ${cameraAngle.pitch}° (Negative=Low Angle/Look Up, Positive=High Angle/Look Down).
      - DISTANCE: ${cameraAngle.zoom}x (0.6=Macro/Close-up, 1.8=Wide Angle).
      
      INSTRUCTIONS:
      1. IGNORE the original camera perspective.
      2. GENERATE a photorealistic image of the EXACT SAME SUBJECT from the defined ${angleDesc}.
      3. IF Azimuth is ~90°, show the RIGHT side. IF ~180°, show the BACK. IF ~270°, show the LEFT side.
      4. IF Elevation is POSITIVE, show the top surfaces (looking down). IF NEGATIVE, show the underside/imposing view (looking up).
      5. STRICTLY MAINTAIN subject identity and aspect ratio.
      
      Output: The subject as seen from this new physical camera location.`;

      const matches = currentImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        // IMPORTANT: Do NOT pass reference image for rotation, it locks the perspective. 
        // We rely on the input image itself to guide the content.
        const result = await editGeneratedImage(
          matches[2],
          matches[1],
          prompt,
          [], // No extra reference
          { resolution: selectedResolution, aspectRatio: selectedAspectRatio }
        );
        if (result.length > 0) {
          setPreEditImage(currentImage);
          setCurrentImage(result[0]);
        }
      }
    } catch (e: any) {
      setError(getFriendlyErrorMessage(e));
    } finally {
      setIsEditing(false);
    }
  };

  const processFile = async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const base64 = await blobToBase64(file);
      const dataUrl = `data:${file.type};base64,${base64}`;
      setCurrentImage(dataUrl);

      // Auto-detect aspect ratio
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        let bestMatch = AspectRatio.SQUARE;
        let minDiff = Infinity;

        const ratios = [
          { r: 1, v: AspectRatio.SQUARE },
          { r: 3 / 4, v: AspectRatio.PORTRAIT_3_4 },
          { r: 4 / 3, v: AspectRatio.LANDSCAPE_4_3 },
          { r: 9 / 16, v: AspectRatio.PORTRAIT_9_16 },
          { r: 16 / 9, v: AspectRatio.LANDSCAPE_16_9 },
          { r: 21 / 9, v: AspectRatio.LANDSCAPE_21_9 },
        ];

        for (const item of ratios) {
          const diff = Math.abs(ratio - item.r);
          if (diff < minDiff) {
            minDiff = diff;
            bestMatch = item.v;
          }
        }
        setSelectedAspectRatio(bestMatch);
      };
      img.src = dataUrl;

      setError(null);
      setPoints([]);
      clearMask();
      setPreEditImage(null);
    } else {
      setError("请上传有效的图片文件");
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const clearMask = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const clearAll = () => {
    setPoints([]);
    clearMask();
    setEditPrompt('');
    setCurrentImage(null);
    setPreEditImage(null);
    setError(null);
  };

  const handleCompareStart = () => {
    if (preEditImage) setIsComparing(true);
  };

  const handleCompareEnd = () => {
    setIsComparing(false);
  };

  const getMaskBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Check if anything is drawn
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasData = imageData.data.some((channel, index) => index % 4 === 3 && channel > 0);
    if (!hasData) return null;

    // Create a temporary canvas to export as binary mask
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return null;

    // Fill background with black
    exportCtx.fillStyle = 'black';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw the mask as white
    exportCtx.globalCompositeOperation = 'source-over';
    exportCtx.drawImage(canvas, 0, 0);
    // Convert everything with alpha to white
    const exportImageData = exportCtx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < exportImageData.data.length; i += 4) {
      if (exportImageData.data[i + 3] > 0) {
        exportImageData.data[i] = 255;
        exportImageData.data[i + 1] = 255;
        exportImageData.data[i + 2] = 255;
        exportImageData.data[i + 3] = 255;
      }
    }
    exportCtx.putImageData(exportImageData, 0, 0);

    return exportCanvas.toDataURL('image/png').split(',')[1];
  };

  const handleCanvasInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!currentImage || mode === 'move') return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img) return;

    const rect = canvas.getBoundingClientRect();
    const x = (('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = (('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;

    if (mode === 'point' && e.type === 'mousedown') {
      const xPct = (x / rect.width) * 100;
      const yPct = (y / rect.height) * 100;

      if (points.length >= 10) return;

      // Capture Snapshot (Smart Zoom)
      let snapshot = "";
      try {
        // Create temp canvas to crop
        const cropSize = 120; // Size of the zoomed visual
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropSize;
        cropCanvas.height = cropSize;
        const ctx = cropCanvas.getContext('2d');

        // Calculate source coordinates on the rendered image/canvas
        // Image behaves as contain, but canvas matches its size?
        // Actually canvas matches img size in onLoad.
        // So x, y are relative to canvas display size. We need to map to internal resolution or just use what we see?
        // The canvasRef has width/height set to img.clientWidth/height in onLoad.
        // So x,y are correct relative to that.

        if (ctx) {
          // Draw the relevant part of the image to the crop canvas
          // Source x = x - cropSize/2
          // Source y = y - cropSize/2
          ctx.drawImage(
            img,
            x * (img.naturalWidth / rect.width) - (cropSize / 2 * (img.naturalWidth / rect.width)),
            y * (img.naturalHeight / rect.height) - (cropSize / 2 * (img.naturalHeight / rect.height)),
            cropSize * (img.naturalWidth / rect.width),
            cropSize * (img.naturalHeight / rect.height),
            0, 0, cropSize, cropSize
          );
          snapshot = cropCanvas.toDataURL('image/jpeg', 0.8);
        }
      } catch (e) {
        console.error("Snapshot failed", e);
      }

      const newPoint: EditPoint = {
        id: Date.now(),
        x: xPct,
        y: yPct,
        snapshot // Store the crop
      };
      setPoints([...points, newPoint]);
    } else if (mode === 'eraser') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (e.type === 'mousedown' || e.type === 'touchstart') {
        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if ((e.type === 'mousemove' || e.type === 'touchmove') && isDrawing) {
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (e.type === 'mouseup' || e.type === 'touchend' || e.type === 'mouseleave') {
        setIsDrawing(false);
      }
    }
  };

  const handleEdit = async () => {
    if (!currentImage) return;

    let finalPrompt = editPrompt;
    const maskBase64 = getMaskBase64();

    // If eraser is used but no prompt, assume removal
    if (maskBase64 && !finalPrompt) {
      finalPrompt = "Please remove the selected object or area and fill it naturally to match the surrounding background and textures.";
    }

    if (!finalPrompt && points.length === 0 && referenceImages.length === 0) return;

    // prompt construction logic
    let promptPrefix = "";
    if (referenceImages.length > 0) {
      promptPrefix = `[IMPORTANT] REFERENCE IMAGES PROVIDED (${referenceImages.length}). 
       TASK: Strictly match the STYLE, TEXTURE, and VISUAL CHARACTERISTICS of the attached reference images.
       IGORE differences in subject shape if they conflict, but ADORT the visual fidelity.
       `;
    }

    // Inject points into prompt if any
    if (points.length > 0) {
      const pointStr = points.map((p, i) => `[${p.y.toFixed(0)}, ${p.x.toFixed(0)}]`).join(" and ");
      finalPrompt = `${promptPrefix}
      Edit the image content specifically at these coordinates (y, x): ${pointStr}.
      
      USER INSTRUCTION: "${editPrompt}"
      
      REQUIREMENTS:
      1. Apply the user's instruction ONLY at the marked locations.
      2. Integrate the changes seamlessly with the existing lighting and perspective.
      3. Use the Reference Images to guide the visual style/texture of the edit.`;
    } else if (referenceImages.length > 0) {
      // Only Refs and Text
      finalPrompt = `${promptPrefix}
       USER INSTRUCTION: "${editPrompt}"
       
       REQUIREMENTS:
       1. Transform the Input Image to match the Reference Image's style/vibe.
       2. If the user instruction specifies a change, apply it using the Reference Image as the ground truth for visual appearance.
       `;
    }

    setIsEditing(true);
    setError(null);
    try {
      const matches = currentImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) throw new Error("无效的图片格式。");

      let resultImages: string[] = [];
      const serviceRefs = referenceImages.map(r => ({ base64: r.base64, mimeType: r.mimeType }));

      // LOGIC BRANCHING:
      // 1. Manual Eraser Mask -> Inpaint
      // 2. Points -> Auto-Generate Mask -> Inpaint
      // 3. No Mask/Points -> Global Edit (Image-to-Image)

      let effectiveMaskBase64 = maskBase64;

      // Auto-generate mask from points if no manual mask exists, or combine?
      // Let's prioritize manual mask if exists. If not, check points.
      if (!effectiveMaskBase64 && points.length > 0) {
        // Create a temp canvas to draw the point mask
        const canvas = canvasRef.current;
        if (canvas) {
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;
          const width = canvas.width;
          const height = canvas.height;
          const ctx = maskCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = 'white';
            // Draw circle for each point
            points.forEach(p => {
              const x = (p.x / 100) * width;
              const y = (p.y / 100) * height;
              ctx.beginPath();
              ctx.arc(x, y, 100, 0, 2 * Math.PI); // 100px radius logic
              ctx.fill();
            });
            effectiveMaskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
          }
        }
      }

      if (effectiveMaskBase64) {
        // Use Inpainting (for Eraser OR Points)
        // Note: prompt already contains point coordinates text, which is fine, but the mask is the real driver.
        resultImages = await inpaintImage(
          matches[2],
          effectiveMaskBase64,
          finalPrompt,
          { resolution: selectedResolution },
          serviceRefs // Pass refs to inpaint now
        );
      } else {
        // Use normal global edit
        resultImages = await editGeneratedImage(
          matches[2],
          matches[1],
          finalPrompt,
          serviceRefs,
          { resolution: selectedResolution }
        );
      }

      if (resultImages.length > 0) {
        setPreEditImage(currentImage); // Save current as pre-edit
        setCurrentImage(resultImages[0]);
        // Don't clear prompt/refs immediately to allow iteration, or maybe clear? 
        // User behavior usually wants to iterate. Let's keep them but maybe clear points.
        setPoints([]);
        clearMask();
      } else {
        throw new Error("AI未能生成图片，可能由于描述过于模糊或触发安全拦截，请尝试调整指令。");
      }
    } catch (error: any) {
      setError(getFriendlyErrorMessage(error));
    } finally {
      setIsEditing(false);
    }
  };

  const handleOptimizePrompt = async () => {
    if (!editPrompt && referenceImages.length === 0 && !currentImage) return;
    setIsOptimizing(true);
    try {
      const serviceRefs = referenceImages.map(r => ({ base64: r.base64, mimeType: r.mimeType }));

      // NEW: Automatically include the current canvas image as the PRIMARY reference
      // This ensures the AI "sees" the product/image the user is working on.
      if (currentImage) {
        const match = currentImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (match) {
          // Prepend to start of array so it's the first context
          serviceRefs.unshift({ base64: match[2], mimeType: match[1] });
        }
      }

      // Add instruction to force concise output (hacky but effective without changing service signature)
      const promptWithInstruction = editPrompt + "\n\n(IMPORTANT: Please ignore markdown formatting in output. Return ONLY the optimized prompt text directly.)";

      const optimized = await optimizePrompt(promptWithInstruction, serviceRefs);

      // Clean up potential markdown headers if the model explains itself
      // This regex removes lines like "## Optimization" or "**Analysis**" if they appear at start
      const cleanOptimized = optimized.replace(/^#+\s.*\n/gm, '').replace(/\*\*.*\*\*\n/gm, '').trim();

      setEditPrompt(cleanOptimized);
      setShowRefineInput(false); // Close refine input if open
      setRefineInstruction('');
    } catch (e) {
      console.error(e);
      // Fail silently or show toast
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleRefinePrompt = async () => {
    if (!refineInstruction) return;
    setIsOptimizing(true);
    try {
      const serviceRefs = referenceImages.map(r => ({ base64: r.base64, mimeType: r.mimeType }));
      if (currentImage) {
        const match = currentImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (match) serviceRefs.unshift({ base64: match[2], mimeType: match[1] });
      }

      // Call optimize with the REFINE instruction
      const optimized = await optimizePrompt(editPrompt, serviceRefs, refineInstruction);

      const cleanOptimized = optimized.replace(/^#+\s.*\n/gm, '').replace(/\*\*.*\*\*\n/gm, '').trim();
      setEditPrompt(cleanOptimized);
      setRefineInstruction('');
      setShowRefineInput(false);
    } catch (e) { console.error(e); }
    finally { setIsOptimizing(false); }
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newRefs = [...referenceImages];
      for (let i = 0; i < e.target.files.length; i++) {
        if (newRefs.length >= 3) break; // Max 3
        const file = e.target.files[i];
        try {
          const base64 = await blobToBase64(file);
          newRefs.push({
            id: Date.now() + Math.random().toString(),
            base64,
            mimeType: file.type
          });
        } catch (e) { console.error(e); }
      }
      setReferenceImages(newRefs);
    }
  };

  const removeRefImage = (id: string) => {
    setReferenceImages(referenceImages.filter(r => r.id !== id));
  };

  return (
    <div className="flex h-full bg-pastel-bg overflow-hidden relative">
      {/* 1. Creative Workspace (Main Image Area) */}
      <div className="flex-1 flex flex-col relative overflow-hidden">

        {/* 工作区状态指示器 (增强可见度) */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-white/95 backdrop-blur-2xl px-6 py-3 rounded-2xl border border-pastel-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-4 transition-all hover:shadow-[0_8px_30px_rgba(212,134,159,0.1)]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-pastel-highlight rounded-full animate-pulse"></div>
                <div className="absolute inset-0 bg-pastel-pink rounded-full animate-ping opacity-30"></div>
              </div>
              <span className="text-[10px] font-black text-pastel-highlight uppercase tracking-[0.25em]">工作室状态</span>
            </div>
            <div className="h-4 w-px bg-pastel-border/60"></div>
            <p className="text-sm font-bold text-pastel-text flex items-center gap-2">
              {currentImage ? (
                <>素材就绪 <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /></>
              ) : "等待添加素材"}
            </p>
          </div>
        </div>

        {/* 悬浮工具栏 (品牌化设计) */}
        {currentImage && (
          <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4 p-2.5 bg-white/80 backdrop-blur-2xl rounded-[2rem] border border-pastel-border shadow-lg animate-in fade-in slide-in-from-left-4 duration-700">
            <ToolButton
              active={mode === 'move'}
              onClick={() => setMode('move')}
              icon={<MousePointer2 className="w-5 h-5" />}
              label="选择模式"
            />
            <ToolButton
              active={mode === 'point'}
              onClick={() => setMode('point')}
              icon={<Crosshair className="w-5 h-5" />}
              label="添加标记点"
            />
            <ToolButton
              active={mode === 'eraser'}
              onClick={() => setMode('eraser')}
              icon={<Eraser className="w-5 h-5" />}
              label="智能消除笔"
            />
            <ToolButton
              active={mode === 'camera'}
              onClick={() => setMode('camera')}
              icon={<Camera className="w-5 h-5" />}
              label="多角度虚拟相机"
            />
            <div className="h-px bg-pastel-border mx-2"></div>
            <ToolButton
              active={false}
              onClick={clearAll}
              icon={<RotateCcw className="w-5 h-5" />}
              label="重置画布"
              danger
            />
          </div>
        )}

        {/* The Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-12">
          <div
            ref={containerRef}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative bg-white rounded-[2.5rem] shadow-[0_30px_60px_-20px_rgba(212,134,159,0.15)] overflow-hidden transition-all duration-700 group
               ${currentImage ? 'border border-pastel-border' : 'border-4 border-dashed border-pastel-border w-[520px] h-[520px] hover:border-pastel-pink hover:bg-white/50'}
               ${isDragging ? '!border-pastel-pink !bg-purple-50/30 scale-[1.02] shadow-2xl ring-4 ring-pastel-pink/20' : ''}`}
          >
            {isDragging && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="p-4 bg-white rounded-full shadow-lg border border-pastel-pink animate-bounce">
                  <Upload className="w-8 h-8 text-pastel-pink" />
                </div>
                <p className="mt-4 text-lg font-bold text-pastel-pink">松开鼠标上传图片</p>
              </div>
            )}
            {currentImage ? (
              <>
                <img
                  ref={imgRef}
                  src={isComparing && preEditImage ? preEditImage : currentImage}
                  alt="Creative Source"
                  className="max-w-[72vw] max-h-[72vh] object-contain pointer-events-none select-none transition-all duration-700"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const canvas = canvasRef.current;
                    if (canvas) {
                      canvas.width = img.clientWidth;
                      canvas.height = img.clientHeight;
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 m-auto z-10 transition-opacity duration-300
                      ${mode === 'move' ? 'pointer-events-none opacity-40' : 'cursor-crosshair opacity-100'}`}
                  onMouseDown={handleCanvasInteraction}
                  onMouseMove={handleCanvasInteraction}
                  onMouseUp={handleCanvasInteraction}
                  onMouseLeave={handleCanvasInteraction}
                  onTouchStart={handleCanvasInteraction}
                  onTouchMove={handleCanvasInteraction}
                  onTouchEnd={handleCanvasInteraction}
                />

                {/* 标记点 (增强对比度与层级) */}
                {points.map((p, idx) => {
                  const img = imgRef.current;
                  if (!img) return null;
                  return (
                    <div
                      key={p.id}
                      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        left: `calc(50% + ${(p.x - 50) * (img.clientWidth / 100)}px)`,
                        top: `calc(50% + ${(p.y - 50) * (img.clientHeight / 100)}px)`
                      }}
                    >
                      <div className="relative group/point animate-in zoom-in duration-300 cubic-bezier(0.34, 1.56, 0.64, 1)">
                        {/* 外圈装饰 */}
                        <div className="absolute inset-[-4px] rounded-full border-2 border-pastel-pink/30 animate-pulse"></div>
                        {/* 标记主体 */}
                        <div className="w-9 h-9 bg-pastel-highlight text-white rounded-full border-[3px] border-white shadow-[0_8px_16px_rgba(212,134,159,0.4)] flex items-center justify-center text-[13px] font-black ring-4 ring-pastel-highlight/10">
                          {idx + 1}
                        </div>
                        {/* 波纹动效 */}
                        <div className="absolute inset-0 bg-pastel-highlight rounded-full animate-ping opacity-20 transform scale-150"></div>
                      </div>
                    </div>
                  );
                })}

                {/* 底部悬浮操作栏 */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                  <div className="bg-white/90 backdrop-blur-xl px-8 py-3 rounded-full flex items-center gap-6 border border-pastel-border shadow-xl">
                    <div className="flex items-center gap-2.5 text-pastel-text">
                      <ImageIcon className="w-4 h-4 text-pastel-highlight" />
                      <span className="text-xs font-bold tracking-tight">工作室素材</span>
                    </div>
                    <div className="h-4 w-px bg-pastel-border"></div>
                    <a href={currentImage} download="skysper-edit.png" className="text-xs font-bold text-pastel-highlight hover:text-pastel-text flex items-center gap-2 transition-colors">
                      <Save className="w-4 h-4" /> 下载修图结果
                    </a>
                    {preEditImage && (
                      <>
                        <div className="h-4 w-px bg-pastel-border"></div>
                        <button
                          onMouseDown={handleCompareStart}
                          onMouseUp={handleCompareEnd}
                          onMouseLeave={handleCompareEnd}
                          onTouchStart={handleCompareStart}
                          onTouchEnd={handleCompareEnd}
                          className="text-xs font-bold text-pastel-highlight hover:text-pastel-text flex items-center gap-2 transition-colors cursor-pointer select-none active:scale-95"
                        >
                          <RotateCcw className="w-4 h-4" /> 按住对比原图
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-28 h-28 bg-pastel-bg rounded-[2.5rem] flex items-center justify-center mb-8 border border-pastel-border overflow-hidden">
                  <Wand2 className="w-12 h-12 text-pastel-pink animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-pastel-text mb-3">开启您的创意旅程</h3>
                <p className="text-sm text-pastel-muted mb-10 max-w-[320px] leading-relaxed">从工作室中选择一张照片，或上传您的产品实拍图，开启专业级 AI 修图流程。</p>

                <label className="px-12 py-4 bg-pastel-pink hover:bg-pastel-pinkhover text-pastel-text rounded-2xl font-bold text-sm tracking-relaxed cursor-pointer transition-all shadow-lg active:scale-95 group border border-white/50">
                  <span className="flex items-center gap-3">
                    <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    上传产品实拍图
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. 专业控制引擎 (侧边栏优化) */}
      <aside className="w-[420px] bg-white border-l border-pastel-border flex flex-col z-50 overflow-hidden shadow-[-40px_0_80px_rgba(0,0,0,0.02)]">

        {/* 侧边栏头部 - 增强品牌视觉 */}
        <div className="p-10 border-b border-pastel-bg bg-gradient-to-br from-white to-pastel-bg/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pastel-pink/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-pastel-highlight/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-pastel-highlight" />
              </div>
              <h2 className="text-[11px] font-black text-pastel-highlight uppercase tracking-[0.4em]">Creative Intelligence</h2>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-black text-pastel-text tracking-tight">创意中心</h3>
              <span className="text-[10px] font-black bg-pastel-text text-white px-3 py-1.5 rounded-lg shadow-sm">ELITE 4.0</span>
            </div>
          </div>
        </div>

        {/* Control Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

          {/* Camera Settings */}
          {/* Camera Settings - Pro Max Style */}
          {mode === 'camera' && (
            <div className="space-y-8 animate-in slide-in-from-top-6 duration-700 pb-10">

              {/* Header */}
              <div className="flex items-center gap-3 border-b border-pastel-border/50 pb-4">
                <div className="p-2 bg-gradient-to-br from-pastel-bg to-white rounded-xl shadow-sm border border-pastel-border">
                  <Compass className="w-5 h-5 text-pastel-highlight" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pastel-text">3D 空间运镜系统</h3>
                  <p className="text-[10px] text-pastel-muted font-medium">全方位虚拟摄影系统</p>
                </div>
              </div>

              {/* 3D Visualizer - Larger & Clearer */}
              <div className="bg-gradient-to-b from-white to-pastel-bg/30 p-1 rounded-[2rem] border border-pastel-border shadow-sm">
                <div className="h-64 rounded-[1.8rem] bg-white border border-pastel-border/50 flex items-center justify-center relative overflow-hidden group">
                  {/* Grid Background */}
                  <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                  </div>

                  {/* Axis Indicators */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-full h-px bg-pastel-highlight"></div>
                    <div className="h-full w-px bg-pastel-highlight"></div>
                  </div>

                  {/* The 3D Object */}
                  <div style={{ perspective: '1000px' }} className="w-48 h-48 flex items-center justify-center z-10">
                    <div
                      className="w-24 h-24 relative transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) transform-style-3d"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: `rotateX(${cameraAngle.pitch}deg) rotateY(${cameraAngle.yaw}deg) scale(${1.2 / (cameraAngle.zoom || 1)})`
                      }}
                    >
                      {/* Cube Faces with Pro Styling */}
                      {[
                        { id: 'front', tx: 'translateZ(48px)', bg: 'bg-white', border: 'border-pastel-highlight', text: '正面', col: 'text-pastel-highlight' },
                        { id: 'back', tx: 'rotateY(180deg) translateZ(48px)', bg: 'bg-pastel-bg', border: 'border-pastel-border', text: '背面', col: 'text-pastel-muted' },
                        { id: 'right', tx: 'rotateY(90deg) translateZ(48px)', bg: 'bg-white', border: 'border-pastel-border', text: '右侧', col: 'text-pastel-muted' },
                        { id: 'left', tx: 'rotateY(-90deg) translateZ(48px)', bg: 'bg-white', border: 'border-pastel-border', text: '左侧', col: 'text-pastel-muted' },
                        { id: 'top', tx: 'rotateX(90deg) translateZ(48px)', bg: 'bg-white', border: 'border-pastel-border', text: '顶部', col: 'text-pastel-muted' },
                        { id: 'bottom', tx: 'rotateX(-90deg) translateZ(48px)', bg: 'bg-white', border: 'border-pastel-border', text: '底部', col: 'text-pastel-muted' }
                      ].map(face => (
                        <div key={face.id} className={`absolute inset-0 ${face.bg} border-2 ${face.border} flex items-center justify-center shadow-lg backface-hidden transition-all duration-300`} style={{ transform: face.tx }}>
                          <span className={`text-[12px] font-black tracking-widest ${face.col}`}>{face.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute top-4 left-4">
                    <span className="text-[10px] font-mono font-bold text-pastel-highlight bg-pastel-pink/10 px-2 py-1 rounded-md border border-pastel-pink/20">
                      方位: {cameraAngle.yaw}° / 俯仰: {cameraAngle.pitch}°
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls Container */}
              <div className="space-y-6">

                {/* 1. Quick Presets */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-pastel-text flex items-center gap-2">
                    <MousePointer2 className="w-3.5 h-3.5 text-pastel-muted" />
                    <span>快速视角</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { l: '正面', v: 0 }, { l: '右侧', v: 90 }, { l: '背面', v: 180 }, { l: '左侧', v: 270 }
                    ].map(p => (
                      <button
                        key={p.l}
                        onClick={() => setCameraAngle({ ...cameraAngle, yaw: p.v })}
                        className={`py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 border ${cameraAngle.yaw === p.v ? 'bg-pastel-text text-white border-pastel-text shadow-lg transform scale-105' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight hover:text-pastel-highlight'}`}
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCameraAngle({ ...cameraAngle, pitch: -30 })} className="flex-1 py-2.5 rounded-xl text-[10px] font-bold bg-white border border-pastel-border text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-all">仰拍</button>
                    <button onClick={() => setCameraAngle({ ...cameraAngle, pitch: 60 })} className="flex-1 py-2.5 rounded-xl text-[10px] font-bold bg-white border border-pastel-border text-pastel-muted hover:border-pastel-highlight hover:text-pastel-highlight transition-all">俯拍</button>
                    <button onClick={() => setCameraAngle({ yaw: 0, pitch: 0, zoom: 1 })} className="px-4 py-2.5 rounded-xl bg-pastel-bg border border-pastel-border text-pastel-muted hover:bg-pastel-highlight hover:text-white transition-all"><RotateCcw className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* 2. Aspect Ratio Selector (NEW) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-pastel-text flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 text-pastel-muted" />
                      <span>画幅比例</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '正方形 1:1', val: AspectRatio.SQUARE },
                      { label: '竖屏 3:4', val: AspectRatio.PORTRAIT_3_4 },
                      { label: '横屏 4:3', val: AspectRatio.LANDSCAPE_4_3 },
                      { label: '全屏竖 9:16', val: AspectRatio.PORTRAIT_9_16 },
                      { label: '电影横 16:9', val: AspectRatio.LANDSCAPE_16_9 },
                      { label: '超宽幅 21:9', val: AspectRatio.LANDSCAPE_21_9 },
                    ].map((ratio) => (
                      <button
                        key={ratio.val}
                        onClick={() => setSelectedAspectRatio(ratio.val)}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${selectedAspectRatio === ratio.val ? 'bg-pastel-pink text-pastel-text border-pastel-pink shadow-md' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-pink'}`}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Fine Tuning Sliders */}
                <div className="bg-white p-5 rounded-[1.5rem] border border-pastel-border space-y-6 shadow-sm">
                  <div className="space-y-4">
                    {/* Yaw */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-pastel-muted mb-2">
                        <span>水平旋转</span>
                        <span className="bg-pastel-bg px-2 py-0.5 rounded text-pastel-highlight">{cameraAngle.yaw}°</span>
                      </div>
                      <input type="range" min="0" max="360" step="15" value={cameraAngle.yaw} onChange={(e) => setCameraAngle({ ...cameraAngle, yaw: parseInt(e.target.value) })}
                        className="w-full h-2 bg-pastel-bg rounded-full appearance-none cursor-pointer accent-pastel-highlight" />
                    </div>

                    {/* Pitch */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-pastel-muted mb-2">
                        <span>垂直俯仰</span>
                        <span className="bg-pastel-bg px-2 py-0.5 rounded text-pastel-highlight">{cameraAngle.pitch}°</span>
                      </div>
                      <input type="range" min="-90" max="90" step="5" value={cameraAngle.pitch} onChange={(e) => setCameraAngle({ ...cameraAngle, pitch: parseInt(e.target.value) })}
                        className="w-full h-2 bg-pastel-bg rounded-full appearance-none cursor-pointer accent-pastel-highlight" />
                    </div>

                    {/* Zoom */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-pastel-muted mb-2">
                        <span>镜头距离</span>
                        <span className="bg-pastel-bg px-2 py-0.5 rounded text-pastel-highlight">×{cameraAngle.zoom}</span>
                      </div>
                      <input type="range" min="0.5" max="2.5" step="0.1" value={cameraAngle.zoom} onChange={(e) => setCameraAngle({ ...cameraAngle, zoom: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-pastel-bg rounded-full appearance-none cursor-pointer accent-pastel-highlight" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleCameraShift}
                disabled={isEditing}
                className="w-full py-5 bg-gradient-to-r from-pastel-text to-gray-800 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                {isEditing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {isEditing ? '正在渲染新视角...' : '生成新视角'}
              </button>
            </div>
          )}

          {/* Brush Settings */}
          {mode === 'eraser' && (
            <div className="space-y-5 animate-in slide-in-from-top-4 duration-700">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-pastel-muted uppercase tracking-widest">消除笔大小</label>
                <span className="text-xs font-bold text-pastel-highlight font-mono">{brushSize}px</span>
              </div>
              <div className="relative pt-2">
                <input
                  type="range"
                  min="10" max="200"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-pastel-bg rounded-lg appearance-none cursor-pointer accent-pastel-pink"
                />
              </div>
              <p className="text-[10px] text-pastel-muted font-medium bg-pastel-bg/50 p-3 rounded-xl border border-pastel-border/50">
                提示：使用消除笔涂满您希望 AI 重新构思或移除的区域。
              </p>
            </div>
          )}

          {/* 标记点列表 - 增强紧凑度与美感 */}
          {points.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-black text-pastel-muted uppercase tracking-widest">选中焦点点位 ({points.length})</label>
                <button onClick={clearAll} className="text-[10px] font-bold text-pastel-highlight hover:underline">全部移除</button>
              </div>
              <div className="bg-pastel-bg/30 border border-pastel-border/60 rounded-[2rem] p-4 max-h-[160px] overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2.5">
                  {points.map((p, i) => (
                    <div key={p.id} className="relative bg-white border border-pastel-border/80 pl-2 pr-4 py-2 rounded-2xl flex items-center gap-3 group/mark shadow-sm hover:shadow-md hover:border-pastel-pink transition-all">
                      {/* Thumbnail Preview */}
                      {p.snapshot && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-pastel-border shadow-inner shrink-0 relative">
                          <img src={p.snapshot} alt="Crop" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-pastel-highlight/10"></div>
                        </div>
                      )}

                      <div className="w-5 h-5 bg-pastel-highlight text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</div>
                      <span className="text-[11px] font-bold text-pastel-text truncate max-w-[60px]">点位{i + 1}</span>
                      <button
                        onClick={() => setPoints(points.filter(item => item.id !== p.id))}
                        className="opacity-0 group-hover/mark:opacity-100 p-1 text-pastel-muted hover:text-red-500 transition-all scale-75 group-hover/mark:scale-100 absolute -top-1 -right-1 bg-white rounded-full shadow-sm border border-pastel-border"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 指令输入区 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-pastel-muted uppercase tracking-widest flex items-center gap-2">
                编辑需求指令
                <div className="w-1.5 h-1.5 bg-pastel-pink rounded-full"></div>
              </label>

              {/* Toolbar Moved Here */}
              <div className="flex items-center gap-2">
                {/* Refine / Continue Button */}
                <button
                  onClick={() => setShowRefineInput(!showRefineInput)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all
                     ${showRefineInput ? 'bg-pastel-pink text-white border-pastel-pink' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-pink hover:text-pastel-highlight'}`}
                >
                  <Sparkles className="w-3 h-3" />
                  {showRefineInput ? '取消优化' : '继续优化'}
                </button>

                {/* AI Polish Button */}
                <button
                  onClick={handleOptimizePrompt}
                  disabled={isOptimizing || (!editPrompt && referenceImages.length === 0)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-all
                     ${isOptimizing ? 'bg-pastel-bg text-pastel-muted cursor-wait' : 'bg-pastel-text text-white hover:bg-black'}`}
                >
                  {isOptimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-300" />}
                  AI 润色
                </button>
              </div>
            </div>

            {/* Refine Input Area (Conditional) */}
            {showRefineInput && (
              <div className="animate-in slide-in-from-top-2 duration-300 flex gap-2">
                <input
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRefinePrompt()}
                  placeholder="请输入优化指令，例如：'更简洁一点' 或 '强调皮革质感'..."
                  className="flex-1 bg-white border border-pastel-pink/50 rounded-xl px-4 py-2 text-xs font-medium text-pastel-text focus:outline-none focus:ring-2 focus:ring-pastel-pink/20 placeholder:text-pastel-muted/70"
                  autoFocus
                />
                <button
                  onClick={handleRefinePrompt}
                  disabled={!refineInstruction || isOptimizing}
                  className="px-4 py-1.5 bg-pastel-highlight text-white text-xs font-bold rounded-xl hover:bg-pastel-pink transition-colors disabled:opacity-50"
                >
                  发送
                </button>
              </div>
            )}

            <div className="relative group">
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder={mode === 'eraser' ? "涂抹区域应该生成或更换为什么内容？" : "描述您的创意想法，例如：'在产品周围添加柔和的玫瑰花瓣'"}
                className="w-full h-40 bg-pastel-input border border-pastel-border rounded-[2rem] p-6 text-sm focus:ring-4 focus:ring-pastel-pink/10 focus:border-pastel-pink outline-none resize-none text-pastel-text placeholder:text-pastel-muted transition-all font-medium leading-relaxed mb-2"
              />
            </div>

            {/* Reference Image Upload Area (NEW) */}
            <div className="space-y-3 pt-2 border-t border-dashed border-pastel-border/50">
              <label className="text-[11px] font-bold text-pastel-muted uppercase tracking-widest flex items-center justify-between">
                参考图 (Reference Images)
                <span className="text-[9px] bg-pastel-bg px-2 py-0.5 rounded text-pastel-muted">{referenceImages.length}/3</span>
              </label>

              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {/* Upload Button */}
                {referenceImages.length < 3 && (
                  <label className="flex-shrink-0 w-20 h-20 rounded-2xl border-2 border-dashed border-pastel-border hover:border-pastel-pink hover:bg-pastel-bg/50 flex flex-col items-center justify-center cursor-pointer transition-all group/upload">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm group-hover/upload:scale-110 transition-transform">
                      <Upload className="w-4 h-4 text-pastel-muted group-hover/upload:text-pastel-pink" />
                    </div>
                    <span className="text-[9px] font-bold text-pastel-muted mt-2">上传参考</span>
                    <input type="file" accept="image/*" multiple onChange={handleRefUpload} className="hidden" />
                  </label>
                )}

                {/* Image List */}
                {referenceImages.map((ref) => (
                  <div key={ref.id} className="relative flex-shrink-0 w-20 h-20 rounded-2xl border border-pastel-border overflow-hidden group/ref shadow-sm">
                    <img src={`data:${ref.mimeType};base64,${ref.base64}`} alt="Ref" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeRefImage(ref.id)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover/ref:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 预设灵感 */}
            <div className="flex flex-wrap gap-2 pt-1">
              {['纯白展示台', '自然阳光', '添加倒影'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setEditPrompt(tag)}
                  className="text-[10px] font-bold px-4 py-2 rounded-full border border-pastel-border bg-white text-pastel-muted hover:border-pastel-pink hover:text-pastel-highlight transition-all shadow-sm"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-bold text-pastel-muted uppercase tracking-widest block">
              输出分辨率
            </label>
            <div className="flex bg-pastel-bg p-1 rounded-2xl border border-pastel-border">
              {[ImageResolution.RES_1K, ImageResolution.RES_2K, ImageResolution.RES_4K].map((res) => (
                <button
                  key={res}
                  onClick={() => setSelectedResolution(res)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${selectedResolution === res
                    ? 'bg-white text-pastel-highlight shadow-sm'
                    : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Diagnostics */}
          {error && (
            <div className="p-5 bg-[#FFF0F3] border border-pastel-border rounded-[2rem] flex flex-col gap-4 animate-in shake duration-500">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-pastel-highlight shrink-0" />
                <p className="text-xs font-bold text-pastel-text leading-normal">{error}</p>
              </div>
              {error.includes("Key") && (
                <button
                  onClick={() => (window as any).aistudio?.openSelectKey()}
                  className="w-full py-2.5 bg-white border border-pastel-border rounded-xl text-xs font-bold text-pastel-highlight hover:bg-pastel-bg transition-all"
                >
                  验证工作室 API 密钥
                </button>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮区 - 极致视觉反馈 */}
        <div className="p-10 border-t border-pastel-bg bg-white relative">
          <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent -translate-y-full pointer-events-none"></div>
          <button
            onClick={handleEdit}
            disabled={!currentImage || (!editPrompt && points.length === 0 && !getMaskBase64() && referenceImages.length === 0) || isEditing}
            className={`w-full py-6 rounded-[2.5rem] font-bold text-[15px] tracking-[0.1em] uppercase flex items-center justify-center gap-4 transition-all active:scale-[0.96] group relative overflow-hidden ${!currentImage || (!editPrompt && points.length === 0 && !getMaskBase64() && referenceImages.length === 0)
              ? 'bg-pastel-bg text-pastel-border cursor-not-allowed border border-pastel-border'
              : isEditing
                ? 'bg-pastel-pink cursor-wait text-pastel-text shadow-inner'
                : 'bg-pastel-text text-white hover:bg-black shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] hover:-translate-y-1.5 active:translate-y-0'
              }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-pastel-pink/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {isEditing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> 处理并渲染中...</>
            ) : (
              <><Wand2 className={`w-5 h-5 ${currentImage && 'group-hover:rotate-12 transition-transform'}`} /> 执行创意方案</>
            )}
          </button>
          <div className="mt-8 flex items-center justify-center gap-4 opacity-40">
            <div className="h-px w-8 bg-pastel-muted"></div>
            <p className="text-[9px] font-black text-pastel-muted uppercase tracking-[0.5em]">Skysper Intelligence</p>
            <div className="h-px w-8 bg-pastel-muted"></div>
          </div>
        </div>
      </aside>
    </div>
  );
};

const ToolButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}> = ({ active, onClick, icon, label, danger }) => (
  <button
    onClick={onClick}
    className={`p-5 rounded-[2.5rem] transition-all relative group shadow-sm ${active
      ? 'bg-pastel-text text-white shadow-[0_15px_30px_rgba(0,0,0,0.15)] scale-110 z-10'
      : danger
        ? 'text-pastel-muted bg-white hover:bg-rose-50 hover:text-red-500 border border-pastel-border/50 hover:border-red-200'
        : 'text-pastel-muted bg-white hover:bg-pastel-bg hover:text-pastel-text border border-pastel-border/50 hover:border-pastel-pink'
      }`}
  >
    <div className={`${active ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
      {icon}
    </div>

    {/* 便捷气泡 */}
    <div className="absolute left-full ml-6 px-4 py-2 bg-pastel-text text-white text-[11px] font-bold rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-3 group-hover:translate-x-0 whitespace-nowrap z-50 uppercase tracking-widest shadow-2xl border border-white/10">
      {label}
      <div className="absolute left-0 top-1/2 -underline-translate-x-1 -translate-y-1/2 border-[6px] border-transparent border-r-pastel-text"></div>
    </div>

    {active && (
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-pastel-pink rounded-full shadow-[0_0_15px_rgba(255,196,214,1)] animate-in fade-in slide-in-from-left-2 duration-500"></div>
    )}
  </button>
);

export default EditorTab;