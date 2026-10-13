"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, Bot, CheckCircle2, Compass, Copy, ExternalLink, FileText, HandCoins, Image as ImageIcon, Loader2, LogIn, Paperclip, RotateCcw, Send, Sparkles, Users, X } from "lucide-react";
import { useReportingPeriod } from "@/components/ReportingPeriodContext";
import { useAssistantView } from "@/components/AssistantViewContext";
import { usePathname } from "next/navigation";
import { validAssistantViewContext, type AssistantViewContext } from "@/lib/assistant-view-context";
import { useAssistantActions } from "@/components/AssistantActionContext";
import { validAssistantViewAction, type AssistantViewAction } from "@/lib/assistant-view-action";
import { REPORTING_MONTHS, reportingPeriodLabel } from "@/lib/reporting-period";

type SourceLink = {
  label: string;
  title?: string;
  domain?: string;
  url: string;
  updatedAt: string;
  publishedAt?: string;
  accessedAt?: string;
  publicationDateStatus?: "available" | "unavailable";
  sourceType?: string;
};
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; attachmentNames?: string[]; sources?: SourceLink[]; usedTools?: string[] };
type ProviderStatus = { connected: boolean; loginAvailable?: boolean; canManageLogin?: boolean; message?: string };
type LoginCode = { verificationUrl: string; userCode: string };
type LoginEvent = { type: "code"; verificationUrl: string; userCode: string } | { type: "complete"; connected: true; planType?: string | null } | { type: "error"; message: string };

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const MAX_ATTACHMENT_TOTAL_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);

function attachmentMimeType(file: File) {
  if (file.type && (IMAGE_TYPES.has(file.type) || TEXT_TYPES.has(file.type))) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "md" ? "text/markdown" : extension === "csv" ? "text/csv" : extension === "json" ? "application/json" : extension === "txt" ? "text/plain" : "";
}

function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Lampiran tidak dapat dibaca."));
    reader.onerror = () => reject(new Error("Lampiran tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}

function visiblePageSections() {
  const main = document.getElementById("app-main-content");
  if (!main) return [];
  return [...main.querySelectorAll("h1, h2, h3")]
    .filter((heading) => {
      const bounds = heading.getBoundingClientRect();
      return bounds.bottom > 72 && bounds.top < window.innerHeight && bounds.width > 0;
    })
    .map((heading) => heading.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "")
    .filter(Boolean)
    .slice(0, 6);
}

function InlineText({ children }: { children: string }) {
  return <>{children.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part)}</>;
}

function MessageContent({ content }: { content: string }) {
  return <div className="space-y-1 whitespace-pre-wrap">{content.split("\n").map((line, index) => <div key={index} className={line.trim().startsWith("-") ? "pl-1" : ""}><InlineText>{line || " "}</InlineText></div>)}</div>;
}

function sourceDateLabel(source: SourceLink) {
  if (source.publicationDateStatus === "unavailable") return "Tanggal publikasi tidak tersedia";
  const rawDate = source.publishedAt || source.updatedAt;
  if (!rawDate) return source.sourceType?.includes("web") || source.sourceType === "official-rumah-zakat" ? "Tanggal publikasi tidak tersedia" : "";
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? "Tanggal publikasi tidak tersedia" : parsed.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function SmartAssistant({ isOpen }: { isOpen: boolean; onClose: () => void }) {
  const { period } = useReportingPeriod();
  const viewContext = useAssistantView();
  const assistantActions = useAssistantActions();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginCode, setLoginCode] = useState<LoginCode | null>(null);
  const [loginState, setLoginState] = useState<"idle" | "starting" | "waiting">("idle");
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => {
    const aboutView = "Jelaskan temuan utama pada tampilan ini sesuai filter aktif.";
    if (!period) return [aboutView, "Berapa total Peserta Program pada periode terbaru?", "Berapa Munfik per sumber pada periode terbaru?"];
    const label = reportingPeriodLabel(period);
    const endMonth = REPORTING_MONTHS[period.endMonthIndex];
    return [
      aboutView,
      `Berapa total Peserta Program ${label}?`,
      `Berapa Munfik per sumber sampai ${endMonth}?`,
    ];
  }, [period]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [isSending, messages]);

  useEffect(() => {
    if (!isOpen || status) return;
    let active = true;
    void fetch("/api/assistant-data/warm", { method: "POST", cache: "no-store" }).catch(() => undefined);
    void fetch("/api/telegram/webhook", { cache: "no-store" })
      .then(async (response) => response.json() as Promise<{ botUrl?: string | null }>)
      .then((payload) => { if (active && payload.botUrl) setTelegramUrl(payload.botUrl); })
      .catch(() => undefined);
    void fetch("/api/assistant/status", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as ProviderStatus;
        if (!response.ok) throw new Error(payload.message || "Status AI tidak dapat dibaca.");
        if (active) setStatus(payload);
      })
      .catch((statusError) => {
        if (active) {
          const message = statusError instanceof Error ? statusError.message : "Status AI tidak dapat dibaca.";
          setStatus({ connected: false, message });
          setError(message);
        }
      });
    return () => { active = false; };
  }, [isOpen, status]);

  const connectChatGPT = async () => {
    if (loginState !== "idle") return;
    setError(null); setLoginCode(null); setLoginState("starting");
    try {
      const response = await fetch("/api/assistant/login", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message || "Login ChatGPT tidak dapat dimulai.");
      }
      if (!response.body) throw new Error("Server tidak mengirim alur login.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      const processLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as LoginEvent;
        if (event.type === "code") {
          setLoginCode({ verificationUrl: event.verificationUrl, userCode: event.userCode });
          setLoginState("waiting");
        } else if (event.type === "complete") {
          completed = true;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
        if (done) break;
      }
      if (buffer.trim()) processLine(buffer);
      if (!completed) throw new Error("Proses login berakhir sebelum akun terhubung.");

      const statusResponse = await fetch("/api/assistant/status", { cache: "no-store" });
      const nextStatus = await statusResponse.json() as ProviderStatus;
      if (!statusResponse.ok || !nextStatus.connected) throw new Error(nextStatus.message || "Akun belum terbaca setelah login.");
      setStatus(nextStatus); setLoginCode(null);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login ChatGPT tidak berhasil.");
    } finally {
      setLoginState("idle");
    }
  };

  const sendMessage = async (suggested?: string) => {
    const content = (suggested ?? input).trim();
    if ((!content && pendingFiles.length === 0) || isSending || status?.connected === false) return;
    const question = content || "Tolong analisis lampiran ini dan jelaskan temuan utamanya.";
    setError(null); setIsSending(true);
    try {
      const attachments = await Promise.all(pendingFiles.map(async (file) => {
        const mimeType = attachmentMimeType(file);
        const dataUrl = await fileDataUrl(file);
        return { name: file.name, mimeType, dataUrl: dataUrl.replace(/^data:[^;]+;base64,/, `data:${mimeType};base64,`) };
      }));
      const userMessage: ChatMessage = { id: messageId(), role: "user", content: question, attachmentNames: pendingFiles.map((file) => file.name) };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages); setInput(""); setPendingFiles([]);
      const activeView: AssistantViewContext = {
        ...(viewContext ?? { pathname, page: (document.title.split("|")[0]?.trim() || pathname).slice(0, 100) }),
        visibleSections: visiblePageSections(),
      };
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })), attachments, periodContext: period, viewContext: validAssistantViewContext(activeView) ? activeView : null }),
      });
      const payload = await response.json() as { message?: string; usedTools?: string[]; sources?: SourceLink[]; action?: AssistantViewAction };
      if (!response.ok || !payload.message) throw new Error(payload.message || "Asisten belum dapat menjawab.");
      setMessages((current) => [...current, { id: messageId(), role: "assistant", content: payload.message!, sources: payload.sources, usedTools: payload.usedTools }]);
      if (validAssistantViewAction(payload.action)) assistantActions.run(payload.action);
      setStatus((current) => ({ ...current, connected: true }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Asisten belum dapat menjawab.");
    } finally { setIsSending(false); }
  };

  const addAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = [...pendingFiles, ...Array.from(files)];
    if (selected.length > 3) { setError("Maksimal 3 lampiran per pesan."); return; }
    if (selected.reduce((sum, file) => sum + file.size, 0) > MAX_ATTACHMENT_TOTAL_BYTES) { setError("Total lampiran maksimal 3 MB."); return; }
    for (const file of selected) {
      const mimeType = attachmentMimeType(file);
      if (!mimeType) { setError(`Jenis berkas ${file.name} belum didukung. Gunakan PNG, JPG, WebP, TXT, MD, CSV, atau JSON.`); return; }
      if (file.size > (IMAGE_TYPES.has(mimeType) ? 2 * 1024 * 1024 : 128 * 1024)) { setError(`${file.name} melebihi batas ukuran ${IMAGE_TYPES.has(mimeType) ? "2 MB" : "128 KB"}.`); return; }
    }
    setPendingFiles(selected); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const connectionText = status?.connected ? "Siap membantu" : status?.message?.includes("Silakan masuk") ? "Perlu masuk" : status ? "Belum tersedia" : "Memeriksa koneksi";
  const welcomeStatus = status?.connected ? "Asisten siap menelusuri data sesuai halaman dan filter aktif." : status?.message?.includes("Silakan masuk") ? "Silakan masuk untuk menggunakan asisten." : status ? "Asisten belum tersedia. Jika masalah berlanjut, hubungi admin." : "Memeriksa ketersediaan asisten…";
  const suggestionIcons = [Sparkles, Users, HandCoins];

  return <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8FAFC]" aria-label="Asisten Data Program RZ">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate"><span className="font-semibold text-[#B9380D]">Melihat:</span> {viewContext?.page || "Halaman aplikasi"}{viewContext?.selection ? ` · ${viewContext.selection}` : ""}</span>{telegramUrl && <a href={telegramUrl} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-[#B9380D] transition hover:bg-orange-50" aria-label="Buka bot Telegram"><Send size={15} /></a>}</div><div className="mt-1.5 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-slate-400">{typeof viewContext?.filters?.periode === "string" ? viewContext.filters.periode : period ? reportingPeriodLabel(period) : "Filter halaman aktif"}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status?.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{connectionText}</span></div></div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {messages.length === 0 && <div className="space-y-5">
          <div className="rounded-[24px] border border-orange-100 bg-gradient-to-b from-orange-50/80 via-white to-white px-5 py-6 shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E65100] text-white shadow-lg shadow-orange-700/20"><Bot size={29} strokeWidth={1.8} /></div>
            <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#B9380D]">Asisten Data Program RZ</p>
            <h2 className="mt-1 text-center text-xl font-bold tracking-tight text-slate-900">Ada yang ingin ditelusuri?</h2>
            <p className="mt-2 text-center text-[13px] leading-5 text-slate-600">Tanyakan data, grafik, atau temuan di halaman ini. Asisten mengikuti filter aktif dan memeriksa sumbernya.</p>
            <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-5 ${status?.connected === false ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
              {status?.connected === false ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : status ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin" />}
              <span>{welcomeStatus}</span>
            </div>
            {status?.connected === false && status.loginAvailable && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-slate-700"><LogIn size={15} /><p className="text-xs font-bold">Hubungkan ChatGPT Business</p></div>
              {!loginCode ? <div className="mt-2">
                <p className="text-[11px] leading-4 text-slate-500">Akses ini hanya tersedia untuk admin aplikasi. Kredensial akan disimpan terenkripsi di Private Blob.</p>
                <button type="button" onClick={() => void connectChatGPT()} disabled={loginState !== "idle"} className="mt-2 flex w-full items-center justify-center rounded-xl bg-[#D84315] px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loginState === "starting" ? <Loader2 size={15} className="animate-spin" /> : "Hubungkan ChatGPT Business"}</button>
              </div> : <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">Kode sekali pakai</p>
                <div className="mt-1 flex items-center justify-center gap-2"><strong className="font-mono text-lg tracking-wider text-slate-900">{loginCode.userCode}</strong><button type="button" onClick={() => void navigator.clipboard.writeText(loginCode.userCode)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white" aria-label="Salin kode"><Copy size={14} /></button></div>
                <a href={loginCode.verificationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#172436] px-3 py-2 text-xs font-semibold text-white"><ExternalLink size={12} /> Buka halaman login</a>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><Loader2 size={11} className="animate-spin" /> Menunggu konfirmasi login…</p>
              </div>}
            </div>}
            {telegramUrl && <a href={telegramUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#168AC0]"><Send size={14} /> Akses melalui bot Telegram</a>}
          </div>
          <div><p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Coba tanyakan</p><div className="grid gap-2">{suggestions.map((suggestion, index) => { const Icon = suggestionIcons[index]; return <button type="button" key={suggestion} disabled={status?.connected === false} onClick={() => void sendMessage(suggestion)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-xs font-medium leading-5 text-slate-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#B9380D]"><Icon size={16} /></span><span className="min-w-0 flex-1">{suggestion}</span><ArrowUpRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-[#B9380D]" /></button>; })}</div></div>
        </div>}
        <div className="space-y-3">{messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#D84315] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm"}`}><MessageContent content={message.content} />{Boolean(message.attachmentNames?.length) && <div className="mt-2 flex flex-wrap gap-1">{message.attachmentNames!.map((name) => <span key={name} className="rounded-lg bg-white/20 px-2 py-0.5 text-[10px]">📎 {name}</span>)}</div>}{message.role === "assistant" && Boolean(message.sources?.length) && <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sumber data</p>{message.sources!.map((source) => { const dateLabel = sourceDateLabel(source); return <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 rounded-lg px-1 py-1 text-[#D84315] transition hover:bg-orange-50"><ExternalLink size={11} className="mt-1 shrink-0" /><span className="min-w-0"><span className="block text-[11px] font-semibold leading-4">{source.title || source.label}</span><span className="block text-[9px] font-medium leading-4 text-slate-400">{[source.domain || source.label, dateLabel].filter(Boolean).join(" · ")}</span></span></a>; })}</div>}</div></div>)}</div>
        {(assistantActions.pending || assistantActions.result) && <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5 ${assistantActions.result?.ok === false ? "border-red-200 bg-red-50 text-red-700" : "border-orange-200 bg-orange-50 text-orange-800"}`}><Compass size={15} className="mt-0.5 shrink-0" /><span>{assistantActions.pending ? "Membuka dan menyesuaikan tampilan…" : assistantActions.result?.message}</span></div>}
        {isSending && <div className="mt-3 flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm"><Loader2 size={15} className="animate-spin text-[#D84315]" /> Mencari dan memeriksa data…</div></div>}
        {error && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</div>}
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] text-slate-400">Gambar dan berkas teks diproses untuk pesan ini saja.</p>{messages.length > 0 && <button type="button" onClick={() => { setMessages([]); setError(null); }} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-[#D84315]"><RotateCcw size={11} /> Hapus chat</button>}</div>{pendingFiles.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{pendingFiles.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[11px] text-orange-800">{IMAGE_TYPES.has(attachmentMimeType(file)) ? <ImageIcon size={12} /> : <FileText size={12} />}<span className="max-w-[190px] truncate">{file.name}</span><button type="button" onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Hapus lampiran ${file.name}`}><X size={12} /></button></span>)}</div>}<form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex items-end gap-2"><input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,.txt,.md,.csv,.json" className="sr-only" onChange={(event) => addAttachments(event.target.files)} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSending || status?.connected === false} className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-orange-300 hover:text-[#D84315] disabled:opacity-40" aria-label="Tambahkan gambar atau berkas" title="PNG, JPG, WebP, TXT, MD, CSV, JSON"><Paperclip size={18} /></button><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} placeholder="Tanyakan data pemberdayaan…" className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-orange-300 focus:bg-white" /><button type="submit" disabled={(!input.trim() && pendingFiles.length === 0) || isSending || status?.connected === false} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D84315] text-white transition hover:bg-[#BF360C] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Kirim pertanyaan"><Send size={17} /></button></form></div>
    </section>;
}
