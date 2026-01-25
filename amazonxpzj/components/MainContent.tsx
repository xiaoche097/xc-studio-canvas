import React from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { LandingPage } from './LandingPage';
import { KeywordAnalysisDashboard } from './KeywordAnalysisDashboard';

export const MainContent: React.FC = () => {
  const { view } = useAnalysisStore();

  if (view === 'landing') {
    return <LandingPage />;
  }

  // Analysis View
  return (
    <main className="ml-[340px] min-h-screen bg-[#F8FAFC] dark:bg-[#050505] p-8 transition-all duration-300">
       <div className="max-w-6xl mx-auto">
          <KeywordAnalysisDashboard />
       </div>
    </main>
  );
};