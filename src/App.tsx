import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './lib/toast';
import { ScheduleProvider, useSchedule } from './contexts/ScheduleContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulePage } from './pages/SchedulePage';
import { CancellationPage } from './pages/CancellationPage';
import { ClinicCalendarPage } from './pages/ClinicCalendarPage';
import { AcceptShiftPage } from './pages/AcceptShiftPage';
import { SeasonalPeriodsPage } from './pages/SeasonalPeriodsPage';
import { StaffList } from './components/staff/StaffList';
import { ClientList } from './components/clients/ClientList';
import { Sidebar } from './components/layout/Sidebar';
import { ScheduleAssistant } from './components/schedule/ScheduleAssistant';

// If ?accept=TOKEN is in the URL, render the public accept page (no auth needed)
const acceptToken = new URLSearchParams(window.location.search).get('accept');

function GlobalScheduleAssistant() {
  const { assignments, staff, clients, weekLabel, handleUpdateAssignment } = useSchedule();
  return (
    <ScheduleAssistant
      assignments={assignments}
      staff={staff}
      clients={clients}
      weekLabel={weekLabel}
      onUpdateAssignment={handleUpdateAssignment}
    />
  );
}

function AppLayout() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  function renderPage() {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={setCurrentPage} />;
      case 'schedule': return <SchedulePage />;
      case 'staff': return <StaffList />;
      case 'clients': return <ClientList />;
      case 'cancellations': return <CancellationPage />;
      case 'clinic-calendar': return <ClinicCalendarPage />;
      case 'seasons': return <SeasonalPeriodsPage />;
      default: return <DashboardPage onNavigate={setCurrentPage} />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f5f8fa' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-7 max-w-[1400px] mx-auto">
          {renderPage()}
        </div>
      </main>
      <GlobalScheduleAssistant />
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();

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

  if (!user) return <LoginPage />;

  return (
    <ScheduleProvider>
      <AppLayout />
    </ScheduleProvider>
  );
}

function App() {
  if (acceptToken) return <AcceptShiftPage token={acceptToken} />;

  return (
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
