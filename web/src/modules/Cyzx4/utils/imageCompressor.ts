export const compressImageFile = async (
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
  } = {}
): Promise<File> => {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    quality = 0.85,
    mimeType = 'image/jpeg',
  } = options;

  // Don't compress non-images or SVGs/GIFs that might lose animation/vector info easily
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  // Use a heuristic: if file is already small (e.g. < 500KB), compression might not be needed
  if (file.size < 500 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio boundaries
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(file); // fallback to original if canvas fails
          return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            // Create a new File from the blob
            const newFile = new File([blob], file.name, {
              type: mimeType,
              lastModified: Date.now(),
            });
            
            // Only use the compressed file if it is actually smaller
            if (newFile.size < file.size) {
              resolve(newFile);
            } else {
              resolve(file);
            }
          },
          mimeType,
          quality
        );
      };
      img.onerror = (error) => {
        console.error("Compression Image Error:", error);
        resolve(file); // fallback to original
      };
    };
    reader.onerror = (error) => {
      console.error("Compression Reader Error:", error);
      resolve(file); // fallback to original
    };
  });
};

export const compressImageFiles = async (
  files: File[],
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
  }
): Promise<File[]> => {
  return Promise.all(files.map(file => compressImageFile(file, options)));
};
