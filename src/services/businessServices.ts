// ============================================================
// KAIZENBOX - Business Services Layer
// ============================================================
// File berisi logika bisnis, terpisah dari API client agar komponen tidak bergantung langsung pada endpoint backend.
// Komponen React memanggil fungsi di sini, bukan di API langsung.
// ============================================================

import { APP_CONFIG } from '../config/app.config';
import { api, Ide, PeranAkses, Pengguna } from '../api/apiClient';
import { isAdmin } from './authService';

// ============================================================
// HELPER FUNCTIONS
// ============================================================
export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export type SlaLevel = 'Normal' | 'Mendekati SLA' | 'Terlambat';

function getWorkingDays(startDate: string, endDate: Date = new Date()): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end <= start) return 0;

  let days = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function getSlaLevel(days: number, limit: number): SlaLevel {
  if (days > limit) return 'Terlambat';
  if (days >= Math.max(1, limit - 1)) return 'Mendekati SLA';
  return 'Normal';
}

export function getIdeaSlaStatus(ide: Ide): { response: SlaLevel; decision: SlaLevel; implementation: SlaLevel } {
  const reviewEntry = ide.riwayatStatus.find(entry => entry.statusBaru === 'Ditinjau');
  const responseDays = reviewEntry
    ? getWorkingDays(ide.tanggalKirim, new Date(reviewEntry.tanggal))
    : getWorkingDays(ide.tanggalKirim);
  const response = getSlaLevel(responseDays, APP_CONFIG.business.slaResponHari);

  // SLA keputusan dihitung sejak ide terakhir kali masuk "Menunggu Keputusan".
  const menungguEntry = [...ide.riwayatStatus].reverse().find(entry => entry.statusBaru === 'Menunggu Keputusan');
  const sedangMenunggu = ide.status === 'Menunggu Keputusan';
  const decision: SlaLevel = menungguEntry
    ? getSlaLevel(
        getWorkingDays(
          menungguEntry.tanggal,
          sedangMenunggu || !ide.tanggalKeputusan ? undefined : new Date(ide.tanggalKeputusan)
        ),
        APP_CONFIG.business.slaKeputusanHari
      )
    : 'Normal';

  // Tahap pengerjaan dinilai dari TENGGAT per aspirasi (bukan SLA yang sama)
  return { response, decision, implementation: getTenggatLevel(ide) };
}

function isValidStatusTransition(currentStatus: string, nextStatus: string): boolean {
  const transitions: Record<string, string[]> = {
    Terkirim: ['Ditinjau'],
    // Admin dapat meninjau langsung atau meminta persetujuan lanjutan.
    Ditinjau: ['Menunggu Keputusan', 'Implementasi', 'Antre Implementasi', 'Riset Lanjut', 'Ditolak'],
    'Menunggu Keputusan': ['Implementasi', 'Antre Implementasi', 'Riset Lanjut', 'Ditolak'],
    Implementasi: ['Selesai', 'Dibatalkan'],
    'Antre Implementasi': ['Implementasi', 'Dibatalkan'],   // dimulai saat jadwal tiba, atau dibatalkan jika rencana berubah
    'Riset Lanjut': ['Menunggu Keputusan'],
    Ditolak: [],
    Dibatalkan: [],
    Selesai: [],
  };
  return transitions[currentStatus]?.includes(nextStatus) ?? false;
}

export type Keputusan = 'implementasi' | 'antre' | 'riset' | 'tolak';

const HASIL_KEPUTUSAN: Record<Keputusan, { status: string; catatan: string }> = {
  implementasi: { status: 'Implementasi', catatan: 'Aspirasi disetujui untuk implementasi' },
  antre: { status: 'Antre Implementasi', catatan: 'Aspirasi diterima, menunggu jadwal implementasi' },
  riset: { status: 'Riset Lanjut', catatan: 'Dibutuhkan riset/penelitian lebih lanjut' },
  tolak: { status: 'Ditolak', catatan: 'Aspirasi ditolak' },
};

// Helper prioritas, tenggat, dan PIC (penanggung jawab)
// ------------------------------------------------------------

/** Prioritas awal saat aspirasi dikirim: keselamatan otomatis "Mendesak" */
export function prioritasAwal(kategori: string): string {
  return APP_CONFIG.kategoriMendesak.includes(kategori) ? 'Mendesak' : 'Normal';
}

/** Angka urutan prioritas: 0 = paling penting (untuk sorting) */
export function urutanPrioritas(prioritas: string): number {
  const i = APP_CONFIG.daftarPrioritas.indexOf(prioritas);
  return i === -1 ? APP_CONFIG.daftarPrioritas.length : i;
}

function tambahHari(tanggal: string, hari: number): string {
  const d = new Date(tanggal + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().split('T')[0];
}

function selisihHari(dari: string, ke: string): number {
  return Math.round((new Date(ke + 'T00:00:00Z').getTime() - new Date(dari + 'T00:00:00Z').getTime()) / 86400000);
}

/** Saran tenggat (YYYY-MM-DD) menurut prioritas, dihitung dari hari ini */
export function tenggatDefault(prioritas: string): string {
  return tambahHari(todayStr(), APP_CONFIG.business.tenggatHariDefault[prioritas] ?? 14);
}

const STATUS_TUTUP = ['Selesai', 'Ditolak', 'Dibatalkan'];

function dapatMenjadiPic(pengguna: Pengguna): boolean {
  const jabatan = pengguna.jabatan?.trim().toLocaleLowerCase('id-ID');
  return !!jabatan && jabatan !== 'operator';
}

/** Tingkat kedekatan tenggat: Normal / Mendekati SLA / Terlambat. Aspirasi tanpa tenggat atau sudah ditutup = Normal */
export function getTenggatLevel(ide: Ide): SlaLevel {
  if (!ide.tenggat || STATUS_TUTUP.includes(ide.status)) return 'Normal';
  const sisa = selisihHari(todayStr(), ide.tenggat);
  if (sisa < 0) return 'Terlambat';
  if (sisa <= APP_CONFIG.business.peringatanTenggatHari) return 'Mendekati SLA';
  return 'Normal';
}

export function isTerlambat(ide: Ide): boolean {
  return getTenggatLevel(ide) === 'Terlambat';
}

/** PIC harus karyawan aktif, bukan Operator, dan bukan pengirim aspirasi. */
async function validasiPicTenggat(
  picToken: string, tenggat: string, ide: Ide
): Promise<{ ok: true; pic: Pengguna } | { ok: false; message: string }> {
  if (!picToken) return { ok: false, message: 'Penanggung jawab (PIC).' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tenggat || '')) return { ok: false, message: 'Tenggat wajib diisi.' };
  if (tenggat < todayStr()) return { ok: false, message: 'Tenggat tidak boleh sebelum hari ini.' };
  const pic = (await api.getAllPengguna()).find(
    p => p.tokenAnonim === picToken && p.aktif && dapatMenjadiPic(p)
  );
  if (!pic) {
    return { ok: false, message: 'PIC harus karyawan aktif dengan jabatan selain Operator.' };
  }
  if (pic.tokenAnonim === ide.tokenAnonim) {
    return { ok: false, message: 'PIC tidak boleh pengirim aspirasi itu sendiri.' };
  }
  return { ok: true, pic };
}

/** Daftar karyawan aktif selain Operator yang dapat dipilih sebagai PIC oleh admin. */
export async function getDaftarPicService(): Promise<{ tokenAnonim: string; namaTampilan: string; bagian: string }[]> {
  const me = await api.getCurrentUser();
  if (!me || !isAdmin(me)) return [];
  return (await api.getAllPengguna())
    .filter(p => p.aktif && dapatMenjadiPic(p))
    .map(p => ({ tokenAnonim: p.tokenAnonim, namaTampilan: p.namaTampilan, bagian: p.bagian }));
}

/** Aspirasi milik admin yang sedang login tidak boleh muncul dalam antrean admin. */
function tanpaIdeSendiri(list: Ide[], me: Pengguna): Ide[] {
  return list.filter(i => i.tokenAnonim !== me.tokenAnonim);
}

// ============================================================
// SESSION SERVICE
// ============================================================

export async function logoutService(): Promise<void> {
  await api.logout();
}

export async function getCurrentUserService(): Promise<Pengguna | null> {
  return api.getCurrentUser();
}

// ============================================================
// BATAS KIRIMAN HARIAN (per orang)
// ============================================================
// Hanya untuk mencegah spam, bukan membatasi suara karyawan.

export async function checkQuotaService(user: Pengguna): Promise<{
  terpakai: number;
  maksimal: number;
  sisa: number;
}> {
  return api.getSisaBatasHarian(user.tokenAnonim);
}

// ============================================================
// IDEA SERVICE
// ============================================================

export async function submitIdeaService(
  user: Pengguna,
  data: {
    kategori: string;
    judul: string;
    masalah: string;
    solusi: string;
    lokasiAkurat: string;
    diLuarAreaProduksi: boolean;
    fotoData: string;
  }
): Promise<{ success: boolean; message: string; tiket?: string }> {
  // 1. Cek batas harian per orang
  const quota = await checkQuotaService(user);
  if (quota.sisa <= 0) {
    return {
      success: false,
      message: `Batas ${quota.maksimal} Kuota aspirasi per hari sudah tercapai. Kembali besok ya! 🙏`,
    };
  }

  // 2. Validasi
  if (!data.kategori || !data.judul.trim() || !data.masalah.trim() || !data.lokasiAkurat.trim()) {
    return { success: false, message: 'Kategori, judul, masalah, dan lokasi wajib diisi.' };
  }

  // 3. Buat ide
  const result = await api.createIde({
    tiket: '', // akan di-generate oleh adapter
    tokenAnonim: user.tokenAnonim,
    bagian: user.bagian,
    jabatan: user.jabatan,
    kategori: data.kategori,
    judul: data.judul.trim(),
    masalah: data.masalah.trim(),
    solusi: data.solusi.trim(),
    lokasiAkurat: data.lokasiAkurat.trim(),
    diLuarAreaProduksi: data.diLuarAreaProduksi,
    fotoData: data.diLuarAreaProduksi ? data.fotoData : '',
    tanggalKirim: new Date().toISOString(),
    status: 'Terkirim',
    prioritas: prioritasAwal(data.kategori),
    picToken: '',
    picNama: '',
    tenggat: '',
    alasanTolak: '',
    feedback: '',
    rekomendasi: '',
    tanggalKeputusan: '',
    tanggalImplementasi: '',
    catatanHasil: '',
  });

  if (result.success && result.data) {
    return { success: true, message: 'Aspirasi berhasil dikirim!', tiket: result.data.tiket };
  }
  return { success: false, message: result.message || 'Gagal mengirim aspirasi.' };
}

// ------------------------------------------------------------
// Alur admin: tinjau -> keputusan langsung atau persetujuan lanjutan -> implementasi.
// ------------------------------------------------------------

export type TindakanTinjau = 'tangani' | 'antre' | 'riset' | 'tolak' | 'eskalasi';

const HASIL_TINJAU: Record<TindakanTinjau, { status: string; catatan: string }> = {
  tangani: { status: 'Implementasi', catatan: 'Aspirasi diterima dan akan ditangani langsung oleh tim' },
  antre: { status: 'Antre Implementasi', catatan: 'Aspirasi diterima, menunggu jadwal penanganan' },
  riset: { status: 'Riset Lanjut', catatan: 'Dibutuhkan riset/penelitian lebih lanjut' },
  tolak: { status: 'Ditolak', catatan: 'Aspirasi ditolak' },
  eskalasi: { status: 'Menunggu Keputusan', catatan: 'Sudah ditinjau oleh admin, menunggu persetujuan selanjutnya' },
};

const REKOMENDASI_DARI_TINDAKAN: Record<Exclude<TindakanTinjau, 'eskalasi'>, Keputusan> = {
  tangani: 'implementasi', antre: 'antre', riset: 'riset', tolak: 'tolak',
};

/**
 * Admin meninjau aspirasi lalu memilih tindakan.
 * - tangani   : tim langsung mengerjakan (wajib PIC + tenggat)
 * - antre     : diterima, dijadwalkan nanti (PIC/tenggat opsional)
 * - riset     : perlu riset lanjut
 * - tolak     : ditolak (wajib alasan)
 * - eskalasi  : meminta persetujuan lanjutan (wajib rekomendasi)
 */
export async function tinjauIdeService(
  tiket: string,
  input: {
    prioritas: string;
    tindakan: TindakanTinjau;
    feedback: string;
    alasanTolak?: string;
    rekomendasi?: Keputusan;   // hanya untuk eskalasi
    picToken?: string;
    tenggat?: string;
  }
): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const admin = await api.getCurrentUser();
  if (!admin || !isAdmin(admin)) {
    return { success: false, message: 'Hanya admin yang dapat meninjau aspirasi.' };
  }
  if (input.feedback.trim().length < APP_CONFIG.business.minimumFeedback) {
    return {
      success: false,
      message: `Tanggapan wajib minimal ${APP_CONFIG.business.minimumFeedback} karakter. Saat ini: ${input.feedback.trim().length} karakter.`,
    };
  }
  if (!APP_CONFIG.daftarPrioritas.includes(input.prioritas)) {
    return { success: false, message: 'Pilih prioritas.' };
  }
  const hasil = HASIL_TINJAU[input.tindakan];
  if (!hasil) return { success: false, message: 'Tindakan tidak dikenali.' };

  const alasanTolak = (input.alasanTolak || '').trim();
  const rekomendasi: Keputusan | '' = input.tindakan === 'eskalasi'
    ? (input.rekomendasi || '')
    : REKOMENDASI_DARI_TINDAKAN[input.tindakan];
  if (input.tindakan === 'eskalasi' && !rekomendasi) {
    return { success: false, message: 'Pilih rekomendasi persetujuan lanjutan.' };
  }
  if ((input.tindakan === 'tolak' || rekomendasi === 'tolak') && !alasanTolak) {
    return { success: false, message: 'Alasan penolakan.' };
  }

  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === admin.tokenAnonim) {
    return { success: false, message: 'Anda tidak dapat meninjau aspirasi sendiri.' };
  }
  if (!isValidStatusTransition(ide.status, hasil.status)) {
    return { success: false, message: `Perubahan status dari "${ide.status}" ke "${hasil.status}" tidak diizinkan.` };
  }

  // PIC + tenggat: wajib untuk "tangani", opsional untuk "antre"
  let picToken = '', picNama = '', tenggat = '';
  const adaPic = !!(input.picToken || input.tenggat);
  if (input.tindakan === 'tangani' || (input.tindakan === 'antre' && adaPic)) {
    const cek = await validasiPicTenggat(input.picToken || '', input.tenggat || '', ide);
    if (!cek.ok) return { success: false, message: cek.message };
    picToken = cek.pic.tokenAnonim; picNama = cek.pic.namaTampilan; tenggat = input.tenggat!;
  }

  const today = todayStr();
  const langsung = input.tindakan !== 'eskalasi';   // keputusan sudah final di tahap tim
  let catatan = hasil.catatan;
  if (input.tindakan === 'tolak') catatan += `: ${alasanTolak}`;
  if (picNama) catatan += `. Penanggung jawab: ${picNama}, target selesai ${tenggat}`;

  const result = await api.updateIde(tiket, {
    prioritas: input.prioritas,
    feedback: input.feedback.trim(),
    rekomendasi,
    alasanTolak: (input.tindakan === 'tolak' || rekomendasi === 'tolak') ? alasanTolak : '',
    status: hasil.status,
    reviewerToken: admin.tokenAnonim,
    ...(picToken ? { picToken, picNama, tenggat } : {}),
    ...(langsung ? { tanggalKeputusan: today } : {}),
    // Rekomendasi internal tidak ditulis dalam catatan yang terlihat oleh pengirim.
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: ide.status, statusBaru: hasil.status, tanggal: today, catatan, oleh: admin.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal menyimpan tinjauan.' };
  }

  return {
    success: true,
    message: langsung ? `Tinjauan tersimpan. Status: ${hasil.status}.` : 'Tinjauan tersimpan dan menunggu persetujuan lanjutan.',
    ide: result.data,
  };
}

/** Admin memberi persetujuan lanjutan untuk aspirasi berstatus "Menunggu Keputusan". */
export async function putuskanIdeService(
  tiket: string,
  keputusan: Keputusan,
  alasanTolak: string,
  catatan: string,
  opsi?: { picToken?: string; tenggat?: string }
): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const admin = await api.getCurrentUser();
  if (!admin || !isAdmin(admin)) {
    return { success: false, message: 'Hanya admin yang dapat memutuskan aspirasi.' };
  }
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === admin.tokenAnonim) {
    return { success: false, message: 'Tidak dapat memutuskan aspirasi milik sendiri.' };
  }
  if (ide.status !== 'Menunggu Keputusan') {
    return { success: false, message: 'Aspirasi menunggu persetujuan lanjutan.' };
  }

  const { status: statusBaru, catatan: catatanDasar } = HASIL_KEPUTUSAN[keputusan];
  if (!isValidStatusTransition(ide.status, statusBaru)) {
    return { success: false, message: `Perubahan status dari "${ide.status}" ke "${statusBaru}" tidak diizinkan.` };
  }
  const alasan = alasanTolak || ide.alasanTolak;
  if (keputusan === 'tolak' && !alasan) {
    return { success: false, message: 'Alasan penolakan.' };
  }

  // Implementasi wajib memiliki PIC dan tenggat.
  let picUpdate: Partial<Ide> = {};
  let infoPic = '';
  if (keputusan === 'implementasi') {
    const cek = await validasiPicTenggat(opsi?.picToken || ide.picToken, opsi?.tenggat || ide.tenggat, ide);
    if (!cek.ok) return { success: false, message: cek.message };
    const tenggat = opsi?.tenggat || ide.tenggat;
    picUpdate = { picToken: cek.pic.tokenAnonim, picNama: cek.pic.namaTampilan, tenggat };
    infoPic = `. Penanggung jawab: ${cek.pic.namaTampilan}, target selesai ${tenggat}`;
  }

  const today = todayStr();
  const catatanRiwayat = (keputusan === 'tolak' ? `${catatanDasar}: ${alasan}` : catatanDasar)
    + infoPic
    + (catatan.trim() ? `. Catatan admin: ${catatan.trim()}` : '');

  const result = await api.updateIde(tiket, {
    status: statusBaru,
    tanggalKeputusan: today,
    pemutusToken: admin.tokenAnonim,
    alasanTolak: keputusan === 'tolak' ? alasan : '',
    ...picUpdate,
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: ide.status, statusBaru, tanggal: today, catatan: catatanRiwayat, oleh: admin.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal menyimpan keputusan.' };
  }

  return {
    success: true,
    message: `Keputusan "${statusBaru}" tersimpan.`,
    ide: result.data,
  };
}

/** Admin memulai pengerjaan aspirasi yang sedang antre (wajib PIC + tenggat). */
export async function mulaiImplementasiService(
  tiket: string, picToken: string, tenggat: string, catatan: string
): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const user = await api.getCurrentUser();
  if (!user || !isAdmin(user)) {
    return { success: false, message: 'Hanya admin yang dapat memulai implementasi.' };
  }
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === user.tokenAnonim) {
    return { success: false, message: 'Anda tidak dapat memproses aspirasi milik sendiri.' };
  }
  if (!isValidStatusTransition(ide.status, 'Implementasi') || ide.status !== 'Antre Implementasi') {
    return { success: false, message: `Perubahan status dari "${ide.status}" ke "Implementasi" tidak diizinkan.` };
  }
  const cek = await validasiPicTenggat(picToken, tenggat, ide);
  if (!cek.ok) return { success: false, message: cek.message };

  const today = todayStr();
  const catatanRiwayat = `Implementasi dimulai. Penanggung jawab: ${cek.pic.namaTampilan}, target selesai ${tenggat}`
    + (catatan.trim() ? `. Catatan: ${catatan.trim()}` : '');
  const result = await api.updateIde(tiket, {
    status: 'Implementasi',
    picToken: cek.pic.tokenAnonim, picNama: cek.pic.namaTampilan, tenggat,
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: ide.status, statusBaru: 'Implementasi', tanggal: today, catatan: catatanRiwayat, oleh: user.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal menyimpan.' };
  }
  return { success: true, message: 'Implementasi dimulai.', ide: result.data };
}

/** Admin mengganti PIC dan/atau tenggat aspirasi yang masih dikerjakan atau antre. */
export async function aturPicTenggatService(
  tiket: string, picToken: string, tenggat: string
): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const user = await api.getCurrentUser();
  if (!user || !isAdmin(user)) {
    return { success: false, message: 'Hanya admin yang dapat mengatur PIC dan tenggat.' };
  }
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === user.tokenAnonim) {
    return { success: false, message: 'Anda tidak dapat memproses aspirasi sendiri.' };
  }
  if (ide.status !== 'Implementasi' && ide.status !== 'Antre Implementasi') {
    return { success: false, message: 'PIC dan tenggat hanya bisa diatur saat aspirasi antre atau sedang diimplementasikan.' };
  }
  const cek = await validasiPicTenggat(picToken, tenggat, ide);
  if (!cek.ok) return { success: false, message: cek.message };

  const today = todayStr();
  const result = await api.updateIde(tiket, {
    picToken: cek.pic.tokenAnonim, picNama: cek.pic.namaTampilan, tenggat,
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: ide.status, statusBaru: ide.status, tanggal: today,
      catatan: `Penanggung jawab: ${cek.pic.namaTampilan}, target selesai ${tenggat}`, oleh: user.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal menyimpan.' };
  }
  return { success: true, message: 'Penanggung jawab dan tenggat diperbarui.', ide: result.data };
}

/** Admin menandai aspirasi selesai dengan catatan hasil yang terlihat oleh pengirim. */
export async function selesaikanIdeService(tiket: string, catatanHasil: string): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const user = await api.getCurrentUser();
  if (!user || !isAdmin(user)) {
    return { success: false, message: 'Aspirasi selesai.' };
  }
  const hasil = (catatanHasil || '').trim();
  if (hasil.length < APP_CONFIG.business.minimumCatatanHasil) {
    return {
      success: false,
      message: `Catatan hasil wajib minimal ${APP_CONFIG.business.minimumCatatanHasil} karakter (keterangan apa saja yang dikerjakan). Saat ini: ${hasil.length} karakter.`,
    };
  }
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === user.tokenAnonim) {
    return { success: false, message: 'Anda tidak dapat memproses aspirasi sendiri.' };
  }
  if (!isValidStatusTransition(ide.status, 'Selesai')) {
    return { success: false, message: `Perubahan status dari "${ide.status}" ke "Selesai" tidak diizinkan.` };
  }

  const today = todayStr();
  const result = await api.updateIde(tiket, {
    status: 'Selesai',
    tanggalImplementasi: today,
    catatanHasil: hasil,
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: ide.status, statusBaru: 'Selesai', tanggal: today, catatan: 'Implementasi selesai', oleh: user.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal menyimpan.' };
  }
  return { success: true, message: 'Aspirasi ditandai selesai.', ide: result.data };
}

/** Admin membatalkan aspirasi yang antre atau sedang dikerjakan dengan alasan. */
export async function batalkanIdeService(tiket: string, alasan: string): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const user = await api.getCurrentUser();
  if (!user || !isAdmin(user)) {
    return { success: false, message: 'Hanya admin yang dapat membatalkan aspirasi.' };
  }
  const teks = (alasan || '').trim();
  if (teks.length < APP_CONFIG.business.minimumCatatanHasil) {
    return {
      success: false,
      message: `Alasan pembatalan wajib minimal ${APP_CONFIG.business.minimumCatatanHasil} karakter. Saat ini: ${teks.length} karakter.`,
    };
  }
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === user.tokenAnonim) {
    return { success: false, message: 'Anda tidak dapat memproses aspirasi milik sendiri.' };
  }
  if (!isValidStatusTransition(ide.status, 'Dibatalkan')) {
    return { success: false, message: `Perubahan status dari "${ide.status}" ke "Dibatalkan" tidak diizinkan.` };
  }

  const today = todayStr();
  const result = await api.updateIde(tiket, {
    status: 'Dibatalkan',
    catatanHasil: teks,
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: ide.status, statusBaru: 'Dibatalkan', tanggal: today, catatan: 'Aspirasi dibatalkan', oleh: user.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal menyimpan.' };
  }
  return { success: true, message: 'Aspirasi dibatalkan.', ide: result.data };
}

/** Admin menyelesaikan riset dan mengembalikan aspirasi ke antrean keputusan. */
export async function lanjutkanRisetService(tiket: string, catatan: string): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const user = await api.getCurrentUser();
  if (!user || !isAdmin(user)) {
    return { success: false, message: 'Hanya admin yang dapat melanjutkan aspirasi dari riset.' };
  }
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === user.tokenAnonim) {
    return { success: false, message: 'Anda tidak dapat memproses aspirasi milik sendiri.' };
  }
  const statusBaru = 'Menunggu Keputusan';
  if (!isValidStatusTransition(ide.status, statusBaru)) {
    return { success: false, message: `Perubahan status dari "${ide.status}" ke "${statusBaru}" tidak diizinkan.` };
  }

  const today = todayStr();
  const catatanRiwayat = 'Riset selesai, kembali menunggu keputusan'
    + (catatan.trim() ? `. Catatan: ${catatan.trim()}` : '');
  const result = await api.updateIde(tiket, {
    status: statusBaru,
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: ide.status, statusBaru, tanggal: today, catatan: catatanRiwayat, oleh: user.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal menyimpan.' };
  }
  return { success: true, message: 'Aspirasi dikembalikan ke antrean keputusan.', ide: result.data };
}

/** Buka detail aspirasi (membaca, TIDAK mengubah status).
 * Admin dapat melihat aspirasi; aspirasi milik sendiri tidak boleh dibuka.
 */
export async function getAspirasiDetailService(tiket: string): Promise<Ide | null> {
  const me = await api.getCurrentUser();
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return null;
  if (!me || !isAdmin(me) || ide.tokenAnonim === me.tokenAnonim) return null;
  return ide;
}

/**Admin menekan "Mulai Tinjau": status Terkirim -> Ditinjau.
 * Hanya tindakan ini yang menghentikan jam SLA respons; sekadar membuka detail tidak.
 */
export async function mulaiTinjauService(tiket: string): Promise<{ success: boolean; message: string; ide?: Ide }> {
  const admin = await api.getCurrentUser();
  if (!admin || !isAdmin(admin)) {
    return { success: false, message: 'Hanya admin yang dapat memulai tinjauan.' };
  }
  const ide = await api.getIdeByTiket(tiket);
  if (!ide) return { success: false, message: 'Aspirasi tidak ditemukan.' };
  if (ide.tokenAnonim === admin.tokenAnonim) {
    return { success: false, message: 'Anda tidak dapat meninjau aspirasi milik sendiri.' };
  }
  if (ide.status !== 'Terkirim' || !isValidStatusTransition(ide.status, 'Ditinjau')) {
    return { success: false, message: `Tinjauan hanya bisa dimulai dari status "Terkirim" (saat ini: "${ide.status}").` };
  }

  const today = todayStr();
  const result = await api.updateIde(tiket, {
    status: 'Ditinjau',
    riwayatStatus: [...ide.riwayatStatus, {
      statusLama: 'Terkirim', statusBaru: 'Ditinjau', tanggal: today,
      catatan: 'Sedang ditinjau admin', oleh: admin.tokenAnonim,
    }],
  });
  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Gagal memulai tinjauan.' };
  }
  return { success: true, message: 'Tinjauan dimulai.', ide: result.data };
}

// ============================================================
// QUEUE SERVICE (untuk tim kaizen)
// ============================================================

export async function getReviewQueueService(filters?: {
  kategori?: string;
  status?: string;
  bagian?: string;
  search?: string;
}): Promise<Ide[]> {
  const me = await api.getCurrentUser();
  if (!me || !isAdmin(me)) return [];
  const allIde = tanpaIdeSendiri(await api.getAllIde(), me);

  // Filter: hanya Terkirim atau Ditinjau
  let filtered = allIde.filter(i => i.status === 'Terkirim' || i.status === 'Ditinjau');

  if (filters?.kategori) filtered = filtered.filter(i => i.kategori === filters.kategori);
  if (filters?.status) filtered = filtered.filter(i => i.status === filters.status);
  if (filters?.bagian) filtered = filtered.filter(i => i.bagian === filters.bagian);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(i =>
      i.judul.toLowerCase().includes(q) || i.tiket.toLowerCase().includes(q)
    );
  }

  // Sort: prioritas (Mendesak di atas), sisanya FIFO
  return filtered.sort((a, b) => {
    const selisih = urutanPrioritas(a.prioritas) - urutanPrioritas(b.prioritas);
    if (selisih !== 0) return selisih;
    return new Date(a.tanggalKirim).getTime() - new Date(b.tanggalKirim).getTime();
  });
}

/** Antrean keputusan admin (tanpa aspirasi milik sendiri). */
export async function getDecisionQueueService(): Promise<Ide[]> {
  const me = await api.getCurrentUser();
  if (!me || !isAdmin(me)) return [];
  const allIde = tanpaIdeSendiri(await api.getAllIde(), me);
  const prioritas = (i: Ide) => urutanPrioritas(i.prioritas);
  const tglNilai = (i: Ide) =>
    i.riwayatStatus.find(r => r.statusBaru === 'Menunggu Keputusan')?.tanggal || i.tanggalKirim;

  return allIde
    .filter(i => i.status === 'Menunggu Keputusan')
    .sort((a, b) => prioritas(a) - prioritas(b) || new Date(tglNilai(a)).getTime() - new Date(tglNilai(b)).getTime());
}

/*** Semua aspirasi dengan SEMUA status (untuk tracking adm).
 * Ide sendiri tidak tampil. Urutan: terbaru di atas.
 */
export async function getAllAspirasiService(filters?: {
  kategori?: string;
  status?: string;
  bagian?: string;
  prioritas?: string;
  hanyaTerlambat?: boolean;
  search?: string;
}): Promise<Ide[]> {
  const me = await api.getCurrentUser();
  if (!me || !isAdmin(me)) return [];
  let list = tanpaIdeSendiri(await api.getAllIde(), me);

  if (filters?.kategori) list = list.filter(i => i.kategori === filters.kategori);
  if (filters?.status) list = list.filter(i => i.status === filters.status);
  if (filters?.bagian) list = list.filter(i => i.bagian === filters.bagian);
  if (filters?.prioritas) list = list.filter(i => i.prioritas === filters.prioritas);
  if (filters?.hanyaTerlambat) list = list.filter(isTerlambat);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(i => i.judul.toLowerCase().includes(q) || i.tiket.toLowerCase().includes(q));
  }
  return list.sort((a, b) => new Date(b.tanggalKirim).getTime() - new Date(a.tanggalKirim).getTime());
}

// ============================================================
// STATISTICS SERVICE
// ============================================================

export async function getStatisticsService(): Promise<{
  totalIde: number;
  selesaiCount: number;
  persenSelesai: number;
  perKategori: Record<string, number>;
  perStatus: Record<string, number>;
  perBagian: Record<string, number>;
  perJabatan: Record<string, number>;
  perPrioritas: Record<string, number>;
  terlambatCount: number;
  ideBulanIni: number;
}> {
  const ideList = await api.getAllIde();

  const totalIde = ideList.length;
  const selesaiCount = ideList.filter(i => i.status === 'Selesai').length;
  const persenSelesai = totalIde > 0 ? Math.round((selesaiCount / totalIde) * 100) : 0;

  const perKategori: Record<string, number> = {};
  APP_CONFIG.daftarKategori.forEach(k => { perKategori[k] = 0; });
  ideList.forEach(i => { perKategori[i.kategori] = (perKategori[i.kategori] || 0) + 1; });

  const perStatus: Record<string, number> = {};
  APP_CONFIG.daftarStatus.forEach(s => { perStatus[s] = 0; });
  ideList.forEach(i => { perStatus[i.status] = (perStatus[i.status] || 0) + 1; });

  const perBagian: Record<string, number> = {};
  APP_CONFIG.daftarBagian.forEach(b => { perBagian[b] = 0; });
  ideList.forEach(i => { perBagian[i.bagian] = (perBagian[i.bagian] || 0) + 1; });

  const perJabatan: Record<string, number> = {};
  APP_CONFIG.daftarJabatan.forEach(j => { perJabatan[j] = 0; });
  ideList.forEach(i => { perJabatan[i.jabatan] = (perJabatan[i.jabatan] || 0) + 1; });

  const perPrioritas: Record<string, number> = {};
  APP_CONFIG.daftarPrioritas.forEach(p => { perPrioritas[p] = 0; });
  ideList.forEach(i => { perPrioritas[i.prioritas] = (perPrioritas[i.prioritas] || 0) + 1; });

  const terlambatCount = ideList.filter(isTerlambat).length;

  // Ide bulan ini
  const thisMonth = new Date().toISOString().slice(0, 7);
  const ideBulanIni = ideList.filter(i => i.tanggalKirim.startsWith(thisMonth)).length;

  return {
    totalIde, selesaiCount, persenSelesai,
    perKategori, perStatus, perBagian, perJabatan,
    perPrioritas, terlambatCount, ideBulanIni,
  };
}

// ============================================================
// EXPORT CSV SERVICE
// ============================================================

export async function exportIdeCsvService(): Promise<string> {
  // CSV memuat token anonim per baris: hanya untuk admin.
  const me = await api.getCurrentUser();
  if (!me || !isAdmin(me)) return '';
  const ideList = await api.getAllIde();

  const headers = [
    'Tiket', 'Token Anonim', 'Bagian', 'Jabatan', 'Kategori',
    'Judul', 'Masalah', 'Solusi', 'Lokasi', 'Tanggal Kirim',
    'Status', 'Prioritas', 'PIC', 'Tenggat', 'Feedback', 'Alasan Tolak', 'Catatan Hasil'
  ];

  const rows = ideList.map(i => [
    i.tiket, i.tokenAnonim, i.bagian, i.jabatan, i.kategori,
    `"${i.judul.replace(/"/g, '""')}"`,
    `"${i.masalah.replace(/"/g, '""')}"`,
    `"${i.solusi.replace(/"/g, '""')}"`,
    `"${i.lokasiAkurat.replace(/"/g, '""')}"`,
    i.tanggalKirim.split('T')[0],
    i.status, i.prioritas, `"${(i.picNama || '').replace(/"/g, '""')}"`, i.tenggat || '',
    `"${(i.feedback || '').replace(/"/g, '""')}"`,
    `"${(i.alasanTolak || '').replace(/"/g, '""')}"`,
    `"${(i.catatanHasil || '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return csv;
}

// ============================================================
// DATA KARYAWAN & PERAN (admin)
// ============================================================

/** Daftar karyawan untuk halaman admin. Token anonim sengaja DIBUANG agar hubungan ID-token tidak tampil. */
export async function getDaftarKaryawanService(): Promise<Omit<Pengguna, 'password' | 'tokenAnonim'>[]> {
  const admin = await api.getCurrentUser();
  if (!admin || !isAdmin(admin)) return [];
  const list = await api.getAllPengguna();
  return list.map(({ password: _p, tokenAnonim: _t, ...aman }) => aman);
}


/** Role karyawan/admin. */
export async function aturPeranService(idKaryawan: string, peran: PeranAkses[]): Promise<{ success: boolean; message: string }> {
  const admin = await api.getCurrentUser();
  if (!admin || !isAdmin(admin)) return { success: false, message: 'Hanya admin yang bisa mengatur peran.' };

  const semua = await api.getAllPengguna();
  const target = semua.find(u => u.idKaryawan === idKaryawan);
  if (!target) return { success: false, message: 'Karyawan tidak ditemukan.' };

  const baru: PeranAkses[] = peran.includes('admin') ? ['admin'] : ['karyawan'];
  const adminLain = semua.some(u => u.idKaryawan !== idKaryawan && u.aktif && u.peran.includes('admin'));
  if (target.peran.includes('admin') && !baru.includes('admin') && !adminLain) {
    return { success: false, message: 'Harus ada minimal satu admin aktif.' };
  }

  await api.setPeranPengguna(idKaryawan, baru);
  return { success: true, message: 'Peran diperbarui.' };
}
