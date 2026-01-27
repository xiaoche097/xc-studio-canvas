import React, { useEffect, useRef } from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import {
  Check,
  Loader2,
  ChevronLeft,
  ArrowUp,
  Bot,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { TaskPlanner } from './analysis/TaskPlanner';
import { KeywordAnalysis } from './analysis/KeywordAnalysis';
import { ProductList } from './analysis/ProductList';
import { MarketInsight } from './analysis/MarketInsight';
import { DetailModal } from './analysis/DetailModal';
import { storageService } from '../../services/storageService';

export const AgentExecutionView: React.FC = () => {
  const { executionSteps, status, setView, filters } = useAnalysisStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [modalState, setModalState] = React.useState<{ isOpen: boolean; type: 'keywords' | 'products' | 'report' | 'market'; title: string; data: any }>({
    isOpen: false,
    type: 'keywords',
    title: '',
    data: null
  });

  const openModal = (type: 'keywords' | 'products' | 'report', title: string, data: any) => {
    setModalState({ isOpen: true, type, title, data });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Auto-Save Project when status is completed
    if (status === 'completed') {
      // Find report data
      const reportStep = executionSteps.find(s => s.result?.detailType === 'report');
      if (reportStep && reportStep.result?.data) {
        const reportData = reportStep.result.data.result || reportStep.result.data;

        storageService.saveProject({
          id: crypto.randomUUID(),
          type: 'ANALYSIS',
          createdAt: Date.now(),
          thumbnail: '', // Could be an icon or chart
          assets: {
            generated: [JSON.stringify(reportData)]
          },
          metadata: {
            prompt: `Amazon Selection: ${filters.keyword}`,
            params: filters
          }
        }).catch(err => console.error("Failed to save analysis project", err));
      }
    }
  }, [executionSteps, status, filters]);

  const renderStepContent = (step: any) => {
    // 1. Plan Step
    if (step.type === 'plan' && step.status === 'completed') {
      return <TaskPlanner content={step.content} />;
    }

    // 2. Completed with specific result type
    if (step.status === 'completed' && step.result) {
      switch (step.result.detailType) {
        case 'keywords':
          const keywordData = Array.isArray(step.result.data) ? step.result.data : [];
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-300">{step.result.summary || '关键词数据抓取完成'}</p>
              </div>

              {/* Action Button - Pill Style */}
              {keywordData.length > 0 && (
                <button
                  onClick={() => openModal('keywords', '查看关键词详情', keywordData)}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-orange hover:text-brand-orange transition-all shadow-sm group"
                >
                  <ArrowUpRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  <span>查看关键词详情</span>
                </button>
              )}

              {/* Product Preview Images for each keyword */}
              {keywordData.length > 0 && (
                <div className="space-y-4 mt-2 pt-4 border-t border-gray-100 dark:border-white/5">
                  {keywordData.slice(0, 1).map((kw: any, kwIdx: number) => (
                    kw.products && kw.products.length > 0 && (
                      <div key={kwIdx} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                            {kw.keyword}
                          </span>
                          <span className="text-xs text-gray-400">相关商品</span>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {kw.products.slice(0, 4).map((p: any, pIdx: number) => (
                            <div key={pIdx} className="aspect-square bg-gray-50 dark:bg-white/5 rounded-lg overflow-hidden border border-gray-100 dark:border-white/5 relative group cursor-pointer" title={p.title}>
                              {p.image ? (
                                <img src={p.image} className="w-full h-full object-cover" alt={p.title} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">Include Image</div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="text-white font-bold text-xs">{p.currency}{p.price}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          );
        case 'products':
          const productData = Array.isArray(step.result.data) ? step.result.data : [];
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-300">{step.result.summary || '成功获取到相关热销商品'}</p>
              </div>

              {/* Product Grid with "View More" Card */}
              {productData.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {productData.slice(0, 3).map((p: any) => (
                    <div key={p.id} className="bg-white dark:bg-[#1a1a1a] p-2 rounded-xl border border-gray-100 dark:border-white/5 hover:shadow-md transition-shadow">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 dark:bg-white/5 mb-2 relative">
                        <img src={p.image} className="w-full h-full object-cover" alt={p.title} />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{p.title}</div>
                        <div className="text-xs font-bold text-brand-orange">{p.currency}{p.price}</div>
                      </div>
                    </div>
                  ))}

                  {/* View Details Card */}
                  <button
                    onClick={() => openModal('products', '商品列表详情', productData)}
                    className="bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl border border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center gap-2 transition-all group p-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <ArrowUpRight size={18} className="text-gray-600 dark:text-gray-200" />
                    </div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 text-center">
                      共{productData.length}款商品<br />查看详情
                    </div>
                  </button>
                </div>
              )}
            </div>
          );
        case 'report':
          const reportData = step.result.data && step.result.data.result ? step.result.data.result : (step.result.data || {});
          return (
            <div className="bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/10 dark:to-transparent rounded-xl p-5 border border-purple-100 dark:border-purple-500/20">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">分析专家报告已生成</h4>
                  <p className="text-xs text-gray-500">包含市场趋势、细分赛道及行动建议</p>
                </div>
              </div>

              <div className="pl-14">
                <button
                  onClick={() => openModal('report', '深度市场分析专家报告', reportData)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-sm font-bold shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
                >
                  <span>查看完整报告</span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          );
        default:
          return (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {step.result.summary || step.content || '分析完成'}
              </p>
              {(step.result.data || step.result) && (
                <div>
                  <button
                    onClick={() => openModal('report', step.title + ' 详情', step.result.data || step.result)}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-orange hover:text-brand-orange transition-all shadow-sm group"
                  >
                    <ArrowUpRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    <span>查看分析详情</span>
                  </button>
                </div>
              )}
            </div>
          );
      }
    }

    // 3. Loading or simple text
    return (
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
        {step.description && <div className="text-xs text-gray-400 mb-1">{step.description}</div>}
        {step.content}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden relative font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-white/5 bg-white/50 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2D2D2D] hover:bg-[#3D3D3D] text-white text-sm font-medium transition-colors border border-white/10"
          >
            <ChevronLeft size={18} />
            <span>Back to Studio</span>
          </button>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <Bot size={20} />
        </div>
      </div>

      {/* Main Stream Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto p-8 space-y-10 pb-40">

          {/* Bot Welcome Message */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-orange text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
              <Bot size={24} />
            </div>
            <div className="bg-white dark:bg-[#121212] px-6 py-4 rounded-2xl rounded-tl-none shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 max-w-3xl">
              <p className="text-gray-700 dark:text-gray-200 text-base leading-relaxed">
                收到，正在为您分析 <span className="font-bold text-brand-orange">{filters.platform} {filters.country}</span> 市场的 <span className="font-bold text-brand-orange">{filters.keyword}</span> 选品机会。
              </p>
            </div>
          </div>

          {/* Steps Stream */}
          <div className="relative">
            {/* Continuous Vertical Line Background */}
            <div className="absolute left-5 top-4 bottom-0 w-0.5 bg-gray-100 dark:bg-white/5 z-0"></div>

            <div className="space-y-10 relative z-10">
              {executionSteps.map((step, idx) => (
                <div key={step.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards" style={{ animationDelay: `${idx * 150}ms` }}>
                  <div className="flex gap-4">
                    {/* Timeline Icon */}
                    <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-[#F8FAFC] dark:bg-[#050505] ring-8 ring-[#F8FAFC] dark:ring-[#050505]">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm ${step.status === 'loading' ? 'bg-white border-2 border-brand-orange text-brand-orange' :
                        step.status === 'completed' ? 'bg-[#22C55E] text-white' :
                          'bg-gray-100 border-2 border-gray-200'
                        }`}>
                        {step.status === 'loading' ? <Loader2 size={14} className="animate-spin" /> :
                          step.status === 'completed' ? <Check size={14} strokeWidth={3} /> :
                            null}
                      </div>
                    </div>

                    {/* Right Side: Title + Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      {/* Step Title Row */}
                      <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${step.status === 'loading' ? 'text-brand-orange' : 'text-gray-900 dark:text-white'}`}>
                        {step.title}
                      </h3>

                      {/* Content Card (If has content) */}
                      <div className="bg-white dark:bg-[#121212] rounded-2xl border border-gray-100 dark:border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                        <div className="p-6">
                          {renderStepContent(step)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loading Indicator */}
          {status === 'searching' && (
            <div className="pl-14 flex items-center gap-2 text-gray-400 text-sm animate-pulse">
              <span>思考中...</span>
            </div>
          )}

          <div ref={bottomRef} className="h-4"></div>
        </div>
      </div>

      {/* Persistent Chat Input */}
      <div className="bg-white dark:bg-[#121212] border-t border-gray-100 dark:border-white/5 p-4 pb-8 z-20">
        <div className="max-w-4xl mx-auto relative group">
          <input
            type="text"
            placeholder="对结果不满意？您可以追问 '分析下利润空间' 或 '只看$50以上的产品'..."
            className="w-full h-12 pl-5 pr-12 bg-gray-50 dark:bg-white/5 rounded-full border border-gray-200 dark:border-white/10 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all text-sm"
          />
          <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-brand-orange text-white rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors shadow-md">
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
      <DetailModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        data={modalState.data}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
      />
    </div >
  );
};
