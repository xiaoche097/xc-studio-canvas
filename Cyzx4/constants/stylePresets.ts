export interface StylePreset {
    id: string;
    name: string;
    category: '电商' | '摄影' | '艺术' | '通用';
    previewUrl: string;
    prompt: string;        // 基础提示词 (正面)
    promptWithRef: string; // 有参考图时的增强提示词
    negativePrompt: string; // 负面提示词
    description: string;
}

export const STYLE_PRESETS: StylePreset[] = [
    {
        id: 'model-clothing-extraction',
        name: '模特衣服提取',
        category: '电商',
        previewUrl: '/styles/ghost_mannequin.png',
        description: '白底电商三视图（鬼影/隐形模特），正面/侧面/背面横向排列，纯衣服展示。',
        prompt: 'professional e-commerce three-view product photography of [SUBJECT], front view, side view, and back view arranged together horizontally from left to right, identical proportions and size, ghost mannequin effect, invisible model, only the clothing is visible. Pure white background #FFFFFF, soft uniform studio lighting, clear fabric texture, no human features, no face, no skin, no hands. High resolution, sharp focus, 8k, professional catalog style.',
        promptWithRef: 'professional clothing extraction of [SUBJECT] following reference, three-view display: front, right side, and back views arranged horizontally, ghost mannequin effect (invisible model), preserving exact color, silhouette, and fabric texture from reference. No human features, no skin, no background objects. Pure white background #FFFFFF, uniform studio lighting, high resolution, professional product catalog style.',
        negativePrompt: 'human, person, face, head, skin, hands, feet, hair, limbs, blurry, low quality, jewelry, hat, glasses, bag, props, text, watermark, logo, frame, background objects, gradient, noisy, messy layout.'
    },
    {
        id: 'doll-main-image-generation',
        name: '玩偶主图生成',
        category: '电商',
        previewUrl: '/styles/doll_preview.png',
        description: '玩偶产品电商白底主图精修/生成。角度由用户输入（如 正面/左前45°/右前45°/侧面/背面/特写），不输入则默认右前45°（无参考时）。',
        prompt: 'High-end e-commerce studio product photo of a single plush doll/toy. Pure white background #FFFFFF. The user input describes the product and the desired camera angle. If the user does not specify an angle, default to 3/4 front-right (right-front 45°).\nCentered composition, single product only, full product visible, no crop, even margins.\nSoft diffused studio lighting, neutral white balance, realistic plush fiber texture, ultra sharp focus, clean cutout edges, no halos, minimal soft contact shadow.\nNo people, no hands, no props, no text, no watermark, no logo.',
        promptWithRef: 'Use the provided doll/toy product photo as the only reference and constraint. Output an e-commerce studio retouched main image on pure white background #FFFFFF.\nYou MUST preserve 1:1 product identity and design: silhouette, proportions, facial feature placement, embroidery, seams/stitches, plush fiber texture, colors, and all accessories (hat/bow/etc.) exactly as in the reference. Do NOT add/remove/alter any elements.\nRetouch only: clean cutout (no white outline/halo/jaggies), remove dust and stray fibers, correct exposure, keep neutral white balance, enhance clarity while staying realistic (no plastic look).\nLighting: perfectly even diffused softbox; keep a very subtle realistic contact shadow only.\nComposition: single product centered, full product visible, not cropped, even padding.\nAngle: follow the user\'s angle instruction if provided (front / 3/4 front-left / 3/4 front-right / side profile / back / close-up). If the user did not specify an angle, keep the exact same camera angle as the reference image (default; commonly 3/4 front-right). Do NOT flip left/right.',
        negativePrompt: 'change design, redesign, altered structure, mismatch, inaccurate details, different product, wrong proportions, wrong color, color shift, hue shift, changed texture, plastic look, glossy, over-smooth, over-sharpen, extra accessories, missing accessories, added patterns, added text, logo, watermark, label, tag, sticker, background props, hands, people, multiple products, duplicated product, cropped, cut off, out of frame, floating, harsh shadow, strong shadow, gray background, gradient background, messy edges, white outline, halo, jagged edges, blur, low resolution, noise, jpeg artifacts, cartoon, illustration, anime, 3D render, CGI'
    },
    {
        id: 'doll-retouch-strict-angle',
        name: '玩偶原图精修',
        category: '电商',
        previewUrl: '/styles/doll_preview.png',
        description: '严格锁定原图视角、姿势与画幅，专注进行白底电商高级短毛绒质感精修，极大幅度压制“角度乱跑”。',
        prompt: '以参考图为唯一依据进行产品精修：**严格保持相机角度、镜头高度、焦距透视、主体朝向、姿势、构图与裁切范围完全一致**（same camera angle, same perspective, same focal length, same framing, no rotation, no viewpoint change），不要改变玩偶外形设计与比例，不要移动任何部件位置。\n**camera/view locked, do not change viewpoint, do not change pose, do not change framing**\n输出为**电商白底主图 packshot**：纯白无缝背景（seamless pure white background），背景干净无纹理无渐变。\n对玩偶做商业级精修与质感升级：面料为高级短毛绒（short-pile velboa / crystal velboa / minky short pile / microfiber microfleece），绒毛短而致密、柔软饱满、表面细腻均匀，轻微毛向与少量逆毛带来自然明暗层次（subtle nap marks, gentle brushed pile, soft tonal variation），边缘微微蓬松但整洁不炸毛。车缝线/拼接更平整干净，轮廓清晰但不过度锐化；刺绣/贴布/五官细节更清楚、边缘干净。清理瑕疵：灰尘、毛屑、线头、脏点、折痕压痕。\n棚拍柔光：soft even studio lighting, high-key, clean highlights, soft natural shadow directly under the toy, sharp focus, high resolution, professional e-commerce retouching, vibrant but realistic colors, rich contrast.',
        promptWithRef: '以参考图为唯一依据进行产品精修：**严格保持相机角度、镜头高度、焦距透视、主体朝向、姿势、构图与裁切范围完全一致**（same camera angle, same perspective, same focal length, same framing, no rotation, no viewpoint change），不要改变玩偶外形设计与比例，不要移动任何部件位置。\n**camera/view locked, do not change viewpoint, do not change pose, do not change framing**\n输出为**电商白底主图 packshot**：纯白无缝背景（seamless pure white background），背景干净无纹理无渐变。\n对玩偶做商业级精修与质感升级：面料为高级短毛绒（short-pile velboa / crystal velboa / minky short pile / microfiber microfleece），绒毛短而致密、柔软饱满、表面细腻均匀，轻微毛向与少量逆毛带来自然明暗层次（subtle nap marks, gentle brushed pile, soft tonal variation），边缘微微蓬松但整洁不炸毛。车缝线/拼接更平整干净，轮廓清晰但不过度锐化；刺绣/贴布/五官细节更清楚、边缘干净。清理瑕疵：灰尘、毛屑、线头、脏点、折痕压痕。\n棚拍柔光：soft even studio lighting, high-key, clean highlights, soft natural shadow directly under the toy, sharp focus, high resolution, professional e-commerce retouching, vibrant but realistic colors, rich contrast.',
        negativePrompt: 'change of angle, different viewpoint, rotation, tilted camera, zoomed out, zoomed in, crop change, top-down, bird’s-eye view, worm’s-eye view, perspective distortion, fisheye, wide-angle distortion, rearranged parts, redesign, deformed, wrong proportions, extra objects, background texture, gradient background, shadow too strong, harsh light, overexposed, underexposed, haze, dull colors, desaturated, washed out, grayish, muddy colors, noisy, grainy, blurry, low resolution, oversharpen, watermark, text, logo.'
    },
    {
        id: 'fabric-texture-extract-seamless',
        name: '面料提取(无缝贴图)',
        category: '通用',
        previewUrl: '/styles/fabric_preview.png',
        description: '从衣服图片中提取面料纹理，输出 1:1 无缝平铺贴图（seamless tileable texture）。',
        prompt: 'Seamless tileable fabric texture swatch extracted from the garment in the reference image.\nMicro-rib knit jersey fabric with very fine narrow vertical ribs, subtle heather/marl look, matte finish.\nExact color match to the reference garment (no hue shift, no saturation shift, no brightness shift), neutral white balance.\nFlat top-down orthographic scan, full-frame fabric only, uniform scale.\nPerfectly even diffused studio lighting, no shadows, no highlights, no folds, no seams.\nUltra sharp focus, high detail, texture-map quality, clean and consistent.',
        promptWithRef: 'Seamless tileable fabric texture swatch extracted from the garment in the reference image.\nMicro-rib knit jersey fabric with very fine narrow vertical ribs, subtle heather/marl look, matte finish.\nExact color match to the reference garment (no hue shift, no saturation shift, no brightness shift), neutral white balance.\nFlat top-down orthographic scan, full-frame fabric only, uniform scale.\nPerfectly even diffused studio lighting, no shadows, no highlights, no folds, no seams.\nUltra sharp focus, high detail, texture-map quality, clean and consistent.',
        negativePrompt: ''
    },
    {
        id: 'color-extract-solid-swatch',
        name: '颜色提取(纯色卡)',
        category: '通用',
        previewUrl: '/styles/color_preview.png',
        description: '从衣服图片中提取主色，输出 1:1 纯色颜色卡（solid uniform swatch）。',
        prompt: '从我提供的衣服图片中提取“主色”，生成一张可用于替换的纯色颜色卡（solid uniform color swatch）。只输出单一均匀的纯色块：准确匹配该衣服的色相/明度/饱和度/冷暖倾向；忽略并剔除阴影、高光、反光与任何光照影响。画面必须是 1:1 方形、高分辨率的纯色矩形色块，禁止任何纹理、织法细节、噪点颗粒、渐变、边框、文字、logo、水印或其他元素。输出为单张图片，不拼图，不加任何文字标注。',
        promptWithRef: '从我提供的衣服图片中提取“主色”，生成一张可用于替换的纯色颜色卡（solid uniform color swatch）。只输出单一均匀的纯色块：准确匹配该衣服的色相/明度/饱和度/冷暖倾向；忽略并剔除阴影、高光、反光与任何光照影响。画面必须是 1:1 方形、高分辨率的纯色矩形色块，禁止任何纹理、织法细节、噪点颗粒、渐变、边框、文字、logo、水印或其他元素。输出为单张图片，不拼图，不加任何文字标注。',
        negativePrompt: ''
    },
    {
        id: 'master-model-no-ref',
        name: '全身模特母版(无参考)',
        category: '摄影',
        previewUrl: '/styles/master_model_no_ref.png',
        description: '白底三视图（正/侧/背），服装行业“固定模特库”专用，全身商拍质感。',
        prompt: 'professional master model asset character sheet, three-view display from left to right: full body front view, full body right side view, and full body back view, identical adult model, consistent height and body proportions, high-key studio lighting, seamless white background #FFFFFF, clean edges, tack sharp focus, realistic skin texture, neutral expression, eye-level, standing straight, feet shoulder-width apart, arms slightly away from body. Wearing skin-tight solid-colored basic sportswear (light gray or beige), no patterns. Hair loose and natural but not covering face. 105mm telephoto lens style, 8k resolution.',
        promptWithRef: 'professional master model asset, three-view display: front, side, and back views, showing the same adult model across all views, e-commerce studio quality, pure white background #FFFFFF, soft professional lighting, clean silhouette, sharp details.',
        negativePrompt: 'cgi, 3d render, unreal engine, plastic skin, waxy skin, doll-like, ai-generated look, over-smoothed skin, beauty filter, blurry, low resolution, noisy, pixelated, oversharpening halo, white outline, messy edges, cut off head, cut off feet, wide-angle distortion, fisheye, harsh shadows, cinematic lighting, gradient background, background objects, text, watermark, logo, border, jewelry, glasses, hat, bag, props, jeans, skirt, coat, loose clothing, bad anatomy, deformed hands, extra fingers'
    },
    {
        id: 'master-model-with-ref',
        name: '全身模特母版(有参考)',
        category: '摄影',
        previewUrl: '/styles/master_model_with_ref.png',
        description: '以参考图为唯一身份与气质依据，生成固定模特库全身三视图，保持不换脸。',
        prompt: 'professional master model asset using consistent identity, three-view display: front view, side view, and back view arranged together, seamless white background #FFFFFF, high-key studio photography, soft lighting, professional retouching, 105mm lens.',
        promptWithRef: 'professional master model asset using reference as unique identity and style guide, three-view display from left to right: full body front view, full body right side view, and full body back view, same individual as reference, no face change, maintaining consistent facial features and body proportions, high-key e-commerce studio photography, seamless pure white background #FFFFFF, soft box strobe lighting, clean cutout edges, natural skin texture and specular highlights. Wearing skin-tight solid-colored base clothing (light gray or beige), 8k resolution, professional commercial photography.',
        negativePrompt: 'different person, face changed, identity changed, cgi, 3d render, plastic skin, waxy skin, doll-like, ai-generated look, over-smoothed skin, blur, low resolution, noise, oversharpening halo, white outline, messy edges, wide-angle distortion, fisheye, harsh shadows, cinematic lighting, gradient background, text, watermark, logo, jewelry, glasses, hat, bag, props, jeans, skirt, coat, loose clothing, bad anatomy, deformed hands, extra fingers, cropped head, cropped feet'
    },
    {
        id: 'fashion-technical-flat',
        name: '自动识别服装关键结构',
        category: '电商',
        previewUrl: '/styles/technical_flat.png',
        description: '从输入图中提取服装，重绘为专业款式平铺图（Fashion Flat），保留结构细节。',
        prompt: 'professional fashion technical flat of [SUBJECT], centered, perfectly symmetrical, vector illustration style, flat colors, clean black outlines, consistent line weight. Only the garment itself, no model, no human features, no background. Pure white background #FFFFFF, soft neutral lighting, clear structural details: collar, buttons, seams, and hem as shown in reference. High resolution, sharp edges, professional fashion design schematic.',
        promptWithRef: 'fashion technical flat illustration based on provided reference, extracting the specific structure of [SUBJECT], including collar type, button placement, sleeve length, and hemline. Strictly maintaining the original design, redrawn as a symmetrical flat sketch, vector style, flat shading, clean black lines, no human silhouette, no hanger, pure white background #FFFFFF, professional apparel design document.',
        negativePrompt: 'human, person, face, skin, model, body silhouette, photo, realistic texture, shadow, 3d render, cgi, blurry, noisy, messy lines, hanger, background objects, text, watermark, logo, jewelry, accessories, bag, shoes, gradient.'
    },
    {
        id: 'clothing-to-3d-mannequin',
        name: '自动识别服装转3D',
        category: '电商',
        previewUrl: '/styles/clothing_to_3d.png',
        description: '实拍图转立体电商单品图（鬼影效果）。支持参数调节：真实棚拍/3D渲染、阴影=无/轻微、视角=正面/3-4侧前等。',
        prompt: 'professional 3D ghost mannequin photography of [SUBJECT], voluminous and naturally shaped garment, invisible model effect, three-dimensional representation. Pure white background #FFFFFF, soft professional studio lighting, detailed fabric texture, premium product catalog style, clean edges, sharp focus. [PARAMETERS]',
        promptWithRef: 'professional 3D clothing extraction of [SUBJECT] following reference structure, 3/4 side view by default unless specified, ghost mannequin effect (invisible model), preserving exact silhouette, button placement, and fabric texture from reference. Naturally voluminous, high-end studio photography feel, pure white background #FFFFFF, soft natural shadows. [PARAMETERS]',
        negativePrompt: 'human, person, face, head, skin, hands, feet, hair, limbs, blurry, low quality, flat illustration, vector, 2d, hanger, dummy, background objects, text, watermark, logo, messy lighting, noisy.'
    },
    {
        id: 'hd-upscale-remaster',
        name: '高清大图(超清重绘)',
        category: '通用',
        previewUrl: '/styles/upscale_preview.png',
        description: '采用“低频+高频”分离重建逻辑，进行高质量超清重绘与细节增强。',
        prompt: '请以输入图片为唯一核心参考，对原图进行高质量超清重绘与重建。不要只做简单放大或表面锐化，而是先从画面的底层生成逻辑出发，逆向理解并还原其视觉构成，再生成一张新的超高清图像。完整分析并保留原图的主体与陪体关系、画面重心、构图方式、视觉引导线、前中后景层次、镜头视角、拍摄机位、焦段感、透视关系、比例结构、景深表现、光源方向、主光与辅光关系、明暗体积、阴影分布、局部反射、整体曝光、色温倾向、主色调与辅色调、冷暖对比、色彩层次、材质属性、表面纹理、边缘组织、细节密度、氛围感、风格气质与完成度。\n\n采用“低频信息 + 高频信息”分离重建的逻辑进行重绘：先进行低频重建，稳定原图的大关系，保留整体构图、主体比例、空间结构、透视逻辑、体积关系、明暗层次、色块分布、光影节奏、虚实关系和整体氛围，确保重绘后的画面在大形、大光影、大色彩、大空间上与原图保持高度一致；再进行高频重建，在低频稳定的基础上，精细重建纹理、材质肌理、边缘清晰度、微小结构、局部反光、高光层次、表面起伏、真实颗粒感、细节转折、质感差异与局部精修效果，让细节更加完整、清晰、真实、可信，但不堆砌伪细节，不过度锐化，不过度人工化；最后将低频层与高频层自然融合与重新合成，保证整体光影一致、色彩统一、结构稳定、细节服从整体，不出现局部过分突出、纹理断裂、边缘发硬、明暗冲突、颜色漂移或空间错乱。\n\n重绘时必须忠于原图的主体、构图、结构、透视和风格逻辑，保留原图的视觉神韵、氛围和叙事感，同时优化原图中模糊、压缩、噪点、锯齿、脏污、细节断裂等问题；对于参考图中缺失或不清晰的局部，依据整体生成逻辑做合理补全，补全必须自然、可信、统一，不能随意添加无关元素。所有细节提升都必须建立在真实结构和材质逻辑之上，最终效果应像“重新高质量生成”，而不是“强行锐化放大”。\n\n如果参考图是人物，请保持人物身份特征、五官比例、表情气质、肤质逻辑、发丝层次、服装材质和肢体结构稳定一致，避免脸型漂移、五官错位、年龄感变化、皮肤塑料化和头发糊成一片；如果参考图是产品或静物，请保持几何结构准确、边缘完整、材质反射正确、细节精密、工业质感稳定，不要变形，不要出现多余装饰；如果参考图是场景或建筑，请保持空间关系、透视线、体块关系、材质重复规律、远近层次 and 环境光逻辑准确，避免结构错乱和建筑畸变。\n\n最终输出要求：超高清、超精细、结构稳定、构图准确、透视正确、层次通透、光影统一、色彩准确、过渡自然、材质真实、边缘干净、局部细节丰富、整体完成度高、商业级质感、无明显AI痕迹、无涂抹感、无塑料感、无过度磨皮、无过度锐化、无噪点堆积、无假纹理、无脏灰色偏、无结构崩坏。',
        promptWithRef: '请以输入图片为唯一核心参考，对原图进行高质量超清重绘与重建。不要只做简单放大或表面锐化，而是先从画面的底层生成逻辑出发，逆向理解并还原其视觉构成，再生成一张新的超高清图像。完整分析并保留原图的主体与陪体关系、画面重心、构图方式、视觉引导线、前中后景层次、镜头视角、拍摄机位、焦段感、透视关系、比例结构、景深表现、光源方向、主光与辅光关系、明暗体积、阴影分布、局部反射、整体曝光、色温倾向、主色调与辅色调、冷暖对比、色彩层次、材质属性、表面纹理、边缘组织、细节密度、氛围感、风格气质与完成度。\n\n采用“低频信息 + 高频信息”分离重建的逻辑进行重绘：先进行低频重建，稳定原图的大关系，保留整体构图、主体比例、空间结构、透视逻辑、体积关系、明暗层次、色块分布、光影节奏、虚实关系和整体氛围，确保重绘后的画面在大形、大光影、大色彩、大空间上与原图保持高度一致；再进行高频重建，在低频稳定的基础上，精细重建纹理、材质肌理、边缘清晰度、微小结构、局部反光、高光层次、表面起伏、真实颗粒感、细节转折、质感差异与局部精修效果，让细节更加完整、清晰、真实、可信，但不堆砌伪细节，不过度锐化，不过度人工化；最后将低频层与高频层自然融合与重新合成，保证整体光影一致、色彩统一、结构稳定、细节服从整体，不出现局部过分突出、纹理断裂、边缘发硬、明暗冲突、颜色漂移或空间错乱。\n\n重绘时必须忠于原图的主体、构图、结构、透视和风格逻辑，保留原图的视觉神韵、氛围和叙事感，同时优化原图中模糊、压缩、噪点、锯齿、脏污、细节断裂等问题；对于参考图中缺失或不清晰的局部，依据整体生成逻辑做合理补全，补全必须自然、可信、统一，不能随意添加无关元素。所有细节提升都必须建立在真实结构和材质逻辑之上，最终效果应像“重新高质量生成”，而不是“强行锐化放大”。\n\n如果参考图是人物，请保持人物身份特征、五官比例、表情气质、肤质逻辑、发丝层次、服装材质和肢体结构稳定一致，避免脸型漂移、五官错位、年龄感变化、皮肤塑料化和头发糊成一片；如果参考图是产品 or 静物，请保持几何结构准确、边缘完整、材质反射正确、细节精密、工业质感稳定，不要变形，不要出现多余装饰；如果参考图是场景或建筑，请保持空间关系、透视线、体块关系、材质重复规律、远近层次 and 环境光逻辑准确，避免结构错乱和建筑畸变。\n\n最终输出要求：超高清、超精细、结构稳定、构图准确、透视正确、层次通透、光影统一、色彩准确、过渡自然、材质真实、边缘干净、局部细节丰富、整体完成度高、商业级质感、无明显AI痕迹、无涂抹感、无塑料感、无过度磨皮、无过度锐化、无噪点堆积、无假纹理、无脏灰色偏、无结构崩坏。',
        negativePrompt: '避免：简单放大、纯锐化痕迹、过度锐化、边缘白边、边缘发硬、局部糊化、细节涂抹、纹理重复、伪细节堆积、错误高光、错误反射、材质失真、塑料感、蜡像感、过度磨皮、过强颗粒、脏噪点、压缩痕迹、色彩脏灰、颜色漂移、曝光失衡、过曝、欠曝、局部死黑、局部死白、明暗断层、结构崩坏、比例错误、透视错误、空间错乱、肢体异常、五官错位、面部变形、发丝粘连、背景穿帮、图像撕裂、双重边缘、重影、水印、错误文字、乱码、明显AI生成痕迹。'
    },
    {
        id: 'magic-mannequin-pose-transfer',
        name: '魔法玩偶',
        category: '通用',
        previewUrl: '/styles/clothing_to_3d.png',
        description: '生成无五官、无衣服、无印花的纯净3D模特玩偶。仅提取身材比例，不保留任何长相。',
        prompt: 'Pure faceless 3D mannequin render, blank smooth head, zero clothing, zero prints.',
        promptWithRef: 'Create a "Pure Blank Mannequin" 3D character.\n**Image 1 (Body Source)**: Provides only the human body proportions and scale. **STRICTLY IGNORE** everything else: no face, no eyes, no mouth, no hair, no clothing, no sunflower print, no graphics.\n**Image 2 (Style & Pose)**: Provides the 3D smooth plastic material, the EXACT pose, and the EXACT framing.\n**TASK**: Generate a **FACELESS** and **BLANK** 3D mannequin in Image 2\'s pose. The head must be a smooth, featureless anatomical shape (no eyes/nose/mouth). The body must be 100% clean with no clothing and no tattoos or prints. Use Image 1 only to determine the mannequin\'s height and body thickness.',
        negativePrompt: 'human face, eyes, nose, mouth, lips, hair, clothing, shirt, pants, sunflower, print, logo, graphic, text, tattoo, realistic skin, photography.'
    },
    {
        id: 'white-background-production',
        name: '白底图制作',
        category: '电商',
        previewUrl: '/styles/studio.png',
        description: '将图片转成白底图，产品的光感和质感不变，只是换成棚拍白底，背景色值为 #FFFFFF。',
        prompt: '将图片转成场景图：Professional e-commerce studio photography of the product on a PURE WHITE background #FFFFFF. High-key studio lighting, clean edges, crisp details, soft contact shadow only. Maintain the exact lighting, texture, and material feel of the original product. No environment, no props, no distracting background.',
        promptWithRef: '将图片转成场景图：Professional e-commerce studio retouching on a PURE WHITE background #FFFFFF. Use the reference image for product identity. Maintain the product\'s original lighting, shadows, and textures perfectly. Replace the current background with a clean, infinite white studio background. Ensure sharp focus and high resolution.',
        negativePrompt: 'floor, table, wooden surface, desk, environment, background texture, wall, window, room details, gray, shadow cast on floor, long shadow, floating artifacts, messy edges, horizon line, ground plane, furniture, studio equipment, reflection on floor'
    }
];
