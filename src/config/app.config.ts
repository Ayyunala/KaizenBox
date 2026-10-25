// KAIZENBOX - Konfigurasi Aplikasi Terpusat
// File berisi SEMUA setting yang bisa diubah tanpa menyentuh kode.
// Konfigurasi endpoint backend dan aturan bisnis.
// ============================================================

export const APP_CONFIG = {
  // --- Identitas Aplikasi ---
  appName: 'KaizenBox',
  companyName: 'PT. Boneka Sejahtera',

  // --- Backend URL ---
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',

  // --- Aturan Bisnis ---
  business: {
    // Minimum karakter feedback
    minimumFeedback: 30,
    // Minimum karakter catatan hasil (Selesai) dan alasan pembatalan
    minimumCatatanHasil: 20,
    // Batas ukuran foto (bytes)
    maxFotoSize: 500 * 1024, // 500KB

    // SLA (hari kerja)
    slaResponHari: 7,
    slaKeputusanHari: 3,       // batas hari kerja admin memutuskan sejak ide ditinjau
    // Tenggat penyelesaian default (hari kalender) menurut prioritas; PIC bisa diubah
    tenggatHariDefault: { Mendesak: 3, Tinggi: 7, Normal: 14, Rendah: 30 } as Record<string, number>,
    // Penanda "Mendekati tenggat": sisa hari <= nilai ini
    peringatanTenggatHari: 2,
  },
  // --- Daftar Statis (bisa diambil dari backend) ---
  daftarBagian: [
    'Produksi',
    'Quality Control',
    'Maintenance',
    'Gudang & Logistik',
    'Umum & Administrasi',
  ],

  // Jabatan (level) pengirim ide. dibuat (3 level) agar pengirim tidak ditebak. tampil sebagai statistik.
  daftarJabatan: ['Operator', 'Staff', 'Supervisor ke atas'],

  daftarKategori: [
    'Keselamatan Kerja',
    'Kualitas Produk',
    'Efisiensi Produksi',
    'Lingkungan & Kebersihan',
    'Kesejahteraan Karyawan',
    'Sarana & Fasilitas',
    'Lainnya',
  ],

  // Tingkat prioritas aspirasi (urut dari paling penting)
  daftarPrioritas: ['Mendesak', 'Tinggi', 'Normal', 'Rendah'] as string[],

  // Kategori yang otomatis berprioritas "Mendesak" saat dikirim (admin bisa mengubahnya)
  kategoriMendesak: ['Keselamatan Kerja'] as string[],

  daftarAlasanTolak: [
    'Duplikasi ide yang sudah ada',
    'Di luar kewenangan perusahaan',
    'Biaya implementasi yang cukup besar',
    'Sudah pernah diuji coba dan gagal',
    'Membutuhkan data/informasi tambahan',
    'Tidak sesuai dengan kebijakan perusahaan',
  ],

  daftarStatus: [
    'Terkirim',
    'Ditinjau',
    'Menunggu Keputusan',
    'Implementasi',
    'Antre Implementasi',
    'Riset Lanjut',
    'Ditolak',
    'Dibatalkan',
    'Selesai',
  ],
  // --- Fitur yang bisa diaktifkan/nonaktifkan ---
  features: {
    enableExportCsv: true,
  },
} as const;
