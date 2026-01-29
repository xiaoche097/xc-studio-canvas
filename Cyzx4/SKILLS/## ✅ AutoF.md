## ✅ AutoFusion™ Pro V4.1 完整版（多产品支持）

markdown
**SYSTEM**: AutoFusion™ Pro V4.1 - Automotive Interior Visualization Engine

---

## 🎯 MISSION

Generate a photorealistic commercial photograph of a **${year} ${carModel}** interior with the user's **[${productCategory}]** (Reference Images 1-${productImages.length}) professionally installed.

---

## 📐 CAMERA CONTROL [PRIORITY: MAXIMUM]

**ANGLE_ID**: ${angleId}
**CAMERA INSTRUCTION**: ${anglePrompt}

> ⚠️ This camera angle is LOCKED. Output MUST match this exact perspective regardless of other parameters.

---

## 🚗 VEHICLE DECODE

| Attribute | Value |
|-----------|-------|
| Model | ${carModel} |
| Year | ${year} |
| Seat Config | ${seatConfig} |
| Target Area | ${targetArea} |

**IDENTIFICATION PROTOCOL**:

- Analyze "${year} ${carModel}" to extract OEM interior DNA
- Mandatory accurate features: Dashboard layout, Screen size/shape, Air vent design, Steering wheel style, Center console geometry
- If "${seatConfig}" specifies trim (e.g. Captain Seats, Bench), match seat geometry exactly

---

## 🎨 COLOR PROTOCOL [STRICT]

| Zone | Color Rule |
|------|------------|
| Dashboard | PURE BLACK |
| Door Panels | PURE BLACK / DARK GREY |
| Carpet & Floor | BLACK |
| Headliner | DARK GREY |
| Plastic Trim | BLACK (matte/gloss per OEM) |
| Steering Wheel | BLACK |
| **PRODUCT (${productCategory})** | ⛔ **ORIGINAL COLORS ONLY - NO MODIFICATION** |

**TEXTURE MANDATE**: Even in black, render distinct material textures:

- Leather grain ≠ Plastic matte ≠ Piano black gloss ≠ Alcantara suede

---

## 🛠️ PRODUCT INSTALLATION [CORE SKILL]

### PLACEMENT LOGIC

${placementLogic}

### PHYSICAL REALISM CHECKLIST

${realismChecklist}

### STATE RENDERING

${stateRendering}

---

## 💡 LIGHTING SETUP

┌─────────────────────────────────────┐
│         ☀️ KEY LIGHT               │
│         (Soft diffused, upper front)│
│                 ↓                   │
│    ┌───────────────────────────────┐│
│    │                               ││
│ 💡 │        🚗 VEHICLE            │💡│
│FILL│                               │FILL
│    │                               ││
│    └───────────────────────────────┘│
│                                     │
│         Color Temp: 5500K          │
│         Style: Commercial Studio   │
└─────────────────────────────────────┘

- **Key**: Soft diffused from upper front (70% intensity)
- **Fill**: Both sides to eliminate harsh shadows (30% intensity)
- **Accent**: Subtle rim light on product edges for depth
- **Environment**: Pure white cyclorama / Neutral grey studio

---

## 🏷️ BRAND DNA ADAPTATION

| Brand | Interior Style Keywords |
|-------|------------------------|
| Tesla | Tech-minimalist, floating screen, yoke/round steering |
| Mercedes | Luxury-organic, curved displays, turbine vents |
| BMW | Driver-focused, angled console, digital gauges |
| Audi | Clean-geometric, horizontal lines, virtual cockpit |
| Ford | Rugged-functional, physical controls, bold shapes |
| Toyota | Practical-ergonomic, logical layout, durable materials |
| Porsche | Sport-heritage, center tach, rising console |

Apply "${carModel}" brand DNA to all non-product interior elements.

---

## 📤 OUTPUT SPECIFICATION

| Parameter | Value |
|-----------|-------|
| Aspect Ratio | 4:3 |
| Resolution | Maximum detail |
| Style | Commercial product photography |
| Realism | Photorealistic, NOT 3D render |
| Background | White studio (visible through windows) |

---

## 🚫 NEGATIVE CONSTRAINTS

**MUST AVOID**:

- ❌ Cartoonish or illustrated style
- ❌ Incorrect geometry for specified model
- ❌ Product color alteration or bleeding
- ❌ Oversaturated environment colors
- ❌ Low resolution textures
- ❌ Distorted logos or badges
- ❌ Floating/uninstalled product appearance
- ❌ Wrong camera angle (MUST match ${angleId})
- ❌ 3D render aesthetic (must look like real photo)

---

## 🔄 EXECUTION SEQUENCE

1. LOCK camera to ${anglePrompt}
2. DECODE ${year} ${carModel} interior features
3. RENDER interior in BLACK (textures visible)
4. MAP product images onto ${targetArea}
5. APPLY installation realism per product type
6. SETUP studio lighting (5500K)
7. VERIFY angle matches ${angleId} reference
8. OUTPUT final image

---

## ⚙️ 动态变量配置

javascript
const productConfig = {

"Seat Cover": {
targetArea: "${targetRow} seats",
placementLogic: ` - Install seat cover on ${targetRow} seats - Cover wraps around seat foam contours - Headrest cover aligned with headrest shape - Seatback and cushion covers properly fitted`,
realismChecklist: ` - [ ] Tension wrinkles where material pulls tight over seat foam - [ ] Natural fabric folds at contour transitions - [ ] Proper edge tucking into seat crevices - [ ] Visible stitching matching reference images - [ ] Headrest/armrest cutouts aligned correctly`,
stateRendering: ` - If product name contains "Folded" → Render seat in folded position - If product name contains "Reclined" → Render seatback tilted back - If product name contains "Lifted" → Render seat cushion in raised state`,
anglePresets: {
"S1": {"name": "正面视角", "prompt": "shot from directly in front, camera at seat height, centered composition"},
"S2": {"name": "3/4侧前", "prompt": "shot from front-left at 40 degree angle, slightly elevated camera, three-quarter view"},
"S3": {"name": "后3/4视角", "prompt": "shot from rear-left at 135 degree angle, showing seat back, three-quarter rear view"},
"SET1": {"name": "侧面-左", "prompt": "shot from left side at 90 degrees, full seat set in frame, straight-on side view"},
"SET2": {"name": "侧面-右", "prompt": "shot from right side at 90 degrees, full seat set in frame, straight-on side view"},
"F1": {"name": "俯视45°", "prompt": "shot from above front-right at 45 degree downward angle, bird's eye perspective, interior visible"},
"F2": {"name": "驾驶侧平视", "prompt": "shot from driver door side, eye-level, profile view of driver seat and dashboard"},
"F3": {"name": "乘客侧斜前", "prompt": "shot from passenger side front-quarter, doors removed, showing front cabin interior"},
"F4": {"name": "后排向前视角", "prompt": "shot from rear seat position looking forward, interior POV, front seat backs visible"},
"R1": {"name": "后排正面特写", "prompt": "shot facing rear bench directly, close-up, all three headrests visible"},
"R2": {"name": "后排左侧", "prompt": "shot from left rear door position, rear seat side view, interior visible"},
"R3": {"name": "后排右侧", "prompt": "shot from right rear door position, rear seat side view, interior visible"},
"R4": {"name": "后排折叠状态", "prompt": "shot from right side, rear seat cushion folded up, mechanism visible"},
"R5": {"name": "俯视放倒", "prompt": "shot from above at 60 degree angle, looking down into cabin, seats reclined"},
"R6": {"name": "后侧3/4", "prompt": "shot from rear-right at 150 degree angle, rear cabin and seats visible"}
}
},

"Armrest Box": {
targetArea: "center console",
placementLogic: ` - Install armrest box on center console between front seats - Product base sits flush on console surface - Cup holders and storage slots face upward - Side pockets accessible from driver/passenger sides`,
realismChecklist: ` - [ ] Product sits flush and stable on center console surface - [ ] Cup holders and compartments properly aligned and level - [ ] Quilted leather texture matches reference exactly - [ ] Side pockets and tissue dispenser positioned correctly - [ ] Product lighting matches car interior environment`,
stateRendering: ` - If product name contains "Open" → Render lid in open position - If product name contains "With Items" → Display cups/phone/tissue on top - If product name contains "Tissue Pull" → Show hand pulling tissue from dispenser`,
anglePresets: {
"A0": {"name": "单品正面视角", "prompt": "shot from directly in front, camera at product height, centered composition"},
"A1": {"name": "单品3/4视角", "prompt": "shot from front-left at 45 degree angle, elevated camera, showing top and side"},
"A2": {"name": "俯视60°", "prompt": "shot from above at 60 degree angle, looking down at center console"},
"A3": {"name": "副驾侧平视", "prompt": "shot from passenger side, eye-level, profile view of center console"},
"A4": {"name": "副驾侧前30°", "prompt": "shot from passenger side front-quarter at 30 degree angle, slightly elevated"},
"A5": {"name": "副驾正侧面", "prompt": "shot from passenger side at 90 degrees, eye-level, straight-on side view"},
"A6": {"name": "副驾侧含方向盘", "prompt": "shot from passenger side at eye-level, steering wheel in frame"},
"A7": {"name": "俯视后侧50°特写", "prompt": "shot from above rear-quarter at 50 degree angle, close-up on armrest"},
"A8": {"name": "俯视45°", "prompt": "shot from above at 45 degree angle, top-down view of center console"},
"A9": {"name": "后排向前视角", "prompt": "shot from rear seat looking forward, center console between front seats"}
}
}

};

---

## 🎯 调用示例（Python）

python
def build_prompt(year, car_model, product_category, seat_config, angle_id, product_image_count):

```
config = {
    "Seat Cover": {
        "target_area": "front/rear seats",
        "placement_logic": """
```

- Install seat cover on target seats
- Cover wraps around seat foam contours
- Headrest cover aligned with headrest shape""",
  "realism_checklist": """

- [ ] Tension wrinkles where material pulls tight over seat foam
- [ ] Natural fabric folds at contour transitions
- [ ] Proper edge tucking into seat crevices
- [ ] Headrest/armrest cutouts aligned correctly""",
  "state_rendering": """

- If "Folded" → seat in folded position
- If "Reclined" → seatback tilted back""",
  "angles": {
  "S1": "shot from directly in front, camera at seat height, centered composition",
  "S2": "shot from front-left at 40 degree angle, slightly elevated camera, three-quarter view",
  "S3": "shot from rear-left at 135 degree angle, showing seat back, three-quarter rear view",
  "SET1": "shot from left side at 90 degrees, full seat set in frame, straight-on side view",
  "SET2": "shot from right side at 90 degrees, full seat set in frame, straight-on side view",
  "F1": "shot from above front-right at 45 degree downward angle, bird's eye perspective, interior visible",
  "F2": "shot from driver door side, eye-level, profile view of driver seat and dashboard",
  "F3": "shot from passenger side front-quarter, doors removed, showing front cabin interior",
  "F4": "shot from rear seat position looking forward, interior POV, front seat backs visible",
  "R1": "shot facing rear bench directly, close-up, all three headrests visible",
  "R2": "shot from left rear door position, rear seat side view, interior visible",
  "R3": "shot from right rear door position, rear seat side view, interior visible",
  "R4": "shot from right side, rear seat cushion folded up, mechanism visible",
  "R5": "shot from above at 60 degree angle, looking down into cabin, seats reclined",
  "R6": "shot from rear-right at 150 degree angle, rear cabin and seats visible"
  }
  },
  "Armrest Box": {
  "target_area": "center console",
  "placement_logic": """
- Install armrest box on center console between front seats
- Product base sits flush on console surface
- Cup holders and storage slots face upward""",
  "realism_checklist": """

- [ ] Product sits flush and stable on center console surface
- [ ] Cup holders and compartments properly aligned
- [ ] Quilted leather texture matches reference exactly
- [ ] Side pockets and tissue dispenser positioned correctly""",
  "state_rendering": """

- If "Open" → lid in open position
- If "With Items" → cups/phone/tissue displayed on top
- If "Tissue Pull" → hand pulling tissue from dispenser""",
  "angles": {
  "A0": "shot from directly in front, camera at product height, centered composition",
  "A1": "shot from front-left at 45 degree angle, elevated camera, showing top and side",
  "A2": "shot from above at 60 degree angle, looking down at center console",
  "A3": "shot from passenger side, eye-level, profile view of center console",
  "A4": "shot from passenger side front-quarter at 30 degree angle, slightly elevated",
  "A5": "shot from passenger side at 90 degrees, eye-level, straight-on side view",
  "A6": "shot from passenger side at eye-level, steering wheel in frame",
  "A7": "shot from above rear-quarter at 50 degree angle, close-up on armrest",
  "A8": "shot from above at 45 degree angle, top-down view of center console",
  "A9": "shot from rear seat looking forward, center console between front seats"
  }
  }
  }
  
  c = config[product_category]
  angle_prompt = c["angles"][angle_id]
  
  prompt = f"""
  **MISSION**: Generate photorealistic commercial photo of {year} {car_model} interior with [{product_category}] installed.

**CAMERA ANGLE [LOCKED]**: {angle_prompt}

**VEHICLE**: {year} {car_model}, {seat_config}, Target: {c["target_area"]}

**PLACEMENT**:
{c["placement_logic"]}

**REALISM**:
{c["realism_checklist"]}

**STATE**:
{c["state_rendering"]}

**RULES**:

1. Decode {car_model} {year} OEM interior accurately
2. ALL interior surfaces = PURE BLACK/DARK GREY (keep textures visible)
3. PRODUCT COLORS = ORIGINAL from reference images (NO modification)
4. Lighting: Studio setup, 5500K, soft key + fill lights

**OUTPUT**: 4:3, high resolution, commercial photography, white studio background

**AVOID**: Cartoon style, wrong shapes, color bleeding, 3D render look, wrong camera angle
"""
return prompt

# 座椅套调用

prompt = build_prompt(
year="2021",
car_model="Ford Bronco",
product_category="Seat Cover",
seat_config="5-Seat",
angle_id="F1",
product_image_count=9
)

# 扶手箱调用

prompt = build_prompt(
year="2024",
car_model="Tesla Model Y",
product_category="Armrest Box",
seat_config="5-Seat",
angle_id="A5",
product_image_count=10
)

---

完成！座椅套和扶手箱可以共用同一套提示词框架，通过 `product_category` 自动切换配置。

