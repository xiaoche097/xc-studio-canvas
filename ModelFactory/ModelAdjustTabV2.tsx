import React, { useEffect, useState } from 'react';
import { Activity, Cpu, Download, Loader2, Maximize2, Sparkles, Upload, X, Zap } from 'lucide-react';
import { AspectRatio } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';
import { storageService } from '../services/storageService';

type TransferScope = 'upper-body' | 'full-body';
type PoseTransferAspectRatio =
  | AspectRatio.PORTRAIT_2_3
  | AspectRatio.PORTRAIT_9_16
  | AspectRatio.PORTRAIT_3_4
  | AspectRatio.SQUARE;

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

type PreviewState = {
  src: string;
  title: string;
  subtitle?: string;
} | null;

const ModelAdjustTabV2: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const [poseSourceFile, setPoseSourceFile] = useState<File | null>(null);
  const [poseSourceUrl, setPoseSourceUrl] = useState<string | null>(null);
  const [poseRefFile, setPoseRefFile] = useState<File | null>(null);
  const [poseRefUrl, setPoseRefUrl] = useState<string | null>(null);
  const [poseGuidance, setPoseGuidance] = useState('');
  const [transferScope, setTransferScope] = useState<TransferScope>('upper-body');
  const [resolution, setResolution] = useState<'2K' | '4K'>('2K');
  const [outputAspectRatio, setOutputAspectRatio] = useState<PoseTransferAspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [isPoseGenerating, setIsPoseGenerating] = useState(false);
  const [poseStatusMessage, setPoseStatusMessage] = useState('');
  const [poseResultImage, setPoseResultImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [isExtractingSkeleton, setIsExtractingSkeleton] = useState(false);
  const [poseSkeletonFile, setPoseSkeletonFile] = useState<File | null>(null);
  const [poseSkeletonUrl, setPoseSkeletonUrl] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');

  const resetResult = () => {
    setPoseResultImage(null);
    setPoseStatusMessage('');
  };

  const setSourceFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    if (poseSourceUrl) {
      URL.revokeObjectURL(poseSourceUrl);
    }
    setPoseSourceFile(file);
    setPoseSourceUrl(URL.createObjectURL(file));
    resetResult();
  };

  const setReferenceFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    if (poseRefUrl) {
      URL.revokeObjectURL(poseRefUrl);
    }
    if (poseSkeletonUrl) {
      URL.revokeObjectURL(poseSkeletonUrl);
    }
    setPoseRefFile(file);
    setPoseRefUrl(URL.createObjectURL(file));
    setPoseSkeletonFile(null);
    setPoseSkeletonUrl(null);
    resetResult();
  };

  const handlePoseSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceFromFile(file);
    }
    e.target.value = '';
  };

  const handlePoseRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceFromFile(file);
    }
    e.target.value = '';
  };

  const handlePoseSourceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSourceFromFile(file);
    }
  };

  const handlePoseRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setReferenceFromFile(file);
    }
  };

  const removePoseSource = () => {
    if (poseSourceUrl) {
      URL.revokeObjectURL(poseSourceUrl);
    }
    setPoseSourceFile(null);
    setPoseSourceUrl(null);
    resetResult();
  };

  const removePoseRef = () => {
    if (poseRefUrl) {
      URL.revokeObjectURL(poseRefUrl);
    }
    if (poseSkeletonUrl) {
      URL.revokeObjectURL(poseSkeletonUrl);
    }
    setPoseRefFile(null);
    setPoseRefUrl(null);
    setPoseSkeletonFile(null);
    setPoseSkeletonUrl(null);
    resetResult();
  };

  // 绑定剪贴板粘贴事件
  useImagePaste((files) => {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // 如果姿态源图为空，则设为姿态源图
    if (!poseSourceUrl) {
      setSourceFromFile(file);
    }
    // 否则如果参考图为空，则设为参考图
    else if (!poseRefUrl) {
      setReferenceFromFile(file);
    }
    // 否则默认替换姿态源图
    else {
      setSourceFromFile(file);
    }
  }, isActive);

  const openPreview = (src: string | null, title: string, subtitle?: string) => {
    if (!src) {
      return;
    }
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

  const buildPoseTransferPrompt = (userGuidance: string, scope: TransferScope) => {
    const guidance = userGuidance.trim();
    const scopeRule = scope === 'upper-body'
      ? 'Focus strictly on the UPPER BODY. The output must perfectly duplicate the pose reference\'s upper-body framing, arm angles, and crop distance.'
      : 'Focus on the FULL BODY. The output must perfectly duplicate the pose reference\'s full-body stance, leg position, and subject distance.';

    return `[STRICT POSE TRANSFER TASK]
Take the person, clothes, and identity from the Clothing Source image and FORCE them into the exact skeleton and camera crop of the Pose Reference image.

CRITICAL FAILURE CONDITIONS:
- Do NOT output the same arm/hand pose as the Clothing Source image.
- Do NOT output the same zoom/crop as the Clothing Source image.
- If the Clothing Source has hands in pockets, but the Pose Reference does not, you MUST NOT draw hands in pockets.

MANDATORY SUCCESS CONDITIONS:
- You MUST abandon the Clothing Source image's posture and framing completely.
- You MUST replicate the Pose Reference image's shoulder slope, arm angles, body rotation, and crop distance 1:1.
- ${scopeRule}

USER INSTRUCTION:
${guidance || 'Preserve clothing exactly. Force the pose and framing to match the pose reference exactly.'}`;
  };

  const buildPoseTransferNegativePrompt = (scope: TransferScope) => [
    'copying Pose Reference clothing',
    'copying Pose Reference accessories',
    'copying Pose Reference bag',
    'copying Pose Reference background',
    'copying Pose Reference lighting',
    'different identity',
    'different hairstyle',
    'different skin tone',
    'altered body proportions',
    'garment redesign',
    'extra fingers',
    'extra hands',
    'missing accessories',
    'same pose as Clothing Source',
    'unchanged shoulders',
    'unchanged arms',
    'unchanged hand placement',
    'unchanged framing from Clothing Source',
    'tiny pose difference',
    'subtle pose adjustment only',
    scope === 'upper-body'
      ? 'unnecessary lower-body change, unnecessary garment hem change'
      : 'same crop as Clothing Source when Pose Reference framing is different, unchanged subject placement',
  ].join(', ');

  const handleExtractSkeleton = async () => {
    if (!poseRefUrl) return;
    setIsExtractingSkeleton(true);
    setPoseStatusMessage('正在加载 MediaPipe 骨架提取模型...');

    try {
      // Load script dynamically
      if (!(window as any).Pose) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load MediaPipe Pose'));
          document.head.appendChild(script);
        });
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = poseRefUrl;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

      setPoseStatusMessage('正在分析人物姿势...');

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const pose = new (window as any).Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      pose.setOptions({
        modelComplexity: 2,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults((results: any) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { width, height } = canvas;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
          return;
        }

        const lm = results.poseLandmarks;
        const getPt = (idx: number) => {
          const p = lm[idx];
          if (p.visibility < 0.3) return null;
          return { x: p.x * width, y: p.y * height };
        };
        const midpoint = (p1: any, p2: any) => {
          if (!p1 || !p2) return null;
          return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        };

        const points = {
          nose: getPt(0), lEye: getPt(2), rEye: getPt(5), lEar: getPt(7), rEar: getPt(8),
          lShoulder: getPt(11), rShoulder: getPt(12), lElbow: getPt(13), rElbow: getPt(14),
          lWrist: getPt(15), rWrist: getPt(16), lHip: getPt(23), rHip: getPt(24),
          lKnee: getPt(25), rKnee: getPt(26), lAnkle: getPt(27), rAnkle: getPt(28),
        };

        const neck = midpoint(points.lShoulder, points.rShoulder);
        const midHip = midpoint(points.lHip, points.rHip);

        const bones = [
          { start: neck, end: points.rShoulder, color: '#ff0000' },
          { start: neck, end: points.lShoulder, color: '#ff5500' },
          { start: points.rShoulder, end: points.rElbow, color: '#ffaa00' },
          { start: points.rElbow, end: points.rWrist, color: '#ffff00' },
          { start: points.lShoulder, end: points.lElbow, color: '#aaff00' },
          { start: points.lElbow, end: points.lWrist, color: '#55ff00' },
          { start: neck, end: midHip, color: '#00ff00' },
          { start: midHip, end: points.rHip, color: '#00ffaa' },
          { start: points.rHip, end: points.rKnee, color: '#00ffff' },
          { start: points.rKnee, end: points.rAnkle, color: '#00aaff' },
          { start: midHip, end: points.lHip, color: '#0055ff' },
          { start: points.lHip, end: points.lKnee, color: '#0000ff' },
          { start: points.lKnee, end: points.lAnkle, color: '#5500ff' },
          { start: neck, end: points.nose, color: '#aa00ff' },
          { start: points.nose, end: points.rEye, color: '#ff00ff' },
          { start: points.rEye, end: points.rEar, color: '#ff00aa' },
          { start: points.nose, end: points.lEye, color: '#ff0055' },
          { start: points.lEye, end: points.lEar, color: '#ff0000' },
        ];

        ctx.lineWidth = Math.max(5, Math.floor(width / 100));
        ctx.lineCap = 'round';
        for (const bone of bones) {
          if (bone.start && bone.end) {
            ctx.strokeStyle = bone.color;
            ctx.beginPath();
            ctx.moveTo(bone.start.x, bone.start.y);
            ctx.lineTo(bone.end.x, bone.end.y);
            ctx.stroke();
          }
        }

        const jointPoints = [
          points.nose, neck, points.rShoulder, points.rElbow, points.rWrist,
          points.lShoulder, points.lElbow, points.lWrist, midHip,
          points.rHip, points.rKnee, points.rAnkle,
          points.lHip, points.lKnee, points.lAnkle,
          points.rEye, points.lEye, points.rEar, points.lEar
        ];
        const jointColors = [
          '#aa00ff', '#ff0000', '#ff0000', '#ffaa00', '#ffff00',
          '#ff5500', '#aaff00', '#55ff00', '#00ff00', '#00ffaa',
          '#00ffff', '#00aaff', '#0055ff', '#0000ff', '#5500ff',
          '#ff00ff', '#ff0055', '#ff00aa', '#ff0000'
        ];
        jointPoints.forEach((pt, i) => {
          if (pt) {
            ctx.fillStyle = jointColors[i];
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, Math.max(4, Math.floor(width / 100)), 0, 2 * Math.PI);
            ctx.fill();
          }
        });
      });

      await pose.send({ image: img });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "openpose_skeleton.jpg", { type: "image/jpeg" });
          setPoseSkeletonFile(file);
          setPoseSkeletonUrl(dataUrl);
          openPreview(dataUrl, '检测到的骨架覆盖层', '已成功读取姿势，作为最终参考图');
        });

    } catch (err) {
      console.error(err);
      alert('骨架提取失败，由于当前网络限制或照片识别不到人选，建议您自行使用其他OpenPose提取工具处理原图后再上传');
    } finally {
      setIsExtractingSkeleton(false);
      setPoseStatusMessage('');
    }
  };

  const handleGeneratePoseTransfer = async () => {
    if (!poseSourceFile || !poseRefFile) {
      alert('请上传图1（原图）和图2（姿势参考）');
      return;
    }

    setIsPoseGenerating(true);
    setPoseStatusMessage('正在锁定图1人物与服装，并按图2重建姿势、朝向与构图...');

    try {
      const sourceImage = await compressImage(poseSourceFile, 2048, 0.96);
      const refImage = await compressImage(poseRefFile, 2048, 0.96);

      const prompt = buildPoseTransferPrompt(poseGuidance, transferScope);
      const negativePrompt = buildPoseTransferNegativePrompt(transferScope);

      const inputImages = [];
      if (poseSkeletonFile) {
        // We have a skeleton extracted! Pass BOTH: Skeleton and Original
        const skeletonImage = await compressImage(poseSkeletonFile, 2048, 0.96);
        inputImages.push({ base64: skeletonImage.base64, mimeType: skeletonImage.mime });
      }
      // Just the original reference image
      inputImages.push({ base64: refImage.base64, mimeType: refImage.mime });
      
      // Source is always appended last
      inputImages.push({ base64: sourceImage.base64, mimeType: sourceImage.mime });
      
      // 使用选择的模型，如果失败则回放
      const fallbackModels = [selectedModel, selectedModel === 'gemini-3.1-flash-image-preview' ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image-preview'] as const;

      let result: string[] = [];
      let lastError: any = null;

      for (const [index, modelId] of fallbackModels.entries()) {
        try {
          if (index > 0) {
            setPoseStatusMessage(`主模型不可用，正在切换到 ${modelId} 重试...`);
          }

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

          if (result && result.length > 0) {
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn(`[Pose Transfer] ${modelId} failed`, error);
        }
      }

      if (result && result.length > 0) {
        setPoseResultImage(result[0]);
        setPoseStatusMessage('姿势迁移完成，可以放大查看细节。');

        // Save to recent projects
        try {
          await storageService.saveProject({
            id: crypto.randomUUID(),
            type: 'MODEL',
            createdAt: Date.now(),
            thumbnail: result[0],
            assets: {
              original: poseSourceUrl ? [poseSourceUrl] : [],
              generated: result,
            },
            metadata: {
              subType: 'model_adjust_v2',
              prompt: prompt,
              negativePrompt,
              resolution,
              aspectRatio: outputAspectRatio,
              transferScope,
              modelId: selectedModel,
            },
          });
        } catch (e) {
          console.error("Failed to save project", e);
        }
      } else {
        throw lastError || new Error('模型未返回任何图片，请稍后重试');
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsPoseGenerating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* Sidebar - Inputs */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Pose Transfer</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">模特调整/姿势迁移</h3>
            <p className="text-[10px] leading-5 text-pastel-muted italic">
              图1锁定人物身份与服装，图2仅读取姿势蓝图。结果会按图2站位重建。
            </p>
          </div>

          {/* 图1 上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>图1 原图（锁定身份与服装）</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            <div className="flex flex-col gap-2">
              {poseSourceUrl ? (
                <div 
                  className="relative group w-full aspect-[4/3] rounded-2xl border border-pastel-border shadow-sm overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handlePoseSourceDrop}
                >
                  <img src={poseSourceUrl} alt="source" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <label 
                      className="cursor-pointer bg-white p-2 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="file" className="hidden" onChange={handlePoseSourceChange} accept="image/*" />
                      <Upload className="w-4 h-4" />
                    </label>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview(poseSourceUrl, '图1 原图'); }}
                      className="bg-white p-2 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePoseSource(); }}
                      className="bg-white p-2 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handlePoseSourceDrop}
                  className="relative flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                >
                  <input type="file" className="hidden" onChange={handlePoseSourceChange} accept="image/*" />
                  <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-pastel-text">点击或拖拽原图到此处</span>
                  <span className="text-xs text-pastel-muted mt-1 px-4 text-center">人物长相、服装结构保持不变</span>
                </label>
              )}
            </div>
          </div>

          {/* 图2 上传 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>图2 姿势参考（读取骨架）</span>
              <span className="text-[10px] font-normal text-pastel-muted">必须上传</span>
            </h3>
            <div className="flex flex-col gap-2">
              {poseRefUrl ? (
                <div 
                  className="relative group w-full aspect-[4/3] rounded-2xl border border-pastel-border shadow-sm overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handlePoseRefDrop}
                >
                  <img src={poseRefUrl} alt="reference" className="w-full h-full object-cover" />
                  {poseSkeletonUrl && (
                    <div className="absolute top-2 left-2 bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                      <Activity className="w-3 h-3" /> 已提取骨架
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <label 
                      className="cursor-pointer bg-white p-2 text-pastel-text hover:text-pastel-highlight rounded-full shadow-lg transition-transform hover:scale-110"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="file" className="hidden" onChange={handlePoseRefChange} accept="image/*" />
                      <Upload className="w-4 h-4" />
                    </label>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview(poseSkeletonUrl || poseRefUrl, '图2 姿势参考'); }}
                      className="bg-white p-2 text-pastel-text hover:text-blue-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePoseRef(); }}
                      className="bg-white p-2 text-pastel-text hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handlePoseRefDrop}
                  className="relative flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
                >
                  <input type="file" className="hidden" onChange={handlePoseRefChange} accept="image/*" />
                  <div className="w-12 h-12 mb-3 bg-white shadow-sm rounded-xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-pastel-text">点击或拖拽参考图到此处</span>
                  <span className="text-xs text-pastel-muted mt-1 px-4 text-center">仅读取躯干朝向、动作与构图</span>
                </label>
              )}
              {/* Optional: Extraction button */}
              {poseRefUrl && !poseSkeletonUrl && (
                <button
                  type="button"
                  onClick={handleExtractSkeleton}
                  disabled={isExtractingSkeleton}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors disabled:opacity-50 border border-indigo-100"
                >
                  {isExtractingSkeleton ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                  {isExtractingSkeleton ? '正在提取骨架...' : '一键转为 OpenPose 骨架图 (推荐)'}
                </button>
              )}
            </div>
          </div>

          {/* 迁移范围 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">迁移范围 (Transfer Scope)</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransferScope('upper-body')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${transferScope === 'upper-body' ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
              >
                仅上半身
              </button>
              <button
                type="button"
                onClick={() => setTransferScope('full-body')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${transferScope === 'full-body' ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
              >
                全身姿势
              </button>
            </div>
          </div>

          {/* 输出画幅 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-pastel-muted uppercase tracking-wider mb-2">输出画幅 (Aspect Ratio)</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: AspectRatio.PORTRAIT_2_3, label: '2:3' },
                { value: AspectRatio.PORTRAIT_9_16, label: '9:16' },
                { value: AspectRatio.PORTRAIT_3_4, label: '3:4' },
                { value: AspectRatio.SQUARE, label: '1:1' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setOutputAspectRatio(item.value as PoseTransferAspectRatio)}
                  className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${outputAspectRatio === item.value ? 'bg-pastel-highlight/10 text-pastel-highlight border-pastel-highlight shadow-sm' : 'bg-white text-pastel-muted border-pastel-border hover:border-pastel-highlight/40'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 细节设置 */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-pastel-muted mb-2">生成画质</h3>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as '2K' | '4K')}
                className="w-full bg-white border border-pastel-border rounded-xl py-2.5 px-3 text-xs font-bold focus:ring-2 focus:ring-pastel-highlight/20 outline-none transition-all"
              >
                <option value="2K">2K (默认高清)</option>
                <option value="4K">4K (细节丰富)</option>
              </select>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-pastel-muted mb-2">补充提示词</h3>
              <textarea
                rows={3}
                value={poseGuidance}
                onChange={(e) => setPoseGuidance(e.target.value)}
                placeholder="例如：保持笑容，或者特别说明手势细节..."
                className="w-full bg-white border border-pastel-border rounded-xl py-3 px-4 text-xs focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
              />
            </div>

            {/* 图像模型选择 */}
            <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
              <label className="block text-xs font-bold text-pastel-muted mb-3 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> 图像模型选择
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3.1-flash-image-preview'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <BananaIcon className="w-3 h-3" />
                    <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Banana 2
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted">3.1 Flash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gemini-3-pro-image-preview'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <BananaIcon className="w-3 h-3" />
                    <span className={`text-[10px] font-bold ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      Banana Pro
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted">3.0 Pro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModel('gpt-image-2')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedModel === 'gpt-image-2'
                    ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-pastel-border hover:border-purple-200 bg-pastel-bg'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-orange-500" />
                    <span className={`text-[10px] font-bold ${selectedModel === 'gpt-image-2' ? 'text-purple-700' : 'text-pastel-text'}`}>
                      GPT Image 2
                    </span>
                  </div>
                  <span className="text-[8px] text-pastel-muted">Ultra Quality</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer Button */}
        <div className="p-5 border-t border-pastel-border bg-pastel-card sticky bottom-0 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleGeneratePoseTransfer}
            disabled={isPoseGenerating}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all active:scale-[0.98] hover:shadow-orange-500/40 hover:brightness-105"
          >
            {isPoseGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                正在匹配姿势...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                生成模特调整
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Panel - Result Workspace */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden relative items-center justify-center bg-transparent">
        {(isPoseGenerating || isExtractingSkeleton) ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-6 p-12 bg-white/50 backdrop-blur-md rounded-3xl border border-white shadow-xl max-w-md w-full">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-pastel-highlight animate-spin" />
                <Zap className="w-6 h-6 text-yellow-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-xl font-black text-pastel-highlight tracking-tight">
                  {isExtractingSkeleton ? '读取骨架中...' : '重建姿势中...'}
                </h3>
                <p className="text-pastel-text/80 text-sm font-medium animate-pulse transition-all duration-500">
                  {poseStatusMessage || (isExtractingSkeleton ? '正在检测身体特征以生成 OpenPose 骨架图...' : '锁定衣服细节，正在按参考图重塑肢体结构...')}
                </p>
              </div>
            </div>
          </div>
        ) : !poseResultImage ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted w-full h-full">
            <div className="w-24 h-24 rounded-3xl bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-6 transition-all hover:scale-105 hover:border-pastel-highlight hover:shadow-lg hover:shadow-pastel-highlight/20 shadow-sm">
              <Zap className="w-10 h-10 text-pastel-border" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-black text-pastel-text">等待上传并生成</p>
              <p className="text-xs tracking-wide opacity-70 text-center">
                请先在左侧上传原图与姿势参考<br />
                结果将直接显示在工作区，方便对照检查
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-between w-full max-w-[720px] mb-2 px-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pastel-highlight" />
                <span className="text-sm font-black text-slate-800 tracking-tight">生成结果 (Transfer Result)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openPreview(poseResultImage, '生成结果')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-pastel-border bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 shadow-sm"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  放大
                </button>
                <button
                  type="button"
                  onClick={() => downloadImage(poseResultImage, `model-adjust-${Date.now()}.png`)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-pastel-highlight/20 bg-pastel-highlight/10 px-4 py-2 text-xs font-bold text-pastel-highlight transition-colors hover:bg-pastel-highlight/15 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </button>
              </div>
            </div>

            <div className="relative group max-h-[80%] overflow-hidden rounded-[40px] border border-white bg-white/80 shadow-[0_40px_100px_-30px_rgba(15,23,42,0.3)] backdrop-blur-md transition-all hover:shadow-2xl">
              <img
                src={poseResultImage}
                alt="result"
                className="max-h-full w-auto object-contain bg-slate-50 cursor-zoom-in"
                onClick={() => openPreview(poseResultImage, '生成结果')}
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

export default ModelAdjustTabV2;
