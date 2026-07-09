import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { TimeOff } from '../../lib/types';
import { TIME_SLOTS, ALL_END_TIMES, formatTime } from '../../lib/types';
import { Plus, Trash2, CalendarOff, Clock } from 'lucide-react';

interface Props {
  staffId?: string;
  clientId?: string;
}

export function TimeOffManager({ staffId, clientId }: Props) {
  const [entries, setEntries] = useState<TimeOff[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // form fields
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [reason, setReason] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('12:00');

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

  function resetForm() {
    setDateStart('');
    setDateEnd('');
    setReason('');
    setIsPartial(false);
    setTimeStart('08:00');
    setTimeEnd('12:00');
  }

  async function save() {
    if (!dateStart || !dateEnd) return;
    setSaving(true);
    await supabase.from('time_off').insert({
      staff_id: staffId ?? null,
      client_id: clientId ?? null,
      date_start: dateStart,
      date_end: dateEnd,
      time_start: isPartial ? timeStart : null,
      time_end: isPartial ? timeEnd : null,
      reason: reason.trim(),
    });
    setAdding(false);
    resetForm();
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await supabase.from('time_off').delete().eq('id', id);
    setEntries((p) => p.filter((e) => e.id !== id));
  }

  function formatDateRange(s: string, e: string) {
    const fmt = (d: string) =>
      new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return s === e ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
  }

  const validEndTimes = ALL_END_TIMES.filter((t) => t > timeStart);

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
              <div className="text-xs font-medium text-slate-700">{formatDateRange(e.date_start, e.date_end)}</div>
              {e.time_start && e.time_end && (
                <div className="flex items-center gap-1 text-xs text-amber-700 mt-0.5">
                  <Clock size={10} />
                  {formatTime(e.time_start)} – {formatTime(e.time_end)}
                </div>
              )}
              {e.reason && <div className="text-xs text-slate-400 truncate mt-0.5">{e.reason}</div>}
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
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input py-1.5 text-xs"
                value={dateStart}
                onChange={(e) => {
                  setDateStart(e.target.value);
                  if (!dateEnd || e.target.value > dateEnd) setDateEnd(e.target.value);
                }}
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

          {/* All day vs partial */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setIsPartial(!isPartial)}
                className={`w-8 h-5 rounded-full relative transition-colors flex-shrink-0 ${isPartial ? 'bg-accent-400' : 'bg-slate-200'}`}
                style={{ height: '20px' }}
              >
                <span
                  className={`absolute top-0.5 bg-white rounded-full shadow transition-all`}
                  style={{ width: '16px', height: '16px', left: isPartial ? '14px' : '2px' }}
                />
              </button>
              <span className="text-xs font-medium text-slate-700">Partial shift only</span>
            </label>
          </div>

          {/* Time range — shown when partial */}
          {isPartial && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label flex items-center gap-1"><Clock size={10} /> Start Time</label>
                <select
                  className="form-input py-1.5 text-xs"
                  value={timeStart}
                  onChange={(e) => {
                    const ns = e.target.value;
                    setTimeStart(ns);
                    if (ns >= timeEnd) {
                      const next = ALL_END_TIMES.find((t) => t > ns);
                      if (next) setTimeEnd(next);
                    }
                  }}
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{formatTime(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label flex items-center gap-1"><Clock size={10} /> End Time</label>
                <select
                  className="form-input py-1.5 text-xs"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                >
                  {validEndTimes.map((t) => (
                    <option key={t} value={t}>{formatTime(t)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="form-label">Reason <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text"
              className="form-input py-1.5 text-xs"
              placeholder="e.g. Appointment, Vacation, Family"
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
              onClick={() => { setAdding(false); resetForm(); }}
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
