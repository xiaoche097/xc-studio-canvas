import React, { useState } from 'react';
import { Product } from '../../types';
import { LayoutGrid, List, ArrowUpRight } from 'lucide-react';
import { CategoryPath } from './CategoryPath';

interface ProductListProps {
  products: Product[];
}

export const ProductList: React.FC<ProductListProps> = ({ products }) => {
  const [view, setView] = useState<'table' | 'card'>('card');

  return (
    <div className="space-y-4">
       {/* Toolbar */}
       <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
             共 <span className="text-gray-900 dark:text-white font-bold">{products.length}</span> 款商品
          </div>
          <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-lg">
             <button 
                onClick={() => setView('table')}
                className={`p-1.5 rounded-md transition-all ${view === 'table' ? 'bg-white dark:bg-[#1a1a1a] shadow-sm text-brand-orange' : 'text-gray-400 hover:text-gray-600'}`}
             >
                <List size={16} />
             </button>
             <button 
                onClick={() => setView('card')}
                className={`p-1.5 rounded-md transition-all ${view === 'card' ? 'bg-white dark:bg-[#1a1a1a] shadow-sm text-brand-orange' : 'text-gray-400 hover:text-gray-600'}`}
             >
                <LayoutGrid size={16} />
             </button>
          </div>
       </div>

       {view === 'card' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {products.map(p => (
                <div key={p.id} className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-1">
                   <div className="aspect-square relative overflow-hidden bg-gray-50 dark:bg-white/5">
                      {p.image ? (
                         <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                               <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                               <circle cx="8.5" cy="8.5" r="1.5"/>
                               <polyline points="21 15 16 10 5 21"/>
                            </svg>
                         </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1">
                         <span className="bg-black/50 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <span className="text-yellow-400">★</span> {p.rating}
                         </span>
                      </div>
                   </div>
                   <div className="p-3">
                      <h4 className="text-sm font-bold line-clamp-2 text-gray-800 dark:text-gray-100 mb-1" title={p.title}>{p.title}</h4>
                      <div className="text-xs text-gray-400 mb-2 truncate">
                         {p.category && <CategoryPath path={p.category} />}
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-lg font-bold text-brand-orange">{p.currency}{p.price}</span>
                         <span className="text-xs text-gray-400">#{p.salesRank}</span>
                      </div>
                   </div>
                </div>
             ))}
          </div>
       ) : (
          <div className="overflow-x-auto border border-gray-100 dark:border-white/5 rounded-xl bg-white dark:bg-[#1a1a1a]">
             <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 font-medium whitespace-nowrap">
                   <tr>
                      <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 dark:bg-[#1a1a1a] z-10 min-w-[280px]">商品信息</th>
                      <th className="px-4 py-3 text-left">国家</th>
                      <th className="px-4 py-3 text-left">平台</th>
                      <th className="px-4 py-3 text-left min-w-[250px]">类目</th>
                      <th className="px-4 py-3 text-left">上架时间</th>
                      <th className="px-4 py-3 text-left">销量排名(近30天)</th>
                      <th className="px-4 py-3 text-left">评分分数</th>
                      <th className="px-4 py-3 text-left">评分条数</th>
                      <th className="px-4 py-3 text-left">售卖价格</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                   {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                         <td className="px-4 py-3 sticky left-0 bg-white dark:bg-[#1a1a1a] z-10">
                            <div className="flex items-center gap-3 group cursor-pointer">
                               <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 dark:border-white/10 shrink-0 bg-gray-50 dark:bg-white/5">
                                  {p.image ? (
                                     <img src={p.image} className="w-full h-full object-cover" alt={p.title} />
                                  ) : (
                                     <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                           <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                           <circle cx="8.5" cy="8.5" r="1.5"/>
                                           <polyline points="21 15 16 10 5 21"/>
                                        </svg>
                                     </div>
                                  )}
                               </div>
                               <div className="min-w-[180px] max-w-[180px]">
                                  <div className="font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-brand-orange transition-colors text-xs leading-relaxed">{p.title}</div>
                                  <div className="text-xs text-gray-400 mt-1">{p.id}</div>
                               </div>
                            </div>
                         </td>
                         <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-medium">{p.country || 'US'}</span>
                         </td>
                         <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{p.platform || 'Amazon'}</td>
                         <td className="px-4 py-3 max-w-[250px]">
                            {p.category ? <CategoryPath path={p.category} /> : <span className="text-gray-400 text-xs">未分类</span>}
                         </td>
                         <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{p.listingDate || 'N/A'}</td>
                         <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs whitespace-nowrap">
                            {p.salesRankLast30Days || (p.salesRank ? `#${p.salesRank}` : 'N/A')}
                         </td>
                         <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">
                            <div className="flex items-center gap-1">
                               <span className="text-yellow-500">★</span>
                               <span>{p.rating || 'N/A'}</span>
                            </div>
                         </td>
                         <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{p.reviewCount || 0}</td>
                         <td className="px-4 py-3 font-mono font-medium text-brand-orange text-xs whitespace-nowrap">{p.currency}{p.price}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       )}
    </div>
  );
};
