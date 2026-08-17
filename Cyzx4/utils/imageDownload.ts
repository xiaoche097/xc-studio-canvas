const fetchImageResponse = async (source: string): Promise<Response> => {
  const fetchThroughProxy = async (): Promise<Response> => {
    const proxyResponse = await fetch(`/api/image-download?url=${encodeURIComponent(source)}`);
    if (!proxyResponse.ok) throw new Error(`Image proxy returned ${proxyResponse.status}`);
    const proxyType = proxyResponse.headers.get('content-type') || '';
    if (!proxyType.toLowerCase().startsWith('image/')) throw new Error('Image proxy did not return an image');
    return proxyResponse;
  };

  // Virse output is hosted on Google Storage without browser CORS headers.
  // Go straight through our allow-listed same-origin proxy so Canvas can read it.
  if (/^https?:\/\/storage\.googleapis\.com\/virse-images\//i.test(source)) {
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

export const downloadImageFile = async (source: string, filename: string): Promise<void> => {
  const blob = await fetchImageBlob(source);
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
