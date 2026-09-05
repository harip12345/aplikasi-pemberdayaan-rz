# Deployment Codex Business di Vercel

Dashboard menggunakan paket resmi `@openai/codex` dan menjalankan `codex app-server` dari Vercel Function. Autentikasi produksi dilakukan secara non-interaktif melalui access token workspace ChatGPT Business/Enterprise.

## Environment wajib

```env
AI_PROVIDER=codex
CODEX_ACCESS_TOKEN=token_dengan_scope_codex
CODEX_MODEL=gpt-5.6-luna
CODEX_REASONING_EFFORT=low
CODEX_TURN_TIMEOUT_MS=120000
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
NEXT_PUBLIC_APP_URL=https://domain-produksi.example
```

Simpan token hanya melalui **Vercel → Project → Settings → Environment Variables**. Terapkan minimal untuk Production, kemudian lakukan redeploy. Jangan memasukkan token ke `.env.example`, source code, log, atau repository.

`VERCEL_SUPPORT_LARGE_FUNCTIONS=1` diperlukan untuk project Vercel lama yang belum otomatis memakai Large Functions. Paket native Codex Linux melampaui batas bundle fungsi standar Vercel.

## Membuat access token

1. Masuk ke workspace ChatGPT Business.
2. Buka Admin Console → Access tokens.
3. Buat token khusus, misalnya `rz-dashboard-vercel`.
4. Pilih scope **Codex** dan masa berlaku terbatas.
5. Salin token sekali, lalu simpan sebagai `CODEX_ACCESS_TOKEN` di Vercel.

Tidak perlu menjalankan `codex login` di Vercel. `codex app-server` membaca `CODEX_ACCESS_TOKEN` langsung dari environment setiap kali fungsi dimulai.

## Verifikasi

Sesudah redeploy, buka:

```text
https://domain-produksi.example/api/assistant/status
```

Respons yang diharapkan memuat `connected: true`, provider `codex`, model yang dipilih, dan tipe plan workspace. Setelah itu uji satu pertanyaan dari chatbot dan bot Telegram.

## Keamanan

Access token mewakili identitas pembuat token dan menggunakan hak akses Codex miliknya. Batasi akses aplikasi untuk pengguna internal, rotasi token secara berkala, dan cabut token ketika deployment tidak lagi digunakan.
