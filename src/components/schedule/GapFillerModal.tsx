import React, { useState } from 'react';
import type { RatioAlert, ScheduleAssignment, Staff, Client, StaffClientRestriction, DayOfWeek, AssignmentShift } from '../../lib/types';
import { DAY_NAMES, SHIFT_TIMES } from '../../lib/types';
import { X, UserPlus, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';

interface GapFillerModalProps {
  alert: RatioAlert;
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  allRestrictions: StaffClientRestriction[];
  scheduleId: string;
  onAssign: (assignmentId: string, staffId: string) => Promise<void>;
  onInsert: (day: DayOfWeek, shift: AssignmentShift, clientId: string, staffId: string) => Promise<void>;
  onClose: () => void;
}

function getRestrictionWarning(
  staffId: string,
  clientId: string,
  client: Client,
  staffMember: Staff,
  restrictions: StaffClientRestriction[]
): string | null {
  if (restrictions.some((r) => r.staff_id === staffId && r.client_id === clientId)) {
    return 'Client restriction';
  }
  if (client.no_male_therapists && staffMember.gender === 'male') {
    return 'Client requires female therapist';
  }
  const required = client.required_skills ?? [];
  const missing = required.filter((sk) => !(staffMember.skills ?? []).includes(sk));
  if (missing.length) return `Missing skills: ${missing.join(', ')}`;
  return null;
}

function StaffDropdown({
  assignmentId,
  clientId,
  currentStaffId,
  staff,
  client,
  restrictions,
  onAssign,
  saving,
}: {
  assignmentId: string | null;
  clientId: string;
  currentStaffId: string | null;
  staff: Staff[];
  client: Client;
  restrictions: StaffClientRestriction[];
  onAssign: (staffId: string) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = staff.find((s) => s.id === currentStaffId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-sm text-slate-700 transition-colors min-w-[160px] justify-between"
      >
        <span className={selected ? 'text-slate-900 font-medium' : 'text-slate-400'}>
          {selected ? selected.name : 'Assign staff…'}
        </span>
        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-10 min-w-[220px] py-1 max-h-60 overflow-y-auto">
          {staff.filter((s) => s.is_active).map((s) => {
            const warning = getRestrictionWarning(s.id, clientId, client, s, restrictions);
            return (
              <button
                key={s.id}
                onClick={() => { onAssign(s.id); setOpen(false); }}
                className="w-full flex items-start gap-2 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800">{s.name}</span>
                    {warning && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                  </div>
                  {warning && <p className="text-xs text-amber-600">{warning}</p>}
                  <p className="text-xs text-slate-400 capitalize">{s.employment_type} · Tier {s.priority_tier}</p>
                </div>
                {s.id === currentStaffId && <CheckCircle2 size={14} className="text-aqua-500 mt-0.5 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GapFillerModal({
  alert,
  assignments,
  staff,
  clients,
  allRestrictions,
  scheduleId,
  onAssign,
  onInsert,
  onClose,
}: GapFillerModalProps) {
  const [saving, setSaving] = useState<string | null>(null);

  const slotAssignments = assignments.filter(
    (a) => a.day_of_week === alert.day && a.shift === alert.shift
  );

  // Clients who attend this slot but have no assignment yet
  const assignedClientIds = new Set(slotAssignments.map((a) => a.client_id));
  const clientsInSlot = clients.filter((c) => {
    if (assignedClientIds.has(c.id)) return false;
    // Check if client can attend this slot
    const avail = c.availability ?? [];
    if (avail.length === 0) return false;
    const shiftTimes = SHIFT_TIMES[alert.shift];
    return avail.some((a) => {
      if (a.day_of_week !== alert.day) return false;
      if (a.time_start && a.time_end) {
        return a.time_start.slice(0, 5) <= shiftTimes.start && a.time_end.slice(0, 5) >= shiftTimes.end;
      }
      return a.shift === alert.shift || a.shift === 'FULL';
    });
  });

  async function handleAssign(assignment: ScheduleAssignment | null, clientId: string, staffId: string) {
    const key = assignment ? assignment.id : `new-${clientId}`;
    setSaving(key);
    try {
      if (assignment) {
        await onAssign(assignment.id, staffId);
      } else {
        await onInsert(alert.day, alert.shift, clientId, staffId);
      }
    } finally {
      setSaving(null);
    }
  }

  const shiftTimes = SHIFT_TIMES[alert.shift];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <UserPlus size={18} className="text-accent-500" />
              <h2 className="font-semibold text-slate-900">Fill Staffing Gap</h2>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {DAY_NAMES[alert.day]} · {alert.shift} ({shiftTimes.start}–{shiftTimes.end}) · {alert.clientCount} client{alert.clientCount !== 1 ? 's' : ''}, {alert.eligibleStaffCount} assigned
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {slotAssignments.length === 0 && clientsInSlot.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No client sessions found for this slot.</p>
          ) : (
            <>
              {/* Existing assignments */}
              {slotAssignments.map((a) => {
                const client = clients.find((c) => c.id === a.client_id) ?? (a.client as Client | undefined);
                if (!client) return null;
                const isUnassigned = !a.staff_id;
                const isSaving = saving === a.id;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      isUnassigned ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900">
                        {client.first_name} {client.last_name}
                      </div>
                      {a.violation_reason && (
                        <p className="text-xs text-red-500 truncate">{a.violation_reason}</p>
                      )}
                      {!isUnassigned && !a.violation_reason && (
                        <p className="text-xs text-aqua-600">
                          Assigned: {staff.find((s) => s.id === a.staff_id)?.name ?? 'Unknown'}
                        </p>
                      )}
                      {isUnassigned && <p className="text-xs text-red-500">Unassigned</p>}
                    </div>
                    <StaffDropdown
                      assignmentId={a.id}
                      clientId={client.id}
                      currentStaffId={a.staff_id}
                      staff={staff}
                      client={client}
                      restrictions={allRestrictions}
                      onAssign={(staffId) => handleAssign(a, client.id, staffId)}
                      saving={isSaving}
                    />
                  </div>
                );
              })}

              {/* Clients without any assignment yet */}
              {clientsInSlot.map((client) => {
                const key = `new-${client.id}`;
                const isSaving = saving === key;
                return (
                  <div key={client.id} className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900">
                        {client.first_name} {client.last_name}
                      </div>
                      <p className="text-xs text-amber-600">No session created yet</p>
                    </div>
                    <StaffDropdown
                      assignmentId={null}
                      clientId={client.id}
                      currentStaffId={null}
                      staff={staff}
                      client={client}
                      restrictions={allRestrictions}
                      onAssign={(staffId) => handleAssign(null, client.id, staffId)}
                      saving={isSaving}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
