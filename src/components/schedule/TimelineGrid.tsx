import React from 'react';
import type {
  ScheduleAssignment,
  Staff,
  Client,
  DayOfWeek,
  AssignmentShift,
  SessionNote,
  ShiftDefinition,
  BreakTime,
} from '../../lib/types';
import {
  TIME_SLOTS,
  ALL_END_TIMES,
  DAY_SHORT,
  formatTime,
  timeWindowCovers,
  slotDuration,
} from '../../lib/types';
import { AlertTriangle, FileText, CheckCircle2, GripVertical, Trash2, Clock, ChevronDown } from 'lucide-react';

interface TimelineGridProps {
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  sessionNotes: SessionNote[];
  shifts: ShiftDefinition[];
  breakTimes: BreakTime[];
  onUpdateAssignment: (id: string, staffId: string | null) => void;
  onMoveAssignment: (id: string, day: DayOfWeek, shift: AssignmentShift) => void;
  onDeleteAssignment: (id: string) => void;
  onUpdateEndTime: (id: string, newEndTime: string) => void;
  onToggleNote: (assignmentId: string) => void;
}

function addThirtyMin(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function slotShiftFromTime(t: string, activeShifts: ShiftDefinition[]): AssignmentShift | null {
  for (const s of activeShifts) {
    if (t >= s.time_start.slice(0, 5) && t < s.time_end.slice(0, 5)) {
      return s.name as AssignmentShift;
    }
  }
  return null;
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
    if (!aStart || !aEnd) return false;
    return timeWindowCovers(aStart, aEnd, slotStart, slotEnd);
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function TimelineGrid({
  assignments,
  staff,
  clients,
  sessionNotes,
  shifts,
  breakTimes,
  onUpdateAssignment,
  onMoveAssignment,
  onDeleteAssignment,
  onUpdateEndTime,
  onToggleNote,
}: TimelineGridProps) {
  const [editingCell, setEditingCell] = React.useState<string | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [draggingStaffId, setDraggingStaffId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const [staffPanelOpen, setStaffPanelOpen] = React.useState(false);
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

  const activeShifts = shifts.filter((s) => s.is_active);
  const activeBreaks = breakTimes.filter((b) => b.is_active);

  const activeDays = React.useMemo(() => {
    const daySet = new Set<DayOfWeek>();
    activeShifts.forEach((s) => s.days.forEach((d) => daySet.add(d as DayOfWeek)));
    return ([1, 2, 3, 4, 5, 6] as DayOfWeek[]).filter((d) => daySet.has(d));
  }, [activeShifts]);

  const timeRange = React.useMemo(() => {
    if (!activeShifts.length) return { start: '08:00', end: '15:30' };
    const starts = activeShifts.map((s) => s.time_start.slice(0, 5)).sort();
    const ends = activeShifts.map((s) => s.time_end.slice(0, 5)).sort();
    return { start: starts[0], end: ends[ends.length - 1] };
  }, [activeShifts]);

  const visibleSlots = TIME_SLOTS.filter((t) => t >= timeRange.start && t < timeRange.end);

  // Returns true if a 30-min slot is covered by an active shift on this day
  function shiftCoversSlot(day: DayOfWeek, slotStart: string): boolean {
    const slotEnd = addThirtyMin(slotStart);
    return activeShifts.some(
      (s) =>
        s.days.includes(day) &&
        s.time_start.slice(0, 5) <= slotStart &&
        s.time_end.slice(0, 5) >= slotEnd
    );
  }

  function isBreakSlot(slotStart: string, day: DayOfWeek): string | null {
    const slotEnd = addThirtyMin(slotStart);
    for (const b of activeBreaks) {
      if (!b.days.includes(day) && b.days.length > 0) continue;
      if (b.time_start.slice(0, 5) <= slotStart && b.time_end.slice(0, 5) >= slotEnd) {
        return b.name;
      }
    }
    return null;
  }

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
    e.dataTransfer.setData('application/x-assignment-id', assignmentId);
  }

  function handleStaffDragStart(e: React.DragEvent, staffId: string) {
    setDraggingStaffId(staffId);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-staff-id', staffId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDraggingStaffId(null);
    setDragOver(null);
  }

  function handleCellDragOver(e: React.DragEvent, dropKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(dropKey);
  }

  function handleCellDrop(e: React.DragEvent, day: DayOfWeek, slotStart: string) {
    e.preventDefault();
    const assignId = e.dataTransfer.getData('application/x-assignment-id');
    const staffId = e.dataTransfer.getData('application/x-staff-id');
    const shift = slotShiftFromTime(slotStart, activeShifts);
    if (assignId && shift) {
      onMoveAssignment(assignId, day, shift);
    } else if (staffId) {
      const slotAssignments = getSlotAssignments(assignments, day, slotStart);
      if (slotAssignments.length > 0) {
        onUpdateAssignment(slotAssignments[0].id, staffId);
      }
    }
    setDraggingId(null);
    setDraggingStaffId(null);
    setDragOver(null);
  }

  function handleCardDrop(e: React.DragEvent, assignmentId: string) {
    e.stopPropagation();
    const staffId = e.dataTransfer.getData('application/x-staff-id');
    if (staffId) {
      onUpdateAssignment(assignmentId, staffId);
    }
    setDraggingStaffId(null);
    setDragOver(null);
  }

  if (!activeDays.length) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No active shifts configured. Click "Shifts" to set up your schedule.
      </div>
    );
  }

  const activeStaff = staff.filter((s) => s.is_active);
  const colTemplate = `80px repeat(${activeDays.length}, 1fr)`;

  return (
    <div ref={containerRef}>
      {/* Staff drag panel */}
      <div className="mb-3">
        <button
          onClick={() => setStaffPanelOpen((p) => !p)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-2"
        >
          <ChevronDown size={13} className={`transition-transform ${staffPanelOpen ? '' : '-rotate-90'}`} />
          Staff — drag to reassign
        </button>
        {staffPanelOpen && (
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            {activeStaff.map((s) => {
              const hours = assignments
                .filter((a) => a.staff_id === s.id)
                .reduce((sum, a) => {
                  if (a.time_start && a.time_end) return sum + slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5));
                  return sum;
                }, 0);
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => handleStaffDragStart(e, s.id)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-grab active:cursor-grabbing hover:border-aqua-300 hover:bg-aqua-50 transition-colors select-none"
                >
                  <GripVertical size={10} className="text-slate-400" />
                  {s.name}
                  <span className="text-slate-400">{hours.toFixed(1)}h</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrollable grid — header is sticky inside this container */}
      <div
        className="overflow-auto rounded-xl border border-slate-200"
        style={{ maxHeight: 'calc(100vh - 270px)' }}
      >
        <div style={{ minWidth: `${100 + activeDays.length * 160}px` }}>

          {/* Sticky day-of-week header */}
          <div
            className="sticky top-0 z-10 grid bg-slate-800 text-white text-xs font-semibold"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div className="px-3 py-3 text-slate-400 uppercase tracking-wide">Time</div>
            {activeDays.map((d) => (
              <div key={d} className="px-3 py-3 text-center border-l border-slate-700">
                {DAY_SHORT[d]}
              </div>
            ))}
          </div>

          {/* Time rows */}
          {visibleSlots.map((slotStart, idx) => {
            const isLastSlot = idx === visibleSlots.length - 1;
            const genericBreak = isBreakSlot(slotStart, 1 as DayOfWeek);

            return (
              <div
                key={slotStart}
                className={`grid border-b ${isLastSlot ? 'border-slate-200' : 'border-slate-100'} ${
                  genericBreak ? 'bg-rose-50 border-rose-200' : 'bg-white'
                }`}
                style={{ gridTemplateColumns: colTemplate }}
              >
                {/* Time label */}
                <div className={`px-3 py-2 flex flex-col justify-center border-r ${genericBreak ? 'border-rose-200' : 'border-slate-100'}`}>
                  <span className={`text-xs font-semibold ${genericBreak ? 'text-rose-600' : 'text-slate-600'}`}>
                    {formatTime(slotStart)}
                  </span>
                  {genericBreak && (
                    <span className="text-[10px] text-rose-400 font-medium mt-0.5">{genericBreak}</span>
                  )}
                </div>

                {activeDays.map((day) => {
                  const breakLabel = isBreakSlot(slotStart, day);
                  const withinShift = shiftCoversSlot(day, slotStart);

                  if (breakLabel) {
                    return (
                      <div key={day} className="px-2 py-2 border-l border-rose-100 flex items-center justify-center">
                        <div className="w-full h-4 bg-rose-200/50 rounded-sm" />
                      </div>
                    );
                  }

                  // Grey out cells outside any shift coverage for this day
                  if (!withinShift) {
                    return (
                      <div
                        key={day}
                        className="border-l border-slate-100 min-h-[36px]"
                        style={{
                          background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 4px, #f1f5f9 4px, #f1f5f9 8px)',
                        }}
                      />
                    );
                  }

                  const slotAssignments = getSlotAssignments(assignments, day, slotStart);
                  const dropKey = `${day}-${slotStart}`;
                  const isDragTarget = dragOver === dropKey;

                  return (
                    <div
                      key={day}
                      className={`px-1.5 py-1.5 border-l border-slate-100 space-y-1 min-h-[36px] transition-colors hover:bg-slate-50/40 ${
                        isDragTarget ? 'bg-aqua-50 ring-2 ring-inset ring-aqua-400 rounded' : ''
                      }`}
                      onDragOver={(e) => handleCellDragOver(e, dropKey)}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(e) => handleCellDrop(e, day, slotStart)}
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
                        const isFirst = aStart === slotStart;
                        const isBeingDragged = draggingId === a.id;
                        const isStaffDragTarget = draggingStaffId && isDragTarget;
                        const endTimeOptions = ALL_END_TIMES.filter((t) => t > aStart);

                        return (
                          <div
                            key={a.id}
                            className={`relative group transition-opacity ${isBeingDragged ? 'opacity-40' : 'opacity-100'} ${isStaffDragTarget ? 'ring-2 ring-aqua-400 rounded' : ''}`}
                            draggable={isFirst}
                            onDragStart={isFirst ? (e) => handleDragStart(e, a.id) : undefined}
                            onDragEnd={isFirst ? handleDragEnd : undefined}
                            onDragOver={(e) => { if (draggingStaffId) { e.preventDefault(); e.stopPropagation(); } }}
                            onDrop={(e) => handleCardDrop(e, a.id)}
                          >
                            {(() => {
                              const clientColor = clientObj?.color || '#0ea5e9';
                              const bgColor = hasViolation
                                ? 'rgba(254,226,226,1)'
                                : !a.staff_id
                                ? 'rgba(254,243,199,1)'
                                : hexToRgba(clientColor, 0.13);
                              const borderColor = hasViolation
                                ? 'rgba(252,165,165,1)'
                                : !a.staff_id
                                ? 'rgba(252,211,77,1)'
                                : hexToRgba(clientColor, 0.4);
                              const textColor = hasViolation
                                ? '#991b1b'
                                : !a.staff_id
                                ? '#92400e'
                                : clientColor;
                              return (
                                <div
                                  className="w-full rounded px-1.5 py-1 text-xs transition-colors overflow-hidden"
                                  style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
                                >
                                  {!hasViolation && a.staff_id && (
                                    <div
                                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                                      style={{ backgroundColor: clientColor }}
                                    />
                                  )}
                                  <div className="pl-1.5 flex items-start gap-1 justify-between">
                                    <button
                                      onClick={() => setEditingCell(isEditing ? null : cellId)}
                                      className="flex-1 text-left min-w-0"
                                    >
                                      <div className="truncate">
                                        {isFirst && (
                                          <div className="flex items-center gap-0.5">
                                            <GripVertical size={9} className="opacity-30 flex-shrink-0 cursor-grab" />
                                            <span className="font-bold block leading-tight truncate" style={{ color: textColor }}>
                                              {staffObj ? staffObj.name : <em className="font-normal">Unassigned</em>}
                                            </span>
                                          </div>
                                        )}
                                        {clientObj && (
                                          <span className="truncate text-[10px] opacity-80" style={{ color: textColor }}>
                                            {clientObj.first_name} {clientObj.last_name}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      {isFirst && (
                                        <button
                                          title={note?.submitted ? 'Note submitted' : 'Note missing'}
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
                              );
                            })()}

                            {hasViolation && (
                              <div className="absolute bottom-full left-0 mb-1 z-20 bg-red-800 text-white text-xs rounded-lg px-2 py-1 w-52 shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal">
                                {a.violation_reason}
                              </div>
                            )}

                            {isEditing && (
                              <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-48">
                                <div className="px-3 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">Reassign Staff</div>
                                <button
                                  onClick={() => { onUpdateAssignment(a.id, null); setEditingCell(null); }}
                                  className="w-full text-left px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  — Unassign
                                </button>
                                {eligible.sort((x, y) => x.priority_tier - y.priority_tier).map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => { onUpdateAssignment(a.id, s.id); setEditingCell(null); }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-aqua-50 flex items-center justify-between ${a.staff_id === s.id ? 'text-aqua-600 font-semibold' : 'text-slate-700'}`}
                                  >
                                    <span>{s.name}</span>
                                    <span className="text-slate-400">T{s.priority_tier}</span>
                                  </button>
                                ))}
                                <div className="border-t border-slate-100 mt-1 pt-1">
                                  <div className="px-3 py-1 text-xs text-slate-400 font-medium flex items-center gap-1">
                                    <Clock size={10} /> End session at
                                  </div>
                                  <div className="max-h-32 overflow-y-auto">
                                    {endTimeOptions.map((t) => (
                                      <button
                                        key={t}
                                        onClick={() => { onUpdateEndTime(a.id, t); setEditingCell(null); }}
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${a.time_end?.slice(0, 5) === t ? 'text-blue-600 font-semibold' : 'text-slate-600'}`}
                                      >
                                        {formatTime(t)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="border-t border-slate-100 mt-1 pt-1">
                                  <button
                                    onClick={() => { onDeleteAssignment(a.id); setEditingCell(null); }}
                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
                                  >
                                    <Trash2 size={11} /> Remove session
                                  </button>
                                </div>
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
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex gap-4 flex-wrap px-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3 h-3 rounded border border-slate-200 bg-white relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          </div>Client color = who they are
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />Unassigned
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />Violation
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div
            className="w-3 h-3 rounded"
            style={{ background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 2px, #e2e8f0 2px, #e2e8f0 4px)' }}
          />Outside shift hours
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CheckCircle2 size={12} className="text-aqua-400" />Note submitted
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <FileText size={12} className="text-amber-500" />Note missing
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <GripVertical size={12} />Drag to move
        </div>
      </div>
    </div>
  );
}
