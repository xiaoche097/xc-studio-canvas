import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Bot, BookOpen } from 'lucide-react';

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentSettingsModal: React.FC<AgentSettingsModalProps> = ({ isOpen, onClose }) => {
  const [agentName, setAgentName] = useState('XcAI 首席电商视觉策划师');
  const [agentRole, setAgentRole] = useState('你是一个拥有10年经验的亚马逊/独立站电商视觉总监。你的目标是根据用户提供的产品信息或图片，策划出高转化率的视觉方案。');
  const [agentCapabilities, setAgentCapabilities] = useState('1. 深入分析产品卖点与目标市场\n2. 策划高转化率的电商图片（主图、副图、A+）\n3. 保持专业、精炼的语言风格');

  useEffect(() => {
    // Load from localStorage if exists
    const savedName = localStorage.getItem('agentName');
    const savedRole = localStorage.getItem('agentRole');
    const savedCapabilities = localStorage.getItem('agentCapabilities');
    
    if (savedName) setAgentName(savedName);
    if (savedRole) setAgentRole(savedRole);
    if (savedCapabilities) setAgentCapabilities(savedCapabilities);
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('agentName', agentName);
    localStorage.setItem('agentRole', agentRole);
    localStorage.setItem('agentCapabilities', agentCapabilities);
    onClose();
    // Dispatch an event to notify other components if needed
    window.dispatchEvent(new Event('agent-settings-updated'));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">智能体设定</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Customize your Agent's role and capabilities</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                智能体名称 (Agent Name)
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange outline-none transition-all dark:text-white"
                placeholder="例如：XcAI 电商视觉总监"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Bot className="w-4 h-4 text-gray-400" />
                角色设定 (Role Information)
              </label>
              <textarea
                value={agentRole}
                onChange={(e) => setAgentRole(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange outline-none transition-all resize-none dark:text-white"
                placeholder="描述该智能体的身份、背景及主要职责..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                能力与指令 (Capabilities & Instructions)
              </label>
              <textarea
                value={agentCapabilities}
                onChange={(e) => setAgentCapabilities(e.target.value)}
                rows={5}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange outline-none transition-all resize-none dark:text-white leading-relaxed"
                placeholder="列出该智能体需要遵循的具体规则、拥有的能力，或特殊工作流程..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-brand-orange text-white hover:bg-orange-600 transition-colors flex items-center gap-2 shadow-lg shadow-orange-500/20"
            >
              <Save className="w-4 h-4" />
              保存设定
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
