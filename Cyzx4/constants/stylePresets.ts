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
        prompt: 'professional 3D ghost mannequin photography of [SUBJECT], voluminous and naturally shaped garment, invisible model effect, three-dimensional representation. Pure white background #FFFFFF, soft professional studio lighting, detailed fabric texture, premium product catalog style, clean edges, sharp focus.',
        promptWithRef: 'professional 3D clothing extraction of [SUBJECT] following reference structure, 3/4 side view by default unless specified, ghost mannequin effect (invisible model), preserving exact silhouette, button placement, and fabric texture from reference. Naturally voluminous, high-end studio photography feel, pure white background #FFFFFF, soft natural shadows. [PARAMETERS]',
        negativePrompt: 'human, person, face, head, skin, hands, feet, hair, limbs, blurry, low quality, flat illustration, vector, 2d, hanger, dummy, background objects, text, watermark, logo, messy lighting, noisy.'
    }
];
