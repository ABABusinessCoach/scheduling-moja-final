import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Loader2, CalendarCheck } from 'lucide-react';

interface ShiftDetails {
  offer_id: string;
  offer_status: string;
  already_responded: boolean;
  response: string | null;
  staff_name: string;
  client_name: string;
  day_label: string;
  time_label: string;
  shift_label: string;
  notes: string;
}

interface AcceptShiftPageProps {
  token: string;
}

export function AcceptShiftPage({ token }: AcceptShiftPageProps) {
  const [details, setDetails] = useState<ShiftDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-shift`;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${baseUrl}?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to load shift details');
        setDetails(json);
      } catch (e: any) {
        setLoadError(e.message);
      }
    }
    load();
  }, [token]);

  async function acceptShift() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`${baseUrl}?token=${encodeURIComponent(token)}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to accept shift');
      setAccepted(true);
    } catch (e: any) {
      setAcceptError(e.message);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f8fa' }}>
      {/* Header */}
      <header className="flex items-center px-6 py-3 flex-shrink-0" style={{ background: '#2a3f55' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow">
            <img
              src="/files_4755529-2026-06-01T19-48-56-147Z-MOJA+Behavioral_(1).png"
              alt="Moja"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">Moja Behavioral Services</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: '#6dccc2' }}>Shift Notification</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">

          {/* Loading */}
          {!details && !loadError && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 size={28} className="animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Loading shift details…</p>
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
              <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
              <h2 className="font-semibold text-slate-800 text-lg mb-1">Link not found</h2>
              <p className="text-slate-500 text-sm">{loadError}</p>
            </div>
          )}

          {/* Already responded or offer closed */}
          {details && (details.already_responded || details.offer_status !== 'open') && !accepted && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
              {details.response === 'accepted' || details.offer_status === 'claimed' ? (
                <>
                  <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
                  <h2 className="font-semibold text-slate-800 text-lg mb-1">Already accepted</h2>
                  <p className="text-slate-500 text-sm">
                    {details.response === 'accepted'
                      ? 'You have already accepted this shift.'
                      : 'This shift has been claimed by another staff member.'}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle size={40} className="text-amber-400 mx-auto mb-3" />
                  <h2 className="font-semibold text-slate-800 text-lg mb-1">Offer no longer available</h2>
                  <p className="text-slate-500 text-sm">This shift offer has been cancelled.</p>
                </>
              )}
            </div>
          )}

          {/* Accept state */}
          {details && !details.already_responded && details.offer_status === 'open' && !accepted && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Open Shift Available</div>
                <h1 className="text-xl font-bold text-slate-900">Hi {details.staff_name},</h1>
                <p className="text-sm text-slate-500 mt-1">A session is available — tap below to accept it.</p>
              </div>

              {/* Shift details */}
              <div className="px-6 py-5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <CalendarCheck size={16} className="text-accent-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Client</div>
                      <div className="text-sm font-semibold text-slate-800 mt-0.5">{details.client_name}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock size={16} className="text-accent-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">When</div>
                      <div className="text-sm font-semibold text-slate-800 mt-0.5">{details.day_label}</div>
                      <div className="text-sm text-slate-600">{details.time_label}</div>
                    </div>
                  </div>
                </div>

                {details.notes && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                    <span className="font-semibold">Note: </span>{details.notes}
                  </div>
                )}

                <p className="text-xs text-slate-400 mt-3 text-center">
                  First to respond gets the shift. Your supervisor will be notified.
                </p>
              </div>

              {acceptError && (
                <div className="mx-6 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {acceptError}
                </div>
              )}

              <div className="px-6 pb-6">
                <button
                  onClick={acceptShift}
                  disabled={accepting}
                  className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                  style={{ background: '#16a34a' }}
                >
                  {accepting
                    ? <><Loader2 size={18} className="animate-spin" /> Accepting…</>
                    : <><CheckCircle2 size={18} /> Accept This Shift</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {accepted && (
            <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Shift accepted!</h2>
              <p className="text-slate-500 text-sm mb-4">
                You're confirmed for <strong>{details?.client_name}</strong> on <strong>{details?.day_label}</strong> at <strong>{details?.time_label}</strong>.
              </p>
              <p className="text-xs text-slate-400">Your supervisor has been notified. You can close this page.</p>
            </div>
          )}

        </div>
      </div>

      <footer className="py-4 text-center text-xs text-slate-400">
        Moja Behavioral Services &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
