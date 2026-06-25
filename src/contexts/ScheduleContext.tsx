import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  useEffect(() => { loadBaseData(); }, []);
  useEffect(() => { loadSchedule(); }, [currentMonday]);
  useEffect(() => { loadTimeOff(); }, [currentMonday]);

  useEffect(() => {
    if (staff.length > 0 && clients.length > 0) {
      setRatioAlerts(computeRatioAlerts(staff, clients, allRestrictions, shifts.filter((s) => s.is_active)));
    }
  }, [staff, clients, allRestrictions, shifts]);

  async function loadBaseData() {
    const [staffRes, clientRes, restrictRes, shiftsRes, breaksRes] = await Promise.all([
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
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId ? { ...a, staff_id: staffId, is_manual_override: true, violation_reason: null } : a
      )
    );
  }

  async function handleInsertAssignment(day: DayOfWeek, shift: AssignmentShift, clientId: string, staffId: string, timeStart?: string, timeEnd?: string) {
    if (!schedule) return;
    const times = SHIFT_TIMES[shift];
    const { data } = await supabase
      .from('schedule_assignments')
      .insert({
        schedule_id: schedule.id,
        day_of_week: day,
        shift,
        time_start: timeStart ?? times.start,
        time_end: timeEnd ?? times.end,
        staff_id: staffId,
        client_id: clientId,
        is_manual_override: true,
        violation_reason: null,
      })
      .select('*, staff(*,staff_availability(*)), client:clients(*,client_attendance(*),client_availability(*))')
      .single();
    if (data) {
      const mapped = {
        ...data,
        staff: data.staff ? { ...data.staff, availability: data.staff.staff_availability } : undefined,
        client: data.client
          ? { ...data.client, availability: data.client.client_availability, attendance: data.client.client_attendance }
          : undefined,
      };
      setAssignments((prev) => [...prev, mapped]);
    }
  }

  async function handleMoveAssignment(assignmentId: string, newDay: DayOfWeek, newShift: AssignmentShift) {
    await supabase
      .from('schedule_assignments')
      .update({ day_of_week: newDay, shift: newShift, is_manual_override: true, violation_reason: null })
      .eq('id', assignmentId);
    await loadSchedule();
  }

  async function handleDeleteAssignment(assignmentId: string) {
    await supabase.from('schedule_assignments').delete().eq('id', assignmentId);
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    setSessionNotes((prev) => prev.filter((n) => n.assignment_id !== assignmentId));
  }

  async function handleUpdateEndTime(assignmentId: string, newEndTime: string) {
    await supabase
      .from('schedule_assignments')
      .update({ time_end: newEndTime, is_manual_override: true })
      .eq('id', assignmentId);
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, time_end: newEndTime, is_manual_override: true } : a))
    );
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
