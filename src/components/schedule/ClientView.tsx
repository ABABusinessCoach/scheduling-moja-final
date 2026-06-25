import React from 'react';
import type { Client, ScheduleAssignment, DayOfWeek, ShiftDefinition } from '../../lib/types';
import { DAY_SHORT, timeWindowCovers } from '../../lib/types';
import { AlertTriangle } from 'lucide-react';

interface ClientViewProps {
  clients: Client[];
  assignments: ScheduleAssignment[];
  shifts: ShiftDefinition[];
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6];

function clientCanAttendShift(client: Client, day: DayOfWeek, shift: ShiftDefinition): boolean {
  if (!shift.days.includes(day)) return false;
  const shiftStart = shift.time_start.slice(0, 5);
  const shiftEnd = shift.time_end.slice(0, 5);
  const avail = client.availability ?? [];
  if (avail.length === 0) {
    const attendsDay = (client.attendance ?? []).some((a) => a.day_of_week === day);
    if (!attendsDay) return false;
    if (client.shift_type === 'FULL') return true;
    if (client.shift_type === 'AM' && shift.name === 'AM') return true;
    if (client.shift_type === 'PM' && shift.name === 'PM') return true;
    if (client.shift_type === 'CUSTOM') return shift.name === 'AM';
    return false;
  }
  return avail.some((a) => {
    if (a.day_of_week !== day) return false;
    if (a.time_start && a.time_end) {
      return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), shiftStart, shiftEnd);
    }
    return a.shift === 'FULL' || a.shift === shift.name;
  });
}

function findAssignment(
  clientAssignments: ScheduleAssignment[],
  day: DayOfWeek,
  shift: ShiftDefinition
): ScheduleAssignment | undefined {
  const sStart = shift.time_start.slice(0, 5);
  const sEnd = shift.time_end.slice(0, 5);
  return clientAssignments.find((a) => {
    if (a.day_of_week !== day) return false;
    const aStart = (a.time_start ?? '').slice(0, 5);
    const aEnd = (a.time_end ?? '').slice(0, 5);
    if (aStart && aEnd) {
      return timeWindowCovers(sStart, sEnd, aStart, aEnd) || timeWindowCovers(aStart, aEnd, sStart, sEnd);
    }
    return a.shift === shift.name;
  });
}

// Shift label colors — cycle through a palette based on index
const LABEL_STYLES = [
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-blue-100',  text: 'text-blue-700'  },
  { bg: 'bg-teal-100',  text: 'text-teal-700'  },
  { bg: 'bg-rose-100',  text: 'text-rose-700'  },
  { bg: 'bg-violet-100',text: 'text-violet-700'},
  { bg: 'bg-green-100', text: 'text-green-700' },
];

export function ClientView({ clients, assignments, shifts }: ClientViewProps) {
  const activeShifts = shifts.filter((s) => s.is_active);

  // Only show days that appear in at least one active shift
  const activeDays = DAYS.filter((d) => activeShifts.some((s) => s.days.includes(d)));

  return (
    <div className="space-y-4">
      {clients
        .filter((c) => c.is_active)
        .sort((a, b) => a.first_name.localeCompare(b.first_name))
        .map((c) => {
          const clientAssignments = assignments.filter((a) => a.client_id === c.id);

          // Only show shifts where client attends at least one active day
          const clientShifts = activeShifts.filter((shift) =>
            activeDays.some((d) => clientCanAttendShift(c, d, shift))
          );

          if (clientShifts.length === 0) return null;

          return (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50"
                style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: c.color || '#0ea5e9' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                  style={{ backgroundColor: (c.color || '#0ea5e9') + '28', color: c.color || '#0ea5e9' }}
                >
                  {c.first_name.slice(0, 1)}{c.last_name.slice(0, 1)}
                </div>
                <div>
                  <span className="font-semibold text-slate-900 text-sm">{c.first_name} {c.last_name}</span>
                  {c.no_male_therapists && (
                    <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Female only</span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2 text-slate-500 font-medium w-36">Shift</th>
                      {activeDays.map((d) => (
                        <th key={d} className="text-center px-2 py-2 text-slate-500 font-medium">
                          {DAY_SHORT[d]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientShifts.map((shift, idx) => {
                      const style = LABEL_STYLES[idx % LABEL_STYLES.length];
                      return (
                        <tr key={shift.id} className="border-b border-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold w-fit ${style.bg} ${style.text}`}>
                                {shift.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {shift.time_start.slice(0, 5)}–{shift.time_end.slice(0, 5)}
                              </span>
                            </div>
                          </td>
                          {activeDays.map((day) => {
                            const attends = clientCanAttendShift(c, day, shift);
                            const assignment = attends ? findAssignment(clientAssignments, day, shift) : undefined;
                            const staffMember = assignment?.staff;

                            return (
                              <td key={day} className={`px-2 py-2.5 text-center ${!attends ? 'bg-slate-50' : ''}`}>
                                {!attends ? (
                                  <span className="text-slate-200">—</span>
                                ) : staffMember ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={`font-medium ${assignment!.violation_reason ? 'text-red-600' : 'text-slate-700'}`}>
                                      {staffMember.name}
                                    </span>
                                    {assignment!.violation_reason && (
                                      <AlertTriangle size={11} className="text-red-500" title={assignment!.violation_reason} />
                                    )}
                                  </div>
                                ) : assignment ? (
                                  <span className="text-amber-500 italic">Unassigned</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
    </div>
  );
}
