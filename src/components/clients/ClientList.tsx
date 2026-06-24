import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Client, ClientAvailability, DayOfWeek } from '../../lib/types';
import { DAY_SHORT } from '../../lib/types';
import { Plus, Pencil, Trash2, UserRound, ShieldAlert } from 'lucide-react';
import { ClientForm } from './ClientForm';
import { useToast } from '../../lib/toast';

export function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const showToast = useToast();

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select(`*, client_attendance(*), client_availability(*), staff_client_restrictions(*, staff(name))`)
      .order('first_name');
    if (error) showToast('Failed to load clients.', 'error');
    setClients(data ?? []);
    setLoading(false);
  }

  async function deleteClient(id: string) {
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', id);
    setDeleting(false);
    setConfirmDelete(null);
    if (error) {
      showToast('Failed to remove client.', 'error');
    } else {
      showToast('Client removed.');
      loadClients();
    }
  }

  function getAvailSummary(avail: ClientAvailability[]) {
    const days: DayOfWeek[] = [1, 2, 3, 4, 5];
    return days.map((d) => {
      const row = avail.find((a) => a.day_of_week === d);
      if (!row) return { day: d, label: '–', active: false, full: false };
      const start = row.time_start ? row.time_start.slice(0, 5) : '08:00';
      const end = row.time_end ? row.time_end.slice(0, 5) : '14:30';
      const isFull = start === '08:00' && end === '14:30';
      return { day: d, label: isFull ? 'ALL' : `${start}–${end}`, active: true, full: isFull };
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
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 text-sm mt-0.5">{clients.filter(c => c.is_active).length} active clients</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <UserRound size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No clients yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => {
            const avail: ClientAvailability[] = (c as any).client_availability ?? [];
            const attendance: any[] = (c as any).client_attendance ?? [];
            const restrictions: any[] = (c as any).staff_client_restrictions ?? [];
            const days: DayOfWeek[] = [1, 2, 3, 4, 5];

            // Use availability data if present, fall back to attendance for display
            const hasAvail = avail.length > 0;
            const availSummary = hasAvail ? getAvailSummary(avail) : null;

            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${
                  !c.is_active ? 'opacity-50 border-slate-200' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm flex-shrink-0"
                  style={{ backgroundColor: (c.color || '#0ea5e9') + '28', color: c.color || '#0ea5e9' }}
                >
                  {c.first_name.slice(0, 1)}{c.last_name.slice(0, 1)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{c.first_name} {c.last_name}</span>
                    {!c.is_active && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">Inactive</span>}
                  </div>

                  {/* Availability windows (same style as staff) */}
                  {availSummary ? (
                    <div className="flex gap-1.5 mt-2">
                      {availSummary.map((a) => (
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
                  ) : (
                    /* Legacy: simple day dots from client_attendance */
                    <div className="flex gap-1.5 mt-2">
                      {days.map((d) => {
                        const attends = attendance.some((a: any) => a.day_of_week === d);
                        return (
                          <span
                            key={d}
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              attends ? 'bg-aqua-100 text-aqua-700' : 'bg-slate-50 text-slate-300'
                            }`}
                          >
                            {DAY_SHORT[d]}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-3 mt-1.5 flex-wrap">
                    {c.no_male_therapists && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Female therapists only</span>
                    )}
                    {c.authorized_hours_per_week && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Auth: {c.authorized_hours_per_week}h/wk
                      </span>
                    )}
                    {c.ramp_up_schedule && c.ramp_up_schedule.length > 0 && (
                      <span className="text-xs text-aqua-600 bg-aqua-50 px-2 py-0.5 rounded-full">
                        Ramp-up ({c.ramp_up_schedule.length} wks)
                      </span>
                    )}
                    {(c.required_skills ?? []).map((skill) => (
                      <span key={skill} className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {skill}
                      </span>
                    ))}
                    {restrictions.length > 0 && (
                      <span className="text-xs text-red-500">
                        Not with: {restrictions.map((r: any) => r.staff?.name).filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Scheduling rules */}
                  {(c.scheduling_rules ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(c.scheduling_rules ?? []).map((rule) => (
                        <span key={rule} className="flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                          <ShieldAlert size={10} className="flex-shrink-0" />
                          {rule}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditTarget(c); setShowForm(true); }}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-slate-900 mb-2">Remove client?</h3>
            <p className="text-slate-500 text-sm mb-5">This will remove all their availability, attendance, and restriction records.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteClient(confirmDelete)} disabled={deleting} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">{deleting ? 'Removing…' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <ClientForm
          client={editTarget}
          onSave={() => {
            setShowForm(false);
            showToast(editTarget ? 'Client updated.' : 'Client added.');
            loadClients();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
