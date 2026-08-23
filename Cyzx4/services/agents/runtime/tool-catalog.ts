export interface HarnessToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> => ({
  type: 'object',
  additionalProperties: true,
  properties,
  ...(required.length > 0 ? { required } : {}),
});

const string = (description: string, values?: string[]) => ({
  type: 'string',
  description,
  ...(values ? { enum: values } : {}),
});

const TOOL_CATALOG: Record<string, HarnessToolDefinition> = {
  generateImage: {
    type: 'function',
    function: {
      name: 'generateImage',
      description: '生成或基于参考图编辑图片。视觉产出请求必须调用此工具，不能只返回提示词。附件用 ATTACHMENT_0、ATTACHMENT_1 引用。',
      parameters: objectSchema({
        prompt: string('完整的英文图片生成或编辑提示词。'),
        model: string('图片模型。默认使用 nanobanana2。'),
        aspectRatio: string('输出比例，例如 1:1、3:4、4:5、16:9、9:16。'),
        imageSize: string('输出清晰度。', ['1K', '2K', '4K']),
        referenceImage: string('主参考图，如 ATTACHMENT_0。'),
        referenceImages: {
          type: 'array',
          description: '全部参考图，按附件顺序填写。',
          items: { type: 'string' },
        },
        referenceStrength: { type: 'number', minimum: 0, maximum: 1 },
        referencePriority: string('参考图优先策略。', ['first', 'all']),
        referenceMode: string('参考内容类型。', ['style', 'product', 'portrait']),
      }, ['prompt']),
    },
  },
  generateVideo: {
    type: 'function',
    function: {
      name: 'generateVideo',
      description: '根据文本、首尾帧或多张参考图生成视频。附件使用 ATTACHMENT_n 引用。',
      parameters: objectSchema({
        prompt: string('完整的英文视频生成提示词。'),
        model: string('视频模型标识。'),
        aspectRatio: string('视频比例，例如 16:9 或 9:16。'),
        startFrame: string('首帧附件引用。'),
        endFrame: string('尾帧附件引用。'),
        referenceImages: { type: 'array', items: { type: 'string' } },
      }, ['prompt']),
    },
  },
  smartEdit: {
    type: 'function',
    function: {
      name: 'smartEdit',
      description: '对已有图片执行换背景、移除对象、扩图、风格转换或放大。sourceUrl 通常填写 ATTACHMENT_0。',
      parameters: objectSchema({
        sourceUrl: string('源图片引用或 URL。'),
        editType: string('编辑类型。', ['background-remove', 'object-remove', 'upscale', 'style-transfer', 'extend']),
        maskImage: string('可选蒙版。'),
        parameters: objectSchema({
          prompt: string('英文编辑指令。'),
          aspectRatio: string('输出比例。'),
          style: string('目标风格。'),
          direction: string('扩图方向。'),
          object: string('需要移除的对象。'),
        }),
      }, ['sourceUrl', 'editType']),
    },
  },
  generateCopy: {
    type: 'function',
    function: {
      name: 'generateCopy',
      description: '生成品牌标题、口号、正文或商品描述。',
      parameters: objectSchema({
        copyType: string('文案类型。', ['headline', 'tagline', 'body', 'slogan', 'description']),
        brandName: string('品牌名称。'),
        product: string('产品信息。'),
        targetAudience: string('目标人群。'),
        tone: string('语气。', ['professional', 'casual', 'playful', 'luxury', 'urgent']),
        keyMessage: string('核心卖点。'),
        maxLength: { type: 'integer', minimum: 1 },
        variations: { type: 'integer', minimum: 1, maximum: 10 },
      }, ['copyType', 'brandName', 'product', 'targetAudience', 'tone', 'keyMessage']),
    },
  },
  extractText: {
    type: 'function',
    function: {
      name: 'extractText',
      description: '识别图片中的文字。imageData 通常填写 ATTACHMENT_0。',
      parameters: objectSchema({ imageData: string('图片附件引用或 data URL。') }, ['imageData']),
    },
  },
  analyzeRegion: {
    type: 'function',
    function: {
      name: 'analyzeRegion',
      description: '分析图片或选区中的视觉内容。',
      parameters: objectSchema({
        imageData: string('图片附件引用或 data URL。'),
        regionPrompt: string('需要分析的问题。'),
      }, ['imageData', 'regionPrompt']),
    },
  },
  touchEdit: {
    type: 'function',
    function: {
      name: 'touchEdit',
      description: '按坐标范围执行局部编辑。',
      parameters: objectSchema({
        imageData: string('源图片附件引用。'),
        regionX: { type: 'number' },
        regionY: { type: 'number' },
        regionWidth: { type: 'number', minimum: 1 },
        regionHeight: { type: 'number', minimum: 1 },
        editInstruction: string('局部修改指令。'),
        aspectRatio: string('输出比例。'),
      }, ['imageData', 'regionX', 'regionY', 'regionWidth', 'regionHeight', 'editInstruction']),
    },
  },
};

export const getHarnessToolDefinitions = (skillNames: string[]): HarnessToolDefinition[] => {
  const uniqueNames = Array.from(new Set(skillNames));
  return uniqueNames
    .map(name => TOOL_CATALOG[name])
    .filter((tool): tool is HarnessToolDefinition => Boolean(tool));
};
