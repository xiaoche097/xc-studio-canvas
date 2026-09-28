import { z } from 'zod';

export const promptOptimizerModeSchema = z.enum([
  'auto',
  'clarify',
  'precision',
  'planning',
  'text-to-image',
  'image-edit',
  'multi-image',
  'iterate',
]);

export type PromptOptimizerMode = z.infer<typeof promptOptimizerModeSchema>;
export type ResolvedPromptOptimizerMode = Exclude<PromptOptimizerMode, 'auto'>;

export interface PromptOptimizerRole {
  id: ResolvedPromptOptimizerMode;
  name: string;
  description: string;
  instruction: string;
}

export interface PromptOptimizerSelectionInput {
  text: string;
  mode?: PromptOptimizerMode;
  referenceImageCount?: number;
  isRevision?: boolean;
}

export const PROMPT_OPTIMIZER_ROLES: Record<ResolvedPromptOptimizerMode, PromptOptimizerRole> = {
  clarify: {
    id: 'clarify', name: '需求澄清师', description: '消除歧义并补齐目标、对象和交付边界。',
    instruction: '把含糊表达改写为清楚、短而可执行的提示词。只补齐能够从原文可靠推断的信息；无法确定的关键项保留为【待填写】占位符。不要擅自扩大任务范围，也不要替用户做决定。',
  },
  precision: {
    id: 'precision', name: '精准指令师', description: '强化约束、参数、质量标准与输出格式。',
    instruction: '将目标、输入、约束、执行要求和输出格式组织成明确指令。保留变量、占位符、专有名词、数量、尺寸、日期、平台和否定约束。没有依据时不要编造品牌资料、产品参数、价格、受众或风格。',
  },
  planning: {
    id: 'planning', name: '任务规划师', description: '把复杂任务整理成步骤、检查点和交付物。',
    instruction: '把复杂请求改写为可分阶段完成的提示词，明确背景、目标、步骤、检查点和最终交付物。步骤必须服务于用户目标，不增加无关流程。最终只输出可交给另一个 Agent 执行的完整提示词。',
  },
  'text-to-image': {
    id: 'text-to-image', name: '视觉提示词导演', description: '为文生图组织主体、构图、光线、材质与文字。',
    instruction: '把请求改写为单张图像生成提示词，明确主体、动作、环境、构图、镜头、光线、材质、色彩和氛围。用户指定的文字内容、数量、位置、比例和禁止项是硬约束，必须保留。不得改变产品、人物或品牌事实。',
  },
  'image-edit': {
    id: 'image-edit', name: '图像编辑指令师', description: '明确增删改范围，并锁定未修改区域。',
    instruction: '把请求改写为参考图编辑指令，明确属于添加、删除、替换还是局部增强。用户描述的是期望结果，不要假定它是在描述参考图当前内容。只改变点名区域，人物身份、主体数量、姿势、构图、光线和未提及区域保持不变。',
  },
  'multi-image': {
    id: 'multi-image', name: '多图关系编排师', description: '定义多张参考图的角色、关系和融合边界。',
    instruction: '使用“图1、图2……”逐一说明每张参考图提供什么，以及图与图之间如何组合。没有明确依据时不得猜测哪张是主体、风格、背景或结构参考。保留用户指定的主次关系、位置关系、融合方式和不可改变项。',
  },
  iterate: {
    id: 'iterate', name: '迭代校准师', description: '基于上一版做最小必要修改。',
    instruction: '将本轮反馈合并为对上一版提示词的最小必要修改。保留上一版中未被否定的结构、变量、硬约束和视觉连续性。当前用户指令优先；历史只用于理解延续关系，不得把旧任务当成本轮待执行队列。',
  },
};

const explicitModeMatchers: Array<[ResolvedPromptOptimizerMode, RegExp]> = [
  ['clarify', /需求澄清|澄清模式|基础优化/i],
  ['precision', /精准指令|专业优化|精准模式/i],
  ['planning', /任务规划|规划模式|分步规划/i],
  ['text-to-image', /文生图|视觉提示词|生图提示词/i],
  ['image-edit', /图生图|图像编辑|局部编辑/i],
  ['multi-image', /多图编排|多图融合|多参考图/i],
  ['iterate', /迭代校准|迭代模式|基于上一版/i],
];

export const selectPromptOptimizerRole = ({ text, mode = 'auto', referenceImageCount = 0, isRevision = false }: PromptOptimizerSelectionInput): PromptOptimizerRole => {
  const parsedMode = promptOptimizerModeSchema.catch('auto').parse(mode);
  if (parsedMode !== 'auto') return PROMPT_OPTIMIZER_ROLES[parsedMode];
  const normalized = String(text || '').trim();
  const explicit = explicitModeMatchers.find(([, matcher]) => matcher.test(normalized));
  if (explicit) return PROMPT_OPTIMIZER_ROLES[explicit[0]];
  if (isRevision || /继续修改|重新编辑|上一版|上一张|在此基础上|保持其他不变|只改/i.test(normalized)) return PROMPT_OPTIMIZER_ROLES.iterate;
  if (referenceImageCount > 1 || /图\s*1|图一|第一张图|第二张图|多张参考/i.test(normalized)) return PROMPT_OPTIMIZER_ROLES['multi-image'];
  if (referenceImageCount > 0 || /替换|换成|删除|去掉|移除|改成|局部|重绘|扩图/i.test(normalized)) return PROMPT_OPTIMIZER_ROLES['image-edit'];
  if (/生成.{0,6}(图|海报|主图|图片)|画一张|视觉|摄影|镜头|构图|光线/i.test(normalized)) return PROMPT_OPTIMIZER_ROLES['text-to-image'];
  if (normalized.length > 180 || /方案|流程|阶段|计划|分析并|先.+再|步骤/i.test(normalized)) return PROMPT_OPTIMIZER_ROLES.planning;
  if (normalized.length < 28) return PROMPT_OPTIMIZER_ROLES.clarify;
  return PROMPT_OPTIMIZER_ROLES.precision;
};

export const buildPromptOptimizerRequest = (input: PromptOptimizerSelectionInput): { role: PromptOptimizerRole; message: string } => {
  const role = selectPromptOptimizerRole(input);
  const referenceCount = Math.max(0, Number(input.referenceImageCount || 0));
  return {
    role,
    message: [
      `【本轮优化角色】XcAI · ${role.name}`,
      `【参考图数量】${referenceCount}`,
      `【是否为延续修改】${input.isRevision ? '是' : '否'}`,
      `【角色规则】${role.instruction}`,
      '【原始用户提示词】',
      String(input.text || '').trim(),
      '【输出】只返回优化后的提示词正文，不执行任务，不调用工具，不解释。',
    ].join('\n'),
  };
};
