import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutGrid,
  Users,
  UserRound,
  CalendarDays,
  AlertTriangle,
  LogOut,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',     label: 'Dashboard',     icon: <LayoutGrid size={16} /> },
  { id: 'schedule',      label: 'Schedule',      icon: <CalendarDays size={16} /> },
  { id: 'staff',         label: 'Staff',         icon: <Users size={16} /> },
  { id: 'clients',       label: 'Clients',       icon: <UserRound size={16} /> },
  { id: 'cancellations', label: 'Cancellations', icon: <AlertTriangle size={16} /> },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();
  const initials = (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col h-full relative overflow-hidden"
      style={{ background: '#2a3f55', borderRight: '1px solid rgba(0,0,0,0.15)' }}
    >
      {/* Logo area */}
      <div className="px-4 pt-5 pb-4 relative">
        <div className="flex items-center gap-3">
          {/* Logo in white rounded square — matches the reference screenshot */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          >
            <img
              src="/files_4755529-2026-06-01T19-48-56-147Z-MOJA+Behavioral_(1).png"
              alt="Moja"
              className="w-9 h-9 object-contain"
            />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-[14px] text-white leading-none">Moja Behavioral</p>
            <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#6dccc2' }}>
              Services
            </p>
          </div>
        </div>

        <div className="mt-4 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>

      {/* Section label */}
      <p
        className="px-5 mb-1.5 text-[10px] font-bold uppercase"
        style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em' }}
      >
        Menu
      </p>

      {/* Nav items */}
      <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 text-left relative group"
              style={
                active
                  ? { background: 'rgba(255,255,255,0.12)', color: '#ffffff' }
                  : { color: 'rgba(255,255,255,0.6)' }
              }
            >
              {!active && (
                <span
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                />
              )}
              <span
                className="relative z-10 flex-shrink-0"
                style={{ color: active ? '#6dccc2' : 'rgba(255,255,255,0.4)' }}
              >
                {item.icon}
              </span>
              <span className="relative z-10 group-hover:text-white transition-colors">
                {item.label}
              </span>
              {active && (
                <span
                  className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#6dccc2' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2.5 pb-4 mt-2">
        <div className="h-px mb-3 mx-2" style={{ background: 'rgba(255,255,255,0.1)' }} />

        <div className="flex items-center gap-2.5 px-3 py-2 mb-0.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: 'rgba(109,204,194,0.3)' }}
          >
            {initials}
          </div>
          <p className="text-xs truncate font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {user?.email}
          </p>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 group relative"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          <span
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          />
          <LogOut size={15} className="relative z-10" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <span className="relative z-10 group-hover:text-white transition-colors">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
