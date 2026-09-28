export interface PinterestProfile {
  username?: string;
  account_type?: string;
  profile_image?: string;
  website_url?: string;
}

export interface PinterestSession {
  connected: boolean;
  configured: boolean;
  profile?: PinterestProfile;
  scope?: string;
  connectedAt?: number;
  reason?: string;
}

export interface PinterestImageVariant {
  url: string;
  width?: number;
  height?: number;
}

export interface PinterestPin {
  id: string;
  title?: string;
  description?: string;
  alt_text?: string;
  link?: string;
  dominant_color?: string;
  board_id?: string;
  board_owner?: { username?: string };
  media?: {
    media_type?: string;
    images?: Record<string, PinterestImageVariant>;
    cover_image_url?: string;
  };
}

export interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  privacy?: 'PUBLIC' | 'PROTECTED' | 'SECRET' | string;
  pin_count?: number;
  follower_count?: number;
  pin_thumbnail_urls?: string[];
  media?: { image_cover_url?: string; pin_thumbnail_urls?: string[] };
}

export interface PinterestPage<T> {
  items: T[];
  bookmark: string | null;
}

export class PinterestRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'PinterestRequestError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...init?.headers },
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PinterestRequestError(
      typeof payload?.error === 'string' ? payload.error : `Pinterest 请求失败 (${response.status})`,
      response.status,
      payload?.code,
    );
  }
  return payload as T;
}

export class PinterestService {
  static getSession(): Promise<PinterestSession> {
    return request<PinterestSession>('/api/pinterest/session');
  }

  static listPins(options: { bookmark?: string; boardId?: string } = {}): Promise<PinterestPage<PinterestPin>> {
    const query = new URLSearchParams();
    if (options.bookmark) query.set('bookmark', options.bookmark);
    if (options.boardId) query.set('board_id', options.boardId);
    const suffix = query.size ? `?${query.toString()}` : '';
    return request<PinterestPage<PinterestPin>>(`/api/pinterest/pins${suffix}`);
  }

  static listBoards(bookmark?: string): Promise<PinterestPage<PinterestBoard>> {
    const suffix = bookmark ? `?bookmark=${encodeURIComponent(bookmark)}` : '';
    return request<PinterestPage<PinterestBoard>>(`/api/pinterest/boards${suffix}`);
  }

  static disconnect(): Promise<void> {
    return request<void>('/api/pinterest/disconnect', { method: 'POST' });
  }

  static connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const width = 620;
      const height = 760;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const popup = window.open('/api/pinterest/connect', 'xc-pinterest-oauth', `popup=yes,width=${width},height=${height},left=${left},top=${top}`);

      if (!popup) {
        window.location.assign('/api/pinterest/connect');
        return;
      }

      let settled = false;
      let closedTimer = 0;
      let timeoutTimer = 0;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        window.clearInterval(closedTimer);
        window.clearTimeout(timeoutTimer);
        if (error) reject(error);
        else resolve();
      };
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.data?.type !== 'xc:pinterest-oauth') return;
        if (event.data.ok) finish();
        else finish(new Error(event.data.message || 'Pinterest 授权未完成。'));
      };
      window.addEventListener('message', onMessage);
      closedTimer = window.setInterval(() => {
        if (popup.closed) finish(new Error('Pinterest 授权窗口已关闭。'));
      }, 700);
      timeoutTimer = window.setTimeout(() => {
        popup.close();
        finish(new Error('Pinterest 授权超时，请重试。'));
      }, 2 * 60 * 1000);
    });
  }

  static getPinImage(pin: PinterestPin): string | null {
    const variants = Object.values(pin.media?.images || {}).filter((image) => Boolean(image?.url));
    variants.sort((left, right) => (right.width || 0) - (left.width || 0));
    return variants[0]?.url || pin.media?.cover_image_url || null;
  }

  static getBoardCover(board: PinterestBoard): string | null {
    return board.media?.image_cover_url || board.media?.pin_thumbnail_urls?.[0] || board.pin_thumbnail_urls?.[0] || null;
  }
}
