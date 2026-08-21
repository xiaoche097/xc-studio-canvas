import { z } from 'zod';
import { getBestModelId, generateJsonResponse } from '../gemini';
import type { ClothingAnalysis, ProductType } from '../../types/workflow.types';

const outputSchema = z.object({
  productType: z.enum(['top', 'dress', 'pants', 'skirt', 'set', 'outerwear', 'unknown']),
  isSet: z.boolean(),
  keyFeatures: z.array(z.string()).default([]),
  materialGuess: z.array(z.string()).default([]),
  colorPalette: z.array(z.string()).default([]),
  fitSilhouette: z.array(z.string()).default([]),
  anchorDescription: z.string().default(''),
  forbiddenChanges: z.array(z.string()).default([]),
  recommendedStyling: z
    .object({
      accessories: z.array(z.string()).default([]),
      bottoms: z.array(z.string()).default([]),
      bags: z.array(z.string()).default([]),
      shoes: z.array(z.string()).default([]),
    })
    .default({ accessories: [], bottoms: [], bags: [], shoes: [] }),
  targetModelProfile: z.object({
    personality: z.string().describe('模特气质，如：优雅、街头、干练、甜美'),
    ethnicity: z.string().describe('推荐人种，如：欧美、东亚、拉丁'),
    ageRange: z.string().describe('推荐年龄段'),
    physicalDescription: z.string().describe('具体外貌描述：发色、发型、妆造风格'),
  }).default({ personality: '专业模特', ethnicity: '欧美', ageRange: '20-30', physicalDescription: '标准棚拍妆造' }),
  recommendedPoses: z.array(z.string()).default([]),
  shotListHints: z.array(z.string()).default([]),
  productAnchorIndex: z.number().int().min(0).max(5).default(0),
});

const scoreSchema = z.object({
  bestIndex: z.number().int().min(0).max(5),
  reasons: z.array(z.string()).default([]),
});

const toInlinePart = async (url: string): Promise<{ inlineData: { mimeType: string; data: string } }> => {
  if (/^data:image\/.+;base64,/.test(url)) {
    const m = url.match(/^data:(.+);base64,(.+)$/);
    if (!m) throw new Error('invalid data url');
    return { inlineData: { mimeType: m[1], data: m[2] } };
  }
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('file reader failed'));
    reader.readAsDataURL(blob);
  });
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error('convert image failed');
  return { inlineData: { mimeType: m[1], data: m[2] } };
};

export async function analyzeClothingProductSkill(params: { productImages: string[]; brief?: string }): Promise<ClothingAnalysis> {
  const images = (params.productImages || []).slice(0, 6);
  if (images.length === 0) {
    throw new Error('请至少上传 1 张产品图');
  }

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    {
      text:
        `你是服装电商视觉分析师。请严格输出 JSON，字段必须完整。\n` +
        `任务：识别品类、材质、卖点、姿势建议，并提炼产品一致性锚点。\n` +
        `brief: ${params.brief || '无'}`,
    },
  ];

  const inlineImages = await Promise.all(images.map((u) => toInlinePart(u)));
  inlineImages.forEach((p, idx) => {
    parts.push({ text: `这是产品图 #${idx}` });
    parts.push(p);
  });

  const analysisRaw = await generateJsonResponse({
    model: getBestModelId('text'),
    operation: 'analyzeClothingProduct',
    temperature: 0.2,
    parts,
  });

  let parsedAnalysisJson: any = {};
  try {
    parsedAnalysisJson = JSON.parse(analysisRaw.text || '{}');
  } catch {
    parsedAnalysisJson = {};
  }

  let analysis = outputSchema.safeParse(parsedAnalysisJson);
  if (!analysis.success) {
    analysis = outputSchema.safeParse({
      productType: 'unknown' as ProductType,
      isSet: false,
      keyFeatures: [],
      materialGuess: [],
      colorPalette: [],
      fitSilhouette: [],
      anchorDescription: '保持服装廓形、颜色和关键结构线不变',
      forbiddenChanges: ['不要改变版型', '不要改变图案和颜色'],
      recommendedStyling: { accessories: [], bottoms: [], bags: [], shoes: [] },
      recommendedPoses: ['站姿正面'],
      shotListHints: ['hero_full_front'],
      productAnchorIndex: 0,
    });
  }

  const scoreParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: '请选择最适合作为产品锚点图的一张（最清晰、正面、无遮挡），仅返回 JSON: {"bestIndex":number,"reasons":string[]}' },
  ];
  inlineImages.forEach((p, idx) => {
    scoreParts.push({ text: `候选 #${idx}` });
    scoreParts.push(p);
  });

  const scoreRaw = await generateJsonResponse({
    model: getBestModelId('text'),
    operation: 'analyzeClothingAnchor',
    temperature: 0.1,
    parts: scoreParts,
  });

  let parsedScoreJson: any = {};
  try {
    parsedScoreJson = JSON.parse(scoreRaw.text || '{}');
  } catch {
    parsedScoreJson = {};
  }

  const scored = scoreSchema.safeParse(parsedScoreJson);
  const bestIndex = scored.success ? Math.min(images.length - 1, Math.max(0, scored.data.bestIndex)) : 0;

  return {
    ...analysis.data,
    productAnchorIndex: bestIndex,
  } as ClothingAnalysis;
}
