import { after, NextResponse } from "next/server";
import { acceptTelegramUpdate, enqueueTelegramUpdate, type TelegramUpdate } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export function GET() {
  return NextResponse.json({ service: "RZ Telegram Data Assistant", configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET) });
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
  after(async () => { await enqueueTelegramUpdate(update); });
  return NextResponse.json({ ok: true });
}

