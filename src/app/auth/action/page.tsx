import { Suspense } from "react";
import { FirebaseEmailAction } from "@/components/FirebaseEmailAction";

export default function AuthActionPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#FFF8F2]" />}><FirebaseEmailAction /></Suspense>;
}
