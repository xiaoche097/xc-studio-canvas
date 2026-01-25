import React from 'react';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

export const StreamingText: React.FC<StreamingTextProps> = ({ content, isStreaming, className = '' }) => {
  // Simple markdown-ish rendering for bold and list items
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
          // Full line bold
           return <p key={i} className="mb-2 font-bold">{line.replace(/\*\*/g, '')}</p>
      }
      
      // Inline bold simple replacement
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const parsedLine = parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={idx}>{part.replace(/\*\*/g, '')}</strong>;
          }
          return part;
      });

      return <p key={i} className={`mb-2 leading-relaxed ${line === '' ? 'h-2' : ''}`}>{parsedLine}</p>;
    });
  };

  return (
    <div className={`text-text-secondary font-normal text-base ${className}`}>
      {renderContent(content)}
      {isStreaming && (
        <span className="inline-block w-2 h-5 bg-primary ml-1 animate-pulse align-middle" />
      )}
    </div>
  );
};