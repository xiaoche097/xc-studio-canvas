import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Flame,
  Folder,
  Headphones,
  Home,
  Layers3,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  WandSparkles,
} from 'lucide-react';

export type SidebarItem =
  | 'home'
  | 'creation'
  | 'canvas'
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
  collapseRequest?: number;
}

const primaryItems = [
  { id: 'home' as const, label: '首页', icon: Home, color: 'text-indigo-500' },
  { id: 'creation' as const, label: '创作', icon: WandSparkles, color: 'text-orange-500' },
  { id: 'canvas' as const, label: '画布', icon: Layers3, color: 'text-cyan-500' },
  { id: 'assets' as const, label: '资产', icon: Folder, color: 'text-blue-500' },
  { id: 'trending' as const, label: '爆款', icon: Flame, color: 'text-rose-500' },
];

const utilityGroups = [
  {
    label: '常用与历史',
    items: [
      { id: 'recent' as const, label: '最近使用', icon: Clock3 },
      { id: 'tasks' as const, label: '任务中心', icon: ListTodo },
    ],
  },
  {
    label: '支持与服务',
    items: [
      { id: 'support' as const, label: '联系客服', icon: Headphones },
      { id: 'tutorials' as const, label: '使用教程', icon: BookOpen },
    ],
  },
];

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  activeSidebarItem,
  onSelectSidebarItem,
  onBack,
  collapseRequest = 0,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (collapseRequest <= 0) return;
    setCollapsed(true);
  }, [collapseRequest]);

  const toggleCollapsed = () => {
    setCollapsed((current) => !current);
  };

  const navButton = (
    item: { id: SidebarItem; label: string; icon: React.ComponentType<{ className?: string }> },
    color = 'text-slate-400',
  ) => {
    const Icon = item.icon;
    const active = activeSidebarItem === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectSidebarItem(item.id)}
        title={collapsed ? item.label : undefined}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex min-h-11 w-full cursor-pointer items-center rounded-xl text-sm font-bold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:focus-visible:ring-white ${
          collapsed ? 'justify-center px-0' : 'gap-3 px-3'
        } ${
          active
            ? 'bg-slate-950 text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] dark:bg-white dark:text-slate-950'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
        }`}
      >
        <span className={`absolute left-0 h-5 w-0.5 rounded-r-full ${active ? 'bg-orange-500' : 'bg-transparent'}`} />
        <Icon className={`h-[1.125rem] w-[1.125rem] shrink-0 ${active ? 'text-white dark:text-slate-950' : color}`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <aside
      className={`relative hidden h-full shrink-0 select-none flex-col border-r border-slate-200/80 bg-white transition-[width,padding] duration-300 motion-reduce:transition-none dark:border-white/10 dark:bg-[#111622] md:flex ${
        collapsed ? 'w-[4.5rem] px-3 py-4' : 'w-60 p-4'
      }`}
      aria-label="主导航"
    >
      <div className={`flex min-h-11 items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <button
          type="button"
          onClick={onBack}
          title="返回工作室"
          aria-label="返回工作室"
          className="group grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[0.9rem] bg-slate-950 text-white outline-none transition-colors hover:bg-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        >
          <span className="text-xs font-black group-hover:hidden">AI</span>
          <ArrowLeft className="hidden h-4 w-4 group-hover:block" />
        </button>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-black tracking-[-0.02em] text-slate-950 dark:text-white">AI 视觉工作坊</h1>
            <p className="truncate text-[0.65rem] font-semibold text-slate-400">商业创意工作台</p>
          </div>
        )}

        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="收起主导航"
            aria-expanded={!collapsed}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mt-3 grid h-11 w-full cursor-pointer place-items-center rounded-xl border border-slate-200 text-slate-400 outline-none transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950 dark:border-white/10 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="展开主导航"
          aria-expanded={!collapsed}
          title="展开导航"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <div className="my-4 h-px bg-slate-200/80 dark:bg-white/10" />

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden" aria-label="工作区导航">
        {primaryItems.map((item) => navButton(item, item.color))}

        {utilityGroups.map((group) => (
          <div key={group.label} className={collapsed ? 'pt-3' : 'pt-5'}>
            {!collapsed && <p className="mb-1.5 px-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-400">{group.label}</p>}
            {collapsed && <div className="mx-auto mb-2 h-px w-5 bg-slate-200 dark:bg-white/10" />}
            <div className="space-y-1">{group.items.map((item) => navButton(item))}</div>
          </div>
        ))}
      </nav>

      <div className={`mt-4 border-t border-slate-200/80 pt-4 dark:border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex min-h-11 items-center rounded-xl bg-slate-50 dark:bg-white/5 ${collapsed ? 'h-11 w-11 justify-center' : 'gap-2.5 px-2.5'}`} title={collapsed ? '商业用户 · 无限生成模式' : undefined}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-[0.65rem] font-black text-white dark:bg-white dark:text-slate-950">XC</div>
          {!collapsed && <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-950 dark:text-white">商业用户</p><p className="truncate text-[0.65rem] font-medium text-slate-400">无限生成模式</p></div>}
        </div>
      </div>
    </aside>
  );
};

export default GlobalSidebar;
