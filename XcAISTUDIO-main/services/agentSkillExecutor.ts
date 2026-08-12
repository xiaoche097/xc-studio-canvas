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
  | 'SCENE_GENERATION'
  | 'UNIVERSAL_TRY_ON'
  | 'SINGLE_ITEM_TRY_ON'
  | 'RETOUCHING'
  | 'PRODUCT_VIDEO'
  | 'MODEL_SCENE_FISSION'
  | 'MODEL_POSE_FISSION'
  | 'ECOMMERCE_HERO'
  | 'IMAGE_CLEAN'
  | 'REFERENCE_EDIT';

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
  SCENE_GENERATION: {
    workflowHint: 'scene-product-lock',
    instruction: '',
  },
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
    instruction: `[ROLE: Senior Fashion Model & Commercial Scene Fission Director]
Transform the reference model into a campaign-ready commercial fashion photoshoot fission.
STRICT SCENE ENVIRONMENT CONSISTENCY (HIGHEST PRIORITY): Lock and maintain the reference image's background scene environment (architectural style, stone facade, color palette, daylight, and ambient mood). All variations MUST remain inside or around this SAME consistent environment. DO NOT switch to unrelated indoor stores, cafes, sofa living rooms, beaches, dusk streets, or plain studio walls.
STRICT IDENTITY & OUTFIT LOCK: Lock the exact model face features, body proportions, hairstyle, skin tone, and complete outfit identity (garment cut, fabric, color, prints, handbag, footwear, and accessories).
DYNAMIC UN-FIXED POSES & ANGLES MANDATE: Every generation MUST be unique and non-templated. Dynamically vary body poses, head directions, torso rotations, camera angles (high/low/profile/front), and framings (close-up/waist/full-body/detail) within the SAME scene environment. Do not add text, captions, or watermark.`,
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
  REFERENCE_EDIT: {
    workflowHint: 'face-lock',
    instruction: `Perform one precise edit on Image 1 according to the USER DIRECTION. Image 1 is the immutable source of truth for every element not explicitly targeted. Preserve the exact subject identity, face, body proportions, product or garment structure, materials, colors, logos, readable text, background, lighting, camera angle, subject scale, placement and crop unless the user directly requests that specific attribute to change. Make the requested change clearly visible, localized, anatomically and physically plausible, and seamlessly integrated. Output one edited image only, never a collage, comparison, caption or watermark.`,
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
  if (['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'imagen-3.0-generate-002'].includes(value)) return value;
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
  const isSceneGeneration = input.skillId === 'SCENE_GENERATION';
  const isSingleCompositeSceneReference = isSceneGeneration && images.length === 1;
  const sceneReference = isSceneGeneration && !isSingleCompositeSceneReference ? images[1] : undefined;
  const modelReference = isSceneGeneration
    ? (isSingleCompositeSceneReference ? images[0] : images[2])
    : undefined;
  const productImages = isSceneGeneration
    ? (isSingleCompositeSceneReference
        ? [images[0]]
        : [images[0], ...images.slice(3)]
      ).filter((image): image is ApiImage => Boolean(image))
    : [];
  const orderedImages = isSceneGeneration
    ? [
        ...productImages,
        ...(modelReference ? [modelReference, modelReference] : []),
        ...(sceneReference ? [sceneReference] : []),
      ]
    : input.skillId === 'SINGLE_ITEM_TRY_ON' && images.length > 1
      ? [images[1], images[0], ...images.slice(2)]
      : images;
  const productRange = productImages.length > 1 ? `Images 1-${productImages.length}` : 'Image 1';
  const modelIndex = modelReference ? productImages.length + 1 : null;
  const modelDuplicateIndex = modelReference ? productImages.length + 2 : null;
  const sceneIndex = sceneReference ? productImages.length + (modelReference ? 3 : 1) : null;
  const sceneInstruction = isSceneGeneration ? `Create one premium photorealistic commercial scene image.

REFERENCE MAP
- ${productRange}: PRODUCT IDENTITY. These images show one identical SKU and are the highest-priority source for exact silhouette, construction, color, material, texture, print, buttons, trims, logo and proportions.
${modelReference ? `- Images ${modelIndex}-${modelDuplicateIndex}: SELECTED MODEL IDENTITY. They intentionally repeat the same model for stronger identity weight. Use this person as the sole source for face, facial structure, hairstyle, hair color, skin tone/texture, age impression and body proportions. Ignore the model reference's clothing, accessories, pose, gaze, background and lighting.` : '- No selected model reference is supplied. Use a natural adult commercial model appropriate for the product.'}
${sceneReference ? `- Image ${sceneIndex}: SCENE AND PERFORMANCE ANCHOR. Reproduce its recognizable location, spatial layout, surfaces, season/weather, light direction, color temperature and atmosphere. Transfer the reference person's gaze direction, attention target, head turn/tilt, expression energy, shoulder line and candid body rhythm onto the selected model. Never copy that person's identity, clothing, bag, jewelry, sunglasses, text or logo.` : '- No scene reference is supplied. Design a believable lifestyle environment from the user direction.'}

SUBJECT
The target product must remain unmistakably the same SKU and fit with natural scale, gravity, folds, occlusion and contact. ${modelReference ? 'The selected model identity is mandatory and must not drift.' : ''}

ACTION AND ENVIRONMENT
${sceneReference ? 'Preserve the scene identity and performance cues while adapting limbs only for garment fit and physical plausibility.' : 'Use candid, relaxed body language and a purposeful gaze; avoid a centered catalog stance.'} The pose must feel observed in a real moment, not directed into a passport photo.

STYLE
Realistic premium commercial photography, natural skin pores, tactile materials, coherent directional light, layered depth and crisp product focus. No added text, watermark, collage or border.

AVOID
Wrong SKU, altered garment structure/color/material, face drift, identity blending, stiff front-facing catalog pose, forced direct eye contact, blank expression, mannequin posture, bad anatomy, malformed hands, extra limbs, plastic skin or CGI.${modelReference ? ' Do not add glasses, sunglasses, jewelry, watch, hat, bag, scarf, gloves, phone, cup or handheld props unless the target product itself is that item.' : ''}` : '';
  const qualityEnhancement = `\n\nIMAGEN 3.0 QUALITY SPECIFICATION:\n- Professional commercial photography, editorial studio lighting, ultra-realistic texture, crisp focus, 8k resolution, photorealistic masterwork.\n- Negative Constraints: Avoid bad anatomy, distorted hands/fingers, blurry edges, extra limbs, noise artifacts, low resolution, watermark, unintended text blur.`;
  const usesConciseReferenceDirection = input.skillId === 'MODEL_POSE_FISSION'
    || input.skillId === 'REFERENCE_EDIT';
  const prompt = isSceneGeneration
    ? `${sceneInstruction}\n\nUSER DIRECTION:\n${input.prompt}`
    : usesConciseReferenceDirection
      ? input.prompt
      : `${config.instruction}\n\nUSER DIRECTION:\n${input.prompt}${qualityEnhancement}`;

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
      hasModelRef: ['SCENE_GENERATION', 'SINGLE_ITEM_TRY_ON', 'MODEL_SCENE_FISSION', 'MODEL_POSE_FISSION'].includes(input.skillId)
        && (!isSceneGeneration || Boolean(modelReference)),
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
      : input.skillId === 'SCENE_GENERATION'
        ? 'MARKETING'
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
