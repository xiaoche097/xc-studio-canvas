const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
const REQUEST_TIMEOUT_MS = 65000;

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const normalizeBody = (body) => {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
};

const cleanImageSource = (value) => {
  const image = String(value || '').trim();
  const match = image.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);
  return match ? match[1] : image;
};

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'xcai-imgbb-relay' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = normalizeBody(req.body);
  const key = String(body.key || '').trim();
  const image = cleanImageSource(body.image);
  const name = String(body.name || '').trim();
  const expiration = Number(body.expiration || 0);

  if (!key) return res.status(400).json({ error: 'ImgBB API key is required' });
  if (!image) return res.status(400).json({ error: 'Image data is required' });

  const params = new URLSearchParams({ key, image });
  if (name) params.set('name', name);
  if (Number.isInteger(expiration) && expiration >= 60 && expiration <= 15552000) {
    params.set('expiration', String(expiration));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });

    const raw = await upstream.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: { message: raw || `ImgBB returned HTTP ${upstream.status}` } };
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(upstream.status).json(payload);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'ImgBB request timed out' : (error instanceof Error ? error.message : 'ImgBB request failed'),
    });
  } finally {
    clearTimeout(timer);
  }
}
