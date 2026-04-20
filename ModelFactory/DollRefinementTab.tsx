import React from 'react';
import { Sparkles, Construction } from 'lucide-react';

const DollRefinementTab: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-pastel-bg text-pastel-muted">
      <div className="w-24 h-24 mb-6 bg-white rounded-[32px] shadow-sm border-2 border-dashed border-pastel-border flex items-center justify-center">
        <Construction className="w-10 h-10" />
      </div>
      <h3 className="text-xl font-bold text-pastel-text mb-2">玩偶主图精修</h3>
      <p className="text-xs">该功能正在开发中，敬请期待...</p>
    </div>
  );
};

export default DollRefinementTab;
