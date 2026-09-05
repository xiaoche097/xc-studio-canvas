import React, { useState } from 'react';
import { ArrowRight, Check, Pencil, ScanFace, Shirt, Sparkles, UserRound } from 'lucide-react';
import { FACE_VIEWS, ModelPlan } from '../constants/virtualModelPlan';

type Props = {
  traits: ModelPlan;
  references: { preview: string; group?: 'A' | 'B' }[];
  fusion: boolean;
  faceSheet: boolean;
  scope: string;
  ratio: string;
  resolution: string;
  onChange: (traits: ModelPlan) => void;
};

function Feature({ label, value, onChange, prominent = false }: { label: string; value: string; onChange: (value: string) => void; prominent?: boolean }) {
  const [editing, setEditing] = useState(false);
  return <article className={`vm-feature ${prominent ? 'vm-feature-prominent' : ''}`}>
    <header><h3>{label}</h3><button type="button" aria-label={`${editing ? '完成编辑' : '编辑'}${label}`} onClick={() => setEditing(!editing)}>{editing ? <Check size={14} /> : <Pencil size={13} />}{editing ? '完成' : '调整'}</button></header>
    {editing ? <textarea autoFocus aria-label={label} value={value} rows={3} ref={node => { if (node) { node.style.height = 'auto'; node.style.height = `${node.scrollHeight}px`; } }} onChange={event => onChange(event.target.value)} /> : <p>{value || '待补充，点击调整'}</p>}
  </article>;
}

export default function VirtualModelPlanCard({ traits, references, fusion, faceSheet, scope, ratio, resolution, onChange }: Props) {
  const field = (key: keyof ModelPlan, label: string, prominent = false) => <Feature key={key} label={label} value={traits[key]} prominent={prominent} onChange={value => onChange({ ...traits, [key]: value })} />;
  return <div className="vm-casting-plan">
    <section className="vm-casting-intro">
      <div className="vm-casting-kicker"><Sparkles size={14} /> 你的专属模特方案 <span>{fusion ? '双参考融合' : references.length ? '参考衍生' : '自由创建'}</span></div>
      {references.length > 0 && <div className="vm-reference-flow"><div className="vm-source-portraits">{references.map((ref, index) => <figure key={index}><img src={ref.preview} alt={`人物参考${index + 1}`} /><figcaption>{fusion ? `人物 ${ref.group || 'A'}` : index === 0 ? '主要参考' : '补充角度'}</figcaption></figure>)}</div><ArrowRight size={22} /><div className="vm-new-identity"><ScanFace size={28} /><b>新的 AI 模特</b><small>提取外貌特点 · 重新设计面孔</small></div></div>}
      {field('direction', '这次要创造的模特', true)}
      <p className="vm-plan-disclaimer">人物设计方案，非生成预览。确认后将按这些特征创作。</p>
    </section>

    <section className="vm-plan-section"><header className="vm-plan-section-title"><span>01</span><div><h3>面孔与辨识度</h3><p>先确认最重要的脸，再看气质与造型</p></div></header>
      <div className="vm-feature-grid">{field('face', '脸型与骨相', true)}{field('eyes', '眼睛与眉眼')}{field('noseLips', '鼻子与嘴唇')}{field('skin', '肤色与真实肤质')}</div>
    </section>
    <section className="vm-plan-section"><header className="vm-plan-section-title"><span>02</span><div><h3>人物整体感觉</h3><p>年龄、头发与气质共同构成这个人</p></div></header>
      <div className="vm-feature-grid">{field('age', '外观年龄段')}{field('mood', '人物气质')}{field('hair', '发型发色')}</div>
      <details className="vm-plan-more"><summary>体型与比例</summary>{field('build', '体型与比例')}</details>
    </section>
    <details className="vm-plan-more"><summary>参考采用依据 <span>{fusion ? '查看 A/B 特征如何被采用' : '查看参考特征如何被采用'}</span></summary>{field('references', '参考采用依据')}</details>
    <section className="vm-plan-section"><header className="vm-plan-section-title"><span>03</span><div><h3>最终会得到什么</h3><p>人物设定不变，按所选范围拍摄</p></div></header>
      <div className="vm-delivery"><div className="vm-delivery-heading"><b>{faceSheet ? '1 张四宫格模卡' : scope}</b><span>{ratio} · {resolution}</span></div>
        {faceSheet && <><div className="vm-sheet-schematic" aria-label="四宫格排版示意">{FACE_VIEWS.map((view, index) => <div key={view}><UserRound size={24} /><span><i>0{index + 1}</i>{view}</span></div>)}</div><p className="vm-plan-disclaimer">排版示意 · 一张图含四个角度，四格均为同一模特</p></>}
        <div className="vm-wardrobe"><Shirt size={22} /><div><b>白 T 恤 ＋ 白色短裤</b><p>统一基础着装 · 无图案 · 无配饰 · 方便后续换装</p></div></div>
      </div>
      <details className="vm-plan-more"><summary>取景与光线 <span>查看或调整拍摄细节</span></summary>{field('photography', '取景与光线')}</details>
    </section>
  </div>;
}
