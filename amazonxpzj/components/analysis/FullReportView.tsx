import React from 'react';
import { MarketReport } from '../../types';
import { Sparkline } from './Sparkline';
import { Check, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface FullReportViewProps {
  data: MarketReport | any;
}

export const FullReportView: React.FC<FullReportViewProps> = ({ data }) => {
  // Extract data with fallbacks
  const summary = data?.summary || '分析专家报告已生成';
  const marketOverview = data?.market_overview || {};
  const segmentAnalysis = data?.segment_analysis || {};
  const keywordInsights = data?.keyword_insights || {};
  const productInsights = data?.product_insights || {};
  const recommendations = data?.recommendations || {};

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-[#121212] min-h-screen p-8 md:p-12 shadow-sm rounded-none md:rounded-xl">
      {/* Report Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          深度市场分析专家报告
        </h1>
        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-4 text-purple-800 dark:text-purple-200 text-sm leading-relaxed border border-purple-100 dark:border-purple-500/10">
          <span className="font-bold">核心结论：</span> {summary}
        </div>
      </div>

      {/* Section 1: Market Overview */}
      {marketOverview.title && (
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
            {marketOverview.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-7 mb-6">
            {marketOverview.content}
          </p>

          {marketOverview.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {marketOverview.metrics.monthly_sales && (
                <DataCard label="月销量" value={marketOverview.metrics.monthly_sales} trend="+12%" />
              )}
              {marketOverview.metrics.active_products && (
                <DataCard label="活跃商品数" value={marketOverview.metrics.active_products} trend="+5%" />
              )}
              {marketOverview.metrics.chinese_seller_ratio && (
                <DataCard label="中国卖家占比" value={marketOverview.metrics.chinese_seller_ratio} trend="+3%" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Segment Analysis */}
      {segmentAnalysis.segments && segmentAnalysis.segments.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
            {segmentAnalysis.title || '二、细分赛道与机会地图'}
          </h2>

          <div className="space-y-6">
            {segmentAnalysis.segments.map((segment: any, idx: number) => (
              <div key={idx} className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 border border-gray-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                      {idx === 0 ? '💧' : idx === 1 ? '🎒' : '🏔️'}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{segment.name}</h3>
                      <p className="text-xs text-gray-500">
                        竞争程度: {segment.competition} | 机会评级: {segment.opportunity}
                      </p>
                    </div>
                  </div>
                  {segment.avg_price && (
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{segment.avg_price}</div>
                      <div className="text-xs text-gray-400">平均价格</div>
                    </div>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  {segment.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Keyword Insights */}
      {keywordInsights.top_keywords && keywordInsights.top_keywords.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
            {keywordInsights.title || '三、关键词洞察'}
          </h2>

          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-6 border border-gray-100 dark:border-white/5">
            <div className="space-y-3">
              {keywordInsights.top_keywords.map((kw: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-black/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-400">#{kw.rank || idx + 1}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{kw.keyword}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${kw.opportunity === '高' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      kw.opportunity === '中' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                    机会: {kw.opportunity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Product Insights */}
      {productInsights.key_findings && productInsights.key_findings.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
            {productInsights.title || '四、竞品分析'}
          </h2>

          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-6 border border-gray-100 dark:border-white/5 mb-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {productInsights.top_products && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">分析商品数</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{productInsights.top_products}</div>
                </div>
              )}
              {productInsights.avg_price && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">平均价格</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{productInsights.avg_price}</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {productInsights.key_findings.map((finding: string, idx: number) => (
              <div key={idx} className="flex gap-3 p-3 bg-white dark:bg-black/20 rounded-lg border border-gray-100 dark:border-white/5">
                <div className="text-brand-orange mt-0.5">•</div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Recommendations */}
      {recommendations.actions && recommendations.actions.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-orange rounded-full"></span>
            {recommendations.title || '五、行动建议'}
          </h2>

          <div className="space-y-4">
            {recommendations.actions.map((action: any, idx: number) => (
              <RecommendationItem
                key={idx}
                type={action.priority === '高' ? 'success' : action.priority === '中' ? 'info' : 'warning'}
                title={`${action.priority === '高' ? '🔥 ' : action.priority === '中' ? '💡 ' : '⚠️ '}${action.action}`}
                content={action.details}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

const DataCard = ({ label, value, trend, negative = false }: any) => (
  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className="flex items-end justify-between">
      <span className="text-xl font-bold text-gray-900 dark:text-white">{value}</span>
      <span className={`text-xs font-medium ${negative ? 'text-red-500' : 'text-green-500'} flex items-center`}>
        {negative ? <TrendingUp className="rotate-180 mr-1" size={12} /> : <TrendingUp className="mr-1" size={12} />}
        {trend}
      </span>
    </div>
  </div>
);

const RecommendationItem = ({ type, title, content }: any) => {
  const styles = {
    success: { bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-100 dark:border-green-500/20', icon: 'text-green-600', Icon: Check },
    warning: { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-100 dark:border-orange-500/20', icon: 'text-orange-600', Icon: AlertTriangle },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-500/20', icon: 'text-blue-600', Icon: Info }
  }[type as 'success' | 'warning' | 'info'];

  const Icon = styles.Icon;

  return (
    <div className={`p-4 rounded-xl border ${styles.bg} ${styles.border} flex gap-4`}>
      <div className={`mt-0.5 shrink-0 ${styles.icon}`}>
        <Icon size={18} />
      </div>
      <div>
        <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{title}</h4>
        <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">{content}</p>
      </div>
    </div>
  )
}
