import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get, put } from "@vercel/blob";

const AUTH_BLOB_PATH = "rz-dashboard/codex-auth.v1.enc";
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
  preparePromise = (async () => {
    await mkdir(AUTH_HOME, { recursive: true });
    await writeFile(CONFIG_FILE, 'cli_auth_credentials_store = "file"\ncheck_for_update_on_startup = false\n', { mode: 0o600 });

    const stored = await readStoredAuth();
    if (stored) await installStoredAuth(stored);
    return AUTH_HOME;
  })();
  return preparePromise;
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
