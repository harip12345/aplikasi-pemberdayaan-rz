export type PeriodBehavior = "flow" | "snapshot" | "cumulative" | "not_applicable";
export type AggregationRule = "sum" | "count_rows" | "count_valid_rows" | "sum_column";

export type MetricDefinition = {
  id: string;
  label: string;
  source: string;
  summarySource?: "dashboard";
  description: string;
  unit: string;
  aggregation: AggregationRule;
  periodBehavior: PeriodBehavior;
  aliases: readonly string[];
  dimensions: readonly string[];
  formula: string;
  searchHints: readonly string[];
  notes: string;
};

export const METRIC_DICTIONARY: readonly MetricDefinition[] = [
  {
    id: "dashboard-metric", label: "Indikator Dashboard", source: "dashboard",
    description: "Target tahunan dan capaian bulanan seluruh Objectif and Key Result program.", unit: "sesuai indikator", aggregation: "sum", periodBehavior: "flow",
    aliases: ["dashboard", "target", "capaian", "okr", "objectif and key result", "objective and key result"],
    dimensions: ["indikator", "bulan", "tahun"], formula: "Target diambil satu kali; capaian = SUM nilai bulanan pada rentang terpilih.",
    searchHints: ["target program", "capaian bulan", "persentase capaian"], notes: "Nilai kosong dibedakan dari nol.",
  },
  {
    id: "peserta-program", label: "Peserta Program", source: "participants", summarySource: "dashboard",
    description: "Jumlah penerima program pada kombinasi periode, wilayah, program, subprogram, dan asnaf.", unit: "peserta", aggregation: "sum", periodBehavior: "flow",
    aliases: ["pp", "pm", "penerima manfaat", "peserta", "peserta program", "peserta manfaat"],
    dimensions: ["tahun", "bulan", "provinsi", "kota/kab", "cabang", "program", "subprogram", "asnaf"],
    formula: "SUM kolom JUMLAH pada seluruh baris yang sesuai filter; bukan COUNT baris dan bukan nama unik.",
    searchHints: ["pm vokasi", "peserta ambulans", "pp pendidikan", "penerima manfaat ramadhan", "peserta per cabang"], notes: "Istilah program yang tidak lengkap dicocokkan ke PROGRAM dan SUB PROGRAM.",
  },
  {
    id: "desa-berdaya", label: "Desa Berdaya", source: "distribution", summarySource: "dashboard",
    description: "Portofolio desa pemberdayaan beserta status, tipe desa, wilayah, cabang, fasilitator, dan program.", unit: "desa", aggregation: "count_rows", periodBehavior: "snapshot",
    aliases: ["desber", "desa berdaya", "desbin", "desa binaan", "sister village", "desa kolaborasi"],
    dimensions: ["provinsi", "kota/kab", "kecamatan", "desa", "cabang", "status", "tipe desa", "program"],
    formula: "COUNT desa yang sesuai filter. Desa aktif = COUNT dengan status Aktif. Titik program = SUM jumlah unit pada relasi desa-program; nilai seperti 2 BUMMas dihitung sebagai dua unit.",
    searchHints: ["desa aktif jawa barat", "desber hibernasi", "desa dengan rumah vokasi", "program desa berdaya"], notes: "Sumber detail adalah sheet sebaran; target/capaian ringkas tetap tersedia di Dashboard.",
  },
  {
    id: "bummas", label: "BUMMas", source: "bummas", summarySource: "dashboard",
    description: "Badan Usaha Milik Masyarakat atau unit bisnis dalam portofolio pemberdayaan.", unit: "unit", aggregation: "count_valid_rows", periodBehavior: "snapshot",
    aliases: ["bummas", "badan usaha milik masyarakat", "unit bisnis", "usaha masyarakat"],
    dimensions: ["nama unit", "desa", "kecamatan", "kota/kab", "provinsi", "cabang", "bidang usaha", "status"],
    formula: "COUNT seluruh baris dengan Bidang Usaha/Program terisi; nama unit tidak dibuat unik. Jumlah anggota = SUM kolom Jumlah Anggota.",
    searchHints: ["bummas aktif", "bidang usaha bummas", "jumlah anggota bummas", "mikrobisnis"], notes: "Micro bisnis, Microbisnis, Micobisnis, dan Mikrobisnis dinormalisasi menjadi Mikrobisnis.",
  },
  {
    id: "muzzaki", label: "Muzaki", source: "muzzaki", summarySource: "dashboard",
    description: "Peserta program yang berkembang menjadi pemberi zakat.", unit: "orang", aggregation: "count_rows", periodBehavior: "flow",
    aliases: ["muzaki", "muzzaki", "muzakki", "menjadi muzaki"],
    dimensions: ["bulan", "cabang", "desa", "kecamatan", "kota/kab", "provinsi", "program", "jenis usaha", "produk usaha", "sumber"],
    formula: "COUNT seluruh baris peserta valid; nilai peningkatan dapat dihitung dengan SUM atau AVG kolom Peningkatan jika diminta.",
    searchHints: ["muzaki per provinsi", "muzaki per program", "peningkatan muzaki"], notes: "Ejaan keluaran diseragamkan menjadi Muzaki.",
  },
  {
    id: "munfik", label: "Munfik", source: "munfik", summarySource: "dashboard",
    description: "Peserta yang menjadi munfik dari blok Empowerment, Progdis, atau Dakwah.", unit: "orang", aggregation: "count_valid_rows", periodBehavior: "flow",
    aliases: ["munfik", "munfiq", "orang berinfak", "menjadi munfik"],
    dimensions: ["bulan", "sumber", "cabang/kantor", "kota/kab", "provinsi", "program"],
    formula: "COUNT baris valid Empowerment dan Progdis, ditambah SUM Capaian bulanan Dakwah; bukan BNBA, baris Total, nama unik, atau SUM nominal.",
    searchHints: ["munfik per sumber", "munfik empowerment", "munfik sampai juli"], notes: "Ejaan keluaran diseragamkan menjadi Munfik.",
  },
  {
    id: "garis-kemiskinan", label: "Peserta Keluar Garis Kemiskinan", source: "garis-kemiskinan", summarySource: "dashboard",
    description: "Peserta yang mengalami peningkatan hingga keluar dari standar garis kemiskinan.", unit: "orang", aggregation: "count_rows", periodBehavior: "flow",
    aliases: ["gk", "keluar gk", "keluar garis kemiskinan", "mustahik keluar kemiskinan"],
    dimensions: ["bulan", "cabang", "desa", "kecamatan", "kota/kab", "provinsi", "program", "jenis usaha", "produk usaha"],
    formula: "Capaian resmi = SUM capaian bulanan Dashboard/rekap. Detail peserta = COUNT baris valid. Growth = (capaian tahun ini - tahun lalu) / tahun lalu × 100%.",
    searchHints: ["capaian gk", "gk per divisi", "gk per program", "keluar kemiskinan per provinsi"], notes: "Data GK berasal dari empat blok divisi pada sheet PM GK; rekap bulanan dijumlahkan dari blok yang sama.",
  },
  {
    id: "pp-terbina", label: "Peserta Program Terbina", source: "pp-terbina", summarySource: "dashboard",
    description: "Peserta yang memperoleh pembinaan program secara berkelanjutan.", unit: "orang", aggregation: "count_rows", periodBehavior: "flow",
    aliases: ["pp terbina", "peserta terbina", "pm terbina", "penerima manfaat terbina"],
    dimensions: ["bulan awal program", "desa", "kecamatan", "kota/kab", "provinsi", "cabang", "base program"],
    formula: "COUNT seluruh baris peserta valid; pengelompokan dapat dilakukan menurut periode awal, wilayah, cabang, atau base program.",
    searchHints: ["pp terbina per cabang", "peserta terbina per program"], notes: "Capaian ringkas dibandingkan dengan COUNT detail untuk rekonsiliasi.",
  },
  {
    id: "mualaf", label: "Mualaf", source: "mualaf", summarySource: "dashboard",
    description: "Peserta mualaf yang memperoleh pendampingan atau pembinaan.", unit: "orang", aggregation: "count_valid_rows", periodBehavior: "flow",
    aliases: ["mualaf", "muallaf", "peserta mualaf"],
    dimensions: ["bulan informasi", "kota/kab", "provinsi", "jenis kelamin", "asnaf", "cabang", "base program", "islamisasi", "mitra/relawan inspirasi"],
    formula: "COUNT seluruh baris dengan kolom Nama PM terisi; nama tidak dibuat unik.",
    searchHints: ["mualaf per provinsi", "mualaf berdasarkan gender", "mualaf per base program"], notes: "Kolom Nama PM menjadi syarat valid agar hitungan konsisten dengan capaian.",
  },
  {
    id: "kinerja-peserta-program", label: "Kinerja Peserta Program", source: "participant-analysis",
    description: "Target, capaian, history, persentase target, growth, kontribusi, dan tren PP/PLP per program atau divisi.", unit: "peserta", aggregation: "sum", periodBehavior: "cumulative",
    aliases: ["analisa pp", "analisis pp", "kinerja pp", "growth pp", "target pp", "capaian per divisi", "capaian per program"],
    dimensions: ["program", "divisi", "bulan", "tahun", "jenis peserta PP/PLP"],
    formula: "Periode PP = SUM target, capaian, dan history bulanan. % target = total capaian / total target. Growth = (total capaian - total history) / total history. Kolom akumulasi dan tahunan hanya diambil dari snapshot bulan terakhir.",
    searchHints: ["program dengan growth tertinggi", "divisi paling tertinggal", "tren bulanan pp", "gap target peserta program"], notes: "Sumber bulanan tersedia untuk PP. PLP memakai ringkasan keseluruhan karena sumber bulanan PLP belum tersedia.",
  },
  {
    id: "dampak-vokasi", label: "Dampak Program Vokasi", source: "vokasi-impact",
    description: "Peserta vokasi yang terserap kerja atau membuka usaha.", unit: "peserta", aggregation: "count_valid_rows", periodBehavior: "snapshot",
    aliases: ["terserap kerja", "wirausaha", "berwirausaha", "dampak vokasi"], dimensions: ["status hasil", "tahun"],
    formula: "COUNT baris peserta valid berdasarkan kolom Terserap Kerja/Membuka Usaha.", searchHints: ["peserta vokasi terserap kerja", "peserta vokasi berwirausaha"], notes: "Filter wilayah hanya digunakan bila sumber menyediakan detail lokasi.",
  },
  {
    id: "pp-hafidz", label: "Peserta Program Hafidz", source: "hafidz-impact",
    description: "Peserta program yang mencapai hafalan 30 juz.", unit: "peserta", aggregation: "count_valid_rows", periodBehavior: "snapshot",
    aliases: ["hafidz", "hafiz", "30 juz", "pp hafidz"], dimensions: ["peserta", "capaian hafalan"],
    formula: "COUNT baris dengan Nama PP terisi dan kolom Hafidz menyatakan 30 juz.", searchHints: ["jumlah hafidz 30 juz"], notes: "Tidak menggunakan jumlah nama unik kecuali sumber mendefinisikannya demikian.",
  },
  {
    id: "dampak-lingkungan", label: "Dampak Program Lingkungan", source: "environment-impact",
    description: "Lokasi Bank Sampah dan Mangrove pada sumber dampak lingkungan.", unit: "lokasi", aggregation: "count_valid_rows", periodBehavior: "snapshot",
    aliases: ["bank sampah", "mangrove", "program lingkungan"], dimensions: ["desa", "kecamatan", "kota/kab", "provinsi", "cabang", "program"],
    formula: "Bank Sampah = COUNT baris valid pada kolom U. Mangrove = COUNT baris valid pada kolom V.", searchHints: ["bank sampah per provinsi", "lokasi mangrove"], notes: "Rincian wilayah tersedia bila kolom lokasi terisi.",
  },
  {
    id: "masjid-berdaya", label: "Masjid Berdaya", source: "distribution",
    description: "Desa yang menjalankan intervensi Masjid Berdaya.", unit: "titik program", aggregation: "count_valid_rows", periodBehavior: "snapshot",
    aliases: ["masjid berdaya", "program masjid"], dimensions: ["desa", "kecamatan", "kota/kab", "provinsi", "cabang", "status desa", "relawan inspirasi"],
    formula: "COUNT baris Desa Berdaya dengan kolom Masjid Berdaya terisi.", searchHints: ["masjid berdaya per provinsi", "desa dengan masjid berdaya"], notes: "Sumber sama dengan Sebaran Desa Berdaya.",
  },
  {
    id: "peserta-layanan-program", label: "Peserta Layanan Program", source: "dashboard",
    description: "Jumlah layanan program yang tercatat pada ringkasan Dashboard.", unit: "layanan", aggregation: "sum", periodBehavior: "flow",
    aliases: ["plp", "peserta layanan program", "layanan program"],
    dimensions: ["bulan", "tahun"], formula: "SUM capaian bulanan indikator PLP pada periode terpilih.",
    searchHints: ["jumlah plp", "layanan program per bulan"], notes: "Tidak disamakan dengan jumlah orang atau Peserta Program.",
  },
] as const;

const TERM_ALIASES: Record<string, string> = {
  muzzaki: "muzaki", muzakki: "muzaki", munfiq: "munfik", muallaf: "mualaf",
  pm: "peserta program", pp: "peserta program", desber: "desa berdaya", desbin: "desa binaan",
  jaksel: "jakarta selatan", jakpus: "jakarta pusat", jakbar: "jakarta barat", jaktim: "jakarta timur", jakut: "jakarta utara",
  "micro bisnis": "mikrobisnis", microbisnis: "mikrobisnis", micobisnis: "mikrobisnis", "mikro bisnis": "mikrobisnis",
  jabar: "jawa barat", jateng: "jawa tengah", jatim: "jawa timur", diy: "di yogyakarta", ntb: "nusa tenggara barat", ntt: "nusa tenggara timur",
};

export function normalizeSearchText(value: string) {
  let normalized = value.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[–—_/&]+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/^\d+\s+/, "").replace(/\s+/g, " ").trim();
  for (const [alias, canonical] of Object.entries(TERM_ALIASES).sort((a, b) => b[0].length - a[0].length)) {
    normalized = normalized.replace(new RegExp("\\b" + alias + "\\b", "gu"), canonical);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

export function normalizeDataTerm(value: string) {
  const normalized = normalizeSearchText(value);
  return normalized.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("id-ID"));
}

const SEARCH_STOP_WORDS = new Set(["berapa", "jumlah", "total", "data", "orang", "peserta", "program", "penerima", "manfaat", "mustahik", "pm", "pp", "kota", "kab", "kabupaten", "wilayah", "yang", "di", "ke", "dari", "untuk", "pada"]);

export function dataSearchTokens(value: string) {
  return normalizeSearchText(value).split(" ").filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
}

export function matchesDataTerm(value: string, expected?: string) {
  if (!expected?.trim()) return true;
  const haystack = normalizeSearchText(value);
  const needle = normalizeSearchText(expected);
  if (!haystack || !needle) return false;
  if (haystack === needle || haystack.includes(needle) || needle.includes(haystack)) return true;
  const tokens = dataSearchTokens(expected);
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

export function findMetricDefinition(value: string) {
  const normalized = normalizeSearchText(value);
  return METRIC_DICTIONARY.find((metric) => metric.id === normalized || normalizeSearchText(metric.label) === normalized || metric.aliases.some((alias) => normalizeSearchText(alias) === normalized));
}
