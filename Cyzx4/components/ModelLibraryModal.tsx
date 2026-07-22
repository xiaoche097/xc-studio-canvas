import React, { useRef, useState } from 'react';
import { Check, Edit2, Loader2, Plus, Trash2, UserCircle2, X } from 'lucide-react';
import { ModelItem, OFFICIAL_MODELS } from '../services/modelLibrary';
import { compressImage } from '../utils/apiHelpers';

interface ModelLibraryModalProps {
  selectedModelId: string | null;
  models: ModelItem[];
  onSelectModel: (model: ModelItem | null) => void;
  onCreateModel: (name: string, file: File) => Promise<void>;
  onRenameModel: (model: ModelItem, newName: string) => Promise<void>;
  onDeleteModel: (id: string) => Promise<void>;
  onClose: () => void;
}

export const ModelLibraryModal: React.FC<ModelLibraryModalProps> = ({
  selectedModelId,
  models,
  onSelectModel,
  onCreateModel,
  onRenameModel,
  onDeleteModel,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      setError('单张图片不能超过 5MB');
      return;
    }
    setFile(selected);
    setError('');
    try {
      const compressed = await compressImage(selected, 2048, 0.92);
      setPreview(`data:${compressed.mime};base64,${compressed.base64}`);
    } catch {
      setError('图片读取失败');
    }
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
      setPreview('');
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

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[#10203a]/60 p-3 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.5rem] border border-white/60 bg-white shadow-2xl dark:border-white/10 dark:bg-[#15191f]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-5 sm:px-6">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5 text-[#ed6d46]" />
            <h2 className="text-base font-black">模特库 (固定/自定义)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#f0d8c9] bg-[#fff8f3] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#17243c]">固定模特可维持生成人物脸部、动作姿势与画面一致性</p>
              <p className="mt-1 text-xs leading-5 text-[#718198]">点击选中模特后，生成的场景图将基于所选模特呈现一致外观。</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating((val) => !val)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ed6d46] px-4 text-xs font-black text-white hover:bg-[#d8552e]"
            >
              <Plus className="h-4 w-4" />上传自定义模特
            </button>
          </div>

          {isCreating && (
            <div className="mb-6 grid gap-3 rounded-2xl border border-[#d9e5f1] bg-[#f8fbff] p-4 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end">
              <label className="text-xs font-black text-pastel-muted">
                模特名称
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm text-pastel-text"
                  placeholder="如：夏日阳光欧美模特"
                />
              </label>
              <label className="text-xs font-black text-pastel-muted">
                模特原图
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-[#b9c9dc] bg-white px-3 text-sm font-bold text-[#405773]"
                >
                  {file ? file.name : '点击选择模特图片'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || !file || saving}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] px-5 text-xs font-black text-white disabled:opacity-40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}保存模特
              </button>
              {error && <p className="text-xs font-bold text-red-600 sm:col-span-3">{error}</p>}
            </div>
          )}

          {/* Model List Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {/* Clear / Auto Match */}
            <button
              type="button"
              onClick={() => {
                onSelectModel(null);
                onClose();
              }}
              className={`group relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 transition ${
                !selectedModelId ? 'border-[#ed6d46] bg-[#fff8f3]' : 'border-dashed border-pastel-border bg-pastel-bg/50 hover:border-[#efb49d]'
              }`}
            >
              <UserCircle2 className="h-10 w-10 text-pastel-muted" />
              <span className="mt-2 text-xs font-black">自动匹配模特</span>
              <span className="mt-1 text-[0.68rem] text-pastel-muted">根据场景自动匹配</span>
              {!selectedModelId && (
                <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#ed6d46] text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>

            {models.map((model) => {
              const isSelected = selectedModelId === model.id;
              return (
                <article
                  key={model.id}
                  className={`group relative overflow-hidden rounded-2xl border-2 transition ${
                    isSelected ? 'border-[#ed6d46] shadow-md' : 'border-pastel-border bg-pastel-bg'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectModel(model);
                      onClose();
                    }}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-slate-100">
                      <img src={model.preview} alt={model.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <strong className="block truncate text-xs font-black text-[#17243c]">
                        {model.name}
                      </strong>
                      {model.isOfficial && (
                        <span className="mt-1 inline-block rounded bg-[#fff0e8] px-1.5 py-0.5 text-[0.62rem] font-bold text-[#d8552e]">
                          官方固定
                        </span>
                      )}
                    </div>
                  </button>

                  {isSelected && (
                    <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#ed6d46] text-white shadow">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}

                  {!model.isOfficial && (
                    <div className="flex border-t border-pastel-border bg-white">
                      <button
                        type="button"
                        onClick={() => handleRename(model)}
                        className="flex min-h-9 flex-1 items-center justify-center gap-1 text-[0.68rem] font-bold text-pastel-muted hover:text-[#ed6d46]"
                      >
                        <Edit2 className="h-3 w-3" /> 重命名
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteModel(model.id)}
                        className="flex min-h-9 w-9 items-center justify-center text-pastel-muted hover:text-red-500"
                        aria-label={`删除${model.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-pastel-border px-5 py-4">
          <span className="text-xs text-pastel-muted">已选: {models.find((m) => m.id === selectedModelId)?.name || '无 (自动匹配)'}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-pastel-border px-5 py-2 text-xs font-black text-pastel-muted hover:bg-pastel-bg"
          >
            完成
          </button>
        </footer>
      </section>
    </div>
  );
};
