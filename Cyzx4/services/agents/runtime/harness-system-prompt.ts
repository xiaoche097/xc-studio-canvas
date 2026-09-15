import type { AgentInfo } from '../../../types/agent.types';

const CONTRACT_SECTION_RE = /^(输出格式|响应格式|response format|json response format|output contract|json-only output contract|skill plan)(?:\s|$)/i;
const CONTRACT_LINE_RE = /(?:\bjson\b|skillCalls|只能返回|只输出|return json|valid json|action\s*:|markdown code block)/i;
const STRUCTURAL_JSON_LINE_RE = /^\s*(?:[{}\[\]],?|"[\w-]+"\s*:)/;

const heading = (line: string): { depth: number; title: string } | null => {
  const match = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
  return match ? { depth: match[1].length, title: match[2] } : null;
};

/** Removes the legacy JSON response contract while retaining domain expertise. */
export const sanitizeLegacyPromptForHarness = (legacyPrompt: string): string => {
  const output: string[] = [];
  let skippedDepth: number | null = null;

  for (const line of String(legacyPrompt || '').split(/\r?\n/)) {
    const currentHeading = heading(line);
    if (skippedDepth !== null) {
      if (!currentHeading || currentHeading.depth > skippedDepth) continue;
      skippedDepth = null;
    }
    if (currentHeading && CONTRACT_SECTION_RE.test(currentHeading.title)) {
      skippedDepth = currentHeading.depth;
      continue;
    }
    if (CONTRACT_LINE_RE.test(line) || STRUCTURAL_JSON_LINE_RE.test(line)) continue;
    output.push(line);
  }

  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 16_000);
};

/** Builds the model-facing Harness prompt independently from the legacy planner protocol. */
export const buildHarnessSystemPrompt = (options: {
  agent: AgentInfo;
  legacyPrompt: string;
  selectedCapabilityNames?: string[];
  toolAccess?: 'enabled' | 'none';
  noToolReason?: 'prompt-optimizer' | 'conversation';
}): string => {
  const expertise = sanitizeLegacyPromptForHarness(options.legacyPrompt);
  const selected = options.selectedCapabilityNames?.filter(Boolean) || [];
  const toolProtocol = options.toolAccess === 'none'
    ? options.noToolReason === 'conversation'
      ? [
        '- 当前是 Ask 对话模式：可以使用专业知识、项目记忆、会话历史和附件进行分析与交流。',
        '- 不生成或编辑图片、视频、文案成品，不调用任何执行工具，也不改变画布或项目资产。',
        '- 可以帮助用户澄清目标、比较方向、检查方案和补充约束；不要声称已经执行。',
      ]
      : [
        '- 本角色没有任何工具权限，只能完成提示词改写并返回文本。',
        '- 即使原始提示词要求生成图片、视频、代码或其他成品，也只能优化该提示词，绝对不能执行。',
        '- 不得声称已经生成、编辑、上传或保存任何资产。',
      ]
    : [
        '- 工具调用只能通过模型原生 function calling 通道发出；禁止把工具名和参数伪装成 JSON 正文。',
        '- 每一步先判断是否需要工具；调用后读取真实结果，再决定下一步，直到任务真正完成。',
        '- 用户要求生成或修改图片、视频或画布素材时，必须调用对应工具，不能只给提示词或声称已经完成。',
        '- DeepSeek 负责规划和编排；图片、视频与编辑继续使用 XC-AI 已配置的媒体模型。',
        selected.length > 0
          ? `- 用户锁定的能力：${selected.join('、')}。只使用与这些能力相符的工具。`
          : '- 可在已提供的工具中自主选择最合适的能力。',
      ];
  return [
    `# 身份\n你是 ${options.agent.name}：${options.agent.description}`,
    `# 核心能力\n${options.agent.capabilities.map(item => `- ${item}`).join('\n')}`,
    expertise ? `# 专业知识\n${expertise}` : '',
    '# XcAI 执行协议',
    '- 使用中文与用户交流，最终答复是自然、清晰的聊天文本。',
    ...toolProtocol,
    '- 不得输出内部路由对象、action/respond 信封、JSON 计划或代码块。',
    '- 不得编造附件、URL、工具结果、执行状态或完成状态。',
  ].filter(Boolean).join('\n\n');
};
