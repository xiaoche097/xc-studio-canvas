import React, { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Search, Sparkles } from 'lucide-react';
import {
  CREATIVE_FEATURES,
  FEATURE_CATEGORIES,
  type CreativeFeature,
  type FeatureCategory,
} from '../featureRegistry';
import { AppMode } from '../types';

type CategoryFilter = 'all' | FeatureCategory;

interface CreativeHubProps {
  onOpenFeature: (mode: AppMode) => void;
  onBack: () => void;
}

const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase('zh-CN');

const FeatureCard: React.FC<{
  feature: CreativeFeature;
  index: number;
  onOpen: () => void;
}> = ({ feature, index, onOpen }) => {
  const Icon = feature.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="creative-card group w-full overflow-hidden rounded-[1.35rem] border border-[#eadfd4] bg-white text-left shadow-[0_12px_35px_rgba(87,50,25,0.07)] transition duration-300 hover:-translate-y-1.5 hover:border-[#f2a15f] hover:shadow-[0_20px_44px_rgba(205,105,35,0.17)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef7d2d] focus-visible:ring-offset-2 dark:border-[#49372c] dark:bg-[#211a16] dark:shadow-[0_16px_40px_rgba(0,0,0,0.25)] dark:hover:border-[#c8783c]"
      style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
      aria-label={`打开${feature.title}`}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#f6eadf] dark:bg-[#34251d]">
        <img
          src={feature.cover}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#30160a]/30 via-transparent to-white/10 dark:from-black/45" />
        <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/86 text-[#e7691e] shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#1b1512]/80 dark:text-[#ffad66]">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <span className="absolute bottom-3 left-3 rounded-full border border-white/45 bg-[#5a2a11]/58 px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.16em] text-white backdrop-blur-md">
          {feature.englishTitle.toUpperCase()}
        </span>
      </div>

      <div className="flex min-h-[9.25rem] flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[1.08rem] font-black tracking-tight text-[#2e211a] dark:text-[#fff4e9]">
            {feature.title}
          </h3>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff0e4] text-[#e7681d] transition duration-300 group-hover:bg-[#ed782b] group-hover:text-white dark:bg-[#39251a] dark:text-[#ffad66] dark:group-hover:bg-[#d66c28]">
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#75655b] dark:text-[#bdaba0]">
          {feature.description}
        </p>
        <span className="mt-auto pt-3 text-xs font-bold text-[#d85f19] opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:text-[#ff9d55]">
          进入工作台
        </span>
      </div>
    </button>
  );
};

const CreativeHub: React.FC<CreativeHubProps> = ({ onOpenFeature, onBack }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const normalizedQuery = normalizeSearch(query);

  const filteredFeatures = useMemo(() => {
    return CREATIVE_FEATURES.filter((feature) => {
      const inCategory = category === 'all' || feature.category === category;
      if (!inCategory) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        feature.title,
        feature.englishTitle,
        feature.description,
        ...feature.keywords,
      ]
        .join(' ')
        .toLocaleLowerCase('zh-CN');
      return searchable.includes(normalizedQuery);
    });
  }, [category, normalizedQuery]);

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
  };

  return (
    <div className="creative-hub h-full overflow-y-auto bg-[#fbf6f0] text-[#2f2119] dark:bg-[#140f0c] dark:text-[#f9eee5]">
      <div className="relative overflow-hidden border-b border-[#eadfd4] bg-[#f7ebdf] dark:border-[#3c2d25] dark:bg-[#1b1410]">
        <div className="creative-orb creative-orb-one" />
        <div className="creative-orb creative-orb-two" />
        <div className="relative mx-auto max-w-[98rem] px-4 pb-8 pt-4 sm:px-6 sm:pb-10 lg:px-10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#dfcbbb] bg-white/72 px-4 text-sm font-bold text-[#5d493d] shadow-sm backdrop-blur transition hover:border-[#ed8a43] hover:text-[#d65f1d] dark:border-[#4c382d] dark:bg-[#241a15]/75 dark:text-[#ddc9bc]"
            >
              <span aria-hidden="true">←</span>
              返回工作室
            </button>
            <div className="hidden items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#9b6f52] sm:flex dark:text-[#bf8c68]">
              <Sparkles className="h-4 w-4 text-[#ed7728]" />
              XCAI CREATIVE LAB
            </div>
          </div>

          <div className="mt-10 max-w-4xl sm:mt-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e8c5a8] bg-white/55 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-[#b85a22] backdrop-blur dark:border-[#68452f] dark:bg-[#2a1c15]/70 dark:text-[#f29a5f]">
              <Sparkles className="h-3.5 w-3.5" />
              AI 商业视觉工作台
            </div>
            <h1 className="mt-5 text-[clamp(2.35rem,7vw,5.5rem)] font-black leading-[0.96] tracking-[-0.055em] text-[#2b1b13] dark:text-[#fff5eb]">
              用AI
              <span className="ml-2 text-[#e8681d] dark:text-[#ff8e3c]">拓展边界</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#705c50] sm:text-lg dark:text-[#c2afa3]">
              探索生成图像
              <br />
              动态影像与视觉设计
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center">
            <label className="group flex min-h-12 w-full max-w-xl items-center gap-3 rounded-2xl border border-[#dfcdbf] bg-white/88 px-4 shadow-[0_8px_28px_rgba(105,60,30,0.08)] transition focus-within:border-[#e9823b] focus-within:ring-4 focus-within:ring-[#f29a5f]/15 dark:border-[#4b382e] dark:bg-[#211814]/90 dark:focus-within:border-[#c87339]">
              <Search className="h-5 w-5 shrink-0 text-[#a18878] group-focus-within:text-[#e46b22]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索功能名称或用途"
                className="h-12 min-w-0 flex-1 bg-transparent text-base text-[#35251c] outline-none placeholder:text-[#a7968b] dark:text-[#f8ece3] dark:placeholder:text-[#8f796c]"
                aria-label="搜索创意功能"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="min-h-11 shrink-0 px-2 text-xs font-bold text-[#cd6323]"
                >
                  清除
                </button>
              )}
            </label>
            <div className="shrink-0 text-sm font-medium text-[#8a7467] dark:text-[#a99488]">
              {filteredFeatures.length} / {CREATIVE_FEATURES.length} 项能力
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[98rem] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="功能分类">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-bold transition ${
              category === 'all'
                ? 'bg-[#2f2119] text-white shadow-md dark:bg-[#f4e5d9] dark:text-[#241711]'
                : 'border border-[#e3d5ca] bg-white/75 text-[#735e51] hover:border-[#e98743] hover:text-[#d85f19] dark:border-[#49372e] dark:bg-[#201713] dark:text-[#c4afa2]'
            }`}
            role="tab"
            aria-selected={category === 'all'}
          >
            全部功能
          </button>
          {FEATURE_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-bold transition ${
                category === item.id
                  ? 'bg-[#2f2119] text-white shadow-md dark:bg-[#f4e5d9] dark:text-[#241711]'
                  : 'border border-[#e3d5ca] bg-white/75 text-[#735e51] hover:border-[#e98743] hover:text-[#d85f19] dark:border-[#49372e] dark:bg-[#201713] dark:text-[#c4afa2]'
              }`}
              role="tab"
              aria-selected={category === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredFeatures.length > 0 ? (
          <div className="mt-8 space-y-12">
            {FEATURE_CATEGORIES.map((categoryMeta) => {
              const group = filteredFeatures.filter((feature) => feature.category === categoryMeta.id);
              if (!group.length) return null;

              return (
                <section key={categoryMeta.id} aria-labelledby={`category-${categoryMeta.id}`}>
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <span className="text-[0.65rem] font-black tracking-[0.22em] text-[#db6a26] dark:text-[#f18e50]">
                        {categoryMeta.eyebrow}
                      </span>
                      <h2
                        id={`category-${categoryMeta.id}`}
                        className="mt-1 text-2xl font-black tracking-tight text-[#34231a] dark:text-[#faeee5]"
                      >
                        {categoryMeta.label}
                      </h2>
                    </div>
                    <span className="text-sm text-[#9a887c] dark:text-[#927e72]">{group.length} 个工具</span>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {group.map((feature, index) => (
                      <FeatureCard
                        key={feature.mode}
                        feature={feature}
                        index={index}
                        onOpen={() => onOpenFeature(feature.mode)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 flex min-h-[22rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-[#dfcbbb] bg-white/55 px-6 text-center dark:border-[#4d392e] dark:bg-[#1c1511]/70">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0e3] text-[#e66f25] dark:bg-[#352218] dark:text-[#ff9b55]">
              <Search className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-black">暂时没有找到对应功能</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#826f63] dark:text-[#ad998d]">
              换个关键词试试，或者重置筛选查看全部创意能力。
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#e66f25] px-5 text-sm font-bold text-white transition hover:bg-[#c95716]"
            >
              <RotateCcw className="h-4 w-4" />
              重置筛选
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CreativeHub;
