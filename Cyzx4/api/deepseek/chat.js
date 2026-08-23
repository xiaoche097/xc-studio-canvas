const normalizeBaseUrl = (value) => String(value || 'https://api.deepseek.com')
  .trim()
  .replace(/\/+$/, '');

const resolveEndpoint = (value) => {
  const baseUrl = normalizeBaseUrl(value);
  const parsed = new URL(baseUrl);
  const hostname = parsed.hostname.toLowerCase();
  const extraAllowedHosts = String(process.env.DEEPSEEK_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const allowedHosts = new Set(['api.deepseek.com', ...extraAllowedHosts]);
  const privateHost = hostname === 'localhost'
    || hostname.endsWith('.local')
    || hostname === '::1'
    || /^127\./.test(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  if (
    parsed.username
    || parsed.password
    || parsed.protocol !== 'https:'
    || privateHost
    || !allowedHosts.has(hostname)
  ) {
    throw new Error('DeepSeek Base URL is not allowed by this deployment.');
  }
  return `${baseUrl}/chat/completions`;
};

const readBody = (req) => {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body || {};
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Method not allowed.' } });
  }

  let payload;
  let endpoint;
  try {
    payload = readBody(req);
    endpoint = resolveEndpoint(payload.baseUrl);
  } catch (error) {
    return res.status(400).json({
      error: { message: error instanceof Error ? error.message : 'Invalid request.' },
    });
  }

  const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
  const request = payload.request;
  if (!apiKey || !request || typeof request !== 'object' || Array.isArray(request)) {
    return res.status(400).json({ error: { message: 'API Key and request body are required.' } });
  }

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: request.stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(request),
      signal: req.signal,
    });
  } catch (error) {
    return res.status(502).json({
      error: { message: error instanceof Error ? error.message : 'Unable to reach DeepSeek API.' },
    });
  }

  res.statusCode = upstream.status;
  res.setHeader('Cache-Control', 'no-store');
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
  if (!upstream.body) return res.end();

  if (request.stream && upstream.ok) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    return res.end();
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  return res.end(body);
}

export const config = { maxDuration: 300 };
