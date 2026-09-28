import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectExplicitAgentPin,
  detectOptimizeOnlyIntent,
  detectOptimizeThenExecuteIntent,
  stripOptimizePipelineCommand,
} from './intent.ts';

test('detectOptimizeOnlyIntent matches optimize-only request', () => {
  assert.equal(detectOptimizeOnlyIntent('帮我优化提示词，不要执行'), true);
  assert.equal(detectOptimizeOnlyIntent('把这段 prompt 优化一下'), true);
  assert.equal(detectOptimizeOnlyIntent('帮我生成一张海报'), false);
});

test('detectOptimizeThenExecuteIntent matches explicit pipeline command', () => {
  assert.equal(
    detectOptimizeThenExecuteIntent('先优化这段提示词，然后用 coco 出图'),
    true,
  );
  assert.equal(
    detectOptimizeThenExecuteIntent('优化后帮我生成亚马逊主图'),
    true,
  );
  assert.equal(
    detectOptimizeThenExecuteIntent('只优化提示词，不要执行'),
    false,
  );
});

test('detectExplicitAgentPin finds explicit pinned agent', () => {
  assert.equal(detectExplicitAgentPin('请用 coco 执行这条需求'), 'coco');
  assert.equal(detectExplicitAgentPin('交给 cameron 处理'), 'cameron');
  assert.equal(detectExplicitAgentPin('优化后再执行'), null);
});

test('stripOptimizePipelineCommand removes optimize-control wording', () => {
  const result = stripOptimizePipelineCommand('先把提示词优化一下，然后用 coco 生成一张海报');
  assert.equal(result.includes('优化'), false);
  assert.equal(result.length > 0, true);
});
