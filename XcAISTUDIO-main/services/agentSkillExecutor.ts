import {
  generateImageToImage,
  generateUniversalTryOn,
  type UniversalTryOnProductImage,
} from '../../Cyzx4/services/geminiService';
import { AspectRatio, ImageResolution } from '../../Cyzx4/types';
import type { WorkflowHint } from '../../Cyzx4/types/gemini.types';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { generateVideo } from './geminiService';

export type AgentSkillId =
  | 'UNIVERSAL_TRY_ON'
  | 'SINGLE_ITEM_TRY_ON'
  | 'RETOUCHING'
  | 'PRODUCT_VIDEO'
  | 'MODEL_SCENE_FISSION'
  | 'MODEL_POSE_FISSION'
  | 'ECOMMERCE_HERO'
  | 'IMAGE_CLEAN';

export interface AgentSkillAsset {
  id: string;
  src: string;
  title: string;
}

export interface AgentSkillPreferences {
  imageRatio: string;
  imageResolution: string;
  imageModel: string;
  videoRatio: string;
  videoResolution: string;
  videoDuration: string;
  videoModel: string;
}

export interface AgentSkillExecutionInput {
  skillId: AgentSkillId;
  skillTitle: string;
  prompt: string;
  assets: AgentSkillAsset[];
  preferences: AgentSkillPreferences;
  onProgress?: (message: string) => void;
}

export interface AgentSkillResult {
  url: string;
  mediaType: 'image' | 'video';
  title: string;
}

type ApiImage = { base64: string; mimeType: string; sourceUrl: string };

const IMAGE_SKILL_PROMPTS: Record<Exclude<AgentSkillId, 'UNIVERSAL_TRY_ON' | 'PRODUCT_VIDEO'>, {
  instruction: string;
  workflowHint: WorkflowHint;
}> = {
  SINGLE_ITEM_TRY_ON: {
    workflowHint: 'single-item-try-on',
    instruction: `Image 1 is the target person/body reference. Image 2 and any later product images define the exact item to wear.
Fit only that product onto Image 1 with correct anatomy, perspective, scale, contact shadow, material, occlusion and gravity. Preserve the person's face, body, pose, hands, hair, skin, scene, lighting and crop. Preserve every product detail, color, logo, pattern and construction. Do not redesign either the person or product.`,
  },
  RETOUCHING: {
    workflowHint: 'product-retouching',
    instruction: `Transform the source product into a premium ecommerce white-background packshot. Preserve exact identity, geometry, product count, camera angle, proportions, logo, printed text, color, material and every structural detail. Use a uniform pure white #FFFFFF background, centered commercial composition, clean edges, neutral white balance and only a restrained contact shadow. Remove dust and artifacts without redesigning the product. No props, people, borders, captions or watermark.`,
  },
  MODEL_SCENE_FISSION: {
    workflowHint: 'pose-fission',
    instruction: `Create a new commercial fashion scene variation from the supplied model reference. Lock the same model face, body proportions, hairstyle, garment identity, colors, prints and accessories. Keep photorealistic anatomy and coherent lighting while changing the environment, camera angle and pose into a distinct campaign-ready composition. Do not add text, collage panels or watermark.`,
  },
  MODEL_POSE_FISSION: {
    workflowHint: 'pose-fission',
    instruction: `Create a distinct pose and camera-angle variation of the supplied fashion model. Strictly preserve the same face identity, body proportions, hairstyle, clothing construction, print, fabric, color, accessories and scene style. The pose must be natural, anatomically correct and clearly different from the source. No text, collage or watermark.`,
  },
  ECOMMERCE_HERO: {
    workflowHint: 'ecommerce-hero',
    instruction: `Create a high-conversion ecommerce hero image using the supplied images as the only product source of truth. Preserve exact SKU identity, geometry, color, material, logo, labels, details and product count. Build a clean premium commercial composition with a clear focal hierarchy, believable lighting and platform-safe negative space. Never invent claims or alter packaging text. No watermark or unrelated products.`,
  },
  IMAGE_CLEAN: {
    workflowHint: 'main-angle-lock',
    instruction: `Rebuild the supplied product image as a polished high-resolution ecommerce main image. Preserve exact product identity, silhouette, construction, color, material, logo, print, camera angle and count. Improve edge quality, texture, tonal separation, lighting and overall commercial finish while removing compression artifacts and distracting defects. Do not redesign, duplicate or replace the product.`,
  },
};

type ImageAgentSkillId = keyof typeof IMAGE_SKILL_PROMPTS;

const isImageAgentSkillId = (skillId: AgentSkillId): skillId is ImageAgentSkillId =>
  skillId !== 'UNIVERSAL_TRY_ON' && skillId !== 'PRODUCT_VIDEO';

const parseImageSource = async (asset: AgentSkillAsset): Promise<ApiImage> => {
  const response = await fetch(asset.src);
  if (!response.ok) throw new Error(`无法读取素材「${asset.title}」`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error(`素材「${asset.title}」不是有效图片`);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法解析素材「${asset.title}」`));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
  return { base64, mimeType: blob.type, sourceUrl: asset.src };
};

const resolveImageRatio = (value: string): AspectRatio => {
  const supported = Object.values(AspectRatio).find((ratio) => ratio === value);
  return supported || AspectRatio.PORTRAIT_3_4;
};

const resolveImageResolution = (value: string): ImageResolution => {
  const normalized = value.toUpperCase();
  return Object.values(ImageResolution).find((resolution) => resolution === normalized)
    || ImageResolution.RES_2K;
};

const resolveImageModel = (value: string) => {
  if (value.includes('Banana Pro')) return 'gemini-3-pro-image-preview';
  if (value.includes('GPT Image')) return 'gpt-image-2';
  if (value.includes('Midjourney')) return 'mj_imagine';
  return 'gemini-3.1-flash-image-preview';
};

const resolveVideoModel = (value: string) => {
  if (value.toLowerCase().includes('seedance')) return 'seedance-2.0';
  if (value.toLowerCase().includes('veo')) return 'veo-3.1-generate-preview';
  return 'seedance-2.0';
};

const requireAssets = (assets: AgentSkillAsset[]) => {
  if (!assets.length) throw new Error('请先在聊天框上传参考图，或从画布将图片添加到 Agent。');
};

const executeUniversalTryOn = async (
  input: AgentSkillExecutionInput,
  images: ApiImage[],
): Promise<AgentSkillResult[]> => {
  const productSources = images.length > 1 ? [images[0], ...images.slice(2)] : images;
  const productImages: UniversalTryOnProductImage[] = productSources.map((image) => ({
    base64: image.base64,
    mime: image.mimeType,
    role: 'full',
  }));
  const modelReference = images[1]
    ? { base64: images[1].base64, mime: images[1].mimeType }
    : null;
  const results = await generateUniversalTryOn(
    productImages,
    modelReference,
    'model',
    input.prompt,
    {
      aspectRatio: resolveImageRatio(input.preferences.imageRatio),
      resolution: resolveImageResolution(input.preferences.imageResolution),
      count: 1,
      model: resolveImageModel(input.preferences.imageModel),
      lockCropping: Boolean(modelReference),
    },
  );
  return results.map((url, index) => ({ url, mediaType: 'image', title: `${input.skillTitle}-${index + 1}` }));
};

const executeProductVideo = async (
  input: AgentSkillExecutionInput,
  images: ApiImage[],
): Promise<AgentSkillResult[]> => {
  const prompt = `Create a concise premium ecommerce product showcase video. Preserve the exact product identity, geometry, colors, materials, logo and packaging details from the reference images. Use smooth intentional camera movement, realistic physical motion, coherent lighting, clean transitions and a strong hero ending. No invented text, product deformation, duplicate products or watermark.\n\nUSER DIRECTION:\n${input.prompt}`;
  const response = await generateVideo(
    prompt,
    resolveVideoModel(input.preferences.videoModel),
    {
      aspectRatio: input.preferences.videoRatio === '9:16' ? '9:16' : '16:9',
      resolution: input.preferences.videoResolution,
      duration: Number.parseInt(input.preferences.videoDuration, 10) || 5,
      count: 1,
      generateAudio: true,
      generationMode: 'CHARACTER_REF',
    },
    images[0]?.sourceUrl,
    undefined,
    images.map((image) => image.sourceUrl),
  );
  return [{
    url: response.uri,
    mediaType: response.isFallbackImage ? 'image' : 'video',
    title: input.skillTitle,
  }];
};

const executeImageSkill = async (
  input: AgentSkillExecutionInput,
  images: ApiImage[],
): Promise<AgentSkillResult[]> => {
  if (!isImageAgentSkillId(input.skillId)) {
    throw new Error(`技能「${input.skillTitle}」没有可用的图像执行配置。`);
  }
  const config = IMAGE_SKILL_PROMPTS[input.skillId];
  const orderedImages = input.skillId === 'SINGLE_ITEM_TRY_ON' && images.length > 1
    ? [images[1], images[0], ...images.slice(2)]
    : images;
  const prompt = `${config.instruction}\n\nUSER DIRECTION:\n${input.prompt}`;

  if (input.skillId === 'RETOUCHING') {
    const batches = await Promise.all(orderedImages.map((image) => generateImageToImage(
      [{ base64: image.base64, mimeType: image.mimeType }],
      prompt,
      {
        aspectRatio: resolveImageRatio(input.preferences.imageRatio),
        resolution: resolveImageResolution(input.preferences.imageResolution),
        modelId: resolveImageModel(input.preferences.imageModel),
        workflowHint: config.workflowHint,
      },
    )));
    return batches.flat().map((url, index) => ({ url, mediaType: 'image', title: `${input.skillTitle}-${index + 1}` }));
  }

  const results = await generateImageToImage(
    orderedImages.map((image) => ({ base64: image.base64, mimeType: image.mimeType })),
    prompt,
    {
      aspectRatio: resolveImageRatio(input.preferences.imageRatio),
      resolution: resolveImageResolution(input.preferences.imageResolution),
      modelId: resolveImageModel(input.preferences.imageModel),
      workflowHint: config.workflowHint,
      hasModelRef: ['SINGLE_ITEM_TRY_ON', 'MODEL_SCENE_FISSION', 'MODEL_POSE_FISSION'].includes(input.skillId),
      sampleCount: 1,
    },
  );
  return results.map((url, index) => ({ url, mediaType: 'image', title: `${input.skillTitle}-${index + 1}` }));
};

export const executeAgentSkill = async (input: AgentSkillExecutionInput): Promise<AgentSkillResult[]> => {
  requireAssets(input.assets);
  input.onProgress?.('正在读取并校验参考素材…');
  const images = await Promise.all(input.assets.map(parseImageSource));

  input.onProgress?.(input.skillId === 'PRODUCT_VIDEO'
    ? '正在调用创意中心视频生成引擎…'
    : '正在调用创意中心图像生成引擎…');

  const results = input.skillId === 'UNIVERSAL_TRY_ON'
    ? await executeUniversalTryOn(input, images)
    : input.skillId === 'PRODUCT_VIDEO'
      ? await executeProductVideo(input, images)
      : await executeImageSkill(input, images);

  if (!results.length) throw new Error('生成服务未返回可用结果，请重试。');

  input.onProgress?.('生成完成，正在写入项目历史并插入画布…');
  const projectType = input.skillId === 'PRODUCT_VIDEO'
    ? 'VIDEO'
    : input.skillId === 'RETOUCHING'
      ? 'RETOUCHING'
      : input.skillId === 'MODEL_SCENE_FISSION'
        ? 'MODEL_SCENE_FISSION'
        : input.skillId === 'MODEL_POSE_FISSION'
          ? 'MODEL_POSE_FISSION'
          : 'MODEL';
  await saveGeneratedProject({
    type: projectType,
    generated: results.map((result) => result.url),
    original: input.assets.map((asset) => asset.src),
    prompt: input.prompt,
    params: { skillId: input.skillId, ...input.preferences },
  });

  return results;
};
