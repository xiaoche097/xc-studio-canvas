import assert from 'node:assert/strict';
import test from 'node:test';
import { safeExtractTextFromOptimizerOutput } from './output.ts';

test('extracts top-level message when present', () => {
  const result = safeExtractTextFromOptimizerOutput({ message: '优化后的提示词' });
  assert.equal(result, '优化后的提示词');
});

test('falls back to first proposal message', () => {
  const result = safeExtractTextFromOptimizerOutput({
    proposals: [{ message: '版本1提示词' }],
  });
  assert.equal(result, '版本1提示词');
});

test('returns null for unsupported shape', () => {
  const result = safeExtractTextFromOptimizerOutput({ foo: 'bar' });
  assert.equal(result, null);
});
