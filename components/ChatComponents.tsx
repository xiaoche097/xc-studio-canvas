import React, { ReactNode } from 'react';
import { RobotIcon, UserIcon } from './Icons';
import { Role } from '../types';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: Role;
  content?: string;
  image?: string | null;
  images?: string[];
  component?: ReactNode;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, image, images, component }) => {
  const isAI = role === 'ai';
  // Combine single image and array for display
  const allImages = [...(images || [])];
  if (image && !allImages.includes(image)) {
      allImages.unshift(image);
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex gap-3 px-4 ${isAI ? 'flex-row' : 'flex-row-reverse'} w-full max-w-5xl mx-auto`}
    >
      {/* Avatar */}
      <div 
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1
        ${isAI 
          ? 'bg-white border border-gray-100 overflow-hidden p-1' 
          : 'bg-brand-blue text-white'}`}
      >
        {isAI ? <RobotIcon className="text-gray-700 w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
      </div>
      
      {/* Content */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[75%] space-y-2 ${isAI ? 'items-start' : 'items-end'}`}>
        
        {/* Name (Optional, good for Lobe style) */}
        {isAI && <span className="text-xs font-bold text-gray-500 ml-1">Gemini</span>}

        {/* Text Bubble */}
        {content && (
          <div 
            className={`px-4 py-3 text-sm leading-relaxed shadow-sm transition-all
            ${isAI 
              ? 'bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-white/10 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-none' 
              : 'bg-brand-blue text-white border border-brand-blue rounded-2xl rounded-tr-none'}`}
          >
            {isAI ? (
               <div className="markdown-body prose prose-sm dark:prose-invert max-w-none break-words">
                   <ReactMarkdown 
                     components={{
                       strong: ({node, ...props}) => <span className="font-bold text-gray-900 dark:text-white" {...props} />,
                       ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 space-y-1 my-2" {...props} />,
                       ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 space-y-1 my-2" {...props} />,
                       li: ({node, ...props}) => <li className="pl-1" {...props} />,
                       p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                       // Fix for overflow: Custom code block
                       code: ({node, inline, className, children, ...props}: any) => {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline ? (
                            <pre className="block w-full p-3 my-2 rounded-lg bg-gray-100 dark:bg-black/30 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-words border border-gray-200 dark:border-white/5" {...props}>
                              <code className={className} {...props}>{children}</code>
                            </pre>
                          ) : (
                            <code className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-brand-orange" {...props}>{children}</code>
                          )
                       },
                       // Simple table styling
                       table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 border dark:border-white/10" {...props} /></div>,
                       th: ({node, ...props}) => <th className="px-3 py-2 bg-gray-50 dark:bg-white/5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left" {...props} />,
                       td: ({node, ...props}) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-white/5" {...props} />,
                     }}
                   >
                     {content}
                   </ReactMarkdown>
               </div>
            ) : (
                <div className="whitespace-pre-wrap break-words">{content}</div>
            )}
          </div>
        )}

        {/* Image Attachments */}
        {allImages.length > 0 && (
          <div className={`grid gap-2 ${allImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {allImages.map((img, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm bg-white dark:bg-black/20">
                    <img src={img} alt={`Attachment ${idx}`} className="max-w-full max-h-48 object-cover hover:scale-105 transition-transform duration-300 cursor-zoom-in" />
                </div>
            ))}
          </div>
        )}
        
        {/* Render Card if present */}
        {component && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="w-full"
          >
            {component}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export const TypingIndicator: React.FC = () => (
  <motion.div 
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="flex gap-3 px-4 w-full max-w-5xl mx-auto items-center"
  >
    <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
        <RobotIcon className="text-gray-400 w-5 h-5" />
    </div>
    <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-1">
      <motion.div className="w-1.5 h-1.5 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0 }} />
      <motion.div className="w-1.5 h-1.5 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }} />
      <motion.div className="w-1.5 h-1.5 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }} />
    </div>
  </motion.div>
);