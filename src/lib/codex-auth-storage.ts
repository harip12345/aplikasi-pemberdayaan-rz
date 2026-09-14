import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { del, get, put } from "@vercel/blob";

const AUTH_BLOB_PATH = "rz-dashboard/codex-auth.v1.enc";
const AUTH_REFRESH_LOCK_PATH = "rz-dashboard/codex-auth-refresh-lock.v1.json";
const AUTH_HOME = join(tmpdir(), "rz-dashboard-codex");
const AUTH_FILE = join(AUTH_HOME, "auth.json");
const CONFIG_FILE = join(AUTH_HOME, "config.toml");
const AUTH_AAD = Buffer.from("rz-dashboard:codex-auth:v1", "utf8");

type EncryptedAuth = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

let preparePromise: Promise<string | null> | null = null;
let restoredEtag: string | null = null;
let lastSavedHash: string | null = null;

type StoredAuth = {
  auth: Buffer;
  etag: string;
};

type RefreshLock = {
  version: 1;
  owner: string;
  expiresAt: number;
};

export type CodexAuthPersistenceStatus = {
  configured: boolean;
  stored: boolean;
  local: boolean;
  lastRefreshAt: string | null;
  accessTokenExpiresAt: string | null;
  refreshDue: boolean;
  storageError: string | null;
};

function hasBlobCredential() {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  const hasStore = Boolean(process.env.BLOB_STORE_ID?.trim());
  const hasOidcRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN?.trim());
  return hasStore && hasOidcRuntime;
}

export function isCodexAuthPersistenceConfigured() {
  return Boolean(process.env.CODEX_AUTH_ENCRYPTION_KEY?.trim() && hasBlobCredential());
}

function encryptionKey() {
  const raw = process.env.CODEX_AUTH_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("CODEX_AUTH_ENCRYPTION_KEY belum dikonfigurasi.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CODEX_AUTH_ENCRYPTION_KEY harus berupa Base64 dari kunci acak 32 byte.");
  }
  return key;
}

function digest(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function authRefreshTime(value: Buffer) {
  try {
    const parsed = JSON.parse(value.toString("utf8")) as { last_refresh?: unknown };
    if (typeof parsed.last_refresh !== "string") return 0;
    const timestamp = Date.parse(parsed.last_refresh);
    return Number.isFinite(timestamp) ? timestamp : 0;
  } catch {
    return 0;
  }
}

function findStringProperty(value: unknown, property: string): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringProperty(item, property);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record[property] === "string" && record[property]) return record[property];
  for (const nested of Object.values(record)) {
    const found = findStringProperty(nested, property);
    if (found) return found;
  }
  return null;
}

function accessTokenExpiry(value: Buffer) {
  try {
    const parsed = JSON.parse(value.toString("utf8")) as unknown;
    const token = findStringProperty(parsed, "access_token");
    if (!token) return 0;
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function refreshDue(value: Buffer, skewMs = Number(process.env.CODEX_AUTH_REFRESH_SKEW_MS || 10 * 60 * 1000)) {
  const expiresAt = accessTokenExpiry(value);
  if (expiresAt) return expiresAt <= Date.now() + Math.max(60_000, skewMs);
  const refreshedAt = authRefreshTime(value);
  if (!refreshedAt) return true;

  return refreshedAt <= Date.now() - 45 * 60 * 1000;
}

async function writeAuthFile(auth: Buffer) {
  const temporaryFile = `${AUTH_FILE}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporaryFile, auth, { mode: 0o600 });
  await rename(temporaryFile, AUTH_FILE);
}

function encrypt(value: Buffer): EncryptedAuth {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(AUTH_AAD);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decrypt(raw: string) {
  const envelope = JSON.parse(raw) as Partial<EncryptedAuth>;
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm" || !envelope.iv || !envelope.tag || !envelope.ciphertext) {
    throw new Error("Format penyimpanan autentikasi Codex tidak dikenali.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(AUTH_AAD);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
}

async function readStoredAuth(): Promise<StoredAuth | null> {
  const stored = await get(AUTH_BLOB_PATH, { access: "private", useCache: false });
  if (stored?.statusCode !== 200) return null;
  const encrypted = await new Response(stored.stream).text();
  return { auth: decrypt(encrypted), etag: stored.blob.etag };
}

async function installStoredAuth(stored: StoredAuth) {
  await writeAuthFile(stored.auth);
  restoredEtag = stored.etag;
  lastSavedHash = digest(stored.auth);
}

export async function preparePersistentCodexHome() {
  if (!isCodexAuthPersistenceConfigured()) return null;
  if (preparePromise) return preparePromise;
  const preparing = (async () => {
    await mkdir(AUTH_HOME, { recursive: true });
    await writeFile(CONFIG_FILE, 'cli_auth_credentials_store = "file"\ncheck_for_update_on_startup = false\n', { mode: 0o600 });

    const stored = await readStoredAuth();
    if (stored) await installStoredAuth(stored);
    return AUTH_HOME;
  })();
  preparePromise = preparing;
  try {
    return await preparing;
  } catch (error) {
    // Kegagalan Blob sementara pada cold start tidak boleh merusak instance
    // sampai selamanya; panggilan berikutnya mendapat satu kesempatan baru.
    if (preparePromise === preparing) preparePromise = null;
    throw error;
  }
}

export async function syncPersistentCodexAuth() {
  if (!isCodexAuthPersistenceConfigured()) return false;
  await preparePersistentCodexHome();
  const stored = await readStoredAuth();
  if (!stored || stored.etag === restoredEtag) return false;
  await installStoredAuth(stored);
  return true;
}

export async function restorePersistentCodexAuth() {
  if (!isCodexAuthPersistenceConfigured()) return false;
  await preparePersistentCodexHome();
  const stored = await readStoredAuth();
  if (!stored) return false;
  await installStoredAuth(stored);
  return true;
}

async function readLocalAuth() {
  try {
    return await readFile(AUTH_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function localCodexAuthNeedsRefresh() {
  const auth = await readLocalAuth();
  return auth ? refreshDue(auth) : true;
}

export async function inspectCodexAuthPersistence(): Promise<CodexAuthPersistenceStatus> {
  const configured = isCodexAuthPersistenceConfigured();
  if (!configured) return { configured: false, stored: false, local: false, lastRefreshAt: null, accessTokenExpiresAt: null, refreshDue: true, storageError: null };
  let stored: StoredAuth | null = null;
  let storageError: string | null = null;
  try {
    stored = await readStoredAuth();
  } catch (error) {
    storageError = error instanceof Error ? error.message : "Private Blob tidak dapat dibaca.";
  }
  const local = await readLocalAuth();
  const selected = stored?.auth ?? local;
  const refreshedAt = selected ? authRefreshTime(selected) : 0;
  const expiresAt = selected ? accessTokenExpiry(selected) : 0;
  return {
    configured,
    stored: Boolean(stored),
    local: Boolean(local),
    lastRefreshAt: refreshedAt ? new Date(refreshedAt).toISOString() : null,
    accessTokenExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    refreshDue: selected ? refreshDue(selected) : true,
    storageError,
  };
}

async function readRefreshLock(): Promise<{ value: RefreshLock; etag: string } | null> {
  const stored = await get(AUTH_REFRESH_LOCK_PATH, { access: "private", useCache: false });
  if (stored?.statusCode !== 200) return null;
  const raw = await new Response(stored.stream).json() as Partial<RefreshLock>;
  if (raw.version !== 1 || typeof raw.owner !== "string" || typeof raw.expiresAt !== "number") return null;
  return { value: raw as RefreshLock, etag: stored.blob.etag };
}

async function acquireRefreshLock(waitMs = 12_000) {
  const owner = `${process.pid}-${randomBytes(12).toString("hex")}`;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const current = await readRefreshLock();
    const lock: RefreshLock = { version: 1, owner, expiresAt: Date.now() + 90_000 };
    if (!current || current.value.expiresAt <= Date.now()) {
      try {
        await put(AUTH_REFRESH_LOCK_PATH, JSON.stringify(lock), {
          access: "private",
          contentType: "application/json",
          cacheControlMaxAge: 60,
          addRandomSuffix: false,
          ...(current ? { ifMatch: current.etag } : { allowOverwrite: false }),
        });
        return owner;
      } catch {
        // Instance lain memenangkan lock. Tunggu hasil refresh tersimpan ke Blob.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250 + Math.floor(Math.random() * 250)));
  }
  return null;
}

async function releaseRefreshLock(owner: string) {
  try {
    const current = await readRefreshLock();
    if (current?.value.owner === owner) await del(AUTH_REFRESH_LOCK_PATH);
  } catch {
    // Lock memiliki masa berlaku, sehingga kegagalan cleanup tidak memblokir permanen.
  }
}

export async function withCodexAuthRefreshLock<T>(callback: () => Promise<T>) {
  if (!isCodexAuthPersistenceConfigured()) return callback();
  const owner = await acquireRefreshLock();
  if (!owner) return null;
  try {
    return await callback();
  } finally {
    await releaseRefreshLock(owner);
  }
}

async function waitForLocalAuthChange(waitForChangeMs: number) {
  const deadline = Date.now() + Math.max(0, waitForChangeMs);
  let auth = await readLocalAuth();
  while (auth && digest(auth) === lastSavedHash && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    auth = await readLocalAuth();
  }
  return auth;
}

export async function persistCodexAuth(options: { force?: boolean; waitForChangeMs?: number } = {}) {
  if (!isCodexAuthPersistenceConfigured()) return false;
  await preparePersistentCodexHome();
  const auth = options.waitForChangeMs
    ? await waitForLocalAuthChange(options.waitForChangeMs)
    : await readLocalAuth();
  if (!auth) return false;

  const currentHash = digest(auth);
  if (!options.force && currentHash === lastSavedHash) return false;

  const save = async (ifMatch?: string | null) => put(AUTH_BLOB_PATH, JSON.stringify(encrypt(auth)), {
    access: "private",
    contentType: "application/json",
    cacheControlMaxAge: 60,
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(ifMatch ? { ifMatch } : {}),
  });

  try {
    const result = await save(options.force ? null : restoredEtag);
    restoredEtag = result.etag;
    lastSavedHash = currentHash;
    return true;
  } catch (originalError) {
    // Another warm Vercel Function may have refreshed the same ChatGPT session.
    // Keep the freshest credential instead of repeatedly asking for admin login.
    let remote: StoredAuth | null;
    try {
      remote = await readStoredAuth();
    } catch {
      throw originalError;
    }
    if (!remote) throw originalError;

    const localRefresh = authRefreshTime(auth);
    const remoteRefresh = authRefreshTime(remote.auth);
    if (remoteRefresh > localRefresh || (remoteRefresh === localRefresh && digest(remote.auth) !== currentHash)) {
      await installStoredAuth(remote);
      return false;
    }

    const result = await save(remote.etag);
    restoredEtag = result.etag;
    lastSavedHash = currentHash;
    return true;
  }
}
