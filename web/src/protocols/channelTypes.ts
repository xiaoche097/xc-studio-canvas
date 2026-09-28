export type CapabilityType = 'text' | 'image' | 'video' | 'audio';

export interface CustomHeader {
  id: string;
  key: string;
  value: string;
}

export interface SystemChannel {
  id: string;
  name: string;               // e.g. "deepseek", "OpenAI 官方渠道"
  baseUrl: string;            // e.g. "https://api.deepseek.com"
  apiKey: string;             // e.g. "sk-..."
  secretKey?: string;         // e.g. IAM Secret Key for Volcengine / AWS
  customHeaders: CustomHeader[];
  followSystemConcurrency: boolean;
  maxConcurrency: number;     // e.g. 5
  enabled: boolean;
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ModelPricing {
  costPrice?: string;
  salePrice?: string;
  profitRate?: string;
}

// 文本模型能力与真实参数
export interface TextModelParameters {
  contextWindowTokens: number;      // 上下文窗口 Token, 如 128000
  maxOutputTokens: number;          // 最大输出 Token, 如 16384
  maxReferenceImages: number;       // 最大参考图片数, 如 0 或 16
  maxImageSizeMb: number;           // 单张图片上限 MB, 如 0 或 30
  maxReferenceVideos: number;       // 最大参考视频数, 如 0
  maxVideoSizeMb: number;           // 单个视频上限 MB, 如 0
  maxPromptLength: number;          // 提示词最大字符数, 如 32000
  enableSseStream: boolean;         // SSE 流式输出, 默认 true
}

export interface AspectRatioItem {
  ratio: string;         // 如 "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"
  resolution: string;    // 如 "1024 × 1024", "1824 × 1024"
  enabled: boolean;
}

export interface ResolutionGroup {
  name: '1K' | '2K' | '4K';
  enabled: boolean;
  ratios: AspectRatioItem[];
}

// 图像模型能力与真实参数
export interface ImageModelParameters {
  maxReferenceImages: number;       // 最大参考图, 如 16
  maxImageSizeMb: number;           // 单图上限 MB, 如 30
  supportMaskEdit: boolean;         // 蒙版编辑 (提交 mask)
  maxPromptLength: number;          // 提示词最大字符数, 如 32000
  
  dimensionMode: 'none' | 'size' | 'aspect_ratio';  // 尺寸参数模式: 不发送 / size / aspect_ratio
  resolutions: ResolutionGroup[];
  defaultOutputDimension: string;   // 默认输出尺寸, 如 "自动", "1:1", "16:9"
  allowCustomDimension: boolean;    // 允许自定义尺寸
  
  batchCount: number;               // 单次生成张数, 如 15 或 1
  
  quality: {
    enabled: boolean;
    supportedValues: string[];      // 如 ["auto", "low", "medium", "high"]
    defaultValue: string;           // 如 "auto"
  };
  transparentBackground: {
    enabled: boolean;
    defaultValue: boolean;
  };
  responseFormatB64: boolean;       // 发送 b64_json 响应格式
  outputFormatPng: boolean;         // 发送 PNG 输出格式
}

export interface ChannelModel {
  id: string;
  channelId: string;
  modelId: string;            // 产品模型标识 (e.g. "deepseek-flash", "deepseek-chat")
  upstreamModelId: string;    // 上游模型 ID (e.g. "deepseek-chat")
  displayName: string;        // 模型展示名 (一级目录)
  channelDisplayName?: string;// 渠道展示名 (二级目录, e.g. "官方渠道")
  logo?: string;              // 图标或 URL
  description?: string;
  capability: CapabilityType;
  protocolId: string;         // 绑定的标准协议 ID, 对应 catalog 中的 providerId
  pricing?: ModelPricing;
  rate?: string;              // 费率倍率, 如 "v1", "v2"
  enabled: boolean;
  order?: number;
  textParams?: TextModelParameters;     // 文本真实能力与参数 (图1)
  imageParams?: ImageModelParameters;   // 图片真实能力与参数 (图2)
  createdAt: number;
  updatedAt: number;
}

export interface RemoteFetchedModel {
  id: string;
  name?: string;
  capability: CapabilityType;
  recommendedProtocolId: string;
  selected?: boolean;
}
