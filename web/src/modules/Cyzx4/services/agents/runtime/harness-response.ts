import { z } from 'zod';

const legacyHarnessEnvelopeSchema = z.object({
  action: z.enum(['respond', 'clarify', 'route']).optional(),
  message: z.string().optional(),
  handoffMessage: z.string().optional(),
  analysis: z.string().optional(),
  preGenerationMessage: z.string().optional(),
  postGenerationSummary: z.string().optional(),
  questions: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
}).passthrough();

export interface NormalizedHarnessResponse {
  text: string;
  analysis?: string;
  suggestions: string[];
  source: 'text' | 'legacy-json';
}

const INTERNAL_OUTPUT_RE = /(?:"?(?:skillCalls|tool_calls|primaryTool|referenceImages?|reference_image_url|init_image|handoffMessage)"?\s*:|ATTACHMENT_\d+|#\s*(?:输出格式|Response Format)|function calling)/i;
const MAX_CHAT_TEXT_CHARS = 3_000;

const extractJsonStringField = (value: string, field: string): string | undefined => {
  const match = value.match(new RegExp(`"${field}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`, 'i'));
  if (!match?.[1]) return undefined;
  try {
    const decoded = JSON.parse(match[1]);
    return typeof decoded === 'string' && decoded.trim() ? decoded.trim() : undefined;
  } catch {
    return undefined;
  }
};

const safePlainText = (value: string, fallback: string): string => {
  const embeddedMessage = [
    'message',
    'postGenerationSummary',
    'preGenerationMessage',
  ].map(field => extractJsonStringField(value, field)).find(Boolean);
  if (INTERNAL_OUTPUT_RE.test(value)) return embeddedMessage || fallback;
  if (value.length <= MAX_CHAT_TEXT_CHARS) return value;
  const clipped = value.slice(0, MAX_CHAT_TEXT_CHARS).trimEnd();
  return `${clipped}\n\n（回复内容过长，已隐藏内部执行细节。）`;
};

const unwrapCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || trimmed;
};

/**
 * Converts legacy JSON-only Agent output into user-facing chat text.
 * Plain model text passes through unchanged.
 */
export const normalizeHarnessResponse = (
  value: string,
  fallback = '任务已完成。',
): NormalizedHarnessResponse => {
  const raw = unwrapCodeFence(String(value || ''));
  if (!raw) return { text: fallback, suggestions: [], source: 'text' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { text: safePlainText(raw, fallback), suggestions: [], source: 'text' };
  }

  const envelope = legacyHarnessEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    return { text: fallback, suggestions: [], source: 'legacy-json' };
  }

  const data = envelope.data;
  const questions = data.questions?.filter(Boolean) || [];
  const suggestions = data.suggestions?.filter(Boolean) || [];
  const primary = data.message
    || data.postGenerationSummary
    || data.preGenerationMessage
    || data.handoffMessage
    || fallback;
  const guidance = data.action === 'clarify' && questions.length > 0
    ? `\n\n${questions.map((question, index) => `${index + 1}. ${question}`).join('\n')}`
    : '';

  return {
    text: safePlainText(`${primary}${guidance}`.trim(), fallback),
    suggestions,
    source: 'legacy-json',
  };
};

/**
 * Cleans an already-persisted assistant turn before it is sent back to the
 * model. This prevents a previously leaked plan/tool payload from poisoning
 * the next Harness turn.
 */
export const sanitizeHarnessHistoryText = (value: unknown): string => (
  normalizeHarnessResponse(String(value || ''), '').text.trim().slice(0, 2_400)
);
