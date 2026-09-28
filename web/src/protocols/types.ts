export type ProtocolCapability = 'text' | 'image' | 'video' | 'audio';

export type ProtocolCategory = 'text' | 'image';

export type ProtocolAuthType = 
  | 'bearer' 
  | 'anthropic' 
  | 'google-api-key' 
  | 'aws-sigv4' 
  | 'header' 
  | 'tc3' 
  | 'volcengine-v4' 
  | 'none';

export interface ProtocolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface StandardProtocolDefinition {
  pluginId: string;
  packageDir: string;
  name: string;
  version: string;
  providerId: string;
  label: string;
  capabilities: ProtocolCapability[];
  category: ProtocolCategory;
  description: string;
  baseUrl: string;
  authType: ProtocolAuthType;
  authField?: string;
  authHeader?: string;
  createMethod: string;
  createPath: string;
  contentType?: string;
  hasPoll: boolean;
  pollMethod?: string | null;
  pollPath?: string | null;
  hasAgent: boolean;
  agentMethod?: string | null;
  agentPath?: string | null;
  requiresPublicMediaUrls: boolean;
  parameters: ProtocolParameter[];
  vendor: string;
  recommendedModels?: string[];
  docsSummary?: string;
}

export interface UserProtocolConfig {
  providerId: string;
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  isDefaultText?: boolean;
  isDefaultImage?: boolean;
  lastTestedAt?: number;
  testStatus?: 'idle' | 'testing' | 'success' | 'error';
  testMessage?: string;
  latencyMs?: number;
}

export interface ProtocolTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  details?: any;
}
