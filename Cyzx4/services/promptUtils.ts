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
export type SceneGenerationBoardType = "main" | "aplus" | "social";

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
}

const SCENE_LENS_MAP: Record<SceneGenerationBoardType, string> = {
    main: "shot on 50mm standard lens, commercial ecommerce hero shot, crisp centered composition, clean depth separation",
    aplus: "shot on 35mm lens, premium editorial banner composition, layered storytelling scene, cinematic commercial framing",
    social: "shot on 85mm portrait lens, candid handheld lifestyle framing, natural indoor light, authentic buyer-show perspective",
};

const SCENE_BOARD_GUIDE: Record<SceneGenerationBoardType, string> = {
    main: "Amazon secondary image style, clear subject hierarchy, product-first composition, clean but realistic background, strong click-through appeal",
    aplus: "premium A+ storytelling visual, wider environment context, richer spatial layering, elevated brand atmosphere",
    social: "real American lifestyle buyer-show content, candid human interaction, natural social-media realism, believable daily life moment",
};

const PRODUCT_TYPE_GUIDE: Record<SceneGenerationProductType, string> = {
    plush: "preserve exact plush toy identity, exact silhouette, stitching placement, facial embroidery, plush pile direction, soft cotton-filled volume, tactile fuzzy texture, huggable realism",
    apparel: "preserve exact apparel identity, exact garment structure, collar, cuff, hem, seam lines, fit silhouette, fabric drape, wrinkle logic, true-to-reference material behavior",
    general: "preserve exact product identity, exact color, structure, proportions, material finish, key details, and overall commercial accuracy",
};

const PRODUCT_LOCK_RULES: Record<SceneGenerationProductType, string> = {
    plush: "Treat the reference image as the only source of truth for the plush toy identity. Do not recolor, restyle, reshape, simplify, or substitute the fur, embroidery, facial features, seams, stuffing volume, pile length, sheen, or silhouette. Preserve the exact hue family, saturation balance, plush density, stitched details, and surface finish. Any lifestyle styling must adapt around the plush product instead of changing it.",
    apparel: "Treat the reference image as the only source of truth for the apparel product identity. Do not recolor, restyle, repaint, redesign, or substitute the fabric type, garment structure, print placement, embroidery placement, trims, fit, drape, or silhouette. Preserve the exact main color and secondary color relationship, fabric texture, seam construction, and finishing details. Any lifestyle styling must adapt around the garment instead of changing it.",
    general: "Treat the reference image as the only source of truth for the product identity. Do not recolor, repaint, redesign, simplify, or substitute the material, hardware, trim, edge construction, surface finish, or silhouette. Preserve the exact hue family, saturation balance, texture depth, structural proportions, and visible product details. Any scene styling must adapt around the product instead of changing it.",
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
    const personaParts = [
        input.modelPersonaPreset,
        input.modelEthnicity && input.modelEthnicity !== "自动匹配" ? input.modelEthnicity : "ethnically believable American",
        input.modelAgeGroup && input.modelAgeGroup !== "自动匹配" ? input.modelAgeGroup : "age-appropriate",
        input.modelFamilyStructure && input.modelFamilyStructure !== "自动匹配" ? input.modelFamilyStructure : "realistic household composition",
        input.modelLifestyle && input.modelLifestyle !== "自动匹配" ? input.modelLifestyle : "real everyday American lifestyle",
    ].filter(Boolean);

    const lifestyleSceneMap: Record<string, string> = {
        "都市通勤": "urban U.S. apartment, city sidewalk, coffee-to-go, elevator lobby, commuter realism",
        "郊区家庭": "suburban American home, family living room, nursery, backyard, natural family routine",
        "校园": "real U.S. campus walkway, library, dorm, green lawn, student daily life",
        "健身": "American gym, wellness studio, active lifestyle environment, natural movement",
        "居家休闲": "cozy U.S. apartment or suburban home, sofa, bedroom, weekend home routine",
        "节日送礼": "American holiday gifting moment, living room, wrapped gift setting, warm family atmosphere",
    };

    const sceneCue = input.modelLifestyle && lifestyleSceneMap[input.modelLifestyle]
        ? lifestyleSceneMap[input.modelLifestyle]
        : "realistically American interior or neighborhood context";

    return [
        `Use ${personaParts.join(", ")} people only if humans appear in the image.`,
        `Human styling, family composition, behavior, body language, interiors, and props must be credible for the United States market.`,
        `Anchor the human context in ${sceneCue}.`,
        input.modelPersonaNotes ? `Additional persona notes: ${input.modelPersonaNotes}.` : "",
    ].filter(Boolean).join(" ");
}

export function buildSceneGenerationPrompt(input: SceneGenerationPromptInput): string {
    const subject = [input.productName, input.productCategory, input.productSize].filter(Boolean).join(", ") || "commercial product";
    const environment = [input.sceneDirection, input.usageScenario, input.targetAudience].filter(Boolean).join(", ") || "real American lifestyle setting";
    const style = [input.brandTone, input.colorStyle, SCENE_BOARD_GUIDE[input.boardType]].filter(Boolean).join(", ");
    const personaPrompt = buildAmericanPersonaPrompt(input);

    const basePrompt = buildGoldenFormula({
        subject,
        action: input.copyIntent || "show the product naturally in use while preserving exact identity",
        environment,
        style,
        lighting: input.boardType === "social"
            ? "natural window light, believable shadows, candid lifestyle realism, subtle filmic depth"
            : input.boardType === "aplus"
                ? "premium editorial lighting, layered highlights, realistic depth, refined brand atmosphere"
                : "clean commercial lighting, realistic materials, sharp product focus, polished ecommerce look",
        composition: SCENE_LENS_MAP[input.boardType],
        qualityBooster: input.boardType === "social" ? "FILM" : "EDITORIAL",
    });

    return [
        "Create an ultra realistic commercial lifestyle photograph grounded in real everyday American life.",
        "All people, styling, interiors, props, neighborhoods, and visual cues must feel authentic to the United States market.",
        "Use ethnically believable real American people and natural candid behavior, never generic mannequin-like subjects.",
        personaPrompt,
        PRODUCT_TYPE_GUIDE[input.productType],
        PRODUCT_TYPE_SCENE_DETAIL[input.productType],
        "The reference image is the single source of truth for the product identity.",
        buildProductLockPrompt(input.productType),
        "Never recolor, repaint, redesign, simplify, swap materials, alter proportions, or drift from the original product identity. If the scene concept conflicts with the product, adjust the environment and styling around the product instead.",
        input.sellingPoints ? `Prioritize these selling points visually: ${input.sellingPoints}.` : "",
        buildMaterialLockPrompt(input),
        input.avoidElements ? `Strictly avoid these elements: ${input.avoidElements}.` : "",
        input.extraNotes ? `Additional execution notes: ${input.extraNotes}.` : "",
        basePrompt,
        "Make the image look like a premium real photo shot by an experienced Amazon ecommerce art director, not CGI or AI art.",
    ].filter(Boolean).join(" ");
}

export function buildSceneGenerationNegativePrompt(input: {
    boardType: SceneGenerationBoardType;
    productType: SceneGenerationProductType;
    avoidElements?: string;
}) {
    const scene = input.boardType === "social" ? "portrait" : "product";
    const style = input.boardType === "social" ? "film" : "cinematic";
    const extra = [
        "CGI",
        "3D render",
        "cartoon",
        "anime",
        "plastic texture",
        "waxy skin",
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
        input.productType === "plush" ? "toy-like hard fabric, synthetic fake fur, stiff plush body, incorrect embroidery, wrong plush pile length, flattened stuffing volume, changed facial embroidery" : "",
        input.productType === "apparel" ? "wrong garment structure, melted fabric, impossible folds, broken seams, incorrect fit, changed fabric weight, altered print placement, altered embroidery placement, recolored garment panels" : "",
        input.productType === "general" ? "changed hardware finish, altered edge construction, replaced accessories, changed material gloss" : "",
        input.avoidElements || "",
    ].filter(Boolean).join(", ");

    return buildNegativePrompt(scene as any, style as any, extra);
}
