import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="p-6 text-center text-gray-500 text-sm">
                    <div className="mb-2 text-brand-orange text-lg">⚠️</div>
                    内容渲染出错，请关闭后重试
                    <div className="text-xs text-gray-400 mt-2">{this.state.error?.message}</div>
                </div>
            );
        }

        return this.props.children;
    }
}
