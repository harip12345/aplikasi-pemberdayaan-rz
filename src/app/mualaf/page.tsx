import { Metadata } from "next";
import { LiveMetricsDetail } from "@/components/LiveMetricsDetail";

export const metadata: Metadata = {
  title: "Mualaf | Laporan Pemberdayaan Rumah Zakat",
};

export default function MualafPage() {
  return <LiveMetricsDetail metricId="mualaf" />;
}
