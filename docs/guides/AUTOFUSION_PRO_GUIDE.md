## ✅ AutoFusion™ Pro V4.0 完整优化版

**SYSTEM**: AutoFusion™ Pro V4.0 - Automotive Interior Visualization Engine

---

## 🎯 MISSION

Generate a photorealistic commercial photograph of a **${year} ${carModel}** interior with the user's **[${productCategory}]** (Reference Images 1-${seatCoverImages.length}) professionally installed.

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
| Target Area | ${targetRow} |

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
| **PRODUCT (Seat Covers)** | ⛔ **ORIGINAL COLORS ONLY - NO MODIFICATION** |

**TEXTURE MANDATE**: Even in black, render distinct material textures:

- Leather grain ≠ Plastic matte ≠ Piano black gloss ≠ Alcantara suede

---

## 🪑 PRODUCT INSTALLATION [CORE SKILL]

**PLACEMENT LOGIC**:

IF ${productCategory} == "Seat Cover" → Install on seats
IF ${productCategory} == "Armrest Cover" → Install on center armrest
IF ${productCategory} == "Floor Mat" → Install on floor
IF ${productCategory} == "Steering Wheel Cover" → Install on steering wheel

**PHYSICAL REALISM CHECKLIST**:

- [ ] Tension wrinkles where material pulls tight over seat foam
- [ ] Natural fabric folds at contour transitions
- [ ] Proper edge tucking into seat crevices
- [ ] Visible stitching matching reference images
- [ ] Headrest/armrest cutouts aligned correctly

**STATE RENDERING**:

- If product name contains "Folded" → Render seat in folded position
- If product name contains "Reclined" → Render seatback tilted back
- If product name contains "Lifted" → Render component in raised state

---

## 💡 LIGHTING SETUP

┌─────────────────────────────────────┐
│         ☀️ KEY LIGHT               │
│         (Soft diffused, upper front)│
│                 ↓                   │
│    ┌───────────────────────┐       │
│    │                       │       │
│ 💡 │      🚗 VEHICLE       │ 💡    │
│FILL│                       │FILL   │
│    │                       │       │
│    └───────────────────────┘       │
│                                     │
│         Color Temp: 5500K          │
│         Style: Commercial Studio   │
└─────────────────────────────────────┘

- **Key**: Soft diffused from upper front (70% intensity)
- **Fill**: Both sides to eliminate harsh shadows (30% intensity)
- **Accent**: Subtle rim light on seat edges for depth
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
- ❌ Incorrect seat geometry for specified model
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
4. MAP product images onto ${targetRow}
5. APPLY installation realism (wrinkles, folds)
6. SETUP studio lighting (5500K)
7. VERIFY angle matches ${angleId} reference
8. OUTPUT final image

---

## 📐 角度参数表（配合使用）

json
{
"S1":   "shot from directly in front, camera at seat height, centered composition",
"S2":   "shot from front-left at 40 degree angle, slightly elevated camera, three-quarter view",
"S3":   "shot from rear-left at 135 degree angle, showing seat back, three-quarter rear view",
"SET1": "shot from left side at 90 degrees, full seat set in frame, straight-on side view",
"SET2": "shot from right side at 90 degrees, full seat set in frame, straight-on side view",
"F1":   "shot from above front-right at 45 degree downward angle, bird's eye perspective, interior visible",
"F2":   "shot from driver door side, eye-level, profile view of driver seat and dashboard",
"F3":   "shot from passenger side front-quarter, doors removed, showing front cabin interior",
"F4":   "shot from rear seat position looking forward, interior POV, front seat backs visible",
"R1":   "shot facing rear bench directly, close-up, all three headrests visible",
"R2":   "shot from left rear door position, rear seat side view, interior visible",
"R3":   "shot from right rear door position, rear seat side view, interior visible",
"R4":   "shot from right side, rear seat cushion folded up, mechanism visible",
"R5":   "shot from above at 60 degree angle, looking down into cabin, seats reclined",
"R6":   "shot from rear-right at 150 degree angle, rear cabin and seats visible"
}

---

## 🎯 调用示例（Python）

python
def build_prompt(year, car_model, product_category, seat_config, target_row, angle_id, seat_cover_count):

```
angle_prompts = {
    "S1": "shot from directly in front, camera at seat height, centered composition",
    "S2": "shot from front-left at 40 degree angle, slightly elevated camera, three-quarter view",
    "F1": "shot from above front-right at 45 degree downward angle, bird's eye perspective, interior visible",
    # ... 其他角度
}

prompt = f"""
```

**MISSION**: Generate photorealistic commercial photo of {year} {car_model} interior with [{product_category}] installed.

**CAMERA ANGLE [LOCKED]**: {angle_prompts[angle_id]}

**VEHICLE**: {year} {car_model}, {seat_config}, Target: {target_row}

**RULES**:

1. Decode {car_model} {year} OEM interior accurately (screen, vents, steering, console)
2. ALL interior surfaces = PURE BLACK/DARK GREY (keep textures visible)
3. PRODUCT COLORS = ORIGINAL from reference images (NO modification)
4. Installation realism: tension wrinkles, natural folds, proper fit
5. Lighting: Studio setup, 5500K, soft key + fill lights

**OUTPUT**: 4:3, high resolution, commercial photography, white studio background

**AVOID**: Cartoon style, wrong seat shapes, color bleeding, 3D render look, wrong camera angle
"""
return prompt

# 使用

prompt = build_prompt(
year="2021",
car_model="Ford Bronco",
product_category="Seat Cover",
seat_config="5-Seat",
target_row="Front Row",
angle_id="F1",
seat_cover_count=9
)

---


