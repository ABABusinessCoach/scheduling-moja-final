import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Staff, StaffAvailability, StaffClientRestriction, DayOfWeek } from '../../lib/types';
import { DAY_SHORT } from '../../lib/types';
import { Plus, Pencil, Trash2, User } from 'lucide-react';
import { StaffForm } from './StaffForm';
import { useToast } from '../../lib/toast';

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Tier 1', color: 'bg-amber-100 text-amber-700' },
  2: { label: 'Tier 2', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Tier 3', color: 'bg-slate-100 text-slate-600' },
};

export function StaffList() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const showToast = useToast();

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff')
      .select(`*, staff_availability(*), staff_client_restrictions(*, clients(first_name, last_name))`)
      .order('priority_tier')
      .order('name');
    if (error) showToast('Failed to load staff.', 'error');
    setStaff(data ?? []);
    setLoading(false);
  }

  async function deleteStaff(id: string) {
    setDeleting(true);
    const { error } = await supabase.from('staff').delete().eq('id', id);
    setDeleting(false);
    setConfirmDelete(null);
    if (error) {
      showToast('Failed to remove staff member.', 'error');
    } else {
      showToast('Staff member removed.');
      loadStaff();
    }
  }

  function getAvailSummary(avail: StaffAvailability[]) {
    const days: DayOfWeek[] = [1, 2, 3, 4, 5];
    return days.map((d) => {
      const dayAvail = avail.filter((a) => a.day_of_week === d);
      if (!dayAvail.length) return { day: d, label: '–', active: false, full: false };
      const a = dayAvail[0];
      if (a.time_start && a.time_end) {
        const start = a.time_start.slice(0, 5);
        const end = a.time_end.slice(0, 5);
        const isFull = start === '08:00' && end === '14:30';
        return { day: d, label: isFull ? 'ALL' : `${start}–${end}`, active: true, full: isFull };
      }
      const hasFull = dayAvail.some((x) => x.shift === 'FULL');
      const hasAM = dayAvail.some((x) => x.shift === 'AM');
      const hasPM = dayAvail.some((x) => x.shift === 'PM');
      if (hasFull) return { day: d, label: 'ALL', active: true, full: true };
      const parts = [];
      if (hasAM) parts.push('AM');
      if (hasPM) parts.push('PM');
      return { day: d, label: parts.join('/'), active: true, full: false };
    });
  }

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
          <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
          <p className="text-slate-500 text-sm mt-0.5">{staff.filter(s => s.is_active).length} active members</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <User size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No staff members yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[1, 2, 3].map((tier) => {
            const tierStaff = staff.filter((s) => s.priority_tier === tier);
            if (!tierStaff.length) return null;
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${TIER_LABELS[tier].color}`}>
                    {TIER_LABELS[tier].label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {tier === 1 ? 'OGs — hours first' : tier === 2 ? 'Ramping up' : 'Floater'}
                  </span>
                </div>
                <div className="grid gap-3">
                  {tierStaff.map((s) => {
                    const avail = getAvailSummary(s.availability ?? []);
                    const restrictions: any[] = (s as any).staff_client_restrictions ?? [];
                    return (
                      <div
                        key={s.id}
                        className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${
                          !s.is_active ? 'opacity-50 border-slate-200' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-aqua-100 flex items-center justify-center flex-shrink-0 text-aqua-600 font-semibold text-sm">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{s.name}</span>
                            {!s.is_active && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">Inactive</span>
                            )}
                            <span className="text-xs text-slate-400 capitalize">{s.employment_type}</span>
                            <span className="text-xs text-slate-400">{s.gender}</span>
                            <span className="text-xs text-slate-500 font-medium">{s.weekly_hour_goal}h/week goal</span>
                          </div>

                          {/* Availability */}
                          <div className="flex gap-1.5 mt-2">
                            {avail.map((a) => (
                              <div
                                key={a.day}
                                className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  !a.active
                                    ? 'bg-slate-50 text-slate-300'
                                    : a.full
                                    ? 'bg-aqua-100 text-aqua-700'
                                    : 'bg-blue-50 text-blue-600'
                                }`}
                                title={`${DAY_SHORT[a.day as DayOfWeek]}: ${a.label}`}
                              >
                                {DAY_SHORT[a.day as DayOfWeek]}
                                {a.active && <span className="ml-0.5 font-normal">{a.label !== 'ALL' ? ` ${a.label}` : ''}</span>}
                              </div>
                            ))}
                          </div>

                          {restrictions.length > 0 && (
                            <p className="text-xs text-red-500 mt-1.5">
                              Cannot work with:{' '}
                              {restrictions.map((r: any) => `${r.clients?.first_name} ${r.clients?.last_name}`).join(', ')}
                            </p>
                          )}

                          {/* Skills chips */}
                          {(s.skills ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {(s.skills ?? []).map((skill) => (
                                <span key={skill} className="text-xs text-aqua-700 bg-aqua-50 px-2 py-0.5 rounded-full border border-aqua-200">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Supervision indicator */}
                          {s.supervision_hours_required > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                                <div
                                  className={`h-full rounded-full ${
                                    (s.supervision_hours_this_week ?? 0) >= s.supervision_hours_required
                                      ? 'bg-aqua-300'
                                      : 'bg-amber-400'
                                  }`}
                                  style={{ width: `${Math.min(((s.supervision_hours_this_week ?? 0) / s.supervision_hours_required) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400">
                                Supervision: {s.supervision_hours_this_week ?? 0}h / {s.supervision_hours_required}h
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditTarget(s); setShowForm(true); }}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(s.id)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-slate-900 mb-2">Remove staff member?</h3>
            <p className="text-slate-500 text-sm mb-5">This will also remove their availability and any restrictions.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteStaff(confirmDelete)} disabled={deleting} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">{deleting ? 'Removing…' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <StaffForm
          staff={editTarget}
          onSave={() => {
            setShowForm(false);
            showToast(editTarget ? 'Staff member updated.' : 'Staff member added.');
            loadStaff();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
