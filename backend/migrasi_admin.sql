USE kaizenbox;

CREATE TABLE admin (
  karyawan_id INT PRIMARY KEY,
  ditunjuk_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ditunjuk_oleh INT NULL,
  FOREIGN KEY (karyawan_id) REFERENCES karyawan(id) ON DELETE CASCADE,
  FOREIGN KEY (ditunjuk_oleh) REFERENCES karyawan(id) ON DELETE SET NULL
);

INSERT INTO admin (karyawan_id)
SELECT id FROM karyawan WHERE role = 'admin';

-- Jalankan manual setelah backend baru teruji:
-- ALTER TABLE karyawan DROP COLUMN role;
