import { notFound } from "next/navigation";
import { DampakProgramView } from "@/components/DampakProgramView";

const detailIds = new Set([
  "vokasi-keahlian", "terserap-kerja", "wirausaha", "hafiz",
  "stunting", "posyandu", "kader", "bank-sampah", "mangrove", "tps3r", "masjid",
]);

export default async function ImpactIndicatorPage({ params }: { params: Promise<{ indicatorId: string }> }) {
  const { indicatorId } = await params;
  if (!detailIds.has(indicatorId)) notFound();
  return <DampakProgramView indicatorId={indicatorId} />;
}
