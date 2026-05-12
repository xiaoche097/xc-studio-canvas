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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          responseModalities: ["IMAGE"],
          candidateCount: 1,
          imageConfig: {
              aspectRatio: options.aspectRatio,
              aspect_ratio: options.aspectRatio,
              imageSize: options.resolution || "1K"
          }
        }
      })
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
    if (!candidate) throw new Error("No image candidates returned by the model.");

    // Check for safety blocks
    if (candidate.finishReason === 'SAFETY') {
      throw new Error("图像生成被安全过滤器拦截 (Safety Filter Blocked). 请尝试调整提示词。");
    }

    // Handle different response formats (Official vs Proxy variations)
    // 1. Standard inlineData/inline_data
    // 2. Some proxies return p.image_url or p.image
    // 3. Some return p.file_data or even just p.text for base64
    const imagePart = candidate.content?.parts?.find((p: any) => 
        p.inline_data || p.inlineData || p.image_data || p.image || p.file_data || p.fileData || 
        (p.text && (p.text.length > 100 || p.text.startsWith('data:image')))
    );

    if (imagePart) {
      const dataObj = imagePart.inline_data || imagePart.inlineData || imagePart.image_data || imagePart.image || imagePart.file_data || imagePart.fileData || imagePart.text;
      
      // If dataObj is a string (e.g. some proxies return data directly or in text field)
      if (typeof dataObj === 'string') {
          const cleanStr = dataObj.trim();
          if (cleanStr.startsWith('http')) return cleanStr; // Return URL directly
          return cleanStr.startsWith('data:') ? cleanStr : `data:image/png;base64,${cleanStr}`;
      }

      const mimeType = dataObj.mime_type || dataObj.mimeType || 'image/png';
      const base64Data = dataObj.data || dataObj.base64 || dataObj.image_data || dataObj.url;
      
      if (base64Data) {
          if (typeof base64Data === 'string' && base64Data.startsWith('http')) return base64Data;
          return base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;
      }
    }

    // Fallback: search ALL parts for anything that looks like an image or large string
    for (const part of (candidate.content?.parts || [])) {
        if (part.text && part.text.length > 100) {
            const text = part.text.trim();
            if (text.startsWith('data:image')) return text;
            if (/^[A-Za-z0-9+/=]+$/.test(text.substring(0, 100))) {
                return `data:image/png;base64,${text}`;
            }
        }
    }

    throw new Error(`Candidate returned (Reason: ${candidate.finishReason}) but no image data found. Check console for structure.`);
  }
}

export const gemini = new GeminiClient();
