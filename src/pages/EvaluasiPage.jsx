/**
 * src/pages/EvaluasiPage.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Evaluasi seluruh petugas (Pencacah + Pengawas).
 * Kolom: # | Nama | Kecamatan | Total | Submit | Approved | Rejected | Open | Progress | Avg Durasi/Latensi | Avg/Hari
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, TrendingUp, Clock, CheckCircle, XCircle,
  BarChart2, MapPin, Search, ChevronDown, ChevronUp,
  Shield, ChevronLeft, ChevronRight, FileText, Printer, Download, AlertCircle,
  Star, Inbox,
} from 'lucide-react';
import { Card, SectionTitle, Badge, ProgressBar } from '../components/ui.jsx';
import { useKecamatan } from '../context/KecamatanContext.jsx';
import DesaFilter from '../components/DesaFilter.jsx';
import { PetugasTimeSeriesChart } from '../components/PetugasTimeSeriesChart.jsx';

const TOKEN_KEY = 'ews_token';
const BASE      = () => (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const PAGE_SIZE = 20;
const DETAIL_PAGE_SIZE = 25;

async function apiFetch(path) {
  const res = await fetch(`${BASE()}${path}`, {
    headers: { 'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Animasi counter angka ──────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 600, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  useEffect(() => {
    if (value == null) return;
    const target = parseFloat(value) || 0;
    startRef.current = null;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(+(target * eased).toFixed(decimals));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, decimals]);
  return <>{display.toLocaleString('id')}{suffix}</>;
}

function Skeleton({ h = 80 }) {
  return <div style={{ height: h, borderRadius: 8,
    background: 'linear-gradient(90deg,var(--bg3) 25%,var(--bg4) 50%,var(--bg3) 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>;
}

// ── Grade badge ────────────────────────────────────────────────────────────
const GRADE_CFG = {
  A: { bg:'rgba(46,158,91,0.12)',  border:'rgba(46,158,91,0.35)',  color:'var(--green3)',  label:'A — Unggul' },
  B: { bg:'rgba(232,84,28,0.10)',  border:'rgba(232,84,28,0.35)',  color:'var(--orange3)', label:'B — Baik' },
  C: { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.35)', color:'#f59e0b',        label:'C — Cukup' },
  D: { bg:'rgba(244,63,94,0.10)',  border:'rgba(244,63,94,0.30)',  color:'#f43f5e',        label:'D — Perlu Perhatian' },
};
function GradeBadge({ grade }) {
  const cfg = GRADE_CFG[grade] || GRADE_CFG.D;
  return (
    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700,
                    background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color,
                    fontFamily:'var(--mono)' }}>
      {grade || '?'}
    </span>
  );
}

// ── Perf score gauge (mini arc) ────────────────────────────────────────────
function PerfGauge({ score, grade }) {
  if (score == null) return <span style={{ color:'var(--text4)', fontSize:11 }}>—</span>;
  const cfg = GRADE_CFG[grade] || GRADE_CFG.D;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      <div style={{ width:36, height:5, borderRadius:99, background:'var(--bg4)', overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', borderRadius:99,
                       background:cfg.color, transition:'width 0.6s cubic-bezier(.22,.68,0,1.2)' }}/>
      </div>
      <span style={{ fontSize:10, fontFamily:'var(--mono)', color:cfg.color, fontWeight:600 }}>
        {score}
      </span>
    </div>
  );
}

// ── Paginator ──────────────────────────────────────────────────────────────
function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth:28, height:28, padding:'0 6px', fontSize:11, borderRadius:6,
               border:'1px solid var(--border)',
               background: active ? 'var(--orange)' : disabled ? 'var(--bg3)' : 'var(--bg3)',
               color: active ? '#fff' : disabled ? 'var(--text4)' : 'var(--text2)',
               cursor: disabled ? 'default' : 'pointer', fontFamily:'var(--mono)', fontWeight:active?700:400,
               display:'flex', alignItems:'center', justifyContent:'center' }}>
      {children}
    </button>
  );
}
function Paginator({ page, totalPages, onChange, total, pageSize }) {
  if (totalPages <= 1) return null;
  const start = (page-1)*pageSize+1;
  const end   = Math.min(page*pageSize, total);
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i===1||i===totalPages||Math.abs(i-page)<=1) pages.push(i);
    else if (pages[pages.length-1] !== '...') pages.push('...');
  }
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, flexWrap:'wrap', gap:8 }}>
      <span style={{ fontSize:10, color:'var(--text4)' }}>{start}–{end} dari {total.toLocaleString('id')}</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <PagBtn disabled={page===1} onClick={() => onChange(page-1)}><ChevronLeft size={12}/></PagBtn>
        {pages.map((p,i) => p==='...'
          ? <span key={`e${i}`} style={{ padding:'0 4px', fontSize:11, color:'var(--text4)' }}>…</span>
          : <PagBtn key={p} active={p===page} onClick={() => onChange(p)}>{p}</PagBtn>
        )}
        <PagBtn disabled={page===totalPages} onClick={() => onChange(page+1)}><ChevronRight size={12}/></PagBtn>
      </div>
    </div>
  );
}

// ── Status colours ─────────────────────────────────────────────────────────
const SC = {
  'APPROVED BY Pengawas':'#10b981','COMPLETED BY Admin Kabupaten':'#10b981',
  'SUBMITTED BY Pencacah':'#f59e0b','REJECTED BY Pengawas':'#f43f5e',
  'REVOKED BY Pengawas':'#f43f5e','DRAFT':'var(--blue3)','OPEN':'var(--text4)',
};
const SS = {
  'APPROVED BY Pengawas':'Approved','COMPLETED BY Admin Kabupaten':'Completed',
  'SUBMITTED BY Pencacah':'Submitted','REJECTED BY Pengawas':'Rejected',
  'REVOKED BY Pengawas':'Revoked','DRAFT':'Draft','OPEN':'Open',
};
const ALL_STATUSES = ['APPROVED BY Pengawas','SUBMITTED BY Pencacah','REJECTED BY Pengawas','OPEN','DRAFT'];

// ── Detail sub-SLS ─────────────────────────────────────────────────────────
function DetailPanel({ email, filterKec, filterDesa }) {
  const [data, setData]   = useState([]);
  const [total,setTotal]  = useState(0);
  const [pages,setPages]  = useState(1);
  const [page, setPage]   = useState(1);
  const [status,setStatus]= useState('');
  const [loading,setLoad] = useState(false);

  const fetch_ = useCallback(async (pg=1, st=status) => {
    setLoad(true);
    try {
      const qs = new URLSearchParams({ email, page:pg, limit:DETAIL_PAGE_SIZE });
      if (filterKec)  qs.set('kec',    filterKec);
      if (filterDesa) qs.set('desa',   filterDesa);
      if (st)         qs.set('status', st);
      const r = await apiFetch(`/api/evaluasi/detail?${qs}`);
      setData(r.data); setTotal(r.total); setPages(r.totalPages); setPage(pg);
    } catch { setData([]); }
    finally { setLoad(false); }
  }, [email, filterKec, filterDesa, status]);

  useEffect(() => { fetch_(1, ''); }, [email, filterKec, filterDesa]);
  const handleStatus = s => { setStatus(s); fetch_(1, s); };

  return (
    <div style={{ paddingTop:14 }}>
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
        {['', ...ALL_STATUSES].map(s => (
          <button key={s} onClick={() => handleStatus(s)}
            style={{ padding:'3px 10px', fontSize:10, borderRadius:99, border:'1px solid',
                     borderColor: status===s?'var(--orange3)':'var(--border)',
                     background: status===s?'var(--orange-dim2)':'var(--bg4)',
                     color: status===s?'var(--orange3)':'var(--text3)',
                     cursor:'pointer', fontWeight:status===s?600:400 }}>
            {s ? (SS[s]||s) : 'Semua'}
          </button>
        ))}
      </div>
      {loading ? <Skeleton h={160}/> : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['Desa','SLS','Sub-SLS Code (level6)','Status','Tipe','Pencacah','Tgl Proses'].map(h => (
                  <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:9, fontWeight:700,
                                        color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.07em',
                                        whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length===0
                ? <tr><td colSpan={7} style={{ textAlign:'center',padding:'24px',color:'var(--text4)',fontSize:12 }}>Tidak ada data</td></tr>
                : data.map((d,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)',
                                        background:i%2===0?'transparent':'rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'7px 10px',color:'var(--text2)',whiteSpace:'nowrap',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis' }}>{d.desa}</td>
                    <td style={{ padding:'7px 10px',color:'var(--text3)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{d.slsName}</td>
                    <td style={{ padding:'7px 10px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ fontFamily:'var(--mono)',fontSize:10,color:'var(--orange3)',
                                        background:'var(--orange-dim2)',padding:'1px 6px',borderRadius:4 }}>
                          {d.subSlsCode}
                        </span>
                        <span style={{ color:'var(--text4)',fontSize:10 }}>{d.subSlsName}</span>
                      </div>
                    </td>
                    <td style={{ padding:'7px 10px',whiteSpace:'nowrap' }}>
                      <span style={{ fontSize:10,fontWeight:600,color:SC[d.status]||'var(--text3)',
                                      background:(SC[d.status]||'var(--text4)')+'18',
                                      padding:'2px 7px',borderRadius:99 }}>
                        {SS[d.status]||d.status}
                      </span>
                    </td>
                    <td style={{ padding:'7px 10px',fontSize:10,color:'var(--text4)' }}>
                      {d.isListing?'Listing':`Sample${d.sampleType?` (${d.sampleType})`:''}`}
                    </td>
                    <td style={{ padding:'7px 10px',fontSize:10,color:'var(--text3)',whiteSpace:'nowrap' }}>{d.nama||d.email}</td>
                    <td style={{ padding:'7px 10px',fontSize:10,color:'var(--text4)',fontFamily:'var(--mono)',whiteSpace:'nowrap' }}>
                      {d.dateModified?new Date(d.dateModified).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}):'—'}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
      <Paginator page={page} totalPages={pages} total={total} pageSize={DETAIL_PAGE_SIZE} onChange={pg=>fetch_(pg)}/>
      <div style={{ fontSize:9,color:'var(--text4)',marginTop:6 }}>{total.toLocaleString('id')} total sub-SLS assignment</div>
    </div>
  );
}

// ── Mini stat card ─────────────────────────────────────────────────────────
function Mini({ label, value, color, icon: Icon, animate=false }) {
  return (
    <div style={{ background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',flex:1,minWidth:90 }}>
      <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:5 }}>
        {Icon && <Icon size={10} color={color||'var(--text3)'} strokeWidth={2}/>}
        <span style={{ fontSize:9,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600 }}>{label}</span>
      </div>
      <div style={{ fontSize:17,fontWeight:700,color:color||'var(--text1)',fontFamily:'var(--mono)' }}>
        {animate && value!=null ? <AnimatedNumber value={value}/> : (value??'—')}
      </div>
    </div>
  );
}

// ── Row Pencacah ───────────────────────────────────────────────────────────
function PencacahRow({ p, rank, filterKec, filterDesa }) {
  const [open, setOpen] = useState(false);
  const fc = p.progressScore>=50?'#10b981':p.progressScore>=20?'#f59e0b':'#f43f5e';
  return (
    <>
      <tr onClick={()=>setOpen(v=>!v)}
        style={{ borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background .1s' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',width:28 }}>{rank}</td>
        <td style={{ padding:'9px 8px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:5,flexWrap:'wrap' }}>
            <span style={{ fontSize:11,fontWeight:600,color:'var(--text1)' }}>{p.nama||'—'}</span>
            {p.inaktif && (
              <span
                title={`Tidak ada submit sejak ${p.lastAktifDate||'—'} (${p.gapHariAktif} hari lalu)`}
                style={{ fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:4,
                  background:'rgba(244,63,94,0.12)',color:'#f43f5e',whiteSpace:'nowrap',
                  border:'1px solid rgba(244,63,94,0.3)',cursor:'default' }}>
                {p.gapHariAktif}h idle
              </span>
            )}
          </div>
          <div style={{ fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)' }}>{p.email}</div>
        </td>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text3)',whiteSpace:'nowrap' }}>{p.kecamatan}</td>
        {/* Pengawas */}
        <td style={{ padding:'9px 8px' }}>
          <div style={{ fontSize:10,fontWeight:600,color:'var(--text2)',whiteSpace:'nowrap',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis' }}>
            {p.pengawas?.nama||'—'}
          </div>
          <div style={{ fontSize:8.5,color:'var(--text4)',fontFamily:'var(--mono)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:140 }}>
            {p.pengawas?.email||''}
          </div>
        </td>
        {/* Total = semua assignment yg ditugaskan */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)',textAlign:'right' }}>{p.total}</td>
        {/* Submit = submitted tapi belum diapprove */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f59e0b',textAlign:'right',fontWeight:p.submit>0?600:400 }}>{p.submit||0}</td>
        {/* Approved */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#10b981',fontWeight:600,textAlign:'right' }}>{p.approved}</td>
        {/* Rejected */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f43f5e',textAlign:'right' }}>{p.reject||0}</td>
        {/* Draft = sedang dikerjakan belum submit */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--blue3)',textAlign:'right',fontWeight:p.draft>0?600:400 }}>{p.draft||0}</td>
        {/* Open/belum disentuh */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text4)',textAlign:'right' }}>{p.open||0}</td>
        {/* Progress */}
        <td style={{ padding:'9px 8px',minWidth:100 }}>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ flex:1 }}><ProgressBar pct={p.progressScore ?? p.pctApproved ?? 0} color={fc} height={4}/></div>
            <span style={{ fontSize:9,fontFamily:'var(--mono)',color:fc,fontWeight:600,width:32,textAlign:'right',flexShrink:0 }}>{(p.progressScore ?? p.pctApproved ?? 0)}%</span>
          </div>
        </td>
        {/* KOLOM PERF SCORE + GRADE — uncomment jika diperlukan:
        <td style={{ padding:'9px 8px' }}><PerfGauge score={p.perfScore} grade={p.grade}/></td>
        <td style={{ padding:'9px 8px' }}><GradeBadge grade={p.grade}/></td>
        */}
        <td style={{ padding:'9px 8px' }}>
          {open?<ChevronUp size={11} color="var(--text4)"/>:<ChevronDown size={11} color="var(--text4)"/>}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom:'1px solid var(--border)' }}>
          <td colSpan={14} style={{ padding:'0 10px 16px 40px',background:'rgba(232,84,28,0.02)' }}>
            {/* Performance breakdown */}
            {p.inaktif && (
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'8px 12px',
                             background:'rgba(244,63,94,0.06)',border:'1px solid rgba(244,63,94,0.2)',
                             borderRadius:8 }}>
                <span style={{ fontSize:14 }}>⚠️</span>
                <div>
                  <span style={{ fontSize:10,fontWeight:700,color:'#f43f5e' }}>
                    {p.submit===0 && p.draft===0
                      ? 'Belum pernah ada submit maupun draft!'
                      : `Tidak ada submit/draft selama ${p.gapHariAktif} hari`}
                  </span>
                  <span style={{ fontSize:9,color:'var(--text4)',marginLeft:8 }}>
                    Terakhir submit/draft: {p.lastAktifDate||'—'} · Pengawas mohon lakukan pengecekan
                  </span>
                </div>
              </div>
            )}
            {p.pengawas?.nama && (
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'7px 12px',
                             background:'rgba(27,63,139,0.06)',border:'1px solid rgba(27,63,139,0.15)',
                             borderRadius:8 }}>
                <Shield size={10} color="var(--blue3)" strokeWidth={2}/>
                <div>
                  <span style={{ fontSize:9,color:'var(--text4)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700 }}>Pengawas (PML)</span>
                  <span style={{ fontSize:11,fontWeight:600,color:'var(--text1)',marginLeft:8 }}>{p.pengawas.nama}</span>
                  <span style={{ fontSize:9,color:'var(--text4)',fontFamily:'var(--mono)',marginLeft:6 }}>{p.pengawas.email}</span>
                </div>
              </div>
            )}
            <div style={{ paddingTop:12,display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
              <Mini label="Total Tugas"   value={p.total}                                    icon={BarChart2}  animate/>
              <Mini label="Belum Dikerjakan" value={p.open}    color="var(--text4)"           icon={Inbox}     animate/>
              <Mini label="Draft"         value={p.draft||0}   color="var(--blue3)"            icon={FileText}  animate/>
              <Mini label="Sudah Submit"  value={p.submit}     color="#f59e0b"                icon={Clock}     animate/>
              <Mini label="Approved"      value={p.approved}   color="#10b981"                icon={CheckCircle} animate/>
              <Mini label="Rejected"      value={p.reject}     color="#f43f5e"                icon={XCircle}   animate/>
              {/* MINI PERF SCORE — uncomment jika diperlukan:
              <Mini label="Perf Score" value={p.perfScore!=null?`${p.perfScore}/100`:'—'} color={GRADE_CFG[p.grade]?.color} icon={Star}/>
              */}
            </div>

            {/* BREAKDOWN SKOR PERFORMA — uncomment jika diperlukan:
            {p.perfScore!=null && (
              <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,padding:'10px 12px',
                             background:'var(--bg3)',borderRadius:8,border:'1px solid var(--border)' }}>
                <div style={{ fontSize:9,color:'var(--text4)',width:'100%',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4 }}>
                  Breakdown skor performa
                </div>
                {[
                  { label:'Progress (20%)',  val:p.progressScore, desc:'(appr+sub+rej+draft)/total', color:'var(--orange3)' },
                  { label:'Field (50%)',     val:p.fieldScore,    desc:'(submit+draft)/total',       color:'var(--blue3)' },
                  { label:'Quality (30%)',   val:p.qualityScore,  desc:'submit/(submit+draft)',       color:'#10b981' },
                ].map(s => (
                  <div key={s.label} style={{ flex:1,minWidth:140 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                      <span style={{ fontSize:9,color:s.color,fontWeight:600 }}>{s.label}</span>
                      <span style={{ fontSize:9,fontFamily:'var(--mono)',color:s.color }}>{s.val??'--'}</span>
                    </div>
                    <ProgressBar pct={s.val??0} color={s.color} height={3}/>
                    <div style={{ fontSize:8,color:'var(--text4)',marginTop:2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            )}
            */}
            {/* Time series aktivitas harian */}
            <div style={{ borderTop:'1px solid var(--border)',paddingTop:12,marginBottom:14 }}>
              <PetugasTimeSeriesChart email={p.email} role="Pencacah" nama={p.nama}/>
            </div>
            {/* Detail sub-SLS */}
            <div style={{ borderTop:'1px solid var(--border)',paddingTop:10 }}>
              <div style={{ fontSize:10,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',
                             letterSpacing:'0.07em',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
                <FileText size={10} color="var(--orange3)"/> Detail Sub-SLS Assignment
              </div>
              <DetailPanel email={p.email} filterKec={filterKec!=='all'?filterKec:''} filterDesa={filterDesa}/>
            </div>
            {p.lastActive && <div style={{ fontSize:9,color:'var(--text4)',marginTop:8 }}>Terakhir aktif: {new Date(p.lastActive).toLocaleString('id-ID')}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Row Pengawas ───────────────────────────────────────────────────────────
function PengawasRow({ p, rank, filterKec, filterDesa }) {
  const [open, setOpen] = useState(false);
  const fc = p.pctApproved>=70?'#10b981':p.pctApproved>=40?'#f59e0b':'#f43f5e';
  return (
    <>
      <tr onClick={()=>setOpen(v=>!v)}
        style={{ borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background .1s' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',width:28 }}>{rank}</td>
        <td style={{ padding:'9px 8px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:5,flexWrap:'wrap' }}>
            <span style={{ fontSize:11,fontWeight:600,color:'var(--text1)' }}>{p.nama||'—'}</span>
            {p.inaktif && (
              <span
                title={`Tidak ada submit sejak ${p.lastAktifDate||'—'} (${p.gapHariAktif} hari lalu)`}
                style={{ fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:4,
                  background:'rgba(244,63,94,0.12)',color:'#f43f5e',whiteSpace:'nowrap',
                  border:'1px solid rgba(244,63,94,0.3)',cursor:'default' }}>
                {p.gapHariAktif}h idle
              </span>
            )}
          </div>
          <div style={{ fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)' }}>{p.email}</div>
        </td>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text3)',whiteSpace:'nowrap' }}>{p.kecamatan}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)',textAlign:'right' }}>{p.total}</td>
        {/* Submit = yg masih menunggu diapprove */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f59e0b',textAlign:'right',fontWeight:p.submit>0?600:400 }}>{p.submit||0}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#10b981',fontWeight:600,textAlign:'right' }}>{p.approved}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f43f5e',textAlign:'right' }}>{p.reject||0}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--blue3)',textAlign:'right',fontWeight:p.draft>0?600:400 }}>{p.draft||0}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text4)',textAlign:'right' }}>{p.open||0}</td>
        <td style={{ padding:'9px 8px',minWidth:100 }}>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ flex:1 }}><ProgressBar pct={p.progressScore ?? p.pctApproved ?? 0} color={fc} height={4}/></div>
            <span style={{ fontSize:9,fontFamily:'var(--mono)',color:fc,fontWeight:600,width:32,textAlign:'right',flexShrink:0 }}>{(p.progressScore ?? p.pctApproved ?? 0)}%</span>
          </div>
        </td>
        {/* KOLOM PERF SCORE + GRADE — uncomment jika diperlukan:
        <td style={{ padding:'9px 8px' }}><PerfGauge score={p.perfScore} grade={p.grade}/></td>
        <td style={{ padding:'9px 8px' }}><GradeBadge grade={p.grade}/></td>
        */}
        <td style={{ padding:'9px 8px' }}>
          {open?<ChevronUp size={11} color="var(--text4)"/>:<ChevronDown size={11} color="var(--text4)"/>}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom:'1px solid var(--border)' }}>
          <td colSpan={14} style={{ padding:'0 10px 16px 40px',background:'rgba(27,63,139,0.02)' }}>
            <div style={{ paddingTop:12,display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
              <Mini label="Total Diawasi"   value={p.total}                                        icon={BarChart2}   animate/>
              <Mini label="Belum Dikerjakan" value={p.open}     color="var(--text4)"               icon={Inbox}       animate/>
              <Mini label="Draft"            value={p.draft||0} color="var(--blue3)"               icon={FileText}    animate/>
              <Mini label="Menunggu Approve" value={p.submit}   color="#f59e0b"                    icon={Clock}       animate/>
              <Mini label="Approved"          value={p.approved} color="#10b981"                   icon={CheckCircle} animate/>
              <Mini label="Ditolak"           value={p.reject}   color="#f43f5e"                   icon={XCircle}     animate/>
              {/* MINI PERF SCORE — uncomment jika diperlukan:
              <Mini label="Perf Score" value={p.perfScore!=null?`${p.perfScore}/100`:'—'} color={GRADE_CFG[p.grade]?.color} icon={Star}/>
              */}
            </div>

            {/* BREAKDOWN SKOR PERFORMA — uncomment jika diperlukan:
            {p.perfScore!=null && (
              <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,padding:'10px 12px',
                             background:'var(--bg3)',borderRadius:8,border:'1px solid var(--border)' }}>
                <div style={{ fontSize:9,color:'var(--text4)',width:'100%',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4 }}>
                  Breakdown skor performa
                </div>
                {[
                  { label:'Decision Rate (50%)', val:p.decisionRate,  desc:'(appr+rej)/(sub+appr+rej)', color:'var(--orange3)' },
                  { label:'Approval Rate (30%)', val:p.approvalRate,  desc:'approved/(appr+rej)',        color:'#10b981' },
                ].map(s => (
                  <div key={s.label} style={{ flex:1,minWidth:140 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                      <span style={{ fontSize:9,color:s.color,fontWeight:600 }}>{s.label}</span>
                      <span style={{ fontSize:9,fontFamily:'var(--mono)',color:s.color }}>{s.val??'--'}</span>
                    </div>
                    <ProgressBar pct={s.val??0} color={s.color} height={3}/>
                    <div style={{ fontSize:8,color:'var(--text4)',marginTop:2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            )}
            */}
            {/* Time series aktivitas harian pengawas */}
            <div style={{ borderTop:'1px solid var(--border)',paddingTop:12,marginBottom:14 }}>
              <PetugasTimeSeriesChart email={p.email} role="Pengawas" nama={p.nama}/>
            </div>
            <div style={{ borderTop:'1px solid var(--border)',paddingTop:10 }}>
              <div style={{ fontSize:10,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
                <FileText size={10} color="var(--blue3)"/> Detail Sub-SLS yang Diawasi
              </div>
              <DetailPanel email={p.email} filterKec={filterKec!=='all'?filterKec:''} filterDesa={filterDesa}/>
            </div>
            {p.lastActive && <div style={{ fontSize:9,color:'var(--text4)',marginTop:8 }}>Terakhir aktif: {new Date(p.lastActive).toLocaleString('id-ID')}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Summary card animasi ───────────────────────────────────────────────────
function SumCard({ label, value, sub, color, icon: Icon }) {
  return (
    <Card>
      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
        <Icon size={11} color={color} strokeWidth={2}/>
        <span style={{ fontSize:9,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em' }}>{label}</span>
      </div>
      <div style={{ fontSize:24,fontWeight:700,color,fontFamily:'var(--mono)' }}>
        <AnimatedNumber value={value} duration={800}/>
      </div>
      {sub && <div style={{ fontSize:10,color:'var(--text4)',marginTop:4 }}>{sub}</div>}
    </Card>
  );
}

// ── Generate PDF Evaluasi (jsPDF — download langsung) ──────────────────────
async function generatePDF({ activeTab, filtered, summary }) {
  const isPengawas = activeTab === 'pengawas';
  const roleLabel  = isPengawas ? 'Pengawas' : 'Pencacah';
  const snap       = summary?.snapshotAt?.slice(0,10) || new Date().toISOString().slice(0,10);
  const GRADE_LABEL = { A:'Unggul', B:'Baik', C:'Cukup', D:'Perlu Perhatian' };

  // Load jsPDF dari CDN
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  if (!window.jspdf?.jsPDF) {
    alert('Gagal memuat library PDF. Periksa koneksi internet.'); return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();   // 297
  const H   = doc.internal.pageSize.getHeight();  // 210
  const M   = 12;  // margin
  const COL = W - 2 * M;

  // ── Warna ────────────────────────────────────────────────────────────────
  const ORANGE  = [232, 84, 28];
  const BLUE    = [27, 63, 139];
  const GREEN   = [16, 185, 129];
  const YELLOW  = [245, 158, 11];
  const RED     = [244, 63, 94];
  const LGRAY   = [243, 244, 246];
  const MGRAY   = [229, 231, 235];
  const DGRAY   = [55, 65, 81];
  const WHITE   = [255, 255, 255];

  const GRADE_COLOR = { A: GREEN, B: ORANGE, C: YELLOW, D: RED };

  // Helper
  const setFill   = (rgb) => doc.setFillColor(...rgb);
  const setTxt    = (rgb) => doc.setTextColor(...rgb);
  const setFont   = (sz, style='normal') => { doc.setFontSize(sz); doc.setFont('helvetica', style); };

  let y = 0;

  // ── Header bar ───────────────────────────────────────────────────────────
  const drawHeader = (pageNum) => {
    setFill(ORANGE); doc.rect(0, 0, W, 14, 'F');
    setTxt(WHITE); setFont(8, 'bold');
    doc.text(`EWS SE2026 — Laporan Evaluasi ${roleLabel}`, M, 9);
    setFont(7);
    doc.text(`BPS Kab. Padang Lawas Utara  |  ${snap}`, W - M, 9, { align: 'right' });
    // Footer
    setFill(LGRAY); doc.rect(0, H - 10, W, 10, 'F');
    setTxt(DGRAY); setFont(6.5);
    doc.text('Dokumen ini bersifat rahasia — hanya untuk lingkungan internal BPS Kab. Padang Lawas Utara', M, H - 4);
    setFont(7, 'bold');
    doc.text(`Halaman ${pageNum}`, W - M, H - 4, { align: 'right' });
  };

  // ── Halaman 1: Cover + Summary ───────────────────────────────────────────
  drawHeader(1);
  y = 20;

  setTxt(ORANGE); setFont(18, 'bold');
  doc.text(`LAPORAN EVALUASI ${roleLabel.toUpperCase()}`, M, y); y += 7;

  setTxt(BLUE); setFont(10, 'bold');
  doc.text('Sensus Ekonomi 2026 (SE2026)', M, y); y += 5;

  setTxt(DGRAY); setFont(8);
  doc.text(`BPS Kabupaten Padang Lawas Utara  |  Snapshot: ${snap}  |  Total ${roleLabel}: ${filtered.length}`, M, y); y += 8;

  // Garis
  doc.setDrawColor(...MGRAY); doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y); y += 6;

  // Summary boxes
  const s = summary || {};
  const boxes = [
    ['Total Assignment', (s.totalAssignment||0).toLocaleString('id'), DGRAY],
    ['Approved',         (s.approved||0).toLocaleString('id'),        GREEN],
    ['Submit',           (s.submit||0).toLocaleString('id'),           YELLOW],
    ['Rejected',         (s.reject||0).toLocaleString('id'),           RED],
    ['Draft',            (s.draft||0).toLocaleString('id'),            BLUE],
    ['Open',             (s.open||0).toLocaleString('id'),             [156,163,175]],
  ];
  const bW = COL / boxes.length;
  boxes.forEach(([label, val, color], i) => {
    const bx = M + i * bW;
    setFill(LGRAY); doc.roundedRect(bx, y, bW - 2, 16, 2, 2, 'F');
    setTxt(color); setFont(13, 'bold');
    doc.text(val, bx + bW/2 - 1, y + 8, { align: 'center' });
    setTxt([156,163,175]); setFont(6.5);
    doc.text(label, bx + bW/2 - 1, y + 13, { align: 'center' });
  });
  y += 22;

  // ── Tabel data — langsung di halaman yang sama ─────────────────────────
  const cols = isPengawas
    ? [
        { h:'#',        w:8,  key: (_,i) => i+1,                    align:'center' },
        { h:'Nama',     w:42, key: p => p.nama||'—' },
        { h:'Kec.',     w:28, key: p => p.kecamatan||'—' },
        { h:'Total',    w:16, key: p => p.total||0,                  align:'right' },
        { h:'Approved', w:18, key: p => p.approved||0,               align:'right', color: GREEN },
        { h:'Submit',   w:16, key: p => p.submit||0,                 align:'right', color: YELLOW },
        { h:'Rejected', w:16, key: p => p.reject||0,                 align:'right', color: RED },
        { h:'Draft',    w:14, key: p => p.draft||0,                  align:'right', color: BLUE },
        { h:'Open',     w:14, key: p => p.open||0,                   align:'right' },
        // Kolom Progress dihapus dari export (tidak ditampilkan ke petugas)
        { h:'Avg/Hari', w:20, key: p => p.avgPerDay?.total??'—',     align:'right', color: ORANGE },
      ]
    : [
        { h:'#',        w:8,  key: (_,i) => i+1,                    align:'center' },
        { h:'Nama',     w:36, key: p => p.nama||'—' },
        { h:'Kec.',     w:24, key: p => p.kecamatan||'—' },
        { h:'Pengawas', w:30, key: p => p.pengawas?.nama||'—' },
        { h:'Total',    w:14, key: p => p.total||0,                  align:'right' },
        { h:'Approved', w:16, key: p => p.approved||0,               align:'right', color: GREEN },
        { h:'Submit',   w:14, key: p => p.submit||0,                 align:'right', color: YELLOW },
        { h:'Rejected', w:14, key: p => p.reject||0,                 align:'right', color: RED },
        { h:'Draft',    w:12, key: p => p.draft||0,                  align:'right', color: BLUE },
        { h:'Open',     w:12, key: p => p.open||0,                   align:'right' },
        // Kolom Progress dihapus dari export (tidak ditampilkan ke petugas)
        { h:'Avg/Hari', w:18, key: p => p.avgPerDay?.total??'—',     align:'right', color: ORANGE },
      ];

  const ROW_H    = 7;
  const HEAD_H   = 8;
  let   pageNum  = 1;  // halaman pertama sudah ada (cover+tabel)

  const drawTableHeader = () => {
    setFill(isPengawas ? BLUE : ORANGE);
    doc.rect(M, y, COL, HEAD_H, 'F');
    setTxt(WHITE); setFont(6.5, 'bold');
    let x = M;
    cols.forEach(c => {
      doc.text(c.h, x + c.w/2, y + 5.5, { align: 'center' });
      x += c.w;
    });
    y += HEAD_H;
  };

  // Judul tabel
  y += 2;
  doc.setDrawColor(...MGRAY); doc.line(M, y, W - M, y); y += 5;
  setTxt(isPengawas ? BLUE : ORANGE); setFont(9, 'bold');
  doc.text(`Data ${roleLabel} (${filtered.length} orang)`, M, y); y += 5;
  drawTableHeader();

  filtered.forEach((p, idx) => {
    // Halaman baru jika perlu
    if (y + ROW_H > H - 14) {
      doc.addPage(); pageNum++;
      drawHeader(pageNum);
      y = 18;
      drawTableHeader();
    }

    const isEven = idx % 2 === 0;
    setFill(isEven ? WHITE : LGRAY);
    doc.rect(M, y, COL, ROW_H, 'F');

    // Border bawah
    doc.setDrawColor(...MGRAY); doc.setLineWidth(0.1);
    doc.line(M, y + ROW_H, M + COL, y + ROW_H);

    let x = M;
    cols.forEach(c => {
      const val = String(typeof c.key === 'function' ? c.key(p, idx) : '');
      const clr = c.color || DGRAY;
      setTxt(clr); setFont(6.5, c.color ? 'bold' : 'normal');
      const align = c.align || 'left';
      const tx = align === 'right' ? x + c.w - 1.5
               : align === 'center' ? x + c.w / 2
               : x + 1.5;
      // Truncate panjang teks
      const maxW = c.w - 3;
      const txt  = doc.getTextWidth(val) > maxW
        ? val.slice(0, Math.floor(val.length * maxW / doc.getTextWidth(val)) - 1) + '…'
        : val;
      doc.text(txt, tx, y + 4.8, { align });
      x += c.w;
    });
    y += ROW_H;
  });

  // ── Keterangan ───────────────────────────────────────────────────────────
  if (y + 14 > H - 14) { doc.addPage(); pageNum++; drawHeader(pageNum); y = 18; }
  y += 4;
  doc.setDrawColor(...MGRAY); doc.line(M, y, W - M, y); y += 4;
  setTxt([156,163,175]); setFont(6.5);
  doc.text(
    'Avg/Hari = total tugas dikerjakan (approved+submit+rejected+draft) / hari kalender sejak 15 Juni.',
    M, y
  );

  // ── Download ──────────────────────────────────────────────────────────────
  const fname = `evaluasi_${isPengawas?'pengawas':'pencacah'}_se2026_${snap}.pdf`;
  doc.save(fname);
}


// ── Generate Excel Evaluasi (CSV — tanpa library eksternal) ───────────────
function generateExcel({ activeTab, filtered, summary, isPengawas }) {
  const roleLabel   = isPengawas ? 'Pengawas' : 'Pencacah';
  const snap        = summary?.snapshotAt?.slice(0,10) || new Date().toISOString().slice(0,10);
  const GRADE_LABEL = { A:'Unggul', B:'Baik', C:'Cukup', D:'Perlu Perhatian' };

  // Escape nilai agar aman di CSV
  const esc = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row  = cols => cols.map(esc).join(',');
  const rows = arr  => arr.map(row).join('\n');

  // ── Sheet 1: Data Petugas ─────────────────────────────────────────────
  const headers1 = [
    'No','Nama','Email','Kecamatan',
    ...(!isPengawas ? ['Pengawas (PML)','Email Pengawas'] : []),
    'Total','Approved','Submit',
    'Rejected','Draft','Open','Avg per Hari (total)',
    // KOLOM PROGRESS — dikecualikan dari export (tidak ditampilkan ke petugas)
    // 'Progress (%)',
    // KOLOM PERF SCORE + GRADE — uncomment jika diperlukan:
    // 'Perf Score','Grade','Keterangan Grade',
  ];
  const data1 = filtered.map((p, i) => {
    const avg  = p.avgPerDay || {};
    const avgT = ((avg.approved||0)+(avg.submitted||0)+(avg.rejected||0)+(avg.draft||0)).toFixed(2);
    return [
      i+1, p.nama||'', p.email||'', p.kecamatan||'',
      ...(!isPengawas ? [p.pengawas?.nama||'—', p.pengawas?.email||'—'] : []),
      p.total||0, p.approved||0, p.submit||0, p.reject||0, p.draft||0, p.open||0,
      // Progress dihapus dari export
      +avgT||'',

    ];
  });

  // ── Sheet 2: Ringkasan per Kecamatan ─────────────────────────────────
  const kecMap = {};
  filtered.forEach(p => {
    const kec = p.kecamatan || '—';
    if (!kecMap[kec]) kecMap[kec] = {n:0,total:0,approved:0,submit:0,reject:0,draft:0,open:0,scoreSum:0};
    kecMap[kec].n++;
    ['total','approved','submit','reject','draft','open'].forEach(f => kecMap[kec][f] += p[f]||0);
    kecMap[kec].scoreSum += p.perfScore||0;
  });
  const headers2 = ['Kecamatan','Jumlah PCL','Total','Approved','Submit','Rejected','Draft','Open','Progress (%)','Avg Score'];
  const data2 = Object.entries(kecMap).sort(([a],[b]) => a.localeCompare(b)).map(([kec,k]) => [
    kec, k.n, k.total, k.approved, k.submit, k.reject, k.draft, k.open,
    k.total ? ((k.approved+k.submit)/k.total*100).toFixed(1) : 0,
    k.n ? (k.scoreSum/k.n).toFixed(1) : 0,
  ]);

  // Gabung 2 sheet dalam 1 CSV dengan separator baris kosong
  const csv = [
    `=== DATA ${roleLabel.toUpperCase()} ===`,
    rows([headers1, ...data1]),
    '',
    '=== RINGKASAN PER KECAMATAN ===',
    rows([headers2, ...data2]),
  ].join('\n');

  // Download dengan BOM UTF-8 agar nama Indonesia terbaca di Excel
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `evaluasi_${roleLabel.toLowerCase()}_se2026_${snap}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}


// ── InaktifSection — pencacah belum submit N hari ─────────────────────────
function InaktifSection({ threshold = 2, kecamatan = 'all' }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [days,    setDays]    = useState(threshold);
  const [snap,    setSnap]    = useState('');
  const [filter,  setFilter]  = useState('all'); // 'all' | 'never' | 'gap'
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [sortBy,    setSortBy]    = useState('progressScore');
  const [sortDir,   setSortDir]   = useState('desc');
  const PAGE_SIZE = 10;

  const toggleSortI = (col) => {
    if (sortBy === col) setSortDir(d => d==='desc'?'asc':'desc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  };
  const SII = ({ col }) => col
    ? sortBy===col
      ? <span style={{ fontSize:8,color:'#f43f5e',marginLeft:3 }}>{sortDir==='desc'?'▼':'▲'}</span>
      : <span style={{ fontSize:8,color:'var(--text4)',marginLeft:3,opacity:0.45 }}>⇅</span>
    : null;
  const HI = ({ label, col, right }) => (
    <th onClick={col?()=>toggleSortI(col):undefined}
      style={{ padding:'8px 10px',fontSize:8,fontWeight:700,color:'#fff',
               textAlign:right?'right':'left',textTransform:'uppercase',
               letterSpacing:'0.07em',whiteSpace:'nowrap',
               cursor:col?'pointer':'default',userSelect:'none' }}>
      {label}<SII col={col}/>
    </th>
  );

  const load = async (d) => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/evaluasi/inaktif?days=${d}${kecamatan!=='all'?'&kec='+encodeURIComponent(kecamatan):''}`);
      setData(r.data || []);
      setSnap(r.snap || '');
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(days); }, [kecamatan]);

  // Reset page saat filter/search berubah
  useEffect(() => { setPage(1); }, [filter, search, days, sortBy, sortDir, kecamatan]);

  const PCT_COLOR = (pct) =>
    pct >= 50 ? '#10b981' : pct >= 20 ? '#f59e0b' : '#f43f5e';

  const displayed = data.filter(p => {
    const matchFilter =
      filter === 'all'   ? true :
      filter === 'never' ? p.neverSubmit :
                           !p.neverSubmit;
    if (!matchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.nama||'').toLowerCase().includes(q)
          || (p.email||'').toLowerCase().includes(q)
          || (p.kecamatan||'').toLowerCase().includes(q)
          || (p.pengawas||'').toLowerCase().includes(q);
    }
    return true;
  });

  // Sort untuk tab tidak aktif
  const sortedInaktif = [...displayed].sort((a,b) => {
    const d = sortDir==='desc'?-1:1;
    if (sortBy==='progressScore') return d*((b.progressScore??0)-(a.progressScore??0));
    if (sortBy==='gapHari')       return d*((b.gapHari??0)-(a.gapHari??0));
    if (sortBy==='submit')        return d*((b.submit??0)-(a.submit??0));
    if (sortBy==='approved')      return d*((b.approved??0)-(a.approved??0));
    if (sortBy==='total')         return d*((b.total??0)-(a.total??0));
    if (sortBy==='nama')          return d*(a.nama||'').localeCompare(b.nama||'','id');
    if (sortBy==='kecamatan')     return d*(a.kecamatan||'').localeCompare(b.kecamatan||'','id');
    if (sortBy==='pengawas')      return d*(a.pengawas||'').localeCompare(b.pengawas||'','id');
    if (sortBy==='lastSubmitDraftDate') return d*(a.lastSubmitDraftDate||'').localeCompare(b.lastSubmitDraftDate||'');
    return 0;
  });
  const totalPages = Math.ceil(sortedInaktif.length / PAGE_SIZE);
  const paginated  = sortedInaktif.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11,color:'var(--text4)',marginBottom:2 }}>
            Data per snapshot: <b style={{ color:'var(--text2)' }}>{snap||'—'}</b>
            {' · '}Otomatis diperbarui setiap kali data di-upload ke MongoDB
          </div>
          <div style={{ fontSize:10,color:'var(--text4)',display:'flex',gap:8,
            flexWrap:'wrap',alignItems:'center' }}>
            <span>Pencacah tidak ada submit/draft dalam N hari terakhir</span>
            {kecamatan !== 'all' && (
              <span style={{ fontWeight:700,color:'var(--orange3)',padding:'1px 8px',
                borderRadius:5,background:'var(--orange-dim2)',fontSize:10 }}>
                🗂 {kecamatan}
              </span>
            )}
          </div>
        </div>

        <div style={{ display:'flex',alignItems:'center',gap:12,flexWrap:'wrap' }}>
          {/* Threshold selector */}
          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
            <span style={{ fontSize:11,color:'var(--text3)' }}>Idle selama</span>
            {[1,2,3,5,7].map(n => (
              <button key={n} onClick={() => { setDays(n); load(n); }}
                style={{ padding:'4px 10px',fontSize:11,fontWeight:days===n?700:400,
                  borderRadius:6,border:`1px solid ${days===n?'#f43f5e':'var(--border)'}`,
                  background:days===n?'rgba(244,63,94,0.1)':'var(--bg3)',
                  color:days===n?'#f43f5e':'var(--text3)',cursor:'pointer' }}>
                {n}h
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position:'relative' }}>
            <Search size={11} style={{ position:'absolute',left:8,top:'50%',
              transform:'translateY(-50%)',color:'var(--text4)',pointerEvents:'none' }}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama / email / kecamatan…"
              style={{ padding:'5px 10px 5px 26px',fontSize:11,background:'var(--bg3)',
                border:'1px solid var(--border)',borderRadius:7,color:'var(--text1)',
                outline:'none',fontFamily:'var(--font)',width:220 }}/>
            {search && (
              <button onClick={()=>setSearch('')}
                style={{ position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',color:'var(--text4)',
                  fontSize:14,lineHeight:1 }}>×</button>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div style={{ display:'flex',gap:10,marginBottom:14,flexWrap:'wrap' }}>
          {/* Total */}
          <div style={{ padding:'10px 16px',background:'rgba(244,63,94,0.07)',
            border:'1px solid rgba(244,63,94,0.2)',borderRadius:8,minWidth:130 }}>
            <div style={{ fontSize:24,fontWeight:800,color:'#f43f5e',fontFamily:'var(--mono)' }}>
              {data.length}
            </div>
            <div style={{ fontSize:9,color:'var(--text4)',marginTop:2 }}>total perlu perhatian</div>
          </div>
          {/* Belum pernah submit/draft */}
          <div style={{ padding:'10px 16px',background:'rgba(239,68,68,0.07)',
            border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,minWidth:130,cursor:'pointer',
            outline:filter==='never'?'2px solid #ef4444':'none' }}
            onClick={()=>setFilter(f=>f==='never'?'all':'never')}>
            <div style={{ fontSize:24,fontWeight:800,color:'#ef4444',fontFamily:'var(--mono)' }}>
              {data.filter(p=>p.neverSubmit).length}
            </div>
            <div style={{ fontSize:9,color:'var(--text4)',marginTop:2 }}>
              ⛔ belum pernah submit/draft
            </div>
          </div>
          {/* Tidak submit N hari */}
          <div style={{ padding:'10px 16px',background:'rgba(251,146,60,0.07)',
            border:'1px solid rgba(251,146,60,0.25)',borderRadius:8,minWidth:130,cursor:'pointer',
            outline:filter==='gap'?'2px solid #fb923c':'none' }}
            onClick={()=>setFilter(f=>f==='gap'?'all':'gap')}>
            <div style={{ fontSize:24,fontWeight:800,color:'#fb923c',fontFamily:'var(--mono)' }}>
              {data.filter(p=>!p.neverSubmit).length}
            </div>
            <div style={{ fontSize:9,color:'var(--text4)',marginTop:2 }}>
              ⚠ tidak submit/draft {days}+ hari
            </div>
          </div>
          {data.length > 0 && (
            <div style={{ padding:'10px 16px',background:'var(--bg3)',
              border:'1px solid var(--border)',borderRadius:8,flex:1 }}>
              <div style={{ fontSize:9,color:'var(--text4)',fontWeight:700,textTransform:'uppercase',
                letterSpacing:'0.07em',marginBottom:6 }}>Distribusi per kecamatan</div>
              {Object.entries(
                data.reduce((acc, p) => {
                  acc[p.kecamatan] = (acc[p.kecamatan]||0) + 1;
                  return acc;
                }, {})
              ).sort((a,b) => b[1]-a[1]).map(([kec,n]) => (
                <span key={kec} style={{ display:'inline-flex',alignItems:'center',gap:4,
                  marginRight:8,marginBottom:4,padding:'2px 8px',borderRadius:99,
                  background:'var(--bg4)',fontSize:10,color:'var(--text2)' }}>
                  {kec} <b style={{ color:'#f43f5e' }}>{n}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabel */}
      {loading ? (
        <div style={{ textAlign:'center',padding:'32px',color:'var(--text4)' }}>
          Memuat data...
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign:'center',padding:'40px 0' }}>
          <div style={{ fontSize:32,marginBottom:8 }}>✅</div>
          <div style={{ fontSize:13,fontWeight:600,color:'#10b981' }}>
            {filter==='all'
              ? `Semua pencacah sudah submit/draft dalam ${days} hari terakhir`
              : 'Tidak ada pencacah di kategori ini'}
          </div>
          <div style={{ fontSize:11,color:'var(--text4)',marginTop:4 }}>
            Berdasarkan snapshot {snap}
          </div>
        </div>
      ) : (
        <div style={{ overflowX:'auto',borderRadius:8,border:'1px solid var(--border)' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:11 }}>
            <thead>
              <tr style={{ background:'#f43f5e',borderBottom:'1px solid var(--border)' }}>
                <HI label="#"/>
                <HI label="Nama"            col="nama"/>
                <HI label="Kecamatan"       col="kecamatan"/>
                <HI label="Pengawas (PML)"  col="pengawas"/>
                <HI label="Total"           col="total"              right/>
                <HI label="Submit"          col="submit"             right/>
                <HI label="Draft"                                    right/>
                <HI label="Approved"        col="approved"           right/>
                <HI label="Terakhir"        col="lastSubmitDraftDate"/>
                <HI label="Status"          col="gapHari"/>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p, i) => {
                const globalIdx = (page-1)*PAGE_SIZE + i;
                return (
                <tr key={p.email}
                  style={{ borderBottom:'1px solid var(--border)',
                    background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.018)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background=
                    i%2===0?'transparent':'rgba(255,255,255,0.018)'}
                >
                  <td style={{ padding:'8px 10px',color:'var(--text4)',fontSize:10,
                    fontFamily:'var(--mono)' }}>{globalIdx+1}</td>
                  <td style={{ padding:'8px 10px',minWidth:160 }}>
                    <div style={{ fontWeight:600,color:'var(--text1)' }}>{p.nama}</div>
                    <div style={{ fontSize:9,color:'var(--text4)',fontFamily:'var(--mono)' }}>
                      {p.email}
                    </div>
                  </td>
                  <td style={{ padding:'8px 10px',color:'var(--text3)',whiteSpace:'nowrap' }}>
                    {p.kecamatan}
                  </td>
                  <td style={{ padding:'8px 10px',minWidth:130 }}>
                    <div style={{ fontSize:10,fontWeight:600,color:'var(--blue3)' }}>
                      {p.pengawas}
                    </div>
                    <div style={{ fontSize:8,color:'var(--text4)',fontFamily:'var(--mono)' }}>
                      {p.pengawasEmail}
                    </div>
                  </td>
                  <td style={{ padding:'8px 10px',textAlign:'right',fontFamily:'var(--mono)',
                    fontSize:10 }}>{p.total}</td>
                  <td style={{ padding:'8px 10px',textAlign:'right',fontFamily:'var(--mono)',
                    fontSize:10,color:p.submit===0?'var(--text4)':'#f59e0b',
                    fontWeight:p.submit>0?600:400 }}>{p.submit}</td>
                  <td style={{ padding:'8px 10px',textAlign:'right',fontFamily:'var(--mono)',
                    fontSize:10,color:p.draft>0?'var(--blue3)':'var(--text4)',
                    fontWeight:p.draft>0?600:400 }}>{p.draft||0}</td>
                  <td style={{ padding:'8px 10px',textAlign:'right',fontFamily:'var(--mono)',
                    fontSize:10,color:'#10b981',fontWeight:600 }}>{p.approved}</td>
                  <td style={{ padding:'8px 10px',fontSize:10,color:'var(--text3)',
                    fontFamily:'var(--mono)',whiteSpace:'nowrap' }}>
                    {p.lastSubmitDraftDate||'—'}
                  </td>
                  <td style={{ padding:'8px 10px',textAlign:'center',whiteSpace:'nowrap' }}>
                    {p.neverSubmit
                      ? <span style={{ padding:'2px 8px',borderRadius:99,fontSize:9,fontWeight:700,
                          background:'rgba(239,68,68,0.12)',color:'#ef4444',
                          border:'1px solid rgba(239,68,68,0.3)' }}>
                          ⛔ Belum pernah
                        </span>
                      : <span style={{ padding:'2px 8px',borderRadius:99,fontSize:9,fontWeight:700,
                          background:'rgba(251,146,60,0.12)',color:'#fb923c',
                          border:'1px solid rgba(251,146,60,0.25)' }}>
                          ⚠ {p.gapHari} hari idle
                        </span>
                    }
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginator + info */}
        {sortedInaktif.length > 0 && (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
            marginTop:12,flexWrap:'wrap',gap:8 }}>
            <div style={{ fontSize:10,color:'var(--text4)' }}>
              {search
                ? `${sortedInaktif.length} hasil untuk "${search}"`
                : `${sortedInaktif.length} pencacah perlu perhatian`
              }{sortedInaktif.length > PAGE_SIZE && ` · hal. ${page} / ${totalPages}`}
            </div>
            {totalPages > 1 && (
              <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  style={{ padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',
                    border:'1px solid var(--border)',background:'var(--bg3)',
                    color:page===1?'var(--text4)':'var(--text2)' }}>‹</button>
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(n=>n===1||n===totalPages||Math.abs(n-page)<=1)
                  .reduce((acc,n,i,arr)=>{
                    if(i>0&&n-arr[i-1]>1) acc.push('…');
                    acc.push(n); return acc;
                  },[])
                  .map((n,i)=> n==='…'
                    ? <span key={`e${i}`} style={{ padding:'0 4px',color:'var(--text4)',fontSize:11 }}>…</span>
                    : <button key={n} onClick={()=>setPage(n)}
                        style={{ padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',
                          border:`1px solid ${page===n?'#f43f5e':'var(--border)'}`,
                          background:page===n?'rgba(244,63,94,0.1)':'var(--bg3)',
                          color:page===n?'#f43f5e':'var(--text2)',fontWeight:page===n?700:400 }}>
                        {n}
                      </button>
                  )}
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  style={{ padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',
                    border:'1px solid var(--border)',background:'var(--bg3)',
                    color:page===totalPages?'var(--text4)':'var(--text2)' }}>›</button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export function EvaluasiPage() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState('');
  // Persist tab ke URL hash (#pencacah / #pengawas) agar tidak reset saat refresh
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    return hash === 'pengawas' ? 'pengawas' : 'pencacah';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sortBy,    setSortBy]    = useState('perfScore');
  const [sortDir,   setSortDir]   = useState('desc');
  const [page,      setPage]      = useState(1);
  const [filterDesa,setFilterDesa]= useState('');
  const [desaList,  setDesaList]  = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { selectedKec } = useKecamatan();  // HARUS sebelum any early return

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/evaluasi')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { setPage(1); setFilterDesa(''); setSortBy('perfScore'); setSortDir('desc'); }, [activeTab, selectedKec]);

  useEffect(() => {
    if (!data) return;
    const kec = selectedKec !== 'all' ? selectedKec : '';
    if (!kec) { setDesaList([]); setFilterDesa(''); return; }
    const src = activeTab==='pencacah' ? (data.pencacah||[]) : (data.pengawas||[]);
    const desaSet = new Set();
    src.forEach(p => {
      (p.perDesa||[]).forEach(d => {
        if (!kec || d.kecamatan.toLowerCase()===kec.toLowerCase()) desaSet.add(d.desa);
      });
    });
    setDesaList([...desaSet].sort());
    setFilterDesa('');
  }, [selectedKec, activeTab, data]);

  if (loading) return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
        {Array(5).fill(0).map((_,i)=><Card key={i}><Skeleton h={80}/></Card>)}
      </div>
      <Card><Skeleton h={400}/></Card>
    </div>
  );

  if (error) return (
    <Card accent="crit">
      <div style={{ fontSize:13,color:'#f87171',fontWeight:600 }}>Gagal memuat data: {error}</div>
      <div style={{ fontSize:11,color:'var(--text4)',marginTop:8 }}>
        Jalankan: <code>python convert_assignment.py</code> lalu <code>python upload_assignment.py</code>
      </div>
    </Card>
  );

  const { summary={}, pencacah=[], pengawas=[] } = data || {};

  if (!pencacah.length && !pengawas.length) return (
    <Card>
      <div style={{ textAlign:'center',padding:'48px 24px' }}>
        <div style={{ fontSize:32,marginBottom:12 }}>📋</div>
        <div style={{ fontSize:14,fontWeight:600,color:'var(--text1)',marginBottom:8 }}>Data evaluasi belum tersedia</div>
        <div style={{ background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 20px',display:'inline-block',textAlign:'left',marginTop:8 }}>
          <div style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--orange3)',marginBottom:4 }}>python convert_assignment.py --input assignment_merged__1_.csv</div>
          <div style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--orange3)' }}>python upload_assignment.py --input assignment_stats.json</div>
        </div>
      </div>
    </Card>
  );

  const isPengawas = activeTab==='pengawas';
  const srcData    = isPengawas ? pengawas : pencacah;

  // Hitung jumlah hasil filter untuk masing-masing tab (untuk label tab)
  const countFiltered = (src) => src.filter(p => {
    if (selectedKec !== 'all') {
      const ok = Object.keys(p.perKecamatan||{}).some(k => k.toLowerCase() === selectedKec.toLowerCase());
      if (!ok) return false;
    }
    if (filterDesa) {
      const ok = (p.perDesa||[]).some(d =>
        d.desa.toLowerCase() === filterDesa.toLowerCase() &&
        (selectedKec === 'all' || d.kecamatan.toLowerCase() === selectedKec.toLowerCase()));
      if (!ok) return false;
    }
    return true;
  }).length;
  const countPcl = countFiltered(pencacah);
  const countPws = countFiltered(pengawas);

  // Filter
  let filtered = srcData.filter(p => {
    if (selectedKec!=='all') {
      const ok = Object.keys(p.perKecamatan||{}).some(k=>k.toLowerCase()===selectedKec.toLowerCase());
      if (!ok) return false;
    }
    if (filterDesa) {
      const ok = (p.perDesa||[]).some(d=>
        d.desa.toLowerCase()===filterDesa.toLowerCase() &&
        (selectedKec==='all'||d.kecamatan.toLowerCase()===selectedKec.toLowerCase()));
      if (!ok) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (p.nama||'').toLowerCase().includes(q)||(p.email||'').toLowerCase().includes(q);
    }
    return true;
  });

  // Recompute jika filter aktif
  if (selectedKec!=='all'||filterDesa) {
    filtered = filtered.map(p => {
      let dd = p.perDesa||[];
      if (selectedKec!=='all') dd=dd.filter(d=>d.kecamatan.toLowerCase()===selectedKec.toLowerCase());
      if (filterDesa)          dd=dd.filter(d=>d.desa.toLowerCase()===filterDesa.toLowerCase());
      const tot  = dd.reduce((a,d)=>a+d.total,   0);
      const appr = dd.reduce((a,d)=>a+d.approved,0);
      const sub  = dd.reduce((a,d)=>a+d.submit,  0);
      const rej  = dd.reduce((a,d)=>a+d.reject,  0);
      const dr   = dd.reduce((a,d)=>a+(d.draft||0),0);
      const op   = dd.reduce((a,d)=>a+d.open,    0);
      return { ...p,total:tot,approved:appr,submit:sub,reject:rej,draft:dr,open:op,
               pctApproved:tot>0?Math.round(appr/tot*100*10)/10:0 };
    }).filter(p=>p.total>0);
  }

  // ── Summary dinamis berdasarkan filter aktif ────────────────────────────
  const isFiltered = selectedKec !== 'all' || !!filterDesa;
  const filteredSummary = isFiltered ? {
    total:    filtered.reduce((a,p)=>a+(p.total||0),    0),
    approved: filtered.reduce((a,p)=>a+(p.approved||0), 0),
    submit:   filtered.reduce((a,p)=>a+(p.submit||0),   0),
    reject:   filtered.reduce((a,p)=>a+(p.reject||0),   0),
    draft:    filtered.reduce((a,p)=>a+(p.draft||0),    0),
    open:     filtered.reduce((a,p)=>a+(p.open||0),     0),
    count:    filtered.length,
  } : null;

  // ── Per-desa breakdown saat desa dipilih ─────────────────────────────────
  const desaSummary = filterDesa ? (() => {
    // Kumpulkan semua data untuk desa yang dipilih dari semua pencacah
    const rows = [];
    for (const p of (isPengawas ? pengawas : pencacah)) {
      const dd = (p.perDesa||[]).filter(d =>
        d.desa.toLowerCase() === filterDesa.toLowerCase() &&
        (selectedKec === 'all' || d.kecamatan.toLowerCase() === selectedKec.toLowerCase())
      );
      if (dd.length === 0) continue;
      const tot  = dd.reduce((a,d)=>a+d.total,    0);
      const appr = dd.reduce((a,d)=>a+d.approved, 0);
      const sub  = dd.reduce((a,d)=>a+d.submit,   0);
      const rej  = dd.reduce((a,d)=>a+d.reject,   0);
      const dr   = dd.reduce((a,d)=>a+(d.draft||0),0);
      const op   = dd.reduce((a,d)=>a+d.open,     0);
      if (tot === 0) continue;
      rows.push({ nama:p.nama, email:p.email, total:tot,
                  approved:appr, submit:sub, reject:rej, draft:dr, open:op });
    }
    const totAll  = rows.reduce((a,r)=>a+r.total,    0);
    const apprAll = rows.reduce((a,r)=>a+r.approved, 0);
    const subAll  = rows.reduce((a,r)=>a+r.submit,   0);
    const rejAll  = rows.reduce((a,r)=>a+r.reject,   0);
    const drAll   = rows.reduce((a,r)=>a+r.draft,    0);
    return { rows, total:totAll, approved:apprAll, submit:subAll,
             reject:rejAll, draft:drAll, desa:filterDesa };
  })() : null;

  // Sort
  filtered = [...filtered].sort((a,b) => {
    const d = sortDir==='desc'?-1:1;
    // Numerik
    if (sortBy==='total')     return d*(b.total-a.total);
    if (sortBy==='approved')  return d*(b.approved-a.approved);
    if (sortBy==='submit')    return d*(b.submit-a.submit);
    if (sortBy==='reject')    return d*((b.reject??0)-(a.reject??0));
    if (sortBy==='draft')     return d*((b.draft??0)-(a.draft??0));
    if (sortBy==='open')      return d*((b.open??0)-(a.open??0));
    if (sortBy==='pct')       return d*((b.progressScore!=null?b.progressScore:b.pctApproved||0)-(a.progressScore!=null?a.progressScore:a.pctApproved||0));
    if (sortBy==='avgPerDay') return d*((b.avgPerDay?.total??0)-(a.avgPerDay?.total??0));
    if (sortBy==='kecepatan') return d*((b.kecepatan??0)-(a.kecepatan??0));
    if (sortBy==='perfScore') return d*((b.perfScore??0)-(a.perfScore??0));
    // Grade (A > B > C > D)
    if (sortBy==='grade') {
      const ord={A:0,B:1,C:2,D:3};
      return d*((ord[a.grade]??4)-(ord[b.grade]??4));
    }
    // String
    if (sortBy==='nama')      return d*(a.nama||'').localeCompare(b.nama||'', 'id');
    if (sortBy==='kecamatan') return d*(a.kecamatan||'').localeCompare(b.kecamatan||'', 'id');
    if (sortBy==='pengawas')  return d*(a.pengawas?.nama||'').localeCompare(b.pengawas?.nama||'', 'id');
    return 0;
  });

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const toggleSort = col => {
    if (sortBy===col) setSortDir(d=>d==='desc'?'asc':'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const SI = ({ col }) => col
    ? sortBy===col
      ? <span style={{ fontSize:8,color:'var(--orange3)',marginLeft:3 }}>{sortDir==='desc'?'▼':'▲'}</span>
      : <span style={{ fontSize:8,color:'var(--text4)',marginLeft:3,opacity:0.45 }}>⇅</span>
    : null;
  const H = ({ label, col, right }) => (
    <th onClick={col?()=>toggleSort(col):undefined}
      style={{ padding:'8px 8px',textAlign:right?'right':'left',fontSize:9,fontWeight:700,
               color:sortBy===col?'var(--orange3)':'var(--text4)',textTransform:'uppercase',
               letterSpacing:'0.07em',cursor:col?'pointer':'default',userSelect:'none',whiteSpace:'nowrap' }}>
      {label} <SI col={col}/>
    </th>
  );

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>

      {/* Summary cards dengan animasi */}
      {/* Label filter aktif */}
      {isFiltered && (
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:-4 }}>
          <span style={{ fontSize:10,color:'var(--text4)' }}>Menampilkan data untuk:</span>
          {selectedKec !== 'all' && (
            <span style={{ fontSize:10,fontWeight:700,color:'var(--orange3)',
              padding:'2px 8px',borderRadius:6,background:'var(--orange-dim2)' }}>
              🗂 {selectedKec}
            </span>
          )}
          {filterDesa && (
            <span style={{ fontSize:10,fontWeight:700,color:'var(--blue3)',
              padding:'2px 8px',borderRadius:6,background:'rgba(27,63,139,0.1)' }}>
              📍 {filterDesa}
            </span>
          )}
          <span style={{ fontSize:10,color:'var(--text4)' }}>
            ({filteredSummary?.count||0} petugas · {(filteredSummary?.total||0).toLocaleString('id')} tugas)
          </span>
        </div>
      )}

      {/* Summary cards — ikut filter jika ada */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
        <SumCard label={isFiltered?'Total Tugas (Filter)':'Total Assignment'}
          value={(filteredSummary?.total ?? summary.totalAssignment) || 0}
          color="var(--text1)" icon={BarChart2}
          sub={isFiltered
            ? `${filteredSummary?.count||0} petugas di filter ini`
            : `${summary.totalKecamatan||0} kecamatan · ${pencacah.length} pencacah`}/>

        <SumCard label="Total Approved"
          value={(filteredSummary?.approved ?? summary.approved) || 0}
          color="#10b981" icon={CheckCircle}
          sub={(() => {
            const tot  = filteredSummary?.total  ?? summary.totalAssignment;
            const appr = filteredSummary?.approved ?? summary.approved;
            return `${tot ? Math.round(appr/tot*100) : 0}% dari total`;
          })()}/>
        <SumCard label="Menunggu Approve"
          value={(filteredSummary?.submit ?? summary.submit) || 0}
          color="#f59e0b" icon={Clock}
          sub="sudah submit, belum diapprove"/>
        <SumCard label="Total Draft"
          value={(filteredSummary?.draft ?? summary.draft) || 0}
          color="var(--blue3)" icon={FileText}
          sub="sedang diisi, belum disubmit"/>
        <SumCard label="Total Rejected"
          value={(filteredSummary?.reject ?? summary.reject) || 0}
          color="#f43f5e" icon={XCircle}
          sub={(() => {
            const tot = filteredSummary?.total ?? summary.totalAssignment;
            const rej = filteredSummary?.reject ?? summary.reject;
            return `${tot ? Math.round(rej/tot*100) : 0}% dari total`;
          })()}/>
      </div>

      {/* Tabel */}
      <Card>
        {/* ── Baris atas: Tab + Filter/Export ─────────────────────────────── */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
                      marginBottom:14,flexWrap:'wrap',gap:8 }}>
          {/* Tab buttons */}
          <div style={{ display:'flex',background:'var(--bg3)',border:'1px solid var(--border)',
                        borderRadius:9,padding:3,gap:2 }}>
            {[
              { key:'pencacah', label:`📋 Pencacah (${countPcl})`, color:'var(--orange3)' },
              { key:'pengawas', label:`🛡 Pengawas (${countPws})`,  color:'var(--blue3)'  },
              { key:'inaktif',  label:'⚠ Tidak Aktif',              color:'#f43f5e'       },
            ].map(t => (
              <button key={t.key}
                onClick={() => { setActiveTab(t.key); window.location.hash = t.key; }}
                style={{ padding:'6px 16px',fontSize:12,
                         fontWeight:activeTab===t.key?600:400,
                         borderRadius:7,border:'none',cursor:'pointer',
                         background:activeTab===t.key?'var(--bg5)':'transparent',
                         color:activeTab===t.key?t.color
                              :t.key==='inaktif'?'#f43f5e':'var(--text3)',
                         transition:'all .15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Filter + Export (hanya tab pencacah/pengawas) */}
          {activeTab !== 'inaktif' && (
            <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
              {selectedKec!=='all' && (
                <Badge variant="info"><MapPin size={9}/> {selectedKec}</Badge>
              )}
              <DesaFilter value={filterDesa}
                onChange={val=>{setFilterDesa(val);setPage(1);}}
                desaList={desaList}/>
              <div style={{ position:'relative' }}>
                <Search size={11} style={{ position:'absolute',left:8,top:'50%',
                  transform:'translateY(-50%)',color:'var(--text3)',pointerEvents:'none' }}/>
                <input value={search}
                  onChange={e=>{setSearch(e.target.value);setPage(1);}}
                  placeholder="Cari nama / email…"
                  style={{ padding:'6px 10px 6px 26px',fontSize:11,
                    background:'var(--bg3)',border:'1px solid var(--border)',
                    borderRadius:8,color:'var(--text1)',outline:'none',
                    fontFamily:'var(--font)',width:180 }}/>
              </div>
              {/* Export dropdown */}
              <div style={{ position:'relative' }}>
                <button onClick={() => setShowExportMenu(v => !v)}
                  style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',
                    fontSize:11,fontWeight:600,borderRadius:8,cursor:'pointer',
                    background:'var(--orange)',color:'#fff',border:'none',
                    boxShadow:'0 1px 4px rgba(232,84,28,0.3)',transition:'opacity .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.opacity='0.88'}
                  onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                  <Download size={12} strokeWidth={2}/> Export
                  <ChevronDown size={10} style={{ marginLeft:2,
                    transform:showExportMenu?'rotate(180deg)':'none',
                    transition:'transform .15s' }}/>
                </button>
                {showExportMenu && (
                  <>
                    <div onClick={()=>setShowExportMenu(false)}
                      style={{ position:'fixed',inset:0,zIndex:999 }}/>
                    <div style={{ position:'absolute',top:'calc(100% + 6px)',right:0,
                      zIndex:1000,background:'var(--bg2)',border:'1px solid var(--border2)',
                      borderRadius:10,overflow:'hidden',minWidth:180,
                      boxShadow:'0 8px 24px rgba(0,0,0,0.25)',
                      animation:'fadeSlideDown .12s ease' }}>
                      <button onClick={()=>{ setShowExportMenu(false);
                        generatePDF({activeTab,filtered,summary}).catch(e=>alert('Error: '+e.message)); }}
                        style={{ width:'100%',display:'flex',alignItems:'center',gap:10,
                          padding:'10px 14px',background:'none',border:'none',cursor:'pointer',
                          fontSize:12,color:'var(--text1)',borderBottom:'1px solid var(--border)',
                          textAlign:'left' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <Printer size={13} color="var(--orange3)"/>
                        <div>
                          <div style={{ fontWeight:600 }}>Export PDF</div>
                          <div style={{ fontSize:10,color:'var(--text4)' }}>Download langsung .pdf</div>
                        </div>
                      </button>
                      <button onClick={()=>{ setShowExportMenu(false);
                        generateExcel({activeTab,filtered,summary,isPengawas:activeTab==='pengawas'}); }}
                        style={{ width:'100%',display:'flex',alignItems:'center',gap:10,
                          padding:'10px 14px',background:'none',border:'none',cursor:'pointer',
                          fontSize:12,color:'var(--text1)',textAlign:'left' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <FileText size={13} color="var(--blue3)"/>
                        <div>
                          <div style={{ fontWeight:600 }}>Export Excel (CSV)</div>
                          <div style={{ fontSize:10,color:'var(--text4)' }}>Tabel data + ringkasan kecamatan</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tidak Aktif Section */}
        {activeTab === 'inaktif' && (
          <div style={{ marginTop:8 }}>
            <InaktifSection threshold={2} kecamatan={selectedKec}/>
          </div>
        )}

        {/* Tabel + Paginator */}
        {activeTab !== 'inaktif' && <>
        {/* Keterangan kolom */}
        <div style={{ fontSize:10,color:'var(--text4)',marginBottom:10,padding:'7px 10px',
                       background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,
                       display:'flex',gap:20,flexWrap:'wrap' }}>
          <span><strong style={{ color:'var(--text2)' }}>Total</strong> = semua tugas yang diberikan</span>
          <span><strong style={{ color:'#f59e0b' }}>Submit</strong> = sudah diisi, menunggu diapprove pengawas</span>
          <span><strong style={{ color:'#10b981' }}>Approved</strong> = selesai &amp; disetujui</span>
          <span><strong style={{ color:'var(--blue3)' }}>Draft</strong> = sedang diisi, belum disubmit</span>
          <span><strong style={{ color:'var(--text4)' }}>Open</strong> = belum disentuh</span>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                <H label="#"/>
                <H label={isPengawas?'Pengawas':'Pencacah'} col="nama"/>
                <H label="Kecamatan" col="kecamatan"/>
                {!isPengawas && <H label="Pengawas" col="pengawas"/>}
                <H label="Total"   col="total"     right/>
                <H label="Submit"  col="submit"   right/>
                <H label="Approved" col="approved" right/>
                <H label={isPengawas ? 'Pending' : 'Rejected'} col="reject" right/>
                <H label="Draft"    col="draft"     right/>
                <H label="Open"     col="open"    right/>
                <H label="Progress" col="pct"/>

                <th style={{ width:24 }}/>
              </tr>
            </thead>
            <tbody>
              {paginated.length===0
                ? <tr><td colSpan={12} style={{ textAlign:'center',padding:'32px',color:'var(--text4)',fontSize:13 }}>Tidak ada petugas ditemukan</td></tr>
                : paginated.map((p,i) =>
                    isPengawas
                      ? <PengawasRow key={p.email||i} p={p} rank={(page-1)*PAGE_SIZE+i+1} filterKec={selectedKec} filterDesa={filterDesa}/>
                      : <PencacahRow key={p.email||i} p={p} rank={(page-1)*PAGE_SIZE+i+1} filterKec={selectedKec} filterDesa={filterDesa}/>
                  )
              }
            </tbody>
          </table>
        </div>

        <Paginator page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={p=>setPage(p)}/>

        {/* ── Ringkasan per Desa (muncul jika filterDesa dipilih) ──────── */}
        {desaSummary && (
          <div style={{ marginTop:16,padding:'14px 16px',background:'var(--bg3)',
            border:'1px solid var(--border)',borderRadius:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
              <MapPin size={12} color="var(--blue3)"/>
              <span style={{ fontSize:11,fontWeight:700,color:'var(--text1)' }}>
                Ringkasan Desa: {desaSummary.desa}
              </span>
              <span style={{ fontSize:10,color:'var(--text4)' }}>
                · {desaSummary.rows.length} petugas · {(desaSummary.total).toLocaleString('id')} total tugas
              </span>
            </div>

            {/* Mini stat row */}
            <div style={{ display:'flex',gap:10,marginBottom:14,flexWrap:'wrap' }}>
              {[
                { label:'Total',    val:desaSummary.total,    color:'var(--text2)' },
                { label:'Approved', val:desaSummary.approved, color:'#10b981' },
                { label:'Submit',   val:desaSummary.submit,   color:'#f59e0b' },
                { label:'Rejected', val:desaSummary.reject,   color:'#f43f5e' },
                { label:'Draft',    val:desaSummary.draft,    color:'var(--blue3)' },
              ].map(s => (
                <div key={s.label} style={{ padding:'8px 14px',background:'var(--bg2)',
                  border:'1px solid var(--border)',borderRadius:8,minWidth:80,textAlign:'center' }}>
                  <div style={{ fontSize:16,fontWeight:800,color:s.color,fontFamily:'var(--mono)' }}>
                    {s.val.toLocaleString('id')}
                  </div>
                  <div style={{ fontSize:8,color:'var(--text4)',marginTop:2,textTransform:'uppercase',
                    letterSpacing:'0.07em',fontWeight:700 }}>{s.label}</div>
                </div>
              ))}
              {desaSummary.total > 0 && (
                <div style={{ padding:'8px 14px',background:'var(--bg2)',
                  border:'1px solid var(--border)',borderRadius:8,minWidth:80,textAlign:'center' }}>
                  <div style={{ fontSize:16,fontWeight:800,
                    color:desaSummary.approved/desaSummary.total>0.5?'#10b981':'#f59e0b',
                    fontFamily:'var(--mono)' }}>
                    {Math.round(desaSummary.approved/desaSummary.total*100)}%
                  </div>
                  <div style={{ fontSize:8,color:'var(--text4)',marginTop:2,textTransform:'uppercase',
                    letterSpacing:'0.07em',fontWeight:700 }}>Progress</div>
                </div>
              )}
            </div>

            {/* Breakdown per petugas di desa ini */}
            <div style={{ fontSize:9,color:'var(--text4)',fontWeight:700,
              textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8 }}>
              Breakdown per Petugas
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%',borderCollapse:'collapse',fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['Nama Petugas','Total','Approved','Submit','Rejected','Draft','Open'].map(h=>(
                      <th key={h} style={{ padding:'6px 8px',textAlign:h==='Nama Petugas'?'left':'right',
                        fontSize:8,fontWeight:700,color:'var(--text4)',textTransform:'uppercase',
                        letterSpacing:'0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {desaSummary.rows.map((r,i)=>(
                    <tr key={r.email} style={{ borderBottom:'1px solid var(--border)',
                      background:i%2===0?'transparent':'rgba(255,255,255,0.018)' }}>
                      <td style={{ padding:'6px 8px' }}>
                        <div style={{ fontWeight:600,color:'var(--text1)',fontSize:10 }}>{r.nama}</div>
                        <div style={{ fontSize:8,color:'var(--text4)',fontFamily:'var(--mono)' }}>{r.email}</div>
                      </td>
                      {[
                        [r.total,   'var(--text2)'],
                        [r.approved,'#10b981'],
                        [r.submit,  '#f59e0b'],
                        [r.reject,  '#f43f5e'],
                        [r.draft,   'var(--blue3)'],
                        [r.open,    'var(--text4)'],
                      ].map(([val,col],j)=>(
                        <td key={j} style={{ padding:'6px 8px',textAlign:'right',
                          fontFamily:'var(--mono)',fontSize:10,
                          color:val>0?col:'var(--text4)',fontWeight:val>0&&j>0?600:400 }}>
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop:10,paddingTop:8,borderTop:'1px solid var(--border)',fontSize:9,color:'var(--text4)' }}>
          Data per {new Date(summary?.snapshotAt||Date.now()).toLocaleString('id-ID')} ·
          {(summary?.totalAssignment||0).toLocaleString('id')} total assignment ·
          Skor dihitung relatif terhadap peers di snapshot ini
        </div>
      </>}
      </Card>
    </div>
  );
}