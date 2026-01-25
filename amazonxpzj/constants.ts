import { AnalysisType, LandingCase, KeywordNode, MarketReport } from './types';

export const LANDING_FEATURES: AnalysisType[] = [
  {
    id: 'new_product',
    icon: 'Sparkles',
    title: '图搜全球商机',
    subtitle: '上传图片一键分析全球',
    isHot: true
  },
  {
    id: 'new_product', // Using same ID for demo
    icon: 'Zap',
    title: '新品机会分析',
    subtitle: '秒级对比百款新品',
    isHot: true
  },
  {
    id: 'improvement',
    icon: 'TrendingUp',
    title: '爆品改进机会发现',
    subtitle: 'AI精准分析海量评价'
  },
  {
    id: 'platform_migration',
    icon: 'ArrowLeftRight',
    title: '平台间迁移机会',
    subtitle: '动态识别同款商品流向'
  },
  {
    id: 'country_migration',
    icon: 'Globe',
    title: '国家间迁移机会',
    subtitle: '洞悉全球商品流动'
  }
];

export const ANALYSIS_TYPES = LANDING_FEATURES;

export const SITE_OPTIONS: Record<string, { code: string; name: string; flag: string }[]> = {
  'Amazon': [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    { code: 'IN', name: 'India', flag: '🇮🇳' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  ],
  'TikTok': [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
    { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
    { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
    { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  ]
};

export const COUNTRIES = SITE_OPTIONS['Amazon'];

export const LANDING_CASES: LandingCase[] = [
  {
    id: '1',
    title: '海外爆火瑜伽裤新品机会',
    desc: '一键分析美国瑜伽裤新品机会，不再错过下一个"Lululemon"！',
    image: 'https://images.unsplash.com/photo-1544367563-12123d897571?q=80&w=500&auto=format&fit=crop',
    tag: '机会新品选品'
  },
  {
    id: '2',
    title: '美国热销扫地机器人痛点',
    desc: '分析亚马逊扫地机器人的致命差评，智能生成"差评转五星"的改良方案',
    image: 'https://images.unsplash.com/photo-1589923188900-85dae5233c95?q=80&w=500&auto=format&fit=crop',
    tag: '商品改进选品发现'
  },
  {
    id: '3',
    title: '亚马逊很火的户外玩具',
    desc: '有哪些户外玩具产品在亚马逊逆卖的很火但Tiktok还没人卖？',
    image: 'https://images.unsplash.com/photo-1596464716127-f9a08107e05e?q=80&w=500&auto=format&fit=crop',
    tag: '平台迁移选品发现'
  }
];

export const MOCK_KEYWORDS: KeywordNode[] = [
  { 
    id: 'k1', 
    keyword: 'flare yoga pants', 
    cnKeyword: '喇叭瑜伽裤',
    score: 53.2, 
    beatRatio: 84.0,
    searchRank: '9.3w+',
    sales: '1.5w+'
  },
  { 
    id: 'k2', 
    keyword: 'flared yoga pants', 
    cnKeyword: '喇叭瑜伽裤',
    score: 55.0, 
    beatRatio: 88.8,
    searchRank: '10.8w+',
    sales: '1.1w+'
  },
  { 
    id: 'k3', 
    keyword: 'bell bottom yoga pants', 
    cnKeyword: '喇叭瑜伽裤',
    score: 51.4, 
    beatRatio: 77.7,
    searchRank: '81.5w+',
    sales: '6.9k+'
  },
  { 
    id: 'k4', 
    keyword: 'flare leggings', 
    cnKeyword: '喇叭瑜伽裤',
    score: 54.8, 
    beatRatio: 88.5,
    searchRank: '1.3w+',
    sales: '1.2w+',
    isRecommended: true
  },
  { 
    id: 'k5', 
    keyword: 'flared leggings', 
    cnKeyword: '喇叭瑜伽裤',
    score: 51.4, 
    beatRatio: 77.8,
    searchRank: '3.5w+',
    sales: '1w+'
  }
];

export const MOCK_REPORT: MarketReport = {
  summary: [
    '市场评级：✅ 推荐进入。需求稳定且增长持续，供给格局存在结构性机会',
    '市场总结：市场具备稳健需求与持续增长动能，新品有切入空间，虽品牌与商品集中度低，流量门槛适中，适合通过差异化策略稳步入场。'
  ],
  marketAnalysis: {
    supply: '在售商品数量过剩，落后于79.7%的同类市场；商品垄断系数较低（0.13），市场分散，竞争充分；品牌垄断系数为0.587，处于中等水平，头部未形成绝对壁垒；中国卖家占比高达88.8%，竞争环境高度内卷，运营与成本控制要求高。',
    demand: 'Amazon搜索排名近期稳定在1.3万左右，近一年趋势呈现「先升后降再回升」的U型走势，2025年10-11月排名回升至高位，市场热度显著回升；Google Trends显示11月搜索热度快速攀升至64（峰值为100），需求正快速萌芽，站内外趋势共振，非季节性回落，具备持续增长潜力。',
    sales: '近30天销量达12,880，处于行业中上水平；销量环比增长17.38%，销售额环比增长23.73%，市场处于明确的增长通道，且销售额增速高于销量增速，暗示客单或溢价能力提升，市场动能强劲。'
  },
  metrics: {
    supplyCount: '1.2k+',
    monopolyRate: '13.4%',
    chineseSellerRate: '88.8%',
    avgPrice: '4.06'
  }
};