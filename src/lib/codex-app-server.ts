import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { configuredCodexModel } from "@/lib/ai-providers";
import {
  isCodexAuthPersistenceConfigured,
  localCodexAuthNeedsRefresh,
  persistCodexAuth,
  preparePersistentCodexHome,
  restorePersistentCodexAuth,
  syncPersistentCodexAuth,
  withCodexAuthRefreshLock,
} from "@/lib/codex-auth-storage";

type JsonRecord = Record<string, unknown>;
type DynamicTool = { type: "function"; name: string; description: string; inputSchema: JsonRecord };
type ToolHandler = (name: string, args: JsonRecord) => Promise<unknown>;
type TurnState = {
  answer: string;
  resolve: (answer: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  onToolCall: ToolHandler;
};
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type LoginResult = { success: boolean; error: string | null };
type LoginWaiter = {
  resolve: (value: LoginResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type AccountStatus = { connected: boolean; authType: string | null; email: string | null; planType: string | null };

const REQUEST_TIMEOUT_MS = 30_000;
const TURN_TIMEOUT_MS = Number(process.env.CODEX_TURN_TIMEOUT_MS || 120_000);
const ACCOUNT_CACHE_MS = 10 * 60 * 1000;
const DISCONNECTED_ACCOUNT_CACHE_MS = 5_000;
const moduleRequire = createRequire(import.meta.url);

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function errorMessage(value: unknown, fallback: string) {
  const item = record(value);
  return typeof item?.message === "string" ? item.message : fallback;
}

function existingFile(path: string | undefined) {
  if (!path) return null;
  try { return existsSync(path) && statSync(path).isFile() ? path : null; } catch { return null; }
}

function newestCodexDesktopBinary(binRoot: string) {
  try {
    const candidates = readdirSync(binRoot, { withFileTypes: true }).flatMap((entry) => {
      const path = entry.isDirectory() ? join(binRoot, entry.name, "codex.exe") : entry.name.toLowerCase() === "codex.exe" ? join(binRoot, entry.name) : "";
      const file = existingFile(path);
      if (!file) return [];
      return [{ file, modifiedAt: statSync(file).mtimeMs }];
    });
    return candidates.sort((a, b) => b.modifiedAt - a.modifiedAt)[0]?.file || null;
  } catch { return null; }
}

function packagedCodexExecutable() {
  const packages: Record<string, { packageName: string; target: string }> = {
    "linux-x64": { packageName: "@openai/codex-linux-x64", target: "x86_64-unknown-linux-musl" },
    "linux-arm64": { packageName: "@openai/codex-linux-arm64", target: "aarch64-unknown-linux-musl" },
    "win32-x64": { packageName: "@openai/codex-win32-x64", target: "x86_64-pc-windows-msvc" },
    "win32-arm64": { packageName: "@openai/codex-win32-arm64", target: "aarch64-pc-windows-msvc" },
    "darwin-x64": { packageName: "@openai/codex-darwin-x64", target: "x86_64-apple-darwin" },
    "darwin-arm64": { packageName: "@openai/codex-darwin-arm64", target: "aarch64-apple-darwin" },
  };
  const selected = packages[`${process.platform}-${process.arch}`];
  if (!selected) return null;
  const packageRoots = new Set<string>();
  try {
    const packageJson = moduleRequire.resolve(`${selected.packageName}/package.json`);
    packageRoots.add(dirname(packageJson));
  } catch { /* Next.js may relocate dynamically resolved optional packages. */ }

  packageRoots.add(join(process.cwd(), "node_modules", ...selected.packageName.split("/")));
  packageRoots.add(join(process.cwd(), ".next", "server", "node_modules", ...selected.packageName.split("/")));
  try {
    const codexPackageRoot = dirname(moduleRequire.resolve("@openai/codex/package.json"));
    const nodeModulesRoot = dirname(dirname(codexPackageRoot));
    packageRoots.add(join(nodeModulesRoot, ...selected.packageName.split("/")));
  } catch { /* The explicit cwd candidates above remain available. */ }

  for (const packageRoot of packageRoots) {
    const binary = existingFile(join(packageRoot, "vendor", selected.target, "bin", process.platform === "win32" ? "codex.exe" : "codex"));
    if (binary) return binary;
  }
  return null;
}

export function resolveCodexExecutable() {
  const configured = process.env.CODEX_CLI_PATH?.trim();
  if (configured && configured.toLowerCase() !== "codex") {
    if (/[/\\]/.test(configured) && !existingFile(configured)) throw new Error(`CODEX_CLI_PATH tidak ditemukan: ${configured}`);
    return configured;
  }
  const packaged = packagedCodexExecutable();
  if (packaged) return packaged;
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? join(process.env.USERPROFILE, "AppData", "Local") : "");
    const standalone = existingFile(localAppData ? join(localAppData, "Programs", "OpenAI", "Codex", "bin", "codex.exe") : undefined);
    if (standalone) return standalone;
    const desktop = localAppData ? newestCodexDesktopBinary(join(localAppData, "OpenAI", "Codex", "bin")) : null;
    if (desktop) return desktop;
  }
  if (process.env.VERCEL) {
    throw new Error(`Binary Codex untuk ${process.platform}-${process.arch} tidak ikut dalam Vercel Function. Jangan isi CODEX_CLI_PATH; lakukan redeploy tanpa cache setelah dependency platform terpasang.`);
  }
  return "codex";
}

class CodexAppServerClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private starting: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private turns = new Map<string, TurnState>();
  private logins = new Map<string, LoginWaiter>();
  private completedLogins = new Map<string, LoginResult>();
  private stderr = "";
  private lastAuthSyncAt = 0;
  private authRestartNeeded = false;
  private accountCache: { value: AccountStatus; expiresAt: number } | null = null;
  private accountStatusPromise: Promise<AccountStatus> | null = null;

  private send(message: JsonRecord) {
    if (!this.process?.stdin.writable) throw new Error("Proses Codex App Server tidak aktif.");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private request(method: string, params: JsonRecord, timeoutMs = REQUEST_TIMEOUT_MS) {
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server tidak merespons permintaan ${method}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ method, id, params });
    });
  }

  private handleResponse(message: JsonRecord) {
    if (typeof message.id !== "number") return false;
    const pending = this.pending.get(message.id);
    if (!pending) return false;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(errorMessage(message.error, "Permintaan Codex App Server gagal.")));
    else pending.resolve(message.result);
    return true;
  }

  private async handleToolRequest(message: JsonRecord) {
    const params = record(message.params);
    const threadId = typeof params?.threadId === "string" ? params.threadId : "";
    const state = this.turns.get(threadId);
    if (!state || typeof message.id !== "number" || typeof params?.tool !== "string") return;
    try {
      const args = record(params.arguments) || {};
      const result = await state.onToolCall(params.tool, args);
      this.send({ id: message.id, result: { contentItems: [{ type: "inputText", text: JSON.stringify(result) }], success: true } });
    } catch (error) {
      this.send({ id: message.id, result: { contentItems: [{ type: "inputText", text: error instanceof Error ? error.message : "Fungsi data gagal dijalankan." }], success: false } });
    }
  }

  private handleNotification(message: JsonRecord) {
    const params = record(message.params);
    if (message.method === "account/updated") {
      this.accountCache = null;
      return;
    }
    if (message.method === "account/login/completed") {
      const loginId = typeof params?.loginId === "string" ? params.loginId : "";
      const waiter = this.logins.get(loginId);
      const result = {
        success: params?.success === true,
        error: typeof params?.error === "string" ? params.error : null,
      };
      if (!waiter) {
        if (loginId) this.completedLogins.set(loginId, result);
        return;
      }
      this.logins.delete(loginId);
      clearTimeout(waiter.timer);
      waiter.resolve(result);
      return;
    }
    const threadId = typeof params?.threadId === "string" ? params.threadId : "";
    const state = this.turns.get(threadId);
    if (!state) return;

    if (message.method === "item/completed") {
      const item = record(params?.item);
      if (item?.type === "agentMessage" && typeof item.text === "string" && item.text.trim()) state.answer = item.text.trim();
      return;
    }

    if (message.method === "turn/completed") {
      this.turns.delete(threadId);
      clearTimeout(state.timer);
      const turn = record(params?.turn);
      if (turn?.status === "failed") state.reject(new Error(errorMessage(turn.error, "Codex gagal menyelesaikan jawaban.")));
      else if (!state.answer) state.reject(new Error("Codex menyelesaikan proses tanpa jawaban teks."));
      else state.resolve(state.answer);
    }
  }

  private handleLine(line: string) {
    let message: JsonRecord | null = null;
    try { message = record(JSON.parse(line)); } catch { return; }
    if (!message) return;
    if (message.method === "item/tool/call") void this.handleToolRequest(message);
    else if (this.handleResponse(message)) return;
    else this.handleNotification(message);
  }

  private failAll(reason: Error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(reason); }
    for (const turn of this.turns.values()) { clearTimeout(turn.timer); turn.reject(reason); }
    for (const login of this.logins.values()) { clearTimeout(login.timer); login.reject(reason); }
    this.pending.clear();
    this.turns.clear();
    this.logins.clear();
    this.completedLogins.clear();
  }

  private async syncPersistentAuth() {
    if (!isCodexAuthPersistenceConfigured()) return;
    if (Date.now() - this.lastAuthSyncAt >= 2_000) {
      this.lastAuthSyncAt = Date.now();
      if (await syncPersistentCodexAuth()) this.authRestartNeeded = true;
    }
    if (!this.authRestartNeeded || !this.process || this.turns.size > 0 || this.pending.size > 0) return;
    const child = this.process;
    this.process = null;
    this.starting = null;
    this.authRestartNeeded = false;
    child.kill();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 1_000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    this.accountCache = null;
  }

  private async restartForRestoredAuth() {
    const child = this.process;
    this.process = null;
    this.starting = null;
    this.authRestartNeeded = false;
    this.accountCache = null;
    if (!child || child.killed) return;
    child.kill();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 1_000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }

  async ensureStarted() {
    if (this.process && !this.process.killed) return;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const executable = resolveCodexExecutable();
      const persistentHome = await preparePersistentCodexHome();
      const child = spawn(executable, ["app-server", "--stdio"], {
        cwd: process.cwd(),
        env: { ...process.env, ...(persistentHome ? { CODEX_HOME: persistentHome } : {}) },
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.process = child;
      this.stderr = "";
      createInterface({ input: child.stdout }).on("line", (line) => this.handleLine(line));
      child.stderr.on("data", (chunk: Buffer) => { this.stderr = `${this.stderr}${chunk.toString()}`.slice(-4000); });
      child.once("error", (error) => {
        if (this.process === child) {
          this.process = null;
          this.starting = null;
          const hint = error.message.includes("ENOENT") ? " Pastikan dependency @openai/codex terpasang atau tetapkan CODEX_CLI_PATH." : "";
          this.failAll(new Error(`Codex CLI tidak dapat dijalankan dari ${executable}: ${error.message}.${hint}`));
        }
      });
      child.once("exit", (code) => {
        const detail = this.stderr.trim();
        if (this.process === child) {
          this.process = null;
          this.starting = null;
          this.failAll(new Error(`Codex App Server berhenti (kode ${code ?? "tidak diketahui"}).${detail ? ` ${detail}` : ""}`));
        }
      });
      await this.request("initialize", {
        clientInfo: { name: "rz_empowerment_dashboard", title: "RZ Empowerment Dashboard", version: "1.0.0" },
        capabilities: { experimentalApi: true },
      });
      this.send({ method: "initialized", params: {} });
    })();
    try { await this.starting; } finally { this.starting = null; }
  }

  async accountStatus() {
    await this.syncPersistentAuth();
    await this.ensureStarted();
    if (this.accountCache && this.accountCache.expiresAt > Date.now()) return this.accountCache.value;
    if (this.accountStatusPromise) return this.accountStatusPromise;
    this.accountStatusPromise = this.readAndPersistAccountStatus();
    try {
      return await this.accountStatusPromise;
    } finally {
      this.accountStatusPromise = null;
    }
  }

  private async readAccount(refreshToken = false): Promise<AccountStatus> {
    const result = record(await this.request("account/read", { refreshToken }));
    const account = record(result?.account);
    return {
      connected: account?.type === "chatgpt",
      authType: typeof account?.type === "string" ? account.type : null,
      email: typeof account?.email === "string" ? account.email : null,
      planType: typeof account?.planType === "string" ? account.planType : null,
    };
  }

  async refreshAuthenticationIfNeeded(force = false) {
    await this.syncPersistentAuth();
    await this.ensureStarted();
    const shouldRefresh = force || await localCodexAuthNeedsRefresh();
    if (!shouldRefresh) {
      const value = await this.readAccount(false);
      this.accountCache = { value, expiresAt: Date.now() + (value.connected ? ACCOUNT_CACHE_MS : DISCONNECTED_ACCOUNT_CACHE_MS) };
      return { ...value, refreshed: false, lockAcquired: false };
    }

    const refreshed = await withCodexAuthRefreshLock(async () => {
      const changed = await syncPersistentCodexAuth();
      if (changed) await this.restartForRestoredAuth();
      await this.ensureStarted();

      // Instance lain mungkin sudah menyegarkan token sebelum lock didapatkan.
      if (!force && !await localCodexAuthNeedsRefresh()) {
        return { value: await this.readAccount(false), refreshed: false };
      }
      const value = await this.readAccount(true);
      if (value.connected) await persistCodexAuth({ force: true, waitForChangeMs: 1_500 });
      return { value, refreshed: value.connected };
    });

    if (refreshed) {
      this.accountCache = { value: refreshed.value, expiresAt: Date.now() + (refreshed.value.connected ? ACCOUNT_CACHE_MS : DISCONNECTED_ACCOUNT_CACHE_MS) };
      return { ...refreshed.value, refreshed: refreshed.refreshed, lockAcquired: true };
    }

    // Lock sedang dipegang instance lain. Ambil hasil akhirnya dari Blob satu kali.
    if (await restorePersistentCodexAuth()) {
      await this.restartForRestoredAuth();
      await this.ensureStarted();
    }
    const value = await this.readAccount(false);
    this.accountCache = { value, expiresAt: Date.now() + (value.connected ? ACCOUNT_CACHE_MS : DISCONNECTED_ACCOUNT_CACHE_MS) };
    return { ...value, refreshed: false, lockAcquired: false };
  }

  private async readAndPersistAccountStatus() {
    // Membaca status tidak boleh memutar refresh token pada setiap cold start.
    // Codex hanya diminta refresh ketika JWT mendekati kedaluwarsa.
    if (await localCodexAuthNeedsRefresh()) {
      const refreshed = await this.refreshAuthenticationIfNeeded();
      return { connected: refreshed.connected, authType: refreshed.authType, email: refreshed.email, planType: refreshed.planType };
    }

    let value = await this.readAccount(false);
    if (!value.connected && isCodexAuthPersistenceConfigured() && await restorePersistentCodexAuth()) {
      await this.restartForRestoredAuth();
      await this.ensureStarted();
      value = await this.readAccount(false);
      if (!value.connected && await localCodexAuthNeedsRefresh()) {
        const refreshed = await this.refreshAuthenticationIfNeeded();
        value = { connected: refreshed.connected, authType: refreshed.authType, email: refreshed.email, planType: refreshed.planType };
      }
    }

    this.accountCache = {
      value,
      expiresAt: Date.now() + (value.connected ? ACCOUNT_CACHE_MS : DISCONNECTED_ACCOUNT_CACHE_MS),
    };
    await persistCodexAuth({ waitForChangeMs: 750 }).catch((error) => console.error("Gagal menyinkronkan autentikasi Codex:", error instanceof Error ? error.message : error));
    return value;
  }

  async startDeviceLogin() {
    await this.syncPersistentAuth();
    await this.ensureStarted();
    this.accountCache = null;
    const result = record(await this.request("account/login/start", { type: "chatgptDeviceCode" }));
    const loginId = typeof result?.loginId === "string" ? result.loginId : "";
    const verificationUrl = typeof result?.verificationUrl === "string" ? result.verificationUrl : "";
    const userCode = typeof result?.userCode === "string" ? result.userCode : "";
    if (!loginId || !verificationUrl || !userCode) throw new Error("Codex tidak memberikan kode login yang lengkap.");
    return { loginId, verificationUrl, userCode };
  }

  async waitForDeviceLogin(loginId: string, timeoutMs = 240_000) {
    const earlyResult = this.completedLogins.get(loginId);
    if (earlyResult) this.completedLogins.delete(loginId);
    const completed = earlyResult || await new Promise<LoginResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.logins.delete(loginId);
        reject(new Error("Waktu login habis. Mulai ulang proses login dan masukkan kode baru."));
      }, timeoutMs);
      this.logins.set(loginId, { resolve, reject, timer });
    });
    if (!completed.success) throw new Error(completed.error || "Login ChatGPT tidak berhasil.");
    this.accountCache = null;
    const status = await this.accountStatus();
    if (!status.connected) throw new Error("Login selesai, tetapi akun ChatGPT belum terbaca oleh Codex.");
    await persistCodexAuth({ force: true });
    return status;
  }

  async runTurn(options: { instructions: string; conversation: string; tools: DynamicTool[]; onToolCall: ToolHandler }) {
    // accountStatus synchronizes the encrypted auth file before starting Codex.
    // Keep this order: starting first could make a cold Telegram invocation load
    // stale credentials and only recover after the web assistant was opened.
    const status = await this.accountStatus();
    if (!status.connected) {
      const hint = process.env.NODE_ENV === "production"
        ? "Admin perlu menghubungkan ulang ChatGPT Business atau memeriksa kredensial terenkripsi pada Private Blob."
        : "Jalankan `codex login` atau isi CODEX_ACCESS_TOKEN.";
      throw new Error(`Codex CLI belum terhubung dengan akun ChatGPT. ${hint}`);
    }

    const model = configuredCodexModel();
    const effort = process.env.CODEX_REASONING_EFFORT?.trim() || "low";
    const threadResult = record(await this.request("thread/start", {
      model,
      cwd: process.cwd(),
      approvalPolicy: "never",
      sandbox: "read-only",
      baseInstructions: "Anda adalah asisten analisis data. Jangan menjalankan shell, mengubah berkas, atau memakai alat selain fungsi data yang diberikan aplikasi.",
      developerInstructions: options.instructions,
      ephemeral: true,
      dynamicTools: options.tools,
    }));
    const thread = record(threadResult?.thread);
    const threadId = typeof thread?.id === "string" ? thread.id : "";
    if (!threadId) throw new Error("Codex App Server tidak memberikan ID percakapan.");

    const answer = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.turns.delete(threadId);
        reject(new Error("Waktu pemrosesan Codex habis. Coba pertanyaan yang lebih singkat."));
      }, TURN_TIMEOUT_MS);
      this.turns.set(threadId, { answer: "", resolve, reject, timer, onToolCall: options.onToolCall });
    });

    try {
      await this.request("turn/start", {
        threadId,
        input: [{ type: "text", text: options.conversation }],
        model,
        ...(effort ? { effort } : {}),
      });
      const result = await answer;
      await persistCodexAuth().catch((error) => console.error("Gagal menyinkronkan autentikasi Codex:", error instanceof Error ? error.message : error));
      return result;
    } catch (error) {
      const state = this.turns.get(threadId);
      if (state) clearTimeout(state.timer);
      this.turns.delete(threadId);
      throw error;
    }
  }
}

const globalWithCodex = globalThis as typeof globalThis & { __rzCodexAppServerV2?: CodexAppServerClient };
export const codexAppServer = globalWithCodex.__rzCodexAppServerV2 ?? new CodexAppServerClient();
globalWithCodex.__rzCodexAppServerV2 = codexAppServer;
