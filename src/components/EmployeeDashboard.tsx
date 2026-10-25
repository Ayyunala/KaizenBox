// ============================================================
// KAIZENBOX - Dashboard Karyawan
// ============================================================

import { useState, useEffect } from 'react';
import type { PageKey } from '../App';
import { Pengguna, Ide } from '../api/apiClient';
import { checkQuotaService } from '../services/businessServices';
import { api } from '../api/apiClient';
import { StatusBadge } from './shared/StatusBadge';

export default function EmployeeDashboard({ user, onNavigate }: { user: Pengguna; onNavigate: (p: PageKey) => void }) {
  const [myIdeas, setMyIdeas] = useState<Ide[]>([]);
  const [quota, setQuota] = useState<{ terpakai: number; maksimal: number; sisa: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setError('');
    try {
      const [ideas, quotaData] = await Promise.all([
        api.getIdeByToken(user.tokenAnonim),
        checkQuotaService(user),
      ]);
      setMyIdeas(ideas.sort((a, b) => new Date(b.tanggalKirim).getTime() - new Date(a.tanggalKirim).getTime()));
      setQuota(quotaData);
    } catch (err) {
      console.error('Gagal load data:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [user.tokenAnonim]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">⏳ Memuat data...</div>;
  }

  const lastFive = myIdeas.slice(0, 5);
  // "Diproses" = belum ada hasil akhir (bukan Selesai, Ditolak, atau Dibatalkan)
  const dalamProses = myIdeas.filter(i => !(['Selesai', 'Ditolak', 'Dibatalkan'].includes(i.status))).length;
  const selesai = myIdeas.filter(i => i.status === 'Selesai').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Selamat Datang, {user.namaTampilan} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bagian: <strong>{user.bagian}</strong> • Jabatan: <strong>{user.jabatan}</strong>
        </p>
      </div>
      {error && (
        <div className="banner banner-error mb-4 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={loadData} className="btn-secondary text-sm">Coba lagi</button>
        </div>
      )}

      {/* Kartu Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Kuota */}
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📊</span>
            <h3 className="font-bold text-gray-700 text-sm">Batas Kirim Hari Ini</h3>
          </div>
          <div className="text-3xl font-bold text-green-700">{quota?.sisa ?? '-'}</div>
          <p className="text-xs text-gray-500 mt-1">sisa kuota dari {quota?.maksimal} aspirasi</p>
        </div>

        {/* Total Ide */}
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💡</span>
            <h3 className="font-bold text-gray-700 text-sm">Aspirasi Saya</h3>
          </div>
          <div className="text-3xl font-bold text-blue-700">{myIdeas.length}</div>
          <p className="text-xs text-gray-500 mt-1">aspirasi disampaikan</p>
        </div>

        {/* Dalam proses */}
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⏳</span>
            <h3 className="font-bold text-gray-700 text-sm">Sedang Diproses</h3>
          </div>
          <div className="text-3xl font-bold text-amber-600">{dalamProses}</div>
          <p className="text-xs text-gray-500 mt-1">aspirasi dalam tinjauan</p>
        </div>

        {/* Selesai */}
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏁</span>
            <h3 className="font-bold text-gray-700 text-sm">Selesai</h3>
          </div>
          <div className="text-3xl font-bold text-green-700">{selesai}</div>
          <p className="text-xs text-gray-500 mt-1">aspirasi sudah ditindaklanjuti</p>
        </div>
      </div>

      {/* Tombol Aksi */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => onNavigate('submit')} className="btn-primary flex items-center gap-2 text-lg px-6 py-3">
          💡 Sampaikan Aspirasi Baru
        </button>
        <button onClick={() => onNavigate('track')} className="btn-secondary flex items-center gap-2">
          🔍 Lacak Tiket
        </button>
      </div>

      {/* 5 Ide Terakhir */}
      <div className="card">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">📋 5 Aspirasi Terakhir</h3>
        {lastFive.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="text-4xl block mb-2">📭</span>
            <p>Belum ada aspirasi. Sampaikan aspirasi pertamamu!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lastFive.map(ide => (
              <div key={ide.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-green-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{ide.judul}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-mono">{ide.tiket}</span> • {ide.kategori} • {new Date(ide.tanggalKirim).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <StatusBadge status={ide.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-800">
          <strong>ℹ️ SLA:</strong> Respons awal ≤ 7 hari kerja • Penyelesaian lanjutannya akan ditetapkan oleh tim aspirasi.
        </p>
      </div>
    </div>
  );
}
