/**
 * src/components/Topbar.jsx — tab dinamis sesuai allowedTabs
 */

import { Activity, RefreshCw, Sun, Moon, Monitor, LogOut, User } from 'lucide-react';
import KecamatanFilter from './KecamatanFilter.jsx';
import { useState } from 'react';
import { PulseDot } from './ui.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useStatistik } from '../hooks/useEWSData.js';

// Semua tab yang mungkin (urutan tetap)
const ALL_TABS = ['Overview','Anomali','Kecepatan','Target','KBLI','Petugas','Responden','Evaluasi'];

// Label badge per role
const ROLE_BADGE = {
  kepala:     { label:'👑 Kepala',    color:'#f59e0b', bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.25)' },
  kasubbag:   { label:'🔑 Kasubbag', color:'#a78bfa', bg:'rgba(167,139,250,0.12)', border:'rgba(167,139,250,0.25)' },
  statistisi: { label:'📊 Statistisi',color:'var(--indigo3)', bg:'rgba(99,102,241,0.12)', border:'rgba(99,102,241,0.25)' },
  pengadmin:  { label:'📋 Pengadmin',  color:'var(--text3)', bg:'var(--bg4)',      border:'var(--border)' },
};

const FALLBACK_TICKER = ['● EWS SE2026 · Padang Lawas Utara', 'Data bersifat rahasia — akses terbatas'];

export function Ticker() {
  const { data: stat } = useStatistik();
  const phrases = stat?.tickerPhrases || FALLBACK_TICKER;
  const repeated = [...phrases,...phrases,...phrases,...phrases];
  return (
    <div style={{ overflow:'hidden', background:'var(--bg1)', borderBottom:'1px solid var(--border)', padding:'7px 0' }}>
      <div style={{ display:'flex', whiteSpace:'nowrap', animation:'ticker 38s linear infinite' }}>
        {repeated.map((p,i) => (
          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'0 36px', fontSize:10, fontWeight:500, color:'var(--text2)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
            {p}
            <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text4)', display:'inline-block' }}/>
          </span>
        ))}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const opts = [
    { val:'dark',   icon:Moon,    label:'Gelap' },
    { val:'light',  icon:Sun,     label:'Terang' },
    { val:'system', icon:Monitor, label:'Otomatis' },
  ];
  return (
    <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
      {opts.map(({ val, icon: Icon, label }) => {
        const active = mode===val;
        return (
          <button key={val} onClick={() => setMode(val)} title={label}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26, borderRadius:6, border:'none', cursor:'pointer', background:active?'var(--bg5)':'transparent', color:active?'var(--indigo3)':'var(--text3)', transition:'all .15s' }}>
            <Icon size={12} strokeWidth={2}/>
          </button>
        );
      })}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const badge = ROLE_BADGE[user?.role] || ROLE_BADGE.statistisi;

  return (
    <div style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display:'flex', alignItems:'center', gap:7, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:99, padding:'4px 10px 4px 6px', cursor:'pointer', transition:'all .15s' }}
      >
        <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <User size={11} color="#fff" strokeWidth={2.5}/>
        </div>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {user?.nama?.split(' ')[0] || user?.username}
        </span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:199 }}/>
          <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', zIndex:200, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, minWidth:230, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', animation:'fadeUp .15s ease both', overflow:'hidden' }}>

            {/* Info user */}
            <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text1)', marginBottom:2 }}>{user?.nama}</div>
              <div style={{ fontSize:10, color:'var(--text4)', fontFamily:'var(--mono)', marginBottom:8 }}>@{user?.username}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`, borderRadius:99, padding:'2px 8px' }}>
                  {badge.label}
                </span>
                {user?.jabatan && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9, fontWeight:500, color:'var(--text3)', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 8px' }}>
                    {user.jabatan}
                  </span>
                )}
              </div>
            </div>

            {/* Info golongan & NIP */}
            {(user?.golongan) && (
              <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:12 }}>
                <div>
                  <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Golongan</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', fontFamily:'var(--mono)' }}>{user.golongan}</div>
                </div>
              </div>
            )}



            {/* Logout */}
            <button
              onClick={() => { setOpen(false); logout(); }}
              style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'11px 16px', background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#f87171', fontFamily:'var(--font)', transition:'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(244,63,94,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
            >
              <LogOut size={13} strokeWidth={2}/>
              Keluar dari akun
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar({ activeTab, setTab, allowedTabs = ALL_TABS }) {
  const { data: stat } = useStatistik();
  const lastUpdate = stat?.summary?.lastUpdate || '—';

  return (
    <div style={{ display:'flex', alignItems:'center', height:56, padding:'0 24px', gap:0, background:'var(--bg1)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0 }}>
        <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(99,102,241,0.35)' }}>
          <Activity size={16} color="#fff" strokeWidth={2.2}/>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)', letterSpacing:'-0.01em', lineHeight:1.2 }}>EWS SE2026</div>
          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Early Warning System</div>
        </div>
      </div>
      <div style={{ width:1, height:24, background:'var(--border2)', marginRight:20, flexShrink:0 }}/>

      {/* Hanya tampilkan tab yang diizinkan untuk role ini */}
      <nav style={{ display:'flex', gap:2, flex:1, overflowX:'auto' }}>
        {ALL_TABS.filter(t => allowedTabs.includes(t)).map(t => {
          const active = activeTab === t;
          return (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 13px', fontSize:12, fontWeight:active?600:400, border:'none', cursor:'pointer', borderRadius:8, transition:'all .15s', whiteSpace:'nowrap', background:active?'rgba(99,102,241,0.15)':'transparent', color:active?'var(--indigo3)':'var(--text3)' }}>
              {t}
            </button>
          );
        })}
      </nav>

      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <KecamatanFilter/>
        <ThemeToggle/>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#34d399' }}>
          <PulseDot color="#10b981" size={7}/><span>Live</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:99, padding:'4px 12px' }}>
          <RefreshCw size={10} color="var(--text3)" strokeWidth={2}/>
          <span style={{ fontSize:10, color:'var(--text3)' }}>{lastUpdate}</span>
        </div>
        <UserMenu/>
      </div>
    </div>
  );
}