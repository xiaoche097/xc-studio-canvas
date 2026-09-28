import { generateImageWithProvider } from '../providers';
import { generateImage } from '../gemini';
import { ImageGenSkillParams } from '../../types/skill.types';

export async function imageGenSkill(params: ImageGenSkillParams): Promise<string | null> {
  let enhancedPrompt = params.prompt;
  const normalizedReferenceImage =
    params.referenceImage ||
    params.referenceImageUrl ||
    params.reference_image_url ||
    params.initImage ||
    params.init_image;

  if (params.brandContext?.colors?.length) {
    enhancedPrompt += `, color palette: ${params.brandContext.colors.join(', ')}`;
  }

  if (params.brandContext?.style) {
    enhancedPrompt += `, style: ${params.brandContext.style}`;
  }

  if (params.consistencyContext?.referenceSummary) {
    enhancedPrompt += `\n\nConsistency anchor: ${params.consistencyContext.referenceSummary}`;
  }

  if (params.consistencyContext?.forbiddenChanges?.length) {
    enhancedPrompt += `\nDo not change: ${params.consistencyContext.forbiddenChanges.join(', ')}`;
  }

  const request = {
    prompt: enhancedPrompt,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize || '2K',
    referenceImage: normalizedReferenceImage,
    referenceImages: params.referenceImages,
    referenceStrength: params.referenceStrength,
    referencePriority: params.referencePriority,
    referenceMode: params.referenceMode,
    maskImage: params.maskImage,
  };

  // 画布侧栏、Agent 与 Skills 共用同一入口：用户启用 Virse 后，
  // 无论当前 UI 选择了哪个旧模型别名，都必须先进入 Virse 路由。
  const virseEnabled =
    typeof window !== 'undefined' &&
    window.localStorage.getItem('virse_enabled') === 'true';
  if (virseEnabled) {
    return generateImage({
      ...request,
      model: params.model as any,
    });
  }

  return generateImageWithProvider(request, params.model);
}
