export const DEEPSEEK_AUTO_MODEL = 'auto';
export const DEEPSEEK_FLASH_MODEL = 'deepseek-flash';
export const DEEPSEEK_PRO_MODEL = 'deepseek-v4-pro';

export type DeepSeekRouteReason = 'vision' | 'agent-tools' | 'complex-reasoning' | 'fast-response';

export interface DeepSeekRouteDecision {
  model: typeof DEEPSEEK_FLASH_MODEL | typeof DEEPSEEK_PRO_MODEL;
  reason: DeepSeekRouteReason;
}

const COMPLEX_TASK_PATTERN = /(?:规划|方案|架构|推理|论证|诊断|排查|重构|多步骤|工作流|执行计划|深入分析|权衡|比较|研究|plan|architect|reason|diagnos|debug|refactor|workflow|multi[- ]?step|trade[- ]?off|research)/i;

export const selectDeepSeekModel = (input: {
  hasImages?: boolean;
  hasTools?: boolean;
  text?: string;
}): DeepSeekRouteDecision => {
  if (input.hasImages) {
    return { model: DEEPSEEK_FLASH_MODEL, reason: 'vision' };
  }
  if (input.hasTools) {
    return { model: DEEPSEEK_PRO_MODEL, reason: 'agent-tools' };
  }
  const text = (input.text || '').trim();
  if (text.length >= 1200 || COMPLEX_TASK_PATTERN.test(text)) {
    return { model: DEEPSEEK_PRO_MODEL, reason: 'complex-reasoning' };
  }
  return { model: DEEPSEEK_FLASH_MODEL, reason: 'fast-response' };
};

