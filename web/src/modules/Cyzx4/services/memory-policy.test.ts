import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyInstructionMemory } from './memory-policy.ts';

test('temporary directions do not become durable memory', () => {
  assert.equal(classifyInstructionMemory('这次先换成红色试一版').persist, false);
});

test('explicit project rules become durable memory', () => {
  const result = classifyInstructionMemory('以后这个项目始终保持米白背景');
  assert.equal(result.persist, true);
  assert.equal(result.scope, 'project');
});

test('brand rules are scoped to the brand', () => {
  const result = classifyInstructionMemory('记住品牌规范：Logo 禁止改变颜色');
  assert.equal(result.persist, true);
  assert.equal(result.scope, 'brand');
});
