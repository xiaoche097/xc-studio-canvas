import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Download, ImagePlus, Loader2, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Upload, UserRound, X } from 'lucide-react';
import { generateText, generateImageToImage, compressImage } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import { downloadImageFile, fetchImageBlob } from '../utils/imageDownload';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import ModelPresetPicker from './ModelPresetPicker';
import { isChildModel, loadPresetReference, modelAdaptationBrief, modelRequestSettings } from '../constants/virtualModelPresets';
import './VirtualModelTab.css';

type Settings = {
  source: 'ai' | 'reference'; person: string; style: string; age: string; scope: string; part: string;
  actions: string[]; photography: string; ratio: AspectRatio; resolution: ImageResolution; notes: string; model: string;
};
type Reference = { base64: string; mimeType: string; preview: string; name: string };
type Result = { action: string; image?: string; error?: string };
type RecordItem = { id: string; created: number; settings: Settings; references: Reference[]; step: number; plan: string; results: Result[]; error: string };
const MAX_REFERENCES = 5;
const STEPS = ['输入', '分析中', '确认规划', '生成中', '完成'];
const defaults = (): Settings => ({ source: 'ai', person: '中国女生', style: '自然感', age: '年轻感', scope: '全身模特', part: '耳部', actions: ['自然站立'], photography: '电商白底', ratio: AspectRatio.PORTRAIT_2_3, resolution: ImageResolution.RES_2K, notes: '', model: 'gemini-3.1-flash-image-preview' });
const newRecord = (): RecordItem => ({ id: crypto.randomUUID(), created: Date.now(), settings: defaults(), references: [], step: 0, plan: '', results: [], error: '' });
const errorText = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试';
const toReference = async (file: File): Promise<Reference> => {
  const image = await compressImage(file);
  return { base64: image.base64, mimeType: image.mime, preview: `data:${image.mime};base64,${image.base64}`, name: file.name };
};
const imageReference = async (url: string) => {
  const blob = await fetchImageBlob(url);
  return toReference(new File([blob], 'identity', { type: blob.type }));
};

export default function VirtualModelTab() {
  const [records, setRecords] = useState<RecordItem[]>(() => [newRecord()]);
  const [activeId, setActiveId] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [uploadBusy, setUploadBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const controllers = useRef(new Map<string, AbortController>());
  const current = records.find(item => item.id === activeId) || records[0];
  const s = current.settings;
  const busy = current.step === 1 || current.step === 3;
  const update = (id: string, patch: Partial<RecordItem>) => setRecords(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  const change = (patch: Partial<Settings>) => {
    if (patch.person) patch.age = isChildModel(patch.person) ? '儿童感' : s.age === '儿童感' ? '年轻感' : s.age;
    update(current.id, { settings: { ...s, ...patch }, step: 0, plan: '', results: [], error: '' });
  };
  useEffect(() => () => controllers.current.forEach(controller => controller.abort()), []);
  useEffect(() => {
    if (!preview) return;
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(undefined); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [preview]);

  const upload = async (files: File[]) => {
    if (busy || uploadLock.current || !files.length) return;
    const id = current.id;
    if (current.references.length + files.length > MAX_REFERENCES) { update(id, { error: `最多上传5张参考图，当前还可添加${MAX_REFERENCES - current.references.length}张。请重新选择。` }); return; }
    uploadLock.current = true;
    setUploadBusy(true);
    try {
      const added: Reference[] = [];
      const errors: string[] = [];
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { errors.push(`${file.name}：仅支持 JPG / PNG / WEBP，单张不超过10MB`); continue; }
        try { added.push(await toReference(file)); } catch { errors.push(`${file.name}：图片读取失败，请重新上传`); }
      }
      if (added.length) setRecords(items => items.map(item => item.id === id ? { ...item, references: [...item.references, ...added].slice(0, MAX_REFERENCES), step: 0, plan: '', results: [], error: errors.join('；') } : item));
      else update(id, { error: errors.join('；') });
    } catch (error) { update(id, { error: errorText(error) }); }
    finally { uploadLock.current = false; setUploadBusy(false); }
  };
  useEffect(() => {
    const listener = (event: ClipboardEvent) => {
      if (event.defaultPrevented || !root.current?.getClientRects().length || s.source !== 'reference' || busy || uploadBusy) return;
      if ((event.target as HTMLElement)?.closest('input, textarea, [contenteditable=true]')) return;
      const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
      if (files.length) { event.preventDefault(); void upload(files); }
    };
    window.addEventListener('paste', listener);
    return () => window.removeEventListener('paste', listener);
  });

  const analyze = async () => {
    if (controllers.current.has(current.id) || uploadBusy) return;
    if (!s.actions.length) { update(current.id, { error: '请至少选择一个动作。' }); return; }
    if (s.source === 'reference' && !current.references.length) { update(current.id, { error: '请先上传参考人像。' }); return; }
    const snapshot = current;
    const controller = new AbortController(); controllers.current.set(snapshot.id, controller);
    update(snapshot.id, { step: 1, error: '', results: [] });
    try {
      const identityReferences = s.source === 'reference' ? snapshot.references : await Promise.all([loadPresetReference('person', s.person), loadPresetReference('style', s.style), loadPresetReference('age', s.age)]);
      const photographyReferences = await Promise.all([
        loadPresetReference('scope', s.scope), loadPresetReference('photography', s.photography),
        ...s.actions.map(action => loadPresetReference('actions', action)),
      ]);
      const references = [...identityReferences, ...photographyReferences];
      const roleMap = s.source === 'reference' ? `图1至图${identityReferences.length}为用户参考人像，第1张为主参考，其余用于补足同人物角度和细节。` : '图1=人物类型选角示例；图2=风格示例；图3=年龄气质示例。';
      if (controller.signal.aborted) return;
      const plan = await generateText(references,
        `你是商业模特选角与摄影策划 Agent。必须观察全部参考图，并根据可见视觉特征与用户配置做交叉适配，不可只拼接标签。${roleMap}图${identityReferences.length + 1}=取景范围示例（试戴部位按配置中的具体部位）；图${identityReferences.length + 2}=摄影风格示例；图${identityReferences.length + 3}起依次为动作参考：${s.actions.join('、')}。摄影和动作示例不得改变所选人物性别、年龄与身份。\n${modelAdaptationBrief(s)}\n完整设置：${JSON.stringify(modelRequestSettings(s))}\n用中文按以下标题输出简洁可执行方案：1.逐图分析与参考适配依据（每张用户参考中的特征、角度、差异及采用依据，给出简短结论） 2.最终人物设定（基于图像可见证据描述年龄气质、外貌、发型、肤色、服装，锁定跨图身份，不虚构精确年龄） 3.造型延续与冲突协调（妆发、表情、服装和多图差异处理） 4.各动作与取景（逐项覆盖所选动作，部位范围必须准确） 5.光线背景与画面规格。只输出可检查的方案和适配结论，不声称已生成图片。`);
      if (!controller.signal.aborted) {
        if (!plan.trim()) throw new Error('分析未返回方案，请重试');
        update(snapshot.id, { plan: plan.trim(), step: 2 });
      }
    } catch (error) { if (!controller.signal.aborted) update(snapshot.id, { step: 0, error: errorText(error) }); }
    finally { if (controllers.current.get(snapshot.id) === controller) controllers.current.delete(snapshot.id); }
  };

  const generate = async (retry = false) => {
    if (controllers.current.has(current.id) || !current.plan.trim()) return;
    if (s.source === 'reference' && !current.references.length) { update(current.id, { error: '请先上传参考人像并重新分析。' }); return; }
    const snapshot = current;
    const controller = new AbortController(); controllers.current.set(snapshot.id, controller);
    let results: Result[] = retry ? snapshot.results.map(item => ({ ...item })) : s.actions.map(action => ({ action }));
    update(snapshot.id, { step: 3, error: '', results });
    try {
      // First successful image anchors the same identity for subsequent poses.
      const userReferences = snapshot.settings.source === 'reference' ? snapshot.references : [];
      let identity: Reference | undefined;
      if (!userReferences.length) {
        const existing = results.find(item => item.image)?.image;
        if (existing) identity = await imageReference(existing);
      }
      const firstImageReferences = identity || userReferences.length ? [] : await Promise.all([loadPresetReference('person', snapshot.settings.person), loadPresetReference('style', snapshot.settings.style), loadPresetReference('age', snapshot.settings.age)]);
      const photographyReference = await loadPresetReference('photography', snapshot.settings.photography);
      for (let index = 0; index < results.length; index++) {
        if (controller.signal.aborted) break;
        if (results[index].image) continue;
        try {
          const actionReference = await loadPresetReference('actions', results[index].action);
          if (controller.signal.aborted) break;
          const identityInputs = userReferences.length ? userReferences : identity ? [identity] : firstImageReferences;
          const identityInstructions = userReferences.length ? `Images 1 through ${userReferences.length} are user portraits. Image 1 is the primary identity and outfit anchor; use ALL other user images to verify angles and details of that same person. Follow the approved conflict resolution; never blend different people. Preserve visible age, facial features, hair, skin and styling from the user images. No person, style or age presets apply. Image ${userReferences.length + 1} is lighting/background ONLY and image ${userReferences.length + 2} is pose ONLY; never copy their face, gender, age or clothes.` : identity ? 'Image 1 is the ONLY identity anchor. Preserve exactly the same person, skin tone, hair, age and outfit. Image 2 is lighting/background ONLY; image 3 is pose ONLY. Never copy their gender, age, face or clothes.' : 'Image 1 casting direction, image 2 styling/mood ONLY, image 3 age appearance ONLY, image 4 lighting/background ONLY, image 5 pose ONLY. Create ONE new fictional identity from the approved plan. Never copy the gender or face of style/age/photography/action references. Never blend multiple people into a collage.';
          const [image] = await generateImageToImage([...identityInputs, photographyReference, actionReference],
            `Create one photorealistic commercial model photograph, no collage, no text or watermark. ${identityInstructions} Natural accurate anatomy. Children must be appropriately dressed in everyday clothing and age-appropriate poses.\n${modelAdaptationBrief(snapshot.settings)}\nApproved plan: ${snapshot.plan}\nSettings: ${JSON.stringify(modelRequestSettings(snapshot.settings))}\nTHIS IMAGE ONLY: ${results[index].action}. Frame exactly: ${snapshot.settings.scope}${snapshot.settings.scope === '试戴部位' ? `（${snapshot.settings.part} ONLY）` : ''}. Framing overrides the full-body pose reference; translate action to a local angle or gesture for body-part and face crops. Do not render other selected actions in this image.`,
            { aspectRatio: snapshot.settings.ratio, resolution: snapshot.settings.resolution, modelId: snapshot.settings.model, hasModelRef: Boolean(identity || userReferences.length), signal: controller.signal });
          if (controller.signal.aborted) break;
          if (!image) throw new Error('未返回图片，请重试');
          results[index] = { action: results[index].action, image };
          if (!identity && !userReferences.length) {
            identity = await imageReference(image);
          }
        } catch (error) {
          if (controller.signal.aborted) break;
          if (results[index].image) throw new Error(`成片已保留，但无法读取人物参考，后续生成已暂停：${errorText(error)}`);
          results[index] = { action: results[index].action, error: errorText(error) };
        }
        update(snapshot.id, { results: [...results] });
      }
      results = results.map(item => item.image || item.error ? item : { ...item, error: '已取消，可重试' });
      update(snapshot.id, { step: 4, results: [...results] });
      const images = results.flatMap(item => item.image ? [item.image] : []);
      if (images.length) {
        const saved = await saveGeneratedProject({ type: 'MODEL', generated: images, original: userReferences.map(reference => reference.preview), prompt: snapshot.plan, params: { ...modelRequestSettings(snapshot.settings), source: 'virtual-model', modelSource: snapshot.settings.source, referenceCount: userReferences.length, subType: 'virtual_model' } });
        if (!saved) update(snapshot.id, { error: '图片已生成，但资产保存失败，请先下载图片。' });
      }
    } catch (error) { update(snapshot.id, { step: 4, results: results.map(item => item.image ? item : { ...item, error: errorText(error) }), error: errorText(error) }); }
    finally { if (controllers.current.get(snapshot.id) === controller) controllers.current.delete(snapshot.id); }
  };
  const cancel = () => {
    controllers.current.get(current.id)?.abort();
    if (current.step === 1) { controllers.current.delete(current.id); update(current.id, { step: 0, error: '分析已取消' }); }
  };
  const addTask = () => {
    if (records.length >= 20) return;
    const item = newRecord(); setRecords(items => [item, ...items]); setActiveId(item.id);
  };
  const select = (label: string, key: keyof Settings, values: string[]) => <label className="vm-field">{label}<select value={String(s[key])} onChange={event => change({ [key]: event.target.value })}>{values.map(value => <option key={value}>{value}</option>)}</select></label>;
  const download = async (item: Result) => {
    try { if (item.image) await downloadImageFile(item.image, `虚拟模特-${item.action}-${Date.now()}.png`); }
    catch (error) { update(current.id, { error: `下载失败：${errorText(error)}` }); }
  };

  return <div className="vm-studio" ref={root}>
    <header className="vm-hero">
      <div className="vm-eyebrow"><Sparkles size={16} /> AI 虚拟模特 <span>上新</span></div>
      <h1>让理想模特，成为你的专属形象</h1>
      <p>AI 创建人物或使用参考人像，自由选择动作与部位，生成统一风格的商业摄影。</p>
      <div className="vm-steps">{STEPS.map((label, index) => <React.Fragment key={label}>{index > 0 && <i />}<div className={current.step === index ? 'active' : current.step > index ? 'done' : ''}><b>{current.step > index ? <Check size={14} /> : index + 1}</b><span>{label}</span></div></React.Fragment>)}</div>
    </header>
    <div className={`vm-layout ${collapsed ? 'vm-collapsed' : ''}`}>
      <aside className="vm-history vm-card">
        <div className="vm-heading"><h2>{collapsed ? '记录' : '生成记录'}</h2><button className="vm-icon" aria-label={collapsed ? '展开生成记录' : '收起生成记录'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
        {!collapsed && <><p className="vm-caption">当前会话最多保留 20 项 · 可同时生成</p><button className="vm-primary" onClick={addTask} disabled={records.length >= 20}><Plus size={17} /> 新开任务</button>
          <div className="vm-records">{records.map(item => <div key={item.id} className={`vm-record ${item.id === current.id ? 'selected' : ''}`}>
            <button onClick={() => setActiveId(item.id)} className="vm-record-main"><div className="vm-thumb">{item.results.find(result => result.image)?.image || item.references.length ? <img alt="任务缩略图" src={item.results.find(result => result.image)?.image || item.references[0]?.preview} /> : <UserRound size={36} />}</div><strong>{item.step === 0 ? '编辑中' : item.step === 4 && item.results.some(result => !result.image) ? '待重试' : STEPS[item.step]}</strong><div className="vm-record-info"><b>{item.settings.scope}</b><span>{new Date(item.created).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {item.results.filter(result => result.image).length} 张成片</span></div></button>
            {records.length > 1 && item.step !== 1 && item.step !== 3 && <button className="vm-remove" aria-label="删除此任务记录" onClick={() => setRecords(items => items.filter(record => record.id !== item.id))}><X size={13} /></button>}
          </div>)}</div></>}
      </aside>
      <div className="vm-controls">
        <fieldset disabled={busy || uploadBusy}>
          <section className="vm-card"><div className="vm-section-title"><span><UserRound size={20} /></span><div><h2>模特来源</h2><p>AI 自动创建身份，或沿用参考人像</p></div></div>
            <div className="vm-tabs">{(['ai', 'reference'] as const).map(source => <button key={source} aria-pressed={s.source === source} className={s.source === source ? 'selected' : ''} onClick={() => change({ source })}>{source === 'ai' ? <Sparkles size={15} /> : <ImagePlus size={15} />}{source === 'ai' ? 'AI 自动生成' : '参考人像'}</button>)}</div>
            {s.source === 'ai' ? <ModelPresetPicker kind="person" value={s.person} onChange={person => change({ person })} /> : <>
              <div className="vm-heading"><h3>参考人像</h3><span className="vm-caption" aria-live="polite">{current.references.length}/5</span></div>
              <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void upload(Array.from(event.target.files || [])); event.target.value = ''; }} />
              <button className="vm-upload" disabled={current.references.length >= MAX_REFERENCES} onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}><Upload size={25} /><b>{uploadBusy ? '正在处理图片…' : current.references.length >= MAX_REFERENCES ? '已添加5张参考图' : '拖拽、点击或 Ctrl+V 粘贴图片'}</b><small>最多5张 · JPG / JPEG / PNG / WEBP · 单张 ≤ 10MB</small></button>
              {current.references.length > 0 && <div className="vm-reference-grid">{current.references.map((reference, index) => <article key={`${index}-${reference.name}`}><img src={reference.preview} alt={`参考人像${index + 1}：${reference.name}`} /><button type="button" className="vm-reference-remove" aria-label={`移除参考图${index + 1}`} onClick={() => update(current.id, { references: current.references.filter((_, position) => position !== index), step: 0, plan: '', results: [], error: '' })}><X size={13} /></button><button type="button" className="vm-reference-primary" disabled={index === 0} onClick={() => update(current.id, { references: [reference, ...current.references.filter((_, position) => position !== index)], step: 0, plan: '', results: [], error: '' })}>{index === 0 ? '主参考' : '设为主参考'}</button></article>)}</div>}
              <p className="vm-caption">建议上传同一人物的不同角度。第1张为主参考，其余用于补充细节。</p>
            </>}
            {s.source === 'ai' && <><ModelPresetPicker kind="style" value={s.style} onChange={style => change({ style })} /><ModelPresetPicker kind="age" value={s.age} onChange={age => change({ age })} childOnly={isChildModel(s.person)} /></>}
            <p className="vm-adaptation-note"><Sparkles size={14} />{s.source === 'reference' ? 'Agent 将逐张分析参考人像，保留人物特征、年龄气质与造型，再适配拍摄范围。' : 'Agent 将结合参考图，适配人物、妆发、年龄与拍摄范围。'}</p>
          </section>
          <section className="vm-card"><div className="vm-section-title"><span><Camera size={20} /></span><div><h2>摄影控制</h2><p>取景、动作与画面规格</p></div></div>
            <ModelPresetPicker kind="scope" value={s.scope} onChange={scope => change({ scope })} />
            {s.scope === '试戴部位' && select('具体部位', 'part', ['耳部', '手部', '颈部', '脚部'])}
            <ModelPresetPicker kind="actions" value={s.actions[0] || ''} values={s.actions} onMultiChange={actions => change({ actions })} />
            <div className="vm-pair"><ModelPresetPicker kind="photography" value={s.photography} onChange={photography => change({ photography })} /><label className="vm-field">图片比例<select value={s.ratio} onChange={event => change({ ratio: event.target.value as AspectRatio })}>{[AspectRatio.PORTRAIT_2_3, ...Object.values(AspectRatio).filter(ratio => ratio !== AspectRatio.PORTRAIT_2_3)].map(ratio => { const [width, height] = ratio.split(':').map(Number); return <option key={ratio} value={ratio}>{ratio} {width === height ? '方版' : width < height ? '竖版' : '横版'}</option>; })}</select></label></div>
            {select('分辨率', 'resolution', ['1K', '2K', '4K'])}
            <label className="vm-field">补充说明（选填）<textarea value={s.notes} maxLength={2000} onChange={event => change({ notes: event.target.value })} placeholder="例如：米白色简约穿搭，自然妆容，保持人物身份和光线一致…" rows={3} /></label>
            <details className="vm-advanced"><summary>高级设置</summary><label className="vm-field">生成模型<select value={s.model} onChange={event => change({ model: event.target.value })}><option value="gemini-3.1-flash-image-preview">Banana 2</option><option value="gemini-3-pro-image-preview">Banana Pro</option><option value="gpt-image-2">GPT Image 2</option><option value="qwen-image-3.0-pro">千问3.0pro</option></select></label></details>
          </section>
        </fieldset>
        {current.error && <div className="vm-error" role="alert">{current.error}</div>}
        {busy ? <button className="vm-primary" onClick={cancel}><Loader2 className="vm-spin" size={17} />{current.step === 1 ? '分析中' : `生成中 ${current.results.filter(result => result.image || result.error).length}/${current.results.length}`} · 取消</button> : <button className="vm-primary" disabled={uploadBusy || !s.actions.length || (s.source === 'reference' && !current.references.length)} onClick={analyze}><Sparkles size={18} />{current.plan ? '重新分析信息' : '分析信息，生成模特方案'}</button>}
        <p className="vm-caption vm-cost">预计生成 {s.actions.length} 张 · 费用按所选模型与实际生成计费</p>
      </div>
      <section className={`vm-output ${current.step === 0 ? 'vm-empty' : 'vm-card'}`}>
        {current.step === 0 ? <div className="vm-empty-content"><span><UserRound size={36} /></span><h2>从人物身份开始，打造专属模特</h2><p>在左侧选择模特来源与摄影参数，点击「分析信息」。<br />确认人物与拍摄方案后，AI 将按所选动作逐张生成。</p><div className="vm-tags">全身 / 半身 / 面部 · 手部 / 耳部 / 脚部 / 颈部</div></div> : current.step === 1 ? <div className="vm-empty-content"><Loader2 size={34} className="vm-spin" /><h2>正在规划人物与摄影方案</h2><p>分析人物特征、动作、取景与光线…</p></div> : <>
          <div className="vm-section-title"><span><Sparkles size={20} /></span><div><h2>{current.step === 2 ? '确认模特与摄影方案' : '生成结果'}</h2><p>{current.step === 2 ? '可编辑方案，确认后开始生成' : `${current.results.filter(result => result.image).length} / ${s.actions.length} 张已完成`}</p></div></div>
          {current.step === 2 ? <><textarea aria-label="模特与摄影方案" className="vm-plan" value={current.plan} onChange={event => update(current.id, { plan: event.target.value })} /><div className="vm-tags">{s.scope} · {s.ratio} · {s.resolution} · {s.actions.length} 张</div><button className="vm-primary" disabled={!current.plan.trim()} onClick={() => void generate()}><Sparkles size={18} />确认方案，生成 {s.actions.length} 张</button></> : <>
            <details className="vm-approved"><summary>查看已确认方案</summary><p>{current.plan}</p></details>
            <div className="vm-results">{current.results.map((item, index) => <article key={item.action}><div className="vm-result-image" style={{ aspectRatio: s.ratio.replace(':', '/') }}>{item.image ? <button aria-label={`放大${item.action}`} onClick={() => setPreview(item.image)}><img src={item.image} alt={item.action} /></button> : item.error ? <p role="alert">{item.error}</p> : <div><Loader2 size={24} className="vm-spin" /><p>{index === current.results.findIndex(result => !result.image && !result.error) ? '正在生成' : '等待生成'}</p></div>}</div><footer><b>{item.action}</b>{item.image && <button aria-label={`下载${item.action}`} onClick={() => void download(item)}><Download size={17} /></button>}</footer></article>)}</div>
            {current.step === 4 && current.results.some(item => !item.image) && <button className="vm-primary" onClick={() => void generate(true)}>重试未完成图片</button>}
          </>}
        </>}
      </section>
    </div>
    {preview && <div className="vm-lightbox" role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setPreview(undefined)}><button autoFocus aria-label="关闭预览" onClick={() => setPreview(undefined)}><X /></button><img src={preview} alt="虚拟模特生成结果" onClick={event => event.stopPropagation()} /></div>}
  </div>;
}
