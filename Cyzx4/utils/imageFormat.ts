export type OutputImageFormat = 'jpg' | 'png';

export const convertImageDataUrlFormat = (src: string, format: OutputImageFormat): Promise<string> => {
  return new Promise((resolve) => {
    if (!src) {
      resolve(src);
      return;
    }

    // 网络图片 URL（如 https://storage.googleapis.com/...）无需/禁止使用 Canvas 重新导出，防止 CORS 污染抛出 SecurityError
    if (/^https?:\/\//i.test(src)) {
      resolve(src);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        if (format === 'jpg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
      } catch (error) {
        console.warn('Canvas 格式转换受跨域限制失败，使用原图片地址:', error);
        resolve(src);
      }
    };

    img.onerror = () => {
      console.warn('图片加载失败，跳过格式转换并返回原图');
      resolve(src);
    };

    img.src = src;
  });
};

export const convertImageDataUrlsFormat = async (
  images: string[],
  format: OutputImageFormat
): Promise<string[]> => Promise.all(
  images.map(async (image) => {
    try {
      return await convertImageDataUrlFormat(image, format);
    } catch (error) {
      console.warn('Image format conversion failed. Using original image.', error);
      return image;
    }
  })
);

export const getImageDownloadExtension = (
  url: string,
  fallbackFormat: OutputImageFormat
): OutputImageFormat => {
  if (url.startsWith('data:image/png')) return 'png';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg';
  return fallbackFormat;
};
