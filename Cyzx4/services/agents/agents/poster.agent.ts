import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { POSTER_SYSTEM_PROMPT, POSTER_AGENT_INFO } from '../prompts/poster.prompt';

export class PosterAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return POSTER_AGENT_INFO;
  }

  get systemPrompt() {
    return POSTER_SYSTEM_PROMPT;
  }

  get preferredSkills() {
    return [
      'generateImage',
      'generateCopy',
      'extractText'
    ];
  }

  get maxConcurrency() { return 3; } // 图片密集型
}

export const posterAgent = new PosterAgent();
