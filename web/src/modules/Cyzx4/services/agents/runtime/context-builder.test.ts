import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDurableAgentContext } from './context-builder.ts';

test('durable context makes current-turn precedence explicit and includes retrieved memory', () => {
  const text = buildDurableAgentContext({
    currentRequest: '本轮改成蓝色',
    projectLabel: 'Project A',
    retrievedMemory: '历史偏好红色',
    designSession: {
      taskMode: 'edit',
      brand: {},
      styleHints: [],
      subjectAnchors: [],
      constraints: ['保持商品结构'],
      forbiddenChanges: [],
      approvedAssetIds: [],
    },
  });

  assert.match(text, /本轮明确要求 > 本轮附件/);
  assert.match(text, /本轮改成蓝色/);
  assert.match(text, /历史偏好红色/);
  assert.ok(text.indexOf('本轮改成蓝色') < text.indexOf('历史偏好红色'));
});
