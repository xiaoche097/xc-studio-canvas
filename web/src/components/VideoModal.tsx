import React, { useState, useRef } from 'react';
import { UploadIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (image: string, duration: string, camera: string) => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [image, setImage] = useState<string | null>(null);
  const [duration, setDuration] = useState<string>("5s");
  const [camera, setCamera] = useState<string>("Zoom In");
  const inputRef = useRef<HTMLInputElement>(null);

  const durations = ["3s", "5s", "10s"];
  const cameras = ["Zoom In", "Zoom Out", "Pan Left", "Pan Right"];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
            >
                <div className="p-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            小彻工作站 <span className="text-xs font-normal px-2 py-1 bg-violet-500/10 text-violet-500 rounded-full border border-violet-500/20">Alpha</span>
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">上传参考图，生成高品质动态视频</p>
                    </div>

                    {/* Upload */}
                    <div 
                        className={`
                            relative h-64 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group mb-6
                            ${image ? 'border-transparent' : 'border-gray-200 dark:border-white/10 hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-white/5'}
                        `}
                        onClick={() => !image && inputRef.current?.click()}
                    >
                        {image ? (
                            <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden group">
                                <img src={image} className="w-full h-full object-cover" alt="Reference" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setImage(null)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:scale-105 transition-transform">更换图片</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-6">
                                <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-violet-500 transition-colors">
                                    <UploadIcon className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">上传视频参考首帧</p>
                            </div>
                        )}
                        <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                                 <span className="text-sm font-medium text-gray-600 dark:text-gray-300">时长:</span>
                                 <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                                    {durations.map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDuration(d)}
                                            className={`
                                                px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                                ${duration === d ? 'bg-white dark:bg-white/10 text-violet-500 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}
                                            `}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                 </div>
                             </div>

                             <div className="flex items-center gap-2">
                                 <span className="text-sm font-medium text-gray-600 dark:text-gray-300">运镜:</span>
                                 <select 
                                    value={camera} 
                                    onChange={(e) => setCamera(e.target.value)}
                                    className="bg-gray-100 dark:bg-white/5 border-none rounded-lg text-xs py-1.5 px-3 outline-none text-gray-700 dark:text-gray-200"
                                 >
                                    {cameras.map(c => <option key={c} value={c}>{c}</option>)}
                                 </select>
                             </div>
                        </div>

                        <button 
                            onClick={() => image && onConfirm(image, duration, camera)}
                            disabled={!image}
                            className={`
                                px-8 py-3 rounded-xl font-bold text-white shadow-xl transition-all
                                ${image ? 'bg-violet-600 hover:shadow-violet-600/30 hover:-translate-y-1' : 'bg-gray-300 dark:bg-white/10 cursor-not-allowed'}
                            `}
                        >
                            生成视频
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    </AnimatePresence>
  );
};
