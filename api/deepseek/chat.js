const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

const readBody = (req) => {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body || {};
};

const sendUpstreamBody = async (upstream, res) => {
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  const body = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(upstream.status).send(body);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' },
    });
  }

  const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      error: {
        code: 'DEEPSEEK_SERVER_NOT_CONFIGURED',
        message: 'Server environment variable DEEPSEEK_API_KEY is missing.',
      },
    });
  }

  let payload;
  try {
    payload = readBody(req);
  } catch {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
    });
  }

  const request = payload.request;
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'request object is required.' },
    });
  }

  const upstreamRequest = {
    ...request,
    max_tokens: Math.min(Math.max(Number(request.max_tokens || 32_768), 1), 262_144),
  };

  let upstream;
  try {
    upstream = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: upstreamRequest.stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(upstreamRequest),
      signal: req.signal,
    });
  } catch (error) {
    return res.status(502).json({
      error: {
        code: 'DEEPSEEK_UPSTREAM_UNREACHABLE',
        message: error instanceof Error ? error.message : 'Unable to reach DeepSeek API.',
      },
    });
  }

  if (upstream.status === 401) {
    return res.status(502).json({
      error: {
        code: 'DEEPSEEK_AUTH_FAILED',
        message: 'The server-side DeepSeek credential was rejected. Check DEEPSEEK_API_KEY.',
      },
    });
  }

  res.statusCode = upstream.status;
  res.setHeader('Cache-Control', 'no-store');

  if (upstreamRequest.stream && upstream.ok && upstream.body) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    return res.end();
  }

  return sendUpstreamBody(upstream, res);
}

export const config = { maxDuration: 300 };
