import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import PinterestGallery from "../components/PinterestGallery";
import type { WorkspaceSeed } from "./AgentWorkspace";
import { createNewWorkspacePath, workspacePath } from "../utils/routes";
import { getProjects } from "../services/storage";
import { Project } from "../types";

type TopTabType = "skill" | "pinterest" | "brand" | "clipper";

interface HomeProps {
  onExit?: () => void;
  onStartWorkspace?: (seed: WorkspaceSeed) => void;
}

export const Home: React.FC<HomeProps> = ({ onExit, onStartWorkspace }) => {
  const navigate = (to: string, _options?: any) => {
    window.location.hash = typeof to === 'string' ? to : '';
  };
  const [activeTab, setActiveTab] = useState<TopTabType>("brand");
  const [brandSubTab, setBrandSubTab] = useState<"kit" | "role" | "product" | "custom">("kit");
  // 左侧输入框状态
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  useEffect(() => {
    const load = async () => {
      const all = await getProjects();
      setRecentProjects(all.slice(0, 5));
    };
    load();
  }, []);

  const handleSendDesign = () => {
    if (prompt.trim() || attachments.length > 0) {
      if (onStartWorkspace) {
        onStartWorkspace({ prompt, attachments });
        return;
      }
      navigate(createNewWorkspacePath(), {
        state: {
          initialPrompt: prompt,
          initialAttachments: attachments,
        },
      });
    }
  };

  const handleSelectPin = (imageUrl: string, title: string) => {
    setPrompt(`参考这张 Pinterest 视觉：${title}`);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white font-sans text-slate-950">
      {/* 顶部主 Tabs 栏 (参照图 1 / 图 3 顶栏) */}
      <div className="z-10 flex min-h-14 shrink-0 items-center overflow-x-auto border-b border-slate-200/80 bg-white px-3 sm:px-6">
        <div className="flex min-w-max items-center gap-1 py-1.5">
          {/* Top Tabs */}
          <button
            onClick={() => setActiveTab("skill")}
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3.5 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
              activeTab === "skill" ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Sparkles size={13} className="text-blue-500" /> Skill
          </button>

          <button
            onClick={() => setActiveTab("pinterest")}
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3.5 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-600 ${
              activeTab === "pinterest" ? "bg-red-50 text-[#d90b2b]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 text-white font-serif font-black text-[9px] flex items-center justify-center">P</span>
            Pinterest
          </button>

          <button
            onClick={() => setActiveTab("brand")}
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3.5 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 ${
              activeTab === "brand" ? "bg-amber-50 text-amber-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Box size={13} className="text-amber-500" /> 我的素材
          </button>

          <button
            onClick={() => setActiveTab("clipper")}
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3.5 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              activeTab === "clipper" ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Globe size={13} className="text-emerald-500" /> XC AI Clipper
          </button>

          <button type="button" aria-label="添加工作区" className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950">
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
          className="relative min-h-[22rem] w-full shrink-0 border-b border-slate-200/80 bg-[#fbfaf7] p-5 sm:p-8 lg:min-h-0 lg:w-[30rem] lg:border-b-0 lg:border-r xl:w-[34rem]"
        >
          <div className="mx-auto flex h-full w-full max-w-[30rem] flex-col justify-center">
            <div className="mb-6">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-blue-600">Creative brief</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">你想设计什么？</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">描述目标，或从右侧选择一个视觉参考。</p>
            </div>

            {/* AI 设计输入框 */}
            <div className="flex min-h-[11rem] flex-col justify-between rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow] focus-within:border-slate-400 focus-within:shadow-[0_18px_44px_rgba(15,23,42,0.09)]">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                aria-label="设计需求"
                placeholder="例如：为一款户外咖啡机设计有质感的社交媒体视觉…"
                className="h-24 w-full resize-none border-none bg-transparent text-sm font-medium leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendDesign();
                  }
                }}
              />

              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
                  {attachments.map((file, i) => (
                    <div key={i} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="添加参考图片"
                  className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
                >
                  <Plus size={16} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setAttachments(Array.from(e.target.files));
                  }}
                />

                <div className="flex items-center gap-2">
                  <button type="button" aria-label="从素材库选择" className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950">
                    <Box size={16} />
                  </button>
                  <button
                    onClick={handleSendDesign}
                    disabled={!prompt.trim() && attachments.length === 0}
                    aria-label="开始创作"
                    className={`grid h-11 w-11 place-items-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 ${
                      prompt.trim() || attachments.length > 0 ? "cursor-pointer bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-300"
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
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 outline-none transition-colors hover:bg-white hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <Sparkles size={14} className="text-blue-500" />
                <span>选择专业技能开始设计</span>
              </button>

              <button
                onClick={() => setActiveTab("clipper")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 outline-none transition-colors hover:bg-white hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <Globe size={14} className="text-emerald-500" />
                <span>添加 XC AI Clipper</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* 右侧主区域：根据 Tab 动态展现 (Pinterest / 品牌素材 / Skill) */}
        {/* ============================================================ */}
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#fcfbfa]">
          {activeTab === "pinterest" && (
            /* 📌 Pinterest 瀑布流灵感库 (图 3 & 图 4) */
            <PinterestGallery onSelectPin={handleSelectPin} />
          )}

          {activeTab === "brand" && (
            /* 品牌素材与统一套件 (图 1) */
            <div className="w-full h-full flex flex-col">
              {/* 子导航 */}
              <div className="flex items-center gap-6 px-8 py-3 border-b border-gray-100 text-xs font-bold text-gray-400">
                <button
                  onClick={() => setBrandSubTab("kit")}
                  className={`pb-1 transition ${brandSubTab === "kit" ? "text-black border-b-2 border-black font-extrabold" : "hover:text-gray-600"}`}
                >
                  品牌套件
                </button>
                <button
                  onClick={() => setBrandSubTab("role")}
                  className={`pb-1 transition ${brandSubTab === "role" ? "text-black border-b-2 border-black font-extrabold" : "hover:text-gray-600"}`}
                >
                  角色
                </button>
                <button
                  onClick={() => setBrandSubTab("product")}
                  className={`pb-1 transition ${brandSubTab === "product" ? "text-black border-b-2 border-black font-extrabold" : "hover:text-gray-600"}`}
                >
                  产品
                </button>
                <button
                  onClick={() => setBrandSubTab("custom")}
                  className={`pb-1 transition ${brandSubTab === "custom" ? "text-black border-b-2 border-black font-extrabold" : "hover:text-gray-600"}`}
                >
                  自定义
                </button>
              </div>

              {/* 品牌素材卡片展示 */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FBFBFB]">
                <div className="max-w-md space-y-6">
                  {/* 预设卡片图 */}
                  <div className="relative rounded-3xl overflow-hidden border border-gray-200/80 shadow-2xl shadow-gray-200/50 bg-white p-2">
                    <img
                      src="https://images.unsplash.com/photo-1542744094-3a31b272c490?w=800&auto=format&fit=crop&q=80"
                      alt="Brand Kit"
                      className="w-full h-48 object-cover rounded-2xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                      <div className="flex items-center gap-2 text-white font-bold text-sm">
                        <Box size={18} className="text-yellow-400" /> Lovart Brand Kit
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">
                      保持品牌风格一致
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      创建品牌套件，让生成结果保持一致 — 可将其关联到项目，或在对话中随时提及。
                    </p>
                  </div>

                  <button
                    onClick={() => navigate(createNewWorkspacePath())}
                    className="px-6 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-black transition active:scale-95"
                  >
                    新建品牌套件
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "skill" && (
            /* Skill 视觉工作坊与最近项目 */
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-8">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-4">热门专业技能</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div
                    onClick={() => navigate(createNewWorkspacePath())}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-md cursor-pointer transition group"
                  >
                    <div className="aspect-[4/3] rounded-xl bg-gray-200 overflow-hidden mb-3">
                      <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                    <h4 className="text-xs font-bold text-gray-900">电商主图生成</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">高品质商品商业展示图</p>
                  </div>
                  <div
                    onClick={() => navigate(createNewWorkspacePath())}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-md cursor-pointer transition group"
                  >
                    <div className="aspect-[4/3] rounded-xl bg-gray-200 overflow-hidden mb-3">
                      <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                    <h4 className="text-xs font-bold text-gray-900">产品展示视频</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">多镜头AI产品演示组图</p>
                  </div>
                  <div
                    onClick={() => navigate(createNewWorkspacePath())}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-md cursor-pointer transition group"
                  >
                    <div className="aspect-[4/3] rounded-xl bg-gray-200 overflow-hidden mb-3">
                      <img src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                    <h4 className="text-xs font-bold text-gray-900">电商详情页生成</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">长图卖点自动构图排版</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-4">最近项目</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div
                    onClick={() => navigate(createNewWorkspacePath())}
                    className="aspect-[4/3] rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-100 cursor-pointer transition"
                  >
                    <PlusCircle size={24} />
                    <span className="text-xs font-bold mt-2">新建画布项目</span>
                  </div>
                  {recentProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(workspacePath(p.id))}
                      className="aspect-[4/3] rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition relative group"
                    >
                      {p.thumbnail ? (
                        <img src={p.thumbnail} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Box size={24} />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-white opacity-0 group-hover:opacity-100 transition">
                        <div className="text-xs font-bold truncate">{p.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "clipper" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <Globe size={32} className="text-emerald-500 mb-3" />
              <h3 className="text-sm font-bold text-gray-900">Lovart Clipper 网页剪藏</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">一键将全网网页灵感、商品主图剪藏带入 Lovart 画布进行设计处理。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
