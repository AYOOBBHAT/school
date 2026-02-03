import { Suspense, ReactNode, Component, ErrorInfo } from 'react';

interface LazyLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class LazyErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LazyLoader error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-6">
            <div className="text-red-600 text-xl mb-4">⚠️ Failed to load component</div>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'An error occurred while loading this section.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function LazyLoader({ children, fallback }: LazyLoaderProps) {
  const defaultFallback = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );

  return (
    <LazyErrorBoundary>
      <Suspense fallback={fallback || defaultFallback}>{children}</Suspense>
    </LazyErrorBoundary>
  );
}
