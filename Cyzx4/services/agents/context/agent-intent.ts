import type { AgentIntent } from '../../../stores/useAgentContextStore';
import type { AgentContext } from './buildAgentContext';

const EXECUTE_PLAN_COMMANDS = new Set([
  '生成',
  '生成吧',
  '开始生成',
  '就这个',
  '可以',
  '继续',
  '开始吧',
  '按这个做',
  '执行吧',
]);

const REGENERATE_COMMANDS = new Set([
  '再来一张',
  '再来一个',
  '重新生成',
  '换一个',
  '换一版',
  '重做',
]);

const normalizeIntentText = (message: string): string => message
  .trim()
  .toLowerCase()
  .replace(/[，。！？、,.!?]/g, '')
  .replace(/\s+/g, '');

export function detectFollowUpIntent(
  message: string,
  context: AgentContext,
): AgentIntent {
  const normalized = normalizeIntentText(message);
  const hasPlan = Boolean(context.generation.prompt);

  if (
    hasPlan
    && (
      REGENERATE_COMMANDS.has(normalized)
      || /^(再|重新|换)(来|生成|做|出)?.{0,4}(一张|一个|一版)?$/.test(normalized)
    )
  ) {
    return 'REGENERATE';
  }

  if (
    hasPlan
    && (
      EXECUTE_PLAN_COMMANDS.has(normalized)
      || /^(按|就按)(这个|刚才的|上面的)?(方案|计划)?(生成|执行|做)?$/.test(normalized)
    )
  ) {
    return 'EXECUTE_CURRENT_PLAN';
  }

  if (
    hasPlan
    && /更|改|调整|换成|不要|增加|减少|日常|高级|明亮|暗一点|颜色|背景|场景|构图|比例|风格/.test(normalized)
  ) {
    return 'UPDATE_CURRENT_PLAN';
  }

  return 'NEW_TASK';
}
