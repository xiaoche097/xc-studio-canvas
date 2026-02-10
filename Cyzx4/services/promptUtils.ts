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
    PHOTOGRAPHY: "high resolution, 8K, ultra HD, professional photography, sharp focus, photorealistic, highly detailed, studio quality",

    /** For product/commercial photography */
    PRODUCT: "commercial photography, product shot, e-commerce quality, clean and professional, high resolution, sharp focus, studio lighting",

    /** For illustration/art outputs */
    ILLUSTRATION: "professional illustration, highly detailed, intricate details, sharp lines, vibrant colors, gallery quality",

    /** For editorial/fashion photography */
    EDITORIAL: "editorial quality, magazine cover worthy, professional photography, award-winning, cinematic, highly detailed",

    /** For film/analog photography */
    FILM: "analog film photography, Kodak Portra 400, film grain, natural light, cinematic, highly detailed texture, editorial aesthetic, photorealistic",

    /** Minimal set for editing/retouching (avoid over-constraining) */
    RETOUCHING: "high resolution, seamless edit, professional retouching quality, sharp details, natural blending",
} as const;

// ==================== Negative Prompts ====================

/** Base negative prompt — always include */
const NEGATIVE_BASE = "blurry, out of focus, low resolution, pixelated, low quality, bad quality, watermark, logo, text, signature, jpeg artifacts, distorted, deformed";

/** Scene-specific negative prompts */
const NEGATIVE_SCENE: Record<string, string> = {
    portrait: "bad anatomy, extra limbs, deformed face, bad proportions, extra fingers, missing fingers, disfigured, ugly face",
    product: "cluttered background, distracting elements, uneven lighting, shadows on product, fingerprints, dust, scratches",
    landscape: "people, man-made structures, power lines, trash, flat lighting",
    illustration: "photorealistic, 3D render, photograph, blurry, sketchy outlines",
    editorial: "casual, messy, stock photo feel, fake smiles, uncomfortable poses",
    automotive: "wrong brand elements, generic car interior, CGI look, 3D render, plastic texture",
    inpainting: "visible seam, color mismatch, edge artifacts, blending errors, inconsistent lighting",
    outpainting: "visible seam, mismatched lighting, color shift, discontinuous patterns, abrupt edges",
};

/** Style conflict negative prompts */
const NEGATIVE_STYLE: Record<string, string> = {
    realistic: "cartoon, anime, illustrated, abstract, CGI, 3D render",
    minimalist: "cluttered, busy, excessive details, chaotic",
    cinematic: "flat lighting, boring composition, amateur, snapshot",
    film: "digital render, smooth skin, CGI, plastic, artificial lighting, 3D render",
};

/** Specific negative prompts for perspective and angle issues */
export const NEGATIVE_PERSPECTIVE = "wrong angle, distorted perspective, fisheye effect (unless wanted), bird's eye view (unless wanted), worm's eye view (unless wanted), tilted horizon, off-center composition, wide angle distortion, incorrect field of view";

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
