
export enum NodeType {
  PROMPT_INPUT = 'PROMPT_INPUT',
  IMAGE_GENERATOR = 'IMAGE_GENERATOR',
  VIDEO_GENERATOR = 'VIDEO_GENERATOR',
  VIDEO_ANALYZER = 'VIDEO_ANALYZER',
  IMAGE_EDITOR = 'IMAGE_EDITOR',
  AUDIO_GENERATOR = 'AUDIO_GENERATOR',
  STORYBOARD_GRID = 'STORYBOARD_GRID',
}

export enum NodeStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export type VideoGenerationMode = 'DEFAULT' | 'CONTINUE' | 'CUT' | 'FIRST_LAST_FRAME' | 'CHARACTER_REF';

export type StoryboardOptionType =
  | 'MODEL_SCENE_FISSION'
  | 'MULTI_ANGLE_9GRID'
  | 'STORY_DEDUCTION_4GRID'
  | 'CONTINUOUS_25GRID';

export interface GridCropConfig {
  rows: number;
  cols: number;
  mode: 'independent' | 'storyboard';
  title?: string;
}

export interface ColorAdjustments {
  // 光线 (Light)
  exposure?: number;       // -100 ~ 100
  contrast?: number;       // -100 ~ 100
  highlights?: number;     // -100 ~ 100
  shadows?: number;        // -100 ~ 100
  whites?: number;         // -100 ~ 100
  blacks?: number;         // -100 ~ 100
  
  // 颜色 (Color)
  temperature?: number;    // -100 ~ 100
  tint?: number;           // -100 ~ 100
  vibrance?: number;       // -100 ~ 100
  saturation?: number;     // -100 ~ 100
  
  // 细节 (Detail)
  texture?: number;        // -100 ~ 100
  clarity?: number;        // -100 ~ 100
  sharpen?: number;        // 0 ~ 100
  noiseReduction?: number; // 0 ~ 100
  colorNoiseReduction?: number; // 0 ~ 100
  
  // 效果 (Effects)
  dehaze?: number;         // -100 ~ 100
  vignette?: number;       // -100 ~ 100
  grain?: number;          // 0 ~ 100
  fade?: number;           // 0 ~ 100
  blur?: number;           // 0 ~ 100
}

export interface LightingParams {
  azimuth: number;
  elevation: number;
  intensity: number;
  color: string;
  viewMode: 'perspective' | 'front';
}

export interface AppNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width?: number; // Custom width
  height?: number; // Custom height
  title: string;
  status: NodeStatus;
  data: {
    prompt?: string;
    model?: string; // Selected AI model
    image?: string; // Base64 (The currently displayed main image)
    assetOrigin?: 'uploaded' | 'generated' | 'derived'; // Distinguishes user imports from generated media
    colorAdjustments?: ColorAdjustments; // 调色参数
    lightingParams?: LightingParams; // 3D打光参数


    imagePreview?: string; // Lightweight WebP preview used by the canvas
    imagePreviewSource?: string; // Compact fingerprint of the original image
    images?: string[]; // Array of Base64 strings (for multiple generations)
    imageCount?: number; // Number of images to generate (1-4)
    videoCount?: number; // Number of videos to generate (1-4)
    videoUri?: string; // URL
    videoUris?: string[]; // Array of URLs (for multiple video generations)
    videoMetadata?: any; // Stores the raw Video object from Gemini API for extension
    audioUri?: string; // Base64 or Blob URL for Audio Node
    analysis?: string; // Video analysis result
    error?: string;
    progress?: string;
    aspectRatio?: string; // e.g., '16:9', '4:3'
    resolution?: string; // e.g., '1080p', '4k'
    duration?: number; // Duration in seconds (for Audio/Video)
    generateAudio?: boolean; // Whether the video model should generate synchronized audio
    stylePresetId?: string;
    stylePresetName?: string;
    stylePresetNegativePrompt?: string;
    textMode?: 'launcher' | 'editor';
    
    // Storyboard Grid properties
    storyboardAspectRatio?: string; // e.g., '2:3', '16:9', '9:16', '3:4', '4:3', '1:1'
    storyboardGridSize?: string;    // e.g., '2x2', '3x3', '4x4', '5x5'
    storyboardCells?: { id: string; image?: string; prompt?: string }[];
    isCollapsed?: boolean;
    isEditingStoryboard?: boolean;
    
    // Video Strategies (StoryContinuator, SceneDirector, FrameWeaver, CharacterRef)
    generationMode?: VideoGenerationMode; 
    selectedFrame?: string; // Base64 of the specific frame captured from video (Raw)
    croppedFrame?: string; // Base64 of the cropped/edited frame (Final Input)
    
    // Input Management
    sortedInputIds?: string[]; // Order of input nodes for multi-image composition
  };
  inputs: string[]; // IDs of nodes this node connects FROM
}

export interface Group {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  nodeIds?: string[]; // Explicit workflow membership; inferred for legacy groups
}

export interface Connection {
  from: string;
  to: string;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  id?: string;
}

export interface Workflow {
  id: string;
  title: string;
  thumbnail: string;
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
  sourceGroupId?: string;
  updatedAt?: number;
}

// New Smart Sequence Types
export interface SmartSequenceItem {
    id: string;
    src: string; // Base64 or URL
    transition: {
        duration: number; // 1-6s
        prompt: string;
    };
}

// Window interface for Google AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
