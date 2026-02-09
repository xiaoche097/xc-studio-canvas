---
description: AI图像风格复刻的Prompt工程最佳实践
---

# Style Replication Prompt Engineering Skill

## 概述

本技能文档记录了使用 Gemini 图像生成模型进行"风格复刻"时的最佳实践和经验教训。

## 核心挑战

AI 图像生成模型在执行复杂的"风格复刻"任务时，面临以下挑战：

1. **布局一致性**：AI 可能不会复刻参考图的区块结构
2. **产品识别**：AI 可能混淆用户产品和参考图中的产品
3. **场景替换**：AI 可能忽略用户指定的场景要求
4. **随机性**：即使相同 prompt，每次结果也可能不同

## Prompt 设计原则

### 1. 简洁优先

过于复杂的 prompt 可能让 AI 困惑。最有效的 prompt 结构：

```
复刻图片N的设计。

规则：
1. 布局完全一样（区块数量、排列方式、文字位置）
2. 产品换成图片1-M中的产品
3. 背景/场景换成：[用户指定的场景]

直接开始，不要解释。
```

### 2. 图片顺序很重要

```
图片顺序：
1. 产品图片（1到N张）- 放在前面
2. 参考设计图（1张）- 放在最后

这样 AI 更容易理解哪些是产品，哪些是参考。
```

### 3. Temperature 设置

| Temperature | 效果 |
|-------------|------|
| 0.1 | 最稳定，但可能缺乏创意 |
| 0.3-0.5 | 平衡稳定性和创意 |
| 0.7+ | 更有创意，但结果不稳定 |

**推荐**：对于复刻任务，使用 0.1-0.3

### 4. 明确的优先级

如果需要同时做多件事（替换产品、替换场景、保持布局），要明确优先级：

```
最重要：布局结构一致
其次：使用正确的产品
然后：替换场景（如果有要求）
```

## 已验证有效的 Prompt 模板

### 模板 A：极简版（推荐）

```typescript
const prompt = `
复刻图片${productCount + 1}的设计。

规则：
1. 布局完全一样（区块数量、排列方式、文字位置）
2. 产品换成图片1-${productCount}中的产品
${customPrompt ? `3. 背景/场景换成：${customPrompt}` : ''}

直接开始，不要解释。
`;
```

### 模板 B：结构化版

```typescript
const prompt = `
# 设计复刻任务

## 要复刻的内容
- 图片${productCount + 1}的布局结构
- 图片${productCount + 1}的设计风格

## 要替换的内容
- 产品 → 图片1-${productCount}
${customPrompt ? `- 场景 → ${customPrompt}` : ''}

## 禁止
- 改变布局结构
- 使用参考图的产品
`;
```

## 已知限制

### Gemini 图像模型的限制

1. **布局理解有限**：模型可能不理解复杂的多区块布局
2. **产品识别不稳定**：多图输入时可能混淆产品
3. **场景知识有限**：对特定品牌/型号的视觉理解有限（如"特斯拉 Model Y 内饰"）
4. **固有随机性**：即使 temperature 设为 0，仍可能有变化

### 应对策略

1. **多次生成**：让用户生成多张，选择最好的
2. **场景参考图**：如果用户需要特定场景，让他们上传场景参考图
3. **降低期望**：向用户说明 AI 生成的局限性
4. **迭代优化**：使用编辑功能对不满意的部分进行修改

## 调试技巧

### 1. 启用详细日志

```typescript
console.log('[StyleReplication] customPrompt:', customPrompt);
console.log('[StyleReplication] productCount:', productCount);
console.log('[StyleReplication] Full prompt:', prompt);
```

### 2. 检查图片顺序

确保产品图在前，参考图在后：

```typescript
// 1. 先添加产品图
for (const img of productImages) {
  parts.push({ inlineData: { mimeType: img.mime, data: img.base64 } });
}

// 2. 再添加参考图
parts.push({ inlineData: { mimeType: styleReference.mime, data: styleReference.base64 } });

// 3. 最后添加文字 prompt
parts.push({ text: prompt });
```

### 3. 测试不同 temperature

```typescript
// 测试时可以尝试不同值
temperature: 0.1,  // 最稳定
temperature: 0.3,  // 平衡
temperature: 0.5,  // 有变化
```

## 未来改进方向

1. **两步生成**：先生成布局模板，再填充产品
2. **布局检测**：使用视觉模型先分析参考图的布局
3. **多模型对比**：测试不同模型的效果
4. **用户反馈循环**：收集用户反馈，持续优化 prompt

## 相关文件

- `Cyzx4/services/geminiService.ts` - generateStyleReplication 函数
- `Cyzx4/components/StyleReplicateTab.tsx` - UI 组件
