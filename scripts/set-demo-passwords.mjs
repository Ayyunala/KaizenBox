import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'kaizenbox',
});

const demoPasswords = {
  '201RIZKY': 'rizkypratama123',
  '222AGUS': 'agussetiawan123',
  '222DEWI': 'dewilestari123',
};

try {
  for (const [idKaryawan, plainPassword] of Object.entries(demoPasswords)) {
    const hashed = await bcrypt.hash(plainPassword, 12);
    await pool.query('UPDATE karyawan SET password = ? WHERE id_karyawan = ?', [hashed, idKaryawan]);
  }

  const ids = Object.keys(demoPasswords);
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.query(`SELECT id_karyawan, password FROM karyawan WHERE id_karyawan IN (${placeholders}) ORDER BY id_karyawan`, ids);
  console.log(JSON.stringify(rows.map(({ id_karyawan, password }) => ({ id_karyawan, password_updated: password.startsWith('$2') })), null, 2));
} finally {
  await pool.end();
}
