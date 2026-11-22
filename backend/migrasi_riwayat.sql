USE kaizenbox;

CREATE TABLE riwayat_status (
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

INSERT INTO riwayat_status (
  aspirasi_id, status_lama, status_baru, catatan, oleh_id, waktu
)
SELECT
  a.id,
  NULLIF(jt.status_lama, '-'),
  jt.status_baru,
  jt.catatan,
  COALESCE(k.id, a.id_karyawan),
  COALESCE(
    STR_TO_DATE(LEFT(jt.tanggal, 19), '%Y-%m-%dT%H:%i:%s'),
    a.tanggal_kirim
  )
FROM aspirasi AS a
JOIN JSON_TABLE(
  COALESCE(a.riwayat_status, JSON_ARRAY()),
  '$[*]' COLUMNS (
    urutan FOR ORDINALITY,
    status_lama VARCHAR(50) PATH '$.statusLama' NULL ON EMPTY NULL ON ERROR,
    status_baru VARCHAR(50) PATH '$.statusBaru' NULL ON EMPTY NULL ON ERROR,
    tanggal VARCHAR(64) PATH '$.tanggal' NULL ON EMPTY NULL ON ERROR,
    catatan TEXT PATH '$.catatan' NULL ON EMPTY NULL ON ERROR,
    oleh VARCHAR(100) PATH '$.oleh' NULL ON EMPTY NULL ON ERROR
  )
) AS jt
LEFT JOIN karyawan AS k
  ON k.id_karyawan = CASE
    WHEN jt.oleh LIKE 'KTR-%' THEN SUBSTRING(jt.oleh, 5)
    ELSE NULL
  END
WHERE jt.status_baru IS NOT NULL
ORDER BY a.id, jt.urutan;

INSERT INTO riwayat_status (
  aspirasi_id, status_lama, status_baru, catatan, oleh_id, waktu
)
SELECT
  a.id, NULL, a.status, 'Riwayat awal dibuat saat migrasi',
  a.id_karyawan, a.tanggal_kirim
FROM aspirasi AS a
WHERE NOT EXISTS (
  SELECT 1 FROM riwayat_status AS r WHERE r.aspirasi_id = a.id
);

-- Pemeriksaan: hasil harus kosong.
SELECT a.id, a.tiket
FROM aspirasi AS a
WHERE NOT EXISTS (
  SELECT 1 FROM riwayat_status AS r WHERE r.aspirasi_id = a.id
);

-- Hapus kolom JSON hanya secara manual setelah hasil migrasi diverifikasi:
-- ALTER TABLE aspirasi DROP COLUMN riwayat_status;
