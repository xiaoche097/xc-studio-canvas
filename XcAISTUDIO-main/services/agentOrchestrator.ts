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

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

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
