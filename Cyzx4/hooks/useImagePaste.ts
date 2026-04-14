import { useEffect, useCallback } from 'react';

/**
 * Hook to handle image pasting from the clipboard (Ctrl+V)
 * @param onFilesPasted Callback function when images are pasted
 * @param isActive Whether the listener should be active (defaults to true)
 */
export const useImagePaste = (onFilesPasted: (files: File[]) => void, isActive: boolean = true) => {
  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (!isActive) return;

    // Don't intercept if user is typing in a text input/textarea
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;
    
    // However, if it's a contentEditable (like our prompt editor), we might want to allow images 
    // but in some contexts we prefer the image to go to the upload zone instead of the editor.
    // For now, if it's a standard input/textarea, we skip unless it's the specific target we want.
    if (isInput && !target.hasAttribute('data-allow-paste-image')) {
      // If it's a text input, we only allow pasting images if specifically intended.
      // But for image-to-image workflows, we usually want images to go to the uploader.
      // Let's check if items contain files.
      const items = event.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            // It is an image. If it's a text input, we might want to prevent the default 
            // text-paste behavior if we are handling the image.
            // But let's be conservative: if it's a text input, let browser handle it 
            // UNLESS we want to intercept.
            // Actually, for this app, users usually want images to go to the generation bank.
          }
        }
      }
    }

    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      // Prevent double handling if needed
      // event.preventDefault(); 
      onFilesPasted(files);
    }
  }, [onFilesPasted, isActive]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);
};
