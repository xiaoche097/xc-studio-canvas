import React, { useState } from 'react';
import { Upload, X, Zap, Loader2, Download, Maximize2, Lock, Sparkles } from 'lucide-react';
import { AspectRatio } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { blobToBase64, getErrorMessage } from '../Cyzx4/utils/apiHelpers';

const ModelAdjustTab: React.FC = () => {
  const [poseSourceFile, setPoseSourceFile] = useState<File | null>(null); // 图1
  const [poseSourceUrl, setPoseSourceUrl] = useState<string | null>(null);
  const [poseRefFile, setPoseRefFile] = useState<File | null>(null); // 图2
  const [poseRefUrl, setPoseRefUrl] = useState<string | null>(null);
  const [poseGuidance, setPoseGuidance] = useState('');
  const [transferScope, setTransferScope] = useState<'upper-body' | 'full-body'>('upper-body');

  const [resolution, setResolution] = useState<'2K' | '4K'>('2K');

  const [isPoseGenerating, setIsPoseGenerating] = useState(false);
  const [poseStatusMessage, setPoseStatusMessage] = useState('');
  const [poseResultImage, setPoseResultImage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const detectClosestAspectRatio = async (imageUrl: string): Promise<AspectRatio> => {
    const img = new Image();
    const ratio: number = await new Promise((resolve, reject) => {
      img.onload = () => resolve(img.width / img.height);
      img.onerror = () => reject(new Error('Failed to load image for aspect ratio detection'));
      img.src = imageUrl;
    });

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

    return bestMatch;
  };

  const handlePoseSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) return;

    if (poseSourceUrl) URL.revokeObjectURL(poseSourceUrl);

    setPoseSourceFile(file);
    setPoseSourceUrl(URL.createObjectURL(file));
    setPoseResultImage(null);
    setPoseStatusMessage('');
    e.target.value = '';
  };

  const handlePoseRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) return;

    if (poseRefUrl) URL.revokeObjectURL(poseRefUrl);

    setPoseRefFile(file);
    setPoseRefUrl(URL.createObjectURL(file));
    setPoseResultImage(null);
    setPoseStatusMessage('');
    e.target.value = '';
  };

  const handlePoseSourceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    if (poseSourceUrl) URL.revokeObjectURL(poseSourceUrl);

    setPoseSourceFile(file);
    setPoseSourceUrl(URL.createObjectURL(file));
    setPoseResultImage(null);
    setPoseStatusMessage('');
  };

  const handlePoseRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    if (poseRefUrl) URL.revokeObjectURL(poseRefUrl);

    setPoseRefFile(file);
    setPoseRefUrl(URL.createObjectURL(file));
    setPoseResultImage(null);
    setPoseStatusMessage('');
  };

  const removePoseSource = () => {
    if (poseSourceUrl) URL.revokeObjectURL(poseSourceUrl);
    setPoseSourceFile(null);
    setPoseSourceUrl(null);
    setPoseResultImage(null);
    setPoseStatusMessage('');
  };

  const removePoseRef = () => {
    if (poseRefUrl) URL.revokeObjectURL(poseRefUrl);
    setPoseRefFile(null);
    setPoseRefUrl(null);
    setPoseResultImage(null);
    setPoseStatusMessage('');
  };

  const buildPoseTransferPrompt = (userGuidance: string, scope: 'upper-body' | 'full-body') => {
    const guidance = (userGuidance || '').trim();
    const scopeRule = scope === 'upper-body'
      ? 'Transfer only upper-body pose cues from Image 2: shoulder slope, neck direction, torso twist, arm placement, elbow bend, wrist angle, and visible hand gesture. Keep the lower body, waistline, garment hem, and overall crop from Image 1 fixed.'
      : 'Transfer the full-body stance from Image 2 while still preserving Image 1 identity, outfit, background, and framing. If the target pose is larger than the current crop, compress it into Image 1 framing instead of zooming out.';

    return `Task: locked pose transfer for a real-person e-commerce photo.

You have TWO input images:
- Image 1 = source photo to preserve
- Image 2 = pose cue only

PRIORITY ORDER:
1. Preserve Image 1 exactly for identity, face, hairstyle, skin texture, body proportions, clothing, accessories, tattoos, bag, background, lighting, camera angle, crop, framing, and subject scale.
2. Read only pose information from Image 2.
3. Never import Image 2 clothing, bag, skin tone, background, lighting, zoom level, composition, or body shape into the output.

READ FROM IMAGE 2 ONLY:
- shoulder line
- torso rotation
- arm placement
- elbow bend
- wrist direction
- hand gesture or hand placement if visible

COMPOSITION LOCK:
- Keep Image 1 framing and camera unchanged.
- Do not zoom out, recenter, or copy Image 2 composition.
- If Image 2 suggests a wider crop, adapt the pose inside Image 1's existing crop.

SCOPE:
${scopeRule}

IGNORE FROM IMAGE 2:
- clothing and fabric details
- accessories and props
- background and lighting
- crop and subject scale
- body reshaping

USER LOCK INSTRUCTION:
${guidance || 'Keep everything from Image 1 unchanged. Only replace the pose using Image 2.'}

Output one photorealistic corrected image. The final result should look like Image 1 after a careful retoucher changed only the pose.`;
  };

  const buildPoseTransferNegativePrompt = (scope: 'upper-body' | 'full-body') => [
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
    'camera angle change',
    'crop change',
    scope === 'upper-body'
      ? 'changed lower body, changed waistband, changed garment hem'
      : 'zoomed out framing, recentered subject, copied Image 2 composition',
  ].join(', ');

  const handleGeneratePoseTransfer = async () => {
    if (!poseSourceFile || !poseRefFile || !poseSourceUrl) {
      alert('请上传图1（原图）和图2（姿势参考）');
      return;
    }

    setIsPoseGenerating(true);
    setPoseStatusMessage('正在进行姿势匹配生成...');

    try {
      const [sourceBase64, refBase64] = await Promise.all([
        blobToBase64(poseSourceFile),
        blobToBase64(poseRefFile),
      ]);

      const aspect = await detectClosestAspectRatio(poseSourceUrl);
      const prompt = buildPoseTransferPrompt(poseGuidance);

      const result = await generateImageToImage(
        [
          { base64: sourceBase64, mimeType: poseSourceFile.type || 'image/jpeg' },
          { base64: refBase64, mimeType: poseRefFile.type || 'image/jpeg' },
        ],
        prompt,
        {
          aspectRatio: aspect as any,
          resolution: resolution as any,
          modelId: 'gemini-3.1-flash-image-preview',
        }
      );

      if (result && result.length > 0) {
        setPoseResultImage(result[0]);
        setPoseStatusMessage('');
      } else {
        throw new Error('模型未返回任何图片，请稍后重试');
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsPoseGenerating(false);
    }
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* Left Panel */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-5 flex-1 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-pastel-text flex items-center justify-between">
              <span>模特调整（真人姿势替换）</span>
              <span className="text-[10px] font-normal text-pastel-muted">图1保持不变，仅替换姿势</span>
            </h3>
          </div>

          <div className="space-y-3 bg-white p-4 rounded-xl border border-pastel-border shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              {/* 图1 */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-pastel-muted">图1：原图（保持不变）</div>
                {poseSourceUrl ? (
                  <div className="relative w-full h-28 rounded-lg overflow-hidden border border-pastel-border shadow-sm group">
                    <img src={poseSourceUrl} alt="pose-source" className="w-full h-full object-cover" />
                    <button
                      onClick={removePoseSource}
                      className="absolute z-10 top-1 right-1 bg-black/50 p-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="relative w-full h-28 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handlePoseSourceDrop}
                  >
                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                      <input type="file" className="hidden" onChange={handlePoseSourceChange} accept="image/*" />
                      <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                      <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">拖拽或点击上传图1</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 图2 */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-pastel-muted">图2：姿势参考（只用骨架）</div>
                {poseRefUrl ? (
                  <div className="relative w-full h-28 rounded-lg overflow-hidden border border-pastel-border shadow-sm group">
                    <img src={poseRefUrl} alt="pose-ref" className="w-full h-full object-cover" />
                    <button
                      onClick={removePoseRef}
                      className="absolute z-10 top-1 right-1 bg-black/50 p-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="relative w-full h-28 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handlePoseRefDrop}
                  >
                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                      <input type="file" className="hidden" onChange={handlePoseRefChange} accept="image/*" />
                      <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                      <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">拖拽或点击上传图2</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold text-pastel-muted">提示词（告诉模型：什么替换什么不变）</div>
              <textarea
                rows={4}
                value={poseGuidance}
                onChange={(e) => setPoseGuidance(e.target.value)}
                placeholder="例如：只改上半身姿势与手势；下半身、衣摆、构图保持图1不动。"
                className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-pastel-muted mb-2 bg-white p-3 border border-pastel-border rounded-xl shadow-sm">
                  <span className="block mb-2">生成画质</span>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as any)}
                    className="w-full bg-pastel-bg border border-pastel-border rounded-lg py-2 px-2 text-xs font-bold focus:ring-2 focus:ring-pastel-highlight/20 outline-none"
                  >
                    <option value="2K">2K (默认)</option>
                    <option value="4K">4K (超清)</option>
                  </select>
                </h3>
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-pastel-muted mb-2 bg-white p-3 border border-pastel-border rounded-xl shadow-sm">
                  <span className="block mb-2">输出画幅</span>
                  <div className="text-xs font-bold text-pastel-highlight bg-pastel-highlight/10 border border-pastel-highlight/20 rounded-lg py-2 px-2">
                    跟随图1自动检测
                  </div>
                </h3>
              </div>
            </div>

            <button
              onClick={handleGeneratePoseTransfer}
              disabled={isPoseGenerating}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all active:scale-[0.98] hover:shadow-orange-500/40 hover:brightness-105"
            >
              {isPoseGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  生成中...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  生成模特调整
                </>
              )}
            </button>

            {poseStatusMessage && (
              <p className="text-[10px] text-pastel-muted italic">{poseStatusMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex p-6 overflow-hidden relative items-center justify-center bg-transparent">
        {isPoseGenerating ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-6 p-12 bg-white/50 backdrop-blur-md rounded-3xl border border-white shadow-xl">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-pastel-highlight animate-spin" />
                <Zap className="w-6 h-6 text-yellow-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-xl font-bold text-pastel-highlight tracking-tight">生成中...</h3>
                <p className="text-pastel-text/80 text-sm font-medium animate-pulse transition-all duration-500 max-w-[280px]">
                  {poseStatusMessage || '正在生成模特调整结果...'}
                </p>
              </div>
            </div>
          </div>
        ) : !poseResultImage ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted h-full w-full">
            <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-4 transition-all hover:scale-105 hover:border-pastel-highlight hover:shadow-lg hover:shadow-pastel-highlight/20">
              <Zap className="w-10 h-10 text-pastel-border" />
            </div>
            <p className="text-sm font-medium tracking-wide text-center">
              上传图1与图2并点击“生成模特调整”\n              <br />
              <span className="text-xs opacity-70">输出画幅会自动跟随图1</span>
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col gap-4 items-center justify-center">
            <div className="relative w-full max-w-[720px] group">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                title="放大预览"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <img
                src={poseResultImage}
                alt="pose-result"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full h-auto rounded-2xl border border-pastel-border shadow-lg bg-white cursor-zoom-in"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="px-4 py-2 bg-white text-gray-700 border border-pastel-border rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm"
              >
                <Maximize2 className="w-4 h-4" />
                放大查看
              </button>

              <button
                onClick={() => downloadImage(poseResultImage, `model-adjust-${Date.now()}.png`)}
                className="px-4 py-2 bg-white text-pastel-highlight border border-pastel-border rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-pastel-highlight/5 transition-all active:scale-[0.98] shadow-sm"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>

            {isPreviewOpen && (
              <div
                className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-2xl flex items-center justify-center p-8"
                onClick={() => setIsPreviewOpen(false)}
              >
                <div className="absolute top-10 right-10 group cursor-pointer" onClick={() => setIsPreviewOpen(false)}>
                  <div className="bg-white/10 group-hover:bg-white/20 p-4 rounded-full transition-all shadow-2xl backdrop-blur-md border border-white/10">
                    <X className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div
                  className="relative max-w-6xl w-full h-[90vh] rounded-[2.5rem] overflow-hidden bg-zinc-950 shadow-[0_64px_128px_rgba(0,0,0,0.5)] border border-white/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img src={poseResultImage} className="w-full h-full object-contain" alt="pose-preview" />

                  <div className="absolute bottom-10 inset-x-0 flex justify-center">
                    <div className="bg-white/10 backdrop-blur-3xl p-2 rounded-full border border-white/10 shadow-2xl flex gap-1">
                      <button
                        onClick={() => downloadImage(poseResultImage, `model-adjust-${Date.now()}.png`)}
                        className="px-8 py-3.5 rounded-full flex items-center gap-3 text-[11px] font-black bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-xl shadow-orange-500/20 active:scale-95"
                      >
                        <Download className="w-4 h-4" /> 保存作品
                      </button>
                      <button
                        onClick={() => setIsPreviewOpen(false)}
                        className="px-8 py-3.5 rounded-full flex items-center gap-3 text-[11px] font-black bg-transparent text-white/70 hover:text-white hover:bg-white/5"
                      >
                        <X className="w-4 h-4" /> 退出预览
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelAdjustTab;
