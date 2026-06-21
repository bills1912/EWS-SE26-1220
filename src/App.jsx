import { useState } from 'react';
import { Ticker, Topbar } from './components/Topbar.jsx';
import Overview from './pages/Overview.jsx';
import { AnomalyPage } from './pages/AnomalyPage.jsx';
import { KecepatanPage, TargetPage, KBLIPage, PetugasPage } from './pages/OtherPages.jsx';
import RespondenPage from './pages/RespondenPage.jsx';

function Footer() {
  return (
    <div style={{
      padding:'14px 24px', borderTop:'1px solid var(--border)',
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <span style={{ fontSize:10, color:'var(--text4)' }}>
        EWS SE2026 · BPS Kabupaten Padang Lawas Utara · Prototype v0.2 · Data dummy
      </span>
      <span style={{ fontSize:10, color:'var(--text4)' }}>
        Terintegrasi MATA SE26
      </span>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('Overview');

  const pages = {
    Overview:  <Overview />,
    Anomali:   <AnomalyPage />,
    Kecepatan: <KecepatanPage />,
    Target:    <TargetPage />,
    KBLI:      <KBLIPage />,
    Petugas:   <PetugasPage />,
    Responden: <RespondenPage />,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Ticker />
      <Topbar activeTab={tab} setTab={setTab} />
      <main style={{ flex:1, padding:'20px 24px' }} key={tab} className="fade-up">
        {pages[tab]}
      </main>
      <Footer />
    </div>
  );
}
