import { Suspense } from "react";
import { FirebaseEmailAction } from "@/components/FirebaseEmailAction";
export default function UpdatePasswordPage() { return <Suspense fallback={<div className="min-h-screen bg-[#FFF8F2]" />}><FirebaseEmailAction /></Suspense>; }
