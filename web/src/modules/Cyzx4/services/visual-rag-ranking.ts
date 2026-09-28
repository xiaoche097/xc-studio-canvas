export type VisualMemoryType =
  | 'constraint'
  | 'instruction'
  | 'analysis'
  | 'asset_tag'
  | 'plan'
  | 'issue';

export type VisualMemoryItem = {
  id: string;
  type: VisualMemoryType;
  text: string;
  tags?: string[];
  refs?: Array<{ url?: string }>;
  createdAt: number;
  status?: 'candidate' | 'active' | 'approved' | 'rejected' | 'superseded';
  expiresAt?: number;
};

export type VisualRagMatch = {
  id: string;
  type: VisualMemoryType;
  text: string;
  score: number;
  refs: string[];
  createdAt: number;
};

const TYPE_WEIGHT: Record<VisualMemoryType, number> = {
  constraint: 1.8,
  instruction: 1.25,
  analysis: 1.35,
  asset_tag: 1.55,
  plan: 1.45,
  issue: 1.15,
};

const STOP_TOKENS = new Set([
  '这个', '那个', '帮我', '一下', '需要', '可以', '图片', '图像', '生成', '设计',
  'please', 'image', 'design', 'create', 'make', 'with', 'from', 'that', 'this',
]);

const dedupe = (values: string[]) => [...new Set(values.filter(Boolean))];

const tokenize = (value: string): Set<string> => {
  const normalized = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return new Set();

  const tokens = new Set<string>();
  for (const word of normalized.match(/[a-z0-9][a-z0-9_-]{1,}/g) || []) {
    if (!STOP_TOKENS.has(word)) tokens.add(word);
  }

  const hanRuns = normalized.match(/[\p{Script=Han}]+/gu) || [];
  for (const run of hanRuns) {
    if (run.length <= 4 && !STOP_TOKENS.has(run)) tokens.add(run);
    for (let index = 0; index < run.length - 1; index += 1) {
      const bigram = run.slice(index, index + 2);
      if (!STOP_TOKENS.has(bigram)) tokens.add(bigram);
    }
  }

  return tokens;
};

const collectRefs = (item: VisualMemoryItem): string[] => {
  if (item.status === 'candidate' || item.status === 'rejected' || item.status === 'superseded') return [];
  return dedupe((item.refs || []).map((ref) => ref.url || '').filter(Boolean));
};

export function rankVisualMemoryItems(
  items: VisualMemoryItem[],
  query: string,
  options: { limit?: number; now?: number } = {},
): VisualRagMatch[] {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [];

  const now = options.now ?? Date.now();
  const limit = Math.max(1, options.limit ?? 6);

  return items
    .map((item): VisualRagMatch | null => {
      if (item.status === 'candidate' || item.status === 'superseded') return null;
      if (item.expiresAt && item.expiresAt <= now) return null;
      const itemTokens = tokenize(`${item.text} ${(item.tags || []).join(' ')}`);
      if (itemTokens.size === 0) return null;

      let overlap = 0;
      for (const token of queryTokens) {
        if (itemTokens.has(token)) overlap += token.length > 2 ? 1.35 : 1;
      }
      if (overlap === 0) return null;

      const coverage = overlap / Math.max(1, Math.sqrt(queryTokens.size * itemTokens.size));
      const ageDays = Math.max(0, now - item.createdAt) / 86_400_000;
      const recency = Math.exp(-ageDays / 60) * 0.35;
      const score = coverage * TYPE_WEIGHT[item.type] + recency;

      return {
        id: item.id,
        type: item.type,
        text: item.text.trim(),
        score: Number(score.toFixed(4)),
        refs: collectRefs(item),
        createdAt: item.createdAt,
      };
    })
    .filter((item): item is VisualRagMatch => item !== null)
    .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
    .slice(0, limit);
}

const MATCH_LABELS: Record<VisualMemoryType, string> = {
  constraint: '硬约束',
  instruction: '历史指令',
  analysis: '视觉分析',
  asset_tag: '已采用素材',
  plan: '历史方案',
  issue: '已知问题',
};

export function formatVisualRagMatches(matches: VisualRagMatch[], maxChars = 1400): string {
  if (matches.length === 0 || maxChars <= 0) return '';

  const lines = matches.map((match, index) => (
    `${index + 1}. [${MATCH_LABELS[match.type]}] ${match.text.slice(0, 420)}`
  ));
  const block = [
    '【按当前需求检索到的相关历史】',
    '以下内容仅用于补充视觉一致性；当前用户指令、当前附件和显式选择的 Skill 优先级更高。',
    ...lines,
  ].join('\n');
  return block.slice(0, maxChars);
}
