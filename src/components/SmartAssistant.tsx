"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, Copy, Database, ExternalLink, Loader2, LogIn, MessageCircle, RotateCcw, Send, X } from "lucide-react";

type SourceLink = { label: string; url: string; updatedAt: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; sources?: SourceLink[]; usedTools?: string[] };
type ProviderStatus = { label?: string; model?: string; connected: boolean; loginAvailable?: boolean; planType?: string | null; message?: string };
type LoginCode = { verificationUrl: string; userCode: string };
type LoginEvent = { type: "code"; verificationUrl: string; userCode: string } | { type: "complete"; connected: true; planType?: string | null } | { type: "error"; message: string };

const SUGGESTIONS = [
  "Berapa total Peserta Program Januari–Juli 2026?",
  "Urutkan 5 program dengan peserta terbesar.",
  "Berapa Munfik per sumber sampai Juli?",
  "Apakah data Dashboard dan detail sudah cocok?",
  "Apa itu program Rumah Vokasi?",
];

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function InlineText({ children }: { children: string }) {
  return <>{children.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part)}</>;
}

function MessageContent({ content }: { content: string }) {
  return <div className="space-y-1 whitespace-pre-wrap">{content.split("\n").map((line, index) => <div key={index} className={line.trim().startsWith("-") ? "pl-1" : ""}><InlineText>{line || " "}</InlineText></div>)}</div>;
}

export function SmartAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginSecret, setLoginSecret] = useState("");
  const [loginCode, setLoginCode] = useState<LoginCode | null>(null);
  const [loginState, setLoginState] = useState<"idle" | "starting" | "waiting">("idle");
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (!loginSecret.trim() || loginState !== "idle") return;
    setError(null); setLoginCode(null); setLoginState("starting");
    try {
      const response = await fetch("/api/assistant/login", {
        method: "POST",
        headers: { "x-rz-login-secret": loginSecret.trim() },
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
      setStatus(nextStatus); setLoginSecret(""); setLoginCode(null);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login ChatGPT tidak berhasil.");
    } finally {
      setLoginState("idle");
    }
  };

  const sendMessage = async (suggested?: string) => {
    const content = (suggested ?? input).trim();
    if (!content || isSending || status?.connected === false) return;
    const userMessage: ChatMessage = { id: messageId(), role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages); setInput(""); setError(null); setIsSending(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })) }),
      });
      const payload = await response.json() as { message?: string; provider?: string; model?: string; usedTools?: string[]; sources?: SourceLink[] };
      if (!response.ok || !payload.message) throw new Error(payload.message || "Asisten belum dapat menjawab.");
      setMessages((current) => [...current, { id: messageId(), role: "assistant", content: payload.message!, sources: payload.sources, usedTools: payload.usedTools }]);
      if (payload.provider) setStatus((current) => ({ connected: true, label: payload.provider, model: payload.model, planType: current?.planType, message: current?.message }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Asisten belum dapat menjawab.");
    } finally { setIsSending(false); }
  };

  const providerText = status?.label || (status ? "Provider belum terhubung" : "Memeriksa koneksi…");
  const detailText = status?.planType ? `${providerText} · ${status.planType}` : providerText;

  return <>
    {!isOpen && <button type="button" onClick={() => setIsOpen(true)} className="fixed bottom-6 right-5 z-[70] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D84315] to-[#F26A2E] px-5 py-3.5 font-semibold text-white shadow-xl shadow-orange-900/25 transition hover:-translate-y-0.5 hover:shadow-2xl" aria-label="Buka Asisten Data Program RZ"><MessageCircle size={20} /><span className="hidden sm:inline">Asisten Program RZ</span></button>}

    {isOpen && <section className="fixed inset-x-3 bottom-3 top-20 z-[70] flex flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-[#F8FAFC] shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[680px] sm:w-[430px]" aria-label="Asisten Data Program RZ">
      <header className="flex items-center gap-3 bg-gradient-to-r from-[#172436] to-[#2D4057] px-4 py-3.5 text-white">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F2662F]"><Bot size={21} /></span>
        <div className="min-w-0 flex-1"><h2 className="font-bold">Asisten Data Program RZ</h2><p className="truncate text-[11px] text-white/65">{detailText}</p></div>
        {telegramUrl && <a href={telegramUrl} target="_blank" rel="noreferrer" className="rounded-xl p-2 text-white/75 transition hover:bg-white/10 hover:text-white" aria-label="Buka bot Telegram" title="Buka bot Telegram"><Send size={18} /></a>}
        <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-white/75 transition hover:bg-white/10 hover:text-white" aria-label="Tutup Asisten Data Program RZ"><X size={19} /></button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && <div className="space-y-4">
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#D84315]"><Database size={17} /><p className="text-xs font-bold uppercase tracking-wider">Siap membaca data</p></div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Tanyakan capaian, rincian peserta, validitas data, serta definisi dan informasi program berdasarkan katalog resmi.</p>
            <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-5 ${status?.connected === false ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
              {status?.connected === false ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : status ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin" />}
              <span>{status?.message || "Memeriksa koneksi model di server…"}</span>
            </div>
            {status?.connected === false && status.loginAvailable && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-slate-700"><LogIn size={15} /><p className="text-xs font-bold">Hubungkan ChatGPT Business</p></div>
              {!loginCode ? <div className="mt-2 flex gap-2">
                <input type="password" value={loginSecret} onChange={(event) => setLoginSecret(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void connectChatGPT(); }} placeholder="Secret admin login" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-orange-300" />
                <button type="button" onClick={() => void connectChatGPT()} disabled={!loginSecret.trim() || loginState !== "idle"} className="rounded-xl bg-[#D84315] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loginState === "starting" ? <Loader2 size={15} className="animate-spin" /> : "Login"}</button>
              </div> : <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">Kode sekali pakai</p>
                <div className="mt-1 flex items-center justify-center gap-2"><strong className="font-mono text-lg tracking-wider text-slate-900">{loginCode.userCode}</strong><button type="button" onClick={() => void navigator.clipboard.writeText(loginCode.userCode)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white" aria-label="Salin kode"><Copy size={14} /></button></div>
                <a href={loginCode.verificationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#172436] px-3 py-2 text-xs font-semibold text-white"><ExternalLink size={12} /> Buka halaman login</a>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><Loader2 size={11} className="animate-spin" /> Menunggu konfirmasi login…</p>
              </div>}
              <p className="mt-2 text-[10px] leading-4 text-slate-400">Kredensial tidak dikirim ke browser dan disimpan terenkripsi pada Private Blob.</p>
            </div>}
            {telegramUrl && <a href={telegramUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#168AC0]"><Send size={14} /> Akses melalui bot Telegram</a>}
          </div>
          <div className="grid gap-2">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} disabled={status?.connected === false} onClick={() => void sendMessage(suggestion)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">{suggestion}</button>)}</div>
        </div>}
        <div className="space-y-3">{messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#D84315] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm"}`}><MessageContent content={message.content} />{message.role === "assistant" && Boolean(message.sources?.length) && <div className="mt-3 border-t border-slate-100 pt-2"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sumber data</p>{message.sources!.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 py-0.5 text-[11px] font-semibold text-[#D84315] hover:underline"><ExternalLink size={11} />{source.label}</a>)}</div>}</div></div>)}</div>
        {isSending && <div className="mt-3 flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm"><Loader2 size={15} className="animate-spin text-[#D84315]" /> Mencari dan memeriksa data…</div></div>}
        {error && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</div>}
      </div>
      <div className="border-t border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] text-slate-400">Konfigurasi model dikelola melalui environment server.</p>{messages.length > 0 && <button type="button" onClick={() => { setMessages([]); setError(null); }} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-[#D84315]"><RotateCcw size={11} /> Hapus chat</button>}</div><form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} placeholder="Tanyakan data pemberdayaan…" className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-orange-300 focus:bg-white" /><button type="submit" disabled={!input.trim() || isSending || status?.connected === false} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D84315] text-white transition hover:bg-[#BF360C] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Kirim pertanyaan"><Send size={17} /></button></form></div>
    </section>}
  </>;
}
