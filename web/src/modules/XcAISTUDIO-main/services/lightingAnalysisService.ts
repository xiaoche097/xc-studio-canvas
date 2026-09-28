import { LightingParams } from '../components/LightingControlModal';

/**
 * 智能分析原图像素明暗分布与色彩梯度，推算 3D 光源参数
 */
export async function detectImageLighting(imageSrc?: string): Promise<LightingParams> {
    const defaultParams: LightingParams = {
        azimuth: 35,
        elevation: 25,
        intensity: 45,
        color: '#FFFFFF',
        viewMode: 'perspective',
    };

    if (!imageSrc) return defaultParams;

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const sampleSize = 120;
                canvas.width = sampleSize;
                canvas.height = sampleSize;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve(defaultParams);
                    return;
                }

                ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
                const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
                const data = imageData.data;

                let leftLum = 0;
                let rightLum = 0;
                let topLum = 0;
                let bottomLum = 0;

                let totalCount = 0;
                let maxLum = 0;
                let minLum = 255;

                // 收集最亮区域像素的颜色
                const highlightsRgb: Array<{ r: number; g: number; b: number; lum: number }> = [];

                for (let y = 0; y < sampleSize; y++) {
                    for (let x = 0; x < sampleSize; x++) {
                        const idx = (y * sampleSize + x) * 4;
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];
                        const a = data[idx + 3];

                        if (a < 50) continue; // 忽略透明像素

                        // 感知亮度计算
                        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                        totalCount++;

                        if (lum > maxLum) maxLum = lum;
                        if (lum < minLum) minLum = lum;

                        // 左右权重划分
                        if (x < sampleSize / 2) {
                            leftLum += lum * (1 - x / (sampleSize / 2));
                        } else {
                            rightLum += lum * ((x - sampleSize / 2) / (sampleSize / 2));
                        }

                        // 上下权重划分
                        if (y < sampleSize / 2) {
                            topLum += lum * (1 - y / (sampleSize / 2));
                        } else {
                            bottomLum += lum * ((y - sampleSize / 2) / (sampleSize / 2));
                        }

                        highlightsRgb.push({ r, g, b, lum });
                    }
                }

                if (totalCount === 0) {
                    resolve(defaultParams);
                    return;
                }

                // 1. 水平方位角 (Azimuth) 推算
                const diffHoriz = rightLum - leftLum;
                const normHoriz = diffHoriz / (leftLum + rightLum || 1);
                let azimuth = Math.round(normHoriz * 120);
                azimuth = Math.max(-135, Math.min(135, azimuth));

                // 2. 高度角 (Elevation) 推算
                const diffVert = topLum - bottomLum;
                const normVert = diffVert / (topLum + bottomLum || 1);
                let elevation = Math.round(normVert * 70);
                elevation = Math.max(-60, Math.min(80, elevation));

                // 3. 光照强度 (Intensity) 推算
                const contrastRatio = (maxLum - minLum) / 255;
                let intensity = Math.round(30 + contrastRatio * 50);
                intensity = Math.max(15, Math.min(90, intensity));

                // 4. 高光区光色采样 (Sampling Highlight Color)
                highlightsRgb.sort((a, b) => b.lum - a.lum);
                const topHighlights = highlightsRgb.slice(0, Math.max(1, Math.floor(highlightsRgb.length * 0.08)));

                let avgR = 0, avgG = 0, avgB = 0;
                topHighlights.forEach(p => {
                    avgR += p.r;
                    avgG += p.g;
                    avgB += p.b;
                });
                avgR = Math.round(avgR / topHighlights.length);
                avgG = Math.round(avgG / topHighlights.length);
                avgB = Math.round(avgB / topHighlights.length);

                const componentToHex = (c: number) => {
                    const hex = Math.min(255, Math.max(0, c)).toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                };

                const detectedHex = `#${componentToHex(avgR)}${componentToHex(avgG)}${componentToHex(avgB)}`.toUpperCase();

                resolve({
                    azimuth,
                    elevation,
                    intensity,
                    color: detectedHex,
                    viewMode: 'perspective',
                });
            } catch (err) {
                console.error('Image lighting detection error:', err);
                resolve(defaultParams);
            }
        };

        img.onerror = () => {
            resolve(defaultParams);
        };

        img.src = imageSrc;
    });
}
