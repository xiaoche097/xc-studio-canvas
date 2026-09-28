export type MemoryScope = 'turn' | 'asset' | 'project' | 'brand' | 'user';
export type MemoryStatus = 'candidate' | 'active' | 'approved' | 'rejected' | 'superseded';

export interface InstructionMemoryDecision {
  persist: boolean;
  scope: MemoryScope;
  confidence: number;
  reason: string;
}

const DURABLE_SIGNAL = /记住|以后|后续|始终|一直|长期|默认|固定|每次|所有(?:图片|项目|设计)|品牌(?:规范|要求|必须|禁止)|不要再|永远|作为(?:长期|品牌|项目).{0,6}(?:规则|标准|要求)/i;
const USER_SIGNAL = /我(?:一直|通常|习惯|偏好|喜欢|不喜欢)|我的默认/i;
const BRAND_SIGNAL = /品牌(?:规范|要求|必须|禁止|色|字体|logo|视觉)|vi\b/i;
const TURN_ONLY_SIGNAL = /仅?这次|本次|这一轮|这张|这一张|当前这张|临时|先试试|试一版/i;

/** Keeps transient creative directions out of durable project memory. */
export function classifyInstructionMemory(text: string): InstructionMemoryDecision {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { persist: false, scope: 'turn', confidence: 1, reason: 'empty' };
  }
  if (TURN_ONLY_SIGNAL.test(normalized)) {
    return { persist: false, scope: 'turn', confidence: 0.95, reason: 'explicit-turn-only' };
  }
  if (!DURABLE_SIGNAL.test(normalized)) {
    return { persist: false, scope: 'turn', confidence: 0.8, reason: 'no-durable-signal' };
  }
  if (USER_SIGNAL.test(normalized)) {
    return { persist: true, scope: 'user', confidence: 0.9, reason: 'explicit-user-preference' };
  }
  if (BRAND_SIGNAL.test(normalized)) {
    return { persist: true, scope: 'brand', confidence: 0.9, reason: 'explicit-brand-rule' };
  }
  return { persist: true, scope: 'project', confidence: 0.85, reason: 'explicit-durable-rule' };
}
