import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './lib/toast';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulePage } from './pages/SchedulePage';
import { CancellationPage } from './pages/CancellationPage';
import { StaffList } from './components/staff/StaffList';
import { ClientList } from './components/clients/ClientList';
import { Sidebar } from './components/layout/Sidebar';

function AppInner() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f7fa' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-brand-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  function renderPage() {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={setCurrentPage} />;
      case 'schedule': return <SchedulePage />;
      case 'staff': return <StaffList />;
      case 'clients': return <ClientList />;
      case 'cancellations': return <CancellationPage />;
      default: return <DashboardPage onNavigate={setCurrentPage} />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f5f8fa' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto relative">
        {/* Brand accent blobs — per brand guide: irregular circles at 35% transparency */}
        <div
          className="fixed pointer-events-none"
          style={{
            top: '-80px',
            right: '-80px',
            width: '380px',
            height: '380px',
            borderRadius: '60% 40% 55% 45% / 45% 55% 45% 55%',
            background: '#6dccc2',
            opacity: 0.35,
            zIndex: 0,
          }}
        />
        <div
          className="fixed pointer-events-none"
          style={{
            bottom: '-60px',
            left: '180px',
            width: '280px',
            height: '300px',
            borderRadius: '45% 55% 40% 60% / 55% 40% 60% 45%',
            background: '#df76b6',
            opacity: 0.28,
            zIndex: 0,
          }}
        />
        <div
          className="fixed pointer-events-none"
          style={{
            bottom: '-40px',
            right: '60px',
            width: '300px',
            height: '320px',
            borderRadius: '50% 50% 45% 55% / 40% 60% 40% 60%',
            background: '#efd35c',
            opacity: 0.32,
            zIndex: 0,
          }}
        />

        <div className="relative z-10 p-7 max-w-[1400px] mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
