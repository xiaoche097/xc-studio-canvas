import { AgentTask, AgentPlan, AgentResponse } from './types';
import { KeywordAgent } from './keywordAgent';
import { ProductAgent } from './productAgent';
import { ReportAgent } from './reportAgent';
import { MarketAgent } from './marketAgent'; // MarketAgent Created
import { callAgent } from '../geminiService';
import { ORCHESTRATOR_PROMPT } from './prompts';

export class Orchestrator {
  private keywordAgent: KeywordAgent;
  private productAgent: ProductAgent;
  private reportAgent: ReportAgent;
  private marketAgent: MarketAgent;

  constructor() {
    this.keywordAgent = new KeywordAgent();
    this.productAgent = new ProductAgent();
    this.reportAgent = new ReportAgent();
    this.marketAgent = new MarketAgent();
  }

  /**
   * Skill 1 & 2: Parse Intent and Plan Tasks
   * Based on Markdown Orchestrator Agent Prompt
   */
  async plan(userRequest: string, filters: any): Promise<AgentPlan> {
    console.log(`[Orchestrator] Planning for: ${userRequest}`);
    
    const context = {
      description: "User wants to analyze a product/market.",
      original_request: userRequest,
      filters: filters
    };
    
    const userMessage = `Request: ${userRequest}\nContext: ${JSON.stringify(context)}`;
    
    try {
      const response = await callAgent(ORCHESTRATOR_PROMPT, userMessage);
      // Clean up markdown block if present (```json ... ```)
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
       console.error("Orchestrator Plan Error:", error);
       // Fallback for safety or throw
       throw error;
    }
  }

  /**
   * Skill 3: Dispatch Tasks
   */
  async dispatch(task: AgentTask): Promise<AgentResponse> {
    switch (task.agent) {
      case 'keyword_agent':
        return this.keywordAgent.execute(task);
      case 'product_agent':
        return this.productAgent.execute(task);
      case 'report_agent':
        return this.reportAgent.execute(task);
      case 'market_agent':
        return this.marketAgent.execute(task);
      default:
        throw new Error(`Unknown agent: ${task.agent}`);
    }
  }
}

export const orchestrator = new Orchestrator();
