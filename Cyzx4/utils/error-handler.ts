/**
 * 统一错误处理系统
 * 提供完善的错误分类、日志记录和用户友好提示
 */

export enum ErrorType {
    NETWORK = 'NETWORK',
    API = 'API',
    VALIDATION = 'VALIDATION',
    AGENT = 'AGENT',
    SKILL = 'SKILL',
    STORAGE = 'STORAGE',
    UNKNOWN = 'UNKNOWN'
}

export interface AppError {
    type: ErrorType;
    message: string;
    originalError?: Error;
    context?: Record<string, any>;
    timestamp: number;
    retryable: boolean;
}

class ErrorHandler {
    private errorLog: AppError[] = [];
    private maxLogSize = 100;

    /**
     * 创建应用错误
     */
    createError(
        type: ErrorType,
        message: string,
        originalError?: Error,
        context?: Record<string, any>,
        retryable: boolean = false
    ): AppError {
        const error: AppError = {
            type,
            message,
            originalError,
            context,
            timestamp: Date.now(),
            retryable
        };

        this.log(error);
        return error;
    }

    /**
     * 处理错误并返回用户友好的消息
     */
    handleError(error: unknown, context?: Record<string, any>): AppError {
        if (this.isAppError(error)) {
            return error;
        }

        if (error instanceof Error) {
            const msg = error.message;

            // 网络错误
            if (msg.includes('fetch') || msg.includes('network') || msg.includes('ERR_NETWORK') || msg.includes('Failed to fetch')) {
                return this.createError(
                    ErrorType.NETWORK,
                    '网络连接失败，请检查网络设置后重试',
                    error,
                    context,
                    true
                );
            }

            // 429 限流错误
            if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('RATE_LIMIT')) {
                return this.createError(
                    ErrorType.API,
                    '请求过于频繁，请稍等几秒后重试',
                    error,
                    { ...context, httpStatus: 429 },
                    true
                );
            }

            // 503 服务过载
            if (msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable')) {
                return this.createError(
                    ErrorType.API,
                    'AI 服务暂时繁忙，正在尝试备用方案...',
                    error,
                    { ...context, httpStatus: 503, shouldFallback: true },
                    true
                );
            }

            // 配额耗尽
            if (msg.includes('quota') || msg.includes('QUOTA') || msg.includes('billing') || msg.includes('exceeded')) {
                return this.createError(
                    ErrorType.API,
                    'API 配额已用完，请检查首页当前启用的文本 / Agent 中转账户',
                    error,
                    { ...context, quotaExceeded: true },
                    false
                );
            }

            // 401/403 认证错误
            if (msg.includes('401') || msg.includes('403') || msg.includes('API_KEY') || msg.includes('unauthorized') || msg.includes('forbidden')) {
                return this.createError(
                    ErrorType.API,
                    'API Key 无效、缺失或已过期，请检查首页“文本 / Agent 服务”的中转配置',
                    error,
                    { ...context, authError: true },
                    false
                );
            }

            // 其他 API 错误
            if (msg.includes('API') || msg.includes('400') || msg.includes('500')) {
                return this.createError(
                    ErrorType.API,
                    'AI 服务调用失败，请稍后重试',
                    error,
                    context,
                    true
                );
            }

            // 验证错误
            if (msg.includes('validate') || msg.includes('invalid')) {
                return this.createError(
                    ErrorType.VALIDATION,
                    '输入数据验证失败，请检查输入',
                    error,
                    context,
                    false
                );
            }
        }

        // 未知错误
        return this.createError(
            ErrorType.UNKNOWN,
            error instanceof Error ? error.message : '发生未知错误，请稍后重试',
            error instanceof Error ? error : undefined,
            context,
            true
        );
    }

    /**
     * 带重试的异步操作包装器
     */
    async withRetry<T>(
        operation: () => Promise<T>,
        options: {
            maxRetries?: number;
            delay?: number;
            backoff?: boolean;
            context?: Record<string, any>;
        } = {}
    ): Promise<T> {
        const { maxRetries = 3, delay = 1000, backoff = true, context } = options;
        let lastError: AppError | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = this.handleError(error, {
                    ...context,
                    attempt: attempt + 1,
                    maxRetries
                });

                if (!lastError.retryable || attempt === maxRetries) {
                    throw lastError;
                }

                const waitTime = backoff
                    ? delay * Math.pow(2, attempt) + Math.random() * 500  // 指数退避 + 随机抖动
                    : delay;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError;
    }

    /**
     * 记录错误
     */
    private log(error: AppError): void {
        this.errorLog.push(error);

        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize);
        }

        // 控制台输出（开发环境）
        if (process.env.NODE_ENV === 'development') {
            console.error('[ErrorHandler]', {
                type: error.type,
                message: error.message,
                context: error.context,
                originalError: error.originalError
            });
        }
    }

    /**
     * 获取错误日志
     */
    getErrorLog(): AppError[] {
        return [...this.errorLog];
    }

    /**
     * 清除错误日志
     */
    clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * 检查是否为应用错误
     */
    private isAppError(error: unknown): error is AppError {
        return (
            typeof error === 'object' &&
            error !== null &&
            'type' in error &&
            'message' in error &&
            'timestamp' in error
        );
    }
}

export const errorHandler = new ErrorHandler();

/**
 * 错误边界组件使用的错误处理Hook
 */
export function getErrorMessage(error: AppError): string {
    const messages: Record<ErrorType, string> = {
        [ErrorType.NETWORK]: '🌐 ' + error.message,
        [ErrorType.API]: '🔌 ' + error.message,
        [ErrorType.VALIDATION]: '⚠️ ' + error.message,
        [ErrorType.AGENT]: '🤖 ' + error.message,
        [ErrorType.SKILL]: '⚡ ' + error.message,
        [ErrorType.STORAGE]: '💾 ' + error.message,
        [ErrorType.UNKNOWN]: '❌ ' + error.message
    };

    return messages[error.type] || error.message;
}
