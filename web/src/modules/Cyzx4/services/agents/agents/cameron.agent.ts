import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { CAMERON_SYSTEM_PROMPT, CAMERON_AGENT_INFO } from '../prompts/cameron.prompt';

export class CameronAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return CAMERON_AGENT_INFO;
  }

  get systemPrompt() {
    return CAMERON_SYSTEM_PROMPT;
  }

  get preferredSkills() {
    return [
      'generateImage',
      'generateVideo',
      'generateCopy',
      'analyzeRegion'
    ];
  }
}

export const cameronAgent = new CameronAgent();
