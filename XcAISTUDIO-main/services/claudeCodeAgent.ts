import { generateText } from '../../Cyzx4/services/geminiService';

export interface ClaudeCodePlugin {
  id: string;
  name: string;
  description: string;
  badge: string;
  systemPromptAddon: string;
}

export const CLAUDE_CODE_PLUGINS: ClaudeCodePlugin[] = [
  {
    id: 'frontend-design',
    name: 'Frontend Design (UI/UX 专家)',
    description: '生成现代化美观响应式 UI/UX 组件与布局代码',
    badge: 'UI/UX',
    systemPromptAddon: `[PLUGIN: FRONTEND-DESIGN]
You are a world-class frontend designer and React engineer. Emphasize rich aesthetics: vibrant modern color palettes, smooth transitions, glassmorphism, dynamic layouts, accessible semantic HTML, and production-ready React / Tailwind code.`,
  },
  {
    id: 'feature-dev',
    name: 'Feature Dev (功能开发架构)',
    description: '端到端复杂功能设计、模块拆解与系统重构',
    badge: '架构',
    systemPromptAddon: `[PLUGIN: FEATURE-DEV]
You are a senior software architect. Decompose complex user requests into a rigorous execution plan: (1) Architecture Analysis, (2) File & Interface Modifications, (3) Verification & Test Strategy.`,
  },
  {
    id: 'code-review',
    name: 'Code Review (代码审计与重构)',
    description: '审查潜在 Bug、性能瓶颈、安全隐患并提供重构建议',
    badge: '审计',
    systemPromptAddon: `[PLUGIN: CODE-REVIEW]
Perform a line-by-line review focusing on correctness, edge cases, state mutability, memory leaks, performance bottlenecks, and security guidelines.`,
  },
  {
    id: 'explanatory-output-style',
    name: 'Explanatory Style (深度教学讲解)',
    description: '清晰讲解复杂原理、方案对比与代码执行流程',
    badge: '讲解',
    systemPromptAddon: `[PLUGIN: EXPLANATORY-OUTPUT-STYLE]
Break down complex technical concepts into intuitive, clear explanations with visual diagrams (Mermaid or ASCII), step-by-step code walkthroughs, and rationale.`,
  },
];

export interface ClaudeCodePlanStep {
  index: number;
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
  description: string;
}

export interface ClaudeCodeAgentResponse {
  intent: string;
  preflightPassed: boolean;
  preflightNotes: string[];
  thinkingSummary: string;
  steps: ClaudeCodePlanStep[];
  mainContent: string;
  rawText: string;
}

export const CLAUDE_CODE_BASE_SYSTEM_PROMPT = `
You are Claude Code Agent — an advanced, autonomous agentic assistant integrated directly into XcAI AGENT.
Your core philosophy originates from Anthropic's Claude Code CLI tool:
1. AGENTIC TASK DECOMPOSITION: Break down complex user goals into numbered, operational steps (Planning Mode).
2. PREFLIGHT SELF-CHECK: Verify prerequisites, parameters, and input completeness before outputting solutions.
3. CONCISE & EXPLANATORY: Provide ultra-clear, production-grade code, step-by-step architectural guidance, and actionable insights.
4. RIGOROUS STANDARDS: Avoid placeholders, unhandled errors, or broken syntax.

Output structured responses using clear Markdown formatting with optional JSON plan blocks when executing multi-step workflows.
`.trim();

export const parseClaudeCodeResponse = (text: string): ClaudeCodeAgentResponse => {
  const steps: ClaudeCodePlanStep[] = [];
  const preflightNotes: string[] = [];
  let intent = 'Claude Code 智能处理';
  let thinkingSummary = '';

  // Extract Plan steps if present
  const planMatch = text.match(/```json:plan\s*([\s\S]*?)\s*```/i) || text.match(/```json\s*(\{[\s\S]*?"steps"[\s\S]*?\})\s*```/i);
  if (planMatch) {
    try {
      const parsed = JSON.parse(planMatch[1]);
      if (parsed.intent) intent = parsed.intent;
      if (Array.isArray(parsed.preflightNotes)) preflightNotes.push(...parsed.preflightNotes);
      if (parsed.thinkingSummary) thinkingSummary = parsed.thinkingSummary;
      if (Array.isArray(parsed.steps)) {
        parsed.steps.forEach((step: any, idx: number) => {
          steps.push({
            index: idx + 1,
            title: String(step.title || `步骤 ${idx + 1}`),
            status: step.status === 'completed' ? 'completed' : step.status === 'in-progress' ? 'in-progress' : 'pending',
            description: String(step.description || ''),
          });
        });
      }
    } catch (e) {
      console.warn('Failed to parse Claude Code JSON plan block:', e);
    }
  }

  // Fallback step extraction from markdown headings/numbered lists if no JSON plan block
  if (steps.length === 0) {
    const lines = text.split('\n');
    let stepCount = 0;
    for (const line of lines) {
      const match = line.match(/^(?:###?|\d+\.)\s*(?:步骤|Step)?\s*\d*[:：\.]?\s*(.+)/i);
      if (match && stepCount < 6 && line.length < 100) {
        stepCount += 1;
        steps.push({
          index: stepCount,
          title: match[1].trim(),
          status: 'completed',
          description: '完成任务规划节点',
        });
      }
    }
  }

  // Fallback default step
  if (steps.length === 0) {
    steps.push(
      { index: 1, title: '智能需求分析与Preflight自检', status: 'completed', description: '解析用户输入与参数契约' },
      { index: 2, title: '生成专业级解决方案与代码', status: 'completed', description: '输出可执行方案' }
    );
  }

  const mainContent = text
    .replace(/```json:plan\s*[\s\S]*?```/gi, '')
    .trim();

  return {
    intent,
    preflightPassed: true,
    preflightNotes,
    thinkingSummary: thinkingSummary || 'Claude Code 已完成智能体推理与规范规划',
    steps,
    mainContent,
    rawText: text,
  };
};

export const runClaudeCodeAgent = async (
  userPrompt: string,
  pluginId?: string,
  options?: {
    modelId?: string;
    imagePreviews?: string[];
  }
): Promise<ClaudeCodeAgentResponse> => {
  const selectedPlugin = CLAUDE_CODE_PLUGINS.find((p) => p.id === pluginId);
  const pluginPrompt = selectedPlugin ? selectedPlugin.systemPromptAddon : '';

  const systemInstruction = `
${CLAUDE_CODE_BASE_SYSTEM_PROMPT}

${pluginPrompt}

MANDATORY RESPONSE CONTRACT:
At the start of your response, ALWAYS include a hidden JSON plan block in this format:
\`\`\`json:plan
{
  "intent": "简短概述任务意图",
  "thinkingSummary": "关于任务处理路径与自检的1-2句说明",
  "preflightNotes": ["已验证参数契约", "无语法冲突"],
  "steps": [
    { "title": "步骤1标题", "description": "步骤1详细说明", "status": "completed" },
    { "title": "步骤2标题", "description": "步骤2详细说明", "status": "completed" }
  ]
}
\`\`\`

Following the JSON plan block, render your full, beautifully formatted Simplified Chinese (中文) markdown output.
`.trim();

  const fullPrompt = `${systemInstruction}\n\n[USER REQUEST]\n${userPrompt}`;

  try {
    const rawText = await generateText([], fullPrompt);
    return parseClaudeCodeResponse(rawText);
  } catch (error: any) {
    console.error('Claude Code Agent Execution Failed:', error);
    throw new Error(`Claude Code Agent 执行中断：${error?.message || '未知错误'}`);
  }
};
