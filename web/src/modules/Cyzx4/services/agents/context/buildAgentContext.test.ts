import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAgentContext } from './buildAgentContext.ts';

test('keeps the latest twenty messages and resolves reference asset ids', () => {
  const context = buildAgentContext({
    workspaceId: 'workspace-a',
    messages: Array.from({ length: 24 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message ${index}`,
      timestamp: index,
    })),
    assets: [{
      id: 'product-1',
      role: 'product',
      type: 'image',
      name: 'product.png',
      url: 'https://example.com/product.png',
    }],
    productAnalysis: null,
    generationPlan: {
      prompt: 'Create an Instagram product photo.',
      referenceImageIds: ['product-1'],
      updatedAt: 1,
    },
    activeTask: null,
    lastAgentResult: null,
    canvasElements: [],
  });

  assert.equal(context.conversation.messages.length, 20);
  assert.equal(context.conversation.messages[0]?.id, 'message-4');
  assert.equal(context.generation.referenceAssets[0]?.id, 'product-1');
});
