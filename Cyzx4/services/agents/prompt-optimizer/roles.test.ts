import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPromptOptimizerRequest, selectPromptOptimizerRole } from './roles.ts';

test('selects multi-image role before generic editing', () => {
  assert.equal(selectPromptOptimizerRole({ text: '融合成电商主图', referenceImageCount: 2 }).id, 'multi-image');
});

test('selects iteration role for a continuation', () => {
  assert.equal(selectPromptOptimizerRole({ text: '只把衣服改成黑色', referenceImageCount: 1, isRevision: true }).id, 'iterate');
});

test('manual mode overrides automatic selection', () => {
  assert.equal(selectPromptOptimizerRole({ text: '生成一张海报', mode: 'planning' }).id, 'planning');
});

test('optimizer request explicitly forbids execution', () => {
  const request = buildPromptOptimizerRequest({ text: '生成一张产品海报' });
  assert.match(request.message, /不执行任务/);
  assert.match(request.message, /不调用工具/);
});
