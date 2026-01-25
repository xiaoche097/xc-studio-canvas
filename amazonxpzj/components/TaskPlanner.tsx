import React from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

export const TaskPlanner: React.FC = () => {
  const { taskSteps } = useAnalysisStore();

  if (taskSteps.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-border p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-lg font-semibold text-text-primary">📋 任务规划</h2>
        <span className="px-2 py-0.5 rounded-full bg-primary-bg text-primary text-xs font-medium">
          AI Agent Working
        </span>
      </div>

      <div className="space-y-4">
        {taskSteps.map((step, index) => {
          let Icon = Clock;
          let colorClass = 'text-gray-400';
          let bgClass = 'bg-gray-50';
          let borderClass = 'border-transparent';

          if (step.status === 'completed') {
            Icon = CheckCircle2;
            colorClass = 'text-success';
            bgClass = 'bg-green-50';
          } else if (step.status === 'running') {
            Icon = Loader2;
            colorClass = 'text-warning';
            bgClass = 'bg-yellow-50';
            borderClass = 'border-warning/30';
          } else if (step.status === 'error') {
            Icon = XCircle;
            colorClass = 'text-danger';
            bgClass = 'bg-red-50';
          }

          return (
            <div
              key={step.id}
              className={`
                relative flex items-start gap-4 p-4 rounded-lg transition-all duration-300
                ${step.status === 'running' ? `border ${borderClass} shadow-sm scale-[1.01]` : ''}
              `}
            >
              <div className={`mt-0.5 p-1 rounded-full ${bgClass}`}>
                <Icon size={20} className={`${colorClass} ${step.status === 'running' ? 'animate-spin' : ''}`} />
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h3 className={`font-medium ${step.status === 'pending' ? 'text-text-secondary' : 'text-text-primary'}`}>
                    Step {index + 1}: {step.title}
                  </h3>
                  {step.status === 'running' && step.progress !== undefined && (
                    <span className="text-xs font-mono text-warning">{step.progress}%</span>
                  )}
                </div>
                
                <p className="text-sm text-text-tertiary mt-1">
                  {step.status === 'completed' 
                    ? `✓ ${step.description}` 
                    : step.status === 'running' 
                      ? `正在执行: ${step.description}...` 
                      : step.description}
                </p>

                {step.status === 'running' && step.progress !== undefined && (
                  <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-warning transition-all duration-300 ease-out"
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};