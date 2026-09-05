import { Metadata } from "next";
import { DashboardView } from "@/components/DashboardView";

export const metadata: Metadata = {
  title: "Dashboard | Laporan Pemberdayaan Rumah Zakat",
};

export default function DashboardPage() {
  return <DashboardView />;
}
