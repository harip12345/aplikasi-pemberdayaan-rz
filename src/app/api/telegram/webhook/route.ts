import { after, NextResponse } from "next/server";
import { acceptTelegramUpdate, enqueueTelegramUpdate, getTelegramBotAccess, type TelegramUpdate } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Cold-starting Codex, restoring its encrypted auth, and completing a model turn
// can exceed the old 120-second ceiling. Vercel will cap this to the project plan.
export const maxDuration = 300;

export async function GET() {
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
  const bot = configured ? await getTelegramBotAccess().catch(() => null) : null;
  return NextResponse.json({ service: "Asisten Data Program RZ", configured, botUsername: bot?.username ?? null, botUrl: bot?.url ?? null });
}

export async function POST(request: Request) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!configuredSecret || !process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    return NextResponse.json({ ok: false, message: "Integrasi Telegram belum dikonfigurasi." }, { status: 503 });
  }
  if (request.headers.get("x-telegram-bot-api-secret-token") !== configuredSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!Number.isInteger(update.update_id)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!acceptTelegramUpdate(update.update_id)) return NextResponse.json({ ok: true, duplicate: true });
  after(async () => {
    try {
      await enqueueTelegramUpdate(update);
    } catch (error) {
      console.error("Pemrosesan update Telegram gagal:", error instanceof Error ? error.message : error);
    }
  });
  return NextResponse.json({ ok: true });
}
