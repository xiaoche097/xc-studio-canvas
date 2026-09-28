/**
 * 提示词模板服务 (Prompt Template Service)
 * 覆盖图 4 的所有电商与视觉生成功能能力
 * 用于为 Agent 定义各模块的角色设定、系统指令、任务结构与输出规范
 */

export interface PromptTemplateItem {
  id: string;
  typeId: string;             // 对应能力类型 ID
  typeName: string;           // 模板类型主名称 (如: 生成电商主图、单品试穿)
  subCategory: string;        // 子分类 (如: 爆款复刻、模特服装、主图/详情图)
  versionName: string;        // 版本名称 (如: 默认生成电商主图模板)
  versionTag: string;         // 版本标识 (如: v1, v2)
  content: string;            // 核心提示词/角色定义正文
  charCount: number;          // 字符数
  outputFormat: string;       // 输出标识 (如: chapter-assets/v1, 文本, storyboard-plan/v3)
  outputSchema?: string;      // 输出 JSON Schema 或规范说明
  status: 'active' | 'history'; // active: 应用中, history: 历史版本
  updatedAt: string;          // 更新时间
}

export interface PromptTypeDefinition {
  id: string;
  name: string;
  group: 'main_show' | 'hot_replicate' | 'model_fashion' | 'general';
  groupName: string;
  defaultOutputFormat: string;
  description: string;
  defaultSchema: string;
  defaultPrompt: string;
}

// 图 4 所有能力分类完整定义
export const PROMPT_CAPABILITY_TYPES: PromptTypeDefinition[] = [
  // 1. 主图/详情图/展示频类 (3个)
  {
    id: 'image_gen',
    name: '图像生成',
    group: 'main_show',
    groupName: '主图/详情图/展示频类',
    defaultOutputFormat: 'creative-canvas/v1',
    description: '融合多张参考素材，快速构建完整商业画面',
    defaultSchema: `{
  "type": "object",
  "required": ["subject", "environment", "composition", "lighting", "negative_prompt"],
  "properties": {
    "subject": { "type": "string", "description": "核心主体特征与细节描述" },
    "environment": { "type": "string", "description": "环境背景与氛围光影" },
    "composition": { "type": "string", "description": "景别构图与视角参数" },
    "lighting": { "type": "string", "description": "商业级影棚/自然光线方案" },
    "negative_prompt": { "type": "string", "description": "负面排查约束" }
  }
}`,
    defaultPrompt: `你是一个顶级商业视觉构图 Agent。你的职责是深度分析用户提供的素材与需求，构想出高转化率、光影通透、主体突出的商业画面。
【角色定位】资深电商视觉策划总监，专精产品商业展示与视觉质感塑造。
【输出要求】结构化输出主体、场景、镜头焦段、色温与材质细节，确保生成画面符合高端商业广告标准。`
  },
  {
    id: 'product_swap',
    name: '产品替换',
    group: 'main_show',
    groupName: '主图/详情图/展示频类',
    defaultOutputFormat: 'product-swap/v1',
    description: '保留原图构图与氛围，一键替换画面产品',
    defaultSchema: `{
  "type": "object",
  "required": ["mask_target", "fit_mode", "shadow_retention", "blend_prompt"],
  "properties": {
    "mask_target": { "type": "string", "description": "被替换产品区域描述" },
    "fit_mode": { "type": "string", "enum": ["exact", "perspective_align", "natural_pose"] },
    "shadow_retention": { "type": "boolean", "description": "是否保留原图自然阴影与接触面光影" },
    "blend_prompt": { "type": "string", "description": "融合过渡与环境反光补充词" }
  }
}`,
    defaultPrompt: `你是一个产品重构与替换 Agent。在替换主画面的商品时，必须严格保留原始环境的反光、明暗交界线、投影透视与质感过渡，使新产品严丝合缝融入原有场景。`
  },
  {
    id: 'inpainting',
    name: '局部替换',
    group: 'main_show',
    groupName: '主图/详情图/展示频类',
    defaultOutputFormat: 'mask-edit/v1',
    description: '精确定选局部区域，发指令完成自然替换',
    defaultSchema: `{
  "type": "object",
  "required": ["instruction", "inpaint_area", "edge_feather_px"],
  "properties": {
    "instruction": { "type": "string", "description": "局部变更的具体指令" },
    "inpaint_area": { "type": "string", "description": "重绘区域语义识别" },
    "edge_feather_px": { "type": "number", "default": 12 }
  }
}`,
    defaultPrompt: `你是一个局部细节修饰与材质变换 Agent。只针对选定蒙版区域进行修改，严格保持周边上下文环境与色彩一致。`
  },

  // 2. 爆款复刻类 (7个)
  {
    id: 'white_background',
    name: '通用白底图精修',
    group: 'hot_replicate',
    groupName: '爆款复刻',
    defaultOutputFormat: 'white-bg/v1',
    description: '百元/八大商品品类，批量生成专业级白底精修图',
    defaultSchema: `{
  "type": "object",
  "required": ["pure_hex", "ground_shadow", "reflections", "enhancement_prompts"],
  "properties": {
    "pure_hex": { "type": "string", "default": "#FFFFFF" },
    "ground_shadow": { "type": "string", "enum": ["soft_drop", "contact_ambient", "mirror_reflection"] },
    "enhancement_prompts": { "type": "string", "description": "产品边缘清晰度与反光增强词" }
  }
}`,
    defaultPrompt: `你是一个专业电商白底图精修大师。
【背景标准】纯净无杂质 RGB(255,255,255) #FFFFFF 白底。
【投影光影】保留或生成真实自然的接触面物理阴影，严禁生硬悬空。
【质感优化】消除反光瑕疵、增强五金/皮革/面料的材质通透度。`
  },
  {
    id: 'ai_product_video',
    name: 'AI生成产品视频',
    group: 'hot_replicate',
    groupName: '爆款复刻',
    defaultOutputFormat: 'storyboard-plan/v3',
    description: '从产品素材到分镜方案，批量生成商业展示视频',
    defaultSchema: `{
  "type": "object",
  "required": ["duration_sec", "motion_intensity", "camera_movement", "keyframes"],
  "properties": {
    "duration_sec": { "type": "number", "default": 5 },
    "motion_intensity": { "type": "number", "default": 0.6 },
    "camera_movement": { "type": "string", "description": "运镜方式: 缓推/环绕/上扬" },
    "keyframes": { "type": "array", "items": { "type": "string" } }
  }
}`,
    defaultPrompt: `你是一个电商商业短视频分镜设计 Agent。将单张产品静止图转换为符合商业转化节奏的动效视频提示词，包含微距特写推镜头、光影流转动效与流畅的产品空间展示。`
  },
  {
    id: 'hero_main',
    name: '主图生成',
    group: 'hot_replicate',
    groupName: '爆款复刻',
    defaultOutputFormat: 'hero-card/v1',
    description: '面向电商平台，生成清晰聚焦的高转化主图',
    defaultSchema: `{
  "type": "object",
  "required": ["visual_focal_point", "click_through_boosters", "prompt_cn", "prompt_en"],
  "properties": {
    "visual_focal_point": { "type": "string", "description": "首屏第一视觉焦点" },
    "click_through_boosters": { "type": "array", "items": { "type": "string" } },
    "prompt_en": { "type": "string", "description": "英文渲染提示词" }
  }
}`,
    defaultPrompt: `你是一个电商搜索主图点击率 (CTR) 提升专家。构图必须保证产品居中或黄金分割位，占比不低于全图 65%，色彩鲜明抓人眼球，杜绝视觉干扰。`
  },
  {
    id: 'ecommerce_hero',
    name: '生成电商主图',
    group: 'hot_replicate',
    groupName: '爆款复刻',
    defaultOutputFormat: 'chapter-assets/v1',
    description: '融合产品信息、目标平台与多语言文案，生成高转化电商主图',
    defaultSchema: `{
  "type": "object",
  "required": ["characters", "scenes", "props", "selling_point_tags"],
  "properties": {
    "characters": { "type": "array", "items": { "$ref": "#/defs/characters" } },
    "scenes": { "type": "array", "items": { "$ref": "#/defs/scenes" } },
    "selling_point_tags": { "type": "array", "items": { "type": "string" } }
  }
}`,
    defaultPrompt: `你是一个全域国际化电商主图视觉企划 Agent。
根据输入的商品名称、核心卖点与品类属性，策划兼具场景说服力与品质高级感的商业主图。
【要求】结合海外亚马逊、独立站标准，严格把控构图比例、色温氛围与高精度材质表达。`
  },
  {
    id: 'scene_generation',
    name: '场景图生成',
    group: 'hot_replicate',
    groupName: '爆款复刻',
    defaultOutputFormat: 'scene-composition/v2',
    description: '把产品自然放入匹配卖点的商业生活场景',
    defaultSchema: `{
  "type": "object",
  "required": ["scene_category", "ambient_lighting", "context_props", "render_prompt"],
  "properties": {
    "scene_category": { "type": "string", "description": "场景分类: 现代家居/自然户外/轻奢影棚/办公商务" },
    "ambient_lighting": { "type": "string", "description": "环境色调与漫反射细节" },
    "context_props": { "type": "array", "items": { "type": "string" } },
    "render_prompt": { "type": "string", "description": "最终环境渲染词" }
  }
}`,
    defaultPrompt: `你是一个商业产品场景美学 Agent。善于根据产品功能定位（如咖啡机、护肤品、汽车配件等），构建最契合消费者心智的自然生活场景与陈设道具，烘托高溢价氛围。`
  },
  {
    id: 'photo_lab',
    name: '摄影实验室',
    group: 'hot_replicate',
    groupName: '爆款复刻',
    defaultOutputFormat: 'camera-preset/v1',
    description: '组合相机、镜头与胶片预设，批量生成统一摄影语言的商业成片',
    defaultSchema: `{
  "type": "object",
  "required": ["camera_body", "lens_focal", "aperture", "color_grading"],
  "properties": {
    "camera_body": { "type": "string", "description": "机身模拟: Hasselblad H6D-100c / Sony A7R5 / Leica M11" },
    "lens_focal": { "type": "string", "description": "镜头焦距: 35mm / 50mm / 85mm / 100mm Macro" },
    "aperture": { "type": "string", "description": "光圈景深: f/1.4 / f/2.8 / f/8" },
    "color_grading": { "type": "string", "description": "胶片色调与颗粒感预设" }
  }
}`,
    defaultPrompt: `你是一个大师级商业摄影师 Agent。通过专业光学参数（哈苏/徕卡机身、85mm定焦、f/2.8光圈散景、中画幅高动态范围）构建极具电影感和高级杂志质感的商业视觉。`
  },
  {
    id: 'style_replicate',
    name: '风格复刻',
    group: 'hot_replicate',
    groupName: '爆款复刻',
    defaultOutputFormat: 'style-dna/v1',
    description: '提取参考图片语言，复刻统一的高级视觉风格',
    defaultSchema: `{
  "type": "object",
  "required": ["color_palette", "lighting_signature", "texture_dna", "style_prompt"],
  "properties": {
    "color_palette": { "type": "array", "items": { "type": "string" } },
    "lighting_signature": { "type": "string", "description": "标志性布光方式" },
    "style_prompt": { "type": "string", "description": "风格复刻核心引导词" }
  }
}`,
    defaultPrompt: `你是一个视觉风格解构与复刻 Agent。解构参考图的色彩体系、颗粒度、光影落点与构图节奏，提炼出可无损复用到新产品上的风格 DNA 提示词。`
  },

  // 3. 模特服装类 (11个)
  {
    id: 'virtual_model',
    name: '生成虚拟模特',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'character-breakdown/v1',
    description: '按喜好生成专属虚拟模特，支持参考人像、动作多选及手部、头部、脚部等部位生成',
    defaultSchema: `{
  "type": "object",
  "required": ["ethnicity", "gender", "age_range", "body_build", "facial_features", "pose"],
  "properties": {
    "ethnicity": { "type": "string", "description": "人种特征: 欧美/东亚/拉美/混血" },
    "gender": { "type": "string", "enum": ["female", "male", "neutral"] },
    "body_build": { "type": "string", "description": "身材比例与身型骨架" },
    "facial_features": { "type": "string", "description": "面部特征、妆容与发型" },
    "pose": { "type": "string", "description": "自然时尚站姿或走态" }
  }
}`,
    defaultPrompt: `你是一个专属虚拟时尚模特定制 Agent。负责塑造面部对称自然、皮肤肌理真实、骨骼比例符合主流时尚审美的专业级商业试衣模特。`
  },
  {
    id: 'universal_tryon',
    name: '万物上身',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'universal-fit/v2',
    description: '模特换装、人台试穿、鞋靴上脚，Agent 全流程确保真实融合交付',
    defaultSchema: `{
  "type": "object",
  "required": ["item_category", "fit_tension", "drape_wrinkles", "seam_alignment"],
  "properties": {
    "item_category": { "type": "string", "enum": ["tops", "bottoms", "dresses", "shoes", "bags", "jewelry"] },
    "fit_tension": { "type": "string", "description": "松紧适度与版型贴合" },
    "drape_wrinkles": { "type": "string", "description": "符合人体工学的自然衣褶与垂坠感" }
  }
}`,
    defaultPrompt: `你是一个高级服装上身与试穿融合 Agent。精准计算面料重力下垂、肢体关节拉扯褶皱与环境光遮蔽，确保服装在模特身上真实可信，绝无漂浮贴图感。`
  },
  {
    id: 'single_item_tryon',
    name: '单品试穿',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'garment-wear/v1',
    description: '从商品多角度素材出发，生成自然可信的试戴与试穿效果',
    defaultSchema: `{
  "type": "object",
  "required": ["garment_details", "fabric_texture", "model_interaction"],
  "properties": {
    "garment_details": { "type": "string", "description": "领口/袖口/拉链细节保留" },
    "fabric_texture": { "type": "string", "description": "针织/丝绸/牛仔等面料材质保真" }
  }
}`,
    defaultPrompt: `你是一个单件服装精细化试穿 Agent。将独立单品完好穿戴于模特身上，百分百还原原商品的图案印花、领口缝线与色泽。`
  },
  {
    id: 'model_transfer',
    name: '模特迁移',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'model-migration/v1',
    description: '迁移服装与模特呈现，扩展商品拍摄素材',
    defaultSchema: `{
  "type": "object",
  "required": ["source_pose", "target_scene", "outfit_preservation"],
  "properties": {
    "source_pose": { "type": "string" },
    "target_scene": { "type": "string" }
  }
}`,
    defaultPrompt: `你是一个模特姿态与服装迁移 Agent。将已有试衣模特连带服装无损迁移至全新商业背景中，自动适应新光影。`
  },
  {
    id: 'model_faceswap',
    name: '模特换脸',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'face-align/v1',
    description: '上传模特的参考人脸，支持模特与场景深度定制，一键批量自然换脸',
    defaultSchema: `{
  "type": "object",
  "required": ["face_landmarks", "skin_tone_match", "gaze_direction"],
  "properties": {
    "skin_tone_match": { "type": "boolean", "default": true },
    "gaze_direction": { "type": "string", "description": "视线对齐" }
  }
}`,
    defaultPrompt: `你是一个高精模特面容替换 Agent。在换脸过程中严密计算肤色匹配、头颈过渡、发际线融合与环境反光，杜绝假面感。`
  },
  {
    id: 'model_pose_fission',
    name: '模特姿势裂变',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'pose-fission/v1',
    description: '基于同一模特生成多角度、多姿势商品素材',
    defaultSchema: `{
  "type": "object",
  "required": ["character_seed", "poses_list", "continuity_lock"],
  "properties": {
    "character_seed": { "type": "string" },
    "poses_list": { "type": "array", "items": { "type": "string" } }
  }
}`,
    defaultPrompt: `你是一个模特姿态裂变 Agent。在保持模特面容、发型、体态与所穿服装完全一致的前提下，生成侧身、行走、插袋、回眸等 6-9 组自然商拍动作。`
  },
  {
    id: 'model_scene_fission',
    name: '模特场景裂变',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'scene-fission/v1',
    description: '多图裂变生成 9 个不同机位、景别与动作姿势的高清大图',
    defaultSchema: `{
  "type": "object",
  "required": ["camera_angles", "distance_shots", "environments"],
  "properties": {
    "camera_angles": { "type": "array", "items": { "type": "string" } }
  }
}`,
    defaultPrompt: `你是一个模特大片多景别裂变 Agent。围绕核心模特输出远景全身、中景半身、特写衣角与不同背景互动的全套画册。`
  },
  {
    id: 'model_angle_control',
    name: '模特角度控制',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'angle-matrix/v1',
    description: '精准控制 AI 模特拍摄视角、身体朝向、头部姿势与眼睛视线',
    defaultSchema: `{
  "type": "object",
  "required": ["yaw_angle", "pitch_angle", "body_orientation"],
  "properties": {
    "yaw_angle": { "type": "number", "description": "偏航旋转角度 (-90° 到 +90°)" },
    "pitch_angle": { "type": "number", "description": "俯仰角度: 俯拍/仰拍/平视" }
  }
}`,
    defaultPrompt: `你是一个模特摄影机位角度控制 Agent。严格按照用户指定的 3D 空间朝向（正面、正侧 90°、后侧 45°、俯视）旋转模特并保留衣装细节。`
  },
  {
    id: 'model_paste_back',
    name: '模特原图贴回',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'detail-blend/v1',
    description: '将原图细节精准贴回，修复生成图关键区域',
    defaultSchema: `{
  "type": "object",
  "required": ["target_features", "feather_radius", "high_pass_blend"],
  "properties": {
    "target_features": { "type": "array", "items": { "type": "string" } }
  }
}`,
    defaultPrompt: `你是一个原图细节高保真贴合 Agent。用于将最关键的面料纹理、品牌商标或手部结构像素级无缝贴回生成画面。`
  },
  {
    id: 'outfit_extraction',
    name: '搭配提取',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'outfit-breakdown/v1',
    description: '从模特造型中提取单品与整套搭配信息',
    defaultSchema: `{
  "type": "object",
  "required": ["items_detected", "color_palette", "styling_advice"],
  "properties": {
    "items_detected": { "type": "array", "items": { "type": "object" } }
  }
}`,
    defaultPrompt: `你是一个时尚买手与造型拆解 Agent。精准分析模特全身穿搭，逐一解构上装、下装、配饰、鞋履的品类、材质、版型与风格标签。`
  },
  {
    id: 'outfit_isolation',
    name: '一键分离模特穿搭',
    group: 'model_fashion',
    groupName: '模特服装',
    defaultOutputFormat: 'outfit-grid/v1',
    description: '上传一张人物穿搭图，自动识别全部可见单品并生成 2:3 纯白底排版全图',
    defaultSchema: `{
  "type": "object",
  "required": ["grid_layout", "items", "canvas_ratio"],
  "properties": {
    "canvas_ratio": { "type": "string", "default": "2:3" },
    "grid_layout": { "type": "string", "default": "magazine_flat_lay" }
  }
}`,
    defaultPrompt: `你是一个杂志级穿搭平铺 (Flat-lay) 分离 Agent。将真人模特穿搭拆解为各件独立的纯白底陈列单品图，并按美学比例排版。`
  },

  // 4. 通用核心 Agent
  {
    id: 'chief_visual_director',
    name: '首席电商视觉总监 Agent',
    group: 'general',
    groupName: '通用/核心角色',
    defaultOutputFormat: 'executive-plan/v1',
    description: '统领全流程视觉策划、各功能角色调度与商业美学质感把控',
    defaultSchema: `{
  "type": "object",
  "required": ["role_title", "strategy_intent", "step_guidelines", "quality_checklist"],
  "properties": {
    "role_title": { "type": "string" },
    "strategy_intent": { "type": "string" },
    "quality_checklist": { "type": "array", "items": { "type": "string" } }
  }
}`,
    defaultPrompt: `你是一个拥有 10 年头部品牌主理人经验的全球电商视觉总监。
【使命】深入解析商品商业卖点，将其转化为极具消费冲动的视觉方案。
【原则】
1. 严谨、专业、精炼，拒绝空洞辞藻；
2. 始终站在买家第一眼决策视角（首图点击率与详情页转化率）；
3. 严格遵循光影透视、材质真实性与平台合规红线。`
  }
];

const STORAGE_KEY = 'platform_prompt_templates_v2';

class PromptTemplateService {
  private templates: PromptTemplateItem[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.templates = parsed;
          return;
        }
      }
    } catch {}

    // 初始化默认预设版本 (覆盖图 4 的所有核心功能)
    this.templates = PROMPT_CAPABILITY_TYPES.map((type, idx) => ({
      id: `tmpl_${type.id}_v1`,
      typeId: type.id,
      typeName: type.name,
      subCategory: type.groupName,
      versionName: `默认${type.name}模板`,
      versionTag: 'v1',
      content: type.defaultPrompt,
      charCount: type.defaultPrompt.length,
      outputFormat: type.defaultOutputFormat,
      outputSchema: type.defaultSchema,
      status: 'active',
      updatedAt: '2026/09/28 10:38:01',
    }));

    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.templates));
      window.dispatchEvent(new CustomEvent('prompt-templates-updated'));
    } catch (e) {
      console.error('Failed to persist prompt templates:', e);
    }
  }

  public getAllTemplates(): PromptTemplateItem[] {
    return [...this.templates];
  }

  public getTemplatesByType(typeId: string): PromptTemplateItem[] {
    return this.templates.filter((t) => t.typeId === typeId);
  }

  // 获取当前生效的应用中版本 (用于供 Agent 真正调用)
  public getActiveTemplate(typeId: string): PromptTemplateItem | undefined {
    const list = this.templates.filter((t) => t.typeId === typeId);
    return list.find((t) => t.status === 'active') || list[0];
  }

  // 获得用于 Agent 的系统指令正文
  public getAgentRolePrompt(typeId: string): string {
    const active = this.getActiveTemplate(typeId);
    if (active && active.content) return active.content;

    const fallback = PROMPT_CAPABILITY_TYPES.find((t) => t.id === typeId);
    return fallback ? fallback.defaultPrompt : '';
  }

  // 新建或保存版本
  public saveTemplate(data: {
    typeId: string;
    versionName: string;
    content: string;
    outputFormat?: string;
    outputSchema?: string;
    setAsActive: boolean;
  }): PromptTemplateItem {
    const typeDef = PROMPT_CAPABILITY_TYPES.find((t) => t.id === data.typeId);
    const existing = this.templates.filter((t) => t.typeId === data.typeId);
    const nextVersionNum = existing.length + 1;
    const versionTag = `v${nextVersionNum}`;

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    // 如果设为应用中，先将同类型的其他版本置为历史版本
    if (data.setAsActive) {
      this.templates.forEach((t) => {
        if (t.typeId === data.typeId) {
          t.status = 'history';
        }
      });
    }

    const newItem: PromptTemplateItem = {
      id: `tmpl_${data.typeId}_${Date.now().toString(36)}`,
      typeId: data.typeId,
      typeName: typeDef ? typeDef.name : '自定义功能',
      subCategory: typeDef ? typeDef.groupName : '扩展能力',
      versionName: data.versionName.trim() || `版本 ${versionTag}`,
      versionTag,
      content: data.content,
      charCount: data.content.length,
      outputFormat: data.outputFormat || (typeDef ? typeDef.defaultOutputFormat : '文本'),
      outputSchema: data.outputSchema || (typeDef ? typeDef.defaultSchema : '{}'),
      status: data.setAsActive || existing.length === 0 ? 'active' : 'history',
      updatedAt: dateStr,
    };

    this.templates = [newItem, ...this.templates];
    this.persist();
    return newItem;
  }

  // 应用某个版本为生效版本
  public activateVersion(templateId: string): boolean {
    const target = this.templates.find((t) => t.id === templateId);
    if (!target) return false;

    this.templates.forEach((t) => {
      if (t.typeId === target.typeId) {
        t.status = t.id === templateId ? 'active' : 'history';
      }
    });

    this.persist();
    return true;
  }

  // 删除某个版本
  public deleteTemplate(templateId: string): boolean {
    const target = this.templates.find((t) => t.id === templateId);
    if (!target) return false;

    const remainingOfType = this.templates.filter((t) => t.typeId === target.typeId && t.id !== templateId);
    
    // 如果删除的是 active 版本且还有其他版本，将最新一个置为 active
    if (target.status === 'active' && remainingOfType.length > 0) {
      remainingOfType[0].status = 'active';
    }

    this.templates = this.templates.filter((t) => t.id !== templateId);
    this.persist();
    return true;
  }
}

export const promptTemplateService = new PromptTemplateService();
