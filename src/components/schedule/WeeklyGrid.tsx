import React, { useState } from 'react';import type {
  ScheduleAssignment,
  Staff,
  Client,
  DayOfWeek,
  AssignmentShift,
} from '../../lib/types';
import { DAY_SHORT, DAY_NAMES, SHIFT_TIMES, timeWindowCovers } from '../../lib/types';
import { AlertTriangle, ChevronDown } from 'lucide-react';

interface WeeklyGridProps {
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  onUpdateAssignment: (id: string, staffId: string | null) => void;
  weekLabel: string;
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
const SHIFTS: AssignmentShift[] = ['AM', 'PM'];

export function WeeklyGrid({
  assignments,
  staff,
  clients,
  onUpdateAssignment,
  weekLabel,
}: WeeklyGridProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
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

  function getAssignment(day: DayOfWeek, shift: AssignmentShift, clientId: string) {
    return assignments.find(
      (a) => a.day_of_week === day && a.shift === shift && a.client_id === clientId
    );
  }

  function getStaffName(staffId: string | null) {
    if (!staffId) return null;
    return staff.find((s) => s.id === staffId)?.name ?? null;
  }

  function clientCanAttend(client: Client, day: DayOfWeek, shift: AssignmentShift): boolean {
    const shiftStart = SHIFT_TIMES[shift].start;
    const shiftEnd = SHIFT_TIMES[shift].end;
    const avail = client.availability ?? [];
    if (avail.length === 0) {
      const attendsDay = (client.attendance ?? []).some((a) => a.day_of_week === day);
      if (!attendsDay) return false;
      if (client.shift_type === 'FULL') return true;
      if (client.shift_type === 'AM' && shift === 'AM') return true;
      if (client.shift_type === 'PM' && shift === 'PM') return true;
      if (client.shift_type === 'CUSTOM') return shift === 'AM';
      return false;
    }
    return avail.some((a) => {
      if (a.day_of_week !== day) return false;
      if (a.time_start && a.time_end) {
        return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), shiftStart, shiftEnd);
      }
      return a.shift === 'FULL' || a.shift === shift;
    });
  }

  function clientHasAnyDay(client: Client, day: DayOfWeek): boolean {
    const avail = client.availability ?? [];
    if (avail.length === 0) {
      return (client.attendance ?? []).some((a) => a.day_of_week === day);
    }
    return avail.some((a) => a.day_of_week === day);
  }

  function getEligibleStaff(day: DayOfWeek, shift: AssignmentShift, client: Client): Staff[] {
    const shiftStart = SHIFT_TIMES[shift].start;
    const shiftEnd = SHIFT_TIMES[shift].end;
    return staff.filter((s) => {
      if (!s.is_active) return false;
      const avail = s.availability ?? [];
      const canWork = avail.some((a) => {
        if (a.day_of_week !== day) return false;
        if (a.time_start && a.time_end) {
          return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), shiftStart, shiftEnd);
        }
        return a.shift === 'FULL' || a.shift === shift;
      });
      if (!canWork) return false;
      if (client.no_male_therapists && s.gender === 'male') return false;
      return true;
    });
  }

  // Group clients for display — show each client row
  const activeClients = clients.filter((c) => c.is_active);

  return (
    <div className="overflow-x-auto" ref={containerRef}>
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid bg-slate-50 rounded-t-xl border border-slate-200 border-b-0" style={{ gridTemplateColumns: '140px repeat(5, 1fr)' }}>
          <div className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</div>
          {DAYS.map((d) => (
            <div key={d} className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide border-l border-slate-200">
              {DAY_SHORT[d]}
            </div>
          ))}
        </div>

        {/* Shift sections */}
        {SHIFTS.map((shift) => {
          const shiftClients = activeClients.filter((c) => {
            // Check if client attends any day for this shift
            for (const day of DAYS) {
              if (clientCanAttend(c, day, shift)) return true;
            }
            return false;
          });

          if (!shiftClients.length) return null;

          return (
            <div key={shift}>
              {/* Shift header */}
              <div className="border border-slate-200 border-t-0 px-3 py-2 bg-brand-700 text-white text-xs font-semibold flex items-center gap-2">
                <span>{shift === 'AM' ? 'AM Shift' : 'PM Shift'}</span>
                <span className="text-slate-400 font-normal">{SHIFT_TIMES[shift].start} – {SHIFT_TIMES[shift].end}</span>
              </div>

              {shiftClients.map((client) => {
                return (
                  <div
                    key={`${shift}-${client.id}`}
                    className="grid border border-slate-200 border-t-0 hover:bg-slate-50/50 transition-colors"
                    style={{ gridTemplateColumns: '140px repeat(5, 1fr)' }}
                  >
                    <div className="px-3 py-3 flex items-center">
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          {client.first_name} {client.last_name}
                        </div>
                        {client.no_male_therapists && (
                          <div className="text-xs text-amber-600">F only</div>
                        )}
                      </div>
                    </div>

                    {DAYS.map((day) => {
                      const attends = clientCanAttend(client, day, shift);
                      const assignment = getAssignment(day, shift, client.id);
                      const staffName = getStaffName(assignment?.staff_id ?? null);
                      const hasViolation = !!assignment?.violation_reason;
                      const isManual = !!assignment?.is_manual_override;
                      const cellId = `${shift}-${client.id}-${day}`;
                      const isEditing = editingCell === cellId;
                      const eligibleStaff = getEligibleStaff(day, shift, client);

                      return (
                        <div
                          key={day}
                          className={`px-2 py-2.5 border-l border-slate-200 relative ${!attends ? 'bg-slate-50' : ''}`}
                        >
                          {!attends ? (
                            <span className="text-slate-200 text-xs">—</span>
                          ) : (
                            <div className="relative">
                              <button
                                onClick={() => setEditingCell(isEditing ? null : cellId)}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors group flex items-center gap-1 ${
                                  hasViolation
                                    ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
                                    : !assignment?.staff_id
                                    ? 'bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100'
                                    : isManual
                                    ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                                    : 'bg-aqua-50 border border-aqua-200 text-aqua-600 hover:bg-aqua-100'
                                }`}
                              >
                                <span className="flex-1 truncate">
                                  {staffName ?? (
                                    <span className="italic font-normal">Unassigned</span>
                                  )}
                                </span>
                                <span className="flex gap-0.5 flex-shrink-0">
                                  {hasViolation && <AlertTriangle size={10} className="text-red-500" />}
                                  {isManual && <span className="text-blue-400 text-xs">M</span>}
                                  <ChevronDown size={10} className="text-current opacity-60" />
                                </span>
                              </button>

                              {hasViolation && (
                                <div className="absolute bottom-full left-0 mb-1 z-20 bg-red-800 text-white text-xs rounded-lg px-2 py-1 w-48 shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                  {assignment.violation_reason}
                                </div>
                              )}

                              {isEditing && (
                                <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-44">
                                  <div className="px-3 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">
                                    Assign Staff
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (assignment) onUpdateAssignment(assignment.id, null);
                                      setEditingCell(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 transition-colors"
                                  >
                                    — Unassign
                                  </button>
                                  {eligibleStaff
                                    .sort((a, b) => a.priority_tier - b.priority_tier)
                                    .map((s) => (
                                      <button
                                        key={s.id}
                                        onClick={() => {
                                          if (assignment) onUpdateAssignment(assignment.id, s.id);
                                          setEditingCell(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-aqua-50 transition-colors flex items-center justify-between ${
                                          assignment?.staff_id === s.id ? 'text-aqua-600 font-semibold' : 'text-slate-700'
                                        }`}
                                      >
                                        <span>{s.name}</span>
                                        <span className="text-slate-400">T{s.priority_tier}</span>
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div className="border border-slate-200 border-t-0 rounded-b-xl px-4 py-3 bg-white flex gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-aqua-100 border border-aqua-200" />Auto-assigned
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />Manual override
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />Unassigned
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <AlertTriangle size={12} className="text-red-500" />Rule violation
          </div>
        </div>
      </div>
    </div>
  );
}
