/**
 * src/pages/EvaluasiPage.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Evaluasi seluruh petugas (Pencacah + Pengawas).
 * Kolom: # | Nama | Kecamatan | Total | Submit | Approved | Rejected | Open | Progress | Avg Durasi/Latensi | Perf Score | Grade | Status
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, TrendingUp, Clock, CheckCircle, XCircle,
  BarChart2, MapPin, Search, ChevronDown, ChevronUp,
  Shield, ChevronLeft, ChevronRight, FileText,
  Star, AlertCircle, Inbox,
} from 'lucide-react';
import { Card, SectionTitle, Badge, ProgressBar } from '../components/ui.jsx';
import { useKecamatan } from '../context/KecamatanContext.jsx';
import DesaFilter from '../components/DesaFilter.jsx';

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
                                        background:i%2===0?'transparent':'rgba(255,255,255,0.015)' }}>
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
  const fc = p.pctApproved>=50?'#10b981':p.pctApproved>=20?'#f59e0b':'#f43f5e';
  return (
    <>
      <tr onClick={()=>setOpen(v=>!v)}
        style={{ borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background .1s' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text4)',fontFamily:'var(--mono)',width:28 }}>{rank}</td>
        <td style={{ padding:'9px 8px' }}>
          <div style={{ fontSize:11,fontWeight:600,color:'var(--text1)' }}>{p.nama||'—'}</div>
          <div style={{ fontSize:9,color:'var(--text4)',fontFamily:'var(--mono)' }}>{p.email}</div>
        </td>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text3)',whiteSpace:'nowrap' }}>{p.kecamatan}</td>
        {/* Total = semua assignment yg ditugaskan */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)',textAlign:'right' }}>{p.total}</td>
        {/* Submit = submitted tapi belum diapprove */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f59e0b',textAlign:'right',fontWeight:p.submit>0?600:400 }}>{p.submit||0}</td>
        {/* Approved */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#10b981',fontWeight:600,textAlign:'right' }}>{p.approved}</td>
        {/* Rejected */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f43f5e',textAlign:'right' }}>{p.reject||0}</td>
        {/* Open/belum dikerjakan */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text4)',textAlign:'right' }}>{p.open||0}</td>
        {/* Progress */}
        <td style={{ padding:'9px 8px',minWidth:100 }}>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ flex:1 }}><ProgressBar pct={p.pctApproved} color={fc} height={4}/></div>
            <span style={{ fontSize:9,fontFamily:'var(--mono)',color:fc,fontWeight:600,width:32,textAlign:'right',flexShrink:0 }}>{p.pctApproved}%</span>
          </div>
        </td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)',textAlign:'right' }}>
          {p.avgDurHari!=null?`${p.avgDurHari}h`:'—'}
        </td>
        <td style={{ padding:'9px 8px' }}><PerfGauge score={p.perfScore} grade={p.grade}/></td>
        <td style={{ padding:'9px 8px' }}><GradeBadge grade={p.grade}/></td>
        <td style={{ padding:'9px 8px' }}>
          {open?<ChevronUp size={11} color="var(--text4)"/>:<ChevronDown size={11} color="var(--text4)"/>}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom:'1px solid var(--border)' }}>
          <td colSpan={13} style={{ padding:'0 10px 16px 40px',background:'rgba(232,84,28,0.02)' }}>
            {/* Performance breakdown */}
            <div style={{ paddingTop:12,display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
              <Mini label="Total Tugas"   value={p.total}                                    icon={BarChart2}  animate/>
              <Mini label="Belum Dikerjakan" value={p.open}    color="var(--text4)"           icon={Inbox}     animate/>
              <Mini label="Sudah Submit"  value={p.submit}     color="#f59e0b"                icon={Clock}     animate/>
              <Mini label="Approved"      value={p.approved}   color="#10b981"                icon={CheckCircle} animate/>
              <Mini label="Rejected"      value={p.reject}     color="#f43f5e"                icon={XCircle}   animate/>
              <Mini label="Avg Pengisian" value={p.avgDurHari!=null?`${p.avgDurHari} hari`:'—'} icon={Clock}/>
              <Mini label="Perf Score"    value={p.perfScore!=null?`${p.perfScore}/100`:'—'} color={GRADE_CFG[p.grade]?.color} icon={Star}/>
            </div>
            {/* Score breakdown */}
            {p.perfScore!=null && (
              <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,padding:'10px 12px',
                             background:'var(--bg3)',borderRadius:8,border:'1px solid var(--border)' }}>
                <div style={{ fontSize:9,color:'var(--text4)',width:'100%',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4 }}>
                  💡 Breakdown skor performa
                </div>
                {[
                  { label:'Progress (40%)',  val:p.progressScore, desc:'(approved+submit)/total', color:'var(--orange3)' },
                  { label:'Kualitas (40%)',  val:p.qualityScore,  desc:'approved/(approved+submit+reject)', color:'var(--green3)' },
                  { label:'Kecepatan (20%)', val:p.speedScore,    desc:'inverted avg durasi', color:'var(--blue3)' },
                ].map(s => (
                  <div key={s.label} style={{ flex:1,minWidth:140 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                      <span style={{ fontSize:9,color:s.color,fontWeight:600 }}>{s.label}</span>
                      <span style={{ fontSize:9,fontFamily:'var(--mono)',color:s.color }}>{s.val??'—'}</span>
                    </div>
                    <ProgressBar pct={s.val??0} color={s.color} height={3}/>
                    <div style={{ fontSize:8,color:'var(--text4)',marginTop:2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            )}
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
  const lc = p.avgLatHari==null?'var(--text2)':p.avgLatHari<3?'#10b981':p.avgLatHari<7?'#f59e0b':'#f43f5e';
  return (
    <>
      <tr onClick={()=>setOpen(v=>!v)}
        style={{ borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background .1s' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text4)',fontFamily:'var(--mono)',width:28 }}>{rank}</td>
        <td style={{ padding:'9px 8px' }}>
          <div style={{ fontSize:11,fontWeight:600,color:'var(--text1)' }}>{p.nama||'—'}</div>
          <div style={{ fontSize:9,color:'var(--text4)',fontFamily:'var(--mono)' }}>{p.email}</div>
        </td>
        <td style={{ padding:'9px 8px',fontSize:10,color:'var(--text3)',whiteSpace:'nowrap' }}>{p.kecamatan}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)',textAlign:'right' }}>{p.total}</td>
        {/* Submit = yg masih menunggu diapprove */}
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f59e0b',textAlign:'right',fontWeight:p.submit>0?600:400 }}>{p.submit||0}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#10b981',fontWeight:600,textAlign:'right' }}>{p.approved}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'#f43f5e',textAlign:'right' }}>{p.reject||0}</td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:11,color:'var(--text4)',textAlign:'right' }}>{p.open||0}</td>
        <td style={{ padding:'9px 8px',minWidth:100 }}>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ flex:1 }}><ProgressBar pct={p.pctApproved} color={fc} height={4}/></div>
            <span style={{ fontSize:9,fontFamily:'var(--mono)',color:fc,fontWeight:600,width:32,textAlign:'right',flexShrink:0 }}>{p.pctApproved}%</span>
          </div>
        </td>
        <td style={{ padding:'9px 8px',fontFamily:'var(--mono)',fontSize:12,color:lc,fontWeight:600,textAlign:'right' }}>
          {p.avgLatHari!=null?`${p.avgLatHari}h`:'—'}
        </td>
        <td style={{ padding:'9px 8px' }}><PerfGauge score={p.perfScore} grade={p.grade}/></td>
        <td style={{ padding:'9px 8px' }}><GradeBadge grade={p.grade}/></td>
        <td style={{ padding:'9px 8px' }}>
          {open?<ChevronUp size={11} color="var(--text4)"/>:<ChevronDown size={11} color="var(--text4)"/>}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom:'1px solid var(--border)' }}>
          <td colSpan={13} style={{ padding:'0 10px 16px 40px',background:'rgba(27,63,139,0.02)' }}>
            <div style={{ paddingTop:12,display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
              <Mini label="Total Diawasi"   value={p.total}                                        icon={BarChart2}   animate/>
              <Mini label="Belum Dikerjakan" value={p.open}     color="var(--text4)"               icon={Inbox}       animate/>
              <Mini label="Menunggu Approve" value={p.submit}   color="#f59e0b"                    icon={Clock}       animate/>
              <Mini label="Approved"          value={p.approved} color="#10b981"                   icon={CheckCircle} animate/>
              <Mini label="Ditolak"           value={p.reject}   color="#f43f5e"                   icon={XCircle}     animate/>
              <Mini label="Avg Latensi"       value={p.avgLatHari!=null?`${p.avgLatHari} hari`:'—'} color={lc} icon={Clock}/>
              <Mini label="Perf Score"        value={p.perfScore!=null?`${p.perfScore}/100`:'—'} color={GRADE_CFG[p.grade]?.color} icon={Star}/>
            </div>
            {p.perfScore!=null && (
              <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,padding:'10px 12px',
                             background:'var(--bg3)',borderRadius:8,border:'1px solid var(--border)' }}>
                <div style={{ fontSize:9,color:'var(--text4)',width:'100%',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4 }}>
                  💡 Breakdown skor performa
                </div>
                {[
                  { label:'Approval Rate (50%)', val:p.approvalRate, desc:'approved/total', color:'var(--orange3)' },
                  { label:'Kecepatan (30%)',      val:p.speedScore,   desc:'inverted avg latensi', color:'var(--green3)' },
                ].map(s => (
                  <div key={s.label} style={{ flex:1,minWidth:140 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                      <span style={{ fontSize:9,color:s.color,fontWeight:600 }}>{s.label}</span>
                      <span style={{ fontSize:9,fontFamily:'var(--mono)',color:s.color }}>{s.val??'—'}</span>
                    </div>
                    <ProgressBar pct={s.val??0} color={s.color} height={3}/>
                    <div style={{ fontSize:8,color:'var(--text4)',marginTop:2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            )}
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

// ══════════════════════════════════════════════════════════════════════════
export function EvaluasiPage() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState('');
  const [activeTab, setActiveTab] = useState('pencacah');
  const [sortBy,    setSortBy]    = useState('perfScore');
  const [sortDir,   setSortDir]   = useState('desc');
  const [page,      setPage]      = useState(1);
  const [filterDesa,setFilterDesa]= useState('');
  const [desaList,  setDesaList]  = useState([]);

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
      const op   = dd.reduce((a,d)=>a+d.open,    0);
      return { ...p,total:tot,approved:appr,submit:sub,reject:rej,open:op,
               pctApproved:tot>0?Math.round(appr/tot*100*10)/10:0 };
    }).filter(p=>p.total>0);
  }

  // Sort
  filtered = [...filtered].sort((a,b) => {
    const d = sortDir==='desc'?-1:1;
    if (sortBy==='approved')  return d*(b.approved-a.approved);
    if (sortBy==='total')     return d*(b.total-a.total);
    if (sortBy==='pct')       return d*(b.pctApproved-a.pctApproved);
    if (sortBy==='dur')       return d*((a.avgDurHari??999)-(b.avgDurHari??999));
    if (sortBy==='lat')       return d*((a.avgLatHari??999)-(b.avgLatHari??999));
    if (sortBy==='kecepatan') return d*((b.kecepatan??0)-(a.kecepatan??0));
    if (sortBy==='perfScore') return d*((b.perfScore??0)-(a.perfScore??0));
    if (sortBy==='grade') {
      const ord={A:0,B:1,C:2,D:3};
      return d*((ord[a.grade]??4)-(ord[b.grade]??4));
    }
    return 0;
  });

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const toggleSort = col => {
    if (sortBy===col) setSortDir(d=>d==='desc'?'asc':'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const SI = ({ col }) => sortBy===col
    ? <span style={{ fontSize:8,color:'var(--orange3)' }}>{sortDir==='desc'?'▼':'▲'}</span>
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
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
        <SumCard label="Pencacah"         value={pencacah.length}   color="var(--orange3)" icon={Users}
          sub={`${pencacah.reduce((a,p)=>a+p.approved,0)} approved`}/>
        <SumCard label="Pengawas"         value={pengawas.length}   color="var(--blue3)"   icon={Shield}
          sub={`${pengawas.reduce((a,p)=>a+p.approved,0)} diapprove`}/>
        <SumCard label="Total Assignment" value={summary.totalAssignment||0} color="var(--text1)" icon={BarChart2}
          sub={`${summary.totalKecamatan} kecamatan`}/>
        <SumCard label="Total Approved"   value={summary.approved||0} color="#10b981" icon={CheckCircle}
          sub={`${summary.totalAssignment?Math.round((summary.approved||0)/summary.totalAssignment*100):0}% dari total`}/>
        <SumCard label="Menunggu Approve" value={summary.submit||0}   color="#f59e0b" icon={Clock}
          sub="sudah submit, belum diapprove"/>
      </div>

      {/* Tabel */}
      <Card>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8 }}>
          {/* Tab */}
          <div style={{ display:'flex',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:9,padding:3,gap:2 }}>
            {[
              { key:'pencacah', label:`📋 Pencacah (${pencacah.length})`, color:'var(--orange3)' },
              { key:'pengawas', label:`🛡 Pengawas (${pengawas.length})`,  color:'var(--blue3)' },
            ].map(t => (
              <button key={t.key} onClick={()=>setActiveTab(t.key)}
                style={{ padding:'6px 16px',fontSize:12,fontWeight:activeTab===t.key?600:400,
                         borderRadius:7,border:'none',cursor:'pointer',
                         background:activeTab===t.key?'var(--bg5)':'transparent',
                         color:activeTab===t.key?t.color:'var(--text3)',transition:'all .15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
            {selectedKec!=='all' && <Badge variant="info"><MapPin size={9}/> {selectedKec}</Badge>}
            <DesaFilter value={filterDesa} onChange={val=>{setFilterDesa(val);setPage(1);}} desaList={desaList}/>
            <div style={{ position:'relative' }}>
              <Search size={11} style={{ position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',pointerEvents:'none' }}/>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
                placeholder="Cari nama / email…"
                style={{ padding:'6px 10px 6px 26px',fontSize:11,background:'var(--bg3)',
                         border:'1px solid var(--border)',borderRadius:8,color:'var(--text1)',
                         outline:'none',fontFamily:'var(--font)',width:180 }}/>
            </div>
          </div>
        </div>

        {/* Keterangan kolom */}
        <div style={{ fontSize:10,color:'var(--text4)',marginBottom:10,padding:'7px 10px',
                       background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,
                       display:'flex',gap:20,flexWrap:'wrap' }}>
          <span><strong style={{ color:'var(--text2)' }}>Total</strong> = semua tugas yang diberikan</span>
          <span><strong style={{ color:'#f59e0b' }}>Submit</strong> = sudah diisi, menunggu diapprove pengawas</span>
          <span><strong style={{ color:'#10b981' }}>Approved</strong> = selesai &amp; disetujui</span>
          <span><strong style={{ color:'var(--text4)' }}>Open</strong> = belum dikerjakan</span>
          {isPengawas && <span><strong style={{ color:'var(--text2)' }}>Avg Latensi</strong>: hijau &lt;3h · kuning &lt;7h · merah ≥7h</span>}
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                <H label="#"/>
                <H label={isPengawas?'Pengawas':'Pencacah'}/>
                <H label="Kecamatan"/>
                <H label="Total"   col="total"     right/>
                <H label="Submit"  right/>
                <H label="Approved" col="approved" right/>
                <H label="Rejected" right/>
                <H label="Open"     right/>
                <H label="Progress" col="pct"/>
                <H label={isPengawas?'Avg Latensi':'Avg Durasi'} col={isPengawas?'lat':'dur'} right/>
                <H label="Perf Score" col="perfScore"/>
                <H label="Grade"   col="grade"/>
                <th style={{ width:24 }}/>
              </tr>
            </thead>
            <tbody>
              {paginated.length===0
                ? <tr><td colSpan={13} style={{ textAlign:'center',padding:'32px',color:'var(--text4)',fontSize:13 }}>Tidak ada petugas ditemukan</td></tr>
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

        <div style={{ marginTop:10,paddingTop:8,borderTop:'1px solid var(--border)',fontSize:9,color:'var(--text4)' }}>
          Data per {new Date(summary?.snapshotAt||Date.now()).toLocaleString('id-ID')} ·
          {(summary?.totalAssignment||0).toLocaleString('id')} total assignment ·
          Skor dihitung relatif terhadap peers di snapshot ini
        </div>
      </Card>
    </div>
  );
}