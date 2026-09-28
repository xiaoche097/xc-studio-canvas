import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { MODEL_PRESETS, ModelPresetKind, presetBackground } from '../constants/virtualModelPresets';

export const togglePresetSelection = (selected: string[], label: string, maximum = 15) => selected.includes(label) ? selected.filter(item => item !== label) : selected.length < maximum ? [...selected, label] : selected;

export default function ModelPresetPicker({ kind, value, onChange, childOnly, values, onMultiChange }: { kind: ModelPresetKind; value: string; onChange?: (value: string) => void; childOnly?: boolean; values?: string[]; onMultiChange?: (values: string[]) => void }) {
  const multiple = kind === 'actions';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(values || [value]);
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const group = MODEL_PRESETS[kind];
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
      if (event.key === 'Tab') {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    (dialog.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') || dialog.current?.querySelector<HTMLButtonElement>('button'))?.focus();
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('keydown', close); trigger.current?.focus(); };
  }, [open]);
  return <div className="vm-field"><span className="vm-picker-label">{group.title.replace('选择', '')}{multiple && <em>{values?.length || 0} 张</em>}</span>
    {multiple && <small className="vm-caption">每个动作生成 1 张，最多选择 15 项。</small>}
    <button ref={trigger} type="button" className="vm-preset-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setDraft(values ? [...values] : [value]); setOpen(true); }}><b>{multiple ? values?.join('、') || '请选择动作' : value}</b><ChevronDown size={15} /></button>
    {open && <div className="vm-picker-overlay" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}><div ref={dialog} className="vm-picker-dialog" role="dialog" aria-modal="true" aria-label={group.title}>
      <header><h2>{group.title}</h2><button type="button" className="vm-icon" aria-label="关闭选择弹窗" onClick={() => setOpen(false)}><X size={17} /></button></header>
      <div className="vm-picker-body"><div className="vm-picker-grid" role={multiple ? 'group' : 'radiogroup'} aria-label={group.title}>{group.items.map(item => {
        const selected = draft.includes(item.label);
        const disabled = kind === 'age' && childOnly !== undefined && Boolean(item.child) !== childOnly || multiple && !selected && draft.length >= 15;
        return <button type="button" key={item.label} role={multiple ? 'checkbox' : 'radio'} aria-checked={selected} disabled={disabled} title={disabled ? multiple ? '最多选择15项' : '请先选择对应的儿童或成人类型' : item.description} className={`vm-preset-card ${selected ? 'selected' : ''}`} onClick={() => setDraft(multiple ? togglePresetSelection(draft, item.label) : [item.label])}>
          <div className="vm-preset-image" role="img" aria-label={`${item.label}参考图`} style={presetBackground(kind, item.label)} />{selected && <span className="vm-preset-check"><Check size={14} /></span>}<b>{item.label}</b>{kind !== 'person' && kind !== 'actions' && <small>{item.description}</small>}
        </button>;
      })}</div><p className="vm-caption">示例仅供选项展示，不参与生成。{kind === 'scope' ? 'Agent 将按所选景别安排构图；试戴部位可进一步选择耳、手、颈或脚。' : kind === 'actions' ? '动作参考只控制姿态，Agent 会结合人物、年龄和景别进行适配。' : kind === 'photography' ? '灰模展示背景与光影氛围，成片保留真实人物面孔。' : kind === 'person' ? '按选角方向、风格与年龄创建新的虚拟人物。' : kind === 'style' ? '按所选妆发、造型和摄影氛围，适配人物的性别与年龄。' : childOnly !== undefined ? '年龄气质与人物类型联动；切换儿童／成人请先调整人物类型。' : '保留上传人物的实际年龄，将所选气质适配到原人物。'}</p></div>
      <footer>{multiple && <span className="vm-picker-count" aria-live="polite">已选 {draft.length} 项，最多 15 项</span>}<button type="button" onClick={() => setOpen(false)}>取消</button><button type="button" className="vm-primary" disabled={!draft.length} onClick={() => { if (multiple) onMultiChange?.([...draft]); else onChange?.(draft[0]); setOpen(false); }}>确认</button></footer>
    </div></div>}
  </div>;
}
