import React from 'react';
import type {
  ScheduleAssignment,
  Staff,
  Client,
  DayOfWeek,
  AssignmentShift,
  SessionNote,
  BreakTime,
} from '../../lib/types';
import {
  DAY_NAMES,
  DAY_SHORT,
  formatTime,
  timeWindowCovers,
  SHIFT_TIMES,
} from '../../lib/types';
import { AlertTriangle, FileText, CheckCircle2, Clock } from 'lucide-react';

interface DailyViewProps {
  day: DayOfWeek;
  onDayChange: (d: DayOfWeek) => void;
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  sessionNotes: SessionNote[];
  breakTimes?: BreakTime[];
  onUpdateAssignment: (id: string, staffId: string | null) => void;
  onMoveAssignment: (id: string, day: DayOfWeek, shift: AssignmentShift) => void;
  onDeleteAssignment?: (id: string) => void;
  onUpdateEndTime?: (id: string, newEndTime: string) => void;
  onToggleNote: (assignmentId: string) => void;
}

const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];

function slotShift(s: string): AssignmentShift | null {
  if (s >= '08:00' && s < '10:30') return 'AM';
  if (s >= '10:30' && s < '14:30') return 'PM';
  if (s >= '15:00' && s < '18:00') return 'EVE';
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getClientAssignment(
  assignments: ScheduleAssignment[],
  day: DayOfWeek,
  clientId: string,
  staffId: string
): ScheduleAssignment | undefined {
  return assignments.find(
    (a) => a.day_of_week === day && a.client_id === clientId && a.staff_id === staffId
  );
}

function getClientAssignmentForDay(
  assignments: ScheduleAssignment[],
  day: DayOfWeek,
  clientId: string
): ScheduleAssignment | undefined {
  return assignments.find((a) => a.day_of_week === day && a.client_id === clientId);
}

export function DailyView({
  day,
  onDayChange,
  assignments,
  staff,
  clients,
  sessionNotes,
  breakTimes = [],
  onUpdateAssignment,
  onMoveAssignment,
  onDeleteAssignment,
  onToggleNote,
}: DailyViewProps) {
  const [editingCell, setEditingCell] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!editingCell) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditingCell(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editingCell]);

  const noteByAssignment = React.useMemo(() => {
    const map = new Map<string, SessionNote>();
    sessionNotes.forEach((n) => map.set(n.assignment_id, n));
    return map;
  }, [sessionNotes]);

  const dayClients = clients.filter((c) => {
    if (!c.is_active) return false;
    const avail = c.availability ?? [];
    if (avail.length > 0) return avail.some((a) => a.day_of_week === day);
    return (c.attendance ?? []).some((a) => a.day_of_week === day);
  });

  const dayStaff = staff.filter((s) => {
    if (!s.is_active) return false;
    const avail = s.availability ?? [];
    return avail.some((a) => a.day_of_week === day);
  });

  if (!dayClients.length) {
    return (
      <div>
        <DayPicker day={day} onChange={onDayChange} />
        <div className="text-center py-16 text-slate-400 text-sm mt-4">
          No clients scheduled for {DAY_NAMES[day]}.
        </div>
      </div>
    );
  }

  function getEligibleStaff(clientId: string, slotStart: string): Staff[] {
    const client = clients.find((c) => c.id === clientId);
    return staff.filter((s) => {
      if (!s.is_active) return false;
      if (client?.no_male_therapists && s.gender === 'male') return false;
      const shift = slotShift(slotStart);
      if (!shift) return true;
      const shiftStart = SHIFT_TIMES[shift]?.start ?? slotStart;
      const shiftEnd = SHIFT_TIMES[shift]?.end ?? '18:00';
      const avail = s.availability ?? [];
      return avail.some((av) => {
        if (av.day_of_week !== day) return false;
        if (av.time_start && av.time_end) {
          return timeWindowCovers(
            av.time_start.slice(0, 5),
            av.time_end.slice(0, 5),
            shiftStart,
            shiftEnd
          );
        }
        return av.shift === 'FULL' || av.shift === shift;
      });
    });
  }

  return (
    <div ref={containerRef}>
      <DayPicker day={day} onChange={onDayChange} />

      <div className="overflow-x-auto mt-4">
        <div style={{ minWidth: `${180 + dayStaff.length * 140}px` }}>
          {/* Header: client label col + staff columns */}
          <div
            className="grid bg-slate-800 text-white text-xs font-semibold rounded-t-xl"
            style={{ gridTemplateColumns: `180px repeat(${dayStaff.length}, 1fr)` }}
          >
            <div className="px-3 py-3 text-slate-400 uppercase tracking-wide">Client</div>
            {dayStaff.map((s) => (
              <div key={s.id} className="px-2 py-3 text-center border-l border-slate-700">
                <div className="truncate">{s.name}</div>
                <div className="text-slate-400 text-[10px] capitalize">{s.employment_type}</div>
              </div>
            ))}
          </div>

          {/* One row per client */}
          {dayClients.map((client, idx) => {
            const clientColor = client.color || '#0ea5e9';
            const clientAssignments = assignments.filter(
              (a) => a.day_of_week === day && a.client_id === client.id
            );
            const isLast = idx === dayClients.length - 1;

            return (
              <div
                key={client.id}
                className={`grid border-b ${isLast ? 'border-slate-200 rounded-b-xl' : 'border-slate-100'} bg-white`}
                style={{ gridTemplateColumns: `180px repeat(${dayStaff.length}, 1fr)` }}
              >
                {/* Client name cell */}
                <div
                  className="px-3 py-3 flex items-center gap-2.5 border-r border-slate-100"
                  style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: clientColor }}
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-900 leading-tight">
                      {client.first_name} {client.last_name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 capitalize">{client.program_type}</div>
                  </div>
                </div>

                {/* Staff columns */}
                {dayStaff.map((staffMember) => {
                  const assignment = clientAssignments.find(
                    (a) => a.staff_id === staffMember.id
                  );
                  const unassignedForClient = clientAssignments.find((a) => !a.staff_id);
                  const cellKey = `${client.id}-${staffMember.id}`;
                  const isEditing = editingCell === cellKey;
                  const note = assignment ? noteByAssignment.get(assignment.id) : undefined;
                  const hasViolation = !!assignment?.violation_reason;
                  const isManual = !!assignment?.is_manual_override;
                  const eligible = getEligibleStaff(client.id, '08:00');

                  if (assignment) {
                    const timeLabel =
                      assignment.time_start && assignment.time_end
                        ? `${formatTime(assignment.time_start.slice(0, 5))} – ${formatTime(assignment.time_end.slice(0, 5))}`
                        : assignment.shift ?? '';

                    return (
                      <div
                        key={staffMember.id}
                        className="border-l border-slate-100 px-2 py-2 relative group"
                      >
                        <button
                          onClick={() => setEditingCell(isEditing ? null : cellKey)}
                          className="w-full text-left"
                        >
                          <div
                            className="rounded-lg px-2 py-2 text-xs transition-opacity"
                            style={{
                              backgroundColor: hexToRgba(clientColor, 0.12),
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor: hexToRgba(clientColor, 0.35),
                              color: clientColor,
                            }}
                          >
                            <div className="font-semibold leading-tight truncate">{timeLabel}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {hasViolation && <AlertTriangle size={10} />}
                              {isManual && <span className="font-bold text-[9px]">M</span>}
                              {note?.submitted
                                ? <CheckCircle2 size={10} />
                                : <FileText size={10} className="opacity-60" />
                              }
                            </div>
                          </div>
                        </button>

                        {hasViolation && (
                          <div className="absolute bottom-full left-0 mb-1 z-20 bg-red-800 text-white text-xs rounded-lg px-2 py-1 w-44 shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                            {assignment.violation_reason}
                          </div>
                        )}

                        {isEditing && (
                          <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-44">
                            <div className="px-3 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">Reassign</div>
                            <button
                              onClick={() => { onUpdateAssignment(assignment.id, null); setEditingCell(null); }}
                              className="w-full text-left px-3 py-2 text-xs text-amber-600 hover:bg-amber-50"
                            >
                              — Unassign
                            </button>
                            {eligible.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => { onUpdateAssignment(assignment.id, s.id); setEditingCell(null); }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between ${assignment.staff_id === s.id ? 'font-semibold text-aqua-600' : 'text-slate-700'}`}
                              >
                                <span>{s.name}</span>
                                <span className="text-slate-400">T{s.priority_tier}</span>
                              </button>
                            ))}
                            <div className="border-t border-slate-100 mt-1 pt-1 px-3 py-1.5 text-xs text-slate-400 font-medium">Move to day</div>
                            {WEEKDAYS.filter((d) => d !== day).map((d) => (
                              <button
                                key={d}
                                onClick={() => { onMoveAssignment(assignment.id, d, assignment.shift as AssignmentShift); setEditingCell(null); }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                              >
                                <Clock size={10} className="text-slate-400" />
                                {DAY_SHORT[d]}
                              </button>
                            ))}
                            {onDeleteAssignment && (
                              <div className="border-t border-slate-100 mt-1 pt-1">
                                <button
                                  onClick={() => { onDeleteAssignment(assignment.id); setEditingCell(null); }}
                                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                >
                                  Remove session
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Empty cell — show unassigned badge in first empty slot for this client
                  const showUnassigned =
                    !assignment &&
                    unassignedForClient &&
                    dayStaff.findIndex((s) => s.id === staffMember.id) === 0;

                  return (
                    <div key={staffMember.id} className="border-l border-slate-100 px-2 py-2">
                      {showUnassigned && (
                        <div className="rounded px-2 py-1.5 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                          Unassigned
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex gap-4 flex-wrap px-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CheckCircle2 size={12} className="text-aqua-400" />Note submitted
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <FileText size={12} className="text-amber-500" />Note missing
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <AlertTriangle size={12} className="text-red-500" />Violation
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-bold text-blue-500 text-[10px]">M</span>Manual override
        </div>
      </div>
    </div>
  );
}

function DayPicker({ day, onChange }: { day: DayOfWeek; onChange: (d: DayOfWeek) => void }) {
  return (
    <div className="flex rounded-xl bg-slate-100 p-1 w-fit">
      {WEEKDAYS.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            day === d ? 'bg-accent-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {DAY_SHORT[d]}
        </button>
      ))}
    </div>
  );
}
