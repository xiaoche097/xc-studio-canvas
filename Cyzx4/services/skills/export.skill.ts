export interface ExportParams {
  elements: any[];
  format: 'png' | 'jpg' | 'pdf' | 'svg' | 'json';
  quality?: number;
  scale?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export async function exportSkill(params: ExportParams): Promise<string> {
  const { format, elements, quality = 0.92, scale = 2 } = params;

  if (format === 'json') {
    const json = JSON.stringify({ elements, exportedAt: Date.now() }, null, 2);
    return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  }

  if (format === 'svg') {
    return exportAsSvg(elements, params.canvasWidth || 1920, params.canvasHeight || 1080);
  }

  // PNG / JPG / PDF — render to offscreen canvas
  const canvas = await renderToCanvas(elements, scale);

  if (format === 'png') {
    return canvas.toDataURL('image/png');
  }

  if (format === 'jpg') {
    return canvas.toDataURL('image/jpeg', quality);
  }

  if (format === 'pdf') {
    return exportAsPdf(canvas);
  }

  throw new Error(`Unsupported format: ${format}`);
}

async function renderToCanvas(elements: any[], scale: number): Promise<HTMLCanvasElement> {
  if (!elements.length) throw new Error('No elements to export');

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x || 0);
    minY = Math.min(minY, el.y || 0);
    maxX = Math.max(maxX, (el.x || 0) + (el.width || 200));
    maxY = Math.max(maxY, (el.y || 0) + (el.height || 200));
  }

  const padding = 40;
  const width = (maxX - minX + padding * 2) * scale;
  const height = (maxY - minY + padding * 2) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (const el of elements) {
    const x = (el.x || 0) - minX + padding;
    const y = (el.y || 0) - minY + padding;

    if (el.type === 'image' && (el.url || el.src)) {
      await drawImage(ctx, el.url || el.src, x, y, el.width, el.height);
    } else if (el.type === 'text') {
      ctx.fillStyle = el.fillColor || el.color || '#000000';
      ctx.font = `${el.fontSize || 16}px ${el.fontFamily || 'sans-serif'}`;
      const text = el.text || el.content || '';
      const lines = String(text).split('\n');
      const lineHeight = (el.lineHeight || 1.2) * (el.fontSize || 16);
      lines.forEach((line: string, idx: number) => {
        ctx.fillText(line, x, y + (el.fontSize || 16) + idx * lineHeight);
      });
    } else if (el.type === 'shape') {
      ctx.fillStyle = el.fill || '#cccccc';
      ctx.strokeStyle = el.stroke || '#000000';
      ctx.lineWidth = el.strokeWidth || 1;
      ctx.fillRect(x, y, el.width || 100, el.height || 100);
      ctx.strokeRect(x, y, el.width || 100, el.height || 100);
    } else if (el.type === 'video' && el.thumbnail) {
      await drawImage(ctx, el.thumbnail, x, y, el.width, el.height);
      // Draw play icon overlay
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(x + (el.width || 200) / 2, y + (el.height || 200) / 2, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const cx = x + (el.width || 200) / 2;
      const cy = y + (el.height || 200) / 2;
      ctx.moveTo(cx - 10, cy - 15);
      ctx.lineTo(cx + 15, cy);
      ctx.lineTo(cx - 10, cy + 15);
      ctx.closePath();
      ctx.fill();
    }
  }

  return canvas;
}

function drawImage(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, w: number, h: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, x, y, w || img.width, h || img.height);
      resolve();
    };
    img.onerror = () => resolve(); // Skip failed images
    img.src = src;
  });
}

function exportAsSvg(elements: any[], width: number, height: number): string {
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svgContent += `<rect width="100%" height="100%" fill="white"/>`;

  for (const el of elements) {
    const x = el.x || 0;
    const y = el.y || 0;

    if (el.type === 'text') {
      const text = String(el.text || el.content || '');
      const fill = el.fillColor || el.color || '#000';
      const lines = text.split('\n');
      const fontSize = el.fontSize || 16;
      const lineHeight = (el.lineHeight || 1.2) * fontSize;
      const align = el.textAlign || 'left';
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const textX = align === 'center' ? x + (el.width || 0) / 2 : align === 'right' ? x + (el.width || 0) : x;
      const y0 = y + fontSize;
      svgContent += `<text x="${textX}" y="${y0}" font-size="${fontSize}" fill="${fill}" font-family="${el.fontFamily || 'sans-serif'}" text-anchor="${anchor}">`;
      lines.forEach((line: string, idx: number) => {
        svgContent += `<tspan x="${textX}" dy="${idx === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`;
      });
      svgContent += `</text>`;
    } else if (el.type === 'shape') {
      svgContent += `<rect x="${x}" y="${y}" width="${el.width || 100}" height="${el.height || 100}" fill="${el.fill || '#ccc'}" stroke="${el.stroke || '#000'}" stroke-width="${el.strokeWidth || 1}"/>`;
    } else if (el.type === 'image' && (el.url || el.src)) {
      const src = el.url || el.src;
      svgContent += `<image x="${x}" y="${y}" width="${el.width || 200}" height="${el.height || 200}" href="${src}"/>`;
    }
  }

  svgContent += '</svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function exportAsPdf(canvas: HTMLCanvasElement): Promise<string> {
  // Dynamic import to avoid bundling jspdf when not needed
  const { jsPDF } = await import('jspdf');
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  return pdf.output('datauristring');
}
