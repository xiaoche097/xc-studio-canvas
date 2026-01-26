import React, { useState } from 'react';
import { Product } from '../../types';
import { LayoutGrid, List, ArrowUpRight } from 'lucide-react';
import { CategoryPath } from './CategoryPath';

interface ProductListProps {
   products: Product[];
}

export const ProductList: React.FC<ProductListProps> = ({ products = [] }) => {
   const safeProducts = Array.isArray(products) ? products : [];
   const [view, setView] = useState<'table' | 'card'>('card');

   return (
      <div className="space-y-4">
         {/* Toolbar */}
         <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
               共 <span className="text-gray-900 dark:text-white font-bold">{safeProducts.length}</span> 款商品
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
               {safeProducts.map(p => (
                  <div key={p.id} className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-1">
                     <div className="aspect-square relative overflow-hidden bg-gray-50 dark:bg-white/5">
                        {p.image ? (
                           <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                 <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                 <circle cx="8.5" cy="8.5" r="1.5" />
                                 <polyline points="21 15 16 10 5 21" />
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
                  <thead className="bg-[#FFFFFF] dark:bg-[#1a1a1a] text-gray-400 font-medium whitespace-nowrap text-xs border-b border-gray-100 dark:border-white/5">
                     <tr>
                        <th className="px-6 py-4 text-left w-16"></th>
                        <th className="px-6 py-4 text-left min-w-[300px]">商品信息</th>
                        <th className="px-6 py-4 text-left text-xs font-normal">国家</th>
                        <th className="px-6 py-4 text-left text-xs font-normal">平台</th>
                        <th className="px-6 py-4 text-left min-w-[300px] text-xs font-normal">类目</th>
                        <th className="px-6 py-4 text-left text-xs font-normal">上架时间</th>
                        <th className="px-6 py-4 text-left text-xs font-normal">销量排名(近30天)</th>
                        <th className="px-6 py-4 text-left text-xs font-normal">评分分数</th>
                        <th className="px-6 py-4 text-left text-xs font-normal">评分条数</th>
                        <th className="px-6 py-4 text-left text-xs font-normal">售卖价格</th>
                     </tr >
                  </thead >
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5 text-xs text-gray-600 dark:text-gray-400">
                     {safeProducts.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                           {/* Image Column */}
                           <td className="pl-6 py-4 w-16 align-middle">
                              <div className="w-12 h-12 rounded bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 overflow-hidden flex items-center justify-center">
                                 {p.image ? (
                                    <img src={p.image} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt={p.title} />
                                 ) : (
                                    <div className="text-gray-300">
                                       <LayoutGrid size={16} />
                                    </div>
                                 )}
                              </div>
                           </td>

                           {/* Title Column */}
                           <td className="px-6 py-4 align-middle">
                              <div className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-relaxed w-[300px] text-[13px] group-hover:text-brand-orange transition-colors">
                                 {p.title}
                              </div>
                           </td>

                           {/* Country */}
                           <td className="px-6 py-4 align-middle">
                              <span className="uppercase">{p.country || 'DE'}</span>
                           </td>

                           {/* Platform */}
                           <td className="px-6 py-4 align-middle">
                              <span className="lowercase">{p.platform || 'amazon'}</span>
                           </td>

                           {/* Category */}
                           <td className="px-6 py-4 align-middle">
                              <div className="w-[300px] leading-relaxed text-gray-500">
                                 {p.category ? p.category.replace(/->/g, ' > ') : '-'}
                              </div>
                           </td>

                           {/* Listing Date */}
                           <td className="px-6 py-4 align-middle font-mono text-gray-500">
                              {p.listingDate || '-'}
                           </td>

                           {/* Sales Rank */}
                           <td className="px-6 py-4 align-middle font-mono">
                              {p.salesRank || p.salesRankLast30Days || '-'}
                           </td>

                           {/* Rating */}
                           <td className="px-6 py-4 align-middle font-mono">
                              {p.rating || '-'}
                           </td>

                           {/* Reviews */}
                           <td className="px-6 py-4 align-middle font-mono">
                              {p.reviewCount || '-'}
                           </td>

                           {/* Price */}
                           <td className="px-6 py-4 align-middle font-mono font-medium text-gray-900 dark:text-gray-100">
                              {p.currency}{p.price}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table >
            </div >
         )}
      </div >
   );
};
