import { GoogleGenerativeAI } from "@google/generative-ai";
import { getApiConfig } from "../Cyzx4/utils/apiHelpers";

class GeminiClient {
  private getClient() {
    const config = getApiConfig();
    // The official SDK doesn't always handle custom base URLs well for proxies in the constructor.
    return new GoogleGenerativeAI(config.apiKey);
  }

  async generateContentStream(
    prompt: string,
    images: string[] = [],
    history: { role: string; parts: any[] }[] = [],
    systemInstruction?: string,
    modelName?: string
  ) {
    const config = getApiConfig();
    const selectedModelName = modelName || "gemini-1.5-flash";
    
    // For Proxies (Plato/Yunwu), the SDK might fail if it hardcodes the Google URL.
    // However, if the user has configured it in Settings, we should honor it.
    
    const genAI = new GoogleGenerativeAI(config.apiKey);
    
    // Some versions of @google/generative-ai support baseUrl in the second argument of getGenerativeModel
    // If not, we might need a manual fetch implementation for proxies.
    const model = genAI.getGenerativeModel({
      model: selectedModelName,
      systemInstruction: systemInstruction,
    }, { 
        baseUrl: config.baseUrl?.replace(/\/$/, "") // Pass base URL if present
    } as any);

    // Prepare parts
    const parts: any[] = [{ text: prompt }];
    for (const imgData of images) {
      const match = imgData.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    // Prepare history parts correctly
    const chatHistory = history.map(h => ({
        role: h.role === 'ai' ? 'model' : 'user',
        parts: h.parts.map(p => {
            if (typeof p === 'string') return { text: p };
            return p;
        })
    }));

    const chat = model.startChat({
      history: chatHistory,
    });

    return chat.sendMessageStream(parts);
  }

  async generateImage(prompt: string, referenceImages: string[] = [], options: { aspectRatio?: string; resolution?: string; model?: string } = {}): Promise<string> {
    const config = getApiConfig();
    const activeKey = config.apiKey;
    const baseUrl = (config.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");

    let finalPrompt = prompt;
    if (options.aspectRatio) {
      finalPrompt = `Aspect Ratio ${options.aspectRatio}. ${finalPrompt}`;
    }

    const contents = [
      {
        parts: [
          { text: finalPrompt }
        ]
      }
    ];

    if (referenceImages && referenceImages.length > 0) {
      for (const imgData of referenceImages) {
        const match = imgData.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          contents[0].parts.push({
            inline_data: {
              mime_type: match[1],
              data: match[2]
            }
          } as any);
        }
      }
    }

    // Model Routing logic
    // Default to gpt-image-2 as requested for quality
    const imageModel = options.model || "gpt-image-2"; 
    
    // Some proxies use v1/models/ or v1beta/models/
    // We try to stick to the configured version in apiHelpers if possible
    const apiVersion = config.apiVersion || 'v1beta';
    const url = `${baseUrl}/${apiVersion}/models/${imageModel}:generateContent?key=${activeKey}`;

    console.log(`[ImageGen] Using Model: ${imageModel}, URL: ${url}`);

    // Build the request body with both camelCase and snake_case for proxy compatibility
    const requestBody: any = {
        contents: contents,
        generationConfig: {
            // Both TEXT and IMAGE modalities - some proxies require both
            responseModalities: ["TEXT", "IMAGE"],
            response_modalities: ["TEXT", "IMAGE"],
            candidateCount: 1,
        }
    };

    // Add image-specific config if aspect ratio is set
    if (options.aspectRatio) {
        requestBody.generationConfig.imageConfig = {
            aspectRatio: options.aspectRatio,
            aspect_ratio: options.aspectRatio,
        };
        requestBody.generationConfig.image_generation_config = {
            aspect_ratio: options.aspectRatio,
        };
    }

    console.log("[ImageGen] Request Body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const txt = await response.text();
      let errorInfo = txt;
      try {
        const errJson = JSON.parse(txt);
        errorInfo = errJson.error?.message || txt;
      } catch(e) {}
      throw new Error(`API Error ${response.status}: ${errorInfo}`);
    }

    const data = await response.json();
    console.log("[ImageGen] Full API Response:", JSON.stringify(data, null, 2));

    const candidate = data.candidates?.[0];
    console.log("[ImageGen] Top-level keys in response:", Object.keys(data));
    if (data.candidates) console.log("[ImageGen] Candidate keys:", Object.keys(data.candidates[0]));
    if (candidate?.content) console.log("[ImageGen] Content keys:", Object.keys(candidate.content));
    
    // Recursive search for image data in the entire response
    const findImageData = (obj: any, depth = 0): string | null => {
        if (!obj || typeof obj !== 'object' || depth > 5) return null;
        
        // Check standard and common proxy keys
        const keys = [
            'inline_data', 'inlineData', 'image_data', 'image_url', 'image', 
            'url', 'file_data', 'fileData', 'data', 'predictions', 'results',
            'base64', 'content', 'parts', 'b64_json', 'image_b64'
        ];
        for (const key of keys) {
            const val = obj[key];
            if (val) {
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    if (trimmed.startsWith('data:image')) return trimmed;
                    if (trimmed.startsWith('http')) return trimmed;
                    if (trimmed.length > 500 && /^[A-Za-z0-9+/=]+$/.test(trimmed.substring(0, 100))) {
                        return `data:image/png;base64,${trimmed}`;
                    }
                } else if (val.data || val.base64 || val.url) {
                    const nested = val.data || val.base64 || val.url;
                    if (typeof nested === 'string') {
                        if (nested.startsWith('http')) return nested;
                        return nested.startsWith('data:') ? nested : `data:image/png;base64,${nested}`;
                    }
                }
            }
        }
        
        // 2. Check text fields for embedded image URLs (proxy returns URLs in text)
        if (obj.text && typeof obj.text === 'string') {
            const text = obj.text.trim();
            
            // First check: pure base64 data
            if (text.startsWith('data:image')) return text;
            if (text.length > 500 && /^[A-Za-z0-9+/=]+$/.test(text.substring(0, 100))) {
                return `data:image/png;base64,${text}`;
            }
            
            // Second check: extract image URLs from text (proxy embeds URLs in markdown or plain text)
            const urlMatch = text.match(/https?:\/\/[^\s\)\"\']+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s\)\"\']*)?/i);
            if (urlMatch) {
                console.log("[ImageGen] Found image URL in text:", urlMatch[0]);
                return urlMatch[0];
            }
        }
        
        // 3. Recurse into arrays and objects
        for (const k in obj) {
            if (obj[k] && typeof obj[k] === 'object') {
                const found = findImageData(obj[k], depth + 1);
                if (found) return found;
            }
        }
        
        return null;
    };

    const imageResult = findImageData(data, 0);
    if (imageResult) return imageResult;

    // Final fallback: check for any text-based error messages in parts
    const firstPartText = candidate?.content?.parts?.[0]?.text;
    if (firstPartText && firstPartText.length < 500) {
        console.warn("[ImageGen] Potential error text found in response:", firstPartText);
    }

    throw new Error(`无法从 API 响应中提取图像数据。原因: ${candidate?.finishReason || 'UNKNOWN'}。${firstPartText ? `模型回复: "${firstPartText.substring(0, 100)}..."` : '未找到任何有效内容。'}`);
  }
}

export const gemini = new GeminiClient();
