import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ShiftDefinition, BreakTime, DayOfWeek } from '../../lib/types';
import { DAY_SHORT, TIME_SLOTS } from '../../lib/types';
import { X, Plus, Trash2, Clock, Coffee, CalendarRange, Pencil, Check } from 'lucide-react';

interface ShiftManagerProps {
  shifts: ShiftDefinition[];
  breakTimes: BreakTime[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

type Tab = 'shifts' | 'breaks';

const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
const ALL_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6];

const SHIFT_COLORS = [
  '#0891b2', '#0d9488', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#2563eb', '#64748b', '#374151',
];

function DayPills({
  selected,
  onChange,
  days,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
  days: DayOfWeek[];
}) {
  function toggle(d: DayOfWeek) {
    onChange(
      selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d].sort()
    );
  }
  return (
    <div className="flex gap-1 flex-wrap">
      {days.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
            selected.includes(d)
              ? 'bg-aqua-500 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {DAY_SHORT[d]}
        </button>
      ))}
    </div>
  );
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="form-input py-1.5 text-xs"
    >
      {TIME_SLOTS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

export function ShiftManager({ shifts, breakTimes, onClose, onRefresh }: ShiftManagerProps) {
  const [tab, setTab] = useState<Tab>('shifts');
  const [saving, setSaving] = useState(false);

  // Shift form state
  const [newShiftLabel, setNewShiftLabel] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('15:30');
  const [newShiftDays, setNewShiftDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newShiftColor, setNewShiftColor] = useState(SHIFT_COLORS[0]);
  const [newShiftDateStart, setNewShiftDateStart] = useState('');
  const [newShiftDateEnd, setNewShiftDateEnd] = useState('');

  // Break form state
  const [newBreakName, setNewBreakName] = useState('');
  const [newBreakStart, setNewBreakStart] = useState('10:00');
  const [newBreakEnd, setNewBreakEnd] = useState('10:30');
  const [newBreakDays, setNewBreakDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Inline break editing state
  const [editingBreakId, setEditingBreakId] = useState<string | null>(null);
  const [editBreakName, setEditBreakName] = useState('');
  const [editBreakStart, setEditBreakStart] = useState('');
  const [editBreakEnd, setEditBreakEnd] = useState('');
  const [editBreakDays, setEditBreakDays] = useState<number[]>([]);

  function startEditBreak(b: BreakTime) {
    setEditingBreakId(b.id);
    setEditBreakName(b.name);
    setEditBreakStart(b.time_start.slice(0, 5));
    setEditBreakEnd(b.time_end.slice(0, 5));
    setEditBreakDays(b.days);
  }

  async function saveBreakEdit() {
    if (!editingBreakId) return;
    setSaving(true);
    await supabase.from('break_times').update({
      name: editBreakName.trim(),
      time_start: editBreakStart,
      time_end: editBreakEnd,
      days: editBreakDays,
    }).eq('id', editingBreakId);
    await onRefresh();
    setEditingBreakId(null);
    setSaving(false);
  }

  async function addShift() {
    if (!newShiftLabel.trim() || newShiftDays.length === 0) return;
    setSaving(true);
    const name = newShiftLabel.toUpperCase().replace(/\s+/g, '_');
    await supabase.from('shifts').insert({
      name,
      label: newShiftLabel.trim(),
      time_start: newShiftStart,
      time_end: newShiftEnd,
      days: newShiftDays,
      color: newShiftColor,
      sort_order: shifts.length,
      is_active: true,
      date_start: newShiftDateStart || null,
      date_end: newShiftDateEnd || null,
    });
    await onRefresh();
    setNewShiftLabel('');
    setNewShiftStart('08:00');
    setNewShiftEnd('14:30');
    setNewShiftDays([1, 2, 3, 4, 5]);
    setNewShiftDateStart('');
    setNewShiftDateEnd('');
    setSaving(false);
  }

  async function toggleShiftActive(id: string, current: boolean) {
    await supabase.from('shifts').update({ is_active: !current }).eq('id', id);
    await onRefresh();
  }

  async function deleteShift(id: string) {
    if (!window.confirm('Delete this shift? Existing assignments using this shift will remain.')) return;
    await supabase.from('shifts').delete().eq('id', id);
    await onRefresh();
  }

  async function addBreak() {
    if (!newBreakName.trim()) return;
    setSaving(true);
    await supabase.from('break_times').insert({
      name: newBreakName.trim(),
      time_start: newBreakStart,
      time_end: newBreakEnd,
      days: newBreakDays,
      is_active: true,
      sort_order: breakTimes.length,
    });
    await onRefresh();
    setNewBreakName('');
    setNewBreakStart('10:00');
    setNewBreakEnd('10:30');
    setNewBreakDays([1, 2, 3, 4, 5]);
    setSaving(false);
  }

  async function toggleBreakActive(id: string, current: boolean) {
    await supabase.from('break_times').update({ is_active: !current }).eq('id', id);
    await onRefresh();
  }

  async function deleteBreak(id: string) {
    await supabase.from('break_times').delete().eq('id', id);
    await onRefresh();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-slate-900">Shift & Break Manager</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setTab('shifts')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'shifts' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Clock size={14} /> Shifts
          </button>
          <button
            onClick={() => setTab('breaks')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'breaks' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Coffee size={14} /> Breaks
          </button>
        </div>

        <div className="p-6 space-y-5">
          {tab === 'shifts' ? (
            <>
              {/* Existing shifts */}
              {shifts.length > 0 && (
                <div className="space-y-2">
                  {shifts.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">{s.label}</span>
                          {s.date_start && s.date_end && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px] font-semibold flex-shrink-0">
                              <CalendarRange size={9} /> Seasonal
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.time_start.slice(0, 5)} – {s.time_end.slice(0, 5)} &middot;{' '}
                          {s.days.map((d) => DAY_SHORT[d as DayOfWeek]).join(', ')}
                          {s.date_start && s.date_end && (
                            <span className="ml-1 text-sky-600">· {s.date_start} – {s.date_end}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleShiftActive(s.id, s.is_active)}
                        className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${s.is_active ? 'bg-aqua-100 text-aqua-700 hover:bg-aqua-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {s.is_active ? 'Active' : 'Off'}
                      </button>
                      <button
                        onClick={() => deleteShift(s.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add shift form */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Plus size={14} /> Add Shift
                </h3>
                <div>
                  <label className="form-label">Shift Name</label>
                  <input
                    className="form-input"
                    value={newShiftLabel}
                    onChange={(e) => setNewShiftLabel(e.target.value)}
                    placeholder="e.g. AM, Evening, Saturday AM"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Start</label>
                    <TimeSelect value={newShiftStart} onChange={setNewShiftStart} label="Start time" />
                  </div>
                  <div>
                    <label className="form-label">End</label>
                    <TimeSelect value={newShiftEnd} onChange={setNewShiftEnd} label="End time" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Days</label>
                  <DayPills selected={newShiftDays} onChange={setNewShiftDays} days={ALL_DAYS} />
                </div>
                <div>
                  <label className="form-label">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {SHIFT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewShiftColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform ${newShiftColor === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label flex items-center gap-1">
                    <CalendarRange size={12} /> Seasonal Date Range <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">From</label>
                      <input
                        type="date"
                        className="form-input py-1.5 text-xs"
                        value={newShiftDateStart}
                        onChange={(e) => setNewShiftDateStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">To</label>
                      <input
                        type="date"
                        className="form-input py-1.5 text-xs"
                        value={newShiftDateEnd}
                        onChange={(e) => setNewShiftDateEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Leave blank for a permanent shift. Set dates for seasonal shifts like summer.</p>
                </div>
                <button
                  onClick={addShift}
                  disabled={saving || !newShiftLabel.trim() || newShiftDays.length === 0}
                  className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Add Shift
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Existing breaks */}
              {breakTimes.length > 0 && (
                <div className="space-y-2">
                  {breakTimes.map((b) => (
                    <div key={b.id} className="bg-rose-50 rounded-xl border border-rose-100 overflow-hidden">
                      {editingBreakId === b.id ? (
                        <div className="p-3 space-y-2">
                          <input
                            className="form-input text-sm py-1.5"
                            value={editBreakName}
                            onChange={(e) => setEditBreakName(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Start</label>
                              <TimeSelect value={editBreakStart} onChange={setEditBreakStart} label="Edit break start" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">End</label>
                              <TimeSelect value={editBreakEnd} onChange={setEditBreakEnd} label="Edit break end" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Days (empty = all)</label>
                            <DayPills selected={editBreakDays} onChange={setEditBreakDays} days={ALL_DAYS} />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={saveBreakEdit}
                              disabled={saving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                              <Check size={12} /> Save
                            </button>
                            <button
                              onClick={() => setEditingBreakId(null)}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800">{b.name}</div>
                            <div className="text-xs text-slate-500">
                              {b.time_start.slice(0, 5)} – {b.time_end.slice(0, 5)} &middot;{' '}
                              {b.days.length === 0 ? 'All days' : b.days.map((d) => DAY_SHORT[d as DayOfWeek]).join(', ')}
                            </div>
                          </div>
                          <button
                            onClick={() => startEditBreak(b)}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                            title="Edit break"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => toggleBreakActive(b.id, b.is_active)}
                            className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${b.is_active ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                          >
                            {b.is_active ? 'Active' : 'Off'}
                          </button>
                          <button
                            onClick={() => deleteBreak(b.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add break form */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Plus size={14} /> Add Break
                </h3>
                <div>
                  <label className="form-label">Break Name</label>
                  <input
                    className="form-input"
                    value={newBreakName}
                    onChange={(e) => setNewBreakName(e.target.value)}
                    placeholder="e.g. Morning Break, Lunch"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Start</label>
                    <TimeSelect value={newBreakStart} onChange={setNewBreakStart} label="Break start" />
                  </div>
                  <div>
                    <label className="form-label">End</label>
                    <TimeSelect value={newBreakEnd} onChange={setNewBreakEnd} label="Break end" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Days (empty = all days)</label>
                  <DayPills selected={newBreakDays} onChange={setNewBreakDays} days={ALL_DAYS} />
                </div>
                <button
                  onClick={addBreak}
                  disabled={saving || !newBreakName.trim()}
                  className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Add Break
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
