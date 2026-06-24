import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Staff } from '../../lib/types';
import { X, Send, Mail, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface SendScheduleModalProps {
  weekLabel: string;
  weekStart: string;
  staff: Staff[];
  onClose: () => void;
}

export function SendScheduleModal({ weekLabel, weekStart, staff, onClose }: SendScheduleModalProps) {
  const staffWithEmail = staff.filter((s) => s.is_active && s.email);
  const staffWithoutEmail = staff.filter((s) => s.is_active && !s.email);

  const [selected, setSelected] = useState<Set<string>>(new Set(staffWithEmail.map((s) => s.id)));
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; results: { name: string; email: string; status: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendSchedule() {
    if (!selected.size) return;
    setSending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-schedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ week_start: weekStart, staff_ids: Array.from(selected) }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');
      setResult(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-accent-500" />
            <span className="font-semibold text-slate-900">Send Schedule</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Week label */}
          <p className="text-sm text-slate-500">
            Sending schedule for <span className="font-semibold text-slate-800">{weekLabel}</span>
          </p>

          {result ? (
            /* Success state */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle2 size={16} />
                <span>Sent to {result.sent} staff member{result.sent !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {result.results.map((r) => (
                  <div key={r.email} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className={r.status === 'sent' ? 'text-green-600 text-xs' : 'text-red-500 text-xs'}>{r.status}</span>
                  </div>
                ))}
              </div>
              <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Staff with emails */}
              {staffWithEmail.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select Recipients</div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {staffWithEmail.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggle(s.id)}
                          className="w-4 h-4 rounded border-slate-300 text-accent-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800">{s.name}</div>
                          <div className="text-xs text-slate-400 truncate">{s.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Staff without emails */}
              {staffWithoutEmail.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-1">
                    <AlertTriangle size={12} /> No email on file
                  </div>
                  <div className="text-xs text-amber-600">
                    {staffWithoutEmail.map((s) => s.name).join(', ')}
                  </div>
                </div>
              )}

              {staffWithEmail.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No staff have email addresses. Add emails in each staff member's profile.
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={sendSchedule}
                  disabled={sending || selected.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? 'Sending…' : `Send to ${selected.size}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
