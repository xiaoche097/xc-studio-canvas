export const DEFAULT_XIAOCHE_BASE_URL = 'http://localhost:38000/v1';

const IMAGE_SHAPES = ['landscape', 'portrait', 'square', 'four-three', 'three-four'] as const;
const IMAGE_RESOLUTIONS = ['', '-2k', '-4k'] as const;

const buildGeminiImageModels = (family: 'gemini-3.0-pro-image' | 'gemini-3.1-flash-image') =>
  IMAGE_RESOLUTIONS.flatMap(resolution => IMAGE_SHAPES.map(shape => `${family}-${shape}${resolution}`));

const pair = (prefix: string) => [`${prefix}_portrait`, `${prefix}_landscape`];
const timedPair = (prefix: string, seconds: 4 | 6) => [
  `${prefix}_${seconds}s_portrait`,
  `${prefix}_${seconds}s_landscape`,
];

export const XIAOCHE_IMAGE_MODELS = [
  ...buildGeminiImageModels('gemini-3.0-pro-image'),
  'imagen-4.0-generate-preview-landscape',
  'imagen-4.0-generate-preview-portrait',
  ...buildGeminiImageModels('gemini-3.1-flash-image'),
] as const;

export const XIAOCHE_VIDEO_MODELS = [
  'omni', 'omni_portrait',
  'veo_3_1_t2v_fast_portrait',
  'veo_3_1_t2v_fast_landscape',
  'veo_3_1_t2v_fast_portrait_ultra',
  'veo_3_1_t2v_fast_ultra',
  'veo_3_1_t2v_fast_portrait_ultra_relaxed',
  'veo_3_1_t2v_fast_ultra_relaxed',
  ...pair('veo_3_1_t2v'),
  'veo_3_1_t2v_landscape_4s', 'veo_3_1_t2v_portrait_4s',
  'veo_3_1_t2v_landscape_6s', 'veo_3_1_t2v_portrait_6s',
  'veo_3_1_t2v_fast_landscape_4s', 'veo_3_1_t2v_fast_portrait_4s',
  'veo_3_1_t2v_fast_landscape_6s', 'veo_3_1_t2v_fast_portrait_6s',
  ...pair('veo_3_1_t2v_lite'),
  ...timedPair('veo_3_1_t2v_lite', 4),
  ...timedPair('veo_3_1_t2v_lite', 6),
  'veo_3_1_t2v_lite_8s_portrait', 'veo_3_1_t2v_lite_8s_landscape',
  'veo_3_1_i2v_s_fast_portrait_fl', 'veo_3_1_i2v_s_fast_fl',
  'veo_3_1_i2v_s_fast_portrait_ultra_fl', 'veo_3_1_i2v_s_fast_ultra_fl',
  'veo_3_1_i2v_s_fast_portrait_ultra_relaxed', 'veo_3_1_i2v_s_fast_ultra_relaxed',
  ...pair('veo_3_1_i2v_s'),
  'veo_3_1_i2v_s_landscape_4s', 'veo_3_1_i2v_s_portrait_4s',
  'veo_3_1_i2v_s_landscape_6s', 'veo_3_1_i2v_s_portrait_6s',
  'veo_3_1_i2v_s_fast_landscape_4s_fl', 'veo_3_1_i2v_s_fast_portrait_4s_fl',
  'veo_3_1_i2v_s_fast_landscape_6s_fl', 'veo_3_1_i2v_s_fast_portrait_6s_fl',
  ...pair('veo_3_1_i2v_lite'),
  ...timedPair('veo_3_1_i2v_lite', 4),
  ...timedPair('veo_3_1_i2v_lite', 6),
  'veo_3_1_i2v_lite_8s_portrait', 'veo_3_1_i2v_lite_8s_landscape',
  ...pair('veo_3_1_interpolation_lite'),
  ...timedPair('veo_3_1_interpolation_lite', 4),
  ...timedPair('veo_3_1_interpolation_lite', 6),
  'veo_3_1_interpolation_lite_8s_portrait', 'veo_3_1_interpolation_lite_8s_landscape',
  ...pair('veo_3_1_r2v_fast'),
  'veo_3_1_r2v_fast_portrait_ultra', 'veo_3_1_r2v_fast_landscape_ultra',
  'veo_3_1_r2v_fast_portrait_ultra_relaxed', 'veo_3_1_r2v_fast_landscape_ultra_relaxed',
  'veo_3_1_t2v_landscape_4k', 'veo_3_1_t2v_portrait_4k',
  'veo_3_1_t2v_landscape_1080p', 'veo_3_1_t2v_portrait_1080p',
  'veo_3_1_t2v_landscape_4s_4k', 'veo_3_1_t2v_portrait_4s_4k',
  'veo_3_1_t2v_landscape_4s_1080p', 'veo_3_1_t2v_portrait_4s_1080p',
  'veo_3_1_t2v_landscape_6s_4k', 'veo_3_1_t2v_portrait_6s_4k',
  'veo_3_1_t2v_landscape_6s_1080p', 'veo_3_1_t2v_portrait_6s_1080p',
  'veo_3_1_t2v_fast_portrait_4k', 'veo_3_1_t2v_fast_4k',
  'veo_3_1_t2v_fast_portrait_ultra_4k', 'veo_3_1_t2v_fast_ultra_4k',
  'veo_3_1_t2v_fast_portrait_1080p', 'veo_3_1_t2v_fast_1080p',
  'veo_3_1_t2v_fast_portrait_ultra_1080p', 'veo_3_1_t2v_fast_ultra_1080p',
  'veo_3_1_i2v_s_fast_portrait_ultra_fl_4k', 'veo_3_1_i2v_s_fast_ultra_fl_4k',
  'veo_3_1_i2v_s_fast_portrait_ultra_fl_1080p', 'veo_3_1_i2v_s_fast_ultra_fl_1080p',
  'veo_3_1_i2v_s_landscape_4k', 'veo_3_1_i2v_s_portrait_4k',
  'veo_3_1_i2v_s_landscape_1080p', 'veo_3_1_i2v_s_portrait_1080p',
  'veo_3_1_i2v_s_landscape_4s_4k', 'veo_3_1_i2v_s_portrait_4s_4k',
  'veo_3_1_i2v_s_landscape_4s_1080p', 'veo_3_1_i2v_s_portrait_4s_1080p',
  'veo_3_1_i2v_s_landscape_6s_4k', 'veo_3_1_i2v_s_portrait_6s_4k',
  'veo_3_1_i2v_s_landscape_6s_1080p', 'veo_3_1_i2v_s_portrait_6s_1080p',
  'veo_3_1_r2v_fast_portrait_ultra_4k', 'veo_3_1_r2v_fast_landscape_ultra_4k',
  'veo_3_1_r2v_fast_portrait_ultra_1080p', 'veo_3_1_r2v_fast_landscape_ultra_1080p',
] as const;

export const XIAOCHE_MODELS = [...XIAOCHE_IMAGE_MODELS, ...XIAOCHE_VIDEO_MODELS] as const;

const XIAOCHE_MODEL_SET = new Set<string>(XIAOCHE_MODELS);

export const isXiaocheModel = (model: string): boolean => XIAOCHE_MODEL_SET.has(model);

export const resolveXiaocheImageModel = (
  model: string,
  aspectRatio = '1:1',
  resolution = '1K'
): string => {
  if (isXiaocheModel(model)) return model;

  const shape = aspectRatio === '1:1'
    ? 'square'
    : aspectRatio === '4:3'
      ? 'four-three'
      : aspectRatio === '3:4'
        ? 'three-four'
        : ['9:16', '2:3', '4:5'].includes(aspectRatio)
          ? 'portrait'
          : 'landscape';
  const suffix = resolution.toUpperCase() === '4K' ? '-4k' : resolution.toUpperCase() === '2K' ? '-2k' : '';
  const proAliases = new Set(['gemini-3-pro-image-preview', 'gemini-3-pro-image', 'nanobananapro', 'pro']);
  const family = proAliases.has(model) ? 'gemini-3.0-pro-image' : 'gemini-3.1-flash-image';
  return `${family}-${shape}${suffix}`;
};

export const resolveXiaocheVideoModel = (
  model: string,
  aspectRatio = '16:9',
  imageCount = 0
): string => {
  const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape';
  if (model === 'omni' || model === 'omni_portrait') {
    return orientation === 'portrait' ? 'omni_portrait' : 'omni';
  }
  if ((XIAOCHE_VIDEO_MODELS as readonly string[]).includes(model)) return model;

  const isOmni = model === 'xiaoche-omni-flash';
  const isLite = model === 'xiaoche-veo-3.1-lite' || model.includes('_lite');
  const isQuality = model === 'xiaoche-veo-3.1-quality' || model.includes('quality') || model.includes('pro');
  const isFast = model === 'xiaoche-veo-3.1-fast' || model.includes('fast');

  if (isOmni) return orientation === 'portrait' ? 'omni_portrait' : 'omni';

  if (imageCount >= 3) {
    return isQuality
      ? `veo_3_1_r2v_fast_${orientation}_ultra`
      : `veo_3_1_r2v_fast_${orientation}`;
  }

  if (imageCount > 0) {
    if (isLite) {
      return imageCount === 2
        ? `veo_3_1_interpolation_lite_${orientation}`
        : `veo_3_1_i2v_lite_${orientation}`;
    }
    if (isQuality) {
      return orientation === 'portrait'
        ? 'veo_3_1_i2v_s_fast_portrait_ultra_fl'
        : 'veo_3_1_i2v_s_fast_ultra_fl';
    }
    if (isFast) {
      return orientation === 'portrait'
        ? 'veo_3_1_i2v_s_fast_portrait_fl'
        : 'veo_3_1_i2v_s_fast_fl';
    }
    return `veo_3_1_i2v_s_${orientation}`;
  }

  if (isLite) return `veo_3_1_t2v_lite_${orientation}`;
  if (isQuality) {
    return orientation === 'portrait'
      ? 'veo_3_1_t2v_fast_portrait_ultra'
      : 'veo_3_1_t2v_fast_ultra';
  }
  return isFast
    ? `veo_3_1_t2v_fast_${orientation}`
    : `veo_3_1_t2v_${orientation}`;
};

export const getXiaocheVideoImageLimit = (model: string, firstLastFrame = false): number => {
  const isLite = model === 'xiaoche-veo-3.1-lite' || model.includes('_lite');
  return isLite ? (firstLastFrame ? 2 : 1) : 3;
};
