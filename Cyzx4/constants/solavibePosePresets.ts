export interface SolavibePose {
  id: string;
  name: string;
  prompt: string;
}

const SOLAVIBE_FRAME =
  "Solavibe high-click plus-size vacation and boho comfort pose library, confident relaxed curvy-friendly feminine posture, resort dress / relaxed set / wide-leg pants / vacation shirt styling, product silhouette readable, waistline, sleeves, hem, fabric drape and comfortable fit clearly displayed, warm SHEIN-style ecommerce hero-image framing, no stiff mannequin pose";

const SOLAVIBE_POSE_ITEMS = [
  {
    "id": "001",
    "name": "Solavibe 001",
    "prompt": "front-facing standing pose, one hand on waist, the other arm relaxed naturally, confident plus-size vacation dress pose"
  },
  {
    "id": "002",
    "name": "Solavibe 002",
    "prompt": "slight three-quarter standing pose, one hand on waist, emphasizing waistline and relaxed feminine silhouette"
  },
  {
    "id": "003",
    "name": "Solavibe 003",
    "prompt": "three-quarter body angle, weight shifted onto one leg, relaxed boho summer dress posture"
  },
  {
    "id": "004",
    "name": "Solavibe 004",
    "prompt": "front-facing standing pose, both arms relaxed naturally, clean product-focused pose"
  },
  {
    "id": "005",
    "name": "Solavibe 005",
    "prompt": "front-facing standing pose, feet slightly apart, comfortable confident stance"
  },
  {
    "id": "006",
    "name": "Solavibe 006",
    "prompt": "front-facing standing pose, one foot slightly forward, flattering body line"
  },
  {
    "id": "007",
    "name": "Solavibe 007",
    "prompt": "slight angled standing pose, one foot slightly behind, relaxed curve-enhancing pose"
  },
  {
    "id": "008",
    "name": "Solavibe 008",
    "prompt": "both hands on waist, confident plus-size summer styling"
  },
  {
    "id": "009",
    "name": "Solavibe 009",
    "prompt": "one hand on waist, the other hand lightly touching skirt, soft vacation dress display"
  },
  {
    "id": "010",
    "name": "Solavibe 010",
    "prompt": "one hand placed near waist-hip line, flattering relaxed silhouette"
  },
  {
    "id": "011",
    "name": "Solavibe 011",
    "prompt": "one hand inside dress pocket, relaxed practical summer dress pose"
  },
  {
    "id": "012",
    "name": "Solavibe 012",
    "prompt": "both hands inside pockets, comfortable casual dress display"
  },
  {
    "id": "013",
    "name": "Solavibe 013",
    "prompt": "hands in pockets, slight three-quarter angle, relaxed confident mood"
  },
  {
    "id": "014",
    "name": "Solavibe 014",
    "prompt": "hands in pockets, looking downward softly, calm summer lifestyle pose"
  },
  {
    "id": "015",
    "name": "Solavibe 015",
    "prompt": "hands in pockets, looking into distance, relaxed vacation mood"
  },
  {
    "id": "016",
    "name": "Solavibe 016",
    "prompt": "hands in pockets, looking back over shoulder, casual high-click dress pose"
  },
  {
    "id": "017",
    "name": "Solavibe 017",
    "prompt": "both hands lightly holding both sides of skirt, showing skirt volume"
  },
  {
    "id": "018",
    "name": "Solavibe 018",
    "prompt": "one hand lightly lifting skirt hem, soft feminine vacation dress movement"
  },
  {
    "id": "019",
    "name": "Solavibe 019",
    "prompt": "one hand lifting skirt, the other hand on waist, flattering hero pose"
  },
  {
    "id": "020",
    "name": "Solavibe 020",
    "prompt": "both hands gently spreading skirt outward, full skirt display"
  },
  {
    "id": "021",
    "name": "Solavibe 021",
    "prompt": "both hands gently smoothing skirt fabric, soft product-detail gesture"
  },
  {
    "id": "022",
    "name": "Solavibe 022",
    "prompt": "one hand softly pressing skirt edge, controlled elegant pose"
  },
  {
    "id": "023",
    "name": "Solavibe 023",
    "prompt": "one hand gathering skirt fabric lightly, emphasizing drape and texture"
  },
  {
    "id": "024",
    "name": "Solavibe 024",
    "prompt": "looking down softly at skirt, gentle boho feminine mood"
  },
  {
    "id": "025",
    "name": "Solavibe 025",
    "prompt": "looking back softly while holding skirt, romantic summer dress pose"
  },
  {
    "id": "026",
    "name": "Solavibe 026",
    "prompt": "gentle skirt-swinging motion, soft summer movement"
  },
  {
    "id": "027",
    "name": "Solavibe 027",
    "prompt": "gentle in-place skirt sway, relaxed plus-size vacation styling"
  },
  {
    "id": "028",
    "name": "Solavibe 028",
    "prompt": "light twirl in place, skirt lifting softly, happy summer mood"
  },
  {
    "id": "029",
    "name": "Solavibe 029",
    "prompt": "half-turn pose, skirt spreading naturally, soft movement capture"
  },
  {
    "id": "030",
    "name": "Solavibe 030",
    "prompt": "turning pose while looking back softly, relaxed vacation dress campaign"
  },
  {
    "id": "031",
    "name": "Solavibe 031",
    "prompt": "after-turn paused pose, skirt still moving softly"
  },
  {
    "id": "032",
    "name": "Solavibe 032",
    "prompt": "walking pose with skirt moving naturally, breezy summer dress display"
  },
  {
    "id": "033",
    "name": "Solavibe 033",
    "prompt": "slow walking toward camera, relaxed confident vacation movement"
  },
  {
    "id": "034",
    "name": "Solavibe 034",
    "prompt": "walking pose with one hand on waist, showing dress shape"
  },
  {
    "id": "035",
    "name": "Solavibe 035",
    "prompt": "walking pose with one hand lifting skirt slightly, practical summer movement"
  },
  {
    "id": "036",
    "name": "Solavibe 036",
    "prompt": "walking pose, both arms relaxed naturally, casual everyday styling"
  },
  {
    "id": "037",
    "name": "Solavibe 037",
    "prompt": "walking pose while looking back softly, high-click lifestyle pose"
  },
  {
    "id": "038",
    "name": "Solavibe 038",
    "prompt": "walking pose with lowered gaze and soft smile, warm approachable mood"
  },
  {
    "id": "039",
    "name": "Solavibe 039",
    "prompt": "walking pose looking gently to the side, natural vacation energy"
  },
  {
    "id": "040",
    "name": "Solavibe 040",
    "prompt": "small graceful walking steps, comfortable summer dress movement"
  },
  {
    "id": "041",
    "name": "Solavibe 041",
    "prompt": "diagonal walking pose, body slightly angled, flattering silhouette"
  },
  {
    "id": "042",
    "name": "Solavibe 042",
    "prompt": "walking pose with handbag in one hand, relaxed holiday styling"
  },
  {
    "id": "043",
    "name": "Solavibe 043",
    "prompt": "walking pose with one hand lightly touching skirt, product-focused movement"
  },
  {
    "id": "044",
    "name": "Solavibe 044",
    "prompt": "walking pose with one hand brushing hair, soft feminine lifestyle pose"
  },
  {
    "id": "045",
    "name": "Solavibe 045",
    "prompt": "walking pose with one hand touching hat brim, beach vacation feeling"
  },
  {
    "id": "046",
    "name": "Solavibe 046",
    "prompt": "walking pose holding straw hat naturally, boho summer vacation mood"
  },
  {
    "id": "047",
    "name": "Solavibe 047",
    "prompt": "front-facing pose, one hand touching collarbone, highlighting neckline"
  },
  {
    "id": "048",
    "name": "Solavibe 048",
    "prompt": "slight angled pose, one hand touching neckline softly, clean upper-body detail"
  },
  {
    "id": "049",
    "name": "Solavibe 049",
    "prompt": "one hand lightly touching shoulder strap, showing strap and neckline design"
  },
  {
    "id": "050",
    "name": "Solavibe 050",
    "prompt": "one hand touching side of face softly, gentle approachable expression"
  },
  {
    "id": "051",
    "name": "Solavibe 051",
    "prompt": "one hand near ear, soft feminine portrait pose"
  },
  {
    "id": "052",
    "name": "Solavibe 052",
    "prompt": "one hand brushing hair naturally, relaxed summer mood"
  },
  {
    "id": "053",
    "name": "Solavibe 053",
    "prompt": "both hands softly adjusting hair, casual feminine lifestyle pose"
  },
  {
    "id": "054",
    "name": "Solavibe 054",
    "prompt": "standing pose with slight head tilt, sweet relaxed expression"
  },
  {
    "id": "055",
    "name": "Solavibe 055",
    "prompt": "standing pose with lowered gaze, soft comfortable mood"
  },
  {
    "id": "056",
    "name": "Solavibe 056",
    "prompt": "standing pose looking into distance, calm vacation atmosphere"
  },
  {
    "id": "057",
    "name": "Solavibe 057",
    "prompt": "eyes closed softly, relaxed warm sunlight pose"
  },
  {
    "id": "058",
    "name": "Solavibe 058",
    "prompt": "looking back over shoulder, showing backline and relaxed body curve"
  },
  {
    "id": "059",
    "name": "Solavibe 059",
    "prompt": "back view pose with head turned sideways, showing back design"
  },
  {
    "id": "060",
    "name": "Solavibe 060",
    "prompt": "back view pose, both arms relaxed, clean dress back display"
  },
  {
    "id": "061",
    "name": "Solavibe 061",
    "prompt": "back view pose, one hand on waist, emphasizing waist and back shape"
  },
  {
    "id": "062",
    "name": "Solavibe 062",
    "prompt": "side-profile standing pose, showing dress silhouette and length"
  },
  {
    "id": "063",
    "name": "Solavibe 063",
    "prompt": "left side standing pose, head facing forward, clean side view"
  },
  {
    "id": "064",
    "name": "Solavibe 064",
    "prompt": "right side standing pose, one hand on waist, flattering profile display"
  },
  {
    "id": "065",
    "name": "Solavibe 065",
    "prompt": "half-body front pose, one hand touching collarbone, neckline focus"
  },
  {
    "id": "066",
    "name": "Solavibe 066",
    "prompt": "half-body angled pose, one hand touching side of face, soft portrait feeling"
  },
  {
    "id": "067",
    "name": "Solavibe 067",
    "prompt": "half-body pose, one hand touching neckline, showing upper garment detail"
  },
  {
    "id": "068",
    "name": "Solavibe 068",
    "prompt": "half-body pose, one hand brushing hair away, clean neckline display"
  },
  {
    "id": "069",
    "name": "Solavibe 069",
    "prompt": "half-body pose, both hands lightly near upper waistline, fitted dress display"
  },
  {
    "id": "070",
    "name": "Solavibe 070",
    "prompt": "half-body pose with softly crossed arms, confident relaxed mood"
  },
  {
    "id": "071",
    "name": "Solavibe 071",
    "prompt": "half-body pose, one hand holding opposite arm, soft refined gesture"
  },
  {
    "id": "072",
    "name": "Solavibe 072",
    "prompt": "for square-neck dress, both arms relaxed to emphasize neckline and shoulders"
  },
  {
    "id": "073",
    "name": "Solavibe 073",
    "prompt": "for square-neck dress, one hand touching collarbone, soft elegant pose"
  },
  {
    "id": "074",
    "name": "Solavibe 074",
    "prompt": "for spaghetti strap dress, one hand touching strap softly, summer dress focus"
  },
  {
    "id": "075",
    "name": "Solavibe 075",
    "prompt": "for halter dress, one hand softly near neck, showing halter neckline"
  },
  {
    "id": "076",
    "name": "Solavibe 076",
    "prompt": "for backless dress, back view pose looking over shoulder, showing back design"
  },
  {
    "id": "077",
    "name": "Solavibe 077",
    "prompt": "for tie-back dress, half-back angled pose, showing back tie detail"
  },
  {
    "id": "078",
    "name": "Solavibe 078",
    "prompt": "for V-neck dress, one hand touching neckline naturally, elegant upper-body display"
  },
  {
    "id": "079",
    "name": "Solavibe 079",
    "prompt": "for strapless dress, both arms relaxed to emphasize shoulder and neckline"
  },
  {
    "id": "080",
    "name": "Solavibe 080",
    "prompt": "for strapless dress, one hand on waist, confident summer party pose"
  },
  {
    "id": "081",
    "name": "Solavibe 081",
    "prompt": "for ruffle dress, one hand lightly touching ruffle edge, soft product detail"
  },
  {
    "id": "082",
    "name": "Solavibe 082",
    "prompt": "for floral A-line dress, one hand lifting skirt hem, romantic vacation pose"
  },
  {
    "id": "083",
    "name": "Solavibe 083",
    "prompt": "for floral A-line dress, both hands spreading skirt outward, high-click dress display"
  },
  {
    "id": "084",
    "name": "Solavibe 084",
    "prompt": "for floral maxi dress, slight three-quarter standing pose, relaxed boho mood"
  },
  {
    "id": "085",
    "name": "Solavibe 085",
    "prompt": "for floral maxi dress, walking pose while looking back softly"
  },
  {
    "id": "086",
    "name": "Solavibe 086",
    "prompt": "for polka dot dress, light turning pose, playful vintage summer feeling"
  },
  {
    "id": "087",
    "name": "Solavibe 087",
    "prompt": "for plaid dress, one hand on waist, sweet casual summer styling"
  },
  {
    "id": "088",
    "name": "Solavibe 088",
    "prompt": "for puff-sleeve dress, arms relaxed to show sleeve volume clearly"
  },
  {
    "id": "089",
    "name": "Solavibe 089",
    "prompt": "for puff-sleeve dress, one hand on waist, emphasizing puff sleeves and waist"
  },
  {
    "id": "090",
    "name": "Solavibe 090",
    "prompt": "for side-slit dress, one foot slightly forward, showing slit naturally"
  },
  {
    "id": "091",
    "name": "Solavibe 091",
    "prompt": "for side-slit dress, slight side angle, showing leg opening and dress line"
  },
  {
    "id": "092",
    "name": "Solavibe 092",
    "prompt": "for drawstring waist dress, both hands near waistline, highlighting waist detail"
  },
  {
    "id": "093",
    "name": "Solavibe 093",
    "prompt": "for pocket dress, both hands in pockets, relaxed practical product display"
  },
  {
    "id": "094",
    "name": "Solavibe 094",
    "prompt": "for pocket dress, one hand in pocket, soft confident posture"
  },
  {
    "id": "095",
    "name": "Solavibe 095",
    "prompt": "for co-ord set, both hands in pockets, relaxed plus-size outfit styling"
  },
  {
    "id": "096",
    "name": "Solavibe 096",
    "prompt": "for co-ord set, one hand on waist, showing full outfit shape"
  },
  {
    "id": "097",
    "name": "Solavibe 097",
    "prompt": "for wide-leg pants set, one hand in pocket, relaxed vacation outfit pose"
  },
  {
    "id": "098",
    "name": "Solavibe 098",
    "prompt": "for wide-leg pants set, walking pose, pants moving naturally"
  },
  {
    "id": "099",
    "name": "Solavibe 099",
    "prompt": "beach vacation hero pose: slight three-quarter angle, one hand on waist, the other holding straw hat, weight on one leg, skirt naturally spread"
  },
  {
    "id": "100",
    "name": "Solavibe 100",
    "prompt": "Solavibe signature hero pose: three-quarter body angle, one hand on waist, the other hand lightly lifting skirt, natural soft smile, comfortable confident vacation mood"
  }
] as const;

export const SOLAVIBE_POSES: SolavibePose[] = SOLAVIBE_POSE_ITEMS.map((item) => ({
  id: item.id,
  name: item.name,
  prompt: `${item.prompt}, ${SOLAVIBE_FRAME}`,
}));
