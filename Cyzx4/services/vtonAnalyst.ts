import { GoogleGenAI } from "@google/genai";
import { getApiConfig } from "../utils/apiHelpers";

/**
 * VTON Material Analyst (Pass 1 of Dual-Agent architecture)
 * Focuses on semantic understanding oflighting, identity, and fabric.
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

  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = options.type === 'global' 
    ? "Analyze these reference images. Provide a concise VTON REPORT (max 100 words) describing: 1. Model's facial shape, skin tone, hair. 2. Garment's fabric texture and fit style."
    : "Analyze this scene. Provide a concise SCENE REPORT (max 50 words) describing: 1. Lighting direction and shadow hardness. 2. Camera angle and pose.";

  const parts: any[] = images.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 }
  }));
  parts.push({ text: prompt });

  try {
    const result = await model.generateContent(parts);
    return result.response.text() || "Analysis unavailable.";
  } catch (e) {
    console.warn("[Analyst Agent] Analysis failed:", e);
    return "Analysis unavailable.";
  }
};
