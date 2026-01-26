import React, { useState } from 'react';
import { KeywordData, Product, MarketReport } from '../../types';
import { Sparkline } from './Sparkline';
import { X, ExternalLink, Maximize2, RotateCcw, Download } from 'lucide-react';
import { ProductList } from './ProductList';
import { KeywordAnalysis } from './KeywordAnalysis';
import { FullReportView } from './FullReportView';
import { ErrorBoundary } from '../ErrorBoundary';

interface DetailModalProps {
   isOpen: boolean;
   onClose: () => void;
   title: string;
   type: 'keywords' | 'products' | 'report' | 'market';
   data: any;
}

export const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, title, type, data }) => {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
         <div className="bg-white dark:bg-[#1a1a1a] w-[95vw] h-[90vh] max-w-[1400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-white/10">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#1a1a1a]">
               <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                  <div className="flex items-center gap-2">
                     {type === 'keywords' && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium">关键词分析</span>}
                     {type === 'products' && <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full font-medium">商品分析</span>}
                     {(type === 'report' || type === 'market') && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">深度报告</span>}
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                     <ExpandIcon />
                  </button>
                  <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-gray-400 transition-colors">
                     <X size={20} />
                  </button>
               </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-[#121212] p-6 custom-scrollbar">
               <ErrorBoundary>
                  <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm p-1 min-h-[500px]">
                     {type === 'keywords' ? (
                        <KeywordAnalysisBigTable data={data} />
                     ) : type === 'products' ? (
                        <ProductList products={data} />
                     ) : (
                        <FullReportView data={data} />
                     )}
                  </div>
               </ErrorBoundary>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#1a1a1a] flex justify-between items-center">
               <div className="text-xs text-gray-400">
                  数据来源: Amazon Official API • 更新时间: {new Date().toLocaleTimeString()}
               </div>
               <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Download size={16} />
                  导出数据
               </button>
            </div>
         </div>
      </div>
   );
};

const ExpandIcon = () => (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
   </svg>
);

// Specialized Layout for Full Screen Keyword Table
const KeywordAnalysisBigTable: React.FC<{ data: KeywordData[] }> = ({ data }) => {
   return (
      <div className="overflow-x-auto">
         <table className="w-full text-sm text-left border-separate border-spacing-y-2">
            <thead className="text-gray-400 font-medium text-xs uppercase tracking-wider">
               <tr>
                  <th className="px-6 py-4 w-64">搜索词 / 排名</th>
                  <th className="px-6 py-4 w-32">趋势</th>
                  <th className="px-6 py-4 min-w-[400px]">核心类目分布</th>
                  <th className="px-6 py-4 w-24 text-right">月搜索量</th>
                  <th className="px-6 py-4 w-24 text-right">点击占比</th>
                  <th className="px-6 py-4 w-24 text-right">转化占比</th>
                  <th className="px-6 py-4 w-32 text-right">月销售额</th>
                  <th className="px-6 py-4 w-24 text-right">竞争度</th>
               </tr>
            </thead>
            <tbody className="divide-y-0 text-xs">
               {data.map((item, idx) => (
                  <tr key={idx} className="bg-white hover:bg-gray-50 dark:bg-[#1a1a1a] dark:hover:bg-white/5 transition-shadow shadow-sm hover:shadow-md rounded-lg group">
                     {/* Keyword & Rank */}
                     <td className="px-6 py-6 rounded-l-lg align-top">
                        <div className="flex flex-col gap-1">
                           <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{item.keyword}</span>
                           <span className="text-gray-400 font-mono">#{item.searchRank?.toLocaleString() || 'N/A'}</span>
                        </div>
                     </td>

                     {/* Trend */}
                     <td className="px-6 py-6 align-top">
                        {item.trendData && item.trendData.length > 0 ? (
                           <div className="w-24 h-8 opacity-70 group-hover:opacity-100 transition-opacity">
                              <Sparkline data={item.trendData} color="#8B5CF6" />
                           </div>
                        ) : (
                           <span className="text-gray-300">N/A</span>
                        )}
                     </td>

                     {/* Category Distribution - Detailed List */}
                     <td className="px-6 py-6 align-top">
                        <div className="space-y-2">
                           {item.categoryDistribution && item.categoryDistribution.length > 0 ? (
                              item.categoryDistribution.map((cat, i) => (
                                 <div key={i} className="flex items-start text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    <span className="font-mono text-gray-400 w-12 shrink-0 text-right mr-3">({cat.percentage}%)</span>
                                    <span className="break-words text-gray-600 dark:text-gray-300">{cat.category.replace(/->/g, ' > ')}</span>
                                 </div>
                              ))
                           ) : (
                              <span className="text-gray-300">无数据</span>
                           )}
                        </div>
                     </td>

                     {/* Metrics */}
                     <td className="px-6 py-6 text-right text-gray-600 dark:text-gray-300 font-mono align-top">
                        1.4w+
                     </td>
                     <td className="px-6 py-6 text-right text-gray-600 dark:text-gray-300 font-mono align-top">
                        61.9%
                     </td>
                     <td className="px-6 py-6 text-right text-gray-600 dark:text-gray-300 font-mono align-top">
                        11.7%
                     </td>
                     <td className="px-6 py-6 text-right font-medium text-gray-900 dark:text-white font-mono align-top">
                        {item.monthlySearchVolume || '€0'}
                     </td>
                     <td className="px-6 py-6 text-right text-gray-600 dark:text-gray-300 font-mono rounded-r-lg align-top">
                        {item.competitionIndex?.toLocaleString() || 'N/A'}
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}
