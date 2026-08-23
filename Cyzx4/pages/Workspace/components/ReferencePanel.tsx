import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ChevronRight,
  Image as ImageIcon,
  Images,
  MessageSquarePlus,
  Package,
  Palette,
  Paperclip,
  Plus,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import PinterestGallery from '../../../components/PinterestGallery';
import {
  createMaterialDraft,
  listMaterials,
  type MaterialKind,
  type MaterialRecord,
} from '../../../services/materialLibrary';
import { MaterialEditor } from '../../Home/components/MaterialLibrary';
import type { CanvasElement, ChatMessage } from '../../../types';
import { extractLegacyMessageReferences } from '../../../utils/message-references';
import { getReadableAttachmentLabel } from '../../../utils/attachment-label';

type ReferenceTab = 'reference' | 'assets' | 'pins' | 'plugins';

interface ReferencePanelProps {
  elements: CanvasElement[];
  messages: ChatMessage[];
  onAddImage: (url: string, label?: string) => void;
  onAttachToAgent: (url: string, label?: string) => void | Promise<void>;
  onAddMaterialToAgent: (material: MaterialRecord) => void | Promise<void>;
  assistantOpen?: boolean;
  pages: Array<{ id: string; title: string }>;
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
}

interface VisualAsset {
  id: string;
  url: string;
  title: string;
  source: 'canvas' | 'generated' | 'upload';
}

interface ReferenceDragPayload {
  id: string;
  url: string;
  title: string;
}

type ReferenceDragWindow = Window & {
  __XC_REFERENCE_DRAG_PAYLOAD__?: ReferenceDragPayload;
};

const getCompactAssetTitle = (asset: VisualAsset, index: number) => {
  const rawTitle = String(asset.title || '').trim();
  const normalized = rawTitle.replace(/\s+/g, ' ');
  const looksEncoded = /^\d{8,}[-_]/.test(normalized)
    || /(?:^|[-_])self(?:[-_]|$)/i.test(normalized)
    || /[a-f0-9]{8}-[a-f0-9-]{20,}/i.test(normalized)
    || normalized.length > 18;

  if (normalized && !looksEncoded) return normalized;
  const prefix = asset.source === 'generated'
    ? '生成图'
    : asset.source === 'canvas'
      ? '画布图'
      : '参考图';
  return `${prefix} ${index + 1}`;
};

const materialTabs: Array<{ kind: MaterialKind; label: string }> = [
  { kind: 'brand', label: '品牌套件' },
  { kind: 'character', label: '角色' },
  { kind: 'product', label: '产品' },
  { kind: 'custom', label: '自定义' },
];

const materialIcon: Record<MaterialKind, React.ComponentType<{ className?: string }>> = {
  brand: Box,
  character: UserRound,
  product: Package,
  custom: Palette,
};

const ChromeMark = ({ small = false }: { small?: boolean }) => (
  <span
    aria-hidden="true"
    className={`relative inline-grid shrink-0 place-items-center rounded-full ${small ? 'h-4 w-4' : 'h-12 w-12'}`}
    style={{ background: 'conic-gradient(from -30deg,#ea4335 0 33%,#fbbc05 33% 46%,#34a853 46% 66%,#4285f4 66% 100%)' }}
  >
    <span className={`rounded-full border-white bg-[#4285f4] ${small ? 'h-1.5 w-1.5 border' : 'h-5 w-5 border-[3px]'}`} />
  </span>
);

const PinterestMark = () => (
  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e60023] font-serif text-[0.65rem] font-black text-white">P</span>
);

const ReferencePanel: React.FC<ReferencePanelProps> = ({
  elements,
  messages,
  onAddImage,
  onAttachToAgent,
  onAddMaterialToAgent,
  assistantOpen = true,
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
}) => {
  const [activeTab, setActiveTab] = useState<ReferenceTab>('reference');
  const [uploads, setUploads] = useState<VisualAsset[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [materialKind, setMaterialKind] = useState<MaterialKind>('brand');
  const [editingMaterial, setEditingMaterial] = useState<MaterialRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    listMaterials().then((records) => { if (active) setMaterials(records); }).catch(console.error);
    return () => { active = false; };
  }, [activeTab]);

  const canvasAssets = useMemo<VisualAsset[]>(() => elements
    .filter((element) => (element.type === 'image' || element.type === 'gen-image') && Boolean(element.url))
    .map((element) => ({
      id: `canvas-${element.id}`,
      url: element.url!,
      title: element.genPrompt || element.prompt || '画布图片',
      source: element.type === 'gen-image' ? 'generated' : 'canvas',
    })), [elements]);

  const messageUploads = useMemo<VisualAsset[]>(() => messages.flatMap((message) => {
    if (message.role !== 'user' || !Array.isArray(message.attachments)) return [];
    return message.attachments
      .filter((url): url is string => typeof url === 'string' && Boolean(url))
      .map((url, index) => ({
        id: `message-upload-${message.id}-${index}`,
        url,
        title: getReadableAttachmentLabel(
          message.attachmentMetadata?.[index]?.markerName
            || message.attachmentMetadata?.[index]?.name,
          index,
        ),
        source: 'upload' as const,
      }));
  }), [messages]);

  const legacyMessageUploads = useMemo<VisualAsset[]>(() => messages.flatMap((message) => (
    extractLegacyMessageReferences(message.text).map((reference, index) => ({
      id: `legacy-message-upload-${message.id}-${index}`,
      url: reference.url,
      title: reference.title,
      source: 'upload' as const,
    }))
  )), [messages]);

  const generatedAssets = useMemo<VisualAsset[]>(() => messages.flatMap((message, messageIndex) =>
    (message.agentData?.imageUrls || []).map((url: string, imageIndex: number) => ({
      id: `generated-${message.id}-${imageIndex}`,
      url,
      title: message.agentData?.title || `生成图片 ${messageIndex + 1}-${imageIndex + 1}`,
      source: 'generated' as const,
    })),
  ), [messages]);

  const allAssets = useMemo(() => {
    const seen = new Set<string>();
    return [...uploads, ...messageUploads, ...legacyMessageUploads, ...generatedAssets, ...canvasAssets].filter((asset) => {
      if (seen.has(asset.url)) return false;
      seen.add(asset.url);
      return true;
    }).map((asset, index) => ({
      ...asset,
      title: getCompactAssetTitle(asset, index),
    }));
  }, [canvasAssets, generatedAssets, legacyMessageUploads, messageUploads, uploads]);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        if (!url) return;
        const asset: VisualAsset = { id: `upload-${Date.now()}-${index}`, url, title: getReadableAttachmentLabel(file.name, index), source: 'upload' };
        setUploads((current) => [asset, ...current]);
        void onAttachToAgent(url, file.name);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const visibleMaterials = materials.filter((material) => material.kind === materialKind);
  const upsertMaterial = (record: MaterialRecord) => {
    setMaterials((current) => [record, ...current.filter((item) => item.id !== record.id)]);
  };

  const handleAssetDragStart = (
    event: React.DragEvent<HTMLElement>,
    asset: VisualAsset,
  ) => {
    const payload: ReferenceDragPayload = {
      id: asset.id,
      url: asset.url,
      title: asset.title,
    };
    (window as ReferenceDragWindow).__XC_REFERENCE_DRAG_PAYLOAD__ = payload;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-xc-reference-image', asset.id);
    if (/^https?:/i.test(asset.url) && asset.url.length < 2048) {
      event.dataTransfer.setData('text/uri-list', asset.url);
    }

    const dragPreview = document.createElement('div');
    dragPreview.textContent = `拖动 ${asset.title}`;
    dragPreview.style.cssText = 'position:fixed;left:-9999px;top:-9999px;padding:8px 12px;border-radius:10px;background:#0f172a;color:#fff;font:600 12px system-ui;box-shadow:0 6px 18px rgba(15,23,42,.22);';
    document.body.appendChild(dragPreview);
    event.dataTransfer.setDragImage(dragPreview, 20, 18);
    requestAnimationFrame(() => dragPreview.remove());
  };

  const handleAssetDragEnd = () => {
    delete (window as ReferenceDragWindow).__XC_REFERENCE_DRAG_PAYLOAD__;
  };

  return (
    <aside className="relative z-50 hidden h-full min-h-0 w-80 shrink-0 flex-col border-r border-slate-200 bg-white pt-14 xl:flex" aria-label="项目工具栏">
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

      <nav
        className="absolute top-0 flex h-14 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2"
        style={{
          left: assistantOpen ? 0 : '20rem',
          width: assistantOpen
            ? 'calc(100vw - 25rem)'
            : 'calc(100vw - 20rem)',
        }}
        aria-label="项目资源页面"
      >
        <span className="flex shrink-0 items-center gap-1">
          <ToolButton active={activeTab === 'reference'} label="参考" onClick={() => setActiveTab('reference')}><Paperclip className="h-4 w-4" /></ToolButton>
          <ToolButton active={activeTab === 'assets'} label="我的素材" onClick={() => setActiveTab('assets')}><Images className="h-4 w-4" /></ToolButton>
          <ToolButton active={activeTab === 'pins'} label="Pinterest" onClick={() => setActiveTab('pins')}><PinterestMark /></ToolButton>
          <ToolButton active={activeTab === 'plugins'} label="XC AI Clipper" onClick={() => setActiveTab('plugins')}><ChromeMark small /></ToolButton>
        </span>
        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />
        {pages.map((page) => {
          const isActive = activePageId === page.id;
          return (
            <div
              key={page.id}
              className={`group flex h-9 shrink-0 items-center rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-slate-200 text-slate-950'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPage(page.id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex h-full items-center gap-1.5 rounded-l-lg py-1 pl-3 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-950"
              >
                <span className="grid h-4 w-4 place-items-center rounded border border-current">
                  <span className="h-1.5 w-1.5 rounded-sm bg-current" />
                </span>
                <span>{page.title}</span>
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeletePage(page.id)}
                  aria-label={`删除${page.title}`}
                  title={`删除${page.title}`}
                  className={`mr-1 grid h-7 w-7 place-items-center rounded-md outline-none transition hover:bg-slate-300 focus-visible:ring-2 focus-visible:ring-slate-950 ${
                    isActive
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <button type="button" onClick={onAddPage} aria-label="添加新页面" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-950"><Plus className="h-4 w-4" /></button>
      </nav>

      {activeTab === 'pins' ? (
        <div className="min-h-0 flex-1 overflow-hidden"><PinterestGallery compact onSelectPin={(url, title) => onAddImage(url, title)} /></div>
      ) : activeTab === 'plugins' ? (
        <section className="flex min-h-0 flex-1 flex-col">
          <header className="flex min-h-14 shrink-0 items-center border-b border-slate-100 px-4"><h2 className="text-base font-bold text-slate-950">XC AI Clipper</h2></header>
          <div className="flex flex-1 items-center justify-center px-6 pb-20 text-center">
            <div>
              <ChromeMark />
              <p className="mt-5 text-sm font-medium leading-6 text-slate-800">安装 XC AI Clipper，一键收集网页灵感图</p>
              <button type="button" onClick={() => window.open('https://chromewebstore.google.com/', '_blank', 'noopener,noreferrer')} className="mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950">前往安装</button>
            </div>
          </div>
        </section>
      ) : activeTab === 'assets' ? (
        editingMaterial ? (
          <section className="relative min-h-0 flex-1 overflow-hidden">
            <MaterialEditor
              key={editingMaterial.id}
              compact
              initial={editingMaterial}
              onBack={() => setEditingMaterial(null)}
              onSaved={upsertMaterial}
              onDeleted={(id) => {
                setMaterials((current) => current.filter((item) => item.id !== id));
                setEditingMaterial(null);
              }}
              onAddToConversation={(record) => {
                upsertMaterial(record);
                void onAddMaterialToAgent(record);
                setEditingMaterial(null);
              }}
            />
          </section>
        ) : (
        <section className="min-h-0 flex-1 overflow-y-auto">
          <header className="border-b border-slate-200 px-4 pt-4">
            <h2 className="text-base font-black text-slate-950">我的素材</h2>
            <div className="mt-3 flex gap-5 overflow-x-auto">
              {materialTabs.map(({ kind, label }) => <button key={kind} type="button" onClick={() => setMaterialKind(kind)} className={`relative min-h-10 shrink-0 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950 ${materialKind === kind ? 'text-slate-950 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-slate-950' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
            </div>
          </header>

          <div className="space-y-3 p-3">
            <button type="button" onClick={() => setEditingMaterial(createMaterialDraft(materialKind))} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 outline-none transition hover:border-slate-500 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-950"><span className="grid h-4 w-4 place-items-center rounded-full bg-lime-300 text-[0.65rem] text-slate-900">+</span>{materialKind === 'brand' ? '创建品牌套件' : `创建${materialTabs.find((item) => item.kind === materialKind)?.label || '素材'}`}</button>

            {visibleMaterials.map((material) => {
              const Icon = materialIcon[material.kind];
              const preview = [...material.logos, ...material.references, ...material.files].find((file) => file.type.startsWith('image/'));
              return (
                <button key={material.id} type="button" onClick={() => setEditingMaterial(material)} className="group flex min-h-28 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left outline-none transition hover:border-slate-400 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-slate-950">
                  <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">{preview ? <img src={preview.dataUrl} alt="" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-slate-400" />}</span>
                  <span className="min-w-0 flex-1 self-start pt-1"><span className="block truncate text-sm font-semibold text-slate-950">{material.name || '未命名'}</span><span className="mt-1 block text-xs text-slate-400">{material.guide || '素材套件'}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              );
            })}

            {visibleMaterials.length === 0 && <p className="px-4 py-8 text-center text-xs leading-5 text-slate-400">还没有这类素材，创建后会显示在这里。</p>}
          </div>
        </section>)
      ) : (
        <section className="min-h-0 flex-1 overflow-y-auto">
          <header className="flex min-h-14 items-center justify-between px-4"><h2 className="text-base font-black text-slate-950">参考</h2><button type="button" aria-label="筛选参考素材" className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-950"><SlidersHorizontal className="h-4 w-4" /></button></header>
          <div className="grid grid-cols-2 gap-3 px-3 pb-4">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex aspect-square flex-col items-center justify-center rounded-xl bg-slate-100 text-slate-500 outline-none transition hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-950"><Plus className="h-6 w-6" /><span className="sr-only">添加参考素材</span></button>
            {allAssets.map((asset) => (
              <article
                key={asset.id}
                draggable
                onDragStart={(event) => handleAssetDragStart(event, asset)}
                onDragEnd={handleAssetDragEnd}
                className="group relative cursor-grab overflow-hidden rounded-xl bg-white text-left outline-none transition hover:shadow-md focus-within:ring-2 focus-within:ring-slate-950 active:cursor-grabbing"
                title="拖到画布，或添加到对话"
              >
                <div className="relative overflow-hidden rounded-xl bg-slate-100">
                  <img src={asset.url} alt={asset.title} loading="lazy" draggable={false} className="aspect-[3/4] w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" />
                  <button
                    type="button"
                    onClick={() => void onAttachToAgent(asset.url, asset.title)}
                    className="absolute inset-x-2 bottom-2 flex min-h-9 translate-y-1 items-center justify-center gap-1.5 rounded-lg bg-white/95 px-2 text-xs font-semibold text-slate-950 opacity-0 shadow-sm backdrop-blur outline-none transition duration-150 hover:bg-white focus:translate-y-0 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-white group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                    aria-label={`将${asset.title}添加到对话`}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    添加到对话
                  </button>
                </div>
                <p className="line-clamp-2 px-1 py-2 text-xs leading-4 text-slate-500">{asset.title}</p>
              </article>
            ))}
          </div>
          {allAssets.length === 0 && <div className="mx-3 mt-2 grid min-h-44 place-items-center rounded-xl border border-dashed border-slate-300 px-5 text-center"><div><ImageIcon className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-xs leading-5 text-slate-400">这里会同步当前项目上传和生成的图片。</p></div></div>}
        </section>
      )}
    </aside>
  );
};

const ToolButton: React.FC<{ active: boolean; label: string; onClick: () => void; children: React.ReactNode }> = ({ active, label, onClick, children }) => (
  <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active} className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950 ${active ? 'bg-violet-100 text-violet-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>{children}</button>
);

export default ReferencePanel;
