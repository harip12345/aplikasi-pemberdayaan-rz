import { existsSync, readFileSync } from "node:fs";

function loadEnvironmentFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvironmentFile(".env.local");
loadEnvironmentFile(".env");

const command = process.argv[2] || "info";
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
const publicUrl = (
  vercelProductionHost
    ? `https://${vercelProductionHost}`
    : process.env.TELEGRAM_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || ""
).replace(/\/$/, "");

if (!token && command !== "sync") throw new Error("TELEGRAM_BOT_TOKEN wajib diisi di environment server.");

async function telegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API gagal (${response.status}).`);
  return result.result;
}

if (command === "set" || command === "sync") {
  if (command === "sync" && (!token || !secret || !publicUrl || (process.env.VERCEL && process.env.VERCEL_ENV !== "production"))) {
    console.log("Sinkronisasi webhook dilewati: hanya dijalankan pada deployment Production dengan konfigurasi Telegram lengkap.");
    process.exit(0);
  }
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET wajib diisi. Gunakan kombinasi acak huruf, angka, _ atau -.");
  if (!/^https:\/\//i.test(publicUrl)) throw new Error("TELEGRAM_PUBLIC_URL atau NEXT_PUBLIC_APP_URL harus berupa alamat publik HTTPS.");
  const url = `${publicUrl}/api/telegram/webhook`;
  const result = await telegram("setWebhook", { url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false });
  console.log(`Webhook aktif: ${url}`);
  console.log(result);
} else if (command === "delete") {
  const result = await telegram("deleteWebhook", { drop_pending_updates: false });
  console.log("Webhook dihapus.");
  console.log(result);
} else {
  console.log(await telegram("getWebhookInfo"));
}
