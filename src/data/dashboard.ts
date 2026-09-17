export type Metric = {
  id: string;
  title: string;
  shortTitle: string;
  target: number;
  achievement: number;
  unit: string;
  description: string;
  color: string;
  trend: number;
  dataThroughMonthIndex?: number;
  monthly: { month: string; target: number; achievement: number }[];
  regions: { name: string; value: number; percentage: number }[];
};

const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function series(target: number, achievement: number) {
  return months.map((month, index) => ({
    month,
    target: Math.round((target / 12) * (index + 1)),
    achievement: Math.round((achievement / 12) * (index + 1) * (0.86 + Math.min(index, 5) * 0.025)),
  }));
}

const rawMetrics = [
  ["desa-berdaya", "Desa Berdaya", "Desber", 0, 0, "desa", "Desa yang menguat melalui program pemberdayaan terintegrasi.", "#E65100", 0],
  ["bummas", "Badan Usaha Milik Masyarakat", "Bummas", 0, 0, "unit", "Unit usaha masyarakat yang terus berkembang dan mandiri.", "#F57C00", 0],
  ["muzzaki", "Muzaki", "Muzaki", 0, 0, "orang", "Pemberi zakat yang terhubung dalam ekosistem kebaikan.", "#FB8C00", 0],
  ["munfik", "Munfik", "Munfik", 0, 0, "orang", "Donatur infak yang berkontribusi secara berkelanjutan.", "#FF9800", 0],
  ["garis-kemiskinan", "Keluar dari Garis Kemiskinan", "GK", 0, 0, "orang", "Penerima manfaat yang mengalami peningkatan taraf hidup.", "#EF6C00", 0],
  ["peserta-program", "Peserta Program", "PP", 0, 0, "orang", "Peserta pada seluruh program pemberdayaan RZ.", "#D84315", 0],
  ["pp-terbina", "Peserta Program Terbina", "PP Terbina", 0, 0, "orang", "Peserta program yang memperoleh pembinaan secara berkelanjutan.", "#C2410C", 0],
  ["peserta-layanan-program", "Peserta Layanan Program", "PLP", 0, 0, "orang", "Peserta yang menerima layanan program pemberdayaan.", "#F4511E", 0],
  ["mualaf", "Mualaf", "Mualaf", 0, 0, "orang", "Mualaf yang didampingi melalui pembinaan.", "#FF7043", 0],
] as const;

export const metrics: Metric[] = rawMetrics.map(([id, title, shortTitle, target, achievement, unit, description, color, trend], index) => ({
  id,
  title,
  shortTitle,
  target,
  achievement,
  unit,
  description,
  color,
  trend,
  monthly: series(target, achievement),
  regions: [
    { name: "Jawa Barat", value: Math.round(achievement * 0.28), percentage: 28 },
    { name: "Jawa Tengah", value: Math.round(achievement * 0.22), percentage: 22 },
    { name: "Jawa Timur", value: Math.round(achievement * 0.18), percentage: 18 },
    { name: "Sumatera", value: Math.round(achievement * 0.17), percentage: 17 },
    { name: "Kalimantan & Indonesia Timur", value: Math.round(achievement * 0.15), percentage: 15 },
  ],
}));

export const programImpacts = [
  { title: "Peningkatan Pendapatan", value: "62%", detail: "Rata-rata peningkatan pendapatan keluarga dampingan", color: "#E65100" },
  { title: "Usaha Bertahan", value: "84%", detail: "Bummas aktif setelah menerima pendampingan", color: "#F57C00" },
  { title: "Kemandirian Keluarga", value: "9.840", detail: "Keluarga keluar dari garis kemiskinan", color: "#FB8C00" },
  { title: "Penerima Manfaat", value: "218.950", detail: "Layanan pemberdayaan telah tersalurkan", color: "#FF9800" },
];

export const mapLocations = [
  { name: "Desa Berdaya Cibiru", city: "Bandung", latitude: -6.9147, longitude: 107.6098, type: "Desa Berdaya", beneficiaries: 1240 },
  { name: "Unit Layanan Semarang", city: "Semarang", latitude: -7.0051, longitude: 110.4381, type: "Unit Layanan", beneficiaries: 980 },
  { name: "Desa Berdaya Gresik", city: "Gresik", latitude: -7.1568, longitude: 112.6555, type: "Desa Berdaya", beneficiaries: 1115 },
  { name: "Unit Layanan Makassar", city: "Makassar", latitude: -5.1477, longitude: 119.4327, type: "Unit Layanan", beneficiaries: 860 },
  { name: "Desa Berdaya Medan", city: "Medan", latitude: 3.5952, longitude: 98.6722, type: "Desa Berdaya", beneficiaries: 925 },
];

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function percentage(metric: Metric) {
  return metric.target > 0 ? Math.round((metric.achievement / metric.target) * 100) : 0;
}
