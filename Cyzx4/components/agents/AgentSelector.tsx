import React from 'react';
import { motion } from 'framer-motion';
import { AgentType } from '../../types/agent.types';
import { getAgentInfo } from '../../services/agents';

interface AgentSelectorProps {
  currentAgent: AgentType;
  onSelect: (agentId: AgentType) => void;
}

const AGENTS: AgentType[] = ['coco', 'vireo', 'poster', 'cameron', 'package', 'motion', 'campaign'];

export const AgentSelector: React.FC<AgentSelectorProps> = ({ currentAgent, onSelect }) => {
  return (
    <div className="flex gap-2 p-2 bg-white/5 rounded-lg overflow-x-auto">
      {AGENTS.map(agentId => {
        const info = getAgentInfo(agentId);
        const isActive = currentAgent === agentId;

        return (
          <motion.button
            key={agentId}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(agentId)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              isActive ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
            style={{
              borderColor: isActive ? info.color : 'transparent',
              borderWidth: 1
            }}
          >
            <span>{info.avatar}</span>
            <span className="text-sm" style={{ color: isActive ? info.color : '#888' }}>
              {info.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
