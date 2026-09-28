export const BASE_OUTFIT = '纯白合身圆领T恤＋白色短裤，不透、不紧身，无图案、文字、Logo，无首饰及包。所有取景统一着装，面部仅露出自然可见的白T衣领，不为展示服装扩大取景。此规则优先于参考服装、预设和补充说明。';
export const FACE_VIEWS = ['正面', '左侧面', '右45°', '微抬头'];
export const FACE_SHEET_LAYOUT = 'Generate exactly ONE image containing a 2x2 casting contact sheet of the SAME fictional model, not four different people. Top-left: front view; top-right: left profile; bottom-left: right three-quarter (45 degree) view; bottom-right: slightly raised chin. Four equal panels from the same short portrait sitting, with consistent head scale, lighting setup, background, haircut and identity. Allow subtle natural variation in eyelid tension, gaze, relaxed lips and loose hair strands between exposures; do not freeze or copy-paste the expression. Show head-and-shoulders portraits and the white T-shirt collar in every panel. No text, labels, watermark or decorative border. The requested aspect ratio applies to the entire sheet. This four-panel layout takes priority over any single-portrait or single-action instruction in the plan.';
export const NATURAL_CASTING = `PHOTOGRAPHIC TREATMENT — natural agency casting digitals, a believable person present in front of a camera, before beauty retouching. This treatment overrides beautification and frozen-expression instructions in the appearance description, while preserving the requested identity, apparent age, framing, background and wardrobe.
Keep individual facial character and subtle left-right asymmetry in brows, eyelids and lips. Do not idealize every feature or average the face into a perfectly balanced beauty template.
Bare-skin appearance with minimal invisible makeup: regional variation in skin tone and texture, delicate under-eye folds appropriate to the stated age, a little natural redness and uneven lip tone. Pores are subtle and vary across the face, not a uniform sharp texture overlay. Do not add conspicuous blemishes, exaggerated wrinkles or years of age to simulate realism.
Relaxed jaw and lips resting comfortably, attentive eyes focused on something real, small natural differences between expressions. Not a fixed beauty-advertisement stare or identical clamped lips in every view. No forced smile.
Hair falls with gravity in irregular locks, a few fine flyaways and slightly uneven volume; no perfectly sculpted repeated waves. Plain cotton clothing has ordinary soft folds.
Use a broad soft key light slightly off-axis with gentle fill, leaving soft cheek, nose and chin shadows. Preserve the chosen background; a white background does not require a shadowless, evenly glowing face. Restrained highlights and natural optical sharpness, no HDR halos, exaggerated microcontrast, glossy contouring, lip gloss, skin smoothing, waxy sheen or CGI finish.`;
export const PLAN_FIELDS = [
  ['direction', '新人物方向'], ['age', '外观年龄段'], ['face', '脸型与骨相'],
  ['eyes', '眼睛'], ['noseLips', '鼻唇'], ['skin', '肤色与真实肤质'],
  ['hair', '发型发色'], ['mood', '人物气质'], ['build', '体型与比例'],
  ['references', '参考采用依据'], ['photography', '取景与光线'],
] as const;
export type ModelPlan = Record<typeof PLAN_FIELDS[number][0], string>;
export function parseModelPlan(raw: string): ModelPlan {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value: unknown;
  try { value = JSON.parse(cleaned); } catch { throw new Error('人物方案格式不完整，请重新分析。'); }
  if (!value || typeof value !== 'object' || PLAN_FIELDS.some(([key]) => typeof (value as ModelPlan)[key] !== 'string' || !(value as ModelPlan)[key].trim())) throw new Error('人物方案缺少必要特征，请重新分析。');
  return Object.fromEntries(PLAN_FIELDS.map(([key]) => [key, (value as ModelPlan)[key].trim()])) as ModelPlan;
}
export function modelPlanPrompt(plan: ModelPlan, faceDirection?: string): string {
  return ['Photograph a newly designed fictional model in a natural casting session. No illustration, text or watermark.', ...PLAN_FIELDS.filter(([key]) => key !== 'references').map(([key, label]) => `${label}: ${plan[key]}`), faceDirectionBrief(faceDirection), NATURAL_CASTING, `统一基础着装: ${BASE_OUTFIT}`].join('\n');
}
export function faceDirectionBrief(direction?: string): string {
  return [direction?.trim() ? `用户明确指定的新虚构模特面孔方向：${direction.trim()}。这是生成目标，不是对参考人物种族、国籍或血统的判断。按此方向结合参考中的具体可见特征创作，不用地域标签覆盖个体差异。` : '面孔方向跟随用户参考的可见结构，不自动推断或添加人物种族、国籍或血统标签。', '保留有辨识度的脸部纵横比例、眉骨与眼窝深度、眼睑形态、鼻根高度与鼻部投影、颧骨及下颌结构；只描述图片中有依据的特征。新身份不等于改变整体面孔方向，融合不等于将这些结构平均化为通用美人模板。'].join('\n');
}
export function referenceDirection(mode?: string, bias?: string) {
  return mode === 'fusion'
    ? `双人物融合：按明确的A/B分组分别分析，再形成一个完整自然的新人物C，融合倾向：${bias || '均衡'}。保留两人的部分视觉特征，但不是换脸、原人物复制或图像叠加。不承诺精确五官继承。`
    : '参考衍生：第1张为主参考，其余为同人物角度补充。提取脸型、五官、骨相、肤色和气质，反推新人物提示词，生成与参考有视觉关联的新虚构人物，不复制原身份。';
}
