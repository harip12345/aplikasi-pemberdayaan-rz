import { Metadata } from "next";
import { LiveMetricsDetail } from "@/components/LiveMetricsDetail";

export const metadata: Metadata = {
  title: "Bummas | Laporan Pemberdayaan Rumah Zakat",
};

export default function BummasPage() {
  return <LiveMetricsDetail metricId="bummas" />;
}
