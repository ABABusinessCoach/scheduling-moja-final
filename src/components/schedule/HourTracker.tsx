import React, { useEffect, useState } from 'react';
import type { Staff, ScheduleAssignment, DayOfWeek, AssignmentShift } from '../../lib/types';
import { DAY_SHORT, SHIFT_TIMES } from '../../lib/types';
import { calculateStaffHours } from '../../lib/scheduler';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface HourTrackerProps {
  staff: Staff[];
  assignments: ScheduleAssignment[];
}

export function HourTracker({ staff, assignments }: HourTrackerProps) {
  const hoursData = calculateStaffHours(staff, assignments);

  if (!hoursData.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Weekly Hours Tracker</h3>
      <div className="space-y-2">
        {hoursData.map((h) => {
          const pct = Math.min((h.assignedHours / h.weeklyGoal) * 100, 100);
          return (
            <div key={h.staffId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">{h.staffName}</span>
                <div className="flex items-center gap-1.5">
                  {h.status === 'over' && <TrendingUp size={12} className="text-red-500" />}
                  {h.status === 'at' && <Minus size={12} className="text-aqua-400" />}
                  {h.status === 'under' && <TrendingDown size={12} className="text-amber-500" />}
                  <span className={`text-xs font-semibold ${
                    h.status === 'over' ? 'text-red-600' :
                    h.status === 'at' ? 'text-aqua-500' :
                    'text-amber-600'
                  }`}>
                    {h.assignedHours.toFixed(1)}h
                  </span>
                  <span className="text-xs text-slate-400">/ {h.weeklyGoal}h</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    h.status === 'over' ? 'bg-red-500' :
                    h.status === 'at' ? 'bg-aqua-300' :
                    'bg-amber-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
