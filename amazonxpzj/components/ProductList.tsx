import React from 'react';
import { Product } from '../types';
import { Star, ExternalLink } from 'lucide-react';

interface ProductListProps {
  products: Product[];
}

export const ProductList: React.FC<ProductListProps> = ({ products }) => {
  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-text-primary">🏆 TOP新品推荐</h2>
        <button className="text-sm text-primary font-medium hover:text-primary-light flex items-center gap-1">
          查看全部 <ExternalLink size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="w-full sm:w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
              <img src={product.image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-text-primary line-clamp-1 group-hover:text-primary transition-colors">
                  {product.title}
                </h3>
                <div className="flex items-center gap-1 text-warning shrink-0">
                  <Star size={14} fill="currentColor" />
                  <span className="text-sm font-medium">{product.rating}</span>
                  <span className="text-xs text-text-tertiary">({product.reviewCount})</span>
                </div>
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-text-primary">{product.currency}{product.price}</span>
                <span className="text-xs text-text-tertiary">上架: {product.listingDate}</span>
                {product.rank && <span className="text-xs text-text-tertiary">排名 #{product.rank}</span>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {product.highlights?.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-primary-bg text-primary text-xs font-medium border border-primary/10">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};