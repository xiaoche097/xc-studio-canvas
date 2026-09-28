import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Download, ImagePlus, Loader2, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Upload, UserRound, X } from 'lucide-react';
import { generateText, generateImageToImage, compressImage } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import { downloadImageFile, fetchImageBlob } from '../utils/imageDownload';
import { saveGeneratedProject } from '../../../services/projectHistoryService';
import ModelPresetPicker from './ModelPresetPicker';
import FaceDirectionPicker from './FaceDirectionPicker';
import { isChildModel, modelAdaptationBrief, modelRequestSettings } from '../constants/virtualModelPresets';
import './VirtualModelTab.css';
import { DEFAULT_MODEL_PERSON, modelCastingBrief, modelFaceDirection, modelVariationBrief } from '../constants/virtualModelCasting';
import { modelFraming, framingReviewPrompt, parseFramingReview } from '../constants/modelFraming';
import VirtualModelPlanCard from './VirtualModelPlanCard';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import { BASE_OUTFIT, NATURAL_CASTING, FACE_VIEWS, FACE_SHEET_LAYOUT, PLAN_FIELDS, ModelPlan, parseModelPlan, modelPlanPrompt, faceDirectionBrief, referenceDirection } from '../constants/virtualModelPlan';

type Settings = {
  faceDirection?: string; referenceMode?: 'single' | 'fusion'; fusionBias?: string; presentation?: string;
  source: 'ai' | 'reference'; person: string; style: string; age: string; scope: string; part: string;
  actions: string[]; photography: string; ratio: AspectRatio; resolution: ImageResolution; notes: string; model: string;
};
type Reference = { base64: string; mimeType: string; preview: string; name: string; group?: 'A' | 'B' };
type Result = { action: string; image?: string; rejectedImage?: string; checking?: boolean; error?: string };
type RecordItem = { id: string; created: number; settings: Settings; references: Reference[]; step: number; traits?: ModelPlan; plan: string; results: Result[]; error: string };
const MAX_REFERENCES = 5;
const STEPS = ['输入', '分析中', '确认规划', '生成中', '完成'];
const defaults = (): Settings => ({ source: 'ai', person: DEFAULT_MODEL_PERSON, style: '自然感', age: '年轻感', scope: '全身模特', part: '耳部', actions: ['自然站立'], photography: '电商白底', ratio: AspectRatio.PORTRAIT_2_3, resolution: ImageResolution.RES_2K, notes: '', model: 'gemini-3.1-flash-image-preview' });
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
  const isFaceSheet = s.scope === '面部模特' && s.presentation !== '单张肖像';
  const outputActions = isFaceSheet ? ['四宫格模卡'] : s.actions;
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
    if (!outputActions.length) { update(current.id, { error: '请至少选择一个动作。' }); return; }
    if (s.source === 'reference' && !current.references.length) { update(current.id, { error: '请先上传参考人像。' }); return; }
    if (s.source === 'reference' && s.referenceMode === 'fusion' && (!current.references.some(ref => ref.group === 'B') || !current.references.some(ref => ref.group !== 'B'))) { update(current.id, { error: '请分别指定人物 A 和人物 B 的参考图。' }); return; }
    const snapshot = current;
    const controller = new AbortController(); controllers.current.set(snapshot.id, controller);
    update(snapshot.id, { step: 1, error: '', results: [] });
    try {
      const references = s.source === 'reference' ? snapshot.references : [];
      const roleMap = s.source === 'reference' ? `${referenceDirection(s.referenceMode, s.fusionBias)} ${snapshot.references.map((ref, i) => `图${i + 1}=人物${s.referenceMode === 'fusion' ? ref.group || 'A' : 'A'}`).join('；')}` : '没有预设图片。人物、年龄、气质、取景、布光和动作全部按文字设置设计。';
      const variation = modelVariationBrief(s, snapshot.traits ? JSON.stringify(snapshot.traits) : undefined);
      if (controller.signal.aborted) return;
      const plan = await generateText(references,
        `你是写实虚拟模特设计师。观察参考，反推新人物设定。${roleMap} ${s.source === 'reference' ? '本次所有输入图片均为用户人物参考；取景、布光和动作只按文字设置，不存在其他示例图。' : '内置示例仅在界面展示，不参与分析或生成。'}${faceDirectionBrief(modelFaceDirection(s))}\n${modelCastingBrief(s)}\n${variation}\n${modelAdaptationBrief(s)}\n设置：${JSON.stringify(modelRequestSettings(s))}\n只输出JSON对象，必须包含这些字符串字段：${PLAN_FIELDS.map(([key, label]) => `${key}（${label}）`).join("、")}。用简短中文描述可执行的外貌特征。direction不超过80字，其他外貌字段每项20–45字，只写该字段的可见特征，不重复摄影规则、服装或生成指令。references逐图说明采用依据，融合时注明A/B来源。不确定的特征说明待确认。不要推理过程或Markdown。photography覆盖这些视角或动作：${(isFaceSheet ? FACE_VIEWS : outputActions).join("、")}。${isFaceSheet ? '仅生成1张2×2四宫格模卡，四格是同一个人的不同角度，不是四张独立图片。' : ''}。多视角保持同一个新人物、年龄、发型和布光条件，但允许眼神、眼睑张力、嘴角和碎发有轻微自然变化，不能将一致性写成表情僵硬固定。参考只提取个体特征，不把每项五官都美化成标准美人。不要默认精致底妆、玫瑰唇、雕塑波浪发或均匀发光皮肤。取景硬性要求：${modelFraming(s.scope, s.part, isFaceSheet)}自然试拍要求：${NATURAL_CASTING}统一着装：${BASE_OUTFIT}`);
      if (!controller.signal.aborted) {
        if (!plan.trim()) throw new Error('分析未返回方案，请重试');
        const traits = parseModelPlan(plan);
        update(snapshot.id, { traits, plan: modelPlanPrompt(traits, modelFaceDirection(s)), step: 2 });
      }
    } catch (error) { if (!controller.signal.aborted) update(snapshot.id, { step: 0, error: errorText(error) }); }
    finally { if (controllers.current.get(snapshot.id) === controller) controllers.current.delete(snapshot.id); }
  };

  const generate = async (retry = false) => {
    if (controllers.current.has(current.id) || !current.plan.trim()) return;
    if (s.source === 'reference' && !current.references.length) { update(current.id, { error: '请先上传参考人像并重新分析。' }); return; }
    const snapshot = current;
    const controller = new AbortController(); controllers.current.set(snapshot.id, controller);
    let results: Result[] = retry ? snapshot.results.map(item => ({ ...item })) : outputActions.map(action => ({ action }));
    update(snapshot.id, { step: 3, error: '', results });
    try {
      // First successful image anchors the same identity for subsequent poses.
      const userReferences = snapshot.settings.source === 'reference' ? snapshot.references : [];
      let identity: Reference | undefined;
      {
        const existing = results.find(item => item.image)?.image;
        if (existing) identity = await imageReference(existing);
      }
      for (let index = 0; index < results.length; index++) {
        if (controller.signal.aborted) break;
        if (results[index].image) continue;
        try {
          const identityInputs = identity ? [identity] : userReferences;
          const identityInstructions = identity ? 'Image 1 is the ONLY identity anchor: the already generated NEW fictional model. Preserve face, age, skin, hair and proportions. Any additional images, if present, are lighting and pose ONLY.' : userReferences.length ? `Images 1 through ${userReferences.length} are appearance inspirations, not outfits or identities to copy. ${referenceDirection(snapshot.settings.referenceMode, snapshot.settings.fusionBias)} ${userReferences.map((ref, i) => `Image ${i + 1}: person ${snapshot.settings.referenceMode === 'fusion' ? ref.group || 'A' : 'A'}`).join('; ')} Create ONE coherent NEW fictional model with visual resemblance. There are no other reference images. Derive facial structure only from these user references and the explicit requested appearance direction.` : 'No preset images are supplied. Follow the approved appearance. Use text settings for mood, age, lighting and pose.';
          const [image] = await generateImageToImage(identityInputs,
            `${modelFraming(snapshot.settings.scope, snapshot.settings.part, isFaceSheet)}\n${isFaceSheet ? FACE_SHEET_LAYOUT : 'Create one natural casting photograph, before beauty retouching, no collage, no text or watermark.'} ${identityInstructions} Natural accurate anatomy. Children must be appropriately dressed in everyday clothing and age-appropriate poses.\n${identity ? '保持已生成的新模特面孔，不重新融合，不恢复原始参考人物。' : ''}\nApproved appearance: ${snapshot.traits ? modelPlanPrompt(snapshot.traits, modelFaceDirection(snapshot.settings)) : snapshot.plan + '\n' + NATURAL_CASTING}\n${faceDirectionBrief(modelFaceDirection(snapshot.settings))}\n${modelAdaptationBrief(snapshot.settings)}\n${modelCastingBrief(snapshot.settings)}\nMANDATORY OUTFIT: ${BASE_OUTFIT}\nTHIS IMAGE ONLY: ${results[index].action}. ${snapshot.settings.scope === '面部模特' && snapshot.settings.presentation !== '单张肖像' ? 'Keep the same identity and lighting setup while allowing subtle, relaxed microexpression and hair movement between exposures.' : ''} Frame exactly: ${snapshot.settings.scope}${snapshot.settings.scope === '试戴部位' ? `（${snapshot.settings.part} ONLY）` : ''}. Framing overrides the full-body pose reference; translate action to a local angle or gesture for body-part and face crops. ${isFaceSheet ? '' : 'Do not render other selected actions in this image.'}\n${modelFraming(snapshot.settings.scope, snapshot.settings.part, isFaceSheet)}`,
            { aspectRatio: snapshot.settings.ratio, resolution: snapshot.settings.resolution, modelId: snapshot.settings.model, hasModelRef: Boolean(identity || userReferences.length), signal: controller.signal });
          if (controller.signal.aborted) break;
          if (!image) throw new Error('未返回图片，请重试');
          results[index] = { action: results[index].action, rejectedImage: image, checking: true };
          update(snapshot.id, { results: [...results] });
          const generatedReference = await imageReference(image);
          const review = parseFramingReview(await generateText([generatedReference], framingReviewPrompt(snapshot.settings.scope, snapshot.settings.part, isFaceSheet)));
          if (controller.signal.aborted) break;
          if (!review.pass) {
            results[index] = { action: results[index].action, rejectedImage: image, error: `取景不合格：${review.reason}。请重试。` };
            update(snapshot.id, { results: [...results] });
            continue;
          }
          results[index] = { action: results[index].action, image };
          if (!identity) {
            identity = generatedReference;
          }
        } catch (error) {
          if (controller.signal.aborted) break;
          if (results[index].image) throw new Error(`成片已保留，但无法读取人物参考，后续生成已暂停：${errorText(error)}`);
          results[index] = { action: results[index].action, rejectedImage: results[index].rejectedImage, error: results[index].rejectedImage ? `取景检查未完成：${errorText(error)}。可下载待检查图片或重试。` : errorText(error) };
        }
        update(snapshot.id, { results: [...results] });
      }
      results = results.map(item => item.image || item.error ? item : { ...item, checking: false, error: '已取消，可重试' });
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
  const select = (label: string, key: keyof Settings, values: string[]) => <label className="vm-field">{label}<select value={String(s[key] ?? values[0])} onChange={event => change({ [key]: event.target.value })}>{values.map(value => <option key={value}>{value}</option>)}</select></label>;
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
          <section className="vm-card"><div className="vm-section-title"><span><UserRound size={20} /></span><div><h2>模特来源</h2><p>参考人物特征，创建新的写实模特</p></div></div>
            <div className="vm-tabs">{(['ai', 'reference'] as const).map(source => <button key={source} aria-pressed={s.source === source} className={s.source === source ? 'selected' : ''} onClick={() => change({ source })}>{source === 'ai' ? <Sparkles size={15} /> : <ImagePlus size={15} />}{source === 'ai' ? 'AI 自动生成' : '参考人像'}</button>)}</div>
            {s.source === 'ai' ? <ModelPresetPicker kind="person" value={s.person} onChange={person => change({ person })} /> : <>
              <div className="vm-tabs">{(['single', 'fusion'] as const).map(referenceMode => <button key={referenceMode} aria-pressed={(s.referenceMode || 'single') === referenceMode} className={(s.referenceMode || 'single') === referenceMode ? 'selected' : ''} onClick={() => change({ referenceMode })}>{referenceMode === 'single' ? '单人物参考' : '双参考融合'}</button>)}</div>
              {s.referenceMode === 'fusion' && select('融合倾向', 'fusionBias', ['均衡', '偏 A', '偏 B'])}<FaceDirectionPicker value={s.faceDirection} onChange={faceDirection => change({ faceDirection })} />
              <div className="vm-heading"><h3>参考人像</h3><span className="vm-caption" aria-live="polite">{current.references.length}/5</span></div>
              <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void upload(Array.from(event.target.files || [])); event.target.value = ''; }} />
              <button className="vm-upload" disabled={current.references.length >= MAX_REFERENCES} onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}><Upload size={25} /><b>{uploadBusy ? '正在处理图片…' : current.references.length >= MAX_REFERENCES ? '已添加5张参考图' : '拖拽、点击或 Ctrl+V 粘贴图片'}</b><small>最多5张 · JPG / JPEG / PNG / WEBP · 单张 ≤ 10MB</small></button>
              {current.references.length > 0 && <div className="vm-reference-grid">{current.references.map((reference, index) => <article key={`${index}-${reference.name}`}><img src={reference.preview} alt={`参考人像${index + 1}：${reference.name}`} /><button type="button" className="vm-reference-remove" aria-label={`移除参考图${index + 1}`} onClick={() => update(current.id, { references: current.references.filter((_, position) => position !== index), step: 0, plan: '', results: [], error: '' })}><X size={13} /></button><button type="button" className="vm-reference-primary" disabled={index === 0} onClick={() => update(current.id, { references: [reference, ...current.references.filter((_, position) => position !== index)], step: 0, plan: '', results: [], error: '' })}>{index === 0 ? '主参考' : '设为主参考'}</button>{s.referenceMode === 'fusion' && <label className="vm-reference-group">人物<select aria-label={`参考图${index + 1}人物分组`} value={reference.group || 'A'} onChange={event => update(current.id, { references: current.references.map((ref, position) => position === index ? { ...ref, group: event.target.value as 'A' | 'B' } : ref), step: 0, plan: '', results: [], error: '' })}><option>A</option><option>B</option></select></label>}</article>)}</div>}
              <p className="vm-caption">{s.referenceMode === 'fusion' ? '将两个人物分别标记为 A、B，同一人物的补充图使用相同分组。' : '第1张为主要外貌参考，其余补充同人物角度，生成有相似感的新模特。'}</p>
            </>}
            {s.source === 'ai' && <><ModelPresetPicker kind="style" value={s.style} onChange={style => change({ style })} /><ModelPresetPicker kind="age" value={s.age} onChange={age => change({ age })} childOnly={isChildModel(s.person)} /></>}
            <p className="vm-adaptation-note"><Sparkles size={14} />{s.source === 'reference' ? '提取参考外貌与气质，重新设计新面孔，不沿用参考服装和配饰。' : '按所选条件随机设计新人物；重新分析可换一版，同组照片保持同一人。'}</p>
          </section>
          <section className="vm-card"><div className="vm-section-title"><span><Camera size={20} /></span><div><h2>摄影控制</h2><p>取景、动作与画面规格</p></div></div>
            <ModelPresetPicker kind="scope" value={s.scope} onChange={scope => change({ scope })} />
            {s.scope === '面部模特' && <label className="vm-field">呈现方式<select value={s.presentation || '多视角模卡'} onChange={event => change({ presentation: event.target.value })}><option>多视角模卡</option><option>单张肖像</option></select></label>}
            <p className="vm-caption">统一基础着装：白 T 恤＋白色短裤 · 无配饰</p>
            {s.scope === '试戴部位' && select('具体部位', 'part', ['耳部', '手部', '颈部', '脚部'])}
            {!(s.scope === '面部模特' && s.presentation !== '单张肖像') && <ModelPresetPicker kind="actions" value={s.actions[0] || ''} values={s.actions} onMultiChange={actions => change({ actions })} />}
            <div className="vm-pair"><ModelPresetPicker kind="photography" value={s.photography} onChange={photography => change({ photography })} /><label className="vm-field">图片比例<select value={s.ratio} onChange={event => change({ ratio: event.target.value as AspectRatio })}>{[AspectRatio.PORTRAIT_2_3, ...Object.values(AspectRatio).filter(ratio => ratio !== AspectRatio.PORTRAIT_2_3)].map(ratio => { const [width, height] = ratio.split(':').map(Number); return <option key={ratio} value={ratio}>{ratio} {width === height ? '方版' : width < height ? '竖版' : '横版'}</option>; })}</select></label></div>
            {select('分辨率', 'resolution', ['1K', '2K', '4K'])}
            <label className="vm-field">补充说明（选填）<textarea value={s.notes} maxLength={2000} onChange={event => change({ notes: event.target.value })} placeholder="例如：轮廓柔和一些、保留真实肤质、深棕微卷发…" rows={3} /></label>
            <details className="vm-advanced"><summary>高级设置</summary><CreativeImageModelSelector value={s.model} onChange={(model) => change({ model })} compact className="mt-3" /></details>
          </section>
        </fieldset>
        {current.error && <div className="vm-error" role="alert">{current.error}</div>}
        {busy ? <button className="vm-primary" onClick={cancel}><Loader2 className="vm-spin" size={17} />{current.step === 1 ? '分析中' : `生成中 ${current.results.filter(result => result.image || result.error).length}/${current.results.length}`} · 取消</button> : <button className="vm-primary" disabled={uploadBusy || !outputActions.length || (s.source === 'reference' && !current.references.length)} onClick={analyze}><Sparkles size={18} />{current.plan ? '重新分析信息' : '分析信息，生成模特方案'}</button>}
        <p className="vm-caption vm-cost">预计生成 {outputActions.length} 张{isFaceSheet ? '（一张含四个角度）' : ''} · 费用按所选模型与实际生成计费</p>
      </div>
      <section className={`vm-output ${current.step === 0 ? 'vm-empty' : 'vm-card'}`}>
        {current.step === 0 ? <div className="vm-empty-content"><span><UserRound size={36} /></span><h2>从人物身份开始，打造专属模特</h2><p>在左侧选择模特来源与摄影参数，点击「分析信息」。<br />确认人物与拍摄方案后，AI 将按所选动作逐张生成。</p><div className="vm-tags">全身 / 半身 / 面部 · 手部 / 耳部 / 脚部 / 颈部</div></div> : current.step === 1 ? <div className="vm-empty-content"><Loader2 size={34} className="vm-spin" /><h2>正在规划人物与摄影方案</h2><p>分析人物特征、动作、取景与光线…</p></div> : <>
          <div className="vm-section-title"><span><Sparkles size={20} /></span><div><h2>{current.step === 2 ? '确认模特与摄影方案' : '生成结果'}</h2><p>{current.step === 2 ? '可编辑方案，确认后开始生成' : `${current.results.filter(result => result.image).length} / ${outputActions.length} 张已完成`}</p></div></div>
          {current.step === 2 ? <><VirtualModelPlanCard key={current.id} traits={current.traits!} references={s.source === 'reference' ? current.references : []} fusion={s.source === 'reference' && s.referenceMode === 'fusion'} faceSheet={isFaceSheet} scope={s.scope} ratio={s.ratio} resolution={s.resolution} onChange={traits => update(current.id, { traits, plan: modelPlanPrompt(traits, modelFaceDirection(s)) })} /><details className="vm-approved"><summary>查看生成人物提示词</summary><p>{current.plan}</p></details><div className="vm-tags">{s.scope} · {s.ratio} · {s.resolution} · {outputActions.length} 张</div><button className="vm-primary" disabled={!current.plan.trim() || !current.traits || PLAN_FIELDS.some(([key]) => !current.traits![key].trim())} onClick={() => void generate()}><Sparkles size={18} />确认方案，生成 {outputActions.length} 张{isFaceSheet ? '四宫格模卡' : ''}</button></> : <>
            <details className="vm-approved"><summary>查看已确认方案</summary><p>{current.plan}</p></details>
            <div className="vm-results" style={isFaceSheet ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>{current.results.map((item, index) => <article key={item.action}><div className="vm-result-image" style={{ aspectRatio: s.ratio.replace(':', '/') }}>{item.image ? <button aria-label={`放大${item.action}`} onClick={() => setPreview(item.image)}><img src={item.image} alt={item.action} /></button> : item.rejectedImage ? <button aria-label={`查看待检查图片${item.action}`} onClick={() => setPreview(item.rejectedImage)}><img src={item.rejectedImage} alt={`待检查：${item.action}`} /></button> : item.error ? <p role="alert">{item.error}</p> : <div><Loader2 size={24} className="vm-spin" /><p>{index === current.results.findIndex(result => !result.image && !result.error) ? '正在生成' : '等待生成'}</p></div>}</div><footer><b>{item.action}{item.checking ? ' · 检查取景中' : item.rejectedImage ? ' · 未通过检查' : ''}</b>{item.image && <button aria-label={`下载${item.action}`} onClick={() => void download(item)}><Download size={17} /></button>}{item.rejectedImage && <button aria-label="下载待检查图片" onClick={() => void download({ ...item, image: item.rejectedImage })}><Download size={17} /></button>}</footer>{item.error && item.rejectedImage && <p className="vm-error" role="alert">{item.error}</p>}</article>)}</div>
            {current.step === 4 && current.results.some(item => !item.image) && <button className="vm-primary" onClick={() => void generate(true)}>重试未完成图片</button>}
          </>}
        </>}
      </section>
    </div>
    {preview && <div className="vm-lightbox" role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setPreview(undefined)}><button autoFocus aria-label="关闭预览" onClick={() => setPreview(undefined)}><X /></button><img src={preview} alt="虚拟模特生成结果" onClick={event => event.stopPropagation()} /></div>}
  </div>;
}
