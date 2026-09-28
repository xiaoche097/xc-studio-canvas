import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ImageOff,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  PinterestBoard,
  PinterestPin,
  PinterestRequestError,
  PinterestService,
  PinterestSession,
} from '../services/pinterestService';

interface PinterestGalleryProps {
  onSelectPin?: (imageUrl: string, title: string) => void;
  compact?: boolean;
}

type ViewMode = 'pins' | 'boards';

function friendlyError(error: unknown): string {
  if (error instanceof PinterestRequestError || error instanceof Error) return error.message;
  return 'Pinterest 暂时无法连接，请稍后重试。';
}

export const PinterestGallery: React.FC<PinterestGalleryProps> = ({ onSelectPin, compact = false }) => {
  const [session, setSession] = useState<PinterestSession | null>(null);
  const [pins, setPins] = useState<PinterestPin[]>([]);
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [pinsBookmark, setPinsBookmark] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>('pins');
  const [activeBoard, setActiveBoard] = useState<PinterestBoard | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinterestPin | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const nextSession = await PinterestService.getSession();
      setSession(nextSession);
      return nextSession;
    } catch (nextError) {
      setSession({ connected: false, configured: false });
      setError(friendlyError(nextError));
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const loadLibrary = useCallback(async (board?: PinterestBoard | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const [pinsPage, boardsPage] = await Promise.all([
        PinterestService.listPins({ boardId: board?.id }),
        PinterestService.listBoards(),
      ]);
      setPins(pinsPage.items || []);
      setPinsBookmark(pinsPage.bookmark || null);
      setBoards(boardsPage.items || []);
    } catch (nextError) {
      setError(friendlyError(nextError));
      if (nextError instanceof PinterestRequestError && nextError.status === 401) {
        setSession((current) => ({ ...(current || { configured: true }), connected: false }));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession().then((nextSession) => {
      if (nextSession?.connected) void loadLibrary(null);
    });
  }, [loadLibrary, loadSession]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await PinterestService.connect();
      const nextSession = await loadSession();
      if (nextSession?.connected) await loadLibrary(null);
    } catch (nextError) {
      setError(friendlyError(nextError));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await PinterestService.disconnect();
      setSession({ connected: false, configured: true });
      setPins([]);
      setBoards([]);
      setActiveBoard(null);
    } catch (nextError) {
      setError(friendlyError(nextError));
    }
  };

  const handleBoardOpen = async (board: PinterestBoard) => {
    setActiveBoard(board);
    setActiveView('pins');
    await loadLibrary(board);
  };

  const handleLoadMore = async () => {
    if (!pinsBookmark || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await PinterestService.listPins({ bookmark: pinsBookmark, boardId: activeBoard?.id });
      setPins((current) => [...current, ...(page.items || [])]);
      setPinsBookmark(page.bookmark || null);
    } catch (nextError) {
      setError(friendlyError(nextError));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const username = session?.profile?.username;
  const selectedImage = selectedPin ? PinterestService.getPinImage(selectedPin) : null;
  const selectedTitle = selectedPin?.title || selectedPin?.alt_text || '未命名 Pin';
  const grantedScopes = useMemo(() => new Set((session?.scope || '').split(/[\s,]+/).filter(Boolean)), [session?.scope]);

  if (isChecking) {
    return (
      <div className="flex h-full min-h-[22rem] w-full items-center justify-center bg-white" aria-live="polite">
        <LoaderCircle className="h-5 w-5 animate-spin text-stone-400" />
        <span className="ml-3 text-sm font-medium text-stone-500">正在检查 Pinterest 连接…</span>
      </div>
    );
  }

  if (!session?.connected) {
    return (
      <div className={`relative flex h-full w-full items-center justify-center overflow-y-auto bg-white ${compact ? 'min-h-0 px-3 py-4' : 'min-h-[30rem] px-5 py-10 sm:px-8'}`}>
        <div className={`relative w-full text-center ${compact ? 'max-w-none p-5' : 'max-w-[31rem] p-6 sm:p-9'}`}>
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#e60023] font-serif text-xl font-bold text-white">P</div>
          <h2 className={`${compact ? 'text-lg' : 'text-2xl'} mt-5 font-semibold tracking-tight text-stone-950`}>连接 Pinterest</h2>
          <p className="mx-auto mt-3 max-w-[28rem] text-sm leading-6 text-stone-500">
            连接账号，浏览你的图板和 Pin，并将灵感直接加入创作。
          </p>
          {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm leading-5 text-red-700" role="alert">{error}</div>}
          <button type="button" onClick={handleConnect} disabled={isConnecting || session?.configured === false} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-950 transition hover:border-stone-950 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 disabled:cursor-not-allowed disabled:opacity-50">
            {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isConnecting ? '等待 Pinterest 授权…' : '连接 Pinterest'}
          </button>
          <p className="mt-3 text-xs leading-5 text-stone-400">会打开 Pinterest 官方授权窗口；我们不会获取你的 Pinterest 密码。</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-white text-stone-900">
        <header className="shrink-0 border-b border-stone-200 px-4 pt-3">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <h2 className="text-base font-bold">Pinterest</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void loadLibrary(activeBoard)} aria-label="刷新 Pinterest" className="grid h-12 w-12 place-items-center rounded-lg text-stone-500 outline-none transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
              <button type="button" onClick={handleDisconnect} aria-label="Pinterest 更多选项与断开连接" title="断开 Pinterest" className="grid h-12 w-12 place-items-center rounded-lg text-stone-500 outline-none transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950"><MoreHorizontal className="h-4 w-4" /></button>
            </div>
          </div>
          <nav className="flex gap-5" aria-label="Pinterest 分类">
            <button type="button" onClick={() => { setActiveView('pins'); setActiveBoard(null); void loadLibrary(null); }} className={`relative min-h-12 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-stone-950 ${activeView === 'pins' ? 'text-stone-950 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-stone-950' : 'text-stone-500'}`}>Pins</button>
            <button type="button" onClick={() => setActiveView('boards')} className={`relative min-h-12 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-stone-950 ${activeView === 'boards' ? 'text-stone-950 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-stone-950' : 'text-stone-500'}`}>Boards</button>
          </nav>
        </header>

        {activeBoard && activeView === 'pins' && (
          <div className="flex min-h-12 items-center gap-2 border-b border-stone-200 px-3 text-sm"><button type="button" onClick={() => { setActiveBoard(null); setActiveView('boards'); }} className="grid h-12 w-12 place-items-center rounded-lg text-stone-500 outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-950" aria-label="返回图板"><ArrowLeft className="h-4 w-4" /></button><span className="truncate font-bold">{activeBoard.name}</span></div>
        )}

        {error && <div className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</div>}

        <main className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className={`animate-pulse rounded-xl bg-stone-200 ${index % 3 === 0 ? 'h-64' : 'h-44'}`} />)}</div>
          ) : activeView === 'boards' ? (
            boards.length ? <div className="space-y-3">{boards.map((board) => {
              const cover = PinterestService.getBoardCover(board);
              return <button key={board.id} type="button" onClick={() => void handleBoardOpen(board)} className="flex min-h-24 w-full items-center gap-3 rounded-[10px] border border-stone-200 bg-white p-2 text-left outline-none transition hover:border-stone-400 focus-visible:ring-2 focus-visible:ring-stone-950">{cover ? <img src={cover} alt="" className="h-20 w-20 rounded-lg object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-lg bg-stone-100"><ImageOff className="h-5 w-5 text-stone-300" /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{board.name}</span><span className="mt-1 block text-xs text-stone-400">{board.pin_count ?? 0} 个 Pin</span></span><ChevronRight className="h-4 w-4 text-stone-300" /></button>;
            })}</div> : <EmptyState label="这个账号还没有可读取的图板" />
          ) : pins.length ? (
            <>
              <div className="columns-2 gap-2.5">{pins.map((pin) => {
                const imageUrl = PinterestService.getPinImage(pin);
                const title = pin.title || pin.alt_text || '未命名 Pin';
                return <button key={pin.id} type="button" disabled={!imageUrl} onClick={() => imageUrl && onSelectPin?.(imageUrl, title)} className="group relative mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-xl bg-stone-100 text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-stone-950">{imageUrl ? <img src={imageUrl} alt={pin.alt_text || title} loading="lazy" className="h-auto w-full object-cover" /> : <span className="grid aspect-[4/5] place-items-center"><ImageOff className="h-6 w-6 text-stone-300" /></span>}<span className="sr-only">添加 {title}</span></button>;
              })}</div>
              {pinsBookmark && <button type="button" onClick={handleLoadMore} disabled={isLoadingMore} className="mt-3 min-h-11 w-full rounded-xl border border-stone-300 text-sm font-semibold">{isLoadingMore ? '正在加载…' : '加载更多'}</button>}
            </>
          ) : <EmptyState label={activeBoard ? '这个图板还没有 Pin' : '这个账号还没有可读取的 Pin'} />}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white text-stone-900">
      <header className={`flex h-12 min-h-12 shrink-0 items-center gap-4 overflow-x-auto border-b border-stone-200 bg-white px-4 ${compact ? '' : 'sm:px-6'}`}>
        <div className="flex min-w-max items-center gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e60023] font-serif text-sm font-bold text-white">P</div>
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-stone-500"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /><span>已连接</span><span className="max-w-[12rem] truncate text-sm font-semibold text-stone-950">{username ? `@${username}` : 'Pinterest 账号'}</span></div>
        </div>
        <div className="flex min-w-max items-center gap-2">
          <button type="button" onClick={() => { setActiveView('pins'); setActiveBoard(null); void loadLibrary(null); }} className={`min-h-12 whitespace-nowrap border-b px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-stone-950 ${activeView === 'pins' && !activeBoard ? 'border-stone-950 text-stone-950' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>我的 Pin</button>
          <button type="button" onClick={() => setActiveView('boards')} className={`min-h-12 whitespace-nowrap border-b px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-stone-950 ${activeView === 'boards' ? 'border-stone-950 text-stone-950' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>我的图板</button>
          <button type="button" onClick={() => void loadLibrary(activeBoard)} aria-label="刷新 Pinterest 素材" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-600 outline-none transition hover:bg-stone-200 focus-visible:ring-2 focus-visible:ring-stone-950"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={handleDisconnect} className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-stone-500 outline-none transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-950"><LogOut className="h-4 w-4" />断开</button>
        </div>
      </header>

      {activeBoard && activeView === 'pins' && (
        <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5 text-sm sm:px-6">
          <button type="button" onClick={() => { setActiveBoard(null); setActiveView('boards'); }} className="grid h-12 w-12 place-items-center rounded-lg text-stone-500 outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-950" aria-label="返回图板"><ArrowLeft className="h-4 w-4" /></button>
          <span className="font-bold">{activeBoard.name}</span><span className="text-stone-400">{activeBoard.pin_count ?? 0} 个 Pin</span>
        </div>
      )}

      {error && <div className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-red-100" aria-label="关闭提示"><X className="h-4 w-4" /></button></div>}

      <main className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'p-3' : 'p-4 sm:p-6'}`}>
        {isLoading ? (
            <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`} aria-label="正在加载 Pinterest 素材">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className={`animate-pulse rounded-[10px] bg-stone-200 ${index % 3 === 0 ? 'h-72' : 'h-52'}`} />)}
          </div>
        ) : activeView === 'boards' ? (
          boards.length ? (
            <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
              {boards.map((board) => {
                const cover = PinterestService.getBoardCover(board);
                return (
                  <button key={board.id} type="button" onClick={() => void handleBoardOpen(board)} className="group overflow-hidden rounded-[10px] border border-stone-200 bg-white text-left outline-none transition hover:border-stone-400 focus-visible:ring-2 focus-visible:ring-stone-950">
                    <div className="aspect-[16/10] overflow-hidden bg-stone-100">{cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95" /> : <div className="grid h-full place-items-center"><ImageOff className="h-7 w-7 text-stone-300" /></div>}</div>
                    <div className="flex min-h-20 items-center justify-between gap-3 p-4"><div className="min-w-0"><h3 className="truncate text-sm font-bold">{board.name}</h3><p className="mt-1 text-xs text-stone-500">{board.pin_count ?? 0} 个 Pin · {board.privacy === 'SECRET' ? '私密' : '公开'}</p></div><ChevronRight className="h-5 w-5 shrink-0 text-stone-300" /></div>
                  </button>
                );
              })}
            </div>
          ) : <EmptyState label="这个账号还没有可读取的图板" />
        ) : pins.length ? (
          <>
            <div className={compact ? 'columns-2 gap-3' : 'columns-1 gap-4 min-[460px]:columns-2 md:columns-3 xl:columns-4'}>
              {pins.map((pin, index) => {
                const imageUrl = PinterestService.getPinImage(pin);
                const title = pin.title || pin.alt_text || '未命名 Pin';
                return (
                  <motion.article key={pin.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.025 }} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-[10px] border border-stone-200 bg-white">
                    <button type="button" onClick={() => setSelectedPin(pin)} className="block w-full text-left">
                      {imageUrl ? <img src={imageUrl} alt={pin.alt_text || title} loading="lazy" className="h-auto w-full bg-stone-100 object-cover" /> : <div className="grid aspect-[4/5] place-items-center bg-stone-100"><ImageOff className="h-7 w-7 text-stone-300" /></div>}
                      <div className="p-3"><h3 className="line-clamp-2 text-sm font-medium leading-5">{title}</h3>{pin.board_owner?.username && <p className="mt-1 text-xs text-stone-400">@{pin.board_owner.username}</p>}</div>
                    </button>
                    {imageUrl && <button type="button" onClick={() => onSelectPin?.(imageUrl, title)} className="absolute bottom-3 right-3 inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-900 opacity-100 transition hover:bg-stone-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 md:opacity-0 md:group-hover:opacity-100"><Plus className="h-4 w-4" />加入素材</button>}
                  </motion.article>
                );
              })}
            </div>
            {pinsBookmark && <div className="flex justify-center py-5"><button type="button" onClick={handleLoadMore} disabled={isLoadingMore} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-5 text-sm font-bold hover:bg-stone-100 disabled:opacity-60">{isLoadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}加载更多</button></div>}
          </>
        ) : <EmptyState label={activeBoard ? '这个图板还没有 Pin' : '这个账号还没有可读取的 Pin'} />}
      </main>

      <AnimatePresence>
        {selectedPin && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPin(null); }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-[0_12px_36px_rgba(0,0,0,0.18)] md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
              <button type="button" onClick={() => setSelectedPin(null)} className="absolute right-3 top-3 z-10 grid h-12 w-12 place-items-center rounded-lg bg-black/65 text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-white" aria-label="关闭"><X className="h-5 w-5" /></button>
              <div className="min-h-64 overflow-hidden bg-stone-100 md:min-h-[34rem]">{selectedImage ? <img src={selectedImage} alt={selectedPin.alt_text || selectedTitle} className="h-full max-h-[70vh] w-full object-contain" /> : <div className="grid h-full place-items-center"><ImageOff className="h-8 w-8 text-stone-300" /></div>}</div>
              <div className="flex flex-col justify-between gap-7 overflow-y-auto p-6 sm:p-8">
                <div><p className="text-xs font-medium tracking-wide text-stone-400">Pinterest Pin</p><h2 className="mt-3 text-xl font-semibold leading-tight">{selectedTitle}</h2>{selectedPin.description && <p className="mt-4 text-sm leading-6 text-stone-500">{selectedPin.description}</p>}<div className="mt-5 flex flex-wrap gap-2">{selectedPin.board_owner?.username && <span className="rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium">@{selectedPin.board_owner.username}</span>}{grantedScopes.has('pins:read_secret') && <span className="rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600">私密 Pin 权限已授权</span>}</div></div>
                <div className="space-y-2">{selectedImage && <button type="button" onClick={() => { onSelectPin?.(selectedImage, selectedTitle); setSelectedPin(null); }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 text-sm font-semibold text-white outline-none hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-stone-950"><Plus className="h-4 w-4" />加入 AI 素材</button>}<a href={`https://www.pinterest.com/pin/${selectedPin.id}/`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-stone-300 px-5 text-sm font-semibold outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-950">在 Pinterest 查看<ExternalLink className="h-4 w-4" /></a></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="grid min-h-48 place-items-center px-6 text-center"><div><ImageOff className="mx-auto h-7 w-7 text-stone-300" /><p className="mt-3 text-sm font-medium text-stone-500">{label}</p></div></div>
);

export default PinterestGallery;
