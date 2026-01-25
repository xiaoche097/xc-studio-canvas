import React from 'react';
import { AnalysisSidebar } from './AnalysisSidebar';

interface AnalysisLayoutProps {
  children: React.ReactNode;
}

export const AnalysisLayout: React.FC<AnalysisLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-full bg-[#fcfcfc] dark:bg-[#0a0a0a]">
      <AnalysisSidebar />
      <div className="flex-1 w-0 h-full overflow-hidden relative flex flex-col">
          {children}
      </div>
    </div>
  );
};
