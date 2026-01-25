import { create } from 'zustand';
import { FilterFormData, KeywordNode, MarketReport } from '../types';
import { MOCK_KEYWORDS, MOCK_REPORT } from '../constants';

interface AnalysisState {
  view: 'landing' | 'analysis';
  filters: FilterFormData;
  
  // Status
  status: 'idle' | 'searching' | 'analyzing' | 'completed';
  
  // Data
  relatedKeywords: KeywordNode[];
  selectedKeywordId: string | null;
  currentReport: MarketReport | null;

  // Actions
  setView: (view: 'landing' | 'analysis') => void;
  setFilters: (filters: Partial<FilterFormData>) => void;
  startSearch: (keyword: string, images?: string[], isInternetSearch?: boolean) => Promise<void>;
  selectKeyword: (id: string) => Promise<void>;
  reset: () => void;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  view: 'landing',
  filters: {
    keyword: '',
    platform: 'Amazon',
    country: '美国',
  },
  status: 'idle',
  relatedKeywords: [],
  selectedKeywordId: null,
  currentReport: null,

  setView: (view) => set({ view }),
  setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  reset: () => set({
    view: 'landing',
    status: 'idle',
    relatedKeywords: [],
    selectedKeywordId: null,
    currentReport: null
  }),

  startSearch: async (keyword: string, images: string[] = [], isInternetSearch: boolean = false) => {
    set({ 
      view: 'analysis', 
      status: 'searching', 
      filters: { ...get().filters, keyword, images, isInternetSearch },
      relatedKeywords: [],
      selectedKeywordId: null,
      currentReport: null
    });

    await delay(1500); // Simulate AI searching keywords

    set({ 
      relatedKeywords: MOCK_KEYWORDS,
      status: 'idle' 
    });
    
    // Automatically select the recommended one or first one
    const recommended = MOCK_KEYWORDS.find(k => k.isRecommended) || MOCK_KEYWORDS[0];
    get().selectKeyword(recommended.id);
  },

  selectKeyword: async (id: string) => {
    const currentId = get().selectedKeywordId;
    if (currentId === id) return;

    set({ selectedKeywordId: id, status: 'analyzing', currentReport: null });
    
    await delay(1200); // Simulate generating report

    set({ 
      currentReport: MOCK_REPORT,
      status: 'completed'
    });
  }
}));