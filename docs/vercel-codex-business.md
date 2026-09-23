# Deployment Codex Business di Vercel

Dashboard menggunakan paket resmi `@openai/codex` dan menjalankan `codex app-server` dari Vercel Function. Untuk pemakaian sementara tanpa Personal Access Token, admin dapat login melalui device code di chatbot. Codex menyimpan sesi ke `auth.json`; aplikasi mengenkripsi file tersebut dengan AES-256-GCM sebelum menyimpannya di Private Vercel Blob.

## Environment wajib

```env
AI_PROVIDER=codex
CODEX_ACCESS_TOKEN=
CODEX_MODEL=gpt-6-luna
CODEX_REASONING_EFFORT=low
CODEX_TURN_TIMEOUT_MS=120000
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
NEXT_PUBLIC_APP_URL=https://domain-produksi.example
BLOB_STORE_ID=otomatis_dari_private_blob
# Hanya store lama; tidak diperlukan jika koneksi memakai OIDC.
BLOB_READ_WRITE_TOKEN=
CODEX_AUTH_ENCRYPTION_KEY=base64_kunci_acak_32_byte
CRON_SECRET=secret_cron_yang_panjang_dan_acak
CODEX_AUTH_REFRESH_SKEW_MS=600000
```

## Menyiapkan Private Blob

1. Buka **Vercel → Project → Storage**.
2. Pilih **Create Database → Blob**, lalu pilih akses **Private**.
3. Hubungkan store tersebut ke project. Koneksi baru memakai OIDC dan menambahkan `BLOB_STORE_ID`; token OIDC berumur pendek disediakan otomatis saat function berjalan. `BLOB_READ_WRITE_TOKEN` hanya diperlukan untuk store lama yang belum memakai OIDC.
4. Buat kunci enkripsi 32 byte:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

5. Simpan hasilnya sebagai `CODEX_AUTH_ENCRYPTION_KEY` di Environment Variables.
6. Buat secret Cron dan simpan sebagai `CRON_SECRET`. Gunakan nilai acak minimal 32 byte dan jangan samakan dengan token Telegram atau password akun ChatGPT.

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

7. Pastikan email admin tercantum di `AUTH_ADMIN_EMAILS`. Hanya akun Firebase dengan role admin yang dapat membuka alur login ChatGPT.
8. Pastikan `CODEX_ACCESS_TOKEN` kosong atau dihapus agar tombol login UI aktif, lalu redeploy.

Jangan mengganti `CODEX_AUTH_ENCRYPTION_KEY` setelah login. Jika kunci hilang atau berubah, blob lama tidak dapat didekripsi dan login harus dibuat ulang.

`VERCEL_SUPPORT_LARGE_FUNCTIONS=1` diperlukan untuk project Vercel lama yang belum otomatis memakai Large Functions. Paket native Codex Linux melampaui batas bundle fungsi standar Vercel.

## Login pertama

1. Buka aplikasi hasil deployment dan buka **Asisten AI**.
2. Pastikan Anda masuk menggunakan akun admin aplikasi, lalu klik **Hubungkan ChatGPT Business**. Tidak ada shared secret yang dikirim atau disimpan di browser.
3. Salin kode sekali pakai dan buka halaman login yang ditampilkan.
4. Masuk menggunakan akun ChatGPT Business dan masukkan kode tersebut.
5. Selesaikan proses dalam empat menit. Setelah berhasil, chatbot akan membaca akun dan langsung menyimpan sesi terenkripsi.

Device-code login harus diizinkan pada pengaturan keamanan workspace ChatGPT. Token ChatGPT tidak pernah dikirim ke browser aplikasi; server hanya menampilkan kode perangkat sekali pakai.

## Verifikasi

Sesudah redeploy, buka:

```text
https://domain-produksi.example/api/assistant/status
```

Endpoint status harus dibuka ketika Anda sudah masuk sebagai admin Firebase. Respons yang diharapkan memuat `connected: true`, provider `codex`, model yang dipilih, tipe plan workspace, serta `authPersistence.stored: true`. Sesudah itu uji satu pertanyaan dari chatbot dan bot Telegram. Saat instance Vercel baru aktif, aplikasi memuat dan mendekripsi sesi dari Private Blob ke direktori sementara sebelum menjalankan Codex.

Di **Vercel → Storage → Blob → Data**, pastikan pathname berikut tersedia setelah login pertama:

```text
rz-dashboard/codex-auth.v1.enc
```

File tersebut terenkripsi AES-256-GCM dan tidak boleh diunduh atau dibagikan. `vercel.json` menjadwalkan `/api/assistant/auth-refresh` sekali sehari. Vercel mengirim `CRON_SECRET` sebagai bearer token. Selain Cron, setiap permintaan web atau Telegram melakukan refresh secara on-demand hanya ketika access token mendekati kedaluwarsa.

## Keamanan

`auth.json` setara dengan password karena berisi token akses dan refresh token. Walaupun blob bersifat private dan payload sudah dienkripsi aplikasi, pendekatan ini tetap solusi sementara:

- Aktifkan Vercel Deployment Protection atau autentikasi aplikasi karena sesi ChatGPT dipakai bersama oleh seluruh pengguna chatbot dan bot Telegram.
- Batasi role admin Firebase dan daftar `AUTH_ADMIN_EMAILS`.
- Jangan mencatat isi blob, kunci enkripsi, kode akses, atau token ke log.
- Beberapa instance Vercel dapat berjalan bersamaan. Aplikasi memakai lock Private Blob sebelum refresh token, lalu menyimpan hasilnya secara atomik agar token baru tidak ditimpa instance lain.
- Jika sesi dicabut dari ChatGPT atau refresh token tidak lagi valid, jalankan login UI kembali.

Jika Personal Access Token workspace sudah tersedia, hapus alur sementara ini dari produksi dan kembali gunakan `CODEX_ACCESS_TOKEN` agar autentikasi server-to-server lebih sederhana.
