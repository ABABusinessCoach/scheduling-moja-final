import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  Staff,
  Client,
  StaffClientRestriction,
  DayOfWeek,
  AvailabilityShift,
  Gender,
  EmploymentType,
  PriorityTier,
} from '../../lib/types';
import {
  DAY_NAMES,
  TIME_SLOTS,
  AVAILABILITY_PRESETS,
  ALL_SKILLS,
  formatTime,
} from '../../lib/types';
import { X } from 'lucide-react';

interface StaffFormProps {
  staff?: Staff | null;
  onSave: () => void;
  onCancel: () => void;
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];

interface DayWindow {
  day: DayOfWeek;
  enabled: boolean;
  start: string; // HH:MM
  end: string;   // HH:MM
}

/** All valid end times: every slot after the first one, plus 10:30 and 14:30 */
const END_TIMES = [...TIME_SLOTS.slice(1), '10:30', '14:30']
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort();

function shiftFromWindow(start: string, end: string): AvailabilityShift {
  if (start === '08:00' && end === '14:30') return 'FULL';
  if (start <= '08:00' && end <= '10:30') return 'AM';
  return 'PM';
}

export function StaffForm({ staff, onSave, onCancel }: StaffFormProps) {
  const isEdit = !!staff;

  const [name, setName] = useState(staff?.name ?? '');
  const [employment, setEmployment] = useState<EmploymentType>(staff?.employment_type ?? 'full-time');
  const [goalHours, setGoalHours] = useState(staff?.weekly_hour_goal?.toString() ?? '30');
  const [tier, setTier] = useState<PriorityTier>(staff?.priority_tier ?? 1);
  const [gender, setGender] = useState<Gender>(staff?.gender ?? 'female');
  const [isActive, setIsActive] = useState(staff?.is_active ?? true);
  const [notes, setNotes] = useState(staff?.notes ?? '');
  const [skills, setSkills] = useState<string[]>(staff?.skills ?? []);
  const [supervisionRequired, setSupervisionRequired] = useState(
    staff?.supervision_hours_required?.toString() ?? '0'
  );
  const [supervisionThisWeek, setSupervisionThisWeek] = useState(
    staff?.supervision_hours_this_week?.toString() ?? '0'
  );

  const defaultWindows: DayWindow[] = DAYS.map((d) => ({
    day: d,
    enabled: true,
    start: '08:00',
    end: '14:30',
  }));

  const [dayWindows, setDayWindows] = useState<DayWindow[]>(defaultWindows);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadClients();
    if (isEdit && staff) loadExistingData(staff.id);
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('first_name');
    setAllClients(data ?? []);
  }

  async function loadExistingData(staffId: string) {
    const [availRes, restRes] = await Promise.all([
      supabase.from('staff_availability').select('*').eq('staff_id', staffId),
      supabase.from('staff_client_restrictions').select('*').eq('staff_id', staffId),
    ]);

    const avail = availRes.data ?? [];
    const windows: DayWindow[] = DAYS.map((d) => {
      const row = avail.find((a: any) => a.day_of_week === d);
      if (!row) return { day: d, enabled: false, start: '08:00', end: '14:30' };
      const start = row.time_start ? row.time_start.slice(0, 5) : AVAILABILITY_PRESETS[row.shift as AvailabilityShift]?.start ?? '08:00';
      const end = row.time_end ? row.time_end.slice(0, 5) : AVAILABILITY_PRESETS[row.shift as AvailabilityShift]?.end ?? '14:30';
      return { day: d, enabled: true, start, end };
    });
    setDayWindows(windows);
    setRestrictions((restRes.data ?? []).map((r: StaffClientRestriction) => r.client_id));
  }

  function updateWindow(day: DayOfWeek, patch: Partial<DayWindow>) {
    setDayWindows((prev) => prev.map((w) => (w.day === day ? { ...w, ...patch } : w)));
  }

  function toggleSkill(skill: string) {
    setSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);
  }

  function applyPreset(preset: 'FULL' | 'AM' | 'PM' | 'ALL_DAYS') {
    if (preset === 'ALL_DAYS') {
      setDayWindows(DAYS.map((d) => ({ day: d, enabled: true, start: '08:00', end: '14:30' })));
      return;
    }
    const { start, end } = AVAILABILITY_PRESETS[preset as AvailabilityShift];
    setDayWindows((prev) => prev.map((w) => (w.enabled ? { ...w, start, end } : w)));
  }

  function toggleRestriction(clientId: string) {
    setRestrictions((prev) =>
      prev.includes(clientId) ? prev.filter((r) => r !== clientId) : [...prev, clientId]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Name is required.'); return; }
    if (trimmedName.length > 100) { setError('Name must be 100 characters or fewer.'); return; }

    const parsedGoal = parseFloat(goalHours);
    if (isNaN(parsedGoal) || parsedGoal < 1 || parsedGoal > 60) {
      setError('Weekly hour goal must be between 1 and 60.');
      return;
    }

    const parsedSupReq = parseFloat(supervisionRequired) || 0;
    const parsedSupWeek = parseFloat(supervisionThisWeek) || 0;
    if (parsedSupReq < 0 || parsedSupReq > 40) { setError('Supervision required must be between 0 and 40.'); return; }
    if (parsedSupWeek < 0 || parsedSupWeek > 40) { setError('Supervision this week must be between 0 and 40.'); return; }

    const trimmedNotes = notes.trim().slice(0, 500);

    setSaving(true);

    try {
      let staffId: string;

      if (isEdit && staff) {
        const { error } = await supabase.from('staff').update({
          name: trimmedName, employment_type: employment,
          weekly_hour_goal: parsedGoal,
          priority_tier: tier, gender, is_active: isActive, notes: trimmedNotes,
          skills,
          supervision_hours_required: parsedSupReq,
          supervision_hours_this_week: parsedSupWeek,
        }).eq('id', staff.id);
        if (error) throw error;
        staffId = staff.id;
      } else {
        const { data, error } = await supabase.from('staff').insert({
          name: trimmedName, employment_type: employment,
          weekly_hour_goal: parsedGoal,
          priority_tier: tier, gender, is_active: isActive, notes: trimmedNotes,
          skills,
          supervision_hours_required: parsedSupReq,
          supervision_hours_this_week: parsedSupWeek,
        }).select().single();
        if (error) throw error;
        staffId = data.id;
      }

      // Replace availability
      await supabase.from('staff_availability').delete().eq('staff_id', staffId);
      const enabledDays = dayWindows.filter((w) => w.enabled);
      if (enabledDays.length > 0) {
        await supabase.from('staff_availability').insert(
          enabledDays.map((w) => ({
            staff_id: staffId,
            day_of_week: w.day,
            shift: shiftFromWindow(w.start, w.end),
            time_start: w.start,
            time_end: w.end,
          }))
        );
      }

      // Replace client restrictions
      await supabase.from('staff_client_restrictions').delete().eq('staff_id', staffId);
      if (restrictions.length > 0) {
        await supabase.from('staff_client_restrictions').insert(
          restrictions.map((cid) => ({ staff_id: staffId, client_id: cid, reason: '' }))
        );
      }

      onSave();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setError('A staff member with that name already exists.');
      } else if (msg) {
        setError('Failed to save. Please check your entries and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Rebecca" />
            </div>
            <div>
              <label className="form-label">Employment Type</label>
              <select className="form-input" value={employment} onChange={(e) => setEmployment(e.target.value as EmploymentType)}>
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <div>
              <label className="form-label">Weekly Hour Goal</label>
              <input className="form-input" type="number" min="1" max="60" step="0.5" value={goalHours} onChange={(e) => setGoalHours(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Priority Tier</label>
              <select className="form-input" value={tier} onChange={(e) => setTier(Number(e.target.value) as PriorityTier)}>
                <option value={1}>Tier 1 — OG (Hours First)</option>
                <option value={2}>Tier 2 — Ramping Up</option>
                <option value={3}>Tier 3 — Floater</option>
              </select>
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Availability time windows */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="form-label mb-0">Availability — Time Windows</label>
              <div className="flex gap-1.5">
                {(['AM', 'PM', 'FULL'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    All → {p === 'FULL' ? 'Full Day' : p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyPreset('ALL_DAYS')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-aqua-100 hover:bg-aqua-200 text-aqua-700 transition-colors"
                >
                  Reset All
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200"
                style={{ gridTemplateColumns: '100px 56px 1fr 24px 1fr 100px' }}>
                <div className="px-3 py-2.5">Day</div>
                <div className="px-2 py-2.5 text-center">On</div>
                <div className="px-3 py-2.5">Start</div>
                <div className="py-2.5 text-center text-slate-300">–</div>
                <div className="px-3 py-2.5">End</div>
                <div className="px-3 py-2.5 text-right">Duration</div>
              </div>

              {DAYS.map((day) => {
                const w = dayWindows.find((x) => x.day === day)!;
                const validEnd = TIME_SLOTS.filter((t) => t > w.start);
                const extraEnds = ['10:30', '14:30'].filter(
                  (t) => t > w.start && !validEnd.includes(t)
                );
                const endOptions = [...validEnd, ...extraEnds].sort();
                const durH = w.enabled
                  ? (() => {
                      const [sh, sm] = w.start.split(':').map(Number);
                      const [eh, em] = w.end.split(':').map(Number);
                      const mins = eh * 60 + em - (sh * 60 + sm);
                      const h = Math.floor(mins / 60);
                      const m = mins % 60;
                      return m ? `${h}h ${m}m` : `${h}h`;
                    })()
                  : null;

                return (
                  <div
                    key={day}
                    className={`grid border-b border-slate-100 last:border-b-0 ${!w.enabled ? 'bg-slate-50/60 opacity-60' : ''}`}
                    style={{ gridTemplateColumns: '100px 56px 1fr 24px 1fr 100px' }}
                  >
                    <div className="px-3 py-3 text-sm font-medium text-slate-700 flex items-center">
                      {DAY_NAMES[day].slice(0, 3)}
                    </div>
                    <div className="px-2 py-3 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => updateWindow(day, { enabled: !w.enabled })}
                        className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${w.enabled ? 'bg-aqua-300' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${w.enabled ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="px-3 py-2.5 flex items-center">
                      <select
                        disabled={!w.enabled}
                        value={w.start}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          const newEnd = newStart >= w.end ? TIME_SLOTS.find((t) => t > newStart) ?? '14:30' : w.end;
                          updateWindow(day, { start: newStart, end: newEnd });
                        }}
                        className="form-input py-1.5 text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 disabled:cursor-not-allowed"
                      >
                        {TIME_SLOTS.slice(0, -1).map((t) => (
                          <option key={t} value={t}>{formatTime(t)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-center text-slate-300 text-sm">–</div>
                    <div className="px-3 py-2.5 flex items-center">
                      <select
                        disabled={!w.enabled}
                        value={w.end}
                        onChange={(e) => updateWindow(day, { end: e.target.value })}
                        className="form-input py-1.5 text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 disabled:cursor-not-allowed"
                      >
                        {endOptions.map((t) => (
                          <option key={t} value={t}>{formatTime(t)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="px-3 py-3 flex items-center justify-end">
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                        !w.enabled ? 'text-slate-300' :
                        w.end === '14:30' && w.start === '08:00' ? 'bg-aqua-100 text-aqua-700' :
                        w.end <= '10:30' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {w.enabled ? durH : 'Off'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Scheduler will only assign staff to sessions within their available window.
            </p>
          </div>

          {/* Skills */}
          <div>
            <label className="form-label mb-2">BT Skills / Training</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map((skill) => {
                const selected = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-aqua-300 border-aqua-300 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Used for client skill matching during auto-scheduling.</p>
          </div>

          {/* Supervision */}
          <div>
            <label className="form-label mb-2">Supervision Hours</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Required / week</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={supervisionRequired}
                  onChange={(e) => setSupervisionRequired(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Received this week</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={supervisionThisWeek}
                  onChange={(e) => setSupervisionThisWeek(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Client restrictions */}
          {allClients.length > 0 && (
            <div>
              <label className="form-label mb-2">Cannot Work With (Clients)</label>
              <div className="flex flex-wrap gap-2">
                {allClients.map((c) => {
                  const restricted = restrictions.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleRestriction(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        restricted
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {c.first_name} {c.last_name}
                      {restricted && <X size={11} className="inline ml-1 -mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" maxLength={500} />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold transition-colors text-sm disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
