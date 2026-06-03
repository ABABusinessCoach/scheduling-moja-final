export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function format(date: Date, fmt: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (fmt === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
  if (fmt === 'MMM d') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
  if (fmt === 'MMM d, yyyy') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${year}`;
  }
  return `${month}/${day}/${year}`;
}

export function parseISO(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

export function startOfWeek(date: Date): Date {
  return getMonday(date);
}

export function formatWeekRange(monday: Date): string {
  const friday = addDays(monday, 4);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (monday.getMonth() === friday.getMonth()) {
    return `${months[monday.getMonth()]} ${monday.getDate()}–${friday.getDate()}, ${monday.getFullYear()}`;
  }
  return `${months[monday.getMonth()]} ${monday.getDate()} – ${months[friday.getMonth()]} ${friday.getDate()}, ${monday.getFullYear()}`;
}

export function getWeekDates(monday: Date): Date[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}
