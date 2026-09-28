import type { ImageModel } from '../../types';

export interface ImageModelOption {
  id: ImageModel;
  name: string;
  desc: string;
  time: string;
}

export const DEFAULT_AUTO_IMAGE_MODEL: ImageModel = 'gemini-3.1-flash-image-preview';

export const PREFERRED_IMAGE_MODEL_TO_STORAGE_ID: Partial<Record<ImageModel, string>> = {
  'Nano Banana Pro': 'gemini-3-pro-image-preview',
  NanoBanana2: 'gemini-3.1-flash-image-preview',
  'Seedream5.0': 'doubao-seedream-5-0-260128',
  'gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image-preview',
  'gpt-image-2': 'gpt-image-2',
  mj_imagine: 'mj_imagine',
  'qwen-image-3.0-pro': 'qwen-image-3.0-pro',
};

export const STORAGE_ID_TO_PREFERRED_IMAGE_MODEL: Record<string, ImageModel> = {
  'gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',
  'Nano Banana Pro': 'gemini-3-pro-image-preview',
  nanobananapro: 'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image-preview',
  NanoBanana2: 'gemini-3.1-flash-image-preview',
  nanobanana2: 'gemini-3.1-flash-image-preview',
  'gpt-image-2': 'gpt-image-2',
  'GPT Image 2': 'gpt-image-2',
  mj_imagine: 'mj_imagine',
  Midjourney: 'mj_imagine',
  'qwen-image-3.0-pro': 'qwen-image-3.0-pro',
};

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Banana 2',
    desc: 'gemini-3.1-flash-image-preview',
    time: '3.1 Flash',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Banana Pro',
    desc: 'gemini-3-pro-image-preview',
    time: '3.0 Pro',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    desc: 'gpt-image-2',
    time: 'Ultra Quality',
  },
  {
    id: 'mj_imagine',
    name: 'Midjourney',
    desc: 'mj_imagine',
    time: 'MJ Imagine',
  },
  {
    id: 'qwen-image-3.0-pro',
    name: '千问 3.0 Pro',
    desc: 'qwen-image-3.0-pro',
    time: 'Qwen Image',
  },
];
