import { AgentTask, AgentResponse } from './types';
import { callAgent } from '../geminiService';
import { KEYWORD_AGENT_PROMPT } from './prompts';

export class KeywordAgent {
  async execute(task: AgentTask): Promise<AgentResponse> {
    console.log(`[KeywordAgent] Executing: ${task.task_name}`);
    
    // Construct user message
    const userMessage = `Task: ${JSON.stringify(task)}`;

    try {
        const responseText = await callAgent(KEYWORD_AGENT_PROMPT, userMessage);
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        
        // Ensure execution_time exists
        if (!result.execution_time) {
            result.execution_time = '2.5s';
        }
        
        return result;
    } catch (e: any) {
        console.error("KeywordAgent Execution Failed", e);
        return {
            task_id: task.task_id,
            status: 'failed',
            execution_time: '0s',
            result: { error: e.message || "Unknown error" }
        };
    }
  }
}
