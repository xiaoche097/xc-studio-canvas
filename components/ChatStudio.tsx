import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Message, WorkflowStep } from '../types';
import { AGENT_PROMPTS } from '../data/agentPrompts';
import { SendIcon, UploadIcon } from './Icons';
import { MessageBubble, TypingIndicator } from './ChatComponents';
import { PromptInspector } from './PromptInspector';
import { gemini } from '../lib/gemini';
import { 
  LaunchPackageCard, 
  StrategyCard, 
  VisualGuidelinesCard, 
  CopywritingCard, 
  ProductionCard,
  ProductionSelectCard 
} from './ActionCards';

interface ChatStudioProps {
  initialInput: string;
  initialImages: string[];
  initialModel: string;
  onBack: () => void;
}

export const ChatStudio: React.FC<ChatStudioProps> = ({ initialInput, initialImages, initialModel, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(WorkflowStep.INIT);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  // Sync messagesRef with messages state for async access
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll logic
  const scrollToBottom = () => {
    if (scrollRef.current) {
        // Use smooth scroll for better UX
        scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Initialization Sequence
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Don't add to messages state yet, let triggerStep handle the first interaction
    // Or add a "System Welcome". 
    // Agent workflow: User initialized with input -> System responds.
    
    // We'll mimic the user "sending" the initial input
    const initUserMsg: Message = {
        id: 'init-user',
        role: 'user',
        content: initialInput || 'Start Generation',
        image: initialImages[0] || null,
        images: initialImages,
        timestamp: Date.now()
    };
    
    setMessages([initUserMsg]);
    // CRITICAL FIX: Manually update ref immediately so triggerStep sees it even before render cycle completes
    messagesRef.current = [initUserMsg];

    setTimeout(() => {
       // Context-aware Prompting:
       // If user provided text, we command the agent to respect it.
       // If not, we command the agent to auto-infer.
       const isAutoMode = !initialInput; 
       const prompt = isAutoMode
        ? "用户未提供文本描述。请基于上传的图片，全自动智能推断该产品的名称、品类、材质、核心卖点及最适合的全球目标市场，生成启动包。"
        : "请严格基于用户的上述具体需求描述，并结合图片分析，生成启动包。重要原则：用户的文本指令（如特定市场、特定材质、特定卖点）拥有最高优先级，必须被包含在启动包中。";

       triggerStep(WorkflowStep.LAUNCH_PACKAGE, prompt, initialImages); 
    }, 800);
  }, []); // Remove dependencies to run once exactly

  const triggerStep = async (step: WorkflowStep, promptText: string, images: string[] = []) => {
    setWorkflowStep(step);
    setIsTyping(true);

    const systemPrompt = AGENT_PROMPTS[step].systemPrompt;
    
    const aiMsgId = Date.now().toString();
    const newAiMsg: Message = {
        id: aiMsgId,
        role: 'ai',
        content: '',
        timestamp: Date.now()
    };
    setMessages(prev => [...prev, newAiMsg]);

    // Construct History
    let historyForGemini;
    let actualPrompt = promptText;

    // We will use the 'messages' from the REF to ensure we have latest state even in closures
    // Filter out the AI message we just optimistically added (it is not in Ref yet anyway usually, but good to be safe)
    const validMessages = messagesRef.current.filter(m => m.content && m.id !== aiMsgId);
    
    const isPromptLastMessage = validMessages.length > 0 && validMessages[validMessages.length - 1].content === promptText;
    
    const historySource = isPromptLastMessage ? validMessages.slice(0, -1) : validMessages;
    
    historyForGemini = historySource.map(m => {
        const parts: any[] = [{ text: m.content }];
        if (m.images && m.images.length > 0) {
            m.images.forEach(img => {
                const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
                if (match) {
                    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                }
            });
        }
        return {
            role: m.role === 'ai' ? 'model' : 'user',
            parts: parts
        };
    });

    try {
        const streamResult = await gemini.generateContentStream(
            actualPrompt, 
            images, 
            historyForGemini, 
            systemPrompt, 
            initialModel
        );
        
        for await (const chunk of streamResult.stream) {
            const chunkText = chunk.text();
            setMessages(prev => prev.map(m => 
                m.id === aiMsgId 
                ? { ...m, content: m.content + chunkText } 
                : m
            ));
        }
    } catch (e) {
        console.error("Gemini Error:", e);
        setMessages(prev => prev.map(m => 
            m.id === aiMsgId 
            ? { ...m, content: m.content + `\n\n**[Connection Error]** ${e instanceof Error ? e.message : String(e)}\n\n*Check API Key configuration.*` } 
            : m
        ));
    } finally {
        setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() && selectedImages.length === 0) return;

    const userMsg: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        content: inputValue.trim(),
        images: selectedImages.length > 0 ? [...selectedImages] : undefined,
        timestamp: Date.now()
    };
      
    // Add to state
    setMessages(prev => [...prev, userMsg]);
    
    // Intelligent Context Handling
    if (!isTyping && workflowStep !== WorkflowStep.COMPLETED && workflowStep !== WorkflowStep.INIT) {
       triggerStep(workflowStep, inputValue.trim(), selectedImages);
    } else {
       triggerStep(workflowStep, inputValue.trim(), selectedImages);
    }
    
    setInputValue('');
    setSelectedImages([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length + selectedImages.length > 5) {
        alert("最多只能上传 5 张图片");
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setSelectedImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUserConfirm = (nextStep: WorkflowStep) => {
    // Add confirmation message
    const confirmMsg = "✅ 确认通过，继续下一步";
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: confirmMsg,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    
    let nextPrompt = "继续下一步";
    switch(nextStep) {
        case WorkflowStep.STRATEGY_P0: 
            nextPrompt = "基于上述确认的启动包信息（特别是产品卖点和目标市场），生成 P0 电商运营策略。"; 
            break;
        case WorkflowStep.VISUAL_P1: 
            nextPrompt = "基于上述确认的 P0 策略（定位与关键词），推导并生成 P1 视觉规范。"; 
            break;
        case WorkflowStep.COPY_P2: 
            nextPrompt = "基于 P0 策略定位和 P1 视觉基调，撰写 P2 营销文案。"; 
            break;
        case WorkflowStep.PRODUCTION_SELECT:
            // 不触发AI，只更新步骤显示选择界面
            setWorkflowStep(WorkflowStep.PRODUCTION_SELECT);
            const selectMsg: Message = {
              id: Date.now().toString() + '_select',
              role: 'ai',
              content: '🎨 **策略与文案已就绪！**\n\n启动包、P0策略、P1视觉、P2文案已全部完成。\n\n请选择要生成的图片资产：\n- **P3 主图**：Amazon合规主图\n- **P4 副图序列**：6张信息图/场景图/细节图\n- **P5 A+ 页面**：Premium A+模块\n- **全部生成**：一次性完成所有图片\n\n点击下方按钮开始生成 👇',
              timestamp: Date.now()
            };
            setMessages(prev => [...prev, selectMsg]);
            return;
        case WorkflowStep.PRODUCTION_P3_P5: 
            nextPrompt = "执行生产：严格遵循确认的文案和视觉规范，生成 P3-P5 核心视觉资产。"; 
            break;
    }

    // Same logic as handleSend: 'messages' in scope is history.
    triggerStep(nextStep, nextPrompt);
  };

  // 处理生产选择（P3/P4/P5/All）
  const handleProductionSelect = (choice: 'main' | 'secondary' | 'aplus' | 'all') => {
    let nextStep: WorkflowStep;
    let prompt: string;
    let choiceLabel: string;

    switch (choice) {
      case 'main':
        nextStep = WorkflowStep.P3_MAIN_IMAGE;
        prompt = "生成P3主图设计方案和提示词。要求：纯白背景、产品占比≥85%、左偏15°悬浮效果、接触软阴影。输出完整的图像生成prompt和nanobanana2pro JSON。";
        choiceLabel = "📸 P3 主图";
        break;
      case 'secondary':
        nextStep = WorkflowStep.P4_SECONDARY;
        prompt = "生成P4副图序列设计方案。包括6张：S1核心卖点信息图、S2功能细节图、S3使用场景图、S4材质细节图、S5规格图、S6包装信任图。每张图输出完整prompt。";
        choiceLabel = "🖼️ P4 副图序列";
        break;
      case 'aplus':
        nextStep = WorkflowStep.P5_APLUS;
        prompt = "生成P5 A+页面设计方案。包括6个Premium模块：M1品牌宣言头图(1464x600)、M2系列身份卡、M3核心卖点可视化、M4场景矩阵、M5细节特写、M6品牌足迹。每个模块输出完整prompt。";
        choiceLabel = "🏗️ P5 A+ 页面";
        break;
      case 'all':
      default:
        nextStep = WorkflowStep.PRODUCTION_P3_P5;
        prompt = "执行完整生产：按顺序生成P3主图、P4副图序列、P5 A+页面的全部设计方案和提示词。严格遵循品牌规范。";
        choiceLabel = "🚀 全部生成（P3+P4+P5）";
        break;
    }

    // 添加用户选择消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `已选择：${choiceLabel}`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);

    // 触发对应步骤
    triggerStep(nextStep, prompt);
  };

  // 继续生成其他图片类型（返回选择界面）
  const handleContinueProduction = () => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: '🔄 继续生成其他图片',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    
    // 返回到选择界面
    setWorkflowStep(WorkflowStep.PRODUCTION_SELECT);
    const selectMsg: Message = {
      id: Date.now().toString() + '_continue',
      role: 'ai',
      content: '🎨 **请选择下一个要生成的图片类型：**\n\n- **P3 主图**：Amazon合规主图\n- **P4 副图序列**：6张信息图/场景图/细节图\n- **P5 A+ 页面**：Premium A+模块\n\n点击下方按钮继续 👇',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, selectMsg]);
  };
  
  // Helper to clean extracted value - removes markdown formatting and trims
  const cleanValue = (val: string | undefined): string => {
    if (!val) return '';
    return val
      .replace(/\*\*/g, '')
      .replace(/\|/g, '')
      .replace(/^\s*[-*•]\s*/, '')
      .replace(/^#+\s*/, '')
      .trim();
  };

  // Helper to extract value by key from content with multiple pattern support
  const extractByKey = (content: string, keyPatterns: string[]): string => {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      for (const key of keyPatterns) {
        // Pattern 1: Table format | key | value |
        const tableRegex = new RegExp(`\\|\\s*${key}[^|]*\\|\\s*([^|]+)\\s*\\|`, 'i');
        const tableMatch = trimmed.match(tableRegex);
        if (tableMatch) return cleanValue(tableMatch[1]);
        
        // Pattern 2: Key-value format: key: value or key：value or **key**: value
        const kvRegex = new RegExp(`(?:\\*\\*)?${key}[^:：]*(?:\\*\\*)?[：:]\\s*(.+)`, 'i');
        const kvMatch = trimmed.match(kvRegex);
        if (kvMatch) return cleanValue(kvMatch[1]);
        
        // Pattern 3: Markdown header followed by content: ### 定位\n内容
        const headerRegex = new RegExp(`^#{1,4}\\s*${key}`, 'i');
        if (trimmed.match(headerRegex) && i + 1 < lines.length) {
          // Get next non-empty line as the value
          for (let j = i + 1; j < lines.length && j < i + 4; j++) {
            const nextLine = lines[j].trim();
            if (nextLine && !nextLine.startsWith('#') && nextLine.length > 2) {
              return cleanValue(nextLine);
            }
          }
        }
        
        // Pattern 4: Bold section header with content on same or next line: **定位**: 内容
        const boldHeaderRegex = new RegExp(`\\*\\*${key}\\*\\*`, 'i');
        if (trimmed.match(boldHeaderRegex)) {
          // Check if value is on same line after colon
          const colonMatch = trimmed.match(/\*\*[^*]+\*\*[：:]\s*(.+)/);
          if (colonMatch && colonMatch[1]) {
            return cleanValue(colonMatch[1]);
          }
          // Otherwise check next line
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('*')) {
              return cleanValue(nextLine);
            }
          }
        }
      }
    }
    return '';
  };

  // Helper to extract list items after a header
  const extractListAfterHeader = (content: string, headerPatterns: string[], maxItems: number = 5): string[] => {
    const lines = content.split('\n');
    const results: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      const matchesHeader = headerPatterns.some(p => line.includes(p.toLowerCase()));
      
      if (matchesHeader) {
        // Look for list items in subsequent lines
        for (let j = i + 1; j < lines.length && results.length < maxItems; j++) {
          const nextLine = lines[j].trim();
          // Stop if we hit another header or empty section
          if (nextLine.match(/^#{1,3}\s/) || nextLine.match(/^\*\*[^*]+\*\*[：:]/)) break;
          
          // Extract bullet/numbered list items
          if (nextLine.match(/^[-*•]\s+/) || nextLine.match(/^\d+[.)]\s+/)) {
            const itemText = cleanValue(nextLine.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, ''));
            if (itemText && itemText.length > 2) {
              results.push(itemText.substring(0, 50));
            }
          }
        }
        if (results.length > 0) break;
      }
    }
    return results;
  };

  // Helper function to extract structured data from AI response for summary cards
  const extractStepData = (content: string, step: WorkflowStep) => {
    try {
      const lines = content.split('\n');
      
      if (step === WorkflowStep.LAUNCH_PACKAGE) {
        // LAUNCH_PACKAGE - Enhanced extraction for product information
        
        // Product name extraction with multiple patterns
        let productName = extractByKey(content, ['产品名称', 'Product Name', '产品', '产品英文名']);
        if (!productName) {
          // Try to find product name from first section
          for (const line of lines) {
            const trimmed = line.trim();
            // Look for emphasized product names
            const emphMatch = trimmed.match(/^(?:#{1,3}\s*)?(?:\*\*)?(?:产品)?[：:]\s*(.{5,50})$/);
            if (emphMatch && !emphMatch[1].includes('策略') && !emphMatch[1].includes('Brief')) {
              productName = cleanValue(emphMatch[1]);
              break;
            }
          }
        }
        
        // Market extraction with more patterns
        let market = extractByKey(content, ['目标站点', '目标市场', 'Target Market', 'Target Site', '市场', '主要市场', '销售站点']);
        if (!market) {
          // Look for Amazon mentions
          const amazonMatch = content.match(/Amazon\s*([A-Z]{2}|美国|德国|日本|UK|US|DE|JP)/i);
          if (amazonMatch) {
            market = 'Amazon ' + amazonMatch[1];
          }
        }
        
        // Material extraction
        let material = extractByKey(content, ['材质', 'Material', '主材质', '面料', '材料']);
        if (!material) {
          // Look for common material keywords
          const materialPatterns = ['尼龙', 'Nylon', '涤纶', 'Polyester', '帆布', 'Canvas', '皮革', 'Leather', 'Ripstop'];
          for (const pattern of materialPatterns) {
            if (content.includes(pattern)) {
              const idx = content.indexOf(pattern);
              const context = content.substring(Math.max(0, idx - 10), Math.min(content.length, idx + 30));
              material = cleanValue(context.match(/[^,，。\n|]+/)?.[0] || pattern);
              break;
            }
          }
        }
        
        // Category extraction
        let category = extractByKey(content, ['品类', 'Category', '产品品类', '产品类型']);
        if (!category) {
          // Look for common category keywords
          const categoryPatterns = ['背包', '帐篷', '睡袋', '登山杖', '户外装备', 'Backpack', 'Tent'];
          for (const pattern of categoryPatterns) {
            if (content.toLowerCase().includes(pattern.toLowerCase())) {
              category = pattern;
              break;
            }
          }
        }
        
        // Enhanced selling points extraction
        const features: string[] = [];
        
        // Pattern 1: | P0 | 卖点内容 | table format
        // Pattern 2: P0: 卖点内容 or P0：卖点内容
        // Pattern 3: **P0** 卖点内容
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Table format with P-tag
          const tableMatch = trimmed.match(/\|\s*\*?\*?[Pp][012]\*?\*?\s*\|\s*(.+?)\s*\|/);
          // Key-value format
          const kvMatch = trimmed.match(/^(?:\*\*)?[Pp][012](?:\*\*)?[：:|\s]+(.+?)(?:\||$)/);
          // Bold format
          const boldMatch = trimmed.match(/\*\*[Pp][012]\*\*[：:\s]*(.+)/);
          
          if (tableMatch && features.length < 5) {
            const featureText = cleanValue(tableMatch[1]);
            if (featureText && featureText.length > 2 && !featureText.match(/^[Pp][012]$/)) {
              features.push(featureText.substring(0, 45));
            }
          } else if (kvMatch && features.length < 5) {
            const featureText = cleanValue(kvMatch[1]);
            if (featureText && featureText.length > 2) {
              features.push(featureText.substring(0, 45));
            }
          } else if (boldMatch && features.length < 5) {
            const featureText = cleanValue(boldMatch[1]);
            if (featureText && featureText.length > 2) {
              features.push(featureText.substring(0, 45));
            }
          }
        }
        
        // Fallback: extract from "核心卖点" section
        if (features.length === 0) {
          const extracted = extractListAfterHeader(content, ['核心卖点', '卖点排序', '卖点清单', 'Selling Point', '产品卖点', '主要卖点'], 5);
          features.push(...extracted);
        }
        
        // Additional fallback: look for numbered selling points
        if (features.length === 0) {
          for (const line of lines) {
            const trimmed = line.trim();
            const numberedSP = trimmed.match(/^\d+[.)]\s*(.{5,50})$/);
            if (numberedSP && features.length < 4) {
              const text = cleanValue(numberedSP[1]);
              if (text && !text.includes('基础信息') && !text.includes('产品规格')) {
                features.push(text);
              }
            }
          }
        }

        return {
          type: 'launch',
          data: {
            productName: productName || "待提取",
            market: market || "待确认",
            material: material || "待提取",
            category: category || "户外装备",
            features: features.length > 0 ? features.slice(0, 3) : ["待提取"]
          }
        };
        
      } else if (step === WorkflowStep.STRATEGY_P0) {
        // P0 Strategy - Extract positioning, keywords, and sorted selling points
        const positioning = extractByKey(content, ['定位', '核心定位', '品牌定位', 'Positioning', '产品定位', '差异化定位']);
        
        // Enhanced keywords extraction with more patterns
        let keywords = extractByKey(content, ['核心词', '差异化', '关键词', 'Keywords', '差异化关键词', '核心关键词', '品牌关键词', '核心信息']);
        
        // If keywords not found, try extracting from sections
        if (!keywords) {
          const keywordPatterns = ['差异化', '核心主张', '品牌核心', '核心价值', '差异化策略'];
          for (const pattern of keywordPatterns) {
            const idx = content.indexOf(pattern);
            if (idx !== -1) {
              const afterPattern = content.substring(idx, idx + 100);
              const match = afterPattern.match(/[：:]\s*(.+?)(?:\n|$)/);
              if (match) {
                keywords = cleanValue(match[1]);
                break;
              }
            }
          }
        }
        
        // Extract selling points with priority from various formats
        const sellingPoints: string[] = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Format 1: 1. 卖点内容 (P0) or 1. 卖点内容 (P1)
          const priorityMatch = trimmed.match(/^\d+[.)]\s*(.+?)\s*[（(][Pp][012][)）]/);
          // Format 2: | P0 | 卖点 |
          const tableMatch = trimmed.match(/\|\s*[Pp][012]\s*\|\s*(.+?)\s*\|/);
          // Format 3: - P0：卖点 or * P1: 卖点
          const bulletMatch = trimmed.match(/^[-*•]\s*[Pp][012][：:]\s*(.+)/);
          // Format 4: P0：卖点 (standalone)
          const simpleMatch = trimmed.match(/^[Pp][012][：:]\s*(.+)/);
          // Format 5: **P0** 卖点描述 or **P1**: 卖点
          const boldMatch = trimmed.match(/\*\*[Pp][012]\*\*[：:\s]*(.+)/);
          // Format 6: 卖点1：xxx or 卖点一：xxx
          const numberedSP = trimmed.match(/卖点\s*[1-3一二三][：:]\s*(.+)/);
          // Format 7: - 轻量化设计 (without P tag but in selling point section)
          const genericBullet = trimmed.match(/^[-*•]\s+(.{5,40})$/);
          
          if (priorityMatch && sellingPoints.length < 5) {
            const pTag = trimmed.match(/[Pp][012]/)?.[0]?.toUpperCase() || '';
            sellingPoints.push(cleanValue(priorityMatch[1]) + (pTag ? ` (${pTag})` : ''));
          } else if (tableMatch && sellingPoints.length < 5) {
            sellingPoints.push(cleanValue(tableMatch[1]));
          } else if (bulletMatch && sellingPoints.length < 5) {
            sellingPoints.push(cleanValue(bulletMatch[1]));
          } else if (simpleMatch && sellingPoints.length < 5) {
            sellingPoints.push(cleanValue(simpleMatch[1]));
          } else if (boldMatch && sellingPoints.length < 5) {
            sellingPoints.push(cleanValue(boldMatch[1]));
          } else if (numberedSP && sellingPoints.length < 5) {
            sellingPoints.push(cleanValue(numberedSP[1]));
          }
        }
        
        // Fallback: extract from "卖点排序" or similar section headers
        if (sellingPoints.length === 0) {
          const extracted = extractListAfterHeader(content, ['卖点排序', '卖点优先级', '核心卖点', '差异化卖点', 'Selling Point', '卖点清单'], 4);
          sellingPoints.push(...extracted);
        }
        
        // Additional fallback: look for any numbered list items in strategy sections
        if (sellingPoints.length === 0) {
          for (const line of lines) {
            const trimmed = line.trim();
            // Match numbered items that look like selling points
            const numberedItem = trimmed.match(/^\d+[.)]\s*\*?\*?(.{5,50})\*?\*?$/);
            if (numberedItem && sellingPoints.length < 4) {
              const text = cleanValue(numberedItem[1]);
              if (text && !text.includes('竞品') && !text.includes('分析') && !text.includes('用户')) {
                sellingPoints.push(text);
              }
            }
          }
        }

        return {
          type: 'strategy',
          data: {
            positioning: positioning || "待提取",
            keywords: keywords || "待提取",
            sellingPoints: sellingPoints.length > 0 ? sellingPoints.slice(0, 4) : ["待提取"]
          }
        };
        
      } else if (step === WorkflowStep.VISUAL_P1) {
        // P1 Visual - Enhanced extraction for lighting, levitation, and colors
        
        // Lighting extraction with multiple patterns
        let lighting = extractByKey(content, ['光影', '光线', '光源', 'Lighting', '光感', '自然光', '主光', '光影设置']);
        if (!lighting) {
          // Try extracting from sections about light
          const lightPatterns = ['10AM', '上午10点', '自然光', '柔和光', '阳光'];
          for (const pattern of lightPatterns) {
            if (content.includes(pattern)) {
              const idx = content.indexOf(pattern);
              const context = content.substring(Math.max(0, idx - 20), Math.min(content.length, idx + 50));
              lighting = cleanValue(context.match(/[^.。\n]+/)?.[0] || pattern);
              break;
            }
          }
        }
        
        // Levitation extraction with multiple patterns
        let levitation = extractByKey(content, ['悬浮', '姿态', '产品姿态', 'Levitation', '悬浮效果', '倾斜', '偏转', '角度']);
        if (!levitation) {
          // Try extracting angle information
          const angleMatch = content.match(/(?:左偏|向左|偏转|tilt)[^。\n]*?(\d+)[°度]/i);
          if (angleMatch) {
            levitation = `左偏${angleMatch[1]}°`;
          }
          // Try shadow information
          const shadowMatch = content.match(/(?:接触)?软阴影|contact.*shadow/i);
          if (shadowMatch && levitation) {
            levitation += ' + 接触软阴影';
          } else if (shadowMatch) {
            levitation = '接触软阴影效果';
          }
        }
        
        // Enhanced color extraction
        const colors: string[] = [];
        
        // Extract hex colors
        const hexMatches = content.match(/#[0-9A-Fa-f]{6}/g);
        if (hexMatches) {
          colors.push(...hexMatches.slice(0, 5));
        }
        
        // Extract color names from key sections
        const colorKeys = ['主色', '品牌色', 'Primary', '活力橙', '大气蓝', '薄雾灰'];
        for (const key of colorKeys) {
          if (content.includes(key) && colors.length < 5) {
            const colorValue = extractByKey(content, [key]);
            if (colorValue && colorValue.match(/#[0-9A-Fa-f]{6}/)) {
              if (!colors.includes(colorValue.match(/#[0-9A-Fa-f]{6}/)?.[0] || '')) {
                colors.push(colorValue.match(/#[0-9A-Fa-f]{6}/)?.[0] || '');
              }
            }
          }
        }
        
        // Add brand colors if none found
        const uniqueColors = [...new Set(colors.filter(c => c))];
        
        return {
          type: 'visual',
          data: {
            lighting: lighting || "待提取",
            levitation: levitation || "待提取",
            colors: uniqueColors.length > 0 ? uniqueColors.slice(0, 3) : ["#ED6D46", "#C8E1EF", "#F5F6F7"]
          }
        };
        
      } else if (step === WorkflowStep.COPY_P2) {
        // P2 Copywriting - Enhanced extraction for title and selling point copy
        
        // Enhanced title extraction
        let title = extractByKey(content, ['H1', 'Title', '主标题', '产品标题', '标题', 'Headline']);
        if (!title) {
          // Try to find title in first few lines with emphasis
          for (let i = 0; i < Math.min(15, lines.length); i++) {
            const line = lines[i].trim();
            // Match emphasized text that looks like a title
            const emphMatch = line.match(/^\*\*(.{5,50})\*\*$/);
            const headerMatch = line.match(/^#{1,2}\s+(.{5,50})$/);
            if (emphMatch && !emphMatch[1].includes('卖点') && !emphMatch[1].includes('文案')) {
              title = cleanValue(emphMatch[1]);
              break;
            }
            if (headerMatch && !headerMatch[1].includes('策略') && !headerMatch[1].includes('概览')) {
              title = cleanValue(headerMatch[1]);
              break;
            }
          }
        }
        
        const subtitle = extractByKey(content, ['H2', '副标题', 'Subtitle', '品牌调性', '产品副标题']);
        
        // Enhanced selling point copy extraction
        const sellingPoints: {title: string, content: string}[] = [];
        
        let currentTitle = '';
        let inSellingPointSection = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Check if we're entering a selling point section
          if (line.match(/卖点|文案|Copy|Selling/i)) {
            inSellingPointSection = true;
          }
          
          // Pattern 1: ### 卖点1：轻量化 or **卖点1**：轻量化
          const sectionMatch = line.match(/^(?:#{1,4}\s*)?(?:\*\*)?卖点\s*[1-3一二三]?[：:]\s*(.+?)(?:\*\*)?$/);
          // Pattern 2: - **轻量化**：让每一步都更轻松
          const titleContentMatch = line.match(/^[-*•]\s*\*?\*?(.{2,20})\*?\*?\s*[：:]\s*(.+)/);
          // Pattern 3: 1. 轻量化设计：xxx
          const numberedMatch = line.match(/^\d+[.)]\s*(.{2,20})[：:]\s*(.+)/);
          // Pattern 4: **Feature**: Benefit format
          const featureBenefitMatch = line.match(/\*\*(.{2,15})\*\*[：:]\s*(.+)/);
          
          if (sectionMatch && sellingPoints.length < 5) {
            currentTitle = cleanValue(sectionMatch[1]);
            // Check if next line has the content
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              if (nextLine && !nextLine.startsWith('#') && !nextLine.match(/^卖点/)) {
                sellingPoints.push({
                  title: currentTitle,
                  content: cleanValue(nextLine.replace(/^[-*•]\s*/, ''))
                });
                currentTitle = '';
              }
            }
          } else if (titleContentMatch && sellingPoints.length < 5) {
            sellingPoints.push({
              title: cleanValue(titleContentMatch[1]),
              content: cleanValue(titleContentMatch[2])
            });
          } else if (numberedMatch && sellingPoints.length < 5) {
            sellingPoints.push({
              title: cleanValue(numberedMatch[1]),
              content: cleanValue(numberedMatch[2])
            });
          } else if (featureBenefitMatch && sellingPoints.length < 5 && inSellingPointSection) {
            sellingPoints.push({
              title: cleanValue(featureBenefitMatch[1]),
              content: cleanValue(featureBenefitMatch[2])
            });
          } else if (currentTitle && line.match(/^[-*•]\s+/) && sellingPoints.length < 5) {
            sellingPoints.push({
              title: currentTitle,
              content: cleanValue(line.replace(/^[-*•]\s+/, ''))
            });
            currentTitle = '';
          }
        }
        
        // Fallback: extract list items from copy sections
        if (sellingPoints.length === 0) {
          const extracted = extractListAfterHeader(content, ['文案', '卖点文案', 'Copy', '产品卖点', '标注文案', 'H2'], 4);
          extracted.forEach((item, idx) => {
            // Try to split on colon if present
            const parts = item.split(/[：:]/);
            if (parts.length >= 2) {
              sellingPoints.push({ title: cleanValue(parts[0]), content: cleanValue(parts.slice(1).join(':')) });
            } else {
              sellingPoints.push({ title: `卖点${idx + 1}`, content: item });
            }
          });
        }

        return {
          type: 'copy',
          data: {
            title: title || subtitle || "待提取",
            sellingPoints: sellingPoints.length > 0 ? sellingPoints.slice(0, 3) : [
              { title: "待提取", content: "AI 输出解析中..." }
            ]
          }
        };
        
      } else if (
        step === WorkflowStep.PRODUCTION_P3_P5 || 
        step === WorkflowStep.P3_MAIN_IMAGE || 
        step === WorkflowStep.P4_SECONDARY || 
        step === WorkflowStep.P5_APLUS
      ) {
        // P3-P5 Production - Enhanced extraction for prompts and image descriptions
        
        // Main image prompt extraction
        let mainImagePrompt = extractByKey(content, ['主图Prompt', '主图描述', 'Main Image', 'P3 Prompt', 'Hero Image', '主图生成']);
        if (!mainImagePrompt) {
          // Try to find JSON prompt or full_prompt section
          const jsonMatch = content.match(/full_prompt[：:]\s*["']?([^"'\n]+)/i);
          const promptMatch = content.match(/prompt[：:]\s*["']?(.{20,200})/i);
          if (jsonMatch) {
            mainImagePrompt = cleanValue(jsonMatch[1]);
          } else if (promptMatch) {
            mainImagePrompt = cleanValue(promptMatch[1]);
          }
        }
        
        // Sub images extraction
        let subImages = extractListAfterHeader(content, ['副图', '副图序列', 'Sub Images', 'P4', 'S1', 'S2', '信息图', '场景图'], 6);
        
        // If no sub images found, try to find S1-S6 patterns
        if (subImages.length === 0) {
          for (const line of lines) {
            const trimmed = line.trim();
            const sMatch = trimmed.match(/^(?:\*\*)?S[1-6][：:]\s*(.+?)(?:\*\*)?$/);
            const typeMatch = trimmed.match(/^(?:#{1,4}\s*)?(信息图|场景图|细节图|规格图|对比图|包装图)[：:]?\s*(.+)?/);
            if (sMatch && subImages.length < 6) {
              subImages.push(cleanValue(sMatch[1]));
            } else if (typeMatch && subImages.length < 6) {
              subImages.push(cleanValue(typeMatch[1]) + (typeMatch[2] ? ': ' + cleanValue(typeMatch[2]) : ''));
            }
          }
        }
        
        // A+ module extraction
        const aplusModules = extractListAfterHeader(content, ['A+', 'M1', 'M2', '模块', 'Premium'], 6);
        
        // Determine status
        const hasContent = mainImagePrompt || subImages.length > 0 || aplusModules.length > 0;
        const isComplete = content.includes('完成') || content.includes('Done') || content.includes('complete');
        
        return {
          type: 'production',
          data: {
            mainImage: mainImagePrompt || "主图Prompt生成中...",
            subImages: subImages.length > 0 ? subImages.slice(0, 6) : (aplusModules.length > 0 ? aplusModules : ["设计描述生成中..."]),
            status: isComplete ? 'completed' : (hasContent ? 'processing' : 'pending')
          }
        };
      }
      
      return undefined;
    } catch (e) {
      console.error('Extract step data error:', e);
      return undefined;
    }
  };

  const handleRegenerate = () => {
      // Remove last AI message
      setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
              newMsgs.pop(); // Remove AI response
          }
          // We also need to check if there was a user "confirm" message before this step?
          // Actually, regeneration usually happens BEFORE confirmation of CURRENT step.
          // So we simply re-run the triggerStep with a "Retry" prompt.
          return newMsgs;
      });

      // We need to re-trigger the current step (workflowStep)
      // Prompt should be slightly different? Or same?
      // Let's use "重新生成" instruction.
      const retryPrompt = "上一条结果不满意，请重新生成，注意严格遵循格式要求。";
      triggerStep(workflowStep, retryPrompt);
  };

  const renderCurrentActionCard = () => {
    if (isTyping) return null;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'ai') return null;

    const extracted = extractStepData(lastMsg.content, workflowStep);

    switch (workflowStep) {
      case WorkflowStep.LAUNCH_PACKAGE:
        const launchImage = messages.find(m => m.role === 'user' && (m.image || (m.images && m.images.length > 0)))?.images?.[0] 
                          || messages.find(m => m.role === 'user' && m.image)?.image;
        return <LaunchPackageCard 
            onConfirm={() => handleUserConfirm(WorkflowStep.STRATEGY_P0)} 
            onRegenerate={handleRegenerate}
            image={launchImage} 
            launchData={extracted?.type === 'launch' ? extracted.data as any : undefined} 
        />;
      case WorkflowStep.STRATEGY_P0:
        return <StrategyCard 
            onConfirm={() => handleUserConfirm(WorkflowStep.VISUAL_P1)} 
            onRegenerate={handleRegenerate}
            strategyData={extracted?.type === 'strategy' ? extracted.data as any : undefined}
        />;
      case WorkflowStep.VISUAL_P1:
        return <VisualGuidelinesCard 
            onConfirm={() => handleUserConfirm(WorkflowStep.COPY_P2)} 
            onRegenerate={handleRegenerate}
            visualData={extracted?.type === 'visual' ? extracted.data as any : undefined}
        />;
      case WorkflowStep.COPY_P2:
        return <CopywritingCard 
            onConfirm={() => handleUserConfirm(WorkflowStep.PRODUCTION_SELECT)} 
            onRegenerate={handleRegenerate}
            copyData={extracted?.type === 'copy' ? extracted.data as any : undefined}
        />;
      case WorkflowStep.PRODUCTION_SELECT:
        return <ProductionSelectCard
            onSelectMain={() => handleProductionSelect('main')}
            onSelectSecondary={() => handleProductionSelect('secondary')}
            onSelectAplus={() => handleProductionSelect('aplus')}
            onSelectAll={() => handleProductionSelect('all')}
        />;
      case WorkflowStep.PRODUCTION_P3_P5:
      case WorkflowStep.P3_MAIN_IMAGE:
      case WorkflowStep.P4_SECONDARY:
      case WorkflowStep.P5_APLUS:
        const prodImage = messages.find(m => m.role === 'user' && (m.image || (m.images && m.images.length > 0)))?.images?.[0] 
                          || messages.find(m => m.role === 'user' && m.image)?.image;
        const prodExtracted = extracted?.type === 'production' ? extracted.data as any : undefined;
        
        // 判断是单步还是全部，单步完成后显示"继续生成其他"选项
        const isSingleStep = workflowStep !== WorkflowStep.PRODUCTION_P3_P5;
        
        return (
          <div className="space-y-4">
            <ProductionCard 
              image={prodImage} 
              productionData={prodExtracted}
              onConfirm={() => handleUserConfirm(WorkflowStep.COMPLETED)} 
            />
            {isSingleStep && (
              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-white/10">
                <button 
                  onClick={() => handleContinueProduction()}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  🔄 继续生成其他图片
                </button>
                <button 
                  onClick={() => handleUserConfirm(WorkflowStep.COMPLETED)}
                  className="py-2.5 px-4 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                >
                  ✅ 完成
                </button>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-[#121212] text-slate-800 dark:text-slate-100 font-sans">
      {/* Header - Transparent/Glass effect */}
      <header className="h-14 px-6 fixed top-0 w-full bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-between z-30 shrink-0 border-b border-gray-200/50 dark:border-white/5 transition-colors">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors"
          >
            ←
          </button>
          <div className="flex flex-col">
             <span className="font-bold text-sm tracking-tight text-gray-900 dark:text-white">SKYSPER Agent Studio</span>
             <span className="text-[10px] text-gray-500 dark:text-gray-400">
               Powered by {initialModel.includes('gemini-3') ? 'Gemini 3.0' : 'Gemini 1.5'} {initialModel.includes('flash') ? 'Flash' : 'Pro'}
             </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
            {/* Status Badge */}
            <div className={`
                px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 shadow-sm
                ${isTyping 
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}
            `}>
                <div className={`w-1.5 h-1.5 rounded-full ${isTyping ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                {isTyping ? 'Thinking' : 'Ready'}
            </div>
        </div>
      </header>

      {/* Chat Area - Centered Column */}
      <main className="flex-1 overflow-y-auto relative w-full pt-16" ref={scrollRef}>
        <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col gap-8 min-h-full">
            <AnimatePresence initial={false} mode='popLayout'>
            {messages.map((msg, idx) => (
                <div key={msg.id} className="flex flex-col gap-2">
                    <MessageBubble 
                        role={msg.role} 
                        content={msg.content} 
                        image={msg.image}
                        images={msg.images}
                        component={idx === messages.length - 1 ? renderCurrentActionCard() : undefined} 
                    />
                </div>
            ))}
            {isTyping && (
                <div className="ml-4">
                    <TypingIndicator />
                </div>
            )}
            </AnimatePresence>
            <div className="h-40" /> {/* Spacer for bottom input */}
        </div>
      </main>

      {/* Input Area - Floating Bottom */}
      <div className="absolute bottom-8 left-0 right-0 px-4 z-40 pointer-events-none">
        <div className="max-w-3xl mx-auto bg-white dark:bg-[#1e1e1e] p-2 rounded-[1.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-black/50 border border-gray-100 dark:border-white/10 pointer-events-auto transform transition-all focus-within:ring-2 ring-brand-blue/20 focus-within:border-brand-blue/50">
            {/* Image Preview Bar */}
            {selectedImages.length > 0 && (
                <div className="flex gap-2 p-2 mb-1 overflow-x-auto">
                    {selectedImages.map((img, idx) => (
                        <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shrink-0 group">
                            <img src={img} className="w-full h-full object-cover" />
                            <button onClick={() => removeImage(idx)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs">×</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-end gap-2 pl-2">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-gray-400 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-white/10 rounded-xl transition-colors shrink-0 mb-1"
                >
                    <UploadIcon className="w-5 h-5" />
                </button>
                <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                
                <textarea 
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white text-base p-3 max-h-32 min-h-[52px] resize-none placeholder-gray-400 font-sans leading-relaxed"
                    rows={1}
                />
                
                <button 
                    onClick={handleSend} 
                    disabled={!inputValue && selectedImages.length === 0}
                    className={`
                        p-3 rounded-xl transition-all duration-200 shrink-0 mb-1
                        ${(inputValue || selectedImages.length > 0)
                            ? 'bg-brand-blue text-white shadow-md hover:opacity-90 active:scale-95' 
                            : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed'}
                    `}
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
        <div className="text-center mt-3 text-xs text-gray-400 font-light pointer-events-none opacity-60">
            Based on Google Gemini 3.0 Pro • Venture Lightly
        </div>
      </div>

      <PromptInspector 
        prompt={AGENT_PROMPTS[workflowStep]} 
        isActive={!isTyping} 
      />
    </div>
  );
};