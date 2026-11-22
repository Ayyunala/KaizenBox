# Hasil uji perubahan database

## Lingkungan uji

- Node.js: `node --check` berhasil untuk `backend/index.js`, `backend/db.js`, dan `scripts/set-demo-passwords.mjs`.
- `npm run build`: berhasil (`vite build`, 41 modul).
- Server database lokal: MariaDB `10.4.32`, bukan MySQL 8.
- Database `kaizenbox` yang sudah ada tidak diubah. Pemeriksaan baca-saja menunjukkan 10 karyawan, 7 aspirasi, 2 admin, dan 22 entri riwayat JSON.
- Uji API dijalankan pada database baru `kaizenbox_task_test_20261122`. `backend/schema.sql` diimpor dengan hanya nama database diarahkan ke database uji. Skrip `set-demo-passwords.mjs` dijalankan dengan `DB_NAME=kaizenbox_task_test_20261122`; ketiga akun demo melaporkan `password_updated: true`.
- Backend berjalan pada port `3111` dari direktori runtime kosong. File `.env` tidak dibuka atau dibaca.
- Untuk semua permintaan terautentikasi, header token disamarkan. Password pada request login juga disamarkan; nilai respons HTTP dan pesan API dicatat apa adanya.

## Hasil endpoint

| Skenario | Request (body; token/password disamarkan) | HTTP | Pesan respons |
|---|---|---:|---|
| Login karyawan benar | `POST /api/login` `{"idKaryawan":"TEMP-AGUS","password":"[redacted]"}` | 200 | `Login berhasil` |
| Login password salah | `POST /api/login` `{"idKaryawan":"TEMP-AGUS","password":"[redacted]"}` | 401 | `Password salah.` |
| Login akun nonaktif | `POST /api/login` `{"idKaryawan":"TEMP-DEWI","password":"[redacted]"}` saat `aktif=0` | 401 | `Akun tidak ditemukan atau tidak aktif.` |
| Kirim aspirasi sukses | `POST /api/aspirasi` `{"kategori":"Kualitas","judul":"Uji aspirasi","masalah":"Masalah pengujian","solusi":"Solusi pengujian","lokasiAkurat":"Area A","diLuarAreaProduksi":false}` | 200 | `Aspirasi berhasil dikirim.` |
| Isi kuota ke-2 s.d. ke-10 | `POST /api/aspirasi` dengan body yang sama dan judul `Kuota 2` s.d. `Kuota 10`; masing-masing | 200 | `Aspirasi berhasil dikirim.` |
| Kuota ke-11 ditolak | `POST /api/aspirasi` `{"kategori":"Kualitas","judul":"Uji aspirasi","masalah":"Masalah pengujian","solusi":"Solusi pengujian","lokasiAkurat":"Area A","diLuarAreaProduksi":false}` | 429 | `Batas 10 aspirasi per hari sudah tercapai.` |
| Admin kirim aspirasi | `POST /api/aspirasi` body aspirasi di atas | 403 | `Hanya karyawan yang dapat mengirim aspirasi.` |
| Karyawan membuka tiket orang lain | `GET /api/aspirasi/KZ-2026-A1329376` | 404 | `Aspirasi tidak ditemukan.` |
| Karyawan mencoba PUT aspirasi | `PUT /api/aspirasi/KZ-2026-96F0C7EE` `{"status":"Ditinjau"}` | 403 | `Hanya admin yang dapat mengubah aspirasi.` |
| Transisi status tidak diizinkan | `PUT /api/aspirasi/KZ-2026-96F0C7EE` `{"status":"Selesai"}` ketika status `Terkirim` | 400 | `Perubahan status dari "Terkirim" ke "Selesai" tidak diizinkan.` |
| PIC jabatan Operator | `PUT /api/aspirasi/KZ-2026-96F0C7EE` `{"status":"Implementasi","picToken":"KTR-TEMP-OP","tenggat":"2026-11-22"}` | 400 | `PIC harus karyawan aktif dengan jabatan selain Operator dan bukan pengirim aspirasi.` |
| PIC sama dengan pengirim | `PUT /api/aspirasi/KZ-2026-96F0C7EE` `{"status":"Implementasi","picToken":"KTR-TEMP-AGUS","tenggat":"2026-11-22"}` | 400 | `PIC harus karyawan aktif dengan jabatan selain Operator dan bukan pengirim aspirasi.` |
| Keputusan Implementasi tanpa tenggat | `PUT /api/aspirasi/KZ-2026-96F0C7EE` `{"status":"Implementasi","picToken":"KTR-TEMP-DEWI"}` | 400 | `Tenggat wajib diisi saat PIC ditunjuk.` |
| Catatan hasil kurang dari 20 karakter | `PUT /api/aspirasi/KZ-2026-96F0C7EE` `{"status":"Selesai","catatanHasil":"singkat"}` | 400 | `Catatan hasil wajib minimal 20 karakter.` |
| Alur tinjau sukses | `PUT /api/aspirasi/KZ-2026-A1329376` dengan `status:"Ditinjau"`, `reviewerToken:true`, dan entri riwayat baru | 200 | `Aspirasi berhasil diperbarui.` |
| Alur putuskan sukses | `PUT /api/aspirasi/KZ-2026-A1329376` dengan `status:"Implementasi"`, `pemutusToken:true`, PIC `KTR-TEMP-AGUS`, tenggat `2026-11-22`, dan entri riwayat baru | 200 | `Aspirasi berhasil diperbarui.` |
| Alur selesaikan sukses | `PUT /api/aspirasi/KZ-2026-A1329376` `{"status":"Selesai","tanggalImplementasi":"2026-11-22","catatanHasil":"Perbaikan selesai dan sudah diverifikasi oleh tim."}` | 200 | `Aspirasi berhasil diperbarui.` |
| GET tiket memuat riwayat | `GET /api/aspirasi/KZ-2026-A1329376` | 200 | Respons berisi 4 baris `riwayatStatus`, urut dari `Terkirim` ke `Selesai` |
| Tunjuk admin | `PUT /api/karyawan/TEMP-DEWI/roles` `{"peran":["admin"]}` | 200 | `Role berhasil diperbarui.` |
| Cabut admin | `PUT /api/karyawan/TEMP-DEWI/roles` `{"peran":["karyawan"]}` | 200 | `Role berhasil diperbarui.` |
| Cabut admin terakhir | `PUT /api/karyawan/TEMP-RIZKY/roles` `{"peran":[]}` | 400 | `Sistem harus memiliki minimal satu admin aktif.` |

Pemeriksaan tambahan: `GET /api/karyawan` dan `GET /api/aspirasi` masing-masing mengembalikan HTTP 200. Role yang terbaca setelah penunjukan/pencabutan adalah `TEMP-RIZKY=admin` dan `TEMP-DEWI=karyawan`; daftar mengembalikan 11 aspirasi dan seluruhnya memiliki array `riwayatStatus`. Status health backend: HTTP 200, `{"success":true,"message":"Database MySQL terhubung","connected":true}`.

Isi `riwayatStatus` yang diterima dari GET tiket:

```json
[
  {
    "statusLama": "-",
    "statusBaru": "Terkirim",
    "tanggal": "2026-11-22T05:35:32.000Z",
    "catatan": "Aspirasi masuk antrean"
  },
  {
    "statusLama": "Terkirim",
    "statusBaru": "Ditinjau",
    "tanggal": "2026-11-22T05:35:33.000Z",
    "catatan": "Sedang ditinjau admin",
    "oleh": "KTR-TEMP-RIZKY"
  },
  {
    "statusLama": "Ditinjau",
    "statusBaru": "Implementasi",
    "tanggal": "2026-11-22T05:35:33.000Z",
    "catatan": "Aspirasi disetujui untuk implementasi",
    "oleh": "KTR-TEMP-RIZKY"
  },
  {
    "statusLama": "Implementasi",
    "statusBaru": "Selesai",
    "tanggal": "2026-11-22T05:35:33.000Z",
    "catatan": "Status diubah menjadi Selesai",
    "oleh": "KTR-TEMP-RIZKY"
  }
]
```

Database uji berakhir dengan 1 admin, 11 aspirasi, dan 16 entri riwayat.

Uji konkurensi tambahan: dua permintaan `PUT /api/karyawan/:idKaryawan/roles` untuk mencabut dua admin secara bersamaan menghasilkan HTTP 200 (`Role berhasil diperbarui.`) dan HTTP 400 (`Sistem harus memiliki minimal satu admin aktif.`). Setelah kedua permintaan, jumlah admin aktif adalah 1.

Uji transaksi update tambahan: transisi ilegal menerima HTTP 400 (`Perubahan status dari "Terkirim" ke "Selesai" tidak diizinkan.`), lalu permintaan tinjau berikutnya menerima HTTP 200 dan menghasilkan status `Ditinjau` dengan 2 entri riwayat. Permintaan kedua berhasil setelah kegagalan validasi, sehingga transaksi/baris lock dilepas dengan benar.

## Migrasi database lama

Migrasi lama memakai `scripts/migrate-kaizenbox.mjs` dan driver MariaDB/MySQL yang sudah menjadi dependency proyek; tidak memakai `JSON_TABLE`, tidak membuat database kedua, dan tidak menghapus kolom legacy. Database XAMPP `kaizenbox` (MariaDB 10.4.32) dibackup oleh pengguna sebelum migrasi. Dry-run membaca 2 admin, 7 aspirasi, dan 22 entri JSON, serta memprediksi 1 riwayat fallback. Migrasi pada database yang sama berhasil: 2 admin, 7 aspirasi, 23 baris `riwayat_status`, 22 baris diimpor dari JSON, 1 baris fallback, dan 0 aspirasi tanpa riwayat. Kolom `karyawan.role` dan `aspirasi.riwayat_status` masih dipertahankan. Pemeriksaan baca-saja sesudah migrasi mengonfirmasi angka tersebut. Backend kemudian berhasil dimulai dengan environment eksplisit dari direktori sementara; `/api/health` mengembalikan HTTP 200 dan `{"success":true,"message":"Database MySQL terhubung","connected":true}`.
