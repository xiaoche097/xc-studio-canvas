export type ImageModel = string;
export type VideoModel = string;

export type DesignTaskMode =
  | 'generate'
  | 'edit'
  | 'touch-edit'
  | 'text-edit'
  | 'layout-edit'
  | 'research'
  | 'clarify'
  | 'respond'
  | 'workflow-step'
  | string;

export interface BrandInfo {
  name?: string;
  colors?: string[];
  fonts?: string[];
  style?: string;
}

export interface DesignSessionState {
  taskMode: DesignTaskMode;
  brand: BrandInfo;
  styleHints: string[];
  subjectAnchors: string[];
  referenceSummary?: string;
  constraints: string[];
  forbiddenChanges: string[];
  approvedAssetIds: string[];
  researchSummary?: string;
  referenceWebPages?: Array<{ title: string; url: string }>;
}

export type ShapeType = string;

export interface CanvasElement {
  id: string;
  type: string;
  url?: string;
  originalUrl?: string;
  proxyUrl?: string;
  shapeType?: ShapeType;
  // Text specific properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify' | string;
  letterSpacing?: any;
  lineHeight?: any;
  textTransform?: string;
  textDecoration?: string;
  opacity?: number;

  // Shape specific
  cornerRadius?: number;
  aspectRatioLocked?: boolean;

  // Gen Image/Video specific
  genPrompt?: string;
  genModel?: ImageModel | VideoModel;
  genAspectRatio?: string;
  genResolution?: any;
  genQuality?: any;
  detectedTexts?: { original: string, edited?: string }[];

  // Image Gen Reference
  genRefImage?: any;
  genRefImages?: any;

  // Video Gen Specifics
  genStartFrame?: string;
  genEndFrame?: string;
  genVideoRefs?: any;
  genDuration?: any;
  genFirstLastMode?: any;

  isGenerating?: boolean;
  generatingType?: string;
  genError?: string;

  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isLocked?: boolean;
  isHidden?: boolean;

  // Group support
  groupId?: string;
  children?: string[];
  isCollapsed?: boolean;
  originalChildData?: any;
}

export interface Marker {
  id: string | number;
  x: number;
  y: number;
  elementId: string;
  cropUrl?: string;
  label?: string;
  analysis?: string;
  width?: number;
  height?: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  title: string;
  updatedAt: string;
  thumbnail?: string;
  elements?: CanvasElement[];
  markers?: Marker[];
  conversations?: ConversationSession[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system' | 'assistant' | string;
  text?: string;
  content?: string;
  kind?: string;
  workflowUi?: any;
  timestamp: number;
  attachments?: any;
  attachmentMetadata?: any;
  error?: boolean | string;
  relatedMarkerId?: string;
  agentData?: any;
  skillData?: any;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface InputBlock {
  id: string;
  type: string;
  text?: string;
  file?: File;
}

export interface AgentChatMessage extends ChatMessage {
  agentId?: string;
  taskId?: string;
  skillCalls?: Array<{
    skillName: string;
    params: Record<string, any>;
    result?: any;
    error?: string;
  }>;
}

export interface ProjectContext {
  projectId: string;
  projectTitle: string;
  conversationId: string;
  brandInfo?: BrandInfo;
  designSession?: DesignSessionState;
  existingAssets: CanvasElement[];
  conversationHistory: ChatMessage[];
}

import type { WorkflowUiMessage } from './workflow.types';
