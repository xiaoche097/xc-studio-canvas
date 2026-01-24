import React, { useState } from 'react';
import { AgentPrompt } from '../data/agentPrompts';
import { 
  SparklesIcon, 
  RobotIcon, 
  SettingsIcon,
  VisualGuidelinesIcon,
  StrategyIcon,
  CopyIcon,
  ProductionIcon,
  PackageIcon
} from './Icons';

interface PromptInspectorProps {
  prompt: AgentPrompt;
  isActive: boolean;
}

// Helper to map prompt to icon
const getStepIcon = (pr: AgentPrompt) => {
    if (pr.name.includes("Command")) return <SettingsIcon />;
    if (pr.name.includes("Analyzer")) return <PackageIcon />;
    if (pr.name.includes("Strategy")) return <StrategyIcon />;
    if (pr.name.includes("Visual")) return <VisualGuidelinesIcon />;
    if (pr.name.includes("Copywriter")) return <CopyIcon />;
    if (pr.name.includes("Production")) return <ProductionIcon />;
    return <RobotIcon />;
};

export const PromptInspector: React.FC<PromptInspectorProps> = ({ prompt, isActive }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!prompt) return null;

  return (
    <div className={`
      fixed right-4 top-24 w-80 
      bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl 
      border border-gray-200 dark:border-white/10 
      rounded-2xl shadow-2xl transition-all duration-300 z-50
      ${isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+16px)]'}
    `}>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          absolute left-0 top-6 -translate-x-full 
          p-3 rounded-l-xl 
          bg-white dark:bg-[#111] 
          border-y border-l border-gray-200 dark:border-white/10
          text-brand-orange shadow-[-4px_4px_12px_rgba(0,0,0,0.05)]
          flex items-center gap-2
          hover:bg-gray-50 dark:hover:bg-white/5 transition-colors
        `}
      >
        <SparklesIcon className="w-5 h-5" />
        <span className="text-xs font-bold writing-vertical-lr hidden">PROMPT</span>
      </button>

      {/* Content */}
      <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden rounded-2xl">
        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="text-brand-orange">
                {getStepIcon(prompt)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {prompt.name}
              </h3>
              <p className="text-xs text-brand-orange font-mono">
                {prompt.role}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-bold">
              Core Mission
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {prompt.description}
            </p>
          </div>

          {prompt.constraints && prompt.constraints.length > 0 && (
            <div>
               <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-bold">
                Constraints
              </div>
              <ul className="space-y-1">
                {prompt.constraints.map((constraint, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <span className="text-red-500/70 mt-1">•</span>
                    <span>{constraint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-bold flex justify-between">
              <span>System Prompt</span>
              <span className="text-brand-orange">{prompt.systemPrompt.length} chars</span>
            </div>
            <div className="bg-gray-50 dark:bg-black/50 p-3 rounded-lg border border-gray-100 dark:border-white/5 overflow-x-auto relative">
              <pre className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed select-text">
                {prompt.systemPrompt}
              </pre>
              <button 
                onClick={() => navigator.clipboard.writeText(prompt.systemPrompt)}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-brand-orange bg-white/50 dark:bg-black/20 rounded-md transition-colors"
                title="Copy Prompt"
              >
                <CopyIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        {isActive && (
          <div className="p-3 bg-brand-orange/10 dark:bg-brand-orange/20 border-t border-brand-orange/20 text-center">
             <span className="text-xs font-bold text-brand-orange flex items-center justify-center gap-2">
               <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
               Agent Active
             </span>
          </div>
        )}
      </div>
    </div>
  );
};
