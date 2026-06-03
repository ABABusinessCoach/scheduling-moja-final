import React from 'react';
import type { Staff, ScheduleAssignment, DayOfWeek, AssignmentShift } from '../../lib/types';
import { DAY_SHORT, DAY_NAMES, SHIFT_TIMES } from '../../lib/types';
import { calculateStaffHours } from '../../lib/scheduler';
import { AlertTriangle } from 'lucide-react';

interface StaffViewProps {
  staff: Staff[];
  assignments: ScheduleAssignment[];
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
const SHIFTS: AssignmentShift[] = ['AM', 'PM'];

export function StaffView({ staff, assignments }: StaffViewProps) {
  const hoursData = calculateStaffHours(staff, assignments);

  return (
    <div className="space-y-4">
      {staff.filter((s) => s.is_active).sort((a, b) => a.priority_tier - b.priority_tier).map((s) => {
        const staffAssignments = assignments.filter((a) => a.staff_id === s.id);
        const hours = hoursData.find((h) => h.staffId === s.id);

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
                  hours.status === 'at' ? 'bg-aqua-100 text-aqua-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {hours.assignedHours.toFixed(1)}h / {hours.weeklyGoal}h
                </div>
              )}
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
                  {SHIFTS.map((shift) => (
                    <tr key={shift} className="border-b border-slate-50">
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                          shift === 'AM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>{shift}</span>
                      </td>
                      {DAYS.map((day) => {
                        const assignment = staffAssignments.find(
                          (a) => a.day_of_week === day && a.shift === shift
                        );
                        const client = assignment?.client;
                        return (
                          <td key={day} className="px-2 py-2.5 text-center">
                            {client ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`font-medium ${assignment.violation_reason ? 'text-red-600' : 'text-slate-700'}`}>
                                  {client.first_name} {client.last_name}
                                </span>
                                {assignment.violation_reason && (
                                  <AlertTriangle size={11} className="text-red-500" title={assignment.violation_reason} />
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-200">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {staffAssignments.length === 0 && (
              <div className="px-4 py-4 text-center text-slate-400 text-sm">No assignments this week</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
