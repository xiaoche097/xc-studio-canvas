import React, { useState } from 'react';
import { Camera, Download, Maximize2, Sparkles, X } from 'lucide-react';

type AngleThumbSpec = {
  view: 'front' | 'back' | 'threeQuarter';
  hands: 'down' | 'pockets' | 'behindBack' | 'hip' | 'pullHem';
  crop: 'tight' | 'mid';
};

type MainAngleGalleryItem = {
  id: string;
  label: string;
  prompt: string;
  imageUrl?: string | null;
  thumb?: AngleThumbSpec;
};

interface MainAngleGalleryProps {
  items: MainAngleGalleryItem[];
  isGenerating?: boolean;
  statusMessage?: string;
  aspectRatio?: string;
}

const THUMB_META = {
  view: {
    front: '正面',
    back: '背面',
    threeQuarter: '3/4 侧前',
  },
  hands: {
    down: '手臂下垂',
    pockets: '双手插袋',
    behindBack: '双手背后',
    hip: '单手搭腰',
    pullHem: '拉摆动作',
  },
  crop: {
    tight: '近景',
    mid: '半身',
  },
} as const;

const getAngleMeta = (spec?: AngleThumbSpec) => {
  if (!spec) {
    return [];
  }

  return [
    THUMB_META.view[spec.view],
    THUMB_META.hands[spec.hands],
    THUMB_META.crop[spec.crop],
  ];
};

const downloadImage = (url: string, name: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
};

const AngleThumb: React.FC<{ spec: AngleThumbSpec }> = ({ spec }) => {
  const stroke = '#f97316';
  const fill = 'rgba(249,115,22,0.07)';
  const isBack = spec.view === 'back';
  const isThreeQuarter = spec.view === 'threeQuarter';
  const isTight = spec.crop === 'tight';
  const torsoTop = isTight ? 14 : 12;
  const torsoBottom = isTight ? 58 : 62;
  const hipY = isTight ? 44 : 48;
  const tiltX = isThreeQuarter ? 3 : 0;

  return (
    <svg viewBox="0 0 60 80" className="w-20 h-28 rounded-2xl border border-orange-200 bg-white shadow-sm" aria-hidden="true">
      <rect x="1" y="1" width="58" height="78" rx="10" fill={fill} stroke="none" />
      <circle cx={30 + tiltX} cy={10} r={6} fill="none" stroke={stroke} strokeWidth={2} opacity={0.92} />
      <path
        d={`M ${22 + tiltX} ${torsoTop} Q ${30 + tiltX} ${torsoTop - 6} ${38 + tiltX} ${torsoTop}`}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        opacity={0.92}
      />
      <path
        d={`M ${20 + tiltX} ${torsoTop} L ${17 + tiltX} ${hipY} Q ${30 + tiltX} ${torsoBottom} ${43 + tiltX} ${hipY} L ${40 + tiltX} ${torsoTop}`}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        opacity={0.92}
      />
      {isBack && (
        <path
          d={`M ${30 + tiltX} ${torsoTop + 6} L ${30 + tiltX} ${hipY - 4}`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          opacity={0.7}
          strokeDasharray="2 2"
        />
      )}
      {spec.hands === 'down' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 8} L ${13 + tiltX} ${hipY + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 8} L ${47 + tiltX} ${hipY + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}
      {spec.hands === 'pockets' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 10} L ${24 + tiltX} ${hipY + 4}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 10} L ${36 + tiltX} ${hipY + 4}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${23 + tiltX} ${hipY + 4} L ${27 + tiltX} ${hipY + 8}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${37 + tiltX} ${hipY + 4} L ${33 + tiltX} ${hipY + 8}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}
      {spec.hands === 'behindBack' && (
        <>
          <path d={`M ${18 + tiltX} ${torsoTop + 10} Q ${30 + tiltX} ${hipY + 10} ${42 + tiltX} ${torsoTop + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.75} />
          <circle cx={30 + tiltX} cy={hipY + 10} r={2} fill={stroke} opacity={0.75} />
        </>
      )}
      {spec.hands === 'hip' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 10} L ${26 + tiltX} ${hipY + 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${26 + tiltX} ${hipY + 2} L ${22 + tiltX} ${hipY + 6}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 8} L ${47 + tiltX} ${hipY + 10}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}
      {spec.hands === 'pullHem' && (
        <>
          <path d={`M ${20 + tiltX} ${torsoTop + 10} L ${16 + tiltX} ${torsoBottom - 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${40 + tiltX} ${torsoTop + 10} L ${44 + tiltX} ${torsoBottom - 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${16 + tiltX} ${torsoBottom - 2} L ${12 + tiltX} ${torsoBottom + 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
          <path d={`M ${44 + tiltX} ${torsoBottom - 2} L ${48 + tiltX} ${torsoBottom + 2}`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.85} />
        </>
      )}
      {!isTight && (
        <>
          <path d={`M ${27 + tiltX} ${torsoBottom - 2} L ${24 + tiltX} 74`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.65} />
          <path d={`M ${33 + tiltX} ${torsoBottom - 2} L ${36 + tiltX} 74`} fill="none" stroke={stroke} strokeWidth={2} opacity={0.65} />
        </>
      )}
    </svg>
  );
};

const MainAngleGallery: React.FC<MainAngleGalleryProps> = ({
  items,
  isGenerating = false,
  statusMessage = '',
  aspectRatio = '2:3',
}) => {
  const [previewItem, setPreviewItem] = useState<MainAngleGalleryItem | null>(null);
  const completedCount = items.filter((item) => !!item.imageUrl).length;
  
  const aspectClass = aspectRatio === '4:5' ? 'aspect-[4/5]' : aspectRatio === '3:4' ? 'aspect-[3/4]' : 'aspect-[2/3]';

  return (
    <div className="h-full w-full overflow-auto custom-scrollbar px-2 py-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-orange-200 bg-white/80 p-6 shadow-[0_20px_60px_rgba(249,115,22,0.08)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">
                <Sparkles className="h-3.5 w-3.5" />
                Main Angle Lock
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">主图角度缩略图工作区</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  主图模式按所选的 {aspectRatio} 画幅输出单张生成结果。左侧是角度参考缩略图，右侧是生成结果对齐区。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                已完成 {completedCount}/{items.length || 0}
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700">
                主图画幅 {aspectRatio}
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
              <div className="h-4 w-4 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />
              <span>{statusMessage || '正在逐张生成主图角度...'}</span>
            </div>
          )}
        </section>

        {items.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-8 text-center">
            <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
              <Camera className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">先勾选要输出的主图角度</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              选中左侧的 M1-M6 后，这里会按顺序显示每个角度的参考缩略图和对应结果。
            </p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {items.map((item) => {
              const meta = getAngleMeta(item.thumb);

              return (
                <article key={item.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-orange-500 px-3 py-1 text-[11px] font-black tracking-[0.2em] text-white">
                          {item.id}
                        </span>
                        <h3 className="truncate text-base font-black text-slate-900">{item.label}</h3>
                      </div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-[11px] font-bold ${item.imageUrl ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {item.imageUrl ? '已生成' : '待生成'}
                    </div>
                  </div>

                  <div className="grid gap-0 md:grid-cols-[210px,1fr]">
                    <div className="border-b border-slate-100 bg-slate-50/70 p-5 md:border-b-0 md:border-r">
                      <div className="flex flex-col items-center rounded-[24px] border border-orange-100 bg-white p-4 shadow-sm">
                        {item.thumb ? (
                          <AngleThumb spec={item.thumb} />
                        ) : (
                          <div className="flex h-28 w-20 items-center justify-center rounded-2xl border border-orange-200 bg-white text-[10px] font-semibold text-orange-500">
                            无缩略图
                          </div>
                        )}
                        <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">
                          Reference
                        </div>
                      </div>

                      {meta.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {meta.map((itemMeta) => (
                            <span key={itemMeta} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                              {itemMeta}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="mt-4 text-xs leading-6 text-slate-500">{item.prompt}</p>
                    </div>

                    <div className="p-5">
                      <div className={`relative ${aspectClass} overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100`}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={`${item.id} result`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-400">
                            <Camera className="mb-3 h-9 w-9" />
                            <div className="text-sm font-semibold">等待该角度生成</div>
                            <div className="mt-2 text-xs leading-5">生成后会固定按 {aspectRatio} 显示在这里，便于逐张核对角度和构图。</div>
                          </div>
                        )}
                      </div>

                      {item.imageUrl && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-600"
                          >
                            <Maximize2 className="h-4 w-4" />
                            放大预览
                          </button>
                          <button
                            onClick={() => downloadImage(item.imageUrl!, `${item.id}-main-angle.png`)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-transform active:scale-[0.98]"
                          >
                            <Download className="h-4 w-4" />
                            下载该角度
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {previewItem?.imageUrl && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-md"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute right-5 top-5 z-20 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={previewItem.imageUrl} alt={previewItem.label} className="max-h-[92vh] w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MainAngleGallery;
