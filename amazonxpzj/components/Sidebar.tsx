import React from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { MessageSquare, ChevronDown, CheckCircle2, RotateCcw, RefreshCw, Sparkles, ChevronLeft } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { relatedKeywords, selectedKeywordId, selectKeyword, setView } = useAnalysisStore();

  return (
    <aside className="w-[340px] h-screen fixed left-0 top-0 bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-white/10 flex flex-col z-40 transition-colors duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
        <div className="flex items-center gap-2 text-brand-orange font-bold text-lg">
           <div className="w-6 h-6 bg-brand-orange rounded flex items-center justify-center text-white text-sm">S</div>
           SKYSPER
        </div>
        <span className="ml-auto text-xs text-gray-400">Selection AI</span>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        
        {/* Keyword Selection List */}
        {relatedKeywords.length > 0 ? (
          <div className="mb-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0">
                   <Sparkles size={16} />
                </div>
                <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-2xl rounded-tl-none text-sm text-gray-700 dark:text-gray-300">
                   为你匹配到以下关键词，请选择需要分析的关键词
                   <div className="mt-2 text-xs text-brand-orange flex items-center gap-1 cursor-pointer">
                      查看关键词数据 <ChevronDown size={12} />
                   </div>
                </div>
             </div>

             <div className="pl-11 space-y-2">
                {relatedKeywords.map((kw) => {
                   const isSelected = selectedKeywordId === kw.id;
                   return (
                      <div 
                        key={kw.id}
                        onClick={() => selectKeyword(kw.id)}
                        className={`
                          p-3 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden group
                          ${isSelected 
                             ? 'border-brand-orange bg-brand-orange/5 shadow-sm' 
                             : 'border-transparent bg-white dark:bg-white/5 shadow-sm hover:border-brand-orange/30'
                          }
                        `}
                      >
                         <div className="flex items-center justify-between mb-1">
                            <span className={`font-medium ${isSelected ? 'text-brand-orange' : 'text-gray-800 dark:text-gray-200'}`}>
                               {kw.keyword} <span className="text-xs font-normal text-gray-400 ml-1">{kw.cnKeyword}</span>
                            </span>
                            {isSelected && <CheckCircle2 size={16} className="text-brand-orange" />}
                         </div>
                         <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span>排名: <span className="font-mono">{kw.searchRank}</span></span>
                            <span>销量: <span className="font-mono">{kw.sales}</span></span>
                         </div>
                      </div>
                   )
                })}
             </div>

             <div className="pl-11 mt-4">
                <button className="w-full py-2 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
                   查看全部 <ChevronDown size={12} className="inline ml-1" />
                </button>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
             <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center mb-3">
               <RotateCcw size={20} className="animate-spin-slow" />
             </div>
             <p>正在分析关键词...</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#121212]">
         <button className="w-full py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 font-medium rounded-lg mb-3 transition-colors text-sm">
            确认选择
         </button>
         
         <div className="flex items-center justify-between text-xs text-brand-orange font-medium">
            <button className="flex items-center gap-1 hover:text-orange-400 p-2">
               <RotateCcw size={14} /> 回放结束
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 border border-brand-orange rounded-full hover:bg-brand-orange/10">
               <Sparkles size={14} /> 做同款
            </button>
            <button className="flex items-center gap-1 bg-brand-orange text-white px-3 py-1.5 rounded-full hover:bg-orange-600 shadow-sm shadow-orange-500/30">
               <RefreshCw size={14} /> 重播
            </button>
         </div>
      </div>
    </aside>
  );
};