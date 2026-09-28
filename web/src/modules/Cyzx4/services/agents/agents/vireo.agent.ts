import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { VIREO_SYSTEM_PROMPT, VIREO_AGENT_INFO } from '../prompts/vireo.prompt';

export class VireoAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return VIREO_AGENT_INFO;
  }

  get systemPrompt() {
    return VIREO_SYSTEM_PROMPT;
  }

  get preferredSkills() {
    return [
      'generateVideo',
      'generateImage',
      'smartEdit'
    ];
  }
}

export const vireoAgent = new VireoAgent();
