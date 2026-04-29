/**
 * Scene Analyzer Service
 * 
 * Uses Gemini Flash Lite to analyze product images and automatically infer
 * optimal scene generation parameters. This replaces the need for users to
 * manually fill 15+ form fields — they just upload a product image and
 * optionally provide a one-line description.
 */

import { getAiClient } from '../utils/apiHelpers';
import type { SceneGenerationProductType, SceneGenerationBoardType } from './promptUtils';

// ==================== Types ====================

export interface SceneAnalysisResult {
  /** AI-inferred product name */
  productName: string;
  /** AI-inferred product category */
  productCategory: string;
  /** AI-inferred product type */
  productType: SceneGenerationProductType;
  /** Estimated product size (e.g. "约35cm", "S-M码") */
  productSize: string;
  /** Identified material / fabric */
  material: string;
  /** Core selling points */
  sellingPoints: string;
  /** Recommended scene direction */
  sceneDirection: string;
  /** Target audience */
  targetAudience: string;
  /** Recommended model persona preset key (Chinese) */
  modelPersonaPreset: string;
  /** Recommended ethnicity */
  modelEthnicity: string;
  /** Recommended age group */
  modelAgeGroup: string;
  /** Recommended family structure */
  modelFamilyStructure: string;
  /** Recommended lifestyle */
  modelLifestyle: string;
  /** Color / visual style */
  colorStyle: string;
  /** Usage scenario */
  usageScenario: string;
  /** Brand tone */
  brandTone: string;
  /** Physical interaction hint for realism */
  interactionHint: string;
  /** Estimated size category for physics rules */
  sizeCategory: 'tiny' | 'small' | 'medium' | 'large' | 'wearable';
}

// ==================== Analysis Prompt ====================

function buildAnalysisPrompt(userHint: string, boardType: SceneGenerationBoardType): string {
  const boardContext = {
    main: '亚马逊副图场景（突出产品卖点、电商转化）',
    aplus: 'A+ 横幅场景（品牌叙事、故事感）',
    social: '社媒买家秀（真实生活场景、手机拍摄感）',
    story: '品牌故事（电影级超宽场景、空间感、史诗氛围）',
  };

  return `
**ROLE**: 你是一位资深亚马逊运营专家和场景策划师，擅长分析产品图片并制定最优场景生成方案。

**TASK**: 分析用户上传的产品图片，自动推断生成场景所需的全部参数。用户不再需要手动填写大量表单字段。

**目标板块**: ${boardContext[boardType]}

${userHint ? `**用户补充说明**: "${userHint}"` : '**用户未提供额外说明**，请完全依赖图片分析。'}

**分析维度**（你必须推断以下所有字段）：

1. **产品识别** (如果上传了多个不同的产品，请在名称和品类中全部列出)
   - productName: 产品名称（例如 "毛绒小熊公仔"、"女士针织开衫"；如果是多个产品则如 "绿色帽玩偶与红色帽玩偶"）
   - productCategory: 产品品类（例如 "毛绒玩具"、"女装外套"；多个则如 "毛绒玩具组合"）
   - productType: 必须是 "plush"（毛绒）、"apparel"（服装）、"general"（通用）之一
   - productSize: 估算产品尺寸（如果是多个产品，请描述它们的相对大小关系）
   - material: 材质/面料（如果是多个产品，请分别描述或描述共性）

2. **营销分析**
   - sellingPoints: 核心卖点（用逗号分隔，3-5个关键词）
   - targetAudience: 目标人群（例如 "年轻妈妈"、"都市白领女性"）
   - brandTone: 品牌调性（例如 "治愈"、"轻奢"、"运动活力"）
   - colorStyle: 色调风格（例如 "暖调柔和"、"明亮活泼"、"高级灰调"）

3. **场景推荐**
   - sceneDirection: 推荐的场景方向（例如 "温暖卧室搭配柔和灯光"、"阳光客厅沙发场景"）
   - usageScenario: 使用场景（例如 "卧室陪伴"、"居家穿搭"、"户外出行"）

4. **人物推荐** — 必须是以下预设值之一：
   - modelPersonaPreset: 从以下选一个最合适的:
     [美国都市女性, 美国职场女性, 美国瑜伽/健身女性, 美国居家主妇, 美国文艺女青年,
      美国都市男性, 美国居家休闲男性, 美国运动型男性, 美国职场商务男性, 美国户外冒险男性,
      美国年轻情侣, 美国新婚夫妇, 美国闺蜜/好友, 美国跨族裔情侣,
      美国郊区家庭, 美国年轻妈妈与儿童, 美国年轻爸爸与儿童, 美国多孩家庭, 美国三代同堂,
      美国校园学生, 美国青少年, 美国小孩, 美国婴幼儿与妈妈,
      美国中年专业人士, 美国银发族, 美国宠物主人, 美国户外露营家庭, 美国派对/聚会人群,
      无模特（纯产品）]
   - modelEthnicity: 从 [自动匹配, 白人美国人, 黑人美国人, 拉丁裔美国人, 亚裔美国人, 混合族裔美国人] 选一个
   - modelAgeGroup: 从 [自动匹配, 0-3岁, 3-6岁, 5-12岁, 13-18岁, 18-25岁, 20-30岁, 25-35岁, 30-45岁, 40-55岁, 55-70岁, 60岁以上, 多年龄段] 选一个
   - modelFamilyStructure: 从 [自动匹配, 单人, 情侣, 亲子, 三口之家, 多孩家庭, 好友组合, 多人社交, 祖孙三代, 老年伴侣, 人与宠物] 选一个
   - modelLifestyle: 从 [自动匹配, 都市通勤, 职场商务, 郊区家庭, 校园, 健身运动, 居家休闲, 户外露营, 旅行度假, 宠物生活, 文艺生活, 新居生活, 退休生活, 社交聚会, 节日聚会, 节日送礼, 派对庆祝, 下午茶/咖啡, 车内场景] 选一个

5. **物理交互提示**
   - interactionHint: 描述人物与产品的物理交互方式（例如 "双手轻轻环抱毛绒玩具紧贴胸前"、"自然地将毯子搭在腿上"、"单手提起手提包自然垂在身侧"）
   - sizeCategory: 从 [tiny, small, medium, large, wearable] 选一个
     * tiny: <10cm 的小物件（首饰、钥匙扣等）
     * small: 10-25cm（小型玩偶、杯子等）
     * medium: 25-50cm（中型毛绒、抱枕等）
     * large: >50cm（大型毛绒、毯子等）
     * wearable: 穿戴类产品（服装、帽子、围巾等）

**推断原则**：
- **语言红线**：绝对禁止使用“童话感”、“梦幻”、“魔法”、“插画风”等脱离现实的修饰词，必须使用“真实感”、“纪实感”、“生活气息”来描述。
- 如果是毛绒/玩偶产品 → 优先推荐真实的北美中产家庭亲子场景（如儿童房、客厅沙发、毛绒地毯），必须强调真实质感，禁用“童话”等字眼。
- 如果是服装产品 → 优先推荐与服装风格匹配的真实生活方式场景（如街头、咖啡馆、通勤路上）。
- 如果是家居产品 → 优先推荐客厅/卧室居家场景。
- 如果是食品/饮品 → 优先推荐厨房/餐厅/下午茶场景。
- 如果产品面向儿童 → 推荐亲子或儿童真实的日常玩耍场景。
- 场景推荐必须高度贴合真实的美国本土生活方式，具有顶级商业纪实摄影感。

**OUTPUT FORMAT**: 
返回纯 JSON 对象，不要用 markdown 代码块包裹。确保所有 string value 用双引号。
`;
}

// ==================== Main Analysis Function ====================

/**
 * Analyze product images to automatically infer scene generation parameters.
 * Uses Gemini Flash Lite for fast, cost-effective analysis.
 * 
 * @param images - Product reference images (base64 encoded)
 * @param userHint - Optional one-line user description (e.g. "圣诞节送礼场景")
 * @param boardType - Target board type (main/aplus/social)
 * @returns Structured scene analysis result
 */
export async function analyzeProductForScene(
  images: { base64: string; mimeType: string }[],
  userHint: string = '',
  boardType: SceneGenerationBoardType = 'main'
): Promise<SceneAnalysisResult> {
  const ai = getAiClient();
  
  const parts: any[] = [];
  
  // Add product images
  images.forEach((img) => {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    });
  });
  
  // Add analysis prompt
  parts.push({ text: buildAnalysisPrompt(userHint, boardType) });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: { parts },
    });
    
    let text = response.text || '{}';
    // Remove markdown code blocks if present
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    try {
      const result = JSON.parse(text);
      return validateAnalysisResult(result);
    } catch (parseError) {
      console.warn('Scene analysis JSON parse failed, attempting sanitization...', parseError);
      // Try sanitizing
      const sanitized = text.replace(/[\n\r\t]/g, ' ');
      try {
        const result = JSON.parse(sanitized);
        return validateAnalysisResult(result);
      } catch (e2) {
        console.error('Scene analysis parse completely failed:', e2);
        return getDefaultAnalysisResult();
      }
    }
  } catch (error) {
    console.error('Scene analysis API call failed:', error);
    return getDefaultAnalysisResult();
  }
}

// ==================== Validation & Defaults ====================

const VALID_PRODUCT_TYPES: SceneGenerationProductType[] = ['plush', 'apparel', 'general'];
const VALID_SIZE_CATEGORIES = ['tiny', 'small', 'medium', 'large', 'wearable'] as const;

function validateAnalysisResult(raw: any): SceneAnalysisResult {
  return {
    productName: raw.productName || '商品',
    productCategory: raw.productCategory || '通用产品',
    productType: VALID_PRODUCT_TYPES.includes(raw.productType) ? raw.productType : 'general',
    productSize: raw.productSize || '',
    material: raw.material || '',
    sellingPoints: raw.sellingPoints || '',
    sceneDirection: raw.sceneDirection || '温暖居家生活场景',
    targetAudience: raw.targetAudience || '',
    modelPersonaPreset: raw.modelPersonaPreset || '美国都市女性',
    modelEthnicity: raw.modelEthnicity || '自动匹配',
    modelAgeGroup: raw.modelAgeGroup || '20-30岁',
    modelFamilyStructure: raw.modelFamilyStructure || '单人',
    modelLifestyle: raw.modelLifestyle || '居家休闲',
    colorStyle: raw.colorStyle || '',
    usageScenario: raw.usageScenario || '',
    brandTone: raw.brandTone || '',
    interactionHint: raw.interactionHint || 'naturally interacting with the product',
    sizeCategory: VALID_SIZE_CATEGORIES.includes(raw.sizeCategory) ? raw.sizeCategory : 'medium',
  };
}

function getDefaultAnalysisResult(): SceneAnalysisResult {
  return {
    productName: '商品',
    productCategory: '通用产品',
    productType: 'general',
    productSize: '',
    material: '',
    sellingPoints: '',
    sceneDirection: '温暖居家生活场景',
    targetAudience: '',
    modelPersonaPreset: '美国都市女性',
    modelEthnicity: '自动匹配',
    modelAgeGroup: '20-30岁',
    modelFamilyStructure: '单人',
    modelLifestyle: '居家休闲',
    colorStyle: '',
    usageScenario: '',
    brandTone: '',
    interactionHint: 'naturally interacting with the product',
    sizeCategory: 'medium',
  };
}

export interface ReferenceSceneAnalysis {
  /** Detailed English description for prompt */
  sceneDirection: string;
  /** Inferred interaction hint (Chinese) */
  interactionHint: string;
  /** Color style (Chinese) */
  colorStyle: string;
  /** Suggested model persona (Chinese) */
  modelPersonaPreset: string;
}

/**
 * Analyze a user-provided reference scene image to extract its composition,
 * lighting, and atmosphere details for generation guidance.
 */
export async function analyzeReferenceScene(image: { base64: string; mimeType: string }): Promise<ReferenceSceneAnalysis | null> {
  const ai = getAiClient();
  
  const prompt = `
你是一位专业的商业摄影场景分析师。请分析这张参考图片，推断其构图、光影、环境元素，并输出用于指导 AI 图像生成的详细参数。

请输出以下 JSON 格式：
{
  "sceneDirection": "详细的英文描述，涵盖 Composition (视角/景深), Lighting (光源性质/方向), Environment (核心家具/背景装饰), Mood (氛围/色调)。30-60词。",
  "interactionHint": "中文描述。根据图片推断人物与产品的物理交互（例如：人物靠在床头抱着玩偶、双手托举产品、放在桌面背景等）",
  "colorStyle": "中文描述出的色调风格（例如：暖光柔和、明亮家居、冷色调简约等）",
  "modelPersonaPreset": "如果图中有人物，匹配最合适的预设标签（例如：美国年轻妈妈与儿童、美国都市女性等）。如果没人则写“无模特（纯产品）”"
}

只返回纯 JSON 对象。
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          { text: prompt }
        ]
      },
    });

    let text = response.text || '{}';
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Reference scene analysis failed:', error);
    return null;
  }
}
