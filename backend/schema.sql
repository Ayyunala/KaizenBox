CREATE DATABASE IF NOT EXISTS kaizenbox;
USE kaizenbox;

CREATE TABLE IF NOT EXISTS karyawan (
  id INT PRIMARY KEY AUTO_INCREMENT,
  id_karyawan VARCHAR(30) NOT NULL UNIQUE,
  nama_tampilan VARCHAR(100) NOT NULL,
  bagian VARCHAR(100),
  jabatan VARCHAR(100),
  password VARCHAR(255) NULL,
  role ENUM('karyawan', 'admin') NOT NULL DEFAULT 'karyawan',
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE karyawan MODIFY password VARCHAR(255) NULL;

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
  riwayat_status JSON,
  tanggal_kirim TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_karyawan) REFERENCES karyawan(id),
  INDEX idx_aspirasi_karyawan_tanggal (id_karyawan, tanggal_kirim)
);

INSERT INTO karyawan (id_karyawan, nama_tampilan, bagian, jabatan, password, role, aktif)
VALUES
  ('TEMP-RIZKY', 'Rizky Pratama', 'IT', 'Staf IT', NULL, 'admin', TRUE),
  ('TEMP-AGUS', 'Agus Setiawan', 'Produksi', 'Kepala Produksi', NULL, 'karyawan', TRUE),
  ('TEMP-DEWI', 'Dewi Lestari', 'Produksi', 'Supervisor Produksi', NULL, 'karyawan', TRUE)
ON DUPLICATE KEY UPDATE
  nama_tampilan = VALUES(nama_tampilan),
  bagian = VALUES(bagian),
  jabatan = VALUES(jabatan),
  role = VALUES(role),
  aktif = VALUES(aktif);
