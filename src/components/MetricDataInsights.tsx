"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Database, MapPinned, TrendingUp, Users } from "lucide-react";
import { formatNumber } from "@/data/dashboard";
import type { MetricDetailData, MetricDetailDataset } from "@/lib/metric-detail-sheets";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const COLORS = ["#F06422", "#0EA5E9", "#22C55E", "#EAB308", "#8B5CF6", "#EC4899", "#64748B"];

type Stat = { label: string; value: string; note: string };
type Series = { key: string; label: string; color: string };
type Insight = {
  title: string;
  eyebrow: string;
  narrative: string;
  stats: Stat[];
  monthlyData: Array<Record<string, string | number>>;
  monthlySeries: Series[];
  primaryEyebrow?: string;
  primaryTitle?: string;
  primaryNarrative?: string;
  primaryLabel?: string;
  primaryNote?: string;
  programFlow?: string[];
  distributionTitle: string;
  distributionData: Array<{ name: string; value: number }>;
  distributionType: "bar" | "pie";
};

function column(dataset: MetricDetailDataset, name: string) {
  return dataset.columns.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase());
}

function clean(value: string) {
  return value.trim() || "Tidak tercantum";
}

function uniqueCount(dataset: MetricDetailDataset, columnName: string) {
  const index = column(dataset, columnName);
  if (index < 0) return 0;
  return new Set(dataset.rows.map((row) => clean(row[index] ?? "").toLowerCase()).filter((value) => value !== "tidak tercantum" && value !== "-")).size;
}

function filledCount(dataset: MetricDetailDataset, columnName: string) {
  const index = column(dataset, columnName);
  if (index < 0) return 0;
  return dataset.rows.filter((row) => {
    const value = clean(row[index] ?? "").toLowerCase();
    return value !== "tidak tercantum" && value !== "-";
  }).length;
}

function countBy(dataset: MetricDetailDataset, columnName: string, limit = 7) {
  const index = column(dataset, columnName);
  if (index < 0) return [];
  const counts = new Map<string, number>();
  dataset.rows.forEach((row) => {
    const value = clean(row[index] ?? "");
    if (value === "Tidak tercantum" || value === "-") return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

function countByWithRequired(dataset: MetricDetailDataset, groupColumnName: string, requiredColumnName: string, limit = 7) {
  const groupIndex = column(dataset, groupColumnName);
  const requiredIndex = column(dataset, requiredColumnName);
  if (groupIndex < 0 || requiredIndex < 0) return [];
  const counts = new Map<string, number>();
  dataset.rows.forEach((row) => {
    const required = clean(row[requiredIndex] ?? "").toLowerCase();
    const group = clean(row[groupIndex] ?? "");
    if (required === "tidak tercantum" || required === "-" || group === "Tidak tercantum" || group === "-") return;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  });
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

function bummasBusinessCounts(dataset: MetricDetailDataset) {
  const index = column(dataset, "Bidang Usaha/Program");
  if (index < 0) return [];
  const counts = new Map<string, { name: string; value: number }>();
  dataset.rows.forEach((row) => {
    const raw = clean(row[index] ?? "");
    if (raw === "Tidak tercantum" || raw === "-") return;
    const compact = raw.toLowerCase().replace(/[^a-z]/g, "");
    const normalizedName = ["microbisnis", "mikrobisnis", "micobisnis"].includes(compact) ? "Mikrobisnis" : raw;
    const key = normalizedName.toLowerCase();
    const current = counts.get(key) ?? { name: normalizedName, value: 0 };
    current.value += 1;
    counts.set(key, current);
  });
  return [...counts.values()].sort((a, b) => b.value - a.value).slice(0, 7);
}

function monthlyCount(dataset: MetricDetailDataset, columnName: string) {
  const counts = new Map(MONTHS.map((month) => [month.toLowerCase(), 0]));
  const index = column(dataset, columnName);
  if (index >= 0) dataset.rows.forEach((row) => {
    const normalized = (row[index] ?? "").trim().toLowerCase();
    const month = MONTHS.find((candidate) => normalized.includes(candidate.toLowerCase()));
    if (month) counts.set(month.toLowerCase(), (counts.get(month.toLowerCase()) ?? 0) + 1);
  });
  return MONTHS.map((month) => ({ month, total: counts.get(month.toLowerCase()) ?? 0 })).filter((item) => item.total > 0);
}

function monthlyCountWithRequired(dataset: MetricDetailDataset, monthColumnName: string, requiredColumnName: string) {
  const counts = new Map(MONTHS.map((month) => [month.toLowerCase(), 0]));
  const monthIndex = column(dataset, monthColumnName);
  const requiredIndex = column(dataset, requiredColumnName);
  if (monthIndex >= 0 && requiredIndex >= 0) dataset.rows.forEach((row) => {
    const normalized = (row[monthIndex] ?? "").trim().toLowerCase();
    const month = MONTHS.find((candidate) => normalized.includes(candidate.toLowerCase()));
    const required = clean(row[requiredIndex] ?? "").toLowerCase();
    if (month && required !== "tidak tercantum" && required !== "-") counts.set(month.toLowerCase(), (counts.get(month.toLowerCase()) ?? 0) + 1);
  });
  return MONTHS.map((month) => ({ month, total: counts.get(month.toLowerCase()) ?? 0 })).filter((item) => item.total > 0);
}

function parseNumber(value: string) {
  const normalized = value.replace(/[^\d-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function buildInsight(metricId: string, detail: MetricDetailData): Insight | null {
  if (metricId === "muzzaki") {
    const dataset = detail.datasets[0];
    if (!dataset) return null;
    const increaseIndex = column(dataset, "Peningkatan");
    const increases = increaseIndex >= 0 ? dataset.rows.map((row) => parseNumber(row[increaseIndex] ?? "")).filter((value) => value > 0) : [];
    const averageIncrease = increases.length ? Math.round(increases.reduce((sum, value) => sum + value, 0) / increases.length) : 0;
    const provinces = countBy(dataset, "Provinsi");
    return {
      eyebrow: "Perubahan ekonomi peserta",
      title: "Profil Dampak Muzaki",
      narrative: `${formatNumber(dataset.totalRows)} peserta tercatat pada sheet detail Muzaki. Visualisasi menunjukkan ritme capaian bulanan dan wilayah dengan konsentrasi peserta terbesar; nilai peningkatan digunakan untuk membaca perubahan ekonomi rata-rata peserta.`,
      stats: [
        { label: "Data peserta", value: formatNumber(dataset.totalRows), note: "baris terverifikasi" },
        { label: "Provinsi terjangkau", value: formatNumber(uniqueCount(dataset, "Provinsi")), note: provinces[0] ? `terbesar: ${provinces[0].name}` : "berdasarkan sheet" },
        { label: "Cabang terlibat", value: formatNumber(uniqueCount(dataset, "Cabang")), note: "kantor/cabang" },
        { label: "Rata-rata peningkatan", value: averageIncrease ? formatRupiah(averageIncrease) : "—", note: "berdasarkan kolom peningkatan" },
      ],
      monthlyData: monthlyCount(dataset, "Bulan"),
      monthlySeries: [{ key: "total", label: "Muzaki", color: "#F06422" }],
      distributionTitle: "Sebaran Muzaki per Provinsi",
      distributionData: provinces,
      distributionType: "bar",
    };
  }

  if (metricId === "munfik") {
    const summary = detail.datasets.find((dataset) => dataset.columns.includes("Empowerment") && dataset.columns.includes("Progdis"));
    const normalized = detail.datasets.find((dataset) => dataset.columns.includes("Sumber") && dataset.columns.includes("Nama"));
    if (!summary || !normalized) return null;
    const monthIndex = column(summary, "Bulan");
    const empowermentIndex = column(summary, "Empowerment");
    const progdisIndex = column(summary, "Progdis");
    const dakwahIndex = column(summary, "Dakwah");
    const monthlyData = summary.rows.filter((row) => !clean(row[monthIndex] ?? "").toLowerCase().includes("grand")).map((row) => ({ month: clean(row[monthIndex] ?? ""), empowerment: parseNumber(row[empowermentIndex] ?? ""), progdis: parseNumber(row[progdisIndex] ?? ""), dakwah: parseNumber(row[dakwahIndex] ?? "") })).filter((row) => row.empowerment + row.progdis + row.dakwah > 0);
    const sources = [
      { name: "Empowerment", value: monthlyData.reduce((sum, row) => sum + row.empowerment, 0) },
      { name: "Progdis", value: monthlyData.reduce((sum, row) => sum + row.progdis, 0) },
      { name: "Dakwah", value: monthlyData.reduce((sum, row) => sum + row.dakwah, 0) },
    ].filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
    const programs = countBy(normalized, "Program", 5);
    const total = sources.reduce((sum, item) => sum + item.value, 0);
    return {
      eyebrow: "Partisipasi dan sumber kontribusi",
      title: "Profil Kontribusi Munfik",
      narrative: `Sebanyak ${formatNumber(total)} Munfik tercatat dari Empowerment, Progdis, dan Dakwah. Empowerment dan Progdis berasal dari rincian peserta; Dakwah berasal dari kolom Capaian pada rekap bulanan, sehingga tidak tersedia rincian nama peserta untuk bagian tersebut.`,
      stats: [
        { label: "Total Munfik", value: formatNumber(total), note: "seluruh sumber" },
        { label: "Sumber data aktif", value: formatNumber(sources.length), note: sources.map((item) => item.name).join(", ") },
        { label: "Bulan tercatat", value: formatNumber(monthlyData.length), note: "periode dengan data" },
        { label: "Program dominan", value: programs[0]?.name ?? "—", note: programs[0] ? `${formatNumber(programs[0].value)} data dari sumber rinci` : "belum tersedia" },
      ],
      monthlyData,
      monthlySeries: [
        { key: "empowerment", label: "Empowerment", color: "#F06422" },
        { key: "progdis", label: "Progdis", color: "#0EA5E9" },
        { key: "dakwah", label: "Dakwah", color: "#22C55E" },
      ],
      distributionTitle: "Komposisi Munfik per Sumber",
      distributionData: sources,
      distributionType: "pie",
    };
  }

  if (metricId === "mualaf") {
    const dataset = detail.datasets[0];
    if (!dataset) return null;
    const participantCount = filledCount(dataset, "Nama PM");
    const provinces = countByWithRequired(dataset, "Provinsi", "Nama PM");
    const gender = countByWithRequired(dataset, "Jenis Kelamin", "Nama PM", 5);
    return {
      eyebrow: "Jangkauan pembinaan Mualaf",
      title: "Profil Peserta dan Sebaran Pembinaan",
      narrative: `${formatNumber(participantCount)} data peserta Mualaf memiliki kolom Nama PM yang terisi dan tersebar di ${formatNumber(uniqueCount(dataset, "Provinsi"))} provinsi. Tren dan sebaran menggunakan baris dengan Nama PM terisi agar jumlah insight konsisten dengan capaian.`,
      stats: [
        { label: "Data peserta", value: formatNumber(participantCount), note: "seluruh Nama PM yang terisi" },
        { label: "Provinsi", value: formatNumber(uniqueCount(dataset, "Provinsi")), note: provinces[0] ? `terbesar: ${provinces[0].name}` : "wilayah pembinaan" },
        { label: "Kota/Kab", value: formatNumber(uniqueCount(dataset, "Kab/Kota")), note: "jangkauan administratif" },
        { label: "Komposisi gender", value: formatNumber(gender.length), note: gender.slice(0, 2).map((item) => `${item.name} ${formatNumber(item.value)}`).join(" · ") },
      ],
      monthlyData: monthlyCountWithRequired(dataset, "Bulan Informasi", "Nama PM"),
      monthlySeries: [{ key: "total", label: "Mualaf", color: "#0EA5E9" }],
      distributionTitle: "Sebaran Mualaf per Provinsi",
      distributionData: provinces,
      distributionType: "bar",
    };
  }

  if (metricId === "pp-terbina") {
    const dataset = detail.datasets[0];
    if (!dataset) return null;
    const programs = countBy(dataset, "Base Program");
    const provinces = countBy(dataset, "Provinsi");
    return {
      eyebrow: "Keberlanjutan pembinaan peserta",
      title: "Profil Peserta Program Terbina",
      narrative: `${formatNumber(dataset.totalRows)} data peserta terbina tercatat lintas wilayah dan basis program. Visualisasi menampilkan waktu mulai pembinaan serta konsentrasi basis program untuk membantu membaca kapasitas pendampingan.`,
      stats: [
        { label: "Data peserta", value: formatNumber(dataset.totalRows), note: "baris pada sheet detail" },
        { label: "Provinsi", value: formatNumber(uniqueCount(dataset, "Provinsi")), note: provinces[0] ? `terbesar: ${provinces[0].name}` : "wilayah pembinaan" },
        { label: "Kota/Kab", value: formatNumber(uniqueCount(dataset, "Kab/Kota")), note: "jangkauan administratif" },
        { label: "Cabang", value: formatNumber(uniqueCount(dataset, "Cabang")), note: "kantor pengelola" },
      ],
      monthlyData: monthlyCount(dataset, "Bulan Awal Program"),
      monthlySeries: [{ key: "total", label: "Peserta terbina", color: "#22C55E" }],
      distributionTitle: "Peserta berdasarkan Basis Program",
      distributionData: programs,
      distributionType: "bar",
    };
  }

  if (metricId === "bummas") {
    const dataset = detail.datasets[0];
    if (!dataset) return null;
    const validEntries = filledCount(dataset, "Bidang Usaha/Program");
    const businesses = bummasBusinessCounts(dataset);
    const memberIndex = column(dataset, "Jumlah Anggota");
    const totalMembers = memberIndex >= 0 ? dataset.rows.reduce((total, row) => total + parseNumber(row[memberIndex] ?? ""), 0) : 0;
    const statusIndex = column(dataset, "Status BUMMas");
    const businessIndex = column(dataset, "Bidang Usaha/Program");
    let activeUnits = 0;
    let inactiveUnits = 0;
    dataset.rows.forEach((row) => {
      const business = businessIndex >= 0 ? clean(row[businessIndex] ?? "").toLowerCase() : "tidak tercantum";
      if (business === "tidak tercantum" || business === "-") return;
      const status = statusIndex >= 0 ? clean(row[statusIndex] ?? "").toLowerCase() : "tidak tercantum";
      if (status === "aktif") activeUnits += 1;
      else if (status.replace(/\s+/g, " ") === "tidak aktif") inactiveUnits += 1;
    });
    const activeRate = validEntries > 0 ? Math.round((activeUnits / validEntries) * 100) : 0;
    const villageCount = uniqueCount(dataset, "Nama Desa");
    const provinceCount = uniqueCount(dataset, "Propinsi");
    const branchCount = uniqueCount(dataset, "Cabang");
    const dominantBusiness = businesses[0];
    return {
      eyebrow: "Kelembagaan ekonomi Desa Berdaya",
      title: "BUMMas sebagai Penggerak Usaha Bersama",
      narrative: `BUMMas merupakan kelembagaan usaha berbasis kelompok yang diarahkan menjadi social enterprise dan penopang keberlanjutan Desa Berdaya. Portofolio Rumah Zakat mencakup ${formatNumber(validEntries)} unit usaha masyarakat di ${formatNumber(villageCount)} desa; ${dominantBusiness?.name ?? "usaha berbasis potensi lokal"} menjadi model yang paling banyak dijalankan.`,
      stats: [
        { label: "Unit usaha masyarakat", value: formatNumber(validEntries), note: "portofolio BUMMas yang dijalankan" },
        { label: "Usaha aktif", value: formatNumber(activeUnits), note: `${activeRate}% menopang kegiatan ekonomi kelompok` },
        { label: "Anggota terlibat", value: totalMembers ? formatNumber(totalMembers) : "—", note: "pelaku dalam ekosistem usaha bersama" },
        { label: "Desa terjangkau", value: formatNumber(villageCount), note: `${formatNumber(provinceCount)} provinsi · ${formatNumber(branchCount)} cabang` },
      ],
      monthlyData: [],
      monthlySeries: [{ key: "total", label: "Jumlah unit", color: "#F06422" }],
      primaryEyebrow: "Cara kerja program",
      primaryTitle: "Dari Potensi Lokal Menuju Usaha Berkelanjutan",
      primaryLabel: "Implementasi Rumah Zakat",
      primaryNarrative: `Rumah Zakat mengembangkan BUMMas dengan mengenali potensi desa, membentuk kelembagaan usaha kelompok, lalu memperkuatnya melalui dukungan modal, pembinaan anggota, dan monitoring usaha. Dalam portofolio saat ini, ${formatNumber(activeUnits)} unit telah aktif, sedangkan ${formatNumber(inactiveUnits)} unit menjadi ruang penguatan dan reaktivasi agar manfaat ekonomi kembali bergerak di tingkat desa.`,
      primaryNote: "Arah dampak: pendapatan dan kemandirian anggota meningkat, akses terhadap kebutuhan dasar menguat, serta manfaat usaha dapat diputar kembali untuk kepentingan sosial dan keberlanjutan Desa Berdaya.",
      programFlow: ["Potensi lokal", "Usaha kelompok", "Modal & kapasitas", "Pendampingan", "Manfaat ekonomi-sosial"],
      distributionTitle: "Portofolio Model Usaha BUMMas",
      distributionData: businesses,
      distributionType: "bar",
    };
  }

  return null;
}

export function MetricDataInsights({ metricId, detail }: { metricId: string; detail: MetricDetailData }) {
  const insight = useMemo(() => buildInsight(metricId, detail), [detail, metricId]);
  if (!insight) return null;

  return <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft">
    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6"><div className="flex items-start gap-3"><span className="rounded-xl bg-orange-50 p-2.5 text-[#D84315]"><TrendingUp size={18} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D84315]">{insight.eyebrow}</p><h2 className="mt-1 text-2xl font-bold text-ink">{insight.title}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{insight.narrative}</p></div></div></div>

    <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
      {insight.stats.map((stat, index) => <div key={stat.label} className="rounded-[20px] border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>{index === 0 ? <Users size={15} className="text-orange-400" /> : index === 1 ? <MapPinned size={15} className="text-sky-500" /> : <Database size={15} className="text-slate-400" />}</div><p className="mt-2 truncate text-2xl font-bold text-ink" title={stat.value}>{stat.value}</p><p className="mt-1 min-h-8 text-[11px] leading-4 text-slate-500">{stat.note}</p></div>)}
    </div>

    <div className="grid gap-6 px-6 pb-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{insight.primaryEyebrow ?? "Tren bulanan"}</p><h3 className="mt-1 text-lg font-bold text-ink">{insight.primaryTitle ?? "Perkembangan Data per Bulan"}</h3>{insight.primaryNarrative ? <div className="mt-5 flex min-h-[290px] items-center rounded-[20px] border border-orange-100 bg-gradient-to-br from-white to-orange-50 p-7"><div className="w-full"><p className="text-sm font-semibold text-[#D84315]">{insight.primaryLabel ?? "Interpretasi program"}</p><p className="mt-3 text-sm leading-6 text-slate-600">{insight.primaryNarrative}</p>{insight.programFlow?.length ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{insight.programFlow.map((step, index) => <div key={step} className="relative rounded-xl border border-orange-100 bg-white px-2 py-3 text-center"><p className="text-[9px] font-bold uppercase tracking-wider text-orange-400">Tahap {index + 1}</p><p className="mt-1 text-[11px] font-semibold leading-4 text-slate-700">{step}</p></div>)}</div> : null}<p className="mt-5 text-xs leading-5 text-slate-500">{insight.primaryNote}</p></div></div> : <div className="mt-4 h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={insight.monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={55} stroke="#94A3B8" /><YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend wrapperStyle={{ fontSize: 10 }} />{insight.monthlySeries.map((series) => <Bar key={series.key} dataKey={series.key} name={series.label} stackId={insight.monthlySeries.length > 1 ? "monthly" : undefined} fill={series.color} radius={insight.monthlySeries.length > 1 ? undefined : [5, 5, 0, 0]} />)}</BarChart></ResponsiveContainer></div>}</div>

      <div className="rounded-[22px] border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Distribusi</p><h3 className="mt-1 text-lg font-bold text-ink">{insight.distributionTitle}</h3><div className="mt-4 h-[320px]">{insight.distributionType === "pie" ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={insight.distributionData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>{insight.distributionData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><BarChart data={insight.distributionData} layout="vertical" margin={{ top: 4, right: 12, left: 18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" /><XAxis type="number" tick={{ fontSize: 10 }} stroke="#94A3B8" /><YAxis dataKey="name" type="category" width={118} tick={{ fontSize: 9 }} stroke="#94A3B8" /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Bar dataKey="value" name="Jumlah" fill="#F06422" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>}</div></div>
    </div>
  </div>;
}
