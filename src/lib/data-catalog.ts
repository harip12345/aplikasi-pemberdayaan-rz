export type AiDataSourceId = "dashboard" | "participants" | "participant-analysis" | "participant-analysis-program-monthly" | "participant-analysis-division-monthly" | "distribution" | "munfik" | "muzzaki" | "mualaf" | "pp-terbina" | "bummas" | "garis-kemiskinan" | "garis-kemiskinan-recap" | "vokasi-impact" | "hafidz-impact" | "environment-impact" | "health-impact";

export type DataSourceDefinition = {
  id: AiDataSourceId;
  label: string;
  spreadsheetId: string;
  gid: string;
  environment: { spreadsheetId: string; gid: string };
  parser: string;
  grain: string;
  refreshMode: "cached-google-sheet";
};

export const AI_DATA_SOURCE_CATALOG: Record<AiDataSourceId, DataSourceDefinition> = {
  dashboard: {
    id: "dashboard",
    label: "Target dan Capaian Dashboard",
    spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs",
    gid: "225836951",
    environment: { spreadsheetId: "GOOGLE_SHEETS_DASHBOARD_ID", gid: "GOOGLE_SHEETS_DASHBOARD_GID" },
    parser: "dashboard-target-achievement-v1",
    grain: "Satu indikator per bulan",
    refreshMode: "cached-google-sheet",
  },
  participants: {
    id: "participants",
    label: "Data Peserta Program",
    spreadsheetId: "1W0M9WD1Zk_r1F77vP1ccDivV5UQVrJbnUnursadoX8U",
    gid: "953064145",
    environment: { spreadsheetId: "GOOGLE_SHEETS_PP_ID", gid: "GOOGLE_SHEETS_PP_GID" },
    parser: "participant-row-v1",
    grain: "Satu baris penyaluran per periode, wilayah, program, subprogram, dan asnaf",
    refreshMode: "cached-google-sheet",
  },
  "participant-analysis": {
    id: "participant-analysis",
    label: "Analisa Capaian Peserta Program",
    spreadsheetId: "1W0M9WD1Zk_r1F77vP1ccDivV5UQVrJbnUnursadoX8U",
    gid: "722479198",
    environment: { spreadsheetId: "GOOGLE_SHEETS_PP_ANALYSIS_ID", gid: "GOOGLE_SHEETS_PP_ANALYSIS_GID" },
    parser: "participant-achievement-analysis-v3",
    grain: "Ringkasan target, capaian, history, persentase target, dan growth PP/PLP per program serta per divisi",
    refreshMode: "cached-google-sheet",
  },
  "participant-analysis-program-monthly": {
    id: "participant-analysis-program-monthly",
    label: "Analisa Bulanan Peserta Program per Program",
    spreadsheetId: "1W0M9WD1Zk_r1F77vP1ccDivV5UQVrJbnUnursadoX8U",
    gid: "431216403",
    environment: { spreadsheetId: "GOOGLE_SHEETS_PP_ANALYSIS_ID", gid: "GOOGLE_SHEETS_PP_ANALYSIS_PROGRAM_MONTHLY_GID" },
    parser: "participant-monthly-performance-v1",
    grain: "Satu baris program per bulan dengan target, capaian, history, persentase periode, akumulasi, dan persentase tahunan",
    refreshMode: "cached-google-sheet",
  },
  "participant-analysis-division-monthly": {
    id: "participant-analysis-division-monthly",
    label: "Analisa Bulanan Peserta Program per Divisi",
    spreadsheetId: "1W0M9WD1Zk_r1F77vP1ccDivV5UQVrJbnUnursadoX8U",
    gid: "550193821",
    environment: { spreadsheetId: "GOOGLE_SHEETS_PP_ANALYSIS_ID", gid: "GOOGLE_SHEETS_PP_ANALYSIS_DIVISION_MONTHLY_GID" },
    parser: "participant-monthly-performance-v1",
    grain: "Satu baris divisi per bulan dengan target, capaian, history, persentase periode, akumulasi, dan persentase tahunan",
    refreshMode: "cached-google-sheet",
  },
  distribution: {
    id: "distribution",
    label: "Sebaran Desa Berdaya",
    spreadsheetId: "12ZYUGPG1NP3y9Ve5z49CAcyPPmg34iElIfn5aFscv98",
    gid: "1386051732",
    environment: { spreadsheetId: "GOOGLE_SHEETS_DISTRIBUTION_ID", gid: "GOOGLE_SHEETS_DISTRIBUTION_GID" },
    parser: "empowered-village-row-v1",
    grain: "Satu baris desa/program pada portofolio Desa Berdaya",
    refreshMode: "cached-google-sheet",
  },
  munfik: {
    id: "munfik",
    label: "Data Detail Munfik",
    spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs",
    gid: "1144245068",
    environment: { spreadsheetId: "GOOGLE_SHEETS_MUNFIK_ID", gid: "GOOGLE_SHEETS_MUNFIK_GID" },
    parser: "munfik-three-horizontal-blocks-v1",
    grain: "Satu baris Munfik per bulan dan sumber data",
    refreshMode: "cached-google-sheet",
  },
  muzzaki: {
    id: "muzzaki", label: "Data Detail Muzaki", spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs", gid: "181388063",
    environment: { spreadsheetId: "GOOGLE_SHEETS_MUZZAKI_ID", gid: "GOOGLE_SHEETS_MUZZAKI_GID" }, parser: "metric-detail-row-v1", grain: "Satu baris peserta Muzaki", refreshMode: "cached-google-sheet",
  },
  mualaf: {
    id: "mualaf", label: "Data Detail Mualaf", spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs", gid: "527605744",
    environment: { spreadsheetId: "GOOGLE_SHEETS_MUALAF_ID", gid: "GOOGLE_SHEETS_MUALAF_GID" }, parser: "metric-detail-row-v1", grain: "Satu baris peserta Mualaf dengan Nama PM terisi", refreshMode: "cached-google-sheet",
  },
  "pp-terbina": {
    id: "pp-terbina", label: "Data Detail Peserta Program Terbina", spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs", gid: "1244942460",
    environment: { spreadsheetId: "GOOGLE_SHEETS_PP_TERBINA_ID", gid: "GOOGLE_SHEETS_PP_TERBINA_GID" }, parser: "metric-detail-row-v1", grain: "Satu baris Peserta Program Terbina", refreshMode: "cached-google-sheet",
  },
  bummas: {
    id: "bummas", label: "Data Detail BUMMas", spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs", gid: "1421837017",
    environment: { spreadsheetId: "GOOGLE_SHEETS_BUMMAS_ID", gid: "GOOGLE_SHEETS_BUMMAS_GID" }, parser: "metric-detail-row-v1", grain: "Satu baris unit usaha dengan bidang usaha/program terisi", refreshMode: "cached-google-sheet",
  },
  "garis-kemiskinan": {
    id: "garis-kemiskinan", label: "Data Peserta Keluar Garis Kemiskinan", spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs", gid: "967242088",
    environment: { spreadsheetId: "GOOGLE_SHEETS_GK_PM_2026_ID", gid: "GOOGLE_SHEETS_GK_PM_2026_GID" }, parser: "gk-four-division-blocks-v1", grain: "Satu baris GK per divisi dan bulan; empat blok horizontal digabung", refreshMode: "cached-google-sheet",
  },
  "garis-kemiskinan-recap": {
    id: "garis-kemiskinan-recap", label: "Rekap Capaian Keluar Garis Kemiskinan", spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs", gid: "967242088",
    environment: { spreadsheetId: "GOOGLE_SHEETS_GK_PM_2026_ID", gid: "GOOGLE_SHEETS_GK_PM_2026_GID" }, parser: "gk-four-division-recap-v1", grain: "Satu baris total GK per bulan dari empat divisi", refreshMode: "cached-google-sheet",
  },
  "vokasi-impact": {
    id: "vokasi-impact", label: "Data Dampak Program Vokasi", spreadsheetId: "11w7dbnTtErIf0mhp9KSR5h5aC80FYV5tu11geVm951U", gid: "1561251771",
    environment: { spreadsheetId: "GOOGLE_SHEETS_VOKASI_IMPACT_ID", gid: "GOOGLE_SHEETS_VOKASI_IMPACT_GID" }, parser: "vocation-outcome-row-v1", grain: "Satu baris peserta vokasi dengan status hasil kerja/usaha", refreshMode: "cached-google-sheet",
  },
  "hafidz-impact": {
    id: "hafidz-impact", label: "Data Dampak Peserta Program Hafidz", spreadsheetId: "11w7dbnTtErIf0mhp9KSR5h5aC80FYV5tu11geVm951U", gid: "183332782",
    environment: { spreadsheetId: "GOOGLE_SHEETS_HAFIDZ_IMPACT_ID", gid: "GOOGLE_SHEETS_HAFIDZ_IMPACT_GID" }, parser: "hafidz-achievement-row-v1", grain: "Satu baris peserta program Hafidz", refreshMode: "cached-google-sheet",
  },
  "environment-impact": {
    id: "environment-impact", label: "Data Dampak Program Lingkungan", spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs", gid: "1424522729",
    environment: { spreadsheetId: "GOOGLE_SHEETS_ENVIRONMENT_IMPACT_ID", gid: "GOOGLE_SHEETS_ENVIRONMENT_IMPACT_GID" }, parser: "environment-impact-columns-u-v-v1", grain: "Satu baris lokasi Bank Sampah atau dampak Desa Lestari", refreshMode: "cached-google-sheet",
  },
  "health-impact": {
    id: "health-impact", label: "Resume Dampak Program Kesehatan", spreadsheetId: "1sc6zAqxX-ZogtAbwm7eLD1NHcAOQCiT2LHt1TdxqPAU", gid: "529116641",
    environment: { spreadsheetId: "GOOGLE_SHEETS_HEALTH_IMPACT_ID", gid: "GOOGLE_SHEETS_HEALTH_IMPACT_GID" }, parser: "health-impact-resume-columns-w-x-v1", grain: "Resume, kolom W jumlah Posyandu dan X jumlah Kader", refreshMode: "cached-google-sheet",
  },
};

export function resolvedDataSource(id: AiDataSourceId) {
  const source = AI_DATA_SOURCE_CATALOG[id];
  return {
    ...source,
    spreadsheetId: process.env[source.environment.spreadsheetId] || source.spreadsheetId,
    gid: process.env[source.environment.gid] || source.gid,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env[source.environment.spreadsheetId] || source.spreadsheetId}/edit?gid=${process.env[source.environment.gid] || source.gid}`,
  };
}
