import { useState, useMemo } from 'react';
import {
  Search, X, AlertTriangle, CheckCircle, Clock,
  User, MapPin, Briefcase, Tag, DollarSign,
  Users, Home, ChevronLeft, ChevronRight,
  Droplets, Zap, Shield,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { Card, SectionTitle, Badge } from '../components/ui.jsx';
import { RESPONDEN, TOTAL_RECORDS } from '../data/responden.js';

const STATUS_CFG = {
  APPROVED:  { variant:'ok',      label:'Approved',  Icon:CheckCircle },
  SUBMITTED: { variant:'neutral', label:'Submitted', Icon:Clock       },
  REJECTED:  { variant:'crit',    label:'Rejected',  Icon:X           },
};
const PAGE_SIZE = 15;
const MODAL_PAGES = ['Identitas & Lokasi','Usaha','Hunian','Ekonomi Keluarga'];

/* ── Field tile ── */
function Field({ label, value, Icon, danger, mono }) {
  return (
    <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px', border:`1px solid ${danger?'rgba(244,63,94,0.3)':'var(--border)'}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, marginBottom:5 }}>
        {Icon && <Icon size={9} strokeWidth={2} />} {label}
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:danger?'#f87171':'var(--text1)', fontFamily:mono?'var(--mono)':'inherit', lineHeight:1.3 }}>
        {value || <span style={{ color:'var(--text4)', fontStyle:'italic', fontWeight:400 }}>—</span>}
      </div>
    </div>
  );
}

/* ── Modal pages ── */
function Page0({ r }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Kepala Keluarga</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="No. KK" value={r.noKK} Icon={Tag} mono />
          <Field label="NIK Kepala" value={r.nik} Icon={Shield} mono />
          <Field label="Nama Kepala" value={r.namaKepala} Icon={User} />
          <Field label="Nama Pasangan" value={r.namaPasangan||'—'} Icon={User} />
          <Field label="Domisili" value={r.domisili} Icon={MapPin} danger={r.domisili?.includes('Tidak')} />
          <Field label="Alamat" value={r.alamat} Icon={MapPin} />
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Wilayah</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Kecamatan" value={r.kecamatan} Icon={MapPin} />
          <Field label="Desa/Kelurahan" value={r.desa} Icon={MapPin} />
          <Field label="SLS" value={r.sls} Icon={MapPin} />
          <Field label="Sub-SLS" value={r.subSls} Icon={MapPin} />
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
          Anggota Keluarga
          <span style={{ marginLeft:8, color:'var(--indigo3)', fontWeight:600 }}>{r.jumlahAk} hadir / {r.jumlahAkKK} di KK</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {(r.anggotaKeluarga||[]).map((ak,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px' }}>
              <div style={{ width:28, height:28, borderRadius:8, background:i===0?'rgba(99,102,241,0.15)':'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <User size={13} color={i===0?'var(--indigo3)':'var(--text3)'} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{ak.nama}</div>
                <div style={{ fontSize:10, color:'var(--text3)' }}>{ak.hubungan}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Info Pengisian</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="PCL" value={r.petugas} Icon={User} />
          <Field label="Role" value={r.role} Icon={Shield} />
          <Field label="Waktu Mulai" value={r.mulai} Icon={Clock} mono />
          <Field label="Waktu Selesai" value={r.selesai} Icon={Clock} mono />
          <Field label="Durasi Pengisian" value={r.durLabel} Icon={Clock} danger={r.durMenit!==null&&(r.durMenit<=2||r.durMenit>480)} mono />
          <Field label="Terakhir Diubah" value={r.tglDiubah} Icon={Clock} />
        </div>
      </div>
    </div>
  );
}

function Page1({ r }) {
  const hasUsaha = r.namaUsaha && r.namaUsaha!=='—';
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Identitas Usaha</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={{ gridColumn:'1/-1' }}><Field label="Nama Usaha" value={r.namaUsaha} Icon={Briefcase} /></div>
          <Field label="Kode KBLI" value={r.kbli||'Kosong'} Icon={Tag} mono danger={!r.kbli&&hasUsaha} />
          <Field label="Kategori" value={r.kategori} Icon={Tag} />
          <Field label="Jenis Usaha" value={r.jenisUsaha} Icon={Briefcase} />
          <Field label="Skala Usaha" value={r.skalaUsaha} Icon={TrendingUp} />
          <Field label="Tahun Mulai" value={r.tahunOperasi} Icon={Clock} />
          <Field label="Keberadaan Usaha" value={r.keberadaanUsaha} Icon={CheckCircle} />
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Tenaga Kerja & Keuangan</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="TK Laki-laki" value={`${r.tkLaki} orang`} Icon={Users} />
          <Field label="TK Perempuan" value={`${r.tkPr} orang`} Icon={Users} />
          <Field label="Total TK" value={`${r.totalTK} orang`} Icon={Users} />
          <Field label="Aset Usaha" value={r.asetUsaha} Icon={DollarSign} />
          <Field label="Pendapatan Usaha/Bln" value={r.nilaiPendapatan} Icon={DollarSign} danger={r.nilaiPendapatanRaw>500_000_000} />
          <Field label="Total Pendapatan" value={r.totalPendapatan} Icon={TrendingUp} />
          <Field label="Total Pengeluaran" value={r.totalPengeluaran} Icon={TrendingDown} />
        </div>
      </div>
    </div>
  );
}

function Page2({ r }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Kondisi Hunian</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Luas Lantai" value={r.luasLantai} Icon={Home} />
          <Field label="Status Kepemilikan" value={r.statusKepemilikan} Icon={Shield} />
          <Field label="Jenis Lantai" value={r.jenisLantai} Icon={Home} />
          <Field label="Jenis Dinding" value={r.jenisDinding} Icon={Home} />
          <Field label="Jenis Atap" value={r.jenisAtap} Icon={Home} />
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Utilitas</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Sumber Air Minum" value={r.airMinum} Icon={Droplets} />
          <Field label="Sumber Penerangan" value={r.penerangan} Icon={Zap} />
        </div>
      </div>
    </div>
  );
}

function Page3({ r }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Keuangan Keluarga</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Pendapatan Keluarga/Bln" value={r.pendapatanKeluarga} Icon={TrendingUp} />
          <Field label="Pengeluaran Keluarga/Bln" value={r.pengeluaranKeluarga} Icon={TrendingDown} />
        </div>
      </div>
      {r.catatan && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Catatan PCL</div>
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>{r.catatan}</div>
        </div>
      )}
    </div>
  );
}

/* ── Detail Modal ── */
function DetailModal({ row, onClose }) {
  const [page, setPage] = useState(0);
  if (!row) return null;
  const sCfg = STATUS_CFG[row.status]||STATUS_CFG.SUBMITTED;
  const hasCrit = row.flags?.some(f=>f.sev==='crit');
  const pages = [<Page0 r={row}/>,<Page1 r={row}/>,<Page2 r={row}/>,<Page3 r={row}/>];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth:720 }} onClick={e=>e.stopPropagation()}>

        {/* ── STICKY: Header + anomaly strip + tabs ── */}
        <div style={{ flexShrink:0, background:'var(--bg2)' }}>
          {/* Header */}
          <div style={{ padding:'20px 24px 16px', display:'flex', alignItems:'flex-start', gap:12, borderBottom:'1px solid var(--border)' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', fontWeight:600 }}>{row.id}</span>
                <Badge variant={sCfg.variant}><sCfg.Icon size={10} strokeWidth={2}/> {sCfg.label}</Badge>
                {row.anomaly && <Badge variant={hasCrit?'crit':'warn'}><AlertTriangle size={9} strokeWidth={2}/> {row.flags?.length} anomali</Badge>}
              </div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text1)', marginBottom:3, letterSpacing:'-0.01em' }}>{row.namaKepala}</h2>
              <div style={{ fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', gap:4 }}>
                <MapPin size={10} strokeWidth={2}/> {row.desa}, {row.kecamatan}
              </div>
            </div>
            <button onClick={onClose} style={{ padding:7, borderRadius:8, color:'var(--text3)', background:'var(--bg3)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 }}>
              <X size={14} strokeWidth={2}/>
            </button>
          </div>

          {/* Anomaly strip */}
          {row.flags?.length>0 && (
            <div style={{ margin:'12px 24px 0', padding:'10px 14px', background:hasCrit?'rgba(244,63,94,0.06)':'rgba(245,158,11,0.06)', border:`1px solid ${hasCrit?'rgba(244,63,94,0.2)':'rgba(245,158,11,0.2)'}`, borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7, fontSize:11, fontWeight:600, color:hasCrit?'#f87171':'#fbbf24' }}>
                <AlertTriangle size={11} strokeWidth={2}/> Anomali terdeteksi
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {row.flags.map((f,i)=><Badge key={i} variant={f.sev==='crit'?'crit':'warn'}>{f.text}</Badge>)}
              </div>
            </div>
          )}

          {/* Tab nav */}
          <div style={{ display:'flex', gap:0, padding:'12px 24px 0', borderBottom:'1px solid var(--border)' }}>
            {MODAL_PAGES.map((label,i)=>(
              <button key={i} onClick={()=>setPage(i)} style={{ padding:'7px 14px', fontSize:11, fontWeight:page===i?600:400, color:page===i?'var(--indigo3)':'var(--text3)', background:'transparent', border:'none', cursor:'pointer', borderBottom:`2px solid ${page===i?'var(--indigo)':'transparent'}`, marginBottom:-1, transition:'all .15s', whiteSpace:'nowrap' }}>{label}</button>
            ))}
          </div>
        </div>

        {/* ── SCROLLABLE: page content only ── */}
        <div className="modal-scroll" style={{ padding:'16px 24px' }}>
          {pages[page]}
        </div>

        {/* ── STICKY: Footer nav ── */}
        <div style={{ flexShrink:0, padding:'12px 24px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg2)' }}>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:page===0?'default':'pointer', background:'var(--bg3)', border:'1px solid var(--border)', color:page===0?'var(--text4)':'var(--text2)' }}>
            <ChevronLeft size={13} strokeWidth={2}/> Sebelumnya
          </button>
          <span style={{ fontSize:11, color:'var(--text3)' }}>{page+1} / {MODAL_PAGES.length}</span>
          {page<MODAL_PAGES.length-1
            ? <button onClick={()=>setPage(p=>p+1)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', color:'var(--indigo3)' }}>
                Berikutnya <ChevronRight size={13} strokeWidth={2}/>
              </button>
            : <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)' }}>Tutup</button>}
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function RespondenPage() {
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAnomaly, setFilterAnomaly] = useState('all');
  const [filterKec, setFilterKec]   = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected]     = useState(null);

  const kecList = useMemo(()=>[...new Set(RESPONDEN.map(r=>r.kecamatan))].sort(),[]);

  const filtered = useMemo(()=>{
    setCurrentPage(1);
    const q = search.toLowerCase();
    return RESPONDEN.filter(r=>{
      const ms = !q || r.namaKepala.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.kecamatan.toLowerCase().includes(q) || r.petugas.toLowerCase().includes(q) || r.noKK.includes(q) || (r.namaUsaha||'').toLowerCase().includes(q);
      const mst = filterStatus==='all'||r.status===filterStatus;
      const man = filterAnomaly==='all'||(filterAnomaly==='anomaly'?!!r.anomaly:!r.anomaly);
      const mk  = filterKec==='all'||r.kecamatan===filterKec;
      return ms&&mst&&man&&mk;
    });
  },[search,filterStatus,filterAnomaly,filterKec]);

  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const pageData   = filtered.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);
  const totals     = useMemo(()=>({ anomaly:RESPONDEN.filter(r=>r.anomaly).length, approved:RESPONDEN.filter(r=>r.status==='APPROVED').length, rejected:RESPONDEN.filter(r=>r.status==='REJECTED').length }),[]);

  const goPage = (p) => setCurrentPage(Math.max(1,Math.min(totalPages,p)));

  /* page numbers to show */
  const pageNums = useMemo(()=>{
    if(totalPages<=7) return Array.from({length:totalPages},(_,i)=>i+1);
    const nums=new Set([1,totalPages,currentPage]);
    for(let d=-2;d<=2;d++) { const n=currentPage+d; if(n>=1&&n<=totalPages) nums.add(n); }
    return [...nums].sort((a,b)=>a-b);
  },[totalPages,currentPage]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          { label:'Sampel ditampilkan', val:RESPONDEN.length, color:'var(--indigo2)', sub:`dari ${TOTAL_RECORDS} total records` },
          { label:'Dengan anomali',     val:totals.anomaly,   color:'#f87171',        sub:`${Math.round(totals.anomaly/RESPONDEN.length*100)}% dari sampel` },
          { label:'Approved',           val:totals.approved,  color:'#34d399',        sub:`${Math.round(totals.approved/RESPONDEN.length*100)}% selesai` },
          { label:'Rejected',           val:totals.rejected,  color:'#f87171',        sub:`${Math.round(totals.rejected/RESPONDEN.length*100)}% perlu perbaikan` },
        ].map(s=>(
          <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px' }}>
            <div style={{ fontSize:24, fontWeight:700, color:s.color, fontFamily:'var(--mono)', lineHeight:1, marginBottom:4 }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500 }}>{s.label}</div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <Card>
        <SectionTitle icon={Users} right={<Badge variant="neutral">{filtered.length} records</Badge>}>
          Tabel pendataan responden
        </SectionTitle>

        {/* Controls */}
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ flex:'1 1 180px', minWidth:160, position:'relative' }}>
            <Search size={12} strokeWidth={2} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama KK, ID, No.KK, usaha, PCL…"
              style={{ width:'100%', padding:'7px 10px 7px 29px', fontSize:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text1)', outline:'none', fontFamily:'var(--font)' }}/>
          </div>

          <select value={filterKec} onChange={e=>setFilterKec(e.target.value)}
            style={{ padding:'7px 10px', fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text2)', outline:'none', cursor:'pointer', fontFamily:'var(--font)' }}>
            <option value="all">Semua Kecamatan</option>
            {kecList.map(k=><option key={k} value={k}>{k}</option>)}
          </select>

          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
            {[['all','Semua'],['APPROVED','Approved'],['SUBMITTED','Submitted'],['REJECTED','Rejected']].map(([val,lbl])=>(
              <button key={val} onClick={()=>setFilterStatus(val)} style={{ padding:'5px 10px', fontSize:11, fontWeight:filterStatus===val?600:400, borderRadius:6, border:'none', cursor:'pointer', background:filterStatus===val?'var(--bg5)':'transparent', color:filterStatus===val?'var(--text1)':'var(--text3)', transition:'all .15s' }}>{lbl}</button>
            ))}
          </div>

          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
            {[['all','Semua'],['anomaly','⚠ Anomali'],['clean','Normal']].map(([val,lbl])=>(
              <button key={val} onClick={()=>setFilterAnomaly(val)} style={{ padding:'5px 10px', fontSize:11, fontWeight:filterAnomaly===val?600:400, borderRadius:6, border:'none', cursor:'pointer', background:filterAnomaly===val?(val==='anomaly'?'rgba(244,63,94,0.2)':'var(--bg5)'):'transparent', color:filterAnomaly===val?(val==='anomaly'?'#f87171':'var(--text1)'):'var(--text3)', transition:'all .15s' }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['ID','Kepala Keluarga','Kecamatan / Desa','PCL','Nama Usaha','KBLI','Durasi','Status','Flag'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, fontWeight:700, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map(r=>{
                const cfg = STATUS_CFG[r.status]||STATUS_CFG.SUBMITTED;
                const hasCrit = r.flags?.some(f=>f.sev==='crit');
                const durColor = r.durMenit!==null&&r.durMenit<=2?'#f87171':r.durMenit>480?'#fbbf24':'var(--text2)';
                return (
                  <tr key={r.id} onClick={()=>setSelected(r)}
                    style={{ borderBottom:'1px solid var(--border)', background:r.anomaly?'rgba(244,63,94,0.02)':'transparent', cursor:'pointer', transition:'background .1s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background=r.anomaly?'rgba(244,63,94,0.02)':'transparent'}>
                    <td style={{ padding:'9px 10px', fontSize:10, color:'var(--text4)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>{r.id}</td>
                    <td style={{ padding:'9px 10px', whiteSpace:'nowrap' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{r.namaKepala}</div>
                      {r.namaPasangan&&<div style={{ fontSize:10, color:'var(--text3)' }}>/ {r.namaPasangan}</div>}
                    </td>
                    <td style={{ padding:'9px 10px', whiteSpace:'nowrap' }}>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{r.kecamatan}</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>{r.desa}</div>
                    </td>
                    <td style={{ padding:'9px 10px', fontSize:11, color:'var(--text3)', whiteSpace:'nowrap' }}>{r.petugas}</td>
                    <td style={{ padding:'9px 10px', fontSize:11, color:'var(--text2)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {r.namaUsaha!=='—'?r.namaUsaha:<span style={{ color:'var(--text4)', fontStyle:'italic' }}>—</span>}
                    </td>
                    <td style={{ padding:'9px 10px' }}>
                      {r.kbli?<span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--indigo3)' }}>{r.kbli}</span>
                       :r.namaUsaha!=='—'?<span style={{ fontSize:10, color:'#f87171', fontWeight:600 }}>kosong</span>
                       :<span style={{ color:'var(--text4)' }}>—</span>}
                    </td>
                    <td style={{ padding:'9px 10px', fontSize:11, fontFamily:'var(--mono)', color:durColor, fontWeight:600 }}>{r.durLabel}</td>
                    <td style={{ padding:'9px 10px' }}><Badge variant={cfg.variant}><cfg.Icon size={9} strokeWidth={2}/> {cfg.label}</Badge></td>
                    <td style={{ padding:'9px 10px' }}>
                      {r.anomaly?<Badge variant={hasCrit?'crit':'warn'}><AlertTriangle size={9} strokeWidth={2}/> {r.flags?.length}</Badge>
                       :<span style={{ fontSize:10, color:'var(--text4)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{ textAlign:'center', padding:'40px 0', color:'var(--text4)', fontSize:13 }}>Tidak ada record yang sesuai filter</div>}
        </div>

        {/* Pagination */}
        {totalPages>1&&(
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:11, color:'var(--text3)' }}>
              Hal. {currentPage} / {totalPages} &nbsp;·&nbsp; {filtered.length} records &nbsp;·&nbsp; {PAGE_SIZE}/hal
            </span>

            <div style={{ display:'flex', gap:3, alignItems:'center' }}>
              <button onClick={()=>goPage(1)} disabled={currentPage===1} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===1?'var(--text4)':'var(--text2)', cursor:currentPage===1?'default':'pointer' }}>«</button>
              <button onClick={()=>goPage(currentPage-1)} disabled={currentPage===1} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===1?'var(--text4)':'var(--text2)', cursor:currentPage===1?'default':'pointer', display:'flex', alignItems:'center', gap:2 }}><ChevronLeft size={11} strokeWidth={2}/>Prev</button>

              {pageNums.map((pg,i)=>{
                const prev = pageNums[i-1];
                return [
                  prev && pg-prev>1 ? <span key={`e${pg}`} style={{ fontSize:11, color:'var(--text4)', padding:'0 2px' }}>…</span> : null,
                  <button key={pg} onClick={()=>goPage(pg)} style={{ width:30, height:30, fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:currentPage===pg?'rgba(99,102,241,0.2)':'var(--bg3)', color:currentPage===pg?'var(--indigo3)':'var(--text2)', cursor:'pointer', fontWeight:currentPage===pg?600:400 }}>{pg}</button>
                ];
              })}

              <button onClick={()=>goPage(currentPage+1)} disabled={currentPage===totalPages} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===totalPages?'var(--text4)':'var(--text2)', cursor:currentPage===totalPages?'default':'pointer', display:'flex', alignItems:'center', gap:2 }}>Next<ChevronRight size={11} strokeWidth={2}/></button>
              <button onClick={()=>goPage(totalPages)} disabled={currentPage===totalPages} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===totalPages?'var(--text4)':'var(--text2)', cursor:currentPage===totalPages?'default':'pointer' }}>»</button>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text3)' }}>
              Ke hal.
              <input type="number" min={1} max={totalPages}
                onKeyDown={e=>{if(e.key==='Enter'){const v=parseInt(e.target.value);if(v>=1&&v<=totalPages)goPage(v);e.target.value='';}}}
                style={{ width:42, padding:'4px 6px', fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text1)', outline:'none', textAlign:'center', fontFamily:'var(--mono)' }}/>
            </div>
          </div>
        )}
      </Card>

      {selected&&<DetailModal row={selected} onClose={()=>setSelected(null)}/>}
    </div>
  );
}
