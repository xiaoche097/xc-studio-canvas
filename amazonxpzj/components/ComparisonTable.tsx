import React from 'react';
import { ComparisonProduct } from '../types';

interface ComparisonTableProps {
  products: ComparisonProduct[];
  insights?: string[];
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ products, insights }) => {
  const attributes = [
    { key: 'price', label: '价格' },
    { key: 'listingDate', label: '上架时间' },
    { key: 'material', label: '材质' },
    { key: 'style', label: '风格' },
    { key: 'rating', label: '评分' },
    { key: 'reviews', label: '评论数' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
      <h2 className="text-xl font-bold text-text-primary mb-4">⚔️ 竞品对比分析</h2>
      
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="sticky left-0 bg-gray-50 z-20 p-4 font-semibold text-text-secondary min-w-[100px] shadow-[1px_0_0_0_rgba(229,231,235,1)]">
                  维度
                </th>
                {products.map((p) => (
                  <th key={p.id} className={`p-4 min-w-[160px] ${p.isMain ? 'bg-primary-bg/30' : ''}`}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-md bg-white border border-border overflow-hidden">
                        <img src={p.image} className="w-full h-full object-cover" alt="" />
                      </div>
                      <span className={`text-center font-bold ${p.isMain ? 'text-primary' : 'text-text-primary'}`}>
                        {p.title}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attributes.map((attr) => (
                <tr key={attr.key} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="sticky left-0 bg-white z-10 p-4 font-medium text-text-secondary shadow-[1px_0_0_0_rgba(229,231,235,1)]">
                    {attr.label}
                  </td>
                  {products.map((p) => (
                    <td key={p.id} className={`p-4 text-center text-text-primary ${p.isMain ? 'bg-primary-bg/10 font-medium' : ''}`}>
                      {p.attributes[attr.key as keyof typeof p.attributes]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {insights && insights.length > 0 && (
        <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
          <h3 className="text-sm font-bold text-blue-800 mb-2">📊 对比洞察：</h3>
          <ul className="space-y-1">
            {insights.map((insight, idx) => (
              <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-500 shrink-0"></span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};