import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeepSeekCreativeClient, splitCreativeAnalysisParts } from './deepseekCreativeClient.ts';

test('separates images from the creative task while preserving order', () => {
  const result = splitCreativeAnalysisParts({
    contents: {
      parts: [
        { text: 'PRODUCT IMAGE 1' },
        { inlineData: { mimeType: 'image/png', data: 'abc' } },
        { text: 'Return ONLY JSON' },
        { inline_data: { mime_type: 'image/jpeg', data: 'data:image/jpeg;base64,xyz' } },
      ],
    },
  });
  assert.equal(result.images.length, 2);
  assert.equal(result.images[0].base64, 'abc');
  assert.equal(result.images[1].base64, 'xyz');
  assert.match(result.taskText, /PRODUCT IMAGE 1/);
  assert.match(result.taskText, /Return ONLY JSON/);
});

test('sends images directly to DeepSeek 4.1 Flash for native visual understanding', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 4 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const client = createDeepSeekCreativeClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      reasoningEffort: 'high',
      maxTokens: 1024,
    }, async () => {
      throw new Error('legacy vision proxy should not be called');
    });
    const result = await client.models.generateContent({
      contents: { parts: [
        { inlineData: { mimeType: 'image/png', data: 'base64-image' } },
        { text: 'Return ONLY JSON: {"ok":true}' },
      ] },
    });

    assert.equal(result.text, '{"ok":true}');
    assert.equal(requestBody.request.model, 'deepseek-flash');
    assert.deepEqual(requestBody.request.response_format, { type: 'json_object' });
    assert.match(JSON.stringify(requestBody.request.messages[0].content), /Return ONLY JSON/);
    assert.match(JSON.stringify(requestBody.request.messages[0].content), /base64-image/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
