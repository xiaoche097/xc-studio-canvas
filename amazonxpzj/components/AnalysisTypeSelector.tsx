import React from 'react';
import { ANALYSIS_TYPES } from '../constants';
import { Sparkles, TrendingUp, ArrowLeftRight, Globe, LucideIcon } from 'lucide-react';
import { useAnalysisStore } from '../stores/analysisStore';

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  TrendingUp,
  ArrowLeftRight,
  Globe
};

export const AnalysisTypeSelector: React.FC = () => {
  const { analysisType, setAnalysisType, status } = useAnalysisStore();
  const disabled = status === 'executing' || status === 'planning';

  return (
    <div className="mb-8">
      <label className="text-sm text-text-secondary font-medium mb-3 block">分析类型</label>
      <div className="grid grid-cols-2 gap-3">
        {ANALYSIS_TYPES.map((type) => {
          const Icon = iconMap[type.icon];
          const isSelected = analysisType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => setAnalysisType(type.id)}
              disabled={disabled}
              className={`
                p-4 rounded-lg text-left transition-all duration-200 border-2 relative
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary-light'}
                ${isSelected
                  ? 'border-primary bg-primary-bg scale-100 shadow-sm'
                  : 'border-border bg-white scale-[0.98]'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-md ${isSelected ? 'bg-white text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <div className={`font-semibold text-sm ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                    {type.title}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {type.subtitle}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};