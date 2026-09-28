export interface LegacyMessageReference {
  title: string;
  url: string;
}

const LEGACY_REFERENCE_PATTERN = /[【[]参考灵感图[「"]?(.+?)[」"]?\s*:\s*(https?:\/\/[^\s】\]]+)[】\]]/gi;

export const extractLegacyMessageReferences = (text?: string): LegacyMessageReference[] => {
  if (!text) return [];
  return Array.from(text.matchAll(LEGACY_REFERENCE_PATTERN), (match) => ({
    title: match[1]?.trim() || '参考图片',
    url: match[2],
  }));
};

export const stripLegacyMessageReferences = (text?: string): string => (
  String(text || '').replace(LEGACY_REFERENCE_PATTERN, '').replace(/\s{2,}/g, ' ').trim()
);
