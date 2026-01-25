/// <reference types="vite/client" />
import { GoogleGenAI } from "@google/genai";

const getModelId = () => {
    return import.meta.env.VITE_GEMINI_MODEL || 'gemini-3-pro-preview';
};

/**
 * Validates the API Key and returns the GenAI client.
 */
const getClient = () => {
    // Priority: VITE_GEMINI_API_KEY (User's preferred) -> VITE_API_KEY -> process.env
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : undefined);
    
    if (!apiKey) {
        console.warn("API_KEY not found. Please set VITE_GEMINI_API_KEY in .env");
        return null;
    }
    
    return new GoogleGenAI({ apiKey });
};

/**
 * Helper to get text from response safely (handling getter vs method differences in SDK versions)
 */
const getText = (response: any) => {
    const text = response.text;
    return typeof text === 'function' ? text.call(response) : text;
};

export const callAgent = async (systemPrompt: string, userMessage: string, jsonMode: boolean = true) => {
    const ai = getClient();
    if (!ai) {
        throw new Error("API Key is missing. Please configure VITE_GEMINI_API_KEY.");
    }

    try {
        const response = await ai.models.generateContent({
            model: getModelId(),
            contents: [
                { role: 'system', parts: [{ text: systemPrompt }] },
                { role: 'user', parts: [{ text: userMessage }] }
            ],
            config: {
                responseMimeType: jsonMode ? 'application/json' : 'text/plain',
                temperature: 0.2 // Agents need determinism
            }
        });
        
        return getText(response);
    } catch (error) {
        console.error("Gemini Agent Call Error:", error);
        throw error;
    }
};

export const streamAnalysisSummary = async function* (keyword: string) {
    const ai = getClient();
    if (!ai) return;

    try {
        const responseStream = await ai.models.generateContentStream({
            model: getModelId(),
            contents: [
                { role: 'user', parts: [{ text: `Write a 100-word executive summary for a product selection report on "${keyword}". Focus on pricing trends and competition.` }] }
            ]
        });

        for await (const chunk of responseStream) {
            yield getText(chunk);
        }
    } catch (error) {
        console.error("Gemini Stream Error:", error);
    }
};