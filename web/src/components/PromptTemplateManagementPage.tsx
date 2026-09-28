import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCode,
  Copy,
  Check,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ChevronUp,
  X,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  promptTemplateService,
  PromptTemplateItem,
  PROMPT_CAPABILITY_TYPES,
  PromptTypeDefinition
} from '../services/promptTemplateService';

interface PromptTemplateManagementPageProps {
  onNotify?: (msg: string) => void;
}

export const PromptTemplateManagementPage: React.FC<PromptTemplateManagementPageProps> = ({ onNotify }) => {
  // 列表状态
  const [templates, setTemplates] = useState<PromptTemplateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'history'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 展开查看行的详情
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // 抽屉 / 编辑弹窗状态 (复刻图 3)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formTypeId, setFormTypeId] = useState<string>(PROMPT_CAPABILITY_TYPES[0].id);
  const [formVersionName, setFormVersionName] = useState('');
  const [formSetAsActive, setFormSetAsActive] = useState(true);
  const [formContent, setFormContent] = useState('');
  const [formOutputFormat, setFormOutputFormat] = useState('');
  const [formOutputSchema, setFormOutputSchema] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载数据
  const loadData = () => {
    setTemplates(promptTemplateService.getAllTemplates());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('prompt-templates-updated', handleUpdate);
    return () => window.removeEventListener('prompt-templates-updated', handleUpdate);
  }, []);

  // 刷新操作
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
    setTimeout(() => {
      setIsRefreshing(false);
      onNotify?.('提示词模板已刷新');
    }, 400);
  };

  // 过滤后的列表
  const filteredTemplates = useMemo(() => {
    return templates.filter((item) => {
      if (typeFilter !== 'all' && item.typeId !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const m1 = item.typeName.toLowerCase().includes(q);
        const m2 = item.versionName.toLowerCase().includes(q);
        const m3 = item.content.toLowerCase().includes(q);
        const m4 = item.subCategory.toLowerCase().includes(q);
        const m5 = item.outputFormat.toLowerCase().includes(q);
        if (!m1 && !m2 && !m3 && !m4 && !m5) return false;
      }

      return true;
    });
  }, [templates, typeFilter, statusFilter, searchQuery]);

  // 分页计算
  const totalItems = filteredTemplates.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTemplates = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredTemplates.slice(start, start + pageSize);
  }, [filteredTemplates, validCurrentPage, pageSize]);

  // 打开新建弹窗
  const handleOpenCreateModal = (defaultType?: string) => {
    const typeDef = PROMPT_CAPABILITY_TYPES.find((t) => t.id === defaultType) || PROMPT_CAPABILITY_TYPES[0];
    setEditingTemplateId(null);
    setFormTypeId(typeDef.id);
    setFormVersionName(`默认${typeDef.name} · 自定义版本`);
    setFormSetAsActive(true);
    setFormContent(typeDef.defaultPrompt);
    setFormOutputFormat(typeDef.defaultOutputFormat);
    setFormOutputSchema(typeDef.defaultSchema);
    setIsEditorOpen(true);
  };

  // 基于现有版本新建
  const handleCloneFromExisting = (item: PromptTemplateItem) => {
    setEditingTemplateId(null);
    setFormTypeId(item.typeId);
    setFormVersionName(`${item.versionName} (新修订版)`);
    setFormSetAsActive(true);
    setFormContent(item.content);
    setFormOutputFormat(item.outputFormat);
    setFormOutputSchema(item.outputSchema || '');
    setIsEditorOpen(true);
  };

  // 切换类型时自动带入 Schema 与默认提示
  const handleTypeChange = (newTypeId: string) => {
    setFormTypeId(newTypeId);
    const typeDef = PROMPT_CAPABILITY_TYPES.find((t) => t.id === newTypeId);
    if (typeDef) {
      if (!formVersionName || formVersionName.startsWith('默认')) {
        setFormVersionName(`默认${typeDef.name} · 新版本`);
      }
      setFormOutputFormat(typeDef.defaultOutputFormat);
      setFormOutputSchema(typeDef.defaultSchema);
      if (!formContent || formContent.length < 50) {
        setFormContent(typeDef.defaultPrompt);
      }
    }
  };

  // 插入动态占位变量
  const handleInsertVariable = (varCode: string) => {
    if (!textareaRef.current) {
      setFormContent((prev) => `${prev} {{${varCode}}}`);
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textToInsert = `{{${varCode}}}`;
    const nextContent = formContent.substring(0, start) + textToInsert + formContent.substring(end);
    setFormContent(nextContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  // 保存版本
  const handleSaveVersion = () => {
    if (!formContent.trim()) {
      alert('模板内容不能为空');
      return;
    }

    promptTemplateService.saveTemplate({
      typeId: formTypeId,
      versionName: formVersionName.trim() || '未命名版本',
      content: formContent.trim(),
      outputFormat: formOutputFormat,
      outputSchema: formOutputSchema,
      setAsActive: formSetAsActive,
    });

    loadData();
    setIsEditorOpen(false);
    onNotify?.(`已成功保存提示词版本「${formVersionName}」`);
  };

  // 应用版本
  const handleActivateVersion = (id: string, name: string) => {
    promptTemplateService.activateVersion(id);
    loadData();
    onNotify?.(`已将「${name}」设为当前生效角色模板`);
  };

  // 删除版本
  const handleDeleteVersion = (id: string, name: string) => {
    if (window.confirm(`确定要删除版本「${name}」吗？`)) {
      promptTemplateService.deleteTemplate(id);
      loadData();
      onNotify?.(`已删除提示词版本「${name}」`);
    }
  };

  // 切换折叠行
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#FAFAFC] dark:bg-[#07090E] overflow-hidden text-slate-800 dark:text-slate-100">
      {/* 顶部标题栏 (完全复刻图 1 头部) */}
      <div className="w-full px-8 py-5 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
            <span>平台资源</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">提示词模板</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            提示词模板
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            平台提示策略与版本管理 · 赋予各核心能力专精 Agent 角色与指令规范
          </p>
        </div>

        {/* 右侧主操作按钮 */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white text-sm font-bold shadow-md shadow-[#5051F9]/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>新建版本</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-all shadow-sm"
            title="刷新数据"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 主滚动区域 */}
      <div className="flex-1 overflow-y-auto w-full px-8 py-6 space-y-5 custom-scrollbar">
        {/* 顶部搜索与双下拉筛选 (完全复刻图 1) */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* 搜索框 */}
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="搜索模板或内容"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#5051F9]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* 模板类型下拉 (覆盖图 4 的所有功能) */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">全部类型</option>
                {PROMPT_CAPABILITY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.groupName})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* 全部状态下拉 */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">全部状态</option>
                <option value="active">应用中</option>
                <option value="history">历史版本</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            共 <strong className="text-slate-800 dark:text-white font-bold">{totalItems}</strong> 项模板策略
          </div>
        </div>

        {/* 提示词模板数据表格 (完全复刻图 1 真实排版) */}
        <div className="w-full rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-[#FBFBFC] dark:bg-[#12161F] text-slate-500 font-bold border-b border-slate-200/80 dark:border-white/10 text-xs">
                <tr>
                  <th className="py-3.5 px-6 w-[24%]">模板类型</th>
                  <th className="py-3.5 px-4 w-[24%]">版本</th>
                  <th className="py-3.5 px-4 w-[16%]">输出</th>
                  <th className="py-3.5 px-4 w-[10%]">状态</th>
                  <th className="py-3.5 px-4 w-[12%]">更新时间</th>
                  <th className="py-3.5 px-6 w-[14%] text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                {paginatedTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                      没有符合条件的提示词模板版本
                    </td>
                  </tr>
                ) : (
                  paginatedTemplates.map((item) => {
                    const isExpanded = !!expandedRows[item.id];
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                          {/* 1. 模板类型 */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleRow(item.id)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {item.typeName}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {item.subCategory}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. 版本 */}
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.versionName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {item.versionTag} · {item.charCount} 字符
                              </div>
                            </div>
                          </td>

                          {/* 3. 输出 */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                              <FileCode className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate max-w-[130px]" title={item.outputFormat}>
                                {item.outputFormat}
                              </span>
                            </div>
                          </td>

                          {/* 4. 状态 */}
                          <td className="py-4 px-4">
                            {item.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>应用中</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>历史版本</span>
                              </span>
                            )}
                          </td>

                          {/* 5. 更新时间 */}
                          <td className="py-4 px-4 font-mono text-xs text-slate-400">
                            {item.updatedAt}
                          </td>

                          {/* 6. 操作 (基于此版本新建、应用版本、删除) */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2 text-xs font-bold">
                              <button
                                onClick={() => handleCloneFromExisting(item)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors"
                              >
                                基于此版本新建
                              </button>

                              {item.status !== 'active' && (
                                <button
                                  onClick={() => handleActivateVersion(item.id, item.versionName)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                                >
                                  应用版本
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteVersion(item.id, item.versionName)}
                                className="px-2 py-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                title="删除此版本"
                              >
                                删除版本
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* 折叠展开的提示词与 Schema 详情 */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50 dark:bg-white/[0.01]">
                            <td colSpan={6} className="px-8 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-8 p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117]">
                                  <div className="text-xs font-bold text-slate-400 mb-2">
                                    Agent 角色指令内容 (Prompt Definition):
                                  </div>
                                  <pre className="text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                                    {item.content}
                                  </pre>
                                </div>

                                <div className="md:col-span-4 p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto custom-scrollbar max-h-48">
                                  <div className="text-[11px] font-bold text-slate-400 mb-2">
                                    输出规范 ({item.outputFormat}):
                                  </div>
                                  <pre className="text-[11px] text-emerald-400 whitespace-pre-wrap">
                                    {item.outputSchema || '{}'}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 底部标准分页条 (完全复刻图 1 底部) */}
          <div className="px-6 py-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-3">
              <span>
                {totalItems === 0
                  ? '0 / 共 0 条'
                  : `${(validCurrentPage - 1) * pageSize + 1}-${Math.min(
                      validCurrentPage * pageSize,
                      totalItems
                    )} / 共 ${totalItems} 条`}
              </span>

              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="appearance-none pl-2.5 pr-6 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 focus:outline-none"
                >
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 页码 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = idx + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg font-bold text-xs transition-colors ${
                      validCurrentPage === p
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新建/编辑提示词版本抽屉 (完全复刻图 3 结构) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0D1117] w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* 抽屉顶部头部 (复刻图 3 头部) */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {editingTemplateId ? '编辑提示词版本' : '新建提示词版本'}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-bold text-slate-700 dark:text-slate-300 transition-all"
                >
                  关闭
                </button>
                <button
                  onClick={handleSaveVersion}
                  className="px-5 py-2 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white text-sm font-bold shadow-md shadow-[#5051F9]/20 transition-all cursor-pointer"
                >
                  保存版本
                </button>
              </div>
            </div>

            {/* 顶部三项元配置 (复刻图 3 第一行) */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.01] grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">
                  模板类型
                </label>
                <div className="relative">
                  <select
                    value={formTypeId}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full appearance-none pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#5051F9]"
                  >
                    {PROMPT_CAPABILITY_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.groupName})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">
                  版本名称
                </label>
                <input
                  type="text"
                  value={formVersionName}
                  onChange={(e) => setFormVersionName(e.target.value)}
                  placeholder="如: 默认生成电商主图模板"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#5051F9]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">
                  保存后状态
                </label>
                <div className="relative">
                  <select
                    value={formSetAsActive ? 'active' : 'history'}
                    onChange={(e) => setFormSetAsActive(e.target.value === 'active')}
                    className="w-full appearance-none pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#5051F9]"
                  >
                    <option value="active">立即设为应用版本</option>
                    <option value="history">保存为历史版本</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 编辑主体: 左右分栏 (完全复刻图 3 左右结构) */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-white/5">
              {/* 左侧：模板内容与快捷变量注入 */}
              <div className="md:col-span-8 p-6 flex flex-col h-full overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    模板内容
                  </span>

                  {/* 快捷插入变量按钮组 (复刻图 3 顶部的变量插入项) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('project_name')}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {'{'} 插入项目名称
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('chapter_name')}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {'{'} 插入章节名称
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('product_features')}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {'{'} 插入产品卖点
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('style_preset')}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {'{'} 插入风格预设
                    </button>
                  </div>
                </div>

                {/* 文本输入框 (带行号辅助) */}
                <div className="flex-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090E] p-4 flex gap-3 overflow-hidden focus-within:border-[#5051F9]">
                  <textarea
                    ref={textareaRef}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="在此输入为该功能定义的 Agent 角色身份、执行策略、工作流约束与输出格式..."
                    className="flex-1 h-full bg-transparent resize-none border-none outline-none font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed custom-scrollbar"
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <span>字符数: <strong className="text-slate-700 dark:text-slate-200">{formContent.length}</strong></span>
                  <span>支持使用 {'{{variable}}'} 动态占位符在执行时注入真实电商项目上下文</span>
                </div>
              </div>

              {/* 右侧：输出规则 / 最终结构 (复刻图 3 右栏) */}
              <div className="md:col-span-4 p-6 bg-slate-50/50 dark:bg-[#0A0D14] flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    输出规则
                  </span>
                  <span className="text-xs text-slate-400">/ 最终结构</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 mb-3 shrink-0">
                  服务端固定 JSON Schema <code className="font-mono font-bold">{formOutputFormat}</code> (不可由非受控客户端定制覆盖) :
                </div>

                {/* Schema 代码框 */}
                <div className="flex-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-900 text-slate-200 p-4 font-mono text-[11px] leading-relaxed overflow-y-auto custom-scrollbar">
                  <pre className="text-emerald-400 whitespace-pre-wrap">
                    {formOutputSchema || '{\n  "type": "string",\n  "description": "自由格式纯文本输出"\n}'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
