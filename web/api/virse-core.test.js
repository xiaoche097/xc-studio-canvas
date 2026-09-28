import assert from 'node:assert/strict';
import test from 'node:test';
import { callVirseTool, executeVirseRequest } from './virse-core.js';

test('workspace diagnostics discovers all tool pages without executing a tool', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (body.method === 'initialize') return Response.json({ result: {} });
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    assert.equal(body.method, 'tools/list');
    return Response.json({ result: body.params.cursor
      ? { tools: [{ name: 'get_canvas' }] }
      : { tools: [{ name: 'list_workspaces' }], nextCursor: 'page-2' } });
  });
  const result = await executeVirseRequest({ operation: 'list_tools', apiKey: 'test-key', baseUrl: 'https://api.virse.ai' });
  assert.deepEqual(result.data.map(x => x.name), ['list_workspaces', 'get_canvas']);
  assert.equal(calls[3].params.cursor, 'page-2');
});

test('tool discovery does not expand the callable tool allowlist', async () => {
  await assert.rejects(callVirseTool({ apiKey: 'test-key', tool: 'delete_canvas' }));
});

test('get_canvas is allowed and does not mistake canvas text for a tool failure', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'initialize') return Response.json({ result: {} });
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    assert.equal(body.params.name, 'get_canvas');
    assert.deepEqual(body.params.arguments, { canvas_id: 'canvas-a' });
    return Response.json({ result: { content: [{ type: 'text', text: 'Canvas overview\nError: text written by the user' }] } });
  });
  const result = await callVirseTool({ apiKey: 'test-key', tool: 'get_canvas', args: { canvas_id: 'canvas-a' } });
  assert.match(result.data, /Canvas overview/);
});
