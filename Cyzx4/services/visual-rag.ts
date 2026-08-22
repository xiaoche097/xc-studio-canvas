import {
  buildTopicPinnedContext,
  loadTopicMemoryItems,
} from './topic-memory';
import {
  formatVisualRagMatches,
  rankVisualMemoryItems,
  type VisualRagMatch,
} from './visual-rag-ranking';

export type VisualRagDiagnostics = {
  enabled: boolean;
  strategy: 'local-hybrid-v1';
  candidateCount: number;
  matchCount: number;
  fallbackUsed: boolean;
  error?: string;
};

export type VisualRagContext = {
  text: string;
  refs: string[];
  matches: VisualRagMatch[];
  diagnostics: VisualRagDiagnostics;
};

type BuildVisualRagContextInput = {
  topicId: string;
  query: string;
  enabled?: boolean;
  maxMatches?: number;
  maxChars?: number;
  now?: number;
};

const dedupe = (values: string[]) => [...new Set(values.filter(Boolean))];

export async function buildVisualRagContext({
  topicId,
  query,
  enabled = true,
  maxMatches = 6,
  maxChars = 4500,
  now = Date.now(),
}: BuildVisualRagContextInput): Promise<VisualRagContext> {
  const emptyDiagnostics: VisualRagDiagnostics = {
    enabled,
    strategy: 'local-hybrid-v1',
    candidateCount: 0,
    matchCount: 0,
    fallbackUsed: false,
  };

  if (!topicId) return { text: '', refs: [], matches: [], diagnostics: emptyDiagnostics };

  let pinned = { text: '', refs: [] as string[] };
  try {
    pinned = await buildTopicPinnedContext(topicId);
  } catch (error) {
    emptyDiagnostics.fallbackUsed = true;
    emptyDiagnostics.error = error instanceof Error ? error.message : String(error);
  }

  if (!enabled) {
    return { text: pinned.text, refs: pinned.refs, matches: [], diagnostics: emptyDiagnostics };
  }

  try {
    const items = await loadTopicMemoryItems(topicId);
    const matches = rankVisualMemoryItems(items, query, { limit: maxMatches, now });
    const pinnedText = pinned.text.slice(0, Math.min(3100, maxChars));
    const remainingChars = Math.max(0, maxChars - pinnedText.length - (pinnedText ? 2 : 0));
    const retrievalText = formatVisualRagMatches(matches, remainingChars);
    const text = [pinnedText, retrievalText].filter(Boolean).join('\n\n').slice(0, maxChars);
    const refs = dedupe([
      ...pinned.refs,
      ...matches.flatMap((match) => match.refs),
    ]).slice(0, 8);

    return {
      text,
      refs,
      matches,
      diagnostics: {
        ...emptyDiagnostics,
        candidateCount: items.length,
        matchCount: matches.length,
      },
    };
  } catch (error) {
    return {
      text: pinned.text,
      refs: pinned.refs,
      matches: [],
      diagnostics: {
        ...emptyDiagnostics,
        fallbackUsed: true,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
