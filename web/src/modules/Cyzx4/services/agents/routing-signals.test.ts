import assert from 'node:assert/strict';
import test from 'node:test';

import { isFashionTransferRequest } from './routing-signals.ts';

test('detects virtual try-on and model transfer requests', () => {
  for (const message of [
    '我想你帮我将我的这个产品换到这个模特上，比例保持2：3',
    '把这件衣服穿到模特身上',
    'Create a virtual try-on for this clothing product',
  ]) {
    assert.equal(isFashionTransferRequest(message), true, message);
  }
});

test('does not treat generic poster work as fashion transfer', () => {
  assert.equal(isFashionTransferRequest('帮我做一张活动海报'), false);
});
