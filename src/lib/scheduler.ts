import {
  Staff,
  Client,
  ScheduleAssignment,
  StaffClientRestriction,
  DayOfWeek,
  AssignmentShift,
  SHIFT_TIMES,
  StaffHours,
  RatioAlert,
  slotDuration,
  timeWindowCovers,
  RampUpEntry,
} from './types';

function shiftTimes(shift: AssignmentShift): { start: string; end: string } {
  return { start: SHIFT_TIMES[shift].start, end: SHIFT_TIMES[shift].end };
}

function staffCanWorkShift(staff: Staff, day: DayOfWeek, shift: AssignmentShift): boolean {
  const session = shiftTimes(shift);
  const avail = staff.availability ?? [];
  return avail.some((a) => {
    if (a.day_of_week !== day) return false;
    if (a.time_start && a.time_end) {
      return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), session.start, session.end);
    }
    return a.shift === 'FULL' || a.shift === shift;
  });
}

function clientCanAttendShift(client: Client, day: DayOfWeek, shift: AssignmentShift): boolean {
  const session = shiftTimes(shift);
  const avail = client.availability ?? [];

  if (avail.length === 0) {
    // Legacy fallback: use client_attendance + shift_type
    const attendsDay = (client.attendance ?? []).some((a) => a.day_of_week === day);
    if (!attendsDay) return false;
    if (client.shift_type === 'FULL') return true;
    if (client.shift_type === 'AM' && shift === 'AM') return true;
    if (client.shift_type === 'PM' && shift === 'PM') return true;
    if (client.shift_type === 'CUSTOM') return shift === 'AM';
    return false;
  }

  return avail.some((a) => {
    if (a.day_of_week !== day) return false;
    if (a.time_start && a.time_end) {
      return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), session.start, session.end);
    }
    return a.shift === 'FULL' || a.shift === shift;
  });
}

function staffHasRequiredSkills(staff: Staff, client: Client): boolean {
  const required = client.required_skills ?? [];
  if (!required.length) return true;
  const staffSkills = staff.skills ?? [];
  return required.every((skill) => staffSkills.includes(skill));
}

function isRestricted(staffId: string, clientId: string, restrictions: StaffClientRestriction[]): boolean {
  return restrictions.some((r) => r.staff_id === staffId && r.client_id === clientId);
}

function getStaffHoursInBatch(
  staffId: string,
  assignments: Omit<ScheduleAssignment, 'id' | 'created_at'>[]
): number {
  return (assignments as ScheduleAssignment[]).reduce((sum, a) => {
    if (a.staff_id !== staffId) return sum;
    if (a.time_start && a.time_end) {
      return sum + slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5));
    }
    return sum + SHIFT_TIMES[a.shift].hours;
  }, 0);
}

function getClientHoursInBatch(
  clientId: string,
  assignments: Omit<ScheduleAssignment, 'id' | 'created_at'>[]
): number {
  return (assignments as ScheduleAssignment[]).reduce((sum, a) => {
    if (a.client_id !== clientId) return sum;
    if (a.time_start && a.time_end) {
      return sum + slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5));
    }
    return sum + SHIFT_TIMES[a.shift].hours;
  }, 0);
}

function getPairingCount(
  staffId: string,
  clientId: string,
  assignments: Omit<ScheduleAssignment, 'id' | 'created_at'>[]
): number {
  return (assignments as ScheduleAssignment[]).filter(
    (a) => a.staff_id === staffId && a.client_id === clientId
  ).length;
}

/**
 * Resolve which ramp-up target applies for a given week.
 * weekNumber is 1-based from program start (stored in schedule metadata or passed in).
 * If no ramp-up schedule, returns null (no cap).
 */
export function getRampUpTarget(rampUp: RampUpEntry[] | null | undefined, weekNumber: number): number | null {
  if (!rampUp || !rampUp.length) return null;
  const sorted = [...rampUp].sort((a, b) => a.week_number - b.week_number);
  // Find the entry whose week_number <= weekNumber (most recent applicable target)
  let target: number | null = null;
  for (const entry of sorted) {
    if (entry.week_number <= weekNumber) target = entry.target_hours;
  }
  return target;
}

export function generateWeeklySchedule(
  scheduleId: string,
  staff: Staff[],
  clients: Client[],
  allRestrictions: StaffClientRestriction[],
  weekNumber = 1
): Omit<ScheduleAssignment, 'id' | 'created_at'>[] {
  const assignments: Omit<ScheduleAssignment, 'id' | 'created_at'>[] = [];
  const days: DayOfWeek[] = [1, 2, 3, 4, 5];
  const activeStaff = staff.filter((s) => s.is_active);
  const activeClients = clients.filter((c) => c.is_active);

  const bookedSlots = new Map<string, Set<string>>();

  function slotKey(day: DayOfWeek, shift: AssignmentShift) {
    return `${day}-${shift}`;
  }
  function isBooked(staffId: string, day: DayOfWeek, shift: AssignmentShift) {
    return bookedSlots.get(slotKey(day, shift))?.has(staffId) ?? false;
  }
  function book(staffId: string, day: DayOfWeek, shift: AssignmentShift) {
    const key = slotKey(day, shift);
    if (!bookedSlots.has(key)) bookedSlots.set(key, new Set());
    bookedSlots.get(key)!.add(staffId);
  }

  for (const day of days) {
    for (const shift of ['AM', 'PM'] as AssignmentShift[]) {
      const clientsForShift = activeClients.filter((c) => clientCanAttendShift(c, day, shift));

      const sessionWindow = shiftTimes(shift);

      for (const client of clientsForShift) {
        // Ramp-up / authorized hours cap — skip session if client is already at their weekly cap
        const rampTarget = getRampUpTarget(client.ramp_up_schedule, weekNumber);
        const authCap = client.authorized_hours_per_week;
        const effectiveCap = rampTarget !== null ? Math.min(rampTarget, authCap ?? Infinity) : authCap;
        if (effectiveCap !== null && effectiveCap !== undefined) {
          const alreadyScheduled = getClientHoursInBatch(client.id, assignments);
          const sessionHours = slotDuration(sessionWindow.start, sessionWindow.end);
          if (alreadyScheduled + sessionHours > effectiveCap) {
            // Skip this session — client is at their authorized/ramp-up cap
            continue;
          }
        }

        const eligible = activeStaff.filter((s) => {
          if (!staffCanWorkShift(s, day, shift)) return false;
          if (isBooked(s.id, day, shift)) return false;
          if (client.no_male_therapists && s.gender === 'male') return false;
          if (isRestricted(s.id, client.id, allRestrictions)) return false;
          if (!staffHasRequiredSkills(s, client)) return false;
          return true;
        });

        if (eligible.length === 0) {
          // Check if skills are the blocker
          const eligibleIgnoringSkills = activeStaff.filter((s) => {
            if (!staffCanWorkShift(s, day, shift)) return false;
            if (isBooked(s.id, day, shift)) return false;
            if (client.no_male_therapists && s.gender === 'male') return false;
            if (isRestricted(s.id, client.id, allRestrictions)) return false;
            return true;
          });
          const skillsMissing = eligibleIgnoringSkills.length > 0 && client.required_skills?.length > 0;
          const reason = skillsMissing
            ? `No eligible staff with required skills (${(client.required_skills ?? []).join(', ')}) available for this slot`
            : 'No eligible staff available for this slot';

          assignments.push({
            schedule_id: scheduleId,
            day_of_week: day,
            shift,
            time_start: sessionWindow.start,
            time_end: sessionWindow.end,
            staff_id: null,
            client_id: client.id,
            is_manual_override: false,
            violation_reason: reason,
          });
          continue;
        }

        const sorted = [...eligible].sort((a, b) => {
          if (a.priority_tier !== b.priority_tier) return a.priority_tier - b.priority_tier;
          const pairA = getPairingCount(a.id, client.id, assignments);
          const pairB = getPairingCount(b.id, client.id, assignments);
          if (pairA !== pairB) return pairA - pairB;
          return getStaffHoursInBatch(a.id, assignments) - getStaffHoursInBatch(b.id, assignments);
        });

        const chosen = sorted[0];
        book(chosen.id, day, shift);

        const sessionHours = slotDuration(sessionWindow.start, sessionWindow.end);
        const projectedHours = getStaffHoursInBatch(chosen.id, assignments) + sessionHours;

        const violations: string[] = [];
        if (projectedHours > chosen.weekly_hour_goal) {
          violations.push(`${chosen.name} will exceed weekly goal of ${chosen.weekly_hour_goal}h (projected ${projectedHours.toFixed(1)}h)`);
        }
        if (effectiveCap !== null && effectiveCap !== undefined) {
          const clientProjected = getClientHoursInBatch(client.id, assignments) + sessionHours;
          if (clientProjected > effectiveCap) {
            violations.push(`Client exceeds cap of ${effectiveCap}h/week (projected ${clientProjected.toFixed(1)}h)`);
          }
        }

        assignments.push({
          schedule_id: scheduleId,
          day_of_week: day,
          shift,
          time_start: sessionWindow.start,
          time_end: sessionWindow.end,
          staff_id: chosen.id,
          client_id: client.id,
          is_manual_override: false,
          violation_reason: violations.length ? violations.join('; ') : null,
        });
      }
    }
  }

  return assignments;
}

export function calculateStaffHours(
  staff: Staff[],
  assignments: ScheduleAssignment[]
): StaffHours[] {
  return staff
    .filter((s) => s.is_active)
    .map((s) => {
      const hours = assignments
        .filter((a) => a.staff_id === s.id)
        .reduce((sum, a) => {
          if (a.time_start && a.time_end) {
            return sum + slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5));
          }
          return sum + SHIFT_TIMES[a.shift].hours;
        }, 0);
      const goal = s.weekly_hour_goal;
      const status: StaffHours['status'] =
        hours > goal ? 'over' : hours >= goal * 0.9 ? 'at' : 'under';
      return { staffId: s.id, staffName: s.name, weeklyGoal: goal, assignedHours: hours, status };
    });
}

/**
 * Compute staffing ratio alerts: slots where clients > eligible staff.
 */
export function computeRatioAlerts(
  staff: Staff[],
  clients: Client[],
  allRestrictions: StaffClientRestriction[]
): RatioAlert[] {
  const alerts: RatioAlert[] = [];
  const days: DayOfWeek[] = [1, 2, 3, 4, 5];
  const activeStaff = staff.filter((s) => s.is_active);
  const activeClients = clients.filter((c) => c.is_active);

  for (const day of days) {
    for (const shift of ['AM', 'PM'] as AssignmentShift[]) {
      const clientsForShift = activeClients.filter((c) => clientCanAttendShift(c, day, shift));

      if (!clientsForShift.length) continue;

      // Count staff who can work this slot (ignoring double-booking for pre-check)
      const eligibleStaff = new Set<string>();
      for (const client of clientsForShift) {
        for (const s of activeStaff) {
          if (!staffCanWorkShift(s, day, shift)) continue;
          if (client.no_male_therapists && s.gender === 'male') continue;
          if (isRestricted(s.id, client.id, allRestrictions)) continue;
          if (!staffHasRequiredSkills(s, client)) continue;
          eligibleStaff.add(s.id);
        }
      }

      const deficit = clientsForShift.length - eligibleStaff.size;
      if (deficit > 0) {
        alerts.push({
          day,
          shift,
          clientCount: clientsForShift.length,
          eligibleStaffCount: eligibleStaff.size,
          deficit,
        });
      }
    }
  }

  return alerts;
}

export function getCancellationRecommendation(
  cancelType: 'client' | 'staff',
  cancelledId: string,
  day: DayOfWeek,
  shift: 'AM' | 'PM' | 'FULL',
  assignments: ScheduleAssignment[],
  staff: Staff[]
): string {
  if (cancelType === 'client') {
    const freedStaffIds = assignments
      .filter(
        (a) =>
          a.client_id === cancelledId &&
          a.day_of_week === day &&
          a.staff_id !== null &&
          (shift === 'FULL' || a.shift === shift)
      )
      .map((a) => a.staff_id!);

    if (!freedStaffIds.length) return 'No staff impact detected.';

    const hoursMap = new Map<string, number>();
    assignments.forEach((a) => {
      if (!a.staff_id || !freedStaffIds.includes(a.staff_id)) return;
      const h = a.time_start && a.time_end
        ? slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5))
        : SHIFT_TIMES[a.shift].hours;
      hoursMap.set(a.staff_id, (hoursMap.get(a.staff_id) ?? 0) + h);
    });

    const ranked = freedStaffIds
      .map((sid) => ({
        sid,
        name: staff.find((s) => s.id === sid)?.name ?? 'Unknown',
        hours: hoursMap.get(sid) ?? 0,
        goal: staff.find((s) => s.id === sid)?.weekly_hour_goal ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    const top = ranked[0];
    return (
      `Recommend sending ${top.name} home — most hours this week (${top.hours.toFixed(1)}h of ${top.goal}h goal).` +
      (ranked.length > 1
        ? ` Others freed: ${ranked.slice(1).map((r) => `${r.name} (${r.hours.toFixed(1)}h)`).join(', ')}.`
        : '')
    );
  }

  const affected = assignments.filter(
    (a) =>
      a.staff_id === cancelledId &&
      a.day_of_week === day &&
      (shift === 'FULL' || a.shift === shift)
  );

  if (!affected.length) return 'No affected assignments found.';

  const clientNames = affected
    .map((a) => {
      const c = a.client as Client | undefined;
      const timeLabel = a.time_start && a.time_end
        ? ` ${a.time_start.slice(0, 5)}–${a.time_end.slice(0, 5)}`
        : ` (${a.shift})`;
      return c ? `${c.first_name} ${c.last_name}${timeLabel}` : a.client_id;
    })
    .join(', ');

  return `${affected.length} session(s) need coverage: ${clientNames}. Review eligible staff for those slots.`;
}
