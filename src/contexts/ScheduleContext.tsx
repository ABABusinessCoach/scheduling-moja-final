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
} from '../lib/types';
import { computeRatioAlerts } from '../lib/scheduler';
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
  loading: boolean;
  refreshSchedule: () => Promise<void>;
  setScheduleData: (s: Schedule | null) => void;
  handleUpdateAssignment: (assignmentId: string, staffId: string | null) => Promise<void>;
  handleMoveAssignment: (assignmentId: string, newDay: DayOfWeek, newShift: AssignmentShift) => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBaseData(); }, []);

  useEffect(() => { loadSchedule(); }, [currentMonday]);

  useEffect(() => {
    if (staff.length > 0 && clients.length > 0) {
      setRatioAlerts(computeRatioAlerts(staff, clients, allRestrictions));
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
        staff: a.staff
          ? { ...a.staff, availability: a.staff.staff_availability }
          : undefined,
        client: a.client
          ? {
              ...a.client,
              availability: a.client.client_availability,
              attendance: a.client.client_attendance,
            }
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
    if (!assignmentIds.length) {
      setSessionNotes([]);
      return;
    }
    const { data } = await supabase
      .from('session_notes')
      .select('*')
      .in('assignment_id', assignmentIds);
    setSessionNotes(data ?? []);
  }

  async function handleUpdateAssignment(assignmentId: string, staffId: string | null) {
    await supabase
      .from('schedule_assignments')
      .update({ staff_id: staffId, is_manual_override: true, violation_reason: null })
      .eq('id', assignmentId);
    await loadSchedule();
  }

  async function handleMoveAssignment(
    assignmentId: string,
    newDay: DayOfWeek,
    newShift: AssignmentShift
  ) {
    await supabase
      .from('schedule_assignments')
      .update({
        day_of_week: newDay,
        shift: newShift,
        is_manual_override: true,
        violation_reason: null,
      })
      .eq('id', assignmentId);
    await loadSchedule();
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
        loading,
        refreshSchedule: loadSchedule,
        setScheduleData: setSchedule,
        handleUpdateAssignment,
        handleMoveAssignment,
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
