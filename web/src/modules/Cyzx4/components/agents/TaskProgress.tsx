import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { AgentTask } from '../../types/agent.types';

export const TaskProgress: React.FC<{ task: AgentTask }> = ({ task }) => {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (task.status === 'executing') {
      const timer = setInterval(() => setSeconds(s => s + 1), 100);
      return () => clearInterval(timer);
    }
  }, [task.status]);
  if (task.status !== 'executing') return null;
  const timerValue = (seconds / 10).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-5 mb-4 group ring-1 ring-gray-100/50 rounded-xl overflow-hidden bg-[#F1F3F5] transition-all"
    >
      <div className="flex flex-col">
          {/* 极其低调的状态栏 */}
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-white/40">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Generating</span>
              <span className="text-[10px] text-gray-400 font-bold tabular-nums">{timerValue}s</span>
          </div>
          
          {/* 核心灰色占位 - 极简 */}
          <div className="h-28 flex items-center justify-center relative">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full ring-1 ring-gray-200">
                  <Loader2 size={12} className="text-blue-500 animate-spin" strokeWidth={3} />
                  <span className="text-[11px] font-bold text-gray-600">正在生成...</span>
              </div>
              
              {/* 微弱扫光 */}
              <motion.div 
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500/20"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 15, ease: "linear" }}
              />
          </div>
      </div>
    </motion.div>
  );
};
