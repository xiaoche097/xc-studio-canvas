import { GoogleGenAI, LiveServerMessage, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AspectRatio, ImageResolution } from "../types";
import { QUALITY_BOOSTERS, buildNegativePrompt, enhancePrompt, SCENE_POOL, TEXTURE_KEYWORDS, NEGATIVE_PERSPECTIVE, getAngleNegative, getAngleLens, LENS_SIMULATION } from "./promptUtils";

// 导入工具函数和类型定义
import {
  DEFAULT_TEXT_MODEL,
  GEMINI_TEXT_MODELS,
  getApiConfig,
  getImageApiConfig,
  getImageAiClient,
  getAiClient,
  getActiveApiInfo,
  resolveRuntimeModelId,
  generateContentWithAnalysisFallback,
  executeWithTimeout,
  createAbortError,
  throwIfAborted,
  isAbortError,
  blobToBase64,
  compressImage,
  decodeAudioData,
  floatTo16BitPCM,
  API_TIMEOUT_MS
} from "../utils/apiHelpers";
import { resolveXiaocheImageModel } from "../utils/xiaocheModels";
import { generateVirseImage, uploadVirseReference } from "../../services/virseService";

import type {
  GeminiResponse,
  ImageGenerationConfig,
  ImageReference,
  ProductAnalysisResult,
  GenerationOptions,
  WorkflowHint
} from "../types/gemini.types";

// ==================== 已删除重复定义 ====================
// getApiConfig, getAiClient, getActiveApiInfo, blobToBase64, compressImage, decodeAudioData
// 现在从 ../utils/apiHelpers.ts 导入使用

// 导出从 ../utils/apiHelpers.ts 导入的工具
export { getActiveApiInfo, blobToBase64, compressImage, decodeAudioData };

// Export the VTON Analyst service
export { analyzeVtonMaterials, analyzeGarmentFeatures, analyzeImagePerspective } from "./vtonAnalyst";

export interface OutfitAnalysisItem {
  id: string;
  label: string;
  englishName: string;
  category: string;
  visibility: string;
  occlusion: string;
  colorMaterial: string;
  keyDetails: string;
  confidence: number;
}

export interface OutfitAnalysisResult {
  items: OutfitAnalysisItem[];
  summary?: string;
}

export const GLOBAL_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const QWEN_IMAGE_MODEL_ID = 'qwen-image-3.0-pro';
const isVirseImageRoutingEnabled = () => localStorage.getItem('virse_enabled') === 'true';

const getImageGenerationContext = (
  modelId: string,
  aspectRatio: string = '1:1',
  resolution: string = '1K'
) => {
  const virseEnabled = isVirseImageRoutingEnabled();
  const virseApiKey = localStorage.getItem('virse_api_key')?.trim() || '';
  if (virseEnabled && !virseApiKey) {
    throw new Error('Virse 已启用但 API Key 为空。为避免错误使用其他图片服务，本次生成已停止。');
  }
  const routeThroughCentralImagePipeline = modelId === QWEN_IMAGE_MODEL_ID || virseEnabled;
  if (routeThroughCentralImagePipeline) {
    // Compatibility adapter for legacy image workflows that still expect a
    // GoogleGenAI-shaped client. All image requests are redirected through the
    // central Virse pipeline while text/Agent calls keep using getAiClient().
    const virseImageClient = {
      models: {
        generateContent: async (request: any) => {
          const contents = Array.isArray(request?.contents) ? request.contents : [request?.contents];
          const parts = contents.flatMap((content: any) => Array.isArray(content?.parts) ? content.parts : []);
          const images = parts
            .map((part: any) => part?.inlineData || part?.inline_data)
            .filter((data: any) => data?.data)
            .map((data: any) => ({
              base64: String(data.data).replace(/^data:[^;]+;base64,/, ''),
              mimeType: data.mimeType || data.mime_type || 'image/png',
            }));
          const prompt = parts
            .map((part: any) => typeof part?.text === 'string' ? part.text : '')
            .filter(Boolean)
            .join('\n') || 'Generate a high-quality image from the supplied references.';
          const hasImmutableTryOnModel = /Image 1:\s*TARGET MODEL\s*\/\s*IMMUTABLE BASE CANVAS/i.test(prompt);
          const urls = await generateImageToImage(images, prompt, {
            modelId,
            aspectRatio: aspectRatio as AspectRatio,
            resolution: resolution as ImageResolution,
            workflowHint: hasImmutableTryOnModel ? 'single-item-try-on' : undefined,
            hasModelRef: hasImmutableTryOnModel,
          });
          return {
            candidates: [{
              content: {
                parts: urls.map((url) => ({ text: url })),
              },
              finishReason: 'STOP',
            }],
          };
        },
      },
    } as unknown as GoogleGenAI;
    return {
      ai: virseImageClient,
      config: {
        apiKey: virseApiKey,
        isYunwu: false,
        isPlato: false,
        isJijing: false,
        isRunningHub: false,
        isXiaoche: false,
        keyCount: 1,
        currentIndex: 0,
      },
      model: modelId,
    };
  }
  const { ai, config } = getImageAiClient();
  const model = config.isXiaoche
    ? resolveXiaocheImageModel(modelId, aspectRatio, resolution)
    : resolveRuntimeModelId(modelId, config);
  return { ai, config, model };
};

type ImageResponseDiagnostics = {
  topLevelFields: string[];
  candidateCount: number;
  finishReasons: string[];
  blockReason?: string;
  partFields: string[][];
  textPreview?: string;
  usage?: Record<string, unknown>;
};

const IMAGE_URL_PATTERN = /https?:\/\/[^\s<>"'\]\[)]+/g;

const asNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const diagnoseImageResponse = (response: any): ImageResponseDiagnostics => {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const parts = candidates.flatMap((candidate: any) => {
    const candidateParts = candidate?.content?.parts || candidate?.parts;
    return Array.isArray(candidateParts) ? candidateParts : [];
  });
  const textPreview = parts
    .map((part: any) => asNonEmptyString(part?.text))
    .filter(Boolean)
    .join(' ')
    .slice(0, 240);
  const usage = response?.usageMetadata || response?.usage;

  return {
    topLevelFields: response && typeof response === 'object' ? Object.keys(response).sort() : [],
    candidateCount: candidates.length,
    finishReasons: candidates
      .map((candidate: any) => candidate?.finishReason || candidate?.finish_reason)
      .filter(Boolean),
    blockReason: response?.promptFeedback?.blockReason || response?.prompt_feedback?.block_reason,
    partFields: parts.map((part: any) => part && typeof part === 'object' ? Object.keys(part).sort() : []),
    ...(textPreview ? { textPreview } : {}),
    ...(usage && typeof usage === 'object' ? { usage } : {}),
  };
};

const createEmptyImageResponseError = (response: any, model: string): Error => {
  const diagnostics = diagnoseImageResponse(response);
  const reason = diagnostics.blockReason
    || diagnostics.finishReasons.join(', ')
    || '未提供 finishReason';
  const fields = diagnostics.partFields.length > 0
    ? diagnostics.partFields.map(keys => keys.join('|') || '(空)').join(', ')
    : diagnostics.topLevelFields.join('|') || '(空响应)';
  const error = new Error(
    `中转请求已完成，但响应中未找到可接收的图片。模型：${model}；结束原因：${reason}；返回字段：${fields}。` +
    '系统已停止本任务的后续付费请求，避免继续扣费。请保留本次中转日志；若 Network 响应中实际存在图片字段，请将响应结构交给开发者继续适配。'
  );
  (error as any).code = 'IMAGE_RESPONSE_EMPTY';
  (error as any).preventRetry = true;
  (error as any).diagnostics = diagnostics;
  console.error('[ImageResponseEmpty]', { model, ...diagnostics });
  return error;
};

/**
 * 1. Analyze Product (Hyper-Realistic Film Mode)
 * Uses gemini-2.5-flash-image
 * UPDATED: Enforce "Film Look", "Candid Poses", "Texture", "Outfit Replacement", "Scene Randomizer"
 */
export const analyzeDollModification = async (
  sourceImage: { base64: string; mimeType: string },
  refImages: { base64: string; mimeType: string }[],
  boxes: Array<{ x: number; y: number; w: number; h: number; color: string }>,
  userGuidance: string,
  targetAngle?: string,
  productScope: 'doll' | 'doll-or-bag' = 'doll'
) => {
  const ai = getAiClient();
  const subjectRules = productScope === 'doll-or-bag'
    ? `First classify Image 1 as either (A) toy/doll/plush product or (B) bag product such as a backpack, handbag, tote, lunch bag, cosmetic bag, or related bag.
   - For toys/dolls, preserve face, body proportions, limbs, pose, fur/plush texture, seams, embroidery, colors, patterns, and accessories.
   - For bags, preserve silhouette, proportions, panel construction, pocket count and placement, zipper paths, handles, shoulder straps, buckles, hardware, piping, stitching, logo, print, colors, and source material.
   - Never change the product category, turn a bag into a toy, add toy anatomy to a bag, or redesign the product.`
    : `Treat Image 1 as a toy/doll/plush product. Preserve its identity, face, body proportions, limbs, pose, fur/plush texture, seams, embroidery, colors, patterns, and accessories.`;
  
  // Convert abstract percentages to human-readable spatial descriptions
  const describePosition = (x: number, y: number, w: number, h: number): string => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const vPos = cy < 0.33 ? '上部' : cy < 0.66 ? '中部' : '下部';
    const hPos = cx < 0.33 ? '左侧' : cx < 0.66 ? '中央' : '右侧';
    const sizeDesc = (w * h) > 0.25 ? '大面积' : (w * h) > 0.1 ? '中等面积' : '小面积';
    return `${vPos}${hPos}区域 (${sizeDesc}，覆盖约 ${(w * 100).toFixed(0)}%宽 × ${(h * 100).toFixed(0)}%高)`;
  };

  const boxDescriptions = boxes.map((b, i) => {
    const spatialDesc = describePosition(b.x, b.y, b.w, b.h);
    const colorCode = b.color === 'Red' ? '红框' : b.color === 'Yellow' ? '黄框' : '蓝框';
    return `[区域 ${i+1}] (${colorCode}): 位于 ${spatialDesc}。精确坐标: (${(b.x*100).toFixed(1)}%, ${(b.y*100).toFixed(1)}%)。此区域的目标效果**必须参考 Image ${i+2}**。`;
  }).join('\n');

  const analysisPrompt = `
**ROLE**: Precision Vision Analyst for Localized Image Modification.

**YOUR TASK**: Analyze the source image (Image 1) and the user's modification request. Generate a PRECISE, SPATIALLY-CONSTRAINED prompt for the image generator.

**CRITICAL RULES**:
0. **PRODUCT CATEGORY & IDENTITY**: ${subjectRules}
1. **MODIFICATION MODE**:
   - **Surgical (Boxes provided)**: ONLY the areas inside the boxes should be modified. EVERYTHING else is "FROZEN".
   - **Global (No boxes provided)**: You may refine the entire image (lighting, texture, quality). HOWEVER, ${
     targetAngle
       ? `since the user has requested a perspective change to "${targetAngle}", you must reconstruct and rotate the main subject/model accordingly to match this angle. Maintain the same identity, proportions, and scale of the model from Image 1, but rebuild the pose/angle to show the "${targetAngle}".`
       : `you must maintain 100% of the original objects' positions, counts, poses, and basic shapes from Image 1. DO NOT add or remove objects.`
   }
2. **STRICT REFERENCE ALIGNMENT**: Extract both camera geometry and visual attributes from the REFERENCE IMAGES (Images 2+).
   - When reference images are present, their product orientation is a HARD TARGET: match yaw/horizontal rotation, pitch, camera elevation, lens perspective, framing, subject scale, placement, and crop.
   - Image 2 is the primary angle reference if multiple reference images disagree. Later references supplement lighting, shadow, material finish, and retouching quality.
   - Reconstruct Image 1's product into the reference angle, but NEVER copy the reference product's design, pockets, zippers, handles, straps, hardware, logo, print, color, or category.
   - Returning Image 1 at its original angle when it differs from Image 2 is a CRITICAL FAILURE.
   - **CLOTHING MODIFICATION**: If the reference images are garments and you are modifying the clothing, you MUST explicitly identify and enforce the target garment's: Fit (e.g., slim fit, oversized), Length (e.g., crop top, midi length), Neckline (e.g., V-neck, crew neck), and Cuffs/Sleeves.
3. **COLOR CONSISTENCY (CRITICAL)**: Maintain strict color consistency with Image 1. You MUST match the exact color tone, skin hue, lighting atmosphere, and white balance of the source image. Do not apply "neutral" correction if it deviates from the original's artistic intent or warm/cool bias. Ensure the modified areas blend seamlessly with the original color profile.
4. **NO NEW OBJECTS**: Absolutely NO hallucination of additional products, compartments, straps, hardware, toy body parts, props, or background details not present in Image 1.
5. **LAYOUT PRESERVATION**: The final image must be a 1:1 structural match to Image 1. Preserve the same product count, placement, scale, and orientation unless the requested perspective operation explicitly requires a rotation.
6. **ENGINEERED PROMPT FORMAT**: The prompt must be a detailed description of the ENTIRE FINAL IMAGE, but it must use language like "Keeping everything else identical to Image 1, modify ONLY the [area] to look like [reference description]".

**SOURCE IMAGE**: Image 1.
**REFERENCE IMAGES**: ${refImages.length > 0 ? `Images 2-${refImages.length + 1} are style/effect references.` : 'None provided.'}

**USER'S BOX SELECTIONS** (these define the ONLY areas that may be modified):
${boxes.length > 0 ? boxDescriptions : 'No boxes drawn. User wants GLOBAL modification.'}

**USER GUIDANCE (HIGH WEIGHT COMMAND)**: "${userGuidance || 'Enhance the selected regions based on reference images.'}"

**TARGET PERSPECTIVE**: ${
  refImages.length > 0
    ? `MANDATORY REFERENCE-ANGLE REPLICATION - use Image 2 as the primary target for product orientation, camera height, pitch, yaw, perspective, framing, subject scale, and crop. ${targetAngle ? `The selected preset "${targetAngle}" is secondary to the actual reference-image geometry.` : ''}`
    : targetAngle === '主图精修'
    ? 'STRICT PERSPECTIVE LOCK - maintain exact same camera angle.'
    : targetAngle
      ? boxes.length > 0
        ? `Rotate the object INSIDE the box to ${targetAngle} view, while keeping the rest of the image perspective identical to Image 1.`
        : `Reconstruct and rotate the entire main subject/model in the image to ${targetAngle} view.`
      : 'Keep current perspective.'
}

**MANDATORY OUTPUT BACKGROUND & SHADOW**:
- Use a seamless, uniform PURE WHITE #FFFFFF background. Corners and all open areas around the product must be RGB(255,255,255).
- No gray, light gray, off-white, warm-white, gradient, gray studio sweep, visible floor/wall boundary, environment, or gray haze.
- Add a physically plausible still-life contact shadow and a soft cast shadow directly around/beneath the product. The shadow must ground the product without turning the background into gray.
- Preserve clean studio highlights, realistic material depth, and natural tonal contrast. The product must not float.

**OUTPUT (Strict JSON)**:
{
  "reasoning": "Step 1: Identify objects inside/outside boxes. Step 2: Plan how to describe the change in the box while anchoring the rest of the image to the source. Step 3: Ensure no new objects are mentioned.",
  "inside_boxes": ["list of parts inside the selected boxes"],
  "outside_boxes": ["list of parts OUTSIDE the boxes that MUST NOT change"],
  "engineered_prompt": "A surgical prompt that: (1) Describes the final image, (2) Explicitly states 'No new objects added', (3) Describes the modified area with reference details, (4) Describes the frozen areas exactly as Image 1."
}
`;

  try {
    const parts: any[] = [
      { inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.base64 } }
    ];
    refImages.forEach(img => {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    });
    parts.push({ text: analysisPrompt });

    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL,
      contents: { parts }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(text);
    
    // Log analysis for debugging
    console.log("[Doll Analysis] Inside boxes:", result.inside_boxes);
    console.log("[Doll Analysis] Outside boxes (FROZEN):", result.outside_boxes);
    
    return result;
  } catch (error) {
    console.error("Doll analysis failed", error);
    return null;
  }
};

export const analyzeReferenceEffect = async (
  refImages: { base64: string; mimeType: string }[]
) => {
  const ai = getAiClient();
  const analysisPrompt = `
**ROLE**: Top-tier E-commerce Photography Visual Analyst and Product Material Director for plush toys, dolls, backpacks, handbags, tote bags, lunch bags, cosmetic bags, and related bag products.

**TASK**: First identify the product category and real material in the reference image(s), then extract precise ecommerce retouching standards. Focus on these dimensions:
1. **光影光感 (Lighting & Light Feel)**: Identify light sources, light soft/hard quality, highlight layout, shadow falloff, contact shadow (ambient occlusion) style, and contrast level.
2. **产品材质 (Product Material & Surface Texture)**: For toys/dolls, identify plush fabric, pile/nap direction, fiber thickness, sheen, edge fluffiness, seams, and embroidery. For bags, identify nylon, polyester, canvas, leather, PU, quilted fabric, mesh, piping, stitching, zipper and hardware finish, surface grain, stiffness, and sheen. Never describe a bag as plush unless it is visibly made from plush fabric.
3. **画面色调氛围 (Overall Atmosphere)**: Identify color tone, color temperature, background styling, and retouching atmosphere.

**OUTPUT FORMAT (MANDATORY JSON)**:
Your response must be a valid JSON object matching the following structure. Do NOT include markdown code blocks other than the JSON itself. Provide high-quality Chinese descriptions for the analysis fields, and professional English keywords for "extracted_style" to guide image generation models:
{
  "lighting_analysis": "用一段极精炼的中文，分析参考图的光影分布与光感（例如：柔和棚拍双侧漫反射光，明暗过渡平滑，带有自然微弱的贴地投影）",
  "material_analysis": "用一段极精炼的中文，先判断产品类别，再分析其真实材质与工艺细节。玩偶分析绒毛、缝线和刺绣；包类分析尼龙/帆布/皮革/PU等面料、织纹、挺括度、车线、包边、拉链和五金",
  "overall_atmosphere": "用一段极精炼的中文，分析整体画面的色彩温度、调性与背景氛围（例如：高饱和度透亮色彩，纯净极简无缝暖白背景，高端商业棚拍画质）",
  "extracted_style": "A professional English keyword block combining lighting, the correctly identified real product material, surface/craft details, and ecommerce retouching standards. Do not introduce plush texture to a non-plush bag."
}
`;

  try {
    const parts: any[] = refImages.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 }
    }));
    parts.push({ text: analysisPrompt });

    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL,
      contents: { parts }
    });

    let text = response.text || "{}";
    text = text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Reference analysis failed", error);
    return null;
  }
};

/**
 * 通用文本/图像分析生成函数
 */
export const generateText = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
  modelId: string = DEFAULT_TEXT_MODEL
): Promise<string> => {
  const ai = getAiClient();
  try {
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 }
    }));
    parts.push({ text: prompt });

    const response = await generateContentWithAnalysisFallback(ai, {
      model: modelId,
      contents: { parts }
    });

    return response.text || "";
  } catch (error) {
    console.error("Generate text failed", error);
    throw error;
  }
};

const normalizeOutfitAnalysisItem = (item: any, index: number): OutfitAnalysisItem | null => {
  if (!item || typeof item !== 'object') return null;
  const label = String(item.label || item.name || item.chineseName || '').trim();
  const englishName = String(item.englishName || item.english_name || item.extractName || item.label_en || label).trim();
  if (!label && !englishName) return null;
  const rawConfidence = Number(item.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0.75;
  return {
    id: String(item.id || `${englishName || label}-${index + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || `item-${index + 1}`,
    label: label || englishName,
    englishName: englishName || label,
    category: String(item.category || 'other_accessory').trim(),
    visibility: String(item.visibility || item.visibleRange || 'visible').trim(),
    occlusion: String(item.occlusion || item.occlusionNotes || 'no obvious occlusion').trim(),
    colorMaterial: String(item.colorMaterial || item.color_material || item.material || 'analyze from source image').trim(),
    keyDetails: String(item.keyDetails || item.key_details || item.details || 'preserve all visible construction details').trim(),
    confidence,
  };
};

export const analyzeOutfitItems = async (
  image: { base64: string; mimeType: string },
  signal?: AbortSignal
): Promise<OutfitAnalysisResult> => {
  const prompt = `
You are a senior fashion visual analyst for ecommerce asset extraction.

Analyze Image 1 and identify the visible outfit items that are worth extracting as standalone product assets.

Detection scope:
- top, bottom, dress, outerwear, shoes, bag, hat, glasses, earrings, necklace, bracelet, belt, scarf, other_accessory.

Rules:
- Only include items that are actually visible in the image.
- Do not invent hidden items. If the image is half-body, do not list shoes or lower garments unless they are visible.
- Prefer concrete items over generic labels. Example: "米色针织背心" instead of "上衣".
- Include visible accessories and styling items such as bags, jewelry, hats, belts, scarves, sunglasses, and handheld fashion props.
- If multiple similar small accessories exist, include only the ones with enough visible detail to extract.
- Return at most 8 items, ordered by confidence and visible completeness.
- confidence must be a number from 0 to 1.

Return ONLY valid JSON, no markdown:
{
  "summary": "short Chinese summary of the outfit",
  "items": [
    {
      "id": "stable-kebab-id",
      "label": "中文单品名称",
      "englishName": "precise English extraction target",
      "category": "top|bottom|dress|outerwear|shoes|bag|hat|glasses|earrings|necklace|bracelet|belt|scarf|other_accessory",
      "visibility": "visible range and completeness in Chinese",
      "occlusion": "occlusion notes in Chinese",
      "colorMaterial": "color, fabric/material, texture in Chinese",
      "keyDetails": "distinctive visible details in Chinese",
      "confidence": 0.92
    }
  ]
}
`.trim();

  try {
    throwIfAborted(signal);
    const text = await generateText([image], prompt);
    throwIfAborted(signal);
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned || "{}");
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const seen = new Set<string>();
    const items = rawItems
      .map((item: any, index: number) => normalizeOutfitAnalysisItem(item, index))
      .filter((item: OutfitAnalysisItem | null): item is OutfitAnalysisItem => Boolean(item))
      .filter((item: OutfitAnalysisItem) => {
        const key = `${item.label}-${item.englishName}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: OutfitAnalysisItem, b: OutfitAnalysisItem) => b.confidence - a.confidence)
      .slice(0, 8);
    return { summary: String(parsed.summary || ''), items };
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error("Outfit analysis failed", error);
    return { items: [] };
  }
};


export const analyzeProductImage = async (
  imageBase64: string,
  mimeType: string,
  userGuidance?: string,
  productScale?: string,
  styleStrategy?: string,
) => {
  const ai = getAiClient();

  // === DYNAMIC PERSONA ENGINE (FILM EDITION) ===
  // All styles must now adhere to the "Film Look" protocol.
  let roleDefinition =
    "**ROLE**: You are a World-Class Editorial Photographer. You shoot exclusively on Analog Film (Kodak Portra 400).";

  // Mapping strategies to Film Scenarios
  let styleRules = "";
  let mandatoryKeywords =
    "film grain, Kodak Portra 400, analog photography, natural light, cinematic, candid shot";

  if (styleStrategy === "Daily Commuter") {
    styleRules =
      "- Atmosphere: Busy city street, motion blur, morning light, authentic urban texture.\n- Model Vibe: Commuter caught in motion, looking at watch/phone, stress/focus, trench coat.\n- Action: Walking fast across street, not posing.";
  } else if (styleStrategy === "Light Travel") {
    styleRules =
      "- Atmosphere: Train station or airport terminal, golden hour light through windows, dust motes.\n- Model Vibe: Traveler, wind-blown hair, comfortable layers (linen/cotton), holding passport/camera.\n- Action: Looking at departure board or map, candid moment.";
  } else if (styleStrategy === "Chill Weekend") {
    styleRules =
      "- Atmosphere: Sun-drenched cafe terrace, dappled light, wooden table texture.\n- Model Vibe: Relaxed, laughing, no makeup look, soft knitwear.\n- Action: Sipping coffee, looking away from camera, laughing with friends.";
  } else if (styleStrategy === "Business Elite") {
    styleRules =
      "- Atmosphere: Modern architecture, glass reflections, cool cinematic tones, depth of field.\n- Model Vibe: Sharp suit but with realistic fabric wrinkles, confident stride.\n- Action: Walking out of building, adjusting sunglasses, candid business editorial.";
  } else if (styleStrategy === "Gorpcore Outdoor") {
    styleRules =
      "- Atmosphere: Misty forest or rocky trail, rain droplets, moody film look.\n- Model Vibe: Technical gear with visible wear, muddy boots, waterproof shell.\n- Action: Hiking, adjusting gear, looking at horizon, breathing visible air.";
  } else if (styleStrategy === "Gen Z Street") {
    styleRules =
      "- Atmosphere: Skate park or graffiti wall, harsh flash photography (point and shoot style).\n- Model Vibe: Oversized hoodie, baggy jeans, cool attitude, direct flash.\n- Action: Sitting on curb, skating, candid snapshot.";
  } else {
    // Default
    styleRules =
      "- Atmosphere: Natural light, textured background, editorial vibe.\n- Model Vibe: Authentic, imperfect, stylish.\n- Action: Candid movement.";
  }

  try {
    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: `
${roleDefinition}

**GOAL**: Create a prompt for a HYPER-REALISTIC FILM PHOTOGRAPH based on the "${styleStrategy || "Daily Commuter"}" style.
**STRICTLY FORBIDDEN**: 3D render, CGI, plastic skin, artificial studio lighting, stiff poses, perfect symmetry, stock photo look.

**MANDATORY "REALISM" PROTOCOL:**

1. **The "Film Look" is Non-Negotiable:**
   - Every image MUST simulate analog film photography.
   - Use keywords: "film grain", "Kodak Portra 400", "analog photography", "natural light".
   - NEVER use "clean", "smooth", "digital render".

2. **Candid Over Posed:**
   - Models must NEVER look stiff. They should be "caught in the moment".
   - Keywords: "candid shot", "in motion", "relaxed pose", "looking away".

3. **Texture is Everything:**
   - Describe textures explicitly to avoid AI smoothness.
    - Clothes: ${TEXTURE_KEYWORDS.FABRIC.map(t => `"${t}"`).join(", ")}.
    - Environment: ${TEXTURE_KEYWORDS.ENVIRONMENT.map(t => `"${t}"`).join(", ")}.

4. **THE OUTFIT REPLACEMENT PROTOCOL (CRITICAL):**
   - You MUST treat the original image's clothing as **"Invisible/Placeholder"**.
   - **Rule**: Design a NEW outfit. Do NOT describe the clothes currently in the image unless they are the product itself.
   - **Technique**: Overload the prompt with specific fabric keywords (e.g., "thick knitted beige turtleneck", "corduroy", "heavy denim", "sheer silk") to FORCE the model to render new textures.
   - **Constraint**: If the analysis says "Blue Shirt", the final prompt MUST say "Blue Shirt".

5. **THE SCENE RANDOMIZER (CRITICAL):**
    - STOP using "City Street" as default.
    - You MUST cycle through diverse locations.
    - **Random Pool (Pick ONE that fits the vibe)**:
${SCENE_POOL.map(s => `      - "${s}"`).join("\n")}

6. **Body Landmark Mapping (Size Control):**
   - User Input Dimensions: "${productScale || "Not specified"}"
   - If "Large/50cm+": Describe product as "oversized", "dominating silhouette".
   - If "Small": Describe product as "petite", "miniature".

**SPECIFIC STYLE RULES:**
${styleRules}

**BILINGUAL OUTPUT FORMAT (MANDATORY)**
- Provide analysis in both **English [EN]** and **Chinese [CN]**.

**OUTPUT STRUCTURE (Strict JSON)**
Return a JSON object with these exact keys:

{
  "scene_atmosphere": "**Scene Atmosphere (场景氛围)**:\\n[EN] ... \\n[CN] ...",
  "model_outfit": "**Model & Outfit (模特与穿搭)**:\\n[EN] ... \\n[CN] ...",
  "lighting_tone": "**Lighting & Tone (光影与影调)**:\\n[EN] ... \\n[CN] ...",
  "final_prompt": "..." // ENGLISH ONLY. The strict comma-separated prompt.
}

**PROMPT CONSTRUCTION RULES (For 'final_prompt'):**
- Format: [Photography Style & Light], [Subject & Candid Action], [Outfit & Texture Details], [Environment & Atmosphere], [Technical Keywords]
- Example: "analog film photography, natural sunlight, Kodak Portra 400, film grain, a candid shot of a woman laughing as she walks, wearing an oversized beige trench coat over a wrinkled white linen shirt, carrying a textured brown leather tote bag, busy street with old European buildings, dappled light, editorial, cinematic, 8k resolution, authentic."
- **Start with**: "The product must be exactly the same as the reference image, preserving the original appearance, no deformation."

${userGuidance ? `**USER BRIEF**: "${userGuidance}". Execute this request with Film Aesthetic.` : ""}

**RESPONSE FORMAT**:
Respond in pure **JSON** format. Do not use Markdown code blocks.
**CRITICAL**: Ensure the JSON is valid. Escape ALL double quotes inside strings with a backslash.
            `,
          },
        ],
      },
    });

    let text = response.text || "{}";
    // Remove markdown code blocks if present
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Robust JSON Parsing with Sanitization
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("JSON Parse failed, attempting sanitization...", e);
      const sanitized = text.replace(/[\n\r\t]/g, " ");
      try {
        return JSON.parse(sanitized);
      } catch (e2) {
        console.warn("Sanitization failed, attempting Regex Fallback...", e2);
        const extractField = (key: string) => {
          const regex = new RegExp(
            `"${key}"\\s*:\\s*"(.*?)(?="\\s*(?:,|\\}))`,
            "s",
          );
          const match = text.match(regex);
          return match ? match[1].trim() : "";
        };
        const final_prompt = extractField("final_prompt");

        if (final_prompt) {
          return {
            scene_atmosphere: extractField("scene_atmosphere") || "Parsing...",
            model_outfit: extractField("model_outfit") || "Parsing...",
            lighting_tone: extractField("lighting_tone") || "Parsing...",
            final_prompt: final_prompt,
          };
        }
        throw new Error(
          `AI 响应格式严重错误，无法解析: ${text.substring(0, 50)}...`,
        );
      }
    }
  } catch (error) {
    console.error("Analysis failed", error);
    throw error;
  }
};

/**
 * 1.1 Analyze Fission Context (Pose Fission Expert)
 * Analyzes multiple input images to create a highly detailed descriptive prompt.
 */
export const analyzeFissionContext = async (
  images: { base64: string; mimeType: string }[],
  aspectRatio: string,
  imageGroups?: { productCount: number; outfitCount: number; modelCount: number; accessoryCount: number }
) => {
  const ai = getAiClient();
  const isHorizontal = aspectRatio === "16:9";
  const poseCount = isHorizontal ? 8 : 12;
  const productCount = imageGroups?.productCount || 0;
  const outfitCount = imageGroups?.outfitCount || 0;
  const modelCount = imageGroups?.modelCount || 0;
  const accessoryCount = imageGroups?.accessoryCount || 0;

  const productRange = productCount > 0 ? `Images 1-${productCount}` : "None";
  const outfitStart = productCount + 1;
  const outfitRange = outfitCount > 0
    ? `Images ${outfitStart}-${outfitStart + outfitCount - 1}`
    : "None";
  const modelStart = productCount + outfitCount + 1;
  const modelRange = modelCount > 0
    ? `Images ${modelStart}-${modelStart + modelCount - 1}`
    : "None";
  const accessoryStart = productCount + outfitCount + modelCount + 1;
  const accessoryRange = accessoryCount > 0
    ? `Images ${accessoryStart}-${accessoryStart + accessoryCount - 1}`
    : "None";

  const analysisPrompt = `
**ROLE**: High-End Fashion Editorial Director & Professional Visual Analyst.

**TASK**: Analyze the provided reference images and generate a structured description for a ${isHorizontal ? '4x2' : '3x4'} grid generation (Total ${poseCount} images).

**INPUT IMAGES GUIDE**:
- ${productRange}: PRIMARY PRODUCT reference images.
- ${outfitRange}: MODEL OUTFIT EFFECT references showing the desired wearing result / styling outcome.
- ${modelRange}: MODEL identity / body / face reference images.
- ${accessoryRange}: ACCESSORY reference images that must be worn or carried by the model when present.

**YOUR ANALYSIS GOALS**:
1. **PRODUCT FOCUS (CRITICAL)**: Describe the PRIMARY PRODUCT (color, material, specific patterns, fit) with extreme precision. The goal is to show the garment's design, fabric, and how it fits the body.
2. **OUTFIT EFFECT REFERENCE (HIGH PRIORITY WHEN PROVIDED)**: Extract the desired wearing effect from ${outfitRange}, including layering result, garment silhouette, styling logic, tuck/untuck behavior, hem behavior, sleeve behavior, and how the product should sit on the model.
3. **MODEL IDENTITY & DIMENSIONS**: Describe the person in the model reference images with hyper-precision.
   - **FACE**: Ethnicity, hair color/texture, facial structure, eye shape.
   - **BODY (CRITICAL)**: Describe the model's physical dimensions (height, build, shoulder width, waist/hip ratio). The generated model MUST have the EXACT SAME body proportions as the reference images.
4. **ACCESSORY DETAIL (NON-OPTIONAL WHEN PROVIDED)**: Describe every accessory from ${accessoryRange} with enough detail for 1:1 cloning, and state clearly how each accessory should be worn or carried on the model.
5. **INTELLIGENT POSE & ANGLE DIVERSITY (STRICT CONFORMITY)**: Design ${poseCount} UNIQUE fashion poses based on the provided reference angles.
   - **CRITICAL: MATCH REFERENCE ANGLES**. Prioritize the exact user-provided angles/crops and preserve them precisely.
   - **MODEL MUST BE PRESENT IN EVERY IMAGE**. NO EXCEPTIONS.
   - **STRICT PROHIBITION**: Even if one of the reference images is a standalone product (e.g., a pair of shoes, a bag), DO NOT generate a pose that shows just the product.
   - **TREAT PRODUCTS AS WEARABLES**: All reference products/accessories must be integrated into the model's outfit.
   - **ABSOLUTELY FORBIDDEN**: NO standalone shoes, NO standalone bags, NO standalone jewelry, NO flat lays, NO still life shots.
   - **ANGLES**: Ensure the grid contains clear Front, Profile (Side), and Back views that match the reference angles and crops.
   - **CRITICAL**: EXACTLY ${poseCount} distinct poses. NO repetition.

**OUTPUT FORMAT (MANDATORY JSON)**:
Return a JSON object with these keys:
{
  "model_identity": "Specific physical description for identity locking including facial features AND body dimensions/build...",
  "product_description": "Detailed text description of the main garment...",
  "outfit_effect": "Detailed text description of the desired wearing effect / styling result from the outfit-effect references...",
  "accessory_description": "Detailed text description of accessories, and state clearly how they should be worn/carried...",
  "poses_list": "A numbered list of EXACTLY ${poseCount} SHARP, DISTINCT fashion poses. Specifically include mapping for FRONT, SIDE, and BACK views to match input angles/crops. NO standalone product shots."
}

Respond ONLY with valid JSON.
`;

  try {
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 }
    }));
    parts.push({ text: analysisPrompt });

    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL, // Use default text model for fast analysis
      contents: { parts }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Fission analysis failed", error);
    return {
      product_description: "Professional garment",
      outfit_effect: "Desired wearing effect based on product and user notes",
      accessory_description: "Matching accessories",
      poses_list: "Variety of professional fashion poses"
    };
  }
};

/**
 * 2. Generate Image
 * Uses gemini-3-pro-image-preview
 * Supports optional Model Reference Image for face consistency.
 */
export const generateMarketingImage = async (
  prompt: string,
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  referenceImage?: { base64: string; mimeType: string }, // Product
  modelReferenceImage?: { base64: string; mimeType: string }, // Model Face
  modelId: string = 'gemini-3.1-flash-image-preview',
) => {
  const { ai, model } = getImageGenerationContext(modelId, aspectRatio, resolution);
  try {
    const parts: any[] = [];

    // 1. Add Product Image (Image 1)
    if (referenceImage) {
      parts.push({
        inlineData: {
          mimeType: referenceImage.mimeType,
          data: referenceImage.base64,
        },
      });
    }

    // 2. Add Model Reference Image (Image 2), if provided
    if (modelReferenceImage) {
      parts.push({
        inlineData: {
          mimeType: modelReferenceImage.mimeType,
          data: modelReferenceImage.base64,
        },
      });
    }

    // 3. Construct Prompt Logic (with Forced Aspect Ratio)
    let finalPrompt = "";
    
    const getAspectRatioHint = (ar: string) => {
      if (ar === '16:9') return 'WIDE SCREEN, 1792x1024 resolution, cinematic landscape orientation';
      if (ar === '9:16') return 'TALL PHONE SCREEN, 1024x1792 resolution, vertical portrait orientation';
      if (ar === '3:2') return '3:2 landscape, 1536x1024';
      if (ar === '2:3') return '2:3 portrait, 1024x1536';
      if (ar === '4:3') return '4:3 standard landscape, 1280x960';
      if (ar === '3:4') return '3:4 portrait, 960x1280';
      if (ar === '21:9') return 'ULTRA-WIDE cinematic, 1792x768, panorama';
      return '';
    };
    const arHint = getAspectRatioHint(aspectRatio);
    const resolutionHint = resolution === '4K' ? '8K UHD, ultra-high resolution, extremely detailed, masterwork' : resolution === '2K' ? '4K resolution, high definition, sharp focus' : '';
    
    const forcedPrompt = (aspectRatio && aspectRatio !== '1:1') || resolutionHint 
      ? `[OUTPUT: ${aspectRatio}, ${resolution} QUALITY] (${arHint}) ${resolutionHint}, ${prompt} ${aspectRatio !== '1:1' ? `--ar ${aspectRatio}` : ''}` 
      : prompt;

    // Dynamic quality suffix from Nano Banana Skills
    const qualitySuffix = `, ${QUALITY_BOOSTERS.EDITORIAL}`;

    if (referenceImage && modelReferenceImage) {
      // Dual Image Scenario
      finalPrompt = `
      **REQUIRED ASPECT RATIO**: ${aspectRatio} (${aspectRatio.includes('9:16') || aspectRatio.includes('2:3') || aspectRatio.includes('3:4') ? 'Vertical/Portrait' : aspectRatio.includes('16:9') || aspectRatio.includes('3:2') || aspectRatio.includes('21:9') ? 'Horizontal/Landscape' : 'Square'})
      
      You have two input images. 
      Image 1 is the [Product Reference]. 
      Image 2 is the [Model Reference].
      
      **Aspect Ratio**: ${aspectRatio}
      **Goal**: Generate a High-End Editorial Photograph.
      **Scene Description**: ${forcedPrompt} ${qualitySuffix}
      
      CRITICAL INSTRUCTIONS:
      1. PRODUCT CONSISTENCY (MANDATORY): Image 1 is the [Product Reference] and the PIXEL-LEVEL SOURCE OF TRUTH. You MUST preserve its geometry, texture, cut, and every visual detail with 100% FIDELITY. Do NOT allow any deformation or stylistic drift for the product.
      2. MODEL IDENTITY: You MUST use the facial features and identity of the person in Image 2.
      3. INTERACTION: The model (Image 2) should be wearing or interacting with the Product (Image 1) in a CANDID way (not stiff).
      4. STYLE: Cinematic, editorial, photorealistic with natural textures.
      5. PRIORITY: If there is a conflict between the prompt and the product's original appearance, the product's original appearance (Image 1) ALWAYS takes precedence.
      `;
    } else if (referenceImage) {
      // Single Image Scenario
      finalPrompt = `
      [STRICT PRODUCT CONSISTENCY PROTOCOL]
      Image 1 is the absolute reference for the product. Preserve its structure and texture exactly. 
      Create a high quality editorial photograph based on this product reference. 
      Aspect Ratio: ${aspectRatio}. ${prompt} ${qualitySuffix}
      `;
    } else {
      // Text Only Scenario
      finalPrompt = `Aspect Ratio: ${aspectRatio}. ${prompt} ${qualitySuffix}`;
    }

    parts.push({ text: finalPrompt });

    const response = await executeWithTimeout(
      ai.models.generateContent({
        model,
        contents: {
          parts: parts,
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: resolution,
          },
        },
      })
    );

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        } else if (part.text && (part.text.includes('http://') || part.text.includes('https://'))) {
          const urlMatch = part.text.match(/https?:\/\/[^\s\)\n\r]+(?:\.[a-zA-Z0-9]{2,})[^\s\)\n\r]*/g);
          if (urlMatch) {
            urlMatch.forEach(url => images.push(url));
          }
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Image generation failed", error);
    throw error;
  }
};

/**
 * 2.1 Generate Fusion Image (Scene Fusion)
 * Uses gemini-3-pro-image-preview
 */
/**
 * 2.1 Generate Fusion Image (Scene Fusion)
 * Uses gemini-3-pro-image-preview
 */
export const generateFusionImage = async (
  imageBase64: string,
  mimeType: string,
  prompt: string,
  sourceType: "3D" | "REAL",
) => {
  // Redirect to new multi-image compatible function for backward compatibility if needed,
  // or keep as specific fusion logic.
  // For now, let's keep it but ideally we should migrate to the new one.
  return generateImageToImage([{ base64: imageBase64, mimeType }], prompt);
};

/**
 * Calculate the optimal size for gpt-image-2 model following specific constraints:
 * - Max edge length <= 3840px
 * - Both edges must be multiples of 16px
 * - Long edge to short edge ratio must not exceed 3:1
 * - Total pixels must be between 655,360 and 8,294,400
 */
const getGptImage2Size = (aspectRatio: AspectRatio, resolution: ImageResolution): string => {
  const [rw, rh] = aspectRatio.split(':').map(Number);
  const ratio = rw / rh;

  // 1. Handle popular sizes for better consistency
  if (resolution === '1K') {
    if (aspectRatio === '1:1') return '1024x1024';
    if (aspectRatio === '3:2') return '1152x768';
    if (aspectRatio === '2:3') return '768x1152';
    if (aspectRatio === '4:3') return '1152x864';
    if (aspectRatio === '3:4') return '864x1152';
    if (aspectRatio === '4:5') return '1024x1280';
    if (aspectRatio === '16:9') return '1280x720';
    if (aspectRatio === '9:16') return '720x1280';
  } else if (resolution === '2K') {
    if (aspectRatio === '1:1') return '2048x2048';
    if (aspectRatio === '16:9') return '2048x1152';
    if (aspectRatio === '9:16') return '1152x2048';
    if (aspectRatio === '4:3') return '2048x1536';
    if (aspectRatio === '3:4') return '1536x2048';
    if (aspectRatio === '4:5') return '1638x2048';
    if (aspectRatio === '3:2') return '2304x1536';
    if (aspectRatio === '2:3') return '1536x2304';
  } else if (resolution === '4K') {
    if (aspectRatio === '16:9') return '3840x2160';
    if (aspectRatio === '9:16') return '2160x3840';
    if (aspectRatio === '4:3') return '3200x2400';
    if (aspectRatio === '3:4') return '2400x3200';
    if (aspectRatio === '4:5') return '2560x3200';
    if (aspectRatio === '1:1') return '2880x2880';
  }

  // 2. Dynamic calculation for other cases
  let targetPixels = 1048576; // Default 1K
  if (resolution === '2K') targetPixels = 2359296; // ~2.3M
  if (resolution === '4K') targetPixels = 8294400; // 8.2M Max

  let w = Math.sqrt(targetPixels * ratio);
  let h = w / ratio;

  // Round to multiple of 16
  w = Math.round(w / 16) * 16;
  h = Math.round(h / 16) * 16;

  // Ensure within max edge constraint
  if (w > 3840) { w = 3840; h = Math.round((w / ratio) / 16) * 16; }
  if (h > 3840) { h = 3840; w = Math.round((h * ratio) / 16) * 16; }

  // Pixel count audit
  while (w * h > 8294400) {
    w -= 16;
    h = Math.round((w / ratio) / 16) * 16;
  }
  while (w * h < 655360 && w < 3840 && h < 3840) {
    w += 16;
    h = Math.round((w / ratio) / 16) * 16;
  }

  return `${w}x${h}`;
};

const joinApiUrl = (baseUrl: string, path: string): string => {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withDataUrlPrefix = (image: { base64: string; mimeType?: string }): string => {
  const base64 = image.base64 || '';
  if (base64.startsWith('data:')) return base64;
  return `data:${image.mimeType || 'image/png'};base64,${base64}`;
};

const buildMidjourneyPrompt = (prompt: string, aspectRatio: string): string => {
  const cleanPrompt = prompt.trim();
  if (!aspectRatio || /(?:^|\s)--ar\s+\d+:\d+(?:\s|$)/i.test(cleanPrompt)) {
    return cleanPrompt;
  }
  return `${cleanPrompt} --ar ${aspectRatio}`;
};

const generateMidjourneyImagine = async (
  config: ReturnType<typeof getApiConfig>,
  images: { base64: string; mimeType: string }[],
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string[]> => {
  if (!config.baseUrl) {
    throw new Error('Midjourney 需要使用支持 /mj 接口的中转 API，请在设置中启用 Plato 或 Yunwu baseUrl。');
  }

  const submitResponse = await executeWithTimeout(
    fetch(joinApiUrl(config.baseUrl, '/mj/submit/imagine'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        botType: 'MID_JOURNEY',
        prompt: buildMidjourneyPrompt(prompt, aspectRatio),
        base64Array: images.map(withDataUrlPrefix),
        notifyHook: '',
        state: '',
      }),
    }),
    { timeoutMs: 120000, timeoutMessage: 'Midjourney imagine submit timed out.' }
  );

  if (!submitResponse.ok) {
    const errText = await submitResponse.text();
    throw new Error(`Midjourney submit failed: ${submitResponse.status} ${errText}`);
  }

  const submitData = await submitResponse.json();
  const taskId = submitData?.result || submitData?.id;
  if (!taskId || submitData?.code === 0) {
    throw new Error(`Midjourney submit did not return a task id: ${JSON.stringify(submitData)}`);
  }

  const maxPolls = 100;
  for (let i = 0; i < maxPolls; i++) {
    await wait(i < 2 ? 1500 : 3000);

    const taskResponse = await executeWithTimeout(
      fetch(joinApiUrl(config.baseUrl, `/mj/task/${taskId}/fetch`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      }),
      { timeoutMs: 30000, timeoutMessage: 'Midjourney task polling timed out.' }
    );

    if (!taskResponse.ok) {
      const errText = await taskResponse.text();
      throw new Error(`Midjourney task fetch failed: ${taskResponse.status} ${errText}`);
    }

    const taskData = await taskResponse.json();
    const status = String(taskData?.status || '').toUpperCase();

    if (status === 'SUCCESS' && taskData?.imageUrl) {
      return [taskData.imageUrl];
    }

    if (['FAILURE', 'FAILED', 'FAIL'].includes(status)) {
      throw new Error(`Midjourney generation failed: ${taskData?.failReason || taskData?.description || 'unknown error'}`);
    }
  }

  throw new Error('Midjourney generation timed out before returning an image.');
};

const RUNNINGHUB_IMAGE_VALUE_KEYS = new Set([
  'b64_json',
  'base64',
  'image',
  'image_url',
  'imageurl',
  'url',
  'urls',
  'result',
  'results',
  'output',
  'outputs',
  'data',
  'file',
  'files',
  'thumbnail',
  'thumbnail_url',
  'thumbnailurl',
]);

const looksLikeImageUrl = (value: string): boolean => {
  if (value.startsWith('data:image/')) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(value) ||
    /\/(image|images|img|file|files|result|output|thumbnail|cdn)\b/i.test(value);
};

const looksLikeBase64Image = (value: string): boolean => {
  if (value.startsWith('data:image/')) return true;
  if (value.length < 300) return false;
  if (/^task[_-]/i.test(value)) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
};

const normalizeGeneratedImageValue = (value: unknown, keyHint = ''): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const normalizedKeyHint = keyHint.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed) && /(?:url|uri|image|file|output|result|thumbnail)/i.test(keyHint)) {
    return trimmed;
  }
  if (looksLikeImageUrl(trimmed)) return trimmed;
  if (
    looksLikeBase64Image(trimmed) &&
    RUNNINGHUB_IMAGE_VALUE_KEYS.has(normalizedKeyHint) &&
    !/(^|_)(id|task|status|model|prompt|message|error)(_|$)/i.test(keyHint)
  ) {
    return `data:image/png;base64,${trimmed.replace(/\s/g, '')}`;
  }
  return null;
};

export const extractGeneratedImages = (data: any): string[] => {
  const results: string[] = [];
  const seenValues = new Set<string>();
  const seenObjects = new WeakSet<object>();

  const add = (value: string | null) => {
    if (!value || seenValues.has(value)) return;
    seenValues.add(value);
    results.push(value);
  };

  const walk = (value: any, keyHint = '') => {
    const directValue = normalizeGeneratedImageValue(value, keyHint);
    if (directValue) {
      add(directValue);
      return;
    }

    if (typeof value === 'string' && /(?:text|content|message)/i.test(keyHint)) {
      (value.match(IMAGE_URL_PATTERN) || []).forEach(url => {
        if (/^https?:\/\//i.test(url)) add(url);
      });
      return;
    }

    if (!value || typeof value !== 'object') return;
    if (seenObjects.has(value)) return;
    seenObjects.add(value);

    if (Array.isArray(value)) {
      value.forEach(item => walk(item, keyHint));
      return;
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (RUNNINGHUB_IMAGE_VALUE_KEYS.has(normalizedKey)) {
        walk(nestedValue, normalizedKey);
      }
    });

    Object.entries(value).forEach(([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!RUNNINGHUB_IMAGE_VALUE_KEYS.has(normalizedKey)) {
        walk(nestedValue, normalizedKey);
      }
    });
  };

  walk(data);
  return results;
};

const describeImageResponseWithoutImages = (data: any): string => {
  const taskId = data?.task_id || data?.taskId || data?.id || data?.result?.task_id || data?.result?.taskId;
  const status = data?.status || data?.state || data?.result?.status || data?.result?.state;
  const code = data?.code ?? data?.status_code ?? data?.statusCode;
  const message = data?.message || data?.msg || data?.error?.message || data?.error;
  const details = [
    taskId ? `task=${taskId}` : '',
    status ? `status=${status}` : '',
    code !== undefined ? `code=${code}` : '',
    message ? `message=${typeof message === 'string' ? message : JSON.stringify(message)}` : '',
  ].filter(Boolean).join(', ');
  return details
    ? `API returned success but no image URL/base64 was found in the response (${details}).`
    : "API returned success but no image URL/base64 was found in the response.";
};

const delayWithAbort = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(createAbortError());
    return;
  }
  const timeoutId = setTimeout(resolve, ms);
  const abortHandler = () => {
    clearTimeout(timeoutId);
    reject(createAbortError());
  };
  signal?.addEventListener('abort', abortHandler, { once: true });
});

const getRunningHubTaskId = (data: any): string => {
  return String(
    data?.task_id ||
    data?.taskId ||
    data?.task?.task_id ||
    data?.data?.task_id ||
    data?.result?.task_id ||
    data?.id ||
    ''
  ).trim();
};

const getRunningHubTaskStatus = (data: any): string => {
  return String(
    data?.status ||
    data?.state ||
    data?.task?.status ||
    data?.data?.status ||
    data?.result?.status ||
    ''
  ).toLowerCase();
};

const isRunningHubTaskPending = (status: string): boolean => (
  ['queued', 'running', 'processing', 'in_progress', 'pending'].includes(status)
);

const isRunningHubTaskFailed = (status: string): boolean => (
  ['failed', 'failure', 'error', 'expired', 'cancelled', 'canceled'].includes(status)
);

const getRunningHubRootUrl = (baseUrl?: string): string => {
  const normalized = (baseUrl || 'https://www.runninghub.cn').replace(/\/$/, '');
  try {
    const url = new URL(normalized);
    return `${url.protocol}//${url.host}`;
  } catch {
    return normalized;
  }
};

const pollRunningHubImageTask = async (
  config: ReturnType<typeof getApiConfig>,
  taskId: string,
  signal?: AbortSignal
): Promise<string[]> => {
  const rootUrl = getRunningHubRootUrl(config.baseUrl);
  const endpoints = Array.from(new Set([
    `${rootUrl}/openapi/v2/query?taskId=${encodeURIComponent(taskId)}`,
    `${rootUrl}/task/openapi/outputs?taskId=${encodeURIComponent(taskId)}`,
    `${rootUrl}/async-task/${encodeURIComponent(taskId)}`,
  ]));
  let lastData: any = null;
  let lastError: any = null;

  while (true) {
    await delayWithAbort(8000, signal);

    for (const endpoint of endpoints) {
      let taskResponse: Response;
      try {
        taskResponse = await executeWithTimeout(
          fetch(endpoint, {
            method: 'GET',
            signal,
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
            },
          }),
          { timeoutMs: 30000, signal }
        );
      } catch (error) {
        lastError = error;
        continue;
      }

      if (!taskResponse.ok) {
        const errText = await taskResponse.text();
        lastError = new Error(`RunningHub async task fetch failed: ${taskResponse.status} ${errText}`);
        continue;
      }

      lastData = await taskResponse.json();
      const taskData = lastData?.data || lastData?.task || lastData;
      const images = extractGeneratedImages(taskData);
      if (images.length > 0) return images;

      const status = getRunningHubTaskStatus(taskData);
      if (isRunningHubTaskFailed(status)) {
        const message = taskData?.error?.message || taskData?.error || taskData?.message || taskData?.failReason || 'unknown error';
        throw new Error(`RunningHub async image task failed (${taskId}): ${typeof message === 'string' ? message : JSON.stringify(message)}`);
      }

      if (!isRunningHubTaskPending(status) && status && status !== 'completed') {
        console.warn('[RunningHub Image] Async task has no recognized image yet:', taskData);
      }

      lastError = null;
      break;
    }

    if (lastError) {
      console.warn(`[RunningHub Image] Async task ${taskId} is still waiting; polling will continue.`, lastError);
      lastError = null;
    }
  }
};

const QWEN_IMAGE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

/**
 * Qwen-Image-3.0-Pro only accepts the five sizes exposed by DashScope.
 * Creative Center has additional aspect ratios, so snap each one to the
 * closest supported orientation before submitting the request.
 */
const getQwenImageSize = (aspectRatio: string): string => {
  const supportedSizeByRatio: Record<string, string> = {
    // Wide landscape
    '16:9': '2688*1536',
    '21:9': '2688*1536',
    // Standard landscape
    '4:3': '2368*1728',
    '3:2': '2368*1728',
    '5:4': '2368*1728',
    // Square
    '1:1': '2048*2048',
    // Standard portrait
    '3:4': '1728*2368',
    '2:3': '1728*2368',
    '4:5': '1728*2368',
    // Tall portrait
    '9:16': '1536*2688',
  };
  return supportedSizeByRatio[aspectRatio] || '2048*2048';
};

const generateWithQwenImage = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
  options: {
    aspectRatio: string;
    resolution: string;
    sampleCount: number;
    negativePrompt?: string;
    signal?: AbortSignal;
    onStatus?: (status: 'submitting' | 'polling' | 'processing') => void;
  },
): Promise<string[]> => {
  const apiKey = localStorage.getItem('qwen_api_key')?.trim() || '';
  const enabled = localStorage.getItem('qwen_enabled') === 'true';
  if (!enabled || !apiKey) {
    throw new Error('千问3.0pro 尚未启用或未配置 API Key，请前往模型配置完成设置。');
  }

  const content: Array<{ text?: string; image?: string }> = [{ text: prompt.trim() }];
  images.slice(0, 10).forEach((image) => {
    const rawBase64 = image.base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    content.push({ image: `data:${image.mimeType || 'image/png'};base64,${rawBase64}` });
  });

  options.onStatus?.('processing');
  const response = await executeWithTimeout(fetch(QWEN_IMAGE_ENDPOINT, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: QWEN_IMAGE_MODEL_ID,
      input: { messages: [{ role: 'user', content }] },
      parameters: {
        prompt_extend: true,
        size: getQwenImageSize(options.aspectRatio),
        n: Math.max(1, Math.min(options.sampleCount, 6)),
        ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
      },
    }),
  }), { timeoutMs: 180000, timeoutMessage: '千问3.0pro 图像生成超时，请稍后重试。' });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.code || `千问3.0pro API Error ${response.status}`);
  }
  const results = (data?.output?.choices || [])
    .flatMap((choice: any) => choice?.message?.content || [])
    .map((item: any) => item?.image)
    .filter((image: unknown): image is string => typeof image === 'string' && image.length > 0);
  if (results.length === 0) {
    throw new Error(data?.output?.message || data?.message || '千问3.0pro 返回成功，但响应中没有图片。');
  }
  return results;
};

/**
 * 2.1.1 Image-to-Image Generation (Multi-Image Support)
 * Supports dynamic model selection and automatic API key rotation on failure.
 */
export const generateImageToImage = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
  options: { 
    aspectRatio?: AspectRatio; 
    resolution?: ImageResolution;
    modelId?: string; // NEW: Dynamic model support
    negativePrompt?: string; // NEW: Negative prompt support
    workflowHint?: WorkflowHint;
    hasModelRef?: boolean;
    vtonReport?: string; // NEW: Pass detailed analysis from Pass 1
    sampleCount?: number; // NEW: Multi-image support
    signal?: AbortSignal;
    onStatus?: (status: 'submitting' | 'polling' | 'processing') => void;
  } = {}
): Promise<string[]> => {
  const { 
    hasModelRef, 
    vtonReport, 
    negativePrompt, 
    workflowHint, 
    modelId, 
    aspectRatio = '1:1', 
    resolution = '2K',
    sampleCount = 1,
    signal,
    onStatus
  } = options;
  throwIfAborted(signal);
  onStatus?.('submitting');
  // Qwen is an explicit provider exception: Virse does not expose this model,
  // so selecting it must continue to use the dedicated Qwen image API.
  if (modelId === QWEN_IMAGE_MODEL_ID) {
    try {
      return await generateWithQwenImage(images, prompt, {
        aspectRatio,
        resolution,
        sampleCount,
        negativePrompt,
        signal,
        onStatus,
      });
    } catch (error: any) {
      throw new Error(`千问3.0pro API：${error?.message || String(error)}`);
    }
  }
  const virseEnabled = isVirseImageRoutingEnabled();
  const virseApiKey = localStorage.getItem('virse_api_key')?.trim() || '';
  if (virseEnabled) {
    if (!virseApiKey) {
      throw new Error('Virse 中转已开启，但尚未配置 API Key。请先在模型配置中补全 Virse 配置，或关闭 Virse 中转。');
    }
    const virseBaseUrl = localStorage.getItem('virse_base_url') || 'https://api.virse.ai';
    const virseSpaceId = localStorage.getItem('virse_space_id') || '';
    const virseCanvasId = localStorage.getItem('virse_canvas_id') || '';
    const imageHostProvider = localStorage.getItem('image_host_provider') || 'imgbb';
    const imgbbApiKey = imageHostProvider === 'imgbb'
      ? localStorage.getItem('imgbb_api_key')?.trim() || ''
      : '';
    if (!virseSpaceId || !virseCanvasId) {
      throw new Error('Virse 尚未选择工作区/画布，请在模型配置中点击“测试并同步”，选择工作区后保存配置。');
    }
    const configuredVirseModel = localStorage.getItem('virse_model') || 'nano-banana-2';
    const requestedModel = modelId || configuredVirseModel;
    const virseModelMap: Record<string, string> = {
      nanobanana2: 'nano-banana-2',
      standard: 'nano-banana-2',
      'gemini-3.1-flash-image-preview': 'nano-banana-2',
      'gemini-3.1-flash-image': 'nano-banana-2',
      nanobananapro: 'gemini-3-pro-image-preview',
      pro: 'gemini-3-pro-image-preview',
      'gemini-3-pro-image': 'gemini-3-pro-image-preview',
      'gpt-image-2-all': 'gpt-image-2',
      'gpt-image-2-vip': 'gpt-image-2',
      mj_imagine: configuredVirseModel,
    };
    const virseModel = virseModelMap[requestedModel] || requestedModel || configuredVirseModel;
    const baseUrlCandidates = [...new Set([
      virseBaseUrl,
      virseBaseUrl === 'https://api.virse.ai' ? 'https://dev.virse.ai' : 'https://api.virse.ai',
    ])];
    let activeVirseBaseUrl = virseBaseUrl;
    let assetIds: string[] = [];
    let uploadError: any = null;
    for (let baseIndex = 0; baseIndex < baseUrlCandidates.length; baseIndex += 1) {
      const candidateBaseUrl = baseUrlCandidates[baseIndex];
      const candidateAssetIds: string[] = [];
      try {
        for (let index = 0; index < images.slice(0, 10).length; index += 1) {
          throwIfAborted(signal);
          onStatus?.('submitting');
          const image = images[index];
          candidateAssetIds.push(await uploadVirseReference({
            apiKey: virseApiKey,
            baseUrl: candidateBaseUrl,
            spaceId: virseSpaceId,
            canvasId: virseCanvasId,
            base64: image.base64,
            mimeType: image.mimeType || 'image/png',
            index,
            imgbbApiKey,
          }));
        }
        activeVirseBaseUrl = candidateBaseUrl;
        assetIds = candidateAssetIds;
        uploadError = null;
        break;
      } catch (error: any) {
        uploadError = error;
        const message = error?.message || String(error);
        const canTryAlternateNode = /\b429\b|\b50[234]\b|no healthy upstream|service unavailable|bad gateway|rate|too many requests/i.test(message);
        if (!canTryAlternateNode || baseIndex === baseUrlCandidates.length - 1) break;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
    if (uploadError) {
      throw new Error(`Virse 参考图上传失败：${uploadError?.message || String(uploadError)}`);
    }
    const virseReferencePriorityContract = workflowHint === 'single-item-try-on' && hasModelRef
      ? `[VIRSE REFERENCE PRIORITY CONTRACT - DO NOT REORDER OR MIX ROLES]
1. Reference asset / Image 1 is the TARGET MODEL and immutable base canvas. It has absolute highest authority for identity, face, hair, skin, body proportions, pose, limb coordinates, camera, crop, subject scale, background, lighting, shadows, and every non-target pixel.
2. Reference assets / Images 2+ are wearable PRODUCT references only. They have authority only over the explicitly requested garment, footwear, or accessory appearance and construction.
3. Never copy a person, mannequin, face, body, pose, hands, scene, camera, crop, lighting, or unrelated styling from Images 2+. Even if a product reference contains a visible person or mannequin, ignore that carrier completely.
4. Perform an in-place replacement on Image 1. Do not generate a new model or restage the photograph. Product fidelity never overrides Image 1's person, geometry, framing, or scene.`
      : workflowHint === 'storyboard-grid' && hasModelRef
        ? `[VIRSE STORYBOARD REFERENCE CONTRACT]
1. Reference asset / Image 1 is the only source of truth for the recognizable subject, face, hair, body proportions, complete outfit, accessories, location, architecture, lighting, weather, and color palette.
2. Generate one contact sheet whose panels vary only camera position, framing, natural action, gaze, and composition inside the same photographed location.
3. Do not replace the person, clothing, accessories, or scene. Do not copy or invent a different model or location. Do not return repeated copies of Image 1.
4. The requested grid is one final image with distinct edge-to-edge photographic panels and no text, labels, numbers, borders, logos, or watermarks.`
      : '';
    const promptWithVirsePriority = [virseReferencePriorityContract, prompt.trim()].filter(Boolean).join('\n\n');
    const fullPrompt = negativePrompt
      ? `${promptWithVirsePriority}\n\nNegative constraints: ${negativePrompt}`
      : promptWithVirsePriority;
    const modelCandidates = [...new Set([
      virseModel,
      configuredVirseModel,
      'nano-banana-2',
      'gemini-2.5-flash-image',
    ].filter(Boolean))];
    let lastVirseError: any = null;
    for (let candidateIndex = 0; candidateIndex < modelCandidates.length; candidateIndex += 1) {
      const candidateModel = modelCandidates[candidateIndex];
      try {
        return await generateVirseImage({
          apiKey: virseApiKey,
          baseUrl: activeVirseBaseUrl,
          spaceId: virseSpaceId,
          canvasId: virseCanvasId,
          model: candidateModel,
          prompt: fullPrompt,
          aspectRatio,
          resolution,
          assetIds,
          numImages: sampleCount,
          signal,
          onStatus,
        });
      } catch (error: any) {
        lastVirseError = error;
        const message = error?.message || String(error);
        const isTransientUpstreamFailure = /\b50[234]\b|no healthy upstream|service unavailable|bad gateway/i.test(message);
        if (!isTransientUpstreamFailure || candidateIndex === modelCandidates.length - 1) {
          throw new Error(`Virse 模型 ${candidateModel} 生成失败：${message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
    throw new Error(`Virse 图片生成失败：${lastVirseError?.message || '没有可用的图片模型上游'}`);
  }
  const retryLimit = 3;
  let lastError: any = null;
  const MODEL_FALLBACKS: Record<string, string> = {
    'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image',
    'gemini-3-pro-image-preview': 'gemini-3-pro-image'
  };
  
  // Get initial config to know how many keys we have
  const initialConfig = getImageApiConfig();
  const maxRetries = initialConfig.isJijing
    ? Math.min(initialConfig.keyCount, 4)
    : Math.min(initialConfig.keyCount, 3); // Max retry across 3 keys or total keys

  // 1. Determine Target Model FIRST (Critical for specialized prompt logic)
  let targetModel = options.modelId || "gemini-3.1-flash-image-preview";
  if (targetModel === 'nanobanana2' || targetModel === 'standard') {
    targetModel = "gemini-3.1-flash-image-preview";
  } else if (targetModel === 'nanobananapro' || targetModel === 'pro') {
    targetModel = "gemini-3-pro-image-preview";
  }

  // Handle gpt-image-2 resolution constraints
  if (targetModel === 'gpt-image-2' || targetModel === 'gpt-image-2-all') {
    if (resolution === '1K') {
      targetModel = 'gpt-image-2-all';
    } else {
      targetModel = 'gpt-image-2';
    }
  }

  if (initialConfig.isRunningHub) {
    targetModel = resolveRuntimeModelId(targetModel, initialConfig);
  }

  const isGptModel = targetModel.toLowerCase().includes('gpt');
  const isGptImage2 = targetModel === 'gpt-image-2' || targetModel === 'gpt-image-2-all' || targetModel === 'gpt-image-2-vip';
  const isMidjourneyModel = targetModel === 'mj_imagine';
  const isNativePlato = Boolean(initialConfig.isPlato && !initialConfig.isJijing && !initialConfig.isRunningHub);
  const usesOpenAiImageEndpoint = isGptImage2 || isNativePlato || (initialConfig.isRunningHub && !isMidjourneyModel);
  const openAiImageProviderLabel = initialConfig.isRunningHub
    ? 'RunningHub Image'
    : isNativePlato
      ? 'Plato Image'
      : 'GPT Image 2';

  // Force Aspect Ratio into the prompt text for proxy-based models (like GPT Image 2)
  const getAspectRatioHint = (ar: string) => {
    if (ar === '16:9') return 'ULTRA-WIDE SCREEN, cinematic landscape orientation';
    if (ar === '9:16') return 'TALL VERTICAL SCREEN, portrait orientation';
    if (ar === '3:2') return '3:2 landscape format';
    if (ar === '2:3') return '2:3 portrait format';
    if (ar === '4:3') return '4:3 standard landscape';
    if (ar === '3:4') return '3:4 portrait';
    if (ar === '21:9') return 'ULTRA-WIDE cinematic panorama';
    return '';
  };
  const arHint = getAspectRatioHint(aspectRatio);
  const resolutionHint = resolution === '4K' ? '8K UHD, ultra-high resolution, extremely detailed, masterwork' : resolution === '2K' ? '4K resolution, high definition, sharp focus' : '';
  
  // Use a more aggressive "Command" style for the prompt to bypass model laziness
  // UPDATED: Only use this for Gemini/Nano models. GPT models should have a cleaner prompt to avoid parameter conflict.
  const forcedPrompt = (!isGptModel && ((aspectRatio && aspectRatio !== '1:1') || resolutionHint))
    ? `--ar ${aspectRatio} [QUALITY: ${resolution}] (${arHint}) ${resolutionHint}, ${prompt.trim()}` 
    : prompt.trim();

  // Natural language ratio hint for GPT models (secondary insurance)
  const gptRatioHint = isGptModel && aspectRatio && aspectRatio !== '1:1'
    ? (() => {
        const [w, h] = aspectRatio.split(':').map(Number);
        return `[ORIENTATION: CRITICAL - The image must be in a ${aspectRatio} ${w > h ? 'HORIZONTAL' : 'VERTICAL'} orientation. DO NOT generate a square image.]`;
      })()
    : '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const config = getImageApiConfig(initialConfig.currentIndex + attempt);
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: config.isYunwu ? { 
        baseUrl: config.baseUrl,
        headers: { Authorization: `Bearer ${config.apiKey}` }
      } : undefined,
      apiVersion: config.apiVersion as any
    });

    try {
      if (isMidjourneyModel) {
        console.warn(`[Midjourney Imagine] Submit. Ratio: ${aspectRatio}, References: ${images.length}`);
        return await generateMidjourneyImagine(
          config,
          images,
          prompt.trim(),
          aspectRatio as AspectRatio
        );
      }

      // SPECIAL HANDLING FOR OpenAI-compatible image proxy endpoints.
      if (usesOpenAiImageEndpoint) {
        const gptSize = getGptImage2Size(aspectRatio as AspectRatio, resolution as ImageResolution);
        console.warn(`[${openAiImageProviderLabel}] Sending optimized request. Model: ${targetModel}, Size: ${gptSize}, Ratio: ${aspectRatio}, Workflow: ${workflowHint}`);
        
        // Build workflow-aware prompt for GPT (since it doesn't get separate system instructions)
        let gptPrompt = forcedPrompt;
        if (workflowHint === 'garment-extraction') {
          gptPrompt = `[ROLE: Senior fashion image masking and garment extraction specialist]
[TASK: Perform exact in-place garment extraction from Image 1]
[ABSOLUTE GOAL]
- Keep only the requested target item from the user prompt exactly where it is in the original image.
- Preserve the original camera angle, pose-driven shape, perspective, folds, stretch, wrinkles, drape, fabric shadows, and occlusion contours.
- Do NOT straighten, rotate, recenter, resize, redraw, complete, beautify, or redesign the clothing.
- The output must look like the original image with every non-target pixel painted pure white.
[STRICT KEEP]
- Preserve only the requested target item's visible pixels exactly as they appear in Image 1: silhouette, color, pattern, trims, buttons, zippers, seams, folds, drape, fabric texture, stitching, labels, and construction details.
- If multiple garments or accessories are present, remove every item except the requested target item.
[STRICT REMOVE]
- Remove all non-target pixels: other clothing, body, skin, face, head, hair, hands, arms, legs, feet, background, room, studio, floor, props, accessories, jewelry, bags, phones, hanger, mannequin, text, watermark, and logo overlays.
- Where removed body parts or props occluded the garment, do not hallucinate missing fabric; leave those removed/occluded pixels pure white.
[OUTPUT]
- Same garment placement and angle as the original source image.
- Pure white background (#FFFFFF), not transparent and not checkerboard.
- Every non-target pixel must be #FFFFFF. No colored backdrop, gray/beige tint, tabletop, wall, floor, props, gradient, texture, clutter, person, body parts, mannequin, hanger, or extra objects.
- Preserve pixel-level alignment as closely as possible; the clothing boundary must match Image 1 with no visible offset.
[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'single-item-try-on') {
          gptPrompt = `[ROLE: Senior Ecommerce Virtual Try-On Director]
[TASK: Perform an in-place product try-on edit on the exact user person/body reference when supplied; otherwise create one commercial adult try-on image]
[INPUT ROUTING — FOLLOW THE USER PROMPT EXACTLY]
- When the user prompt declares Image 1 as the immutable person/body base canvas, Image 1 is the output composition and identity source of truth. All later declared product images are product references only.
- Without a person/body base canvas, use the product-reference range declared by the user prompt.
[ABSOLUTE PRODUCT LOCK]
- Treat every declared product-reference image as a different view of ONE identical SKU. Reconcile the views; never blend them into a new design.
- Preserve exact silhouette, construction, material, color, pattern, logo, hardware, gemstone count, stitching, closures and distinctive details.
- Calibrate item size from visible human landmarks and normal real-world dimensions for its category. Never enlarge the item for visibility. Use physically correct contact, gravity, folds, occlusion, reflections and local shadows.
[PERSON / SCENE LOCK]
- Image 1, when declared as the base canvas, must remain the same photograph—not a recreation and not a similar-looking person.
- Preserve exact facial identity, expression, hair, skin tone, body shape, anatomy, pose, hands, crop, camera, subject position, background, lighting, shadows, color grade, noise and all unrelated garments/accessories.
- Do not beautify, relight, re-pose, reframe, zoom, crop, extend or redraw the person or scene. Keep original imperfections.
- Change only the target wearing/contact region and the minimum naturally occluded pixels required to fit the product. Every unrelated region must remain visually unchanged.
- Without a person reference, create one tasteful adult ecommerce model and a coherent commercial setting that follows the user prompt.
[REJECT]
No product redesign, mixed SKU, wrong wearing location, floating item, duplicate item, oversized item, altered identity, altered face, altered body, altered pose, changed hands, changed crop, background repaint, relighting, text, watermark, collage or before-and-after layout.
[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'ecommerce-hero') {
          gptPrompt = `[ROLE: Senior Multi-Marketplace Ecommerce Hero Image Director]
[TASK: Create ONE platform-ready visual base image for the exact product shown in the leading product-reference images]
[IMAGE ROUTING]
- Follow the product and style image ranges declared in the user prompt exactly.
- Leading product-reference images define the single SKU identity.
- Any trailing style-reference images control only palette, light, atmosphere and prop density; never copy their products, people, text, logos or layout content.
[PRODUCT IDENTITY — HIGHEST PRIORITY]
- Treat all declared product-reference images as different views and details of ONE identical SKU.
- Preserve exact silhouette, proportions, construction, material, color, finish, pattern, packaging, native label, logo and distinctive details.
- Never average views into a new design, recolor, simplify, duplicate, replace or invent product parts.
[COMMERCE ART DIRECTION]
- Follow the selected marketplace visual system, aspect ratio, composition, background, lighting and approved visual style in the user plan.
- Keep one clear product hierarchy, physically credible scale, grounded contact shadows, accurate perspective and premium commercial finish.
- Reserve the requested calm safe zone for deterministic marketing-copy composition after generation.
[TEXT POLICY]
- Do not draw added marketing copy, headings, badges, price labels, platform logos or watermarks.
- Native text and logos physically printed on the product or packaging must remain unchanged.
[REJECT]
No redesign, mixed SKU, extra product, illegible invented packaging, collage, comparison grid, promotional text, platform logo, watermark, distorted geometry or fake CGI plastic texture.
[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'model-transfer') {
          gptPrompt = `[ROLE: Senior Fashion Face Identity Transfer Director]
[TASK: In-place replace only the face/head identity in Image 3 with the source identity from Images 1-2, using Image 4 only as pose geometry]
[IMAGE MAPPING]
1. Images 1 and 2 are duplicated SOURCE FACE CLOSE-UP anchors. Use them as the highest-priority source for facial identity: face shape, facial structure, eyes, nose, lips, eyebrows, expression character, hairline/visible hair identity, complexion, age impression, and recognizable likeness.
2. Image 3 is the TARGET SCENE original and base canvas. Preserve its background, wall color, wall texture, floor, crop, camera perspective, subject scale, lighting direction, cast shadows, contact shadows, color temperature, contrast, photographic mood, target outfit, target accessories, and target pose. Replace only the target face/head identity. Do NOT repaint or recolor the background and do NOT change the outfit.
   The face lighting in the output must inherit Image 3's existing light/shadow map at the corresponding head position. Do NOT add beauty lighting, extra fill light, rim light, new catchlights, cheek/forehead/nose highlights, decorative dappled shadows, or dramatic facial shadows unless those exact effects already exist in Image 3.
3. Image 4 is a black-and-white pose lineart/silhouette extracted from the target scene. Use it ONLY for pose geometry, outline, head angle, shoulder slope, torso lean, arm/hand/leg placement, crop, camera distance, and subject placement. It has no valid face, identity, clothing, color, or texture.
4. Image 5 is the SOURCE MODEL context image. Use it only to reinforce the same source facial identity when needed. It must not provide outfit, accessories, pose, silhouette, or styling.

[ABSOLUTE LOCKS]
- Do NOT copy Image 3's original target face or identity.
- Do NOT transfer Image 5's clothing, garment color, fabric, pattern, bag, shoes, jewelry, accessories, pose, silhouette, or styling.
- The final image must contain one person only: Image 3's target person, target outfit, target accessories, target pose, and original background, with only the face/head identity changed to Images 1 and 2.
- Match Image 4's pose landmarks and Image 3's exact lighting on the face and clothing, but keep the target clothing and scene unchanged.
- UNCHANGED TARGET REJECTION RULE: returning Image 3 unchanged, or preserving Image 3's original target face, is a failed result.
- Avoid source catalog pose retention, source outfit copying, target outfit changes, background repainting, wall color changes, flat lighting, beauty dish lighting, added face light, wrong shadow direction, added facial highlights, invented dappled facial shadows, missing contact shadows, red cast, oversaturated reds, plastic texture, waxy face, collage, pasted cutout, and mismatched shadows.

[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'model-original-paste-back') {
          gptPrompt = `[ROLE: Senior Fashion Face and Skin Detail Restoration Compositor]
[TASK: Regenerate only a local crop so it can be pasted back into the original full-body image]
[INPUT ROUTING]
1. Image 1 is the TARGET CROP from the final full-body image. It is the exact crop boundary, pose, camera angle, clothing edge, local background, light direction, shadow layout, and composition blueprint.
2. If Image 2 is a black-and-white lineart/silhouette, it is the STRUCTURE COMPANION extracted from Image 1. Use it only for exact alignment: face position, body outline, shoulder line, garment edge, local background edge, crop geometry, and negative space.
3. The remaining images are HIGH-QUALITY MODEL REFERENCES. They provide only the model identity, face structure, eyes, nose, lips, eyebrows, hair character, skin tone, natural skin texture, and fine detail quality.

[ABSOLUTE CROP LOCK]
- Output one image that matches Image 1's crop aspect ratio, subject scale, head/shoulder/torso placement, pose, clothing boundary, background edge, camera perspective, and lighting direction.
- Do NOT zoom, recrop, rotate, mirror, change body pose, change head angle, change shoulder slope, move garment edges, move railings/walls/water/floor/background, or redesign the local background.
- The generated image must be suitable for direct pixel paste-back into the original crop position with only feathered blending.

[BACKGROUND, CLOTHING, AND COLOR LOCK]
- Preserve Image 1's local background, clothing, props, railing, floor, wall, water, shadows, highlights, color temperature, exposure, contrast, and white balance.
- Do not copy color grading, lighting mood, background, clothing, or scene elements from the model references.
- Improve only human detail quality. The repaired crop should look like Image 1 became sharper in the selected human area, not like a newly staged photo.

[DETAIL RESTORATION]
- Restore the face, skin, hairline, hair strands, facial texture, eyes, lips, nose, eyebrows, neck skin, and visible hands/skin from the model references while adapting them to Image 1's exact lighting and angle.
- Preserve natural skin pores and realistic fashion-retouch quality. Avoid waxy, plastic, over-smoothed, red-cast, or doll-like skin.

[DO NOT COPY FROM MODEL REFERENCES]
- Do NOT copy the reference image's clothing, pose, crop, background, props, accessories, color palette, or lighting setup unless they already exist in Image 1.

[OUTPUT]
- Generate the repaired crop only, not the full-body image.
- Output MUST have aspect ratio ${aspectRatio}.

${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'pose-replication-lock') {
          gptPrompt = `[ROLE: Senior Pose Replication Blueprint Director]
[TASK: Rebuild the target model/product into the exact action-reference pose and framing]
[REFERENCE BLUEPRINT PROTOCOL]
You are not making a loose pose variation. Treat the action reference as a visual blueprint, similar to a layout/style replication task, but for human body geometry.

[INPUT ROUTING]
1. The user prompt defines the exact image manifest. Follow it over any default assumptions.
2. The action reference original and its lineart/silhouette companion are POSE BLUEPRINTS ONLY.
3. Target model/product/overall references are the ONLY sources for identity, face, hair, body build, garment/product details, scene, lighting, and commercial look.
4. If Image 1 is identified as the overall model reference in the user prompt, Image 1 has absolute priority for model identity and scene DNA, but NOT for pose when an action reference is provided. Preserve its same face, facial structure, hair, skin tone, age impression, body proportions, worn product, lighting direction, shadows, color palette, camera mood, and recognizable room/set style. The action reference has zero authority over identity or scene style, but it has priority over Image 1 for body pose, limb placement, body angle, camera crop, subject scale, and visible body extent.

[STRICT BLUEPRINT CLONE]
- Copy the action reference's body pose, limb angles, hand gesture, head/neck direction, torso rotation, hip/knee/foot placement, camera height, lens distance, subject scale, crop boundary, visible body extent, and negative space.
- Match half-body/full-body framing exactly. If the blueprint is cropped, keep the same crop. Do not zoom out to reveal missing legs/feet.
- Do not mirror left/right direction unless the user explicitly asks.
- Do not replace the blueprint with a generic front-facing catalog pose.
- Do not return Image 1 unchanged. Do not preserve Image 1's original standing pose, arm placement, leg stance, torso direction, subject placement, or crop when they conflict with the action reference.

[DO NOT COPY FROM ACTION REFERENCE]
- Do NOT copy its face, identity, hairstyle, clothing, accessories, props, background, lighting, color palette, texture, watermark, or text.
- Do NOT beautify, replace, or reinterpret the target face using the action reference face. Do NOT import action-reference walls, chairs, sofas, floors, rooms, props, or lighting.
- If the action pose uses a support object, first inspect the target scene. If Image 1 already contains a compatible support surface/object, use that existing Image 1 support for the pose contact. For wall-leaning poses, if Image 1 has a wall, wall panel, door panel, corner, curtain-side wall, or vertical background surface, the model should visibly lean against or touch that original Image 1 surface. If physical contact would otherwise float, create or reposition only a minimal same-style support surface within Image 1's scene DNA, with matching perspective, material, lighting, occlusion, and contact shadows. Do not copy the action-reference support prop or scene.
- If there is tension between product fidelity and pose geometry, keep the pose geometry and naturally adapt the target garment/product onto that body posture.

[OUTPUT]
- Generate one clean ecommerce fashion image with the Image 1 target identity, product, and scene preserved while the action pose/framing is replicated or scene-compatibly adapted according to the user prompt.
- A result that keeps Image 1's original pose or only makes tiny hand/expression changes is invalid.
- Output MUST have aspect ratio ${aspectRatio}.

${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'hero-pose-lock') {
          gptPrompt = `[ROLE: Senior E-commerce Fashion Director & Product-Fidelity Retoucher]
[TASK: Generate a new hero image from ordered reference images]
[INPUT PRIORITY]
1. Image 1 and any immediately following product images are the product source of truth. Preserve product structure, silhouette, fabric, trims, seams, prints, and material fidelity.
2. The pose reference original and its lineart/silhouette copy are identified in the user prompt. Use them only for crop, framing, camera angle, body scale, subject placement, limb geometry, hand positions, head direction, torso rotation, and leg stance.
3. Ignore the pose reference clothing, face, identity, colors, background, and lighting.

[STRICT POSE LOCK]
- Keep the same pose family, camera angle, crop, body scale, and left/right facing direction as the pose anchors named in the prompt.
- Do not substitute a front standing catalog pose for a side, back, seated, walking, raised-hand, pocket-hand, or over-shoulder reference.
- Do not zoom in/out, mirror the pose, drop hand gestures, or change half-body/full-body framing.
- CROP LOCK: if the pose anchor is half-body, waist-up, thigh-up, knee-up, or otherwise cropped, the output must keep that same visible body extent. Never pull back to reveal full body, legs, or feet that are not visible in the pose anchor.
- IDENTITY/WARDROBE LOCK: when a model identity reference is provided in the user prompt, preserve the same face, hair, body proportions, and all non-conflicting outfit pieces such as jeans, pants, shoes, belts, and simple styling across every output.

[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'pose-fission') {
          gptPrompt = `[ROLE: Senior Fashion Pose Fission Director]
[TASK: Create a same-shoot ecommerce fashion pose variation with a visibly different body pose]
[INPUT PRIORITY]
1. Image 1 is the identity, outfit, product, scene, lighting, and commercial look anchor.
2. Preserve the same model identity, face, hair, body proportions, outfit/product structure, color, fabric, scene DNA, and lighting mood.
3. Rebuild the body pose as a new fashion pose. The change must be obvious at thumbnail size.

[MANDATORY POSE DIVERSITY]
- Do NOT return a near-identical standing pose.
- Change multiple pose landmarks when possible: leg stance, knee bend, hip angle, torso rotation, shoulder line, head direction, arm/hand placement, walking/sitting/leaning geometry, and subject rhythm.
- Product fidelity must not shrink the pose change. Adapt the garment naturally onto the new body geometry.
- Keep anatomy natural, physically plausible, and commercial.

[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'photography-preset') {
          gptPrompt = `[ROLE: Senior Film Colorist, Camera-Look Developer and Fashion Photo Retoucher]
[TASK: Perform a clearly visible in-place camera and film preset transformation on Image 1]
[INPUT ROUTING]
- Image 1 is the only content source and the immutable source of person, garment, product, pose, scene, architecture, object placement and composition.
- The user's photography preset specification controls the new exposure, lighting response, white balance, color science, tonal curve, optical rendering and film grain.

[MANDATORY VISIBLE EDIT]
- Do NOT return Image 1 unchanged or nearly unchanged. A near-identical result is a failed edit.
- Reprocess the complete frame. The before/after difference must be obvious at thumbnail size.
- Visibly rebuild white balance, highlight warmth, shadow hue and density, contrast curve, saturation hierarchy, blue/green response, highlight rolloff, micro-contrast, optical softness and organic film grain according to the user preset.
- Content lock does NOT lock the source exposure, lighting, color grade, contrast, digital sharpness or noise pattern. Those properties must change.

[CONTENT FIDELITY]
- Preserve exact identity, face, body, hair, garment design/color/material, product structure/logo, pose, crop, perspective, background structure and every object position.
- Do not add, remove, move, redesign or replace visible content.
- Make the result look like the exact same captured moment developed through the selected camera and film system, not like a copied source file and not like a new scene.

[FINAL SELF-CHECK]
Compare the output with Image 1 before returning it. If the global color, light, tonal curve and grain are not clearly distinguishable, strengthen the photographic treatment while preserving content.

[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'lighting-replication') {
          gptPrompt = `[ROLE: Senior fashion lighting retoucher and look-development colorist]
[TASK: Relight Image 1 using only the lighting DNA from Image 2+]
[INPUT MAPPING]
- Image 1 is the TARGET CONTENT SOURCE. Preserve every visible element from Image 1.
- Images 2 and beyond are LIGHTING REFERENCES ONLY. They provide lighting, exposure, shadow, color temperature, contrast, highlight rolloff, skin/fabric light response, and color grading. They are NOT content references.

[MANDATORY VISIBLE CHANGE]
- Do NOT return Image 1 unchanged. A near-identical copy is a failure.
- Perform a real relighting and regrading pass. The viewer must immediately see that subject brightness, face exposure, garment highlights, background illumination, shadow density/direction, contrast, and color temperature have shifted toward Images 2+.
- If Images 2+ have a darker/brighter/backlit/higher-contrast/warmer/cooler model lighting relationship, Image 1's person and scene must receive the same visible lighting relationship.
- Match the reference by luminance zones, not by generic beautification: face brightness, skin exposure, hair shadow depth, garment highlight/shadow balance, window/background brightness, furniture brightness, outdoor brightness, and contact-shadow density must each move toward Images 2+.
- For window backlight references, keep windows/background bright, reduce excessive frontal fill on the person, and preserve soft edge/rim light, but keep the face, eyes, smile, hair, garment texture, and skin readable with gentle ambient fill. Do not create black silhouettes, crushed shadows, or bright flat ecommerce/beauty fill light.
- Transfer the scene lighting color and atmosphere too: walls, window frames, furniture, props, plants, floor, and outdoor background must share the reference's warm/cool cast, highlight softness, shadow density, and airy contrast.

[ABSOLUTE CONTENT LOCK]
- Keep Image 1's same person, face, identity, hair, body, pose, clothing, pattern, accessories, background, furniture, props, composition, crop, camera angle, lens perspective, subject placement, and object positions.
- Do not replace, remove, add, redesign, re-style, move, rotate, zoom, recrop, or reinterpret any Image 1 content.
- Do not copy any person, outfit, pose, background, furniture, props, scene, or composition from Images 2+.

[LIGHTING TRANSFER ONLY]
- Transfer only the reference lighting system from Images 2+: key/fill/rim relationship, light direction, shadow angle, shadow softness/hardness, window/sun/studio quality, skin exposure, hair highlights, fabric highlights, contact shadows, bounce light, color temperature, contrast curve, dynamic range, and final color grade.
- Match the model brightness and light-to-shadow contrast of Images 2+ as strongly as physically plausible on Image 1.
- If Images 2+ show a low-fill backlit subject, lower Image 1's excessive frontal subject exposure only to the point where shadows remain detailed and the face/garment are still readable.
- The final image should look like Image 1 was re-lit and regraded with the lighting mood of Images 2+, while all Image 1 content remains unchanged.

[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'listing-optimization') {
          gptPrompt = `[ROLE: Senior Amazon A+ Content Visual Strategist & High-Conversion Layout Designer]
[TASK: Redesign the product listing image based on the optimization brief below]
[ORIENTATION: Use ${aspectRatio} aspect ratio]
[CORE PRINCIPLES]
1. PRODUCT FIDELITY (HIGHEST PRIORITY): The physical product MUST remain PIXEL-IDENTICAL to the reference image. DO NOT alter the product's shape, color, design, or any visual detail. Only redesign layout, background, typography, and supporting elements.
2. LAYOUT: Apply a modern, premium, Apple-inspired grid layout with generous negative space. Product is the visual anchor.
3. TYPOGRAPHY: ALL text MUST be in English. Use clean, modern sans-serif fonts. Text must NEVER overlap the product.
4. COLOR & LIGHTING: Background must be bright, clean, warm (cream white, soft apricot). Natural soft lighting. NO dark or muddy backgrounds.
5. VISUAL ELEMENTS: Replace cheap cartoon icons with ultra-minimal line icons. All graphics must feel premium and cohesive.

${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'structural-repair-v2') {
          gptPrompt = `[ROLE: Senior Product Repair Retoucher]
[TASK: Perform localized product repair on the target image]
[INPUT MAPPING]
- Image 1 is the target scene to repair.
- The following reference images are product standards.
- If the last image contains red painted areas, it is an edit map. Red marks identify the only repair area and must not appear in the final output.

[STRICT REPAIR RULES]
- Do not return the target unchanged.
- Preserve the target scene, person, hands, background, lighting, camera angle, crop, and composition.
- Treat red-marked areas as unwanted artifacts unless the user explicitly says they are damaged product details.
- Remove unrelated extra structures, hallucinated blobs, duplicated parts, wrong accessories, and any product pieces that do not exist in the standard references.
- After removal, rebuild the clean product edge/surface and any revealed background, hand, clothing, or occlusion naturally.
- Remove all red annotations from the final image.
- Keep unmarked areas unchanged.

[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}`;
        } else if (workflowHint === 'scene-product-lock') {
          gptPrompt = `[ROLE: Commercial lifestyle fashion photographer]
[TASK: Follow the numbered reference map and create one photorealistic image]
[PRIORITY]
1. Image 1 is the sole target-product identity authority and defines the exact garment.
2. Any later product-upload images are low-priority outfit/styling context only. Their other garments, shoes and accessories are separate SKUs and must never override or merge into the Image 1 product.
3. Selected-model images define the exact person identity only; pose remains free.
4. Scene image defines the exact recognizable environment plus gaze/head/expression/body-energy cues; never its person identity or styling.
5. Mood/style images affect only palette, light and photographic feel.
Never mix roles or copy people, clothing or accessories from scene/style references.

[ORIENTATION: Output MUST have aspect ratio ${aspectRatio}.]
${gptRatioHint}
${forcedPrompt}
${negativePrompt ? `[NEGATIVE PROMPT]\n${negativePrompt}` : ''}`;
        } else if (workflowHint) {
          gptPrompt = `[ROLE: Professional Fashion AI Artist]
[TASK: Generate a new image based on reference images and the prompt below]
[CRITICAL: PRODUCT CONSISTENCY]
The physical product from the first reference image MUST be preserved with 100% fidelity. Do NOT modify its design, color, or texture. The product is the anchor; only the scene, model identity (if Image 2 provided), and pose (if Image 3 provided) should change.

[INSTRUCTIONS]
- Maintain the exact product structure from the first reference image.
- Apply changes precisely as described in the user prompt.
- Output MUST have aspect ratio ${aspectRatio}.
- NO product deformation allowed.

${gptRatioHint}
${forcedPrompt}`;
        } else if (gptRatioHint) {
          // Add ratio hint for general generation too
          gptPrompt = `${gptRatioHint}\n${forcedPrompt}`;
        }

        const sendGptRequest = async (modelName: string) => {
          const isPlatoGeminiImage = Boolean(config.isPlato && !config.isJijing && !config.isRunningHub && !isGptImage2);
          const usesPlatoEditsEndpoint = isPlatoGeminiImage && images.length > 0;
          const endpoint = joinApiUrl(
            config.baseUrl || '',
            usesPlatoEditsEndpoint ? '/v1/images/edits' : '/v1/images/generations',
          );
          const payload: Record<string, unknown> = isPlatoGeminiImage
            ? {
                model: resolveRuntimeModelId(modelName, config),
                prompt: gptPrompt,
              }
            : {
                model: resolveRuntimeModelId(modelName, config),
                prompt: gptPrompt,
                size: gptSize,
                // Exact match with your doc: array[string]
                // AND adding the prefix for input images as required by most reverse proxies
                image: images.map(img => `data:${img.mimeType || 'image/png'};base64,${img.base64}`),
              };
          // Plato's Nano Banana endpoint defaults to URL output. GPT-only optional fields are
          // omitted because some Plato nodes reject them during request validation.
          if (!isPlatoGeminiImage) {
            payload.quality = "auto";
            payload.response_format = config.isRunningHub ? "url" : "b64_json";
          }

          let requestBody: BodyInit;
          let requestHeaders: Record<string, string>;
          if (usesPlatoEditsEndpoint) {
            const formData = new FormData();
            formData.append('model', String(payload.model));
            formData.append('prompt', gptPrompt);
            formData.append('response_format', 'url');
            formData.append('aspect_ratio', aspectRatio);
            formData.append('image_size', resolution);
            images.forEach((image, index) => {
              const rawBase64 = image.base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
              const binary = atob(rawBase64);
              const bytes = new Uint8Array(binary.length);
              for (let byteIndex = 0; byteIndex < binary.length; byteIndex += 1) {
                bytes[byteIndex] = binary.charCodeAt(byteIndex);
              }
              const mimeType = image.mimeType || 'image/png';
              const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
              formData.append('image', new Blob([bytes], { type: mimeType }), `reference-${index + 1}.${extension}`);
            });
            requestBody = formData;
            requestHeaders = { Authorization: `Bearer ${config.apiKey}` };
          } else {
            requestBody = JSON.stringify(payload);
            requestHeaders = {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
            };
          }

          const fetchResponse = await executeWithTimeout(
            fetch(endpoint, {
              method: 'POST',
              signal,
              headers: requestHeaders,
              body: requestBody,
            }),
            { timeoutMs: 120000 } // Extended timeout for high-res generation
          );

          if (!fetchResponse.ok) {
            const errText = await fetchResponse.text();
            throw new Error(`${openAiImageProviderLabel} API Error: ${fetchResponse.status} ${errText}`);
          }

          const data = await fetchResponse.json();
          const results = (config.isRunningHub || config.isPlato)
            ? extractGeneratedImages(data)
            : (
              Array.isArray(data.data)
                ? data.data
                : Array.isArray(data.images)
                  ? data.images
                  : []
            ).map((item: any) => {
              const b64 = item?.b64_json || item?.base64 || item?.image || item?.data;
              const url = item?.url || item?.image_url;
              if (typeof b64 === 'string' && b64.length > 0) {
                return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
              }
              if (typeof url === 'string' && url.length > 0) {
                return url;
              }
              return null;
            }).filter(Boolean);
          
          if (results.length > 0) return results;
          if (config.isRunningHub) {
            const taskId = getRunningHubTaskId(data);
            const taskStatus = getRunningHubTaskStatus(data);
            if (taskId && isRunningHubTaskPending(taskStatus)) {
              console.warn(`[${openAiImageProviderLabel}] Async task ${taskId} is ${taskStatus}; polling result...`);
              onStatus?.('polling');
              return await pollRunningHubImageTask(config, taskId, signal);
            }
            console.warn(`[${openAiImageProviderLabel}] Response did not contain a recognized image payload:`, data);
            throw new Error(describeImageResponseWithoutImages(data));
          }
          throw new Error("API returned success but no images were found in the response.");
        };

        try {
          return await sendGptRequest(targetModel);
        } catch (gptError: any) {
          const errorMsg = (gptError?.message || gptError?.toString() || '').toLowerCase();
          const fallbackModel = MODEL_FALLBACKS[targetModel];
          if (fallbackModel && (
            errorMsg.includes('model_not_found') || 
            errorMsg.includes('model not found') || 
            errorMsg.includes('404') || 
            errorMsg.includes('not supported') ||
            errorMsg.includes('invalid model') ||
            errorMsg.includes('path not found')
          )) {
            console.warn(`[${openAiImageProviderLabel} Fallback] Model ${targetModel} failed. Retrying with fallback ${fallbackModel}...`);
            targetModel = fallbackModel;
            return await sendGptRequest(targetModel);
          } else {
            throw gptError;
          }
        }
      }

      const parts: any[] = [];

      let processedImages = images;
      // MAGIC TRICK: If strict-geometry-lock or pose-transfer is requested, duplicating the anchor image forces 
      // Gemini's attention mechanism to heavily weight the structure over the texture.
      if (workflowHint === 'strict-geometry-lock' && images.length === 1) {
        processedImages = [images[0], images[0]];
      } else if (workflowHint === 'doll-modification') {
        // [DUPLICATION TRICK] Force geometric consistency by pushing the source image twice 
        // to overpower the reference textures spatially.
        if (images.length >= 2) {
           processedImages = [images[0], images[0], ...images.slice(1)];
        }
      } else if (workflowHint === 'pose-transfer') {
        if (images.length === 2) {
          // For traditional pose transfer, input is [Pose] and [Identity]. We duplicate Pose to overpower.
          processedImages = [images[0], images[0], images[1]];
        } else if (images.length === 3) {
          // Input is [Pose], [Model], [Garment]. Duplicate Pose.
          processedImages = [images[0], images[0], images[1], images[2]];
        }
      } else if (workflowHint === 'garment-replacement') {
        // [DUPLICATION TRICK] Duplicate the Core Garment to overpower the target scene's original clothing details.
        if (images.length === 2) {
          // [Target, Core] -> [Target, Core, Core]
          processedImages = [images[0], images[1], images[1]];
        } else if (images.length === 3 && hasModelRef) {
          // [Target, Identity, Core] -> [Target, Identity, Core, Core]
          processedImages = [images[0], images[1], images[2], images[2]];
        } else {
          processedImages = images;
        }
      }

      const finalNegativePrompt = (aspectRatio && aspectRatio !== '1:1')
        ? `${negativePrompt ? negativePrompt + ', ' : ''}square image, 1:1 aspect ratio, wide border, letterbox, pillarbox, frame around image`
        : negativePrompt;

      const negativePromptLine = finalNegativePrompt
        ? `- **NEGATIVE PROMPT (Strictly Avoid)**: ${finalNegativePrompt}`
        : '';
      const isSkeletonWorkflow = workflowHint === 'pose-transfer' && images.length === 3;
      const isGarmentReplacement = workflowHint === 'garment-replacement';

      const arHint = getAspectRatioHint(aspectRatio);
      const ratioHint = `**REQUIRED ASPECT RATIO**: ${aspectRatio} - ${arHint} (${aspectRatio.includes('9:16') || aspectRatio.includes('2:3') || aspectRatio.includes('3:4') || aspectRatio.includes('4:5') ? 'Vertical/Portrait' : aspectRatio.includes('16:9') || aspectRatio.includes('3:2') || aspectRatio.includes('4:3') || aspectRatio.includes('21:9') ? 'Horizontal/Landscape' : 'Square'})\n      `;

      console.warn(`[AI GEN] Target: ${targetModel}, Ratio: ${aspectRatio}, Res: ${resolution}`);

      // Specialized handling for GPT-based proxy models (OpenAI/DALL-E/Midjourney style)
      if (isGptModel) {
        const resHint = resolution === '4K' ? '8k resolution, cinematic, hyper-detailed' : resolution === '2K' ? '4k high resolution, high quality' : 'high quality';
        const arDescription = aspectRatio === '9:16' || aspectRatio === '2:3' || aspectRatio === '3:4' || aspectRatio === '4:5'
          ? 'vertical portrait'
          : aspectRatio === '16:9' || aspectRatio === '3:2' || aspectRatio === '4:3' || aspectRatio === '21:9'
            ? 'wide landscape'
            : 'square';
        
        // Build a more descriptive prompt for GPT models to ensure they look at the reference images
        let gptContext = `[IMAGE GENERATION TASK]
        Role: Professional Fashion AI Artist.
        Instruction: Generate a NEW image based on the provided reference images and the prompt below.
        Reference Images:
        - Image 1: Primary scene and pose anchor.
        - Image 2: Core garment/product details.
        ${processedImages.length >= 3 ? '- Image 3: Secondary garment or model identity.' : ''}
        ${processedImages.length >= 4 ? '- Image 4: Additional styling details.' : ''}
        
        Task Requirement:
        1. Maintain the exact pose and composition of Image 1.
        2. Replace/Apply the exact garment details from Image 2.
        3. Output MUST be ${arDescription} with aspect ratio ${aspectRatio}.
        
        Detailed Analysis context:
        ${vtonReport || 'N/A'}
        
        User Description: ${prompt.trim()}
        
        Final Parameters: --ar ${aspectRatio} --v 6.0 --q 2 --style raw
        `;

        if (workflowHint === 'structural-repair-v2') {
          gptContext = `[IMAGE EDITING TASK]
          Role: Senior Product Repair Retoucher.
          Reference Images:
          - Image 1: Target scene/image to repair.
          - Images 2+: Product standard references and possibly a final red-mask edit map.

          Mandatory requirements:
          1. Preserve Image 1's scene, person, hands, background, lighting, camera angle, crop, and composition.
          2. If a red mask is present, treat the red-painted region as unwanted extra structure/artifact by default. Remove hallucinated blobs, duplicate parts, wrong accessories, and non-reference product pieces, then fill the area naturally.
          3. Remove the red paint from the final image.
          4. Do not return Image 1 unchanged. The defective or marked product area must visibly improve and match the standard references.
          5. Keep unmarked/non-product areas unchanged.
          6. Output MUST be ${arDescription} with aspect ratio ${aspectRatio}.

          User Description: ${prompt.trim()}
          Final Parameters: --ar ${aspectRatio} --v 6.0 --q 2 --style raw
          `;
        }

        parts.push({ text: gptContext });
        
        processedImages.forEach((img: any) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || img.mime || 'image/jpeg',
              data: img.base64,
            },
          });
        });
      } else {
        const systemPrompt = ratioHint + (processedImages.length > 0
          ? isGarmentReplacement
            ? hasModelRef
              ? `
        **ROLE**: Pixel-Perfect Virtual Try-On Director & Identity Cloning Surgeon.
        **MISSION**: Generate ONE photorealistic image that combines these core elements with ZERO deviation:
          1. MODEL: The user-provided model's face, hair, skin tone, and body shape.
          2. GARMENT & STYLING: The user-provided core garment and matching outfits.
          3. POSE & ANGLE: The exact action, pose, and camera angle from the target replacement gallery image.

        **STRUCTURAL PRIORITY PROTOCOL V2 (ENFORCED)**:
        - The generated garment MUST match the **SILHOUETTE** and **STRUCTURE** of Image 3.
        - If Image 3 is sleeveless, the output MUST be sleeveless.
        - If Image 3 has a V-neck, the output MUST have a V-neck.
        - Do NOT let the target scene's (Image 1) original clothing influence the structure of the new garment.

        **ANALYTICAL CONTEXT**:
        ${vtonReport || 'No pre-analysis available.'}

        **INPUT MAPPING (MEMORIZE THIS)**:
        - Image 1 = **POSE & ANGLE REPLACEMENT SOURCE**
        - Image 2 = **MODEL IDENTITY SOURCE (FACE & SKIN ONLY)**
        - Image 3 = **CORE GARMENT**
        ${processedImages.length >= 4 ? '- Image 4 = STYLING & MATCHING / SECONDARY GARMENT.' : ''}

        **CRITICAL RULE**: The generated person MUST BE the model provided in Image 2. The output garment MUST be a **PIXEL-LEVEL CLONE** of Image 3. The output image MUST have the **IDENTICAL composition and action** as Image 1.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
              `
              : `
        **ROLE**: Pixel-Perfect Virtual Try-On Specialist.
        **MISSION**: Replace the clothing on the person in Image 1 with the EXACT garment from Image 2.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
          : isSkeletonWorkflow
            ? `
        **ROLE**: Senior fashion retoucher and AI processing expert.
        **TASK**: Re-stage the person and outfit from Image 3 into the EXACT geometric posture mapped by Image 1.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
            : workflowHint === 'single-item-try-on'
            ? `
        **ROLE**: Senior Ecommerce Virtual Try-On Director.
        **MISSION**: Perform ONE photorealistic in-place try-on edit on the exact user person/body reference when supplied.

        **INPUT ROUTING — FOLLOW THE USER PROMPT EXACTLY**:
        - When Image 1 is declared as the immutable person/body base canvas, Image 1 defines the exact output person, scene and composition. Later declared images are product references only.
        - Without a person/body base canvas, use the product-reference range declared in the user prompt.

        **PRODUCT IDENTITY LOCK — HIGHEST PRIORITY**:
        - Reconcile all declared product references as multiple views of one identical SKU. Preserve its silhouette, construction, material, color, pattern, logo, hardware, gemstone count, stitching, closures and every distinctive detail.
        - Never average, redesign, simplify, duplicate, recolor or mix the product with any item already worn by the person reference.
        - Calibrate the product from visible human landmarks and category-normal real-world dimensions. Never enlarge it for visibility. Use correct gravity, drape, contact, occlusion, reflections, skin interaction and local cast shadows.

        **REFERENCE LOCK**:
        - Image 1, when declared as the base person/body canvas, must remain the same photograph—not a recreation or similar person.
        - Preserve exact facial identity, expression, hair strands, skin tone, body shape, anatomy, pose, hands, crop, camera perspective, subject position, background, lighting, shadows, color temperature, color grade, noise and all unrelated garments/accessories.
        - Do not beautify, relight, re-pose, reframe, zoom, crop, extend or redraw the reference. Preserve original imperfections.
        - Change only the target wearing/contact region and the minimum naturally occluded pixels needed for a believable fit. Every unrelated region must remain visually unchanged.
        - If no person/body image is supplied, create one tasteful adult ecommerce model and coherent commercial setting strictly from the user plan.

        **FAILURE BLOCKLIST**:
        No changed product design, mixed SKU, wrong wearing location, floating item, oversized item, duplicated accessory, altered identity, altered face, altered body, altered pose, changed hands, changed crop, scene drift, background repaint, relighting, text, watermark, collage, split screen, bad anatomy or plastic CGI texture.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
            : workflowHint === 'ecommerce-hero'
              ? `
        **ROLE**: Senior Multi-Marketplace Ecommerce Hero Image Director.
        **MISSION**: Create ONE polished visual base image for the exact same SKU shown across the leading product-reference images.

        **IMAGE ROUTING**:
        - Obey the exact product-reference and style-reference image ranges in the user prompt.
        - Leading product references define the SKU. Trailing style references affect only palette, lighting, atmosphere and prop density.
        - Never copy a style reference's product, person, text, logo or layout content.

        **PRODUCT IDENTITY LOCK — HIGHEST PRIORITY**:
        - Reconcile all declared product-reference images as multiple views/details of one identical product. Preserve silhouette, construction, proportions, material, color, finish, pattern, native packaging, label, logo and distinctive features.
        - Never redesign, average, recolor, simplify, duplicate, replace or mix the product with another item.

        **PLATFORM AND STYLE ORDER**:
        - Product identity and user-corrected facts come first; then marketplace layout/readability rules; then user creative requirements; then selected visual style.
        - Match the confirmed platform visual system, background, lighting, props, product occupancy and requested copy-safe zone.
        - Produce a complete premium commercial photograph with realistic perspective, scale, contact, reflections and shadows.

        **DETERMINISTIC TEXT PIPELINE**:
        - This stage creates the visual base only. Do not render added headlines, subheadings, badges, prices, platform logos, watermarks or decorative letter-like marks.
        - Preserve only text and logos physically present on the source product or its packaging.

        **FAILURE BLOCKLIST**:
        No changed SKU, invented components, extra product, collage, comparison grid, promotional text, platform logo, watermark, distorted geometry, floating product, mismatched reflections or fake plastic CGI texture.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
            : workflowHint === 'model-transfer'
              ? `
        **ROLE**: Senior Fashion Face Identity Transfer Director.
        **MISSION**: Perform an in-place face/head identity replacement in Image 3 using the source identity from Images 1 and 2. Preserve Image 3's target outfit, accessories, pose, scene, camera, and lighting.

        **INPUT CONTRACT**:
        - Images 1 and 2 = duplicated SOURCE FACE CLOSE-UP anchors. They provide the highest-priority source facial identity: face shape, facial structure, eyes, nose, lips, eyebrows, expression character, hairline/visible hair identity, complexion, age impression, and recognizable likeness.
        - Image 3 = TARGET SCENE original and base canvas. It is the source of truth for background/location, wall color, wall texture, floor, crop, camera perspective, subject scale, light direction, cast-shadow geometry, contact shadows, facial highlight/shadow layout, color temperature, contrast, photographic mood, target outfit, target garment details, target shoes, target bag, target jewelry, target accessories, and target pose. Keep these unchanged except for the target face/head identity.
        - Image 4 = black-and-white pose lineart/silhouette extracted from the target scene. It is ONLY a geometry map for outline, head angle, shoulder slope, torso lean, hand/arm/leg placement, crop, camera distance, and subject placement. It contains no usable identity, face, hair, clothing, color, or texture.
        - Image 5 = SOURCE MODEL context image. Use it only to reinforce the same source facial identity when needed. It must not provide outfit, accessories, pose, silhouette, or styling.

        **ABSOLUTE FACE IDENTITY AND TARGET OUTFIT LOCK**:
        - Preserve Images 1 and 2's source face identity: face shape, eyes, nose, lips, eyebrows, expression character, hairline/visible hair identity, complexion, age impression, and recognizable likeness.
        - SOURCE FACE CLOSE-UP PRIORITY: Images 1 and 2 outrank Image 3's original target face. If the output still resembles the target-scene face more than Images 1 and 2, regenerate internally with stronger source-face identity.
        - Do NOT transfer Image 5's outfit, garment color, fabric, pattern, seams, neckline, hem, shoes, bag, jewelry, accessories, pose, silhouette, or styling.
        - Do NOT copy Image 3's original target face or identity.
        - Keep Image 3's target outfit, target bag, target shoes, target jewelry, target accessories, target pose, and target scene unchanged.

        **BACKGROUND AND LIGHTING LOCK**:
        - Keep Image 3's wall color, plaster texture, floor, shadow pattern, background crop, camera angle, and scene composition unchanged.
        - Do NOT repaint Image 3's background, change the wall color, smooth the wall texture, move the cast shadows, add foliage shadow patterns, or make a new similar-looking scene.
        - FACE LIGHTING MUST BE SCENE-EXACT: inherit Image 3's existing facial light/shadow layout at the corresponding head position. Do NOT add beauty lighting, extra fill light, rim light, new catchlights, cheek/forehead/nose highlights, decorative dappled shadows, or dramatic facial shadows unless those exact effects are already visible on Image 3's person.

        **POSE, SCENE AND LIGHTING TRANSFER**:
        - Replace only Image 3's face/head identity with Images 1 and 2's source facial identity, fitted into Image 4's pose geometry.
        - Copy visible pose landmarks from Image 4: head tilt, chin angle, shoulder slope, torso lean, hip placement, arm bend, hand placement, leg stance, crop, subject scale, and left/right placement.
        - Copy visible lighting landmarks from Image 3: face shadow side, neck shadow, arm shadow, garment highlight direction, wall cast shadows, contact shadow, contrast level, and warm/cool balance.
        - Match facial illumination by luminance zones, not by generic beautification: shadow side, highlight side, nose/eye-area/neck shadows, face exposure, contrast, edge softness, and color temperature must follow Image 3. If Image 3's face lighting is plain, keep it plain.
        - Keep Image 3's target outfit physically intact. Do not turn it into the source context image's outfit.
        - The output must look like a real fashion photograph, not a pasted cutout.
        - UNCHANGED TARGET REJECTION RULE: returning Image 3 unchanged, or preserving Image 3's original target face, is a failed result.

        **FAILURE BLOCKLIST**:
        - No second person, collage, split screen, face drift, target-scene face copied, source catalog pose retained, source outfit copied, target outfit changed, pose not copied, background repainting, wall color changed, wall texture changed, lighting not copied, beauty dish lighting, artificial fill light, added face light, added facial highlight, invented dappled facial shadow, decorative face shadow, red cast, oversaturated reds, plastic texture, waxy face, CGI, mismatched shadows, wrong shadow direction, missing wall shadows, missing contact shadow, pasted cutout, or floating subject.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
            : workflowHint === 'model-original-paste-back'
              ? `
        **ROLE**: Senior Fashion Face and Skin Detail Restoration Compositor.
        **MISSION**: Generate ONE repaired local crop that can be pasted back into the original full-body image at the exact same coordinates.

        **INPUT CONTRACT**:
        - Image 1 = TARGET CROP from the final full-body image. It is the source of truth for crop boundary, pose, head angle, shoulder line, torso placement, garment edges, local background, light direction, shadows, camera perspective, subject scale, and composition.
        - If Image 2 is a black-and-white lineart/silhouette, it is the STRUCTURE COMPANION extracted from Image 1. It is source of truth for exact alignment, body outline, face position, shoulder line, clothing boundary, local background edge continuity, crop geometry, and negative space.
        - The remaining images = HIGH-QUALITY MODEL REFERENCES. They are source of truth only for model identity, facial structure, eyes, nose, lips, eyebrows, hair character, skin tone, skin texture, and fine human detail quality.

        **ABSOLUTE CROP AND STRUCTURE LOCK**:
        - Keep Image 1's aspect ratio, crop boundary, subject placement, head/shoulder/torso geometry, clothing edge positions, background edge continuity, camera angle, lens distance, local lighting, and local shadows.
        - Do NOT zoom, pull back, rotate, mirror, recrop, move the face, move shoulders, change pose, change head direction, change clothing silhouette, move railings/walls/water/floor/background, or redesign background.
        - The output must be a local crop only. It must be ready for direct paste-back into Image 1's original crop position with feathered blending.

        **BACKGROUND, CLOTHING, AND COLOR LOCK**:
        - Preserve Image 1's local background, clothing, props, railings, floor, wall, water, shadows, highlights, color temperature, exposure, contrast, and white balance.
        - Do NOT copy color grading, lighting mood, background, clothing, accessories, props, or scene elements from the model references.
        - Improve only human detail quality. The repaired crop should look like Image 1 became sharper in the selected human area, not like a newly staged photo.

        **IDENTITY AND DETAIL RESTORATION**:
        - Restore the model's face, eyes, lips, nose, eyebrows, hairline, hair strands, skin tone, pores, neck skin, visible hands/skin, and natural fashion-retouch detail from Images 2+.
        - Adapt the restored identity to Image 1's exact lighting, shadow side, exposure, color temperature, camera angle, and expression context.
        - Preserve realistic skin texture. Avoid waxy skin, plastic skin, doll face, red cast, oversaturated reds, over-smoothing, or CGI.

        **DO NOT COPY FROM REFERENCES**:
        - Do NOT copy Images 2+'s pose, crop, clothing, background, props, accessories, lighting setup, color palette, or camera framing unless already present in Image 1.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
            : workflowHint === 'pose-replication-lock'
              ? `
        **ROLE**: Senior Pose Replication Blueprint Director.
        **MISSION**: Generate ONE professional ecommerce fashion image by cloning the uploaded action reference's pose, crop, camera geometry, and subject placement as a strict visual blueprint, while preserving the target model/product identity from the other references.

        **COGNITIVE PIPELINE (MANDATORY)**:
        1. **Blueprint Analysis**: Deeply analyze the action reference original named in the user prompt. Map its body skeleton, limb angles, gesture, head direction, torso rotation, crop boundary, subject scale, camera height, lens distance, and negative space.
        2. **Lineart/Silhouette Alignment**: Use the companion lineart/silhouette named in the user prompt as a structure map for body outline, limb geometry, visible body extent, and framing.
        3. **Content Rebuild**: Re-stage the target model/product/overall reference into that exact blueprint. Keep the target identity, hair, skin tone, body proportions, garment/product details, scene DNA, lighting mood, and commercial styling.
        4. **Final Lock Check**: Reject unchanged Image 1 outputs, Image 1 original-pose preservation, generic catalog poses, crop drift, zoom drift, mirrored directions, missing hand gestures, and invented body placement.

        **STRICT IMAGE ROUTING**:
        - The action reference original and lineart/silhouette companion are POSE BLUEPRINTS ONLY.
        - Target model/product/overall images are the ONLY valid sources for face, identity, hair, clothing, product, background, lighting, color palette, and styling.
        - If the user prompt identifies Image 1 as the overall model reference, Image 1 is the highest-priority source for model identity and scene DNA, but NOT for pose. Preserve its face, facial geometry, hairline, hairstyle, skin tone, age impression, body proportions, worn product, lighting direction, shadows, color temperature, lens mood, materials, and recognizable commercial room/set style.
        - Do NOT copy the action reference's person identity, face, hair, clothing, accessories, props, background, lighting, color palette, texture, watermark, or text.
        - Do NOT let the action reference change the target model's face, hair, ethnicity/age impression, body build, product identity, or scene. It controls pose/framing only.
        - Do NOT copy action-reference support props or environment objects. If the action pose leans on or touches a wall, table, console, column, chair, sofa, railing, or pedestal, first map that contact to an existing compatible object/surface in Image 1. For wall-leaning references, use the original Image 1 wall/panel/vertical background surface when visible. If the body would float without support, add or reposition only a minimal same-style support surface that belongs to Image 1's scene DNA, with realistic contact, occlusion, perspective, and shadows.
        - Do NOT let Image 1's original pose override the action reference. The original Image 1 pose is replaceable content.

        **STRICT BLUEPRINT LOCK**:
        - Copy body pose, arms, hands, fingers where visible, head/neck direction, shoulder slope, torso lean, hip placement, leg stance, foot direction, camera angle, subject scale, crop boundary, and visible body extent from the action blueprint.
        - Keep half-body/full-body framing exactly. If the blueprint crops at waist, thigh, knee, ankle, or any other boundary, keep that boundary.
        - Do not zoom in/out, mirror left/right direction, straighten bent joints, remove raised arms, remove pocket hands, remove seated/walking/leaning stance, or convert side/back/three-quarter view into front view.
        - Do not return the target overall reference as-is. Do not keep the original arm placement, original leg stance, original torso direction, original crop, or original subject placement from Image 1 if the action blueprint differs.
        - If product fidelity conflicts with the pose, keep the pose and drape/adapt the target product naturally.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
            : workflowHint === 'pose-transfer'
              ? `
        **ROLE**: Senior fashion retoucher specializing in pose-and-framing transfer.
        **TASK**: Re-stage the person and outfit from the subsequent reference images into the EXACT pose, angle, and framing blueprint provided in Image 1 and 2.
        **IMAGE MAPPING**:
        - Image 1 & 2: POSE & COMPOSITION ANCHOR.
        - Image 3 & beyond: PRODUCT DETAILS & MODEL IDENTITY.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : workflowHint === 'hero-pose-lock'
                ? `
        **ROLE**: Senior E-commerce Hero Image Director & Product-Fidelity Retoucher.
        **MISSION**: Generate ONE professional fashion hero image with exact pose/framing transfer and strict product fidelity.

        **INPUT CONTRACT**:
        - Image 1 and any subsequent product images named in the user prompt are the PRODUCT SOURCE OF TRUTH.
        - The user prompt identifies the POSE ANCHOR original image and its LINEART/SILHOUETTE companion by exact Image number.
        - The pose original controls crop, framing, camera angle, lens distance, body scale, subject placement, left/right facing direction, hands, arms, shoulders, head direction, torso rotation, hips, knees, feet, and body silhouette.
        - The lineart/silhouette companion controls skeletal alignment, limb angles, hand positions, head direction, torso rotation, leg stance, body proportions, and negative-space shape.

        **PRIORITY ORDER**:
        1. Pose anchor body geometry: exact pose, crop, camera angle, body scale, body orientation, limb angles, hands, head, torso, hips, legs, and composition.
        2. Product clothing identity: structure, silhouette, fabric, trim, seams, prints, and material details from the product image(s).
        3. Model identity/body reference, if provided.
        4. Scene/background instructions.
        Product clothing fidelity must never be used as a reason to change the pose geometry. If there is tension, keep the pose geometry and adapt the garment naturally onto that body posture.

        **STRICT POSE FAILURE BLOCKLIST**:
        - Do NOT replace the reference pose with a generic front-facing standing catalog pose.
        - Do NOT change side/back/three-quarter direction into a front view, or front view into side/back.
        - Do NOT remove raised arms, pocket hands, hand-to-face gestures, seated stance, walking stance, leaning stance, crossed legs, bag-holding arm angles, over-shoulder turns, or visible torso rotation.
        - Do NOT straighten bent elbows, change wrist placement, change shoulder slope, change hip tilt, change knee bend, or alter foot direction.
        - Do NOT zoom in/out, change half-body to full-body, change full-body to half-body, change subject scale, or mirror left/right direction.
        - CROP LOCK: if the pose anchor is half-body, waist-up, thigh-up, knee-up, or cropped at any point, keep that exact crop boundary. Never reveal full body, legs, or feet outside the reference crop.
        - Ignore pose-reference clothing, face, identity, background, color palette, texture, and lighting.

        **MODEL IDENTITY/WARDROBE LOCK**:
        - If the user prompt defines a model identity reference, preserve that exact face, hair, skin tone, body proportions, and person identity.
        - Model identity references are NEVER scene/background/lighting/camera references. Do NOT copy or infer their background, walls, floors, ocean/sea, sky, street, architecture, furniture, props, shadows, lighting direction, color temperature, lens distance, camera crop, or environment mood.
        - If the user prompt defines a separate scene reference, that scene reference is the ONLY location/background source. If no scene reference is defined, use only the user's platform/style/background instructions, never the model identity image environment.
        - Preserve all model-reference outfit pieces that do not conflict with the product asset, especially jeans/pants/bottoms, shoes, belts, and simple styling.
        - If the model identity reference wears jeans, the output must keep the same jeans style, wash, fit, and color wherever the crop shows them.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                : workflowHint === 'pose-fission'
                  ? `
        **ROLE**: Senior Fashion Pose Fission Director.
        **MISSION**: Create ONE same-shoot ecommerce fashion image where the model keeps the same identity, outfit/product, scene DNA, lighting mood, and commercial quality, but the body pose is visibly different.

        **INPUT CONTRACT**:
        - Image 1 is the master anchor for the model identity, face, hair, skin tone, body proportions, worn product, styling, scene, lighting, color palette, and commercial direction.
        - Optional later model/product/scene images reinforce identity, product details, and scene cues only.
        - The user prompt provides the target pose instruction.

        **MANDATORY POSE DIVERSITY**:
        - Do NOT return a near-identical pose or tiny catalog variation.
        - The result must read as a new pose at thumbnail size.
        - Change multiple pose landmarks when possible: leg stance, knee bend, hip angle, torso rotation, shoulder line, head direction, arm/hand placement, walking/sitting/leaning geometry, and overall body rhythm.
        - If the source is standing straight, avoid another straight front-standing pose unless the requested action explicitly requires it.
        - Product fidelity must never be used as a reason to shrink the pose change. Keep garment details accurate by draping the same clothing naturally over the new body geometry.

        **LOCKS**:
        - Preserve the same person identity, age impression, face, hair, skin tone, body proportions, product color, fabric, seams, trims, print/pattern, accessories authorized by the reference, scene identity, lighting mood, and camera feel.
        - Keep anatomy natural, hands plausible, feet grounded, perspective coherent, and product readable.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : options.workflowHint === 'clothing-modification'
                ? `
        **ROLE**: Professional Fashion Designer and AI Modification Expert.
        **TASK**: Execute precise clothing modification based on user instructions.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : options.workflowHint === 'doll-modification'
                ? `
        **ROLE**: Precision Toy & Doll Spatial Modification Expert.
        **TASK**: Execute STRICTLY LOCALIZED modification on a plush toy/doll.
        **CRITICAL SPATIAL RULES**:
        1. ONLY modify the specific body parts/regions explicitly mentioned in the prompt below.
        2. ALL other parts of the doll (tail, body, limbs, face, eyes, accessories, etc.) that are NOT mentioned as modification targets MUST remain 100% IDENTICAL to Image 1.
        3. If the prompt contains a "FROZEN ZONES" section, treat those listed parts as ABSOLUTELY IMMUTABLE.
        4. Maintain the exact same camera angle, lighting, and background as Image 1.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : options.workflowHint === 'product-modification'
                ? `
        **ROLE**: Precision Ecommerce Product Modification Expert for plush toys, dolls, backpacks, handbags, tote bags, lunch bags, cosmetic bags, and related bag products.
        **TASK**: First identify the category of the product in Image 1, then execute the requested retouching or spatial modification without changing that category or redesigning the product.
        **CATEGORY-SPECIFIC FIDELITY RULES**:
        1. For a toy/doll: preserve its face, expression, body proportions, limbs, pose, fur direction, plush texture, seams, embroidery, colors, patterns, and every accessory exactly unless explicitly targeted.
        2. For a bag: preserve its silhouette, dimensions, panel construction, pocket count and placement, zipper paths, handles, shoulder straps, buckles, hardware, piping, seams, logo, print, color, and material exactly unless explicitly targeted.
        3. Never convert a bag into a plush toy, add toy anatomy to a bag, or convert a doll into a bag.
        **CRITICAL SPATIAL RULES**:
        1. Modify only the regions or attributes requested by the user.
        2. Everything not explicitly targeted must remain identical to Image 1.
        3. Honor every FROZEN ZONES instruction as absolutely immutable.
        4. Preserve the original camera, layout, and background unless the selected operation explicitly requests a viewpoint or background change.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : options.workflowHint === 'listing-optimization'
                ? `
        **ROLE**: Senior Amazon A+ Content Visual Strategist & High-Conversion Layout Designer.
        **TASK**: Redesign the product listing image based on the structured optimization brief in the user prompt below.
        **CORE PRINCIPLES**:
        1. **PRODUCT FIDELITY (HIGHEST PRIORITY)**: The physical product in the image MUST remain PIXEL-IDENTICAL to Image 1. DO NOT alter the product's shape, color, design, pattern, or any visual detail. Only redesign the layout, background, typography, and supporting elements around the product.
        2. **LAYOUT PHILOSOPHY**: Apply a modern, premium, Apple-inspired grid layout with generous negative space. The product must be the clear visual anchor. Information hierarchy: Product → Headline → Sub-features.
        3. **TYPOGRAPHY**: ALL text MUST be in English. Use clean, modern sans-serif fonts (like Helvetica, Inter, or SF Pro). Text must NEVER overlap the product. Headlines should be bold and concise.
        4. **COLOR & LIGHTING**: Background must be bright, clean, and warm (cream white, soft apricot). Lighting should feel natural, soft, and inviting. NO dark, muddy, or cold backgrounds.
        5. **VISUAL ELEMENTS**: Replace any cheap cartoon icons with ultra-minimal line icons. All supporting graphics must feel premium and cohesive.
        6. **CONVERSION PSYCHOLOGY**: The layout must guide the viewer's eye from the product to the headline to the features, creating a clear purchase rationale.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : workflowHint === 'garment-extraction'
                ? `
        **ROLE**: Senior Fashion Image Masking and Garment Extraction Specialist.
        **TASK**: Perform exact in-place garment extraction from Image 1.
        **ABSOLUTE GOAL**:
        - Keep all clothing exactly where it is in the original image.
        - Preserve the original camera angle, pose-driven shape, perspective, folds, stretch, wrinkles, drape, fabric shadows, and occlusion contours.
        - Do NOT straighten, rotate, recenter, resize, redraw, complete, beautify, or redesign the clothing.
        - The output must look like the original image with every non-clothing pixel painted pure white.
        **KEEP ONLY**:
        - All visible clothing pixels exactly as they appear in Image 1: silhouette, neckline, cuffs, sleeves, hem, seams, buttons, zippers, labels, embroidery, prints, color, fabric texture, folds, drape, wrinkles, and construction details.
        - If multiple garments are worn together, keep their original relative positions, overlap, spacing, and original shapes.
        **REMOVE COMPLETELY**:
        - Every non-clothing element: human body, skin, face, head, hair, hands, arms, legs, feet.
        - Background, room, studio, floor, props, accessories, jewelry, bags, phones, hanger, mannequin, text, watermark, and logo overlays.
        - For areas hidden by body, hair, arms, hands, face, props, or background, do not hallucinate missing fabric; replace those removed/occluded areas with pure white.
        **OUTPUT**:
        - Same garment placement and angle as the original source image.
        - Pure white background (#FFFFFF), not transparent and not checkerboard.
        - No person, no body parts, no mannequin, no hanger, no extra objects.
        - Preserve pixel-level alignment as closely as possible; the garment mask must match the original clothing boundary with no visible offset.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : workflowHint === 'structural-repair-v2'
                ? `
        **ROLE**: Senior Product Repair Retoucher and Localized Reconstruction Specialist.
        **TASK**: Repair the product inside the target image while preserving everything else.
        **INPUT MAPPING**:
        - Image 1 = TARGET SCENE / image to repair.
        - Images 2+ = product standard references and, if present, a final red-mask edit map.
        **MANDATORY LOCAL EDIT RULES**:
        1. Do NOT return Image 1 unchanged.
        2. If a red-mask edit map is present, treat red painted regions as unwanted artifacts or wrong extra structures unless the user explicitly says otherwise.
        3. Remove hallucinated product parts, duplicate structures, wrong accessories, stray blobs, and any non-reference pieces inside the red area.
        4. After removing artifacts, restore the clean product silhouette, correct surface, and naturally revealed background/hand/clothing occlusion.
        5. The red mask is only an instruction map; remove all red paint, labels, and annotations from the final output.
        6. Preserve the target scene, person, hands, background, camera angle, crop, lighting, and all unmarked areas exactly.
        7. Match product structure, color, material, fur/fabric texture, edges, seams, eyes, accessories, and fine details from the standard references.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : workflowHint === 'clothing-effect'
                ? `
        **ROLE**: High-end Fashion Photography Retoucher.
        **TASK**: Enhance the appearance of clothing and its interaction with the model's body.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
              : workflowHint === 'strict-geometry-lock'
                ? `
        **ROLE**: Senior E-commerce Retoucher and Geometry-Lock Specialist.
        **TASK**: High-fidelity product retouching on a pure white background without ANY structural changes.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `

                  : workflowHint === 'doll-retouching'
                    ? `
        **ROLE**: Senior Ecommerce Product Retouching Specialist.
        **TASK**: High-Fidelity Product Retouching on PURE WHITE BACKGROUND.
        **PROTOCOL**:
        1. **BACKGROUND**: The background MUST be perfectly PURE WHITE (#FFFFFF). No exceptions.
        2. **SURFACE REMOVAL**: You MUST identify and REMOVE any table, floor, or surface the product is sitting on. The product should appear as if it is floating in a clean studio void.
        3. **GEOMETRY LOCK**: Maintain 100% of the product's structure, pose, and proportions from Image 1. HOWEVER, do NOT keep the environment/background from Image 1.
        4. **SHADOW**: Only a very soft, minimal ambient occlusion shadow under the product. No long or directional shadows.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                  : workflowHint === 'product-retouching'
                    ? `
        **ROLE**: Senior Ecommerce Product Retouching Specialist for plush toys, dolls, backpacks, handbags, tote bags, lunch bags, cosmetic bags, and related bag products.
        **TASK**: First identify the product category in Image 1, then perform high-fidelity product retouching on a pure white background.
        **CATEGORY-SPECIFIC RETOUCHING**:
        1. For a toy/doll: retain the original plush-toy workflow. Preserve its face, expression, proportions, pose, fur direction, plush material, seams, embroidery, colors, patterns, and accessories while cleaning lint, loose threads, dust, stains, creases, and uneven fur.
        2. For a bag: preserve its exact silhouette, proportions, gusset depth, panel construction, pocket layout, zipper paths, handles, straps, buckles, hardware, piping, stitching, logo, print, color, and source material. Clean dust, stains, loose threads, dents, accidental wrinkles, uneven edges, and lighting defects without inventing compartments or hardware.
        3. Never change the product category, redesign the product, replace its material, alter its print, or add/remove product parts.
        **OUTPUT PROTOCOL**:
        1. Use a perfectly pure white background (#FFFFFF), with no texture or gradient.
        2. Remove the original table, floor, or surrounding environment.
        3. Lock product structure, pose/orientation, camera angle, crop, and proportions to Image 1.
        4. Keep a natural still-life contact shadow plus a soft, physically plausible cast shadow around/beneath the product. The shadow must ground the product without creating a gray floor or gray background.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                  : workflowHint === 'scene-product-lock'
                    ? `
        **ROLE**: Commercial lifestyle fashion photographer.
        **TASK**: Follow the user's numbered reference map and create one photorealistic image.
        **REFERENCE PRIORITY**:
        1. Image 1 is the sole target-product identity authority and defines the exact garment.
        2. Any later product-upload images are low-priority outfit/styling context only. Their other garments, shoes and accessories are separate SKUs and must never override or merge into the Image 1 product.
        3. Selected-model images define the exact person identity only; pose, action and camera remain free.
        4. Scene image defines the exact recognizable environment plus the reference person's gaze direction, attention target, head angle, expression energy and candid body rhythm. Transfer those performance cues onto the selected model without copying identity or styling.
        5. Mood/style images affect only palette, light and photographic feel.
        Never mix image roles or copy people, clothing or accessories from scene/style references. Keep real anatomy, perspective, contact shadows and depth of field.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                  : workflowHint === 'photography-preset'
                    ? `
        **ROLE**: Senior Film Colorist, Camera-Look Developer & Fashion Photo Retoucher.
        **TASK**: Apply a clearly visible in-place camera and film preset transformation to Image 1.

        **INPUT ROUTING**:
        - Image 1 is the ONLY content source.
        - Preserve its exact person, identity, face, body, hair, garment design and color, product details and logos, pose, crop, perspective, architecture, background structure, object placement and composition.
        - The USER PROMPT is the authoritative target for exposure, relighting, white balance, color science, tonal curve, optical response and film grain.

        **MANDATORY VISIBLE TRANSFORMATION**:
        - Do NOT return Image 1 unchanged or nearly unchanged. A near-identical result is a failed edit.
        - Reprocess the entire frame. The before/after difference must be obvious at thumbnail size.
        - Visibly change white balance, highlight warmth, shadow hue/density, contrast curve, saturation hierarchy, blue/green rendering, highlight rolloff, micro-contrast, optical softness and organic grain according to the selected preset.
        - Content preservation does NOT preserve the source lighting, exposure, color grade, digital sharpness, contrast or noise pattern. These photographic properties MUST change.
        - Do not merely copy pixels, add a weak overlay or return the source with imperceptible adjustments.

        **CONTENT FIDELITY**:
        - Do not add, remove, move, redesign, restyle or replace any visible subject, garment, product, prop or scene element.
        - Camera/lens emulation changes optical rendering and tonal response without changing the locked composition.
        - The result must look like the exact same captured moment was visibly developed through the selected camera and film system.

        **FINAL SELF-CHECK**:
        Compare the output with Image 1. If its global light, color, tonal curve and grain are not clearly distinguishable, intensify the preset treatment before returning while keeping content fixed.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                  : workflowHint === 'lighting-replication'
                    ? `
        **ROLE**: Senior Fashion Lighting Retoucher & Commercial Colorist.
        **TASK**: Relight and regrade Image 1 using ONLY the lighting DNA from Image 2 and any later reference images.

        **STRICT IMAGE ROUTING**:
        - Image 1 = TARGET CONTENT SOURCE. It is the only source for all visible content.
        - Images 2+ = LIGHTING REFERENCES ONLY. They provide light direction, key/fill/rim balance, shadow geometry, skin and fabric exposure, color temperature, contrast, dynamic range, and final color grade.
        - Images 2+ are NOT sources for person identity, pose, garment, accessories, background, props, layout, camera angle, or scene.

        **MANDATORY VISIBLE RELIGHTING**:
        Do NOT return Image 1 unchanged. A near-identical result is a failed edit.
        The output must show obvious lighting and tonal changes compared with Image 1:
        - face and skin brightness must move toward Images 2+
        - garment highlight/shadow balance must move toward Images 2+
        - background/window/wall/floor illumination must move toward Images 2+
        - contrast, exposure, white balance, color temperature, and color grade must move toward Images 2+
        - cast shadows/contact shadows must reflect the reference light direction and softness
        If the reference has darker model lighting, stronger backlight, warmer sunlight, cooler window light, deeper shadows, or higher contrast, apply that same visible relationship to Image 1.
        Match by luminance zones, not by generic beautification: face brightness, skin exposure, hair shadow depth, garment highlight/shadow balance, window/background brightness, outdoor brightness, furniture brightness, and contact-shadow density must each move toward Images 2+.
        For window backlight references, keep windows/background bright, reduce excessive frontal fill on the person, and preserve soft edge/rim light, but keep the face, eyes, smile, hair, garment texture, and skin readable with gentle ambient fill. Do NOT create black silhouettes, crushed shadows, or bright flat ecommerce/beauty fill light.
        Transfer the scene lighting color and atmosphere too: walls, window frames, furniture, props, plants, floor, and outdoor background must share the reference's warm/cool cast, highlight softness, shadow density, and airy contrast.

        **ABSOLUTE CONTENT FREEZE FOR IMAGE 1**:
        Preserve Image 1's person, face, identity, hair, body shape, pose, clothing, garment design, print/pattern, accessories, background, furniture, props, architecture, composition, crop, lens perspective, camera angle, subject placement, and every object position.
        Do NOT change, replace, remove, add, redesign, restyle, move, rotate, zoom, recrop, or reinterpret any Image 1 element.

        **LIGHTING TRANSFER ONLY**:
        Apply the lighting behavior from Images 2+ to Image 1:
        - key light direction and height
        - fill light level and contrast ratio
        - rim/backlight if present
        - window light / sun beam / studio softbox quality
        - highlight placement on face, hair, skin, fabric, metal, glass, furniture, floor, and wall
        - shadow direction, softness, density, contact shadows, and cast-shadow shape
        - bounce light color, exposure rolloff, color temperature, white balance, contrast curve, dynamic range, and subtle post-production color grade
        Match the model brightness and light-to-shadow contrast of Images 2+ as strongly as physically plausible on Image 1.
        If Images 2+ show a low-fill backlit subject, lower Image 1's excessive frontal subject exposure only to the point where shadows remain detailed and the face/garment are still readable.

        **SUCCESS CRITERION**:
        The output must look like the exact Image 1 photograph was visibly re-lit and color-graded to match the lighting of Images 2+, while all Image 1 content remains unchanged.

        **FAILURE MODES TO AVOID**:
        unchanged source image, original image returned, no visible relighting, same face brightness, same garment brightness, same contrast, same shadows, bright flat beauty lighting, ecommerce studio fill, excessive frontal fill light, over-bright face, over-bright subject, evenly lit subject, dead black shadows, black silhouette, crushed shadow detail, unreadable face, unreadable garment texture, scene tone not matched, copied reference model, copied reference outfit, copied reference background, changed face, changed pose, changed clothing, changed scene, changed furniture, changed crop, changed camera angle, new props, missing props, content replacement, style transfer that alters content.

        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                  : workflowHint === 'magic-mannequin'
                    ? `
        **ROLE**: Professional 3D Mannequin & Sculptural Artist.
        **MISSION**: Convert the person in Image 1 into a **BLANK, FACELESS, AND CLOTH-FREE** 3D mannequin.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                  : options.workflowHint === 'model-modification'
                    ? `
        **ROLE**: World-Class E-commerce Fashion Photographer & AI Visual Editor.
        **MISSION**: Generate a highly photorealistic e-commerce model image based on the provided reference images.
        **IMAGE MAPPING**:
        - Image 1: The model original/source image (defines the model's face, hair, body dimensions, skin tone, and composition/framing).
        - Image 2: The product asset/target clothing image (if provided, this is the clothing that must replace the model's original clothing in Image 1).
        - Image 3+: Additional styling or color references.
        
        **CRITICAL INSTRUCTIONS**:
        1. **MODEL IDENTITY (MANDATORY)**: You MUST preserve the model's facial structure, hair color/style, eye details, skin color, and physical body proportions (height, build) from Image 1.
        2. **COMPOSITION & CROP**: You MUST strictly preserve the same lens cropping, framing (close-up, medium shot, or full-body), and zoom distance as Image 1. Never pull the camera back if Image 1 is a close-up.
        3. **CLOTHING REPLACEMENT**: If Image 2 is provided as a product asset, replace the clothing on the model in Image 1 with the exact clothing shown in Image 2, capturing every stitch, color, and texture detail.
        4. **SCENE & BACKGROUND**: Keep a clean, professional e-commerce studio background (or pure white as requested).
        
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                  : options.workflowHint === 'model-retouching'
                    ? `
        **ROLE**: Professional E-commerce Fashion Photography Retoucher.
        **MISSION**: Perform high-end commercial retouching on the model image in Image 1.
        **CRITICAL RULES**:
        1. **STRICT GEOMETRY & ANGLE LOCK**: Keep the exact camera angle, model pose, framing, zoom distance, and lens composition identical to Image 1. Absolutely NO camera movement, rotation, or posture shifts.
        2. **CLOTHING REPLACEMENT**: If Image 2 is provided, replace the model's original clothing with the exact clothing in Image 2, preserving the model's exact pose and pose-clothing interaction.
        3. **QUALITY ENHANCEMENT**: Clean skin blemishes, soften wrinkles, optimize lighting, and sharpen fabric texture for professional e-commerce use.
        
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
                    : `
        **ROLE**: Professional Image Generation Artist.
        **TASK**: Image-to-Image Generation (Scene Fusion).
        **INSTRUCTION**: Based on the provided reference image(s), generate a new image following the user's description.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `
          : `
        **ROLE**: Professional Image Generation Artist.
        **TASK**: Text-to-Image Generation.
        **INSTRUCTION**: Generate a new high-quality image based on the user's description.
        **USER PROMPT**: ${forcedPrompt}
        ${negativePromptLine}
        `);

        // 1. Add System Prompt FIRST (Critical for many models/proxies to see instructions before data)
        parts.push({ text: systemPrompt });

        // 2. Add All Input Images
        processedImages.forEach((img: any) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || img.mime || 'image/jpeg', // 增加容错：兼容 mime 字段并提供默认值
              data: img.base64,
            },
          });
        });
      }


      // 柏拉图模型映射逻辑 (nanobanana2)
      // 注释掉强制追加 -4k/-2k 的逻辑，因为报错显示柏拉图的 v1/v1beta 路径不识别带后缀的模型名。
      // 应依靠 imageSize: "4K" 或 "2K" 参数让模型识别分辨率。
      /*
      if (config.isPlato && targetModel === "gemini-3.1-flash-image-preview") {
          if (options.resolution === ImageResolution.RES_05K) targetModel = "gemini-3.1-flash-image-preview-512px";
          else if (options.resolution === ImageResolution.RES_2K) targetModel = "gemini-3.1-flash-image-preview-2k";
          else if (options.resolution === ImageResolution.RES_4K) targetModel = "gemini-3.1-flash-image-preview-4k";
          console.log(`[Plato Model Mapping] Mapped ${options.resolution} to ${targetModel}`);
      }
      */

      // Calculate dynamic timeout: 4K/2K generation is slow, 300s. Others 180s.
      const generationTimeout = (options.resolution === ImageResolution.RES_4K || options.resolution === ImageResolution.RES_2K) ? 300000 : 180000;

      // Map resolution to explicit dimensions for proxy compatibility
      const getDimensions = (ar: string, res: string) => {
        const dimensionsByResolution: Record<string, Record<string, string>> = {
          '4K': {
            '1:1': '4096x4096',
            '2:3': '2731x4096',
            '3:4': '3072x4096',
            '4:5': '3277x4096',
            '9:16': '2304x4096',
            '16:9': '4096x2304',
            '3:2': '4096x2731',
            '4:3': '4096x3072',
            '21:9': '4096x1755',
          },
          '2K': {
            '1:1': '2048x2048',
            '2:3': '1365x2048',
            '3:4': '1536x2048',
            '4:5': '1638x2048',
            '9:16': '1152x2048',
            '16:9': '2048x1152',
            '3:2': '2048x1365',
            '4:3': '2048x1536',
            '21:9': '2048x878',
          },
          '1K': {
            '1:1': '1024x1024',
            '2:3': '682x1024',
            '3:4': '768x1024',
            '4:5': '819x1024',
            '9:16': '576x1024',
            '16:9': '1024x576',
            '3:2': '1024x682',
            '4:3': '1024x768',
            '21:9': '1024x439',
          },
        };

        return dimensionsByResolution[res]?.[ar] || dimensionsByResolution['1K'][ar] || '1024x1024';
      };
      const explicitDimensions = getDimensions(aspectRatio, resolution);

      console.warn(`[AI GENERATION ATTEMPT]
        Model: ${targetModel}
        Aspect Ratio: ${aspectRatio}
        Resolution: ${resolution} (${explicitDimensions})
        Prompt Snippet: ${forcedPrompt.substring(0, 100)}...
      `);

      const sendGeminiRequest = async (modelName: string) => {
        const runtimeModel = config.isXiaoche
          ? resolveXiaocheImageModel(modelName, aspectRatio, resolution)
          : resolveRuntimeModelId(modelName, config);
        return await executeWithTimeout(
          ai.models.generateContent({
            model: runtimeModel,
            contents: { parts: parts },
            // EXTREME REDUNDANCY: Inject aspect ratio into every possible field name and location
            // Some proxies look for standard Gemini structure, others for OpenAI/Midjourney style fields
            config: {
              safetySettings: GLOBAL_SAFETY_SETTINGS,
              responseModalities: [Modality.IMAGE],
              ...(workflowHint === 'pose-replication-lock'
                ? { temperature: 0.25 }
                : workflowHint === 'photography-preset'
                  ? { temperature: 0.3 }
                : workflowHint === 'model-original-paste-back'
                  ? { temperature: 0.15 }
                  : workflowHint === 'single-item-try-on'
                    ? { temperature: 0.1 }
                  : workflowHint === 'ecommerce-hero'
                    ? { temperature: 0.15 }
                  : workflowHint === 'model-transfer'
                    ? { temperature: 0.05 }
                    : {}),
              imageConfig: {
                aspectRatio: aspectRatio,
                aspect_ratio: aspectRatio,
                // Standard Gemini expects "1K", "2K", "4K"
                imageSize: resolution, 
                size: explicitDimensions, // DALL-E 3 standard
                image_size: explicitDimensions, // Proxy fallback
                resolution: resolution, // Extra fallback
                quality: (resolution === '4K' || resolution === '2K') ? "hd" : "standard", // GPT/DALL-E style
                sampleCount: sampleCount,
              } as any,
            } as any,
            // Fallback for proxies that map Gemini 'generationConfig' to target model parameters
            generationConfig: {
              ...(config.isYunwu || config.isPlato ? {} : { aspectRatio: aspectRatio, aspect_ratio: aspectRatio }),
              image_size: explicitDimensions,
              resolution: resolution,
              quality: (resolution === '4K' || resolution === '2K') ? "hd" : "standard",
            } as any
          } as any),
          { timeoutMs: generationTimeout, signal }
        );
      };

      let response;
      try {
        response = await sendGeminiRequest(targetModel);
      } catch (geminiError: any) {
        const errorMsg = (geminiError?.message || geminiError?.toString() || '').toLowerCase();
        const fallbackModel = MODEL_FALLBACKS[targetModel];
        if (fallbackModel && (
          errorMsg.includes('model_not_found') || 
          errorMsg.includes('model not found') || 
          errorMsg.includes('404') || 
          errorMsg.includes('not supported') ||
          errorMsg.includes('invalid model') ||
          errorMsg.includes('path not found')
        )) {
          console.warn(`[Gemini Fallback] Model ${targetModel} failed. Retrying with fallback ${fallbackModel}...`);
          targetModel = fallbackModel;
          response = await sendGeminiRequest(targetModel);
        } else {
          throw geminiError;
        }
      }

      const generatedImages = extractGeneratedImages(response);
      const candidate = response.candidates?.[0];

      if (generatedImages.length === 0) {
        const finishReason = candidate?.finishReason;
        const safetyRatings = candidate?.safetyRatings;
        const blockReason = (response as any).promptFeedback?.blockReason;
        
        console.warn("[AI GENERATION EMPTY]", { finishReason, safetyRatings, blockReason });
        
        if (finishReason === 'SAFETY' || blockReason) {
           const safetyError = new Error(`Generation blocked by safety filter: ${finishReason || blockReason}. The model detected sensitive visual content. Try a more conservative target image, a clearer face crop, or another image model.`);
           (safetyError as any).preventRetry = true;
           throw safetyError;
        }
        throw createEmptyImageResponseError(response, targetModel);
      }

      return generatedImages;

    } catch (error: any) {
      lastError = error;
      console.warn(`[API Retry] Attempt ${attempt + 1} failed with key ${config.currentIndex + 1}. Error:`, error.message);

      if (error?.preventRetry) {
        throw error;
      }
      
      // Handle specific status codes or error messages
      const isPathError = error.message?.includes('invalid_request') || error.message?.includes('404') || error.message?.includes('API 路径');
      const isServiceError = error.status === 503 || error.message?.includes('503');
      
      if (isPathError || isServiceError) {
        if (config.isJijing && isServiceError && attempt < maxRetries - 1) {
          console.warn(`[No.1 Image Node Retry] ${targetModel} unavailable on ${config.baseUrl}. Trying next node...`);
          continue;
        }
        const platoHint = config.isJijing
          ? `\n[No.1图提示] 模型 ${targetModel} 在当前节点或路径下暂不可用，已尝试自动切换节点。请稍后重试，或在设置中手动切换到香港/美国节点。`
          : config.isPlato ? `\n[柏拉图提示] 模型 ${targetModel} 在当前节点或路径下暂不可用，请联系管理员或切换节点(如美国/香港)。` : '';
        const customError = new Error(`${error.message}${platoHint}`);
        (customError as any).status = error.status;
        (customError as any).isPathError = isPathError;
        lastError = customError;
        console.error(`[API Critical] ${error.message}${config.isJijing ? ' (No.1 Image)' : config.isPlato ? ' (Plato)' : ''}. Stopping retries.`);
        break; // 不再切换 Key 重试，因为模型名/路径错误换 Key 也没用
      }
      
      // If it's a rate limit or auth error, try next key immediately
      if (error.status === 429 || error.status === 401 || error.message?.includes('429') || error.message?.includes('401')) {
        continue; 
      }
      
      // For other errors, if we have more keys, try one more
      if (attempt < maxRetries - 1) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Image-to-Image generation failed after multiple attempts.");
};

/**
 * 2.1.2 Inpainting Generation (局部替换)
 * 发送原图 + 蒙版 + 提示词，仅在蒙版白色区域重新生成内容。
 */
export const generateInpainting = async (
  sourceImage: { base64: string; mimeType: string },
  maskImage: { base64: string; mimeType: string },
  prompt: string,
  options: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    modelId?: string;
    refImages?: { base64: string; mimeType: string }[];
    editMapImage?: { base64: string; mimeType: string };
    fabricRefImages?: { base64: string; mimeType: string }[];
    colorRefImages?: { base64: string; mimeType: string }[];
    structureRefImages?: { base64: string; mimeType: string }[];
    cropPaste?: {
      padding: number;
      blend: number;
      expand: number;
    };
    signal?: AbortSignal;
  } = {}
) => {
  const { signal } = options;
  throwIfAborted(signal);
  const virseEnabled = isVirseImageRoutingEnabled();
  if (virseEnabled) {
    const references = [
      sourceImage,
      maskImage,
      ...(options.refImages || []),
      ...(options.fabricRefImages || []),
      ...(options.colorRefImages || []),
      ...(options.structureRefImages || []),
      ...(options.editMapImage ? [options.editMapImage] : []),
    ];
    return generateImageToImage(references, `局部重绘任务：${prompt}`, {
      aspectRatio: options.aspectRatio || AspectRatio.SQUARE,
      resolution: options.resolution || ImageResolution.RES_2K,
      modelId: options.modelId,
      signal,
      workflowHint: 'inpainting',
    });
  }
  const retryLimit = 3;
  let lastError: any = null;

  const initialConfig = getImageApiConfig();
  const maxRetries = Math.min(initialConfig.keyCount, 3);

  let targetModel = options.modelId || "gemini-3.1-flash-image-preview";
  
  const aspectRatio = options.aspectRatio || AspectRatio.SQUARE;
  const getAspectRatioHint = (ar: string) => {
    if (ar === '16:9') return 'WIDE SCREEN, 1792x1024 resolution, cinematic landscape orientation';
    if (ar === '9:16') return 'TALL PHONE SCREEN, 1024x1792 resolution, vertical portrait orientation';
    if (ar === '3:2') return '3:2 landscape, 1536x1024';
    if (ar === '2:3') return '2:3 portrait, 1024x1536';
    if (ar === '4:3') return '4:3 standard landscape, 1280x960';
    if (ar === '3:4') return '3:4 portrait, 960x1280';
    if (ar === '21:9') return 'ULTRA-WIDE cinematic, 1792x768, panorama';
    return '';
  };
  const arHint = getAspectRatioHint(aspectRatio);
  const resolution = options.resolution || "2K";
  const resolutionHint = resolution === '4K' ? '8K UHD, ultra-high resolution, extremely detailed, masterwork' : resolution === '2K' ? '4K resolution, high definition, sharp focus' : '';
  const forcedPrompt = (aspectRatio && aspectRatio !== '1:1') || resolutionHint 
    ? `[OUTPUT: ${aspectRatio}, ${resolution} QUALITY] (${arHint}) ${resolutionHint}, ${prompt} ${aspectRatio !== '1:1' ? `--ar ${aspectRatio}` : ''}` 
    : prompt;

  const isGptImage2 = targetModel === 'gpt-image-2' || targetModel === 'gpt-image-2-vip';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const config = getImageApiConfig(initialConfig.currentIndex + attempt);
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: config.isYunwu ? { 
        baseUrl: config.baseUrl,
        headers: { Authorization: `Bearer ${config.apiKey}` }
      } : undefined,
      apiVersion: config.apiVersion as any
    });

    try {
      // SPECIAL HANDLING FOR gpt-image-2 (OpenAI-compatible Proxy Endpoint)
      if (isGptImage2) {
        const gptSize = getGptImage2Size(aspectRatio as AspectRatio, resolution as ImageResolution);
        console.warn(`[GPT Image 2 Inpaint] Size: ${gptSize}, Prompt: ${forcedPrompt.substring(0, 50)}...`);
        
        const payload = {
          model: resolveRuntimeModelId(targetModel),
          prompt: forcedPrompt,
          size: gptSize,
          response_format: "b64_json",
          // For edits, standard is image + mask. Proxy might accept them as specific fields or in the array.
          // Based on user "compatible with edits interface", we use standard field names.
          image: sourceImage.base64,
          mask: maskImage.base64,
          // If the proxy expects an array (from user example), we might need to adapt.
          // But "image" parameter being an array of strings in the example suggests a multi-reference generation.
          // For true inpainting/edits, we'll try the standard image/mask fields first.
        };

        const endpoint = `${config.baseUrl}/v1/images/edits`; 
        
        const fetchResponse = await executeWithTimeout(
          fetch(endpoint, {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(payload)
          }),
          { timeoutMs: 120000, signal }
        );

        if (!fetchResponse.ok) {
          const errText = await fetchResponse.text();
          throw new Error(`GPT Image 2 Inpaint Error: ${fetchResponse.status} ${errText}`);
        }

        const data = await fetchResponse.json();
        const results = (data.data || []).map((item: any) => 
          item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url
        );
        
        if (results.length > 0) return results;
        throw new Error("API returned success but no images were found.");
      }

      const parts: any[] = [];

      // 1. 原图
      parts.push({
        inlineData: {
          mimeType: sourceImage.mimeType,
          data: sourceImage.base64,
        },
      });

      // 2. 蒙版图（白色=编辑区域, 黑色=保留区域）
      parts.push({
        inlineData: {
          mimeType: maskImage.mimeType,
          data: maskImage.base64,
        },
      });

      if (options.editMapImage) {
        parts.push({
          inlineData: {
            mimeType: options.editMapImage.mimeType,
            data: options.editMapImage.base64,
          },
        });
      }

      // 2.5 参考图（可选）
      if (options.refImages && options.refImages.length > 0) {
        options.refImages.forEach((img) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        });
      }

      // 2.6 面料参考图（可选）
      if (options.fabricRefImages && options.fabricRefImages.length > 0) {
        options.fabricRefImages.forEach((img) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        });
      }

      // 2.7 颜色参考图（可选）
      if (options.colorRefImages && options.colorRefImages.length > 0) {
        options.colorRefImages.forEach((img) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        });
      }

      // 2.8 Structure reference images for crop-and-paste-back replacement.
      if (options.structureRefImages && options.structureRefImages.length > 0) {
        options.structureRefImages.forEach((img) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        });
      }

      // 3. 构造局部替换提示词
      const hasRefImages = options.refImages && options.refImages.length > 0;
      const hasEditMapImage = !!options.editMapImage;
      const hasFabricRefImages = options.fabricRefImages && options.fabricRefImages.length > 0;
      const hasColorRefImages = options.colorRefImages && options.colorRefImages.length > 0;
      const hasStructureRefImages = options.structureRefImages && options.structureRefImages.length > 0;

      const refImageInstruction = hasRefImages
        ? `\n      5. Product/reference images are provided after the source and mask. Use them as VISUAL GUIDES for the replacement content inside the WHITE mask only. Do not let them change any black-mask preserved area.`
        : '';

      const editMapInstruction = hasEditMapImage
        ? `\n      PAINT MAP LOCK: An additional image is provided immediately after the black/white mask: it is the source photo with the user's real red brush strokes overlaid. Use the red painted overlay as the human-readable edit map, matching the user's painted location, stroke shape, and intended local area. The red paint is NOT part of the final image and must be completely removed. The black/white mask remains the hard inpainting boundary; the red brush map clarifies exactly what the user selected.`
        : '';

      const fabricRefInstruction = hasFabricRefImages
        ? `\n      6. Fabric reference images are provided. These are STRICT guides for fabric texture/material finish (weave, knit, leather grain, gloss/matte). When generating clothing/fabric in the WHITE mask area, match these fabric textures as closely as possible. Avoid random patterns not present in the references.`
        : '';

      const colorRefInstruction = hasColorRefImages
        ? `\n      7. Color reference images are provided. These are STRICT guides for the target garment color palette (hue/saturation/value). When generating clothing in the WHITE mask area, keep the garment color consistent with these references and avoid unwanted color shifts.`
        : '';

      const cropPasteInstruction = hasStructureRefImages
        ? `\n      8. STRUCTURE-REFERENCE EDGE SURGERY LOCK:
      - Structure reference images are exact blueprints for the garment edge geometry inside the WHITE mask only.
      - This is not a full outfit redesign. Do NOT replace the unmasked clothing body, torso fabric, background, pose, face, skin, hair, jewelry, or lighting.
      - For neckline / collar / sleeve-cuff / hem edits, copy only the local boundary logic from the structure reference: edge thickness, trim/binding width, seam position, stitching direction, curve shape, endpoint alignment, fold direction, and fabric tension.
      - Keep the original garment area outside the WHITE mask pixel-identical. The edited edge must reconnect naturally to the original untouched fabric at both ends, with no offset, floating trim, duplicated collar, doubled sleeve, broken shoulder seam, warped neckline, or new garment panel.
      - If the WHITE mask is a narrow boundary strip, generate only that narrow boundary strip. Do not expand the edit into the whole shirt/top/dress unless the mask explicitly covers that area.
      - Treat padding=${options.cropPaste?.padding ?? 5}, blend=${options.cropPaste?.blend ?? 1}, expand=${options.cropPaste?.expand ?? 0.3} as crop-paste controls: include complete edge context, softly blend only the edit boundary, and preserve the original outside pixels.`
        : '';

      const systemPrompt = `
      **ROLE**: Professional Image Inpainting Specialist.
      **TASK**: Partial Image Replacement (Inpainting).
      **INPUT**: Image 1 is the [Source Image]. Image 2 is the [Mask] (white areas = regions to regenerate, black areas = regions to preserve EXACTLY).

      **CRITICAL INSTRUCTIONS**:
      1. You MUST ONLY modify the areas marked as WHITE in the mask image.
      2. The BLACK areas in the mask MUST remain PIXEL-PERFECT IDENTICAL to the source image. No changes whatsoever.
      3. The newly generated content in the white areas must seamlessly blend with the surrounding preserved areas in terms of lighting, perspective, color temperature, and style.
      4. Generate the new content according to the user's description below.${editMapInstruction}${refImageInstruction}${fabricRefInstruction}${colorRefInstruction}${cropPasteInstruction}
      5. Boundary accuracy is more important than creative interpretation. When the request mentions "edge", "neckline", "collar", "sleeve cuff", "hem", "领口", "袖口", "边", "包边", or "裁切贴回", behave like a precise retoucher: edit only the marked edge strip and leave the rest visually unchanged.

      **USER DESCRIPTION**: ${forcedPrompt}

      **QUALITY GUIDELINES**:
      - Seamless edge blending between generated and preserved regions.
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - Match the original image's artistic style, lighting direction, and color palette.
      - Ensure photorealistic textures in the regenerated area.
      `;

      parts.push({ text: systemPrompt });

      const generationTimeout = (options.resolution === ImageResolution.RES_4K || options.resolution === ImageResolution.RES_2K) ? 180000 : 120000;

      const response = await executeWithTimeout(
        ai.models.generateContent({
          model: config.isXiaoche
            ? resolveXiaocheImageModel(targetModel, options.aspectRatio || '1:1', String(options.resolution || '1K'))
            : resolveRuntimeModelId(targetModel, config),
          contents: { parts: parts },
          config: {
            imageConfig: {
              aspectRatio: options.aspectRatio || "1:1",
              aspect_ratio: options.aspectRatio || "1:1",
              imageSize: (options.resolution === ImageResolution.RES_05K ? 512 : (options.resolution || "1K")) as any,
            } as any,
          },
        }),
        { timeoutMs: generationTimeout, signal }
      );

      const generatedImages: string[] = [];
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            generatedImages.push(
              `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
            );
          }
        }
      }
      return generatedImages;

    } catch (error: any) {
      lastError = error;
      console.warn(`[Inpainting Retry] Attempt ${attempt + 1} failed. Error:`, error.message);

      const isPathError = error.message?.includes('invalid_request') || error.message?.includes('404');
      const isServiceError = error.status === 503 || error.message?.includes('503');

      if (isPathError || isServiceError) {
        break;
      }

      if (error.status === 429 || error.status === 401) {
        continue;
      }

      if (attempt < maxRetries - 1) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Inpainting generation failed after multiple attempts.");
};

/**
 * 4. Optimize Prompt using Expert Persona
 * Skill: # Role_ 用户 (1).md
 */
/**
 * 4. Optimize Prompt using Prompt Optimization Agent (Nano Banana Edition)
 * Skill: Imagen 3.0 (Nano Banana) Skills - Golden Formula & Quality Boosters
 */
export const optimizePrompt = async (rawPrompt: string, refImages?: { base64: string; mimeType: string }[], refineInstruction?: string): Promise<string> => {
  const ai = getAiClient();
  if (!rawPrompt && (!refImages || refImages.length === 0)) return "";

  // Precision Description Expert - System Prompt (V2.1.0)
  const skillSystemPrompt = `
# Role: User Prompt Precision Description Expert (Based on Imagen 3.0 Nano Banana Skills)

## Profile
- Author: AntiGravity
- Version: 2.1.0
- Language: Auto-detect (Output in the same language as user input: Chinese or English)
- Description: Specialized in transforming vague, generic user prompts into precise, specific, and targeted image generation prompts.

## 🧠 COGNITIVE PROTOCOL (Internal Thought Process)
1. **ANALYZE**: Identify abstract concepts (e.g., "nice photo", "cool car") and missing elements in the user's input.
2. **EXPAND**: Use the "Golden Formula" to structure the prompt:
   - **[Subject]** + **[Action]** + **[Environment]** + **[Style]** + **[Lighting]** + **[Camera]** + **[Quality]**
3. **REFINE**: Replace generic terms with professional terminology from the Knowledge Base.

## 📚 INTERNAL KNOWLEDGE BASE (Reference Standards)

### 1. 💡 Lighting & Atmosphere
- **Natural**: Golden hour (warm/soft), Blue hour (cool/moody), Overcast (soft/diffused), Dappled sunlight (playful shadows).
- **Artificial**: Studio lighting (clean/professional), Neon lights (cyberpunk/vibrant), Volumetric lighting (god rays/atmospheric), Cinematic lighting (dramatic contrast).

### 2. 📷 Camera & Composition
- **Angles**: Eye-level (neutral), Low angle (heroic/imposing), High angle (vulnerable/overview), Dutch angle (dynamic/unsettling), Top-down (flat lay).
- **Lenses**: Wide angle (14-24mm, vastness), Standard (35-50mm, natural), Portrait (85mm, flattering), Macro (100mm, details).
- **Framing**: Rule of thirds, Symmetrical center, Leading lines, Depth of field (bokeh).

### 3. 🎨 Art & Photography Styles
- **Photography**: Editorial, Commercial Product, Street Photography, Architectural, Analog Film (Kodak Portra 400), Long Exposure.
- **Art/Illustration**: Digital Illustration, Oil Painting, Watercolor, Anime/Manga, Cyberpunk, Steampunk, Minimalist, 3D Render (Octane).

### 4. 💎 Quality Boosters (Append these for high fidelity)
- "8K resolution, highly detailed, sharp focus, professional photography, masterpiece, photorealistic, intricate textures, award-winning."

## 🎯 EXECUTION RULES
1. **Precision**: Convert "pretty" -> "ethereal beauty, soft lighting"; "big building" -> "towering skyscraper, brutalist architecture".
2. **Subject First**: Ensure the main subject is described immediately at the start.
3. **No Fluff**: Do not output conversational text. **OUTPUT ONLY THE OPTIMIZED PROMPT**.
4. **Length**: Target 75-150 words of dense, descriptive content.

## 🌟 OUTPUT FORMAT
Return **ONLY** the optimized prompt text.
NO "Here is the prompt:" prefixes.
NO markdown code blocks.
Just the raw text.
`;

  try {
    const parts: any[] = [{ text: skillSystemPrompt }];

    // Add Reference Images if provided (Style Analysis)
    if (refImages && refImages.length > 0) {
      refImages.forEach(img => {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        });
      });
      parts.push({ text: `[VISUAL CONTEXT]: The user has provided ${refImages.length} reference images. \n**CRITICAL**: Analyze their Art Style, Lighting, and Composition. \nYour optimized prompt MUST adopt these visual characteristics while keeping the user's text subject.` });
    }

    // Construct User Input
    let userMessage = `[USER INPUT]: "${rawPrompt}"`;
    if (refineInstruction) {
      userMessage += `\n\n[REFINEMENT INSTRUCTION]: The user wants to adjust the previous prompt. \nInstruction: "${refineInstruction}" \n\nPlease rewrite the prompt to incorporate this change while maintaining high quality.`;
    }

    parts.push({ text: userMessage });

    // Use gemini-3.1-flash-lite-preview for fast reasoning & text generation
    const modelName = resolveRuntimeModelId(DEFAULT_TEXT_MODEL);
    const response = await generateContentWithAnalysisFallback(ai, {
      model: modelName,
      contents: {
        parts: parts
      },
      config: {
        safetySettings: GLOBAL_SAFETY_SETTINGS
      }
    });

    const optimizedText = response.text?.trim();
    // Clean up any potential markdown if the model disobeys
    const cleanText = optimizedText?.replace(/^```(markdown|text)?\n/, '').replace(/\n```$/, '') || rawPrompt;

    return cleanText;
  } catch (e) {
    console.error("Prompt optimization failed", e);
    return rawPrompt; // Fallback to original
  }
};

/**
 * Specialized Image-to-Image Prompt Optimization (Add/Remove/Replace/Enhance)
 * Based on "图生图专业优化.md"
 */
export const optimizeImageToImagePrompt = async (rawPrompt: string): Promise<string> => {
  const ai = getAiClient();
  if (!rawPrompt) return "";

  const systemPrompt = `
# Role: Image-to-Image Prompt Optimization Expert (Based on Professional Guidelines)

## Profile
- Author: prompt-optimizer (Integrated)
- Version: 1.0.0
- Language: Auto-detect (Output in same language as input)
- Description: Specialized in transforming user modification requests into precise Image-to-Image (Inpainting/Editing) prompts.

## 🧠 CORE INTENT RECOGNITION (Critical)
You must analyze the user's request to identify their core intent:
1. **ADD**: User wants to insert a new element that doesn't exist. -> Output: "Add [Object] at [Location]..."
2. **REMOVE**: User wants to delete/remove an element. -> Output: "Remove [Object], naturally fill background..."
3. **REPLACE**: User wants to swap an element. -> Output: "Replace [Object] with [New Object]..."
4. **ENHANCE**: User wants to improve an existing feature. -> Output: "Enhance [Feature] to be [Adjective]..."

## 🎯 GENERATION RULES
1. **Targeting**: The user's prompt is their DESIRED RESULT, not a description of the current image.
2. **Format**: Output a clear, direct command in natural language.
3. **Style Consistency**: ALWAYS imply that the new element must match the original image's lighting, perspective, and style.
4. **No Fluff**: Output **ONLY** the optimized prompt text. No "Intent:", no explanation.

## 📝 TEMPLATE EXAMPLES
- **Add**: "Add a vintage vase on the wooden table, casting realistic shadows, ensuring consistent lighting."
- **Remove**: "Remove the pedestrians from the background, naturally inpainting the street texture to match surroundings."
- **Replace**: "Replace the red sports car with a blue sedan, maintaining the original angle and reflection."
- **Enhance**: "Enhance the sunset glow, making colors more vibrant and dramatic while keeping the silhouette details."
`;

  try {
    const modelName = resolveRuntimeModelId(DEFAULT_TEXT_MODEL); // Use Flash for speed
    const response = await generateContentWithAnalysisFallback(ai, {
      model: modelName,
      contents: {
        parts: [
          { text: systemPrompt },
          { text: `[USER REQUEST]: "${rawPrompt}" \n\n[OPTIMIZED IMG2IMG PROMPT]:` }
        ]
      }
    });

    const optimizedText = response.text?.trim();
    // Clean up
    const cleanText = optimizedText?.replace(/^```(markdown|text)?\n/, '').replace(/\n```$/, '') || rawPrompt;
    return cleanText;

  } catch (e) {
    console.error("Img2Img optimization failed", e);
    return rawPrompt;
  }
};

/**
 * 2.2 Generate Seat Cover Fit (Automotive)
 * Uses gemini-3-pro-image-preview
 */
export const generateSeatCoverFit = async (
  seatCoverImages: { base64: string; mime: string }[],
  productCategory: string,
  carModel: string,
  year: string,
  seatConfig: string,
  targetRow: string,
  angleMode: "PRESET" | "REFERENCE",
  angleValue: string | { base64: string; mime: string }[],
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  customRequest?: string, // NEW: User Custom Request
  visualGuide?: { base64: string; mime: string }, // NEW: Optional Visual Guide
  modelId: string = 'gemini-3.1-flash-image-preview',
  signal?: AbortSignal
) => {
  throwIfAborted(signal);
  const { ai, model: imageModel } = getImageGenerationContext(modelId, aspectRatio, resolution);
  try {
    const parts: any[] = [];

    // 1. Add Seat Cover Images
    seatCoverImages.forEach((img) => {
      parts.push({
        inlineData: { mimeType: img.mime, data: img.base64 }
      });
    });

    // 1.5 Add Visual Guide (if present)
    if (visualGuide) {
      parts.push({
        inlineData: { mimeType: visualGuide.mime, data: visualGuide.base64 }
      });
    }

    // 2. Map Definitions & Logic
    // 2. Map Definitions & Logic (Refined for Physics-Based Precision)
    const viewMap: Record<string, string> = {
      // === 1. Single Seat (单品座椅) ===
      "S1 Front View": "Camera Height: 0.9m. Angle: 0° dead center. Distance: 1.5m. Shot on 50mm standard lens, f/4. Composition: Perfectly symmetrical front view, centered composition. Spatial Anchors: headrest centered at top, seat cushion centered at bottom, armrests symmetric left-right. White studio background.",
      "S2 3/4 Front Angle": "Camera Height: 1.0m. Angle: 30-45° from front-left. Shot on 50mm lens, f/4. Composition: Three-quarter product shot. Spatial Anchors: left bolster prominent in foreground, right side receding. Seat front face and side thickness both visible.",
      "S3 Rear 3/4 View": "Camera Height: 1.0m. Angle: 135° from rear-left. Shot on 50mm lens, f/4. Composition: Rear three-quarter view. Spatial Anchors: seatback rear surface dominant, side airbag slot visible on near side.",

      // === 2. Full Set (整套座椅) ===
      "SET1 Side View Left": "Camera Height: 1.1m eye level. Angle: 90° pure left profile. Shot on 85mm portrait lens, f/2.8. Composition: Full 5-seat set, flat side view. Spatial Anchors: all seats in a horizontal row, front seats left, rear bench right.",
      "SET2 Side View Right": "Camera Height: 1.1m eye level. Angle: 90° pure right profile. Shot on 85mm portrait lens, f/2.8. Composition: Full 5-seat set, flat side view. Spatial Anchors: mirror of SET1.",

      // === 3. Front Interior (车内前排) ===
      "F1 High-Angle Top-Down": "Camera Position: Sunroof/ceiling, looking straight down into cabin. Angle: 60° steep downward. Shot on 24mm wide-angle lens, f/8, deep focus. Composition: Bird's eye view, symmetrical layout. Spatial Anchors: steering wheel at top-center, center console running vertically through middle, driver seat on left half, passenger seat on right half. Dashboard at very top edge.",
      "F2 Driver Side Profile": "Camera Position: Outside open driver door. Height: 1.1m. Angle: 10° slight inward, near-profile. Shot on 35mm lens, f/5.6. Composition: Side view across driver seat. Spatial Anchors: driver seat fills left 60% of frame, passenger seat visible in background right, steering wheel at upper-left, door frame on far left edge.",
      "F3 Passenger Front-Quarter": "Camera Position: Outside passenger door. Height: 1.0m. Angle: 45° into cabin. Shot on 35mm lens, f/5.6. Composition: Both front seats visible at 3/4 angle. Spatial Anchors: passenger seat in right foreground, driver seat in left background, center console between them, dashboard across the top.",
      "F4 Rear-to-Front View": "Camera Position: Rear seat center. Height: 1.2m. Angle: 0° facing forward. Shot on 28mm wide lens, f/8. Composition: Looking forward from back seat. Spatial Anchors: two front seatbacks filling left and right halves, center console between them, dashboard and windshield visible above seatbacks.",

      // === 4. Rear Interior (车内后排) ===
      "R6 Rear 3/4 View": "Camera Position: Outside rear-right door. Height: 1.0m. Angle: 45° towards rear bench. Shot on 35mm lens, f/5.6. Composition: Standard commercial interior shot. Spatial Anchors: rear bench seat fills center, door opening frames the shot, B-pillar visible on right edge.",
      "R1 Rear Front Close-up": "Camera Position: Center tunnel between front seats. Height: 0.8m. Angle: 0° facing rearward. Shot on 35mm lens, f/5.6. Composition: Symmetrical 1-point perspective of rear bench. Spatial Anchors: rear bench perfectly centered, left and right sections symmetric, rear headrests at top, seat cushion at bottom.",
      "R2 Rear Side Left": "Camera Position: Outside rear-left door. Height: 1.0m. Angle: 45° looking in from left. Shot on 35mm lens, f/5.6. Composition: Left side of rear bench emphasized. Spatial Anchors: left rear seat fills foreground, center and right seats recede.",
      "R3 Rear Side Right": "Camera Position: Outside rear-right door. Height: 1.0m. Angle: 45° looking in from right. Shot on 35mm lens, f/5.6. Composition: Right side of rear bench emphasized. Spatial Anchors: right rear seat fills foreground, center and left seats recede.",
      "R4 Rear Folded View": "Camera Height: 1.2m. Angle: 30° downward. Shot on 35mm lens, f/5.6. Action: Rear seat backrest folded FLAT. Spatial Anchors: flat seatback surface dominates lower 2/3, cargo area visible behind.",
      "R7 Rear Tip-Up View": "Camera Height: 0.8m. Angle: Low angle upward. Shot on 35mm lens, f/5.6. Action: Rear seat cushion flipped UP vertically. Spatial Anchors: upright cushion surface fills center frame, floor area visible below.",
      "R5 Top-Down Reclined": "Camera Position: Ceiling/sunroof. Angle: 90° straight down. Shot on 24mm wide-angle lens, f/8. Composition: Overhead plan view. Spatial Anchors: front seats at top, rear seats at bottom, center console as vertical divider, all seats visible in layout.",

      // === 5. Armrest Box (扶手箱) ===
      "A01 White Background 1": "Camera: Studio, 45° above. Shot on 50mm standard lens, f/4. Composition: E-commerce catalog shot, product floating on white. Spatial Anchors: armrest cover centered, slight shadow below.",
      "A02 White Background 2": "Camera: Eye-level 0°. Shot on 50mm lens, f/4. Composition: Side profile on white surface. Spatial Anchors: product at center, showing height/thickness profile.",
      "A03 Rear Closed View": "Camera: From rear seat center, eye level. Shot on 35mm lens, f/5.6. Composition: User POV looking at center console, lid closed. Spatial Anchors: console centered in frame, front seats flanking left-right, dashboard above.",
      "A04 Rear Open View": "Camera: From rear seat. Shot on 35mm lens, f/5.6. Action: Armrest lid OPEN vertical. Spatial Anchors: open lid forms vertical element, storage compartment visible below lid.",
      "A05 Driver Side View": "Camera: Driver seat POV, looking down-right. Shot on 35mm lens, f/5.6. Spatial Anchors: console in lower-right of frame, steering wheel at left, gear shifter nearby.",
      "A06 Passenger Side View": "Camera: Passenger seat POV, looking down-left. Shot on 35mm lens, f/5.6. Spatial Anchors: console in lower-left of frame, dashboard ahead.",
      "A07 Top-Down View": "Camera: 90° directly overhead. Shot on 24mm wide-angle lens, f/8. Composition: Geometric top-down. Spatial Anchors: armrest cover centered, pattern alignment visible, surrounding console edges frame it.",
      "A08 Rear Diagonal": "Camera: Rear-right passenger POV. Angle: 45° to center console. Shot on 35mm lens, f/5.6. Spatial Anchors: console at 3/4 angle, corner fit visible.",
      "A09 Material Close-up": "Camera: 20cm distance. Shot on 100mm macro lens, f/2.8, shallow DOF. Composition: Extreme close-up of texture. Spatial Anchors: leather grain/fabric weave fills entire frame, stitching lines visible.",
      "A10 Driving Scenario": "Camera: Passenger side perspective. Shot on 35mm lens, f/5.6. Context: Driver's arm resting on cover. Spatial Anchors: arm on armrest at center, steering wheel in background, driving scene.",
      "A11 Rear Standard": "Camera: Center rear, straight level. Shot on 35mm lens, f/5.6. Composition: Symmetrical console view. Spatial Anchors: console centered, front seats flanking.",
      "A12 Pet Interaction Paws": "Camera: Eye level. Shot on 50mm lens, f/4. Subject: Golden Retriever paws on armrest. Spatial Anchors: paws resting on top of cover, armrest at center.",
      "A13 Waterproof Wipe": "Camera: 45° close-up. Shot on 50mm lens, f/4. Action: Hand wiping water droplets. Spatial Anchors: hand at center, water droplets visible on surface.",
      "A14 Installation Demo": "Camera: POV or side view. Shot on 35mm lens, f/5.6. Action: Hands stretching elastic band. Spatial Anchors: hands pulling cover edges, armrest console visible beneath.",
      "A15 Arm Rest Comfort": "Camera: Side profile. Shot on 50mm lens, f/4. Subject: Elbow pressing into foam. Spatial Anchors: arm at center, compression visible on cover surface.",
      "A16 Rear Ajar View": "Camera: Low angle from rear. Shot on 35mm lens, f/5.6. Action: Lid slightly lifted (ajar). Spatial Anchors: gap between lid and base visible, cover edge detail.",
      "A17 Driver High Angle": "Camera: High angle from driver side, steep down. Shot on 35mm lens, f/5.6. Spatial Anchors: console viewed from above-left, steering wheel at edge.",
      "A18 Pet Interaction Sitting": "Camera: Eye level. Shot on 50mm lens, f/4. Subject: Golden Retriever sitting ON console. Spatial Anchors: dog centered on armrest, interior around.",

      // Legacy/Fallback mapping
      "Driver's View": "Camera Position: Driver seat, looking right. Shot on 35mm lens, f/5.6. Perspective: Driver POV.",
      "Rear Row Perspective": "Camera Position: Rear seat, looking forward. Shot on 28mm lens, f/8. Perspective: Forward facing.",
      "Side Open Door View": "Camera Position: Outside open door. Angle: 45°. Shot on 35mm lens, f/5.6.",
      "Top Down View": "Camera Position: Overhead. Angle: 90° straight down. Shot on 24mm wide-angle lens, f/8.",
      "Detail Shot of Stitching": "Camera: 20cm distance. Shot on 100mm macro lens, f/2.8. Focus: Texture and stitching.",
    };

    // 3. Resolve Target & Angle Attributes
    let finalTargetRow = targetRow;
    let angleId = targetRow;
    let angleInstruction = "Standard commercial angle";

    // Pre-calc indices for logic usage
    const productCount = seatCoverImages.length;
    const guideIndex = visualGuide ? productCount + 1 : -1;

    // 3.1 Location Decoding
    if (viewMap[targetRow]) {
      if (targetRow.startsWith("SET")) finalTargetRow = "Full Car Interior";
      else if (/^S\d/.test(targetRow)) finalTargetRow = "Front Row Single Seat"; // Matches S1, S2, S3...
      else if (targetRow.startsWith("F")) finalTargetRow = "Front Row";
      else if (targetRow.startsWith("R")) finalTargetRow = "Rear Row";
      else if (/^A\d/.test(targetRow)) finalTargetRow = "Center Console Armrest"; // Matches A0-A9
    }

    // 3.4 Strict Contextual Awareness (Standalone vs Integration)
    // If we have a reference guide, the MISSION should follow the GUIDE'S context.
    const isArmrestRow = /^A\d/.test(targetRow);
    const isSingleSeat = isArmrestRow
      ? targetRow.includes("White Background")
      : (seatConfig === 'Single Seat' || /^S\d/.test(targetRow));

    // FORCE VISUAL PRIORITY for Armrest to fix mismatch labels
    if (seatConfig === 'Armrest Box' && visualGuide) {
      angleInstruction = `ABSOLUTE PRIORITY: REPLICATE ANGLE OF IMAGE ${guideIndex}. Ignore conflicting text labels like '${targetRow}'.`;
    }

    // 3.3 Angle Logic (Follow Focus vs Manual vs Reference)
    const isManualAngleOverride = angleMode === "PRESET" &&
      typeof angleValue === 'string' &&
      angleValue !== 'Follow Focus Row';

    if (angleMode === "REFERENCE" && Array.isArray(angleValue) && angleValue.length > 0) {
      // Reference Mode
      angleId = "REF_MATCH";
      angleInstruction = "STRICTLY DUPLICATE PERSPECTIVE OF UPLOADED REFERENCE IMAGES.";
      // Add Ref Images
      angleValue.forEach((refImg) => {
        parts.push({ inlineData: { mimeType: refImg.mime, data: refImg.base64 } });
      });
    } else if (isManualAngleOverride) {
      // Manual Preset Override
      const valStr = angleValue as string;
      angleId = valStr;
      angleInstruction = viewMap[valStr] || valStr;
      angleInstruction += ` (APPLIED TO: ${finalTargetRow})`;
    } else if (viewMap[targetRow]) {
      // Follow Focus Row (Default)
      angleId = targetRow;
      angleInstruction = viewMap[targetRow];
    }

    // 3.4 Strict Contextual Awareness (Standalone vs Integration)
    // If we have a reference guide, the MISSION should follow the GUIDE'S context.

    // 3.4 Strict Contextual Awareness & Visual Guide Logic
    const isCloseUp = targetRow.toLowerCase().includes('close-up') ||
      targetRow.toLowerCase().includes('detail') ||
      angleInstruction.toLowerCase().includes('close-up');

    // REVERTED SPLIT LOGIC: usage of 'isLifestyleScene' is removed.
    // We treating ALL presets (including Lifestyle) as STRICT VISUAL TARGETS because the thumbnails NOW contain the correct content (dogs, hands, etc).

    const missionText = isSingleSeat
      ? `MISSION: Create a high-end commercial product catalog asset. Focus is a STANDALONE **${productCategory}**. Background must be a clean, neutral studio gradient. REMOVE all car interior distractions (dashboard, wheels, cabin walls).`
      : isCloseUp
        ? `MISSION: Create a Macro/Detail commercial photograph. Focus strictly on the **${productCategory}** texture and fit. Blur the ${carModel} interior significantly using shallow depth of field. Use a tight crop.`
        : `MISSION: Create a photorealistic automotive interior visualization. Focus is the **${productCategory}** professionally INSTALLED inside a **${year} ${carModel}**. Maintain full cabin architectural context.`;

    // 4. Construct V5.1 Prompt with explicit IMAGE MANIFEST

    // 4. Construct V5.2 Prompt with explicit IMAGE MANIFEST
    // UPGRADE: Added Perspective Lock Protocol (Nano Banana Skills)

    // Resolve per-angle lens simulation and negative prompt
    const lensSimulation = getAngleLens(targetRow);
    const angleNegative = getAngleNegative(targetRow);

    const v4Prompt = `
## ✅ AutoFusion™ Pro V5.3 (Perspective-Locked™ Edition)

---

# 📐 CAMERA & PERSPECTIVE LOCK [NON-NEGOTIABLE]
> **CAMERA INSTRUCTION**: ${angleInstruction}
> **LENS SIMULATION**: ${lensSimulation}
> **ASPECT RATIO**: ${aspectRatio}
> **CRITICAL**: The camera MUST NOT move. Match the reference/preset angle EXACTLY.
> **PHYSICS**: DO NOT change the lens focal length, camera height, or field of view.
> **COMPOSITION**: Keep the subject framed exactly as described in the spatial anchors.

## 📸 PERSPECTIVE LOCK PROTOCOL (Nano Banana Skills)

### Anti-Drift Constraints [ABSOLUTE]
> - DO NOT rotate the camera from the specified angle
> - DO NOT change the focal length from what is specified
> - DO NOT shift the vanishing point or perspective lines
> - The horizon line MUST remain at the same Y-position as described
> - All spatial anchors listed in the camera instruction MUST appear in their specified positions
> - If a visual guide image is provided, the composition grid MUST match it pixel-for-pixel

### Spatial Anchor Enforcement
> The camera instruction above contains "Spatial Anchors" — these describe WHERE specific elements must appear in the frame.
> You MUST place these elements in the described positions. This is how we ensure angle accuracy.
> Example: "steering wheel at top-center" means the steering wheel MUST be in the top-center area of the output image.

---

# 🚨 #1 PRIORITY: USE THE CORRECT PRODUCT 🚨

> **THE MOST IMPORTANT THING**: The ${productCategory} in your output MUST come from **Images 1-${productCount}**.
> **DO NOT** use the ${productCategory === 'Armrest Box' ? 'center console/armrest' : 'seat'} shown in Image ${guideIndex || 'the reference'} - that is a PLACEHOLDER to be REPLACED.

## 🖼️ IMAGE MANIFEST [READ THIS FIRST - CRITICAL]

| Image # | Type | What It Is |
|---------|------|------------|
${seatCoverImages.map((_, i) => `| **Image ${i + 1}** | 🛍️ **YOUR PRODUCT** | This is the **${productCategory}** you MUST put in the final image. OBSERVE its exact appearance and copy it EXACTLY as shown. |`).join('\n')}
${visualGuide ? `| **Image ${guideIndex}** | 📐 Scene Template | This shows the CAMERA ANGLE and SCENE LAYOUT only. The ${productCategory === 'Armrest Box' ? 'armrest/console' : 'seat cover'} in this image is NOT your product - REMOVE IT and PUT your product (from Images 1-${productCount}) in its place. |` : ''}

### 🔴 CRITICAL UNDERSTANDING 🔴

**Your task is a PRODUCT REPLACEMENT task:**
- Image ${guideIndex || 'the reference'} contains a ${productCategory === 'Armrest Box' ? 'plain/generic center console armrest' : 'vehicle seat'}
- You must REMOVE that and REPLACE it with the ${productCategory} from Images 1-${productCount}
- The ${productCategory} in Images 1-${productCount} is a **COVER/ACCESSORY** - LOOK at the images to see its exact appearance (could be smooth, quilted, patterned, or any other texture - copy what you SEE)

**Think of it like this:**
- Images 1-${productCount} = The "sticker/wrap" to apply
- Image ${guideIndex || 'reference'} = The "base surface" location and angle

⛔ If your output shows the ORIGINAL ${productCategory === 'Armrest Box' ? 'Tesla/car console WITHOUT the cover from Images 1-' + productCount : 'uncovered seat'}, you have FAILED.
✅ If your output shows the ${productCategory} from Images 1-${productCount} INSTALLED in the scene, you have SUCCEEDED.

---

⚠️ **PRIORITY ORDER (STRICT)** ⚠️

| Priority | Task | Source |
|----------|------|--------|
| **#1A HIGHEST** | Use the correct ${productCategory} product | Images 1-${productCount} |
| **#1B HIGHEST** | Match the camera angle/composition EXACTLY | ${visualGuide ? `Image ${guideIndex} (MUST match 1:1)` : angleId} |
| **#3** | Render correct vehicle interior | ${year} ${carModel} |

> ⚠️ #1A and #1B are EQUALLY important. The product MUST be correct AND the angle MUST match exactly.

**SYSTEM**: AutoFusion™ Pro V5.3 - Perspective Locked
**CONTEXT**: ${isSingleSeat ? "STANDALONE_CATALOG" : "INTERIOR_INTEGRATION"}
**PRODUCT_TYPE**: **${productCategory}** (MUST come from Images 1-${productCount})

---

## 🛍️ 1. PRODUCT INSTALLATION [#1 HIGHEST PRIORITY]

> **THIS IS YOUR PRIMARY TASK**: Install the ${productCategory} from Images 1-${productCount} into the scene.

**LOOK AT IMAGES 1-${productCount} CAREFULLY** - These show your product:
- **OBSERVE** the exact texture, color, and surface pattern from the uploaded images
- **COPY** every visual detail exactly as shown - DO NOT assume or add features
- **MATCH** the material appearance (glossy/matte, smooth/textured, plain/patterned)
- The product is designed to WRAP OVER/COVER the original ${productCategory === 'Armrest Box' ? 'center console armrest' : 'vehicle seat'}

**⚠️ DO NOT ASSUME the product has any specific pattern:**
- Only include patterns/textures that are VISIBLE in Images 1-${productCount}
- If the product appears smooth/plain, render it as smooth/plain
- If the product has quilting, render quilting
- If the product has other patterns, render those patterns
- **COPY EXACTLY** what you see - no additions, no assumptions

**Installation visualization**:
- The ${productCategory} COVERS/WRAPS the original ${productCategory === 'Armrest Box' ? 'armrest lid' : 'seat'} 
- It should look INSTALLED and IN-USE, not floating
- The original OEM surface is HIDDEN beneath the cover

⛔ **WRONG**: Showing the bare ${productCategory === 'Armrest Box' ? 'Tesla armrest without the cover' : 'uncovered seat'}
⛔ **WRONG**: Adding patterns/textures that are NOT in Images 1-${productCount}
✅ **RIGHT**: Showing the EXACT product from Images 1-${productCount} wrapped/installed on the surface

---

## 📐 2. SCENE & COMPOSITION [PRIORITY #2 - CAMERA ANGLE]

**ANGLE_ID**: ${angleId}
**SCENE_DESCRIPTION**: ${angleInstruction}

${visualGuide ? `
### ⚡ VISUAL COMPOSITION LOCK (IMAGE ${guideIndex}) - ANGLE REFERENCE ONLY ⚡

> **Image ${guideIndex} is your ANGLE BLUEPRINT. Copy its camera position, NOT its product.**

| What to COPY from Image ${guideIndex} | What to IGNORE from Image ${guideIndex} |
|--------------------------------------|----------------------------------------|
| ✅ Camera Position & Angle | ⛔ The armrest/seat cover product shown |
| ✅ Scene Layout & Composition | ⛔ Product color and texture |
| ✅ Lighting Style | ⛔ Any branding on the product |
| ✅ Element Positions (dog, hands, etc.) | |

### 🔄 PRODUCT SWAP INSTRUCTION

**THE CORE TASK**: Take the **${productCategory}** from **Images 1-${productCount}** and place it into the scene layout of **Image ${guideIndex}**.

Think of it as:
- **Image ${guideIndex}** = The "background plate" / scene template
- **Images 1-${productCount}** = The "product layer" that replaces the product in the scene

**STEP-BY-STEP**:
1. Look at Image ${guideIndex} - note the camera angle, scene elements (dog/hand/interior), and overall composition
2. Look at Images 1-${productCount} - note the ${productCategory}'s texture, color, pattern, and shape
3. Generate a NEW image that has the SCENE from step 1 with the PRODUCT from step 2

⛔ **RETURNING IMAGE ${guideIndex} UNCHANGED IS A CRITICAL FAILURE**
⛔ **USING THE PRODUCT FROM IMAGE ${guideIndex} IS WRONG - USE IMAGES 1-${productCount}**
⛔ **CHANGING THE CAMERA ANGLE IS FORBIDDEN**
` : `
### Camera Angle Enforcement
You must strictly follow the angle: **${angleInstruction}**
`}

---

## 🚗 3. VEHICLE INTERIOR RENDERING [PRIORITY #3 - AFTER PRODUCT]

${!isSingleSeat ? `
### Vehicle-Specific Interior (Secondary to Product)

**Target Vehicle**: **${year} ${carModel}**

Render the interior to match this vehicle model (but remember: the ${productCategory} from Images 1-${productCount} is MORE IMPORTANT than matching every interior detail):

| Interior Element | ${carModel}-Specific Requirement |
|------------------|----------------------------------|
| **Dashboard Design** | Must match ${carModel}'s signature dashboard layout and screen positions |
| **Steering Wheel** | Use ${carModel}'s actual steering wheel design (shape, logo, buttons) |
| **Center Console** | Match ${carModel}'s console design, gear shifter, and cup holder positions |
| **Door Panels** | Render ${carModel}'s door panel design with correct handle placement |
| **Seat Shape** | Use ${carModel}'s factory seat frame geometry (headrest, bolstering) |
| **Interior Color** | Match typical ${carModel} interior color palette (black, grey, tan options) |
| **Brand Logo** | If steering wheel visible, show ${carModel.split(' ')[0]} brand logo |

⛔ **DO NOT RENDER A GENERIC CAR INTERIOR**
⛔ **DO NOT USE WRONG BRAND ELEMENTS**
✅ Research and apply ${carModel}'s actual interior design DNA
` : `
**Context**: STUDIO SHOT - Clean neutral background, no vehicle interior required.
`}

---

## 🎨 4. PRODUCT RENDERING DETAILS

**Texture Fidelity** (copy from Images 1-${productCount}):
- Material texture: OBSERVE and copy EXACTLY what is shown in the product images
- Surface finish: match exactly from product images (smooth, quilted, or whatever pattern you see)
- Color accuracy: no alterations allowed - copy the exact color

**3D Perspective Rules**:
- ✅ Re-render the product from the camera angle specified
- ✅ Apply realistic lighting and shadows
- ⛔ Do not modify the product's design, pattern, or color
- ⛔ Do not distort the product shape to fit the angle - use correct perspective.

---

## 🎯 5. MISSION

${missionText}

${customRequest ? `
### 🗨️ USER CUSTOM REQUEST [HIGH PRIORITY]
> "**${customRequest}**"

Execute this user request while maintaining all other constraints.
` : ""}

---

## 🎨 6. MATERIAL & LIGHTING PROTOCOL

| Component | Protocol |
|-----------|----------|
| **PRODUCT** | **MATCH REFERENCE EXACTLY**. No color shift. Preserve all texture details. |
| **LIGHTING** | Professional automotive photography lighting. Soft diffused key light. Natural shadows. |
| **FINISH** | Photorealistic texture. Visible leather grain / fabric weave. NO 3D-render smoothness. |
| **OVERALL** | The final image must look like a REAL PHOTOGRAPH, not CGI or illustration. |

---

## 🛠️ 7. INSTALLATION LOGIC

${productCategory === "Armrest Box" ? `
- **SHAPE**: Duplicate the curvature and rigid 3D form from [PRODUCT MASTER].
- **PLACEMENT**: ${isSingleSeat ? "Neutral studio surface." : "Fits perfectly on the " + carModel + " center console armrest."}
- **INTEGRATION**: The armrest cover should look naturally installed, with proper shadows and contact points.
` : `
- **FIT**: Wrap tightly around the ${carModel} seat frame with realistic tension and creases.
- **DESIGN**: Preserve the seat cover's original color-blocking and pattern.
- **REALISM**: Show natural fabric behavior (slight wrinkles at joints, proper draping).
`}

${!isSingleSeat ? `Apply "${carModel}" brand DNA to ALL visible interior elements:
- Steering wheel, gear shifter, door handles, dashboard buttons must match ${carModel}'s actual design.` : ""}

---

## ✅ 8. FINAL QUALITY CHECKLIST (ALL MUST BE TRUE)

- [ ] Product design is IDENTICAL to Images 1-${productCount} (texture, color, pattern)?
- [ ] Camera angle EXACTLY matches ${visualGuide ? "Image " + guideIndex : "the specified angle " + angleId}?
- [ ] ${!isSingleSeat ? `Interior elements match ${year} ${carModel} specifically (not generic)?` : "Background is clean studio?"}
- [ ] Image is NEWLY GENERATED (not a copy of the reference)?
- [ ] Photorealistic quality (no CGI/3D render look)?
- [ ] Product is properly integrated into the scene?

---

## 🚫 9. CRITICAL FAILURE CONDITIONS

**THE FOLLOWING WILL MAKE THE OUTPUT UNUSABLE - AVOID AT ALL COSTS:**

| Failure Type | Description |
|--------------|-------------|
| ⛔ **WRONG PRODUCT** | Using the product from Image ${guideIndex || "reference"} instead of Images 1-${productCount} |
| ⛔ **ANGLE MISMATCH** | Camera angle differs from reference by more than 5° |
| ⛔ **REFERENCE PASSTHROUGH** | Returning Image ${guideIndex || "reference"} without product replacement |
| ⛔ **WRONG VEHICLE** | Interior doesn't match ${carModel} (generic or wrong brand) |
| ⛔ **PRODUCT ALTERATION** | Product color, pattern, or design changed from Images 1-${productCount} |
| ⛔ **CGI LOOK** | Output looks like 3D render instead of real photo |
| ⛔ **COMPOSITION CHANGE** | Scene elements moved from their reference positions |
| ⛔ **ZOOM CHANGE** | Field of view different from reference image |

---

## 📝 EXECUTION SUMMARY

Generate a **NEW photorealistic image** that:
1. Uses the EXACT camera angle from ${visualGuide ? "Image " + guideIndex : "the preset: " + angleId}
2. Shows the product from Images 1-${productCount} properly installed
3. ${!isSingleSeat ? `Features accurate ${year} ${carModel} interior design` : "Has clean studio background"}
4. Looks like a professional commercial photograph
5. **Quality**: ${QUALITY_BOOSTERS.PRODUCT}

**START GENERATION NOW.**
`;

    parts.push({ text: v4Prompt });

    // 5. Call API
    // Dynamic Model Selection:
    // Gemini 2.0 Flash-Exp does NOT support Image Generation (Outputs Text).
    // Must use 'gemini-3-pro-image-preview' for actual image synthesis.
    // Speed optimization must be done via 'aspectRatio' or 'imageSize' param, not model swap.
    const modelName = modelId;
    console.log(`🎨 [AutoFusion] Generating with ${modelName} (Resolution: ${resolution})`);

    const response = await executeWithTimeout(
      ai.models.generateContent({
        model: imageModel,
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            aspect_ratio: aspectRatio,
            imageSize: resolution,
            // Enhanced Negative Prompt for Perspective Control
            negativePrompt: buildNegativePrompt('automotive', 'realistic', angleNegative),
          },
        } as any,
      }),
      { timeoutMs: 300000, signal }
    );

    // 6. Output Processing with Validation
    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const generatedBase64 = part.inlineData.data;

          // Validation: Check if the generated image is the same as the visual guide
          if (visualGuide) {
            const guideSnippet = visualGuide.base64.substring(0, 500);
            const outputSnippet = generatedBase64.substring(0, 500);

            if (guideSnippet === outputSnippet) {
              console.warn("⚠️ [AutoFusion] VALIDATION FAILED: Generated image appears identical to visual guide!");
            } else {
              console.log("✅ [AutoFusion] Validation passed: Generated image differs from visual guide.");
            }
          }

          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${generatedBase64}`,
          );
        } else if (part.text && (part.text.includes('http://') || part.text.includes('https://'))) {
          const urlMatch = part.text.match(/https?:\/\/[^\s\)\n\r]+(?:\.[a-zA-Z0-9]{2,})[^\s\)\n\r]*/g);
          if (urlMatch) {
            urlMatch.forEach(url => images.push(url));
          }
        }
      }
    }

    // Log generation result
    if (images.length > 0) {
      console.log(`✅ [AutoFusion] Successfully generated ${images.length} image(s) for ${year} ${carModel}`);
    } else {
      console.warn("⚠️ [AutoFusion] No images were generated. The model may have refused the request.");
    }

    return images;

  } catch (error) {
    console.error("Seat cover generation failed", error);
    throw error;
  }
};

/**
 * 3. Inpaint Image (New Inpainting Canvas)
 * Uses gemini-2.5-flash-image with Mask support
 */
export const inpaintImage = async (
  originalBase64: string,
  maskBase64: string,
  prompt: string,
  options: { resolution?: ImageResolution } = {},
  referenceImages: { base64: string; mimeType: string }[] = []
) => {
  const forcedPrompt = prompt; // Inpainting doesn't typically change AR, but we'll keep it for consistency
  const { ai, model } = getImageGenerationContext(
    "gemini-3.1-flash-image-preview",
    '1:1',
    options.resolution || '1K'
  );
  try {
    const parts: any[] = [
      {
        inlineData: {
          data: originalBase64,
          mimeType: "image/png",
        },
      },
      {
        inlineData: {
          data: maskBase64,
          mimeType: "image/png",
        },
      },
    ];

    // Add Reference Images for Inpainting
    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach((img) => {
        parts.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType,
          },
        });
      });
    }

    parts.push({
      text: `
      You are a Senior Retoucher for a High-End Brand.
      
      INPUTS:
      - Image 1: Original Image.
      - Image 2: Mask (White area = edit zone).
      ${referenceImages.length > 0 ? `- Additional Images: REFERENCE MATERIAL (Style/Texture Guide).` : ''}
      
      TASK: Precision Retouching on Image 1.
      1. Modify ONLY the white area of the mask.
      2. INSTRUCTION: "${prompt}".
      ${referenceImages.length > 0 ? `3. STRICT ADHERENCE to Reference Material for texture/style/color independently of the original.` : ''}
      4. Blend edges naturally — no visible seams, no color mismatch.
      5. ${QUALITY_BOOSTERS.RETOUCHING}
      `,
    });

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          imageSize: options.resolution || "1K",
        }
      }
    });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        } else if (part.text && (part.text.includes('http://') || part.text.includes('https://'))) {
          const urlMatch = part.text.match(/https?:\/\/[^\s\)\n\r]+(?:\.[a-zA-Z0-9]{2,})[^\s\)\n\r]*/g);
          if (urlMatch) {
            urlMatch.forEach(url => images.push(url));
          }
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Inpainting failed", error);
    throw error;
  }
};

/**
 * 3.1 Edit Generated Image (Legacy Text Only)
 * Uses gemini-2.5-pro-image
 */
export const editGeneratedImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  referenceImages: { base64: string; mimeType: string }[] = [],
  options: { aspectRatio?: AspectRatio; resolution?: ImageResolution; signal?: AbortSignal } = {}
) => {
  const { aspectRatio = "1:1", resolution = "2K", signal } = options;
  throwIfAborted(signal);
  const getAspectRatioHint = (ar: string) => {
    if (ar === '16:9') return 'WIDE SCREEN, 1792x1024 resolution, cinematic landscape orientation';
    if (ar === '9:16') return 'TALL PHONE SCREEN, 1024x1792 resolution, vertical portrait orientation';
    if (ar === '3:2') return '3:2 landscape, 1536x1024';
    if (ar === '2:3') return '2:3 portrait, 1024x1536';
    if (ar === '4:3') return '4:3 standard landscape, 1280x960';
    if (ar === '3:4') return '3:4 portrait, 960x1280';
    if (ar === '21:9') return 'ULTRA-WIDE cinematic, 1792x768, panorama';
    return '';
  };
  const arHint = getAspectRatioHint(aspectRatio);
  const resolutionHint = resolution === '4K' ? '8K UHD, ultra-high resolution, extremely detailed, masterwork' : resolution === '2K' ? '4K resolution, high definition, sharp focus' : '';
  const forcedPrompt = (aspectRatio && aspectRatio !== '1:1') || resolutionHint 
    ? `[OUTPUT: ${aspectRatio}, ${resolution} QUALITY] (${arHint}) ${resolutionHint}, ${prompt} ${aspectRatio !== '1:1' ? `--ar ${aspectRatio}` : ''}` 
    : prompt;
  const { ai, model } = getImageGenerationContext(
    "gemini-3.1-flash-image-preview",
    aspectRatio,
    resolution
  );
  try {
    const parts: any[] = [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ];

    // Add Reference Images
    referenceImages.forEach((img) => {
      parts.push({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType,
        },
      });
    });

    // Wrap raw prompt with structured editing template
    const enhancedEditPrompt = `
    **ROLE**: Professional Photo Editor.
    **TASK**: Edit the provided image according to the instruction below.
    ${referenceImages.length > 0 ? `**REFERENCES**: ${referenceImages.length} reference image(s) provided for style/content guidance.` : ''}
    
    **EDIT INSTRUCTION**: ${forcedPrompt}
    
    **QUALITY**: ${QUALITY_BOOSTERS.RETOUCHING}
    **CONSTRAINT**: Preserve all unedited areas exactly. Only modify what the instruction requests.
    `;

    parts.push({ text: enhancedEditPrompt });

    const response = await executeWithTimeout(ai.models.generateContent({
      model,
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: options.aspectRatio,
          aspect_ratio: options.aspectRatio,
          imageSize: options.resolution || "1K",
        } as any,
      },
    }), { timeoutMs: 180000, signal });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        } else if (part.text && (part.text.includes('http://') || part.text.includes('https://'))) {
          const urlMatch = part.text.match(/https?:\/\/[^\s\)\n\r]+(?:\.[a-zA-Z0-9]{2,})[^\s\)\n\r]*/g);
          if (urlMatch) {
            urlMatch.forEach(url => images.push(url));
          }
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Edit failed", error);
    throw error;
  }
};

/**
 * 3.2 Outpaint Image
 * Uses gemini-2.5-flash-image with Mask support to expand canvas
 */
export const generateOutpainting = async (
  inputBase64: string,
  maskBase64: string,
  prompt?: string,
) => {
  const { ai, model } = getImageGenerationContext("gemini-2.5-pro-image");
  try {
    const description =
      prompt ||
      "Extend the scene naturally, matching the existing lighting and environment.";

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              data: inputBase64,
              mimeType: "image/png",
            },
          },
          {
            inlineData: {
              data: maskBase64,
              mimeType: "image/png",
            },
          },
          {
            text: `
            You are an Expert Image Extender — seamless quality is paramount.
            
            Image 1: The input image with a transparent/white border.
            Image 2: A mask where BLACK is the original image (KEEP) and WHITE is the empty space (FILL).
            
            TASK: Outpaint / Expand the image.
            1. Fill the WHITE area of the mask with new content.
            2. The new content MUST seamlessly blend with the edges of the original image (Black area).
            3. Match lighting direction, color temperature, and texture style exactly.
            4. Context: ${description}
            5. Do NOT modify the original image content inside the Black mask area.
            6. Quality: ${QUALITY_BOOSTERS.RETOUCHING}
            `,
          },
        ],
      },
    });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        } else if (part.text && (part.text.includes('http://') || part.text.includes('https://'))) {
          const urlMatch = part.text.match(/https?:\/\/[^\s\)\n\r]+(?:\.[a-zA-Z0-9]{2,})[^\s\)\n\r]*/g);
          if (urlMatch) {
            urlMatch.forEach(url => images.push(url));
          }
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Outpainting failed", error);
    throw error;
  }
};

/**
 * 4. Search Trends
 * Uses gemini-2.5-flash with googleSearch
 */
export const searchTrends = async (query: string) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const grounding =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const text = response.text || "No results found.";

    return { text, grounding };
  } catch (error) {
    console.error("Search failed", error);
    throw error;
  }
};

/**
 * 5. Generate Listing Copy
 * Uses gemini-2.5-flash-image
 */
export const generateListingCopy = async (
  imageBase64: string,
  mimeType: string,
  platform: "Amazon" | "TikTok" | "Instagram",
  keywords?: string,
) => {
  const ai = getAiClient();

  let prompt = "";
  const keywordsContext = keywords
    ? `Focus heavily on these user-provided keywords/features: "${keywords}".`
    : "";

  if (platform === "Amazon") {
    prompt = `You are an expert Amazon Listing Copywriter (Cross-border E-commerce Expert). 
    Analyze the provided product image.
    ${keywordsContext}
    
    Write a high-converting Amazon listing in English.
    Structure:
    1. **Title**: SEO-optimized, max 200 chars. Include main keywords.
    2. **5 Bullet Points**: Highlight features and benefits. Use uppercase for the first phrase of each bullet.
    3. **Product Description**: A compelling paragraph selling the lifestyle and value.
    
    Ensure the tone is professional yet persuasive.`;
  } else if (platform === "TikTok") {
    prompt = `You are a viral TikTok script writer. Analyze the product image.
    ${keywordsContext}
    
    Write a short video script for this product.
    Structure:
    1. **Hook (0-3s)**: Something visual or shocking to stop the scroll.
    2. **Body (15-30s)**: Showcasing the problem and the solution (the product).
    3. **Call to Action**: Clear instruction to buy or check the link.
    4. **Hashtags**: 5-10 trending hashtags for this niche.
    
    Tone: Energetic, fast-paced, Gen-Z friendly.`;
  } else if (platform === "Instagram") {
    prompt = `You are a social media manager for a premium brand. Analyze the product image.
    ${keywordsContext}
    
    Write an aesthetic Instagram caption.
    Structure:
    1. **Opening**: Engaging line or question.
    2. **Body**: Short value proposition.
    3. **Call to Action**.
    4. **Hashtags**: Relevant tags mixed with niche tags.
    
    Tone: Aesthetic, lifestyle-focused, use emojis.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    return response.text || "生成失败，请重试。";
  } catch (error) {
    console.error("Copy generation failed", error);
    throw error;
  }
};

/**
 * 6. Generate Video Script
 * Uses gemini-2.5-flash-image
 */
export const generateVideoScript = async (
  input:
    | string
    | Array<{
        base64: string;
        mimeType: string;
        name?: string;
        role?: string;
        type?: string;
      }>,
  mimeTypeOrDuration: string,
  durationOrStyle: string,
  styleOrPrompt?: string,
) => {
  const ai = getAiClient();
  const isMultiAsset = Array.isArray(input);
  const assets = isMultiAsset
    ? input
    : [{ base64: input, mimeType: mimeTypeOrDuration, name: 'Product image', role: 'product', type: 'image' }];
  const duration = isMultiAsset ? mimeTypeOrDuration : durationOrStyle;
  const style = isMultiAsset ? durationOrStyle : styleOrPrompt || 'Fast-paced/Sales';
  const userPrompt = isMultiAsset ? styleOrPrompt || '' : '';
  const assetSummary = assets
    .map((asset, index) => `Image/Media ${index + 1}: role=${asset.role || 'reference'}, type=${asset.type || 'image'}, name=${asset.name || 'uploaded asset'}`)
    .join('\n');

  const prompt = `You are a professional ecommerce video creative director working in a Google Flow-style media workspace.
  Analyze all uploaded assets and create a practical storyboard plan that can later be used for image/video generation.

  Uploaded asset map:
  ${assetSummary}

  User creation request:
  ${userPrompt || 'Create a polished ecommerce product video storyboard from the uploaded assets.'}

  Constraints:
  - Total Duration: ${duration}
  - Vibe/Style: ${style}
  - Use product assets as the source of truth for product appearance.
  - Use scene assets only as environment references.
  - Use character assets only as identity/casting references.
  - Keep the storyboard realistic for ecommerce production, with clear camera movement, subject action, product selling point, and edit rhythm.
  - If the user uploaded multiple products/scenes/characters, route them intentionally instead of blending them randomly.

  Instructions:
  - Break down the video into scenes/shots.
  - The script must be perfectly timed to fit the ${duration}.
  - Generate 4 to 8 storyboard cards depending on duration.
  - Each scene should be useful as a prompt for a downstream image/video model.
  - Output strictly in JSON format (Array of objects).
  - Do NOT use Markdown code blocks. Just return the JSON string.

  JSON Structure per scene:
  {
    "time": "Timestamp (e.g., 00:00 - 00:05)",
    "visual": "Detailed visual description of the scene, camera angle, subject action.",
    "audio": "Voiceover (VO), Sound Effects (SFX), or Music cues.",
    "overlay": "Text overlay or graphics on screen.",
    "prompt": "A concise English video/image generation prompt for this storyboard card."
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro-image",
      contents: {
        parts: [
          ...assets.map((asset) => ({
            inlineData: {
              mimeType: asset.mimeType,
              data: asset.base64,
            },
          })),
          { text: prompt },
        ],
      },
    });

    let text = response.text || "[]";
    // Clean up if model adds markdown blocks despite instructions
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse failed, returning raw text as one scene", text);
      // Sanitization fallback
      const sanitized = text.replace(/[\n\r\t]/g, " ");
      try {
        return JSON.parse(sanitized);
      } catch (e2) {
        return [
          {
            time: "00:00 - end",
            visual: "Failed to parse JSON",
            audio: text,
            overlay: "Error",
          },
        ];
      }
    }
  } catch (error) {
    console.error("Script generation failed", error);
    throw error;
  }
};

/**
 * 7. Live Director (Audio Conversation)
 * Uses gemini-2.5-flash-native-audio-preview-09-2025
 */
export const connectLiveDirector = async (
  onAudioData: (base64: string) => void,
  onClose: () => void,
) => {
  const ai = getAiClient();

  // Setup Audio Input (Microphone)
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
    },
  });

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  let isConnected = true;

  const sessionPromise = ai.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: {
        parts: [
          {
            text: "你是一位专业的创意视觉总监。请用简短、专业的语言与用户讨论视觉创意方案。请讲中文。",
          },
        ],
      },
    },
    callbacks: {
      onopen: () => {
        console.log("Live session opened");
      },
      onmessage: (message: LiveServerMessage) => {
        const audioData =
          message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          onAudioData(audioData);
        }
        if (message.serverContent?.turnComplete) {
          console.log("Turn complete");
        }
      },
      onclose: () => {
        console.log("Live session closed");
        isConnected = false;
        onClose();
      },
      onerror: (err) => {
        console.error("Live session error:", err);
        isConnected = false;
        onClose();
      },
    },
  });

  // Stream Audio Input
  processor.onaudioprocess = (e) => {
    if (!isConnected) return;

    const inputData = e.inputBuffer.getChannelData(0);
    // Convert Float32 to Int16 PCM for Gemini
    const buffer = new ArrayBuffer(inputData.length * 2);
    const view = new DataView(buffer);
    floatTo16BitPCM(view, 0, inputData);

    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    sessionPromise
      .then((session) => {
        session.sendRealtimeInput({
          media: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Audio,
          },
        });
      })
      .catch((err) => {
        // Session might be initializing or failed
      });
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return {
    close: async () => {
      isConnected = false;
      stream.getTracks().forEach((track) => track.stop());
      processor.disconnect();
      source.disconnect();
      await audioContext.close();
      const session = await sessionPromise;
      /* @ts-ignore */
      if (session.close) session.close();
    },
  };
};

// ==================== Camera Angle Analysis ====================

export const estimateCameraAngle = async (
  base64Image: string,
  mimeType: string
): Promise<{ yaw: number; pitch: number; zoom: number }> => {
  const ai = getAiClient();
  try {
    const prompt = `Analyze the camera angle of this image relative to a standard eye-level front-facing view.
    Estimate the following 3 values in a Global Spherical Coordinate System:
    1. Yaw (Azimuth): 0 to 360 degrees. 0=Front, 90=Right, 180=Back, 270=Left.
    2. Pitch (Elevation): -90 to 90 degrees. 0=Eye-level, Positive=High Angle (Looking Down), Negative=Low Angle (Looking Up).
    3. Zoom (Distance): 0.5 (Wide/Far) to 2.5 (Telephoto/Close). 1.0 is standard.

    Return ONLY a raw JSON object with no markdown formatting:
    { "yaw": number, "pitch": number, "zoom": number }`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No analysis result");

    const json = JSON.parse(text);
    return {
      yaw: Number(json.yaw) || 0,
      pitch: Number(json.pitch) || 0,
      zoom: Number(json.zoom) || 1,
    };
  } catch (error) {
    console.error("Camera estimation failed:", error);
    // Return default neutral values on failure
    return { yaw: 0, pitch: 0, zoom: 1 };
  }
};

export const extractImagesFromResponseParts = (response: any): string[] => {
  const images: string[] = [];
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return images;

  for (const part of parts) {
    const inlineData = part?.inlineData || part?.inline_data;
    if (inlineData?.data) {
      const mime = inlineData.mimeType || inlineData.mime_type || 'image/png';
      const base64 = inlineData.data;
      images.push(base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`);
    }
    if (part?.text && typeof part.text === 'string') {
      const trimmed = part.text.trim();
      if (trimmed.startsWith('data:image/')) {
        images.push(trimmed);
      } else {
        const urlMatches = trimmed.match(/https?:\/\/[^\s"'\)\n\r>]+/g);
        if (urlMatches) {
          for (const url of urlMatches) {
            const cleanUrl = url.replace(/[,;.]+\s*$/, '').trim();
            if (cleanUrl) images.push(cleanUrl);
          }
        }
      }
    }
  }

  return images;
};

/**
 * 8. Generate Style Replication Image
 * Uses gemini-3-pro-image-preview
 * 
 * This function takes a style reference image and product images,
 * then generates new images that apply the reference style to the products.
 */
export const generateStyleReplication = async (
  styleReference: { base64: string; mime: string },
  productImages: { base64: string; mime: string }[],
  customPrompt?: string,
  options: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    count?: number;
    model?: string;
    retouch?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<string[]> => {
  const { aspectRatio = "1:1", resolution = "2K", count = 1, model = "gemini-3.1-flash-image-preview", retouch = false, signal } = options;
  const { ai, config: imageApiConfig } = getImageGenerationContext(model, aspectRatio, resolution);
  throwIfAborted(signal);

  // Build the prompt for style replication
  const productCount = productImages.length;

  const prompt = `
# 🎭 ROLE: Senior Art Director & CGI Specialist
# 🧠 COGNITIVE PIPELINE (MANDATORY EXECUTION)

You are NOT just generating an image. You are simulating a high-end rendering engine. 
You MUST process the input through these 8 distinct phases:

## PHASE 1: ANALYSIS & BLUEPRINT 🔍
1. **[Design Analysis]**: Deeply analyze Image ${productCount + 1} (Style Ref). Deconstruct its layout grid, color palette hex codes, and lighting physics.
2. **[Composition Build]**: Map the "skeleton" of the reference image. Prepare to slot the Product Images (1-${productCount}) into this exact skeleton.

## PHASE 2: PHYSICS & RENDERING 🛠️
3. **[Lighting Simulation]**: Recreate the exact light sources from the reference (Softbox? Hard sun? Neon?). Apply this physics to the new product.
4. **[Hi-Fi Rendering]**: Render the Product (1-${productCount}) with 8K texture fidelity. No blurring. No hallucinations.
5. **[Texture Optimization]**: Enhance material properties (leather grains, metal reflections, fabric weave).

## PHASE 3: POST-PROCESSING 🎨
6. **[Polishing]**: Smooth out edges, blend product into background seamlessly.
7. **[Dynamic Range]**: Optimize contrast and saturation. Ensure "pop" without over-saturation.
8. **[Color Accuracy]**: Match the reference image's mood while preserving neutral white balance, accurate product colors, and natural skin tones. Do not introduce a red/magenta cast.

---

## 🎯 MISSION

**INPUT**:
- **Product Images**: 1-${productCount} (Target Object)
- **Style Reference**: Image ${productCount + 1} (Visual Template)

**EXECUTION**:
- **Structure**: CLONE the layout of Image ${productCount + 1} pixel-perfectly.
- **Content**: REPLACE the object in Image ${productCount + 1} with the Product from Images 1-${productCount}.
- **Context**: ${customPrompt ? `Force Scene Setting: "${customPrompt}"` : 'Keep original background.'}
- **Color Guard**: Preserve the product's original hue/material color and keep whites/greys neutral. Skin, fabric, and background must not become warmer, redder, pinker, or more magenta than the style reference requires. Avoid red skin cast, oversaturated reds, orange-pink tint, and global warm color drift.
- **Quality**: ${QUALITY_BOOSTERS.PRODUCT}

**OUTPUT**:
- Generate **ONE** high-fidelity image that looks like a finished commercial advertisement.
- Do NOT output text. Just the final image.
`;

  console.log('[StyleReplication] customPrompt:', customPrompt);
  console.log('[StyleReplication] productCount:', productCount);

  const parts: any[] = [];
  parts.push({ text: prompt });

  for (const img of productImages) {
    parts.push({
      inlineData: {
        mimeType: img.mime,
        data: img.base64,
      },
    });
  }

  parts.push({
    inlineData: {
      mimeType: styleReference.mime,
      data: styleReference.base64,
    },
  });

  if (customPrompt) {
    console.log('[StyleReplication] ⚡ 客户指示检测到:', customPrompt);
    console.log('[StyleReplication] Full prompt being sent:\n', prompt);
  }

  const runGeneration = async (modelName: string) => {
    console.log(`[StyleReplication] Attempting generation with model: ${modelName}, Resolution: ${resolution}, Aspect: ${aspectRatio}`);
    const runtimeModel = imageApiConfig.isXiaoche
      ? resolveXiaocheImageModel(modelName, aspectRatio, resolution)
      : resolveRuntimeModelId(modelName, imageApiConfig);

    const config: any = {
      temperature: 0.2,
      safetySettings: GLOBAL_SAFETY_SETTINGS,
      imageConfig: {
        aspectRatio: aspectRatio,
        aspect_ratio: aspectRatio,
        imageSize: resolution,
      }
    };

    return await executeWithTimeout(ai.models.generateContent({
      model: runtimeModel,
      contents: [{ role: "user", parts }],
      config: config,
    }), { timeoutMs: 300000, signal });
  };

  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    throwIfAborted(signal);
    try {
      console.log(`[StyleReplication] Generating image ${i + 1}/${count}...`);

      let response;
      try {
        response = await runGeneration(model);
      } catch (err) {
        console.warn(`[StyleReplication] Primary model ${model} failed, trying fallback to gemini-2.0-flash-exp`);
        response = await runGeneration("gemini-2.0-flash-exp");
      }

      const candidate = response.candidates?.[0];
      if (!candidate) {
        console.error(`[StyleReplication] No candidates returned for image ${i + 1}`);
        console.log('[StyleReplication] Full Response:', JSON.stringify(response, null, 2));
        continue;
      }

      console.log(`[StyleReplication] Finish Reason: ${candidate.finishReason}`);

      const textPart = candidate.content?.parts?.find((p: any) => p.text);
      if (textPart) {
        console.log(`[StyleReplication] Model Text Response: ${textPart.text}`);
      }

      const extractedImages = extractImagesFromResponseParts(response);

      if (extractedImages.length > 0) {
        results.push(...extractedImages);
        console.log(`[StyleReplication] Image ${i + 1} generated successfully (${extractedImages.length} image(s) extracted)`);
      } else {
        console.warn(`[StyleReplication] Image ${i + 1} generation returned no image`);
        console.log('[StyleReplication] Candidate content:', JSON.stringify(candidate.content, null, 2));
      }
    } catch (error) {
      console.error(`[StyleReplication] Image ${i + 1} generation failed:`, error);
    }
  }

  if (results.length === 0) {
    throw new Error("Style replication failed - no images generated");
  }

  return results;
};

// ==================== Product Swap (1:1 Replacement) ====================

/**
 * 9. Product Swap — 1:1 Product Replacement in Scene
 * Uses gemini-3-pro-image-preview
 *
 * Takes a reference scene image and product images,
 * then generates new images that replace the original product in the scene
 * with the user's product, preserving scene, lighting, and composition.
 */
export const generateProductSwap = async (
  sceneImage: { base64: string; mime: string },
  productImages: { base64: string; mime: string }[],
  userPrompt?: string,
  options: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    model?: string;
    signal?: AbortSignal;
  } = {}
): Promise<string[]> => {
  throwIfAborted(options.signal);
  const aspectRatio = options.aspectRatio || AspectRatio.LANDSCAPE_4_3;
  const resolution = options.resolution || "2K";
  const model = options.model || "gemini-3.1-flash-image-preview";
  const { ai, config: imageApiConfig } = getImageGenerationContext(model, aspectRatio, resolution);
  const productCount = productImages.length;

  // ============ PROMPT ENGINE (Nano Banana Golden Formula) ============
  const prompt = `
# 🎯 ROLE: Professional Product Replacement Specialist & CGI Compositor

You are a world-class digital compositor specializing in **seamless product replacement**.
Your task is to perform a pixel-perfect product swap in a reference scene.

## 📋 INPUT MANIFEST
- **Image 1**: Reference Scene (BLUEPRINT — keep everything EXCEPT the target products)
- **Images 2-${productCount + 1}**: **Product Pool** (Candidate products for swapping, labeled internally as Product A, Product B, etc.)

## 🧠 COGNITIVE PIPELINE (8-Phase Execution)

### PHASE 1: SCENE DEEP ANALYSIS 🔍
Analyze the Reference Scene (Image 1) completely:
- Identify the **target product(s)** to be replaced (can be multiple subjects, e.g., two people with bags)
- Map the **exact position, size, rotation, and perspective** of EACH target product
- Catalog the **scene context**: background, surrounding objects, people, composition
- Analyze **lighting physics**: direction, intensity, color temperature, shadow patterns

### PHASE 1.5: OCCLUSION & BACKGROUND PREDICTION 🙈
- **CRITICAL STEP**: Analyze what lies *behind* the current target product(s).
- **Predict Hidden Context**: If the current product is removed, what texture/object should appear? (e.g., shirt fabric, chair back, distant landscape).
- **Prepare Inpainting Data**: Generate mentally the background data for any area currently covered by the product but NOT covered by the new product.

### PHASE 2: PRODUCT SOURCE ANALYSIS 📍
Analyze the Product Pool (Images 2-${productCount + 1}):
- Extract the **true shape, proportions, and material properties** of EACH product image.
- Identify **texture details**: surface finish, color, patterns, branding.
- Note **key visual features** that must be preserved.

### PHASE 2.5: MULTI-TARGET MAPPING 🗺️
- **Analyze User Instruction**: Check for specific mapping commands (e.g., "Left person wears Product A (Image 2), Right person wears Product B (Image 3)").
- **Map Targets**: Identify multiple distinct subjects/products in the scene if applicable.
- **Assign Sources**: Link each target in the scene to a specific image from the Product Pool.
- **Default Logic**: If no specific mapping is given, apply Product A (Image 2) to the MAIN subject.

### PHASE 3: LIGHTING PHYSICS MATCHING 💡
- Calculate how the scene's lighting would interact with EACH replacement product independently.
- Match **shadow direction and softness** to the scene for each subject.
- Apply correct **specular highlights** and **ambient occlusion**.
- Ensure **color temperature consistency** between products and scene.

### PHASE 4: PERSPECTIVE & SCALE CALIBRATION 📐
- Match the **camera angle** of EACH replacement product to its specific location in the scene.
- Scale the product to **maintain true proportions** relative to the specific person/object it is attached to.
- Do NOT stretch to fill old space.

### PHASE 5: SMART ERASE & PRECISION SWAP (Multi-Target Edition) 🔄
- **Check All Targets**: Iterate through all mapped Target/Source pairs.
- **For EACH Pair**:
  - **SIZE MISMATCH PROTOCOL**: If Original > New, **ERASE** -> **INPAINT** -> **PLACE**.
  - **ANTI-GHOSTING**: Ensure NO residual pixels of the original object remain.
  - **Placement**: Position the replacement product in the **exact same logical position** (e.g., on the back).
- **Consistency**: Ensure both products look like they belong in the same physical space.
- Keep ALL non-product elements **100% unchanged**: people, background, props, text.

### PHASE 6: EDGE BLENDING & INTEGRATION ✨
- Seamlessly blend product edges with the surrounding scene for ALL swapped items.
- Apply correct **contact shadows** where the product meets surfaces.
- Handle **occlusion** — if fingers, straps, or other elements overlap the product.
- Ensure no visible seams, halos, or artifacts.

### PHASE 7: MATERIAL FIDELITY 🧶
- Preserve the replacement product's **authentic material texture**.
- Render leather grains, fabric weave, metal reflections, or plastic sheen accurately.
- Maintain product color accuracy under the scene's lighting conditions.

### PHASE 8: FINAL QUALITY ASSURANCE 🏆
- Verify the swap looks **100% natural and photorealistic**.
- Check for any inconsistencies in lighting, perspective, or scale.
- Ensure the output looks like a **real photograph**, not a composite.
- Apply final color grading to match the scene's overall mood.

---

## 🎯 MISSION SUMMARY

**KEEP UNCHANGED**: Scene background, people, poses, composition, camera angle, lighting setup
**REPLACE**: The target product(s) according to the Multi-Target Mapping.
**ANTI-GHOSTING**: If replacing a large object with a smaller one, completely ERASE the large object and recover the background.
${userPrompt ? `**USER INSTRUCTION**: "${userPrompt}"` : '**DEFAULT**: Replace the most prominent product in the scene with the provided Product Pool images.'}

**QUALITY STANDARD**: ${QUALITY_BOOSTERS.PRODUCT}
Professional commercial photography quality. The result must be indistinguishable from a real photograph.

**OUTPUT**: Generate ONE high-fidelity image. Do NOT output any text, only the final image.
`;

  console.log('[ProductSwap] Starting product swap generation...');
  console.log('[ProductSwap] Product count:', productCount);
  if (userPrompt) console.log('[ProductSwap] User prompt:', userPrompt);

  // Build parts array
  const parts: any[] = [];
  parts.push({ text: prompt });

  // Add scene reference image first
  parts.push({
    inlineData: {
      mimeType: sceneImage.mime,
      data: sceneImage.base64,
    },
  });

  // Add product images
  for (const img of productImages) {
    parts.push({
      inlineData: {
        mimeType: img.mime,
        data: img.base64,
      },
    });
  }

  // Helper to run generation
  const runGeneration = async (modelName: string) => {
    console.log(`[ProductSwap] Generating with model: ${modelName}, Resolution: ${resolution}, Aspect: ${aspectRatio}`);
    const runtimeModel = imageApiConfig.isXiaoche
      ? resolveXiaocheImageModel(modelName, aspectRatio, resolution)
      : resolveRuntimeModelId(modelName, imageApiConfig);

    const config: any = {
      temperature: 0.15, // Lower temp for more faithful reproduction
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      imageConfig: {
        aspectRatio: aspectRatio,
        aspect_ratio: aspectRatio,
        imageSize: resolution,
      }
    };

    return await executeWithTimeout(ai.models.generateContent({
      model: runtimeModel,
      contents: [{ role: "user", parts }],
      config: config,
    }), { timeoutMs: 300000, signal: options.signal });
  };

  // Generate
  try {
    let response;
    try {
      response = await runGeneration(model);
    } catch (err) {
      console.warn(`[ProductSwap] Primary model ${model} failed, trying fallback...`);
      response = await runGeneration("gemini-2.0-flash-exp");
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
      console.error('[ProductSwap] No candidates returned');
      throw new Error('产品替换失败 — 模型未返回结果，请重试');
    }

    // Log text if any
    const textPart = candidate.content?.parts?.find((p: any) => p.text);
    if (textPart) {
      console.log(`[ProductSwap] Model text: ${textPart.text}`);
    }

    const extractedImages = extractImagesFromResponseParts(response);
    if (extractedImages.length > 0) {
      console.log('[ProductSwap] Image generated successfully');
      return extractedImages;
    } else {
      console.warn('[ProductSwap] No image in response');
      throw new Error('产品替换失败 — 未生成图片，请检查输入后重试');
    }
  } catch (error) {
    console.error('[ProductSwap] Generation failed:', error);
    throw error;
  }
};
// ==================== HD Upscale (Smart Retouching Upgrade) ====================

/**
 * 10. HD Upscale - Step 0: Image Quality Assessment
 * Uses gemini-2.5-flash-image
 */
export const analyzeImageQuality = async (
  imageBase64: string,
  mimeType: string
) => {
  const ai = getAiClient();
  const prompt = `
  You are a professional Image Quality Analysis Expert. Please conduct a comprehensive quality assessment of the uploaded image.

  ## Analysis Dimensions

  ### 1. Basic Parameters
  - Image Resolution (Width x Height)
  - File Format
  - Color Mode (RGB/CMYK/Grayscale)
  - Color Depth

  ### 2. Quality Assessment (Score 1-10 each)
  - Sharpness Score: Detect blurriness
  - Noise Score: Detect noise/grain
  - Compression Artifacts Score: Detect JPEG artifacts
  - Exposure Score: Detect over/under exposure
  - Color Saturation Score

  ### 3. Processing Recommendations
  Based on the assessment, output JSON recommendations:

  \`\`\`json
  {
    "original_resolution": "WxH",
    "quality_score": 0-100,
    "denoise_strength": 0-1,
    "sharpen_strength": 0-1,
    "color_correction_needed": true/false,
    "recommended_upscale_factor": 2/4/8,
    "processing_difficulty": "low/medium/high"
  }
  \`\`\`

  Please output the JSON result directly.
  `;

  try {
    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL, // Use default text model for fast analysis
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Quality analysis failed", error);
    // Return safe default
    return {
      quality_score: 50,
      recommended_upscale_factor: 2,
      processing_difficulty: "medium"
    };
  }
};

/**
 * 10.1 HD Upscale - Step 1: Style Analysis (Reverse Prompting)
 * Uses gemini-2.5-flash-image
 */
export const analyzeStyle = async (
  imageBase64: string,
  mimeType: string
) => {
  const ai = getAiClient();
  const prompt = `
  【图像深度解析与细节捕捉框架 - 实时还原版】
  
  请作为一名顶尖的视觉分析专家，对输入图像进行“像素级”拆解。你的目标是生成一套能够支撑 4K 高清放大的结构化提示词，必须捕捉到原图的所有灵魂特征。

  ══ A. 场景核心 (Macro) ══
  • 主体识别：准确定位视觉中心（人/物/景），描述其具体型号、物种或状态。
  • 核心叙事：描述当下正在发生的动作、情感或状态。
  • 空间构图：定位视角（广角/微距/鸟瞰）、光心位置、景深分布。
  
  ══ B. 风格 DNA (Medium) ══
  • 媒介属性：**严命**：如果是照片请务必标注 "Photorealistic", "Unprocessed RAW", "8k UHD"。
  • 色彩科学：主色调 HEX/色彩倾向、冷暖对比程度、色彩饱和度分布。
  • 光影物理：光源性质（硬光/柔光/侧逆光）、光影过渡的平滑度。
  
  ══ C. 微观细节捕捉 (Micro - 还原核心) ══
  请针对识别到的主体类型，**极致捕捉**以下细节特征（如有）：
  - **生物/人像**：[皮肤毛孔、汗毛走向、眼球湿润反光与虹膜细节、发丝微小的毛糙、唇部纹路、血管隐现]。
  - **建筑/工业**：[砖缝中的灰浆质感、金属拉丝/锈蚀痕迹、玻璃微小的划痕、涂料的风化颗粒、精密接合缝隙]。
  - **自然/植被**：[叶脉的几何分叉、露珠的折射率、岩石的断层层理、土壤的潮湿颗粒、云层的纤维状边缘]。
  - **织物/服饰**：[经纬编织的微观纹理、纤维起球情况、缝纫针脚的走线逻辑、布料的细微反光倾向]。
  
  ══ D. 技术参数引导 ══
  • 器材拟真：模拟特定镜头（如 35mm f/1.4, 85mm Prime）的散景质感。
  • 清晰度控制：强调边缘的锐利度与内部质感的细腻度。

  ## 输出格式 (Output Format)
  请输出符合 JSON 格式的结果，确保 positive_prompt 具有极高的还原引导力：
  \`\`\`json
  {
    "positive_prompt": "以艺术风格开头 (如: Photorealistic, 8k, raw photo)，紧随主体与动作详细描述，接着是[微观细节]部分的具体特征词，最后加入高品质助推词 (如: highly detailed, sharp focus, masterpiece)。",
    "negative_prompt": "Low quality, blurry, distorted, deformed, text, watermark, CGI, 3d render, plastic skin, smoothed textures, missing details, incorrect perspective, artifacts.",
    "style_summary": "请用结构化的中文汇总上述分析，特别是微观细节部分的捕捉结果。",
    "key_features": ["核心主体", "微观纹理", "光影特征"],
    "recommended_params": {
      "aspect_ratio": "1:1",
      "style_weight": 0.85
    }
  }
  \`\`\`
  `;

  try {
    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Style analysis failed", error);
    return { positive_prompt: "High quality image", negative_prompt: "low quality" };
  }
};

/**
 * 10.2 HD Upscale - Step 2: Generate Color Map
 * Uses gemini-3-pro-image-preview
 */
export const generateColorMap = async (
  imageBase64: string,
  mimeType: string,
  aspectRatio: AspectRatio = AspectRatio.SQUARE
) => {
  const { ai, model } = getImageGenerationContext(
    "gemini-3.1-flash-image-preview",
    aspectRatio,
    '2K'
  );
  const prompt = `
  【任务】生成专业级平面色彩构成分析图
  
  【动态识别流程】
  
  第一步：智能区域划分
  根据画面内容自适应识别：
  - 主体与背景的边界
  - 不同材质/物体的分界
  - 色彩自然过渡的断点
  - 光影造成的色域变化
  
  第二步：色块提纯与填充
  - 每个识别区域 → 提取代表色 → 均匀填充
  - 保留色彩的层级关系与空间暗示
  - 相邻色块需有足够的明度/色相区分
  
  第三步：全面净化
  移除所有非色彩本质的信息：
  × 光影（高光、阴影、环境光）
  × 材质（纹理、反射、透明度）
  × 噪声（颗粒、杂色、压缩痕迹）
  
  【输出】
  边界清晰的纯色块构成图，
  色彩关系 = 唯一视觉语言，
  可直接用于配色提案或风格化创作

  **CRITICAL**: The output composition and aspect ratio MUST match the input image EXACTLY.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          aspect_ratio: aspectRatio,
          imageSize: "2K"
        } as any
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      ? `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`
      : null;
  } catch (error) {
    console.error("Color Map Gen failed", error);
    return null;
  }
};

/**
 * 10.3 HD Upscale - Step 3: Generate Line Art
 * Uses gemini-3-pro-image-preview
 */
export const generateLineArt = async (
  imageBase64: string,
  mimeType: string,
  aspectRatio: AspectRatio = AspectRatio.SQUARE
) => {
  const { ai, model } = getImageGenerationContext(
    "gemini-3.1-flash-image-preview",
    aspectRatio,
    '2K'
  );
  const prompt = `
  【任务】将输入图像解析为专业级矢量线稿
  
  【自适应分析】
  首先识别画面主体类型，动态调整线条策略：
  - 生物类：捕捉毛发走向、皮肤褶皱、肌肉轮廓
  - 建筑/物品：强调结构边缘、材质分界、几何关系
  - 自然景观：表现植被层次、地形起伏、水纹流向
  - 织物/软质：体现垂坠感、褶皱逻辑、编织纹理
  
  【线条层级系统】
  L1 主轮廓：定义物体边界与剪影
  L2 结构线：表达体积转折、内部形态
  L3 细节线：材质特征、微观纹理走向
  L4 氛围线：暗示光影边界、空间深度（可选）
  
  【输出标准】
  ✓ 纯黑白、线条闭合流畅、层次分明
  ✗ 禁止：灰度填充、渐变、模糊、噪点

  **CRITICAL**: The output composition and aspect ratio MUST match the input image EXACTLY.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          aspect_ratio: aspectRatio,
          imageSize: "2K" // Higher res for better structural guidance
        } as any
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      ? `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`
      : null;
  } catch (error) {
    console.error("Line Art Gen failed", error);
    return null;
  }
};

/**
 * 10.4 HD Upscale - Step 4: Final Reconstruction
 * Uses gemini-3-pro-image-preview
 */
export const generateHDUpscale = async (
  original: { base64: string, mime: string },
  colorMap: string | null,
  lineArt: string | null,
  promptData: { positive: string, negative: string },
  upscaleFactor: number = 2,
  aspectRatio: AspectRatio = AspectRatio.SQUARE
) => {
  const parts: any[] = [];

  // PHASE 1: IDENTITY REFERENCE (The Blueprint)
  // Re-introducing the original image as a direct visual anchor to ensure 100% restoration/fidelity.
  parts.push({ inlineData: { mimeType: original.mime, data: original.base64 } });

  // PHASE 2: CONTROL ADAPTERS (Structure & Color Palette)
  if (colorMap) {
    const base64Clean = colorMap.split(',')[1] || colorMap;
    parts.push({ inlineData: { mimeType: "image/png", data: base64Clean } });
  }
  if (lineArt) {
    const base64Clean = lineArt.split(',')[1] || lineArt;
    parts.push({ inlineData: { mimeType: "image/png", data: base64Clean } });
  }

  // PHASE 3: UPSCALING PROTOCOL
  const scaleMap = { 2: "2K", 4: "4K", 8: "4K" }; 
  const targetRes = (scaleMap as any)[upscaleFactor] || "2K";
  const { ai, model } = getImageGenerationContext(
    "gemini-3.1-flash-image-preview",
    aspectRatio,
    targetRes
  );

  const systemPrompt = `
  # ROLE: Professional Image Super-Resolution & Reconstruction Expert (Hyper-Fidelity Mode)
  
  # CORE MISSION:
  Transform **Image 1** (Source Blueprint) into a Masterpiece of Clarity at ${targetRes} resolution.
  Your goal is **Sub-Pixel Enhancement**: sharpening every edge, clarifying every texture, and removing blur/noise while maintaining 100% Identity Integrity.
  
  # INPUT SYNERGY:
  - **Image 1 (Identity)**: The absolute master for colors, features, and essence. Do NOT deviate.
  - **Image 3 (Structural Guide)**: Precise line-work for edge sharpening and structural locking.
  
  # RECONSTRUCTION PROTOCOL:
  1. **Sharpening & Definition**: Aggressively clarify edges, eyes, skin texture, and fabric weave found in Image 1. 
  2. **Texture Density**: Increase the perception of detail (e.g., skin pores, hair strands) to match the ${targetRes} output. These details must feel "restored", not "added".
  3. **Zero Content Drift**: Every feature must remain in its exact spatial position as defined by Image 3. No new objects.
  
  # STYLE GUIDELINE:
  Ultra-sharp, 8k professional photography, high-dynamic range, zero compression artifacts, perfect restoration.
  
  # RESTORATION PROMPT:
  ${promptData.positive}

  # FORBIDDEN (NEGATIVE):
  blurry, muddy textures, AI-generated artifacts, facial distortion, style alteration, content movement, ${promptData.negative}.
  `;

  parts.push({ text: systemPrompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: parts },
      config: {
        temperature: 0.15, // Extremely low for maximum fidelity
        imageConfig: {
          aspectRatio: aspectRatio,
          aspect_ratio: aspectRatio,
          imageSize: targetRes as any
        }
      } as any
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      ? `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`
      : null;
  } catch (error) {
    console.error("HD Upscale failed", error);
    return null;
  }
};

/**
 * =========================================================================================
 *  THREE-VIEW GENERATION (三视图制作)
 * =========================================================================================
 */

/**
 * Analyze product and model images for Three-View generation.
 * Uses gemini-3.1-flash-lite-preview as the default text analysis model.
 */
export const analyzeThreeViewContext = async (
  images: { base64: string; mimeType: string }[],
  textModel: string = DEFAULT_TEXT_MODEL
) => {
  const ai = getAiClient();

  const analysisPrompt = `
**ROLE**: Professional Product Photographer & 3D Visualization Expert.

**TASK**: Analyze the provided reference images of a product and/or model, then generate structured descriptions for creating THREE distinct views: FRONT, SIDE (profile), and BACK.

**INPUT IMAGES GUIDE**:
- Images provided may include: product photos, model/person reference photos, or both.

**YOUR ANALYSIS GOALS**:

1. **PRODUCT ANALYSIS (CRITICAL)**:
   - Identify the product type (garment, accessory, bag, shoes, etc.)
   - Describe color, material, texture, patterns, logos, and design details with extreme precision
   - Note any unique features that must be preserved across all three views

2. **MODEL IDENTITY (if model reference provided)**:
   - Ethnicity, hair color/style, facial features
   - Body build, height impression, proportions
   - The model MUST remain identical across all three views

3. **THREE-VIEW SPECIFICATIONS**:
   For each view, provide specific pose and composition instructions:
   
   - **FRONT VIEW**: Direct front-facing, symmetrical composition, full body or 3/4 body, product clearly visible from front
   - **SIDE VIEW**: Pure 90° profile (left or right), showing product silhouette, depth, and side details
   - **BACK VIEW**: Direct rear view, showing back design, closure details, rear fit

**OUTPUT FORMAT (MANDATORY JSON)**:
{
  "product_type": "Type of product identified",
  "product_description": "Extremely detailed description of the product appearance, color, material, patterns...",
  "model_identity": "Detailed physical description of the model for identity locking across views...",
  "front_view_instruction": "Specific pose, composition, and styling instruction for the FRONT view...",
  "side_view_instruction": "Specific pose, composition, and styling instruction for the SIDE view...",
  "back_view_instruction": "Specific pose, composition, and styling instruction for the BACK view..."
}

Respond ONLY with valid JSON.
`;

  try {
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 }
    }));
    parts.push({ text: analysisPrompt });

    const response = await generateContentWithAnalysisFallback(ai, {
      model: textModel,
      contents: { parts }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Three-view analysis failed", error);
    return {
      product_type: "Product",
      product_description: "Professional product",
      model_identity: "Professional model",
      front_view_instruction: "Front-facing, symmetrical, full body shot",
      side_view_instruction: "90-degree side profile, full body shot",
      back_view_instruction: "Rear view, full body shot showing back details"
    };
  }
};

/**
 * =========================================================================================
 *  CLOTHING MODIFICATION EXPERT SYSTEM (服装改款专家系统) - V2.0
 * =========================================================================================
 */

/**
 * Refine user's modification prompt using a thinking model (Gemini-3.1-Flash-Lite).
 * Inject mode-specific core skills for extreme precision.
 */
export const refineModificationPrompt = async (
  mode: string,
  userPrompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> => {
  const ai = getAiClient();
  
  const modeSkills: Record<string, string> = {
    'pattern-on-body': `
      **SKILL: DYNAMIC FABRIC MAPPING (核心技能：织物动态映射)**
      - **CRITICAL**: Replicate the pattern from Image 2 onto the target garment in Image 1.
      - **GEOMETRIC ADHERENCE**: The pattern must warp, bend, and scale perfectly according to the physical folds, wrinkles, and shadows of the garment in Image 1.
      - **PERSPECTIVE**: If Image 1 is at an angle, the pattern must follow that 3D perspective.
      - **TEXTURE FUSION**: Preserve the original fabric's weave (e.g., silk sheen, cotton matte) on top of the new pattern.
    `,
    'style-mod': `
      **SKILL: SILHOUETTE RECONSTRUCTION (核心技能：拓扑轮廓重塑)**
      - **CRITICAL**: Modify the cut and silhouette of the garment in Image 1 based on the style cues from Image 2 or instructions.
      - **IDENTITY LOCK**: Keep the person's face, hair, and background 100% frozen. ONLY change the garment's topology.
      - **MATERIAL CONSISTENCY**: Even if the shape changes, the fabric texture from Image 1 must remain consistent unless explicitly told otherwise.
      - **LOGIC**: Ensure the new style follows human skeletal constraints.
    `,
    'pattern-design': `
      **SKILL: AESTHETIC SYNTHESIS (核心技能：美学审美合成)**
      - **CRITICAL**: Extract the artistic theme, color palette, and motifs from Image 2.
      - **DESIGN ENGINE**: Generate a COMPLETELY NEW pattern that fits the garment's panels in Image 1 based on the extracted aesthetic.
      - **PLACEMENT**: Place motifs intelligently (e.g., pocket accents, centered chest graphics, or all-over prints).
    `,
    'line-filling': `
      **SKILL: PHOTOREALISTIC RENDERING PROTOCOL (核心技能：线稿写实渲染协议)**
      - **CRITICAL**: Treat Image 1 as a structural line-art guide (geometry master).
      - **RENDER TARGET**: Fill the line-art with hyper-realistic materials, lighting, and textures derived from Image 2.
      - **ZERO DRIFT**: Do not change the shape or pose defined by the line-art.
    `,
    'fabric-on-body': `
      **SKILL: FIBER-LEVEL DISPLACEMENT (核心技能：纤维级材质置换)**
      - **CRITICAL**: Replace the surface material of Image 1's clothing with the physical material of Image 2.
      - **DETAIL LOCK**: Keep all seams, buttons, and zippers from Image 1, but swap the pixel-level texture.
      - **PHYSICALITY**: If Image 2 is "heavy leather," ensure the folds reflect that weight vs "light silk."
    `,
    'color-change': `
      **SKILL: NON-DESTRUCTIVE RECOLORING (核心技能：非破坏性精准调色)**
      - **CRITICAL**: Remap the color values of the specified garment in Image 1 to match the palette in Image 2.
      - **LUMINANCE LOCK**: Preserve all original highlights, mid-tones, and shadows. The 3D volume of the clothes must remain identical.
      - **EDGE PRECISION**: Ensure clean color transitions at the garment edges.
    `,
    'free-design': `
      **SKILL: CREATIVE DESIGN ELEVATION (核心技能：高阶创意发散设计)**
      - **CRITICAL**: Perform an artistic fusion of Image 1 and Image 2.
      - **GOAL**: Create a vision-leading fashion piece that preserves the person's identity but radically enhances the aesthetic value.
    `
  };

  const activeSkill = modeSkills[mode] || modeSkills['free-design'];

  const refinementPrompt = `
**ROLE**: Senior AI Fashion Prompt Engineer & Expert Designer.

**TASK**: Analyze the user's intent and reference images to construct a high-precision MASTER PROMPT for the image generation engine.

**MODE-SPECIFIC CORE SKILL**:
${activeSkill}

**REFINING PROTOCOL (AGENT CONTROL MODE)**:
1. **Visual Analysis**: Deconstruct the garment in Image 1 (structure, fit, folds).
2. **Material Analysis**: Deconstruct the texture/pattern in Image 2.
3. **Synthesis**: Combine them into a single, cohesive, technical prompt.
4. **Keyword Enrichment**: Use high-fidelity photography keywords (8k, photorealistic, intricate textures, ray-traced shadows).

**USER ORIGINAL INTENT**: "${userPrompt}"

**OUTPUT FORMAT (MANDATORY)**:
Return ONLY the final enriched English prompt. Do NOT include any preamble or extra text.
`;

  try {
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 }
    }));
    parts.push({ text: refinementPrompt });

    const response = await generateContentWithAnalysisFallback(
      ai,
      {
        model: DEFAULT_TEXT_MODEL,
        contents: { parts }
      },
      { timeoutMs: 30000 }
    );

    return response.text?.trim() || userPrompt;
  } catch (error: any) {
    console.warn("Prompt refinement failed, falling back to original prompt.", error.message);
    return userPrompt; // Fallback to original
  }
};

/**
 * Universal Try-On (万物上身) Service
 * Supports 3 sub-modes:
 * - 'model': 模特换衣 (Model Clothes Change / Virtual Try-On)
 * - 'mannequin': 人台换衣 (Mannequin / Ghost Mannequin to Model Clothes Change)
 * - 'shoes': 鞋靴试穿 (Footwear / Shoe Try-On)
 */
export type UniversalTryOnProductRole =
  | 'top'
  | 'bottom'
  | 'full'
  | 'shoes'
  | 'accessory'
  | 'product';

export interface UniversalTryOnProductImage {
  base64: string;
  mime: string;
  role: UniversalTryOnProductRole;
  angle?: 'front' | 'back' | 'side' | 'detail' | 'outfit';
}

export const generateUniversalTryOn = async (
  productImages: UniversalTryOnProductImage[],
  modelReference: { base64: string; mime: string } | null,
  subMode: 'model' | 'mannequin' | 'shoes' = 'model',
  customPrompt?: string,
  options: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    count?: number;
    model?: string;
    lockCropping?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<string[]> => {
  const { aspectRatio = AspectRatio.PORTRAIT_2_3, resolution = "2K", count = 1, model = "gemini-3.1-flash-image-preview", lockCropping = true, signal } = options;
  const { ai, config: imageApiConfig } = getImageGenerationContext(model, aspectRatio, resolution);
  throwIfAborted(signal);

  const hasModelRef = !!modelReference;
  const isCroppingLocked = hasModelRef && lockCropping;
  const firstProductImageIndex = hasModelRef ? 2 : 1;
  const productRoleLabels: Record<UniversalTryOnProductRole, string> = {
    top: 'TOP GARMENT reference (replace upper-body clothing only)',
    bottom: 'BOTTOM GARMENT reference (replace lower-body clothing only)',
    full: 'FULL OUTFIT reference (replace the complete garment)',
    shoes: 'FOOTWEAR reference (replace shoes only)',
    accessory: 'ACCESSORY reference (shoes, bag, hat, belt or jewelry; do not treat as clothing)',
    product: 'PRODUCT reference',
  };
  const angleLabels: Record<string, string> = {
    front: '正面 (FRONT VIEW)',
    back: '背面 (BACK VIEW)',
    side: '侧面 (SIDE / 3/4 VIEW)',
    detail: '细节 (DETAIL VIEW)',
    outfit: '搭配/整套图 (FULL OUTFIT MATCHING REFERENCE)',
  };
  const inputImageMap = productImages
    .map((image, index) => {
      const angleStr = image.angle ? ` [Product Angle: ${angleLabels[image.angle] || image.angle}]` : '';
      return `- Image ${firstProductImageIndex + index}: ${productRoleLabels[image.role]}${angleStr}`;
    })
    .join('\n');
  const qualityInstruction = isCroppingLocked
    ? QUALITY_BOOSTERS.RETOUCHING
    : QUALITY_BOOSTERS.PRODUCT;
  const roleSpecificFrameRules = [
    productImages.some((image) => image.role === 'top')
      ? '- **TOP GARMENT LOCK**: Replace only the upper garment area already visible in Image 1. Keep the original top-edge body intersection; do not reveal extra neck, shoulders, chest, arms, or head to display the full top.'
      : '',
    productImages.some((image) => image.role === 'bottom')
      ? '- **BOTTOM GARMENT / TROUSER LOCK**: Keep the original waistband height, crotch point, hip width, knee coordinates, trouser hem height, leg stance, ankle/foot positions, footwear, and floor contact. Do not reveal more torso above the original top boundary or more floor below the original bottom boundary to display the full trousers.'
      : '',
    productImages.some((image) => image.role === 'full')
      ? '- **FULL OUTFIT LOCK**: Fit the outfit only inside the body area visible in Image 1. Any portion outside the original frame must remain clipped rather than causing an expanded body or canvas.'
      : '',
    productImages.some((image) => image.angle === 'outfit')
      ? '- **OUTFIT/MATCH TAG (搭配/整套图) SURGICAL EXTRACTION RULE**: One or more reference images are tagged as "搭配/整套图" (Full Outfit Match). These images contain a complete styled outfit/suit (e.g. both top and bottom shown together). YOU MUST SURGICALLY EXTRACT ONLY THE SINGLE TARGET ITEM corresponding to the category (e.g., if in TOP section, extract ONLY the top shirt/jacket; if in BOTTOM section, extract ONLY the skirt/pants). DO NOT COPY THE MATCHING GARMENT OR THE MODEL FROM THE OUTFIT REFERENCE IMAGE! If no target model image is provided, generate a NEW neutral ghost mannequin or clean commercial model body, and DO NOT reconstruct the model/head/neck from the outfit reference picture.'
      : '',
  ].filter(Boolean).join('\n');
  const preservationContract = isCroppingLocked
    ? `
## HIGHEST-PRIORITY FRAME PRESERVATION CONTRACT
This contract overrides the commercial-photography goal, garment completeness, styling preferences, and every CUSTOM INSTRUCTION.

1. **TOP EDGE CROP LOCK (ABSOLUTE NO NEW NECK/HEAD RULE)**: Look at the TOP boundary of Image 1 (the target model reference image). If Image 1 cuts off below the neck (at the chest/shoulders) and shows NO NECK, NO CHIN, and NO HEAD:
   - THE OUTPUT IMAGE MUST ALSO HAVE ZERO NECK, ZERO CHIN, AND ZERO HEAD VISIBLE.
   - IT MUST CLIP AT THE EXACT SAME TOP FRAME BOUNDARY (CHEST/SHOULDER LINE).
   - EVEN IF THE UPPER GARMENT REFERENCE HAS A COLLAR, HIGH NECK, OR SHOWS A MODEL WITH A NECK, SURGICALLY CLIP THE GARMENT AT IMAGE 1'S TOP FRAME EDGE. NEVER EXTEND THE CANVAS UPWARD OR DRAW A NECK TO SHOW THE COLLAR!
2. **BOTTOM & SIDE EDGE LOCK**: Preserve the exact body/object intersections at the bottom, left, and right boundaries. Never extend the canvas or reveal content outside Image 1.
3. **NORMALIZED LANDMARK LOCK**: Keep waistline, hands, elbows, hips, knees, ankles, feet, and visible garment boundaries at the same normalized x/y coordinates as Image 1.
4. **SUBJECT SCALE LOCK**: The model must occupy the same percentage of the frame. No zooming out to show the full garment and no zooming in for detail.
5. **CLIPPED GARMENT RULE**: If Image 1 clips part of the replacement garment (e.g. neck, collar, sleeves, or hems), clip the new garment at the identical frame boundary. Showing the whole product when Image 1 is cropped is a strict failure.
6. **UNCHANGED-PIXEL PRINCIPLE**: Outside the replaced garment/accessory regions, reproduce Image 1 without redesign, relighting, beautification, background cleanup, or recomposition.
7. **FORBIDDEN OUTPUTS**: newly generated neck/head when Image 1 had no neck, more upper body than Image 1, newly visible head/neck/shoulders, wider scene, taller canvas content, altered pose, shifted hands, changed footwear unless requested, or a newly staged fashion photo.

### ROLE-SPECIFIC CROP RULES
${roleSpecificFrameRules}

Before rendering, compare the planned output silhouette and all four frame intersections against Image 1. If any boundary exposes more content (especially a newly generated neck/head when Image 1 was cropped below the neck), correct it before generating.
`
    : '';

  let modeTitle = '模特换衣试穿';
  let modeInstruction = '';

  if (subMode === 'model') {
    modeTitle = `模特换装/虚拟试穿 (Model Virtual Try-On - ${isCroppingLocked ? 'Strict Cropping Lock' : 'Free Full Body View'})`;
    modeInstruction = `
- **GOAL**: ${hasModelRef ? 'Edit the target model in Image 1' : 'Generate a model'} using the role-labeled garment and accessory references in the INPUT IMAGE MAP.
${isCroppingLocked ? `
- **IMAGE-EDITING MODE — TARGET IMAGE 1 IS THE IMMUTABLE BASE CANVAS**:
  1. **POSE SKELETON FREEZE**: Preserve the exact head tilt, shoulder line, spine curve, hip angle, elbow/wrist/finger positions, knee bend, ankle angle and weight distribution from Image 1. Do not re-pose or beautify the body.
  2. **CAMERA & CROP FREEZE**: Preserve the exact camera position, perspective, focal length, subject scale, framing, crop boundaries and output orientation of Image 1. Do not zoom, pan, rotate, extend or recrop.
  3. **IDENTITY & ENVIRONMENT FREEZE**: Preserve face, hair, skin, body proportions, visible anatomy, background, lighting direction and all non-clothing objects from Image 1.
  4. **GARMENT-ONLY EDIT**: Change pixels only where the designated garments sit. Keep exposed skin and original body contours anchored. For partially visible garments, replace only the visible portion.
  5. **ACCESSORY PLACEMENT**: Add accessory references only at anatomically correct locations using the existing pose. Never move hands, arms, feet, head or shoulders to accommodate an accessory.
  6. **NO FULL-SCENE REGENERATION**: This is a localized virtual try-on edit, not a new fashion photo. When uncertain, preserve Image 1 rather than inventing content.
` : `
- **BODY & POSE**: Keep the model's exact pose, facial features, skin tone, hair style, and body proportions untouched.
- **CLOTHING FIT**: Drape the product garment naturally on the model body with realistic fabric tension, natural folds, and true-to-life 3D volume.
`}
`;
  } else if (subMode === 'mannequin') {
    modeTitle = '人台换衣/人台生模特 (Mannequin to Live Model Try-On - Strict Cropping Lock)';
    modeInstruction = `
- **GOAL**: Take the clothing references in the INPUT IMAGE MAP and render a professional live fashion model wearing them naturally${hasModelRef ? ' using Image 1 as the target model/base canvas' : ''}.
- **ELEVATION**: Convert ghost mannequin stiffness into fluid human posture, realistic fabric drapes, natural lighting shadows, and commercial lookbook aesthetics.
${isCroppingLocked ? `
- **CRITICAL CROPPING & VIEWPORT LOCK**:
  1. **STRICT CROP BOUNDARY MIRRORING**: Mirror the exact camera distance, framing, aspect ratio and crop boundary of Image 1.
  2. **POSE & IDENTITY FREEZE**: Preserve Image 1's joints, face, body proportions and background; edit clothing regions only.
  3. **NO EXTRA HEAD/LIMBS**: Maintain the exact same crop line and never invent body parts outside Image 1.
` : ''}
- **FABRIC FIDELITY**: Preserve exact textile texture, weave pattern, color hue, and brand details without deformation.
`;
  } else {
    modeTitle = '鞋靴试穿 (Footwear & Shoe Try-On Specialist - Single/Multi View 3D Agent & Crop Lock)';
    modeInstruction = `
- **GOAL**: Accurately fit the footwear references from the INPUT IMAGE MAP onto ${hasModelRef ? "the target model's feet in Image 1" : "a generated model's feet"}.
${isCroppingLocked ? `
- **CRITICAL CROPPING & VIEWPORT LOCK**:
  1. **STRICT LEG/ANKLE CROP BOUNDARY MIRRORING**: Mirror the exact camera distance, framing, perspective and crop boundary of Image 1.
  2. **LEG POSE FREEZE**: Keep knee, ankle, toe direction and foot-ground contact from Image 1 unchanged; replace shoes only.
  3. **NO ZOOM OUT**: If Image 1 is an ankle/leg close-up, keep the exact same framing and never reveal additional body areas.
` : ''}
- **MULTI-ANGLE FUSION**: If multiple FOOTWEAR references are provided in the INPUT IMAGE MAP, extract their 3D volume, sole tread depth, lace topology and upper texture from all views before fitting them to the feet.
- **LEG & ANKLE FIT**: Align shoe pitch, heel height, and ankle joint orientation seamlessly with the model's posture. Generate natural contact shadows where sole touches ground surface.
- **FABRIC & DETAIL LOCK**: Preserve shoe brand logos, leather gloss, metallic eyelets, stitching lines, and rubber sole texture accurately without blur.
`;
  }

  const prompt = `
# 🎭 ROLE: High-End Fashion Virtual Try-On Specialist & CGI Rendering Engine
# 🧠 COGNITIVE PIPELINE (UNIVERSAL TRY-ON AGENT EXECUTION)

You are performing a ultra-realistic virtual try-on operation: **${modeTitle}**.
You MUST process the input through these 8 distinct phases:

## INPUT IMAGE MAP — FOLLOW THESE ROLES EXACTLY
${hasModelRef ? '- Image 1: TARGET MODEL / IMMUTABLE BASE CANVAS (highest priority)' : '- No target model image: generate a suitable model.'}
${inputImageMap}

Do not infer image roles from visual similarity. An ACCESSORY image must never replace a top or bottom garment.
${hasModelRef ? `IMAGE 1 AUTHORITY HIERARCHY: Image 1 has absolute highest authority for the person, identity, body geometry, pose, camera, crop, background, lighting, shadows, and all non-target pixels. Images 2+ have authority only for the explicitly labeled wearable item's design. If any later image contains a person, mannequin, body, pose, hands, face, scene, styling, or background, ignore those carrier attributes completely. Never let Images 2+ replace, reinterpret, beautify, or restage the model from Image 1.` : ''}

## ⛔ ABSOLUTE TARGET-IMAGE IMMUTABILITY RULES
${hasModelRef ? `
These rules have higher priority than styling, commercial polish, beautification, the CUSTOM INSTRUCTION, and garment completeness:
1. **POSE IS A HARD PIXEL-SPACE CONSTRAINT**: Image 1's head angle, gaze, shoulder rotation, spine, hips, arms, elbows, wrists, fingers, legs, knees, ankles and foot direction must remain at the same normalized coordinates. Never move a hand to the hip, lower an arm, turn the torso, change a back view to a side/front view, or invent a new pose.
2. **SILHOUETTE & CAMERA FREEZE**: Keep the exact body silhouette, subject scale, crop, camera height, perspective, background and all four frame intersections from Image 1.
3. **IDENTITY FREEZE**: Keep the exact face, hair, skin, age, body proportions and visible anatomy. Do not beautify, reshape or restyle the person.
4. **NO-INVENTION WARDROBE WHITELIST**: The only new wearable objects allowed are the explicitly role-labeled TOP, BOTTOM, FULL, SHOES or ACCESSORY references supplied in the input map. Never invent a belt, buckle, necklace, earrings, bracelet, watch, ring, bag, hat, scarf, tie, brooch, eyewear, gloves, socks, shoes, extra garment, extra layer or decorative object.
5. **UNREQUESTED OBJECT BAN**: If no ACCESSORY reference was supplied, add zero new accessories. If no SHOES reference was supplied, preserve the original footwear exactly. Preserve every existing non-target object from Image 1 exactly; do not add, remove, replace or redesign it.
6. **GARMENT-REGION-ONLY EDIT**: Modify only the pixels occupied by the requested garment replacement. Everything outside those regions must reproduce Image 1, not a plausible alternative.
` : `
- **NO TARGET MODEL REFERENCE SUPPLIED MODE**:
  1. All provided input images are STRICTLY GARMENT/PRODUCT REFERENCES ONLY.
  2. If any of the garment reference images (including those tagged as "搭配") contain a model, neck, head, or full outfit, TREAT THAT IMAGE AS A PRODUCT SHEET ONLY — DO NOT COPY THAT MODEL, DO NOT COPY THAT POSTURE, AND DO NOT RECONSTRUCT THAT HEAD/NECK.
  3. You MUST generate a BRAND NEW clean commercial model/mannequin from scratch, and fit ONLY the designated garment onto it.
  4. If only TOP is provided, generate a clean top wearing model/mannequin. If only BOTTOM is provided, generate a bottom wearing model/mannequin. DO NOT copy the matching pants/top or model from an outfit reference image!
`}

## PHASE 1: ANATOMICAL & GARMENT ANALYSIS 🔍
1. **[Garment Deconstruction]**: Analyze every role-labeled product reference. Extract pattern, silhouette, cut, fabric texture and exact colors without mixing roles.
2. **[Human Pose Alignment]**: ${hasModelRef ? 'Analyze Image 1 first. Map its body skeleton and use those joint coordinates as hard anchors for the output.' : 'Generate an ideal high-fashion model matching the product vibe.'}

## PHASE 2: 3D DRESSING & LIGHTING SIMULATION 🛠️
3. **[Mesh Warp & Draping]**: Wrap the garment/shoes around the target 3D human body mesh. Apply gravity, fabric weight, and movement folds.
4. **[Lighting & Shadow Fusion]**: Match the exact key lights, rim lights, and contact shadows between garment and body.
5. **[Texture & Detail Preservation]**: Render stitch lines, fabric weave, specular reflections, and metallic zippers at 8K resolution.

## PHASE 3: COLOR GUARD & FINAL RENDERING 🎨
6. **[Edge Blending]**: Seamlessly blend clothing seams with skin boundaries without haloing or blur.
7. **[Color Guard]**: Preserve exact clothing/shoe true colors. Prevent warm/red color casts, over-saturation, or skin distortion.
8. **[Delivery]**: ${isCroppingLocked ? 'Deliver a localized edit of Image 1 with its original framing intact; do not create a newly staged photograph.' : 'Output a clean, high-conversion commercial fashion photograph.'}

---

## 🎯 MISSION

${modeInstruction}
${preservationContract}
- **FINAL COMPLIANCE GATE**: Before output, compare the result against Image 1. Reject and correct the render if any joint moved, the view direction changed, the crop changed, or any unprovided wearable/object appeared. Garment realism never justifies changing the original pose or adding styling items.
- **CUSTOM INSTRUCTION**: ${customPrompt ? `"${customPrompt}"` : 'Ensure maximum realism and commercial polish.'}
- **QUALITY**: ${qualityInstruction}

**OUTPUT**:
- Generate **ONE** photo-realistic final try-on image.
- ${isCroppingLocked ? 'The output must have the same framing, subject scale, visible body range, and boundary intersections as Image 1.' : 'Compose a natural complete fashion image.'}
- When Image 1 exists, preserve its pose and all non-requested content exactly. Do not add any item that is absent from both Image 1 and the role-labeled references.
- Do NOT output text. Just the final image.
`;

  const parts: any[] = [];
  parts.push({ text: prompt });

  // Image 1 is the edit target so image models anchor composition and pose to it.
  if (modelReference) {
    parts.push({
      inlineData: { mimeType: modelReference.mime, data: modelReference.base64 }
    });
  }

  for (const img of productImages) {
    parts.push({
      inlineData: { mimeType: img.mime, data: img.base64 }
    });
  }

  const runGeneration = async (modelName: string) => {
    console.log(`[UniversalTryOn] Generating subMode=${subMode}, model=${modelName}, Aspect=${aspectRatio}, Res=${resolution}`);
    const runtimeModel = imageApiConfig.isXiaoche
      ? resolveXiaocheImageModel(modelName, aspectRatio, resolution)
      : resolveRuntimeModelId(modelName, imageApiConfig);

    const config: any = {
      temperature: 0.1,
      safetySettings: GLOBAL_SAFETY_SETTINGS,
      responseModalities: [Modality.IMAGE],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution,
      }
    };
    // A local timeout cannot cancel work already accepted by a relay and may still be billed.
    // Keep enough headroom for 4K delivery so the browser does not abandon a valid late response.
    const receiveTimeoutMs = resolution === ImageResolution.RES_4K ? 600000 : 420000;

    const response: any = await executeWithTimeout(
      ai.models.generateContent({
        model: runtimeModel,
        contents: [{ role: "user", parts }],
        config,
      }),
      {
        timeoutMs: receiveTimeoutMs,
        timeoutMessage: `中转在 ${Math.round(receiveTimeoutMs / 60000)} 分钟内未返回最终响应。请求可能仍在中转后台执行，请先核对中转日志，避免立即重复提交。`,
        signal,
      }
    );

    throwIfAborted(signal);

    const images = extractGeneratedImages(response);
    if (images.length === 0) {
      throw createEmptyImageResponseError(response, runtimeModel);
    }
    return images;
  };

  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    throwIfAborted(signal);
    try {
      const batchResults = await runGeneration(model);
      results.push(...batchResults);
    } catch (error) {
      if (results.length === 0) throw error;
      console.warn(
        `[UniversalTryOn] 第 ${i + 1}/${count} 张生成异常，已保留并返回前面成功的 ${results.length} 张结果。`,
        error
      );
      break;
    }
  }

  return results;
};

