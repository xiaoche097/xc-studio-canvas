import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ScanFace, X } from 'lucide-react';

const OPTIONS = [
  { value: '', label: '跟随参考', description: '以你上传的人物外貌为准', badge: '默认' },
  ...['欧美／欧洲', '东亚', '南亚', '中东', '非洲', '拉美'].map(label => ({ value: `${label}面孔方向`, label: `${label}方向`, description: '结合参考中的个体特征创作', badge: '' })),
];

export default function FaceDirectionPicker({ value = '', onChange }: { value?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const options = OPTIONS.some(option => option.value === value) ? OPTIONS : [...OPTIONS, { value, label: '已有方向', description: value, badge: '' }];
  useEffect(() => {
    if (!open) return;
    dialog.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      if (event.key === 'Tab') {
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('keydown', keyboard); trigger.current?.focus(); };
  }, [open]);
  return <div className="vm-field"><span>面孔方向</span>
    <button ref={trigger} type="button" className="vm-preset-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setDraft(value); setOpen(true); }}><ScanFace size={18} /><b>{options.find(option => option.value === value)?.label}</b><ChevronDown size={15} /></button>
    <small className="vm-caption">选择新模特的外貌方向，默认跟随参考。</small>
    {open && <div className="vm-picker-overlay" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}><div ref={dialog} className="vm-picker-dialog vm-face-direction-dialog" role="dialog" aria-modal="true" aria-label="选择面孔方向">
      <header><h2>选择面孔方向</h2><button type="button" className="vm-icon" aria-label="关闭面孔方向选择" onClick={() => setOpen(false)}><X size={17} /></button></header>
      <div className="vm-picker-body"><p className="vm-caption">指定新虚构模特的创作方向，仍保留参考中的个体差异。</p>
        <div className="vm-face-direction-grid" role="radiogroup" aria-label="面孔方向选项" onKeyDown={event => {
          if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const index = options.findIndex(option => option.value === draft);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + options.length) % options.length;
          setDraft(options[next].value);
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
        }}>{options.map(option => <button key={option.value} type="button" role="radio" tabIndex={draft === option.value ? 0 : -1} aria-checked={draft === option.value} className={`vm-face-direction-option ${draft === option.value ? 'selected' : ''}`} onClick={() => setDraft(option.value)}><span><b>{option.label}</b>{draft === option.value ? <Check size={17} /> : option.badge && <em>{option.badge}</em>}</span><small>{option.description}</small></button>)}</div>
      </div>
      <footer><button type="button" onClick={() => setOpen(false)}>取消</button><button type="button" className="vm-primary" onClick={() => { onChange(draft); setOpen(false); }}>确认</button></footer>
    </div></div>}
  </div>;
}
