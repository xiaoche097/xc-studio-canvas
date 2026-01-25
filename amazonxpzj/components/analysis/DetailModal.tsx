import React, { useState } from 'react';
import { KeywordData, Product, MarketReport } from '../../types';
import { Sparkline } from './Sparkline';
import { X, ExternalLink, Maximize2, RotateCcw, Download } from 'lucide-react';
import { ProductList } from './ProductList';
import { KeywordAnalysis } from './KeywordAnalysis';
import { FullReportView } from './FullReportView';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'keywords' | 'products' | 'report';
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
                 {type === 'report' && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">深度报告</span>}
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
           <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm p-1 min-h-[500px]">
              {type === 'keywords' ? (
                 <KeywordAnalysisBigTable data={data} />
              ) : type === 'products' ? (
                 <ProductList products={data} />
              ) : (
                 <FullReportView data={data} />
              )}
           </div>
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
      <table className="w-full text-sm text-left">
         <thead className="bg-[#F9FAFB] dark:bg-white/5 text-gray-500 font-medium">
            <tr>
               <th className="px-6 py-4 w-48">关键词</th>
               <th className="px-6 py-4 w-32">亚马逊搜索排名</th>
               <th className="px-6 py-4 w-40">亚马逊趋势数据</th>
               <th className="px-6 py-4">关键词核心类目分布</th>
            </tr>
         </thead>
         <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {data.map((item, idx) => (
               <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-6 font-medium text-gray-900 dark:text-gray-100">{item.keyword}</td>
                  <td className="px-6 py-6 font-mono text-gray-600 dark:text-gray-300">{item.searchRank}</td>
                  <td className="px-6 py-6">
                     <div className="w-32 h-10">
                        <Sparkline data={item.trendData} color="#8B5CF6" />
                     </div>
                  </td>
                  <td className="px-6 py-6">
                     <div className="space-y-1.5 max-w-2xl">
                        {item.categoryDistribution.map((cat, i) => (
                           <div key={i} className="flex items-start text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                              <span className="font-mono text-gray-400 w-14 shrink-0">({cat.percentage}%) - </span>
                              <span className="break-words">{cat.category}</span>
                           </div>
                        ))}
                     </div>
                  </td>
               </tr>
            ))}
         </tbody>
      </table>
    </div>
  );
}
