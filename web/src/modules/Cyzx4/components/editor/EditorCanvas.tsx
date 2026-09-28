
import React from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { ImageResolution, AspectRatio, EditPoint } from '../../types';

interface EditorCanvasProps {
    currentImage: string | null;
    preEditImage: string | null;
    isComparing: boolean;
    mode: 'move' | 'point' | 'eraser' | 'camera';
    points: EditPoint[];
    brushSize: number;
    onCanvasInteraction: (e: React.MouseEvent | React.TouchEvent) => void;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    imgRef: React.RefObject<HTMLImageElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    isDragging: boolean;
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({
    currentImage,
    preEditImage,
    isComparing,
    mode,
    points,
    onCanvasInteraction,
    canvasRef,
    imgRef,
    containerRef,
    isDragging,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileUpload
}) => {
    return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-pastel-bg items-center justify-center p-12 select-none">
            {/* Background Pattern */}
            <div
                className="absolute inset-0 opacity-[0.05] pointer-events-none"
                style={{ backgroundImage: `radial-gradient(#D4869F 1px, transparent 1px)`, backgroundSize: `24px 24px` }}
            />

            {/* Interactive Container */}
            <div
                ref={containerRef}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`
          relative transition-all duration-300 z-10
          ${currentImage
                        ? 'shadow-2xl rounded-lg overflow-hidden ring-1 ring-pastel-border/50'
                        : 'w-[640px] h-[400px] rounded-3xl border-2 border-dashed border-pastel-border flex flex-col items-center justify-center hover:border-pastel-highlight hover:bg-pastel-card/50 bg-pastel-card/30 backdrop-blur-sm'
                    }
          ${isDragging ? '!border-pastel-highlight bg-pastel-pink/20 scale-[1.02]' : ''}
`}
            >
                {isDragging && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md rounded-3xl animate-in fade-in duration-200">
                        <div className="p-4 bg-pastel-pink/20 rounded-full mb-4">
                            <Upload className="w-8 h-8 text-pastel-highlight animate-bounce" />
                        </div>
                        <p className="text-lg font-bold text-pastel-text">Drop Image Here</p>
                    </div>
                )}

                {currentImage ? (
                    <>
                        {/* Base Image Layer */}
                        <img
                            ref={imgRef}
                            src={isComparing && preEditImage ? preEditImage : currentImage}
                            alt="Canvas"
                            className="block max-w-[full] max-h-[85vh] object-contain pointer-events-none select-none"
                            onLoad={(e) => {
                                const img = e.currentTarget;
                                if (canvasRef.current) {
                                    canvasRef.current.width = img.clientWidth;
                                    canvasRef.current.height = img.clientHeight;
                                }
                            }}
                        />

                        {/* Canvas Drawing Layer (Eraser/Mask) */}
                        <canvas
                            ref={canvasRef}
                            className={`absolute inset-0 z-10 ${mode === 'move' ? 'pointer-events-none' : 'cursor-crosshair'} `}
                            onMouseDown={onCanvasInteraction}
                            onMouseMove={onCanvasInteraction}
                            onMouseUp={onCanvasInteraction}
                            onMouseLeave={onCanvasInteraction}
                            onTouchStart={onCanvasInteraction}
                            onTouchMove={onCanvasInteraction}
                            onTouchEnd={onCanvasInteraction}
                        />

                        {/* Points Overlay */}
                        {points.map((p, idx) => (
                            <div
                                key={p.id}
                                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            >
                                <div className="group/point animate-in zoom-in duration-300">
                                    <div className="w-8 h-8 bg-pastel-highlight text-white rounded-full border-[3px] border-white shadow-lg flex items-center justify-center text-xs font-bold transform transition-transform group-hover/point:scale-110">
                                        {idx + 1}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="text-center p-8">
                        <div className="w-20 h-20 bg-pastel-input rounded-2xl flex items-center justify-center mx-auto mb-6 border border-pastel-border">
                            <ImageIcon className="w-8 h-8 text-pastel-border" />
                        </div>
                        <h3 className="text-xl font-bold text-pastel-text mb-2">拖拽上传图片</h3>
                        <p className="text-sm text-pastel-muted mb-8 font-medium">支持 JPG, PNG, WEBP 格式</p>

                        <label className="inline-flex items-center gap-2 px-8 py-3 bg-pastel-highlight text-white rounded-xl font-bold text-sm hover:bg-pastel-pinkhover transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform duration-200">
                            <Upload className="w-4 h-4" />
                            <span>选择文件</span>
                            <input type="file" accept="image/*" onChange={onFileUpload} className="hidden" />
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorCanvas;
