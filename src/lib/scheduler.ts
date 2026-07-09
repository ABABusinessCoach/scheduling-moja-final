import {
  Staff,
  Client,
  ScheduleAssignment,
  StaffClientRestriction,
  DayOfWeek,
  AssignmentShift,
  ShiftDefinition,
  SHIFT_TIMES,
  SHIFT_DAYS,
  StaffHours,
  RatioAlert,
  CoverageRecommendation,
  StaffCancellationAnalysis,
  TimeOff,
  slotDuration,
  timeWindowCovers,
  RampUpEntry,
} from './types';

function shiftTimes(shift: AssignmentShift): { start: string; end: string } {
  return { start: SHIFT_TIMES[shift].start, end: SHIFT_TIMES[shift].end };
}

// Check if staff availability covers an explicit time window on a given day
function staffCanWorkWindow(staff: Staff, day: DayOfWeek, wStart: string, wEnd: string): boolean {
  const avail = staff.availability ?? [];
  return avail.some((a) => {
    if (a.day_of_week !== day) return false;
    if (a.time_start && a.time_end) {
      return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), wStart, wEnd);
    }
    // Fallback: named shift coverage
    const key = a.shift as AssignmentShift;
    if (SHIFT_TIMES[key]) {
      return timeWindowCovers(SHIFT_TIMES[key].start, SHIFT_TIMES[key].end, wStart, wEnd);
    }
    return a.shift === 'FULL';
  });
}

// Check if client availability covers an explicit time window on a given day
function clientCanAttendWindow(client: Client, day: DayOfWeek, wStart: string, wEnd: string): boolean {
  const isEveningWindow = wStart >= '15:00';

  // Respect program_type: daytime clients skip EVE; afterschool clients skip daytime
  if (client.program_type === 'daytime' && isEveningWindow) return false;
  if (client.program_type === 'afterschool' && !isEveningWindow) return false;

  const avail = client.availability ?? [];
  if (avail.length === 0) {
    if (day === 6) return false;
    return (client.attendance ?? []).some((a) => a.day_of_week === day);
  }
  return avail.some((a) => {
    if (a.day_of_week !== day) return false;
    if (a.time_start && a.time_end) {
      return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), wStart, wEnd);
    }
    const key = a.shift as AssignmentShift;
    if (SHIFT_TIMES[key]) {
      return timeWindowCovers(SHIFT_TIMES[key].start, SHIFT_TIMES[key].end, wStart, wEnd);
    }
    return false;
  });
}

// Named-shift wrappers used by getStaffCoverageRankings
function staffCanWorkShift(staff: Staff, day: DayOfWeek, shift: AssignmentShift): boolean {
  const { start, end } = shiftTimes(shift);
  return staffCanWorkWindow(staff, day, start, end);
}

function clientCanAttendShift(client: Client, day: DayOfWeek, shift: AssignmentShift): boolean {
  const { start, end } = shiftTimes(shift);
  return clientCanAttendWindow(client, day, start, end);
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

function clientPassesSchedulingRules(client: Client, day: DayOfWeek, shift: AssignmentShift): boolean {
  const rules = client.scheduling_rules ?? [];
  for (const rule of rules) {
    if (rule === 'No AM sessions' && shift === 'AM') return false;
    if (rule === 'No PM sessions' && shift === 'PM') return false;
    if (rule === 'No After School sessions' && shift === 'EVE') return false;
    if ((rule === 'No Saturday sessions' || rule === 'Weekdays only') && day === 6) return false;
    if (rule === 'Morning sessions only' && shift !== 'AM') return false;
    if (rule === 'Afternoon sessions only' && shift !== 'PM') return false;
    if (rule === 'Requires male therapist') {
      // handled at assignment level, not here
    }
  }
  return true;
}

function clientRequiresMale(client: Client): boolean {
  return (client.scheduling_rules ?? []).includes('Requires male therapist');
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
  weekNumber = 1,
  weekStartDate?: string,
  timeOff: TimeOff[] = [],
  weekShifts: ShiftDefinition[] = []
): Omit<ScheduleAssignment, 'id' | 'created_at'>[] {
  const assignments: Omit<ScheduleAssignment, 'id' | 'created_at'>[] = [];
  const activeStaff = staff.filter((s) => {
    if (!s.is_active) return false;
    // Don't schedule staff before their start date
    if (s.start_date && weekStartDate && weekStartDate < s.start_date) return false;
    return true;
  });
  const activeClients = clients.filter((c) => {
    if (!c.is_active) return false;
    // Don't schedule clients before their start date
    if (c.start_date && weekStartDate && weekStartDate < c.start_date) return false;
    return true;
  });

  // Returns true if the person is on time off for the given date (and optionally shift window).
  // For partial time off (time_start/time_end set), only blocks if windows overlap.
  function isOnTimeOff(
    staffId: string | null,
    clientId: string | null,
    dateStr: string,
    shiftStart?: string,
    shiftEnd?: string
  ): boolean {
    return timeOff.some((t) => {
      if (staffId && t.staff_id !== staffId) return false;
      if (clientId && t.client_id !== clientId) return false;
      if (!staffId && !clientId) return false;
      if (!(t.date_start <= dateStr && t.date_end >= dateStr)) return false;
      // If time off has a time window, only block if the shift overlaps that window
      if (t.time_start && t.time_end && shiftStart && shiftEnd) {
        return shiftStart < t.time_end && shiftEnd > t.time_start;
      }
      return true;
    });
  }

  // Map day-of-week (1=Mon) to ISO date string for the given week
  function dayToDate(day: DayOfWeek): string {
    if (!weekStartDate) return '';
    const d = new Date(weekStartDate + 'T12:00:00');
    d.setDate(d.getDate() + (day - 1));
    return d.toISOString().slice(0, 10);
  }

  const bookedSlots = new Map<string, Set<string>>();

  function slotKey(day: DayOfWeek, shiftName: string) {
    return `${day}-${shiftName}`;
  }
  function isBooked(staffId: string, day: DayOfWeek, shiftName: string) {
    return bookedSlots.get(slotKey(day, shiftName))?.has(staffId) ?? false;
  }
  function book(staffId: string, day: DayOfWeek, shiftName: string) {
    const key = slotKey(day, shiftName);
    if (!bookedSlots.has(key)) bookedSlots.set(key, new Set());
    bookedSlots.get(key)!.add(staffId);
  }

  // Use provided DB shifts; fall back to standard shifts if none passed
  const shiftsToUse: ShiftDefinition[] = weekShifts.length > 0 ? weekShifts : [
    { id: '', name: 'AM',     label: 'AM',     time_start: '08:00', time_end: '10:30', days: [1,2,3,4,5], color: '', sort_order: 0, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'PM',     label: 'PM',     time_start: '10:30', time_end: '14:30', days: [1,2,3,4,5], color: '', sort_order: 1, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'EVE',    label: 'Afternoon', time_start: '15:00', time_end: '18:00', days: [1,2,3,4,5], color: '', sort_order: 2, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'SAT_AM', label: 'Sat AM', time_start: '09:00', time_end: '12:00', days: [6],     color: '', sort_order: 3, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'SAT_PM', label: 'Sat PM', time_start: '12:00', time_end: '15:00', days: [6],     color: '', sort_order: 4, is_active: true, created_at: '', date_start: null, date_end: null },
  ];

  for (const shiftDef of shiftsToUse) {
    const shiftName = shiftDef.name as AssignmentShift;
    const applicableDays = shiftDef.days as DayOfWeek[];
    const sessionWindow = { start: shiftDef.time_start.slice(0, 5), end: shiftDef.time_end.slice(0, 5) };

    for (const day of applicableDays) {
      const dateStr = dayToDate(day);

      const clientsForShift = activeClients.filter((c) => {
        if (!clientCanAttendWindow(c, day, sessionWindow.start, sessionWindow.end)) return false;
        if (!clientPassesSchedulingRules(c, day, shiftName)) return false;
        if (dateStr && isOnTimeOff(null, c.id, dateStr, sessionWindow.start, sessionWindow.end)) return false;
        return true;
      });

      for (const client of clientsForShift) {
        const rampTarget = getRampUpTarget(client.ramp_up_schedule, weekNumber);
        const authCap = client.authorized_hours_per_week;
        const effectiveCap = rampTarget !== null ? Math.min(rampTarget, authCap ?? Infinity) : authCap;
        if (effectiveCap !== null && effectiveCap !== undefined) {
          const alreadyScheduled = getClientHoursInBatch(client.id, assignments);
          const sessionHours = slotDuration(sessionWindow.start, sessionWindow.end);
          if (alreadyScheduled + sessionHours > effectiveCap) continue;
        }

        const requiresMale = clientRequiresMale(client);

        const eligible = activeStaff.filter((s) => {
          if (!staffCanWorkWindow(s, day, sessionWindow.start, sessionWindow.end)) return false;
          if (isBooked(s.id, day, shiftName)) return false;
          if (client.no_male_therapists && s.gender === 'male') return false;
          if (requiresMale && s.gender !== 'male') return false;
          if (isRestricted(s.id, client.id, allRestrictions)) return false;
          if (!staffHasRequiredSkills(s, client)) return false;
          if (dateStr && isOnTimeOff(s.id, null, dateStr, sessionWindow.start, sessionWindow.end)) return false;
          return true;
        });

        if (eligible.length === 0) {
          const eligibleIgnoringSkills = activeStaff.filter((s) => {
            if (!staffCanWorkWindow(s, day, sessionWindow.start, sessionWindow.end)) return false;
            if (isBooked(s.id, day, shiftName)) return false;
            if (client.no_male_therapists && s.gender === 'male') return false;
            if (requiresMale && s.gender !== 'male') return false;
            if (isRestricted(s.id, client.id, allRestrictions)) return false;
            if (dateStr && isOnTimeOff(s.id, null, dateStr, sessionWindow.start, sessionWindow.end)) return false;
            return true;
          });
          const skillsMissing = eligibleIgnoringSkills.length > 0 && client.required_skills?.length > 0;
          const reason = skillsMissing
            ? `No eligible staff with required skills (${(client.required_skills ?? []).join(', ')}) available for this slot`
            : 'No eligible staff available for this slot';

          assignments.push({
            schedule_id: scheduleId,
            day_of_week: day,
            shift: shiftName,
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
        book(chosen.id, day, shiftName);

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
          shift: shiftName,
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
  allRestrictions: StaffClientRestriction[],
  weekShifts: ShiftDefinition[] = []
): RatioAlert[] {
  const alerts: RatioAlert[] = [];
  const activeStaff = staff.filter((s) => s.is_active);
  const activeClients = clients.filter((c) => c.is_active);

  const shiftsToCheck: ShiftDefinition[] = weekShifts.length > 0 ? weekShifts : [
    { id: '', name: 'AM',     label: 'AM',     time_start: '08:00', time_end: '10:30', days: [1,2,3,4,5], color: '', sort_order: 0, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'PM',     label: 'PM',     time_start: '10:30', time_end: '14:30', days: [1,2,3,4,5], color: '', sort_order: 1, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'EVE',    label: 'Afternoon', time_start: '15:00', time_end: '18:00', days: [1,2,3,4,5], color: '', sort_order: 2, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'SAT_AM', label: 'Sat AM', time_start: '09:00', time_end: '12:00', days: [6],     color: '', sort_order: 3, is_active: true, created_at: '', date_start: null, date_end: null },
    { id: '', name: 'SAT_PM', label: 'Sat PM', time_start: '12:00', time_end: '15:00', days: [6],     color: '', sort_order: 4, is_active: true, created_at: '', date_start: null, date_end: null },
  ];

  for (const shiftDef of shiftsToCheck) {
    const shiftName = shiftDef.name as AssignmentShift;
    const wStart = shiftDef.time_start.slice(0, 5);
    const wEnd = shiftDef.time_end.slice(0, 5);

    for (const day of shiftDef.days as DayOfWeek[]) {
      const clientsForShift = activeClients.filter((c) => clientCanAttendWindow(c, day, wStart, wEnd));
      if (!clientsForShift.length) continue;

      const eligibleStaff = new Set<string>();
      for (const client of clientsForShift) {
        for (const s of activeStaff) {
          if (!staffCanWorkWindow(s, day, wStart, wEnd)) continue;
          if (client.no_male_therapists && s.gender === 'male') continue;
          if (isRestricted(s.id, client.id, allRestrictions)) continue;
          if (!staffHasRequiredSkills(s, client)) continue;
          eligibleStaff.add(s.id);
        }
      }

      const deficit = clientsForShift.length - eligibleStaff.size;
      if (deficit > 0) {
        alerts.push({ day, shift: shiftName, clientCount: clientsForShift.length, eligibleStaffCount: eligibleStaff.size, deficit });
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

/**
 * Compute ranked coverage recommendations when a staff member cancels.
 * Returns top-3 eligible staff who can cover the affected day/shift.
 */
export function getStaffCoverageRankings(
  cancelledStaffId: string,
  day: DayOfWeek,
  shifts: AssignmentShift[],
  affectedClientIds: string[],
  allStaff: Staff[],
  clients: Client[],
  allRestrictions: StaffClientRestriction[],
  currentAssignments: ScheduleAssignment[]
): StaffCancellationAnalysis {
  const activeStaff = allStaff.filter((s) => s.is_active && s.id !== cancelledStaffId);

  // Hours already assigned this week for each staff member
  function staffHours(staffId: string): number {
    return currentAssignments.reduce((sum, a) => {
      if (a.staff_id !== staffId) return sum;
      if (a.time_start && a.time_end) return sum + slotDuration(a.time_start.slice(0, 5), a.time_end.slice(0, 5));
      return sum + SHIFT_TIMES[a.shift].hours;
    }, 0);
  }

  // A staff member is eligible if they can work ALL affected shifts for ALL affected clients
  const scored = activeStaff
    .map((s) => {
      const warnings: string[] = [];

      // Check availability for at least one of the affected shifts
      const canWorkAny = shifts.some((sh) => staffCanWorkShift(s, day, sh));
      if (!canWorkAny) return null;

      // Check for restrictions against any affected client
      for (const cid of affectedClientIds) {
        const client = clients.find((c) => c.id === cid);
        if (!client) continue;
        if (isRestricted(s.id, cid, allRestrictions)) {
          warnings.push(`Has restriction with ${client.first_name} ${client.last_name}`);
        }
        if (client.no_male_therapists && s.gender === 'male') {
          warnings.push(`Client requires female therapist`);
        }
        if (!staffHasRequiredSkills(s, client)) {
          const missing = (client.required_skills ?? []).filter((sk) => !(s.skills ?? []).includes(sk));
          warnings.push(`Missing skills: ${missing.join(', ')}`);
        }
      }

      const hours = staffHours(s.id);
      return { s, hours, warnings };
    })
    .filter(Boolean) as { s: Staff; hours: number; warnings: string[] }[];

  // Sort: fewer warnings first, then by priority tier, then by hours under goal
  scored.sort((a, b) => {
    const wDiff = a.warnings.length - b.warnings.length;
    if (wDiff !== 0) return wDiff;
    if (a.s.priority_tier !== b.s.priority_tier) return a.s.priority_tier - b.s.priority_tier;
    const aUnder = a.s.weekly_hour_goal - a.hours;
    const bUnder = b.s.weekly_hour_goal - b.hours;
    return bUnder - aUnder; // prefer most under-hours
  });

  const top3 = scored.slice(0, 3);
  const affectedClients = affectedClientIds
    .map((cid) => {
      const c = clients.find((x) => x.id === cid);
      return c ? `${c.first_name} ${c.last_name}` : cid;
    });

  const cancelledName = allStaff.find((s) => s.id === cancelledStaffId)?.name ?? 'Unknown';

  return {
    type: 'staff_coverage',
    cancelledStaff: cancelledName,
    affectedClients,
    recommendations: top3.map((item, i) => ({
      rank: (i + 1) as 1 | 2 | 3,
      staffId: item.s.id,
      staffName: item.s.name,
      tier: item.s.priority_tier,
      currentHours: item.hours,
      weeklyGoal: item.s.weekly_hour_goal,
      warnings: item.warnings,
    })),
  };
}

/**
 * Check if a client assignment is still valid given a new set of availability windows.
 * Returns true if the client can still attend that slot.
 */
export function clientCanStillAttend(
  dayOfWeek: DayOfWeek,
  shift: AssignmentShift,
  availWindows: Array<{ day_of_week: number; time_start: string | null; time_end: string | null }>
): boolean {
  const shiftWindow = SHIFT_TIMES[shift];
  return availWindows.some((a) => {
    if (a.day_of_week !== dayOfWeek) return false;
    if (!a.time_start || !a.time_end) return false;
    return timeWindowCovers(a.time_start.slice(0, 5), a.time_end.slice(0, 5), shiftWindow.start, shiftWindow.end);
  });
}
