import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Schedule,
  ScheduleAssignment,
  Staff,
  Client,
  StaffClientRestriction,
  SessionNote,
  RatioAlert,
  DayOfWeek,
  AssignmentShift,
  ShiftDefinition,
  BreakTime,
  TimeOff,
  SeasonalPeriod,
  StaffSeasonalAvailability,
  ClientSeasonalAvailability,
} from '../lib/types';
import { computeRatioAlerts } from '../lib/scheduler';
import { SHIFT_TIMES } from '../lib/types';
import { getMonday, format, formatWeekRange } from '../lib/dateUtils';

interface ScheduleContextType {
  currentMonday: Date;
  setCurrentMonday: React.Dispatch<React.SetStateAction<Date>>;
  weekLabel: string;
  staff: Staff[];
  clients: Client[];
  effectiveStaff: Staff[];
  effectiveClients: Client[];
  activeSeason: SeasonalPeriod | null;
  allRestrictions: StaffClientRestriction[];
  schedule: Schedule | null;
  assignments: ScheduleAssignment[];
  sessionNotes: SessionNote[];
  ratioAlerts: RatioAlert[];
  shifts: ShiftDefinition[];
  shiftsForWeek: ShiftDefinition[];
  breakTimes: BreakTime[];
  timeOffForWeek: TimeOff[];
  loading: boolean;
  refreshSchedule: () => Promise<void>;
  refreshShiftsAndBreaks: () => Promise<void>;
  refreshTimeOff: () => Promise<void>;
  refreshSeasonalData: () => Promise<void>;
  setScheduleData: (s: Schedule | null) => void;
  handleUpdateAssignment: (assignmentId: string, staffId: string | null) => Promise<void>;
  handleInsertAssignment: (day: DayOfWeek, shift: AssignmentShift, clientId: string, staffId: string, timeStart?: string, timeEnd?: string) => Promise<void>;
  handleMoveAssignment: (assignmentId: string, newDay: DayOfWeek, newShift: AssignmentShift) => Promise<void>;
  handleDeleteAssignment: (assignmentId: string) => Promise<void>;
  handleUpdateEndTime: (assignmentId: string, newEndTime: string) => Promise<void>;
  handleToggleNote: (assignmentId: string) => Promise<void>;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allRestrictions, setAllRestrictions] = useState<StaffClientRestriction[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [ratioAlerts, setRatioAlerts] = useState<RatioAlert[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [breakTimes, setBreakTimes] = useState<BreakTime[]>([]);
  const [timeOffForWeek, setTimeOffForWeek] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const scheduleRef = useRef<Schedule | null>(null);

  // Seasonal data
  const [seasonalPeriods, setSeasonalPeriods] = useState<SeasonalPeriod[]>([]);
  const [staffSeasonalAvail, setStaffSeasonalAvail] = useState<StaffSeasonalAvailability[]>([]);
  const [clientSeasonalAvail, setClientSeasonalAvail] = useState<ClientSeasonalAvailability[]>([]);

  // The season whose date range overlaps the current week (same logic as shiftsForWeek)
  const activeSeason = useMemo<SeasonalPeriod | null>(() => {
    const mondayStr = format(currentMonday, 'yyyy-MM-dd');
    const weekEnd = new Date(currentMonday);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    return seasonalPeriods.find(p => p.is_active && p.date_start <= weekEndStr && p.date_end >= mondayStr) ?? null;
  }, [seasonalPeriods, currentMonday]);

  // Staff with seasonal availability substituted in when in season
  const effectiveStaff = useMemo<Staff[]>(() => {
    if (!activeSeason) return staff;
    // Compute the latest shift end for this season so we can auto-extend availability
    const seasonEnd = activeSeason.period_type === 'summer' ? '15:30' : '14:30';
    return staff.map(s => {
      const overrides = staffSeasonalAvail.filter(r => r.staff_id === s.id && r.period_id === activeSeason.id);
      if (overrides.length) {
        const base = s.availability ?? [];
        const merged = base.map(a => {
          const ov = overrides.find(r => r.day_of_week === a.day_of_week);
          if (!ov) return a;
          if (!ov.is_available) return null;
          return { ...a, time_start: ov.time_start, time_end: ov.time_end };
        }).filter(Boolean) as typeof base;
        for (const ov of overrides) {
          if (ov.is_available && !base.find(a => a.day_of_week === ov.day_of_week)) {
            merged.push({
              id: `seasonal_${ov.id}`,
              staff_id: s.id,
              day_of_week: ov.day_of_week as DayOfWeek,
              shift: 'FULL',
              time_start: ov.time_start,
              time_end: ov.time_end,
            });
          }
        }
        return { ...s, availability: merged };
      }
      // No overrides: auto-extend PM availability to match seasonal end
      const base = s.availability ?? [];
      const extended = base.map(a => {
        const end = (a.time_end ?? '').slice(0, 5);
        if (end && end >= '14:00' && end <= '14:59') {
          return { ...a, time_end: seasonEnd };
        }
        return a;
      });
      return { ...s, availability: extended };
    });
  }, [staff, activeSeason, staffSeasonalAvail]);

  // Clients with seasonal availability substituted in when in season
  const effectiveClients = useMemo<Client[]>(() => {
    if (!activeSeason) return clients;
    const seasonEnd = activeSeason.period_type === 'summer' ? '15:30' : '14:30';
    return clients.map(c => {
      const overrides = clientSeasonalAvail.filter(r => r.client_id === c.id && r.period_id === activeSeason.id);
      if (overrides.length) {
        const base = c.availability ?? [];
        const merged = base.map(a => {
          const ov = overrides.find(r => r.day_of_week === a.day_of_week);
          if (!ov) return a;
          if (!ov.is_available) return null;
          return { ...a, time_start: ov.time_start, time_end: ov.time_end };
        }).filter(Boolean) as typeof base;
        for (const ov of overrides) {
          if (ov.is_available && !base.find(a => a.day_of_week === ov.day_of_week)) {
            merged.push({
              id: `seasonal_${ov.id}`,
              client_id: c.id,
              day_of_week: ov.day_of_week as DayOfWeek,
              shift: 'FULL',
              time_start: ov.time_start,
              time_end: ov.time_end,
            });
          }
        }
        return { ...c, availability: merged };
      }
      // No overrides: auto-extend PM availability to match seasonal end
      const base = c.availability ?? [];
      const extended = base.map(a => {
        const end = (a.time_end ?? '').slice(0, 5);
        if (end && end >= '14:00' && end <= '14:59') {
          return { ...a, time_end: seasonEnd };
        }
        return a;
      });
      return { ...c, availability: extended };
    });
  }, [clients, activeSeason, clientSeasonalAvail]);

  useEffect(() => { loadBaseData(); }, []);
  useEffect(() => { loadSchedule(); }, [currentMonday]);
  useEffect(() => { loadTimeOff(); }, [currentMonday]);

  useEffect(() => {
    if (staff.length > 0 && clients.length > 0) {
      setRatioAlerts(computeRatioAlerts(staff, clients, allRestrictions, shifts.filter((s) => s.is_active)));
    }
  }, [staff, clients, allRestrictions, shifts]);

  async function loadBaseData() {
    const [staffRes, clientRes, restrictRes, shiftsRes, breaksRes, seasonPeriodsRes, staffSeasonRes, clientSeasonRes] = await Promise.all([
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
      supabase.from('shifts').select('*').order('time_start').order('sort_order'),
      supabase.from('break_times').select('*').order('sort_order'),
      supabase.from('seasonal_periods').select('*').eq('is_active', true).order('date_start'),
      supabase.from('staff_seasonal_availability').select('*'),
      supabase.from('client_seasonal_availability').select('*'),
    ]);
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
    setShifts(shiftsRes.data ?? []);
    setBreakTimes(breaksRes.data ?? []);
    setSeasonalPeriods(seasonPeriodsRes.data ?? []);
    setStaffSeasonalAvail(staffSeasonRes.data ?? []);
    setClientSeasonalAvail(clientSeasonRes.data ?? []);
  }

  async function refreshSeasonalData() {
    const [periodsRes, staffSeasonRes, clientSeasonRes] = await Promise.all([
      supabase.from('seasonal_periods').select('*').eq('is_active', true).order('date_start'),
      supabase.from('staff_seasonal_availability').select('*'),
      supabase.from('client_seasonal_availability').select('*'),
    ]);
    setSeasonalPeriods(periodsRes.data ?? []);
    setStaffSeasonalAvail(staffSeasonRes.data ?? []);
    setClientSeasonalAvail(clientSeasonRes.data ?? []);
  }

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    const weekStr = format(currentMonday, 'yyyy-MM-dd');
    const { data: sched } = await supabase
      .from('schedules')
      .select('*')
      .eq('week_start_date', weekStr)
      .maybeSingle();

    if (sched) {
      setSchedule(sched);
      scheduleRef.current = sched;
      const { data: assignData } = await supabase
        .from('schedule_assignments')
        .select('*, staff(*,staff_availability(*)), client:clients(*,client_attendance(*),client_availability(*))')
        .eq('schedule_id', sched.id);
      const loaded = (assignData ?? []).map((a: any) => ({
        ...a,
        staff: a.staff ? { ...a.staff, availability: a.staff.staff_availability } : undefined,
        client: a.client
          ? { ...a.client, availability: a.client.client_availability, attendance: a.client.client_attendance }
          : undefined,
      }));
      setAssignments(loaded);
      await loadSessionNotes(loaded.map((a: ScheduleAssignment) => a.id));
    } else {
      setSchedule(null);
      scheduleRef.current = null;
      setAssignments([]);
      setSessionNotes([]);
    }
    setLoading(false);
  }, [currentMonday]);

  async function loadSessionNotes(assignmentIds: string[]) {
    if (!assignmentIds.length) { setSessionNotes([]); return; }
    const { data } = await supabase
      .from('session_notes')
      .select('*')
      .in('assignment_id', assignmentIds);
    setSessionNotes(data ?? []);
  }

  // Re-fetches assignments from DB without triggering the loading spinner.
  // Called after every manual mutation so all views immediately see DB truth.
  async function silentReloadAssignments() {
    const sched = scheduleRef.current;
    if (!sched) return;
    const { data: assignData } = await supabase
      .from('schedule_assignments')
      .select('*, staff(*,staff_availability(*)), client:clients(*,client_attendance(*),client_availability(*))')
      .eq('schedule_id', sched.id);
    const loaded = (assignData ?? []).map((a: any) => ({
      ...a,
      staff: a.staff ? { ...a.staff, availability: a.staff.staff_availability } : undefined,
      client: a.client
        ? { ...a.client, availability: a.client.client_availability, attendance: a.client.client_attendance }
        : undefined,
    }));
    setAssignments(loaded);
    await loadSessionNotes(loaded.map((a: ScheduleAssignment) => a.id));
  }

  async function refreshShiftsAndBreaks() {
    const [shiftsRes, breaksRes] = await Promise.all([
      supabase.from('shifts').select('*').order('time_start').order('sort_order'),
      supabase.from('break_times').select('*').order('sort_order'),
    ]);
    setShifts(shiftsRes.data ?? []);
    setBreakTimes(breaksRes.data ?? []);
  }

  const loadTimeOff = useCallback(async () => {
    const weekStr = format(currentMonday, 'yyyy-MM-dd');
    const weekEnd = new Date(currentMonday);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('time_off')
      .select('*')
      .lte('date_start', weekEndStr)
      .gte('date_end', weekStr);
    setTimeOffForWeek(data ?? []);
  }, [currentMonday]);

  async function refreshTimeOff() {
    await loadTimeOff();
  }

  async function handleUpdateAssignment(assignmentId: string, staffId: string | null) {
    await supabase
      .from('schedule_assignments')
      .update({ staff_id: staffId, is_manual_override: true, violation_reason: null })
      .eq('id', assignmentId);
    await silentReloadAssignments();
  }

  async function handleInsertAssignment(day: DayOfWeek, shift: AssignmentShift, clientId: string, staffId: string, timeStart?: string, timeEnd?: string) {
    const sched = scheduleRef.current;
    if (!sched) return;
    const times = SHIFT_TIMES[shift];
    const { error } = await supabase
      .from('schedule_assignments')
      .insert({
        schedule_id: sched.id,
        day_of_week: day,
        shift,
        time_start: timeStart ?? times?.start,
        time_end: timeEnd ?? times?.end,
        staff_id: staffId,
        client_id: clientId,
        is_manual_override: true,
        violation_reason: null,
      });
    if (error) {
      console.error('Insert assignment error:', error);
      return;
    }
    await silentReloadAssignments();
  }

  async function handleMoveAssignment(assignmentId: string, newDay: DayOfWeek, newShift: AssignmentShift) {
    await supabase
      .from('schedule_assignments')
      .update({ day_of_week: newDay, shift: newShift, is_manual_override: true, violation_reason: null })
      .eq('id', assignmentId);
    await silentReloadAssignments();
  }

  async function handleDeleteAssignment(assignmentId: string) {
    await supabase.from('schedule_assignments').delete().eq('id', assignmentId);
    await silentReloadAssignments();
  }

  async function handleUpdateEndTime(assignmentId: string, newEndTime: string) {
    await supabase
      .from('schedule_assignments')
      .update({ time_end: newEndTime, is_manual_override: true })
      .eq('id', assignmentId);
    await silentReloadAssignments();
  }

  async function handleToggleNote(assignmentId: string) {
    const existing = sessionNotes.find((n) => n.assignment_id === assignmentId);
    if (existing) {
      await supabase
        .from('session_notes')
        .update({
          submitted: !existing.submitted,
          submitted_at: !existing.submitted ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('session_notes')
        .insert({ assignment_id: assignmentId, submitted: true, submitted_at: new Date().toISOString() });
    }
    await loadSessionNotes(assignments.map((a) => a.id));
  }

  return (
    <ScheduleContext.Provider
      value={{
        currentMonday,
        setCurrentMonday,
        weekLabel: formatWeekRange(currentMonday),
        staff,
        clients,
        allRestrictions,
        schedule,
        assignments,
        sessionNotes,
        ratioAlerts,
        shifts,
        shiftsForWeek: (() => {
          const mondayStr = format(currentMonday, 'yyyy-MM-dd');
          const weekEnd = new Date(currentMonday);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
          const activeShifts = shifts.filter((s) => s.is_active);
          // Collect all days covered by seasonal (date-ranged) shifts active this week
          const seasonalDays = new Set<number>(
            activeShifts
              .filter((s) => s.date_start && s.date_end && s.date_start <= weekEndStr && s.date_end >= mondayStr)
              .flatMap((s) => s.days)
          );
          return activeShifts.filter((s) => {
            if (s.date_start && s.date_end) {
              return s.date_start <= weekEndStr && s.date_end >= mondayStr;
            }
            // Exclude non-seasonal shift if all its days are covered by seasonal shifts
            if (seasonalDays.size > 0 && s.days.every((d) => seasonalDays.has(d))) return false;
            return true;
          }).sort((a, b) => a.time_start.localeCompare(b.time_start));
        })(),
        breakTimes,
        timeOffForWeek,
        loading,
        refreshSchedule: loadSchedule,
        refreshShiftsAndBreaks,
        refreshTimeOff,
        refreshSeasonalData,
        effectiveStaff,
        effectiveClients,
        activeSeason,
        setScheduleData: setSchedule,
        handleUpdateAssignment,
        handleInsertAssignment,
        handleMoveAssignment,
        handleDeleteAssignment,
        handleUpdateEndTime,
        handleToggleNote,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
