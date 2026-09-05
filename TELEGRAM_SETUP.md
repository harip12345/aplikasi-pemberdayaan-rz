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

Jika aplikasi dipasang di layanan cloud yang tidak memiliki Codex CLI dan login ChatGPT, gunakan provider API melalui environment (`AI_PROVIDER=groq`, `openrouter`, `9router`, atau `custom`). Provider Codex Subscription hanya dapat berjalan pada server yang memiliki executable Codex CLI dan sesi login aktif.

