import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ScheduleAssignment, Staff, Client } from '../../lib/types';
import { DAY_NAMES, formatTime } from '../../lib/types';
import { X, Bell, Loader2, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';

interface ShiftOfferModalProps {
  assignment: ScheduleAssignment;
  staff: Staff[];
  clients: Client[];
  onClose: () => void;
  onOffered: () => void;
}

export function ShiftOfferModal({ assignment, staff, clients, onClose, onOffered }: ShiftOfferModalProps) {
  const client = clients.find((c) => c.id === assignment.client_id);
  const timeLabel =
    assignment.time_start && assignment.time_end
      ? `${formatTime(assignment.time_start.slice(0, 5))} – ${formatTime(assignment.time_end.slice(0, 5))}`
      : assignment.shift ?? '';

  // Eligible staff: active, has email, not already assigned to this slot
  const eligible = staff.filter(
    (s) => s.is_active && s.email && (!client?.no_male_therapists || s.gender !== 'male')
  );

  const [selected, setSelected] = useState<Set<string>>(new Set(eligible.map((s) => s.id)));
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ offer_id: string; notified: number; results: { name: string; email: string; status: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    if (!selected.size) return;
    setSending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const appUrl = window.location.origin + window.location.pathname;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-open-shift`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            assignment_id: assignment.id,
            staff_ids: Array.from(selected),
            notes,
            app_url: appUrl,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send notifications');
      setResult(json);
      onOffered();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const noEmailStaff = staff.filter((s) => s.is_active && !s.email);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell size={17} className="text-accent-500" />
            <span className="font-semibold text-slate-900">Offer Open Shift</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Shift summary */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-800">
              {client ? `${client.first_name} ${client.last_name}` : 'Unknown client'}
            </div>
            <div className="text-slate-500 text-xs mt-0.5">
              {DAY_NAMES[assignment.day_of_week]} · {timeLabel}
            </div>
          </div>

          {result ? (
            /* Success state */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <CheckCircle2 size={16} />
                Notified {result.notified} staff member{result.notified !== 1 ? 's' : ''}
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.results.map((r) => (
                  <div key={r.email || r.name} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className={`text-xs ${r.status === 'sent' ? 'text-green-600' : 'text-amber-600'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
              <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Optional note */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Note to staff (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Please bring your session materials."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-300 resize-none"
                />
              </div>

              {/* Staff selector */}
              {eligible.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notify staff</label>
                    <button
                      onClick={() => setSelected(selected.size === eligible.length ? new Set() : new Set(eligible.map((s) => s.id)))}
                      className="text-xs text-accent-500 hover:text-accent-600 font-medium"
                    >
                      {selected.size === eligible.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {eligible.sort((a, b) => a.priority_tier - b.priority_tier).map((s) => (
                      <label key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggle(s.id)}
                          className="w-4 h-4 rounded border-slate-300 text-accent-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800">{s.name}</div>
                          <div className="text-xs text-slate-400 truncate flex items-center gap-1">
                            <Mail size={9} /> {s.email}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">T{s.priority_tier}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No active staff with email addresses found.
                </div>
              )}

              {noEmailStaff.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-0.5">
                    <AlertTriangle size={11} /> No email on file
                  </div>
                  <div className="text-xs text-amber-600">{noEmailStaff.map((s) => s.name).join(', ')}</div>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={sending || selected.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  {sending ? 'Sending…' : `Notify ${selected.size} staff`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
