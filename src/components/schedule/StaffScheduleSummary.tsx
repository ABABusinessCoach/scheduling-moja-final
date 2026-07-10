import React, { useMemo, useRef } from 'react';
import type { ScheduleAssignment, Staff, DayOfWeek } from '../../lib/types';
import { DAY_SHORT, DAY_NAMES, formatTime } from '../../lib/types';
import { X, Copy, CheckCircle2, Printer } from 'lucide-react';

interface StaffScheduleSummaryProps {
  weekLabel: string;
  assignments: ScheduleAssignment[];
  staff: Staff[];
  onClose: () => void;
}

const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6];

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start.slice(0, 5))} - ${formatTime(end.slice(0, 5))}`;
}

export function StaffScheduleSummary({ weekLabel, assignments, staff, onClose }: StaffScheduleSummaryProps) {
  const [copied, setCopied] = React.useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const staffSchedules = useMemo(() => {
    const activeStaff = staff.filter((s) => s.is_active).sort((a, b) => a.name.localeCompare(b.name));

    return activeStaff.map((s) => {
      const staffAssignments = assignments.filter((a) => a.staff_id === s.id);
      const days = WEEKDAYS.map((day) => {
        const dayAssignments = staffAssignments
          .filter((a) => a.day_of_week === day)
          .sort((a, b) => (a.time_start ?? '').localeCompare(b.time_start ?? ''));
        return { day, assignments: dayAssignments };
      }).filter((d) => d.assignments.length > 0);

      const totalHours = staffAssignments.reduce((sum, a) => {
        if (a.time_start && a.time_end) {
          const [sh, sm] = a.time_start.slice(0, 5).split(':').map(Number);
          const [eh, em] = a.time_end.slice(0, 5).split(':').map(Number);
          return sum + (eh * 60 + em - sh * 60 - sm) / 60;
        }
        return sum;
      }, 0);

      return { staff: s, days, totalHours };
    }).filter((s) => s.days.length > 0);
  }, [assignments, staff]);

  function buildTextSummary(entry: typeof staffSchedules[0]): string {
    const lines = [`Schedule for ${entry.staff.name} - ${weekLabel}`, ''];
    for (const d of entry.days) {
      const shifts = d.assignments.map((a) =>
        a.time_start && a.time_end
          ? formatTimeRange(a.time_start, a.time_end)
          : a.shift
      );
      lines.push(`${DAY_NAMES[d.day]}: ${shifts.join(', ')}`);
    }
    lines.push('', `Total: ${entry.totalHours.toFixed(1)} hours`);
    return lines.join('\n');
  }

  function buildFullSummary(): string {
    return staffSchedules.map(buildTextSummary).join('\n\n---\n\n');
  }

  async function copyOne(entry: typeof staffSchedules[0]) {
    await navigator.clipboard.writeText(buildTextSummary(entry));
    setCopied(entry.staff.id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyAll() {
    await navigator.clipboard.writeText(buildFullSummary());
    setCopied('all');
    setTimeout(() => setCopied(null), 2000);
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html>
      <html><head><title>Staff Schedule - ${weekLabel}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1e293b; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; color: #64748b; margin-bottom: 24px; font-weight: normal; }
        .staff-card { break-inside: avoid; margin-bottom: 20px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .staff-name { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
        .day-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .day-label { width: 90px; font-weight: 500; color: #475569; }
        .shift-times { color: #1e293b; }
        .total { margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 500; }
        @media print { .staff-card { border: 1px solid #ccc; } }
      </style></head><body>
      <h1>Staff Schedule Summary</h1>
      <h2>${weekLabel}</h2>
      ${staffSchedules.map((entry) => `
        <div class="staff-card">
          <div class="staff-name">${entry.staff.name}</div>
          ${entry.days.map((d) => `
            <div class="day-row">
              <span class="day-label">${DAY_NAMES[d.day]}</span>
              <span class="shift-times">${d.assignments.map((a) =>
                a.time_start && a.time_end ? formatTimeRange(a.time_start, a.time_end) : a.shift
              ).join(' &bull; ')}</span>
            </div>
          `).join('')}
          <div class="total">${entry.totalHours.toFixed(1)} hours total</div>
        </div>
      `).join('')}
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900">Staff Schedule Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">{weekLabel} &mdash; Shift times only (no client names)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-50 shrink-0">
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            {copied === 'all' ? <CheckCircle2 size={13} className="text-green-600" /> : <Copy size={13} />}
            {copied === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Printer size={13} />
            Print
          </button>
        </div>

        {/* Staff list */}
        <div ref={printRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {staffSchedules.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              No assignments found. Generate a schedule first.
            </div>
          )}
          {staffSchedules.map((entry) => (
            <div
              key={entry.staff.id}
              className="rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
            >
              {/* Staff header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">{entry.staff.name}</span>
                  <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                    {entry.totalHours.toFixed(1)}h
                  </span>
                </div>
                <button
                  onClick={() => copyOne(entry)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-white rounded-md transition-colors"
                >
                  {copied === entry.staff.id ? (
                    <><CheckCircle2 size={12} className="text-green-600" /> Copied</>
                  ) : (
                    <><Copy size={12} /> Copy</>
                  )}
                </button>
              </div>

              {/* Day rows */}
              <div className="divide-y divide-slate-100">
                {entry.days.map((d) => (
                  <div key={d.day} className="flex items-center px-4 py-2.5">
                    <span className="w-20 text-xs font-medium text-slate-500 shrink-0">
                      {DAY_SHORT[d.day]}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {d.assignments.map((a, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          {a.time_start && a.time_end
                            ? formatTimeRange(a.time_start, a.time_end)
                            : a.shift}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
