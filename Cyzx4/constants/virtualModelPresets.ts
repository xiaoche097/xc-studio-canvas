import { BASE_OUTFIT, referenceDirection } from './virtualModelPlan';
export type ModelPresetKind = 'person' | 'style' | 'age' | 'scope' | 'actions' | 'photography';
export type ModelPreset = { label: string; description: string; guidance: string; child?: boolean };
export const MODEL_PRESETS: Record<ModelPresetKind, { title: string; image: string; columns: number; rows: number; items: ModelPreset[] }> = {
  scope: { title: '选择生成范围', image: './virtual-model/scopes.png', columns: 2, rows: 2, items: [
    { label: '全身模特', description: '从头到脚入镜', guidance: '完整头顶到脚底入镜，保留边距，不裁切四肢。' },
    { label: '半身模特', description: '腰部以上取景', guidance: '腰部以上构图，保留完整头部，合理安排双手。' },
    { label: '面部模特', description: '头像 / 特写', guidance: '头部与面部近景，保持五官、发际线与真实皮肤细节。' },
    { label: '试戴部位', description: '耳、手、颈等局部', guidance: '仅取指定耳、手、颈或脚部，突出解剖结构与佩戴空间，不替换为全身。' },
  ] },
  actions: { title: '选择动作（多选）', image: './virtual-model/actions.png', columns: 3, rows: 3, items: [
    { label: '自然站立', description: '放松、自然', guidance: '自然站立，重心稳定，双臂放松。' },
    { label: '插兜', description: '轻松、利落', guidance: '单手或双手自然插兜，衣物受力合理。' },
    { label: '行走', description: '轻快步态', guidance: '自然迈步，手臂轻摆，保持人体平衡。' },
    { label: '坐姿', description: '从容、放松', guidance: '自然坐在简约座椅上，四肢结构与支撑关系准确。' },
    { label: '回头', description: '回眸、转身', guidance: '身体侧背向镜头，头部自然回转，避免过度扭颈。' },
    { label: '看镜头', description: '正视镜头', guidance: '正视镜头，表情自然，目光聚焦。' },
    { label: '奔跑', description: '动态、有活力', guidance: '自然奔跑瞬间，肢体运动协调，服装呈合理动态。' },
    { label: '跳跃', description: '轻盈、舒展', guidance: '轻盈跳起，四肢舒展，身体重心和衣物动态合理。' },
    { label: '伸懒腰', description: '舒展、松弛', guidance: '双臂自然向上伸展，肩颈放松，保留完整关节。' },
  ] },
  photography: { title: '选择摄影风格', image: './virtual-model/photography.png', columns: 3, rows: 3, items: [
    { label: '电商白底', description: '干净白底、商品主图', guidance: '纯白无缝背景，均匀真实布光，清晰呈现人物与商品。' },
    { label: '极简纯色', description: '低干扰背景', guidance: '统一低饱和纯色背景，无多余装饰，主体轮廓清楚。' },
    { label: '柔光棚拍', description: '柔和布光、肤质友好', guidance: '大面积柔光，柔和阴影，保留真实皮肤纹理。' },
    { label: '轻奢', description: '精致、轻贵气', guidance: '暖中性色背景与细腻层次光，克制材质与精致造型。' },
    { label: '杂志感', description: '大片构图与光影', guidance: '时装杂志构图，方向性布光与清晰光影，但不改变指定取景范围。' },
    { label: '自然生活感', description: '日常场景、松弛', guidance: '可信日常室内环境，自然窗光，生活化表情与姿态。' },
    { label: '韩系氛围', description: '清透、氛围柔', guidance: '通透柔光、浅色背景、低饱和画面，细腻轻盈氛围。' },
    { label: '儿童棚拍', description: '童趣、明亮棚拍', guidance: '明亮柔光与简洁童趣背景。所选人物为儿童时使用适龄童装和姿势；成年人物或上传成人参考仅采用明亮背景与柔光，不变成儿童。' },
  ] },
  person: { title: '选择人物类型', image: './virtual-model/types.png', columns: 5, rows: 3, items: [
    { label: '中国女生', description: '自然、亲和', guidance: '虚构中国成年女性选角，自然妆发与真实肤质。' },
    { label: '中国男生', description: '清爽、利落', guidance: '虚构中国成年男性选角，整洁发型、自然身形与真实肤质。' },
    { label: '中国小女孩', description: '童真、灵动', guidance: '虚构中国女孩，约6–10岁，童装与自然儿童表情。', child: true },
    { label: '中国小男孩', description: '阳光、活泼', guidance: '虚构中国男孩，约6–10岁，日常童装与自然儿童姿态。', child: true },
    { label: '韩系女生', description: '柔和、精致', guidance: '韩系时装选角方向的成年女性，柔和妆发与简洁造型。' },
    { label: '韩系男生', description: '干净、时髦', guidance: '韩系时装选角方向的成年男性，轻盈发型和干净造型。' },
    { label: '韩系小女孩', description: '清新、可爱', guidance: '约6–10岁女孩，韩系简洁童装、自然发型，不使用成人妆容。', child: true },
    { label: '韩系小男孩', description: '清爽、童真', guidance: '约6–10岁男孩，韩系简洁童装与轻松儿童姿态。', child: true },
    { label: '日系女生', description: '轻盈、生活感', guidance: '日系时装选角方向的成年女性，轻盈层次发型、生活化妆感。' },
    { label: '日系男生', description: '松弛、层次感', guidance: '日系时装选角方向的成年男性，自然层次发型、松弛造型。' },
    { label: '欧美模特', description: '欧美面孔、时装选角', guidance: '创建欧美／欧洲面孔方向的新虚构成年女性模特；用户明确指定男性时采用男性。面孔方向是人物外貌要求，不仅是服装或摄影风格。保留自然眉眼深度、鼻部投影与颧颌轮廓及个体差异，不套用示例图人物的脸或性别。' },
    { label: '欧美小女孩', description: '自然、明快', guidance: '欧美童装选角方向，约6–10岁女孩，日常童装与自然儿童表情。', child: true },
    { label: '欧美小男孩', description: '活力、自然', guidance: '欧美童装选角方向，约6–10岁男孩，日常童装与自然儿童姿态。', child: true },
    { label: '混血感', description: '多元、鲜明', guidance: '多元商业选角审美，以示例的卷发、肤色和脸部轮廓作为可见外观灵感；不推断真实人物血统。' },
    { label: '高奢超模', description: '鲜明、镜头感', guidance: '成年高级时装模特方向，鲜明轮廓、利落发型、克制表情和专业站姿。' },
  ] },
  style: { title: '选择风格倾向', image: './virtual-model/styles.png', columns: 3, rows: 3, items: [
    { label: '自然感', description: '日常亲和、少修饰', guidance: '轻妆或无妆、真实皮肤纹理、柔和自然光、亲和表情。' },
    { label: '甜美', description: '柔和、少女感', guidance: '柔和配色、轻盈发饰与亲切表情；少女感指审美氛围，不改变成年人物实际年龄。' },
    { label: '元气', description: '活泼、有精神', guidance: '明快配色、自然笑容、轻快姿态与通透光线。' },
    { label: '清冷', description: '疏离、干净', guidance: '冷静表情、低饱和配色、干净背景、冷调柔光。' },
    { label: '高级感', description: '克制、质感', guidance: '简约高质感服装、克制妆发、精确轮廓光与低饱和背景。' },
    { label: '轻熟', description: '知性、不过分甜', guidance: '知性造型、柔和中性色与稳重姿态；不以暴露服装表达成熟。' },
    { label: '酷感', description: '利落、个性', guidance: '利落线条、个性发型、明确眼神、适度对比光。' },
    { label: '高奢', description: '精致、贵气', guidance: '精致服装材质、克制配饰、细腻布光与高级时装构图。' },
    { label: '慵懒', description: '松弛、随性', guidance: '宽松日常服装、自然发丝、舒展放松的姿态与柔光。' },
  ] },
  age: { title: '选择年龄气质', image: './virtual-model/ages.png', columns: 3, rows: 2, items: [
    { label: '儿童感', description: '童真、活泼', guidance: '约6–10岁，真实儿童头身比例、童装、无成人妆容与自然姿态。', child: true },
    { label: '少女感', description: '青春、柔美', guidance: '成年18–22岁年轻气质，青春柔美、清新日常造型；男性对应少年般清爽气质，不改变性别。' },
    { label: '年轻感', description: '清爽、有活力', guidance: '成年约22–28岁，清爽活力、自然肤质与轻盈姿态。' },
    { label: '轻熟感', description: '稳重中带柔', guidance: '成年约28–35岁，温和稳重、知性造型和真实成年面部特征。' },
    { label: '成熟感', description: '气场、沉稳', guidance: '成年约35–50岁，沉稳气场、自然年龄纹理与从容姿态，避免过度磨皮。' },
  ] },
};
export const getModelPreset = (kind: ModelPresetKind, label: string) => MODEL_PRESETS[kind].items.find(item => item.label === label) || MODEL_PRESETS[kind].items[0];
export const isChildModel = (person: string) => Boolean(getModelPreset('person', person).child);
export function presetBackground(kind: ModelPresetKind, label: string) {
  const group = MODEL_PRESETS[kind];
  const index = Math.max(0, group.items.findIndex(item => item.label === label));
  return { backgroundImage: `url("${group.image}")`, backgroundSize: `${group.columns * 100}% ${group.rows * 100}%`, backgroundPosition: `${(index % group.columns) / (group.columns - 1) * 100}% ${Math.floor(index / group.columns) / (group.rows - 1) * 100}%` };
}

type AdaptationSettings = { referenceMode?: 'single' | 'fusion'; fusionBias?: string; source: 'ai' | 'reference'; person: string; style: string; age: string; scope: string; part?: string; actions?: string[]; photography: string; notes: string };
export function modelRequestSettings<T extends AdaptationSettings>(settings: T) {
  if (settings.source !== 'reference') return settings;
  const { person, style, age, ...referenceSettings } = settings;
  return referenceSettings;
}
export function modelAdaptationBrief(settings: AdaptationSettings) {
  const person = getModelPreset('person', settings.person), style = getModelPreset('style', settings.style), age = getModelPreset('age', settings.age);
  return [
    '参考分工与适配规则（必须执行）：',
    settings.source === 'reference' ? '人物外貌参考：用户上传人像。提取外貌与气质，创造有相似感的新虚构人物，不复制原身份或服装，也不得从照片推断国籍或血统。' : `人物类型：${person.label}。${person.guidance} 类型参考只提供选角方向，创建新的虚构身份，不原样复制参考人物。`,
    ...(settings.source === 'reference' ? [
      '参考人像模式不使用人物类型、风格或年龄预设。逐张分析用户提供的1–5张图片：脸部轮廓、五官、发型发色、肤色与纹理、可见年龄气质、体态与自然妆发（排除服装和配饰）；区分真实稳定特征与角度、表情、光线造成的差异。',
      referenceDirection(settings.referenceMode, settings.fusionBias),
      '从用户参考归纳年龄气质与造型，保持人物实际年龄呈现，不套用任何历史预设。参考为儿童时使用适龄童装、自然妆发及儿童姿态。摄影风格只调整背景与光影，不更换人物身份或年龄。',
    ] : [
      `风格参考：${style.label}（${style.description}）。${style.guidance} 只提取妆发、配色、材质、表情与布光，不复制示例的性别、脸和年龄。`,
      `年龄气质：${age.label}（${age.description}）。${age.guidance} 年龄图仅作气质与年龄表现示意，不复制示例人物的性别、脸或服装。`,
      person.child ? '儿童适配优先：保持6–10岁儿童身份，所有风格转译为适龄童装、自然发型、童真表情与非成人化姿态；轻熟/高奢只体现服装材质与布光，不使用成熟妆容或成人体态。' : '成人类型不得因甜美、少女感或参考示例而变成儿童。',
    ]),
    `取景适配：${settings.scope}${settings.scope === '试戴部位' ? `（${settings.part || '耳部'}）` : ''}。${['手部', '耳部', '脚部', '颈部', '试戴部位'].includes(settings.scope) ? '将年龄特征、肤色、皮肤纹理与风格迁移到指定部位，优先结构准确与商业展示，不生成整个人像替代部位。动作需转译为局部姿态或轻微角度变化，不能为了表现奔跑、跳跃、插兜而扩展为全身或隐藏目标部位；在方案中逐项说明转译结果。' : getModelPreset('scope', settings.scope).guidance}`,
    `动作适配：${(settings.actions || []).map(action => `${action}：${getModelPreset('actions', action).guidance}`).join('；')}。动作参考只控制姿态，不复制性别、衣服、年龄或背景。面部模特仅体现表情、头颈角度与动态气氛，不扩大为全身。`,
    `摄影场景：${settings.photography}。${getModelPreset('photography', settings.photography).guidance} 摄影参考只控制布光、背景和构图氛围，不更换人物身份、性别与年龄。补充要求：${settings.notes || '无'}。协调风格与场景，不覆盖用户指定背景。`,
    settings.source === 'reference' ? '冲突处理顺序：统一基础着装 > 新人物设定与年龄 > A/B参考采用方向 > 摄影与动作示例。说明参考图之间的差异与采用结果。' : '冲突处理顺序：所选人物类型 > 年龄气质 > 风格示例。明确指出不兼容的组合及实际采用的适配结果。',
    `基础着装最高优先级：${BASE_OUTFIT}`,
    '输出适配结论而非笼统形容词：说明人物设定、妆发服装、动作表现、光线背景如何匹配；固定发色、发型、肤色、服装及年龄以维持跨动作一致性。',
  ].join('\n');
}

const referenceCache = new Map<string, Promise<{ base64: string; mimeType: string }>>();
export function loadPresetReference(kind: ModelPresetKind, label: string) {
  const key = `${kind}:${label}`;
  if (!referenceCache.has(key)) {
    const promise = new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
      const group = MODEL_PRESETS[kind];
      const index = Math.max(0, group.items.findIndex(item => item.label === label));
      const image = new Image();
      image.onload = () => {
        try {
          const width = image.naturalWidth / group.columns, height = image.naturalHeight / group.rows;
          const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 384;
          const context = canvas.getContext('2d'); if (!context) throw new Error('无法读取参考图');
          context.drawImage(image, (index % group.columns) * width, Math.floor(index / group.columns) * height, width, height, 0, 0, 384, 384);
          resolve({ base64: canvas.toDataURL('image/jpeg', .9).split(',')[1], mimeType: 'image/jpeg' });
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error(`${group.title}参考图加载失败，请刷新后重试`));
      image.src = group.image;
    });
    referenceCache.set(key, promise);
    void promise.catch(() => referenceCache.delete(key));
  }
  return referenceCache.get(key)!;
}
