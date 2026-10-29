# KaizenBox

Sistem aspirasi karyawan dan pelacakan tindak lanjut dengan dua role: **Karyawan** dan **Admin**. Frontend menggunakan React, TypeScript, dan Vite; backend menggunakan Node.js, Express, dan MySQL (dapat dijalankan melalui XAMPP).


## Arsitektur

KaizenBox memisahkan komponen UI, business service, dan API client. Frontend menggunakan backend HTTP; data aplikasi disimpan di MySQL.

## Fitur dan Alur Saat Ini

- Dashboard admin adalah halaman awal setelah login, menggabungkan ringkasan statistik dengan tabel pengelolaan karyawan dan role.
- Batas pengiriman adalah 10 aspirasi per karyawan per hari. Backend menjadi sumber nilai kuota dan menegakkannya dalam transaksi dengan mengunci baris akun agar pengiriman bersamaan tidak melewati batas.
- PIC harus karyawan aktif dengan jabatan terisi selain `Operator`, dan bukan pengirim aspirasi. Aturan diperiksa pada frontend dan backend.
- Audit log aktivitas sistem tidak digunakan. Riwayat perubahan status tetap tersimpan dan ditampilkan pada tiket.
- Menu **Aspirasi** menyatukan tab **Tinjauan**, **Keputusan**, dan **Semua**. Aspirasi yang ditinjau dapat langsung diimplementasikan, dijadwalkan, diriset, ditolak, atau dieskalasi ke antrean keputusan. Implementasi memerlukan PIC dan tenggat; aspirasi terjadwal boleh menunggu penunjukan PIC.
- Ekspor CSV tetap tersedia sebagai aksi sekunder di tab **Semua** untuk mengunduh data seluruh aspirasi.

---

## Catatan Realisme Operasional

- Usulan solusi sekarang opsional. Karyawan perlu bisa melaporkan masalah keselamatan atau gangguan tanpa harus lebih dulu merancang solusinya.
- SLA respons 7 hari kerja terlalu lambat untuk bahaya keselamatan yang sedang berlangsung. Sediakan prosedur darurat terpisah dengan eskalasi segera; jangan mengandalkan tiket Kaizen untuk keadaan darurat.
- Sistem ini bersifat pseudonim, bukan anonim penuh: tim peninjau melihat token dan detail laporan, sedangkan bagian, lokasi, serta isi laporan dapat mengungkap pengirim. Hindari janji bahwa identitas "tidak pernah" dapat diketahui.
- Tenggat default adalah hari kalender, sedangkan SLA respons dan keputusan memakai hari kerja. Angka tenggat dan kapasitas tim sebaiknya divalidasi lewat pilot, bukan dianggap komitmen universal.
- Kuota kiriman harian adalah pencegahan spam, bukan pembatas suara karyawan.

## 🏗️ Struktur Folder

```
src/
├── config/
│   └── app.config.ts          ← SEMUA setting di sini
├── api/
│   └── apiClient.ts           ← HTTP client untuk backend
├── services/
│   ├── authService.ts         ← Login & hak akses per peran
│   └── businessServices.ts    ← Logika bisnis (dipakai semua komponen)
├── components/
│   ├── shared/
│   │   └── StatusBadge.tsx
│   ├── EmployeeDashboard.tsx  ← halaman semua karyawan (pengirim ide)
│   ├── SubmitIdea.tsx
│   ├── TrackTicket.tsx
│   ├── KaizenPages.tsx        ← antrean tinjauan, keputusan, dan semua aspirasi
│   ├── KaizenDetail.tsx       ← detail, tinjauan admin, PIC/tenggat, tindak lanjut
│   ├── KaizenLaporan.tsx      ← statistik
│   └── DataKaryawan.tsx       ← tabel karyawan dan pengaturan role di dashboard admin
└── App.tsx
```

---

## Menyiapkan Database MySQL

1. Nyalakan MySQL di XAMPP.
2. Buka `http://localhost/phpmyadmin`.
3. Pilih **Import** dan impor file `backend/schema.sql`. File ini membuat database `kaizenbox`, tabel `karyawan`, `aspirasi`, serta tiga akun sementara.

Untuk database lama, backend otomatis menambahkan kolom workflow yang belum ada saat `npm run server` dijalankan. Tabel dasar `karyawan` dan `aspirasi` tetap perlu dibuat satu kali dari `backend/schema.sql`; skrip `backend/migrate-aspirasi-workflow.sql` hanya diperlukan bila memakai versi backend lama tanpa migrasi otomatis. Penambahan akun karyawan tidak tersedia melalui aplikasi maupun API; halaman admin hanya menampilkan data dan mengubah role. Provisioning akun dilakukan melalui proses administrasi database yang tepercaya.

Atur koneksi pada `.env` (salin dari `.env.example`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, dan `PORT`. Konfigurasi awal ditujukan untuk MySQL XAMPP lokal.

## Menjalankan Aplikasi

Dari folder proyek, instal dependensi:

```powershell
npm install
```

Jalankan backend di satu terminal:

```powershell
npm run server
```

Backend aktif di `http://localhost:3001`. Cek `http://localhost:3001/api/health`; koneksi berhasil jika respons berisi `"connected": true`.

Jalankan frontend di terminal lain:

```powershell
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya `http://localhost:3000`.

Pemeriksaan kode:

```powershell
npm run typecheck
npm run build
node --check backend\index.js
node --check backend\db.js
```

Proyek belum menyediakan suite test otomatis. Perintah di atas memeriksa tipe, build frontend, dan sintaks backend.

## Akun Uji Lokal

Schema membuat akun sementara berikut. Kolom password sengaja `NULL`, sehingga akun tidak bisa login sebelum password diatur.

| ID login | Nama | Role |
|---|---|---|
| `TEMP-RIZKY` | Rizky Pratama | Admin |
| `TEMP-AGUS` | Agus Setiawan | Karyawan |
| `TEMP-DEWI` | Dewi Lestari | Karyawan |

Buat hash bcrypt untuk password sementara melalui terminal folder proyek:

```powershell
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('PasswordBaru-YangKuat!',12).then(console.log)"
```

Salin hash yang dihasilkan ke phpMyAdmin. Ganti hash dan ID karyawan sesuai akun:

```sql
UPDATE karyawan SET password = '$2b$12$PASTE_HASH_DI_SINI'
WHERE id_karyawan = 'TEMP-RIZKY';
```

Login menggunakan ID karyawan dan password asli yang dipakai untuk membuat hash, bukan nilai hash. Akun contoh hanya untuk tes lokal; jangan gunakan password nyata. Password lama yang masih berupa teks biasa akan di-hash otomatis oleh backend setelah login berhasil, tetapi menetapkan hash bcrypt secara langsung lebih disarankan.

## Endpoint Backend yang Tersedia

Semua endpoint kecuali `/api/health` dan `/api/login` memerlukan sesi. Endpoint administrasi dibatasi untuk Admin.

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/health` | Memeriksa koneksi MySQL |
| `POST` | `/api/login` | Login dan membuat sesi |
| `POST` | `/api/logout` | Mengakhiri sesi aktif |
| `GET` | `/api/me` | Mengambil pengguna pada sesi aktif |
| `GET` | `/api/karyawan` | Mengambil daftar karyawan; Admin |
| `PUT` | `/api/karyawan/:idKaryawan/roles` | Mengubah role; Admin |
| `GET` | `/api/aspirasi` | Mengambil aspirasi sesuai role |
| `POST` | `/api/aspirasi` | Menyimpan aspirasi dan menegakkan kuota harian |
| `GET` | `/api/aspirasi/daily-limit` | Menghitung kuota yang tersisa |
| `GET` | `/api/aspirasi/:tiket` | Mengambil detail tiket sesuai hak akses |
| `PUT` | `/api/aspirasi/:tiket` | Mengubah aspirasi; Admin, dengan validasi status/PIC/tenggat |

## Alur Aspirasi

1. Karyawan mengirim formulir; backend memeriksa kuota 10 kiriman harian dalam transaksi lalu menyimpan aspirasi dengan status *Terkirim*.
2. Admin memulai tinjauan; status berubah menjadi *Ditinjau*.
3. Admin memilih tindak lanjut: implementasi, antre implementasi, riset, eskalasi keputusan, atau penolakan.
4. Implementasi memakai PIC aktif dengan jabatan terisi selain `Operator` (dan bukan pengirim) serta tenggat. Aspirasi yang dijadwalkan dapat menunggu PIC sampai implementasi dimulai. Admin dapat mengganti PIC/tenggat selama antre atau implementasi, serta menyelesaikan atau membatalkan aspirasi dengan catatan.
5. Perubahan status disimpan bersama riwayat status aspirasi.

Karyawan hanya melihat aspirasi miliknya. Admin dapat melihat semua aspirasi, tetapi aspirasi miliknya sendiri tidak ditampilkan pada antrean peninjauan.

## Batasan dan Keamanan

- Penambahan karyawan, impor massal, dan sinkronisasi HR tidak tersedia di aplikasi maupun API. Provisioning akun harus dilakukan melalui proses database tepercaya dan password harus disimpan sebagai hash bcrypt.
- Backend memverifikasi password dengan bcrypt. Password lama yang tersimpan sebagai teks biasa di-hash otomatis saat login berhasil. Gunakan hanya password sementara untuk pengujian lokal.
- Token autentikasi disimpan di localStorage frontend agar sesi bertahan setelah refresh. Sesi backend disimpan di memori, sehingga pengguna perlu login kembali setelah backend dimulai ulang.
- Token anonim saat ini berasal dari ID karyawan, sehingga bukan anonimitas penuh.
- Batas 10 aspirasi per hari ditegakkan backend dengan transaksi dan penguncian baris akun; frontend menampilkan nilai yang dikirim oleh API backend.
- CORS masih terbuka untuk pengembangan lokal.

Jangan gunakan untuk data produksi sebelum semua password dipastikan berupa hash, sesi diamankan, CORS dibatasi, HTTPS digunakan, serta pengujian otorisasi dan konkurensi dilakukan.

## Build Frontend

Jalankan `npm run build`, lalu hasil build berada di folder `dist/`. Backend tetap harus dijalankan dan di-host terpisah dari frontend.
