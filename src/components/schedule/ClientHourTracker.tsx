import React from 'react';
import type { Client, ScheduleAssignment } from '../../lib/types';
import { SHIFT_TIMES, slotDuration } from '../../lib/types';
import { Clock, AlertTriangle } from 'lucide-react';

interface ClientHourTrackerProps {
  clients: Client[];
  assignments: ScheduleAssignment[];
}

export function ClientHourTracker({ clients, assignments }: ClientHourTrackerProps) {
  const tracked = clients.filter(
    (c) => c.is_active && (c.authorized_hours_per_week || c.ramp_up_schedule?.length)
  );

  if (!tracked.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Client Auth. Hours</h3>
      </div>
      <div className="space-y-2.5">
        {tracked.map((c) => {
          const scheduledHours = assignments
            .filter((a) => a.client_id === c.id)
            .reduce((sum, a) => {
              if (a.time_start && a.time_end) {
                return sum + slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5));
              }
              return sum + SHIFT_TIMES[a.shift].hours;
            }, 0);

          const cap = c.authorized_hours_per_week;
          if (!cap) return null;

          const pct = Math.min((scheduledHours / cap) * 100, 100);
          const over = scheduledHours > cap;
          const close = scheduledHours >= cap * 0.9 && !over;

          return (
            <div key={c.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-700 font-medium truncate max-w-[100px]">
                  {c.first_name} {c.last_name}
                </span>
                <div className="flex items-center gap-1">
                  {(over || close) && <AlertTriangle size={10} className={over ? 'text-red-500' : 'text-amber-500'} />}
                  <span className={`text-xs font-semibold tabular-nums ${
                    over ? 'text-red-600' : close ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    {scheduledHours.toFixed(1)}h / {cap}h
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    over ? 'bg-red-500' : close ? 'bg-amber-400' : 'bg-aqua-300'
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
