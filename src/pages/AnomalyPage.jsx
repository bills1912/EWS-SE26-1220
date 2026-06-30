// src/pages/AnomalyPage.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert, Users, MapPin, BarChart2, AlertTriangle,
  Clock, CreditCard, HelpCircle, Fingerprint, Timer,
  ArrowRight, ArrowUpRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { Card, SectionTitle, Badge, PulseDot } from '../components/ui.jsx';
import { CrosscheckTable } from '../components/CrosscheckTable.jsx';
import { useStatistik } from '../hooks/useEWSData.js';
import { useKecamatan } from '../context/KecamatanContext.jsx';
import { AnomalyDetailTable } from '../components/AnomalyDetailTable.jsx';

const matchKec = (a, b) => (a||'').toLowerCase() === (b||'').toLowerCase();

// ── Loading spinner kecil untuk indikasi filter sedang berjalan ──────────
function MiniSpinner({ size = 12, color = 'var(--orange3)' }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      border:`2px solid ${color}30`, borderTopColor:color,
      animation:'spin .7s linear infinite', flexShrink:0,
    }}/>
  );
}


function Skeleton({ h = 80 }) {
  return (
    <div style={{
      height: h, borderRadius: 8,
      background: 'linear-gradient(90deg,var(--bg3) 25%,var(--bg4) 50%,var(--bg3) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }}/>
  );
}

// ── Outlier modal ──────────────────────────────────────────────────────────
function OutlierModal({ outlier, metricLabel, unit, onClose }) {
  if (!outlier) return null;
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
      background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)',
        border:'1px solid var(--border2)', borderRadius:16, width:'100%', maxWidth:440,
        overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', animation:'modalIn .25s ease both' }}>
        <div style={{ padding:'20px 22px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <Badge variant="crit"><AlertTriangle size={9} strokeWidth={2}/> Outlier terdeteksi</Badge>
            <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:'auto' }}>{outlier.id}</span>
          </div>
          <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text1)', marginBottom:4 }}>{outlier.nama}</h3>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{metricLabel}</div>
        </div>
        <div style={{ padding:'18px 22px' }}>
          <div style={{ background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.25)',
            borderRadius:10, padding:'12px 14px', marginBottom:16, textAlign:'center' }}>
            <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Nilai outlier</div>
            <div style={{ fontSize:26, fontWeight:700, color:'#f87171', fontFamily:'var(--mono)' }}>
              {unit === 'menit' && typeof outlier.value === 'number' && outlier.value > 240
                ? `${Math.floor(outlier.value/60)}j ${outlier.value%60}m`
                : outlier.value}
              {' '}<span style={{ fontSize:13, color:'var(--text3)' }}>{unit}</span>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[['Kecamatan', outlier.kec], ['Desa', outlier.desa], ['PCL', outlier.pcl]].map(([l,v]) => (
              <div key={l} style={{ background:'var(--bg3)', borderRadius:8, padding:'9px 12px' }}>
                <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:12, color:'var(--text1)', fontWeight:600 }}>{v}</div>
              </div>
            ))}
            <div style={{ background:'var(--bg3)', borderRadius:8, padding:'9px 12px' }}>
              <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>Status</div>
              <Badge variant={outlier.status==='APPROVED'?'ok':'neutral'}>{outlier.status}</Badge>
            </div>
            {outlier.usaha && (
              <div style={{ gridColumn:'1/-1', background:'var(--bg3)', borderRadius:8, padding:'9px 12px' }}>
                <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>Nama Usaha</div>
                <div style={{ fontSize:12, color:'var(--text1)', fontWeight:600 }}>{outlier.usaha}</div>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding:'12px 22px 18px', borderTop:'1px solid var(--border)', display:'flex', gap:8, justifyContent:'flex-end' }}>
          {/* Tombol Fasih — buka di tab baru */}
          {outlier.fasihUrl && (
            <a
              href={outlier.fasihUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:'inline-flex', alignItems:'center', gap:5,
                padding:'7px 14px', borderRadius:20, fontSize:11, fontWeight:700,
                cursor:'pointer', whiteSpace:'nowrap', textDecoration:'none',
                background:'linear-gradient(135deg,#1d6fa4,#155d8a)',
                color:'#fff', border:'none',
                boxShadow:'0 2px 8px rgba(29,111,164,0.35)',
                transition:'all .18s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(29,111,164,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(29,111,164,0.35)'; }}
            >
              Fasih <ArrowUpRight size={11}/>
            </a>
          )}
          {/* Tombol Lihat Responden — navigate ke tab Responden EWS */}
          {outlier.id && (
            <button
              onClick={() => {
                onClose();
                sessionStorage.setItem('ews_goto_responden', outlier.id);
                window.dispatchEvent(new CustomEvent('ews:goto', {
                  detail: { tab: 'Responden', respondentId: outlier.id }
                }));
              }}
              style={{
                display:'inline-flex', alignItems:'center', gap:5,
                padding:'7px 14px', borderRadius:20, fontSize:11, fontWeight:700,
                cursor:'pointer', whiteSpace:'nowrap',
                background:'linear-gradient(135deg,#f97316,#e2621b)',
                color:'#fff', border:'none',
                boxShadow:'0 2px 8px rgba(249,115,22,0.35)',
                transition:'all .18s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(249,115,22,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(249,115,22,0.35)'; }}
            >
              Lihat <ArrowRight size={11}/>
            </button>
          )}
          <button onClick={onClose} style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:500,
            cursor:'pointer', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Box Plot SVG ───────────────────────────────────────────────────────────
function BoxPlot({ data }) {
  const [tooltip, setTooltip]               = useState(null);
  const [hovered, setHovered]               = useState(null);
  const [selectedOutlier, setSelectedOutlier] = useState(null);

  const W=760, H=150, PAD=70, plotW=W-PAD*2;
  const logMax = data.q4 > 0 ? data.q4 : 1;  // guard: jangan bagi 0
  const toX = v => {
    if (!isFinite(v) || isNaN(v) || logMax === 0) return PAD;
    return PAD + ((v - 0) / logMax) * plotW;
  };
  const q1x=toX(data.q1), medx=toX(data.median), q3x=toX(data.q3);
  const loFx=toX(data.fenceLo), hiFx=toX(Math.min(data.fenceHi,data.q4));
  const meanx=toX(Math.min(data.mean,data.q4));
  const CY=66, BH=40, by1=CY-BH/2, by2=CY+BH/2;
  const ticks = [data.q0,data.q1,data.median,data.q3,Math.min(data.fenceHi,data.q4),data.q4];
  const showTip = (e,label,value) => {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect();
    setTooltip({ x:e.clientX-rect.left, y:e.clientY-rect.top, label, value });
  };
  const hideTip = () => { setTooltip(null); setHovered(null); };

  return (
    <div style={{ overflowX:'auto', position:'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:1000, height:'auto', display:'block', overflow:'visible' }}>
        {ticks.map((t,i) => <line key={i} x1={toX(t)} y1={by1-6} x2={toX(t)} y2={by2+6} stroke="var(--border2)" strokeWidth={1} strokeDasharray="3,3"/>)}
        <line x1={loFx} y1={CY} x2={q1x} y2={CY} stroke="var(--text3)" strokeWidth={2}/>
        <line x1={q3x} y1={CY} x2={Math.min(hiFx,toX(data.q4))} y2={CY} stroke="var(--text3)" strokeWidth={2}/>
        <line x1={loFx} y1={by1+8} x2={loFx} y2={by2-8} stroke="var(--text3)" strokeWidth={hovered==='fenceLo'?4:2} style={{cursor:'pointer'}} onMouseEnter={e=>{setHovered('fenceLo');showTip(e,'Batas bawah',data.fenceLo);}} onMouseMove={e=>showTip(e,'Batas bawah',data.fenceLo)} onMouseLeave={hideTip}/>
        <line x1={Math.min(hiFx,toX(data.q4))} y1={by1+8} x2={Math.min(hiFx,toX(data.q4))} y2={by2-8} stroke="var(--text3)" strokeWidth={hovered==='fenceHi'?4:2} style={{cursor:'pointer'}} onMouseEnter={e=>{setHovered('fenceHi');showTip(e,'Batas atas (fence)',data.fenceHi);}} onMouseMove={e=>showTip(e,'Batas atas',data.fenceHi)} onMouseLeave={hideTip}/>
        <rect x={q1x} y={by1} width={q3x-q1x} height={BH} rx={5}
          fill={hovered==='iqr'?'rgba(232,84,28,0.32)':'rgba(232,84,28,0.18)'} stroke="rgba(232,84,28,0.5)" strokeWidth={2} style={{cursor:'pointer',transition:'fill .15s'}}
          onMouseEnter={e=>{setHovered('iqr');showTip(e,'IQR (Q1–Q3)',`${data.q1}–${data.q3}`);}} onMouseMove={e=>showTip(e,'IQR',`${data.q1}–${data.q3}`)} onMouseLeave={hideTip}/>
        <line x1={medx} y1={by1} x2={medx} y2={by2} stroke="var(--orange3)" strokeWidth={hovered==='median'?6:3.5} style={{cursor:'pointer',transition:'stroke-width .15s'}} onMouseEnter={e=>{setHovered('median');showTip(e,'Median',data.median);}} onMouseMove={e=>showTip(e,'Median',data.median)} onMouseLeave={hideTip}/>
        <polygon points={`${meanx},${CY-9} ${meanx+7},${CY} ${meanx},${CY+9} ${meanx-7},${CY}`} fill="#f59e0b" style={{cursor:'pointer'}} onMouseEnter={e=>{setHovered('mean');showTip(e,'Mean',data.mean);}} onMouseMove={e=>showTip(e,'Mean',data.mean)} onMouseLeave={hideTip}/>
        {data.outliers.map((o,i) => (
          <circle key={i} cx={Math.min(toX(o.value),W-10)} cy={CY} r={hovered===`out${i}`?9.5:7}
            fill="rgba(244,63,94,0.8)" stroke="rgba(244,63,94,0.3)" strokeWidth={2.5}
            style={{cursor:'pointer',transition:'r .15s'}}
            onMouseEnter={e=>{setHovered(`out${i}`);showTip(e,o.nama,o.value);}}
            onMouseMove={e=>showTip(e,o.nama,o.value)} onMouseLeave={hideTip}
            onClick={() => setSelectedOutlier(o)}/>
        ))}
        {data.anomalyThresholdLo > 0 && <line x1={toX(data.anomalyThresholdLo)} y1={by1-12} x2={toX(data.anomalyThresholdLo)} y2={by2+12} stroke="#f43f5e" strokeWidth={2} strokeDasharray="5,4"/>}
        {data.anomalyThresholdHi && data.anomalyThresholdHi < data.q4 && <line x1={Math.min(toX(data.anomalyThresholdHi),W-5)} y1={by1-12} x2={Math.min(toX(data.anomalyThresholdHi),W-5)} y2={by2+12} stroke="#f43f5e" strokeWidth={2} strokeDasharray="5,4"/>}
        {[{x:q1x,lbl:'Q1',val:data.q1},{x:medx,lbl:'Med',val:data.median},{x:q3x,lbl:'Q3',val:data.q3}].map(({x,lbl,val},i) => (
          <g key={i}>
            <text x={x} y={by2+20} textAnchor="middle" fontSize={9.5} fill="var(--text4)">{lbl}</text>
            <text x={x} y={by2+32} textAnchor="middle" fontSize={11} fill="var(--text3)" fontFamily="var(--mono)">{val}</text>
          </g>
        ))}
        {data.outliers.length > 0 && <text x={Math.min(toX(data.outliers[0].value),W-20)} y={by1-16} textAnchor="middle" fontSize={10.5} fill="#f87171">max {data.q4}</text>}
        <text x={meanx} y={by1-16} textAnchor="middle" fontSize={10} fill="#f59e0b">mean {data.mean}</text>
      </svg>
      {tooltip && (
        <div style={{ position:'absolute', left:tooltip.x, top:tooltip.y-40, transform:'translateX(-50%)', background:'var(--bg5)', border:'1px solid var(--border2)', borderRadius:8, padding:'7px 12px', fontSize:12, color:'var(--text1)', whiteSpace:'nowrap', pointerEvents:'none', zIndex:10 }}>
          <div style={{ color:'var(--text3)', fontSize:10, marginBottom:2 }}>{tooltip.label}</div>
          <div style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{tooltip.value} {data.unit}</div>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap', marginTop:10 }}>
        {[
          {color:'rgba(232,84,28,0.6)',label:'IQR (Q1–Q3)',type:'rect'},
          {color:'var(--orange3)',label:'Median',type:'line'},
          {color:'#f59e0b',label:'Mean',type:'diamond'},
          {color:'#f43f5e',label:'Outlier',type:'circle'},
          {color:'#f43f5e',label:'Batas anomali',type:'dash'},
        ].map(l => (
          <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text3)' }}>
            {l.type==='rect'    && <span style={{ width:16,height:9,background:l.color,border:'1px solid rgba(232,84,28,0.5)',borderRadius:2,display:'inline-block'}}/>}
            {l.type==='line'    && <span style={{ width:16,height:2.5,background:l.color,display:'inline-block'}}/>}
            {l.type==='diamond' && <span style={{ width:10,height:10,background:l.color,display:'inline-block',transform:'rotate(45deg)'}}/>}
            {l.type==='circle'  && <span style={{ width:10,height:10,background:l.color,borderRadius:'50%',display:'inline-block'}}/>}
            {l.type==='dash'    && <span style={{ width:16,height:2,background:'transparent',borderTop:`2px dashed ${l.color}`,display:'inline-block'}}/>}
            {l.label}
          </div>
        ))}
        <span style={{ fontSize:10, color:'var(--text4)', marginLeft:'auto' }}>💡 Klik titik merah untuk detail</span>
      </div>
      <OutlierModal outlier={selectedOutlier} metricLabel={data.label} unit={data.unit} onClose={() => setSelectedOutlier(null)}/>
    </div>
  );
}

// ── Distribusi bar chart ───────────────────────────────────────────────────
function DistChart({ data: distData }) {
  const TT = ({ active, payload, label }) => {
    if (!active||!payload?.length) return null;
    return (
      <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
        <div style={{ color:'var(--text2)', marginBottom:2 }}>{label}</div>
        <div style={{ color:'var(--orange3)', fontWeight:600, fontFamily:'var(--mono)' }}>{payload[0].value} records</div>
        {payload[0].payload.anomaly && <div style={{ color:'#f87171', fontSize:10, marginTop:2 }}>⚠ Range anomali</div>}
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={distData} margin={{ top:4, right:8, bottom:0, left:-16 }}>
        <XAxis dataKey="range" tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
        <Tooltip content={<TT/>}/>
        <Bar dataKey="n" radius={[3,3,0,0]}>
          {distData.map((d,i) => <Cell key={i} fill={d.anomaly?'rgba(244,63,94,0.7)':'rgba(232,84,28,0.55)'}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatRow({ data }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
      {[
        {label:'Min',val:data.q0},{label:'Q1',val:data.q1},{label:'Median',val:data.median},
        {label:'Mean',val:data.mean},{label:'Q3',val:data.q3},{label:'Max',val:data.q4},
        {label:'IQR',val:data.iqr},{label:'Fence ↑',val:data.fenceHi},
        {label:'Outlier',val:data.outliers.length,danger:true},
      ].map(s => (
        <div key={s.label} style={{ background:'var(--bg3)', border:`1px solid ${s.danger?'rgba(244,63,94,0.25)':'var(--border)'}`, borderRadius:8, padding:'6px 12px', minWidth:60 }}>
          <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{s.label}</div>
          <div style={{ fontSize:13, fontWeight:700, fontFamily:'var(--mono)', color:s.danger?'#f87171':'var(--text1)' }}>{s.val}</div>
        </div>
      ))}
    </div>
  );
}

// ── Anomali Durasi — section khusus dengan breakdown ──────────────────────
function DurasiAnomalySection({ stat, selectedKec }) {
  const od = stat?.outlierDurasi;
  const [liveData, setLiveData] = useState(null);
  const [loadingBox, setLoadingBox] = useState(false);

  // Fetch boxplot LANGSUNG dari backend dengan filter kecamatan —
  // tidak bergantung pada `stat` yang statis dan tidak mendukung filter
  useEffect(() => {
    let cancelled = false;
    setLoadingBox(true);
    const params = new URLSearchParams(
      selectedKec && selectedKec !== 'all' ? { kec: selectedKec } : {}
    );
    const BASE = (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const token = localStorage.getItem('ews_token');
    fetch(`${BASE}/api/anomali/boxplot?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(result => { if (!cancelled) { setLiveData(result); setLoadingBox(false); } })
      .catch(() => { if (!cancelled) setLoadingBox(false); });
    return () => { cancelled = true; };
  }, [selectedKec]);

  if (!od && !liveData) return null;

  const isFiltered = selectedKec !== 'all';

  // Pakai data live dari backend (sudah terfilter kecamatan) jika tersedia
  const stats   = liveData?.stats || null;
  const points  = liveData?.points || [];
  const odLive  = stats ? {
    q0: stats.min, q1: stats.q1, median: stats.median, q3: stats.q3, q4: stats.max,
    mean: stats.mean, iqr: stats.iqr,
    fenceLo: stats.fenceLo, fenceHi: stats.fenceHi,
    anomalyThresholdLo: stats.fenceLo,
    anomalyThresholdHi: stats.fenceHi,
    label: 'Durasi pengisian', unit: 'menit',
    outliers: points
      .filter(p => p.anomaly)
      .map(p => ({
        id: p.id, value: p.nilai, nama: p.namaKepala,
        kec: p.kecamatan, desa: p.desa, pcl: p.petugas, status: p.status,
        fasihUrl: p.fasihUrl || '',
      })),
  } : od;

  const n0 = points.filter(p => p.anomaly === 'crit').length || 0;
  const n5 = points.filter(p => p.anomaly === 'warn').length || 0;
  const nTotal = odLive?.outliers?.length || 0;

  const durSummary = [
    { label: '0 menit', sublabel:'Wawancara tidak terjadi', n: n0, color:'#f43f5e', sev:'CRIT' },
    { label: '1–5 menit', sublabel:'Terlalu singkat', n: n5, color:'#f59e0b', sev:'WARN' },
    { label: '>5 menit normal', sublabel:'Outlier statistik', n: Math.max(nTotal - n0 - n5, 0), color:'var(--orange3)', sev:'INFO' },
  ];

  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <Timer size={13} color="#f43f5e" strokeWidth={2}/>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text1)' }}>
          Distribusi durasi pengisian kuesioner (menit)
          {isFiltered && <span style={{ color:'var(--text4)', fontWeight:500 }}> — {selectedKec}</span>}
        </span>
        {loadingBox
          ? <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
              fontSize:10, color:'var(--text4)' }}>
              <MiniSpinner color="#f43f5e"/> Memuat…
            </span>
          : <Badge variant="crit" style={{ marginLeft:'auto' }}>{n0+n5} anomali waktu</Badge>
        }
      </div>

      {/* 3 kartu ringkasan durasi */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
        {durSummary.map(s => (
          <div key={s.label} style={{ background:'var(--bg2)', border:`1px solid ${s.color}30`, borderRadius:10, padding:'10px 13px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
              <span style={{ fontSize:9, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.sev}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:'var(--mono)', marginBottom:2 }}>
              {s.n.toLocaleString('id')}
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)' }}>{s.label}</div>
            <div style={{ fontSize:9, color:'var(--text4)', marginTop:2 }}>{s.sublabel}</div>
          </div>
        ))}
      </div>

      {/* Catatan threshold */}
      <div style={{ background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.15)',
        borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:10, color:'var(--text3)', lineHeight:1.6 }}>
        <strong style={{ color:'#f87171' }}>Threshold anomali:</strong>{' '}
        <span style={{ color:'#f43f5e' }}>0 menit (CRIT)</span> = waktu mulai = waktu selesai, wawancara tidak terjadi.{' '}
        <span style={{ color:'#f59e0b' }}>1–5 menit (WARN)</span> = terlalu singkat untuk kuesioner SE2026 (estimasi normal ≥10 menit).{' '}
        Batas atas statistik: ≥{odLive?.anomalyThresholdHi ?? odLive?.fenceHi ?? '—'} menit.
      </div>

      <StatRow data={odLive}/>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontWeight:600 }}>Box plot</div>
        {odLive?.q4 > 0
          ? <BoxPlot data={odLive}/>
          : <div style={{ padding:'16px', textAlign:'center', color:'var(--text4)', fontSize:11 }}>Data belum cukup untuk menampilkan boxplot</div>
        }
      </div>
      <div>
        <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontWeight:600 }}>
          Distribusi frekuensi <span style={{ color:'#f87171' }}>(merah = zona anomali ≤5 menit)</span>
        </div>
        <DistChart data={liveData ? buildDistFromPoints(points) : od?.dist}/>
      </div>
    </div>
  );
}

// Bangun histogram distribusi dari raw points (untuk DistChart)
function buildDistFromPoints(points) {
  if (!points || !points.length) return [];
  const buckets = [
    { range:'0', min:0, max:0 },
    { range:'1–2', min:1, max:2 },
    { range:'3–4', min:3, max:4 },
    { range:'5–6', min:5, max:6 },
    { range:'7–9', min:7, max:9 },
    { range:'10–12', min:10, max:12 },
    { range:'13+', min:13, max:Infinity },
  ];
  return buckets.map(b => ({
    range: b.range,
    n: points.filter(p => p.nilai >= b.min && p.nilai <= b.max).length,
    anomaly: b.max <= 5,
  }));
}

// Hook kecil untuk ambil total count dari endpoint crosscheck (sumber of truth,
// selalu sinkron dengan filter kecamatan — tidak bergantung pada stat.anomali)
function useCrosscheckCount(type, kecFilter) {
  const [count, setCount]     = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const BASE = (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const token = localStorage.getItem('ews_token');
    const params = new URLSearchParams({
      page: 1, limit: 1,
      ...(kecFilter && kecFilter !== 'all' ? { kec: kecFilter } : {}),
    });
    fetch(`${BASE}/api/crosscheck/${type}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setCount(d.total ?? 0); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, kecFilter]);
  return { count, loading };
}

// ── NIK 9999 section ───────────────────────────────────────────────────────
function NikSection({ selectedKec }) {
  const nikKK = useCrosscheckCount('nikKK', selectedKec);
  const nikAK = useCrosscheckCount('nikAK', selectedKec);

  const cards = [
    { type:'crit', label:'Kepala Keluarga', n:nikKK.count, loading:nikKK.loading,
      title:'kepala keluarga dengan NIK kode 9999',
      detail:'NIK diisi 9999 — tidak valid untuk integrasi DTSEN. Harus dikonfirmasi ulang dengan responden.' },
    { type:'warn', label:'Anggota Keluarga', n:nikAK.count, loading:nikAK.loading,
      title:'anggota keluarga dengan NIK kode 9999',
      detail:'NIK anggota keluarga diisi 9999 — tidak bisa dicocokkan ke data DTSEN/Dukcapil. Perlu konfirmasi KTP/KK fisik ke responden.' },
  ];

  return (
    <div style={{ background:'var(--bg3)', border:'1px solid rgba(244,63,94,0.2)', borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <Fingerprint size={13} color="#f43f5e" strokeWidth={2}/>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text1)' }}>NIK Kode 9999 — Identitas Tidak Valid</span>
        <Badge variant="crit" style={{ marginLeft:'auto' }}>Perlu konfirmasi KTP</Badge>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {cards.map(a => (
          <div key={a.label} style={{ background:'var(--bg2)', border:`1px solid ${a.type==='crit'?'rgba(244,63,94,0.25)':'rgba(245,158,11,0.2)'}`, borderRadius:10, padding:'12px 14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <PulseDot color={a.type==='crit'?'#f43f5e':'#f59e0b'} size={7}/>
              <Badge variant={a.type==='crit'?'crit':'warn'} style={{ fontSize:9 }}>{a.label}</Badge>
              {a.loading && <MiniSpinner color={a.type==='crit'?'#f43f5e':'#f59e0b'}/>}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:a.type==='crit'?'#f87171':'#f59e0b', fontFamily:'var(--mono)', marginBottom:4 }}>
              {a.loading ? '—' : (a.n ?? 0).toLocaleString('id')}
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text1)', marginBottom:6 }}>{a.title}</div>
            <p style={{ fontSize:10, color:'var(--text3)', lineHeight:1.6, marginBottom:8 }}>{a.detail}</p>
          </div>
        ))}
      </div>

      {/* Daftar nama untuk crosscheck */}
      <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:4 }}>
          📋 Daftar NIK 9999 — Kepala Keluarga
        </div>
        <CrosscheckTable type="nikKK" title="NIK KK 9999" accentColor="#f43f5e" kecFilter={selectedKec}/>
      </div>
      <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:4 }}>
          📋 Daftar NIK 9999 — Anggota Keluarga
        </div>
        <CrosscheckTable type="nikAK" title="NIK AK 9999" accentColor="#f59e0b" kecFilter={selectedKec}/>
      </div>
    </div>
  );
}

// ── Rekening section ───────────────────────────────────────────────────────
function RekeningSection({ selectedKec }) {
  const { count, loading } = useCrosscheckCount('rekening', selectedKec);
  const n = count ?? 0;
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <CreditCard size={13} color="#f59e0b" strokeWidth={2}/>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text1)' }}>Kepemilikan Rekening</span>
        {loading && <MiniSpinner color="#f59e0b"/>}
        <Badge variant="warn" style={{ marginLeft:'auto' }}>Perlu verifikasi</Badge>
      </div>
      <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
        <div style={{ background:'var(--bg2)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, padding:'14px 18px', minWidth:160 }}>
          <div style={{ fontSize:9, color:'#f59e0b', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700, marginBottom:6 }}>KK tanpa rekening aktif</div>
          <div style={{ fontSize:32, fontWeight:800, color:'#f59e0b', fontFamily:'var(--mono)', lineHeight:1 }}>
            {loading ? '—' : n.toLocaleString('id')}
          </div>
          <div style={{ fontSize:10, color:'var(--text4)', marginTop:6 }}>seluruh AK jawab "Tidak ada" / "Tidak tahu"</div>
        </div>
        <div style={{ flex:1, minWidth:220 }}>
          <p style={{ fontSize:11, color:'var(--text2)', lineHeight:1.7, marginBottom:10 }}>Verifikasi kepemilikan rekening seluruh anggota keluarga.</p>
          <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(245,158,11,0.06)',
            border:'1px solid rgba(245,158,11,0.15)', borderRadius:8, fontSize:10, color:'var(--text3)' }}>
            💡 Opsi rekening aktif: <em>Ya untuk pribadi / Ya untuk usaha / Ya untuk usaha dan pribadi</em>
          </div>
        </div>
      </div>
      <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:4 }}>
          📋 Daftar KK tanpa rekening aktif
        </div>
        <CrosscheckTable type="rekening" title="KK Tanpa Rekening" accentColor="#f59e0b" kecFilter={selectedKec}/>
      </div>
    </div>
  );
}

// ── Tidak Tahu section ─────────────────────────────────────────────────────
function TidakTahuSection({ selectedKec }) {
  const { count, loading } = useCrosscheckCount('tidakTahu', selectedKec);
  const nAK = count ?? 0;
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid rgba(27,63,139,0.2)', borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <HelpCircle size={13} color="var(--blue3)" strokeWidth={2}/>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text1)' }}>Status Pekerjaan "Tidak Tahu"</span>
        {loading && <MiniSpinner color="var(--blue3)"/>}
        <Badge variant="info" style={{ marginLeft:'auto' }}>Data tidak lengkap</Badge>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <div style={{ background:'var(--bg2)', border:`1px solid rgba(27,63,139,0.2)`, borderRadius:10, padding:'10px 16px', flex:1 }}>
          <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:4 }}>KK Terdampak</div>
          <div style={{ fontSize:26, fontWeight:800, color:'var(--blue3)', fontFamily:'var(--mono)' }}>
            {loading ? '—' : nAK.toLocaleString('id')}
          </div>
        </div>
      </div>
      <p style={{ fontSize:11, color:'var(--text2)', lineHeight:1.7, marginBottom:8 }}>Terdapat anggota keluarga atau usaha dengan jawaban "Tidak Tahu" pada rincian tertentu.</p>
      <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:4 }}>
          📋 Daftar AK dengan status pekerjaan "Tidak Tahu"
        </div>
        <CrosscheckTable type="tidakTahu" title="Status Kerja Tidak Tahu" accentColor="var(--blue3)" kecFilter={selectedKec}/>
      </div>
    </div>
  );
}

// ── Anomaly alert card ─────────────────────────────────────────────────────
function AnomalyCard({ item }) {
  const c = item.sev==='crit'
    ? {dot:'#f43f5e',bg:'rgba(244,63,94,0.05)',border:'rgba(244,63,94,0.16)'}
    : item.sev==='warn'
    ? {dot:'#f59e0b',bg:'rgba(245,158,11,0.05)',border:'rgba(245,158,11,0.16)'}
    : {dot:'var(--orange3)',bg:'rgba(232,84,28,0.05)',border:'rgba(232,84,28,0.16)'};
  return (
    <div style={{ display:'flex', gap:14, padding:'13px 15px', background:c.bg, border:`1px solid ${c.border}`, borderRadius:11 }}>
      <div style={{ paddingTop:2 }}><PulseDot color={c.dot} size={8}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:7, marginBottom:5 }}>
          <Badge variant="neutral" style={{fontSize:9}}>{item.category}</Badge>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{item.title}</span>
          <Badge variant={item.sev==='crit'?'crit':item.sev==='warn'?'warn':'info'}>{item.sev==='crit'?'Kritis':item.sev==='warn'?'Perlu cek':'Info'}</Badge>
          <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text4)' }}>{item.ts}</span>
        </div>
        <p style={{ fontSize:11, color:'var(--text2)', lineHeight:1.65, marginBottom:9 }}>{item.detail}</p>
        <div style={{ display:'flex', gap:16 }}>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}><Users size={10} strokeWidth={2}/>{item.petugas}</span>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}><MapPin size={10} strokeWidth={2}/>{item.kec}</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export function AnomalyPage() {
  const { data: stat, loading, error } = useStatistik();

  const { selectedKec } = useKecamatan();

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {[280,280,200,200,200].map((h,i) => <Card key={i}><Skeleton h={h}/></Card>)}
    </div>
  );

  if (error) return (
    <Card accent="crit">
      <div style={{ fontSize:14, color:'#f87171' }}>Gagal memuat data anomali: {error}</div>
    </Card>
  );

  const isFiltered = selectedKec !== 'all';
  const allAnomali = stat?.anomali || [];

  // Filter anomali berdasarkan kecamatan (kalau ada)
  const anomali = isFiltered
    ? allAnomali.filter(a => a.kec === 'Semua kecamatan' || matchKec(a.kec, selectedKec))
    : allAnomali;

  // Pisahkan per kategori
  const anomaliDurasi   = anomali.filter(a => a.category === 'Durasi Anomali');
  const anomaliLainnya  = anomali.filter(a =>
    !['Durasi Anomali','NIK Tidak Valid','Rekening Tidak Aktif','Data Tidak Lengkap'].includes(a.category)
  );
  const crit = anomaliLainnya.filter(a => a.sev === 'crit');
  const warn = anomaliLainnya.filter(a => a.sev === 'warn');

  // Outlier sets (non-durasi)
  const filterOutlierSet = (od) => {
    if (!od || !isFiltered) return od;
    return { ...od, outliers: (od.outliers||[]).filter(o => matchKec(o.kec, selectedKec)) };
  };
  const otherOutlierSets = [
    { data: filterOutlierSet(stat?.outlierPendapatan), title:'Distribusi pendapatan usaha (juta Rp/bulan)' },
    { data: filterOutlierSet(stat?.outlierJumlahAk),   title:'Distribusi jumlah anggota keluarga (orang)' },
  ].filter(s => s.data);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* ── 1. Anomali Durasi ──────────────────────────────────────────── */}
      <Card>
        <SectionTitle icon={Clock} right={<Badge variant="crit">Anomali waktu wawancara</Badge>}>
          Analisis durasi pengisian kuesioner
        </SectionTitle>
        <DurasiAnomalySection stat={stat} selectedKec={selectedKec}/>
      </Card>

      {/* ── 2. NIK 9999 — selalu tampil, data dari isian_se2026 langsung ── */}
      <Card>
        <SectionTitle icon={Fingerprint} right={<Badge variant="crit">Identitas tidak valid</Badge>}>
          Anomali NIK kode 9999
        </SectionTitle>
        <NikSection selectedKec={selectedKec}/>
      </Card>

      {/* ── 3. Rekening ──────────────────────────────────────────────── */}
      <Card>
        <SectionTitle icon={CreditCard} right={<Badge variant="warn">Inklusi keuangan</Badge>}>
          KK tanpa rekening aktif
        </SectionTitle>
        <RekeningSection selectedKec={selectedKec}/>
      </Card>

      {/* ── 4. Tidak Tahu ─────────────────────────────────────────────── */}
      <Card>
        <SectionTitle icon={HelpCircle} right={<Badge variant="info">Data tidak lengkap</Badge>}>
          Status pekerjaan tidak tahu
        </SectionTitle>
        <TidakTahuSection selectedKec={selectedKec}/>
      </Card>

      {/* ── 5. Distribusi statistik lain (pendapatan, jumlah AK) ──────── */}
      {otherOutlierSets.length > 0 && (
        <Card>
          <SectionTitle icon={BarChart2} right={<Badge variant="warn">Analisis distribusi & outlier</Badge>}>
            Distribusi statistik lainnya
          </SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {otherOutlierSets.map(({ data: od, title }) => od && (
              <div key={od.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <AlertTriangle size={12} color="#f59e0b" strokeWidth={2}/>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--text1)' }}>{title}</span>
                  <Badge variant="crit" style={{ marginLeft:'auto' }}>{od.outliers.length} outlier</Badge>
                </div>
                <StatRow data={od}/>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontWeight:600 }}>Box plot</div>
                  {od.q4 > 0
                    ? <BoxPlot data={od}/>
                    : <div style={{ padding:'16px', textAlign:'center', color:'var(--text4)', fontSize:11 }}>Data belum cukup untuk menampilkan boxplot</div>
                  }
                </div>
                <div>
                  <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, fontWeight:600 }}>
                    Distribusi frekuensi <span style={{ color:'#f87171' }}>(merah = zona anomali)</span>
                  </div>
                  <DistChart data={od.dist}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Info jika belum ada data anomali baru ─────────────────── */}
      {!anomali.some(a => ['NIK Tidak Valid','Rekening Tidak Aktif','Data Tidak Lengkap'].includes(a.category)) && (
        <Card>
          <div style={{ padding:'16px', display:'flex', alignItems:'center', gap:12,
                         background:'rgba(27,63,139,0.05)', border:'1px solid rgba(27,63,139,0.15)',
                         borderRadius:10, fontSize:12, color:'var(--text3)' }}>
            <span style={{ fontSize:20 }}>ℹ️</span>
            <div>
              <div style={{ fontWeight:600, color:'var(--text2)', marginBottom:4 }}>
                Anomali NIK 9999, Rekening, dan Status Kerja belum tersedia
              </div>
              <div style={{ fontSize:11 }}>
                Jalankan <code>python upload_to_mongo.py</code> untuk memperbarui data anomali ke MongoDB.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── 6. Alert cards lainnya (KBLI, rejection spike, dll) ──────── */}
      {crit.length > 0 && (
        <Card accent="crit">
          <SectionTitle icon={ShieldAlert} right={<Badge variant="crit">{crit.length} kritis</Badge>}>
            Peringatan kritis — tindak segera
          </SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {crit.map(a => <AnomalyCard key={a.id} item={a}/>)}
          </div>
        </Card>
      )}
      {warn.length > 0 && (
        <Card accent="warn">
          <SectionTitle icon={ShieldAlert} right={<Badge variant="warn">{warn.length} perlu cek</Badge>}>
            Perlu perhatian
          </SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {warn.map(a => <AnomalyCard key={a.id} item={a}/>)}
          </div>
        </Card>
      )}

      {/* ── Daftar anomali responden (SE2026-L) ──────────────────────── */}
      <AnomalyDetailTable
        kecFilter={selectedKec}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}