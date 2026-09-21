import { runDataAssistant, type AssistantInputMessage } from "@/lib/ai-assistant";
import { aiProviderLabel, configuredAiProvider, configuredCodexModel, resolveHttpAiProvider } from "@/lib/ai-providers";
import { codexAppServer } from "@/lib/codex-app-server";
import { queryDashboardData } from "@/lib/ai-data-query";
import { REPORTING_MONTHS, reportingPeriodLabel, type ReportingPeriod } from "@/lib/reporting-period";

type TelegramChat = { id: number; type: "private" | "group" | "supergroup" | "channel" | string };
type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: { id: number; is_bot?: boolean; first_name?: string };
  text?: string;
};
export type TelegramUpdate = { update_id: number; message?: TelegramMessage };

type Conversation = { messages: AssistantInputMessage[]; updatedAt: number };
type TelegramState = {
  conversations: Map<number, Conversation>;
  processedUpdates: Map<number, number>;
  rateLimits: Map<number, { count: number; resetsAt: number }>;
  queues: Map<number, Promise<void>>;
  botProfile?: { username: string; url: string; expiresAt: number };
};

const globalTelegram = globalThis as typeof globalThis & { __rzTelegramState?: TelegramState };
const state: TelegramState = globalTelegram.__rzTelegramState ?? {
  conversations: new Map(), processedUpdates: new Map(), rateLimits: new Map(), queues: new Map(),
};
globalTelegram.__rzTelegramState = state;

const CONVERSATION_TTL_MS = 30 * 60_000;
const UPDATE_TTL_MS = 60 * 60_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;
const MAX_TELEGRAM_TEXT = 3900;

export async function getTelegramBotAccess() {
  const configuredUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (configuredUsername) return { username: configuredUsername, url: `https://t.me/${configuredUsername}` };
  if (state.botProfile && state.botProfile.expiresAt > Date.now()) return { username: state.botProfile.username, url: state.botProfile.url };
  const { token, apiUrl } = telegramConfig();
  if (!token) return null;
  const response = await fetch(`${apiUrl}/getMe`, { cache: "no-store" });
  const result = await response.json().catch(() => null) as { ok?: boolean; result?: { username?: string }; description?: string } | null;
  const username = result?.result?.username?.trim();
  if (!response.ok || !result?.ok || !username) throw new Error(result?.description || "Username bot Telegram tidak dapat dibaca.");
  const profile = { username, url: `https://t.me/${username}`, expiresAt: Date.now() + 24 * 60 * 60_000 };
  state.botProfile = profile;
  return { username: profile.username, url: profile.url };
}

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum dikonfigurasi.");
  return { token, apiUrl: `https://api.telegram.org/bot${token}` };
}

function cleanup(now = Date.now()) {
  state.conversations.forEach((value, key) => { if (now - value.updatedAt > CONVERSATION_TTL_MS) state.conversations.delete(key); });
  state.processedUpdates.forEach((timestamp, key) => { if (now - timestamp > UPDATE_TTL_MS) state.processedUpdates.delete(key); });
  state.rateLimits.forEach((value, key) => { if (value.resetsAt <= now) state.rateLimits.delete(key); });
}

export function acceptTelegramUpdate(updateId: number) {
  cleanup();
  if (state.processedUpdates.has(updateId)) return false;
  state.processedUpdates.set(updateId, Date.now());
  return true;
}

function withinRateLimit(userId: number) {
  const now = Date.now();
  const current = state.rateLimits.get(userId);
  if (!current || current.resetsAt <= now) {
    state.rateLimits.set(userId, { count: 1, resetsAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

async function telegramRequest(method: string, payload: Record<string, unknown>) {
  const { apiUrl } = telegramConfig();
  const response = await fetch(`${apiUrl}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !result?.ok) throw new Error(result?.description || `Telegram API gagal (${response.status}).`);
}

function plainTelegramText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```(?:\w+)?/g, ""))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function splitTelegramText(value: string) {
  const chunks: string[] = [];
  let remaining = value.trim();
  while (remaining.length > MAX_TELEGRAM_TEXT) {
    const window = remaining.slice(0, MAX_TELEGRAM_TEXT);
    const splitAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const safeSplit = splitAt > 500 ? splitAt : MAX_TELEGRAM_TEXT;
    chunks.push(remaining.slice(0, safeSplit).trim());
    remaining = remaining.slice(safeSplit).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendText(chatId: number, text: string, replyToMessageId?: number) {
  const chunks = splitTelegramText(plainTelegramText(text));
  for (let index = 0; index < chunks.length; index += 1) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: chunks[index],
      link_preview_options: { is_disabled: true },
      ...(index === 0 && replyToMessageId ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } } : {}),
    });
  }
}

async function sendTyping(chatId: number) {
  await telegramRequest("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => undefined);
}

function sourceAppendix(sources: Array<{ label: string; title?: string; domain?: string; url: string; publishedAt?: string; publicationDateStatus?: "available" | "unavailable" }>) {
  const unique = [...new Map(sources.map((source) => [source.url, source])).values()];
  return unique.length ? `\n\nSumber data:\n${unique.map((source) => {
    const parsedDate = source.publishedAt ? new Date(source.publishedAt) : null;
    const dateLabel = source.publicationDateStatus === "unavailable" || !parsedDate || Number.isNaN(parsedDate.getTime())
      ? "tanggal publikasi tidak tersedia"
      : parsedDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
    const metadata = source.domain ? ` — ${source.domain}; ${dateLabel}` : "";
    return `• ${source.title || source.label}${metadata}: ${source.url}`;
  }).join("\n")}` : "";
}

async function nationalReportingPeriod(): Promise<ReportingPeriod | undefined> {
  try {
    const dashboard = await queryDashboardData({ source: "dashboard" });
    return {
      startMonthIndex: dashboard.period.startMonthIndex,
      endMonthIndex: dashboard.period.endMonthIndex,
      year: dashboard.period.year,
    };
  } catch (error) {
    console.warn("Periode nasional Telegram tidak dapat dibaca:", error instanceof Error ? error.message : error);
    return undefined;
  }
}

async function telegramHelpText() {
  const period = await nationalReportingPeriod();
  const periodLabel = period ? reportingPeriodLabel(period) : "periode data nasional terbaru";
  const latestMonth = period ? REPORTING_MONTHS[period.endMonthIndex] : "periode terbaru";
  return `ASISTEN DATA PROGRAM RZ

Asisten ini membantu menelusuri capaian, peserta, wilayah, Desa Berdaya, validitas data, serta informasi program Rumah Zakat berdasarkan sumber resmi. Jika periode tidak disebutkan, bot menggunakan periode nasional terbaru: ${periodLabel}.

Kemampuan utama:
• Menghitung capaian, target, persentase, dan rincian peserta.
• Membuat peringkat atau perbandingan menurut program, wilayah, cabang, bulan, dan asnaf.
• Menampilkan daftar Desa Berdaya dan titik program.
• Menjelaskan definisi, tujuan, dan konsep program berdasarkan katalog resmi.
• Memeriksa kecocokan data Dashboard dengan sumber detail.

Contoh pertanyaan:
• Berapa total Peserta Program ${periodLabel}?
• Berapa Munfik per sumber sampai ${latestMonth}?
• Lampirkan desa yang ada di Papua.
• Kota dengan jumlah Muzaki terbanyak?
• Apa itu program Rumah Vokasi?

Perintah:
/tanya <pertanyaan> — ajukan pertanyaan di grup atau chat pribadi
/status — periksa kesiapan model AI
/reset — hapus konteks percakapan
/help — tampilkan panduan ini

Pada chat pribadi, pertanyaan dapat dikirim langsung tanpa /tanya.`;
}

async function assistantStatusText() {
  const provider = configuredAiProvider();
  if (provider === "codex") {
    const account = await codexAppServer.accountStatus();
    if (!account.connected) {
      return "Model AI belum terhubung ke akun ChatGPT pada server. Login admin perlu dilakukan satu kali; setelah tersimpan, bot dapat berjalan tanpa membuka web.";
    }
    return `Model AI siap digunakan.\nProvider: ${aiProviderLabel(provider)}\nModel: ${configuredCodexModel()}\nBot dapat menjawab langsung tanpa membuka aplikasi web.`;
  }
  const resolved = resolveHttpAiProvider();
  return `Model AI siap digunakan.\nProvider: ${resolved.label}\nModel: ${resolved.model}\nBot dapat menjawab langsung tanpa membuka aplikasi web.`;
}

function assistantErrorText(error: unknown) {
  const detail = error instanceof Error ? error.message : "Koneksi model tidak diketahui.";
  if (/belum terhubung|auth|login|token|credential/i.test(detail)) {
    return "Model AI belum terhubung ke akun ChatGPT pada server. Jalankan login admin satu kali dan pastikan penyimpanan autentikasi Vercel Blob aktif.";
  }
  if (/waktu|timeout|habis/i.test(detail)) {
    return "Model AI melewati batas waktu pemrosesan. Silakan coba kembali; proses cold start berikutnya biasanya lebih cepat.";
  }
  return `Model AI belum siap: ${detail}`;
}

function questionFromMessage(message: TelegramMessage) {
  const text = message.text?.trim() ?? "";
  if (message.chat.type === "private") return text.replace(/^\/(?:tanya|ask)(?:@\w+)?\s*/i, "").trim();
  const command = text.match(/^\/(?:tanya|ask)(?:@\w+)?(?:\s+([\s\S]+))?$/i);
  return command?.[1]?.trim() ?? "";
}

async function answerTelegramMessage(message: TelegramMessage) {
  if (!message.text || message.from?.is_bot) return;
  const text = message.text.trim();
  if (/^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(text)) {
    await sendText(message.chat.id, await telegramHelpText(), message.message_id);
    return;
  }
  if (/^\/status(?:@\w+)?(?:\s|$)/i.test(text)) {
    await sendTyping(message.chat.id);
    try {
      await sendText(message.chat.id, await assistantStatusText(), message.message_id);
    } catch (error) {
      console.error("Status model Telegram gagal dibaca:", error instanceof Error ? error.message : error);
      await sendText(message.chat.id, assistantErrorText(error), message.message_id);
    }
    return;
  }
  if (/^\/reset(?:@\w+)?(?:\s|$)/i.test(text)) {
    state.conversations.delete(message.chat.id);
    await sendText(message.chat.id, "Konteks percakapan sudah dihapus. Silakan mulai pertanyaan baru.", message.message_id);
    return;
  }
  const question = questionFromMessage(message);
  if (!question) {
    if (message.chat.type !== "private") return;
    await sendText(message.chat.id, "Tuliskan pertanyaan data Anda, atau gunakan /help untuk melihat contoh.", message.message_id);
    return;
  }
  const userId = message.from?.id ?? message.chat.id;
  if (!withinRateLimit(userId)) {
    await sendText(message.chat.id, "Batas penggunaan sementara tercapai. Silakan coba lagi dalam satu menit.", message.message_id);
    return;
  }
  await sendTyping(message.chat.id);
  const previous = state.conversations.get(message.chat.id);
  const history = previous && Date.now() - previous.updatedAt <= CONVERSATION_TTL_MS ? previous.messages : [];
  const input = [...history, { role: "user" as const, content: question }].slice(-12);
  try {
    const result = await runDataAssistant(input, await nationalReportingPeriod());
    const responseText = `${result.message}${sourceAppendix(result.sources)}`;
    await sendText(message.chat.id, responseText, message.message_id);
    state.conversations.set(message.chat.id, {
      messages: [...input, { role: "assistant" as const, content: result.message }].slice(-12),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Telegram bot gagal menjawab:", error instanceof Error ? error.message : error);
    await sendText(message.chat.id, `${assistantErrorText(error)} Silakan coba kembali beberapa saat lagi.`, message.message_id);
  }
}

export function enqueueTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message) return Promise.resolve();
  const previous = state.queues.get(message.chat.id) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(() => answerTelegramMessage(message));
  state.queues.set(message.chat.id, task);
  void task.finally(() => { if (state.queues.get(message.chat.id) === task) state.queues.delete(message.chat.id); });
  return task;
}
