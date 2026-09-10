import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import {
  AlertCircle,
  ChevronLeft,
  Crop,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UserCircle2,
  X,
  Zap,
} from 'lucide-react';
import { generateImageToImage, compressImage } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { convertImageDataUrlFormat } from '../utils/imageFormat';
import { applyColorCorrection, extractEdges } from '../utils/imageProcessor';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { useImagePaste } from '../hooks/useImagePaste';
import { downloadImageFile } from '../utils/imageDownload';

type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mime: string;
  width: number;
  height: number;
};

type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type PasteTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type CropPreset = 'face' | 'headShoulders' | 'halfBody';
type CropAspectRatio = '3:4' | '2:3';
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '3.1 Flash', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', desc: '3 Pro', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality', icon: <Sparkles className="h-4 w-4 text-orange-500" /> },
  { id: 'qwen-image-3.0-pro', label: '千问3.0pro', desc: 'Qwen Image', icon: <Sparkles className="h-4 w-4 text-cyan-500" /> },
];

const PRESETS: Record<CropPreset, { label: string; desc: string; box: CropBox }> = {
  face: {
    label: '脸部',
    desc: '五官细节',
    box: { x: 0.34, y: 0.04, w: 0.32, h: 0.28 },
  },
  headShoulders: {
    label: '头肩',
    desc: '默认推荐',
    box: { x: 0.22, y: 0.04, w: 0.56, h: 0.46 },
  },
  halfBody: {
    label: '半身',
    desc: '脸和肤质',
    box: { x: 0.13, y: 0.02, w: 0.74, h: 0.62 },
  },
};

const CROP_ASPECT_RATIO_OPTIONS: Array<{
  id: CropAspectRatio;
  label: string;
  desc: string;
  value: number;
}> = [
  { id: '3:4', label: '3:4', desc: '标准贴回', value: 3 / 4 },
  { id: '2:3', label: '2:3', desc: '纵向扩展', value: 2 / 3 },
];
const DEFAULT_CROP_ASPECT_RATIO: CropAspectRatio = '3:4';
const getCropAspectRatioValue = (ratio: CropAspectRatio) => (
  CROP_ASPECT_RATIO_OPTIONS.find(option => option.id === ratio)?.value ?? 3 / 4
);
const MIN_CROP_WIDTH = 0.12;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getNormalizedCropAspectRatio = (frameAspectRatio: number, aspectRatio: number) => aspectRatio / frameAspectRatio;

const fitCropBoxToAspectRatio = (
  box: CropBox,
  frameAspectRatio = 1,
  aspectRatio = getCropAspectRatioValue(DEFAULT_CROP_ASPECT_RATIO)
): CropBox => {
  const normalizedAspectRatio = aspectRatio / frameAspectRatio;
  const centerX = box.x + box.w / 2;
  const centerY = box.y + box.h / 2;
  const maxW = Math.min(1, centerX * 2, (1 - centerX) * 2);
  const maxH = Math.min(1, centerY * 2, (1 - centerY) * 2);
  let w = box.w;
  let h = w / normalizedAspectRatio;

  if (h > box.h) {
    h = box.h;
    w = h * normalizedAspectRatio;
  }
  if (w > maxW) {
    w = maxW;
    h = w / normalizedAspectRatio;
  }
  if (h > maxH) {
    h = maxH;
    w = h * normalizedAspectRatio;
  }

  w = Math.max(Math.min(w, maxW), Math.min(MIN_CROP_WIDTH, maxW));
  h = w / normalizedAspectRatio;
  if (h > maxH) {
    const minCropHeight = MIN_CROP_WIDTH / normalizedAspectRatio;
    h = Math.max(Math.min(maxH, 1), Math.min(minCropHeight, maxH));
    w = h * normalizedAspectRatio;
  }

  return {
    x: clamp(centerX - w / 2, 0, 1 - w),
    y: clamp(centerY - h / 2, 0, 1 - h),
    w,
    h,
  };
};

const getPresetCropBox = (
  preset: CropPreset,
  frameAspectRatio = 1,
  aspectRatio = getCropAspectRatioValue(DEFAULT_CROP_ASPECT_RATIO)
) => (
  fitCropBoxToAspectRatio(PRESETS[preset].box, frameAspectRatio, aspectRatio)
);

const resizeCropBoxFromCorner = (
  start: CropBox,
  mode: Exclude<DragMode, 'move'>,
  dx: number,
  dy: number,
  frameAspectRatio: number,
  aspectRatio: number
): CropBox => {
  const normalizedAspectRatio = getNormalizedCropAspectRatio(frameAspectRatio, aspectRatio);
  const left = start.x;
  const top = start.y;
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const anchorX = mode.includes('w') ? right : left;
  const anchorY = mode.includes('n') ? bottom : top;
  const pointerX = clamp(mode.includes('w') ? left + dx : right + dx, 0, 1);
  const pointerY = clamp(mode.includes('n') ? top + dy : bottom + dy, 0, 1);
  const desiredW = Math.abs(pointerX - anchorX);
  const desiredH = Math.abs(pointerY - anchorY);
  const widthFromPointerY = desiredH * normalizedAspectRatio;
  let nextW = Math.max(desiredW, widthFromPointerY, MIN_CROP_WIDTH);

  const maxWByX = mode.includes('w') ? anchorX : 1 - anchorX;
  const maxHByY = mode.includes('n') ? anchorY : 1 - anchorY;
  nextW = Math.min(nextW, maxWByX, maxHByY * normalizedAspectRatio);
  const nextH = nextW / normalizedAspectRatio;

  return {
    x: mode.includes('w') ? anchorX - nextW : anchorX,
    y: mode.includes('n') ? anchorY - nextH : anchorY,
    w: nextW,
    h: nextH,
  };
};

const getDataUrl = (image: UploadedImage) => `data:${image.mime};base64,${image.base64}`;

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) {
    return { base64: dataUrl, mimeType: 'image/png' };
  }
  return { mimeType: match[1], base64: match[2] };
};

const loadCanvasImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('图片加载失败，请换一张图重试。'));
  img.src = src;
});

const getClosestAspectRatio = (ratio: number): AspectRatio => {
  const options = [
    { value: AspectRatio.SQUARE, ratio: 1 },
    { value: AspectRatio.PORTRAIT_3_4, ratio: 3 / 4 },
    { value: AspectRatio.PORTRAIT_2_3, ratio: 2 / 3 },
    { value: AspectRatio.PORTRAIT_4_5, ratio: 4 / 5 },
    { value: AspectRatio.LANDSCAPE_4_3, ratio: 4 / 3 },
    { value: AspectRatio.LANDSCAPE_3_2, ratio: 3 / 2 },
    { value: AspectRatio.LANDSCAPE_16_9, ratio: 16 / 9 },
  ];
  return options.reduce((best, current) => (
    Math.abs(current.ratio - ratio) < Math.abs(best.ratio - ratio) ? current : best
  )).value;
};

const cropImageDataUrl = async (sourceDataUrl: string, crop: CropBox) => {
  const img = await loadCanvasImage(sourceDataUrl);
  const sx = Math.round(crop.x * img.naturalWidth);
  const sy = Math.round(crop.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(crop.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(crop.h * img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 不可用，无法裁切图片。');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return {
    dataUrl: canvas.toDataURL('image/png', 0.96),
    width: sw,
    height: sh,
    aspectRatio: sw / sh,
  };
};

const getResolutionLongEdge = (resolution: ImageResolution) => {
  if (resolution === ImageResolution.RES_05K) return 512;
  if (resolution === ImageResolution.RES_1K) return 1024;
  if (resolution === ImageResolution.RES_4K) return 4096;
  return 2048;
};

const upscaleDataUrlToResolution = async (sourceDataUrl: string, resolution: ImageResolution) => {
  const img = await loadCanvasImage(sourceDataUrl);
  const targetLongEdge = getResolutionLongEdge(resolution);
  const currentLongEdge = Math.max(img.naturalWidth, img.naturalHeight);
  if (currentLongEdge >= targetLongEdge) return sourceDataUrl;

  const scale = targetLongEdge / currentLongEdge;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 不可用，无法按所选清晰度放大贴回底图。');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png', 0.96);
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) => {
  const sourceRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (sourceRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
};

const getFocusMaskRect = (preset: CropPreset) => {
  if (preset === 'face') {
    return { x: 0.16, y: 0.04, w: 0.68, h: 0.74, radius: 0.28 };
  }
  if (preset === 'headShoulders') {
    return { x: 0.14, y: 0.03, w: 0.72, h: 0.78, radius: 0.24 };
  }
  return { x: 0.18, y: 0.02, w: 0.64, h: 0.64, radius: 0.2 };
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
};

const getImageColorStats = (data: Uint8ClampedArray) => {
  const mean = [0, 0, 0];
  const chromaMean = [0, 0, 0];
  const count = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    mean[0] += r;
    mean[1] += g;
    mean[2] += b;
    chromaMean[0] += Math.abs(r - luma);
    chromaMean[1] += Math.abs(g - luma);
    chromaMean[2] += Math.abs(b - luma);
  }

  mean[0] /= count;
  mean[1] /= count;
  mean[2] /= count;
  chromaMean[0] /= count;
  chromaMean[1] /= count;
  chromaMean[2] /= count;

  const std = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    std[0] += (data[i] - mean[0]) ** 2;
    std[1] += (data[i + 1] - mean[1]) ** 2;
    std[2] += (data[i + 2] - mean[2]) ** 2;
  }

  std[0] = Math.sqrt(std[0] / count) || 1;
  std[1] = Math.sqrt(std[1] / count) || 1;
  std[2] = Math.sqrt(std[2] / count) || 1;
  return { mean, std, chroma: (chromaMean[0] + chromaMean[1] + chromaMean[2]) / 3 };
};

const syncRepairCropColorToSource = async (
  repairCropDataUrl: string,
  sourceCropDataUrl: string,
  blend = 0.92
) => {
  const repair = await loadCanvasImage(repairCropDataUrl);
  const source = await loadCanvasImage(sourceCropDataUrl);
  const width = repair.naturalWidth;
  const height = repair.naturalHeight;

  const repairCanvas = document.createElement('canvas');
  repairCanvas.width = width;
  repairCanvas.height = height;
  const repairCtx = repairCanvas.getContext('2d');
  if (!repairCtx) throw new Error('Canvas is not available for repair color sync.');
  repairCtx.drawImage(repair, 0, 0, width, height);
  const imageData = repairCtx.getImageData(0, 0, width, height);

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) throw new Error('Canvas is not available for source color sync.');
  drawImageCover(sourceCtx, source, 0, 0, width, height);
  const sourceData = sourceCtx.getImageData(0, 0, width, height).data;

  const repairStats = getImageColorStats(imageData.data);
  const sourceStats = getImageColorStats(sourceData);
  const chromaBoost = clamp(sourceStats.chroma / Math.max(1, repairStats.chroma), 1, 1.24);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const originalR = data[i];
    const originalG = data[i + 1];
    const originalB = data[i + 2];
    const mapped = [0, 0, 0];

    for (let c = 0; c < 3; c += 1) {
      mapped[c] = ((data[i + c] - repairStats.mean[c]) / repairStats.std[c]) * sourceStats.std[c] + sourceStats.mean[c];
    }

    let r = originalR * (1 - blend) + mapped[0] * blend;
    let g = originalG * (1 - blend) + mapped[1] * blend;
    let b = originalB * (1 - blend) + mapped[2] * blend;
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    r = luma + (r - luma) * chromaBoost;
    g = luma + (g - luma) * chromaBoost;
    b = luma + (b - luma) * chromaBoost;

    data[i] = Math.round(clamp(r, 0, 255));
    data[i + 1] = Math.round(clamp(g, 0, 255));
    data[i + 2] = Math.round(clamp(b, 0, 255));
  }

  repairCtx.putImageData(imageData, 0, 0);
  return repairCanvas.toDataURL('image/png', 0.96);
};

const composeRepairCropWithSource = async (
  sourceCropDataUrl: string,
  repairCropDataUrl: string,
  preset: CropPreset,
  featherPx: number
) => {
  const source = await loadCanvasImage(sourceCropDataUrl);
  const repair = await loadCanvasImage(repairCropDataUrl);
  const width = source.naturalWidth;
  const height = source.naturalHeight;

  const repairLayer = document.createElement('canvas');
  repairLayer.width = width;
  repairLayer.height = height;
  const repairCtx = repairLayer.getContext('2d');
  if (!repairCtx) throw new Error('Canvas is not available for crop repair compositing.');
  drawImageCover(repairCtx, repair, 0, 0, width, height);

  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const maskCtx = mask.getContext('2d');
  if (!maskCtx) throw new Error('Canvas is not available for crop repair masking.');

  const blur = Math.max(0, featherPx);
  const focus = getFocusMaskRect(preset);
  const focusX = focus.x * width;
  const focusY = focus.y * height;
  const focusW = focus.w * width;
  const focusH = focus.h * height;
  const focusRadius = Math.min(focusW, focusH) * focus.radius;
  maskCtx.save();
  if (blur > 0) {
    maskCtx.filter = `blur(${blur}px)`;
  }
  maskCtx.fillStyle = '#fff';
  drawRoundedRect(
    maskCtx,
    focusX + blur,
    focusY + blur,
    Math.max(1, focusW - blur * 2),
    Math.max(1, focusH - blur * 2),
    focusRadius
  );
  maskCtx.restore();

  repairCtx.globalCompositeOperation = 'destination-in';
  repairCtx.drawImage(mask, 0, 0);
  repairCtx.globalCompositeOperation = 'source-over';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available for crop repair output.');

  ctx.drawImage(source, 0, 0, width, height);
  ctx.drawImage(repairLayer, 0, 0);
  return canvas.toDataURL('image/png', 0.96);
};

const pasteCropBack = async (
  sourceDataUrl: string,
  generatedCropDataUrl: string,
  crop: CropBox,
  featherPx: number,
  preset: CropPreset,
  transform: PasteTransform
) => {
  const source = await loadCanvasImage(sourceDataUrl);
  const generated = await loadCanvasImage(generatedCropDataUrl);
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  const x = Math.round(crop.x * width);
  const y = Math.round(crop.y * height);
  const w = Math.max(1, Math.round(crop.w * width));
  const h = Math.max(1, Math.round(crop.h * height));

  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) throw new Error('Canvas 不可用，无法贴回图片。');
  const pasteScale = clamp(transform.scale, 0.72, 1.08);
  const pasteW = w * pasteScale;
  const pasteH = h * pasteScale;
  const pasteX = x + (w - pasteW) / 2 + transform.offsetX * w;
  const pasteY = y + (h - pasteH) / 2 + transform.offsetY * h;
  drawImageCover(layerCtx, generated, pasteX, pasteY, pasteW, pasteH);

  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const maskCtx = mask.getContext('2d');
  if (!maskCtx) throw new Error('Canvas 不可用，无法生成柔边。');
  const blur = Math.max(0, featherPx);
  const focus = getFocusMaskRect(preset);
  const focusX = x + focus.x * w;
  const focusY = y + focus.y * h;
  const focusW = focus.w * w;
  const focusH = focus.h * h;
  const focusRadius = Math.min(focusW, focusH) * focus.radius;
  maskCtx.save();
  if (blur > 0) {
    maskCtx.filter = `blur(${blur}px)`;
  }
  maskCtx.fillStyle = '#fff';
  drawRoundedRect(
    maskCtx,
    focusX + blur,
    focusY + blur,
    Math.max(1, focusW - blur * 2),
    Math.max(1, focusH - blur * 2),
    focusRadius
  );
  maskCtx.restore();

  layerCtx.globalCompositeOperation = 'destination-in';
  layerCtx.drawImage(mask, 0, 0);
  layerCtx.globalCompositeOperation = 'source-over';

  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const outputCtx = output.getContext('2d');
  if (!outputCtx) throw new Error('Canvas 不可用，无法合成图片。');
  outputCtx.drawImage(source, 0, 0);
  outputCtx.drawImage(layer, 0, 0);
  return output.toDataURL('image/png', 0.96);
};

const processImageFile = async (file: File): Promise<UploadedImage> => {
  const compressed = await compressImage(file, 2600, 0.96);
  const dataUrl = `data:${compressed.mime};base64,${compressed.base64}`;
  const img = await loadCanvasImage(dataUrl);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    preview: dataUrl,
    base64: compressed.base64,
    mime: compressed.mime,
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
};

const processTargetImageFile = async (file: File): Promise<UploadedImage> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Image file could not be read.'));
    reader.readAsDataURL(file);
  });
  const parsed = parseDataUrl(dataUrl);
  const img = await loadCanvasImage(dataUrl);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    preview: dataUrl,
    base64: parsed.base64,
    mime: parsed.mimeType,
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
};

const buildPasteBackPrompt = (notes: string, cropPreset: CropPreset, hasLineart: boolean) => `
Create one repaired local crop for model original paste-back.

Image 1 is the exact crop cut from the full-body final image. Keep Image 1's crop boundary, head angle, pose, shoulder slope, torso placement, clothing edges, local background, lighting direction, exposure, shadow side, lens perspective, and subject scale.

${hasLineart
  ? 'Image 2 is a black-and-white lineart/silhouette companion extracted from Image 1. Use it only as the structure map for exact alignment, background edge continuity, body outline, face position, shoulder line, clothing boundary, and crop geometry.'
  : 'No lineart companion is available. Treat Image 1 itself as the hard structure, alignment, background, clothing, and color blueprint.'
}

${hasLineart ? 'Images 3 and beyond' : 'Images 2 and beyond'} are high-quality model original references. Use them only to recover the same model's face, eyes, lips, nose, eyebrows, hair, skin tone, skin texture, pores, facial clarity, neck skin, and visible skin detail.

Current repair area preset: ${PRESETS[cropPreset].label}.

Output only the repaired crop. Do not output the full-body image. The generated crop must be paste-back ready and must align with ${hasLineart ? 'Image 1 and Image 2' : 'Image 1'} without position drift.

ABSOLUTE SCALE LOCK:
- Keep the same subject scale as Image 1. Do not zoom in, do not enlarge the head, face, shoulders, hands, bag, torso, or clothing.
- Keep every visible boundary from Image 1: if Image 1 shows torso/chest/hand/bag, the output crop must show the same body extent in the same positions.
- Treat Image 1 as the camera crop master. The high-quality model references only provide texture/detail, never framing, crop distance, head size, or body scale.
- If detail restoration conflicts with scale, preserve Image 1 scale and layout first.

User notes:
${notes || 'No extra notes.'}

Negative: zoomed-in crop, close-up portrait, enlarged face, enlarged head, enlarged shoulders, enlarged torso, larger subject scale, cropped-out torso, cropped-out hand, cropped-out bag, different person, face drift, changed expression character, changed head angle, changed shoulder line, changed pose, changed crop, shifted subject, moved background, changed clothing, changed garment edge, changed background, copied reference background, copied reference clothing, copied reference pose, color shift, warmer color, cooler color, changed sea color, changed wall color, red skin cast, waxy skin, plastic skin, over-smoothed skin, blurry face, low detail skin, CGI, doll face, text, watermark.
`.trim();

type PasteBackWorkspace = {
  targetImage: UploadedImage | null;
  referenceImages: UploadedImage[];
  cropPreset: CropPreset;
  cropAspectRatio: CropAspectRatio;
  cropBox: CropBox;
  committedCropBox: CropBox;
  feather: number;
  pasteScale: number;
  pasteOffsetX: number;
  pasteOffsetY: number;
  resolution: ImageResolution;
  selectedModel: string;
  notes: string;
  cropPreview: string | null;
  generatedCrop: string | null;
  resultImage: string | null;
  comparePosition: number;
};

type PasteBackTask = {
  id: string;
  createdAt: number;
  status: 'editing' | 'generating' | 'done' | 'error';
  cover?: string;
  workspace: PasteBackWorkspace;
};

const createFreshPasteBackWorkspace = (): PasteBackWorkspace => {
  const cropBox = getPresetCropBox('headShoulders');
  return {
    targetImage: null,
    referenceImages: [],
    cropPreset: 'headShoulders',
    cropAspectRatio: DEFAULT_CROP_ASPECT_RATIO,
    cropBox,
    committedCropBox: cropBox,
    feather: 18,
    pasteScale: 1,
    pasteOffsetX: 0,
    pasteOffsetY: 0,
    resolution: ImageResolution.RES_2K,
    selectedModel: 'gemini-3.1-flash-image-preview',
    notes: '',
    cropPreview: null,
    generatedCrop: null,
    resultImage: null,
    comparePosition: 50,
  };
};

const createPasteBackTask = (): PasteBackTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  status: 'editing',
  workspace: createFreshPasteBackWorkspace(),
});

type ModelOriginalPasteBackTabProps = {
  isActive?: boolean;
};

const ModelOriginalPasteBackTab: React.FC<ModelOriginalPasteBackTabProps> = ({ isActive = true }) => {
  const initialTaskRef = useRef<PasteBackTask | null>(null);
  if (!initialTaskRef.current) initialTaskRef.current = createPasteBackTask();

  const [tasks, setTasks] = useState<PasteBackTask[]>([initialTaskRef.current!]);
  const [activeTaskId, setActiveTaskId] = useState(initialTaskRef.current!.id);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [targetImage, setTargetImage] = useState<UploadedImage | null>(null);
  const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
  const [cropPreset, setCropPreset] = useState<CropPreset>('headShoulders');
  const [cropAspectRatio, setCropAspectRatio] = useState<CropAspectRatio>(DEFAULT_CROP_ASPECT_RATIO);
  const [cropBox, setCropBox] = useState<CropBox>(() => getPresetCropBox('headShoulders'));
  const [committedCropBox, setCommittedCropBox] = useState<CropBox>(() => getPresetCropBox('headShoulders'));
  const [feather, setFeather] = useState(18);
  const [pasteScale, setPasteScale] = useState(1);
  const [pasteOffsetX, setPasteOffsetX] = useState(0);
  const [pasteOffsetY, setPasteOffsetY] = useState(0);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [notes, setNotes] = useState('');
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [generatedCrop, setGeneratedCrop] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [isDraggingTarget, setIsDraggingTarget] = useState(false);
  const [isDraggingReferences, setIsDraggingReferences] = useState(false);
  const [isEditingCrop, setIsEditingCrop] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);

  const targetInputRef = useRef<HTMLInputElement>(null);
  const refsInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);
  const cropBoxRef = useRef(cropBox);
  const cropAspectRatioRef = useRef(getCropAspectRatioValue(DEFAULT_CROP_ASPECT_RATIO));
  const pendingCropBoxRef = useRef<CropBox | null>(null);
  const cropFrameRef = useRef<number | null>(null);

  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    assertCurrentGenerationTask,
    isCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const targetDataUrl = useMemo(() => targetImage ? getDataUrl(targetImage) : null, [targetImage]);
  const canGenerate = !!targetImage && referenceImages.length > 0 && !isLoading;
  const targetFrameAspectRatio = targetImage ? targetImage.width / targetImage.height : 1;
  const cropAspectRatioValue = getCropAspectRatioValue(cropAspectRatio);

  const updateCurrentTask = useCallback((patch: Partial<PasteBackTask>) => {
    setTasks(current => current.map(task => (
      task.id === activeTaskId ? { ...task, ...patch } : task
    )));
  }, [activeTaskId]);

  const getCurrentWorkspace = (): PasteBackWorkspace => ({
    targetImage,
    referenceImages,
    cropPreset,
    cropAspectRatio,
    cropBox,
    committedCropBox,
    feather,
    pasteScale,
    pasteOffsetX,
    pasteOffsetY,
    resolution,
    selectedModel,
    notes,
    cropPreview,
    generatedCrop,
    resultImage,
    comparePosition,
  });

  const restoreWorkspace = (workspace: PasteBackWorkspace) => {
    setTargetImage(workspace.targetImage);
    setReferenceImages(workspace.referenceImages);
    setCropPreset(workspace.cropPreset);
    setCropAspectRatio(workspace.cropAspectRatio);
    setCropBox(workspace.cropBox);
    setCommittedCropBox(workspace.committedCropBox);
    cropBoxRef.current = workspace.cropBox;
    cropAspectRatioRef.current = getCropAspectRatioValue(workspace.cropAspectRatio);
    setFeather(workspace.feather);
    setPasteScale(workspace.pasteScale);
    setPasteOffsetX(workspace.pasteOffsetX);
    setPasteOffsetY(workspace.pasteOffsetY);
    setResolution(workspace.resolution);
    setSelectedModel(workspace.selectedModel);
    setNotes(workspace.notes);
    setCropPreview(workspace.cropPreview);
    setGeneratedCrop(workspace.generatedCrop);
    setResultImage(workspace.resultImage);
    setComparePosition(workspace.comparePosition);
    setPreviewImage(null);
    setError(null);
    setProgressText('');
    setIsEditingCrop(false);
  };

  const switchTask = (task: PasteBackTask) => {
    if (isLoading || task.id === activeTaskId) return;
    const snapshot = getCurrentWorkspace();
    setTasks(current => current.map(item => (
      item.id === activeTaskId
        ? { ...item, workspace: snapshot, cover: resultImage || targetImage?.preview || item.cover }
        : item
    )));
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const startNewTask = () => {
    if (isLoading) return;
    const fresh = createPasteBackTask();
    const snapshot = getCurrentWorkspace();
    setTasks(current => [
      fresh,
      ...current.map(item => (
        item.id === activeTaskId
          ? { ...item, workspace: snapshot, cover: resultImage || targetImage?.preview || item.cover }
          : item
      )),
    ].slice(0, 20));
    setActiveTaskId(fresh.id);
    restoreWorkspace(fresh.workspace);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const deleteTask = (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (isLoading && taskId === activeTaskId) return;
    const remaining = tasks.filter(task => task.id !== taskId);
    if (remaining.length === 0) {
      const fresh = createPasteBackTask();
      setTasks([fresh]);
      setActiveTaskId(fresh.id);
      restoreWorkspace(fresh.workspace);
      return;
    }
    setTasks(remaining);
    if (taskId === activeTaskId) {
      setActiveTaskId(remaining[0].id);
      restoreWorkspace(remaining[0].workspace);
    }
  };

  useEffect(() => {
    cropBoxRef.current = cropBox;
  }, [cropBox]);

  useEffect(() => {
    cropAspectRatioRef.current = cropAspectRatioValue;
  }, [cropAspectRatioValue]);

  const setPreset = (preset: CropPreset) => {
    setCropPreset(preset);
    const nextCropBox = getPresetCropBox(preset, targetFrameAspectRatio, cropAspectRatioValue);
    setCropBox(nextCropBox);
    setCommittedCropBox(nextCropBox);
  };

  const selectCropAspectRatio = (nextRatio: CropAspectRatio) => {
    if (nextRatio === cropAspectRatio) return;
    const nextAspectRatioValue = getCropAspectRatioValue(nextRatio);
    const nextCropBox = fitCropBoxToAspectRatio(
      committedCropBox,
      targetFrameAspectRatio,
      nextAspectRatioValue
    );
    cropAspectRatioRef.current = nextAspectRatioValue;
    setCropAspectRatio(nextRatio);
    setCropBox(nextCropBox);
    setCommittedCropBox(nextCropBox);
    setGeneratedCrop(null);
    setResultImage(null);
    setPreviewImage(null);
  };

  const handleTargetUpload = useCallback(async (files: File[] | FileList) => {
    const file = Array.from(files).find(item => item.type.startsWith('image/'));
    if (!file) return;
    try {
      const image = await processTargetImageFile(file);
      setTargetImage(image);
      setResultImage(null);
      setGeneratedCrop(null);
      setPreviewImage(null);
      const nextCropBox = getPresetCropBox(cropPreset, image.width / image.height, cropAspectRatioValue);
      setCropBox(nextCropBox);
      setCommittedCropBox(nextCropBox);
      setError(null);
      updateCurrentTask({ cover: image.preview, status: 'editing' });
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    }
  }, [cropPreset, cropAspectRatioValue, updateCurrentTask]);

  const handleReferenceUpload = useCallback(async (files: File[] | FileList) => {
    const imageFiles = Array.from(files).filter(item => item.type.startsWith('image/')).slice(0, 3);
    if (imageFiles.length === 0) return;
    try {
      const images = await Promise.all(imageFiles.map(processImageFile));
      setReferenceImages(prev => [...prev, ...images].slice(0, 3));
      setError(null);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    }
  }, []);

  const handleUploadDragOver = (event: React.DragEvent, type: 'target' | 'references') => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    if (type === 'target') {
      setIsDraggingTarget(true);
    } else {
      setIsDraggingReferences(true);
    }
  };

  const handleUploadDragLeave = (event: React.DragEvent, type: 'target' | 'references') => {
    event.preventDefault();
    event.stopPropagation();
    const currentTarget = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && currentTarget.contains(nextTarget)) return;
    if (type === 'target') {
      setIsDraggingTarget(false);
    } else {
      setIsDraggingReferences(false);
    }
  };

  const handleUploadDrop = async (event: React.DragEvent, type: 'target' | 'references') => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingTarget(false);
    setIsDraggingReferences(false);
    const transferFiles = Array.from(event.dataTransfer.files || []);
    const itemFiles = Array.from(event.dataTransfer.items || [])
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => !!file);
    const seenFiles = new Set<string>();
    const files = [...transferFiles, ...itemFiles].filter(file => {
      if (!file.type.startsWith('image/')) return false;
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (seenFiles.has(key)) return false;
      seenFiles.add(key);
      return true;
    });
    if (files.length === 0) return;
    if (type === 'target') {
      await handleTargetUpload(files);
    } else {
      await handleReferenceUpload(files);
    }
  };

  useImagePaste((files) => {
    if (!targetImage) {
      handleTargetUpload(files);
    } else {
      handleReferenceUpload(files);
    }
  }, isActive);

  useEffect(() => {
    let cancelled = false;
    if (!targetDataUrl) {
      setCropPreview(null);
      return;
    }
    if (isEditingCrop) return;

    cropImageDataUrl(targetDataUrl, committedCropBox)
      .then(crop => {
        if (!cancelled) setCropPreview(crop.dataUrl);
      })
      .catch(() => {
        if (!cancelled) setCropPreview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [targetDataUrl, committedCropBox, isEditingCrop]);

  const scheduleCropBoxUpdate = (next: CropBox) => {
    pendingCropBoxRef.current = next;
    if (cropFrameRef.current !== null) return;
    cropFrameRef.current = requestAnimationFrame(() => {
      cropFrameRef.current = null;
      if (!pendingCropBoxRef.current) return;
      cropBoxRef.current = pendingCropBoxRef.current;
      setCropBox(pendingCropBoxRef.current);
      pendingCropBoxRef.current = null;
    });
  };

  const flushCropBoxUpdate = () => {
    if (cropFrameRef.current !== null) {
      cancelAnimationFrame(cropFrameRef.current);
      cropFrameRef.current = null;
    }
    if (pendingCropBoxRef.current) {
      cropBoxRef.current = pendingCropBoxRef.current;
      setCropBox(pendingCropBoxRef.current);
      setCommittedCropBox(pendingCropBoxRef.current);
      pendingCropBoxRef.current = null;
    }
  };

  const updateCropFromPointer = (event: PointerEvent | React.PointerEvent) => {
    const drag = dragRef.current;
    const rect = editorRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    event.preventDefault();

    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    const start = drag.startBox;
    let next = { ...start };

    if (drag.mode === 'move') {
      next.x = clamp(start.x + dx, 0, 1 - start.w);
      next.y = clamp(start.y + dy, 0, 1 - start.h);
    } else {
      next = resizeCropBoxFromCorner(
        start,
        drag.mode,
        dx,
        dy,
        rect.width / rect.height,
        cropAspectRatioRef.current
      );
    }

    scheduleCropBoxUpdate(next);
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => updateCropFromPointer(event);
    const handleUp = () => {
      flushCropBoxUpdate();
      setCommittedCropBox(cropBoxRef.current);
      dragRef.current = null;
      setIsEditingCrop(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (cropFrameRef.current !== null) {
        cancelAnimationFrame(cropFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!targetDataUrl || !generatedCrop || isLoading) return;

    upscaleDataUrlToResolution(targetDataUrl, resolution)
      .then((outputTargetDataUrl) => pasteCropBack(outputTargetDataUrl, generatedCrop, committedCropBox, feather, cropPreset, {
        scale: pasteScale,
        offsetX: pasteOffsetX,
        offsetY: pasteOffsetY,
      }))
      .then((pasted) => convertImageDataUrlFormat(pasted, 'png'))
      .then((finalPng) => {
        if (!cancelled) setResultImage(finalPng);
      })
      .catch((composeError) => {
        console.warn('Paste-back recomposition failed.', composeError);
      });

    return () => {
      cancelled = true;
    };
  }, [targetDataUrl, generatedCrop, committedCropBox, feather, cropPreset, pasteScale, pasteOffsetX, pasteOffsetY, resolution, isLoading]);

  const startCropDrag = (event: React.PointerEvent, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditingCrop(true);
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startBox: cropBox,
    };
  };

  const handleGenerate = async () => {
    if (!targetImage || !targetDataUrl || referenceImages.length === 0) {
      setError('请先上传全身结果图和高清模特原图。');
      return;
    }

    const { taskId, signal } = startGenerationTask();
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    setGeneratedCrop(null);
    setProgressText('正在按所选清晰度准备贴回底图...');
    updateCurrentTask({
      status: 'generating',
      cover: targetImage.preview,
      workspace: {
        ...getCurrentWorkspace(),
        generatedCrop: null,
        resultImage: null,
      },
    });

    try {
      const activeCropBox = committedCropBox;
      assertCurrentGenerationTask(taskId, signal);
      const outputTargetDataUrl = await upscaleDataUrlToResolution(targetDataUrl, resolution);
      setProgressText('正在裁切需要贴回的局部区域...');
      const crop = await cropImageDataUrl(outputTargetDataUrl, activeCropBox);
      setCropPreview(crop.dataUrl);
      setProgressText('正在用高清模特原图重绘局部细节...');

      const cropApi = parseDataUrl(crop.dataUrl);
      let lineartApi: { base64: string; mimeType: string } | null = null;
      try {
        const lineart = await extractEdges(crop.dataUrl);
        lineartApi = parseDataUrl(lineart);
      } catch (lineartError) {
        console.warn('Crop lineart extraction failed. Continuing with original crop only.', lineartError);
      }
      const references = referenceImages.map(image => ({
        base64: image.base64,
        mimeType: image.mime,
      }));
      const prompt = buildPasteBackPrompt(notes, cropPreset, !!lineartApi);
      const aspectRatio = getClosestAspectRatio(crop.aspectRatio);

      const generated = await generateImageToImage(
        [
          { base64: cropApi.base64, mimeType: cropApi.mimeType },
          ...(lineartApi ? [lineartApi] : []),
          ...references,
        ],
        prompt,
        {
          aspectRatio,
          resolution,
          modelId: selectedModel,
          workflowHint: 'model-original-paste-back',
          negativePrompt: 'full body output, whole image output, changed crop, shifted subject, shifted background, changed background, changed clothing, changed garment color, changed water color, changed wall color, changed floor color, color shift, face blur, waxy skin',
          signal,
        }
      );

      assertCurrentGenerationTask(taskId, signal);
      const rawCrop = generated[0];
      if (!rawCrop) {
        throw new Error('模型没有返回局部修复图，请重试。');
      }

      const colorLockedCrop = await applyColorCorrection(rawCrop, {
        mode: 'match',
        reference: crop.dataUrl,
        blend: 0.9,
      }).catch((colorError) => {
        console.warn('Paste-back crop color correction failed. Using raw crop.', colorError);
        return rawCrop;
      });
      const sourceColorLockedCrop = await syncRepairCropColorToSource(colorLockedCrop, crop.dataUrl).catch((colorError) => {
        console.warn('Paste-back source color sync failed. Using color-matched crop.', colorError);
        return colorLockedCrop;
      });
      const saturationLockedCrop = await applyColorCorrection(sourceColorLockedCrop, {
        mode: 'redSuppress',
        blend: 1,
        redAdjust: 0,
        cyanBoost: 0,
        saturation: 0.9,
        contrast: 1.01,
      }).catch((colorError) => {
        console.warn('Paste-back crop saturation correction failed. Using source color synced crop.', colorError);
        return sourceColorLockedCrop;
      });
      const colorLockedPng = await convertImageDataUrlFormat(saturationLockedCrop, 'png');
      const pngCrop = await composeRepairCropWithSource(crop.dataUrl, colorLockedPng, cropPreset, feather);
      setGeneratedCrop(pngCrop);
      setProgressText('正在把高清局部柔边贴回原图...');
      const pasted = await pasteCropBack(outputTargetDataUrl, pngCrop, activeCropBox, feather, cropPreset, {
        scale: pasteScale,
        offsetX: pasteOffsetX,
        offsetY: pasteOffsetY,
      });
      const finalPng = await convertImageDataUrlFormat(pasted, 'png');

      assertCurrentGenerationTask(taskId, signal);
      setResultImage(finalPng);
      setProgressText('完成');
      updateCurrentTask({
        status: 'done',
        cover: finalPng,
        workspace: {
          ...getCurrentWorkspace(),
          cropPreview: crop.dataUrl,
          generatedCrop: pngCrop,
          resultImage: finalPng,
        },
      });

      await saveGeneratedProject({
        type: 'MODEL',
        generated: [finalPng],
        original: [targetDataUrl, ...referenceImages.map(getDataUrl)],
        prompt,
        params: {
          subType: 'model_original_paste_back',
          cropPreset,
          cropAspectRatio,
          cropBox: activeCropBox,
          feather,
          pasteScale,
          pasteOffsetX,
          pasteOffsetY,
          resolution,
          model: selectedModel,
        },
        thumbnail: finalPng,
      });
    } catch (generateError) {
      if (!isAbortError(generateError)) {
        setError(getErrorMessage(generateError));
        updateCurrentTask({ status: 'error' });
      } else {
        updateCurrentTask({ status: 'editing' });
      }
    } finally {
      if (isCurrentGenerationTask(taskId)) {
        finishGenerationTask(taskId);
        setIsLoading(false);
      }
    }
  };

  const handleCancel = () => {
    cancelGenerationTask();
    setIsLoading(false);
    setProgressText('');
    updateCurrentTask({ status: 'editing' });
  };

  const handleDownload = async () => {
    if (!resultImage) return;
    await downloadImageFile(resultImage, `model-original-paste-back-${Date.now()}.png`);
  };

  const handleDownloadPreview = async () => {
    if (!previewImage) return;
    await downloadImageFile(previewImage, previewImage === generatedCrop
      ? `model-original-paste-back-crop-${Date.now()}.png`
      : `model-original-paste-back-${Date.now()}.png`);
  };

  const updateComparePosition = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = ((event.clientX - rect.left) / rect.width) * 100;
    setComparePosition(clamp(next, 0, 100));
  };

  const activeWorkflowStep = resultImage || isLoading
    ? 5
    : targetImage && referenceImages.length > 0
      ? 3
      : targetImage
        ? 2
        : 1;
  const workflowSteps = ['全身结果图', '高清参考', '区域与比例', '核心参数', '生成结果'];

  return (
    <div className="h-full overflow-y-auto bg-[#f3f6f9] text-pastel-text dark:bg-[#080a0d]">
      <div className="mx-auto w-full max-w-[105rem] px-3 py-5 sm:px-5 lg:px-7">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-black tracking-[0.08em] text-[#687b94]">
            <Sparkles className="h-4 w-4 text-[#ed6d46]" />
            <span>AI 模特细节修复工作坊</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#15223a] sm:text-3xl dark:text-white">模特原图贴回</h2>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-pastel-muted">
            用全身结果图锁定姿势、服装和背景，只重绘头肩/半身局部，再按原坐标柔边贴回，减少全身图人脸和皮肤细节丢失。
          </p>
          <div className="mx-auto mt-5 flex max-w-4xl items-center justify-center overflow-x-auto pb-1">
            {workflowSteps.map((step, index) => {
              const stepNumber = index + 1;
              const active = stepNumber === activeWorkflowStep;
              const complete = stepNumber < activeWorkflowStep;
              return (
                <React.Fragment key={step}>
                  {index > 0 && <span className={`mx-2 h-px min-w-5 flex-1 ${complete || active ? 'bg-[#f2a185]' : 'bg-[#dce4ed]'}`} />}
                  <span className={`flex min-w-max items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition-colors ${active
                    ? 'border-[#15223a] bg-[#15223a] text-white shadow-sm'
                    : complete
                      ? 'border-[#f2b49e] bg-[#fff5ef] text-[#d85a35]'
                      : 'border-[#dde5ee] bg-white text-[#75869c]'
                  }`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.68rem] ${active ? 'bg-white text-[#15223a]' : complete ? 'bg-[#ed6d46] text-white' : 'bg-[#edf2f7] text-[#61738a]'}`}>{stepNumber}</span>
                    {step}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {!historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-sm font-black text-pastel-text shadow-[0_8px_24px_rgba(30,50,80,0.16)] md:left-[16.25rem] lg:left-[17rem] dark:border-white/10 dark:bg-[#11151c]"
          >
            <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />
            生成记录
            <span className="rounded-full bg-pastel-bg px-2 py-0.5 text-xs text-pastel-muted dark:bg-white/10">{tasks.length}</span>
          </button>
        )}
        {historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            aria-label="关闭生成记录"
            className="fixed inset-0 z-[59] bg-[#10203a]/35 xl:hidden"
          />
        )}

        <div className={`grid grid-cols-1 gap-5 ${historyOpen ? 'xl:grid-cols-[16rem_28rem_minmax(0,1fr)]' : 'xl:grid-cols-[28rem_minmax(0,1fr)]'}`}>
          {historyOpen && (
            <aside className="no-scrollbar fixed inset-y-3 left-3 z-[60] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.25rem] border border-[#d9e2ec] bg-white p-3.5 shadow-xl xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:shadow-[0_8px_28px_rgba(30,50,80,0.045)] dark:border-white/10 dark:bg-[#11151c]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-pastel-text">生成记录</h2>
                  <p className="mt-0.5 text-xs text-pastel-muted">最多保留 20 个贴回任务</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted transition hover:bg-pastel-bg"
                  aria-label="收起生成记录"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={startNewTask}
                disabled={isLoading}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#15223a] text-sm font-black text-white shadow-sm transition hover:bg-[#24334d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                新开任务
              </button>

              <div className="no-scrollbar mt-3.5 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {tasks.map(task => {
                  const selected = task.id === activeTaskId;
                  const statusLabel = task.status === 'generating'
                    ? '生成中...'
                    : task.status === 'done'
                      ? '已完成'
                      : task.status === 'error'
                        ? '生成失败'
                        : '准备中';
                  return (
                    <div key={task.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => switchTask(task)}
                        className={`w-full overflow-hidden rounded-xl border text-left transition-all ${selected
                          ? 'border-[#ed6d46] bg-[#fff8f3] ring-2 ring-[#ed6d46]/15'
                          : 'border-pastel-border bg-pastel-bg/35 hover:border-[#efb49d]'
                        }`}
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#e9eef4]">
                          {task.cover ? (
                            <img src={task.cover} alt="贴回任务缩略图" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[#aab7c7]">
                              <ImageIcon className="h-8 w-8 opacity-60" />
                            </div>
                          )}
                          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                            {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-black text-[#d85a35] backdrop-blur-sm">
                            {task.workspace.cropAspectRatio}
                          </span>
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-xs font-black text-pastel-text">
                            {PRESETS[task.workspace.cropPreset].label}贴回任务
                          </p>
                          <p className={`mt-1 text-[10px] font-bold ${task.status === 'error' ? 'text-red-500' : task.status === 'generating' ? 'text-[#ed6d46]' : 'text-pastel-muted'}`}>
                            {statusLabel}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={event => deleteTask(task.id, event)}
                        disabled={isLoading && selected}
                        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="删除此任务"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          <div className="space-y-4">
            <section
              className={`rounded-[1.25rem] border bg-white p-5 shadow-[0_8px_28px_rgba(30,50,80,0.045)] transition-colors dark:bg-[#11151c] ${isDraggingTarget ? 'border-pastel-highlight ring-2 ring-orange-100' : 'border-[#d9e2ec] dark:border-white/10'}`}
              onDragOver={(event) => handleUploadDragOver(event, 'target')}
              onDragLeave={(event) => handleUploadDragLeave(event, 'target')}
              onDrop={(event) => handleUploadDrop(event, 'target')}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black text-pastel-text">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15223a] text-xs font-black text-white">1</span>
                    全身结果图
                  </h3>
                  <p className="mt-1 text-xs text-pastel-muted">上传姿势、构图、服装已经正确但脸部细节不足的成品图。</p>
                </div>
                {targetImage && (
                  <button
                    onClick={() => setTargetImage(null)}
                    className="rounded-full p-1.5 text-pastel-muted hover:bg-pastel-bg hover:text-pastel-highlight"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {targetImage ? (
                <button
                  type="button"
                  onClick={() => targetInputRef.current?.click()}
                  className={`group relative block w-full overflow-hidden rounded-xl border transition-colors ${isDraggingTarget ? 'border-pastel-highlight bg-orange-50' : 'border-pastel-border'}`}
                >
                  <img src={targetImage.preview} alt="Target full body" className="h-56 w-full object-contain bg-pastel-bg" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    点击更换全身图
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => targetInputRef.current?.click()}
                  className={`flex h-56 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${isDraggingTarget ? 'border-pastel-highlight bg-orange-50/70' : 'border-pastel-border bg-pastel-bg/30 hover:border-pastel-highlight hover:bg-orange-50/40'}`}
                >
                  <Upload className="mb-3 h-8 w-8 text-pastel-muted" />
                  <span className="text-sm font-medium text-pastel-text">上传全身结果图</span>
                  <span className="mt-1 text-xs text-pastel-muted">也可以直接粘贴图片</span>
                </button>
              )}
              <input
                ref={targetInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => event.target.files && handleTargetUpload(event.target.files)}
              />
            </section>

            <section
              className={`rounded-[1.25rem] border bg-white p-5 shadow-[0_8px_28px_rgba(30,50,80,0.045)] transition-colors dark:bg-[#11151c] ${isDraggingReferences ? 'border-pastel-highlight ring-2 ring-orange-100' : 'border-[#d9e2ec] dark:border-white/10'}`}
              onDragOver={(event) => handleUploadDragOver(event, 'references')}
              onDragLeave={(event) => handleUploadDragLeave(event, 'references')}
              onDrop={(event) => handleUploadDrop(event, 'references')}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black text-pastel-text">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15223a] text-xs font-black text-white">2</span>
                    模特原图 / 高清半身参考
                  </h3>
                  <p className="mt-1 text-xs text-pastel-muted">用于恢复五官、肤质、发丝和身份细节，最多 3 张。</p>
                </div>
                <button
                  type="button"
                  onClick={() => refsInputRef.current?.click()}
                  className="rounded-lg border border-pastel-border px-3 py-1.5 text-xs font-bold text-pastel-highlight hover:bg-pastel-bg"
                >
                  添加
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {referenceImages.map((image) => (
                  <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg">
                    <img src={image.preview} alt="Model reference" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setReferenceImages(prev => prev.filter(item => item.id !== image.id))}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {referenceImages.length < 3 && (
                  <button
                    type="button"
                    onClick={() => refsInputRef.current?.click()}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed text-xs text-pastel-muted transition-colors ${isDraggingReferences ? 'border-pastel-highlight bg-orange-50/70' : 'border-pastel-border hover:border-pastel-highlight hover:bg-orange-50/40'}`}
                  >
                    <Upload className="mb-1.5 h-5 w-5" />
                    上传
                  </button>
                )}
              </div>
              <input
                ref={refsInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => event.target.files && handleReferenceUpload(event.target.files)}
              />
            </section>

            <section className="rounded-[1.25rem] border border-[#d9e2ec] bg-white p-5 shadow-[0_8px_28px_rgba(30,50,80,0.045)] dark:border-white/10 dark:bg-[#11151c]">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-pastel-text">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15223a] text-xs font-black text-white">3</span>
                贴回区域与比例
              </h3>
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-pastel-muted">局部重绘比例</span>
                  <span className="text-[10px] text-pastel-muted">完整图尺寸保持不变</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CROP_ASPECT_RATIO_OPTIONS.map(option => {
                    const selected = cropAspectRatio === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectCropAspectRatio(option.id)}
                        disabled={isLoading}
                        className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${selected
                          ? 'border-[#ed6d46] bg-[#fff5ef] shadow-[0_5px_14px_rgba(237,109,70,0.1)] ring-1 ring-[#ed6d46]/15'
                          : 'border-pastel-border bg-pastel-bg/30 hover:border-[#efb49d] hover:bg-[#fffaf7]'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                        aria-pressed={selected}
                      >
                        <span
                          className={`block h-8 rounded-[0.2rem] border-2 ${selected ? 'border-[#ed6d46] bg-white' : 'border-[#aebdce] bg-white'}`}
                          style={{ aspectRatio: option.value }}
                        />
                        <span>
                          <strong className="block text-xs font-black text-pastel-text">{option.label}</strong>
                          <small className="mt-0.5 block text-[10px] text-pastel-muted">{option.desc}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="mb-2 text-xs font-bold text-pastel-muted">修复范围</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PRESETS) as CropPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPreset(preset)}
                    className={`rounded-xl border p-2 text-left transition-all ${cropPreset === preset
                      ? 'border-pastel-highlight bg-orange-50 text-pastel-text ring-2 ring-orange-100'
                      : 'border-pastel-border bg-pastel-bg/40 text-pastel-muted hover:border-pastel-highlight/50'
                    }`}
                  >
                    <div className="text-xs font-bold">{PRESETS[preset].label}</div>
                    <div className="mt-0.5 text-[10px]">{PRESETS[preset].desc}</div>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-2 flex items-center justify-between text-xs font-bold text-pastel-muted">
                  柔边贴回
                  <span>{feather}px</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={48}
                  value={feather}
                  onChange={(event) => setFeather(Number(event.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              <div className="mt-4 rounded-xl border border-pastel-border bg-pastel-bg/30 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-pastel-text">贴回校准</p>
                    <p className="mt-0.5 text-[10px] text-pastel-muted">局部偏大或偏移时，直接微调合成位置。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPasteScale(1);
                      setPasteOffsetX(0);
                      setPasteOffsetY(0);
                    }}
                    className="rounded-lg border border-pastel-border bg-white px-2 py-1 text-[10px] font-bold text-pastel-muted hover:bg-pastel-bg"
                  >
                    复位
                  </button>
                </div>
                <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-pastel-muted">
                  缩放
                  <span>{Math.round(pasteScale * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0.72}
                  max={1.08}
                  step={0.01}
                  value={pasteScale}
                  onChange={(event) => setPasteScale(Number(event.target.value))}
                  className="mb-3 w-full accent-orange-500"
                />
                <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-pastel-muted">
                  左右偏移
                  <span>{Math.round(pasteOffsetX * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={-0.15}
                  max={0.15}
                  step={0.005}
                  value={pasteOffsetX}
                  onChange={(event) => setPasteOffsetX(Number(event.target.value))}
                  className="mb-3 w-full accent-orange-500"
                />
                <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-pastel-muted">
                  上下偏移
                  <span>{Math.round(pasteOffsetY * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={-0.15}
                  max={0.15}
                  step={0.005}
                  value={pasteOffsetY}
                  onChange={(event) => setPasteOffsetY(Number(event.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-[#d9e2ec] bg-white p-5 shadow-[0_8px_28px_rgba(30,50,80,0.045)] dark:border-white/10 dark:bg-[#11151c]">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-pastel-text">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15223a] text-xs font-black text-white">4</span>
                核心生成参数
              </h3>
              <CreativeImageModelSelector value={selectedModel} onChange={setSelectedModel} disabled={isGenerating} title="" compact className="mb-4 border-0 bg-transparent p-0 shadow-none" />
              <div className="hidden">
                {MODEL_OPTIONS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModel(model.id)}
                    className={`rounded-xl border p-2 text-center transition-all ${selectedModel === model.id
                      ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                      : 'border-pastel-border bg-pastel-bg/40 hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-pastel-text">
                      {model.icon}
                      {model.label}
                    </div>
                    <div className="mt-0.5 text-[9px] text-pastel-muted">{model.desc}</div>
                  </button>
                ))}
              </div>

              <label className="mb-2 block text-xs font-bold text-pastel-muted">清晰度</label>
              <select
                value={resolution}
                onChange={(event) => setResolution(event.target.value as ImageResolution)}
                className="mb-4 w-full rounded-xl border border-pastel-border bg-pastel-bg/40 px-3 py-2.5 text-sm focus:border-pastel-highlight focus:outline-none focus:ring-2 focus:ring-pastel-highlight/20"
              >
                <option value={ImageResolution.RES_1K}>1K</option>
                <option value={ImageResolution.RES_2K}>2K</option>
                <option value={ImageResolution.RES_4K}>4K</option>
              </select>

              <label className="mb-2 block text-xs font-bold text-pastel-muted">补充要求</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="例如：保留微笑，不要改变刘海，肤色自然一点..."
                className="h-24 w-full resize-none rounded-xl border border-pastel-border bg-pastel-bg/30 px-3 py-2 text-sm focus:border-pastel-highlight focus:outline-none focus:ring-2 focus:ring-pastel-highlight/20"
              />
            </section>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="whitespace-pre-line">{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`flex min-h-13 w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white shadow-[0_10px_25px_rgba(21,34,58,0.18)] transition-all ${canGenerate
                ? 'bg-[#15223a] hover:-translate-y-0.5 hover:bg-[#24334d] active:translate-y-0'
                : 'cursor-not-allowed bg-[#b8c2cf] shadow-none'
              }`}
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              开始贴回修复
            </button>
            {isLoading && (
              <button
                type="button"
                onClick={handleCancel}
                className="w-full rounded-xl bg-gray-800 py-3 text-sm font-bold text-white hover:bg-gray-900"
              >
                中止生成
              </button>
            )}
            {cancelMessage && !isLoading && (
              <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>
            )}
          </div>

          <div className="space-y-5">
            <section className="rounded-[1.25rem] border border-[#d9e2ec] bg-white p-5 shadow-[0_8px_28px_rgba(30,50,80,0.045)] dark:border-white/10 dark:bg-[#11151c]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black text-pastel-text">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15223a] text-xs font-black text-white">3</span>
                    裁切框编辑
                    <span className="rounded-md bg-[#fff1e8] px-2 py-1 text-[10px] font-black text-[#d85a35]">{cropAspectRatio}</span>
                  </h3>
                  <p className="mt-1 text-xs text-pastel-muted">拖动框体移动，拖四角缩放。生成时只会重绘框内局部。</p>
                </div>
                {targetImage && (
                  <button
                    type="button"
                    onClick={() => setPreset(cropPreset)}
                    className="rounded-lg border border-pastel-border px-3 py-1.5 text-xs font-bold text-pastel-muted hover:bg-pastel-bg"
                  >
                    重置区域
                  </button>
                )}
              </div>

              {targetImage ? (
                <div className="flex justify-center rounded-2xl bg-pastel-bg/50 p-4">
                  <div ref={editorRef} className="relative inline-block max-h-[620px] max-w-full select-none overflow-hidden rounded-xl border border-pastel-border bg-white">
                    <img src={targetImage.preview} alt="Crop editor" className="block max-h-[620px] max-w-full" draggable={false} />
                    <div className="absolute inset-0 bg-black/30" />
                    <div
                      className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
                      style={{
                        left: `${cropBox.x * 100}%`,
                        top: `${cropBox.y * 100}%`,
                        width: `${cropBox.w * 100}%`,
                        height: `${cropBox.h * 100}%`,
                        willChange: 'left, top, width, height',
                      }}
                      onPointerDown={(event) => startCropDrag(event, 'move')}
                    >
                      <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
                        {PRESETS[cropPreset].label} · {cropAspectRatio}
                      </div>
                      {(['nw', 'ne', 'sw', 'se'] as DragMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onPointerDown={(event) => startCropDrag(event, mode)}
                          className={`absolute h-4 w-4 rounded-full border-2 border-white bg-pastel-highlight shadow-md ${mode === 'nw' ? '-left-2 -top-2 cursor-nwse-resize' : ''
                            } ${mode === 'ne' ? '-right-2 -top-2 cursor-nesw-resize' : ''
                            } ${mode === 'sw' ? '-bottom-2 -left-2 cursor-nesw-resize' : ''
                            } ${mode === 'se' ? '-bottom-2 -right-2 cursor-nwse-resize' : ''
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[520px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg/30 text-center">
                  <Crop className="mb-3 h-10 w-10 text-pastel-muted/60" />
                  <p className="text-sm text-pastel-muted">上传全身结果图后在这里调整贴回区域</p>
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section className="rounded-[1.25rem] border border-[#d9e2ec] bg-white p-5 shadow-[0_8px_28px_rgba(30,50,80,0.045)] dark:border-white/10 dark:bg-[#11151c]">
                <h3 className="mb-3 text-sm font-bold text-pastel-text">局部裁切预览</h3>
                {cropPreview ? (
                  <img src={cropPreview} alt="Crop preview" className="max-h-80 w-full rounded-xl border border-pastel-border object-contain bg-pastel-bg" />
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-pastel-border text-sm text-pastel-muted">
                    暂无裁切预览
                  </div>
                )}
              </section>

              <section className="rounded-[1.25rem] border border-[#d9e2ec] bg-white p-5 shadow-[0_8px_28px_rgba(30,50,80,0.045)] dark:border-white/10 dark:bg-[#11151c]">
                <h3 className="mb-3 text-sm font-bold text-pastel-text">重绘局部预览</h3>
                {generatedCrop ? (
                  <div className="group relative">
                    <img
                      src={generatedCrop}
                      alt="Generated crop"
                      className="max-h-80 w-full cursor-zoom-in rounded-xl border border-pastel-border object-contain bg-pastel-bg"
                      onClick={() => setPreviewImage(generatedCrop)}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewImage(generatedCrop)}
                      className="absolute bottom-3 right-3 rounded-lg bg-black/60 p-2 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                      title="放大查看"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-pastel-border text-sm text-pastel-muted">
                    生成后显示高清局部
                  </div>
                )}
              </section>
            </div>

            <section className="min-h-[520px] overflow-hidden rounded-[1.25rem] border border-[#d9e2ec] bg-white shadow-[0_8px_28px_rgba(30,50,80,0.045)] dark:border-white/10 dark:bg-[#11151c]">
              <div className="flex items-center justify-between border-b border-pastel-border bg-pastel-bg/50 px-5 py-3">
                <h3 className="flex items-center gap-2 text-sm font-black text-pastel-text">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15223a] text-xs font-black text-white">5</span>
                  最终贴回结果
                </h3>
                {resultImage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="rounded-lg bg-pastel-highlight px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600"
                    >
                      下载 PNG
                    </button>
                    <button
                      type="button"
                      onClick={startNewTask}
                      className="rounded-lg border border-pastel-border px-3 py-1.5 text-xs font-bold text-pastel-muted hover:bg-pastel-bg"
                    >
                      新开任务
                    </button>
                  </div>
                )}
              </div>

              <div className="flex min-h-[470px] items-center justify-center p-5">
                {isLoading ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-50">
                      <Loader2 className="h-10 w-10 animate-spin text-pastel-highlight" />
                    </div>
                    <p className="text-sm font-bold text-pastel-text">{progressText || '正在生成...'}</p>
                    <p className="mt-1 text-xs text-pastel-muted">局部重绘完成后会自动贴回原图位置</p>
                  </div>
                ) : resultImage && targetDataUrl ? (
                  <div className="group relative flex w-full flex-col items-center">
                    <div
                      className="relative mx-auto inline-block max-w-full touch-none select-none overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg shadow-sm"
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        updateComparePosition(event);
                      }}
                      onPointerMove={(event) => {
                        if (event.buttons === 1) updateComparePosition(event);
                      }}
                    >
                      <img
                        src={targetDataUrl}
                        alt="Before paste back"
                        className="block max-h-[720px] max-w-full"
                        draggable={false}
                      />
                      <div
                        className="absolute inset-0"
                        style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                      >
                        <img
                          src={resultImage}
                          alt="After paste back"
                          className="absolute inset-0 h-full w-full object-contain"
                          draggable={false}
                        />
                      </div>
                      <div
                        className="absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
                        style={{ left: `${comparePosition}%` }}
                      >
                        <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-black/65 text-white shadow-lg">
                          <span className="text-xs font-black">↔</span>
                        </div>
                      </div>
                      <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
                        贴回后
                      </div>
                      <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
                        贴回前
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={comparePosition}
                        onChange={(event) => setComparePosition(Number(event.target.value))}
                        className="absolute inset-x-4 bottom-4 z-20 h-2 cursor-ew-resize accent-orange-500 opacity-0"
                        aria-label="贴回前后对比滑杆"
                      />
                      <div className="absolute bottom-4 right-4 z-30 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewImage(resultImage);
                          }}
                          className="rounded-lg bg-black/60 p-2 text-white hover:bg-black/80"
                          title="放大"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDownload();
                          }}
                          className="rounded-lg bg-black/60 p-2 text-white hover:bg-black/80"
                          title="下载"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-3 text-xs text-pastel-muted">
                      <span>左侧：贴回后</span>
                      <span className="h-1 w-1 rounded-full bg-pastel-muted/40" />
                      <span>右侧：贴回前</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-pink-50">
                      <UserCircle2 className="h-10 w-10 text-pastel-highlight/60" />
                    </div>
                    <p className="text-sm text-pastel-muted">贴回后的完整 PNG 会显示在这里</p>
                    <p className="mt-1 text-xs text-pastel-muted/70">按所选清晰度输出完整 PNG</p>
                  </div>
                )}
              </div>
            </section>

            {resultImage && (
              <button
                type="button"
                onClick={startNewTask}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-pastel-border bg-white py-3 text-sm font-bold text-pastel-muted hover:bg-pastel-bg"
              >
                <RefreshCw className="h-4 w-4" />
                重新开始
              </button>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="max-h-[86vh] max-w-full rounded-xl shadow-2xl" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleDownloadPreview}
              className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-white/90 px-4 py-2 text-sm font-bold text-gray-800 hover:bg-white"
            >
              <Download className="h-4 w-4" />
              下载 PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelOriginalPasteBackTab;
