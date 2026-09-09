import assert from 'node:assert/strict';
import test from 'node:test';
import { findVirseWorkspace, generateVirseImage, getVirseWorkspaceDiagnostic, isVirseCanvasAvailable, listVirseWorkspaces } from './virseService.ts';

for (const status of [429, 502, 401]) {
  test(`polling handles HTTP ${status} without resubmitting generation`, async (t) => {
    const delays: number[] = [];
    const realTimeout = globalThis.setTimeout;
    t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
      delays.push(delay);
      return realTimeout(callback, 0);
    });
    let submissions = 0;
    let reads = 0;
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
      const request = JSON.parse(init.body);
      if (request.tool === 'generate_image') {
        submissions++;
        return Response.json({ data: { artifact_version_id: 'accepted-task', status: 'processing' } });
      }
      assert.equal(request.tool, 'get_asset_detail');
      assert.equal(request.args.artifact_version_id, 'accepted-task');
      reads++;
      if (reads === 1 || status !== 502) return Response.json({ error: 'upstream unavailable' }, { status });
      return Response.json({ data: { status: 'completed', image_url: 'https://example.com/result.png' } });
    });
    const result = generateVirseImage({ apiKey: 'test-key', baseUrl: 'https://api.virse.ai', spaceId: 's', canvasId: 'c', model: 'test', prompt: 'test', aspectRatio: '2:3', resolution: '2K' });
    if (status === 502) {
      assert.deepEqual(await result, ['https://example.com/result.png']);
      assert.deepEqual(delays, [5000, 10000]);
    } else {
      await assert.rejects(result, (error: any) => error.artifactVersionId === 'accepted-task' && error.status === status);
      assert.equal(reads, status === 429 ? 4 : 1);
    }
    assert.equal(submissions, 1);
  });
}

test('keeps the selected workspace regardless of list order and never picks a replacement', () => {
  const first = { space_id: 'space-a', canvas_id: 'canvas-a' };
  const selected = { space_id: 'space-b', canvas_id: 'canvas-b' };
  assert.equal(findVirseWorkspace([first, selected], 'space-b', 'canvas-b'), selected);
  assert.equal(findVirseWorkspace([selected, first], 'space-b', 'canvas-b'), selected);
  assert.equal(findVirseWorkspace([first], 'space-b', 'canvas-b'), undefined);
  assert.equal(findVirseWorkspace([selected], 'other-space', 'canvas-b'), undefined);
  assert.equal(findVirseWorkspace([first], '', ''), undefined);
});

test('refresh replaces the previous list, filters explicit deletion flags and keeps active entries', async (t) => {
  const active = { space_id: 's', canvas_id: 'active', deleted: false };
  const stale = { space_id: 's', canvas_id: 'stale' };
  const responses = [
    { workspaces: [active, stale] },
    { workspaces: [active, active, { ...stale, deleted_at: '2026-09-07' },
      { ...stale, canvas_id: 'nested', canvas: { isDeleted: true } },
      { ...stale, canvas_id: 'trash', status: 'trashed' }] },
    { workspaces: [] },
  ];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.cache, 'no-store');
    const request = JSON.parse(init.body);
    assert.equal(request.baseUrl, 'https://api.virse.ai');
    if (request.tool === 'get_canvas') return Response.json({ data: { elements: [] } });
    assert.equal(request.tool, 'list_workspaces');
    return Response.json({ data: responses.shift() });
  });
  assert.equal((await listVirseWorkspaces('test-key', 'https://api.virse.ai')).length, 2);
  assert.deepEqual((await listVirseWorkspaces('test-key', 'https://api.virse.ai')).map(x => x.canvas_id), ['active']);
  assert.deepEqual(await listVirseWorkspaces('test-key', 'https://api.virse.ai'), []);
});

test('does not resurrect deleted entries by falling back to the text parser', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: JSON.stringify({
    workspaces: [{ space_id: 's', canvas_id: 'c', is_deleted: true }],
  }) }));
  assert.deepEqual(await listVirseWorkspaces('test-key', 'https://api.virse.ai'), []);
});

test('still reads the MCP human-readable workspace format', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => Response.json({
    data: JSON.parse(init.body).tool === 'get_canvas' ? 'Canvas: Active canvas\n0 elements'
      : '[space-a] Active canvas — canvas_id: canvas-a, org: My org',
  }));
  const [workspace] = await listVirseWorkspaces('test-key', 'https://api.virse.ai');
  assert.equal(workspace.space_id, 'space-a');
  assert.equal(workspace.canvas_id, 'canvas-a');
});

test('rechecks all eight listed canvases and removes the two missing canvases without deletion flags', async (t) => {
  const names = ['AI11', 'AI12', 'AI111111', 'Single model', '1', 'Nico', '1111', 'AI1111'];
  const rawList = names.map((name, i) => `[space-${i}] ${name} — canvas_id: canvas-${i}, org: Team`).join('\n');
  const missing = new Set(['canvas-2', 'canvas-7']);
  const checked: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const request = JSON.parse(init.body);
    if (request.tool === 'list_workspaces') return Response.json({ data: rawList });
    assert.equal(request.tool, 'get_canvas');
    checked.push(request.args.canvas_id);
    return missing.has(request.args.canvas_id)
      ? Response.json({ error: 'Canvas not found' }, { status: 502 })
      : Response.json({ data: { elements: [] } });
  });
  const first = await listVirseWorkspaces('test-key', 'https://api.virse.ai');
  assert.deepEqual(first.map(x => x.name), ['AI11', 'AI12', 'Single model', '1', 'Nico', '1111']);
  assert.equal(new Set(checked).size, 8);
  missing.add('canvas-1');
  checked.length = 0;
  assert.equal((await listVirseWorkspaces('test-key', 'https://api.virse.ai')).length, 5);
  assert.equal(checked.length, 8);
});

test('transient validation failure fails sync rather than presenting an incomplete list', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => JSON.parse(init.body).tool === 'list_workspaces'
    ? Response.json({ data: [{ space_id: 's', canvas_id: 'c' }] })
    : Response.json({ error: 'Request timed out' }, { status: 504 }));
  await assert.rejects(listVirseWorkspaces('test-key', 'https://api.virse.ai'), /Request timed out/);
});

test('canvas validation handles explicit unavailable responses and keeps empty canvases and element text', async (t) => {
  const responses = [
    'Canvas not found or access denied',
    { error_code: 'CANVAS_NOT_FOUND' },
    { status: 'deleted' },
    { elements: [] },
    { elements: [{ text: 'Canvas not found' }] },
    'Canvas overview\nText element: Canvas not found',
    { error: 'Rate limited' },
  ];
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: responses.shift() }));
  for (const expected of [false, false, false, true, true, true]) {
    assert.equal(await isVirseCanvasAvailable('test-key', 'https://api.virse.ai', 'c'), expected);
  }
  await assert.rejects(isVirseCanvasAvailable('test-key', 'https://api.virse.ai', 'c'), /Rate limited/);
});

test('propagates connection errors without trying another endpoint', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'offline' }, { status: 502 }));
  await assert.rejects(listVirseWorkspaces('test-key', 'https://api.virse.ai'), /offline/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('diagnostics keeps raw workspace content and removes an echoed API key', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const request = JSON.parse(init.body);
    return Response.json(request.operation === 'list_tools'
      ? { data: [{ name: 'get_canvas' }] }
      : { data: 'test-secret', content: [{ type: 'text', text: 'raw workspace list' }] });
  });
  const result = await getVirseWorkspaceDiagnostic('test-secret', 'https://api.virse.ai');
  assert.equal(result.includes('test-secret'), false);
  assert.match(result, /raw workspace list/);
  assert.match(result, /get_canvas/);
});
