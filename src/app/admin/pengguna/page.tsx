import type { Metadata } from "next";
import { AdminUsersView } from "@/components/AdminUsersView";

export const metadata: Metadata = { title: "Kelola Pengguna | Laporan Pemberdayaan Rumah Zakat" };
export default function AdminUsersPage() { return <AdminUsersView />; }

