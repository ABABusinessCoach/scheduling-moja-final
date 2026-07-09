import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SeasonalPeriod, SeasonPeriodType } from '../lib/types';
import { SEASON_CONFIG } from '../lib/types';
import { Plus, Pencil, Trash2, CalendarRange, CheckCircle2, Clock, X, Loader2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isCurrentlyActive(p: SeasonalPeriod) {
  const today = new Date().toISOString().slice(0, 10);
  return p.is_active && today >= p.date_start && today <= p.date_end;
}

function isUpcoming(p: SeasonalPeriod) {
  const today = new Date().toISOString().slice(0, 10);
  return p.is_active && today < p.date_start;
}

// ─── Period form modal ──────────────────────────────────────────────────────

interface PeriodFormProps {
  period?: SeasonalPeriod | null;
  onSave: () => void;
  onClose: () => void;
}

function PeriodForm({ period, onSave, onClose }: PeriodFormProps) {
  const isEdit = !!period;
  const [name, setName] = useState(period?.name ?? '');
  const [type, setType] = useState<SeasonPeriodType>(period?.period_type ?? 'summer');
  const [dateStart, setDateStart] = useState(period?.date_start ?? '');
  const [dateEnd, setDateEnd] = useState(period?.date_end ?? '');
  const [isActive, setIsActive] = useState(period?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!dateStart || !dateEnd) { setError('Both start and end dates are required.'); return; }
    if (dateEnd < dateStart) { setError('End date must be on or after start date.'); return; }

    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      period_type: type,
      date_start: dateStart,
      date_end: dateEnd,
      is_active: isActive,
    };
    try {
      if (isEdit && period) {
        const { error: err } = await supabase.from('seasonal_periods').update(payload).eq('id', period.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('seasonal_periods').insert(payload);
        if (err) throw err;
      }
      onSave();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{isEdit ? 'Edit Season' : 'Add Season'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div>
            <label className="form-label">Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer 2027" required />
          </div>

          <div>
            <label className="form-label">Type</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(Object.entries(SEASON_CONFIG) as [SeasonPeriodType, typeof SEASON_CONFIG[SeasonPeriodType]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                    type === key ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">{cfg.icon}</span>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} required />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsActive(!isActive)}
              className={`w-10 h-5.5 rounded-full relative transition-colors ${isActive ? 'bg-accent-400' : 'bg-slate-200'}`}
              style={{ height: '22px' }}
            >
              <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-all ${isActive ? 'left-5' : 'left-0.5'}`} style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="text-sm font-medium text-slate-700">Active (used by scheduler)</span>
          </label>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Season'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export function SeasonalPeriodsPage() {
  const [periods, setPeriods] = useState<SeasonalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SeasonalPeriod | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('seasonal_periods').select('*').order('date_start');
    setPeriods(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deletePeriod(id: string) {
    if (!confirm('Delete this seasonal period? All associated availability overrides will also be removed.')) return;
    await supabase.from('seasonal_periods').delete().eq('id', id);
    setPeriods(prev => prev.filter(p => p.id !== id));
  }

  async function toggleActive(p: SeasonalPeriod) {
    await supabase.from('seasonal_periods').update({ is_active: !p.is_active }).eq('id', p.id);
    setPeriods(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  }

  const activePeriods  = periods.filter(p => p.is_active);
  const inactivePeriods = periods.filter(p => !p.is_active);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Seasonal Schedules"
        subtitle="Define date ranges where staff and clients have different availability."
        action={
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={15} /> Add Season
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active periods */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Active Periods</h3>
            {activePeriods.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl py-10 text-center text-slate-400 text-sm">
                No active periods. Click "Add Season" to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {activePeriods.map(p => <PeriodCard key={p.id} period={p} onEdit={() => { setEditTarget(p); setShowForm(true); }} onDelete={() => deletePeriod(p.id)} onToggleActive={() => toggleActive(p)} />)}
              </div>
            )}
          </section>

          {inactivePeriods.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Inactive / Archived</h3>
              <div className="space-y-2 opacity-70">
                {inactivePeriods.map(p => <PeriodCard key={p.id} period={p} onEdit={() => { setEditTarget(p); setShowForm(true); }} onDelete={() => deletePeriod(p.id)} onToggleActive={() => toggleActive(p)} />)}
              </div>
            </section>
          )}

          {/* Info callout */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <strong>How it works:</strong> During an active period, open any staff or client profile to set their seasonal availability. The scheduler automatically uses those overrides instead of the regular schedule.
          </div>
        </div>
      )}

      {showForm && (
        <PeriodForm
          period={editTarget}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function PeriodCard({ period, onEdit, onDelete, onToggleActive }: {
  period: SeasonalPeriod;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const cfg = SEASON_CONFIG[period.period_type];
  const active = isCurrentlyActive(period);
  const upcoming = isUpcoming(period);

  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 bg-white border rounded-xl transition-colors ${active ? 'border-accent-300 bg-accent-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
      <span className="text-2xl flex-shrink-0">{cfg.icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">{period.name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge}`}>
            {cfg.label}
          </span>
          {active && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
              <CheckCircle2 size={9} /> Active Now
            </span>
          )}
          {upcoming && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock size={9} /> Upcoming
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
          <CalendarRange size={11} />
          {formatDate(period.date_start)} – {formatDate(period.date_end)}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onToggleActive}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            period.is_active
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-accent-50 text-accent-600 hover:bg-accent-100 border border-accent-200'
          }`}
          title={period.is_active ? 'Deactivate' : 'Activate'}
        >
          {period.is_active ? 'Active' : 'Inactive'}
        </button>
        <button onClick={onEdit} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Edit"><Pencil size={14} /></button>
        <button onClick={onDelete} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
