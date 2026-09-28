export const isRateLimitError = (error: { status?: number; message?: string }): boolean => (
  error.status === 429
  || /\b429\b|\brate[\s_-]*limit(?:ed|ing|s)?(?=\b|_)|\btoo[\s_]+many[\s_]+requests\b|请求过快|请求频繁|限流/i.test(error.message || '')
);
