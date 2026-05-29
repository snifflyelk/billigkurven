const DAY_TO_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function parseScheduleDay(raw: string | undefined) {
  if (!raw) return 1;
  const normalized = raw.trim().toUpperCase();

  if (normalized in DAY_TO_INDEX) {
    return DAY_TO_INDEX[normalized];
  }

  const asNumber = Number(normalized);
  if (!Number.isNaN(asNumber) && asNumber >= 0 && asNumber <= 6) {
    return asNumber;
  }

  return 1;
}

function parseScheduleHour(raw: string | undefined) {
  const hour = Number(raw ?? "8");
  if (Number.isNaN(hour)) return 8;
  return Math.max(0, Math.min(23, Math.floor(hour)));
}

export function getWeeklyReportScheduleConfig() {
  const day = parseScheduleDay(process.env.WEEKLY_REPORT_DAY);
  const hour = parseScheduleHour(process.env.WEEKLY_REPORT_HOUR);
  return { day, hour };
}

export function shouldRunWeeklyReportNow(now: Date = new Date()) {
  const { day, hour } = getWeeklyReportScheduleConfig();
  return now.getDay() === day && now.getHours() === hour;
}
