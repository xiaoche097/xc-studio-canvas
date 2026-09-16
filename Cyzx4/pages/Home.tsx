import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import ReactDOM from "react-dom";
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
  Check,
  Eye,
  Film,
  ChevronRight,
  ChevronLeft,
  X,
  Trash2,
  FolderOpen,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import PinterestGallery from "../components/PinterestGallery";
import MaterialLibrary from "./Home/components/MaterialLibrary";
import ClipperLibraryView from "./Home/components/ClipperLibraryView";
import { workspacePath } from "../utils/routes";
import { deleteProject, getProjects } from "../services/storage";
import { Project, AppMode } from "../types";
import type { ImageModel } from "../types";
import { safeLocalStorageSetItem } from "../utils/safe-storage";
import { fetchImageBlob } from "../utils/imageDownload";
import { getReadableAttachmentLabel } from "../utils/attachment-label";
import { createConversationId } from "../utils/conversation";
import {
  buildCreativeSkillData,
  type CreativeSkillData,
} from "../services/skills/creative-capabilities";
import {
  DEFAULT_AUTO_IMAGE_MODEL,
  PREFERRED_IMAGE_MODEL_TO_STORAGE_ID,
  STORAGE_ID_TO_PREFERRED_IMAGE_MODEL,
} from "./Workspace/modelOptions";
import {
  CREATIVE_FEATURES,
  FEATURE_CATEGORIES,
  type CreativeFeature,
  type FeatureCategory,
} from "../featureRegistry";
import { deleteBrowserHarnessSession } from "../services/agents/runtime/harness-session";
import {
  persistAgentWorkMode,
  readStoredAgentWorkMode,
  subscribeAgentWorkMode,
  type AgentWorkMode,
} from "../services/agents/runtime/agent-mode";
import { deleteTopicMemory } from "../services/topic-memory";
import { getMemoryKey } from "../services/topicMemory/key";
import CreativeImageModelSelector from "../components/image-models/CreativeImageModelSelector";

type TopTabType = "skill" | "pinterest" | "brand" | "clipper";

const HOME_AGENT_MODE_OPTIONS: Array<{
  id: AgentWorkMode;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { id: 'craft', label: 'Craft', description: '直接理解并完成任务', icon: Sparkles },
  { id: 'plan', label: 'Plan', description: '先规划，确认后再制作', icon: Lightbulb },
  { id: 'ask', label: 'Ask', description: '只交流分析，不执行', icon: MessageSquare },
];

const isClipperDeepLink = (hash: string) =>
  /^#\/?clipper(?:-installed)?(?:[/?]|$)/i.test(hash.trim());

const TOP_TABS = new Set<TopTabType>(["skill", "pinterest", "brand", "clipper"]);

const getInitialTopTab = (): TopTabType => {
  if (typeof window === "undefined") return "skill";

  const requestedTab = new URLSearchParams(window.location.search).get("tab") as TopTabType | null;
  if (requestedTab && TOP_TABS.has(requestedTab)) return requestedTab;
  return isClipperDeepLink(window.location.hash) ? "clipper" : "skill";
};

export interface WorkspaceSeed {
  projectId: string;
  conversationId?: string;
  prompt: string;
  attachments: File[];
  skillData?: CreativeSkillData;
}

interface HomeProps {
  onExit?: () => void;
  onStartWorkspace?: (seed: WorkspaceSeed) => void;
  onOpenProject?: (projectId: string) => void;
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

const MAX_HOME_IMAGE_ATTACHMENTS = 10;
const MAX_RETAINED_PROJECTS = 4;

const isImageFile = (file: File) => (
  file.type.startsWith('image/') || /\.(?:png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name)
);

const normalizeComposerText = (value: string) => {
  const normalized = value.replace(/\u200B/g, '').replace(/\u00A0/g, ' ');
  return normalized.trim().length > 0 ? normalized : '';
};

const formatProjectUpdatedAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '最近编辑';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat('zh-CN', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }
  ).format(date);
};

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

export const Home: React.FC<HomeProps> = ({ onExit, onStartWorkspace, onOpenProject, onAgentEngage, onOpenFeature }) => {
  const navigate = (to: string, _options?: any) => {
    window.location.hash = typeof to === 'string' ? to : '';
  };
  const [activeTab, setActiveTab] = useState<TopTabType>(getInitialTopTab);
  const [skillCategory, setSkillCategory] = useState<string>("all");
  const [selectedSkills, setSelectedSkills] = useState<CreativeFeature[]>([]);

  const selectTopTab = (tab: TopTabType) => {
    setActiveTab(tab);
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("view", "creative");
    url.searchParams.set("tab", tab);
    if (isClipperDeepLink(url.hash)) url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    const syncTabFromLocation = () => {
      setActiveTab(getInitialTopTab());
    };
    syncTabFromLocation();
    window.addEventListener("hashchange", syncTabFromLocation);
    window.addEventListener("popstate", syncTabFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncTabFromLocation);
      window.removeEventListener("popstate", syncTabFromLocation);
    };
  }, []);

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
  const [isPreparingWorkspace, setIsPreparingWorkspace] = useState(false);
  const [workspaceLaunchError, setWorkspaceLaunchError] = useState('');
  const [composerUploadError, setComposerUploadError] = useState('');
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const composerDragDepthRef = useRef(0);
  const [selectedComposerTokenIndex, setSelectedComposerTokenIndex] = useState<number | null>(null);
  const [isCaretBeforeComposerTokens, setIsCaretBeforeComposerTokens] = useState(false);
  const [composerTextPosition, setComposerTextPosition] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const richTextEditorRef = useRef<HTMLDivElement>(null);
  const modelPreferenceRef = useRef<HTMLDivElement>(null);
  const modelPreferenceButtonRef = useRef<HTMLButtonElement>(null);
  const modelPreferencePanelRef = useRef<HTMLElement>(null);
  const [showModelPreference, setShowModelPreference] = useState(false);
  const [modelPreferencePosition, setModelPreferencePosition] = useState<{
    left: number;
    bottom: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [autoModelSelect, setAutoModelSelect] = useState(true);
  const [preferredImageModel, setPreferredImageModel] =
    useState<ImageModel>(DEFAULT_AUTO_IMAGE_MODEL);
  const [agentMode, setAgentMode] = useState<AgentWorkMode>(readStoredAgentWorkMode);
  const [showAgentModeMenu, setShowAgentModeMenu] = useState(false);
  const activeAgentModeOption = HOME_AGENT_MODE_OPTIONS.find((option) => option.id === agentMode)
    || HOME_AGENT_MODE_OPTIONS[0];

  useEffect(() => subscribeAgentWorkMode(setAgentMode), []);

  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [areRetainedProjectsCollapsed, setAreRetainedProjectsCollapsed] = useState(true);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [projectDeleteError, setProjectDeleteError] = useState('');
  const [projectAnnouncement, setProjectAnnouncement] = useState('');
  const projectRailRef = useRef<HTMLDivElement>(null);
  const deleteCancelButtonRef = useRef<HTMLButtonElement>(null);
  const deleteDialogPreviousFocusRef = useRef<HTMLElement | null>(null);
  const isDeletingProjectRef = useRef(false);

  const attachmentPreviews = useMemo(
    () => attachments.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [attachments],
  );
  const composerTokenCount = selectedSkills.length + attachedClipperItems.length + attachments.length;
  const previousComposerTokenCountRef = useRef(0);

  useEffect(() => {
    return () => {
      attachmentPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [attachmentPreviews]);

  // Preserve text the user already typed, but when the composer is empty place
  // the caret after newly added image/skill chips instead of before them.
  useLayoutEffect(() => {
    const previousCount = previousComposerTokenCountRef.current;
    if (composerTokenCount > previousCount) {
      const hasComposerText = normalizeComposerText(prompt).length > 0;
      setComposerTextPosition((current) => {
        if (!hasComposerText) return null;
        return current === null ? previousCount : Math.min(current, previousCount);
      });
      if (!hasComposerText) {
        requestAnimationFrame(() => {
          const editor = richTextEditorRef.current;
          if (!editor) return;
          editor.focus();
          const selection = window.getSelection();
          if (!selection) return;
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        });
      }
    }
    previousComposerTokenCountRef.current = composerTokenCount;
  }, [composerTokenCount, prompt]);

  useEffect(() => {
    const editor = richTextEditorRef.current;
    if (editor && editor.innerText !== prompt) {
      editor.innerText = prompt;
    }
  }, [prompt, composerTextPosition, composerTokenCount]);

  useEffect(() => {
    const load = async () => {
      const all = await getProjects();
      setRecentProjects(all.slice(0, MAX_RETAINED_PROJECTS));
    };
    load();
  }, []);

  useEffect(() => {
    isDeletingProjectRef.current = isDeletingProject;
  }, [isDeletingProject]);

  useEffect(() => {
    if (!projectPendingDelete) return;
    deleteDialogPreviousFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => deleteCancelButtonRef.current?.focus());

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeletingProjectRef.current) {
        event.preventDefault();
        setProjectPendingDelete(null);
        setProjectDeleteError('');
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = document.getElementById('delete-project-dialog');
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeyDown);
      deleteDialogPreviousFocusRef.current?.focus();
    };
  }, [projectPendingDelete]);

  const openRetainedProject = (projectId: string) => {
    if (onOpenProject) onOpenProject(projectId);
    else navigate(workspacePath(projectId));
  };

  const scrollProjectRail = (direction: -1 | 1) => {
    const rail = projectRailRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(176, rail.clientWidth * 0.72), behavior: 'smooth' });
  };

  const confirmDeleteProject = async () => {
    if (!projectPendingDelete || isDeletingProject) return;
    setIsDeletingProject(true);
    setProjectDeleteError('');
    try {
      const deletedProject = projectPendingDelete;
      await deleteProject(deletedProject.id);
      const conversationIds = Array.from(new Set([
        deletedProject.activeConversationId,
        ...(deletedProject.conversations || []).map((conversation) => conversation.id),
      ].filter((value): value is string => Boolean(value))));
      await Promise.allSettled(conversationIds.map(async (conversationId) => {
        deleteBrowserHarnessSession(conversationId);
        const memoryKey = getMemoryKey(deletedProject.id, conversationId);
        if (memoryKey) await deleteTopicMemory(memoryKey);
      }));
      const remaining = await getProjects();
      setRecentProjects(remaining.slice(0, MAX_RETAINED_PROJECTS));
      setProjectAnnouncement(`项目“${projectPendingDelete.title || '未命名'}”已删除`);
      setProjectPendingDelete(null);
      requestAnimationFrame(() => projectRailRef.current?.focus());
    } catch (error) {
      setProjectDeleteError(error instanceof Error ? error.message : '删除失败，请稍后重试。');
    } finally {
      setIsDeletingProject(false);
    }
  };

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
      setAutoModelSelect(false);
      setPreferredImageModel(mapped || first);
    } catch {
      setAutoModelSelect(true);
      setPreferredImageModel(DEFAULT_AUTO_IMAGE_MODEL);
    }
  }, []);

  useEffect(() => {
    if (!showModelPreference) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !modelPreferenceRef.current?.contains(target)
        && !modelPreferencePanelRef.current?.contains(target)
      ) {
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

  useLayoutEffect(() => {
    if (!showModelPreference) {
      setModelPreferencePosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = modelPreferenceButtonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 16;
      const gap = 10;
      const width = Math.min(340, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, rect.right - width),
        window.innerWidth - width - viewportPadding,
      );
      setModelPreferencePosition({
        left,
        bottom: Math.max(viewportPadding, window.innerHeight - rect.top + gap),
        width,
        maxHeight: Math.max(180, rect.top - gap - viewportPadding),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
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
  };

  const selectAgentMode = (mode: AgentWorkMode) => {
    setAgentMode(mode);
    persistAgentWorkMode(mode);
    setShowAgentModeMenu(false);
  };

  const handleSendDesign = async () => {
    if (isPreparingWorkspace) return;
    const skillData = buildCreativeSkillData(selectedSkills);
    // 图片是结构化附件，不再把 URL 拼进消息正文。
    // Skill 同样通过结构化 capability 传给 Agent，不再伪装成普通提示词前缀。
    const finalPrompt = prompt.trim() || (skillData ? '请根据附件完成所选创作任务。' : '');

    if (finalPrompt || attachments.length > 0 || attachedClipperItems.length > 0) {
      if (recentProjects.length >= MAX_RETAINED_PROJECTS) {
        setWorkspaceLaunchError(`最多保留 ${MAX_RETAINED_PROJECTS} 个项目，请先在下方删除一个旧项目。`);
        projectRailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      setIsPreparingWorkspace(true);
      setWorkspaceLaunchError('');
      try {
        const clipperFiles = await Promise.all(attachedClipperItems.map(async (item, index) => {
          const blob = await fetchImageBlob(item.url);
          const extension = blob.type.includes('jpeg') ? 'jpg' : blob.type.includes('webp') ? 'webp' : blob.type.includes('gif') ? 'gif' : 'png';
          const safeName = (item.title || `clipper-reference-${index + 1}`)
            .replace(/[\\/:*?"<>|]+/g, '-')
            .slice(0, 80);
          return new File([blob], `${safeName}.${extension}`, { type: blob.type || 'image/png' });
        }));
        const allAttachments = [...attachments, ...clipperFiles];
        const projectId = `workspace-${Date.now()}`;
        const conversationId = createConversationId('home');

        if (onStartWorkspace) {
          onStartWorkspace({ projectId, conversationId, prompt: finalPrompt, attachments: allAttachments, skillData });
          return;
        }
        navigate(workspacePath(projectId), {
          state: {
            initialPrompt: finalPrompt,
            initialAttachments: allAttachments,
            initialSkillData: skillData,
          },
        });
      } catch (error) {
        console.error('[Home] Failed to prepare reference images:', error);
        setWorkspaceLaunchError('参考图片读取失败，请检查图片链接或网络后重试。');
      } finally {
        setIsPreparingWorkspace(false);
      }
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

  const appendImageFiles = (candidates: File[]) => {
    const imageFiles = candidates.filter(isImageFile);
    if (imageFiles.length === 0) {
      setComposerUploadError('这里只支持拖入或粘贴图片文件。');
      return;
    }

    setAttachments((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const uniqueFiles = imageFiles.filter((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const availableSlots = Math.max(0, MAX_HOME_IMAGE_ATTACHMENTS - current.length);
      if (uniqueFiles.length > availableSlots) {
        setComposerUploadError(`最多添加 ${MAX_HOME_IMAGE_ATTACHMENTS} 张图片，超出的图片未加入。`);
      } else {
        setComposerUploadError('');
      }
      return [...current, ...uniqueFiles.slice(0, availableSlots)];
    });
  };

  const appendRemoteImage = async (url: string) => {
    try {
      const blob = await fetchImageBlob(url);
      const extension = blob.type.includes('jpeg') ? 'jpg' : blob.type.includes('webp') ? 'webp' : blob.type.includes('gif') ? 'gif' : 'png';
      const rawName = decodeURIComponent(new URL(url).pathname.split('/').pop() || `copied-image.${extension}`);
      const fileName = /\.[a-z0-9]{2,5}$/i.test(rawName) ? rawName : `${rawName}.${extension}`;
      appendImageFiles([new File([blob], fileName, { type: blob.type || 'image/png' })]);
    } catch (error) {
      console.error('[Home] Failed to import dragged or copied image URL:', error);
      setComposerUploadError('无法读取这张网络图片，请保存到本地后再拖入。');
    }
  };

  const handleComposerPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (pastedFiles.length > 0) {
      event.preventDefault();
      appendImageFiles(pastedFiles);
      return;
    }

    const html = event.clipboardData.getData('text/html');
    const copiedImageUrl = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (/^https?:\/\//i.test(copiedImageUrl || '')) {
      event.preventDefault();
      void appendRemoteImage(copiedImageUrl!);
      return;
    }

    // Never let contentEditable import clipboard HTML/CSS. Rich text copied from
    // documents and websites can contain nowrap elements with an intrinsic width
    // large enough to stretch the whole composer.
    const plainText = event.clipboardData.getData('text/plain');
    if (!plainText) return;

    event.preventDefault();
    const editor = richTextEditorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const range = selectedRange && editor.contains(selectedRange.commonAncestorContainer)
      ? selectedRange
      : document.createRange();

    if (!selectedRange || !editor.contains(selectedRange.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    range.deleteContents();
    const textNode = document.createTextNode(plainText.replace(/\r\n?/g, '\n'));
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    setPrompt(normalizeComposerText(editor.innerText));
  };

  const handleComposerDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    composerDragDepthRef.current = 0;
    setIsDraggingImages(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      appendImageFiles(droppedFiles);
      return;
    }

    const droppedUrl = (event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain'))
      .split(/\r?\n/)
      .find((value) => /^https?:\/\//i.test(value.trim()))
      ?.trim();
    if (droppedUrl) void appendRemoteImage(droppedUrl);
  };

  const canSendDesign = Boolean(
    prompt.trim()
    || attachments.length > 0
    || attachedClipperItems.length > 0
    || selectedSkills.length > 0,
  );

  const activeComposerTextPosition = composerTextPosition === null
    ? composerTokenCount
    : Math.min(composerTextPosition, composerTokenCount);

  useEffect(() => {
    if (composerTokenCount === 0) {
      setSelectedComposerTokenIndex(null);
      setIsCaretBeforeComposerTokens(false);
      setComposerTextPosition(null);
      return;
    }
    setSelectedComposerTokenIndex((current) => (
      current !== null && current >= composerTokenCount ? composerTokenCount - 1 : current
    ));
    setComposerTextPosition((current) => current === null ? null : Math.min(current, composerTokenCount));
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

  const isRichTextCaretAtEnd = () => {
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
    const trailingRange = document.createRange();
    trailingRange.selectNodeContents(editor);
    trailingRange.setStart(currentRange.endContainer, currentRange.endOffset);
    return trailingRange.toString().length === 0;
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
        setIsCaretBeforeComposerTokens(false);
      }
    } else {
      setSelectedComposerTokenIndex((current) => {
        if (current === null) return null;
        if (current === tokenIndex) return null;
        return current > tokenIndex ? current - 1 : current;
      });
      setIsCaretBeforeComposerTokens(false);
    }
    setComposerTextPosition((current) => {
      if (current === null) return null;
      return current > tokenIndex ? Math.max(0, current - 1) : current;
    });
    focusRichTextAtStart();
  };

  const handleRichTextKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowLeft" && !event.shiftKey) {
      if (isCaretBeforeComposerTokens) {
        event.preventDefault();
        focusComposerTextPosition(0);
        return;
      }
      if (selectedComposerTokenIndex !== null) {
        event.preventDefault();
        focusComposerTextPosition(selectedComposerTokenIndex);
        return;
      }
      if (composerTokenCount > 0 && isRichTextCaretAtStart()) {
        event.preventDefault();
        if (activeComposerTextPosition > 0) {
          setSelectedComposerTokenIndex(activeComposerTextPosition - 1);
          setIsCaretBeforeComposerTokens(false);
        }
        return;
      }
    }

    if (event.key === "ArrowRight" && !event.shiftKey) {
      if (isCaretBeforeComposerTokens) {
        event.preventDefault();
        setIsCaretBeforeComposerTokens(false);
        if (activeComposerTextPosition === 0) focusRichTextAtStart();
        else if (composerTokenCount > 0) setSelectedComposerTokenIndex(0);
        else focusRichTextAtStart();
        return;
      }
      if (selectedComposerTokenIndex !== null) {
        event.preventDefault();
        focusComposerTextPosition(selectedComposerTokenIndex + 1);
        return;
      }
      if (
        composerTokenCount > 0
        && activeComposerTextPosition < composerTokenCount
        && isRichTextCaretAtEnd()
      ) {
        event.preventDefault();
        setSelectedComposerTokenIndex(activeComposerTextPosition);
        setIsCaretBeforeComposerTokens(false);
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
      focusComposerTextPosition(0);
      return;
    }

    if (event.key === "Backspace" && composerTokenCount > 0 && isRichTextCaretAtStart()) {
      event.preventDefault();
      if (activeComposerTextPosition > 0) {
        setSelectedComposerTokenIndex(activeComposerTextPosition - 1);
        setIsCaretBeforeComposerTokens(false);
      }
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

  const focusComposerTextPosition = (position: number) => {
    setComposerTextPosition(position === composerTokenCount ? null : position);
    setSelectedComposerTokenIndex(null);
    setIsCaretBeforeComposerTokens(false);
    focusRichTextAtStart();
  };

  const renderComposerTextPosition = (position: number) => {
    if (position !== activeComposerTextPosition) {
      return (
        <span
          key={`composer-gap-${position}`}
          role="button"
          tabIndex={0}
          aria-label={`将光标放在第 ${position + 1} 个位置`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            focusComposerTextPosition(position);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              focusComposerTextPosition(position);
            }
          }}
          className="group/caret relative h-7 w-2 shrink-0 cursor-text rounded-sm outline-none after:absolute after:-inset-x-1 after:inset-y-0 hover:bg-slate-100/80 focus-visible:bg-blue-500/10"
        >
          <span className="pointer-events-none absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 bg-transparent transition group-hover/caret:bg-slate-400 group-focus-visible/caret:bg-blue-500" />
        </span>
      );
    }

    const hasComposerText = normalizeComposerText(prompt).length > 0;
    const compactCaret = composerTokenCount > 0 && !hasComposerText;
    const editorWidthClass = compactCaret
      ? 'w-[2px] shrink-0'
      : 'w-full min-w-0 max-w-full basis-full';
    return (
      <div
        key={`composer-editor-${position}`}
        className={`relative min-h-7 ${editorWidthClass}`}
        style={compactCaret ? undefined : { alignSelf: 'stretch', contain: 'inline-size', flex: '1 1 100%', width: '100%', minWidth: 0, maxWidth: '100%', height: 'auto' }}
      >
        {!hasComposerText && composerTokenCount === 0 && (
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
          className={`relative min-h-7 min-w-0 max-w-full whitespace-pre-wrap break-all bg-transparent text-sm font-normal leading-7 text-slate-800 outline-none ${compactCaret ? 'inline-block w-[2px]' : 'block w-full'} ${
            selectedComposerTokenIndex !== null || isCaretBeforeComposerTokens ? 'caret-transparent' : ''
          }`}
          style={compactCaret ? undefined : { boxSizing: 'border-box', display: 'block', width: '100%', maxWidth: '100%', minWidth: 0, height: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'visible' }}
          onPointerDown={(event) => {
            event.stopPropagation();
            setSelectedComposerTokenIndex(null);
            setIsCaretBeforeComposerTokens(false);
          }}
          onInput={(event) => {
            const nextText = normalizeComposerText(event.currentTarget.innerText);
            setPrompt(nextText);
            if (!nextText && event.currentTarget.innerHTML) {
              event.currentTarget.innerHTML = '';
            }
          }}
          onKeyDown={handleRichTextKeyDown}
        />
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white font-sans text-slate-950">
      {/* 顶部主 Tabs 栏 (参照图 1 / 图 3 顶栏) */}
      <div className="z-10 flex h-12 min-h-12 shrink-0 items-center overflow-x-auto border-b border-slate-200/80 bg-white px-3 sm:px-6 lg:absolute lg:left-[30rem] lg:right-0 lg:top-0 xl:left-[34rem]">
        <div className="flex min-w-max items-center gap-0.5">
          {/* Top Tabs */}
          <button
            onClick={() => selectTopTab("skill")}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "skill" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Sparkles size={13} className="text-slate-500" /> Skill
          </button>

          <button
            onClick={() => selectTopTab("pinterest")}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "pinterest" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 text-white font-serif font-bold text-[9px] flex items-center justify-center">P</span>
            Pinterest
          </button>

          <button
            onClick={() => selectTopTab("brand")}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "brand" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Box size={13} className="text-slate-500" /> 我的素材
          </button>

          <button
            onClick={() => selectTopTab("clipper")}
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
          className="relative min-h-[34rem] max-h-[65vh] w-full shrink-0 overflow-y-auto border-b border-slate-200/80 bg-[#FCFCFB] p-5 sm:p-7 lg:min-h-0 lg:max-h-none lg:w-[30rem] lg:border-b-0 lg:border-r xl:w-[34rem]"
        >
          <div className="mx-auto flex min-h-full w-full max-w-[30rem] flex-col justify-start py-4 lg:py-8">
            <div className="flex flex-1 flex-col justify-center">
            <div className="mb-7 text-center">
              <h2 className="text-xl font-medium tracking-[-0.025em] text-slate-950">
                你想设计什么？
              </h2>
            </div>

            {/* 富文本 AI 设计输入框：技能、剪藏图和上传图片都作为内容芯片呈现 */}
            <div
              onFocusCapture={onAgentEngage}
              onPaste={handleComposerPaste}
              onDragEnter={(event) => {
                event.preventDefault();
                composerDragDepthRef.current += 1;
                setIsDraggingImages(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                composerDragDepthRef.current = Math.max(0, composerDragDepthRef.current - 1);
                if (composerDragDepthRef.current === 0) setIsDraggingImages(false);
              }}
              onDrop={handleComposerDrop}
              onClick={() => {
                setSelectedComposerTokenIndex(null);
                setIsCaretBeforeComposerTokens(false);
                richTextEditorRef.current?.focus();
              }}
              className={`relative flex min-h-[7rem] cursor-text flex-col justify-between rounded-[1.25rem] border bg-white px-4 pb-1.5 pt-2.5 shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow,background-color] focus-within:border-slate-400 focus-within:shadow-[0_3px_10px_rgba(15,23,42,0.09)] ${
                isDraggingImages
                  ? 'border-blue-500 bg-blue-50/60 shadow-[0_0_0_3px_rgba(59,130,246,0.14)]'
                  : 'border-[#D4D4D4]'
              }`}
            >
              {isDraggingImages && (
                <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-lg border border-dashed border-blue-400 bg-blue-50/90 text-sm font-semibold text-blue-700">
                  松开即可添加图片
                </div>
              )}
              <div className="relative flex min-h-[3.5rem] min-w-0 max-w-full flex-wrap content-start items-center gap-x-0 gap-y-1.5 overflow-visible">
                {renderComposerTextPosition(0)}
                {selectedSkills.map((skill, skillIndex) => (
                    <React.Fragment key={skill.mode}>
                      <span
                        contentEditable={false}
                        tabIndex={0}
                        aria-label={`技能 ${skill.title}`}
                        aria-selected={selectedComposerTokenIndex === skillIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedComposerTokenIndex(skillIndex);
                          setIsCaretBeforeComposerTokens(false);
                          richTextEditorRef.current?.focus();
                        }}
                        onFocus={() => {
                          setSelectedComposerTokenIndex(skillIndex);
                          setIsCaretBeforeComposerTokens(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                            event.preventDefault();
                            event.stopPropagation();
                            focusComposerTextPosition(
                              event.key === 'ArrowLeft' ? skillIndex : skillIndex + 1,
                            );
                          }
                          if (event.key === 'Backspace' || event.key === 'Delete') {
                            event.preventDefault();
                            event.stopPropagation();
                            removeComposerTokenAt(skillIndex);
                          }
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className={`inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border bg-white px-1 text-[0.7rem] font-medium text-slate-900 shadow-2xs transition ${
                          selectedComposerTokenIndex === skillIndex
                            ? 'border-blue-500 ring-2 ring-blue-500/15'
                            : 'border-slate-300'
                        }`}
                      >
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-slate-100 text-slate-600">
                          <Sparkles size={10} />
                        </span>
                        <span className="max-w-[6rem] truncate" title={skill.title}>{skill.title}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeComposerTokenAt(skillIndex);
                          }}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label="移除技能"
                        >
                          <X size={10} />
                        </button>
                      </span>
                      {renderComposerTextPosition(skillIndex + 1)}
                    </React.Fragment>
                    ))}

                    {attachedClipperItems.map((item, clipperIndex) => {
                      const tokenIndex = selectedSkills.length + clipperIndex;
                      return (
                      <React.Fragment key={item.id}>
                      <span
                        contentEditable={false}
                        tabIndex={0}
                        aria-label={`预览图片 ${item.title || 'Clipper 参考图'}`}
                        aria-selected={selectedComposerTokenIndex === tokenIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedComposerTokenIndex(tokenIndex);
                          setIsCaretBeforeComposerTokens(false);
                          richTextEditorRef.current?.focus();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className={`group relative inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border bg-white px-1 text-[0.7rem] font-medium text-slate-900 shadow-2xs transition ${
                          selectedComposerTokenIndex === tokenIndex
                            ? 'border-blue-500 ring-2 ring-blue-500/15'
                            : 'border-slate-300'
                        }`}
                      >
                        <span className="pointer-events-none invisible absolute bottom-full left-0 z-[70] mb-3 w-32 max-w-[calc(100vw-2rem)] translate-y-1 rounded-xl border border-slate-200 bg-white p-1 opacity-0 shadow-[0_12px_32px_rgba(15,23,42,0.18)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                          <img
                            src={item.url}
                            alt=""
                            className="block max-h-48 w-full rounded-lg bg-slate-100 object-contain"
                          />
                        </span>
                        <img
                          src={item.url}
                          alt={item.title}
                          className="h-4 w-4 shrink-0 rounded bg-slate-100 object-cover"
                        />
                        <span className="max-w-[6rem] truncate">{item.title || 'Clipper 参考图'}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeComposerTokenAt(tokenIndex);
                          }}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label="移除剪藏参考图"
                        >
                          <X size={10} />
                        </button>
                      </span>
                      {renderComposerTextPosition(tokenIndex + 1)}
                      </React.Fragment>
                      );
                    })}

                    {attachmentPreviews.map(({ file, url }, index) => {
                      const tokenIndex = selectedSkills.length + attachedClipperItems.length + index;
                      return (
                      <React.Fragment key={`${file.name}-${file.lastModified}-${index}`}>
                      <span
                        contentEditable={false}
                        tabIndex={0}
                        aria-label={`预览图片 ${getReadableAttachmentLabel(file.name, index)}`}
                        aria-selected={selectedComposerTokenIndex === tokenIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedComposerTokenIndex(tokenIndex);
                          setIsCaretBeforeComposerTokens(false);
                          richTextEditorRef.current?.focus();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className={`group relative inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border bg-white px-1 text-[0.7rem] font-medium text-slate-900 shadow-2xs transition ${
                          selectedComposerTokenIndex === tokenIndex
                            ? 'border-blue-500 ring-2 ring-blue-500/15'
                            : 'border-slate-300'
                        }`}
                      >
                        <span className="pointer-events-none invisible absolute bottom-full left-0 z-[70] mb-3 w-32 max-w-[calc(100vw-2rem)] translate-y-1 rounded-xl border border-slate-200 bg-white p-1 opacity-0 shadow-[0_12px_32px_rgba(15,23,42,0.18)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                          <img
                            src={url}
                            alt=""
                            className="block max-h-48 w-full rounded-lg bg-slate-100 object-contain"
                          />
                        </span>
                        <img src={url} alt="" className="h-4 w-4 shrink-0 rounded bg-slate-100 object-cover" />
                        <span className="max-w-[6rem] truncate" title={file.name}>{getReadableAttachmentLabel(file.name, index)}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeComposerTokenAt(tokenIndex);
                          }}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label={`移除图片 ${file.name}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                      {renderComposerTextPosition(tokenIndex + 1)}
                      </React.Fragment>
                      );
                    })}
              </div>

              <div className="mt-1 flex items-center justify-between">
                <div className="flex min-w-0 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="添加参考图片"
                    title="添加参考图片"
                    className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      appendImageFiles(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                />

                <div className="flex items-center gap-0.5">
                  <div className="relative">
                    <button
                      ref={modelPreferenceButtonRef}
                      type="button"
                      onClick={() => setShowAgentModeMenu((visible) => !visible)}
                      aria-label={`当前为 ${activeAgentModeOption.label} 模式`}
                      aria-haspopup="menu"
                      aria-expanded={showAgentModeMenu}
                      title={activeAgentModeOption.description}
                      className="group flex h-11 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    >
                      <span className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[0.7rem] font-semibold transition-colors ${
                        agentMode === 'plan'
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                          : agentMode === 'ask'
                            ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'
                            : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                      }`}>
                        {React.createElement(activeAgentModeOption.icon, { size: 12 })}
                        <span>{activeAgentModeOption.label}</span>
                        <ChevronDown size={11} />
                      </span>
                    </button>
                    {showAgentModeMenu && (
                      <div role="menu" className="absolute bottom-full right-0 z-[110] mb-3 w-[230px] overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
                        {HOME_AGENT_MODE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={agentMode === option.id}
                            onClick={() => selectAgentMode(option.id)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${agentMode === option.id ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
                              {React.createElement(option.icon, { size: 14 })}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-bold">{option.label}</span>
                              <span className="block truncate text-[10px] text-slate-400">{option.description}</span>
                            </span>
                            {agentMode === option.id && <Check size={14} className="text-blue-500" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div ref={modelPreferenceRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowModelPreference((visible) => !visible)}
                      aria-label="模型偏好"
                      aria-haspopup="dialog"
                      aria-expanded={showModelPreference}
                      className="group grid h-11 w-11 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
                        showModelPreference
                          ? "bg-slate-100 text-slate-950"
                          : "text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-950"
                      }`}>
                        <Box size={14} />
                      </span>
                    </button>

                    {showModelPreference && modelPreferencePosition && ReactDOM.createPortal(
                      <section
                        ref={modelPreferencePanelRef}
                        role="dialog"
                        aria-label="模型偏好"
                        style={modelPreferencePosition}
                        className="fixed z-[200] overflow-y-auto rounded-2xl border border-[#E5E5E5] bg-white p-4 text-left shadow-[0_18px_55px_rgba(15,23,42,0.2)] animate-in fade-in slide-in-from-bottom-2 duration-150"
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
                            <button
                              type="button"
                              onClick={() => setShowModelPreference(false)}
                              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                              aria-label="关闭模型偏好"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </header>

                        <CreativeImageModelSelector
                          value={preferredImageModel}
                          onChange={(modelId) => setPreferredImageModel(modelId)}
                          onUserSelect={(modelId) => selectPreferredImageModel(modelId)}
                          title=""
                          description="Virse 开启时展示并使用 Virse 通道实时支持的图像模型"
                          layout="list"
                          className="mt-3 border-0 bg-transparent p-0 shadow-none"
                        />
                      </section>,
                      document.body
                    )}
                  </div>
                  <button
                    onClick={handleSendDesign}
                    disabled={!canSendDesign || isPreparingWorkspace}
                    aria-label="开始创作"
                    className="group grid h-11 w-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                  >
                    <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
                      canSendDesign && !isPreparingWorkspace ? "cursor-pointer bg-slate-950 text-white group-hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-300"
                    }`}>
                      {isPreparingWorkspace ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <ArrowUp size={13} />}
                    </span>
                  </button>
                </div>
              </div>
              {workspaceLaunchError && (
                <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{workspaceLaunchError}</p>
              )}
              {composerUploadError && (
                <p role="alert" className="mt-2 text-xs font-medium text-amber-600">{composerUploadError}</p>
              )}
            </div>

            {/* 下方引导快捷操作 */}
            <div className="mt-5 space-y-1.5">
              <button
                onClick={() => selectTopTab("skill")}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-normal text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <Sparkles size={14} className="text-blue-500" />
                <span>选择一个专业技能，完成你的电商、创意设计</span>
              </button>

              <button
                onClick={() => selectTopTab("clipper")}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-normal text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <Globe size={14} className="text-emerald-500" />
                <span>添加 XC AI Clipper</span>
              </button>

              <button
                onClick={() => selectTopTab("pinterest")}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-normal text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e60023] font-serif text-[0.6rem] font-bold text-white">P</span>
                <span>使用我的 Pinterest 参考图</span>
              </button>
            </div>
            </div>

            <section className="mt-auto border-t border-slate-200/80 pt-4" aria-labelledby="retained-projects-title">
              <div className={`flex items-center justify-between gap-3 ${areRetainedProjectsCollapsed ? '' : 'mb-3'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 id="retained-projects-title" className="text-sm font-semibold text-slate-950">保留项目</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-600">
                      {recentProjects.length}/{MAX_RETAINED_PROJECTS}
                    </span>
                  </div>
                  {!areRetainedProjectsCollapsed && (
                    <p className="mt-0.5 text-xs text-slate-600">自动保存，点击即可继续创作</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!areRetainedProjectsCollapsed && recentProjects.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => scrollProjectRail(-1)}
                        aria-label="查看上一个保留项目"
                        className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollProjectRail(1)}
                        aria-label="查看下一个保留项目"
                        className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setAreRetainedProjectsCollapsed((collapsed) => !collapsed)}
                    aria-expanded={!areRetainedProjectsCollapsed}
                    aria-controls="retained-projects-content"
                    aria-label={areRetainedProjectsCollapsed ? '展开保留项目' : '收起保留项目'}
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                  >
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${areRetainedProjectsCollapsed ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {!areRetainedProjectsCollapsed && (
                <div id="retained-projects-content">
                  {recentProjects.length > 0 ? (
                    <div
                      ref={projectRailRef}
                      tabIndex={-1}
                      className="flex max-w-full gap-3 overflow-x-hidden px-0.5 py-2 scroll-smooth outline-none"
                      aria-label="保留项目列表，请使用左右箭头切换"
                    >
                  {recentProjects.map((project) => (
                    <div
                      key={project.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openRetainedProject(project.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openRetainedProject(project.id);
                        }
                      }}
                      aria-label={`继续创作项目：${project.title || '未命名'}`}
                      className="group relative min-w-[10.75rem] max-w-[10.75rem] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                    >
                      <div className="relative h-24 overflow-hidden bg-[#F6F7F9]">
                        {project.thumbnail ? (
                          <img
                            src={project.thumbnail}
                            alt={`${project.title || '未命名'}项目预览`}
                            draggable={false}
                            className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
                            <FolderOpen size={21} strokeWidth={1.6} />
                            <span className="text-[0.7rem] font-medium text-slate-500">暂无预览</span>
                          </div>
                        )}
                        <button
                          type="button"
                          data-project-delete
                          onClick={(event) => {
                            event.stopPropagation();
                            setProjectDeleteError('');
                            setProjectPendingDelete(project);
                          }}
                          aria-label={`删除项目：${project.title || '未命名'}`}
                          title="删除项目"
                          className="absolute right-0.5 top-0.5 grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-transparent bg-transparent text-slate-400 opacity-100 transition-colors hover:bg-white/80 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="border-t border-slate-200/80 px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-slate-900" title={project.title || '未命名'}>
                          {project.title || '未命名'}
                        </p>
                        <p className="mt-0.5 text-[0.7rem] text-slate-500">
                          {formatProjectUpdatedAt(project.updatedAt)} 已保存
                        </p>
                      </div>
                    </div>
                  ))}
                    </div>
                  ) : (
                    <div className="flex min-h-28 items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-left">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                        <FolderOpen size={19} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">还没有保留项目</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">开始创作后，画布和对话会自动保存在这里。</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="sr-only" aria-live="polite">{projectAnnouncement}</p>
            </section>
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

      {projectPendingDelete && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeletingProject) {
              setProjectPendingDelete(null);
              setProjectDeleteError('');
            }
          }}
        >
          <section
            id="delete-project-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            aria-describedby="delete-project-description"
            className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:p-7"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle size={22} />
              </span>
              <div className="min-w-0">
                <h2 id="delete-project-title" className="text-lg font-semibold text-slate-950">确定删除这个项目？</h2>
                <p id="delete-project-description" className="mt-2 text-sm leading-6 text-slate-600">
                  “{projectPendingDelete.title || '未命名'}”的画布、页面和对话记录将被永久删除，此操作无法撤销。
                </p>
              </div>
            </div>

            {projectDeleteError && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {projectDeleteError}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={deleteCancelButtonRef}
                type="button"
                disabled={isDeletingProject}
                onClick={() => {
                  setProjectPendingDelete(null);
                  setProjectDeleteError('');
                }}
                className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={confirmDeleteProject}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
              >
                {isDeletingProject ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                ) : (
                  <Trash2 size={16} />
                )}
                {isDeletingProject ? '正在删除' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Home;
