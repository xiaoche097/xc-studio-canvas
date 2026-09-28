import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEEPSEEK_FLASH_MODEL,
  DEEPSEEK_PRO_MODEL,
  selectDeepSeekModel,
} from './deepseek-model-router.ts';

test('routes image understanding to DeepSeek 4.1 Flash', () => {
  assert.deepEqual(selectDeepSeekModel({ hasImages: true, hasTools: true }), {
    model: DEEPSEEK_FLASH_MODEL,
    reason: 'vision',
  });
});

test('routes agent tool execution to Pro', () => {
  assert.equal(selectDeepSeekModel({ hasTools: true, text: '帮我做' }).model, DEEPSEEK_PRO_MODEL);
});

test('routes ordinary conversation to Flash and complex planning to Pro', () => {
  assert.equal(selectDeepSeekModel({ text: '这个颜色好看吗？' }).model, DEEPSEEK_FLASH_MODEL);
  assert.equal(selectDeepSeekModel({ text: '请规划一个多步骤工作流并分析架构权衡' }).model, DEEPSEEK_PRO_MODEL);
});

