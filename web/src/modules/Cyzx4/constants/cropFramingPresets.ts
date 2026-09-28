export type CropFramingId = 'auto' | 'top' | 'short-bottom' | 'long-bottom' | 'mid-length' | 'full-length';

export interface CropFramingOption {
  id: CropFramingId;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  promptRule: string;
}

export const CROP_FRAMING_OPTIONS: CropFramingOption[] = [
  {
    id: 'auto',
    label: '自动识别（默认）',
    shortLabel: '自动',
    icon: '🤖',
    description: '根据上传的参考图自动分析并匹配最合适的裁图范围，无需手动选择。',
    promptRule: 'AUTO_DETECT',
  },
  {
    id: 'full-length',
    label: '长衣（长款外套/连衣裙）',
    shortLabel: '长衣',
    icon: '🧍',
    description: '画面裁切全身展示，从头顶到脚底完全可见。',
    promptRule: 'Camera framing: Full-length body framing showing head to feet completely visible (from top of head down to shoes/feet).',
  },
  {
    id: 'top',
    label: '上衣',
    shortLabel: '上衣',
    icon: '👕',
    description: '画面裁切从头部到大腿部分，大腿以下不可见。',
    promptRule: 'Camera framing: Upper body to thigh crop (framed from top of head down to mid-thigh level; legs below mid-thigh are not visible).',
  },
  {
    id: 'short-bottom',
    label: '短下装',
    shortLabel: '短下装',
    icon: '🩳',
    description: '画面裁切从腰部到小腿部分，头部及小腿以下不可见。',
    promptRule: 'Camera framing: Lower body short apparel crop (framed strictly from waist down to calf level; head and below-calf area are not visible).',
  },
  {
    id: 'long-bottom',
    label: '长下装',
    shortLabel: '长下装',
    icon: '👖',
    description: '画面裁切从腰部到脚踝部分，头部以上不可见。',
    promptRule: 'Camera framing: Lower body long apparel crop (framed strictly from waist down to ankle/feet level; head above neck/waist is not visible).',
  },
  {
    id: 'mid-length',
    label: '短长衣（中长款上衣/裙装）',
    shortLabel: '短长衣',
    icon: '👗',
    description: '画面裁切从头部到膝盖部分，膝盖以下不可见。',
    promptRule: 'Camera framing: Three-quarter length mid-long dress/top crop (framed from head down to knees level; below knees area is not visible).',
  },
];

export const cropFramingById = (id?: CropFramingId | null): CropFramingOption =>
  CROP_FRAMING_OPTIONS.find((item) => item.id === id) || CROP_FRAMING_OPTIONS[0];
