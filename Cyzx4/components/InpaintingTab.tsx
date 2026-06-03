import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateInpainting, blobToBase64 } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { storageService, Project } from '../../services/storageService';
import { Eraser, Upload, Loader2, AlertCircle, X, Sparkles, Key, Image as ImageIcon, Wand2, Monitor, Grid, Download, Paintbrush, RotateCcw, Cpu, Minus, Plus, Crop, SlidersHorizontal } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';
import { useImagePaste } from '../hooks/useImagePaste';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';

// 自定义香蕉图标组件（复用）
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

const InpaintingTab: React.FC = () => {
  // 图片状态
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  // 画笔状态
  const [brushSize, setBrushSize] = useState(30);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [showMaskGuide, setShowMaskGuide] = useState(false);
  const [showStructureGuide, setShowStructureGuide] = useState(false);

  // 参考图状态
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);

  // 批量生成（参考图批量）
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedRefIdxs, setSelectedRefIdxs] = useState<number[]>([]);
  const [resultView, setResultView] = useState<'single' | 'batch'>('single');
  const [batchResults, setBatchResults] = useState<Array<{ refIdx: number; refUrl: string; image?: string; error?: string }>>([]);

  // 面料参考图状态（用于保证面料纹理一致性，最多2张）
  const [fabricRefFiles, setFabricRefFiles] = useState<File[]>([]);
  const [fabricRefUrls, setFabricRefUrls] = useState<string[]>([]);

  // 颜色参考图状态（用于保证颜色一致性，最多2张）
  const [colorRefFiles, setColorRefFiles] = useState<File[]>([]);
  const [colorRefUrls, setColorRefUrls] = useState<string[]>([]);

  // Structure reference for crop-and-paste-back style replacement.
  const [structureRefFiles, setStructureRefFiles] = useState<File[]>([]);
  const [structureRefUrls, setStructureRefUrls] = useState<string[]>([]);
  const [cropPasteEnabled, setCropPasteEnabled] = useState(true);
  const [cropPadding, setCropPadding] = useState(5);
  const [cropBlend, setCropBlend] = useState(1);
  const [cropExpand, setCropExpand] = useState(0.3);

  // 生成状态
  const [description, setDescription] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_1K);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');

  // 当切换到 gpt-image-2 时，自动修正不兼容的参数
  useEffect(() => {
    if (selectedModel === 'gpt-image-2') {
      if (resolution === ImageResolution.RES_05K) {
        setResolution(ImageResolution.RES_1K);
      }
      const allowedRatios = [
        AspectRatio.SQUARE, 
        AspectRatio.LANDSCAPE_3_2, 
        AspectRatio.PORTRAIT_2_3, 
        AspectRatio.LANDSCAPE_16_9, 
        AspectRatio.PORTRAIT_9_16
      ];
      if (!allowedRatios.includes(aspectRatio)) {
        setAspectRatio(AspectRatio.SQUARE);
      }
    }
  }, [selectedModel]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // 更多拖拽状态
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [isDraggingFabric, setIsDraggingFabric] = useState(false);
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  const [isDraggingStructure, setIsDraggingStructure] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const fabricRefInputRef = useRef<HTMLInputElement>(null);
  const colorRefInputRef = useRef<HTMLInputElement>(null);
  const structureRefInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);

  // 上传图片
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) return;
      setSourceFile(file);
      const url = URL.createObjectURL(file);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceUrl(url);
      setGeneratedImages([]);
      setHasMask(false);
    }
  };

  const removeSource = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(null);
    setSourceUrl(null);
    setHasMask(false);
    setGeneratedImages([]);
  };

  // 绑定剪贴板粘贴事件
  useImagePaste((files) => {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // 如果当前还没有原图，则设置为原图
    if (!sourceFile) {
      setSourceFile(file);
      const url = URL.createObjectURL(file);
      setSourceUrl(url);
      setGeneratedImages([]);
      setHasMask(false);
    } 
    // 否则作为参考图加入
    else {
      if (refFiles.length + files.length > 10) {
        setError('参考图最多10张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const urls = files.map(f => URL.createObjectURL(f));
      setRefFiles(prev => [...prev, ...files]);
      setRefUrls(prev => [...prev, ...urls]);
    }
  });

  // 参考图操作
  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (refFiles.length + files.length > 10) {
        setError('参考图最多10张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      const startIdx = refFiles.length;
      const urls = files.map(f => URL.createObjectURL(f));

      setRefFiles(prev => [...prev, ...files]);
      setRefUrls(prev => [...prev, ...urls]);

      // 批量模式下，新上传的参考图默认加入勾选
      if (isBatchMode) {
        setSelectedRefIdxs(prev => {
          const next = new Set(prev);
          for (let i = 0; i < files.length; i++) next.add(startIdx + i);
          return Array.from(next).sort((a, b) => a - b);
        });
      }
    }
  };

  // 面料参考图操作（最多2张）
  const handleFabricRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (fabricRefFiles.length + files.length > 2) {
        setError('面料参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setFabricRefFiles(prev => [...prev, ...files]);
      setFabricRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  // 颜色参考图操作（最多2张）
  const handleColorRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (colorRefFiles.length + files.length > 2) {
        setError('颜色参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setColorRefFiles(prev => [...prev, ...files]);
      setColorRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const handleStructureRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      if (structureRefFiles.length + files.length > 2) {
        setError('结构参考最多2张');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setStructureRefFiles(prev => [...prev, ...files]);
      setStructureRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeRefImage = (idx: number) => {
    URL.revokeObjectURL(refUrls[idx]);
    setRefFiles(prev => prev.filter((_, i) => i !== idx));
    setRefUrls(prev => prev.filter((_, i) => i !== idx));

    // keep selection indices consistent
    setSelectedRefIdxs(prev =>
      prev
        .filter(i => i !== idx)
        .map(i => (i > idx ? i - 1 : i))
    );

    // prune batch results
    setBatchResults(prev =>
      prev
        .filter(r => r.refIdx !== idx)
        .map(r => (r.refIdx > idx ? { ...r, refIdx: r.refIdx - 1 } : r))
    );
  };

  const removeFabricRefImage = (idx: number) => {
    URL.revokeObjectURL(fabricRefUrls[idx]);
    setFabricRefFiles(prev => prev.filter((_, i) => i !== idx));
    setFabricRefUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const removeColorRefImage = (idx: number) => {
    URL.revokeObjectURL(colorRefUrls[idx]);
    setColorRefFiles(prev => prev.filter((_, i) => i !== idx));
    setColorRefUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const removeStructureRefImage = (idx: number) => {
    URL.revokeObjectURL(structureRefUrls[idx]);
    setStructureRefFiles(prev => prev.filter((_, i) => i !== idx));
    setStructureRefUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // 当图片源变化时，初始化双层 canvas
  useEffect(() => {
    if (!sourceUrl) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      
      const setupCanvas = () => {
        const container = canvasContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width;
        const scale = containerWidth / img.naturalWidth;
        const displayHeight = img.naturalHeight * scale;

        const srcCanvas = sourceCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!srcCanvas || !maskCanvas) return;

        // 设置画布物理尺寸（与显示尺寸 1:1）
        srcCanvas.width = containerWidth;
        srcCanvas.height = displayHeight;
        maskCanvas.width = containerWidth;
        maskCanvas.height = displayHeight;

        // 设置画布样式高度（确保蒙版层与图片层完全重合）
        srcCanvas.style.height = `${displayHeight}px`;
        maskCanvas.style.height = `${displayHeight}px`;

        // 绘制原图到底层
        const srcCtx = srcCanvas.getContext('2d');
        if (srcCtx) {
          srcCtx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
          srcCtx.drawImage(img, 0, 0, containerWidth, displayHeight);
        }

        // 注意：不在这里清除蒙版，除非是第一次加载
        // 如果蒙版已存在，重置画布尺寸会清空它，这里需要根据需要权衡
      };
      
      setupCanvas();
      
      // 添加窗口调整监听以自适应
      window.addEventListener('resize', setupCanvas);
      return () => window.removeEventListener('resize', setupCanvas);
    };
    img.src = sourceUrl;
  }, [sourceUrl]);

  // 画笔绘制
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // 计算缩放比例，处理 canvas 显示尺寸与属性尺寸不一致的情况
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // 辅助函数：根据缩放比例获取展示层的光标位置（用于 CSS Circle 预览）
  const getDisplayPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const drawAt = useCallback((x: number, y: number, previous?: { x: number; y: number } | null) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
    ctx.fillStyle = 'rgba(255, 80, 80, 0.45)';
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.45)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (previous) {
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.beginPath();
    
    // 关键修正：笔触大小也需要考虑缩放比例，或者确保绘制是在内部坐标系下正确的
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 80, 80, 0.45)';
    ctx.fill();

    if (!isErasing) setHasMask(true);
  }, [brushSize, isErasing]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getCanvasPos(e);
    lastDrawPointRef.current = pos;
    drawAt(pos.x, pos.y);
  }, [getCanvasPos, drawAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e); // 绘图坐标（内部）
    const dispPos = getDisplayPos(e); // 显示坐标（外部 CSS）
    setCursorPos(dispPos);
    
    if (!isDrawing) return;
    drawAt(pos.x, pos.y, lastDrawPointRef.current);
    lastDrawPointRef.current = pos;
  }, [isDrawing, getCanvasPos, getDisplayPos, drawAt]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    lastDrawPointRef.current = null;
  }, []);

  const handleMouseEnter = useCallback(() => {
    setShowCursor(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDrawing(false);
    lastDrawPointRef.current = null;
    setShowCursor(false);
    setCursorPos(null);
  }, []);

  // 清除蒙版
  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasMask(false);
  };

  // 导出蒙版为黑白图
  const getMaskExpandPixels = () => {
    if (!cropPasteEnabled || structureRefFiles.length === 0) return 0;
    return Math.max(0, Math.round(cropPadding + cropExpand * 30));
  };

  const exportMask = (expandPixels = 0): string | null => {
    const maskCanvas = maskCanvasRef.current;
    const srcCanvas = sourceCanvasRef.current;
    if (!maskCanvas || !srcCanvas || !imgRef.current) return null;

    // 创建一个与原图同分辨率的 canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = imgRef.current.naturalWidth;
    exportCanvas.height = imgRef.current.naturalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    // 全黑底
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // 将蒙版层缩放到原图分辨率并提取 alpha
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgRef.current.naturalWidth;
    tempCanvas.height = imgRef.current.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    if (expandPixels > 0) {
      tempCtx.filter = `blur(${expandPixels}px)`;
      tempCtx.drawImage(maskCanvas, 0, 0, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
      tempCtx.filter = 'none';
    } else {
      tempCtx.drawImage(maskCanvas, 0, 0, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
    }
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    // Alpha > 0 的像素 -> 白色（编辑区域），否则保持黑色（保留区域）
    const outData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > (expandPixels > 0 ? 2 : 10)) { // alpha threshold
        outData.data[i] = 255;     // R
        outData.data[i + 1] = 255; // G
        outData.data[i + 2] = 255; // B
        outData.data[i + 3] = 255; // A
      }
    }
    ctx.putImageData(outData, 0, 0);

    return exportCanvas.toDataURL('image/png').split(',')[1]; // Return base64 only
  };

  const exportPaintEditMap = (): string | null => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !imgRef.current) return null;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = imgRef.current.naturalWidth;
    exportCanvas.height = imgRef.current.naturalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(imgRef.current, 0, 0, exportCanvas.width, exportCanvas.height);
    ctx.globalAlpha = 0.72;
    ctx.drawImage(maskCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    ctx.globalAlpha = 1;

    return exportCanvas.toDataURL('image/png').split(',')[1];
  };

  const loadCanvasImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const pasteGeneratedIntoMask = async (
    sourceDataUrl: string,
    generatedDataUrl: string,
    maskBase64: string,
    blendRadius = 0
  ): Promise<string> => {
    const [sourceImg, generatedImg, maskImg] = await Promise.all([
      loadCanvasImage(sourceDataUrl),
      loadCanvasImage(generatedDataUrl),
      loadCanvasImage(`data:image/png;base64,${maskBase64}`),
    ]);

    const width = sourceImg.naturalWidth || sourceImg.width;
    const height = sourceImg.naturalHeight || sourceImg.height;

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const resultCtx = resultCanvas.getContext('2d');
    if (!resultCtx) return generatedDataUrl;

    resultCtx.drawImage(sourceImg, 0, 0, width, height);

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = width;
    patchCanvas.height = height;
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) return generatedDataUrl;

    patchCtx.drawImage(generatedImg, 0, 0, width, height);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return generatedDataUrl;
    if (blendRadius > 0) {
      maskCtx.filter = `blur(${Math.max(0, blendRadius)}px)`;
      maskCtx.drawImage(maskImg, 0, 0, width, height);
      maskCtx.filter = 'none';
    } else {
      maskCtx.drawImage(maskImg, 0, 0, width, height);
    }

    patchCtx.globalCompositeOperation = 'destination-in';
    patchCtx.drawImage(maskCanvas, 0, 0, width, height);

    resultCtx.drawImage(patchCanvas, 0, 0, width, height);
    return resultCanvas.toDataURL('image/png');
  };

  const parseAspectRatioValue = (ratio: AspectRatio) => {
    const [w, h] = ratio.split(':').map(Number);
    return w / h;
  };

  const closestAspectRatioForSize = (width: number, height: number) => {
    const sourceRatio = width / height;
    return Object.values(AspectRatio).reduce((best, current) => {
      const bestDiff = Math.abs(parseAspectRatioValue(best) - sourceRatio);
      const currentDiff = Math.abs(parseAspectRatioValue(current) - sourceRatio);
      return currentDiff < bestDiff ? current : best;
    }, AspectRatio.SQUARE);
  };

  const createMaskedCropPackage = async (
    sourceDataUrl: string,
    maskBase64: string,
    editMapBase64: string | null,
    extraPadding: number
  ) => {
    const [sourceImg, maskImg, editMapImg] = await Promise.all([
      loadCanvasImage(sourceDataUrl),
      loadCanvasImage(`data:image/png;base64,${maskBase64}`),
      editMapBase64 ? loadCanvasImage(`data:image/png;base64,${editMapBase64}`) : Promise.resolve(null),
    ]);

    const width = sourceImg.naturalWidth || sourceImg.width;
    const height = sourceImg.naturalHeight || sourceImg.height;

    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = width;
    scanCanvas.height = height;
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!scanCtx) return null;
    scanCtx.drawImage(maskImg, 0, 0, width, height);

    const data = scanCtx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        if (data[idx] > 180 || data[idx + 3] > 180) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;

    const maskWidth = maxX - minX + 1;
    const maskHeight = maxY - minY + 1;
    const contextualPadding = Math.max(
      24,
      Math.round(Math.max(maskWidth, maskHeight) * 0.22),
      Math.round(extraPadding)
    );
    const x = Math.max(0, minX - contextualPadding);
    const y = Math.max(0, minY - contextualPadding);
    const right = Math.min(width, maxX + contextualPadding + 1);
    const bottom = Math.min(height, maxY + contextualPadding + 1);
    const cropWidth = right - x;
    const cropHeight = bottom - y;

    const makeCrop = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      return canvas.toDataURL('image/png').split(',')[1];
    };

    const sourceCrop = makeCrop(sourceImg);
    const maskCrop = makeCrop(maskImg);
    const editMapCrop = editMapImg ? makeCrop(editMapImg) : null;
    if (!sourceCrop || !maskCrop) return null;

    return {
      source: { base64: sourceCrop, mimeType: 'image/png' },
      mask: { base64: maskCrop, mimeType: 'image/png' },
      editMap: editMapCrop ? { base64: editMapCrop, mimeType: 'image/png' } : undefined,
      bounds: { x, y, width: cropWidth, height: cropHeight },
      aspectRatio: closestAspectRatioForSize(cropWidth, cropHeight),
    };
  };

  const pasteGeneratedCropIntoSource = async (
    sourceDataUrl: string,
    generatedCropDataUrl: string,
    cropMaskBase64: string,
    bounds: { x: number; y: number; width: number; height: number },
    blendRadius = 0
  ) => {
    const [sourceImg, generatedImg, maskImg] = await Promise.all([
      loadCanvasImage(sourceDataUrl),
      loadCanvasImage(generatedCropDataUrl),
      loadCanvasImage(`data:image/png;base64,${cropMaskBase64}`),
    ]);

    const width = sourceImg.naturalWidth || sourceImg.width;
    const height = sourceImg.naturalHeight || sourceImg.height;
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const resultCtx = resultCanvas.getContext('2d');
    if (!resultCtx) return generatedCropDataUrl;
    resultCtx.drawImage(sourceImg, 0, 0, width, height);

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = bounds.width;
    patchCanvas.height = bounds.height;
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) return generatedCropDataUrl;
    patchCtx.drawImage(generatedImg, 0, 0, bounds.width, bounds.height);

    const cropMaskCanvas = document.createElement('canvas');
    cropMaskCanvas.width = bounds.width;
    cropMaskCanvas.height = bounds.height;
    const cropMaskCtx = cropMaskCanvas.getContext('2d');
    if (!cropMaskCtx) return generatedCropDataUrl;
    if (blendRadius > 0) {
      cropMaskCtx.filter = `blur(${Math.max(0, blendRadius)}px)`;
    }
    cropMaskCtx.drawImage(maskImg, 0, 0, bounds.width, bounds.height);
    cropMaskCtx.filter = 'none';

    patchCtx.globalCompositeOperation = 'destination-in';
    patchCtx.drawImage(cropMaskCanvas, 0, 0, bounds.width, bounds.height);
    resultCtx.drawImage(patchCanvas, bounds.x, bounds.y);
    return resultCanvas.toDataURL('image/png');
  };

  const buildStructureLockedPrompt = (basePrompt: string, hasStructureRef: boolean) => {
    if (!hasStructureRef) return basePrompt;
    return `${basePrompt}

# 结构参考裁切贴回硬规则
这是局部边缘修图，不是整件衣服重画。
- 当前可能只提供了涂抹区域周围的裁切小图。必须把这块裁切图当作局部手术区域处理，重绘白色蒙版内的结构后再无缝贴回原图。
- 只编辑白色蒙版区域；黑色蒙版区域必须保持原图不变。
- 结构参考图只用于白色区域内的局部边缘结构：领口边、袖口边、包边厚度、缝线位置、边缘曲线、褶皱方向和端点连接。
- 不要把结构参考图里的整件衣服、人体、背景、肤色、首饰或光线复制进来。
- 如果蒙版只涂了窄边，只生成窄边；不要扩展到胸口、肩膀、整只袖子或整件上衣。
- 新边缘必须贴合原图未涂抹区域，和原本布料自然连接，不允许出现双领口、双袖口、漂浮边、断裂缝线、错位拼接。`;
  };

  // 生成
  const handleGenerate = async () => {
    if (!sourceFile || !hasMask || !description) return;
    setError(null);
    setProgress('');
    setResultView('single');

    if ((window as any).aistudio) {
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) { }
    }

    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      assertCurrentGenerationTask(taskId, signal);
      // 1. 压缩原图
      setProgress('正在压缩原图...');
      const sourceBase64 = await blobToBase64(sourceFile);
      assertCurrentGenerationTask(taskId, signal);
      const sourceDataUrl = `data:${sourceFile.type};base64,${sourceBase64}`;

      // 2. 导出蒙版
      const maskExpandPixels = getMaskExpandPixels();
      setProgress(maskExpandPixels > 0 ? `正在导出蒙版并外扩 ${maskExpandPixels}px...` : '正在导出蒙版...');
      const maskBase64 = exportMask(maskExpandPixels);
      if (!maskBase64) {
        throw new Error('蒙版导出失败');
      }
      const editMapBase64 = exportPaintEditMap();
      assertCurrentGenerationTask(taskId, signal);

      // 3. 压缩参考图
      let refImagesData: { base64: string; mimeType: string }[] | undefined;
      if (refFiles.length > 0) {
        setProgress('正在处理参考图...');
        refImagesData = await Promise.all(refFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      // 3.5 压缩面料参考图
      let fabricRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (fabricRefFiles.length > 0) {
        setProgress('正在处理面料参考...');
        fabricRefImagesData = await Promise.all(fabricRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      // 3.6 压缩颜色参考图
      let colorRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (colorRefFiles.length > 0) {
        setProgress('正在处理颜色参考...');
        colorRefImagesData = await Promise.all(colorRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let structureRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (structureRefFiles.length > 0) {
        setProgress('正在处理结构参考...');
        structureRefImagesData = await Promise.all(structureRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      // 4. 发送到 AI
      setProgress('正在生成 (预计 30-90 秒)...');
      const stablePrompt = buildStructureLockedPrompt(description, !!structureRefImagesData);
      const cropPackage = cropPasteEnabled && structureRefImagesData
        ? await createMaskedCropPackage(sourceDataUrl, maskBase64, editMapBase64, Math.max(maskExpandPixels, cropPadding + cropExpand * 30))
        : null;
      const results = await generateInpainting(
        cropPackage?.source || { base64: sourceBase64, mimeType: sourceFile.type },
        cropPackage?.mask || { base64: maskBase64, mimeType: 'image/png' },
        stablePrompt,
        {
          aspectRatio: cropPackage?.aspectRatio || aspectRatio,
          resolution,
          modelId: selectedModel,
          editMapImage: cropPackage?.editMap || (editMapBase64 ? { base64: editMapBase64, mimeType: 'image/png' } : undefined),
          refImages: refImagesData,
          fabricRefImages: fabricRefImagesData,
          colorRefImages: colorRefImagesData,
          structureRefImages: structureRefImagesData,
          cropPaste: cropPasteEnabled && structureRefImagesData ? {
            padding: cropPadding,
            blend: cropBlend,
            expand: cropExpand,
          } : undefined,
          signal,
        }
      );

      assertCurrentGenerationTask(taskId, signal);
      setProgress('正在按蒙版贴回原图...');
      const maskedResults = await Promise.all(
        results.map((result: string) => cropPackage
          ? pasteGeneratedCropIntoSource(sourceDataUrl, result, cropPackage.mask.base64, cropPackage.bounds, cropBlend)
          : pasteGeneratedIntoMask(
            sourceDataUrl,
            result,
            maskBase64,
            cropPasteEnabled && structureRefImagesData ? cropBlend : 0
          )
        )
      );

      assertCurrentGenerationTask(taskId, signal);
      setProgress('生成完成！');
      setGeneratedImages(maskedResults);

      // 保存到项目历史
      try {
        await storageService.saveProject({
          id: crypto.randomUUID(),
          type: 'RETOUCHING',
          createdAt: Date.now(),
          thumbnail: maskedResults[0],
          assets: {
            original: [sourceUrl!, maskBase64], // 源图 URL 和 蒙版 Base64
            generated: maskedResults,
          },
          metadata: {
            subType: 'inpainting',
            prompt: description,
            aspectRatio,
            resolution,
            model: selectedModel,
            hasRefImages: !!refImagesData,
            hasFabricRef: !!fabricRefImagesData,
            hasColorRef: !!colorRefImagesData,
            hasStructureRef: !!structureRefImagesData,
            cropPasteEnabled: cropPasteEnabled && !!structureRefImagesData,
          },
        });
      } catch (saveErr) {
        console.error('Failed to save inpainting results to history:', saveErr);
      }

    } catch (error: any) {
      if (!isAbortError(error)) {
        setError(getErrorMessage(error));
      }
    } finally {
      if (!isCurrentGenerationTask(taskId)) {
        return;
      }
      finishGenerationTask(taskId);
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleBatchGenerate = async () => {
    if (!sourceFile || !hasMask || !description) return;

    const selected = selectedRefIdxs
      .filter((idx) => idx >= 0 && idx < refFiles.length)
      .slice(0, 10);

    if (selected.length === 0) {
      setError('请至少勾选 1 张参考图进行批量生成');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setProgress('');
    setResultView('batch');

    if ((window as any).aistudio) {
      try { const hasKey = await (window as any).aistudio.hasSelectedApiKey(); if (!hasKey) await (window as any).aistudio.openSelectKey(); } catch (e) { }
    }

    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setBatchResults([]);

    try {
      assertCurrentGenerationTask(taskId, signal);
      setProgress('正在压缩原图...');
      const sourceBase64 = await blobToBase64(sourceFile);
      assertCurrentGenerationTask(taskId, signal);
      const sourceDataUrl = `data:${sourceFile.type};base64,${sourceBase64}`;

      const maskExpandPixels = getMaskExpandPixels();
      setProgress(maskExpandPixels > 0 ? `正在导出蒙版并外扩 ${maskExpandPixels}px...` : '正在导出蒙版...');
      const maskBase64 = exportMask(maskExpandPixels);
      if (!maskBase64) throw new Error('蒙版导出失败');
      const editMapBase64 = exportPaintEditMap();
      assertCurrentGenerationTask(taskId, signal);

      // optional refs
      let fabricRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (fabricRefFiles.length > 0) {
        setProgress('正在处理面料参考...');
        fabricRefImagesData = await Promise.all(fabricRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let colorRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (colorRefFiles.length > 0) {
        setProgress('正在处理颜色参考...');
        colorRefImagesData = await Promise.all(colorRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      let structureRefImagesData: { base64: string; mimeType: string }[] | undefined;
      if (structureRefFiles.length > 0) {
        setProgress('正在处理结构参考...');
        structureRefImagesData = await Promise.all(structureRefFiles.map(async file => ({
          base64: await blobToBase64(file),
          mimeType: file.type
        })));
      }

      const prompt = buildStructureLockedPrompt(
        `${description}\n\nUse the clothing/outfit from the selected reference image for the WHITE mask area only. Match the requested garment structure, pattern, and fabric appearance as closely as possible.`,
        !!structureRefImagesData
      );
      const cropPackage = cropPasteEnabled && structureRefImagesData
        ? await createMaskedCropPackage(sourceDataUrl, maskBase64, editMapBase64, Math.max(maskExpandPixels, cropPadding + cropExpand * 30))
        : null;

      const currentBatchResults: Array<{ refIdx: number; refUrl: string; image?: string; error?: string }> = [];

      for (let i = 0; i < selected.length; i++) {
        assertCurrentGenerationTask(taskId, signal);
        const refIdx = selected[i];
        const refFile = refFiles[refIdx];
        const refUrl = refUrls[refIdx];

        setProgress(`批量生成中 ${i + 1}/${selected.length}...`);

        try {
          const refBase64 = await blobToBase64(refFile);
          const results = await generateInpainting(
            cropPackage?.source || { base64: sourceBase64, mimeType: sourceFile.type },
            cropPackage?.mask || { base64: maskBase64, mimeType: 'image/png' },
            prompt,
            {
              aspectRatio: cropPackage?.aspectRatio || aspectRatio,
              resolution,
              modelId: selectedModel,
              editMapImage: cropPackage?.editMap || (editMapBase64 ? { base64: editMapBase64, mimeType: 'image/png' } : undefined),
              refImages: [{ base64: refBase64, mimeType: refFile.type }],
              fabricRefImages: fabricRefImagesData,
              colorRefImages: colorRefImagesData,
              structureRefImages: structureRefImagesData,
              cropPaste: cropPasteEnabled && structureRefImagesData ? {
                padding: cropPadding,
                blend: cropBlend,
                expand: cropExpand,
              } : undefined,
              signal,
            }
          );

          assertCurrentGenerationTask(taskId, signal);
          const first = results?.[0];
          if (!first) throw new Error('模型未返回图片');
          const maskedFirst = cropPackage
            ? await pasteGeneratedCropIntoSource(sourceDataUrl, first, cropPackage.mask.base64, cropPackage.bounds, cropBlend)
            : await pasteGeneratedIntoMask(
              sourceDataUrl,
              first,
              maskBase64,
              cropPasteEnabled && structureRefImagesData ? cropBlend : 0
            );

          const resultItem = { refIdx, refUrl, image: maskedFirst };
          currentBatchResults.push(resultItem);
          setBatchResults((prev) => [...prev, resultItem]);
        } catch (e: any) {
          if (isAbortError(e)) {
            break;
          }
          const errorItem = { refIdx, refUrl, error: getErrorMessage(e) };
          currentBatchResults.push(errorItem);
          setBatchResults((prev) => [...prev, errorItem]);
        }
      }

      assertCurrentGenerationTask(taskId, signal);
      setProgress('批量生成完成！');

      // 保存到项目历史
      try {
        const successfulResults = currentBatchResults
          .filter(r => r.image)
          .map(r => r.image!);

        if (successfulResults.length > 0) {
          await storageService.saveProject({
            id: crypto.randomUUID(),
            type: 'RETOUCHING',
            createdAt: Date.now(),
            thumbnail: successfulResults[0],
            assets: {
              original: [sourceUrl!, maskBase64], // 源图 URL 和 蒙版 Base64
              generated: successfulResults,
            },
            metadata: {
              subType: 'inpainting_batch',
              prompt: description,
              aspectRatio,
              resolution,
              model: selectedModel,
              refCount: selected.length,
              successCount: successfulResults.length,
            },
          });
        }
      } catch (saveErr) {
        console.error('Failed to save batch inpainting results to history:', saveErr);
      }
    } catch (error: any) {
      if (!isAbortError(error)) {
        setError(getErrorMessage(error));
      }
    } finally {
      if (!isCurrentGenerationTask(taskId)) {
        return;
      }
      finishGenerationTask(taskId);
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleCancelGenerate = () => {
    cancelGenerationTask();
    setIsGenerating(false);
    setProgress('');
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
          <Paintbrush className="w-5 h-5 text-pastel-highlight" />
          局部替换 (Inpainting)
        </h2>
        <div className="text-sm text-pastel-muted">
          画笔涂抹 → 描述替换内容 → 生成
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">

          {/* Left: Input Panel */}
          <div className="flex flex-col gap-5 h-full">

            {/* 1. Upload & Canvas Area */}
            <div
              className={`relative border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center group
                ${!sourceUrl
                  ? 'border-pastel-border hover:border-pastel-highlight hover:bg-orange-50/30 p-6 min-h-[300px] cursor-pointer'
                  : 'border-pastel-highlight/30 bg-pastel-pink/10 p-3'
                }`}
              onClick={() => !sourceUrl && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const file = e.dataTransfer.files[0];
                  if (file.type.startsWith('image/')) {
                    setSourceFile(file);
                    setSourceUrl(URL.createObjectURL(file));
                    setGeneratedImages([]);
                    setHasMask(false);
                  }
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!sourceUrl ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-white shadow-sm border border-pastel-border rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-8 h-8 text-pastel-highlight" />
                  </div>
                  <p className="text-base font-semibold text-pastel-text">点击或拖拽上传图片</p>
                  <p className="text-xs text-pastel-muted mt-2">支持 JPG, PNG, WEBP（上传后用画笔涂抹需要替换的区域）</p>
                </div>
              ) : (
                <div className="w-full relative">
                  {/* 关闭按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSource(); }}
                    className="absolute top-2 right-2 z-30 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* 画笔工具栏 */}
                  <div className="flex items-center gap-3 mb-3 p-2 bg-white rounded-lg border border-pastel-border shadow-sm">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsErasing(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isErasing
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" /> 画笔
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsErasing(true); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isErasing
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      <Eraser className="w-3.5 h-3.5" /> 橡皮擦
                    </button>

                    <div className="h-5 w-px bg-gray-200" />

                    {/* 画笔大小 */}
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setBrushSize(Math.max(5, brushSize - 5)); }} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={brushSize}
                        onChange={(e) => { e.stopPropagation(); setBrushSize(Number(e.target.value)); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 h-1 accent-pastel-highlight"
                      />
                      <button onClick={(e) => { e.stopPropagation(); setBrushSize(Math.min(100, brushSize + 5)); }} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] text-pastel-muted w-8">{brushSize}px</span>
                    </div>

                    <div className="h-5 w-px bg-gray-200" />

                    <button
                      onClick={(e) => { e.stopPropagation(); clearMask(); }}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" /> 清除
                    </button>
                  </div>

                  {/* 双层 Canvas */}
                  <div
                    ref={canvasContainerRef}
                    className="relative w-full rounded-lg overflow-hidden border border-pastel-border shadow-sm bg-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <canvas
                      ref={sourceCanvasRef}
                      className="w-full block"
                    />
                    <canvas
                      ref={maskCanvasRef}
                      className="absolute top-0 left-0 w-full h-full"
                      style={{ cursor: 'none' }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    />
                    {/* 画笔光标预览 */}
                    {showCursor && cursorPos && (
                      <div
                        className="pointer-events-none absolute rounded-full border-2 z-20"
                        style={{
                          width: brushSize,
                          height: brushSize,
                          left: cursorPos.x - brushSize / 2,
                          top: cursorPos.y - brushSize / 2,
                          borderColor: isErasing ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)',
                          backgroundColor: isErasing ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          transition: 'width 0.1s, height 0.1s',
                        }}
                      />
                    )}
                  </div>

                  <div className="mt-2 text-center">
                    <span className="inline-block px-3 py-1 bg-white border border-pastel-border rounded-full text-xs text-pastel-muted shadow-sm">
                      {hasMask ? '🎨 已绘制蒙版 — 涂抹区域将被替换' : '用画笔涂抹需要替换的区域'}
                    </span>
                  </div>

                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowMaskGuide(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-orange-100 rounded-full text-[11px] font-bold text-pastel-muted hover:text-pastel-highlight hover:border-pastel-highlight/40 shadow-sm transition-all"
                    >
                      <Paintbrush className="w-3.5 h-3.5" /> 查看正确涂抹方式
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 1.5 参考图上传 */}
            <div 
              className={`bg-white p-4 rounded-xl border border-pastel-border shadow-sm transition-all ${isDraggingRef ? 'ring-2 ring-pastel-highlight bg-orange-50/50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingRef(false);
                if (e.dataTransfer.files) {
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                  if (refFiles.length + files.length > 10) {
                    setError('参考图最多10张');
                    setTimeout(() => setError(null), 3000);
                    return;
                  }
                  setRefFiles(prev => [...prev, ...files]);
                  setRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                }
              }}
            >
              <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> 参考图（可选, 告诉 AI 替换成什么样子）
              </label>
              <div
                className="flex flex-wrap gap-2 p-2 rounded-lg"
              >
                {refUrls.map((url, idx) => {
                  const isSelected = selectedRefIdxs.includes(idx);
                  return (
                    <div key={idx} className={`relative w-16 h-16 rounded-lg overflow-hidden border group/ref cursor-pointer transition-all ${isBatchMode && isSelected ? 'ring-2 ring-pastel-highlight border-pastel-highlight/50' : 'border-pastel-border'}`}>
                      <img
                        src={url}
                        alt={`Ref ${idx}`}
                        className="w-full h-full object-cover"
                        onClick={() => {
                          if (!isBatchMode) return;
                          setSelectedRefIdxs(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b));
                        }}
                      />

                      {isBatchMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedRefIdxs(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b));
                          }}
                          className={`absolute left-0.5 top-0.5 z-10 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black transition-all ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/90 border-gray-200 text-gray-500'}`}
                          title={isSelected ? '已选中' : '点击选中'}
                        >
                          {isSelected ? '✓' : ''}
                        </button>
                      )}

                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRefImage(idx); }}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/ref:opacity-100 transition-all"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                {refFiles.length < 10 && (
                  <button
                    onClick={() => refInputRef.current?.click()}
                    className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-pastel-bg hover:border-pastel-highlight/50 transition-colors text-pastel-muted hover:text-pastel-highlight"
                  >
                    <Upload className="w-4 h-4 mb-0.5 opacity-50" />
                    <span className="text-[9px]">添加</span>
                  </button>
                )}
              </div>
              <input
                ref={refInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleRefUpload}
                className="hidden"
              />

              <div className="flex items-center justify-between mt-2">
                {refFiles.length > 0 ? (
                  <p className="text-[10px] text-pastel-muted">已选 {refFiles.length} 张参考图</p>
                ) : (
                  <span />
                )}

                <label className="flex items-center gap-2 text-[10px] font-bold text-pastel-muted select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBatchMode}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIsBatchMode(next);
                      if (next) {
                        setSelectedRefIdxs(refFiles.map((_, i) => i));
                      } else {
                        setSelectedRefIdxs([]);
                      }
                    }}
                  />
                  批量生成
                </label>
              </div>

              {isBatchMode && refFiles.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRefIdxs(refFiles.map((_, i) => i))}
                    className="px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-muted hover:bg-pastel-bg shadow-sm transition-all"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRefIdxs([])}
                    className="px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-[10px] font-bold text-pastel-muted hover:bg-pastel-bg shadow-sm transition-all"
                  >
                    全不选
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] text-pastel-muted">已勾选 {selectedRefIdxs.length} 张</span>
                    <button
                      type="button"
                      onClick={handleBatchGenerate}
                      disabled={!sourceFile || !hasMask || !description || isGenerating || selectedRefIdxs.length === 0}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] ${!sourceFile || !hasMask || !description || isGenerating || selectedRefIdxs.length === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:brightness-105'
                        }`}
                    >
                      {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      批量生成（{Math.min(10, selectedRefIdxs.length)}）
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Structure Reference / Crop Paste Back */}
            <div
              className={`bg-white p-4 rounded-xl border border-pastel-border shadow-sm transition-all ${isDraggingStructure ? 'ring-2 ring-pastel-highlight bg-orange-50/50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingStructure(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingStructure(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingStructure(false);
                if (e.dataTransfer.files) {
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                  if (structureRefFiles.length + files.length > 2) {
                    setError('结构参考最多2张');
                    setTimeout(() => setError(null), 3000);
                    return;
                  }
                  setStructureRefFiles(prev => [...prev, ...files]);
                  setStructureRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                }
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <label className="block text-xs font-bold text-pastel-muted flex items-center gap-1.5">
                    <Crop className="w-3.5 h-3.5" /> 结构参考 / 裁切贴回（可选）
                  </label>
                  <p className="text-[10px] text-pastel-muted mt-1 leading-relaxed">
                    上传准确的衣服结构图或目标修改图。AI 会以涂抹区域为裁切范围，锁定图2的版型、轮廓、领口、袖口、褶皱和图案位置。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStructureGuide(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-100 rounded-full text-[10px] font-bold text-pastel-muted hover:text-pastel-highlight hover:border-pastel-highlight/40 shadow-sm transition-all"
                >
                  <Crop className="w-3.5 h-3.5" /> 查看使用说明
                </button>
                <label className="flex items-center gap-2 text-[10px] font-bold text-pastel-muted select-none cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={cropPasteEnabled}
                    onChange={(e) => setCropPasteEnabled(e.target.checked)}
                  />
                  启用
                </label>
              </div>

              <div className="flex flex-wrap gap-2 p-2 rounded-lg">
                {structureRefUrls.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-pastel-border group/structureRef">
                    <img src={url} alt={`Structure Ref ${idx}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeStructureRefImage(idx)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/structureRef:opacity-100 transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {structureRefFiles.length < 2 && (
                  <button
                    onClick={() => structureRefInputRef.current?.click()}
                    className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-pastel-bg hover:border-pastel-highlight/50 transition-colors text-pastel-muted hover:text-pastel-highlight"
                  >
                    <Upload className="w-4 h-4 mb-0.5 opacity-50" />
                    <span className="text-[9px]">添加</span>
                  </button>
                )}
              </div>
              <input
                ref={structureRefInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleStructureRefUpload}
                className="hidden"
              />

              {structureRefFiles.length > 0 && (
                <div className="mt-3 border-t border-pastel-border pt-3">
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-pastel-muted">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> 贴回参数
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="text-[10px] text-pastel-muted">
                      Padding {cropPadding.toFixed(1)}
                      <input type="range" min={0} max={16} step={0.5} value={cropPadding} onChange={(e) => setCropPadding(Number(e.target.value))} className="w-full h-1 accent-pastel-highlight" />
                    </label>
                    <label className="text-[10px] text-pastel-muted">
                      Blend {cropBlend.toFixed(2)}
                      <input type="range" min={0} max={2} step={0.05} value={cropBlend} onChange={(e) => setCropBlend(Number(e.target.value))} className="w-full h-1 accent-pastel-highlight" />
                    </label>
                    <label className="text-[10px] text-pastel-muted">
                      Expand {cropExpand.toFixed(2)}
                      <input type="range" min={0} max={1} step={0.05} value={cropExpand} onChange={(e) => setCropExpand(Number(e.target.value))} className="w-full h-1 accent-pastel-highlight" />
                    </label>
                  </div>
                  <p className="text-[10px] text-pastel-muted mt-2">已选 {structureRefFiles.length} 张结构参考</p>
                </div>
              )}
            </div>

            {/* 1.6 面料参考 */}
            <div 
              className={`bg-white p-4 rounded-xl border border-pastel-border shadow-sm transition-all ${isDraggingFabric ? 'ring-2 ring-pastel-highlight bg-orange-50/50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFabric(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFabric(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingFabric(false);
                if (e.dataTransfer.files) {
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                  if (fabricRefFiles.length + files.length > 2) {
                    setError('面料参考最多2张');
                    setTimeout(() => setError(null), 3000);
                    return;
                  }
                  setFabricRefFiles(prev => [...prev, ...files]);
                  setFabricRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                }
              }}
            >
              <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> 面料参考（可选, 保证纹理一致性）
              </label>
              <p className="text-[10px] text-pastel-muted mb-2">
                最多 2 张。建议上传面料特写（织纹/颗粒/光泽），用于让替换区域衣服更贴近同款面料质感。
              </p>
              <div
                className="flex flex-wrap gap-2 p-2 rounded-lg"
              >
                {fabricRefUrls.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-pastel-border group/fabricRef">
                    <img src={url} alt={`Fabric Ref ${idx}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFabricRefImage(idx)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/fabricRef:opacity-100 transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {fabricRefFiles.length < 2 && (
                  <button
                    onClick={() => fabricRefInputRef.current?.click()}
                    className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-pastel-bg hover:border-pastel-highlight/50 transition-colors text-pastel-muted hover:text-pastel-highlight"
                  >
                    <Upload className="w-4 h-4 mb-0.5 opacity-50" />
                    <span className="text-[9px]">添加</span>
                  </button>
                )}
              </div>
              <input
                ref={fabricRefInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFabricRefUpload}
                className="hidden"
              />
              {fabricRefFiles.length > 0 && (
                <p className="text-[10px] text-pastel-muted mt-1.5">已选 {fabricRefFiles.length} 张面料参考</p>
              )}
            </div>

            {/* 1.7 颜色参考 */}
            <div 
              className={`bg-white p-4 rounded-xl border border-pastel-border shadow-sm transition-all ${isDraggingColor ? 'ring-2 ring-pastel-highlight bg-orange-50/50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingColor(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingColor(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingColor(false);
                if (e.dataTransfer.files) {
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                  if (colorRefFiles.length + files.length > 2) {
                    setError('颜色参考最多2张');
                    setTimeout(() => setError(null), 3000);
                    return;
                  }
                  setColorRefFiles(prev => [...prev, ...files]);
                  setColorRefUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                }
              }}
            >
              <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> 颜色参考（可选, 保证颜色一致性）
              </label>
              <p className="text-[10px] text-pastel-muted mb-2">
                最多 2 张。建议上传颜色接近的整衣或色卡，用于让替换区域衣服颜色更稳定。
              </p>
              <div
                className="flex flex-wrap gap-2 p-2 rounded-lg"
              >
                {colorRefUrls.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-pastel-border group/colorRef">
                    <img src={url} alt={`Color Ref ${idx}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeColorRefImage(idx)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/colorRef:opacity-100 transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {colorRefFiles.length < 2 && (
                  <button
                    onClick={() => colorRefInputRef.current?.click()}
                    className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-pastel-border rounded-lg cursor-pointer hover:bg-pastel-bg hover:border-pastel-highlight/50 transition-colors text-pastel-muted hover:text-pastel-highlight"
                  >
                    <Upload className="w-4 h-4 mb-0.5 opacity-50" />
                    <span className="text-[9px]">添加</span>
                  </button>
                )}
              </div>
              <input
                ref={colorRefInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleColorRefUpload}
                className="hidden"
              />
              {colorRefFiles.length > 0 && (
                <p className="text-[10px] text-pastel-muted mt-1.5">已选 {colorRefFiles.length} 张颜色参考</p>
              )}
            </div>

            {/* 2. Configuration */}
            <div className="flex flex-col gap-5">
              {/* Model Selection - Moved to top */}
              <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
                <label className="block text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> 图像模型选择
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                      ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                      : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <BananaIcon className="w-3 h-3" />
                      <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                        Banana 2
                      </span>
                    </div>
                    <span className="text-[8px] text-pastel-muted">3.1 Flash</span>
                  </button>
                  <button
                    onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                      ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                      : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <BananaIcon className="w-3 h-3" />
                      <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                        Banana Pro
                      </span>
                    </div>
                    <span className="text-[8px] text-pastel-muted">3.0 Pro</span>
                  </button>
                  <button
                    onClick={() => setSelectedModel('gpt-image-2')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedModel === 'gpt-image-2'
                      ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                      : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-orange-500" />
                      <span className={`text-[10px] font-bold ${selectedModel === 'gpt-image-2' ? 'text-purple-700' : 'text-pastel-text'}`}>
                        GPT Image 2
                      </span>
                    </div>
                    <span className="text-[8px] text-pastel-muted">Ultra Quality</span>
                  </button>
                </div>
              </div>

              {/* Settings Row */}
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" /> 画幅比例
                  </label>
                  <div className="relative">
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                      className="w-full appearance-none bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm text-pastel-text outline-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all font-medium hover:border-pastel-highlight/50 cursor-pointer"
                    >
                      <option value={AspectRatio.SQUARE}>1:1 (正方形)</option>
                      <option value={AspectRatio.LANDSCAPE_3_2}>3:2 (横构图)</option>
                      <option value={AspectRatio.PORTRAIT_2_3}>2:3 (竖构图)</option>
                      
                      {selectedModel !== 'gpt-image-2' && (
                        <>
                          <option value={AspectRatio.LANDSCAPE_4_3}>4:3 (常规)</option>
                          <option value={AspectRatio.PORTRAIT_3_4}>3:4 (人像)</option>
                        </>
                      )}
                      
                      <option value={AspectRatio.LANDSCAPE_16_9}>16:9 (宽屏)</option>
                      <option value={AspectRatio.PORTRAIT_9_16}>9:16 (手机)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-pastel-muted">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-pastel-muted mb-2 flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5" /> 画质精度
                  </label>
                  <div className="relative">
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value as ImageResolution)}
                      className="w-full appearance-none bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm text-pastel-text outline-none focus:ring-2 focus:ring-pastel-highlight/20 transition-all font-medium hover:border-pastel-highlight/50 cursor-pointer"
                    >
                      {selectedModel !== 'gpt-image-2' && (
                        <option value={ImageResolution.RES_05K}>0.5K (512px)</option>
                      )}
                      <option value={ImageResolution.RES_1K}>1K (标准)</option>
                      <option value={ImageResolution.RES_2K}>2K (高清)</option>
                      <option value={ImageResolution.RES_4K}>4K (超清)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-pastel-muted">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                    </div>
                  </div>
                </div>
              </div>


              {/* Prompt Area */}
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-bold text-pastel-text flex items-center gap-2 mb-2 px-1">
                  <Sparkles className="w-4 h-4 text-pastel-highlight" />
                  替换描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述涂抹区域要替换成什么...
例如：
- 戴上一副时尚太阳镜
- 将背景替换为海滩日落
- 把红色衣服换成蓝色西装"
                  className="w-full min-h-[120px] bg-white border border-pastel-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-pastel-highlight/50 outline-none resize-none shadow-sm text-pastel-text placeholder:text-gray-300 transition-all hover:border-pastel-highlight/30"
                />
              </div>
            </div>

            {/* 3. Action Area */}
            <div className="mt-auto flex flex-col gap-3">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-600 animate-in slide-in-from-bottom-2 fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {(error.includes("403") || error.includes("权限")) && (
                      <button
                        onClick={() => (window as any).aistudio?.openSelectKey()}
                        className="mt-2 text-xs font-semibold underline hover:text-red-700 flex items-center gap-1"
                      >
                        <Key className="w-3 h-3" /> 点击配置 API Key
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!sourceFile || !hasMask || !description || isGenerating}
                className={`w-full py-4 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${!sourceFile || !hasMask || !description || isGenerating
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                  : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-orange-500/25 hover:shadow-orange-500/40 hover:brightness-105'
                  }`}
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paintbrush className="w-5 h-5" />}
                {isGenerating ? '正在替换生成...' : '开始局部替换'}
              </button>
              {isGenerating && (
                <button
                  type="button"
                  onClick={handleCancelGenerate}
                  className="w-full py-3 text-sm font-bold rounded-xl bg-gray-800 text-white hover:bg-gray-900 transition-all"
                >
                  中止生成
                </button>
              )}
              {cancelMessage && !isGenerating && (
                <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>
              )}
            </div>

          </div>

          {/* Right: Result Area */}
          <div className="flex flex-col bg-pastel-card rounded-xl border border-pastel-border p-6 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-pastel-text flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-pastel-highlight" />
                生成结果
              </h3>
                {generatedImages.length > 0 || batchResults.length > 0 ? (
                  <div className="flex items-center gap-1 bg-white border border-pastel-border rounded-lg p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setResultView('single')}
                      className={`px-2 py-1 rounded-md text-[10px] font-black transition-all ${resultView === 'single'
                        ? 'bg-pastel-highlight/10 text-pastel-highlight'
                        : 'text-pastel-muted hover:bg-pastel-bg'}`}
                    >
                      单次
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultView('batch')}
                      className={`px-2 py-1 rounded-md text-[10px] font-black transition-all ${resultView === 'batch'
                        ? 'bg-pastel-highlight/10 text-pastel-highlight'
                        : 'text-pastel-muted hover:bg-pastel-bg'}`}
                    >
                      批量
                    </button>
                  </div>
                ) : null}

              {generatedImages.length > 0 && resultView === 'single' && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">完成</span>
              )}
              {batchResults.length > 0 && resultView === 'batch' && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">完成</span>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center bg-pastel-bg rounded-lg border-2 border-dashed border-pastel-border overflow-hidden relative">
              {resultView === 'batch' ? (
                batchResults.length > 0 ? (
                  <div className="w-full h-full overflow-y-auto p-4 custom-scrollbar">
                    {batchResults
                      .slice()
                      .sort((a, b) => a.refIdx - b.refIdx)
                      .map((item) => (
                        <div key={`batch-${item.refIdx}`} className="mb-6 last:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-pastel-border bg-white shrink-0">
                              <img src={item.refUrl} alt={`Ref ${item.refIdx}`} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-pastel-text">参考图 #{item.refIdx + 1}</div>
                              {item.error ? (
                                <div className="text-[10px] text-red-600">{item.error}</div>
                              ) : (
                                <div className="text-[10px] text-green-700">生成成功</div>
                              )}
                            </div>
                          </div>

                          {item.image && (
                            <div className="group/card relative">
                              <div className="relative rounded-lg shadow-lg border border-pastel-border overflow-hidden">
                                <img
                                  src={item.image}
                                  alt="Batch Inpainting Result"
                                  className="w-full h-auto cursor-zoom-in hover:brightness-[1.02] transition-all duration-300"
                                  onClick={() => setZoomImage(item.image!)}
                                />
                              </div>
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={() => downloadImage(item.image!, `inpainting_batch_${item.refIdx + 1}_${Date.now()}.png`)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-xs text-pastel-text hover:bg-pastel-bg shadow-sm transition-all"
                                >
                                  <Download className="w-3.5 h-3.5" /> 下载
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-pastel-muted">
                    <div className="w-20 h-20 bg-pastel-bg border-2 border-dashed border-pastel-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Grid className="w-10 h-10 text-pastel-border" />
                    </div>
                    <p className="text-sm">{isGenerating && progress ? progress : '批量生成的结果将显示在这里'}</p>
                    {isGenerating && (
                      <div className="mt-4 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-pastel-highlight" />
                      </div>
                    )}
                  </div>
                )
              ) : (
                generatedImages.length > 0 ? (
                  <div className="w-full h-full overflow-y-auto p-4 custom-scrollbar">
                    {generatedImages.map((imgSrc, idx) => (
                      <div key={idx} className="mb-6 last:mb-0 group/card relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative rounded-lg shadow-lg border border-pastel-border overflow-hidden">
                          <img
                            src={imgSrc}
                            alt="Inpainting Result"
                            className="w-full h-auto cursor-zoom-in hover:brightness-[1.02] transition-all duration-300"
                            onClick={() => setZoomImage(imgSrc)}
                          />
                        </div>
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => downloadImage(imgSrc, `inpainting_${Date.now()}.png`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-pastel-border rounded-lg text-xs text-pastel-text hover:bg-pastel-bg shadow-sm transition-all"
                          >
                            <Download className="w-3.5 h-3.5" /> 下载
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-pastel-muted">
                    <div className="w-20 h-20 bg-pastel-bg border-2 border-dashed border-pastel-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Paintbrush className="w-10 h-10 text-pastel-border" />
                    </div>
                    <p className="text-sm">
                      {isGenerating && progress ? progress : '替换后的图片将显示在这里'}
                    </p>
                    {isGenerating && (
                      <div className="mt-4 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-pastel-highlight" />
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

        </div>
      </div>

      {showMaskGuide && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
          onClick={() => setShowMaskGuide(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-pastel-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 font-black text-pastel-text">
                <Paintbrush className="w-4 h-4 text-pastel-highlight" /> 正确涂抹方式
              </div>
              <button onClick={() => setShowMaskGuide(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-pastel-muted leading-relaxed">
              <p>只换领口、袖口、包边时，不要只画一条细线。</p>
              <p>需要覆盖旧边缘、要删除成皮肤或背景的区域，以及新边缘会经过的路径。</p>
              <p>涂抹区域宁愿稍微大一点，也不要断开；橡皮擦用于收窄边界。快速拖动画笔会自动连线，避免蒙版断层。</p>
            </div>
          </div>
        </div>
      )}

      {showStructureGuide && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
          onClick={() => setShowStructureGuide(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-pastel-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 font-black text-pastel-text">
                <Crop className="w-4 h-4 text-pastel-highlight" /> 结构参考裁切贴回说明
              </div>
              <button onClick={() => setShowStructureGuide(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-pastel-muted leading-relaxed">
              <p>上传目标结构图，例如想要的领口、袖口、包边或下摆。AI 只把结构图当作白色蒙版区域内的边缘模板，不应复制整件衣服。</p>
              <p>做领口/袖口改款时，蒙版要盖住旧边、要移除的衣服区域，以及新边缘将经过的区域。只涂一条细边通常不够。</p>
              <p>推荐参数：细微修边用 Padding 5-8、Expand 0.25-0.4；大幅改领口/袖口用 Padding 8-12、Expand 0.4-0.6；Blend 保持 0.8-1.2。</p>
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
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default InpaintingTab;
