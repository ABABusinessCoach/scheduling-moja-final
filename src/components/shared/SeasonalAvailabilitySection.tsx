import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  SeasonalPeriod,
  StaffSeasonalAvailability,
  ClientSeasonalAvailability,
  DayOfWeek,
} from '../../lib/types';
import { SEASON_CONFIG, DAY_NAMES, TIME_SLOTS, ALL_END_TIMES, formatTime } from '../../lib/types';
import { CalendarRange, ChevronDown, ChevronUp, Loader2, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';

type SeasonalRow = StaffSeasonalAvailability | ClientSeasonalAvailability;

interface DayWindow {
  day: DayOfWeek;
  enabled: boolean;
  start: string;
  end: string;
}

const DEFAULT_END: Record<string, string> = {
  summer: '15:30',
  winter_break: '14:30',
  spring_break: '14:30',
  custom: '14:30',
};

function defaultEnd(periodType: string): string {
  return DEFAULT_END[periodType] ?? '14:30';
}

function makeDefaultWindows(periodType: string): DayWindow[] {
  return ([1, 2, 3, 4, 5] as DayOfWeek[]).map(d => ({
    day: d, enabled: false, start: '08:00', end: defaultEnd(periodType),
  }));
}

function rowsToWindows(rows: SeasonalRow[], periodType: string): DayWindow[] {
  const end = defaultEnd(periodType);
  return ([1, 2, 3, 4, 5] as DayOfWeek[]).map(d => {
    const row = rows.find(r => r.day_of_week === d);
    if (!row || !row.is_available) return { day: d, enabled: false, start: '08:00', end };
    return { day: d, enabled: true, start: row.time_start.slice(0, 5), end: row.time_end.slice(0, 5) };
  });
}

function isCurrentlyActive(p: SeasonalPeriod) {
  const today = new Date().toISOString().slice(0, 10);
  return p.is_active && today >= p.date_start && today <= p.date_end;
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface SeasonalAvailabilitySectionProps {
  entityId: string;
  entityType: 'staff' | 'client';
}

export function SeasonalAvailabilitySection({ entityId, entityType }: SeasonalAvailabilitySectionProps) {
  const [periods, setPeriods] = useState<SeasonalPeriod[]>([]);
  const [rowsByPeriod, setRowsByPeriod] = useState<Record<string, SeasonalRow[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPeriod, setSavingPeriod] = useState<string | null>(null);

  const entityCol = entityType === 'staff' ? 'staff_id' : 'client_id';
  const table = entityType === 'staff' ? 'staff_seasonal_availability' : 'client_seasonal_availability';

  const load = useCallback(async () => {
    setLoading(true);
    const [periodsRes, rowsRes] = await Promise.all([
      supabase.from('seasonal_periods').select('*').eq('is_active', true).order('date_start'),
      supabase.from(table).select('*').eq(entityCol, entityId),
    ]);
    setPeriods(periodsRes.data ?? []);
    const grouped: Record<string, SeasonalRow[]> = {};
    for (const row of (rowsRes.data ?? [])) {
      if (!grouped[row.period_id]) grouped[row.period_id] = [];
      grouped[row.period_id].push(row as SeasonalRow);
    }
    setRowsByPeriod(grouped);
    setLoading(false);
  }, [entityId, entityType]);

  useEffect(() => { load(); }, [load]);

  async function saveWindows(periodId: string, windows: DayWindow[]) {
    setSavingPeriod(periodId);
    try {
      await supabase.from(table).delete().eq(entityCol, entityId).eq('period_id', periodId);

      const toInsert = windows
        .filter(w => w.enabled)
        .map(w => ({
          [entityCol]: entityId,
          period_id: periodId,
          day_of_week: w.day,
          time_start: w.start,
          time_end: w.end,
          is_available: true,
        }));

      if (toInsert.length > 0) {
        await supabase.from(table).insert(toInsert);
      }
      await load();
    } finally {
      setSavingPeriod(null);
    }
  }

  async function clearPeriod(periodId: string) {
    await supabase.from(table).delete().eq(entityCol, entityId).eq('period_id', periodId);
    setRowsByPeriod(prev => { const next = { ...prev }; delete next[periodId]; return next; });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
        <Loader2 size={14} className="animate-spin" /> Loading seasonal periods…
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl">
        No active seasonal periods defined. <a href="#" className="text-accent-500 hover:underline" onClick={e => { e.preventDefault(); }}>Go to Seasonal Schedules</a> to add one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {periods.map(period => {
        const cfg = SEASON_CONFIG[period.period_type];
        const rows = rowsByPeriod[period.id] ?? [];
        const hasOverride = rows.length > 0;
        const isOpen = expanded === period.id;
        const currentlyActive = isCurrentlyActive(period);
        const saving = savingPeriod === period.id;

        const windows: DayWindow[] = hasOverride ? rowsToWindows(rows, period.period_type) : makeDefaultWindows(period.period_type);

        return (
          <div
            key={period.id}
            className={`border rounded-xl overflow-hidden ${currentlyActive ? 'border-accent-300' : 'border-slate-200'}`}
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : period.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
            >
              <span className="text-lg flex-shrink-0">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{period.name}</span>
                  {currentlyActive && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                      <CheckCircle2 size={8} /> Now
                    </span>
                  )}
                  {hasOverride ? (
                    <span className="text-[10px] font-semibold text-accent-600 bg-accent-50 border border-accent-200 px-1.5 py-0.5 rounded-full">
                      Customized
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                      Regular hours
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <CalendarRange size={10} />
                  {formatDate(period.date_start)} – {formatDate(period.date_end)}
                </div>
              </div>
              {isOpen ? <ChevronUp size={15} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />}
            </button>

            {/* Body */}
            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs text-slate-500 mb-3">
                  Set specific hours for this period. Days left <strong>off</strong> will use the regular schedule.
                </p>

                <SeasonDayGrid
                  windows={windows}
                  saving={saving}
                  onSave={w => saveWindows(period.id, w)}
                />

                {hasOverride && (
                  <button
                    type="button"
                    onClick={() => clearPeriod(period.id)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={11} /> Remove overrides (revert to regular hours)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Day grid editor ────────────────────────────────────────────────────────

function SeasonDayGrid({
  windows: initialWindows,
  saving,
  onSave,
}: {
  windows: DayWindow[];
  saving: boolean;
  onSave: (w: DayWindow[]) => void;
}) {
  const [windows, setWindows] = useState<DayWindow[]>(initialWindows);

  useEffect(() => { setWindows(initialWindows); }, [JSON.stringify(initialWindows)]);

  function update(day: DayOfWeek, patch: Partial<DayWindow>) {
    setWindows(prev => prev.map(w => w.day === day ? { ...w, ...patch } : w));
  }

  return (
    <div>
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-3">
        <div
          className="grid bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200"
          style={{ gridTemplateColumns: '80px 40px 1fr 16px 1fr' }}
        >
          <div className="px-3 py-2">Day</div>
          <div className="px-2 py-2 text-center">On</div>
          <div className="px-3 py-2">Start</div>
          <div />
          <div className="px-3 py-2">End</div>
        </div>
        {windows.map(w => {
          const validEnd = ALL_END_TIMES.filter(t => t > w.start);
          return (
            <div
              key={w.day}
              className={`grid border-b border-slate-100 last:border-0 ${!w.enabled ? 'opacity-50 bg-slate-50/60' : ''}`}
              style={{ gridTemplateColumns: '80px 40px 1fr 16px 1fr' }}
            >
              <div className="px-3 py-2.5 text-sm font-medium text-slate-700 flex items-center">
                {DAY_NAMES[w.day].slice(0, 3)}
              </div>
              <div className="px-2 py-2.5 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => update(w.day, { enabled: !w.enabled })}
                  className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${w.enabled ? 'bg-accent-400' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${w.enabled ? 'left-3.5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="px-3 py-2 flex items-center">
                <select
                  disabled={!w.enabled}
                  value={w.start}
                  onChange={e => {
                    const ns = e.target.value;
                    const ne = ns >= w.end ? TIME_SLOTS.find(t => t > ns) ?? '16:00' : w.end;
                    update(w.day, { start: ns, end: ne });
                  }}
                  className="form-input py-1.5 text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-300"
                >
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-center text-slate-300 text-xs">–</div>
              <div className="px-3 py-2 flex items-center">
                <select
                  disabled={!w.enabled}
                  value={w.end}
                  onChange={e => update(w.day, { end: e.target.value })}
                  className="form-input py-1.5 text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-300"
                >
                  {validEnd.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSave(windows)}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        {saving ? 'Saving…' : 'Save seasonal hours'}
      </button>
    </div>
  );
}
