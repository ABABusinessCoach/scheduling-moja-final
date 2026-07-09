import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  Client,
  Staff,
  StaffClientRestriction,
  DayOfWeek,
  ShiftType,
  RampUpEntry,
  AvailabilityShift,
  AssignmentShift,
  ProgramType,
} from '../../lib/types';
import {
  DAY_NAMES,
  ALL_SKILLS,
  TIME_SLOTS,
  ALL_END_TIMES,
  AVAILABILITY_PRESETS,
  CLIENT_RULE_PRESETS,
  CLIENT_COLORS,
  formatTime,
} from '../../lib/types';
import { clientCanStillAttend } from '../../lib/scheduler';
import { getMonday, format } from '../../lib/dateUtils';
import { X, Plus, Trash2, ShieldAlert, Sun, Moon } from 'lucide-react';
import { TimeOffManager } from '../shared/TimeOffManager';
import { SeasonalAvailabilitySection } from '../shared/SeasonalAvailabilitySection';

interface ClientFormProps {
  client?: Client | null;
  onSave: () => void;
  onCancel: () => void;
}

const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
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
  if (start === '08:00' && end === '14:30') return 'FULL';
  if (end <= '10:30') return 'AM';
  return 'PM';
}

export function ClientForm({ client, onSave, onCancel }: ClientFormProps) {
  const isEdit = !!client;

  const [firstName, setFirstName] = useState(client?.first_name ?? '');
  const [lastName, setLastName] = useState(client?.last_name ?? '');
  const [color, setColor] = useState(client?.color ?? CLIENT_COLORS[0]);
  const [programType, setProgramType] = useState<ProgramType>(client?.program_type ?? 'daytime');
  const [shiftType] = useState<ShiftType>(client?.shift_type ?? 'FULL');
  const [customEndTime, setCustomEndTime] = useState(client?.custom_end_time ?? '');
  const [noMale, setNoMale] = useState(client?.no_male_therapists ?? false);
  const [isActive, setIsActive] = useState(client?.is_active ?? true);
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [startDate, setStartDate] = useState(client?.start_date ?? '');
  const [restrictedStaff, setRestrictedStaff] = useState<string[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);

  const defaultWindows: DayWindow[] = DAYS.map((d) => ({
    day: d,
    enabled: d !== 6,
    start: d === 6 ? '09:00' : '08:00',
    end: d === 6 ? '15:00' : '15:30',
  }));
  const [dayWindows, setDayWindows] = useState<DayWindow[]>(defaultWindows);

  // After-school days (Mon-Fri, always 15:00-18:00)
  const [afterschoolDays, setAfterschoolDays] = useState<Set<DayOfWeek>>(new Set());

  const [authorizedHours, setAuthorizedHours] = useState(
    client?.authorized_hours_per_week?.toString() ?? ''
  );
  const [requiredSkills, setRequiredSkills] = useState<string[]>(client?.required_skills ?? []);
  const [schedulingRules, setSchedulingRules] = useState<string[]>(client?.scheduling_rules ?? []);
  const [customRule, setCustomRule] = useState('');
  const [rampUp, setRampUp] = useState<RampUpEntry[]>(client?.ramp_up_schedule ?? []);
  const [useRampUp, setUseRampUp] = useState(!!(client?.ramp_up_schedule?.length));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStaff();
    if (isEdit && client) loadExistingData(client.id);
  }, []);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*').eq('is_active', true).order('name');
    setAllStaff(data ?? []);
  }

  async function loadExistingData(clientId: string) {
    const [availRes, restRes] = await Promise.all([
      supabase.from('client_availability').select('*').eq('client_id', clientId),
      supabase.from('staff_client_restrictions').select('*').eq('client_id', clientId),
    ]);

    const avail = availRes.data ?? [];

    // Split into daytime rows (time_start < 15:00) and EVE rows (time_start >= 15:00)
    const daytimeRows = avail.filter((a: any) => !a.time_start || a.time_start.slice(0, 5) < '15:00');
    const eveningRows = avail.filter((a: any) => a.time_start && a.time_start.slice(0, 5) >= '15:00');

    if (daytimeRows.length > 0) {
      const windows: DayWindow[] = DAYS.map((d) => {
        const row = daytimeRows.find((a: any) => a.day_of_week === d);
        if (!row) return { day: d, enabled: false, start: d === 6 ? '09:00' : '08:00', end: d === 6 ? '15:00' : '15:30' };
        const start = row.time_start ? row.time_start.slice(0, 5) : AVAILABILITY_PRESETS[row.shift as AvailabilityShift]?.start ?? '08:00';
        const end = row.time_end ? row.time_end.slice(0, 5) : AVAILABILITY_PRESETS[row.shift as AvailabilityShift]?.end ?? '15:30';
        return { day: d, enabled: true, start, end };
      });
      setDayWindows(windows);
    } else if (avail.length === 0) {
      // Fall back to legacy client_attendance + shift_type
      const { data: attendData } = await supabase
        .from('client_attendance')
        .select('*')
        .eq('client_id', clientId);
      const attendDays = (attendData ?? []).map((a: any) => a.day_of_week as DayOfWeek);
      const preset = shiftType === 'AM'
        ? AVAILABILITY_PRESETS.AM
        : shiftType === 'PM'
        ? AVAILABILITY_PRESETS.PM
        : AVAILABILITY_PRESETS.FULL;
      const windows: DayWindow[] = DAYS.map((d) => ({
        day: d,
        enabled: attendDays.includes(d),
        start: d === 6 ? '09:00' : preset.start,
        end: d === 6 ? '15:00' : preset.end,
      }));
      setDayWindows(windows);
    }

    if (eveningRows.length > 0) {
      setAfterschoolDays(new Set(eveningRows.map((a: any) => a.day_of_week as DayOfWeek)));
    }

    setRestrictedStaff((restRes.data ?? []).map((r: StaffClientRestriction) => r.staff_id));
  }

  function updateWindow(day: DayOfWeek, patch: Partial<DayWindow>) {
    setDayWindows((prev) => prev.map((w) => (w.day === day ? { ...w, ...patch } : w)));
  }

  function applyPreset(preset: 'FULL' | 'AM' | 'PM' | 'ALL_DAYS') {
    if (preset === 'ALL_DAYS') {
      setDayWindows(DAYS.map((d) => ({ day: d, enabled: d !== 6, start: d === 6 ? '09:00' : '08:00', end: d === 6 ? '15:00' : '15:30' })));
      return;
    }
    const presetTimes: Record<'AM' | 'PM' | 'FULL', { start: string; end: string }> = {
      AM:   { start: '08:00', end: '10:30' },
      PM:   { start: '10:30', end: '15:30' },
      FULL: { start: '08:00', end: '15:30' },
    };
    const { start, end } = presetTimes[preset];
    setDayWindows((prev) => prev.map((w) => (w.enabled && w.day !== 6 ? { ...w, start, end } : w)));
  }

  function toggleAfterschoolDay(day: DayOfWeek) {
    setAfterschoolDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleSkill(skill: string) {
    setRequiredSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function toggleStaff(staffId: string) {
    setRestrictedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((s) => s !== staffId) : [...prev, staffId]
    );
  }

  function addRampWeek() {
    const nextWeek = rampUp.length ? Math.max(...rampUp.map((r) => r.week_number)) + 1 : 1;
    const lastHours = rampUp.length ? rampUp[rampUp.length - 1].target_hours + 5 : 10;
    setRampUp((prev) => [...prev, { week_number: nextWeek, target_hours: lastHours }]);
  }

  function updateRampWeek(index: number, field: keyof RampUpEntry, value: number) {
    setRampUp((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function removeRampWeek(index: number) {
    setRampUp((prev) => prev.filter((_, i) => i !== index));
  }

  async function syncScheduleAfterAvailabilityChange(
    clientId: string,
    enabledDays: typeof dayWindows
  ) {
    const weekStr = format(getMonday(new Date()), 'yyyy-MM-dd');
    const { data: sched } = await supabase
      .from('schedules')
      .select('id, status')
      .eq('week_start_date', weekStr)
      .maybeSingle();
    if (!sched || sched.status !== 'draft') return;

    const { data: clientAssignments } = await supabase
      .from('schedule_assignments')
      .select('id, day_of_week, shift')
      .eq('schedule_id', sched.id)
      .eq('client_id', clientId);

    if (!clientAssignments?.length) return;

    const newAvailWindows = enabledDays.map((w) => ({
      day_of_week: w.day,
      time_start: w.start,
      time_end: w.end,
    }));

    const toRemove = clientAssignments.filter(
      (a) => !clientCanStillAttend(a.day_of_week as DayOfWeek, a.shift as AssignmentShift, newAvailWindows)
    );

    if (toRemove.length > 0) {
      await supabase
        .from('schedule_assignments')
        .delete()
        .in('id', toRemove.map((a) => a.id));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst) { setError('First name is required.'); return; }
    if (!trimmedLast) { setError('Last name is required.'); return; }
    if (trimmedFirst.length > 100) { setError('First name must be 100 characters or fewer.'); return; }
    if (trimmedLast.length > 100) { setError('Last name must be 100 characters or fewer.'); return; }

    if (authorizedHours !== '') {
      const parsedHours = parseFloat(authorizedHours);
      if (isNaN(parsedHours) || parsedHours < 0 || parsedHours > 80) {
        setError('Authorized hours must be between 0 and 80.');
        return;
      }
    }

    if (useRampUp) {
      for (const row of rampUp) {
        if (row.target_hours < 0.5 || row.target_hours > 80) {
          setError('Ramp-up target hours must be between 0.5 and 80.');
          return;
        }
      }
    }

    const trimmedNotes = notes.trim().slice(0, 500);

    setSaving(true);

    try {
      const enabledDaytimeDays = programType === 'afterschool' ? [] : dayWindows.filter((w) => w.enabled);

      const derivedShift: ShiftType = (() => {
        if (enabledDaytimeDays.length === 0) return programType === 'afterschool' ? 'FULL' : 'FULL';
        const allFull = enabledDaytimeDays.every((w) => w.start === '08:00' && (w.end === '14:30' || w.end === '15:30'));
        const allAM = enabledDaytimeDays.every((w) => w.end <= '10:30');
        const allPM = enabledDaytimeDays.every((w) => w.start >= '10:30');
        if (allFull) return 'FULL';
        if (allAM) return 'AM';
        if (allPM) return 'PM';
        return 'CUSTOM';
      })();

      const payload = {
        first_name: trimmedFirst,
        last_name: trimmedLast,
        shift_type: derivedShift,
        custom_end_time: derivedShift === 'CUSTOM' ? customEndTime || null : null,
        no_male_therapists: noMale,
        is_active: isActive,
        notes: trimmedNotes,
        authorized_hours_per_week: authorizedHours ? parseFloat(authorizedHours) : null,
        required_skills: requiredSkills,
        scheduling_rules: schedulingRules,
        ramp_up_schedule: useRampUp && rampUp.length ? rampUp : null,
        start_date: startDate || null,
        program_type: programType,
        color,
      };

      let clientId: string;

      if (isEdit && client) {
        const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
        if (error) throw error;
        clientId = client.id;
      } else {
        const { data, error } = await supabase.from('clients').insert(payload).select().single();
        if (error) throw error;
        clientId = data.id;
      }

      // Build availability rows: daytime + afterschool EVE rows
      const availRows: object[] = [];

      if (programType !== 'afterschool') {
        enabledDaytimeDays.forEach((w) => {
          availRows.push({
            client_id: clientId,
            day_of_week: w.day,
            shift: shiftFromWindow(w.start, w.end, w.day),
            time_start: w.start,
            time_end: w.end,
          });
        });
      }

      if (programType !== 'daytime') {
        afterschoolDays.forEach((day) => {
          availRows.push({
            client_id: clientId,
            day_of_week: day,
            shift: 'EVE',
            time_start: '15:00',
            time_end: '18:00',
          });
        });
      }

      await supabase.from('client_availability').delete().eq('client_id', clientId);
      if (availRows.length > 0) {
        await supabase.from('client_availability').insert(availRows);
      }

      // Keep client_attendance in sync for backward compat
      await supabase.from('client_attendance').delete().eq('client_id', clientId);
      const attendanceDays = new Set([
        ...enabledDaytimeDays.map((w) => w.day),
        ...(programType !== 'daytime' ? Array.from(afterschoolDays) : []),
      ]);
      if (attendanceDays.size > 0) {
        await supabase.from('client_attendance').insert(
          Array.from(attendanceDays).map((day) => ({ client_id: clientId, day_of_week: day }))
        );
      }

      // Replace staff restrictions
      await supabase.from('staff_client_restrictions').delete().eq('client_id', clientId);
      if (restrictedStaff.length > 0) {
        await supabase.from('staff_client_restrictions').insert(
          restrictedStaff.map((sid) => ({ staff_id: sid, client_id: clientId, reason: '' }))
        );
      }

      if (isEdit) {
        await syncScheduleAfterAvailabilityChange(clientId, enabledDaytimeDays);
      }

      onSave();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setError('A client with that name already exists.');
      } else if (msg) {
        setError('Failed to save. Please check your entries and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const showDaytime = programType !== 'afterschool';
  const showAfterschool = programType !== 'daytime';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Edit Client' : 'Add Client'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">First Name</label>
              <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="First" />
            </div>
            <div>
              <label className="form-label">Last Name</label>
              <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Last" />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="form-label mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {CLIENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Program Type */}
          <div>
            <label className="form-label mb-2">Program</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'daytime', label: 'Daytime', sub: '8:00 AM – 2:30 PM', icon: Sun },
                { value: 'afterschool', label: 'After School', sub: '3:00 – 6:00 PM', icon: Moon },
                { value: 'both', label: 'Both', sub: 'Daytime + Evening', icon: null },
              ] as const).map(({ value, label, sub, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProgramType(value)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    programType === value
                      ? 'border-aqua-300 bg-aqua-50 text-aqua-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {Icon && <Icon size={16} className={programType === value ? 'text-aqua-500' : 'text-slate-400'} />}
                  {!Icon && <span className="text-base leading-none">☀️🌙</span>}
                  <span>{label}</span>
                  <span className="text-xs font-normal text-slate-400">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Daytime availability */}
          {showDaytime && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sun size={15} className="text-amber-500" />
                  <label className="form-label mb-0">Daytime Availability</label>
                </div>
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
                    Reset
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div
                  className="grid bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200"
                  style={{ gridTemplateColumns: '100px 56px 1fr 24px 1fr 100px' }}
                >
                  <div className="px-3 py-2.5">Day</div>
                  <div className="px-2 py-2.5 text-center">On</div>
                  <div className="px-3 py-2.5">Arrives</div>
                  <div className="py-2.5 text-center text-slate-300">–</div>
                  <div className="px-3 py-2.5">Leaves</div>
                  <div className="px-3 py-2.5 text-right">Duration</div>
                </div>

                {DAYS.map((day) => {
                  const w = dayWindows.find((x) => x.day === day)!;
                  const validEnd = ALL_END_TIMES.filter((t) => t > w.start);
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
                            <option key={t} value={t}>{formatTime(t)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="px-3 py-3 flex items-center justify-end">
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                          !w.enabled ? 'text-slate-300' :
                          w.end === '15:30' && w.start === '08:00' ? 'bg-aqua-100 text-aqua-700' :
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
                Scheduler will only create daytime sessions within the client's available window each day.
              </p>
            </div>
          )}

          {/* After-school availability */}
          {showAfterschool && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Moon size={15} className="text-indigo-400" />
                <label className="form-label mb-0">After School Days</label>
                <span className="text-xs text-slate-400 font-normal">3:00 – 6:00 PM</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-5 divide-x divide-slate-100">
                  {WEEKDAYS.map((day) => {
                    const on = afterschoolDays.has(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleAfterschoolDay(day)}
                        className={`flex flex-col items-center py-3 gap-1.5 transition-colors ${
                          on ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-xs font-semibold ${on ? 'text-indigo-700' : 'text-slate-500'}`}>
                          {DAY_NAMES[day].slice(0, 3)}
                        </span>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          on ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'
                        }`}>
                          {on && <span className="w-2 h-2 bg-white rounded-full" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Select which days this client attends after-school sessions (3–6 PM).
              </p>
            </div>
          )}

          {/* Authorized hours */}
          <div>
            <label className="form-label">Authorized Hours / Week (Insurance)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              max="40"
              step="0.5"
              value={authorizedHours}
              onChange={(e) => setAuthorizedHours(e.target.value)}
              placeholder="e.g. 20 — leave blank if no limit"
            />
            <p className="text-xs text-slate-400 mt-1">
              Scheduler will warn if this client's sessions exceed this cap.
            </p>
          </div>

          {/* Ramp-up schedule */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Ramp-Up Schedule</label>
              <button
                type="button"
                onClick={() => setUseRampUp(!useRampUp)}
                className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${useRampUp ? 'bg-aqua-300' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useRampUp ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>

            {useRampUp && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div
                  className="grid bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200"
                  style={{ gridTemplateColumns: '1fr 1fr 36px' }}
                >
                  <div className="px-3 py-2">Program Week #</div>
                  <div className="px-3 py-2">Target Hours</div>
                  <div />
                </div>
                {rampUp.length === 0 && (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">
                    No weeks added yet. Click below to start.
                  </div>
                )}
                {rampUp.map((row, i) => (
                  <div
                    key={i}
                    className="grid border-b border-slate-100 last:border-b-0 items-center"
                    style={{ gridTemplateColumns: '1fr 1fr 36px' }}
                  >
                    <div className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        className="form-input py-1 text-xs"
                        value={row.week_number}
                        onChange={(e) => updateRampWeek(i, 'week_number', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="px-3 py-2">
                      <input
                        type="number"
                        min="0.5"
                        max="40"
                        step="0.5"
                        className="form-input py-1 text-xs"
                        value={row.target_hours}
                        onChange={(e) => updateRampWeek(i, 'target_hours', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <button type="button" onClick={() => removeRampWeek(i)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRampWeek}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-aqua-600 hover:bg-aqua-50 transition-colors font-semibold border-t border-slate-100"
                >
                  <Plus size={12} /> Add Week
                </button>
              </div>
            )}
          </div>

          {/* Required skills */}
          <div>
            <label className="form-label mb-2">Required BT Skills</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map((skill) => {
                const selected = requiredSkills.includes(skill);
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
            <p className="text-xs text-slate-400 mt-1.5">Only BTs trained in all required skills will be matched to this client.</p>
          </div>

          {/* Scheduling rules */}
          <div>
            <label className="form-label mb-2">Scheduling Rules</label>
            {schedulingRules.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {schedulingRules.map((rule) => (
                  <span key={rule} className="flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                    <ShieldAlert size={10} className="flex-shrink-0" />
                    {rule}
                    <button
                      type="button"
                      onClick={() => setSchedulingRules((prev) => prev.filter((r) => r !== rule))}
                      className="ml-0.5 hover:text-orange-900"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CLIENT_RULE_PRESETS.filter((p) => !schedulingRules.includes(p)).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSchedulingRules((prev) => [...prev, preset])}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 text-slate-600 hover:text-orange-700 transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="form-input text-sm flex-1"
                placeholder="Custom rule…"
                value={customRule}
                onChange={(e) => setCustomRule(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = customRule.trim();
                    if (trimmed && !schedulingRules.includes(trimmed)) {
                      setSchedulingRules((prev) => [...prev, trimmed]);
                    }
                    setCustomRule('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = customRule.trim();
                  if (trimmed && !schedulingRules.includes(trimmed)) {
                    setSchedulingRules((prev) => [...prev, trimmed]);
                  }
                  setCustomRule('');
                }}
                disabled={!customRule.trim()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* No male therapists */}
          <div>
            <label className="form-label mb-1">No Male Therapists</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setNoMale(!noMale)}
                className={`w-10 h-6 rounded-full transition-colors relative ${noMale ? 'bg-aqua-300' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${noMale ? 'left-5' : 'left-1'}`} />
              </button>
              <span className="text-sm text-slate-600">Restrict to female therapists only</span>
            </label>
          </div>

          {/* Staff restrictions */}
          {allStaff.length > 0 && (
            <div>
              <label className="form-label mb-2">Cannot Work With (Staff)</label>
              <div className="flex flex-wrap gap-2">
                {allStaff.map((s) => {
                  const restricted = restrictedStaff.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStaff(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        restricted
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {s.name}
                      {restricted && <X size={11} className="inline ml-1 -mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status & notes */}
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
            <div className="col-span-2">
              <label className="form-label">Schedule Start Date <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Scheduler will not place this client before this date.</p>
            </div>
          </div>

          {/* Seasonal Availability */}
          {isEdit && client && (
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sun size={15} className="text-amber-500" />
                <label className="text-sm font-semibold text-slate-700">Seasonal Availability</label>
              </div>
              <SeasonalAvailabilitySection entityId={client.id} entityType="client" />
            </div>
          )}

          {/* Time Off */}
          {isEdit && client && (
            <div className="border border-slate-200 rounded-xl p-4">
              <TimeOffManager clientId={client.id} />
            </div>
          )}

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold transition-colors text-sm disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
