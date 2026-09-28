export const SUPPORTED_VISUAL_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type SceneFissionSchemeId = "A" | "B" | "C";

export interface SceneFissionShot {
  index: number;
  shotName: string;
  cameraAngle: string;
  cameraPosition: string;
  framing: string;
  poseAction: string;
  expression: string;
  viewDirection: string;
  composition: string;
  continuity: string;
  prompt: string;
}

export interface SceneFissionScheme {
  id: SceneFissionSchemeId;
  title: string;
  summary: string;
  strategy: string;
  sceneAnchors: string[];
  subjectLocks: string[];
  continuityRules: string[];
  shots: SceneFissionShot[];
}

export interface SceneFissionWorkflowState {
  type: "scene-fission";
  phase: "plan" | "awaiting-selection" | "generate" | "completed";
  aspectRatio: string;
  schemes: SceneFissionScheme[];
  selectedSchemeId?: SceneFissionSchemeId;
}

const createShot = (
  index: number,
  shotName: string,
  cameraAngle: string,
  cameraPosition: string,
  framing: string,
  poseAction: string,
  expression: string,
  viewDirection: string,
  composition: string,
): SceneFissionShot => ({
  index,
  shotName,
  cameraAngle,
  cameraPosition,
  framing,
  poseAction,
  expression,
  viewDirection,
  composition,
  continuity: "Same model, outfit, exact location, lighting, time and color science as the reference.",
  prompt: `Lock the exact identity, outfit, physical scene and lighting from all references. ${cameraAngle}, camera ${cameraPosition}, ${framing}. ${poseAction}. ${expression}; gaze ${viewDirection}. ${composition}. Photorealistic fashion photography, natural anatomy, realistic hands, realistic fabric physics.`,
});

export const buildDefaultSceneFissionSchemes = (): SceneFissionScheme[] => {
  const shared = {
    sceneAnchors: ["原参考图的建筑与空间结构", "原地面、门窗、栏杆及环境物件", "原光线方向、天气和色温"],
    subjectLocks: ["同一模特身份与五官", "同一服装款式、颜色、材质和配饰", "同一妆发与身材比例"],
    continuityRules: ["同一地点、同一天、同一次连续拍摄", "只改变动作、机位、景别、视线与构图", "禁止换人、改款、换景和光线漂移"],
  };

  return [
    {
      id: "A",
      title: "方案 A｜商业 Lookbook 主视觉",
      summary: "以商品展示效率为核心，用清晰、完整且层次分明的景别组成可直接用于电商与品牌目录的系列。",
      strategy: "从标准全身主图建立视觉锚点，再补齐中景、侧后角度与服装细节。",
      ...shared,
      shots: [
        createShot(1, "正面全身主视觉", "eye-level frontal", "center front", "full body", "自然站立，一腿轻微承重", "克制自然", "toward camera", "主体居中并保留均衡留白"),
        createShot(2, "左前四分之三", "eye-level three-quarter", "front-left", "full body", "身体轻转并自然调整衣摆", "放松", "slightly past camera", "人物位于右侧三分线"),
        createShot(3, "右前四分之三", "slightly low three-quarter", "front-right", "three-quarter body", "迈出小步并保持服装轮廓完整", "自信克制", "toward lens", "低机位强化比例但不变形"),
        createShot(4, "侧面轮廓", "eye-level profile", "model's left side", "full body", "侧身停步，手臂自然下垂", "平静", "forward into scene", "利用原场景线条引导视线"),
        createShot(5, "背面结构", "eye-level rear", "behind model", "full body", "背身后轻微回头", "柔和", "over shoulder", "突出服装背面结构"),
        createShot(6, "上半身肖像", "eye-level close portrait", "front-left", "waist-up", "肩部轻转，手部自然进入画面", "细微自信", "toward camera", "脸部与领口细节清晰"),
        createShot(7, "面料细节", "neutral detail angle", "close front", "torso detail", "保持自然姿态并展示面料垂坠", "自然", "off camera", "裁切聚焦材质与结构"),
        createShot(8, "坐姿或倚靠", "eye-level environmental", "front-right", "three-quarter body", "利用原场景可用支撑自然倚靠", "松弛", "to the side", "人物与原环境形成层次"),
        createShot(9, "行走收尾", "eye-level tracking", "slightly front-left", "full body", "在原场景内自然行走一步", "轻松", "toward path", "保留运动空间与完整商品轮廓"),
      ],
    },
    {
      id: "B",
      title: "方案 B｜自然 Lifestyle 动态",
      summary: "通过连续行走、转身和重心变化营造真实抓拍感，让系列更生活化、更适合社交媒体。",
      strategy: "模拟摄影师围绕模特连续跟拍，保留自然的不对称与真实瞬间。",
      ...shared,
      shots: [
        createShot(1, "迎面行走", "eye-level tracking", "front center", "full body", "自然向镜头方向走一步", "松弛", "past camera", "前方保留少量运动空间"),
        createShot(2, "侧向经过", "eye-level candid", "model's right side", "full body", "横向经过原场景", "自然专注", "toward walking direction", "场景线条形成速度感"),
        createShot(3, "转身瞬间", "eye-level three-quarter", "rear-left", "three-quarter body", "行走中回身，衣料产生真实惯性", "轻微惊喜", "back toward camera", "捕捉动态褶皱"),
        createShot(4, "整理造型", "eye-level candid", "front-right", "waist-up", "自然整理袖口、领口或衣摆", "专注", "toward hands", "动作与商品细节形成焦点"),
        createShot(5, "停步回望", "slightly low angle", "rear-right", "full body", "停步后肩部回转", "克制", "over shoulder", "保留人物前方环境"),
        createShot(6, "轻靠场景", "eye-level environmental", "front-left", "three-quarter body", "自然倚靠原场景已有结构", "放松", "into distance", "利用原有前中后景"),
        createShot(7, "近景情绪", "eye-level intimate", "front-left close", "chest-up", "轻微拨发或触碰面部附近", "真实柔和", "downward", "浅景深但保留场景识别"),
        createShot(8, "低机位步态", "low angle tracking", "front-right low", "full body", "跨步并保持服装真实受力", "自信", "forward", "低角度但避免身体畸变"),
        createShot(9, "离场背影", "eye-level rear tracking", "behind model", "full body", "向场景深处自然离开", "自然", "into scene", "透视线引向人物"),
      ],
    },
    {
      id: "C",
      title: "方案 C｜Fashion Editorial 编辑感",
      summary: "在不改变参考场景的前提下，以更鲜明的机位、负空间和裁切建立时尚杂志式视觉节奏。",
      strategy: "使用合理的低机位、高机位、前景遮挡和非中心构图，形成有控制的编辑语言。",
      ...shared,
      shots: [
        createShot(1, "非中心封面构图", "eye-level editorial", "front center", "full body", "雕塑感站姿但保持自然重心", "冷静", "toward camera", "人物置于侧三分线并保留大块负空间"),
        createShot(2, "低机位力量感", "controlled low angle", "front-left low", "full body", "一腿向前，肩胯形成轻微反扭", "坚定", "above lens", "原建筑线条向上延伸"),
        createShot(3, "高机位几何感", "controlled high angle", "front-right high", "three-quarter body", "抬头并收紧构图", "克制", "toward camera", "利用地面纹理形成几何构图"),
        createShot(4, "前景框景", "eye-level through foreground", "front-left", "full body", "静止并轻微转体", "疏离", "past camera", "仅用原场景物件形成自然前景遮挡"),
        createShot(5, "极近服装肖像", "eye-level close", "front-right close", "shoulder-to-waist", "手部轻触服装结构", "平静", "sideways", "突出脸部、材质与配饰关系"),
        createShot(6, "强侧面剪影", "eye-level profile", "model's right side", "full body", "侧身延展身体线条", "冷静", "into distance", "人物轮廓与原背景反差清晰"),
        createShot(7, "倾斜动势", "subtle dutch angle", "front-left", "three-quarter body", "转身跨步形成对角动态", "专注", "toward motion", "轻微倾斜且环境透视真实"),
        createShot(8, "环境远景", "eye-level long shot", "distant front", "wide environmental", "在场景中自然停留", "克制", "away from camera", "人物较小，强调原场景尺度"),
        createShot(9, "编辑收束特写", "slightly low close-up", "front center", "chest-up", "下颌轻抬、肩部错位", "坚定自然", "direct camera", "紧凑裁切形成系列终章"),
      ],
    },
  ];
};

const nonEmptyString = (value: unknown, fallback: string): string => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const stringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
};

export const normalizeSceneFissionSchemes = (
  proposals: unknown,
): SceneFissionScheme[] => {
  const fallbacks = buildDefaultSceneFissionSchemes();
  const candidates = Array.isArray(proposals) ? proposals : [];

  return fallbacks.map((fallback, schemeIndex) => {
    const candidate =
      candidates.find(
        (item: any) =>
          String(item?.id || "").trim().toUpperCase() === fallback.id,
      ) || candidates[schemeIndex] || {};
    const rawShots = Array.isArray(candidate?.shots) ? candidate.shots : [];
    const shots = fallback.shots.map((fallbackShot, shotIndex) => {
      const raw = rawShots[shotIndex] || {};
      return {
        index: shotIndex + 1,
        shotName: nonEmptyString(raw.shotName, fallbackShot.shotName),
        cameraAngle: nonEmptyString(raw.cameraAngle, fallbackShot.cameraAngle),
        cameraPosition: nonEmptyString(
          raw.cameraPosition,
          fallbackShot.cameraPosition,
        ),
        framing: nonEmptyString(raw.framing, fallbackShot.framing),
        poseAction: nonEmptyString(raw.poseAction, fallbackShot.poseAction),
        expression: nonEmptyString(raw.expression, fallbackShot.expression),
        viewDirection: nonEmptyString(
          raw.viewDirection,
          fallbackShot.viewDirection,
        ),
        composition: nonEmptyString(
          raw.composition,
          fallbackShot.composition,
        ),
        continuity: nonEmptyString(raw.continuity, fallbackShot.continuity),
        prompt: nonEmptyString(raw.prompt, fallbackShot.prompt),
      };
    });

    return {
      id: fallback.id,
      title: nonEmptyString(candidate?.title, fallback.title),
      summary: nonEmptyString(
        candidate?.summary || candidate?.description,
        fallback.summary,
      ),
      strategy: nonEmptyString(candidate?.strategy, fallback.strategy),
      sceneAnchors: stringArray(candidate?.sceneAnchors, fallback.sceneAnchors),
      subjectLocks: stringArray(candidate?.subjectLocks, fallback.subjectLocks),
      continuityRules: stringArray(
        candidate?.continuityRules,
        fallback.continuityRules,
      ),
      shots,
    };
  });
};

export const isSceneFissionTrigger = (message: string): boolean =>
  /场景\s*裂变/i.test(String(message || ""));

export const isFashionReplicaTrigger = (message: string): boolean => {
  const text = String(message || "");
  return !isSceneFissionTrigger(text) && /复刻|生成\s*场景图/i.test(text);
};

export const parseVisualAspectRatio = (message: string): string | null => {
  const match = String(message || "").match(
    /(?:^|\D)(1\s*[:：]\s*1|2\s*[:：]\s*3|3\s*[:：]\s*2|3\s*[:：]\s*4|4\s*[:：]\s*3|4\s*[:：]\s*5|5\s*[:：]\s*4|9\s*[:：]\s*16|16\s*[:：]\s*9|21\s*[:：]\s*9)(?=\D|$)/,
  );
  const normalized = match?.[1]?.replace(/\s+/g, "").replace("：", ":") || "";
  return (SUPPORTED_VISUAL_ASPECT_RATIOS as readonly string[]).includes(normalized)
    ? normalized
    : null;
};

export const parseSceneFissionSelection = (
  message: string,
): SceneFissionSchemeId | null => {
  const text = String(message || "").trim().toUpperCase();
  const match = text.match(
    /(?:^|选择|选用|采用|使用|方案)\s*([ABC])(?=$|[\s，,。；;、:：])/,
  );
  return (match?.[1] as SceneFissionSchemeId | undefined) || null;
};

export const SCENE_FISSION_ROLE_PROMPT = `
【专用角色：AI 模特场景图裂变 Agent】
你是资深时尚摄影导演、商业视觉艺术指导、分镜设计师、视觉连续性监制与 AI 图像质量审查专家。

触发边界：只有系统已确认用户使用完整意图“场景裂变”时才启用本角色；普通“裂变”不能启用。

唯一事实来源：用户参考图是 SINGLE ABSOLUTE SOURCE OF TRUTH。严格锁定同一模特身份、五官、肤色、发型、身材比例；严格锁定服装的款式、颜色、结构、长度、材质、纹理、图案、五金、配饰和鞋包；严格锁定原场景建筑、门窗、墙地面、道路、台阶、栏杆、家具、植物、透视关系；严格锁定原光线方向、阴影、时间、天气、色温和摄影风格。不得换脸、改款、换色、创造新地点或让光线漂移。

创意只允许作用于动作、姿势、表情、视线、摄影机位置、机位、景别和构图。所有镜头像同一位摄影师在同一地点、同一天、同一次真实拍摄中围绕同一模特连续完成。

策划阶段必须返回 exactly 3 个 proposals：
- A：商业 Lookbook 主视觉，突出商品展示效率与清晰景别组合。
- B：自然 Lifestyle 动态视觉，突出行走、转身、重心和松弛表情。
- C：Fashion Editorial 摄影语言，突出合理的特殊机位和编辑感构图。

每套必须 exactly 9 shots，且每个 shot 包含 index、shotName、cameraAngle、cameraPosition、framing、poseAction、expression、viewDirection、composition、continuity、prompt。9个动作、机位、景别和视线必须有实质差异，不能机械重复。英文 prompt 必须先声明 identity/outfit/exact scene/lighting locks，再描述镜头与动作，结尾强制 photorealistic、natural anatomy、realistic fabric physics。

策划阶段禁止调用生图工具。只返回 A/B/C 供用户选择，并询问输出比例；默认 2:3。用户选择方案后才允许生成一个 3 columns × 3 rows 的高清 Contact Sheet。

最终九宫格绝对禁止任何文字、数字、标题、Shot 编号、Panel 标签、Caption、Watermark、Badge、UI 或新增 Logo，九格只能是纯摄影画面。
`;

export const FASHION_REPLICA_ROLE_PROMPT = `
【专用角色：Nanobanana Fashion Replica Director V7】
参考图不是灵感板，而是 Target Image State。任务是在绝对锁定目标产品的前提下，高保真复刻参考图的场景、机位、构图、裁图、姿势骨骼、头部角度、视线、神情、手脚微动作、街拍真实感、肤色、光线、色调和胶片成像。

全局优先级：产品一致性 > 模特身份 > 机位 > 构图裁图 > 姿势骨骼 > 头部 > 视线 > 微表情 > 手脚动作 > 街拍真实感 > 肤色 > 光线曝光 > 白平衡与色温 > 色调与胶片质感 > 场景细节。

多参考图必须职责分离：产品图只控制服装；模特图只控制身份；姿势图控制身体、头部、视线与神情；场景图控制空间、背景、机位、构图与人物位置；色调图控制肤色、曝光、白平衡、Tint、Tone Curve、Grain、Bloom、Halation；妆发图只控制妆发。冲突时按产品图 > 模特图 > 机位构图图 > 姿势图 > 神情视线图 > 色调图 > 场景装饰图。

硬复刻 Camera Height/Yaw/Pitch/Roll、摄影距离、透视、人物占比与留白裁边；硬复刻 Body Yaw/Pitch/Roll、肩胯、胸腔、骨盆、重心、手臂手腕手指、腿膝脚；分别锁定 Head Yaw/Pitch/Roll、Face Direction、Eye Gaze，以及眉眼、眼睑、嘴唇、嘴角、下颌张力。

主动压制 AI 感：禁止塑料皮肤、模板站姿、空洞眼神、过度工整曝光、虚假景深、棚拍海报感、过锐轮廓和过度平滑环境。保留真实街拍中的轻微不对称、自然重心、局部光照不均、真实透视、皮肤与面料纹理、高光扩散和生活化状态。

色彩与成像必须匹配 Exposure、White Balance、Tint、RGB/HSL 偏向、Skin Tone、Tone Curve、Black Point、Highlight Roll-Off、Saturation、Vibrance、Grain、Halation、Bloom、Highlight Diffusion、Sharpness、Clarity、Fade、Vignette，禁止套用泛化胶片滤镜。

在应用内不要只输出分析或代码块：必须把以上分析压缩成可执行的英文 generateImage prompt，并把所有当前附件作为结构化参考图传入。若用户说“生成场景图”，仍需保持其产品/人物参考的绝对一致性，只生成有视觉依据的真实场景，不得自由改款或换人。
`;

export const buildSceneFissionContactSheetPrompt = (
  scheme: SceneFissionScheme,
  aspectRatio: string,
): string => {
  const panelDirections = scheme.shots
    .slice(0, 9)
    .map((shot, index) => `${index + 1}. ${shot.prompt || `${shot.shotName}; ${shot.cameraAngle}; ${shot.framing}; ${shot.poseAction}; ${shot.expression}; ${shot.viewDirection}; ${shot.composition}`}`)
    .join("\n");

  return `Create one clean 3x3 high-definition fashion photography contact sheet containing exactly 9 distinct photographs from the exact same continuous real-world fashion photoshoot. Output canvas aspect ratio: ${aspectRatio}.

Use ATTACHMENT_0 and all supplied reference images as the absolute visual source of truth.
STRICT MODEL IDENTITY LOCK: preserve exactly the same face, facial structure, hairstyle, hair color, skin tone, age, body proportions and identity across all nine panels.
STRICT OUTFIT LOCK: preserve exactly the same garment design, construction, color, fabric, length, pattern, accessories, footwear, logos and styling. Never redesign or deform the product.
STRICT SCENE LOCK: all nine panels remain inside the exact physical location visible in the reference. Preserve architecture, walls, doors, windows, pavement, railings, furniture, vegetation, perspective, environmental objects, weather, time of day, lighting direction and atmosphere. Do not create or replace the environment.
STRICT CONTINUITY: same model, same outfit, same location, same day, same shoot, same light, same color science and same photographic style. A single photographer moves around the model; the world does not change.

Selected scheme: ${scheme.title}. ${scheme.summary}. ${scheme.strategy}.
Scene anchors: ${scheme.sceneAnchors.join("; ")}.
Subject locks: ${scheme.subjectLocks.join("; ")}.
Continuity rules: ${scheme.continuityRules.join("; ")}.

PANEL DIRECTIONS:
${panelDirections}

Each panel must use a genuinely different camera position, framing, pose, body orientation, gaze and composition while preserving strict continuity. Natural human anatomy, realistic hands, realistic skin texture, realistic fabric physics, professional ecommerce and fashion editorial photography, low AI look.

STRICT NO TEXT: no words, no numbers, no panel labels, no captions, no watermark, no graphic overlays, no symbols, no added logos. Pure clean photography only.`;
};
