// src/pages/Overview.jsx — versi data real dari MongoDB
import {
  BarChart2, CheckCircle, XCircle, Clock,
  ShieldAlert, Building2, Zap, Tag, AlertTriangle,
  TrendingUp, TrendingDown, Users, MapPin,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, SectionTitle, ProgressBar, Badge, PulseDot, statusColor, statusVariant } from '../components/ui.jsx';
import { useStatistik } from '../hooks/useEWSData.js';
import { useKecamatan } from '../context/KecamatanContext.jsx';

// ── Loading skeleton ──────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 20, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: 'linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ── Metric card ───────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, subColor, iconBg, iconColor, trend, delay = 0 }) {
  return (
    <Card style={{ animationDelay: `${delay}ms` }} className="fade-up">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ width:36, height:36, borderRadius:10, background: iconBg||'rgba(99,102,241,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={17} color={iconColor||'var(--indigo2)'} strokeWidth={1.8} />
        </div>
        {trend === 'up'   && <TrendingUp   size={13} color="#10b981" strokeWidth={2} />}
        {trend === 'down' && <TrendingDown  size={13} color="#f43f5e" strokeWidth={2} />}
      </div>
      <div style={{ fontSize:10, color:'var(--text3)', fontWeight:500, marginBottom:5, letterSpacing:'0.04em' }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color:'var(--text1)', letterSpacing:'-0.03em', lineHeight:1, fontFamily:'var(--mono)', marginBottom:6 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color: subColor||'var(--text3)' }}>{sub}</div>}
    </Card>
  );
}

function AnomalyRow({ item }) {
  const c = item.sev==='crit'
    ? { dot:'#f43f5e', bg:'rgba(244,63,94,0.05)', border:'rgba(244,63,94,0.14)' }
    : item.sev==='warn'
    ? { dot:'#f59e0b', bg:'rgba(245,158,11,0.05)', border:'rgba(245,158,11,0.14)' }
    : { dot:'#818cf8', bg:'rgba(99,102,241,0.05)', border:'rgba(99,102,241,0.14)' };
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px', background:c.bg, border:`1px solid ${c.border}`, borderRadius:10 }}>
      <div style={{ paddingTop:2 }}><PulseDot color={c.dot} size={7} /></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, marginBottom:4 }}>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{item.title}</span>
          <Badge variant={item.sev==='info'?'info':item.sev}>{item.sev==='crit'?'Kritis':item.sev==='warn'?'Perlu cek':'Info'}</Badge>
          <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text4)' }}>{item.ts}</span>
        </div>
        <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.65, marginBottom:8 }}>{item.detail}</div>
        <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}><Users size={10} strokeWidth={2}/>{item.petugas}</span>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}><MapPin size={10} strokeWidth={2}/>{item.kec}</span>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ data }) {
  const max = Math.max(...data.rows.flatMap(r => r.vals));
  const cell = (v) => {
    if (!v) return { bg:'var(--bg4)', color:'var(--text4)' };
    const p = v/max;
    if (p<0.2) return { bg:'rgba(99,102,241,0.12)', color:'var(--text3)' };
    if (p<0.4) return { bg:'rgba(99,102,241,0.26)', color:'var(--text2)' };
    if (p<0.6) return { bg:'rgba(99,102,241,0.44)', color:'var(--text1)' };
    if (p<0.8) return { bg:'rgba(99,102,241,0.65)', color:'#fff' };
    return { bg:'#5a5cf8', color:'#fff' };
  };
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ borderCollapse:'separate', borderSpacing:'3px', width:'100%' }}>
        <thead>
          <tr>
            <th style={{ fontSize:9, color:'var(--text4)', textAlign:'left', width:130, paddingBottom:6, fontWeight:500 }}/>
            {data.days.map(d => <th key={d} style={{ fontSize:9, color:'var(--text4)', textAlign:'center', fontWeight:500, paddingBottom:6 }}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => (
            <tr key={row.kec}>
              <td style={{ fontSize:10, color:'var(--text2)', paddingRight:8, paddingBottom:3, whiteSpace:'nowrap', fontWeight:500 }}>{row.kec}</td>
              {row.vals.map((v,i) => {
                const s = cell(v);
                return (
                  <td key={i} style={{ padding:'2px' }}>
                    <div style={{ background:s.bg, color:s.color, borderRadius:5, padding:'5px 4px', fontSize:9, fontWeight:600, fontFamily:'var(--mono)', minWidth:28, textAlign:'center' }}>
                      {v||'—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'var(--text2)', marginBottom:2 }}>{label}</div>
      <div style={{ color:'var(--indigo3)', fontWeight:600, fontFamily:'var(--mono)' }}>{payload[0].value} records</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Overview() {
  const { data: stat, loading, error } = useStatistik();
  const { selectedKec } = useKecamatan();  // ← HARUS sebelum early return

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
        {Array(6).fill(0).map((_,i) => (
          <Card key={i}><Skeleton h={80}/></Card>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:14 }}>
        <Card><Skeleton h={300}/></Card>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Card><Skeleton h={140}/></Card>
          <Card><Skeleton h={140}/></Card>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <Card accent="crit">
      <div style={{ fontSize:14, color:'#f87171', fontWeight:600 }}>Gagal memuat data</div>
      <div style={{ fontSize:12, color:'var(--text3)', marginTop:8 }}>{error}</div>
      <div style={{ fontSize:11, color:'var(--text4)', marginTop:4 }}>Pastikan API server berjalan di http://localhost:3001</div>
    </Card>
  );

  // Safe destructuring — pengadmin hanya dapat subset data (tanpa anomali/pace/heatmap/dailyTrend)
  const summary     = stat?.summary     || {};
  const anomali     = stat?.anomali     || [];
  const pace        = stat?.pace        || [];
  const heatmap     = stat?.heatmap     || { days:[], rows:[] };
  const dailyTrend  = stat?.dailyTrend  || [];
  const isFiltered = selectedKec !== 'all';

  // Filter client-side per kecamatan
  const anomaliF    = isFiltered ? anomali.filter(a => a.kec === selectedKec) : anomali;
  const paceF       = isFiltered ? pace.filter(p => p.kec === selectedKec)    : pace;
  const heatmapF    = isFiltered
    ? { days: heatmap.days, rows: heatmap.rows.filter(r => r.kec === selectedKec) }
    : heatmap;
  // Summary per-kecamatan dari pace
  const kecData     = isFiltered ? paceF[0] : null;
  const summaryF    = isFiltered && kecData
    ? { ...summary, approved: kecData.n, total: kecData.target,
        submitted: kecData.target - kecData.n - (kecData.reject||0),
        rejected:  kecData.reject||0 }
    : summary;

  const critCount   = anomaliF.filter(a => a.sev === 'crit').length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Metric row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
        <MetricCard delay={0}   icon={BarChart2}   label="Total records"     value={(summaryF.total||0).toLocaleString('id')}     sub={isFiltered ? selectedKec.split(' ').map(w=>w[0]+w.slice(1).toLowerCase()).join(' ') : `${summary.kecamatan||0} kecamatan`} trend="up" />
        <MetricCard delay={50}  icon={Clock}       label="Menunggu validasi" value={(summaryF.submitted||0).toLocaleString('id')} sub={`${summaryF.total?Math.round((summaryF.submitted||0)/summaryF.total*100):0}% pending`} subColor="var(--amber)" iconBg="rgba(245,158,11,0.1)" iconColor="#f59e0b" />
        <MetricCard delay={100} icon={CheckCircle} label="Approved"          value={(summaryF.approved||0).toLocaleString('id')}  sub={`${summaryF.total?Math.round((summaryF.approved||0)/summaryF.total*100):0}% selesai`} subColor="var(--green)" iconBg="rgba(16,185,129,0.1)" iconColor="#10b981" trend="up" />
        <MetricCard delay={150} icon={XCircle}     label="Rejected"          value={(summaryF.rejected||0).toLocaleString('id')}  sub={`${summaryF.total?Math.round((summaryF.rejected||0)/summaryF.total*100):0}% dikembalikan`} subColor="var(--red)" iconBg="rgba(244,63,94,0.1)" iconColor="#f43f5e" />
        <MetricCard delay={200} icon={Building2}   label="Usaha terdata"     value={(summary.usaha||0).toLocaleString('id')}     sub={`${summary.kbliMissing||0} tanpa KBLI`} subColor="var(--amber)" iconBg="rgba(167,139,250,0.1)" iconColor="var(--purple)" />
        <MetricCard delay={250} icon={ShieldAlert} label="Anomali aktif"     value={anomaliF.length}                             sub={`${critCount} kritis`} subColor="var(--red)" iconBg="rgba(244,63,94,0.1)" iconColor="#f43f5e" trend="up" />
      </div>

      {/* Middle */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:14 }}>
        <Card>
          <SectionTitle icon={ShieldAlert} right={<Badge variant="crit">{anomaliF.length} peringatan</Badge>}>Peringatan aktif</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {anomaliF.slice(0,5).map(a => <AnomalyRow key={a.id} item={a}/>)}
          </div>
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Card>
            <SectionTitle icon={CheckCircle}>Status pendataan</SectionTitle>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { label:'Approved',           n:summaryF.approved||0,  color:'#10b981' },
                { label:'Submitted (pending)', n:summaryF.submitted||0, color:'#f59e0b' },
                { label:'Rejected',           n:summaryF.rejected||0,  color:'#f43f5e' },
              ].map((s,i) => (
                <div key={s.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'var(--text2)' }}>{s.label}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:s.color, fontFamily:'var(--mono)' }}>{s.n.toLocaleString('id')}</span>
                  </div>
                  <ProgressBar pct={summaryF.total ? (s.n/summaryF.total)*100 : 0} color={s.color} delay={i*120}/>
                </div>
              ))}
              {(summary.usaha > 0) && (
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'var(--text2)' }}>KBLI terisi</span>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--indigo3)', fontFamily:'var(--mono)' }}>
                      {(summary.usaha - (summary.kbliMissing||0))} / {summary.usaha}
                    </span>
                  </div>
                  <ProgressBar pct={((summary.usaha-(summary.kbliMissing||0))/summary.usaha)*100} color="var(--indigo)" delay={360}/>
                  <div style={{ fontSize:10, color:'var(--amber)', marginTop:8, display:'flex', alignItems:'center', gap:4 }}>
                    <AlertTriangle size={10} strokeWidth={2} color="var(--amber)"/>
                    {summary.kbliMissing||0} usaha masih tanpa KBLI
                  </div>
                </div>
              )}
            </div>
          </Card>
          <Card>
              <SectionTitle icon={BarChart2}>Tren pendataan harian</SectionTitle>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={dailyTrend} margin={{ top:4, right:0, bottom:0, left:-30 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Area type="monotone" dataKey="n" stroke="#6366f1" strokeWidth={1.8} fill="url(#areaGrad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
        </div>
      </div>

      {/* Bottom */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <SectionTitle icon={BarChart2}>Heatmap pendataan per kecamatan × hari</SectionTitle>
          <Heatmap data={heatmapF}/>
        </Card>
        <Card>
          <SectionTitle icon={Zap}>Approval rate per kecamatan</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {paceF.map((p,i) => (
              <div key={p.kec} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:10, color:'var(--text3)', width:118, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.kec}</span>
                <ProgressBar pct={p.pct} color={statusColor(p.status)} delay={i*55}/>
                <span style={{ fontSize:10, fontWeight:700, fontFamily:'var(--mono)', color:statusColor(p.status), width:32, textAlign:'right', flexShrink:0 }}>{p.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}