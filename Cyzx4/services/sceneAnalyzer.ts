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
  };

  return `
**ROLE**: 你是一位资深亚马逊运营专家和场景策划师，擅长分析产品图片并制定最优场景生成方案。

**TASK**: 分析用户上传的产品图片，自动推断生成场景所需的全部参数。用户不再需要手动填写大量表单字段。

**目标板块**: ${boardContext[boardType]}

${userHint ? `**用户补充说明**: "${userHint}"` : '**用户未提供额外说明**，请完全依赖图片分析。'}

**分析维度**（你必须推断以下所有字段）：

1. **产品识别**
   - productName: 产品名称（例如 "毛绒小熊公仔"、"女士针织开衫"）
   - productCategory: 产品品类（例如 "毛绒玩具"、"女装外套"）
   - productType: 必须是 "plush"（毛绒）、"apparel"（服装）、"general"（通用）之一
   - productSize: 估算产品尺寸（例如 "约35cm"、"M-L码"、"约20x15cm"）
   - material: 材质/面料（例如 "水晶超柔绒"、"纯棉针织"、"PU皮革"）

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
- 如果是毛绒/玩偶产品 → 优先推荐亲子场景或居家治愈场景
- 如果是服装产品 → 优先推荐与服装风格匹配的生活方式场景
- 如果是家居产品 → 优先推荐客厅/卧室居家场景
- 如果是食品/饮品 → 优先推荐厨房/餐厅/下午茶场景
- 如果产品面向儿童 → 推荐亲子或儿童场景
- 如果产品面向男性 → 推荐男性人群
- 场景推荐必须贴合美国本土生活方式

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
