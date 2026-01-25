import React from 'react';
import { MarketReport } from '../../types';
import { Sparkline } from './Sparkline';
import { Check, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface FullReportViewProps {
  data: MarketReport | any;
}

export const FullReportView: React.FC<FullReportViewProps> = ({ data }) => {
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-[#121212] min-h-screen p-8 md:p-12 shadow-sm rounded-none md:rounded-xl">
       {/* Report Header */}
       <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            美国亚马逊户外背包市场分析与选品建议
          </h1>
          <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-4 text-purple-800 dark:text-purple-200 text-sm leading-relaxed border border-purple-100 dark:border-purple-500/10">
            <span className="font-bold">核心结论：</span> 户外背包市场在2024年Q1保持稳健增长，"轻量化" 与 "通勤兼容" 成为最显著的增长点。建议重点布局 Hydration Backpack 及 Daypack 细分赛道，避开头部垄断严重的专业登山包市场。
          </div>
       </div>

       {/* Section 1: Market Overview */}
       <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
             <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
             一、市场概况与趋势
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-7 mb-6">
             根据最近一年的销售数据，该品类呈现明显的季节性波动，夏季为销售高峰。整体市场容量约 1.2亿美金/月，平均客单价在 $35-$55 区间。
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <DataCard label="月均搜索量" value="450K+" trend="+12%" />
             <DataCard label="平均转化率" value="8.5%" trend="-2%" negative />
             <DataCard label="新品成功率" value="15%" trend="+3%" />
          </div>
       </div>

       {/* Section 2: Opportunity Analysis */}
       <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
             <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
             二、机会细分：Hydration Backpack (水袋包)
          </h2>
          
          {/* Detailed Metric Card */}
          <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 border border-gray-100 dark:border-white/5 mb-6">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center text-2xl shadow-sm">💧</div>
                   <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">Hydration Backpack</h3>
                      <p className="text-xs text-gray-500">竞争程度: 中 | 利润空间: 高</p>
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-2xl font-bold text-gray-900 dark:text-white">4.5w+</div>
                   <div className="text-xs text-gray-400">月搜索量</div>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-white dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                    <div className="text-xs text-gray-500 mb-1">价格带分布</div>
                    <div className="h-16 flex items-end gap-1">
                       {[30, 60, 45, 80, 50, 20].map((h, i) => (
                          <div key={i} className="flex-1 bg-brand-orange/20 rounded-t-sm relative group">
                             <div className="absolute bottom-0 w-full bg-brand-orange rounded-t-sm transition-all duration-500" style={{ height: `${h}%` }}></div>
                          </div>
                       ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                       <span>$20</span>
                       <span>$80+</span>
                    </div>
                 </div>
                 
                 <div className="p-4 bg-white dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                    <div className="text-xs text-gray-500 mb-1">评论星级趋势</div>
                    <div className="h-16 flex items-center justify-center">
                        <div className="w-full text-center text-gray-400 text-xs">暂无趋势数据</div>
                    </div>
                 </div>
             </div>
          </div>

          <p className="text-gray-600 dark:text-gray-300 text-sm leading-7">
             <span className="font-bold text-gray-900 dark:text-white">分析结论：</span> 该细分市场头部品牌稍弱，用户对于 "漏水" 和 "清洁难" 的痛点非常集中。能够解决这两个痛点，且定价在 $35-$45 的产品更有机会突围。
          </p>
       </div>

       {/* Section 3: Recommendations */}
       <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
             <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
             三、选品建议与行动指南
          </h2>
          
          <div className="space-y-4">
             <RecommendationItem 
               type="success" 
               title="产品定位" 
               content="建议定位为 '短途徒步水袋包'，主打轻量化与防漏水设计。材质建议选用 420D 尼龙以平衡耐用与重量。" 
             />
             <RecommendationItem 
               type="info" 
               title="营销卖点" 
               content="重点宣传 'BPA Free 材质'、'大开口易清洗' 以及 '2L 黄金容量'。视频广告展示跑步时不晃动的稳定性。" 
             />
             <RecommendationItem 
               type="warning" 
               title="供应链风险" 
               content="水袋属于食品接触类产品，需确保通过 FDA 认证，且出厂前需进行 100% 试水测试，避免差评灾难。" 
             />
          </div>
       </div>

    </div>
  );
};

const DataCard = ({ label, value, trend, negative = false }: any) => (
  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
     <div className="text-xs text-gray-500 mb-1">{label}</div>
     <div className="flex items-end justify-between">
        <span className="text-xl font-bold text-gray-900 dark:text-white">{value}</span>
        <span className={`text-xs font-medium ${negative ? 'text-red-500' : 'text-green-500'} flex items-center`}>
           {negative ? <TrendingUp className="rotate-180 mr-1" size={12} /> : <TrendingUp className="mr-1" size={12} />}
           {trend}
        </span>
     </div>
  </div>
);

const RecommendationItem = ({ type, title, content }: any) => {
  const styles = {
    success: { bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-100 dark:border-green-500/20', icon: 'text-green-600', Icon: Check },
    warning: { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-100 dark:border-orange-500/20', icon: 'text-orange-600', Icon: AlertTriangle },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-500/20', icon: 'text-blue-600', Icon: Info }
  }[type as 'success' | 'warning' | 'info'];
  
  const Icon = styles.Icon;

  return (
    <div className={`p-4 rounded-xl border ${styles.bg} ${styles.border} flex gap-4`}>
       <div className={`mt-0.5 shrink-0 ${styles.icon}`}>
          <Icon size={18} />
       </div>
       <div>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{title}</h4>
          <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">{content}</p>
       </div>
    </div>
  )
}
