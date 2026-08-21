import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { ChatMessage } from '../../../types';
import { AgentMessage } from './AgentMessage';
import { useAgentStore } from '../../../stores/agent.store';
import { TaskProgress } from '../../../components/agents/TaskProgress';
import { MessageAttachments } from './MessageAttachments';
import type { Requirements, ModelGenOptions } from '../../../types/workflow.types';

interface MessageListProps {
    onSend: (text: string) => void;
    onSmartGenerate: (prompt: string, proposalId?: string) => void;
    onPreview: (url: string) => void;
    onClothingSubmitRequirements?: (data: Requirements) => void;
    onClothingGenerateModel?: (data: ModelGenOptions) => void;
    onClothingPickModelCandidate?: (url: string) => void;
    onClothingInsertToCanvas?: (url: string, label?: string) => void;
    onClothingRetryFailed?: () => void;
}

export const MessageList: React.FC<MessageListProps> = ({
    onSend,
    onSmartGenerate,
    onPreview,
    onClothingSubmitRequirements,
    onClothingGenerateModel,
    onClothingPickModelCandidate,
    onClothingInsertToCanvas,
    onClothingRetryFailed,
}) => {
    const messages = useAgentStore(s => s.messages);
    const isTyping = useAgentStore(s => s.isTyping);
    const currentTask = useAgentStore(s => s.currentTask);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentTask?.progressMessage]);

    return (
        <div className="space-y-4 pb-4 px-2 md:px-3">
            {messages.map(msg => (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    {msg.role === 'user' ? (
                        <div className="w-full max-w-[95%] xl:max-w-[90%] flex flex-col items-end gap-1.5">
                            {msg.skillData && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-200/60 rounded-full text-[11px] font-medium text-gray-500 mb-0.5">
                                    <Sparkles size={10} className="text-gray-400" />
                                    <span>来自：{msg.skillData.name}</span>
                                </div>
                            )}
                            <div className="w-full rounded-2xl bg-gray-100 px-4 py-3 flex flex-col gap-2 overflow-hidden">
                                <MessageAttachments 
                                    attachments={msg.attachments} 
                                   attachmentMetadata={msg.attachmentMetadata} 
                                   onPreview={onPreview} 
                                />
                                <div className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{msg.text}</div>
                            </div>
                        </div>
                    ) : msg.error && !msg.agentData ? (
                        <div className="max-w-[90%] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 whitespace-pre-wrap break-words">
                            {msg.text}
                        </div>
                    ) : (
                        <AgentMessage
                            message={msg}
                            onPreview={onPreview}
                            onAction={onSend}
                            onSmartGenerate={onSmartGenerate}
                            onClothingSubmitRequirements={onClothingSubmitRequirements}
                            onClothingGenerateModel={onClothingGenerateModel}
                            onClothingPickModelCandidate={onClothingPickModelCandidate}
                            onClothingInsertToCanvas={onClothingInsertToCanvas}
                            onClothingRetryFailed={onClothingRetryFailed}
                        />
                    )}
                </motion.div>
            ))}
            {/* 进度反馈已统一移至侧边栏输入框上方，此处仅在无任务状态时作为兜底显示 */}
            {isTyping && !currentTask && (
                <div className="flex justify-start mb-6 mt-2 ml-1">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shadow-lg text-white font-bold text-[9px] tracking-wide">
                            XC
                        </div>
                        <div className="flex items-center gap-2 pr-4">
                            <span className="text-[13px] text-gray-400 font-medium whitespace-nowrap">思考中...</span>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};
