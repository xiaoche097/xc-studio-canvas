---

# 🔧 谷歌 Gemini 原生接口 Skills

> 基于云雾API文档 (https://yunwu.apifox.cn/api-305048984)
> 
> **直接复制到项目即可使用，无需任何修改（除了API_KEY）**

---

## 📁 文件结构

your-project/
├── gemini/
│   ├── config.ts          # 配置文件
│   ├── types.ts           # 类型定义
│   ├── client.ts          # HTTP客户端
│   ├── service.ts         # 业务方法
│   └── index.ts           # 统一导出
└── example.ts             # 使用示例

---

## 📄 文件1: `gemini/config.ts`

typescript
/**

* Gemini API 配置
* 
* ⚠️ 使用前请修改 API_KEY
  */
export const GEMINI_CONFIG = {
/**
  * 中转站基础地址
  * @description 云雾API中转站地址
    */
    BASE_URL: 'https://yunwu.ai',

/**

* API密钥
* @description 替换为你的API Key
* @example 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
  */
  API_KEY: 'YOUR_API_KEY_HERE',

/**

* 默认模型
  */
  DEFAULT_MODEL: 'gemini-2.5-pro',

/**

* 请求超时时间（毫秒）
  */
  TIMEOUT: 120000,
  } as const

/**

* 可用模型列表
  */
  export const GEMINI_MODELS = {
  // ============ 文本模型 ============
  'gemini-2.5-pro': {
  name: 'Gemini 2.5 Pro',
  description: '最新最强的Pro模型',
  capabilities: ['text', 'vision', 'code']
  },
  'gemini-2.5-flash': {
  name: 'Gemini 2.5 Flash',
  description: '快速响应模型',
  capabilities: ['text', 'vision']
  },
  'gemini-2.0-flash': {
  name: 'Gemini 2.0 Flash',
  description: '2.0版本Flash模型',
  capabilities: ['text', 'vision']
  },
  'gemini-2.0-flash-thinking': {
  name: 'Gemini 2.0 Flash Thinking',
  description: '带思考过程的模型',
  capabilities: ['text', 'thinking']
  },
  'gemini-1.5-pro': {
  name: 'Gemini 1.5 Pro',
  description: '1.5版本Pro模型',
  capabilities: ['text', 'vision']
  },
  'gemini-1.5-flash': {
  name: 'Gemini 1.5 Flash',
  description: '1.5版本Flash模型',
  capabilities: ['text', 'vision']
  },

// ============ 图片生成模型 ============
'gemini-2.5-flash-image': {
name: 'Gemini 2.5 Flash Image',
description: '图片生成模型',
capabilities: ['image-generation']
},
'gemini-3-pro-image-preview': {
name: 'Gemini 3 Pro Image Preview',
description: '高级图片生成模型',
capabilities: ['image-generation']
},
} as const

export type GeminiModelId = keyof typeof GEMINI_MODELS

---

## 📄 文件2: `gemini/types.ts`

typescript
/**

* Gemini API 类型定义
* 
* 基于云雾API文档: https://yunwu.apifox.cn/api-305048984
  */

// ==================== 请求类型 ====================

/**

* 内容部分
* @description 可以是文本或图片
  */
export interface Part {
/** 文本内容 */
  text?: string

/** 内联数据（用于图片等二进制内容） */
inlineData?: {
/** MIME类型，如 'image/jpeg', 'image/png', 'image/webp' */
mimeType: string
/** Base64编码的数据 */
data: string
}

/** 文件数据（用于引用已上传的文件） */
fileData?: {
/** MIME类型 */
mimeType: string
/** 文件URI */
fileUri: string
}
}

/**

* 对话内容
  */
export interface Content {
/**
  * 角色
  * - 'user': 用户消息
  * - 'model': 模型回复
      */
      role: 'user' | 'model'

/** 内容部分数组 */
parts: Part[]
}

/**

* 系统指令
* @description 用于设置模型的角色和行为
  */
  export interface SystemInstruction {
  parts: Part[]
  }

/**

* 思考配置
* @description 仅适用于 gemini-2.0-flash-thinking 等思考模型
  */
export interface ThinkingConfig {
/** 是否在响应中包含思考过程 */
  includeThoughts?: boolean

/**

* 思考token预算
* @default 26240
  */
  thinkingBudget?: number
  }

/**

* 生成配置
  */
export interface GenerationConfig {
/**
  * 温度
  * @description 控制输出的随机性，值越高越随机
  * @minimum 0
  * @maximum 2
  * @default 1
    */
    temperature?: number

/**

* Top-P 采样
* @description 核采样参数
* @minimum 0
* @maximum 1
* @default 1
  */
  topP?: number

/**

* Top-K 采样
* @description 从概率最高的K个token中采样
  */
  topK?: number

/**

* 最大输出token数
* @description 限制模型输出的最大长度
  */
  maxOutputTokens?: number

/**

* 停止序列
* @description 遇到这些序列时停止生成
  */
  stopSequences?: string[]

/**

* 响应MIME类型
* @description 用于指定输出格式，如 'application/json'
  */
  responseMimeType?: string

/**

* 响应Schema
* @description JSON Schema，用于结构化输出
  */
  responseSchema?: Record<string, unknown>

/**

* 思考配置
* @description 仅适用于思考模型
  */
  thinkingConfig?: ThinkingConfig
  }

/**

* 安全设置
  */
export interface SafetySetting {
/** 危害类别 */
  category:
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT'

/** 阻止阈值 */
threshold:
| 'BLOCK_NONE'
| 'BLOCK_LOW_AND_ABOVE'
| 'BLOCK_MEDIUM_AND_ABOVE'
| 'BLOCK_ONLY_HIGH'
}

/**

* Gemini 请求体
* @description POST body 参数
  */
export interface GeminiRequest {
/**
  * 对话内容
  * @required
    */
    contents: Content[]

/**

* 系统指令
* @description 设置模型角色和行为
  */
  systemInstruction?: SystemInstruction

/**

* 生成配置
  */
  generationConfig?: GenerationConfig

/**

* 安全设置
  */
  safetySettings?: SafetySetting[]
  }

// ==================== 响应类型 ====================

/**

* 安全评级
  */
  export interface SafetyRating {
  category: string
  probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH'
  }

/**

* 候选回复
  */
export interface Candidate {
/** 回复内容 */
  content: {
  parts: Part[]
  role: string
  }

/**

* 完成原因
* - 'STOP': 正常完成
* - 'MAX_TOKENS': 达到最大token限制
* - 'SAFETY': 因安全原因停止
* - 'RECITATION': 因引用原因停止
* - 'OTHER': 其他原因
    */
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER'

/** 候选索引 */
index: number

/** 安全评级 */
safetyRatings?: SafetyRating[]
}

/**

* Token使用统计
  */
export interface UsageMetadata {
/** 提示词token数 */
  promptTokenCount: number

/** 候选回复token数 */
candidatesTokenCount: number

/** 总token数 */
totalTokenCount: number

/** 思考token数（仅思考模型） */
thoughtsTokenCount?: number
}

/**

* Gemini 响应体
  */
export interface GeminiResponse {
/** 候选回复数组 */
  candidates: Candidate[]

/** Token使用统计 */
usageMetadata: UsageMetadata

/** 模型版本 */
modelVersion?: string
}

// ==================== 错误类型 ====================

/**

* API错误响应
  */
  export interface GeminiErrorResponse {
  error: {
  code: number
  message: string
  status: string
  }
  }

---

## 📄 文件3: `gemini/client.ts`

typescript
/**

* Gemini HTTP 客户端
  */

import { GEMINI_CONFIG } from './config'
import type { GeminiRequest, GeminiResponse, GeminiErrorResponse } from './types'

/**

* API请求错误
  */
  export class GeminiAPIError extends Error {
  constructor(
  message: string,
  public statusCode: number,
  public code?: string
  ) {
  super(message)
  this.name = 'GeminiAPIError'
  }
  }

/**

* 构建请求URL
* 
* @param model - 模型ID
* @returns 完整的请求URL（包含API Key）
* 
* @example
* buildUrl('gemini-2.5-pro')
* // => 'https://yunwu.ai/v1beta/models/gemini-2.5-pro:generateContent?key=sk-xxx'
  */
  export function buildUrl(model: string): string {
  // ⚠️ 重要：API Key 通过 Query 参数传递
  return `${GEMINI_CONFIG.BASE_URL}/v1beta/models/${model}:generateContent?key=${GEMINI_CONFIG.API_KEY}`
  }

/**

* 发送Gemini API请求
* 
* @param model - 模型ID，如 'gemini-2.5-pro'
* @param request - 请求体
* @returns Promise<GeminiResponse>
* @throws GeminiAPIError
* 
* @example
* const response = await sendRequest('gemini-2.5-pro', {
* contents: [{ role: 'user', parts: [{ text: '你好' }] }]
* })
  */
  export async function sendRequest(
  model: string,
  request: GeminiRequest
  ): Promise<GeminiResponse> {
  const url = buildUrl(model)

const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), GEMINI_CONFIG.TIMEOUT)

try {
const response = await fetch(url, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify(request),
signal: controller.signal,
})

```
clearTimeout(timeoutId)

// 解析响应
const data = await response.json()

// 检查错误
if (!response.ok) {
  const errorData = data as GeminiErrorResponse
  throw new GeminiAPIError(
    errorData.error?.message || `HTTP Error ${response.status}`,
    response.status,
    errorData.error?.status
  )
}

return data as GeminiResponse
```

} catch (error) {
clearTimeout(timeoutId)

```
// 已经是我们的错误类型
if (error instanceof GeminiAPIError) {
  throw error
}

// 超时错误
if (error instanceof Error && error.name === 'AbortError') {
  throw new GeminiAPIError('请求超时', 408, 'TIMEOUT')
}

// 其他错误
throw new GeminiAPIError(
  error instanceof Error ? error.message : '未知错误',
  500,
  'UNKNOWN'
)
```

}
}

/**

* 从响应中提取文本
* 
* @param response - Gemini响应
* @returns 文本内容
  */
  export function extractText(response: GeminiResponse): string {
  return response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

/**

* 从响应中提取所有parts
* 
* @param response - Gemini响应
* @returns Parts数组
  */
  export function extractParts(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts || []
  }

---

## 📄 文件4: `gemini/service.ts`

typescript
/**

* Gemini 业务方法
* 
* 提供开箱即用的高级API
  */

import { GEMINI_CONFIG } from './config'
import { sendRequest, extractText, GeminiAPIError } from './client'
import type {
GeminiRequest,
GeminiResponse,
Content,
Part,
GenerationConfig,
ThinkingConfig,
} from './types'

// ==================== 类型定义 ====================

export interface ChatOptions {
/** 模型ID */
model?: string
/** 系统提示词 */
systemPrompt?: string
/** 温度 0-2 */
temperature?: number
/** Top-P 0-1 */
topP?: number
/** 最大输出token */
maxOutputTokens?: number
}

export interface ThinkingOptions extends ChatOptions {
/** 是否包含思考过程 */
includeThoughts?: boolean
/** 思考token预算 */
thinkingBudget?: number
}

export interface ImageAnalysisOptions extends ChatOptions {
/** 图片MIME类型 */
mimeType?: string
}

export interface StructuredOutputOptions<T> extends ChatOptions {
/** JSON Schema */
schema: Record<string, unknown>
}

// ==================== 核心方法 ====================

/**

* 生成内容（底层方法）
* 
* @param request - 完整请求体
* @param model - 模型ID
* @returns Gemini响应
* 
* @example
* const response = await generateContent({
* contents: [{ role: 'user', parts: [{ text: '你好' }] }],
* generationConfig: { temperature: 0.7 }
* })
  */
  export async function generateContent(
  request: GeminiRequest,
  model: string = GEMINI_CONFIG.DEFAULT_MODEL
  ): Promise<GeminiResponse> {
  return sendRequest(model, request)
  }

/**

* 简单文本对话
* 
* @param prompt - 用户输入
* @param options - 可选配置
* @returns 模型回复文本
* 
* @example
* // 基础用法
* const reply = await chat('你好')
* 
* // 带系统提示
* const reply = await chat('你是谁?', {
* systemPrompt: '你是一只小猪，回复开头加"哼哼"'
* })
* 
* // 指定模型和参数
* const reply = await chat('写一首诗', {
* model: 'gemini-2.5-pro',
* temperature: 0.9,
* maxOutputTokens: 1000
* })
  */
  export async function chat(
  prompt: string,
  options: ChatOptions = {}
  ): Promise<string> {
  const {
  model = GEMINI_CONFIG.DEFAULT_MODEL,
  systemPrompt,
  temperature = 1,
  topP = 1,
  maxOutputTokens,
  } = options

const request: GeminiRequest = {
contents: [
{
role: 'user',
parts: [{ text: prompt }],
},
],
generationConfig: {
temperature,
topP,
maxOutputTokens,
},
}

// 添加系统指令
if (systemPrompt) {
request.systemInstruction = {
parts: [{ text: systemPrompt }],
}
}

const response = await sendRequest(model, request)
return extractText(response)
}

/**

* 多轮对话
* 
* @param contents - 对话历史
* @param options - 可选配置
* @returns 模型回复文本
* 
* @example
* const reply = await multiTurnChat([
* { role: 'user', parts: [{ text: '你好' }] },
* { role: 'model', parts: [{ text: '你好！有什么可以帮助你的吗？' }] },
* { role: 'user', parts: [{ text: '介绍一下人工智能' }] }
* ])
  */
  export async function multiTurnChat(
  contents: Content[],
  options: ChatOptions = {}
  ): Promise<string> {
  const {
  model = GEMINI_CONFIG.DEFAULT_MODEL,
  systemPrompt,
  temperature = 1,
  topP = 1,
  maxOutputTokens,
  } = options

const request: GeminiRequest = {
contents,
generationConfig: {
temperature,
topP,
maxOutputTokens,
},
}

if (systemPrompt) {
request.systemInstruction = {
parts: [{ text: systemPrompt }],
}
}

const response = await sendRequest(model, request)
return extractText(response)
}

/**

* 带思考过程的对话
* 
* @param prompt - 用户输入
* @param options - 可选配置
* @returns 包含思考过程和回复的对象
* 
* @example
* const result = await chatWithThinking('解方程 2x + 5 = 13', {
* thinkingBudget: 26240
* })
* console.log('回复:', result.text)
* console.log('Token使用:', result.usage)
  */
  export async function chatWithThinking(
  prompt: string,
  options: ThinkingOptions = {}
  ): Promise<{
  text: string
  response: GeminiResponse
  usage: GeminiResponse['usageMetadata']
  }> {
  const {
  model = 'gemini-2.0-flash-thinking',
  systemPrompt,
  temperature = 1,
  topP = 1,
  includeThoughts = true,
  thinkingBudget = 26240,
  } = options

const request: GeminiRequest = {
contents: [
{
role: 'user',
parts: [{ text: prompt }],
},
],
generationConfig: {
temperature,
topP,
thinkingConfig: {
includeThoughts,
thinkingBudget,
},
},
}

if (systemPrompt) {
request.systemInstruction = {
parts: [{ text: systemPrompt }],
}
}

const response = await sendRequest(model, request)

return {
text: extractText(response),
response,
usage: response.usageMetadata,
}
}

/**

* 图片理解/分析
* 
* @param imageBase64 - 图片的Base64编码（不含前缀）
* @param prompt - 提示词
* @param options - 可选配置
* @returns 分析结果文本
* 
* @example
* // 分析图片
* const result = await analyzeImage(
* 'iVBORw0KGgo...', // base64数据
* '描述这张图片的内容'
* )
* 
* // 指定MIME类型
* const result = await analyzeImage(
* pngBase64,
* '这张图里有什么？',
* { mimeType: 'image/png' }
* )
  */
  export async function analyzeImage(
  imageBase64: string,
  prompt: string,
  options: ImageAnalysisOptions = {}
  ): Promise<string> {
  const {
  model = GEMINI_CONFIG.DEFAULT_MODEL,
  systemPrompt,
  mimeType = 'image/jpeg',
  temperature = 1,
  } = options

const request: GeminiRequest = {
contents: [
{
role: 'user',
parts: [
{ text: prompt },
{
inlineData: {
mimeType,
data: imageBase64,
},
},
],
},
],
generationConfig: {
temperature,
},
}

if (systemPrompt) {
request.systemInstruction = {
parts: [{ text: systemPrompt }],
}
}

const response = await sendRequest(model, request)
return extractText(response)
}

/**

* 多图片分析
* 
* @param images - 图片数组
* @param prompt - 提示词
* @param options - 可选配置
* @returns 分析结果
* 
* @example
* const result = await analyzeMultipleImages(
* [
* ```
  { data: base64_1, mimeType: 'image/jpeg' },
  ```
* ```
  { data: base64_2, mimeType: 'image/png' }
  ```
* ],
* '比较这两张图片的区别'
* )
  */
  export async function analyzeMultipleImages(
  images: Array<{ data: string; mimeType?: string }>,
  prompt: string,
  options: ChatOptions = {}
  ): Promise<string> {
  const { model = GEMINI_CONFIG.DEFAULT_MODEL, systemPrompt, temperature = 1 } = options

const parts: Part[] = [{ text: prompt }]

for (const img of images) {
parts.push({
inlineData: {
mimeType: img.mimeType || 'image/jpeg',
data: img.data,
},
})
}

const request: GeminiRequest = {
contents: [{ role: 'user', parts }],
generationConfig: { temperature },
}

if (systemPrompt) {
request.systemInstruction = { parts: [{ text: systemPrompt }] }
}

const response = await sendRequest(model, request)
return extractText(response)
}

/**

* 结构化JSON输出
* 
* @param prompt - 提示词
* @param schema - JSON Schema定义
* @param options - 可选配置
* @returns 解析后的JSON对象
* 
* @example
* interface Person {
* name: string
* age: number
* skills: string[]
* }
* 
* const person = await structuredOutput<Person>(
* '分析：张三，30岁，会Python和JavaScript',
* {
* ```
  type: 'object',
  ```
* ```
  properties: {
  ```
* ```
  name: { type: 'string' },
  ```
* ```
  age: { type: 'number' },
  ```
* ```
  skills: { type: 'array', items: { type: 'string' } }
  ```
* ```
  },
  ```
* ```
  required: ['name', 'age', 'skills']
  ```
* }
* )
* // => { name: '张三', age: 30, skills: ['Python', 'JavaScript'] }
  */
  export async function structuredOutput<T = unknown>(
  prompt: string,
  schema: Record<string, unknown>,
  options: ChatOptions = {}
  ): Promise<T> {
  const { model = GEMINI_CONFIG.DEFAULT_MODEL, systemPrompt, temperature = 1 } = options

const request: GeminiRequest = {
contents: [
{
role: 'user',
parts: [{ text: prompt }],
},
],
generationConfig: {
temperature,
responseMimeType: 'application/json',
responseSchema: schema,
},
}

if (systemPrompt) {
request.systemInstruction = { parts: [{ text: systemPrompt }] }
}

const response = await sendRequest(model, request)
const text = extractText(response)

try {
return JSON.parse(text) as T
} catch {
throw new GeminiAPIError(`JSON解析失败: ${text}`, 500, 'PARSE_ERROR')
}
}

// ==================== 导出错误类 ====================

export { GeminiAPIError }

---

## 📄 文件5: `gemini/index.ts`

typescript
/**

* Gemini API 统一导出
* 
* @example
* import { chat, analyzeImage, GEMINI_CONFIG } from './gemini'
  */

// 配置
export { GEMINI_CONFIG, GEMINI_MODELS } from './config'
export type { GeminiModelId } from './config'

// 类型
export type {
Part,
Content,
SystemInstruction,
ThinkingConfig,
GenerationConfig,
SafetySetting,
GeminiRequest,
SafetyRating,
Candidate,
UsageMetadata,
GeminiResponse,
GeminiErrorResponse,
} from './types'

// 客户端
export {
GeminiAPIError,
buildUrl,
sendRequest,
extractText,
extractParts,
} from './client'

// 服务方法
export {
generateContent,
chat,
multiTurnChat,
chatWithThinking,
analyzeImage,
analyzeMultipleImages,
structuredOutput,
} from './service'

export type {
ChatOptions,
ThinkingOptions,
ImageAnalysisOptions,
StructuredOutputOptions,
} from './service'

---

## 📄 文件6: `example.ts`（使用示例）

typescript
/**

* 使用示例
* 
* 运行前请先在 gemini/config.ts 中设置你的 API_KEY
  */

import {
chat,
multiTurnChat,
chatWithThinking,
analyzeImage,
structuredOutput,
generateContent,
GEMINI_CONFIG,
} from './gemini'

async function main() {
console.log('=== Gemini API 使用示例 ===\n')
console.log('中转站地址:', GEMINI_CONFIG.BASE_URL)
console.log('默认模型:', GEMINI_CONFIG.DEFAULT_MODEL)
console.log('')

// ============ 1. 简单对话 ============
console.log('--- 1. 简单对话 ---')
const reply1 = await chat('你好，介绍一下你自己')
console.log('回复:', reply1)
console.log('')

// ============ 2. 带系统提示 ============
console.log('--- 2. 带系统提示 ---')
const reply2 = await chat('你是谁?', {
systemPrompt: '你是一只小猪，你会在回复开始的时候加一个"哼哼"',
})
console.log('回复:', reply2)
console.log('')

// ============ 3. 调整参数 ============
console.log('--- 3. 调整参数 ---')
const reply3 = await chat('写一首关于春天的短诗', {
model: 'gemini-2.5-pro',
temperature: 0.9,
maxOutputTokens: 500,
})
console.log('回复:', reply3)
console.log('')

// ============ 4. 多轮对话 ============
console.log('--- 4. 多轮对话 ---')
const reply4 = await multiTurnChat([
{ role: 'user', parts: [{ text: '你好' }] },
{ role: 'model', parts: [{ text: '你好！有什么可以帮助你的吗？' }] },
{ role: 'user', parts: [{ text: '给我讲一个冷笑话' }] },
])
console.log('回复:', reply4)
console.log('')

// ============ 5. 带思考的对话 ============
console.log('--- 5. 带思考的对话 ---')
const thinkingResult = await chatWithThinking('计算 123 × 456 的结果', {
thinkingBudget: 26240,
})
console.log('回复:', thinkingResult.text)
console.log('Token使用:', thinkingResult.usage)
console.log('')

// ============ 6. 结构化输出 ============
console.log('--- 6. 结构化输出 ---')
interface Person {
name: string
age: number
occupation: string
}
const person = await structuredOutput<Person>(
'分析这段文字：小明今年25岁，是一名软件工程师',
{
type: 'object',
properties: {
name: { type: 'string', description: '姓名' },
age: { type: 'number', description: '年龄' },
occupation: { type: 'string', description: '职业' },
},
required: ['name', 'age', 'occupation'],
}
)
console.log('结构化结果:', person)
console.log('')

// ============ 7. 底层方法调用 ============
console.log('--- 7. 底层方法调用 ---')
const rawResponse = await generateContent({
systemInstruction: {
parts: [{ text: '用简洁的语言回答' }],
},
contents: [
{
role: 'user',
parts: [{ text: '什么是人工智能？' }],
},
],
generationConfig: {
temperature: 0.7,
topP: 0.9,
maxOutputTokens: 200,
},
})
console.log('原始响应:', JSON.stringify(rawResponse, null, 2))
}

// 运行
main().catch(console.error)

---

## 📦 cURL 请求模板

bash

# ============================================================

# Gemini API cURL 请求模板

# 

# ⚠️ 注意：API Key 通过 URL Query 参数传递

# ============================================================

# 基础文本生成

curl -X POST 'https://yunwu.ai/v1beta/models/gemini-2.5-pro:generateContent?key=YOUR_API_KEY'
-H 'Content-Type: application/json'
-d '{
"contents": [
{
"role": "user",
"parts": [{"text": "你好"}]
}
],
"generationConfig": {
"temperature": 1,
"topP": 1
}
}'

# 带系统指令

curl -X POST 'https://yunwu.ai/v1beta/models/gemini-2.5-pro:generateContent?key=YOUR_API_KEY'
-H 'Content-Type: application/json'
-d '{
"systemInstruction": {
"parts": [{"text": "你是一只小猪，回复开头加哼哼"}]
},
"contents": [
{
"role": "user",
"parts": [{"text": "你是谁?"}]
}
],
"generationConfig": {
"temperature": 1,
"topP": 1
}
}'

# 带思考过程（Thinking模型）

curl -X POST 'https://yunwu.ai/v1beta/models/gemini-2.0-flash-thinking:generateContent?key=YOUR_API_KEY'
-H 'Content-Type: application/json'
-d '{
"contents": [
{
"role": "user",
"parts": [{"text": "解方程 2x + 5 = 13"}]
}
],
"generationConfig": {
"temperature": 1,
"topP": 1,
"thinkingConfig": {
"includeThoughts": true,
"thinkingBudget": 26240
}
}
}'

---

## ✅ 使用步骤

1. **复制上述所有文件到你的项目**
2. **修改 `gemini/config.ts` 中的 `API_KEY`**：
   typescript
   API_KEY: 'sk-你的实际密钥'
3. **导入使用**：
   typescript
   import { chat, analyzeImage } from './gemini'
   
   const reply = await chat('你好')

---

这份Skills文档完全基于云雾API文档，包含完整的类型定义、错误处理、多种使用场景，可以直接复制到IDE使用！

