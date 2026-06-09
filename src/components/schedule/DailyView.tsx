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
  TIME_SLOTS,
  DAY_NAMES,
  DAY_SHORT,
  formatTime,
  timeWindowCovers,
  SHIFT_TIMES,
} from '../../lib/types';
import { AlertTriangle, FileText, CheckCircle2, GripVertical, Clock } from 'lucide-react';

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

function addThirtyMin(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function slotShift(s: string): AssignmentShift | null {
  if (s >= '08:00' && s < '10:30') return 'AM';
  if (s >= '10:30' && s < '14:30') return 'PM';
  if (s >= '15:00' && s < '18:00') return 'EVE';
  return null;
}

function getAssignment(
  assignments: ScheduleAssignment[],
  day: DayOfWeek,
  clientId: string,
  slotStart: string
): ScheduleAssignment | undefined {
  const slotEnd = addThirtyMin(slotStart);
  return assignments.find((a) => {
    if (a.day_of_week !== day || a.client_id !== clientId) return false;
    const aStart = (a.time_start ?? '').slice(0, 5);
    const aEnd = (a.time_end ?? '').slice(0, 5);
    if (!aStart || !aEnd) return a.shift === slotShift(slotStart);
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
  breakTimes = [],
  onUpdateAssignment,
  onMoveAssignment,
  onDeleteAssignment,
  onUpdateEndTime,
  onToggleNote,
}: DailyViewProps) {
  const [editingCell, setEditingCell] = React.useState<string | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);
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

  const activeBreaks = breakTimes.filter((b) => b.is_active);

  function isBlockedSlot(slotStart: string): string | null {
    const slotEnd = addThirtyMin(slotStart);
    for (const b of activeBreaks) {
      if (b.days.length > 0 && !b.days.includes(day)) continue;
      if (b.time_start.slice(0, 5) <= slotStart && b.time_end.slice(0, 5) >= slotEnd) {
        return b.name;
      }
    }
    return null;
  }

  const dayClients = clients.filter((c) => {
    if (!c.is_active) return false;
    const avail = c.availability ?? [];
    if (avail.length > 0) return avail.some((a) => a.day_of_week === day);
    return (c.attendance ?? []).some((a) => a.day_of_week === day);
  });

  const otherDays = WEEKDAYS.filter((d) => d !== day);

  if (!dayClients.length) {
    return (
      <div>
        <DayPicker day={day} onChange={onDayChange} />
        <div className="text-center py-16 text-slate-400 text-sm mt-4">No clients scheduled for {DAY_NAMES[day]}.</div>
      </div>
    );
  }

  function handleDragStart(e: React.DragEvent, assignmentId: string) {
    setDraggingId(assignmentId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', assignmentId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOver(null);
  }

  function handleDrop(e: React.DragEvent, targetDay: DayOfWeek, shift: AssignmentShift) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) onMoveAssignment(id, targetDay, shift);
    setDraggingId(null);
    setDragOver(null);
  }

  return (
    <div ref={containerRef}>
      <div className="flex items-center gap-3 flex-wrap">
        <DayPicker day={day} onChange={onDayChange} />
        {draggingId && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-slate-400">Move to:</span>
            {otherDays.flatMap((d) =>
              (['AM', 'PM'] as AssignmentShift[]).map((sh) => (
                <div
                  key={`${d}-${sh}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-dashed transition-colors cursor-copy ${
                    dragOver === `day-${d}-${sh}`
                      ? 'bg-aqua-100 border-aqua-500 text-aqua-700'
                      : 'bg-white border-slate-300 text-slate-500 hover:border-aqua-400 hover:bg-aqua-50'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(`day-${d}-${sh}`); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDrop(e, d, sh)}
                >
                  {DAY_SHORT[d]} {sh}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto mt-4">
        <div style={{ minWidth: `${100 + dayClients.length * 130}px` }}>
          {/* Header row */}
          <div
            className="grid bg-slate-800 text-white text-xs font-semibold rounded-t-xl"
            style={{ gridTemplateColumns: `80px repeat(${dayClients.length}, 1fr)` }}
          >
            <div className="px-3 py-3 text-slate-400 uppercase tracking-wide">Time</div>
            {dayClients.map((c) => (
              <div key={c.id} className="px-2 py-3 text-center border-l border-slate-700 truncate">
                <div className="truncate">{c.first_name}</div>
                <div className="text-slate-400 text-[10px] truncate">{c.last_name}</div>
              </div>
            ))}
          </div>

          {TIME_SLOTS.map((slotStart, idx) => {
            const blockLabel = isBlockedSlot(slotStart);
            const isBlocked = !!blockLabel;
            const isLastSlot = idx === TIME_SLOTS.length - 1;

            return (
              <div
                key={slotStart}
                className={`grid border-b ${isLastSlot ? 'border-slate-200 rounded-b-xl' : 'border-slate-100'} ${
                  isBlocked ? 'bg-rose-50 border-rose-200' : 'bg-white'
                }`}
                style={{ gridTemplateColumns: `80px repeat(${dayClients.length}, 1fr)` }}
              >
                <div className={`px-3 py-2.5 flex flex-col justify-center border-r ${isBlocked ? 'border-rose-200' : 'border-slate-100'}`}>
                  <span className={`text-xs font-semibold ${isBlocked ? 'text-rose-600' : 'text-slate-600'}`}>
                    {formatTime(slotStart)}
                  </span>
                  {isBlocked && <span className="text-[10px] text-rose-400">{blockLabel}</span>}
                </div>

                {dayClients.map((c) => {
                  if (isBlocked) {
                    return (
                      <div key={c.id} className="border-l border-rose-100 flex items-center justify-center px-2 py-2">
                        <div className="w-full h-4 bg-rose-200/40 rounded-sm" />
                      </div>
                    );
                  }

                  const a = getAssignment(assignments, day, c.id, slotStart);

                  if (!a) {
                    return <div key={c.id} className="border-l border-slate-100" />;
                  }

                  const aStart = (a.time_start ?? '').slice(0, 5);
                  const isFirst = aStart === slotStart || (!aStart && idx === 0);
                  const staffObj = staff.find((s) => s.id === a.staff_id);
                  const hasViolation = !!a.violation_reason;
                  const isManual = !!a.is_manual_override;
                  const note = noteByAssignment.get(a.id);
                  const cellId = `${slotStart}-${c.id}`;
                  const isEditing = editingCell === cellId;
                  const isBeingDragged = draggingId === a.id;

                  const eligibleStaff = staff.filter((s) => {
                    if (!s.is_active) return false;
                    if (c.no_male_therapists && s.gender === 'male') return false;
                    const shift = slotShift(slotStart);
                    if (!shift) return false;
                    const shiftStart = SHIFT_TIMES[shift]?.start ?? slotStart;
                    const shiftEnd = SHIFT_TIMES[shift]?.end ?? addThirtyMin(slotStart);
                    const avail = s.availability ?? [];
                    return avail.some((av) => {
                      if (av.day_of_week !== day) return false;
                      if (av.time_start && av.time_end) {
                        return timeWindowCovers(av.time_start.slice(0, 5), av.time_end.slice(0, 5), shiftStart, shiftEnd);
                      }
                      return av.shift === 'FULL' || av.shift === shift;
                    });
                  });

                  return (
                    <div
                      key={c.id}
                      className={`border-l border-slate-100 px-1.5 py-1.5 relative group transition-opacity ${isBeingDragged ? 'opacity-40' : 'opacity-100'}`}
                      draggable={isFirst}
                      onDragStart={isFirst ? (e) => handleDragStart(e, a.id) : undefined}
                      onDragEnd={isFirst ? handleDragEnd : undefined}
                    >
                      <div className={`rounded px-1.5 py-1 text-xs h-full min-h-[36px] ${
                        hasViolation
                          ? 'bg-red-100 border border-red-300 text-red-800'
                          : !a.staff_id
                          ? 'bg-amber-100 border border-amber-300 text-amber-800'
                          : isManual
                          ? 'bg-blue-100 border border-blue-300 text-blue-800'
                          : 'bg-aqua-50 border border-aqua-200 text-aqua-800'
                      }`}>
                        <div className="flex items-start justify-between gap-0.5">
                          <button
                            onClick={() => setEditingCell(isEditing ? null : cellId)}
                            className="text-left flex-1 min-w-0"
                          >
                            {isFirst && (
                              <div className="flex items-center gap-0.5">
                                <GripVertical size={9} className="opacity-30 flex-shrink-0 cursor-grab" />
                                <div className="font-semibold truncate leading-tight">
                                  {staffObj?.name ?? <em className="font-normal">Unassigned</em>}
                                </div>
                              </div>
                            )}
                            {!isFirst && (
                              <div className="text-[10px] opacity-50 truncate">{staffObj?.name}</div>
                            )}
                          </button>
                          <div className="flex flex-col gap-0.5 items-end flex-shrink-0 pt-0.5">
                            {isFirst && (
                              <button
                                onClick={() => onToggleNote(a.id)}
                                title={note?.submitted ? 'Note submitted' : 'Note missing'}
                              >
                                {note?.submitted
                                  ? <CheckCircle2 size={11} className="text-aqua-500" />
                                  : <FileText size={11} className="text-amber-500" />
                                }
                              </button>
                            )}
                            {hasViolation && <AlertTriangle size={10} className="text-red-600" />}
                            {isManual && <span className="text-[9px] font-bold text-blue-500">M</span>}
                          </div>
                        </div>
                      </div>

                      {hasViolation && (
                        <div className="absolute bottom-full left-0 mb-1 z-20 bg-red-800 text-white text-xs rounded-lg px-2 py-1 w-44 shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                          {a.violation_reason}
                        </div>
                      )}

                      {isEditing && (
                        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-40">
                          <div className="px-3 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">Reassign</div>
                          <button
                            onClick={() => { onUpdateAssignment(a.id, null); setEditingCell(null); }}
                            className="w-full text-left px-3 py-2 text-xs text-amber-600 hover:bg-amber-50"
                          >
                            — Unassign
                          </button>
                          {eligibleStaff.sort((x, y) => x.priority_tier - y.priority_tier).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => { onUpdateAssignment(a.id, s.id); setEditingCell(null); }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-aqua-50 flex items-center justify-between ${a.staff_id === s.id ? 'text-aqua-600 font-semibold' : 'text-slate-700'}`}
                            >
                              <span>{s.name}</span>
                              <span className="text-slate-400">T{s.priority_tier}</span>
                            </button>
                          ))}
                          <div className="border-t border-slate-100 mt-1 pt-1 px-3 py-1.5 text-xs text-slate-400 font-medium">Move to day</div>
                          {WEEKDAYS.filter((d) => d !== day).flatMap((d) =>
                            (['AM', 'PM'] as AssignmentShift[]).map((sh) => (
                              <button
                                key={`${d}-${sh}`}
                                onClick={() => { onMoveAssignment(a.id, d, sh); setEditingCell(null); }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-aqua-50 flex items-center gap-1"
                              >
                                <Clock size={10} className="text-slate-400" />
                                {DAY_SHORT[d]} – {sh}
                              </button>
                            ))
                          )}
                          {onDeleteAssignment && (
                            <div className="border-t border-slate-100 mt-1 pt-1">
                              <button
                                onClick={() => { onDeleteAssignment(a.id); setEditingCell(null); }}
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
                })}
              </div>
            );
          })}
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
