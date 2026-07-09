import React, { useState, useMemo } from 'react';
import type {
  ScheduleAssignment,
  Staff,
  Client,
  DayOfWeek,
  AssignmentShift,
  ShiftDefinition,
  BreakTime,
  TimeOff,
} from '../../lib/types';
import { DAY_NAMES, TIME_SLOTS, formatTime, timeWindowCovers } from '../../lib/types';
import { X, GripVertical, Users, ChevronDown, CalendarOff, AlertCircle, CheckCircle2, Clock, Ban } from 'lucide-react';

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHex(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${Math.floor(r * 0.45)},${Math.floor(g * 0.45)},${Math.floor(b * 0.45)})`;
}

interface ManualBuilderViewProps {
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  shifts: ShiftDefinition[];
  breakTimes: BreakTime[];
  timeOff?: TimeOff[];
  currentMonday?: Date;
  onInsert: (day: DayOfWeek, shift: AssignmentShift, clientId: string, staffId: string, timeStart: string, timeEnd: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateStaff: (id: string, staffId: string | null) => Promise<void>;
}

function addThirtyMin(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function ManualBuilderView({
  assignments,
  staff,
  clients,
  shifts,
  breakTimes,
  timeOff = [],
  currentMonday,
  onInsert,
  onDelete,
  onUpdateStaff,
}: ManualBuilderViewProps) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [draggingClientId, setDraggingClientId] = useState<string | null>(null);
  const [draggingAssignmentId, setDraggingAssignmentId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [clientPanelOpen, setClientPanelOpen] = useState(true);

  // Compute date string for any day-of-week in the current week
  function dayToDate(day: DayOfWeek): string {
    if (!currentMonday) return '';
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + (day - 1));
    return d.toISOString().slice(0, 10);
  }

  function isStaffOffOnDay(staffId: string, day: DayOfWeek): TimeOff | null {
    const dateStr = dayToDate(day);
    if (!dateStr) return null;
    return timeOff.find((t) => t.staff_id === staffId && t.date_start <= dateStr && t.date_end >= dateStr) ?? null;
  }

  function isClientOffOnDay(clientId: string, day: DayOfWeek): TimeOff | null {
    const dateStr = dayToDate(day);
    if (!dateStr) return null;
    return timeOff.find((t) => t.client_id === clientId && t.date_start <= dateStr && t.date_end >= dateStr) ?? null;
  }

  // ── Client scheduling status ─────────────────────────────────────────────

  type ClientDayStatus =
    | { type: 'unscheduled'; total: number }
    | { type: 'partial'; covered: number; total: number }
    | { type: 'scheduled'; total: number }
    | { type: 'off'; reason: string }
    | { type: 'unavailable'; reason: string };

  function clientIsAvailableForShift(c: Client, shiftDef: ShiftDefinition): boolean {
    const avail = c.availability ?? [];
    const shiftStart = shiftDef.time_start.slice(0, 5);
    const dayAvail = avail.filter((a) => a.day_of_week === selectedDay);

    if (dayAvail.length > 0) {
      return dayAvail.some((a) => {
        const aStart = a.time_start?.slice(0, 5) ?? '';
        const aEnd = a.time_end?.slice(0, 5) ?? '';
        if (aStart && aEnd) return aStart <= shiftStart && aEnd > shiftStart;
        return true; // shift-level record with no explicit times = available all day
      });
    }

    // No records for this day specifically
    if (avail.length > 0) return false; // has records for other days

    // No availability records at all — fall back to program_type + attendance
    const isEveShift = shiftStart >= '15:00';
    if (c.program_type === 'daytime' && isEveShift) return false;
    if (c.program_type === 'afterschool' && !isEveShift) return false;
    if (selectedDay === 6) return false;
    return (c.attendance ?? []).some((a) => a.day_of_week === selectedDay);
  }

  function clientPassesRulesForShift(c: Client, shiftDef: ShiftDefinition): boolean {
    const rules = c.scheduling_rules ?? [];
    if (!rules.length) return true;
    const shiftStart = shiftDef.time_start.slice(0, 5);
    const isMorning = shiftStart < '12:00';
    const isAfternoon = shiftStart >= '10:30' && shiftStart < '15:00';
    const isEve = shiftStart >= '15:00';
    for (const rule of rules) {
      if (rule === 'No AM sessions' && isMorning) return false;
      if (rule === 'No PM sessions' && isAfternoon) return false;
      if (rule === 'No After School sessions' && isEve) return false;
      if ((rule === 'No Saturday sessions' || rule === 'Weekdays only') && selectedDay === 6) return false;
      if (rule === 'Morning sessions only' && !isMorning) return false;
      if (rule === 'Afternoon sessions only' && !isAfternoon) return false;
    }
    return true;
  }

  function getClientDayStatus(c: Client): ClientDayStatus {
    const off = isClientOffOnDay(c.id, selectedDay);
    if (off) return { type: 'off', reason: off.reason || 'Time off' };

    const attendableShifts = dayShifts.filter(
      (sh) => clientIsAvailableForShift(c, sh) && clientPassesRulesForShift(c, sh)
    );

    if (attendableShifts.length === 0) {
      const avail = c.availability ?? [];
      const attendance = c.attendance ?? [];
      const dayAvail = avail.filter((a) => a.day_of_week === selectedDay);

      if (avail.length === 0 && attendance.length === 0) {
        return { type: 'unavailable', reason: 'No schedule set' };
      }
      if (avail.length === 0 && !attendance.some((a) => a.day_of_week === selectedDay)) {
        return { type: 'unavailable', reason: 'Not attending today' };
      }
      if (avail.length > 0 && dayAvail.length === 0) {
        return { type: 'unavailable', reason: 'Not available today' };
      }

      const isEveOnly = dayShifts.every((sh) => sh.time_start.slice(0, 5) >= '15:00');
      const isDayOnly = dayShifts.every((sh) => sh.time_start.slice(0, 5) < '15:00');
      if (c.program_type === 'afterschool' && isDayOnly) return { type: 'unavailable', reason: 'Afterschool program' };
      if (c.program_type === 'daytime' && isEveOnly) return { type: 'unavailable', reason: 'Daytime program' };

      // Find which scheduling rule is blocking all shifts
      const blockingRule = (c.scheduling_rules ?? []).find((rule) =>
        dayShifts.every((sh) => {
          const s = sh.time_start.slice(0, 5);
          const isMorn = s < '12:00', isAft = s >= '10:30' && s < '15:00', isEv = s >= '15:00';
          if (rule === 'No AM sessions' && isMorn) return true;
          if (rule === 'No PM sessions' && isAft) return true;
          if (rule === 'No After School sessions' && isEv) return true;
          if ((rule === 'No Saturday sessions' || rule === 'Weekdays only') && selectedDay === 6) return true;
          if (rule === 'Morning sessions only' && !isMorn) return true;
          if (rule === 'Afternoon sessions only' && !isAft) return true;
          return false;
        })
      );
      if (blockingRule) return { type: 'unavailable', reason: blockingRule };

      return { type: 'unavailable', reason: 'Not available' };
    }

    const dayAssigns = clientDayAssignments(c.id);
    const covered = attendableShifts.filter((sh) =>
      dayAssigns.some((a) => {
        const aStart = a.time_start?.slice(0, 5) ?? '';
        const aEnd = a.time_end?.slice(0, 5) ?? '';
        return timeWindowCovers(aStart, aEnd, sh.time_start.slice(0, 5), sh.time_end.slice(0, 5));
      })
    ).length;

    if (covered === attendableShifts.length) return { type: 'scheduled', total: covered };
    if (covered > 0) return { type: 'partial', covered, total: attendableShifts.length };
    return { type: 'unscheduled', total: attendableShifts.length };
  }

  const visibleDays = useMemo(() => {
    const daySet = new Set<DayOfWeek>();
    shifts.filter((s) => s.is_active).forEach((s) => s.days.forEach((d) => daySet.add(d as DayOfWeek)));
    return ([1, 2, 3, 4, 5, 6] as DayOfWeek[]).filter((d) => daySet.has(d));
  }, [shifts]);

  const dayShifts = useMemo(() =>
    shifts
      .filter((s) => s.is_active && s.days.includes(selectedDay))
      .sort((a, b) => a.time_start.localeCompare(b.time_start)),
    [shifts, selectedDay]
  );

  const dayBreaks = useMemo(() =>
    breakTimes.filter((b) => b.is_active && (b.days.length === 0 || b.days.includes(selectedDay))),
    [breakTimes, selectedDay]
  );

  const allSlots = useMemo(() => {
    const times = new Set<string>();
    dayShifts.forEach((sh) => {
      TIME_SLOTS.filter((t) => t >= sh.time_start.slice(0, 5) && t < sh.time_end.slice(0, 5))
        .forEach((t) => times.add(t));
    });
    return [...times].sort();
  }, [dayShifts]);

  // Staff active and available on this day (has any availability window for this day)
  const dayStaff = useMemo(() =>
    staff.filter((s) => {
      if (!s.is_active) return false;
      return (s.availability ?? []).some((a) => a.day_of_week === selectedDay);
    }),
    [staff, selectedDay]
  );

  const activeClients = clients.filter((c) => c.is_active);

  function isBreakSlot(slotStart: string): string | null {
    const slotEnd = addThirtyMin(slotStart);
    for (const b of dayBreaks) {
      if (b.time_start.slice(0, 5) <= slotStart && b.time_end.slice(0, 5) >= slotEnd) return b.name;
    }
    return null;
  }

  function getShiftForSlot(slotStart: string): ShiftDefinition | null {
    return dayShifts.find((sh) =>
      slotStart >= sh.time_start.slice(0, 5) && slotStart < sh.time_end.slice(0, 5)
    ) ?? null;
  }

  // Does this staff have an assignment covering this slot on the selected day?
  function getAssignmentAtCell(staffId: string, slotStart: string): ScheduleAssignment | null {
    const slotEnd = addThirtyMin(slotStart);
    return assignments.find((a) => {
      if (a.day_of_week !== selectedDay || a.staff_id !== staffId) return false;
      const aStart = a.time_start?.slice(0, 5) ?? '';
      const aEnd = a.time_end?.slice(0, 5) ?? '';
      return aStart <= slotStart && aEnd >= slotEnd;
    }) ?? null;
  }

  function isAssignmentStartSlot(staffId: string, slotStart: string): boolean {
    return assignments.some(
      (a) => a.day_of_week === selectedDay && a.staff_id === staffId && a.time_start?.slice(0, 5) === slotStart
    );
  }

  // All shifts assigned to a client on this day
  function clientDayAssignments(clientId: string): ScheduleAssignment[] {
    return assignments.filter((a) => a.day_of_week === selectedDay && a.client_id === clientId);
  }

  // Find an existing assignment for this client on this shift (any staff)
  function clientShiftAssignment(clientId: string, shiftDef: ShiftDefinition): ScheduleAssignment | null {
    return assignments.find((a) => {
      if (a.day_of_week !== selectedDay || a.client_id !== clientId) return false;
      const aStart = a.time_start?.slice(0, 5) ?? '';
      const aEnd = a.time_end?.slice(0, 5) ?? '';
      return aStart === shiftDef.time_start.slice(0, 5) && aEnd === shiftDef.time_end.slice(0, 5);
    }) ?? null;
  }

  async function handleDrop(e: React.DragEvent, staffId: string, slotStart: string) {
    e.preventDefault();
    const clientId = e.dataTransfer.getData('application/x-client-id');
    const assignId = e.dataTransfer.getData('application/x-assignment-id');
    setDragOver(null);

    const shiftDef = getShiftForSlot(slotStart);
    if (!shiftDef || isBreakSlot(slotStart)) {
      setDraggingClientId(null);
      setDraggingAssignmentId(null);
      return;
    }

    // Check cell is not already occupied by a DIFFERENT client
    const occupied = getAssignmentAtCell(staffId, slotStart);

    if (clientId) {
      // If this client already has an assignment for this shift, reassign staff instead of inserting
      const existingForClient = clientShiftAssignment(clientId, shiftDef);
      if (existingForClient && existingForClient.staff_id !== staffId) {
        // Move existing assignment to new staff (and cell must not be occupied by a different client)
        if (!occupied || occupied.id === existingForClient.id) {
          setSaving(existingForClient.id);
          await onUpdateStaff(existingForClient.id, staffId);
          setSaving(null);
        }
      } else if (!existingForClient && !occupied) {
        // New assignment
        const key = `${staffId}-${slotStart}`;
        setSaving(key);
        await onInsert(
          selectedDay,
          shiftDef.name as AssignmentShift,
          clientId,
          staffId,
          shiftDef.time_start.slice(0, 5),
          shiftDef.time_end.slice(0, 5)
        );
        setSaving(null);
      }
    } else if (assignId && assignId !== (occupied?.id ?? '')) {
      setSaving(assignId);
      await onUpdateStaff(assignId, staffId);
      setSaving(null);
    }

    setDraggingClientId(null);
    setDraggingAssignmentId(null);
  }

  const shiftBoundaries = useMemo(() => {
    const starts = new Set(dayShifts.map((s) => s.time_start.slice(0, 5)));
    return starts;
  }, [dayShifts]);

  if (!visibleDays.length) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No active shifts configured. Click "Shifts" to set up your schedule.
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Client palette sidebar */}
      <div className="w-52 flex-shrink-0">
        <button
          onClick={() => setClientPanelOpen((p) => !p)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-2 w-full"
        >
          <Users size={13} />
          <span className="flex-1 text-left">Clients</span>
          <ChevronDown size={12} className={`transition-transform ${clientPanelOpen ? '' : '-rotate-90'}`} />
        </button>

        {clientPanelOpen && (() => {
          const statusedClients = activeClients.map((c) => ({
            client: c,
            status: getClientDayStatus(c),
          }));

          const statusOrder: Record<string, number> = {
            unscheduled: 0, partial: 1, scheduled: 2, off: 3, unavailable: 4,
          };
          const sorted = [...statusedClients].sort(
            (a, b) => (statusOrder[a.status.type] ?? 5) - (statusOrder[b.status.type] ?? 5)
          );

          const mustScheduleCount = statusedClients.filter(
            (cs) => cs.status.type === 'unscheduled' || cs.status.type === 'partial'
          ).length;

          return (
            <div className="space-y-1.5">
              {/* Alert banner */}
              {mustScheduleCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg mb-2">
                  <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-red-700 leading-tight">
                    {mustScheduleCount} client{mustScheduleCount !== 1 ? 's' : ''} need{mustScheduleCount === 1 ? 's' : ''} scheduling
                  </span>
                </div>
              )}

              {sorted.map(({ client: c, status }) => {
                const isDraggable = status.type !== 'off' && status.type !== 'unavailable';
                const isBeingDragged = draggingClientId === c.id;

                const cardClass = (() => {
                  if (status.type === 'unscheduled') return 'bg-red-50 border-red-300 text-red-900 border-l-[3px] border-l-red-500';
                  if (status.type === 'partial') return 'bg-orange-50 border-orange-200 text-orange-900 border-l-[3px] border-l-orange-400';
                  if (status.type === 'scheduled') return 'bg-teal-50 border-teal-200 text-teal-800';
                  if (status.type === 'off') return 'bg-amber-50 border-amber-200 text-amber-700';
                  return 'bg-slate-50 border-slate-100 text-slate-400';
                })();

                const cursorClass = !isDraggable
                  ? 'cursor-default'
                  : isBeingDragged
                  ? 'cursor-grabbing opacity-40'
                  : 'cursor-grab';

                return (
                  <div
                    key={c.id}
                    draggable={isDraggable}
                    onDragStart={(e) => {
                      if (!isDraggable) return;
                      setDraggingClientId(c.id);
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('application/x-client-id', c.id);
                    }}
                    onDragEnd={() => { setDraggingClientId(null); setDragOver(null); }}
                    className={`flex items-start gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors select-none ${cardClass} ${cursorClass}`}
                  >
                    {/* Status icon */}
                    <div className="mt-0.5 flex-shrink-0">
                      {status.type === 'unscheduled' && <AlertCircle size={11} className="text-red-500" />}
                      {status.type === 'partial' && <Clock size={11} className="text-orange-500" />}
                      {status.type === 'scheduled' && <CheckCircle2 size={11} className="text-teal-500" />}
                      {status.type === 'off' && <CalendarOff size={11} className="text-amber-500" />}
                      {status.type === 'unavailable' && <Ban size={11} className="text-slate-300" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.color || '#0ea5e9', opacity: status.type === 'unavailable' ? 0.35 : 1 }}
                        />
                        <span className="truncate font-semibold leading-tight">
                          {c.first_name} {c.last_name}
                        </span>
                      </div>

                      {/* Status line */}
                      <div className="mt-0.5 text-[10px] leading-tight">
                        {status.type === 'unscheduled' && (
                          <span className="text-red-600 font-semibold">
                            Must schedule · {status.total} shift{status.total !== 1 ? 's' : ''}
                          </span>
                        )}
                        {status.type === 'partial' && (
                          <span className="text-orange-600 font-semibold">
                            {status.covered}/{status.total} shifts assigned
                          </span>
                        )}
                        {status.type === 'scheduled' && (
                          <span className="text-teal-600">
                            All {status.total} shift{status.total !== 1 ? 's' : ''} covered
                          </span>
                        )}
                        {status.type === 'off' && (
                          <span className="text-amber-600 truncate block">{status.reason}</span>
                        )}
                        {status.type === 'unavailable' && (
                          <span className="text-slate-400 truncate block">{status.reason}</span>
                        )}
                      </div>
                    </div>

                    {isDraggable && !isBeingDragged && (
                      <GripVertical size={10} className="text-slate-300 flex-shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}

              <p className="text-[10px] text-slate-400 mt-2 px-1 leading-relaxed">
                Drag a client card to a staff column to assign
              </p>
            </div>
          );
        })()}
      </div>

      {/* Main grid */}
      <div className="flex-1 min-w-0">
        {/* Day tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {visibleDays.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                selectedDay === d
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {DAY_NAMES[d]}
            </button>
          ))}
        </div>

        {dayStaff.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            No staff available on {DAY_NAMES[selectedDay]}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${80 + dayStaff.length * 140}px` }}>
              {/* Header: time + staff columns */}
              <div
                className="grid bg-slate-800 text-white text-xs font-semibold rounded-t-xl sticky top-0 z-10"
                style={{ gridTemplateColumns: `64px repeat(${dayStaff.length}, 1fr)` }}
              >
                <div className="px-2 py-3 text-slate-400 text-[10px] uppercase tracking-wide">Time</div>
                {dayStaff.map((s) => {
                  const dayHours = assignments
                    .filter((a) => a.day_of_week === selectedDay && a.staff_id === s.id)
                    .reduce((sum, a) => {
                      if (a.time_start && a.time_end) {
                        const [sh, sm] = a.time_start.slice(0, 5).split(':').map(Number);
                        const [eh, em] = a.time_end.slice(0, 5).split(':').map(Number);
                        return sum + (eh * 60 + em - sh * 60 - sm) / 60;
                      }
                      return sum;
                    }, 0);
                  const offEntry = isStaffOffOnDay(s.id, selectedDay);
                  return (
                    <div key={s.id} className={`px-2 py-2 border-l border-slate-700 text-center ${offEntry ? 'bg-amber-900/30' : ''}`}>
                      <div className="truncate font-semibold flex items-center justify-center gap-1">
                        {offEntry && <CalendarOff size={10} className="text-amber-400 flex-shrink-0" />}
                        {s.name}
                      </div>
                      {offEntry ? (
                        <div className="text-amber-400 text-[10px] font-normal mt-0.5 truncate">
                          Time Off{offEntry.reason ? ` · ${offEntry.reason}` : ''}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px] font-normal mt-0.5">T{s.priority_tier} · {dayHours.toFixed(1)}h</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              {allSlots.map((slotStart, idx) => {
                const breakLabel = isBreakSlot(slotStart);
                const isShiftStart = shiftBoundaries.has(slotStart);
                const shiftDef = getShiftForSlot(slotStart);

                return (
                  <React.Fragment key={slotStart}>
                    {/* Shift section header */}
                    {isShiftStart && shiftDef && (
                      <div
                        className="text-white text-[11px] font-bold px-3 py-1.5 flex items-center gap-2"
                        style={{ background: shiftDef.color, gridColumn: `1 / -1` }}
                      >
                        <span>{shiftDef.label}</span>
                        <span className="opacity-70 font-normal">{shiftDef.time_start.slice(0, 5)} – {shiftDef.time_end.slice(0, 5)}</span>
                      </div>
                    )}

                    <div
                      className={`grid border-b border-slate-100 ${breakLabel ? 'bg-rose-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      style={{ gridTemplateColumns: `64px repeat(${dayStaff.length}, 1fr)` }}
                    >
                      {/* Time label */}
                      <div className={`px-2 py-1.5 border-r border-slate-100 flex flex-col justify-center ${breakLabel ? 'border-rose-200' : ''}`}>
                        <span className={`text-[11px] font-semibold ${breakLabel ? 'text-rose-500' : 'text-slate-500'}`}>
                          {formatTime(slotStart)}
                        </span>
                      </div>

                      {/* Staff cells */}
                      {dayStaff.map((s) => {
                        if (breakLabel) {
                          return (
                            <div key={s.id} className="px-2 py-1.5 border-l border-rose-100">
                              <div className="h-4 rounded bg-rose-200/40" />
                            </div>
                          );
                        }

                        const staffOff = isStaffOffOnDay(s.id, selectedDay);
                        if (staffOff) {
                          return (
                            <div key={s.id} className="px-1.5 py-1 border-l border-amber-100 bg-amber-50/60 min-h-[32px] flex items-center justify-center">
                              {idx === allSlots.indexOf(dayShifts[0]?.time_start.slice(0, 5) ?? '') ? (
                                <span className="text-[10px] text-amber-500 font-medium flex items-center gap-0.5">
                                  <CalendarOff size={9} /> Off
                                </span>
                              ) : null}
                            </div>
                          );
                        }

                        const existing = getAssignmentAtCell(s.id, slotStart);
                        const isStart = isAssignmentStartSlot(s.id, slotStart);
                        const cellKey = `${s.id}-${slotStart}`;
                        const isDragTarget = dragOver === cellKey;
                        const isSaving = saving === cellKey || saving === existing?.id;

                        return (
                          <div
                            key={s.id}
                            className={`px-1.5 py-1 border-l border-slate-100 min-h-[32px] transition-all ${
                              isDragTarget && !existing
                                ? 'bg-aqua-50 ring-2 ring-inset ring-aqua-400 rounded'
                                : ''
                            }`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'copy';
                              setDragOver(cellKey);
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOver(null);
                              }
                            }}
                            onDrop={(e) => handleDrop(e, s.id, slotStart)}
                          >
                            {existing && isStart ? (
                              <div
                                draggable
                                onDragStart={(e) => {
                                  setDraggingAssignmentId(existing.id);
                                  setDraggingClientId(existing.client_id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('application/x-assignment-id', existing.id);
                                  e.dataTransfer.setData('application/x-client-id', existing.client_id);
                                }}
                                onDragEnd={() => { setDraggingAssignmentId(null); setDraggingClientId(null); setDragOver(null); }}
                                className={`group relative rounded-lg px-2 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing transition-opacity ${
                                  isSaving ? 'opacity-50' : 'opacity-100'
                                }`}
                                style={(() => {
                                  if (existing.violation_reason) return { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' };
                                  if (!existing.staff_id) return { backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309' };
                                  const cl = clients.find((c) => c.id === existing.client_id);
                                  const col = cl?.color || '#0ea5e9';
                                  return {
                                    backgroundColor: hexToRgba(col, 0.15),
                                    border: `1px solid ${hexToRgba(col, 0.45)}`,
                                    color: darkenHex(col),
                                  };
                                })()}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate leading-tight">
                                      {(() => {
                                        const c = clients.find((cl) => cl.id === existing.client_id);
                                        return c ? `${c.first_name} ${c.last_name}` : 'Client';
                                      })()}
                                    </div>
                                    <div className="text-[10px] opacity-70">
                                      {existing.time_start?.slice(0, 5)}–{existing.time_end?.slice(0, 5)}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(existing.id); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-red-600 flex-shrink-0 mt-0.5"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              </div>
                            ) : existing && !isStart ? (
                              // Continuation block
                              <div
                                className="rounded h-4 opacity-30"
                                style={{
                                  backgroundColor: existing.violation_reason
                                    ? '#fca5a5'
                                    : clients.find((c) => c.id === existing.client_id)?.color || '#0ea5e9',
                                }}
                              />
                            ) : isDragTarget ? (
                              <div className="flex items-center justify-center h-6 text-aqua-400 text-[10px] font-medium">
                                drop here
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Legend */}
              <div className="rounded-b-xl border border-t-0 border-slate-200 px-4 py-3 bg-white flex gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.45)' }} /> Client color = assigned
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Unassigned
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Violation
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-rose-200" /> Break
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <GripVertical size={12} /> Drag to move assignment
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  Hover card → × to remove
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
