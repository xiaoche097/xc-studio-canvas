import React from 'react';
import {
  Wand2,
  Folder,
  Flame,
  Clock,
  ListTodo,
  Headphones,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';

export type SidebarItem =
  | 'creation'
  | 'assets'
  | 'trending'
  | 'recent'
  | 'tasks'
  | 'support'
  | 'tutorials';

interface GlobalSidebarProps {
  activeSidebarItem: SidebarItem | string;
  onSelectSidebarItem: (item: SidebarItem) => void;
  onBack: () => void;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  activeSidebarItem,
  onSelectSidebarItem,
  onBack,
}) => {
  return (
    <aside className="hidden w-56 sm:w-60 flex-col border-r border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-[#111622] md:flex shrink-0 h-full font-sans select-none">
      {/* 1. 顶部 Logo 标题区 (点击触发 onBack 返回首页，悬停过渡显示“返回首页”) */}
      <button
        type="button"
        onClick={onBack}
        className="group/home flex w-full items-center gap-3 rounded-2xl p-2 mb-2 border-b border-slate-100 dark:border-white/5 text-left transition-all duration-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/90 active:scale-[0.98]"
        title="点击返回首页"
      >
        {/* 左侧 Icon 区域 */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-black text-xs shadow-xs transition-all duration-300 group-hover/home:from-orange-500 group-hover/home:to-amber-500">
          <span className="transition-all duration-300 group-hover/home:opacity-0 group-hover/home:scale-50 absolute">
            AI
          </span>
          <ArrowLeft className="h-4 w-4 transition-all duration-300 opacity-0 scale-50 group-hover/home:opacity-100 group-hover/home:scale-100 absolute text-white" />
        </div>

        {/* 右侧文本区域 */}
        <div className="relative min-w-0 flex-1 h-8 overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-center transition-all duration-300 ease-out group-hover/home:-translate-y-full group-hover/home:opacity-0">
            <h2 className="truncate text-sm font-black tracking-tight text-slate-900 dark:text-white">
              AI 视觉工作工坊
            </h2>
            <p className="truncate text-[0.68rem] text-slate-400 font-bold">
              C端商业生成面板
            </p>
          </div>

          <div className="absolute inset-0 flex flex-col justify-center translate-y-full opacity-0 transition-all duration-300 ease-out group-hover/home:translate-y-0 group-hover/home:opacity-100">
            <h2 className="truncate text-sm font-black tracking-tight text-orange-600 dark:text-orange-400 flex items-center gap-1">
              返回首页
            </h2>
            <p className="truncate text-[0.68rem] text-slate-400 font-bold">
              点击离开主控制台
            </p>
          </div>
        </div>
      </button>

      {/* 2. 侧边栏菜单列 (完全还原图 2 样式) */}
      <nav className="space-y-1.5 flex-1">
        {/* 创作 (点击直接一键切回功能列表) */}
        <button
          type="button"
          onClick={() => onSelectSidebarItem('creation')}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
            activeSidebarItem === 'creation'
              ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50'
          }`}
        >
          <Wand2 className="h-[1.125rem] w-[1.125rem] text-orange-500" />
          <span>创作</span>
        </button>

        {/* 资产 */}
        <button
          type="button"
          onClick={() => onSelectSidebarItem('assets')}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
            activeSidebarItem === 'assets'
              ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50'
          }`}
        >
          <Folder className="h-[1.125rem] w-[1.125rem] text-blue-500" />
          <span>资产</span>
        </button>

        {/* 爆款 */}
        <button
          type="button"
          onClick={() => onSelectSidebarItem('trending')}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
            activeSidebarItem === 'trending'
              ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50'
          }`}
        >
          <Flame className="h-[1.125rem] w-[1.125rem] text-red-500" />
          <span>爆款</span>
        </button>

        <div className="pt-4 pb-1">
          <span className="px-3.5 text-xs font-bold text-slate-400 tracking-wider">常用与历史</span>
        </div>

        {/* 最近使用 */}
        <button
          type="button"
          onClick={() => onSelectSidebarItem('recent')}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
            activeSidebarItem === 'recent'
              ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50'
          }`}
        >
          <Clock className="h-[1.125rem] w-[1.125rem] text-slate-400" />
          <span>最近使用</span>
        </button>

        {/* 任务中心 */}
        <button
          type="button"
          onClick={() => onSelectSidebarItem('tasks')}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
            activeSidebarItem === 'tasks'
              ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50'
          }`}
        >
          <ListTodo className="h-[1.125rem] w-[1.125rem] text-slate-400" />
          <span>任务中心</span>
        </button>

        <div className="pt-4 pb-1">
          <span className="px-3.5 text-xs font-bold text-slate-400 tracking-wider">支持与服务</span>
        </div>

        {/* 联系客服 */}
        <button
          type="button"
          onClick={() => onSelectSidebarItem('support')}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 transition"
        >
          <Headphones className="h-[1.125rem] w-[1.125rem] text-slate-400" />
          <span>联系客服</span>
        </button>

        {/* 使用教程 */}
        <button
          type="button"
          onClick={() => onSelectSidebarItem('tutorials')}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 transition"
        >
          <BookOpen className="h-[1.125rem] w-[1.125rem] text-slate-400" />
          <span>使用教程</span>
        </button>
      </nav>

      {/* 3. 底部用户极简信息区 (完全还原图 2 底部) */}
      <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-2.5 dark:border-white/5 dark:bg-slate-800/50 mt-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[0.68rem] font-bold text-white dark:bg-white dark:text-slate-900">
            XC
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">商业用户</p>
            <p className="truncate text-[0.62rem] text-slate-400 font-medium">无限生成模式</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default GlobalSidebar;
