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
import { DAY_NAMES, SHIFT_LABELS, SHIFT_TIMES, slotDuration } from '../lib/types';
import type { AssignmentShift } from '../lib/types';
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
  Clock,
  X,
  Info,
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
  const [atRiskDetail, setAtRiskDetail] = useState<RatioAlert | null>(null);

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
              <button
                key={i}
                onClick={() => setAtRiskDetail(alert)}
                className="bg-white border border-red-100 rounded-xl px-3.5 py-3 flex items-center justify-between hover:bg-red-50 hover:border-red-300 transition-colors group text-left"
                style={{ boxShadow: '0 1px 3px rgba(239,68,68,0.06)' }}
              >
                <div>
                  <span className="font-bold text-slate-800 text-sm">{DAY_NAMES[alert.day]}</span>
                  <span className="text-slate-400 text-sm"> — {SHIFT_LABELS[alert.shift as AssignmentShift] ?? alert.shift}</span>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {alert.clientCount} clients &middot; {alert.eligibleStaffCount} eligible staff
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-xs font-bold text-red-700">
                    -{alert.deficit}
                  </span>
                  <Info size={13} className="text-red-300 group-hover:text-red-500 transition-colors" />
                </div>
              </button>
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
        {/* Staff hours tracker */}
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
          {/* Client auth hours */}
          {clients.filter((c) => c.authorized_hours_per_week).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client Auth. Hours</p>
                  <p className="text-xs font-semibold text-slate-700">This week</p>
                </div>
              </div>
              <div className="space-y-3">
                {clients.filter((c) => c.is_active && c.authorized_hours_per_week).map((c) => {
                  const scheduled = assignments
                    .filter((a) => a.client_id === c.id)
                    .reduce((sum, a) => {
                      if (a.time_start && a.time_end) return sum + slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5));
                      return sum + SHIFT_TIMES[a.shift].hours;
                    }, 0);
                  const cap = c.authorized_hours_per_week!;
                  const pct = Math.min((scheduled / cap) * 100, 100);
                  const over = scheduled > cap;
                  const close = scheduled >= cap * 0.9 && !over;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600 truncate max-w-[100px]">{c.first_name} {c.last_name}</span>
                        <div className="flex items-center gap-1">
                          {(over || close) && <AlertTriangle size={10} className={over ? 'text-red-500' : 'text-amber-400'} />}
                          <span className={`text-xs font-bold tabular-nums ${over ? 'text-red-600' : close ? 'text-amber-600' : 'text-slate-500'}`}>
                            {scheduled.toFixed(1)}h / {cap}h
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : close ? 'bg-amber-400' : 'bg-blue-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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

      {/* At-Risk Detail Modal */}
      {atRiskDetail && (
        <AtRiskDetailModal
          alert={atRiskDetail}
          staff={staff}
          clients={clients}
          restrictions={restrictions}
          onClose={() => setAtRiskDetail(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

interface AtRiskDetailModalProps {
  alert: RatioAlert;
  staff: Staff[];
  clients: Client[];
  restrictions: StaffClientRestriction[];
  onClose: () => void;
  onNavigate: (page: string) => void;
}

function AtRiskDetailModal({ alert, staff, clients, restrictions, onClose, onNavigate }: AtRiskDetailModalProps) {
  const shiftLabel = SHIFT_LABELS[alert.shift as AssignmentShift] ?? alert.shift;

  // Find which clients attend on this day/shift
  const affectedClients = clients.filter((c) => {
    if (!c.is_active) return false;
    const avail = c.availability ?? [];
    return avail.some((a) => a.day_of_week === alert.day && a.shift === alert.shift);
  });

  // For each client, find why staff are blocked
  function getBlockingReasons(client: Client): string[] {
    const reasons: string[] = [];
    const eligible = staff.filter((s) => {
      if (!s.is_active) return false;
      const sAvail = s.availability ?? [];
      const hasAvail = sAvail.some((a) => a.day_of_week === alert.day && a.shift === alert.shift);
      if (!hasAvail) return false;
      const restricted = restrictions.some((r) => r.staff_id === s.id && r.client_id === client.id);
      if (restricted) return false;
      if (client.no_male_therapists && s.gender === 'male') return false;
      return true;
    });

    const restricted = restrictions.filter((r) => r.client_id === client.id);
    if (restricted.length > 0) {
      const names = restricted.map((r) => staff.find((s) => s.id === r.staff_id)?.name ?? 'Unknown').filter(Boolean);
      if (names.length) reasons.push(`Restricted from: ${names.join(', ')}`);
    }
    if (client.no_male_therapists) {
      const blockedByGender = staff.filter((s) => s.gender === 'male' && s.is_active);
      if (blockedByGender.length > 0) reasons.push('Requires female therapist only');
    }
    if (eligible.length === 0) {
      reasons.push('No eligible staff available for this shift');
    } else if (eligible.length < 2) {
      reasons.push(`Only ${eligible.length} staff can cover this client`);
    }
    return reasons;
  }

  const noShiftStaff = staff.filter((s) => {
    if (!s.is_active) return false;
    const avail = s.availability ?? [];
    return !avail.some((a) => a.day_of_week === alert.day && a.shift === alert.shift);
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <ShieldAlert size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">{DAY_NAMES[alert.day]} — {shiftLabel}</h2>
              <p className="text-xs text-red-500 font-medium mt-0.5">
                {alert.clientCount} clients · {alert.eligibleStaffCount} eligible staff · needs {alert.deficit} more
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Affected clients */}
          {affectedClients.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Affected Clients</h3>
              <div className="space-y-2">
                {affectedClients.map((c) => {
                  const reasons = getBlockingReasons(c);
                  return (
                    <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="font-semibold text-slate-800 text-sm">{c.first_name} {c.last_name}</div>
                      {reasons.length > 0 ? (
                        <ul className="mt-1.5 space-y-1">
                          {reasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">No specific blocks — general understaffing</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Staff not available */}
          {noShiftStaff.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Staff Without This Shift</h3>
              <div className="flex flex-wrap gap-1.5">
                {noShiftStaff.map((s) => (
                  <span key={s.id} className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-500 font-medium">
                    {s.name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">These staff members have no availability set for this shift.</p>
            </div>
          )}

          {affectedClients.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">
              No clients with explicit availability for this slot found. Check client availability settings.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => { onClose(); onNavigate('staff'); }}
            className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
          >
            Edit Staff Availability
          </button>
          <button
            onClick={() => { onClose(); onNavigate('schedule'); }}
            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
          >
            Fix in Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
