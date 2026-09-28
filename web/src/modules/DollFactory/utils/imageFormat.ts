export type OutputImageFormat = 'jpg' | 'png';

export const convertImageDataUrlFormat = (src: string, format: OutputImageFormat): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not available.'));
        return;
      }

      if (format === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
    };

    img.onerror = () => reject(new Error('Image could not be loaded for format conversion.'));
    img.src = src;
  });
};

export const convertImageDataUrlsFormat = async (
  images: string[],
  format: OutputImageFormat
): Promise<string[]> => {
  const convertedImages = await Promise.all(
    images.map(async (image) => {
      try {
        return await convertImageDataUrlFormat(image, format);
      } catch (error) {
        console.warn('Image format conversion failed. Using original image.', error);
        return image;
      }
    })
  );

  return convertedImages;
};

export const getImageDownloadExtension = (
  url: string,
  fallbackFormat: OutputImageFormat
): OutputImageFormat => {
  if (url.startsWith('data:image/png')) return 'png';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg';
  return fallbackFormat;
};
