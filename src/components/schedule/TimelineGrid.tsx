import React from 'react';
import type {
  ScheduleAssignment,
  Staff,
  Client,
  DayOfWeek,
  AssignmentShift,
  SessionNote,
} from '../../lib/types';
import {
  TIME_SLOTS,
  BLOCKED_SLOTS,
  DAY_SHORT,
  formatTime,
  timeWindowCovers,
} from '../../lib/types';
import { AlertTriangle, FileText, CheckCircle2, GripVertical } from 'lucide-react';

interface TimelineGridProps {
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  sessionNotes: SessionNote[];
  onUpdateAssignment: (id: string, staffId: string | null) => void;
  onMoveAssignment: (id: string, day: DayOfWeek, shift: AssignmentShift) => void;
  onToggleNote: (assignmentId: string) => void;
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];

function slotShift(slotStart: string): AssignmentShift | null {
  if (slotStart >= '08:00' && slotStart < '10:30') return 'AM';
  if (slotStart >= '10:30' && slotStart < '14:30') return 'PM';
  return null;
}

function addThirtyMin(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getSlotAssignments(
  assignments: ScheduleAssignment[],
  day: DayOfWeek,
  slotStart: string
): ScheduleAssignment[] {
  const slotEnd = addThirtyMin(slotStart);
  return assignments.filter((a) => {
    if (a.day_of_week !== day) return false;
    const aStart = (a.time_start ?? '').slice(0, 5);
    const aEnd = (a.time_end ?? '').slice(0, 5);
    if (!aStart || !aEnd) {
      const s = slotShift(slotStart);
      return a.shift === s;
    }
    return timeWindowCovers(aStart, aEnd, slotStart, slotEnd);
  });
}

export function TimelineGrid({
  assignments,
  staff,
  clients,
  sessionNotes,
  onUpdateAssignment,
  onMoveAssignment,
  onToggleNote,
}: TimelineGridProps) {
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

  function getEligibleStaff(assignment: ScheduleAssignment): Staff[] {
    const client = clients.find((c) => c.id === assignment.client_id);
    return staff.filter((s) => {
      if (!s.is_active) return false;
      if (client?.no_male_therapists && s.gender === 'male') return false;
      return true;
    });
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

  function handleDragOver(e: React.DragEvent, dropKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(dropKey);
  }

  function handleDrop(e: React.DragEvent, day: DayOfWeek, slotStart: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const shift = slotShift(slotStart);
    if (id && shift) onMoveAssignment(id, day, shift);
    setDraggingId(null);
    setDragOver(null);
  }

  if (!clients.filter((c) => c.is_active).length) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">No active clients to display.</div>
    );
  }

  return (
    <div className="overflow-x-auto" ref={containerRef}>
      <div style={{ minWidth: `${140 + DAYS.length * 160}px` }}>
        {/* Header */}
        <div
          className="grid bg-slate-800 text-white text-xs font-semibold rounded-t-xl"
          style={{ gridTemplateColumns: `84px repeat(${DAYS.length}, 1fr)` }}
        >
          <div className="px-3 py-3 text-slate-400 uppercase tracking-wide">Time</div>
          {DAYS.map((d) => (
            <div key={d} className="px-3 py-3 text-center border-l border-slate-700">
              {DAY_SHORT[d]}
            </div>
          ))}
        </div>

        {/* Time slot rows */}
        {TIME_SLOTS.map((slotStart, idx) => {
          const isBlocked = !!BLOCKED_SLOTS[slotStart];
          const blockLabel = BLOCKED_SLOTS[slotStart];
          const isLastSlot = idx === TIME_SLOTS.length - 1;

          return (
            <div
              key={slotStart}
              className={`grid border-b ${isLastSlot ? 'border-slate-200 rounded-b-xl' : 'border-slate-100'} ${isBlocked ? 'bg-rose-50 border-rose-200' : 'bg-white hover:bg-slate-50/40'}`}
              style={{ gridTemplateColumns: `84px repeat(${DAYS.length}, 1fr)` }}
            >
              <div className={`px-3 py-2 flex flex-col justify-center border-r ${isBlocked ? 'border-rose-200' : 'border-slate-100'}`}>
                <span className={`text-xs font-semibold ${isBlocked ? 'text-rose-600' : 'text-slate-600'}`}>
                  {formatTime(slotStart)}
                </span>
                {isBlocked && (
                  <span className="text-xs text-rose-400 font-medium mt-0.5">{blockLabel}</span>
                )}
              </div>

              {DAYS.map((day) => {
                if (isBlocked) {
                  return (
                    <div key={day} className="px-2 py-2 border-l border-rose-100 flex items-center justify-center">
                      <div className="w-full h-4 bg-rose-200/50 rounded-sm" />
                    </div>
                  );
                }

                const slotAssignments = getSlotAssignments(assignments, day, slotStart);
                const dropKey = `${day}-${slotStart}`;
                const isDragTarget = dragOver === dropKey && !!slotShift(slotStart);

                return (
                  <div
                    key={day}
                    className={`px-1.5 py-1.5 border-l border-slate-100 space-y-1 min-h-[36px] transition-colors ${
                      isDragTarget ? 'bg-aqua-50 ring-2 ring-inset ring-aqua-400 rounded' : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, dropKey)}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleDrop(e, day, slotStart)}
                  >
                    {slotAssignments.map((a) => {
                      const clientObj = clients.find((c) => c.id === a.client_id);
                      const staffObj = staff.find((s) => s.id === a.staff_id);
                      const hasViolation = !!a.violation_reason;
                      const isManual = !!a.is_manual_override;
                      const note = noteByAssignment.get(a.id);
                      const cellId = `${day}-${slotStart}-${a.client_id}`;
                      const isEditing = editingCell === cellId;
                      const eligible = getEligibleStaff(a);

                      const aStart = (a.time_start ?? '').slice(0, 5);
                      const isFirst = aStart === slotStart || (!aStart && idx === 0);
                      const isBeingDragged = draggingId === a.id;

                      return (
                        <div
                          key={a.id}
                          className={`relative group transition-opacity ${isBeingDragged ? 'opacity-40' : 'opacity-100'}`}
                          draggable={isFirst}
                          onDragStart={isFirst ? (e) => handleDragStart(e, a.id) : undefined}
                          onDragEnd={isFirst ? handleDragEnd : undefined}
                        >
                          <div className={`w-full rounded px-1.5 py-1 text-xs transition-colors ${
                            hasViolation
                              ? 'bg-red-100 border border-red-300 text-red-800'
                              : !a.staff_id
                              ? 'bg-amber-100 border border-amber-300 text-amber-800'
                              : isManual
                              ? 'bg-blue-100 border border-blue-300 text-blue-800'
                              : 'bg-aqua-100 border border-aqua-200 text-aqua-700'
                          }`}>
                            <div className="flex items-center gap-1 justify-between">
                              <button
                                onClick={() => setEditingCell(isEditing ? null : cellId)}
                                className="flex-1 text-left min-w-0"
                              >
                                <div className="truncate">
                                  {isFirst && (
                                    <div className="flex items-center gap-0.5">
                                      <GripVertical size={9} className="opacity-30 flex-shrink-0 cursor-grab" />
                                      {clientObj && (
                                        <span className="font-semibold block leading-tight truncate">
                                          {clientObj.first_name} {clientObj.last_name}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <span className="truncate opacity-80">
                                    {staffObj ? staffObj.name : <em>Unassigned</em>}
                                  </span>
                                </div>
                              </button>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {isFirst && (
                                  <button
                                    title={note?.submitted ? 'Note submitted — click to undo' : 'Note missing — click to mark submitted'}
                                    onClick={() => onToggleNote(a.id)}
                                    className="transition-opacity hover:opacity-70"
                                  >
                                    {note?.submitted
                                      ? <CheckCircle2 size={11} className="text-aqua-500" />
                                      : <FileText size={11} className="text-amber-500" />
                                    }
                                  </button>
                                )}
                                {hasViolation && <AlertTriangle size={10} className="text-red-600" />}
                                {isManual && <span className="text-blue-500 font-bold text-[10px]">M</span>}
                              </div>
                            </div>
                          </div>

                          {hasViolation && (
                            <div className="absolute bottom-full left-0 mb-1 z-20 bg-red-800 text-white text-xs rounded-lg px-2 py-1 w-52 shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal">
                              {a.violation_reason}
                            </div>
                          )}

                          {isEditing && (
                            <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-44">
                              <div className="px-3 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">Reassign Staff</div>
                              <button
                                onClick={() => { onUpdateAssignment(a.id, null); setEditingCell(null); }}
                                className="w-full text-left px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 transition-colors"
                              >
                                — Unassign
                              </button>
                              {eligible
                                .sort((x, y) => x.priority_tier - y.priority_tier)
                                .map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => { onUpdateAssignment(a.id, s.id); setEditingCell(null); }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-aqua-50 flex items-center justify-between ${a.staff_id === s.id ? 'text-aqua-600 font-semibold' : 'text-slate-700'}`}
                                  >
                                    <span>{s.name}</span>
                                    <span className="text-slate-400">T{s.priority_tier}</span>
                                  </button>
                                ))}
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
        <div className="mt-3 flex gap-4 flex-wrap px-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-aqua-100 border border-aqua-200" />Auto-assigned
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />Manual (M)
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />Unassigned
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-rose-200" />Break/Lunch
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
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <GripVertical size={12} />Drag to move day
          </div>
        </div>
      </div>
    </div>
  );
}
