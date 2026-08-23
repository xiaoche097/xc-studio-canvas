import { HarmCategory, HarmBlockThreshold } from "@google/genai";
import { generateContentWithAnalysisFallback, getAiClient, DEFAULT_TEXT_MODEL } from "../utils/apiHelpers";

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
  const ai = getAiClient();

  const prompt = options.type === 'global' 
    ? "Analyze these reference images. Provide a detailed VTON REPORT (max 200 words) describing: 1. Model's facial shape, skin tone, hair. 2. Garment's precise COLOR, PRINTS, PATTERNS, LOGOS, and graphic designs. 3. STRUCTURAL FEATURES: Explicitly identify the NECKLINE (MUST specify if it has visible stitching lines/车缝线 or is seamless/无痕), SLEEVE TYPE, and HEM LENGTH (MUST specify if it is a 'cropped waist', and whether it is a full crop/high crop or partial crop/low crop). 4. Fabric texture and fit style. 5. Identify the dominant color temperature. CRITICAL: Avoid NSFW terms like 'navel', 'underwear', 'panties'. Use safe terms like 'midriff', 'cropped waist', 'swimwear bottom'."
    : "Analyze this scene. Provide a concise SCENE REPORT (max 100 words) describing: 1. Lighting direction and shadow hardness. 2. Camera angle and pose. 3. Identify the original clothing's color and texture (to be replaced). 4. Explicitly identify the WHITE BALANCE and COLOR TEMPERATURE of this scene.";

  const parts: any[] = images.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 }
  }));
  parts.push({ text: prompt });

  try {
    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL,
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
  perspective?: 'A' | 'B' | 'C' | 'D' | 'E' | 'RETOUCH'; // Detected angle key
}

/**
 * Advanced Garment Feature Analyst
 * Extracts precise structural attributes (Fit, Length, Neckline, Cuffs) from target garment.
 */
export const analyzeGarmentFeatures = async (
  images: { base64: string; mimeType: string }[],
  userGuidance: string
): Promise<GarmentAnalysisResult | null> => {
  const ai = getAiClient();

  const prompt = `
**ROLE**: Top-tier Fashion Technical Designer & AI Prompt Engineer.

**YOUR TASK**: Analyze the provided garment images (which may show different angles/details of the same garment) and extract its precise structural features and primary camera perspective/angle. The user wants to replace an existing garment with this one, and might have provided a supplementary note (user guidance) indicating slight changes they want.

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
  "engineered_prompt": "A concise, comma-separated list of ONLY the garment's structural features and the user's requested changes, optimized for an image generation prompt. DO NOT include color unless specified by the user. AVOID unsafe terms ('navel', 'underwear'). Use 'midriff', 'cropped waist', 'swimwear bottom' instead.",
  "negative_prompt_additions": "A comma-separated list of strictly banned elements based on the features. For example, if it is seamless, output 'stitching, visible seams, thread lines'. If it is a low crop, output 'high crop, full midriff exposed'. Leave empty if none.",
  "perspective": "Determine the primary viewpoint/angle shown. It MUST be exactly one of: 'A' (left-front 45 / 左前 45°), 'B' (front view / 正面), 'C' (right-front 45 / 右前 45°), 'D' (side profile / 侧面), 'E' (back view / 背面), 'RETOUCH' (close-up/details / 特写). E.g. if back of garment is shown, choose 'E'."
}
`;

  try {
    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL,
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

/**
 * General Image Perspective Analyst
 * Determines the perspective/angle of any target image (e.g., model image)
 */
export const analyzeImagePerspective = async (
  image: { base64: string; mimeType: string }
): Promise<'A' | 'B' | 'C' | 'D' | 'E' | 'RETOUCH' | null> => {
  const ai = getAiClient();

  const prompt = `
**ROLE**: Top-tier Fashion Photography Perspective Analyst.

**TASK**: Analyze the human model or clothing item in the provided image. Determine its primary camera perspective / angle of view.

**AVAILABLE PERSPECTIVES**:
- "A": Left-front 45° (3/4 front-left / 左前 45°) - Model is facing slightly to their left relative to the camera.
- "B": Front view (正面) - Model is facing straight towards the camera.
- "C": Right-front 45° (3/4 front-right / 右前 45°) - Model is facing slightly to their right relative to the camera.
- "D": Side profile (侧面) - Model is standing at a 90-degree angle to the camera, showing a clear side profile.
- "E": Back view (背面) - Model is facing completely away from the camera, showing their back.
- "RETOUCH": Detail close-up / Macro view / Extreme close-up / Fabric shot (特写 / 局部精修).

**CRITICAL GUIDELINES**:
- If the image primarily shows the BACK of a person or garment (e.g., neck collar is high, no buttons, back seams), choose "E" (Back view).
- If the image primarily shows the FRONT of the garment or model, choose "B" (Front view) or "A"/"C" if it's clearly at a 45-degree angle.
- If it is a flat lay or isolated close-up of a collar, sleeve, or fabric texture, choose "RETOUCH".

**OUTPUT FORMAT (MANDATORY JSON)**:
{
  "perspective": "A" or "B" or "C" or "D" or "E" or "RETOUCH",
  "reasoning": "A concise explanation of why this perspective was chosen."
}
`;

  try {
    const response = await generateContentWithAnalysisFallback(ai, {
      model: DEFAULT_TEXT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.base64 } },
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
    const result = JSON.parse(text);
    return result.perspective as 'A' | 'B' | 'C' | 'D' | 'E' | 'RETOUCH';
  } catch (e) {
    console.error("[Perspective Analyst] Analysis failed:", e);
    return null;
  }
};

