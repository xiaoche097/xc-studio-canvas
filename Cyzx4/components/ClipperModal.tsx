import React from 'react';
import { X, ChevronRight, Download, CheckCircle2, Sparkles } from 'lucide-react';

interface ClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadExtension?: () => void;
}

export const ClipperModal: React.FC<ClipperModalProps> = ({
  isOpen,
  onClose,
  onDownloadExtension,
}) => {
  if (!isOpen) return null;

  const platforms = [
    {
      id: 'xiaohongshu',
      name: '小红书',
      desc: '潮贴封面、服饰笔记，一张不落',
      bgColor: 'bg-[#ff2442]',
      iconText: '小',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      desc: '全球美图和氛围感，刷到就收',
      bgColor: 'bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888]',
      iconText: 'IG',
    },
    {
      id: 'amazon',
      name: '亚马逊',
      desc: '热卖款的主图，拿来就是参考',
      bgColor: 'bg-[#ff9900]',
      iconText: '亚',
    },
    {
      id: 'taobao',
      name: '淘宝',
      desc: '爆款主图、详情页，一次收齐',
      bgColor: 'bg-[#ff5000]',
      iconText: '淘',
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      desc: '汇聚全球创意灵感，一键剪藏到画板',
      bgColor: 'bg-[#e60023]',
      iconText: 'P',
    },
  ];

  const handleDownload = () => {
    // 创建一个提示下载打包好的 Chrome 扩展压缩包
    const zipUrl = '/xc-ai-clipper-extension.zip';
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'xc-ai-clipper-extension.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (onDownloadExtension) onDownloadExtension();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2.2rem] border border-white/80 bg-white/95 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900 sm:p-10">
        {/* 背景光晕 */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />

        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          aria-label="关闭"
        >
          <X size={18} />
        </button>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center">
          {/* 左侧：标语与说明 (复刻图 4 左侧) */}
          <div className="space-y-4 md:col-span-5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/80 bg-orange-50/80 px-3 py-1 text-xs font-bold text-orange-600">
              <Sparkles size={13} />
              XC AI 官方扩展
            </div>

            <div>
              <h2 className="font-serif text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                XC AI Clipper
              </h2>
              <h3 className="mt-1 text-2xl font-black text-slate-800 dark:text-slate-200">
                灵感随手收
              </h3>
            </div>

            <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              看到喜欢的灵感图，一键收进你的 XC AI 灵感库。支持跨电商与社媒全网裁剪。
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-lg transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 hover:scale-[1.02] cursor-pointer"
              >
                <Download size={15} />
                下载 Chrome 扩展包
              </button>
              <p className="mt-2 text-[11px] text-slate-400">
                下载解压后在 chrome://extensions 开启“开发者模式”加载即可
              </p>
            </div>
          </div>

          {/* 右侧：5大平台集成列表 (精确复刻图 4 右侧，包含 Pinterest) */}
          <div className="space-y-2.5 md:col-span-7">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 transition-all hover:border-slate-200 hover:bg-white hover:shadow-md dark:border-white/5 dark:bg-slate-800/60 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-xs ${platform.bgColor}`}
                  >
                    <span className="text-sm">{platform.iconText}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {platform.name}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium">{platform.desc}</p>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-600 dark:text-slate-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClipperModal;
