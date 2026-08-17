export type PhotographyCameraId = 'editorial-35mm' | 'rangefinder-35mm' | 'medium-format-67';
export type PhotographyLensId = '35mm' | '40mm' | '50mm' | '80mm';
export type FilmPresetId = 'costa-135';
export type FilmStrength = 'soft' | 'standard' | 'authentic';

export interface PhotographyCameraProfile {
  id: PhotographyCameraId;
  name: string;
  format: string;
  character: string;
  description: string;
  allowedLensIds: PhotographyLensId[];
  defaultLensId: PhotographyLensId;
  prompt: string;
}

export interface PhotographyLensProfile {
  id: PhotographyLensId;
  name: string;
  aperture: string;
  character: string;
  prompt: string;
}

export interface FilmPresetProfile {
  id: FilmPresetId;
  name: string;
  subtitle: string;
  chineseName: string;
  iso: number;
  palette: [string, string, string, string];
  tags: string[];
  description: string;
  lightingPrompt: string;
  colorPrompt: string;
  filmPrompt: string;
  negativePrompt: string;
}

export interface PhotographyPreserveSettings {
  identity: boolean;
  clothing: boolean;
  composition: boolean;
  product: boolean;
  collectionConsistency: boolean;
}

export const PHOTOGRAPHY_CAMERAS: PhotographyCameraProfile[] = [
  {
    id: 'editorial-35mm',
    name: '35mm Editorial',
    format: 'Full-frame 35mm',
    character: '平衡 · 纪实 · 时装',
    description: 'COSTA 135 推荐机身响应，兼顾环境信息、人物比例与胶片快照感。',
    allowedLensIds: ['35mm', '40mm', '50mm'],
    defaultLensId: '40mm',
    prompt: 'Emulate a full-frame 35mm film-camera response with natural editorial perspective, organic edge rendering, restrained micro-contrast, and no smartphone computational photography.',
  },
  {
    id: 'rangefinder-35mm',
    name: '35mm Rangefinder',
    format: 'Compact rangefinder',
    character: '轻快 · 街拍 · 临场',
    description: '更接近南欧街头抓拍，画面直接、机位自然、环境参与感更强。',
    allowedLensIds: ['35mm', '40mm', '50mm'],
    defaultLensId: '35mm',
    prompt: 'Emulate a compact 35mm rangefinder photograph with immediate street-level presence, subtle optical imperfection, natural scale, and crisp but non-digital environmental detail.',
  },
  {
    id: 'medium-format-67',
    name: 'Medium Format 6×7',
    format: '6×7 color negative',
    character: '厚润 · 从容 · 高级',
    description: '更沉静的商业画质与细腻层次，适合高级时装肖像和品牌大片。',
    allowedLensIds: ['80mm'],
    defaultLensId: '80mm',
    prompt: 'Emulate a 6x7 medium-format color-negative camera response with rich tonal separation, calm premium rendering, smooth highlight density, realistic dimensionality, and no artificial shallow-depth effect.',
  },
];

export const PHOTOGRAPHY_LENSES: PhotographyLensProfile[] = [
  {
    id: '35mm',
    name: '35mm',
    aperture: 'f/5.6–f/8',
    character: '环境叙事',
    prompt: 'Use a 35mm equivalent environmental-fashion perspective at approximately f/5.6 to f/8. Keep architecture and location readable; avoid wide-angle distortion.',
  },
  {
    id: '40mm',
    name: '40mm',
    aperture: 'f/5.6',
    character: 'COSTA 标准',
    prompt: 'Use a 40mm equivalent natural editorial perspective at approximately f/5.6, with believable depth and no exaggerated bokeh.',
  },
  {
    id: '50mm',
    name: '50mm',
    aperture: 'f/4–f/5.6',
    character: '人物聚焦',
    prompt: 'Use a 50mm equivalent fashion-portrait perspective at approximately f/4 to f/5.6. Preserve the environment while giving the subject gentle visual priority.',
  },
  {
    id: '80mm',
    name: '80mm MF',
    aperture: 'f/5.6',
    character: '中画幅标准',
    prompt: 'Use an 80mm medium-format standard-lens response at approximately f/5.6, with elegant compression, realistic depth, and clearly retained scene structure.',
  },
];

export const FILM_PRESETS: FilmPresetProfile[] = [
  {
    id: 'costa-135',
    name: 'COSTA 135',
    subtitle: 'Mediterranean Sun Film',
    chineseName: '地中海日晒胶片',
    iso: 200,
    palette: ['#ead6ae', '#d99458', '#80a9aa', '#3f6f79'],
    tags: ['强日光', '暖肤色', 'Dusty Cyan', '35mm Grain'],
    description: '1990s–2000s 南欧海滨时装 Editorial：强太阳、暖肤色、冷青蓝环境与自然胶片颗粒。',
    lightingPrompt: `Normalize the source lighting into clear Mediterranean late-morning to early-afternoon sunlight. Use one dominant natural sun source, medium-hard directional light, a natural 4:1 to 6:1 light ratio, clear but not dead-black shadow edges, warm creamy sunlit highlights, and subtle cyan-gray ambient fill from sky and sea. Preserve highlight texture in skin, white architecture and clothing. Use highlight-priority film exposure around -0.15 EV, with no HDR shadow recovery and no studio softbox look.`,
    colorPrompt: `Use 5450K daylight white balance with approximately +4 magenta tint. Render warm ivory highlights, warm-neutral midtones, and very subtle cyan-gray shadows. Keep skin natural warm peach, olive or tan while preserving ethnicity, undertone, freckles, pores and real tonal variation. Reduce orange saturation, suppress excess yellow and green, render vegetation as dry Mediterranean green, and shift blue slightly toward a pale dusty cyan with raised luminance. Use a medium-high film curve with softly compressed whites, slightly softened black point, medium-low saturation, and a balanced warm-subject/cool-environment relationship.`,
    filmPrompt: `Emulate fine organic editorial 35mm color-negative grain with nominal grain amount 24, size 22 and roughness 45. Add restrained analog micro-contrast, slightly softened optical rendering, subtle corner softness and only 2% to 5% warm halation on extreme highlight edges. Keep eyes, lashes, garment construction and material detail naturally readable without AI hyper-sharpness or digital edge halos.`,
    negativePrompt: 'HDR, hyperreal digital sharpness, smartphone photo processing, overly clean CGI texture, artificial rim light, studio softbox lighting, flat cloudy light, orange teal cinematic grading, excessive teal shadows, excessive orange skin, oversaturated blue sky, neon turquoise ocean, bright saturated green, washed pastel tones, beige monochrome filter, Korean creamy filter, Japanese airy filter, heavy vintage yellow cast, sepia, crushed blacks, lifted gray blacks, blown highlights, excessive bloom, dreamy glow, plastic skin, beauty filter, skin whitening, strong skin smoothing, excessive bokeh, f/1.4 look, fake depth of field, AI sharpening artifacts, changed identity, changed face, changed body, changed garment design, changed product structure, changed logo, changed pattern, changed composition, extra objects, removed objects, watermark, text',
  },
];

export const FILM_STRENGTHS: Array<{
  id: FilmStrength;
  label: string;
  value: number;
  description: string;
}> = [
  { id: 'soft', label: '柔和', value: 0.65, description: '保留更多原片气质' },
  { id: 'standard', label: '标准', value: 0.85, description: '推荐商业平衡' },
  { id: 'authentic', label: '原生', value: 1, description: '完整胶片响应' },
];

export const getPhotographyCamera = (id: PhotographyCameraId) =>
  PHOTOGRAPHY_CAMERAS.find((camera) => camera.id === id) || PHOTOGRAPHY_CAMERAS[0];

export const getPhotographyLens = (id: PhotographyLensId) =>
  PHOTOGRAPHY_LENSES.find((lens) => lens.id === id) || PHOTOGRAPHY_LENSES[1];

export const getFilmPreset = (id: FilmPresetId) =>
  FILM_PRESETS.find((preset) => preset.id === id) || FILM_PRESETS[0];

export const getFilmStrength = (id: FilmStrength) =>
  FILM_STRENGTHS.find((strength) => strength.id === id) || FILM_STRENGTHS[1];

const scaled = (value: number, strength: number) => Math.round(value * strength);

export const buildPhotographyAnalysisPrompt = (
  camera: PhotographyCameraProfile,
  lens: PhotographyLensProfile,
  film: FilmPresetProfile,
) => `You are the Photography Preset Director Agent in an AI commercial photography pipeline.

Analyze ALL supplied images as one collection. Do not redesign or generate anything. Establish one shared transformation anchor that can make every image look as if it was photographed on the same day, by the same photographer, using the same camera, lens and film response.

TARGET SYSTEM
- Camera: ${camera.name} / ${camera.format}
- Lens: ${lens.name}, ${lens.aperture}
- Film look: ${film.name} — ${film.subtitle}, ISO ${film.iso}
- Target lighting: Mediterranean medium-hard directional sunlight
- Target white balance: 5450K, tint +4 magenta
- Target color: warm natural skin, warm ivory highlights, subtle cyan-gray shadows, dry greens, dusty cyan blues

Return concise valid JSON only with this shape:
{
  "collectionSummary": "...",
  "sourceLookDiagnosis": "...",
  "sourceExposureRange": "...",
  "sourceWhiteBalanceRange": "...",
  "sourceLighting": "...",
  "existingLooksToRemove": ["..."],
  "skinAnchor": "...",
  "whiteAnchor": "...",
  "blueAnchor": "...",
  "greenAnchor": "...",
  "shadowAnchor": "...",
  "highlightAnchor": "...",
  "visibleChangeTargets": ["..."],
  "executionPlan": ["neutralize source look", "rebuild light", "apply camera and lens response", "apply film color and grain", "validate visible delta"],
  "sharedCorrection": "...",
  "consistencyRisk": "low | medium | high"
}`;

export const buildPhotographyGenerationPrompt = ({
  camera,
  lens,
  film,
  strength,
  preserve,
  colorAnchor,
  userDirection,
  itemIndex,
  itemCount,
}: {
  camera: PhotographyCameraProfile;
  lens: PhotographyLensProfile;
  film: FilmPresetProfile;
  strength: FilmStrength;
  preserve: PhotographyPreserveSettings;
  colorAnchor: string;
  userDirection: string;
  itemIndex: number;
  itemCount: number;
}) => {
  const strengthConfig = getFilmStrength(strength);
  const factor = strengthConfig.value;
  const locks = [
    preserve.identity ? 'Preserve the exact person identity, face structure, ethnicity, body proportions, hair and natural skin texture.' : '',
    preserve.clothing ? 'Preserve the exact clothing design, color, print, seams, material, accessories and styling.' : '',
    preserve.product ? 'Preserve every product/SKU structure, logo, label, color and material detail exactly.' : '',
    preserve.composition ? 'Preserve the original pose, action, crop, framing, perspective, camera height, subject position and scene architecture.' : '',
  ].filter(Boolean).join('\n- ');

  return `AI PHOTOGRAPHY PRESET TRANSFORM — ${film.name}

INPUT ROUTING
- Image 1 is the only content source for this render.
- This is collection item ${itemIndex + 1} of ${itemCount}.
- Perform an in-place photographic look transformation, not a scene redesign and not a new fashion concept.

TRANSFORMATION PIPELINE
1. Analyze the source exposure, white balance, light direction, light hardness, skin exposure, dominant colors, clipping, saturation, contrast, sharpness and any existing filter.
2. Remove the source photographic look and establish a neutral photographic base without changing content.
3. Rebuild the target lighting, camera response, color science and film response below.
4. Validate content fidelity and collection consistency before returning one finished image.

MANDATORY VISIBLE TRANSFORMATION
- Do NOT return the source image unchanged or nearly unchanged. A near-identical copy is a failed result.
- The finished image must show an immediately visible full-frame photographic reprocessing at thumbnail size: changed white balance, highlight color, shadow color, contrast curve, saturation relationships, blue/green rendering, highlight rolloff and organic film grain.
- Content preservation does NOT mean preserving the source lighting, exposure, white balance, contrast, color grade, digital sharpness or noise structure. Those photographic properties MUST be rebuilt.
- Keep subject and scene identity fixed while visibly changing how the entire photograph was exposed, lit, rendered and processed.

COLLECTION COLOR ANCHOR
${preserve.collectionConsistency ? colorAnchor : 'Collection consistency lock is disabled. Still follow the selected film profile accurately.'}

CAMERA PROFILE
${camera.prompt}
${lens.prompt}
Use an ISO ${film.iso} color-negative response. The selected camera and lens override the film preset's default optical profile while retaining its color science.

FILM PROFILE — ${film.name} / ${film.subtitle}
Preset strength: ${strengthConfig.label} (${Math.round(factor * 100)}%).
${film.lightingPrompt}
${film.colorPrompt}
${film.filmPrompt}

SCALED LOOK TARGETS
- Contrast: +${scaled(14, factor)}
- Highlights: ${scaled(-24, factor)}
- Shadows: ${scaled(-12, factor)}
- Saturation: ${scaled(-4, factor)}
- Grain amount: ${scaled(24, factor)} / size ${scaled(22, factor)} / roughness ${scaled(45, factor)}

CONTENT LOCKS
- ${locks || 'Preserve all visible source content unless the user explicitly requests otherwise.'}
- These locks protect identity, design, geometry and placement only. They explicitly allow—and require—global relighting, exposure adjustment, color remapping, tonal-curve changes, highlight/shadow reconstruction, optical softness and film grain.

USER DIRECTION
${userDirection.trim() || 'No additional creative change. Apply only the selected photographic system.'}

FINAL STANDARD
The result must read as a visibly transformed real commercial fashion photograph processed through ${film.name}, with natural photographic imperfections and no obvious AI repainting. Every batch result must feel like the same shoot, same day, same camera, same lens and same film processing. Before returning, compare against Image 1: if the new color, light, tonal curve and grain are not clearly distinguishable, intensify the film treatment while keeping content locked.`;
};

export const buildPhotographyQaPrompt = ({
  camera,
  lens,
  film,
  strength,
  itemIndex,
}: {
  camera: PhotographyCameraProfile;
  lens: PhotographyLensProfile;
  film: FilmPresetProfile;
  strength: FilmStrength;
  itemIndex: number;
}) => `You are the independent Photography Preset QA Agent.

IMAGE ROUTING
- Image 1 is the immutable source photograph.
- Image 2 is the generated preset result for collection item ${itemIndex + 1}.

TARGET
- Camera: ${camera.name} / ${camera.format}
- Lens: ${lens.name} / ${lens.aperture}
- Film: ${film.name} / ${film.subtitle}, ISO ${film.iso}
- Strength: ${getFilmStrength(strength).label}

Judge the two images visually. The output must preserve identity, garment/product design, pose, framing and scene geometry, but it must NOT be unchanged. At thumbnail size there must be a clearly visible photographic transformation in white balance, directional Mediterranean sunlight, warm ivory highlights, subtle cyan-gray shadows, dry green and dusty cyan rendering, highlight rolloff, analog micro-contrast and organic film grain.

Fail the result when any of these are true:
- it is unchanged or nearly identical to Image 1;
- the selected camera/lens/film character is not visibly present;
- it looks like a generic digital photo or a simple warm filter;
- identity, clothing/product structure, pose, framing or scene geometry changed materially.

Return valid JSON only:
{
  "pass": true,
  "styleDeltaScore": 0,
  "contentFidelityScore": 0,
  "filmAccuracyScore": 0,
  "notes": "Concise Chinese verdict describing the visible evidence.",
  "correctionPrompt": "Concise English instructions that would fix the failed result while preserving content. Empty when passed."
}

Passing requires styleDeltaScore >= 40, contentFidelityScore >= 80 and filmAccuracyScore >= 65.`;

export const buildPhotographyRetryPrompt = ({
  originalPrompt,
  qaCorrection,
  film,
}: {
  originalPrompt: string;
  qaCorrection: string;
  film: FilmPresetProfile;
}) => `${originalPrompt}

MANDATORY QA REWORK — THE PREVIOUS RENDER FAILED
The independent QA Agent found that the previous result was too close to the source, insufficiently faithful to ${film.name}, or changed protected content.
QA correction: ${qaCorrection || 'Increase the clearly visible film, lighting and color-science transformation while restoring exact source content.'}

This is a fresh render from the ORIGINAL Image 1, not an edit of the rejected result. Make the ${film.name} response unmistakable at thumbnail size while keeping identity, garment/product design, pose, framing and scene geometry exact. A near-identical return is not acceptable.`;
