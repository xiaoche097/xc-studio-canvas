import { GoogleGenerativeAI } from "@google/generative-ai";
import { getApiConfig, getImageApiConfig, resolveRuntimeModelId } from "../Cyzx4/utils/apiHelpers";
import { resolveXiaocheImageModel } from "../Cyzx4/utils/xiaocheModels";

const toOpenAiContent = (text: string, images: string[] = []) => {
  const content: any[] = [];
  if (text) {
    content.push({ type: "text", text });
  }
  images.forEach(img => {
    content.push({
      type: "image_url",
      image_url: { url: img }
    });
  });
  return content.length === 1 && content[0].type === "text" ? content[0].text : content;
};

const partsToOpenAiContent = (parts: any[] = []) => {
  const content: any[] = [];
  parts.forEach(part => {
    if (typeof part?.text === "string" && part.text.length > 0) {
      content.push({ type: "text", text: part.text });
      return;
    }
    const inlineData = part?.inlineData || part?.inline_data;
    if (inlineData?.data) {
      const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
      const url = String(inlineData.data).startsWith("data:")
        ? inlineData.data
        : `data:${mimeType};base64,${inlineData.data}`;
      content.push({ type: "image_url", image_url: { url } });
    }
  });
  return content.length === 1 && content[0].type === "text" ? content[0].text : content;
};

async function* parseRunningHubSseStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const event of events) {
      const dataLines = event
        .split(/\r?\n/)
        .filter(line => line.startsWith("data:"))
        .map(line => line.replace(/^data:\s*/, ""));

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === "[DONE]") continue;
        try {
          const data = JSON.parse(dataLine);
          const text = data?.choices?.[0]?.delta?.content || "";
          if (text) {
            yield { text: () => text };
          }
        } catch {
          // Ignore malformed keepalive chunks.
        }
      }
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const dataLine = tail.replace(/^data:\s*/, "");
    if (dataLine && dataLine !== "[DONE]") {
      try {
        const data = JSON.parse(dataLine);
        const text = data?.choices?.[0]?.delta?.content || "";
        if (text) {
          yield { text: () => text };
        }
      } catch {
        // Ignore malformed trailing chunks.
      }
    }
  }
}

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
    const selectedModelName = resolveRuntimeModelId(modelName || "gemini-1.5-flash", config);

    if (config.isRunningHub) {
      const baseUrl = (config.baseUrl || "https://www.runninghub.cn").replace(/\/$/, "");
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      history.forEach(h => {
        messages.push({
          role: h.role === "model" || h.role === "ai" ? "assistant" : "user",
          content: partsToOpenAiContent(h.parts)
        });
      });
      messages.push({
        role: "user",
        content: toOpenAiContent(prompt, images)
      });

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModelName,
          stream: true,
          messages,
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`RunningHub Chat API Error ${response.status}: ${txt}`);
      }

      return { stream: parseRunningHubSseStream(response) };
    }
    
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
    const config = getImageApiConfig();
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
    const requestedImageModel = options.model || "gpt-image-2";
    const imageModel = config.isXiaoche
      ? resolveXiaocheImageModel(requestedImageModel, options.aspectRatio || '1:1', options.resolution || '1K')
      : resolveRuntimeModelId(requestedImageModel, config);

    if (config.isRunningHub) {
      const openAiImageSize = (() => {
        if (options.aspectRatio === '16:9' || options.aspectRatio === '4:3') return '1536x1024';
        if (options.aspectRatio === '9:16' || options.aspectRatio === '3:4') return '1024x1536';
        return '1024x1024';
      })();
      const runningHubUrl = `${baseUrl}/v1/images/generations`;
      const response = await fetch(runningHubUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: finalPrompt,
          n: 1,
          size: openAiImageSize,
          response_format: "url",
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        let errorInfo = txt;
        try {
          const errJson = JSON.parse(txt);
          errorInfo = errJson.error?.message || txt;
        } catch(e) {}
        throw new Error(`RunningHub API Error ${response.status}: ${errorInfo}`);
      }

      const data = await response.json();
      const image = data.data?.[0];
      const base64Data = image?.b64_json || image?.base64 || image?.image;
      const imageUrl = image?.url || image?.image_url;

      if (base64Data) {
        return base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
      }
      if (typeof imageUrl === 'string') {
        return imageUrl;
      }

      throw new Error("RunningHub returned no image data.");
    }
    
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

  updateApiKey(key: string, baseUrl?: string) {
    // This method is deprecated because the client now dynamically reads settings via getApiConfig().
    // Retained for backward compatibility.
  }
}

export const gemini = new GeminiClient();
