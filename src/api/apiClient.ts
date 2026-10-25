// ============================================================
// KAIZENBOX - Backend API Layer
// ============================================================
// File ini adalah INTI arsitektur production.
// Semua data aplikasi diambil dan disimpan melalui backend.
// ============================================================

import { APP_CONFIG } from '../config/app.config';

// TIPE DATA (dipakai di seluruh aplikasi)

// Peran akses di sistem 
// - karyawan : mengirim aspirasi dan melihat status
// - admin    : mengelola data dan memutuskan aspirasi
export type PeranAkses = 'karyawan' | 'admin';

export interface Pengguna {
  id: number;
  idKaryawan: string;
  password: string;       // Di backend: hash tidak plaintext
  namaTampilan: string;
  bagian: string;         // Asal ide: departemen
  jabatan: string;        // Operator / Staff / Supervisor ke atas
  peran: PeranAkses[];    // Peran tambahan; kosong = pengirim biasa (dikelola di KaizenBox, bukan dari HR)
  tokenAnonim: string;    // Dibuat otomatis, unik per karyawan
  aktif: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface RiwayatStatus {
  statusLama: string;
  statusBaru: string;
  tanggal: string;
  catatan: string;
  oleh?: string;          // Token anonim admin yang terkait perubahan status
}

export interface Ide {
  id: number;
  tiket: string;
  tokenAnonim: string;
  bagian: string;
  jabatan: string;        // Level pengirim untuk statistik
  kategori: string;
  judul: string;
  masalah: string;
  solusi: string;
  lokasiAkurat: string;
  diLuarAreaProduksi: boolean;
  fotoData: string;
  tanggalKirim: string;
  status: string;
  prioritas: string;       // Mendesak | Tinggi | Normal | Rendah (diisi otomatis saat kirim, bisa diubah admin)
  picToken: string;        // Penanggung jawab (PIC): token pengguna internal; '' jika belum ditunjuk
  picNama: string;         // Nama tampilan PIC (agar pengirim tahu siapa yang menangani)
  tenggat: string;         // Target selesai (YYYY-MM-DD); '' jika belum ditetapkan
  alasanTolak: string;
  feedback: string;
  tanggalKeputusan: string;
  tanggalImplementasi: string;
  catatanHasil: string;    // Hasil akhir: apa yang dikerjakan (Selesai) atau alasan pembatalan (Dibatalkan); terlihat oleh pengirim
  riwayatStatus: RiwayatStatus[];
  rekomendasi: string;     // Rekomendasi admin sebelum persetujuan lanjutan
  reviewerToken?: string;  // Token anonim admin yang meninjau
  pemutusToken?: string;   // Token anonim admin yang memutuskan
}

export interface SesiLogin {
  idKaryawan: string;
  peran: PeranAkses[];
  tokenAnonim: string;
  loginAt: string;
  authToken: string;      // Token sesi acak yang diterbitkan backend
}

// API RESPONSE WRAPPER (standar backend response)
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// ============================================================
// API ADAPTER INTERFACE
// ============================================================
// Ini adalah "kontrak" yg harus dipenuhi  semua adapter.
// IT tinggal membuat class baru dg implementasi interface ini.

export interface ApiAdapter {
  // --- Auth ---
  login(idKaryawan: string, password: string): Promise<ApiResponse<{ sesi: SesiLogin; pengguna: Pengguna }>>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<Pengguna | null>;

  // --- Ide ---
  getAllIde(): Promise<Ide[]>;
  getIdeByTiket(tiket: string): Promise<Ide | null>;
  getIdeByToken(tokenAnonim: string): Promise<Ide[]>;
  createIde(ide: Omit<Ide, 'id' | 'riwayatStatus'>): Promise<ApiResponse<Ide>>;
  updateIde(tiket: string, updates: Partial<Ide>): Promise<ApiResponse<Ide>>;

  // --- Batas kiriman harian per orang ---
  getSisaBatasHarian(tokenAnonim: string): Promise<{ terpakai: number; maksimal: number; sisa: number }>;

  // --- Pengguna & data karyawan ---
  getAllPengguna(): Promise<Pengguna[]>;
  setPeranPengguna(idKaryawan: string, peran: PeranAkses[]): Promise<void>;

}

// BACKEND ADAPTER
// ============================================================

class HttpAdapter implements ApiAdapter {
  private baseUrl = APP_CONFIG.API_BASE_URL;
  private readonly sessionKey = 'kaizenbox-auth-token';
  private authToken = '';

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(this.sessionKey);
      if (stored) this.authToken = stored;
    }
  }

  private persistSession(token: string) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.sessionKey, token);
    }
  }

  private clearSession() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.sessionKey);
    }
    this.authToken = '';
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async login(idKaryawan: string, password: string) {
    const result = await this.request<ApiResponse<{ sesi: SesiLogin; pengguna: Pengguna }>>(
      'POST', '/login', { idKaryawan, password }
    );
    if (result.success && result.data?.sesi) {
      this.authToken = result.data.sesi.authToken;
      this.persistSession(this.authToken);
    }
    return result;
  }

  async logout() {
    try {
      await this.request('POST', '/logout');
    } finally {
      this.clearSession();
    }
  }

  async getCurrentUser() {
    if (!this.authToken) {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(this.sessionKey);
        if (stored) this.authToken = stored;
      }
    }
    if (!this.authToken) return null;

    try {
      const res = await this.request<ApiResponse<Pengguna>>('GET', '/me');
      if (!res.data) {
        this.clearSession();
        return null;
      }
      return res.data;
    } catch (error) {
      this.clearSession();
      return null;
    }
  }

  async getAllIde() {
    const res = await this.request<ApiResponse<Ide[]>>('GET', '/aspirasi');
    return res.data || [];
  }

  async getIdeByTiket(tiket: string) {
    const res = await this.request<ApiResponse<Ide>>('GET', `/aspirasi/${tiket}`);
    return res.data || null;
  }

  async getIdeByToken(tokenAnonim: string) {
    const res = await this.request<ApiResponse<Ide[]>>('GET', `/aspirasi?token=${tokenAnonim}`);
    return res.data || [];
  }

  async createIde(ide: Omit<Ide, 'id' | 'riwayatStatus'>) {
    return this.request<ApiResponse<Ide>>('POST', '/aspirasi', ide);
  }

  async updateIde(tiket: string, updates: Partial<Ide>) {
    return this.request<ApiResponse<Ide>>('PUT', `/aspirasi/${tiket}`, updates);
  }

  async getSisaBatasHarian(tokenAnonim: string) {
    const res = await this.request<ApiResponse<{ terpakai: number; maksimal: number; sisa: number }>>(
      'GET', `/aspirasi/daily-limit?token=${tokenAnonim}`
    );
    return res.data!;
  }

  async getAllPengguna() {
    const res = await this.request<ApiResponse<Pengguna[]>>('GET', '/karyawan');
    return res.data || [];
  }

  async setPeranPengguna(idKaryawan: string, peran: PeranAkses[]) {
    await this.request('PUT', `/karyawan/${idKaryawan}/roles`, { peran });
  }

}

// ============================================================
// BACKEND ADAPTER INSTANCE
// ============================================================

export const api: ApiAdapter = new HttpAdapter();
