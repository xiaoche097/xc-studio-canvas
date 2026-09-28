// Generated Standard Protocols Catalog from tien-canvas
import { StandardProtocolDefinition } from './types';

export const TEXT_PROTOCOLS: StandardProtocolDefinition[] = [
  {
    "pluginId": "a6api",
    "packageDir": "a6api",
    "name": "A6api",
    "version": "1.0.0",
    "providerId": "a6api-chat",
    "label": "A6api Chat",
    "capabilities": [
      "text"
    ],
    "description": "A6api 模型网关协议插件：OpenAI 兼容对话与图像生成。",
    "baseUrl": "https://api.a6api.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "A6api 模型市场中的模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "text",
    "vendor": "A6api 网关",
    "recommendedModels": []
  },
  {
    "pluginId": "anthropic-messages",
    "packageDir": "anthropic-messages",
    "name": "Anthropic Messages",
    "version": "2.0.0",
    "providerId": "claude-api",
    "label": "Anthropic Messages",
    "capabilities": [
      "text"
    ],
    "description": "Anthropic Messages 独立请求协议插件。",
    "baseUrl": "https://api.anthropic.com",
    "authType": "anthropic",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/messages",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/messages",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Anthropic",
    "recommendedModels": [
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest"
    ]
  },
  {
    "pluginId": "antigravity-proxy",
    "packageDir": "antigravity-proxy",
    "name": "Antigravity Proxy",
    "version": "1.0.0",
    "providerId": "antigravity-chat",
    "label": "Antigravity Chat",
    "capabilities": [
      "text"
    ],
    "description": "Antigravity 中转渠道插件：OpenAI 兼容对话（gemini-3.8-flash-high / gemini-pro-agent）。",
    "baseUrl": "http://103.242.14.110:8317",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "模型 ID（gemini-3.8-flash-high / gemini-pro-agent）。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "text",
    "vendor": "Antigravity Proxy",
    "recommendedModels": []
  },
  {
    "pluginId": "atlascloud-chat",
    "packageDir": "atlascloud-chat",
    "name": "Atlas Cloud Chat",
    "version": "2.0.0",
    "providerId": "atlascloud-chat",
    "label": "Atlas Cloud Chat",
    "capabilities": [
      "text"
    ],
    "description": "Atlas Cloud Chat 独立请求协议插件。",
    "baseUrl": "https://api.atlascloud.ai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Atlas Cloud",
    "recommendedModels": []
  },
  {
    "pluginId": "aws-bedrock-converse",
    "packageDir": "aws-bedrock-converse",
    "name": "AWS Bedrock Converse",
    "version": "2.0.0",
    "providerId": "aws-bedrock-converse",
    "label": "AWS Bedrock Converse",
    "capabilities": [
      "text"
    ],
    "description": "AWS Bedrock Converse 独立请求协议插件。",
    "baseUrl": "https://bedrock-runtime.{region}.amazonaws.com",
    "authType": "aws-sigv4",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/model/{{model}}/converse",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "AWS Bedrock",
    "recommendedModels": []
  },
  {
    "pluginId": "aws-bedrock-invoke-model",
    "packageDir": "aws-bedrock-invoke-model",
    "name": "AWS Bedrock InvokeModel",
    "version": "2.0.0",
    "providerId": "aws-bedrock-invoke-model",
    "label": "AWS Bedrock InvokeModel",
    "capabilities": [
      "text"
    ],
    "description": "AWS Bedrock InvokeModel 独立请求协议插件。",
    "baseUrl": "https://bedrock-runtime.{region}.amazonaws.com",
    "authType": "aws-sigv4",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/model/{{model}}/invoke",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "AWS Bedrock",
    "recommendedModels": []
  },
  {
    "pluginId": "azure-openai",
    "packageDir": "azure-openai",
    "name": "Azure OpenAI",
    "version": "2.0.0",
    "providerId": "azure-openai",
    "label": "Azure OpenAI",
    "capabilities": [
      "text"
    ],
    "description": "Azure OpenAI 独立请求协议插件。",
    "baseUrl": "https://{resource}.openai.azure.com",
    "authType": "header",
    "authField": "apiKey",
    "authHeader": "api-key",
    "createMethod": "POST",
    "createPath": "/openai/deployments/{{model}}/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "OpenAI",
    "recommendedModels": []
  },
  {
    "pluginId": "baichuan-chat",
    "packageDir": "baichuan-chat",
    "name": "百川 Chat",
    "version": "2.0.0",
    "providerId": "baichuan-chat",
    "label": "百川 Chat",
    "capabilities": [
      "text"
    ],
    "description": "百川 Chat 独立请求协议插件。",
    "baseUrl": "https://api.baichuan-ai.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "百川智能",
    "recommendedModels": []
  },
  {
    "pluginId": "cohere-chat-v2",
    "packageDir": "cohere-chat-v2",
    "name": "Cohere Chat v2",
    "version": "2.0.0",
    "providerId": "cohere-chat-v2",
    "label": "Cohere Chat v2",
    "capabilities": [
      "text"
    ],
    "description": "Cohere Chat v2 独立请求协议插件。",
    "baseUrl": "https://api.cohere.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v2/chat",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Cohere",
    "recommendedModels": []
  },
  {
    "pluginId": "dashscope-qwen-native",
    "packageDir": "dashscope-qwen-native",
    "name": "DashScope Qwen Native",
    "version": "2.0.0",
    "providerId": "dashscope-qwen-native",
    "label": "DashScope Qwen Native",
    "capabilities": [
      "text"
    ],
    "description": "DashScope Qwen Native 独立请求协议插件。",
    "baseUrl": "https://dashscope.aliyuncs.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/api/v1/services/aigc/text-generation/generation",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "阿里云通义",
    "recommendedModels": [
      "qwen-max",
      "qwen-plus",
      "qwen-turbo",
      "qwen-2.5-72b-instruct"
    ]
  },
  {
    "pluginId": "deepseek-chat",
    "packageDir": "deepseek-chat",
    "name": "DeepSeek Chat",
    "version": "2.0.0",
    "providerId": "deepseek-chat",
    "label": "DeepSeek Chat",
    "capabilities": [
      "text"
    ],
    "description": "DeepSeek Chat 独立请求协议插件。",
    "baseUrl": "https://api.deepseek.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "DeepSeek",
    "recommendedModels": [
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-flash",
      "deepseek-v3"
    ]
  },
  {
    "pluginId": "fireworks-chat",
    "packageDir": "fireworks-chat",
    "name": "Fireworks Chat",
    "version": "2.0.0",
    "providerId": "fireworks-chat",
    "label": "Fireworks Chat",
    "capabilities": [
      "text"
    ],
    "description": "Fireworks Chat 独立请求协议插件。",
    "baseUrl": "https://api.fireworks.ai/inference",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Fireworks AI",
    "recommendedModels": []
  },
  {
    "pluginId": "google-gemini-generate-content",
    "packageDir": "google-gemini-generate-content",
    "name": "Google Gemini generateContent",
    "version": "2.0.0",
    "providerId": "gemini-generate-content",
    "label": "Google Gemini generateContent",
    "capabilities": [
      "text"
    ],
    "description": "Google Gemini generateContent 独立请求协议插件。",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "authType": "google-api-key",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1beta/models/{{model}}:generateContent",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1beta/models/{{model}}:generateContent",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Google",
    "recommendedModels": [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-pro"
    ]
  },
  {
    "pluginId": "groq-chat",
    "packageDir": "groq-chat",
    "name": "Groq Chat",
    "version": "2.0.0",
    "providerId": "groq-chat",
    "label": "Groq Chat",
    "capabilities": [
      "text"
    ],
    "description": "Groq Chat 独立请求协议插件。",
    "baseUrl": "https://api.groq.com/openai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Groq",
    "recommendedModels": []
  },
  {
    "pluginId": "kimi-chat",
    "packageDir": "kimi-chat",
    "name": "Kimi OpenAI-Compatible",
    "version": "2.0.0",
    "providerId": "kimi-chat",
    "label": "Kimi OpenAI-Compatible",
    "capabilities": [
      "text"
    ],
    "description": "Kimi OpenAI-Compatible 独立请求协议插件。",
    "baseUrl": "https://api.moonshot.cn",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "月之暗面 (Kimi)",
    "recommendedModels": [
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k"
    ]
  },
  {
    "pluginId": "litellm-proxy-chat",
    "packageDir": "litellm-proxy-chat",
    "name": "LiteLLM Proxy Chat",
    "version": "2.0.0",
    "providerId": "litellm-proxy-chat",
    "label": "LiteLLM Proxy Chat",
    "capabilities": [
      "text"
    ],
    "description": "LiteLLM Proxy Chat 独立请求协议插件。",
    "baseUrl": "http://127.0.0.1:4000",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "LiteLLM 网关",
    "recommendedModels": []
  },
  {
    "pluginId": "localai-chat",
    "packageDir": "localai-chat",
    "name": "LocalAI Chat",
    "version": "2.0.0",
    "providerId": "localai-chat",
    "label": "LocalAI Chat",
    "capabilities": [
      "text"
    ],
    "description": "LocalAI Chat 独立请求协议插件。",
    "baseUrl": "http://127.0.0.1:8080",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "LocalAI (本地)",
    "recommendedModels": []
  },
  {
    "pluginId": "minimax-text-native",
    "packageDir": "minimax-text-native",
    "name": "MiniMax Text Native",
    "version": "2.0.0",
    "providerId": "minimax-text-native",
    "label": "MiniMax Text Native",
    "capabilities": [
      "text"
    ],
    "description": "MiniMax Text Native 独立请求协议插件。",
    "baseUrl": "https://api.minimax.chat",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/text/chatcompletion_v2",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "MiniMax",
    "recommendedModels": [
      "abab6.5s-chat",
      "abab6.5t-chat"
    ]
  },
  {
    "pluginId": "mistral-chat",
    "packageDir": "mistral-chat",
    "name": "Mistral Chat",
    "version": "2.0.0",
    "providerId": "mistral-chat",
    "label": "Mistral Chat",
    "capabilities": [
      "text"
    ],
    "description": "Mistral Chat 独立请求协议插件。",
    "baseUrl": "https://api.mistral.ai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Mistral AI",
    "recommendedModels": []
  },
  {
    "pluginId": "newapi-chat",
    "packageDir": "newapi-chat",
    "name": "NewAPI Chat",
    "version": "2.0.0",
    "providerId": "newapi-chat",
    "label": "NewAPI Chat",
    "capabilities": [
      "text"
    ],
    "description": "NewAPI Chat 独立请求协议插件。",
    "baseUrl": "http://127.0.0.1:3000",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "NewAPI 中转系统",
    "recommendedModels": []
  },
  {
    "pluginId": "nvidia-nim-chat",
    "packageDir": "nvidia-nim-chat",
    "name": "NVIDIA NIM Chat",
    "version": "2.0.0",
    "providerId": "nvidia-nim-chat",
    "label": "NVIDIA NIM Chat",
    "capabilities": [
      "text"
    ],
    "description": "NVIDIA NIM Chat 独立请求协议插件。",
    "baseUrl": "https://integrate.api.nvidia.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "NVIDIA NIM",
    "recommendedModels": []
  },
  {
    "pluginId": "ollama-chat",
    "packageDir": "ollama-chat",
    "name": "Ollama Chat",
    "version": "2.0.0",
    "providerId": "ollama-chat",
    "label": "Ollama Chat",
    "capabilities": [
      "text"
    ],
    "description": "Ollama Chat 独立请求协议插件。",
    "baseUrl": "http://127.0.0.1:11434",
    "authType": "none",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/api/chat",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Ollama (本地)",
    "recommendedModels": [
      "llama3.3",
      "qwen2.5:72b",
      "deepseek-r1:14b"
    ]
  },
  {
    "pluginId": "openai-chat-completions",
    "packageDir": "openai-chat-completions",
    "name": "OpenAI Chat Completions",
    "version": "2.0.0",
    "providerId": "chat-completion",
    "label": "OpenAI Chat Completions",
    "capabilities": [
      "text"
    ],
    "description": "OpenAI Chat Completions 独立请求协议插件。",
    "baseUrl": "https://api.openai.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "OpenAI",
    "recommendedModels": [
      "gpt-4o",
      "gpt-4o-mini",
      "o1",
      "o3-mini",
      "gpt-4-turbo"
    ]
  },
  {
    "pluginId": "openai-responses",
    "packageDir": "openai-responses",
    "name": "OpenAI Responses",
    "version": "2.0.0",
    "providerId": "openai-response",
    "label": "OpenAI Responses",
    "capabilities": [
      "text"
    ],
    "description": "OpenAI Responses 独立请求协议插件。",
    "baseUrl": "https://api.openai.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/responses",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/responses",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "OpenAI",
    "recommendedModels": [
      "gpt-4o",
      "gpt-4o-mini",
      "o1"
    ]
  },
  {
    "pluginId": "openrouter-chat",
    "packageDir": "openrouter-chat",
    "name": "OpenRouter Chat",
    "version": "2.0.0",
    "providerId": "openrouter-chat",
    "label": "OpenRouter Chat",
    "capabilities": [
      "text"
    ],
    "description": "OpenRouter Chat 独立请求协议插件。",
    "baseUrl": "https://openrouter.ai/api",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "OpenRouter",
    "recommendedModels": [
      "openai/gpt-4o",
      "anthropic/claude-3.5-sonnet",
      "deepseek/deepseek-r1"
    ]
  },
  {
    "pluginId": "plato-chat",
    "packageDir": "plato-chat",
    "name": "柏拉图 Chat",
    "version": "1.0.0",
    "providerId": "plato-chat",
    "label": "柏拉图 Chat",
    "capabilities": [
      "text"
    ],
    "description": "柏拉图 OpenAI Chat Completions 兼容协议，支持画布 Agent 工具调用。",
    "baseUrl": "https://api.openai.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "柏拉图控制台提供的模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "OpenAI 格式工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "柏拉图 API",
    "recommendedModels": []
  },
  {
    "pluginId": "siliconflow-chat",
    "packageDir": "siliconflow-chat",
    "name": "SiliconFlow Chat",
    "version": "2.0.0",
    "providerId": "siliconflow-chat",
    "label": "SiliconFlow Chat",
    "capabilities": [
      "text"
    ],
    "description": "SiliconFlow Chat 独立请求协议插件。",
    "baseUrl": "https://api.siliconflow.cn",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "硅基流动 (SiliconFlow)",
    "recommendedModels": [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "black-forest-labs/FLUX.1-schnell"
    ]
  },
  {
    "pluginId": "together-chat",
    "packageDir": "together-chat",
    "name": "Together AI Chat",
    "version": "2.0.0",
    "providerId": "together-chat",
    "label": "Together AI Chat",
    "capabilities": [
      "text"
    ],
    "description": "Together AI Chat 独立请求协议插件。",
    "baseUrl": "https://api.together.xyz",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Together AI",
    "recommendedModels": []
  },
  {
    "pluginId": "vertex-gemini",
    "packageDir": "vertex-gemini",
    "name": "Vertex AI Gemini",
    "version": "2.0.0",
    "providerId": "vertex-gemini",
    "label": "Vertex AI Gemini",
    "capabilities": [
      "text"
    ],
    "description": "Vertex AI Gemini 独立请求协议插件。",
    "baseUrl": "https://{location}-aiplatform.googleapis.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/projects/{{request.providerOptions.vertex-gemini.project}}/locations/{{request.providerOptions.vertex-gemini.location}}/publishers/google/models/{{model}}:generateContent",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "Google",
    "recommendedModels": []
  },
  {
    "pluginId": "vllm-chat",
    "packageDir": "vllm-chat",
    "name": "vLLM OpenAI-Compatible",
    "version": "2.0.0",
    "providerId": "vllm-chat",
    "label": "vLLM OpenAI-Compatible",
    "capabilities": [
      "text"
    ],
    "description": "vLLM OpenAI-Compatible 独立请求协议插件。",
    "baseUrl": "http://127.0.0.1:8000",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "vLLM (本地/私有)",
    "recommendedModels": []
  },
  {
    "pluginId": "xai-grok-chat",
    "packageDir": "xai-grok-chat",
    "name": "xAI Grok Chat",
    "version": "2.0.0",
    "providerId": "xai-grok-chat",
    "label": "xAI Grok Chat",
    "capabilities": [
      "text"
    ],
    "description": "xAI Grok Chat 独立请求协议插件。",
    "baseUrl": "https://api.x.ai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "xAI (Grok)",
    "recommendedModels": [
      "grok-2-latest",
      "grok-beta"
    ]
  },
  {
    "pluginId": "yi-chat",
    "packageDir": "yi-chat",
    "name": "零一万物 Yi Chat",
    "version": "2.0.0",
    "providerId": "yi-chat",
    "label": "零一万物 Yi Chat",
    "capabilities": [
      "text"
    ],
    "description": "零一万物 Yi Chat 独立请求协议插件。",
    "baseUrl": "https://api.lingyiwanwu.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "零一万物",
    "recommendedModels": []
  },
  {
    "pluginId": "zhipu-glm-chat",
    "packageDir": "zhipu-glm-chat",
    "name": "智谱 GLM Chat",
    "version": "2.0.0",
    "providerId": "zhipu-glm-chat",
    "label": "智谱 GLM Chat",
    "capabilities": [
      "text"
    ],
    "description": "智谱 GLM Chat 独立请求协议插件。",
    "baseUrl": "https://open.bigmodel.cn/api/paas",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/chat/completions",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": true,
    "agentMethod": "POST",
    "agentPath": "/v1/chat/completions",
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "上游模型 ID。"
      },
      {
        "name": "messages",
        "type": "message[]",
        "required": true,
        "description": "包含历史消息和当前用户输入。"
      },
      {
        "name": "instructions",
        "type": "string",
        "required": false,
        "description": "系统指令。"
      },
      {
        "name": "temperature",
        "type": "number",
        "required": false,
        "description": "采样温度。"
      },
      {
        "name": "top_p",
        "type": "number",
        "required": false,
        "description": "核采样参数。"
      },
      {
        "name": "max_tokens",
        "type": "integer",
        "required": false,
        "description": "最大输出 token。"
      },
      {
        "name": "tools",
        "type": "array",
        "required": false,
        "description": "工具定义。"
      },
      {
        "name": "tool_choice",
        "type": "object|string",
        "required": false,
        "description": "工具选择策略。"
      },
      {
        "name": "response_format",
        "type": "object",
        "required": false,
        "description": "结构化输出配置。"
      },
      {
        "name": "stream",
        "type": "boolean",
        "required": false,
        "description": "流式开关；后台任务当前以最终响应归一。"
      }
    ],
    "category": "text",
    "vendor": "智谱 AI",
    "recommendedModels": [
      "glm-4-plus",
      "glm-4-air",
      "glm-4-flash"
    ]
  }
];

export const IMAGE_PROTOCOLS: StandardProtocolDefinition[] = [
  {
    "pluginId": "a6api",
    "packageDir": "a6api",
    "name": "A6api",
    "version": "1.0.0",
    "providerId": "a6api-image",
    "label": "A6api Image",
    "capabilities": [
      "image"
    ],
    "description": "A6api 模型网关协议插件：OpenAI 兼容对话与图像生成。",
    "baseUrl": "https://api.a6api.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "A6api 模型市场中的图像模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "A6api 网关",
    "recommendedModels": []
  },
  {
    "pluginId": "adobe-firefly",
    "packageDir": "adobe-firefly",
    "name": "Adobe Firefly",
    "version": "2.0.0",
    "providerId": "adobe-firefly",
    "label": "Adobe Firefly",
    "capabilities": [
      "image"
    ],
    "description": "Adobe Firefly 独立请求协议插件。",
    "baseUrl": "https://firefly-api.adobe.io",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v3/images/generate",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Adobe",
    "recommendedModels": []
  },
  {
    "pluginId": "agnes-image",
    "packageDir": "agnes-image",
    "name": "Agnes Image",
    "version": "2.0.0",
    "providerId": "agnes-image",
    "label": "Agnes Image",
    "capabilities": [
      "image"
    ],
    "description": "Agnes Image 独立请求协议插件。",
    "baseUrl": "https://api.agnes-ai.cn",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Agnes AI",
    "recommendedModels": []
  },
  {
    "pluginId": "baidu-qianfan-image",
    "packageDir": "baidu-qianfan-image",
    "name": "百度千帆图片",
    "version": "2.0.0",
    "providerId": "baidu-qianfan-image",
    "label": "百度千帆图片",
    "capabilities": [
      "image"
    ],
    "description": "百度千帆图片 独立请求协议插件。",
    "baseUrl": "https://qianfan.baidubce.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v2/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "百度智能云",
    "recommendedModels": [
      "Stable-Diffusion-XL"
    ]
  },
  {
    "pluginId": "bfl-flux",
    "packageDir": "bfl-flux",
    "name": "Black Forest Labs FLUX",
    "version": "2.0.0",
    "providerId": "bfl-flux",
    "label": "Black Forest Labs FLUX",
    "capabilities": [
      "image"
    ],
    "description": "Black Forest Labs FLUX 独立请求协议插件。",
    "baseUrl": "https://api.bfl.ai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/{{model}}",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/v1/get_result",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Black Forest Labs (FLUX)",
    "recommendedModels": [
      "flux-pro-1.1",
      "flux-pro",
      "flux-dev",
      "flux-schnell"
    ]
  },
  {
    "pluginId": "dashscope-qwen-image",
    "packageDir": "dashscope-qwen-image",
    "name": "DashScope Qwen / Wan Image",
    "version": "2.0.0",
    "providerId": "dashscope-qwen-image",
    "label": "DashScope Qwen / Wan Image",
    "capabilities": [
      "image"
    ],
    "description": "DashScope Qwen / Wan Image 独立请求协议插件。",
    "baseUrl": "https://dashscope.aliyuncs.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/api/v1/services/aigc/image-generation/generation",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/api/v1/tasks/{{taskId}}",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "阿里云通义",
    "recommendedModels": [
      "wanx-v1",
      "qwen-vl-max",
      "qwen-image-gen"
    ]
  },
  {
    "pluginId": "dashscope-wanx-image",
    "packageDir": "dashscope-wanx-image",
    "name": "DashScope Wanx Image",
    "version": "2.0.0",
    "providerId": "dashscope-wanx-image",
    "label": "DashScope Wanx Image",
    "capabilities": [
      "image"
    ],
    "description": "DashScope Wanx Image 独立请求协议插件。",
    "baseUrl": "https://dashscope.aliyuncs.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/api/v1/services/aigc/text2image/image-synthesis",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/api/v1/tasks/{{taskId}}",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": true,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "阿里云通义",
    "recommendedModels": [
      "wanx-v1",
      "wanx-background-generation-v2"
    ]
  },
  {
    "pluginId": "fal-queue-image",
    "packageDir": "fal-queue-image",
    "name": "fal.ai Queue Image",
    "version": "2.0.0",
    "providerId": "fal-queue-image",
    "label": "fal.ai Queue Image",
    "capabilities": [
      "image"
    ],
    "description": "fal.ai Queue Image 独立请求协议插件。",
    "baseUrl": "https://queue.fal.run",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/{{model}}",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/{{request.providerOptions.fal-queue-image.statusPath}}",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "fal.ai",
    "recommendedModels": []
  },
  {
    "pluginId": "google-gemini-image",
    "packageDir": "google-gemini-image",
    "name": "Google Gemini Image",
    "version": "2.0.0",
    "providerId": "gemini-image",
    "label": "Google Gemini Image",
    "capabilities": [
      "image"
    ],
    "description": "Google Gemini Image 独立请求协议插件。",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "authType": "google-api-key",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1beta/models/{{model}}:generateContent",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Google",
    "recommendedModels": [
      "imagen-3.0-generate-002",
      "imagen-3.0-fast-generate-001"
    ]
  },
  {
    "pluginId": "ideogram-image",
    "packageDir": "ideogram-image",
    "name": "Ideogram Image",
    "version": "2.0.0",
    "providerId": "ideogram-image",
    "label": "Ideogram Image",
    "capabilities": [
      "image"
    ],
    "description": "Ideogram Image 独立请求协议插件。",
    "baseUrl": "https://api.ideogram.ai",
    "authType": "header",
    "authField": "apiKey",
    "authHeader": "Api-Key",
    "createMethod": "POST",
    "createPath": "",
    "contentType": "multipart/form-data",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Ideogram",
    "recommendedModels": [
      "V_2",
      "V_2_TURBO",
      "V_1"
    ]
  },
  {
    "pluginId": "image-tools",
    "packageDir": "image-tools",
    "name": "Image Tools",
    "version": "1.0.0",
    "providerId": "image-tools-remove-background",
    "label": "Image Tools Remove Background",
    "capabilities": [
      "image"
    ],
    "description": "图片去背景与图层拆分工具协议插件。",
    "baseUrl": "https://api.wavespeed.ai/api/v3",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/bria/remove-background",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/predictions/{{taskId}}/result",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": true,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": false,
        "description": "默认 bria/remove-background。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": false,
        "description": "可选工具提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": true,
        "description": "源图片。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "工具扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "WaveSpeed 图像工具",
    "recommendedModels": []
  },
  {
    "pluginId": "image-tools",
    "packageDir": "image-tools",
    "name": "Image Tools",
    "version": "1.0.0",
    "providerId": "image-tools-layer-decomposition",
    "label": "Image Tools Layer Decomposition",
    "capabilities": [
      "image"
    ],
    "description": "图片去背景与图层拆分工具协议插件。",
    "baseUrl": "https://api.wavespeed.ai/api/v3",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/bytedance/seedream-v5.0-pro/layer-decomposition",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/predictions/{{taskId}}/result",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": true,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": false,
        "description": "默认 bytedance/seedream-v5.0-pro/layer-decomposition。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": false,
        "description": "描述需要拆分的图层。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": true,
        "description": "源图片。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "工具扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "WaveSpeed 图像工具",
    "recommendedModels": []
  },
  {
    "pluginId": "kling-image",
    "packageDir": "kling-image",
    "name": "Kling Image",
    "version": "2.0.0",
    "providerId": "kling-image",
    "label": "Kling Image",
    "capabilities": [
      "image"
    ],
    "description": "Kling Image 独立请求协议插件。",
    "baseUrl": "https://api.klingai.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/images/generations",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/v1/images/generations/{{taskId}}",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "快手可灵",
    "recommendedModels": [
      "kling-v1",
      "kling-v1-5",
      "kling-v2"
    ]
  },
  {
    "pluginId": "minimax-image",
    "packageDir": "minimax-image",
    "name": "MiniMax Image",
    "version": "2.0.0",
    "providerId": "minimax-image",
    "label": "MiniMax Image",
    "capabilities": [
      "image"
    ],
    "description": "MiniMax Image 独立请求协议插件。",
    "baseUrl": "https://api.minimax.io",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/image_generation",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "MiniMax",
    "recommendedModels": [
      "image-01"
    ]
  },
  {
    "pluginId": "openai-images",
    "packageDir": "openai-images",
    "name": "OpenAI Images",
    "version": "2.0.0",
    "providerId": "openai-image",
    "label": "OpenAI Images",
    "capabilities": [
      "image"
    ],
    "description": "OpenAI Images 独立请求协议插件。",
    "baseUrl": "https://api.openai.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": true,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "OpenAI",
    "recommendedModels": [
      "dall-e-3",
      "dall-e-2"
    ]
  },
  {
    "pluginId": "recraft-image",
    "packageDir": "recraft-image",
    "name": "Recraft Image",
    "version": "2.0.0",
    "providerId": "recraft-image",
    "label": "Recraft Image",
    "capabilities": [
      "image"
    ],
    "description": "Recraft Image 独立请求协议插件。",
    "baseUrl": "https://external.api.recraft.ai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Recraft",
    "recommendedModels": [
      "recraftv3",
      "recraft20b"
    ]
  },
  {
    "pluginId": "replicate-prediction-image",
    "packageDir": "replicate-prediction-image",
    "name": "Replicate Predictions Image",
    "version": "2.0.0",
    "providerId": "replicate-prediction-image",
    "label": "Replicate Predictions Image",
    "capabilities": [
      "image"
    ],
    "description": "Replicate Predictions Image 独立请求协议插件。",
    "baseUrl": "https://api.replicate.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/predictions",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/v1/predictions/{{taskId}}",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Replicate",
    "recommendedModels": []
  },
  {
    "pluginId": "runway-image",
    "packageDir": "runway-image",
    "name": "Runway Image",
    "version": "2.0.0",
    "providerId": "runway-image",
    "label": "Runway Image",
    "capabilities": [
      "image"
    ],
    "description": "Runway Image 独立请求协议插件。",
    "baseUrl": "https://api.dev.runwayml.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/text_to_image",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/v1/tasks/{{taskId}}",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Runway",
    "recommendedModels": [
      "gen3a_turbo"
    ]
  },
  {
    "pluginId": "stability-image",
    "packageDir": "stability-image",
    "name": "Stability AI Image",
    "version": "2.0.0",
    "providerId": "stability-image",
    "label": "Stability AI Image",
    "capabilities": [
      "image"
    ],
    "description": "Stability AI Image 独立请求协议插件。",
    "baseUrl": "https://api.stability.ai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "",
    "contentType": "multipart/form-data",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Stability AI",
    "recommendedModels": [
      "stable-image-ultra",
      "stable-image-core",
      "sd3-large",
      "sd3-medium"
    ]
  },
  {
    "pluginId": "tencent-hunyuan-image",
    "packageDir": "tencent-hunyuan-image",
    "name": "腾讯混元图片",
    "version": "2.0.0",
    "providerId": "tencent-hunyuan-image",
    "label": "腾讯混元图片",
    "capabilities": [
      "image"
    ],
    "description": "腾讯混元图片 独立请求协议插件。",
    "baseUrl": "https://hunyuan.tencentcloudapi.com",
    "authType": "tc3",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "腾讯混元",
    "recommendedModels": [
      "hunyuan-image"
    ]
  },
  {
    "pluginId": "vertex-imagen",
    "packageDir": "vertex-imagen",
    "name": "Vertex Imagen",
    "version": "2.0.0",
    "providerId": "vertex-imagen",
    "label": "Vertex Imagen",
    "capabilities": [
      "image"
    ],
    "description": "Vertex Imagen 独立请求协议插件。",
    "baseUrl": "https://{location}-aiplatform.googleapis.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/projects/{{request.providerOptions.vertex-imagen.project}}/locations/{{request.providerOptions.vertex-imagen.location}}/publishers/google/models/{{model}}:predict",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "Google",
    "recommendedModels": []
  },
  {
    "pluginId": "volcengine-ark-agent-plan-seedream",
    "packageDir": "volcengine-ark-agent-plan-seedream",
    "name": "Volcengine Ark Agent Plan Seedream Images",
    "version": "2.0.0",
    "providerId": "volcengine-ark-agent-plan-image",
    "label": "Volcengine Ark Agent Plan Seedream Images",
    "capabilities": [
      "image"
    ],
    "description": "Volcengine Ark Agent Plan Seedream Images 独立请求协议插件。",
    "baseUrl": "https://ark.cn-beijing.volces.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/api/plan/v3/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "火山引擎 (字节)",
    "recommendedModels": [
      "doubao-seedream-pro",
      "doubao-image-v3"
    ]
  },
  {
    "pluginId": "volcengine-ark-seedream",
    "packageDir": "volcengine-ark-seedream",
    "name": "Volcengine Ark Seedream Images",
    "version": "2.0.0",
    "providerId": "volcengine-ark-image",
    "label": "Volcengine Ark Seedream Images",
    "capabilities": [
      "image"
    ],
    "description": "Volcengine Ark Seedream Images 独立请求协议插件。",
    "baseUrl": "https://ark.cn-beijing.volces.com",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/api/v3/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "火山引擎 (字节)",
    "recommendedModels": [
      "doubao-seedream-pro",
      "doubao-image-v3"
    ]
  },
  {
    "pluginId": "volcengine-jimeng-image",
    "packageDir": "volcengine-jimeng-image",
    "name": "Volcengine Jimeng Image",
    "version": "2.0.0",
    "providerId": "volcengine-jimeng-image",
    "label": "Volcengine Jimeng Image",
    "capabilities": [
      "image"
    ],
    "description": "Volcengine Jimeng Image 独立请求协议插件。",
    "baseUrl": "https://visual.volcengineapi.com",
    "authType": "volcengine-v4",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "POST",
    "pollPath": "/",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "火山引擎 (字节)",
    "recommendedModels": [
      "doubao-seedream-pro",
      "doubao-image-v3"
    ]
  },
  {
    "pluginId": "wavespeed-image-edit",
    "packageDir": "wavespeed-image-edit",
    "name": "WaveSpeed Image Edit",
    "version": "1.0.0",
    "providerId": "wavespeed-image-edit",
    "label": "WaveSpeed Image Edit",
    "capabilities": [
      "image"
    ],
    "description": "WaveSpeed 图片编辑协议插件：GPT Image 2.5 / Seedream 5.0 Pro / Nano Banana 的 Image to Image 编辑与图层分解、去背景。",
    "baseUrl": "https://api.wavespeed.ai/api/v3",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/{{model}}",
    "contentType": "application/json",
    "hasPoll": true,
    "pollMethod": "GET",
    "pollPath": "/predictions/{{taskId}}/result",
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": true,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "WaveSpeed 图片编辑模型端点 ID，如 openai/gpt-image-2.5-sunburst/edit、bytedance/seedream-v5.0-pro/edit、google/nano-banana-2/edit。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "编辑提示词，描述对源图的修改。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "编辑源图或参考图，role 由业务层确定；按数组顺序作为 images 入参。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，如 1:1、16:9、9:16、4:3、3:4。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位：low/medium/high。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "WaveSpeed 图像工具",
    "recommendedModels": []
  },
  {
    "pluginId": "xai-grok-images",
    "packageDir": "xai-grok-images",
    "name": "xAI Grok Images",
    "version": "2.0.0",
    "providerId": "grok-image",
    "label": "xAI Grok Images",
    "capabilities": [
      "image"
    ],
    "description": "xAI Grok Images 独立请求协议插件。",
    "baseUrl": "https://api.x.ai",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v1/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "xAI (Grok)",
    "recommendedModels": [
      "grok-2-image"
    ]
  },
  {
    "pluginId": "zhipu-cogview",
    "packageDir": "zhipu-cogview",
    "name": "智谱 CogView",
    "version": "2.0.0",
    "providerId": "zhipu-cogview",
    "label": "智谱 CogView",
    "capabilities": [
      "image"
    ],
    "description": "智谱 CogView 独立请求协议插件。",
    "baseUrl": "https://open.bigmodel.cn/api/paas",
    "authType": "bearer",
    "authField": "apiKey",
    "authHeader": "",
    "createMethod": "POST",
    "createPath": "/v4/images/generations",
    "contentType": "application/json",
    "hasPoll": false,
    "pollMethod": null,
    "pollPath": null,
    "hasAgent": false,
    "agentMethod": null,
    "agentPath": null,
    "requiresPublicMediaUrls": false,
    "parameters": [
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "图片模型 ID。"
      },
      {
        "name": "prompt",
        "type": "string",
        "required": true,
        "description": "图片提示词。"
      },
      {
        "name": "images",
        "type": "media[]",
        "required": false,
        "description": "参考图或编辑源图，role 由业务层确定。"
      },
      {
        "name": "imageCount",
        "type": "integer",
        "required": false,
        "description": "输出数量。"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "required": false,
        "description": "比例或尺寸，语义按协议说明。"
      },
      {
        "name": "resolution",
        "type": "string",
        "required": false,
        "description": "分辨率档位。"
      },
      {
        "name": "quality",
        "type": "string",
        "required": false,
        "description": "质量档位。"
      },
      {
        "name": "providerOptions",
        "type": "object",
        "required": false,
        "description": "插件命名空间内的厂商扩展字段。"
      }
    ],
    "category": "image",
    "vendor": "智谱 AI",
    "recommendedModels": [
      "cogview-3-plus",
      "cogview-3"
    ]
  }
];

export const ALL_PROTOCOLS: StandardProtocolDefinition[] = [
  ...TEXT_PROTOCOLS,
  ...IMAGE_PROTOCOLS,
];

export const PROTOCOLS_BY_ID: Record<string, StandardProtocolDefinition> = ALL_PROTOCOLS.reduce(
  (acc, p) => {
    acc[p.providerId] = p;
    return acc;
  },
  {} as Record<string, StandardProtocolDefinition>
);
