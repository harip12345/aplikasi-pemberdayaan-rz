export function PageLoadingState({ destination }: { destination?: string }) {
  return (
    <section className="animate-pulse space-y-6" aria-label="Memuat halaman" aria-live="polite">
      <div className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#172436] to-[#32415B] p-6 shadow-soft">
        <div className="h-3 w-32 rounded-full bg-white/20" />
        <div className="mt-4 h-8 w-64 max-w-[75%] rounded-xl bg-white/25" />
        <p className="mt-4 text-xs font-medium text-white/65">{destination ? `Membuka ${destination}…` : "Menyiapkan halaman…"}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 rounded-[24px] border border-slate-200 bg-white shadow-soft"><div className="m-5 h-3 w-24 rounded-full bg-slate-200" /><div className="mx-5 mt-5 h-8 w-32 rounded-lg bg-slate-100" /></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-80 rounded-[28px] border border-slate-200 bg-white shadow-soft"><div className="m-6 h-4 w-48 rounded-full bg-slate-200" /><div className="mx-6 mt-6 h-56 rounded-2xl bg-slate-100" /></div>
        <div className="h-80 rounded-[28px] border border-slate-200 bg-white shadow-soft"><div className="m-6 h-4 w-36 rounded-full bg-slate-200" /><div className="mx-6 mt-6 h-56 rounded-2xl bg-slate-100" /></div>
      </div>
    </section>
  );
}
