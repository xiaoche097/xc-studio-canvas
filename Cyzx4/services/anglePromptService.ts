export type CameraDistance = 'close_up' | 'near' | 'medium' | 'medium_far' | 'full_body' | 'wide';
export type GazeDirection = 'camera' | 'left' | 'right' | 'forward' | 'down' | 'up' | 'away' | 'auto';
export type FramingType =
  | 'face'
  | 'chest'
  | 'waist'
  | 'hip'
  | 'mid_thigh'
  | 'knee'
  | 'calf'
  | 'full_body'
  | 'environment';

export type LutPreset =
  | 'none'
  | 'costa135'
  | 'portra400'
  | 'fuji400h'
  | 'monochrome'
  | 'kodak_gold'
  | 'nordic_cold';

export interface AngleSpec {
  camera: {
    azimuth: number; // -180° to +180°
    elevation: number; // -30° to +60°
    distance: CameraDistance;
    distanceNum: number; // 1.8m to 6.0m
    focalLength: number; // e.g. 50 (mm)
    roll: number; // -15° to +15°
    aperture: number; // e.g. 1.4, 2.8, 4.0, 8.0, 11.0
    iso: number; // e.g. 100, 200, 400, 800, 1600
    shutterSpeed: string; // e.g. '1/250s'
    ev: number; // -2.0 to +2.0
    lutPreset: LutPreset;
  };
  subject: {
    bodyYaw: number; // -180° to +180°
    shoulderYaw: number; // -30° to +30°
    hipYaw: number; // -20° to +20°
    headYaw: number; // -90° to +90°
    headPitch: number; // -25° to +25°
    gaze: GazeDirection;
  };
  composition: {
    framing: FramingType;
    subjectX: number; // -50 to +50
    subjectY: number; // -50 to +50
  };
  locks: {
    model: boolean;
    outfit: boolean;
    scene: boolean;
    lighting: boolean;
  };
}

export const DEFAULT_ANGLE_SPEC: AngleSpec = {
  camera: {
    azimuth: 0,
    elevation: 0,
    distance: 'medium',
    distanceNum: 3.5,
    focalLength: 50,
    roll: 0,
    aperture: 2.8,
    iso: 100,
    shutterSpeed: '1/250s',
    ev: 0,
    lutPreset: 'none',
  },
  subject: {
    bodyYaw: 0,
    shoulderYaw: 0,
    hipYaw: 0,
    headYaw: 0,
    headPitch: 0,
    gaze: 'camera',
  },
  composition: {
    framing: 'mid_thigh',
    subjectX: 0,
    subjectY: 0,
  },
  locks: {
    model: true,
    outfit: true,
    scene: true,
    lighting: true,
  },
};

export const LUT_PRESETS: Array<{
  id: LutPreset;
  name: string;
  desc: string;
  cssFilter: string;
  promptDescription: string;
}> = [
  {
    id: 'none',
    name: '标准商业光影',
    desc: '真实高保真还原',
    cssFilter: 'none',
    promptDescription: 'Natural high-end commercial photo studio lighting and neutral true color science.',
  },
  {
    id: 'costa135',
    name: 'COSTA 135 暖金',
    desc: '暖阳金光 Lookbook',
    cssFilter: 'sepia(0.25) contrast(1.06) saturate(1.1) hue-rotate(-5deg)',
    promptDescription: 'Warm golden Costa 135 film style with radiant sunlit highlight glow and soft warm shadows.',
  },
  {
    id: 'portra400',
    name: 'Portra 400 柔肤',
    desc: '柔和粉润时尚人像',
    cssFilter: 'contrast(0.96) saturate(1.08) sepia(0.12) brightness(1.02)',
    promptDescription: 'Kodak Portra 400 color film science, creamy skin tones, pastel highlights, and vintage editorial warmth.',
  },
  {
    id: 'fuji400h',
    name: 'Fuji 400H 冷青',
    desc: '清透冷调高级质感',
    cssFilter: 'contrast(1.04) saturate(0.94) hue-rotate(8deg) brightness(1.01)',
    promptDescription: 'Fuji Pro 400H aesthetic with ethereal cyan shadow tones and clean airy fashion highlights.',
  },
  {
    id: 'monochrome',
    name: 'Monochrome 黑白',
    desc: '极简黑白高级时尚',
    cssFilter: 'grayscale(1) contrast(1.18)',
    promptDescription: 'Timeless high-contrast black and white fine art editorial portraiture.',
  },
  {
    id: 'kodak_gold',
    name: 'Kodak Gold 暖黄',
    desc: '复古暖黄怀旧氛围',
    cssFilter: 'sepia(0.38) saturate(1.22) contrast(1.05)',
    promptDescription: 'Kodak Gold warm vintage retro golden-yellow nostalgia tone.',
  },
  {
    id: 'nordic_cold',
    name: 'Nordic Cold 冷调',
    desc: '低饱和北欧极简冷风',
    cssFilter: 'saturate(0.85) hue-rotate(15deg) contrast(1.08)',
    promptDescription: 'Nordic minimalist cool-toned desaturated editorial fashion color palette.',
  },
];

export const OFFICIAL_ANGLE_PRESETS: Array<{
  id: string;
  name: string;
  desc: string;
  spec: Partial<AngleSpec>;
}> = [
  {
    id: 'preset-01',
    name: '01 正面标准主图',
    desc: '平视视角正对模特，展示标准整体版型',
    spec: {
      camera: { azimuth: 0, elevation: 0, distance: 'medium', distanceNum: 3.5, focalLength: 50, roll: 0, aperture: 2.8, iso: 100, shutterSpeed: '1/250s', ev: 0, lutPreset: 'none' },
      subject: { bodyYaw: 0, shoulderYaw: 0, hipYaw: 0, headYaw: 0, headPitch: 0, gaze: 'camera' },
      composition: { framing: 'mid_thigh', subjectX: 0, subjectY: 0 },
    },
  },
  {
    id: 'preset-02',
    name: '02 右前 3/4 经典构图',
    desc: '相机位于右前 45° 视角，突出服装与面部轮廓层次感',
    spec: {
      camera: { azimuth: 45, elevation: 0, distance: 'medium', distanceNum: 3.5, focalLength: 50, roll: 0, aperture: 2.8, iso: 100, shutterSpeed: '1/250s', ev: 0, lutPreset: 'none' },
      subject: { bodyYaw: -10, shoulderYaw: -5, hipYaw: 0, headYaw: 10, headPitch: 0, gaze: 'camera' },
      composition: { framing: 'mid_thigh', subjectX: 0, subjectY: 0 },
    },
  },
  {
    id: 'preset-03',
    name: '03 左前 3/4 时尚机位',
    desc: '相机位于左前 45° 视角，展现流畅曲线与自然神态',
    spec: {
      camera: { azimuth: -45, elevation: 0, distance: 'medium', distanceNum: 3.5, focalLength: 50, roll: 0, aperture: 2.8, iso: 100, shutterSpeed: '1/250s', ev: 0, lutPreset: 'none' },
      subject: { bodyYaw: 10, shoulderYaw: 5, hipYaw: 0, headYaw: -10, headPitch: 0, gaze: 'camera' },
      composition: { framing: 'mid_thigh', subjectX: 0, subjectY: 0 },
    },
  },
  {
    id: 'preset-04',
    name: '04 右侧 90° 纯侧面',
    desc: '90° 侧向镜头，突出服装侧缝线与鞋姿侧面',
    spec: {
      camera: { azimuth: 90, elevation: 0, distance: 'medium', distanceNum: 3.5, focalLength: 85, roll: 0, aperture: 2.8, iso: 100, shutterSpeed: '1/250s', ev: 0, lutPreset: 'none' },
      subject: { bodyYaw: 0, shoulderYaw: 0, hipYaw: 0, headYaw: 0, headPitch: 0, gaze: 'forward' },
      composition: { framing: 'mid_thigh', subjectX: 0, subjectY: 0 },
    },
  },
  {
    id: 'preset-05',
    name: '05 左侧 90° 纯侧面',
    desc: '正左侧视角，展示精致侧颜剪影',
    spec: {
      camera: { azimuth: -90, elevation: 0, distance: 'medium', distanceNum: 3.5, focalLength: 85, roll: 0, aperture: 2.8, iso: 100, shutterSpeed: '1/250s', ev: 0, lutPreset: 'none' },
      subject: { bodyYaw: 0, shoulderYaw: 0, hipYaw: 0, headYaw: 0, headPitch: 0, gaze: 'forward' },
      composition: { framing: 'mid_thigh', subjectX: 0, subjectY: 0 },
    },
  },
  {
    id: 'preset-06',
    name: '06 轻微低机位仰拍',
    desc: '仰角 -12° 拍摄，拉长视效腿部线条，气场强大',
    spec: {
      camera: { azimuth: 0, elevation: -12, distance: 'full_body', distanceNum: 4.8, focalLength: 35, roll: 0, aperture: 2.8, iso: 100, shutterSpeed: '1/250s', ev: 0, lutPreset: 'none' },
      subject: { bodyYaw: 0, shoulderYaw: 0, hipYaw: 0, headYaw: 0, headPitch: 5, gaze: 'camera' },
      composition: { framing: 'full_body', subjectX: 0, subjectY: 0 },
    },
  },
  {
    id: 'preset-07',
    name: '07 Editorial 大片风',
    desc: '35mm 广角轻微低视角，极具大牌杂志视觉冲击力',
    spec: {
      camera: { azimuth: 30, elevation: -20, distance: 'full_body', distanceNum: 4.8, focalLength: 35, roll: 5, aperture: 1.8, iso: 100, shutterSpeed: '1/500s', ev: 0, lutPreset: 'costa135' },
      subject: { bodyYaw: -15, shoulderYaw: -10, hipYaw: 10, headYaw: 15, headPitch: 0, gaze: 'camera' },
      composition: { framing: 'full_body', subjectX: 0, subjectY: 0 },
    },
  },
  {
    id: 'preset-08',
    name: '08 优雅回眸视角',
    desc: '右后 45° 视角背影回首，眼神回看镜头，慵懒高级',
    spec: {
      camera: { azimuth: 135, elevation: 0, distance: 'medium', distanceNum: 3.5, focalLength: 85, roll: 0, aperture: 2.0, iso: 100, shutterSpeed: '1/250s', ev: 0, lutPreset: 'portra400' },
      subject: { bodyYaw: 10, shoulderYaw: 5, hipYaw: 0, headYaw: -35, headPitch: 0, gaze: 'camera' },
      composition: { framing: 'mid_thigh', subjectX: 0, subjectY: 0 },
    },
  },
];

export const compileAnglePrompt = (spec: AngleSpec, userRequirement: string = ''): string => {
  const parts: string[] = [];

  parts.push(
    'Analyze the uploaded reference image(s) as the SINGLE ABSOLUTE SOURCE OF TRUTH for model identity, outfit, and background scene environment.'
  );

  // Locks
  const locksText: string[] = [];
  if (spec.locks.model) locksText.push('model facial identity, features, hairstyle, skin tone, and body shape');
  if (spec.locks.outfit) locksText.push('exact outfit design, clothing style, colors, fabric texture, and accessories');
  if (spec.locks.scene) locksText.push('original background scene environment, architecture, and floor textures');
  if (spec.locks.lighting) locksText.push('original lighting direction, color temperature, and shadow intensity');

  if (locksText.length > 0) {
    parts.push(`STRICT VISUAL LOCKS: Strictly preserve and lock ${locksText.join(', ')}.`);
  }

  // Camera Azimuth
  const az = spec.camera.azimuth;
  let azText = 'directly in front of the model at 0 degrees';
  if (az > 0 && az <= 30) azText = `slightly angled towards the model's right front quarter (+${az} degrees)`;
  else if (az > 30 && az <= 60) azText = `positioned 45 degrees around the model's right-front quarter (+${az} degrees)`;
  else if (az > 60 && az <= 120) azText = `positioned directly to the model's right side profile (+${az} degrees)`;
  else if (az > 120 && az < 180) azText = `positioned at the model's right-rear quarter (+${az} degrees)`;
  else if (az === 180 || az === -180) azText = `positioned directly behind the model's back (180 degrees)`;
  else if (az < 0 && az >= -30) azText = `slightly angled towards the model's left front quarter (${az} degrees)`;
  else if (az < -30 && az >= -60) azText = `positioned 45 degrees around the model's left-front quarter (${az} degrees)`;
  else if (az < -60 && az >= -120) azText = `positioned directly to the model's left side profile (${az} degrees)`;
  else if (az < -120 && az > -180) azText = `positioned at the model's left-rear quarter (${az} degrees)`;

  parts.push(`CAMERA AZIMUTH & POSITION: ${azText}.`);

  if (Math.abs(az) > 10) {
    parts.push(
      'CAMERA MOVEMENT MANDATE: The camera physically moves around the subject in 3D space. Do NOT fake this camera position by merely rotating the subject.'
    );
  }

  // Camera Elevation
  const el = spec.camera.elevation;
  let elText = 'eye-level perspective at 0 degrees';
  if (el <= -20) elText = `distinct low-angle camera position looking up from below (${el} degrees)`;
  else if (el < 0) elText = `subtle low-angle camera position, slightly below eye level (${el} degrees)`;
  else if (el > 0 && el <= 20) elText = `subtle high-angle camera position, slightly looking down (${el} degrees)`;
  else if (el > 20) elText = `high-angle camera position looking down at the model (${el} degrees)`;

  parts.push(`CAMERA HEIGHT & ELEVATION: ${elText}.`);

  // Focal Length, Distance, Aperture, EV
  const distM = spec.camera.distanceNum || 3.5;
  parts.push(
    `LENS & CAMERA PARAMETERS: ${spec.camera.focalLength}mm lens perspective, camera distance set to ${distM} meters. Aperture f/${spec.camera.aperture || 2.8} for smooth depth-of-field background blur (bokeh). ISO ${spec.camera.iso || 100}, shutter ${spec.camera.shutterSpeed || '1/250s'}, exposure compensation EV=${spec.camera.ev >= 0 ? `+${spec.camera.ev}` : spec.camera.ev}.`
  );

  if (spec.camera.roll !== 0) {
    parts.push(`CAMERA ROLL: Subtle camera roll/tilt of ${spec.camera.roll} degrees.`);
  }

  // LUT Preset Color Grading
  const matchedLut = LUT_PRESETS.find((l) => l.id === spec.camera.lutPreset);
  if (matchedLut && matchedLut.id !== 'none') {
    parts.push(`COLOR GRADING & LUT PRESET: ${matchedLut.promptDescription}.`);
  }

  // Subject Body Yaw
  const bodyY = spec.subject.bodyYaw;
  let bodyText = 'facing forward toward camera direction';
  if (bodyY !== 0) {
    bodyText = `rotated ${bodyY > 0 ? `+${bodyY} degrees to her right` : `${bodyY} degrees to her left`}`;
  }
  parts.push(`SUBJECT TORSO & BODY ROTATION: Torso is ${bodyText}.`);

  parts.push(
    `POSE SCULPTING COORDINATES: Shoulder line yaw ${spec.subject.shoulderYaw} degrees; hip line yaw ${spec.subject.hipYaw} degrees. Treat these as independent anatomical rotations while keeping limbs, garment seams, and body proportions physically coherent.`
  );

  if (spec.subject.bodyYaw !== 0 && az === 0) {
    parts.push('MODEL ROTATION MANDATE: Keep the camera viewpoint fixed and rotate only the model torso.');
  }

  // Head Yaw & Pitch
  const headY = spec.subject.headYaw;
  const headP = spec.subject.headPitch;
  let headText = 'facing straight forward';
  if (headY !== 0 || headP !== 0) {
    headText = `turned ${headY} degrees horizontally and ${headP > 0 ? `tilted up ${headP}°` : headP < 0 ? `tilted down ${Math.abs(headP)}°` : 'level pitch'}`;
  }
  parts.push(`HEAD ORIENTATION: Head is ${headText}.`);

  // Gaze
  const gazeMap: Record<GazeDirection, string> = {
    camera: 'looks directly into the camera lens with engaging gaze',
    left: 'looks toward the left side',
    right: 'looks toward the right side',
    forward: 'gazing straight ahead into distance',
    down: 'gazing subtly downwards',
    up: 'gazing subtly upwards',
    away: 'gazing away off-camera in high fashion pose',
    auto: 'natural gaze direction complementing pose',
  };
  parts.push(`EYE GAZE DIRECTION: Model ${gazeMap[spec.subject.gaze] || 'looks into camera'}.`);

  // Framing
  const framingMap: Record<FramingType, string> = {
    face: 'Extreme facial close-up portrait framing, focusing on face and eyes',
    chest: 'Upper chest-up portrait shot',
    waist: 'Waist-up portrait framing',
    hip: 'Hip-level medium framing',
    mid_thigh: 'Framed down to mid-thigh',
    knee: 'Knee-up medium full shot',
    calf: 'Calf-level full shot',
    full_body: 'Complete full-body shot from head to toes',
    environment: 'Full-body wide environmental shot with architectural context',
  };
  parts.push(`FRAMING & COMPOSITION: ${framingMap[spec.composition.framing] || 'Full body shot'}.`);

  const subjectHorizontal = spec.composition.subjectX === 0
    ? 'centered horizontally'
    : `${Math.abs(spec.composition.subjectX)}% toward frame ${spec.composition.subjectX > 0 ? 'right' : 'left'}`;
  const subjectVertical = spec.composition.subjectY === 0
    ? 'centered vertically'
    : `${Math.abs(spec.composition.subjectY)}% toward frame ${spec.composition.subjectY > 0 ? 'top' : 'bottom'}`;
  parts.push(
    `SUBJECT FRAME POSITION: Place the subject ${subjectHorizontal} and ${subjectVertical}; preserve the requested crop boundary without cutting hands, feet, hair, or garment edges unintentionally.`
  );

  parts.push(
    `GEOMETRY ACCURACY CONTRACT: Camera azimuth ${spec.camera.azimuth}°, elevation ${spec.camera.elevation}°, roll ${spec.camera.roll}°, subject body yaw ${spec.subject.bodyYaw}°, head yaw ${spec.subject.headYaw}°, and head pitch ${spec.subject.headPitch}° are independent controls. Match the requested parallax, visible body planes, facial direction, horizon, and perspective consistently. Do not substitute model rotation for camera movement or vice versa.`
  );

  if (userRequirement.trim()) {
    parts.push(`ADDITIONAL USER CREATIVE REQUIREMENT: ${userRequirement.trim()}.`);
  }

  parts.push(
    'CRITICAL MANDATE: High fashion commercial editorial photography. Absolutely NO text, NO numbers, NO letters, NO watermarks, NO badges overlaid anywhere.'
  );

  return parts.join('\n\n');
};
