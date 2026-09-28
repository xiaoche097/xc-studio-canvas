export function modelFraming(scope: string, part = '耳部', sheet = false) {
  const rule = scope === '全身模特'
    ? 'FULL-LENGTH HEAD-TO-TOE photograph. Show the entire head, torso, white shorts, both knees, both lower legs, ankles and both complete feet inside the image. Leave visible background above the hair and floor below the feet, with roughly 5–10% breathing room. Move the camera BACK to fit the whole body, even when the reference is a headshot. Do not crop at waist, hips, thighs, knees or ankles. Do not enlarge the face at the expense of the legs. A waist-up or thigh-up photograph is INVALID.'
    : scope === '半身模特' ? 'WAIST-UP portrait: complete head, shoulders and torso down to the waist. Do not output a face-only close-up or a head-to-toe full-body view.'
    : scope === '面部模特' ? `${sheet ? 'Each of the four panels must be' : 'One'} head-and-shoulders close-up with complete facial features and hairline; no full-body framing.`
    : `Close-up of ${part} only, with the intended anatomical region fully visible, not a full-body photograph.`;
  return `MANDATORY FRAMING — highest priority over the reference crop, pose image, identity anchor and descriptive plan: ${rule} References define appearance, NEVER camera distance or crop. Recompose the image to satisfy this requirement.`;
}
export function framingReviewPrompt(scope: string, part?: string, sheet?: boolean) {
  return `检查实际图片的取景是否合格，不评价漂亮程度。要求：${modelFraming(scope, part, sheet)}。${scope === '全身模特' ? '必须实际看见头顶、双膝、小腿和两只完整脚。只到大腿，即使短裤可见也不合格。不能根据图片以外的想象判定。' : ''}只返回JSON：{"pass":true或false,"reason":"简短中文说明实际可见范围和不合格原因"}。无法判断时pass=false。`;
}
export function parseFramingReview(raw: string): { pass: boolean; reason: string } {
  const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  if (typeof value?.pass !== 'boolean' || typeof value?.reason !== 'string' || !value.reason.trim()) throw new Error('取景检查未返回有效结论');
  return { pass: value.pass, reason: value.reason };
}
