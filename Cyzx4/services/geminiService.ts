import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { AspectRatio, ImageResolution } from "../types";

// ==================== API Configuration Helper ====================
// Priority: 1. Yunwu API (base_url + key) -> 2. Native Gemini API Key -> 3. Environment Variable

interface ApiConfig {
  apiKey: string;
  baseUrl?: string;
  isYunwu: boolean;
}

// Get API configuration with priority order
// Get API configuration with priority order
const getApiConfig = (): ApiConfig => {
  // 1. Check Yunwu API configuration first
  const yunwuKey = localStorage.getItem("yunwu_api_key");
  const yunwuBaseUrl = localStorage.getItem("yunwu_base_url");
  const yunwuEnabled = localStorage.getItem("yunwu_enabled") !== "false"; // Default to true if not set

  if (yunwuKey && yunwuEnabled) {
    return {
      apiKey: yunwuKey,
      baseUrl: yunwuBaseUrl || "https://yunwu.ai",
      isYunwu: true
    };
  }

  // 2. Check native Gemini API key
  const nativeKey = localStorage.getItem("user_api_key");
  const nativeEnabled = localStorage.getItem("native_enabled") !== "false"; // Default to true if not set

  if (nativeKey && nativeEnabled) {
    return {
      apiKey: nativeKey,
      isYunwu: false
    };
  }

  // 3. Fallback to environment variable
  const envKey = process.env.API_KEY;
  if (envKey) {
    return {
      apiKey: envKey,
      isYunwu: false
    };
  }

  throw new Error("No active API configuration found. Please enable either Yunwu API or Native API in Settings.");
};

// Helper to get a fresh AI client instance.
// Supports both Yunwu API proxy and native Google Gemini API.
const getAiClient = () => {
  const config = getApiConfig();

  // If using Yunwu API, configure with custom base URL
  if (config.isYunwu && config.baseUrl) {
    return new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: {
        baseUrl: config.baseUrl
      }
    });
  }

  // Native Gemini API
  return new GoogleGenAI({ apiKey: config.apiKey });
};

// Export for debugging/status display
export const getActiveApiInfo = (): { type: 'yunwu' | 'native' | 'env'; baseUrl?: string } => {
  try {
    const config = getApiConfig();
    if (config.isYunwu) {
      return { type: 'yunwu', baseUrl: config.baseUrl };
    }
    const nativeKey = localStorage.getItem("user_api_key");
    return { type: nativeKey ? 'native' : 'env' };
  } catch {
    return { type: 'env' };
  }
};

// Helper to convert Blob to Base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.error) {
        reject(new Error(`File reading failed: ${reader.error.message}`));
        return;
      }

      const base64String = reader.result as string;
      if (!base64String) {
        reject(new Error("File read result is empty"));
        return;
      }

      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const parts = base64String.split(",");
      if (parts.length < 2) {
        reject(new Error("Invalid data URL format"));
        return;
      }

      resolve(parts[1]);
    };
    reader.onerror = () => {
      reject(
        new Error(
          `File reading error: ${reader.error?.message || "Unknown error"}`,
        ),
      );
    };
    reader.readAsDataURL(blob);
  });
};

// Helper to compress image for faster upload
export const compressImage = async (
  file: File,
  maxWidth: number = 1536,
  quality: number = 0.85
): Promise<{ base64: string, mime: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale down if too large
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Canvas context failed"));
          return;
        }
        ctx.fillStyle = '#FFFFFF'; // Fill background for transparency handling
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Output as JPEG for API efficiency (smaller payload)
        const mime = 'image/jpeg';
        const base64Url = canvas.toDataURL(mime, quality);
        const data = base64Url.split(',')[1];

        resolve({ base64: data, mime });
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

// PCM Audio Helpers
function floatTo16BitPCM(
  output: DataView,
  offset: number,
  input: Float32Array,
) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const decodeAudioData = async (
  base64String: string,
  audioCtx: AudioContext,
): Promise<AudioBuffer> => {
  const bytes = base64ToUint8Array(base64String);
  // Gemini Live returns raw PCM 24kHz mono
  const int16Data = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(int16Data.length);

  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 32768.0;
  }

  const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
  buffer.getChannelData(0).set(float32Data);
  return buffer;
};

/**
 * 1. Analyze Product (Hyper-Realistic Film Mode)
 * Uses gemini-2.5-flash-image
 * UPDATED: Enforce "Film Look", "Candid Poses", "Texture", "Outfit Replacement", "Scene Randomizer"
 */
export const analyzeProductImage = async (
  imageBase64: string,
  mimeType: string,
  userGuidance?: string,
  productScale?: string,
  styleStrategy?: string,
) => {
  const ai = getAiClient();

  // === DYNAMIC PERSONA ENGINE (FILM EDITION) ===
  // All styles must now adhere to the "Film Look" protocol.
  let roleDefinition =
    "**ROLE**: You are a World-Class Editorial Photographer. You shoot exclusively on Analog Film (Kodak Portra 400).";

  // Mapping strategies to Film Scenarios
  let styleRules = "";
  let mandatoryKeywords =
    "film grain, Kodak Portra 400, analog photography, natural light, cinematic, candid shot";

  if (styleStrategy === "Daily Commuter") {
    styleRules =
      "- Atmosphere: Busy city street, motion blur, morning light, authentic urban texture.\n- Model Vibe: Commuter caught in motion, looking at watch/phone, stress/focus, trench coat.\n- Action: Walking fast across street, not posing.";
  } else if (styleStrategy === "Light Travel") {
    styleRules =
      "- Atmosphere: Train station or airport terminal, golden hour light through windows, dust motes.\n- Model Vibe: Traveler, wind-blown hair, comfortable layers (linen/cotton), holding passport/camera.\n- Action: Looking at departure board or map, candid moment.";
  } else if (styleStrategy === "Chill Weekend") {
    styleRules =
      "- Atmosphere: Sun-drenched cafe terrace, dappled light, wooden table texture.\n- Model Vibe: Relaxed, laughing, no makeup look, soft knitwear.\n- Action: Sipping coffee, looking away from camera, laughing with friends.";
  } else if (styleStrategy === "Business Elite") {
    styleRules =
      "- Atmosphere: Modern architecture, glass reflections, cool cinematic tones, depth of field.\n- Model Vibe: Sharp suit but with realistic fabric wrinkles, confident stride.\n- Action: Walking out of building, adjusting sunglasses, candid business editorial.";
  } else if (styleStrategy === "Gorpcore Outdoor") {
    styleRules =
      "- Atmosphere: Misty forest or rocky trail, rain droplets, moody film look.\n- Model Vibe: Technical gear with visible wear, muddy boots, waterproof shell.\n- Action: Hiking, adjusting gear, looking at horizon, breathing visible air.";
  } else if (styleStrategy === "Gen Z Street") {
    styleRules =
      "- Atmosphere: Skate park or graffiti wall, harsh flash photography (point and shoot style).\n- Model Vibe: Oversized hoodie, baggy jeans, cool attitude, direct flash.\n- Action: Sitting on curb, skating, candid snapshot.";
  } else {
    // Default
    styleRules =
      "- Atmosphere: Natural light, textured background, editorial vibe.\n- Model Vibe: Authentic, imperfect, stylish.\n- Action: Candid movement.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: `
${roleDefinition}

**GOAL**: Create a prompt for a HYPER-REALISTIC FILM PHOTOGRAPH based on the "${styleStrategy || "Daily Commuter"}" style.
**STRICTLY FORBIDDEN**: 3D render, CGI, plastic skin, artificial studio lighting, stiff poses, perfect symmetry, stock photo look.

**MANDATORY "REALISM" PROTOCOL:**

1. **The "Film Look" is Non-Negotiable:**
   - Every image MUST simulate analog film photography.
   - Use keywords: "film grain", "Kodak Portra 400", "analog photography", "natural light".
   - NEVER use "clean", "smooth", "digital render".

2. **Candid Over Posed:**
   - Models must NEVER look stiff. They should be "caught in the moment".
   - Keywords: "candid shot", "in motion", "relaxed pose", "looking away".

3. **Texture is Everything:**
   - Describe textures explicitly to avoid AI smoothness.
   - Clothes: "wrinkled linen", "soft cotton", "worn leather", "textured wool".
   - Environment: "sun-drenched concrete", "dappled light", "lived-in cafe".

4. **THE OUTFIT REPLACEMENT PROTOCOL (CRITICAL):**
   - You MUST treat the original image's clothing as **"Invisible/Placeholder"**.
   - **Rule**: Design a NEW outfit. Do NOT describe the clothes currently in the image unless they are the product itself.
   - **Technique**: Overload the prompt with specific fabric keywords (e.g., "thick knitted beige turtleneck", "corduroy", "heavy denim", "sheer silk") to FORCE the model to render new textures.
   - **Constraint**: If the analysis says "Blue Shirt", the final prompt MUST say "Blue Shirt".

5. **THE SCENE RANDOMIZER (CRITICAL):**
   - STOP using "City Street" as default.
   - You MUST cycle through diverse locations.
   - **Random Pool (Pick ONE that fits the vibe)**:
     - "Rooftop garden at sunset with lens flare"
     - "Interior of a brutalist concrete art gallery"
     - "Ferry boat deck with ocean spray"
     - "Greenhouse filled with tropical plants"
     - "Rainy neon alleyway with reflections"
     - "Old library with dust motes in light beams"
     - "Windy cliffside with tall grass"

6. **Body Landmark Mapping (Size Control):**
   - User Input Dimensions: "${productScale || "Not specified"}"
   - If "Large/50cm+": Describe product as "oversized", "dominating silhouette".
   - If "Small": Describe product as "petite", "miniature".

**SPECIFIC STYLE RULES:**
${styleRules}

**BILINGUAL OUTPUT FORMAT (MANDATORY)**
- Provide analysis in both **English [EN]** and **Chinese [CN]**.

**OUTPUT STRUCTURE (Strict JSON)**
Return a JSON object with these exact keys:

{
  "scene_atmosphere": "**Scene Atmosphere (场景氛围)**:\\n[EN] ... \\n[CN] ...",
  "model_outfit": "**Model & Outfit (模特与穿搭)**:\\n[EN] ... \\n[CN] ...",
  "lighting_tone": "**Lighting & Tone (光影与影调)**:\\n[EN] ... \\n[CN] ...",
  "final_prompt": "..." // ENGLISH ONLY. The strict comma-separated prompt.
}

**PROMPT CONSTRUCTION RULES (For 'final_prompt'):**
- Format: [Photography Style & Light], [Subject & Candid Action], [Outfit & Texture Details], [Environment & Atmosphere], [Technical Keywords]
- Example: "analog film photography, natural sunlight, Kodak Portra 400, film grain, a candid shot of a woman laughing as she walks, wearing an oversized beige trench coat over a wrinkled white linen shirt, carrying a textured brown leather tote bag, busy street with old European buildings, dappled light, editorial, cinematic, 8k resolution, authentic."
- **Start with**: "The product must be exactly the same as the reference image, preserving the original appearance, no deformation."

${userGuidance ? `**USER BRIEF**: "${userGuidance}". Execute this request with Film Aesthetic.` : ""}

**RESPONSE FORMAT**:
Respond in pure **JSON** format. Do not use Markdown code blocks.
**CRITICAL**: Ensure the JSON is valid. Escape ALL double quotes inside strings with a backslash.
            `,
          },
        ],
      },
    });

    let text = response.text || "{}";
    // Remove markdown code blocks if present
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Robust JSON Parsing with Sanitization
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("JSON Parse failed, attempting sanitization...", e);
      const sanitized = text.replace(/[\n\r\t]/g, " ");
      try {
        return JSON.parse(sanitized);
      } catch (e2) {
        console.warn("Sanitization failed, attempting Regex Fallback...", e2);
        const extractField = (key: string) => {
          const regex = new RegExp(
            `"${key}"\\s*:\\s*"(.*?)(?="\\s*(?:,|\\}))`,
            "s",
          );
          const match = text.match(regex);
          return match ? match[1].trim() : "";
        };
        const final_prompt = extractField("final_prompt");

        if (final_prompt) {
          return {
            scene_atmosphere: extractField("scene_atmosphere") || "Parsing...",
            model_outfit: extractField("model_outfit") || "Parsing...",
            lighting_tone: extractField("lighting_tone") || "Parsing...",
            final_prompt: final_prompt,
          };
        }
        throw new Error(
          `AI 响应格式严重错误，无法解析: ${text.substring(0, 50)}...`,
        );
      }
    }
  } catch (error) {
    console.error("Analysis failed", error);
    throw error;
  }
};

/**
 * 2. Generate Image
 * Uses gemini-3-pro-image-preview
 * Supports optional Model Reference Image for face consistency.
 */
export const generateMarketingImage = async (
  prompt: string,
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  referenceImage?: { base64: string; mimeType: string }, // Product
  modelReferenceImage?: { base64: string; mimeType: string }, // Model Face
) => {
  const ai = getAiClient();
  try {
    const parts: any[] = [];

    // 1. Add Product Image (Image 1)
    if (referenceImage) {
      parts.push({
        inlineData: {
          mimeType: referenceImage.mimeType,
          data: referenceImage.base64,
        },
      });
    }

    // 2. Add Model Reference Image (Image 2), if provided
    if (modelReferenceImage) {
      parts.push({
        inlineData: {
          mimeType: modelReferenceImage.mimeType,
          data: modelReferenceImage.base64,
        },
      });
    }

    // 3. Construct Prompt Logic
    let finalPrompt = "";
    // UPDATED: Suffix to reinforce Film Look if user wrote their own prompt
    const genericSuffix =
      ", analog film photography, Kodak Portra 400, film grain, highly detailed texture, cinematic lighting, editorial aesthetic, photorealistic, f/1.8.";

    if (referenceImage && modelReferenceImage) {
      // Dual Image Scenario
      finalPrompt = `
      You have two input images. 
      Image 1 is the [Product Reference]. 
      Image 2 is the [Model Reference].
      
      Goal: Generate a High-End Instagram Editorial Shot (Analog Film Style).
      
      CRITICAL INSTRUCTIONS:
      1. You MUST use the facial features of the person in Image 2.
      2. The model (Image 2) should be interacting with the Product (Image 1) in a CANDID way (not stiff).
      3. The Product (Image 1) must be preserved exactly as shown.
      4. STYLE: Kodak Portra 400. Visible film grain. Texture.
      
      Scene Description: ${prompt} ${genericSuffix}`;
    } else if (referenceImage) {
      // Single Image Scenario
      finalPrompt = `Create a high quality analog film photograph based on the provided product reference. ${prompt} ${genericSuffix}`;
    } else {
      // Text Only Scenario
      finalPrompt = `${prompt} ${genericSuffix}`;
    }

    parts.push({ text: finalPrompt });

    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: {
          parts: parts,
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: resolution,
          },
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out (Target: 90s). The model might be overloaded.")), 90000))
    ]) as any;

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Image generation failed", error);
    throw error;
  }
};

/**
 * 2.1 Generate Fusion Image (Scene Fusion)
 * Uses gemini-3-pro-image-preview
 */
/**
 * 2.1 Generate Fusion Image (Scene Fusion)
 * Uses gemini-3-pro-image-preview
 */
export const generateFusionImage = async (
  imageBase64: string,
  mimeType: string,
  prompt: string,
  sourceType: "3D" | "REAL",
) => {
  // Redirect to new multi-image compatible function for backward compatibility if needed,
  // or keep as specific fusion logic.
  // For now, let's keep it but ideally we should migrate to the new one.
  return generateImageToImage([{ base64: imageBase64, mimeType }], prompt);
};

/**
 * 2.1.1 Image-to-Image Generation (Multi-Image Support)
 * Uses gemini-3-pro-image-preview
 */
/**
 * 2.1.1 Image-to-Image Generation (Multi-Image Support)
 * Uses gemini-3-pro-image-preview
 */
export const generateImageToImage = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
  options: { aspectRatio?: AspectRatio; resolution?: ImageResolution } = {}
) => {
  const ai = getAiClient();
  try {
    const parts: any[] = [];

    // 1. Add All Input Images
    images.forEach((img) => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      });
    });

    // 2. Construct Prompt
    // Using AIGC Architect principles for better prompt adherence
    const systemPrompt = `
    **TASK**: Image-to-Image Generation.
    **INPUT**: ${images.length} Reference Image(s).
    **INSTRUCTION**: Based on the provided reference image(s), generate a new image following the user's description.
    **USER PROMPT**: ${prompt}
    
    **GUIDELINES**:
    - High fidelity to the visual style of reference images if not overridden by prompt.
    - Photorealistic, high resolution, commercial quality.
    - If multiple images are provided, fuse their elements or styles as implied by the prompt.
    `;

    parts.push({ text: systemPrompt });

    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: options.aspectRatio || "1:1",
            imageSize: options.resolution || "1K",
          },
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out (Target: 90s). The model might be overloaded.")), 90000))
    ]) as any;

    const generatedImages: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImages.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        }
      }
    }
    return generatedImages;
  } catch (error) {
    console.error("Image-to-Image generation failed", error);
    throw error;
  }
};

/**
 * 4. Optimize Prompt using Expert Persona
 * Skill: # Role_ 用户 (1).md
 */
export const optimizePrompt = async (rawPrompt: string, refImages?: { base64: string; mimeType: string }[], refineInstruction?: string): Promise<string> => {
  const ai = getAiClient();
  if (!rawPrompt && (!refImages || refImages.length === 0)) return "";

  const skillSystemPrompt = `
# Role: Prompt Optimization Expert
# Mission: Refine user prompts into precise, high-quality image generation directives.

# Core Rules:
1. **Precision**: Convert vague terms into concrete visual descriptions (e.g., "beautiful" -> "cinematic lighting, 8k resolution, golden hour").
2. **Visual Fidelity**: If feedback/images are provided, strictly adhere to their style.
3. **Language Identity**: Input Chinese -> Output Chinese. Input English -> Output English.
4. **Output Format**: Return ONLY the optimized prompt text. No markdown, no explanations.
`;

  try {
    const parts: any[] = [{ text: skillSystemPrompt }];

    // Add Reference Images if provided
    if (refImages && refImages.length > 0) {
      refImages.forEach(img => {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        });
      });
      parts.push({ text: `[系统提示]: 用户上传了 ${refImages.length} 张参考图片，请仔细分析这些图片的风格、内容和细节，并结合下方的文字提示词进行优化。我们的目标是生成一张风格类似的新图片。` });
    }

    if (refineInstruction) {
      parts.push({ text: `[当前已有提示词]:\n"${rawPrompt}"\n\n[用户修改指令]: "${refineInstruction}"\n\n请根据用户指令修改上述提示词。` });
    } else {
      parts.push({ text: `请优化以下提示词:\n"${rawPrompt}"` });
    }

    // Use gemini-3-flash-preview as requested
    const modelName = "gemini-3-flash-preview";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: parts
      }
    });

    const optimizedText = response.text?.trim();
    return optimizedText || rawPrompt;
  } catch (e) {
    console.error("Prompt optimization failed", e);
    return rawPrompt; // Fallback to original
  }
};

/**
 * 2.2 Generate Seat Cover Fit (Automotive)
 * Uses gemini-3-pro-image-preview
 */
export const generateSeatCoverFit = async (
  seatCoverImages: { base64: string; mime: string }[],
  productCategory: string,
  carModel: string,
  year: string,
  seatConfig: string,
  targetRow: string,
  angleMode: "PRESET" | "REFERENCE",
  angleValue: string | { base64: string; mime: string }[],
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  customRequest?: string, // NEW: User Custom Request
  visualGuide?: { base64: string; mime: string } // NEW: Optional Visual Guide
) => {
  const ai = getAiClient();
  try {
    const parts: any[] = [];

    // 1. Add Seat Cover Images
    seatCoverImages.forEach((img) => {
      parts.push({
        inlineData: { mimeType: img.mime, data: img.base64 }
      });
    });

    // 1.5 Add Visual Guide (if present)
    if (visualGuide) {
      parts.push({
        inlineData: { mimeType: visualGuide.mime, data: visualGuide.base64 }
      });
    }

    // 2. Map Definitions & Logic
    const viewMap: Record<string, string> = {
      // === 1. Single Seat (单品座椅) ===
      "S1 Front View": "shot from directly in front, camera at seat height, centered composition",
      "S2 3/4 Front Angle": "shot from front-left at 40 degree angle, slightly elevated camera, three-quarter view",
      "S3 Rear 3/4 View": "shot from rear-left at 135 degree angle, showing seat back, three-quarter rear view",

      // === 2. Full Set (整套座椅) ===
      "SET1 Side View Left": "shot from left side at 90 degrees, full seat set in frame, straight-on side view",
      "SET2 Side View Right": "shot from right side at 90 degrees, full seat set in frame, straight-on side view",

      // === 3. Front Interior (车内前排) ===
      "F1 High-Angle Top-Down": "shot from above front-right at 45 degree downward angle, bird's eye perspective, interior visible",
      "F2 Driver Side Profile": "shot from driver door side, eye-level, profile view of driver seat and dashboard",
      "F3 Passenger Front-Quarter": "shot from passenger side front-quarter, doors removed, showing front cabin interior",
      "F4 Rear-to-Front View": "shot from rear seat position looking forward, interior POV, front seat backs visible",

      // === 4. Rear Interior (车内后排) ===
      // === 4. Rear Interior (车内后排) ===
      "R6 Rear 3/4 View": "Camera positioned at OPEN REAR-RIGHT DOOR. 3/4 angle view looking across the rear bench. Interior visible. Standard commercial angle.",
      "R1 Rear Front Close-up": "1-POINT PERSPECTIVE. Camera positioned on the vehicle CENTER LINE (between front seats), facing directly BACKWARDS. Pure symmetrical view of the rear bench. NOT from the side door. 0-degree angle.",
      "R2 Rear Side Left": "Camera positioned OUTSIDE OPEN REAR-LEFT DOOR, looking INTO the cabin. 45-degree angle towards rear bench. Eye-level commercially standard shot.",
      "R3 Rear Side Right": "Camera positioned OUTSIDE OPEN REAR-RIGHT DOOR, looking INTO the cabin. 45-degree angle towards rear bench. Eye-level commercially standard shot.",
      "R4 Rear Folded View": "Functional Shot: Rear Seat Backrest FOLDED DOWN FLAT onto the cushion. Horizontal cargo surface. NOT tipped up.",
      "R7 Rear Tip-Up View": "Functional Shot: Rear Seat Cushion FLIPPED UP / TIPPED UP VERTICALLY against the backrest. 60/40 split or full bench. Showing the floor space UNDER the seat.",
      "R5 Top-Down Reclined": "shot from above at 60 degree angle, looking down into cabin, seats reclined",

      // === 5. Armrest Box (扶手箱) ===
      "A01 White Background 1": "Product isolated on pure white background, center-positioned, car center console armrest cover, front-right 3/4 view, 45-degree top-down angle, high-end studio lighting, product photography, sharp focus on leather texture and stitching, clean minimal commercial shot",
      "A02 White Background 2": "Product isolated on pure white background, center-positioned, car center console armrest cover, front-left 3/4 view, 45-degree top-down angle, high-end studio lighting, product photography, sharp focus on leather texture and stitching, clean minimal commercial shot",
      "A03 Rear Top-Down": "Car interior shot from rear passenger perspective, high angle 60-degree top-down view, looking toward front center console, camera positioned behind driver seat, armrest cover centered in frame, cup holders visible, front seats partially visible on both sides",
      "A04 Rear Panorama": "Car interior wide shot from rear center position, 45-degree elevated angle, full front cabin view, armrest lid open showing storage, steering wheel visible on left, side windows and mirrors in frame, natural daylight through windows, both front seats visible",
      "A05 Driver Side View": "Car interior shot from driver side position, medium high angle looking toward passenger side, steering wheel and dashboard on left edge, gear shifter visible, center console armrest in center-right of frame, moody interior lighting, front windshield partially visible",
      "A06 Passenger Side View": "Car interior shot from passenger side position, medium high angle looking toward driver side, steering wheel visible on right, gear shifter and center console in frame, armrest cover in center-left of frame, dark interior ambiance, both front seats partially visible",
      "A07 Directly Above View": "Car interior top-down aerial view, 75-80 degree steep overhead angle, shooting from above front seats, armrest cover centered in frame showing full quilted pattern, both seat edges visible on sides, cup holders and gear area visible, symmetrical composition",
      "A08 Passenger Rear Diagonal": "Car interior shot from rear passenger side, 50-degree angled top-down view, looking diagonally toward driver side, gear shifter and cup holders visible, steering wheel in background right, armrest cover in center-left of frame, dark premium interior lighting",
      "A09 Product Close-up": "Close-up interior shot, 45-degree side angle with medium elevation, shallow depth of field, armrest cover as main subject with sharp focus, seat and console softly blurred in background, emphasizing texture and stitching detail, cinematic interior lighting",
      "A10 Wipe Demo": "Car interior shot from passenger door opening, male driver wiping armrest cover with cloth, water droplets on surface, medium angle slightly elevated, natural daylight from windows, shot from outside looking in through passenger door, torso and arm visible, steering wheel on right",
      "A11 Rear Standard View": "Car interior shot from rear seat position, 55-60 degree top-down angle, looking forward at center console, armrest cover centered in frame, steering wheel and dashboard visible in background left, gear shifter and cup holders visible, both front seats partially visible, dark interior ambiance",
      "A12 Sunset Lifestyle": "Car interior shot from passenger seat position, male driver with arm resting on armrest, golden hour sunset lighting through windshield, warm orange-purple sky visible, dashboard and steering wheel visible, medium horizontal angle, lifestyle driving scene, cinematic lighting",
      "A13 Installation Demo": "Car interior shot from rear seat elevated position, 60 degree top-down angle, female hands installing armrest cover, armrest lid open showing storage compartment, both arms extended holding product, installation demonstration pose, bright natural lighting, both front seats visible",
      "A14 Driver Door View": "Car interior shot from driver door opening, male driver seated with both hands on steering wheel, arm resting on armrest cover, horizontal angle with slight elevation, natural indoor lighting, shot from outside looking in through driver door, torso visible without face, gear shifter and cup holders visible",
      "A15 Pet Lifestyle": "Car interior shot from rear seat position, golden retriever dog resting paws on armrest cover, happy expression, horizontal angle with slight elevation, urban street scene visible through windshield, natural daylight, lifestyle pet-friendly scene, both front seats visible, warm friendly atmosphere",
      "A16 Driver Rear Wide": "Car interior shot from behind driver seat, 50 degree elevated angle looking toward passenger side, gear shifter and cup holders in foreground left, armrest cover in center, passenger seat headrest visible in background, bright overexposed background through windows, wide angle composition",
      "A17 Driver Side Scenario": "Car interior shot from driver door opening, horizontal eye-level angle, male driver seated with hands on steering wheel, arm naturally resting on armrest cover, bright soft lighting from windows, shot from outside through driver door, upper body visible without full face, relaxed driving posture",

      // Legacy/Fallback mapping
      "Driver's View": "Shot from driver's seated position at 45-degree angle.",
      "Rear Row Perspective": "Rear passenger viewpoint, looking forward.",
      "Side Open Door View": "View from open door position.",
      "Top Down View": "High angle layout view.",
      "Detail Shot of Stitching": "Close-up macro shot of stitching.",
    };

    // 3. Resolve Target & Angle Attributes
    let finalTargetRow = targetRow;
    let angleId = targetRow;
    let angleInstruction = "Standard commercial angle";

    // Pre-calc indices for logic usage
    const productCount = seatCoverImages.length;
    const guideIndex = visualGuide ? productCount + 1 : -1;

    // 3.1 Location Decoding
    if (viewMap[targetRow]) {
      if (targetRow.startsWith("SET")) finalTargetRow = "Full Car Interior";
      else if (/^S\d/.test(targetRow)) finalTargetRow = "Front Row Single Seat"; // Matches S1, S2, S3...
      else if (targetRow.startsWith("F")) finalTargetRow = "Front Row";
      else if (targetRow.startsWith("R")) finalTargetRow = "Rear Row";
      else if (/^A\d/.test(targetRow)) finalTargetRow = "Center Console Armrest"; // Matches A0-A9
    }

    // 3.4 Strict Contextual Awareness (Standalone vs Integration)
    // If we have a reference guide, the MISSION should follow the GUIDE'S context.
    const isArmrestRow = /^A\d/.test(targetRow);
    const isSingleSeat = isArmrestRow
      ? targetRow.includes("White Background")
      : (seatConfig === 'Single Seat' || /^S\d/.test(targetRow));

    // FORCE VISUAL PRIORITY for Armrest to fix mismatch labels
    if (seatConfig === 'Armrest Box' && visualGuide) {
      angleInstruction = `ABSOLUTE PRIORITY: REPLICATE ANGLE OF IMAGE ${guideIndex}. Ignore conflicting text labels like '${targetRow}'.`;
    }

    // 3.3 Angle Logic (Follow Focus vs Manual vs Reference)
    const isManualAngleOverride = angleMode === "PRESET" &&
      typeof angleValue === 'string' &&
      angleValue !== 'Follow Focus Row';

    if (angleMode === "REFERENCE" && Array.isArray(angleValue) && angleValue.length > 0) {
      // Reference Mode
      angleId = "REF_MATCH";
      angleInstruction = "STRICTLY DUPLICATE PERSPECTIVE OF UPLOADED REFERENCE IMAGES.";
      // Add Ref Images
      angleValue.forEach((refImg) => {
        parts.push({ inlineData: { mimeType: refImg.mime, data: refImg.base64 } });
      });
    } else if (isManualAngleOverride) {
      // Manual Preset Override
      const valStr = angleValue as string;
      angleId = valStr;
      angleInstruction = viewMap[valStr] || valStr;
      angleInstruction += ` (APPLIED TO: ${finalTargetRow})`;
    } else if (viewMap[targetRow]) {
      // Follow Focus Row (Default)
      angleId = targetRow;
      angleInstruction = viewMap[targetRow];
    }

    // 3.4 Strict Contextual Awareness (Standalone vs Integration)
    // If we have a reference guide, the MISSION should follow the GUIDE'S context.

    // 3.4 Strict Contextual Awareness (Standalone vs Integration)
    // If we have a reference guide, the MISSION should follow the GUIDE'S context.
    const isCloseUp = targetRow.toLowerCase().includes('close-up') ||
      targetRow.toLowerCase().includes('detail') ||
      angleInstruction.toLowerCase().includes('close-up');

    const missionText = isSingleSeat
      ? `MISSION: Create a high-end commercial product catalog asset. Focus is a STANDALONE **${productCategory}**. Background must be a clean, neutral studio gradient. REMOVE all car interior distractions (dashboard, wheels, cabin walls).`
      : isCloseUp
        ? `MISSION: Create a Macro/Detail commercial photograph. Focus strictly on the **${productCategory}** texture and fit. Blur the ${carModel} interior significantly using shallow depth of field. Use a tight crop.`
        : `MISSION: Create a photorealistic automotive interior visualization. Focus is the **${productCategory}** professionally INSTALLED inside a **${year} ${carModel}**. Maintain full cabin architectural context.`;

    // 4. Construct V4.0 Prompt

    const v4Prompt = `
## ✅ AutoFusion™ Pro V4.3 (Composition-Command™ Edition)

**SYSTEM**: AutoFusion™ Pro V4.3 - Strict Perspective & Identity Control
**CONTEXT**: ${isSingleSeat ? "STANDALONE_CATALOG" : "INTERIOR_INTEGRATION"}
**ORDER_OF_OPERATIONS**: 1. CAMERA_ANGLE (BLUEPRINT) > 2. PRODUCT_IDENTITY (LOCK) > 3. VEHICLE_MATCH

---

## 📐 1. CAMERA & PERSPECTIVE [MANDATORY BLUEPRINT]

**ANGLE_ID**: ${angleId}
**SCENE_GEOMETRY**: ${angleInstruction}
${visualGuide ? `
**LAYOUT_MASTER (IMAGE ${guideIndex})**: 
- ⛔ **STRICT MIRRORING REQUIRED**: You MUST treat IMAGE ${guideIndex} as a technical blueprint.
- **FOCAL_LENGTH**: Match the lens compression of Image ${guideIndex}.
- **POSITIONING**: The product's placement, scale within the frame, and rotation MUST be a 1:1 match to Image ${guideIndex}.
- **CROP**: Duplicate the exact framing and peripheral view boundaries of Image ${guideIndex}.` : ""}

---

## 🖼️ 2. PRODUCT IDENTITY [STRUCTURAL LOCK]

**PRODUCT_SOURCE**: IMAGES 1-${productCount}
- ⛔ **IDENTICAL REPRODUCTION**: The product in the output MUST be a physical clone of the [PRODUCT MASTER].
- **STRUCTURE**: Do not change the 3D geometry, pattern density (quilting), or material sheen.
- **LOCK**: Every stitch line and panel transition from the source MUST be preserved.

---

## 🎯 3. ${missionText}

${customRequest ? `
## 🗨️ USER CUSTOM REQUEST [HIGH PRIORITY]
> "**${customRequest}**"
` : ""}

---

## 🚗 4. VEHICLE & ENVIRONMENT

| Attribute | Value |
|-----------|-------|
| Model | ${carModel} |
| Year | ${year} |
| Context | ${isSingleSeat ? "STUDIO (Neutral)" : "VEHICLE INTERIOR"} |

${isSingleSeat
        ? "**ENVIRONMENT**: Clean studio aesthetic. Sharp focus. No background clutter."
        : `**ENVIRONMENT**: Integrate the product into a high-end ${year} ${carModel} interior. Textures and lighting must match the automotive cabin context.`
      }

---

## 🎨 5. MATERIAL & LIGHTING

| Component | Protocol |
|-----------|-------|
| **PRODUCT** | **MATCH REFERENCE EXACTLY**. No color shift. |
| **LIGHTING** | Professional commercial automotive studio lighting. Diffused key light. |
| **FINISH** | Photorealistic texture. Visible leather grain. No 3D-render smoothness. |

---

## 🛠️ INSTALLATION LOGIC

${productCategory === "Armrest Box" ? `
- **SHAPE**: Duplicate the curvature and rigid 3D form from [PRODUCT MASTER].
- **PLACEMENT**: ${isSingleSeat ? "Neutral studio surface." : "Fits perfectly on the " + carModel + " center console."}
` : `
- **FIT**: Wrap tightly around the ${carModel} seat frame.
- **DESIGN**: Preserve the seat cover's original color-blocking and pattern.
`}

Apply "${carModel}" brand DNA to seat geometry and visible knobs/levers.

---

## 📤 FINAL QUALITY CHECKLIST (MANDATORY)
- [ ] Is the product design an IDENTICAL match to Images 1-${productCount}?
- [ ] Has the product structure (open/closed) been preserved from the reference?
- [ ] Is the perspective correctly aligned with ${visualGuide ? "Image " + guideIndex : angleId}?
- [ ] Are there zero digital artifacts or 3D-render characteristics?
- [ ] Does the material look like real leather/fabric (High texture detail)?

⛔ **FAILURE TO REPLICATE THE PRODUCT DESIGN EXACTLY IS UNACCEPTABLE.**

---

## 🚫 NEGATIVE CONSTRAINTS

**MUST AVOID**:
- ❌ Cartoonish or illustrated style
- ❌ Incorrect seat geometry for ${carModel}
- ❌ Product color alteration
- ❌ **${isSingleSeat ? "Distracting dashboard, steering wheel, full interior view" : "Oversaturated colors"}**
- ❌ 3D render aesthetic (must look like real photo)
`;

    parts.push({ text: v4Prompt });

    // 5. Call API
    // Dynamic Model Selection:
    // Gemini 2.0 Flash-Exp does NOT support Image Generation (Outputs Text).
    // Must use 'gemini-3-pro-image-preview' for actual image synthesis.
    // Speed optimization must be done via 'aspectRatio' or 'imageSize' param, not model swap.
    const modelName = "gemini-3-pro-image-preview";
    console.log(`🎨 [AutoFusion] Generating with ${modelName} (Resolution: ${resolution})`);

    const response = await Promise.race([
      ai.models.generateContent({
        model: modelName,
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: resolution,
          },
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out (Target: 90s). The model might be overloaded.")), 90000))
    ]) as any; // Cast to avoid type issues with race result

    // 6. Output Processing
    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        }
      }
    }
    return images;

  } catch (error) {
    console.error("Seat cover generation failed", error);
    throw error;
  }
};

/**
 * 3. Inpaint Image (New Inpainting Canvas)
 * Uses gemini-2.5-flash-image with Mask support
 */
export const inpaintImage = async (
  originalBase64: string,
  maskBase64: string,
  prompt: string,
  options: { resolution?: ImageResolution } = {},
  referenceImages: { base64: string; mimeType: string }[] = []
) => {
  const ai = getAiClient();
  try {
    const parts: any[] = [
      {
        inlineData: {
          data: originalBase64,
          mimeType: "image/png",
        },
      },
      {
        inlineData: {
          data: maskBase64,
          mimeType: "image/png",
        },
      },
    ];

    // Add Reference Images for Inpainting
    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach((img) => {
        parts.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType,
          },
        });
      });
    }

    parts.push({
      text: `
      You are a Senior Retoucher for a High-End Brand.
      
      INPUTS:
      - Image 1: Original Image.
      - Image 2: Mask (White area = edit zone).
      ${referenceImages.length > 0 ? `- Additional Images: REFERENCE MATERIAL (Style/Texture Guide).` : ''}
      
      TASK: Precision Retouching on Image 1.
      1. Modify ONLY the white area of the mask.
      2. INSTRUCTION: "${prompt}".
      ${referenceImages.length > 0 ? `3. STRICT ADHERENCE to Reference Material for texture/style/color independently of the original.` : ''}
      4. Blend edges naturally.
      `,
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          imageSize: options.resolution || "1K",
        }
      }
    });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Inpainting failed", error);
    throw error;
  }
};

/**
 * 3.1 Edit Generated Image (Legacy Text Only)
 * Uses gemini-2.5-pro-image
 */
export const editGeneratedImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  referenceImages: { base64: string; mimeType: string }[] = [],
  options: { aspectRatio?: AspectRatio; resolution?: ImageResolution } = {}
) => {
  const ai = getAiClient();
  try {
    const parts: any[] = [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ];

    // Add Reference Images
    referenceImages.forEach((img) => {
      parts.push({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType,
        },
      });
    });

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: options.aspectRatio, // Optional, model might infer if undefined
          imageSize: options.resolution || "1K", // Default to 1K if not provided, but we will pass it
        },
      },
    });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Edit failed", error);
    throw error;
  }
};

/**
 * 3.2 Outpaint Image
 * Uses gemini-2.5-flash-image with Mask support to expand canvas
 */
export const generateOutpainting = async (
  inputBase64: string,
  maskBase64: string,
  prompt?: string,
) => {
  const ai = getAiClient();
  try {
    const description =
      prompt ||
      "Extend the scene naturally, matching the existing lighting and environment.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: inputBase64,
              mimeType: "image/png",
            },
          },
          {
            inlineData: {
              data: maskBase64,
              mimeType: "image/png",
            },
          },
          {
            text: `
            You are an Expert Image Extender.
            
            Image 1: The input image with a transparent/white border.
            Image 2: A mask where BLACK is the original image (KEEP) and WHITE is the empty space (FILL).
            
            TASK: Outpaint / Expand the image.
            1. Fill the WHITE area of the mask with new content.
            2. The new content MUST seamlessly blend with the edges of the original image (Black area).
            3. Context: ${description}
            4. Do NOT modify the original image content inside the Black mask area.
            `,
          },
        ],
      },
    });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
          );
        }
      }
    }
    return images;
  } catch (error) {
    console.error("Outpainting failed", error);
    throw error;
  }
};

/**
 * 4. Search Trends
 * Uses gemini-2.5-flash with googleSearch
 */
export const searchTrends = async (query: string) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const grounding =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const text = response.text || "No results found.";

    return { text, grounding };
  } catch (error) {
    console.error("Search failed", error);
    throw error;
  }
};

/**
 * 5. Generate Listing Copy
 * Uses gemini-2.5-flash-image
 */
export const generateListingCopy = async (
  imageBase64: string,
  mimeType: string,
  platform: "Amazon" | "TikTok" | "Instagram",
  keywords?: string,
) => {
  const ai = getAiClient();

  let prompt = "";
  const keywordsContext = keywords
    ? `Focus heavily on these user-provided keywords/features: "${keywords}".`
    : "";

  if (platform === "Amazon") {
    prompt = `You are an expert Amazon Listing Copywriter (Cross-border E-commerce Expert). 
    Analyze the provided product image.
    ${keywordsContext}
    
    Write a high-converting Amazon listing in English.
    Structure:
    1. **Title**: SEO-optimized, max 200 chars. Include main keywords.
    2. **5 Bullet Points**: Highlight features and benefits. Use uppercase for the first phrase of each bullet.
    3. **Product Description**: A compelling paragraph selling the lifestyle and value.
    
    Ensure the tone is professional yet persuasive.`;
  } else if (platform === "TikTok") {
    prompt = `You are a viral TikTok script writer. Analyze the product image.
    ${keywordsContext}
    
    Write a short video script for this product.
    Structure:
    1. **Hook (0-3s)**: Something visual or shocking to stop the scroll.
    2. **Body (15-30s)**: Showcasing the problem and the solution (the product).
    3. **Call to Action**: Clear instruction to buy or check the link.
    4. **Hashtags**: 5-10 trending hashtags for this niche.
    
    Tone: Energetic, fast-paced, Gen-Z friendly.`;
  } else if (platform === "Instagram") {
    prompt = `You are a social media manager for a premium brand. Analyze the product image.
    ${keywordsContext}
    
    Write an aesthetic Instagram caption.
    Structure:
    1. **Opening**: Engaging line or question.
    2. **Body**: Short value proposition.
    3. **Call to Action**.
    4. **Hashtags**: Relevant tags mixed with niche tags.
    
    Tone: Aesthetic, lifestyle-focused, use emojis.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    return response.text || "生成失败，请重试。";
  } catch (error) {
    console.error("Copy generation failed", error);
    throw error;
  }
};

/**
 * 6. Generate Video Script
 * Uses gemini-2.5-flash-image
 */
export const generateVideoScript = async (
  imageBase64: string,
  mimeType: string,
  duration: string,
  style: string,
) => {
  const ai = getAiClient();

  const prompt = `You are a professional Video Director for commercial products.
  Analyze the provided product image and create a detailed video shooting script.

  Constraints:
  - Total Duration: ${duration}
  - Vibe/Style: ${style}

  Instructions:
  - Break down the video into scenes/shots.
  - The script must be perfectly timed to fit the ${duration}.
  - Output strictly in JSON format (Array of objects).
  - Do NOT use Markdown code blocks. Just return the JSON string.

  JSON Structure per scene:
  {
    "time": "Timestamp (e.g., 00:00 - 00:05)",
    "visual": "Detailed visual description of the scene, camera angle, subject action.",
    "audio": "Voiceover (VO), Sound Effects (SFX), or Music cues.",
    "overlay": "Text overlay or graphics on screen."
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    let text = response.text || "[]";
    // Clean up if model adds markdown blocks despite instructions
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse failed, returning raw text as one scene", text);
      // Sanitization fallback
      const sanitized = text.replace(/[\n\r\t]/g, " ");
      try {
        return JSON.parse(sanitized);
      } catch (e2) {
        return [
          {
            time: "00:00 - end",
            visual: "Failed to parse JSON",
            audio: text,
            overlay: "Error",
          },
        ];
      }
    }
  } catch (error) {
    console.error("Script generation failed", error);
    throw error;
  }
};

/**
 * 7. Live Director (Audio Conversation)
 * Uses gemini-2.5-flash-native-audio-preview-09-2025
 */
export const connectLiveDirector = async (
  onAudioData: (base64: string) => void,
  onClose: () => void,
) => {
  const ai = getAiClient();

  // Setup Audio Input (Microphone)
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
    },
  });

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  let isConnected = true;

  const sessionPromise = ai.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: {
        parts: [
          {
            text: "你是一位专业的创意视觉总监。请用简短、专业的语言与用户讨论视觉创意方案。请讲中文。",
          },
        ],
      },
    },
    callbacks: {
      onopen: () => {
        console.log("Live session opened");
      },
      onmessage: (message: LiveServerMessage) => {
        const audioData =
          message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          onAudioData(audioData);
        }
        if (message.serverContent?.turnComplete) {
          console.log("Turn complete");
        }
      },
      onclose: () => {
        console.log("Live session closed");
        isConnected = false;
        onClose();
      },
      onerror: (err) => {
        console.error("Live session error:", err);
        isConnected = false;
        onClose();
      },
    },
  });

  // Stream Audio Input
  processor.onaudioprocess = (e) => {
    if (!isConnected) return;

    const inputData = e.inputBuffer.getChannelData(0);
    // Convert Float32 to Int16 PCM for Gemini
    const buffer = new ArrayBuffer(inputData.length * 2);
    const view = new DataView(buffer);
    floatTo16BitPCM(view, 0, inputData);

    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    sessionPromise
      .then((session) => {
        session.sendRealtimeInput({
          media: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Audio,
          },
        });
      })
      .catch((err) => {
        // Session might be initializing or failed
      });
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return {
    close: async () => {
      isConnected = false;
      stream.getTracks().forEach((track) => track.stop());
      processor.disconnect();
      source.disconnect();
      await audioContext.close();
      const session = await sessionPromise;
      /* @ts-ignore */
      if (session.close) session.close();
    },
  };
};

// ==================== Camera Angle Analysis ====================

export const estimateCameraAngle = async (
  base64Image: string,
  mimeType: string
): Promise<{ yaw: number; pitch: number; zoom: number }> => {
  const ai = getAiClient();
  try {
    const prompt = `Analyze the camera angle of this image relative to a standard eye-level front-facing view.
    Estimate the following 3 values in a Global Spherical Coordinate System:
    1. Yaw (Azimuth): 0 to 360 degrees. 0=Front, 90=Right, 180=Back, 270=Left.
    2. Pitch (Elevation): -90 to 90 degrees. 0=Eye-level, Positive=High Angle (Looking Down), Negative=Low Angle (Looking Up).
    3. Zoom (Distance): 0.5 (Wide/Far) to 2.5 (Telephoto/Close). 1.0 is standard.

    Return ONLY a raw JSON object with no markdown formatting:
    { "yaw": number, "pitch": number, "zoom": number }`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No analysis result");

    const json = JSON.parse(text);
    return {
      yaw: Number(json.yaw) || 0,
      pitch: Number(json.pitch) || 0,
      zoom: Number(json.zoom) || 1,
    };
  } catch (error) {
    console.error("Camera estimation failed:", error);
    // Return default neutral values on failure
    return { yaw: 0, pitch: 0, zoom: 1 };
  }
};
