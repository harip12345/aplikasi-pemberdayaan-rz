import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Desa Berdaya | Laporan Pemberdayaan Rumah Zakat",
};

export default function DesaBerdayaPage() {
  redirect("/peta-sebaran");
}
