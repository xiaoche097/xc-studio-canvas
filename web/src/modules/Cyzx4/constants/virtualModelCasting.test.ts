import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MODEL_PERSON, modelCastingBrief, modelFaceDirection, useTextOnlyModelPresets, modelVariationBrief } from './virtualModelCasting.ts';

test('new plans vary facial structure while respecting references and keeping approved poses stable', () => {
  const settings = { source: 'reference' as const, person: DEFAULT_MODEL_PERSON };
  const first = modelVariationBrief(settings, undefined, () => 0);
  const next = modelVariationBrief(settings, 'previous-face', () => 0.99);
  assert.notEqual(first, next);
  assert.match(first, /脸部纵横比例略偏修长/);
  assert.match(next, /脸部纵横比例自然适中/);
  assert.match(next, /previous-face/);
  assert.match(first, /不覆盖参考核心特征/);
  assert.match(next, /失败重试均沿用该人物/);
});

test('default AI casting selects Western appearance without stock reference faces', () => {
  const settings = { source: 'ai' as const, person: DEFAULT_MODEL_PERSON, faceDirection: '东亚面孔方向' };
  assert.equal(useTextOnlyModelPresets(settings), true);
  assert.equal(modelFaceDirection(settings), '欧美／欧洲面孔方向');
  assert.match(modelCastingBrief(settings), /European \/ Western facial appearance/);
});

test('explicit person changes override a previous reference-mode direction', () => {
  const settings = { source: 'ai' as const, person: '中国男生', faceDirection: '欧美／欧洲面孔方向' };
  assert.equal(modelFaceDirection(settings), '中国男生选角方向');
  assert.equal(useTextOnlyModelPresets(settings), true);
  assert.equal(modelCastingBrief(settings), '');
});

test('reference portrait mode retains the user direction without imposing the AI default', () => {
  const settings = { source: 'reference' as const, person: DEFAULT_MODEL_PERSON };
  assert.equal(modelFaceDirection(settings), undefined);
  assert.equal(useTextOnlyModelPresets(settings), false);
  assert.equal(modelCastingBrief(settings), '');
  assert.equal(modelFaceDirection({ ...settings, faceDirection: '用户选择' }), '用户选择');
});
