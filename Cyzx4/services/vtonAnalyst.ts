import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { getApiConfig } from "../utils/apiHelpers";

/**
 * VTON Material Analyst (Pass 1 of Dual-Agent architecture)
 * Focuses on semantic understanding of lighting, identity, and fabric.
 */
export const analyzeVtonMaterials = async (
  images: { base64: string; mimeType: string }[],
  options: { 
    type: 'global' | 'target'; 
  }
): Promise<string> => {
  const config = getApiConfig();
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: config.isYunwu ? { 
      baseUrl: config.baseUrl,
      headers: { Authorization: `Bearer ${config.apiKey}` }
    } : undefined,
    apiVersion: config.apiVersion as any
  });

  const prompt = options.type === 'global' 
    ? "Analyze these reference images. Provide a detailed VTON REPORT (max 200 words) describing: 1. Model's facial shape, skin tone, hair. 2. Garment's precise COLOR, PRINTS, PATTERNS, LOGOS, and graphic designs. 3. STRUCTURAL FEATURES: Explicitly identify the NECKLINE (MUST specify if it has visible stitching lines/车缝线 or is seamless/无痕), SLEEVE TYPE, and HEM LENGTH (MUST specify if it is a 'cropped waist', and whether it is a full crop/high crop or partial crop/low crop). 4. Fabric texture and fit style. 5. Identify the dominant color temperature. CRITICAL: Avoid NSFW terms like 'navel', 'underwear', 'panties'. Use safe terms like 'midriff', 'cropped waist', 'swimwear bottom'."
    : "Analyze this scene. Provide a concise SCENE REPORT (max 100 words) describing: 1. Lighting direction and shadow hardness. 2. Camera angle and pose. 3. Identify the original clothing's color and texture (to be replaced). 4. Explicitly identify the WHITE BALANCE and COLOR TEMPERATURE of this scene.";

  const parts: any[] = images.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 }
  }));
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: { parts },
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });
    return response.text || "Analysis unavailable.";
  } catch (e) {
    console.warn("[Analyst Agent] Analysis failed:", e);
    return "Analysis unavailable.";
  }
};

export interface GarmentAnalysisResult {
  fit: string;
  length: string;
  neckline: string;
  cuffs_sleeves: string;
  wearing_effect: string;
  engineered_prompt: string;
  negative_prompt_additions?: string;
}

/**
 * Advanced Garment Feature Analyst
 * Extracts precise structural attributes (Fit, Length, Neckline, Cuffs) from target garment.
 */
export const analyzeGarmentFeatures = async (
  images: { base64: string; mimeType: string }[],
  userGuidance: string
): Promise<GarmentAnalysisResult | null> => {
  const config = getApiConfig();
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: config.isYunwu ? { 
      baseUrl: config.baseUrl,
      headers: { Authorization: `Bearer ${config.apiKey}` }
    } : undefined,
    apiVersion: config.apiVersion as any
  });

  const prompt = `
**ROLE**: Top-tier Fashion Technical Designer & AI Prompt Engineer.

**YOUR TASK**: Analyze the provided garment images (which may show different angles/details of the same garment) and extract its precise structural features. The user wants to replace an existing garment with this one, and might have provided a supplementary note (user guidance) indicating slight changes they want (e.g. "make the neckline a V-neck", "shorten the length").

**USER GUIDANCE (HIGH PRIORITY)**: "${userGuidance || 'No supplementary notes. Analyze the garment as is.'}"

**CRITICAL INSTRUCTIONS**:
1. If the user guidance specifies a change (e.g., "V-neck instead of round"), you MUST incorporate that change into your analysis.
2. Be extremely precise. Don't just say "dress", say "A-line midi dress with slight flare".

**OUTPUT FORMAT (MANDATORY JSON)**:
{
  "fit": "Describe the fit/silhouette (e.g., Slim fit, Oversized, A-line, Bodycon).",
  "length": "Describe the length. **CRITICAL**: You MUST explicitly state if it is a 'cropped waist' (meaning the midriff is visible). If so, specify if it is a 'high crop' (full midriff exposed) or 'low crop' (partial midriff exposed). DO NOT use the words 'navel' or 'bare stomach' as they trigger safety filters.",
  "neckline": "Describe the neckline/collar. **CRITICAL**: You MUST explicitly state if the neckline has visible stitching lines (车缝线) or if it is seamless/no-stitch (无痕/无车缝线).",
  "cuffs_sleeves": "Describe the sleeves and cuffs (e.g., Sleeveless, Long sleeves with ribbed cuffs, Puff sleeves).",
  "wearing_effect": "Describe how it should look when worn (e.g., Draped elegantly, tight and contouring, relaxed and baggy).",
  "engineered_prompt": "A concise, comma-separated list of ONLY the garment's structural features and the user's requested changes, optimized for an image generation prompt. DO NOT include color unless specified by the user. AVOID unsafe terms ('navel', 'underwear'). Use 'midriff', 'cropped waist', 'swimwear bottom' instead. Example: 'slim fit ribbed knit top, deep v-neck, long sleeves with thumb holes, low cropped waist length, tight bodycon fit'.",
  "negative_prompt_additions": "A comma-separated list of strictly banned elements based on the features. For example, if it is seamless, output 'stitching, visible seams, thread lines'. If it is a low crop, output 'high crop, full midriff exposed'. Leave empty if none."
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: {
        parts: [
          ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
          { text: prompt }
        ]
      },
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text) as GarmentAnalysisResult;
  } catch (e) {
    console.error("[Garment Analyst Agent] Analysis failed:", e);
    return null;
  }
};
