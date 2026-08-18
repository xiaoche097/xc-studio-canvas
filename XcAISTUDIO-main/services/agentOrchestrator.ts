export type AgentMode = 'agent' | 'image' | 'video' | 'pose';
export type AgentTaskDepth = 'quick' | 'guided' | 'workflow';
export type AgentTaskRoute = 'direct-image' | 'image-modification' | 'skill' | 'conversation';

export interface AgentSelfCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: number;
}

export interface AgentRuntimeState {
  version: 1;
  route: AgentTaskRoute;
  depth: AgentTaskDepth;
  intent: string;
  prompt: string;
  skillId?: string;
  availableAssetIds: string[];
  referencedAssetIds: string[];
  missingCritical: string[];
  assumptions: string[];
  requiresConfirmation: boolean;
  selfCheck?: AgentSelfCheckResult;
  updatedAt: number;
}

export interface AgentRouteInput {
  mode: AgentMode;
  prompt: string;
  skillId?: string;
  availableAssetIds: string[];
  referencedAssetIds: string[];
  minimumSkillAssets?: number;
  forceSkill?: boolean;
}

export interface ExecutionPreflightInput {
  runtime: AgentRuntimeState;
  allowedImageModels?: readonly string[];
  imageModel?: string;
  allowedImageRatios?: readonly string[];
  imageRatio?: string;
  allowedImageResolutions?: readonly string[];
  imageResolution?: string;
}

export interface CanvasWorkflowNodePlan {
  key: string;
  kind: 'source-image' | 'image-generator' | 'video-generator';
  role: 'reference' | 'output';
  title: string;
  sourceAssetId?: string;
}

export interface CanvasWorkflowConnectionPlan {
  from: string;
  to: string;
}

export interface CanvasWorkflowPlan {
  version: 1;
  intent: string;
  nodes: CanvasWorkflowNodePlan[];
  connections: CanvasWorkflowConnectionPlan[];
  requiresConfirmation: boolean;
}

const IMAGE_MODIFICATION_PATTERN = /换|改|调整|修|发型|背景|场景|环境|换景|服装|衣服|头发|姿势|姿态|动作|站姿|坐姿|走路|行走|迈步|回头|回眸|倚靠|插兜|抬手|抬臂|转身|放松|松弛|变|替换|白底|精修|增强|生成|scene|background|pose|posture|walking/i;
const WORKFLOW_COMPLEXITY_PATTERN = /工作流|分镜|批量|系列|多场景|多镜头|首尾帧|一致性|完整方案|全套|视频脚本|镜头表/i;
const GUIDED_COMPLEXITY_PATTERN = /帮我|优化|高级|好看|专业|有质感|随便|你决定|自动/i;
const IMAGE_CREATION_ACTION_PATTERN = /生成|生图|出图|绘制|画(?:一|个|张|幅|出)|创作|制作|设计|做(?:一|个|张|幅|组|套|版)|create|generate|draw|render|make/i;
const IMPLICIT_IMAGE_CREATION_PATTERN = /生成|生图|出图|绘制|画(?:一|个|张|幅|出)|做(?:一|个|张|幅|组|套|版)|generate|draw|render/i;
const IMAGE_OUTPUT_PATTERN = /图|图片|照片|画面|视觉|海报|插画|封面|壁纸|头像|主视觉|效果图|成片|image|photo|poster|illustration|visual|artwork/i;
const IMAGE_PLANNING_REQUEST_PATTERN = /(?:图|图片|视觉|海报|插画|生成|制作|设计).{0,10}(?:方案|提示词|prompt|文案|脚本|教程|步骤|建议|分析报告|copywriting|script|tutorial)/i;
const OTHER_MEDIA_OUTPUT_PATTERN = /视频|动画|音频|音乐|配音|video|animation|audio|music/i;
const PLANNING_OR_ADVICE_PATTERN = /建议|方案|意见|想法|观点|先告诉|先给我|先说|先看|讨论|推荐|对比|评估|分析|怎么看|觉得呢|可以怎么|有什么|如何|how|suggestion|advice|plan first/i;

export const isPlanningOrAdviceRequest = (prompt: string): boolean => {
  const normalized = prompt.trim();
  if (!normalized) return false;
  return PLANNING_OR_ADVICE_PATTERN.test(normalized);
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const isImageGenerationRequest = (prompt: string): boolean => {
  const normalized = prompt.trim();
  if (!normalized || WORKFLOW_COMPLEXITY_PATTERN.test(normalized)) return false;

  const hasCreationAction = IMAGE_CREATION_ACTION_PATTERN.test(normalized)
    || /(?:给我|来|想要|需要).{0,6}(?:一|几|两|三)?\s*张/i.test(normalized);
  if (!hasCreationAction) return false;

  return !IMAGE_PLANNING_REQUEST_PATTERN.test(normalized) && !OTHER_MEDIA_OUTPUT_PATTERN.test(normalized);
};

export const isActionableImageGenerationRequest = (prompt: string): boolean => {
  const normalized = prompt.trim();
  if (!isImageGenerationRequest(normalized)) return false;

  const hasExplicitImageOutput = IMAGE_OUTPUT_PATTERN.test(normalized) || /(?:一|几|两|三)\s*张/i.test(normalized);
  if (!hasExplicitImageOutput && !IMPLICIT_IMAGE_CREATION_PATTERN.test(normalized)) return false;

  // A bare command such as “生成图片” still lacks the subject that determines
  // the visual result. Keep it in guided conversation; concrete briefs execute.
  const visualBrief = normalized
    .replace(/请|麻烦|帮我|可以|能不能|给我|我想要|我需要|直接|现在|立即|开始/gi, '')
    .replace(IMAGE_CREATION_ACTION_PATTERN, '')
    .replace(IMAGE_OUTPUT_PATTERN, '')
    .replace(/一|个|张|幅|组|套|版|的|吧|呀|啊|。|！|!|，|,/g, '')
    .trim();
  return visualBrief.length >= 2;
};

const inferIntent = (prompt: string, route: AgentTaskRoute, skillId?: string) => {
  if (skillId) return `执行技能 ${skillId}`;
  if (route === 'direct-image') return '直接生成图片';
  if (route === 'image-modification') return '基于参考素材修改图片';
  if (WORKFLOW_COMPLEXITY_PATTERN.test(prompt)) return '规划复杂视觉工作流';
  return '理解并推进视觉创作需求';
};

export const routeAgentTask = (input: AgentRouteInput): AgentRuntimeState => {
  const prompt = input.prompt.trim();
  const availableAssetIds = unique(input.availableAssetIds);
  const referencedAssetIds = unique(input.referencedAssetIds);
  const missingCritical: string[] = [];
  const assumptions: string[] = [];

  let route: AgentTaskRoute;
  let depth: AgentTaskDepth;
  let requiresConfirmation = false;

  if (input.mode === 'image') {
    route = 'direct-image';
    depth = 'quick';
    assumptions.push('使用用户在图片生成模式中明确选择的模型、比例和分辨率');
  } else if (input.forceSkill && input.skillId) {
    route = 'skill';
    depth = 'workflow';
    requiresConfirmation = true;
    const minimumAssets = Math.max(0, input.minimumSkillAssets || 0);
    if (availableAssetIds.length < minimumAssets) {
      missingCritical.push(`还缺少 ${minimumAssets - availableAssetIds.length} 张必需素材`);
    }
  } else if (
    availableAssetIds.length > 0
    && (!input.skillId || IMAGE_MODIFICATION_PATTERN.test(prompt))
    && IMAGE_MODIFICATION_PATTERN.test(prompt)
  ) {
    route = 'image-modification';
    depth = 'guided';
    requiresConfirmation = true;
    assumptions.push('未明确要求改变的主体身份、商品结构和画面元素保持不变');
  } else if (input.mode === 'agent' && !input.skillId && isActionableImageGenerationRequest(prompt)) {
    route = 'direct-image';
    depth = 'quick';
    assumptions.push('用户已明确要求产出图片，Agent 将自动补齐非关键视觉参数并直接执行文生图');
  } else if (input.skillId) {
    route = 'skill';
    depth = 'workflow';
    requiresConfirmation = true;
    const minimumAssets = Math.max(0, input.minimumSkillAssets || 0);
    if (availableAssetIds.length < minimumAssets) {
      missingCritical.push(`还缺少 ${minimumAssets - availableAssetIds.length} 张必需素材`);
    }
  } else {
    route = 'conversation';
    const complexityScore = [
      WORKFLOW_COMPLEXITY_PATTERN.test(prompt),
      availableAssetIds.length >= 3,
      prompt.length >= 120,
    ].filter(Boolean).length;
    depth = complexityScore >= 2
      ? 'workflow'
      : (GUIDED_COMPLEXITY_PATTERN.test(prompt) || prompt.length < 12 ? 'guided' : 'quick');
    requiresConfirmation = depth === 'workflow';
  }

  if (!prompt && referencedAssetIds.length === 0 && route === 'direct-image') {
    missingCritical.push('请输入生成要求或引用至少一张图片');
  }

  return {
    version: 1,
    route,
    depth,
    intent: inferIntent(prompt, route, input.skillId),
    prompt,
    skillId: input.skillId,
    availableAssetIds,
    referencedAssetIds,
    missingCritical,
    assumptions,
    requiresConfirmation,
    updatedAt: Date.now(),
  };
};

export const runExecutionPreflight = (input: ExecutionPreflightInput): AgentSelfCheckResult => {
  const errors = [...input.runtime.missingCritical];
  const warnings: string[] = [];
  const availableAssets = new Set(input.runtime.availableAssetIds);

  for (const referenceId of input.runtime.referencedAssetIds) {
    if (!availableAssets.has(referenceId)) errors.push(`引用素材 ${referenceId} 已不存在，请重新选择`);
  }

  if (input.runtime.route === 'direct-image') {
    if (input.imageModel && input.allowedImageModels && !input.allowedImageModels.includes(input.imageModel)) {
      errors.push('当前图片模型不可用，请重新选择');
    }
    if (input.imageRatio && input.allowedImageRatios && !input.allowedImageRatios.includes(input.imageRatio)) {
      errors.push('当前图片比例不受支持，请重新选择');
    }
    if (input.imageResolution && input.allowedImageResolutions && !input.allowedImageResolutions.includes(input.imageResolution)) {
      errors.push('当前图片分辨率不受支持，请重新选择');
    }
    if (input.runtime.referencedAssetIds.length === 0) {
      warnings.push('本次将作为纯文本生图执行');
    }
  }

  return {
    passed: errors.length === 0,
    errors: unique(errors),
    warnings: unique(warnings),
    checkedAt: Date.now(),
  };
};

export const attachSelfCheck = (
  runtime: AgentRuntimeState,
  selfCheck: AgentSelfCheckResult,
): AgentRuntimeState => ({ ...runtime, selfCheck, updatedAt: Date.now() });

export const buildImageModificationCanvasPlan = (
  referenceAssetIds: string[],
  prompt: string,
): CanvasWorkflowPlan => {
  const references = unique(referenceAssetIds);
  const outputKey = 'generated-output';
  return {
    version: 1,
    intent: prompt.trim() || '基于参考素材修改图片',
    nodes: [
      ...references.map((assetId, index): CanvasWorkflowNodePlan => ({
        key: `reference-${index + 1}`,
        kind: 'source-image',
        role: 'reference',
        title: `参考图 ${index + 1}`,
        sourceAssetId: assetId,
      })),
      {
        key: outputKey,
        kind: 'image-generator',
        role: 'output',
        title: '图片修改结果',
      },
    ],
    connections: references.map((_, index) => ({ from: `reference-${index + 1}`, to: outputKey })),
    requiresConfirmation: true,
  };
};

export const validateCanvasWorkflowPlan = (plan: CanvasWorkflowPlan): AgentSelfCheckResult => {
  const errors: string[] = [];
  const keys = plan.nodes.map((node) => node.key);
  const keySet = new Set(keys);
  if (keySet.size !== keys.length) errors.push('画布计划包含重复节点');
  if (!plan.nodes.some((node) => node.role === 'output')) errors.push('画布计划缺少输出节点');
  for (const connection of plan.connections) {
    if (!keySet.has(connection.from) || !keySet.has(connection.to)) errors.push('画布计划包含无效连接');
    if (connection.from === connection.to) errors.push('画布计划不能连接节点自身');
  }
  return { passed: errors.length === 0, errors: unique(errors), warnings: [], checkedAt: Date.now() };
};

export const serializeAgentRuntimeContext = (runtime: AgentRuntimeState) => JSON.stringify({
  state: {
    version: runtime.version,
    route: runtime.route,
    depth: runtime.depth,
    intent: runtime.intent,
    skillId: runtime.skillId,
    assetCount: runtime.availableAssetIds.length,
    referencedAssetCount: runtime.referencedAssetIds.length,
    missingCritical: runtime.missingCritical,
    assumptions: runtime.assumptions,
    requiresConfirmation: runtime.requiresConfirmation,
  },
  selfCheck: runtime.selfCheck
    ? {
        passed: runtime.selfCheck.passed,
        errors: runtime.selfCheck.errors,
        warnings: runtime.selfCheck.warnings,
      }
    : null,
});
