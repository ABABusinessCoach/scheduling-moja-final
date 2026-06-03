import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Cancellation,
  Schedule,
  Staff,
  Client,
  ScheduleAssignment,
  DayOfWeek,
  AssignmentShift,
} from '../lib/types';
import { DAY_NAMES, SHIFT_TIMES } from '../lib/types';
import { getCancellationRecommendation } from '../lib/scheduler';
import { getMonday, format, formatWeekRange } from '../lib/dateUtils';
import { AlertTriangle, CheckCircle2, Plus, X } from 'lucide-react';
import { useToast } from '../lib/toast';

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5];

export function CancellationPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const showToast = useToast();

  // Form state
  const [cancelType, setCancelType] = useState<'client' | 'staff'>('client');
  const [cancelEntityId, setCancelEntityId] = useState('');
  const [cancelDay, setCancelDay] = useState<DayOfWeek>(1);
  const [cancelShift, setCancelShift] = useState<'AM' | 'PM' | 'FULL'>('FULL');
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedScheduleId) loadScheduleData(selectedScheduleId);
  }, [selectedScheduleId]);

  async function loadData() {
    setLoading(true);
    const [schedRes, staffRes, clientRes] = await Promise.all([
      supabase.from('schedules').select('*').order('week_start_date', { ascending: false }).limit(10),
      supabase.from('staff').select('*').eq('is_active', true).order('name'),
      supabase.from('clients').select('*, client_attendance(*), client_availability(*)').eq('is_active', true).order('first_name'),
    ]);

    setSchedules(schedRes.data ?? []);
    setStaff(staffRes.data ?? []);
    setClients(clientRes.data ?? []);

    if (schedRes.data && schedRes.data.length > 0) {
      setSelectedScheduleId(schedRes.data[0].id);
    }
    setLoading(false);
  }

  async function loadScheduleData(scheduleId: string) {
    const [assignRes, cancelRes] = await Promise.all([
      supabase
        .from('schedule_assignments')
        .select('*, staff(*), client:clients(*)')
        .eq('schedule_id', scheduleId),
      supabase
        .from('cancellations')
        .select('*, staff(*), client:clients(*)')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false }),
    ]);
    setAssignments(assignRes.data ?? []);
    setCancellations(cancelRes.data ?? []);
  }

  async function handleSubmitCancellation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScheduleId || !cancelEntityId) return;

    const trimmedReason = cancelReason.trim().slice(0, 200);

    setSubmitting(true);

    const typedAssignments = assignments as ScheduleAssignment[];
    const recommendation = getCancellationRecommendation(
      cancelType,
      cancelEntityId,
      cancelDay,
      cancelShift,
      typedAssignments,
      staff
    );

    await supabase.from('cancellations').insert({
      schedule_id: selectedScheduleId,
      cancellation_type: cancelType,
      staff_id: cancelType === 'staff' ? cancelEntityId : null,
      client_id: cancelType === 'client' ? cancelEntityId : null,
      day_of_week: cancelDay,
      shift: cancelShift,
      reason: trimmedReason,
      recommendation,
      handled: false,
    });

    // If staff cancels, remove their assignments for the day
    if (cancelType === 'staff') {
      const toRemove = assignments.filter(
        (a) =>
          a.staff_id === cancelEntityId &&
          a.day_of_week === cancelDay &&
          (cancelShift === 'FULL' || a.shift === cancelShift)
      );
      for (const assignment of toRemove) {
        await supabase
          .from('schedule_assignments')
          .update({ staff_id: null, violation_reason: `Staff cancelled${trimmedReason ? ` (${trimmedReason})` : ''}` })
          .eq('id', assignment.id);
      }
    }

    // Reset form
    setCancelEntityId('');
    setCancelReason('');
    setShowForm(false);
    showToast('Cancellation logged.');
    loadScheduleData(selectedScheduleId);
    setSubmitting(false);
  }

  async function markHandled(id: string) {
    const { error } = await supabase.from('cancellations').update({ handled: true }).eq('id', id);
    if (error) showToast('Failed to update cancellation.', 'error');
    else showToast('Marked as handled.');
    loadScheduleData(selectedScheduleId);
  }

  async function deleteCancellation(id: string) {
    const { error } = await supabase.from('cancellations').delete().eq('id', id);
    setConfirmDeleteId(null);
    if (error) showToast('Failed to delete cancellation.', 'error');
    else showToast('Cancellation removed.');
    loadScheduleData(selectedScheduleId);
  }

  const currentSchedule = schedules.find((s) => s.id === selectedScheduleId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cancellations</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage cancellations and get recommendations</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!selectedScheduleId}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Plus size={16} /> Log Cancellation
        </button>
      </div>

      {/* Week selector */}
      <div className="mb-5">
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Week</label>
        <select
          className="form-input w-64"
          value={selectedScheduleId}
          onChange={(e) => setSelectedScheduleId(e.target.value)}
        >
          {schedules.length === 0 && <option value="">No schedules yet</option>}
          {schedules.map((s) => {
            const monday = new Date(s.week_start_date + 'T00:00:00');
            return (
              <option key={s.id} value={s.id}>
                {formatWeekRange(monday)} ({s.status})
              </option>
            );
          })}
        </select>
      </div>

      {/* Cancellations list */}
      {cancellations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-16">
          <AlertTriangle size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">No cancellations logged for this week</p>
          <p className="text-slate-400 text-sm mt-1">Use "Log Cancellation" to record a client or staff absence.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cancellations.map((c) => {
            const entityName =
              c.cancellation_type === 'client'
                ? `${(c as any).client?.first_name ?? ''} ${(c as any).client?.last_name ?? ''}`.trim()
                : (c as any).staff?.name ?? 'Unknown';
            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border p-4 ${c.handled ? 'opacity-60 border-slate-100' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.cancellation_type === 'client'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {c.cancellation_type === 'client' ? 'Client' : 'Staff'}
                      </span>
                      <span className="font-semibold text-slate-900">{entityName}</span>
                      <span className="text-slate-500 text-sm">
                        {DAY_NAMES[c.day_of_week as DayOfWeek]}, {c.shift === 'FULL' ? 'Full Day' : c.shift}
                      </span>
                      {c.handled && (
                        <span className="flex items-center gap-1 text-xs text-aqua-500">
                          <CheckCircle2 size={12} /> Handled
                        </span>
                      )}
                    </div>
                    {c.reason && (
                      <p className="text-sm text-slate-500 mb-2">Reason: {c.reason}</p>
                    )}
                    {c.recommendation && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">
                        <span className="font-medium block mb-0.5">Recommendation</span>
                        {c.recommendation}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    {!c.handled && (
                      <button
                        onClick={() => markHandled(c.id)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-aqua-50 hover:text-aqua-500 transition-colors"
                        title="Mark as handled"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteId(c.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-slate-900 mb-2">Delete cancellation?</h3>
            <p className="text-slate-500 text-sm mb-5">This record will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteCancellation(confirmDeleteId)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Log cancellation modal */}      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Log Cancellation</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitCancellation} className="p-6 space-y-4">
              <div>
                <label className="form-label">Cancellation Type</label>
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => { setCancelType('client'); setCancelEntityId(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${cancelType === 'client' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Client Absent
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCancelType('staff'); setCancelEntityId(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${cancelType === 'staff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Staff Out
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">{cancelType === 'client' ? 'Client' : 'Staff Member'}</label>
                <select className="form-input" value={cancelEntityId} onChange={(e) => setCancelEntityId(e.target.value)} required>
                  <option value="">Select…</option>
                  {(cancelType === 'client' ? clients : staff).map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {cancelType === 'client'
                        ? `${(entity as Client).first_name} ${(entity as Client).last_name}`
                        : (entity as Staff).name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Day</label>
                  <select className="form-input" value={cancelDay} onChange={(e) => setCancelDay(Number(e.target.value) as DayOfWeek)}>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{DAY_NAMES[d]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Shift</label>
                  <select className="form-input" value={cancelShift} onChange={(e) => setCancelShift(e.target.value as 'AM' | 'PM' | 'FULL')}>
                    <option value="FULL">Full Day</option>
                    <option value="AM">AM Only</option>
                    <option value="PM">PM Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Reason <span className="font-normal text-slate-400">(optional, max 200 chars)</span></label>
                <input
                  className="form-input"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Illness, personal, etc."
                  maxLength={200}
                />
                {cancelReason.length > 160 && (
                  <p className="text-xs text-amber-600 mt-1">{200 - cancelReason.length} characters remaining</p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 text-sm">Cancel</button>
                <button type="submit" disabled={submitting || !cancelEntityId} className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {submitting ? 'Logging…' : 'Log & Get Recommendation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
