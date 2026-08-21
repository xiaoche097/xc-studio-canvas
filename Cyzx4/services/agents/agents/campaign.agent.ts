import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { CAMPAIGN_SYSTEM_PROMPT, CAMPAIGN_AGENT_INFO } from '../prompts/campaign.prompt';

export class CampaignAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return CAMPAIGN_AGENT_INFO;
  }

  get systemPrompt() {
    return CAMPAIGN_SYSTEM_PROMPT;
  }

  get preferredSkills() {
    return [
      'generateImage',
      'generateVideo',
      'generateCopy',
      'export'
    ];
  }

  get maxConcurrency() { return 3; } // 图片密集型
}

export const campaignAgent = new CampaignAgent();
