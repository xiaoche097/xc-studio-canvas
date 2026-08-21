import React from 'react';
import { AgentType } from '../../types/agent.types';
import { getAgentInfo } from '../../services/agents';

interface AgentAvatarProps {
  agentId: AgentType;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({ agentId, size = 'md', showName = false }) => {
  const info = getAgentInfo(agentId);
  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-12 h-12 text-xl'
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center`}
        style={{ backgroundColor: info.color + '20' }}
      >
        <span>{info.avatar}</span>
      </div>
      {showName && (
        <span className="text-sm font-medium" style={{ color: info.color }}>
          {info.name}
        </span>
      )}
    </div>
  );
};
