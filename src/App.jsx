/**
 * src/App.jsx — RBAC: tab ditampilkan sesuai role user
 */

import { useState, useEffect } from 'react';
import { Ticker, Topbar } from './components/Topbar.jsx';
import Overview from './pages/Overview.jsx';
import { AnomalyPage } from './pages/AnomalyPage.jsx';
import { KecepatanPage, TargetPage, KBLIPage, PetugasPage } from './pages/OtherPages.jsx';
import RespondenPage from './pages/RespondenPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Semua halaman yang tersedia
const ALL_PAGES = {
  Overview:  <Overview />,
  Anomali:   <AnomalyPage />,
  Kecepatan: <KecepatanPage />,
  Target:    <TargetPage />,
  KBLI:      <KBLIPage />,
  Petugas:   <PetugasPage />,
  Responden: <RespondenPage />,
};

function Footer({ role }) {
  const roleLabel = {
    kepala:     'Kepala BPS Paluta',
    kasubbag:   'Kasubbag Umum',
    statistisi: 'Statistisi',
    pengadmin:  'Pengadministrasi',
  };
  return (
    <div style={{
      padding: '14px 24px', borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
        EWS SE2026 · BPS Kabupaten Padang Lawas Utara · Data bersifat rahasia
      </span>
      <span style={{ fontSize: 10, color: 'var(--text4)' }}>
        {roleLabel[role] || role} · Terintegrasi MATA SE26
      </span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg0)', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid var(--bg4)', borderTopColor: 'var(--indigo)',
        animation: 'spin .8s linear infinite',
      }}/>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Memuat EWS SE2026…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, loading, logout, user } = useAuth();
  const [tab, setTab] = useState('Overview');

  // Ambil daftar tab yang boleh diakses dari token user
  // Semua pegawai BPS mendapat akses penuh ke semua tab
  const allowedTabs = ['Overview', 'Anomali', 'Kecepatan', 'Target', 'KBLI', 'Petugas', 'Responden'];

  // Pastikan tab aktif selalu valid (misalnya setelah logout/login ulang dengan role berbeda)
  useEffect(() => {
    if (!allowedTabs.includes(tab)) {
      setTab(allowedTabs[0] || 'Overview');
    }
  }, [allowedTabs, tab]);

  // Auto-logout jika API return 401
  useEffect(() => {
    const handle = () => logout();
    window.addEventListener('ews:unauthorized', handle);
    return () => window.removeEventListener('ews:unauthorized', handle);
  }, [logout]);

  if (loading) return <LoadingScreen/>;
  if (!isAuthenticated) return <LoginPage/>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <Ticker/>
        <Topbar activeTab={tab} setTab={setTab} allowedTabs={allowedTabs}/>
      </div>
      <main style={{ flex: 1, padding: '20px 24px' }} key={tab} className="fade-up">
        {ALL_PAGES[tab] || <Overview/>}
      </main>
      <Footer role={user?.role}/>
    </div>
  );
}