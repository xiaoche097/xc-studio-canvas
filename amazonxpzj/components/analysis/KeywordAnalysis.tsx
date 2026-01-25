import React from 'react';
import { KeywordData } from '../../types';
import { Sparkline } from './Sparkline';
import { TrendingUp } from 'lucide-react';

interface KeywordAnalysisProps {
  data: KeywordData[];
}

export const KeywordAnalysis: React.FC<KeywordAnalysisProps> = ({ data }) => {
  return (
    <div className="overflow-x-auto border border-gray-100 dark:border-white/5 rounded-xl bg-white dark:bg-[#1a1a1a]">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 font-medium">
          <tr>
            <th className="px-4 py-3 text-left">关键词</th>
            <th className="px-4 py-3 text-left">亚马逊搜索排名</th>
            <th className="px-4 py-3 text-left">趋势数据</th>
            <th className="px-4 py-3 text-left">关键词核心品类分布</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {data.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
              <td className="px-6 py-6 font-bold text-gray-900 dark:text-gray-100 text-[15px]">
                {item.keyword}
              </td>
              <td className="px-6 py-6">
                 <div className="flex items-center gap-1 font-mono font-bold text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400">#</span>{item.searchRank.toLocaleString()}
                 </div>
              </td>
              <td className="px-6 py-6">
                <div className="w-24 h-8">
                   <Sparkline data={item.trendData} color="#8B5CF6" />
                </div>
              </td>
              <td className="px-4 py-4 w-1/3">
                <div className="space-y-2">
                  {item.categoryDistribution.map((cat, ci) => (
                    <div key={ci} className="flex items-center text-xs group/bar">
                      <span className="text-gray-500 dark:text-gray-400 w-24 shrink-0 truncate" title={cat.category}>
                        {cat.category.split('>').pop()?.trim()}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full mx-2 overflow-hidden">
                        <div className="h-full bg-brand-orange/80 group-hover/bar:bg-brand-orange transition-colors" style={{ width: `${cat.percentage}%` }}></div>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 w-8 text-right font-medium">{cat.percentage}%</span>
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
};
