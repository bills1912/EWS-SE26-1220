// src/pages/RespondenPage.jsx — versi data real dari MongoDB
import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, X, AlertTriangle, CheckCircle, Clock,
  User, MapPin, Briefcase, Tag, DollarSign,
  Users, Home, ChevronLeft, ChevronRight,
  Droplets, Zap, Shield, TrendingUp, TrendingDown,
  Building, Activity, Leaf,
} from 'lucide-react';
import { Card, SectionTitle, Badge } from '../components/ui.jsx';
import { useResponden, useKecamatan } from '../hooks/useEWSData.js';

const STATUS_CFG = {
  APPROVED:  { variant:'ok',      label:'Approved',  Icon:CheckCircle },
  SUBMITTED: { variant:'neutral', label:'Submitted', Icon:Clock },
  REJECTED:  { variant:'crit',    label:'Rejected',  Icon:X },
};

function Field({ label, value, Icon, danger, mono }) {
  return (
    <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px', border:`1px solid ${danger?'rgba(244,63,94,0.3)':'var(--border)'}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, marginBottom:5 }}>
        {Icon && <Icon size={9} strokeWidth={2}/>} {label}
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:danger?'#f87171':'var(--text1)', fontFamily:mono?'var(--mono)':'inherit', lineHeight:1.3 }}>
        {value && value !== '—' ? value : <span style={{ color:'var(--text4)', fontStyle:'italic', fontWeight:400 }}>—</span>}
      </div>
    </div>
  );
}

// ── Modal pages ────────────────────────────────────────────────────────────
function Page0({ r }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Kepala Keluarga</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="No. KK"       value={r.noKK}           Icon={Tag}    mono/>
          <Field label="NIK Kepala"   value={r.nik}            Icon={Shield} mono/>
          <Field label="Nama Kepala"  value={r.namaKepala}     Icon={User}/>
          <Field label="Nama Pasangan"value={r.namaPasangan}   Icon={User}/>
          <Field label="Domisili"     value={r.domisili}       Icon={MapPin} danger={r.domisili?.includes('Tidak')}/>
          <Field label="Alamat"       value={r.alamat}         Icon={MapPin}/>
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Wilayah</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Kecamatan" value={r.kecamatan} Icon={MapPin}/>
          <Field label="Desa"      value={r.desa}       Icon={MapPin}/>
          <Field label="SLS"       value={r.sls}        Icon={MapPin}/>
          <Field label="Sub-SLS"   value={r.subSls}     Icon={MapPin}/>
        </div>
      </div>
      {r.geotag && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Lokasi</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="Latitude"  value={r.geotag.lat} Icon={MapPin} mono/>
            <Field label="Longitude" value={r.geotag.lon} Icon={MapPin} mono/>
          </div>
          <a href={r.geotag.url} target="_blank" rel="noreferrer"
             style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:8, fontSize:11, color:'var(--indigo3)', textDecoration:'none' }}>
            <MapPin size={11}/> Lihat di Google Maps ↗
          </a>
        </div>
      )}
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
          Anggota Keluarga
          <span style={{ marginLeft:8, color:'var(--indigo3)', fontWeight:600 }}>{r.jumlahAk} orang</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {(r.anggotaKeluarga||[]).map((ak, i) => (
            <div key={i} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:i===0?'rgba(99,102,241,0.15)':'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <User size={13} color={i===0?'var(--indigo3)':'var(--text3)'} strokeWidth={2}/>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{ak.nama}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{ak.hubungan} {ak.jk && ak.jk!=='—' ? `· ${ak.jk}` : ''} {ak.umur ? `· ${ak.umur} th` : ''}</div>
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, paddingLeft:38 }}>
                {ak.profesi && ak.profesi!=='—' && <Badge variant="neutral" style={{fontSize:9}}>{ak.profesi}</Badge>}
                {ak.ijazah  && ak.ijazah!=='—'  && <Badge variant="info"    style={{fontSize:9}}>{ak.ijazah}</Badge>}
                {ak.statusKawin && ak.statusKawin!=='—' && <Badge variant="neutral" style={{fontSize:9}}>{ak.statusKawin}</Badge>}
                {(ak.disabilitas||[]).length>0 && <Badge variant="warn" style={{fontSize:9}}>⚠ Disabilitas</Badge>}
                {(ak.sakitKronis||[]).length>0 && <Badge variant="warn" style={{fontSize:9}}>Sakit Kronis</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Waktu Pendataan</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="PCL"           value={r.petugas}  Icon={User}/>
          <Field label="Role"          value={r.role}     Icon={Shield}/>
          <Field label="Mulai"         value={r.mulai}    Icon={Clock} mono/>
          <Field label="Selesai"       value={r.selesai}  Icon={Clock} mono/>
          <Field label="Durasi"        value={r.durLabel} Icon={Clock} danger={r.durMenit!==null&&(r.durMenit<=2||r.durMenit>480)} mono/>
          <Field label="Tgl Diubah"    value={r.tglDiubah} Icon={Clock}/>
        </div>
        {(r.kunjungan||[]).length > 0 && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Log Kunjungan PML</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {r.kunjungan.map((k,i) => (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'center', fontSize:11, color:'var(--text2)' }}>
                  <span style={{ color:'var(--indigo3)', fontFamily:'var(--mono)', fontSize:10, minWidth:16 }}>#{k.ke}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10 }}>{k.waktu}</span>
                  {k.catatan && k.catatan!=='—' && <span style={{ color:'var(--text3)' }}>— {k.catatan}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Page1({ r }) {
  const usahaList = r.usaha || [];
  if (usahaList.length === 0) return (
    <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text4)', fontSize:13 }}>Tidak ada usaha yang terdata</div>
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {usahaList.map((u, i) => (
        <div key={i} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <Badge variant="info" style={{fontSize:9}}>Usaha #{u.no}</Badge>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text1)', flex:1 }}>{u.namaUsaha}</span>
            <Badge variant={u.keberadaan?.includes('Ditemukan')?'ok':u.keberadaan?.includes('Tutup')?'crit':'warn'}>
              {u.keberadaan || '—'}
            </Badge>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label="KBLI"         value={u.kbli||'Kosong'} Icon={Tag}       mono danger={!u.kbli}/>
            <Field label="Kategori"     value={u.kategori}       Icon={Tag}/>
            <Field label="Kegiatan Utama" value={u.kegUtama}    Icon={Activity}/>
            <Field label="Produk"       value={u.produk}         Icon={Leaf}/>
            <Field label="Skala"        value={u.skalaUsaha}     Icon={Building}/>
            <Field label="Badan Usaha"  value={u.badanUsaha}     Icon={Building}/>
            <Field label="Tahun Mulai"  value={u.tahunOperasi}   Icon={Clock}/>
            <Field label="NIB"          value={u.punya_nib}      Icon={Tag}/>
            <Field label="TK Total"     value={`L:${u.tkLaki} P:${u.tkPr} (${u.totalTK})`} Icon={Users}/>
            <Field label="TK Dibayar"   value={`${u.tkDibayar} / ${u.totalTK}`} Icon={Users}/>
            <Field label="Internet"     value={u.internet}       Icon={Zap}/>
            <Field label="Mitra KDKMP"  value={u.mitraKdkmp}    Icon={Tag}/>
            <Field label="Pendapatan/Bln" value={u.nilaiPendapatan} Icon={DollarSign} danger={u.nilaiPendapatanRaw>500_000_000}/>
            <Field label="Aset Usaha"   value={u.asetUsaha}      Icon={DollarSign}/>
            <Field label="Total Pend"   value={u.totalPendapatan} Icon={TrendingUp}/>
            <Field label="Total Pengeluar" value={u.totalPengeluaran} Icon={TrendingDown}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function Page2({ r }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Kondisi Hunian</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Luas Lantai"         value={r.luasLantai}         Icon={Home}/>
          <Field label="Status Kepemilikan"  value={r.statusKepemilikan}  Icon={Shield}/>
          <Field label="Jenis Bangunan"      value={r.jnsBangunan}        Icon={Home}/>
          <Field label="Jenis Lantai"        value={r.jenisLantai}        Icon={Home}/>
          <Field label="Kondisi Lantai"      value={r.kondisiLantai}      Icon={Home}/>
          <Field label="Jenis Dinding"       value={r.jenisDinding}       Icon={Home}/>
          <Field label="Kondisi Dinding"     value={r.kondisiDinding}     Icon={Home}/>
          <Field label="Jenis Atap"          value={r.jenisAtap}          Icon={Home}/>
          <Field label="Kondisi Atap"        value={r.kondisiAtap}        Icon={Home}/>
          <Field label="Air Minum"           value={r.airMinum}           Icon={Droplets}/>
          <Field label="Penerangan"          value={r.penerangan}         Icon={Zap}/>
          <Field label="Tempat BAB"          value={r.tempatBAB}          Icon={Home}/>
          <Field label="Pembuangan Tinja"    value={r.buangTinja}         Icon={Home}/>
        </div>
      </div>
      {r.asetRumahTangga && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Aset Rumah Tangga</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[
              ['Tabung 3kg',  r.asetRumahTangga.tabung3kg + ' buah'],
              ['Motor',       r.asetRumahTangga.motor + ' unit'],
              ['Mobil',       r.asetRumahTangga.mobil + ' unit'],
              ['Kulkas',      r.asetRumahTangga.kulkas + ' unit'],
              ['AC',          r.asetRumahTangga.ac + ' unit'],
              ['Laptop',      r.asetRumahTangga.laptop + ' unit'],
              ['Lahan',       r.asetRumahTangga.lahan + ' bidang'],
              ['Listrik/bln', `Rp ${(r.asetRumahTangga.listrikSebulan||0).toLocaleString('id')}`],
              ['Pulsa/bln',   `Rp ${(r.asetRumahTangga.pulsaSebulan||0).toLocaleString('id')}`],
            ].map(([lbl,val]) => (
              <div key={lbl} style={{ background:'var(--bg4)', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'var(--text4)', marginBottom:3 }}>{lbl}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)', fontFamily:'var(--mono)' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Page3({ r }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Keuangan Keluarga</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Pendapatan Keluarga/Bln"   value={r.pendapatanKeluarga}  Icon={TrendingUp}/>
          <Field label="Pengeluaran Keluarga/Bln"  value={r.pengeluaranKeluarga} Icon={TrendingDown}/>
        </div>
      </div>
      {r.catatan && r.catatan !== '—' && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Catatan PCL</div>
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>{r.catatan}</div>
        </div>
      )}
    </div>
  );
}

const MODAL_PAGES = ['Identitas & Lokasi','Usaha','Hunian','Ekonomi Keluarga'];

function DetailModal({ row, onClose }) {
  const [page, setPage] = useState(0);
  if (!row) return null;
  const sCfg = STATUS_CFG[row.status] || STATUS_CFG.SUBMITTED;
  const hasCrit = row.flags?.some(f => f.sev === 'crit');
  const pages = [<Page0 r={row}/>, <Page1 r={row}/>, <Page2 r={row}/>, <Page3 r={row}/>];

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:16, width:'100%', maxWidth:720, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', animation:'modalIn .25s ease both' }}>
        {/* Header */}
        <div style={{ flexShrink:0, background:'var(--bg2)' }}>
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
          {row.flags?.length > 0 && (
            <div style={{ margin:'12px 24px 0', padding:'10px 14px', background:hasCrit?'rgba(244,63,94,0.06)':'rgba(245,158,11,0.06)', border:`1px solid ${hasCrit?'rgba(244,63,94,0.2)':'rgba(245,158,11,0.2)'}`, borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7, fontSize:11, fontWeight:600, color:hasCrit?'#f87171':'#fbbf24' }}>
                <AlertTriangle size={11} strokeWidth={2}/> Anomali terdeteksi
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {row.flags.map((f,i) => <Badge key={i} variant={f.sev==='crit'?'crit':'warn'}>{f.text}</Badge>)}
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:0, padding:'12px 24px 0', borderBottom:'1px solid var(--border)' }}>
            {MODAL_PAGES.map((label,i) => (
              <button key={i} onClick={() => setPage(i)} style={{ padding:'7px 14px', fontSize:11, fontWeight:page===i?600:400, color:page===i?'var(--indigo3)':'var(--text3)', background:'transparent', border:'none', cursor:'pointer', borderBottom:`2px solid ${page===i?'var(--indigo)':'transparent'}`, marginBottom:-1, transition:'all .15s', whiteSpace:'nowrap' }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', overscrollBehavior:'contain', padding:'16px 24px' }}>
          {pages[page]}
        </div>
        <div style={{ flexShrink:0, padding:'12px 24px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg2)' }}>
          <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:page===0?'default':'pointer', background:'var(--bg3)', border:'1px solid var(--border)', color:page===0?'var(--text4)':'var(--text2)' }}>
            <ChevronLeft size={13} strokeWidth={2}/> Sebelumnya
          </button>
          <span style={{ fontSize:11, color:'var(--text3)' }}>{page+1} / {MODAL_PAGES.length}</span>
          {page < MODAL_PAGES.length-1
            ? <button onClick={() => setPage(p=>p+1)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', color:'var(--indigo3)' }}>Berikutnya <ChevronRight size={13} strokeWidth={2}/></button>
            : <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)' }}>Tutup</button>
          }
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function RespondenPage() {
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [filterAnomaly, setFilterAnomaly] = useState('all');
  const [filterKec, setFilterKec]         = useState('all');
  const [currentPage, setCurrentPage]     = useState(1);
  const [selected, setSelected]           = useState(null);

  const { data: kecList } = useKecamatan();
  const PAGE_SIZE = 15;

  const queryParams = useMemo(() => ({
    page:  currentPage,
    limit: PAGE_SIZE,
    ...(filterKec    !== 'all' && { kecamatan: filterKec }),
    ...(filterStatus !== 'all' && { status: filterStatus }),
    ...(filterAnomaly !== 'all' && { anomaly: filterAnomaly }),
    ...(search && { q: search }),
  }), [currentPage, filterKec, filterStatus, filterAnomaly, search]);

  const { data: records, total, totalPages, loading } = useResponden(queryParams);

  // Reset halaman saat filter berubah
  const updateFilter = useCallback((fn) => { fn(); setCurrentPage(1); }, []);

  const goPage = (p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)));

  const pageNums = useMemo(() => {
    if (totalPages <= 7) return Array.from({length: totalPages}, (_,i) => i+1);
    const nums = new Set([1, totalPages, currentPage]);
    for (let d=-2; d<=2; d++) { const n=currentPage+d; if(n>=1&&n<=totalPages) nums.add(n); }
    return [...nums].sort((a,b)=>a-b);
  }, [totalPages, currentPage]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Card>
        <SectionTitle icon={Users} right={<Badge variant="neutral">{loading?'…':total.toLocaleString('id')} records</Badge>}>
          Tabel pendataan responden
        </SectionTitle>

        {/* Controls */}
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ flex:'1 1 180px', minWidth:160, position:'relative' }}>
            <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }}/>
            <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Nama KK, ID, No.KK, usaha, PCL…"
              style={{ width:'100%', padding:'7px 10px 7px 29px', fontSize:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text1)', outline:'none', fontFamily:'var(--font)' }}/>
          </div>
          <select value={filterKec} onChange={e => { setFilterKec(e.target.value); setCurrentPage(1); }}
            style={{ padding:'7px 10px', fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text2)', outline:'none', cursor:'pointer' }}>
            <option value="all">Semua Kecamatan</option>
            {(kecList||[]).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
            {[['all','Semua'],['APPROVED','Approved'],['SUBMITTED','Submitted'],['REJECTED','Rejected']].map(([val,lbl]) => (
              <button key={val} onClick={() => { setFilterStatus(val); setCurrentPage(1); }}
                style={{ padding:'5px 10px', fontSize:11, fontWeight:filterStatus===val?600:400, borderRadius:6, border:'none', cursor:'pointer', background:filterStatus===val?'var(--bg5)':'transparent', color:filterStatus===val?'var(--text1)':'var(--text3)', transition:'all .15s' }}>{lbl}</button>
            ))}
          </div>
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
            {[['all','Semua'],['anomaly','⚠ Anomali'],['clean','Normal']].map(([val,lbl]) => (
              <button key={val} onClick={() => { setFilterAnomaly(val); setCurrentPage(1); }}
                style={{ padding:'5px 10px', fontSize:11, fontWeight:filterAnomaly===val?600:400, borderRadius:6, border:'none', cursor:'pointer', background:filterAnomaly===val?(val==='anomaly'?'rgba(244,63,94,0.2)':'var(--bg5)'):'transparent', color:filterAnomaly===val?(val==='anomaly'?'#f87171':'var(--text1)'):'var(--text3)', transition:'all .15s' }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['ID','Kepala Keluarga','Kecamatan / Desa','PCL','Nama Usaha','KBLI','Durasi','Status','Flag'].map(h => (
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, fontWeight:700, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(PAGE_SIZE).fill(0).map((_,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                      {Array(9).fill(0).map((_,j) => (
                        <td key={j} style={{ padding:'12px 10px' }}>
                          <div style={{ height:12, borderRadius:4, background:'var(--bg3)', width: j===1?120:j===4?100:60 }}/>
                        </td>
                      ))}
                    </tr>
                  ))
                : records.map(r => {
                  const cfg = STATUS_CFG[r.status] || STATUS_CFG.SUBMITTED;
                  const hasCrit = r.flags?.some(f => f.sev==='crit');
                  const durColor = r.durMenit !== null && r.durMenit <= 2 ? '#f87171' : r.durMenit > 480 ? '#fbbf24' : 'var(--text2)';
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}
                      style={{ borderBottom:'1px solid var(--border)', background:r.anomaly?'rgba(244,63,94,0.02)':'transparent', cursor:'pointer', transition:'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e => e.currentTarget.style.background=r.anomaly?'rgba(244,63,94,0.02)':'transparent'}>
                      <td style={{ padding:'9px 10px', fontSize:10, color:'var(--text4)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>{r.id}</td>
                      <td style={{ padding:'9px 10px', whiteSpace:'nowrap' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)' }}>{r.namaKepala}</div>
                        {r.namaPasangan && <div style={{ fontSize:10, color:'var(--text3)' }}>/ {r.namaPasangan}</div>}
                      </td>
                      <td style={{ padding:'9px 10px', whiteSpace:'nowrap' }}>
                        <div style={{ fontSize:11, color:'var(--text2)' }}>{r.kecamatan}</div>
                        <div style={{ fontSize:10, color:'var(--text3)' }}>{r.desa}</div>
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:11, color:'var(--text3)', whiteSpace:'nowrap' }}>{r.petugas}</td>
                      <td style={{ padding:'9px 10px', fontSize:11, color:'var(--text2)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.namaUsaha && r.namaUsaha!=='—' ? r.namaUsaha : <span style={{ color:'var(--text4)', fontStyle:'italic' }}>—</span>}
                      </td>
                      <td style={{ padding:'9px 10px' }}>
                        {r.kbli
                          ? <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--indigo3)' }}>{r.kbli}</span>
                          : r.namaUsaha && r.namaUsaha!=='—'
                            ? <span style={{ fontSize:10, color:'#f87171', fontWeight:600 }}>kosong</span>
                            : <span style={{ color:'var(--text4)' }}>—</span>}
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:11, fontFamily:'var(--mono)', color:durColor, fontWeight:600 }}>{r.durLabel||'—'}</td>
                      <td style={{ padding:'9px 10px' }}><Badge variant={cfg.variant}><cfg.Icon size={9} strokeWidth={2}/> {cfg.label}</Badge></td>
                      <td style={{ padding:'9px 10px' }}>
                        {r.anomaly ? <Badge variant={hasCrit?'crit':'warn'}><AlertTriangle size={9} strokeWidth={2}/> {r.flags?.length}</Badge>
                                   : <span style={{ fontSize:10, color:'var(--text4)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {!loading && records.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text4)', fontSize:13 }}>Tidak ada record yang sesuai filter</div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:11, color:'var(--text3)' }}>Hal. {currentPage} / {totalPages} · {total.toLocaleString('id')} records</span>
            <div style={{ display:'flex', gap:3, alignItems:'center' }}>
              <button onClick={() => goPage(1)} disabled={currentPage===1} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===1?'var(--text4)':'var(--text2)', cursor:currentPage===1?'default':'pointer' }}>«</button>
              <button onClick={() => goPage(currentPage-1)} disabled={currentPage===1} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===1?'var(--text4)':'var(--text2)', cursor:currentPage===1?'default':'pointer', display:'flex', alignItems:'center', gap:2 }}><ChevronLeft size={11} strokeWidth={2}/>Prev</button>
              {pageNums.map((pg,i) => {
                const prev = pageNums[i-1];
                return [
                  prev && pg-prev>1 ? <span key={`e${pg}`} style={{ fontSize:11, color:'var(--text4)', padding:'0 2px' }}>…</span> : null,
                  <button key={pg} onClick={() => goPage(pg)} style={{ width:30, height:30, fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:currentPage===pg?'rgba(99,102,241,0.2)':'var(--bg3)', color:currentPage===pg?'var(--indigo3)':'var(--text2)', cursor:'pointer', fontWeight:currentPage===pg?600:400 }}>{pg}</button>
                ];
              })}
              <button onClick={() => goPage(currentPage+1)} disabled={currentPage===totalPages} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===totalPages?'var(--text4)':'var(--text2)', cursor:currentPage===totalPages?'default':'pointer', display:'flex', alignItems:'center', gap:2 }}>Next<ChevronRight size={11} strokeWidth={2}/></button>
              <button onClick={() => goPage(totalPages)} disabled={currentPage===totalPages} style={{ padding:'5px 8px', fontSize:11, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:currentPage===totalPages?'var(--text4)':'var(--text2)', cursor:currentPage===totalPages?'default':'pointer' }}>»</button>
            </div>
          </div>
        )}
      </Card>
      {selected && <DetailModal row={selected} onClose={() => setSelected(null)}/>}
    </div>
  );
}