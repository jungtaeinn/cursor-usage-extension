import { MAX_DATE_RANGE_DAYS } from "../constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export function now(): number {
  return Date.now();
}

export function getDateRangeWithinLimit(
  endDate: number,
  maxDays = MAX_DATE_RANGE_DAYS
): { startDate: number; endDate: number } {
  const clampedEnd = endDate;
  const startDate = clampedEnd - (maxDays - 1) * DAY_MS;
  return { startDate, endDate: clampedEnd };
}

export function shouldRefreshByInterval(
  lastFetchedAt: number | null,
  intervalMinutes: number,
  currentTs = now()
): boolean {
  if (!lastFetchedAt) {
    return true;
  }
  const intervalMs = intervalMinutes * 60 * 1000;
  return currentTs - lastFetchedAt >= intervalMs;
}

export function toIsoDate(ts: number): string {
  return new Date(ts).toISOString();
}
