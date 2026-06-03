import React from 'react';
import type { Staff } from '../../lib/types';
import { Eye, AlertTriangle } from 'lucide-react';

interface SupervisionTrackerProps {
  staff: Staff[];
}

export function SupervisionTracker({ staff }: SupervisionTrackerProps) {
  const supervised = staff.filter((s) => s.is_active && s.supervision_hours_required > 0);

  if (!supervised.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye size={14} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Supervision Hours</h3>
      </div>
      <div className="space-y-2.5">
        {supervised.map((s) => {
          const received = s.supervision_hours_this_week ?? 0;
          const required = s.supervision_hours_required;
          const pct = Math.min((received / required) * 100, 100);
          const met = received >= required;
          const close = received >= required * 0.75 && !met;

          return (
            <div key={s.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-700 font-medium truncate max-w-[100px]">{s.name}</span>
                <div className="flex items-center gap-1">
                  {!met && received < required * 0.5 && (
                    <AlertTriangle size={10} className="text-amber-500" />
                  )}
                  <span className={`text-xs font-semibold tabular-nums ${
                    met ? 'text-aqua-500' : close ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    {received}h / {required}h
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    met ? 'bg-aqua-300' : close ? 'bg-amber-400' : 'bg-slate-300'
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
