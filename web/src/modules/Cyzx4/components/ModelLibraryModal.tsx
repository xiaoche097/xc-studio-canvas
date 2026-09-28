import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, Edit2, ImagePlus, Loader2, Maximize2, Plus, Star, Trash2, UserCircle2, X } from 'lucide-react';
import { getModelReferenceImages, getPrimaryModelReference, ModelItem, ModelReferenceImage, ModelReferenceKind } from '../services/modelLibrary';
import { compressImage } from '../utils/apiHelpers';

interface ModelLibraryModalProps {
  selectedModelId: string | null;
  models: ModelItem[];
  onSelectModel: (model: ModelItem | null) => void;
  onCreateModel: (name: string, file: File) => Promise<void>;
  onUpdateModel: (model: ModelItem) => Promise<void>;
  onRenameModel: (model: ModelItem, newName: string) => Promise<void>;
  onDeleteModel: (id: string) => Promise<void>;
  onClose: () => void;
}

const MAX_REFERENCE_COUNT = 12;

export const ModelLibraryModal: React.FC<ModelLibraryModalProps> = ({ selectedModelId, models, onSelectModel, onCreateModel, onUpdateModel, onRenameModel, onDeleteModel, onClose }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profileModelId, setProfileModelId] = useState<string | null>(null);
  const [referenceFilter, setReferenceFilter] = useState<'all' | ModelReferenceKind>('all');
  const [referenceMutation, setReferenceMutation] = useState(false);
  const [previewReference, setPreviewReference] = useState<ModelReferenceImage | null>(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const hairstyleInputRef = useRef<HTMLInputElement>(null);

  const profileModel = useMemo(() => models.find((model) => model.id === profileModelId) || null, [models, profileModelId]);
  const profileReferences = profileModel ? getModelReferenceImages(profileModel) : [];
  const selectedProfileReference = profileReferences.find((reference) => reference.id === selectedReferenceId)
    || (profileModel ? getPrimaryModelReference(profileModel) : null);
  const visibleReferences = referenceFilter === 'all' ? profileReferences : profileReferences.filter((reference) => reference.kind === referenceFilter);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      setError('单张图片不能超过 5MB');
      return;
    }
    setFile(selected);
    setError('');
  };

  const handleCreate = async () => {
    if (!name.trim() || !file || saving) return;
    setSaving(true);
    setError('');
    try {
      await onCreateModel(name.trim(), file);
      setIsCreating(false);
      setName('');
      setFile(null);
    } catch (err: any) {
      setError(err?.message || '创建模特失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (model: ModelItem) => {
    const newName = window.prompt('请输入新的模特名称', model.name)?.trim();
    if (!newName || newName === model.name) return;
    try {
      await onRenameModel(model, newName);
    } catch {
      alert('重命名失败');
    }
  };

  const addReferenceImages = async (model: ModelItem, kind: ModelReferenceKind, files: FileList | null) => {
    if (!files?.length || referenceMutation) return;
    const existing = getModelReferenceImages(model);
    const accepted = Array.from(files).filter((candidate) => candidate.type.startsWith('image/') && candidate.size <= 5 * 1024 * 1024).slice(0, Math.max(0, MAX_REFERENCE_COUNT - existing.length));
    if (!accepted.length) {
      setError(existing.length >= MAX_REFERENCE_COUNT ? `每个模特最多保存 ${MAX_REFERENCE_COUNT} 张参考图` : '请选择 5MB 以内的图片');
      return;
    }

    setReferenceMutation(true);
    setError('');
    try {
      const created = await Promise.all(accepted.map(async (candidate, index): Promise<ModelReferenceImage> => {
        const compressed = await compressImage(candidate, 2048, 0.92);
        const sameKindCount = existing.filter((reference) => reference.kind === kind).length;
        return {
          id: crypto.randomUUID(),
          label: `${kind === 'face' ? '面部特写' : '发型参考'} ${sameKindCount + index + 1}`,
          kind,
          preview: `data:${compressed.mime};base64,${compressed.base64}`,
          base64: compressed.base64,
          mime: compressed.mime,
          createdAt: Date.now() + index,
        };
      }));
      await onUpdateModel({ ...model, references: [...existing, ...created], updatedAt: Date.now() });
    } catch (err: any) {
      setError(err?.message || '参考图保存失败');
    } finally {
      setReferenceMutation(false);
    }
  };

  const setPrimaryReference = async (model: ModelItem, reference: ModelReferenceImage) => {
    if (referenceMutation) return;
    setSelectedReferenceId(reference.id);
    setReferenceMutation(true);
    try {
      await onUpdateModel({ ...model, preview: reference.preview, base64: reference.base64, mime: reference.mime, references: getModelReferenceImages(model), primaryReferenceId: reference.id, updatedAt: Date.now() });
    } catch (err: any) {
      setError(err?.message || '生成主参考保存失败');
    } finally {
      setReferenceMutation(false);
    }
  };

  const chooseProfileModel = async () => {
    if (!profileModel || referenceMutation) return;
    const reference = selectedProfileReference || getPrimaryModelReference(profileModel);
    const selectedModel = reference
      ? { ...profileModel, preview: reference.preview, base64: reference.base64, mime: reference.mime, primaryReferenceId: reference.id, references: getModelReferenceImages(profileModel), updatedAt: Date.now() }
      : profileModel;
    try {
      if (reference && profileModel.primaryReferenceId !== reference.id) await onUpdateModel(selectedModel);
      onSelectModel(selectedModel);
      onClose();
    } catch (err: any) {
      setError(err?.message || '模特参考选择失败');
    }
  };

  const removeReference = async (model: ModelItem, referenceId: string) => {
    const references = getModelReferenceImages(model);
    if (references.length <= 1 || referenceMutation) return;
    const nextReferences = references.filter((reference) => reference.id !== referenceId);
    const nextPrimary = nextReferences.find((reference) => reference.id === model.primaryReferenceId) || nextReferences[0];
    setSelectedReferenceId(nextPrimary.id);
    setReferenceMutation(true);
    try {
      await onUpdateModel({ ...model, preview: nextPrimary.preview, base64: nextPrimary.base64, mime: nextPrimary.mime, references: nextReferences, primaryReferenceId: nextPrimary.id, updatedAt: Date.now() });
    } finally {
      setReferenceMutation(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#10203a]/60 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/60 bg-white shadow-2xl dark:border-white/10 dark:bg-[#15191f]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-5 sm:px-6">
          <div className="flex items-center gap-2"><UserCircle2 className="h-5 w-5 text-[#ed6d46]" /><h2 className="text-base font-black">模特库（固定 / 自定义）</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted" aria-label="关闭"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#f0d8c9] bg-[#fff8f3] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-black text-[#17243c]">一个模特档案，可保存多张面部特写与不同发型参考</p><p className="mt-1 text-xs leading-5 text-[#718198]">点击模特卡片进入档案详情；生成时会共同使用这些图片锁定同一人物身份。</p></div>
            <button type="button" onClick={() => setIsCreating((value) => !value)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ed6d46] px-4 text-xs font-black text-white hover:bg-[#d8552e]"><Plus className="h-4 w-4" />新建自定义模特</button>
          </div>

          {isCreating && (
            <div className="mb-6 grid gap-3 rounded-2xl border border-[#d9e5f1] bg-[#f8fbff] p-4 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end">
              <label className="text-xs font-black text-pastel-muted">模特名称<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm text-pastel-text" placeholder="如：夏日阳光欧美模特" /></label>
              <label className="text-xs font-black text-pastel-muted">首张面部参考<button type="button" onClick={() => fileInputRef.current?.click()} className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-[#b9c9dc] bg-white px-3 text-sm font-bold text-[#405773]">{file ? file.name : '点击选择清晰面部图片'}</button><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} /></label>
              <button type="button" onClick={handleCreate} disabled={!name.trim() || !file || saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] px-5 text-xs font-black text-white disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />}保存模特</button>
              {error && <p className="text-xs font-bold text-red-600 sm:col-span-3">{error}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <button type="button" onClick={() => { onSelectModel(null); onClose(); }} className={`group relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 transition ${!selectedModelId ? 'border-[#ed6d46] bg-[#fff8f3]' : 'border-dashed border-pastel-border bg-pastel-bg/50 hover:border-[#efb49d]'}`}>
              <UserCircle2 className="h-10 w-10 text-pastel-muted" /><span className="mt-2 text-xs font-black">自动匹配模特</span><span className="mt-1 text-[0.68rem] text-pastel-muted">根据场景自动匹配</span>
              {!selectedModelId && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#ed6d46] text-white"><Check className="h-3.5 w-3.5" /></span>}
            </button>

            {models.map((model) => {
              const isSelected = selectedModelId === model.id;
              const referenceCount = getModelReferenceImages(model).length;
              return (
                <article key={model.id} className={`group relative overflow-hidden rounded-2xl border-2 transition ${isSelected ? 'border-[#ed6d46] shadow-md' : 'border-pastel-border bg-pastel-bg hover:border-[#efb49d]'}`}>
                  <button type="button" onClick={() => { setReferenceFilter('all'); setSelectedReferenceId(getPrimaryModelReference(model)?.id || null); setProfileModelId(model.id); }} className="block w-full text-left">
                    <div className="aspect-[3/4] w-full overflow-hidden bg-slate-100"><img src={model.preview} alt={model.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /></div>
                    <div className="p-3"><strong className="block truncate text-xs font-black text-[#17243c]">{model.name}</strong><div className="mt-1 flex items-center justify-between gap-2"><span className="text-[0.62rem] font-bold text-[#718198]">{referenceCount} 张身份参考</span>{model.isOfficial && <span className="rounded bg-[#fff0e8] px-1.5 py-0.5 text-[0.62rem] font-bold text-[#d8552e]">官方固定</span>}</div></div>
                  </button>
                  {isSelected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#ed6d46] text-white shadow"><Check className="h-3.5 w-3.5" /></span>}
                  {!model.isOfficial && <div className="flex border-t border-pastel-border bg-white"><button type="button" onClick={() => handleRename(model)} className="flex min-h-9 flex-1 items-center justify-center gap-1 text-[0.68rem] font-bold text-pastel-muted hover:text-[#ed6d46]"><Edit2 className="h-3 w-3" />重命名</button><button type="button" onClick={() => onDeleteModel(model.id)} className="flex min-h-9 w-9 items-center justify-center text-pastel-muted hover:text-red-500" aria-label={`删除${model.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div>}
                </article>
              );
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-pastel-border px-5 py-4"><span className="text-xs text-pastel-muted">已选：{models.find((model) => model.id === selectedModelId)?.name || '无（自动匹配）'}</span><button type="button" onClick={onClose} className="rounded-xl border border-pastel-border px-5 py-2 text-xs font-black text-pastel-muted hover:bg-pastel-bg">完成</button></footer>

        {profileModel && (
          <div className="absolute inset-0 z-20 flex flex-col bg-[#f5f7fa] dark:bg-[#101318]">
            <header className="flex min-h-16 items-center justify-between border-b border-pastel-border bg-white px-4 dark:bg-[#15191f] sm:px-6">
              <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setProfileModelId(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted"><ArrowLeft className="h-5 w-5" /></button><div className="min-w-0"><h3 className="truncate text-base font-black">{profileModel.name}</h3><p className="mt-0.5 text-xs text-pastel-muted">同一模特的面部身份与发型参考档案</p></div></div>
              <button type="button" onClick={() => void chooseProfileModel()} disabled={referenceMutation} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#17243c] px-4 text-xs font-black text-white disabled:opacity-50"><Check className="h-4 w-4" />使用已选参考</button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <aside className="rounded-2xl border border-pastel-border bg-white p-4 dark:bg-[#15191f]"><div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-100"><img src={selectedProfileReference?.preview || profileModel.preview} alt={`${profileModel.name}当前生成参考`} className="h-full w-full object-cover" /><span className="absolute bottom-2 left-2 rounded-full bg-[#ed6d46] px-2.5 py-1 text-[0.62rem] font-black text-white shadow">当前生成主参考</span></div><h4 className="mt-3 text-sm font-black">{profileModel.name}</h4><p className="mt-1 text-[0.68rem] leading-5 text-pastel-muted">当前共 {profileReferences.length} 张身份参考。点击右侧图片可选择生成时优先使用的面部或发型，其余图片继续辅助锁定同一人物。</p><div className="mt-3 rounded-xl bg-[#fff8f3] px-3 py-2 text-[0.65rem] leading-5 text-[#a95331]">建议至少包含：正面、左右 45°、侧面，以及常用发型的清晰近景。</div></aside>

                <section className="min-w-0 rounded-2xl border border-pastel-border bg-white p-4 dark:bg-[#15191f]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex rounded-xl bg-pastel-bg p-1">{([{ id: 'all', label: '全部' }, { id: 'face', label: '面部特写' }, { id: 'hairstyle', label: '发型参考' }] as const).map((tab) => <button key={tab.id} type="button" onClick={() => setReferenceFilter(tab.id)} className={`rounded-lg px-3 py-2 text-xs font-black transition ${referenceFilter === tab.id ? 'bg-white text-[#17243c] shadow-sm dark:bg-white/10 dark:text-white' : 'text-pastel-muted'}`}>{tab.label}</button>)}</div><div className="flex gap-2"><button type="button" onClick={() => faceInputRef.current?.click()} disabled={referenceMutation || profileReferences.length >= MAX_REFERENCE_COUNT} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-pastel-border px-3 text-xs font-black text-[#405773] disabled:opacity-40"><Camera className="h-4 w-4" />添加面部特写</button><button type="button" onClick={() => hairstyleInputRef.current?.click()} disabled={referenceMutation || profileReferences.length >= MAX_REFERENCE_COUNT} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[#ed6d46] px-3 text-xs font-black text-white disabled:opacity-40"><ImagePlus className="h-4 w-4" />添加发型参考</button></div></div>
                  <input ref={faceInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void addReferenceImages(profileModel, 'face', event.target.files); event.target.value = ''; }} />
                  <input ref={hairstyleInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void addReferenceImages(profileModel, 'hairstyle', event.target.files); event.target.value = ''; }} />

                  {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p>}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {visibleReferences.map((reference) => {
                      const isPrimary = reference.id === selectedProfileReference?.id;
                      return <article key={reference.id} className={`group overflow-hidden rounded-xl border-2 bg-pastel-bg transition ${isPrimary ? 'border-[#ed6d46] shadow-md' : 'border-pastel-border hover:border-[#efb49d]'}`}><div role="button" tabIndex={0} onClick={() => void setPrimaryReference(profileModel, reference)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void setPrimaryReference(profileModel, reference); } }} className="relative aspect-square cursor-pointer overflow-hidden bg-slate-100" aria-label={`选择${reference.label}作为生成主参考`}><img src={reference.preview} alt={reference.label} className="h-full w-full object-cover" />{isPrimary && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[#ed6d46] px-2 py-1 text-[0.6rem] font-black text-white"><Check className="h-3 w-3" />已选</span>}<button type="button" onClick={(event) => { event.stopPropagation(); setPreviewReference(reference); }} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70" aria-label={`放大查看${reference.label}`}><Maximize2 className="h-3.5 w-3.5" /></button><div className="absolute inset-x-0 bottom-0 flex translate-y-full justify-end gap-1 bg-[#17243c]/75 p-2 transition group-hover:translate-y-0">{!isPrimary && <button type="button" onClick={(event) => { event.stopPropagation(); void setPrimaryReference(profileModel, reference); }} className="flex h-8 items-center gap-1 rounded-lg bg-white px-2 text-[0.62rem] font-black text-[#17243c]" aria-label="设为生成主参考"><Star className="h-3.5 w-3.5" />选用</button>}<button type="button" onClick={(event) => { event.stopPropagation(); void removeReference(profileModel, reference.id); }} disabled={profileReferences.length <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-500 disabled:opacity-40" aria-label="删除参考图"><Trash2 className="h-3.5 w-3.5" /></button></div></div><div className="flex items-center justify-between gap-2 p-2.5"><div className="min-w-0"><strong className="block truncate text-[0.7rem] font-black">{reference.label}</strong><span className="mt-1 inline-block rounded bg-white px-1.5 py-0.5 text-[0.6rem] font-bold text-pastel-muted">{reference.kind === 'face' ? '面部特写' : '发型参考'}</span></div>{isPrimary && <span className="shrink-0 text-[0.6rem] font-black text-[#ed6d46]">生成优先</span>}</div></article>;
                    })}
                  </div>
                  {!visibleReferences.length && <div className="mt-4 flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-pastel-border bg-pastel-bg/50 text-center"><ImagePlus className="h-8 w-8 text-pastel-muted" /><p className="mt-3 text-xs font-black">这个分类还没有参考图</p></div>}
                </section>
              </div>
            </div>
          </div>
        )}

        {previewReference && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[#07101f]/92 p-4 backdrop-blur-sm sm:p-8" onClick={() => setPreviewReference(null)}>
            <button type="button" onClick={() => setPreviewReference(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 sm:right-7 sm:top-7" aria-label="关闭大图"><X className="h-5 w-5" /></button>
            <div className="flex max-h-full max-w-6xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
              <img src={previewReference.preview} alt={previewReference.label} className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl" />
              <div className="mt-3 rounded-full bg-black/45 px-4 py-2 text-center text-xs font-bold text-white backdrop-blur-sm">{previewReference.label} · {previewReference.kind === 'face' ? '面部特写' : '发型参考'}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
