import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Download,
  Hand,
  Image as ImageIcon,
  Layers3,
  Maximize2,
  MousePointer2,
  Paperclip,
  PencilLine,
  Redo2,
  Share2,
  Sparkles,
  Undo2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import PinterestGallery from '../components/PinterestGallery';

export interface WorkspaceSeed {
  prompt: string;
  attachments: File[];
}

interface AgentWorkspaceProps {
  seed?: WorkspaceSeed | null;
  onBack: () => void;
}

type WorkspacePanel = 'agent' | 'references' | 'canvas';
type CanvasTool = 'select' | 'mark' | 'draw';

interface WorkspaceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const createMessage = (role: WorkspaceMessage['role'], text: string): WorkspaceMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  text,
});

const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ seed, onBack }) => {
  const initialPrompt = seed?.prompt.trim() || '为我的产品创建一套有质感的视觉方案';
  const [activePanel, setActivePanel] = useState<WorkspacePanel>('canvas');
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [draft, setDraft] = useState('');
  const [projectTitle, setProjectTitle] = useState('未命名项目');
  const [zoom, setZoom] = useState(59);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  const [canvasTitle, setCanvasTitle] = useState('等待添加视觉素材');
  const [messages, setMessages] = useState<WorkspaceMessage[]>(() => [
    createMessage('user', initialPrompt),
    createMessage('assistant', '工作区已准备好。你可以从 Pinterest 选择参考图，或继续告诉我想调整的画面、风格和构图。'),
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localCanvasUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const firstAttachment = seed?.attachments?.[0];
    if (!firstAttachment) return;

    const objectUrl = URL.createObjectURL(firstAttachment);
    setCanvasImage(objectUrl);
    setCanvasTitle(firstAttachment.name);
    return () => URL.revokeObjectURL(objectUrl);
  }, [seed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (localCanvasUrlRef.current) URL.revokeObjectURL(localCanvasUrlRef.current);
  }, []);

  const attachmentNames = useMemo(() => seed?.attachments?.map((file) => file.name) || [], [seed]);

  const sendMessage = () => {
    const nextMessage = draft.trim();
    if (!nextMessage) return;

    setMessages((current) => [
      ...current,
      createMessage('user', nextMessage),
      createMessage('assistant', '收到。我会基于当前画布和参考素材继续处理，你也可以在画布上标记需要修改的位置。'),
    ]);
    setDraft('');
  };

  const handleSelectPin = (imageUrl: string, title: string) => {
    setCanvasImage(imageUrl);
    setCanvasTitle(title);
    setMessages((current) => [
      ...current,
      createMessage('assistant', `已将「${title}」加入画布，并作为当前视觉参考。`),
    ]);
    setActivePanel('canvas');
  };

  const handleLocalImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (localCanvasUrlRef.current) URL.revokeObjectURL(localCanvasUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    localCanvasUrlRef.current = objectUrl;
    setCanvasImage(objectUrl);
    setCanvasTitle(file.name);
    setMessages((current) => [...current, createMessage('assistant', `已把「${file.name}」放入画布。`)]);
    setActivePanel('canvas');
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f2f2f0] text-slate-950">
      <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-black/10 bg-white px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回首页"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="min-w-0 px-1">
            <input
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              aria-label="项目名称"
              className="w-32 truncate bg-transparent text-sm font-bold outline-none transition focus:w-48 sm:w-44"
            />
            <p className="flex items-center gap-1 text-[0.65rem] font-semibold text-emerald-600">
              <Check className="h-3 w-3" /> 已自动保存
            </p>
          </div>
        </div>

        <nav className="mx-2 flex min-w-0 items-center rounded-xl bg-slate-100 p-1 lg:hidden" aria-label="工作区面板">
          {([
            ['agent', 'Agent', Bot],
            ['references', '素材', ImageIcon],
            ['canvas', '画布', Layers3],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivePanel(id)}
              className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                activePanel === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button type="button" aria-label="撤销" className="hidden h-11 w-11 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 sm:grid"><Undo2 className="h-4 w-4" /></button>
          <button type="button" aria-label="重做" className="hidden h-11 w-11 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 sm:grid"><Redo2 className="h-4 w-4" /></button>
          <button type="button" className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3.5 text-xs font-bold text-white transition hover:bg-slate-800">
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">分享</span>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(21rem,25rem)_minmax(17rem,20rem)_minmax(0,1fr)]">
        <aside className={`${activePanel === 'agent' ? 'flex' : 'hidden'} min-h-0 flex-col border-r border-black/10 bg-white lg:flex`}>
          <div className="flex min-h-14 items-center justify-between border-b border-slate-100 px-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-white"><Sparkles className="h-3.5 w-3.5" /></div>
              <div><p className="text-sm font-bold">XC Agent</p><p className="text-[0.65rem] font-semibold text-slate-400">视觉创作协作中</p></div>
            </div>
            <button type="button" className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Agent <ChevronDown className="h-3 w-3" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-5">
              {messages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? 'ml-7' : ''}>
                  {message.role === 'assistant' && <p className="mb-1.5 flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-[0.16em] text-blue-600"><WandSparkles className="h-3 w-3" /> Agent</p>}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-slate-100 text-slate-800' : 'border border-slate-200 bg-white text-slate-600'}`}>
                    {message.text}
                  </div>
                </div>
              ))}

              {attachmentNames.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-[#fafaf9] p-3">
                  <p className="text-xs font-bold text-slate-700">参考素材</p>
                  <div className="mt-2 space-y-1.5">
                    {attachmentNames.map((name) => <p key={name} className="truncate rounded-lg bg-white px-2.5 py-2 text-xs text-slate-500">{name}</p>)}
                  </div>
                </div>
              )}

              {canvasImage && (
                <button type="button" onClick={() => setActivePanel('canvas')} className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-slate-400">
                  <img src={canvasImage} alt={canvasTitle} className="aspect-[16/9] w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 p-3"><span className="truncate text-xs font-bold">{canvasTitle}</span><Maximize2 className="h-3.5 w-3.5 text-slate-400" /></div>
                </button>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 p-3">
            <div className="rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] focus-within:border-slate-400">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="继续描述修改需求…"
                aria-label="向 Agent 发送消息"
                className="h-20 w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-slate-400"
              />
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="添加图片" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-950"><Paperclip className="h-4 w-4" /></button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLocalImage} />
                <button type="button" onClick={sendMessage} disabled={!draft.trim()} aria-label="发送消息" className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-300"><ArrowUp className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </aside>

        <aside className={`${activePanel === 'references' ? 'flex' : 'hidden'} min-h-0 flex-col border-r border-black/10 bg-[#fbfaf9] lg:flex`}>
          <PinterestGallery compact onSelectPin={handleSelectPin} />
        </aside>

        <main className={`${activePanel === 'canvas' ? 'flex' : 'hidden'} relative min-h-0 min-w-0 flex-col overflow-hidden bg-[#ececea] lg:flex`}>
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#11182718_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6 sm:p-10 lg:p-12">
            <div className="relative flex aspect-[4/5] max-h-full w-full max-w-[46rem] items-center justify-center overflow-hidden bg-white shadow-[0_20px_70px_rgba(15,23,42,0.14)]" style={{ transform: `scale(${Math.min(1.35, Math.max(0.65, zoom / 59))})` }}>
              {canvasImage ? (
                <img src={canvasImage} alt={canvasTitle} className="h-full w-full object-contain" />
              ) : (
                <div className="max-w-sm px-8 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100"><ImageIcon className="h-5 w-5 text-slate-400" /></div>
                  <h2 className="mt-5 text-xl font-black tracking-tight">画布已准备好</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">从 Pinterest 选择一张参考图，或在 Agent 输入框中上传素材开始创作。</p>
                  <button type="button" onClick={() => setActivePanel('references')} className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white lg:hidden">选择素材</button>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.14)] backdrop-blur">
            {([
              ['select', '选择', MousePointer2],
              ['mark', '标记', Hand],
              ['draw', '涂鸦', PencilLine],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setActiveTool(id)} className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${activeTool === id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-slate-200" />
            <button type="button" onClick={() => setZoom((value) => Math.max(25, value - 10))} aria-label="缩小画布" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><ZoomOut className="h-4 w-4" /></button>
            <span className="w-10 text-center text-xs font-bold text-slate-500">{zoom}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(100, value + 10))} aria-label="放大画布" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><ZoomIn className="h-4 w-4" /></button>
            <button type="button" aria-label="导出画布" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Download className="h-4 w-4" /></button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AgentWorkspace;
