export type ConversationOrigin = 'home' | 'canvas';

export const createConversationId = (origin: ConversationOrigin = 'canvas'): string => (
  `conv-${origin}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);
