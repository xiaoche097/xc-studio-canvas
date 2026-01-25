import React, { useState, useRef } from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { LANDING_FEATURES, SITE_OPTIONS } from '../constants';
import { ChevronDown, ArrowUp, Zap, Sparkles, TrendingUp, ArrowLeftRight, Globe, LucideIcon, Image as ImageIcon, X, Link as LinkIcon, Check } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  TrendingUp,
  ArrowLeftRight,
  Globe,
  Zap
};

export const LandingPage: React.FC = () => {
  const { filters, setFilters, startSearch } = useAnalysisStore();
  const [inputValue, setInputValue] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isInternetSearch, setIsInternetSearch] = useState(false);
  
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages: string[] = [];
      const files = Array.from(e.target.files);
      
      let processedCount = 0;
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            newImages.push(reader.result);
          }
          processedCount++;
          if (processedCount === files.length) {
            setImages(prev => [...prev, ...newImages].slice(0, 5));
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = ''; // Reset
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() || images.length > 0) {
      startSearch(inputValue, images, isInternetSearch);
    }
  };

  const currentPlatformSites = SITE_OPTIONS[filters.platform] || SITE_OPTIONS['Amazon'];
  const currentSite = currentPlatformSites.find(s => s.name === filters.country) || currentPlatformSites[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#050505] flex flex-col transition-colors duration-500 font-sans" onClick={() => { setShowPlatformMenu(false); setShowCountryMenu(false); }}>
      {/* Header / Nav */}
      <nav className="flex items-center justify-end px-8 py-4 bg-transparent">
        <div className="flex gap-4"></div>
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
          
          {/* Top Bar: Dropdowns */}
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-50 dark:border-white/5 mb-1 pb-2">
             <span>I am looking for</span>
             
             {/* Platform Dropdown */}
             <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowPlatformMenu(!showPlatformMenu); setShowCountryMenu(false); }}
                  className="flex items-center gap-1 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white font-medium transition-colors"
                >
                    {filters.platform} <ChevronDown size={14} />
                </button>
                {showPlatformMenu && (
                  <div className="absolute top-full left-0 mt-2 w-32 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-100 dark:border-white/10 overflow-hidden z-50">
                     {Object.keys(SITE_OPTIONS).map(p => (
                       <button
                         key={p}
                         onClick={(e) => {
                           setFilters({ platform: p as any, country: SITE_OPTIONS[p][0].name }); // Default to first country
                           setShowPlatformMenu(false);
                         }}
                         className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-sm ${filters.platform === p ? 'text-brand-orange bg-brand-orange/5' : 'text-gray-700 dark:text-gray-300'}`}
                       >
                         {p}
                       </button>
                     ))}
                  </div>
                )}
             </div>

             {/* Country Dropdown */}
             <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowCountryMenu(!showCountryMenu); setShowPlatformMenu(false); }}
                  className="flex items-center gap-1 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white font-medium transition-colors"
                >
                    <span className="text-base leading-none mr-1">{currentSite?.flag}</span>
                    {currentSite?.name} <ChevronDown size={14} />
                </button>
                {showCountryMenu && (
                   <div className="absolute top-full left-0 mt-2 w-48 max-h-64 overflow-y-auto custom-scrollbar bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-100 dark:border-white/10 z-50">
                      {currentPlatformSites.map((s) => (
                        <button
                          key={s.code}
                          onClick={() => {
                            setFilters({ country: s.name });
                            setShowCountryMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-sm flex items-center gap-2 ${filters.country === s.name ? 'text-brand-orange bg-brand-orange/5' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          <span className="text-base">{s.flag}</span>
                          <span>{s.name}</span>
                        </button>
                      ))}
                   </div>
                )}
             </div>
             
             <span className="text-gray-400 hidden md:inline ml-auto text-xs">
                Supports Keywords, Links & Images
             </span>
          </div>

          {/* Uploaded Images Preview inside Input Area */}
          {images.length > 0 && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto custom-scrollbar">
               {images.map((img, idx) => (
                 <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 flex-shrink-0 group">
                    <img src={img} alt="preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-opacity"
                    >
                       <X size={12} />
                    </button>
                 </div>
               ))}
            </div>
          )}
          
          <form onSubmit={handleSearch} className="relative">
             <div className="flex items-center px-2">
                {/* Image Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5 rounded-xl transition-colors shrink-0 tooltip-trigger relative group"
                >
                   <ImageIcon size={24} />
                   <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                      Upload Image (Max 5)
                   </span>
                </button>
                <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept="image/*" 
                   multiple 
                   onChange={handleFileUpload} 
                />

                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter keywords or paste Amazon/TikTok links..."
                  className="w-full h-14 pl-3 pr-20 bg-transparent text-xl text-gray-900 dark:text-white outline-none placeholder-gray-300 dark:placeholder-gray-600"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                   {/* Internet Search Toggle */}
                   <button
                     type="button"
                     onClick={() => setIsInternetSearch(!isInternetSearch)}
                     className={`
                       flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                       ${isInternetSearch 
                         ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                         : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-transparent hover:bg-gray-200'}
                     `}
                   >
                     <Globe size={14} />
                     {isInternetSearch ? 'Online' : 'Offline'}
                   </button>

                   {/* Submit Button */}
                   <button 
                     type="submit"
                     disabled={!inputValue && images.length === 0}
                     className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${inputValue || images.length > 0 ? 'bg-brand-orange text-white hover:bg-orange-600 shadow-lg shadow-orange-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600'}`}
                   >
                      <ArrowUp size={20} />
                   </button>
                </div>
             </div>
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