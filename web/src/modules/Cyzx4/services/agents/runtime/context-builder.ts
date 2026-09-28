import type { DesignSessionState } from '../../../types/common';

export interface DurableAgentContextInput {
  currentRequest: string;
  projectLabel: string;
  attachmentManifest?: string;
  preferredAspectRatio?: string;
  preferredAspectRatioSource?: string;
  capabilityContract?: string;
  continuationInstruction?: string;
  brandContext?: string;
  designSession?: DesignSessionState;
  retrievedMemory?: string;
}

const clean = (value: unknown, limit: number): string => (
  String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, limit)
);

const list = (values: string[] | undefined, limit = 12): string => (
  (values || []).map((value) => clean(value, 500)).filter(Boolean).slice(-limit).join('\n- ')
);

/**
 * Builds one precedence-aware context envelope for native harness providers.
 * The current turn remains authoritative; durable memory only supplements it.
 */
export function buildDurableAgentContext(input: DurableAgentContextInput): string {
  const session = input.designSession;
  const sections: string[] = [
    [
      '【上下文优先级】',
      '本轮明确要求 > 本轮附件 > 已确认硬约束 > 已批准资产 > 项目记忆 > 通用知识。',
      '历史内容与本轮冲突时必须服从本轮；候选稿和被拒绝稿不得作为视觉锚点。',
    ].join('\n'),
    `【当前项目】\n${clean(input.projectLabel, 500)}`,
    `【用户本轮请求（最高优先级）】\n${clean(input.currentRequest, 64_000)}`,
  ];

  if (input.attachmentManifest) {
    sections.push(`【本轮附件】\n${clean(input.attachmentManifest, 4_000)}`);
  }
  if (input.preferredAspectRatio) {
    sections.push(
      `【输出画布比例】\n${clean(input.preferredAspectRatio, 50)}（来源：${clean(input.preferredAspectRatioSource || '任务设置', 100)}）`,
    );
  }
  if (input.capabilityContract) {
    sections.push(`【用户锁定的能力契约】\n${clean(input.capabilityContract, 2_400)}`);
  }
  if (input.continuationInstruction) {
    sections.push(`【续编规则】\n${clean(input.continuationInstruction, 1_800)}`);
  }

  const constraints = list(session?.constraints);
  const forbidden = list(session?.forbiddenChanges);
  const approvedAssets = list(session?.approvedAssetIds, 12);
  const subjectAnchors = list(session?.subjectAnchors, 8);
  const styleHints = list(session?.styleHints, 12);
  if (constraints) sections.push(`【已确认硬约束】\n- ${constraints}`);
  if (forbidden) sections.push(`【禁止变更】\n- ${forbidden}`);
  if (approvedAssets || subjectAnchors) {
    sections.push([
      '【已批准视觉资产】',
      approvedAssets ? `资产：\n- ${approvedAssets}` : '',
      subjectAnchors ? `主体锚点：\n- ${subjectAnchors}` : '',
    ].filter(Boolean).join('\n'));
  }
  if (styleHints) sections.push(`【项目视觉方向】\n- ${styleHints}`);
  if (session?.referenceSummary) {
    sections.push(`【参考摘要】\n${clean(session.referenceSummary, 1_200)}`);
  }
  if (session?.researchSummary) {
    sections.push(`【研究摘要】\n${clean(session.researchSummary, 1_200)}`);
  }
  if (input.brandContext) sections.push(`【品牌信息】\n${clean(input.brandContext, 1_200)}`);
  if (input.retrievedMemory) {
    sections.push(`【按本轮需求检索到的项目记忆】\n${clean(input.retrievedMemory, 4_500)}`);
  }

  return sections.filter(Boolean).join('\n\n');
}
