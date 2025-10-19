import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    // FIX: Bind 'this' in the constructor to ensure it's correctly bound in the handleReset method.
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  
  handleReset() {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/50 border border-red-700 text-red-300 p-6 rounded-lg flex flex-col items-center justify-center text-center h-full">
          <AlertTriangleIcon className="h-12 w-12 mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong.</h2>
          <p className="mb-4 text-red-300">
            An unexpected error occurred. Please try again.
          </p>
          
          <button
            onClick={this.handleReset}
            className="bg-red-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-red-700 transition-colors duration-200"
          >
            {this.props.onReset ? 'Try Again' : 'Reload Page'}
          </button>
        
           <details className="mt-4 text-left w-full max-w-lg">
             <summary className="cursor-pointer text-sm text-red-400 hover:text-red-200">Error Details</summary>
             <pre className="mt-2 p-2 bg-gray-900/50 rounded text-xs text-red-200 overflow-auto max-h-40">
               <code>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.error?.stack}
                </code>
             </pre>
           </details>
        </div>
      );
    }

    return this.props.children;
  }
}