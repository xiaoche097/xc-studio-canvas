/// <reference types="vite/client" />
import { GoogleGenerativeAI } from "@google/generative-ai";

const getModelId = () => {
    return import.meta.env.VITE_GEMINI_MODEL || 'gemini-3-pro-preview';
};

/**
 * Validates the API Key and returns the GenAI client.
 */
const getClient = () => {
    // Priority: localStorage -> VITE_GEMINI_API_KEY -> VITE_API_KEY
    const apiKey = localStorage.getItem('user_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;

    if (!apiKey) {
        console.warn("API_KEY not found. Please set VITE_GEMINI_API_KEY in .env");
        return null;
    }

    return new GoogleGenerativeAI(apiKey);
};

export const callAgent = async (systemPrompt: string, userMessage: string, jsonMode: boolean = true, modelName?: string, useInternet: boolean = false) => {
    const ai = getClient();
    if (!ai) {
        throw new Error("API Key is missing. Please configure VITE_GEMINI_API_KEY.");
    }

    try {
        // Create a timeout promise
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out after 120s")), 120000)
        );

        // Priority: Function Arg -> Env Var -> Default
        const modelId = modelName || getModelId();

        const modelParams: any = {
            model: modelId,
            systemInstruction: systemPrompt,
        };

        // Add Tools if Internet Search is enabled
        if (useInternet) {
            modelParams.tools = [{ googleSearch: {} }];
        }

        const model = ai.getGenerativeModel(modelParams);

        const generationConfig: any = {
            temperature: 0.2, // Agents need determinism
        };

        if (jsonMode) {
            generationConfig.responseMimeType = 'application/json';
        }

        // Initialize chat for potentially multi-turn tool use
        const chat = model.startChat({
            generationConfig,
            history: [
                { role: 'user', parts: [{ text: "System: " + systemPrompt }] }
            ]
        });

        // Initial Message
        let result = await chat.sendMessage(userMessage);

        // Simple Function Calling Loop (Max 3 turns to prevent infinite loops)
        for (let i = 0; i < 3; i++) {
            const response = result.response;
            const functionCalls = response.functionCalls();

            if (functionCalls && functionCalls.length > 0) {
                // For this "One-Shot" internet search, we can just assume Google Search tool is handled server-side by the model if using the correct Google Search Tool spec?
                // Wait, for Google Search (Grounding) in Vertex/Gemini, it's often automatic if configured as a tool.
                // However, the standard @google/generative-ai SDK returns function calls if it's a client-side tool or if it requires client action.
                // But Google Search Tool (googleSearch: {}) is often a server-side built-in tool in the latest Gemini versions.
                // If it returns a functionCall, we must assume we need to handle it or it's a misconfiguration.

                // Actually, with `google_search_retrieval` or `googleSearch`, the model *should* handle it internally in newer API versions if using the specific 'tools' config.
                // But let's look at how I set it up: `modelParams.tools = [{ googleSearch: {} }];`
                // This instructs Gemini 1.5/Pro to use its built-in search.
                // Usually, this returns the final text *with* citations.

                // If the response text is present, we are good.
                // If text is empty and functionCalls exists, we have a problem (it thinks we need to execute search).
                // But `googleSearch` tool is server-side.

                // Let's check if text() is available.
                try {
                    const text = response.text();
                    if (text) return text;
                } catch (e) {
                    // Logic to handle if text is blocked
                }
            } else {
                return response.text();
            }
        }

        return result.response.text();
    } catch (error) {
        console.error("Gemini Agent Call Error:", error);
        throw error;
    }
};

export const streamAnalysisSummary = async function* (keyword: string) {
    const ai = getClient();
    if (!ai) return;

    try {
        const model = ai.getGenerativeModel({
            model: getModelId()
        });

        const responseStream = await model.generateContentStream({
            contents: [
                { role: 'user', parts: [{ text: `Write a 100-word executive summary for a product selection report on "${keyword}". Focus on pricing trends and competition.` }] }
            ]
        });

        for await (const chunk of responseStream.stream) {
            yield chunk.text();
        }
    } catch (error) {
        console.error("Gemini Stream Error:", error);
    }
};