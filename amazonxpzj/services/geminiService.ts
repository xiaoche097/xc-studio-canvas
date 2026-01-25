import { GoogleGenAI } from "@google/genai";

/* 
  NOTE: This file follows the specific @google/genai coding guidelines.
  To enable real AI features:
  1. Add your API_KEY to environment variables.
  2. Replace the Mock Logic in `stores/analysisStore.ts` with calls to these functions.
*/

const getClient = () => {
    // Ideally from process.env.API_KEY, but checking existence first
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("API_KEY not found in environment. Real Gemini calls will fail.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const generateMarketAnalysis = async (keyword: string, country: string) => {
    const ai = getClient();
    if (!ai) return null;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze the market opportunity for "${keyword}" in ${country}. Return JSON data for metrics, product highlights, and a summary.`,
            config: {
                responseMimeType: 'application/json'
            }
        });
        return response.text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};

export const streamAnalysisSummary = async function* (keyword: string) {
    const ai = getClient();
    if (!ai) return;

    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: `Write a 100-word executive summary for a product selection report on "${keyword}". Focus on pricing trends and competition.`,
        });

        for await (const chunk of responseStream) {
            yield chunk.text;
        }
    } catch (error) {
        console.error("Gemini Stream Error:", error);
    }
};