import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0f0f0f',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '40px',
            borderRadius: '12px',
            maxWidth: '600px',
            border: '1px solid #333'
          }}>
            <h1 style={{ 
              marginBottom: '20px', 
              background: 'linear-gradient(90deg, #ef4444, #f97316)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              ⚠️ System Error
            </h1>
            <p style={{ color: '#ccc', marginBottom: '20px' }}>
              The Mission Control dashboard encountered an error and couldn't load.
            </p>
            
            {this.state.error && (
              <div style={{
                background: '#111',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'left',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                color: '#ef4444',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                <strong>{this.state.error.name}:</strong> {this.state.error.message}
                {this.state.errorInfo?.componentStack && (
                  <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            
            <button
              onClick={this.handleRetry}
              style={{
                padding: '12px 30px',
                borderRadius: '6px',
                border: 'none',
                background: '#f97316',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Retry
            </button>
            <button
              onClick={() => { localStorage.removeItem('squad_access'); window.location.reload(); }}
              style={{
                padding: '12px 30px',
                borderRadius: '6px',
                border: '1px solid #444',
                background: 'transparent',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
