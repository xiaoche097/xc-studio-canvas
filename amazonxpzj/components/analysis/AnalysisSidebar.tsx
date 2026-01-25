import React from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { ChevronLeft, Check, Sparkles, RefreshCw, Hexagon } from 'lucide-react';

const MOCK_SIDEBAR_KEYWORDS = [
  { id: '1', text: 'flare yoga pants', rank: '9.5w+', vol: '1.5w+', recommended: true },
  { id: '2', text: 'flared yoga pants', rank: '10.3w+', vol: '1.1w+', recommended: true },
  { id: '3', text: 'bell bottom yoga pants', rank: '81.5w+', vol: '6.9k+', recommended: false },
  { id: '4', text: 'flare leggings', rank: '1.3w+', vol: '1.2w+', recommended: false, selected: true },
  { id: '5', text: 'flared leggings', rank: '3.5w+', vol: '1w+', recommended: false },
];

export const AnalysisSidebar: React.FC = () => {
  const { setView, filters } = useAnalysisStore();

  return (
    <div className="w-[320px] bg-white dark:bg-[#121212] border-r border-gray-100 dark:border-white/5 h-full flex flex-col shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Keyword Matching Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
             <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0">
                <Hexagon size={16} />
             </div>
             <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                为你匹配到以下关键词，请选择需要分析的关键词
             </p>
          </div>
          
          <button className="text-xs text-brand-orange font-medium mb-3 flex items-center gap-1 hover:underline px-1">
             查看关键词数据 <ChevronLeft size={10} className="-rotate-90" />
          </button>

          <div className="space-y-3">
             {MOCK_SIDEBAR_KEYWORDS.map((kw) => (
               <div 
                 key={kw.id} 
                 className={`group relative p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                   kw.selected 
                   ? 'bg-white dark:bg-[#1a1a1a] border-brand-orange shadow-md shadow-orange-500/10' 
                   : 'bg-white dark:bg-[#1a1a1a] border-transparent hover:border-gray-200 dark:hover:border-white/10 shadow-sm'
                 }`}
               >
                 <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-900 dark:text-white text-sm">{kw.text}</span>
                    {kw.selected && <Check size={14} className="text-brand-orange" />}
                 </div>
                 <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span>排名: <span className="text-gray-600 dark:text-gray-300 font-medium">{kw.rank}</span></span>
                    <span>销量: <span className="text-gray-600 dark:text-gray-300 font-medium">{kw.vol}</span></span>
                 </div>
                 <div className="absolute inset-0 border-2 border-brand-orange rounded-xl opacity-0 scale-95 pointer-events-none transition-all duration-300 group-hover:scale-100 group-hover:opacity-100" />
               </div>
             ))}
          </div>
          
          <div className="mt-4 text-center">
             <button className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center justify-center gap-1 w-full py-2">
                查看全部 <ChevronLeft size={10} className="-rotate-90" />
             </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 space-y-3">
         <button className="w-full h-11 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm">
            确认选择
         </button>
         <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-orange cursor-pointer transition-colors">
               <RefreshCw size={12} />
               <span>重放结果</span>
            </div>
            <div className="flex items-center gap-2">
               <button className="px-3 py-1.5 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-bold hover:bg-brand-orange/20 transition-colors">
                 + 换同款
               </button>
               <button className="px-3 py-1.5 rounded-full bg-brand-orange text-white text-xs font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20">
                 重搜
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};
