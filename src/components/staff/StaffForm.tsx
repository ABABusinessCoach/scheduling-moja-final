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
  ALL_END_TIMES,
  AVAILABILITY_PRESETS,
  ALL_SKILLS,
  PRIORITY_LABELS,
  RULE_PRESETS,
  formatTime,
} from '../../lib/types';
import { X, Plus, ShieldAlert } from 'lucide-react';
import { TimeOffManager } from '../shared/TimeOffManager';

interface StaffFormProps {
  staff?: Staff | null;
  onSave: () => void;
  onCancel: () => void;
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6];

interface DayWindow {
  day: DayOfWeek;
  enabled: boolean;
  start: string;
  end: string;
}

function shiftFromWindow(start: string, end: string, day: DayOfWeek): AvailabilityShift {
  if (day === 6) {
    if (end <= '12:00') return 'SAT_AM';
    if (start >= '12:00') return 'SAT_PM';
    return 'SAT_AM';
  }
  if (start >= '15:00') return 'EVE';
  if (start === '08:00' && end === '18:00') return 'FULL';
  if (end <= '10:30') return 'AM';
  return 'PM';
}

function shiftBadge(start: string, end: string, day: DayOfWeek) {
  if (!start || !end) return null;
  if (day === 6) return { label: 'Saturday', color: 'bg-purple-100 text-purple-700' };
  if (start >= '15:00') return { label: 'After School', color: 'bg-teal-100 text-teal-700' };
  if (start === '08:00' && end === '18:00') return { label: 'Full Day', color: 'bg-aqua-100 text-aqua-700' };
  if (end <= '10:30') return { label: 'AM', color: 'bg-amber-100 text-amber-700' };
  if (start >= '10:30') return { label: 'Late AM', color: 'bg-blue-100 text-blue-700' };
  return { label: 'Custom', color: 'bg-slate-100 text-slate-600' };
}

export function StaffForm({ staff, onSave, onCancel }: StaffFormProps) {
  const isEdit = !!staff;

  const [name, setName] = useState(staff?.name ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [employment, setEmployment] = useState<EmploymentType>(staff?.employment_type ?? 'full-time');
  const [goalHours, setGoalHours] = useState(staff?.weekly_hour_goal?.toString() ?? '30');
  const [tier, setTier] = useState<PriorityTier>(staff?.priority_tier ?? 1);
  const [gender, setGender] = useState<Gender>(staff?.gender ?? 'female');
  const [isActive, setIsActive] = useState(staff?.is_active ?? true);
  const [notes, setNotes] = useState(staff?.notes ?? '');
  const [startDate, setStartDate] = useState(staff?.start_date ?? '');
  const [skills, setSkills] = useState<string[]>(staff?.skills ?? []);
  const [schedulingRules, setSchedulingRules] = useState<string[]>(staff?.scheduling_rules ?? []);
  const [newRuleText, setNewRuleText] = useState('');
  const [supervisionRequired, setSupervisionRequired] = useState(
    staff?.supervision_hours_required?.toString() ?? '0'
  );
  const [supervisionThisWeek, setSupervisionThisWeek] = useState(
    staff?.supervision_hours_this_week?.toString() ?? '0'
  );

  const defaultWindows: DayWindow[] = DAYS.map((d) => ({
    day: d,
    enabled: d !== 6,
    start: d === 6 ? '09:00' : '08:00',
    end: d === 6 ? '15:00' : '14:30',
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
      if (!row) return { day: d, enabled: false, start: d === 6 ? '09:00' : '08:00', end: d === 6 ? '15:00' : '14:30' };
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

  type PresetKey = 'AM' | 'PM' | 'FULL' | 'EVE' | 'ALL_DAYS';
  function applyPreset(preset: PresetKey) {
    if (preset === 'ALL_DAYS') {
      setDayWindows(DAYS.map((d) => ({ day: d, enabled: d !== 6, start: d === 6 ? '09:00' : '08:00', end: d === 6 ? '15:00' : '14:30' })));
      return;
    }
    const { start, end } = AVAILABILITY_PRESETS[preset as AvailabilityShift];
    setDayWindows((prev) => prev.map((w) => {
      if (!w.enabled) return w;
      // EVE / After School applies to weekdays only
      if (preset === 'EVE' && w.day === 6) return w;
      if (w.day === 6) return w;
      return { ...w, start, end };
    }));
  }

  function toggleRestriction(clientId: string) {
    setRestrictions((prev) =>
      prev.includes(clientId) ? prev.filter((r) => r !== clientId) : [...prev, clientId]
    );
  }

  function addRule(text: string) {
    const trimmed = text.trim();
    if (!trimmed || schedulingRules.includes(trimmed)) return;
    setSchedulingRules((prev) => [...prev, trimmed]);
    setNewRuleText('');
  }

  function removeRule(rule: string) {
    setSchedulingRules((prev) => prev.filter((r) => r !== rule));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) { setError('Name is required.'); return; }
    if (trimmedName.length > 100) { setError('Name must be 100 characters or fewer.'); return; }

    const parsedGoal = parseFloat(goalHours);
    if (isNaN(parsedGoal) || parsedGoal < 1 || parsedGoal > 60) {
      setError('Weekly hour goal must be between 1 and 60.'); return;
    }

    const parsedSupReq = parseFloat(supervisionRequired) || 0;
    const parsedSupWeek = parseFloat(supervisionThisWeek) || 0;
    if (parsedSupReq < 0 || parsedSupReq > 40) { setError('Supervision required must be 0–40.'); return; }
    if (parsedSupWeek < 0 || parsedSupWeek > 40) { setError('Supervision this week must be 0–40.'); return; }

    const trimmedNotes = notes.trim().slice(0, 500);

    setSaving(true);
    try {
      let staffId: string;
      const payload = {
        name: trimmedName,
        email: email.trim() || null,
        employment_type: employment,
        weekly_hour_goal: parsedGoal,
        priority_tier: tier,
        gender,
        is_active: isActive,
        notes: trimmedNotes,
        skills,
        scheduling_rules: schedulingRules,
        supervision_hours_required: parsedSupReq,
        supervision_hours_this_week: parsedSupWeek,
        start_date: startDate || null,
      };

      if (isEdit && staff) {
        const { error } = await supabase.from('staff').update(payload).eq('id', staff.id);
        if (error) throw error;
        staffId = staff.id;
      } else {
        const { data, error } = await supabase.from('staff').insert(payload).select().single();
        if (error) throw error;
        staffId = data.id;
      }

      await supabase.from('staff_availability').delete().eq('staff_id', staffId);
      const enabledDays = dayWindows.filter((w) => w.enabled);
      if (enabledDays.length > 0) {
        await supabase.from('staff_availability').insert(
          enabledDays.map((w) => ({
            staff_id: staffId,
            day_of_week: w.day,
            shift: shiftFromWindow(w.start, w.end, w.day),
            time_start: w.start,
            time_end: w.end,
          }))
        );
      }

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
      } else {
        setError('Failed to save. Please check your entries and try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const tierInfo = PRIORITY_LABELS[tier];

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

          {/* ── Basic Info ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Rebecca" />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. rebecca@clinic.com" />
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
              <label className="form-label">Gender</label>
              <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="form-label">Schedule Start Date <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Scheduler will not place this staff before this date.</p>
            </div>
          </div>

          {/* ── Priority ── */}
          <div>
            <label className="form-label mb-3">Scheduling Priority</label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as PriorityTier[]).map((t) => {
                const info = PRIORITY_LABELS[t];
                const isSelected = tier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-accent-500 bg-accent-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`text-xs font-bold mb-0.5 ${isSelected ? 'text-accent-600' : 'text-slate-500'}`}>
                      Priority {t}
                    </div>
                    <div className={`text-sm font-semibold ${isSelected ? 'text-accent-700' : 'text-slate-700'}`}>
                      {info.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">{info.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Availability ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Availability</label>
              <div className="flex gap-1">
                {(['AM', 'PM', 'FULL', 'EVE'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors whitespace-nowrap"
                  >
                    {p === 'FULL' ? 'Full Day' : p === 'EVE' ? 'After School' : p === 'PM' ? 'Late AM' : p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyPreset('ALL_DAYS')}
                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-aqua-100 hover:bg-aqua-200 text-aqua-700 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Shift reference */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: 'AM', time: '8:00 – 10:30', color: 'border-amber-200 bg-amber-50 text-amber-700' },
                { label: 'Late AM', time: '10:30 – 2:30', color: 'border-blue-200 bg-blue-50 text-blue-700' },
                { label: 'Full Day', time: '8:00 – 6:00', color: 'border-aqua-200 bg-aqua-50 text-aqua-700' },
                { label: 'After School', time: '3:00 – 6:00', color: 'border-teal-200 bg-teal-50 text-teal-700' },
              ].map((s) => (
                <div key={s.label} className={`px-2 py-1.5 rounded-lg border text-center ${s.color}`}>
                  <div className="text-xs font-semibold">{s.label}</div>
                  <div className="text-[10px] opacity-80">{s.time}</div>
                </div>
              ))}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div
                className="grid bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200"
                style={{ gridTemplateColumns: '90px 48px 1fr 20px 1fr 90px' }}
              >
                <div className="px-3 py-2.5">Day</div>
                <div className="px-2 py-2.5 text-center">On</div>
                <div className="px-3 py-2.5">Start</div>
                <div className="py-2.5" />
                <div className="px-3 py-2.5">End</div>
                <div className="px-3 py-2.5 text-right">Shift</div>
              </div>

              {DAYS.map((day) => {
                const w = dayWindows.find((x) => x.day === day)!;
                const validEnd = ALL_END_TIMES.filter((t) => t > w.start);
                const badge = w.enabled ? shiftBadge(w.start, w.end, day) : null;

                return (
                  <div
                    key={day}
                    className={`grid border-b border-slate-100 last:border-b-0 ${!w.enabled ? 'bg-slate-50/60 opacity-50' : ''}`}
                    style={{ gridTemplateColumns: '90px 48px 1fr 20px 1fr 90px' }}
                  >
                    <div className="px-3 py-3 text-sm font-medium text-slate-700 flex items-center">
                      {DAY_NAMES[day].slice(0, 3)}
                    </div>
                    <div className="px-2 py-3 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => updateWindow(day, { enabled: !w.enabled })}
                        className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${w.enabled ? 'bg-aqua-400' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${w.enabled ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="px-3 py-2.5 flex items-center">
                      <select
                        disabled={!w.enabled}
                        value={w.start}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          const newEnd = newStart >= w.end ? TIME_SLOTS.find((t) => t > newStart) ?? '16:00' : w.end;
                          updateWindow(day, { start: newStart, end: newEnd });
                        }}
                        className="form-input py-1.5 text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 disabled:cursor-not-allowed"
                      >
                        {TIME_SLOTS.map((t) => (
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
                        {validEnd.map((t) => (
                          <option key={t} value={t}>
                            {formatTime(t)}{t === '18:00' ? ' (end of after school)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="px-3 py-3 flex items-center justify-end">
                      {badge ? (
                        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${badge.color}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">Off</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Scheduling Rules ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={15} className="text-slate-500" />
              <label className="form-label mb-0">Scheduling Rules</label>
            </div>

            {/* Active rules */}
            {schedulingRules.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {schedulingRules.map((rule) => (
                  <span
                    key={rule}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg text-xs font-medium"
                  >
                    {rule}
                    <button
                      type="button"
                      onClick={() => removeRule(rule)}
                      className="text-orange-400 hover:text-orange-700 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {RULE_PRESETS.filter((r) => !schedulingRules.includes(r)).map((rule) => (
                <button
                  key={rule}
                  type="button"
                  onClick={() => addRule(rule)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-100 hover:bg-orange-50 hover:border-orange-200 border border-transparent text-slate-600 hover:text-orange-700 transition-colors"
                >
                  <Plus size={10} />
                  {rule}
                </button>
              ))}
            </div>

            {/* Custom rule input */}
            <div className="flex gap-2">
              <input
                className="form-input flex-1 text-sm"
                value={newRuleText}
                onChange={(e) => setNewRuleText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRule(newRuleText); } }}
                placeholder="Add custom rule… (press Enter)"
                maxLength={120}
              />
              <button
                type="button"
                onClick={() => addRule(newRuleText)}
                disabled={!newRuleText.trim()}
                className="px-3 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Rules are displayed as reminders when scheduling — they do not automatically block assignments.
            </p>
          </div>

          {/* ── Skills ── */}
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
                        ? 'bg-aqua-400 border-aqua-400 text-white'
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

          {/* ── Supervision ── */}
          <div>
            <label className="form-label mb-2">Supervision Hours</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Required / week</label>
                <input className="form-input" type="number" min="0" step="0.5" value={supervisionRequired} onChange={(e) => setSupervisionRequired(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Received this week</label>
                <input className="form-input" type="number" min="0" step="0.5" value={supervisionThisWeek} onChange={(e) => setSupervisionThisWeek(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Client Restrictions ── */}
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

          {/* ── Time Off ── */}
          {isEdit && staff && (
            <div className="border border-slate-200 rounded-xl p-4">
              <TimeOffManager staffId={staff.id} />
            </div>
          )}

          {/* ── Notes ── */}
          <div>
            <label className="form-label">Internal Notes</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes visible to admins only" maxLength={500} />
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold transition-colors text-sm disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
