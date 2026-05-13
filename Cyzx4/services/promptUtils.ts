import { STYLE_PACKS } from './stylePacks';

/**
 * Prompt Engineering Utilities
 * Based on Imagen 3.0 (Nano Banana) Skills Documentation
 * 
 * Centralizes quality boosters, negative prompt builders, and
 * the 7-element golden formula for consistent prompt quality
 * across all image generation agents.
 */

// ==================== Quality Boosters ====================

/** Universal quality keywords that improve output fidelity */
export const QUALITY_BOOSTERS = {
    /** For photorealistic/photography outputs */
    PHOTOGRAPHY: "high resolution, 8K, ultra HD, professional photography, sharp focus, photorealistic, highly detailed, studio quality, extremely detailed skin texture, realistic skin pores visible, natural skin highlight, subsurface scattering, beauty dish lighting",

    /** For product/commercial photography */
    PRODUCT: "commercial photography, product shot, e-commerce quality, clean and professional, high resolution, sharp focus, studio lighting, crisp product details, professional color grading",

    /** For illustration/art outputs */
    ILLUSTRATION: "professional illustration, highly detailed, intricate details, sharp lines, vibrant colors, gallery quality",

    /** For editorial/fashion photography */
    EDITORIAL: "editorial quality, magazine cover worthy, professional photography, award-winning, cinematic, highly detailed, impeccable commercial skin texture, fine skin details, natural micro-pores, high-end beauty photography aesthetic, 85mm lens portrait",

    /** For film/analog photography */
    FILM: "analog film photography, Kodak Portra 400, film grain, natural light, cinematic, highly detailed skin texture, organic pores, editorial aesthetic, photorealistic",

    /** Minimal set for editing/retouching (avoid over-constraining) */
    RETOUCHING: "high resolution, seamless edit, professional retouching quality, sharp details, natural blending, preserved skin texture",
} as const;

// ==================== Negative Prompts ====================

/** Base negative prompt — always include */
const NEGATIVE_BASE = "blurry, out of focus, low resolution, pixelated, low quality, bad quality, watermark, logo, text, signature, jpeg artifacts, distorted, deformed, plastic skin, over-smoothed skin, airbrushed skin, unnatural skin texture, CGI look, 3D render";

/** Scene-specific negative prompts */
const NEGATIVE_SCENE: Record<string, string> = {
    portrait: "bad anatomy, extra limbs, deformed face, bad proportions, extra fingers, missing fingers, disfigured, ugly face, plastic face, smooth face, porcelain skin",
    product: "cluttered background, distracting elements, uneven lighting, shadows on product, fingerprints, dust, scratches",
    landscape: "people, man-made structures, power lines, trash, flat lighting",
    illustration: "photorealistic, 3D render, photograph, blurry, sketchy outlines",
    editorial: "casual, messy, stock photo feel, fake smiles, uncomfortable poses, artificial skin, over-retouched",
    automotive: "wrong brand elements, generic car interior, CGI look, 3D render, plastic texture",
    inpainting: "visible seam, color mismatch, edge artifacts, blending errors, inconsistent lighting",
    outpainting: "visible seam, mismatched lighting, color shift, discontinuous patterns, abrupt edges",
};

/** Style conflict negative prompts */
const NEGATIVE_STYLE: Record<string, string> = {
    realistic: "cartoon, anime, illustrated, abstract, CGI, 3D render, smooth plastic skin",
    minimalist: "cluttered, busy, excessive details, chaotic",
    cinematic: "flat lighting, boring composition, amateur, snapshot",
    film: "digital render, smooth skin, CGI, plastic skin, artificial lighting, 3D render",
};

/** Specific negative prompts for perspective and angle issues (legacy, kept for backward compat) */
export const NEGATIVE_PERSPECTIVE = "wrong angle, distorted perspective, fisheye effect, tilted horizon, off-center composition, wide angle distortion, incorrect field of view";

/**
 * Per-angle-category negative prompts for precision perspective control.
 * Based on Skills §5 — Layered Combination Strategy & §2.2 Composition.
 * Each category blocks the specific opposing viewpoints to prevent angle drift.
 */
export const NEGATIVE_PERSPECTIVE_MAP: Record<string, string> = {
    FRONT: "side view, rear view, bird's eye view, worm's eye view, Dutch angle, tilted horizon, profile shot, over-the-shoulder, diagonal perspective",
    SIDE: "front view, rear view, top-down view, overhead shot, symmetrical front, centered front-facing, bird's eye",
    TOP_DOWN: "eye-level shot, side view, low angle, worm's eye view, front profile, horizon visible, level perspective",
    REAR: "front view, side profile, bird's eye view, overhead shot, dashboard visible from front, driver POV forward",
    CLOSE_UP: "wide shot, full body, establishing shot, distant subject, tiny subject, wide angle, panoramic, full cabin visible",
    THREE_QUARTER: "dead center front, pure side profile, pure rear view, top-down, overhead, bird's eye",
    DEFAULT: "wrong angle, distorted perspective, fisheye effect, tilted horizon, off-center composition, wide angle distortion",
};

/**
 * Lens simulation constants for camera parameter anchoring.
 * Based on Skills §2.2 — 焦距/镜头 and 质量增强词.
 * These phrases help the AI "simulate" a physical camera configuration.
 */
export const LENS_SIMULATION: Record<string, string> = {
    WIDE: "shot on 24mm wide-angle lens, f/8, deep depth of field, full scene in focus",
    STANDARD: "shot on 50mm standard lens, f/4, natural perspective, moderate depth of field",
    PORTRAIT: "shot on 85mm portrait lens, f/2.8, shallow depth of field, soft background bokeh",
    MACRO: "shot on 100mm macro lens, f/2.8, extreme shallow depth of field, razor-thin focus plane",
    AUTOMOTIVE: "shot on 35mm lens, f/5.6, automotive interior photography, professional commercial quality",
    PRODUCT: "shot on 50mm standard lens, f/4, studio product photography, clean neutral background",
};

/**
 * Helper: resolve a targetRow ID to the correct NEGATIVE_PERSPECTIVE_MAP category.
 * @param targetRow - The angle preset ID (e.g. "F1 High-Angle Top-Down", "R2 Rear Side Left")
 * @returns The matching negative prompt string for that angle category
 */
export function getAngleNegative(targetRow: string): string {
    // Top-down / overhead angles
    if (/top.?down|overhead|F1|R5|A07/i.test(targetRow)) return NEGATIVE_PERSPECTIVE_MAP.TOP_DOWN;
    // Front-facing / symmetrical
    if (/front.?view|S1|R1|A03|A11/i.test(targetRow)) return NEGATIVE_PERSPECTIVE_MAP.FRONT;
    // Rear-facing
    if (/rear.?to.?front|F4/i.test(targetRow)) return NEGATIVE_PERSPECTIVE_MAP.REAR;
    // Side profiles
    if (/side|profile|F2|R2|R3|A05|A06/i.test(targetRow)) return NEGATIVE_PERSPECTIVE_MAP.SIDE;
    // Close-up / detail / macro
    if (/close.?up|detail|macro|A09|A13|A14|A15/i.test(targetRow)) return NEGATIVE_PERSPECTIVE_MAP.CLOSE_UP;
    // 3/4 angles
    if (/3\/4|quarter|S2|S3|F3|R6|A08/i.test(targetRow)) return NEGATIVE_PERSPECTIVE_MAP.THREE_QUARTER;
    // Default fallback
    return NEGATIVE_PERSPECTIVE_MAP.DEFAULT;
}

/**
 * Helper: resolve a targetRow ID to the correct LENS_SIMULATION preset.
 * @param targetRow - The angle preset ID
 * @returns The matching lens simulation string
 */
export function getAngleLens(targetRow: string): string {
    if (/top.?down|overhead|F1|R5|A07/i.test(targetRow)) return LENS_SIMULATION.WIDE;
    if (/close.?up|detail|macro|A09|A13|A14|A15/i.test(targetRow)) return LENS_SIMULATION.MACRO;
    if (/^S\d|white.?background|A01|A02/i.test(targetRow)) return LENS_SIMULATION.PRODUCT;
    return LENS_SIMULATION.AUTOMOTIVE;
}

/**
 * Build a layered negative prompt.
 * Combines base + scene + style layers for comprehensive coverage.
 * 
 * @param scene - Scene type key (portrait, product, landscape, etc.)
 * @param style - Style type key (realistic, minimalist, cinematic, film)
 * @param extra - Additional custom negative terms
 * @returns Combined negative prompt string
 * 
 * Based on Skills §5.3 — Layered Combination Strategy
 */
export function buildNegativePrompt(
    scene?: keyof typeof NEGATIVE_SCENE,
    style?: keyof typeof NEGATIVE_STYLE,
    extra?: string
): string {
    const parts = [NEGATIVE_BASE];
    if (scene && NEGATIVE_SCENE[scene]) parts.push(NEGATIVE_SCENE[scene]);
    if (style && NEGATIVE_STYLE[style]) parts.push(NEGATIVE_STYLE[style]);
    if (extra) parts.push(extra);
    return parts.join(", ");
}

// ==================== Golden Formula ====================

/**
 * The 7-element golden formula structure for prompt construction.
 * Based on Skills §2.1
 * 
 * Order matters — Imagen gives more weight to elements at the front.
 * 
 * Formula: [Subject] + [Action] + [Environment] + [Style] + 
 *          [Lighting] + [Composition] + [Quality Boosters]
 */
export interface GoldenFormulaInput {
    /** Main subject with specific details (color, material, size, features) */
    subject: string;
    /** Action or state (standing, running, floating, etc.) — optional */
    action?: string;
    /** Environment or scene (indoor/outdoor, time, weather, ambient elements) */
    environment?: string;
    /** Art/photography style (portrait photography, oil painting, etc.) */
    style?: string;
    /** Lighting description (golden hour, studio lighting, etc.) */
    lighting?: string;
    /** Camera angle, framing, lens, composition rule */
    composition?: string;
    /** Quality booster preset key or custom string */
    qualityBooster?: keyof typeof QUALITY_BOOSTERS | string;
}

/**
 * Build a prompt using the 7-element golden formula.
 * Elements are ordered by Imagen weight priority (front = more influence).
 * 
 * @param input - Golden formula elements
 * @returns Structured prompt string
 */
export function buildGoldenFormula(input: GoldenFormulaInput): string {
    const parts: string[] = [];

    // Subject is always first (highest weight)
    parts.push(input.subject);

    if (input.action) parts.push(input.action);
    if (input.environment) parts.push(input.environment);
    if (input.style) parts.push(input.style);
    if (input.lighting) parts.push(input.lighting);
    if (input.composition) parts.push(input.composition);

    // Quality boosters last
    if (input.qualityBooster) {
        const booster = QUALITY_BOOSTERS[input.qualityBooster as keyof typeof QUALITY_BOOSTERS]
            || input.qualityBooster;
        parts.push(booster);
    }

    return parts.join(", ");
}

// ==================== Prompt Enhancement ====================

/**
 * Enhance a raw user prompt with quality boosters.
 * Appends quality keywords without altering the user's intent.
 * 
 * @param rawPrompt - The user's original prompt
 * @param boosterKey - Which quality booster preset to use
 * @returns Enhanced prompt string
 */
export function enhancePrompt(
    rawPrompt: string,
    boosterKey: keyof typeof QUALITY_BOOSTERS = "PHOTOGRAPHY"
): string {
    const booster = QUALITY_BOOSTERS[boosterKey];
    // Avoid double-appending if the prompt already contains key quality words
    if (rawPrompt.toLowerCase().includes("8k") || rawPrompt.toLowerCase().includes("high resolution")) {
        return rawPrompt;
    }
    return `${rawPrompt}, ${booster}`;
}

// ==================== Scene Randomizer ====================

/** Diverse scene locations for the Film Protocol scene randomizer */
export const SCENE_POOL = [
    "Rooftop garden at sunset with lens flare",
    "Interior of a brutalist concrete art gallery",
    "Ferry boat deck with ocean spray",
    "Greenhouse filled with tropical plants",
    "Rainy neon alleyway with reflections",
    "Old library with dust motes in light beams",
    "Windy cliffside with tall grass",
    "Vintage bookshop with warm pendant lights",
    "Cobblestone courtyard with climbing ivy",
    "Industrial loft with floor-to-ceiling windows",
    "Japanese zen garden with cherry blossoms",
    "Underground metro station with golden light",
    "Morning fish market with wet concrete floors",
    "Desert highway at golden hour with heat haze",
    "Floating dock on a misty lake at dawn",
    "Art Deco hotel lobby with marble floors",
    "Street food stall with warm neon signage",
    "Autumn forest path with fallen leaves and fog",
    "Rooftop pool overlooking a city skyline at dusk",
    "Flower field in the countryside at magic hour",
] as const;

// ==================== Texture Keywords ====================

/** Expanded texture vocabulary for the Film Protocol */
export const TEXTURE_KEYWORDS = {
    FABRIC: [
        "wrinkled linen", "soft cotton", "worn leather", "textured wool",
        "raw denim", "brushed suede", "organic silk", "chunky knit",
        "corduroy ridges", "canvas weave", "jersey drape", "tweed fibers",
    ],
    ENVIRONMENT: [
        "sun-drenched concrete", "dappled light", "lived-in cafe",
        "weathered brick", "peeling paint", "cracked pavement",
        "mossy stone", "polished marble", "rustic wood grain",
        "frosted glass", "wet asphalt reflections", "dusty shelves",
    ],
} as const;

export type SceneGenerationProductType = "plush" | "apparel" | "general";
export type SceneGenerationBoardType = "main" | "aplus" | "social" | "story" | "asset";

export interface SceneGenerationPromptInput {
    boardType: SceneGenerationBoardType;
    productType: SceneGenerationProductType;
    productName?: string;
    productCategory?: string;
    productSize?: string;
    sellingPoints?: string;
    sceneDirection?: string;
    targetAudience?: string;
    material?: string;
    colorStyle?: string;
    usageScenario?: string;
    brandTone?: string;
    avoidElements?: string;
    copyIntent?: string;
    extraNotes?: string;
    modelPersonaPreset?: string;
    modelEthnicity?: string;
    modelAgeGroup?: string;
    modelFamilyStructure?: string;
    modelLifestyle?: string;
    modelPersonaNotes?: string;
    /** AI-inferred physical interaction description */
    interactionHint?: string;
    /** AI-inferred size category for physics rules */
    sizeCategory?: 'tiny' | 'small' | 'medium' | 'large' | 'wearable';
    /** Style pack selection */
    stylePackId?: string;
    styleVariantId?: string;
    cameraDevice?: string;
    shotType?: string;
}

// ==================== Realism Physics Rules ====================

/**
 * Physical realism rules to ensure generated scenes have believable
 * proportions, gravity, contact surfaces, and natural human-product interaction.
 */
export const REALISM_PHYSICS_RULES: Record<string, string> = {
    tiny: [
        "The product is very small (under 10cm). It should be held between fingertips or resting in the palm of one hand.",
        "The product must NOT appear oversized relative to the person's hands.",
        "Show natural finger curl around the small object. The hand should dwarf the product.",
        "If placed on a surface, show it at realistic tiny scale next to everyday objects for size reference.",
    ].join(" "),
    small: [
        "The product is small (10-25cm). It can be held comfortably in one hand or cradled in both hands.",
        "Fingers should wrap naturally around the product with visible grip pressure.",
        "If it's a plush toy at this size, it fits in one arm or is held against the chest with one hand.",
        "The product should be clearly smaller than the person's forearm length.",
    ].join(" "),
    medium: [
        "The product is medium-sized (25-50cm). It requires both hands or one arm to hold comfortably.",
        "If it's a plush toy, it can be hugged against the chest or held in the crook of one arm.",
        "The product should be roughly the size of the person's torso width or smaller.",
        "Show natural weight distribution — the person's arms should show slight tension from holding it.",
        "If placed on furniture, the product should take up a realistic portion of the sofa/bed surface.",
    ].join(" "),
    large: [
        "The product is large (over 50cm). It requires both arms to hold or embrace.",
        "If it's a large plush, the person should be bear-hugging it with both arms, and the plush should cover a significant portion of their torso.",
        "Show realistic weight and volume — the product should slightly compress where the person grips it.",
        "If it's a blanket or large textile, show natural drape with gravity-consistent folds.",
        "The product should be at least half the person's torso height.",
    ].join(" "),
    wearable: [
        "The product is a wearable item (clothing, hat, scarf, etc). It MUST be worn on the body naturally.",
        "Show realistic fabric drape, wrinkle patterns at joints (elbows, waist, knees), and gravity-consistent hem behavior.",
        "The garment must follow the body's contours with physically accurate fit — no floating fabric.",
        "If sleeves exist, they must wrinkle naturally at the elbow and follow arm movement.",
        "The garment's weight should visually affect how it hangs — heavier fabrics drape more, lighter fabrics flutter.",
    ].join(" "),
};

/**
 * Natural action pools organized by product type and context.
 * These replace generic "show product in use" with specific, physically
 * believable interaction descriptions.
 */
export const NATURAL_ACTION_POOL: Record<SceneGenerationProductType, string[]> = {
    plush: [
        "gently hugging the plush toy against their chest with both arms, chin resting slightly on top",
        "sitting on the sofa with the plush toy nestled in their lap, one hand resting on it while scrolling phone",
        "lying on the bed propped up on pillows, with the plush toy tucked under one arm",
        "holding the plush toy up with both hands at face level, smiling at it",
        "walking through the room carrying the plush toy casually in one arm at their side",
        "sitting cross-legged on the floor with the plush toy between their knees, leaning forward with a warm smile",
        "reaching to pick up the plush toy from a shelf, hand just about to grasp it",
        "showing the plush toy to a child by holding it out at the child's eye level",
    ],
    apparel: [
        "walking naturally with arms in a relaxed swing, the garment moving with their stride",
        "adjusting the collar or cuff of the garment in a mirror, candid grooming moment",
        "standing with one hand in pocket, weight shifted to one leg, relaxed confident pose",
        "reaching for a coffee cup on a table, the garment stretching naturally at the shoulder",
        "sitting in a cafe chair with legs crossed, the fabric draping naturally over the thigh",
        "turning to look over their shoulder, the garment's back detail visible with natural body twist",
        "leaning against a doorframe with arms loosely crossed, the garment showing natural creases",
        "bending slightly to pet a dog, the garment following the body's curve naturally",
    ],
    general: [
        "naturally using the product in its intended context with relaxed body language",
        "holding the product at a natural angle while going about their daily routine",
        "placing the product on a surface and interacting with it in a casual, everyday manner",
        "using the product with one hand while the other hand gestures naturally or holds something else",
        "showing the product to someone (off-camera or a companion) with a genuine expression",
        "in the middle of unwrapping or unboxing the product with a delighted expression",
    ],
};

/**
 * Parse a product size string into centimeter values.
 * Handles formats like "40cm", "25x15cm", "M-L", "约35cm", "20inches" etc.
 * Returns the primary dimension in cm, or null if unparsable.
 */
function parseProductSizeCm(sizeStr: string): number | null {
    if (!sizeStr) return null;
    const s = sizeStr.toLowerCase().replace(/\s/g, '').replace(/约|大约|roughly|approx/gi, '');
    
    // Match cm values: "40cm", "25x15cm", "30-40cm"
    const cmMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*cm/i)
        || s.match(/(\d+(?:\.\d+)?)\s*cm/i);
    if (cmMatch) {
        const vals = cmMatch.slice(1).map(Number).filter(Boolean);
        return Math.max(...vals); // Use largest dimension
    }
    
    // Match inch values: "16inches", "20in", '15"'
    const inchMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")/i);
    if (inchMatch) return Number(inchMatch[1]) * 2.54;
    
    // Match bare numbers (assume cm)
    const bareMatch = s.match(/^(\d+(?:\.\d+)?)$/);
    if (bareMatch) return Number(bareMatch[1]);
    
    return null;
}

/**
 * Generate body-relative proportion descriptions based on exact product dimensions.
 * Uses average adult body measurements as reference anchors.
 * 
 * Average adult reference points:
 * - Total height: ~170cm
 * - Head height: ~23cm
 * - Palm width: ~8.5cm
 * - Palm length: ~19cm  
 * - Forearm length: ~25cm
 * - Shoulder width: ~45cm
 * - Torso height (shoulder to hip): ~55cm
 * - Arm span (one arm): ~70cm
 */
function buildDimensionScalingPrompt(productSizeCm: number, productType: SceneGenerationProductType): string {
    const rules: string[] = [];
    
    // Human body reference constants (cm)
    const HEAD = 23;
    const PALM_WIDTH = 8.5;
    const PALM_LENGTH = 19;
    const FOREARM = 25;
    const SHOULDER_WIDTH = 45;
    const TORSO = 55;
    const FULL_HEIGHT = 170;
    
    const ratio = (v: number) => Math.round(v);
    const pct = (v: number) => Math.round((productSizeCm / v) * 100);
    
    rules.push(
        `CRITICAL DIMENSION LOCK: The product is exactly ${ratio(productSizeCm)}cm in its largest dimension.`
    );
    
    if (productSizeCm <= 10) {
        // Tiny: keychain, small figurine
        rules.push(
            `This is a TINY product (${ratio(productSizeCm)}cm ≈ ${pct(PALM_WIDTH)}% of palm width).`,
            `It fits entirely inside one palm. When held, it should be dwarfed by the person's hand.`,
            `If placed on a table, it should be roughly the size of a coffee cup base.`,
            `NEVER make this product appear larger than the person's fist.`,
        );
    } else if (productSizeCm <= 25) {
        // Small: small plush, mug, water bottle
        rules.push(
            `This product (${ratio(productSizeCm)}cm) is ${pct(FOREARM)}% of an adult forearm length.`,
            `It can be held in one hand. It is ${pct(HEAD)}% of a human head height.`,
            `When held against the body, it should NOT extend past the shoulder width.`,
            `A single adult hand should be able to grip around it comfortably.`,
        );
    } else if (productSizeCm <= 40) {
        // Medium: medium plush, pillow
        rules.push(
            `This product (${ratio(productSizeCm)}cm) is about ${pct(TORSO)}% of an adult torso height.`,
            `When held, it spans roughly from chest to belly button area.`,
            `It requires one arm to cradle or two hands to hold in front.`,
            `It is about ${pct(SHOULDER_WIDTH)}% of shoulder width — ${productSizeCm < 35 ? 'narrower than' : 'close to'} shoulder span.`,
        );
    } else if (productSizeCm <= 60) {
        // Medium-large: large plush, throw blanket folded
        rules.push(
            `This product (${ratio(productSizeCm)}cm) is about ${pct(TORSO)}% of an adult torso height — a substantial item.`,
            `When hugged, it should cover most of the person's chest area.`,
            `It is ${pct(SHOULDER_WIDTH)}% of shoulder width — wider than or equal to the shoulder span.`,
            `The person must use both arms to hold it securely. Show arm muscle engagement.`,
        );
    } else {
        // Large: very large plush, blanket, body pillow
        rules.push(
            `This product (${ratio(productSizeCm)}cm) is ${pct(FULL_HEIGHT)}% of full adult height — a VERY LARGE item.`,
            `When held upright, it reaches from the person's hip to at least their chest or higher.`,
            `When hugged, the product should obscure a large portion of the person's body.`,
            `Show the person physically embracing or supporting the weight of this large product.`,
            `If placed on furniture, it should take up a very significant portion of a sofa or bed.`,
        );
    }
    
    // Product-type specific dimension adjustments
    if (productType === 'plush') {
        rules.push(
            `For this plush at ${ratio(productSizeCm)}cm: show the stuffing volume realistically — ` +
            `${productSizeCm < 20 ? 'a compact, palm-sized soft toy' : productSizeCm < 40 ? 'a huggable toy that fills the crook of an arm' : 'a large plush that requires full arm embrace'}. ` +
            `The plush should compress slightly where squeezed and maintain its round, soft volume elsewhere.`
        );
    } else if (productType === 'apparel') {
        rules.push(
            `For this garment: the size measurement indicates the ${productSizeCm > 70 ? 'full length garment — it should reach from shoulders to at least mid-thigh or below' : productSizeCm > 50 ? 'torso-covering garment — it should end at or below the hip' : 'shorter garment — upper body or accessory piece'}. ` +
            `Ensure the garment length matches this proportion on the wearer's body.`
        );
    }
    
    // Universal dimension anchor
    rules.push(
        `ABSOLUTE SIZE RULE: Use everyday objects in the scene as hidden scale anchors — ` +
        `a standard coffee mug is ~10cm tall, a sofa cushion is ~45cm wide, a doorknob is ~100cm from the floor, ` +
        `a standard dining chair seat is ~45cm high. The product must be proportionally consistent with ALL objects in the scene.`
    );
    
    return rules.join(' ');
}

/**
 * Build a realistic interaction prompt based on AI-inferred size category,
 * exact product dimensions, and interaction hint. This ensures physically
 * believable human-product relationships in the generated image.
 */
export function buildRealisticInteractionPrompt(input: SceneGenerationPromptInput): string {
    const parts: string[] = [];

    // 1. Exact dimension-based scaling (highest priority)
    const parsedCm = parseProductSizeCm(input.productSize || '');
    if (parsedCm) {
        parts.push(buildDimensionScalingPrompt(parsedCm, input.productType));
    } else {
        // Fallback to category-based rules
        const sizeCategory = input.sizeCategory || 'medium';
        parts.push(REALISM_PHYSICS_RULES[sizeCategory]);
    }

    const isNoModel = input.modelPersonaPreset === '无模特（纯产品）';
    if (isNoModel) {
        parts.push("The product must sit naturally on a surface or environment, respecting gravity and contact shadows. NO HANDS, NO PEOPLE, AND NO BODY PARTS.");
    } else {
        if (input.interactionHint) {
            parts.push(`Specific interaction: ${input.interactionHint}.`);
        }
        const actionPool = NATURAL_ACTION_POOL[input.productType] || NATURAL_ACTION_POOL.general;
        const randomAction = actionPool[Math.floor(Math.random() * actionPool.length)];
        parts.push(`Suggested natural action: ${randomAction}.`);
        parts.push(
            "CRITICAL REALISM RULES: " +
            "All objects must obey gravity — nothing floats without support. " +
            "Hands holding items must show anatomically correct finger placement with natural grip pressure. " +
            "Contact surfaces must show realistic compression (cushions indent where sat upon, fabric creases where gripped). " +
            "The product's scale relative to the human body must be physically accurate and consistent throughout the image. " +
            "Perspective and foreshortening must be consistent — no size inconsistencies between foreground and background. " +
            "Shadows must be cast in a consistent direction and match the lighting source."
        );
    }

    return parts.join(" ");
}

// ==================== Scene Variation Randomizer ====================

/**
 * Diverse environment detail pools to inject randomness into scene generation.
 * When a user specifies a general scene (e.g., "living room"), the system picks
 * random furniture, decoration, lighting, and color palette variations so each
 * batch image looks distinct instead of near-identical.
 */
const SCENE_VARIATION_POOL: Record<string, string[]> = {
    livingroom: [
        "modern clean living room with a colorful play mat, toy storage bins in pastel colors, a small child-sized armchair, and bright natural light — lively American family room",
        "mid-century modern sofa with tapered legs, abstract gallery wall, terrazzo coffee table, warm Edison bulb floor lamp — classic American mid-century home feel",
        "deep charcoal sectional sofa, floating wood media console, area rug with bold geometric pattern — suburban American man-cave vibe",
        "cream boucle sofa with navy accent pillows, shiplap accent wall, lantern-style pendant lights, woven seagrass basket — American coastal farmhouse",
        "large sectional in warm camel leather, distressed wood coffee table, cowhide area rug, industrial metal shelving — American ranch home den",
        "modern gray sleeper sofa, floating walnut shelves, oversized USA city skyline canvas print, media console — urban American apartment",
        "comfortable navy blue slipcovered sofa, white wainscoting wall, Pottery Barn-style wood side table, family photo wall — classic suburban living room",
        "wide L-shaped sofa in oatmeal fabric, thick shag carpet, oversized TV mounted above fireplace — American family great room",
    ],
    bedroom: [
        "bright children's bedroom with a colorful rug, low wooden bookshelf filled with picture books, a small activity table, and playful wall stickers — cheerful American kids room",
        "king bed with upholstered headboard in warm greige, bedside tables with charging stations, bedside books, white plantation shutters — American suburban master bedroom",
        "queen bed with navy duvet and white piping, shiplap wall, antique wood dresser, framed vintage map art — American coastal cottage bedroom",
        "California King platform bed, side-by-side nightstands with reading lamps, neutral area rug — modern American bedroom",
        "farmhouse wooden bed frame in distressed white, vintage alarm clock, braided oval rug — American country farmhouse bedroom",
        "modern walnut bed with floating nightstands, abstract canvas print, blackout linen curtains, succulent on dresser — urban American apartment bedroom",
        "upholstered bed in dusty blush, mirrored dresser, string fairy lights, framed inspirational quote — American teenage girl bedroom",
        "college dorm-style lofted bed over study desk, sports team poster, mini fridge — American dorm room",
    ],
    kids_room: [
        "cheerful nursery with a white crib, a soft pastel rocking chair, a woven basket full of toys, and a large sun-drenched window — premium American nursery",
        "vibrant play room with a low activity table, colorful storage cubes, a chalkboard wall, and a soft foam floor mat — lively American play space",
        "modern kids bedroom with a twin bed, whimsical animal-themed wall art, a small teepee tent in the corner, and a bright star-patterned rug — playful American child's room",
        "clean airy bedroom with a low wooden bed, a colorful rainbow wall decal, a small desk with crayons, and a shelf displaying plush toys — bright and lively kids space",
    ],
    kitchen: [
        "white subway tile backsplash, stainless KitchenAid mixer on counter, open wood shelving with American-made ceramic mugs, pendant lights over island — suburban American kitchen",
        "dark granite countertop, stainless steel refrigerator with ice maker, herb garden in mason jars on windowsill, coffee station — American home kitchen",
        "butcher block island, farmhouse apron-front sink, Magnolia-style shiplap panels, cast-iron pan on stove — Southern American farmhouse kitchen",
        "white shaker cabinetry, marble island with barstools, ring doorbell hub on wall, kids' drawings on fridge — American family kitchen",
        "retro mint-green Smeg refrigerator, checkerboard floor, diner-style chrome stools, Americana diner signage — retro American kitchen",
        "open-plan kitchen with breakfast bar, bowl of fresh fruit, coffee maker brewing, American-style large refrigerator with side-by-side doors — everyday real American home kitchen",
    ],
    outdoor: [
        "sunny American backyard patio with string-light pergola, Adirondack chairs, gas grill, plastic cups on table — classic American BBQ setup",
        "wide front porch with white rocking chairs, hanging fern baskets, welcome mat, American suburban house facade",
        "urban rooftop deck in a US city, string lights, potted herbs, skyline view, patio furniture — American rooftop living",
        "large suburban lawn with kids' swing set, garden hose reel, white picket fence, American flag on porch",
        "lakeside picnic in a US national park, cooler, Yeti cups, pine trees in background",
        "family camping campsite with REI tent, campfire, s'mores setup, camp chairs, Forest Park USA setting",
        "urban street crosswalk with motion-blurred yellow taxi, skyscraper background, modern glass architecture, street-style fashion influencer vibe",
        "minimalist concrete courtyard with a single architectural bench, harsh direct sunlight, high-contrast shadows, premium high-end fashion editorial feel",
        "tropical beach at magic hour, palm trees swaying, turquoise water, fine white sand, vacation influencer aesthetic with lens flare",
        "underground industrial parking garage, raw concrete pillars, dramatic overhead lighting, streetwear and Y2K photography vibe",
        "cluttered urban alleyway with colorful street art, industrial pipes, wet asphalt reflections, edgy streetwear lifestyle",
    ],
    office: [
        "American home office with standing desk, ergonomic chair, dual monitors, motivational poster, small American flag on desk",
        "cozy home office reading nook, built-in bookshelves with classic American novels, warm Anthropologie-style desk lamp",
        "WeWork-style co-working space, communal table, exposed brick, cold brew on tap, American city view from window",
        "corporate American office corner, floor-to-ceiling glass, minimalist desk, badge lanyard, company branded coffee mug",
    ],
    generic: [
        "bright airy American home interior, large picture windows, natural north light, Restoration Hardware-inspired decor",
        "warm cozy American living space with layered textures, soft amber overhead lighting, family photos",
        "clean contemporary American interior with open-concept layout, neutral warm palette, Wayfair-style furniture",
        "eclectic American lived-in space, gallery wall with family prints, mixed vintage and Target-modern furniture",
        "sun-drenched casual American morning scene, indoor plants, white walls, rustic wood accents, real home feel",
    ],
};

// ==================== UI Translation Maps ====================

const ETHNICITY_MAP: Record<string, string> = {
    '自动匹配': 'ethnically believable American',
    '白人美国人': 'white American',
    '黑人美国人': 'African American',
    '拉丁裔美国人': 'Hispanic American',
    '亚裔美国人': 'Asian American',
    '中东裔美国人': 'Middle Eastern American',
    '南亚裔美国人': 'South Asian American',
    '太平洋岛民': 'Pacific Islander American',
    '混合族裔美国人': 'multi-ethnic American',
    '无（纯产品图）': '',
};

const AGE_GROUP_MAP: Record<string, string> = {
    '自动匹配': 'age-appropriate',
    '0-3岁': 'toddler (0-3 years old)',
    '3-6岁': 'young child (3-6 years old)',
    '5-12岁': 'child (5-12 years old)',
    '13-18岁': 'teenager (13-18 years old)',
    '18-25岁': 'young adult (18-25 years old)',
    '20-30岁': 'young adult (20-30 years old)',
    '25-35岁': 'adult (25-35 years old)',
    '30-45岁': 'adult (30-45 years old)',
    '40-55岁': 'middle-aged adult (40-55 years old)',
    '55-70岁': 'senior (55-70 years old)',
    '60岁以上': 'elderly (60+ years old)',
    '多年龄段': 'multi-generational group',
};

const FAMILY_STRUCTURE_MAP: Record<string, string> = {
    '自动匹配': 'realistic household composition',
    '单人': 'single person',
    '情侣': 'young couple',
    '亲子': 'parent and child',
    '三口之家': 'family of three',
    '多孩家庭': 'family with multiple children',
    '好友组合': 'group of friends',
    '多人社交': 'social gathering of people',
    '祖孙三代': 'three-generation family',
    '老年伴侣': 'elderly couple',
    '人与宠物': 'person with their pet',
    '无（纯产品图）': '',
};

const LIFESTYLE_MAP: Record<string, string> = {
    '自动匹配': 'real everyday American lifestyle',
    '都市通勤': 'urban commuter',
    '职场商务': 'business professional',
    '郊区家庭': 'suburban family',
    '校园': 'college campus',
    '健身运动': 'fitness and active',
    '居家休闲': 'home casual',
    '户外露营': 'outdoor camping',
    '旅行度假': 'travel and vacation',
    '宠物生活': 'pet owner lifestyle',
    '文艺生活': 'creative indie lifestyle',
    '新居生活': 'new home lifestyle',
    '退休生活': 'peaceful retirement',
    '社交聚会': 'social gathering',
    '节日聚会': 'holiday family gathering',
    '节日送礼': 'holiday gifting moment',
    '派对庆祝': 'party celebration',
    '下午茶/咖啡': 'cafe lifestyle',
    '网红穿搭': 'fashion influencer aesthetic',
    '车内场景': 'automotive interior lifestyle',
    '无（纯产品图）': '',
};

const PERSONA_PRESET_MAP: Record<string, string> = {
    '美国都市女性': 'contemporary American urban woman',
    '美国职场女性': 'professional American career woman',
    '美国瑜伽/健身女性': 'active American fitness woman',
    '美国居家主妇': 'American suburban housewife',
    '美国文艺女青年': 'indie American creative woman',
    '美国都市男性': 'modern American urban man',
    '美国居家休闲男性': 'relaxed American man at home',
    '美国运动型男性': 'athletic American man',
    '美国职场商务男性': 'American business professional man',
    '美国户外冒险男性': 'American outdoor adventurer man',
    '美国年轻情侣': 'young American couple',
    '美国新婚夫妇': 'American newlywed couple',
    '美国闺蜜/好友': 'American best friends',
    '美国跨族裔情侣': 'multi-ethnic American couple',
    '美国郊区家庭': 'American suburban family',
    '美国年轻妈妈与儿童': 'young American mother with child',
    '美国年轻爸爸与儿童': 'young American father with child',
    '美国多孩家庭': 'American family with multiple children',
    '美国三代同堂': 'multi-generational American family',
    '美国校园学生': 'American college student',
    '美国青少年': 'American teenager',
    '美国小孩': 'American child',
    '美国婴幼儿与妈妈': 'American infant with mother',
    '美国中年专业人士': 'middle-aged American professional',
    '美国银发族': 'American senior couple',
    '美国宠物主人': 'American pet owner',
    '美国户外露营家庭': 'American family camping',
    '美国派对/聚会人群': 'group of diverse Americans at a party',
    '无模特（纯产品）': 'no people, product only',
};

/**
 * Pick a random environment variation to inject diversity.
 * Analyzes sceneDirection for known room types and picks a random detail set.
 */
function getRandomSceneVariation(sceneDirection: string, productType?: SceneGenerationProductType): string {
    const lower = (sceneDirection || '').toLowerCase();
    let pool: string[] = SCENE_VARIATION_POOL.generic;

    if (productType === 'plush') {
        if (/卧室|卧房|儿童房|bedroom|kids|nursery|child/.test(lower)) pool = SCENE_VARIATION_POOL.kids_room;
        else if (/客厅|living.*room|play.*room/.test(lower)) pool = [SCENE_VARIATION_POOL.livingroom[0], ...SCENE_VARIATION_POOL.kids_room];
        else pool = SCENE_VARIATION_POOL.kids_room;
    } else {
        if (/客厅|living.*room|client.*room/.test(lower)) pool = SCENE_VARIATION_POOL.livingroom;
        else if (/卧室|卧房|bedroom/.test(lower)) pool = SCENE_VARIATION_POOL.bedroom;
        else if (/厨房|kitchen/.test(lower)) pool = SCENE_VARIATION_POOL.kitchen;
        else if (/户外|露营|庞物|庭院|花园|outdoor|backyard|patio|garden|camping/.test(lower)) pool = SCENE_VARIATION_POOL.outdoor;
        else if (/办公|书房|office|study/.test(lower)) pool = SCENE_VARIATION_POOL.office;
    }

    // Pick random index
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
}

const SCENE_LENS_MAP: Record<SceneGenerationBoardType, string> = {
    main: "shot on 85mm portrait lens, premium 1:1 square composition, focused product-lifestyle hero shot, high-end editorial clarity",
    aplus: "shot on 35mm lens, premium editorial banner composition, layered storytelling scene, cinematic commercial framing",
    social: "shot on 85mm portrait lens, candid handheld lifestyle framing, authentic buyer-show perspective",
    story: "shot on 24mm anamorphic lens, ultra-wide cinematic 21:9 composition, far-left subject placement, negative space on right, deep depth of field, epic spatial storytelling",
    asset: "shot on 85mm portrait lens, premium 2:3 vertical composition, focused product-lifestyle hero shot, high-end editorial clarity",
};

const SCENE_BOARD_GUIDE: Record<SceneGenerationBoardType, string> = {
    main: "real American lifestyle buyer-show content, clean and focused brand asset, natural social-media realism, but very clean, minimalist, and uncluttered environment",
    aplus: "real American lifestyle buyer-show content, candid human interaction, natural social-media realism, but very clean, minimalist, and uncluttered environment",
    social: "real American lifestyle buyer-show content, candid human interaction, natural social-media realism, believable daily life moment",
    story: "premium cinematic A+ brand story visual, clean high-end spatial storytelling, refined atmospheric depth, high commercial conversion aesthetic",
    asset: "real American lifestyle buyer-show content, clean and focused brand asset, natural social-media realism, but very clean, minimalist, and uncluttered environment",
};

const PRODUCT_TYPE_GUIDE: Record<SceneGenerationProductType, string> = {
    plush: "preserve exact identities of all reference plush toys, including their exact silhouettes, stitching placement, facial embroidery, plush pile direction, soft cotton-filled volume, tactile fuzzy texture, and huggable realism",
    apparel: "preserve exact identities of all reference apparel items, including their exact garment structures, collars, cuffs, hems, seam lines, fit silhouettes, fabric drape, wrinkle logic, and true-to-reference material behavior",
    general: "preserve exact identities of all reference products, including their exact colors, structures, proportions, material finish, key details, and overall commercial accuracy",
};

const PRODUCT_TYPE_SCENE_DETAIL: Record<SceneGenerationProductType, string> = {
    plush: "Show the plush toy(s) in natural interaction with people or environment, maintaining soft lighting that highlights the fuzzy texture and huggable appeal",
    apparel: "Show the apparel item(s) worn naturally on the body with realistic fit and drape, capturing fabric movement and texture in everyday use",
    general: "Show the product(s) in realistic use context with clear visibility of key features and details",
};

const PRODUCT_LOCK_RULES: Record<SceneGenerationProductType, string> = {
    plush: "STRICT PRODUCT LOCK: Treat the reference images as the only source of truth for the plush toy identities. ZERO TOLERANCE for AI re-interpretation. Do not recolor, restyle, reshape, simplify, or substitute the fur, embroidery, facial features, seams, stuffing volume, pile length, sheen, or silhouette. Preserve the exact hue family, saturation balance, plush density, stitched details, and surface finish for EACH product. The generated product must be a pixel-perfect conceptual match to the original.",
    apparel: "STRICT PRODUCT LOCK: Treat the provided reference images as the ABSOLUTE ONLY source of truth. You MUST ensure the clothing's physical structure, tailoring, and material texture are EXACTLY 100% IDENTICAL to the provided product image. ZERO TOLERANCE for AI hallucination or re-interpretation. Do not alter the fabric type, garment structure, seams, collars, cuffs, print placement, trims, fit, drape, or silhouette. Preserve the exact fabric texture (e.g., ribbed, satin, denim, knit) and structural construction. The generated garment must be a pixel-perfect conceptual match to the original.",
    general: "STRICT PRODUCT LOCK: Treat the reference images as the only source of truth for the product identities. ZERO TOLERANCE for AI re-interpretation. Do not recolor, repaint, redesign, simplify, or substitute the material, hardware, trim, edge construction, surface finish, or silhouette. Preserve the exact hue family, saturation balance, texture depth, structural proportions, and visible product details for EACH product. The generated product must be a pixel-perfect conceptual match to the original.",
};

function buildProductLockPrompt(productType: SceneGenerationProductType) {
    return PRODUCT_LOCK_RULES[productType];
}

function buildMaterialLockPrompt(input: SceneGenerationPromptInput) {
    if (input.material) {
        return `Material fidelity is mandatory: ${input.material}. Preserve the exact surface finish, tactile feel, texture depth, seam definition, embroidery or print sharpness, and physically believable folds or compression from the reference product.`;
    }

    return "Material fidelity is mandatory. Preserve the exact surface finish, tactile feel, texture depth, seam definition, embroidery or print sharpness, and physically believable folds or compression from the reference product.";
}

function buildAmericanPersonaPrompt(input: SceneGenerationPromptInput) {
    if (input.modelPersonaPreset === '无模特（纯产品）') {
        return "ABSOLUTELY NO PEOPLE. NO MODELS. NO HANDS. NO BODY PARTS. ONLY THE PRODUCT IN THE SCENE.";
    }

    const personaParts = [
        input.modelPersonaPreset ? (PERSONA_PRESET_MAP[input.modelPersonaPreset] || input.modelPersonaPreset) : "",
        input.modelEthnicity ? (ETHNICITY_MAP[input.modelEthnicity] || input.modelEthnicity) : "ethnically believable American",
        input.modelAgeGroup ? (AGE_GROUP_MAP[input.modelAgeGroup] || input.modelAgeGroup) : "age-appropriate",
        input.modelFamilyStructure ? (FAMILY_STRUCTURE_MAP[input.modelFamilyStructure] || input.modelFamilyStructure) : "realistic household composition",
        input.modelLifestyle ? (LIFESTYLE_MAP[input.modelLifestyle] || input.modelLifestyle) : "real everyday American lifestyle",
    ].filter(Boolean);

    const lifestyleSceneMap: Record<string, string> = {
        "都市通勤": "urban U.S. apartment, city sidewalk, coffee-to-go, elevator lobby, commuter realism",
        "职场商务": "modern U.S. office, conference room, professional workspace, business attire, polished corporate setting",
        "郊区家庭": "suburban American home, family living room, nursery, backyard, natural family routine",
        "校园": "real U.S. campus walkway, library, dorm, green lawn, student daily life",
        "健身运动": "American gym, wellness studio, yoga mat, active lifestyle environment, natural athletic movement",
        "居家休闲": "cozy U.S. apartment or suburban home, sofa, bedroom, weekend home routine",
        "户外露营": "campsite with tent, forest trail, national park, outdoor adventure gear, campfire atmosphere",
        "旅行度假": "American road trip, hotel room, resort pool, scenic overlook, vacation vibes",
        "宠物生活": "at home with a pet dog or cat, pet bed, pet toys, loving pet-owner interaction",
        "文艺生活": "indie coffee shop, art gallery, vinyl record store, creative studio, bohemian atmosphere",
        "新居生活": "newly furnished American apartment, unpacking boxes, fresh home setup, cozy first-home feeling",
        "退休生活": "peaceful suburban home, garden, morning newspaper, relaxed golden-age lifestyle",
        "社交聚会": "casual American get-together, backyard BBQ, friends gathering, relaxed social atmosphere",
        "节日聚会": "family holiday dinner table, Thanksgiving or Christmas atmosphere, warm family gathering",
        "节日送礼": "American holiday gifting moment, living room, wrapped gift setting, warm family atmosphere",
        "派对庆祝": "birthday party, celebration decorations, balloons, cake, excited group energy",
        "下午茶/咖啡": "cozy American cafe, latte art, pastry, window seat, warm afternoon light",
        "网红穿搭": "urban street photography, modern brutalist architecture, glass building reflections, rooftop with city skyline, or high-end minimalist outdoor plaza",
        "车内场景": "inside a car, road trip vibes, drive-through, parking lot, casual automotive setting",
    };

    const sceneCue = input.modelLifestyle && lifestyleSceneMap[input.modelLifestyle]
        ? lifestyleSceneMap[input.modelLifestyle]
        : "realistically American setting (indoor or outdoor neighborhood context)";

    return [
        `Use ${personaParts.join(", ")} people only if humans appear in the image.`,
        `Human styling, family composition, behavior, body language, interiors, and props must be credible for the United States market.`,
        `Anchor the human context in ${sceneCue}.`,
        input.modelPersonaNotes ? `Additional persona notes: ${input.modelPersonaNotes}.` : "",
    ].filter(Boolean).join(" ");
}

export function buildSceneGenerationPrompt(input: SceneGenerationPromptInput): string {
    const subject = [input.productName, input.productCategory, input.productSize].filter(Boolean).join(", ") || "commercial product";

    // --- Style Pack Logic ---
    let stylePackData: any = null;
    let styleVariant: any = null;

    if (input.stylePackId && input.styleVariantId) {
        stylePackData = STYLE_PACKS.find((p: any) => p.stylePackName.includes(input.stylePackId!));
        if (stylePackData) {
            styleVariant = stylePackData.styleVariants.find((v: any) => v.id === input.styleVariantId);
        }
    }

    if (styleVariant) {
        let template = styleVariant.promptTemplate;
        // Replace placeholders
        template = template.replace(/\[SUBJECT\/PLUSH TOY\]/g, subject);
        template = template.replace(/\[SUBJECT\/PLUSH TOYS\]/g, `${subject} s`);
        template = template.replace(/\[BASE_STYLE\]/g, stylePackData.promptBlocks.BASE_STYLE || '');
        template = template.replace(/\[COPY_SPACE\]/g, stylePackData.promptBlocks.COPY_SPACE || '');
        template = template.replace(/\[BADGE_PLACEHOLDER\]/g, stylePackData.promptBlocks.BADGE_PLACEHOLDER || '');

        const globalRules = [
            `GLOBAL STYLE RULES: ${stylePackData.globalRules.mustHave.join(". ")}.`,
            `Text Policy: ${stylePackData.globalRules.textPolicy}`,
            `Badge Policy: ${stylePackData.globalRules.badgePolicy}`
        ].join(" ");

        return [
            template,
            globalRules,
            `Ensure product identity: ${subject}`,
            buildProductLockPrompt(input.productType),
            buildMaterialLockPrompt(input),
            "High resolution, professional photography, realistic texture."
        ].join(" ");
    }
    // --- End Style Pack Logic ---

    // Add randomized scene variation for diversity (skip if we have a detailed custom scene direction)
    const hasDetailedDirection = (input.sceneDirection?.length || 0) > 40;
    const sceneVariation = hasDetailedDirection 
        ? "" 
        : getRandomSceneVariation(input.sceneDirection || input.usageScenario || '', input.productType);
        
    const environment = [
        input.sceneDirection,
        input.usageScenario,
        input.targetAudience,
        sceneVariation ? `Use this specific furniture/decor variation for uniqueness: ${sceneVariation}` : "",
    ].filter(Boolean).join(", ") || "real American lifestyle setting";

    const style = [input.brandTone, input.colorStyle, SCENE_BOARD_GUIDE[input.boardType]].filter(Boolean).join(", ");
    const personaPrompt = buildAmericanPersonaPrompt(input);

    // Product title context — used to anchor all image content to the listing
    const productTitleContext = [input.productName, input.productCategory, input.sellingPoints].filter(Boolean).join(' — ');

    let customLighting = ["main", "social", "aplus", "asset"].includes(input.boardType)
        ? "natural ambient lighting, believable shadows, candid lifestyle realism, subtle filmic depth, slightly imperfect lighting like a real phone photo (can be natural window light or outdoor sunlight as appropriate)"
        : "clean commercial lighting, realistic materials, sharp product focus, polished ecommerce look";
    let customComposition = SCENE_LENS_MAP[input.boardType];
    let customQuality = ["main", "social", "aplus", "asset"].includes(input.boardType) ? "FILM" : "EDITORIAL";

    if (input.productType === 'plush') {
        const isCommercialStyle = /商业|棚拍|精心布置|布景|影棚|摄影棚|高级|ins|马卡龙|糖果/.test(input.sceneDirection || '') || /商业|棚拍|精心布置|布景|影棚|摄影棚|高级|ins|马卡龙|糖果/.test(input.extraNotes || '') || /马卡龙|糖果|商业/.test(input.colorStyle || '');
        if (isCommercialStyle) {
            customLighting = "commercial studio lighting, bright and clean, carefully arranged set design, premium photography style, balanced light";
        } else {
            customLighting = "soft diffused natural light from the window, low contrast soft tone, light ratio 1:2, color temperature 5400K, low saturation warm natural color palette, warm healing daily feeling";
        }
        if (input.boardType === 'aplus') {
            customComposition = "45-degree high-angle full shot, clear presentation of the product and scene, 35mm lens, premium editorial banner composition";
        } else if (input.boardType === 'main') {
            customComposition = "eye-level interactive shot or close-up detail shot, shallow depth of field, blurred background, 50mm standard lens";
        }
        customQuality = "hyper-detailed fluffy plush texture, natural and transparent baby skin (if people present), 8K, high resolution, film-like texture";
    }


    // --- Device & Shot Type Modifiers ---
    if (input.cameraDevice && input.cameraDevice !== 'auto') {
        const cameraMap: Record<string, string> = {
            'iphone': 'iPhone raw photo, unedited smartphone snap, authentic candid look, shot on iPhone 15 Pro, mobile photography',
            'fuji': 'Fujifilm color profile, 35mm film photography, vintage grain, rich colors, nostalgic film aesthetics, classic Chrome recipe',
            'canon': 'Canon EOS 5D Mark IV, beautiful skin tones, soft background bokeh, professional photography, 85mm f/1.2 L lens',
            'sony': 'Sony A7R IV, razor sharp details, high dynamic range, hyper-realistic, GM lens clarity, commercial grade',
            'polaroid': 'Polaroid instant camera, retro instant film look, washed out colors, heavy flash, vintage polaroid aesthetics, polaroid border'
        };
        const devPrompt = cameraMap[input.cameraDevice];
        if (devPrompt) {
            customQuality = devPrompt + ', ' + customQuality;
        }
    }

    if (input.shotType && input.shotType !== 'auto') {
        const shotMap: Record<string, string> = {
            'wide': 'wide angle shot, establishing shot, showing full environment and context, 24mm wide angle',
            'medium': 'medium shot, upper body visible, showing both subject and background context, 50mm normal lens',
            'close': 'close-up shot, tight framing, intimate feeling, focusing on the product and subject expression, 85mm portrait lens',
            'macro': 'macro detail shot, extreme close-up focusing on textures, material details, and stitches, 100mm macro lens'
        };
        const shotPrompt = shotMap[input.shotType];
        if (shotPrompt) {
            customComposition = shotPrompt + ', ' + customComposition;
        }
    }

    const basePrompt = buildGoldenFormula({
        subject,
        action: input.copyIntent || "show the product naturally in use while preserving exact identity",
        environment,
        style,
        lighting: customLighting,
        composition: customComposition,
        qualityBooster: customQuality,
    });

    const boardInstructions: Record<SceneGenerationBoardType, string> = {
        main: [
            `This is an Amazon secondary listing image (1:1 square) for the product: "${productTitleContext}".`,
            "CRITICAL: This must look like a REAL photo taken by an actual buyer with their phone, providing authentic social-media lifestyle realism.",
            "Characteristics of authentic buyer photos: natural phone-camera perspective (slightly tilted or off-center), real home or outdoor environment, natural ambient lighting, casual and spontaneous feel.",
            "The person should look like a real customer genuinely using and enjoying the product in their everyday life, not a model posing.",
            input.productType === 'apparel' ? 
            "Incorporate one of these authentic social media visual logics specifically for apparel: 1) Minimalist Chic: clean color blocks, minimalist backgrounds. 2) American Retro/Y2K: industrial backgrounds. 3) Effortless Loungewear: cozy clean home or cafe settings. 4) Vacation Baddie: sun-drenched settings." : "",
            input.productType === 'plush' 
            ? "SCENE REQUIREMENT: For toys/plush, create a lively and child-friendly environment. The background should be organized and premium, but feel energetic and cheerful. Avoid excessive clutter, but ensure the scene has 'rendering power' with playful decorations (e.g., toy storage, colorful rugs, bright walls)."
            : "CRITICAL REQUIREMENT: Keep the scene clean, minimalist, and uncluttered. DO NOT include too many elements. The background and scene must NOT be flashy, busy, or complex. HOWEVER, you MUST vary the minimalist aesthetics (e.g., modern clean, warm neutral tones, sleek industrial minimal, soft coastal clean, mid-century minimal). Vary the minimal furniture, wall textures, and color palettes so each image looks distinctly different while remaining clean.",
            "The mood and scene must directly relate to the product's actual use case as described in the title and selling points.",
            "ANTI-AI DIRECTIVE: Ensure extreme realism. The image must look exactly like an unedited raw iPhone photo. Absolutely NO 'plastic' skin, NO symmetrical poses, and NO studio lighting. Introduce slight film grain to break the 'AI look'."
        ].filter(Boolean).join(' '),
        aplus: [
            `This is an Amazon A+ detail page banner for the product: "${productTitleContext}".`,
            "CRITICAL: This must look like a REAL photo taken by an actual buyer with their phone, providing authentic social-media lifestyle realism.",
            "Characteristics of authentic buyer photos: natural phone-camera perspective (slightly tilted or off-center), real home or outdoor environment, natural ambient lighting, casual and spontaneous feel.",
            "The person should look like a real customer genuinely using and enjoying the product in their everyday life, not a model posing.",
            input.productType === 'apparel' ? 
            "Incorporate one of these authentic social media visual logics specifically for apparel: 1) Minimalist Chic: clean color blocks, minimalist backgrounds. 2) American Retro/Y2K: industrial backgrounds. 3) Effortless Loungewear: cozy clean home or cafe settings. 4) Vacation Baddie: sun-drenched settings." : "",
            input.productType === 'plush' 
            ? "SCENE REQUIREMENT: For toys/plush, create a lively and child-friendly environment. The background should be organized and premium, but feel energetic and cheerful. Avoid excessive clutter, but ensure the scene has 'rendering power' with playful decorations (e.g., toy storage, colorful rugs, bright walls)."
            : "CRITICAL REQUIREMENT: Keep the scene clean, minimalist, and uncluttered. DO NOT include too many elements. The background and scene must NOT be flashy, busy, or complex. HOWEVER, you MUST vary the minimalist aesthetics (e.g., modern clean, warm neutral tones, sleek industrial minimal, soft coastal clean, mid-century minimal). Vary the minimal furniture, wall textures, and color palettes so each image looks distinctly different while remaining clean.",
            "The mood and scene must directly relate to the product's actual use case as described in the title and selling points.",
            "ANTI-AI DIRECTIVE: Ensure extreme realism. The image must look exactly like an unedited raw iPhone photo. Absolutely NO 'plastic' skin, NO symmetrical poses, and NO studio lighting. Introduce slight film grain to break the 'AI look'."
        ].filter(Boolean).join(' '),
        social: [
            `This is a real buyer-show / social media UGC content image for the product: "${productTitleContext}".`,
            "CRITICAL: This must look like a REAL photo taken by an actual buyer with their phone — NOT a professional studio shot.",
            "Characteristics of authentic buyer photos: slightly imperfect composition, natural phone-camera perspective (slightly tilted or off-center), real home or outdoor environment with visible personal surroundings, natural ambient lighting (not studio-lit), casual and spontaneous feel.",
            "The person should look like a real customer genuinely using and enjoying the product in their everyday life, not a model posing.",
            input.productType === 'apparel' ? 
            "Incorporate one of these authentic social media visual logics specifically for apparel: " +
            "1) Minimalist Chic: emphasis on clean color blocks, premium fabric textures like ribbed or satin, and minimalist backgrounds (stone walls, clean corners). " +
            "2) American Retro/Y2K: baby tees, cargo elements, industrial backgrounds (parking lots, street corners). " +
            "3) Effortless Loungewear: relaxed co-ord sets, lifestyle props like coffee cups, cozy home or cafe settings. " +
            "4) Vacation Baddie: asymmetric cuts, high skin exposure, sun-drenched settings like beaches or bright rooms with hard shadows. " +
            "Include real influencer photography scenarios such as OOTD mirror selfies with phone covering the face, walking on a crosswalk with motion blur, casual fitting room snaps, or leaning against a street pole." : "",
            "Include realistic everyday details: a half-drunk coffee cup, phone charger on the table, slightly messy but lived-in space, personal items in the background.",
            "The scene must vary dramatically between images — alternate between different apartment styles, street corners, parking lots, beaches, and backyards. Each buyer photo should feel like it's from a completely different person's life.",
            "The mood and scene must directly relate to the product's actual use case as described in the title and selling points.",
            "ANTI-AI DIRECTIVE: Ensure extreme realism. The image must look exactly like an unedited raw iPhone photo. Absolutely NO 'plastic' or overly airbrushed skin, NO perfectly symmetrical doll-like poses, and NO artificial studio lighting. Introduce slight film grain and natural lens imperfections to break the 'AI look'."
        ].filter(Boolean).join(' '),
        story: [
            `This is a premium high-end cinematic brand story visual for the product: "${productTitleContext}".`,
            "The image must match the premium quality of Amazon A+ Content banners, with 21:9 aspect ratio tension.",
            "CRITICAL COMPOSITION RULE: All subjects (products and people) MUST be positioned on the far left side of the image frame.",
            "Leave the right 60-70% of the image as clean, high-end negative space or atmospheric background, reserved for advertising copy.",
            "Use wide-angle storytelling to show the product within a vast, premium, and clean environment.",
            "Emphasize spatial depth, clean highlights, and refined commercial aesthetic. Lighting must be bright, clean, and professional like A+ editorial photography.",
            "Vary the environment dramatically: from high-end modern minimalist interiors to clean, breathtaking outdoor landscapes.",
        ].join(' '),
        asset: [
            `This is a premium 2:3 vertical Brand Asset Card for the product: "${productTitleContext}".`,
            "CRITICAL: This must look like a REAL photo taken by an actual buyer with their phone, providing authentic social-media lifestyle realism.",
            "Characteristics of authentic buyer photos: natural phone-camera perspective (slightly tilted or off-center), real home or outdoor environment, natural ambient lighting, casual and spontaneous feel.",
            "The person should look like a real customer genuinely using and enjoying the product in their everyday life, not a model posing.",
            input.productType === 'apparel' ? 
            "Incorporate one of these authentic social media visual logics specifically for apparel: 1) Minimalist Chic: clean color blocks, minimalist backgrounds. 2) American Retro/Y2K: industrial backgrounds. 3) Effortless Loungewear: cozy clean home or cafe settings. 4) Vacation Baddie: sun-drenched settings." : "",
            "CRITICAL REQUIREMENT: Keep the scene clean, minimalist, and uncluttered. DO NOT include too many elements. The background and scene must NOT be flashy, busy, or complex. HOWEVER, you MUST vary the minimalist aesthetics (e.g., modern clean, warm neutral tones, sleek industrial minimal, soft coastal clean, mid-century minimal). Vary the minimal furniture, wall textures, and color palettes so each image looks distinctly different while remaining clean.",
            "The mood and scene must directly relate to the product's actual use case as described in the title and selling points.",
            "ANTI-AI DIRECTIVE: Ensure extreme realism. The image must look exactly like an unedited raw iPhone photo. Absolutely NO 'plastic' skin, NO symmetrical poses, and NO studio lighting. Introduce slight film grain to break the 'AI look'."
        ].filter(Boolean).join(' '),
    };

    // Randomization directive to ensure diversity
    const randomizationDirective = [
        "IMPORTANT DIVERSITY DIRECTIVE: Each generated image MUST feature distinctly different scene elements.",
        "Vary these across generations: furniture style and color, wall decoration, rug/carpet pattern, lighting fixtures, plant types, cushion/throw patterns, small props and accessories, window treatment, floor material.",
        "If the scene is a living room, do NOT always use the same grey sofa — alternate between different sofa styles (sectional, loveseat, mid-century, modular), different colors (cream, navy, sage, terracotta, charcoal), and different surrounding furniture.",
        "Maintain scene believability while maximizing visual variety.",
    ].join(' ');

    // Build realistic interaction prompt for physical believability
    const realismPrompt = buildRealisticInteractionPrompt(input);

    const plushSpecificGuide = input.productType === 'plush' 
        ? "SCENE RULES FOR PLUSH: Use lively and premium North American home scenes (e.g., cheerful kids bedroom, colorful play room, or sun-drenched family area). The environment must feel child-friendly and energetic with vibrant but tasteful colors. Keep background organized and premium. MAX 3 props total. DO NOT add blankets or throws unless specifically requested. Emphasize a warm, healing, and joyful lifestyle narrative." 
        : "";

    let finalPromptParts = [
        "Create an ultra realistic commercial lifestyle photograph grounded in real everyday American life.",
        boardInstructions[input.boardType],
        plushSpecificGuide,
        randomizationDirective,
        "All people, styling, interiors, props, neighborhoods, and visual cues must feel authentic to the United States market.",
        "Use ethnically believable real American people and natural candid behavior, never generic mannequin-like subjects.",
        personaPrompt,
        PRODUCT_TYPE_GUIDE[input.productType],
        PRODUCT_TYPE_SCENE_DETAIL[input.productType],
        realismPrompt,
        "The reference images are the single source of truth for the product identities.",
        buildProductLockPrompt(input.productType),
        "Never recolor, repaint, redesign, simplify, swap materials, alter proportions, or drift from the original product identity. If the scene concept conflicts with the product, adjust the environment and styling around the product instead.",
        input.sellingPoints ? `Prioritize these selling points visually: ${input.sellingPoints}.` : "",
        buildMaterialLockPrompt(input),
        input.avoidElements ? `Strictly avoid these elements: ${input.avoidElements}.` : "",
        input.extraNotes ? `Additional execution notes: ${input.extraNotes}.` : "",
        basePrompt,
        "STRICT PRODUCT FIDELITY: The reference product images are the absolute source of truth. You must maintain the exact structure, color, texture, and identity of the product without any deviation.",
        ["main", "social", "aplus", "asset"].includes(input.boardType)
            ? "Make this look like a real buyer's phone photo shared on social media — authentic, casual, unpolished but appealing. NOT a professional photo."
            : "Make the image look like a premium real photo shot by a top-tier Amazon ecommerce art director, following high-end A+ content standards.",
    ].filter(Boolean);

    const isNoModel = input.modelPersonaPreset === '无模特（纯产品）';
    if (isNoModel) {
        finalPromptParts = finalPromptParts.map(part => {
            return part.split('. ').filter(sentence => {
                const lower = sentence.toLowerCase();
                return !lower.includes('person') && !lower.includes('people') && !lower.includes('human') && !lower.includes('customer') && !lower.includes('model') && !lower.includes('children');
            }).join('. ');
        });
        finalPromptParts.push("CRITICAL DIRECTIVE: ABSOLUTELY NO PEOPLE, NO HANDS, NO BODY PARTS. ONLY THE PRODUCT IN THE SCENE.");
    }

    const isCommercialStyle2 = /商业|棚拍|精心布置|布景|影棚|摄影棚|高级|ins|马卡龙|糖果/.test(input.sceneDirection || '') || /商业|棚拍|精心布置|布景|影棚|摄影棚|高级|ins|马卡龙|糖果/.test(input.extraNotes || '') || /马卡龙|糖果|商业/.test(input.colorStyle || '');
    if (isCommercialStyle2) {
        finalPromptParts = finalPromptParts.map(part => {
            return part.split('. ').filter(sentence => {
                const lower = sentence.toLowerCase();
                return !lower.includes('buyer') && !lower.includes('not a professional') && !lower.includes('casual') && !lower.includes('everyday life') && !lower.includes('home scenes') && !lower.includes('middle-class home') && !lower.includes('social media');
            }).join('. ');
        });
        finalPromptParts.push("CRITICAL DIRECTIVE: This MUST look like a premium commercial studio setup or carefully arranged photography with perfect lighting, curated set design, and high-aesthetic color palette. NOT a casual home photo.");
    }

    return finalPromptParts.filter(Boolean).join(" ");
}

export function buildSceneGenerationNegativePrompt(input: {
    boardType: SceneGenerationBoardType;
    productType: SceneGenerationProductType;
    stylePackId?: string;
    styleVariantId?: string;
    avoidElements?: string;
    negativePrompt?: string;
}) {
    // --- Style Pack Logic ---
    let stylePackData: any = null;
    let styleVariant: any = null;

    if (input.stylePackId && input.styleVariantId) {
        // stylePackData handled by top-level import
        stylePackData = STYLE_PACKS.find((p: any) => p.stylePackName.includes(input.stylePackId!));
        if (stylePackData) {
            styleVariant = stylePackData.styleVariants.find((v: any) => v.id === input.styleVariantId);
        }
    }
    // --- End Style Pack Logic ---

    const scene = ["main", "social", "aplus", "asset"].includes(input.boardType) ? "portrait" : "product";
    const style = ["main", "social", "aplus", "asset"].includes(input.boardType) ? "film" : "cinematic";
    const extra = [
        ["main", "aplus", "asset"].includes(input.boardType) ? "cluttered background, busy scene, complex environment, distracting elements, too many props, flashy colors" : "",
        stylePackData?.negativePromptGlobal || "",
        styleVariant?.negativePromptAdd || "",
        "CGI",
        "3D render",
        "AI generated",
        "midjourney aesthetic",
        "cartoon",
        "anime",
        "plastic texture",
        "waxy skin",
        "airbrushed skin",
        "mannequin pose",
        "unnatural hands",
        "extra fingers",
        "bad anatomy",
        "deformed face",
        "wrong product color",
        "wrong proportions",
        "duplicate product",
        "floating props",
        "fake luxury set",
        "overdesigned background",
        "non-American setting cues",
        "Japanese interior design",
        "Asian minimalist decor",
        "Japanese apartment style",
        "Japanese wabi-sabi aesthetic",
        "tatami floor",
        "shoji screen",
        "Asian furniture style",
        "Scandinavian minimalism",
        "MUJI-style decor",
        "Nordic interior design",
        "European apartment styling",
        "ikebana flower arrangement",
        "zen garden elements",
        "Asian street scene",
        "non-US architecture",
        "inaccurate ethnicity styling",
        "mismatched cultural setting",
        "incorrect family composition",
        "unrealistic American lifestyle cues",
        "mannequin family pose",
        "staged stock-photo behavior",
        "recolored product",
        "material substitution",
        "altered fabric type",
        "changed surface finish",
        "texture drift",
        "incorrect embroidery details",
        "print drift",
        "changed trim details",
        "altered silhouette",
        "inaccurate product identity",
        input.productType === "plush" ? "toy-like hard fabric, synthetic fake fur, stiff plush body, incorrect embroidery, wrong plush pile length, flattened stuffing volume, changed facial embroidery, hard direct light, strong flash, harsh shadows, overexposure, high saturation, neon colors, fluorescent colors, cold gray color cast, stiff posing, cluttered background, too many props" : "",
        input.productType === "apparel" ? "wrong garment structure, melted fabric, impossible folds, broken seams, incorrect fit, changed fabric weight, altered print placement, altered embroidery placement, recolored garment panels" : "",
        input.productType === "general" ? "changed hardware finish, altered edge construction, replaced accessories, changed material gloss" : "",
        input.avoidElements || "",
        input.negativePrompt || "",
    ].filter(Boolean).join(", ");

    return buildNegativePrompt(scene as any, style as any, extra);
}
