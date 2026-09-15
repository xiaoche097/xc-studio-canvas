import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasExplicitCraftIntent,
  resolveAgentWorkMode,
  resolveTurnAgentMode,
} from './agent-mode.ts';

test('migrates legacy agent modes', () => {
  assert.equal(resolveAgentWorkMode('default'), 'craft');
  assert.equal(resolveAgentWorkMode('chat'), 'ask');
  assert.equal(resolveAgentWorkMode('plan'), 'plan');
});

test('recognizes explicit approval without treating questions as execution', () => {
  for (const message of ['帮我做', '没问题可以做', '聊得差不多了，我觉得没问题可以做了', '按这个方案执行', '开始生成', 'go ahead']) {
    assert.equal(hasExplicitCraftIntent(message), true, message);
  }
  for (const message of ['可以怎么做？', '这个方案好吗？', '继续聊聊', '能不能开始做？']) {
    assert.equal(hasExplicitCraftIntent(message), false, message);
  }
});

test('automatically transitions Plan and Ask to Craft on approval', () => {
  assert.deepEqual(resolveTurnAgentMode('plan', '开始做'), {
    mode: 'craft',
    transitionedFrom: 'plan',
  });
  assert.deepEqual(resolveTurnAgentMode('ask', '按这个方向制作吧'), {
    mode: 'craft',
    transitionedFrom: 'ask',
  });
  assert.deepEqual(resolveTurnAgentMode('ask', '我们再讨论一下'), { mode: 'ask' });
});
