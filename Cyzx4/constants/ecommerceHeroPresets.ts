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
    description: '奶油色抹灰、拱形门洞，天然微风与柔润暖光 (适配：白色长裙、亚麻裙、碎花裙、度假风连衣裙、泳装罩衫)',
    palette: ['#e8d3be', '#c2a68c', '#8c7662'],
    prompt: 'Mediterranean coastal luxury resort courtyard, North African Moroccan architecture style, warm ivory stone walls, hand-carved archways, rustic stucco texture, olive trees and tropical plants, sunlight casting soft shadows, beige sandstone floor, vintage ceramic pots, relaxed luxury vacation atmosphere, Amalfi Coast and Marrakech fusion style, editorial fashion photography, natural sunlight, high-end resort magazine style',
  },
  {
    id: 'coastal-terrace',
    name: '滨海露台度假场景',
    description: '蔚蓝海岸、海风日光、无边海景与白石栏杆，清爽惬意 (适配：蓝色裙装、白色裙装、泳装、沙滩罩衫)',
    palette: ['#a3d5e8', '#f7f4ed', '#d9a779'],
    prompt: 'Luxury seaside terrace overlooking Mediterranean ocean, white stone balcony, linen curtains moving in sea breeze, rattan furniture, coastal plants, infinity sea view, bright blue sky, elegant resort architecture, summer vacation mood, clean natural light, luxury fashion editorial photography',
  },
  {
    id: 'urban-stone-business',
    name: '都市商务石材街区',
    description: '摩登建筑石材、干练明快日光、大理石铺装街道与城市商务气息 (适配：衬衫、套装、半裙、简约通勤风)',
    palette: ['#8c929a', '#d0d4dc', '#2a313a'],
    prompt: 'Modern European business district street, luxury stone buildings, limestone facade, glass windows, clean sidewalk, urban architecture, minimal luxury atmosphere, fashionable woman walking, Paris Milan business street style, natural daylight, fashion street photography',
  },
  {
    id: 'desert-american-highway',
    name: '荒漠美式郊外公路场景',
    description: '开放公路、加州荒野、美式西海岸复古自由与金黄日落 (适配：牛仔、波西米亚、度假休闲)',
    palette: ['#d89c59', '#e8cfa6', '#4a6b82'],
    prompt: 'American desert countryside highway, vintage road trip scenery, dry desert landscape, beige mountains in background, old gas station, dusty road, western ranch atmosphere, warm sunset sunlight, cinematic fashion photography, California desert style',
  },
  {
    id: 'minimalist-pure',
    name: '极简',
    description: '纯粹建筑几何、纯白墙面大面积留白、柔和自然漫射光 (适配：白裙、黑裙、高级基础款)',
    palette: ['#f4f4f4', '#dedede', '#a0a0a0'],
    prompt: 'Minimalist modern architecture, pure white concrete wall, clean geometric lines, soft natural shadows, neutral beige tones, empty space, contemporary luxury house, minimal fashion editorial photography',
  },
  {
    id: 'south-france-old-town',
    name: '南法欧洲老城复古民居街巷',
    description: '斑驳黄墙、鹅卵石小巷、木质百叶窗、阳台鲜花与古朴阳光 (适配：碎花裙、法式裙、轻熟风)',
    palette: ['#dcb588', '#9e7b57', '#637059'],
    prompt: 'South of France old town street, historic stone houses, pastel colored walls, wooden shutters, narrow cobblestone alley, flower balconies, Mediterranean village atmosphere, Provence style, romantic European summer, fashion editorial photography',
  },
  {
    id: 'european-classic-manor',
    name: '欧式古典轻奢建筑度假庄园酒店',
    description: '雕花连廊、大理石柱、宫殿式喷泉花园、典雅贵气氛围 (适配：晚礼服、长裙、高级女装)',
    palette: ['#3b4e3e', '#d2be92', '#faf6ee'],
    prompt: 'European luxury resort mansion, classical architecture, marble columns, grand staircase, historic villa hotel, elegant garden, fountain, cream stone facade, aristocratic vacation atmosphere, luxury fashion campaign photography',
  },
  {
    id: 'american-suburban-street',
    name: '全新美式城郊休闲街道类',
    description: '绿荫小镇、独栋住宅草坪、阳光斑驳、亲和生活气息 (适配：T恤、牛仔、休闲裙)',
    palette: ['#5c7a56', '#e0c8aa', '#8bb4d4'],
    prompt: 'Modern American suburban neighborhood street, clean sidewalks, stylish houses, green lawns, trees, quiet residential area, California lifestyle, casual fashion photography, bright sunny day',
  },
  {
    id: 'indoor-luxury-vintage-wood',
    name: '室内轻奢木质复古场景',
    description: '沉稳胡桃木家具、木质墙板、暖温光感、优雅怀旧套房氛围 (适配：针织、衬衫、秋冬裙装)',
    palette: ['#593e2b', '#c49a6c', '#2c1e14'],
    prompt: 'Luxury vintage interior, warm wooden furniture, walnut panels, classic hotel room, beige sofa, antique decorations, soft window light, elegant European apartment, quiet sophisticated atmosphere, fashion editorial photography',
  },
];

export const ECOMMERCE_STYLE_PRESETS: EcommerceStylePreset[] = SCENE_REALISTIC_STYLE_PRESETS;

export const languageById = (id: EcommerceLanguageId) => ECOMMERCE_LANGUAGES.find((item) => item.id === id) || ECOMMERCE_LANGUAGES[1];
export const platformById = (id: EcommercePlatformId) => ECOMMERCE_PLATFORMS.find((item) => item.id === id) || ECOMMERCE_PLATFORMS[0];
export const stylePresetById = (id?: string | null) => ECOMMERCE_STYLE_PRESETS.find((item) => item.id === id) || null;

