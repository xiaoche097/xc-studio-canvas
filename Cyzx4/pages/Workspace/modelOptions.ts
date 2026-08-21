import type { ImageModel } from '../../types';

export interface ImageModelOption {
  id: ImageModel;
  name: string;
  desc: string;
  time: string;
}

export const DEFAULT_AUTO_IMAGE_MODEL: ImageModel = 'NanoBanana2';

export const PREFERRED_IMAGE_MODEL_TO_STORAGE_ID: Partial<Record<ImageModel, string>> = {
  'Nano Banana Pro': 'gemini-3-pro-image-preview',
  NanoBanana2: 'gemini-3.1-flash-image-preview',
  'Seedream5.0': 'doubao-seedream-5-0-260128',
};

export const STORAGE_ID_TO_PREFERRED_IMAGE_MODEL: Record<string, ImageModel> = {
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
  'Nano Banana Pro': 'Nano Banana Pro',
  'gemini-3.1-flash-image-preview': 'NanoBanana2',
  NanoBanana2: 'NanoBanana2',
  'doubao-seedream-5-0-260128': 'Seedream5.0',
  'Seedream5.0': 'Seedream5.0',
  'GPT Image 1.5': 'GPT Image 1.5',
  'Flux.2 Max': 'Flux.2 Max',
};

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  {
    id: 'Nano Banana Pro',
    name: 'Nano Banana Pro',
    desc: '高质量图像生成，细节丰富',
    time: '~20s',
  },
  {
    id: 'NanoBanana2',
    name: 'Nano Banana 2',
    desc: '新一代极速图像生成',
    time: '~5s',
  },
  {
    id: 'Seedream5.0',
    name: 'Seedream 5.0',
    desc: '深度审美，电影级画质',
    time: '~15s',
  },
  {
    id: 'GPT Image 1.5',
    name: 'GPT Image 1.5',
    desc: '创意图像生成，风格多样',
    time: '~120s',
  },
  {
    id: 'Flux.2 Max',
    name: 'Flux.2 Max',
    desc: '快速图像生成，效率优先',
    time: '~10s',
  },
];
