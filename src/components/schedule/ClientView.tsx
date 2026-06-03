import React from 'react';
import type { Client, ScheduleAssignment, DayOfWeek, AssignmentShift } from '../../lib/types';
import { DAY_SHORT, SHIFT_TIMES, timeWindowCovers } from '../../lib/types';
import { AlertTriangle } from 'lucide-react';

interface ClientViewProps {
  clients: Client[];
  assignments: ScheduleAssignment[];
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
const SHIFTS: AssignmentShift[] = ['AM', 'PM'];

function clientCanAttendShift(client: Client, day: DayOfWeek, shift: AssignmentShift): boolean {
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

function clientAttendsSomeDay(client: Client, shift: AssignmentShift): boolean {
  for (const d of DAYS) {
    if (clientCanAttendShift(client, d, shift)) return true;
  }
  return false;
}

export function ClientView({ clients, assignments }: ClientViewProps) {
  return (
    <div className="space-y-4">
      {clients.filter((c) => c.is_active).sort((a, b) => a.first_name.localeCompare(b.first_name)).map((c) => {
        const clientAssignments = assignments.filter((a) => a.client_id === c.id);

        return (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
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
                    <th className="text-left px-4 py-2 text-slate-500 font-medium w-16">Shift</th>
                    {DAYS.map((d) => (
                      <th key={d} className="text-center px-2 py-2 text-slate-500 font-medium">{DAY_SHORT[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHIFTS.map((shift) => {
                    if (!clientAttendsSomeDay(c, shift)) return null;

                    return (
                      <tr key={shift} className="border-b border-slate-50">
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            shift === 'AM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>{shift}</span>
                        </td>
                        {DAYS.map((day) => {
                          const attends = clientCanAttendShift(c, day, shift);
                          const assignment = clientAssignments.find(
                            (a) => a.day_of_week === day && a.shift === shift
                          );
                          const staffMember = assignment?.staff;

                          return (
                            <td key={day} className={`px-2 py-2.5 text-center ${!attends ? 'bg-slate-50' : ''}`}>
                              {!attends ? (
                                <span className="text-slate-200">—</span>
                              ) : staffMember ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`font-medium ${assignment.violation_reason ? 'text-red-600' : 'text-slate-700'}`}>
                                    {staffMember.name}
                                  </span>
                                  {assignment.violation_reason && (
                                    <AlertTriangle size={11} className="text-red-500" title={assignment.violation_reason} />
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
