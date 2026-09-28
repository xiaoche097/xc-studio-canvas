import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { AgentProposal } from '../../types/agent.types';

interface ProposalSelectorProps {
  proposals: AgentProposal[];
  onSelect: (proposal: AgentProposal) => void;
  isExecuting?: boolean;
}

export const ProposalSelector: React.FC<ProposalSelectorProps> = ({
  proposals,
  onSelect,
  isExecuting = false
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (proposal: AgentProposal) => {
    setSelectedId(proposal.id);
    onSelect(proposal);
  };

  return (
    <div className="space-y-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Sparkles className="w-4 h-4" />
        <span>Choose a design direction:</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {proposals.map((proposal, index) => {
            const isSelected = selectedId === proposal.id;

            return (
              <motion.button
                key={proposal.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  delay: index * 0.1,
                  type: 'spring',
                  stiffness: 300,
                  damping: 25
                }}
                whileHover={{ scale: isExecuting ? 1 : 1.02, y: isExecuting ? 0 : -4 }}
                whileTap={{ scale: isExecuting ? 1 : 0.98 }}
                onClick={() => !isExecuting && handleSelect(proposal)}
                disabled={isExecuting}
                className={`
                  relative p-4 rounded-xl text-left transition-all
                  ${isSelected
                    ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500'
                    : 'bg-white border border-gray-200 hover:border-purple-300 hover:shadow-md'
                  }
                  ${isExecuting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                )}

                {proposal.preview && (
                  <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={proposal.preview}
                      alt={proposal.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {proposal.title}
                </h3>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {proposal.description}
                </p>

                {isSelected && isExecuting && (
                  <motion.div
                    className="absolute inset-0 bg-purple-500/10 rounded-xl flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex items-center gap-2 text-sm text-purple-600">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles className="w-4 h-4" />
                      </motion.div>
                      <span>Generating...</span>
                    </div>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
