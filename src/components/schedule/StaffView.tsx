import React from 'react';
import type { Staff, ScheduleAssignment, DayOfWeek, ShiftDefinition } from '../../lib/types';
import { DAY_SHORT, timeWindowCovers } from '../../lib/types';
import { calculateStaffHours } from '../../lib/scheduler';
import { AlertTriangle } from 'lucide-react';

interface StaffViewProps {
  staff: Staff[];
  assignments: ScheduleAssignment[];
  shifts: ShiftDefinition[];
}

const LABEL_STYLES = [
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-blue-100',  text: 'text-blue-700'  },
  { bg: 'bg-teal-100',  text: 'text-teal-700'  },
  { bg: 'bg-rose-100',  text: 'text-rose-700'  },
  { bg: 'bg-violet-100',text: 'text-violet-700'},
  { bg: 'bg-green-100', text: 'text-green-700' },
];

function findAssignment(
  staffAssignments: ScheduleAssignment[],
  day: DayOfWeek,
  shift: ShiftDefinition
): ScheduleAssignment | undefined {
  const sStart = shift.time_start.slice(0, 5);
  const sEnd = shift.time_end.slice(0, 5);
  return staffAssignments.find((a) => {
    if (a.day_of_week !== day) return false;
    const aStart = (a.time_start ?? '').slice(0, 5);
    const aEnd = (a.time_end ?? '').slice(0, 5);
    if (aStart && aEnd) {
      return timeWindowCovers(sStart, sEnd, aStart, aEnd) || timeWindowCovers(aStart, aEnd, sStart, sEnd);
    }
    return a.shift === shift.name;
  });
}

export function StaffView({ staff, assignments, shifts }: StaffViewProps) {
  const hoursData = calculateStaffHours(staff, assignments);
  const activeShifts = shifts.filter((s) => s.is_active);
  const activeDays = ([1, 2, 3, 4, 5, 6] as DayOfWeek[]).filter((d) =>
    activeShifts.some((s) => s.days.includes(d))
  );

  return (
    <div className="space-y-4">
      {staff
        .filter((s) => s.is_active)
        .sort((a, b) => a.priority_tier - b.priority_tier || a.name.localeCompare(b.name))
        .map((s) => {
          const staffAssignments = assignments.filter((a) => a.staff_id === s.id);
          const hours = hoursData.find((h) => h.staffId === s.id);

          // Only show shifts that have at least one assignment for this staff member
          const relevantShifts = activeShifts.filter((shift) =>
            activeDays.some((d) => !!findAssignment(staffAssignments, d, shift))
          );

          return (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-aqua-100 flex items-center justify-center text-aqua-600 font-semibold text-sm">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 text-sm">{s.name}</span>
                    <span className="ml-2 text-xs text-slate-400">Tier {s.priority_tier}</span>
                  </div>
                </div>
                {hours && (
                  <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    hours.status === 'over' ? 'bg-red-100 text-red-700' :
                    hours.status === 'at'   ? 'bg-aqua-100 text-aqua-600' :
                                              'bg-amber-100 text-amber-700'
                  }`}>
                    {hours.assignedHours.toFixed(1)}h / {hours.weeklyGoal}h
                  </div>
                )}
              </div>

              {staffAssignments.length === 0 ? (
                <div className="px-4 py-4 text-center text-slate-400 text-sm">No assignments this week</div>
              ) : (
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
                      {(relevantShifts.length > 0 ? relevantShifts : activeShifts).map((shift, idx) => {
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
                              const assignment = findAssignment(staffAssignments, day, shift);
                              const client = assignment?.client;
                              return (
                                <td key={day} className="px-2 py-2.5 text-center">
                                  {client ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="flex items-center gap-1">
                                        <span
                                          className="w-2 h-2 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: client.color || '#0ea5e9' }}
                                        />
                                        <span className={`font-medium ${assignment!.violation_reason ? 'text-red-600' : 'text-slate-700'}`}>
                                          {client.first_name} {client.last_name}
                                        </span>
                                      </div>
                                      {assignment!.violation_reason && (
                                        <AlertTriangle size={11} className="text-red-500" title={assignment!.violation_reason} />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-200">—</span>
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
              )}
            </div>
          );
        })}
    </div>
  );
}
