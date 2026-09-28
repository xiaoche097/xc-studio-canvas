export interface RequestLogItem {
  id: string;
  timestamp: number; // Unix timestamp ms
  userId: string;
  userName: string;
  userHandle: string;
  modelId: string;
  modelName: string;
  channelId: string;
  channelName: string;
  capability: 'text' | 'image' | 'video' | 'agent' | 'audio';
  status: 'success' | 'error' | 'timeout';
  httpStatus: number;
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensCached: number;
  costCredits: number;
  errorMessage?: string;
  errorCategory?: 'auth_error' | 'rate_limit' | 'upstream_timeout' | 'content_violation' | 'format_error' | 'server_error';
  requestPayload?: any;
  responsePreview?: string;
}

export interface ModelPerformanceStat {
  modelId: string;
  modelName: string;
  capability: 'text' | 'image' | 'video' | 'agent' | 'audio';
  tasksTotal: number;
  requestsTotal: number;
  userCount: number;
  taskSuccessRate: number; // 0-100
  requestSuccessRate: number; // 0-100
  p50Ms: number;
  p95Ms: number;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensCached: number;
  errorCount: number;
  errorRatePerSec: number;
  incomeCredits: number;
  costCredits: number;
  profitCredits: number;
  profitRate: number;
}

export interface DailyTrendPoint {
  dateStr: string; // e.g. "09-20"
  fullDate: string; // e.g. "2026-09-20"
  requests: number;
  tasks: number;
  successRequests: number;
  errorRequests: number;
  avgLatencyMs: number;
  activeUsers: number;
}

const STORAGE_KEY = 'platform_request_telemetry_logs_v1';

// 初始不设置任何虚假请求数据，完全杜绝占位数据，所有指标均基于真实请求生成
const SEED_LOGS: RequestLogItem[] = [];

class TelemetryService {
  private logs: RequestLogItem[] = [];

  constructor() {
    this.init();
  }

  // 严格过滤任何测试占位假数据
  private isPlaceholderLog(log: RequestLogItem): boolean {
    if (!log) return true;
    if (log.id && (log.id.startsWith('req_err_00') || log.id.startsWith('req_succ_00') || log.id === 'log_1')) return true;
    if (log.userName === '小车001' || log.userHandle === '@xiaoche' || log.userId === 'u_101') return true;
    if (log.modelId === 'gpt-image-2.5' && log.channelId === 'CHANNEL_000001') return true;
    return false;
  }

  private init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.logs = Array.isArray(parsed)
          ? parsed.filter((l: RequestLogItem) => !this.isPlaceholderLog(l))
          : [];
      } else {
        this.logs = [];
      }
      this.persist();
    } catch {
      this.logs = [];
    }

    if (typeof window !== 'undefined') {
      this.syncWithBackend();
    }
  }

  // 从真实 Go 后端拉取落盘的真实请求记录
  public async syncWithBackend() {
    try {
      const res = await fetch('/api/telemetry/logs');
      if (res.ok) {
        const remoteLogs: RequestLogItem[] = await res.json();
        if (Array.isArray(remoteLogs)) {
          const map = new Map<string, RequestLogItem>();
          for (const l of this.logs) {
            if (!this.isPlaceholderLog(l)) map.set(l.id, l);
          }
          for (const rl of remoteLogs) {
            if (!this.isPlaceholderLog(rl)) {
              map.set(rl.id, {
                ...rl,
                timestamp: rl.timestamp || Date.now(),
                capability: rl.capability || 'text',
                status: rl.status || (rl.httpStatus >= 400 ? 'error' : 'success'),
              });
            }
          }
          this.logs = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
          this.persist();
        }
      }
    } catch {
      // 后端未联通时平滑使用本地存储
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
      window.dispatchEvent(new CustomEvent('telemetry-updated'));
    } catch (e) {
      console.error('Failed to persist telemetry logs:', e);
    }
  }

  public getAllLogs(): RequestLogItem[] {
    return [...this.logs].sort((a, b) => b.timestamp - a.timestamp);
  }

  public recordRequest(item: Omit<RequestLogItem, 'id' | 'timestamp'> & { timestamp?: number }): RequestLogItem {
    const newRecord: RequestLogItem = {
      ...item,
      id: `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: item.timestamp || Date.now(),
    };
    this.logs.unshift(newRecord);
    // 保留最近 1000 条真实记录
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }
    this.persist();

    // 异步向 Go 真实后端提交落盘保存
    try {
      fetch('/api/telemetry/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      }).catch(() => {});
    } catch {}

    return newRecord;
  }

  public clearLogs() {
    this.logs = [];
    this.persist();

    // 异步清除 Go 后端记录
    try {
      fetch('/api/telemetry/logs', { method: 'DELETE' }).catch(() => {});
    } catch {}
  }

  public resetToSeed() {
    this.logs = [];
    this.persist();
  }

  // 计算多维汇总指标 (真实计算，无数据时真实显示 0)
  public getOverviewMetrics(filteredLogs: RequestLogItem[]) {
    const totalRequests = filteredLogs.length;
    const errorLogs = filteredLogs.filter((l) => l.status === 'error' || l.status === 'timeout');
    const successLogs = filteredLogs.filter((l) => l.status === 'success');
    const successRate = totalRequests > 0 ? (successLogs.length / totalRequests) * 100 : 100;

    const uniqueUsers = new Set(filteredLogs.map((l) => l.userId).filter(Boolean));

    const now = Date.now();
    const oneDayAgo = now - 24 * 3600 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;

    const dauUsers = new Set(filteredLogs.filter((l) => l.timestamp >= oneDayAgo).map((l) => l.userId).filter(Boolean));
    const wauUsers = new Set(filteredLogs.filter((l) => l.timestamp >= sevenDaysAgo).map((l) => l.userId).filter(Boolean));
    const mauUsers = new Set(filteredLogs.filter((l) => l.timestamp >= thirtyDaysAgo).map((l) => l.userId).filter(Boolean));

    // 计算延迟分位数
    const latencies = [...filteredLogs.map((l) => l.latencyMs)].filter(n => typeof n === 'number' && n > 0).sort((a, b) => a - b);
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

    // 总 tokens
    const totalPromptTokens = filteredLogs.reduce((acc, cur) => acc + (cur.tokensPrompt || 0), 0);
    const totalCompletionTokens = filteredLogs.reduce((acc, cur) => acc + (cur.tokensCompletion || 0), 0);
    const totalCachedTokens = filteredLogs.reduce((acc, cur) => acc + (cur.tokensCached || 0), 0);

    return {
      totalRequests,
      totalTasks: totalRequests,
      successCount: successLogs.length,
      errorCount: errorLogs.length,
      successRate: totalRequests > 0 ? Math.round(successRate * 10) / 10 : 100,
      activeUserCount: uniqueUsers.size,
      dauCount: dauUsers.size,
      wauCount: wauUsers.size,
      mauCount: mauUsers.size,
      p50Ms: Math.round(p50),
      p95Ms: Math.round(p95),
      totalPromptTokens,
      totalCompletionTokens,
      totalCachedTokens,
    };
  }


  // 按模型聚合
  public getModelStats(logs: RequestLogItem[]): ModelPerformanceStat[] {
    const map = new Map<string, RequestLogItem[]>();
    logs.forEach((item) => {
      const list = map.get(item.modelId) || [];
      list.push(item);
      map.set(item.modelId, list);
    });

    const stats: ModelPerformanceStat[] = [];
    map.forEach((modelLogs, modelId) => {
      const sample = modelLogs[0];
      const total = modelLogs.length;
      const successList = modelLogs.filter((l) => l.status === 'success');
      const errorList = modelLogs.filter((l) => l.status === 'error' || l.status === 'timeout');

      const latencies = modelLogs.map((l) => l.latencyMs).sort((a, b) => a - b);
      const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
      const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

      const users = new Set(modelLogs.map((l) => l.userId)).size;

      stats.push({
        modelId,
        modelName: sample?.modelName || modelId,
        capability: sample?.capability || 'text',
        tasksTotal: total,
        requestsTotal: total,
        userCount: users || 1,
        taskSuccessRate: total > 0 ? Math.round((successList.length / total) * 1000) / 10 : 100,
        requestSuccessRate: total > 0 ? Math.round((successList.length / total) * 1000) / 10 : 100,
        p50Ms: Math.round(p50),
        p95Ms: Math.round(p95),
        tokensPrompt: modelLogs.reduce((acc, l) => acc + (l.tokensPrompt || 0), 0),
        tokensCompletion: modelLogs.reduce((acc, l) => acc + (l.tokensCompletion || 0), 0),
        tokensCached: modelLogs.reduce((acc, l) => acc + (l.tokensCached || 0), 0),
        errorCount: errorList.length,
        errorRatePerSec: 0,
        incomeCredits: 0,
        costCredits: 0,
        profitCredits: 0,
        profitRate: 0,
      });
    });

    return stats.sort((a, b) => b.tasksTotal - a.tasksTotal);
  }

  // 日期趋势聚合 (按 30 天生成连续时间线)
  public getDailyTrend(logs: RequestLogItem[], daysCount: number = 30): DailyTrendPoint[] {
    const result: DailyTrendPoint[] = [];
    const now = new Date('2026-09-28T23:59:59');

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${month}-${day}`;
      const fullDate = `${d.getFullYear()}-${month}-${day}`;

      // 匹配该日的日志
      const dayLogs = logs.filter((log) => {
        const itemDate = new Date(log.timestamp);
        return (
          itemDate.getFullYear() === d.getFullYear() &&
          itemDate.getMonth() === d.getMonth() &&
          itemDate.getDate() === d.getDate()
        );
      });

      const requests = dayLogs.length;
      const successRequests = dayLogs.filter((l) => l.status === 'success').length;
      const errorRequests = dayLogs.filter((l) => l.status === 'error' || l.status === 'timeout').length;
      const latencies = dayLogs.map((l) => l.latencyMs);
      const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
      const uniqueUsers = new Set(dayLogs.map((l) => l.userId)).size;

      result.push({
        dateStr,
        fullDate,
        requests,
        tasks: requests,
        successRequests,
        errorRequests,
        avgLatencyMs: Math.round(avgLatency),
        activeUsers: uniqueUsers,
      });
    }

    return result;
  }

  // 导出 CSV 真实文件下载
  public exportCsv(filteredLogs: RequestLogItem[]) {
    const headers = [
      '请求ID',
      '时间戳',
      '时间',
      '用户',
      '模型',
      '渠道',
      '能力类型',
      '状态',
      'HTTP状态码',
      '耗时(ms)',
      '输入Token',
      '输出Token',
      '缓存Token',
      '异常描述',
    ];

    const rows = filteredLogs.map((item) => [
      item.id,
      item.timestamp,
      new Date(item.timestamp).toLocaleString(),
      `"${item.userName} (${item.userHandle})"`,
      `"${item.modelName}"`,
      `"${item.channelName}"`,
      item.capability,
      item.status,
      item.httpStatus,
      item.latencyMs,
      item.tokensPrompt || 0,
      item.tokensCompletion || 0,
      item.tokensCached || 0,
      `"${(item.errorMessage || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `平台调用审计日志_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const telemetryService = new TelemetryService();
