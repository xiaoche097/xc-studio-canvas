import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface CategoryPathProps {
  path: string;
}

export const CategoryPath: React.FC<CategoryPathProps> = ({ path }) => {
  if (!path || typeof path !== 'string') return null;
  const parts = path.split('>');
  const [isExpanded, setIsExpanded] = useState(false);

  if (parts.length <= 2 || isExpanded) {
    return (
      <div className="flex flex-wrap items-center text-xs text-gray-500">
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            <span className={i === parts.length - 1 ? 'font-medium text-gray-800 dark:text-gray-200' : ''}>
              {p.trim()}
            </span>
            {i < parts.length - 1 && <ChevronRight size={10} className="mx-1 text-gray-300" />}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center text-xs text-gray-500">
      <span>{parts[0].trim()}</span>
      <ChevronRight size={10} className="mx-1 text-gray-300" />
      <span onClick={() => setIsExpanded(true)} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 rounded px-1 transition-colors">...</span>
      <ChevronRight size={10} className="mx-1 text-gray-300" />
      <span className="font-medium text-gray-800 dark:text-gray-200">{parts[parts.length - 1].trim()}</span>
    </div>
  );
};
