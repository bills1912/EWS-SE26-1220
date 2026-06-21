import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function PulseDot({ color = '#f43f5e', size = 8 }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:size, height:size, flexShrink:0 }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, animation:'ripple 1.8s ease-out infinite' }} />
      <span style={{ position:'absolute', inset:size*0.18, borderRadius:'50%', background:color }} />
    </span>
  );
}

const BADGE_COLORS = {
  crit:   { bg:'rgba(244,63,94,0.12)',   text:'#f87171',  border:'rgba(244,63,94,0.25)'   },
  warn:   { bg:'rgba(245,158,11,0.12)',  text:'#fbbf24',  border:'rgba(245,158,11,0.25)'  },
  ok:     { bg:'rgba(16,185,129,0.12)',  text:'#34d399',  border:'rgba(16,185,129,0.25)'  },
  info:   { bg:'rgba(99,102,241,0.12)',  text:'#a5b4fc',  border:'rgba(99,102,241,0.25)'  },
  neutral:{ bg:'rgba(90,98,133,0.12)',   text:'var(--text3)', border:'rgba(90,98,133,0.22)' },
};

export function Badge({ children, variant='info', style={} }) {
  const c = BADGE_COLORS[variant] || BADGE_COLORS.info;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      fontSize:10, fontWeight:600, padding:'2px 8px',
      borderRadius:99, background:c.bg, color:c.text,
      border:`1px solid ${c.border}`, letterSpacing:'0.04em',
      whiteSpace:'nowrap', ...style,
    }}>{children}</span>
  );
}

export function Card({ children, style={}, accent }) {
  const accentStyle = accent==='crit'
    ? { borderColor:'rgba(244,63,94,0.25)', background:'rgba(244,63,94,0.04)' }
    : accent==='warn'
    ? { borderColor:'rgba(245,158,11,0.22)', background:'rgba(245,158,11,0.03)' }
    : {};
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 20px', ...accentStyle, ...style }}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
      {Icon && <Icon size={13} color="var(--indigo2)" strokeWidth={2} />}
      <span style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em', flex:1 }}>{children}</span>
      {right}
    </div>
  );
}

export function ProgressBar({ pct, color='#6366f1', height=5, delay=0 }) {
  return (
    <div style={{ flex:1, height, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
      <div className="bar-animate" style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:color, borderRadius:99, animationDelay:`${delay}ms`, animationDuration:'0.8s' }} />
    </div>
  );
}

export function TrendIcon({ trend, size=12 }) {
  if (trend==='up')   return <TrendingUp   size={size} color="#10b981" strokeWidth={2} />;
  if (trend==='down') return <TrendingDown size={size} color="#f43f5e" strokeWidth={2} />;
  return <Minus size={size} color="var(--text3)" strokeWidth={2} />;
}

export function statusColor(s) { return s==='crit'?'#f43f5e':s==='warn'?'#f59e0b':'#10b981'; }
export function statusLabel(s) { return s==='crit'?'Kritis':s==='warn'?'Perlu cek':'Aman'; }
export function statusVariant(s) { return s==='crit'?'crit':s==='warn'?'warn':'ok'; }
export function sevColor(s) { return s==='crit'?'#f43f5e':s==='warn'?'#f59e0b':'#818cf8'; }
