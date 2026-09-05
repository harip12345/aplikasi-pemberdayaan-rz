export type VillageStatus = "Aktif" | "Hibernasi" | "Graduasi" | "Tidak diketahui";
export type VillageType = "Desber" | "Desbin" | "Sister Village" | "Desa Kolaborasi" | "Tidak diketahui";

export type VillageProfile = {
  id: string;
  name: string;
  provinceId: string;
  regency: string;
  district: string;
  address: string;
  branch: string;
  volunteer: {
    name: string;
    role: string;
    phone: string;
    since: number;
  };
  programs: string[];
  participants: number;
  status: VillageStatus;
  villageType: VillageType;
  coordinates: [number, number];
  documentation: { title: string; date: string; category: string }[];
  news: { title: string; date: string; category: string }[];
};

export type ProvinceDistribution = {
  id: string;
  name: string;
  center: [number, number];
  count: number;
  activeCount: number;
  branch: string;
  villages: VillageProfile[];
};

export type ServiceUnit = {
  id: string;
  name: string;
  province: string;
  city: string;
  type: "Kantor Cabang" | "Kantor Perwakilan" | "Unit Layanan";
  address: string;
  coordinator: string;
  beneficiaries: number;
  status: "Aktif" | "Nonaktif";
  coordinates: [number, number];
};

const provinceSeeds = [
  ["aceh", "Aceh", 5.55, 95.32, 45, "Cabang Aceh"],
  ["sumatera-utara", "Sumatera Utara", 2.12, 99.52, 75, "Cabang Medan"],
  ["sumatera-barat", "Sumatera Barat", -0.95, 100.35, 55, "Cabang Padang"],
  ["riau", "Riau", 0.51, 101.45, 50, "Cabang Pekanbaru"],
  ["kepulauan-riau", "Kepulauan Riau", 1.05, 104.03, 25, "Perwakilan Kepulauan Riau"],
  ["jambi", "Jambi", -1.61, 103.61, 35, "Perwakilan Jambi"],
  ["sumatera-selatan", "Sumatera Selatan", -3.32, 104.91, 60, "Cabang Palembang"],
  ["bangka-belitung", "Kepulauan Bangka Belitung", -2.74, 106.44, 20, "Perwakilan Bangka Belitung"],
  ["bengkulu", "Bengkulu", -3.8, 102.26, 30, "Perwakilan Bengkulu"],
  ["lampung", "Lampung", -5.43, 105.26, 55, "Cabang Bandar Lampung"],
  ["banten", "Banten", -6.4, 106.06, 50, "Cabang Banten"],
  ["dki-jakarta", "DKI Jakarta", -6.21, 106.85, 15, "Cabang Jakarta"],
  ["jawa-barat", "Jawa Barat", -6.92, 107.62, 190, "Regional Jawa Barat"],
  ["jawa-tengah", "Jawa Tengah", -7.15, 110.14, 185, "Regional Jawa Tengah"],
  ["di-yogyakarta", "DI Yogyakarta", -7.8, 110.37, 30, "Cabang Yogyakarta"],
  ["jawa-timur", "Jawa Timur", -7.54, 112.24, 210, "Regional Jawa Timur"],
  ["bali", "Bali", -8.41, 115.19, 30, "Perwakilan Bali"],
  ["nusa-tenggara-barat", "Nusa Tenggara Barat", -8.65, 117.36, 40, "Cabang Mataram"],
  ["nusa-tenggara-timur", "Nusa Tenggara Timur", -8.66, 121.08, 55, "Perwakilan NTT"],
  ["kalimantan-barat", "Kalimantan Barat", -0.28, 111.48, 45, "Cabang Pontianak"],
  ["kalimantan-tengah", "Kalimantan Tengah", -1.68, 113.38, 30, "Perwakilan Kalimantan Tengah"],
  ["kalimantan-selatan", "Kalimantan Selatan", -3.09, 115.28, 40, "Cabang Banjarmasin"],
  ["kalimantan-timur", "Kalimantan Timur", 0.54, 116.42, 35, "Cabang Balikpapan"],
  ["kalimantan-utara", "Kalimantan Utara", 3.07, 116.04, 15, "Perwakilan Kalimantan Utara"],
  ["sulawesi-utara", "Sulawesi Utara", 0.62, 123.98, 30, "Cabang Manado"],
  ["gorontalo", "Gorontalo", 0.7, 122.45, 20, "Perwakilan Gorontalo"],
  ["sulawesi-tengah", "Sulawesi Tengah", -1.43, 121.45, 35, "Cabang Palu"],
  ["sulawesi-barat", "Sulawesi Barat", -2.84, 119.23, 25, "Perwakilan Sulawesi Barat"],
  ["sulawesi-selatan", "Sulawesi Selatan", -3.67, 119.97, 75, "Regional Sulawesi Selatan"],
  ["sulawesi-tenggara", "Sulawesi Tenggara", -4.14, 122.17, 30, "Cabang Kendari"],
  ["maluku", "Maluku", -3.24, 130.15, 25, "Perwakilan Maluku"],
  ["maluku-utara", "Maluku Utara", 1.57, 127.81, 20, "Perwakilan Maluku Utara"],
  ["papua-barat-daya", "Papua Barat Daya", -1.34, 131.23, 10, "Perwakilan Papua Barat Daya"],
  ["papua-barat", "Papua Barat", -1.34, 133.17, 15, "Perwakilan Papua Barat"],
  ["papua-tengah", "Papua Tengah", -3.65, 136.45, 12, "Perwakilan Papua Tengah"],
  ["papua-pegunungan", "Papua Pegunungan", -4.08, 138.95, 10, "Perwakilan Papua Pegunungan"],
  ["papua-selatan", "Papua Selatan", -7.42, 139.67, 8, "Perwakilan Papua Selatan"],
  ["papua", "Papua", -2.53, 140.72, 18, "Cabang Jayapura"],
] as const;

const villagePrefixes = ["Sukamaju", "Mekarjaya", "Harapan", "Sejahtera", "Makmur", "Mandiri", "Bersama", "Mulyasari", "Sumber Rezeki", "Karya Bakti"];
const regencyPrefixes = ["Kabupaten Utara", "Kabupaten Selatan", "Kabupaten Barat", "Kabupaten Timur", "Kabupaten Tengah"];
const programPool = ["Pemberdayaan Ekonomi", "Bummas", "Ramah Lansia", "Pendidikan Berdaya", "Kesehatan Masyarakat", "Ketahanan Pangan", "Lingkungan Lestari"];
const volunteerNames = ["Ahmad Fauzan", "Siti Rahmawati", "Muhammad Rizki", "Nur Aisyah", "Fajar Hidayat", "Dewi Lestari", "Ridwan Kamil", "Fitri Handayani"];

function createVillages(provinceId: string, provinceName: string, count: number, center: [number, number], branch: string) {
  return Array.from({ length: count }, (_, index): VillageProfile => {
    const number = index + 1;
    const status: VillageStatus = number % 11 === 0 ? "Hibernasi" : "Aktif";
    const latitude = center[0] + ((index % 7) - 3) * 0.055;
    const longitude = center[1] + ((index % 9) - 4) * 0.065;
    const villageName = `Desa ${villagePrefixes[index % villagePrefixes.length]} ${number}`;
    const programs = [
      programPool[index % programPool.length],
      programPool[(index + 2) % programPool.length],
      ...(index % 3 === 0 ? [programPool[(index + 4) % programPool.length]] : []),
    ];

    return {
      id: `${provinceId}-${number}`,
      name: villageName,
      provinceId,
      regency: regencyPrefixes[index % regencyPrefixes.length],
      district: `Kecamatan ${villagePrefixes[(index + 3) % villagePrefixes.length]}`,
      address: `Jl. Pemberdayaan No. ${number}, RT ${String((index % 9) + 1).padStart(2, "0")}/RW ${String((index % 6) + 1).padStart(2, "0")}, ${villageName}, ${provinceName}`,
      branch,
      volunteer: {
        name: volunteerNames[index % volunteerNames.length],
        role: "Relawan Inspirasi",
        phone: `08${String(1200000000 + index * 173 + provinceName.length * 29).slice(0, 10)}`,
        since: 2019 + (index % 6),
      },
      programs,
      participants: 45 + ((index * 37 + provinceName.length * 11) % 540),
      status,
      villageType: "Desber",
      coordinates: [Number(latitude.toFixed(5)), Number(longitude.toFixed(5))],
      documentation: [
        { title: "Pendampingan kelompok usaha", date: "12 Juli 2026", category: "Ekonomi" },
        { title: "Pertemuan warga dan relawan", date: "28 Juni 2026", category: "Komunitas" },
        { title: "Monitoring program desa", date: "14 Mei 2026", category: "Monitoring" },
      ],
      news: [
        { title: `${villageName} memperkuat usaha keluarga`, date: "10 Juli 2026", category: "Ekonomi" },
        { title: `Kolaborasi warga ${provinceName} perluas dampak program`, date: "22 Mei 2026", category: "Pemberdayaan" },
      ],
    };
  });
}

export const provinceDistributions: ProvinceDistribution[] = provinceSeeds.map(([id, name, latitude, longitude, count, branch]) => {
  const villages = createVillages(id, name, count, [latitude, longitude], branch);
  return {
    id,
    name,
    center: [latitude, longitude],
    count,
    activeCount: villages.filter((village) => village.status === "Aktif").length,
    branch,
    villages,
  };
});

export const serviceUnits: ServiceUnit[] = provinceSeeds.flatMap(([provinceId, province, latitude, longitude, , branch], provinceIndex) => {
  const unitCount = provinceIndex % 4 === 0 ? 2 : 1;
  return Array.from({ length: unitCount }, (_, index) => ({
    id: `unit-${provinceId}-${index + 1}`,
    name: index === 0 ? branch : `Unit Layanan ${province} ${index + 1}`,
    province,
    city: `Kota Layanan ${province}`,
    type: index === 0 ? (provinceIndex % 3 === 0 ? "Kantor Cabang" : "Kantor Perwakilan") : "Unit Layanan",
    address: `Jl. Manfaat Hebat No. ${provinceIndex + index + 1}, ${province}`,
    coordinator: volunteerNames[(provinceIndex + index) % volunteerNames.length],
    beneficiaries: 720 + ((provinceIndex * 241 + index * 113) % 5600),
    status: provinceIndex % 13 === 0 && index === 1 ? "Nonaktif" : "Aktif",
    coordinates: [latitude + index * 0.14, longitude + index * 0.17] as [number, number],
  }));
});

export const totalEmpoweredVillages = provinceDistributions.reduce((sum, province) => sum + province.count, 0);
export const totalServiceUnits = serviceUnits.length;
