import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportError } from '@/lib/telemetry';

interface Props {
  children: ReactNode;
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
    console.error('💥 Sentinel Crash:', error, errorInfo);
    reportError(error, errorInfo.componentStack || undefined);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[#050505] p-10 text-center space-y-6 animate-in fade-in duration-500">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-full shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <AlertTriangle className="w-12 h-12 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white uppercase tracking-widest">
              Component Crash Detected
            </h2>
            <p className="text-neutral-500 text-sm max-w-md mx-auto">
              The UI thread encountered an unhandled exception in this section.
            </p>
          </div>
          <div className="p-4 bg-black border border-white/5 rounded-lg max-w-lg w-full overflow-x-auto">
            <code className="text-rose-400 text-[10px] font-mono whitespace-pre text-left block">
              {this.state.error?.toString()}
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs font-bold text-neutral-300 hover:text-white transition-all uppercase tracking-widest"
          >
            <RefreshCw size={14} />
            Hot Reload Session
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
