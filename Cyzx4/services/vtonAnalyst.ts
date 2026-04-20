import { GoogleGenAI } from "@google/genai";
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
    httpOptions: config.isYunwu ? { baseUrl: config.baseUrl } : undefined,
    apiVersion: config.apiVersion as any
  });

  const prompt = options.type === 'global' 
    ? "Analyze these reference images. Provide a detailed VTON REPORT (max 200 words) describing: 1. Model's facial shape, skin tone, hair. 2. Garment's precise COLOR, PRINTS, PATTERNS, LOGOS, and graphic designs (describe any shapes or artwork on the clothes in detail). 3. STRUCTURAL FEATURES: Explicitly identify the NECKLINE (e.g. V-neck, crew, scoop), SLEEVE TYPE (e.g. sleeveless, short, long, puff), and HEM LENGTH (e.g. mini, midi, maxi). 4. Fabric texture and fit style. 5. Identify the dominant color temperature."
    : "Analyze this scene. Provide a concise SCENE REPORT (max 100 words) describing: 1. Lighting direction and shadow hardness. 2. Camera angle and pose. 3. Identify the original clothing's color and texture (to be replaced). 4. Explicitly identify the WHITE BALANCE and COLOR TEMPERATURE of this scene.";

  const parts: any[] = images.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 }
  }));
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: { parts }
    });
    return response.text || "Analysis unavailable.";
  } catch (e) {
    console.warn("[Analyst Agent] Analysis failed:", e);
    return "Analysis unavailable.";
  }
};
