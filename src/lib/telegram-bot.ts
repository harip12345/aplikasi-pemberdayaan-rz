import { runDataAssistant, type AssistantInputMessage } from "@/lib/ai-assistant";

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

function sourceAppendix(sources: Array<{ label: string; url: string }>) {
  const unique = [...new Map(sources.map((source) => [source.url, source])).values()];
  return unique.length ? `\n\nSumber data:\n${unique.map((source) => `• ${source.label}: ${source.url}`).join("\n")}` : "";
}

const HELP_TEXT = `Asisten Data Program RZ

Kirim pertanyaan data atau informasi program seperti:
• Berapa total Peserta Program Januari–Juli 2026?
• Lampirkan desa yang ada di Papua.
• Kota dengan jumlah Muzaki terbanyak?
• Berapa Munfik per sumber sampai Juli?
• Apa itu program Rumah Vokasi?
• Jelaskan konsep Desa Berdaya berdasarkan katalog program.
• Program apa yang sesuai untuk pemberdayaan ekonomi mustahik?

Perintah:
/tanya <pertanyaan> — bertanya di grup atau chat pribadi
/reset — hapus konteks percakapan
/help — tampilkan panduan`;

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
    await sendText(message.chat.id, HELP_TEXT, message.message_id);
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
    const result = await runDataAssistant(input);
    const responseText = `${result.message}${sourceAppendix(result.sources)}`;
    await sendText(message.chat.id, responseText, message.message_id);
    state.conversations.set(message.chat.id, {
      messages: [...input, { role: "assistant" as const, content: result.message }].slice(-12),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Telegram bot gagal menjawab:", error instanceof Error ? error.message : error);
    await sendText(message.chat.id, "Maaf, data belum dapat diproses saat ini. Silakan coba kembali beberapa saat lagi.", message.message_id);
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
