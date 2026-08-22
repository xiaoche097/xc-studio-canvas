import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Sparkles,
  Plus,
  ArrowUp,
  Paperclip,
  Box,
  Globe,
  Lightbulb,
  Zap,
  Bookmark,
  Shirt,
  User,
  ShoppingBag,
  Palette,
  Image as ImageIcon,
  ChevronDown,
  PlusCircle,
  Check,
  Eye,
  Film,
  ChevronRight,
  X,
} from "lucide-react";
import PinterestGallery from "../components/PinterestGallery";
import MaterialLibrary from "./Home/components/MaterialLibrary";
import ClipperLibraryView from "./Home/components/ClipperLibraryView";
import { createNewWorkspacePath, workspacePath } from "../utils/routes";
import { getProjects } from "../services/storage";
import { Project, AppMode } from "../types";
import type { ImageModel } from "../types";
import { safeLocalStorageSetItem } from "../utils/safe-storage";
import {
  DEFAULT_AUTO_IMAGE_MODEL,
  IMAGE_MODEL_OPTIONS,
  PREFERRED_IMAGE_MODEL_TO_STORAGE_ID,
  STORAGE_ID_TO_PREFERRED_IMAGE_MODEL,
} from "./Workspace/modelOptions";
import {
  CREATIVE_FEATURES,
  FEATURE_CATEGORIES,
  type CreativeFeature,
  type FeatureCategory,
} from "../featureRegistry";

type TopTabType = "skill" | "pinterest" | "brand" | "clipper";

export interface WorkspaceSeed {
  prompt: string;
  attachments: File[];
}

interface HomeProps {
  onExit?: () => void;
  onStartWorkspace?: (seed: WorkspaceSeed) => void;
  onAgentEngage?: () => void;
  onOpenFeature?: (mode: AppMode) => void;
}

const SKILL_CATEGORY_TABS = [
  { id: "all", label: "为你推荐" },
  { id: "marketing", label: "E-commerce" },
  { id: "core", label: "Ads & Creative" },
  { id: "model", label: "Fashion & Model" },
  { id: "tools", label: "Utility" },
];

const SkillCard: React.FC<{
  feature: CreativeFeature;
  isSelected: boolean;
  onToggle: () => void;
}> = ({ feature, isSelected, onToggle }) => {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onToggle}
      className="group block w-full bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
    >
      <div>
        <div className={`relative aspect-[16/10] w-full overflow-hidden rounded-[10px] bg-slate-100 mb-3 ${isSelected ? "ring-2 ring-slate-950 ring-offset-2" : ""}`}>
          <img
            src={feature.cover}
            alt={feature.title}
            className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95"
            loading="lazy"
          />
          <div className="absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white">
            {feature.category === "marketing" || feature.mode === AppMode.PRODUCT_VIDEO ? (
              <Film size={12} />
            ) : (
              <ImageIcon size={12} />
            )}
          </div>
          {isSelected && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-white">
              <Check size={13} />
            </span>
          )}
        </div>

        <h4 className="line-clamp-1 text-sm font-medium text-slate-900">
          {feature.title}
        </h4>
        <p className="mt-1.5 line-clamp-2 text-xs font-normal leading-relaxed text-slate-500">
          {feature.description}
        </p>
      </div>
    </button>
  );
};

export const Home: React.FC<HomeProps> = ({ onExit, onStartWorkspace, onAgentEngage, onOpenFeature }) => {
  const navigate = (to: string, _options?: any) => {
    window.location.hash = typeof to === 'string' ? to : '';
  };
  const [activeTab, setActiveTab] = useState<TopTabType>("skill");
  const [skillCategory, setSkillCategory] = useState<string>("all");
  const [selectedSkills, setSelectedSkills] = useState<CreativeFeature[]>([]);

  const handleToggleSkill = (feature: CreativeFeature) => {
    setSelectedSkills((prev) => {
      const exists = prev.some((s) => s.mode === feature.mode);
      if (exists) {
        return prev.filter((s) => s.mode !== feature.mode);
      } else {
        return [...prev, feature];
      }
    });
  };

  const handleRemoveSkill = (mode: AppMode) => {
    setSelectedSkills((prev) => prev.filter((s) => s.mode !== mode));
  };
  // 左侧输入框状态
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachedClipperItems, setAttachedClipperItems] = useState<Array<{ id: string; url: string; title: string }>>([]);
  const [selectedComposerTokenIndex, setSelectedComposerTokenIndex] = useState<number | null>(null);
  const [isCaretBeforeComposerTokens, setIsCaretBeforeComposerTokens] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const richTextEditorRef = useRef<HTMLDivElement>(null);
  const modelPreferenceRef = useRef<HTMLDivElement>(null);
  const [showModelPreference, setShowModelPreference] = useState(false);
  const [autoModelSelect, setAutoModelSelect] = useState(true);
  const [preferredImageModel, setPreferredImageModel] =
    useState<ImageModel>(DEFAULT_AUTO_IMAGE_MODEL);

  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  const attachmentPreviews = useMemo(
    () => attachments.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [attachments],
  );

  useEffect(() => {
    return () => {
      attachmentPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [attachmentPreviews]);

  useEffect(() => {
    const editor = richTextEditorRef.current;
    if (editor && editor.innerText !== prompt) {
      editor.innerText = prompt;
    }
  }, [prompt]);

  useEffect(() => {
    const load = async () => {
      const all = await getProjects();
      setRecentProjects(all.slice(0, 5));
    };
    load();
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem("setting_image_models") || "[]",
      );
      const first = Array.isArray(parsed)
        ? String(parsed[0] || "").trim()
        : "";
      if (!first || first === "Auto") {
        setAutoModelSelect(true);
        setPreferredImageModel(DEFAULT_AUTO_IMAGE_MODEL);
        return;
      }
      const mapped = STORAGE_ID_TO_PREFERRED_IMAGE_MODEL[first];
      if (mapped) {
        setAutoModelSelect(false);
        setPreferredImageModel(mapped);
      }
    } catch {
      setAutoModelSelect(true);
      setPreferredImageModel(DEFAULT_AUTO_IMAGE_MODEL);
    }
  }, []);

  useEffect(() => {
    if (!showModelPreference) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!modelPreferenceRef.current?.contains(event.target as Node)) {
        setShowModelPreference(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowModelPreference(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModelPreference]);

  const updateAutoModelSelect = (enabled: boolean) => {
    setAutoModelSelect(enabled);
    const selected = enabled
      ? ["Auto"]
      : [
          PREFERRED_IMAGE_MODEL_TO_STORAGE_ID[preferredImageModel] ||
            preferredImageModel,
        ];
    safeLocalStorageSetItem("setting_image_models", JSON.stringify(selected));
  };

  const selectPreferredImageModel = (model: ImageModel) => {
    setPreferredImageModel(model);
    setAutoModelSelect(false);
    safeLocalStorageSetItem(
      "setting_image_models",
      JSON.stringify([
        PREFERRED_IMAGE_MODEL_TO_STORAGE_ID[model] || model,
      ]),
    );
    setShowModelPreference(false);
  };

  const handleSendDesign = () => {
    const skillPrefix = selectedSkills.length > 0
      ? selectedSkills.map(s => `【使用技能：${s.title}】`).join(' ')
      : '';
    const clipperRefText = attachedClipperItems.length > 0
      ? attachedClipperItems.map((i) => `【参考灵感图「${i.title}」: ${i.url}】`).join(' ')
      : '';
    const finalPrompt = [skillPrefix, clipperRefText, prompt.trim()].filter(Boolean).join(' ');

    if (finalPrompt || attachments.length > 0 || attachedClipperItems.length > 0) {
      if (onStartWorkspace) {
        onStartWorkspace({ prompt: finalPrompt, attachments });
        return;
      }
      navigate(createNewWorkspacePath(), {
        state: {
          initialPrompt: finalPrompt,
          initialAttachments: attachments,
        },
      });
    }
  };

  const handleSelectPin = (imageUrl: string, title: string) => {
    setAttachedClipperItems((current) => {
      if (current.some((item) => item.url === imageUrl)) return current;
      return [
        ...current,
        {
          id: `pinterest-${Date.now()}`,
          url: imageUrl,
          title: title || 'Pinterest 参考图',
        },
      ];
    });
  };

  const canSendDesign = Boolean(
    prompt.trim()
    || attachments.length > 0
    || attachedClipperItems.length > 0
    || selectedSkills.length > 0,
  );

  const composerTokenCount = selectedSkills.length + attachedClipperItems.length + attachments.length;

  useEffect(() => {
    if (composerTokenCount === 0) {
      setSelectedComposerTokenIndex(null);
      setIsCaretBeforeComposerTokens(false);
      return;
    }
    setSelectedComposerTokenIndex((current) => (
      current !== null && current >= composerTokenCount ? composerTokenCount - 1 : current
    ));
  }, [composerTokenCount]);

  const focusRichTextAtStart = () => {
    requestAnimationFrame(() => {
      const editor = richTextEditorRef.current;
      if (!editor) return;
      editor.focus();
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  };

  const isRichTextCaretAtStart = () => {
    const editor = richTextEditorRef.current;
    const selection = window.getSelection();
    if (
      !editor
      || !selection
      || selection.rangeCount === 0
      || !selection.isCollapsed
      || !selection.anchorNode
      || !editor.contains(selection.anchorNode)
    ) {
      return false;
    }

    const currentRange = selection.getRangeAt(0);
    const leadingRange = document.createRange();
    leadingRange.selectNodeContents(editor);
    leadingRange.setEnd(currentRange.startContainer, currentRange.startOffset);
    return leadingRange.toString().length === 0;
  };

  const removeComposerTokenAt = (tokenIndex: number, keepKeyboardNavigation = false) => {
    if (tokenIndex < selectedSkills.length) {
      setSelectedSkills((current) => current.filter((_, index) => index !== tokenIndex));
    } else if (tokenIndex < selectedSkills.length + attachedClipperItems.length) {
      const clipperIndex = tokenIndex - selectedSkills.length;
      setAttachedClipperItems((current) => current.filter((_, index) => index !== clipperIndex));
    } else {
      const attachmentIndex = tokenIndex - selectedSkills.length - attachedClipperItems.length;
      setAttachments((current) => current.filter((_, index) => index !== attachmentIndex));
    }

    if (keepKeyboardNavigation) {
      if (tokenIndex > 0) {
        setSelectedComposerTokenIndex(tokenIndex - 1);
        setIsCaretBeforeComposerTokens(false);
      } else {
        setSelectedComposerTokenIndex(null);
        setIsCaretBeforeComposerTokens(true);
      }
    } else {
      setSelectedComposerTokenIndex((current) => {
        if (current === null) return null;
        if (current === tokenIndex) return null;
        return current > tokenIndex ? current - 1 : current;
      });
      setIsCaretBeforeComposerTokens(false);
    }
    focusRichTextAtStart();
  };

  const handleRichTextKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowLeft" && !event.shiftKey) {
      if (isCaretBeforeComposerTokens) {
        event.preventDefault();
        return;
      }
      if (selectedComposerTokenIndex !== null) {
        event.preventDefault();
        if (selectedComposerTokenIndex > 0) {
          setSelectedComposerTokenIndex(selectedComposerTokenIndex - 1);
        } else {
          setSelectedComposerTokenIndex(null);
          setIsCaretBeforeComposerTokens(true);
        }
        return;
      }
      if (composerTokenCount > 0 && isRichTextCaretAtStart()) {
        event.preventDefault();
        setSelectedComposerTokenIndex(composerTokenCount - 1);
        setIsCaretBeforeComposerTokens(false);
        return;
      }
    }

    if (event.key === "ArrowRight" && !event.shiftKey) {
      if (isCaretBeforeComposerTokens) {
        event.preventDefault();
        setIsCaretBeforeComposerTokens(false);
        if (composerTokenCount > 0) setSelectedComposerTokenIndex(0);
        else focusRichTextAtStart();
        return;
      }
      if (selectedComposerTokenIndex !== null) {
        event.preventDefault();
        if (selectedComposerTokenIndex < composerTokenCount - 1) {
          setSelectedComposerTokenIndex(selectedComposerTokenIndex + 1);
        } else {
          setSelectedComposerTokenIndex(null);
          focusRichTextAtStart();
        }
        return;
      }
    }

    if ((event.key === "Backspace" || event.key === "Delete") && selectedComposerTokenIndex !== null) {
      event.preventDefault();
      removeComposerTokenAt(selectedComposerTokenIndex, true);
      return;
    }

    if (event.key === "Backspace" && isCaretBeforeComposerTokens) {
      event.preventDefault();
      return;
    }

    if (event.key === "Backspace" && composerTokenCount > 0 && isRichTextCaretAtStart()) {
      event.preventDefault();
      setSelectedComposerTokenIndex(composerTokenCount - 1);
      setIsCaretBeforeComposerTokens(false);
      return;
    }

    if (event.key === "Escape" && (selectedComposerTokenIndex !== null || isCaretBeforeComposerTokens)) {
      event.preventDefault();
      setSelectedComposerTokenIndex(null);
      setIsCaretBeforeComposerTokens(false);
      focusRichTextAtStart();
      return;
    }

    if (
      (selectedComposerTokenIndex !== null || isCaretBeforeComposerTokens)
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && (event.key.length === 1 || (event.key === "Enter" && event.shiftKey))
    ) {
      setSelectedComposerTokenIndex(null);
      setIsCaretBeforeComposerTokens(false);
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendDesign();
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white font-sans text-slate-950">
      {/* 顶部主 Tabs 栏 (参照图 1 / 图 3 顶栏) */}
      <div className="z-10 flex h-12 min-h-12 shrink-0 items-center overflow-x-auto border-b border-slate-200/80 bg-white px-3 sm:px-6 lg:absolute lg:left-[30rem] lg:right-0 lg:top-0 xl:left-[34rem]">
        <div className="flex min-w-max items-center gap-0.5">
          {/* Top Tabs */}
          <button
            onClick={() => setActiveTab("skill")}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "skill" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Sparkles size={13} className="text-slate-500" /> Skill
          </button>

          <button
            onClick={() => setActiveTab("pinterest")}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "pinterest" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 text-white font-serif font-bold text-[9px] flex items-center justify-center">P</span>
            Pinterest
          </button>

          <button
            onClick={() => setActiveTab("brand")}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "brand" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Box size={13} className="text-slate-500" /> 我的素材
          </button>

          <button
            onClick={() => setActiveTab("clipper")}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "clipper" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Globe size={13} className="text-slate-500" /> XC AI Clipper
          </button>

          <button type="button" aria-label="添加工作区" className="grid h-12 w-12 cursor-pointer place-items-center rounded-md text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* 主界面布局：左侧 AI 交互区 + 右侧内容展示区 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* ============================================================ */}
        {/* 左侧区域：极简 AI 问答输入框 (精确复刻图 1 左侧) */}
        {/* ============================================================ */}
        <aside
          className="relative min-h-[22rem] w-full shrink-0 border-b border-slate-200/80 bg-[#FCFCFB] p-5 sm:p-8 lg:min-h-0 lg:w-[30rem] lg:border-b-0 lg:border-r xl:w-[34rem]"
        >
          <div className="mx-auto flex h-full w-full max-w-[30rem] flex-col justify-center">
            <div className="mb-6 text-center">
              <h2 className="text-[1.35rem] font-semibold tracking-[-0.035em] text-slate-950">
                你想设计什么？
              </h2>
            </div>

            {/* 富文本 AI 设计输入框：技能、剪藏图和上传图片都作为内容芯片呈现 */}
            <div
              onFocusCapture={onAgentEngage}
              onClick={() => {
                setSelectedComposerTokenIndex(null);
                setIsCaretBeforeComposerTokens(false);
                richTextEditorRef.current?.focus();
              }}
              className="flex min-h-[8rem] cursor-text flex-col justify-between rounded-[12px] border border-[#D4D4D4] bg-white px-4 pb-3 pt-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:border-slate-500 focus-within:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]"
            >
              <div className="relative flex min-h-[4.5rem] flex-wrap content-start items-center gap-x-1.5 gap-y-1.5">
                {isCaretBeforeComposerTokens && (
                  <span aria-hidden="true" className="absolute -left-1 top-0 h-7 w-px animate-pulse bg-slate-950" />
                )}
                {selectedSkills.map((skill, skillIndex) => (
                      <span
                        key={skill.mode}
                        contentEditable={false}
                        aria-selected={selectedComposerTokenIndex === skillIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedComposerTokenIndex(skillIndex);
                          setIsCaretBeforeComposerTokens(false);
                          richTextEditorRef.current?.focus();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className={`inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg border bg-white pl-2 pr-1 text-xs font-medium text-slate-900 shadow-2xs transition ${
                          selectedComposerTokenIndex === skillIndex
                            ? 'border-blue-500 ring-2 ring-blue-500/15'
                            : 'border-slate-300'
                        }`}
                      >
                        <Sparkles size={12} className="shrink-0 text-slate-600" />
                        <span className="max-w-[9.5rem] truncate">{skill.title}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeComposerTokenAt(skillIndex);
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label="移除技能"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}

                    {attachedClipperItems.map((item, clipperIndex) => {
                      const tokenIndex = selectedSkills.length + clipperIndex;
                      return (
                      <span
                        key={item.id}
                        contentEditable={false}
                        aria-selected={selectedComposerTokenIndex === tokenIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedComposerTokenIndex(tokenIndex);
                          setIsCaretBeforeComposerTokens(false);
                          richTextEditorRef.current?.focus();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-lg border bg-white pl-1 pr-1 text-xs font-medium text-slate-900 shadow-2xs transition ${
                          selectedComposerTokenIndex === tokenIndex
                            ? 'border-blue-500 ring-2 ring-blue-500/15'
                            : 'border-slate-300'
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={item.title}
                          className="h-5 w-5 shrink-0 rounded-md bg-slate-100 object-cover"
                        />
                        <span className="max-w-[7.5rem] truncate">{item.title || 'Clipper 参考图'}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeComposerTokenAt(tokenIndex);
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label="移除剪藏参考图"
                        >
                          <X size={10} />
                        </button>
                      </span>
                      );
                    })}

                    {attachmentPreviews.map(({ file, url }, index) => (
                      <span
                        key={`${file.name}-${file.lastModified}-${index}`}
                        contentEditable={false}
                        aria-selected={selectedComposerTokenIndex === selectedSkills.length + attachedClipperItems.length + index}
                        onMouseDown={(event) => {
                          const tokenIndex = selectedSkills.length + attachedClipperItems.length + index;
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedComposerTokenIndex(tokenIndex);
                          setIsCaretBeforeComposerTokens(false);
                          richTextEditorRef.current?.focus();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-lg border bg-white pl-1 pr-1 text-xs font-medium text-slate-900 shadow-2xs transition ${
                          selectedComposerTokenIndex === selectedSkills.length + attachedClipperItems.length + index
                            ? 'border-blue-500 ring-2 ring-blue-500/15'
                            : 'border-slate-300'
                        }`}
                      >
                        <img src={url} alt="" className="h-5 w-5 shrink-0 rounded-md bg-slate-100 object-cover" />
                        <span className="max-w-[7.5rem] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeComposerTokenAt(selectedSkills.length + attachedClipperItems.length + index);
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label={`移除图片 ${file.name}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                ))}

                <div className="relative min-h-7 min-w-[8rem] flex-[1_1_8rem]">
                  {!prompt && (
                    <span className="pointer-events-none absolute inset-x-0 top-0 text-sm font-normal leading-7 text-slate-400">
                      让 XC AI 制作一张高转化的电商产品图
                    </span>
                  )}
                  <div
                    ref={richTextEditorRef}
                    role="textbox"
                    contentEditable
                    suppressContentEditableWarning
                    aria-label="设计需求"
                    aria-multiline="true"
                    className={`relative min-h-7 w-full whitespace-pre-wrap break-words bg-transparent text-sm font-normal leading-7 text-slate-800 outline-none ${
                      selectedComposerTokenIndex !== null || isCaretBeforeComposerTokens ? 'caret-transparent' : ''
                    }`}
                    onPointerDown={() => {
                      setSelectedComposerTokenIndex(null);
                      setIsCaretBeforeComposerTokens(false);
                    }}
                    onInput={(event) => setPrompt(event.currentTarget.innerText)}
                    onKeyDown={handleRichTextKeyDown}
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="添加参考图片"
                  className="grid h-12 w-12 cursor-pointer place-items-center rounded-xl text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
                >
                  <Plus size={16} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const selectedFiles = Array.from(e.target.files);
                      setAttachments((current) => [...current, ...selectedFiles]);
                      e.target.value = '';
                    }
                  }}
                />

                <div className="flex items-center gap-2">
                  <div ref={modelPreferenceRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowModelPreference((visible) => !visible)}
                      aria-label="模型偏好"
                      aria-haspopup="dialog"
                      aria-expanded={showModelPreference}
                      className={`grid h-12 w-12 cursor-pointer place-items-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
                        showModelPreference
                          ? "bg-slate-100 text-slate-950"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-950"
                      }`}
                    >
                      <Box size={16} />
                    </button>

                    {showModelPreference && (
                      <section
                        role="dialog"
                        aria-label="模型偏好"
                        className="absolute bottom-full right-0 z-50 mb-3 w-[min(21rem,calc(100vw-2rem))] rounded-[10px] border border-[#E5E5E5] bg-white p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
                      >
                        <header className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-950">模型偏好</h3>
                            <p className="mt-0.5 text-[0.68rem] text-slate-400">图像生成模型</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <span>自动</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={autoModelSelect}
                              onClick={() => updateAutoModelSelect(!autoModelSelect)}
                              className={`relative h-6 w-11 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950 ${
                                autoModelSelect ? "bg-slate-950" : "bg-slate-200"
                              }`}
                            >
                              <span
                                className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                  autoModelSelect ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </header>

                        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto pr-1">
                          {IMAGE_MODEL_OPTIONS.map((model) => {
                            const selected = preferredImageModel === model.id;
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => selectPreferredImageModel(model.id)}
                                className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950 ${
                                  selected
                                    ? "bg-slate-100 text-slate-950"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                }`}
                              >
                                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border text-xs font-semibold ${selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}>AI</span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2 text-xs font-semibold">
                                    {model.name}
                                    {autoModelSelect && model.id === DEFAULT_AUTO_IMAGE_MODEL && (
                                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[0.6rem] text-blue-600">自动默认</span>
                                    )}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[0.68rem] text-slate-400">{model.desc} · {model.time}</span>
                                </span>
                                {selected && <Check className="h-4 w-4 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                  <button
                    onClick={handleSendDesign}
                    disabled={!canSendDesign}
                    aria-label="开始创作"
                    className={`grid h-12 w-12 place-items-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
                      canSendDesign ? "cursor-pointer bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-300"
                    }`}
                  >
                    <ArrowUp size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* 下方引导快捷操作 */}
            <div className="mt-5 space-y-1.5">
              <button
                onClick={() => setActiveTab("skill")}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-normal text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <Sparkles size={14} className="text-blue-500" />
                <span>选择一个专业技能，完成你的电商、创意设计</span>
              </button>

              <button
                onClick={() => setActiveTab("clipper")}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-normal text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <Globe size={14} className="text-emerald-500" />
                <span>添加 XC AI Clipper</span>
              </button>

              <button
                onClick={() => setActiveTab("pinterest")}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-normal text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e60023] font-serif text-[0.6rem] font-bold text-white">P</span>
                <span>使用我的 Pinterest 参考图</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* 右侧主区域：根据 Tab 动态展现 (Pinterest / 品牌素材 / Skill) */}
        {/* ============================================================ */}
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white lg:pt-12">
          {activeTab === "pinterest" && (
            /* 📌 Pinterest 瀑布流灵感库 (图 3 & 图 4) */
            <PinterestGallery onSelectPin={handleSelectPin} />
          )}

          {activeTab === "brand" && (
            <MaterialLibrary
              onAddToConversation={(material) => {
                setPrompt(`请使用「${material.name || '未命名'}」${material.kind === 'brand' ? '品牌套件' : '素材'}完成这次设计。${material.guide ? `设计指南：${material.guide}` : ''}`);
              }}
            />
          )}

          {activeTab === "skill" && (
            /* Skill 视觉工作坊 (图 5 UI 风格) */
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* 顶部 Category Tabs 切换 (贴合图 5 顶部为你推荐 Tabs) */}
              <div className="flex h-12 shrink-0 items-center gap-6 overflow-x-auto border-b border-slate-200 px-5 no-scrollbar sm:px-7">
                {SKILL_CATEGORY_TABS.map((tab) => {
                  const active = skillCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSkillCategory(tab.id)}
                      className={`min-h-12 text-xs font-medium transition-all relative pb-2 whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${
                        active
                          ? "text-slate-950 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-slate-950"
                          : "text-slate-400 hover:text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* 技能列表 (图 5 风格排版: 带 E-commerce > 分类标题与精致卡片) */}
              <div className="flex-1 overflow-y-auto p-5 no-scrollbar sm:p-7">
                <div className="space-y-8">
                {FEATURE_CATEGORIES.map((cat) => {
                  if (skillCategory !== "all" && skillCategory !== cat.id) return null;
                  const catFeatures = CREATIVE_FEATURES.filter((f) => f.category === cat.id);
                  if (catFeatures.length === 0) return null;

                  const sectionTitle =
                    cat.id === "marketing"
                      ? "E-commerce"
                      : cat.id === "core"
                      ? "Ads & Creative"
                      : cat.id === "model"
                      ? "Fashion & Model"
                      : "Utility";

                  return (
                    <section key={cat.id} className="space-y-4">
                      <button type="button" className="flex items-center gap-1.5 cursor-pointer group/title outline-none focus-visible:ring-2 focus-visible:ring-slate-950" onClick={() => setSkillCategory(cat.id)}>
                        <h3 className="text-sm font-semibold text-slate-900 transition-colors">
                          {sectionTitle}
                        </h3>
                        <ChevronRight size={14} className="text-slate-400" />
                      </button>

                      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-x-4 gap-y-6">
                        {catFeatures.map((feature) => (
                          <SkillCard
                            key={feature.mode}
                            feature={feature}
                            isSelected={selectedSkills.some((s) => s.mode === feature.mode)}
                            onToggle={() => handleToggleSkill(feature)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
                </div>

              {/* 最近项目 */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">最近项目</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  <div
                    onClick={() => navigate(createNewWorkspacePath())}
                    className="aspect-[4/3] rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition"
                  >
                    <PlusCircle size={22} />
                    <span className="text-xs font-bold mt-2">新建画布项目</span>
                  </div>
                  {recentProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(workspacePath(p.id))}
                      className="aspect-[4/3] rounded-xl bg-slate-50 border border-slate-200 overflow-hidden cursor-pointer hover:border-slate-400 transition relative group"
                    >
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Box size={24} />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 text-white opacity-0 group-hover:opacity-100 transition">
                        <div className="text-xs font-bold truncate">{p.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}

          {activeTab === "clipper" && (
            <ClipperLibraryView
              onAddToConversation={(url, title) => {
                setAttachedClipperItems((prev) => {
                  if (prev.some((i) => i.url === url)) return prev;
                  return [...prev, { id: `clip-${Date.now()}-${Math.random()}`, url, title }];
                });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
