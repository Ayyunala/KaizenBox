// ============================================================
// KAIZENBOX - Lacak Tiket
// ============================================================

import { useState } from 'react';
import { Pengguna, Ide } from '../api/apiClient';
import { api } from '../api/apiClient';
import { StatusBadge } from './shared/StatusBadge';
import { getIdeaSlaStatus } from '../services/businessServices';

export default function TrackTicket({ user }: { user: Pengguna }) {
  const [searchTiket, setSearchTiket] = useState('');
  const [foundIde, setFoundIde] = useState<Ide | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const tiket = searchTiket.trim().toUpperCase();
    if (!tiket) return;
    setLoading(true);
    try {
      const ide = await api.getIdeByTiket(tiket);
      if (ide) {
        setFoundIde(ide);
        setNotFound(false);
        setIsOwner(ide.tokenAnonim === user.tokenAnonim);
      } else {
        setFoundIde(null);
        setNotFound(true);
        setIsOwner(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🔍 Lacak Tiket</h1>
      <p className="text-gray-500 text-sm mb-6">Masukkan nomor tiket untuk melihat status dan riwayat aspirasi.</p>

      <div className="card mb-6">
        <div className="flex gap-3">
          <input type="text" className="form-input flex-1" placeholder="Contoh: KZ-2026-00001" value={searchTiket} onChange={e => setSearchTiket(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <button onClick={handleSearch} className="btn-primary" disabled={loading}>{loading ? '⏳' : '🔍 Cari'}</button>
        </div>
      </div>

      {notFound && <div className="banner banner-error">❌ Tiket "<strong>{searchTiket}</strong>" tidak ditemukan.</div>}

      {foundIde && (
        <div>
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500">Nomor Tiket</p>
                <p className="text-xl font-bold font-mono text-green-700">{foundIde.tiket}</p>
              </div>
              <StatusBadge status={foundIde.status} />
            </div>

            {(() => {
              const sla = getIdeaSlaStatus(foundIde);
              const levelClass = (level: string) => level === 'Terlambat' ? 'text-red-700' : level === 'Mendekati SLA' ? 'text-amber-700' : 'text-green-700';
              return (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs">
                  <div className="flex justify-between gap-3">
                    <span>Respons: <strong className={levelClass(sla.response)}>{sla.response}</strong></span>
                    {foundIde.tenggat && (
                      <span>Tenggat: <strong className={levelClass(sla.implementation)}>{sla.implementation}</strong></span>
                    )}
                  </div>
                </div>
              );
            })()}

            {!isOwner && (
              <div className="banner banner-warning">⚠️ Tiket ini bukan milikmu. Hanya informasi status umum yang ditampilkan.</div>
            )}

            {isOwner && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-bold text-gray-700 mb-3">Detail Aspirasi</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Kategori:</span> <strong>{foundIde.kategori}</strong></div>
                  <div><span className="text-gray-500">Bagian:</span> <strong>{foundIde.bagian}</strong></div>
                  <div className="col-span-2"><span className="text-gray-500">Judul:</span> <strong>{foundIde.judul}</strong></div>
                  <div><span className="text-gray-500">Tanggal Kirim:</span> <strong>{new Date(foundIde.tanggalKirim).toLocaleDateString('id-ID')}</strong></div>
                </div>
                <div className="mt-3 text-sm">
                  <p className="text-gray-500 font-semibold">Masalah:</p>
                  <p className="text-gray-800 bg-gray-50 p-2 rounded">{foundIde.masalah}</p>
                </div>
                <div className="mt-2 text-sm">
                  <p className="text-gray-500 font-semibold">Solusi:</p>
                  <p className="text-gray-800 bg-gray-50 p-2 rounded">{foundIde.solusi}</p>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card mb-4">
            <h3 className="font-bold text-gray-700 mb-4">📅 Riwayat Status</h3>
            <div className="ml-2">
              {foundIde.riwayatStatus.map((r, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.statusBaru} />
                    <span className="text-xs text-gray-400">{new Date(r.tanggal).toLocaleDateString('id-ID')}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{r.catatan}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Penanganan: prioritas, PIC, tenggat (hanya pemilik) */}
          {isOwner && (foundIde.picNama || foundIde.tenggat) && (
            <div className="card mb-4">
              <h3 className="font-bold text-gray-700 mb-3">🎯 Penanganan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500">Prioritas</p>
                  <p className="font-bold text-blue-700">{foundIde.prioritas}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500">Penanggung Jawab</p>
                  <p className="font-bold text-green-700">{foundIde.picNama || 'Belum ditunjuk'}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-gray-500">Target Selesai</p>
                  <p className="font-bold text-amber-700">
                    {foundIde.tenggat ? new Date(foundIde.tenggat).toLocaleDateString('id-ID') : 'Belum ditetapkan'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feedback */}
          {isOwner && !!foundIde.tanggalKeputusan && foundIde.feedback && (
            <div className="card mb-4">
              <h3 className="font-bold text-gray-700 mb-2">💬 Feedback Tim Kaizen</h3>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{foundIde.feedback}</p>
            </div>
          )}

          {/* Hasil akhir: apa yang dikerjakan atau alasan pembatalan */}
          {isOwner && foundIde.catatanHasil && (foundIde.status === 'Selesai' || foundIde.status === 'Dibatalkan') && (
            <div className="card mb-4">
              <h3 className="font-bold text-gray-700 mb-2">
                {foundIde.status === 'Selesai' ? '🏁 Hasil Tindak Lanjut' : '🚫 Alasan Pembatalan'}
              </h3>
              <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg">{foundIde.catatanHasil}</p>
            </div>
          )}

          {isOwner && foundIde.status === 'Ditolak' && foundIde.alasanTolak && (
            <div className="card">
              <h3 className="font-bold text-red-700 mb-2">❌ Alasan Penolakan</h3>
              <p className="text-sm text-gray-700 bg-red-50 p-3 rounded-lg">{foundIde.alasanTolak}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
