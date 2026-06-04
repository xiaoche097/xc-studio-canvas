import React, { useState } from 'react';
import { Bell, BookOpen, Check, Copy, ExternalLink, Megaphone, X } from 'lucide-react';

type SystemNoticeTab = 'notice' | 'guide';

interface SystemNoticeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const YUNWU_REGISTER_URL = 'https://yunwu.ai/register?aff=9EVV';

const RECENT_UPDATES = [
  '系统通告弹窗已上线，后续所有新功能和重要调整都会记录在这里。',
  'AI 创意视频页面升级为 Flow 风格工作台，支持素材上传、筛选、框选和底部生成栏。',
  '主图生成新增男士短裤、长裤专用动作库，并优化裤装默认构图规则。',
  '局部替换新增结构参考使用说明入口，方便查看裁切贴回和涂抹建议。',
];

const YUNWU_GROUPS = [
  { priority: '优先级 1', name: '限时特价 / 限时特价系列', rate: '0.6倍' },
  { priority: '优先级 2', name: '优质 banana，来源于 flow 和 adobe', rate: '1倍' },
  { priority: '优先级 3', name: '特价 banana，来源于 flow 和 adobe', rate: '1倍' },
  { priority: '优先级 4', name: 'default，支持所有模型，GPT / Claude / Azure / mj 等', rate: '1倍' },
  { priority: '优先级 5', name: '优质 gemini，官方 Gemini', rate: '2.4倍' },
];

export const SystemNoticeDialog: React.FC<SystemNoticeDialogProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SystemNoticeTab>('notice');
  const [copied, setCopied] = useState(false);

  const copyYunwuUrl = async () => {
    try {
      await navigator.clipboard.writeText(YUNWU_REGISTER_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[1.6rem] border border-white/70 bg-[#eef4fc]/95 shadow-2xl shadow-slate-900/25 backdrop-blur-xl dark:border-white/10 dark:bg-[#151821]/95">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-brand-orange/10 dark:from-white/5 dark:to-brand-orange/10" />

        <div className="relative flex items-start justify-between gap-4 px-6 py-5 md:px-8">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">系统通告</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">查看平台通知和功能使用说明。</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-xl border border-gray-200 bg-white/75 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
              <button
                onClick={() => setActiveTab('notice')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                  activeTab === 'notice'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-gray-500 hover:text-brand-orange dark:text-gray-400'
                }`}
              >
                <Bell className="h-4 w-4" />
                通知
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                  activeTab === 'guide'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-gray-500 hover:text-brand-orange dark:text-gray-400'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                使用说明
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 transition-all hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="关闭系统通告"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative max-h-[68vh] overflow-y-auto px-6 pb-8 md:px-8">
          {activeTab === 'notice' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-orange/30 bg-orange-50/90 px-5 py-4 text-center shadow-sm dark:bg-brand-orange/10">
                <div className="font-black text-brand-orange">XcAI Agent 电商视觉工作台</div>
                <p className="mt-2 text-sm font-medium leading-6 text-orange-700/85 dark:text-orange-100/85">
                  面向电商团队的 AI 视觉生产 Web，支持主图生成、模特工厂、局部替换、风格复刻、场景图生成和 AI 创意视频等工作流。
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
                  <Megaphone className="h-5 w-5 text-brand-orange" />
                  近期重要更新
                </div>
                <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                  {RECENT_UPDATES.map((update, index) => (
                    <div key={update} className="flex gap-3 rounded-xl bg-gray-50/80 px-4 py-3 dark:bg-white/5">
                      <span className="mt-0.5 text-brand-orange">{index === 0 ? 'NEW' : '-'}</span>
                      <span>{update}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
                <BookOpen className="h-5 w-5 text-brand-orange" />
                使用说明
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-black text-gray-900 dark:text-white">1. 云雾 API 使用说明</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                        进入云雾注册链接注册账号，充值算力费用，新建 Key 后按下方分组优先级分配，再将 API Key 填入设置里的云雾 API 即可使用。
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={copyYunwuUrl}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-all hover:border-brand-orange/40 hover:text-brand-orange dark:border-white/10 dark:bg-white/10 dark:text-gray-200"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? '已复制' : '复制链接'}
                      </button>
                      <a
                        href={YUNWU_REGISTER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange px-3 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-500"
                      >
                        打开链接
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  <a
                    href={YUNWU_REGISTER_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block break-all rounded-xl border border-brand-orange/20 bg-orange-50 px-3 py-2 text-sm font-semibold text-brand-orange transition-all hover:bg-orange-100 dark:bg-brand-orange/10 dark:hover:bg-brand-orange/15"
                  >
                    {YUNWU_REGISTER_URL}
                  </a>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Key 分组优先级</h3>
                    <span className="text-xs font-bold text-gray-400">按图示顺序配置</span>
                  </div>
                  <div className="space-y-2">
                    {YUNWU_GROUPS.map((group) => (
                      <div
                        key={group.priority}
                        className="grid grid-cols-[86px_1fr_64px] items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                      >
                        <span className="rounded-md bg-blue-100 px-2 py-1 text-center text-xs font-black text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                          {group.priority}
                        </span>
                        <span className="min-w-0 truncate font-semibold text-gray-600 dark:text-gray-300">{group.name}</span>
                        <span className="rounded-md bg-green-100 px-2 py-1 text-center text-xs font-black text-green-700 dark:bg-green-500/20 dark:text-green-200">
                          {group.rate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex justify-end gap-3 border-t border-white/60 px-6 py-4 dark:border-white/10 md:px-8">
          <button
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-orange shadow-sm transition-all hover:bg-orange-50 dark:bg-white/10 dark:hover:bg-white/15"
          >
            关闭公告
          </button>
        </div>
      </div>
    </div>
  );
};
