import { enforceRateLimit, methodNotAllowed, pinterestFetch, requireSession, sendApiError } from './_shared.js';

function single(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    enforceRateLimit(req, res, 'pins');
    const session = await requireSession(req, res);
    const bookmark = single(req.query.bookmark);
    const boardId = single(req.query.board_id);
    if (boardId && !/^\d{1,32}$/.test(boardId)) return res.status(400).json({ error: '无效的图板 ID。' });
    if (bookmark && bookmark.length > 1000) return res.status(400).json({ error: '无效的分页标记。' });

    const query = new URLSearchParams({ page_size: '50' });
    if (bookmark) query.set('bookmark', bookmark);
    const path = boardId ? `/boards/${boardId}/pins?${query}` : `/pins?${query}`;
    const data = await pinterestFetch(path, session.accessToken);

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(data);
  } catch (error) {
    return sendApiError(res, error);
  }
}
