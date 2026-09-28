export const DEFAULT_MODEL_PERSON = '欧美模特';

type CastingSettings = { source: 'ai' | 'reference'; person: string; faceDirection?: string };

// Sample only while planning a new identity. Approved plans and pose retries stay stable.
export function modelVariationBrief(settings: CastingSettings, previous?: string, random = Math.random) {
  const axes = [
    ['脸部纵横比例略偏修长', '脸部纵横比例略偏紧凑', '脸部纵横比例自然适中'],
    ['下颌转折较柔和', '下颌转折略清晰', '下巴轮廓略圆润'],
    ['眉形偏平直', '眉形带轻微自然弧度', '眉尾略向上舒展'],
    ['眼裂略修长', '眼裂略圆润', '眼睑带轻微自然不对称'],
    ['鼻尖轮廓略圆润', '鼻尖轮廓略利落', '鼻翼宽度保留自然个性'],
    ['上唇略薄于下唇', '上下唇厚度较接近', '唇峰略柔和'],
  ];
  const variation = axes.map(options => options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))]);
  return [
    '本次新人物变化草案：' + variation.join('；') + '。这些是可调整的个体差异建议，不是地域或性别的固定特征。',
    '用户明确要求、年龄、性别、面孔方向优先；冲突的变化建议应舍弃。将兼容的变化写入具体五官字段，不只更换发型、妆容或形容词。不使用固定地域模板脸。',
    settings.source === 'reference' ? '保留用户参考中有辨识度的结构和A/B融合倾向，在未锁定的细节上适度变化，不覆盖参考核心特征。' : '依据文字选角要求创造新虚构身份，不借用内置示例人物。',
    previous ? `上次人物方案（仅用于避免重复，不作为本次身份锚点）：${previous}。在符合当前要求的前提下，让本次至少两项未锁定五官细节与上次不同。` : '',
    '本次方案确认后，同一组模卡、动作和失败重试均沿用该人物，不再随机更换面孔。',
  ].filter(Boolean).join('\n');
}

export const useTextOnlyModelPresets = (settings: CastingSettings) => (
  settings.source === 'ai'
);

export const modelFaceDirection = (settings: CastingSettings) => (
  settings.source === 'reference' ? settings.faceDirection
    : settings.person.startsWith('欧美') ? '欧美／欧洲面孔方向' : `${settings.person}选角方向`
);

export const modelCastingBrief = (settings: CastingSettings) => {
  if (settings.source !== 'ai' || !settings.person.startsWith('欧美')) return '';
  return 'CASTING REQUIREMENT: Create a new fictional model with a European / Western facial appearance, as explicitly requested. This is the subject casting requirement, not merely Western clothing, makeup or photography. Keep individually distinctive facial proportions, naturally defined brow and orbital depth, a defined nasal bridge and projection, and coherent cheek and jaw structure. Preserve realistic variation rather than exaggerating features or forcing every person to have blonde hair and blue eyes. Mood, age, lighting and pose examples must never replace the requested facial appearance. Keep the approved face consistent across all images. The selected age and gender remain authoritative.';
};
