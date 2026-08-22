import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatVisualRagMatches,
  rankVisualMemoryItems,
  type VisualMemoryItem,
  type VisualMemoryType,
} from './visual-rag-ranking.ts';

const NOW = Date.UTC(2026, 7, 22);

const memory = (
  id: string,
  type: VisualMemoryType,
  text: string,
  ageDays: number,
): VisualMemoryItem => ({
  id,
  type,
  text,
  createdAt: NOW - ageDays * 86_400_000,
});

test('rankVisualMemoryItems favors the closest visual memory over unrelated recent memory', () => {
  const items = [
    memory('relevant', 'constraint', '保留黑色连衣裙版型、金色手包和模特身份', 14),
    memory('recent-unrelated', 'instruction', '生成一个蓝色耳机白底主图', 0),
    memory('related-plan', 'plan', '黑色连衣裙场景保持原来的室内墙面和自然光', 30),
  ];

  const result = rankVisualMemoryItems(items, '把黑色连衣裙放回原来的室内场景', { now: NOW });

  assert.equal(result[0]?.id, 'related-plan');
  assert.deepEqual(new Set(result.map((item) => item.id)), new Set(['relevant', 'related-plan']));
});

test('rankVisualMemoryItems returns no context when the current subject is unrelated', () => {
  const items = [
    memory('speaker', 'analysis', '圆柱形蓝牙音箱，金属网罩，蓝色指示灯', 1),
  ];

  const result = rankVisualMemoryItems(items, '保持真人模特五官和黑色连衣裙', { now: NOW });
  assert.deepEqual(result, []);
});

test('formatVisualRagMatches states precedence and respects the character budget', () => {
  const matches = rankVisualMemoryItems([
    memory('constraint', 'constraint', '产品 Logo、包装文字和瓶身比例禁止改变', 2),
  ], '保持产品 Logo 和包装文字', { now: NOW });

  const text = formatVisualRagMatches(matches, 120);
  assert.equal(text.length <= 120, true);
  assert.match(text, /当前用户指令/);
});
