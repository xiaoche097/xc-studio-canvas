/**
 * Canvas 辅助工具函数
 * 处理资产到画布元素的转换
 */

import { GeneratedAsset } from '../types/agent.types';
import { CanvasElement } from '../types';

const IMAGE_FIT_VIEWPORT_RATIO = 0.6;
const IMAGE_FIT_MAX_WIDTH = 1280;
const IMAGE_FIT_MAX_HEIGHT = 900;

function calcDisplaySize(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const maxW = Math.min(viewportWidth * IMAGE_FIT_VIEWPORT_RATIO, IMAGE_FIT_MAX_WIDTH);
  const maxH = Math.min(viewportHeight * IMAGE_FIT_VIEWPORT_RATIO, IMAGE_FIT_MAX_HEIGHT);
  const scale = Math.min(maxW / safeWidth, maxH / safeHeight, 1);
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

/**
 * 将单个GeneratedAsset转换为CanvasElement
 */
export function assetToCanvasElement(
  asset: GeneratedAsset,
  options: {
    x?: number;
    y?: number;
    zIndex?: number;
    viewportWidth?: number;
    viewportHeight?: number;
  } = {}
): CanvasElement {
  const baseElement = {
    id: asset.id,
    x: options.x || 100,
    y: options.y || 100,
    zIndex: options.zIndex || 1
  };

  if (asset.type === 'image') {
    const w = asset.metadata.width || 512;
    const h = asset.metadata.height || 512;
    const fitted = calcDisplaySize(
      w,
      h,
      options.viewportWidth || 1600,
      options.viewportHeight || 900,
    );
    return {
      ...baseElement,
      type: 'gen-image',
      url: asset.url,
      originalUrl: asset.url,
      width: fitted.width,
      height: fitted.height,
      genPrompt: asset.metadata.prompt,
      genModel: asset.metadata.model as any,
      genAspectRatio: w === h ? '1:1' : `${w}:${h}`,
      genResolution: '2K'
    } as CanvasElement;
  }

  if (asset.type === 'video') {
    const w = asset.metadata.width || 640;
    const h = asset.metadata.height || 360;
    return {
      ...baseElement,
      type: 'gen-video',
      url: asset.url,
      width: w,
      height: h,
      genPrompt: asset.metadata.prompt,
      genModel: asset.metadata.model as any,
      genAspectRatio: w === h ? '1:1' : `${w}:${h}`,
      genDuration: '5s'
    } as CanvasElement;
  }

  throw new Error(`Unknown asset type: ${asset.type}`);
}

/**
 * 将多个GeneratedAssets转换为CanvasElements
 * 自动错开位置避免重叠
 */
export function assetsToCanvasElements(
  assets: GeneratedAsset[],
  startPosition: { x: number; y: number } = { x: 100, y: 100 },
  startZIndex: number = 1,
  viewportSize: { width: number; height: number } = { width: 1600, height: 900 },
): CanvasElement[] {
  return assets.map((asset, index) => {
    return assetToCanvasElement(asset, {
      x: startPosition.x + (index * 50),
      y: startPosition.y + (index * 50),
      zIndex: startZIndex + index,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
    });
  });
}

/**
 * 计算画布中心位置（用于居中放置新元素）
 */
export function getCanvasCenter(
  canvasWidth: number,
  canvasHeight: number,
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  const centerX = (canvasWidth / 2 - pan.x) / (zoom / 100);
  const centerY = (canvasHeight / 2 - pan.y) / (zoom / 100);
  return { x: centerX, y: centerY };
}

/**
 * 在画布中心放置资产
 */
export function assetsToCanvasElementsAtCenter(
  assets: GeneratedAsset[],
  canvasWidth: number,
  canvasHeight: number,
  pan: { x: number; y: number },
  zoom: number,
  startZIndex: number = 1
): CanvasElement[] {
  const center = getCanvasCenter(canvasWidth, canvasHeight, pan, zoom);
  
  return assets.map((asset, index) => {
    // 根据资产数量计算网格布局
    const cols = Math.ceil(Math.sqrt(assets.length));
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    // 动态间距，基于资产尺寸
    const sourceW = asset.metadata.width || 512;
    const sourceH = asset.metadata.height || 512;
    const fitted = calcDisplaySize(sourceW, sourceH, canvasWidth, canvasHeight);
    const w = fitted.width;
    const h = fitted.height;
    const spacingX = w + 40;
    const spacingY = h + 40;

    const offsetX = (col - (cols - 1) / 2) * spacingX;
    const offsetY = (row - (Math.ceil(assets.length / cols) - 1) / 2) * spacingY;
    
    return assetToCanvasElement(asset, {
      x: center.x + offsetX - (w / 2),
      y: center.y + offsetY - (h / 2),
      zIndex: startZIndex + index,
      viewportWidth: canvasWidth,
      viewportHeight: canvasHeight,
    });
  });
}
