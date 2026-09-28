/**
 * 增强型基础智能体
 * 使用Skills系统统一处理任务，提供完善的错误处理和状态管理
 */

import { Chat, Type } from "@google/genai";
import { createChatSession, generateJsonResponse, getApiKey, getBestModelId } from "../gemini";
import {
  AgentTask,
  AgentInfo,
  ProjectContext,
  GeneratedAsset,
} from "../../types/agent.types";
import { executeSkill, AVAILABLE_SKILLS } from "../skills";
import { errorHandler, ErrorType, AppError } from "../../utils/error-handler";
import { buildEcommerceProposals } from "./shared/ecommerce-variants";
import { useAgentStore } from "../../stores/agent.store";
import { collectReferenceCandidates } from "./utils/reference-images";
import { sanitizeObject, sanitizeStringBase64 } from "./utils/payload-sanitizer";
import { createMaskDataUrl } from "./utils/mask-generator";
import { loadTopicSnapshot } from "../topic-memory";
import { getProviderConfig } from "../provider-config";
import { getHarnessToolDefinitions } from "./runtime/tool-catalog";
import { runHarnessLoop, type HarnessToolExecution } from "./runtime/harness-loop";
import {
  BrowserHarnessSession,
  resolveHarnessMode,
  type HarnessAgentMode,
} from "./runtime/harness-session";
import type { DeepSeekContent, DeepSeekMessage } from "./runtime/deepseek-adapter";
import {
  normalizeHarnessResponse,
  sanitizeHarnessHistoryText,
} from "./runtime/harness-response";
import { buildHarnessSystemPrompt } from "./runtime/harness-system-prompt";
import { buildDurableAgentContext } from "./runtime/context-builder";
import { persistAgentWorkMode } from "./runtime/agent-mode";
import type { AgentContext } from "./context/buildAgentContext";
import {
  FASHION_REPLICA_ROLE_PROMPT,
  SCENE_FISSION_ROLE_PROMPT,
  buildDefaultSceneFissionSchemes,
  buildSceneFissionContactSheetPrompt,
  normalizeSceneFissionSchemes,
  type SceneFissionWorkflowState,
} from "./specialized-visual-roles";

// 带指数退避的重试工具（用于 analyzeAndPlan 等内部调用）
const retryAsync = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1500,
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const code = error.status || error.code || 0;
    const msg = error.message || "";
    if (code === 413 || msg.includes("413") || msg.includes("input tokens") || msg.includes("context length")) {
      console.warn(`[analyzeAndPlan] request too large, skip retry. code=${code}`);
      throw error;
    }
    const isRetryable =
      [500, 502, 503, 429].includes(code) ||
      msg.includes("overloaded") ||
      msg.includes("UNAVAILABLE") ||
      msg.includes("Bad Gateway") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Internal Server Error") ||
      msg.includes("fetch failed");
    if (retries > 0 && isRetryable) {
      const wait = code === 429 ? Math.max(delay, 3000) : delay;
      console.warn(
        `[analyzeAndPlan 重试] 错误码=${code}, ${wait}ms 后重试 (剩余 ${retries} 次)`,
      );
      await new Promise((r) => setTimeout(r, wait));
      return retryAsync(fn, retries - 1, wait * 2);
    }
    throw error;
  }
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
    ),
  ]);
};

// 限流并发执行器：限制最多 concurrency 个任务同时执行
const runWithConcurrency = async <T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> => {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  const worker = async () => {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (error: any) {
        results[i] = { status: "rejected", reason: error };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );
  return results;
};

/**
 * 任务执行配置
 */
interface ExecutionConfig {
  maxRetries: number;
  timeout: number;
  enableCache: boolean;
}

interface ImageParamsSchema {
  type: Type;
  properties: Record<string, { type: Type }>;
}

const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxRetries: 0,
  timeout: 600000, // 10 分钟（图片生成 + 分析可能需要较长时间）
  enableCache: true,
};

const SKILL_TIMEOUTS: Record<string, number> = {
  generateImage: 180_000, // 图像生成在代理环境下可能需要更久
  smartEdit: 120_000,
  touchEdit: 120_000,
  generateVideo: 180_000, // 视频生成可能很慢
  generateCopy: 15_000, // 文本生成很快
  extractText: 15_000,
  analyzeRegion: 15_000,
  export: 30_000,
};
const DEFAULT_SKILL_TIMEOUT = 120_000;
const DEFAULT_MAX_REFERENCE_IMAGES = 8;
const parsedMaxReferenceImages = Number.parseInt(
  String((import.meta as any).env?.VITE_MAX_REFERENCE_IMAGES ?? DEFAULT_MAX_REFERENCE_IMAGES),
  10,
);
const MAX_REFERENCE_IMAGES =
  Number.isFinite(parsedMaxReferenceImages) && parsedMaxReferenceImages > 0
    ? parsedMaxReferenceImages
    : DEFAULT_MAX_REFERENCE_IMAGES;

const IMAGE_TOOL_PARAMS_SCHEMA: ImageParamsSchema = {
  type: Type.OBJECT,
  properties: {
    prompt: { type: Type.STRING },
    model: { type: Type.STRING },
    aspectRatio: { type: Type.STRING },
    referenceImage: { type: Type.STRING },
    referenceImageUrl: { type: Type.STRING },
    reference_image_url: { type: Type.STRING },
    initImage: { type: Type.STRING },
    init_image: { type: Type.STRING },
  },
};
const MULTI_IMAGE_REQUEST_RE = /(\d+)\s*张|(\d+)\s*images?|一套|一组|系列|套图/i;
const ECOM_SET_RE = /亚马逊|amazon|listing|副图|电商|主图|详情图|套图/i;
const BANNED_MULTI_FRAME_TERMS_RE =
  /\b(collage|set of images|multiple views|listing template|contact sheet|mosaic|grid panel)\b/gi;
const MAX_ANALYZE_HISTORY_MESSAGES = 6;
const MAX_MESSAGE_TEXT_CHARS = 1200;
const MAX_TOPIC_CONTEXT_CHARS = 1200;
const MAX_REFERENCE_SUMMARY_CHARS = 400;
const MAX_BRAND_INFO_CHARS = 400;
const SUPPORTED_IMAGE_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "21:9",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
];

const getNearestSupportedImageAspectRatio = (
  width: number,
  height: number,
): string => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return "1:1";
  }
  const ratio = width / height;
  return SUPPORTED_IMAGE_ASPECT_RATIOS.reduce((nearest, candidate) => {
    const [nearestWidth, nearestHeight] = nearest.split(":").map(Number);
    const [candidateWidth, candidateHeight] = candidate.split(":").map(Number);
    return Math.abs(candidateWidth / candidateHeight - ratio) <
      Math.abs(nearestWidth / nearestHeight - ratio)
      ? candidate
      : nearest;
  }, SUPPORTED_IMAGE_ASPECT_RATIOS[0]);
};

const getExplicitImageAspectRatio = (message: string): string | null => {
  const match = String(message || "").match(
    /(?:^|\D)(1\s*[:：]\s*1|3\s*[:：]\s*4|4\s*[:：]\s*3|9\s*[:：]\s*16|16\s*[:：]\s*9|21\s*[:：]\s*9|3\s*[:：]\s*2|2\s*[:：]\s*3|4\s*[:：]\s*5|5\s*[:：]\s*4)(?=\D|$)/,
  );
  return match?.[1]?.replace(/\s+/g, "").replace("：", ":") || null;
};

interface CurrentTurnVisualIntent {
  explicitPersonCountChange: boolean;
  referencePreservingEdit: boolean;
  narrowClothingEdit: boolean;
  guard: string;
}

const analyzeCurrentTurnVisualIntent = (
  message: string,
  hasReferenceImage: boolean,
): CurrentTurnVisualIntent => {
  const text = String(message || "").trim();
  const rejectsAddedPeople =
    /(不要|不能|别|禁止|不需要|无需|并未|没说).{0,16}(加人|新增.{0,5}人|添加.{0,5}人|多.{0,5}(人|男生|女生|模特)|双人|合照)/i.test(text);
  const requestsPersonAddition =
    /(加人|新增.{0,5}(人|男生|女生|模特)|添加.{0,5}(人|男生|女生|模特)|多一个.{0,5}(人|男生|女生|模特)|再加.{0,5}(人|男生|女生|模特)|旁边.{0,10}(加|放|站|多).{0,5}(人|男生|女生|模特)|双人合照)/i.test(text);
  const requestsPersonRemoval =
    /(删除|移除|去掉|不要|抹掉).{0,10}(人|男生|女生|模特|路人)/i.test(text);
  const explicitPersonCountChange =
    requestsPersonRemoval || (requestsPersonAddition && !rejectsAddedPeople);
  const narrowClothingEdit =
    /(衣服|服装|套装|上衣|裤子|裙子|穿搭|面料).{0,20}(换成|改成|改为|变成|替换|换色|改色)|(?:换成|改成|改为|变成).{0,12}(黑色|白色|红色|蓝色|绿色|黄色|紫色|粉色|灰色).{0,12}(衣服|服装|套装|上衣|裤子|裙子)?/i.test(text);
  const referencePreservingEdit =
    narrowClothingEdit ||
    /(只改|仅修改|保持.{0,16}不变|换成|改成|改为|替换|修改|调整|换色|改色|换背景|去背景|移除|删除|去掉|重做|继续修改|继续改|replace|recolor|edit|change|remove)/i.test(text);

  const rules = [
    "CURRENT TURN IS AUTHORITATIVE. Follow only the current user instruction; history is context, never an unfinished instruction queue.",
    `Current user instruction: ${text}`,
  ];
  if (
    hasReferenceImage &&
    referencePreservingEdit &&
    !explicitPersonCountChange
  ) {
    rules.push(
      "Keep exactly the same number of people and subjects as the primary reference image.",
      "Do not add, duplicate, mirror, clone, split, collage, or place a second person beside the original subject.",
    );
  }
  if (hasReferenceImage && narrowClothingEdit) {
    rules.push(
      "This is a narrow clothing edit: change only the requested garment property.",
      "Preserve the original person's identity, face, body, pose, hands, camera angle, framing, background, lighting, and every unrelated detail.",
    );
  }

  return {
    explicitPersonCountChange,
    referencePreservingEdit,
    narrowClothingEdit,
    guard: rules.join("\n"),
  };
};

const isLikelyImageFile = (file?: File): file is File =>
  !!file && (
    file.type?.startsWith("image/") ||
    /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i.test(file.name || "")
  );

const detectFileAspectRatio = async (
  file?: File,
): Promise<{ width: number; height: number; aspectRatio: string } | null> => {
  if (!isLikelyImageFile(file)) return null;

  const fileAny = file as any;
  const markerInfo = fileAny.markerInfo;
  const knownWidth = Number(
    fileAny.detectedImageWidth ||
    fileAny._previewNaturalWidth ||
    markerInfo?.imageWidth ||
    0,
  );
  const knownHeight = Number(
    fileAny.detectedImageHeight ||
    fileAny._previewNaturalHeight ||
    markerInfo?.imageHeight ||
    0,
  );
  if (knownWidth > 0 && knownHeight > 0) {
    return {
      width: knownWidth,
      height: knownHeight,
      aspectRatio: getNearestSupportedImageAspectRatio(knownWidth, knownHeight),
    };
  }

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      try {
        return {
          width: bitmap.width,
          height: bitmap.height,
          aspectRatio: getNearestSupportedImageAspectRatio(bitmap.width, bitmap.height),
        };
      } finally {
        bitmap.close();
      }
    }
  } catch (error) {
    console.warn("[aspect-ratio] createImageBitmap failed; trying Image decode", error);
  }

  if (typeof Image === "undefined" || typeof URL === "undefined") return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
      image.onerror = () => reject(new Error("Unable to decode reference image dimensions"));
      image.src = objectUrl;
    });
    return {
      ...dimensions,
      aspectRatio: getNearestSupportedImageAspectRatio(dimensions.width, dimensions.height),
    };
  } catch (error) {
    console.warn("[aspect-ratio] Image decode failed", error);
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const truncateText = (value: unknown, maxChars: number): string => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
};

const compactJson = (value: unknown, maxChars: number): string => {
  try {
    return truncateText(JSON.stringify(value || {}), maxChars);
  } catch {
    return "{}";
  }
};

const buildWorkspaceSystemContext = (context?: AgentContext): string => {
  if (!context) return "";
  const payload = {
    workspace: context.workspace,
    productAnalysis: context.product.analysis,
    generationPlan: context.generation,
    assets: context.assets.items.map((asset) => ({
      id: asset.id,
      role: asset.role,
      type: asset.type,
      name: asset.name,
      url: asset.url,
      analysis: asset.analysis,
    })),
    previousResult: context.previousResult,
    activeTask: context.activeTask,
    canvas: context.canvas,
  };

  return `
【WORKSPACE SHARED CONTEXT — 必须继承】
${compactJson(payload, 16_000)}

【省略表达理解规则】
- “生成吧 / 生成 / 开始生成 / 就这个 / 可以 / 继续”表示执行 generationPlan，不是创建新任务。
- “再来一张 / 换一个 / 重新生成”表示沿用当前计划和 referenceImageIds 重新生成。
- “改一下 / 场景更日常一点 / 颜色亮一点”表示更新当前计划，只修改用户明确指出的部分。
- “这个 / 这张 / 上一版 / 刚才的”必须结合 previousResult、assets 和 canvas 理解指代对象。
- generationPlan.referenceImageIds 指向的素材是当前计划的正式参考图，不得因为本轮没有重新上传图片而丢失。
- 当前用户明确要求始终高于历史上下文；未被本轮修改的产品属性、人物身份、服装、场景和构图必须继续保持。
- 禁止把省略表达当成无上下文的新任务。
`.trim();
};

export abstract class EnhancedBaseAgent {
  protected chat: Chat | null = null;
  protected executionCache: Map<string, any> = new Map();

  abstract get agentInfo(): AgentInfo;
  abstract get systemPrompt(): string;
  abstract get preferredSkills(): string[]; // 智能体偏好的技能

  /** 最大并发数（子类可覆盖：图片密集型=3，视频密集型=1，混合=2） */
  get maxConcurrency(): number {
    return 2;
  }

  // 增强生图意图识别：如果消息明确要求视觉产出，则强制调用生图工具
  private shouldForceImageToolCall(
    message: string,
    metadata?: Record<string, any>,
    hasImageAttachment: boolean = false,
  ): boolean {
    // 两步交互 skill 的第一步不强制生图，让 AI 先分析并输出 suggestions
    const skillData = metadata?.skillData as {
      config?: { twoStep?: boolean; forceSkillExecution?: boolean };
      capabilities?: Array<{ primaryTool?: string; outputType?: string }>;
    } | undefined;
    if (skillData?.config?.twoStep) return false;

    // 首页显式选择的图像生成能力，应像画布生图任务一样保证返回可执行调用。
    if (
      skillData?.config?.forceSkillExecution === true &&
      skillData.capabilities?.some(
        (capability) => capability.primaryTool === 'generateImage' && capability.outputType === 'image',
      )
    ) {
      return true;
    }

    // 上游可显式强制
    if (
      metadata?.forceToolCall === true ||
      metadata?.forceGenerateImage === true
    )
      return true;

    // 基础意图识别：明确要产出视觉内容（海报、头图、Banner、Logo、画图等）
    const imageIntent =
      /(生成|出图|做图|画图|画一个|画一张|海报|poster|banner|封面|配图|图片|图像|视觉设计|头部|头图|设计一张|图解|插图|绘图|design a|generate image|create poster|draw)/i.test(
        message,
      );
    const attachedImageEditIntent = hasImageAttachment &&
      /(换成|换到|穿到|套到|改成|改为|替换|修改|调整|变成|增加|添加|加上|再加|多一个|旁边|左边|右边|身后|前面|放入|放一个|站一个|换色|改色|换背景|去背景|抠图|套装|服装|穿搭|试穿|模特|上身|改比例|调整比例|比例.{0,12}(?:错|不对|改|调整)|尺寸.{0,12}(?:错|不对|改|调整)|replace|recolor|edit|change|add|virtual\s*try.?on)/i.test(message);

    // 排除纯咨询或文案类场景
    const consultOnly =
      /(解释|原理|教程|怎么做|如何做|为什么|文字版|仅文案|不需要图|告诉我)/i.test(
        message,
      );

    const result = (imageIntent || attachedImageEditIntent) && !consultOnly;
    if (result) {
      console.log(`[${this.agentInfo.id}] Detect Image Intent: Forced tool call activated.`);
    }
    return result;
  }

  private getSelectedCreativeCapabilities(metadata?: Record<string, any>): any[] {
    const capabilities = metadata?.skillData?.capabilities;
    return Array.isArray(capabilities)
      ? capabilities.filter((capability) => capability && typeof capability.primaryTool === 'string')
      : [];
  }

  private buildCreativeCapabilityFallbackCall(
    capability: any,
    message: string,
    attachments?: File[],
    metadata?: Record<string, any>,
  ): any {
    const instruction = [
      capability?.purpose,
      ...(Array.isArray(capability?.instructions) ? capability.instructions : []),
      message,
    ].filter(Boolean).join('. ');
    const attachmentRefs = (attachments || []).map((_, index) => `ATTACHMENT_${index}`);

    if (capability?.primaryTool === 'generateVideo') {
      return {
        skillName: 'generateVideo',
        params: {
          prompt: instruction,
          aspectRatio: metadata?.preferredAspectRatio || '16:9',
          ...(attachmentRefs[0] ? { startFrame: attachmentRefs[0], referenceImages: attachmentRefs } : {}),
        },
      };
    }

    if (capability?.primaryTool === 'smartEdit') {
      return {
        skillName: 'smartEdit',
        params: {
          sourceUrl: attachmentRefs[0] || 'ATTACHMENT_0',
          editType: capability?.defaults?.editType || 'style-transfer',
          parameters: {
            prompt: instruction,
            preservePrompt: 'Preserve identity, composition, lighting, materials, text, and every untouched area.',
            aspectRatio: metadata?.preferredAspectRatio || '1:1',
            referenceImages: attachmentRefs.slice(1),
          },
        },
      };
    }

    const call = this.buildForcedGenerateImageCall(message, attachments, metadata);
    call.params.prompt = `${instruction}. ${call.params.prompt}`;
    if (capability?.defaults && typeof capability.defaults === 'object') {
      Object.assign(call.params, capability.defaults);
    }
    return call;
  }

  private buildForcedGenerateImageCall(
    message: string,
    attachments?: File[],
    metadata?: Record<string, any>,
  ) {
    // 智能提取比例关键词
    const explicitAspectMatch = message.match(
      /(?:^|\D)(1\s*[:：]\s*1|3\s*[:：]\s*4|4\s*[:：]\s*3|9\s*[:：]\s*16|16\s*[:：]\s*9|21\s*[:：]\s*9|3\s*[:：]\s*2|2\s*[:：]\s*3|4\s*[:：]\s*5|5\s*[:：]\s*4)(?=\D|$)/,
    );
    const explicitAspectRatio = explicitAspectMatch?.[1]
      ?.replace(/\s+/g, "")
      .replace("：", ":");
    let aspectRatio =
      explicitAspectRatio ||
      (metadata?.preferredAspectRatio as string) ||
      "3:4";
    if (!explicitAspectRatio && /(横版|横屏|宽屏|landscape)/i.test(message)) {
      aspectRatio = "16:9";
    } else if (!explicitAspectRatio && /(竖版|竖屏|手机屏|portrait)/i.test(message)) {
      aspectRatio = "9:16";
    } else if (!explicitAspectRatio && /(方图|正方形|square)/i.test(message)) {
      aspectRatio = "1:1";
    }

    // 智能注入布局描述，强化模型对参数的遵循度
    let layoutDescriptor = "";
    if (aspectRatio === "16:9") layoutDescriptor = "ultra-wide cinematic 2k masterpiece, 16:9 landscape orientation, expansive detailed view, ";
    else if (aspectRatio === "9:16") layoutDescriptor = "vertical smartphone 2k wallpaper, 9:16 portrait orientation, vertical detailed composition, ";
    else if (aspectRatio === "4:3") layoutDescriptor = "high-resolution 2k professional 4:3 presentation layout, ";
    else if (aspectRatio === "3:4") layoutDescriptor = "high-definition 2k portrait photography, 3:4 orientation, ";
    else if (aspectRatio === "2:3") layoutDescriptor = "high-definition full-body fashion photography, 2:3 portrait orientation, ";
    else if (aspectRatio === "3:2") layoutDescriptor = "high-resolution editorial photography, 3:2 landscape orientation, ";
    else if (aspectRatio === "4:5") layoutDescriptor = "social-commerce fashion photography, 4:5 portrait orientation, ";
    else if (aspectRatio === "5:4") layoutDescriptor = "high-resolution commercial photography, 5:4 landscape orientation, ";
    else if (aspectRatio === "1:1") layoutDescriptor = "hi-res 2k square format, 1:1 ratio, ";

    // 智能补强：根据消息内容增加基础材质/品类锚点，防止 AI 产生“分类漂移”
    let categoryEnhancer = "";
    if (/(衣服|裤子|裙子|服装|穿穿|试穿|上身|cloth|wear|outfit|dress)/i.test(message)) {
      categoryEnhancer = "fabric texture details, realistic garment draping, ";
    } else if (/(盒|包|瓶|罐|package|box|bottle)/i.test(message)) {
      categoryEnhancer = "packaging structural details, high-end materials, ";
    } else if (/(耳机|科技|电子|机箱|芯片|tech|gadget|headphone)/i.test(message)) {
      categoryEnhancer = "precision industrial components, metallic finish, ";
    }

    const continuationContext = metadata?.continuationContext as
      | {
          isRevision?: boolean;
          previousUserInstruction?: string;
          previousAssistantSummary?: string;
          inheritedPreviousResult?: boolean;
        }
      | undefined;
    const revisionPrompt = continuationContext?.isRevision
      ? `REVISION TASK. The first reference image is the previous generated result and must remain the visual source of truth. Original user task: ${continuationContext.previousUserInstruction || "Preserve the previous design"}. Current correction: ${message}. Change only what the current correction explicitly requests. Preserve every existing person, subject, product, garment, identity, pose, scene, composition, lighting, material, typography, and untouched detail. If the correction asks to add a person or object, keep the existing main subject intact and add the new entity at the requested relative position; never replace the existing subject with the added entity. If the correction only changes aspect ratio, only reframe or outpaint the previous result to ${aspectRatio}; do not redesign, replace, recolor, or invent a different product. `
      : "";

    const forcedCall: any = {
      skillName: "generateImage",
      params: {
        prompt: `${revisionPrompt}${layoutDescriptor}${categoryEnhancer}${message}, high-impact visual design, clean composition, studio lighting, professional 2K digital art, 8K resolution details`,
        aspectRatio,
        quality: "hd",
        resolution: "2048x2048",
        // Keep default aligned with provider alias routing.
        model: "nanobanana2",
      },
    };

    // 有附件时强制锚定【最后一张】附件（通常是用户最新上传的核心主体），防止历史干扰
    if (attachments && attachments.length > 0) {
      const lastIdx = attachments.length - 1;
      const attachmentRefs = attachments.map((_, index) => `ATTACHMENT_${index}`);
      forcedCall.params.referenceImages = attachmentRefs;
      forcedCall.params.referenceImage = `ATTACHMENT_${lastIdx}`;
      forcedCall.params.reference_image_url = `ATTACHMENT_${lastIdx}`;
      forcedCall.params.init_image = `ATTACHMENT_${lastIdx}`;
      forcedCall.params.referencePriority = "first"; // 强制以当前指定的图为主
      forcedCall.params.referenceMode = categoryEnhancer.includes("fabric") ? "portrait" : "product";
      if (continuationContext?.isRevision) {
        forcedCall.params.referenceImage = "ATTACHMENT_0";
        forcedCall.params.reference_image_url = "ATTACHMENT_0";
        forcedCall.params.init_image = "ATTACHMENT_0";
        forcedCall.params.referenceStrength = 0.95;
      }
    }

    return forcedCall;
  }

  private parseRequestedImageCount(message: string): number {
    const match = message.match(MULTI_IMAGE_REQUEST_RE);
    if (!match) return 0;
    const parsed = parseInt(match[1] || match[2] || "0", 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 5;
  }

  private shouldBypassFastPath(message: string): boolean {
    const requestedCount = this.parseRequestedImageCount(message);
    return requestedCount > 1 || ECOM_SET_RE.test(message);
  }

  private shouldForceAutoExecution(
    message: string,
    requestedCount: number,
    forceImageToolCall: boolean,
  ): boolean {
    return (
      forceImageToolCall || requestedCount > 1 || ECOM_SET_RE.test(message)
    );
  }

  private sanitizeSingleFramePrompt(prompt: string): string {
    const cleaned = (prompt || "").replace(BANNED_MULTI_FRAME_TERMS_RE, "").trim();
    if (!cleaned) {
      return "Single product hero shot, one scene only, clean composition, commercial photography, 8k";
    }
    return `${cleaned}. Single frame only, one scene only, no collage, no multi-panel layout.`;
  }

  private buildMultiImageFallbackCalls(
    message: string,
    count: number,
    attachments?: File[],
    metadata?: Record<string, any>,
  ): any[] {
    const safeCount = Math.max(1, Math.min(count || 5, 8));
    const aspectRatio = (metadata?.preferredAspectRatio as string) || "1:1";
    const model = "nanobanana2";
    const variants = [
      {
        title: "白底主图",
        prompt:
          "Single hero product shot, pure white background, centered composition, soft shadow, commercial e-commerce style, 8k",
      },
      {
        title: "卖点信息图",
        prompt:
          "Single product infographic composition, clean white background, callout-friendly layout, feature emphasis, commercial listing style, 8k",
      },
      {
        title: "生活场景图",
        prompt:
          "Single lifestyle in-use scene with product as hero, warm natural light, authentic daily environment, editorial commercial photography, 8k",
      },
      {
        title: "材质细节图",
        prompt:
          "Single macro close-up of product material and texture, premium studio lighting, sharp focus, craftsmanship detail, 8k",
      },
      {
        title: "尺寸包装图",
        prompt:
          "Single size and packaging overview scene, product with box and accessories, clean informative composition, e-commerce visual language, 8k",
      },
      {
        title: "对比优势图",
        prompt:
          "Single comparison-focused scene highlighting product advantage, clear contrast narrative, trustworthy commercial style, 8k",
      },
      {
        title: "性能展示图",
        prompt:
          "Single performance demonstration scene with product as hero, controlled lighting, clear functionality communication, 8k",
      },
      {
        title: "品牌氛围图",
        prompt:
          "Single premium brand storytelling scene with product hero and copy-safe negative space, campaign quality, 8k",
      },
    ];

    return Array.from({ length: safeCount }).map((_, index) => {
      const variant = variants[index] || variants[variants.length - 1];
      const params: Record<string, any> = {
        prompt: this.sanitizeSingleFramePrompt(
          `${variant.prompt}. Product requirement: ${message}`,
        ),
        aspectRatio: aspectRatio,
        model: model,
      };

      if (attachments && attachments.length > 0) {
        params.referenceImages = attachments.map((_, attachmentIndex) => `ATTACHMENT_${attachmentIndex}`);
        params.referenceImage = "ATTACHMENT_0";
        params.referencePriority = attachments.length > 1 ? "all" : "first";
        params.referenceMode = "product";
      }

      return {
        skillName: "generateImage",
        params,
        description: `第 ${index + 1} 张（${variant.title}）`,
      };
    });
  }

  /**
   * 初始化智能体
   */
  async initialize(context: ProjectContext): Promise<void> {
    try {
      this.chat = createChatSession(
        "gemini-3-pro-preview",
        [],
        this.systemPrompt,
      );
      console.log(`[${this.agentInfo.id}] Initialized successfully`);
    } catch (error) {
      throw errorHandler.handleError(error, {
        agent: this.agentInfo.id,
        function: "initialize",
      });
    }
  }

  /**
   * 执行任务（核心方法）
   */
  async execute(
    task: AgentTask,
    config: Partial<ExecutionConfig> = {},
  ): Promise<AgentTask> {
    const finalConfig = { ...DEFAULT_EXECUTION_CONFIG, ...config };
    const taskId = task.id;

    try {
      console.log(`[${this.agentInfo.id}] Starting task execution:`, taskId);

      // 更新任务状态
      task = this.updateTaskStatus(task, "analyzing");

      // 验证输入
      this.validateInput(task);

      // Resolve the output ratio from the actual primary reference before
      // planning. The UI preference (usually 1:1) is only a fallback for
      // text-to-image requests; it must never override an attached image.
      const aspectRatioSource = String(
        task.input.metadata?.preferredAspectRatioSource || "",
      );
      const explicitAspectRatio = getExplicitImageAspectRatio(task.input.message);
      const hasExplicitAspectRatio = ["user", "skill", "scene-fission"].includes(
        aspectRatioSource,
      ) || !!explicitAspectRatio;
      if (explicitAspectRatio) {
        task = {
          ...task,
          input: {
            ...task.input,
            metadata: {
              ...(task.input.metadata || {}),
              preferredAspectRatio: explicitAspectRatio,
              preferredAspectRatioSource: "user",
            },
          },
        };
      } else if (
        task.input.metadata?.creationMode !== "video" &&
        !hasExplicitAspectRatio
      ) {
        const primaryReference = task.input.attachments?.find(isLikelyImageFile);
        const detectedReference = await detectFileAspectRatio(primaryReference);
        if (primaryReference && detectedReference) {
          (primaryReference as any).detectedImageWidth = detectedReference.width;
          (primaryReference as any).detectedImageHeight = detectedReference.height;
          (primaryReference as any).detectedAspectRatio = detectedReference.aspectRatio;
          task = {
            ...task,
            input: {
              ...task.input,
              metadata: {
                ...(task.input.metadata || {}),
                preferredAspectRatio: detectedReference.aspectRatio,
                preferredAspectRatioSource: "reference-image",
              },
            },
          };
          console.log(
            `[${this.agentInfo.id}] Reference ratio locked before planning: ${detectedReference.width}x${detectedReference.height} -> ${detectedReference.aspectRatio}`,
          );
        }
      }

      // 检查缓存
      const harnessRuntimeEnabled = this.shouldUseDeepSeekHarness(task);
      if (finalConfig.enableCache && !harnessRuntimeEnabled) {
        const cached = this.getCachedResult(task);
        if (cached) {
          console.log(`[${this.agentInfo.id}] Using cached result`);
          return this.updateTaskStatus(cached, "completed");
        }
      }

      // 使用错误处理包装器执行
      const result = await errorHandler.withRetry(
        () => this.executeWithTimeout(task, finalConfig.timeout),
        {
          maxRetries: finalConfig.maxRetries,
          delay: 1000,
          backoff: false,
          context: {
            agent: this.agentInfo.id,
            taskId,
            taskType: task.input.message.substring(0, 50),
          },
        },
      );

      // 缓存结果
      if (finalConfig.enableCache && !harnessRuntimeEnabled && result.status === "completed") {
        this.cacheResult(task, result);
      }

      console.log(`[${this.agentInfo.id}] Task completed:`, taskId);
      return result;
    } catch (error) {
      const appError = error as AppError;
      console.error(`[${this.agentInfo.id}] Task failed:`, appError.message);

      return {
        ...task,
        status: "failed",
        output: {
          message: `执行失败: ${appError.message}`,
          error: appError,
        },
        updatedAt: Date.now(),
      };
    }
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout(
    task: AgentTask,
    timeout: number,
  ): Promise<AgentTask> {
    const timeoutController = new AbortController();
    const upstreamSignal = task.input.metadata?.runtimeSignal instanceof AbortSignal
      ? task.input.metadata.runtimeSignal
      : undefined;
    const runtimeSignal = upstreamSignal
      ? AbortSignal.any([upstreamSignal, timeoutController.signal])
      : timeoutController.signal;
    const runtimeTask: AgentTask = {
      ...task,
      input: {
        ...task.input,
        metadata: {
          ...(task.input.metadata || {}),
          runtimeSignal,
        },
      },
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.executeInternal(runtimeTask),
        new Promise<AgentTask>((_, reject) => {
          timer = setTimeout(() => {
            const timeoutError = errorHandler.createError(
              ErrorType.AGENT,
              "任务执行超时",
              undefined,
              { taskId: task.id, timeout },
              true,
            );
            timeoutController.abort(timeoutError);
            reject(timeoutError);
          }, timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private shouldUseDeepSeekHarness(task: AgentTask): boolean {
    if (getProviderConfig().id !== "deepseek") return false;
    if (task.input.metadata?.disableDeepSeekHarness === true) return false;
    return localStorage.getItem("deepseek_harness_enabled") !== "false";
  }

  private buildHarnessHistory(context: ProjectContext): DeepSeekMessage[] {
    const candidates = (context.conversationHistory || [])
      .filter((item) => item?.role === "user" || item?.role === "assistant" || item?.role === "model")
      .slice(-12);
    const messages: DeepSeekMessage[] = [];
    let remainingChars = 18_000;
    for (const item of [...candidates].reverse()) {
      const isUser = item.role === "user";
      const generatedUrls = isUser
        ? []
        : ((item as any)?.agentData?.imageUrls || [])
            .filter((url: unknown): url is string => typeof url === "string" && /^https?:\/\//i.test(url))
            .slice(0, 2);
      const assetNote = generatedUrls.length > 0
        ? `\n[该轮生成资产：${generatedUrls.join(", ")}]`
        : "";
      const raw = isUser
        ? String(item.text || item.content || '')
        : `${sanitizeHarnessHistoryText(item.text || item.content)}${assetNote}`;
      const content = truncateText(raw, Math.min(2400, remainingChars));
      if (!content) continue;
      messages.unshift({ role: isUser ? "user" : "assistant", content });
      remainingChars -= content.length;
      if (remainingChars <= 0) break;
    }
    return messages;
  }

  private async buildHarnessUserContent(task: AgentTask): Promise<DeepSeekContent> {
    const attachments = task.input.attachments || [];
    const attachmentManifest = attachments.length > 0
      ? attachments.map((file, index) => (
          `ATTACHMENT_${index}: ${file.name || `attachment-${index}`} (${file.type || "unknown"})`
        )).join("\n")
      : "无附件";
    const selectedCapabilities = this.getSelectedCreativeCapabilities(task.input.metadata);
    const continuationContext = task.input.metadata?.continuationContext as
      | {
          isRevision?: boolean;
          inheritedPreviousResult?: boolean;
          previousAssetUrl?: string;
        }
      | undefined;
    const continuationInstruction = continuationContext?.isRevision
      ? continuationContext.inheritedPreviousResult
        ? "这是对上一轮实际生成图的续编。ATTACHMENT_0 就是上一轮结果；必须把它作为主参考图，只修改本轮明确要求的内容，禁止重新创造无关人物、服装、场景或构图。"
        : continuationContext.previousAssetUrl
          ? `这是对上一轮实际生成图的续编。上一轮资产 URL：${continuationContext.previousAssetUrl}。必须把它作为主参考图，只修改本轮明确要求的内容，禁止另起新概念。`
          : "这是对上一轮结果的继续修改。必须延续上一轮主体与设计约束，禁止另起新概念。"
      : "";
    const contextText = buildDurableAgentContext({
      currentRequest: task.input.message,
      projectLabel: task.input.context.projectTitle || task.input.context.projectId,
      preferredAspectRatio: task.input.metadata?.preferredAspectRatio,
      preferredAspectRatioSource: task.input.metadata?.preferredAspectRatioSource,
      attachmentManifest: `调用工具时必须使用这些 ATTACHMENT_n 引用：\n${attachmentManifest}`,
      capabilityContract: selectedCapabilities.length > 0
        ? compactJson(selectedCapabilities, 2400)
        : "用户未锁定单一能力，可自主选择合适工具。",
      continuationInstruction,
      brandContext: task.input.context.brandInfo
        ? compactJson(task.input.context.brandInfo, 1000)
        : "",
      designSession: task.input.context.designSession,
      retrievedMemory: typeof task.input.metadata?.topicPinnedContext === 'string'
        ? task.input.metadata.topicPinnedContext
        : '',
    });

    // DeepSeek 4.1 Flash natively understands images. Always attach image
    // content and let the runtime router select Flash for multimodal turns.
    const visionFiles = attachments.filter(isLikelyImageFile).slice(0, 6);
    if (visionFiles.length === 0) return contextText;

    const content: Exclude<DeepSeekContent, string> = [{ type: "text", text: contextText }];
    for (const file of visionFiles) {
      const originalIndex = attachments.indexOf(file);
      const dataUrl = await this.resolveReferenceItem(task, `ATTACHMENT_${originalIndex}`);
      if (dataUrl) content.push({ type: "image_url", image_url: { url: dataUrl } });
    }
    return content;
  }

  private summarizeHarnessToolResult(skillResult: any): unknown {
    if (!skillResult?.success) {
      return { success: false, error: truncateText(skillResult?.error, 1600) };
    }
    const result = skillResult.result;
    if (typeof result === "string") {
      if (result.startsWith("data:")) {
        return { success: true, output: "媒体资产已生成并保留在画布结果中。" };
      }
      if (/^https?:\/\//i.test(result)) {
        return { success: true, output: "媒体资产已生成。", url: result };
      }
      return { success: true, output: truncateText(result, 6000) };
    }
    return { success: true, output: sanitizeObject(result, 6000) };
  }

  private async executeDeepSeekHarness(task: AgentTask): Promise<AgentTask> {
    const store = useAgentStore.getState();
    const sessionId = String(task.input.context.conversationId || task.id).trim();
    const requestedMode = resolveHarnessMode(
      task.input.metadata?.agentMode
        ?? (typeof window !== 'undefined' ? window.localStorage.getItem('xcai_agent_mode') : undefined),
    );
    const harnessSession = new BrowserHarnessSession(sessionId, requestedMode);
    const planCommand = task.input.message.trim().match(/^\/plan(?:\s+(off))?(?:\s+([\s\S]+))?$/i);
    if (planCommand?.[1]?.toLowerCase() === 'off') {
      harnessSession.setMode('craft');
      persistAgentWorkMode('craft');
      return {
        ...task,
        status: 'completed',
        output: {
          message: '规划模式已关闭。下一条消息将恢复自主执行与工具调用。',
          proposals: [],
          assets: [],
          workflowState: {
            type: 'deepseek-harness',
            version: 2,
            provider: 'deepseek',
            model: '智能调度',
            mode: 'craft',
            steps: 0,
            stopReason: 'completed',
            events: [],
            sessionEvents: harnessSession.events.length,
          },
        },
        updatedAt: Date.now(),
      };
    }
    if (planCommand) {
      harnessSession.setMode('plan');
      persistAgentWorkMode('plan');
    }
    const directModeCommand = task.input.message.trim().match(/^\/(craft|ask)(?:\s+[\s\S]+)?$/i);
    if (directModeCommand) {
      const directMode = directModeCommand[1].toLowerCase() as 'craft' | 'ask';
      harnessSession.setMode(directMode);
      persistAgentWorkMode(directMode);
    }
    const harnessMode: HarnessAgentMode = this.agentInfo.id === 'prompt-optimizer'
      ? 'craft'
      : harnessSession.mode;
    const selectedCapabilities = this.getSelectedCreativeCapabilities(task.input.metadata);
    const toolsDisabled = task.input.metadata?.disableTools === true
      || this.agentInfo.id === 'prompt-optimizer'
      || harnessMode === 'ask';
    const coreTools = toolsDisabled ? [] : [
      "updatePlan",
      "generateImage",
      "generateVideo",
      "smartEdit",
      "generateCopy",
      "extractText",
      "analyzeRegion",
      "touchEdit",
    ];
    const selectedTools = selectedCapabilities
      .map((capability) => capability.primaryTool)
      .filter((name): name is string => typeof name === "string");
    let tools = toolsDisabled
      ? []
      : getHarnessToolDefinitions(
          harnessMode === 'plan'
            ? ['updatePlan']
            : selectedTools.length > 0
              ? ['updatePlan', ...selectedTools]
              : coreTools,
        );
    if (!toolsDisabled && tools.length === 0) tools = getHarnessToolDefinitions(coreTools);

    const systemPrompt = [
      buildHarnessSystemPrompt({
        agent: this.agentInfo,
        legacyPrompt: this.systemPrompt,
        selectedCapabilityNames: selectedCapabilities.map((capability) => (
          capability?.name
          || capability?.purpose
          || capability?.id
          || capability?.primaryTool
        )),
        toolAccess: toolsDisabled ? 'none' : 'enabled',
        noToolReason: harnessMode === 'ask' ? 'conversation' : 'prompt-optimizer',
      }),
      buildWorkspaceSystemContext(task.input.context.agentContext),
      toolsDisabled ? '' : "工具参数中的 ATTACHMENT_n 是本轮附件引用。",
      harnessMode === 'plan'
        ? [
            '你现在处于 Plan 规划模式。',
            '- 只调查、分析、澄清并形成可执行计划，不调用任何会产生图片、视频或编辑结果的工具。',
            '- 对多步骤任务使用 updatePlan 维护计划状态。',
            '- 最终回答必须给出完整计划，并明确等待用户确认；不要声称已经执行。',
            '- 用户确认“开始做、帮我做、按这个方案执行”后，系统会切换到 Craft 并继续执行。',
          ].join('\n')
        : harnessMode === 'ask'
          ? [
              '你现在处于 Ask 对话模式。',
              '- 只交流、分析、解释和提出建议，不生成、编辑或保存任何成品。',
              '- 充分使用专业知识、项目记忆、当前附件与会话历史，保持讨论连续。',
              '- 当用户明确表示开始制作时，下一轮会由系统切换到 Craft；本轮不要自行假装执行。',
            ].join('\n')
          : [
              '你现在处于 Craft 执行模式。对明确任务应持续工作到交付结果；多步骤任务使用 updatePlan 维护进度。',
              '不要只描述可以怎样做：需要媒体结果时必须调用对应工具。',
              task.input.metadata?.agentModeTransition
                ? '用户刚刚明确批准开始执行。直接继承前文讨论与已保存计划，不要要求用户重复描述或再次确认。'
                : '',
              harnessSession.plan
                ? `已保存并获准执行的计划：${harnessSession.plan.title}\n${harnessSession.plan.items.map((item, index) => `${index + 1}. ${item.text}`).join('\n')}`
                : '',
            ].filter(Boolean).join('\n'),
      harnessSession.summary
        ? `较早会话的压缩摘要：\n${harnessSession.summary}`
        : '',
    ].join("\n\n");
    const skillResults: any[] = [];
    const signal = task.input.metadata?.runtimeSignal instanceof AbortSignal
      ? task.input.metadata.runtimeSignal
      : undefined;

    let loop: Awaited<ReturnType<typeof runHarnessLoop>>;
    try {
      loop = await runHarnessLoop({
        sessionId,
        mode: harnessMode,
        systemPrompt,
        userContent: await this.buildHarnessUserContent(task),
        history: this.agentInfo.id === 'prompt-optimizer'
            ? []
            : this.buildHarnessHistory(task.input.context),
        tools,
        maxSteps: Number(task.input.metadata?.deepseekMaxSteps || 8),
        maxRequestRetries: Number(task.input.metadata?.deepseekMaxRequestRetries ?? 2),
        signal,
        onEvent: (event) => {
          if (event.type === "step/start") {
            store.actions.setCurrentTask({
              ...task,
              status: "analyzing",
              progressMessage: `XcAI 正在执行第 ${event.step} 步...`,
              progressStep: event.step,
              totalSteps: Number(task.input.metadata?.deepseekMaxSteps || 8),
            });
          } else if (event.type === "tool/call") {
            store.actions.setCurrentTask({
              ...task,
              status: "executing",
              progressMessage: `正在调用 ${event.name}...`,
              progressStep: event.step,
              totalSteps: Number(task.input.metadata?.deepseekMaxSteps || 8),
            });
          }
        },
        executeTools: async (prepared) => {
          const mediaPrepared = prepared.filter(({ call }) => call.function.name !== 'updatePlan');
          const calls = mediaPrepared.map(({ call, args }) => ({
            skillName: call.function.name,
            params: args,
          }));
          const results = calls.length > 0 ? await this.executeSkills(calls, task) : [];
          skillResults.push(...results);
          let mediaIndex = 0;
          return prepared.map(({ call, args }): HarnessToolExecution => {
            if (call.function.name === 'updatePlan') {
              try {
                const plan = harnessSession.updatePlan(args);
                return { call, args, success: true, result: { success: true, plan } };
              } catch (error) {
                return {
                  call,
                  args,
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            }
            const result = results[mediaIndex++];
            return {
              call,
              args,
              success: result?.success === true,
              result: this.summarizeHarnessToolResult(result),
              ...(result?.success === true ? {} : { error: result?.error || "工具执行失败" }),
            };
          });
        },
      });
    } finally {
      store.actions.setCurrentTask(null);
    }

    const assets = this.extractAssets(skillResults);
    const normalizedResponse = normalizeHarnessResponse(
      loop.text,
      assets.length > 0
        ? `任务已完成，共生成 ${assets.length} 个资产。`
        : "任务已完成。",
    );
    const allToolsFailed = skillResults.length > 0 && skillResults.every((item) => item?.success !== true);
    const exhaustedWithoutResult = loop.stopReason === "max-steps" && assets.length === 0;
    const compactEvents = loop.events.map((event) => {
      if (event.type === "assistant/reasoning") {
        // Keep the lifecycle marker for the Hermes-style trace, but never
        // persist or render raw chain-of-thought/system-prompt fragments.
        return { ...event, text: "已完成本步骤的分析与决策。" };
      }
      if (event.type === "assistant/message") {
        return {
          ...event,
          text: truncateText(normalizeHarnessResponse(event.text, "").text, 1600),
        };
      }
      if (event.type === "tool/result") {
        return {
          ...event,
          content: event.success
            ? "工具执行成功。"
            : truncateText(event.content, 240),
        };
      }
      if (event.type === "tool/call") {
        // Arguments can contain full generation prompts and attachment
        // manifests. The UI only needs identity/status, not the payload.
        const { arguments: _arguments, ...safeEvent } = event;
        return safeEvent;
      }
      return event;
    });
    return {
      ...task,
      status: allToolsFailed || exhaustedWithoutResult ? "failed" : "completed",
      output: {
        message: loop.stopReason === "max-steps" && assets.length > 0
          ? `已保留本轮生成的 ${assets.length} 个资产；Agent 达到最大执行步数后已安全停止。`
          : normalizedResponse.text,
        proposals: [],
        assets,
        imageUrls: assets.map((asset) => asset.url),
        skillCalls: skillResults,
        workflowState: {
          type: "deepseek-harness",
          version: 2,
          provider: "deepseek",
          model: loop.model,
          mode: loop.mode,
          steps: loop.steps,
          stopReason: loop.stopReason,
          events: compactEvents,
          sessionEvents: loop.sessionEvents,
          plan: harnessSession.plan,
        },
        ...(allToolsFailed || exhaustedWithoutResult ? {
          error: {
            code: allToolsFailed ? "HARNESS_TOOL_EXECUTION_FAILED" : "HARNESS_MAX_STEPS",
            message: allToolsFailed
              ? skillResults.find((item) => item?.error)?.error || "所有工具调用均执行失败。"
              : "Agent 达到最大执行步数，本轮没有生成可保留的资产。请缩小任务范围后重试。",
          },
        } : {}),
        adjustments: Array.from(new Set([
          ...normalizedResponse.suggestions,
          ...(assets.length > 0 ? this.getAdjustments(task.input.message, []) : []),
        ])),
      },
      updatedAt: Date.now(),
    };
  }

  /**
   * 内部执行逻辑（使用Skills）
   */
  private async executeInternal(task: AgentTask): Promise<AgentTask> {
    const { message, context } = task.input;
    const store = useAgentStore.getState();
    const workMode = resolveHarnessMode(task.input.metadata?.agentMode) || 'craft';
    const skillData = task.input.metadata?.skillData as
      | { id?: string; config?: Record<string, any> }
      | undefined;
    const sceneFissionWorkflow = task.input.metadata?.sceneFissionWorkflow as
      | SceneFissionWorkflowState
      | undefined;
    const forceImageToolCall = workMode === 'craft' && this.shouldForceImageToolCall(
      message,
      task.input.metadata,
      !!task.input.attachments?.some((file) => file.type?.startsWith('image/')),
    );

    // Step 1: 接受任务
    store.actions.setCurrentTask({
      ...task,
      status: "analyzing",
      progressMessage: `好的，我来为您处理这个请求`,
      progressStep: 1,
      totalSteps: 4,
    });

    // 1. 分析任务并生成执行计划
    // Step 2: 分析需求
    store.actions.setCurrentTask({
      ...task,
      status: "analyzing",
      progressMessage: "正在分析您的需求，制定创作方案...",
      progressStep: 2,
      totalSteps: 4,
    });

    if (workMode === 'craft' && skillData?.id === "xcai-oneclick") {
      store.actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage: "正在执行 SKYSPER 一键流程（Startup -> P5）...",
        progressStep: 3,
        totalSteps: 4,
      });

      const oneclickResult = await executeSkill("xcaiOneclick", {
        input: {
          message,
          referenceImages: task.input.uploadedAttachments || [],
          attachments: task.input.uploadedAttachments || [],
        },
        config: skillData.config || {},
      });

      return {
        ...task,
        status: "completed",
        output: {
          message:
            typeof oneclickResult === "string"
              ? oneclickResult
              : "SKYSPER One-Click 执行完成。",
          analysis: "已按 Core + Packs 方式完成 Startup、P0-P5 分阶段编排。",
          proposals: [],
          assets: [],
          adjustments: ["可继续：按 P3 主图指令直接生成", "可继续：按 P4 输出分批生成副图"],
        },
        updatedAt: Date.now(),
      };
    }

    if (!sceneFissionWorkflow && this.shouldUseDeepSeekHarness(task)) {
      return this.executeDeepSeekHarness(task);
    }

    // 场景裂变是严格的两阶段流程：第一阶段只展示 A/B/C，不允许调用生图工具。
    if (sceneFissionWorkflow?.phase === "plan") {
      const hasReference = !!task.input.attachments?.some((file) =>
        file.type?.startsWith("image/"),
      );
      if (!hasReference) {
        store.actions.setCurrentTask(null);
        return {
          ...task,
          status: "completed",
          output: {
            message: "请先上传至少一张模特场景参考图。我会严格锁定人物、服装、原场景和光线，再提供 A/B/C 三套场景裂变方案。输出比例默认 2:3，也可以直接告诉我其他比例。",
            analysis: "场景裂变需要参考图作为人物、服装、场景与光线的唯一视觉基准。",
            proposals: [],
            assets: [],
            workflowState: {
              ...sceneFissionWorkflow,
              phase: "plan",
              schemes: [],
            },
          },
          updatedAt: Date.now(),
        };
      }

      let schemes = buildDefaultSceneFissionSchemes();
      try {
        const visualPlan = await this.analyzeAndPlan(
          message,
          context,
          task.input.attachments,
          task.input.uploadedAttachments,
          {
            ...(task.input.metadata || {}),
            specializedRole: "scene-fission",
            forceGenerateImage: false,
            forceToolCall: false,
            forceSkills: false,
          },
        );
        schemes = normalizeSceneFissionSchemes(visualPlan?.proposals);
      } catch (error) {
        console.warn(
          `[${this.agentInfo.id}] Scene-fission visual planning failed; using deterministic schemes.`,
          error,
        );
      }
      const aspectRatio = sceneFissionWorkflow.aspectRatio || "2:3";
      store.actions.setCurrentTask(null);
      return {
        ...task,
        status: "completed",
        output: {
          message: `我已按同一模特、同一服装、同一原场景和同一光线，整理出三套场景裂变分镜。请选择方案 A、B 或 C，并确认输出比例；当前默认 ${aspectRatio}。`,
          analysis: "三套方案都严格锁定参考图，只改变动作、机位、景别、视线与构图；每套均包含 9 个连续拍摄镜头。",
          proposals: schemes.map((scheme) => ({
            id: scheme.id,
            title: scheme.title,
            description: `${scheme.summary}\n\n九镜头：${scheme.shots.map((shot) => `${shot.index}. ${shot.shotName}`).join("、")}`,
            skillCalls: [],
            selectionPrompt: `我选择场景裂变方案 ${scheme.id}，比例 ${aspectRatio}，请生成九宫格分镜。`,
            actionLabel: `选择方案 ${scheme.id}`,
          })) as any,
          assets: [],
          workflowState: {
            type: "scene-fission",
            phase: "awaiting-selection",
            aspectRatio,
            schemes,
          },
          adjustments: [
            "选择 A / B / C",
            `当前比例 ${aspectRatio}，可改为 4:5、3:4、9:16 等`,
          ],
        },
        updatedAt: Date.now(),
      };
    }

    if (
      task.input.metadata?.specializedRole === "fashion-replica" &&
      !task.input.attachments?.some((file) => file.type?.startsWith("image/"))
    ) {
      store.actions.setCurrentTask(null);
      return {
        ...task,
        status: "completed",
        output: {
          message: "请先上传需要复刻的参考图；如果目标服装、模特身份或场景来自不同图片，也可以一起上传，我会按产品图、模特图、姿势图、场景图和色调图自动分工。",
          analysis: "严格复刻角色需要至少一张参考图作为 Target Image State，不能在没有视觉依据时自由生成。",
          proposals: [],
          assets: [],
        },
        updatedAt: Date.now(),
      };
    }

    // 1.5 定义字段名容错修复函数
    const fixSkillCalls = (obj: any) => {
      if (!obj || typeof obj !== "object") return;
      const keys = Object.keys(obj);
      for (const key of keys) {
        const lowerKey = key.toLowerCase();
        const isSkillKey = [
          "skillcalls",
          "skills",
          "calls",
          "actions",
          "tool_calls",
          "skill_calls",
        ].includes(lowerKey);
        if (isSkillKey && Array.isArray(obj[key]) && obj[key].length > 0) {
          if (!obj.skillCalls || obj.skillCalls.length === 0) {
            obj.skillCalls = obj[key];
          }
        }
      }
    };

    let plan: any;

    const workflowMode =
      task.input.metadata?.workflowMode === "fast" ? "fast" : "designer";
    const isThinkingMode = useAgentStore.getState().modelMode === "thinking";
    const requestedCount = this.parseRequestedImageCount(message);
    const bypassFastPath = this.shouldBypassFastPath(message);
    const shouldUseFastPath =
      workflowMode === "fast" &&
      forceImageToolCall &&
      !isThinkingMode &&
      !bypassFastPath;

    if (sceneFissionWorkflow?.phase === "generate") {
      const schemes = sceneFissionWorkflow.schemes?.length
        ? sceneFissionWorkflow.schemes
        : buildDefaultSceneFissionSchemes();
      const selectedScheme =
        schemes.find(
          (scheme) => scheme.id === sceneFissionWorkflow.selectedSchemeId,
        ) || schemes[0];
      const aspectRatio = sceneFissionWorkflow.aspectRatio || "2:3";
      const referenceImages = (task.input.attachments || []).map(
        (_, index) => `ATTACHMENT_${index}`,
      );
      plan = {
        analysis: `已选择${selectedScheme.title}，将按 ${aspectRatio} 生成严格连续的九宫格场景分镜。`,
        preGenerationMessage: `正在按${selectedScheme.title}生成 3×3 场景裂变分镜，比例为 ${aspectRatio}。`,
        postGenerationSummary: `已按${selectedScheme.title}完成九宫格场景裂变；人物、服装、原场景与光线均作为强约束保持一致。`,
        message: `已按${selectedScheme.title}开始生成九宫格分镜。`,
        skillCalls: [
          {
            skillName: "generateImage",
            params: {
              prompt: buildSceneFissionContactSheetPrompt(
                selectedScheme,
                aspectRatio,
              ),
              model: "nanobanana2",
              aspectRatio,
              referenceImages,
              referenceImage: referenceImages[0] || "ATTACHMENT_0",
              referencePriority: "first",
              referenceStrength: 0.95,
              referenceMode: "portrait",
              quality: "hd",
              imageSize: "2K",
            },
          },
        ],
        proposals: [],
        suggestions: ["继续微调其中一个镜头", "保持方案改用其他比例"],
      };
    } else if (shouldUseFastPath) {
      console.log(
        `[${this.agentInfo.id}] Fast workflow enabled: skipping planning stage.`,
      );
      const directCall = this.buildForcedGenerateImageCall(
        message,
        task.input.attachments,
        task.input.metadata,
      );
      directCall.params.prompt = this.sanitizeSingleFramePrompt(
        directCall.params.prompt || "",
      );
      plan = {
        analysis: "已识别为快速生图模式，跳过方案沟通并直接执行。",
        preGenerationMessage: "已收到需求，正在快速生成视觉稿。",
        postGenerationSummary: "本次快速模式已完成基础构图与视觉输出，可继续精修。",
        message: "好的，正在根据您的需求直接开始生成。",
        skillCalls: [directCall],
        proposals: [],
        suggestions: ["换个风格重试", "改成其他比例"],
      };
    } else {
      try {
        plan = await this.analyzeAndPlan(
          message,
          context,
          task.input.attachments,
          task.input.uploadedAttachments,
          {
            ...(task.input.metadata || {}),
            forceImageToolCall,
          },
        );
      } catch (error) {
        console.error(`[${this.agentInfo.id}] analyzeAndPlan failed:`, error);
        if (forceImageToolCall) {
          if (requestedCount > 1 || bypassFastPath) {
            const fallbackCount = Math.max(requestedCount, 5);
            console.warn(
              `[${this.agentInfo.id}] Analysis failed for multi-image task. Using decomposed fallback calls (${fallbackCount}).`,
            );
            plan = {
              analysis: "分析阶段超时，已自动切换为多图拆解兜底执行。",
              preGenerationMessage: `正在为您拆解并并行生成 ${fallbackCount} 张独立图片。`,
              postGenerationSummary: "本次已按单图策略拆解生成，可继续逐张微调。",
              message: `已按多图需求拆解为 ${fallbackCount} 个独立画面并开始生成。`,
              skillCalls: this.buildMultiImageFallbackCalls(
                message,
                fallbackCount,
                task.input.attachments,
                task.input.metadata,
              ),
              proposals: [],
            };
          } else {
            console.warn(
              `[${this.agentInfo.id}] Analysis failed but image intent detected. Using single fallback call.`,
            );
            plan = {
              analysis: "分析阶段超时，已为您进入安全降级的直接出图流程。",
              preGenerationMessage:
                "我已理解您的设计目标，先为您生成首版视觉稿，随后给出设计复盘。",
              postGenerationSummary:
                "首版已完成，后续可按风格、构图和光影继续微调。",
              message: "分析稍慢，我先为您生成第一版图像。",
              skillCalls: [
                this.buildForcedGenerateImageCall(
                  message,
                  task.input.attachments,
                  task.input.metadata,
                ),
              ],
            };
          }
        } else {
          throw error;
        }
      }
    }

    // Plan and Ask are non-executing modes across every provider. Even if a
    // legacy model returns skill calls, stop here before any tool can run.
    if (workMode !== 'craft') {
      const sessionId = String(context.conversationId || task.id).trim();
      const modeSession = new BrowserHarnessSession(sessionId, workMode);
      let savedPlan = modeSession.plan;
      if (workMode === 'plan') {
        const proposedSteps = [
          ...(Array.isArray(plan?.proposals)
            ? plan.proposals.map((proposal: any) => proposal?.title || proposal?.description)
            : []),
          ...(Array.isArray(plan?.suggestions) ? plan.suggestions : []),
        ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        const uniqueSteps = Array.from(new Set(proposedSteps)).slice(0, 12);
        savedPlan = modeSession.updatePlan({
          title: String(plan?.title || '当前任务执行计划').slice(0, 200),
          items: (uniqueSteps.length > 0 ? uniqueSteps : [String(plan?.message || message)])
            .map((text) => ({ text: text.slice(0, 500), status: 'pending' as const })),
        });
      }

      return {
        ...task,
        status: 'completed',
        output: {
          message: String(
            plan?.message
            || plan?.analysis
            || (workMode === 'plan'
              ? '计划已经整理完成。确认后告诉我“开始做”，我会切换到 Craft 执行。'
              : '我们可以继续讨论和完善这个想法；Ask 模式不会执行生成或编辑。'),
          ),
          analysis: plan?.analysis,
          proposals: [],
          assets: [],
          suggestions: Array.isArray(plan?.suggestions) ? plan.suggestions : [],
          workflowState: {
            type: 'agent-work-mode',
            version: 1,
            provider: getProviderConfig().id,
            mode: workMode,
            plan: savedPlan,
          },
        },
        updatedAt: Date.now(),
      };
    }

    // 修复顶层和 proposals 内部的字段名
    fixSkillCalls(plan);
    if (Array.isArray(plan.proposals)) {
      plan.proposals.forEach(fixSkillCalls);
    }

    if (!plan.preGenerationMessage && forceImageToolCall) {
      plan.preGenerationMessage = this.composePreGenerationMessage(task, plan);
    }

    console.log(`[${this.agentInfo.id}] Plan received:`, {
      hasProposals: !!(plan.proposals && plan.proposals.length),
      proposalCount: plan.proposals?.length || 0,
      hasSkillCalls: !!(plan.skillCalls && plan.skillCalls.length),
      skillCallCount: plan.skillCalls?.length || 0,
      forceImageToolCall,
    });

    // 2. 检测用户是否请求了多张图
    const requestedCountFromMessage = this.parseRequestedImageCount(message);

    let effectiveProposals =
      plan.proposals && plan.proposals.length > 0 ? [...plan.proposals] : [];

    // 3.5 修复: AI 可能用不同的字段名返回 skillCalls（如 skills, calls, actions 等）
    for (const p of effectiveProposals) {
      if (!p.skillCalls || p.skillCalls.length === 0) {
        // 尝试常见的别名和不同的大小写
        const keys = Object.keys(p);
        for (const key of keys) {
          const lowerKey = key.toLowerCase();
          if (
            [
              "skillcalls",
              "skills",
              "calls",
              "actions",
              "skill_calls",
              "tool_calls",
            ].includes(lowerKey)
          ) {
            if (p[key] && Array.isArray(p[key]) && p[key].length > 0) {
              console.log(
                `[${this.agentInfo.id}] Fixed proposal "${p.title}": renamed "${key}" -> "skillCalls"`,
              );
              p.skillCalls = p[key];
              break;
            }
          }
        }
      }
    }

    // 4. 如果 proposals 为空或 proposals 内没有 skillCalls，但顶层有 skillCalls，尝试修复
    const proposalsHaveSkills = effectiveProposals.some(
      (p: any) => p.skillCalls && p.skillCalls.length > 0,
    );

    if (!proposalsHaveSkills && plan.skillCalls && plan.skillCalls.length > 0) {
      console.log(
        `[${this.agentInfo.id}] Proposals missing skillCalls, restructuring from top-level skillCalls`,
      );

      if (
        requestedCountFromMessage > 1 &&
        plan.skillCalls.length === 1 &&
        !["cameron", "vireo", "motion"].includes(this.agentInfo.id)
      ) {
        // 用户要求多张图但只有1个 skillCall — 使用共享电商套图模块生成变体（仅限产品设计类智能体）
        const baseCall = plan.skillCalls[0];
        const basePrompt = baseCall.params?.prompt || "";
        effectiveProposals = buildEcommerceProposals(
          basePrompt,
          {
            aspectRatio: baseCall.params?.aspectRatio,
            model: baseCall.params?.model,
          },
          requestedCountFromMessage,
        );
        console.log(
          `[${this.agentInfo.id}] Created ${effectiveProposals.length} variant proposals from single skillCall`,
        );
      } else {
        // 将每个顶层装成一个 proposal
        effectiveProposals = plan.skillCalls.map((call: any, idx: number) => ({
          id: String(idx + 1),
          title: `方案 ${idx + 1}`,
          description: call.params?.prompt?.substring(0, 80) || "",
          skillCalls: [call],
        }));
      }
    }

    // 4.5 最后的兜底: proposals 有数据但 skillCalls 仍然为空 — 从 proposal 的 prompt 字段自动构建
    const stillNoSkills = !effectiveProposals.some(
      (p: any) => p.skillCalls && p.skillCalls.length > 0,
    );
    if (stillNoSkills && effectiveProposals.length > 0) {
      console.warn(
        `[${this.agentInfo.id}] Proposals exist but ALL lack skillCalls — auto-building from proposal data`,
      );
      console.log(
        `[${this.agentInfo.id}] Raw proposal keys:`,
        effectiveProposals.map((p: any) => Object.keys(p)),
      );

      for (const p of effectiveProposals) {
        // 尝试从 proposal 内提取 prompt（AI 可能把 prompt 直接放到 proposal 顶层）
        const prompt =
          p.prompt || p.imagePrompt || p.image_prompt || p.params?.prompt || "";
        const model = p.model || p.params?.model || "nanobanana2";
        const ratio =
          p.aspectRatio ||
          p.aspect_ratio ||
          p.ratio ||
          p.params?.aspectRatio ||
          "1:1";

        if (prompt) {
          // 注入布局描述词：模型更倾向于听 Prompt 里的描述而非参数
          const layoutMap: Record<string, string> = {
            '1:1': 'square format, centered composition, 1:1 aspect ratio',
            '16:9': 'wide screen cinematic, 16:9 landscape orientation',
            '9:16': 'vertical smartphone screen, 9:16 portrait orientation',
            '4:3': 'standard traditional photography, 4:3 landscape',
            '3:4': 'classic portrait photography, 3:4 orientation'
          };
          const layoutDesc = layoutMap[ratio] || '';
          const finalPrompt = layoutDesc ? `${layoutDesc}, ${prompt}` : prompt;

          p.skillCalls = [
            {
              skillName: "generateImage",
              params: {
                prompt: finalPrompt,
                aspect_ratio: ratio,
                model: model,
              },
              explanation: `正在按要求制作一张 ${ratio === '16:9' ? '横版' : (ratio === '9:16' ? '竖版' : '指定比例')} 的图片...`
            },
          ];
          console.log(
            `[${this.agentInfo.id}] Auto-built skillCall for "${p.title}" from prompt field`,
          );
        }
      }

      // 如果连 prompt 字段也没有，从 description 或 title 生成
      const stillEmpty = !effectiveProposals.some(
        (p: any) => p.skillCalls && p.skillCalls.length > 0,
      );
      if (stillEmpty) {
        console.warn(
          `[${this.agentInfo.id}] No prompt field found — building from description`,
        );
        for (const p of effectiveProposals) {
          const fallbackPrompt = p.description || p.title || message;
          if (fallbackPrompt) {
            p.skillCalls = [
              {
                skillName: "generateImage",
                params: {
                  prompt: fallbackPrompt,
                  model: "nanobanana2",
                  aspectRatio:
                    task.input.metadata?.preferredAspectRatio || "1:1",
                },
              },
            ];
          }
        }
      }
    }

    const mustAutoExecute = this.shouldForceAutoExecution(
      message,
      requestedCountFromMessage,
      forceImageToolCall,
    );

    // 5.5 如果 AI 选择对话而非直接生成（proposals 为空但有 message，且不是强制执行任务），返回对话响应
    if (
      effectiveProposals.length === 0 &&
      plan.message &&
      !plan.skillCalls?.length &&
      !task.input.metadata?.forceSkills &&
      !mustAutoExecute
    ) {
      return {
        ...task,
        status: "completed",
        output: {
          message: plan.message,
          analysis: plan.analysis,
          proposals: [],
          assets: [],
          adjustments: plan.suggestions || [],
        },
        updatedAt: Date.now(),
      };
    }

    // 6. 执行顶层 Skills（无 proposals 的情况）
    // 如果已经有了 proposals，默认进入“预览 -> 选择”流程，除非 metadata.forceSkills 明确要求立即执行。
    let fallbackSkillCalls = [];
    if (effectiveProposals.length === 0) {
      fallbackSkillCalls = plan.skillCalls || [];

      // Poster 强制出图兜底：如果模型未给出 skillCalls，直接注入 generateImage。
      if (forceImageToolCall && fallbackSkillCalls.length === 0) {
        console.warn(
          `[${this.agentInfo.id}] forceImageToolCall active: injecting fallback generateImage call.`,
        );
        fallbackSkillCalls = [
          this.buildForcedGenerateImageCall(
            message,
            task.input.attachments,
            task.input.metadata,
          ),
        ];
      }

      // 6.5 Fallback 兜底: 如果 Plan 中有 prompt 但没有 skillCalls，自动构建
      if (fallbackSkillCalls.length === 0) {
        const planPrompt =
          plan.prompt || plan.imagePrompt || plan.image_prompt || "";
        if (planPrompt) {
          console.log(
            `[${this.agentInfo.id}] Fallback: building skillCall from plan.prompt`,
          );
          fallbackSkillCalls = [
            {
              skillName: "generateImage",
              params: {
                prompt: planPrompt,
                 model: plan.model || "nanobanana2",
                aspectRatio:
                  task.input.metadata?.preferredAspectRatio ||
                  plan.aspectRatio ||
                  plan.aspect_ratio ||
                  "1:1",
              },
            },
          ];
        } else {
          console.warn(
            `[${this.agentInfo.id}] No skillCalls, no proposals with skills, no prompt found. Plan keys:`,
            Object.keys(plan),
          );

          if (mustAutoExecute) {
            fallbackSkillCalls =
              requestedCountFromMessage > 1
                ? this.buildMultiImageFallbackCalls(
                  message,
                  requestedCountFromMessage,
                  task.input.attachments,
                  task.input.metadata,
                )
                : [
                  this.buildForcedGenerateImageCall(
                    message,
                    task.input.attachments,
                    task.input.metadata,
                  ),
                ];
            console.warn(
              `[${this.agentInfo.id}] Forced execution guard activated. Built ${fallbackSkillCalls.length} fallback skillCalls.`,
            );
          }
        }
      }
    } else {
      console.log(
        `[${this.agentInfo.id}] Proposals exist. Skipping fallback skill execution.`,
      );
    }

    // 6.8 默认直执行：有 proposals 时不再停在预览确认，直接执行对应 skillCalls

    // 7. 执行技能：优先执行用户选中的 proposal skillCalls
    const selectedSkillCalls = Array.isArray(
      task.input.metadata?.selectedSkillCalls,
    )
      ? task.input.metadata.selectedSkillCalls
      : [];

    let activeSkillCalls = [...fallbackSkillCalls];

    if (selectedSkillCalls.length > 0) {
      console.log(
        `[${this.agentInfo.id}] Executing selected proposal skillCalls: ${selectedSkillCalls.length}`,
      );
      activeSkillCalls = selectedSkillCalls;
    } else if (effectiveProposals.length > 0) {
      console.log(
        `[${this.agentInfo.id}] Auto executing proposal skillCalls: ${effectiveProposals.length} proposals.`,
      );
      for (const p of effectiveProposals) {
        if (p.skillCalls && p.skillCalls.length > 0) {
          activeSkillCalls = [...activeSkillCalls, ...p.skillCalls];
        }
      }
    }

    const selectedCreativeCapabilities = this.getSelectedCreativeCapabilities(task.input.metadata);
    const forceSelectedSkill = task.input.metadata?.forceSelectedSkill === true;
    if (forceSelectedSkill && selectedCreativeCapabilities.length > 0) {
      const primaryTools = Array.from(new Set(
        selectedCreativeCapabilities.map((capability) => capability.primaryTool),
      ));

      // A selected Skill is an executable contract. Discard unrelated model calls and
      // guarantee at least one call to each selected primary function.
      activeSkillCalls = activeSkillCalls.filter((call: any) => primaryTools.includes(call?.skillName));
      for (const capability of selectedCreativeCapabilities) {
        if (!activeSkillCalls.some((call: any) => call?.skillName === capability.primaryTool)) {
          activeSkillCalls.push(this.buildCreativeCapabilityFallbackCall(
            capability,
            message,
            task.input.attachments,
            task.input.metadata,
          ));
        }
      }
    }

    const selectedSkillsAreImageGeneration = selectedCreativeCapabilities.length === 0
      || selectedCreativeCapabilities.every((capability) => capability.primaryTool === 'generateImage');
    if (requestedCountFromMessage > 1 && selectedSkillsAreImageGeneration) {
      if (activeSkillCalls.length <= 1) {
        activeSkillCalls = this.buildMultiImageFallbackCalls(
          message,
          requestedCountFromMessage,
          task.input.attachments,
          task.input.metadata,
        );
        console.warn(
          `[${this.agentInfo.id}] Multi-image guard activated: expanded to ${activeSkillCalls.length} generateImage calls.`,
        );
      }

      activeSkillCalls = activeSkillCalls.map((call: any) => {
        if (call?.skillName === "generateImage") {
          call.params = call.params || {};
          call.params.prompt = this.sanitizeSingleFramePrompt(
            call.params.prompt || "",
          );
        }
        return call;
      });
    }

    let skillResults = [];
    if (activeSkillCalls.length > 0) {
      // Step 3: 生成中
      const imageCount = activeSkillCalls.filter(
        (c) =>
          c.skillName === "generateImage" || c.skillName === "imageGenSkill",
      ).length;
      const videoCount = activeSkillCalls.filter(
        (c) =>
          c.skillName === "generateVideo" || c.skillName === "videoGenSkill",
      ).length;
      const genDesc =
        imageCount > 0
          ? `${imageCount} 张图片`
          : videoCount > 0
            ? `${videoCount} 个视频`
            : "内容";

      store.actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage:
          plan.preGenerationMessage || `方案已就绪，正在生成${genDesc}...`,
        progressStep: 3,
        totalSteps: 4,
      });

      // --- [XC-STUDIO 优化] 提前将分析和生成中状态推入聊天 ----
      const existing = store.messages.find((m) => m.id === task.id);
      if (!existing) {
        store.actions.addMessage({
          id: task.id,
          role: "model",
          text: plan.preGenerationMessage || `现在我将为您生成${genDesc}。`,
          timestamp: Date.now(),
          agentData: {
            model: task.agentId,
            title: "智能助理",
            analysis: plan.analysis,
            isGenerating: true,
          },
        });
      }

      skillResults = await this.executeSkills(activeSkillCalls, task);
    }

    // 7. 提取生成的资产
    const assets = this.extractAssets(skillResults);
    const assetUrls = assets.map((a) => a.url);
    const imageGenerationResults = skillResults.filter(
      (result: any) => result?.skillName === "generateImage" || result?.skillName === "imageGenSkill",
    );
    const failedImageGeneration = assets.length === 0
      && imageGenerationResults.length > 0
      && imageGenerationResults.every((result: any) => result?.success !== true);
    const firstGenerationError = imageGenerationResults.find(
      (result: any) => result?.success !== true && result?.error,
    )?.error;

    // Step 4: 完成
    if (assets.length > 0) {
      store.actions.setCurrentTask({
        ...task,
        status: "executing",
        progressMessage: `已生成 ${assets.length} 张图片，正在添加到画布...`,
        progressStep: 4,
        totalSteps: 4,
      });
    }

    // 8. 组装最终输出
    // 如果资产生成成功，message 应该是完成反馈；否则使用分析信息
    let finalMessage =
      failedImageGeneration
        ? `图片生成失败：${firstGenerationError || "当前图片服务暂时不可用，请稍后重试。"}`
        : assets.length > 0
        ? plan.message ||
        `我已根据方案为您生成了 ${assets.length} 张图片并添加至画布。`
        : plan.message || plan.analysis || "任务已完成";

    const postGenerationSummary =
      plan.postGenerationSummary ||
      (assets.length > 0
        ? this.composePostGenerationSummary(task, plan, assets.length)
        : undefined);

    if (assets.length > 0 && postGenerationSummary) {
      finalMessage = `${finalMessage}\n\n${postGenerationSummary}`;
    }

    // 彻底清理文本中的 json:generation 块（支持多行和代码块语法），防止前端渲染多余按钮
    finalMessage = finalMessage
      .replace(/```json:generation\s*[\s\S]*?```/g, "")
      .trim();

    // 最终清理环节：重置任务状态，确保进度 UI 彻底消失
    store.actions.setCurrentTask(null);

    return {
      ...task,
      status: failedImageGeneration ? "failed" : "completed",
      output: {
        message: finalMessage,
        ...(failedImageGeneration ? {
          error: {
            message: firstGenerationError || "所有图片生成通道均执行失败。",
            code: "IMAGE_GENERATION_FAILED",
          },
        } : {}),
        analysis: plan.analysis,
        preGenerationMessage: plan.preGenerationMessage,
        postGenerationSummary,
        // 默认直执行模式下，不返回 proposals，避免前端继续展示“立即生成”卡片
        proposals: [],
        assets,
        imageUrls: assetUrls, // 同步到 imageUrls 供 AgentMessage 列表渲染
        skillCalls: skillResults,
        ...(sceneFissionWorkflow?.phase === "generate"
          ? {
              workflowState: {
                ...sceneFissionWorkflow,
                phase: "completed",
              },
            }
          : {}),
        adjustments:
          assets.length > 0
            ? this.getAdjustments(message, effectiveProposals)
            : plan.suggestions || [],
      },
      updatedAt: Date.now(),
    };
  }

  /**
   * 分析任务并制定执行计划
   */
  private async analyzeAndPlan(
    message: string,
    context: ProjectContext,
    attachments?: File[],
    uploadedAttachments?: string[],
    metadata?: Record<string, any>,
  ): Promise<any> {
    try {
      const workMode = resolveHarnessMode(metadata?.agentMode) || 'craft';
      const forceImageToolCall = workMode === 'craft' && this.shouldForceImageToolCall(
        message,
        metadata,
        !!attachments?.some((file) => file.type?.startsWith('image/')),
      );

      // 按需构建提示词段落，减少不必要的 token 消耗
      const hasAttachments = attachments && attachments.length > 0;
      const isEdit =
        /换成|改成|改为|替换|修改|调整|变成|去掉|删除|移除|去背景|换背景|换颜色|改颜色|抠图|高清|放大画质|upscale|remove|replace|recolor|edit/i.test(
          message,
        );
      const isMultiImage = /(\d+)\s*张|一套|一组|系列|套图/i.test(message);

      const smartEditSection = isEdit
        ? `
特殊技能 smartEdit（图片编辑）:
- 删除物体: editType='object-remove', parameters: {"object": "目标名称"}
- 去除背景: editType='background-remove'
- 更换颜色: editType='recolor', parameters: {"object": "目标", "color": "颜色"}
- 替换物体: editType='replace', parameters: {"object": "原物体", "replacement": "新物体"}
- 放大画质: editType='upscale'
- sourceUrl 设为 "ATTACHMENT_X"
`
        : "";

      const productSection =
        hasAttachments
          ? `
【主体识别优先协议 - VISION_REFRESH_PROTOCOL v4】
- **实体属性判定 (Entity Category Pre-check) [CRITICAL]**：在分析材质前，必须首先判定主体是 **真人实体** 还是 **非生物物件**。
- **人像特权识别**：若主体为人类，必须锁定：性别年龄、五官特征、肤质妆造、体势神态。严禁将其抽象化为“几何体”或“材料”。
- **物件物理分析**：若主体为非生物，按几何拓扑和材质物理属性进行无偏见描述。
- **视觉瞬间切换**：若最新附件 ATTACHMENT_0 与历史上下文/话题记忆在实体范畴上冲突（如：过去是音箱，现在是真人），你必须**瞬间重置**所有假设，以当前视觉事实为唯一真理。
`
          : "";

      const quantitySection = `
【输出数量规则 — 最重要】
- 默认只返回 1 个 proposal（1张图/1个视频）。用户说"做个海报"、"设计一个logo"、"帮我做张图" → 只返回 1 个 proposal。
- 只有用户明确要求多张时才返回多个 proposals：
  - "5张副图" → 5 个 proposals
  - "一套图" / "一组" / "系列" → 3-5 个 proposals
  - "3张海报" → 3 个 proposals
- 修改/编辑请求说"改成XX"/"换成XX"/"去掉XX"）→ 只返回 1 个 proposal，使用 smartEdit 技能。
- 绝对不要在用户没要求多张的情况下返回多个 proposals。1个请求 = 1张图，这是默认行为。
`;

      const multiImageSection = isMultiImage
        ? `
【多图规则（仅当用户明确要求时）】
- 每个 proposal 必须包含自己的 skillCalls 数组，内容/角度/用途各不相同。
- 电商套图（亚马逊副图）应包含：白底主图、信息图、场景图、细节特写、尺寸包装图等。
- 不能返回少于用户要求数量的 proposals。
`
        : "";

      const forcedToolSection = forceImageToolCall
        ? `
【强制工具调用规则（绝对必须）】
- 本次请求已判定为“必须出图”任务。
- 你不能只返回 message/analysis。
- 你必须返回可执行的 skillCalls，并且至少包含 1 个 skillName="generateImage"。
- 若未返回 generateImage skillCalls，本次输出将被系统判定为失败。
`
        : "";

      const multimodalRefUrls =
        metadata?.multimodalContext?.referenceImageUrls || [];
      const isolateVisualTaskContext =
        metadata?.isolateVisualTaskContext === true;
      const currentTurnVisualIntent = analyzeCurrentTurnVisualIntent(
        message,
        (attachments?.some(isLikelyImageFile) || multimodalRefUrls.length > 0),
      );
      const currentTurnIntentSection = `
【当前轮次意图合同 — 最高优先级】
${currentTurnVisualIntent.guard}
- 不得把历史消息中的新增、删除、换人、换物、构图要求自动带入本轮。
- 只有当前用户指令明确提出的人物数量变化才允许增删人物。
`;
      const multimodalReferenceSummary =
        typeof metadata?.multimodalContext?.referenceSummary === 'string'
          ? truncateText(metadata.multimodalContext.referenceSummary.trim(), MAX_REFERENCE_SUMMARY_CHARS)
          : '';
      const multimodalSection =
        multimodalRefUrls.length > 0
          ? `
【多模态参考图 URL（实体冲突隔离）】
${multimodalRefUrls
            .map((url: string, index: number) => `- REF_URL_${index}: ${url}`)
            .join("\n")}
- 参考摘要: ${multimodalReferenceSummary || '请分析当前主体的视觉锚点。'}
- **实体级冲突重置 (ENTITY_TYPE_RESET)**：如果历史参考图 (REF_URL_X) 与最新附件 (ATTACHMENT_0) 在“人/物”性质上不符，你必须执行 **强制清空** 记忆。绝对禁止将历史物件属性赋予当前人像，或将历史人设赋予当前物件。
- 当你构造 generateImage 参数时，优先把参考图填入 reference_image_url。
- 多张参考图必须优先写入 referenceImages。`
          : "";

      let rawPinnedText = !isolateVisualTaskContext && typeof metadata?.topicPinnedContext === "string" && metadata.topicPinnedContext.trim().length > 0
          ? metadata.topicPinnedContext
          : "";
      
      let finalPinnedText = rawPinnedText;

      // 【记忆净化协议 - CONTEXT_SANITIZATION】
      // 如果当前是真人图且记忆里包含高频“工业/音箱”幻觉词，执行物理隔离
      const containsHallucinationWords = /圆柱|音箱|磨砂纸|半透明|核心|纳米/i.test(finalPinnedText);
      const isCurrentlyHuman = (attachments && attachments.length > 0) || /人|模特|女性|男性|脸|五官/i.test(message); 
      
      if (isCurrentlyHuman && containsHallucinationWords) {
        finalPinnedText = `
【警告：历史环境已污染 - CONTEXT_RESET】
当前检测到您的视觉输入为真人，但历史话题记忆中包含无关的物件属性（音箱/圆柱体等）。
你必须**物理隔离 (Omit)** 以下历史背景，严禁将历史材质应用到真人身上。
已隔离历史背景摘要: ${finalPinnedText.slice(0, 100)}...
`;
      }

      const topicPinnedContext = finalPinnedText ? `
【话题长期记忆（必须优先遵守）】
${truncateText(finalPinnedText, MAX_TOPIC_CONTEXT_CHARS)}
` : "";

      const designSession = isolateVisualTaskContext
        ? undefined
        : context.designSession;
      const compactConversationHistory = (isolateVisualTaskContext
        ? []
        : (context.conversationHistory || []))
        .slice(-MAX_ANALYZE_HISTORY_MESSAGES)
        .map((msg) => {
          const roleName = msg.role === "user" ? "用户" : "智能助手";
          const attachmentsText =
            msg.attachments && msg.attachments.length > 0
              ? ` [附图/素材: ${msg.attachments.slice(0, 3).join(", ")}${msg.attachments.length > 3 ? ", ..." : ""}]`
              : "";
          return `${roleName}: ${truncateText(msg.text, MAX_MESSAGE_TEXT_CHARS)}${attachmentsText}`;
        })
        .join("\n");
      const designSessionSection = designSession
        ? `
【统一设计会话（必须继承）】
- 当前任务模式: ${designSession.taskMode}
- 已批准资产: ${(designSession.approvedAssetIds || []).slice(-4).join(', ') || '无'}
- 主体锚点: ${(designSession.subjectAnchors || []).slice(-4).join(', ') || '无'}
- 参考摘要: ${truncateText(designSession.referenceSummary || '无', MAX_REFERENCE_SUMMARY_CHARS)}
- 禁止变更: ${(designSession.forbiddenChanges || []).join('；') || '无'}
`
        : "";

      const selectedCreativeCapabilities = this.getSelectedCreativeCapabilities(metadata);
      const creativeCapabilitySection = selectedCreativeCapabilities.length > 0
        ? `
【用户显式选择的创作 Skills（最高优先级能力合同）】
${selectedCreativeCapabilities.map((capability, index) => `
${index + 1}. ${capability.title || capability.id}
- 目标: ${capability.purpose || '按用户要求完成创作'}
- 主执行函数: ${capability.primaryTool}
- 可用兜底函数: ${(capability.fallbackTools || []).join(', ') || '无'}
- 产出类型: ${capability.outputType || 'image'}
- 必要输入: ${(capability.requiredInputs || []).join('；') || '按用户请求判断'}
- 附件角色: ${(capability.attachmentRoles || []).join('；') || '按附件顺序识别'}
- 执行说明: ${(capability.instructions || []).join('；') || '严格完成用户请求'}
- 默认参数: ${compactJson(capability.defaults || {}, 800)}
`).join('')}
强制规则:
- Skill 不是提示词标签，也不是跳转页面；它是你必须理解并调用的函数能力。
- 输入足够时，skillCalls 必须使用所选 Skill 的 primaryTool，参数必须遵循上面的附件角色和执行说明。
- 输入不足时，只询问缺失的必要输入，不得伪造附件、蒙版、产品信息或完成结果。
- 多个 Skills 同时选择时，按用户目标决定串联顺序；前一步结果是后一步输入，不得把所有功能混成一个含糊 prompt。
- 生成或编辑成功后，结果必须作为资产返回，由系统自动加入当前画布。
`
        : '';

      const capabilityToolNames = selectedCreativeCapabilities
        .flatMap((capability) => [capability.primaryTool, ...(capability.fallbackTools || [])])
        .filter((toolName, index, all) => typeof toolName === 'string' && all.indexOf(toolName) === index);
      const availableSkillNames = Array.from(new Set([...this.preferredSkills, ...capabilityToolNames]));
      const preferredAspectRatio = String(
        metadata?.preferredAspectRatio || "",
      ).trim();
      const aspectRatioSection = preferredAspectRatio
        ? `
【输出比例规则 — 强制】
- 本次输出比例固定为 ${preferredAspectRatio}。
- 比例来源: ${metadata?.preferredAspectRatioSource === "reference-image" ? "系统读取主参考图真实宽高后自动匹配" : "用户或当前技能设置"}。
- generateImage 的 aspectRatio 必须填写 "${preferredAspectRatio}"，不得自行改成 1:1，也不得裁切成其他比例。
`
        : "";
      const continuationContext = metadata?.continuationContext as
        | {
            isRevision?: boolean;
            previousUserInstruction?: string;
            previousAssistantSummary?: string;
            inheritedPreviousResult?: boolean;
          }
        | undefined;
      const revisionSection = continuationContext?.isRevision
        ? `
【上一版续作协议 — 最高优先级】
- 本轮是修改上一版结果，不是创建新任务；不得被话题记忆中的其他商品、风格或旧任务覆盖。
- 上一条用户任务: ${continuationContext.previousUserInstruction || "沿用上一版完整设计"}
- 上一版结果摘要: ${continuationContext.previousAssistantSummary || "沿用上一版生成结果"}
- ${continuationContext.inheritedPreviousResult ? "ATTACHMENT_0 是上一版实际生成结果，必须作为唯一视觉基准。" : "必须严格沿用上一版设计上下文。"}
- 只修改本轮用户明确指出的内容；未点名的人物、产品、服装、颜色、材质、姿态、场景、构图、光影、文字和品牌元素全部保持不变。
- 若本轮只纠正比例或尺寸，只允许重排画布、扩图或裁切到目标比例；禁止重新设计、替换主体、换产品或改色。
`
        : "";

      const specializedRoleSection =
        metadata?.specializedRole === "fashion-replica"
          ? FASHION_REPLICA_ROLE_PROMPT
          : metadata?.specializedRole === "scene-fission"
            ? SCENE_FISSION_ROLE_PROMPT
          : "";

      const approvedPlan = workMode === 'craft' && context.conversationId
        ? new BrowserHarnessSession(String(context.conversationId), 'craft').plan
        : undefined;
      const interactionModeSection = workMode === 'plan'
        ? `
【Plan 模式——只规划】
- 本轮只分析并给出完整、可执行的计划，绝对不能执行任何技能。
- skillCalls 和 proposals 必须返回空数组；把执行步骤放入 suggestions。
- 最后明确告诉用户：确认后说“开始做”，系统会切换到 Craft 执行。
`
        : workMode === 'ask'
          ? `
【Ask 模式——只交流】
- 本轮只讨论、解释、分析附件和提供专业建议，绝对不能执行任何技能。
- skillCalls 和 proposals 必须返回空数组；不得声称已经生成、编辑或保存成品。
- 保持与项目记忆和对话历史连续。如果用户想开始制作，请让他明确说“开始做”。
`
          : approvedPlan
            ? `
【Craft 模式——执行已确认计划】
- 用户已经确认开始制作，不要重复询问或重新规划。
- 继承并执行以下已保存计划：${approvedPlan.title}
${approvedPlan.items.map((item, index) => `${index + 1}. ${item.text}`).join('\n')}
`
            : `
【Craft 模式——直接执行】
- 对明确任务直接调用所需技能并交付结果，不要只描述做法。
`;

      const systemContext = buildWorkspaceSystemContext(context.agentContext);
      const fullPrompt = `${this.systemPrompt}

${systemContext}

${specializedRoleSection}
${interactionModeSection}

【语言要求】你必须用中文回复所有内容（analysis、message、title、description 等字段全部用中文）。只有 prompt 字段用英文（因为图片生成模型需要英文 prompt）。

项目信息:
- 项目名称: ${context.projectTitle}
- 品牌信息: ${compactJson(context.brandInfo || {}, MAX_BRAND_INFO_CHARS)}
- 已有素材数量: ${context.existingAssets.length}

附件列表:
${(attachments || [])
          .map((file, index) => {
            const info = (file as any).markerInfo;
            const markerName = (file as any).markerName;
            const uploadedUrl =
              uploadedAttachments && uploadedAttachments[index]
                ? `\n- 🌐 公网预览图: ${uploadedAttachments[index]}`
                : "";

            if (info) {
              const ratio = (info.width / info.height).toFixed(2);
              return `- 附件 ${index + 1}: [画布选区]${markerName ? ` (描述/标识: "${markerName}")` : ""} (尺寸: ${info.width}x${info.height}, 比例: ${ratio})。这是用户的产品图片，必须作为参考图使用。设置 referenceImage 为 'ATTACHMENT_${index}'。${uploadedUrl}`;
            }
            const detectedRatio = (file as any).detectedAspectRatio;
            const detectedWidth = (file as any).detectedImageWidth;
            const detectedHeight = (file as any).detectedImageHeight;
            const dimensionText = detectedRatio
              ? `，真实尺寸 ${detectedWidth}x${detectedHeight}，比例 ${detectedRatio}`
              : "";
            return `- 附件 ${index + 1}: ${file.name}${markerName ? ` (描述/标识: "${markerName}")` : ""} (${file.type}${dimensionText})。引用方式: 'ATTACHMENT_${index}'${uploadedUrl}`;
          })
          .join("\n")}

对话历史 (Context):
${compactConversationHistory || '无'}

可用技能: ${availableSkillNames.join(", ")}
${smartEditSection}
用户请求: ${message}
${currentTurnIntentSection}${productSection}${quantitySection}${multiImageSection}${forcedToolSection}${aspectRatioSection}${revisionSection}${creativeCapabilitySection}${multimodalSection}${topicPinnedContext}${designSessionSection}
请分析用户需求，严格遵守“先判定性质、再分析、最后执行”的逻辑：
1. analysis: 【严禁跳步】必须首先确认主体范畴（真人/物件），再进行细节描述。如果是人像，锁定其生物特征；如果是物品，锁定物理材质。
2. message: 【核心】用感性设计师口吻复述。例如：“我看见您提供了一张真人图片，是一位[描述特征]的模特，我将为您保留其韵味并设计方案...”
3. skillCalls: 具体的工具调用参数。
4. suggestions: 给用户的下一步建议。

{
  "analysis": "...",
  "preGenerationMessage": "调用工具前的设计师沟通文案",
  "skillCalls": [{"skillName": "generateImage", "params": {"prompt": "...", "referenceImages": ["ATTACHMENT_0", "ATTACHMENT_1"], "referenceImage": "ATTACHMENT_0", "aspectRatio": "${preferredAspectRatio || "1:1"}", "model": "nanobanana2"}}],
  "message": "...",
  "postGenerationSummary": "...",
  "suggestions": ["..."]
}
仅当用户明确要求“先看方案/给几个方案再选”时，才返回 proposals 字段。`;

      // [XC-STUDIO] 最后一层保险：强力清洗满文件名的 base64 内容，防止 413
      const sanitizedPrompt = sanitizeStringBase64(fullPrompt);

      // Build content parts - text + image attachments for visual understanding
      const parts: any[] = [{ text: sanitizedPrompt }];
      
      // [XC-STUDIO] Inject image attachments as inlineData parts for multimodal analysis
      if (attachments && attachments.length > 0) {
        for (const file of attachments.slice(0, 10)) { // Limit to 10 images to prevent payload too large
          const fileAny = file as any;
          if (fileAny.url && (fileAny.url.startsWith('data:image/') || fileAny.url.includes(';base64,'))) {
            try {
              const base64Content = fileAny.url.split(';base64,')[1];
              const mimeType = fileAny.url.split(';base64,')[0].replace('data:', '');
              if (base64Content && mimeType) {
                parts.push({
                  inlineData: {
                    data: base64Content,
                    mimeType: mimeType
                  }
                });
              }
            } catch (e) {
              console.warn('[analyzeAndPlan] Failed to process attachment for multimodal', e);
            }
          } else if (
            metadata?.specializedRole === "scene-fission" &&
            file.type?.startsWith("image/") &&
            file.size <= 3 * 1024 * 1024 &&
            parts.length < 4
          ) {
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              let binary = "";
              for (let offset = 0; offset < bytes.length; offset += 0x8000) {
                binary += String.fromCharCode(
                  ...bytes.subarray(offset, offset + 0x8000),
                );
              }
              parts.push({
                inlineData: {
                  data: btoa(binary),
                  mimeType: file.type || "image/png",
                },
              });
            } catch (e) {
              console.warn(
                "[analyzeAndPlan] Failed to inline scene-fission reference",
                e,
              );
            }
          }
        }
      }

      const selectedMode = useAgentStore.getState().modelMode || 'fast';
      const bestModel = getBestModelId(selectedMode === 'thinking' ? "thinking" : "text");

      const payloadDiagnostics = {
        promptChars: sanitizedPrompt.length,
        historyCount: (context.conversationHistory || []).length,
        historyUsed: Math.min((context.conversationHistory || []).length, MAX_ANALYZE_HISTORY_MESSAGES),
        attachmentCount: attachments?.length || 0,
        uploadedAttachmentCount: uploadedAttachments?.length || 0,
        includesInlineImages: parts.length > 1,
        partsCount: parts.length,
        estimatedPayloadChars: JSON.stringify(parts).length,
        model: bestModel,
      };
      console.log(`[${this.agentInfo.id}] [analyzeAndPlan] payload diagnostics`, payloadDiagnostics);

      const toolConfig: any = {};
      if (metadata?.enableWebSearch) {
        toolConfig.tools = [{ googleSearch: {} }];
      }

      const forcedSchema = forceImageToolCall
        ? {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            message: { type: Type.STRING },
            preGenerationMessage: { type: Type.STRING },
            postGenerationSummary: { type: Type.STRING },
            proposals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  skillCalls: {
                    type: Type.ARRAY,
                    minItems: 1,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        skillName: {
                          type: Type.STRING,
                          enum: ["generateImage"],
                        },
                        params: IMAGE_TOOL_PARAMS_SCHEMA,
                      },
                      required: ["skillName", "params"],
                    },
                  },
                },
                required: ["id", "title", "description", "skillCalls"],
              },
            },
            skillCalls: {
              type: Type.ARRAY,
              minItems: 1,
              items: {
                type: Type.OBJECT,
                properties: {
                  skillName: { type: Type.STRING, enum: ["generateImage"] },
                  params: IMAGE_TOOL_PARAMS_SCHEMA,
                },
                required: ["skillName", "params"],
              },
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        }
        : undefined;

      const response = await withTimeout(
        retryAsync(
          async () => {
            console.log(`[analyzeAndPlan] [${selectedMode}] 发起分析请求，选用模型: ${bestModel}`);
            return generateJsonResponse({
              model: bestModel,
              parts,
              temperature: forceImageToolCall ? 0.2 : 0.7,
              ...(forcedSchema ? { responseSchema: forcedSchema } : {}),
              ...(toolConfig?.tools ? { tools: toolConfig.tools } : {}),
              operation: `${this.agentInfo.id}.analyzeAndPlan`
            });
          },
          3, // 增加到 3 次重试，应付中转站波动
        ),
        120000, // 120 秒超时
        "analyzeAndPlan 超时",
      ) as any;
      console.log(`[${this.agentInfo.id}] [analyzeAndPlan] 收到模型回复`);

      const parsedPlan = this.parseResponse(response.text || "{}");

      // 最终兜底：强制出图时不允许只返回文本。
      if (forceImageToolCall) {
        const topCalls = Array.isArray(parsedPlan.skillCalls)
          ? parsedPlan.skillCalls
          : [];
        const proposalCalls = Array.isArray(parsedPlan.proposals)
          ? parsedPlan.proposals.flatMap((p: any) =>
            Array.isArray(p.skillCalls) ? p.skillCalls : [],
          )
          : [];
        const hasGenerateImage = [...topCalls, ...proposalCalls].some(
          (c: any) => /^generateImage$/i.test(c?.skillName || ""),
        );

        if (!hasGenerateImage) {
          parsedPlan.skillCalls = [
            this.buildForcedGenerateImageCall(message, attachments, metadata),
          ];
          parsedPlan.message = "已触发强制出图流程，正在为您生成图像。";
        }
      }

      // Handle Grounding Metadata (Sources)
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && groundingChunks.length > 0) {
        const sources = groundingChunks
          .map((chunk: any) => {
            if (chunk.web) {
              return `[${chunk.web.title}](${chunk.web.uri})`;
            }
            return null;
          })
          .filter((s: any) => s) as string[];

        if (sources.length > 0) {
          const sourceText = `\n\n**参考来源:**\n${sources.map((s: string) => `- ${s}`).join("\n")}`;
          if (parsedPlan.message) {
            parsedPlan.message += sourceText;
          }
          if (parsedPlan.analysis) {
            parsedPlan.analysis += sourceText;
          }
        }
      }

      return parsedPlan;
    } catch (error) {
      throw errorHandler.handleError(error, {
        agent: this.agentInfo.id,
        function: "analyzeAndPlan",
      });
    }
  }

  /**
   * 执行Skills（带完善错误处理）
   */
  protected async executeSkills(
    skillCalls: any[],
    task: AgentTask,
  ): Promise<any[]> {
    // Skill name alias mapping (Gemini may return old-style names)
    const SKILL_ALIASES: Record<string, string> = {
      imageGenSkill: "generateImage",
      videoGenSkill: "generateVideo",
      copyGenSkill: "generateCopy",
      textExtractSkill: "extractText",
      regionAnalyzeSkill: "analyzeRegion",
      smartEditSkill: "smartEdit",
      exportSkill: "export",
      touchEditSkill: "touchEdit",
    };

    const normalizedCalls = (skillCalls || []).map((rawCall) => {
      const call = this.normalizeImageReferenceParams(rawCall);
      if (SKILL_ALIASES[call.skillName]) {
        call.skillName = SKILL_ALIASES[call.skillName];
      }
      return call;
    });

    // --- 进度反馈增强逻辑 (Patch v16) ---
    const progressSteps = [
      "正在连接 nanobanana2 模型...",
      "正在分析视觉元素与构图构思...",
      "正在渲染高动态范围光影细节...",
      "正在进行 2K 超清分辨率优化...",
      "正在执行最后的像素级精修...",
      "正在为您将作品同步至画布..."
    ];

    let pIdx = 0;
    const pInterval = setInterval(() => {
      if (pIdx < progressSteps.length) {
        useAgentStore.getState().actions.setCurrentTask({
          ...task,
          status: "executing",
          progressMessage: progressSteps[pIdx],
          progressStep: 3,
          totalSteps: 4,
        });
        pIdx++;
      }
    }, 3000);

    try {
      const jobs = normalizedCalls.map((call, callIndex) => async () => {
        try {
          const result = await this.executeSingleSkillCall(
            call,
            callIndex,
            task,
          );
          return { ...call, result, success: true };
        } catch (error) {
          const appError = errorHandler.handleError(error, {
            skill: call?.skillName,
            agent: this.agentInfo.id,
          });
          return {
            ...call,
            error: appError.message,
            success: false,
          };
        }
      });

      const settled = await runWithConcurrency(jobs, this.maxConcurrency);
      return settled.map((item) => {
        if (item.status === "fulfilled") {
          return item.value;
        }
        return {
          skillName: "unknown",
          success: false,
          error: String(item.reason || "Unknown error"),
        };
      });

    } finally {
      clearInterval(pInterval);
    }
  }

  private async executeSingleSkillCall(
    call: any,
    callIndex: number,
    task: AgentTask,
  ): Promise<any> {
    console.log(
      `[${this.agentInfo.id}] [executeSkills] 解析技能参数: ${call.skillName}`,
    );

    if (typeof call.params === "string") {
      try {
        let cleanedParams = call.params.trim();
        const codeBlockMatch = cleanedParams.match(
          /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
        );
        if (codeBlockMatch) {
          cleanedParams = codeBlockMatch[1].trim();
        }
        call.params = JSON.parse(cleanedParams);
      } catch (parseError) {
        console.error(
          `[${this.agentInfo.id}] 参数 JSON 解析失败:`,
          parseError,
        );
        call.params = {};
      }
    }

    if (!call.params || typeof call.params !== "object") {
      call.params = {};
    }

    // Amazon listing resume: if topic memory has remaining shots and caller didn't specify shots,
    // auto-inject them so the workflow can continue without repeating completed shots.
    if (call.skillName === "amazonListing") {
      try {
        const topicId = String(task.input.metadata?.topicId || "").trim();
        const hasExplicitShots = Array.isArray(call.params?.shots) && call.params.shots.length > 0;
        if (topicId && !hasExplicitShots) {
          const snapshot = await loadTopicSnapshot(topicId);
          const remaining = snapshot?.listing?.amazonListing?.remaining;
          if (Array.isArray(remaining) && remaining.length > 0) {
            call.params.shots = remaining;
            if (call.params.count == null) {
              call.params.count = remaining.length;
            }
            console.log(
              `[${this.agentInfo.id}] Injected amazonListing shots from topic memory: ${remaining.length}`,
            );
          }
        }
      } catch (e) {
        console.warn(`[${this.agentInfo.id}] Failed to inject amazonListing remaining shots`, e);
      }
    }

    if (!AVAILABLE_SKILLS[call.skillName as keyof typeof AVAILABLE_SKILLS]) {
      throw new Error(`Skill ${call.skillName} not found`);
    }

    const preferredAspectRatio = task.input.metadata?.preferredAspectRatio;
    const creationMode = task.input.metadata?.creationMode;
    if (
      typeof preferredAspectRatio === "string" &&
      preferredAspectRatio &&
      creationMode !== "video" &&
      ["generateImage", "smartEdit", "touchEdit"].includes(call.skillName)
    ) {
      call.params = call.params || {};
      if (call.skillName === "smartEdit") {
        call.params.parameters = call.params.parameters || {};
        call.params.parameters.aspectRatio = preferredAspectRatio;
      } else {
        call.params.aspectRatio = preferredAspectRatio;
      }
      console.info(
        `[${this.agentInfo.id}] Output ratio enforced at execution: ${preferredAspectRatio} (${task.input.metadata?.preferredAspectRatioSource || "task"}) -> ${call.skillName}`,
      );
    } else if (
      typeof preferredAspectRatio === "string" &&
      preferredAspectRatio &&
      creationMode === "video" &&
      call.skillName === "generateVideo"
    ) {
      call.params = call.params || {};
      call.params.aspectRatio = preferredAspectRatio;
    }

    if (call.skillName === "generateImage") {
      call.params.model ||= "nanobanana2";
      call.params.aspectRatio ||= typeof preferredAspectRatio === "string"
        ? preferredAspectRatio
        : "1:1";
    } else if (call.skillName === "generateVideo") {
      const configuredVideoModels = (() => {
        try {
          const parsed = JSON.parse(localStorage.getItem("setting_video_models") || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();
      call.params.model ||= configuredVideoModels[0] || "veo-3.1-fast-generate-preview";
      call.params.aspectRatio ||= typeof preferredAspectRatio === "string"
        ? preferredAspectRatio
        : "16:9";
    }

    const attachmentParamKeys = call.skillName === "generateVideo"
      ? ["startFrame", "endFrame"]
      : (["extractText", "analyzeRegion", "touchEdit"].includes(call.skillName)
          ? ["imageData"]
          : []);
    for (const key of attachmentParamKeys) {
      const value = call.params[key];
      if (typeof value === "string" && value.startsWith("ATTACHMENT_")) {
        const resolved = await this.resolveReferenceItem(task, value);
        if (!resolved) throw new Error(`无法解析附件引用 ${value}`);
        call.params[key] = resolved;
      }
    }

    if (call.skillName === "generateImage") {
      call.params = call.params || {};
      const currentAttachments = (task.input.attachments || []).filter(
        isLikelyImageFile,
      );
      const hasReferenceImage =
        currentAttachments.length > 0 ||
        (task.input.metadata?.multimodalContext?.referenceImageUrls?.length || 0) > 0;
      const currentTurnIntent = analyzeCurrentTurnVisualIntent(
        task.input.message,
        hasReferenceImage,
      );
      const plannedPrompt = String(call.params.prompt || "").trim();
      const executionDetail = currentTurnIntent.referencePreservingEdit
        ? task.input.message
        : plannedPrompt || task.input.message;
      call.params.prompt = `${currentTurnIntent.guard}\n\nEXECUTION DETAIL:\n${executionDetail}`;

      if (
        task.input.metadata?.isolateVisualTaskContext === true &&
        currentAttachments.length > 0
      ) {
        const attachmentRefs = currentAttachments.map(
          (_, index) => `ATTACHMENT_${index}`,
        );
        call.params.referenceImages = attachmentRefs;
        call.params.referenceImage = attachmentRefs[0];
        call.params.reference_image_url = attachmentRefs[0];
        call.params.init_image = attachmentRefs[0];
        call.params.referencePriority =
          attachmentRefs.length > 1 ? "all" : "first";
        call.params.referenceStrength = 0.95;
        if (currentTurnIntent.narrowClothingEdit) {
          call.params.referenceMode = "portrait";
        }
      }
    }

    const continuationContext = task.input.metadata?.continuationContext as
      | {
          isRevision?: boolean;
          previousUserInstruction?: string;
          inheritedPreviousResult?: boolean;
          previousAssetUrl?: string;
        }
      | undefined;
    if (continuationContext?.isRevision && call.skillName === "generateImage") {
      call.params = call.params || {};
      const currentPrompt = String(call.params.prompt || task.input.message || "").trim();
      const revisionGuard = [
        "REVISION OF THE PREVIOUS GENERATED IMAGE. Do not create a new concept.",
        `Original task: ${continuationContext.previousUserInstruction || "Preserve the complete previous design."}`,
        `Current correction: ${task.input.message}`,
        "Change only the explicitly corrected property. Preserve the exact same subject, product, garment, identity, pose, scene, composition, lighting, colors, materials, typography, branding, and every untouched detail.",
        "If the correction adds a person or object, preserve the existing main subject exactly and add the new entity at the requested relative position. Never replace the original subject with the new entity.",
        typeof preferredAspectRatio === "string" && preferredAspectRatio
          ? `The output canvas must be exactly ${preferredAspectRatio}. If aspect ratio is the only correction, only reframe, outpaint, or crop the previous image; never redesign or replace its subject.`
          : "",
      ].filter(Boolean).join("\n");
      call.params.prompt = `${revisionGuard}\n\nExecution detail:\n${currentPrompt}`;

      const previousReference = continuationContext.inheritedPreviousResult && task.input.attachments?.length
        ? "ATTACHMENT_0"
        : continuationContext.previousAssetUrl;
      if (previousReference) {
        call.params.referenceImages = [previousReference];
        call.params.referenceImage = previousReference;
        call.params.reference_image_url = previousReference;
        call.params.init_image = previousReference;
        call.params.referencePriority = "first";
        call.params.referenceStrength = 0.95;
      }
    }

    if (
      task.input.metadata?.specializedRole === "fashion-replica" &&
      call.skillName === "generateImage"
    ) {
      const attachmentRefs = (task.input.attachments || []).map(
        (_, index) => `ATTACHMENT_${index}`,
      );
      const currentPrompt = String(
        call.params.prompt || task.input.message || "",
      ).trim();
      call.params.prompt = `${FASHION_REPLICA_ROLE_PROMPT}\n\nEXECUTION PROMPT:\n${currentPrompt}`;
      call.params.model = "nanobanana2";
      call.params.referenceImages = attachmentRefs;
      if (attachmentRefs[0]) {
        call.params.referenceImage = attachmentRefs[0];
        call.params.reference_image_url = attachmentRefs[0];
        call.params.init_image = attachmentRefs[0];
      }
      call.params.referencePriority = "first";
      call.params.referenceStrength = 0.95;
      call.params.referenceMode = "portrait";
    }

    if (
      (call.skillName === "generateImage" ||
        call.skillName === "generateVideo" ||
        call.skillName === "smartEdit") &&
      task.input.metadata?.forceSkills
    ) {
      const refKey =
        call.skillName === "smartEdit" ? "sourceUrl" : "referenceImage";
      const refVal = call.params?.[refKey];
      const requiresAttachment =
        (typeof refVal === "string" && refVal.startsWith("ATTACHMENT_")) ||
        call.skillName === "smartEdit";

      if (
        requiresAttachment &&
        (!task.input.attachments || task.input.attachments.length === 0)
      ) {
        throw new Error(
          "执行方案时缺少参考附件，请先在输入区保留产品图/标记图后再执行。",
        );
      }
    }

    if (
      call.skillName === "generateImage" ||
      call.skillName === "generateVideo" ||
      call.skillName === "smartEdit"
    ) {
      if (
        call.skillName === "generateImage" ||
        call.skillName === "generateVideo"
      ) {
        if (call.skillName === "generateImage") {
          const portraitKeywords = ["发型", "发色", "头发", "脸", "面部", "人像", "证件照", "模特", "五官", "wolf cut", "hair", "face", "portrait"];
          const isPortraitRequest = portraitKeywords.some(kw => (call.params.prompt || "").toLowerCase().includes(kw));

          // 无论是否是人像，都显著提高默认一致性强度 (从 0.75 -> 0.85)
          if (typeof call.params.referenceStrength !== "number") {
            call.params.referenceStrength = 0.85;
          }

          if (isPortraitRequest) {
            if (!call.params.referenceMode) {
              call.params.referenceMode = "portrait";
            }
          } else {
            if (!call.params.referenceMode) {
              call.params.referenceMode = "product";
            }
          }
          if (!call.params.consistencyContext) {
            call.params.consistencyContext = {
              approvedAssetIds: task.input.context.designSession?.approvedAssetIds || [],
              subjectAnchors: task.input.context.designSession?.subjectAnchors || [],
              referenceSummary: task.input.context.designSession?.referenceSummary,
              forbiddenChanges: task.input.context.designSession?.forbiddenChanges || [],
            };
          }
          if (!call.params.imageSize) {
            call.params.imageSize = "2K";
          }
        }

        const resolvedRefs = await this.resolveReferenceImages(task, call.params);
        const expectedRefCount = Math.min(
          resolvedRefs.sourceCount,
          MAX_REFERENCE_IMAGES,
        );

        if (resolvedRefs.references.length > 0) {
          const callRefCount = Array.isArray(call.params.referenceImages)
            ? call.params.referenceImages.length
            : 0;
          if (callRefCount !== expectedRefCount) {
            console.warn(
              `[${this.agentInfo.id}] Auto-repairing referenceImages for ${call.skillName}: expected=${expectedRefCount}, actual=${callRefCount}`,
            );
          }

          call.params.referenceImages = resolvedRefs.references;

          const firstRef = resolvedRefs.references[0];
          if (!call.params.referenceImage) call.params.referenceImage = firstRef;
          if (!call.params.reference_image_url)
            call.params.reference_image_url = firstRef;
          if (!call.params.init_image) call.params.init_image = firstRef;

          if (resolvedRefs.truncated) {
            console.warn(
              `[${this.agentInfo.id}] referenceImages truncated to ${MAX_REFERENCE_IMAGES}`,
            );
            if (typeof call.params.prompt === "string" && call.params.prompt.trim()) {
              call.params.prompt = `${call.params.prompt}\n\nReference note: ${resolvedRefs.sourceCount} reference images were provided. Due to model input limits, ${resolvedRefs.references.length} representative references were injected. Keep composition, color language, and subject traits consistent with all provided references.`;
            }
          }
        }

        const nextMetadata = { ...(task.input.metadata || {}) };
        nextMetadata.referenceInjection = {
          ...(nextMetadata.referenceInjection || {}),
          maxReferenceImages: MAX_REFERENCE_IMAGES,
          uploaded_total: task.input.uploadedAttachments?.length || 0,
          source_total: resolvedRefs.sourceCount,
          injected_total: resolvedRefs.references.length,
          truncated: resolvedRefs.truncated,
          omitted_total: resolvedRefs.omittedCount,
        };
        task.input = { ...task.input, metadata: nextMetadata };
        
        console.info(
          `[${this.agentInfo.id}] reference injection stats`,
          task.input.metadata.referenceInjection,
        );
      }

      const paramKey =
        call.skillName === "smartEdit" ? "sourceUrl" : "referenceImage";

      if (
        call.skillName === "generateImage" &&
        (!Array.isArray(call.params.referenceImages) ||
          call.params.referenceImages.length === 0) &&
        !call.params[paramKey] &&
        task.input.attachments &&
        task.input.attachments.length > 0
      ) {
        const imageAttachments = task.input.attachments.filter(
          (f) => f.type && f.type.startsWith("image/"),
        );
        if (imageAttachments.length > 0) {
          const attachIdx =
            imageAttachments.length === 1
              ? 0
              : callIndex % imageAttachments.length;
          const actualIdx = task.input.attachments.indexOf(
            imageAttachments[attachIdx],
          );
          call.params[paramKey] = `ATTACHMENT_${actualIdx}`;
          console.log(
            `[${this.agentInfo.id}] Auto-injected referenceImage=ATTACHMENT_${actualIdx} for proposal #${callIndex}`,
          );
        }
      }

      if (
        call.params[paramKey] &&
        typeof call.params[paramKey] === "string" &&
        call.params[paramKey].startsWith("ATTACHMENT_")
      ) {
        const index = parseInt(call.params[paramKey].split("_")[1]);
        const selectedProvider = String(task.input.metadata?.imageHostProvider || 'none');
        const preferHostedUrls = selectedProvider !== 'none';
        const hostedUrl = task.input.uploadedAttachments?.[index];

        if (preferHostedUrls && hostedUrl && /^https?:\/\//i.test(hostedUrl)) {
          call.params[paramKey] = hostedUrl;
        } else {
          const availableAttachments = task.input.attachments || [];
          if (availableAttachments[index]) {
            const file = availableAttachments[index];
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
              reader.onload = () => {
                const res = reader.result as string;
                resolve(res);
              };
              reader.readAsDataURL(file);
            });
            call.params[paramKey] = base64;
          }
        }

        // Shared logic for both hosted and base64 attachments: Inject Mask & Aspect Ratio
        const availableAttachments = task.input.attachments || [];
        if (availableAttachments[index]) {
          const file = availableAttachments[index];
          if ((call.skillName === "smartEdit" || call.skillName === "generateImage") && (file as any).markerInfo) {
            const info = (file as any).markerInfo;
            
            // 强制原图：如果未选用图床 url 并且存在全图，我们必须覆盖 paramKey 为 fullImageUrl
            if (!preferHostedUrls && info.fullImageUrl) {
              call.params[paramKey] = info.fullImageUrl;
            }
            
            // 1. 设置宽高比 —— 必须使用原图的真实尺寸 (imageWidth / imageHeight)
            // 注意：info.width/height 是圈选区域的大小，不是原图大小！
            const imgW = (file as any).detectedImageWidth || info.imageWidth || info.width;
            const imgH = (file as any).detectedImageHeight || info.imageHeight || info.height;
            const ratio = imgW / imgH;
            const detectedAspect = getNearestSupportedImageAspectRatio(imgW, imgH);
            const aspect = typeof preferredAspectRatio === "string" && preferredAspectRatio
              ? preferredAspectRatio
              : detectedAspect;
            call.params.aspectRatio = aspect;
            console.log(`[${this.agentInfo.id}] Original image size: ${imgW}x${imgH}, ratio=${ratio.toFixed(3)}, aspectRatio=${aspect}`);

            // 2. 核心修复：生成遮罩图片注入 maskImage
            try {
              const maskBase64 = await createMaskDataUrl(info);
              if (maskBase64) {
                call.params.maskImage = maskBase64;

                // 3. 增强指令：强制保留原图上下文，防止“人没了”或背景变白底
                if (typeof call.params.prompt === 'string') {
                  const contextGuidance = "Must preserve the person, background, pose, and all untouched areas from the original image. ONLY change the selected area according to the prompt.";
                  if (!call.params.prompt.includes(contextGuidance)) {
                    call.params.prompt = `${contextGuidance}\n\nTask: ${call.params.prompt}`;
                  }
                }

                if (call.skillName === "generateImage") {
                  call.params.referenceMode = "portrait";
                  // 强制高一致性，确保非选区绝对不动
                  call.params.referenceStrength = 0.85; 
                }
              }
            } catch (maskErr) {
              console.warn(`[${this.agentInfo.id}] Failed to generate mask for ${call.skillName}:`, maskErr);
            }
          }
        }
      }
    }

    const skillTimeout = SKILL_TIMEOUTS[call.skillName] || DEFAULT_SKILL_TIMEOUT;
    return Promise.race([
      executeSkill(call.skillName, call.params),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Skill ${call.skillName} 执行超时(${skillTimeout / 1000}s)`),
            ),
          skillTimeout,
        ),
      ),
    ]);
  }

  private async resolveReferenceImages(
    task: AgentTask,
    params: Record<string, any>,
  ): Promise<{
    references: string[];
    sourceCount: number;
    truncated: boolean;
    omittedCount: number;
  }> {
    const { limitedCandidates, sourceCount, truncated } =
      collectReferenceCandidates(params, task.input, MAX_REFERENCE_IMAGES);
    const references: string[] = [];

    for (const item of limitedCandidates) {
      const resolved = await this.resolveReferenceItem(task, item);
      if (resolved) references.push(resolved);
    }

    if ((import.meta as any).env?.DEV) {
      const safe = (v: string) => {
        if (!v) return '';
        if (v.startsWith('data:image/')) return `data:image/...(${v.length} chars)`;
        return v.length > 140 ? `${v.slice(0, 140)}...` : v;
      };
      console.info(`[${this.agentInfo.id}] reference candidates`, {
        sourceCount,
        truncated,
        max: MAX_REFERENCE_IMAGES,
        limitedCandidates: limitedCandidates.map(safe),
        resolvedCount: references.length,
        resolved: references.map(safe),
      });
    }

    return {
      references,
      sourceCount,
      truncated,
      omittedCount: Math.max(0, sourceCount - references.length),
    };
  }

  private async resolveReferenceItem(
    task: AgentTask,
    value: string,
  ): Promise<string | null> {
    const selectedProvider = String(task.input.metadata?.imageHostProvider || 'none');
    const preferHostedUrls = selectedProvider !== 'none';

    // If it's already a URL or data URL, pass through.
    // ATTACHMENT_* should resolve to base64 to remain usable even when hosted URLs
    // are blocked by CORS/403 in-browser. Hosted URLs are added as separate
    // candidates upstream.
    if (!value.startsWith("ATTACHMENT_")) return value;

    const idx = Number.parseInt(value.split("_")[1] || "", 10);
    const file = task.input.attachments?.[idx];
    if (!file) return null;

    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    }).then((v) => (v ? v : null));
  }

  /**
   * 从技能结果中提取资产
   */
  protected extractAssets(skillCalls: any[]): GeneratedAsset[] {
    // 记录失败的 skillCalls 以便调试
    const failed = skillCalls.filter((s) => !s.success);
    if (failed.length > 0) {
      console.warn(
        `[${this.agentInfo.id}] ${failed.length} skill calls failed:`,
        failed.map((s) => `${s.skillName}: ${s.error}`),
      );
    }

    return skillCalls
      .filter(
        (s) =>
          s.success &&
          s.result &&
          (s.skillName === "generateImage" ||
            s.skillName === "generateVideo" ||
            s.skillName === "smartEdit" ||
            s.skillName === "touchEdit"),
      )
      .map((s) => ({
        id: `asset-${Date.now()}-${Math.random()}`,
        type:
          s.skillName === "generateVideo"
            ? ("video" as const)
            : ("image" as const),
        url: s.result,
        metadata: {
          prompt: s.params?.prompt || s.params?.editType || "",
          model: s.params?.model || "edit",
          agentId: this.agentInfo.id,
        },
      }));
  }

  /**
   * 根据任务类型动态生成快捷操作按钮
   */
  private getAdjustments(message: string, proposals: any[]): string[] {
    const isEdit =
      /换成|改成|改为|替换|修改|调整|去掉|删除|移除|去除|去背景|换背景|换颜色|改颜色|recolor|remove|replace/i.test(
        message,
      );

    if (isEdit) {
      return ["继续微调", "一键抠图", "提升画质", "尝试不同配色"];
    }

    const isLandscape = /(横版|横屏|宽屏|16:9|landscape)/i.test(message);
    const isPortrait = /(竖版|竖屏|手机屏|9:16|portrait)/i.test(message);
    const isSquare = /(方图|1:1|正方形|square)/i.test(message);

    const suggestions = [];
    if (isLandscape) suggestions.push("换成竖版");
    else if (isPortrait) suggestions.push("换成横版");
    else suggestions.push("尝试横版", "尝试竖版");

    suggestions.push("换个风格", "换个配色", "重新生成");

    return suggestions.slice(0, 4);
  }

  private composePreGenerationMessage(task: AgentTask, plan: any): string {
    const uploaded = task.input.uploadedAttachments || [];
    const ctxRefs =
      task.input.metadata?.multimodalContext?.referenceImageUrls || [];
    const refCount = Math.max(uploaded.length, ctxRefs.length);
    const styleHint =
      typeof plan?.analysis === "string" && plan.analysis.trim().length > 0
        ? plan.analysis.trim().slice(0, 48)
        : "电影质感与高级商业构图";

    if (refCount > 0) {
      return `我看到了您上传的 ${refCount} 张参考图，接下来我会围绕主体特征进行设计，采用${styleHint}的方向来完成本次视觉稿。`;
    }

    return `我已理解您的需求，接下来我会以${styleHint}为核心，先完成一版主视觉并保证构图与氛围统一。`;
  }

  private composePostGenerationSummary(
    task: AgentTask,
    plan: any,
    assetCount: number,
  ): string {
    const hasRefs =
      (task.input.uploadedAttachments?.length || 0) > 0 ||
      (task.input.metadata?.multimodalContext?.referenceImageUrls?.length || 0) >
      0;
    const lighting = /夜景|cinematic|电影|neon|霓虹/i.test(
      task.input.message || "",
    )
      ? "光影层次更偏电影感"
      : "光线分布更强调主体识别";
    const colorTone = /暖|warm|橙|gold/i.test(task.input.message || "")
      ? "色调偏暖，氛围更亲和"
      : "色调控制在清晰且耐看的商业区间";

    const planTail =
      typeof plan?.analysis === "string" && plan.analysis.trim().length > 0
        ? `，并延续了“${plan.analysis.trim().slice(0, 24)}”的设计目标`
        : "";

    return `设计复盘：本次共输出 ${assetCount} 张结果，${lighting}，${colorTone}，构图重点突出核心信息${planTail}${hasRefs ? "，并保持了与参考图的主体一致性" : ""}。`;
  }

  private normalizeImageReferenceParams(call: any): any {
    if (!call?.params || typeof call.params !== "object") return call;
    const params = call.params as Record<string, any>;

    const aliasRef =
      params.referenceImage ||
      params.referenceImageUrl ||
      params.reference_image_url ||
      params.initImage ||
      params.init_image;

    if (aliasRef && !params.referenceImage) {
      params.referenceImage = aliasRef;
    }

    return { ...call, params };
  }

  /**
   * 解析响应
   */
  protected parseResponse(response: string): any {
    try {
      // 移除markdown代码块
      let cleaned = response.trim();
      const codeBlockMatch = cleaned.match(
        /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
      );
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
      }

      cleaned = cleaned.replace(/,\s*([\]}])/g, "$1"); // Fix common trailing comma json errors

      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        return { proposals: parsed, message: "为您生成了以下方案" };
      }

      return parsed;
    } catch (error) {
      console.warn(
        "[Agent] JSON parse failed, trying more aggressive extraction",
      );

      try {
        const matchObject = response.match(/\{[\s\S]*\}/);
        const matchArray = response.match(/\[[\s\S]*\]/);

        if (
          matchObject &&
          (!matchArray || matchObject[0].length > matchArray[0].length)
        ) {
          let cleanedData = matchObject[0].replace(/,\s*([\]}])/g, "$1");
          return JSON.parse(cleanedData);
        } else if (matchArray) {
          let cleanedData = matchArray[0].replace(/,\s*([\]}])/g, "$1");
          const parsed = JSON.parse(cleanedData);
          if (Array.isArray(parsed)) {
            return { proposals: parsed, message: "为您生成了以下方案" };
          }
        }
      } catch (e2) {
        console.warn("[Agent] Deep JSON extraction failed too", e2);
      }

      // 彻底移除所有 json:generation 块，并清理多余空行，确保最终文案纯净
      const cleanedResponse = response
        .replace(/```json:generation\s*[\s\S]*?```/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return { message: cleanedResponse, skillCalls: [] };
    }
  }

  /**
   * 输入验证
   */
  private validateInput(task: AgentTask): void {
    if (!task.input.message || !task.input.message.trim()) {
      throw errorHandler.createError(
        ErrorType.VALIDATION,
        "任务消息不能为空",
        undefined,
        { taskId: task.id },
        false,
      );
    }

    if (!task.input.context) {
      throw errorHandler.createError(
        ErrorType.VALIDATION,
        "任务上下文缺失",
        undefined,
        { taskId: task.id },
        false,
      );
    }
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(
    task: AgentTask,
    status: AgentTask["status"],
  ): AgentTask {
    return {
      ...task,
      status,
      updatedAt: Date.now(),
    };
  }

  /**
   * 缓存结果（带TTL）
   */
  private cacheResult(task: AgentTask, result: AgentTask): void {
    const key = this.getCacheKey(task);
    this.executionCache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * 获取缓存结果（带TTL检查）
   */
  private getCachedResult(task: AgentTask): AgentTask | null {
    const key = this.getCacheKey(task);
    const cached = this.executionCache.get(key);
    if (!cached) return null;

    // TTL: 5分钟过期
    const CACHE_TTL = 5 * 60 * 1000;
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.executionCache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * 生成缓存键（考虑附件和上下文）
   * 带附件的请求不缓存（每次都是新的创作意图）
   */
  private getCacheKey(task: AgentTask): string {
    // 带附件的请求不缓存
    if (task.input.attachments && task.input.attachments.length > 0) {
      return `nocache-${Date.now()}-${Math.random()}`;
    }
    const meta = task.input.metadata || {};
    const metaKey = `web:${!!meta.enableWebSearch}|force:${!!meta.forceSkills}`;
    const contextHash = task.input.context?.projectTitle || "";
    return `${this.agentInfo.id}:${task.input.message}:${contextHash}:${metaKey}`;
  }

  /**
   * 重置智能体
   */
  reset(): void {
    this.chat = null;
    this.executionCache.clear();
  }
}
