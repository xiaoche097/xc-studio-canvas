const WHITE_BG_CACHE = new Map<string, string>();

export async function ensureWhiteBackground(inputUrlOrBlob: string | Blob): Promise<string> {
  const key = typeof inputUrlOrBlob === 'string' ? inputUrlOrBlob : `blob:${inputUrlOrBlob.size}:${inputUrlOrBlob.type}`;
  const cached = WHITE_BG_CACHE.get(key);
  if (cached) return cached;

  const imageUrl = typeof inputUrlOrBlob === 'string' ? inputUrlOrBlob : URL.createObjectURL(inputUrlOrBlob);
  const image = await loadImage(imageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法初始化 Canvas 上下文');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, 'image/png', 0.98);
  const outputUrl = URL.createObjectURL(blob);
  WHITE_BG_CACHE.set(key, outputUrl);
  return outputUrl;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败，无法执行白底后处理'));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('白底后处理失败，无法导出图片'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}
