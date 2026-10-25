import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kaizenbox',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
});

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    return false;
  }
}

export async function ensureSchema() {
  const [tables] = await db.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('karyawan', 'aspirasi')`
  );
  const existingTables = new Set(tables.map(row => row.TABLE_NAME));
  const missingTables = ['karyawan', 'aspirasi'].filter(table => !existingTables.has(table));
  if (missingTables.length) {
    throw new Error(`Tabel ${missingTables.join(', ')} belum ada. Impor backend/schema.sql terlebih dahulu.`);
  }

  const columnsToEnsure = {
    bagian: 'VARCHAR(100) NULL',
    jabatan: 'VARCHAR(100) NULL',
    foto_data: 'MEDIUMTEXT NULL',
    pic_token: "VARCHAR(40) NOT NULL DEFAULT ''",
    pic_nama: "VARCHAR(100) NOT NULL DEFAULT ''",
    tenggat: 'DATE NULL',
    alasan_tolak: 'TEXT NULL',
    feedback: 'TEXT NULL',
    tanggal_keputusan: 'DATE NULL',
    tanggal_implementasi: 'DATE NULL',
    catatan_hasil: 'TEXT NULL',
    rekomendasi: "VARCHAR(30) NOT NULL DEFAULT 'implementasi'",
    reviewer_token: 'VARCHAR(40) NULL',
    pemutus_token: 'VARCHAR(40) NULL',
    riwayat_status: 'JSON NULL',
  };

  const [columns] = await db.query('SHOW COLUMNS FROM aspirasi');
  const existingColumns = new Set(columns.map(column => column.Field));
  let changes = 0;
  for (const [column, definition] of Object.entries(columnsToEnsure)) {
    if (existingColumns.has(column)) continue;
    try {
      await db.query(`ALTER TABLE aspirasi ADD COLUMN \`${column}\` ${definition}`);
      changes += 1;
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

  const [indexes] = await db.query('SHOW INDEX FROM aspirasi WHERE Key_name = ?', ['idx_aspirasi_karyawan_tanggal']);
  if (!indexes.length) {
    try {
      await db.query('ALTER TABLE aspirasi ADD INDEX idx_aspirasi_karyawan_tanggal (id_karyawan, tanggal_kirim)');
      changes += 1;
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') throw error;
    }
  }

  return changes;
}

export const db = pool;
