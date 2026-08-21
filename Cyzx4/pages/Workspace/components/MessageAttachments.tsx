import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

interface MessageAttachmentsProps {
  attachments?: string[];
  attachmentMetadata?: any[];
  onPreview?: (url: string) => void;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  attachmentMetadata,
  onPreview,
}) => {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1">
      {attachments.map((url, index) => {
        const metadata = attachmentMetadata?.[index];
        const isMarker = !!metadata?.markerInfo;
        
        return (
          <div key={`${url}-${index}`} className="relative group/chip">
            <button
              id={`msg-chip-${url}-${index}`}
              type="button"
              onClick={() => onPreview?.(url)}
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg pl-1 pr-2 py-0.5 select-none hover:bg-gray-50 transition duration-200 cursor-pointer shadow-sm"
              title={metadata?.markerName || `参考内容 ${index + 1}`}
            >
              <div className="w-5 h-5 rounded-sm overflow-hidden flex-shrink-0 bg-white">
                <img src={url} className="w-full h-full object-cover" />
              </div>
              <span className="text-[11px] text-gray-600 font-medium">
                {metadata?.markerName || `参考内容 ${index + 1}`}
              </span>
            </button>

            {/* 悬停放大预览窗 - 改为显示在下方，带两段式动画 */}
            {hoveredIdx === index && isMarker && metadata.markerInfo && (() => {
                const markerInfo = metadata.markerInfo;
                const MAX_SIZE = 220;
                const ratio = markerInfo.imageWidth / markerInfo.imageHeight;
                let renderWidth = MAX_SIZE;
                let renderHeight = MAX_SIZE;

                if (ratio > 1) {
                    renderHeight = MAX_SIZE / ratio;
                } else {
                    renderWidth = MAX_SIZE * ratio;
                }

                // 计算相对于按钮位置
                const chipEl = document.getElementById(`msg-chip-${url}-${index}`);
                const chipRect = chipEl?.getBoundingClientRect();
                if (!chipRect) return null;

                return ReactDOM.createPortal(
                    <div className="fixed z-[9999] pointer-events-none" style={{
                        left: chipRect.left + chipRect.width / 2 - renderWidth / 2,
                        top: chipRect.top + chipRect.height + 8,
                        width: renderWidth, height: renderHeight
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-full h-full bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200"
                        >
                            {/* 先显示全图，再缩放到标记区域 */}
                            <motion.div
                                className="absolute inset-0"
                                initial={{ scale: 1 }}
                                animate={{ scale: 3 }}
                                transition={{
                                    delay: 0.5,
                                    duration: 0.8,
                                    ease: [0.25, 0.1, 0.25, 1]
                                }}
                                style={{
                                    transformOrigin: `${(markerInfo.x + markerInfo.width / 2) / markerInfo.imageWidth * 100}% ${(markerInfo.y + markerInfo.height / 2) / markerInfo.imageHeight * 100}%`
                                }}
                            >
                                <img src={markerInfo.fullImageUrl || url} className="w-full h-full object-cover" />
                                {/* 覆盖标记点 */}
                                <div
                                    className="absolute"
                                    style={{
                                        left: `${(markerInfo.x + markerInfo.width / 2) / markerInfo.imageWidth * 100}%`,
                                        top: `${(markerInfo.y + markerInfo.height / 2) / markerInfo.imageHeight * 100}%`,
                                        transform: 'translate(-50%, -100%)',
                                        transformOrigin: 'bottom center'
                                    }}
                                >
                                    <motion.div
                                        className="relative flex flex-col items-center"
                                        initial={{ scale: 1, opacity: 0 }}
                                        animate={{ scale: 0.333, opacity: 1 }}
                                        transition={{ delay: 0.5, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                                        style={{ transformOrigin: 'bottom center' }}
                                    >
                                        <div className="w-[28px] h-[28px] rounded-full bg-[#3B82F6] border-2 border-white flex items-center justify-center text-white font-bold text-[12px] relative z-10 shadow-lg">
                                            {index + 1}
                                        </div>
                                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#3B82F6] -mt-[1px]"></div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>,
                    document.body
                );
            })()}
          </div>
        );
      })}
    </div>
  );
};
