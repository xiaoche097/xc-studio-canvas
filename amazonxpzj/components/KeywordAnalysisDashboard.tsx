import React from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { HelpCircle, ChevronRight, CheckSquare, BarChart3, TrendingUp, Search } from 'lucide-react';
import { StreamingText } from './StreamingText';

export const KeywordAnalysisDashboard: React.FC = () => {
  const { relatedKeywords, selectedKeywordId, currentReport, status } = useAnalysisStore();

  const selectedKeyword = relatedKeywords.find(k => k.id === selectedKeywordId);

  if (!selectedKeyword) return (
     <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center animate-pulse">
           <Search size={32} />
        </div>
        <p>请在左侧选择关键词进行分析...</p>
     </div>
  );

  return (
    <div className="pb-20">
      {/* Title Header */}
      <div className="flex items-center gap-2 mb-4">
         <div className="w-1 h-6 bg-primary rounded-full"></div>
         <h1 className="text-xl font-bold text-gray-900">{selectedKeyword.keyword} 新品选品结果</h1>
         <HelpCircle size={16} className="text-gray-400 cursor-help" />
         <div className="ml-auto flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><Search size={18}/></button>
            <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><TrendingUp size={18}/></button>
         </div>
      </div>

      {/* Top Keyword Cards Row */}
      <div className="mb-8">
         <p className="text-sm text-gray-500 mb-3">以下为「{selectedKeyword.keyword}」相关度从高到低10个关键词：</p>
         <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar -mx-2 px-2">
            {relatedKeywords.map(kw => {
               const isActive = kw.id === selectedKeywordId;
               return (
                  <div 
                     key={kw.id} 
                     className={`
                        min-w-[240px] p-4 rounded-xl border bg-white flex flex-col gap-3 transition-all shrink-0
                        ${isActive ? 'border-primary ring-1 ring-primary shadow-md' : 'border-gray-200 hover:border-primary/50'}
                     `}
                  >
                     <div>
                        <div className="font-bold text-gray-900 text-lg">{kw.keyword}</div>
                        <div className="text-xs text-gray-400">{kw.cnKeyword}</div>
                     </div>
                     
                     <div className="flex items-center gap-3">
                        <div>
                           <div className="text-xs text-gray-400 mb-0.5">新品机会分</div>
                           <div className="text-2xl font-bold font-mono text-gray-900">{kw.score} <span className="text-xs text-gray-400 font-normal">分</span></div>
                        </div>
                        <div className="flex-1">
                           <div className="w-12 h-12 ml-auto bg-primary/5 rounded-full flex items-center justify-center text-primary">
                              <div className="w-8 h-8 border-2 border-primary rounded-lg transform rotate-45"></div>
                           </div>
                        </div>
                     </div>

                     <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                        击败同一级类目 <span className="font-bold text-gray-900">{kw.beatRatio}%</span> 关键词
                     </div>

                     <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                         <button className="flex-1 text-xs text-gray-500 hover:text-primary py-1">关键词评价</button>
                         <div className="w-px bg-gray-200 h-4 my-auto"></div>
                         <button className="flex-1 text-xs text-primary font-medium py-1">
                           {isActive ? '推荐' : '点击分析'}
                         </button>
                     </div>
                  </div>
               )
            })}
         </div>
      </div>

      {/* Detailed Analysis Content */}
      {status === 'analyzing' ? (
         <div className="space-y-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-100 rounded-xl"></div>
            <div className="grid grid-cols-2 gap-6">
               <div className="h-64 bg-gray-100 rounded-xl"></div>
               <div className="h-64 bg-gray-100 rounded-xl"></div>
            </div>
         </div>
      ) : currentReport ? (
         <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
            
            {/* Section 1: Summary */}
            <div className="mb-8">
               <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full"></span> 
                  1. 市场机会总结
               </h2>
               <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                  <div className="space-y-4">
                     {currentReport.summary.map((text, idx) => (
                        <div key={idx} className="flex gap-2">
                           <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>
                           <p className="text-sm text-gray-700 leading-relaxed font-medium">
                              {text.startsWith('市场评级') ? (
                                 <span>{text.split('：')[0]}：<span className="text-success font-bold">{text.split('：')[1]}</span></span>
                              ) : text}
                           </p>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Section 2: Analysis */}
            <div className="mb-8">
               <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full"></span> 
                  2. 市场情况分析
               </h2>
               
               <div className="space-y-6">
                  <div className="flex gap-3">
                     <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                     <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">供给情况：</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{currentReport.marketAnalysis.supply}</p>
                     </div>
                  </div>
                  <div className="flex gap-3">
                     <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                     <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">需求情况：</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{currentReport.marketAnalysis.demand}</p>
                     </div>
                  </div>
                   <div className="flex gap-3">
                     <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                     <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">商品销售情况：</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{currentReport.marketAnalysis.sales}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Section 3: Charts/Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Demand Chart Card */}
               <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-gray-900">需求情况</h3>
                  </div>
                  
                  <div className="space-y-6">
                     <div>
                        <div className="flex items-center gap-2 mb-2">
                           <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" className="h-4" alt="Amazon" />
                           <span className="text-xs font-bold text-gray-900">Amazon</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">最新1个月亚马逊搜索排名</p>
                        <div className="text-2xl font-bold text-gray-900 mb-2"># 1.3w+</div>
                        <div className="text-xs text-gray-400 mb-2">近12个月亚马逊搜索排名趋势</div>
                        {/* Mock Chart Area */}
                        <div className="h-16 w-full flex items-end gap-1">
                           {[20,30,25,40,35,50,60,55,40,30,80,90].map((h, i) => (
                              <div key={i} style={{height: `${h}%`}} className="flex-1 bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-colors"></div>
                           ))}
                        </div>
                     </div>
                     
                     <div>
                         <div className="flex items-center gap-2 mb-2">
                           <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">G</div>
                           <span className="text-xs font-bold text-gray-900">Google Trends</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">搜索峰值月（最近12个月）</p>
                        <div className="text-2xl font-bold text-gray-900 mb-2">11月</div>
                        <div className="text-xs text-gray-400 mb-2">近12个月谷歌搜索趋势</div>
                         {/* Mock Chart Area */}
                        <div className="h-16 w-full flex items-end">
                           <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                              <path d="M0 35 Q 10 30, 20 32 T 40 25 T 60 15 T 80 20 T 100 5" fill="none" stroke="#7C3AED" strokeWidth="2" />
                              <path d="M0 35 Q 10 30, 20 32 T 40 25 T 60 15 T 80 20 T 100 5 L 100 40 L 0 40 Z" fill="url(#grad)" opacity="0.1" />
                              <defs>
                                 <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#7C3AED" />
                                    <stop offset="100%" stopColor="white" />
                                 </linearGradient>
                              </defs>
                           </svg>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Supply Metrics Card */}
               <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                   <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-gray-900 flex items-center gap-1">供给情况 <HelpCircle size={14} className="text-gray-300"/></h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                     <div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                           在售商品数 <HelpCircle size={12} className="text-gray-300"/>
                        </div>
                        <div className="text-lg font-bold text-gray-900">{currentReport.metrics.supplyCount} <span className="text-xs font-normal text-red-500 bg-red-50 px-1 rounded ml-1">供给过剩</span></div>
                     </div>
                      <div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                           商品垄断系数 <HelpCircle size={12} className="text-gray-300"/>
                        </div>
                        <div className="text-lg font-bold text-gray-900">{currentReport.metrics.monopolyRate} <span className="text-xs font-normal text-green-500 bg-green-50 px-1 rounded ml-1">低垄断</span></div>
                     </div>
                      <div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                           品牌垄断系数 <HelpCircle size={12} className="text-gray-300"/>
                        </div>
                        <div className="text-lg font-bold text-gray-900">58.7% <span className="text-xs font-normal text-orange-500 bg-orange-50 px-1 rounded ml-1">品牌集中</span></div>
                     </div>
                      <div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                           中国卖家占比 <HelpCircle size={12} className="text-gray-300"/>
                        </div>
                        <div className="text-lg font-bold text-gray-900">{currentReport.metrics.chineseSellerRate} <span className="text-xs font-normal text-red-500 bg-red-50 px-1 rounded ml-1">竞争激烈</span></div>
                     </div>
                     <div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                           新品销量占比 <HelpCircle size={12} className="text-gray-300"/>
                        </div>
                        <div className="text-lg font-bold text-gray-900">42.6% <span className="text-xs font-normal text-blue-500 bg-blue-50 px-1 rounded ml-1">新品较易</span></div>
                     </div>
                     <div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                           商品平均评分 <HelpCircle size={12} className="text-gray-300"/>
                        </div>
                        <div className="text-lg font-bold text-gray-900">4.06 <span className="text-xs font-normal text-red-500 bg-red-50 px-1 rounded ml-1">口碑欠佳</span></div>
                     </div>
                  </div>
               </div>
            </div>

         </div>
      ) : null}
    </div>
  );
};