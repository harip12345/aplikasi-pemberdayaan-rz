export const REPORTING_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

export type ReportingPeriod = {
  startMonthIndex: number;
  endMonthIndex: number;
  year: number;
};

export function validReportingPeriod(value: unknown): value is ReportingPeriod {
  if (!value || typeof value !== "object") return false;
  const period = value as Partial<ReportingPeriod>;
  return Number.isInteger(period.startMonthIndex)
    && Number.isInteger(period.endMonthIndex)
    && Number.isInteger(period.year)
    && period.startMonthIndex! >= 0
    && period.endMonthIndex! <= 11
    && period.startMonthIndex! <= period.endMonthIndex!
    && period.year! >= 2000
    && period.year! <= 2100;
}

export function reportingPeriodLabel(period: ReportingPeriod) {
  const start = REPORTING_MONTHS[period.startMonthIndex];
  const end = REPORTING_MONTHS[period.endMonthIndex];
  return period.startMonthIndex === period.endMonthIndex ? `${start} ${period.year}` : `${start}–${end} ${period.year}`;
}
