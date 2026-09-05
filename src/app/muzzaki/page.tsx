import { Metadata } from "next";
import { LiveMetricsDetail } from "@/components/LiveMetricsDetail";

export const metadata: Metadata = {
  title: "Muzaki | Laporan Pemberdayaan Rumah Zakat",
};

export default function MuzakiPage() {
  return <LiveMetricsDetail metricId="muzzaki" />;
}
