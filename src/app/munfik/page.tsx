import { Metadata } from "next";
import { LiveMetricsDetail } from "@/components/LiveMetricsDetail";

export const metadata: Metadata = {
  title: "Munfik | Laporan Pemberdayaan Rumah Zakat",
};

export default function MunfikPage() {
  return <LiveMetricsDetail metricId="munfik" />;
}
