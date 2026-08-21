import { z } from 'zod';
import { imageGenSkill } from './image-gen.skill';
import { ensureWhiteBackground } from '../image-postprocess';

type Platform = 'amazon' | 'taobao' | 'tmall' | 'unknown';

const schema = z.object({
  productImages: z.array(z.string()).min(1).max(6),
  brief: z.string().optional(),
  platform: z.string().optional(),
  background: z.string().optional(),
  count: z.number().int().min(1).max(10).optional(),
  aspectRatio: z.string().optional(),
  imageSize: z.enum(['1K', '2K', '4K']).optional(),
  model: z.string().optional(),
});

const normalizePlatform = (raw?: string): Platform => {
  const s = String(raw || '').toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('amazon') || s.includes('亚马逊')) return 'amazon';
  if (s.includes('tmall') || s.includes('天猫')) return 'tmall';
  if (s.includes('taobao') || s.includes('淘宝')) return 'taobao';
  return 'unknown';
};

const detectPlatformFromBrief = (brief: string): Platform => {
  return normalizePlatform(brief);
};

const buildBackground = (background?: string) => {
  const bg = String(background || '').trim();
  if (!bg) {
    return 'Pure solid white background (#FFFFFF), seamless sweep. Only a very soft natural contact shadow.';
  }
  return `Background: ${bg}. Keep it clean and distraction-free; no text, no logos, no props.`;
};

const buildModelHints = (brief: string) => {
  const t = String(brief || '').trim();
  if (!t) return 'professional fashion model';
  // Keep as user-driven; we do not over-parse.
  return `Model requirements from user: ${t}`;
};

const platformShots = (platform: Platform): Array<{ label: string; spec: string }> => {
  if (platform === 'taobao' || platform === 'tmall') {
    return [
      { label: '全身正面主图', spec: 'full body, front view, centered, arms down, no occlusion, clear garment silhouette' },
      { label: '侧面展示', spec: 'full body, side view, show silhouette and drape, no occlusion' },
      { label: '面料细节', spec: 'mid-shot close-up focusing on fabric texture and key construction details (stitching, neckline or hem). Face still visible if possible.' },
    ];
  }
  // default amazon
  return [
    { label: '全身正面主图', spec: 'full body, front view, centered, arms down, no occlusion, clear face and garment' },
    { label: '背面展示', spec: 'full body, back view, hair not covering neckline/back, no occlusion' },
    { label: '3/4 正面', spec: 'three-quarter front view, natural pose, no occlusion, show depth and drape' },
  ];
};

const NEGATIVE = `text, watermark, logo, brand mark,
wrong color, different fabric, different garment design,
cartoon, illustration, anime, CGI, 3d render,
plastic skin, over-smoothing, beauty filter, uncanny face,
deformed hands, extra fingers, bad anatomy`;

export type ClothingStudioResult = {
  anchorUrl: string;
  images: Array<{ url: string; label: string }>;
  platform: Platform;
  usedCount: number;
};

// Single-call, storyboard-like flow:
// 1) Generate an anchor image (model + product) using product reference.
// 2) Generate N shots using anchor as first reference (locks face) and product as second reference (locks garment).
// No paid QC loops.
export async function clothingStudioSkill(raw: unknown): Promise<ClothingStudioResult> {
  const params = schema.parse(raw);
  const brief = String(params.brief || '').trim();
  const platform = normalizePlatform(params.platform) !== 'unknown'
    ? normalizePlatform(params.platform)
    : detectPlatformFromBrief(brief);

  const count = Math.max(1, Math.min(10, Number(params.count ?? 3)));
  const aspectRatio = String(params.aspectRatio || '3:4');
  const imageSize = (params.imageSize || '2K') as '1K' | '2K' | '4K';
  const model = String(params.model || 'nanobanana2');

  const productImages = params.productImages.slice(0, 6);
  const productRef = productImages[0];

  const backgroundText = buildBackground(params.background);
  const modelHints = buildModelHints(brief);

  // Step 1: anchor
  const anchorPrompt = `High-end e-commerce fashion studio photo.

Task: Generate ONE anchor image that defines the model identity for the whole set.

Use reference[0] as the PRODUCT anchor. The garment must match reference exactly (color, material, construction, key details).

Requirements:
- Full body, front view, centered.
- Face clearly visible and sharp (this will be the identity anchor for later images).
- The model is wearing the exact garment.
- ${backgroundText}

Model type:
- ${modelHints}

Lighting & camera:
- Photorealistic catalog studio, 85mm, f/8, ISO100, strobe lighting.

Avoid:
${NEGATIVE}`;

  const anchorUrlRaw = await imageGenSkill({
    prompt: anchorPrompt,
    model,
    aspectRatio,
    imageSize,
    referenceImages: [productRef],
    referenceMode: 'product',
    referencePriority: 'first',
    referenceStrength: 0.9,
  } as any);

  if (!anchorUrlRaw) {
    throw new Error('服装棚拍生成失败：未返回 anchor 图片');
  }
  const anchorUrl = await ensureWhiteBackground(anchorUrlRaw);

  // Step 2: shots
  const shots = platformShots(platform);
  const images: Array<{ url: string; label: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const shot = shots[i % shots.length];
    const shotPrompt = `High-end e-commerce fashion studio photo.

Reference policy:
- reference[0] = IDENTITY anchor (same face, same person as the anchor).
- reference[1] = PRODUCT anchor (same garment facts as product image).

Non-negotiable:
- SAME FACE as reference[0].
- SAME GARMENT as reference[1] (color/material/construction).
- ${backgroundText}

Shot:
- ${shot.spec}

Avoid:
${NEGATIVE}`;

    const urlRaw = await imageGenSkill({
      prompt: shotPrompt,
      model,
      aspectRatio,
      imageSize,
      referenceImages: [anchorUrl, productRef],
      referencePriority: 'all',
      referenceStrength: 0.9,
      referenceMode: 'product-swap',
    } as any);

    if (!urlRaw) continue;
    const finalUrl = await ensureWhiteBackground(urlRaw);
    images.push({ url: finalUrl, label: shot.label });
  }

  return {
    anchorUrl,
    images,
    platform,
    usedCount: images.length,
  };
}
