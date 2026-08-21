import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
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
      <div className="flex h-full min-h-[22rem] w-full items-center justify-center bg-[#fffdfd]" aria-live="polite">
        <LoaderCircle className="h-7 w-7 animate-spin text-[#e60023]" />
        <span className="ml-3 text-sm font-medium text-stone-500">正在检查 Pinterest 连接…</span>
      </div>
    );
  }

  if (!session?.connected) {
    return (
      <div className={`relative flex h-full w-full items-center justify-center overflow-y-auto bg-[#fffdfd] ${compact ? 'min-h-0 px-3 py-4' : 'min-h-[30rem] px-5 py-10 sm:px-8'}`}>
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#e6002312_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className={`relative w-full bg-white text-center ${compact ? 'max-w-none rounded-2xl border border-red-100 p-5 shadow-[0_16px_45px_rgba(76,16,25,0.08)]' : 'max-w-[31rem] rounded-[2rem] border border-red-100 p-6 shadow-[0_28px_80px_rgba(76,16,25,0.10)] sm:p-9'}`}>
          <div className={`mx-auto grid place-items-center rounded-full bg-[#e60023] font-serif font-bold text-white shadow-[0_12px_28px_rgba(230,0,35,0.25)] ${compact ? 'h-12 w-12 text-2xl' : 'h-16 w-16 text-3xl'}`}>P</div>
          <p className={`${compact ? 'mt-4' : 'mt-6'} text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#e60023]`}>Pinterest Connect</p>
          <h2 className={`${compact ? 'text-lg' : 'text-2xl'} mt-2 font-black tracking-tight text-stone-950`}>连接你的灵感资料库</h2>
          <p className={`mx-auto mt-3 max-w-[28rem] text-sm leading-6 text-stone-500 ${compact ? 'line-clamp-3' : ''}`}>
            通过 Pinterest 官方授权读取你账号中的公开与私密图板、Pin。授权凭证只保存在服务端加密会话中。
          </p>
          <div className={`grid gap-2 text-left text-sm text-stone-700 ${compact ? 'mt-4 grid-cols-1' : 'mt-6 sm:grid-cols-2'}`}>
            {['公开图板与 Pin', '私密图板与 Pin', '账号基础信息', '随时断开连接'].map((label) => (
              <div key={label} className="flex min-h-11 items-center gap-2 rounded-xl bg-red-50/70 px-3">
                <Check className="h-4 w-4 shrink-0 text-[#e60023]" /><span>{label}</span>
              </div>
            ))}
          </div>
          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm leading-5 text-red-700" role="alert">{error}</div>}
          <button type="button" onClick={handleConnect} disabled={isConnecting || session?.configured === false} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e60023] px-6 text-sm font-bold text-white shadow-[0_12px_24px_rgba(230,0,35,0.18)] transition hover:bg-[#c90020] disabled:cursor-not-allowed disabled:opacity-50">
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
              <button type="button" onClick={() => void loadLibrary(activeBoard)} aria-label="刷新 Pinterest" className="grid h-11 w-11 place-items-center rounded-xl text-stone-500 outline-none transition hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-950"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
              <button type="button" onClick={handleDisconnect} aria-label="Pinterest 更多选项与断开连接" title="断开 Pinterest" className="grid h-11 w-11 place-items-center rounded-xl text-stone-500 outline-none transition hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-950"><MoreHorizontal className="h-4 w-4" /></button>
            </div>
          </div>
          <nav className="flex gap-5" aria-label="Pinterest 分类">
            <button type="button" onClick={() => { setActiveView('pins'); setActiveBoard(null); void loadLibrary(null); }} className={`relative min-h-10 text-sm font-medium ${activeView === 'pins' ? 'text-stone-950 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-stone-950' : 'text-stone-500'}`}>Pins</button>
            <button type="button" onClick={() => setActiveView('boards')} className={`relative min-h-10 text-sm font-medium ${activeView === 'boards' ? 'text-stone-950 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-stone-950' : 'text-stone-500'}`}>Boards</button>
          </nav>
        </header>

        {activeBoard && activeView === 'pins' && (
          <div className="flex min-h-12 items-center gap-2 border-b border-stone-200 px-3 text-sm"><button type="button" onClick={() => { setActiveBoard(null); setActiveView('boards'); }} className="grid h-11 w-11 place-items-center rounded-xl text-stone-500 hover:bg-stone-100" aria-label="返回图板"><ArrowLeft className="h-4 w-4" /></button><span className="truncate font-bold">{activeBoard.name}</span></div>
        )}

        {error && <div className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</div>}

        <main className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className={`animate-pulse rounded-xl bg-stone-200 ${index % 3 === 0 ? 'h-64' : 'h-44'}`} />)}</div>
          ) : activeView === 'boards' ? (
            boards.length ? <div className="space-y-3">{boards.map((board) => {
              const cover = PinterestService.getBoardCover(board);
              return <button key={board.id} type="button" onClick={() => void handleBoardOpen(board)} className="flex min-h-24 w-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-2 text-left transition hover:border-stone-400">{cover ? <img src={cover} alt="" className="h-20 w-20 rounded-lg object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-lg bg-stone-100"><ImageOff className="h-5 w-5 text-stone-300" /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{board.name}</span><span className="mt-1 block text-xs text-stone-400">{board.pin_count ?? 0} 个 Pin</span></span><ChevronRight className="h-4 w-4 text-stone-300" /></button>;
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
    <div className="flex h-full min-h-0 w-full flex-col bg-[#fbfaf9] text-stone-900">
      <header className={`flex flex-col gap-3 border-b border-stone-200 bg-white py-3 ${compact ? 'px-4' : 'px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e60023] font-serif text-xl font-bold text-white">P</div>
          <div className="min-w-0"><div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />已连接</div><p className="truncate text-sm font-bold">{username ? `@${username}` : 'Pinterest 账号'}</p></div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <button type="button" onClick={() => { setActiveView('pins'); setActiveBoard(null); void loadLibrary(null); }} className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-bold transition ${activeView === 'pins' && !activeBoard ? 'bg-stone-950 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>我的 Pin</button>
          <button type="button" onClick={() => setActiveView('boards')} className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-bold transition ${activeView === 'boards' ? 'bg-stone-950 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>我的图板</button>
          <button type="button" onClick={() => void loadLibrary(activeBoard)} aria-label="刷新 Pinterest 素材" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={handleDisconnect} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-stone-500 transition hover:bg-red-50 hover:text-red-700"><LogOut className="h-4 w-4" />断开</button>
        </div>
      </header>

      {activeBoard && activeView === 'pins' && (
        <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5 text-sm sm:px-6">
          <button type="button" onClick={() => { setActiveBoard(null); setActiveView('boards'); }} className="grid h-11 w-11 place-items-center rounded-full text-stone-500 hover:bg-stone-100" aria-label="返回图板"><ArrowLeft className="h-4 w-4" /></button>
          <span className="font-bold">{activeBoard.name}</span><span className="text-stone-400">{activeBoard.pin_count ?? 0} 个 Pin</span>
        </div>
      )}

      {error && <div className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-red-100" aria-label="关闭提示"><X className="h-4 w-4" /></button></div>}

      <main className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'p-3' : 'p-4 sm:p-6'}`}>
        {isLoading ? (
          <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`} aria-label="正在加载 Pinterest 素材">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className={`animate-pulse rounded-2xl bg-stone-200 ${index % 3 === 0 ? 'h-72' : 'h-52'}`} />)}
          </div>
        ) : activeView === 'boards' ? (
          boards.length ? (
            <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
              {boards.map((board) => {
                const cover = PinterestService.getBoardCover(board);
                return (
                  <button key={board.id} type="button" onClick={() => void handleBoardOpen(board)} className="group overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="aspect-[16/10] overflow-hidden bg-stone-100">{cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center"><ImageOff className="h-7 w-7 text-stone-300" /></div>}</div>
                    <div className="flex min-h-20 items-center justify-between gap-3 p-4"><div className="min-w-0"><h3 className="truncate text-sm font-bold">{board.name}</h3><p className="mt-1 text-xs text-stone-500">{board.pin_count ?? 0} 个 Pin · {board.privacy === 'SECRET' ? '私密' : '公开'}</p></div><ChevronRight className="h-5 w-5 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-700" /></div>
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
                  <motion.article key={pin.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.025 }} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <button type="button" onClick={() => setSelectedPin(pin)} className="block w-full text-left">
                      {imageUrl ? <img src={imageUrl} alt={pin.alt_text || title} loading="lazy" className="h-auto w-full bg-stone-100 object-cover" /> : <div className="grid aspect-[4/5] place-items-center bg-stone-100"><ImageOff className="h-7 w-7 text-stone-300" /></div>}
                      <div className="p-3"><h3 className="line-clamp-2 text-sm font-bold leading-5">{title}</h3>{pin.board_owner?.username && <p className="mt-1 text-xs text-stone-400">@{pin.board_owner.username}</p>}</div>
                    </button>
                    {imageUrl && <button type="button" onClick={() => onSelectPin?.(imageUrl, title)} className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-stone-900 opacity-100 shadow-lg transition hover:bg-stone-950 hover:text-white md:opacity-0 md:group-hover:opacity-100"><Plus className="h-4 w-4" />加入素材</button>}
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
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="relative grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
              <button type="button" onClick={() => setSelectedPin(null)} className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/65 text-white hover:bg-black" aria-label="关闭"><X className="h-5 w-5" /></button>
              <div className="min-h-64 overflow-hidden bg-stone-100 md:min-h-[34rem]">{selectedImage ? <img src={selectedImage} alt={selectedPin.alt_text || selectedTitle} className="h-full max-h-[70vh] w-full object-contain" /> : <div className="grid h-full place-items-center"><ImageOff className="h-8 w-8 text-stone-300" /></div>}</div>
              <div className="flex flex-col justify-between gap-7 overflow-y-auto p-6 sm:p-8">
                <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e60023]">Pinterest Pin</p><h2 className="mt-3 text-xl font-black leading-tight">{selectedTitle}</h2>{selectedPin.description && <p className="mt-4 text-sm leading-6 text-stone-500">{selectedPin.description}</p>}<div className="mt-5 flex flex-wrap gap-2">{selectedPin.board_owner?.username && <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold">@{selectedPin.board_owner.username}</span>}{grantedScopes.has('pins:read_secret') && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">私密 Pin 权限已授权</span>}</div></div>
                <div className="space-y-2">{selectedImage && <button type="button" onClick={() => { onSelectPin?.(selectedImage, selectedTitle); setSelectedPin(null); }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-bold text-white hover:bg-stone-800"><Plus className="h-4 w-4" />加入 AI 素材</button>}<a href={`https://www.pinterest.com/pin/${selectedPin.id}/`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 px-5 text-sm font-bold hover:bg-stone-100">在 Pinterest 查看<ExternalLink className="h-4 w-4" /></a></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-stone-300 bg-white px-6 text-center"><div><ImageOff className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-semibold text-stone-500">{label}</p></div></div>
);

export default PinterestGallery;
