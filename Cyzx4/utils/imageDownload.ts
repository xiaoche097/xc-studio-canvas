const fetchImageResponse = async (source: string): Promise<Response> => {
  const fetchThroughProxy = async (): Promise<Response> => {
    const proxyResponse = await fetch(`/api/image-download?url=${encodeURIComponent(source)}`);
    if (!proxyResponse.ok) throw new Error(`Image proxy returned ${proxyResponse.status}`);
    const proxyType = proxyResponse.headers.get('content-type') || '';
    if (!proxyType.toLowerCase().startsWith('image/')) throw new Error('Image proxy did not return an image');
    return proxyResponse;
  };

  // Google Storage 托管的所有生成图（virse-images / sirius-images 等）均走同源代理，确保 Canvas 无跨域污染问题
  if (/^https?:\/\/storage\.googleapis\.com\//i.test(source)) {
    return fetchThroughProxy();
  }

  try {
    const directResponse = await fetch(source, { mode: 'cors' });
    if (!directResponse.ok) throw new Error(`Remote image returned ${directResponse.status}`);
    const directType = directResponse.headers.get('content-type') || '';
    if (!directType.toLowerCase().startsWith('image/')) throw new Error('Remote response is not an image');
    return directResponse;
  } catch (directError) {
    console.warn('Direct image download was blocked; retrying through the same-origin proxy.', directError);
    return fetchThroughProxy();
  }
};

export const fetchImageBlob = async (source: string): Promise<Blob> => {
  const response = /^https?:\/\//i.test(source)
    ? await fetchImageResponse(source)
    : await fetch(source);
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);

  const blob = await response.blob();
  if (!blob.type.toLowerCase().startsWith('image/')) {
    throw new Error('Downloaded content is not an image');
  }
  return blob;
};

export const getCroppedImageBlob = async (source: string, topCropRatio = 0.12): Promise<Blob> => {
  const blob = await fetchImageBlob(source);
  if (topCropRatio <= 0) return blob;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    const cropY = Math.round(origH * topCropRatio);
    const targetH = origH - cropY;

    canvas.width = origW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    ctx.drawImage(img, 0, cropY, origW, targetH, 0, 0, origW, targetH);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || blob), 'image/png');
    });
  } catch (err) {
    console.warn('CORS-safe canvas crop failed, downloading original blob:', err);
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const downloadImageFile = async (
  source: string,
  filename: string,
  topCropRatio = 0
): Promise<void> => {
  const blob = topCropRatio > 0
    ? await getCroppedImageBlob(source, topCropRatio)
    : await fetchImageBlob(source);

  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
};
