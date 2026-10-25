// ============================================================
// KAIZENBOX- Panel admin: tinjauan, keputusan, dan pelacakan aspirasi
// ============================================================

import { useState, useEffect } from 'react';
import { APP_CONFIG } from '../config/app.config';
import type { PageKey } from '../App';
import { Ide, Pengguna } from '../api/apiClient';
import {
  getReviewQueueService, getDecisionQueueService, getAllAspirasiService, getIdeaSlaStatus, exportIdeCsvService,
  getTenggatLevel, isTerlambat,
} from '../services/businessServices';
import { StatusBadge } from './shared/StatusBadge';
import { PrioritasBadge, TenggatBadge } from './shared/PrioritasBadge';
import KaizenDetail from './KaizenDetail';
import { Statistics } from './KaizenLaporan';

interface Props {
  currentPage: PageKey;
  selectedTiket: string;
  user: Pengguna;
  asalDetail: PageKey;   // halaman asal saat membuka detail (untuk tombol kembali)
  onNavigate: (page: PageKey) => void;
  onViewDetail: (tiket: string) => void;
}

export default function KaizenPages({ currentPage, selectedTiket, user, asalDetail, onNavigate, onViewDetail }: Props) {
  switch (currentPage) {
    case 'kaizen-queue': return <><AspirasiTabs currentPage={currentPage} onNavigate={onNavigate} /><KaizenQueue onViewDetail={onViewDetail} /></>;
    case 'kaizen-decision': return <><AspirasiTabs currentPage={currentPage} onNavigate={onNavigate} /><DecisionQueue onViewDetail={onViewDetail} /></>;
    case 'kaizen-semua': return <><AspirasiTabs currentPage={currentPage} onNavigate={onNavigate} /><SemuaAspirasi onViewDetail={onViewDetail} /></>;
    case 'kaizen-detail':
      return (
        <KaizenDetail
          tiket={selectedTiket}
          user={user}
          onBack={() => onNavigate(asalDetail)}
          backLabel={
            asalDetail === 'kaizen-decision' ? 'Kembali ke Antrean Keputusan'
              : asalDetail === 'kaizen-semua' ? 'Kembali ke Semua Aspirasi'
              : 'Kembali ke Antrean Tinjauan'
          }
        />
      );
    case 'kaizen-stats': return <Statistics />;
    default: return <KaizenQueue onViewDetail={onViewDetail} />;
  }
}

function AspirasiTabs({ currentPage, onNavigate }: { currentPage: PageKey; onNavigate: (page: PageKey) => void }) {
  const tabs: { key: PageKey; label: string }[] = [
    { key: 'kaizen-queue', label: 'Tinjauan' },
    { key: 'kaizen-decision', label: 'Keputusan' },
    { key: 'kaizen-semua', label: 'Semua' },
  ];

  return (
    <div className="flex gap-2 border-b border-gray-200 mb-5" role="tablist" aria-label="Daftar aspirasi">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={currentPage === tab.key}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            currentPage === tab.key
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
          onClick={() => onNavigate(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// 1. ANTREAN TINJAUAN (admin)
// ============================================================
function KaizenQueue({ onViewDetail }: { onViewDetail: (tiket: string) => void }) {
  const [queue, setQueue] = useState<Ide[]>([]);
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBagian, setFilterBagian] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    setLoading(true);
    const data = await getReviewQueueService({
      kategori: filterKategori || undefined,
      status: filterStatus || undefined,
      bagian: filterBagian || undefined,
      search: searchText || undefined,
    });
    setQueue(data);
    setLoading(false);
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 8000);
    return () => clearInterval(interval);
  }, [filterKategori, filterStatus, filterBagian, searchText]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Antrean Tinjauan</h1>
          <p className="text-gray-500 text-sm">{queue.length} aspirasi menunggu dinilai. Prioritas: Keselamatan & Kualitas.</p>
        </div>
      </div>

      {/* Filter */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="form-label text-xs">Kategori</label>
            <select className="form-input text-sm" value={filterKategori} onChange={e => setFilterKategori(e.target.value)}>
              <option value="">Semua</option>
              {APP_CONFIG.daftarKategori.map((k: string) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Status</label>
            <select className="form-input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Semua</option>
              <option value="Terkirim">Terkirim</option>
              <option value="Ditinjau">Ditinjau</option>
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Bagian</label>
            <select className="form-input text-sm" value={filterBagian} onChange={e => setFilterBagian(e.target.value)}>
              <option value="">Semua</option>
              {APP_CONFIG.daftarBagian.map((b: string) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Cari</label>
            <input type="text" className="form-input text-sm" placeholder="Judul/Tiket..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">⏳ Memuat antrean...</div>
      ) : queue.length === 0 ? (
        <div className="card text-center py-8 text-gray-400"><span className="text-4xl block mb-2">✅</span><p>Tidak ada aspirasi dalam antrean.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Prioritas</th><th>Tiket</th><th>Kontributor</th><th>Kategori</th><th>Judul</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {queue.map((ide: Ide) => {
                const mendesak = ide.prioritas === 'Mendesak';
                return (
                  <tr key={ide.id} className={mendesak ? 'bg-red-50/50' : ''}>
                    <td><PrioritasBadge prioritas={ide.prioritas} /></td>
                    <td className="font-mono text-xs">{ide.tiket}</td>
                    <td className="text-xs font-semibold text-gray-600">Kontributor — {ide.bagian}</td>
                    <td className="text-xs">{ide.kategori}</td>
                    <td className="text-sm font-medium max-w-xs truncate">{ide.judul}</td>
                    <td className="text-xs">{new Date(ide.tanggalKirim).toLocaleDateString('id-ID')}</td>
                    <td><StatusBadge status={ide.status} /></td>
                    <td><button onClick={() => onViewDetail(ide.tiket)} className="text-xs bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800">Tinjau →</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 2. ANTREAN KEPUTUSAN (admin)
// ============================================================
function DecisionQueue({ onViewDetail }: { onViewDetail: (tiket: string) => void }) {
  const [queue, setQueue] = useState<Ide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setQueue(await getDecisionQueueService());
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">⚖️ Antrean Keputusan</h1>
        <p className="text-gray-500 text-sm">{queue.length} aspirasi diteruskan oleh tim dan menunggu keputusan.</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">⏳ Memuat antrean...</div>
      ) : queue.length === 0 ? (
        <div className="card text-center py-8 text-gray-400"><span className="text-4xl block mb-2">✅</span><p>Tidak ada aspirasi yang menunggu keputusan.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Prioritas</th><th>Tiket</th><th>Kategori</th><th>Judul</th><th>Rekomendasi Tinjauan</th><th>Batas Keputusan</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {queue.map((ide: Ide) => {
                const mendesak = ide.prioritas === 'Mendesak';
                const sla = getIdeaSlaStatus(ide).decision;
                return (
                  <tr key={ide.id} className={mendesak ? 'bg-red-50/50' : ''}>
                    <td><PrioritasBadge prioritas={ide.prioritas} /></td>
                    <td className="font-mono text-xs">{ide.tiket}</td>
                    <td className="text-xs">{ide.kategori}</td>
                    <td className="text-sm font-medium max-w-xs truncate">{ide.judul}</td>
                    <td className="text-xs capitalize">{ide.rekomendasi}</td>
                    <td className="text-xs">{sla === 'Normal' ? '✅ Normal' : sla === 'Mendekati SLA' ? '⚠️ Mendekati batas' : '🔴 Terlambat'}</td>
                    <td><button onClick={() => onViewDetail(ide.tiket)} className="text-xs bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800">Putuskan →</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 3. SEMUA ASPIRASI (admin): pelacakan semua status
// ============================================================
// Antrean tinjauan hanya memuat ide baru, antrean keputusan hanya ide yang menunggu keputusan. 
// Halaman memuat SEMUA status, sehingga ide yang sedang diimplementasikan, antre/riset bisa ditemukan.
function SemuaAspirasi({ onViewDetail }: { onViewDetail: (tiket: string) => void }) {
  const [daftar, setDaftar] = useState<Ide[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterBagian, setFilterBagian] = useState('');
  const [filterPrioritas, setFilterPrioritas] = useState('');
  const [hanyaTerlambat, setHanyaTerlambat] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  // Hitungan per status untuk kotak ringkasan (tanpa filter, supaya angka stabil)
  const [hitungan, setHitungan] = useState<Record<string, number>>({});
  const [jumlahTerlambat, setJumlahTerlambat] = useState(0);

  const handleExport = async () => {
    const csv = await exportIdeCsvService();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaizenbox-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const muat = async () => {
    const [terfilter, semua] = await Promise.all([
      getAllAspirasiService({
        status: filterStatus || undefined,
        kategori: filterKategori || undefined,
        bagian: filterBagian || undefined,
        prioritas: filterPrioritas || undefined,
        hanyaTerlambat: hanyaTerlambat || undefined,
        search: searchText || undefined,
      }),
      getAllAspirasiService(),
    ]);
    const h: Record<string, number> = {};
    semua.forEach(i => { h[i.status] = (h[i.status] || 0) + 1; });
    setHitungan(h);
    setJumlahTerlambat(semua.filter(isTerlambat).length);
    setDaftar(terfilter);
    setLoading(false);
  };

  useEffect(() => {
    muat();
    const interval = setInterval(muat, 8000);
    return () => clearInterval(interval);
  }, [filterStatus, filterKategori, filterBagian, filterPrioritas, hanyaTerlambat, searchText]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🗂️ Semua Aspirasi</h1>
          <p className="text-gray-500 text-sm">Pelacakan seluruh aspirasi dari semua status.</p>
        </div>
        {APP_CONFIG.features.enableExportCsv && (
          <button
            type="button"
            onClick={handleExport}
            className="text-sm text-gray-600 hover:text-green-800 underline underline-offset-2 whitespace-nowrap"
          >
            Unduh CSV
          </button>
        )}
      </div>

      {/* Ringkasan per status: klik untuk memfilter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {APP_CONFIG.daftarStatus.map((st: string) => (
          <button
            key={st}
            onClick={() => setFilterStatus(filterStatus === st ? '' : st)}
            className={`card text-center ${filterStatus === st ? 'ring-2 ring-green-600' : ''}`}
          >
            <p className="text-2xl font-bold text-gray-700">{hitungan[st] || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{st}</p>
          </button>
        ))}
        <button
          onClick={() => setHanyaTerlambat(!hanyaTerlambat)}
          className={`card text-center ${hanyaTerlambat ? 'ring-2 ring-red-500' : ''}`}
        >
          <p className="text-2xl font-bold text-red-600">{jumlahTerlambat}</p>
          <p className="text-xs text-gray-500 mt-1">🔴 Lewat tenggat</p>
        </button>
      </div>

      {/* Filter */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="form-label text-xs">Status</label>
            <select className="form-input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Semua</option>
              {APP_CONFIG.daftarStatus.map((st: string) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Kategori</label>
            <select className="form-input text-sm" value={filterKategori} onChange={e => setFilterKategori(e.target.value)}>
              <option value="">Semua</option>
              {APP_CONFIG.daftarKategori.map((k: string) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Bagian</label>
            <select className="form-input text-sm" value={filterBagian} onChange={e => setFilterBagian(e.target.value)}>
              <option value="">Semua</option>
              {APP_CONFIG.daftarBagian.map((b: string) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Prioritas</label>
            <select className="form-input text-sm" value={filterPrioritas} onChange={e => setFilterPrioritas(e.target.value)}>
              <option value="">Semua</option>
              {APP_CONFIG.daftarPrioritas.map((p: string) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Cari</label>
            <input type="text" className="form-input text-sm" placeholder="Judul/Tiket..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">⏳ Memuat aspirasi...</div>
      ) : daftar.length === 0 ? (
        <div className="card text-center py-8 text-gray-400"><span className="text-4xl block mb-2">📭</span><p>Tidak ada aspirasi yang cocok.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <p className="text-xs text-gray-500 mb-2">{daftar.length} aspirasi ditampilkan</p>
          <table className="data-table">
            <thead>
              <tr><th>Prioritas</th><th>Tiket</th><th>Kategori</th><th>Judul</th><th>Asal</th><th>Tanggal</th><th>Status</th><th>PIC / Tenggat</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {daftar.map((ide: Ide) => (
                <tr key={ide.id}>
                  <td><PrioritasBadge prioritas={ide.prioritas} /></td>
                  <td className="font-mono text-xs">{ide.tiket}</td>
                  <td className="text-xs">{ide.kategori}</td>
                  <td className="text-sm font-medium max-w-xs truncate">{ide.judul}</td>
                  <td className="text-xs">{ide.bagian}</td>
                  <td className="text-xs">{new Date(ide.tanggalKirim).toLocaleDateString('id-ID')}</td>
                  <td><StatusBadge status={ide.status} /></td>
                  <td className="text-xs">
                    {ide.picNama || ide.tenggat ? (
                      <>
                        <div>{ide.picNama || 'PIC belum ditunjuk'}</div>
                        <div className="text-gray-500">{ide.tenggat ? new Date(ide.tenggat).toLocaleDateString('id-ID') : '-'}</div>
                        <TenggatBadge level={getTenggatLevel(ide)} />
                      </>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td><button onClick={() => onViewDetail(ide.tiket)} className="text-xs bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800">Buka →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
