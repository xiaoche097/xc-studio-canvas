import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Image as ImageIcon, Link as LinkIcon, Upload, X } from 'lucide-react';
import { SITE_OPTIONS } from '../constants';
import { useAnalysisStore } from '../stores/analysisStore';

interface RequirementsFormProps {
  featureId: string;
  featureTitle: string;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export const RequirementsForm: React.FC<RequirementsFormProps> = ({ featureId, featureTitle, onBack, onSubmit }) => {
  const [platform, setPlatform] = useState<'Amazon' | 'TikTok'>('Amazon');
  const [country, setCountry] = useState('United States');
  const [inputValue, setInputValue] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'90' | '180'>('90');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
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
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    onSubmit({
      platform,
      country,
      keyword: inputValue,
      images,
      timeRange: parseInt(timeRange)
    });
  };

  const currentPlatformSites = SITE_OPTIONS[platform] || [];

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header bar with Back Button */}
      <div className="flex items-center justify-between px-8 py-5 bg-transparent z-10 sticky top-0">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-brand-orange bg-brand-orange/10 hover:bg-brand-orange/20 rounded-lg transition-colors text-sm font-bold"
          >
              <div className="rotate-180">➤</div> 
              {/* Using a simple arrow or chevron if ChevronLeft is not perfect, but keeping style consistent */}
              <span>返回选品专家</span>
          </button>
      </div>

      <div className="w-full max-w-4xl mx-auto px-4 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-500">
        {/* Title Section */}
        <div className="flex flex-col items-center mb-6">
            <div className="flex items-center gap-2 text-brand-orange font-bold text-lg mb-2">
              <div className="w-6 h-6 bg-brand-orange rounded flex items-center justify-center text-white text-sm">S</div>
              SKYSPER ORCA
            </div>
            <div className="text-gray-500 text-sm">
              您好，请补充您对于<span className="font-bold text-gray-900 dark:text-gray-100 mx-1">{featureTitle.replace('机会', '')}</span>的要求，我将为您精选选品。
            </div>
        </div>

      <div className="bg-white dark:bg-[#121212] rounded-3xl p-8 border border-gray-100 dark:border-white/5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-6">
           <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs">📝</span>
           选品要求补充
        </h2>

        <div className="space-y-8">
           {/* Platform Selection */}
           <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                 关注的平台 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                 {['Amazon', 'TikTok'].map(p => (
                   <button
                     key={p}
                     onClick={() => { setPlatform(p as any); setCountry(SITE_OPTIONS[p as any][0].name); }}
                     className={`
                       flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all
                       ${platform === p 
                         ? 'border-brand-orange bg-brand-orange/5 text-brand-orange font-bold shadow-sm ring-1 ring-brand-orange' 
                         : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}
                     `}
                   >
                      {/* Icons simplified for now */}
                      <span className="text-lg">{p === 'Amazon' ? '🛒' : '🎵'}</span>
                      {p === 'Amazon' ? '亚马逊' : 'TikTok'}
                   </button>
                 ))}
              </div>
           </div>

           {/* Country Selection */}
           <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                 关注的国家/地区 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                 {currentPlatformSites.map(site => (
                   <button
                     key={site.code}
                     onClick={() => setCountry(site.name)}
                     className={`
                       px-4 py-2 rounded-lg border text-sm transition-all
                       ${country === site.name
                         ? 'border-brand-orange bg-white dark:bg-[#1a1a1a] text-brand-orange font-bold shadow-sm' 
                         : 'border-transparent bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}
                     `}
                   >
                      {site.name === 'United States' ? '美国' : site.name === 'United Kingdom' ? '英国' : site.name}
                   </button>
                 ))}
              </div>
           </div>

           {/* Dynamic Input Area */}
           <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                 {featureId === 'image_search' ? '请输入商品图片' : '关键词'} <span className="text-red-500">*</span>
              </label>
              
              {featureId === 'image_search' ? (
                /* Method 2: Image Upload Style from Screenshot 3 */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div 
                     onClick={() => fileInputRef.current?.click()}
                     className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-all text-center h-48"
                   >
                      <Upload className="text-gray-400" size={32} />
                      <div>
                         <p className="text-sm font-bold text-gray-700 dark:text-gray-200">点击上传商品图</p>
                         <p className="text-xs text-gray-400 mt-1">支持JPG/PNG格式，文件大小不超过5MB</p>
                      </div>
                   </div>
                   
                   <div className="border border-gray-100 dark:border-white/5 rounded-xl p-6 bg-gray-50 dark:bg-white/5 flex flex-col justify-center h-48">
                      <div className="flex items-center gap-2 mb-4 text-gray-600 dark:text-gray-300 font-bold text-sm">
                         <LinkIcon size={16} />
                         解析图片链接
                      </div>
                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           placeholder="请粘贴链接到此处"
                           className="flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-sm outline-none focus:border-brand-orange transition-colors"
                         />
                         <button className="px-4 h-10 rounded-lg text-brand-orange bg-brand-orange/10 font-bold text-sm hover:bg-brand-orange/20 transition-colors">
                            解析
                         </button>
                      </div>
                   </div>
                </div>
              ) : (
                /* Method 1: Text Input Style from Screenshot 1 */
                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="请输入关键词，支持中文/英文"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all text-sm"
                />
              )}

              {/* Image Preview for non-image-search modes if user uploads */}
              {featureId !== 'image_search' && images.length > 0 && (
                 <div className="flex gap-2 mt-2">
                    {images.map((img, idx) => (
                       <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                          <img src={img} className="w-full h-full object-cover" />
                          <button onClick={() => removeImage(idx)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl">
                             <X size={12} />
                          </button>
                       </div>
                    ))}
                 </div>
              )}
           </div>

           {/* Time Range */}
           <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                 商品上架时间 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                 {['90', '180'].map(days => (
                    <button
                      key={days}
                      onClick={() => setTimeRange(days as any)}
                      className={`
                        px-6 py-2 rounded-lg border text-sm font-medium transition-all
                        ${timeRange === days 
                           ? 'border-gray-800 dark:border-white text-gray-900 dark:text-white ring-1 ring-gray-800 dark:ring-white' 
                           : 'border-gray-200 dark:border-white/10 text-gray-500 hover:border-gray-400'}
                      `}
                    >
                       近{days}天
                    </button>
                 ))}
              </div>
           </div>

           {/* Advanced Options Toggle */}
           <div className="pt-2 text-center">
              <button 
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 mx-auto"
              >
                 展开高级选项 {isAdvancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
           </div>
        </div>
        
        {/* Hidden File Input */}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
        
        {/* Submit Button */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5 flex justify-center">
           <button 
             onClick={handleSubmit}
             className="w-48 h-12 bg-gray-100 dark:bg-white/10 hover:bg-brand-orange hover:text-white text-gray-600 dark:text-gray-300 rounded-xl font-bold transition-all shadow-sm"
           >
              确认需求
           </button>
        </div>
      </div>
      
      {/* Waiting Indicator - Bottom */}
      <div className="mt-12 flex justify-center">
         <div className="bg-white dark:bg-[#121212] px-6 py-3 rounded-full flex items-center gap-3 shadow-sm border border-gray-100 dark:border-white/5">
            <div className="w-5 h-5 rounded-full border-2 border-brand-orange border-t-transparent animate-spin"></div>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">等待用户确认需求</span>
         </div>
      </div>
      </div>
    </div>
  );
};
