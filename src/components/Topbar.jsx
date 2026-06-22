import { Activity, RefreshCw, Sun, Moon, Monitor } from 'lucide-react';
import { PulseDot } from './ui.jsx';
import { TICKER_PHRASES } from '../data/dummy.js';
import { useTheme } from '../context/ThemeContext.jsx';

const TABS = ['Overview','Anomali','Kecepatan','Target','KBLI','Petugas','Responden'];

export function Ticker() {
  const repeated = [...TICKER_PHRASES,...TICKER_PHRASES,...TICKER_PHRASES,...TICKER_PHRASES];
  return (
    <div style={{ overflow:'hidden', background:'var(--bg1)', borderBottom:'1px solid var(--border)', padding:'7px 0' }}>
      <div style={{ display:'flex', whiteSpace:'nowrap', animation:'ticker 38s linear infinite' }}>
        {repeated.map((p,i) => (
          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'0 36px', fontSize:10, fontWeight:500, color:'var(--text2)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
            {p}
            <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text4)', display:'inline-block' }} />
          </span>
        ))}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const opts = [
    { val:'dark',   icon: Moon,    label:'Gelap'  },
    { val:'light',  icon: Sun,     label:'Terang' },
    { val:'system', icon: Monitor, label:'Otomatis' },
  ];
  return (
    <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
      {opts.map(({ val, icon: Icon, label }) => {
        const active = mode === val;
        return (
          <button key={val} onClick={() => setMode(val)} title={label} style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            width:26, height:26, borderRadius:6, border:'none', cursor:'pointer',
            background: active ? 'var(--bg5)' : 'transparent',
            color: active ? 'var(--indigo3)' : 'var(--text3)',
            transition:'all .15s',
          }}>
            <Icon size={12} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

export function Topbar({ activeTab, setTab }) {
  return (
    /* position sticky & top dihapus — sudah dihandle oleh wrapper di App.jsx */
    <div style={{ display:'flex', alignItems:'center', height:56, padding:'0 24px', gap:0, background:'var(--bg1)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0 }}>
        <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(99,102,241,0.35)' }}>
          <Activity size={16} color="#fff" strokeWidth={2.2} />
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)', letterSpacing:'-0.01em', lineHeight:1.2 }}>EWS SE2026</div>
          <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Early Warning System</div>
        </div>
      </div>
      <div style={{ width:1, height:24, background:'var(--border2)', marginRight:20, flexShrink:0 }} />
      <nav style={{ display:'flex', gap:2, flex:1, overflowX:'auto' }}>
        {TABS.map(t => {
          const active = activeTab===t;
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'6px 13px', fontSize:12, fontWeight:active?600:400, border:'none', cursor:'pointer', borderRadius:8, transition:'all .15s', whiteSpace:'nowrap',
              background:active?'rgba(99,102,241,0.15)':'transparent',
              color:active?'var(--indigo3)':'var(--text3)',
            }}>{t}</button>
          );
        })}
      </nav>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <ThemeToggle />
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#34d399' }}>
          <PulseDot color="#10b981" size={7} />
          <span>Live</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:99, padding:'4px 12px' }}>
          <RefreshCw size={10} color="var(--text3)" strokeWidth={2} />
          <span style={{ fontSize:10, color:'var(--text3)' }}>21 Jun 2026 · 14:32</span>
        </div>
      </div>
    </div>
  );
}
