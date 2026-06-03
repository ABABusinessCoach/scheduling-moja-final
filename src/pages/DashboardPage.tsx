import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getMonday, format, formatWeekRange } from '../lib/dateUtils';
import { calculateStaffHours, computeRatioAlerts } from '../lib/scheduler';
import type {
  Staff,
  Client,
  Schedule,
  ScheduleAssignment,
  StaffClientRestriction,
  RatioAlert,
} from '../lib/types';
import { DAY_NAMES } from '../lib/types';
import {
  Users,
  UserRound,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  ArrowUpRight,
  Wand2,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [restrictions, setRestrictions] = useState<StaffClientRestriction[]>([]);
  const [thisWeekSchedule, setThisWeekSchedule] = useState<Schedule | null>(null);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [ratioAlerts, setRatioAlerts] = useState<RatioAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const monday = getMonday(new Date());
    const weekStr = format(monday, 'yyyy-MM-dd');

    const [staffRes, clientRes, schedRes, restrictRes] = await Promise.all([
      supabase.from('staff').select('*, staff_availability(*)').eq('is_active', true),
      supabase.from('clients').select('*, client_attendance(*), client_availability(*)').eq('is_active', true),
      supabase.from('schedules').select('*').eq('week_start_date', weekStr).maybeSingle(),
      supabase.from('staff_client_restrictions').select('*'),
    ]);

    const staffData: Staff[] = (staffRes.data ?? []).map((s: any) => ({
      ...s,
      availability: s.staff_availability,
    }));
    const clientData: Client[] = (clientRes.data ?? []).map((c: any) => ({
      ...c,
      availability: c.client_availability,
      attendance: c.client_attendance,
    }));
    const restrictData: StaffClientRestriction[] = restrictRes.data ?? [];

    setStaff(staffData);
    setClients(clientData);
    setRestrictions(restrictData);
    setRatioAlerts(computeRatioAlerts(staffData, clientData, restrictData));

    if (schedRes.data) {
      setThisWeekSchedule(schedRes.data);
      const { data: assignData } = await supabase
        .from('schedule_assignments')
        .select('*')
        .eq('schedule_id', schedRes.data.id);
      setAssignments(assignData ?? []);
    }
    setLoading(false);
  }

  const monday = getMonday(new Date());
  const hoursData = calculateStaffHours(staff, assignments);
  const violationCount = assignments.filter((a) => a.violation_reason).length;

  const statsCards = [
    {
      label: 'Active Staff',
      value: staff.length,
      icon: <Users size={18} />,
      iconColor: '#35a09a',
      iconBg: 'rgba(109,204,194,0.12)',
      accent: '#6dccc2',
      action: () => onNavigate('staff'),
    },
    {
      label: 'Active Clients',
      value: clients.length,
      icon: <UserRound size={18} />,
      iconColor: '#3b82f6',
      iconBg: 'rgba(59,130,246,0.1)',
      accent: '#93c5fd',
      action: () => onNavigate('clients'),
    },
    {
      label: "Schedule Status",
      value: thisWeekSchedule
        ? (thisWeekSchedule.status === 'published' ? 'Published' : 'Draft')
        : 'Not Created',
      icon: <CalendarDays size={18} />,
      iconColor: '#d97706',
      iconBg: 'rgba(217,119,6,0.1)',
      accent: '#fcd34d',
      action: () => onNavigate('schedule'),
      isText: true,
    },
    {
      label: 'Rule Violations',
      value: violationCount,
      icon: <AlertTriangle size={18} />,
      iconColor: violationCount > 0 ? '#ef4444' : '#94a3b8',
      iconBg: violationCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.1)',
      accent: violationCount > 0 ? '#fca5a5' : '#cbd5e1',
      action: () => onNavigate('schedule'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Overview</p>
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight leading-none">Dashboard</h1>
        </div>
        <p className="text-sm text-slate-400 font-medium">Week of {formatWeekRange(monday)}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {statsCards.map((card) => (
          <button
            key={card.label}
            onClick={card.action}
            className="bg-white rounded-2xl border border-slate-200/70 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 group"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
              <ArrowUpRight
                size={14}
                className="opacity-0 group-hover:opacity-40 transition-opacity"
                style={{ color: card.iconColor }}
              />
            </div>
            <div
              className={`font-bold mb-1 leading-none ${card.isText ? 'text-xl' : 'text-3xl'}`}
              style={{ color: '#0f172a', letterSpacing: card.isText ? undefined : '-0.02em' }}
            >
              {card.value}
            </div>
            <div className="text-[12px] text-slate-400 font-semibold">{card.label}</div>

            {/* Bottom accent line */}
            <div
              className="mt-4 h-0.5 rounded-full w-8 opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ background: card.accent }}
            />
          </button>
        ))}
      </div>

      {/* At-Risk Slots */}
      {ratioAlerts.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, #fff5f5 0%, #fff8f8 100%)',
            border: '1px solid rgba(239,68,68,0.18)',
            boxShadow: '0 2px 8px rgba(239,68,68,0.08)',
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                <ShieldAlert size={15} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-red-900 text-sm">At-Risk Slots</h2>
                <p className="text-xs text-red-400 font-medium">Insufficient staff coverage</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
              {ratioAlerts.length} slot{ratioAlerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {ratioAlerts.map((alert, i) => (
              <div
                key={i}
                className="bg-white border border-red-100 rounded-xl px-3.5 py-3 flex items-center justify-between"
                style={{ boxShadow: '0 1px 3px rgba(239,68,68,0.06)' }}
              >
                <div>
                  <span className="font-bold text-slate-800 text-sm">{DAY_NAMES[alert.day]}</span>
                  <span className="text-slate-400 text-sm"> — {alert.shift}</span>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {alert.clientCount} clients &middot; {alert.eligibleStaffCount} eligible staff
                  </div>
                </div>
                <span className="ml-3 w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-xs font-bold text-red-700 flex-shrink-0">
                  -{alert.deficit}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate('staff')}
            className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors flex items-center gap-1"
          >
            Review staff availability <ArrowUpRight size={12} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hours tracker */}
        {hoursData.length > 0 && (
          <div
            className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 p-5"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Staff Hours</p>
                <h2 className="font-bold text-slate-900 text-sm">{formatWeekRange(monday)}</h2>
              </div>
              <button
                onClick={() => onNavigate('schedule')}
                className="text-xs text-aqua-600 hover:text-aqua-700 font-bold flex items-center gap-1 transition-colors"
              >
                View Schedule <ArrowUpRight size={12} />
              </button>
            </div>
            <div className="space-y-4">
              {hoursData.map((h) => {
                const pct = Math.min((h.assignedHours / h.weeklyGoal) * 100, 100);
                return (
                  <div key={h.staffId}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #6dccc2, #35a09a)' }}
                        >
                          {h.staffName.slice(0, 1)}
                        </div>
                        <span className="text-[13px] font-semibold text-slate-700">{h.staffName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {h.status === 'over' && <TrendingUp size={12} className="text-red-500" />}
                        {h.status === 'at' && <Minus size={12} className="text-aqua-400" />}
                        {h.status === 'under' && <TrendingDown size={12} className="text-amber-500" />}
                        <span className={`text-[13px] font-bold ${
                          h.status === 'over' ? 'text-red-600' :
                          h.status === 'at' ? 'text-aqua-600' :
                          'text-amber-600'
                        }`}>
                          {h.assignedHours.toFixed(1)}h
                        </span>
                        <span className="text-[12px] text-slate-300 font-medium">/ {h.weeklyGoal}h</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: h.status === 'over'
                            ? 'linear-gradient(90deg, #f87171, #ef4444)'
                            : h.status === 'at'
                            ? 'linear-gradient(90deg, #6dccc2, #35a09a)'
                            : 'linear-gradient(90deg, #fbbf24, #d97706)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onNavigate('schedule')}
            className="flex-1 rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5 group"
            style={{
              background: 'linear-gradient(150deg, #1a2c3f 0%, #0c1724 100%)',
              boxShadow: '0 4px 16px rgba(17,30,45,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(17,30,45,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(17,30,45,0.3)';
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(230,109,56,0.2)' }}
            >
              <Wand2 size={17} style={{ color: '#e66d38' }} />
            </div>
            <div className="font-bold text-white text-sm mb-1">Schedule Builder</div>
            <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Auto-generate or manually adjust the weekly schedule
            </div>
          </button>
          <button
            onClick={() => onNavigate('cancellations')}
            className="flex-1 bg-white rounded-2xl border border-slate-200/70 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 group"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
              <AlertTriangle size={17} className="text-amber-500" />
            </div>
            <div className="font-bold text-slate-800 text-sm mb-1">Log Cancellation</div>
            <div className="text-xs font-medium text-slate-400">
              Get recommendations when staff or clients cancel
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
