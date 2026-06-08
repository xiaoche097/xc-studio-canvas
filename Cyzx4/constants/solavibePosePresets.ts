export interface SolavibePose {
  id: string;
  name: string;
  category: 'standing' | 'plusSize' | 'vacationDress' | 'twoPieceSet' | 'lookbook';
  prompt: string;
}

const SOLAVIBE_FRAME =
  'Solavibe plus-size vacation resort lookbook framing, relaxed boho comfort mood, friendly approachable model energy, soft natural posture, breathable loose garment drape, waistline and silhouette clearly readable, warm resort lifestyle scene such as european town street, white wall architecture, wood balcony, poolside, cafe, palm walkway, resort corridor, beach boardwalk, or warm stone wall, commercial ecommerce hero image, no stiff high-fashion editorial pose';

const standing = [
  ['001', '双手插口袋', 'both hands in pockets, relaxed comfortable standing posture'],
  ['002', '单手插口袋', 'one hand in pocket, easy vacation stance'],
  ['003', '单手扶腰', 'one hand resting on waist, gentle body curve'],
  ['004', '双手扶腰', 'both hands on waist, confident but relaxed stance'],
  ['005', '单腿重心', 'weight shifted onto one leg, natural comfortable balance'],
  ['006', '双腿自然打开', 'feet naturally apart, stable relaxed standing posture'],
  ['007', '微侧身站立', 'slight side-body standing angle, garment shape readable'],
  ['008', '三分之二角度站立', 'two-thirds body angle, soft resort lookbook posture'],
  ['009', '正面站立', 'front-facing standing pose, calm friendly expression'],
  ['010', '回头站立', 'standing while looking back gently over shoulder'],
  ['011', '低头站立', 'standing while looking downward softly, relaxed mood'],
  ['012', '看远方', 'standing and looking into the distance, vacation calm'],
  ['013', '双手自然下垂', 'both arms hanging naturally beside body'],
  ['014', '双手抱胸', 'arms crossed softly, comfortable approachable styling'],
  ['015', '单手扶手臂', 'one hand holding opposite arm gently'],
  ['016', '单手扶脖子', 'one hand softly touching neck, relaxed shoulder line'],
  ['017', '单手扶锁骨', 'one hand resting near collarbone, soft feminine detail'],
  ['018', '单手摸头发', 'one hand touching hair naturally'],
  ['019', '双手整理头发', 'both hands loosely adjusting hair, casual resort moment'],
  ['020', '风吹头发', 'hair moving softly in breeze, relaxed vacation feeling'],
] as const;

const plusSize = [
  ['021', '身体45度角', 'body turned at a 45-degree angle, flattering plus-size silhouette'],
  ['022', '一侧肩膀向前', 'one shoulder angled slightly forward, soft body line'],
  ['023', '一侧臀部后移', 'one hip shifted subtly back, comfortable curve display'],
  ['024', '单脚前探', 'one foot placed slightly forward, elongated relaxed stance'],
  ['025', '单脚后撤', 'one foot stepped slightly back, natural body balance'],
  ['026', '双腿交叉', 'legs crossed naturally while standing, gentle plus-size elegance'],
  ['027', '单手扶腰展示曲线', 'one hand on waist emphasizing natural curve and fit'],
  ['028', '插袋展示腰线', 'hand in pocket showing waistline and relaxed fit'],
  ['029', '手放大腿外侧', 'hand resting on outer thigh, calm flattering posture'],
  ['030', '手放腰胯连接处', 'hand placed near waist-to-hip line, silhouette readable'],
  ['031', '双手插袋展示廓形', 'both hands in pockets showing loose garment outline'],
  ['032', '轻微转身展示侧面', 'slight turn to show side profile and drape'],
  ['033', '背身回头', 'back-facing pose with gentle over-shoulder look'],
  ['034', '行走回头', 'walking away while looking back softly'],
  ['035', '抱包展示身形', 'holding bag against body, silhouette still visible'],
  ['036', '单肩背包', 'bag worn on one shoulder, relaxed resort styling'],
  ['037', '托特包下垂', 'tote bag hanging naturally beside body'],
  ['038', '单手扶包带', 'one hand holding bag strap naturally'],
  ['039', '双手扶包带', 'both hands holding bag straps, friendly travel mood'],
  ['040', '包放身体前方', 'bag held in front of body, comfortable lookbook pose'],
] as const;

const vacationDress = [
  ['041', '单手提裙摆', 'one hand lightly lifting dress hem, vacation dress drape visible'],
  ['042', '双手提裙摆', 'both hands lightly lifting dress hem, relaxed playful movement'],
  ['043', '单手压裙摆', 'one hand holding dress hem down softly in breeze'],
  ['044', '风吹裙摆', 'dress hem moving naturally in warm breeze'],
  ['045', '转身裙摆飞扬', 'gentle turn with dress hem flowing outward'],
  ['046', '行走裙摆摆动', 'walking slowly with dress skirt swaying naturally'],
  ['047', '回头看裙摆', 'looking back toward flowing dress hem'],
  ['048', '单手扶帽檐', 'one hand touching straw hat brim, resort dress styling'],
  ['049', '拿草帽', 'holding straw hat casually beside body'],
  ['050', '草帽自然下垂', 'straw hat hanging naturally from one hand'],
  ['051', '单手拿咖啡', 'one hand holding coffee cup, vacation town stroll'],
  ['052', '单手拿饮料', 'one hand holding cold drink, resort relaxation'],
  ['053', '单手拿太阳镜', 'one hand holding sunglasses near chest or waist'],
  ['054', '调整太阳镜', 'adjusting sunglasses naturally, relaxed vacation mood'],
  ['055', '沙滩慢步', 'slow walk along beach, soft dress movement'],
  ['056', '度假酒店漫步', 'strolling through resort hotel walkway'],
  ['057', '阳台看远方', 'standing on balcony looking into distance'],
  ['058', '靠栏杆站立', 'standing lightly against railing, calm resort mood'],
  ['059', '单手扶栏杆', 'one hand resting on railing, relaxed dress silhouette'],
  ['060', '双手扶栏杆', 'both hands resting on railing, soft vacation posture'],
] as const;

const twoPieceSet = [
  ['061', '双手插裤袋', 'both hands in pants pockets, two-piece set silhouette visible'],
  ['062', '单手插裤袋', 'one hand in pants pocket, relaxed matching set pose'],
  ['063', '展示阔腿裤', 'standing to show wide-leg pants volume and drape'],
  ['064', '展示裤长', 'pose emphasizing pants length, hem, and leg line'],
  ['065', '展示腰头', 'hands near waistband showing waist construction'],
  ['066', '调整裤腰', 'adjusting pants waistband naturally'],
  ['067', '调整上衣下摆', 'adjusting top hem to show set proportions'],
  ['068', '单手抓衣摆', 'one hand lightly holding top hem'],
  ['069', '双手抓衣摆', 'both hands lightly holding top hem, relaxed fit display'],
  ['070', '展示套装轮廓', 'pose showing full matching set outline and comfort fit'],
  ['071', '慢步行走', 'slow walking movement, soft fabric motion'],
  ['072', '插袋行走', 'walking with hands in pockets, effortless vacation mood'],
  ['073', '回头行走', 'walking while looking back gently'],
  ['074', '街头漫步', 'strolling through warm resort street'],
  ['075', '看橱窗', 'standing near shop window, looking sideways softly'],
  ['076', '等待动作', 'relaxed waiting pose, casual travel moment'],
  ['077', '单手拿手机', 'one hand holding phone naturally'],
  ['078', '查看手机', 'looking down at phone while standing or walking slowly'],
  ['079', '单手拿包', 'one hand holding bag beside body'],
  ['080', '双手抱包', 'holding bag with both hands, friendly comfortable styling'],
] as const;

const lookbook = [
  ['081', '靠墙站姿', 'leaning lightly against wall, relaxed resort lookbook pose'],
  ['082', '单肩靠墙', 'one shoulder leaning against wall, soft body angle'],
  ['083', '单手扶墙', 'one hand touching wall naturally'],
  ['084', '靠门框', 'leaning against doorway, warm vacation home feeling'],
  ['085', '靠立柱', 'leaning lightly near column, calm architectural framing'],
  ['086', '靠栏杆', 'leaning softly on railing, resort corridor mood'],
  ['087', '建筑前站立', 'standing in front of white resort architecture'],
  ['088', '欧式街道站立', 'standing on european town street, relaxed travel lookbook'],
  ['089', '走廊站立', 'standing in resort corridor, soft warm light'],
  ['090', '窗边站立', 'standing near window, natural sunlight'],
  ['091', '阳光下站立', 'standing in warm sunlight, comfortable vacation mood'],
  ['092', '阴影下站立', 'standing in soft architectural shade'],
  ['093', '逆光站立', 'standing in gentle backlight, relaxed silhouette'],
  ['094', '单腿重心Hero Pose', 'hero pose with weight on one leg, friendly resort confidence'],
  ['095', '插袋Hero Pose', 'hero pose with hands in pockets, relaxed Solavibe attitude'],
  ['096', '扶腰Hero Pose', 'hero pose with one hand on waist, soft curve display'],
  ['097', '行走Hero Pose', 'hero walking pose, approachable vacation energy'],
  ['098', '转身Hero Pose', 'hero turning pose, soft fabric motion'],
  ['099', 'Vacation Hero Pose', 'signature vacation hero pose with resort scene and comfortable styling'],
  ['100', 'Solavibe Signature Pose', 'Solavibe signature relaxed plus-size vacation pose, soft smile, natural stance, boho resort comfort'],
] as const;

const makePoses = (
  category: SolavibePose['category'],
  items: readonly (readonly [string, string, string])[]
): SolavibePose[] =>
  items.map(([id, name, prompt]) => ({
    id,
    name,
    category,
    prompt: `${prompt}, ${SOLAVIBE_FRAME}`,
  }));

export const SOLAVIBE_POSES: SolavibePose[] = [
  ...makePoses('standing', standing),
  ...makePoses('plusSize', plusSize),
  ...makePoses('vacationDress', vacationDress),
  ...makePoses('twoPieceSet', twoPieceSet),
  ...makePoses('lookbook', lookbook),
];
