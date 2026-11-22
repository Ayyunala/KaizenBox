import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kaizenbox',
});

const demoPasswords = {
  'TEMP-RIZKY': 'rizkypratama123',
  'TEMP-AGUS': 'agussetiawan123',
  'TEMP-DEWI': 'dewilestari123',
};

try {
  const ids = Object.keys(demoPasswords);
  const placeholders = ids.map(() => '?').join(', ');
  const [accounts] = await pool.query(
    `SELECT id_karyawan FROM karyawan WHERE id_karyawan IN (${placeholders})`,
    ids
  );
  const foundIds = new Set(accounts.map(({ id_karyawan }) => id_karyawan));
  const missingIds = ids.filter((idKaryawan) => !foundIds.has(idKaryawan));
  if (missingIds.length) {
    throw new Error(`Akun demo tidak ditemukan: ${missingIds.join(', ')}. Impor backend/schema.sql terlebih dahulu.`);
  }

  for (const [idKaryawan, plainPassword] of Object.entries(demoPasswords)) {
    const hashed = await bcrypt.hash(plainPassword, 12);
    const [result] = await pool.query('UPDATE karyawan SET password = ? WHERE id_karyawan = ?', [hashed, idKaryawan]);
    if (result.affectedRows !== 1) {
      throw new Error(`Gagal memperbarui password akun demo ${idKaryawan}.`);
    }
  }

  const [rows] = await pool.query(`SELECT id_karyawan, password FROM karyawan WHERE id_karyawan IN (${placeholders}) ORDER BY id_karyawan`, ids);
  console.log(JSON.stringify(rows.map(({ id_karyawan, password }) => ({ id_karyawan, password_updated: password.startsWith('$2') })), null, 2));
} finally {
  await pool.end();
}
