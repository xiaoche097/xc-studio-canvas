import { ImageProvider, VideoProvider, ImageGenerationRequest, VideoGenerationRequest } from './types';
import { generateImage, generateVideo } from '../gemini';

export const geminiImageProvider: ImageProvider = {
  id: 'gemini',
  name: 'Gemini',
  models: [
    'Nano Banana Pro', 'NanoBanana2', 'Seedream5.0',
    'GPT Image 1.5', 'Flux.2 Max', 'Flux.2 Pro', 'Gemini Imagen 4', 'Midjourney',
    'midjourney', 'dall-e-3', 'flux-pro', 'flux-schnell', 'gemini-1.5-pro',
    'Seedream 4.5', 'Nano Banana', 'Seedream 4'
  ],
  capability: {
    authMode: 'both',
    apiStyle: 'google',
    supports: ['modelList', 'chat', 'image', 'video'],
  },

  async generateImage(request: ImageGenerationRequest, model: string): Promise<string | null> {
    return generateImage({
      prompt: request.prompt,
      model: model as any,
      aspectRatio: request.aspectRatio,
      imageSize: request.imageSize,
      referenceImage: request.referenceImage,
      referenceImages: request.referenceImages,
      referenceStrength: request.referenceStrength,
      referencePriority: request.referencePriority,
      referenceMode: request.referenceMode,
      maskImage: request.maskImage,
    });
  }
};

export const geminiVideoProvider: VideoProvider = {
  id: 'gemini',
  name: 'Gemini Veo',
  models: [
    'Veo 3.1', 'Veo 3.1 Pro', 'Veo 3.1 Fast',
    'Kling 3.0', 'Kling 3.0 Omni', 'Seedance 1.5 Pro', 'Kling 2.8',
    'Wan 2.6', 'Sora 2 Pro', 'Sora 2', 'Kling 01', 'Hailuo 2.3', 'Veo 3', 'Vidu Q2',
    'kling-v1', 'sora', 'veo', 'runway-gen3'
  ],
  capability: {
    authMode: 'both',
    apiStyle: 'google',
    supports: ['modelList', 'chat', 'image', 'video'],
  },

  async generateVideo(request: VideoGenerationRequest, model: string): Promise<string | null> {
    return generateVideo({
      prompt: request.prompt,
      model: model as any,
      aspectRatio: request.aspectRatio,
      startFrame: request.startFrame,
      endFrame: request.endFrame,
      referenceImages: request.referenceImages,
    });
  }
};
