import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface Recommendation {
  type: 'success' | 'warning' | 'info';
  title: string;
  content: string;
}

interface MarketInsightProps {
  summary: string;
  recommendations: Recommendation[];
}

export const MarketInsight: React.FC<MarketInsightProps> = ({ summary, recommendations }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
       <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-5 border border-gray-100 dark:border-white/5">
          <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
             <span className="text-xl">📊</span> 市场分析总结
          </h4>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-7 whitespace-pre-wrap">
             {summary}
          </p>
       </div>

       <div className="grid grid-cols-1 gap-3">
          {recommendations.map((rec, idx) => {
             const isSuccess = rec.type === 'success';
             const isWarning = rec.type === 'warning';
             return (
                <div key={idx} className={`p-4 rounded-xl border transition-all hover:scale-[1.01] ${
                   isSuccess ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' :
                   isWarning ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/30' :
                   'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30'
                }`}>
                   <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${
                         isSuccess ? 'text-green-600' : isWarning ? 'text-orange-600' : 'text-blue-600'
                      }`}>
                         {isSuccess && <CheckCircle2 size={18} />}
                         {isWarning && <AlertCircle size={18} />}
                         {rec.type === 'info' && <Info size={18} />}
                      </div>
                      <div>
                         <h4 className={`font-bold text-sm mb-1 ${
                            isSuccess ? 'text-green-900 dark:text-green-100' : 
                            isWarning ? 'text-orange-900 dark:text-orange-100' : 
                            'text-blue-900 dark:text-blue-100'
                         }`}>{rec.title}</h4>
                         <p className={`text-xs ${
                            isSuccess ? 'text-green-700 dark:text-green-300' : 
                            isWarning ? 'text-orange-700 dark:text-orange-300' : 
                            'text-blue-700 dark:text-blue-300'
                         }`}>{rec.content}</p>
                      </div>
                   </div>
                </div>
             )
          })}
       </div>
    </div>
  );
};
