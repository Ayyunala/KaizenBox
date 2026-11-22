import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kaizenbox',
  waitForConnections: true,
  connectionLimit: 2,
  dateStrings: true,
});

const historyTableSql = `
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
  )
`;

const adminTableSql = `
  CREATE TABLE IF NOT EXISTS admin (
    karyawan_id INT PRIMARY KEY,
    ditunjuk_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ditunjuk_oleh INT NULL,
    FOREIGN KEY (karyawan_id) REFERENCES karyawan(id) ON DELETE CASCADE,
    FOREIGN KEY (ditunjuk_oleh) REFERENCES karyawan(id) ON DELETE SET NULL
  )
`;

function parseHistory(value, ticket) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') {
    throw new Error(`Riwayat JSON untuk tiket ${ticket} bukan array atau string JSON.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Riwayat JSON untuk tiket ${ticket} tidak valid.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Riwayat JSON untuk tiket ${ticket} bukan array.`);
  }
  return parsed;
}

function normalizeTimestamp(value, fallback) {
  if (typeof value === 'string') {
    const match = value.slice(0, 19).match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
    );
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      const parsed = new Date(Date.UTC(
        Number(year), Number(month) - 1, Number(day),
        Number(hour), Number(minute), Number(second)
      ));
      if (parsed.toISOString().slice(0, 19) === value.slice(0, 19)) {
        return `${value.slice(0, 10)} ${value.slice(11, 19)}`;
      }
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  return fallback;
}

async function migrate() {
  const connection = await pool.getConnection();
  try {
    const [[databaseRow]] = await connection.query('SELECT DATABASE() AS database_name');
    const databaseName = databaseRow.database_name;
    if (databaseName !== (process.env.DB_NAME || 'kaizenbox')) {
      throw new Error(`Koneksi mengarah ke database "${databaseName}", bukan "${process.env.DB_NAME || 'kaizenbox'}".`);
    }

    const [tableRows] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('karyawan', 'aspirasi', 'admin', 'riwayat_status')`
    );
    const tables = new Set(tableRows.map(({ TABLE_NAME }) => TABLE_NAME));
    for (const requiredTable of ['karyawan', 'aspirasi']) {
      if (!tables.has(requiredTable)) {
        throw new Error(`Tabel ${requiredTable} belum ada di database ${databaseName}.`);
      }
    }

    const [columnRows] = await connection.execute(
      `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND ((TABLE_NAME = 'karyawan' AND COLUMN_NAME = 'role')
           OR (TABLE_NAME = 'aspirasi' AND COLUMN_NAME = 'riwayat_status'))`
    );
    const columns = new Set(columnRows.map(({ TABLE_NAME, COLUMN_NAME }) => `${TABLE_NAME}.${COLUMN_NAME}`));
    const hasLegacyRole = columns.has('karyawan.role');
    const hasLegacyHistory = columns.has('aspirasi.riwayat_status');

    if (!tables.has('admin') && !hasLegacyRole) {
      throw new Error('Tabel admin dan kolom karyawan.role tidak ditemukan; schema database tidak dikenali.');
    }
    if (!tables.has('riwayat_status') && !hasLegacyHistory) {
      throw new Error('Tabel riwayat_status dan kolom aspirasi.riwayat_status tidak ditemukan; schema database tidak dikenali.');
    }

    if (process.argv.includes('--dry-run')) {
      const [[aspirationCount]] = await connection.execute('SELECT COUNT(*) AS count FROM aspirasi');
      const [ideas] = hasLegacyHistory
        ? await connection.execute(`
          SELECT a.id, a.tiket, a.riwayat_status
          FROM aspirasi a
          ${tables.has('riwayat_status') ? 'WHERE NOT EXISTS (SELECT 1 FROM riwayat_status r WHERE r.aspirasi_id = a.id)' : ''}
          ORDER BY a.id ASC
        `)
        : [[]];
      let legacyHistoryRows = 0;
      let fallbackHistoryRows = 0;
      for (const idea of ideas) {
        const history = parseHistory(idea.riwayat_status, idea.tiket);
        for (const entry of history) {
          if (!entry || typeof entry.statusBaru !== 'string' || !entry.statusBaru) {
            throw new Error(`Entri riwayat untuk tiket ${idea.tiket} tidak memiliki statusBaru yang valid.`);
          }
        }
        legacyHistoryRows += history.length;
        if (history.length === 0) fallbackHistoryRows += 1;
      }

      const [[currentAdminCount]] = tables.has('admin')
        ? await connection.execute('SELECT COUNT(*) AS count FROM admin')
        : hasLegacyRole
          ? await connection.execute("SELECT COUNT(*) AS count FROM karyawan WHERE role = 'admin'")
          : [[{ count: 0 }]];
      const [[currentHistoryCount]] = tables.has('riwayat_status')
        ? await connection.execute('SELECT COUNT(*) AS count FROM riwayat_status')
        : [[{ count: 0 }]];
      console.log(JSON.stringify({
        dryRun: true,
        database: databaseName,
        adminsBefore: currentAdminCount.count,
        aspirations: aspirationCount.count,
        historiesAlreadyInTable: currentHistoryCount.count,
        legacyHistoryRowsToImport: legacyHistoryRows,
        fallbackHistoryRowsToCreate: fallbackHistoryRows,
        columnsKept: ['karyawan.role', 'aspirasi.riwayat_status'],
      }, null, 2));
      return;
    }

    await connection.query(adminTableSql);
    if (hasLegacyRole) {
      await connection.query(`
        INSERT IGNORE INTO admin (karyawan_id)
        SELECT id FROM karyawan WHERE role = 'admin'
      `);
    }

    await connection.query(historyTableSql);

    const [employees] = await connection.execute('SELECT id, id_karyawan FROM karyawan');
    const employeeIds = new Map(employees.map(({ id, id_karyawan }) => [id_karyawan, id]));
    await connection.beginTransaction();

    let importedHistoryRows = 0;
    let fallbackHistoryRows = 0;
    if (hasLegacyHistory) {
      const [ideas] = await connection.execute(`
        SELECT a.id, a.tiket, a.id_karyawan, a.status, a.tanggal_kirim, a.riwayat_status
        FROM aspirasi a
        WHERE NOT EXISTS (
          SELECT 1 FROM riwayat_status r WHERE r.aspirasi_id = a.id
        )
        ORDER BY a.id ASC
      `);

      for (const idea of ideas) {
        const history = parseHistory(idea.riwayat_status, idea.tiket);
        for (const entry of history) {
          if (!entry || typeof entry.statusBaru !== 'string' || !entry.statusBaru) {
            throw new Error(`Entri riwayat untuk tiket ${idea.tiket} tidak memiliki statusBaru yang valid.`);
          }

          const oldStatus = entry.statusLama === '-' || entry.statusLama == null
            ? null
            : String(entry.statusLama);
          const actorId = typeof entry.oleh === 'string' && entry.oleh.startsWith('KTR-')
            ? employeeIds.get(entry.oleh.slice(4)) || idea.id_karyawan
            : idea.id_karyawan;
          const timestamp = normalizeTimestamp(entry.tanggal, idea.tanggal_kirim);

          await connection.execute(
            `INSERT INTO riwayat_status
              (aspirasi_id, status_lama, status_baru, catatan, oleh_id, waktu)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              idea.id,
              oldStatus,
              entry.statusBaru,
              typeof entry.catatan === 'string' ? entry.catatan : null,
              actorId,
              timestamp,
            ]
          );
          importedHistoryRows += 1;
        }

        if (history.length === 0) {
          await connection.execute(
            `INSERT INTO riwayat_status
              (aspirasi_id, status_lama, status_baru, catatan, oleh_id, waktu)
             VALUES (?, NULL, ?, 'Riwayat awal dibuat saat migrasi', ?, ?)`,
            [idea.id, idea.status || 'Terkirim', idea.id_karyawan, idea.tanggal_kirim]
          );
          fallbackHistoryRows += 1;
        }
      }
    }

    const [missingHistory] = await connection.execute(`
      SELECT a.id, a.status, a.id_karyawan, a.tanggal_kirim
      FROM aspirasi a
      WHERE NOT EXISTS (
        SELECT 1 FROM riwayat_status r WHERE r.aspirasi_id = a.id
      )
      ORDER BY a.id ASC
    `);
    for (const idea of missingHistory) {
      await connection.execute(
        `INSERT INTO riwayat_status
          (aspirasi_id, status_lama, status_baru, catatan, oleh_id, waktu)
         VALUES (?, NULL, ?, 'Riwayat awal dibuat saat migrasi', ?, ?)`,
        [idea.id, idea.status || 'Terkirim', idea.id_karyawan, idea.tanggal_kirim]
      );
      fallbackHistoryRows += 1;
    }

    const [[adminCount]] = await connection.execute('SELECT COUNT(*) AS count FROM admin');
    const [[ideaCount]] = await connection.execute('SELECT COUNT(*) AS count FROM aspirasi');
    const [[historyCount]] = await connection.execute('SELECT COUNT(*) AS count FROM riwayat_status');
    const [[missingCount]] = await connection.execute(`
      SELECT COUNT(*) AS count FROM aspirasi a
      WHERE NOT EXISTS (
        SELECT 1 FROM riwayat_status r WHERE r.aspirasi_id = a.id
      )
    `);
    if (missingCount.count > 0) {
      throw new Error(`${missingCount.count} aspirasi masih belum memiliki riwayat status.`);
    }

    await connection.commit();
    console.log(JSON.stringify({
      database: databaseName,
      admins: adminCount.count,
      aspirations: ideaCount.count,
      histories: historyCount.count,
      importedHistoryRows,
      fallbackHistoryRows,
      aspirationsWithoutHistory: missingCount.count,
      legacyColumnsKept: {
        'karyawan.role': hasLegacyRole,
        'aspirasi.riwayat_status': hasLegacyHistory,
      },
    }, null, 2));
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Migration rollback error:', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

try {
  await migrate();
} catch (error) {
  console.error('Migrasi database gagal:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
