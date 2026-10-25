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
  'TEMP-RIZKY': 'Demo-Rizky-2026!',
  'TEMP-AGUS': 'Demo-Agus-2026!',
  'TEMP-DEWI': 'Demo-Dewi-2026!',
};

try {
  for (const [idKaryawan, plainPassword] of Object.entries(demoPasswords)) {
    const hashed = await bcrypt.hash(plainPassword, 12);
    await pool.query('UPDATE karyawan SET password = ? WHERE id_karyawan = ?', [hashed, idKaryawan]);
  }

  const [rows] = await pool.query("SELECT id_karyawan, password FROM karyawan WHERE id_karyawan LIKE 'TEMP-%' ORDER BY id_karyawan");
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await pool.end();
}
