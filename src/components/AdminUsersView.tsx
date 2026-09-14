"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Ban, CheckCircle2, Clock3, RefreshCw, Search, ShieldCheck, UserCheck, UserRoundPlus, Users, Wifi } from "lucide-react";

type AccessStatus = "pending" | "approved" | "rejected" | "suspended";
type ManagedUser = { id: string; email: string; full_name: string | null; organization: string | null; access_purpose: string | null; account_type: "internal" | "external"; role: "member" | "admin"; status: AccessStatus; last_seen_at: string | null; approved_at: string | null; created_at: string; updated_at: string };
type AdminPayload = { users: ManagedUser[]; counts: { total: number; online: number; approved: number; pending: number; inactive: number; internal: number; external: number; newThisMonth: number }; onlineThresholdMinutes: number };

const STATUS_LABEL: Record<AccessStatus, string> = { pending: "Menunggu", approved: "Aktif", rejected: "Ditolak", suspended: "Ditangguhkan" };
const STATUS_STYLE: Record<AccessStatus, string> = { pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700", suspended: "bg-slate-200 text-slate-600" };

function dateTime(value: string | null) {
  if (!value) return "Belum ada aktivitas";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminUsersView() {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AccessStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Data pengguna tidak dapat dimuat.");
      setPayload(body); setClock(Date.now());
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Data pengguna tidak dapat dimuat."); }
  }, []);
  useEffect(() => { const kickoff = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 60_000); return () => { window.clearTimeout(kickoff); window.clearInterval(timer); }; }, [load]);

  async function changeStatus(userId: string, nextStatus: AccessStatus) {
    setBusyId(userId); setError("");
    try {
      const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, status: nextStatus }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Status akses tidak dapat diperbarui.");
      await load();
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Status akses tidak dapat diperbarui."); }
    finally { setBusyId(null); }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (payload?.users ?? []).filter((user) => (status === "all" || user.status === status) && (!normalized || [user.full_name, user.email, user.organization, user.access_purpose].some((value) => value?.toLowerCase().includes(normalized)))).sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [payload, query, status]);
  const onlineSince = clock - (payload?.onlineThresholdMinutes ?? 5) * 60_000;
  const cards = payload ? [
    { label: "Total pengguna", value: payload.counts.total, hint: `${payload.counts.internal} internal · ${payload.counts.external} eksternal`, icon: Users, tone: "bg-slate-100 text-slate-700" },
    { label: "Online sekarang", value: payload.counts.online, hint: "Aktif dalam 5 menit", icon: Wifi, tone: "bg-sky-100 text-sky-700" },
    { label: "Akses aktif", value: payload.counts.approved, hint: "Dapat membuka aplikasi", icon: UserCheck, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Menunggu approval", value: payload.counts.pending, hint: "Perlu tindakan admin", icon: Clock3, tone: "bg-amber-100 text-amber-700" },
    { label: "Akses nonaktif", value: payload.counts.inactive, hint: "Ditolak atau ditangguhkan", icon: Ban, tone: "bg-red-100 text-red-700" },
    { label: "Pengguna baru", value: payload.counts.newThisMonth, hint: "Terdaftar bulan ini", icon: UserRoundPlus, tone: "bg-orange-100 text-orange-700" },
  ] : [];

  return <div className="space-y-6"><section className="overflow-hidden rounded-[28px] bg-gradient-to-r from-[#172436] to-[#2D4057] p-6 text-white shadow-soft sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-300"><ShieldCheck size={16} /> Administrasi akses</p><h1 className="mt-3 text-3xl font-bold">Pengguna dan Persetujuan</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Pantau akun aktif, kehadiran pengguna, serta permohonan akses eksternal dalam satu tempat.</p></div><button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15"><RefreshCw size={16} /> Muat ulang</button></div></section>
  {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
  {!payload ? <div className="grid h-48 place-items-center rounded-3xl border border-slate-200 bg-white text-sm text-slate-400"><RefreshCw size={20} className="animate-spin" /></div> : <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(({ label, value, hint, icon: Icon, tone }) => <article key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-[#172436]">{value.toLocaleString("id-ID")}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></div><span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon size={20} /></span></div></article>)}</section>
  <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-[#172436]">Daftar pengguna</h2><p className="mt-1 text-xs text-slate-400">Permohonan yang menunggu persetujuan ditampilkan terlebih dahulu.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, email, instansi…" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-orange-300 sm:w-64" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-orange-300"><option value="all">Semua status</option><option value="pending">Menunggu</option><option value="approved">Aktif</option><option value="rejected">Ditolak</option><option value="suspended">Ditangguhkan</option></select></div></div>
  <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Pengguna</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Instansi dan tujuan</th><th className="px-4 py-3">Aktivitas terakhir</th><th className="px-5 py-3 text-right">Tindakan</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((user) => { const isOnline = Boolean(user.last_seen_at && Date.parse(user.last_seen_at) >= onlineSince); return <tr key={user.id} className={user.status === "pending" ? "bg-amber-50/40" : "hover:bg-slate-50/60"}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-bold text-slate-600">{(user.full_name || user.email).slice(0, 1).toUpperCase()}{isOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}</span><div><p className="font-bold text-[#172436]">{user.full_name || "Tanpa nama"}{user.role === "admin" && <span className="ml-2 rounded-md bg-orange-100 px-1.5 py-0.5 text-[9px] text-orange-700">Admin</span>}</p><p className="mt-0.5 text-slate-400">{user.email}</p></div></div></td><td className="px-4 py-4"><span className="capitalize text-slate-600">{user.account_type}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 font-bold ${STATUS_STYLE[user.status]}`}>{STATUS_LABEL[user.status]}</span></td><td className="max-w-xs px-4 py-4"><p className="font-semibold text-slate-600">{user.organization || (user.account_type === "internal" ? "Rumah Zakat" : "Belum diisi")}</p><p className="mt-1 line-clamp-2 leading-5 text-slate-400">{user.access_purpose || "—"}</p></td><td className="px-4 py-4"><p className={isOnline ? "font-bold text-emerald-600" : "text-slate-500"}>{isOnline ? "Online" : dateTime(user.last_seen_at)}</p><p className="mt-1 text-[10px] text-slate-400">Daftar {dateTime(user.created_at)}</p></td><td className="px-5 py-4"><div className="flex justify-end gap-1.5">{user.status !== "approved" && <button disabled={busyId === user.id} onClick={() => void changeStatus(user.id, "approved")} className="rounded-lg bg-emerald-50 px-2.5 py-2 font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><CheckCircle2 size={14} /></button>}{user.role !== "admin" && user.status !== "rejected" && <button disabled={busyId === user.id} onClick={() => void changeStatus(user.id, "rejected")} className="rounded-lg bg-red-50 px-2.5 py-2 font-bold text-red-600 hover:bg-red-100 disabled:opacity-50">Tolak</button>}{user.role !== "admin" && user.status === "approved" && <button disabled={busyId === user.id} onClick={() => void changeStatus(user.id, "suspended")} className="rounded-lg bg-slate-100 px-2.5 py-2 font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50">Tangguhkan</button>}</div></td></tr>; })}{filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Tidak ada pengguna yang sesuai dengan filter.</td></tr>}</tbody></table></div></section></>}
  <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-sky-100 bg-sky-50 p-4"><p className="flex items-center gap-2 text-xs font-bold text-sky-800"><Activity size={16} /> Definisi online</p><p className="mt-2 text-xs leading-5 text-sky-700">Pengguna dianggap online ketika aplikasi mengirim aktivitas dalam lima menit terakhir. Angka ini bersifat indikatif, bukan pemantauan pekerjaan.</p></div><div className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><p className="text-xs font-bold text-orange-800">Prinsip akses minimum</p><p className="mt-2 text-xs leading-5 text-orange-700">Setujui akun eksternal hanya sesuai kebutuhan dan tinjau akun yang tidak aktif secara berkala.</p></div></section></div>;
}
