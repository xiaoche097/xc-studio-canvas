import React from 'react';
import { Metric } from '../types';

interface MetricCardsProps {
  title: string;
  metrics: Metric[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ title, metrics }) => {
  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <h2 className="text-xl font-bold text-text-primary mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.id}
            className="bg-white p-5 rounded-xl border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-text-secondary">{metric.label}</span>
              {metric.trend && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  metric.trend === 'up' ? 'bg-green-100 text-success' : 
                  metric.trend === 'down' ? 'bg-red-100 text-danger' : 'bg-gray-100 text-text-secondary'
                }`}>
                  {metric.trendValue}
                </span>
              )}
            </div>
            
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${
                metric.status === 'success' ? 'text-success' :
                metric.status === 'warning' ? 'text-warning' :
                metric.status === 'danger' ? 'text-danger' :
                'text-text-primary'
              }`}>
                {metric.value}
              </span>
              {metric.suffix && (
                <span className="text-sm text-text-tertiary">{metric.suffix}</span>
              )}
            </div>
            
            {/* Decorative Bar */}
            <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
               <div className={`h-full rounded-full w-2/3 ${
                  metric.status === 'success' ? 'bg-success' :
                  metric.status === 'warning' ? 'bg-warning' :
                  'bg-primary'
               }`}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};