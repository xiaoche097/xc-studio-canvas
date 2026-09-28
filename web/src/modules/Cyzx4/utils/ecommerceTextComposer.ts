import '@fontsource/noto-sans/latin-500.css';
import '@fontsource/noto-sans/latin-ext-500.css';
import '@fontsource/noto-sans/cyrillic-500.css';
import '@fontsource/noto-sans/cyrillic-ext-500.css';
import '@fontsource/noto-sans/vietnamese-500.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans/latin-ext-700.css';
import '@fontsource/noto-sans/cyrillic-700.css';
import '@fontsource/noto-sans/cyrillic-ext-700.css';
import '@fontsource/noto-sans/vietnamese-700.css';
import '@fontsource/noto-sans/latin-800.css';
import '@fontsource/noto-sans/latin-ext-800.css';
import '@fontsource/noto-sans/cyrillic-800.css';
import '@fontsource/noto-sans/cyrillic-ext-800.css';
import '@fontsource/noto-sans/vietnamese-800.css';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import '@fontsource/noto-sans-sc/chinese-simplified-800.css';
import '@fontsource/noto-sans-tc/chinese-traditional-500.css';
import '@fontsource/noto-sans-tc/chinese-traditional-700.css';
import '@fontsource/noto-sans-tc/chinese-traditional-800.css';
import '@fontsource/noto-sans-jp/japanese-500.css';
import '@fontsource/noto-sans-jp/japanese-700.css';
import '@fontsource/noto-sans-jp/japanese-800.css';
import '@fontsource/noto-sans-kr/korean-500.css';
import '@fontsource/noto-sans-kr/korean-700.css';
import '@fontsource/noto-sans-kr/korean-800.css';
import '@fontsource/noto-sans-arabic/arabic-500.css';
import '@fontsource/noto-sans-arabic/arabic-700.css';
import '@fontsource/noto-sans-arabic/arabic-800.css';
import '@fontsource/noto-sans-hebrew/hebrew-500.css';
import '@fontsource/noto-sans-hebrew/hebrew-700.css';
import '@fontsource/noto-sans-hebrew/hebrew-800.css';
import '@fontsource/noto-sans-thai/thai-500.css';
import '@fontsource/noto-sans-thai/thai-700.css';
import '@fontsource/noto-sans-thai/thai-800.css';
import '@fontsource/noto-sans-devanagari/devanagari-500.css';
import '@fontsource/noto-sans-devanagari/devanagari-700.css';
import '@fontsource/noto-sans-devanagari/devanagari-800.css';
import type { EcommerceCopyPlan, EcommerceLanguageId } from '../types/ecommerceHero.types';
import { languageById } from '../constants/ecommerceHeroPresets';

export type TextSafeZone = 'top' | 'bottom' | 'left' | 'right';

interface ComposeOptions {
  language: EcommerceLanguageId;
  copy: EcommerceCopyPlan;
  safeZone: TextSafeZone;
  accentColor?: string;
  outputFormat?: 'png' | 'jpg';
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('视觉底图加载失败。'));
  image.src = src;
});

const splitWords = (text: string) => {
  if (!text.trim()) return [];
  try {
    const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale?: string, options?: { granularity: 'word' }) => { segment: (input: string) => Iterable<{ segment: string }> } }).Segmenter;
    if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: 'word' }).segment(text), (item) => item.segment);
  } catch {
    // Browser fallback below.
  }
  return text.includes(' ') ? text.split(/(\s+)/) : Array.from(text);
};

const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
  const tokens = splitWords(text);
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    const candidate = `${line}${token}`;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line.trim());
      line = token.trimStart();
      if (lines.length >= maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line.trim() && lines.length < maxLines) lines.push(line.trim());
  if (lines.length === maxLines && tokens.join('').length > lines.join('').length) {
    let last = lines[maxLines - 1];
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
};

const roundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

export const composeEcommerceHeroText = async (baseImage: string, options: ComposeOptions): Promise<string> => {
  if (options.language === 'none') return baseImage;
  const language = languageById(options.language);
  const copySample = [options.copy.headline, options.copy.subheadline, ...options.copy.badges].join(' ').trim() || 'Aa';
  if (document.fonts) {
    await Promise.all([500, 700, 800].map((weight) => document.fonts.load(`${weight} 32px ${language.fontStack}`, copySample))).catch(() => undefined);
  }
  const image = await loadImage(baseImage);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建文字合成画布。');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const vertical = options.safeZone === 'top' || options.safeZone === 'bottom';
  const zoneWidth = vertical ? canvas.width * 0.82 : canvas.width * 0.4;
  const zoneHeight = vertical ? canvas.height * 0.34 : canvas.height * 0.72;
  const zoneX = options.safeZone === 'right'
    ? canvas.width - zoneWidth - canvas.width * 0.06
    : options.safeZone === 'left'
      ? canvas.width * 0.06
      : (canvas.width - zoneWidth) / 2;
  const zoneY = options.safeZone === 'bottom'
    ? canvas.height - zoneHeight - canvas.height * 0.055
    : options.safeZone === 'top'
      ? canvas.height * 0.055
      : (canvas.height - zoneHeight) / 2;
  const padding = Math.max(24, Math.round(Math.min(canvas.width, canvas.height) * 0.035));
  const alignRight = language.direction === 'rtl';
  context.direction = language.direction;
  context.textAlign = alignRight ? 'right' : 'left';
  context.textBaseline = 'top';

  const accent = options.accentColor || '#ed6d46';
  context.save();
  context.shadowColor = 'rgba(13, 28, 48, 0.12)';
  context.shadowBlur = Math.max(16, canvas.width * 0.015);
  context.shadowOffsetY = Math.max(5, canvas.height * 0.006);
  roundedRect(context, zoneX, zoneY, zoneWidth, zoneHeight, Math.max(20, canvas.width * 0.018));
  const gradient = context.createLinearGradient(zoneX, zoneY, zoneX, zoneY + zoneHeight);
  gradient.addColorStop(0, 'rgba(255,255,255,0.94)');
  gradient.addColorStop(1, 'rgba(255,255,255,0.84)');
  context.fillStyle = gradient;
  context.fill();
  context.restore();

  const textX = alignRight ? zoneX + zoneWidth - padding : zoneX + padding;
  const availableWidth = zoneWidth - padding * 2;
  let cursorY = zoneY + padding;
  const headlineSize = Math.max(28, Math.round(Math.min(canvas.width, canvas.height) * (vertical ? 0.052 : 0.044)));
  context.fillStyle = '#142139';
  context.font = `800 ${headlineSize}px ${language.fontStack}`;
  const headlineLines = wrapText(context, options.copy.headline, availableWidth, 2);
  headlineLines.forEach((line) => {
    context.fillText(line, textX, cursorY);
    cursorY += headlineSize * 1.2;
  });

  if (options.copy.subheadline.trim()) {
    const subSize = Math.max(18, Math.round(headlineSize * 0.48));
    cursorY += subSize * 0.35;
    context.fillStyle = '#52637a';
    context.font = `500 ${subSize}px ${language.fontStack}`;
    const subLines = wrapText(context, options.copy.subheadline, availableWidth, 2);
    subLines.forEach((line) => {
      context.fillText(line, textX, cursorY);
      cursorY += subSize * 1.42;
    });
  }

  const badges = options.copy.badges.filter(Boolean).slice(0, 3);
  if (badges.length) {
    const badgeSize = Math.max(15, Math.round(headlineSize * 0.38));
    cursorY += badgeSize * 0.45;
    context.font = `700 ${badgeSize}px ${language.fontStack}`;
    let badgeX = alignRight ? zoneX + zoneWidth - padding : zoneX + padding;
    badges.forEach((badge) => {
      const width = Math.min(availableWidth, context.measureText(badge).width + badgeSize * 1.7);
      if (!alignRight && badgeX + width > zoneX + zoneWidth - padding) return;
      if (alignRight && badgeX - width < zoneX + padding) return;
      const x = alignRight ? badgeX - width : badgeX;
      roundedRect(context, x, cursorY, width, badgeSize * 2, badgeSize);
      context.fillStyle = `${accent}1f`;
      context.fill();
      context.fillStyle = accent;
      context.textBaseline = 'middle';
      context.fillText(badge, alignRight ? x + width - badgeSize * 0.8 : x + badgeSize * 0.8, cursorY + badgeSize);
      context.textBaseline = 'top';
      badgeX += alignRight ? -(width + badgeSize * 0.55) : width + badgeSize * 0.55;
    });
  }

  return canvas.toDataURL(options.outputFormat === 'jpg' ? 'image/jpeg' : 'image/png', 0.94);
};
