import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  XCircle,
  Plus,
  X,
  CalendarOff,
  Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ClinicClosure } from '../lib/types';
import { useToast } from '../lib/toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ClosureModalProps {
  date: string;
  existing: ClinicClosure | null;
  onSave: (name: string, notes: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

function ClosureModal({ date, existing, onSave, onDelete, onClose }: ClosureModalProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const { y, m, d } = parseDate(date);
  const label = new Date(y, m, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), notes.trim());
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#ffffff' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: '#2a3f55' }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6dccc2' }}>
              {existing ? 'Edit Closure' : 'Mark Clinic Closed'}
            </p>
            <p className="text-white font-semibold text-sm mt-0.5">{label}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#2a3f55' }}>
              Closure Label <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Federal Holiday, Staff Training Day…"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
              style={{
                border: '1.5px solid #d1dbe6',
                background: '#f8fafb',
                color: '#1a2a3a',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#6dccc2')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#d1dbe6')}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#2a3f55' }}>
              Notes <span className="text-xs font-normal" style={{ color: '#8a9db5' }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about the closure…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all resize-none"
              style={{
                border: '1.5px solid #d1dbe6',
                background: '#f8fafb',
                color: '#1a2a3a',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#6dccc2')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#d1dbe6')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center gap-3">
          {existing && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: '#fef2f2', color: '#dc2626' }}
            >
              <XCircle size={14} />
              Remove Closure
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#f1f5f9', color: '#4a6078' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: '#2a3f55', color: '#ffffff' }}
          >
            {saving ? 'Saving…' : existing ? 'Update' : 'Mark Closed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ClinicCalendarPage() {
  const { showToast } = useToast();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [closures, setClosures] = useState<ClinicClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ date: string; existing: ClinicClosure | null } | null>(null);

  // Build a lookup map: ISO date → closure
  const closureMap = new Map<string, ClinicClosure>(
    closures.map((c) => [c.date, c])
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_closures')
      .select('*')
      .order('date', { ascending: true });
    if (error) {
      showToast('Failed to load clinic closures', 'error');
    } else {
      setClosures(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Month grid ────────────────────────────────────────────────────────────

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Grid cells: prefill leading empty cells from prev month, then current month
  const cells: { date: string | null; day: number; isCurrentMonth: boolean }[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    const d = daysInPrevMonth - firstDayOfMonth + 1 + i;
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ date: toDateStr(prevYear, prevMonth, d), day: d, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toDateStr(viewYear, viewMonth, d), day: d, isCurrentMonth: true });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ date: toDateStr(nextYear, nextMonth, d), day: d, isCurrentMonth: false });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async function handleSave(name: string, notes: string) {
    if (!modal) return;
    const { date, existing } = modal;
    if (existing) {
      const { error } = await supabase
        .from('clinic_closures')
        .update({ name, notes })
        .eq('id', existing.id);
      if (error) { showToast('Failed to update closure', 'error'); return; }
      showToast('Closure updated', 'success');
    } else {
      const { error } = await supabase
        .from('clinic_closures')
        .insert({ date, name, notes });
      if (error) { showToast('Failed to save closure', 'error'); return; }
      showToast('Day marked as closed', 'success');
    }
    setModal(null);
    load();
  }

  async function handleDelete() {
    if (!modal?.existing) return;
    const { error } = await supabase
      .from('clinic_closures')
      .delete()
      .eq('id', modal.existing.id);
    if (error) { showToast('Failed to remove closure', 'error'); return; }
    showToast('Closure removed', 'success');
    setModal(null);
    load();
  }

  function openModal(date: string) {
    setModal({ date, existing: closureMap.get(date) ?? null });
  }

  // ── Upcoming closures (next 90 days from today) ────────────────────────────

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const upcoming = closures
    .filter((c) => c.date >= todayStr)
    .slice(0, 20);

  const past = closures
    .filter((c) => c.date < todayStr)
    .slice(-8)
    .reverse();

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a2a3a' }}>Clinic Calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7f94' }}>
            Mark days when the clinic is closed — holidays, training days, or any planned closure.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: '#fff8e6', color: '#92600a', border: '1px solid #fde68a' }}
        >
          <Info size={13} />
          {closures.length} closure{closures.length !== 1 ? 's' : ''} recorded
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Calendar ── */}
        <div
          className="flex-1 rounded-2xl overflow-hidden shadow-sm"
          style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}
        >
          {/* Month navigation */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid #e2eaf2' }}
          >
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#4a6078' }}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="font-bold text-base" style={{ color: '#1a2a3a' }}>
                {MONTHS[viewMonth]} {viewYear}
              </p>
            </div>
            <button
              onClick={nextMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#4a6078' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-4 pt-3 pb-1">
            {DAY_HEADERS.map((h) => (
              <div key={h} className="text-center text-[11px] font-bold uppercase tracking-wide py-1" style={{ color: '#8a9db5' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#6dccc2', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px px-4 pb-4" style={{ background: '#f0f5f9' }}>
              {cells.map(({ date, day, isCurrentMonth }, i) => {
                if (!date) return <div key={i} />;
                const isClosed = closureMap.has(date);
                const isToday = date === todayStr;
                const closure = closureMap.get(date);

                return (
                  <button
                    key={date}
                    onClick={() => isCurrentMonth && openModal(date)}
                    disabled={!isCurrentMonth}
                    className="relative flex flex-col items-start rounded-xl p-2 min-h-[72px] transition-all group"
                    style={{
                      background: isClosed
                        ? '#fef2f2'
                        : isCurrentMonth
                        ? '#ffffff'
                        : '#f8f9fb',
                      border: isToday
                        ? '2px solid #6dccc2'
                        : isClosed
                        ? '1.5px solid #fca5a5'
                        : '2px solid transparent',
                      cursor: isCurrentMonth ? 'pointer' : 'default',
                      opacity: isCurrentMonth ? 1 : 0.4,
                    }}
                  >
                    {/* Hover overlay */}
                    {isCurrentMonth && !isClosed && (
                      <span
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: '#f0f9ff' }}
                      />
                    )}

                    {/* Day number */}
                    <span
                      className="relative z-10 text-sm font-semibold w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isToday ? '#2a3f55' : 'transparent',
                        color: isToday ? '#ffffff' : isClosed ? '#dc2626' : isCurrentMonth ? '#1a2a3a' : '#b0bec5',
                        fontSize: '13px',
                      }}
                    >
                      {day}
                    </span>

                    {/* Closure label */}
                    {isClosed && closure && (
                      <span
                        className="relative z-10 mt-1 text-[10px] font-semibold leading-tight text-left w-full truncate"
                        style={{ color: '#dc2626' }}
                      >
                        {closure.name}
                      </span>
                    )}

                    {/* Add indicator on hover for open days */}
                    {isCurrentMonth && !isClosed && (
                      <span
                        className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        style={{ color: '#6dccc2' }}
                      >
                        <Plus size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div
            className="flex items-center gap-5 px-6 py-3 text-xs font-medium"
            style={{ borderTop: '1px solid #e2eaf2', color: '#6b7f94' }}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }} />
              Clinic closed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ background: '#ffffff', border: '2px solid #6dccc2' }} />
              Today
            </span>
            <span className="flex items-center gap-1.5 ml-1">
              Click any day to mark or edit a closure
            </span>
          </div>
        </div>

        {/* ── Closures panel ── */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Upcoming */}
          <div
            className="rounded-2xl overflow-hidden shadow-sm"
            style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid #e2eaf2' }}
            >
              <p className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Upcoming Closures</p>
              <CalendarOff size={15} style={{ color: '#8a9db5' }} />
            </div>

            {upcoming.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <CalendarOff size={28} className="mx-auto mb-2" style={{ color: '#c8d6e0' }} />
                <p className="text-xs font-medium" style={{ color: '#8a9db5' }}>No upcoming closures</p>
                <p className="text-xs mt-0.5" style={{ color: '#b0bec5' }}>Click any future date to add one</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#f0f5f9' }}>
                {upcoming.map((c) => {
                  const { y, m, d } = parseDate(c.date);
                  const dateObj = new Date(y, m, d);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        // Navigate to the right month then open modal
                        setViewYear(y);
                        setViewMonth(m);
                        setModal({ date: c.date, existing: c });
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex-shrink-0 flex flex-col items-center justify-center text-white mt-0.5"
                          style={{ background: '#dc2626' }}
                        >
                          <span className="text-[10px] font-bold leading-none uppercase">
                            {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-sm font-bold leading-tight">
                            {d}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate" style={{ color: '#1a2a3a' }}>{c.name}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#6b7f94' }}>
                            {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          {c.notes && (
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: '#8a9db5' }}>{c.notes}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past closures */}
          {past.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden shadow-sm"
              style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}
            >
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid #e2eaf2' }}
              >
                <p className="text-sm font-bold" style={{ color: '#6b7f94' }}>Past Closures</p>
              </div>
              <div className="divide-y" style={{ borderColor: '#f0f5f9' }}>
                {past.map((c) => {
                  const { y, m, d } = parseDate(c.date);
                  const dateObj = new Date(y, m, d);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setViewYear(y);
                        setViewMonth(m);
                        setModal({ date: c.date, existing: c });
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex-shrink-0 flex flex-col items-center justify-center"
                          style={{ background: '#f1f5f9' }}
                        >
                          <span className="text-[9px] font-bold leading-none uppercase" style={{ color: '#8a9db5' }}>
                            {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-xs font-bold" style={{ color: '#6b7f94' }}>
                            {d}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#6b7f94' }}>{c.name}</p>
                          <p className="text-[10px]" style={{ color: '#b0bec5' }}>
                            {dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <ClosureModal
          date={modal.date}
          existing={modal.existing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
