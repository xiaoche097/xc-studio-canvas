import { AgentTask, AgentPlan, AgentResponse } from './types';
import { KeywordAgent } from './keywordAgent';
import { ProductAgent } from './productAgent';
import { ReportAgent } from './reportAgent';
import { MarketAgent } from './marketAgent';
import { callAgent } from '../geminiService';
import { ORCHESTRATOR_PROMPT } from './prompts';
import { generateMockPlan, generateMockKeywordResponse, generateMockProductResponse, generateMockReportResponse } from './mockData';

// Enable mock mode for development/testing
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_AGENTS === 'true';

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

    // Use mock data if enabled
    if (USE_MOCK_DATA) {
      console.log('[Orchestrator] Using mock plan data');
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
      return generateMockPlan(userRequest, filters);
    }

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
       // Fallback to mock data on error
       console.log('[Orchestrator] Falling back to mock plan data');
       return generateMockPlan(userRequest, filters);
    }
  }

  /**
   * Skill 3: Dispatch Tasks
   */
  async dispatch(task: AgentTask): Promise<AgentResponse> {
    // Use mock data if enabled
    if (USE_MOCK_DATA) {
      console.log(`[Orchestrator] Using mock data for ${task.agent}`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay

      switch (task.agent) {
        case 'keyword_agent':
          return generateMockKeywordResponse(task.task_id);
        case 'product_agent':
          return generateMockProductResponse(task.task_id);
        case 'report_agent':
          return generateMockReportResponse(task.task_id);
        case 'market_agent':
          return generateMockProductResponse(task.task_id);
        default:
          throw new Error(`Unknown agent: ${task.agent}`);
      }
    }

    // Real agent execution
    try {
      switch (task.agent) {
        case 'keyword_agent':
          return await this.keywordAgent.execute(task);
        case 'product_agent':
          return await this.productAgent.execute(task);
        case 'report_agent':
          return await this.reportAgent.execute(task);
        case 'market_agent':
          return await this.marketAgent.execute(task);
        default:
          throw new Error(`Unknown agent: ${task.agent}`);
      }
    } catch (error) {
      console.error(`[Orchestrator] Agent ${task.agent} failed:`, error);
      // Fallback to mock data on error
      console.log(`[Orchestrator] Falling back to mock data for ${task.agent}`);

      switch (task.agent) {
        case 'keyword_agent':
          return generateMockKeywordResponse(task.task_id);
        case 'product_agent':
          return generateMockProductResponse(task.task_id);
        case 'report_agent':
          return generateMockReportResponse(task.task_id);
        case 'market_agent':
          return generateMockProductResponse(task.task_id);
        default:
          throw error;
      }
    }
  }
}

export const orchestrator = new Orchestrator();
