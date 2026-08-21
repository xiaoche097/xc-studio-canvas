const RE_OPTIMIZE = /(优化|改写|润色|重写|完善|精炼|优化一下|提升一下).{0,6}(提示词|prompt|咒语|指令)/i;
const RE_OPTIMIZE_VERB = /(优化|改写|润色|重写|完善|精炼|提升一下)/i;
const RE_PROMPT_NOUN = /(提示词|prompt|咒语|指令)/i;
const RE_PROMPT_THEN_OPTIMIZE = /(提示词|prompt|咒语|指令).{0,10}(优化|改写|润色|重写|完善|精炼|提升一下)/i;
const RE_EXECUTE = /(执行|生成|出图|画|制作|输出|做一张|做个|帮我做)/i;
const RE_OPTIMIZE_ONLY =
  /(只|仅).{0,6}(优化|改写|润色).{0,6}(提示词|prompt)|不要执行|不需要生成|不出图/i;

export function detectOptimizeOnlyIntent(text: string): boolean {
  if (RE_OPTIMIZE_ONLY.test(text)) return true;
  const hasOptimizeTopic =
    RE_OPTIMIZE.test(text) ||
    RE_PROMPT_THEN_OPTIMIZE.test(text) ||
    (RE_OPTIMIZE_VERB.test(text) && RE_PROMPT_NOUN.test(text));
  if (hasOptimizeTopic && !RE_EXECUTE.test(text)) return true;
  return false;
}

export function detectOptimizeThenExecuteIntent(text: string): boolean {
  if (RE_OPTIMIZE_ONLY.test(text)) return false;

  const hasOptimize =
    RE_OPTIMIZE.test(text) ||
    RE_PROMPT_THEN_OPTIMIZE.test(text) ||
    RE_OPTIMIZE_VERB.test(text);
  if (!hasOptimize) return false;

  const pipelineStrong =
    /(先|先把|先将).{0,10}(优化|改写|润色|重写).{0,10}(再|然后)/i.test(text) ||
    /(优化(后|完|好了|一下))/i.test(text);

  if (!pipelineStrong) return false;
  return RE_EXECUTE.test(text);
}

const AGENT_ALIASES: Array<[string, RegExp]> = [
  ['coco', /(coco|可可)/i],
  ['cameron', /(cameron|卡梅隆)/i],
  ['vireo', /(vireo)/i],
  ['campaign', /(campaign)/i],
  ['poster', /(poster)/i],
  ['package', /(package)/i],
  ['motion', /(motion)/i],
];

export function detectExplicitAgentPin(text: string): string | null {
  const pinCue = /(用|交给|让|请|给).{0,4}([a-zA-Z]+|coco|cameron|vireo|campaign|poster|package|motion|可可|卡梅隆)/i;
  if (!pinCue.test(text)) return null;

  for (const [id, re] of AGENT_ALIASES) {
    if (re.test(text)) return id;
  }
  return null;
}

export function stripOptimizePipelineCommand(text: string): string {
  return text
    .replace(/先把?\s*/g, '')
    .replace(/先将\s*/g, '')
    .replace(/提示词\s*/g, '提示词 ')
    .replace(/(优化|改写|润色|重写).{0,10}(再|然后)/g, '')
    .replace(/优化(后|完|好了|一下)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
