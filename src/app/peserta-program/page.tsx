import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Peserta Program | Laporan Pemberdayaan Rumah Zakat",
};

export default function PesertaProgramPage() {
  redirect("/ikhtisar-pp-plp");
}
