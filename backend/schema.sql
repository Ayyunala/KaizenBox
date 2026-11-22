CREATE DATABASE IF NOT EXISTS kaizenbox;
USE kaizenbox;

CREATE TABLE IF NOT EXISTS karyawan (
  id INT PRIMARY KEY AUTO_INCREMENT,
  id_karyawan VARCHAR(30) NOT NULL UNIQUE,
  nama_tampilan VARCHAR(100) NOT NULL,
  bagian VARCHAR(100),
  jabatan VARCHAR(100),
  password VARCHAR(255) NULL,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE karyawan MODIFY password VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS admin (
  karyawan_id INT PRIMARY KEY,
  ditunjuk_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ditunjuk_oleh INT NULL,
  FOREIGN KEY (karyawan_id) REFERENCES karyawan(id) ON DELETE CASCADE,
  FOREIGN KEY (ditunjuk_oleh) REFERENCES karyawan(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS aspirasi (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tiket VARCHAR(50) NOT NULL UNIQUE,
  id_karyawan INT NOT NULL,
  bagian VARCHAR(100),
  jabatan VARCHAR(100),
  kategori VARCHAR(100),
  judul VARCHAR(200),
  masalah TEXT,
  solusi TEXT,
  lokasi_akurate VARCHAR(200),
  di_luar_area BOOLEAN DEFAULT FALSE,
  foto_data MEDIUMTEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Terkirim',
  prioritas VARCHAR(30) DEFAULT 'Normal',
  pic_token VARCHAR(40) NOT NULL DEFAULT '',
  pic_nama VARCHAR(100) NOT NULL DEFAULT '',
  tenggat DATE NULL,
  alasan_tolak TEXT,
  feedback TEXT,
  tanggal_keputusan DATE NULL,
  tanggal_implementasi DATE NULL,
  catatan_hasil TEXT,
  rekomendasi VARCHAR(30) NOT NULL DEFAULT 'implementasi',
  reviewer_token VARCHAR(40),
  pemutus_token VARCHAR(40),
  tanggal_kirim TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_karyawan) REFERENCES karyawan(id),
  INDEX idx_aspirasi_karyawan_tanggal (id_karyawan, tanggal_kirim)
);

CREATE TABLE IF NOT EXISTS riwayat_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  aspirasi_id INT NOT NULL,
  status_lama VARCHAR(50) NULL,
  status_baru VARCHAR(50) NOT NULL,
  catatan TEXT,
  oleh_id INT NOT NULL,
  waktu TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (aspirasi_id) REFERENCES aspirasi(id) ON DELETE CASCADE,
  FOREIGN KEY (oleh_id) REFERENCES karyawan(id),
  INDEX idx_riwayat_aspirasi (aspirasi_id, waktu)
);

INSERT INTO karyawan (id_karyawan, nama_tampilan, bagian, jabatan, password, aktif)
VALUES
  ('TEMP-RIZKY', 'Rizky Pratama', 'IT', 'Staf IT', NULL, TRUE),
  ('TEMP-AGUS', 'Agus Setiawan', 'Produksi', 'Kepala Produksi', NULL, TRUE),
  ('TEMP-DEWI', 'Dewi Lestari', 'Produksi', 'Supervisor Produksi', NULL, TRUE)
ON DUPLICATE KEY UPDATE
  nama_tampilan = VALUES(nama_tampilan),
  bagian = VALUES(bagian),
  jabatan = VALUES(jabatan),
  aktif = VALUES(aktif);

INSERT INTO admin (karyawan_id)
SELECT id FROM karyawan WHERE id_karyawan = 'TEMP-RIZKY'
ON DUPLICATE KEY UPDATE karyawan_id = VALUES(karyawan_id);
