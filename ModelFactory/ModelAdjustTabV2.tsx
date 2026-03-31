import React, { useEffect, useState } from 'react';
import { Download, Loader2, Lock, Maximize2, Sparkles, Upload, X, Zap } from 'lucide-react';
import { AspectRatio } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';

type TransferScope = 'upper-body' | 'full-body';
type PoseTransferAspectRatio =
  | AspectRatio.PORTRAIT_2_3
  | AspectRatio.PORTRAIT_9_16
  | AspectRatio.PORTRAIT_3_4
  | AspectRatio.SQUARE;

type PreviewState = {
  src: string;
  title: string;
  subtitle?: string;
} | null;

type UploadBlockProps = {
  title: string;
  badge: string;
  subtitle: string;
  tip: string;
  imageUrl: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  onPreview: () => void;
  emptyLabel: string;
};

const UploadBlock: React.FC<UploadBlockProps> = ({
  title,
  badge,
  subtitle,
  tip,
  imageUrl,
  onChange,
  onDrop,
  onRemove,
  onPreview,
  emptyLabel,
}) => (
  <div className="rounded-2xl border border-pastel-border bg-white p-3 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-pastel-text">{title}</div>
        <div className="mt-1 text-xs leading-5 text-pastel-muted">{subtitle}</div>
      </div>
      <span className="rounded-full border border-pastel-highlight/20 bg-pastel-highlight/10 px-2.5 py-1 text-[10px] font-bold text-pastel-highlight">
        {badge}
      </span>
    </div>

    {imageUrl ? (
      <>
        <button
          type="button"
          onClick={onPreview}
          className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-pastel-border bg-pastel-bg sm:aspect-[5/4]"
        >
          <img src={imageUrl} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/15 p-2 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
            <Maximize2 className="h-4 w-4" />
          </div>
        </button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-pastel-border bg-pastel-bg px-3 py-2.5 text-xs font-bold text-pastel-text transition-colors hover:border-pastel-highlight/40 hover:bg-pastel-highlight/5">
            <input type="file" className="hidden" onChange={onChange} accept="image/*" />
            <Upload className="h-4 w-4" />
            更换
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-100"
          >
            <X className="h-4 w-4" />
            移除
          </button>
        </div>
      </>
    ) : (
      <label
        className="group flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg/60 px-4 text-center transition-all hover:border-pastel-highlight hover:bg-pastel-highlight/5 sm:aspect-[5/4]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input type="file" className="hidden" onChange={onChange} accept="image/*" />
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-pastel-muted shadow-sm transition-colors group-hover:text-pastel-highlight">
          <Upload className="h-5 w-5" />
        </div>
        <div className="text-sm font-bold text-pastel-text">{emptyLabel}</div>
        <div className="mt-2 text-xs leading-5 text-pastel-muted">拖拽图片到这里，或点击选择</div>
      </label>
    )}

    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
      {tip}
    </div>
  </div>
);

const ModelAdjustTabV2: React.FC = () => {
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

  useEffect(() => {
    return () => {
      if (poseSourceUrl) {
        URL.revokeObjectURL(poseSourceUrl);
      }
      if (poseRefUrl) {
        URL.revokeObjectURL(poseRefUrl);
      }
    };
  }, [poseRefUrl, poseSourceUrl]);

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
    setPoseRefFile(file);
    setPoseRefUrl(URL.createObjectURL(file));
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
    setPoseRefFile(null);
    setPoseRefUrl(null);
    resetResult();
  };

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
      ? 'Match Image 2 upper-body pose and upper-body framing as closely as possible: shoulder slope, neck direction, torso twist, arm placement, elbow bend, wrist angle, visible hand gesture, and how the upper body sits inside the frame. Lower body and garment hem should stay as stable as possible unless a small adjustment is required to support the upper-body pose.'
      : 'Match Image 2 full-body pose, body angle, subject placement, and framing as closely as possible while preserving Image 1 identity, outfit, and product fidelity. If Image 2 uses a different crop distance or subject scale, follow Image 2 rather than forcing Image 1 framing.';

    return `Task: pose transfer for a real-person e-commerce photo.

You have TWO input images:
- Image 1 = identity / outfit / product source
- Image 2 = pose and framing blueprint

PRIORITY ORDER:
1. Preserve Image 1 identity, face, hairstyle, skin texture, body proportions, clothing, accessories, tattoos, bag, and product details.
2. Match Image 2 body pose, body angle, arm position, hand placement, and subject framing as literally as possible.
3. Do not import Image 2 clothing design, fabric details, accessories, bag, background, or lighting into the output.

SUCCESS CRITERIA:
- The result must look like the person and outfit from Image 1 restaged into the pose and framing of Image 2.
- A viewer should clearly see that the shoulder line, torso direction, arm position, hand placement, and crop/subject placement now follow Image 2.
- If the output still looks like Image 1's original pose or Image 1's original framing, that is a failure.

READ FROM IMAGE 2:
- shoulder line
- torso rotation
- body angle and stance
- arm placement
- elbow bend
- wrist direction
- hand gesture or hand placement if visible
- crop distance
- subject placement inside the frame
- camera/framing relationship

SCOPE:
${scopeRule}

POSE EXECUTION RULES:
- Match Image 2 literally, not approximately.
- Prioritize pose match and framing match over preserving Image 1 camera angle or crop.
- If needed, rebuild shoulders, arms, neck angle, torso twist, and overall body placement so they clearly follow Image 2.
- It is allowed to reframe, recrop, or rescale the subject to match Image 2 composition.
- Do not settle for a tiny variation of Image 1.

IGNORE FROM IMAGE 2:
- clothing and fabric details
- accessories and props
- background and lighting
- identity details
- body reshaping

USER LOCK INSTRUCTION:
${guidance || 'Keep the person, outfit, and product details from Image 1. Follow the pose, angle, and framing of Image 2 as closely as possible.'}

Output one photorealistic corrected image. The final result should look like Image 1 restaged into the pose and framing blueprint of Image 2.`;
  };

  const buildPoseTransferNegativePrompt = (scope: TransferScope) => [
    'copying Image 2 clothing',
    'copying Image 2 accessories',
    'copying Image 2 bag',
    'copying Image 2 background',
    'copying Image 2 lighting',
    'different identity',
    'different hairstyle',
    'different skin tone',
    'altered body proportions',
    'garment redesign',
    'extra fingers',
    'extra hands',
    'missing accessories',
    'same pose as Image 1',
    'unchanged shoulders',
    'unchanged arms',
    'unchanged hand placement',
    'unchanged framing from Image 1',
    'tiny pose difference',
    'subtle pose adjustment only',
    scope === 'upper-body'
      ? 'unnecessary lower-body change, unnecessary garment hem change'
      : 'same crop as Image 1 when Image 2 framing is different, unchanged subject placement',
  ].join(', ');

  const handleGeneratePoseTransfer = async () => {
    if (!poseSourceFile || !poseRefFile) {
      alert('请上传图1（原图）和图2（姿势参考）');
      return;
    }

    setIsPoseGenerating(true);
    setPoseStatusMessage('正在锁定图1人物与服装，并按图2重建姿势、朝向与构图...');

    try {
      const [sourceImage, refImage] = await Promise.all([
        compressImage(poseSourceFile, 2048, 0.96),
        compressImage(poseRefFile, 2048, 0.96),
      ]);

      const prompt = buildPoseTransferPrompt(poseGuidance, transferScope);
      const negativePrompt = buildPoseTransferNegativePrompt(transferScope);
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
    <div className="flex h-full w-full flex-col bg-pastel-bg text-pastel-text xl:flex-row">
      <div className="flex w-full flex-col border-r border-pastel-border bg-pastel-card shadow-sm xl:w-[500px] xl:flex-shrink-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 custom-scrollbar">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Pose Transfer</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-pastel-text">模特调整</h3>
            <p className="text-sm leading-6 text-pastel-muted">
              图1锁定人物与服装，图2同时提供姿势、身体朝向和画幅参考。现在结果会优先贴近图2的站姿与构图，而不是死守图1原画幅。
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <UploadBlock
              title="图1 原图"
              badge="主锁定图"
              subtitle="人物身份、服装、背景、光线和画幅都从这里继承。"
              tip="建议放你最满意的成片，这张图会锁住大部分视觉信息。"
              imageUrl={poseSourceUrl}
              onChange={handlePoseSourceChange}
              onDrop={handlePoseSourceDrop}
              onRemove={removePoseSource}
              onPreview={() => openPreview(poseSourceUrl, '图1 原图', '锁定身份、服装、背景与画幅')}
              emptyLabel="上传原图"
            />
            <UploadBlock
              title="图2 姿势参考"
              badge="姿势骨架"
              subtitle="只读取肩线、手臂、手势和躯干转向，不复制服装、背景与配饰。"
              tip="图2如果带包、项链或特殊裁切，默认不会跟着复制。现在它更像动作草图，而不是整张风格参考。"
              imageUrl={poseRefUrl}
              onChange={handlePoseRefChange}
              onDrop={handlePoseRefDrop}
              onRemove={removePoseRef}
              onPreview={() => openPreview(poseRefUrl, '图2 姿势参考', '只读取姿势，不读取风格与配饰')}
              emptyLabel="上传姿势参考图"
            />
          </div>

          <div className="space-y-4 rounded-[28px] border border-pastel-border bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-3 rounded-2xl border border-pastel-border bg-pastel-bg/60 p-3 lg:col-span-2">
                <div className="text-xs font-bold text-pastel-muted">迁移范围</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferScope('upper-body')}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold transition-all ${transferScope === 'upper-body' ? 'border-pastel-highlight bg-pastel-highlight/10 text-pastel-highlight shadow-sm' : 'border-pastel-border bg-white text-pastel-muted hover:border-pastel-highlight/40'}`}
                  >
                    仅上半身
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferScope('full-body')}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold transition-all ${transferScope === 'full-body' ? 'border-pastel-highlight bg-pastel-highlight/10 text-pastel-highlight shadow-sm' : 'border-pastel-border bg-white text-pastel-muted hover:border-pastel-highlight/40'}`}
                  >
                    全身姿势
                  </button>
                </div>
                <div className="rounded-xl bg-white px-3 py-2.5 text-xs leading-5 text-slate-500">
                  {transferScope === 'upper-body'
                    ? '优先匹配图2的肩颈、上半身朝向、手臂和上半身构图；必要时允许轻微调整下半身来支撑最终姿势。'
                    : '适合需要明显站姿、身体角度和画幅变化的场景，结果会尽量贴近图2的人物朝向、站位和裁切。'}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-700">
                当前会优先锁定图1的人物与服装细节，同时把图2当作姿势、朝向和构图蓝图来执行。输出画幅按你上面选择的比例生成，但人物站位和裁切会尽量向图2靠拢。
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-pastel-border bg-pastel-bg/60 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-pastel-muted">生成画质</div>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as '2K' | '4K')}
                  className="w-full rounded-xl border border-pastel-border bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-pastel-highlight/20"
                >
                  <option value="2K">2K 默认</option>
                  <option value="4K">4K 更细节</option>
                </select>
              </div>

              <div className="rounded-2xl border border-pastel-border bg-pastel-bg/60 p-3 lg:col-span-2">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-pastel-muted">输出画幅</div>
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
                      onClick={() => setOutputAspectRatio(item.value)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                        outputAspectRatio === item.value
                          ? 'border-pastel-highlight bg-pastel-highlight/10 text-pastel-highlight shadow-sm'
                          : 'border-pastel-border bg-white text-pastel-muted hover:border-pastel-highlight/40'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-pastel-muted">补充约束</div>
              <textarea
                rows={3}
                value={poseGuidance}
                onChange={(e) => setPoseGuidance(e.target.value)}
                placeholder="例如：保持图1的人和衣服不变，但人物朝向、手臂位置、站位和裁切尽量跟图2一致。"
                className="w-full resize-none rounded-2xl border border-pastel-border bg-pastel-bg px-4 py-3 text-sm leading-6 outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-pastel-highlight/20"
              />
            </div>

            <button
              onClick={handleGeneratePoseTransfer}
              disabled={isPoseGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-3.5 text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-105 hover:shadow-orange-500/40 active:scale-[0.99] disabled:opacity-50"
            >
              {isPoseGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  正在生成模特调整
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  生成模特调整
                </>
              )}
            </button>

            {poseStatusMessage && (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                {poseStatusMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(237,109,70,0.12),_transparent_26%),linear-gradient(180deg,_#f5f9ff_0%,_#edf4fb_100%)] p-5">
        <div className="flex h-full flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-[220px,220px,minmax(260px,1fr)]">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur-sm">
              <div className="mb-3 text-sm font-bold text-slate-800">图1 锁定内容</div>
              {poseSourceUrl ? (
                <button type="button" onClick={() => openPreview(poseSourceUrl, '图1 原图', '锁定身份、服装、背景与画幅')} className="block w-full overflow-hidden rounded-2xl border border-slate-200">
                  <img src={poseSourceUrl} alt="图1 原图" className="aspect-square w-full object-cover sm:aspect-[5/4]" />
                </button>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400 sm:aspect-[5/4]">
                  暂未上传
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur-sm">
              <div className="mb-3 text-sm font-bold text-slate-800">图2 读取内容</div>
              {poseRefUrl ? (
                <button type="button" onClick={() => openPreview(poseRefUrl, '图2 姿势参考', '只读取姿势，不读取风格与配饰')} className="block w-full overflow-hidden rounded-2xl border border-slate-200">
                  <img src={poseRefUrl} alt="图2 姿势参考" className="aspect-square w-full object-cover sm:aspect-[5/4]" />
                </button>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400 sm:aspect-[5/4]">
                  暂未上传
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-800">
                <Lock className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-black">姿势读取规则</span>
              </div>
              <div className="grid gap-3 text-sm leading-7 text-slate-500 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <div>图1优先锁定人物身份、服装细节和产品信息，不跟着图2换人换衣服。</div>
                <div>图2同时提供肩线、躯干朝向、手臂位置、手势，以及人物在画面里的站位和裁切参考。</div>
                <div>如果图2的动作或取景和图1不同，允许通过重新站位、重新裁切或调整人物占比去贴近图2，而不是强行维持图1原构图。</div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-[32px] border border-white/70 bg-white/75 p-5 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.4)] backdrop-blur-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-pastel-highlight">
                  <Sparkles className="h-4 w-4" />
                  Result Workspace
                </div>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                  {poseResultImage ? '姿势迁移结果' : '结果预览区'}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {poseResultImage ? '先对照图1和图2检查肩线、手臂、手势是否贴近参考，再放大看衣服和配饰是否稳定。' : '上传两张图后，结果会直接出现在这里，不再留一大片空白。'}
                </p>
              </div>

              {poseResultImage && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openPreview(poseResultImage, '生成结果', '点击查看大图细节')} className="flex items-center justify-center gap-2 rounded-2xl border border-pastel-border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                    <Maximize2 className="h-4 w-4" />
                    放大查看
                  </button>
                  <button type="button" onClick={() => downloadImage(poseResultImage, `model-adjust-${Date.now()}.png`)} className="flex items-center justify-center gap-2 rounded-2xl border border-pastel-highlight/20 bg-pastel-highlight/10 px-4 py-2.5 text-sm font-bold text-pastel-highlight transition-colors hover:bg-pastel-highlight/15">
                    <Download className="h-4 w-4" />
                    下载结果
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 flex-1 min-h-0 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/60">
              {isPoseGenerating ? (
                <div className="flex h-full w-full items-center justify-center p-6">
                  <div className="flex max-w-md flex-col items-center gap-5 rounded-[28px] border border-white bg-white/90 px-10 py-12 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.5)]">
                    <div className="relative">
                      <Loader2 className="h-16 w-16 animate-spin text-pastel-highlight" />
                      <Zap className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-black text-slate-900">正在生成姿势迁移</h4>
                      <p className="text-sm leading-7 text-slate-500">{poseStatusMessage || '正在锁定图1内容，并把图2动作压进当前构图。'}</p>
                    </div>
                  </div>
                </div>
              ) : poseResultImage ? (
                <div className="flex h-full w-full flex-col overflow-hidden p-4">
                  <button type="button" onClick={() => openPreview(poseResultImage, '生成结果', '点击查看大图细节')} className="group relative flex-1 overflow-hidden rounded-[24px] border border-white bg-white shadow-sm">
                    <img src={poseResultImage} alt="pose-result" className="h-full w-full object-contain bg-[linear-gradient(180deg,_#f8fbff_0%,_#eff4fb_100%)]" />
                    <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-slate-950/50 p-2 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
                      <Maximize2 className="h-4 w-4" />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="grid h-full w-full gap-4 p-4 xl:grid-cols-[minmax(280px,340px),minmax(0,1fr)]">
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800">
                      <Lock className="h-4 w-4 text-emerald-500" />
                      生成前检查
                    </div>
                    <div className="space-y-3 text-sm leading-7 text-slate-500">
                      <div>图1建议选择你最满意的成片，因为这张图会锁住身份、服装和构图。</div>
                      <div>图2尽量选动作清晰、手臂和肩线明确的参考，越少风格干扰越稳。</div>
                      <div>如果你只想动上半身，保持“仅上半身”即可，成功率会更高。</div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,_rgba(237,109,70,0.06)_0%,_rgba(255,255,255,0.92)_100%)] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800">
                      <Sparkles className="h-4 w-4 text-pastel-highlight" />
                      结果将出现在这里
                    </div>
                    <div className="flex h-[calc(100%-2rem)] min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-white bg-white/75 px-6 text-center shadow-inner">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-pastel-highlight/10 text-pastel-highlight">
                        <Zap className="h-8 w-8" />
                      </div>
                      <div className="text-lg font-black text-slate-900">等待生成</div>
                      <div className="mt-2 max-w-sm text-sm leading-7 text-slate-500">上传图1和图2后点击“生成模特调整”，结果会按图1画幅直接落在这里，方便你马上对照检查。</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-xl" onClick={() => setPreview(null)}>
          <button type="button" onClick={() => setPreview(null)} className="absolute right-6 top-6 rounded-full border border-white/15 bg-white/10 p-3 text-white transition-colors hover:bg-white/20">
            <X className="h-6 w-6" />
          </button>

          <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0d1117] shadow-[0_60px_140px_rgba(0,0,0,0.55)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5 text-white">
              <div>
                <div className="text-lg font-black">{preview.title}</div>
                {preview.subtitle && <div className="mt-1 text-sm text-white/60">{preview.subtitle}</div>}
              </div>
              <button type="button" onClick={() => downloadImage(preview.src, `${preview.title}-${Date.now()}.png`)} className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/15">
                <Download className="h-4 w-4" />
                下载
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <img src={preview.src} className="h-full w-full object-contain" alt={preview.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelAdjustTabV2;
