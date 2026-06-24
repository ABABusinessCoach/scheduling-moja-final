import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { TimeOff } from '../../lib/types';
import { Plus, Trash2, CalendarOff } from 'lucide-react';

interface Props {
  staffId?: string;
  clientId?: string;
}

export function TimeOffManager({ staffId, clientId }: Props) {
  const [entries, setEntries] = useState<TimeOff[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (staffId || clientId) load();
  }, [staffId, clientId]);

  async function load() {
    const q = supabase.from('time_off').select('*').order('date_start');
    if (staffId) q.eq('staff_id', staffId);
    if (clientId) q.eq('client_id', clientId);
    const { data } = await q;
    setEntries(data ?? []);
  }

  async function save() {
    if (!dateStart || !dateEnd) return;
    setSaving(true);
    await supabase.from('time_off').insert({
      staff_id: staffId ?? null,
      client_id: clientId ?? null,
      date_start: dateStart,
      date_end: dateEnd,
      reason: reason.trim(),
    });
    setAdding(false);
    setDateStart('');
    setDateEnd('');
    setReason('');
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await supabase.from('time_off').delete().eq('id', id);
    setEntries((p) => p.filter((e) => e.id !== id));
  }

  function formatRange(s: string, e: string) {
    const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return s === e ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <CalendarOff size={14} className="text-slate-400" /> Time Off
        </h4>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-aqua-600 hover:text-aqua-700 font-medium transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {entries.length === 0 && !adding && (
        <p className="text-xs text-slate-400">No time off scheduled.</p>
      )}

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
            <CalendarOff size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-700">{formatRange(e.date_start, e.date_end)}</div>
              {e.reason && <div className="text-xs text-slate-400 truncate">{e.reason}</div>}
            </div>
            <button
              type="button"
              onClick={() => remove(e.id)}
              className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input py-1.5 text-xs"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input py-1.5 text-xs"
                value={dateEnd}
                min={dateStart}
                onChange={(e) => setDateEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Reason <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text"
              className="form-input py-1.5 text-xs"
              placeholder="e.g. Vacation, Medical, Family"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dateStart || !dateEnd}
              className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setDateStart(''); setDateEnd(''); setReason(''); }}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
