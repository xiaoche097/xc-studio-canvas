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
   * Generates an image based on the prompt.
   * INTEGRATION: Currently uses Pollinations.ai for immediate demo capability without requiring valid Imagen credentials.
   * TODO: Replace with actual DALL-E 3 / Imagen API call for production.
   */
  async generateImage(prompt: string, referenceImages: string[] = []): Promise<string> {
    console.log("Generating image for:", prompt);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // Clean prompt for URL
      const cleanPrompt = prompt.replace(/[^\w\s,]/gi, '').slice(0, 300);
      const encoded = encodeURIComponent(cleanPrompt);
      const seed = Math.floor(Math.random() * 1000000);
      
      // Use Pollinations AI (Flux model often used)
      // We append some quality boosters
      const fullUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
      
      return fullUrl;
    } catch (e) {
      console.error("Image Generation Failed:", e);
      throw new Error("Failed to generate image. Please check API configuration.");
    }
  }
}

export const gemini = new GeminiClient();
