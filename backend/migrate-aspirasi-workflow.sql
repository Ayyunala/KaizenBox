USE kaizenbox;

ALTER TABLE aspirasi
  ADD COLUMN bagian VARCHAR(100),
  ADD COLUMN jabatan VARCHAR(100),
  ADD COLUMN foto_data MEDIUMTEXT,
  ADD COLUMN pic_token VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN pic_nama VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN tenggat DATE NULL,
  ADD COLUMN alasan_tolak TEXT,
  ADD COLUMN feedback TEXT,
  ADD COLUMN tanggal_keputusan DATE NULL,
  ADD COLUMN tanggal_implementasi DATE NULL,
  ADD COLUMN catatan_hasil TEXT,
  ADD COLUMN rekomendasi VARCHAR(30) NOT NULL DEFAULT 'implementasi',
  ADD COLUMN reviewer_token VARCHAR(40),
  ADD COLUMN pemutus_token VARCHAR(40),
  ADD COLUMN riwayat_status JSON,
  ADD INDEX idx_aspirasi_karyawan_tanggal (id_karyawan, tanggal_kirim);