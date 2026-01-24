import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gemini } from '../lib/gemini';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('user_gemini_api_key');
      if (stored) setApiKey(stored);
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!apiKey.trim()) {
      localStorage.removeItem('user_gemini_api_key');
      // If user clears it, we might want to reload or revert to env var.
      // Re-updating gemini client with empty string or env var
      // Here we assume env var fallback logic in gemini.ts update if we pass empty, 
      // BUT our updateApiKey logic simply takes newKey.
      // Ideally we pass env var if empty, but client doesn't export it.
      // Simple fix: reload page to reset to env var, OR just set user key.
      // Let's just set the user key.
    } else {
      localStorage.setItem('user_gemini_api_key', apiKey.trim());
    }
    
    // Update live instance
    gemini.updateApiKey(apiKey.trim() || import.meta.env.VITE_GEMINI_API_KEY || "");
    
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-white/10"
          >
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">设置</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">配置您的 AI 模型参数</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Gemini API Key
                  </label>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue outline-none transition-all text-gray-900 dark:text-white text-sm font-mono"
                  />
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    您的 Key 仅存储在本地浏览器中，绝不会发送到我们的服务器。
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleSave}
                  className={`px-6 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${
                    saved 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-brand-blue hover:bg-brand-blue/90 hover:-translate-y-0.5'
                  }`}
                >
                  {saved ? '已保存 ✓' : '保存配置'}
                </button>
              </div>
            </div>
            
            {/* Design Decoration */}
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
               <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
               </svg>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
