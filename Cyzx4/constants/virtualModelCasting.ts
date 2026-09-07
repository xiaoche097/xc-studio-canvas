export const DEFAULT_MODEL_PERSON = '欧美模特';

type CastingSettings = { source: 'ai' | 'reference'; person: string; faceDirection?: string };

export const useTextOnlyModelPresets = (settings: CastingSettings) => (
  settings.source === 'ai' && settings.person.startsWith('欧美')
);

export const modelFaceDirection = (settings: CastingSettings) => (
  settings.source === 'reference' ? settings.faceDirection
    : useTextOnlyModelPresets(settings) ? '欧美／欧洲面孔方向' : `${settings.person}选角方向`
);

export const modelCastingBrief = (settings: CastingSettings) => {
  if (!useTextOnlyModelPresets(settings)) return '';
  return 'CASTING REQUIREMENT: Create a new fictional model with a European / Western facial appearance, as explicitly requested. This is the subject casting requirement, not merely Western clothing, makeup or photography. Keep individually distinctive facial proportions, naturally defined brow and orbital depth, a defined nasal bridge and projection, and coherent cheek and jaw structure. Preserve realistic variation rather than exaggerating features or forcing every person to have blonde hair and blue eyes. Mood, age, lighting and pose examples must never replace the requested facial appearance. Keep the approved face consistent across all images. The selected age and gender remain authoritative.';
};
