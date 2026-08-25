export type RuntimeStatusTone = 'working' | 'retrying' | 'success' | 'warning' | 'error';
export type RuntimeStatusKind = 'agent' | 'upload' | 'model' | 'network';

export interface RuntimeActivity {
  id: string;
  kind: RuntimeStatusKind;
  tone: RuntimeStatusTone;
  title: string;
  detail?: string;
  attempt?: number;
  maxAttempts?: number;
  startedAt: number;
  updatedAt: number;
}

interface RuntimeStatusSnapshot {
  activities: RuntimeActivity[];
  recent: RuntimeActivity | null;
  revision: number;
}

type RuntimeActivityInput = Pick<RuntimeActivity, 'kind' | 'tone' | 'title'>
  & Partial<Pick<RuntimeActivity, 'detail' | 'attempt' | 'maxAttempts'>>;

const listeners = new Set<() => void>();
let sequence = 0;
let snapshot: RuntimeStatusSnapshot = { activities: [], recent: null, revision: 0 };
let recentTimer: ReturnType<typeof setTimeout> | undefined;

const emit = () => {
  snapshot = { ...snapshot, revision: snapshot.revision + 1 };
  listeners.forEach((listener) => listener());
};

const scheduleRecentClear = (tone: RuntimeStatusTone) => {
  if (recentTimer) clearTimeout(recentTimer);
  if (tone === 'error' || tone === 'warning') return;
  recentTimer = setTimeout(() => {
    snapshot = { ...snapshot, recent: null };
    emit();
  }, tone === 'success' ? 2400 : 5000);
};

export const runtimeStatusStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
};

export const beginRuntimeActivity = (input: RuntimeActivityInput): string => {
  const now = Date.now();
  const id = `runtime-${now.toString(36)}-${(sequence += 1).toString(36)}`;
  snapshot = {
    ...snapshot,
    activities: [...snapshot.activities, { ...input, id, startedAt: now, updatedAt: now }],
    recent: null,
  };
  emit();
  return id;
};

export const updateRuntimeActivity = (
  id: string,
  patch: Partial<Omit<RuntimeActivity, 'id' | 'startedAt'>>,
) => {
  snapshot = {
    ...snapshot,
    activities: snapshot.activities.map((activity) => (
      activity.id === id ? { ...activity, ...patch, updatedAt: Date.now() } : activity
    )),
  };
  emit();
};

export const finishRuntimeActivity = (
  id: string,
  result?: Partial<Pick<RuntimeActivity, 'tone' | 'title' | 'detail'>>,
) => {
  const activity = snapshot.activities.find((item) => item.id === id);
  if (!activity) return;
  const completed: RuntimeActivity = {
    ...activity,
    tone: result?.tone || 'success',
    title: result?.title || '处理完成',
    detail: result?.detail,
    updatedAt: Date.now(),
  };
  const preserveVisibleIssue = completed.tone === 'success'
    && (snapshot.recent?.tone === 'error' || snapshot.recent?.tone === 'warning');
  snapshot = {
    ...snapshot,
    activities: snapshot.activities.filter((item) => item.id !== id),
    recent: preserveVisibleIssue ? snapshot.recent : completed,
  };
  emit();
  if (!preserveVisibleIssue) scheduleRecentClear(completed.tone);
};

export const failRuntimeActivity = (
  id: string,
  error: unknown,
  context?: { kind?: RuntimeStatusKind; status?: number; title?: string },
) => {
  const activity = snapshot.activities.find((item) => item.id === id);
  if (!activity) return;
  const friendly = describeRuntimeError(error, context?.status, context?.kind || activity.kind);
  finishRuntimeActivity(id, {
    tone: 'error',
    title: context?.title || friendly.title,
    detail: friendly.detail,
  });
};

export const dismissRuntimeStatus = () => {
  if (recentTimer) clearTimeout(recentTimer);
  snapshot = { ...snapshot, recent: null };
  emit();
};

export const describeRuntimeError = (
  error: unknown,
  status?: number,
  kind: RuntimeStatusKind = 'network',
): { title: string; detail: string; retryable: boolean } => {
  const raw = error instanceof Error ? error.message : String(error || '');
  const message = raw.toLowerCase();
  const resolvedStatus = status || Number(message.match(/\b(4\d\d|5\d\d)\b/)?.[1] || 0);

  if (resolvedStatus === 429 || /rate limit|too many requests|限流/.test(message)) {
    return { title: '请求频率过高', detail: '中转节点正在限流，请稍等片刻后重试。', retryable: true };
  }
  if ([502, 503, 504].includes(resolvedStatus) || /overload|unavailable|no healthy upstream|bad gateway|上游过载/.test(message)) {
    return { title: '上游服务过载', detail: '当前模型节点暂时不可用，请稍后重试或切换中转节点。', retryable: true };
  }
  if (/timeout|timed out|超时/.test(message)) {
    return { title: kind === 'upload' ? '图片上传超时' : '服务响应超时', detail: '长时间未收到上游响应，任务已停止等待，可直接重试。', retryable: true };
  }
  if (resolvedStatus === 401 || resolvedStatus === 403 || /unauthorized|forbidden|api key/.test(message)) {
    return { title: '服务鉴权失败', detail: '请检查当前中转地址、API Key 与模型权限。', retryable: false };
  }
  if (kind === 'upload') {
    return { title: '图片上传失败', detail: raw || '请检查图片格式、网络连接或图床配置后重试。', retryable: true };
  }
  return { title: kind === 'agent' ? 'Agent 执行失败' : '服务请求失败', detail: raw || '请检查网络或服务配置后重试。', retryable: true };
};
