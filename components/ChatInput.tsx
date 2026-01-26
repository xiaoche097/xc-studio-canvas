import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon, SendIcon } from './Icons';

interface ChatInputProps {
    onSend: (text: string, images: string[]) => void;
    isTyping?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isTyping }) => {
    const [inputValue, setInputValue] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const adjustHeight = () => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height
            textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`; // Set new height, max 128px (max-h-32)
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
    };

    useEffect(() => {
        adjustHeight();
    }, [inputValue]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    const handleSendClick = () => {
        if (!inputValue.trim() && selectedImages.length === 0) return;
        onSend(inputValue, selectedImages);
        setInputValue('');
        setSelectedImages([]);
        // Height will reset via useEffect
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (files.length + selectedImages.length > 5) {
                alert("Maximum 5 images allowed");
                return;
            }

            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setSelectedImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="absolute bottom-8 left-0 right-0 px-4 z-40 pointer-events-none">
            <div className="max-w-3xl mx-auto bg-white dark:bg-[#1e1e1e] p-2 rounded-[1.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-black/50 border border-gray-100 dark:border-white/10 pointer-events-auto transform transition-all focus-within:ring-2 ring-brand-blue/20 focus-within:border-brand-blue/50">

                {/* Helper to keep layout consistent when images are added */}
                {selectedImages.length > 0 && (
                    <div className="flex gap-2 p-2 mb-1 overflow-x-auto">
                        {selectedImages.map((img, idx) => (
                            <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shrink-0 group">
                                <img src={img} className="w-full h-full object-cover" alt="upload preview" />
                                <button
                                    onClick={() => removeImage(idx)}
                                    className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2 pl-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 text-gray-400 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-white/10 rounded-xl transition-colors shrink-0 mb-1"
                        title="Upload Image"
                    >
                        <UploadIcon className="w-5 h-5" />
                    </button>
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white text-base p-3 max-h-32 min-h-[52px] resize-none placeholder-gray-400 font-sans leading-relaxed"
                        rows={1}
                        style={{ minHeight: '52px' }}
                    />

                    <button
                        onClick={handleSendClick}
                        disabled={(!inputValue.trim() && selectedImages.length === 0)}
                        className={`
              p-3 rounded-xl transition-all duration-200 shrink-0 mb-1
              ${(inputValue.trim() || selectedImages.length > 0)
                                ? 'bg-brand-blue text-white shadow-md hover:opacity-90 active:scale-95'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed'}
            `}
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="text-center mt-3 text-xs text-gray-400 font-light pointer-events-none opacity-60">
                Based on Google Gemini 3.0 Pro • Venture Lightly
            </div>
        </div>
    );
};
