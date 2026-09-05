import { build } from 'esbuild';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
await build({ entryPoints: ['Cyzx4/components/VirtualModelTab.tsx'], outfile: 'scratch/virtual-model-ssr.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['react', 'react-dom/server', 'lucide-react'], loader: { '.css': 'empty' }, plugins: [{ name: 'mock-services', setup(builder) {
  builder.onResolve({ filter: /services\/|utils\/imageDownload/ }, args => ({ path: args.path, namespace: 'mock' }));
  builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const generateText=()=>{},generateImageToImage=()=>{},compressImage=()=>{},downloadImageFile=()=>{},fetchImageBlob=()=>{},saveGeneratedProject=()=>{};' }));
} }] });
await build({ entryPoints: ['Cyzx4/constants/virtualModelPresets.ts'], outfile: 'scratch/virtual-model-presets.cjs', bundle: true, platform: 'node', format: 'cjs' });
await build({ entryPoints: ['Cyzx4/components/ModelPresetPicker.tsx'], outfile: 'scratch/virtual-model-picker.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['react', 'lucide-react'] });
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { default: Component } = require('./virtual-model-ssr.cjs');
const { MODEL_PRESETS, isChildModel, modelAdaptationBrief, modelRequestSettings, presetBackground } = require('./virtual-model-presets.cjs');
const { togglePresetSelection } = require('./virtual-model-picker.cjs');
const html = renderToStaticMarkup(React.createElement(Component));
assert.equal((html.match(/aria-haspopup="dialog"/g) || []).length, 6, 'Six visual preset selectors');
assert.ok(html.includes('value="2:3" selected=""'), 'Default portrait ratio 2:3');
assert.ok(html.includes('<option selected="">2K</option>'), 'Default resolution 2K');
for (const text of ['生成记录', '确认规划', '摄影控制', '手部', '耳部', '脚部', '颈部', '分析信息，生成模特方案']) assert.ok(html.includes(text), text);
assert.deepEqual(['person', 'style', 'age', 'scope', 'actions', 'photography'].map(kind => MODEL_PRESETS[kind].items.length), [15, 9, 5, 4, 9, 8]);
assert.deepEqual(MODEL_PRESETS.actions.items.map(item => item.label), ['自然站立', '插兜', '行走', '坐姿', '回头', '看镜头', '奔跑', '跳跃', '伸懒腰']);
assert.equal(MODEL_PRESETS.person.items.filter(item => item.child).length, 6);
for (const kind of Object.keys(MODEL_PRESETS)) {
  const group = MODEL_PRESETS[kind];
  assert.ok(group.items.length <= group.columns * group.rows);
  assert.ok(existsSync(`public/${group.image.replace('./', '')}`), `${kind} reference asset`);
  assert.equal(new Set(group.items.map(item => item.label)).size, group.items.length);
  for (const item of group.items) assert.ok(!presetBackground(kind, item.label).backgroundPosition.includes('NaN'));
}
assert.ok(isChildModel('韩系小男孩'));
assert.ok(!isChildModel('中国男生'));
const settings = { source: 'ai', person: '韩系小男孩', style: '高奢', age: '儿童感', scope: '手部', photography: '电商白底', notes: '' };
const child = modelAdaptationBrief(settings);
assert.ok(child.includes('儿童适配优先'));
assert.ok(child.includes('不生成整个人像替代部位'));
assert.ok(child.includes('不使用成熟妆容或成人体态'));
const reference = modelAdaptationBrief({ ...settings, source: 'reference' });
assert.ok(reference.includes('身份锚点：用户上传人像'));
assert.ok(reference.includes('不得用预设图替换身份'));
assert.ok(!reference.includes('人物类型：韩系小男孩'));
assert.ok(!reference.includes('风格参考：'));
assert.ok(!reference.includes('年龄气质：'));
assert.ok(reference.includes('第1张为主参考'));
assert.ok(reference.includes('逐张分析用户提供的1–5张图片'));
const requestSettings = modelRequestSettings({ ...settings, source: 'reference' });
for (const key of ['person', 'style', 'age']) assert.ok(!(key in requestSettings), `Reference request excludes stale ${key}`);
assert.equal(requestSettings.photography, '电商白底');
assert.equal(requestSettings.scope, '手部');
assert.equal(modelRequestSettings(settings).person, '韩系小男孩');
// Render real source branches with a seeded React initial task; services stay mocked.
const originalUseState = React.useState;
try {
  React.useState = (initial) => originalUseState(() => {
    const value = typeof initial === 'function' ? initial() : initial;
    if (Array.isArray(value) && value[0]?.settings && value[0]?.references) return value.map(record => ({ ...record, settings: { ...record.settings, source: 'reference' }, references: Array.from({ length: 5 }, (_, index) => ({ name: `ref${index}.jpg`, preview: 'data:image/jpeg;base64,dGVzdA==', base64: 'dGVzdA==', mimeType: 'image/jpeg' })) }));
    return value;
  });
  const referenceHtml = renderToStaticMarkup(React.createElement(Component));
  assert.equal((referenceHtml.match(/aria-haspopup="dialog"/g) || []).length, 3, 'Reference mode only shows photography controls');
  assert.ok(!referenceHtml.includes('选择年龄气质'));
  assert.ok(referenceHtml.includes('multiple=""'), 'Multi-file upload enabled');
  assert.ok(referenceHtml.includes('已添加5张参考图'));
  assert.equal((referenceHtml.match(/aria-label="移除参考图/g) || []).length, 5);
  assert.equal((referenceHtml.match(/设为主参考/g) || []).length, 4);
} finally { React.useState = originalUseState; }
const closeup = modelAdaptationBrief({ ...settings, scope: '试戴部位', part: '脚部', actions: ['奔跑'], photography: '儿童棚拍' });
assert.ok(closeup.includes('试戴部位（脚部）'));
assert.ok(closeup.includes('不能为了表现奔跑、跳跃、插兜而扩展为全身'));
assert.ok(closeup.includes('不变成儿童'));
const original = ['自然站立'];
const selected = togglePresetSelection(original, '行走');
assert.deepEqual(original, ['自然站立'], 'Draft selection leaves committed values unchanged');
assert.deepEqual(selected, ['自然站立', '行走']);
assert.deepEqual(togglePresetSelection(selected, '自然站立'), ['行走']);
const maximum = Array.from({ length: 15 }, (_, i) => String(i));
assert.equal(togglePresetSelection(maximum, 'extra').length, 15);
console.log('PASS: AI/reference source rendering, 5 reference cards and multi-upload, stale preset exclusion, main-reference policy, 50 preset mappings, 2K/2:3 defaults, multi-selection and body-part adaptation.');
