export type EmploymentType = 'full-time' | 'part-time' | 'contractor';
export type Gender = 'male' | 'female' | 'other';
export type PriorityTier = 1 | 2 | 3;
export type ShiftType = 'AM' | 'PM' | 'FULL' | 'CUSTOM';
export type AvailabilityShift = 'AM' | 'PM' | 'FULL';
export type ScheduleStatus = 'draft' | 'published';
export type CancellationType = 'client' | 'staff';
export type DayOfWeek = 1 | 2 | 3 | 4 | 5; // 1=Mon, 5=Fri
export type AssignmentShift = 'AM' | 'PM';

export const DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
};

/** All recognised BT skills used for matching */
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

/** Standard 30-minute time slots for the clinic day (HH:MM format) */
export const TIME_SLOTS: string[] = [
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00',
];

/** Slots that are blocked for breaks — shown highlighted, no scheduling */
export const BLOCKED_SLOTS: Record<string, string> = {
  '10:00': 'Break',
  '12:00': 'Lunch',
};

/** Preset availability windows keyed by label */
export const AVAILABILITY_PRESETS: Record<AvailabilityShift, { start: string; end: string }> = {
  AM:   { start: '08:00', end: '10:30' },
  PM:   { start: '10:30', end: '14:30' },
  FULL: { start: '08:00', end: '14:30' },
};

/** Duration in hours between two HH:MM strings */
export function slotDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

/** Returns true if window A fully contains window B */
export function timeWindowCovers(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string
): boolean {
  return aStart <= bStart && aEnd >= bEnd;
}

/** Human-readable label for a time string like "08:00" → "8:00 AM" */
export function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h < 12 ? 'AM' : 'PM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

export const SHIFT_TIMES: Record<AssignmentShift, { start: string; end: string; hours: number }> = {
  AM: { start: '08:00', end: '10:30', hours: 2.5 },
  PM: { start: '10:30', end: '14:30', hours: 4.0 },
};

export interface RampUpEntry {
  week_number: number;
  target_hours: number;
}

export interface Staff {
  id: string;
  name: string;
  employment_type: EmploymentType;
  weekly_hour_goal: number;
  priority_tier: PriorityTier;
  gender: Gender;
  is_active: boolean;
  notes: string;
  created_at: string;
  skills: string[];
  supervision_hours_required: number;
  supervision_hours_this_week: number;
  availability?: StaffAvailability[];
  restrictions?: StaffClientRestriction[];
}

export interface StaffAvailability {
  id: string;
  staff_id: string;
  day_of_week: DayOfWeek;
  shift: AvailabilityShift;
  time_start: string | null; // e.g. '08:00'
  time_end: string | null;   // e.g. '14:30'
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
  authorized_hours_per_week: number | null;
  ramp_up_schedule: RampUpEntry[] | null;
  required_skills: string[];
  attendance?: ClientAttendance[];
  availability?: ClientAvailability[];
  restrictions?: StaffClientRestriction[];
}

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
  time_start: string | null; // e.g. '08:00'
  time_end: string | null;   // e.g. '14:30'
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
  time_start: string | null; // e.g. '08:00'
  time_end: string | null;   // e.g. '10:30'
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

/** Represents a staffing gap alert: a day+shift where clients > eligible staff */
export interface RatioAlert {
  day: DayOfWeek;
  shift: AssignmentShift;
  clientCount: number;
  eligibleStaffCount: number;
  deficit: number;
}
