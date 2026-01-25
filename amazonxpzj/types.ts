export interface AnalysisType {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  isHot?: boolean;
}

export interface FilterFormData {
  keyword: string;
  platform: 'Amazon' | 'TikTok';
  country: string;
  countries?: string[];
  timeRange?: number;
  images?: string[];
  isInternetSearch?: boolean;
}

export interface KeywordNode {
  id: string;
  keyword: string;
  cnKeyword: string;
  score: number;
  beatRatio: number;
  searchRank: string;
  sales: string;
  isRecommended?: boolean;
}

export interface MarketReport {
  summary: string[];
  marketAnalysis: {
    supply: string;
    demand: string;
    sales: string;
  };
  metrics: {
    supplyCount: string;
    monopolyRate: string;
    chineseSellerRate: string;
    avgPrice: string;
  };
}

export interface LandingCase {
  id: string;
  title: string;
  desc: string;
  image: string;
  tag: string;
}

export interface Metric {
  id: string;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'success' | 'warning' | 'danger';
  suffix?: string;
}

export interface KeywordData {
  keyword: string;
  searchRank: number;
  trendData: number[];
  categoryDistribution: {
    category: string;
    percentage: number;
  }[];
}

export interface TaskResult {
  summary: string;
  detailType?: 'keywords' | 'products' | 'report';
  data?: any;
}

export interface Product {
  id: string;
  image: string;
  title: string;
  rating: string | number;
  reviewCount: string | number;
  currency: string;
  price: string;
  listingDate: string;
  rank?: string;
  salesRank?: number;
  country?: string;
  platform?: string;
  category?: string;
  highlights?: string[];
}

export interface ExecutionStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  type: 'plan' | 'search' | 'analysis' | 'report';
  content?: any;
  products?: Product[];
  result?: TaskResult;
  timestamp: number;
}