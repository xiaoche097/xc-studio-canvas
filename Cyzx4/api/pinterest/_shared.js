import crypto from 'node:crypto';

const API_BASE = process.env.PINTEREST_USE_SANDBOX === 'true'
  ? 'https://api-sandbox.pinterest.com/v5'
  : 'https://api.pinterest.com/v5';

const SESSION_COOKIE = 'xc_pinterest_session';
const STATE_COOKIE = 'xc_pinterest_oauth_state';
const ACCESS_TOKEN_SKEW_MS = 5 * 60 * 1000;
const rateLimitBuckets = new Map();

export class PinterestApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'PinterestApiError';
    this.status = status;
    this.code = code;
  }
}

export function getPinterestConfig() {
  const clientId = process.env.PINTEREST_CLIENT_ID?.trim();
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET?.trim();
  const redirectUri = process.env.PINTEREST_REDIRECT_URI?.trim();
  const sessionSecret = process.env.PINTEREST_SESSION_SECRET?.trim();

  if (!clientId || !clientSecret || !redirectUri || !sessionSecret) {
    throw new PinterestApiError(
      503,
      'Pinterest 尚未配置完成，请设置 PINTEREST_CLIENT_ID、PINTEREST_CLIENT_SECRET、PINTEREST_REDIRECT_URI 和 PINTEREST_SESSION_SECRET。',
      'PINTEREST_NOT_CONFIGURED',
    );
  }

  if (sessionSecret.length < 32) {
    throw new PinterestApiError(503, 'PINTEREST_SESSION_SECRET 必须至少为 32 个字符。', 'INVALID_SESSION_SECRET');
  }

  return { clientId, clientSecret, redirectUri, sessionSecret };
}

export function getRequestOrigin(req) {
  const forwardedProto = firstHeader(req.headers['x-forwarded-proto']);
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = firstHeader(req.headers['x-forwarded-host']) || firstHeader(req.headers.host);
  return host ? `${protocol}://${host}` : '';
}

export function assertSameOrigin(req) {
  const origin = firstHeader(req.headers.origin);
  const requestOrigin = getRequestOrigin(req);
  if (origin && requestOrigin && origin !== requestOrigin) {
    throw new PinterestApiError(403, '请求来源校验失败。', 'INVALID_ORIGIN');
  }
}

export function randomState() {
  return crypto.randomBytes(32).toString('base64url');
}

export function enforceRateLimit(req, res, scope, limit = 120, windowMs = 60_000) {
  const forwardedFor = firstHeader(req.headers['x-forwarded-for']) || '';
  const ip = forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const key = `${scope}:${ip}`;
  const now = Date.now();
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (rateLimitBuckets.size > 10_000) {
    for (const [bucketKey, value] of rateLimitBuckets) {
      if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  if (bucket.count > limit) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    throw new PinterestApiError(429, '请求过于频繁，请稍后重试。', 'RATE_LIMITED');
  }
}

export function readCookie(req, name) {
  const raw = firstHeader(req.headers.cookie) || '';
  for (const item of raw.split(';')) {
    const separator = item.indexOf('=');
    if (separator === -1) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return null;
}

function isSecureRequest(req) {
  return firstHeader(req.headers['x-forwarded-proto']) === 'https' || process.env.NODE_ENV === 'production';
}

function cookie(name, value, req, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join('; ');
}

export function setStateCookie(req, res, value) {
  res.setHeader('Set-Cookie', cookie(STATE_COOKIE, value, req, { maxAge: 10 * 60 }));
}

export function clearStateCookie(req, res, additionalCookies = []) {
  res.setHeader('Set-Cookie', [
    ...additionalCookies,
    cookie(STATE_COOKIE, '', req, { maxAge: 0 }),
  ]);
}

export function getOAuthState(req) {
  return readCookie(req, STATE_COOKIE);
}

function encryptionKey() {
  const { sessionSecret } = getPinterestConfig();
  return crypto.createHash('sha256').update(sessionSecret, 'utf8').digest();
}

function encryptSession(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptSession(value) {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plain);
  } catch {
    return null;
  }
}

export function createSessionCookie(req, session) {
  const maxAge = Math.max(60, Math.floor(((session.refreshTokenExpiresAt || Date.now() + 30 * 86400_000) - Date.now()) / 1000));
  return cookie(SESSION_COOKIE, encryptSession(session), req, { maxAge });
}

export function clearSessionCookie(req) {
  return cookie(SESSION_COOKIE, '', req, { maxAge: 0 });
}

export function readSession(req) {
  const value = readCookie(req, SESSION_COOKIE);
  return value ? decryptSession(value) : null;
}

function tokenAuthHeader(clientId, clientSecret) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

async function parsePinterestResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : `Pinterest API 请求失败 (${response.status})`;
    throw new PinterestApiError(response.status, message, payload?.code);
  }
  return payload;
}

export async function exchangeAuthorizationCode(code) {
  const { clientId, clientSecret, redirectUri } = getPinterestConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    continuous_refresh: 'true',
  });

  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: tokenAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  return parsePinterestResponse(response);
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getPinterestConfig();
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: tokenAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  return parsePinterestResponse(response);
}

export function tokenPayloadToSession(token, profile) {
  const now = Date.now();
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    scope: token.scope || '',
    accessTokenExpiresAt: now + Number(token.expires_in || 0) * 1000,
    refreshTokenExpiresAt: token.refresh_token_expires_at
      ? Number(token.refresh_token_expires_at) * 1000
      : now + Number(token.refresh_token_expires_in || 60 * 86400) * 1000,
    connectedAt: now,
    profile,
  };
}

export async function requireSession(req, res) {
  let session = readSession(req);
  if (!session?.accessToken) {
    throw new PinterestApiError(401, '尚未连接 Pinterest。', 'PINTEREST_NOT_CONNECTED');
  }

  if (session.accessTokenExpiresAt - Date.now() <= ACCESS_TOKEN_SKEW_MS) {
    if (!session.refreshToken || session.refreshTokenExpiresAt <= Date.now()) {
      throw new PinterestApiError(401, 'Pinterest 授权已过期，请重新连接。', 'PINTEREST_SESSION_EXPIRED');
    }
    const refreshed = await refreshAccessToken(session.refreshToken);
    session = tokenPayloadToSession(refreshed, session.profile);
    res.setHeader('Set-Cookie', createSessionCookie(req, session));
  }

  return session;
}

export async function pinterestFetch(path, accessToken) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return parsePinterestResponse(response);
}

export function sendApiError(res, error) {
  const status = error instanceof PinterestApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Pinterest 服务暂时不可用。';
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({
    error: message,
    code: error instanceof PinterestApiError ? error.code : 'PINTEREST_INTERNAL_ERROR',
  });
}

export function methodNotAllowed(res, methods) {
  res.setHeader('Allow', methods.join(', '));
  return res.status(405).json({ error: 'Method not allowed' });
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

export const pinterestCookies = { SESSION_COOKIE, STATE_COOKIE };

// Vercel treats JavaScript files under /api as functions. Keep this helper
// non-actionable if it is requested directly while still providing a valid handler.
export default function sharedHelperRoute(_req, res) {
  return res.status(404).json({ error: 'Not found' });
}
