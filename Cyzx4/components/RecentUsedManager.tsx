import React, { useEffect, useState } from 'react';
import { RotateCcw, Clock, Eye, Sparkles, ArrowRight } from 'lucide-react';
import {
  CREATIVE_FEATURES,
  type CreativeFeature,
  getFeatureByMode,
} from '../featureRegistry';
import { AppMode } from '../types';

interface RecentUsedManagerProps {
  onOpenFeature: (mode: AppMode) => void;
  onSwitchToCreation: () => void;
}

export const RecentUsedManager: React.FC<RecentUsedManagerProps> = ({
  onOpenFeature,
  onSwitchToCreation,
}) => {
  const [recentFeatures, setRecentFeatures] = useState<CreativeFeature[]>([]);

  // 读取本地存储中的最近使用功能列表
  const loadRecentFeatures = () => {
    try {
      const stored = localStorage.getItem('recent_features');
      if (stored) {
        const modes: AppMode[] = JSON.parse(stored);
        const features = modes
          .map((m) => getFeatureByMode(m))
          .filter(Boolean) as CreativeFeature[];
        setRecentFeatures(features);
      } else {
        setRecentFeatures([]);
      }
    } catch {
      setRecentFeatures([]);
    }
  };

  useEffect(() => {
    loadRecentFeatures();
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100 overflow-y-auto no-scrollbar font-sans">
      {/* 1. TOP HEADER (完全对齐用户参考截图) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f17]/95">
        <div>
          <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
            历史使用过的智能体
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-400">
            按最近执行时间整理，方便你快速回到上次使用的工具。
          </p>
        </div>

        <button
          type="button"
          onClick={loadRecentFeatures}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          刷新
        </button>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="w-full px-6 py-6 flex-1">
        {recentFeatures.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {recentFeatures.map((feature) => (
              <div
                key={feature.mode}
                onClick={() => onOpenFeature(feature.mode)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-slate-300/90 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900"
              >
                {/* 封面区 */}
                <div className="relative aspect-[16/10] overflow-hidden bg-[#fbf9f5] dark:bg-slate-800">
                  <img
                    src={feature.cover}
                    alt={feature.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFeature(feature.mode);
                    }}
                    className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-sm backdrop-blur-xs transition hover:bg-slate-900 hover:text-white dark:bg-slate-800/90 dark:text-slate-200"
                    title={`继续体验 ${feature.title}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 文本区 */}
                <div className="p-3.5">
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400 font-medium">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 空状态：你还没开始使用功能 */
          <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10 my-4">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-300">
              <Clock className="h-7 w-7" />
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              你还没开始使用功能
            </h2>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
              这里会为你按时间自动记录你最近使用过的 AI 智能体，方便你快速回到工作状态。
            </p>
            <button
              type="button"
              onClick={onSwitchToCreation}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 transition"
            >
              <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              去“创作”探索功能
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default RecentUsedManager;
