import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function hasBlobCredential() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim()
      || (process.env.VERCEL_OIDC_TOKEN?.trim() && process.env.BLOB_STORE_ID?.trim()),
  );
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

export async function preparePersistentCodexHome() {
  if (!isCodexAuthPersistenceConfigured()) return null;
  if (preparePromise) return preparePromise;
  preparePromise = (async () => {
    await mkdir(AUTH_HOME, { recursive: true });
    await writeFile(CONFIG_FILE, 'cli_auth_credentials_store = "file"\ncheck_for_update_on_startup = false\n', { mode: 0o600 });

    const stored = await get(AUTH_BLOB_PATH, { access: "private", useCache: false });
    if (stored?.statusCode === 200) {
      const encrypted = await new Response(stored.stream).text();
      const auth = decrypt(encrypted);
      await writeFile(AUTH_FILE, auth, { mode: 0o600 });
      restoredEtag = stored.blob.etag;
      lastSavedHash = digest(auth);
    }
    return AUTH_HOME;
  })();
  return preparePromise;
}

export async function syncPersistentCodexAuth() {
  if (!isCodexAuthPersistenceConfigured()) return false;
  await preparePersistentCodexHome();
  const stored = await get(AUTH_BLOB_PATH, { access: "private", useCache: false });
  if (stored?.statusCode !== 200 || stored.blob.etag === restoredEtag) return false;
  const encrypted = await new Response(stored.stream).text();
  const auth = decrypt(encrypted);
  await writeFile(AUTH_FILE, auth, { mode: 0o600 });
  restoredEtag = stored.blob.etag;
  lastSavedHash = digest(auth);
  return true;
}

export async function persistCodexAuth(options: { force?: boolean } = {}) {
  if (!isCodexAuthPersistenceConfigured()) return false;
  await preparePersistentCodexHome();
  let auth: Buffer;
  try {
    auth = await readFile(AUTH_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }

  const currentHash = digest(auth);
  if (!options.force && currentHash === lastSavedHash) return false;
  const result = await put(AUTH_BLOB_PATH, JSON.stringify(encrypt(auth)), {
    access: "private",
    contentType: "application/json",
    cacheControlMaxAge: 60,
    allowOverwrite: true,
    ...(!options.force && restoredEtag ? { ifMatch: restoredEtag } : {}),
  });
  restoredEtag = result.etag;
  lastSavedHash = currentHash;
  return true;
}
