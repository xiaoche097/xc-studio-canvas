import { GoogleGenAI, LiveServerMessage, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AspectRatio, ImageResolution } from "../types";
import { QUALITY_BOOSTERS, buildNegativePrompt, enhancePrompt, SCENE_POOL, TEXTURE_KEYWORDS, NEGATIVE_PERSPECTIVE } from "./promptUtils";

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
    - Clothes: ${TEXTURE_KEYWORDS.FABRIC.map(t => `"${t}"`).join(", ")}.
    - Environment: ${TEXTURE_KEYWORDS.ENVIRONMENT.map(t => `"${t}"`).join(", ")}.

4. **THE OUTFIT REPLACEMENT PROTOCOL (CRITICAL):**
   - You MUST treat the original image's clothing as **"Invisible/Placeholder"**.
   - **Rule**: Design a NEW outfit. Do NOT describe the clothes currently in the image unless they are the product itself.
   - **Technique**: Overload the prompt with specific fabric keywords (e.g., "thick knitted beige turtleneck", "corduroy", "heavy denim", "sheer silk") to FORCE the model to render new textures.
   - **Constraint**: If the analysis says "Blue Shirt", the final prompt MUST say "Blue Shirt".

5. **THE SCENE RANDOMIZER (CRITICAL):**
    - STOP using "City Street" as default.
    - You MUST cycle through diverse locations.
    - **Random Pool (Pick ONE that fits the vibe)**:
${SCENE_POOL.map(s => `      - "${s}"`).join("\n")}

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
    // Dynamic quality suffix from Nano Banana Skills
    const qualitySuffix = `, ${QUALITY_BOOSTERS.EDITORIAL}`;

    if (referenceImage && modelReferenceImage) {
      // Dual Image Scenario
      finalPrompt = `
      You have two input images. 
      Image 1 is the [Product Reference]. 
      Image 2 is the [Model Reference].
      
      Goal: Generate a High-End Editorial Photograph.
      
      CRITICAL INSTRUCTIONS:
      1. You MUST use the facial features of the person in Image 2.
      2. The model (Image 2) should be interacting with the Product (Image 1) in a CANDID way (not stiff).
      3. The Product (Image 1) must be preserved exactly as shown.
      4. STYLE: Cinematic, editorial, photorealistic with natural textures.
      
      Scene Description: ${prompt} ${qualitySuffix}`;
    } else if (referenceImage) {
      // Single Image Scenario
      finalPrompt = `Create a high quality editorial photograph based on the provided product reference. ${prompt} ${qualitySuffix}`;
    } else {
      // Text Only Scenario
      finalPrompt = `${prompt} ${qualitySuffix}`;
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

    // 2. Construct Prompt — structured with golden formula principles
    const systemPrompt = `
    **ROLE**: Professional Image Generation Artist.
    **TASK**: Image-to-Image Generation.
    **INPUT**: ${images.length} Reference Image(s).
    
    **INSTRUCTION**: Based on the provided reference image(s), generate a new image following the user's description below.
    
    **USER PROMPT**: ${prompt}
    
    **QUALITY GUIDELINES**:
    - Maintain high fidelity to the visual style of reference images unless overridden by the user prompt.
    - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
    - If multiple images are provided, intelligently fuse their elements or styles as implied by the prompt.
    - Preserve fine details: textures, material quality, lighting accuracy.
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
# Role: Imagen 图片生成 Prompt 优化大师
# Mission: 将用户提示词重构为高质量、结构化的图片生成指令。

# 黄金公式（7要素法）— 严格按此顺序输出：
# [主体描述] + [动作/状态] + [环境/场景] + [风格流派] + [光照描述] + [视角/构图] + [质量增强词]

# 核心规则：
1. **精准替换**: 将模糊词转化为具体视觉描述（如"好看" → "cinematic lighting, golden hour, soft shadows"）
2. **主体优先**: 主体描述放在最前面（Imagen 对前部内容权重更高）
3. **细节密度**: 控制在 50-150 词，避免过少（模糊）或过多（过约束）
4. **质量增强**: 末尾追加增强词（如 "high resolution, 8K, sharp focus, professional quality"）
5. **材质具体化**: 用具体材质词替换抽象描述（如"好看的衣服" → "wrinkled linen shirt, soft cotton fabric"）
6. **光照公式**: [光源类型] + [方向] + [强度] + [色温]
7. **风格一致**: 如果用户/参考图有明确风格，严格遵循
8. **语言身份**: 输入中文 → 输出中文。输入英文 → 输出英文。
9. **输出格式**: 仅返回优化后的提示词文本。不要 Markdown，不要解释。
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
    // 2. Map Definitions & Logic (Refined for Physics-Based Precision)
    const viewMap: Record<string, string> = {
      // === 1. Single Seat (单品座椅) ===
      "S1 Front View": "Camera Height: 0.9m. Angle: 0 degrees (Dead Center). Distance: 1.5m. Lens: 50mm. Composition: Perfectly symmetrical front view of the single seat. White studio background.",
      "S2 3/4 Front Angle": "Camera Height: 1.0m. Angle: 30-45 degrees from Front-Left. Lens: 50mm. Composition: Three-quarter product shot showing seat front and side bolster thickness.",
      "S3 Rear 3/4 View": "Camera Height: 1.0m. Angle: 135 degrees from Rear-Left. Lens: 50mm. Composition: Showing the back of the seat and side airbag slot. Product focus.",

      // === 2. Full Set (整套座椅) ===
      "SET1 Side View Left": "Camera Height: 1.1m (Eye Level). Angle: 90 degrees Left Profile. Lens: 85mm. Composition: Full 5-seat set arranged in studio. Flat side view.",
      "SET2 Side View Right": "Camera Height: 1.1m (Eye Level). Angle: 90 degrees Right Profile. Lens: 85mm. Composition: Full 5-seat set arranged in studio. Flat side view.",

      // === 3. Front Interior (车内前排) ===
      "F1 High-Angle Top-Down": "Camera Position: Sunroof/Ceiling. Angle: 60 degrees Downward. Lens: 24mm Wide. Composition: Bird's eye view of front seats and center console. Interior geometry visible.",
      "F2 Driver Side Profile": "Camera Position: Outside Driver Door (Open). Height: 1.1m. Angle: 10 degrees to seat profile. Lens: 35mm. Composition: Looking across driver seat towards passenger seat.",
      "F3 Passenger Front-Quarter": "Camera Position: Outside Passenger Door. Height: 1.0m. Angle: 45 degrees into cabin. Lens: 35mm. Composition: Framing both front seats from passenger side.",
      "F4 Rear-to-Front View": "Camera Position: Rear Seat Center. Height: 1.2m. Angle: 0 degrees facing forward. Lens: 28mm. Composition: Driver POV looking at front row seat backs and dashboard.",

      // === 4. Rear Interior (车内后排) ===
      "R6 Rear 3/4 View": "Camera Position: Outside Rear-Right Door. Height: 1.0m. Angle: 45 degrees towards rear bench. Lens: 35mm. Composition: Standard commercial interior shot showing rear seat capacity.",
      "R1 Rear Front Close-up": "Camera Position: Center Tunnel (Between Front Seats). Height: 0.8m. Angle: 0 degrees facing HUGE Rear Bench. Lens: 35mm. Composition: Symmetrical view of rear seats. 1-Point Perspective.",
      "R2 Rear Side Left": "Camera Position: Outside Rear-Left Door. Height: 1.0m. Angle: 45 degrees looking in. Lens: 35mm. Composition: Framing left side of rear bench.",
      "R3 Rear Side Right": "Camera Position: Outside Rear-Right Door. Height: 1.0m. Angle: 45 degrees looking in. Lens: 35mm. Composition: Framing right side of rear bench.",
      "R4 Rear Folded View": "Camera Height: 1.2m. Angle: 30 degrees down. Action: Rear seat backrest folded FLAT. Composition: Showing cargo space and seat back texture.",
      "R7 Rear Tip-Up View": "Camera Height: 0.8m. Angle: Low angle up. Action: Rear seat cushion flipped/tipped UP vertically. Composition: Showing under-seat floor space.",
      "R5 Top-Down Reclined": "Camera Position: Ceiling/Sunroof. Angle: 90 degrees Top-Down. Lens: 24mm. Composition: Layout plan view of vehicle interior.",

      // === 5. Armrest Box (扶手箱) ===
      "A01 White Background 1": "Camera: Studio Top-Down 45°. Product: Armrest Cover. Context: Floating on White. Style: Clean e-commerce catalog shot.",
      "A02 White Background 2": "Camera: Eye-Level 0°. Product: Armrest Cover. Context: Resting on White Surface. Style: Side profile showing thickness.",
      "A03 Rear Closed View": "Camera: From Rear Seat Center. Focus: Center Console (Closed). Context: Car Interior. Style: User POV.",
      "A04 Rear Open View": "Camera: From Rear Seat. Action: Armrest Lid OPEN vertical. Focus: Storage space & Cover underside. Context: Car Interior.",
      "A05 Driver Side View": "Camera: Driver Seat POV. Angle: Looking down-right at console. Focus: Armrest usage.",
      "A06 Passenger Side View": "Camera: Passenger Seat POV. Angle: Looking down-left at console. Focus: Armrest usage.",
      "A07 Top-Down View": "Camera: 90° Overhead. Focus: Grid/Diamond pattern alignment. Context: Geometric fit check.",
      "A08 Rear Diagonal": "Camera: Rear-Right Passenger POV. Angle: 45° to center console. Focus: Corner fit.",
      "A09 Material Close-up": "Camera: Macro Lens (100mm). Distance: 20cm. Focus: Texture grain & Stitching. Depth of Field: Shallow.",
      "A10 Driving Scenario": "Camera: Passenger Side. Context: Driver's arm resting on cover. Action: Driving. Vibe: Functional comfort.",
      "A11 Rear Standard": "Camera: Center Rear. Angle: Straight level. Focus: Symmetrical console alignment.",
      "A12 Pet Interaction Paws": "Camera: Eye Level. Subject: Golden Retriever Paws on Armrest. Focus: Durability/Scratch resistance.",
      "A13 Waterproof Wipe": "Camera: Close-up 45°. Action: Hand wiping water droplets. Focus: Hydrophobic surface.",
      "A14 Installation Demo": "Camera: POV or Side. Action: Hands stretching elastic band. Focus: Installation mechanism.",
      "A15 Arm Rest Comfort": "Camera: Side Profile. Subject: Elbow pressing into foam. Focus: Cushioning softness.",
      "A16 Rear Ajar View": "Camera: Low Angle Rear. Action: Lid slightly lifted (ajar). Focus: Gap tolerance.",
      "A17 Driver High Angle": "Viewpoint: High Driver. Angle: Steep down. Focus: Driver's visual confirmation of fit.",
      "A18 Pet Interaction Sitting": "subject: Golden Retriever sitting ON console. Focus: Weight bearing capacity.",

      // Legacy/Fallback mapping
      "Driver's View": "Camera Position: Driver Seat. Perspective: POV.",
      "Rear Row Perspective": "Camera Position: Rear Seat. Perspective: Forward facing.",
      "Side Open Door View": "Camera Position: Outside Door. Angle: 45 degrees.",
      "Top Down View": "Camera Position: Overhead. Angle: 90 degrees.",
      "Detail Shot of Stitching": "Camera: Macro. Focus: Texture.",
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

    // 3.4 Strict Contextual Awareness & Visual Guide Logic
    const isCloseUp = targetRow.toLowerCase().includes('close-up') ||
      targetRow.toLowerCase().includes('detail') ||
      angleInstruction.toLowerCase().includes('close-up');

    // REVERTED SPLIT LOGIC: usage of 'isLifestyleScene' is removed.
    // We treating ALL presets (including Lifestyle) as STRICT VISUAL TARGETS because the thumbnails NOW contain the correct content (dogs, hands, etc).

    const missionText = isSingleSeat
      ? `MISSION: Create a high-end commercial product catalog asset. Focus is a STANDALONE **${productCategory}**. Background must be a clean, neutral studio gradient. REMOVE all car interior distractions (dashboard, wheels, cabin walls).`
      : isCloseUp
        ? `MISSION: Create a Macro/Detail commercial photograph. Focus strictly on the **${productCategory}** texture and fit. Blur the ${carModel} interior significantly using shallow depth of field. Use a tight crop.`
        : `MISSION: Create a photorealistic automotive interior visualization. Focus is the **${productCategory}** professionally INSTALLED inside a **${year} ${carModel}**. Maintain full cabin architectural context.`;

    // 4. Construct V5.1 Prompt with explicit IMAGE MANIFEST

    // 4. Construct V5.2 Prompt with explicit IMAGE MANIFEST
    // UPGRADE: Added Perspective Lock Protocol (Nano Banana Skills)

    const v4Prompt = `
## ✅ AutoFusion™ Pro V5.2 (Product-First™ Edition)

---

# 📐 CAMERA & PERSPECTIVE LOCK [NON-NEGOTIABLE]
> **CAMERA INSTRUCTION**: ${angleInstruction}
> **CRITICAL**: The camera MUST NOT Move. Match the reference/preset angle EXACTLY.
> **PHYSICS**: DO NOT change the lens focal length or camera height.
> **COMPOSITION**: Keep the subject centered and framed exactly as described.

---

# 🚨 #1 PRIORITY: USE THE CORRECT PRODUCT 🚨

> **THE MOST IMPORTANT THING**: The ${productCategory} in your output MUST come from **Images 1-${productCount}**.
> **DO NOT** use the ${productCategory === 'Armrest Box' ? 'center console/armrest' : 'seat'} shown in Image ${guideIndex || 'the reference'} - that is a PLACEHOLDER to be REPLACED.

## 🖼️ IMAGE MANIFEST [READ THIS FIRST - CRITICAL]

| Image # | Type | What It Is |
|---------|------|------------|
${seatCoverImages.map((_, i) => `| **Image ${i + 1}** | 🛍️ **YOUR PRODUCT** | This is the **${productCategory}** you MUST put in the final image. OBSERVE its exact appearance and copy it EXACTLY as shown. |`).join('\n')}
${visualGuide ? `| **Image ${guideIndex}** | 📐 Scene Template | This shows the CAMERA ANGLE and SCENE LAYOUT only. The ${productCategory === 'Armrest Box' ? 'armrest/console' : 'seat cover'} in this image is NOT your product - REMOVE IT and PUT your product (from Images 1-${productCount}) in its place. |` : ''}

### 🔴 CRITICAL UNDERSTANDING 🔴

**Your task is a PRODUCT REPLACEMENT task:**
- Image ${guideIndex || 'the reference'} contains a ${productCategory === 'Armrest Box' ? 'plain/generic center console armrest' : 'vehicle seat'}
- You must REMOVE that and REPLACE it with the ${productCategory} from Images 1-${productCount}
- The ${productCategory} in Images 1-${productCount} is a **COVER/ACCESSORY** - LOOK at the images to see its exact appearance (could be smooth, quilted, patterned, or any other texture - copy what you SEE)

**Think of it like this:**
- Images 1-${productCount} = The "sticker/wrap" to apply
- Image ${guideIndex || 'reference'} = The "base surface" location and angle

⛔ If your output shows the ORIGINAL ${productCategory === 'Armrest Box' ? 'Tesla/car console WITHOUT the cover from Images 1-' + productCount : 'uncovered seat'}, you have FAILED.
✅ If your output shows the ${productCategory} from Images 1-${productCount} INSTALLED in the scene, you have SUCCEEDED.

---

⚠️ **PRIORITY ORDER (STRICT)** ⚠️

| Priority | Task | Source |
|----------|------|--------|
| **#1 HIGHEST** | Use the correct ${productCategory} product | Images 1-${productCount} |
| **#2** | Match the camera angle/composition | ${visualGuide ? `Image ${guideIndex}` : angleId} |
| **#3** | Render correct vehicle interior | ${year} ${carModel} |

**SYSTEM**: AutoFusion™ Pro V5.2 - Perspective Locked
**CONTEXT**: ${isSingleSeat ? "STANDALONE_CATALOG" : "INTERIOR_INTEGRATION"}
**PRODUCT_TYPE**: **${productCategory}** (MUST come from Images 1-${productCount})

---

## 🛍️ 1. PRODUCT INSTALLATION [#1 HIGHEST PRIORITY]

> **THIS IS YOUR PRIMARY TASK**: Install the ${productCategory} from Images 1-${productCount} into the scene.

**LOOK AT IMAGES 1-${productCount} CAREFULLY** - These show your product:
- **OBSERVE** the exact texture, color, and surface pattern from the uploaded images
- **COPY** every visual detail exactly as shown - DO NOT assume or add features
- **MATCH** the material appearance (glossy/matte, smooth/textured, plain/patterned)
- The product is designed to WRAP OVER/COVER the original ${productCategory === 'Armrest Box' ? 'center console armrest' : 'vehicle seat'}

**⚠️ DO NOT ASSUME the product has any specific pattern:**
- Only include patterns/textures that are VISIBLE in Images 1-${productCount}
- If the product appears smooth/plain, render it as smooth/plain
- If the product has quilting, render quilting
- If the product has other patterns, render those patterns
- **COPY EXACTLY** what you see - no additions, no assumptions

**Installation visualization**:
- The ${productCategory} COVERS/WRAPS the original ${productCategory === 'Armrest Box' ? 'armrest lid' : 'seat'} 
- It should look INSTALLED and IN-USE, not floating
- The original OEM surface is HIDDEN beneath the cover

⛔ **WRONG**: Showing the bare ${productCategory === 'Armrest Box' ? 'Tesla armrest without the cover' : 'uncovered seat'}
⛔ **WRONG**: Adding patterns/textures that are NOT in Images 1-${productCount}
✅ **RIGHT**: Showing the EXACT product from Images 1-${productCount} wrapped/installed on the surface

---

## 📐 2. SCENE & COMPOSITION [PRIORITY #2 - CAMERA ANGLE]

**ANGLE_ID**: ${angleId}
**SCENE_DESCRIPTION**: ${angleInstruction}

${visualGuide ? `
### ⚡ VISUAL COMPOSITION LOCK (IMAGE ${guideIndex}) - ANGLE REFERENCE ONLY ⚡

> **Image ${guideIndex} is your ANGLE BLUEPRINT. Copy its camera position, NOT its product.**

| What to COPY from Image ${guideIndex} | What to IGNORE from Image ${guideIndex} |
|--------------------------------------|----------------------------------------|
| ✅ Camera Position & Angle | ⛔ The armrest/seat cover product shown |
| ✅ Scene Layout & Composition | ⛔ Product color and texture |
| ✅ Lighting Style | ⛔ Any branding on the product |
| ✅ Element Positions (dog, hands, etc.) | |

### 🔄 PRODUCT SWAP INSTRUCTION

**THE CORE TASK**: Take the **${productCategory}** from **Images 1-${productCount}** and place it into the scene layout of **Image ${guideIndex}**.

Think of it as:
- **Image ${guideIndex}** = The "background plate" / scene template
- **Images 1-${productCount}** = The "product layer" that replaces the product in the scene

**STEP-BY-STEP**:
1. Look at Image ${guideIndex} - note the camera angle, scene elements (dog/hand/interior), and overall composition
2. Look at Images 1-${productCount} - note the ${productCategory}'s texture, color, pattern, and shape
3. Generate a NEW image that has the SCENE from step 1 with the PRODUCT from step 2

⛔ **RETURNING IMAGE ${guideIndex} UNCHANGED IS A CRITICAL FAILURE**
⛔ **USING THE PRODUCT FROM IMAGE ${guideIndex} IS WRONG - USE IMAGES 1-${productCount}**
⛔ **CHANGING THE CAMERA ANGLE IS FORBIDDEN**
` : `
### Camera Angle Enforcement
You must strictly follow the angle: **${angleInstruction}**
`}

---

## 🚗 3. VEHICLE INTERIOR RENDERING [PRIORITY #3 - AFTER PRODUCT]

${!isSingleSeat ? `
### Vehicle-Specific Interior (Secondary to Product)

**Target Vehicle**: **${year} ${carModel}**

Render the interior to match this vehicle model (but remember: the ${productCategory} from Images 1-${productCount} is MORE IMPORTANT than matching every interior detail):

| Interior Element | ${carModel}-Specific Requirement |
|------------------|----------------------------------|
| **Dashboard Design** | Must match ${carModel}'s signature dashboard layout and screen positions |
| **Steering Wheel** | Use ${carModel}'s actual steering wheel design (shape, logo, buttons) |
| **Center Console** | Match ${carModel}'s console design, gear shifter, and cup holder positions |
| **Door Panels** | Render ${carModel}'s door panel design with correct handle placement |
| **Seat Shape** | Use ${carModel}'s factory seat frame geometry (headrest, bolstering) |
| **Interior Color** | Match typical ${carModel} interior color palette (black, grey, tan options) |
| **Brand Logo** | If steering wheel visible, show ${carModel.split(' ')[0]} brand logo |

⛔ **DO NOT RENDER A GENERIC CAR INTERIOR**
⛔ **DO NOT USE WRONG BRAND ELEMENTS**
✅ Research and apply ${carModel}'s actual interior design DNA
` : `
**Context**: STUDIO SHOT - Clean neutral background, no vehicle interior required.
`}

---

## 🎨 4. PRODUCT RENDERING DETAILS

**Texture Fidelity** (copy from Images 1-${productCount}):
- Material texture: OBSERVE and copy EXACTLY what is shown in the product images
- Surface finish: match exactly from product images (smooth, quilted, or whatever pattern you see)
- Color accuracy: no alterations allowed - copy the exact color

**3D Perspective Rules**:
- ✅ Re-render the product from the camera angle specified
- ✅ Apply realistic lighting and shadows
- ⛔ Do not modify the product's design, pattern, or color
- ⛔ Do not distort the product shape to fit the angle - use correct perspective.

---

## 🎯 5. MISSION

${missionText}

${customRequest ? `
### 🗨️ USER CUSTOM REQUEST [HIGH PRIORITY]
> "**${customRequest}**"

Execute this user request while maintaining all other constraints.
` : ""}

---

## 🎨 6. MATERIAL & LIGHTING PROTOCOL

| Component | Protocol |
|-----------|----------|
| **PRODUCT** | **MATCH REFERENCE EXACTLY**. No color shift. Preserve all texture details. |
| **LIGHTING** | Professional automotive photography lighting. Soft diffused key light. Natural shadows. |
| **FINISH** | Photorealistic texture. Visible leather grain / fabric weave. NO 3D-render smoothness. |
| **OVERALL** | The final image must look like a REAL PHOTOGRAPH, not CGI or illustration. |

---

## 🛠️ 7. INSTALLATION LOGIC

${productCategory === "Armrest Box" ? `
- **SHAPE**: Duplicate the curvature and rigid 3D form from [PRODUCT MASTER].
- **PLACEMENT**: ${isSingleSeat ? "Neutral studio surface." : "Fits perfectly on the " + carModel + " center console armrest."}
- **INTEGRATION**: The armrest cover should look naturally installed, with proper shadows and contact points.
` : `
- **FIT**: Wrap tightly around the ${carModel} seat frame with realistic tension and creases.
- **DESIGN**: Preserve the seat cover's original color-blocking and pattern.
- **REALISM**: Show natural fabric behavior (slight wrinkles at joints, proper draping).
`}

${!isSingleSeat ? `Apply "${carModel}" brand DNA to ALL visible interior elements:
- Steering wheel, gear shifter, door handles, dashboard buttons must match ${carModel}'s actual design.` : ""}

---

## ✅ 8. FINAL QUALITY CHECKLIST (ALL MUST BE TRUE)

- [ ] Product design is IDENTICAL to Images 1-${productCount} (texture, color, pattern)?
- [ ] Camera angle EXACTLY matches ${visualGuide ? "Image " + guideIndex : "the specified angle " + angleId}?
- [ ] ${!isSingleSeat ? `Interior elements match ${year} ${carModel} specifically (not generic)?` : "Background is clean studio?"}
- [ ] Image is NEWLY GENERATED (not a copy of the reference)?
- [ ] Photorealistic quality (no CGI/3D render look)?
- [ ] Product is properly integrated into the scene?

---

## 🚫 9. CRITICAL FAILURE CONDITIONS

**THE FOLLOWING WILL MAKE THE OUTPUT UNUSABLE - AVOID AT ALL COSTS:**

| Failure Type | Description |
|--------------|-------------|
| ⛔ **WRONG PRODUCT** | Using the product from Image ${guideIndex || "reference"} instead of Images 1-${productCount} |
| ⛔ **ANGLE MISMATCH** | Camera angle differs from reference by more than 5° |
| ⛔ **REFERENCE PASSTHROUGH** | Returning Image ${guideIndex || "reference"} without product replacement |
| ⛔ **WRONG VEHICLE** | Interior doesn't match ${carModel} (generic or wrong brand) |
| ⛔ **PRODUCT ALTERATION** | Product color, pattern, or design changed from Images 1-${productCount} |
| ⛔ **CGI LOOK** | Output looks like 3D render instead of real photo |
| ⛔ **COMPOSITION CHANGE** | Scene elements moved from their reference positions |
| ⛔ **ZOOM CHANGE** | Field of view different from reference image |

---

## 📝 EXECUTION SUMMARY

Generate a **NEW photorealistic image** that:
1. Uses the EXACT camera angle from ${visualGuide ? "Image " + guideIndex : "the preset: " + angleId}
2. Shows the product from Images 1-${productCount} properly installed
3. ${!isSingleSeat ? `Features accurate ${year} ${carModel} interior design` : "Has clean studio background"}
4. Looks like a professional commercial photograph
5. **Quality**: ${QUALITY_BOOSTERS.PRODUCT}

**START GENERATION NOW.**
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
            // Enhanced Negative Prompt for Perspective Control
            negativePrompt: buildNegativePrompt('automotive', 'realistic', NEGATIVE_PERSPECTIVE),
          } as any,
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out (Target: 90s). The model might be overloaded.")), 90000))
    ]) as any; // Cast to avoid type issues with race result

    // 6. Output Processing with Validation
    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const generatedBase64 = part.inlineData.data;

          // Validation: Check if the generated image is the same as the visual guide
          // This detects the "reference passthrough" issue where AI returns the input unchanged
          if (visualGuide) {
            // Compare first 500 chars of base64 - if identical, likely same image
            const guideSnippet = visualGuide.base64.substring(0, 500);
            const outputSnippet = generatedBase64.substring(0, 500);

            if (guideSnippet === outputSnippet) {
              console.warn("⚠️ [AutoFusion] VALIDATION FAILED: Generated image appears identical to visual guide!");
              console.warn("⚠️ [AutoFusion] This may indicate the model returned the reference without product replacement.");
              // Continue anyway - user can regenerate, but log the issue
            } else {
              console.log("✅ [AutoFusion] Validation passed: Generated image differs from visual guide.");
            }
          }

          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${generatedBase64}`,
          );
        }
      }
    }

    // Log generation result
    if (images.length > 0) {
      console.log(`✅ [AutoFusion] Successfully generated ${images.length} image(s) for ${year} ${carModel}`);
    } else {
      console.warn("⚠️ [AutoFusion] No images were generated. The model may have refused the request.");
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
      4. Blend edges naturally — no visible seams, no color mismatch.
      5. ${QUALITY_BOOSTERS.RETOUCHING}
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

    // Wrap raw prompt with structured editing template
    const enhancedEditPrompt = `
    **ROLE**: Professional Photo Editor.
    **TASK**: Edit the provided image according to the instruction below.
    ${referenceImages.length > 0 ? `**REFERENCES**: ${referenceImages.length} reference image(s) provided for style/content guidance.` : ''}
    
    **EDIT INSTRUCTION**: ${prompt}
    
    **QUALITY**: ${QUALITY_BOOSTERS.RETOUCHING}
    **CONSTRAINT**: Preserve all unedited areas exactly. Only modify what the instruction requests.
    `;

    parts.push({ text: enhancedEditPrompt });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: options.aspectRatio,
          imageSize: options.resolution || "1K",
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
            You are an Expert Image Extender — seamless quality is paramount.
            
            Image 1: The input image with a transparent/white border.
            Image 2: A mask where BLACK is the original image (KEEP) and WHITE is the empty space (FILL).
            
            TASK: Outpaint / Expand the image.
            1. Fill the WHITE area of the mask with new content.
            2. The new content MUST seamlessly blend with the edges of the original image (Black area).
            3. Match lighting direction, color temperature, and texture style exactly.
            4. Context: ${description}
            5. Do NOT modify the original image content inside the Black mask area.
            6. Quality: ${QUALITY_BOOSTERS.RETOUCHING}
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

/**
 * 8. Generate Style Replication Image
 * Uses gemini-3-pro-image-preview
 * 
 * This function takes a style reference image and product images,
 * then generates new images that apply the reference style to the products.
 */
export const generateStyleReplication = async (
  styleReference: { base64: string; mime: string },
  productImages: { base64: string; mime: string }[],
  customPrompt?: string,
  options: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    count?: number;
    model?: string;
    retouch?: boolean;
  } = {}
): Promise<string[]> => {
  const ai = getAiClient();
  const { aspectRatio = "1:1", resolution = "2K", count = 1, model = "gemini-3-pro-image-preview", retouch = false } = options;

  // Build the prompt for style replication
  const productCount = productImages.length;
  // Indexing starts at 1. 
  // Product Images: 1 to productCount
  // Style Reference: productCount + 1

  const prompt = `
[任务] 复刻图片${productCount + 1}的【排版布局】与【视觉风格】。
[输入] 图片1-${productCount}是产品素材，图片${productCount + 1}是设计参考。
[要求]
1. 布局结构：必须与参考图完全一致（保持原有的排版、色块、文字位置）。
2. 主体替换：将参考图中的商品替换为图片1-${productCount}中的产品。保持原有透视与光影。
3. ${customPrompt ? `场景/背景：${customPrompt}` : '场景/背景：保持参考图的原始风格。'}
4. 输出：仅生成一张高质量的最终设计图。
5. 质量：高分辨率、锐利细节、专业商业品质、色彩准确、无伪影。

请直接生成图片。
`;

  // DEBUG: Log the customPrompt value
  console.log('[StyleReplication] customPrompt:', customPrompt);
  console.log('[StyleReplication] productCount:', productCount);

  // Build parts array
  // 1. Add text prompt FIRST (Best practice for many multimodal models)
  // [任务]... [输入]...
  const parts: any[] = [];
  parts.push({ text: prompt });

  // 2. Add product images
  for (const img of productImages) {
    parts.push({
      inlineData: {
        mimeType: img.mime,
        data: img.base64,
      },
    });
  }

  // 3. Add style reference image
  parts.push({
    inlineData: {
      mimeType: styleReference.mime,
      data: styleReference.base64,
    },
  });

  // DEBUG: Log full prompt when customPrompt is provided
  if (customPrompt) {
    console.log('[StyleReplication] ⚡ 客户指示检测到:', customPrompt);
    console.log('[StyleReplication] Full prompt being sent:\n', prompt);
  }


  // Helper to run generation
  const runGeneration = async (modelName: string) => {
    console.log(`[StyleReplication] Attempting generation with model: ${modelName}, Resolution: ${resolution}, Aspect: ${aspectRatio}`);

    const config: any = {
      temperature: 0.2,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution, // Must be '1K', '2K', or '4K'
      }
    };

    return await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts }],
      config: config,
    });
  };

  const results: string[] = [];

  // Generate the requested number of images
  for (let i = 0; i < count; i++) {
    try {
      console.log(`[StyleReplication] Generating image ${i + 1}/${count}...`);

      let response;
      try {
        response = await runGeneration(model);
      } catch (err) {
        console.warn(`[StyleReplication] Primary model ${model} failed, trying fallback to gemini-2.0-flash-exp`);
        response = await runGeneration("gemini-2.0-flash-exp");
      }

      // Extract the image from response
      const candidate = response.candidates?.[0];
      if (!candidate) {
        console.error(`[StyleReplication] No candidates returned for image ${i + 1}`);
        console.log('[StyleReplication] Full Response:', JSON.stringify(response, null, 2));
        continue;
      }

      console.log(`[StyleReplication] Finish Reason: ${candidate.finishReason}`);

      // Log text content if any (might contain refusal reason or error description)
      const textPart = candidate.content?.parts?.find((p: any) => p.text);
      if (textPart) {
        console.log(`[StyleReplication] Model Text Response: ${textPart.text}`);
      }

      const imagePart = candidate.content?.parts?.find(
        (p: any) => p.inlineData?.mimeType?.startsWith("image/")
      );

      if (imagePart?.inlineData?.data) {
        results.push(imagePart.inlineData.data);
        console.log(`[StyleReplication] Image ${i + 1} generated successfully`);
      } else {
        console.warn(`[StyleReplication] Image ${i + 1} generation returned no image`);
        console.log('[StyleReplication] Candidate content:', JSON.stringify(candidate.content, null, 2));
      }
    } catch (error) {
      console.error(`[StyleReplication] Image ${i + 1} generation failed:`, error);
      // Continue with other images even if one fails
    }
  }

  if (results.length === 0) {
    throw new Error("Style replication failed - no images generated");
  }

  return results;
};
