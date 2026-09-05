export type AchievementTone = {
  label: "Tercapai" | "Perlu perhatian" | "Di bawah target";
  color: string;
  softColor: string;
  trackColor: string;
};

/** Ambang visual kinerja: >=100% hijau, 75–99% kuning, dan <75% merah. */
export function achievementTone(percentage: number): AchievementTone {
  if (percentage >= 100) return { label: "Tercapai", color: "#16A34A", softColor: "#F0FDF4", trackColor: "#DCFCE7" };
  if (percentage >= 75) return { label: "Perlu perhatian", color: "#CA8A04", softColor: "#FEFCE8", trackColor: "#FEF9C3" };
  return { label: "Di bawah target", color: "#DC2626", softColor: "#FEF2F2", trackColor: "#FEE2E2" };
}

