import { create } from 'zustand';
import { FilterFormData, ExecutionStep, KeywordNode, MarketReport, Product } from '../types';
import { orchestrator } from '../services/agents/orchestrator';

interface AnalysisState {
  view: 'landing' | 'analysis';
  filters: FilterFormData;

  // Status
  status: 'idle' | 'searching' | 'analyzing' | 'completed' | 'error';

  // Data
  relatedKeywords: KeywordNode[];
  selectedKeywordId: string | null;
  currentReport: MarketReport | null;
  executionSteps: ExecutionStep[];

  // Actions
  setView: (view: 'landing' | 'analysis') => void;
  setFilters: (filters: Partial<FilterFormData>) => void;
  startSearch: (keyword: string, images?: string[], isInternetSearch?: boolean) => Promise<void>;
  selectKeyword: (id: string) => Promise<void>;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  view: 'landing',
  filters: {
    keyword: '',
    platform: 'Amazon',
    country: 'USA',
    model: 'gemini-3-pro-preview'
  },
  status: 'idle',
  relatedKeywords: [],
  selectedKeywordId: null,
  currentReport: null,
  executionSteps: [],

  setView: (view) => set({ view }),
  setFilters: (filters) => set(state => ({ filters: { ...state.filters, ...filters } })),

  reset: () => set({
    view: 'landing',
    status: 'idle',
    relatedKeywords: [],
    selectedKeywordId: null,
    currentReport: null,
    executionSteps: []
  }),

  startSearch: async (keyword: string, images: string[] = [], isInternetSearch: boolean = false) => {
    // 1. Initialize State
    set({
      view: 'analysis',
      status: 'searching',
      filters: { ...get().filters, keyword, images, isInternetSearch },
      relatedKeywords: [],
      selectedKeywordId: null,
      currentReport: null,
      executionSteps: []
    });

    try {
      // 2. Planning Phase with Orchestrator
      const planId = 'plan-' + Date.now();
      set(state => ({
        executionSteps: [...state.executionSteps, {
          id: planId,
          type: 'plan',
          title: '任务拆解规划',
          status: 'loading',
          content: '正在拆解用户需求并制定执行计划...',
          timestamp: Date.now()
        }]
      }));

      // Call Orchestrator Plan
      const plan = await orchestrator.plan(keyword, get().filters);

      // Update Plan Step
      set(state => ({
        executionSteps: state.executionSteps.map(s => s.id === planId ? {
          ...s,
          status: 'completed',
          content: {
            description: '根据您的需求，我将执行以下任务：',
            tasks: plan.tasks.map(t => t.task_name)
          }
        } : s)
      }));

      // 3. Execution Phase
      let contextData: any = {};

      for (const task of plan.tasks) {
        const stepId = task.task_id;

        // Map task_type to ExecutionStep type
        let stepType: 'analysis' | 'search' | 'report' = 'analysis';
        if (task.task_type.includes('search') || task.task_type.includes('product')) stepType = 'search';
        if (task.task_type.includes('report')) stepType = 'report';

        // Add Step to UI
        set(state => ({
          executionSteps: [...state.executionSteps, {
            id: stepId,
            type: stepType,
            title: task.task_name,
            status: 'loading',
            content: task.description,
            timestamp: Date.now()
          }]
        }));

        // Inject Accumulated Context for Report Agent
        if (task.agent === 'report_agent') {
          if (!task.params) task.params = {};
          task.params.context = JSON.stringify(contextData);
          // Disable internet for report agent to prioritize context synthesis and avoid tool call timeouts
          task.params.isInternetSearch = false;
        }

        // Execute via Orchestrator
        const response = await orchestrator.dispatch(task);

        // Determine detailType and extract data based on task type
        let detailType: 'keywords' | 'products' | 'report' | undefined;
        let data: any;
        let summary: string;

        if (task.task_type.includes('keyword') || task.agent === 'keyword_agent') {
          detailType = 'keywords';
          data = response.result?.keywords || [];
          summary = response.result?.summary || '关键词分析完成';
          contextData.keywords = data; // Accumulate
          contextData.keywordSummary = summary;
        } else if (task.task_type.includes('product') || task.agent === 'product_agent') {
          detailType = 'products';
          data = response.result?.products || [];
          summary = response.result?.summary || '商品数据获取完成';
          contextData.products = data; // Accumulate
          contextData.productSummary = summary;
        } else if (task.task_type.includes('market') || task.agent === 'market_agent') {
          // Add handling for market agent data accumulation
          contextData.marketAnalysis = response.result;
          data = response.result;
          summary = task.description;
        } else if (task.task_type.includes('report') || task.agent === 'report_agent') {
          detailType = 'report';
          data = response.result || {};
          summary = response.result?.summary || '报告生成完成';
        } else {
          data = response.result;
          summary = task.description;
        }

        // Update Step with Result
        set(state => ({
          executionSteps: state.executionSteps.map(s => s.id === stepId ? {
            ...s,
            status: 'completed',
            result: {
              detailType,
              data,
              summary
            }
          } : s)
        }));
      }

      set({ status: 'completed' });

    } catch (error) {
      console.error("Agent Execution Failed:", error);
      set({ status: 'error' });
      // Optionally add an error step
      set(state => ({
        executionSteps: [...state.executionSteps, {
          id: 'error-' + Date.now(),
          type: 'analysis',
          title: '执行出错',
          status: 'error',
          content: `系统运行遇到问题: ${(error as Error).message || JSON.stringify(error)}`,
          timestamp: Date.now()
        }]
      }));
    }
  },

  selectKeyword: async (id: string) => {
    // Legacy support or placeholder
    const currentId = get().selectedKeywordId;
    if (currentId === id) return;
    set({ selectedKeywordId: id });
  }
}));