import React, { useState } from 'react';
import { Upload, X, Zap, Loader2, Download } from 'lucide-react';
import { AspectRatio } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { blobToBase64, getErrorMessage } from '../Cyzx4/utils/apiHelpers';

const ModelAdjustTab: React.FC = () => {
  const [poseSourceFile, setPoseSourceFile] = useState<File | null>(null); // 图1
  const [poseSourceUrl, setPoseSourceUrl] = useState<string | null>(null);
  const [poseRefFile, setPoseRefFile] = useState<File | null>(null); // 图2
  const [poseRefUrl, setPoseRefUrl] = useState<string | null>(null);
  const [poseGuidance, setPoseGuidance] = useState('');

  const [resolution, setResolution] = useState<'2K' | '4K'>('2K');

  const [isPoseGenerating, setIsPoseGenerating] = useState(false);
  const [poseStatusMessage, setPoseStatusMessage] = useState('');
  const [poseResultImage, setPoseResultImage] = useState<string | null>(null);

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

  const buildPoseTransferPrompt = (userGuidance: string) => {
    const guidance = (userGuidance || '').trim();
    return `Task: Real-person photo pose transfer.\n\nYou have TWO input images:\n- Image 1 = ORIGINAL PHOTO (must be preserved)\n- Image 2 = POSE REFERENCE (skeleton only)\n\nCRITICAL: First, copy Image 1 completely and keep it unchanged: same person identity, face, skin texture, expression, hairstyle, body shape, clothing & material details, accessories, background, lighting direction/intensity, color temperature, camera angle/lens look, depth of field, composition, framing, subject position and scale. Everything must match Image 1.\n\nONLY ALLOWED CHANGE: pose. Re-pose the person from Image 1 to match Image 2's body skeleton: head direction, shoulder/neck angle, torso tilt/twist, arm placement and bending, hand gesture and finger pose, leg stance/gait/weight shift. Anatomically correct joints, natural motion, correct finger count.\n\nUSER INSTRUCTION (what to change / what must remain fixed): ${guidance || 'Preserve everything from Image 1. Only change pose to match Image 2.'}\n\nOutput: ONE photorealistic image. Pose updated, everything else identical to Image 1.`;
  };

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
                  <label className="relative w-full h-28 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group">
                    <input type="file" className="hidden" onChange={handlePoseSourceChange} accept="image/*" />
                    <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                    <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">上传图1</span>
                  </label>
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
                  <label className="relative w-full h-28 rounded-lg border-2 border-dashed border-pastel-border hover:border-pastel-highlight hover:bg-pastel-highlight/5 flex flex-col items-center justify-center text-pastel-muted transition-all cursor-pointer overflow-hidden group">
                    <input type="file" className="hidden" onChange={handlePoseRefChange} accept="image/*" />
                    <Upload className="w-5 h-5 group-hover:text-pastel-highlight" />
                    <span className="text-[10px] mt-1 group-hover:text-pastel-highlight">上传图2</span>
                  </label>
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
            <div className="relative w-full max-w-[720px]">
              <img
                src={poseResultImage}
                alt="pose-result"
                className="w-full h-auto rounded-2xl border border-pastel-border shadow-lg bg-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => downloadImage(poseResultImage, `model-adjust-${Date.now()}.png`)}
                className="px-4 py-2 bg-white text-pastel-highlight border border-pastel-border rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-pastel-highlight/5 transition-all active:scale-[0.98] shadow-sm"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelAdjustTab;
