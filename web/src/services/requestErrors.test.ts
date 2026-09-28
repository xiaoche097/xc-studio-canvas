import assert from 'node:assert/strict';
import test from 'node:test';
import { isRateLimitError } from './requestErrors.ts';

test('generation tool names and unrelated errors are not rate limits', () => {
  for (const message of ['Virse generate_image 返回错误', 'Failed to generate image: Bad Gateway', 'moderated content', 'Virse returned HTTP 502']) {
    assert.equal(isRateLimitError({ message }), false, message);
  }
});

test('recognizes explicit rate limits and HTTP 429', () => {
  for (const message of ['Rate limited', 'rate_limit_exceeded', 'Too Many Requests', 'HTTP 429', '请求过快']) {
    assert.equal(isRateLimitError({ message }), true, message);
  }
  assert.equal(isRateLimitError({ status: 429, message: 'busy' }), true);
});
