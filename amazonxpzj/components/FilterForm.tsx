import React from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { COUNTRIES } from '../constants';
import { Search, Loader2 } from 'lucide-react';

export const FilterForm: React.FC = () => {
  const { filters, setFilters, startAnalysis, status } = useAnalysisStore();
  const isLoading = status === 'planning' || status === 'executing';

  const handleCountryToggle = (code: string) => {
    const current = filters.countries;
    const next = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    if (next.length > 0) setFilters({ countries: next });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filters.keyword && filters.countries.length > 0) {
      startAnalysis();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-text-primary">关键词 <span className="text-danger">*</span></label>
        </div>
        <div className="relative">
          <input
            type="text"
            value={filters.keyword}
            onChange={(e) => setFilters({ keyword: e.target.value })}
            placeholder="例如: flare yoga pants"
            disabled={isLoading}
            className="w-full h-11 pl-4 pr-10 rounded-lg border border-border bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
          <Search className="absolute right-3 top-3 text-text-tertiary" size={20} />
        </div>
        <p className="text-xs text-text-tertiary mt-2">💡 支持英文关键词，多词用空格分隔</p>
      </div>

      <div className="h-px bg-border my-4" />

      <div>
        <label className="text-sm font-medium text-text-primary mb-3 block">平台</label>
        <div className="flex gap-4">
          {(['Amazon', 'TikTok'] as const).map(p => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="platform"
                checked={filters.platform === p}
                onChange={() => setFilters({ platform: p })}
                disabled={isLoading}
                className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
              />
              <span className="text-sm text-text-secondary">{p}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="h-px bg-border my-4" />

      <div>
        <label className="text-sm font-medium text-text-primary mb-3 block">国家/地区</label>
        <div className="grid grid-cols-4 gap-2">
          {COUNTRIES.map(country => {
            const isSelected = filters.countries.includes(country.code);
            return (
              <button
                key={country.code}
                type="button"
                disabled={isLoading}
                onClick={() => handleCountryToggle(country.code)}
                className={`
                  flex flex-col items-center justify-center p-2 rounded-md border text-xs transition-all
                  ${isSelected
                    ? 'border-primary bg-primary-bg text-primary font-medium'
                    : 'border-border hover:border-primary-light text-text-secondary'
                  }
                `}
              >
                <span className="text-lg mb-1">{country.flag}</span>
                <span>{country.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border my-4" />

      <div>
        <label className="text-sm font-medium text-text-primary mb-3 block">新品时间范围</label>
        <div className="flex justify-between">
          {[30, 90, 180, 365].map(days => (
            <label key={days} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="timeRange"
                checked={filters.timeRange === days}
                onChange={() => setFilters({ timeRange: days as any })}
                disabled={isLoading}
                className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
              />
              <span className="text-sm text-text-secondary">近{days < 365 ? `${days}天` : '1年'}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading || !filters.keyword}
          className={`
            w-full h-12 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-all
            ${isLoading || !filters.keyword
              ? 'bg-primary/50 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-light shadow-lg hover:shadow-xl'
            }
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>分析中...</span>
            </>
          ) : (
            <>
              <span>🚀 开始分析</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};