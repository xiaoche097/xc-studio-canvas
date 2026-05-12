import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, Sparkles, Loader2, User, Bot, Plus, Search, Trash2, History, Wand2, ChevronDown, Check } from 'lucide-react';
import { gemini } from '../../lib/gemini';
import { WorkflowStep } from '../../types';
import { AGENT_PROMPTS } from '../../data/agentPrompts';
import { useImagePaste } from '../hooks/useImagePaste';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    images?: string[];
    timestamp: number;
    proposedPrompt?: {
        prompt: string;
        aspect_ratio: string;
        reasoning: string;
    };
}

interface PlanningAgentTabProps {
    onImageGenerated?: (url: string) => void;
}

export const PlanningAgentTab: React.FC<PlanningAgentTabProps> = ({ onImageGenerated }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite-preview');
    const [selectedImageModel, setSelectedImageModel] = useState('gpt-image-2');
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [showImageModelMenu, setShowImageModelMenu] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const models = [
        { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', desc: '极速视觉策划' },
        { id: 'gpt-5.5', name: 'GPT-5.5 Global', desc: '最强逻辑推理' },
        { id: 'claude-opus-4-7id', name: 'Claude 4 Opus', desc: '深度文案策划' }
    ];

    const imageModels = [
        { id: 'gpt-image-2', name: 'Imagen 2.0', desc: '极致写实' },
        { id: 'nanobanana2', name: 'Banana 2.0', desc: '创意高质' },
        { id: 'nanobananapro', name: 'Banana Pro', desc: '专业摄影' }
    ];

    const systemPrompt = AGENT_PROMPTS[WorkflowStep.VISUAL_PLANNING_AGENT].systemPrompt;

    // Paste Support
    useImagePaste((files) => {
        const remainingSlot = 10 - images.length;
        files.slice(0, remainingSlot).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImages(prev => [...prev, reader.result as string].slice(0, 10));
            };
            reader.readAsDataURL(file);
        });
    });

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };


    useEffect(() => {
        // Initial state is empty as requested by user
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() && images.length === 0) return;
        if (isTyping) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            images: images.length > 0 ? [...images] : undefined,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setImages([]);
        setIsTyping(true);

        const aiMsgId = (Date.now() + 1).toString();
        const aiMsg: Message = {
            id: aiMsgId,
            role: 'ai',
            content: '',
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);

        try {
            const history = messages.map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const stream = await gemini.generateContentStream(
                userMsg.content,
                userMsg.images || [],
                history,
                systemPrompt,
                selectedModel
            );

            let fullContent = '';
            for await (const chunk of stream.stream) {
                const chunkText = chunk.text();
                fullContent += chunkText;
                setMessages(prev => prev.map(m => 
                    m.id === aiMsgId ? { ...m, content: fullContent } : m
                ));
            }

            const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    if (parsed.prompt) {
                        setMessages(prev => prev.map(m => 
                            m.id === aiMsgId ? { ...m, proposedPrompt: parsed } : m
                        ));
                    }
                } catch (e) {
                    console.warn("Failed to parse AI prompt JSON", e);
                }
            }

        } catch (error) {
            console.error("Agent Error:", error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            setMessages(prev => prev.map(m => 
                m.id === aiMsgId ? { ...m, content: m.content + `\n\n❌ **服务连接失败**\n错误信息: ${errorMsg}\n\n请检查网络或在“设置”中核对 API 密钥与中转地址。` } : m
            ));
        } finally {
            setIsTyping(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const remainingSlot = 10 - images.length;
            
            newFiles.slice(0, remainingSlot).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImages(prev => [...prev, reader.result as string].slice(0, 10));
                };
                reader.readAsDataURL(file);
            });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        const remainingSlot = 10 - images.length;

        files.slice(0, remainingSlot).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImages(prev => [...prev, reader.result as string].slice(0, 10));
                };
                reader.readAsDataURL(file);
            }
        });
    };

    const handleGenerateImage = async (promptData: any) => {
        setIsGeneratingImage(true);
        try {
            const refImages = messages.flatMap(m => m.images || []);
            const result = await gemini.generateImage(promptData.prompt, refImages, {
                aspectRatio: promptData.aspect_ratio || '3:4',
                model: promptData.model || selectedImageModel
            });
            if (onImageGenerated) onImageGenerated(result);
        } catch (error) {
            console.error("Image Generation Error:", error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            alert("图像生成失败: " + errorMsg);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    return (
        <div 
            className="flex h-full bg-white dark:bg-[#0D0D0D] overflow-hidden relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay - Refined & Less Obtrusive */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/5 dark:bg-black/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-md w-full p-10 rounded-[40px] border-2 border-dashed border-pastel-highlight/50 bg-white/95 dark:bg-[#1A1A1A]/95 flex flex-col items-center gap-5 shadow-2xl ring-1 ring-black/5"
                        >
                            <div className="w-20 h-20 rounded-full bg-pastel-highlight/10 flex items-center justify-center text-pastel-highlight">
                                <Plus className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">松手上传图片</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">最多可支持 10 张产品图进行视觉分析</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Sidebar - ChatGPT Style */}
            <aside className="w-64 bg-[#F9F9F9] dark:bg-[#000000] hidden lg:flex flex-col border-r border-gray-200 dark:border-white/5 transition-all">
                <div className="p-3">
                    <button 
                        onClick={() => { setMessages([]); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-white dark:bg-white/10 flex items-center justify-center border border-gray-200 dark:border-white/5 shadow-sm">
                                <Plus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">新对话</span>
                        </div>
                        <Search className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
                    <div className="px-3 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">最近对话</div>
                    
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center opacity-40">
                        <History className="w-8 h-8 mb-2 text-gray-400" />
                        <p className="text-[10px] text-gray-500">暂无历史对话</p>
                    </div>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col relative min-w-0 bg-white dark:bg-[#0D0D0D]">
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto custom-scrollbar"
                >
                    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-8">
                        {messages.length === 0 && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center py-20 text-center space-y-6"
                            >
                                <div className="w-16 h-16 rounded-full bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-xl">
                                    <Sparkles className="w-8 h-8 text-pastel-highlight" />
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
                                    你今天在想些什么？
                                </h1>
                            </motion.div>
                        )}

                        <AnimatePresence initial={false}>
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`flex gap-4 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 ${
                                            msg.role === 'user' ? 'bg-gray-100 dark:bg-white/10' : 'bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10'
                                        }`}>
                                            {msg.role === 'user' ? <User className="w-4 h-4 text-gray-600 dark:text-gray-300" /> : <Bot className="w-4 h-4 text-pastel-highlight" />}
                                        </div>
                                        
                                        <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`px-4 py-3 rounded-3xl text-[15px] leading-relaxed shadow-sm ${
                                                msg.role === 'user' 
                                                    ? 'bg-[#F4F4F4] dark:bg-[#2F2F2F] text-gray-800 dark:text-gray-100' 
                                                    : 'bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 text-gray-800 dark:text-gray-200'
                                            }`}>
                                                <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                                                    {msg.content || (msg.role === 'ai' && <Loader2 className="w-4 h-4 animate-spin opacity-50" />)}
                                                </div>
                                                
                                                {msg.images && msg.images.length > 0 && (
                                                    <div className="flex gap-2 mt-3 flex-wrap">
                                                        {msg.images.map((img, i) => (
                                                            <div key={i} className="relative group/img overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                                                                <img src={img} className="max-w-[300px] max-h-[300px] object-contain bg-white dark:bg-transparent" alt="Upload" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {msg.proposedPrompt && (
                                                <motion.div 
                                                    initial={{ scale: 0.95, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="w-full max-w-md mt-2 bg-white dark:bg-[#1A1A1A] border border-pastel-highlight/20 rounded-2xl p-5 shadow-lg overflow-hidden relative"
                                                >
                                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-pastel-highlight opacity-40"></div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2 text-pastel-highlight">
                                                            <Sparkles className="w-4 h-4" />
                                                            <span className="text-[11px] font-bold uppercase tracking-wider">视觉策划方案已就绪</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-gray-400 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">{msg.proposedPrompt.aspect_ratio}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-3 mb-4 border border-gray-100 dark:border-white/5">
                                                        <p className="text-[12px] text-gray-600 dark:text-gray-300 leading-relaxed italic">
                                                            "{msg.proposedPrompt.prompt}"
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2">
                                                        <p className="text-[10px] text-gray-400 font-medium px-1">请选择生成模型：</p>
                                                        <div className="flex flex-col gap-2">
                                                            {[
                                                                { id: 'gpt-image-2', name: 'Imagen 2.0', desc: '极致写实 · 商业级质感', color: 'bg-black dark:bg-white text-white dark:text-black' },
                                                                { id: 'nano-banana-pro', name: 'Banana Pro', desc: '专业摄影 · 真实光影', color: 'bg-pastel-highlight text-white' },
                                                                { id: 'nano-banana', name: 'Banana 2.0', desc: '极速生成 · 创意构图', color: 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200' }
                                                            ].map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    onClick={() => handleGenerateImage({ ...msg.proposedPrompt, model: m.id })}
                                                                    disabled={isGeneratingImage}
                                                                    className={`w-full group relative overflow-hidden px-4 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 ${m.color}`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[11px] font-bold">{m.name}</span>
                                                                            <span className="text-[9px] opacity-70">{m.desc}</span>
                                                                        </div>
                                                                        {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        
                        {isTyping && (
                            <div className="flex justify-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-sm">
                                    <Bot className="w-4 h-4 text-pastel-highlight" />
                                </div>
                                <div className="flex gap-1.5 pt-3">
                                    <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full bg-gradient-to-t from-white via-white to-transparent dark:from-[#0D0D0D] dark:via-[#0D0D0D] dark:to-transparent pt-10 pb-6">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="relative">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                {[
                                    { id: 'img', label: '生成图片', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                                    { id: 'edit', label: '撰写或编辑', icon: <Plus className="w-3.5 h-3.5" /> },
                                    { id: 'search', label: '查找资料', icon: <Search className="w-3.5 h-3.5" /> }
                                ].map(tool => (
                                    <button key={tool.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm">
                                        {tool.icon}
                                        {tool.label}
                                    </button>
                                ))}
                            </div>

                            <div className="relative group bg-[#F4F4F4] dark:bg-[#2F2F2F] rounded-[28px] p-2 transition-all shadow-sm border border-transparent focus-within:border-gray-300 dark:focus-within:border-white/20">
                                {images.length > 0 && (
                                    <div className="flex gap-2 p-2 px-3 overflow-x-auto no-scrollbar border-b border-gray-200 dark:border-white/10 mb-2">
                                        {images.map((img, i) => (
                                            <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden shadow-sm flex-shrink-0 group/preview">
                                                <img src={img} className="w-full h-full object-cover" alt="Preview" />
                                                <button 
                                                    onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                                    className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover/preview:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-end px-2">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
                                    >
                                        <Plus className="w-6 h-6" />
                                    </button>
                                    
                                    <textarea
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder="输入产品卖点、属性或平台需求..."
                                        className="flex-1 bg-transparent border-none outline-none py-3 px-1 text-sm resize-none max-h-48 min-h-[44px] text-gray-800 dark:text-gray-100 placeholder:text-gray-500"
                                        rows={1}
                                    />

                                    <div className="flex items-center gap-1 mb-2">
                                        {/* Text Model Switcher */}
                                        <div className="relative">
                                            <button 
                                                onClick={() => setShowModelMenu(!showModelMenu)}
                                                className={`p-2 transition-all rounded-xl ${showModelMenu ? 'text-pastel-highlight bg-white/10' : 'text-gray-500 hover:text-pastel-highlight'}`}
                                                title="切换对话模型"
                                            >
                                                <Bot className="w-5 h-5" />
                                            </button>
                                            <AnimatePresence>
                                                {showModelMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)}></div>
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                                            className="absolute bottom-full right-0 mb-4 w-44 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 p-1.5"
                                                        >
                                                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1">对话模型</div>
                                                            {models.map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    onClick={() => { setSelectedModel(m.id); setShowModelMenu(false); }}
                                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                                                                        selectedModel === m.id ? 'bg-pastel-highlight/10 text-pastel-highlight' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'
                                                                    }`}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <div className="text-[10px] font-bold">{m.name}</div>
                                                                        <div className="text-[8px] opacity-60">{m.desc}</div>
                                                                    </div>
                                                                    {selectedModel === m.id && <Check className="w-3 h-3" />}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Image Model Switcher */}
                                        <div className="relative mr-1">
                                            <button 
                                                onClick={() => setShowImageModelMenu(!showImageModelMenu)}
                                                className={`p-2 transition-all rounded-xl ${showImageModelMenu ? 'text-pastel-highlight bg-white/10' : 'text-gray-500 hover:text-pastel-highlight'}`}
                                                title="切换绘图模型"
                                            >
                                                <ImageIcon className="w-5 h-5" />
                                            </button>
                                            <AnimatePresence>
                                                {showImageModelMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowImageModelMenu(false)}></div>
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                                            className="absolute bottom-full right-0 mb-4 w-44 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 p-1.5"
                                                        >
                                                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1">绘图模型</div>
                                                            {imageModels.map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    onClick={() => { setSelectedImageModel(m.id); setShowImageModelMenu(false); }}
                                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                                                                        selectedImageModel === m.id ? 'bg-pastel-highlight/10 text-pastel-highlight' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'
                                                                    }`}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <div className="text-[10px] font-bold">{m.name}</div>
                                                                        <div className="text-[8px] opacity-60">{m.desc}</div>
                                                                    </div>
                                                                    {selectedImageModel === m.id && <Check className="w-3 h-3" />}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <button
                                            onClick={handleSend}
                                            disabled={(!input.trim() && images.length === 0) || isTyping}
                                            className={`p-2 rounded-full transition-all flex items-center justify-center ${
                                                (!input.trim() && images.length === 0) ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95'
                                            }`}
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p className="text-center text-[10px] text-gray-500 mt-3">
                                ChatGPT 会犯错。请核查重要信息。
                            </p>
                        </div>
                    </div>
                </div>
            </main>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                className="hidden" 
                onChange={handleImageUpload} 
                accept="image/*" 
            />
        </div>
    );
};
