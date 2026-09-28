import React, { useMemo, useSyncExternalStore } from 'react';
import { AlertTriangle, Check, CircleX, CloudUpload, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  dismissRuntimeStatus,
  runtimeStatusStore,
  type RuntimeActivity,
  type RuntimeStatusTone,
} from '../services/runtime-status';

const tonePriority: Record<RuntimeStatusTone, number> = {
  error: 5,
  warning: 4,
  retrying: 3,
  working: 2,
  success: 1,
};

const toneClasses: Record<RuntimeStatusTone | 'idle', string> = {
  idle: 'border-slate-200 bg-slate-50/80 text-slate-700',
  working: 'border-blue-200 bg-blue-50/90 text-blue-800',
  retrying: 'border-orange-200 bg-orange-50/95 text-orange-800',
  success: 'border-emerald-200 bg-emerald-50/90 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50/95 text-amber-900',
  error: 'border-red-200 bg-red-50/95 text-red-800',
};

const StatusIcon: React.FC<{ activity: RuntimeActivity | null }> = ({ activity }) => {
  const className = 'h-4 w-4';
  if (!activity) return <Sparkles className={className} />;
  if (activity.tone === 'working') {
    return activity.kind === 'upload'
      ? <CloudUpload className={`${className} animate-pulse`} />
      : <LoaderCircle className={`${className} animate-spin`} />;
  }
  if (activity.tone === 'retrying') return <RefreshCw className={`${className} animate-spin`} />;
  if (activity.tone === 'success') return <Check className={className} />;
  if (activity.tone === 'warning') return <AlertTriangle className={className} />;
  return <CircleX className={className} />;
};

export const RuntimeStatusBar: React.FC = () => {
  const state = useSyncExternalStore(
    runtimeStatusStore.subscribe,
    runtimeStatusStore.getSnapshot,
    runtimeStatusStore.getSnapshot,
  );
  const activity = useMemo(() => {
    return [...state.activities, ...(state.recent ? [state.recent] : [])].sort((a, b) => (
      tonePriority[b.tone] - tonePriority[a.tone] || b.updatedAt - a.updatedAt
    ))[0];
  }, [state]);
  const tone = activity?.tone || 'idle';
  const canDismiss = Boolean(activity && (tone === 'error' || tone === 'warning'));
  const attemptText = activity?.attempt && activity.maxAttempts
    ? `${activity.attempt}/${activity.maxAttempts}`
    : '';

  return (
    <div
      className={`flex min-w-0 max-w-[30rem] items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors sm:px-3 ${toneClasses[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      title={activity?.detail || '文本模型、图像服务与上传链路均可用'}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/75 shadow-sm">
        <StatusIcon activity={activity || null} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[0.72rem] font-black">
          {activity?.title || '服务就绪'}
        </span>
        <span className="hidden truncate text-[0.64rem] font-semibold opacity-70 md:block">
          {activity?.detail || 'Agent、图片生成与上传状态正常'}
        </span>
      </span>
      {attemptText && (
        <span className="shrink-0 rounded-md bg-white/75 px-1.5 py-1 text-[0.62rem] font-black tabular-nums">
          {attemptText}
        </span>
      )}
      {canDismiss && (
        <button
          type="button"
          onClick={dismissRuntimeStatus}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="关闭状态提醒"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default RuntimeStatusBar;
