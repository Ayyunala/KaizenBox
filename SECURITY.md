# Security Notes

Dokumen ini menjelaskan kontrol dan risiko pada backend KaizenBox saat ini. Aplikasi masih prototipe lokal dan **belum aman untuk data produksi**.

## Roles

| Role | Akses aplikasi |
|---|---|
| `karyawan` | Mengirim aspirasi dan melihat aspirasi miliknya |
| `admin` | Melihat data karyawan dan aspirasi, meninjau serta memutuskan aspirasi |

Bagian, jabatan, dan shift adalah informasi profil, bukan role.

## Controls Implemented

- Login menolak akun tidak aktif atau yang belum memiliki password.
- Password diverifikasi dengan bcrypt. Password lama yang masih berupa teks biasa di-hash dengan bcrypt setelah login berhasil.
- Token sesi acak dibuat saat login dan disimpan dalam memori backend. Semua endpoint API selain `/api/health` dan `/api/login` memerlukan token tersebut.
- Endpoint data karyawan, perubahan role, dan perubahan status dibatasi untuk Admin.
- Karyawan hanya dapat membaca aspirasi miliknya dan hanya role Karyawan yang dapat mengirim aspirasi.
- Admin tidak dapat mengirim aspirasi melalui endpoint submit.
- Endpoint daftar karyawan tidak mengirim password ke browser.
- Perubahan role mempertahankan setidaknya satu Admin aktif.
- Batas kiriman 10 aspirasi per karyawan per hari ditegakkan backend. Pemeriksaan kuota dan insert menggunakan transaksi serta mengunci baris akun untuk mencegah pengiriman bersamaan melewati batas.
- PIC harus karyawan aktif, memiliki jabatan terisi selain `Operator`, dan bukan pengirim aspirasi. Aturan ini diperiksa di frontend dan backend.
- Audit log aktivitas sistem tidak digunakan. Riwayat perubahan status aspirasi disimpan pada tiket.

Pemeriksaan akses frontend bukan batas keamanan. Otorisasi harus selalu dilakukan backend.

## Known Security Gaps

- Password bcrypt tidak dapat dipulihkan jika terlupa; administrator harus mengatur password baru melalui proses database tepercaya. Akun lama dengan password teks biasa baru dimigrasikan setelah login berhasil.
- Sesi disimpan dalam `Map` di memori, tanpa expiry dan hilang saat server restart. Logout menghapus sesi aktif. JWT belum digunakan meskipun ada variabel `JWT_SECRET`.
- Token anonim saat ini dibentuk dari ID karyawan (`KTR-<id>`), sehingga bukan anonim dan mudah ditebak. Jangan menyatakan identitas pengirim terlindungi.
- CORS terbuka untuk semua origin.
- Belum ada rate limiting login.
- Kuota harian berlaku berdasarkan tanggal MySQL (`CURDATE()`); pastikan zona waktu MySQL sesuai operasional.
- Endpoint update aspirasi memeriksa role, transisi status, PIC, tenggat, feedback, dan catatan hasil. Pengujian semua kombinasi alur tetap diperlukan.
- Sinkronisasi HR dan impor massal melalui API belum tersedia.

## Before Production

1. Pastikan seluruh password tersimpan sebagai hash bcrypt dan sediakan alur reset password yang aman.
2. Terapkan sesi aman dengan expiry dan penyimpanan yang sesuai deployment.
3. Buat token anonim acak yang tidak diturunkan dari ID; batasi akses ke pemetaan identitas.
4. Batasi CORS ke origin frontend dan tambahkan rate limiting serta validasi input di backend.
5. Uji otorisasi, kuota bersamaan, dan seluruh transisi status.
6. Gunakan HTTPS, kredensial database non-root dengan izin minimum, serta backup database.

## Reporting a Vulnerability

Laporkan masalah keamanan secara privat kepada pemelihara proyek. Sertakan dampak, langkah reproduksi, dan versi/commit terkait. Jangan sertakan data karyawan atau kredensial sungguhan, dan hindari memublikasikan detail eksploit sebelum perbaikan tersedia.
