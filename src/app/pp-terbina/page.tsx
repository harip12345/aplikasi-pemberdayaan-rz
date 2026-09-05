import { Metadata } from "next";
import { LiveMetricsDetail } from "@/components/LiveMetricsDetail";

export const metadata: Metadata = {
  title: "Peserta Program Terbina | Laporan Pemberdayaan Rumah Zakat",
};

export default function PesertaProgramTerbinaPage() {
  return <LiveMetricsDetail metricId="pp-terbina" />;
}
