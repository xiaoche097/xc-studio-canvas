import {
  beginRuntimeActivity,
  failRuntimeActivity,
  finishRuntimeActivity,
  updateRuntimeActivity,
} from '../runtime-status';

type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatuses?: number[];
};

type FetchResilienceOptions = RetryOptions & {
  timeoutMs?: number;
  idleTimeoutMs?: number;
  operation?: string;
};

const DEFAULT_RETRYABLE_STATUSES = [408, 409, 425, 429, 500, 502, 503, 504];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createTraceId = (): string => {
  const random = Math.random().toString(36).slice(2, 10);
  return `xc_${Date.now().toString(36)}_${random}`;
};

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('network') || message.includes('fetch') || message.includes('timeout');
};

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError';
};

const computeBackoff = (attempt: number, baseDelayMs: number, maxDelayMs: number): number => {
  const jitter = Math.floor(Math.random() * 250);
  const exponential = baseDelayMs * Math.pow(2, attempt);
  return Math.min(exponential + jitter, maxDelayMs);
};

export async function fetchWithResilience(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchResilienceOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 45000,
    idleTimeoutMs,
    retries = 2,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    retryOnStatuses = DEFAULT_RETRYABLE_STATUSES,
    operation = 'http.request',
  } = options;

  let lastError: unknown;
  const surfaceStatus = !/pricing|availablemodels|model-list|health|poll/i.test(operation);
  const runtimeId = surfaceStatus
    ? beginRuntimeActivity({
        kind: 'model',
        tone: 'working',
        title: '正在连接 AI 服务',
        detail: '请求已发送，正在等待上游响应…',
      })
    : null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    let abortSource: 'external' | 'total-timeout' | 'idle-timeout' | null = null;

    const abortWithSource = (source: 'external' | 'total-timeout' | 'idle-timeout') => {
      if (controller.signal.aborted) return;
      abortSource = source;
      controller.abort();
    };

    const onExternalAbort = () => abortWithSource('external');
    if (externalSignal) {
      if (externalSignal.aborted) {
        abortWithSource('external');
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const totalTimeoutId = timeoutMs > 0
      ? setTimeout(() => abortWithSource('total-timeout'), timeoutMs)
      : undefined;
    const idleTimeoutId = idleTimeoutMs && idleTimeoutMs > 0
      ? setTimeout(() => abortWithSource('idle-timeout'), idleTimeoutMs)
      : undefined;

    try {
      const headers = new Headers(init.headers || {});
      if (!headers.has('x-trace-id')) {
        headers.set('x-trace-id', createTraceId());
      }

      const response = await fetch(input, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (totalTimeoutId) clearTimeout(totalTimeoutId);
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (response.ok) {
        if (runtimeId) finishRuntimeActivity(runtimeId, { title: 'AI 服务已响应' });
        return response;
      }

      if (!retryOnStatuses.includes(response.status) || attempt === retries) {
        if (runtimeId) failRuntimeActivity(runtimeId, new Error(`HTTP ${response.status}`), {
          kind: 'model',
          status: response.status,
        });
        return response;
      }

      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
      if (runtimeId) {
        updateRuntimeActivity(runtimeId, {
          tone: 'retrying',
          title: response.status === 429 ? '请求受限，正在自动重试' : '上游繁忙，正在自动重试',
          detail: `服务返回 ${response.status}，${Math.ceil(delay / 1000)} 秒后再次尝试。`,
          attempt: attempt + 2,
          maxAttempts: retries + 1,
        });
      }
      console.warn(`[${operation}] retrying status=${response.status}, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
      await sleep(delay);
    } catch (error) {
      if (totalTimeoutId) clearTimeout(totalTimeoutId);
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
      lastError = error;

      if (isAbortError(error)) {
        if (abortSource === 'external') {
          if (runtimeId) finishRuntimeActivity(runtimeId, {
            tone: 'warning',
            title: '任务已取消',
            detail: '请求已由用户停止。',
          });
          throw error;
        }

        if (abortSource === 'idle-timeout' || abortSource === 'total-timeout') {
          if (attempt === retries) {
            const timeoutError = new Error(`[${operation}] request timeout after ${abortSource === 'idle-timeout' ? `idle ${idleTimeoutMs}ms` : `${timeoutMs}ms`}`);
            if (runtimeId) failRuntimeActivity(runtimeId, timeoutError, { kind: 'model' });
            throw timeoutError;
          }

          const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
          if (runtimeId) {
            updateRuntimeActivity(runtimeId, {
              tone: 'retrying',
              title: '响应超时，正在自动重试',
              detail: `第 ${attempt + 1} 次连接未响应，即将重新连接。`,
              attempt: attempt + 2,
              maxAttempts: retries + 1,
            });
          }
          console.warn(`[${operation}] retrying ${abortSource}, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
          await sleep(delay);
          continue;
        }
      }

      if (!isRetryableError(error) || attempt === retries) {
        if (runtimeId) failRuntimeActivity(runtimeId, error, { kind: 'model' });
        throw error;
      }

      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
      if (runtimeId) {
        updateRuntimeActivity(runtimeId, {
          tone: 'retrying',
          title: '网络波动，正在自动重试',
          detail: `连接失败，${Math.ceil(delay / 1000)} 秒后再次尝试。`,
          attempt: attempt + 2,
          maxAttempts: retries + 1,
        });
      }
      console.warn(`[${operation}] retrying network error, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
      await sleep(delay);
    }
  }

  const finalError = lastError instanceof Error ? lastError : new Error('Request failed after retries');
  if (runtimeId) failRuntimeActivity(runtimeId, finalError, { kind: 'model' });
  throw finalError;
}
