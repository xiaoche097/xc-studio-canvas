import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ListTodo } from 'lucide-react';

interface TaskPlannerProps {
  content: any; // string | { description: string, tasks: string[] }
}

export const TaskPlanner: React.FC<TaskPlannerProps> = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  let description = "任务执行计划";
  let tasks: string[] = [];

  if (typeof content === 'string') {
     const lines = content.split('\n').filter(l => l.trim().length > 0);
     description = lines[0];
     tasks = lines.slice(1);
  } else if (typeof content === 'object') {
     description = content.description || description;
     tasks = content.tasks || [];
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/5 rounded-xl overflow-hidden shadow-sm transition-all">
      <div 
        className="px-4 py-3 bg-gray-50/80 dark:bg-white/5 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
         <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
            <ListTodo size={16} className="text-indigo-500" />
            <span>任务规划</span>
         </div>
         <button className="text-gray-400">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
         </button>
      </div>
      
      {isExpanded && (
        <div className="p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
           <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{description}</p>
           {tasks.length > 0 && (
             <div className="space-y-3">
                {tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#F0F5FF] dark:bg-blue-900/10 px-4 py-3 rounded-xl border border-blue-50 dark:border-blue-900/20 text-[#2B579A] dark:text-blue-300">
                     <span className="w-6 h-6 rounded-full bg-white dark:bg-blue-800 text-[#2B579A] dark:text-blue-200 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                        {i + 1}
                     </span>
                     <span className="text-sm font-bold">{task.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                ))}
             </div>
           )}
        </div>
      )}
    </div>
  );
};
