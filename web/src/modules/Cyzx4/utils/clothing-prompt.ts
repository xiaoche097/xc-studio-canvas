import type { Requirements, ModelGenOptions } from '../types/workflow.types';

export function buildModelConstraintsText(spec?: ModelGenOptions): string {
  if (!spec) return '';
  const lines = [
    spec.gender ? `性别：${spec.gender}` : '',
    spec.ageRange ? `年龄：${spec.ageRange}` : '',
    spec.skinTone ? `肤色/人种：${spec.skinTone}` : '',
    spec.pose ? `姿势：${spec.pose}` : '',
    spec.expression ? `表情：${spec.expression}` : '',
    spec.hairstyle ? `发型：${spec.hairstyle}` : '',
    spec.makeup ? `妆容：${spec.makeup}` : '',
    spec.extra ? `补充：${spec.extra}` : '',
  ].filter(Boolean);
  if (!lines.length) return '';
  return `【模特要求】\n- ${lines.join('\n- ')}`;
}

export function buildRequirementsText(req: Requirements): string {
  const lines = [
    `【渠道】${req.platform}`,
    `【目标语言】${req.targetLanguage}`,
    `【画面比例】${req.aspectRatio}`,
    `【清晰度】${req.clarity}`,
    req.templateId ? `【模板】${req.templateId}` : '',
    req.description ? `【基础描述】${req.description}` : '',
    req.styleTags?.length ? `【风格标签】${req.styleTags.join('、')}` : '',
    req.backgroundTags?.length ? `【背景】${req.backgroundTags.join('、')}` : '',
    req.cameraTags?.length ? `【镜头】${req.cameraTags.join('、')}` : '',
    req.focusTags?.length ? `【重点】${req.focusTags.join('、')}` : '',
    req.extraText ? `【高级补充】${req.extraText}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}
