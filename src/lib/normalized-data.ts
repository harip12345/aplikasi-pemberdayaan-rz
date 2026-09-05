import type { DataQualityReport } from "@/lib/data-quality";
import type { AiDataSourceId } from "@/lib/data-catalog";

export type DataProvenance = {
  sourceId: AiDataSourceId;
  sourceLabel: string;
  spreadsheetId: string;
  gid: string;
  sheetUrl: string;
  updatedAt: string;
};

export type NormalizedDashboardRecord = {
  indicatorId: string;
  year: number;
  monthIndex: number;
  value: number;
  annualTarget: number;
};

export type NormalizedParticipantRecord = {
  sourceRow: number;
  year: number;
  monthIndex: number;
  province: string;
  city: string;
  branch: string;
  program: string;
  subProgram: string;
  asnaf: Record<string, number>;
  value: number;
};

export type NormalizedMunfikRecord = {
  sourceRow: number;
  monthIndex: number;
  sourceType: "Empowerment" | "Progdis" | "Dakwah";
  name: string;
  office: string;
  city: string;
  province: string;
  program: string;
  nominal: number | null;
};

export type NormalizedDetailRecord = {
  sourceRow: number;
  monthIndex: number | null;
  values: Record<string, string>;
};

export type NormalizedDataset<T> = {
  records: T[];
  quality: DataQualityReport;
  provenance: DataProvenance;
};
