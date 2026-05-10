import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing VITE_GEMINI_API_KEY in environment variables");
}

class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private textModel: GenerativeModel;
  private baseUrl: string;

  constructor() {
    const storedKey = localStorage.getItem('user_gemini_api_key');
    const storedUrl = localStorage.getItem('user_gemini_base_url') || "https://generativelanguage.googleapis.com";
    
    this.baseUrl = storedUrl;
    this.genAI = new GoogleGenerativeAI(storedKey || apiKey || "");

    this.textModel = this.genAI.getGenerativeModel({
      model: import.meta.env.VITE_GEMINI_MODEL || "gemini-3-pro-preview"
    });
  }

  updateApiKey(newKey: string, newUrl?: string) {
    if (newUrl) {
      this.baseUrl = newUrl;
    }
    this.genAI = new GoogleGenerativeAI(newKey);
    this.textModel = this.genAI.getGenerativeModel({
      model: import.meta.env.VITE_GEMINI_MODEL || "gemini-3-pro-preview"
    });
  }

  async generateContentStream(
    prompt: string,
    images: string[] = [],
    history: { role: string; parts: ({ text: string } | { inlineData: any })[] }[] = [],
    systemInstruction?: string,
    modelName?: string
  ) {
    const selectedModelName = modelName || import.meta.env.VITE_GEMINI_MODEL || "gemini-3-pro-preview";

    const model = systemInstruction
      ? this.genAI.getGenerativeModel({
        model: selectedModelName,
        systemInstruction: systemInstruction,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        }
      })
      : this.genAI.getGenerativeModel({
        model: selectedModelName,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        }
      });

    // Start a chat session with history
    const chatSession = model.startChat({
      history: history
    });

    // Construct current message parts
    const currentMessageParts: any[] = [{ text: prompt }];

    for (const imgData of images) {
      // Expecting data:image/png;base64,.....
      const match = imgData.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        currentMessageParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    return chatSession.sendMessageStream(currentMessageParts);
  }

  async generateImagePreview(prompt: string) {
    // In a client-side demo, we can't easily call a secure image API if it requires different auth.
    // For now we simulate or use the text model to describe the image.
    // Or if the user really has "gemini-3-pro-image-preview" accessible via same key:
    /*
    const model = this.genAI.getGenerativeModel({ 
       model: import.meta.env.VITE_GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview" 
    });
    */
    // For safety in this demo step, let's return a mock or description.
    return { url: "https://placehold.co/600x400?text=Gemini+Preview+" + encodeURIComponent(prompt.slice(0, 10)) };
  }

  /**
   * Generates an image using the native Gemini 3 Pro Image Preview model.
   * STRICTLY uses 'gemini-3-pro-image-preview' as requested.
   */
  async generateImage(prompt: string, referenceImages: string[] = [], options: { aspectRatio?: string; resolution?: string } = {}): Promise<string> {
    console.log(`Generating image. Prompt len: ${prompt.length}. User Images: ${referenceImages.length}. Aspect: ${options.aspectRatio}. Res: ${options.resolution}`);

    // If getApiKey is not exposed (private), use our stored one or import.meta.env
    const activeKey = localStorage.getItem('user_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;

    if (!activeKey) throw new Error("API Key not found for Image Generation");

    // Enhance prompt with aspect ratio (always good for guidance)
    let finalPrompt = prompt;
    if (options.aspectRatio) {
      finalPrompt = `Aspect Ratio ${options.aspectRatio}. ${finalPrompt}`;
    }

    // Construct Multimedia Content
    const contents = [
      {
        parts: [
          { text: finalPrompt }
        ]
      }
    ];

    // Add Reference Images if any
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

    const imageModel = import.meta.env.VITE_GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";
    const cleanBaseUrl = this.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    const url = `${cleanBaseUrl}/v1beta/models/${imageModel}:generateContent?key=${activeKey}`;

    // Helper to build configuration
    const buildConfig = (isAdvanced: boolean) => {
      const config: any = {
        responseModalities: ["IMAGE"],
        candidateCount: 1
      };

      if (isAdvanced) {
        const imageConfig: any = {};
        // Aspect Ratio
        if (options.aspectRatio) {
          imageConfig.aspectRatio = options.aspectRatio;
        }
        // Resolution (Image Size) - STRICT Uppercase
        if (options.resolution) {
          const validSizes = ["1K", "2K", "4K"];
          const upperRes = options.resolution.toUpperCase();
          if (validSizes.includes(upperRes)) {
            imageConfig.imageSize = upperRes;
          }
        }

        // Only attach imageConfig if it has properties
        if (Object.keys(imageConfig).length > 0) {
          config.imageConfig = imageConfig;
        }
      }
      return config;
    };

    const makeRequest = async (config: any) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          generationConfig: config,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
          ]
        })
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`API Error ${response.status}: ${txt}`);
      }
      return response.json();
    };

    let data;
    try {
      // 1. Attempt with Advanced Config
      const advancedConfig = buildConfig(true);
      console.log(`Attempting Generation with Model ${imageModel} & Config:`, JSON.stringify(advancedConfig));
      data = await makeRequest(advancedConfig);
    } catch (e: any) {
      console.warn("Advanced Image Gen Config failed, attempting fallback to basic config...", e.message);

      // 2. Fallback Mechanism: Retry with minimal config (no imageConfig)
      // This handles cases where 2K/4K/AspectRatio might be rejected or model is busy
      const basicConfig = buildConfig(false);
      data = await makeRequest(basicConfig);
    }

    // Process Response
    console.log("Gemini Image Gen Response:", data);
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned. Response: " + JSON.stringify(data));

    if (candidate.finishReason !== "STOP" && candidate.finishReason !== undefined) {
      throw new Error(`Generation stopped: ${candidate.finishReason}.`);
    }

    const imagePart = candidate.content?.parts?.find((p: any) => p.inline_data || p.inlineData || p.image_data);
    if (imagePart) {
      const dataObj = imagePart.inline_data || imagePart.inlineData;
      const mimeType = dataObj.mime_type || dataObj.mimeType || 'image/png';
      return `data:${mimeType};base64,${dataObj.data}`;
    }

    throw new Error("No image data found in response.");
  }
}

export const gemini = new GeminiClient();
