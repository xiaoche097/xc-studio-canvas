import { enforceRateLimit, getPinterestConfig, methodNotAllowed, readSession, requireSession, sendApiError } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  res.setHeader('Cache-Control', 'no-store');

  try {
    enforceRateLimit(req, res, 'session');
    getPinterestConfig();
  } catch (error) {
    return sendApiError(res, error);
  }

  if (!readSession(req)) {
    return res.status(200).json({ connected: false, configured: true });
  }

  try {
    const session = await requireSession(req, res);
    return res.status(200).json({
      connected: true,
      configured: true,
      profile: session.profile,
      scope: session.scope,
      connectedAt: session.connectedAt,
    });
  } catch (error) {
    if (error?.status === 503) return sendApiError(res, error);
    return res.status(200).json({ connected: false, configured: true, reason: error?.code || 'SESSION_INVALID' });
  }
}
