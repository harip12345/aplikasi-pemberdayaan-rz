import { Metadata } from "next";
import { LiveMetricsDetail } from "@/components/LiveMetricsDetail";

export const metadata: Metadata = {
  title: "Garis Kemiskinan | Laporan Pemberdayaan Rumah Zakat",
};

export default function GarisKemiskinanPage() {
  return <LiveMetricsDetail metricId="garis-kemiskinan" />;
}
