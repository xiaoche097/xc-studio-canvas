import { generateVideoWithProvider } from '../providers';
import { VideoGenSkillParams } from '../../types/skill.types';

export async function videoGenSkill(params: VideoGenSkillParams): Promise<string | null> {
  return generateVideoWithProvider(
    {
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      startFrame: params.startFrame,
      endFrame: params.endFrame,
      referenceImages: params.referenceImages,
    },
    params.model
  );
}
