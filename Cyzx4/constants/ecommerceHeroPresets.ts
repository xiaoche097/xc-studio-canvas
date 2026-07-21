import { AspectRatio } from '../types';
import type { EcommerceLanguageId, EcommercePlatformId } from '../types/ecommerceHero.types';

export interface EcommerceLanguageOption {
  id: EcommerceLanguageId;
  label: string;
  mark: string;
  promptName: string;
  direction: 'ltr' | 'rtl';
  fontStack: string;
}

export interface EcommercePlatformOption {
  id: EcommercePlatformId;
  label: string;
  mark: string;
  accent: string;
  description: string;
  prompt: string;
}

export interface EcommerceStylePreset {
  id: string;
  name: string;
  description: string;
  palette: [string, string, string];
  prompt: string;
}

export const ECOMMERCE_LANGUAGES: EcommerceLanguageOption[] = [
  { id: 'none', label: '无文字（纯视觉）', mark: '—', promptName: 'no added marketing text', direction: 'ltr', fontStack: 'Arial, sans-serif' },
  { id: 'zh-CN', label: '简体中文', mark: '简', promptName: 'Simplified Chinese', direction: 'ltr', fontStack: '"Noto Sans SC", "Microsoft YaHei", sans-serif' },
  { id: 'zh-TW', label: '繁体中文', mark: '繁', promptName: 'Traditional Chinese', direction: 'ltr', fontStack: '"Noto Sans TC", "Microsoft JhengHei", sans-serif' },
  { id: 'en', label: '英语', mark: 'EN', promptName: 'English', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'ja', label: '日语', mark: 'あ', promptName: 'Japanese', direction: 'ltr', fontStack: '"Noto Sans JP", "Yu Gothic", sans-serif' },
  { id: 'ko', label: '韩语', mark: '한', promptName: 'Korean', direction: 'ltr', fontStack: '"Noto Sans KR", "Malgun Gothic", sans-serif' },
  { id: 'de', label: '德语', mark: 'DE', promptName: 'German', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'fr', label: '法语', mark: 'FR', promptName: 'French', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'ar', label: '阿拉伯语', mark: 'ع', promptName: 'Arabic', direction: 'rtl', fontStack: '"Noto Sans Arabic", Tahoma, sans-serif' },
  { id: 'ru', label: '俄语', mark: 'RU', promptName: 'Russian', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'th', label: '泰语', mark: 'ก', promptName: 'Thai', direction: 'ltr', fontStack: '"Noto Sans Thai", Tahoma, sans-serif' },
  { id: 'id', label: '印尼语', mark: 'ID', promptName: 'Indonesian', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'vi', label: '越南语', mark: 'VI', promptName: 'Vietnamese', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'ro', label: '罗马尼亚语', mark: 'RO', promptName: 'Romanian', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'es', label: '西班牙语', mark: 'ES', promptName: 'Spanish', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'ms', label: '马来西亚语', mark: 'MS', promptName: 'Malay', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'it', label: '意大利语', mark: 'IT', promptName: 'Italian', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'he', label: '希伯来语', mark: 'HE', promptName: 'Hebrew', direction: 'rtl', fontStack: '"Noto Sans Hebrew", Arial, sans-serif' },
  { id: 'pt', label: '葡萄牙语', mark: 'PT', promptName: 'Portuguese', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'fil', label: '菲律宾语', mark: 'FIL', promptName: 'Filipino', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'hi', label: '印地语', mark: 'हि', promptName: 'Hindi', direction: 'ltr', fontStack: '"Noto Sans Devanagari", Mangal, sans-serif' },
  { id: 'pl', label: '波兰语', mark: 'PL', promptName: 'Polish', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'tr', label: '土耳其语', mark: 'TR', promptName: 'Turkish', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
  { id: 'nl', label: '荷兰语', mark: 'NL', promptName: 'Dutch', direction: 'ltr', fontStack: '"Noto Sans", Arial, sans-serif' },
];

export const ECOMMERCE_PLATFORMS: EcommercePlatformOption[] = [
  { id: 'smart', label: '智能匹配', mark: 'AI', accent: '#17243c', description: '按品类与语言推荐', prompt: 'Infer the best matching marketplace visual system from product category, target language and user requirements.' },
  { id: 'taobao', label: '淘宝', mark: '淘', accent: '#ff5a1f', description: '丰富卖点与氛围', prompt: 'Taobao high-conversion product hero visual: lively but organized composition, strong product focus, polished lifestyle cues and readable selling-point hierarchy.' },
  { id: '1688', label: '1688', mark: '1688', accent: '#ff6a00', description: '供应链与规格清晰', prompt: '1688 wholesale ecommerce visual: product construction, variants, material and specification clarity, credible supplier-grade photography, efficient information hierarchy.' },
  { id: 'tmall', label: '天猫', mark: '天猫', accent: '#e40012', description: '品牌感与高级质感', prompt: 'Tmall premium brand hero visual: refined studio art direction, restrained luxury, rich material texture, confident spacing and strong brand polish.' },
  { id: 'pinduoduo', label: '拼多多', mark: '拼', accent: '#e02e24', description: '高识别与强转化', prompt: 'Pinduoduo conversion-first ecommerce visual: immediate product recognition, energetic colors, bold benefit hierarchy, clean mobile readability without visual clutter.' },
  { id: 'jd', label: '京东', mark: 'JD', accent: '#e1251b', description: '可靠、清晰、专业', prompt: 'JD clean quality-led commerce visual: crisp product detail, trustworthy lighting, technical clarity, modern red-accent visual rhythm and generous clean space.' },
  { id: 'douyin', label: '抖音', mark: '抖', accent: '#111111', description: '短视频封面张力', prompt: 'Douyin social-commerce hero visual: scroll-stopping mobile composition, contemporary lifestyle energy, bold focal product, dynamic depth and concise copy zone.' },
  { id: 'amazon-aplus', label: 'Amazon A+', mark: 'a+', accent: '#ff9900', description: '结构化利益点', prompt: 'Amazon A+ visual module: premium product storytelling, clear benefit hierarchy, realistic scale, clean composition, restrained props and conversion-focused product fidelity.' },
  { id: 'temu', label: 'TEMU', mark: 'TEMU', accent: '#ff6b00', description: '鲜明、直接、移动优先', prompt: 'TEMU mobile-first product visual: vivid but controlled palette, sharp product separation, fast benefit comprehension, high contrast and clean commercial finish.' },
  { id: 'emag', label: 'eMAG', mark: 'eMAG', accent: '#e31c79', description: '欧洲目录式专业感', prompt: 'eMAG European marketplace visual: clean catalog credibility, balanced white space, accurate product rendering, practical benefit communication and polished retail finish.' },
  { id: 'ebay', label: 'eBay', mark: 'eBay', accent: '#3665f3', description: '真实、可信、易比较', prompt: 'eBay trustworthy listing hero visual: authentic product photography, clear condition and feature readability, neutral commercial context and uncluttered composition.' },
  { id: 'shein', label: 'SHEIN', mark: 'S', accent: '#111111', description: '时尚与趋势感', prompt: 'SHEIN fashion marketplace visual: trend-aware editorial energy, flattering styling, youthful composition, crisp garment or accessory visibility and polished mobile presentation.' },
  { id: 'shopee', label: 'Shopee', mark: 'S', accent: '#ee4d2d', description: '热带市场活力', prompt: 'Shopee mobile marketplace visual: warm energetic palette, approachable lifestyle styling, fast product recognition, concise benefits and localized Southeast Asian commerce polish.' },
  { id: 'lazada', label: 'Lazada', mark: 'L', accent: '#5f2eea', description: '品牌化移动电商', prompt: 'Lazada branded mobile-commerce visual: vibrant gradient-aware palette, aspirational lifestyle context, strong product center and clean promotional hierarchy.' },
  { id: 'tiktok', label: 'TikTok', mark: 'TT', accent: '#00a6a6', description: '社媒原生与抓眼', prompt: 'TikTok Shop native social-commerce visual: authentic creator-style energy, dramatic first-glance focus, vertical-friendly composition and concise high-impact benefit zone.' },
  { id: 'ozon', label: 'Ozon', mark: 'OZON', accent: '#005bff', description: '清晰高效的俄语电商', prompt: 'Ozon marketplace visual: clean blue-accent retail polish, strong product isolation, structured benefit communication, mobile readability and trustworthy catalog quality.' },
];

export const ECOMMERCE_RATIOS = [
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4 竖版' },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3 竖版' },
  { id: AspectRatio.LANDSCAPE_4_3, label: '4:3 横版' },
  { id: AspectRatio.SQUARE, label: '1:1 方版' },
  { id: AspectRatio.PORTRAIT_4_5, label: '4:5 竖版' },
  { id: AspectRatio.LANDSCAPE_5_4, label: '5:4 横版' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16 竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9 横版' },
  { id: AspectRatio.LANDSCAPE_21_9, label: '21:9 超宽' },
];

export const SCENE_REALISTIC_STYLE_PRESETS: EcommerceStylePreset[] = [
  {
    id: 'mediterranean-wabi-sabi',
    name: '北非地中海奶油拱洞侘寂庭院',
    description: '奶油色抹灰、天然微风与柔润暖光、自然温润沉静',
    palette: ['#e8d3be', '#c2a68c', '#8c7662'],
    prompt: 'North African Mediterranean wabi-sabi patio, cream plaster archways, soft warm sunlight filtering through palm fronds, organic textured terracotta and beige surfaces, tranquil realistic luxury resort atmosphere, natural shadows, authentic photography',
  },
  {
    id: 'coastal-terrace',
    name: '滨海露台度假场景',
    description: '蔚蓝海岸、海风日光、清爽惬意',
    palette: ['#a3d5e8', '#f7f4ed', '#d9a779'],
    prompt: 'coastal oceanfront terrace, natural bright Mediterranean daylight, sunlit marble balustrade, distant turquoise sea, light coastal breeze, airy relaxed holiday feel, photorealistic outdoor photography',
  },
  {
    id: 'urban-stone-business',
    name: '都市商务石砌街区',
    description: '摩登建筑石材、干练明快日光、城市商务气息',
    palette: ['#8c929a', '#d0d4dc', '#2a313a'],
    prompt: 'modern urban business district, sleek stone masonry architecture, clean geometric lines, bright natural daylight with sharp crisp shadows, high-end metropolitan atmosphere, authentic street photography',
  },
  {
    id: 'desert-american-highway',
    name: '荒漠美式郊外公路场景',
    description: '开放公路、金黄日光、美式西海岸复古自由',
    palette: ['#d89c59', '#e8cfa6', '#4a6b82'],
    prompt: 'American West desert highway, vast open landscape under golden hour sun, warm sand dunes and asphalt road, authentic dusty sunlight, cinematic wild freedom feel, photorealistic outdoor photography',
  },
  {
    id: 'minimalist-pure',
    name: '极简',
    description: '纯粹建筑几何、自然漫射光、突出主体质感',
    palette: ['#f4f4f4', '#dedede', '#a0a0a0'],
    prompt: 'pure minimalist architectural studio space, seamless clean background, ultra soft diffused daylight, elegant negative space, subtle cast shadows, pristine realistic product presentation',
  },
  {
    id: 'south-france-old-town',
    name: '南法欧洲老城复古民居街巷',
    description: '斑驳黄墙、鹅卵石小巷、古朴阳光与诗意',
    palette: ['#dcb588', '#9e7b57', '#637059'],
    prompt: 'South of France historic old town street, cobblestone alleyway, sun-dappled vintage stone facades with shutters, warm afternoon light, romantic European heritage charm, authentic travel photography',
  },
  {
    id: 'european-classic-manor',
    name: '欧式古典轻奢建筑度假庄园酒店',
    description: '雕花连廊、绿植庭园、典雅贵气氛围',
    palette: ['#3b4e3e', '#d2be92', '#faf6ee'],
    prompt: 'European classical luxury manor estate hotel garden, manicured hedge lawns, intricate carved stone balustrades, soft warm sunbeams, elegant opulent atmosphere, photorealistic editorial photography',
  },
  {
    id: 'american-suburban-street',
    name: '全新美式城郊休闲街道类',
    description: '绿荫小镇、阳光斑驳、亲和生活气息',
    palette: ['#5c7a56', '#e0c8aa', '#8bb4d4'],
    prompt: 'pleasant American suburban residential street, lush green trees, bright dappled sunlight on paved walkway, neat wooden fences and lawns, inviting friendly everyday lifestyle backdrop',
  },
  {
    id: 'indoor-luxury-vintage-wood',
    name: '室内轻奢木质复古场景',
    description: '沉稳胡桃木、暖温光感、优雅怀旧质感',
    palette: ['#593e2b', '#c49a6c', '#2c1e14'],
    prompt: 'luxurious vintage wooden interior, rich dark walnut wood panels, soft warm golden amber indoor lighting, cozy sophisticated library or lounge feel, deep rich textures, photorealistic interior photography',
  },
];

export const ECOMMERCE_STYLE_PRESETS: EcommerceStylePreset[] = SCENE_REALISTIC_STYLE_PRESETS;

export const languageById = (id: EcommerceLanguageId) => ECOMMERCE_LANGUAGES.find((item) => item.id === id) || ECOMMERCE_LANGUAGES[1];
export const platformById = (id: EcommercePlatformId) => ECOMMERCE_PLATFORMS.find((item) => item.id === id) || ECOMMERCE_PLATFORMS[0];
export const stylePresetById = (id?: string | null) => ECOMMERCE_STYLE_PRESETS.find((item) => item.id === id) || null;

