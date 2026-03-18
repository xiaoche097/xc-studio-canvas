import { GoogleGenAI, LiveServerMessage, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AspectRatio, ImageResolution } from "../types";
import { QUALITY_BOOSTERS, buildNegativePrompt, enhancePrompt, SCENE_POOL, TEXTURE_KEYWORDS, NEGATIVE_PERSPECTIVE, getAngleNegative, getAngleLens, LENS_SIMULATION } from "./promptUtils";

// 导入工具函数和类型定义
import {
  getApiConfig,
  getAiClient,
  getActiveApiInfo,
  executeWithTimeout,
  blobToBase64,
  compressImage,
  decodeAudioData,
  floatTo16BitPCM,
  API_TIMEOUT_MS
} from "../utils/apiHelpers";

import type {
  GeminiResponse,
  ImageGenerationConfig,
  ImageReference,
  ProductAnalysisResult,
  GenerationOptions
} from "../types/gemini.types";

// ==================== 已删除重复定义 ====================
// getApiConfig, getAiClient, getActiveApiInfo, blobToBase64, compressImage, decodeAudioData
// 现在从 ../utils/apiHelpers.ts 导入使用

// 导出getActiveApiInfo以保持向后兼容
export { getActiveApiInfo };

// 导出blobToBase64以保持向后兼容
export { blobToBase64 };

// 导出compressImage以保持向后兼容
export { compressImage };

// 导出decodeAudioData以保持向后兼容
export { decodeAudioData };

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

    const response = await executeWithTimeout(
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
      })
    );

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
 * Supports dynamic model selection and automatic API key rotation on failure.
 */
export const generateImageToImage = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
  options: { 
    aspectRatio?: AspectRatio; 
    resolution?: ImageResolution;
    modelId?: string; // NEW: Dynamic model support
  } = {}
) => {
  const retryLimit = 3;
  let lastError: any = null;
  
  // Get initial config to know how many keys we have
  const initialConfig = getApiConfig();
  const maxRetries = Math.min(initialConfig.keyCount, 3); // Max retry across 3 keys or total keys

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const config = getApiConfig(initialConfig.currentIndex + attempt);
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: config.isYunwu ? { baseUrl: config.baseUrl } : undefined,
      apiVersion: config.apiVersion as any
    });

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

      // Use selected model or fallback
      let targetModel = options.modelId || "gemini-3-pro-image-preview";

      // 柏拉图模型映射逻辑 (nanobanana2)
      if (config.isPlato && targetModel === "gemini-3.1-flash-image-preview") {
          if (options.resolution === ImageResolution.RES_05K) targetModel = "gemini-3.1-flash-image-preview-512px";
          else if (options.resolution === ImageResolution.RES_2K) targetModel = "gemini-3.1-flash-image-preview-2k";
          else if (options.resolution === ImageResolution.RES_4K) targetModel = "gemini-3.1-flash-image-preview-4k";
          console.log(`[Plato Model Mapping] Mapped ${options.resolution} to ${targetModel}`);
      }

      // Calculate dynamic timeout: 4K/2K generation is slow, 180s. Others 120s.
      const generationTimeout = (options.resolution === ImageResolution.RES_4K || options.resolution === ImageResolution.RES_2K) ? 180000 : 120000;

      const response = await executeWithTimeout(
        ai.models.generateContent({
          model: targetModel,
          contents: { parts: parts },
          config: {
            imageConfig: {
              aspectRatio: options.aspectRatio || "1:1",
              imageSize: (options.resolution === ImageResolution.RES_05K ? 512 : (options.resolution || "1K")) as any,
            },
          },
        }),
        { timeoutMs: generationTimeout }
      );

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

    } catch (error: any) {
      lastError = error;
      console.warn(`[API Retry] Attempt ${attempt + 1} failed with key ${config.currentIndex + 1}. Error:`, error.message);
      
      // Handle specific status codes or error messages
      const isPathError = error.message?.includes('invalid_request') || error.message?.includes('404') || error.message?.includes('API 路径');
      const isServiceError = error.status === 503 || error.message?.includes('503');
      
      if (isPathError || isServiceError) {
        console.error(`[API Critical] ${error.message}${config.isPlato ? ' (Plato)' : ''}. Stopping retries.`);
        break; // 不再切换 Key 重试，因为模型名/路径错误换 Key 也没用
      }
      
      // If it's a rate limit or auth error, try next key immediately
      if (error.status === 429 || error.status === 401 || error.message?.includes('429') || error.message?.includes('401')) {
        continue; 
      }
      
      // For other errors, if we have more keys, try one more
      if (attempt < maxRetries - 1) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Image-to-Image generation failed after multiple attempts.");
};

/**
 * 4. Optimize Prompt using Expert Persona
 * Skill: # Role_ 用户 (1).md
 */
/**
 * 4. Optimize Prompt using Prompt Optimization Agent (Nano Banana Edition)
 * Skill: Imagen 3.0 (Nano Banana) Skills - Golden Formula & Quality Boosters
 */
export const optimizePrompt = async (rawPrompt: string, refImages?: { base64: string; mimeType: string }[], refineInstruction?: string): Promise<string> => {
  const ai = getAiClient();
  if (!rawPrompt && (!refImages || refImages.length === 0)) return "";

  // Precision Description Expert - System Prompt (V2.1.0)
  const skillSystemPrompt = `
# Role: User Prompt Precision Description Expert (Based on Imagen 3.0 Nano Banana Skills)

## Profile
- Author: AntiGravity
- Version: 2.1.0
- Language: Auto-detect (Output in the same language as user input: Chinese or English)
- Description: Specialized in transforming vague, generic user prompts into precise, specific, and targeted image generation prompts.

## 🧠 COGNITIVE PROTOCOL (Internal Thought Process)
1. **ANALYZE**: Identify abstract concepts (e.g., "nice photo", "cool car") and missing elements in the user's input.
2. **EXPAND**: Use the "Golden Formula" to structure the prompt:
   - **[Subject]** + **[Action]** + **[Environment]** + **[Style]** + **[Lighting]** + **[Camera]** + **[Quality]**
3. **REFINE**: Replace generic terms with professional terminology from the Knowledge Base.

## 📚 INTERNAL KNOWLEDGE BASE (Reference Standards)

### 1. 💡 Lighting & Atmosphere
- **Natural**: Golden hour (warm/soft), Blue hour (cool/moody), Overcast (soft/diffused), Dappled sunlight (playful shadows).
- **Artificial**: Studio lighting (clean/professional), Neon lights (cyberpunk/vibrant), Volumetric lighting (god rays/atmospheric), Cinematic lighting (dramatic contrast).

### 2. 📷 Camera & Composition
- **Angles**: Eye-level (neutral), Low angle (heroic/imposing), High angle (vulnerable/overview), Dutch angle (dynamic/unsettling), Top-down (flat lay).
- **Lenses**: Wide angle (14-24mm, vastness), Standard (35-50mm, natural), Portrait (85mm, flattering), Macro (100mm, details).
- **Framing**: Rule of thirds, Symmetrical center, Leading lines, Depth of field (bokeh).

### 3. 🎨 Art & Photography Styles
- **Photography**: Editorial, Commercial Product, Street Photography, Architectural, Analog Film (Kodak Portra 400), Long Exposure.
- **Art/Illustration**: Digital Illustration, Oil Painting, Watercolor, Anime/Manga, Cyberpunk, Steampunk, Minimalist, 3D Render (Octane).

### 4. 💎 Quality Boosters (Append these for high fidelity)
- "8K resolution, highly detailed, sharp focus, professional photography, masterpiece, photorealistic, intricate textures, award-winning."

## 🎯 EXECUTION RULES
1. **Precision**: Convert "pretty" -> "ethereal beauty, soft lighting"; "big building" -> "towering skyscraper, brutalist architecture".
2. **Subject First**: Ensure the main subject is described immediately at the start.
3. **No Fluff**: Do not output conversational text. **OUTPUT ONLY THE OPTIMIZED PROMPT**.
4. **Length**: Target 75-150 words of dense, descriptive content.

## 🌟 OUTPUT FORMAT
Return **ONLY** the optimized prompt text.
NO "Here is the prompt:" prefixes.
NO markdown code blocks.
Just the raw text.
`;

  try {
    const parts: any[] = [{ text: skillSystemPrompt }];

    // Add Reference Images if provided (Style Analysis)
    if (refImages && refImages.length > 0) {
      refImages.forEach(img => {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        });
      });
      parts.push({ text: `[VISUAL CONTEXT]: The user has provided ${refImages.length} reference images. \n**CRITICAL**: Analyze their Art Style, Lighting, and Composition. \nYour optimized prompt MUST adopt these visual characteristics while keeping the user's text subject.` });
    }

    // Construct User Input
    let userMessage = `[USER INPUT]: "${rawPrompt}"`;
    if (refineInstruction) {
      userMessage += `\n\n[REFINEMENT INSTRUCTION]: The user wants to adjust the previous prompt. \nInstruction: "${refineInstruction}" \n\nPlease rewrite the prompt to incorporate this change while maintaining high quality.`;
    }

    parts.push({ text: userMessage });

    // Use gemini-3.1-flash-lite-preview for fast reasoning & text generation
    const modelName = "gemini-3.1-flash-lite-preview";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: parts
      }
    });

    const optimizedText = response.text?.trim();
    // Clean up any potential markdown if the model disobeys
    const cleanText = optimizedText?.replace(/^```(markdown|text)?\n/, '').replace(/\n```$/, '') || rawPrompt;

    return cleanText;
  } catch (e) {
    console.error("Prompt optimization failed", e);
    return rawPrompt; // Fallback to original
  }
};

/**
 * Specialized Image-to-Image Prompt Optimization (Add/Remove/Replace/Enhance)
 * Based on "图生图专业优化.md"
 */
export const optimizeImageToImagePrompt = async (rawPrompt: string): Promise<string> => {
  const ai = getAiClient();
  if (!rawPrompt) return "";

  const systemPrompt = `
# Role: Image-to-Image Prompt Optimization Expert (Based on Professional Guidelines)

## Profile
- Author: prompt-optimizer (Integrated)
- Version: 1.0.0
- Language: Auto-detect (Output in same language as input)
- Description: Specialized in transforming user modification requests into precise Image-to-Image (Inpainting/Editing) prompts.

## 🧠 CORE INTENT RECOGNITION (Critical)
You must analyze the user's request to identify their core intent:
1. **ADD**: User wants to insert a new element that doesn't exist. -> Output: "Add [Object] at [Location]..."
2. **REMOVE**: User wants to delete/remove an element. -> Output: "Remove [Object], naturally fill background..."
3. **REPLACE**: User wants to swap an element. -> Output: "Replace [Object] with [New Object]..."
4. **ENHANCE**: User wants to improve an existing feature. -> Output: "Enhance [Feature] to be [Adjective]..."

## 🎯 GENERATION RULES
1. **Targeting**: The user's prompt is their DESIRED RESULT, not a description of the current image.
2. **Format**: Output a clear, direct command in natural language.
3. **Style Consistency**: ALWAYS imply that the new element must match the original image's lighting, perspective, and style.
4. **No Fluff**: Output **ONLY** the optimized prompt text. No "Intent:", no explanation.

## 📝 TEMPLATE EXAMPLES
- **Add**: "Add a vintage vase on the wooden table, casting realistic shadows, ensuring consistent lighting."
- **Remove**: "Remove the pedestrians from the background, naturally inpainting the street texture to match surroundings."
- **Replace**: "Replace the red sports car with a blue sedan, maintaining the original angle and reflection."
- **Enhance**: "Enhance the sunset glow, making colors more vibrant and dramatic while keeping the silhouette details."
`;

  try {
    const modelName = "gemini-3.1-flash-lite-preview"; // Use Flash for speed
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: systemPrompt },
          { text: `[USER REQUEST]: "${rawPrompt}" \n\n[OPTIMIZED IMG2IMG PROMPT]:` }
        ]
      }
    });

    const optimizedText = response.text?.trim();
    // Clean up
    const cleanText = optimizedText?.replace(/^```(markdown|text)?\n/, '').replace(/\n```$/, '') || rawPrompt;
    return cleanText;

  } catch (e) {
    console.error("Img2Img optimization failed", e);
    return rawPrompt;
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
      "S1 Front View": "Camera Height: 0.9m. Angle: 0° dead center. Distance: 1.5m. Shot on 50mm standard lens, f/4. Composition: Perfectly symmetrical front view, centered composition. Spatial Anchors: headrest centered at top, seat cushion centered at bottom, armrests symmetric left-right. White studio background.",
      "S2 3/4 Front Angle": "Camera Height: 1.0m. Angle: 30-45° from front-left. Shot on 50mm lens, f/4. Composition: Three-quarter product shot. Spatial Anchors: left bolster prominent in foreground, right side receding. Seat front face and side thickness both visible.",
      "S3 Rear 3/4 View": "Camera Height: 1.0m. Angle: 135° from rear-left. Shot on 50mm lens, f/4. Composition: Rear three-quarter view. Spatial Anchors: seatback rear surface dominant, side airbag slot visible on near side.",

      // === 2. Full Set (整套座椅) ===
      "SET1 Side View Left": "Camera Height: 1.1m eye level. Angle: 90° pure left profile. Shot on 85mm portrait lens, f/2.8. Composition: Full 5-seat set, flat side view. Spatial Anchors: all seats in a horizontal row, front seats left, rear bench right.",
      "SET2 Side View Right": "Camera Height: 1.1m eye level. Angle: 90° pure right profile. Shot on 85mm portrait lens, f/2.8. Composition: Full 5-seat set, flat side view. Spatial Anchors: mirror of SET1.",

      // === 3. Front Interior (车内前排) ===
      "F1 High-Angle Top-Down": "Camera Position: Sunroof/ceiling, looking straight down into cabin. Angle: 60° steep downward. Shot on 24mm wide-angle lens, f/8, deep focus. Composition: Bird's eye view, symmetrical layout. Spatial Anchors: steering wheel at top-center, center console running vertically through middle, driver seat on left half, passenger seat on right half. Dashboard at very top edge.",
      "F2 Driver Side Profile": "Camera Position: Outside open driver door. Height: 1.1m. Angle: 10° slight inward, near-profile. Shot on 35mm lens, f/5.6. Composition: Side view across driver seat. Spatial Anchors: driver seat fills left 60% of frame, passenger seat visible in background right, steering wheel at upper-left, door frame on far left edge.",
      "F3 Passenger Front-Quarter": "Camera Position: Outside passenger door. Height: 1.0m. Angle: 45° into cabin. Shot on 35mm lens, f/5.6. Composition: Both front seats visible at 3/4 angle. Spatial Anchors: passenger seat in right foreground, driver seat in left background, center console between them, dashboard across the top.",
      "F4 Rear-to-Front View": "Camera Position: Rear seat center. Height: 1.2m. Angle: 0° facing forward. Shot on 28mm wide lens, f/8. Composition: Looking forward from back seat. Spatial Anchors: two front seatbacks filling left and right halves, center console between them, dashboard and windshield visible above seatbacks.",

      // === 4. Rear Interior (车内后排) ===
      "R6 Rear 3/4 View": "Camera Position: Outside rear-right door. Height: 1.0m. Angle: 45° towards rear bench. Shot on 35mm lens, f/5.6. Composition: Standard commercial interior shot. Spatial Anchors: rear bench seat fills center, door opening frames the shot, B-pillar visible on right edge.",
      "R1 Rear Front Close-up": "Camera Position: Center tunnel between front seats. Height: 0.8m. Angle: 0° facing rearward. Shot on 35mm lens, f/5.6. Composition: Symmetrical 1-point perspective of rear bench. Spatial Anchors: rear bench perfectly centered, left and right sections symmetric, rear headrests at top, seat cushion at bottom.",
      "R2 Rear Side Left": "Camera Position: Outside rear-left door. Height: 1.0m. Angle: 45° looking in from left. Shot on 35mm lens, f/5.6. Composition: Left side of rear bench emphasized. Spatial Anchors: left rear seat fills foreground, center and right seats recede.",
      "R3 Rear Side Right": "Camera Position: Outside rear-right door. Height: 1.0m. Angle: 45° looking in from right. Shot on 35mm lens, f/5.6. Composition: Right side of rear bench emphasized. Spatial Anchors: right rear seat fills foreground, center and left seats recede.",
      "R4 Rear Folded View": "Camera Height: 1.2m. Angle: 30° downward. Shot on 35mm lens, f/5.6. Action: Rear seat backrest folded FLAT. Spatial Anchors: flat seatback surface dominates lower 2/3, cargo area visible behind.",
      "R7 Rear Tip-Up View": "Camera Height: 0.8m. Angle: Low angle upward. Shot on 35mm lens, f/5.6. Action: Rear seat cushion flipped UP vertically. Spatial Anchors: upright cushion surface fills center frame, floor area visible below.",
      "R5 Top-Down Reclined": "Camera Position: Ceiling/sunroof. Angle: 90° straight down. Shot on 24mm wide-angle lens, f/8. Composition: Overhead plan view. Spatial Anchors: front seats at top, rear seats at bottom, center console as vertical divider, all seats visible in layout.",

      // === 5. Armrest Box (扶手箱) ===
      "A01 White Background 1": "Camera: Studio, 45° above. Shot on 50mm standard lens, f/4. Composition: E-commerce catalog shot, product floating on white. Spatial Anchors: armrest cover centered, slight shadow below.",
      "A02 White Background 2": "Camera: Eye-level 0°. Shot on 50mm lens, f/4. Composition: Side profile on white surface. Spatial Anchors: product at center, showing height/thickness profile.",
      "A03 Rear Closed View": "Camera: From rear seat center, eye level. Shot on 35mm lens, f/5.6. Composition: User POV looking at center console, lid closed. Spatial Anchors: console centered in frame, front seats flanking left-right, dashboard above.",
      "A04 Rear Open View": "Camera: From rear seat. Shot on 35mm lens, f/5.6. Action: Armrest lid OPEN vertical. Spatial Anchors: open lid forms vertical element, storage compartment visible below lid.",
      "A05 Driver Side View": "Camera: Driver seat POV, looking down-right. Shot on 35mm lens, f/5.6. Spatial Anchors: console in lower-right of frame, steering wheel at left, gear shifter nearby.",
      "A06 Passenger Side View": "Camera: Passenger seat POV, looking down-left. Shot on 35mm lens, f/5.6. Spatial Anchors: console in lower-left of frame, dashboard ahead.",
      "A07 Top-Down View": "Camera: 90° directly overhead. Shot on 24mm wide-angle lens, f/8. Composition: Geometric top-down. Spatial Anchors: armrest cover centered, pattern alignment visible, surrounding console edges frame it.",
      "A08 Rear Diagonal": "Camera: Rear-right passenger POV. Angle: 45° to center console. Shot on 35mm lens, f/5.6. Spatial Anchors: console at 3/4 angle, corner fit visible.",
      "A09 Material Close-up": "Camera: 20cm distance. Shot on 100mm macro lens, f/2.8, shallow DOF. Composition: Extreme close-up of texture. Spatial Anchors: leather grain/fabric weave fills entire frame, stitching lines visible.",
      "A10 Driving Scenario": "Camera: Passenger side perspective. Shot on 35mm lens, f/5.6. Context: Driver's arm resting on cover. Spatial Anchors: arm on armrest at center, steering wheel in background, driving scene.",
      "A11 Rear Standard": "Camera: Center rear, straight level. Shot on 35mm lens, f/5.6. Composition: Symmetrical console view. Spatial Anchors: console centered, front seats flanking.",
      "A12 Pet Interaction Paws": "Camera: Eye level. Shot on 50mm lens, f/4. Subject: Golden Retriever paws on armrest. Spatial Anchors: paws resting on top of cover, armrest at center.",
      "A13 Waterproof Wipe": "Camera: 45° close-up. Shot on 50mm lens, f/4. Action: Hand wiping water droplets. Spatial Anchors: hand at center, water droplets visible on surface.",
      "A14 Installation Demo": "Camera: POV or side view. Shot on 35mm lens, f/5.6. Action: Hands stretching elastic band. Spatial Anchors: hands pulling cover edges, armrest console visible beneath.",
      "A15 Arm Rest Comfort": "Camera: Side profile. Shot on 50mm lens, f/4. Subject: Elbow pressing into foam. Spatial Anchors: arm at center, compression visible on cover surface.",
      "A16 Rear Ajar View": "Camera: Low angle from rear. Shot on 35mm lens, f/5.6. Action: Lid slightly lifted (ajar). Spatial Anchors: gap between lid and base visible, cover edge detail.",
      "A17 Driver High Angle": "Camera: High angle from driver side, steep down. Shot on 35mm lens, f/5.6. Spatial Anchors: console viewed from above-left, steering wheel at edge.",
      "A18 Pet Interaction Sitting": "Camera: Eye level. Shot on 50mm lens, f/4. Subject: Golden Retriever sitting ON console. Spatial Anchors: dog centered on armrest, interior around.",

      // Legacy/Fallback mapping
      "Driver's View": "Camera Position: Driver seat, looking right. Shot on 35mm lens, f/5.6. Perspective: Driver POV.",
      "Rear Row Perspective": "Camera Position: Rear seat, looking forward. Shot on 28mm lens, f/8. Perspective: Forward facing.",
      "Side Open Door View": "Camera Position: Outside open door. Angle: 45°. Shot on 35mm lens, f/5.6.",
      "Top Down View": "Camera Position: Overhead. Angle: 90° straight down. Shot on 24mm wide-angle lens, f/8.",
      "Detail Shot of Stitching": "Camera: 20cm distance. Shot on 100mm macro lens, f/2.8. Focus: Texture and stitching.",
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

    // Resolve per-angle lens simulation and negative prompt
    const lensSimulation = getAngleLens(targetRow);
    const angleNegative = getAngleNegative(targetRow);

    const v4Prompt = `
## ✅ AutoFusion™ Pro V5.3 (Perspective-Locked™ Edition)

---

# 📐 CAMERA & PERSPECTIVE LOCK [NON-NEGOTIABLE]
> **CAMERA INSTRUCTION**: ${angleInstruction}
> **LENS SIMULATION**: ${lensSimulation}
> **CRITICAL**: The camera MUST NOT move. Match the reference/preset angle EXACTLY.
> **PHYSICS**: DO NOT change the lens focal length, camera height, or field of view.
> **COMPOSITION**: Keep the subject framed exactly as described in the spatial anchors.

## 📸 PERSPECTIVE LOCK PROTOCOL (Nano Banana Skills)

### Anti-Drift Constraints [ABSOLUTE]
> - DO NOT rotate the camera from the specified angle
> - DO NOT change the focal length from what is specified
> - DO NOT shift the vanishing point or perspective lines
> - The horizon line MUST remain at the same Y-position as described
> - All spatial anchors listed in the camera instruction MUST appear in their specified positions
> - If a visual guide image is provided, the composition grid MUST match it pixel-for-pixel

### Spatial Anchor Enforcement
> The camera instruction above contains "Spatial Anchors" — these describe WHERE specific elements must appear in the frame.
> You MUST place these elements in the described positions. This is how we ensure angle accuracy.
> Example: "steering wheel at top-center" means the steering wheel MUST be in the top-center area of the output image.

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
| **#1A HIGHEST** | Use the correct ${productCategory} product | Images 1-${productCount} |
| **#1B HIGHEST** | Match the camera angle/composition EXACTLY | ${visualGuide ? `Image ${guideIndex} (MUST match 1:1)` : angleId} |
| **#3** | Render correct vehicle interior | ${year} ${carModel} |

> ⚠️ #1A and #1B are EQUALLY important. The product MUST be correct AND the angle MUST match exactly.

**SYSTEM**: AutoFusion™ Pro V5.3 - Perspective Locked
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

    const response = await executeWithTimeout(
      ai.models.generateContent({
        model: modelName,
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: resolution,
            // Enhanced Negative Prompt for Perspective Control
            negativePrompt: buildNegativePrompt('automotive', 'realistic', angleNegative),
          },
        } as any,
      })
    );

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
# 🎭 ROLE: Senior Art Director & CGI Specialist
# 🧠 COGNITIVE PIPELINE (MANDATORY EXECUTION)

You are NOT just generating an image. You are simulating a high-end rendering engine. 
You MUST process the input through these 8 distinct phases:

## PHASE 1: ANALYSIS & BLUEPRINT 🔍
1. **[Design Analysis]**: Deeply analyze Image ${productCount + 1} (Style Ref). Deconstruct its layout grid, color palette hex codes, and lighting physics.
2. **[Composition Build]**: Map the "skeleton" of the reference image. Prepare to slot the Product Images (1-${productCount}) into this exact skeleton.

## PHASE 2: PHYSICS & RENDERING 🛠️
3. **[Lighting Simulation]**: Recreate the exact light sources from the reference (Softbox? Hard sun? Neon?). Apply this physics to the new product.
4. **[Hi-Fi Rendering]**: Render the Product (1-${productCount}) with 8K texture fidelity. No blurring. No hallucinations.
5. **[Texture Optimization]**: Enhance material properties (leather grains, metal reflections, fabric weave).

## PHASE 3: POST-PROCESSING 🎨
6. **[Polishing]**: Smooth out edges, blend product into background seamlessly.
7. **[Dynamic Range]**: Optimize contrast and saturation. Ensure "pop" without over-saturation.
8. **[Color Correction]**: Apply the final color grade to match the reference image's mood EXACTLY.

---

## 🎯 MISSION

**INPUT**:
- **Product Images**: 1-${productCount} (Target Object)
- **Style Reference**: Image ${productCount + 1} (Visual Template)

**EXECUTION**:
- **Structure**: CLONE the layout of Image ${productCount + 1} pixel-perfectly.
- **Content**: REPLACE the object in Image ${productCount + 1} with the Product from Images 1-${productCount}.
- **Context**: ${customPrompt ? `Force Scene Setting: "${customPrompt}"` : 'Keep original background.'}
- **Quality**: ${QUALITY_BOOSTERS.PRODUCT}

**OUTPUT**:
- Generate **ONE** high-fidelity image that looks like a finished commercial advertisement.
- Do NOT output text. Just the final image.
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

// ==================== Product Swap (1:1 Replacement) ====================

/**
 * 9. Product Swap — 1:1 Product Replacement in Scene
 * Uses gemini-3-pro-image-preview
 *
 * Takes a reference scene image and product images,
 * then generates new images that replace the original product in the scene
 * with the user's product, preserving scene, lighting, and composition.
 */
export const generateProductSwap = async (
  sceneImage: { base64: string; mime: string },
  productImages: { base64: string; mime: string }[],
  userPrompt?: string,
  options: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    model?: string;
  } = {}
): Promise<string[]> => {
  const ai = getAiClient();
  const aspectRatio = options.aspectRatio || AspectRatio.LANDSCAPE_4_3;
  const resolution = options.resolution || "2K";
  const model = options.model || "gemini-3-pro-image-preview";
  const productCount = productImages.length;

  // ============ PROMPT ENGINE (Nano Banana Golden Formula) ============
  const prompt = `
# 🎯 ROLE: Professional Product Replacement Specialist & CGI Compositor

You are a world-class digital compositor specializing in **seamless product replacement**.
Your task is to perform a pixel-perfect product swap in a reference scene.

## 📋 INPUT MANIFEST
- **Image 1**: Reference Scene (BLUEPRINT — keep everything EXCEPT the target products)
- **Images 2-${productCount + 1}**: **Product Pool** (Candidate products for swapping, labeled internally as Product A, Product B, etc.)

## 🧠 COGNITIVE PIPELINE (8-Phase Execution)

### PHASE 1: SCENE DEEP ANALYSIS 🔍
Analyze the Reference Scene (Image 1) completely:
- Identify the **target product(s)** to be replaced (can be multiple subjects, e.g., two people with bags)
- Map the **exact position, size, rotation, and perspective** of EACH target product
- Catalog the **scene context**: background, surrounding objects, people, composition
- Analyze **lighting physics**: direction, intensity, color temperature, shadow patterns

### PHASE 1.5: OCCLUSION & BACKGROUND PREDICTION 🙈
- **CRITICAL STEP**: Analyze what lies *behind* the current target product(s).
- **Predict Hidden Context**: If the current product is removed, what texture/object should appear? (e.g., shirt fabric, chair back, distant landscape).
- **Prepare Inpainting Data**: Generate mentally the background data for any area currently covered by the product but NOT covered by the new product.

### PHASE 2: PRODUCT SOURCE ANALYSIS 📍
Analyze the Product Pool (Images 2-${productCount + 1}):
- Extract the **true shape, proportions, and material properties** of EACH product image.
- Identify **texture details**: surface finish, color, patterns, branding.
- Note **key visual features** that must be preserved.

### PHASE 2.5: MULTI-TARGET MAPPING 🗺️
- **Analyze User Instruction**: Check for specific mapping commands (e.g., "Left person wears Product A (Image 2), Right person wears Product B (Image 3)").
- **Map Targets**: Identify multiple distinct subjects/products in the scene if applicable.
- **Assign Sources**: Link each target in the scene to a specific image from the Product Pool.
- **Default Logic**: If no specific mapping is given, apply Product A (Image 2) to the MAIN subject.

### PHASE 3: LIGHTING PHYSICS MATCHING 💡
- Calculate how the scene's lighting would interact with EACH replacement product independently.
- Match **shadow direction and softness** to the scene for each subject.
- Apply correct **specular highlights** and **ambient occlusion**.
- Ensure **color temperature consistency** between products and scene.

### PHASE 4: PERSPECTIVE & SCALE CALIBRATION 📐
- Match the **camera angle** of EACH replacement product to its specific location in the scene.
- Scale the product to **maintain true proportions** relative to the specific person/object it is attached to.
- Do NOT stretch to fill old space.

### PHASE 5: SMART ERASE & PRECISION SWAP (Multi-Target Edition) 🔄
- **Check All Targets**: Iterate through all mapped Target/Source pairs.
- **For EACH Pair**:
  - **SIZE MISMATCH PROTOCOL**: If Original > New, **ERASE** -> **INPAINT** -> **PLACE**.
  - **ANTI-GHOSTING**: Ensure NO residual pixels of the original object remain.
  - **Placement**: Position the replacement product in the **exact same logical position** (e.g., on the back).
- **Consistency**: Ensure both products look like they belong in the same physical space.
- Keep ALL non-product elements **100% unchanged**: people, background, props, text.

### PHASE 6: EDGE BLENDING & INTEGRATION ✨
- Seamlessly blend product edges with the surrounding scene for ALL swapped items.
- Apply correct **contact shadows** where the product meets surfaces.
- Handle **occlusion** — if fingers, straps, or other elements overlap the product.
- Ensure no visible seams, halos, or artifacts.

### PHASE 7: MATERIAL FIDELITY 🧶
- Preserve the replacement product's **authentic material texture**.
- Render leather grains, fabric weave, metal reflections, or plastic sheen accurately.
- Maintain product color accuracy under the scene's lighting conditions.

### PHASE 8: FINAL QUALITY ASSURANCE 🏆
- Verify the swap looks **100% natural and photorealistic**.
- Check for any inconsistencies in lighting, perspective, or scale.
- Ensure the output looks like a **real photograph**, not a composite.
- Apply final color grading to match the scene's overall mood.

---

## 🎯 MISSION SUMMARY

**KEEP UNCHANGED**: Scene background, people, poses, composition, camera angle, lighting setup
**REPLACE**: The target product(s) according to the Multi-Target Mapping.
**ANTI-GHOSTING**: If replacing a large object with a smaller one, completely ERASE the large object and recover the background.
${userPrompt ? `**USER INSTRUCTION**: "${userPrompt}"` : '**DEFAULT**: Replace the most prominent product in the scene with the provided Product Pool images.'}

**QUALITY STANDARD**: ${QUALITY_BOOSTERS.PRODUCT}
Professional commercial photography quality. The result must be indistinguishable from a real photograph.

**OUTPUT**: Generate ONE high-fidelity image. Do NOT output any text, only the final image.
`;

  console.log('[ProductSwap] Starting product swap generation...');
  console.log('[ProductSwap] Product count:', productCount);
  if (userPrompt) console.log('[ProductSwap] User prompt:', userPrompt);

  // Build parts array
  const parts: any[] = [];
  parts.push({ text: prompt });

  // Add scene reference image first
  parts.push({
    inlineData: {
      mimeType: sceneImage.mime,
      data: sceneImage.base64,
    },
  });

  // Add product images
  for (const img of productImages) {
    parts.push({
      inlineData: {
        mimeType: img.mime,
        data: img.base64,
      },
    });
  }

  // Helper to run generation
  const runGeneration = async (modelName: string) => {
    console.log(`[ProductSwap] Generating with model: ${modelName}, Resolution: ${resolution}, Aspect: ${aspectRatio}`);

    const config: any = {
      temperature: 0.15, // Lower temp for more faithful reproduction
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution,
      }
    };

    return await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts }],
      config: config,
    });
  };

  // Generate
  try {
    let response;
    try {
      response = await runGeneration(model);
    } catch (err) {
      console.warn(`[ProductSwap] Primary model ${model} failed, trying fallback...`);
      response = await runGeneration("gemini-2.0-flash-exp");
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
      console.error('[ProductSwap] No candidates returned');
      throw new Error('产品替换失败 — 模型未返回结果，请重试');
    }

    // Log text if any
    const textPart = candidate.content?.parts?.find((p: any) => p.text);
    if (textPart) {
      console.log(`[ProductSwap] Model text: ${textPart.text}`);
    }

    const imagePart = candidate.content?.parts?.find(
      (p: any) => p.inlineData?.mimeType?.startsWith("image/")
    );

    if (imagePart?.inlineData?.data) {
      console.log('[ProductSwap] Image generated successfully');
      return [imagePart.inlineData.data];
    } else {
      console.warn('[ProductSwap] No image in response');
      throw new Error('产品替换失败 — 未生成图片，请检查输入后重试');
    }
  } catch (error) {
    console.error('[ProductSwap] Generation failed:', error);
    throw error;
  }
};
// ==================== HD Upscale (Smart Retouching Upgrade) ====================

/**
 * 10. HD Upscale - Step 0: Image Quality Assessment
 * Uses gemini-2.5-flash-image
 */
export const analyzeImageQuality = async (
  imageBase64: string,
  mimeType: string
) => {
  const ai = getAiClient();
  const prompt = `
  You are a professional Image Quality Analysis Expert. Please conduct a comprehensive quality assessment of the uploaded image.

  ## Analysis Dimensions

  ### 1. Basic Parameters
  - Image Resolution (Width x Height)
  - File Format
  - Color Mode (RGB/CMYK/Grayscale)
  - Color Depth

  ### 2. Quality Assessment (Score 1-10 each)
  - Sharpness Score: Detect blurriness
  - Noise Score: Detect noise/grain
  - Compression Artifacts Score: Detect JPEG artifacts
  - Exposure Score: Detect over/under exposure
  - Color Saturation Score

  ### 3. Processing Recommendations
  Based on the assessment, output JSON recommendations:

  \`\`\`json
  {
    "original_resolution": "WxH",
    "quality_score": 0-100,
    "denoise_strength": 0-1,
    "sharpen_strength": 0-1,
    "color_correction_needed": true/false,
    "recommended_upscale_factor": 2/4/8,
    "processing_difficulty": "low/medium/high"
  }
  \`\`\`

  Please output the JSON result directly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Use fast model for analysis
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Quality analysis failed", error);
    // Return safe default
    return {
      quality_score: 50,
      recommended_upscale_factor: 2,
      processing_difficulty: "medium"
    };
  }
};

/**
 * 10.1 HD Upscale - Step 1: Style Analysis (Reverse Prompting)
 * Uses gemini-2.5-flash-image
 */
export const analyzeStyle = async (
  imageBase64: string,
  mimeType: string
) => {
  const ai = getAiClient();
  const prompt = `
  【图像深度解析与提示词生成框架】
  
  根据输入图像，按以下模块输出完整提示词：
  
  ══ A. 核心主题 ══
  • 主体识别：[具体是什么——人/物/景/场景]
  • 核心叙事：[画面在表达/传递什么]
  • 构图逻辑：[视觉引导、元素排列、空间层次]
  
  ══ B. 风格与质感 ══
  • 艺术风格：[写实/插画/3D/特定流派]（**CRITICAL**: If it looks like a photo, explicitly state "Photorealistic", "Photography", "DSLR"）
  • 色彩体系：[主色调、配色逻辑、冷暖氛围]
  • 光影设计：[光源、明暗比、光质软硬]
  • 材质表现：[根据主体动态描述]
  
  ══ C. 细节层级（核心） ══
  • 宏观细节：[整体形态、大结构特征]
  • 中观细节：[局部特征、材质分界、色彩过渡]
  • 微观细节：[根据主体类型动态捕捉]
    - 生物：毛发丝缕、皮肤毛孔、眼睛湿润反光、血管纹理
    - 建筑：砖缝灰浆、锈蚀痕迹、玻璃反射、墙面风化
    - 自然：叶脉经络、水珠折射、岩石层理、云层厚度
    - 物品：使用磨损、划痕包浆、接缝工艺、材质颗粒
    - 织物：编织纹理、纤维走向、褶皱阴影、边缘毛边
  
  ══ D. 氛围与情绪 ══
  • 整体氛围：[宁静/紧张/梦幻/史诗/日常等]
  • 时间暗示：[季节、时段、年代感]
  • 故事张力：[画面暗示的前因后果]
  
  ══ E. 技术参数 ══
  • 视角：[广角/标准/微距/鸟瞰/平视]
  • 景深：[全景深/选择性虚化/焦点位置]
  • 清晰度：[锐利边缘/柔焦/运动模糊]
  • 渲染品质：[照片级/超写实/风格化]
  
  ## 输出格式 (Output Format)
  请根据以上分析，输出符合 JSON 格式的结果：
  \`\`\`json
  {
    "positive_prompt": "Based on the 5 modules above (A-E), generate a highly detailed, professional English prompt. Start with the Art Style/Medium. Then Subject, Action, Context. Then Lighting, Camera, Color, Texture. End with high quality boosters. IF PHOTO: Start with 'Photorealistic, 8k, highly detailed, raw photo...'",
    "negative_prompt": "Low quality, bad anatomy, worst quality, lowres, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
    "style_summary": "请将上述5个模块的详细中文分析汇总在这里，保持结构化排版。",
    "key_features": ["核心主体", "构图逻辑", "艺术风格", "微观细节"],
    "recommended_params": {
      "aspect_ratio": "1:1",
      "style_weight": 0.8
    }
  }
  \`\`\`
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // User explicitly requested gemini-3-pro-preview
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Style analysis failed", error);
    return { positive_prompt: "High quality image", negative_prompt: "low quality" };
  }
};

/**
 * 10.2 HD Upscale - Step 2: Generate Color Map
 * Uses gemini-3-pro-image-preview
 */
export const generateColorMap = async (
  imageBase64: string,
  mimeType: string,
  aspectRatio: AspectRatio = AspectRatio.SQUARE
) => {
  const ai = getAiClient();
  const prompt = `
  【任务】生成专业级平面色彩构成分析图
  
  【动态识别流程】
  
  第一步：智能区域划分
  根据画面内容自适应识别：
  - 主体与背景的边界
  - 不同材质/物体的分界
  - 色彩自然过渡的断点
  - 光影造成的色域变化
  
  第二步：色块提纯与填充
  - 每个识别区域 → 提取代表色 → 均匀填充
  - 保留色彩的层级关系与空间暗示
  - 相邻色块需有足够的明度/色相区分
  
  第三步：全面净化
  移除所有非色彩本质的信息：
  × 光影（高光、阴影、环境光）
  × 材质（纹理、反射、透明度）
  × 噪声（颗粒、杂色、压缩痕迹）
  
  【输出】
  边界清晰的纯色块构成图，
  色彩关系 = 唯一视觉语言，
  可直接用于配色提案或风格化创作

  **CRITICAL**: The output composition and aspect ratio MUST match the input image EXACTLY.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K"
        }
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      ? `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`
      : null;
  } catch (error) {
    console.error("Color Map Gen failed", error);
    return null;
  }
};

/**
 * 10.3 HD Upscale - Step 3: Generate Line Art
 * Uses gemini-3-pro-image-preview
 */
export const generateLineArt = async (
  imageBase64: string,
  mimeType: string,
  aspectRatio: AspectRatio = AspectRatio.SQUARE
) => {
  const ai = getAiClient();
  const prompt = `
  【任务】将输入图像解析为专业级矢量线稿
  
  【自适应分析】
  首先识别画面主体类型，动态调整线条策略：
  - 生物类：捕捉毛发走向、皮肤褶皱、肌肉轮廓
  - 建筑/物品：强调结构边缘、材质分界、几何关系
  - 自然景观：表现植被层次、地形起伏、水纹流向
  - 织物/软质：体现垂坠感、褶皱逻辑、编织纹理
  
  【线条层级系统】
  L1 主轮廓：定义物体边界与剪影
  L2 结构线：表达体积转折、内部形态
  L3 细节线：材质特征、微观纹理走向
  L4 氛围线：暗示光影边界、空间深度（可选）
  
  【输出标准】
  ✓ 纯黑白、线条闭合流畅、层次分明
  ✗ 禁止：灰度填充、渐变、模糊、噪点

  **CRITICAL**: The output composition and aspect ratio MUST match the input image EXACTLY.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K" // Line art doesn't need high res
        }
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      ? `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`
      : null;
  } catch (error) {
    console.error("Line Art Gen failed", error);
    return null;
  }
};

/**
 * 10.4 HD Upscale - Step 4: Final Reconstruction
 * Uses gemini-3-pro-image-preview
 */
export const generateHDUpscale = async (
  original: { base64: string, mime: string },
  colorMap: string | null,
  lineArt: string | null,
  promptData: { positive: string, negative: string },
  upscaleFactor: number = 2,
  aspectRatio: AspectRatio = AspectRatio.SQUARE
) => {
  const ai = getAiClient();

  const parts: any[] = [];

  // 1. Original Image (Reference) - REMOVED per user request (Recipe: Color + Line + Prompt)
  // parts.push({ inlineData: { mimeType: original.mime, data: original.base64 } });

  // 2. Control Adapters (Color & Line)
  if (colorMap) {
    // Remove prefix if present for API
    const base64Clean = colorMap.split(',')[1] || colorMap;
    parts.push({ inlineData: { mimeType: "image/png", data: base64Clean } });
  }
  if (lineArt) {
    const base64Clean = lineArt.split(',')[1] || lineArt;
    parts.push({ inlineData: { mimeType: "image/png", data: base64Clean } });
  }

  // 3. Prompt Construction
  const scaleMap = { 2: "2K", 4: "4K", 8: "4K" }; // API only supports up to 4K effectively or map appropriately
  // Note: Gemini API imageSize enum is '1K', '2K', '4K'. 
  // 8x might just be '4K' with high detail prompt.
  const targetRes = (scaleMap as any)[upscaleFactor] || "2K";

  const systemPrompt = `
  You are a Professional AI Artist & Image Restoration Expert.
  
  **MISSION**: Perfectly reconstruct the image at ${upscaleFactor}X resolution (${targetRes}) using ONLY the control maps and the prompt.
  
  **CONTROL INPUTS**:
  ${colorMap ? '1. **[Color Map]**: PRIMARY REFERENCE for color distribution and composition.' : ''}
  ${lineArt ? `2. **[Line Art]**: PRIMARY REFERENCE for structural boundaries and details.` : ''}
  
  **GENERATION PROMPT**:
  (Photorealistic Enforcement): Raw photo, 8k uhd, dslr, soft lighting, high quality, film grain, Fujifilm XT3.
  ${promptData.positive}
  
  **EXECUTION INSTRUCTIONS**:
  1. **Structure**: Align perfectly with the [Line Art].
  2. **Color**: Sample exact colors from the [Color Map].
  3. **Detailing**: Use the **GENERATION PROMPT** to hallucinate high-frequency realism.
  
  **NEGATIVE PROMPT**:
  anime, illustration, painting, drawing, sketch, cartoon, 3d render, ${promptData.negative}, blurry, low resolution, pixelated, distorted, bad anatomy, structural mutation, washed out colors, extra limbs, messy lines.
  `;

  parts.push({ text: systemPrompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: targetRes as any
        }
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      ? `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`
      : null;
  } catch (error) {
    console.error("HD Upscale failed", error);
    return null;
  }
};

/**
 * =========================================================================================
 *  IMAGE CLEANUP TOOL (AI 洗图) - V2.0
 * =========================================================================================
 */

/**
 * 1. Analyze and Merge Prompts (LLM)
 * Uses gemini-3-pro-preview to analyze image and generate 4-section structured prompt
 */
export const analyzeAndMergePrompts = async (
  imageBase64: string,
  userInstruction: string,
  intensity: 'conservative' | 'balanced' | 'aggressive'
): Promise<string> => {
  const ai = getAiClient();
  const modelName = 'gemini-3-pro-preview';

  const intensityMap = {
    conservative: '保守模式 (Conservative): Keep 80% original features, minor adjustments.',
    balanced: '平衡模式 (Balanced): Keep core composition, re-interpret style.',
    aggressive: '激进模式 (Aggressive): Keep only subject concept, heavy restyling.'
  };

  const systemPrompt = `
You are a professional Image Analysis & Prompt Optimization Expert.

## TASK
Analyze the user's uploaded image and style instruction to generate a structured 4-section prompt for Gemini Image Generation.

## USER INSTRUCTION
"${userInstruction}"

## INTENSITY MODE
${intensityMap[intensity]}

## OUTPUT FORMAT
Output ONLY the following 4 sections in natural language (Chinese or English based on user input). Do NOT use markdown code blocks.

【构图与主体】
(Describe perspective, subject position, pose, features)

【光影与氛围】
(Describe lighting type, direction, color temperature, mood)

【场景与材质】
(Describe background, foreground, textures, details - Keep original essence if conservative)

【风格指令】
(3-5 keywords summarizing the target style)
`;

  try {
    const parts: any[] = [
      { text: systemPrompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      }
    ];

    const result = await ai.models.generateContent({
      model: modelName,
      contents: { parts }
    });

    return result.text || "";
  } catch (e) {
    console.error("Distill analysis failed", e);
    throw e;
  }
};

/**
 * 2. Generate Clean Image (Img2Img)
 * Uses gemini-3-pro-image-preview with Source Image
 */
export const generateCleanImage = async (
  prompt4Section: string,
  sourceImageBase64: string,
  intensity: 'conservative' | 'balanced' | 'aggressive',
  options: {
    count?: number;
    resolution?: '1K' | '2K' | '4K';
    aspectRatio?: AspectRatio;
  } = {}
): Promise<string[]> => {
  const ai = getAiClient();
  const modelName = 'gemini-3-pro-image-preview';
  const { count = 1, resolution = '1K', aspectRatio = AspectRatio.SQUARE } = options;

  // Nano Banana Skills: Enhanced Prefixes for Control
  const prefixMap = {
    conservative: `
# 🎯 MISSION: HIGH-FIDELITY RESTYLING
**STRICT CONSTRAINT**: You MUST use the provided [Source Image] as the absolute structural blueprint.
- **Composition**: COPY EXACTLY. Do not move camera, subject, or objects.
- **Geometry**: PRESERVE all shapes, edges, and depth cues 100%.
- **Action**: Change ONLY the visual style/texture/lighting defined below.
- **Reference Integrity**: 90%
`,
    balanced: `
# 🎯 MISSION: BALANCED REINTERPRETATION
**CONSTRAINT**: Use the [Source Image] as the core visual anchor.
- **Composition**: Keep the main subject placement and pose.
- **Creativity**: You may enhance background details and lighting atmosphere.
- **Refinement**: 60% Source / 40% Creative Freedom.
`,
    aggressive: `
# 🎯 MISSION: CONCEPTUAL REIMAGINING
**GUIDANCE**: Use the [Source Image] primarily for the main subject's pose/concept.
- **Style**: Complete overhaul of atmosphere and texture.
- **Composition**: You may optimize the framing for better aesthetics.
- **Freedom**: 20% Source / 80% Creative Freedom.
`
  };

  const fullPrompt = `
${prefixMap[intensity]}

## 🎨 STYLE & CONTENT INSTRUCTIONS
${prompt4Section}

## ⚙️ TECHNICAL SPECS
- Resolution: ${resolution}
- Aspect Ratio: ${aspectRatio}
- Quality: Photorealistic, 8K
`;

  try {
    const parts: any[] = [
      { text: fullPrompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: sourceImageBase64
        }
      }
    ];

    console.log(`[CleanImage] Generating ${count} images at ${resolution} (${aspectRatio}) with ${intensity} mode...`);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        numberOfImages: count,
        aspectRatio: aspectRatio,
        safetyFilterLevel: 'block_only_high',
        personGeneration: 'allow_adult',
        imageConfig: {
          imageSize: resolution
        }
      } as any
    });

    const results: string[] = [];
    if (response.candidates) {
      for (const candidate of response.candidates) {
        const part = candidate.content.parts.find(p => p.inlineData);
        if (part && part.inlineData && part.inlineData.data) {
          results.push(part.inlineData.data);
        }
      }
    }

    if (results.length > 0) {
      return results;
    }

    throw new Error("No image generated");

  } catch (e) {
    console.error("Clean image generation failed", e);
    throw e;
  }
};
