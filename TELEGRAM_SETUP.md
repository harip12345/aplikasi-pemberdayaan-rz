# Integrasi Asisten Data dengan Telegram

1. Buat bot melalui `@BotFather`, lalu salin token bot.
2. Pastikan aplikasi sudah tersedia melalui alamat publik HTTPS.
3. Isi environment server:

```env
TELEGRAM_BOT_TOKEN=token_dari_botfather
TELEGRAM_WEBHOOK_SECRET=secret_acak_minimal_32_karakter
TELEGRAM_PUBLIC_URL=https://alamat-aplikasi.example
```

4. Setelah aplikasi berjalan, daftarkan webhook:

```bash
npm run telegram:webhook:set
```

Periksa status dengan `npm run telegram:webhook:info` dan hapus webhook dengan `npm run telegram:webhook:delete`.

Bot dapat digunakan siapa pun melalui chat pribadi. Dalam grup, gunakan `/tanya <pertanyaan>`. Riwayat singkat disimpan selama 30 menit untuk memahami pertanyaan lanjutan. Perintah `/reset` menghapus konteks tersebut.

Untuk deployment Vercel dengan workspace ChatGPT Business/Enterprise, gunakan `AI_PROVIDER=codex` dan simpan access token ber-scope Codex sebagai `CODEX_ACCESS_TOKEN`. Paket resmi Codex CLI sudah menjadi dependency produksi dan App Server memakai token tersebut secara non-interaktif. Jangan pernah memasukkan token ke source code, repository, atau log.
