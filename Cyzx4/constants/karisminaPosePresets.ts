export interface KarisminaPose {
  id: string;
  name: string;
  prompt: string;
}

const KARISMINA_FRAME =
  "KARISMINA high-click feminine dress pose library, romantic garden party / resort dress / elegant vacation styling, graceful ecommerce hero-image framing, product silhouette readable, neckline, waistline, sleeve, hem, fabric drape, print and texture clearly displayed, refined SHEIN fashion marketplace visual, natural confident feminine posture, no stiff mannequin pose";

const KARISMINA_POSE_ITEMS = [
  {
    "id": "001",
    "name": "KARISMINA 001",
    "prompt": "front-facing standing pose, one hand on waist, the other arm relaxed naturally, elegant feminine posture"
  },
  {
    "id": "002",
    "name": "KARISMINA 002",
    "prompt": "slight three-quarter standing pose, one hand on waist, emphasizing waistline and dress silhouette"
  },
  {
    "id": "003",
    "name": "KARISMINA 003",
    "prompt": "three-quarter body angle, weight shifted onto one leg, graceful vacation dress pose"
  },
  {
    "id": "004",
    "name": "KARISMINA 004",
    "prompt": "front-facing standing pose, both arms relaxed naturally, clean elegant product display"
  },
  {
    "id": "005",
    "name": "KARISMINA 005",
    "prompt": "front-facing pose, legs softly crossed, feminine garden party styling"
  },
  {
    "id": "006",
    "name": "KARISMINA 006",
    "prompt": "one foot slightly forward, skirt falling naturally, elegant long dress display"
  },
  {
    "id": "007",
    "name": "KARISMINA 007",
    "prompt": "one foot slightly behind, body softly angled, relaxed floral dress pose"
  },
  {
    "id": "008",
    "name": "KARISMINA 008",
    "prompt": "both hands lightly placed near waistline, highlighting fitted waist"
  },
  {
    "id": "009",
    "name": "KARISMINA 009",
    "prompt": "one hand on waist, the other hand touching skirt softly, romantic dress presentation"
  },
  {
    "id": "010",
    "name": "KARISMINA 010",
    "prompt": "one hand placed near waist-hip line, flattering feminine silhouette"
  },
  {
    "id": "011",
    "name": "KARISMINA 011",
    "prompt": "both hands lightly holding both sides of skirt, showing skirt volume"
  },
  {
    "id": "012",
    "name": "KARISMINA 012",
    "prompt": "one hand lifting skirt hem, the other hand on waist, elegant high-click dress pose"
  },
  {
    "id": "013",
    "name": "KARISMINA 013",
    "prompt": "one hand gently lifting front skirt hem, showing dress drape"
  },
  {
    "id": "014",
    "name": "KARISMINA 014",
    "prompt": "both hands gently spreading skirt outward, full skirt display"
  },
  {
    "id": "015",
    "name": "KARISMINA 015",
    "prompt": "one hand softly pressing skirt edge, controlled elegant pose"
  },
  {
    "id": "016",
    "name": "KARISMINA 016",
    "prompt": "both hands gently smoothing skirt fabric, soft product detail gesture"
  },
  {
    "id": "017",
    "name": "KARISMINA 017",
    "prompt": "looking down softly at the skirt, romantic feminine mood"
  },
  {
    "id": "018",
    "name": "KARISMINA 018",
    "prompt": "looking back softly while holding skirt, graceful floral dress movement"
  },
  {
    "id": "019",
    "name": "KARISMINA 019",
    "prompt": "one hand gathering skirt fabric lightly, emphasizing texture and volume"
  },
  {
    "id": "020",
    "name": "KARISMINA 020",
    "prompt": "gentle skirt swish motion, soft feminine movement"
  },
  {
    "id": "021",
    "name": "KARISMINA 021",
    "prompt": "light twirl in place, skirt lifting softly, romantic garden dress pose"
  },
  {
    "id": "022",
    "name": "KARISMINA 022",
    "prompt": "half-turn pose, skirt spreading naturally, elegant motion capture"
  },
  {
    "id": "023",
    "name": "KARISMINA 023",
    "prompt": "turning pose while looking back toward camera, sweet romantic expression"
  },
  {
    "id": "024",
    "name": "KARISMINA 024",
    "prompt": "after-turn paused pose, skirt still moving softly"
  },
  {
    "id": "025",
    "name": "KARISMINA 025",
    "prompt": "one hand lifting skirt while turning, graceful floral dress movement"
  },
  {
    "id": "026",
    "name": "KARISMINA 026",
    "prompt": "both hands lifting skirt while twirling, full skirt dynamic display"
  },
  {
    "id": "027",
    "name": "KARISMINA 027",
    "prompt": "standing pose with skirt moving softly in breeze, romantic vacation mood"
  },
  {
    "id": "028",
    "name": "KARISMINA 028",
    "prompt": "hair moving naturally in breeze, relaxed elegant dress pose"
  },
  {
    "id": "029",
    "name": "KARISMINA 029",
    "prompt": "walking pose with skirt moving naturally in wind, graceful summer dress movement"
  },
  {
    "id": "030",
    "name": "KARISMINA 030",
    "prompt": "gentle skirt-swaying pose, soft elegant feminine gesture"
  },
  {
    "id": "031",
    "name": "KARISMINA 031",
    "prompt": "slow walking toward camera, elegant holiday dress movement"
  },
  {
    "id": "032",
    "name": "KARISMINA 032",
    "prompt": "walking pose with one hand on waist, showing dress shape"
  },
  {
    "id": "033",
    "name": "KARISMINA 033",
    "prompt": "walking pose with one hand lifting skirt slightly, graceful product display"
  },
  {
    "id": "034",
    "name": "KARISMINA 034",
    "prompt": "walking pose, both arms relaxed naturally, clean vacation lookbook feeling"
  },
  {
    "id": "035",
    "name": "KARISMINA 035",
    "prompt": "walking pose while looking back softly, romantic dress campaign pose"
  },
  {
    "id": "036",
    "name": "KARISMINA 036",
    "prompt": "walking pose with lowered gaze and soft smile, sweet feminine mood"
  },
  {
    "id": "037",
    "name": "KARISMINA 037",
    "prompt": "walking pose while looking gently to the side, elegant garden party styling"
  },
  {
    "id": "038",
    "name": "KARISMINA 038",
    "prompt": "cross-step walking pose, refined feminine movement"
  },
  {
    "id": "039",
    "name": "KARISMINA 039",
    "prompt": "small graceful walking steps, soft romantic dress movement"
  },
  {
    "id": "040",
    "name": "KARISMINA 040",
    "prompt": "walking pose emphasizing wide skirt movement, high-click main image action"
  },
  {
    "id": "041",
    "name": "KARISMINA 041",
    "prompt": "paused walking pose while looking back, elegant motion freeze"
  },
  {
    "id": "042",
    "name": "KARISMINA 042",
    "prompt": "diagonal walking pose, body slightly angled, graceful feminine silhouette"
  },
  {
    "id": "043",
    "name": "KARISMINA 043",
    "prompt": "walking pose with handbag in one hand, elegant summer styling"
  },
  {
    "id": "044",
    "name": "KARISMINA 044",
    "prompt": "walking pose with one hand lightly touching skirt, soft product-focused movement"
  },
  {
    "id": "045",
    "name": "KARISMINA 045",
    "prompt": "walking pose with one hand brushing hair, romantic feminine expression"
  },
  {
    "id": "046",
    "name": "KARISMINA 046",
    "prompt": "front-facing pose, one hand touching collarbone, highlighting neckline"
  },
  {
    "id": "047",
    "name": "KARISMINA 047",
    "prompt": "slight angled pose, one hand touching neckline softly"
  },
  {
    "id": "048",
    "name": "KARISMINA 048",
    "prompt": "one hand lightly touching shoulder strap, elegant neckline display"
  },
  {
    "id": "049",
    "name": "KARISMINA 049",
    "prompt": "one hand touching side of face softly, feminine beauty pose"
  },
  {
    "id": "050",
    "name": "KARISMINA 050",
    "prompt": "one hand near ear, soft romantic half-body pose"
  },
  {
    "id": "051",
    "name": "KARISMINA 051",
    "prompt": "one hand brushing hair naturally, elegant floral dress mood"
  },
  {
    "id": "052",
    "name": "KARISMINA 052",
    "prompt": "both hands softly adjusting hair, romantic product portrait pose"
  },
  {
    "id": "053",
    "name": "KARISMINA 053",
    "prompt": "standing pose with slight head tilt, sweet elegant expression"
  },
  {
    "id": "054",
    "name": "KARISMINA 054",
    "prompt": "standing pose with lowered gaze, soft feminine mood"
  },
  {
    "id": "055",
    "name": "KARISMINA 055",
    "prompt": "standing pose looking into distance, elegant vacation feeling"
  },
  {
    "id": "056",
    "name": "KARISMINA 056",
    "prompt": "eyes closed softly, relaxed graceful feminine pose"
  },
  {
    "id": "057",
    "name": "KARISMINA 057",
    "prompt": "looking back over shoulder, graceful backline display"
  },
  {
    "id": "058",
    "name": "KARISMINA 058",
    "prompt": "back view pose with head turned sideways, showing back design"
  },
  {
    "id": "059",
    "name": "KARISMINA 059",
    "prompt": "back view pose, both arms relaxed, clean dress back display"
  },
  {
    "id": "060",
    "name": "KARISMINA 060",
    "prompt": "back view pose, one hand on waist, emphasizing waist and back detail"
  },
  {
    "id": "061",
    "name": "KARISMINA 061",
    "prompt": "side-profile standing pose, showing dress silhouette and length"
  },
  {
    "id": "062",
    "name": "KARISMINA 062",
    "prompt": "left side standing pose, head facing forward, elegant side view display"
  },
  {
    "id": "063",
    "name": "KARISMINA 063",
    "prompt": "right side standing pose, one hand on waist, refined dress profile"
  },
  {
    "id": "064",
    "name": "KARISMINA 064",
    "prompt": "half-body front pose, one hand touching collarbone, elegant neckline focus"
  },
  {
    "id": "065",
    "name": "KARISMINA 065",
    "prompt": "half-body angled pose, one hand touching side of face, soft romantic portrait"
  },
  {
    "id": "066",
    "name": "KARISMINA 066",
    "prompt": "half-body pose, one hand touching neckline, showing upper garment detail"
  },
  {
    "id": "067",
    "name": "KARISMINA 067",
    "prompt": "half-body pose, one hand brushing hair away, clean face and neckline display"
  },
  {
    "id": "068",
    "name": "KARISMINA 068",
    "prompt": "half-body pose, both hands lightly near upper waistline, fitted dress display"
  },
  {
    "id": "069",
    "name": "KARISMINA 069",
    "prompt": "half-body pose with softly crossed arms, elegant mature feminine mood"
  },
  {
    "id": "070",
    "name": "KARISMINA 070",
    "prompt": "half-body pose, one hand holding opposite arm, soft refined gesture"
  },
  {
    "id": "071",
    "name": "KARISMINA 071",
    "prompt": "for square-neck dress, both arms relaxed to emphasize neckline and shoulders"
  },
  {
    "id": "072",
    "name": "KARISMINA 072",
    "prompt": "for square-neck dress, one hand touching collarbone, soft elegant pose"
  },
  {
    "id": "073",
    "name": "KARISMINA 073",
    "prompt": "for spaghetti strap dress, one hand touching strap softly"
  },
  {
    "id": "074",
    "name": "KARISMINA 074",
    "prompt": "for halter dress, one hand softly near neck, showing halter neckline"
  },
  {
    "id": "075",
    "name": "KARISMINA 075",
    "prompt": "for backless dress, back view pose looking over shoulder"
  },
  {
    "id": "076",
    "name": "KARISMINA 076",
    "prompt": "for backless dress, half-back angled pose, showing back tie detail"
  },
  {
    "id": "077",
    "name": "KARISMINA 077",
    "prompt": "for tie-back dress, one hand lightly near back tie detail"
  },
  {
    "id": "078",
    "name": "KARISMINA 078",
    "prompt": "for V-neck dress, one hand touching neckline naturally"
  },
  {
    "id": "079",
    "name": "KARISMINA 079",
    "prompt": "for lace detail dress, arms relaxed to keep lace detail visible"
  },
  {
    "id": "080",
    "name": "KARISMINA 080",
    "prompt": "for ruffle dress, one hand lightly touching ruffle edge"
  },
  {
    "id": "081",
    "name": "KARISMINA 081",
    "prompt": "for floral full-skirt dress, one hand lifting skirt hem"
  },
  {
    "id": "082",
    "name": "KARISMINA 082",
    "prompt": "for floral full-skirt dress, both hands spreading skirt outward"
  },
  {
    "id": "083",
    "name": "KARISMINA 083",
    "prompt": "for floral maxi dress, slight three-quarter standing pose"
  },
  {
    "id": "084",
    "name": "KARISMINA 084",
    "prompt": "for floral maxi dress, walking pose while looking back softly"
  },
  {
    "id": "085",
    "name": "KARISMINA 085",
    "prompt": "garden party dress pose, one hand on waist, soft smile"
  },
  {
    "id": "086",
    "name": "KARISMINA 086",
    "prompt": "wedding guest dress pose, elegant standing posture, relaxed arms"
  },
  {
    "id": "087",
    "name": "KARISMINA 087",
    "prompt": "vacation dress pose, one hand holding small handbag naturally"
  },
  {
    "id": "088",
    "name": "KARISMINA 088",
    "prompt": "vacation dress pose, one hand touching hat brim softly"
  },
  {
    "id": "089",
    "name": "KARISMINA 089",
    "prompt": "vacation dress pose, one hand holding sunglasses naturally"
  },
  {
    "id": "090",
    "name": "KARISMINA 090",
    "prompt": "vacation dress pose, light walking movement, skirt flowing naturally"
  },
  {
    "id": "091",
    "name": "KARISMINA 091",
    "prompt": "for co-ord set, both hands in pockets, relaxed elegant styling"
  },
  {
    "id": "092",
    "name": "KARISMINA 092",
    "prompt": "for co-ord set, one hand in pocket, soft confident posture"
  },
  {
    "id": "093",
    "name": "KARISMINA 093",
    "prompt": "for co-ord set, one hand on waist, showing full outfit shape"
  },
  {
    "id": "094",
    "name": "KARISMINA 094",
    "prompt": "for jumpsuit, front-facing standing pose, clean full-body display"
  },
  {
    "id": "095",
    "name": "KARISMINA 095",
    "prompt": "for jumpsuit, one hand in pocket, relaxed elegant pose"
  },
  {
    "id": "096",
    "name": "KARISMINA 096",
    "prompt": "for jumpsuit, both hands in pockets, high-click product display"
  },
  {
    "id": "097",
    "name": "KARISMINA 097",
    "prompt": "for blouse or top, one hand lightly holding hem, showing fit and drape"
  },
  {
    "id": "098",
    "name": "KARISMINA 098",
    "prompt": "for blouse or top, one hand adjusting sleeve cuff naturally"
  },
  {
    "id": "099",
    "name": "KARISMINA 099",
    "prompt": "for bottoms, one hand on waist, showing waist-to-hem proportion"
  },
  {
    "id": "100",
    "name": "KARISMINA 100",
    "prompt": "slight three-quarter body angle, one hand on waist, the other hand lightly lifting skirt, weight on one leg, head slightly tilted, soft romantic elegant holiday dress mood"
  }
] as const;

export const KARISMINA_POSES: KarisminaPose[] = KARISMINA_POSE_ITEMS.map((item) => ({
  id: item.id,
  name: item.name,
  prompt: `${item.prompt}, ${KARISMINA_FRAME}`,
}));
