import React, { useEffect, useState, useRef } from 'react';
import { 
    Upload, X, Wand2, Sparkles, AlertCircle, Loader2, 
    Layers, Brain, Camera, MessageSquare, Zap, 
    ShieldCheck, RefreshCw, ZoomIn, Download, Hammer,
    CheckCircle2, ChevronDown, ChevronUp, Image as ImageIcon,
    Lightbulb, User, MapPin, ListTodo, Info, Brush, Eraser
} from 'lucide-react';
import { generateImageToImage, compressImage } from '../services/geminiService';
import { generateContentWithAnalysisFallback, getErrorMessage, getAiClient, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';

interface UploadedImage {
    file: File;
    preview: string;
    base64?: string;
    mime?: string;
}

const COT_STEPS = [
    { id: 1, label: "结构特征提取", desc: "正在从参考图中识别材质与工艺细节...", icon: "🔍" },
    { id: 2, label: "几何一致性计算", desc: "正在计算标准结构与待修图的映射关系...", icon: "📐" },
    { id: 3, label: "高保真像素填充", desc: "正在修复破损、畸变或模糊的局部细节...", icon: "🖌️" },
    { id: 4, label: "纹理质感对齐", desc: "正在同步标准图中的面料与五金质感...", icon: "💎" },
    { id: 5, label: "商业级后期渲染", desc: "正在进行最终的光影融合与色彩均衡...", icon: "🌈" },
];

const RATIO_OPTIONS = [
    { label: '1:1', value: AspectRatio.SQUARE, desc: '正方形', icon: '⏹️' },
    { label: '2:3', value: AspectRatio.PORTRAIT_2_3, desc: '电商主图', icon: '📱' },
    { label: '3:4', value: AspectRatio.PORTRAIT_3_4, desc: '商品详情', icon: '📄' },
    { label: '9:16', value: AspectRatio.PORTRAIT_9_16, desc: '竖屏海报', icon: '📏' },
    { label: '16:9', value: AspectRatio.LANDSCAPE_16_9, desc: '宽幅横图', icon: '🖥️' },
];

const MODEL_OPTIONS = [
    { id: 'gemini-3.1-flash-image-preview', name: 'Banana 2', sub: '3.1 Flash', desc: '速度优先，适合简单修复' },
    { id: 'gemini-3-pro-image-preview', name: 'Banana Pro', sub: '3 Pro', desc: '结构精准，推荐商业级修复' },
    { id: 'gpt-image-2', name: 'GPT Image 2', sub: 'Ultra', desc: '极致细节，追求高保真画质' },
];

const STANDARD_IMAGE_LIMIT = 6;

const REPAIR_TYPES = [
    { id: 'artifacts', label: '移除多余结构', prompt: 'Remove unrelated extra objects, hallucinated parts, wrong accessories, duplicated product pieces, stray blobs, and any structure that does not exist in the standard product references. Reconstruct clean product edges and the underlying scene naturally.' },
    { id: 'structure', label: '结构变形', prompt: 'Fix distorted geometry, warped silhouette, incorrect proportions, or collapsed structure.' },
    { id: 'texture', label: '纹理模糊', prompt: 'Restore blurry surface texture, material grain, plush fur, fabric weave, leather grain, or fine product detail.' },
    { id: 'color', label: '颜色偏差', prompt: 'Correct color mismatch, hue drift, saturation mismatch, and inconsistent product tone.' },
    { id: 'edge', label: '边缘破损', prompt: 'Repair broken edges, jagged contours, missing trim, cut-off seams, and damaged boundaries.' },
    { id: 'detail', label: '细节缺失', prompt: 'Reconstruct missing product details, accessories, embroidery, buttons, stitching, labels, or hardware.' },
    { id: 'material', label: '材质错误', prompt: 'Correct wrong material appearance and match the reference material finish, reflectivity, density, and tactile texture.' },
];

const ProductRepairTab: React.FC = () => {
    // Image states
    const [standardImages, setStandardImages] = useState<UploadedImage[]>([]);
    const [targetImage, setTargetImage] = useState<UploadedImage | null>(null);
    const standardImage = standardImages[0] || null;
    
    // Config states
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [selectedResolution, setSelectedResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
    const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [selectedRepairTypes, setSelectedRepairTypes] = useState<string[]>(['artifacts', 'structure', 'detail']);
    const [repairScopeMode, setRepairScopeMode] = useState<'auto' | 'manual'>('auto');
    const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
    const [maskOverlayDataUrl, setMaskOverlayDataUrl] = useState<string | null>(null);
    const [maskRegionSummary, setMaskRegionSummary] = useState<string>('');
    const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
    const [isDrawingMask, setIsDrawingMask] = useState(false);
    const [brushSize, setBrushSize] = useState(28);
    const [brushPreview, setBrushPreview] = useState<{ x: number; y: number; visible: boolean }>({
        x: 0,
        y: 0,
        visible: false
    });

    // Status states
    const [isLoading, setIsLoading] = useState(false);
    const {
        cancelMessage,
        startGenerationTask,
        cancelGenerationTask,
        isCurrentGenerationTask,
        assertCurrentGenerationTask,
        finishGenerationTask,
    } = useCancelableGeneration();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

    // Wizard states
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardData, setWizardData] = useState({
        details: '',
        sellingPoints: '',
        audience: '',
        scenarios: ''
    });

    // Helper for image dimensions and aspect ratio detection
    const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const autoDetectRatio = (width: number, height: number) => {
        const ratio = width / height;
        const presets = [
            { value: AspectRatio.SQUARE, ratio: 1 / 1 },
            { value: AspectRatio.PORTRAIT_2_3, ratio: 2 / 3 },
            { value: AspectRatio.PORTRAIT_3_4, ratio: 3 / 4 },
            { value: AspectRatio.PORTRAIT_9_16, ratio: 9 / 16 },
            { value: AspectRatio.LANDSCAPE_16_9, ratio: 16 / 9 },
        ];
        
        let closest = presets[0];
        let minDiff = Math.abs(ratio - closest.ratio);
        
        for (const preset of presets) {
            const diff = Math.abs(ratio - preset.ratio);
            if (diff < minDiff) {
                minDiff = diff;
                closest = preset;
            }
        }
        return closest.value;
    };

    // Refs
    const standardInputRef = useRef<HTMLInputElement>(null);
    const targetInputRef = useRef<HTMLInputElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isMaskEditorOpen || !maskCanvasRef.current) return;
        const canvas = maskCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!maskOverlayDataUrl) return;

        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = maskOverlayDataUrl;
    }, [isMaskEditorOpen, maskOverlayDataUrl]);

    // Image processing
    const processUploadFile = async (file: File): Promise<UploadedImage> => {
        const { base64, mime } = await compressImage(file, 2048, 0.9);
        return {
            file,
            preview: URL.createObjectURL(file),
            base64,
            mime
        };
    };

    const handleUpload = async (file: File, type: 'standard' | 'target') => {
        if (!file || !file.type.startsWith('image/')) return;
        const { taskId, signal } = startGenerationTask();
        setIsLoading(true);
        try {
            assertCurrentGenerationTask(taskId, signal);
            // 自动检测比例
            const dims = await getImageDimensions(file);
            const detectedRatio = autoDetectRatio(dims.width, dims.height);
            setSelectedRatio(detectedRatio);

            const uploaded = await processUploadFile(file);
            if (type === 'standard') {
                const nextImages = [...standardImages, uploaded].slice(0, STANDARD_IMAGE_LIMIT);
                setStandardImages(nextImages);
                setTimeout(() => runStructuralAnalysis(nextImages), 500);
            } else {
                setTargetImage(uploaded);
                setMaskDataUrl(null);
                setMaskOverlayDataUrl(null);
                setMaskRegionSummary('');
            }
            setError(null);
        } catch (err) {
            setError("图片处理失败");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleStandardFiles = async (files: FileList | File[]) => {
        const allowed = Array.from(files)
            .filter(file => file.type.startsWith('image/'))
            .slice(0, STANDARD_IMAGE_LIMIT - standardImages.length);
        if (allowed.length === 0) return;
        setIsLoading(true);
        try {
            const processed: UploadedImage[] = [];
            for (const file of allowed) {
                processed.push(await processUploadFile(file));
            }
            const nextImages = [...standardImages, ...processed].slice(0, STANDARD_IMAGE_LIMIT);
            setStandardImages(nextImages);
            setTimeout(() => runStructuralAnalysis(nextImages), 500);
            setError(null);
        } catch {
            setError("图片处理失败");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = (e: React.DragEvent, type: 'standard' | 'target') => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'standard') {
            void handleStandardFiles(e.dataTransfer.files);
            return;
        }
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file, type);
    };

    const handlePaste = (e: React.ClipboardEvent, type: 'standard' | 'target') => {
        const item = Array.from(e.clipboardData.items).find(x => x.type.startsWith('image/'));
        if (item) {
            const file = item.getAsFile();
            if (file) handleUpload(file, type);
        }
    };

    const runStructuralAnalysis = async (imgs: UploadedImage[] | UploadedImage) => {
        const images = Array.isArray(imgs) ? imgs : [imgs];
        if (images.length === 0) return;
        setIsAnalyzing(true);
        setError(null);
        try {
            const ai = getAiClient();
            const wizardContext = Object.values(wizardData).some(v => v.trim()) ? `
                [USER SUPPLEMENTAL CONTEXT]:
                ${wizardData.details ? `- Product Details: ${wizardData.details}` : ''}
                ${wizardData.sellingPoints ? `- Selling Points: ${wizardData.sellingPoints}` : ''}
                ${wizardData.audience ? `- Target Audience: ${wizardData.audience}` : ''}
                ${wizardData.scenarios ? `- Usage Scenarios: ${wizardData.scenarios}` : ''}
            ` : "";

            const prompt = `
                As a Professional Product Structure Auditor, analyze these [STANDARD REFERENCE IMAGES].
                ${wizardContext}
                The first image is the primary standard image. Additional images provide alternate angles, back/side views, and close-up details.
                
                Focus on two main categories:
                1. IF PLUSH/DOLL: Analyze facial symmetry, fur texture, limb proportions, and specific embroidery/seams.
                2. IF APPAREL/CLOTHING: Analyze fabric grain, collar/cuff structure, button/zipper alignment, and ergonomic cut.
                3. OTHERS: General structural features.

                Output strictly in JSON:
                {
                    "category": "plush | apparel | general",
                    "material": "detailed material description",
                    "structure": "core geometric features",
                    "details": ["feature 1", "feature 2", "feature 3"],
                    "repairPrompt": "precise technical instruction to lock this structure"
                }
            `;
            const response = await generateContentWithAnalysisFallback(ai, {
                model: 'gemini-3.1-flash-lite-preview',
                contents: {
                    parts: [
                        ...images.map(img => ({ inlineData: { mimeType: img.mime!, data: img.base64! } })),
                        { text: prompt }
                    ]
                }
            });
            let text = response.text || '{}';
            text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            setAnalysisResult(JSON.parse(text));
        } catch (err) {
            console.error("Analysis Error:", err);
            setError("结构分析失败");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getMaskPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * canvas.width,
            y: ((e.clientY - rect.top) / rect.height) * canvas.height,
        };
    };

    const updateBrushPreview = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        setBrushPreview({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            visible: true
        });
    };

    const drawMaskPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = maskCanvasRef.current;
        const point = getMaskPoint(e);
        if (!canvas || !point) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = 'rgba(255, 32, 32, 0.82)';
        ctx.beginPath();
        ctx.arc(point.x, point.y, brushSize, 0, Math.PI * 2);
        ctx.fill();
    };

    const startMaskDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        updateBrushPreview(e);
        setIsDrawingMask(true);
        drawMaskPoint(e);
    };

    const moveMaskDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        updateBrushPreview(e);
        if (!isDrawingMask) return;
        drawMaskPoint(e);
    };

    const endMaskDrawing = () => {
        setIsDrawingMask(false);
    };

    const hideBrushPreview = () => {
        setIsDrawingMask(false);
        setBrushPreview(prev => ({ ...prev, visible: false }));
    };

    const clearMask = () => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        setMaskDataUrl(null);
        setMaskOverlayDataUrl(null);
        setMaskRegionSummary('');
    };

    const summarizeMaskRegions = (canvas: HTMLCanvasElement) => {
        const sampleSize = 256;
        const temp = document.createElement('canvas');
        temp.width = sampleSize;
        temp.height = sampleSize;
        const tempCtx = temp.getContext('2d');
        if (!tempCtx) return '';
        tempCtx.drawImage(canvas, 0, 0, sampleSize, sampleSize);
        const data = tempCtx.getImageData(0, 0, sampleSize, sampleSize).data;
        const occupied = new Uint8Array(sampleSize * sampleSize);
        for (let y = 0; y < sampleSize; y++) {
            for (let x = 0; x < sampleSize; x++) {
                const i = (y * sampleSize + x) * 4;
                if (data[i + 3] > 40 && data[i] > 150) occupied[y * sampleSize + x] = 1;
            }
        }

        const visited = new Uint8Array(sampleSize * sampleSize);
        const regions: Array<{ minX: number; maxX: number; minY: number; maxY: number; area: number }> = [];
        const queue: number[] = [];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (let start = 0; start < occupied.length; start++) {
            if (!occupied[start] || visited[start]) continue;
            let head = 0;
            let area = 0;
            let minX = sampleSize;
            let maxX = 0;
            let minY = sampleSize;
            let maxY = 0;
            queue.length = 0;
            queue.push(start);
            visited[start] = 1;

            while (head < queue.length) {
                const current = queue[head++];
                const x = current % sampleSize;
                const y = Math.floor(current / sampleSize);
                area++;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);

                for (const [dx, dy] of dirs) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= sampleSize || ny >= sampleSize) continue;
                    const next = ny * sampleSize + nx;
                    if (occupied[next] && !visited[next]) {
                        visited[next] = 1;
                        queue.push(next);
                    }
                }
            }

            if (area > 10) regions.push({ minX, maxX, minY, maxY, area });
        }

        const positionName = (min: number, max: number, axis: 'x' | 'y') => {
            const center = ((min + max) / 2) / sampleSize;
            if (axis === 'x') return center < 0.33 ? 'left' : center < 0.66 ? 'center' : 'right';
            return center < 0.33 ? 'upper' : center < 0.66 ? 'middle' : 'lower';
        };

        return regions
            .sort((a, b) => b.area - a.area)
            .slice(0, 12)
            .map((region, index) => {
                const xPos = positionName(region.minX, region.maxX, 'x');
                const yPos = positionName(region.minY, region.maxY, 'y');
                const width = Math.round(((region.maxX - region.minX + 1) / sampleSize) * 100);
                const height = Math.round(((region.maxY - region.minY + 1) / sampleSize) * 100);
                return `Region ${index + 1}: ${yPos}-${xPos} red painted area, approximately ${width}% wide by ${height}% tall.`;
            })
            .join('\n');
    };

    const saveMask = () => {
        const canvas = maskCanvasRef.current;
        if (!canvas || !targetImage) return;
        const overlayDataUrl = canvas.toDataURL('image/png');
        const regionSummary = summarizeMaskRegions(canvas);
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = canvas.width;
        mergedCanvas.height = canvas.height;
        const ctx = mergedCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            if (!ctx) return;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height);
            const scale = Math.min(mergedCanvas.width / img.width, mergedCanvas.height / img.height);
            const width = img.width * scale;
            const height = img.height * scale;
            const x = (mergedCanvas.width - width) / 2;
            const y = (mergedCanvas.height - height) / 2;
            ctx.drawImage(img, x, y, width, height);
            ctx.drawImage(canvas, 0, 0);
            setMaskOverlayDataUrl(overlayDataUrl);
            setMaskDataUrl(mergedCanvas.toDataURL('image/png'));
            setMaskRegionSummary(regionSummary);
            setRepairScopeMode('manual');
            setIsMaskEditorOpen(false);
        };
        img.src = targetImage.preview;
    };

    const handleRepair = async () => {
        if (standardImages.length === 0 || !targetImage) {
            setError("请同时上传标准图和待修复图");
            return;
        }

        const { taskId, signal } = startGenerationTask();
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        setCurrentStep(0);
        setProgress(0);

        const stepInterval = setInterval(() => {
            setCurrentStep(prev => (prev < COT_STEPS.length - 1 ? prev + 1 : prev));
            setProgress(prev => Math.min(prev + 10, 95));
        }, 2000);

        try {
            const maskImage = repairScopeMode === 'manual' && maskDataUrl ? {
                base64: maskDataUrl.split(',')[1] || maskDataUrl,
                mimeType: 'image/png'
            } : null;

            const inputImages = [
                { base64: targetImage.base64!, mimeType: targetImage.mime! },
                ...standardImages.map(img => ({ base64: img.base64!, mimeType: img.mime! })),
                ...(maskImage ? [maskImage] : [])
            ];

            const categoryHint = analysisResult?.category === 'plush' ? 
                "PAY SPECIAL ATTENTION to fur texture and facial symmetry consistency." : 
                analysisResult?.category === 'apparel' ? 
                "PAY SPECIAL ATTENTION to fabric grain continuity and seam alignment." : "";

            const wizardContext = Object.values(wizardData).some(v => v.trim()) ? `
                [USER SUPPLEMENTAL CONTEXT]:
                ${wizardData.details ? `- Product Details: ${wizardData.details}` : ''}
                ${wizardData.sellingPoints ? `- Selling Points: ${wizardData.sellingPoints}` : ''}
                ${wizardData.audience ? `- Target Audience: ${wizardData.audience}` : ''}
                ${wizardData.scenarios ? `- Usage Scenarios: ${wizardData.scenarios}` : ''}
            ` : "";

            const selectedRepairInstructions = REPAIR_TYPES
                .filter(type => selectedRepairTypes.includes(type.id))
                .map(type => `- ${type.label}: ${type.prompt}`)
                .join('\n');

            const targetImageIndex = 1;
            const standardStartIndex = 2;
            const standardEndIndex = standardImages.length + 1;
            const maskImageIndex = maskImage ? standardImages.length + 2 : null;
            const maskRegionInstruction = maskRegionSummary
                ? `Detected separate red mask regions:\n${maskRegionSummary}\nYou must process EVERY listed region. Do not stop after fixing only one region.`
                : `If multiple red painted areas are visible, treat each separated red area as an independent required edit region and process all of them.`;
            const scopeInstruction = repairScopeMode === 'manual' && maskImageIndex
                ? `A manual red mask overlay is provided as Image ${maskImageIndex}. The RED painted areas are a mandatory edit map. ${maskRegionInstruction} Treat the red-painted areas primarily as wrong/unwanted product artifacts unless the user context says otherwise: remove unrelated extra structures, blobs, duplicate parts, wrong accessories, and non-standard product pieces. Then reconstruct the clean product silhouette, correct product surface, and any revealed background/hand occlusion naturally. The red marks are NOT part of the final image and must be removed. Preserve all unpainted areas exactly.`
                : `No manual mask was provided. First identify extra/unrelated product artifacts and defective product areas in Image ${targetImageIndex} by comparing it with all standard reference images, then remove or repair only those issues.`;

            const prompt = `
                # REPAIR AGENT: High-Fidelity Structural Restoration
                # TARGET: Image 1 (scene/image to repair)
                # SOURCE TRUTH: Images ${standardStartIndex}-${standardEndIndex} (product standards, multiple angles/details)
                ${maskImageIndex ? `# MANUAL EDIT MAP: Image ${maskImageIndex} (target image with red painted repair region)` : ''}
                
                ${wizardContext}

                # INSTRUCTIONS:
                1. Image 1 is the TARGET. Maintain its pose, scene, model identity, background, camera angle, crop, and lighting 100%.
                2. Images ${standardStartIndex}-${standardEndIndex} are the MASTER REFERENCES for product structure, geometry, materials, colors, and details.
                3. RECONSTRUCT the product area in Image 1 using features from all standard references.
                4. ${analysisResult?.repairPrompt || "Ensure structural integrity."}
                5. ${categoryHint}
                6. ${scopeInstruction}
                7. Repair focus:
                ${selectedRepairInstructions || '- General product structure and texture consistency.'}
                8. Do NOT return Image 1 unchanged. The marked/defective product area must be visibly corrected: remove non-reference artifacts, eliminate extra unrelated structures, and make the product closer to the standard reference product.
                9. If there are multiple red regions, complete all of them in the same output. A result that fixes only one red region is incomplete.
                
                # HARD PRESERVATION RULES:
                - Do not redesign the product.
                - Do not alter non-defective background, model, hands, props, or composition.
                - If the manual mask is present, only red painted areas are editable.
                - If a red area covers something that is not part of the standard product, delete it rather than beautifying it.
                - After deleting an artifact, fill the area with the correct neighboring background, hand, clothing, or product edge so the result looks natural.
                - The final image must contain no red mask paint, no labels, and no annotation overlay.
                
                # FINAL QUALITY: Commercial-grade, 1:1 structural replication.
            `;

            const results = await generateImageToImage(inputImages, prompt, {
                modelId: selectedModel,
                resolution: selectedResolution,
                aspectRatio: selectedRatio,
                workflowHint: 'structural-repair-v2',
                signal
            });

            assertCurrentGenerationTask(taskId, signal);
            setGeneratedImages(results);
            await saveGeneratedProject({
                type: 'RETOUCHING',
                generated: results,
                original: [
                    ...(targetImage ? [`data:${targetImage.mime};base64,${targetImage.base64}`] : []),
                    ...standardImages.map(img => `data:${img.mime};base64,${img.base64}`)
                ],
                prompt,
                params: {
                    source: 'Cyzx4/components/ProductRepairTab',
                    model: selectedModel,
                    aspectRatio: selectedRatio,
                    resolution: selectedResolution,
                    repairTypes: selectedRepairTypes,
                    scope: repairScopeMode
                }
            });
        } catch (err) {
            if (!isAbortError(err)) {
                setError(getErrorMessage(err));
            }
        } finally {
            clearInterval(stepInterval);
            if (!isCurrentGenerationTask(taskId)) {
                return;
            }
            finishGenerationTask(taskId);
            setIsLoading(false);
            setProgress(100);
        }
    };

    const handleCancelRepair = () => {
        cancelGenerationTask();
        setIsLoading(false);
        setProgress(0);
    };

    const handleDownload = (img: string) => {
        const link = document.createElement('a');
        link.href = img;
        link.download = `repaired-product-${Date.now()}.png`;
        link.click();
    };

    return (
        <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white custom-scrollbar pb-24">
            {/* Header */}
            <div className="text-center py-6 px-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-pastel-border rounded-full text-[10px] text-pastel-muted mb-3 shadow-sm">
                    <Hammer className="w-3 h-3 text-orange-500" />
                    产品结构精修 (Industrial Precision Agent)
                </div>
                <h1 className="text-2xl font-black text-pastel-text tracking-tight">产品结构一致性修复</h1>
                <p className="mt-2 text-pastel-muted text-[11px] max-w-xl mx-auto leading-relaxed">
                    针对 AI 生成图中的畸变、断裂或纹理模糊，利用“结构锚点”技术进行 1:1 像素级还原。
                </p>
            </div>

            <div className="max-w-7xl mx-auto px-8">
                {/* Configuration: Aspect Ratio */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Camera className="w-3.5 h-3.5 text-orange-500" />
                        <h3 className="font-bold text-pastel-text text-[11px] uppercase tracking-wider">输出画布比例</h3>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                        {RATIO_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setSelectedRatio(opt.value)}
                                className={`group relative p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                                    selectedRatio === opt.value 
                                    ? 'bg-white border-orange-500 shadow-md scale-[1.01]' 
                                    : 'bg-white/50 border-pastel-border hover:border-pastel-highlight hover:bg-white shadow-sm'
                                }`}
                            >
                                <span className="text-lg mb-0.5">{opt.icon}</span>
                                <span className={`font-bold text-[11px] ${selectedRatio === opt.value ? 'text-orange-600' : 'text-pastel-text'}`}>
                                    {opt.label}
                                </span>
                                <span className="text-[9px] text-pastel-muted font-medium opacity-80">{opt.desc}</span>
                                {selectedRatio === opt.value && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white p-0.5 rounded-full shadow-md">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    
                    {/* Left Column: Inputs & Advanced */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {/* Standard Reference */}
                            <div className="bg-white rounded-[1.5rem] border border-pastel-border p-4 shadow-sm flex flex-col min-h-[220px]">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-pastel-text text-[10px] flex items-center gap-1.5 uppercase tracking-tighter">
                                        <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                                        1. 产品标准基准图
                                    </h3>
                                    {standardImages.length > 0 && (
                                        <button onClick={() => runStructuralAnalysis(standardImages)} disabled={isAnalyzing} className="p-1 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors">
                                            <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                                        </button>
                                    )}
                                </div>
                                <div 
                                    onClick={() => standardInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, 'standard')}
                                    onPaste={(e) => handlePaste(e, 'standard')}
                                    tabIndex={0}
                                    className={`relative flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50 ${
                                        standardImages.length > 0 ? 'border-green-100 bg-green-50/5' : 'border-pastel-border hover:border-pastel-highlight bg-pastel-bg/10'
                                    }`}
                                >
                                    <input ref={standardInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleStandardFiles(e.target.files)} accept="image/*" />
                                    {standardImages.length > 0 ? (
                                        <div className="w-full h-full p-1.5 flex flex-col gap-2">
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {standardImages.map((img, idx) => (
                                                    <div key={`${img.preview}-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-green-100 bg-white">
                                                        <img src={img.preview} className="w-full h-full object-cover" alt={`standard-${idx + 1}`} />
                                                        <span className="absolute left-1 top-1 px-1.5 py-0.5 rounded bg-black/50 text-white text-[8px] font-black">
                                                            #{idx + 1}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const nextImages = standardImages.filter((_, i) => i !== idx);
                                                                setStandardImages(nextImages);
                                                                if (nextImages.length > 0) runStructuralAnalysis(nextImages);
                                                                else setAnalysisResult(null);
                                                            }}
                                                            className="absolute right-1 top-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {standardImages.length < STANDARD_IMAGE_LIMIT && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); standardInputRef.current?.click(); }}
                                                        className="aspect-square rounded-lg border border-dashed border-green-200 bg-white/70 flex flex-col items-center justify-center text-green-600 text-[9px] font-bold"
                                                    >
                                                        <Upload className="w-4 h-4 mb-1" />
                                                        添加
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-pastel-muted text-center">已上传 {standardImages.length}/{STANDARD_IMAGE_LIMIT} 张标准参考图</p>
                                        </div>
                                    ) : (
                                        <div className="text-center p-4">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-pastel-border flex items-center justify-center mx-auto mb-2">
                                                <Upload className="w-5 h-5 text-pastel-muted" />
                                            </div>
                                            <p className="text-[11px] font-bold text-pastel-text">上传 1:1 标准图</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Target to Repair */}
                            <div className="bg-white rounded-[1.5rem] border border-pastel-border p-4 shadow-sm flex flex-col min-h-[220px]">
                                <h3 className="font-bold text-pastel-text text-[10px] mb-3 flex items-center gap-1.5 uppercase tracking-tighter">
                                    <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                                    2. 待修复/生成的场景图
                                </h3>
                                <div 
                                    onClick={() => targetInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, 'target')}
                                    onPaste={(e) => handlePaste(e, 'target')}
                                    tabIndex={0}
                                    className={`relative flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 ${
                                        targetImage ? 'border-blue-100 bg-blue-50/5' : 'border-pastel-border hover:border-pastel-highlight bg-pastel-bg/10'
                                    }`}
                                >
                                    <input ref={targetInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'target')} accept="image/*" />
                                    {targetImage ? (
                                        <div className="relative group w-full h-full p-1.5">
                                            <img src={maskDataUrl || targetImage.preview} className="w-full h-full object-contain rounded-xl" alt="target" />
                                            {maskDataUrl && (
                                                <div className="absolute left-3 top-3 px-2 py-1 rounded-lg bg-red-500 text-white text-[9px] font-black shadow">
                                                    已标记修复区域
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsMaskEditorOpen(true); }}
                                                        className="px-3 py-1.5 bg-white text-pastel-text rounded-full shadow-lg text-[10px] font-bold flex items-center gap-1"
                                                    >
                                                        <Brush className="w-3 h-3" />
                                                        标记区域
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setTargetImage(null); setMaskDataUrl(null); setMaskOverlayDataUrl(null); setMaskRegionSummary(''); }} className="p-1.5 bg-red-500 text-white rounded-full shadow-lg"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-4">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-pastel-border flex items-center justify-center mx-auto mb-2">
                                                <Layers className="w-5 h-5 text-pastel-muted" />
                                            </div>
                                            <p className="text-[11px] font-bold text-pastel-text">上传待修复图</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Repair Targeting */}
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border p-4 shadow-sm space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-pastel-text text-xs flex items-center gap-2">
                                        <Brush className="w-4 h-4 text-orange-500" />
                                        修复定位与问题类型
                                    </h3>
                                    <p className="text-[9px] text-pastel-muted mt-1">手动标记区域时，AI 会优先只修红色涂抹区域。</p>
                                </div>
                                <div className="flex rounded-full bg-pastel-bg p-1 border border-pastel-border">
                                    <button
                                        onClick={() => setRepairScopeMode('auto')}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${repairScopeMode === 'auto' ? 'bg-white text-pastel-text shadow-sm' : 'text-pastel-muted'}`}
                                    >
                                        自动识别
                                    </button>
                                    <button
                                        onClick={() => targetImage && setIsMaskEditorOpen(true)}
                                        disabled={!targetImage}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all disabled:opacity-40 ${repairScopeMode === 'manual' ? 'bg-orange-500 text-white shadow-sm' : 'text-pastel-muted'}`}
                                    >
                                        手动涂抹
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {REPAIR_TYPES.map(type => {
                                    const selected = selectedRepairTypes.includes(type.id);
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => {
                                                setSelectedRepairTypes(prev =>
                                                    selected ? prev.filter(id => id !== type.id) : [...prev, type.id]
                                                );
                                            }}
                                            className={`px-3 py-2 rounded-xl border text-[10px] font-bold transition-all ${
                                                selected
                                                    ? 'bg-orange-50 border-orange-200 text-orange-600'
                                                    : 'bg-gray-50 border-gray-100 text-pastel-muted hover:border-orange-100'
                                            }`}
                                        >
                                            {type.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Wizard Section */}
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border overflow-hidden shadow-sm">
                            <button 
                                onClick={() => setIsWizardOpen(!isWizardOpen)}
                                className={`w-full p-4 flex items-center justify-between transition-colors ${isWizardOpen ? 'bg-orange-50/30' : 'hover:bg-pastel-bg/10'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg transition-colors ${isWizardOpen ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-500'}`}>
                                        <Lightbulb className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-pastel-text text-xs flex items-center gap-2">
                                            输入补充向导
                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-500 text-[8px] rounded-md font-black uppercase">建议填写</span>
                                        </h3>
                                        <p className="text-[9px] text-pastel-muted">提供更多商品细节，AI 修复将更精准</p>
                                    </div>
                                </div>
                                {isWizardOpen ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                            </button>
                            
                            {isWizardOpen && (
                                <div className="px-5 pb-5 pt-2 animate-slide-down">
                                    <div className="grid grid-cols-1 gap-4">
                                        {/* Product Details */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-pastel-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                <ListTodo className="w-3 h-3 text-orange-400" />
                                                商品细节
                                            </label>
                                            <textarea 
                                                value={wizardData.details}
                                                onChange={(e) => setWizardData({...wizardData, details: e.target.value})}
                                                placeholder="如：材质、尺寸、颜色、特殊工艺细节等..."
                                                className="w-full p-3 bg-pastel-bg/20 border border-pastel-border rounded-xl text-[11px] text-pastel-text focus:ring-2 focus:ring-orange-200 outline-none min-h-[60px] resize-none placeholder:text-pastel-muted/50"
                                            />
                                        </div>

                                        {/* Selling Points */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-pastel-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                <Zap className="w-3 h-3 text-yellow-500" />
                                                核心卖点
                                            </label>
                                            <textarea 
                                                value={wizardData.sellingPoints}
                                                onChange={(e) => setWizardData({...wizardData, sellingPoints: e.target.value})}
                                                placeholder="如：防水耐磨、多隔层大容量、轻便透气等..."
                                                className="w-full p-3 bg-pastel-bg/20 border border-pastel-border rounded-xl text-[11px] text-pastel-text focus:ring-2 focus:ring-yellow-200 outline-none min-h-[60px] resize-none placeholder:text-pastel-muted/50"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Audience */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-pastel-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                    <User className="w-3 h-3 text-blue-400" />
                                                    面向人群
                                                </label>
                                                <textarea 
                                                    value={wizardData.audience}
                                                    onChange={(e) => setWizardData({...wizardData, audience: e.target.value})}
                                                    placeholder="如：20~30岁、运动爱好者等..."
                                                    className="w-full p-3 bg-pastel-bg/20 border border-pastel-border rounded-xl text-[11px] text-pastel-text focus:ring-2 focus:ring-blue-200 outline-none min-h-[60px] resize-none placeholder:text-pastel-muted/50"
                                                />
                                            </div>

                                            {/* Scenarios */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-pastel-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                    <MapPin className="w-3 h-3 text-green-400" />
                                                    使用场景
                                                </label>
                                                <textarea 
                                                    value={wizardData.scenarios}
                                                    onChange={(e) => setWizardData({...wizardData, scenarios: e.target.value})}
                                                    placeholder="如：通勤、旅行、户外运动等..."
                                                    className="w-full p-3 bg-pastel-bg/20 border border-pastel-border rounded-xl text-[11px] text-pastel-text focus:ring-2 focus:ring-green-200 outline-none min-h-[60px] resize-none placeholder:text-pastel-muted/50"
                                                />
                                            </div>
                                        </div>

                                        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2">
                                            <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                                            <p className="text-[9px] text-blue-600 leading-normal">
                                                <strong>小贴士：</strong> 先给 AI 一点上下文信息，再让 AI 进行结构分析和修复，结果通常会更贴近真实商品，生成效果更稳定。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Analysis Card */}
                        {isAnalyzing || analysisResult ? (
                            <div className="bg-white rounded-[1.5rem] border border-pastel-border p-4 shadow-sm animate-fade-in">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-purple-50 rounded-lg">
                                            <Brain className="w-4 h-4 text-purple-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-pastel-text text-xs">Agent 智能结构解析</h3>
                                            <p className="text-[9px] text-pastel-muted">已自动识别品类特征并注入修复逻辑</p>
                                        </div>
                                    </div>
                                    {analysisResult?.category && (
                                        <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[9px] font-bold border border-green-100">
                                            {analysisResult.category === 'plush' ? '🧸 玩偶' : analysisResult.category === 'apparel' ? '👕 服装' : '📦 通用'}
                                        </span>
                                    )}
                                </div>
                                {isAnalyzing ? (
                                    <div className="py-4 flex flex-col items-center justify-center space-y-2">
                                        <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                                        <p className="text-[10px] text-pastel-muted font-medium">正在提取结构骨架...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                                                <span className="text-[9px] text-purple-600 font-bold block mb-0.5 uppercase">核心材质</span>
                                                <span className="text-[10px] text-pastel-text font-bold leading-tight">{analysisResult.material}</span>
                                            </div>
                                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                                <span className="text-[9px] text-blue-600 font-bold block mb-0.5 uppercase">几何结构</span>
                                                <span className="text-[10px] text-pastel-text font-bold leading-tight">{analysisResult.structure}</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-pastel-bg/50 rounded-xl border border-pastel-border">
                                            <span className="text-[9px] text-pastel-muted font-bold block mb-2 uppercase tracking-widest">修复锚点</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {analysisResult.details.map((d: string, i: number) => (
                                                    <span key={i} className="px-2 py-1 bg-white border border-pastel-border rounded-lg text-[9px] text-pastel-text font-bold shadow-sm flex items-center gap-1">
                                                        <div className="w-1 h-1 rounded-full bg-green-500" />
                                                        {d}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {/* Advanced Settings */}
                        <div className="bg-white rounded-[1.5rem] border border-pastel-border overflow-hidden shadow-sm">
                            <button 
                                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                className="w-full p-4 flex items-center justify-between hover:bg-pastel-bg/10 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-orange-500" />
                                    <h3 className="font-bold text-pastel-text text-xs">高级参数与手动覆盖</h3>
                                </div>
                                {isAdvancedOpen ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                            </button>
                            
                            {isAdvancedOpen && (
                                <div className="px-4 pb-4 space-y-4 animate-slide-down">
                                    {/* Model Selection */}
                                    <div>
                                        <span className="text-[9px] font-bold text-pastel-muted uppercase tracking-widest block mb-2">图像生成模型</span>
                                        <div className="grid grid-cols-1 gap-2">
                                            {MODEL_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setSelectedModel(opt.id)}
                                                    className={`p-2.5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                                                        selectedModel === opt.id 
                                                        ? 'bg-orange-50/30 border-orange-500' 
                                                        : 'bg-white border-pastel-border hover:border-pastel-highlight'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-[11px] text-pastel-text">{opt.name}</span>
                                                            <span className="text-[8px] bg-white border border-pastel-border px-1.5 py-0.5 rounded-full text-pastel-muted font-bold">{opt.sub}</span>
                                                        </div>
                                                        <p className="text-[9px] text-pastel-muted mt-0.5">{opt.desc}</p>
                                                    </div>
                                                    {selectedModel === opt.id && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Resolution Selection */}
                                    <div>
                                        <span className="text-[9px] font-bold text-pastel-muted uppercase tracking-widest block mb-2">生成分辨率</span>
                                        <div className="flex gap-2">
                                            {[ImageResolution.RES_2K, ImageResolution.RES_4K].map((res) => (
                                                <button
                                                    key={res}
                                                    onClick={() => setSelectedResolution(res)}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold border-2 transition-all ${
                                                        selectedResolution === res 
                                                        ? 'bg-pastel-text text-white border-pastel-text shadow-sm' 
                                                        : 'bg-white text-pastel-text border-pastel-border hover:border-pastel-highlight'
                                                    }`}
                                                >
                                                    {res === ImageResolution.RES_4K ? '4K Ultra' : '2K Std'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleRepair} 
                            disabled={isLoading || !standardImage || !targetImage}
                            className={`w-full py-4 rounded-2xl font-black text-base text-white shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 ${
                                isLoading || !standardImage || !targetImage 
                                ? 'bg-gray-200 cursor-not-allowed text-gray-400 shadow-none' 
                                : 'bg-gradient-to-r from-orange-500 to-pink-500'
                            }`}
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                            {isLoading ? 'Agent 正在进行结构重组...' : '启动高保真修复'}
                        </button>
                    </div>

                        {isLoading && (
                            <button
                                type="button"
                                onClick={handleCancelRepair}
                                className="w-full py-3 rounded-2xl font-black text-white bg-gray-800 hover:bg-gray-900 transition-all shadow-lg"
                            >
                                中止生成
                            </button>
                        )}
                        {cancelMessage && !isLoading && (
                            <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>
                        )}
                    {/* Right Column: Results */}
                    <div className="flex flex-col sticky top-4">
                        <div className="bg-white rounded-[2rem] border border-pastel-border p-5 shadow-sm flex-1 flex flex-col relative min-h-[500px]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                                        <ImageIcon className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-pastel-text text-base">修复结果展示</h3>
                                        <p className="text-[9px] text-pastel-muted font-bold uppercase tracking-widest opacity-60">Generated Artifacts</p>
                                    </div>
                                </div>
                                {error && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 animate-shake">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 bg-pastel-bg/20 rounded-[1.5rem] border-2 border-dashed border-pastel-border flex flex-col relative overflow-hidden group/result">
                                {isLoading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 z-10 bg-white/95 backdrop-blur-xl animate-fade-in">
                                        <div className="relative">
                                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-xl border-4 border-orange-50 animate-bounce-slow">
                                                {COT_STEPS[currentStep].icon}
                                            </div>
                                            <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-orange-500 to-pink-500 text-white rounded-lg flex items-center justify-center text-[10px] font-black shadow-md ring-2 ring-white">
                                                {currentStep + 1}
                                            </div>
                                        </div>
                                        <div className="text-center space-y-2 px-8">
                                            <h4 className="font-black text-lg text-pastel-text tracking-tighter">{COT_STEPS[currentStep].label}</h4>
                                            <p className="text-[10px] text-pastel-muted font-bold leading-relaxed">{COT_STEPS[currentStep].desc}</p>
                                        </div>
                                        <div className="w-full max-w-[200px] px-4">
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                                                <div className="h-full bg-gradient-to-r from-orange-500 to-purple-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                                            </div>
                                            <div className="flex justify-between mt-2 text-[9px] font-bold text-pastel-muted uppercase tracking-tighter">
                                                <span>Repairing...</span>
                                                <span>{progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : generatedImages.length > 0 ? (
                                    <div className="w-full h-full p-6 overflow-y-auto flex flex-col items-center">
                                        <div className="flex flex-col items-center gap-6">
                                            {generatedImages.map((img, idx) => (
                                                <div key={idx} className="relative group/img rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-white max-w-full animate-scale-up">
                                                    <img src={img} className="w-full h-auto object-contain max-h-[60vh]" alt="repaired" />
                                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/img:opacity-100 transition-all duration-300 flex items-center justify-center gap-4 backdrop-blur-md">
                                                        <button onClick={() => setSelectedPreview(img)} className="p-3.5 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all shadow-xl border border-white/20"><ZoomIn className="w-6 h-6" /></button>
                                                        <button onClick={() => handleDownload(img)} className="p-3.5 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all shadow-xl border border-white/20"><Download className="w-6 h-6" /></button>
                                                    </div>
                                                    <div className="absolute bottom-4 left-4 right-4 py-2 px-4 bg-black/20 backdrop-blur-xl rounded-xl text-white text-[9px] font-bold border border-white/10 flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                            <span>1:1 结构精修已完成</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Repair Details Summary Under the Image */}
                                            {analysisResult && (
                                                <div className="w-full mt-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-pastel-border shadow-sm animate-slide-up">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="p-1.5 bg-orange-50 rounded-lg">
                                                            <ShieldCheck className="w-4 h-4 text-orange-500" />
                                                        </div>
                                                        <h4 className="font-black text-pastel-text text-sm">修复详情与空间映射</h4>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-pastel-muted uppercase tracking-widest block mb-2">已修复的结构性问题：</span>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {analysisResult.details.map((detail: string, i: number) => (
                                                                    <div key={i} className="flex items-start gap-2 p-2 bg-pastel-bg/30 rounded-xl border border-pastel-border/50">
                                                                        <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                                                                        <span className="text-[10px] text-pastel-text font-bold leading-tight">{detail}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="pt-3 border-t border-pastel-border/50 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Zap className="w-3 h-3 text-purple-500" />
                                                                <span className="text-[10px] text-pastel-muted font-bold">修复强度：高保真 (Structural-Lock V2)</span>
                                                            </div>
                                                            <span className="text-[10px] text-pastel-highlight font-black">100% 几何对齐</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4 opacity-40">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center shadow-sm border border-pastel-border">
                                                <Hammer className="w-8 h-8 text-pastel-border" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-sm font-black text-pastel-text tracking-tighter">等待精修指令</p>
                                            <p className="text-[10px] text-pastel-muted max-w-[200px] leading-relaxed font-medium">
                                                请在左侧上传标准图与待修复图
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mask Editor Modal */}
            {isMaskEditorOpen && targetImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 backdrop-blur-xl" onClick={() => setIsMaskEditorOpen(false)}>
                    <div className="w-full max-w-5xl bg-white rounded-[2rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-pastel-border flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-pastel-text flex items-center gap-2">
                                    <Brush className="w-5 h-5 text-orange-500" />
                                    手动标记修复区域
                                </h3>
                                <p className="text-xs text-pastel-muted mt-1">在待修复图上涂红色区域。生成时仅允许 AI 修复红色标记位置。</p>
                            </div>
                            <button onClick={() => setIsMaskEditorOpen(false)} className="p-2 rounded-full hover:bg-pastel-bg text-pastel-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
                            <div className="relative rounded-2xl overflow-hidden bg-black/5 border border-pastel-border aspect-square w-full max-h-[70vh] max-w-[70vh] mx-auto">
                                <img src={targetImage.preview} className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none" alt="mask-target" />
                                <canvas
                                    ref={maskCanvasRef}
                                    width={1024}
                                    height={1024}
                                    className="absolute inset-0 w-full h-full cursor-none touch-none"
                                    onPointerDown={startMaskDrawing}
                                    onPointerMove={moveMaskDrawing}
                                    onPointerUp={endMaskDrawing}
                                    onPointerEnter={updateBrushPreview}
                                    onPointerLeave={hideBrushPreview}
                                />
                                {brushPreview.visible && (
                                    <div
                                        className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(255,96,32,0.95),0_0_12px_rgba(255,96,32,0.45)] bg-orange-500/10"
                                        style={{
                                            width: brushSize * 2,
                                            height: brushSize * 2,
                                            left: brushPreview.x - brushSize,
                                            top: brushPreview.y - brushSize
                                        }}
                                    />
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100">
                                    <p className="text-xs font-black text-orange-600 mb-2">涂抹原则</p>
                                    <p className="text-[11px] text-orange-700 leading-relaxed">只涂需要修复的商品区域，不要涂背景、手、人物或不需要变化的地方。</p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-pastel-muted mb-2 block">画笔大小：{brushSize}px</label>
                                    <input
                                        type="range"
                                        min={8}
                                        max={64}
                                        value={brushSize}
                                        onChange={(e) => setBrushSize(Number(e.target.value))}
                                        className="w-full accent-orange-500"
                                    />
                                </div>

                                <button
                                    onClick={clearMask}
                                    className="w-full py-3 rounded-xl border border-pastel-border text-pastel-text hover:bg-pastel-bg flex items-center justify-center gap-2 text-sm font-bold"
                                >
                                    <Eraser className="w-4 h-4" />
                                    清除涂抹
                                </button>
                                <button
                                    onClick={saveMask}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white flex items-center justify-center gap-2 text-sm font-black shadow-lg"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    保存修复区域
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {selectedPreview && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 backdrop-blur-2xl animate-fade-in" onClick={() => setSelectedPreview(null)}>
                    <div className="relative max-w-7xl max-h-[90vh] bg-white rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
                        <img src={selectedPreview} className="max-h-[80vh] w-auto object-contain" alt="preview" />
                        <button onClick={() => setSelectedPreview(null)} className="absolute top-8 right-8 p-3 bg-black/20 hover:bg-black/50 text-white rounded-full transition-all backdrop-blur-md shadow-2xl active:scale-90"><X className="w-8 h-8" /></button>
                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white/90 to-transparent flex justify-center">
                             <button onClick={() => handleDownload(selectedPreview)} className="px-10 py-4 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-[1.5rem] font-black text-base shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3">
                                <Download className="w-5 h-5" />
                                下载商业级高清大图
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductRepairTab;
