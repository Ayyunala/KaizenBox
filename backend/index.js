import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db, ensureSchema, testConnection } from './db.js';

const activeSessions = new Map();
const DAILY_IDEA_LIMIT = 10;

const STATUS_TRANSITIONS = {
  Terkirim: ['Ditinjau'],
  Ditinjau: ['Menunggu Keputusan', 'Implementasi', 'Antre Implementasi', 'Riset Lanjut', 'Ditolak'],
  'Menunggu Keputusan': ['Implementasi', 'Antre Implementasi', 'Riset Lanjut', 'Ditolak'],
  Implementasi: ['Selesai', 'Dibatalkan'],
  'Antre Implementasi': ['Implementasi', 'Dibatalkan'],
  'Riset Lanjut': ['Menunggu Keputusan'],
  Ditolak: [],
  Dibatalkan: [],
  Selesai: [],
};

const parseHistory = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

async function verifyPassword(inputPassword, storedPassword, idKaryawan) {
  if (!storedPassword) return false;

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  if (inputPassword === storedPassword) {
    const migratedHash = await bcrypt.hash(inputPassword, 12);
    await db.execute('UPDATE karyawan SET password = ? WHERE id_karyawan = ?', [migratedHash, idKaryawan]);
    return true;
  }

  return false;
}

const dateOnly = (value) => {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
};

const normalizeUser = (row) => {
  const peran = [row.role === 'admin' ? 'admin' : 'karyawan'];

  return {
    id: row.id,
    idKaryawan: row.id_karyawan,
    password: '',
    namaTampilan: row.nama_tampilan,
    bagian: row.bagian,
    jabatan: row.jabatan,
    peran,
    tokenAnonim: row.token_anonim || `KTR-${row.id_karyawan}`,
    aktif: Boolean(row.aktif),
    createdAt: row.created_at,
    lastLogin: row.last_login || null,
  };
};

const normalizeIde = (row) => ({
  id: row.id,
  tiket: row.tiket,
  tokenAnonim: row.token_anonim || `KTR-${row.external_id_karyawan || row.id_karyawan}`,
  bagian: row.bagian || row.employee_bagian || 'Umum',
  jabatan: row.jabatan || row.employee_jabatan || 'Operator',
  kategori: row.kategori || 'Lainnya',
  judul: row.judul || '',
  masalah: row.masalah || '',
  solusi: row.solusi || '',
  lokasiAkurat: row.lokasi_akurate || '',
  diLuarAreaProduksi: Boolean(row.di_luar_area),
  fotoData: row.foto_data || '',
  tanggalKirim: row.tanggal_kirim || row.created_at,
  status: row.status || 'Terkirim',
  prioritas: row.prioritas || 'Normal',
  picToken: row.pic_token || '',
  picNama: row.pic_nama || '',
  tenggat: dateOnly(row.tenggat),
  alasanTolak: row.alasan_tolak || '',
  feedback: row.feedback || '',
  tanggalKeputusan: dateOnly(row.tanggal_keputusan),
  tanggalImplementasi: dateOnly(row.tanggal_implementasi),
  catatanHasil: row.catatan_hasil || '',
  riwayatStatus: parseHistory(row.riwayat_status),
  rekomendasi: row.rekomendasi || 'implementasi',
  reviewerToken: row.reviewer_token || undefined,
  pemutusToken: row.pemutus_token || undefined,
});

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || req.path === '/login') return next();

  const authToken = req.headers.authorization?.replace('Bearer ', '') || '';
  const idKaryawan = activeSessions.get(authToken);
  if (!idKaryawan) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid. Silakan login kembali.' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, id_karyawan, nama_tampilan, bagian, jabatan, role, aktif, created_at FROM karyawan WHERE id_karyawan = ? AND aktif = 1 LIMIT 1',
      [idKaryawan]
    );
    if (!rows.length) {
      activeSessions.delete(authToken);
      return res.status(401).json({ success: false, message: 'Akun tidak aktif atau tidak ditemukan.' });
    }
    req.authUser = rows[0];
    req.authToken = authToken;
    return next();
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memvalidasi sesi.' });
  }
});

app.get('/api/health', async (req, res) => {
  const connected = await testConnection();
  res.json({
    success: true,
    message: connected ? 'Database MySQL terhubung' : 'Database MySQL tidak terhubung',
    connected,
  });
});

app.post('/api/login', async (req, res) => {
  const { idKaryawan, password } = req.body;

  if (!idKaryawan || !password) {
    return res.status(400).json({ success: false, message: 'ID karyawan dan password wajib diisi.' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM karyawan WHERE id_karyawan = ? AND aktif = 1 LIMIT 1',
      [idKaryawan]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau tidak aktif.' });
    }

    const user = rows[0];
    const passwordValid = await verifyPassword(password, user.password, user.id_karyawan);

    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Password salah.' });
    }

    const authToken = randomUUID();
    activeSessions.set(authToken, user.id_karyawan);
    const sesi = {
      idKaryawan: user.id_karyawan,
      peran: [user.role === 'admin' ? 'admin' : 'karyawan'],
      tokenAnonim: `KTR-${user.id_karyawan}`,
      loginAt: new Date().toISOString(),
      authToken,
    };

    const pengguna = normalizeUser(user);

    return res.json({
      success: true,
      message: 'Login berhasil',
      data: { sesi, pengguna },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Gagal login ke database.' });
  }
});

app.get('/api/karyawan', async (req, res) => {
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Hanya admin yang dapat melihat data karyawan.' });
  }

  try {
    const [rows] = await db.execute('SELECT id, id_karyawan, nama_tampilan, bagian, jabatan, role, aktif, created_at FROM karyawan ORDER BY id ASC');
    return res.json({ success: true, data: rows.map(normalizeUser) });
  } catch (error) {
    console.error('Get karyawan error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data karyawan.' });
  }
});

app.put('/api/karyawan/:idKaryawan/roles', async (req, res) => {
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Hanya admin yang dapat mengubah role.' });
  }

  const { idKaryawan } = req.params;
  const { peran } = req.body;

  if (!peran || !Array.isArray(peran)) {
    return res.status(400).json({ success: false, message: 'Peran tidak valid.' });
  }

  try {
    const role = peran.includes('admin') ? 'admin' : 'karyawan';
    const [targetRows] = await db.execute('SELECT role FROM karyawan WHERE id_karyawan = ? LIMIT 1', [idKaryawan]);
    if (!targetRows.length) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    }
    if (targetRows[0].role === 'admin' && role !== 'admin') {
      const [[adminCount]] = await db.execute("SELECT COUNT(*) AS jumlah FROM karyawan WHERE role = 'admin' AND aktif = 1");
      if (adminCount.jumlah <= 1) {
        return res.status(400).json({ success: false, message: 'Sistem harus memiliki minimal satu admin aktif.' });
      }
    }
    await db.execute('UPDATE karyawan SET role = ? WHERE id_karyawan = ?', [role, idKaryawan]);
    return res.json({ success: true, message: 'Role berhasil diperbarui.' });
  } catch (error) {
    console.error('Set role error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui role.' });
  }
});

app.get('/api/aspirasi', async (req, res) => {
  try {
    const ownOnly = req.authUser.role !== 'admin';
    const [rows] = await db.execute(`
      SELECT a.*, k.id_karyawan AS external_id_karyawan,
        k.bagian AS employee_bagian, k.jabatan AS employee_jabatan
      FROM aspirasi a
      LEFT JOIN karyawan k ON k.id = a.id_karyawan
      ${ownOnly ? 'WHERE a.id_karyawan = ?' : ''}
      ORDER BY a.id DESC
    `, ownOnly ? [req.authUser.id] : []);
    return res.json({ success: true, data: rows.map(normalizeIde) });
  } catch (error) {
    console.error('Get aspirasi error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data aspirasi.' });
  }
});

app.get('/api/aspirasi/daily-limit', async (req, res) => {
  try {
    const [[row]] = await db.execute(
      'SELECT COUNT(*) AS terpakai FROM aspirasi WHERE id_karyawan = ? AND DATE(tanggal_kirim) = CURDATE()',
      [req.authUser.id]
    );
    const maksimal = DAILY_IDEA_LIMIT;
    return res.json({ success: true, data: { terpakai: row.terpakai, maksimal, sisa: Math.max(0, maksimal - row.terpakai) } });
  } catch (error) {
    console.error('Daily limit error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memeriksa batas pengiriman.' });
  }
});

app.post('/api/aspirasi', async (req, res) => {
  const {
    kategori,
    judul,
    masalah,
    solusi,
    lokasiAkurat,
    diLuarAreaProduksi,
    fotoData,
  } = req.body;

  if (req.authUser.role !== 'karyawan') {
    return res.status(403).json({ success: false, message: 'Hanya karyawan yang dapat mengirim aspirasi.' });
  }

  if (typeof kategori !== 'string' || !kategori.trim()
    || typeof judul !== 'string' || !judul.trim()
    || typeof masalah !== 'string' || !masalah.trim()
    || typeof lokasiAkurat !== 'string' || !lokasiAkurat.trim()) {
    return res.status(400).json({ success: false, message: 'Kategori, judul, masalah, dan lokasi wajib diisi.' });
  }
  if (judul.length > 200 || (typeof fotoData === 'string' && fotoData.length > 700000)) {
    return res.status(413).json({ success: false, message: 'Judul atau foto melebihi batas ukuran.' });
  }

  let connection;
  let transactionStarted = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [accountRows] = await connection.execute(
      'SELECT id FROM karyawan WHERE id = ? AND aktif = 1 FOR UPDATE',
      [req.authUser.id]
    );
    if (!accountRows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(401).json({ success: false, message: 'Akun tidak aktif atau tidak ditemukan.' });
    }

    const [[quota]] = await connection.execute(
      'SELECT COUNT(*) AS terpakai FROM aspirasi WHERE id_karyawan = ? AND DATE(tanggal_kirim) = CURDATE()',
      [req.authUser.id]
    );
    if (quota.terpakai >= DAILY_IDEA_LIMIT) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(429).json({ success: false, message: `Batas ${DAILY_IDEA_LIMIT} aspirasi per hari sudah tercapai.` });
    }

    const tiket = `KZ-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const prioritas = kategori.trim() === 'Keselamatan Kerja' ? 'Mendesak' : 'Normal';
    const riwayatStatus = [{
      statusLama: '-',
      statusBaru: 'Terkirim',
      tanggal: new Date().toISOString(),
      catatan: 'Aspirasi masuk antrean',
    }];
    await connection.execute(
      `INSERT INTO aspirasi (
        tiket, id_karyawan, bagian, jabatan, kategori, judul, masalah, solusi,
        lokasi_akurate, di_luar_area, foto_data, status, prioritas, riwayat_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Terkirim', ?, ?)`,
      [
        tiket, req.authUser.id, req.authUser.bagian, req.authUser.jabatan,
        kategori.trim(), judul.trim(), masalah.trim(), typeof solusi === 'string' ? solusi.trim() : '',
        lokasiAkurat.trim(), diLuarAreaProduksi ? 1 : 0,
        diLuarAreaProduksi && typeof fotoData === 'string' ? fotoData : '',
        prioritas, JSON.stringify(riwayatStatus),
      ]
    );

    const [rows] = await connection.execute(`
      SELECT a.*, k.id_karyawan AS external_id_karyawan,
        k.bagian AS employee_bagian, k.jabatan AS employee_jabatan
      FROM aspirasi a
      LEFT JOIN karyawan k ON k.id = a.id_karyawan
      WHERE a.tiket = ? LIMIT 1
    `, [tiket]);
    await connection.commit();
    transactionStarted = false;
    return res.json({ success: true, message: 'Aspirasi berhasil dikirim.', data: normalizeIde(rows[0]) });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Create aspirasi rollback error:', rollbackError);
      }
    }
    console.error('Create aspirasi error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan aspirasi.' });
  } finally {
    connection?.release();
  }
});

app.put('/api/aspirasi/:tiket', async (req, res) => {
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Hanya admin yang dapat mengubah aspirasi.' });
  }

  const { tiket } = req.params;
  const updates = req.body;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ success: false, message: 'Perubahan aspirasi tidak valid.' });
  }

  try {
    const [currentRows] = await db.execute('SELECT * FROM aspirasi WHERE tiket = ? LIMIT 1', [tiket]);
    if (!currentRows.length) {
      return res.status(404).json({ success: false, message: 'Aspirasi tidak ditemukan.' });
    }

    const current = currentRows[0];
    const nextStatus = updates.status || current.status;
    if (updates.status && updates.status !== current.status
      && !STATUS_TRANSITIONS[current.status]?.includes(updates.status)) {
      return res.status(400).json({
        success: false,
        message: `Perubahan status dari "${current.status}" ke "${updates.status}" tidak diizinkan.`,
      });
    }

    if (Object.hasOwn(updates, 'prioritas')
      && !['Mendesak', 'Tinggi', 'Normal', 'Rendah'].includes(updates.prioritas)) {
      return res.status(400).json({ success: false, message: 'Prioritas tidak valid.' });
    }
    if (Object.hasOwn(updates, 'feedback')
      && (typeof updates.feedback !== 'string' || updates.feedback.trim().length < 30)) {
      return res.status(400).json({ success: false, message: 'Tanggapan wajib minimal 30 karakter.' });
    }
    if (nextStatus === 'Ditolak' && !(updates.alasanTolak || current.alasan_tolak || '').trim()) {
      return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
    }
    if (nextStatus === 'Selesai' || nextStatus === 'Dibatalkan') {
      const catatanHasil = updates.catatanHasil ?? current.catatan_hasil ?? '';
      if (typeof catatanHasil !== 'string' || catatanHasil.trim().length < 20) {
        return res.status(400).json({
          success: false,
          message: nextStatus === 'Selesai'
            ? 'Catatan hasil wajib minimal 20 karakter.'
            : 'Alasan pembatalan wajib minimal 20 karakter.',
        });
      }
    }

    const requestedPicToken = Object.hasOwn(updates, 'picToken') ? updates.picToken : current.pic_token;
    const requestedDeadline = Object.hasOwn(updates, 'tenggat') ? updates.tenggat : dateOnly(current.tenggat);
    const validatesAssignment = nextStatus === 'Implementasi'
      || Object.hasOwn(updates, 'picToken')
      || Object.hasOwn(updates, 'tenggat');
    if (validatesAssignment) {
      if (typeof requestedPicToken !== 'string' || !requestedPicToken) {
        return res.status(400).json({ success: false, message: 'Pilih karyawan aktif sebagai PIC.' });
      }
      const [picRows] = await db.execute(
        `SELECT id_karyawan, nama_tampilan FROM karyawan
         WHERE CONCAT('KTR-', id_karyawan) = ? AND aktif = 1
           AND jabatan IS NOT NULL AND TRIM(jabatan) <> ''
           AND LOWER(TRIM(COALESCE(jabatan, ''))) <> 'operator'
         LIMIT 1`,
        [requestedPicToken]
      );
      if (!picRows.length || requestedPicToken === `KTR-${current.id_karyawan}`) {
        return res.status(400).json({
          success: false,
          message: 'PIC harus karyawan aktif dengan jabatan selain Operator dan bukan pengirim aspirasi.',
        });
      }
      if (!requestedDeadline) {
        return res.status(400).json({ success: false, message: 'Tenggat wajib diisi saat PIC ditunjuk.' });
      }
      if (typeof requestedDeadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDeadline)
        || requestedDeadline < new Date().toISOString().slice(0, 10)) {
        return res.status(400).json({ success: false, message: 'Tenggat harus tanggal hari ini atau setelahnya.' });
      }
      if (Object.hasOwn(updates, 'picToken')) {
        updates.picNama = picRows[0].nama_tampilan;
      }
    }

    const fieldMap = {
      kategori: 'kategori',
      judul: 'judul',
      masalah: 'masalah',
      solusi: 'solusi',
      lokasiAkurat: 'lokasi_akurate',
      diLuarAreaProduksi: 'di_luar_area',
      fotoData: 'foto_data',
      status: 'status',
      prioritas: 'prioritas',
      picToken: 'pic_token',
      picNama: 'pic_nama',
      tenggat: 'tenggat',
      alasanTolak: 'alasan_tolak',
      feedback: 'feedback',
      tanggalKeputusan: 'tanggal_keputusan',
      tanggalImplementasi: 'tanggal_implementasi',
      catatanHasil: 'catatan_hasil',
      rekomendasi: 'rekomendasi',
    };
    const setClauses = [];
    const values = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (!Object.hasOwn(updates, key)) continue;
      let value = updates[key];
      if (key === 'diLuarAreaProduksi') value = value ? 1 : 0;
      if (['tenggat', 'tanggalKeputusan', 'tanggalImplementasi'].includes(key)) {
        if (!value) value = null;
        else if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return res.status(400).json({ success: false, message: `Format tanggal ${key} tidak valid.` });
        }
      }
      setClauses.push(`${column} = ?`);
      values.push(value);
    }

    const reviewerToken = `KTR-${req.authUser.id_karyawan}`;
    if (Object.hasOwn(updates, 'reviewerToken')) {
      setClauses.push('reviewer_token = ?');
      values.push(reviewerToken);
    }
    if (Object.hasOwn(updates, 'pemutusToken')) {
      setClauses.push('pemutus_token = ?');
      values.push(reviewerToken);
    }

    const history = parseHistory(current.riwayat_status);
    const requestedHistory = Array.isArray(updates.riwayatStatus) ? updates.riwayatStatus : [];
    if (requestedHistory.length > history.length) {
      const entry = requestedHistory[requestedHistory.length - 1];
      if (!entry || typeof entry.catatan !== 'string' || entry.statusBaru !== nextStatus) {
        return res.status(400).json({ success: false, message: 'Riwayat status tidak valid.' });
      }
      history.push({
        statusLama: current.status,
        statusBaru: nextStatus,
        tanggal: new Date().toISOString(),
        catatan: entry.catatan,
        oleh: reviewerToken,
      });
    } else if (updates.status && updates.status !== current.status) {
      history.push({
        statusLama: current.status,
        statusBaru: nextStatus,
        tanggal: new Date().toISOString(),
        catatan: `Status diubah menjadi ${nextStatus}`,
        oleh: reviewerToken,
      });
    }

    if (history.length !== parseHistory(current.riwayat_status).length) {
      setClauses.push('riwayat_status = ?');
      values.push(JSON.stringify(history));
    }
    if (!setClauses.length) {
      return res.status(400).json({ success: false, message: 'Tidak ada perubahan yang dapat disimpan.' });
    }

    values.push(tiket);
    await db.execute(`UPDATE aspirasi SET ${setClauses.join(', ')} WHERE tiket = ?`, values);

    const [rows] = await db.execute(`
      SELECT a.*, k.id_karyawan AS external_id_karyawan,
        k.bagian AS employee_bagian, k.jabatan AS employee_jabatan
      FROM aspirasi a
      LEFT JOIN karyawan k ON k.id = a.id_karyawan
      WHERE a.tiket = ? LIMIT 1
    `, [tiket]);
    return res.json({ success: true, message: 'Aspirasi berhasil diperbarui.', data: normalizeIde(rows[0]) });
  } catch (error) {
    console.error('Update aspirasi error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui aspirasi.' });
  }
});

app.get('/api/aspirasi/:tiket', async (req, res) => {
  const { tiket } = req.params;
  try {
    const [rows] = await db.execute(
      `SELECT a.*, k.id_karyawan AS external_id_karyawan,
        k.bagian AS employee_bagian, k.jabatan AS employee_jabatan
      FROM aspirasi a LEFT JOIN karyawan k ON k.id = a.id_karyawan
       WHERE a.tiket = ? AND (? = 'admin' OR a.id_karyawan = ?) LIMIT 1`,
      [tiket, req.authUser.role, req.authUser.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Aspirasi tidak ditemukan.' });
    }

    return res.json({ success: true, data: normalizeIde(rows[0]) });
  } catch (error) {
    console.error('Get aspirasi by tiket error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat aspirasi.' });
  }
});

app.get('/api/me', async (req, res) => {
  return res.json({ success: true, data: normalizeUser(req.authUser) });
});

app.post('/api/logout', async (req, res) => {
  activeSessions.delete(req.authToken);
  return res.json({ success: true, message: 'Logout berhasil.' });
});

async function startServer() {
  try {
    const changes = await ensureSchema();
    app.listen(port, () => {
      console.log(`Backend berjalan di http://localhost:${port}`);
      console.log(changes ? `Migrasi otomatis diterapkan (${changes} perubahan).` : 'Skema database sudah mutakhir.');
    });
  } catch (error) {
    console.error('Backend gagal dimulai:', error.message);
    process.exitCode = 1;
  }
}
startServer();
