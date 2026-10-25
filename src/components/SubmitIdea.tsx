// KAIZENBOX - Form Kirim Ide (3 Langkah)
// ============================================================

import { useState } from 'react';
import { APP_CONFIG } from '../config/app.config';
import { Pengguna } from '../api/apiClient';
import { submitIdeaService } from '../services/businessServices';

export default function SubmitIdea({ user, onSuccess }: { user: Pengguna; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [successTiket, setSuccessTiket] = useState('');
  const [loading, setLoading] = useState(false);

  const [kategori, setKategori] = useState('');
  const [judul, setJudul] = useState('');
  const [masalah, setMasalah] = useState('');
  const [solusi, setSolusi] = useState('');
  const [lokasiAkurat, setLokasiAkurat] = useState('');
  const [diLuarArea, setDiLuarArea] = useState(false);
  const [fotoData, setFotoData] = useState('');

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > APP_CONFIG.business.maxFotoSize) {
      setError(`Ukuran foto maksimal ${APP_CONFIG.business.maxFotoSize / 1024}KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setFotoData(reader.result as string); setError(''); };
    reader.readAsDataURL(file);
  };

  const validateStep = (s: number): boolean => {
    setError('');
    if (s === 1) {
      if (!kategori) { setError('Pilih kategori aspirasi.'); return false; }
      if (!judul.trim() || judul.trim().length < 5) { setError('Judul minimal 5 karakter.'); return false; }
      return true;
    }
    if (s === 2) {
      if (!masalah.trim()) { setError('Deskripsi masalah wajib diisi.'); return false; }
      if (!lokasiAkurat.trim()) { setError('Lokasi akurat wajib diisi.'); return false; }
      return true;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) { setStep(2); return; }
    setLoading(true);
    setError('');

    const result = await submitIdeaService(user, {
      kategori, judul, masalah, solusi, lokasiAkurat,
      diLuarAreaProduksi: diLuarArea, fotoData,
    });

    setLoading(false);
    if (result.success && result.tiket) {
      setSuccessTiket(result.tiket);
    } else {
      setError(result.message);
    }
  };

  if (successTiket) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-800 mb-2">Aspirasi Berhasil Dikirim!</h2>
        <p className="text-gray-600 mb-6">Terima kasih atas kontribusi kaizen-mu.</p>
        <div className="card inline-block px-8 py-6 mb-6">
          <p className="text-sm text-gray-500 mb-1">Nomor Tiket:</p>
          <p className="text-3xl font-bold font-mono text-green-700">{successTiket}</p>
        </div>
        <div className="banner banner-info max-w-md mx-auto">
          <p className="text-sm">🔒 <strong>Simpan nomor tiket ini</strong> untuk melacak status. Nama dan ID akun tidak tampil pada tiket, tim peninjau tetap dapat melihat token dan detail laporan.</p>
        </div>
        <div className="mt-6 space-y-1">
          <p className="text-xs text-gray-500">📅 Respon ≤ {APP_CONFIG.business.slaResponHari} hari kerja</p>
          <p className="text-xs text-gray-500">🎯penanggung jawab dan target selesai akan ditentukan</p>
        </div>
        <button onClick={onSuccess} className="btn-primary mt-8 px-8">← Kembali ke Beranda</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">💡 Sampaikan Aspirasi</h1>
      <p className="text-gray-500 text-sm mb-6">Nama dan ID akun tidak tercantum pada tiket. Peninjau dapat melihat token dan detail laporan,.</p>

      {error && <div className="banner banner-error">{error}</div>}

      {/* Stepper */}
      <div className="stepper mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center" style={{ flex: s < 3 ? 1 : 'none' }}>
            <div className={`step-circle ${step > s ? 'done' : step === s ? 'active' : ''}`}>{s}</div>
            {s < 3 && <div className={`step-line ${step > s ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h3 className="font-bold text-gray-700 mb-4">Langkah 1: Kategori & Judul</h3>
          <div className="mb-4">
            <label className="form-label">Kategori Aspirasi *</label>
            <select className="form-input" value={kategori} onChange={e => setKategori(e.target.value)}>
              <option value="">-- Pilih Kategori --</option>
              {APP_CONFIG.daftarKategori.map((k: string) => <option key={k} value={k}>{k}</option>)}
            </select>
            {APP_CONFIG.kategoriMendesak.includes(kategori) && (
              <p className="text-xs text-red-600 mt-1 font-semibold">🔴 Prioritas Tinggi.</p>
            )}
          </div>
          <div className="mb-4">
            <label className="form-label">Judul Aspirasi *</label>
            <input type="text" className="form-input" placeholder="Contoh: Tambah sensor panas di mesin press" value={judul} onChange={e => setJudul(e.target.value)} maxLength={100} />
            <p className="text-xs text-gray-400 mt-1">{judul.length}/100</p>
          </div>
          <div className="flex justify-end">
            <button onClick={() => { if (validateStep(1)) setStep(2); }} className="btn-primary">Lanjut →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3 className="font-bold text-gray-700 mb-4">Langkah 2: Detail Aspirasi</h3>
          <div className="mb-4">
            <label className="form-label">Deskripsi Masalah *</label>
            <textarea className="form-input" rows={3} placeholder="Jelaskan masalah..." value={masalah} onChange={e => setMasalah(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="form-label">Usulan Solusi (opsional)</label>
            <textarea className="form-input" rows={3} placeholder="Jelaskan solusi..." value={solusi} onChange={e => setSolusi(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Belum punya usulan? Cukup jelaskan masalah dan lokasinya.</p>
          </div>
          <div className="mb-4">
            <label className="form-label">Lokasi Akurat *</label>
            <input type="text" className="form-input" placeholder="Contoh: mesin jahit ke-4 area tengah" value={lokasiAkurat} onChange={e => setLokasiAkurat(e.target.value)} />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">← Kembali</button>
            <button onClick={() => { if (validateStep(2)) setStep(3); }} className="btn-primary">Lanjut →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3 className="font-bold text-gray-700 mb-4">Langkah 3: Foto & Kirim</h3>
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={diLuarArea} onChange={e => setDiLuarArea(e.target.checked)} className="w-5 h-5 accent-green-700" />
              <span className="text-sm font-semibold text-gray-700">Aspirasi ini DI LUAR area produksi</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-8">checklist untuk upload (opsional, maks {APP_CONFIG.business.maxFotoSize / 1024}KB).</p>
          </div>
          {diLuarArea && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <label className="form-label">Upload Foto</label>
              <input type="file" accept="image/*" onChange={handleFotoUpload} className="text-sm" />
              {fotoData && <img src={fotoData} alt="Preview" className="max-w-xs max-h-40 rounded border mt-3" />}
            </div>
          )}
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <p className="text-xs font-bold text-gray-600 mb-2">📋 Ringkasan:</p>
            <p className="text-sm"><strong>Kategori:</strong> {kategori}</p>
            <p className="text-sm"><strong>Judul:</strong> {judul}</p>
            <p className="text-sm"><strong>Bagian:</strong> {user.bagian} | <strong>Jabatan:</strong> {user.jabatan}</p>
            <p className="text-xs text-gray-500 mt-2">Nama Anda tidak ditampilkan. Bagian menyertai aspirasi, jabatan digunakan untuk statistik.</p>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-secondary">← Kembali</button>
            <button onClick={handleSubmit} className="btn-primary text-lg px-8" disabled={loading}>
              {loading ? '⏳ Mengirim...' : '🚀 Kirim Aspirasi'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
