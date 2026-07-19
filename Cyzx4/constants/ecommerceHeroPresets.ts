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
  { id: AspectRatio.LANDSCAPE_4_3, label: '4:3 横版' },
  { id: AspectRatio.SQUARE, label: '1:1 方版' },
  { id: AspectRatio.PORTRAIT_4_5, label: '4:5 竖版' },
  { id: AspectRatio.LANDSCAPE_5_4, label: '5:4 横版' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16 竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9 横版' },
  { id: AspectRatio.LANDSCAPE_21_9, label: '21:9 超宽' },
];

export const ECOMMERCE_STYLE_PRESETS: EcommerceStylePreset[] = [
  { id: 'clean-studio', name: '清透影棚', description: '干净背景、柔和投影、突出结构', palette: ['#f7f3ec', '#d8e6ee', '#ee7b4d'], prompt: 'airy premium studio photography, clean tonal background, soft sculpted shadow, precise material texture, restrained props' },
  { id: 'warm-home', name: '暖居生活', description: '奶油家居、自然光、亲和转化', palette: ['#eadbc8', '#c7a27c', '#fff8ee'], prompt: 'warm cream lifestyle interior, natural window light, tasteful domestic styling, believable scale, inviting premium atmosphere' },
  { id: 'bold-color', name: '高饱和撞色', description: '强识别色块、移动端抓眼', palette: ['#ff5b35', '#ffc83d', '#1c3fff'], prompt: 'bold controlled color blocking, high contrast commercial lighting, immediate product separation, energetic mobile-first composition' },
  { id: 'quiet-luxury', name: '静奢质感', description: '低饱和材质、克制高级', palette: ['#b9ad9d', '#2e3133', '#eee8df'], prompt: 'quiet luxury product photography, tactile stone and fabric surfaces, controlled highlights, editorial restraint, generous negative space' },
  { id: 'fresh-outdoor', name: '清新户外', description: '自然环境、轻快光线、真实使用感', palette: ['#b7d6c2', '#e7d4a8', '#f8faf5'], prompt: 'fresh realistic outdoor lifestyle photography, soft daylight, credible product interaction, clean natural depth, optimistic color balance' },
  { id: 'tech-precision', name: '科技精密', description: '冷调光线、硬朗结构、参数感', palette: ['#0d1b2a', '#37b7ff', '#dce8f1'], prompt: 'precision technology product hero, cool controlled light, exact edge definition, subtle technical atmosphere, premium engineered materials' },
];

export const languageById = (id: EcommerceLanguageId) => ECOMMERCE_LANGUAGES.find((item) => item.id === id) || ECOMMERCE_LANGUAGES[1];
export const platformById = (id: EcommercePlatformId) => ECOMMERCE_PLATFORMS.find((item) => item.id === id) || ECOMMERCE_PLATFORMS[0];
export const stylePresetById = (id?: string | null) => ECOMMERCE_STYLE_PRESETS.find((item) => item.id === id) || null;
