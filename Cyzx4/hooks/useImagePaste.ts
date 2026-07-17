import { useEffect, useCallback } from 'react';

/**
 * Hook to handle image pasting from the clipboard (Ctrl+V)
 * @param onFilesPasted Callback function when images are pasted
 * @param isActive Whether the listener should be active (defaults to true)
 */
export const useImagePaste = (onFilesPasted: (files: File[]) => void, isActive: boolean = true) => {
  const handlePaste = useCallback((event: ClipboardEvent) => {
    // Hidden workspaces stay mounted to preserve their state. A paste event
    // reaches every window listener, so only the active, first handler may
    // consume it.
    if (!isActive || event.defaultPrevented) return;

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

    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    // Browsers expose pasted screenshots through `items`, while copied files
    // (especially from Windows Explorer) may only be available through `files`.
    const filesByIdentity = new Map<string, File>();
    const addImageFile = (file: File | null) => {
      if (!file || !file.type.startsWith('image/')) return;
      const identity = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
      filesByIdentity.set(identity, file);
    };

    let foundImageItem = false;
    for (const item of clipboardData.items) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      foundImageItem = true;
      addImageFile(file);
    }

    // The same clipboard image is commonly exposed through both collections.
    // `getAsFile()` and `files[0]` may have different generated names or
    // timestamps, so signature-only deduplication is not reliable. Treat
    // `files` as a browser fallback when no image item was available.
    if (!foundImageItem) {
      for (const file of clipboardData.files) addImageFile(file);
    }

    const files = Array.from(filesByIdentity.values());

    if (files.length > 0) {
      event.preventDefault();
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
