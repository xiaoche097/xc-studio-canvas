import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LayoutList } from 'lucide-react';

interface TaskPlannerProps {
   content: any; // string | { description: string, tasks: string[] }
}

export const TaskPlanner: React.FC<TaskPlannerProps> = ({ content }) => {
   const [isExpanded, setIsExpanded] = useState(true);

   let description = "根据您的需求，我将执行以下任务：";
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
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
         <div
            className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
         >
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <LayoutList size={18} />
               </div>
               <span className="font-bold text-gray-900 dark:text-gray-100 text-base">任务规划</span>
            </div>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
               {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
         </div>

         {isExpanded && (
            <div className="px-6 pb-6 pt-2">
               {tasks.length > 0 ? (
                  <div className="space-y-6">
                     {tasks.map((task, i) => {
                        // Attempt to split title and description if separated by ":" or "\n"
                        const [title, ...descParts] = task.replace(/^\d+\.\s*/, '').split(/[:：]/);
                        const desc = descParts.join(':').trim();

                        return (
                           <div key={i} className="flex gap-4">
                              <div className="shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold mt-0.5">
                                 {i + 1}
                              </div>
                              <div className="space-y-1">
                                 <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h4>
                                 {desc && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                       {desc}
                                    </p>
                                 )}
                                 {/* If no colon split, check if it's just a long text and maybe treat as title */}
                                 {!desc && title.length > 20 && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                                       {title}
                                    </p>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               ) : (
                  <p className="text-sm text-gray-500">{description}</p>
               )}
            </div>
         )}
      </div>
   );
};
