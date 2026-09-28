import { CLOTHING_POSES } from '../constants/clothingPresets';
import { WOMENS_FASHION_POSES } from '../constants/womensFashionPosePresets';
import { MENS_SHIRT_POSES } from '../constants/mensShirtPosePresets';
import { MENS_KNIT_POSES } from '../constants/mensKnitPosePresets';
import { MENS_TEE_POSES } from '../constants/mensTeePosePresets';
import { MENS_SHORTS_POSES } from '../constants/mensShortsPosePresets';
import { MENS_PANTS_POSES } from '../constants/mensPantsPosePresets';
import { SWIM_SHORTS_POSES } from '../constants/swimShortsPosePresets';
import { LONG_DRESS_POSES } from '../constants/longDressPosePresets';
import { SLEEPWEAR_POSES } from '../constants/sleepwearPresets';
import { Y2K_POSES } from '../constants/y2kPosePresets';

interface PosePreset {
  id: string;
  name: string;
  prompt: string;
}

interface PoseLibrary {
  key: string;
  label: string;
  poses: PosePreset[];
}

export interface PoseAgentSelection {
  libraryKey: string;
  libraryLabel: string;
  poseId: string;
  poseName: string;
  posePrompt: string;
  directive: string;
}

const LIBRARIES: PoseLibrary[] = [
  { key: 'clothing', label: '通用服装动作库', poses: CLOTHING_POSES },
  { key: 'womensFashion', label: '通用时尚女装动作库', poses: WOMENS_FASHION_POSES },
  { key: 'mensShirt', label: '男士衬衫动作库', poses: MENS_SHIRT_POSES },
  { key: 'mensKnit', label: '男士针织/Polo动作库', poses: MENS_KNIT_POSES },
  { key: 'mensTee', label: '男士T恤动作库', poses: MENS_TEE_POSES },
  { key: 'mensShorts', label: '男士短裤动作库', poses: MENS_SHORTS_POSES },
  { key: 'mensPants', label: '男士长裤动作库', poses: MENS_PANTS_POSES },
  { key: 'swimShorts', label: '泳裤/沙滩裤动作库', poses: SWIM_SHORTS_POSES },
  { key: 'longDress', label: '长裙/连衣裙动作库', poses: LONG_DRESS_POSES },
  { key: 'sleepwear', label: '睡衣/家居服动作库', poses: SLEEPWEAR_POSES },
  { key: 'y2k', label: 'Y2K Editorial 动作库', poses: Y2K_POSES },
];

const LIBRARY_RULES: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /泳裤|泳装|沙滩裤|海滩短裤|swim|beach shorts/i, key: 'swimShorts' },
  { pattern: /睡衣|家居服|居家|睡袍|sleepwear|pajama/i, key: 'sleepwear' },
  { pattern: /长裙|连衣裙|礼服|裙摆|大摆裙|maxi|long dress|gown/i, key: 'longDress' },
  { pattern: /男.*衬衫|衬衫.*男|男模.*衬衫|mens? shirt/i, key: 'mensShirt' },
  { pattern: /男.*针织|男.*polo|polo衫|mens? knit/i, key: 'mensKnit' },
  { pattern: /男.*t恤|男.*tee|男.*短袖|mens? tee/i, key: 'mensTee' },
  { pattern: /男.*短裤|短裤.*男|mens? shorts/i, key: 'mensShorts' },
  { pattern: /男.*长裤|西裤|工装裤|牛仔裤.*男|mens? pants/i, key: 'mensPants' },
  { pattern: /y2k|千禧|辣妹|复古街头/i, key: 'y2k' },
  { pattern: /女装|女模|女士|裙|披肩|斗篷|上衣|外套|开衫|时尚/i, key: 'womensFashion' },
];

const ACTION_RULES: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /走|迈步|行走|漫步|步伐|walking|stride/i, terms: ['走', '步', 'walking', 'stride'] },
  { pattern: /回头|回眸|背影|背面|over shoulder/i, terms: ['回头', '回眸', '背面', 'looking back', 'over shoulder'] },
  { pattern: /坐|坐姿|座椅|沙发|楼梯|seated|sitting/i, terms: ['坐', '座', 'sitting', 'seated'] },
  { pattern: /靠|倚|墙|栏杆|门框|lean/i, terms: ['靠', '倚', '墙', '栏杆', '门框', 'lean'] },
  { pattern: /插兜|插袋|口袋|pocket/i, terms: ['插', '口袋', 'pocket'] },
  { pattern: /袖|披肩|斗篷|展开|张开|抬臂|抬手|手臂|sleeve|cape|arm/i, terms: ['袖', '抬手', '抬臂', '张', '展开', 'sleeve', 'arm', 'drape'] },
  { pattern: /领口|衣领|门襟|项链|neckline|collar/i, terms: ['领', '门襟', '项链', 'collar', 'neckline'] },
  { pattern: /衣摆|裙摆|面料|飘逸|转身|旋转|hem|fabric|turn/i, terms: ['衣摆', '裙摆', '转身', '旋转', 'hem', 'fabric', 'turn'] },
  { pattern: /头发|扶发|撩发|hair/i, terms: ['头发', '撩发', 'hair'] },
  { pattern: /墨镜|眼镜|sunglasses/i, terms: ['墨镜', '眼镜', 'sunglasses'] },
  { pattern: /包|手袋|提包|handbag|bag/i, terms: ['包', '手袋', 'handbag', 'bag'] },
  { pattern: /自然|休闲|放松|松弛|随意|relax|casual/i, terms: ['自然', '休闲', '放松', '重心', 'relaxed', 'casual', 'weight shifted'] },
];

const selectLibrary = (intent: string) => {
  const matchedKey = LIBRARY_RULES.find((rule) => rule.pattern.test(intent))?.key || 'clothing';
  return LIBRARIES.find((library) => library.key === matchedKey) || LIBRARIES[0];
};

const stableHash = (value: string) => Array.from(value).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);

export const selectPoseFromAgentLibrary = (intent: string): PoseAgentSelection => {
  const library = selectLibrary(intent);
  const desiredTerms = ACTION_RULES
    .filter((rule) => rule.pattern.test(intent))
    .flatMap((rule) => rule.terms.map((term) => term.toLowerCase()));
  const fallbackTerms = ['自然', '重心', 'relaxed', 'weight shifted', 'one foot'];
  const terms = desiredTerms.length ? desiredTerms : fallbackTerms;

  const ranked = library.poses
    .map((pose) => {
      const name = pose.name.toLowerCase();
      const prompt = pose.prompt.toLowerCase();
      const score = terms.reduce((total, term) => (
        total + (name.includes(term) ? 12 : 0) + (prompt.includes(term) ? 5 : 0)
      ), 0);
      return { pose, score };
    })
    .sort((a, b) => b.score - a.score);

  const bestScore = ranked[0]?.score || 0;
  const finalists = ranked.filter((entry) => entry.score === bestScore).slice(0, 8);
  const selected = finalists[stableHash(intent) % Math.max(1, finalists.length)]?.pose || library.poses[0];
  const directive = [
    `POSE AGENT ROUTE: MODEL_POSE_FISSION`,
    `SELECTED ACTION LIBRARY: ${library.label}`,
    `SELECTED ACTION: ${selected.name}`,
    `MANDATORY POSE DEFINITION: ${selected.prompt}`,
    'Apply this library action as the body-pose authority while preserving the exact person, garment, scene, camera crop and every non-pose attribute from Image 1 unless the user explicitly requests otherwise.',
  ].join('\n');

  return {
    libraryKey: library.key,
    libraryLabel: library.label,
    poseId: selected.id,
    poseName: selected.name,
    posePrompt: selected.prompt,
    directive,
  };
};
