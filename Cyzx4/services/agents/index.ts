import { AgentType, AgentTask, AgentInfo } from '../../types/agent.types';
import { EnhancedBaseAgent } from './enhanced-base-agent';
import { cocoAgent } from './agents/coco.agent';
import { vireoAgent } from './agents/vireo.agent';
import { cameronAgent } from './agents/cameron.agent';
import { posterAgent } from './agents/poster.agent';
import { packageAgent } from './agents/package.agent';
import { motionAgent } from './agents/motion.agent';
import { campaignAgent } from './agents/campaign.agent';
import { clothingAgent } from './agents/clothing.agent';
import { promptOptimizerAgent } from './agents/prompt-optimizer.agent';

export const AGENT_REGISTRY: Record<AgentType, EnhancedBaseAgent> = {
  coco: cocoAgent,
  vireo: vireoAgent,
  cameron: cameronAgent,
  poster: posterAgent,
  package: packageAgent,
  motion: motionAgent,
  // campaign remains default; specialized clothing flow is selected via routing
  campaign: campaignAgent,
  // NOTE: ClothingAgent is a specialized prompt bound to 'campaign' AgentType in this codebase.
  // It is used via explicit pin or router keyword logic.
  'prompt-optimizer': promptOptimizerAgent,
};

export function getAgentInfo(agentId: AgentType): AgentInfo {
  return AGENT_REGISTRY[agentId].agentInfo;
}

export async function executeAgentTask(task: AgentTask): Promise<AgentTask> {
  // Normalize agent ID to lowercase (LLM may return "Campaign" instead of "campaign")
  const normalizedId = task.agentId.toLowerCase() as AgentType;
  const agent = AGENT_REGISTRY[normalizedId];
  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }
  return agent.execute({ ...task, agentId: normalizedId });
}

// 导出核心模块
export { EnhancedBaseAgent } from './enhanced-base-agent';
export { routeToAgent } from './enhanced-orchestrator';

// 导出本地路由（降级方案）
export { localPreRoute, isChatMessage, isVagueRequest, isEditRequest } from './local-router';

// 导出 Pipeline 系统
export { executePipeline, detectPipeline, PIPELINES } from './pipeline';
export type { Pipeline, PipelineResult } from './pipeline';
