import React from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { LANDING_FEATURES } from '../constants';
import { ChevronDown, ArrowUp, Zap, Sparkles, TrendingUp, ArrowLeftRight, Globe, LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  TrendingUp,
  ArrowLeftRight,
  Globe,
  Zap
};

export const LandingPage: React.FC = () => {
  const { filters, setFilters, startSearch } = useAnalysisStore();
  const [inputValue, setInputValue] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      startSearch(inputValue);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#050505] flex flex-col transition-colors duration-500 font-sans">
      {/* Header / Nav */}
      <nav className="flex items-center justify-end px-8 py-4 bg-transparent">
        <div className="flex gap-4">
           {/* Placeholder for right-side nav items if any */}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center -mt-20 px-4">
        
        {/* Centered Logo & Tagline */}
        <div className="flex flex-col items-center mb-10 animate-in fade-in zoom-in duration-700">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-brand-orange rounded-2xl flex items-center justify-center text-white font-bold text-4xl shadow-xl shadow-brand-orange/30">
                 S
              </div>
              <span className="text-5xl font-bold text-gray-900 dark:text-white tracking-tight">SKYSPER</span>
           </div>
           
           <p className="text-2xl md:text-3xl font-medium tracking-wide text-center">
             <span className="font-bold text-blue-500 dark:text-blue-400">Blue Ocean</span> 
             <span className="mx-3 text-gray-300 dark:text-gray-600">·</span> 
             <span className="font-bold text-red-500 dark:text-red-400">Trending</span> 
             <span className="mx-3 text-gray-300 dark:text-gray-600">·</span> 
             <span className="font-bold text-purple-500 dark:text-purple-400">Redesign</span> 
             <span className="ml-2 text-gray-700 dark:text-gray-300">AI Selection Expert</span>
           </p>
        </div>

        {/* Search Box */}
        <div className="w-full max-w-3xl bg-white dark:bg-[#121212] rounded-3xl shadow-[0_8px_40px_rgb(0,0,0,0.08)] dark:shadow-black/50 border border-gray-100 dark:border-white/10 p-2 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
             <span>I am looking for</span>
             <button className="flex items-center gap-1 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white font-medium">
                {filters.platform} <ChevronDown size={14} />
             </button>
             <button className="flex items-center gap-1 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white font-medium">
                {filters.country} <ChevronDown size={14} />
             </button>
             <span className="text-gray-400 hidden sm:inline">. e.g. Blue ocean niches in Yoga Pants?</span>
          </div>
          
          <form onSubmit={handleSearch} className="relative mt-2">
             <input 
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder="Enter keywords, AI will select products for you..."
               className="w-full h-16 pl-6 pr-16 bg-transparent text-xl text-gray-900 dark:text-white outline-none placeholder-gray-300 dark:placeholder-gray-600"
             />
             <button 
               type="submit"
               disabled={!inputValue}
               className={`absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all ${inputValue ? 'bg-brand-orange text-white hover:bg-orange-600 shadow-lg shadow-orange-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600'}`}
             >
                <ArrowUp size={24} />
             </button>
          </form>
        </div>

        {/* Feature Cards */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-6xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
           {LANDING_FEATURES.map((feature, idx) => {
             const Icon = iconMap[feature.icon];
             return (
               <div key={idx} className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 p-5 rounded-2xl hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/50 hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden text-center md:text-left">
                  {feature.isHot && (
                    <span className="absolute top-0 right-0 bg-red-50 dark:bg-red-900/30 text-red-500 text-[10px] px-2 py-1 rounded-bl-lg font-bold">HOT</span>
                  )}
                  <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 flex items-center justify-center mb-4 group-hover:bg-brand-orange/10 group-hover:text-brand-orange transition-colors mx-auto md:mx-0">
                     <Icon size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-400">{feature.subtitle}</p>
               </div>
             )
           })}
        </div>
        
        {/* Footer Text */}
        <div className="mt-12 text-center text-xs text-gray-300 dark:text-gray-600 animate-in fade-in duration-700 delay-300">
           © 2024 SKYSPER Cross-Border AI. All rights reserved.
        </div>

      </div>
    </div>
  );
};