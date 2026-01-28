import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { AspectRatio, ImageResolution } from "../types";

// Helper to get a fresh AI client instance.
// It checks localStorage for a custom user key first, then falls back to the environment key.
const getAiClient = () => {
  const customKey = localStorage.getItem("user_api_key");
  const apiKey = customKey || process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  return new GoogleGenAI({ apiKey });
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
      model: "gemini-2.5-flash-image",
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

    const response = await ai.models.generateContent({
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
export const generateImageToImage = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
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

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K",
        },
      },
    });

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
        "R6 Rear 3/4 View": "shot from rear-right at 150 degree angle, rear cabin and seats visible",
        "R1 Rear Front Close-up": "shot facing rear bench directly, close-up, all three headrests visible",
        "R2 Rear Side Left": "shot from left rear door position, rear seat side view, interior visible",
        "R3 Rear Side Right": "shot from right rear door position, rear seat side view, interior visible",
        "R4 Rear Folded View": "shot from right side, rear seat cushion folded up, mechanism visible",
        "R5 Top-Down Reclined": "shot from above at 60 degree angle, looking down into cabin, seats reclined",

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

    // 3.1 Location Decoding
    if (viewMap[targetRow]) {
      if (targetRow.startsWith("S")) finalTargetRow = "Front Row Single Seat";
      else if (targetRow.startsWith("SET")) finalTargetRow = "Full Car Interior";
      else if (targetRow.startsWith("F")) finalTargetRow = "Front Row";
      else if (targetRow.startsWith("R")) finalTargetRow = "Rear Row";
    }

    // 3.2 Single Seat Detection for V4.0 Context Control
    const isSingleSeat = seatConfig === 'Single Seat' || targetRow.startsWith('S');

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

    // 4. Construct V4.0 Prompt
    const v4Prompt = `
## ✅ AutoFusion™ Pro V4.0 (Live Request)

**SYSTEM**: AutoFusion™ Pro V4.0 - Automotive Interior Visualization Engine

---

## 🎯 MISSION

Generate a photorealistic commercial photograph of a **${year} ${carModel}** interior with the user's **[${productCategory}]** (Reference Images 1-${seatCoverImages.length}) professionally installed.

---

## 📐 CAMERA CONTROL [PRIORITY: MAXIMUM]

**ANGLE_ID**: ${angleId}
**CAMERA INSTRUCTION**: ${angleInstruction}

> ⚠️ This camera angle is LOCKED. Output MUST match this exact perspective regardless of other parameters.

---

## 🚗 VEHICLE DECODE

| Attribute | Value |
|-----------|-------|
| Model | ${carModel} |
| Year | ${year} |
| Seat Config | ${seatConfig} |
| Target Area | ${finalTargetRow} |

**IDENTIFICATION PROTOCOL**:
- Analyze "${year} ${carModel}" to extract OEM interior DNA.
${isSingleSeat 
  ? "- **SINGLE SEAT MODE**: Focus ONLY on the seat geometry. Minimize dashboard/surroundings."
  : "- Mandatory accurate features: Dashboard layout, Screen size/shape, steering wheel style."
}
- If "${seatConfig}" specifies trim (e.g. Captain Seats), match seat geometry exactly.

---

## 🎨 COLOR PROTOCOL [STRICT]

| Zone | Color Rule |
|------|------------|
| Dashboard | ${isSingleSeat ? "OBSCURED / BLURRED OUT / REMOVED" : "PURE BLACK"} |
| Door Panels | ${isSingleSeat ? "NOT VISIBLE" : "PURE BLACK / DARK GREY"} |
| Carpet & Floor | BLACK |
| Headliner | DARK GREY |
| **PRODUCT (Seat Covers)** | ⛔ **ORIGINAL COLORS ONLY - NO MODIFICATION** |

**TEXTURE MANDATE**: Even in black, render distinct material textures (Leather grain ≠ Plastic matte).

---

## 🪑 PRODUCT INSTALLATION [CORE SKILL]

**PLACEMENT LOGIC**:
IF ${productCategory} == "Seat Cover" → Install on seats.

**PHYSICAL REALISM CHECKLIST**:
- [ ] Tension wrinkles where material pulls tight over seat foam
- [ ] Natural fabric folds at contour transitions
- [ ] Proper edge tucking into seat crevices
- [ ] Visible stitching matching reference images

---

## 💡 LIGHTING SETUP

┌─────────────────────────────────────┐
│         ☀️ KEY LIGHT               │
│         (Soft diffused, upper front)│
└─────────────────────────────────────┘

- **Style**: ${isSingleSeat ? "Product Catalog Studio (Isolated)" : "Commercial Studio (Interior)"}
- **Environment**: ${isSingleSeat ? "Neutral Studio Grey/White Gradient (No Background Distractions)" : "Pure white cyclorama / Neutral grey studio"}

---

## 🏷️ BRAND DNA ADAPTATION

Apply "${carModel}" brand DNA to seat geometry and visible knobs/levers.

---

## 📤 OUTPUT SPECIFICATION

| Parameter | Value |
|-----------|-------|
| Aspect Ratio | ${aspectRatio} |
| Resolution | ${resolution === ImageResolution.RES_4K ? "8K Ultra Detail" : "High Quality"} |
| Style | Commercial product photography |
| Realism | Photorealistic, NOT 3D render |
| Background | ${isSingleSeat ? "Clean Studio Background (Minimal/No Car Interior)" : "White studio (visible through windows)"} |

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
    // REVERTED: User prefers Quality > Speed. 
    // Always use Gemini 3.0 Pro for best photorealism, regardless of resolution.
    // Flash 2.0 was deemed insufficient for seat cover texture details.
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolution,
        },
      },
    });

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
) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: originalBase64,
              mimeType: "image/png", // Assuming canvas export is png
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
            You are a Senior Retoucher for a High-End Brand.
            
            You have two input images.
            Image 1: The original campaign shot.
            Image 2: A binary mask (white area is the edit zone).
            
            TASK: Precision Retouching on Image 1.
            1. Use Image 2 to identify the EXACT area to modify.
            2. Apply the change: "${prompt}".
            3. **CRITICAL**: Match the new texture/object's lighting and perspective to the original scene.
            4. If changing outfit/material, preserve realistic folds and draping.
            5. Keep the unmasked area PIXEL-PERFECT identical.
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
    console.error("Inpainting failed", error);
    throw error;
  }
};

/**
 * 3.1 Edit Generated Image (Legacy Text Only)
 * Uses gemini-2.5-flash-image
 */
export const editGeneratedImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
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
      model: "gemini-2.5-flash-image",
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
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash-image",
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
      model: "gemini-2.5-flash-image",
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
