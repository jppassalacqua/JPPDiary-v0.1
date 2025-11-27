import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "../services/logger";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Log exception to system logs
    logger.error('System', 'Unhandled UI Error', { 
        message: error.message, 
        stack: error.stack, 
        componentStack: errorInfo.componentStack 
    });
  }

  private handleReload = () => {
      window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center transition-colors">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full mb-6 shadow-sm">
              <AlertTriangle size={48} className="text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Something went wrong</h1>
          <p className="text-slate-600 dark:text-slate-300 max-w-md mb-8">
            An unexpected error occurred in the application. Please reload the page to try again.
          </p>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-8 max-w-lg w-full text-left overflow-auto max-h-40 shadow-inner">
              <code className="text-xs text-red-500 font-mono break-all">{this.state.error?.message}</code>
          </div>
          <button 
            onClick={this.handleReload}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20 font-medium"
          >
            <RefreshCw size={20} /> Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}