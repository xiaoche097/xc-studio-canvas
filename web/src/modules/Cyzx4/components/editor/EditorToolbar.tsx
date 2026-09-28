
import React from 'react';
import { MousePointer2, Eraser, Camera, Download, RotateCcw, Image as ImageIcon, Sparkles, Move } from 'lucide-react';

interface EditorToolbarProps {
    mode: 'move' | 'point' | 'eraser' | 'camera';
    setMode: (mode: 'move' | 'point' | 'eraser' | 'camera') => void;
    onDownload: () => void;
    onReset: () => void;
    onCompareStart: () => void;
    onCompareEnd: () => void;
    hasPreEditImage: boolean;
    currentImage: string | null;
}

const ToolButton: React.FC<{
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`
      relative group flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300
      ${active
                ? 'bg-pastel-highlight text-white shadow-lg scale-105 shadow-pastel-pink/50'
                : 'text-pastel-muted hover:bg-pastel-bg hover:text-pastel-highlight'}
    `}
        title={label}
    >
        <div className={`w-5 h-5 ${active ? 'animate-pulse-slow' : ''}`}>{icon}</div>
        {/* Tooltip */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-pastel-text text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {label}
        </div>
    </button>
);

const EditorToolbar: React.FC<EditorToolbarProps> = ({
    mode,
    setMode,
    onDownload,
    onReset,
    onCompareStart,
    onCompareEnd,
    hasPreEditImage,
    currentImage
}) => {
    if (!currentImage) return null;

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-1 p-2 bg-pastel-card/90 backdrop-blur-xl border border-pastel-border/50 rounded-[2rem] shadow-2xl shadow-pastel-pink/20 ring-1 ring-pastel-border/50">

                {/* Core Tools */}
                <div className="flex items-center gap-1 pr-4 border-r border-pastel-border">
                    <ToolButton
                        active={mode === 'move'}
                        onClick={() => setMode('move')}
                        icon={<Move className="w-4 h-4" />}
                        label="移动视图"
                    />
                    <ToolButton
                        active={mode === 'point'}
                        onClick={() => setMode('point')}
                        icon={<MousePointer2 className="w-4 h-4" />}
                        label="智能选区"
                    />
                    <ToolButton
                        active={mode === 'eraser'}
                        onClick={() => setMode('eraser')}
                        icon={<Eraser className="w-4 h-4" />}
                        label="消除修复"
                    />
                    <ToolButton
                        active={mode === 'camera'}
                        onClick={() => setMode('camera')}
                        icon={<Camera className="w-4 h-4" />}
                        label="3D运镜"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pl-4">
                    <button
                        onClick={onDownload}
                        className="p-3 text-pastel-muted hover:text-pastel-highlight hover:bg-pastel-bg rounded-xl transition-colors"
                        title="下载图片"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onReset}
                        className="p-3 text-pastel-muted hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="重置画布"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    {hasPreEditImage && (
                        <button
                            onMouseDown={onCompareStart}
                            onMouseUp={onCompareEnd}
                            onMouseLeave={onCompareEnd}
                            onTouchStart={onCompareStart}
                            onTouchEnd={onCompareEnd}
                            className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-pastel-highlight bg-pastel-pink hover:bg-pastel-pinkhover rounded-xl transition-all active:scale-95 cursor-pointer select-none"
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span>按住对比</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EditorToolbar;
