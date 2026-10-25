// ============================================================
// KAIZENBOX - Authentication & Authorization Service
// ============================================================
// Tiga hal yang DIPISAH:
// - Peran akses (file ini): apa yang boleh dilakukan di sistem
// - Bagian: asal ide (departemen)
// - Jabatan: level pengirim (Operator / Staff / Supervisor ke atas)
// Karyawan mengirim ide. Admin mengelola data, meninjau, dan memutuskan ide.
// ============================================================
import { Pengguna, PeranAkses, api } from '../api/apiClient';

type PunyaPeran = { peran: PeranAkses[] };

export const PERAN_LABEL: Record<PeranAkses, string> = {
  karyawan: 'Karyawan',
  admin: 'Admin',
};

export function labelPeran(user: PunyaPeran): string {
  if (!user.peran.length) return PERAN_LABEL.karyawan;
  return user.peran.map(r => PERAN_LABEL[r]).join(', ');
}

export const isKaryawan = (user: PunyaPeran) => user.peran.includes('karyawan') || (!user.peran.length);
export const isAdmin = (user: PunyaPeran) => user.peran.includes('admin');

// Halaman per role
const PAGES_KARYAWAN = ['dashboard', 'submit', 'track'];
const PAGES_ADMIN = ['dashboard', 'kaizen-queue', 'kaizen-decision', 'kaizen-semua', 'kaizen-detail', 'kaizen-stats'];

export function canSubmitAspirasi(user: PunyaPeran): boolean {
  return isKaryawan(user) && !isAdmin(user);
}

export function canAccessPage(user: PunyaPeran, page: string): boolean {
  if (page === 'submit') return canSubmitAspirasi(user);
  if (isAdmin(user)) return PAGES_ADMIN.includes(page);
  if (isKaryawan(user)) return PAGES_KARYAWAN.includes(page);
  return false;
}

export function getDefaultPage(): string {
  return 'dashboard';
}

// ============================================================
// AUTHENTICATION
// ============================================================
export async function validateLogin(
  idKaryawan: string,
  password: string
): Promise<{
  success: boolean;
  message: string;
  pengguna?: Pengguna;
}> {
  const result = await api.login(idKaryawan, password);

  if (!result.success || !result.data) {
    return { success: false, message: result.message || 'Login gagal' };
  }

  const user = result.data.pengguna;

  if (!user.aktif) {
    return { success: false, message: 'Akun Anda tidak aktif. Hubungi administrator.' };
  }

  return { success: true, message: 'Login berhasil', pengguna: user };
}
