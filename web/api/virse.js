import { executeVirseRequest } from './virse-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await executeVirseRequest(req.body || {});
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 502;
    const safeStatus = status >= 400 && status < 600 ? status : 502;
    return res.status(safeStatus).json({
      error: error instanceof Error ? error.message : 'Virse request failed',
    });
  }
}
