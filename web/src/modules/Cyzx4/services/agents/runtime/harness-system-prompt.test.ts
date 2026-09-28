import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHarnessSystemPrompt } from './harness-system-prompt.ts';

const agent = {
  id: 'prompt-optimizer' as const,
  name: 'XcAI 提示词导演',
  avatar: '✦',
  description: '只改写，不执行',
  capabilities: ['提示词优化'],
  color: '#f97316',
};

test('tool-free role does not receive media execution instructions', () => {
  const prompt = buildHarnessSystemPrompt({ agent, legacyPrompt: '只优化提示词', toolAccess: 'none' });
  assert.match(prompt, /没有任何工具权限/);
  assert.doesNotMatch(prompt, /必须调用对应工具/);
  assert.doesNotMatch(prompt, /可在已提供的工具中/);
});
