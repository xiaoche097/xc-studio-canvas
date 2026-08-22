import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  FileText,
  Image as ImageIcon,
  MoreHorizontal,
  Package,
  Palette,
  Plus,
  Shapes,
  Trash2,
  Type,
  Upload,
  UserRound,
} from 'lucide-react';
import {
  deleteMaterial,
  listMaterials,
  saveMaterial,
  type MaterialFile,
  type MaterialKind,
  type MaterialRecord,
} from '../../../services/materialLibrary';

interface MaterialLibraryProps {
  onAddToConversation?: (material: MaterialRecord) => void;
}

type UploadTarget = 'files' | 'logos' | 'references';

const kindMeta: Record<MaterialKind, {
  tab: string;
  headline: string;
  description: string;
  action: string;
  accent: string;
}> = {
  brand: {
    tab: '品牌套件',
    headline: '保持品牌风格一致',
    description: '创建品牌套件，让生成结果保持一致 — 可将其关联到项目，或在对话中随时提及。',
    action: '创建品牌套件',
    accent: '#dfff58',
  },
  character: {
    tab: '角色',
    headline: '保持角色一致性',
    description: '创建角色素材，在生成中复用身份、外观和风格。',
    action: '创建角色',
    accent: '#2789ff',
  },
  product: {
    tab: '产品',
    headline: '保持产品辨识度',
    description: '创建产品素材，在每次生成中保持一致的产品视觉、细节和品牌风格。',
    action: '创建产品',
    accent: '#252525',
  },
  custom: {
    tab: '自定义',
    headline: '构建你的素材库',
    description: '创建自定义素材，保存可复用的参考、风格或视觉元素，供未来项目使用。',
    action: '创建自定义素材',
    accent: '#0a4633',
  },
};

const createDraft = (kind: MaterialKind): MaterialRecord => {
  const now = Date.now();
  return {
    id: `material-${now}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: '未命名',
    guide: '',
    files: [],
    logos: [],
    references: [],
    colors: [],
    fonts: [],
    createdAt: now,
    updatedAt: now,
  };
};

const readFile = (file: File): Promise<MaterialFile> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({
    id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: file.type || 'application/octet-stream',
    dataUrl: String(reader.result || ''),
  });
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const PreviewArtwork: React.FC<{ kind: MaterialKind; compact?: boolean; material?: MaterialRecord }> = ({ kind, compact = false, material }) => {
  const image = [...(material?.logos || []), ...(material?.references || []), ...(material?.files || [])]
    .find((file) => file.type.startsWith('image/'));
  const colors = material?.colors?.length ? material.colors : ['#dcff5b', '#214503', '#e5b674', '#78c6c2'];

  if (image) {
    return <img src={image.dataUrl} alt="" className="h-full w-full object-cover" />;
  }

  if (kind === 'brand') {
    return (
      <div className="grid h-full w-full grid-cols-[1fr_1.55fr] gap-1 bg-[#efefed] p-2">
        <div className="flex flex-col gap-1">
          <div className="grid flex-1 place-items-center bg-[#ddff62] font-serif text-[clamp(2rem,5vw,4.5rem)] text-[#182006]">Aa.</div>
          <div className="grid h-1/4 grid-cols-4 gap-px">{colors.slice(0, 4).map((color) => <span key={color} style={{ backgroundColor: color }} />)}</div>
        </div>
        <div className="grid grid-rows-[1.4fr_0.6fr] gap-1">
          <div className="relative overflow-hidden bg-[#173f35] p-3 text-left text-xs font-black leading-tight text-[#e7ff76]">
            Where ideas<br />meet your<br />creativity.
            <Shapes className="absolute bottom-3 right-3 h-6 w-6 text-[#e7ff76]" />
          </div>
          <div className="grid grid-cols-[1.6fr_0.7fr] gap-1"><span className="grid place-items-center bg-white text-sm font-black">XC Visual</span><span className="grid place-items-center bg-[#dfff58]"><Shapes className="h-6 w-6" /></span></div>
        </div>
      </div>
    );
  }

  if (kind === 'character') {
    return (
      <div className="grid h-full grid-cols-[0.7fr_1.4fr] gap-1 bg-[#edf4ff] p-2">
        <div className="bg-[#2789ff] p-3 text-left font-black leading-none text-white">Character<span className="mt-2 block text-[0.55rem] font-semibold leading-tight">Same identity,<br />every scene.</span></div>
        <div className="grid grid-rows-[1.5fr_0.5fr] gap-1"><div className="grid place-items-center bg-gradient-to-br from-[#d9eeff] to-[#a7c6e8]"><UserRound className="h-16 w-16 text-[#23466a]" /></div><div className="grid grid-cols-3 gap-1">{[0, 1, 2].map((item) => <span key={item} className="grid place-items-center bg-white"><UserRound className="h-7 w-7 text-slate-500" /></span>)}</div></div>
      </div>
    );
  }

  if (kind === 'product') {
    return (
      <div className="grid h-full grid-cols-[1fr_1fr_0.9fr] gap-1 bg-[#eceff1] p-2">
        <div className="grid grid-rows-2 gap-1"><span className="grid place-items-center bg-white"><Package className="h-12 w-12 text-slate-300" /></span><span className="grid place-items-center bg-slate-200"><Package className="h-10 w-10 text-slate-500" /></span></div>
        <span className="grid place-items-center bg-[#d9dde0]"><Package className="h-16 w-16 text-slate-600" /></span>
        <div className="grid grid-rows-[0.8fr_1.2fr] gap-1"><span className="bg-[#262626] p-2 text-left text-base font-black leading-none text-white">Product<span className="mt-2 block text-[0.5rem] font-semibold leading-tight">Recognizable in every result.</span></span><span className="grid place-items-center bg-white"><Package className="h-11 w-11 text-slate-300" /></span></div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[0.65fr_2fr] gap-1 bg-[#edf0eb] p-2">
      <div className="bg-[#073f2c] p-3 text-left font-black leading-none text-white">Custom<span className="mt-2 block text-[0.55rem] font-semibold leading-tight">Save media<br />and style assets.</span></div>
      <div className="grid grid-rows-[1.4fr_0.6fr] gap-1"><div className="bg-[linear-gradient(145deg,#d9d3b8,#e6a758_35%,#507f73_70%,#e9e4d6)]" /><div className="grid grid-cols-3 gap-1"><span className="grid place-items-center bg-white font-serif text-3xl">A</span><span className="grid place-items-center bg-white"><ImageIcon className="h-6 w-6" /></span><span className="grid place-items-center bg-white"><Palette className="h-6 w-6" /></span></div></div>
    </div>
  );
};

const MaterialEmptyState: React.FC<{ kind: MaterialKind; onCreate: () => void }> = ({ kind, onCreate }) => {
  const meta = kindMeta[kind];
  return (
    <div className="p-4 sm:p-5 lg:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={onCreate} className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white text-sm font-medium text-slate-500 outline-none transition hover:border-slate-500 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950">
          <Plus className="h-4 w-4" />{meta.action}
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">创建后，这里会显示可复用的{meta.tab}。</p>
    </div>
  );
};

const MaterialCard: React.FC<{ material: MaterialRecord; onOpen: () => void }> = ({ material, onOpen }) => (
  <button type="button" onClick={onOpen} className="group min-h-36 overflow-hidden rounded-lg border border-slate-200 bg-white text-left outline-none transition hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-950">
    <div className="h-24 overflow-hidden bg-slate-50"><PreviewArtwork kind={material.kind} compact material={material} /></div>
    <div className="flex items-center justify-between gap-3 px-4 py-3"><span className="truncate text-sm font-bold text-slate-900">{material.name || '未命名'}</span><span className="text-xs text-slate-400 transition group-hover:text-slate-700">编辑</span></div>
  </button>
);

const MaterialEditor: React.FC<{
  initial: MaterialRecord;
  onBack: () => void;
  onSaved: (record: MaterialRecord) => void;
  onDeleted: (id: string) => void;
  onAddToConversation?: (record: MaterialRecord) => void;
}> = ({ initial, onBack, onSaved, onDeleted, onAddToConversation }) => {
  const [draft, setDraft] = useState(initial);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>('files');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const patch = (next: Partial<MaterialRecord>) => setDraft((current) => ({ ...current, ...next, updatedAt: Date.now() }));

  const processFiles = async (incoming: FileList | File[], target: UploadTarget = uploadTarget) => {
    const files = Array.from(incoming).filter((file) => ['image/png', 'image/jpeg', 'application/pdf'].includes(file.type));
    const tooLarge = files.find((file) => file.size > 20 * 1024 * 1024);
    if (tooLarge) {
      setError(`${tooLarge.name} 超过 20MB`);
      return;
    }
    if (!files.length) {
      setError('仅支持 PNG、JPG 或 PDF');
      return;
    }
    setError('');
    const converted = await Promise.all(files.map(readFile));
    setDraft((current) => ({ ...current, [target]: [...current[target], ...converted], updatedAt: Date.now() }));
  };

  const openUpload = (target: UploadTarget) => {
    setUploadTarget(target);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleSave = async (): Promise<MaterialRecord> => {
    const record = { ...draft, name: draft.name.trim() || '未命名', updatedAt: Date.now() };
    await saveMaterial(record);
    setDraft(record);
    setSaved(true);
    onSaved(record);
    window.setTimeout(() => setSaved(false), 1600);
    return record;
  };

  const handleAdd = async () => {
    const record = await handleSave();
    onAddToConversation?.(record);
  };

  const removeFile = (target: UploadTarget, id: string) => patch({ [target]: draft[target].filter((file) => file.id !== id) });
  const editorTitle = initial.kind === 'brand' ? '品牌套件' : kindMeta[initial.kind].tab;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(event) => { if (event.target.files) void processFiles(event.target.files); event.target.value = ''; }} />
      <input ref={colorInputRef} type="color" className="sr-only" onChange={(event) => { if (!draft.colors.includes(event.target.value)) patch({ colors: [...draft.colors, event.target.value] }); }} />

      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-3 sm:px-5">
        <button type="button" onClick={onBack} aria-label="返回素材列表" className="grid h-12 w-12 place-items-center rounded-lg text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-950"><ArrowLeft className="h-4 w-4" /></button>
        <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} aria-label={`${editorTitle}名称`} className="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400" placeholder="未命名" />
        <button type="button" aria-label="更多操作" className="grid h-12 w-12 place-items-center rounded-lg text-slate-500 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-950"><MoreHorizontal className="h-4 w-4" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <button type="button" onClick={() => openUpload('files')} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setUploadTarget('files'); void processFiles(event.dataTransfer.files, 'files'); }} className="flex min-h-28 w-full items-center gap-4 rounded-lg border border-dashed border-[#E5E5E5] bg-slate-50 px-6 text-left text-slate-500 outline-none transition hover:border-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-950">
          <Upload className="h-5 w-5 shrink-0" />
          <span><span className="block text-sm font-semibold">拖拽或上传文件，或导入 URL</span><span className="mt-1 block text-xs text-slate-400">PNG、JPG、PDF · 最大 20MB</span></span>
        </button>
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        {draft.files.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{draft.files.map((file) => <FileChip key={file.id} file={file} onRemove={() => removeFile('files', file.id)} />)}</div>
        )}

        <section className="mt-7 border-y border-slate-200 py-6">
          <label className="text-sm font-bold text-slate-900">设计指南</label>
          <textarea value={draft.guide} onChange={(event) => patch({ guide: event.target.value })} className="mt-3 min-h-20 w-full resize-y rounded-lg border border-[#E5E5E5] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white" placeholder={`描述你的${editorTitle}设计指南…`} />
        </section>

        {(draft.kind === 'brand' || draft.kind === 'custom') && (
          <>
            <EditorRow label="Logo" icon={Shapes} onAdd={() => openUpload('logos')}>
              <FileStrip files={draft.logos} onRemove={(id) => removeFile('logos', id)} />
            </EditorRow>
            <EditorRow label="Color" icon={Palette} onAdd={() => colorInputRef.current?.click()}>
              {draft.colors.length > 0 && <div className="flex flex-wrap gap-2">{draft.colors.map((color) => <button key={color} type="button" onClick={() => patch({ colors: draft.colors.filter((item) => item !== color) })} aria-label={`删除颜色 ${color}`} className="h-10 w-10 rounded-full border-4 border-white shadow ring-1 ring-slate-200" style={{ backgroundColor: color }} />)}</div>}
            </EditorRow>
            <EditorRow label="Font" icon={Type} onAdd={() => patch({ fonts: [...draft.fonts, `字体 ${draft.fonts.length + 1}`] })}>
              {draft.fonts.length > 0 && <div className="flex flex-wrap gap-2">{draft.fonts.map((font) => <button key={font} type="button" onClick={() => patch({ fonts: draft.fonts.filter((item) => item !== font) })} className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold">Aa · {font}</button>)}</div>}
            </EditorRow>
          </>
        )}

        <EditorRow label={draft.kind === 'product' ? '产品图片' : draft.kind === 'character' ? '角色参考' : 'Reference'} icon={ImageIcon} onAdd={() => openUpload('references')}>
          <FileStrip files={draft.references} onRemove={(id) => removeFile('references', id)} />
        </EditorRow>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex min-h-16 items-center justify-between gap-3 border-t border-[#E5E5E5] bg-white px-4 sm:px-6 lg:left-auto lg:w-[calc(100%-0px)]">
        <button type="button" onClick={async () => { await deleteMaterial(draft.id); onDeleted(draft.id); }} className="grid h-12 w-12 place-items-center rounded-lg text-slate-400 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-600" aria-label="删除素材"><Trash2 className="h-4 w-4" /></button>
        <div className="flex gap-2">
          <button type="button" onClick={() => void handleSave()} className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950">{saved ? <span className="flex items-center gap-2"><Check className="h-4 w-4" />已保存</span> : '保存'}</button>
          <button type="button" onClick={() => void handleAdd()} className="min-h-12 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">添加到对话</button>
        </div>
      </div>
    </div>
  );
};

const EditorRow: React.FC<{ label: string; icon: React.ComponentType<{ className?: string }>; onAdd: () => void; children: React.ReactNode }> = ({ label, icon: Icon, onAdd, children }) => (
  <section className="border-b border-slate-200 py-5">
    <div className="flex min-h-11 items-center justify-between gap-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950"><Icon className="h-4 w-4 text-slate-400" />{label}</h3>
      <button type="button" onClick={onAdd} className="flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"><Plus className="h-4 w-4" />添加</button>
    </div>
    {children && <div className="mt-3">{children}</div>}
  </section>
);

const FileChip: React.FC<{ file: MaterialFile; onRemove: () => void }> = ({ file, onRemove }) => (
  <div className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
    {file.type.startsWith('image/') ? <img src={file.dataUrl} alt={file.name} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><FileText className="h-7 w-7 text-slate-400" /></span>}
    <button type="button" onClick={onRemove} aria-label={`删除 ${file.name}`} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg bg-slate-950/80 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
  </div>
);

const FileStrip: React.FC<{ files: MaterialFile[]; onRemove: (id: string) => void }> = ({ files, onRemove }) => files.length > 0 ? (
  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{files.map((file) => <FileChip key={file.id} file={file} onRemove={() => onRemove(file.id)} />)}</div>
) : null;

const MaterialLibrary: React.FC<MaterialLibraryProps> = ({ onAddToConversation }) => {
  const [activeKind, setActiveKind] = useState<MaterialKind>('brand');
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [editing, setEditing] = useState<MaterialRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listMaterials().then((records) => { if (active) setMaterials(records); }).catch(console.error).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => materials.filter((material) => material.kind === activeKind), [activeKind, materials]);

  const upsert = (record: MaterialRecord) => {
    setMaterials((current) => [record, ...current.filter((item) => item.id !== record.id)]);
  };

  if (editing) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden">
        <MaterialEditor
          key={editing.id}
          initial={editing}
          onBack={() => setEditing(null)}
          onSaved={upsert}
          onDeleted={(id) => { setMaterials((current) => current.filter((item) => item.id !== id)); setEditing(null); }}
          onAddToConversation={(record) => { upsert(record); onAddToConversation?.(record); }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <nav className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 px-3 sm:gap-3 sm:px-5" aria-label="我的素材分类">
        {(Object.keys(kindMeta) as MaterialKind[]).map((kind) => (
          <button key={kind} type="button" onClick={() => setActiveKind(kind)} className={`relative min-h-12 shrink-0 px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950 ${activeKind === kind ? 'text-slate-950 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-slate-950' : 'text-slate-400 hover:text-slate-700'}`}>{kindMeta[kind].tab}</button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="grid h-full place-items-center text-sm font-semibold text-slate-400">正在读取素材库…</div>
        ) : visible.length === 0 ? (
          <MaterialEmptyState kind={activeKind} onCreate={() => setEditing(createDraft(activeKind))} />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:p-8 2xl:grid-cols-3">
            <button type="button" onClick={() => setEditing(createDraft(activeKind))} className="flex min-h-36 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white text-sm font-medium text-slate-500 outline-none transition hover:border-slate-500 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"><Plus className="h-4 w-4" />{kindMeta[activeKind].action}</button>
            {visible.map((material) => <MaterialCard key={material.id} material={material} onOpen={() => setEditing(material)} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialLibrary;
