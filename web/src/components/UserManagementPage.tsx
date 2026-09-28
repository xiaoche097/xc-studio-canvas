import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Sliders,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit2,
  Power,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Coins,
  Mail,
  Calendar,
  X,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Lock,
  Key,
  Copy
} from 'lucide-react';
import { userService, UserAccount } from '../services/userService';
import { telemetryService } from '../services/telemetryService';

interface UserManagementPageProps {
  onNotify?: (message: string) => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ onNotify }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user' | 'vip'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  // Selected row IDs for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [detailUser, setDetailUser] = useState<UserAccount | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Column visibility settings
  const [visibleColumns, setVisibleColumns] = useState({
    user: true,
    email: true,
    credits: true,
    role: true,
    status: true,
    createdAt: true,
    actions: true,
  });

  // New user form state (按照规范支持 用户名、显示名称、邮箱、初始密码、角色、账号状态、初始积分、备注)
  const [newUserForm, setNewUserForm] = useState({
    handle: '', // 用户名 (3-32位字母/数字/下划线/连字符)
    name: '', // 显示名称
    email: '', // 邮箱
    password: '', // 初始密码 (至少8位)
    role: 'user' as 'admin' | 'user' | 'vip', // 角色
    status: 'active' as 'active' | 'disabled', // 账号状态
    credits: 100, // 分配初始积分
    notes: '', // 备注说明
  });
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Edit user form state
  const [editForm, setEditForm] = useState({
    name: '',
    handle: '',
    email: '',
    password: '',
    credits: 100,
    role: 'user' as 'admin' | 'user' | 'vip',
    status: 'active' as 'active' | 'disabled',
    notes: '',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showDetailPassword, setShowDetailPassword] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);

  // 生成 10 位强密码（包含大小写字母、数字和符号）
  const generateRandomPassword = () => {
    const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const specials = '!@#$%&*';
    let res = '';
    for (let i = 0; i < 5; i++) res += letters[Math.floor(Math.random() * letters.length)];
    for (let i = 0; i < 3; i++) res += numbers[Math.floor(Math.random() * numbers.length)];
    for (let i = 0; i < 2; i++) res += specials[Math.floor(Math.random() * specials.length)];
    return res.split('').sort(() => 0.5 - Math.random()).join('');
  };

  // Load users
  const loadUsers = () => {
    setUsers(userService.getUsers());
  };

  useEffect(() => {
    loadUsers();
    const handleUpdate = () => loadUsers();
    window.addEventListener('users-updated', handleUpdate);
    return () => window.removeEventListener('users-updated', handleUpdate);
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = u.name.toLowerCase().includes(q);
        const matchHandle = u.handle.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        if (!matchName && !matchHandle && !matchEmail) return false;
      }
      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // 表格分页状态 (5 / 10 / 20 条)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  const totalUserCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUserCount / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, validCurrentPage, pageSize]);

  // Toggle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredUsers.map((u) => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Toggle individual row
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Add User submit
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = newUserForm.handle.trim().replace(/^@/, '');
    const cleanName = newUserForm.name.trim();

    if (!cleanHandle && !cleanName) {
      onNotify?.('请输入用户名或显示名称');
      return;
    }

    if (cleanHandle && !/^[a-zA-Z0-9_-]{3,32}$/.test(cleanHandle)) {
      onNotify?.('用户名格式不符合规范：需为 3-32 位字母、数字、下划线或连字符');
      return;
    }

    if (newUserForm.password && newUserForm.password.length < 8) {
      onNotify?.('初始密码长度至少需要 8 位字符');
      return;
    }

    const effectiveHandle = cleanHandle ? `@${cleanHandle}` : `@user_${Math.floor(1000 + Math.random() * 9000)}`;
    const effectiveName = cleanName || cleanHandle || '平台用户';
    const effectivePassword = newUserForm.password.trim() || generateRandomPassword();

    const created = userService.addUser({
      name: effectiveName,
      handle: effectiveHandle,
      email: newUserForm.email.trim(),
      password: effectivePassword,
      credits: Number(newUserForm.credits) || 100,
      role: newUserForm.role,
      status: newUserForm.status,
      notes: newUserForm.notes.trim(),
    });

    loadUsers();
    setShowAddModal(false);
    setNewUserForm({
      handle: '',
      name: '',
      email: '',
      password: '',
      credits: 100,
      role: 'user',
      status: 'active',
      notes: '',
    });
    setShowNewPassword(false);
    onNotify?.(`用户「${created.name}」已成功创建！初始密码：${effectivePassword}`);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      handle: user.handle,
      email: user.email === '未填写' ? '' : user.email,
      password: '',
      credits: user.credits,
      role: user.role,
      status: user.status || 'active',
      notes: user.notes || '',
    });
    setShowEditPassword(false);
  };

  // Submit Edit User
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.name.trim()) {
      onNotify?.('显示名称不能为空');
      return;
    }
    if (editForm.password && editForm.password.length < 8) {
      onNotify?.('修改密码至少需要 8 位字符');
      return;
    }

    const cleanHandle = editForm.handle.trim().replace(/^@/, '');
    const updates: Partial<UserAccount> = {
      name: editForm.name.trim() || editingUser.name,
      handle: cleanHandle ? `@${cleanHandle}` : editingUser.handle,
      email: editForm.email.trim() || '未填写',
      credits: Number(editForm.credits) || 0,
      role: editForm.role,
      status: editForm.status,
      notes: editForm.notes,
    };
    if (editForm.password.trim()) {
      updates.password = editForm.password.trim();
    }

    userService.updateUser(editingUser.id, updates);
    loadUsers();
    setEditingUser(null);
    onNotify?.(`用户「${editForm.name}」信息已成功更新！`);
  };

  // Toggle status
  const handleToggleStatus = (user: UserAccount) => {
    const updated = userService.toggleUserStatus(user.id);
    loadUsers();
    if (updated) {
      const msg = updated.status === 'active' ? `已启用用户「${user.name}」` : `已停用用户「${user.name}」`;
      onNotify?.(msg);
    }
  };

  // Delete User
  const handleDeleteUser = (id: string, name: string) => {
    if (window.confirm(`确定要彻底删除用户「${name}」吗？此操作不可逆。`)) {
      userService.deleteUser(id);
      loadUsers();
      onNotify?.(`已删除用户「${name}」`);
      if (detailUser?.id === id) setDetailUser(null);
      if (editingUser?.id === id) setEditingUser(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#FAFAFC] dark:bg-[#07090E] overflow-hidden text-slate-800 dark:text-slate-100">
      {/* 顶部标题栏 - 满宽两端对齐，放大字号 */}
      <div className="w-full px-8 py-5 bg-white dark:bg-[#0D1117] border-b border-slate-200/80 dark:border-white/10 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
              <span>平台资源</span>
              <span>/</span>
              <span className="text-slate-900 dark:text-white font-bold">用户管理</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
              用户账号、权限角色与积分管理
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              维护创作者账号身份、可用额度、启用/停用状态及安全审计
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-bold hover:opacity-90 flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>添加用户</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/10 flex items-center gap-2 transition-all shadow-sm"
              >
                <Sliders className="w-4 h-4 text-slate-500" />
                <span>列设置</span>
              </button>

              {/* Column Settings Popover */}
              {showColumnSettings && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12161F] shadow-xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2 text-sm">
                  <div className="font-bold text-slate-500 mb-2 px-1 text-xs uppercase tracking-wider">显示数据列</div>
                  <div className="space-y-2">
                    {[
                      { key: 'user', label: '用户名称' },
                      { key: 'email', label: '电子邮箱' },
                      { key: 'credits', label: '当前积分' },
                      { key: 'role', label: '权限角色' },
                      { key: 'status', label: '使用状态' },
                      { key: 'createdAt', label: '注册时间' },
                    ].map((col) => (
                      <label key={col.key} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(visibleColumns as any)[col.key]}
                          onChange={(e) =>
                            setVisibleColumns((prev) => ({ ...prev, [col.key]: e.target.checked }))
                          }
                          className="rounded text-brand-orange focus:ring-0"
                        />
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 满宽筛选工具栏 */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[280px] max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索用户名、名称或邮箱..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-white/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 角色下拉 */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
            >
              <option value="all">全部角色</option>
              <option value="user">普通用户</option>
              <option value="admin">平台管理员</option>
              <option value="vip">VIP用户</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 状态下拉 */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
            >
              <option value="all">全部状态</option>
              <option value="active">已启用</option>
              <option value="disabled">已停用</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 用户表格 - 满宽自适应排版，放大字号 */}
      <div className="flex-1 overflow-auto w-full px-8 py-6">
        <div className="w-full bg-white dark:bg-[#0D1117] rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="bg-[#FBFBFC] dark:bg-[#12161F] text-slate-500 font-bold border-b border-slate-100 dark:border-white/5 text-sm">
              <tr>
                <th className="w-14 py-4 pl-6 pr-2">
                  <input
                    type="checkbox"
                    checked={filteredUsers.length > 0 && selectedIds.length === filteredUsers.length}
                    onChange={handleSelectAll}
                    className="rounded text-brand-orange focus:ring-0 cursor-pointer h-4 w-4"
                  />
                </th>
                {visibleColumns.user && <th className="py-4 px-4 font-bold text-slate-500">用户</th>}
                {visibleColumns.email && <th className="py-4 px-4 font-bold text-slate-500">邮箱</th>}
                {visibleColumns.credits && <th className="py-4 px-4 font-bold text-slate-500">当前积分</th>}
                {visibleColumns.role && <th className="py-4 px-4 font-bold text-slate-500">角色</th>}
                {visibleColumns.status && <th className="py-4 px-4 font-bold text-slate-500">状态</th>}
                {visibleColumns.createdAt && <th className="py-4 px-4 font-bold text-slate-500">注册时间</th>}
                {visibleColumns.actions && <th className="py-4 px-4 font-bold text-slate-500 text-right pr-8">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-25" />
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-base mb-1">
                      {users.length === 0 ? '暂无用户账号' : '没有找到符合条件的用户账号'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                      {users.length === 0
                        ? '已移除全部占位演示账号。点击右上角「+ 添加用户」创建真实用户。'
                        : '尝试调整搜索关键词或重置角色/状态筛选条件'}
                    </p>
                    {users.length === 0 && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-sm hover:opacity-90 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>添加用户</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const isSelected = selectedIds.includes(user.id);
                  const isUserActive = user.status === 'active';

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors ${
                        isSelected ? 'bg-slate-50/90 dark:bg-white/[0.04]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 pl-6 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(user.id)}
                          className="rounded text-brand-orange focus:ring-0 cursor-pointer h-4 w-4"
                        />
                      </td>

                      {/* 用户 */}
                      {visibleColumns.user && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-sm">
                              {user.name.slice(0, 1)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-base">
                                {user.name}
                              </div>
                              <div className="text-xs font-mono text-slate-400 mt-0.5">
                                {user.handle}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* 邮箱 */}
                      {visibleColumns.email && (
                        <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-mono text-sm">
                          {user.email === '未填写' ? (
                            <span className="text-slate-400">未填写</span>
                          ) : (
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{user.email}</span>
                          )}
                        </td>
                      )}

                      {/* 当前积分 */}
                      {visibleColumns.credits && (
                        <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-white text-base">
                          {user.credits}
                        </td>
                      )}

                      {/* 角色 */}
                      {visibleColumns.role && (
                        <td className="py-4 px-4">
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              管理员
                            </span>
                          ) : user.role === 'vip' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                              <Sparkles className="w-3 h-3 text-purple-500" />
                              VIP用户
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              普通用户
                            </span>
                          )}
                        </td>
                      )}

                      {/* 状态 */}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          {isUserActive ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              已启用
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              已停用
                            </span>
                          )}
                        </td>
                      )}

                      {/* 注册时间 */}
                      {visibleColumns.createdAt && (
                        <td className="py-4 px-4 text-slate-500 font-mono text-sm">
                          {user.createdAt}
                        </td>
                      )}

                      {/* 操作 */}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4 text-right pr-8">
                          <div className="inline-flex items-center gap-2 justify-end">
                            {/* 详情 */}
                            <button
                              type="button"
                              onClick={() => setDetailUser(user)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-bold transition-all shadow-sm"
                            >
                              详情
                            </button>

                            {/* 编辑用户 */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>编辑用户</span>
                            </button>

                            {/* 停用账户 / 启用账户 */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(user)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                                isUserActive
                                  ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20'
                                  : 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{isUserActive ? '停用账户' : '启用账户'}</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* 表格底部分页栏 */}
          <div className="px-8 py-4 bg-[#FBFBFC] dark:bg-[#12161F] border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-slate-500">
            <div>
              {selectedIds.length > 0 ? (
                <span className="text-slate-900 dark:text-white font-bold">
                  已选择 {selectedIds.length} 项
                </span>
              ) : (
                <span className="text-slate-400">
                  {totalUserCount > 0 ? `显示第 ${(validCurrentPage - 1) * pageSize + 1} 至 ${Math.min(validCurrentPage * pageSize, totalUserCount)} 位用户` : '无用户'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span>
                {totalUserCount > 0
                  ? `${(validCurrentPage - 1) * pageSize + 1}-${Math.min(validCurrentPage * pageSize, totalUserCount)} / 共 ${totalUserCount} 条`
                  : '0 / 共 0 条'}
              </span>

              {/* 每页条数 */}
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-700 dark:text-slate-200 font-semibold cursor-pointer focus:outline-none"
                >
                  <option value={5}>5 条/页</option>
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 翻页按钮 */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="上一页"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= validCurrentPage - 1 && pageNum <= validCurrentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-bold font-mono transition-all ${
                          validCurrentPage === pageNum
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (
                    (pageNum === 2 && validCurrentPage > 3) ||
                    (pageNum === totalPages - 1 && validCurrentPage < totalPages - 2)
                  ) {
                    return <span key={pageNum} className="px-1 text-slate-400 font-mono">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="下一页"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: 添加用户 */}
      {showAddModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12161F] p-7 shadow-2xl space-y-5 text-sm max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-orange" />
                添加用户
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* 用户名 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                  用户名
                </label>
                <input
                  type="text"
                  value={newUserForm.handle}
                  onChange={(e) => setNewUserForm({ ...newUserForm, handle: e.target.value })}
                  placeholder="3-32 位字母、数字、下划线或连字符"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-orange"
                />
              </div>

              {/* 显示名称 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                  显示名称
                </label>
                <input
                  type="text"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="用户在产品内显示的名称"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-orange"
                />
              </div>

              {/* 邮箱 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                  邮箱
                </label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange"
                />
              </div>

              {/* 初始密码 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    初始密码
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generateRandomPassword();
                      setNewUserForm({ ...newUserForm, password: pwd });
                      setShowNewPassword(true);
                    }}
                    className="text-xs font-semibold text-brand-orange hover:opacity-80 flex items-center gap-1 transition-opacity"
                  >
                    <Sparkles className="w-3 h-3" />
                    随机生成
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    placeholder="至少 8 位"
                    className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-orange"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
                    title={showNewPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 角色与账号状态 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    角色
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange"
                  >
                    <option value="user">普通用户</option>
                    <option value="vip">VIP用户</option>
                    <option value="admin">平台管理员</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    账号状态
                  </label>
                  <select
                    value={newUserForm.status}
                    onChange={(e) => setNewUserForm({ ...newUserForm, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange"
                  >
                    <option value="active">已启用</option>
                    <option value="disabled">已停用</option>
                  </select>
                </div>
              </div>

              {/* 分配初始积分与备注说明 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    分配初始积分
                  </label>
                  <input
                    type="number"
                    value={newUserForm.credits}
                    onChange={(e) => setNewUserForm({ ...newUserForm, credits: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-orange"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    备注说明
                  </label>
                  <input
                    type="text"
                    value={newUserForm.notes}
                    onChange={(e) => setNewUserForm({ ...newUserForm, notes: e.target.value })}
                    placeholder="分组说明或项目权限备注"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-opacity"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 编辑用户 */}
      {editingUser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12161F] p-7 shadow-2xl space-y-5 text-sm max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                编辑用户「{editingUser.name}」
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* 用户名 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                  用户名
                </label>
                <input
                  type="text"
                  required
                  value={editForm.handle}
                  onChange={(e) => setEditForm({ ...editForm, handle: e.target.value })}
                  placeholder="3-32 位字母、数字、下划线或连字符"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-orange"
                />
              </div>

              {/* 显示名称 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                  显示名称
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="用户在产品内显示的名称"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-orange"
                />
              </div>

              {/* 邮箱 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                  邮箱
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange"
                />
              </div>

              {/* 重设密码 */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                  修改密码 <span className="text-xs font-normal text-slate-400">（留空则保持原密码不变）</span>
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="至少 8 位新密码"
                    className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-orange"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
                    title={showEditPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 角色与状态 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    角色
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="user">普通用户</option>
                    <option value="vip">VIP用户</option>
                    <option value="admin">平台管理员</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    账号状态
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="active">已启用</option>
                    <option value="disabled">已停用</option>
                  </select>
                </div>
              </div>

              {/* 积分与备注 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    调整积分余额
                  </label>
                  <input
                    type="number"
                    value={editForm.credits}
                    onChange={(e) => setEditForm({ ...editForm, credits: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-orange"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-sm">
                    备注说明
                  </label>
                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="分组说明或项目权限备注"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteUser(editingUser.id, editingUser.name)}
                  className="text-red-500 hover:text-red-600 text-sm font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  删除该用户
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-opacity"
                  >
                    保存更新
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: 用户详情抽屉 / 弹窗 */}
      {detailUser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12161F] p-8 shadow-2xl space-y-6 text-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-black text-slate-700 dark:text-white text-base">
                  {detailUser.name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {detailUser.name}
                    <span className="text-sm font-mono font-normal text-slate-400">
                      {detailUser.handle}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">账号唯一 ID: {detailUser.id}</div>
                </div>
              </div>
              <button
                onClick={() => setDetailUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-500" /> 当前可用积分余额
                </div>
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                  {detailUser.credits}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-500" /> 权限角色身份
                </div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {detailUser.roleLabel}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-500" /> 账号运行状态
                </div>
                <div className="text-sm font-bold">
                  {detailUser.status === 'active' ? (
                    <span className="text-emerald-500">已启用 (正常访问)</span>
                  ) : (
                    <span className="text-rose-500">已停用 (暂停访问)</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-indigo-500" /> 关联邮箱
                </div>
                <div className="text-sm font-mono text-slate-800 dark:text-slate-200 truncate">
                  {detailUser.email}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-500" /> 账号开通时间
                </div>
                <div className="text-sm font-mono text-slate-800 dark:text-slate-200 truncate">
                  {detailUser.createdAt}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Key className="w-4 h-4 text-amber-500" /> 登录初始密码</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDetailPassword(!showDetailPassword)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={showDetailPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showDetailPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (detailUser.password) {
                          navigator.clipboard.writeText(detailUser.password);
                          setCopiedPwd(true);
                          setTimeout(() => setCopiedPwd(false), 2000);
                          onNotify?.('初始密码已复制到剪贴板');
                        } else {
                          onNotify?.('该账号尚未配置专属密码');
                        }
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="复制密码"
                    >
                      {copiedPwd ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="text-sm font-mono text-slate-800 dark:text-slate-200">
                  {detailUser.password
                    ? (showDetailPassword ? detailUser.password : '••••••••')
                    : '已加密或未配置'}
                </div>
              </div>
            </div>

            {/* 备注 */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-1 text-sm">备注与说明</div>
              <div className="text-slate-500 dark:text-slate-400 text-sm">
                {detailUser.notes || '暂无专属备注信息'}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDetailUser(null);
                  handleOpenEdit(detailUser);
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                编辑此账号
              </button>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
