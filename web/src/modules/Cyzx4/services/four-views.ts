type FourViewsInput = {
  front: string;
  left: string;
  back: string;
  right: string;
};

export async function composeFourViews(input: FourViewsInput): Promise<string> {
  const [front, left, back, right] = await Promise.all([
    loadImage(input.front),
    loadImage(input.left),
    loadImage(input.back),
    loadImage(input.right),
  ]);

  const cellW = Math.max(front.naturalWidth, left.naturalWidth, back.naturalWidth, right.naturalWidth);
  const cellH = Math.max(front.naturalHeight, left.naturalHeight, back.naturalHeight, right.naturalHeight);

  const gap = 12;
  const canvas = document.createElement('canvas');
  canvas.width = cellW * 2 + gap * 3;
  canvas.height = cellH * 2 + gap * 3;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法初始化四视图合成画布');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCentered(ctx, front, gap, gap, cellW, cellH);
  drawCentered(ctx, left, cellW + gap * 2, gap, cellW, cellH);
  drawCentered(ctx, back, gap, cellH + gap * 2, cellW, cellH);
  drawCentered(ctx, right, cellW + gap * 2, cellH + gap * 2, cellW, cellH);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('四视图合成失败'))), 'image/png', 0.98);
  });

  return URL.createObjectURL(blob);
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
): void {
  const ratio = Math.min(cellW / image.naturalWidth, cellH / image.naturalHeight);
  const drawW = image.naturalWidth * ratio;
  const drawH = image.naturalHeight * ratio;
  const offsetX = x + (cellW - drawW) / 2;
  const offsetY = y + (cellH - drawH) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('加载四视图图片失败'));
    img.src = url;
  });
}
