import { AgentTask, AgentResponse } from './types';
import { callAgent } from '../geminiService';
import { REPORT_AGENT_PROMPT } from './prompts';

export class ReportAgent {
  async execute(task: AgentTask): Promise<AgentResponse> {
    console.log(`[ReportAgent] Executing: ${task.task_name}`);

    // Construct user message
    // Note: task.params.context contains previous agents' data
    const userMessage = `Task: ${JSON.stringify(task)}`;

    if (task.params?.context) {
      console.log(`[ReportAgent] Context size: ${task.params.context.length} chars`);
    }

    try {
      const responseText = await callAgent(REPORT_AGENT_PROMPT, userMessage, true, task.params?.model, task.params?.isInternetSearch);

      // Robust JSON extraction
      let cleanJson = responseText.trim();
      if (cleanJson.includes('```')) {
        cleanJson = cleanJson.replace(/```json/gi, '').replace(/```/g, '');
      }
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }

      const result = JSON.parse(cleanJson);

      if (!result.execution_time) {
        result.execution_time = '4.0s';
      }

      return result;
    } catch (e: any) {
      console.error("ReportAgent Execution Failed", e);
      return {
        task_id: task.task_id,
        status: 'failed',
        execution_time: '0s',
        result: { error: e.message || "Unknown error" }
      };
    }
  }
}
