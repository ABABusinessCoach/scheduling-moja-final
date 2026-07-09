import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { ScheduleAssignment, Staff, Client } from '../../lib/types';
import { DAY_NAMES, formatTime } from '../../lib/types';
import { Bell, CheckCircle2, Clock, XCircle, RefreshCw, ChevronDown, ChevronUp, Loader2, User } from 'lucide-react';
import { ShiftOfferModal } from './ShiftOfferModal';

interface ShiftOffer {
  id: string;
  assignment_id: string | null;
  client_id: string;
  day_of_week: number;
  time_start: string;
  time_end: string;
  shift_label: string;
  notes: string;
  status: 'open' | 'claimed' | 'cancelled';
  claimed_by_staff_id: string | null;
  claimed_at: string | null;
  created_at: string;
  notifications?: OfferNotification[];
}

interface OfferNotification {
  id: string;
  staff_id: string;
  response: 'accepted' | 'declined' | null;
  responded_at: string | null;
  sent_at: string;
}

interface ShiftOffersViewProps {
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  scheduleId: string;
}

export function ShiftOffersView({ assignments, staff, clients, scheduleId }: ShiftOffersViewProps) {
  const [offers, setOffers] = useState<ShiftOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);
  const [offerTarget, setOfferTarget] = useState<ScheduleAssignment | null>(null);

  const unassigned = assignments.filter((a) => !a.staff_id);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    const { data: offerRows } = await supabase
      .from('shift_offers')
      .select('*, notifications:shift_offer_notifications(id, staff_id, response, responded_at, sent_at)')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false });
    setOffers((offerRows as ShiftOffer[]) ?? []);
    setLoading(false);
  }, [scheduleId]);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  async function cancelOffer(offerId: string) {
    await supabase.from('shift_offers').update({ status: 'cancelled' }).eq('id', offerId);
    setOffers((prev) => prev.map((o) => o.id === offerId ? { ...o, status: 'cancelled' } : o));
  }

  function getClientName(clientId: string) {
    const c = clients.find((c) => c.id === clientId);
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown';
  }

  function getStaffName(staffId: string | null) {
    if (!staffId) return null;
    return staff.find((s) => s.id === staffId)?.name ?? null;
  }

  const openOffers = offers.filter((o) => o.status === 'open');
  const closedOffers = offers.filter((o) => o.status !== 'open');

  return (
    <div className="space-y-6">
      {/* Unassigned sessions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Clock size={14} className="text-amber-500" />
            Unassigned Sessions
            {unassigned.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-semibold">
                {unassigned.length}
              </span>
            )}
          </h3>
        </div>

        {unassigned.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
            All sessions are assigned.
          </div>
        ) : (
          <div className="space-y-2">
            {unassigned.map((a) => {
              const client = clients.find((c) => c.id === a.client_id);
              const timeLabel =
                a.time_start && a.time_end
                  ? `${formatTime(a.time_start.slice(0, 5))} – ${formatTime(a.time_end.slice(0, 5))}`
                  : a.shift ?? '';
              const alreadyOffered = openOffers.some((o) => o.assignment_id === a.id);

              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {client && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: client.color || '#0ea5e9' }} />
                      )}
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {client ? `${client.first_name} ${client.last_name}` : 'Unknown client'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 ml-4">
                      {DAY_NAMES[a.day_of_week as 1|2|3|4|5|6]} · {timeLabel}
                    </div>
                  </div>

                  {alreadyOffered ? (
                    <span className="text-xs text-amber-600 font-medium flex items-center gap-1 flex-shrink-0">
                      <Bell size={11} /> Offered
                    </span>
                  ) : (
                    <button
                      onClick={() => setOfferTarget(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                    >
                      <Bell size={11} /> Offer Shift
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active offers */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Bell size={14} className="text-accent-500" />
            Active Offers
            {openOffers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent-100 text-accent-600 rounded-full font-semibold">
                {openOffers.length}
              </span>
            )}
          </h3>
          <button onClick={loadOffers} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" title="Refresh">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>

        {openOffers.length === 0 && !loading ? (
          <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
            No active offers for this week.
          </div>
        ) : (
          <div className="space-y-2">
            {openOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                expanded={expandedOffer === offer.id}
                onToggle={() => setExpandedOffer(expandedOffer === offer.id ? null : offer.id)}
                onCancel={() => cancelOffer(offer.id)}
                getClientName={getClientName}
                getStaffName={getStaffName}
                staff={staff}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past offers */}
      {closedOffers.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Past Offers
          </h3>
          <div className="space-y-2">
            {closedOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                expanded={expandedOffer === offer.id}
                onToggle={() => setExpandedOffer(expandedOffer === offer.id ? null : offer.id)}
                onCancel={() => {}}
                getClientName={getClientName}
                getStaffName={getStaffName}
                staff={staff}
              />
            ))}
          </div>
        </section>
      )}

      {offerTarget && (
        <ShiftOfferModal
          assignment={offerTarget}
          staff={staff}
          clients={clients}
          onClose={() => setOfferTarget(null)}
          onOffered={() => { setOfferTarget(null); loadOffers(); }}
        />
      )}
    </div>
  );
}

function OfferCard({
  offer,
  expanded,
  onToggle,
  onCancel,
  getClientName,
  getStaffName,
  staff,
}: {
  offer: ShiftOffer;
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  getClientName: (id: string) => string;
  getStaffName: (id: string | null) => string | null;
  staff: Staff[];
}) {
  const statusColors = {
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    claimed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
  };

  const responded = (offer.notifications ?? []).filter((n) => n.response);
  const accepted = (offer.notifications ?? []).filter((n) => n.response === 'accepted');
  const pending = (offer.notifications ?? []).filter((n) => !n.response);

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${offer.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors[offer.status]} flex-shrink-0`}>
            {offer.status}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{getClientName(offer.client_id)}</div>
            <div className="text-xs text-slate-400">
              {DAY_NAMES[offer.day_of_week as 1|2|3|4|5|6]} · {formatTime(offer.time_start)} – {formatTime(offer.time_end)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-xs text-slate-400">
            {(offer.notifications ?? []).length} notified · {accepted.length} accepted
          </span>
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
          {/* Claimed by */}
          {offer.status === 'claimed' && offer.claimed_by_staff_id && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={13} />
              <span>Accepted by <strong>{getStaffName(offer.claimed_by_staff_id)}</strong></span>
            </div>
          )}

          {/* Notes */}
          {offer.notes && (
            <div className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span className="font-semibold">Note:</span> {offer.notes}
            </div>
          )}

          {/* Notification responses */}
          {(offer.notifications ?? []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Responses</div>
              <div className="space-y-1">
                {(offer.notifications ?? []).map((n) => {
                  const s = staff.find((st) => st.id === n.staff_id);
                  return (
                    <div key={n.id} className="flex items-center justify-between text-sm py-1">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <User size={11} className="text-slate-400" />
                        {s?.name ?? n.staff_id}
                      </span>
                      {n.response === 'accepted' ? (
                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={10} /> Accepted
                        </span>
                      ) : n.response === 'declined' ? (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <XCircle size={10} /> Declined
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancel button */}
          {offer.status === 'open' && (
            <button
              onClick={onCancel}
              className="w-full py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel this offer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
