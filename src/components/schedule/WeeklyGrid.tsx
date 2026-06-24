import React, { useState } from 'react';
import type {
  ScheduleAssignment,
  Staff,
  Client,
  DayOfWeek,
  AssignmentShift,
  ShiftDefinition,
} from '../../lib/types';
import { DAY_SHORT, DAY_NAMES, SHIFT_TIMES, timeWindowCovers, ALL_END_TIMES, formatTime } from '../../lib/types';
import { AlertTriangle, ChevronDown, GripVertical, Trash2, Clock } from 'lucide-react';

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${Math.floor(r * 0.45)}, ${Math.floor(g * 0.45)}, ${Math.floor(b * 0.45)})`;
}

interface WeeklyGridProps {
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  shifts: ShiftDefinition[];
  onUpdateAssignment: (id: string, staffId: string | null) => void;
  onMoveAssignment: (id: string, day: DayOfWeek, shift: AssignmentShift) => void;
  onDeleteAssignment: (id: string) => void;
  onUpdateEndTime: (id: string, newEndTime: string) => void;
  weekLabel: string;
}

export function WeeklyGrid({
  assignments,
  staff,
  clients,
  shifts,
  onUpdateAssignment,
  onMoveAssignment,
  onDeleteAssignment,
  onUpdateEndTime,
  weekLabel,
}: WeeklyGridProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
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

  const activeShifts = shifts.filter((s) => s.is_active);

  // Unique days across active shifts, sorted
  const activeDays = React.useMemo(() => {
    const daySet = new Set<DayOfWeek>();
    activeShifts.forEach((s) => s.days.forEach((d) => daySet.add(d as DayOfWeek)));
    return ([1, 2, 3, 4, 5, 6] as DayOfWeek[]).filter((d) => daySet.has(d));
  }, [activeShifts]);

  function getAssignment(day: DayOfWeek, shiftDef: ShiftDefinition, clientId: string) {
    const sStart = shiftDef.time_start.slice(0, 5);
    const sEnd = shiftDef.time_end.slice(0, 5);
    return assignments.find((a) => {
      if (a.day_of_week !== day || a.client_id !== clientId) return false;
      const aStart = (a.time_start ?? '').slice(0, 5);
      const aEnd = (a.time_end ?? '').slice(0, 5);
      if (!aStart || !aEnd) return a.shift === shiftDef.name;
      return timeWindowCovers(sStart, sEnd, aStart, aEnd) || timeWindowCovers(aStart, aEnd, sStart, sEnd);
    });
  }

  function getStaffName(staffId: string | null) {
    if (!staffId) return null;
    return staff.find((s) => s.id === staffId)?.name ?? null;
  }

  function clientCanAttend(client: Client, day: DayOfWeek, shiftDef: ShiftDefinition): boolean {
    const shiftStart = shiftDef.time_start.slice(0, 5);
    const shiftEnd = shiftDef.time_end.slice(0, 5);
    const avail = client.availability ?? [];
    if (!shiftDef.days.includes(day)) return false;
    if (avail.length === 0) {
      const attendsDay = (client.attendance ?? []).some((a) => a.day_of_week === day);
      if (!attendsDay || day === 6) return false;
      if (client.shift_type === 'FULL') return shiftDef.name === 'AM' || shiftDef.name === 'PM';
      if (client.shift_type === 'AM' && shiftDef.name === 'AM') return true;
      if (client.shift_type === 'PM' && shiftDef.name === 'PM') return true;
      return false;
    }
    return avail.some((a) => {
      if (a.day_of_week !== day) return false;
      if (a.time_start && a.time_end) {
        return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), shiftStart, shiftEnd);
      }
      return a.shift === 'FULL' || a.shift === shiftDef.name;
    });
  }

  function getEligibleStaff(day: DayOfWeek, shiftDef: ShiftDefinition, client: Client): Staff[] {
    const shiftStart = shiftDef.time_start.slice(0, 5);
    const shiftEnd = shiftDef.time_end.slice(0, 5);
    return staff.filter((s) => {
      if (!s.is_active) return false;
      const avail = s.availability ?? [];
      const canWork = avail.some((a) => {
        if (a.day_of_week !== day) return false;
        if (a.time_start && a.time_end) {
          return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), shiftStart, shiftEnd);
        }
        return a.shift === 'FULL' || a.shift === shiftDef.name;
      });
      if (!canWork) return false;
      if (client.no_male_therapists && s.gender === 'male') return false;
      return true;
    });
  }

  const activeClients = clients.filter((c) => c.is_active);

  function handleDragStart(e: React.DragEvent, assignmentId: string) {
    setDraggingId(assignmentId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-assignment-id', assignmentId);
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

  function handleDrop(e: React.DragEvent, day: DayOfWeek, shiftName: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-assignment-id');
    if (id) onMoveAssignment(id, day, shiftName as AssignmentShift);
    setDraggingId(null);
    setDragOver(null);
  }

  if (!activeShifts.length) {
    return <div className="text-center py-12 text-slate-400 text-sm">No active shifts configured.</div>;
  }

  return (
    <div className="overflow-x-auto" ref={containerRef}>
      <div style={{ minWidth: `${140 + activeDays.length * 120}px` }}>
        {/* Header */}
        <div
          className="grid bg-slate-50 rounded-t-xl border border-slate-200 border-b-0"
          style={{ gridTemplateColumns: `140px repeat(${activeDays.length}, 1fr)` }}
        >
          <div className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</div>
          {activeDays.map((d) => (
            <div key={d} className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide border-l border-slate-200">
              {DAY_SHORT[d]}
            </div>
          ))}
        </div>

        {activeShifts.map((shiftDef) => {
          const shiftClients = activeClients.filter((c) =>
            shiftDef.days.some((d) => clientCanAttend(c, d as DayOfWeek, shiftDef))
          );
          if (!shiftClients.length) return null;

          return (
            <div key={shiftDef.id}>
              <div
                className="border border-slate-200 border-t-0 px-3 py-2 text-white text-xs font-semibold flex items-center gap-2"
                style={{ background: shiftDef.color }}
              >
                <span>{shiftDef.label}</span>
                <span className="opacity-70 font-normal">{shiftDef.time_start.slice(0, 5)} – {shiftDef.time_end.slice(0, 5)}</span>
              </div>

              {shiftClients.map((client) => (
                <div
                  key={`${shiftDef.id}-${client.id}`}
                  className="grid border border-slate-200 border-t-0 hover:bg-slate-50/50 transition-colors"
                  style={{ gridTemplateColumns: `140px repeat(${activeDays.length}, 1fr)` }}
                >
                  <div className="px-3 py-3 flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: client.color || '#0ea5e9' }}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{client.first_name} {client.last_name}</div>
                      {client.no_male_therapists && <div className="text-xs text-amber-600">F only</div>}
                    </div>
                  </div>

                  {activeDays.map((day) => {
                    const attends = clientCanAttend(client, day, shiftDef);
                    const assignment = getAssignment(day, shiftDef, client.id);
                    const staffName = getStaffName(assignment?.staff_id ?? null);
                    const hasViolation = !!assignment?.violation_reason;
                    const isManual = !!assignment?.is_manual_override;
                    const cellId = `${shiftDef.id}-${client.id}-${day}`;
                    const isEditing = editingCell === cellId;
                    const dropKey = `drop-${shiftDef.id}-${day}`;
                    const isDragTarget = dragOver === dropKey;
                    const isBeingDragged = draggingId === assignment?.id;
                    const eligibleStaff = getEligibleStaff(day, shiftDef, client);
                    const endTimeOptions = ALL_END_TIMES.filter(
                      (t) => assignment?.time_start && t > assignment.time_start.slice(0, 5)
                    );
                    const clientColor = client.color || '#0ea5e9';

                    return (
                      <div
                        key={day}
                        className={`px-2 py-2.5 border-l border-slate-200 relative transition-colors ${
                          !attends ? 'bg-slate-50' : isDragTarget ? 'ring-2 ring-inset ring-aqua-400' : ''
                        }`}
                        onDragOver={(e) => attends && handleDragOver(e, dropKey)}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => attends && handleDrop(e, day, shiftDef.name)}
                      >
                        {!attends ? (
                          <span className="text-slate-200 text-xs">—</span>
                        ) : (
                          <div className="relative">
                            {assignment ? (
                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, assignment.id)}
                                onDragEnd={handleDragEnd}
                                className={`group transition-opacity ${isBeingDragged ? 'opacity-40' : 'opacity-100'}`}
                              >
                                <button
                                  onClick={() => setEditingCell(isEditing ? null : cellId)}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-grab active:cursor-grabbing border"
                                  style={
                                    hasViolation
                                      ? { backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }
                                      : !assignment.staff_id
                                      ? { backgroundColor: '#fffbeb', borderColor: '#fcd34d', color: '#b45309' }
                                      : {
                                          backgroundColor: hexToRgba(clientColor, 0.15),
                                          borderColor: hexToRgba(clientColor, 0.45),
                                          color: darkenHex(clientColor),
                                        }
                                  }
                                >
                                  <GripVertical size={10} className="text-current opacity-40 flex-shrink-0 -ml-0.5" />
                                  <span className="flex-1 truncate">
                                    {staffName ?? <span className="italic font-normal">Unassigned</span>}
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
                              </div>
                            ) : (
                              <div className="w-full px-2 py-1.5 rounded-lg border border-dashed border-slate-200 text-xs text-slate-300 italic text-center">
                                empty
                              </div>
                            )}

                            {isEditing && (
                              <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-44">
                                <div className="px-3 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">Assign Staff</div>
                                <button
                                  onClick={() => { if (assignment) onUpdateAssignment(assignment.id, null); setEditingCell(null); }}
                                  className="w-full text-left px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  — Unassign
                                </button>
                                {eligibleStaff.sort((a, b) => a.priority_tier - b.priority_tier).map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => { if (assignment) onUpdateAssignment(assignment.id, s.id); setEditingCell(null); }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-aqua-50 transition-colors flex items-center justify-between ${assignment?.staff_id === s.id ? 'text-aqua-600 font-semibold' : 'text-slate-700'}`}
                                  >
                                    <span>{s.name}</span>
                                    <span className="text-slate-400">T{s.priority_tier}</span>
                                  </button>
                                ))}
                                {assignment && endTimeOptions.length > 0 && (
                                  <div className="border-t border-slate-100 mt-1 pt-1">
                                    <div className="px-3 py-1 text-xs text-slate-400 font-medium flex items-center gap-1">
                                      <Clock size={10} /> End session at
                                    </div>
                                    <div className="max-h-32 overflow-y-auto">
                                      {endTimeOptions.map((t) => (
                                        <button
                                          key={t}
                                          onClick={() => { onUpdateEndTime(assignment.id, t); setEditingCell(null); }}
                                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${assignment.time_end?.slice(0, 5) === t ? 'text-blue-600 font-semibold' : 'text-slate-600'}`}
                                        >
                                          {formatTime(t)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {assignment && (
                                  <div className="border-t border-slate-100 mt-1 pt-1">
                                    <button
                                      onClick={() => { onDeleteAssignment(assignment.id); setEditingCell(null); }}
                                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
                                    >
                                      <Trash2 size={11} /> Remove session
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}

        {/* Legend */}
        <div className="border border-slate-200 border-t-0 rounded-b-xl px-4 py-3 bg-white flex gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.45)' }} />Client color = assigned
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />Unassigned
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <AlertTriangle size={12} className="text-red-500" />Violation
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <GripVertical size={12} />Drag to move
          </div>
        </div>
      </div>
    </div>
  );
}
