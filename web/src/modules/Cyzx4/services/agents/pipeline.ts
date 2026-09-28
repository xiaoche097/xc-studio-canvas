/**
 * Pipeline 执行引擎
 * 支持多智能体串联协作，前一步的输出作为后一步的输入
 */

import { AgentType, AgentTask, GeneratedAsset } from '../../types/agent.types';
import { ProjectContext } from '../../types/common';
import { executeAgentTask } from './index';

export interface PipelineStep {
    agentId: AgentType;
    /** 将上一步输出转换为当前步骤的输入消息 */
    inputTransform?: (prevResult: AgentTask) => { message: string; metadata?: Record<string, any> };
    /** 条件判断：是否执行当前步骤 */
    condition?: (prevResult: AgentTask) => boolean;
}

export interface Pipeline {
    id: string;
    name: string;
    description: string;
    steps: PipelineStep[];
}

export interface PipelineResult {
    pipelineId: string;
    steps: AgentTask[];
    status: 'completed' | 'failed' | 'partial';
    allAssets: GeneratedAsset[];
}

/**
 * 执行多智能体 Pipeline
 */
export async function executePipeline(
    pipeline: Pipeline,
    initialMessage: string,
    context: ProjectContext,
    onStepComplete?: (stepIndex: number, result: AgentTask) => void
): Promise<PipelineResult> {
    const results: AgentTask[] = [];
    let currentMessage = initialMessage;

    for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i];

        // 条件检查
        if (step.condition && results.length > 0 && !step.condition(results[results.length - 1])) {
            console.log(`[Pipeline:${pipeline.id}] Skipping step ${i} (${step.agentId}): condition not met`);
            continue;
        }

        // 输入转换
        if (step.inputTransform && results.length > 0) {
            const transformed = step.inputTransform(results[results.length - 1]);
            currentMessage = transformed.message;
        }

        console.log(`[Pipeline:${pipeline.id}] Step ${i}: ${step.agentId} — "${currentMessage.substring(0, 50)}"`);

        const task: AgentTask = {
            id: `pipeline-${pipeline.id}-step-${i}-${Date.now()}`,
            agentId: step.agentId,
            status: 'pending',
            input: {
                message: currentMessage,
                context
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const result = await executeAgentTask(task);
        results.push(result);

        onStepComplete?.(i, result);

        if (result.status === 'failed') {
            console.error(`[Pipeline:${pipeline.id}] Step ${i} failed, aborting pipeline`);
            return {
                pipelineId: pipeline.id,
                steps: results,
                status: results.length === pipeline.steps.length ? 'failed' : 'partial',
                allAssets: collectAssets(results)
            };
        }
    }

    return {
        pipelineId: pipeline.id,
        steps: results,
        status: 'completed',
        allAssets: collectAssets(results)
    };
}

function collectAssets(results: AgentTask[]): GeneratedAsset[] {
    return results.flatMap(r => r.output?.assets || []);
}

// ─── 预定义 Pipeline ───

export const PIPELINES: Record<string, Pipeline> = {
    'optimize-then-execute': {
        id: 'optimize-then-execute',
        name: '提示词优化后执行',
        description: 'Prompt Optimizer 先优化提示词，再交给目标智能体执行',
        steps: [
            { agentId: 'prompt-optimizer' },
            {
                agentId: 'poster',
                inputTransform: (prev) => ({
                    message: prev.output?.message || ''
                }),
                condition: (prev) => prev.status === 'completed'
            }
        ]
    },
    'storyboard-to-video': {
        id: 'storyboard-to-video',
        name: '分镜到视频',
        description: 'Cameron 生成分镜方案，Motion 逐帧生成视频',
        steps: [
            { agentId: 'cameron' },
            {
                agentId: 'motion',
                inputTransform: (prev) => ({
                    message: `基于以下分镜方案生成视频：${prev.output?.message || ''}。请为每个分镜画面生成对应的视频片段。`
                }),
                condition: (prev) => prev.status === 'completed' && (prev.output?.assets?.length || 0) > 0
            }
        ]
    },
    'brand-to-campaign': {
        id: 'brand-to-campaign',
        name: '品牌到营销',
        description: 'Vireo 设计品牌视觉，Campaign 生成营销套图',
        steps: [
            { agentId: 'vireo' },
            {
             agentId: 'campaign',
                inputTransform: (prev) => ({
                    message: `基于以下品牌设计，创建一套营销物料：${prev.output?.message || ''}。保持品牌视觉一致性。`
                }),
                condition: (prev) => prev.status === 'completed'
            }
        ]
    },
    'brand-to-package': {
        id: 'brand-to-package',
        name: '品牌到包装',
        description: 'Vireo 设计品牌视觉，Package 设计产品包装',
        steps: [
            { agentId: 'vireo' },
            {
                agentId: 'package',
                inputTransform: (prev) => ({
                    message: `基于以下品牌设计，设计产品包装：${prev.output?.message || ''}。保持品牌视觉一致性。`
                }),
                condition: (prev) => prev.status === 'completed'
            }
        ]
    }
};

// ─── Pipeline 关键词检测 ───

const PIPELINE_PATTERNS: { pattern: RegExp; pipelineId: string }[] = [
    { pattern: /分镜.{0,5}(生成|做|出|制作).{0,3}视频|先.{0,3}分镜.{0,5}再.{0,3}(视频|动画)/, pipelineId: 'storyboard-to-video' },
    { pattern: /先.{0,3}(品牌|logo|vi).{0,5}再.{0,3}(营销|推广|campaign)|品牌.{0,5}(到|转).{0,3}营销/, pipelineId: 'brand-to-campaign' },
    { pattern: /先.{0,3}(品牌|logo|vi).{0,5}再.{0,3}(包装|package)|品牌.{0,5}(到|转).{0,3}包装/, pipelineId: 'brand-to-package' },
];

/**
 * 检测消息是否匹配某个 Pipeline
 */
export function detectPipeline(message: string): string | null {
    const lower = message.toLowerCase();
    for (const { pattern, pipelineId } of PIPELINE_PATTERNS) {
        if (pattern.test(lower)) {
            return pipelineId;
        }
    }
    return null;
}
