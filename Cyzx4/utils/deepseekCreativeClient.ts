import { z } from 'zod';
import { selectDeepSeekModel } from '../services/deepseek-model-router.ts';

export const deepSeekCreativeConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  reasoningEffort: z.enum(['off', 'low', 'high', 'max']).default('high'),
  maxTokens: z.number().int().positive().max(262_144).default(16_384),
});

export type DeepSeekCreativeConfig = z.infer<typeof deepSeekCreativeConfigSchema>;

export interface CreativeVisionInput {
  images: Array<{ base64: string; mimeType: string }>;
  taskText: string;
}

type VisionProxy = (input: CreativeVisionInput) => Promise<string>;

const deepSeekResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullable().optional(),
      reasoning_content: z.string().nullable().optional(),
    }).passthrough(),
    finish_reason: z.string().nullable().optional(),
  }).passthrough()).min(1),
  usage: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const collectParts = (request: any): any[] => {
  const contents = request?.contents;
  if (Array.isArray(contents)) {
    return contents.flatMap((content) => Array.isArray(content?.parts) ? content.parts : []);
  }
  return Array.isArray(contents?.parts) ? contents.parts : [];
};

export const splitCreativeAnalysisParts = (request: any): CreativeVisionInput => {
  const taskText: string[] = [];
  const images: CreativeVisionInput['images'] = [];
  for (const part of collectParts(request)) {
    if (typeof part?.text === 'string' && part.text.trim()) taskText.push(part.text.trim());
    const inlineData = part?.inlineData || part?.inline_data;
    if (typeof inlineData?.data === 'string' && inlineData.data) {
      images.push({
        base64: inlineData.data.replace(/^data:[^;]+;base64,/, ''),
        mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
      });
    }
  }
  return { images, taskText: taskText.join('\n\n') };
};

const requestsJsonOutput = (text: string, request: any): boolean => (
  request?.config?.responseMimeType === 'application/json'
  || /(?:return|output|输出|返回).{0,24}(?:json|JSON)|JSON\s*(?:object|格式)/i.test(text)
);

const parseProxyError = async (response: Response): Promise<Error> => {
  const raw = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw);
    const error = new Error(parsed?.error?.message || parsed?.error || `DeepSeek API error ${response.status}`);
    (error as any).status = response.status;
    return error;
  } catch {
    const error = new Error(raw || `DeepSeek API error ${response.status}`);
    (error as any).status = response.status;
    return error;
  }
};

export const createDeepSeekCreativeClient = (
  rawConfig: DeepSeekCreativeConfig,
  _describeImages?: VisionProxy,
) => {
  const config = deepSeekCreativeConfigSchema.parse(rawConfig);
  return {
    models: {
      generateContent: async (request: any) => {
        const input = splitCreativeAnalysisParts(request);
        const taskText = `【原始创作任务】\n${input.taskText || '请根据已有上下文完成创作分析。'}`;
        const userContent = input.images.length > 0
          ? [
              { type: 'text', text: taskText },
              ...input.images.map((image) => ({
                type: 'image_url',
                image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
              })),
            ]
          : taskText;
        const route = selectDeepSeekModel({
          hasImages: input.images.length > 0,
          text: input.taskText,
        });

        const body: Record<string, unknown> = {
          model: route.model,
          messages: [{ role: 'user', content: userContent }],
          stream: false,
          max_tokens: config.maxTokens,
          temperature: Number(request?.config?.temperature ?? 0.2),
        };
        if (config.reasoningEffort === 'off') body.thinking = { type: 'disabled' };
        else body.reasoning_effort = config.reasoningEffort;
        if (requestsJsonOutput(input.taskText, request)) {
          body.response_format = { type: 'json_object' };
        }

        const response = await fetch('/api/deepseek/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: config.baseUrl.replace(/\/+$/, ''),
            apiKey: config.apiKey,
            request: body,
          }),
        });
        if (!response.ok) throw await parseProxyError(response);
        const parsed = deepSeekResponseSchema.parse(await response.json());
        const choice = parsed.choices[0];
        const text = String(choice.message.content || '').trim();
        if (!text) throw new Error('DeepSeek returned an empty creative analysis response.');
        return {
          text,
          candidates: [{
            content: { parts: [{ text }] },
            finishReason: choice.finish_reason || 'stop',
          }],
          usageMetadata: parsed.usage,
        };
      },
    },
  };
};
