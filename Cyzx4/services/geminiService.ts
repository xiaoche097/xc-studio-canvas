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

// 导出从 ../utils/apiHelpers.ts 导入的工具
export { getActiveApiInfo, blobToBase64, compressImage, decodeAudioData };

// Export the VTON Analyst service
export { analyzeVtonMaterials } from "./vtonAnalyst";

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
      model: "gemini-3.1-flash-lite-preview",
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
 * 1.1 Analyze Fission Context (Pose Fission Expert)
 * Analyzes multiple input images to create a highly detailed descriptive prompt.
 */
export const analyzeFissionContext = async (
  images: { base64: string; mimeType: string }[],
  aspectRatio: string,
  imageGroups?: { productCount: number; outfitCount: number; modelCount: number; accessoryCount: number }
) => {
  const ai = getAiClient();
  const isHorizontal = aspectRatio === "16:9";
  const poseCount = isHorizontal ? 8 : 12;
  const productCount = imageGroups?.productCount || 0;
  const outfitCount = imageGroups?.outfitCount || 0;
  const modelCount = imageGroups?.modelCount || 0;
  const accessoryCount = imageGroups?.accessoryCount || 0;

  const productRange = productCount > 0 ? `Images 1-${productCount}` : "None";
  const outfitStart = productCount + 1;
  const outfitRange = outfitCount > 0
    ? `Images ${outfitStart}-${outfitStart + outfitCount - 1}`
    : "None";
  const modelStart = productCount + outfitCount + 1;
  const modelRange = modelCount > 0
    ? `Images ${modelStart}-${modelStart + modelCount - 1}`
    : "None";
  const accessoryStart = productCount + outfitCount + modelCount + 1;
  const accessoryRange = accessoryCount > 0
    ? `Images ${accessoryStart}-${accessoryStart + accessoryCount - 1}`
    : "None";

  const analysisPrompt = `
**ROLE**: High-End Fashion Editorial Director & Professional Visual Analyst.

**TASK**: Analyze the provided reference images and generate a structured description for a ${isHorizontal ? '4x2' : '3x4'} grid generation (Total ${poseCount} images).

**INPUT IMAGES GUIDE**:
- ${productRange}: PRIMARY PRODUCT reference images.
- ${outfitRange}: MODEL OUTFIT EFFECT references showing the desired wearing result / styling outcome.
- ${modelRange}: MODEL identity / body / face reference images.
- ${accessoryRange}: ACCESSORY reference images that must be worn or carried by the model when present.

**YOUR ANALYSIS GOALS**:
1. **PRODUCT FOCUS (CRITICAL)**: Describe the PRIMARY PRODUCT (color, material, specific patterns, fit) with extreme precision. The goal is to show the garment's design, fabric, and how it fits the body.
2. **OUTFIT EFFECT REFERENCE (HIGH PRIORITY WHEN PROVIDED)**: Extract the desired wearing effect from ${outfitRange}, including layering result, garment silhouette, styling logic, tuck/untuck behavior, hem behavior, sleeve behavior, and how the product should sit on the model.
3. **MODEL IDENTITY & DIMENSIONS**: Describe the person in the model reference images with hyper-precision.
   - **FACE**: Ethnicity, hair color/texture, facial structure, eye shape.
   - **BODY (CRITICAL)**: Describe the model's physical dimensions (height, build, shoulder width, waist/hip ratio). The generated model MUST have the EXACT SAME body proportions as the reference images.
4. **ACCESSORY DETAIL (NON-OPTIONAL WHEN PROVIDED)**: Describe every accessory from ${accessoryRange} with enough detail for 1:1 cloning, and state clearly how each accessory should be worn or carried on the model.
5. **INTELLIGENT POSE & ANGLE DIVERSITY (STRICT CONFORMITY)**: Design ${poseCount} UNIQUE fashion poses based on the provided reference angles.
   - **CRITICAL: MATCH REFERENCE ANGLES**. Prioritize the exact user-provided angles/crops and preserve them precisely.
   - **MODEL MUST BE PRESENT IN EVERY IMAGE**. NO EXCEPTIONS.
   - **STRICT PROHIBITION**: Even if one of the reference images is a standalone product (e.g., a pair of shoes, a bag), DO NOT generate a pose that shows just the product.
   - **TREAT PRODUCTS AS WEARABLES**: All reference products/accessories must be integrated into the model's outfit.
   - **ABSOLUTELY FORBIDDEN**: NO standalone shoes, NO standalone bags, NO standalone jewelry, NO flat lays, NO still life shots.
   - **ANGLES**: Ensure the grid contains clear Front, Profile (Side), and Back views that match the reference angles and crops.
   - **CRITICAL**: EXACTLY ${poseCount} distinct poses. NO repetition.

**OUTPUT FORMAT (MANDATORY JSON)**:
Return a JSON object with these keys:
{
  "model_identity": "Specific physical description for identity locking including facial features AND body dimensions/build...",
  "product_description": "Detailed text description of the main garment...",
  "outfit_effect": "Detailed text description of the desired wearing effect / styling result from the outfit-effect references...",
  "accessory_description": "Detailed text description of accessories, and state clearly how they should be worn/carried...",
  "poses_list": "A numbered list of EXACTLY ${poseCount} SHARP, DISTINCT fashion poses. Specifically include mapping for FRONT, SIDE, and BACK views to match input angles/crops. NO standalone product shots."
}

Respond ONLY with valid JSON.
`;

  try {
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 }
    }));
    parts.push({ text: analysisPrompt });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview", // Use Lite for fast analysis
      contents: { parts }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Fission analysis failed", error);
    return {
      product_description: "Professional garment",
      outfit_effect: "Desired wearing effect based on product and user notes",
      accessory_description: "Matching accessories",
      poses_list: "Variety of professional fashion poses"
    };
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
 * Supports dynamic model selection and automatic API key rotation on failure.
 */
export const generateImageToImage = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
  options: { 
    aspectRatio?: AspectRatio; 
    resolution?: ImageResolution;
    modelId?: string; // NEW: Dynamic model support
    negativePrompt?: string; // NEW: Negative prompt support
    workflowHint?: 'pose-transfer' | 'main-angle-lock' | 'scene-product-lock' | 'strict-geometry-lock' | 'clothing-effect' | 'garment-replacement' | 'magic-mannequin' | 'clothing-modification';
    hasModelRef?: boolean;
    vtonReport?: string; // NEW: Pass detailed analysis from Pass 1
  } = {}
) => {
  const { 
    hasModelRef, 
    vtonReport, 
    negativePrompt, 
    workflowHint, 
    modelId, 
    aspectRatio = '1:1', 
    resolution = '2K' 
  } = options;
  const retryLimit = 3;
  let lastError: any = null;
  
  // Get initial config to know how many keys we have
  const initialConfig = getApiConfig();
  const maxRetries = Math.min(initialConfig.keyCount, 3); // Max retry across 3 keys or total keys

  let targetModel = "gemini-3-pro-image-preview";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const config = getApiConfig(initialConfig.currentIndex + attempt);
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: config.isYunwu ? { baseUrl: config.baseUrl } : undefined,
      apiVersion: config.apiVersion as any
    });

    try {
      const parts: any[] = [];

      let processedImages = images;
      // MAGIC TRICK: If strict-geometry-lock or pose-transfer is requested, duplicating the anchor image forces 
      // Gemini's attention mechanism to heavily weight the structure over the texture.
      if (workflowHint === 'strict-geometry-lock' && images.length === 1) {
        processedImages = [images[0], images[0]];
      } else if (workflowHint === 'pose-transfer') {
        if (images.length === 2) {
          // For traditional pose transfer, input is [Pose] and [Identity]. We duplicate Pose to overpower.
          processedImages = [images[0], images[0], images[1]];
        } else if (images.length === 3) {
          // Input is [Skeleton, Pose, Identity]. We don't duplicate, but will use a specialized prompt.
          processedImages = images;
        }
      } else if (workflowHint === 'garment-replacement') {
        // Input: [Target Model, Core Garment, (Optional) Pairings]
        // We pass it directly, without duplicating.
        processedImages = images;
      }

      // 1. Add All Input Images
      processedImages.forEach((img: any) => {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || img.mime || 'image/jpeg', // 增加容错：兼容 mime 字段并提供默认值
            data: img.base64,
          },
        });
      });

      // 2. Construct Prompt
      const negativePromptLine = negativePrompt
        ? `- **NEGATIVE PROMPT (Strictly Avoid)**: ${negativePrompt}`
        : '';

      const isSkeletonWorkflow = workflowHint === 'pose-transfer' && images.length === 3;
      const isGarmentReplacement = workflowHint === 'garment-replacement';

      const systemPrompt = processedImages.length > 0
        ? isGarmentReplacement
          ? hasModelRef
            ? `
      **ROLE**: Pixel-Perfect Virtual Try-On Director & Identity Cloning Surgeon.
      **MISSION**: Generate ONE photorealistic image that combines these core elements with ZERO deviation:
        1. MODEL: The user-provided model's face, hair, skin tone, and body shape.
        2. GARMENT & STYLING: The user-provided core garment and matching outfits.
        3. POSE & ANGLE: The exact action, pose, and camera angle from the target replacement gallery image.

      **ANALYTICAL CONTEXT**:
      ${vtonReport || 'No pre-analysis available.'}

      **INPUT MAPPING (MEMORIZE THIS)**:
      - Image 1 = **POSE & ANGLE REPLACEMENT SOURCE** (from the replacement image gallery. Replicate the exact body pose, action, camera angle, crop, limb placement, and background. This is the structural anchor!).
      - Image 2 = **MODEL IDENTITY SOURCE (FACE & SKIN ONLY)** (the person's face, hair, skin tone, body shape/size. **CRITICAL: DO NOT COPY HER CLOTHING. HER GREY/ORIGINAL CLOTHING IS STRICTLY FORBIDDEN.**).
      - Image 3 = **CORE GARMENT** (the main clothing item to dress the person in. Replicate color, pattern, logo, and fabric texture EXACTLY).
      ${processedImages.length >= 4 ? '- Image 4 = STYLING & MATCHING / SECONDARY GARMENT (pants, skirt, or accessory to pair and wear together).' : ''}

      ═══════════════════════════════════════════
      ██  CRITICAL RULE: WHAT TO KEEP & REPLACE  ██
      ═══════════════════════════════════════════
      - **THE POSE**: The generated action, pose, and camera angle MUST BE entirely from Image 1.
      - **THE MODEL**: The generated person MUST BE the model provided in Image 2. Do NOT use the face or body from Image 1.
      - **THE GARMENT**: The generated person MUST BE WEARING the core garment from Image 3 (plus pairing from Image 4 if present). **NEVER, EVER use the clothing from Image 1 (Target Scene) or Image 2 (Model Identity).**

      ═══════════════════════════════════════════
      ██  PRIORITY #1: GARMENT FIDELITY (HIGHEST)  ██
      ═══════════════════════════════════════════
      - The output garment MUST be a **PIXEL-LEVEL CLONE** of Image 3 (and Image 4 if present).
      - **COLOR ACCURACY (OBLIGATORY)**: Match the EXACT hue, saturation, and brightness. ZERO color drift allowed. If Image 3 is blue, the output MUST be blue.
      - **WHITE BALANCE CONTROL**: Maintain a clean, neutral white balance. Strictly avoid any magenta (magenta), purple, or red color cast on skin or fabric. Ensure the background color and model's original skin tone are not distorted by artificial warmth.
      - **PRINT/LOGO/GRAPHIC**: Reproduce every graphic element (such as circles, text, logos) at the exact same scale, position, and detail level. Do not lose the graphic prints!
      - **FABRIC TEXTURE**: Match the exact material appearance.
      - **GARMENT STRUCTURE**: Match neckline shape, sleeve length, hem length, and overall silhouette.
      - **ABSOLUTE PROHIBITION**: Image 1 AND Image 2's original clothes are **INVISIBLE AND BANNED**. For example, if Image 1 has a beige shirt, DO NOT output a beige shirt. If Image 2 has a grey bodysuit, DO NOT output a grey bodysuit. Only Image 3 and 4 define what the person wears.

      ═══════════════════════════════════════════
      ██  PRIORITY #2: POSE & COMPOSITION LOCK     ██
      ═══════════════════════════════════════════
      - The output image MUST have the **IDENTICAL composition and action** as Image 1.
      - **CRITICAL ANTI-COLLAGE RULE**: You MUST generate EXACTLY ONE PERSON in a single scene. Do NOT generate a grid, layout, or collage. **Do NOT copy the multi-view grid layout from Image 3 (or Image 4). The multi-view input is ONLY for garment feature extraction.** 
      - The single person's camera angle, body pose, limb placement, and background must perfectly match Image 1.
      - Do NOT reframe, zoom in/out, or change the aspect ratio vs Image 1.

      **GARMENT ORIENTATION AWARENESS**:
      - Determine the body orientation from Image 1 (front/back/side/3/4).
      - Image 3 (Core Garment) may be a multi-view collage containing front, back, and side views.
      - **CRITICAL**: Select the correct view from Image 3 to map onto the person based on Image 1's orientation.
      - For example, if Image 1 faces away from the camera (back view), you MUST map the back view of the garment from Image 3 onto the person. IF Image 3 has no back view, assume the back is plain.
      - Never copy a front print onto the back.

      **OUTPUT RULES**:
      - STRICTLY ONE photorealistic photograph of ONE person. No splitting the image into panels.
      - Lighting must match Image 1's environment.
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      ${negativePromptLine}
            `
            : `
      **ROLE**: Pixel-Perfect Virtual Try-On Specialist.
      **MISSION**: Replace the clothing on the person in Image 1 with the EXACT garment from Image 2, while preserving EVERYTHING else from Image 1 with zero deviation.

      **ANALYTICAL CONTEXT**:
      ${vtonReport || 'No pre-analysis available.'}

      **INPUT MAPPING (MEMORIZE THIS)**:
      - Image 1 = **SCENE MASTER** (the person's face, hairstyle, body pose, limb placement, camera angle, crop, background, lighting — ALL of this is FROZEN and UNTOUCHABLE. This is the structural anchor!)
      - Image 2 = **CORE GARMENT** (the clothing item — replicate its color, pattern, print, logo, fabric texture EXACTLY)
      ${processedImages.length >= 3 ? '- Image 3 = SECONDARY GARMENT (pants, skirt, shoes, or accessories)' : ''}

      ═══════════════════════════════════════════
      ██  PRIORITY #1: GARMENT FIDELITY (HIGHEST)  ██
      ═══════════════════════════════════════════
      - The output garment MUST be a **PIXEL-LEVEL CLONE** of Image 2.
      - **COLOR ACCURACY (OBLIGATORY)**: Match the EXACT hue, saturation, and brightness of Image 2. ZERO color drift allowed.
      - **WHITE BALANCE CONTROL**: Maintain a clean, neutral white balance. Strictly avoid any magenta (magenta), purple, or red color cast. The output must have true-to-life colors without artificial tinting or oversaturation of red channels.
      - **PRINT/LOGO/GRAPHIC**: Every graphic element, text, logo, or pattern on Image 2 must appear on the output garment at the exact same scale, position, and orientation.
      - **FABRIC TEXTURE**: Replicate the exact material surface.
      - **GARMENT STRUCTURE**: Match neckline, sleeve length, hem length, collar shape, and overall silhouette.
      - **ABSOLUTE PROHIBITION**: Do NOT use ANY color, pattern, or texture from Image 1's original clothing. Only Image 2 defines the garment.

      ═══════════════════════════════════════════
      ██  PRIORITY #2: COMPOSITION LOCK (HIGH)     ██
      ═══════════════════════════════════════════
      - The output MUST preserve the **IDENTICAL composition** from Image 1.
      - **CRITICAL ANTI-COLLAGE RULE**: You MUST generate EXACTLY ONE PERSON in a single scene. Do NOT generate a grid, layout, or collage. **Do NOT copy the multi-view grid layout from Image 2. The multi-view input is ONLY for garment feature extraction.** 
      - Same camera angle, crop boundaries, aspect ratio, background, lighting direction.
      - Same body pose — every limb, joint, hand position, weight shift, subject scale.

      ═══════════════════════════════════════════
      ██  PRIORITY #3: IDENTITY PRESERVATION       ██
      ═══════════════════════════════════════════
      - The person's face, hairstyle, skin tone, body proportions, and all non-clothing features MUST remain unchanged from Image 1.
      - Preserve any accessories, jewelry, or items the person holds unless overridden by provided garment images.

      **GARMENT ORIENTATION AWARENESS**:
      - Determine the body orientation of the person in Image 1 (front/back/side/3/4).
      - Image 2 (Core Garment) may be a multi-view collage containing front, back, and side views.
      - **CRITICAL**: Select the correct view from Image 2 to map onto the person based on Image 1's orientation.
      - For example, if Image 1 faces away from the camera (back view), you MUST map the back view of the garment from Image 2 onto the person. IF Image 2 has no back view, assume the back is plain.

      **OUTPUT RULES**:
      - STRICTLY ONE photorealistic photograph of ONE person. No splitting the image into panels.
      - If Image 2 is a top and no bottoms are provided, keep the original bottoms from Image 1.
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      ${negativePromptLine}
      `
        : isSkeletonWorkflow
          ? `
      **ROLE**: Senior fashion retoucher and AI processing expert specializing in strict pose transfer using OpenPose skeleton topologies.
      **TASK**: Re-stage the person and outfit from Image 3 into the EXACT geometric posture mapped by Image 1, matching the real-world framing of Image 2.
      **INPUT**:
      - Image 1 = OPENPOSE SKELETON MAP (Absolute master for 2D body joints, limb trajectory, and skeletal alignment)
      - Image 2 = REFERENCE PHOTOGRAPH (Master for camera distance, crop boundaries, object depth, and subject scale)
      - Image 3 = IDENTITY / OUTFIT TARGET (Master for face, hair, body proportions, and clothing texture ONLY)

      **NON-NEGOTIABLE RULES**:
      - **CRITICAL POSTURE LOCK**: You MUST force the body from Image 3 to bend, orient, and align flawlessly with every coloured joint line shown in Image 1's skeleton.
      - **CRITICAL FRAME LOCK**: Maintain a 1:1 identical visual crop to Image 2. If Image 2 cuts off at the waist, output MUST cut off at the waist.
      - Treat Image 3 exclusively as a texture palette. **IGNORE Image 3's pose completely.** Never output the posture seen in Image 3.
      - Never copy Image 2's outfit design, fabric details, accessories, bag, background, or lighting into the result.
      - Do not output a coloured stick figure. Output a photorealistic final image of the person from Image 3, mapped onto the skeleton.

      **CLOTHING INTEGRITY (CRITICAL)**:
      - Preserve the EXACT clothing from Image 3: same garment color, fabric, texture, pattern, print, and structure.
      - Preserve HOW the clothing is worn in Image 3 (tucked/untucked, sleeve state, exact hem position relative to waistband).
      - Maintain all original accessories (necklaces, belts, bags) exactly as they appear in Image 3.
      - Do NOT inherit ANY clothing or accessories from Image 2.

      **USER PROMPT**: ${prompt}

      **QUALITY GUIDELINES**:
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - Output a single, standalone photorealistic commercial image.
      ${negativePromptLine}
      `
          : workflowHint === 'pose-transfer'
            ? `
      **ROLE**: Senior fashion retoucher specializing in pose-and-framing transfer.
      **TASK**: Re-stage the person and outfit from Image 3 into the EXACT pose, angle, and framing blueprint of Image 1 and 2.
      **INPUT**:
      - Image 1 & 2 = STRICT POSE / ANGLE / FRAMING BLUEPRINT (Duplicated to anchor composition)
      - Image 3 = IDENTITY / OUTFIT / PRODUCT SOURCE

      **NON-NEGOTIABLE RULES**:
      - Treat Image 1 and 2 as the absolute masters for pose, body angle, crop distance, subject placement, arm arrangement, hand placement, and visual framing.
      - Treat Image 3 as the master for identity, body proportions, clothing, accessories, product details, tattoos, and skin texture.
      - NEVER copy Image 1 & 2's outfit design, fabric details, accessories, bag, background, lighting, or skin tone into the result.
      - **CRITICAL**: Do NOT use the pose or the camera crop of Image 3! Image 3's pose MUST be ignored. You MUST force the body from Image 3 to align with the skeleton and cropping of Image 1 & 2.
      - If Image 1 & 2 is a close-up crop without hands, the output MUST be a close-up crop without hands.
      - Abandon Image 3's composition entirely. Only extract its clothing and face.

      **CLOTHING INTEGRITY (CRITICAL)**:
      - Preserve the EXACT clothing from Image 3: same garment color, fabric, texture, pattern, print, and structure.
      - Preserve HOW the clothing is worn in Image 3:
        * If the shirt is TUCKED IN, it MUST stay tucked in the output.
        * If the shirt hangs LOOSE, it MUST hang loose in the output.
        * Preserve the exact hem position relative to the waistband.
        * Preserve sleeve state (rolled up, folded, or natural).
      ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      ${negativePromptLine}
      `
            : options.workflowHint === 'clothing-modification'
              ? `
      **ROLE**: Professional Fashion Designer and AI Modification Expert.
      **TASK**: Execute precise clothing modification based on user instructions and reference images.
      
      **MISSION**:
      - If Pattern modification: Transfer pattern from Image 2 onto the specified garment area of Image 1.
      - If Style modification: Alter the cut/silhouette of Image 1's garment according to Image 2 or description.
      - If Color modification: Change the color of specific garment parts while keeping texture and lighting.
      
      **CRITICAL RULES**:
      1. **LOCALITY**: Only modify the requested garment or area. The model's face, hair, body, and background should remain UNTOUCHED.
      2. **NATURALISM**: Ensure any added patterns or changed shapes follow the laws of physics and clothing wrinkles. Shadows and highlights must be consistent with Image 1.
      3. **FIDELITY**: If a pattern is provided in Image 2, replicate its scale, orientation, and texture precisely on the target garment.
      
      **USER PROMPT**: ${prompt}
      
      **QUALITY GUIDELINES**:
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - Ensure photorealistic fabric textures and seamless integration.
      ${negativePromptLine}
      `
            : options.workflowHint === 'clothing-effect'
              ? `
      **ROLE**: High-end Fashion Photography Retoucher.
      **TASK**: Enhance the appearance of clothing and its interaction with the model's body.
      
      **MISSION**:
      - Focus on fabric drape, texture, and the way light interacts with the material.
      - Ensure the clothing looks premium, crisp, and high-quality.
      - Maintain the model's identity and the overall scene composition.
      
      **USER PROMPT**: ${prompt}
      
      **QUALITY GUIDELINES**:
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - Prioritize fabric realism and lighting accuracy.
      ${negativePromptLine}
      `
              : options.workflowHint === 'strict-geometry-lock'
                ? `
      **ROLE**: Senior E-commerce Retoucher and Geometry-Lock Specialist.
      **TASK**: High-fidelity product retouching on a pure white background without ANY structural changes.
      **INPUT**:
      - Image 1 is the STRICT GEOMETRY REFERENCE (Anchors the composition)
      - Image 2 is the IDENTITY / PRODUCT SOURCE (Anchors the texture)

      **NON-NEGOTIABLE RULES**:
      - **CRITICAL: DO NOT CHANGE THE CAMERA ANGLE, POSING, PERSPECTIVE, OR FRAMING OF IMAGE 1.**
      - Treat Image 1 as the absolute master for silhouette, proportions, orientation, camera tilt, part placement, and bounding box.
      - Treat Image 2 as the absolute master for colors, fluffiness, material, and details.
      - You must output a purely retouched, material-enhanced version of the reference exactly as it stands.
      - Abandon any natural inclination to re-orient the product to a "better" angle. Force the exact original angle.
      - Pure white background #FFFFFF.
      - NEVER mirror, rotate, or re-pose the subject.

      **USER PROMPT**: ${prompt}

      **QUALITY GUIDELINES**:
      - Maintain commercial product photography standards.
      ${negativePromptLine}
      `
                : options.workflowHint === 'scene-product-lock'
                  ? `
      **ROLE**: Senior Amazon ecommerce art director and product-fidelity retoucher.
      **TASK**: Place the reference product into a realistic lifestyle scene without changing the product itself.
      **INPUT**:
      - Reference images are the single source of truth for product identity.
      - The user's prompt describes the desired American-market scene, people, composition, and selling context.

      **NON-NEGOTIABLE RULES**:
      - Lock the product first, then build the scene around it.
      - NEVER recolor, repaint, redesign, simplify, restyle, or substitute the product's material, fabric, fur, print, embroidery, trim, hardware, structure, proportions, silhouette, or surface finish.
      - Preserve exact hue family, saturation balance, texture depth, seams, embroidery placement, print placement, edge construction, and tactile realism from the reference image.
      - You may change the background, props, human presence, lighting mood, and environment only insofar as the product itself remains visually identical.
      - If any scene idea conflicts with product fidelity, change the scene idea instead of changing the product.
      - If multiple reference images are provided, use them only to reinforce the same product identity. Do not blend mismatched colors, materials, or details into a new variant.
      - Output exactly one polished commercial image. No collage, no split layout, no before-after composition.

      **USER PROMPT**: ${prompt}

      **QUALITY GUIDELINES**:
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - Prioritize exact product fidelity over creative scene variation.
      - Keep the final result photorealistic, premium, and commercially usable for Amazon-style ecommerce.
      ${negativePromptLine}
      `
                  : options.workflowHint === 'magic-mannequin'
                    ? `
      **ROLE**: Professional 3D Mannequin & Sculptural Artist.
      **MISSION**: Convert the person in Image 1 into a **BLANK, FACELESS, AND CLOTH-FREE** 3D mannequin based on the style and pose of Image 2.
      
      **INPUT MAPPING**:
      - Image 1 = **BODY REFERENCE** (Only for body proportions and height. **STRICTLY IGNORE** the face, hair, clothing, and any prints/patterns/logos/graphics).
      - Image 2 = **POSE & STYLE BLUEPRINT** (Master for the 3D material, lighting, pose, and camera framing).
      
      ═══════════════════════════════════════════
      ██  CRITICAL PROHIBITION: CLEAN MANNEQUIN  ██
      ═══════════════════════════════════════════
      - **NO FACE**: The output mannequin MUST have a **blank, faceless head** (like a mannequin or a smooth sculpture). Remove eyes, nose, and mouth.
      - **0% CLOTHING**: Absolutely no clothing, garments, or fabric.
      - **NO PRINTS/TATTOOS**: Strictly ignore and remove any prints, logos, sunflower graphics, or patterns found in Image 1. The skin/surface must be 100% clean and uniform.
      - **MATERIAL**: Smooth 3D render material (matte plastic, clay, or porcelain) from Image 2.
      
      ═══════════════════════════════════════════
      ██  POSE & FRAMING LOCK                       ██
      ═══════════════════════════════════════════
      - Replicate the **EXACT** body pose and arm angles from Image 2.
      - Replicate the **EXACT** camera angle and focal length from Image 2.
      
      **USER PROMPT**: ${prompt}
      
      **OUTPUT**: A single, clean, faceless 3D mannequin render with no features or clothing.
      ${negativePromptLine}
      `
                    : `
      **ROLE**: Professional Image Generation Artist.
      **TASK**: Image-to-Image Generation (Scene Fusion).
      **INPUT**: ${images.length} Reference Image(s).
      
      **INSTRUCTION**: Based on the provided reference image(s), generate a new image following the user's description below.
      
      **USER PROMPT**: ${prompt}
      
      **QUALITY GUIDELINES**:
      - Maintain high fidelity to the visual style of reference images unless overridden by the user prompt.
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - If multiple images are provided, intelligently fuse their elements or styles as implied by the prompt.
      - Preserve fine details: textures, material quality, lighting accuracy.
      ${negativePromptLine}
      `
        : `
      **ROLE**: Professional Image Generation Artist.
      **TASK**: Text-to-Image Generation.
      
      **INSTRUCTION**: Generate a new high-quality image based on the user's description below.
      
      **USER PROMPT**: ${prompt}
      
      **QUALITY GUIDELINES**:
      - Follow the prompt's aesthetic style precisely.
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - Ensure realistic textures, accurate lighting, and professional composition.
      ${negativePromptLine}
      `;

      parts.push({ text: systemPrompt });

      // Model mapping logic for nanobanana
      let requestedModel = options.modelId || "gemini-3-pro-image-preview";
      if (requestedModel === 'nanobanana2' || requestedModel === 'standard') {
        targetModel = "gemini-3.1-flash-image-preview";
      } else if (requestedModel === 'nanobananapro' || requestedModel === 'pro') {
        targetModel = "gemini-3-pro-image-preview";
      } else {
        targetModel = requestedModel;
      }

      // 柏拉图模型映射逻辑 (nanobanana2)
      // 注释掉强制追加 -4k/-2k 的逻辑，因为报错显示柏拉图的 v1/v1beta 路径不识别带后缀的模型名。
      // 应依靠 imageSize: "4K" 或 "2K" 参数让模型识别分辨率。
      /*
      if (config.isPlato && targetModel === "gemini-3.1-flash-image-preview") {
          if (options.resolution === ImageResolution.RES_05K) targetModel = "gemini-3.1-flash-image-preview-512px";
          else if (options.resolution === ImageResolution.RES_2K) targetModel = "gemini-3.1-flash-image-preview-2k";
          else if (options.resolution === ImageResolution.RES_4K) targetModel = "gemini-3.1-flash-image-preview-4k";
          console.log(`[Plato Model Mapping] Mapped ${options.resolution} to ${targetModel}`);
      }
      */

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
        const platoHint = config.isPlato ? `\n[柏拉图提示] 模型 ${targetModel} 在当前节点或路径下暂不可用，请联系管理员或切换节点(如美国/香港)。` : '';
        const customError = new Error(`${error.message}${platoHint}`);
        (customError as any).status = error.status;
        (customError as any).isPathError = isPathError;
        lastError = customError;
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
 * 2.1.2 Inpainting Generation (局部替换)
 * 发送原图 + 蒙版 + 提示词，仅在蒙版白色区域重新生成内容。
 */
export const generateInpainting = async (
  sourceImage: { base64: string; mimeType: string },
  maskImage: { base64: string; mimeType: string },
  prompt: string,
  options: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    modelId?: string;
    refImages?: { base64: string; mimeType: string }[];
    fabricRefImages?: { base64: string; mimeType: string }[];
    colorRefImages?: { base64: string; mimeType: string }[];
  } = {}
) => {
  const retryLimit = 3;
  let lastError: any = null;

  const initialConfig = getApiConfig();
  const maxRetries = Math.min(initialConfig.keyCount, 3);

  let targetModel = options.modelId || "gemini-3-pro-image-preview";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const config = getApiConfig(initialConfig.currentIndex + attempt);
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: config.isYunwu ? { baseUrl: config.baseUrl } : undefined,
      apiVersion: config.apiVersion as any
    });

    try {
      const parts: any[] = [];

      // 1. 原图
      parts.push({
        inlineData: {
          mimeType: sourceImage.mimeType,
          data: sourceImage.base64,
        },
      });

      // 2. 蒙版图（白色=编辑区域, 黑色=保留区域）
      parts.push({
        inlineData: {
          mimeType: maskImage.mimeType,
          data: maskImage.base64,
        },
      });

      // 2.5 参考图（可选）
      if (options.refImages && options.refImages.length > 0) {
        options.refImages.forEach((img) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        });
      }

      // 2.6 面料参考图（可选）
      if (options.fabricRefImages && options.fabricRefImages.length > 0) {
        options.fabricRefImages.forEach((img) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        });
      }

      // 2.7 颜色参考图（可选）
      if (options.colorRefImages && options.colorRefImages.length > 0) {
        options.colorRefImages.forEach((img) => {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        });
      }

      // 3. 构造局部替换提示词
      const hasRefImages = options.refImages && options.refImages.length > 0;
      const hasFabricRefImages = options.fabricRefImages && options.fabricRefImages.length > 0;
      const hasColorRefImages = options.colorRefImages && options.colorRefImages.length > 0;

      const refImageInstruction = hasRefImages
        ? `\n      5. Additional reference images (Image 3+) are provided as VISUAL GUIDES for the replacement content (style / what to replace into). The generated content in the white mask area should look like or be inspired by these images.`
        : '';

      const fabricRefInstruction = hasFabricRefImages
        ? `\n      6. Fabric reference images are provided. These are STRICT guides for fabric texture/material finish (weave, knit, leather grain, gloss/matte). When generating clothing/fabric in the WHITE mask area, match these fabric textures as closely as possible. Avoid random patterns not present in the references.`
        : '';

      const colorRefInstruction = hasColorRefImages
        ? `\n      7. Color reference images are provided. These are STRICT guides for the target garment color palette (hue/saturation/value). When generating clothing in the WHITE mask area, keep the garment color consistent with these references and avoid unwanted color shifts.`
        : '';

      const systemPrompt = `
      **ROLE**: Professional Image Inpainting Specialist.
      **TASK**: Partial Image Replacement (Inpainting).
      **INPUT**: Image 1 is the [Source Image]. Image 2 is the [Mask] (white areas = regions to regenerate, black areas = regions to preserve EXACTLY).

      **CRITICAL INSTRUCTIONS**:
      1. You MUST ONLY modify the areas marked as WHITE in the mask image.
      2. The BLACK areas in the mask MUST remain PIXEL-PERFECT IDENTICAL to the source image. No changes whatsoever.
      3. The newly generated content in the white areas must seamlessly blend with the surrounding preserved areas in terms of lighting, perspective, color temperature, and style.
      4. Generate the new content according to the user's description below.${refImageInstruction}${fabricRefInstruction}${colorRefInstruction}

      **USER DESCRIPTION**: ${prompt}

      **QUALITY GUIDELINES**:
      - Seamless edge blending between generated and preserved regions.
      - ${QUALITY_BOOSTERS.PHOTOGRAPHY}
      - Match the original image's artistic style, lighting direction, and color palette.
      - Ensure photorealistic textures in the regenerated area.
      `;

      parts.push({ text: systemPrompt });

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
      console.warn(`[Inpainting Retry] Attempt ${attempt + 1} failed. Error:`, error.message);

      const isPathError = error.message?.includes('invalid_request') || error.message?.includes('404');
      const isServiceError = error.status === 503 || error.message?.includes('503');

      if (isPathError || isServiceError) {
        break;
      }

      if (error.status === 429 || error.status === 401) {
        continue;
      }

      if (attempt < maxRetries - 1) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Inpainting generation failed after multiple attempts.");
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
      model: "gemini-3.1-flash-lite-preview", // Use Lite for fast analysis
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
  【图像深度解析与细节捕捉框架 - 实时还原版】
  
  请作为一名顶尖的视觉分析专家，对输入图像进行“像素级”拆解。你的目标是生成一套能够支撑 4K 高清放大的结构化提示词，必须捕捉到原图的所有灵魂特征。

  ══ A. 场景核心 (Macro) ══
  • 主体识别：准确定位视觉中心（人/物/景），描述其具体型号、物种或状态。
  • 核心叙事：描述当下正在发生的动作、情感或状态。
  • 空间构图：定位视角（广角/微距/鸟瞰）、光心位置、景深分布。
  
  ══ B. 风格 DNA (Medium) ══
  • 媒介属性：**严命**：如果是照片请务必标注 "Photorealistic", "Unprocessed RAW", "8k UHD"。
  • 色彩科学：主色调 HEX/色彩倾向、冷暖对比程度、色彩饱和度分布。
  • 光影物理：光源性质（硬光/柔光/侧逆光）、光影过渡的平滑度。
  
  ══ C. 微观细节捕捉 (Micro - 还原核心) ══
  请针对识别到的主体类型，**极致捕捉**以下细节特征（如有）：
  - **生物/人像**：[皮肤毛孔、汗毛走向、眼球湿润反光与虹膜细节、发丝微小的毛糙、唇部纹路、血管隐现]。
  - **建筑/工业**：[砖缝中的灰浆质感、金属拉丝/锈蚀痕迹、玻璃微小的划痕、涂料的风化颗粒、精密接合缝隙]。
  - **自然/植被**：[叶脉的几何分叉、露珠的折射率、岩石的断层层理、土壤的潮湿颗粒、云层的纤维状边缘]。
  - **织物/服饰**：[经纬编织的微观纹理、纤维起球情况、缝纫针脚的走线逻辑、布料的细微反光倾向]。
  
  ══ D. 技术参数引导 ══
  • 器材拟真：模拟特定镜头（如 35mm f/1.4, 85mm Prime）的散景质感。
  • 清晰度控制：强调边缘的锐利度与内部质感的细腻度。

  ## 输出格式 (Output Format)
  请输出符合 JSON 格式的结果，确保 positive_prompt 具有极高的还原引导力：
  \`\`\`json
  {
    "positive_prompt": "以艺术风格开头 (如: Photorealistic, 8k, raw photo)，紧随主体与动作详细描述，接着是[微观细节]部分的具体特征词，最后加入高品质助推词 (如: highly detailed, sharp focus, masterpiece)。",
    "negative_prompt": "Low quality, blurry, distorted, deformed, text, watermark, CGI, 3d render, plastic skin, smoothed textures, missing details, incorrect perspective, artifacts.",
    "style_summary": "请用结构化的中文汇总上述分析，特别是微观细节部分的捕捉结果。",
    "key_features": ["核心主体", "微观纹理", "光影特征"],
    "recommended_params": {
      "aspect_ratio": "1:1",
      "style_weight": 0.85
    }
  }
  \`\`\`
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
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
          imageSize: "2K"
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
          imageSize: "2K" // Higher res for better structural guidance
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

  // PHASE 1: IDENTITY REFERENCE (The Blueprint)
  // Re-introducing the original image as a direct visual anchor to ensure 100% restoration/fidelity.
  parts.push({ inlineData: { mimeType: original.mime, data: original.base64 } });

  // PHASE 2: CONTROL ADAPTERS (Structure & Color Palette)
  if (colorMap) {
    const base64Clean = colorMap.split(',')[1] || colorMap;
    parts.push({ inlineData: { mimeType: "image/png", data: base64Clean } });
  }
  if (lineArt) {
    const base64Clean = lineArt.split(',')[1] || lineArt;
    parts.push({ inlineData: { mimeType: "image/png", data: base64Clean } });
  }

  // PHASE 3: UPSCALING PROTOCOL
  const scaleMap = { 2: "2K", 4: "4K", 8: "4K" }; 
  const targetRes = (scaleMap as any)[upscaleFactor] || "2K";

  const systemPrompt = `
  # ROLE: Professional Image Super-Resolution & Reconstruction Expert (Hyper-Fidelity Mode)
  
  # CORE MISSION:
  Transform **Image 1** (Source Blueprint) into a Masterpiece of Clarity at ${targetRes} resolution.
  Your goal is **Sub-Pixel Enhancement**: sharpening every edge, clarifying every texture, and removing blur/noise while maintaining 100% Identity Integrity.
  
  # INPUT SYNERGY:
  - **Image 1 (Identity)**: The absolute master for colors, features, and essence. Do NOT deviate.
  - **Image 3 (Structural Guide)**: Precise line-work for edge sharpening and structural locking.
  
  # RECONSTRUCTION PROTOCOL:
  1. **Sharpening & Definition**: Aggressively clarify edges, eyes, skin texture, and fabric weave found in Image 1. 
  2. **Texture Density**: Increase the perception of detail (e.g., skin pores, hair strands) to match the ${targetRes} output. These details must feel "restored", not "added".
  3. **Zero Content Drift**: Every feature must remain in its exact spatial position as defined by Image 3. No new objects.
  
  # STYLE GUIDELINE:
  Ultra-sharp, 8k professional photography, high-dynamic range, zero compression artifacts, perfect restoration.
  
  # RESTORATION PROMPT:
  ${promptData.positive}

  # FORBIDDEN (NEGATIVE):
  blurry, muddy textures, AI-generated artifacts, facial distortion, style alteration, content movement, ${promptData.negative}.
  `;

  parts.push({ text: systemPrompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: parts },
      config: {
        temperature: 0.15, // Extremely low for maximum fidelity
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: targetRes as any
        }
      } as any
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
 *  THREE-VIEW GENERATION (三视图制作)
 * =========================================================================================
 */

/**
 * Analyze product and model images for Three-View generation.
 * Uses gemini-3.1-flash-lite-preview as the default text analysis model.
 */
export const analyzeThreeViewContext = async (
  images: { base64: string; mimeType: string }[],
  textModel: string = "gemini-3.1-flash-lite-preview"
) => {
  const ai = getAiClient();

  const analysisPrompt = `
**ROLE**: Professional Product Photographer & 3D Visualization Expert.

**TASK**: Analyze the provided reference images of a product and/or model, then generate structured descriptions for creating THREE distinct views: FRONT, SIDE (profile), and BACK.

**INPUT IMAGES GUIDE**:
- Images provided may include: product photos, model/person reference photos, or both.

**YOUR ANALYSIS GOALS**:

1. **PRODUCT ANALYSIS (CRITICAL)**:
   - Identify the product type (garment, accessory, bag, shoes, etc.)
   - Describe color, material, texture, patterns, logos, and design details with extreme precision
   - Note any unique features that must be preserved across all three views

2. **MODEL IDENTITY (if model reference provided)**:
   - Ethnicity, hair color/style, facial features
   - Body build, height impression, proportions
   - The model MUST remain identical across all three views

3. **THREE-VIEW SPECIFICATIONS**:
   For each view, provide specific pose and composition instructions:
   
   - **FRONT VIEW**: Direct front-facing, symmetrical composition, full body or 3/4 body, product clearly visible from front
   - **SIDE VIEW**: Pure 90° profile (left or right), showing product silhouette, depth, and side details
   - **BACK VIEW**: Direct rear view, showing back design, closure details, rear fit

**OUTPUT FORMAT (MANDATORY JSON)**:
{
  "product_type": "Type of product identified",
  "product_description": "Extremely detailed description of the product appearance, color, material, patterns...",
  "model_identity": "Detailed physical description of the model for identity locking across views...",
  "front_view_instruction": "Specific pose, composition, and styling instruction for the FRONT view...",
  "side_view_instruction": "Specific pose, composition, and styling instruction for the SIDE view...",
  "back_view_instruction": "Specific pose, composition, and styling instruction for the BACK view..."
}

Respond ONLY with valid JSON.
`;

  try {
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 }
    }));
    parts.push({ text: analysisPrompt });

    const response = await ai.models.generateContent({
      model: textModel,
      contents: { parts }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Three-view analysis failed", error);
    return {
      product_type: "Product",
      product_description: "Professional product",
      model_identity: "Professional model",
      front_view_instruction: "Front-facing, symmetrical, full body shot",
      side_view_instruction: "90-degree side profile, full body shot",
      back_view_instruction: "Rear view, full body shot showing back details"
    };
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

/**
 * =========================================================================================
 *  CLOTHING MODIFICATION EXPERT SYSTEM (服装改款专家系统) - V2.0
 * =========================================================================================
 */

/**
 * Refine user's modification prompt using a thinking model (Gemini-3.1-Flash-Lite).
 * Inject mode-specific core skills for extreme precision.
 */
export const refineModificationPrompt = async (
  mode: string,
  userPrompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> => {
  const ai = getAiClient();
  
  const modeSkills: Record<string, string> = {
    'pattern-on-body': `
      **SKILL: DYNAMIC FABRIC MAPPING (核心技能：织物动态映射)**
      - **CRITICAL**: Replicate the pattern from Image 2 onto the target garment in Image 1.
      - **GEOMETRIC ADHERENCE**: The pattern must warp, bend, and scale perfectly according to the physical folds, wrinkles, and shadows of the garment in Image 1.
      - **PERSPECTIVE**: If Image 1 is at an angle, the pattern must follow that 3D perspective.
      - **TEXTURE FUSION**: Preserve the original fabric's weave (e.g., silk sheen, cotton matte) on top of the new pattern.
    `,
    'style-mod': `
      **SKILL: SILHOUETTE RECONSTRUCTION (核心技能：拓扑轮廓重塑)**
      - **CRITICAL**: Modify the cut and silhouette of the garment in Image 1 based on the style cues from Image 2 or instructions.
      - **IDENTITY LOCK**: Keep the person's face, hair, and background 100% frozen. ONLY change the garment's topology.
      - **MATERIAL CONSISTENCY**: Even if the shape changes, the fabric texture from Image 1 must remain consistent unless explicitly told otherwise.
      - **LOGIC**: Ensure the new style follows human skeletal constraints.
    `,
    'pattern-design': `
      **SKILL: AESTHETIC SYNTHESIS (核心技能：美学审美合成)**
      - **CRITICAL**: Extract the artistic theme, color palette, and motifs from Image 2.
      - **DESIGN ENGINE**: Generate a COMPLETELY NEW pattern that fits the garment's panels in Image 1 based on the extracted aesthetic.
      - **PLACEMENT**: Place motifs intelligently (e.g., pocket accents, centered chest graphics, or all-over prints).
    `,
    'line-filling': `
      **SKILL: PHOTOREALISTIC RENDERING PROTOCOL (核心技能：线稿写实渲染协议)**
      - **CRITICAL**: Treat Image 1 as a structural line-art guide (geometry master).
      - **RENDER TARGET**: Fill the line-art with hyper-realistic materials, lighting, and textures derived from Image 2.
      - **ZERO DRIFT**: Do not change the shape or pose defined by the line-art.
    `,
    'fabric-on-body': `
      **SKILL: FIBER-LEVEL DISPLACEMENT (核心技能：纤维级材质置换)**
      - **CRITICAL**: Replace the surface material of Image 1's clothing with the physical material of Image 2.
      - **DETAIL LOCK**: Keep all seams, buttons, and zippers from Image 1, but swap the pixel-level texture.
      - **PHYSICALITY**: If Image 2 is "heavy leather," ensure the folds reflect that weight vs "light silk."
    `,
    'color-change': `
      **SKILL: NON-DESTRUCTIVE RECOLORING (核心技能：非破坏性精准调色)**
      - **CRITICAL**: Remap the color values of the specified garment in Image 1 to match the palette in Image 2.
      - **LUMINANCE LOCK**: Preserve all original highlights, mid-tones, and shadows. The 3D volume of the clothes must remain identical.
      - **EDGE PRECISION**: Ensure clean color transitions at the garment edges.
    `,
    'free-design': `
      **SKILL: CREATIVE DESIGN ELEVATION (核心技能：高阶创意发散设计)**
      - **CRITICAL**: Perform an artistic fusion of Image 1 and Image 2.
      - **GOAL**: Create a vision-leading fashion piece that preserves the person's identity but radically enhances the aesthetic value.
    `
  };

  const activeSkill = modeSkills[mode] || modeSkills['free-design'];

  const refinementPrompt = `
**ROLE**: Senior AI Fashion Prompt Engineer & Expert Designer.

**TASK**: Analyze the user's intent and reference images to construct a high-precision MASTER PROMPT for the image generation engine.

**MODE-SPECIFIC CORE SKILL**:
${activeSkill}

**REFINING PROTOCOL (AGENT CONTROL MODE)**:
1. **Visual Analysis**: Deconstruct the garment in Image 1 (structure, fit, folds).
2. **Material Analysis**: Deconstruct the texture/pattern in Image 2.
3. **Synthesis**: Combine them into a single, cohesive, technical prompt.
4. **Keyword Enrichment**: Use high-fidelity photography keywords (8k, photorealistic, intricate textures, ray-traced shadows).

**USER ORIGINAL INTENT**: "${userPrompt}"

**OUTPUT FORMAT (MANDATORY)**:
Return ONLY the final enriched English prompt. Do NOT include any preamble or extra text.
`;

  try {
    const parts: any[] = images.map(img => ({
      inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 }
    }));
    parts.push({ text: refinementPrompt });

    const response = await executeWithTimeout(
      ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: { parts }
      }),
      { timeoutMs: 30000 }
    );

    return response.text?.trim() || userPrompt;
  } catch (error: any) {
    console.warn("Prompt refinement failed, falling back to original prompt.", error.message);
    return userPrompt; // Fallback to original
  }

};
