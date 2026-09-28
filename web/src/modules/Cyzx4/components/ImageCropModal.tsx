import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Crop, RotateCw, RefreshCw, X, Check } from 'lucide-react';

const ImageCropModal: React.FC<{
  target: { url: string; file: File };
  onClose: () => void;
  onConfirmCrop: (newFile: File, newUrl: string) => void | Promise<void>;
}> = ({ target, onClose, onConfirmCrop }) => {
  const [saving, setSaving] = useState(false);
  const [cropError, setCropError] = useState('');
  const [displayUrl, setDisplayUrl] = useState(target.url);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [selectedRatio, setSelectedRatio] = useState<string>('2:3');
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  });

  const imgRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const startPosRef = useRef<{ x: number; y: number; box: { x: number; y: number; width: number; height: number } }>({
    x: 0,
    y: 0,
    box: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [onClose, saving]);

  useEffect(() => {
    let canceled = false;
    setImgNaturalSize(null);
    if (!rotation) {
      setDisplayUrl(target.url);
      const current = imgRef.current;
      if (current?.src === target.url && current.complete && current.naturalWidth) {
        setImgNaturalSize({ w: current.naturalWidth, h: current.naturalHeight });
      }
      return;
    }
    const source = new Image();
    source.onload = () => {
      if (canceled) return;
      const canvas = document.createElement('canvas');
      canvas.width = rotation % 180 ? source.naturalHeight : source.naturalWidth;
      canvas.height = rotation % 180 ? source.naturalWidth : source.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(rotation * Math.PI / 180);
      context.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2);
      setDisplayUrl(canvas.toDataURL('image/png'));
    };
    source.onerror = () => { if (!canceled) setCropError('图片读取失败，请重新上传。'); };
    source.src = target.url;
    return () => { canceled = true; };
  }, [target.url, rotation]);

  const handleImageLoad = () => {
    if (imgRef.current) {
      const w = imgRef.current.naturalWidth || imgRef.current.width;
      const h = imgRef.current.naturalHeight || imgRef.current.height;
      setImgNaturalSize({ w, h });
    }
  };

  // 根据 selectedRatio 与 imgNaturalSize 计算精准比例裁切框
  useEffect(() => {
    if (!imgNaturalSize || imgNaturalSize.w <= 0 || imgNaturalSize.h <= 0) return;
    const imgRatio = imgNaturalSize.w / imgNaturalSize.h;

    if (selectedRatio === 'free') return;

    let targetRatio = 2 / 3;
    if (selectedRatio === '1:1') targetRatio = 1;
    else if (selectedRatio === '3:4') targetRatio = 3 / 4;
    else if (selectedRatio === '2:3') targetRatio = 2 / 3;
    else if (selectedRatio === '9:16') targetRatio = 9 / 16;
    else if (selectedRatio === '16:9') targetRatio = 16 / 9;

    // 归一化坐标下的目标宽高比 w_norm / h_norm = targetRatio / imgRatio
    const targetNormRatio = targetRatio / imgRatio;

    let newH = 0.85;
    let newW = newH * targetNormRatio;

    if (newW > 0.85) {
      newW = 0.85;
      newH = newW / targetNormRatio;
    }

    const newX = (1 - newW) / 2;
    const newY = (1 - newH) / 2;

    setCropBox({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: Math.min(1, newW),
      height: Math.min(1, newH),
    });
  }, [selectedRatio, imgNaturalSize]);

  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    setDragHandle(handle);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      box: { ...cropBox },
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaX = (e.clientX - startPosRef.current.x) / rect.width;
      const deltaY = (e.clientY - startPosRef.current.y) / rect.height;

      const initialBox = startPosRef.current.box;
      let { x, y, width, height } = initialBox;

      if (dragHandle === 'move') {
        x = Math.max(0, Math.min(1 - width, initialBox.x + deltaX));
        y = Math.max(0, Math.min(1 - height, initialBox.y + deltaY));
      } else {
        const imgRatio = imgNaturalSize ? imgNaturalSize.w / imgNaturalSize.h : 1;
        let targetRatio: number | null = null;
        if (selectedRatio === '1:1') targetRatio = 1;
        else if (selectedRatio === '3:4') targetRatio = 3 / 4;
        else if (selectedRatio === '2:3') targetRatio = 2 / 3;
        else if (selectedRatio === '9:16') targetRatio = 9 / 16;
        else if (selectedRatio === '16:9') targetRatio = 16 / 9;

        if (targetRatio === null || selectedRatio === 'free') {
          if (dragHandle?.includes('w')) {
            const newX = Math.max(0, Math.min(initialBox.x + initialBox.width - 0.05, initialBox.x + deltaX));
            width = initialBox.x + initialBox.width - newX;
            x = newX;
          }
          if (dragHandle?.includes('e')) {
            width = Math.max(0.05, Math.min(1 - initialBox.x, initialBox.width + deltaX));
          }
          if (dragHandle?.includes('n')) {
            const newY = Math.max(0, Math.min(initialBox.y + initialBox.height - 0.05, initialBox.y + deltaY));
            height = initialBox.y + initialBox.height - newY;
            y = newY;
          }
          if (dragHandle?.includes('s')) {
            height = Math.max(0.05, Math.min(1 - initialBox.y, initialBox.height + deltaY));
          }
        } else {
          // 保持锁定比例 resize
          const targetNormRatio = targetRatio / imgRatio;

          if (dragHandle === 'se' || dragHandle === 'e' || dragHandle === 's') {
            width = Math.max(0.05, Math.min(1 - initialBox.x, initialBox.width + (dragHandle === 's' ? deltaY * targetNormRatio : deltaX)));
            height = width / targetNormRatio;
            if (initialBox.y + height > 1) {
              height = 1 - initialBox.y;
              width = height * targetNormRatio;
            }
          } else if (dragHandle === 'sw' || dragHandle === 'w') {
            width = Math.max(0.05, Math.min(initialBox.x + initialBox.width, initialBox.width - deltaX));
            height = width / targetNormRatio;
            if (initialBox.y + height > 1) {
              height = 1 - initialBox.y;
              width = height * targetNormRatio;
            }
            x = initialBox.x + initialBox.width - width;
          } else if (dragHandle === 'ne' || dragHandle === 'n') {
            width = Math.max(0.05, Math.min(1 - initialBox.x, initialBox.width + (dragHandle === 'n' ? -deltaY * targetNormRatio : deltaX)));
            height = width / targetNormRatio;
            if (initialBox.y + initialBox.height - height < 0) {
              height = initialBox.y + initialBox.height;
              width = height * targetNormRatio;
            }
            y = initialBox.y + initialBox.height - height;
          } else if (dragHandle === 'nw') {
            width = Math.max(0.05, Math.min(initialBox.x + initialBox.width, initialBox.width - deltaX));
            height = width / targetNormRatio;
            if (initialBox.y + initialBox.height - height < 0) {
              height = initialBox.y + initialBox.height;
              width = height * targetNormRatio;
            }
            x = initialBox.x + initialBox.width - width;
            y = initialBox.y + initialBox.height - height;
          }
        }
      }

      setCropBox({ x, y, width, height });
    },
    [isDragging, dragHandle, selectedRatio, imgNaturalSize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const resetCrop = () => {
    setRotation(0);
    setSelectedRatio('2:3');
    if (imgNaturalSize && imgNaturalSize.w > 0 && imgNaturalSize.h > 0) {
      const imgRatio = imgNaturalSize.w / imgNaturalSize.h;
      const targetNormRatio = (2 / 3) / imgRatio;
      let newH = 0.85;
      let newW = newH * targetNormRatio;
      if (newW > 0.85) {
        newW = 0.85;
        newH = newW / targetNormRatio;
      }
      setCropBox({ x: (1 - newW) / 2, y: (1 - newH) / 2, width: newW, height: newH });
    } else {
      setCropBox({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    }
  };

  const applyCrop = () => {
    if (!imgRef.current || !imgNaturalSize || saving) return;
    const image = imgRef.current;
    const naturalW = image.naturalWidth || image.width;
    const naturalH = image.naturalHeight || image.height;

    const cropX = Math.max(0, Math.round(cropBox.x * naturalW));
    const cropY = Math.max(0, Math.round(cropBox.y * naturalH));
    const cropW = Math.min(naturalW - cropX, Math.round(cropBox.width * naturalW));
    const cropH = Math.min(naturalH - cropY, Math.round(cropBox.height * naturalH));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(10, cropW);
    canvas.height = Math.max(10, cropH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    setSaving(true);
    canvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); setCropError('裁剪失败，请重试。'); return; }
      const newFile = new File([blob], target.file.name || 'cropped.png', { type: 'image/png' });
      const newUrl = URL.createObjectURL(blob);
      try { await onConfirmCrop(newFile, newUrl); onClose(); }
      catch { URL.revokeObjectURL(newUrl); setCropError('裁剪保存失败，请重试。'); }
      finally { setSaving(false); }
    }, 'image/png');
  };

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[130] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={() => { if (!saving) onClose(); }}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label="图片放大与裁切" tabIndex={-1}
        className="w-full max-w-4xl bg-white dark:bg-[#10192b] rounded-3xl overflow-hidden shadow-2xl border border-pastel-border flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pastel-border px-6 py-4 bg-slate-50 dark:bg-[#182338]">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-black text-pastel-text">图片放大与裁切 (默认2:3)</h3>
            <span className="text-xs text-pastel-muted hidden sm:inline">(拖动手柄调节裁切保留区域)</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-pastel-border text-xs font-bold">
              {['2:3', '1:1', '3:4', '9:16', '16:9', 'free'].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setSelectedRatio(ratio)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    selectedRatio === ratio
                      ? 'bg-orange-500 text-white font-black shadow-xs'
                      : 'text-pastel-muted hover:text-pastel-text'
                  }`}
                >
                  {ratio === 'free' ? '自由' : ratio}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-pastel-border hover:bg-slate-100 text-pastel-text"
              title="顺时针旋转 90°"
            >
              <RotateCw className="w-4 h-4 text-orange-500" />
            </button>

            <button
              type="button"
              onClick={resetCrop}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-pastel-border hover:bg-slate-100 text-pastel-text"
              title="重置裁剪"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => { if (!saving) onClose(); }}
              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-slate-950 flex items-center justify-center min-h-0 select-none">
          <div className="relative inline-block max-w-full max-h-[68vh]">
            <img
              ref={imgRef}
              src={displayUrl}
              alt="Crop Source"
              onLoad={handleImageLoad}
              className="block max-w-full max-h-[68vh] object-contain rounded-xl shadow-2xl select-none"
              onError={() => setCropError("图片无法读取，请重新上传。")}
            />

            <div
              className="absolute border-2 border-orange-500 shadow-2xl cursor-move flex flex-col justify-between"
              style={{
                left: `${cropBox.x * 100}%`,
                top: `${cropBox.y * 100}%`,
                width: `${cropBox.width * 100}%`,
                height: `${cropBox.height * 100}%`,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
            >
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                <div className="border-r border-b border-white/25" />
                <div className="border-r border-b border-white/25" />
                <div className="border-b border-white/25" />
                <div className="border-r border-b border-white/25" />
                <div className="border-r border-b border-white/25" />
                <div className="border-b border-white/25" />
                <div className="border-r border-white/25" />
                <div className="border-r border-white/25" />
                <div />
              </div>

              <div
                className="absolute -left-2 -top-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-full cursor-nwse-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'nw')}
              />
              <div
                className="absolute -right-2 -top-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-full cursor-nesw-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'ne')}
              />
              <div
                className="absolute -left-2 -bottom-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-full cursor-nesw-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'sw')}
              />
              <div
                className="absolute -right-2 -bottom-2 w-4 h-4 bg-orange-500 border-2 border-white rounded-full cursor-nwse-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'se')}
              />
              <div
                className="absolute left-1/2 -top-1.5 -translate-x-1/2 w-6 h-3 bg-orange-500 border border-white rounded-full cursor-ns-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'n')}
              />
              <div
                className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-6 h-3 bg-orange-500 border border-white rounded-full cursor-ns-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 's')}
              />
              <div
                className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-6 bg-orange-500 border border-white rounded-full cursor-ew-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'w')}
              />
              <div
                className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 bg-orange-500 border border-white rounded-full cursor-ew-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'e')}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-pastel-border bg-white dark:bg-[#182338]">
          <div className="text-xs font-bold text-pastel-muted">
            <span role={cropError ? 'alert' : undefined}>{cropError || (saving ? '正在保存裁剪…' : '选中区域将保留，其余区域将被裁剪舍弃')}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { if (!saving) onClose(); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-pastel-text text-xs font-bold rounded-xl transition-all"
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving || !imgNaturalSize}
              onClick={applyCrop}
              className="px-6 py-2.5 bg-orange-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md hover:brightness-105 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" /> 应用裁切并保留
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
