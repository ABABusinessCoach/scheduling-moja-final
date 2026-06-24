export type EmploymentType = 'full-time' | 'part-time' | 'contractor';
export type Gender = 'male' | 'female' | 'other';
export type PriorityTier = 1 | 2 | 3;
export type ProgramType = 'daytime' | 'afterschool' | 'both';
export type ShiftType = 'AM' | 'PM' | 'FULL' | 'CUSTOM';
export type AvailabilityShift = 'AM' | 'PM' | 'FULL' | 'EVE' | 'SAT_AM' | 'SAT_PM';
export type ScheduleStatus = 'draft' | 'published';
export type CancellationType = 'client' | 'staff';
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6; // 1=Mon, 5=Fri, 6=Sat
export type AssignmentShift = 'AM' | 'PM' | 'EVE' | 'SAT_AM' | 'SAT_PM' | 'SUM_HALF' | 'SUM_FULL';

export const DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const ALL_SKILLS = [
  'Verbal Behavior',
  'DTT',
  'PECS',
  'Natural Environment Teaching',
  'Social Skills',
  'Toilet Training',
  'Feeding',
  'PROMPT',
  'Fluency Training',
  'Crisis Management',
] as const;

export type Skill = (typeof ALL_SKILLS)[number];

export const TIME_SLOTS: string[] = [
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
  '18:00',
];

export const ALL_END_TIMES: string[] = [
  '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];

export const AVAILABILITY_PRESETS: Record<AvailabilityShift, { start: string; end: string; label: string }> = {
  AM:     { start: '08:00', end: '10:30', label: 'AM (8:00–10:30)' },
  PM:     { start: '10:30', end: '14:30', label: 'Late AM (10:30–2:30)' },
  FULL:   { start: '08:00', end: '18:00', label: 'Full Day (8:00–6:00)' },
  EVE:    { start: '15:00', end: '18:00', label: 'After School (3:00–6:00)' },
  SAT_AM: { start: '09:00', end: '12:00', label: 'Sat AM (9:00–12:00)' },
  SAT_PM: { start: '12:00', end: '15:00', label: 'Sat PM (12:00–3:00)' },
};

/** Human-readable labels for AssignmentShift values — use time ranges instead of names */
export const SHIFT_LABELS: Record<AssignmentShift, string> = {
  AM:       '8:00–10:30',
  PM:       '10:30–2:30',
  EVE:      '3:00–6:00 PM',
  SAT_AM:   'Sat 9:00–12:00',
  SAT_PM:   'Sat 12:00–3:00',
  SUM_HALF: 'Summer 8:00–12:00',
  SUM_FULL: 'Summer 8:00–4:00',
};

/** Priority tier labels for scheduling */
export const PRIORITY_LABELS: Record<1 | 2 | 3, { title: string; description: string }> = {
  1: { title: 'Primary',   description: 'Full-time — scheduled first, hours filled before others' },
  2: { title: 'Secondary', description: 'Part-time — scheduled after Primary staff' },
  3: { title: 'Floater',   description: 'On-call / substitute — fills remaining gaps' },
};

/** Scheduling rule types that can be applied per staff member */
export const RULE_PRESETS = [
  '1:1 ratio only',
  'No more than 2 clients per shift',
  'No more than 3 clients per shift',
  'Requires direct supervision',
  'No PM sessions',
  'No AM sessions',
  'No After School sessions',
  'Weekdays only',
  'Cannot float between clients mid-shift',
] as const;

export const CLIENT_RULE_PRESETS = [
  'No AM sessions',
  'No PM sessions',
  'No After School sessions',
  'No Saturday sessions',
  'Weekdays only',
  'Morning sessions only',
  'Afternoon sessions only',
  'Requires consistent staff each day',
  '1:1 ratio only',
  'Requires male therapist',
  'No floating staff',
] as const;

export const SHIFT_TIMES: Record<AssignmentShift, { start: string; end: string; hours: number }> = {
  AM:       { start: '08:00', end: '10:30', hours: 2.5 },
  PM:       { start: '10:30', end: '14:30', hours: 4.0 },
  EVE:      { start: '15:00', end: '18:00', hours: 3.0 },
  SAT_AM:   { start: '09:00', end: '12:00', hours: 3.0 },
  SAT_PM:   { start: '12:00', end: '15:00', hours: 3.0 },
  SUM_HALF: { start: '08:00', end: '12:00', hours: 4.0 },
  SUM_FULL: { start: '08:00', end: '16:00', hours: 8.0 },
};

export const SHIFT_DAYS: Record<AssignmentShift, DayOfWeek[]> = {
  AM:       [1, 2, 3, 4, 5],
  PM:       [1, 2, 3, 4, 5],
  EVE:      [1, 2, 3, 4, 5],
  SAT_AM:   [6],
  SAT_PM:   [6],
  SUM_HALF: [1, 2, 3, 4, 5],
  SUM_FULL: [1, 2, 3, 4, 5],
};

export function slotDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export function timeWindowCovers(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string
): boolean {
  return aStart <= bStart && aEnd >= bEnd;
}

export function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h < 12 ? 'AM' : 'PM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

export interface RampUpEntry {
  week_number: number;
  target_hours: number;
}

export interface ShiftDefinition {
  id: string;
  name: string;
  label: string;
  time_start: string;
  time_end: string;
  days: number[];
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  date_start: string | null;
  date_end: string | null;
}

export interface BreakTime {
  id: string;
  name: string;
  time_start: string;
  time_end: string;
  days: number[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string | null;
  employment_type: EmploymentType;
  weekly_hour_goal: number;
  priority_tier: PriorityTier;
  gender: Gender;
  is_active: boolean;
  is_archived: boolean;
  notes: string;
  created_at: string;
  start_date: string | null;
  skills: string[];
  supervision_hours_required: number;
  supervision_hours_this_week: number;
  scheduling_rules: string[];
  availability?: StaffAvailability[];
  restrictions?: StaffClientRestriction[];
}

export interface StaffAvailability {
  id: string;
  staff_id: string;
  day_of_week: DayOfWeek;
  shift: AvailabilityShift;
  time_start: string | null;
  time_end: string | null;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  shift_type: ShiftType;
  custom_end_time: string | null;
  no_male_therapists: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
  start_date: string | null;
  authorized_hours_per_week: number | null;
  ramp_up_schedule: RampUpEntry[] | null;
  required_skills: string[];
  scheduling_rules: string[];
  program_type: ProgramType;
  color: string;
  attendance?: ClientAttendance[];
  availability?: ClientAvailability[];
  restrictions?: StaffClientRestriction[];
}

export const CLIENT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#a16207', // amber-dark
  '#16a34a', // green-dark
  '#0284c7', // sky-dark
  '#7c3aed', // purple
  '#db2777', // pink-dark
  '#0d9488', // teal-dark
] as const;

export interface ClientAttendance {
  id: string;
  client_id: string;
  day_of_week: DayOfWeek;
}

export interface ClientAvailability {
  id: string;
  client_id: string;
  day_of_week: DayOfWeek;
  shift: AvailabilityShift;
  time_start: string | null;
  time_end: string | null;
}

export interface StaffClientRestriction {
  id: string;
  staff_id: string;
  client_id: string;
  reason: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  week_start_date: string;
  status: ScheduleStatus;
  created_at: string;
  updated_at: string;
}

export interface ScheduleAssignment {
  id: string;
  schedule_id: string;
  day_of_week: DayOfWeek;
  shift: AssignmentShift;
  time_start: string | null;
  time_end: string | null;
  staff_id: string | null;
  client_id: string;
  is_manual_override: boolean;
  violation_reason: string | null;
  created_at: string;
  staff?: Staff;
  client?: Client;
}

export interface SessionNote {
  id: string;
  assignment_id: string;
  submitted: boolean;
  submitted_at: string | null;
  created_at: string;
}

export interface Cancellation {
  id: string;
  schedule_id: string;
  cancellation_type: CancellationType;
  staff_id: string | null;
  client_id: string | null;
  day_of_week: DayOfWeek;
  shift: AssignmentShift | 'FULL' | null;
  reason: string;
  recommendation: string;
  handled: boolean;
  created_at: string;
  staff?: Staff;
  client?: Client;
}

export interface StaffHours {
  staffId: string;
  staffName: string;
  weeklyGoal: number;
  assignedHours: number;
  status: 'under' | 'at' | 'over';
}

export interface CoverageRecommendation {
  rank: 1 | 2 | 3;
  staffId: string;
  staffName: string;
  tier: number;
  currentHours: number;
  weeklyGoal: number;
  warnings: string[];
}

export interface StaffCancellationAnalysis {
  type: 'staff_coverage';
  cancelledStaff: string;
  affectedClients: string[];
  recommendations: CoverageRecommendation[];
}

export interface RatioAlert {
  day: DayOfWeek;
  shift: AssignmentShift;
  clientCount: number;
  eligibleStaffCount: number;
  deficit: number;
}

export interface TimeOff {
  id: string;
  staff_id: string | null;
  client_id: string | null;
  date_start: string;
  date_end: string;
  reason: string;
  created_at: string;
}
