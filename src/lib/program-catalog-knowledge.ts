export type CatalogSector = "Umum" | "Ekonomi" | "Kesehatan" | "Pendidikan" | "Lingkungan dan Kebencanaan" | "Sosial";

export type ProgramCatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  sector: CatalogSector;
  description: string;
  objectives: string[];
  beneficiaries: string[];
  implementation: string[];
  location: string;
  capacity: string;
  duration: string;
  cost: string;
  impact2025?: string[];
  catalogPages: string;
};

export const PROGRAM_CATALOG_SOURCE = {
  label: "Katalog Program Rumah Zakat 2026",
  documentName: "Katalog Program Rumah Zakat 2026.pdf",
  issuedYear: 2026,
};

export const PROGRAM_CATALOG: ProgramCatalogEntry[] = [
  {
    id: "desa-berdaya", name: "Desa Berdaya", aliases: ["desber", "desa binaan"], sector: "Umum",
    description: "Proses pemberdayaan wilayah binaan berdasarkan pemetaan potensi lokal di bidang ekonomi, pendidikan, kesehatan, lingkungan dan kebencanaan, serta sosial.",
    objectives: ["Memperbaiki kualitas hidup individu dan komunitas melalui pemberdayaan berlandaskan nilai kemanusiaan universal."],
    beneficiaries: ["Individu dan komunitas masyarakat di wilayah binaan."],
    implementation: ["Pemetaan potensi lokal", "Pendampingan dan pemberdayaan", "Penggerakan lingkungan", "Advokasi masyarakat"],
    location: "Wilayah Desa Berdaya Rumah Zakat", capacity: "Akumulasi 1.751 titik per Desember 2025", duration: "Berkelanjutan", cost: "Bergantung pada program intervensi",
    catalogPages: "5",
  },
  {
    id: "bursa", name: "BURSA (Bantuan Kewirausahaan UMKM)", aliases: ["bantuan kewirausahaan umkm", "umkm", "usaha non agro"], sector: "Ekonomi",
    description: "Pemberdayaan ekonomi berbasis potensi lokal bagi pelaku usaha mikro dan kecil perorangan dalam sektor non-agro/UMKM.",
    objectives: ["Meningkatkan perekonomian pelaku usaha di Desa Berdaya."],
    beneficiaries: ["Pelaku usaha mikro dan kecil non-agro/UMKM", "Usaha telah berjalan minimal 3 bulan", "Pelaku berada pada usia produktif"],
    implementation: ["Sosialisasi dan need assessment", "Enam kali pelatihan dan edukasi kewirausahaan", "Modal dan sarana usaha", "Soft launching", "Pendampingan berkala", "Monitoring dan evaluasi"],
    location: "Desa Berdaya Rumah Zakat", capacity: "6 Peserta Program", duration: "12 bulan", cost: "Rp85.000.000 atau donasi gabungan sesuai kemampuan", catalogPages: "7",
  },
  {
    id: "tani-berdaya", name: "Tani Berdaya (Bantuan Kewirausahaan Agro)", aliases: ["bantuan kewirausahaan agro", "pertanian", "peternakan", "perikanan"], sector: "Ekonomi",
    description: "Pemberdayaan ekonomi berbasis potensi pertanian, peternakan, atau perikanan untuk menyejahterakan petani di Desa Berdaya.",
    objectives: ["Meningkatkan perekonomian petani Desa Berdaya, khususnya pelaku usaha agro."],
    beneficiaries: ["Pelaku usaha mikro dan kecil bidang agro", "Usaha telah berjalan minimal 3 bulan", "Pelaku berada pada usia produktif"],
    implementation: ["Sosialisasi dan need assessment", "Enam kali edukasi wirausaha", "Bantuan bibit/benih, pupuk/pakan, atau modal usaha", "Advokasi legalitas kelompok", "Pendampingan", "Monitoring dan evaluasi"],
    location: "Desa Berdaya Rumah Zakat", capacity: "6 Peserta Program", duration: "12 bulan", cost: "Rp95.000.000 atau donasi gabungan sesuai kemampuan", catalogPages: "8",
  },
  {
    id: "bummas", name: "Badan Usaha Milik Masyarakat (BUMMas)", aliases: ["bummas", "badan usaha masyarakat", "social enterprise", "microfinance"], sector: "Ekonomi",
    description: "Pemberdayaan ekonomi berbasis kelompok melalui pembentukan kerangka kelembagaan social enterprise untuk memperkuat ekonomi masyarakat dan keberlanjutan Desa Berdaya.",
    objectives: ["Membentuk kelembagaan dan usaha kelompok yang melahirkan social enterprise serta kemandirian Desa Berdaya."],
    beneficiaries: ["Kelompok dengan usaha berkelanjutan dan berpotensi dikembangkan pada agro, mikro bisnis, atau mikrofinansial"],
    implementation: ["Sosialisasi dan need assessment", "Enam kali edukasi wirausaha", "Modal dan sarana kelompok", "Soft launching", "Pendampingan", "Monitoring dan evaluasi"],
    location: "Desa Berdaya Rumah Zakat", capacity: "10 Peserta Program", duration: "12 bulan", cost: "Rp175.000.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["21% peserta keluar dari garis kemiskinan", "58% peserta mengalami peningkatan pendapatan", "2.909 UMKM diberdayakan", "1.112 petani, 283 peternak, dan 8 nelayan diberdayakan", "373 institusi ekonomi dibentuk: 154 agro bisnis, 113 mikro bisnis, dan 106 mikrofinansial"], catalogPages: "9-10",
  },
  {
    id: "desa-bebas-stunting", name: "Desa Bebas Stunting", aliases: ["bebas stunting", "rumah gizi", "kader stunting"], sector: "Kesehatan",
    description: "Penguatan masyarakat dan kader kesehatan desa untuk memenuhi gizi serta mengurangi faktor infeksi keluarga dengan risiko stunting.",
    objectives: ["Meningkatkan kompetensi kader", "Membentuk masyarakat peduli stunting", "Meningkatkan status gizi balita", "Mencegah kasus stunting baru"],
    beneficiaries: ["Baduta", "Balita", "Kader kesehatan", "Ibu hamil/menyusui", "Pasangan usia subur", "Remaja", "Keluarga berisiko stunting"],
    implementation: ["12 kelas bebas stunting", "6 pelatihan kader", "Pemantauan tumbuh kembang", "Rumah Gizi", "Dukungan gizi", "Kebun Gizi", "Home visit dan kolaborasi Posyandu"],
    location: "Desa Berdaya Rumah Zakat", capacity: "Sekitar 80 baduta, menyesuaikan kebutuhan", duration: "12 bulan", cost: "Rp150.000.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["269 Posyandu dibina", "1.560 kader Posyandu", "3.271 baduta dan 10.633 balita diintervensi", "1.372 balita atau 42% mengalami peningkatan status gizi", "2.426 ibu diintervensi"], catalogPages: "12, 17",
  },
  {
    id: "toilet-sehat-keluarga", name: "Toilet Sehat Keluarga", aliases: ["jamban sehat", "sanitasi keluarga"], sector: "Kesehatan",
    description: "Penyediaan jamban sehat bagi keluarga dhuafa dengan masalah gizi akibat faktor infeksi untuk meningkatkan kualitas sanitasi keluarga.",
    objectives: ["Menyediakan satu jamban sehat keluarga."],
    beneficiaries: ["Keluarga balita dengan masalah gizi akibat infeksi", "Pasangan muda usia subur dengan ekonomi kurang"],
    implementation: ["Pemicuan dan edukasi", "Penyediaan satu jamban sehat", "Pendampingan tiga bulan setelah jamban terbentuk"],
    location: "Desa Berdaya Rumah Zakat", capacity: "1 unit akses air bersih atau jamban sehat", duration: "3 bulan pendampingan", cost: "Rp15.000.000 atau donasi gabungan sesuai kemampuan", catalogPages: "13",
  },
  {
    id: "bapak-asuh-anak-stunting", name: "Bapak Asuh Anak Stunting", aliases: ["baas", "orang tua asuh stunting"], sector: "Kesehatan",
    description: "Program gotong royong untuk keluarga berisiko stunting melalui bantuan yang disesuaikan dengan penyebab malnutrisi.",
    objectives: ["Membebaskan keluarga berisiko stunting dari ancaman stunting di wilayah intervensi."],
    beneficiaries: ["Baduta berisiko stunting", "Ibu hamil dari keluarga berisiko", "Baduta stunting"],
    implementation: ["Assessment penyebab malnutrisi", "Pemberian makanan tambahan empat kali", "Pendampingan dan pemantauan tumbuh kembang selama enam bulan"],
    location: "Desa Berdaya Rumah Zakat", capacity: "1 baduta dan orang tua, atau 1 ibu hamil dari keluarga berisiko", duration: "6 bulan", cost: "Rp6.000.000 atau donasi gabungan sesuai kemampuan", catalogPages: "14",
  },
  {
    id: "desa-ramah-lansia", name: "Desa Ramah Lansia", aliases: ["ramah lansia", "taman lansia", "sahabat lansia"], sector: "Kesehatan",
    description: "Pemberdayaan yang menyediakan lingkungan sosial dan fisik agar masyarakat lanjut usia tetap sehat, aktif, dan produktif.",
    objectives: ["Meningkatkan kompetensi kader dan kepedulian masyarakat", "Meningkatkan kualitas hidup serta kebahagiaan lansia", "Mewujudkan desa ramah lansia"],
    beneficiaries: ["Pra-lansia 45-60 tahun", "Lansia di atas 60 tahun", "Kader kesehatan", "Keluarga lansia"],
    implementation: ["Peralatan kesehatan", "Pemeriksaan kesehatan", "Taman dan Kebun Gizi Lansia", "Pelatihan kader", "Kelas dan senam lansia", "Dukungan gizi dan psikososial", "Pendampingan"],
    location: "Desa Berdaya Rumah Zakat", capacity: "50 Peserta Program", duration: "12 bulan", cost: "Rp122.000.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["58% peserta dalam kondisi pra-hipertensi", "67% memiliki kolesterol normal", "94% memiliki glukosa normal", "56% memiliki asam urat normal"], catalogPages: "15, 17",
  },
  {
    id: "bantuan-kebutuhan-harian-lansia", name: "Bantuan Kebutuhan Harian Lansia", aliases: ["bantuan lansia", "kebutuhan lansia"], sector: "Kesehatan",
    description: "Bantuan kebutuhan harian bagi lansia dengan keterbatasan aktivitas dan kesulitan memenuhi kebutuhan pangan.",
    objectives: ["Membantu memenuhi kebutuhan harian lansia."], beneficiaries: ["Lansia dhuafa berusia di atas 60 tahun"],
    implementation: ["Pemberian bahan pokok, protein hewani, sayur, dan/atau buah sesuai kebutuhan lansia"],
    location: "Wilayah binaan Rumah Zakat", capacity: "1 lansia", duration: "12 bulan", cost: "Rp14.000.000 atau donasi gabungan sesuai kemampuan", catalogPages: "16",
  },
  {
    id: "siap-setara", name: "Siap Setara (PKBM)", aliases: ["pkbm", "paket a", "paket b", "paket c", "pendidikan kesetaraan"], sector: "Pendidikan",
    description: "Pendidikan nonformal Paket A, B, dan C, terutama B dan C, disertai pelatihan keterampilan bagi masyarakat yang tidak dapat mengakses pendidikan formal.",
    objectives: ["Membuka akses pendidikan", "Meningkatkan pengetahuan, sikap mental, dan keterampilan", "Mendorong kemandirian", "Memberikan pendidikan fleksibel dan inklusif"],
    beneficiaries: ["Masyarakat putus sekolah", "Masyarakat yang memerlukan pendidikan lanjutan", "Masyarakat terpencil", "Kelompok rentan"],
    implementation: ["Set up tempat belajar", "Perizinan/pengindukan PKBM", "Pendaftaran ke Dapodik", "Pembelajaran untuk 10 peserta", "Pendampingan dan monitoring"],
    location: "Desa Berdaya Rumah Zakat", capacity: "10 Peserta Program", duration: "36 bulan untuk Paket B/C", cost: "Rp296.000.000 atau donasi gabungan sesuai kemampuan", catalogPages: "19",
  },
  {
    id: "rumah-vokasi", name: "Rumah Vokasi", aliases: ["vokasi", "pelatihan kerja", "keterampilan kerja"], sector: "Pendidikan",
    description: "Pengembangan individu atau kelompok melalui pelatihan keterampilan sesuai potensi sebagai persiapan memasuki dunia kerja atau berwirausaha.",
    objectives: ["Mengembangkan keterampilan kerja/usaha", "Mencetak SDM terampil", "Membuka kesempatan kerja", "Menurunkan pengangguran", "Meningkatkan pendapatan"],
    beneficiaries: ["Masyarakat usia produktif yang belum bekerja", "Pemuda putus sekolah menengah", "Masyarakat yang membutuhkan pelatihan keterampilan termasuk asnaf"],
    implementation: ["Set up sarana pelatihan", "Pelatihan untuk 15-20 peserta", "Operasional 12 bulan", "Legalitas lembaga", "Modal usaha bagi lulusan", "Pendampingan dan monitoring"],
    location: "Desa Berdaya Rumah Zakat", capacity: "15-20 Peserta Program", duration: "12 bulan", cost: "Rp150.000.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["51% peserta lulus pelatihan", "38% telah diterima bekerja", "21% membuka usaha sendiri"], catalogPages: "20, 24",
  },
  {
    id: "rumah-quran", name: "Rumah Quran", aliases: ["rumah qur'an", "rumah quran", "tahsin", "tahfidz", "ppba"], sector: "Pendidikan",
    description: "Penyediaan fasilitas belajar Al-Quran bagi masyarakat.",
    objectives: ["Memfasilitasi pembelajaran Al-Quran", "Meningkatkan kemampuan dan minat baca", "Meningkatkan kualitas pengajar", "Menuntaskan buta huruf Al-Quran"],
    beneficiaries: ["Masyarakat dengan literasi Al-Quran rendah", "Peserta tahsin", "Penghafal Al-Quran", "Guru Quran yang belum tersertifikasi"],
    implementation: ["Penyediaan tempat dan sarana", "Bimbingan PPBA/Tahsin/Tahfidz untuk 30 peserta", "Legalitas lembaga", "Sertifikasi guru", "Operasional dan pendampingan"],
    location: "Desa Berdaya Rumah Zakat", capacity: "30 Peserta Program", duration: "12 bulan", cost: "Rp125.500.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["Indeks minat baca Al-Quran meningkat dari 0,31 (rendah) menjadi 0,60 (sedang)"], catalogPages: "21, 24",
  },
  {
    id: "beasiswa-baik-sekolah", name: "Beasiswa BAIK SD, SMP, dan SMA", aliases: ["beasiswa baik", "beasiswa sd", "beasiswa smp", "beasiswa sma"], sector: "Pendidikan",
    description: "Beasiswa dan pembinaan berkala untuk siswa SD, SMP, dan SMA dari keluarga kurang mampu.",
    objectives: ["Mengurangi putus sekolah dan menjaga keberlangsungan pendidikan anak."], beneficiaries: ["Siswa SD, SMP, dan SMA dari keluarga kurang mampu"],
    implementation: ["Beasiswa bulanan", "Biaya transport", "Pembinaan dua kali per bulan"],
    location: "Jaringan kantor Rumah Zakat", capacity: "1 anak", duration: "Bulanan dengan komitmen minimal 1 tahun", cost: "Rp185.000/bulan (SD), Rp210.000/bulan (SMP), atau Rp235.000/bulan (SMA)",
    impact2025: ["Indeks Kepuasan Masyarakat program Beasiswa BAIK sebesar 0,80, kategori baik"], catalogPages: "22, 24",
  },
  {
    id: "beasiswa-baik-mahasiswa", name: "Beasiswa BAIK Mahasiswa", aliases: ["beasiswa mahasiswa", "beasiswa kuliah"], sector: "Pendidikan",
    description: "Beasiswa mahasiswa yang berfokus pada pendampingan dan peningkatan kapasitas kepemimpinan penerima.",
    objectives: ["Meringankan biaya pendidikan mahasiswa berprestasi dari kelompok rentan/miskin", "Meningkatkan kapasitas kepemimpinan"],
    beneficiaries: ["Mahasiswa dari kelompok masyarakat rentan atau miskin"], implementation: ["Penyaluran bantuan pendidikan", "Pelatihan kepemimpinan"],
    location: "Jaringan kantor Rumah Zakat", capacity: "1 mahasiswa", duration: "Bulanan dengan komitmen minimal 1 tahun", cost: "Rp825.000/bulan atau donasi gabungan sesuai kemampuan", catalogPages: "23",
  },
  {
    id: "bank-sampah", name: "Bank Sampah", aliases: ["pengelolaan sampah", "3r", "reduce reuse recycle"], sector: "Lingkungan dan Kebencanaan",
    description: "Pemberdayaan masyarakat berbasis pengelolaan sampah dengan prinsip 3R: Reduce, Reuse, Recycle.",
    objectives: ["Mengurangi sampah ke TPA", "Mendorong pemilahan dan kebersihan", "Meningkatkan keterampilan pengelolaan sampah", "Membentuk komunitas Bank Sampah"],
    beneficiaries: ["Masyarakat dengan masalah sampah dan potensi pemecahan masalah di tingkat RW"],
    implementation: ["Survei dan sosialisasi", "Tempat dan perlengkapan", "Pelatihan organik/anorganik", "Kerja bakti", "Operasional", "Pendampingan dan monitoring"],
    location: "Desa Berdaya Rumah Zakat", capacity: "Sekitar 35 nasabah dalam lingkup RW", duration: "12 bulan", cost: "Rp117.000.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["56 titik Bank Sampah", "664 peserta terlibat", "767.900 kg sampah dikelola", "Rata-rata 65 kg sampah disetor setiap peserta per bulan"], catalogPages: "26, 31",
  },
  {
    id: "berbagi-air-kehidupan", name: "Berbagi Air Kehidupan", aliases: ["bantuan air", "air bersih", "kekeringan"], sector: "Lingkungan dan Kebencanaan",
    description: "Penyaluran bantuan air bersih kepada masyarakat yang mengalami kekeringan dan kesulitan akses air.",
    objectives: ["Memenuhi kebutuhan air bersih masyarakat."], beneficiaries: ["Masyarakat yang kesulitan memperoleh air bersih"],
    implementation: ["Penyaluran 10.000-20.000 liter air bersih untuk sekitar 100 keluarga, menyesuaikan harga tangki di lokasi"],
    location: "Jaringan kantor atau Desa Berdaya Rumah Zakat", capacity: "Sekitar 100 keluarga per pelaksanaan", duration: "1 kali pelaksanaan", cost: "Rp4.500.000 atau donasi gabungan sesuai kemampuan", catalogPages: "27",
  },
  {
    id: "destana", name: "Desa Tangguh Bencana (Destana)", aliases: ["destana", "desa tangguh", "mitigasi bencana desa"], sector: "Lingkungan dan Kebencanaan",
    description: "Pemberdayaan desa melalui pembinaan masyarakat, lingkungan, dan kesiapsiagaan agar mampu beradaptasi terhadap ancaman bencana.",
    objectives: ["Melindungi warga kawasan rawan", "Meningkatkan partisipasi kelompok rentan", "Memperkuat kapasitas desa dan kelembagaan", "Membangun kolaborasi pengurangan risiko"],
    beneficiaries: ["Aparat desa", "Relawan desa", "Masyarakat desa"],
    implementation: ["Konsolidasi stakeholder", "Penilaian ketangguhan", "Bimbingan teknis lima hari", "Pelatihan 30 relawan", "Rambu dan jalur evakuasi", "Simulasi", "Dokumen Destana"],
    location: "Desa Berdaya atau lokasi rekomendasi Rumah Zakat", capacity: "Peningkatan kapasitas 30 relawan desa", duration: "12 bulan", cost: "Rp139.000.000 atau donasi gabungan sesuai kemampuan", catalogPages: "28",
  },
  {
    id: "desa-lestari", name: "Desa Lestari", aliases: ["mangrove", "adaptasi iklim", "mitigasi iklim", "konservasi"], sector: "Lingkungan dan Kebencanaan",
    description: "Pembangunan berkelanjutan tingkat desa yang menyeimbangkan kesejahteraan sosial, ekonomi, dan pelestarian lingkungan dengan fokus adaptasi serta mitigasi perubahan iklim.",
    objectives: ["Meningkatkan pemahaman perubahan iklim", "Mendorong aksi adaptasi dan mitigasi berbasis masyarakat"],
    beneficiaries: ["Masyarakat dengan masalah lingkungan dan potensi pemecahan masalah di tingkat RW"],
    implementation: ["Assessment kerentanan", "Penguatan kapasitas 50 orang", "Aksi tanaman, biopori, sampah, dan pekarangan", "Pemantauan dan evaluasi"],
    location: "Desa Berdaya Rumah Zakat", capacity: "50 orang", duration: "12 bulan", cost: "Rp100.000.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["Evaluasi SLIA program konservasi mangrove menunjukkan skor penghidupan berkelanjutan meningkat dari 3,14 menjadi 4,19"], catalogPages: "29, 31",
  },
  {
    id: "spab", name: "Satuan Pendidikan Aman Bencana (SPAB)", aliases: ["spab", "sekolah aman bencana", "mitigasi bencana sekolah"], sector: "Lingkungan dan Kebencanaan",
    description: "Mitigasi bencana di sekolah melalui penyuluhan, tim siaga, simulasi evakuasi, dan dokumen prosedur tetap.",
    objectives: ["Meningkatkan pemahaman risiko", "Memperkuat kapasitas warga sekolah", "Menyusun rencana aksi", "Meningkatkan partisipasi dan kemitraan"],
    beneficiaries: ["Tenaga pendidik", "Peserta didik", "Masyarakat sekitar satuan pendidikan"],
    implementation: ["Konsolidasi stakeholder", "Dokumen SPAB", "Pelatihan empat hari", "Penilaian mandiri", "Media edukasi", "Simulasi", "Lima rambu/peta/jalur evakuasi"],
    location: "Jaringan kantor atau Desa Berdaya Rumah Zakat", capacity: "Satu satuan pendidikan dan masyarakat sekitar", duration: "2 bulan", cost: "Rp61.500.000 atau donasi gabungan sesuai kemampuan", catalogPages: "30",
  },
  {
    id: "rutilahu", name: "Bantuan Rutilahu", aliases: ["rumah tidak layak huni", "rehabilitasi rumah", "bantuan rumah"], sector: "Sosial",
    description: "Dukungan rehabilitasi rumah keluarga prasejahtera agar memenuhi standar kelayakan huni, sanitasi, ventilasi, dan akses air bersih.",
    objectives: ["Memberikan hunian layak, aman, dan sehat", "Mengurangi risiko kesehatan/kecelakaan", "Mendukung kesejahteraan dan produktivitas keluarga"],
    beneficiaries: ["Keluarga prasejahtera dengan rumah tidak layak di lahan milik sendiri, bukan sengketa atau fasilitas umum"],
    implementation: ["Survei kondisi", "Koordinasi pemerintah", "Perbaikan rumah sesuai anggaran", "Monitoring"],
    location: "Wilayah binaan Rumah Zakat", capacity: "1 unit rumah", duration: "1,5 bulan", cost: "Rp31.000.000 atau donasi gabungan sesuai kemampuan",
    impact2025: ["IKM aspek kinerja 90,3 (sangat baik)", "IKM aspek kepentingan 89,8 (sangat penting)"], catalogPages: "33-34",
  },
];

function normalize(value: string) {
  return value.toLocaleLowerCase("id-ID").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function searchableText(entry: ProgramCatalogEntry) {
  return normalize([entry.name, ...entry.aliases, entry.sector, entry.description, ...entry.objectives, ...entry.beneficiaries, ...entry.implementation].join(" "));
}

export function queryProgramCatalog(input: { search?: string; sector?: CatalogSector; limit?: number }) {
  const query = normalize(input.search ?? "");
  const tokens = query.split(" ").filter((token) => token.length > 1);
  const scored = PROGRAM_CATALOG
    .filter((entry) => !input.sector || entry.sector === input.sector)
    .map((entry) => {
      const name = normalize(entry.name);
      const aliases = entry.aliases.map(normalize);
      const haystack = searchableText(entry);
      const exact = query && (name.includes(query) || aliases.some((alias) => alias.includes(query) || query.includes(alias)));
      const tokenMatches = tokens.filter((token) => haystack.includes(token)).length;
      return { entry, score: exact ? 100 + tokenMatches : tokenMatches };
    })
    .filter(({ score }) => !query || score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "id"));
  const limit = Math.max(1, Math.min(20, input.limit ?? (query ? 5 : 20)));
  return {
    source: "program-catalog" as const,
    query: input,
    totalMatches: scored.length,
    programs: scored.slice(0, limit).map(({ entry }) => entry),
    calculation: "Pencarian istilah pada nama, alias, sektor, deskripsi, tujuan, sasaran, dan implementasi katalog; angka dampak dipertahankan sesuai tahun yang tertulis pada katalog.",
    quality: { isValid: true, rowsRead: PROGRAM_CATALOG.length, rowsAccepted: scored.length, rowsRejected: PROGRAM_CATALOG.length - scored.length, checkedAt: new Date().toISOString(), issues: [] },
    provenance: { sourceId: "program-catalog", sourceLabel: PROGRAM_CATALOG_SOURCE.label, documentName: PROGRAM_CATALOG_SOURCE.documentName, issuedYear: 2026, updatedAt: "2026-02-06T09:16:16+07:00" },
  };
}

