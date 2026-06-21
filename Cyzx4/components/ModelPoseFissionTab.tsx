import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Crop,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize,
  RefreshCw,
  Scan,
  Sparkles,
  Store,
  Sun,
  Upload,
  UserCircle2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { generateImageToImage } from '../services/geminiService';
import { compressImage, getErrorMessage, isAbortError, generateContentWithAnalysisFallback, getAiClient } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { convertImageDataUrlFormat, OutputImageFormat } from '../utils/imageFormat';
import { applyColorCorrection, ColorCorrectionMode, extractEdges } from '../utils/imageProcessor';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { CLOTHING_POSES } from '../constants/clothingPresets';
import { SLEEPWEAR_POSES } from '../constants/sleepwearPresets';
import { MENS_SHIRT_POSES } from '../constants/mensShirtPosePresets';
import { MENS_KNIT_POSES } from '../constants/mensKnitPosePresets';
import { MENS_TEE_POSES } from '../constants/mensTeePosePresets';
import { SWIM_SHORTS_POSES } from '../constants/swimShortsPosePresets';
import { MENS_SHORTS_POSES } from '../constants/mensShortsPosePresets';
import { MENS_PANTS_POSES } from '../constants/mensPantsPosePresets';
import { LONG_DRESS_POSES } from '../constants/longDressPosePresets';
import { WOMENS_FASHION_POSES } from '../constants/womensFashionPosePresets';
import { SOLAVIBE_POSES } from '../constants/solavibePosePresets';
import { KARISMINA_POSES } from '../constants/karisminaPosePresets';
import { Y2K_POSES } from '../constants/y2kPosePresets';
import { SURI_MIRA_POSES } from '../constants/suriMiraPosePresets';

type UploadKind = 'model' | 'product' | 'scene' | 'action' | 'accessory';
type MainReferenceKind = UploadKind | 'overall' | 'color';
type PoseSourceMode = 'random' | 'manual' | 'reference';
type PlatformKey = 'amazon' | 'shein' | 'temu' | 'tmall' | 'independent';
type PoseLibraryKey =
  | 'clothing'
  | 'sleepwear'
  | 'mensShirt'
  | 'mensKnit'
  | 'mensTee'
  | 'mensShorts'
  | 'mensPants'
  | 'swimShorts'
  | 'longDress'
  | 'womensFashion'
  | 'solavibe'
  | 'karismina'
  | 'suriMira'
  | 'y2k';

type PosePreset = {
  id: string;
  name: string;
  prompt: string;
};

interface ActionReferenceAnalysis {
  shotType: string;
  shootingAngle: string;
  poseDescription: string;
  cropRange: string;
  promptBlock: string;
  bodyCoverage?: 'full_body' | 'upper_body' | 'lower_body' | 'close_up' | 'other';
  supportRequirement?: 'none' | 'wall' | 'chair' | 'sofa' | 'floor' | 'railing' | 'unknown';
  poseTransferMode?: 'exact' | 'scene_compatible';
  sceneCompatibilityNote?: string;
  forbiddenSceneElements?: string[];
  reasoning?: string;
}

type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mime: string;
  width?: number;
  height?: number;
  poseAnalysis?: ActionReferenceAnalysis;
  isAnalyzing?: boolean;
};

type ResultItem = {
  id: string;
  imageUrl: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  prompt: string;
  poseLabel: string;
  error?: string;
};

type CropEditorState = {
  index: number;
  imageUrl: string;
};

type CropImageMeta = {
  width: number;
  height: number;
};

const POSE_LIBRARIES: Array<{ key: PoseLibraryKey; label: string; desc: string; poses: PosePreset[] }> = [
  { key: 'clothing', label: '通用服装动作库', desc: '默认百搭', poses: CLOTHING_POSES },
  { key: 'womensFashion', label: '通用时尚女装', desc: '女装街拍/棚拍', poses: WOMENS_FASHION_POSES },
  { key: 'mensShirt', label: '男士衬衫', desc: '商务/休闲衬衫', poses: MENS_SHIRT_POSES },
  { key: 'mensKnit', label: '男士针织/Polo', desc: '针织衫/Polo', poses: MENS_KNIT_POSES },
  { key: 'mensTee', label: '男士T恤', desc: '基础T恤', poses: MENS_TEE_POSES },
  { key: 'mensShorts', label: '男士短裤', desc: '短裤下装', poses: MENS_SHORTS_POSES },
  { key: 'mensPants', label: '男士长裤', desc: '长裤下装', poses: MENS_PANTS_POSES },
  { key: 'swimShorts', label: '泳裤/沙滩裤', desc: '度假运动', poses: SWIM_SHORTS_POSES },
  { key: 'longDress', label: '长裙/连衣裙', desc: '裙装展示', poses: LONG_DRESS_POSES },
  { key: 'karismina', label: 'KARISMINA 高点击连衣裙', desc: '花园/度假/优雅', poses: KARISMINA_POSES },
  { key: 'suriMira', label: 'Suri Mira 宫廷法式复古连衣裙', desc: '宫廷/法式复古', poses: SURI_MIRA_POSES },
  { key: 'sleepwear', label: '睡衣/居家', desc: '居家睡衣', poses: SLEEPWEAR_POSES },
  { key: 'solavibe', label: 'Solavibe 大码度假', desc: '度假大码', poses: SOLAVIBE_POSES },
  { key: 'y2k', label: 'Y2K Editorial', desc: 'Denim/Trouser high-fashion', poses: Y2K_POSES },
];

const PLATFORM_STYLES: Array<{ key: PlatformKey; label: string; desc: string; icon: string; prompt: string }> = [
  {
    key: 'amazon',
    label: 'Amazon',
    desc: '纯白背景',
    icon: 'A',
    prompt: 'Amazon ecommerce catalog DNA: clean high-key lighting, pure white or very clean background, product-first composition, premium compliant commercial styling.',
  },
  {
    key: 'shein',
    label: 'SHEIN',
    desc: '潮流街拍',
    icon: '👗',
    prompt: 'SHEIN fashion marketplace DNA: trendy youthful styling, clean but lively fashion composition, flattering model pose, social-commerce energy, polished apparel display.',
  },
  {
    key: 'temu',
    label: 'Temu',
    desc: '高饱和',
    icon: '🧡',
    prompt: 'Temu marketplace DNA: bright high-saturation commercial look, clear product readability, direct conversion-focused fashion image, energetic and eye-catching.',
  },
  {
    key: 'tmall',
    label: '天猫淘宝',
    desc: '高级质感',
    icon: '🏬',
    prompt: 'Tmall/Taobao premium ecommerce DNA: refined lighting, polished texture, elegant commercial model styling, high perceived value and clean visual hierarchy.',
  },
  {
    key: 'independent',
    label: '独立站',
    desc: '品牌感',
    icon: '🛒',
    prompt: 'Independent DTC brand DNA: brand-forward lifestyle fashion photography, tasteful scene design, cohesive styling, premium editorial ecommerce mood.',
  },
];

const ASPECT_OPTIONS = [
  { id: AspectRatio.SQUARE, label: '1:1', desc: '正方形' },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '主图' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '详情' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16', desc: '竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9', desc: '横幅' },
];

type ShotTypeKey = 'auto' | 'wide' | 'medium' | 'closeup' | 'macro';

const SHOT_TYPE_OPTIONS: Array<{ key: ShotTypeKey; label: string; desc: string; prompt: string; negative: string }> = [
  {
    key: 'auto',
    label: '智能推荐',
    desc: '按动作/产品判断',
    prompt: 'Use the most suitable ecommerce framing for the selected pose and product.',
    negative: '',
  },
  {
    key: 'wide',
    label: '远景环境',
    desc: '人物与场景',
    prompt: 'Wide environmental fashion framing: show the full model and meaningful scene context. Keep head-to-toe body visible when the pose allows it, with background/location readable.',
    negative: 'tight crop, close-up crop, cropped feet, cropped head, detail-only framing',
  },
  {
    key: 'medium',
    label: '中景半身',
    desc: '腰/胯以上',
    prompt: 'Medium half-body fashion framing: crop around upper body to waist or hips. Show face, upper torso, sleeves/neckline, and garment fit clearly. Do not show full head-to-toe body unless unavoidable.',
    negative: 'full body, head-to-toe, tiny subject, distant shot, extreme close-up, macro detail only',
  },
  {
    key: 'closeup',
    label: '近景特写',
    desc: '胸口/面料',
    prompt: 'Close-up product-detail fashion framing: camera is close to the model. Frame from face/chin/neck to chest or upper torso, prioritizing neckline, shoulders, sleeves, chest fabric texture, buttons, lace, bow, print, and surface detail. Keep the product large in frame. Do NOT zoom out to a normal half-body or full-body portrait. Do NOT show waist, hips, legs, feet, or full dress length unless the user explicitly asks for them.',
    negative: 'full body, head-to-toe, full dress length, waist visible, hips visible, legs visible, feet visible, distant portrait, zoomed-out portrait, small product in frame',
  },
  {
    key: 'macro',
    label: '微距细节',
    desc: '局部材质',
    prompt: 'Macro/detail crop: focus tightly on a specific garment detail such as fabric texture, neckline, sleeve, lace, bow, button, seam, print, embroidery, or trim. The model can be partially cropped. Product material detail must dominate the image. Do not render a standard model portrait.',
    negative: 'full body, half body, complete face portrait, full outfit, distant shot, tiny detail, generic catalog pose',
  },
];

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '3.1 Flash', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'nanobananapro', label: 'Banana Pro', desc: '3.0 Pro', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality', icon: <Sparkles className="h-4 w-4 text-orange-500" /> },
];

const getLibrary = (key: PoseLibraryKey) => POSE_LIBRARIES.find((item) => item.key === key) || POSE_LIBRARIES[0];
const toApiImage = (image: UploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const getDataUrl = (image: UploadedImage) => `data:${image.mime};base64,${image.base64}`;
const dataUrlToApiImage = (dataUrl: string) => {
  const [header, base64 = ''] = dataUrl.split(',');
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] || 'image/png';
  return { base64, mimeType };
};
const getResultAspectClass = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.SQUARE) return 'aspect-square';
  if (ratio === AspectRatio.PORTRAIT_2_3) return 'aspect-[2/3]';
  if (ratio === AspectRatio.PORTRAIT_3_4) return 'aspect-[3/4]';
  if (ratio === AspectRatio.PORTRAIT_9_16) return 'aspect-[9/16]';
  if (ratio === AspectRatio.LANDSCAPE_16_9) return 'aspect-video';
  return 'aspect-[3/4]';
};

const getAspectRatioValue = (ratio: AspectRatio) => {
  const [width, height] = ratio.split(':').map(Number);
  if (!width || !height) return 3 / 4;
  return width / height;
};

const loadHtmlImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Image could not be loaded.'));
  image.src = src;
});

const getCropRect = (
  meta: CropImageMeta,
  targetRatio: number,
  zoom: number,
  positionX: number,
  positionY: number,
) => {
  const sourceRatio = meta.width / meta.height;
  let cropWidth = meta.width;
  let cropHeight = meta.height;

  if (sourceRatio > targetRatio) {
    cropHeight = meta.height;
    cropWidth = cropHeight * targetRatio;
  } else {
    cropWidth = meta.width;
    cropHeight = cropWidth / targetRatio;
  }

  const safeZoom = Math.max(1, Math.min(3, zoom));
  cropWidth /= safeZoom;
  cropHeight /= safeZoom;

  const maxX = Math.max(0, meta.width - cropWidth);
  const maxY = Math.max(0, meta.height - cropHeight);
  const sx = maxX * (positionX / 100);
  const sy = maxY * (positionY / 100);

  return { sx, sy, sw: cropWidth, sh: cropHeight };
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(getStrongRandom() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const getStrongRandom = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 0xffffffff;
  }
  return Math.random();
};

const pickDiversePose = (
  libraryKey: PoseLibraryKey,
  poses: PosePreset[],
  batchCache: Map<PoseLibraryKey, PosePreset[]>,
  recentRef: React.MutableRefObject<Record<string, string[]>>,
) => {
  if (poses.length === 0) return undefined;
  const recent = recentRef.current[libraryKey] || [];
  const recentSet = new Set(recent);
  const batchPicked = batchCache.get(libraryKey) || [];
  if (batchPicked.length >= poses.length) batchCache.set(libraryKey, []);
  const currentBatch = batchCache.get(libraryKey) || [];
  const currentBatchIds = new Set(currentBatch.map((pose) => pose.id));

  let pool = poses.filter((pose) => !recentSet.has(pose.id) && !currentBatchIds.has(pose.id));
  if (pool.length === 0) pool = poses.filter((pose) => !currentBatchIds.has(pose.id));
  if (pool.length === 0) pool = poses;

  const [picked] = shuffle(pool);
  if (!picked) return undefined;

  batchCache.set(libraryKey, [...currentBatch, picked]);
  const maxRecent = Math.max(8, Math.min(36, Math.floor(poses.length * 0.45)));
  recentRef.current[libraryKey] = [picked.id, ...recent.filter((id) => id !== picked.id)].slice(0, maxRecent);
  return picked;
};

const POSE_FISSION_DIVERSITY_DIRECTIVE =
  'MANDATORY visible pose replacement: do NOT preserve Image 1\'s original standing pose, limb placement, body angle, crop, or subject placement. Make this a clearly different body pose from Image 1, with a changed leg stance, torso angle, shoulder line, head direction, arm/hand placement, and/or walking/sitting/leaning geometry. Returning Image 1 unchanged or with only tiny hand/expression changes is a failed result. Keep the same model identity, outfit, product details, and scene DNA, but rebuild the body posture as a new fashion pose.';

const ACTION_REFERENCE_BACKGROUND_LOCK =
  'STRICT ACTION REFERENCE ISOLATION: use uploaded action reference images only as a body-pose/camera-framing blueprint. Completely ignore and discard the action reference background, wall/floor/location, lighting, shadows, color grading, clothing, props, face, hair, expression, and model identity. Never copy background elements from the action reference; any physically necessary support must be built from Image 1 scene DNA, not from the action-reference scene.';

const OVERALL_REFERENCE_SUPREMACY_LOCK =
  'OVERALL REFERENCE SUPREMACY: Image 1 is the absolute source of truth for the model identity and scene DNA, but NOT for the pose when an action reference is uploaded. Preserve the same face, facial geometry, eyes, nose, mouth, jawline, hairline, hairstyle, skin tone, age impression, body proportions, outfit/product, lighting direction, shadows, camera mood, color palette, and recognizable room/set style. Replace Image 1\'s original pose with the uploaded action reference pose/framing. Action references may change body pose/framing only and may require small physically necessary scene support adaptations, but must never change the person or switch to the action-reference scene.';

const ACTION_POSE_PRIORITY_LOCK =
  'ACTION POSE PRIORITY: when an uploaded action reference is assigned to this output, it outranks Image 1 for pose, limb geometry, body angle, crop boundary, subject scale, and visible body extent. Image 1 outranks the action reference only for identity, product, clothing details, and scene. Do not return Image 1 as-is. Do not keep Image 1\'s original arm placement, leg stance, torso direction, or camera crop if they conflict with the action reference.';

const NATURAL_EXPRESSION_LOCK =
  'Natural commercial model expression: keep the exact same person and facial structure from Image 1, with relaxed eyes, natural mouth tension, and subtle realistic expression variation such as calm confidence, gentle neutral, soft candid smile, or slightly thoughtful look. Avoid stiff forced smiles, frozen faces, exaggerated grins, doll-like expressions, or any expression that changes the model identity.';

const MANUAL_SHOT_OVERRIDE_LOCK =
  'MANUAL SHOT TYPE OVERRIDE: when the user selected a non-auto shot type, the selected framing overrides the camera distance, crop, and visible body extent from Image 1, pose references, pose-library prompts, and action-reference analysis. Preserve identity/product/scene, but rebuild the camera crop to match the selected shot type exactly.';

const buildPrompt = (options: {
  outputNumber: number;
  poseSourceMode: PoseSourceMode;
  poseText: string;
  poseLabel: string;
  hasScene: boolean;
  hasActionReference: boolean;
  hasAccessoryReference: boolean;
  platformStyle: string;
  scenePrompt: string;
  productCategory: string;
  shotType: ShotTypeKey;
  extraNotes: string;
  poseReferenceManifest?: string;
  actionBodyCoverage?: string;
  actionAnalysis?: ActionReferenceAnalysis | null;
}) => {
  const {
    outputNumber,
    poseSourceMode,
    poseText,
    poseLabel,
    hasScene,
    hasActionReference,
    hasAccessoryReference,
    platformStyle,
    scenePrompt,
    productCategory,
    shotType,
    extraNotes,
    poseReferenceManifest,
    actionBodyCoverage,
    actionAnalysis,
  } = options;
  const shotPreset = SHOT_TYPE_OPTIONS.find((item) => item.key === shotType) || SHOT_TYPE_OPTIONS[0];
  const isManualShotType = shotType !== 'auto';

  const effectiveBodyCoverage = shotType === 'auto' ? actionBodyCoverage : undefined;
  const isLowerBodyAction = hasActionReference && effectiveBodyCoverage === 'lower_body';
  const isUpperBodyAction = hasActionReference && effectiveBodyCoverage === 'upper_body';
  const isCloseUpAction = hasActionReference && effectiveBodyCoverage === 'close_up';
  const requiresSceneCompatiblePose = hasActionReference && actionAnalysis?.poseTransferMode === 'scene_compatible';
  const supportRequirement = actionAnalysis?.supportRequirement;
  const forbiddenSceneElements = actionAnalysis?.forbiddenSceneElements?.length
    ? actionAnalysis.forbiddenSceneElements.join(', ')
    : 'walls, chairs, sofas, furniture, props, floors, windows, doors, railings, architecture, plants, lamps, background textures, or lighting from the action reference';
  const sceneCompatibleDirective = requiresSceneCompatiblePose
    ? `- AI SCENE-COMPATIBLE POSE TRANSFER: The action reference appears to depend on an external support object (${supportRequirement || 'unknown support'}). First inspect Image 1's original scene. If Image 1 already contains the same support class, use that existing Image 1 object/surface for the contact pose. For a wall-leaning reference, if Image 1 has a wall, wall panel, corner, door panel, curtain-side wall, or vertical background surface, the model should visibly lean against or touch that existing Image 1 wall/surface. If the existing support needs a small adjustment to make physical contact believable, extend/reposition/add a same-style support surface within Image 1's scene DNA, with matching material, lighting, perspective, and contact shadows. Do NOT remove the lean just because the action reference has a different wall. Do NOT import the action-reference wall/table/column/console/chair/sofa/railing/pedestal. If Image 1 truly lacks a compatible support, create only a minimal same-style support surface necessary for physics, or translate the action into a similar unsupported fashion pose while preserving body orientation, weight shift, limb angles, hand placement idea, leg relationship, crop, and camera framing.
- FORBIDDEN ACTION-SCENE ELEMENTS: ${forbiddenSceneElements}. These are contamination from the action reference, not output instructions.
${actionAnalysis?.sceneCompatibilityNote ? `- AI COMPATIBILITY NOTE: ${actionAnalysis.sceneCompatibilityNote}` : ''}`
    : '';

  return `
Create ONE photorealistic ecommerce fashion image for model pose fission output #${outputNumber}.

# IMAGE ROUTING
- Image 1 is the OVERALL MODEL REFERENCE and the highest-weight source: it already contains the correct model, worn product, styling, scene, lighting mood, camera feeling, and commercial visual direction.
- ${OVERALL_REFERENCE_SUPREMACY_LOCK}
- Preserve Image 1's person identity, face, hair, skin tone, body proportions, worn product, styling logic, lighting mood, color palette, and overall commercial look. Preserve the original scene DNA and recognizable room/set style, while allowing small physically necessary support-surface adjustments for the requested action. The action directive has zero authority over model identity, facial features, hair, skin tone, body build, or outfit/product identity.
- Optional model identity images after Image 1 may reinforce face/body consistency only.
- Optional product/garment images after Image 1 may reinforce garment structure, silhouette, color, fabric, seams, trim, print, pattern, and fit.
${hasAccessoryReference ? '- Optional accessory/styling reference images define bags, jewelry, hats, shoes, handheld props, and styling add-ons to integrate naturally with Image 1. Use them as matching references only; keep the main outfit and model identity from Image 1.' : ''}
${hasScene ? '- Scene reference images define the background/location identity, lighting mood, materials, and environment cues.' : '- No scene reference is uploaded. Build a clean commercial scene from the text instructions only.'}
${hasActionReference ? `- The uploaded action reference for this output is POSE BLUEPRINT ONLY: copy its pose, crop, camera distance, body angle, gesture, limb placement, subject scale, visible body extent, and framing. Do NOT copy its clothing, face, background, lighting, props, expression, model identity, scene style, wall/floor texture, or color palette.
- ${ACTION_POSE_PRIORITY_LOCK}
- ${ACTION_REFERENCE_BACKGROUND_LOCK}
${sceneCompatibleDirective}
${poseReferenceManifest || ''}` : ''}

# IDENTITY, PRODUCT AND SCENE CONSISTENCY LOCK
- The generated image must look like a same-shoot pose variation of Image 1.
- ABSOLUTE FACE LOCK: whenever the face/head is visible, it must be the same person from Image 1, not a prettier/new/random/action-reference face. Keep facial structure, feature spacing, jawline, nose, lips, eyes, eyebrows, hairline, hairstyle, skin tone, and age impression consistent.
- SCENE DNA LOCK: keep Image 1's background/location family, lighting direction, shadow logic, color temperature, lens mood, materials, and commercial atmosphere. Do not replace the room/set because of platform style, action reference, pose library, or AI analysis.
- PHYSICAL SUPPORT ADAPTATION: if the action needs support, the result must include believable contact, occlusion, and contact shadows. Prefer existing Image 1 surfaces/objects; if needed, add or reposition only minimal same-style support surfaces that look like they belong to Image 1. Do not copy action-reference furniture or architecture.
- EXISTING-SCENE SUPPORT RULE: if the action pose needs support and Image 1 already has a compatible support surface/object, use the existing Image 1 surface/object. Example: for a wall-leaning action reference, lean against the original wall/panel/background surface from Image 1; do not turn it into a floating unsupported pose.
${isLowerBodyAction 
  ? `- CAMERA CROP OVERRIDE: The pose reference specifies a lower body only shot. Therefore, you MUST crop out the model's head, face, neck, shoulders, chest, arms, and upper torso. Generate ONLY the lower body (waist-down / hip-down / legs and skirt/pants). DO NOT show any part of the model's head, face, neck, shoulders, collarbone, chest, breasts, or upper garments (no shirts, no sleeveless tops, no halter tops).
- Focus body consistency on the legs, lower torso, skin tone, and garment details (like the skirt/pants) from Image 1. Crop out and ignore any upper garments, halter tops, necklines, or head/hair features from Image 1.`
  : isUpperBodyAction
  ? `- CAMERA CROP OVERRIDE: The pose reference specifies an upper body only shot. Therefore, you MUST crop out the model's lower body, legs, and feet. Generate ONLY the upper body (waist-up / hip-up / chest-up). DO NOT show legs, feet, or shoes.
- Focus consistency on the face, hair, skin tone, and upper garment fit from Image 1.`
  : isCloseUpAction
  ? `- CAMERA CROP OVERRIDE: The pose reference specifies a close-up shot. Therefore, you MUST crop tightly on the model's face/chest/shoulders or specific garment detail, as shown in the reference. Do not generate a medium or full-body shot.`
  : `- The generated person must look like the exact same model from Image 1 in every output.
- Do not change face shape, facial proportions, eyes, nose, mouth, jawline, hair, skin tone, body size, age impression, ethnicity impression, beauty marks, or model identity.`}
- Preserve the worn product and scene DNA from Image 1 as the primary reference. Do not randomly change location family, background style, lighting mood, product color, product structure, styling, or outfit coordination.
- The output background must be derived from Image 1, uploaded scene references, or the written scene instruction only. Action reference images must never override or replace the existing background, but their physical action may require same-style support adaptation.
- Generate the new pose inside a scene that reads as the same Image 1 room/set. Minor same-style changes are allowed only to make the action physically plausible.
- If optional scene references are uploaded, use them only to reinforce or vary the scene direction requested by the user, while keeping the same-shoot plausibility from Image 1.

# FACE, EXPRESSION AND LENS FEEL
- ${NATURAL_EXPRESSION_LOCK}
- Facial expression may vary only subtly; the expression change must not alter the face identity or make the person look like the action-reference model.
- Keep expression diversity subtle and commercial across outputs; each result may have a slightly different natural mood, but the face must remain recognizably the same person.
- For close-up, portrait, headshot, or half-body framing, use realistic shallow depth of field with a softly blurred background while keeping the face, garment, and product details sharp.

# POSE DIRECTIVE
Pose source: ${poseSourceMode === 'reference' ? 'uploaded action reference image' : poseLabel}.
Pose instruction: ${poseText}
${hasActionReference ? `- ACTION REFERENCE MUST BE VISIBLY USED: the final body pose, silhouette, body orientation, hand/arm positions, leg/foot positions, camera crop, and person-to-frame scale must visibly match the assigned action reference, not Image 1's original pose.
- ORIGINAL-POSE REJECTION RULE: if the generated output still looks like Image 1's original pose, original crop, or original subject placement, treat it as incorrect and regenerate internally toward the action reference.` : ''}
- ${POSE_FISSION_DIVERSITY_DIRECTIVE}
- The pose change must be obvious at thumbnail size. Preserve garment readability by adapting the clothing naturally onto the new body geometry, not by shrinking the pose change.

# PRODUCT, PLATFORM AND SCENE
- Platform visual DNA: ${platformStyle}
- Product category: ${productCategory || 'fashion apparel'}.
- Scene instruction: ${scenePrompt || 'clean professional ecommerce fashion photography, natural commercial lighting'}.
- Shot type preset: ${shotPreset.label}. ${shotPreset.prompt}
- SHOT TYPE LOCK: Treat the selected shot type as a hard framing rule, not a soft style note. If user text says close-up/detail, obey this structured preset over generic pose-library full-body tendencies. ${isManualShotType ? MANUAL_SHOT_OVERRIDE_LOCK : hasActionReference ? 'In auto mode, an uploaded action reference may guide the crop and camera distance for that output.' : ''}
${shotType === 'closeup' || isCloseUpAction ? '- CLOSE-UP HARD RULE: the final image must NOT be full-body, head-to-toe, knee-up, or full-dress. Crop tightly from face/chin/neck to chest or upper torso, or tighter on the requested garment area. The waist, hips, legs, feet, and full skirt/dress length must be outside the frame unless explicitly requested by the user.' : ''}
${shotType === 'macro' ? '- MACRO HARD RULE: the final image must be a tight garment-detail crop. Do not show the full person, full outfit, complete face portrait, full dress length, legs, or feet.' : ''}
${shotType === 'medium' || isUpperBodyAction ? '- MEDIUM SHOT HARD RULE: the final image must be waist-up or hip-up. Do not show the full body, feet, or head-to-toe outfit.' : ''}
- Keep the garment naturally worn on the model. No flat-lay, no mannequin, no standalone product shot.
- If accessory/styling references are uploaded, add them only when they look natural for the pose and platform. Keep scale, placement, and material believable; do not let accessories cover important garment details.
- If the scene or pose conflicts with product fidelity, preserve product identity and adapt the garment naturally to the pose.

# USER NOTES
${extraNotes || 'No extra notes.'}

# NEGATIVE
${isLowerBodyAction 
  ? 'unchanged original image, same pose as Image 1, original Image 1 standing pose, ignored action reference, weak pose change, head, face, eyes, mouth, hair, shoulders, neck, collarbone, upper chest, breasts, cleavage, upper garment, halter top, sleeves, t-shirt, shirt, changed skin tone, changed body shape, copied model-reference background, copied action-reference background, action-reference scene transfer, action-reference wall or floor, action-reference lighting, copied action-reference clothing, copied action-reference props, wrong garment, changed color, changed fabric, missing seams, poorly integrated accessories, oversized accessories, accessories covering garment, extra people, two models, collage, split screen, text, watermark, logo, distorted hands, broken limbs, unnatural anatomy, blurry product details'
  : isUpperBodyAction
  ? 'unchanged original image, same pose as Image 1, original Image 1 standing pose, ignored action reference, weak pose change, legs, knees, feet, shoes, pants, skirt, lower body, full body, head-to-toe, wrong person, identity drift, changed face, changed facial features, changed eyes, changed nose, changed mouth, changed jawline, changed hair, changed skin tone, changed body shape, stiff expression, forced smile, frozen smile, exaggerated grin, doll face, copied model-reference background, copied action-reference background, action-reference scene transfer, action-reference wall or floor, action-reference lighting, copied action-reference clothing, copied action-reference props, wrong garment, changed color, changed fabric, missing seams, poorly integrated accessories, oversized accessories, accessories covering garment, extra people, two models, collage, split screen, text, watermark, logo, distorted hands, broken limbs, unnatural anatomy, blurry face, blurry product details'
  : 'unchanged original image, same pose as Image 1, original Image 1 standing pose, ignored action reference, weak pose change, same arm placement as Image 1, same leg stance as Image 1, same torso direction as Image 1, wrong person, identity drift, changed face, changed facial features, changed eyes, changed nose, changed mouth, changed jawline, changed hair, changed skin tone, changed body shape, stiff expression, forced smile, frozen smile, exaggerated grin, doll face, copied model-reference background, copied action-reference background, action-reference scene transfer, action-reference wall or floor, action-reference lighting, copied action-reference clothing, copied action-reference props, wrong garment, changed color, changed fabric, missing seams, poorly integrated accessories, oversized accessories, accessories covering garment, extra people, two models, collage, split screen, text, watermark, logo, distorted hands, broken limbs, unnatural anatomy, blurry face, blurry product details'}${shotPreset.negative ? `, ${shotPreset.negative}` : ''}.
`.trim();
};

const UploadCard: React.FC<{
  title: string;
  desc: string;
  icon: React.ReactNode;
  images: UploadedImage[];
  max: number;
  multiple?: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
}> = ({ title, desc, icon, images, max, multiple = true, onUpload, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const handleFiles = (files?: FileList | null) => {
    if (files) onUpload(Array.from(files));
  };

  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      if (!isActive) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        onUpload(files);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isActive, onUpload]);

  return (
    <div className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 text-pastel-highlight">{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-pastel-text">{title}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-pastel-muted">{desc}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
          {images.length}/{max}
        </span>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        tabIndex={0}
        className={`min-h-[6.5rem] cursor-pointer rounded-xl border-2 border-dashed p-3 transition-all outline-none ${
          isDragging || isActive ? 'border-pastel-highlight bg-orange-50/60 ring-2 ring-orange-100 shadow-sm' : 'border-pastel-border bg-pastel-bg/30 hover:border-orange-200'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        {images.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {images.map((image) => (
              <div 
                key={image.id} 
                title={image.poseAnalysis ? `景别: ${image.poseAnalysis.shotType}\n视角: ${image.poseAnalysis.shootingAngle}\n姿势: ${image.poseAnalysis.poseDescription}\n裁剪: ${image.poseAnalysis.cropRange}\n范围: ${image.poseAnalysis.bodyCoverage === 'lower_body' ? '仅下半身' : image.poseAnalysis.bodyCoverage === 'upper_body' ? '仅上半身' : image.poseAnalysis.bodyCoverage === 'full_body' ? '全身' : image.poseAnalysis.bodyCoverage === 'close_up' ? '特写' : '其他'}${image.poseAnalysis.reasoning ? `\n分析理由: ${image.poseAnalysis.reasoning}` : ''}` : undefined}
                className="group relative overflow-hidden rounded-lg border border-pastel-border bg-white"
              >
                <img src={image.preview} alt={title} className="h-20 w-full object-cover" />
                {image.isAnalyzing && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-1">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    <span className="text-[8px] font-bold text-purple-700 mt-0.5 scale-90">分析中...</span>
                  </div>
                )}
                {image.poseAnalysis && (
                  <div className="absolute bottom-0 left-0 right-0 bg-purple-900/75 text-white text-[8px] px-1 py-0.5 font-bold truncate text-center scale-90 origin-bottom" title={`${image.poseAnalysis.shotType} | ${image.poseAnalysis.shootingAngle}`}>
                    {image.poseAnalysis.shotType} | {image.poseAnalysis.shootingAngle}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(image.id);
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < max && (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-pastel-border text-pastel-muted">
                <Upload className="h-4 w-4" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[4.75rem] flex-col items-center justify-center text-center">
            <Upload className="mb-1 h-7 w-7 text-pastel-muted" />
            <p className="text-xs font-bold text-pastel-text">
              {isActive ? '粘贴 (Ctrl+V) 或拖拽上传' : '点击、拖拽或粘贴上传'}
            </p>
            <p className="mt-0.5 text-[10px] text-pastel-muted">
              {isActive ? '已激活，可直接 Ctrl+V 粘贴图片' : '支持 JPG / PNG / WebP，支持粘贴'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ModelPoseFissionTab: React.FC = () => {
  const [overallImages, setOverallImages] = useState<UploadedImage[]>([]);
  const [modelImages, setModelImages] = useState<UploadedImage[]>([]);
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [sceneImages, setSceneImages] = useState<UploadedImage[]>([]);
  const [actionImages, setActionImages] = useState<UploadedImage[]>([]);
  const [accessoryImages, setAccessoryImages] = useState<UploadedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>('shein');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [outputFormat, setOutputFormat] = useState<OutputImageFormat>('png');
  const [shotType, setShotType] = useState<ShotTypeKey>('auto');
  const [colorCorrectionMode, setColorCorrectionMode] = useState<ColorCorrectionMode>('off');
  const [colorReferenceImages, setColorReferenceImages] = useState<UploadedImage[]>([]);
  const [colorCorrectionBlend, setColorCorrectionBlend] = useState(0.85);
  const [poseSourceMode, setPoseSourceMode] = useState<PoseSourceMode>('random');
  const [poseLibraryKey, setPoseLibraryKey] = useState<PoseLibraryKey>('clothing');
  const [selectedPoseId, setSelectedPoseId] = useState('');
  const [generateCount, setGenerateCount] = useState(4);
  const [productCategory, setProductCategory] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [regeneratingIndices, setRegeneratingIndices] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [cropEditor, setCropEditor] = useState<CropEditorState | null>(null);
  const [cropMeta, setCropMeta] = useState<CropImageMeta | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 50, y: 50 });
  const regenerateControllersRef = useRef<Map<number, AbortController>>(new Map());
  const recentPoseIdsRef = useRef<Record<string, string[]>>({});
  const actionAnalysisPromisesRef = useRef<Map<string, Promise<ActionReferenceAnalysis | null>>>(new Map());
  const actionAnalysesRef = useRef<Map<string, ActionReferenceAnalysis | null>>(new Map());
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const activeLibrary = useMemo(() => getLibrary(poseLibraryKey), [poseLibraryKey]);
  const activePlatform = useMemo(() => PLATFORM_STYLES.find((platform) => platform.key === selectedPlatform) || PLATFORM_STYLES[1], [selectedPlatform]);
  const manualPose = activeLibrary.poses.find((pose) => pose.id === selectedPoseId) || activeLibrary.poses[0];
  const effectivePoseMode: PoseSourceMode = actionImages.length > 0 ? 'reference' : poseSourceMode;
  const effectiveGenerateCount = actionImages.length > 0 ? actionImages.length : generateCount;
  const isRegeneratingAny = regeneratingIndices.length > 0;

  useEffect(() => {
    if (!cropEditor) {
      setCropMeta(null);
      return;
    }

    let isMounted = true;
    setCropMeta(null);
    setCropZoom(1);
    setCropPosition({ x: 50, y: 50 });
    loadHtmlImage(cropEditor.imageUrl)
      .then((image) => {
        if (!isMounted) return;
        setCropMeta({
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setError('裁剪图片读取失败，请重新生成或下载原图。');
        setCropEditor(null);
      });

    return () => {
      isMounted = false;
    };
  }, [cropEditor]);

  const analyzeActionReferenceImage = async (
    image: UploadedImage
  ): Promise<ActionReferenceAnalysis | null> => {
    if (!image.base64 || !image.mime) return null;

    try {
      const ai = getAiClient();
      const response = await generateContentWithAnalysisFallback(ai, {
        model: 'gemini-3.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: image.mime, data: image.base64 } },
            {
              text: `Analyze this image as an action/pose reference for a fashion ecommerce image-generation workflow.

Your goal is to extract the camera framing (shot type), shooting angle, body crop range, pose description, and whether the pose depends on scene support objects. The image generator must preserve the target model's original scene DNA. Any wall/chair/sofa/furniture in this action reference is NOT allowed to transfer directly, but the generator may create a small same-style support surface in the target scene if needed for believable physical contact.

Return ONLY a valid JSON object with these exact keys:
{
  "reasoning": "A step-by-step reasoning string. Audit these questions: 1. Is the model's head/face/hair visible in the image? 2. Is the model's neck, shoulders, collarbone, chest, or arms visible? 3. Which part of the body is visible in the frame? (e.g., 'Only the waist down is visible, displaying the skirt; head, shoulders, chest, and arms are completely cropped out').",
  "bodyCoverage": "Based on the reasoning above, choose EXACTLY one of: 'full_body' (head to toe visible), 'upper_body' (upper body from waist/hips up is visible, including head/face), 'lower_body' (only the waist, hips, legs, or feet are visible; the head, face, neck, shoulders, chest, and arms are completely cropped out), 'close_up' (tight crop on face, neck, or chest detail), or 'other'. If the image shows only a skirt/pants/legs and has no head/face/chest, it MUST be 'lower_body'.",
  "supportRequirement": "Choose EXACTLY one of: 'none', 'wall', 'chair', 'sofa', 'floor', 'railing', or 'unknown'. Use 'wall' if the pose is leaning on or visibly supported by a wall. Use 'chair' or 'sofa' if the pose is seated on or supported by that object. Use 'none' only if the pose can be reproduced without adding any object from the action reference.",
  "poseTransferMode": "Choose EXACTLY one of: 'exact' or 'scene_compatible'. Use 'scene_compatible' when the reference pose depends on a wall, chair, sofa, floor pose, railing, furniture, or any support object that should not be copied into the target model scene. Use 'exact' when the pose can be replicated without importing the action-reference environment.",
  "sceneCompatibilityNote": "If poseTransferMode is 'scene_compatible', describe how to translate the pose while keeping the target model's original scene DNA. Prefer mapping support contact onto the same type of object/surface if it exists in the target scene. If support is needed but not clearly available, allow a minimal same-style support surface so the body does not float. Examples: 'keep the side lean and hand placement; if the target scene has a wall or vertical panel, lean against that existing wall, otherwise create a subtle matching wall/panel surface with contact shadow'; 'keep seated leg crossing and torso angle, but if no seat exists in the target scene, add only a minimal same-style seat edge if it fits the room, otherwise convert into a standing fashion pose with similar crossed-leg silhouette'. If exact, return an empty string.",
  "forbiddenSceneElements": "Array of short English nouns naming action-reference environment elements that must NOT transfer, such as ['wall', 'sofa', 'chair', 'window', 'floor texture', 'lamp']. Return [] if no forbidden environment elements are visible.",
  "shotType": "Specify the exact shot type in English. If it is only the lower body, you MUST specify 'lower body shot / waist-down crop'. Otherwise, choose from: 'close-up shot', 'medium shot / waist-up', 'three-quarter shot / knee-up', 'full body shot / head-to-toe'.",
  "shootingAngle": "Specify the camera angle/direction relative to the model (e.g., 'eye-level front view', 'low-angle three-quarter view', 'high-angle side profile view', 'eye-level back view')",
  "poseDescription": "A concise English description of the model's pose, gesture, hand placements, and body rotation (e.g., 'standing with right hand on hip, left arm hanging naturally, body slightly rotated to the left')",
  "cropRange": "Describe exactly where the frame cuts off the model's body (e.g., 'cropped from waist down, showing only legs and skirt; head and upper torso are completely cut off', 'cropped at the chest, showing only upper torso', 'full body from head to toes, shoes fully visible')",
  "promptBlock": "A compiled, highly descriptive English prompt fragment specifying framing, camera distance, camera angle, and pose in detail. Use clear and imperative language."
}

Rules:
- Focus ONLY on framing, crop, camera angle, pose, and support-object dependency.
- Ignore and do NOT describe clothing, face identity, gender, age, skin tone, hair, lighting, or color palette.
- Do identify environment/support objects only for the supportRequirement and forbiddenSceneElements fields.`
            }
          ]
        }
      });

      const raw = (response.text || '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(raw) as ActionReferenceAnalysis;
      if (!Array.isArray(parsed.forbiddenSceneElements)) {
        parsed.forbiddenSceneElements = [];
      }
      return parsed;
    } catch (err) {
      console.error('Action reference analysis failed:', err);
      return null;
    }
  };

  const ensureActionReferenceAnalysis = async (image: UploadedImage): Promise<ActionReferenceAnalysis | null> => {
    if (image.poseAnalysis) return image.poseAnalysis;
    if (actionAnalysesRef.current.has(image.id)) {
      return actionAnalysesRef.current.get(image.id) || null;
    }

    const existingPromise = actionAnalysisPromisesRef.current.get(image.id);
    if (existingPromise) {
      const existingAnalysis = await existingPromise;
      actionAnalysesRef.current.set(image.id, existingAnalysis);
      return existingAnalysis;
    }

    const promise = analyzeActionReferenceImage(image);
    actionAnalysisPromisesRef.current.set(image.id, promise);
    const analysis = await promise;
    actionAnalysesRef.current.set(image.id, analysis);
    actionAnalysisPromisesRef.current.delete(image.id);
    setActionImages((prev) =>
      prev.map((item) =>
        item.id === image.id
          ? { ...item, isAnalyzing: false, poseAnalysis: analysis || undefined }
          : item
      )
    );
    return analysis;
  };

  const getCachedActionAnalysis = (image?: UploadedImage) => {
    if (!image) return null;
    return image.poseAnalysis || actionAnalysesRef.current.get(image.id) || null;
  };

  const addImages = async (
    files: File[],
    setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>,
    max: number,
    replace = false,
    kind?: UploadKind
  ) => {
    const validFiles = files.filter((file) => file.type.startsWith('image/'));
    const compressed = await Promise.all(
      validFiles.map(async (file) => {
        const data = await compressImage(file, 1800, 0.92);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          preview: URL.createObjectURL(file),
          base64: data.base64,
          mime: data.mime,
          isAnalyzing: kind === 'action',
        };
      })
    );
    setter((prev) => [...(replace ? [] : prev), ...compressed].slice(0, max));
    setError('');

    if (kind === 'action') {
      for (const img of compressed) {
        const promise = analyzeActionReferenceImage(img);
        actionAnalysisPromisesRef.current.set(img.id, promise);
        promise.then((analysis) => {
          actionAnalysesRef.current.set(img.id, analysis);
          actionAnalysisPromisesRef.current.delete(img.id);
          setter((prev) =>
            prev.map((item) => {
              if (item.id === img.id) {
                return {
                  ...item,
                  isAnalyzing: false,
                  poseAnalysis: analysis || undefined,
                };
              }
              return item;
            })
          );
        });
      }
    }
  };

  const removeImage = (kind: MainReferenceKind, id: string) => {
    const removeFrom = (setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>) => {
      setter((prev) => {
        const target = prev.find((image) => image.id === id);
        if (target?.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview);
        return prev.filter((image) => image.id !== id);
      });
    };
    if (kind === 'overall') removeFrom(setOverallImages);
    if (kind === 'model') removeFrom(setModelImages);
    if (kind === 'product') removeFrom(setProductImages);
    if (kind === 'scene') removeFrom(setSceneImages);
    if (kind === 'action') removeFrom(setActionImages);
    if (kind === 'accessory') removeFrom(setAccessoryImages);
    if (kind === 'color') removeFrom(setColorReferenceImages);
    if (kind === 'action') {
      actionAnalysisPromisesRef.current.delete(id);
      actionAnalysesRef.current.delete(id);
    }
    setResults([]);
  };

  const getPoseForOutput = (index: number, batchCache: Map<PoseLibraryKey, PosePreset[]> = new Map()) => {
    if (actionImages.length > 0 && index < actionImages.length) {
      const actionImage = actionImages[index];
      const poseAnalysis = getCachedActionAnalysis(actionImage);
      const useActionFraming = shotType === 'auto';
      let promptText = useActionFraming
        ? 'Match the uploaded action reference image only for pose, gesture, camera distance, crop boundary, subject scale, body angle, and visible body extent. Ignore its background, lighting, clothing, props, face, hair, and expression completely.'
        : 'Use the uploaded action reference image only for pose geometry, gesture, body angle, and limb placement. Do NOT follow its camera distance, crop boundary, subject scale, or visible body extent because the user-selected shot type overrides all reference framing. Ignore its background, lighting, clothing, props, face, hair, and expression completely.';
      if (poseAnalysis) {
        const pa = poseAnalysis;
        const sceneModeNote = pa.poseTransferMode === 'scene_compatible'
          ? ` Scene-compatible transfer required because the pose depends on ${pa.supportRequirement || 'external support'}; keep the target scene unchanged and do not add action-reference support objects. ${pa.sceneCompatibilityNote || ''}`
          : '';
        promptText = useActionFraming
          ? `Match the uploaded action reference image only for pose geometry and camera framing. Ignore its background, lighting, clothing, props, face, hair, and expression completely.${sceneModeNote} [AI ANALYSIS]: Camera crop is ${pa.shotType} (${pa.cropRange}), camera angle is ${pa.shootingAngle}, pose is ${pa.poseDescription}. Prompt constraint: ${pa.promptBlock}`
          : `Use the uploaded action reference image only for pose geometry, gesture, body angle, and limb placement. Do NOT follow its detected crop or camera distance because the user-selected shot type overrides all reference framing. Ignore its background, lighting, clothing, props, face, hair, and expression completely.${sceneModeNote} [AI ANALYSIS FOR POSE ONLY]: camera angle is ${pa.shootingAngle}, pose is ${pa.poseDescription}. Pose constraint only: ${pa.promptBlock}`;
      }
      return {
        label: `动作参考图 #${index + 1}${actionImage.poseAnalysis ? ` (${actionImage.poseAnalysis.shotType})` : ''}`,
        prompt: promptText,
      };
    }
    if (poseSourceMode === 'manual') {
      return {
        label: `${activeLibrary.label} / ${manualPose?.name || '指定动作'}`,
        prompt: manualPose?.prompt || 'professional ecommerce fashion pose',
      };
    }
    const pose = pickDiversePose(activeLibrary.key, activeLibrary.poses, batchCache, recentPoseIdsRef) || activeLibrary.poses[0];
    return {
      label: `${activeLibrary.label} / 随机动作 ${pose?.id || index + 1}`,
      prompt: pose?.prompt || 'varied professional ecommerce fashion pose',
    };
  };

  const buildInputsForOutput = async (index: number) => {
    const inputs = [
      ...overallImages.map(toApiImage),
      ...modelImages.map(toApiImage),
      ...productImages.map(toApiImage),
      ...accessoryImages.map(toApiImage),
      ...sceneImages.map(toApiImage),
    ];
    let poseReferenceManifest = '';
    if (actionImages.length > 0 && index < actionImages.length) {
      const actionImage = actionImages[index];
      const poseAnalysis = getCachedActionAnalysis(actionImage);
      const actionImageNumber = inputs.length + 1;
      inputs.push(toApiImage(actionImage));

      let analysisManifest = '';
      if (poseAnalysis) {
        const pa = poseAnalysis;
        const bodyCoveragePrompt = pa.bodyCoverage ? `\n- BODY COVERAGE: ${pa.bodyCoverage}` : '';
        const supportPrompt = pa.supportRequirement ? `\n- SUPPORT DEPENDENCY: ${pa.supportRequirement}` : '';
        const sceneCompatibilityPrompt = pa.poseTransferMode === 'scene_compatible'
          ? `\n- SCENE-COMPATIBLE TRANSFER MODE: The reference pose depends on ${pa.supportRequirement || 'external support'}, but the output must keep Image 1's scene DNA. If Image 1 already has a compatible support surface/object, use that existing Image 1 support for the pose contact. For wall support, lean/touch the original Image 1 wall/panel/vertical surface when visible. If physical contact would otherwise float, add or shift only a minimal same-style support surface with matching perspective, lighting, and contact shadows. Do not add support objects from the action reference. ${pa.sceneCompatibilityNote || ''}`
          : '';
        const forbiddenPrompt = pa.forbiddenSceneElements?.length
          ? `\n- FORBIDDEN ACTION-REFERENCE SCENE ELEMENTS: ${pa.forbiddenSceneElements.join(', ')}`
          : '';
        analysisManifest = shotType === 'auto'
          ? `
[AI POSE REFERENCE ANALYSIS FOR IMAGE ${actionImageNumber}]:
- CAMERA SHOT TYPE / FRAMING: ${pa.shotType} (Crop boundaries: ${pa.cropRange})${bodyCoveragePrompt}${supportPrompt}${sceneCompatibilityPrompt}${forbiddenPrompt}
- CAMERA ANGLE & DIRECTION: ${pa.shootingAngle}
- BODY POSE & ANATOMY DETAIL: ${pa.poseDescription}
- STRUCTURAL PROMPT BLOCK: ${pa.promptBlock}
- EXPLICIT ACTION ALIGNMENT DIRECTIVE:
  Generate output #${index + 1} using EXACTLY the framing specified above. If the analysis shows a "${pa.shotType}" (such as a medium shot, close-up, or waist-up), you MUST NOT generate a full-body view or far shot. Align the camera distance and framing tightly to the detected crop: ${pa.cropRange}. Replicate the camera angle "${pa.shootingAngle}" and follow the detailed pose geometry described in "${pa.poseDescription}".`
          : `
[AI POSE REFERENCE ANALYSIS FOR IMAGE ${actionImageNumber} - POSE ONLY]:
- IGNORE CAMERA SHOT TYPE / FRAMING: detected crop was ${pa.shotType} (${pa.cropRange}), but the user-selected shot type overrides this.${supportPrompt}${sceneCompatibilityPrompt}${forbiddenPrompt}
- CAMERA ANGLE & DIRECTION CAN INFORM BODY ORIENTATION ONLY: ${pa.shootingAngle}
- BODY POSE & ANATOMY DETAIL: ${pa.poseDescription}
- STRUCTURAL PROMPT BLOCK FOR POSE ONLY: ${pa.promptBlock}
- EXPLICIT MANUAL SHOT OVERRIDE DIRECTIVE:
  Generate output #${index + 1} with the selected shot type, not with the action reference crop. Do NOT use the action reference camera distance, subject scale, visible body extent, or crop boundary.`;
      }

      try {
        const hasSupportContaminationRisk = poseAnalysis?.poseTransferMode === 'scene_compatible' || (!!poseAnalysis?.supportRequirement && poseAnalysis.supportRequirement !== 'none');
        const lineart = await extractEdges(getDataUrl(actionImage));
        const lineartImageNumber = inputs.length + 1;
        inputs.push(dataUrlToApiImage(lineart));
        if (hasSupportContaminationRisk) {
          poseReferenceManifest = `[ACTION BLUEPRINT MANIFEST]: Image ${actionImageNumber} is the original action/pose reference. Image ${lineartImageNumber} is its lineart/silhouette companion. Because this action reference may contain support props or new scene elements, do NOT repeat or strengthen action-reference pixels. Use these action blueprint images ONLY for human pose geometry, gesture, body angle, limb placement${shotType === 'auto' ? ', plus crop boundary, camera distance, subject scale, visible body extent, and framing' : '; do NOT use their crop boundary, camera distance, subject scale, visible body extent, or framing'}. Do NOT copy action-reference support objects, furniture, wall, chair, sofa, console, column, pedestal, railing, floor texture, lighting, or scene. If support is physically needed, create or reposition only a minimal same-style support surface within Image 1's scene DNA, with believable contact and shadows.${analysisManifest}`;
        } else {
          const actionReinforcementImageNumber = inputs.length + 1;
          inputs.push(toApiImage(actionImage));
          const lineartReinforcementImageNumber = inputs.length + 1;
          inputs.push(dataUrlToApiImage(lineart));
          poseReferenceManifest = `[ACTION BLUEPRINT MANIFEST]: Image ${actionImageNumber} is the original action/pose reference. Image ${lineartImageNumber} is its lineart/silhouette companion. Images ${actionReinforcementImageNumber}-${lineartReinforcementImageNumber} repeat the same action blueprint as high-priority pose anchors so the generator must not fall back to Image 1's original pose. Use these action blueprint images ONLY for pose geometry, gesture, body angle, limb placement${shotType === 'auto' ? ', plus crop boundary, camera distance, subject scale, visible body extent, and framing' : '; do NOT use their crop boundary, camera distance, subject scale, visible body extent, or framing'}. Do NOT use repeated action images for identity, clothing, background, support objects, lighting, props, wall, chair, sofa, floor texture, or scene.${analysisManifest}`;
        }
      } catch (error) {
        console.warn('Failed to extract action reference lineart. Using original pose image only.', error);
        const hasSupportContaminationRisk = poseAnalysis?.poseTransferMode === 'scene_compatible' || (!!poseAnalysis?.supportRequirement && poseAnalysis.supportRequirement !== 'none');
        if (hasSupportContaminationRisk) {
          poseReferenceManifest = `[ACTION BLUEPRINT MANIFEST]: Image ${actionImageNumber} is the original action/pose reference. Because this action reference may contain support props or new scene elements, use it ONLY for human pose geometry, gesture, body angle, and limb placement${shotType === 'auto' ? ', plus crop boundary, camera distance, subject scale, visible body extent, and framing' : '; do NOT use its crop boundary, camera distance, subject scale, visible body extent, or framing'}. Do NOT copy action-reference support objects, furniture, wall, chair, sofa, console, column, pedestal, railing, floor texture, lighting, or scene. If support is physically needed, create or reposition only a minimal same-style support surface within Image 1's scene DNA, with believable contact and shadows.${analysisManifest}`;
        } else {
          const actionReinforcementImageNumber = inputs.length + 1;
          inputs.push(toApiImage(actionImage));
          poseReferenceManifest = `[ACTION BLUEPRINT MANIFEST]: Images ${actionImageNumber} and ${actionReinforcementImageNumber} are repeated copies of the original action/pose reference as high-priority pose anchors so the generator must not fall back to Image 1's original pose. Use them ONLY for pose geometry, gesture, body angle, and limb placement${shotType === 'auto' ? ', plus crop boundary, camera distance, subject scale, visible body extent, and framing' : '; do NOT use their crop boundary, camera distance, subject scale, visible body extent, or framing'}. Do NOT use repeated action images for identity, clothing, background, support objects, lighting, props, wall, chair, sofa, floor texture, or scene.${analysisManifest}`;
        }
      }
    }
    return { inputs, poseReferenceManifest };
  };

  const generateOne = async (index: number, signal?: AbortSignal, plannedPose = getPoseForOutput(index)): Promise<ResultItem> => {
    const hasActionReference = actionImages.length > 0 && index < actionImages.length;
    const actionAnalysis = hasActionReference ? await ensureActionReferenceAnalysis(actionImages[index]) : null;
    const pose = hasActionReference ? getPoseForOutput(index) : plannedPose;
    const { inputs, poseReferenceManifest } = await buildInputsForOutput(index);
    const prompt = buildPrompt({
      outputNumber: index + 1,
      poseSourceMode: hasActionReference ? 'reference' : poseSourceMode,
      poseText: pose.prompt,
      poseLabel: pose.label,
      hasScene: sceneImages.length > 0 || overallImages.length > 0,
      hasActionReference,
      hasAccessoryReference: accessoryImages.length > 0,
      platformStyle: activePlatform.prompt,
      scenePrompt,
      productCategory,
      shotType,
      extraNotes,
      poseReferenceManifest,
      actionBodyCoverage: actionAnalysis?.bodyCoverage || getCachedActionAnalysis(actionImages[index])?.bodyCoverage,
      actionAnalysis: actionAnalysis || getCachedActionAnalysis(actionImages[index]),
    });
    const [imageUrl] = await generateImageToImage(inputs, prompt, {
      aspectRatio,
      resolution,
      modelId: selectedModel,
      workflowHint: hasActionReference ? 'pose-replication-lock' : 'pose-fission',
      hasModelRef: true,
      signal,
    });
    if (!imageUrl) throw new Error('模型未返回图片');
    const correctedImageUrl = await applyColorCorrection(imageUrl, {
      mode: colorCorrectionMode,
      reference: colorReferenceImages[0] ? getDataUrl(colorReferenceImages[0]) : undefined,
      blend: colorCorrectionBlend,
    });
    const formattedImageUrl = await convertImageDataUrlFormat(correctedImageUrl, outputFormat);
    return { id: `${Date.now()}-${index}`, imageUrl: formattedImageUrl, status: 'done', prompt, poseLabel: pose.label };
  };

  const handleRegenerateOne = async (index: number) => {
    if (overallImages.length === 0) {
      setError('Please upload the main model reference image first.');
      return;
    }
    if (regenerateControllersRef.current.has(index)) return;

    const controller = new AbortController();
    regenerateControllersRef.current.set(index, controller);
    const plannedPose = getPoseForOutput(index);
    setError('');
    setRegeneratingIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
    setResults((prev) => prev.map((item, idx) => (
      idx === index
        ? { ...item, status: 'generating', error: undefined, poseLabel: plannedPose.label }
        : item
    )));

    try {
      const item = await generateOne(index, controller.signal, plannedPose);
      if (controller.signal.aborted) return;
      setResults((prev) => {
        const next = [...prev];
        next[index] = item;
        return next;
      });
    } catch (itemError) {
      if (!isAbortError(itemError)) {
        const message = getErrorMessage(itemError);
        setResults((prev) => {
          const next = [...prev];
          next[index] = { ...(next[index] || { id: `error-${index}`, imageUrl: null, prompt: '', poseLabel: plannedPose.label }), status: 'error', imageUrl: null, error: message };
          return next;
        });
      }
    } finally {
      regenerateControllersRef.current.delete(index);
      setRegeneratingIndices((prev) => prev.filter((item) => item !== index));
    }
  };

  const handleGenerate = async (regenerateIndex?: number) => {
    if (regenerateIndex !== undefined) {
      await handleRegenerateOne(regenerateIndex);
      return;
    }
    if (overallImages.length === 0) {
      setError('请先上传模特整体参考图，用于锁定已换好产品和场景的完整效果。');
      return;
    }
    setError('');
    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setRegeneratingIndex(regenerateIndex ?? null);
    const total = regenerateIndex !== undefined ? 1 : effectiveGenerateCount;
    const indices = regenerateIndex !== undefined ? [regenerateIndex] : Array.from({ length: total }, (_, index) => index);
    const poseBatchCache = new Map<PoseLibraryKey, PosePreset[]>();
    const plannedPoses = new Map(indices.map((index) => [index, getPoseForOutput(index, poseBatchCache)]));
    if (regenerateIndex === undefined) {
      setResults(Array.from({ length: total }, (_, index) => ({
        id: `pending-${index}`,
        imageUrl: null,
        status: 'pending',
        prompt: '',
        poseLabel: plannedPoses.get(index)?.label || getPoseForOutput(index).label,
      })));
    } else {
      setResults((prev) => prev.map((item, idx) => (idx === regenerateIndex ? { ...item, status: 'generating', error: undefined, poseLabel: plannedPoses.get(idx)?.label || item.poseLabel } : item)));
    }

    const generated: ResultItem[] = [];
    try {
      for (const index of indices) {
        assertCurrentGenerationTask(taskId, signal);
        setStatusMessage(`正在生成第 ${index + 1} 张 / 共 ${regenerateIndex !== undefined ? results.length || 1 : total} 张...`);
        setResults((prev) => prev.map((item, idx) => (idx === index ? { ...item, status: 'generating', poseLabel: plannedPoses.get(index)?.label || item.poseLabel } : item)));
        try {
          const item = await generateOne(index, signal, plannedPoses.get(index));
          assertCurrentGenerationTask(taskId, signal);
          generated.push(item);
          setResults((prev) => {
            const next = [...prev];
            next[index] = item;
            return next;
          });
        } catch (itemError) {
          const message = getErrorMessage(itemError);
          setResults((prev) => {
            const next = [...prev];
            next[index] = { ...(next[index] || { id: `error-${index}`, imageUrl: null, prompt: '', poseLabel: `#${index + 1}` }), status: 'error', imageUrl: null, error: message };
            return next;
          });
          if (regenerateIndex !== undefined) throw itemError;
        }
      }
      assertCurrentGenerationTask(taskId, signal);
      if (generated.length > 0) {
        await saveGeneratedProject({
          type: 'MODEL',
          generated: generated.map((item) => item.imageUrl!).filter(Boolean),
          original: [
            ...overallImages.map(getDataUrl),
            ...modelImages.map(getDataUrl),
            ...productImages.map(getDataUrl),
            ...accessoryImages.map(getDataUrl),
            ...sceneImages.map(getDataUrl),
            ...actionImages.map(getDataUrl),
          ],
          prompt: generated[0].prompt,
          params: {
            subType: 'model_pose_fission',
            referenceMode: 'overall_model_scene_product',
            aspectRatio,
            resolution,
            model: selectedModel,
            platform: activePlatform.label,
            outputFormat,
            shotType: SHOT_TYPE_OPTIONS.find((item) => item.key === shotType)?.label || shotType,
            poseSourceMode: effectivePoseMode,
            poseLibrary: activeLibrary.label,
            productCategory,
            scenePrompt,
            extraNotes,
          },
          thumbnail: generated[0].imageUrl || undefined,
        });
      }
      setStatusMessage('生成完成');
    } catch (err) {
      if (!isAbortError(err)) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (!isCurrentGenerationTask(taskId)) {
        return;
      }
      finishGenerationTask(taskId);
      setIsGenerating(false);
      setRegeneratingIndex(null);
    }
  };

  const handleCancelGenerate = () => {
    cancelGenerationTask();
    setStatusMessage('已中止生成');
    setIsGenerating(false);
    setRegeneratingIndex(null);
    setResults((prev) => prev.map((item) => (
      item.status === 'generating' || item.status === 'pending'
        ? { ...item, status: item.imageUrl ? 'done' : 'error', error: item.imageUrl ? undefined : '已中止生成' }
        : item
    )));
  };

  const handleDownload = async (img: string, idx: number) => {
    const formattedImage = await convertImageDataUrlFormat(img, outputFormat);
    const link = document.createElement('a');
    link.href = formattedImage;
    link.download = `model-pose-fission-${Date.now()}-${idx + 1}.${outputFormat}`;
    link.click();
  };

  const handleDownloadAll = () => {
    results.filter((item) => item.imageUrl).forEach((item, idx) => {
      setTimeout(() => handleDownload(item.imageUrl!, idx), idx * 250);
    });
  };

  const openCropEditor = (index: number, imageUrl: string) => {
    setCropEditor({ index, imageUrl });
  };

  const handleApplyCrop = async () => {
    if (!cropEditor || !cropMeta) return;
    try {
      const image = await loadHtmlImage(cropEditor.imageUrl);
      const cropRect = getCropRect(cropMeta, getAspectRatioValue(aspectRatio), cropZoom, cropPosition.x, cropPosition.y);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(cropRect.sw));
      canvas.height = Math.max(1, Math.round(cropRect.sh));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available.');
      if (outputFormat === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(
        image,
        cropRect.sx,
        cropRect.sy,
        cropRect.sw,
        cropRect.sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const croppedUrl = canvas.toDataURL(outputFormat === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
      setResults((prev) => prev.map((item, idx) => (
        idx === cropEditor.index
          ? { ...item, imageUrl: croppedUrl }
          : item
      )));
      setCropEditor(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const cropAspectValue = getAspectRatioValue(aspectRatio);
  const cropRect = cropMeta ? getCropRect(cropMeta, cropAspectValue, cropZoom, cropPosition.x, cropPosition.y) : null;
  const cropBackgroundStyle: React.CSSProperties | undefined = cropEditor && cropMeta && cropRect
    ? {
        aspectRatio: `${cropAspectValue}`,
        backgroundImage: `url(${cropEditor.imageUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${(cropMeta.width / cropRect.sw) * 100}% ${(cropMeta.height / cropRect.sh) * 100}%`,
        backgroundPosition: `${cropMeta.width === cropRect.sw ? 50 : (cropRect.sx / Math.max(1, cropMeta.width - cropRect.sw)) * 100}% ${cropMeta.height === cropRect.sh ? 50 : (cropRect.sy / Math.max(1, cropMeta.height - cropRect.sh)) * 100}%`,
      }
    : undefined;

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white pb-24 custom-scrollbar">
      <div className="px-4 py-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-pastel-border bg-white px-4 py-1.5 text-xs text-pastel-muted shadow-sm">
          <UserCircle2 className="h-3.5 w-3.5 text-purple-500" />
          AI Agent 模特姿势裂变专家
        </div>
        <h1 className="text-2xl font-bold text-pastel-text">模特姿势裂变 (Model Pose Fission)</h1>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-4">
            <section className="rounded-2xl border border-pastel-border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Scan className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">画幅比例</h3>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ASPECT_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAspectRatio(item.id)}
                    className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border py-2.5 transition-all ${
                      aspectRatio === item.id ? 'border-pastel-highlight bg-orange-50 text-pastel-highlight ring-1 ring-orange-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-orange-200'
                    }`}
                  >
                    <span className="text-[11px] font-bold">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Store className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">投放平台风格</h3>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-600">适配各平台视觉基因</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {PLATFORM_STYLES.map((platform) => (
                  <button
                    key={platform.key}
                    type="button"
                    onClick={() => setSelectedPlatform(platform.key)}
                    className={`flex min-h-[5rem] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-all ${
                      selectedPlatform === platform.key ? 'border-pastel-highlight bg-orange-50 text-pastel-highlight ring-1 ring-orange-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-orange-200'
                    }`}
                  >
                    <span className={`mb-1 flex h-5 min-w-5 items-center justify-center rounded text-sm font-black ${platform.key === 'amazon' ? 'bg-pink-500 px-1 text-white' : ''}`}>{platform.icon}</span>
                    <span className={`text-[10px] font-black ${selectedPlatform === platform.key ? 'text-pastel-highlight' : 'text-pastel-text'}`}>{platform.label}</span>
                    <span className="mt-0.5 text-[8px] text-pastel-muted">{platform.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border-2 border-orange-200 bg-white p-1 shadow-sm">
              <UploadCard
                title="模特整体参考图"
                desc="最高权重。上传已穿上产品并换好场景的模特图，后续只裂变动作和构图。"
                icon={<UserCircle2 className="h-4 w-4" />}
                images={overallImages}
                max={1}
                multiple={false}
                onUpload={(files) => addImages(files, setOverallImages, 1, true)}
                onRemove={(id) => removeImage('overall', id)}
              />
            </section>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UploadCard title="模特图" desc="人物长相、发型、肤色、体型一致性来源" icon={<UserCircle2 className="h-4 w-4" />} images={modelImages} max={1} multiple={false} onUpload={(files) => addImages(files, setModelImages, 1, true)} onRemove={(id) => removeImage('model', id)} />
              <UploadCard title="服装/产品图" desc="服装结构、颜色、面料和版型最高优先级" icon={<ImageIcon className="h-4 w-4" />} images={productImages} max={4} onUpload={(files) => addImages(files, setProductImages, 4)} onRemove={(id) => removeImage('product', id)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UploadCard title="场景参考图" desc="可选。用于锁定背景、地点、光线和氛围" icon={<Sparkles className="h-4 w-4" />} images={sceneImages} max={3} onUpload={(files) => addImages(files, setSceneImages, 3)} onRemove={(id) => removeImage('scene', id)} />
              <UploadCard title="动作参考图" desc="可选。上传后优先按每张参考图裂变" icon={<Wand2 className="h-4 w-4" />} images={actionImages} max={10} onUpload={(files) => { setPoseSourceMode('reference'); addImages(files, setActionImages, 10, false, 'action'); }} onRemove={(id) => removeImage('action', id)} />
            </div>

            <UploadCard
              title="配饰参考图（可选）"
              desc="包包 / 首饰 / 帽子 / 道具。上传后会参考主图风格自然加入搭配。"
              icon={<ImageIcon className="h-4 w-4" />}
              images={accessoryImages}
              max={10}
              onUpload={(files) => addImages(files, setAccessoryImages, 10)}
              onRemove={(id) => removeImage('accessory', id)}
            />

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <Brain className="mt-0.5 h-4 w-4 text-purple-500" />
                  <div>
                    <h3 className="text-sm font-bold text-pastel-text">动作库选择</h3>
                    <p className="mt-0.5 text-[10px] text-pastel-muted">动作参考图优先；未上传时使用随机或手动动作库。</p>
                  </div>
                </div>
                <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">
                  当前：{effectivePoseMode === 'reference' ? '参考图锁定' : effectivePoseMode === 'manual' ? '手动动作' : '随机动作'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'random' as PoseSourceMode, label: '智能随机动作', desc: '按动作库抽取' },
                  { id: 'manual' as PoseSourceMode, label: '手动指定动作', desc: '固定一个动作' },
                  { id: 'reference' as PoseSourceMode, label: '动作参考图', desc: '上传图优先' },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setPoseSourceMode(item.id)} className={`min-h-[3.5rem] rounded-xl border px-2 py-2 text-center transition-all ${effectivePoseMode === item.id ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-purple-200'}`}>
                    <div className="text-[11px] font-black">{item.label}</div>
                    <div className="mt-0.5 text-[9px] opacity-70">{item.desc}</div>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">动作库</label>
                  <select value={poseLibraryKey} onChange={(event) => { setPoseLibraryKey(event.target.value as PoseLibraryKey); setSelectedPoseId(''); }} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100">
                    {POSE_LIBRARIES.map((library) => <option key={library.key} value={library.key}>{library.label} - {library.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">指定动作</label>
                  <select value={selectedPoseId} onChange={(event) => setSelectedPoseId(event.target.value)} disabled={poseSourceMode !== 'manual'} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none disabled:opacity-60 focus:ring-2 focus:ring-orange-100">
                    <option value="">默认第一个动作</option>
                    {activeLibrary.poses.map((pose) => <option key={pose.id} value={pose.id}>{pose.id}. {pose.name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-pastel-highlight" />
                  <h3 className="text-sm font-bold text-pastel-text">高级参数与手动覆写</h3>
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-pastel-highlight" />
                  <label className="block text-xs font-bold text-pastel-text">图像模型选择</label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {MODEL_OPTIONS.map((model) => {
                    const active = selectedModel === model.id;
                    return (
                      <button key={model.id} type="button" onClick={() => setSelectedModel(model.id)} className={`relative flex min-h-[5.25rem] flex-col items-center justify-center rounded-2xl border-2 bg-white p-3 text-center transition-all ${active ? 'border-purple-400 bg-purple-50/50 text-purple-700 ring-1 ring-purple-100 shadow-sm' : 'border-pastel-border text-pastel-text hover:border-purple-200'}`}>
                        <span className="absolute left-3 top-2">{model.icon}</span>
                        <span className={`text-xs font-black ${active ? 'text-purple-700' : 'text-pastel-text'}`}>{model.label}</span>
                        <span className={`mt-1 text-[9px] font-bold ${active ? 'text-purple-600' : 'text-pastel-muted'}`}>{model.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">产品名称</label>
                  <input placeholder="AI 推断" className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">品类</label>
                  <input value={productCategory} onChange={(event) => setProductCategory(event.target.value)} placeholder="AI 推断" className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">人群</label>
                  <select className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" defaultValue="美国都市女性">
                    <option>美国都市女性</option>
                    <option>美国职场女性</option>
                    <option>美国都市男性</option>
                    <option>美国年轻情侣</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">卖点</label>
                  <input placeholder="AI 推断" className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-[10px] font-bold text-pastel-muted">补充说明</label>
                <textarea value={scenePrompt} onChange={(event) => setScenePrompt(event.target.value)} placeholder="例如：背面展示，全身" className="min-h-[4.75rem] w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <Scan className="h-3.5 w-3.5 text-pastel-highlight" />
                  <label className="block text-xs font-bold text-pastel-text">画面景别</label>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">影响构图远近</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SHOT_TYPE_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setShotType(item.key)}
                      className={`min-h-[3.25rem] rounded-xl border px-2 py-2 text-center transition-all ${
                        shotType === item.key
                          ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                          : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-blue-200'
                      }`}
                    >
                      <span className="block text-[11px] font-black">{item.label}</span>
                      <span className="mt-0.5 block text-[9px] opacity-70">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">清晰度</label>
                  <select value={resolution} onChange={(event) => setResolution(event.target.value as ImageResolution)} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100">
                    <option value={ImageResolution.RES_1K}>1K</option>
                    <option value={ImageResolution.RES_2K}>2K</option>
                    <option value={ImageResolution.RES_4K}>4K</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">批量</label>
                  <select value={effectiveGenerateCount} disabled={actionImages.length > 0} onChange={(event) => setGenerateCount(Number(event.target.value))} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:border-purple-200 disabled:bg-purple-50 disabled:text-purple-700">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count}张</option>)}
                  </select>
                  {actionImages.length > 0 && <p className="mt-1 text-[0.68rem] font-semibold text-purple-600">已按 {actionImages.length} 张动作参考图锁定生成数量</p>}
                </div>
              </div>

              <textarea value={extraNotes} onChange={(event) => setExtraNotes(event.target.value)} placeholder="额外风格或禁忌要求，例如不要帽子、手部自然、衣摆完整..." className="mt-3 min-h-[4.75rem] w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Download className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">输出格式</h3>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-600">下载与历史保存格式</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'jpg' as OutputImageFormat, label: 'JPG', desc: '默认' },
                  { id: 'png' as OutputImageFormat, label: 'PNG', desc: '高清' },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setOutputFormat(item.id)} className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border transition-all ${outputFormat === item.id ? 'border-pastel-highlight bg-orange-50 text-pastel-highlight ring-1 ring-orange-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-orange-200'}`}>
                    <span className="text-[11px] font-bold">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Sun className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">色彩校准 Color Match</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">生成后统一色调</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'off' as ColorCorrectionMode, label: '关闭', desc: '原图输出' },
                  { id: 'match' as ColorCorrectionMode, label: '参考图匹配', desc: '最推荐' },
                  { id: 'autoWhiteBalance' as ColorCorrectionMode, label: '自动白平衡', desc: 'Gray World' },
                  { id: 'redSuppress' as ColorCorrectionMode, label: '压红补青', desc: '偏红修正' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setColorCorrectionMode(item.id)}
                    className={`min-h-[3.25rem] rounded-xl border px-2 py-2 text-center transition-all ${colorCorrectionMode === item.id ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-blue-200'}`}
                  >
                    <span className="block text-[11px] font-black">{item.label}</span>
                    <span className="mt-0.5 block text-[9px] opacity-70">{item.desc}</span>
                  </button>
                ))}
              </div>
              {colorCorrectionMode === 'match' && (
                <div className="mt-3">
                  <UploadCard title="标准色参考图" desc="上传白平衡正确、色调满意的图，只用于生成后色彩映射" icon={<ImageIcon className="h-4 w-4" />} images={colorReferenceImages} max={1} multiple={false} onUpload={(files) => addImages(files, setColorReferenceImages, 1, true)} onRemove={(id) => removeImage('color', id)} />
                </div>
              )}
              {colorCorrectionMode !== 'off' && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-pastel-muted">
                    <span>混合度</span>
                    <span>{Math.round(colorCorrectionBlend * 100)}%</span>
                  </div>
                  <input type="range" min="0.3" max="1" step="0.05" value={colorCorrectionBlend} onChange={(event) => setColorCorrectionBlend(Number(event.target.value))} className="w-full accent-blue-500" />
                </div>
              )}
            </section>

            <button type="button" onClick={() => handleGenerate()} disabled={isGenerating || isRegeneratingAny || overallImages.length === 0} className={`flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-2xl py-4 font-bold text-white shadow-lg transition-all ${isGenerating || isRegeneratingAny || overallImages.length === 0 ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01] hover:shadow-orange-500/30'}`}>
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {isGenerating ? 'Agent 正在裂变...' : '一键生成模特姿势裂变'}
            </button>
            {isGenerating && (
              <button type="button" onClick={handleCancelGenerate} className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-gray-950">
                <X className="h-4 w-4" />
                中止生成
              </button>
            )}
            {cancelMessage && !isGenerating && (
              <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative flex min-h-[40rem] flex-1 flex-col rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <h3 className="text-lg font-bold text-pastel-text">生成结果</h3>
                </div>
                <div className="flex items-center gap-2">
                  {error && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-medium text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      {error}
                    </div>
                  )}
                  {results.some((item) => item.imageUrl) && !isGenerating && (
                    <button type="button" onClick={handleDownloadAll} className="flex min-h-[2rem] items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 px-3.5 py-1.5 text-xs font-black text-white shadow-md transition-all hover:scale-[1.02]">
                      <Download className="h-3.5 w-3.5" />
                      全部下载
                    </button>
                  )}
                </div>
              </div>

              <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg/50">
                {isGenerating && regeneratingIndex === null && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-5 bg-white/80 backdrop-blur-sm">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-white text-orange-500 shadow-xl">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-pastel-text">姿势裂变生成中</h4>
                      <p className="mt-1 text-xs text-pastel-muted">{statusMessage || '正在保持人物一致性并生成多姿势结果...'}</p>
                    </div>
                  </div>
                )}

                {results.length > 0 ? (
                  <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] content-start gap-5 overflow-y-auto p-5">
                    {results.map((item, idx) => (
                      <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-white bg-white shadow-xl">
                        <div className={`relative flex ${getResultAspectClass(aspectRatio)} min-h-[16rem] items-center justify-center bg-white`}>
                          {item.status === 'generating' && !item.imageUrl && <div className="flex flex-col items-center gap-2 text-orange-500"><Loader2 className="h-7 w-7 animate-spin" /><span className="text-xs font-bold">生成中...</span></div>}
                          {item.status === 'error' && <div className="p-5 text-center text-xs font-bold text-red-500">{item.error || '生成失败'}</div>}
                          {item.imageUrl && <img src={item.imageUrl} alt={item.poseLabel} className={`h-full w-full object-contain transition-opacity ${item.status === 'generating' ? 'opacity-45' : 'opacity-100'}`} />}
                          {item.status === 'pending' && <div className="text-xs font-bold text-pastel-muted">等待生成</div>}
                          {item.status === 'generating' && item.imageUrl && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/45 text-orange-500 backdrop-blur-[1px]">
                              <Loader2 className="h-7 w-7 animate-spin" />
                              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold shadow-sm">重新生成中...</span>
                            </div>
                          )}
                        </div>
                        <div className="border-t border-pastel-border bg-white px-3 py-2">
                          <div className="truncate text-[10px] font-bold text-pastel-text">{item.poseLabel}</div>
                        </div>
                        {item.imageUrl && item.status !== 'generating' && (
                          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 bg-black/50 p-4 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                            <button type="button" title="预览" onClick={() => setSelectedPreview(item.imageUrl)} className="min-h-11 min-w-11 rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40"><Maximize className="h-5 w-5" /></button>
                            <button type="button" title="按画幅裁剪" onClick={() => openCropEditor(idx, item.imageUrl!)} className="min-h-11 min-w-11 rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40"><Crop className="h-5 w-5" /></button>
                            <button type="button" title="重新生成" onClick={() => handleGenerate(idx)} disabled={isGenerating || regeneratingIndices.includes(idx)} className="min-h-11 min-w-11 rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40 disabled:opacity-50"><RefreshCw className={`h-5 w-5 ${regeneratingIndices.includes(idx) ? 'animate-spin' : ''}`} /></button>
                            <button type="button" title="下载" onClick={() => handleDownload(item.imageUrl!, idx)} className="min-h-11 min-w-11 rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40"><Download className="h-5 w-5" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
                      <ImageIcon className="h-8 w-8 text-pastel-border" />
                    </div>
                    <p className="max-w-[18rem] text-sm text-pastel-muted">上传模特、服装和场景，选择动作来源后，Agent 会生成保持人物长相一致的多姿势图片。</p>
                    <div className="flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-[10px] font-bold text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      主图生成流程独立，不会被此功能影响
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {cropEditor && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-3 sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-pastel-border px-4 py-3">
              <div>
                <h3 className="text-sm font-black text-pastel-text">按当前画幅裁剪</h3>
                <p className="mt-0.5 text-xs text-pastel-muted">当前比例：{aspectRatio}，裁剪后会替换这张结果图</p>
              </div>
              <button type="button" onClick={() => setCropEditor(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-pastel-muted hover:bg-pastel-bg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex min-h-[18rem] items-center justify-center rounded-xl bg-neutral-950 p-3">
                {cropBackgroundStyle ? (
                  <div
                    className="relative w-full max-w-[min(100%,36rem)] overflow-hidden rounded-lg bg-white shadow-xl ring-2 ring-white"
                    style={cropBackgroundStyle}
                  >
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
                    <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/45" />
                    <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/45" />
                    <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/45" />
                    <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/45" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs font-bold">正在读取图片...</span>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-pastel-border bg-pastel-bg/40 p-4">
                <div>
                  <label className="mb-2 flex items-center justify-between text-xs font-bold text-pastel-text">
                    缩放
                    <span className="text-pastel-muted">{cropZoom.toFixed(2)}x</span>
                  </label>
                  <input type="range" min="1" max="3" step="0.01" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} className="w-full accent-orange-500" />
                </div>

                <div>
                  <label className="mb-2 flex items-center justify-between text-xs font-bold text-pastel-text">
                    左右位置
                    <span className="text-pastel-muted">{Math.round(cropPosition.x)}%</span>
                  </label>
                  <input type="range" min="0" max="100" value={cropPosition.x} onChange={(event) => setCropPosition((prev) => ({ ...prev, x: Number(event.target.value) }))} className="w-full accent-orange-500" />
                </div>

                <div>
                  <label className="mb-2 flex items-center justify-between text-xs font-bold text-pastel-text">
                    上下位置
                    <span className="text-pastel-muted">{Math.round(cropPosition.y)}%</span>
                  </label>
                  <input type="range" min="0" max="100" value={cropPosition.y} onChange={(event) => setCropPosition((prev) => ({ ...prev, y: Number(event.target.value) }))} className="w-full accent-orange-500" />
                </div>

                <div className="rounded-lg bg-white p-3 text-xs leading-relaxed text-pastel-muted">
                  裁剪框比例会锁定为当前画幅。需要其它比例时，先在左侧切换画幅比例，再打开裁剪。
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button type="button" onClick={() => setCropEditor(null)} className="min-h-11 flex-1 rounded-xl border border-pastel-border bg-white px-4 py-2 text-sm font-bold text-pastel-text hover:bg-pastel-bg">
                    取消
                  </button>
                  <button type="button" onClick={handleApplyCrop} disabled={!cropMeta} className="min-h-11 flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-sm font-black text-white shadow-md hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
                    应用裁剪
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPreview(null)}>
          <div className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}>
            <img src={selectedPreview} alt="预览" className="max-h-[85vh] w-auto object-contain" />
            <button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelPoseFissionTab;
