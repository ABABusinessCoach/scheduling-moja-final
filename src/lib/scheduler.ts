import {
  Staff,
  Client,
  ScheduleAssignment,
  StaffClientRestriction,
  DayOfWeek,
  AssignmentShift,
  ShiftDefinition,
  SHIFT_TIMES,
  StaffHours,
  RatioAlert,
  CoverageRecommendation,
  StaffCancellationAnalysis,
  TimeOff,
  SeasonalPeriod,
  slotDuration,
  timeWindowCovers,
  RampUpEntry,
} from './types';

function shiftTimes(shift: AssignmentShift): { start: string; end: string } {
  return { start: SHIFT_TIMES[shift].start, end: SHIFT_TIMES[shift].end };
}

// Returns true if the union of `ranges` continuously extends PAST `sessionStart`
// with no gap, meaning the person is available at the start of the session.
// Uses strict > so that e.g. SAT_AM (9-12) does NOT qualify for SAT_PM (start=12).
function unionsReachesStart(
  ranges: { start: string; end: string }[],
  sessionStart: string
): boolean {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  if (!sorted.length || sorted[0].start > sessionStart) return false;
  let covered = sorted[0].start;
  for (const r of sorted) {
    if (r.start > covered) break; // gap — union doesn't reach any further
    if (r.end > covered) covered = r.end;
    if (covered > sessionStart) return true;
  }
  return false;
}

// Collect the concrete time ranges from one availability record.
function availRanges(
  a: { shift: string; time_start: string | null; time_end: string | null }
): { start: string; end: string } | null {
  if (a.time_start && a.time_end) {
    return { start: a.time_start.slice(0, 5), end: a.time_end.slice(0, 5) };
  }
  const key = a.shift as AssignmentShift;
  if (SHIFT_TIMES[key]) return { start: SHIFT_TIMES[key].start, end: SHIFT_TIMES[key].end };
  if (a.shift === 'FULL') return { start: '08:00', end: '18:00' };
  return null;
}

// Check if the person's availability reaches the session start (no gap before wStart).
// This allows staff/clients whose availability extends through noon (e.g. PM: 10:30–14:30)
// to be scheduled for an afternoon session starting at 12:00, even if they can't cover
// the full session end time.
function staffCanWorkWindow(staff: Staff, day: DayOfWeek, wStart: string, wEnd: string): boolean {
  const dayAvail = (staff.availability ?? []).filter(a => a.day_of_week === day);
  if (dayAvail.length === 0) return false;
  const ranges = dayAvail.map(availRanges).filter(Boolean) as { start: string; end: string }[];
  return unionsReachesStart(ranges, wStart);
}

// Check if the union of a client's availability windows reaches the session start.
// Explicit time-based availability bypasses program_type restrictions (e.g. summer seasonal overrides).
function clientCanAttendWindow(client: Client, day: DayOfWeek, wStart: string, wEnd: string): boolean {
  const avail = client.availability ?? [];
  const dayAvail = avail.filter(a => a.day_of_week === day);

  if (dayAvail.length > 0) {
    const ranges = dayAvail.map(availRanges).filter(Boolean) as { start: string; end: string }[];
    if (ranges.length > 0) {
      // Explicit availability is authoritative — skip program_type filter
      return unionsReachesStart(ranges, wStart);
    }
  }

  // No explicit availability records — fall back to program_type + attendance
  const isEveningWindow = wStart >= '15:00';
  if (client.program_type === 'daytime' && isEveningWindow) return false;
  if (client.program_type === 'afterschool' && !isEveningWindow) return false;

  if (avail.length === 0) {
    if (day === 6) return false;
    return (client.attendance ?? []).some((a) => a.day_of_week === day);
  }

  // Shift-only availability with no day match — unreachable but safe fallback
  return false;
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
  const isMorning  = shift === 'AM' || shift === 'AM_SESSION' || shift === 'SUM_HALF' || shift === 'SAT_AM';
  const isAfternoon = shift === 'PM' || shift === 'LATE_AM' || shift === 'SUMMER_HALF_DAY_PM' || shift === 'SAT_PM';
  const isEve = shift === 'EVE';
  for (const rule of rules) {
    if (rule === 'No AM sessions' && isMorning) return false;
    if (rule === 'No PM sessions' && isAfternoon) return false;
    if (rule === 'No After School sessions' && isEve) return false;
    if ((rule === 'No Saturday sessions' || rule === 'Weekdays only') && day === 6) return false;
    if (rule === 'Morning sessions only' && !isMorning) return false;
    if (rule === 'Afternoon sessions only' && !isAfternoon) return false;
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

// Default session blocks when no DB shifts are configured.
// Regular: morning 8-12, afternoon 12-14:30, afterschool 15-18, Saturday blocks.
// Seasonal: morning 8-12, afternoon 12-15:30 (extended), Saturday blocks (no EVE).
function buildFallbackShifts(isSeasonal: boolean): ShiftDefinition[] {
  const stub = (name: string, label: string, start: string, end: string, days: number[]): ShiftDefinition =>
    ({ id: '', name, label, time_start: start, time_end: end, days, color: '', sort_order: 0, is_active: true, created_at: '', date_start: null, date_end: null });
  const weekdays = [1, 2, 3, 4, 5];
  const shifts: ShiftDefinition[] = [
    stub('AM_SESSION',         'Morning',      '08:00', '12:00', weekdays),
    stub(
      isSeasonal ? 'SUMMER_HALF_DAY_PM' : 'LATE_AM',
      'Afternoon',
      '12:00',
      isSeasonal ? '15:30' : '14:30',
      weekdays
    ),
  ];
  if (!isSeasonal) {
    shifts.push(stub('EVE', 'After School', '15:00', '18:00', weekdays));
  }
  shifts.push(
    stub('SAT_AM', 'Sat Morning',   '09:00', '12:00', [6]),
    stub('SAT_PM', 'Sat Afternoon',  '12:00', '15:00', [6]),
  );
  return shifts;
}

export function generateWeeklySchedule(
  scheduleId: string,
  staff: Staff[],
  clients: Client[],
  allRestrictions: StaffClientRestriction[],
  weekNumber = 1,
  weekStartDate?: string,
  timeOff: TimeOff[] = [],
  weekShifts: ShiftDefinition[] = [],
  activeSeason: SeasonalPeriod | null = null
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
  function getStaffDaySessions(staffId: string, day: DayOfWeek): number {
    return (assignments as ScheduleAssignment[]).filter(
      (a) => a.staff_id === staffId && a.day_of_week === day
    ).length;
  }

  // Use provided DB shifts; fall back to session-block defaults based on season
  const shiftsToUse: ShiftDefinition[] = weekShifts.length > 0 ? weekShifts : buildFallbackShifts(!!activeSeason);

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

      // Sort clients by how constrained they are (fewest eligible staff first).
      // This ensures clients with limited options get assigned before clients
      // with many options, reducing unassigned gaps.
      const clientEligibilityCounts = new Map<string, number>();
      for (const client of clientsForShift) {
        const count = activeStaff.filter((s) => {
          if (!staffCanWorkWindow(s, day, sessionWindow.start, sessionWindow.end)) return false;
          if (client.no_male_therapists && s.gender === 'male') return false;
          if (clientRequiresMale(client) && s.gender !== 'male') return false;
          if (isRestricted(s.id, client.id, allRestrictions)) return false;
          if (!staffHasRequiredSkills(s, client)) return false;
          if (dateStr && isOnTimeOff(s.id, null, dateStr, sessionWindow.start, sessionWindow.end)) return false;
          return true;
        }).length;
        clientEligibilityCounts.set(client.id, count);
      }
      clientsForShift.sort((a, b) => (clientEligibilityCounts.get(a.id) ?? 0) - (clientEligibilityCounts.get(b.id) ?? 0));

      for (const client of clientsForShift) {
        if (!activeSeason) {
          const rampTarget = getRampUpTarget(client.ramp_up_schedule, weekNumber);
          const authCap = client.authorized_hours_per_week != null ? Number(client.authorized_hours_per_week) : null;
          const effectiveCap = rampTarget !== null ? Math.min(rampTarget, authCap ?? Infinity) : authCap;
          if (effectiveCap != null && !isNaN(effectiveCap)) {
            const alreadyScheduled = getClientHoursInBatch(client.id, assignments);
            if (alreadyScheduled >= effectiveCap) continue;
            const sessionHours = slotDuration(sessionWindow.start, sessionWindow.end);
            if (alreadyScheduled + sessionHours > effectiveCap) continue;
          }
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
          // Last-resort staff (tier 4) always go last
          const aLastResort = a.priority_tier >= 4 ? 1 : 0;
          const bLastResort = b.priority_tier >= 4 ? 1 : 0;
          if (aLastResort !== bLastResort) return aLastResort - bLastResort;

          // Strongly prefer staff with zero sessions on this day (fill empty days)
          const aDaySessions = getStaffDaySessions(a.id, day);
          const bDaySessions = getStaffDaySessions(b.id, day);
          if (aDaySessions === 0 && bDaySessions > 0) return -1;
          if (bDaySessions === 0 && aDaySessions > 0) return 1;

          // Compute how full each staff member is relative to their goal (0 = empty, 1 = at goal)
          const aHours = getStaffHoursInBatch(a.id, assignments);
          const bHours = getStaffHoursInBatch(b.id, assignments);
          const aGoal = Number(a.weekly_hour_goal) || 1;
          const bGoal = Number(b.weekly_hour_goal) || 1;
          const aLoad = aHours / aGoal;
          const bLoad = bHours / bGoal;

          // Primary: prefer staff who are most under their hour goal (lowest load ratio)
          const loadDiff = aLoad - bLoad;
          if (Math.abs(loadDiff) > 0.05) return loadDiff < 0 ? -1 : 1;

          // Secondary: tier (prefer lower tier when load is similar)
          if (a.priority_tier !== b.priority_tier) return a.priority_tier - b.priority_tier;

          // Tertiary: spread pairings to avoid same staff-client combo every day
          const pairA = getPairingCount(a.id, client.id, assignments);
          const pairB = getPairingCount(b.id, client.id, assignments);
          if (pairA !== pairB) return pairA - pairB;

          // Final tiebreaker: fewer absolute hours
          return aHours - bHours;
        });

        const chosen = sorted[0];
        book(chosen.id, day, shiftName);

        const sessionHours = slotDuration(sessionWindow.start, sessionWindow.end);
        const projectedHours = getStaffHoursInBatch(chosen.id, assignments) + sessionHours;

        const violations: string[] = [];
        const chosenGoal = Number(chosen.weekly_hour_goal) || 0;
        if (chosenGoal > 0 && projectedHours > chosenGoal) {
          violations.push(`${chosen.name} will exceed weekly goal of ${chosenGoal}h (projected ${projectedHours.toFixed(1)}h)`);
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

  const shiftsToCheck: ShiftDefinition[] = weekShifts.length > 0 ? weekShifts : buildFallbackShifts(false);

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
