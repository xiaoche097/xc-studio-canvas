import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing VITE_GEMINI_API_KEY in environment variables");
}

class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private textModel: GenerativeModel;
  // private imageModel: GenerativeModel; 

  constructor() {
    const storedKey = localStorage.getItem('user_gemini_api_key');
    this.genAI = new GoogleGenerativeAI(storedKey || apiKey || "");
    
    this.textModel = this.genAI.getGenerativeModel({ 
      model: import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-pro-latest" 
    });
  }

  updateApiKey(newKey: string) {
    this.genAI = new GoogleGenerativeAI(newKey);
    this.textModel = this.genAI.getGenerativeModel({
      model: import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-pro-latest"
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
            maxOutputTokens: 4096,
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
          }
        })
      : this.genAI.getGenerativeModel({
          model: selectedModelName,
          generationConfig: {
            maxOutputTokens: 4096,
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
    return { url: "https://placehold.co/600x400?text=Gemini+Preview+" + encodeURIComponent(prompt.slice(0,10)) };
  }

  /**
   * Generates an image using the native Gemini 3 Pro Image Preview model.
   * STRICTLY uses 'gemini-3-pro-image-preview' as requested.
   */
  async generateImage(prompt: string, referenceImages: string[] = []): Promise<string> {
    console.log("Generating image with gemini-3-pro-image-preview for:", prompt);
    
    
    // If getApiKey is not exposed (private), use our stored one or import.meta.env
    // But this.genAI was init with key. 
    // We'll trust import.meta.env.VITE_GEMINI_API_KEY or localStorage for this specific call 
    // if we can't extract it from the instance easily without type hacking.
    const activeKey = localStorage.getItem('user_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;

    if (!activeKey) throw new Error("API Key not found for Image Generation");

    // Construct Multimedia Content
    const contents = [
      {
        parts: [
          { text: prompt }
        ]
      }
    ];

    // Add Reference Images if any
    if (referenceImages && referenceImages.length > 0) {
       for (const imgData of referenceImages) {
          const match = imgData.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
             // For REST API, inline data format
             // The structure might need to be specific for the model type, 
             // but usually it's inline_data
             // However, for generateContent endpoint:
             contents[0].parts.push({
                inline_data: { // Note snake_case for REST JSON
                    mime_type: match[1],
                    data: match[2]
                }
             } as any);
          }
       }
    }

    try {
      // Direct REST call to support 'response_modalities' which might be missing in some SDK versions
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${activeKey}`;
      
      const response = await fetch(url, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            contents: contents,
            generationConfig: {
                 // Try camelCase attributes for JSON API conformance
                 responseModalities: ["IMAGE"],
                 temperature: 0.9,
                 candidateCount: 1
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
         })
      });

      if (!response.ok) {
          const errText = await response.text();
          console.error("Gemini API Error details:", errText);
          throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      console.log("Gemini Image Gen Response:", data);
      
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error("No candidates returned. Response: " + JSON.stringify(data));

      if (candidate.finishReason !== "STOP" && candidate.finishReason !== undefined) {
          throw new Error(`Generation stopped: ${candidate.finishReason}. Response: ${JSON.stringify(data)}`);
      }

      const imagePart = candidate.content?.parts?.find((p: any) => p.inline_data || p.image_data);
      
      if (imagePart && imagePart.inline_data) {
          const mimeType = imagePart.inline_data.mime_type || 'image/png';
          const base64Data = imagePart.inline_data.data;
          return `data:${mimeType};base64,${base64Data}`;
      }
      
      const textPart = candidate.content?.parts?.find((p: any) => p.text);
      
      // Dump full content for debugging
      throw new Error(`No image data found. Content: ${JSON.stringify(candidate.content)}. Full: ${JSON.stringify(data)}`);


    } catch (e: any) {
      console.error("Gemini Image Gen Failed:", e);
      throw new Error(e.message || "Failed to generate image with Gemini");
    }
  }
}

export const gemini = new GeminiClient();
