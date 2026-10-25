// ============================================================
// KAIZENBOX- Laporan statistik
// ============================================================

import { useState, useEffect } from 'react';
import { APP_CONFIG } from '../config/app.config';
import { getStatisticsService } from '../services/businessServices';

// ============================================================
// 1. STATISTIK
// ============================================================
export function Statistics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatisticsService().then(data => { setStats(data); setLoading(false); });
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">⏳ Memuat statistik...</div>;
  if (!stats) return null;

  const maxKategori = Math.max(...Object.values(stats.perKategori) as number[], 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📊 Statistik KaizenBox</h1>
      <p className="text-gray-500 text-sm mb-6">Ringkasan aspirasi yang masuk dan tindak lanjutnya.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center"><p className="text-3xl font-bold text-green-700">{stats.totalIde}</p><p className="text-xs text-gray-500">Total Aspirasi</p></div>
        <div className="card text-center"><p className="text-3xl font-bold text-blue-700">{stats.selesaiCount}</p><p className="text-xs text-gray-500">Selesai</p></div>
        <div className="card text-center"><p className="text-3xl font-bold text-amber-600">{stats.persenSelesai}%</p><p className="text-xs text-gray-500">Selesai Ditindaklanjuti</p></div>
        <div className="card text-center"><p className="text-3xl font-bold text-purple-700">{stats.ideBulanIni}</p><p className="text-xs text-gray-500">Bulan Ini</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h3 className="font-bold text-gray-700 mb-4">📈 Per Kategori</h3>
          <div className="space-y-3">
            {APP_CONFIG.daftarKategori.map((k: string) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-xs w-36 truncate text-right">{k}</span>
                <div className="progress-bar flex-1">
                  <div className="progress-fill" style={{ width: `${((stats.perKategori[k] || 0) / maxKategori) * 100}%` }}>
                    {(stats.perKategori[k] || 0) > 0 && (stats.perKategori[k] || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold text-gray-700 mb-4">📋 Per Status</h3>
          <div className="grid grid-cols-2 gap-3">
            {APP_CONFIG.daftarStatus.map((s: string) => (
              <div key={s} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{stats.perStatus[s] || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold text-gray-700 mb-4">🏢 Per Bagian</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {APP_CONFIG.daftarBagian.map((b: string) => (
            <div key={b} className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{stats.perBagian[b] || 0}</p>
              <p className="text-xs text-gray-600 mt-1">{b}</p>
            </div>
          ))}
        </div>
        <h3 className="font-bold text-gray-700 mt-6 mb-1">👤 Per Jabatan Pengirim</h3>
        <p className="text-xs text-gray-500 mb-3">Level pengirim aspirasi, ditampilkan sebagai angka gabungan.</p>
        <div className="grid grid-cols-3 gap-3">
          {APP_CONFIG.daftarJabatan.map((j: string) => (
            <div key={j} className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-700">{stats.perJabatan[j] || 0}</p>
              <p className="text-xs text-gray-600 mt-1">{j}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold text-gray-700 mb-2">Per prioritas</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            {Object.entries(stats.perPrioritas).map(([p, n]) => (
              <div key={p} className="bg-white rounded p-2">
                <p className="text-lg font-bold text-blue-700">{n as number}</p>
                <p className="text-xs text-gray-500">{p}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 p-3 bg-red-50 rounded-lg flex justify-between">
          <span className="text-sm">Aspirasi lewat tenggat:</span>
          <strong className="text-red-700">{stats.terlambatCount}</strong>
        </div>
      </div>
    </div>
  );
}
