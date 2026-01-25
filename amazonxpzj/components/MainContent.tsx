import React from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { LandingPage } from './LandingPage';
import { AgentExecutionView } from './AgentExecutionView';
import { AnalysisLayout } from './analysis/AnalysisLayout';

export const MainContent: React.FC = () => {
  const { view } = useAnalysisStore();

  return (
    <div className="flex-1 h-full relative overflow-hidden bg-[#F8FAFC] dark:bg-[#050505] transition-colors duration-500">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-orange/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      
      {view === 'landing' ? (
        <LandingPage />
      ) : (
        <AgentExecutionView />
      )}
    </div>
  );
};