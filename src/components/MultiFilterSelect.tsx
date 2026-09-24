"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type MultiFilterSelectProps = {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
  className?: string;
};

export function MultiFilterSelect({ label, values, options, onChange, allLabel, className = "" }: MultiFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const openAbove = rect.bottom + 240 > window.innerHeight && rect.top > 240;
      setPosition({ top: openAbove ? undefined : rect.bottom + 6, bottom: openAbove ? window.innerHeight - rect.top + 6 : undefined, left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 8)), width: Math.max(rect.width, 220) });
    };
    updatePosition();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node) && !listRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const summary = values.length === 0 ? allLabel ?? `Semua ${label.toLowerCase()}` : values.length === 1 ? values[0] : `${values.length} dipilih`;
  const toggle = (option: string) => onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option]);

  return <div className={`relative min-w-0 ${className}`}>
    <button ref={buttonRef} type="button" aria-label={`Filter ${label}: ${summary}`} aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((current) => !current)} className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left outline-none transition hover:border-orange-300 focus-visible:border-[#F2662F] focus-visible:ring-4 focus-visible:ring-orange-100">
      <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span><span className="block truncate text-sm font-medium text-ink" title={summary}>{summary}</span></span>
      <ChevronDown size={15} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
    </button>
    {open && createPortal(<div ref={listRef} role="listbox" aria-label={`Pilihan ${label}`} aria-multiselectable="true" style={position} className="fixed z-[1200] max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <button type="button" onClick={() => onChange([])} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold text-[#D84315] hover:bg-orange-50"><span>{allLabel ?? `Semua ${label.toLowerCase()}`}</span>{values.length === 0 && <Check size={14} />}</button>
      <div className="max-h-56 overflow-y-auto border-t border-slate-100 pt-1">
        {options.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Belum ada pilihan tersedia.</p>}
        {options.map((option) => <button key={option} type="button" role="option" aria-selected={values.includes(option)} onClick={() => toggle(option)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${values.includes(option) ? "border-[#D84315] bg-[#D84315] text-white" : "border-slate-300"}`}>{values.includes(option) && <Check size={12} />}</span><span>{option}</span></button>)}
      </div>
    </div>, document.body)}
  </div>;
}
