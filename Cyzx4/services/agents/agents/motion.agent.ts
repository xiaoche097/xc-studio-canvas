import { EnhancedBaseAgent } from '../enhanced-base-agent';
import { MOTION_SYSTEM_PROMPT, MOTION_AGENT_INFO } from '../prompts/motion.prompt';

export class MotionAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return MOTION_AGENT_INFO;
  }

  get systemPrompt() {
    return MOTION_SYSTEM_PROMPT;
  }

  get preferredSkills() {
    return [
      'generateVideo',
      'generateImage',
      'smartEdit'
    ];
  }

  get maxConcurrency() { return 1; } // 视频生成资源重、限速严
}

export const motionAgent = new MotionAgent();
