import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Schedule,
  ScheduleAssignment,
  Staff,
  Client,
  StaffClientRestriction,
  DayOfWeek,
  SessionNote,
  RatioAlert,
} from '../lib/types';
import { DAY_NAMES } from '../lib/types';
import { generateWeeklySchedule, computeRatioAlerts } from '../lib/scheduler';
import { getMonday, format, addDays, formatWeekRange } from '../lib/dateUtils';
import { WeeklyGrid } from '../components/schedule/WeeklyGrid';
import { StaffView } from '../components/schedule/StaffView';
import { ClientView } from '../components/schedule/ClientView';
import { HourTracker } from '../components/schedule/HourTracker';
import { TimelineGrid } from '../components/schedule/TimelineGrid';
import { DailyView } from '../components/schedule/DailyView';
import { SupervisionTracker } from '../components/schedule/SupervisionTracker';
import { ClientHourTracker } from '../components/schedule/ClientHourTracker';
import { useToast } from '../lib/toast';
import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  CalendarDays,
  Users,
  UserRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  X,
} from 'lucide-react';

type ViewMode = 'timeline' | 'daily' | 'grid' | 'staff' | 'client';

export function SchedulePage() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allRestrictions, setAllRestrictions] = useState<StaffClientRestriction[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [ratioAlerts, setRatioAlerts] = useState<RatioAlert[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const showToast = useToast();

  useEffect(() => { loadBaseData(); }, []);

  useEffect(() => {
    loadSchedule();
  }, [currentMonday]);

  useEffect(() => {
    if (staff.length > 0 && clients.length > 0) {
      setRatioAlerts(computeRatioAlerts(staff, clients, allRestrictions));
      setAlertsDismissed(false);
    }
  }, [staff, clients, allRestrictions]);

  async function loadBaseData() {
    const [staffRes, clientRes, restrictRes] = await Promise.all([
      supabase
        .from('staff')
        .select('*, staff_availability(*)')
        .eq('is_active', true)
        .order('priority_tier')
        .order('name'),
      supabase
        .from('clients')
        .select('*, client_attendance(*), client_availability(*)')
        .eq('is_active', true)
        .order('first_name'),
      supabase.from('staff_client_restrictions').select('*'),
    ]);
    // Supabase returns nested joins keyed by table name (staff_availability, client_availability,
    // client_attendance). Map them to the interface property names the scheduler expects.
    setStaff(
      (staffRes.data ?? []).map((s: any) => ({ ...s, availability: s.staff_availability }))
    );
    setClients(
      (clientRes.data ?? []).map((c: any) => ({
        ...c,
        availability: c.client_availability,
        attendance: c.client_attendance,
      }))
    );
    setAllRestrictions(restrictRes.data ?? []);
  }

  async function loadSchedule() {
    setLoading(true);
    const weekStr = format(currentMonday, 'yyyy-MM-dd');
    const { data: sched } = await supabase
      .from('schedules')
      .select('*')
      .eq('week_start_date', weekStr)
      .maybeSingle();

    if (sched) {
      setSchedule(sched);
      const { data: assignData } = await supabase
        .from('schedule_assignments')
        .select('*, staff(*,staff_availability(*)), client:clients(*,client_attendance(*),client_availability(*))')
        .eq('schedule_id', sched.id);
      const loaded = (assignData ?? []).map((a: any) => ({
        ...a,
        staff: a.staff
          ? { ...a.staff, availability: a.staff.staff_availability }
          : undefined,
        client: a.client
          ? { ...a.client, availability: a.client.client_availability, attendance: a.client.client_attendance }
          : undefined,
      }));
      setAssignments(loaded);
      await loadSessionNotes(loaded.map((a: ScheduleAssignment) => a.id));
    } else {
      setSchedule(null);
      setAssignments([]);
      setSessionNotes([]);
    }
    setLoading(false);
  }

  async function loadSessionNotes(assignmentIds: string[]) {
    if (!assignmentIds.length) return;
    const { data } = await supabase
      .from('session_notes')
      .select('*')
      .in('assignment_id', assignmentIds);
    setSessionNotes(data ?? []);
  }

  async function handleToggleNote(assignmentId: string) {
    const existing = sessionNotes.find((n) => n.assignment_id === assignmentId);
    if (existing) {
      await supabase
        .from('session_notes')
        .update({ submitted: !existing.submitted, submitted_at: !existing.submitted ? new Date().toISOString() : null })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('session_notes')
        .insert({ assignment_id: assignmentId, submitted: true, submitted_at: new Date().toISOString() });
    }
    await loadSessionNotes(assignments.map((a) => a.id));
  }

  async function generateSchedule() {
    if (staff.length === 0 || clients.length === 0) {
      showToast('Add staff and clients before generating a schedule.', 'error');
      return;
    }
    if (schedule?.status === 'published') {
      const ok = window.confirm(
        'This schedule is already published. Regenerating will delete all current assignments and create a new draft. Continue?'
      );
      if (!ok) return;
    }
    setGenerating(true);
    const weekStr = format(currentMonday, 'yyyy-MM-dd');
    let scheduleId: string;

    try {
      const { data: existing } = await supabase
        .from('schedules')
        .select('id')
        .eq('week_start_date', weekStr)
        .maybeSingle();

      if (existing) {
        scheduleId = existing.id;
        await supabase.from('schedule_assignments').delete().eq('schedule_id', scheduleId);
      } else {
        const { data: newSched, error } = await supabase
          .from('schedules')
          .insert({ week_start_date: weekStr, status: 'draft' })
          .select()
          .single();
        if (error || !newSched) throw new Error(error?.message ?? 'Failed to create schedule');
        scheduleId = newSched.id;
      }

      const generated = generateWeeklySchedule(scheduleId, staff, clients, allRestrictions);
      if (generated.length > 0) {
        await supabase.from('schedule_assignments').insert(generated);
      }
      await loadSchedule();
      showToast('Schedule generated.');
    } catch (err) {
      showToast('Failed to generate schedule. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateAssignment(assignmentId: string, staffId: string | null) {
    await supabase
      .from('schedule_assignments')
      .update({ staff_id: staffId, is_manual_override: true, violation_reason: null })
      .eq('id', assignmentId);
    await loadSchedule();
  }

  async function publishSchedule() {
    if (!schedule) return;
    const { error } = await supabase.from('schedules').update({ status: 'published' }).eq('id', schedule.id);
    if (error) {
      showToast('Failed to publish schedule.', 'error');
    } else {
      showToast('Schedule published.');
      await loadSchedule();
    }
  }

  const violationCount = assignments.filter((a) => a.violation_reason).length;
  const unassignedCount = assignments.filter((a) => !a.staff_id).length;
  const missingNotesCount = assignments.filter((a) => {
    const note = sessionNotes.find((n) => n.assignment_id === a.id);
    return !note?.submitted;
  }).length;

  const VIEW_TABS = [
    { id: 'timeline', icon: <Clock size={14} />, label: 'Timeline' },
    { id: 'daily',    icon: <Calendar size={14} />, label: 'Daily' },
    { id: 'grid',     icon: <CalendarDays size={14} />, label: 'Grid' },
    { id: 'staff',    icon: <Users size={14} />, label: 'By Staff' },
    { id: 'client',   icon: <UserRound size={14} />, label: 'By Client' },
  ];

  const sharedProps = {
    assignments,
    staff,
    clients,
    sessionNotes,
    onUpdateAssignment: handleUpdateAssignment,
    onToggleNote: handleToggleNote,
  };

  return (
    <div className="flex gap-5 h-full">
      <div className="flex-1 min-w-0">
        {/* Week nav */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentMonday((p) => addDays(p, -7))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <div className="font-semibold text-slate-900 text-sm">{formatWeekRange(currentMonday)}</div>
              <button onClick={() => setCurrentMonday(getMonday(new Date()))} className="text-xs text-aqua-500 hover:text-aqua-600 transition-colors">
                This week
              </button>
            </div>
            <button onClick={() => setCurrentMonday((p) => addDays(p, 7))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {schedule && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${schedule.status === 'published' ? 'bg-aqua-100 text-aqua-600' : 'bg-amber-100 text-amber-700'}`}>
                {schedule.status === 'published' ? 'Published' : 'Draft'}
              </span>
            )}
            {violationCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <AlertTriangle size={12} /> {violationCount} violation{violationCount !== 1 ? 's' : ''}
              </span>
            )}
            {schedule && schedule.status !== 'published' && (
              <button onClick={publishSchedule} className="flex items-center gap-1.5 px-3 py-2 bg-aqua-50 hover:bg-aqua-100 text-aqua-600 rounded-lg text-sm font-semibold transition-colors">
                <CheckCircle2 size={15} /> Publish
              </button>
            )}
            <button
              onClick={generateSchedule}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              <Wand2 size={15} />
              {generating ? 'Generating…' : schedule ? 'Regenerate' : 'Auto-Generate'}
            </button>
          </div>
        </div>

        {/* Ratio alerts banner */}
        {ratioAlerts.length > 0 && !alertsDismissed && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-800">Staffing Gap Detected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ratioAlerts.map((alert, i) => (
                    <span key={i} className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                      {DAY_NAMES[alert.day]} {alert.shift} — {alert.clientCount} clients, {alert.eligibleStaffCount} eligible staff (−{alert.deficit})
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setAlertsDismissed(true)} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 mt-0.5">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* View tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-4 w-fit">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as ViewMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !schedule ? (
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center">
            <CalendarDays size={40} className="text-slate-300 mb-4" />
            <h3 className="font-semibold text-slate-700 mb-1">No schedule for this week</h3>
            <p className="text-slate-400 text-sm mb-5">Click Auto-Generate to build the schedule automatically.</p>
            <button onClick={generateSchedule} disabled={generating} className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              <Wand2 size={16} /> {generating ? 'Generating…' : 'Auto-Generate Schedule'}
            </button>
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineGrid {...sharedProps} />
        ) : viewMode === 'daily' ? (
          <DailyView
            {...sharedProps}
            day={selectedDay}
            onDayChange={setSelectedDay}
          />
        ) : viewMode === 'grid' ? (
          <WeeklyGrid
            assignments={assignments}
            staff={staff}
            clients={clients}
            onUpdateAssignment={handleUpdateAssignment}
            weekLabel={formatWeekRange(currentMonday)}
          />
        ) : viewMode === 'staff' ? (
          <StaffView staff={staff} assignments={assignments} />
        ) : (
          <ClientView clients={clients} assignments={assignments} />
        )}
      </div>

      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 space-y-4">
        <HourTracker staff={staff} assignments={assignments} />
        <SupervisionTracker staff={staff} />
        <ClientHourTracker clients={clients} assignments={assignments} />

        {schedule && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Schedule Stats</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total sessions</span>
                <span className="font-semibold text-slate-700">{assignments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Unassigned</span>
                <span className={`font-semibold ${unassignedCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{unassignedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Violations</span>
                <span className={`font-semibold ${violationCount > 0 ? 'text-red-600' : 'text-aqua-500'}`}>{violationCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Manual overrides</span>
                <span className="font-semibold text-blue-600">{assignments.filter((a) => a.is_manual_override).length}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                <span className="flex items-center gap-1 text-slate-500">
                  <FileText size={11} />Notes missing
                </span>
                <span className={`font-semibold ${missingNotesCount > 0 ? 'text-amber-600' : 'text-aqua-500'}`}>
                  {missingNotesCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Shift reference */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Shift Reference</h3>
          <div className="space-y-2 text-xs">
            {[
              { label: 'AM Session', time: '8:00 – 10:30 AM', color: 'bg-amber-100 text-amber-700' },
              { label: 'Break', time: '10:00 – 10:30 AM', color: 'bg-rose-100 text-rose-600' },
              { label: 'PM Session', time: '10:30 AM – 2:30 PM', color: 'bg-blue-100 text-blue-700' },
              { label: 'Lunch', time: '12:00 – 12:30 PM', color: 'bg-rose-100 text-rose-600' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.color}`}>{r.label}</span>
                <span className="text-slate-400 text-right">{r.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
