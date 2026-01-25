import React from 'react';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { useAnalysisStore } from './stores/analysisStore';

function App() {
  const { view } = useAnalysisStore();
  const showSidebar = view === 'analysis';

  return (
    <div className="min-h-screen bg-bg-page font-sans text-text-primary">
      <MainContent />
    </div>
  );
}

export default App;