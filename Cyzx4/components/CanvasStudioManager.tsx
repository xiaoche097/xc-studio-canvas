import React, { Component, ReactNode } from 'react';
import Workspace from '../pages/Workspace';
import { AppMode } from '../types';

interface CanvasStudioManagerProps {
  onOpenFeature?: (mode: AppMode) => void;
  onBackToHub?: () => void;
  initialPrompt?: string;
  initialAttachments?: File[];
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Canvas Boundary Caught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[#f8fafc] text-slate-800 p-6 space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-slate-900 max-w-lg text-center shadow-xl space-y-3">
            <h3 className="text-base font-bold">画板正在自动调试</h3>
            <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg break-all font-mono font-bold">
              {this.state.error?.message || "未知组件错误"}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition"
            >
              重新加载画布
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const CanvasStudioManager: React.FC<CanvasStudioManagerProps> = ({
  onBackToHub,
  initialPrompt,
  initialAttachments,
}) => {
  return (
    <CanvasErrorBoundary>
      <div className="w-full h-full relative overflow-hidden bg-[#F9FAFB]">
        <Workspace
          onBackToHub={onBackToHub}
          initialPrompt={initialPrompt}
          initialAttachments={initialAttachments}
        />
      </div>
    </CanvasErrorBoundary>
  );
};

export default CanvasStudioManager;
