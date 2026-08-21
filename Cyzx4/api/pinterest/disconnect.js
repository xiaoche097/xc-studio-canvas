import {
  assertSameOrigin,
  clearSessionCookie,
  methodNotAllowed,
  sendApiError,
} from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    assertSameOrigin(req);
    res.setHeader('Set-Cookie', clearSessionCookie(req));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).end();
  } catch (error) {
    return sendApiError(res, error);
  }
}
