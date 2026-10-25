// ============================================================
// KAIZENBOX - Detail Aspirasi
// Admin meninjau aspirasi dan membuat putusan,
// lalu tindak lanjut: PIC, tenggat, mulai implementasi, selesai.
// ============================================================

import { useState, useEffect } from 'react';
import { APP_CONFIG } from '../config/app.config';
import type { Ide, Pengguna } from '../api/apiClient';
import {
  getAspirasiDetailService, mulaiTinjauService, tinjauIdeService, putuskanIdeService, selesaikanIdeService, lanjutkanRisetService,
  mulaiImplementasiService, aturPicTenggatService, getDaftarPicService, batalkanIdeService,
  tenggatDefault, todayStr, getTenggatLevel, Keputusan, TindakanTinjau,
} from '../services/businessServices';
import { isAdmin } from '../services/authService';
import { StatusBadge } from './shared/StatusBadge';
import { PrioritasBadge, TenggatBadge } from './shared/PrioritasBadge';

type HasilAksi = { success: boolean; message: string; ide?: Ide };
type CalonPic = { tokenAnonim: string; namaTampilan: string; bagian: string };

// keputusan admin
const OPSI_KEPUTUSAN: { key: Keputusan; label: string; kelas: string }[] = [
  { key: 'implementasi', label: '✅ Implementasi', kelas: 'btn-primary' },
  { key: 'antre', label: '📋 Antre Implementasi', kelas: 'btn-secondary' },
  { key: 'riset', label: '🔬 Riset Lanjut', kelas: 'btn-secondary' },
  { key: 'tolak', label: '❌ Tolak', kelas: 'btn-danger' },
];

const LABEL_KEPUTUSAN: Record<string, string> = Object.fromEntries(
  OPSI_KEPUTUSAN.map(o => [o.key, o.label])
);

// Pilihan tindakan tim saat meninjau
const OPSI_TINDAKAN: { key: TindakanTinjau; label: string; deskripsi: string }[] = [
  { key: 'tangani', label: '✅ Tangani langsung', deskripsi: 'Admin menetapkan PIC dan tenggat untuk mulai dikerjakan.' },
  { key: 'antre', label: '📋 Jadwalkan (antre)', deskripsi: 'Diterima, dikerjakan nanti. PIC dan tenggat bisa menyusul.' },
  { key: 'riset', label: '🔬 Perlu riset lanjut', deskripsi: 'Butuh data atau kajian sebelum dikerjakan.' },
  { key: 'eskalasi', label: '⚖️ Minta persetujuan lanjutan', deskripsi: 'Keputusan perlu persetujuan lanjutan.' },
  { key: 'tolak', label: '❌ Tolak', deskripsi: 'Wajib memilih alasan.' },
];

export default function KaizenDetail({ tiket, user, onBack, backLabel }: {
  tiket: string; user: Pengguna; onBack: () => void; backLabel: string;
}) {
  const [ide, setIde] = useState<Ide | null>(null);
  const [daftarPic, setDaftarPic] = useState<CalonPic[]>([]);
  const [prioritas, setPrioritas] = useState('Normal');
  const [tindakan, setTindakan] = useState<TindakanTinjau>('tangani');
  const [feedback, setFeedback] = useState('');
  const [rekomendasi, setRekomendasi] = useState<Keputusan>('implementasi');
  const [alasanTolak, setAlasanTolak] = useState('');
  const [catatan, setCatatan] = useState('');
  const [catatanHasil, setCatatanHasil] = useState('');
  const [alasanBatal, setAlasanBatal] = useState('');
  const [picToken, setPicToken] = useState('');
  const [tenggat, setTenggat] = useState('');
  const [tenggatDiubah, setTenggatDiubah] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const found = await getAspirasiDetailService(tiket);
      if (found) {
        setIde(found);
        setPrioritas(found.prioritas || 'Normal');
        if (found.feedback) setFeedback(found.feedback);
        if (found.rekomendasi) setRekomendasi(found.rekomendasi as Keputusan);
        if (found.alasanTolak) setAlasanTolak(found.alasanTolak);
        setPicToken(found.picToken || '');
        setTenggat(found.tenggat || tenggatDefault(found.prioritas || 'Normal'));
        setDaftarPic(await getDaftarPicService());
      }
      setLoading(false);
    };
    load();
  }, [tiket]);

  if (loading) return <div className="text-center py-12 text-gray-500">⏳ Memuat detail...</div>;
  if (!ide) {
    return (
      <div className="card">
        <p>Aspirasi tidak ditemukan atau tidak dapat Anda buka.</p>
        <button onClick={onBack} className="btn-secondary mt-4">← Kembali</button>
      </div>
    );
  }

  const jalankan = async (aksi: () => Promise<HasilAksi>) => {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const hasil = await aksi();
      if (hasil.success) {
        setSuccess(`✅ ${hasil.message}`);
        if (hasil.ide) {
          setIde(hasil.ide);
          setPicToken(hasil.ide.picToken || '');
          if (hasil.ide.tenggat) setTenggat(hasil.ide.tenggat);
        }
      } else {
        setError(hasil.message);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal memproses perubahan. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const ubahPrioritas = (p: string) => {
    setPrioritas(p);
    // Selama tenggat belum diubah manual, ikuti saran tenggat dari prioritas
    if (!tenggatDiubah) setTenggat(tenggatDefault(p));
  };

  const admin = isAdmin(user);
  const modeMulaiTinjau = ide.status === 'Terkirim' && admin;
  const modeTinjau = ide.status === 'Ditinjau' && admin;
  const modeKeputusan = ide.status === 'Menunggu Keputusan' && admin;
  const modeMulai = ide.status === 'Antre Implementasi' && admin;
  const modeRiset = ide.status === 'Riset Lanjut' && admin;
  const modeImplementasi = ide.status === 'Implementasi' && admin;
  const modeBatal = (ide.status === 'Antre Implementasi' || ide.status === 'Implementasi') && admin;
  const minHasil = APP_CONFIG.business.minimumCatatanHasil;
  const sudahDitinjau = !!ide.reviewerToken;
  const dieskalasi = ide.status === 'Menunggu Keputusan' || !!ide.pemutusToken;

  const selectAlasan = (
    <select className="form-input" value={alasanTolak} onChange={e => setAlasanTolak(e.target.value)}>
      <option value="">-- Pilih Alasan --</option>
      {APP_CONFIG.daftarAlasanTolak.map((a: string) => <option key={a} value={a}>{a}</option>)}
    </select>
  );

  // Input PIC + tenggat (dipakai di beberapa kartu; tidak pernah tampil bersamaan)
  const formPic = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
      <div>
        <label className="form-label text-xs">Penanggung jawab (PIC)</label>
        <select className="form-input" value={picToken} onChange={e => setPicToken(e.target.value)}>
          <option value="">-- Pilih PIC --</option>
          {daftarPic.filter(p => p.tokenAnonim !== ide.tokenAnonim).map(p => (
            <option key={p.tokenAnonim} value={p.tokenAnonim}>{p.namaTampilan} ({p.bagian})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label text-xs">Target selesai (tenggat)</label>
        <input
          type="date" className="form-input" min={todayStr()} value={tenggat}
          onChange={e => { setTenggat(e.target.value); setTenggatDiubah(true); }}
        />
      </div>
    </div>
  );

  const kirimTinjau = () => jalankan(() => tinjauIdeService(tiket, {
    prioritas,
    tindakan,
    feedback,
    alasanTolak,
    rekomendasi: tindakan === 'eskalasi' ? rekomendasi : undefined,
    // PIC/tenggat: wajib "tangani"; "antre" hanya dikirim jika PIC dipilih
    picToken: tindakan === 'tangani' || (tindakan === 'antre' && picToken) ? picToken : undefined,
    tenggat: tindakan === 'tangani' || (tindakan === 'antre' && picToken) ? tenggat : undefined,
  }));

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={onBack} className="btn-secondary mb-4 text-sm">← {backLabel}</button>
      {error && <div className="banner banner-error">{error}</div>}
      {success && <div className="banner banner-success">{success}</div>}

      {/* Info Aspirasi */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500">Tiket</p>
            <p className="text-lg font-bold font-mono text-green-700">{ide.tiket}</p>
          </div>
          <div className="flex items-center gap-2">
            <PrioritasBadge prioritas={ide.prioritas} />
            <StatusBadge status={ide.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
          <div><span className="text-gray-500">Kategori:</span><br /><strong>{ide.kategori}</strong></div>
          <div><span className="text-gray-500">Bagian:</span><br /><strong>{ide.bagian}</strong></div>
        </div>
        <h4 className="font-bold text-gray-800 mb-2">{ide.judul}</h4>
        <div className="space-y-2 text-sm">
          <div><p className="text-gray-500 font-semibold">Masalah:</p><p className="bg-gray-50 p-2 rounded">{ide.masalah}</p></div>
          <div><p className="text-gray-500 font-semibold">Solusi:</p><p className="bg-gray-50 p-2 rounded">{ide.solusi}</p></div>
          <div><p className="text-gray-500 font-semibold">Lokasi:</p><p className="bg-gray-50 p-2 rounded">{ide.lokasiAkurat}</p></div>
          {ide.diLuarAreaProduksi && ide.fotoData && (
            <div><p className="text-gray-500 font-semibold">Foto:</p><img src={ide.fotoData} alt="Dokumentasi" className="max-w-sm rounded border mt-1" /></div>
          )}
        </div>
      </div>

      {/* PIC & tenggat yang berlaku */}
      {(ide.picNama || ide.tenggat) && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">🎯 Penanganan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Penanggung jawab:</span> <strong>{ide.picNama || 'Belum ditunjuk'}</strong></div>
            <div>
              <span className="text-gray-500">Target selesai:</span>{' '}
              <strong>{ide.tenggat ? new Date(ide.tenggat).toLocaleDateString('id-ID') : 'Belum ditetapkan'}</strong>{' '}
              <TenggatBadge level={getTenggatLevel(ide)} />
            </div>
          </div>
        </div>
      )}

      {/* Admin memulai tinjau; status berubah setelah tombol ditekan. */}
      {modeMulaiTinjau && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">👀 Aspirasi Baru</h3>
          <p className="text-xs text-gray-500 mb-3">
            Membaca detail tidak mengubah status. Tekan tombol saat mulai meninjau;
            status berubah menjadi "Ditinjau" dan jam respon berhenti.
          </p>
          <button onClick={() => jalankan(() => mulaiTinjauService(tiket))} className="btn-primary" disabled={saving}>▶️ Mulai Tinjau</button>
        </div>
      )}

      {ide.status === 'Terkirim' && !admin && (
        <div className="banner banner-info">⏳ Aspirasi ini belum ditinjau.</div>
      )}

      {/* Admin meninjau dan memilih tindakan. */}
      {modeTinjau && (
        <>
          <div className="card mb-4">
            <h3 className="font-bold text-gray-700 mb-2">🚦 Prioritas</h3>
            <select className="form-input" value={prioritas} onChange={e => ubahPrioritas(e.target.value)}>
              {APP_CONFIG.daftarPrioritas.map((p: string) => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Kategori keselamatan otomatis "Mendesak"; Anda bisa mengubahnya.</p>
          </div>

          <div className="card mb-4">
            <h3 className="font-bold text-gray-700 mb-2">💬 Tanggapan untuk pengirim </h3>
            <textarea className="form-input" rows={3} placeholder="Tulis tanggapan ..." value={feedback} onChange={e => setFeedback(e.target.value)} />
            <p className={`text-xs mt-1 ${feedback.trim().length >= APP_CONFIG.business.minimumFeedback ? 'text-green-600' : 'text-red-500'}`}>{feedback.trim().length}/{APP_CONFIG.business.minimumFeedback} karakter</p>
          </div>

          <div className="card mb-4">
            <h3 className="font-bold text-gray-700 mb-3">🧭 Tindakan</h3>
            <div className="space-y-2 mb-4">
              {OPSI_TINDAKAN.map(o => (
                <label key={o.key} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="tindakan" className="mt-1" checked={tindakan === o.key} onChange={() => setTindakan(o.key)} />
                  <span><strong className="text-sm">{o.label}</strong><br /><span className="text-xs text-gray-500">{o.deskripsi}</span></span>
                </label>
              ))}
            </div>

            {(tindakan === 'tangani' || tindakan === 'antre') && formPic}
            {tindakan === 'eskalasi' && (
              <div className="mb-3">
                <label className="form-label text-xs">Rekomendasi keputusan lanjutan</label>
                <select className="form-input" value={rekomendasi} onChange={e => setRekomendasi(e.target.value as Keputusan)}>
                  {OPSI_KEPUTUSAN.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
            )}
            {(tindakan === 'tolak' || (tindakan === 'eskalasi' && rekomendasi === 'tolak')) && (
              <div className="mb-3"><label className="form-label text-xs">Alasan Penolakan</label>{selectAlasan}</div>
            )}
            <button onClick={kirimTinjau} className="btn-primary" disabled={saving}>💾 Simpan Tinjauan</button>
          </div>
        </>
      )}

      {/* Hasil tinjauan admin (read-only) */}
      {!modeTinjau && sudahDitinjau && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-3">🗒️ Hasil Tinjauan Admin</h3>
          {dieskalasi && ide.rekomendasi && (
            <p className="text-sm mb-2"><span className="text-gray-500">Rekomendasi tinjauan:</span> <strong>{LABEL_KEPUTUSAN[ide.rekomendasi] ?? ide.rekomendasi}</strong>{ide.rekomendasi === 'tolak' && ide.alasanTolak ? ` (${ide.alasanTolak})` : ''}</p>
          )}
          {ide.feedback && <p className="text-sm bg-gray-50 p-2 rounded"><span className="text-gray-500 font-semibold">Tanggapan admin:</span><br />{ide.feedback}</p>}
        </div>
      )}

      {ide.status === 'Menunggu Keputusan' && !admin && (
        <div className="banner banner-info">⏳ Aspirasi sudah ditinjau dan menunggu keputusan.</div>
      )}

      {/* Admin: keputusan lanjutan */}
      {modeKeputusan && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">⚡ Keputusan Admin</h3>
          <p className="text-xs text-gray-500 mb-4">
            Jika di Implementasi, PIC dan tenggat wajib terisi.
          </p>
          {formPic}
          <div className="mb-3">
            <label className="form-label text-xs">Alasan Penolakan (jika tolak)</label>
            {selectAlasan}
          </div>
          <div className="mb-4">
            <label className="form-label text-xs">Catatan admin (opsional, masuk riwayat)</label>
            <textarea className="form-input" rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-3">
            {OPSI_KEPUTUSAN.map(o => (
              <button
                key={o.key}
                onClick={() => jalankan(() => putuskanIdeService(
                  tiket, o.key, alasanTolak, catatan,
                  o.key === 'implementasi' ? { picToken, tenggat } : undefined
                ))}
                className={`${o.kelas} ${ide.rekomendasi === o.key ? 'ring-2 ring-offset-1 ring-green-500' : ''}`}
                disabled={saving}
                title={ide.rekomendasi === o.key ? 'Sesuai rekomendasi tinjauan' : undefined}
              >{o.label}{ide.rekomendasi === o.key ? ' ★' : ''}</button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">★ = rekomendasi tinjauan</p>
        </div>
      )}

      {/* Antre: mulai implementasi oleh admin */}
      {modeMulai && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">📋 Antre Implementasi</h3>
          <p className="text-xs text-gray-500 mb-3">Jika jadwal sudah tiba, tunjuk PIC dan tenggat lalu mulai. Status berubah menjadi "Implementasi".</p>
          {formPic}
          <label className="form-label text-xs">Catatan (opsional, masuk riwayat)</label>
          <textarea className="form-input mb-3" rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} />
          <button
            onClick={() => jalankan(() => mulaiImplementasiService(tiket, picToken, tenggat, catatan))}
            className="btn-primary" disabled={saving}
          >✅ Mulai Implementasi</button>
        </div>
      )}

      {/* Riset selesai: keputusan lanjutan oleh admin */}
      {modeRiset && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">🔬 Riset Lanjut</h3>
          <p className="text-xs text-gray-500 mb-3">Jika riset selesai, aspirasi masuk ke antrean keputusan admin.</p>
          <label className="form-label text-xs">Catatan hasil riset (opsional, masuk riwayat)</label>
          <textarea className="form-input mb-3" rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} />
          <button
            onClick={() => jalankan(() => lanjutkanRisetService(tiket, catatan))}
            className="btn-primary" disabled={saving}
          >📨 Ajukan Keputusan Admin</button>
        </div>
      )}

      {/* Implementasi berjalan: ubah PIC/tenggat atau tandai selesai */}
      {modeImplementasi && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">🏁 Implementasi</h3>
          <p className="text-xs text-gray-500 mb-3">Ganti penanggung jawab / tenggat waktu. Selesai, tulis proses yang dikerjakan; catatan dibaca pengirim.</p>
          {formPic}
          <button
            onClick={() => jalankan(() => aturPicTenggatService(tiket, picToken, tenggat))}
            className="btn-secondary mb-4" disabled={saving}

          >💾 Perbarui PIC & Tenggat</button>
          <label className="form-label text-xs">Catatan hasil(tandai selesai, min {minHasil} karakter)</label>
          <textarea
            className="form-input" rows={3} placeholder="Contoh: Kompresor AC diganti, suhu ruangan sudah normal."
            value={catatanHasil} onChange={e => setCatatanHasil(e.target.value)}
          />
          <p className={`text-xs mt-1 mb-3 ${catatanHasil.trim().length >= minHasil ? 'text-green-600' : 'text-red-500'}`}>{catatanHasil.trim().length}/{minHasil} karakter</p>
          <button onClick={() => jalankan(() => selesaikanIdeService(tiket, catatanHasil))} className="btn-primary" disabled={saving}>🏁 Tandai Selesai</button>
        </div>
      )}

      {/* Batalkan: rencana berubah (antre atau sedang dikerjakan) */}
      {modeBatal && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">🚫 Batalkan Aspirasi</h3>
          <p className="text-xs text-gray-500 mb-3">Gunakan jika rencana berubah dan aspirasi tidak jadi dikerjakan. Alasan dibaca pengirim dan tidak bisa dibatalkan.</p>
          <textarea
            className="form-input" rows={2} placeholder="Jelaskan kenapa dibatalkan..."
            value={alasanBatal} onChange={e => setAlasanBatal(e.target.value)}
          />
          <p className={`text-xs mt-1 mb-3 ${alasanBatal.trim().length >= minHasil ? 'text-green-600' : 'text-red-500'}`}>{alasanBatal.trim().length}/{minHasil} karakter</p>
          <button onClick={() => jalankan(() => batalkanIdeService(tiket, alasanBatal))} className="btn-danger" disabled={saving}>Batalkan Aspirasi</button>
        </div>
      )}

      {/* Hasil akhir */}
      {ide.catatanHasil && (ide.status === 'Selesai' || ide.status === 'Dibatalkan') && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-700 mb-2">{ide.status === 'Selesai' ? '🏁 Hasil Tindak Lanjut' : '🚫 Alasan Pembatalan'}</h3>
          <p className="text-sm bg-gray-50 p-2 rounded">{ide.catatanHasil}</p>
        </div>
      )}

      {/* Riwayat */}
      <div className="card">
        <h3 className="font-bold text-gray-700 mb-3">📅 Riwayat Status</h3>
        <div className="ml-2">
          {ide.riwayatStatus.map((r, idx) => (
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
    </div>
  );
}
