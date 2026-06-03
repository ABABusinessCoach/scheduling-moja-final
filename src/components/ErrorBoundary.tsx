import React from 'react';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fa', fontFamily: 'sans-serif' }}>
        <div style={{ maxWidth: 480, padding: '2rem', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', background: '#35a09a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
