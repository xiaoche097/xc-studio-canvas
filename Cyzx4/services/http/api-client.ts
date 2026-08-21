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

      if (response.ok || !retryOnStatuses.includes(response.status) || attempt === retries) {
        return response;
      }

      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
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
          throw error;
        }

        if (abortSource === 'idle-timeout' || abortSource === 'total-timeout') {
          if (attempt === retries) {
            throw new Error(`[${operation}] request timeout after ${abortSource === 'idle-timeout' ? `idle ${idleTimeoutMs}ms` : `${timeoutMs}ms`}`);
          }

          const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
          console.warn(`[${operation}] retrying ${abortSource}, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
          await sleep(delay);
          continue;
        }
      }

      if (!isRetryableError(error) || attempt === retries) {
        throw error;
      }

      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
      console.warn(`[${operation}] retrying network error, attempt=${attempt + 1}/${retries + 1}, wait=${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
}
