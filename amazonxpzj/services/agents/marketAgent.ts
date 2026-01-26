import { AgentTask, AgentResponse } from './types';
import { callAgent } from '../geminiService';
import { MARKET_AGENT_PROMPT } from './prompts';

export class MarketAgent {
  async execute(task: AgentTask): Promise<AgentResponse> {
    console.log(`[MarketAgent] Executing: ${task.task_name}`);

    const userMessage = `Task: ${JSON.stringify(task)}`;

    try {
      const responseText = await callAgent(MARKET_AGENT_PROMPT, userMessage, true, task.params?.model, task.params?.isInternetSearch);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanJson);

      if (!result.execution_time) {
        result.execution_time = '3.5s';
      }

      return result;
    } catch (e: any) {
      console.error("MarketAgent Execution Failed", e);
      return {
        task_id: task.task_id,
        status: 'failed',
        execution_time: '0s',
        result: { error: e.message || "Unknown error" }
      };
    }
  }
}
