export interface UserAccount {
  id: string;
  name: string;
  handle: string;
  email: string;
  password?: string;
  avatar?: string;
  credits: number;
  role: 'admin' | 'user' | 'vip';
  roleLabel: string;
  status: 'active' | 'disabled';
  createdAt: string;
  notes?: string;
}

const STORAGE_KEY = 'platform_user_accounts_v1';

// 默认不预设任何虚假用户，杜绝占位账号，所有用户均由管理员真实创建
const SEED_USERS: UserAccount[] = [];

class UserService {
  private users: UserAccount[] = [];

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      this.syncWithBackend();
    }
  }

  private async syncWithBackend() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const remoteUsers: UserAccount[] = await res.json();
        if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
          const map = new Map<string, UserAccount>();
          for (const u of this.users) map.set(u.id, u);
          for (const ru of remoteUsers) map.set(ru.id, ru);
          this.users = Array.from(map.values()).filter((u) => u.id !== 'u_101' && u.id !== 'u_102');
          this.persist();
        }
      }
    } catch {
      // Go 后端若暂未运行则平滑降级使用 localStorage
    }
  }

  private init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 彻底剔除假数据占位账号（u_101 小车001 与 u_102 小车）
        this.users = Array.isArray(parsed)
          ? parsed.filter((u: UserAccount) => u.id !== 'u_101' && u.id !== 'u_102')
          : [];
      } else {
        this.users = [];
      }
      this.persist();
    } catch {
      this.users = [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.users));
      window.dispatchEvent(new CustomEvent('users-updated'));
    } catch (e) {
      console.error('Failed to persist users:', e);
    }
  }

  public getUsers(): UserAccount[] {
    return this.users.filter((u) => u.id !== 'u_101' && u.id !== 'u_102');
  }

  public getUserById(id: string): UserAccount | undefined {
    return this.users.find((u) => u.id === id);
  }

  public addUser(data: {
    name: string;
    handle: string;
    email?: string;
    password?: string;
    credits?: number;
    role?: 'admin' | 'user' | 'vip';
    status?: 'active' | 'disabled';
    notes?: string;
  }): UserAccount {
    const newUser: UserAccount = {
      id: `u_${Date.now().toString(36)}`,
      name: data.name.trim(),
      handle: data.handle.startsWith('@') ? data.handle.trim() : `@${data.handle.trim()}`,
      email: data.email?.trim() || '未填写',
      password: data.password?.trim() || '',
      credits: data.credits ?? 100,
      role: data.role || 'user',
      roleLabel: data.role === 'admin' ? '管理员' : data.role === 'vip' ? 'VIP用户' : '普通用户',
      status: data.status || 'active',
      createdAt: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      notes: data.notes || '',
    };

    this.users.unshift(newUser);
    this.persist();

    // 同步到登录凭据表，以便账号能正常登录平台
    try {
      const rawJingche = localStorage.getItem('jingche_users');
      const jingcheUsers = rawJingche ? JSON.parse(rawJingche) : [];
      const cleanUsername = newUser.handle.replace(/^@/, '');
      const existingIdx = jingcheUsers.findIndex((ju: any) => ju.username === cleanUsername);
      const authUser = {
        username: cleanUsername,
        displayName: newUser.name,
        email: newUser.email,
        password: newUser.password || '12345678',
        role: newUser.role === 'admin' ? 'admin' : 'user',
        credits: newUser.credits,
        createdAt: newUser.createdAt,
      };
      if (existingIdx >= 0) {
        jingcheUsers[existingIdx] = authUser;
      } else {
        jingcheUsers.unshift(authUser);
      }
      localStorage.setItem('jingche_users', JSON.stringify(jingcheUsers));
    } catch (e) {
      console.warn('Sync jingche_users error:', e);
    }

    // 同步到 Go 后端
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newUser.name,
        handle: newUser.handle,
        email: newUser.email,
        password: newUser.password,
        credits: newUser.credits,
        role: newUser.role,
        status: newUser.status,
        notes: newUser.notes,
      }),
    }).catch(() => {});

    return newUser;
  }

  public updateUser(id: string, updates: Partial<UserAccount>): UserAccount | null {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;

    const current = this.users[idx];
    const role = updates.role !== undefined ? updates.role : current.role;
    const roleLabel =
      role === 'admin' ? '管理员' : role === 'vip' ? 'VIP用户' : '普通用户';

    const updated: UserAccount = {
      ...current,
      ...updates,
      roleLabel,
    };

    this.users[idx] = updated;
    this.persist();

    try {
      const rawJingche = localStorage.getItem('jingche_users');
      if (rawJingche) {
        const jingcheUsers = JSON.parse(rawJingche);
        const cleanUsername = updated.handle.replace(/^@/, '');
        const targetIdx = jingcheUsers.findIndex((ju: any) => ju.username === cleanUsername);
        if (targetIdx >= 0) {
          jingcheUsers[targetIdx] = {
            ...jingcheUsers[targetIdx],
            displayName: updated.name,
            email: updated.email,
            password: updated.password || jingcheUsers[targetIdx].password,
            role: updated.role === 'admin' ? 'admin' : 'user',
            credits: updated.credits,
          };
          localStorage.setItem('jingche_users', JSON.stringify(jingcheUsers));
        }
      }
    } catch {}

    // 同步更新到 Go 后端
    fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});

    return updated;
  }

  public toggleUserStatus(id: string): UserAccount | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    return this.updateUser(id, { status: nextStatus });
  }

  public deleteUser(id: string): boolean {
    const initialLen = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    if (this.users.length !== initialLen) {
      this.persist();
      // 同步删除到 Go 后端
      fetch(`/api/users/${id}`, {
        method: 'DELETE',
      }).catch(() => {});
      return true;
    }
    return false;
  }
}

export const userService = new UserService();
