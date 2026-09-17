"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Apple, Baby, BadgeCheck, BookOpen, CalendarDays, Camera, CircleDot, GraduationCap, Hammer, Heart, Landmark, Leaf, Library, MapPin, Newspaper, Phone, Recycle, RefreshCw, Search, Shield, SlidersHorizontal, Store, Users, X, type LucideIcon } from "lucide-react";
import { ProvinceDistribution, VillageProfile, VillageStatus, VillageType } from "@/data/distribution";
import { fetchCachedJson, getCachedJsonSnapshot } from "@/lib/client-data-cache";

const DistributionMap = dynamic(() => import("@/components/DistributionMap").then((module) => module.DistributionMap), { ssr: false });
const EMPTY_PROVINCES: ProvinceDistribution[] = [];

type StatusFilter = VillageStatus | "Semua";
type VillageTypeFilter = VillageType | "Semua";
type ProgramFilter = string | "Semua";

type DistributionResponse = {
  provinces: ProvinceDistribution[];
  totalVillages: number;
  activeVillages: number;
  updatedAt: string;
  source: "Google Sheets";
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

const PROGRAM_ICONS: Record<string, LucideIcon> = {
  "Capacity Building": GraduationCap,
  Bummas: Store,
  "Kebun Gizi": Apple,
  "Desa Ramah Lansia": Heart,
  "Desa Bebas Stunting": Baby,
  "Rumah Literasi": BookOpen,
  "Rumah Vokasi": Hammer,
  "Rumah Qur'an": Library,
  "Bank Sampah": Recycle,
  "Desa Lestari": Leaf,
  Destana: Shield,
  "Masjid Berdaya": Landmark,
};

function programIcon(program: string) {
  return PROGRAM_ICONS[program] ?? CircleDot;
}

function MapFilterSelect({ label, value, options, allLabel, onChange }: { label: string; value: string; options: string[]; allLabel: string; onChange: (value: string) => void }) {
  return <label className="relative block"><span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pb-1 pt-4 text-sm font-medium text-ink outline-none transition focus:border-[#D84315] focus:bg-white focus:ring-4 focus:ring-orange-100"><option value="Semua">{allLabel}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export default function PetaSebaranPage() {
  const cachedDistribution = getCachedJsonSnapshot<DistributionResponse>("distribution-sheet-production-v2");
  const [distribution, setDistribution] = useState<DistributionResponse | null>(cachedDistribution);
  const [isLoading, setIsLoading] = useState(!cachedDistribution);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<ProvinceDistribution | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<VillageProfile | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [villageTypeFilter, setVillageTypeFilter] = useState<VillageTypeFilter>("Semua");
  const [programFilter, setProgramFilter] = useState<ProgramFilter>("Semua");
  const [provinceFilter, setProvinceFilter] = useState("Semua");
  const [regencyFilter, setRegencyFilter] = useState("Semua");
  const [districtFilter, setDistrictFilter] = useState("Semua");
  const [villageFilter, setVillageFilter] = useState("Semua");
  const [branchFilter, setBranchFilter] = useState("Semua");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedProgramQuery, setSelectedProgramQuery] = useState("");

  const loadDistribution = useCallback(async (forceRefresh = true) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const payload = await fetchCachedJson<DistributionResponse>("distribution-sheet-production-v2", "/api/distribution", forceRefresh);
      setDistribution(payload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Data tidak dapat dimuat.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchCachedJson<DistributionResponse>("distribution-sheet-production-v2", "/api/distribution")
      .then((payload) => {
        if (!cancelled) setDistribution(payload);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Data tidak dapat dimuat.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const provinceDistributions = distribution?.provinces ?? EMPTY_PROVINCES;
  const availablePrograms = useMemo(() => {
    const programs = new Set<string>();
    provinceDistributions.forEach((province) => province.villages.forEach((village) => village.programs.forEach((program) => programs.add(program))));
    return [...programs].sort((a, b) => a.localeCompare(b, "id"));
  }, [provinceDistributions]);

  const availableProvinces = useMemo(() => provinceDistributions
    .filter((province) => branchFilter === "Semua" || province.villages.some((village) => village.branch === branchFilter))
    .map((province) => province.name).sort((a, b) => a.localeCompare(b, "id")), [branchFilter, provinceDistributions]);
  const availableRegencies = useMemo(() => [...new Set(provinceDistributions
    .filter((province) => provinceFilter === "Semua" || province.name === provinceFilter)
    .flatMap((province) => province.villages)
    .filter((village) => branchFilter === "Semua" || village.branch === branchFilter)
    .map((village) => village.regency))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "id")), [branchFilter, provinceDistributions, provinceFilter]);
  const availableDistricts = useMemo(() => [...new Set(provinceDistributions
    .filter((province) => provinceFilter === "Semua" || province.name === provinceFilter)
    .flatMap((province) => province.villages)
    .filter((village) => (branchFilter === "Semua" || village.branch === branchFilter) && (regencyFilter === "Semua" || village.regency === regencyFilter))
    .map((village) => village.district))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "id")), [branchFilter, provinceDistributions, provinceFilter, regencyFilter]);
  const availableVillages = useMemo(() => [...new Set(provinceDistributions
    .filter((province) => provinceFilter === "Semua" || province.name === provinceFilter)
    .flatMap((province) => province.villages)
    .filter((village) => (branchFilter === "Semua" || village.branch === branchFilter) && (regencyFilter === "Semua" || village.regency === regencyFilter) && (districtFilter === "Semua" || village.district === districtFilter))
    .map((village) => village.name))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "id")), [branchFilter, districtFilter, provinceDistributions, provinceFilter, regencyFilter]);
  const availableBranches = useMemo(() => [...new Set(provinceDistributions
    .filter((province) => provinceFilter === "Semua" || province.name === provinceFilter)
    .flatMap((province) => province.villages)
    .filter((village) => (regencyFilter === "Semua" || village.regency === regencyFilter) && (districtFilter === "Semua" || village.district === districtFilter) && (villageFilter === "Semua" || village.name === villageFilter))
    .map((village) => village.branch))]
    .filter((branch) => branch && branch !== "-").sort((a, b) => a.localeCompare(b, "id")), [districtFilter, provinceDistributions, provinceFilter, regencyFilter, villageFilter]);

  const hasActiveMapFilters = statusFilter !== "Semua" || villageTypeFilter !== "Semua" || programFilter !== "Semua" || provinceFilter !== "Semua" || regencyFilter !== "Semua" || districtFilter !== "Semua" || villageFilter !== "Semua" || branchFilter !== "Semua";

  const filteredProvinceDistributions = useMemo(() => {
    return provinceDistributions
      .map((province) => {
        const villages = province.villages.filter((village) => {
          const matchesProvince = provinceFilter === "Semua" || province.name === provinceFilter;
          const matchesRegency = regencyFilter === "Semua" || village.regency === regencyFilter;
          const matchesDistrict = districtFilter === "Semua" || village.district === districtFilter;
          const matchesVillage = villageFilter === "Semua" || village.name === villageFilter;
          const matchesBranch = branchFilter === "Semua" || village.branch === branchFilter;
          const matchesStatus = statusFilter === "Semua" || village.status === statusFilter;
          const matchesType = villageTypeFilter === "Semua" || village.villageType === villageTypeFilter;
          const matchesProgram = programFilter === "Semua" || village.programs.includes(programFilter);

          return matchesProvince && matchesRegency && matchesDistrict && matchesVillage && matchesBranch && matchesStatus && matchesType && matchesProgram;
        });

        return {
          ...province,
          villages,
          count: villages.length,
          activeCount: villages.filter((village) => village.status === "Aktif").length,
        };
      })
      .filter((province) => province.count > 0);
  }, [branchFilter, districtFilter, programFilter, provinceDistributions, provinceFilter, regencyFilter, statusFilter, villageFilter, villageTypeFilter]);

  const filteredVillageCount = useMemo(
    () => filteredProvinceDistributions.reduce((total, province) => total + province.count, 0),
    [filteredProvinceDistributions],
  );

  const programSummaries = useMemo(() => {
    const counts = new Map<string, number>();
    filteredProvinceDistributions.forEach((province) => {
      province.villages.forEach((village) => {
        village.programs.forEach((program) => counts.set(program, (counts.get(program) ?? 0) + 1));
      });
    });

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "id"));
  }, [filteredProvinceDistributions]);

  const programInsight = useMemo(() => {
    const villages = provinceDistributions.flatMap((province) => province.villages);
    const activeVillages = villages.filter((village) => village.status === "Aktif").length;
    const hibernatingVillages = villages.filter((village) => village.status === "Hibernasi").length;
    const graduatedVillages = villages.filter((village) => village.status === "Graduasi").length;
    const activeVolunteerCount = villages.filter((village) => village.villageType === "Desber" && village.status === "Aktif" && village.volunteer.status === "Aktif").length;
    const programCounts = new Map<string, number>();
    let programPoints = 0;
    let integratedVillages = 0;

    villages.forEach((village) => {
      if (village.programs.length > 1) integratedVillages += 1;
      village.programs.forEach((program) => {
        programPoints += 1;
        programCounts.set(program, (programCounts.get(program) ?? 0) + 1);
      });
    });

    const dominantProgram = [...programCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const leadingProvince = [...provinceDistributions].sort((a, b) => b.count - a.count)[0];

    return {
      villageCount: villages.length,
      provinceCount: provinceDistributions.length,
      activeVillages,
      activeRate: villages.length ? Math.round((activeVillages / villages.length) * 100) : 0,
      hibernatingVillages,
      graduatedVillages,
      activeVolunteerCount,
      programPoints,
      integratedVillages,
      dominantProgram: dominantProgram ? { name: dominantProgram[0], count: dominantProgram[1] } : null,
      leadingProvince,
    };
  }, [provinceDistributions]);

  const selectedProgramVillages = useMemo(() => {
    if (!selectedProgram) return [];

    const normalizedQuery = selectedProgramQuery.trim().toLowerCase();

    return filteredProvinceDistributions.flatMap((province) =>
      province.villages
        .filter((village) => {
          if (!village.programs.includes(selectedProgram)) return false;
          if (!normalizedQuery) return true;

          return [province.name, village.name, village.regency, village.district, village.branch, village.status, village.villageType]
            .some((value) => value.toLowerCase().includes(normalizedQuery));
        })
        .map((village) => ({ provinceName: province.name, village })),
    );
  }, [filteredProvinceDistributions, selectedProgram, selectedProgramQuery]);

  const filteredVillages = useMemo(() => {
    if (!selectedProvince) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return selectedProvince.villages;
    return selectedProvince.villages.filter((village) =>
      [village.name, village.regency, village.district, village.status, village.villageType, ...village.programs].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [query, selectedProvince]);

  const resetMapFilters = () => {
    setStatusFilter("Semua");
    setVillageTypeFilter("Semua");
    setProgramFilter("Semua");
    setProvinceFilter("Semua");
    setRegencyFilter("Semua");
    setDistrictFilter("Semua");
    setVillageFilter("Semua");
    setBranchFilter("Semua");
  };

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-soft">
        <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#32415B] px-6 py-8 text-white xl:px-8">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-orange-600/10 blur-3xl" />
          <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white xl:text-4xl">Desa Berdaya</h1>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Kerangka pemberdayaan terintegrasi</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Dari Potensi Lokal Menuju Kemandirian Desa</h2>
          <p className="mt-3 max-w-5xl text-sm leading-7 text-white/70">
            Desa Berdaya adalah pendekatan pemberdayaan berbasis wilayah yang dimulai dari pemetaan potensi dan kebutuhan lokal. Rumah Zakat menghubungkan penguatan kapasitas masyarakat dengan program ekonomi, pendidikan, kesehatan, lingkungan dan kebencanaan, serta sosial. Pendampingan oleh Fasilitator (Relawan Inspirasi) diarahkan agar individu dan kelembagaan lokal mampu menyelesaikan persoalan, mengembangkan potensi desa, dan berkolaborasi dengan pemerintah maupun pemangku kepentingan lainnya.
          </p>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4 xl:px-8">
          <div className="rounded-2xl border border-orange-100 bg-orange-50/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D84315]">Jangkauan pemberdayaan</p>
            <p className="mt-2 min-h-8 text-2xl font-bold text-ink">{isLoading ? "" : formatNumber(programInsight.villageCount)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">desa di {formatNumber(programInsight.provinceCount)} provinsi</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Desa berstatus aktif</p>
            <p className="mt-2 min-h-8 text-2xl font-bold text-ink">{isLoading ? "" : formatNumber(programInsight.activeVillages)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{programInsight.activeRate}% dari portofolio wilayah</p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Ekosistem program</p>
            <p className="mt-2 min-h-8 text-2xl font-bold text-ink">{isLoading ? "" : formatNumber(programInsight.programPoints)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">titik intervensi lintas bidang</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">Relawan Inspirasi aktif</p>
            <p className="mt-2 min-h-8 text-2xl font-bold text-ink">{isLoading ? "" : formatNumber(programInsight.activeVolunteerCount)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">mendampingi desa berstatus aktif</p>
          </div>
        </div>

        <div className="grid gap-6 px-6 pb-7 xl:grid-cols-[1.15fr_0.85fr] xl:px-8">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cara kerja Desa Berdaya</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {["Pemetaan potensi", "Pendampingan Fasilitator (Relawan Inspirasi)", "Intervensi lintas sektor", "Kelembagaan & kemandirian"].map((step, index) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-orange-400">Tahap {index + 1}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              Fasilitator (Relawan Inspirasi) berperan sebagai pendamping dan pemberdaya, penggerak lingkungan, surveyor kebutuhan, serta advokat masyarakat agar program tumbuh dari kebutuhan dan kekuatan desa sendiri.
            </p>
          </div>

          <div className="rounded-[22px] border border-orange-100 bg-gradient-to-br from-white to-orange-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D84315]">Portofolio saat ini</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Data saat ini memetakan <strong className="text-ink">{formatNumber(programInsight.villageCount)} desa</strong>. {programInsight.leadingProvince ? <><strong className="text-ink">{programInsight.leadingProvince.name}</strong> menjadi wilayah dengan jangkauan terbesar sebanyak <strong className="text-ink">{formatNumber(programInsight.leadingProvince.count)} desa</strong>. </> : null}{programInsight.dominantProgram ? <><strong className="text-ink">{programInsight.dominantProgram.name}</strong> merupakan intervensi yang paling luas dengan <strong className="text-ink">{formatNumber(programInsight.dominantProgram.count)} titik program</strong>. </> : null}Sebanyak <strong className="text-ink">{formatNumber(programInsight.integratedVillages)} desa</strong> menjalankan lebih dari satu program, menunjukkan penerapan pendekatan lintas sektor sesuai kebutuhan wilayah.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">{formatNumber(programInsight.activeVillages)} aktif</span>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700">{formatNumber(programInsight.hibernatingVillages)} hibernasi</span>
              <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-700">{formatNumber(programInsight.graduatedVillages)} graduasi</span>
            </div>
            {programInsight.hibernatingVillages > programInsight.activeVillages && (
              <p className="mt-4 border-t border-orange-100 pt-4 text-xs leading-6 text-slate-500">
                Arah penguatan berikutnya adalah menentukan desa yang siap direaktivasi, menjaga kualitas pendampingan desa aktif, dan mendokumentasikan praktik baik dari desa yang telah graduasi.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-xs text-slate-500 xl:px-8">
          <p>
            {isLoading
              ? "Mengambil data Desa Berdaya dari Google Sheets…"
              : distribution
                ? `Sumber: ${distribution.source} · diambil ${new Date(distribution.updatedAt).toLocaleString("id-ID")}`
                : "Data Desa Berdaya belum tersedia."}
          </p>
          {!isLoading && (
            <button onClick={() => void loadDistribution()} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold text-[#D84315] transition hover:bg-orange-50">
              <RefreshCw size={13} /> Muat ulang
            </button>
          )}
        </div>

        {loadError && (
          <div className="mx-6 mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 xl:mx-8">{loadError}</div>
        )}
      </div>

      <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-soft">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <h2 className="font-bold text-ink">Sebaran Desa Berdaya per Provinsi</h2>
              <p className="mt-1 text-sm text-slate-500">Angka pada marker menunjukkan jumlah desa. Arahkan kursor untuk melihat detail, lalu klik marker untuk membuka daftar.</p>
            </div>
            <div className="flex min-h-4 items-center gap-2 text-xs text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-[#D84315]" /> {isLoading ? "" : `${formatNumber(filteredVillageCount)} desa ditampilkan`}</div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="grid min-w-[1480px] grid-cols-[repeat(8,minmax(145px,1fr))_auto] gap-3">
              <MapFilterSelect label="Provinsi" value={provinceFilter} options={availableProvinces} allLabel="Semua provinsi" onChange={(value) => { setProvinceFilter(value); setRegencyFilter("Semua"); setDistrictFilter("Semua"); setVillageFilter("Semua"); setBranchFilter("Semua"); }} />
              <MapFilterSelect label="Kota/Kab" value={regencyFilter} options={availableRegencies} allLabel="Semua kota/kab" onChange={(value) => { setRegencyFilter(value); setDistrictFilter("Semua"); setVillageFilter("Semua"); setBranchFilter("Semua"); }} />
              <MapFilterSelect label="Kecamatan" value={districtFilter} options={availableDistricts} allLabel="Semua kecamatan" onChange={(value) => { setDistrictFilter(value); setVillageFilter("Semua"); setBranchFilter("Semua"); }} />
              <MapFilterSelect label="Desa" value={villageFilter} options={availableVillages} allLabel="Semua desa" onChange={(value) => { setVillageFilter(value); setBranchFilter("Semua"); }} />
              <MapFilterSelect label="Cabang" value={branchFilter} options={availableBranches} allLabel="Semua cabang" onChange={setBranchFilter} />
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ket. Desber</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pb-1 pt-4 text-sm font-medium text-ink outline-none transition focus:border-[#D84315] focus:bg-white focus:ring-4 focus:ring-orange-100">
                  <option value="Semua">Semua kondisi</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Hibernasi">Hibernasi</option>
                  <option value="Graduasi">Graduasi</option>
                  <option value="Tidak diketahui">Tidak diketahui</option>
                </select>
              </label>
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status Desber</span>
                <select value={villageTypeFilter} onChange={(event) => setVillageTypeFilter(event.target.value as VillageTypeFilter)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pb-1 pt-4 text-sm font-medium text-ink outline-none transition focus:border-[#D84315] focus:bg-white focus:ring-4 focus:ring-orange-100">
                  <option value="Semua">Semua status</option>
                  <option value="Desber">Desber</option>
                  <option value="Desbin">Desbin</option>
                  <option value="Sister Village">Sister Village</option>
                  <option value="Desa Kolaborasi">Desa Kolaborasi</option>
                  <option value="Tidak diketahui">Tidak diketahui</option>
                </select>
              </label>
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Program</span>
                <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pb-1 pt-4 text-sm font-medium text-ink outline-none transition focus:border-[#D84315] focus:bg-white focus:ring-4 focus:ring-orange-100">
                  <option value="Semua">Semua program</option>
                  {availablePrograms.map((program) => <option key={program} value={program}>{program}</option>)}
                </select>
              </label>
              <button onClick={resetMapFilters} disabled={!hasActiveMapFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#D84315] disabled:cursor-not-allowed disabled:opacity-40">
                <SlidersHorizontal size={16} /> Reset
              </button>
            </div>
          </div>
        </div>
        <DistributionMap
          provinces={filteredProvinceDistributions}
          focusResults={hasActiveMapFilters}
          onProvinceSelect={setSelectedProvince}
        />
      </div>

      <div className="rounded-[28px] bg-white/85 p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-[#D84315]"><CircleDot size={18} /><p className="text-sm font-semibold">Program pada database</p></div>
            <h2 className="mt-1 text-lg font-bold text-ink">Program Desa Berdaya</h2>
            <p className="mt-1 text-sm text-slate-500">Jumlah desa yang menjalankan setiap program berdasarkan filter peta saat ini.</p>
          </div>
          <p className="text-xs text-slate-500">Klik program untuk melihat daftar desa</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {programSummaries.map((program) => {
            const ProgramIcon = programIcon(program.name);
            return (
            <button key={program.name} onClick={() => { setSelectedProvince(null); setSelectedProgram(program.name); setSelectedProgramQuery(""); }} className="group rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{program.name}</p>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#D84315]"><ProgramIcon size={20} strokeWidth={1.8} /></span>
              </div>
              <p className="mt-3 text-2xl font-bold text-[#D84315]">{formatNumber(program.count)}</p>
              <p className="mt-1 text-xs text-slate-500">titik program</p>
            </button>
          );})}
          {!isLoading && programSummaries.length === 0 && <p className="col-span-full rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Tidak ada program yang sesuai dengan filter saat ini.</p>}
        </div>
      </div>

      {selectedProgram && (
        <aside className="fixed inset-y-0 right-0 z-[1000] flex w-full max-w-[620px] flex-col bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#D84315]">Program Desa Berdaya</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">{selectedProgram}</h2>
                <p className="mt-1 text-sm text-slate-500">{formatNumber(selectedProgramVillages.length)} titik program ditemukan</p>
              </div>
              <button onClick={() => setSelectedProgram(null)} aria-label="Tutup daftar program" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X size={20} /></button>
            </div>
          </div>
          <div className="border-b border-slate-100 px-6 py-4">
            <label className="relative block">
              <span className="sr-only">Cari titik program</span>
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={selectedProgramQuery} onChange={(event) => setSelectedProgramQuery(event.target.value)} placeholder="Cari desa, kabupaten, kecamatan, provinsi, atau cabang" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-[#D84315] focus:bg-white focus:ring-4 focus:ring-orange-100" />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-3">
              {selectedProgramVillages.map(({ provinceName, village }) => (
                <button key={village.id} onClick={() => setSelectedVillage(village)} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left transition hover:border-orange-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{village.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{village.regency} · {provinceName}</p>
                      <p className="mt-2 text-xs text-slate-400">{village.district} · {village.branch}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5"><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#D84315]">{village.villageType}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${village.status === "Aktif" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{village.status}</span></div>
                  </div>
                </button>
              ))}
              {selectedProgramVillages.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Tidak ada titik program yang sesuai dengan pencarian dan filter saat ini.</p>}
            </div>
          </div>
        </aside>
      )}

      {selectedProvince && (
        <aside className="fixed inset-y-0 right-0 z-[1000] flex w-full max-w-[620px] flex-col bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#D84315]">Desa Berdaya · {selectedProvince.name}</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">{formatNumber(selectedProvince.count)} Desa Terdaftar</h2>
                <p className="mt-1 text-sm text-slate-500">{formatNumber(selectedProvince.activeCount)} aktif · {selectedProvince.branch}</p>
              </div>
              <button onClick={() => { setSelectedProvince(null); setQuery(""); }} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X size={20} /></button>
            </div>
            <div className="relative mt-5">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari desa, wilayah, status, atau program" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#D84315] focus:ring-4 focus:ring-orange-100" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-3">
              {filteredVillages.map((village) => (
                <button key={village.id} onClick={() => setSelectedVillage(village)} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left transition hover:border-orange-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{village.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{village.regency} · {village.district}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5"><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#D84315]">{village.villageType}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${village.status === "Aktif" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{village.status}</span></div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">{village.participants > 0 && <span className="flex items-center gap-1"><Users size={13} /> {formatNumber(village.participants)} peserta</span>}<span>{village.programs.length} program</span></div>
                </button>
              ))}
              {filteredVillages.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Tidak ada desa yang sesuai dengan pencarian.</p>}
            </div>
          </div>
        </aside>
      )}

      {selectedVillage && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
              <div>
                <div className="flex items-center gap-2"><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#D84315]">{selectedVillage.villageType}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedVillage.status === "Aktif" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{selectedVillage.status}</span><span className="text-sm text-slate-500">Profil Desa</span></div>
                <h2 className="mt-2 text-2xl font-bold text-ink">{selectedVillage.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedVillage.regency}, {selectedVillage.provinceId.replaceAll("-", " ")}</p>
              </div>
              <button onClick={() => setSelectedVillage(null)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"><X size={20} /></button>
            </div>
            <div className="grid gap-6 p-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <h3 className="font-semibold text-ink">Informasi Desa</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                    <div className="flex gap-3"><MapPin className="mt-0.5 shrink-0 text-[#D84315]" size={18} /><div><p className="text-slate-500">Alamat Lengkap</p><p className="mt-1 font-medium text-ink">{selectedVillage.address}</p></div></div>
                    <div className="flex gap-3"><Landmark className="mt-0.5 shrink-0 text-[#D84315]" size={18} /><div><p className="text-slate-500">Cabang Pendamping</p><p className="mt-1 font-medium text-ink">{selectedVillage.branch}</p></div></div>
                    <div className="flex gap-3"><Users className="mt-0.5 shrink-0 text-[#D84315]" size={18} /><div><p className="text-slate-500">Peserta Program</p><p className="mt-1 font-medium text-ink">{selectedVillage.participants > 0 ? `${formatNumber(selectedVillage.participants)} orang` : "Belum tersedia di spreadsheet"}</p></div></div>
                    <div className="flex gap-3"><BadgeCheck className="mt-0.5 shrink-0 text-[#D84315]" size={18} /><div><p className="text-slate-500">Status Desa</p><p className="mt-1 font-medium text-ink">{selectedVillage.status}</p></div></div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 p-5"><h3 className="font-semibold text-ink">Program Berjalan</h3><div className="mt-4 flex flex-wrap gap-2">{selectedVillage.programs.map((program) => <span key={program} className="rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-[#D84315]">{program}</span>)}</div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 p-5"><div className="flex items-center gap-2"><Camera size={18} className="text-[#D84315]" /><h3 className="font-semibold text-ink">Dokumentasi</h3></div><div className="mt-4 space-y-3">{selectedVillage.documentation.length > 0 ? selectedVillage.documentation.map((item) => <div key={item.title}><p className="text-sm font-medium text-ink">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.category} · {item.date}</p></div>) : <p className="text-sm text-slate-500">Belum tersedia di spreadsheet.</p>}</div></div>
                  <div className="rounded-2xl border border-slate-100 p-5"><div className="flex items-center gap-2"><Newspaper size={18} className="text-[#D84315]" /><h3 className="font-semibold text-ink">Rilis Berita</h3></div><div className="mt-4 space-y-3">{selectedVillage.news.length > 0 ? selectedVillage.news.map((item) => <div key={item.title}><p className="text-sm font-medium text-ink">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.category} · {item.date}</p></div>) : <p className="text-sm text-slate-500">Belum tersedia di spreadsheet.</p>}</div></div>
                </div>
              </div>
              <div className="rounded-2xl bg-[#0D1B2A] p-5 text-white"><p className="text-xs font-semibold uppercase tracking-wider text-white/60">Relawan Inspirasi</p><div className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">{selectedVillage.volunteer.name.split(" ").map((name) => name[0]).slice(0, 2).join("")}</div><h3 className="mt-4 font-semibold">{selectedVillage.volunteer.name}</h3><p className="mt-1 text-sm text-white/65">{selectedVillage.volunteer.role}{selectedVillage.volunteer.since > 0 ? ` sejak ${selectedVillage.volunteer.since}` : ""}</p><div className="mt-6 border-t border-white/10 pt-4"><p className="flex items-center gap-2 text-sm text-white/75"><Phone size={15} /> {selectedVillage.volunteer.phone}</p><p className="mt-4 flex items-center gap-2 text-sm text-white/75"><CalendarDays size={15} /> Status: {selectedVillage.status}</p></div></div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
