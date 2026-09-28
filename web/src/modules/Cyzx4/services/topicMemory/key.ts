export const getMemoryKey = (workspaceId: string, conversationId: string): string => {
  const ws = String(workspaceId || '').trim();
  const conv = String(conversationId || '').trim();
  if (!ws || !conv) return '';
  return `${ws}:${conv}`;
};

export const parseMemoryKey = (key: string): { workspaceId: string; conversationId: string } | null => {
  const raw = String(key || '').trim();
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length >= 2 && parts[0].trim() && parts.slice(1).join(':').trim()) {
    return {
      workspaceId: parts[0],
      conversationId: parts.slice(1).join(':'),
    };
  }
  return null;
};
