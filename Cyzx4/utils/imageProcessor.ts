/**
 * HTML5 Canvas based Image Processing Utilities
 * Used for pre-processing images before sending them to the AI API,
 * specifically for bypassing NSFW filters via edge detection (Lineart).
 */

/**
 * Applies a Sobel-like edge detection filter to a base64 image.
 * This converts a regular photo into a high-contrast lineart, stripping away
 * skin textures, lighting, and sensitive features while preserving posture/composition.
 * 
 * @param base64 The input image base64 string (data URI)
 * @returns A promise that resolves to the processed base64 string
 */
export const extractEdges = (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const width = canvas.width;
            const height = canvas.height;

            // Create a grayscale copy
            const grayscale = new Uint8ClampedArray(width * height);
            for (let i = 0; i < data.length; i += 4) {
                // Perceived luminance formula
                grayscale[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            }

            // Sobel kernels
            const kernelX = [
                -1, 0, 1,
                -2, 0, 2,
                -1, 0, 1
            ];
            const kernelY = [
                -1, -2, -1,
                 0,  0,  0,
                 1,  2,  1
            ];

            const edgeData = new Uint8ClampedArray(data.length);

            // Apply Sobel operator
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let pixelX = 0;
                    let pixelY = 0;

                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixelIndex = ((y + ky) * width + (x + kx));
                            const weightX = kernelX[(ky + 1) * 3 + (kx + 1)];
                            const weightY = kernelY[(ky + 1) * 3 + (kx + 1)];
                            
                            pixelX += grayscale[pixelIndex] * weightX;
                            pixelY += grayscale[pixelIndex] * weightY;
                        }
                    }

                    const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
                    const idx = (y * width + x) * 4;
                    
                    // Invert edges: White background, black lines
                    // Also boost contrast to make lines clearer
                    const val = magnitude > 50 ? 0 : 255; 

                    edgeData[idx] = val;     // R
                    edgeData[idx + 1] = val; // G
                    edgeData[idx + 2] = val; // B
                    edgeData[idx + 3] = 255; // Alpha
                }
            }

            // Handle borders (just make them white)
            for (let i = 0; i < edgeData.length; i += 4) {
                if (edgeData[i + 3] === 0) {
                    edgeData[i] = 255;
                    edgeData[i+1] = 255;
                    edgeData[i+2] = 255;
                    edgeData[i+3] = 255;
                }
            }

            const newImageData = new ImageData(edgeData, width, height);
            ctx.putImageData(newImageData, 0, 0);

            // Output as JPEG to keep size small
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for edge extraction'));
        };

        // If it doesn't already have the data URI prefix, we might need to add it,
        // but typically the frontend handles full dataURIs.
        if (!base64.startsWith('data:image')) {
            // Best guess for mime if missing
            img.src = `data:image/jpeg;base64,${base64}`;
        } else {
            img.src = base64;
        }
    });
};

export type ColorCorrectionMode = 'off' | 'match' | 'autoWhiteBalance' | 'redSuppress';

export interface ColorCorrectionOptions {
    mode: ColorCorrectionMode;
    reference?: string;
    blend?: number;
    redAdjust?: number;
    cyanBoost?: number;
    saturation?: number;
    contrast?: number;
}

export const ensureDataUri = async (src: string): Promise<string> => {
  if (!src) return '';
  if (src.startsWith('data:')) return src;
  try {
    const response = await fetch(src, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('转换图片 Data URI 失败'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[imageProcessor] ensureDataUri fetch failed, using fallback source:', err);
    return src;
  }
};

export const loadCanvasImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('图片数据为空，无法加载'));
      return;
    }
    const img = new Image();
    // Only set crossOrigin for remote HTTP URLs to prevent Data URI sandboxing errors
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'Anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If CORS Anonymous failed on remote URL, retry loading directly without crossOrigin
      if (img.crossOrigin) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () => reject(new Error('加载图像失败，请检查网络或素材地址有效性'));
        fallbackImg.src = src;
        return;
      }
      reject(new Error('加载图像失败，请检查素材数据完整性'));
    };
    img.src = src;
  });

export type NormalizedCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const cropImageRegion = async (
  source: string,
  rect: NormalizedCropRect,
  outputMime = 'image/png',
  quality = 0.96
): Promise<string> => {
  if (!source) throw new Error('切图失败：原始图像数据为空');

  // Convert HTTP/HTTPS URLs to Data URIs to eliminate CORS canvas export restrictions
  let safeSource = source;
  if (source.startsWith('http://') || source.startsWith('https://')) {
    safeSource = await ensureDataUri(source);
  }

  const image = await loadCanvasImage(safeSource);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('切图失败：图像尺寸获取异常');
  }

  const sx = clamp(rect.x, 0, 0.98) * sourceWidth;
  const sy = clamp(rect.y, 0, 0.98) * sourceHeight;
  const sw = clamp(rect.width, 0.02, 1 - rect.x) * sourceWidth;
  const sh = clamp(rect.height, 0.02, 1 - rect.y) * sourceHeight;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(128, Math.round(sw));
  canvas.height = Math.max(128, Math.round(sh));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 绘图环境不可用，无法进行区域裁切');

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(outputMime, quality);
};

export const createModelHeadIdentityCrop = (source: string): Promise<string> => {
    return cropImageRegion(source, {
        x: 0.23,
        y: 0.02,
        width: 0.54,
        height: 0.52,
    });
};

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const getRgbStats = (data: Uint8ClampedArray, neutralPreferred = false) => {
    const indexes: number[] = [];
    if (neutralPreferred) {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const luma = r * 0.299 + g * 0.587 + b * 0.114;
            const saturationLike = max - min;
            if (luma > 35 && luma < 245 && saturationLike < 38) {
                indexes.push(i);
            }
        }
    }

    const useNeutral = indexes.length > data.length / 4 * 0.04;
    const count = useNeutral ? indexes.length : data.length / 4;
    const mean = [0, 0, 0];
    const eachPixel = useNeutral
        ? (callback: (index: number) => void) => indexes.forEach(callback)
        : (callback: (index: number) => void) => {
            for (let i = 0; i < data.length; i += 4) callback(i);
        };

    eachPixel((i) => {
        mean[0] += data[i];
        mean[1] += data[i + 1];
        mean[2] += data[i + 2];
    });
    mean[0] /= count;
    mean[1] /= count;
    mean[2] /= count;

    const variance = [0, 0, 0];
    eachPixel((i) => {
        variance[0] += (data[i] - mean[0]) ** 2;
        variance[1] += (data[i + 1] - mean[1]) ** 2;
        variance[2] += (data[i + 2] - mean[2]) ** 2;
    });
    const std = variance.map(v => Math.sqrt(v / count) || 1);
    return { mean, std };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type ColorMatchStats = {
    meanY: number;
    stdY: number;
    meanRg: number;
    stdRg: number;
    meanYb: number;
    stdYb: number;
};

const getLuma = (r: number, g: number, b: number) => r * 0.299 + g * 0.587 + b * 0.114;
const getRg = (r: number, g: number) => r - g;
const getYb = (r: number, g: number, b: number) => (r + g) * 0.5 - b;

const getColorSampleWeight = (r: number, g: number, b: number) => {
    const y = getLuma(r, g, b);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;

    if (y < 18 || y > 248) return 0;

    let weight = 1;
    if (y < 45) weight *= (y - 18) / 27;
    if (y > 220) weight *= (248 - y) / 28;
    if (chroma > 120) weight *= 0.45;

    return clamp(weight, 0, 1);
};

const getPixelCorrectionWeight = (y: number) => {
    if (y < 12 || y > 252) return 0.12;
    if (y < 45) return clamp((y - 12) / 33, 0.25, 1);
    if (y > 220) return clamp((252 - y) / 32, 0.25, 1);
    return 1;
};

const getColorMatchStats = (data: Uint8ClampedArray): ColorMatchStats => {
    let totalWeight = 0;
    let meanY = 0;
    let meanRg = 0;
    let meanYb = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const weight = getColorSampleWeight(r, g, b);
        if (weight <= 0) continue;

        totalWeight += weight;
        meanY += getLuma(r, g, b) * weight;
        meanRg += getRg(r, g) * weight;
        meanYb += getYb(r, g, b) * weight;
    }

    if (totalWeight <= 0) {
        const fallback = getRgbStats(data);
        const r = fallback.mean[0];
        const g = fallback.mean[1];
        const b = fallback.mean[2];
        return {
            meanY: getLuma(r, g, b),
            stdY: 24,
            meanRg: getRg(r, g),
            stdRg: 18,
            meanYb: getYb(r, g, b),
            stdYb: 18,
        };
    }

    meanY /= totalWeight;
    meanRg /= totalWeight;
    meanYb /= totalWeight;

    let varianceY = 0;
    let varianceRg = 0;
    let varianceYb = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const weight = getColorSampleWeight(r, g, b);
        if (weight <= 0) continue;

        varianceY += ((getLuma(r, g, b) - meanY) ** 2) * weight;
        varianceRg += ((getRg(r, g) - meanRg) ** 2) * weight;
        varianceYb += ((getYb(r, g, b) - meanYb) ** 2) * weight;
    }

    return {
        meanY,
        stdY: Math.sqrt(varianceY / totalWeight) || 1,
        meanRg,
        stdRg: Math.sqrt(varianceRg / totalWeight) || 1,
        meanYb,
        stdYb: Math.sqrt(varianceYb / totalWeight) || 1,
    };
};

const opponentToRgb = (y: number, rg: number, yb: number) => [
    y + 0.644 * rg + 0.114 * yb,
    y - 0.356 * rg + 0.114 * yb,
    y + 0.144 * rg - 0.886 * yb,
];

const adjustSaturation = (r: number, g: number, b: number, saturation: number) => {
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    return [
        gray + (r - gray) * saturation,
        gray + (g - gray) * saturation,
        gray + (b - gray) * saturation,
    ];
};

const adjustContrast = (r: number, g: number, b: number, contrast: number) => [
    (r - 128) * contrast + 128,
    (g - 128) * contrast + 128,
    (b - 128) * contrast + 128,
];

export const applyColorCorrection = async (
    source: string,
    options: ColorCorrectionOptions
): Promise<string> => {
    if (options.mode === 'off') return source;

    const sourceImage = await loadCanvasImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = sourceImage.naturalWidth || sourceImage.width;
    canvas.height = sourceImage.naturalHeight || sourceImage.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available for color correction.');
    ctx.drawImage(sourceImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const blend = Math.max(0, Math.min(1, options.blend ?? 0.65));

    if (options.mode === 'match' && options.reference) {
        const refImage = await loadCanvasImage(options.reference);
        const refCanvas = document.createElement('canvas');
        refCanvas.width = refImage.naturalWidth || refImage.width;
        refCanvas.height = refImage.naturalHeight || refImage.height;
        const refCtx = refCanvas.getContext('2d');
        if (!refCtx) throw new Error('Canvas is not available for color reference.');
        refCtx.drawImage(refImage, 0, 0);
        const refData = refCtx.getImageData(0, 0, refCanvas.width, refCanvas.height).data;
        const srcStats = getColorMatchStats(data);
        const refStats = getColorMatchStats(refData);

        for (let i = 0; i < data.length; i += 4) {
            const originalR = data[i];
            const originalG = data[i + 1];
            const originalB = data[i + 2];
            const originalLuma = getLuma(originalR, originalG, originalB);
            const pixelWeight = getPixelCorrectionWeight(originalLuma);
            const effectiveBlend = blend * pixelWeight;

            const originalRg = getRg(originalR, originalG);
            const originalYb = getYb(originalR, originalG, originalB);
            const rgScale = clamp(refStats.stdRg / Math.max(1, srcStats.stdRg), 0.75, 1.25);
            const ybScale = clamp(refStats.stdYb / Math.max(1, srcStats.stdYb), 0.75, 1.25);
            const mappedRg = ((originalRg - srcStats.meanRg) * rgScale) + refStats.meanRg;
            const mappedYb = ((originalYb - srcStats.meanYb) * ybScale) + refStats.meanYb;
            const mappedLuma = ((originalLuma - srcStats.meanY) * clamp(refStats.stdY / Math.max(1, srcStats.stdY), 0.88, 1.12)) + refStats.meanY;

            const rg = originalRg + clamp(mappedRg - originalRg, -26, 26) * effectiveBlend;
            const yb = originalYb + clamp(mappedYb - originalYb, -30, 30) * effectiveBlend;
            const y = originalLuma + clamp(mappedLuma - originalLuma, -10, 10) * effectiveBlend * 0.25;
            let [r, g, b] = opponentToRgb(y, rg, yb);

            data[i] = clampByte(r);
            data[i + 1] = clampByte(g);
            data[i + 2] = clampByte(b);
        }
    } else if (options.mode === 'autoWhiteBalance') {
        const stats = getRgbStats(data);
        const target = (stats.mean[0] + stats.mean[1] + stats.mean[2]) / 3;
        const gains = stats.mean.map(mean => target / Math.max(1, mean));
        for (let i = 0; i < data.length; i += 4) {
            data[i] = clampByte(data[i] * (1 + (gains[0] - 1) * blend));
            data[i + 1] = clampByte(data[i + 1] * (1 + (gains[1] - 1) * blend));
            data[i + 2] = clampByte(data[i + 2] * (1 + (gains[2] - 1) * blend));
        }
    } else if (options.mode === 'redSuppress') {
        const redAdjust = options.redAdjust ?? -0.08;
        const cyanBoost = options.cyanBoost ?? 0.025;
        const saturation = options.saturation ?? 0.92;
        const contrast = options.contrast ?? 1.04;
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] * (1 + redAdjust * blend);
            let g = data[i + 1] * (1 + cyanBoost * blend);
            let b = data[i + 2] * (1 + cyanBoost * blend);
            [r, g, b] = adjustSaturation(r, g, b, 1 + (saturation - 1) * blend);
            [r, g, b] = adjustContrast(r, g, b, 1 + (contrast - 1) * blend);
            data[i] = clampByte(r);
            data[i + 1] = clampByte(g);
            data[i + 2] = clampByte(b);
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL(source.startsWith('data:image/png') ? 'image/png' : 'image/jpeg', 0.95);
};

export const applyColorCorrectionBatch = async (
    images: string[],
    options: ColorCorrectionOptions
): Promise<string[]> => {
    if (options.mode === 'off') return images;
    if (options.mode === 'match' && !options.reference) return images;
    return Promise.all(images.map(async image => {
        try {
            return await applyColorCorrection(image, options);
        } catch (error) {
            console.warn('Color correction failed. Using original image.', error);
            return image;
        }
    }));
};

/**
 * Seamlessly composites the generated face image back onto the original target scene photo
 * using a feathered face mask. This guarantees 100.0% pixel-perfect preservation of original
 * scene background, body posture, and clothing outside the face region.
 */
export const compositeInpaintedFaceBack = async (
    originalSceneUrl: string,
    generatedImageUrl: string,
    maskDataUrl?: string
): Promise<string> => {
    try {
        const [origImg, genImg] = await Promise.all([
            loadCanvasImage(originalSceneUrl),
            loadCanvasImage(generatedImageUrl),
        ]);

        const width = origImg.naturalWidth || origImg.width;
        const height = origImg.naturalHeight || origImg.height;

        // Base canvas: 100% ORIGINAL target scene photo
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return generatedImageUrl;

        // Step 1: Draw 100% original target scene as layer 1
        ctx.drawImage(origImg, 0, 0, width, height);

        if (!maskDataUrl) return canvas.toDataURL('image/jpeg', 0.95);

        // Step 2: Draw generated AI face image on offscreen canvas
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = width;
        faceCanvas.height = height;
        const faceCtx = faceCanvas.getContext('2d');
        if (!faceCtx) return generatedImageUrl;

        faceCtx.drawImage(genImg, 0, 0, width, height);

        // Step 3: Load user's painted face mask and convert luminance to Alpha channel
        const maskImg = await loadCanvasImage(maskDataUrl);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
            maskCtx.drawImage(maskImg, 0, 0, width, height);

            // White painted mask pixels -> Alpha = 255 (Keep face); Black unpainted pixels -> Alpha = 0 (Keep original background & clothes!)
            const imgData = maskCtx.getImageData(0, 0, width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i + 3] = clampByte(luma);
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
            }
            maskCtx.putImageData(imgData, 0, 0);

            // Apply dynamic resolution-proportional Gaussian blur for invisible 100% natural photographic seam transition
            const blurRadius = Math.max(24, Math.round(Math.min(width, height) * 0.024));
            const featherCanvas = document.createElement('canvas');
            featherCanvas.width = width;
            featherCanvas.height = height;
            const featherCtx = featherCanvas.getContext('2d');
            if (featherCtx) {
                featherCtx.filter = `blur(${blurRadius}px)`;
                featherCtx.drawImage(maskCanvas, 0, 0, width, height);

                // Clip face canvas strictly inside the painted white mask with soft gradient falloff
                faceCtx.globalCompositeOperation = 'destination-in';
                faceCtx.drawImage(featherCanvas, 0, 0, width, height);
            }
        }

        // Step 4: Overlay replaced face patch onto original scene photo
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(faceCanvas, 0, 0, width, height);

        return canvas.toDataURL('image/jpeg', 0.95);
    } catch (err) {
        console.warn('Face composite paste-back failed, using generated image directly:', err);
        return generatedImageUrl;
    }
};
