# Onboarding dan Kontrol Akses Firebase

Implementasi memakai Firebase Authentication dan Cloud Firestore. Password diproses oleh Firebase, sedangkan aplikasi menyimpan profil serta status approval di koleksi `profiles`.

## Aturan akses

- Email terverifikasi dengan domain `@rumahzakat.org` otomatis berstatus `approved`.
- Email eksternal dapat mendaftar, tetapi berstatus `pending` sampai disetujui admin.
- Admin dapat melihat statistik, menyetujui, menolak, menangguhkan, dan mengaktifkan kembali pengguna.
- Pengguna dianggap online bila heartbeat diterima dalam lima menit terakhir.
- Sesi aplikasi disimpan dalam cookie `HttpOnly` selama tujuh hari.

## Menyiapkan Firebase

1. Buka [Firebase Console](https://console.firebase.google.com/), lalu tambahkan Firebase ke project Google Cloud yang digunakan.
2. Buka **Build → Authentication → Sign-in method**, aktifkan **Email/Password** dan **Google**.
3. Pada **Authentication → Settings → Authorized domains**, tambahkan:
   - `localhost`
   - `pemberdayaan-rz.vercel.app`
4. Buka **Build → Firestore Database**, buat database dalam **Production mode**, lalu deploy aturan `firestore.rules` melalui Firebase CLI atau salin aturan tersebut ke tab Rules.
5. Tambahkan Web App melalui **Project settings → General → Your apps** dan salin konfigurasi Web SDK ke environment `NEXT_PUBLIC_FIREBASE_*`.
6. Buat service account melalui **Project settings → Service accounts → Generate new private key**. Masukkan `project_id`, `client_email`, dan `private_key` ke environment server Vercel.
7. Di **Authentication → Templates**, atur action URL untuk **Email address verification** dan **Password reset** menjadi:

   ```text
   https://pemberdayaan-rz.vercel.app/auth/action
   ```

   Untuk pengujian lokal, gunakan `http://localhost:3000/auth/action` sementara atau biarkan action URL produksi dan uji email melalui deployment.

## Environment Vercel

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_PROJECT_ID=PROJECT_ID
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@PROJECT_ID.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
AUTH_ADMIN_EMAILS=hari.pamungkas@rumahzakat.org,candra.juari@rumahzakat.org,pd.rumahzakat@gmail.com
```

`FIREBASE_PRIVATE_KEY` dan service-account JSON tidak boleh memakai awalan `NEXT_PUBLIC_` dan tidak boleh dimasukkan ke Git. Setelah environment disimpan, lakukan redeploy.

## Pemeriksaan sebelum produksi

- Daftarkan akun internal, verifikasi email, lalu pastikan statusnya langsung aktif.
- Daftarkan akun eksternal, verifikasi email, dan pastikan diarahkan ke halaman menunggu persetujuan.
- Setujui akun eksternal dari `/admin/pengguna`, lalu pastikan akun dapat masuk.
- Uji Login Google untuk alamat internal dan eksternal.
- Uji lupa password, action URL, logout, suspend, re-approve, dan sesi kedaluwarsa.
- Pastikan aturan Firestore menolak pembacaan dan penulisan langsung dari browser.
