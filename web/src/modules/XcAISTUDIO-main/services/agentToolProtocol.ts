export interface ImageToolAction {
  prompt: string;
}

export const extractImageToolAction = (text: string): ImageToolAction | null => {
  const candidates = [
    text.trim(),
    ...Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)).map((match) => match[1].trim()),
    text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1).trim(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const payload = JSON.parse(candidate);
      const action = String(payload?.action || payload?.tool || payload?.name || '').toLowerCase();
      if (!/(?:dalle\.)?text2img|text[-_]?to[-_]?image|generate[-_]?image/.test(action)) continue;
      let actionInput = payload?.action_input ?? payload?.arguments ?? payload?.input ?? {};
      if (typeof actionInput === 'string') {
        try {
          actionInput = JSON.parse(actionInput);
        } catch {
          actionInput = { prompt: actionInput };
        }
      }
      const prompt = String(actionInput?.prompt || payload?.prompt || '').trim();
      if (prompt) return { prompt };
    } catch {
      // Not a complete tool-action payload; try the next extracted candidate.
    }
  }
  return null;
};
