import React, { useState, useRef, useEffect } from 'react';
import {
  SettingsIcon,
  SendIcon,
} from './Icons';
import { ModelTryOnModal } from './ModelTryOnModal';
import { MarketingModal } from './MarketingModal';
import { BackgroundModal } from './BackgroundModal';
import { TranslateModal } from './TranslateModal';
import { ProjectDetailModal } from './ProjectDetailModal';
import { storageService, Project } from '../services/storageService';
import { UnifiedSettingsModal } from './UnifiedSettingsModal';
import {
  PenTool, Lightbulb, Clapperboard, Aperture, Blocks,
  ChevronDown, Plus, Mic, Sparkles,
  Home, ShoppingBag, Briefcase, Tv, Swords,
  Bell, Sun, Moon,
  User, Globe, Gift, CreditCard, Clock, Briefcase as BriefcaseIcon, HelpCircle, LogOut,
  ArrowUpRight, Settings, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';

import { WorkflowStep } from '../types';
import { compressImageFiles } from '../modules/Cyzx4/utils/imageCompressor';

interface AgentHomeProps {
  onStart: (text: string, image: string | string[] | null, model: string, step?: number) => void;
  onOpenSettings?: () => void;
}

const NAV_TABS = [
  { key: 'create', label: '创作', icon: <Home className="w-4 h-4" /> },
  { key: 'creative', label: '创意中心', icon: <ShoppingBag className="w-4 h-4" /> },
  { key: 'xiaoche', label: '小彻工作站', icon: <Briefcase className="w-4 h-4" /> },
  { key: 'photo', label: '摄影实验室', icon: <Tv className="w-4 h-4" /> },
  { key: 'ai-apps', label: 'AI 应用', icon: <Swords className="w-4 h-4" /> },
];

const QUICK_PILLS = ['白模视频预演', '深度影视工坊', '角色工坊'];

const PROJECT_CARDS = [
  { title: 'Untitled', time: '编辑于 8 个月前', badge: '体验 Brainstorm 模式', gradient: 'linear-gradient(135deg,#5b8def,#7ba8f5)' },
  { title: '一键拉片', time: '编辑于 8 个月前', badge: '体验 Brainstorm 模式', gradient: 'linear-gradient(135deg,#8892a6,#b8c0d0)' },
  { title: 'Untitled', time: '编辑于 8 个月前', badge: '用 MiniMax H3 创作', gradient: 'linear-gradient(135deg,#4a7ddb,#6b9ae8)' },
];

const TOOL_CARDS = [
  { title: '3D实验室', desc: '把画面搬进三维空间，开拍前掌控镜头与光影。', image: '/tool-3d-lab.jpg' },
  { title: '动效工作室', desc: '让标题走进画面，让图形替你把故事讲完。', image: '/tool-motion.jpg' },
  { title: '深度影视工坊', desc: '锁定照片级运镜与调度，一键置换全新角色与电影级场景。', image: '/tool-film.jpg' },
  { title: '电商设计室', desc: '一张商品原图，直接生成一套对标顶级品牌的商拍大片。', image: '/tool-ecom.jpg' },
  { title: '角色工坊', desc: '从人物小传到高定妆造，定制全片镜头绝不漂移的数字主角。', image: '/tool-character.jpg' },
  { title: '3D交互网页设计', desc: '挑选并确认模板，在对话中持续修改 HTML。', image: '/tool-web3d.jpg' },
];

export const AgentHome: React.FC<AgentHomeProps> = ({ onStart, onOpenSettings }) => {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5.6-luna');
  const [showUnifiedSettings, setShowUnifiedSettings] = useState(false);
  const [initialSettingsTab, setInitialSettingsTab] = useState<'model' | 'agent'>('model');
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [selectedRecentProject, setSelectedRecentProject] = useState<Project | null>(null);

  const [activeNav, setActiveNav] = useState<string>('create');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  interface UserAccount {
    username: string;
    displayName: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
    credits: number;
    createdAt: string;
  }
  const loadUsers = (): UserAccount[] => {
    try { return JSON.parse(localStorage.getItem('jingche_users') || '[]'); } catch { return []; }
  };
  const saveUsers = (users: UserAccount[]) => localStorage.setItem('jingche_users', JSON.stringify(users));

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const uname = localStorage.getItem('jingche_session');
    if (!uname) return null;
    return loadUsers().find(u => u.username === uname) || null;
  });
  const isLoggedIn = !!currentUser;
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ username: '', displayName: '', email: '', code: '', password: '', confirmPassword: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTab, setMessageTab] = useState<'服务' | '活动' | '奖励'>('服务');
  const [selectedMsgId, setSelectedMsgId] = useState<string>('dev_welcome');
  const [onlyUnread, setOnlyUnread] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = await compressImageFiles(Array.from(e.target.files));
      if (images.length + files.length > 5) {
        alert('最多支持 5 张图片');
        return;
      }
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImages((prev) => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    if (input.trim() || images.length > 0) {
      onStart(input, images, selectedModel);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleNav = (key: string) => {
    setActiveNav(key);
    switch (key) {
      case 'create':
        break;
      case 'creative':
        onStart('/creative', [], selectedModel);
        break;
      case 'xiaoche':
        onStart('/video', [], selectedModel, WorkflowStep.VIDEO_GENERATION);
        break;
      case 'photo':
        onStart('/model-factory', [], selectedModel, WorkflowStep.MODEL_FACTORY);
        break;
      default:
        break;
    }
  };

  const handleModalConfirm = async (modelImg: string, garmentImg: string, aspectRatio: string, resolution: string) => {
    setShowTryOnModal(false);
    onStart(
      `/model 模特上身生成 (比例: ${aspectRatio}, 清晰度: ${resolution})`,
      [modelImg, garmentImg],
      selectedModel,
      WorkflowStep.MODEL_TRY_ON
    );
  };

  const handleMarketingConfirm = async (productImages: string[], aspectRatio: string, description: string, resolution: string) => {
    setShowMarketingModal(false);
    const promptDescription = description.trim() ? ` 详细要求: ${description}` : '';
    onStart(
      `/marketing 生成节日促销海报 (比例: ${aspectRatio}, 分辨率: ${resolution})${promptDescription}`,
      productImages,
      selectedModel,
      WorkflowStep.MARKETING_IMAGE_GENERATION
    );
  };

  const handleBackgroundConfirm = (productImg: string, bgImg: string) => {
    setShowBackgroundModal(false);
    onStart('/background 将左侧商品自然融合到右侧场景中，保持光影自然，生成高品质背景图', [productImg, bgImg], selectedModel);
  };

  const handleTranslateConfirm = (img: string) => {
    setShowTranslateModal(false);
    onStart('/creative 创意生成，发挥你的想象力，基于这张图片生成新的设计概念', [img], selectedModel);
  };

  const handleLoginSubmit = async () => {
    setAuthError('');
    if (!loginForm.username || !loginForm.password) {
      setAuthError('请填写用户名和密码');
      return;
    }
    const users = loadUsers();
    let found = users.find(u => (u.username === loginForm.username || u.displayName === loginForm.username) && u.password === loginForm.password);

    // 若本地未找到，尝试请求后端登录接口
    if (!found) {
      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginForm.username, password: loginForm.password }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.user) {
            const remoteUser: UserAccount = {
              username: data.user.handle?.replace(/^@/, '') || data.user.name,
              displayName: data.user.name,
              email: data.user.email,
              password: loginForm.password,
              role: data.user.role === 'admin' ? 'admin' : 'user',
              credits: data.user.credits || 100,
              createdAt: data.user.createdAt || new Date().toISOString(),
            };
            users.push(remoteUser);
            saveUsers(users);
            found = remoteUser;
          } else if (data.message) {
            setAuthError(data.message);
            return;
          }
        }
      } catch (e) {
        // 后端无法访问时忽略
      }
    }

    if (!found) {
      setAuthError('用户名或密码错误');
      return;
    }

    localStorage.setItem('jingche_session', found.username);
    setCurrentUser(found);
    setShowLoginModal(false);
  };

  const handleRegisterSubmit = async () => {
    setAuthError('');
    if (!regForm.username || !regForm.password) { setAuthError('请填写用户名和密码'); return; }
    if (regForm.password.length < 8) { setAuthError('密码长度至少需要 8 位字符'); return; }
    if (regForm.password !== regForm.confirmPassword) { setAuthError('两次密码不一致'); return; }
    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === regForm.username.toLowerCase())) {
      setAuthError('用户名已存在');
      return;
    }

    // 核心规则：系统第一个注册的用户自动视为开发者，享有开发者后台权限
    const isFirst = users.length === 0 || !users.some(u => u.role === 'admin');
    const role: 'admin' | 'user' = isFirst ? 'admin' : 'user';
    const newUser: UserAccount = {
      username: regForm.username.trim(),
      displayName: regForm.displayName?.trim() || regForm.username.trim(),
      email: regForm.email?.trim() || '',
      password: regForm.password,
      role: role,
      credits: isFirst ? 9999 : 100,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers(users);
    localStorage.setItem('jingche_session', newUser.username);
    setCurrentUser(newUser);
    setShowLoginModal(false);

    // 异步同步到后端 Docker /api/users
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.displayName,
          handle: newUser.username.startsWith('@') ? newUser.username : `@${newUser.username}`,
          email: newUser.email,
          password: newUser.password,
          role: role,
          credits: newUser.credits,
          notes: isFirst ? '首位注册开发者 (自动获得开发者后台权限)' : '普通注册用户',
        }),
      });
    } catch (e) {
      // 降级使用本地存储
    }

    if (isFirst) {
      setSelectedMsgId('dev_welcome');
      setShowMessageModal(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jingche_session');
    setCurrentUser(null);
    setShowProfileMenu(false);
  };

  const PROFILE_MENU = [
    { icon: <User className="w-4 h-4" />, label: '个人主页' },
    { icon: <Globe className="w-4 h-4" />, label: '简体中文', hasArrow: true },
    { icon: <CreditCard className="w-4 h-4" />, label: '账户管理' },
    ...(currentUser?.role === 'admin' ? [{
      icon: <Settings className="w-4 h-4 text-cyan-400" />,
      label: '开发者后台',
      isHighlight: true,
      badge: 'Admin',
      action: () => {
        setShowProfileMenu(false);
        if (onOpenSettings) {
          onOpenSettings();
        } else {
          setShowUnifiedSettings(true);
        }
      },
    }] : []),
    { icon: <LogOut className="w-4 h-4" />, label: '登出账号', action: handleLogout },
  ];

  return (
    <div
      className="flex flex-col h-full w-full bg-white text-gray-900 dark:bg-[#0a0a0a] dark:text-[#eaeaea] font-sans overflow-hidden transition-colors duration-300"
      style={{
        backgroundImage: isDark ? 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)' : 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* TOP NAV */}
      <header className="shrink-0 h-16 flex items-center justify-between px-5 border-b border-gray-200 dark:border-white/[0.06] relative z-30 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur">
        {/* Logo */}
        <div className="flex items-center gap-2.5 w-[220px]">
          <img src="/jingche-logo.png" alt="境彻" className="w-8 h-8 rounded-lg object-cover" />
          <span className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">境彻</span>
        </div>

        {/* Center tabs */}
        <nav className="flex items-center gap-1">
          {NAV_TABS.map((tab) => {
            const isActive = activeNav === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleNav(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[15px] transition-colors ${
                  isActive
                    ? 'bg-gray-200 text-gray-900 font-medium dark:bg-white/[0.08] dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white/80'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2 w-[280px] justify-end">
          <button
            onClick={() => setShowMessageModal(true)}
            className="relative p-2 rounded-full text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white/80 transition-colors"
            title="我的消息"
          >
            <Bell className="w-4.5 h-4.5" />
            {currentUser?.role === 'admin' && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white/80 transition-colors"
            title={isDark ? '切换到浅色' : '切换到深色'}
          >
            {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {/* Free trial button when logged out */}
          {!isLoggedIn && (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-4 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black text-[14px] font-medium transition-colors"
            >
              免费体验
            </button>
          )}

          {/* User pill with dropdown */}
          {isLoggedIn && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] transition-colors"
            >
              <span className="text-[14px] text-gray-700 dark:text-white/80 max-w-[90px] truncate">{currentUser?.displayName || currentUser?.username}</span>
              <ChevronDown className="w-4 h-4 text-gray-400 dark:text-white/50" />
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-[11px] font-bold">
                {(currentUser?.displayName || currentUser?.username || "?")[0].toUpperCase()}
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-72 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-2 z-50">
                <div className="flex items-center gap-3 p-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-[14px] font-bold shrink-0">
                    {(currentUser?.displayName || currentUser?.username || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">{currentUser?.displayName}</span>
                      {currentUser?.role === 'admin' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                          👑 开发者
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-gray-400 dark:text-white/40 truncate">{currentUser?.email || `${currentUser?.username}@jingche`}</div>
                  </div>
                </div>

                <div className="mx-3 mb-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[13px] text-gray-900 dark:text-white">
                      <CreditCard className="w-3.5 h-3.5 text-gray-500 dark:text-white/60" />
                      <span className="font-semibold">{currentUser?.credits ?? 0}</span>
                      <span className="text-[10px] text-gray-400 dark:text-white/40 font-medium">{currentUser?.role === 'admin' ? 'DEV' : 'FREE'}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-white/50">{currentUser?.role === 'admin' ? '开发者特权 / 无额度限制' : '无额度限制'}</div>
                  <div className="mt-2 h-1 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full" />
                  </div>
                </div>

                <div className="my-1 border-t border-gray-200 dark:border-white/[0.06]" />

                {PROFILE_MENU.map((item: any) => (
                  <button
                    key={item.label}
                    onClick={() => item.action?.()}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg transition-colors ${
                      item.isHighlight
                        ? 'text-cyan-700 bg-cyan-500/10 hover:bg-cyan-500/15 dark:text-cyan-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={item.isHighlight ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400 dark:text-white/50'}>{item.icon}</span>
                      <span className={item.isHighlight ? 'font-medium' : ''}>{item.label}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                          {item.badge}
                        </span>
                      )}
                      {item.hasArrow && <ChevronDown className="w-3.5 h-3.5 text-gray-300 dark:text-white/30" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </header>

      {/* SCROLLABLE CONTENT */}
      <main className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="mx-auto w-full max-w-[880px] px-6 pt-10">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <Sparkles className="w-6 h-6 text-gray-900 dark:text-white" />
            <h1 className="text-[31px] font-semibold text-gray-900 dark:text-white tracking-tight">今天要做点什么？</h1>
          </div>

          {/* Input card */}
          <div className="rounded-2xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/[0.06] p-5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="根据我的偏好创建专属 Skill"
              rows={2}
              className="w-full bg-transparent border-none outline-none resize-none text-[18px] text-gray-900 placeholder-gray-400 dark:text-white dark:placeholder-white/30 leading-relaxed"
            />

            {images.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
                    <img src={img} alt="参考" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <label className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-200 cursor-pointer transition-colors dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5" title="添加">
                  <Plus className="w-5 h-5" />
                  <input type="file" multiple className="hidden" onChange={handleImageUpload} accept="image/*" />
                </label>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[14px] text-gray-600 hover:bg-gray-200 transition-colors dark:text-white/60 dark:hover:bg-white/5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>手动确认</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5" title="语音">
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  onClick={handleStart}
                  disabled={!input && images.length === 0}
                  className="w-10 h-10 rounded-full bg-gray-200 text-gray-900 flex items-center justify-center hover:bg-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:bg-[#2a2a2a] dark:text-white dark:hover:bg-[#3a3a3a]"
                  title="发送"
                >
                  <ArrowUpRight className="w-5 h-5 rotate-45" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick pills */}
          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-2">
              {QUICK_PILLS.map((pill) => (
                <button
                  key={pill}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[14px] text-gray-600 transition-colors dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/60"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{pill}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-gray-400 dark:text-white/30">技能</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-400 to-purple-400" />
                <div className="w-5 h-5 rounded bg-gradient-to-br from-pink-400 to-orange-400" />
              </div>
            </div>
          </div>

          {/* Project cards */}
          <div className="grid grid-cols-4 gap-4 mt-7">
            <button className="aspect-[4/3] rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.06] flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-white/40 dark:hover:text-white/70 transition-colors">
              <Plus className="w-5 h-5" />
              <span className="text-[12.5px]">新建项目</span>
            </button>
            {PROJECT_CARDS.map((p, i) => (
              <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden group">
                <div className="absolute inset-0" style={{ background: p.gradient }} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium text-white">{p.title}</span>
                    <span className="text-[12px] text-white/50">{p.time}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[13px] text-white/70">
                    <span className="truncate">{p.badge}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-4">
            <button className="text-[15px] text-gray-400 hover:text-gray-700 transition-colors dark:text-white/40 dark:hover:text-white/70">
              所有项目 →
            </button>
          </div>
        </div>

        {/* Bento showcase - centered container */}
        <section className="mx-auto w-full max-w-[1400px] px-5 mt-10 pb-10">
          <div className="rounded-3xl overflow-hidden bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/[0.04] flex">
            {/* Left banner */}
            <div
              className="relative w-[38%] min-h-[570px] flex flex-col p-10 overflow-hidden shrink-0"
              style={{ backgroundImage: 'url(/banner-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="relative z-10 flex-1 flex items-center justify-center">
                <img src="/astra-logo.png" alt="Astra Studio" className="w-[85%] max-w-[420px]" />
              </div>
              <div className="relative z-10">
                <button className="px-7 py-3 rounded-full bg-white text-black text-[14px] font-medium hover:opacity-90 transition-opacity">
                  探索Astra Studio
                </button>
              </div>
              <div className="absolute inset-0"
                style={{ background: 'radial-gradient(circle at 25% 15%, rgba(255,255,255,0.25), transparent 55%)' }}
              />
            </div>

            {/* Right tool cards */}
            <div className="flex-1 grid grid-cols-3 gap-4 p-4">
              {TOOL_CARDS.map((tool, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden cursor-pointer group min-h-[270px] flex flex-col">
                  <img src={tool.image} alt={tool.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="flex-1" />
                  <div className="relative bg-black/85 backdrop-blur-sm p-3">
                    <div className="flex items-center gap-1 text-[14px] font-semibold text-white">
                      <span>{tool.title}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                    <div className="mt-1 text-[12px] text-white/60 leading-snug line-clamp-2">{tool.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <ModelTryOnModal isOpen={showTryOnModal} onClose={() => setShowTryOnModal(false)} onConfirm={handleModalConfirm} />
      <MarketingModal isOpen={showMarketingModal} onClose={() => setShowMarketingModal(false)} onConfirm={handleMarketingConfirm} />
      <BackgroundModal isOpen={showBackgroundModal} onClose={() => setShowBackgroundModal(false)} onConfirm={handleBackgroundConfirm} />
      <TranslateModal isOpen={showTranslateModal} onClose={() => setShowTranslateModal(false)} onConfirm={handleTranslateConfirm} />
      <ProjectDetailModal
        project={selectedRecentProject}
        onClose={() => setSelectedRecentProject(null)}
        onDelete={async (id) => {
          await storageService.deleteProject(id);
          setSelectedRecentProject(null);
          window.location.reload();
        }}
      />
      <UnifiedSettingsModal
        isOpen={showUnifiedSettings}
        onClose={() => setShowUnifiedSettings(false)}
        initialTab={initialSettingsTab}
      />

      {/* Login / Register Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowLoginModal(false)}>
          <div className="w-[420px] rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[20px] font-semibold text-gray-900 dark:text-white">{loginMode === 'login' ? '登录' : '注册'}</h2>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-gray-700 transition-colors dark:text-white/40 dark:hover:text-white/70">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 mb-5 p-1 rounded-lg bg-gray-100 dark:bg-white/[0.04]">
              <button
                onClick={() => setLoginMode('login')}
                className={`flex-1 py-1.5 rounded-md text-[13px] transition-colors ${loginMode === 'login' ? 'bg-gray-200 text-gray-900 font-medium dark:bg-white/[0.08] dark:text-white' : 'text-gray-500 dark:text-white/50'}`}
              >
                登录
              </button>
              <button
                onClick={() => setLoginMode('register')}
                className={`flex-1 py-1.5 rounded-md text-[13px] transition-colors ${loginMode === 'register' ? 'bg-gray-200 text-gray-900 font-medium dark:bg-white/[0.08] dark:text-white' : 'text-gray-500 dark:text-white/50'}`}
              >
                注册
              </button>
            </div>

            {/* 开发者特权与后台权限说明 - 纯净色块风格，无图标，极简克制 */}
            {loginMode === 'register' && (
              <div className="mb-4 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[12px] font-medium text-gray-900 dark:text-white/90">开发者特权说明</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500 dark:bg-white/[0.08] dark:text-white/50">
                    首位生效
                  </span>
                </div>
                <p className="text-[12px] text-gray-600 leading-relaxed dark:text-white/60">
                  系统第一个注册的用户将自动视为开发者，享有最高系统权限，注册成功后可直接解锁并进入【开发者后台】管理模型密钥、通道与全局参数；后续注册账号为普通用户。
                </p>
              </div>
            )}

            {authError && <div className="mb-4 text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{authError}</div>}

            {loginMode === 'login' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="用户名"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[14px] placeholder-gray-400 dark:placeholder-white/30 outline-none focus:border-gray-400 dark:focus:border-white/20"
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="密码"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[14px] placeholder-gray-400 dark:placeholder-white/30 outline-none focus:border-gray-400 dark:focus:border-white/20"
                />
                <button
                  onClick={handleLoginSubmit}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-[14px] font-medium transition-colors"
                >
                  登录
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-white/50 mb-1 block">用户名</label>
                    <input
                      type="text"
                      placeholder="3-32 位字符"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[13px] placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-gray-400 dark:focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-white/50 mb-1 block">显示名称</label>
                    <input
                      type="text"
                      placeholder="不填则使用用户名"
                      value={regForm.displayName}
                      onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[13px] placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-gray-400 dark:focus:border-white/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 dark:text-white/50 mb-1 block">邮箱</label>
                  <input
                    type="email"
                    placeholder="用于登录与安全验证"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[13px] placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-gray-400 dark:focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 dark:text-white/50 mb-1 block">邮箱验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="6 位验证码"
                      value={regForm.code}
                      onChange={(e) => setRegForm({ ...regForm, code: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[13px] placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-gray-400 dark:focus:border-white/20"
                    />
                    <button className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-[12px] hover:bg-gray-200 whitespace-nowrap transition-colors dark:bg-white/[0.06] dark:text-white/70 dark:hover:bg-white/[0.1]">
                      获取验证码
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-white/50 mb-1 block">密码</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        placeholder="至少 8 位"
                        value={regForm.password}
                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                        className="w-full px-3 py-2 pr-9 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[13px] placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-gray-400 dark:focus:border-white/20"
                      />
                      <button onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-white/50 mb-1 block">确认密码</label>
                    <div className="relative">
                      <input
                        type={showConfirmPwd ? 'text' : 'password'}
                        placeholder="再次输入密码"
                        value={regForm.confirmPassword}
                        onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-9 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-[13px] placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-gray-400 dark:focus:border-white/20"
                      />
                      <button onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30">
                        {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRegisterSubmit}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-[14px] font-medium transition-colors shadow-lg shadow-cyan-500/10 mt-1"
                >
                  创建账号 →
                </button>
                <div className="text-center text-[11px] text-white/40 pt-1">
                  首个注册账号将自动激活开发者后台管理权限
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 我的消息 / 开发者提示弹窗 (UI 参考图3) */}
      {showMessageModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setShowMessageModal(false)}
        >
          <div
            className="w-[740px] max-w-[94vw] h-[520px] max-h-[88vh] rounded-2xl bg-[#191919] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-[17px] font-semibold text-white tracking-tight">我的消息</h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-white/40 hover:text-white/80 text-xl leading-none transition-colors px-1"
              >
                ×
              </button>
            </div>

            {/* 分类胶囊栏 (服务 / 活动 / 奖励) - 纯色块风格 */}
            <div className="flex items-center gap-2 px-6 pb-3">
              {(['服务', '活动', '奖励'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMessageTab(tab)}
                  className={`px-3.5 py-1 rounded-md text-[13px] font-medium transition-colors ${
                    messageTab === tab
                      ? 'bg-white/[0.12] text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 状态与过滤行 */}
            <div className="flex items-center justify-between px-6 py-2 border-t border-white/[0.06] text-[12px] text-white/50">
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white/70">
                <input
                  type="checkbox"
                  checked={onlyUnread}
                  onChange={(e) => setOnlyUnread(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 w-3.5 h-3.5"
                />
                <span>仅看未读 ({currentUser?.role === 'admin' ? 1 : 0})</span>
              </label>
              <button
                onClick={() => setOnlyUnread(false)}
                className="hover:text-white/80 transition-colors"
              >
                全部已读
              </button>
            </div>

            {/* 内容区：左侧列表 + 右侧详情大色块卡片 (参考图3) */}
            <div className="flex-1 flex overflow-hidden border-t border-white/[0.06]">
              {/* 左侧列表 */}
              <div className="w-[36%] border-r border-white/[0.06] overflow-y-auto p-2.5 space-y-1.5">
                {currentUser?.role === 'admin' ? (
                  <div
                    onClick={() => setSelectedMsgId('dev_welcome')}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      selectedMsgId === 'dev_welcome'
                        ? 'bg-white/[0.08] text-white'
                        : 'hover:bg-white/[0.04] text-white/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        <span className="text-[13px] font-medium">开发者权限激活</span>
                      </div>
                      <span className="text-[10px] text-white/30">刚刚</span>
                    </div>
                    <div className="text-[11.5px] text-white/50 line-clamp-2">
                      您已是系统首位注册者，自动激活开发者后台管理权限。
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[12px] text-white/30">
                    暂无服务通知
                  </div>
                )}
              </div>

              {/* 右侧详情卡片 (大暗灰圆角色块卡片，极简纯净) */}
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                {selectedMsgId === 'dev_welcome' && currentUser?.role === 'admin' ? (
                  <div className="h-full flex flex-col justify-between rounded-xl bg-[#121212] border border-white/[0.04] p-5">
                    <div className="space-y-4 overflow-y-auto pr-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-white">开发者特权激活通知</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] text-white/60">系统</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-cyan-300 text-[10px]">开发者</span>
                        </div>
                        <span className="text-[11px] text-white/30">系统消息</span>
                      </div>

                      <div className="text-[13px] text-white/75 leading-relaxed space-y-3">
                        <p>
                          尊敬的 <span className="text-white font-medium">{currentUser?.displayName || currentUser?.username}</span>：
                        </p>
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04] text-[12.5px] text-white/80">
                          系统检测到您为平台的<strong>首位注册用户</strong>，已根据平台规则自动为您赋予<strong>【开发者】最高系统管理权限</strong>。
                        </div>
                        <p className="text-[12.5px] text-white/70">
                          您现已解锁并可直接进入【开发者后台】进行以下配置：
                        </p>
                        <div className="space-y-1.5 text-[12px] text-white/60 pl-2">
                          <div>• 模型与渠道管理：配置 DeepSeek / Gemini 等模型与密钥</div>
                          <div>• 权限与用户管理：管理账号角色、点数分配及使用记录</div>
                          <div>• 系统参数配置：配置图床代理、MCP 服务与遥测审计</div>
                        </div>
                      </div>
                    </div>

                    {/* 底部色块操作栏 */}
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/[0.06] shrink-0">
                      <button
                        onClick={() => setShowMessageModal(false)}
                        className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[13px] transition-colors"
                      >
                        我知道了
                      </button>
                      <button
                        onClick={() => {
                          setShowMessageModal(false);
                          if (onOpenSettings) {
                            onOpenSettings();
                          } else {
                            setShowUnifiedSettings(true);
                          }
                        }}
                        className="px-5 py-2 rounded-xl bg-white hover:bg-white/90 text-black text-[13px] font-medium transition-colors"
                      >
                        进入开发者后台 →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center rounded-xl bg-[#121212] border border-white/[0.04] text-white/30 text-[13px]">
                    请选择一条消息
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
