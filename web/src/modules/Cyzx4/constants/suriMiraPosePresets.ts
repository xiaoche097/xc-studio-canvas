export interface SuriMiraPose {
  id: string;
  name: string;
  prompt: string;
}

const SURI_MIRA_FRAME =
  'Suri Mira royal french vintage dress brand pose library, palace-inspired french romantic dress styling, elegant sweet feminine posture, full dress silhouette readable, waistline, puff sleeves, square neckline, skirt hem, floral vintage fabric, lace or bow details clearly displayed, graceful ecommerce hero-image framing, refined SHEIN fashion marketplace visual, no stiff mannequin posture';

const SURI_MIRA_POSE_ITEMS = [
    {
        "id":  "001",
        "name":  "正面站立，单手扶腰，另一只手自然下垂",
        "prompt":  "front-facing standing pose, one hand on waist, the other hand relaxed naturally"
    },
    {
        "id":  "002",
        "name":  "正面站立，双手自然下垂",
        "prompt":  "front-facing standing pose, both arms relaxed naturally"
    },
    {
        "id":  "003",
        "name":  "微侧身站立，单手扶腰",
        "prompt":  "slight three-quarter standing pose, one hand resting on waist"
    },
    {
        "id":  "004",
        "name":  "微侧身站立，双手自然放松",
        "prompt":  "slight three-quarter standing pose, both arms relaxed"
    },
    {
        "id":  "005",
        "name":  "三分之二角度站姿，单腿重心",
        "prompt":  "three-quarter standing pose, weight shifted onto one leg"
    },
    {
        "id":  "006",
        "name":  "正面站姿，双脚轻微交叉",
        "prompt":  "front-facing standing pose, legs crossed softly"
    },
    {
        "id":  "007",
        "name":  "正面站姿，单脚微微前探",
        "prompt":  "front-facing standing pose, one foot slightly forward"
    },
    {
        "id":  "008",
        "name":  "正面站姿，单脚后撤",
        "prompt":  "front-facing standing pose, one foot slightly behind"
    },
    {
        "id":  "009",
        "name":  "微侧身站姿，肩膀轻轻回收",
        "prompt":  "slight angled standing pose, shoulders drawn in gently"
    },
    {
        "id":  "010",
        "name":  "身体45度站姿，头微偏",
        "prompt":  "45-degree standing pose, head slightly tilted"
    },
    {
        "id":  "011",
        "name":  "双手轻扶裙摆两侧",
        "prompt":  "both hands lightly holding both sides of skirt"
    },
    {
        "id":  "012",
        "name":  "单手提裙摆，另一只手扶腰",
        "prompt":  "one hand lifting skirt hem, the other hand on waist"
    },
    {
        "id":  "013",
        "name":  "单手轻提裙摆",
        "prompt":  "one hand lightly lifting the skirt hem"
    },
    {
        "id":  "014",
        "name":  "双手提裙摆微展开",
        "prompt":  "both hands lifting skirt slightly outward"
    },
    {
        "id":  "015",
        "name":  "单手压裙摆，防止裙摆飘起",
        "prompt":  "one hand gently pressing the skirt down"
    },
    {
        "id":  "016",
        "name":  "单手放在腰胯连接处",
        "prompt":  "one hand placed at the waist-hip line"
    },
    {
        "id":  "017",
        "name":  "单手扶腰，另一只手轻触裙摆",
        "prompt":  "one hand on waist, the other hand touching the skirt softly"
    },
    {
        "id":  "018",
        "name":  "双手放在腰线位置",
        "prompt":  "both hands placed near waistline"
    },
    {
        "id":  "019",
        "name":  "单手自然扶大腿外侧",
        "prompt":  "one hand resting naturally on outer thigh"
    },
    {
        "id":  "020",
        "name":  "双手自然贴身站立",
        "prompt":  "both arms naturally close to body"
    },
    {
        "id":  "021",
        "name":  "正面站姿，双肩打开",
        "prompt":  "front-facing pose with open shoulders"
    },
    {
        "id":  "022",
        "name":  "正面站姿，身体微收，突出收腰",
        "prompt":  "front-facing pose with subtle inward posture to emphasize waist"
    },
    {
        "id":  "023",
        "name":  "轻微歪头站姿",
        "prompt":  "standing pose with slight head tilt"
    },
    {
        "id":  "024",
        "name":  "单手扶锁骨，另一只手下垂",
        "prompt":  "one hand touching collarbone, the other relaxed down"
    },
    {
        "id":  "025",
        "name":  "单手扶肩带/领口位置",
        "prompt":  "one hand lightly touching strap or neckline area"
    },
    {
        "id":  "026",
        "name":  "回头站姿，身体背向一点点",
        "prompt":  "slight back-facing pose, looking back over shoulder"
    },
    {
        "id":  "027",
        "name":  "半转身回头动作",
        "prompt":  "half-turn pose, looking back softly"
    },
    {
        "id":  "028",
        "name":  "背面展示，头侧回",
        "prompt":  "back view pose with head turned sideways"
    },
    {
        "id":  "029",
        "name":  "背面展示，单手扶腰",
        "prompt":  "back view pose, one hand on waist"
    },
    {
        "id":  "030",
        "name":  "背面展示，双手自然放松",
        "prompt":  "back view pose, both arms relaxed"
    },
    {
        "id":  "031",
        "name":  "侧身展示裙型",
        "prompt":  "side-profile standing pose to show dress silhouette"
    },
    {
        "id":  "032",
        "name":  "左侧站姿，双脚自然并拢",
        "prompt":  "left side standing pose, legs together naturally"
    },
    {
        "id":  "033",
        "name":  "右侧站姿，单腿重心",
        "prompt":  "right side standing pose, weight on one leg"
    },
    {
        "id":  "034",
        "name":  "微侧身，裙摆自然垂落",
        "prompt":  "slight angled pose with skirt falling naturally"
    },
    {
        "id":  "035",
        "name":  "正面站姿，双脚微开",
        "prompt":  "front-facing standing pose, feet slightly apart"
    },
    {
        "id":  "036",
        "name":  "单手提包，另一只手扶腰",
        "prompt":  "one hand holding handbag, the other hand on waist"
    },
    {
        "id":  "037",
        "name":  "双手轻提包站姿",
        "prompt":  "holding handbag softly with both hands"
    },
    {
        "id":  "038",
        "name":  "单手拎包，自然垂落",
        "prompt":  "one hand carrying bag, arm hanging naturally"
    },
    {
        "id":  "039",
        "name":  "单手扶包带，另一只手下垂",
        "prompt":  "one hand holding bag strap, the other relaxed"
    },
    {
        "id":  "040",
        "name":  "手包夹在臂弯处站姿",
        "prompt":  "handbag tucked in crook of arm, elegant standing pose"
    },
    {
        "id":  "041",
        "name":  "轻微转圈，裙摆微扬",
        "prompt":  "light twirl motion, skirt gently flaring"
    },
    {
        "id":  "042",
        "name":  "半旋转动作，裙摆展开",
        "prompt":  "half-turn movement with skirt spreading softly"
    },
    {
        "id":  "043",
        "name":  "转身瞬间抓拍动作",
        "prompt":  "captured mid-turn pose"
    },
    {
        "id":  "044",
        "name":  "原地旋转，双手轻提裙摆",
        "prompt":  "spinning in place, lightly lifting skirt with both hands"
    },
    {
        "id":  "045",
        "name":  "原地旋转，单手提裙摆",
        "prompt":  "spinning in place, one hand lifting skirt"
    },
    {
        "id":  "046",
        "name":  "小幅度转身，裙摆自然甩开",
        "prompt":  "small turning motion with skirt swinging naturally"
    },
    {
        "id":  "047",
        "name":  "旋转回头动作",
        "prompt":  "turning motion while looking back"
    },
    {
        "id":  "048",
        "name":  "侧身转回正面",
        "prompt":  "turning from side angle back to front"
    },
    {
        "id":  "049",
        "name":  "裙摆甩动动作",
        "prompt":  "skirt swishing motion"
    },
    {
        "id":  "050",
        "name":  "轻摆裙动作",
        "prompt":  "gentle skirt-swaying pose"
    },
    {
        "id":  "051",
        "name":  "慢步向前行走",
        "prompt":  "slow walking toward camera"
    },
    {
        "id":  "052",
        "name":  "行走中单手扶腰",
        "prompt":  "walking pose with one hand on waist"
    },
    {
        "id":  "053",
        "name":  "行走中单手提裙摆",
        "prompt":  "walking pose with one hand lifting skirt slightly"
    },
    {
        "id":  "054",
        "name":  "行走中双手自然下垂",
        "prompt":  "walking pose, both arms relaxed naturally"
    },
    {
        "id":  "055",
        "name":  "行走中回头",
        "prompt":  "walking pose while looking back"
    },
    {
        "id":  "056",
        "name":  "行走中低头微笑",
        "prompt":  "walking pose with lowered gaze and soft smile"
    },
    {
        "id":  "057",
        "name":  "行走中看向侧方",
        "prompt":  "walking pose looking softly to the side"
    },
    {
        "id":  "058",
        "name":  "行走中裙摆自然飘起",
        "prompt":  "walking pose with skirt moving naturally"
    },
    {
        "id":  "059",
        "name":  "小步轻走动作",
        "prompt":  "small-step elegant walking pose"
    },
    {
        "id":  "060",
        "name":  "大裙摆行走抓拍",
        "prompt":  "walking pose emphasizing wide skirt movement"
    },
    {
        "id":  "061",
        "name":  "向前迈一步站定",
        "prompt":  "one step forward and pause pose"
    },
    {
        "id":  "062",
        "name":  "交叉步轻走",
        "prompt":  "cross-step walking pose"
    },
    {
        "id":  "063",
        "name":  "停步回头动作",
        "prompt":  "paused movement pose while looking back"
    },
    {
        "id":  "064",
        "name":  "行走中单手拎包",
        "prompt":  "walking pose with handbag in one hand"
    },
    {
        "id":  "065",
        "name":  "行走中另一只手轻触裙摆",
        "prompt":  "walking pose with one hand touching skirt lightly"
    },
    {
        "id":  "066",
        "name":  "行走中双脚交叉步态",
        "prompt":  "walking pose with elegant crossing steps"
    },
    {
        "id":  "067",
        "name":  "迈步同时身体微侧",
        "prompt":  "walking pose with body angled slightly"
    },
    {
        "id":  "068",
        "name":  "行走中头微偏",
        "prompt":  "walking pose with soft head tilt"
    },
    {
        "id":  "069",
        "name":  "轻快小跑式裙摆动态",
        "prompt":  "light lively movement with skirt flutter"
    },
    {
        "id":  "070",
        "name":  "走动中转身动作",
        "prompt":  "walking then turning motion"
    },
    {
        "id":  "071",
        "name":  "坐姿侧放双腿，单手扶腰",
        "prompt":  "seated pose with legs to one side, one hand on waist"
    },
    {
        "id":  "072",
        "name":  "坐姿双手自然放膝上",
        "prompt":  "seated pose, both hands resting on knees"
    },
    {
        "id":  "073",
        "name":  "坐姿单手扶裙摆",
        "prompt":  "seated pose with one hand touching skirt"
    },
    {
        "id":  "074",
        "name":  "坐姿单手托腮",
        "prompt":  "seated pose with one hand supporting chin lightly"
    },
    {
        "id":  "075",
        "name":  "坐姿双腿并拢，身体微侧",
        "prompt":  "seated pose, legs together, body slightly angled"
    },
    {
        "id":  "076",
        "name":  "坐姿回头",
        "prompt":  "seated pose looking back softly"
    },
    {
        "id":  "077",
        "name":  "坐姿单手拎包",
        "prompt":  "seated pose holding handbag with one hand"
    },
    {
        "id":  "078",
        "name":  "坐姿双手轻扶裙摆",
        "prompt":  "seated pose with both hands lightly smoothing skirt"
    },
    {
        "id":  "079",
        "name":  "靠坐姿势，身体挺直",
        "prompt":  "upright seated pose with elegant posture"
    },
    {
        "id":  "080",
        "name":  "坐姿低头看裙摆",
        "prompt":  "seated pose looking down at skirt"
    },
    {
        "id":  "081",
        "name":  "半身动作，单手扶锁骨",
        "prompt":  "half-body pose, one hand touching collarbone"
    },
    {
        "id":  "082",
        "name":  "半身动作，单手扶脸侧",
        "prompt":  "half-body pose, one hand touching side of face"
    },
    {
        "id":  "083",
        "name":  "半身动作，单手拨头发",
        "prompt":  "half-body pose, one hand brushing hair"
    },
    {
        "id":  "084",
        "name":  "半身动作，双手自然垂落",
        "prompt":  "half-body pose, arms relaxed naturally"
    },
    {
        "id":  "085",
        "name":  "半身动作，单手扶领口",
        "prompt":  "half-body pose, one hand touching neckline"
    },
    {
        "id":  "086",
        "name":  "半身动作，单手扶耳边",
        "prompt":  "half-body pose, one hand near ear"
    },
    {
        "id":  "087",
        "name":  "半身动作，双手轻扶腰线",
        "prompt":  "half-body pose, both hands lightly near waist"
    },
    {
        "id":  "088",
        "name":  "半身动作，单手抱手臂",
        "prompt":  "half-body pose, one hand holding opposite arm"
    },
    {
        "id":  "089",
        "name":  "半身动作，双臂轻抱",
        "prompt":  "half-body pose with soft crossed arms"
    },
    {
        "id":  "090",
        "name":  "半身动作，微侧脸看向远方",
        "prompt":  "half-body pose, face angled slightly away"
    },
    {
        "id":  "091",
        "name":  "无袖西装裙/连体款，单手插口袋",
        "prompt":  "for sleeveless tailored dress or jumpsuit, one hand in pocket"
    },
    {
        "id":  "092",
        "name":  "无袖西装裙/连体款，双手插口袋",
        "prompt":  "for sleeveless tailored dress or jumpsuit, both hands in pockets"
    },
    {
        "id":  "093",
        "name":  "无袖西装裙/连体款，单手扶腰",
        "prompt":  "for sleeveless tailored dress or jumpsuit, one hand on waist"
    },
    {
        "id":  "094",
        "name":  "无袖西装裙/连体款，另一手拎包",
        "prompt":  "for sleeveless tailored dress or jumpsuit, one hand holding bag"
    },
    {
        "id":  "095",
        "name":  "宫廷泡袖款，双手轻提裙摆",
        "prompt":  "for puff-sleeve royal dress, both hands lightly lifting skirt"
    },
    {
        "id":  "096",
        "name":  "宫廷泡袖款，单手扶腰突出袖型",
        "prompt":  "for puff-sleeve royal dress, one hand on waist to emphasize sleeves"
    },
    {
        "id":  "097",
        "name":  "方领/一字肩款，双手自然放松突出肩颈",
        "prompt":  "for square-neck or off-shoulder dress, arms relaxed to emphasize neckline"
    },
    {
        "id":  "098",
        "name":  "方领/一字肩款，单手扶锁骨",
        "prompt":  "for square-neck or off-shoulder dress, one hand touching collarbone"
    },
    {
        "id":  "099",
        "name":  "花卉大裙摆款，旋转摆裙动作",
        "prompt":  "for floral full-skirt dress, twirling pose with skirt flare"
    },
    {
        "id":  "100",
        "name":  "高点击主图 Hero Pose：微侧身、单手扶腰、另一只手轻提裙摆、单腿重心、裙摆自然展开",
        "prompt":  "high-click hero pose: slight three-quarter body angle, one hand on waist, the other hand lightly lifting skirt, weight on one leg, skirt naturally spread"
    },
    {
        "id":  "101",
        "name":  "正面站立，双手轻扶腰线，肩颈打开",
        "prompt":  "front-facing standing pose, both hands lightly near waistline, shoulders open"
    },
    {
        "id":  "102",
        "name":  "微侧身站立，单手扶腰，头轻微侧偏",
        "prompt":  "slight three-quarter standing pose, one hand on waist, head tilted softly"
    },
    {
        "id":  "103",
        "name":  "正面站立，双脚并拢，双手自然下垂",
        "prompt":  "front-facing standing pose, feet together, both arms relaxed naturally"
    },
    {
        "id":  "104",
        "name":  "微侧身站立，单脚前探，裙摆自然展开",
        "prompt":  "slight angled standing pose, one foot forward, skirt spreading softly"
    },
    {
        "id":  "105",
        "name":  "正面站立，单手轻扶胸前领口位置",
        "prompt":  "front-facing standing pose, one hand lightly touching neckline"
    },
    {
        "id":  "106",
        "name":  "三分之二站姿，另一只手自然扶大腿",
        "prompt":  "three-quarter standing pose, the other hand resting naturally on thigh"
    },
    {
        "id":  "107",
        "name":  "单腿重心站姿，双肩微微回收",
        "prompt":  "weight-on-one-leg standing pose, shoulders slightly drawn inward"
    },
    {
        "id":  "108",
        "name":  "正面站姿，头微低，双手放松贴身",
        "prompt":  "front-facing standing pose, chin slightly lowered, both arms relaxed close to body"
    },
    {
        "id":  "109",
        "name":  "微侧身站姿，双手轻提裙摆下缘",
        "prompt":  "slight angled standing pose, both hands lightly lifting lower skirt hem"
    },
    {
        "id":  "110",
        "name":  "正面站姿，单手拎包，另一手扶腰",
        "prompt":  "front-facing standing pose, one hand holding bag, the other hand on waist"
    },
    {
        "id":  "111",
        "name":  "回头站姿，单手自然扶背后腰线",
        "prompt":  "looking-back standing pose, one hand resting near lower back waistline"
    },
    {
        "id":  "112",
        "name":  "半转身动作，单手提裙摆，裙摆轻微展开",
        "prompt":  "half-turn pose, one hand lifting skirt, skirt slightly opening out"
    },
    {
        "id":  "113",
        "name":  "正面站姿，双腿微开，单手扶锁骨",
        "prompt":  "front-facing standing pose, feet slightly apart, one hand touching collarbone"
    },
    {
        "id":  "114",
        "name":  "正面站姿，单脚交叉，双手自然下垂",
        "prompt":  "front-facing standing pose, feet crossed softly, both arms relaxed"
    },
    {
        "id":  "115",
        "name":  "侧身站姿，单手拎包，另一只手贴腰",
        "prompt":  "side-profile standing pose, one hand holding bag, the other near waist"
    },
    {
        "id":  "116",
        "name":  "背面展示，身体微侧，头回看镜头方向",
        "prompt":  "back view pose, body slightly angled, head turned back toward camera direction"
    },
    {
        "id":  "117",
        "name":  "正面站姿，单手轻扶脸侧",
        "prompt":  "front-facing standing pose, one hand lightly touching side of face"
    },
    {
        "id":  "118",
        "name":  "三分之二角度站姿，单手拨头发",
        "prompt":  "three-quarter standing pose, one hand brushing hair"
    },
    {
        "id":  "119",
        "name":  "站姿轻微歪头，双手放松",
        "prompt":  "standing pose with slight head tilt, both hands relaxed"
    },
    {
        "id":  "120",
        "name":  "正面 Hero Pose，双肩打开，腰线明确",
        "prompt":  "front-facing hero pose, shoulders open, waistline emphasized"
    },
    {
        "id":  "121",
        "name":  "双手轻提裙摆向两侧展开",
        "prompt":  "both hands lifting skirt outward to both sides gently"
    },
    {
        "id":  "122",
        "name":  "单手向侧方提起裙摆，突出裙摆弧线",
        "prompt":  "one hand lifting skirt to the side, emphasizing skirt curve"
    },
    {
        "id":  "123",
        "name":  "双手压裙摆边缘，展示大摆量感",
        "prompt":  "both hands pressing skirt edges lightly, showing volume of full skirt"
    },
    {
        "id":  "124",
        "name":  "单手捏住裙摆一点点，另一只手扶腰",
        "prompt":  "one hand pinching a small part of skirt, the other hand on waist"
    },
    {
        "id":  "125",
        "name":  "裙摆轻轻外甩动作",
        "prompt":  "light outward skirt-swinging motion"
    },
    {
        "id":  "126",
        "name":  "原地轻摆裙动作，身体保持稳定",
        "prompt":  "gentle in-place skirt-swaying pose, upper body stable"
    },
    {
        "id":  "127",
        "name":  "单手提裙摆前侧，展示层次",
        "prompt":  "one hand lifting front section of skirt, showing layered structure"
    },
    {
        "id":  "128",
        "name":  "双手轻扶裙摆并略微向前提起",
        "prompt":  "both hands lightly holding skirt and lifting it slightly forward"
    },
    {
        "id":  "129",
        "name":  "单手提裙摆转身准备动作",
        "prompt":  "one hand lifting skirt in preparation for a turn"
    },
    {
        "id":  "130",
        "name":  "裙摆下垂状态下身体微旋转",
        "prompt":  "subtle body rotation while skirt falls naturally"
    },
    {
        "id":  "131",
        "name":  "单手压腰侧裙摆，展示收腰剪裁",
        "prompt":  "one hand pressing skirt at side waist area, emphasizing fitted waist"
    },
    {
        "id":  "132",
        "name":  "轻轻抚平裙摆动作",
        "prompt":  "gently smoothing the skirt fabric"
    },
    {
        "id":  "133",
        "name":  "单手扶裙摆边缘，头微低",
        "prompt":  "one hand touching skirt edge, head slightly lowered"
    },
    {
        "id":  "134",
        "name":  "双手提裙摆形成对称展开",
        "prompt":  "both hands lifting skirt symmetrically"
    },
    {
        "id":  "135",
        "name":  "单手提包，另一只手轻提裙摆",
        "prompt":  "one hand holding bag, the other lightly lifting skirt"
    },
    {
        "id":  "136",
        "name":  "转身时单手压住裙摆",
        "prompt":  "one hand holding down skirt softly during turn"
    },
    {
        "id":  "137",
        "name":  "低头看裙摆动作",
        "prompt":  "looking down at the skirt pose"
    },
    {
        "id":  "138",
        "name":  "单手抓裙摆褶量，突出面料感",
        "prompt":  "one hand gathering skirt fabric lightly, emphasizing texture"
    },
    {
        "id":  "139",
        "name":  "两侧裙摆微微向外拨开",
        "prompt":  "lightly pulling both sides of skirt outward"
    },
    {
        "id":  "140",
        "name":  "裙摆自然落地，双手回归放松",
        "prompt":  "skirt falling naturally to the floor, both hands relaxed"
    },
    {
        "id":  "141",
        "name":  "轻转身动作，头回看，裙摆微扬",
        "prompt":  "light turning pose, head looking back, skirt slightly lifted by movement"
    },
    {
        "id":  "142",
        "name":  "原地半圈旋转，单手扶腰",
        "prompt":  "half-circle turn in place, one hand on waist"
    },
    {
        "id":  "143",
        "name":  "单手提裙摆旋转，另一只手自然伸展",
        "prompt":  "one hand lifting skirt while turning, the other arm relaxed outward"
    },
    {
        "id":  "144",
        "name":  "旋转收尾站姿，双脚交叉",
        "prompt":  "ending a turn with softly crossed feet"
    },
    {
        "id":  "145",
        "name":  "旋转中低头动作",
        "prompt":  "looking downward during spinning motion"
    },
    {
        "id":  "146",
        "name":  "旋转中看向侧前方",
        "prompt":  "looking toward the front-side direction during turn"
    },
    {
        "id":  "147",
        "name":  "旋转中裙摆大幅度铺开",
        "prompt":  "wide skirt flare during turning motion"
    },
    {
        "id":  "148",
        "name":  "半转身定格动作",
        "prompt":  "frozen half-turn pose"
    },
    {
        "id":  "149",
        "name":  "旋转后停步回头",
        "prompt":  "after-turn paused pose while looking back"
    },
    {
        "id":  "150",
        "name":  "慢速转身，裙摆轻柔摆动",
        "prompt":  "slow turning pose, skirt moving softly"
    },
    {
        "id":  "151",
        "name":  "向前慢步行走，单手扶腰",
        "prompt":  "slow walk forward with one hand on waist"
    },
    {
        "id":  "152",
        "name":  "向前慢步行走，双手自然下垂",
        "prompt":  "slow forward walking pose, both arms relaxed naturally"
    },
    {
        "id":  "153",
        "name":  "行走中单手拎包，步态轻盈",
        "prompt":  "walking pose with bag in one hand, light elegant steps"
    },
    {
        "id":  "154",
        "name":  "行走中回头看侧后方",
        "prompt":  "walking pose while looking back to the side-rear"
    },
    {
        "id":  "155",
        "name":  "行走中低头看地面前方",
        "prompt":  "walking pose with lowered gaze toward the ground ahead"
    },
    {
        "id":  "156",
        "name":  "行走中裙摆被步伐带起",
        "prompt":  "walking pose with skirt lifted naturally by movement"
    },
    {
        "id":  "157",
        "name":  "行走中单手轻触领口",
        "prompt":  "walking pose with one hand lightly touching neckline"
    },
    {
        "id":  "158",
        "name":  "行走中单手拨头发",
        "prompt":  "walking pose with one hand brushing hair"
    },
    {
        "id":  "159",
        "name":  "行走中双脚交叉步态",
        "prompt":  "walking pose with elegant crossing steps"
    },
    {
        "id":  "160",
        "name":  "停步前最后一步抓拍动作",
        "prompt":  "captured pose on the last step before stopping"
    },
    {
        "id":  "161",
        "name":  "向前走一步后定格扶腰",
        "prompt":  "step forward and pause with hand on waist"
    },
    {
        "id":  "162",
        "name":  "行走中单手提裙摆避免裙摆拖地",
        "prompt":  "walking pose with one hand lifting skirt slightly"
    },
    {
        "id":  "163",
        "name":  "斜向行走动作，身体微侧",
        "prompt":  "diagonal walking pose, body slightly angled"
    },
    {
        "id":  "164",
        "name":  "行走中一只手扶包带",
        "prompt":  "walking pose with one hand holding bag strap"
    },
    {
        "id":  "165",
        "name":  "慢走中回头微笑",
        "prompt":  "slow walking pose while looking back with soft smile"
    },
    {
        "id":  "166",
        "name":  "大摆裙行走，裙摆波浪形摆动",
        "prompt":  "full-skirt walking pose with wave-like skirt movement"
    },
    {
        "id":  "167",
        "name":  "小步轻走，双腿靠近",
        "prompt":  "small graceful walking steps with legs kept close"
    },
    {
        "id":  "168",
        "name":  "行走中头微偏，肩颈放松",
        "prompt":  "walking pose with slight head tilt and relaxed shoulders"
    },
    {
        "id":  "169",
        "name":  "行走中双手一前一后自然摆动",
        "prompt":  "walking pose with natural front-and-back arm swing"
    },
    {
        "id":  "170",
        "name":  "正面行走 Hero Pose",
        "prompt":  "front-facing walking hero pose"
    },
    {
        "id":  "171",
        "name":  "坐姿双腿并拢，双手自然放腿上",
        "prompt":  "seated pose, legs together, both hands resting naturally on legs"
    },
    {
        "id":  "172",
        "name":  "坐姿双腿侧放，单手扶腰",
        "prompt":  "seated pose, legs to one side, one hand on waist"
    },
    {
        "id":  "173",
        "name":  "坐姿单手托腮，另一只手扶裙摆",
        "prompt":  "seated pose, one hand supporting chin, the other touching skirt"
    },
    {
        "id":  "174",
        "name":  "坐姿身体微侧，双肩放松",
        "prompt":  "seated pose with body slightly angled and relaxed shoulders"
    },
    {
        "id":  "175",
        "name":  "坐姿回头，展示肩颈与背部线条",
        "prompt":  "seated pose looking back, showing shoulder-neck-back line"
    },
    {
        "id":  "176",
        "name":  "坐姿单手拎包放于腿侧",
        "prompt":  "seated pose with handbag in one hand beside leg"
    },
    {
        "id":  "177",
        "name":  "坐姿双手轻抚裙摆",
        "prompt":  "seated pose, both hands gently smoothing skirt"
    },
    {
        "id":  "178",
        "name":  "坐姿单脚前伸，另一脚收回",
        "prompt":  "seated pose with one leg extended slightly and the other tucked back"
    },
    {
        "id":  "179",
        "name":  "坐姿低头整理裙摆",
        "prompt":  "seated pose looking down while adjusting skirt"
    },
    {
        "id":  "180",
        "name":  "坐姿正面对镜头，姿态端正",
        "prompt":  "seated pose facing camera with upright posture"
    },
    {
        "id":  "181",
        "name":  "半身正面动作，单手扶锁骨",
        "prompt":  "half-body front pose, one hand touching collarbone"
    },
    {
        "id":  "182",
        "name":  "半身微侧动作，单手扶脸侧",
        "prompt":  "half-body angled pose, one hand touching side of face"
    },
    {
        "id":  "183",
        "name":  "半身动作，单手拨开发丝",
        "prompt":  "half-body pose, one hand brushing hair away"
    },
    {
        "id":  "184",
        "name":  "半身动作，单手扶耳边，另一只手下垂",
        "prompt":  "half-body pose, one hand near ear, the other arm relaxed"
    },
    {
        "id":  "185",
        "name":  "半身动作，双手轻扶腰线上缘",
        "prompt":  "half-body pose, both hands lightly near upper waistline"
    },
    {
        "id":  "186",
        "name":  "半身动作，单手扶领口，眼神看侧方",
        "prompt":  "half-body pose, one hand touching neckline, gaze to the side"
    },
    {
        "id":  "187",
        "name":  "半身动作，双臂轻抱",
        "prompt":  "half-body pose with softly crossed arms"
    },
    {
        "id":  "188",
        "name":  "半身动作，单手抱手臂",
        "prompt":  "half-body pose with one hand holding opposite arm"
    },
    {
        "id":  "189",
        "name":  "半身动作，单手扶肩带/袖口边缘",
        "prompt":  "half-body pose, one hand touching strap or sleeve edge"
    },
    {
        "id":  "190",
        "name":  "半身动作，头微偏，肩线放松",
        "prompt":  "half-body pose, head slightly tilted, shoulders relaxed"
    },
    {
        "id":  "191",
        "name":  "无袖西装裙款，双手插口袋站姿",
        "prompt":  "for sleeveless tailored dress style, standing pose with both hands in pockets"
    },
    {
        "id":  "192",
        "name":  "无袖西装裙款，单手插口袋，另一只手拎包",
        "prompt":  "for sleeveless tailored dress style, one hand in pocket, the other holding a bag"
    },
    {
        "id":  "193",
        "name":  "无袖西装裙款，正面站姿，肩线挺直",
        "prompt":  "for sleeveless tailored dress style, front-facing standing pose with straight shoulders"
    },
    {
        "id":  "194",
        "name":  "宫廷泡袖款，单手扶腰，突出上身结构",
        "prompt":  "for puff-sleeve royal dress, one hand on waist, emphasizing upper structure"
    },
    {
        "id":  "195",
        "name":  "宫廷泡袖款，双手轻提裙摆，突出甜美感",
        "prompt":  "for puff-sleeve royal dress, both hands lightly lifting skirt, emphasizing sweetness"
    },
    {
        "id":  "196",
        "name":  "方领款，双手自然放松，突出肩颈线",
        "prompt":  "for square-neck dress, both arms relaxed to emphasize neckline and shoulders"
    },
    {
        "id":  "197",
        "name":  "方领款，单手扶锁骨，头微偏",
        "prompt":  "for square-neck dress, one hand touching collarbone, head slightly tilted"
    },
    {
        "id":  "198",
        "name":  "花卉复古大摆款，轻旋转摆裙动作",
        "prompt":  "for floral vintage full-skirt dress, light twirling pose"
    },
    {
        "id":  "199",
        "name":  "花卉复古款，单手提裙摆，另一只手拎包",
        "prompt":  "for floral vintage dress, one hand lifting skirt, the other holding bag"
    },
    {
        "id":  "200",
        "name":  "Suri Mira Signature Hero Pose：三分之二角度、单手扶腰、另一只手轻提裙摆、单腿重心、头微偏、裙摆自然展开、整体优雅甜美",
        "prompt":  "Suri Mira signature hero pose: three-quarter body angle, one hand on waist, the other lightly lifting skirt, weight on one leg, head slightly tilted, skirt naturally spread, overall elegant and sweet"
    },
    {
        "id":  "201",
        "name":  "爆款窗边靠墙：单肩轻靠原场景墙面，单手抚发，另一手自然贴裙",
        "prompt":  "high-click french vintage wall-leaning pose: one shoulder lightly leaning against the existing wall or wall panel, one hand softly brushing hair near temple, the other hand resting along the skirt, elegant relaxed confidence, real wall contact and soft contact shadow, same-style palace room support surface"
    },
    {
        "id":  "202",
        "name":  "爆款扶墙侧身：手掌轻扶墙板，身体三分之二侧转，裙摆垂顺",
        "prompt":  "three-quarter side pose beside an existing french wall panel, one palm lightly touching the wall for support, torso subtly angled, weight on one leg, skirt falling cleanly without heavy shadow, graceful palace editorial ecommerce pose"
    },
    {
        "id":  "203",
        "name":  "爆款墙边回眸：背部微靠墙，头回看镜头，单手整理领口",
        "prompt":  "romantic wall-side looking-back pose, upper back lightly supported by the existing wall, head turned back toward camera, one hand adjusting neckline or collarbone area, the other hand relaxed near waist, refined confident expression, no stiff mannequin mood"
    },
    {
        "id":  "204",
        "name":  "爆款门框倚靠：手肘轻搭同风格墙面/门框，身体自然倾斜",
        "prompt":  "soft doorway or wall-panel leaning pose using a same-style support surface from the scene, one elbow lightly resting on the vertical edge, body leaning naturally with believable support, legs softly crossed, dress waistline and skirt silhouette readable"
    },
    {
        "id":  "205",
        "name":  "爆款窗光站姿：侧身迎光，单手扶腰，另一手轻触窗边/墙面",
        "prompt":  "french window-light standing pose, body angled toward soft window light, one hand on waist, the other hand lightly touching existing wall or window-side surface, face relaxed and confident, product fully lit, avoid garment falling into deep shadow"
    },
    {
        "id":  "206",
        "name":  "爆款裙摆主图：双手轻展开裙摆，肩颈打开，表情自信",
        "prompt":  "high-click hero dress pose, both hands gently spreading skirt outward just enough to show skirt volume, open shoulders, elongated neck, confident soft expression, full dress silhouette readable, waistline and fabric texture clear"
    },
    {
        "id":  "207",
        "name":  "爆款法式轻提裙：一手提前侧裙摆，一手扶腰，单腿前探",
        "prompt":  "french vintage dress hero pose, one hand lifting the front side of the skirt to reveal drape and hem, the other hand on waist, one foot stepping forward, natural elegant movement, product details bright and readable"
    },
    {
        "id":  "208",
        "name":  "爆款回头摆裙：半转身回眸，裙摆轻微外甩",
        "prompt":  "half-turn looking-back pose with subtle skirt swish, head turned softly toward camera, one hand lightly holding skirt, the other arm relaxed, graceful motion capture, romantic palace dress styling"
    },
    {
        "id":  "209",
        "name":  "爆款庭院坐姿：侧坐长椅/同风格座面，手放扶手，裙摆铺开",
        "prompt":  "palace garden seated hero pose on a same-style bench or seat if the scene supports it, legs placed gracefully to one side, one hand resting on armrest or seat edge, the other smoothing skirt, skirt spread elegantly, upright relaxed posture"
    },
    {
        "id":  "210",
        "name":  "爆款优雅坐姿：双腿侧放，身体微侧，手轻搭膝上",
        "prompt":  "elegant seated pose with legs placed to one side, torso slightly angled, both hands resting softly on knees or skirt, neckline and waistline visible, calm confident expression, no stiff expression"
    },
    {
        "id":  "211",
        "name":  "爆款桌边坐姿：单手轻搭同风格小桌边，另一手整理裙摆",
        "prompt":  "french vintage seated table-side pose using only a same-style small table or edge if it belongs to the scene DNA, one hand lightly resting on the edge, the other hand arranging skirt, relaxed noble garden mood, realistic contact and shadows"
    },
    {
        "id":  "212",
        "name":  "爆款椅边倚坐：身体半倚座边，肩颈舒展，裙摆自然落下",
        "prompt":  "elegant half-sitting pose on the edge of a same-style chair or bench, torso upright and relaxed, shoulders open, skirt falling naturally, one hand on seat edge for believable support, refined french court mood"
    },
    {
        "id":  "213",
        "name":  "爆款窗边半身：手扶锁骨，另一手轻压腰线，柔光照亮肤色",
        "prompt":  "half-body french window-light pose, one hand touching collarbone, the other hand lightly defining waistline, soft flattering light on skin, relaxed confident gaze, neckline and upper dress details clear"
    },
    {
        "id":  "214",
        "name":  "爆款肩颈特写：侧脸微抬，手指轻触肩带/领口",
        "prompt":  "close upper-body pose for neckline detail, face angled slightly upward, fingers lightly touching strap or neckline, elegant shoulder-neck line, soft expression, fabric and neckline details sharp"
    },
    {
        "id":  "215",
        "name":  "爆款侧身收腰：身体45度，手掌贴腰线，另一手自然垂落",
        "prompt":  "45-degree side-angle waist-emphasis pose, one palm placed along waistline to show fitted cut, the other arm relaxed, weight shifted onto back leg, skirt silhouette readable, poised confident mood"
    },
    {
        "id":  "216",
        "name":  "爆款手拿小包：双手轻握小包在身前，肩膀放松",
        "prompt":  "elegant handbag-front pose, both hands softly holding a small bag in front of waist, shoulders relaxed, legs softly crossed, dress bodice and waist still visible, refined sweet french vintage styling"
    },
    {
        "id":  "217",
        "name":  "爆款单手拎包：一手自然拎包，一手拨发，身体微侧",
        "prompt":  "one-hand handbag pose, one hand carrying bag naturally at side, the other hand brushing hair, slight three-quarter body angle, soft confident smile, product silhouette unobstructed"
    },
    {
        "id":  "218",
        "name":  "爆款法式扶帽/扶发：一手轻扶发顶，另一手提裙摆",
        "prompt":  "romantic french styling pose, one hand lightly touching hair near crown as if adjusting hair or hat, the other hand lifting skirt hem, relaxed eyes, elegant court dress mood, no forced stiff smile"
    },
    {
        "id":  "219",
        "name":  "爆款花园漫步：斜向慢走，手提裙摆，回头微笑",
        "prompt":  "diagonal slow walking pose in palace garden or same-style room, one hand lightly lifting skirt, head looking back with soft confident smile, skirt moving naturally, clear waistline and hem"
    },
    {
        "id":  "220",
        "name":  "爆款台阶/地面层次：一脚前探，裙摆形成层次，手扶墙面",
        "prompt":  "elegant step-forward pose with one foot forward, skirt creating layered drape, one hand touching existing wall or same-style support surface for balance, realistic support, product not hidden in shadow"
    },
    {
        "id":  "221",
        "name":  "爆款红唇自信：正面轻侧头，一手扶腰，一手自然碰裙",
        "prompt":  "confident french vintage hero pose, front-facing with slight head tilt, one hand on waist, the other hand lightly touching skirt, relaxed red-lip editorial mood, elegant but approachable expression"
    },
    {
        "id":  "222",
        "name":  "爆款柔光靠窗：肩部靠近窗帘/墙面，手臂自然弯曲",
        "prompt":  "soft light curtain-side leaning pose, shoulder close to existing curtain-side wall or vertical surface, arms naturally bent, body relaxed with real support, romantic soft highlights, avoid muddy skin tone"
    },
    {
        "id":  "223",
        "name":  "爆款展示袖型：双臂微抬形成弧线，突出泡袖/袖口",
        "prompt":  "sleeve-display pose, both arms slightly lifted in a soft curved line to show puff sleeves or sleeve cuffs, shoulders relaxed, waistline visible, elegant non-stiff posture"
    },
    {
        "id":  "224",
        "name":  "爆款领口展示：一手扶领口，一手贴腰，身体微侧",
        "prompt":  "neckline-display pose, one hand lightly touching neckline, the other hand near waist, slight body angle, collarbone and bodice details clear, refined romantic expression"
    },
    {
        "id":  "225",
        "name":  "爆款修长站姿：交叉腿站立，手轻扶墙，头微偏",
        "prompt":  "elongated crossed-leg standing pose, one hand lightly touching existing wall or same-style vertical support, head tilted softly, long dress line emphasized, believable contact shadow"
    },
    {
        "id":  "226",
        "name":  "爆款半靠半站：臀部轻靠同风格台面/墙边，裙摆垂顺",
        "prompt":  "half-leaning half-standing pose using a same-style wall edge or low support if physically needed, hips lightly supported, skirt falling smoothly, one hand on waist, elegant palace vintage mood"
    },
    {
        "id":  "227",
        "name":  "爆款侧坐回眸：侧坐，头回看，手整理裙摆",
        "prompt":  "side-seated looking-back pose, head turned toward camera, one hand arranging skirt, the other hand resting on seat edge, elegant posture, skirt spread readable, confident soft expression"
    },
    {
        "id":  "228",
        "name":  "爆款低头整理：低头看裙摆，双手轻抚面料，温柔不僵硬",
        "prompt":  "gentle dress-adjusting pose, gaze lowered toward skirt, both hands softly smoothing fabric, relaxed shoulders, tender natural emotion, fabric texture and print clearly displayed"
    },
    {
        "id":  "229",
        "name":  "爆款高贵扶椅：单手轻扶同风格椅背，身体微转",
        "prompt":  "noble chair-back support pose using only a same-style chair if it fits the scene DNA, one hand lightly resting on chair back, body slightly turned, dress front readable, no copied action-reference furniture"
    },
    {
        "id":  "230",
        "name":  "爆款宫廷花园主图：坐姿靠扶手，裙摆铺开，眼神自信",
        "prompt":  "royal french garden hero seated pose, body upright with one arm resting on same-style armrest or bench support, skirt spread elegantly across seat and lower frame, confident calm gaze, premium palace romantic ecommerce image"
    }
] as const;

export const SURI_MIRA_POSES: SuriMiraPose[] = SURI_MIRA_POSE_ITEMS
  .filter((item) => Number(item.id) >= 201)
  .map((item) => ({
  id: item.id,
  name: item.name,
  prompt: `${item.prompt}, ${SURI_MIRA_FRAME}`,
}));
