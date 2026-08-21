import {
  getPinterestConfig,
  enforceRateLimit,
  methodNotAllowed,
  randomState,
  sendApiError,
  setStateCookie,
} from './_shared.js';

const SCOPES = [
  'user_accounts:read',
  'boards:read',
  'pins:read',
  'boards:read_secret',
  'pins:read_secret',
];

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    enforceRateLimit(req, res, 'oauth-connect', 20, 15 * 60_000);
    const { clientId, redirectUri } = getPinterestConfig();
    const state = randomState();
    setStateCookie(req, res, state);

    const authUrl = new URL('https://www.pinterest.com/oauth/');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES.join(','));
    authUrl.searchParams.set('state', state);

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', authUrl.toString());
    return res.status(302).end();
  } catch (error) {
    return sendApiError(res, error);
  }
}
