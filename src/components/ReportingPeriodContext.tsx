"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { validReportingPeriod, type ReportingPeriod } from "@/lib/reporting-period";

const STORAGE_KEY = "rz-active-reporting-period-v1";
type ReportingPeriodContextValue = { period: ReportingPeriod | null; setPeriod: (period: ReportingPeriod) => void };
const ReportingPeriodContext = createContext<ReportingPeriodContextValue | null>(null);

export function ReportingPeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setStoredPeriod] = useState<ReportingPeriod | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (validReportingPeriod(parsed)) window.setTimeout(() => setStoredPeriod(parsed), 0);
    } catch {
      // Penyimpanan browser bersifat opsional; data halaman tetap menjadi acuan utama.
    }
  }, []);

  const setPeriod = useCallback((nextPeriod: ReportingPeriod) => {
    if (!validReportingPeriod(nextPeriod)) return;
    setStoredPeriod(nextPeriod);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPeriod)); } catch { /* opsional */ }
  }, []);

  const value = useMemo(() => ({ period, setPeriod }), [period, setPeriod]);
  return <ReportingPeriodContext.Provider value={value}>{children}</ReportingPeriodContext.Provider>;
}

export function useReportingPeriod() {
  const value = useContext(ReportingPeriodContext);
  if (!value) throw new Error("useReportingPeriod harus digunakan di dalam ReportingPeriodProvider.");
  return value;
}
