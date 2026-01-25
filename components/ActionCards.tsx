import React, { useState } from 'react';
import { CardProps } from '../types';
import { RefreshIcon, CheckIcon } from './Icons';
import { Visualizer } from './Visualizer';

// --- Shared Button Component ---
const CardActions: React.FC<{ onConfirm: () => void; onRegenerate?: () => void; confirmText: string }> = ({ onConfirm, onRegenerate, confirmText }) => (
  <div className="flex gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/5">
    <button 
      onClick={onConfirm} 
      className="flex-1 bg-brand-orange text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20"
    >
      <CheckIcon /> {confirmText}
    </button>
    <button 
      onClick={onRegenerate}
      className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      title="重新生成"
    >
      <RefreshIcon />
    </button>
  </div>
);

// --- 1. Launch Package Card ---
export const LaunchPackageCard: React.FC<CardProps> = ({ onConfirm, onRegenerate, image, launchData }) => {
  const { 
    productName = "正在分析...", 
    market = "Global", 
    features = [], 
    material = "Unknown", 
    category = "户外装备" 
  } = launchData || {};

  return (
    <div className="space-y-4 font-sans">
      <div className="flex gap-4">
        <img 
          src={image || "https://picsum.photos/seed/skysper_bag/200/200"} 
          alt="Uploaded Product"
          className="w-24 h-24 rounded-lg object-cover border border-gray-200 dark:border-white/10 shadow-md" 
        />
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">启动包数据已生成</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">基于您上传的图片，已提取以下信息：</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2 py-1 bg-brand-orange/10 rounded text-xs text-brand-orange border border-brand-orange/20">{category}</span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-white/5 rounded text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10">{material}</span>
          </div>
        </div>
      </div>
      
      <div className="p-3 bg-gray-50 dark:bg-black/40 rounded-lg text-sm space-y-2 border border-gray-100 dark:border-white/5">
        <div className="flex justify-between">
          <span className="text-gray-500">产品名称</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">{productName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">核心卖点</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium text-right max-w-[60%] truncate">
            {features.length > 0 ? features.join(" · ") : "正在提取..."}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">目标市场</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">{market}</span>
        </div>
      </div>
      
      <CardActions onConfirm={onConfirm} onRegenerate={onRegenerate} confirmText="确认无误，下一步" />
    </div>
  );
};

// --- 2. Strategy Card (P0) ---
export const StrategyCard: React.FC<CardProps> = ({ onConfirm, onRegenerate, strategyData }) => {
  const {
    positioning = "城市新中产首选",
    keywords = "轻盈探索",
    sellingPoints = ["轻量化 (P1)", "透气性 (P1)", "多隔层"]
  } = strategyData || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
         <h3 className="font-bold text-lg text-brand-orange">P0 运营策略 Brief</h3>
         <span className="text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full border border-brand-orange/20">Strategic</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">基于竞品分析，制定以下差异化策略：</p>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/10">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">定位</div>
          <div className="font-bold text-gray-900 dark:text-white">{positioning}</div>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/10">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">核心词</div>
          <div className="font-bold text-gray-900 dark:text-white">{keywords}</div>
        </div>
      </div>
      
      <div className="p-3 bg-brand-blue/10 border border-brand-blue/20 rounded-lg text-sm text-brand-dark/80 dark:text-brand-blue/80">
        <strong className="text-brand-dark dark:text-brand-blue">卖点排序：</strong> 
        <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
          {sellingPoints.map((sp, i) => (
            <React.Fragment key={i}>
              <span className="bg-brand-blue/20 px-1.5 py-0.5 rounded">{sp}</span>
              {i < sellingPoints.length - 1 && <span>&gt;</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <CardActions onConfirm={onConfirm} onRegenerate={onRegenerate} confirmText="批准策略，执行视觉" />
    </div>
  );
};

// --- 3. Visual Guidelines Card (P1) ---
export const VisualGuidelinesCard: React.FC<CardProps> = ({ onConfirm, onRegenerate, visualData }) => {
  const {
    lighting = "10AM 自然光 (Sun-filled)",
    levitation = "左偏 15° + 接触软阴影",
    colors = ["#ED6D46", "#C8E1EF", "#F5F6F7"]
  } = visualData || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-brand-blue rounded-full"></div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">P1 视觉规范指令</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">已生成符合 "Venture Lightly" 的视觉参数：</p>
      
      <div className="space-y-2 text-sm bg-gray-50 dark:bg-black/20 p-2 rounded-lg border border-gray-100 dark:border-white/5">
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-white/5 last:border-0">
          <span className="text-gray-500 dark:text-gray-400">光影设定</span>
          <span className="text-gray-900 dark:text-white font-medium">{lighting}</span>
        </div>
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-white/5 last:border-0">
          <span className="text-gray-500 dark:text-gray-400">悬浮参数</span>
          <span className="text-gray-900 dark:text-white font-medium">{levitation}</span>
        </div>
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-white/5 last:border-0">
          <span className="text-gray-500 dark:text-gray-400">色彩系统</span>
          <div className="flex gap-2">
            {colors.map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-full ring-1 ring-black/5 dark:ring-white/20 shadow-sm" style={{ backgroundColor: c }} title={c}></div>
            ))}
          </div>
        </div>
      </div>
      
      <CardActions onConfirm={onConfirm} onRegenerate={onRegenerate} confirmText="确认规范，生成文案" />
    </div>
  );
};

// --- 4. Copywriting Card (P2) ---
export const CopywritingCard: React.FC<CardProps> = ({ onConfirm, onRegenerate, copyData }) => {
  const {
    title = "Ultra-Light 18L Kids Backpack",
    sellingPoints = [
        { title: "卖点 1", content: "Featherlight Comfort (轻若无物)" },
        { title: "卖点 2", content: "3D Breathable Mesh (会呼吸的背板)" }
    ]
  } = copyData || {};

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-2xl">✍️</span> P2 多语言文案包
      </h3>
      
      <div className="p-4 bg-gradient-to-r from-gray-50 to-transparent dark:from-white/10 rounded-lg border-l-4 border-brand-orange">
        <div className="text-xs text-brand-orange mb-1 font-bold tracking-wider">EN MAIN TITLE</div>
        <div className="font-bold text-xl text-gray-900 dark:text-white">{title}</div>
      </div>
      
      <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
        {sellingPoints.map((sp, i) => (
            <div key={i} className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0"></div>
                <p><strong className="text-gray-900 dark:text-white">{sp.title}:</strong> {sp.content}</p>
            </div>
        ))}
      </div>
      
      <CardActions onConfirm={onConfirm} onRegenerate={onRegenerate} confirmText="确认文案，开始生产" />
    </div>
  );
};

// --- 5. Production Gallery (P3-P5) ---
interface ProductionItem {
  title: string;
  prompt: string;
}

interface ProductionCardProps {
  image?: string | null;
  onConfirm?: () => void;
  mode?: 'p3' | 'p4' | 'p5' | 'all';
  productionData?: {
    mainImage?: string;
    subImages?: (string | ProductionItem)[];
    status?: string;
  };
}

export const ProductionCard: React.FC<ProductionCardProps> = ({ image, productionData, mode = 'all' }) => {
  const { 
    mainImage = "主图Prompt生成中...", 
    subImages = [],
    status = "processing"
  } = productionData || {};

  const [activeSubIndex, setActiveSubIndex] = useState(0);
  const [triggerCount, setTriggerCount] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});

  const handleImageUpdate = (key: string, url: string) => {
    setGeneratedImages(prev => ({...prev, [key]: url}));
  };

  // 判断是否有真正的prompt内容（不是占位符）
  const hasRealPrompt = mainImage && !mainImage.includes("生成中");
  
  const handleSubClick = (idx: number) => {
    setActiveSubIndex(idx);
    setTriggerCount(prev => prev + 1); // Forcing re-generation on click
  };

  const getSubItem = (index: number) => {
    const item = subImages[index];
    if (!item) return { title: `S${index + 1}`, prompt: "Waiting..." };
    if (typeof item === 'string') return { title: `S${index + 1}`, prompt: item };
    return item;
  };

  const currentSubItem = getSubItem(activeSubIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-2">
          <h3 className="font-bold text-xl text-gray-900 dark:text-white">
            {mode === 'p3' && "🚀 生产完成：P3 主图资产"}
            {mode === 'p4' && "🚀 生产完成：P4 副图序列"}
            {mode === 'p5' && "🚀 生产完成：P5 A+ 模块"}
            {mode === 'all' && "🚀 生产完成：P3-P5 全套资产"}
          </h3>
          <span className={`text-xs px-2 py-1 rounded border ${
            status === 'completed' 
              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
              : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
          }`}>
            {status === 'completed' ? 'Ready' : 'Processing'}
          </span>
      </div>
      
      <div className={`grid gap-4 ${mode === 'all' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* P3 Card - 使用提取的prompt */}
        {(mode === 'p3' || mode === 'all') && (
            <div className={`col-span-1 ${mode === 'all' ? '' : 'w-full'}`}>
              <Visualizer 
                  label="P3 MAIN IMAGE" 
                  prompt={hasRealPrompt ? mainImage : "SKYSPER Product, Pure White Background, Soft Contact Shadow, 15-degree tilt, levitation effect"}
                  initialImage={generatedImages['p3-main'] || (!hasRealPrompt ? image : undefined)}
                  onImageGenerated={(url) => handleImageUpdate('p3-main', url)}
                  autoGenerate={false}
                  allowedRatios={['1:1', '3:4']}
              />
              {/* Show Prompt details for P3 only in P3/All mode */}
              {hasRealPrompt && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 relative group">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex justify-between items-center">
                    <span>📝 主图Prompt:</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(mainImage)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-white dark:bg-black/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                    >
                      复制
                    </button>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-mono line-clamp-3 hover:line-clamp-none cursor-text transition-all">{mainImage}</div>
                </div>
              )}
            </div>
        )}

        {/* P4 Card - 使用选中的副图描述 */}
        {(mode === 'p4' || mode === 'all') && (
            <div className={`col-span-1 ${mode === 'all' ? '' : 'w-full'}`}>
              <Visualizer 
                  key={`p4-${activeSubIndex}-${triggerCount}`}
                  label={`P4 SUB-IMAGE S${activeSubIndex + 1} - ${currentSubItem.title}`} 
                  prompt={currentSubItem.prompt}
                  initialImage={generatedImages[`p4-${activeSubIndex}`] || (subImages.length === 0 ? image : undefined)}
                  onImageGenerated={(url) => handleImageUpdate(`p4-${activeSubIndex}`, url)}
                  autoGenerate={false} // Force manual generation
                  allowedRatios={['1:1', '3:4']}
              />
            </div>
        )}
      </div>

      {/* 显示可点击的副图列表 - P4 only or All */}
      {(mode === 'p4' || mode === 'all') && subImages.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">📷 副图序列 (点击生成/预览):</div>
          <div className="grid gap-2">
            {subImages.map((item, idx) => {
              const data = typeof item === 'string' 
                  ? { title: `序列 S${idx + 1}`, prompt: item, desc: item } 
                  : { title: item.title, prompt: item.prompt, desc: item.prompt };
              
              return (
              <button 
                key={idx} 
                onClick={() => handleSubClick(idx)}
                className={`w-full text-left p-3 rounded-xl text-xs border transition-all ${
                  activeSubIndex === idx 
                    ? 'bg-brand-orange/5 border-brand-orange shadow-sm' 
                    : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10 hover:border-brand-orange/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${activeSubIndex === idx ? 'bg-brand-orange text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}>
                    S{idx + 1}
                  </span>
                  <div>
                      <div className={`font-bold ${activeSubIndex === idx ? 'text-brand-orange' : 'text-gray-900 dark:text-white'}`}>
                          {data.title}
                      </div>
                      {activeSubIndex === idx && <span className="text-[10px] text-brand-orange opacity-80">正在预览</span>}
                  </div>
                </div>
                <div className="text-gray-500 dark:text-gray-400 line-clamp-2 pl-8 opacity-80">
                   {data.desc}
                </div>
              </button>
            )})}
          </div>
        </div>
      )}

      {/* P5 A+ 模块 - P5 only or All */}
      {(mode === 'p5' || mode === 'all') && (
          <div className="space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-white">P5 A+ 页面资产 (6-7张)</h3>
              <div className="grid grid-cols-1 gap-4">
                 {subImages.length > 0 ? subImages.map((item, idx) => {
                    const data = typeof item === 'string' 
                        ? { title: `M${idx + 1}`, prompt: item } 
                        : { title: item.title, prompt: item.prompt };
                    return (
                    <Visualizer 
                        key={`p5-${idx}`}
                        label={`P5 MODULE M${idx + 1} - ${data.title}`}
                        prompt={data.prompt}
                        initialImage={generatedImages[`p5-${idx}`]}
                        onImageGenerated={(url) => handleImageUpdate(`p5-${idx}`, url)}
                        autoGenerate={false}
                        allowedRatios={['16:9']}
                        aspectRatio="16:9"
                    />
                 )}) : (
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded text-center text-gray-500">
                        等待生成 P5 A+ 描述...
                    </div>
                 )}
              </div>
          </div>
      )}
      
      {mode === 'all' && (
        <div className="flex justify-center pt-2">
            <button className="px-8 py-3 bg-brand-orange text-white rounded-full font-bold shadow-lg shadow-orange-500/20 hover:-translate-y-1 hover:shadow-orange-500/40 transition-all w-full md:w-auto">
            导出所有资产包 (Zip)
            </button>
        </div>
      )}
    </div>
  );
};

// --- 6. Production Select Card (选择生成内容) ---
interface ProductionSelectCardProps {
  onSelectMain: () => void;
  onSelectSecondary: () => void;
  onSelectAplus: () => void;
  onSelectAll: () => void;
}

export const ProductionSelectCard: React.FC<ProductionSelectCardProps> = ({ 
  onSelectMain, 
  onSelectSecondary, 
  onSelectAplus, 
  onSelectAll 
}) => (
  <div className="space-y-5 font-sans">
    <div className="text-center pb-3 border-b border-gray-100 dark:border-white/5">
      <h3 className="font-bold text-xl text-gray-900 dark:text-white">🎨 策略与文案已就绪</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
        P0策略、P1视觉、P2文案已完成，请选择要生成的图片资产：
      </p>
    </div>

    <div className="grid grid-cols-1 gap-3">
      {/* P3 主图 */}
      <button 
        onClick={onSelectMain}
        className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-xl border border-blue-200 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-400 transition-all group text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📸</span>
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                P3 主图生成
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                纯白背景 · 悬浮效果 · Amazon合规
              </div>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-blue-500 transition-colors">→</span>
        </div>
      </button>

      {/* P4 副图 */}
      <button 
        onClick={onSelectSecondary}
        className="p-4 bg-gradient-to-r from-green-500/10 to-teal-500/10 dark:from-green-500/20 dark:to-teal-500/20 rounded-xl border border-green-200 dark:border-green-500/30 hover:border-green-400 dark:hover:border-green-400 transition-all group text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🖼️</span>
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                P4 副图序列
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                信息图 · 场景图 · 细节图 · 6张序列
              </div>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-green-500 transition-colors">→</span>
        </div>
      </button>

      {/* P5 A+ */}
      <button 
        onClick={onSelectAplus}
        className="p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20 rounded-xl border border-orange-200 dark:border-orange-500/30 hover:border-orange-400 dark:hover:border-orange-400 transition-all group text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏗️</span>
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                P5 A+ 页面
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                杂志级排版 · Premium模块 · 6个区块
              </div>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-orange-500 transition-colors">→</span>
        </div>
      </button>
    </div>

    {/* 全部生成 */}
    <button 
      onClick={onSelectAll}
      className="w-full p-4 bg-brand-orange text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 hover:shadow-orange-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
    >
      <span>🚀</span>
      全部生成（P3 + P4 + P5）
    </button>

    <p className="text-xs text-center text-gray-400 dark:text-gray-500">
      提示：每个步骤会先输出设计方案，然后根据提示词生成图片
    </p>
  </div>
);

// --- 7. Generation Card (通用生图卡片) ---
interface GenerationCardProps {
  prompt: string;
  aspectRatio?: string;
  onGenerate: () => void;
  status: 'idle' | 'generating' | 'completed' | 'error';
  resultImage?: string | null;
  errorMsg?: string;
}

export const GenerationCard: React.FC<GenerationCardProps> = ({ 
  prompt, 
  aspectRatio = "1:1",
  onGenerate, 
  status, 
  resultImage, 
  errorMsg 
}) => {
  const [isZoomed, setIsZoomed] = React.useState(false);

  return (
    <>
    <div className="space-y-4 font-sans border border-gray-200 dark:border-white/10 rounded-2xl p-5 bg-white dark:bg-[#1a1a1a] shadow-sm">
       <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-3">
          <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange">
            <span className="text-xl">✨</span>
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">图像生成准备就绪</h3>
            <div className="text-xs text-gray-500">AI 已优化提示词 · 比例 {aspectRatio}</div>
          </div>
       </div>
       
       {/* Prompt Preview */}
       <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
          <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Reference Prompt</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-text">
            {prompt}
          </p>
       </div>

       {/* Result Display */}
       {status === 'completed' && resultImage && (
          <div className="relative rounded-xl overflow-hidden shadow-lg border border-gray-100 dark:border-white/10 group">
             <img 
               src={resultImage} 
               alt="Generated Result" 
               className="w-full h-auto cursor-zoom-in" 
               onClick={() => setIsZoomed(true)}
             />
             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 pointer-events-none">
                <a 
                  href={resultImage} 
                  download={`skysper_gen_${Date.now()}.png`}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:scale-105 transition-transform pointer-events-auto"
                >
                  下载原图
                </a>
                <button 
                  onClick={() => setIsZoomed(true)}
                  className="px-4 py-2 bg-white/20 backdrop-blur text-white rounded-lg text-sm font-bold hover:scale-105 transition-transform pointer-events-auto"
                >
                  放大查看
                </button>
             </div>
          </div>
       )}

       {/* Error Message */}
       {status === 'error' && (
         <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30 flex items-center gap-2">
           <span>⚠️</span> {errorMsg || "生成失败，请稍后重试"}
         </div>
       )}

       {/* Action Button */}
       <button 
          onClick={onGenerate} 
          disabled={status === 'generating'}
          className={`
            w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
            ${status === 'generating' 
              ? 'bg-gray-400 cursor-wait' 
              : 'bg-brand-orange hover:-translate-y-0.5 hover:shadow-brand-orange/30 active:scale-[0.98]'}
          `}
       >
          {status === 'generating' ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在绘图...
            </>
          ) : (
            <>
              {status === 'completed' ? '重新生成' : '开始生成'}
            </>
          )}
       </button>
    </div>

    {/* Zoom Modal */}
    {isZoomed && resultImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <img 
            src={resultImage} 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking image itself? Or allow close? Usually allow close.
            // Actually nice UX is clicking anywhere closes it, or clicking image keeps it open but clicking background closes.
            // But let's keep simple: Click background closes.
            // If user wants to right click image to save, we shouldn't close on image click.
          />
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setIsZoomed(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
    )}
    </>
  );
};