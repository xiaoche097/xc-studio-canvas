import { AppMode } from '../../types';
import type { AgentType } from '../../types/agent.types';

export type CreativeToolName =
  | 'generateImage'
  | 'generateVideo'
  | 'smartEdit'
  | 'analyzeRegion'
  | 'analyzeClothingProduct';

export interface CreativeAgentCapability {
  id: string;
  mode: AppMode;
  title: string;
  purpose: string;
  preferredAgent: AgentType;
  primaryTool: CreativeToolName;
  fallbackTools: CreativeToolName[];
  outputType: 'image' | 'video' | 'analysis';
  requiredInputs: string[];
  attachmentRoles: string[];
  instructions: string[];
  defaults?: Record<string, unknown>;
}

export interface CreativeSkillData {
  id: 'creative-agent-skills';
  name: string;
  capabilities: CreativeAgentCapability[];
  config: {
    forceSkillExecution: boolean;
    preferredAgent?: AgentType;
    twoStep?: boolean;
  };
}

type FeatureSelection = Pick<
  { mode: AppMode; title: string; description: string },
  'mode' | 'title' | 'description'
>;

type CapabilityPreset = Omit<CreativeAgentCapability, 'id' | 'mode' | 'title'>;

const imagePreset = (
  purpose: string,
  instructions: string[],
  attachmentRoles = ['ATTACHMENT_0：主体/产品原图', '其余附件：风格、场景或细节参考图'],
  preferredAgent: AgentType = 'poster',
): CapabilityPreset => ({
  purpose,
  preferredAgent,
  primaryTool: 'generateImage',
  fallbackTools: ['smartEdit'],
  outputType: 'image',
  requiredInputs: ['清晰的创作目标；有附件时必须使用附件作为视觉锚点'],
  attachmentRoles,
  instructions,
  defaults: { referenceStrength: 0.88, referencePriority: 'first' },
});

const editPreset = (
  purpose: string,
  instructions: string[],
  attachmentRoles: string[],
  editType = 'style-transfer',
): CapabilityPreset => ({
  purpose,
  preferredAgent: 'cameron',
  primaryTool: 'smartEdit',
  fallbackTools: ['generateImage'],
  outputType: 'image',
  requiredInputs: ['至少一张待编辑原图', '明确要修改的对象或区域'],
  attachmentRoles,
  instructions,
  defaults: { editType },
});

const CAPABILITY_PRESETS: Record<AppMode, CapabilityPreset> = {
  [AppMode.FUSION]: imagePreset(
    '融合多张参考素材并生成一张完整商业视觉',
    ['识别每张参考图的主体、风格和场景职责', '不得把所有附件当成同一种参考', '输出单一完整画面，除非用户明确要求套图'],
  ),
  [AppMode.PRODUCT_SWAP]: editPreset(
    '保留原场景构图、光影和镜头，只替换指定产品',
    ['以原场景图为 sourceUrl', '把替换产品作为额外参考图', '禁止改变未指定的背景、人物、文字与构图'],
    ['ATTACHMENT_0：需要保留的原场景图', 'ATTACHMENT_1：要换入的新产品图'],
  ),
  [AppMode.PLANNING]: {
    purpose: '分析商品、受众和渠道，形成可执行视觉方案',
    preferredAgent: 'cameron',
    primaryTool: 'analyzeRegion',
    fallbackTools: ['generateImage'],
    outputType: 'analysis',
    requiredInputs: ['商品信息或商品图片', '目标渠道/用途；缺失时可基于请求合理推断'],
    attachmentRoles: ['附件：商品与品牌视觉资料'],
    instructions: ['先给出视觉策略，再把用户要求的成片任务转换成 generateImage 调用', '不要只复述技能介绍'],
  },
  [AppMode.INPAINTING]: editPreset(
    '仅修改用户指定的局部区域',
    ['优先使用画布圈选蒙版', '严格保持蒙版外所有像素语义不变', '没有圈选信息时先指出需要选择区域'],
    ['ATTACHMENT_0：待编辑原图/画布选区'],
  ),
  [AppMode.WHITE_BG_RETOUCH]: imagePreset(
    '生成专业、干净且保真度高的电商白底精修图',
    ['背景使用纯白或平台要求的白色', '保持产品结构、材质、颜色、Logo 与细节准确', '允许自然接触阴影但不得添加无关道具'],
  ),
  [AppMode.PRODUCT_VIDEO]: {
    purpose: '从产品素材生成商业展示视频',
    preferredAgent: 'motion',
    primaryTool: 'generateVideo',
    fallbackTools: ['generateImage'],
    outputType: 'video',
    requiredInputs: ['产品图或明确的产品描述', '视频用途；时长和比例缺失时使用系统默认值'],
    attachmentRoles: ['ATTACHMENT_0：首帧/产品主参考', '其余附件：细节、角度或尾帧参考'],
    instructions: ['先规划单镜头运动与产品动作，再调用 generateVideo', '产品身份、Logo、包装文字必须稳定', '不要用 generateImage 冒充最终视频'],
  },
  [AppMode.IMAGE_CLEAN]: imagePreset(
    '生成主体聚焦、平台合规的电商主图',
    ['产品必须是唯一视觉主体', '保持真实比例与商品细节', '构图为转化目标服务并保留必要留白'],
  ),
  [AppMode.ECOMMERCE_HERO]: imagePreset(
    '结合平台、卖点和文案生成高转化电商主视觉',
    ['先识别目标平台和画幅', '商品外观必须保真', '文字内容只使用用户提供或已确认的信息'],
  ),
  [AppMode.SCENE_GENERATION]: imagePreset(
    '把产品自然放入匹配卖点的商业生活场景',
    ['产品为身份锚点，场景仅服务卖点', '匹配真实透视、接触阴影与环境反射', '不得改变产品结构和品牌标识'],
  ),
  [AppMode.INSTAGRAM_SCENE]: imagePreset(
    '按相机、镜头和胶片语言生成统一商业摄影成片',
    ['把摄影预设转换成镜头、光圈、光线、颗粒和色彩描述', '系列输出必须保持主体与调色一致'],
    ['ATTACHMENT_0：拍摄主体', '其余附件：摄影风格或场景参考'],
    'cameron',
  ),
  [AppMode.COPYWRITING]: imagePreset(
    '提取参考图的视觉语言并复刻到新主体',
    ['只迁移构图、光影、色彩和材质语言', '不得复制参考图中的品牌、人物身份或受保护文字', '新主体外观必须来自主体附件'],
    ['ATTACHMENT_0：需要生成的新主体', 'ATTACHMENT_1：风格参考图'],
    'cameron',
  ),
  [AppMode.UNIVERSAL_TRY_ON]: imagePreset(
    '完成模特换装、人台换衣或鞋靴上脚的高保真拟合',
    ['先判断人物/人台/脚部与商品附件角色', '保持人物身份、姿势和未替换区域', '保持服装版型、材质、图案和商品细节'],
    ['ATTACHMENT_0：人物/人台/脚部基底图', 'ATTACHMENT_1：要试穿的服装、配饰或鞋靴'],
    'campaign',
  ),
  [AppMode.SINGLE_ITEM_TRY_ON]: imagePreset(
    '把单件商品自然试穿或试戴到人物上',
    ['根据商品类别判断佩戴位置', '保持人物身份与商品细节', '处理真实遮挡、贴合、重力和阴影'],
    ['ATTACHMENT_0：人物基底图', 'ATTACHMENT_1：单品图'],
    'campaign',
  ),
  [AppMode.MODEL_TRANSFER]: imagePreset(
    '把服装呈现迁移到目标模特并扩展拍摄素材',
    ['保持目标模特身份', '保持服装版型、纹理和图案', '生成自然穿着关系和真实遮挡'],
    ['ATTACHMENT_0：服装/原模特参考', 'ATTACHMENT_1：目标模特'],
    'campaign',
  ),
  [AppMode.MODEL_FACE_SWAP]: imagePreset(
    '自然替换模特面部，同时保留服装、姿势和场景',
    ['目标脸部身份来自人脸参考', '保留基底图身体、服装、构图与光照', '匹配肤色、角度、表情和边缘融合'],
    ['ATTACHMENT_0：待换脸的基底模特图', 'ATTACHMENT_1：目标人脸参考'],
    'campaign',
  ),
  [AppMode.MODEL_POSE_FISSION]: imagePreset(
    '围绕同一模特身份生成多姿势、多角度素材',
    ['每张输出必须是独立画面', '模特身份、服装和场景风格保持一致', '姿势之间应有明确差异'],
    ['ATTACHMENT_0：模特身份与服装锚点'],
    'campaign',
  ),
  [AppMode.MODEL_SCENE_FISSION]: imagePreset(
    '先规划三套场景裂变方案，再把选中的九个镜头生成一张九宫格分镜',
    ['第一步只返回 A/B/C 三套九镜头方案，不得生图', '用户选择后生成 3×3 九宫格 Contact Sheet', '默认比例 2:3，并询问用户是否调整', '身份、服装、原场景、光线和摄影风格严格连续', '九宫格内禁止任何文字、编号和水印'],
    ['ATTACHMENT_0：模特、服装与场景锚点'],
    'campaign',
  ),
  [AppMode.MODEL_ANGLE_CONTROL]: imagePreset(
    '按指定相机方位、身体朝向、头部姿势和视线生成模特图',
    ['把角度参数明确写入 prompt', '未指定的身份、服装和场景保持不变', '相机角度与人物朝向不得混淆'],
    ['ATTACHMENT_0：模特身份与服装锚点'],
    'campaign',
  ),
  [AppMode.MODEL_ORIGINAL_PASTE_BACK]: editPreset(
    '从原图恢复生成图中失真的关键细节',
    ['明确要恢复的区域', '基底生成图的构图与光影不变', '恢复内容必须忠于原始细节参考'],
    ['ATTACHMENT_0：需要修复的生成图', 'ATTACHMENT_1：原始细节参考图'],
  ),
  [AppMode.OUTFIT_EXTRACTION]: {
    purpose: '识别模特造型中的服装单品与整套搭配信息',
    preferredAgent: 'campaign',
    primaryTool: 'analyzeClothingProduct',
    fallbackTools: ['generateImage'],
    outputType: 'analysis',
    requiredInputs: ['一张清晰的模特穿搭图'],
    attachmentRoles: ['ATTACHMENT_0：待分析穿搭图'],
    instructions: ['先识别品类、廓形、材质、颜色与搭配关系', '只有用户要求视觉成片时才继续调用 generateImage'],
  },
  [AppMode.RETOUCHING]: editPreset(
    '提升图片清晰度、分辨率和商品纹理细节',
    ['使用 upscale 编辑类型', '不得重绘成另一个产品', '保持颜色、Logo、文字、人物身份和构图'],
    ['ATTACHMENT_0：待放大的原图'],
    'upscale',
  ),
  [AppMode.RATIO_QUERY]: {
    purpose: '分析画幅比例并给出平台尺寸建议',
    preferredAgent: 'cameron',
    primaryTool: 'analyzeRegion',
    fallbackTools: [],
    outputType: 'analysis',
    requiredInputs: ['图片或目标平台名称'],
    attachmentRoles: ['ATTACHMENT_0：待分析图片'],
    instructions: ['返回原始宽高比、最接近的标准比例和推荐像素尺寸', '不得无依据裁切主体'],
  },
  [AppMode.SEAT_COVER]: imagePreset('生成座椅套适配效果图', ['保持座椅结构与产品版型准确']),
  [AppMode.PRODUCT_REPAIR]: editPreset('修复商品图缺陷', ['只修复瑕疵，不改变产品设计'], ['ATTACHMENT_0：待修复商品图']),
  [AppMode.STORYBOARD]: imagePreset('根据创意脚本生成分镜视觉', ['每个镜头单独调用生成工具', '保持主体和视觉连续性'], [], 'cameron'),
};

export const getCreativeAgentCapability = (feature: FeatureSelection): CreativeAgentCapability => {
  const preset = CAPABILITY_PRESETS[feature.mode];
  return {
    id: `creative-${String(feature.mode).toLowerCase()}`,
    mode: feature.mode,
    title: feature.title,
    ...preset,
  };
};

export const buildCreativeSkillData = (features: FeatureSelection[]): CreativeSkillData | undefined => {
  if (features.length === 0) return undefined;
  const capabilities = features.map(getCreativeAgentCapability);
  const executable = capabilities.filter((capability) => capability.outputType !== 'analysis');
  const hasSceneFission = features.some(
    (feature) => feature.mode === AppMode.MODEL_SCENE_FISSION,
  );
  return {
    id: 'creative-agent-skills',
    name: capabilities.map((capability) => capability.title).join(' + '),
    capabilities,
    config: {
      forceSkillExecution: executable.length > 0 && !hasSceneFission,
      twoStep: hasSceneFission,
      preferredAgent: capabilities[0]?.preferredAgent,
    },
  };
};
