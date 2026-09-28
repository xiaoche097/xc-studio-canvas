import crypto from 'node:crypto';
import {
  clearStateCookie,
  createSessionCookie,
  enforceRateLimit,
  exchangeAuthorizationCode,
  getOAuthState,
  getRequestOrigin,
  methodNotAllowed,
  pinterestFetch,
  tokenPayloadToSession,
} from './_shared.js';

function single(value) {
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function callbackHtml({ ok, message, origin }) {
  const payload = JSON.stringify({ type: 'xc:pinterest-oauth', ok, message }).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(origin).replace(/</g, '\\u003c');
  const fallback = ok ? '/?pinterest=connected#/' : '/?pinterest=error#/';
  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pinterest 授权</title></head>
  <body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fff7f7;color:#241b1c">
    <main style="text-align:center;padding:32px"><div style="width:52px;height:52px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;background:#e60023;color:white;font:700 28px Georgia">P</div><p>${ok ? 'Pinterest 已连接，可以关闭此窗口。' : 'Pinterest 连接失败，请返回重试。'}</p></main>
    <script>const payload=${payload};const target=${safeOrigin};if(window.opener&&!window.opener.closed){window.opener.postMessage(payload,target);window.close()}else{window.location.replace(${JSON.stringify(fallback)})}</script>
  </body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const origin = getRequestOrigin(req);
  try {
    enforceRateLimit(req, res, 'oauth-callback', 30, 15 * 60_000);
    const error = single(req.query.error);
    const errorDescription = single(req.query.error_description);
    if (error) throw new Error(errorDescription || error);

    const code = single(req.query.code);
    const incomingState = single(req.query.state);
    const savedState = getOAuthState(req);
    if (!code) throw new Error('Pinterest 未返回授权码。');
    if (!safeEqual(incomingState, savedState)) throw new Error('OAuth state 校验失败，请重新连接。');

    const token = await exchangeAuthorizationCode(code);
    const profile = await pinterestFetch('/user_account', token.access_token);
    const session = tokenPayloadToSession(token, profile);
    const sessionCookie = createSessionCookie(req, session);
    clearStateCookie(req, res, [sessionCookie]);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    return res.status(200).send(callbackHtml({ ok: true, message: '', origin }));
  } catch (error) {
    clearStateCookie(req, res);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    return res.status(400).send(callbackHtml({
      ok: false,
      message: error instanceof Error ? error.message : 'Pinterest 授权失败。',
      origin,
    }));
  }
}
