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

    // Handle different response formats (Official vs Proxy variations)
    // 1. Standard inlineData/inline_data
    // 2. Some proxies return p.image_url or p.image
    // 3. Some return p.file_data
    const imagePart = candidate.content?.parts?.find((p: any) => 
        p.inline_data || p.inlineData || p.image_data || p.image || p.file_data || p.fileData
    );

    if (imagePart) {
      const dataObj = imagePart.inline_data || imagePart.inlineData || imagePart.image_data || imagePart.image || imagePart.file_data || imagePart.fileData;
      
      // If dataObj is a string (e.g. some proxies return data directly in image field)
      if (typeof dataObj === 'string') {
          return dataObj.startsWith('data:') ? dataObj : `data:image/png;base64,${dataObj}`;
      }

      const mimeType = dataObj.mime_type || dataObj.mimeType || dataObj.mime_type || 'image/png';
      const base64Data = dataObj.data || dataObj.base64 || dataObj.image_data;
      
      if (base64Data) {
          return base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;
      }
    }

    throw new Error("Candidate returned but no base64 image data found in parts. Check console for full response structure.");
  }
}

export const gemini = new GeminiClient();
