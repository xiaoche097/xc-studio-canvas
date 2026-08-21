import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { CLOTHING_SYSTEM_PROMPT, CLOTHING_AGENT_INFO } from '../prompts/clothing.prompt';

export class ClothingAgent extends EnhancedBaseAgent {
  get agentInfo() {
    // Note: uses AgentType 'campaign' under the hood in registry; this is a specialized prompt.
    return {
      ...CLOTHING_AGENT_INFO,
      id: 'campaign',
    } as any;
  }

  get systemPrompt() {
    return CLOTHING_SYSTEM_PROMPT;
  }

  get preferredSkills() {
    return [
      'generateImage',
    ];
  }
}

export const clothingAgent = new ClothingAgent();
