import React from 'react';
import type {
  ScheduleAssignment,
  Staff,
  Client,
  DayOfWeek,
  AssignmentShift,
  SessionNote,
  BreakTime,
  ShiftDefinition,
} from '../../lib/types';
import {
  DAY_NAMES,
  DAY_SHORT,
  TIME_SLOTS,
  formatTime,
  timeWindowCovers,
} from '../../lib/types';
import { AlertTriangle, FileText, CheckCircle2, Clock } from 'lucide-react';

interface DailyViewProps {
  day: DayOfWeek;
  onDayChange: (d: DayOfWeek) => void;
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  sessionNotes: SessionNote[];
  shifts: ShiftDefinition[];
  breakTimes?: BreakTime[];
  onUpdateAssignment: (id: string, staffId: string | null) => void;
  onMoveAssignment: (id: string, day: DayOfWeek, shift: AssignmentShift) => void;
  onDeleteAssignment?: (id: string) => void;
  onUpdateEndTime?: (id: string, newEndTime: string) => void;
  onToggleNote: (assignmentId: string) => void;
}

const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];

function addThirtyMin(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Does a staff member have availability covering a given 30-min slot on a day?
function staffAvailableAtSlot(s: Staff, day: DayOfWeek, slotStart: string): boolean {
  const slotEnd = addThirtyMin(slotStart);
  const avail = s.availability ?? [];
  return avail.some((a) => {
    if (a.day_of_week !== day) return false;
    if (a.time_start && a.time_end) {
      return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), slotStart, slotEnd);
    }
    return a.shift === 'FULL';
  });
}

// Does a staff member have ANY availability on a given day?
function staffWorksDay(s: Staff, day: DayOfWeek): boolean {
  return (s.availability ?? []).some((a) => a.day_of_week === day);
}

// Find the assignment for a specific staff × day × time slot
function getStaffSlotAssignment(
  assignments: ScheduleAssignment[],
  staffId: string,
  day: DayOfWeek,
  slotStart: string
): ScheduleAssignment | undefined {
  const slotEnd = addThirtyMin(slotStart);
  return assignments.find((a) => {
    if (a.staff_id !== staffId || a.day_of_week !== day) return false;
    const aStart = (a.time_start ?? '').slice(0, 5);
    const aEnd = (a.time_end ?? '').slice(0, 5);
    if (!aStart || !aEnd) return false;
    return timeWindowCovers(aStart, aEnd, slotStart, slotEnd);
  });
}

export function DailyView({
  day,
  onDayChange,
  assignments,
  staff,
  clients,
  sessionNotes,
  shifts,
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

  // Active shifts for this day
  const dayShifts = shifts.filter((s) => s.is_active && s.days.includes(day));
  const activeBreaks = breakTimes.filter((b) => b.is_active);

  // Compute visible time range from day's shifts
  const timeRange = React.useMemo(() => {
    if (!dayShifts.length) return null;
    const starts = dayShifts.map((s) => s.time_start.slice(0, 5)).sort();
    const ends = dayShifts.map((s) => s.time_end.slice(0, 5)).sort();
    return { start: starts[0], end: ends[ends.length - 1] };
  }, [dayShifts]);

  const visibleSlots = timeRange
    ? TIME_SLOTS.filter((t) => t >= timeRange.start && t < timeRange.end)
    : [];

  // Staff who work this day (have availability on this day)
  const dayStaff = staff.filter((s) => s.is_active && staffWorksDay(s, day))
    .sort((a, b) => a.priority_tier - b.priority_tier || a.name.localeCompare(b.name));

  // Does a slot fall within any active shift for this day?
  function slotWithinDayShift(slotStart: string): boolean {
    const slotEnd = addThirtyMin(slotStart);
    return dayShifts.some(
      (s) => s.time_start.slice(0, 5) <= slotStart && s.time_end.slice(0, 5) >= slotEnd
    );
  }

  function isBreakSlot(slotStart: string): string | null {
    const slotEnd = addThirtyMin(slotStart);
    for (const b of activeBreaks) {
      if (b.days.length > 0 && !b.days.includes(day)) continue;
      if (b.time_start.slice(0, 5) <= slotStart && b.time_end.slice(0, 5) >= slotEnd) return b.name;
    }
    return null;
  }

  function getEligibleStaff(clientId: string): Staff[] {
    const client = clients.find((c) => c.id === clientId);
    return staff.filter((s) => {
      if (!s.is_active) return false;
      if (client?.no_male_therapists && s.gender === 'male') return false;
      return true;
    });
  }

  if (!dayShifts.length || !dayStaff.length) {
    return (
      <div>
        <DayPicker day={day} onChange={onDayChange} />
        <div className="text-center py-16 text-slate-400 text-sm mt-4">
          No shifts or staff scheduled for {DAY_NAMES[day]}.
        </div>
      </div>
    );
  }

  const colTemplate = `72px repeat(${dayStaff.length}, 1fr)`;

  return (
    <div ref={containerRef}>
      <DayPicker day={day} onChange={onDayChange} />

      <div
        className="overflow-auto mt-4 rounded-xl border border-slate-200"
        style={{ maxHeight: 'calc(100vh - 310px)' }}
      >
        <div style={{ minWidth: `${72 + dayStaff.length * 140}px` }}>

          {/* Sticky header: time col + staff columns */}
          <div
            className="sticky top-0 z-10 grid bg-slate-800 text-white text-xs font-semibold"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div className="px-2 py-3 text-slate-400 uppercase tracking-wide text-center">Time</div>
            {dayStaff.map((s) => (
              <div key={s.id} className="px-2 py-3 text-center border-l border-slate-700">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="text-slate-400 text-[10px] capitalize mt-0.5">T{s.priority_tier} · {s.employment_type}</div>
              </div>
            ))}
          </div>

          {/* Shift label bands */}
          {dayShifts.map((shiftDef) => {
            const shiftSlots = visibleSlots.filter(
              (t) =>
                t >= shiftDef.time_start.slice(0, 5) && t < shiftDef.time_end.slice(0, 5)
            );
            if (!shiftSlots.length) return null;

            return (
              <div key={shiftDef.id}>
                {/* Shift label row */}
                <div
                  className="grid text-white text-xs font-semibold px-3 py-1.5 border-b border-white/20"
                  style={{
                    gridTemplateColumns: colTemplate,
                    backgroundColor: shiftDef.color || '#475569',
                  }}
                >
                  <div className="col-span-full flex items-center gap-2">
                    <span>{shiftDef.label}</span>
                    <span className="opacity-70 font-normal">
                      {shiftDef.time_start.slice(0, 5)} – {shiftDef.time_end.slice(0, 5)}
                    </span>
                  </div>
                </div>

                {/* Time-slot rows within this shift */}
                {shiftSlots.map((slotStart, idx) => {
                  const isLastInShift = idx === shiftSlots.length - 1;
                  const breakName = isBreakSlot(slotStart);

                  return (
                    <div
                      key={slotStart}
                      className={`grid border-b ${isLastInShift ? 'border-slate-300' : 'border-slate-100'} ${
                        breakName ? 'bg-rose-50' : 'bg-white'
                      }`}
                      style={{ gridTemplateColumns: colTemplate }}
                    >
                      {/* Time label */}
                      <div
                        className={`px-2 py-1.5 text-center flex flex-col justify-center border-r ${
                          breakName ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <span className={`text-xs font-semibold ${breakName ? 'text-rose-600' : 'text-slate-500'}`}>
                          {formatTime(slotStart)}
                        </span>
                      </div>

                      {/* Staff columns */}
                      {dayStaff.map((staffMember) => {
                        const available = staffAvailableAtSlot(staffMember, day, slotStart);
                        const assignment = getStaffSlotAssignment(assignments, staffMember.id, day, slotStart);
                        const isFirstOfAssignment =
                          assignment && (assignment.time_start ?? '').slice(0, 5) === slotStart;

                        // Not available: grey diagonal stripes
                        if (!available) {
                          return (
                            <div
                              key={staffMember.id}
                              className="border-l border-slate-100 min-h-[32px]"
                              style={{
                                background:
                                  'repeating-linear-gradient(45deg,#f8fafc,#f8fafc 4px,#e2e8f0 4px,#e2e8f0 8px)',
                              }}
                            />
                          );
                        }

                        // In assignment but not the first slot: continuation bar
                        if (assignment && !isFirstOfAssignment) {
                          const clientObj = clients.find((c) => c.id === assignment.client_id);
                          const color = clientObj?.color || '#0ea5e9';
                          return (
                            <div
                              key={staffMember.id}
                              className="border-l border-slate-100 px-1.5 py-0.5 min-h-[32px]"
                            >
                              <div
                                className="h-full rounded-sm opacity-40"
                                style={{ backgroundColor: color, minHeight: 8 }}
                              />
                            </div>
                          );
                        }

                        // First slot of an assignment: show full card
                        if (assignment && isFirstOfAssignment) {
                          const clientObj = clients.find((c) => c.id === assignment.client_id);
                          const hasViolation = !!assignment.violation_reason;
                          const isManual = !!assignment.is_manual_override;
                          const note = noteByAssignment.get(assignment.id);
                          const color = clientObj?.color || '#0ea5e9';
                          const cellKey = `${assignment.id}-${slotStart}`;
                          const isEditing = editingCell === cellKey;
                          const eligible = getEligibleStaff(assignment.client_id);
                          const timeLabel =
                            assignment.time_start && assignment.time_end
                              ? `${formatTime(assignment.time_start.slice(0, 5))} – ${formatTime(assignment.time_end.slice(0, 5))}`
                              : '';

                          return (
                            <div
                              key={staffMember.id}
                              className="border-l border-slate-100 px-1.5 py-1 relative group min-h-[32px]"
                            >
                              <button
                                onClick={() => setEditingCell(isEditing ? null : cellKey)}
                                className="w-full text-left"
                              >
                                <div
                                  className="rounded-lg px-2 py-1.5 text-xs transition-colors border"
                                  style={
                                    hasViolation
                                      ? { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }
                                      : {
                                          backgroundColor: hexToRgba(color, 0.12),
                                          borderColor: hexToRgba(color, 0.4),
                                        }
                                  }
                                >
                                  {/* Client name — primary info */}
                                  <div
                                    className="font-semibold truncate leading-tight"
                                    style={{ color: hasViolation ? '#b91c1c' : color }}
                                  >
                                    {clientObj
                                      ? `${clientObj.first_name} ${clientObj.last_name}`
                                      : 'Unknown client'}
                                  </div>
                                  {/* Time range */}
                                  <div className="text-[10px] text-slate-400 mt-0.5">{timeLabel}</div>
                                  {/* Status icons */}
                                  <div className="flex items-center gap-1 mt-0.5" style={{ color: hasViolation ? '#b91c1c' : color }}>
                                    {hasViolation && <AlertTriangle size={9} />}
                                    {isManual && <span className="font-bold text-[9px] text-blue-500">M</span>}
                                    <button
                                      title={note?.submitted ? 'Note submitted' : 'Note missing'}
                                      onClick={(e) => { e.stopPropagation(); onToggleNote(assignment.id); }}
                                    >
                                      {note?.submitted
                                        ? <CheckCircle2 size={9} className="text-aqua-500" />
                                        : <FileText size={9} className="text-amber-500 opacity-60" />
                                      }
                                    </button>
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

                        // Available but no assignment
                        return (
                          <div
                            key={staffMember.id}
                            className="border-l border-slate-100 min-h-[32px] hover:bg-slate-50/50 transition-colors"
                          />
                        );
                      })}
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
          <div
            className="w-3 h-3 rounded"
            style={{ background: 'repeating-linear-gradient(45deg,#f8fafc,#f8fafc 2px,#e2e8f0 2px,#e2e8f0 4px)' }}
          />Not available
        </div>
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
