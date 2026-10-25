// ============================================================
// KAIZENBOX - Data Karyawan & Peran (admin)
// ============================================================
// Pengaturan role karyawan / admin
// Token anonim dan password tidak ditampilkan.
// ============================================================

import { useState, useEffect } from 'react';
import { PeranAkses } from '../api/apiClient';
import { getDaftarKaryawanService, aturPeranService } from '../services/businessServices';
import { PERAN_LABEL } from '../services/authService';

type Karyawan = Awaited<ReturnType<typeof getDaftarKaryawanService>>[number];
const PERAN: PeranAkses[] = ['karyawan', 'admin'];

export default function DataKaryawan() {
  const [users, setUsers] = useState<Karyawan[]>([]);
  const [pesan, setPesan] = useState('');
  const [error, setError] = useState('');

  const muat = async () => {
    setUsers(await getDaftarKaryawanService());
  };

  useEffect(() => {
    muat();
  }, []);

  const ubahPeran = async (u: Karyawan, peran: PeranAkses) => {
    setError('');
    setPesan('');

    const res = await aturPeranService(u.idKaryawan, [peran]);
    if (res.success) {
      setPesan(`Peran ${u.idKaryawan} diperbarui.`);
    } else {
      setError(res.message);
    }

    await muat();
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">👥 Data Karyawan & Peran</h1>
      </div>

      {pesan && (
        <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {pesan}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto">
        <h3 className="font-bold text-gray-700 mb-3">🔑 Akun KaizenBox & Peran</h3>
        {users.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">Belum ada data karyawan yang tersedia.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nama</th>
                <th>Bagian</th>
                <th>Jabatan</th>
                <th>Status</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.idKaryawan} className={u.aktif ? '' : 'opacity-50'}>
                  <td className="font-mono text-xs">{u.idKaryawan}</td>
                  <td className="text-sm">{u.namaTampilan}</td>
                  <td className="text-xs">{u.bagian}</td>
                  <td className="text-xs">{u.jabatan}</td>
                  <td className="text-xs">{u.aktif ? 'Aktif' : 'Nonaktif'}</td>
                  <td>
                    <select
                      className="form-input text-xs"
                      value={u.peran.includes('admin') ? 'admin' : 'karyawan'}
                      onChange={e => ubahPeran(u, e.target.value as PeranAkses)}
                    >
                      {PERAN.map(role => (
                        <option key={role} value={role}>
                          {PERAN_LABEL[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
