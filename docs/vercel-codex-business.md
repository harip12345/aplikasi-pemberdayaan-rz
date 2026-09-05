# Deployment Codex Business di Vercel

Dashboard menggunakan paket resmi `@openai/codex` dan menjalankan `codex app-server` dari Vercel Function. Untuk pemakaian sementara tanpa Personal Access Token, admin dapat login melalui device code di chatbot. Codex menyimpan sesi ke `auth.json`; aplikasi mengenkripsi file tersebut dengan AES-256-GCM sebelum menyimpannya di Private Vercel Blob.

## Environment wajib

```env
AI_PROVIDER=codex
CODEX_ACCESS_TOKEN=
CODEX_MODEL=gpt-5.6-luna
CODEX_REASONING_EFFORT=low
CODEX_TURN_TIMEOUT_MS=120000
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
NEXT_PUBLIC_APP_URL=https://domain-produksi.example
BLOB_READ_WRITE_TOKEN=otomatis_dari_private_blob
CODEX_AUTH_ENCRYPTION_KEY=base64_kunci_acak_32_byte
CODEX_LOGIN_ADMIN_SECRET=secret_admin_yang_panjang_dan_acak
```

## Menyiapkan Private Blob

1. Buka **Vercel → Project → Storage**.
2. Pilih **Create Database → Blob**, lalu pilih akses **Private**.
3. Hubungkan store tersebut ke project. Vercel akan menambahkan `BLOB_READ_WRITE_TOKEN` secara otomatis.
4. Buat kunci enkripsi 32 byte:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

5. Simpan hasilnya sebagai `CODEX_AUTH_ENCRYPTION_KEY` di Environment Variables.
6. Buat secret admin terpisah dan simpan sebagai `CODEX_LOGIN_ADMIN_SECRET`. Gunakan nilai acak yang panjang dan jangan samakan dengan token Telegram atau password akun ChatGPT.
7. Pastikan `CODEX_ACCESS_TOKEN` kosong atau dihapus agar tombol login UI aktif, lalu redeploy.

Jangan mengganti `CODEX_AUTH_ENCRYPTION_KEY` setelah login. Jika kunci hilang atau berubah, blob lama tidak dapat didekripsi dan login harus dibuat ulang.

`VERCEL_SUPPORT_LARGE_FUNCTIONS=1` diperlukan untuk project Vercel lama yang belum otomatis memakai Large Functions. Paket native Codex Linux melampaui batas bundle fungsi standar Vercel.

## Login pertama

1. Buka aplikasi hasil deployment dan buka **Asisten AI**.
2. Masukkan nilai `CODEX_LOGIN_ADMIN_SECRET`, lalu klik **Login**.
3. Salin kode sekali pakai dan buka halaman login yang ditampilkan.
4. Masuk menggunakan akun ChatGPT Business dan masukkan kode tersebut.
5. Selesaikan proses dalam empat menit. Setelah berhasil, chatbot akan membaca akun dan menyimpan sesi terenkripsi.

Device-code login harus diizinkan pada pengaturan keamanan workspace ChatGPT. Secret admin hanya dipakai untuk membuka proses login; token ChatGPT tidak pernah dikirim ke browser aplikasi.

## Verifikasi

Sesudah redeploy, buka:

```text
https://domain-produksi.example/api/assistant/status
```

Respons yang diharapkan memuat `connected: true`, provider `codex`, model yang dipilih, dan tipe plan workspace. Sesudah itu uji satu pertanyaan dari chatbot dan bot Telegram. Saat instance Vercel baru aktif, aplikasi memuat dan mendekripsi sesi dari Private Blob ke direktori sementara sebelum menjalankan Codex.

## Keamanan

`auth.json` setara dengan password karena berisi token akses dan refresh token. Walaupun blob bersifat private dan payload sudah dienkripsi aplikasi, pendekatan ini tetap solusi sementara:

- Aktifkan Vercel Deployment Protection atau autentikasi aplikasi karena sesi ChatGPT dipakai bersama oleh seluruh pengguna chatbot dan bot Telegram.
- Batasi siapa yang mengetahui `CODEX_LOGIN_ADMIN_SECRET`.
- Jangan mencatat isi blob, kunci enkripsi, kode akses, atau token ke log.
- Beberapa instance Vercel dapat berjalan bersamaan. Aplikasi melakukan sinkronisasi sebelum membaca akun dan memakai penulisan bersyarat untuk mengurangi konflik, tetapi runner/server persisten tetap lebih tepat untuk penggunaan jangka panjang.
- Jika sesi dicabut dari ChatGPT atau refresh token tidak lagi valid, jalankan login UI kembali.

Jika Personal Access Token workspace sudah tersedia, hapus alur sementara ini dari produksi dan kembali gunakan `CODEX_ACCESS_TOKEN` agar autentikasi server-to-server lebih sederhana.
