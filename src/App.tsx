// KAIZENBOX 
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { APP_CONFIG } from './config/app.config';
import { Pengguna, PeranAkses } from './api/apiClient';
import { logoutService, getCurrentUserService, getDaftarKaryawanService, getStatisticsService } from './services/businessServices';
import { validateLogin, canAccessPage, getDefaultPage, labelPeran, isAdmin } from './services/authService';
import EmployeeDashboard from './components/EmployeeDashboard';
import SubmitIdea from './components/SubmitIdea';
import TrackTicket from './components/TrackTicket';
import KaizenPages from './components/KaizenPages';
import DataKaryawan from './components/DataKaryawan';

// Export type untuk dipakai komponen lain
export type PageKey = 'dashboard' | 'submit' | 'track' | 'kaizen-queue' | 'kaizen-decision' | 'kaizen-semua' | 'kaizen-detail' | 'kaizen-stats';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<Pengguna | null>(null);
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [selectedTiket, setSelectedTiket] = useState<string>('');
  const [asalDetail, setAsalDetail] = useState<PageKey>('kaizen-queue');  // halaman asal, untuk tombol kembali di detail
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Cek sesi login saat pertama kali
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await getCurrentUserService();
        if (user) {
          setIsLoggedIn(true);
          setCurrentUser(user);
          setCurrentPage(getDefaultPage() as PageKey);
        }
      } catch (err) {
        console.error('Gagal cek sesi:', err);
      } finally {
        setInitializing(false);
      }
    };
    checkSession();
  }, []);

  const handleLogin = useCallback(async (idKaryawan: string, password: string): Promise<{ success: boolean; message: string }> => {
    const result = await validateLogin(idKaryawan, password);
    if (result.success && result.pengguna) {
      setIsLoggedIn(true);
      setCurrentUser(result.pengguna);
      setCurrentPage(getDefaultPage() as PageKey);
      return { success: true, message: result.message };
    }
    return { success: false, message: result.message };
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutService();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('dashboard');
  }, []);

  const handleViewDetail = useCallback((tiket: string) => {
    setSelectedTiket(tiket);
    setAsalDetail(currentPage === 'kaizen-decision' || currentPage === 'kaizen-semua' ? currentPage : 'kaizen-queue');
    setCurrentPage('kaizen-detail');
  }, [currentPage]);

  // Loading screen
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">💡</div>
          <p className="text-green-700 font-semibold">Memuat {APP_CONFIG.appName}...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        peran={currentUser!.peran}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userName={currentUser!.namaTampilan}    
        onLogout={handleLogout}
      />

      <main className="flex-1 p-4 md:p-6 overflow-auto" style={{ maxHeight: '100vh' }}>
        {/* Route Protection: Check if user can access current page */}
        {!canAccessPage(currentUser!, currentPage) ? (
          <AccessDenied
            user={currentUser!}
            requestedPage={currentPage}
            onGoHome={() => setCurrentPage(getDefaultPage() as PageKey)}
          />
        ) : (
          <>
            {/* Dashboard sesuai role */}
            {currentPage === 'dashboard' && (
              isAdmin(currentUser!) ? <AdminDashboard user={currentUser!} onNavigate={setCurrentPage} /> :
              <EmployeeDashboard user={currentUser!} onNavigate={setCurrentPage} />
            )}
            {currentPage === 'submit' && <SubmitIdea user={currentUser!} onSuccess={() => setCurrentPage('dashboard')} />}
            {currentPage === 'track' && <TrackTicket user={currentUser!} />}

            {/* Halaman pengelolaan aspirasi dan data admin */}
            {currentPage.startsWith('kaizen-') && (
              <KaizenPages
                currentPage={currentPage}
                selectedTiket={selectedTiket}
                user={currentUser!}
                asalDetail={asalDetail}
                onNavigate={setCurrentPage}
                onViewDetail={handleViewDetail}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// KOMPONEN: Halaman Login
// ============================================================
function LoginPage({ onLogin }: { onLogin: (id: string, pw: string) => Promise<{ success: boolean; message: string }> }) {
  const [idKaryawan, setIdKaryawan] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await onLogin(idKaryawan.trim(), password);
      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #43a047 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur mb-4 shadow-lg">
            <span className="text-4xl">💡</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{APP_CONFIG.appName}</h1>
          <p className="text-green-100 mt-1">{APP_CONFIG.companyName}</p>
        </div>
        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Masuk</h2>
          {error && <div className="banner banner-error mb-4">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="form-label">ID Karyawan</label>
              <input
                type="text"
                className="form-input"
                placeholder="Masukkan ID karyawan"
                value={idKaryawan}
                onChange={e => setIdKaryawan(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="mb-6">
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input pr-11"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
                      <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.58 10.58A2 2 0 0013.42 13.42" strokeLinecap="round" />
                      <path d="M9.88 5.08A10.94 10.94 0 0112 5c4.03 0 7.55 2.22 9 7-1.12 2.97-3.16 5.09-5.7 6.24M14.12 18.92A10.94 10.94 0 0112 19c-4.03 0-7.55-2.22-9-7 1.12-2.97 3.16-5.09 5.7-6.24" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full text-center py-3" disabled={loading}>
              {loading ? '⏳ Memproses...' : '🔐 Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
// KOMPONEN: Sidebar
// ============================================================
function Sidebar({
  peran, currentPage, onNavigate, collapsed, onToggle, userName, onLogout
}: {
  peran: PeranAkses[];
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  collapsed: boolean;
  onToggle: () => void;
  userName: string;
  onLogout: () => void;
}) {
  type MenuItem = { key: PageKey; icon: string; label: string };
  const statistik: MenuItem = { key: 'kaizen-stats', icon: '📊', label: 'Statistik' };

  const user = { peran };
  const dashboardItems: MenuItem[] = [
    { key: 'dashboard', icon: isAdmin(user) ? '🛠️' : '🏠', label: isAdmin(user) ? 'Dashboard Admin' : 'Beranda' },
  ];
  if (!isAdmin(user)) {
    dashboardItems.push(
      { key: 'submit', icon: '💡', label: 'Sampaikan Aspirasi' },
      { key: 'track', icon: '🔍', label: 'Lacak Tiket' },
    );
  }
  const sections: { judul: string; items: MenuItem[] }[] = [
    {
      judul: 'Dashboard',
      items: dashboardItems,
    },
  ];
  if (isAdmin(user)) sections.push({
    judul: 'Admin',
    items: [
      { key: 'kaizen-queue', icon: '🗂️', label: 'Aspirasi' },
      statistik,
    ],
  });
  // Hindari menu ganda jika item ditambahkan ke lebih dari satu bagian.
  const terlihat = new Set<PageKey>();
  const menu = sections
    .map(sec => ({ ...sec, items: sec.items.filter(i => !terlihat.has(i.key) && terlihat.add(i.key)) }))
    .filter(sec => sec.items.length > 0);
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} flex flex-col`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">💡 {APP_CONFIG.appName}</h2>
              <p className="text-xs text-green-300 mt-1">
                {labelPeran(user)}
              </p>
            </div>
          )}
          <button onClick={onToggle} className="text-white/70 hover:text-white p-1 text-lg">
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </div>
      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-white/10">
          <p className="text-sm font-semibold truncate">{userName}</p>
        </div>
      )}
      {/* Menu */}
      <nav className="flex-1 py-4">
        {menu.map(sec => (
          <div key={sec.judul}>
            {!collapsed && menu.length > 1 && (
              <p className="text-xs uppercase tracking-wide text-green-400/70 px-4 pt-3 pb-1">{sec.judul}</p>
            )}
            {sec.items.map(item => (
              <div
                key={item.key}
                className={`sidebar-item ${
                  currentPage === item.key
                    || (item.key === 'kaizen-queue' && ['kaizen-decision', 'kaizen-semua'].includes(currentPage))
                    ? 'active'
                    : ''
                }`}
                onClick={() => onNavigate(item.key)}
              >
                <span className="text-lg mr-3">{item.icon}</span>
                {!collapsed && <span className="sidebar-text">{item.label}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>
      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="sidebar-item text-red-300 hover:text-red-200" onClick={onLogout}>
          <span className="text-lg mr-3">🚪</span>
          {!collapsed && <span className="sidebar-text">Keluar</span>}
        </div>
      </div>
    </aside>
  );
}
// KOMPONEN: Access Denied
// ============================================================
function AdminDashboard({ user, onNavigate }: { user: Pengguna; onNavigate: (page: PageKey) => void }) {
  const [summary, setSummary] = useState({ activeEmployees: 0, totalIdeas: 0, completedIdeas: 0 });

  useEffect(() => {
    let active = true;
    Promise.all([getDaftarKaryawanService(), getStatisticsService()])
      .then(([employees, statistics]) => {
        if (!active) return;
        setSummary({
          activeEmployees: employees.filter(employee => employee.aktif).length,
          totalIdeas: statistics.totalIde,
          completedIdeas: statistics.selesaiCount,
        });
      })
      .catch(error => console.error('Gagal memuat ringkasan admin:', error));
    return () => { active = false; };
  }, []);

  const cards = [
    { label: 'Karyawan Aktif', value: summary.activeEmployees, tone: 'bg-emerald-100 text-emerald-700' },
    { label: 'Total Aspirasi', value: summary.totalIdeas, tone: 'bg-amber-100 text-amber-700' },
    { label: 'Aspirasi Selesai', value: summary.completedIdeas, tone: 'bg-blue-100 text-blue-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Selamat datang, {user.namaTampilan}</p>
        <h1 className="text-3xl font-bold text-gray-800">Dashboard Admin</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`rounded-xl p-4 ${card.tone}`}>
            <p className="text-sm font-medium">{card.label}</p>
            <p className="text-3xl font-bold mt-2">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Aksi cepat</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => onNavigate('kaizen-queue')}>Kelola Aspirasi</button>
        </div>
      </div>
      <DataKaryawan />
    </div>
  );
}

function AccessDenied({ user, requestedPage, onGoHome }: {
  user: Pengguna;
  requestedPage: string;
  onGoHome: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-red-700 mb-2">Akses Ditolak</h2>
        <p className="text-gray-600 mb-4">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-red-800">
            <strong>Peran Anda:</strong> {labelPeran(user)}<br />
            <strong>Halaman diminta:</strong> {requestedPage}
          </p>
        </div>
        <button onClick={onGoHome} className="btn-primary px-6">
          ← Kembali ke Beranda
        </button>
      </div>
    </div>
  );
}
