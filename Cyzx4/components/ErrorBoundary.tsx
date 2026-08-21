import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { AppError, errorHandler, getErrorMessage } from '../utils/error-handler';

interface Props {
    children: ReactNode;
    fallback?: (error: AppError, reset: () => void) => ReactNode;
}

interface State {
    hasError: boolean;
    error: AppError | null;
}

/**
 * 错误边界组件 - 捕获组件树中的错误并提供降级UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        const appError = errorHandler.handleError(error, {
            source: 'ErrorBoundary'
        });

        return {
            hasError: true,
            error: appError
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        errorHandler.handleError(error, {
            componentStack: errorInfo.componentStack,
            source: 'ErrorBoundary'
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null
        });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError && this.state.error) {
            // 使用自定义降级UI（如果提供）
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.handleReset);
            }

            // 默认错误UI
            return (
                <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                        <div className="flex flex-col items-center text-center">
                            {/* 错误图标 */}
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>

                            {/* 错误标题 */}
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                出错了
                            </h1>

                            {/* 错误消息 */}
                            <p className="text-gray-600 mb-6">
                                {getErrorMessage(this.state.error)}
                            </p>

                            {/* 错误详情（开发环境） */}
                            {process.env.NODE_ENV === 'development' && this.state.error.originalError && (
                                <details className="w-full mb-6 text-left">
                                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
                                        技术详情
                                    </summary>
                                    <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 overflow-auto max-h-40">
                                        <div className="mb-2">
                                            <strong>类型:</strong> {this.state.error.type}
                                        </div>
                                        <div className="mb-2">
                                            <strong>消息:</strong> {this.state.error.originalError.message}
                                        </div>
                                        {this.state.error.originalError.stack && (
                                            <div>
                                                <strong>堆栈:</strong>
                                                <pre className="mt-1 whitespace-pre-wrap">
                                                    {this.state.error.originalError.stack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}

                            {/* 操作按钮 */}
                            <div className="flex gap-3 w-full">
                                {this.state.error.retryable && (
                                    <button
                                        onClick={this.handleReset}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        重试
                                    </button>
                                )}
                                <button
                                    onClick={this.handleGoHome}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                                >
                                    <Home className="w-4 h-4" />
                                    返回首页
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
