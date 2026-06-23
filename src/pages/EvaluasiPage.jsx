/**
 * src/pages/EvaluasiPage.jsx
 * ===========================
 * Halaman evaluasi seluruh petugas (Pencacah + Pengawas).
 *
 * Pencacah : total tugas, approved, rata-rata durasi pengisian, kecepatan
 * Pengawas : total diawasi, approved, latensi approval (hari), kecepatan approval
 */
import { useState, useEffect } from 'react';
import {
  Users, TrendingUp, Clock, CheckCircle, XCircle,
  BarChart2, MapPin, Search, ChevronDown, ChevronUp,
  Shield, Eye,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Card, SectionTitle, Badge, ProgressBar } from '../components/ui.jsx';
import { useKecamatan } from '../context/KecamatanContext.jsx';

// helper: bandingkan kecamatan case-insensitive
const matchKec = (a, b) => (a||'').toLowerCase() === (b||'').toLowerCase();

const TOKEN_KEY = 'ews_token';
const getBase   = () => (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

async function apiFetch(path) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${getBase()}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function Skeleton({ h = 80 }) {
  return <div style={{ height: h, borderRadius: 8, background: 'linear-gradient(90deg,var(--bg3) 25%,var(--bg4) 50%,var(--bg3) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>;
}

// ── Mini stat card ────────────────────────────────────────────────────────
function Mini({ label, value, color, icon: Icon }) {
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 13px', flex: 1, minWidth: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        {Icon && <Icon size={10} color={color || 'var(--text3)'} strokeWidth={2}/>}
        <span style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: color || 'var(--text1)', fontFamily: 'var(--mono)' }}>{value ?? '—'}</div>
    </div>
  );
}

// ── Bar chart per kecamatan (horizontal) ─────────────────────────────────
function KecChart({ perKec }) {
  const data = Object.entries(perKec)
    .map(([kec, d]) => ({
      kec: kec.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' '),
      approved: d.approved, total: d.total,
    }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={data.length * 26 + 16}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
        <XAxis type="number" hide/>
        <YAxis type="category" dataKey="kec" tick={{ fontSize: 10, fill: 'var(--text3)' }} width={120} axisLine={false} tickLine={false}/>
        <Tooltip
          formatter={(v, _, p) => [`${v} / ${p.payload.total}`, 'Approved']}
          contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }}
        />
        <Bar dataKey="approved" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={
              d.total === 0 ? 'var(--bg4)' :
              d.approved / d.total >= 0.5 ? '#10b981' :
              d.approved / d.total >= 0.2 ? '#f59e0b' : 'rgba(99,102,241,0.5)'}/>
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Row pencacah ──────────────────────────────────────────────────────────
function PencacahRow({ p, rank }) {
  const [open, setOpen] = useState(false);
  const fc = p.pctApproved >= 50 ? '#10b981' : p.pctApproved >= 20 ? '#f59e0b' : '#f43f5e';
  const fv = p.pctApproved >= 50 ? 'ok' : p.pctApproved >= 20 ? 'warn' : 'crit';

  return (
    <>
      <tr onClick={() => setOpen(v => !v)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{rank}</td>
        <td style={{ padding: '9px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{p.nama || '—'}</div>
          <div style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{p.email}</div>
        </td>
        <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
          {(p.kecamatan||'').split(' ').map(w => w[0]+w.slice(1).toLowerCase()).join(' ')}
        </td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>{p.total}</td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: '#10b981', fontWeight: 600, textAlign: 'right' }}>{p.approved}</td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: '#f43f5e', textAlign: 'right' }}>{p.reject}</td>
        <td style={{ padding: '9px 10px', minWidth: 110 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1 }}><ProgressBar pct={p.pctApproved} color={fc} height={4}/></div>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: fc, fontWeight: 600, width: 36, textAlign: 'right', flexShrink: 0 }}>{p.pctApproved}%</span>
          </div>
        </td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>
          {p.avgDurHari != null ? `${p.avgDurHari}h` : '—'}
        </td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>
          {p.kecepatan != null ? `${p.kecepatan}/hr` : '—'}
        </td>
        <td style={{ padding: '9px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Badge variant={fv}>{p.pctApproved >= 50 ? '✓ Baik' : p.pctApproved >= 20 ? '~ Sedang' : '⚠ Lambat'}</Badge>
            {open ? <ChevronUp size={11} color="var(--text4)"/> : <ChevronDown size={11} color="var(--text4)"/>}
          </div>
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td colSpan={10} style={{ padding: '0 10px 14px 44px', background: 'rgba(99,102,241,0.03)' }}>
            <div style={{ paddingTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
                <Mini label="Total Tugas"   value={p.total}                                icon={BarChart2}   />
                <Mini label="Approved"      value={p.approved}  color="#10b981"            icon={CheckCircle} />
                <Mini label="Pending"       value={p.open}      color="#f59e0b"            icon={Clock}       />
                <Mini label="Rejected"      value={p.reject}    color="#f43f5e"            icon={XCircle}     />
                <Mini label="Avg Pengisian" value={p.avgDurHari != null ? `${p.avgDurHari} hari` : '—'} icon={Clock}/>
                <Mini label="Kecepatan"     value={p.kecepatan != null ? `${p.kecepatan}/hr` : '—'} color="var(--indigo3)" icon={TrendingUp}/>
              </div>
              {p.perKecamatan && Object.keys(p.perKecamatan).length > 0 && (
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, fontWeight: 600 }}>Per Kecamatan</div>
                  <KecChart perKec={p.perKecamatan}/>
                </div>
              )}
            </div>
            {p.lastActive && <div style={{ fontSize: 9, color: 'var(--text4)', marginTop: 8 }}>Terakhir aktif: {new Date(p.lastActive).toLocaleString('id-ID')}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Row pengawas ──────────────────────────────────────────────────────────
function PengawasRow({ p, rank }) {
  const [open, setOpen] = useState(false);
  const fc = p.pctApproved >= 70 ? '#10b981' : p.pctApproved >= 40 ? '#f59e0b' : '#f43f5e';
  const fv = p.pctApproved >= 70 ? 'ok' : p.pctApproved >= 40 ? 'warn' : 'crit';
  // Latensi: hijau < 3 hari, kuning < 7, merah >= 7
  const lc = p.avgLatHari == null ? 'var(--text2)' : p.avgLatHari < 3 ? '#10b981' : p.avgLatHari < 7 ? '#f59e0b' : '#f43f5e';

  return (
    <>
      <tr onClick={() => setOpen(v => !v)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{rank}</td>
        <td style={{ padding: '9px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{p.nama || '—'}</div>
          <div style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{p.email}</div>
        </td>
        <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
          {(p.kecamatan||'').split(' ').map(w => w[0]+w.slice(1).toLowerCase()).join(' ')}
        </td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>{p.total}</td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: '#10b981', fontWeight: 600, textAlign: 'right' }}>{p.approved}</td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: '#f59e0b', textAlign: 'right' }}>{p.submit}</td>
        <td style={{ padding: '9px 10px', minWidth: 110 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1 }}><ProgressBar pct={p.pctApproved} color={fc} height={4}/></div>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: fc, fontWeight: 600, width: 36, textAlign: 'right', flexShrink: 0 }}>{p.pctApproved}%</span>
          </div>
        </td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: lc, fontWeight: 600, textAlign: 'right' }}>
          {p.avgLatHari != null ? `${p.avgLatHari}h` : '—'}
        </td>
        <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>
          {p.kecepatan != null ? `${p.kecepatan}/hr` : '—'}
        </td>
        <td style={{ padding: '9px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Badge variant={fv}>{p.pctApproved >= 70 ? '✓ Aktif' : p.pctApproved >= 40 ? '~ Sedang' : '⚠ Lambat'}</Badge>
            {open ? <ChevronUp size={11} color="var(--text4)"/> : <ChevronDown size={11} color="var(--text4)"/>}
          </div>
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td colSpan={10} style={{ padding: '0 10px 14px 44px', background: 'rgba(167,139,250,0.03)' }}>
            <div style={{ paddingTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
                <Mini label="Total Diawasi"   value={p.total}                                        icon={BarChart2}   />
                <Mini label="Approved"         value={p.approved}  color="#10b981"                   icon={CheckCircle} />
                <Mini label="Menunggu Approve" value={p.submit}    color="#f59e0b"                   icon={Clock}       />
                <Mini label="Ditolak"          value={p.reject}    color="#f43f5e"                   icon={XCircle}     />
                <Mini label="Avg Latensi"      value={p.avgLatHari != null ? `${p.avgLatHari} hari` : '—'} color={lc} icon={Clock}/>
                <Mini label="Min Latensi"      value={p.minLatHari != null ? `${p.minLatHari} hari` : '—'} icon={TrendingUp}/>
                <Mini label="Max Latensi"      value={p.maxLatHari != null ? `${p.maxLatHari} hari` : '—'} icon={Clock}/>
                <Mini label="Kecepatan"        value={p.kecepatan != null ? `${p.kecepatan}/hr` : '—'} color="var(--purple)" icon={TrendingUp}/>
              </div>
              {p.perKecamatan && Object.keys(p.perKecamatan).length > 0 && (
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, fontWeight: 600 }}>Per Kecamatan</div>
                  <KecChart perKec={p.perKecamatan}/>
                </div>
              )}
            </div>
            {p.lastActive && <div style={{ fontSize: 9, color: 'var(--text4)', marginTop: 8 }}>Terakhir aktif: {new Date(p.lastActive).toLocaleString('id-ID')}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Tabel generik ─────────────────────────────────────────────────────────
function PetugasTable({ data, role, selectedKec, search, sortBy, setSortBy, sortDir, setSortDir }) {
  const isPengawas = role === 'Pengawas';

  let filtered = data.filter(p => {
    if (selectedKec !== 'all') {
      // case-insensitive key lookup
      const kecKey = Object.keys(p.perKecamatan || {}).find(k => k.toLowerCase() === selectedKec.toLowerCase());
      const kd = kecKey ? p.perKecamatan[kecKey] : null;
      if (!kd || kd.total === 0) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (p.nama||'').toLowerCase().includes(q) || (p.email||'').toLowerCase().includes(q);
    }
    return true;
  });

  // Recompute stats jika filter kecamatan aktif
  if (selectedKec !== 'all') {
    filtered = filtered.map(p => {
      const kecKey = Object.keys(p.perKecamatan || {}).find(k => k.toLowerCase() === selectedKec.toLowerCase());
      const kd = (kecKey ? p.perKecamatan[kecKey] : null) || {};
      const tot = kd.total || 0;
      const appr = kd.approved || 0;
      return { ...p, total: tot, approved: appr, submit: kd.submit||0, reject: kd.reject||0, open: kd.open||0,
               pctApproved: tot > 0 ? Math.round(appr/tot*100*10)/10 : 0 };
    }).filter(p => p.total > 0);
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    const d = sortDir === 'desc' ? -1 : 1;
    if (sortBy === 'approved')   return d * (b.approved - a.approved);
    if (sortBy === 'total')      return d * (b.total - a.total);
    if (sortBy === 'pct')        return d * (b.pctApproved - a.pctApproved);
    if (sortBy === 'dur')        return d * ((a.avgDurHari ?? 999) - (b.avgDurHari ?? 999));
    if (sortBy === 'lat')        return d * ((a.avgLatHari ?? 999) - (b.avgLatHari ?? 999));
    if (sortBy === 'kecepatan')  return d * ((b.kecepatan ?? 0) - (a.kecepatan ?? 0));
    return 0;
  });

  const toggleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const SI = ({ col }) => sortBy === col
    ? <span style={{ fontSize: 8, color: 'var(--indigo3)' }}>{sortDir==='desc'?'▼':'▲'}</span>
    : null;

  const H = ({ label, col, right }) => (
    <th onClick={col ? () => toggleSort(col) : undefined}
      style={{ padding: '8px 10px', textAlign: right ? 'right' : 'left', fontSize: 9, fontWeight: 700,
               color: sortBy === col ? 'var(--indigo3)' : 'var(--text4)',
               textTransform: 'uppercase', letterSpacing: '0.08em',
               cursor: col ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label} <SI col={col}/>
    </th>
  );

  return (
    <>
      <div style={{ fontSize: 10, color: 'var(--text4)', marginBottom: 10 }}>
        {filtered.length} {isPengawas ? 'pengawas' : 'pencacah'} ditemukan
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <H label="#"/>
              <H label={isPengawas ? 'Pengawas' : 'Pencacah'}/>
              <H label="Kecamatan"/>
              <H label="Total"    col="total"     right/>
              <H label="Approved" col="approved"  right/>
              <H label={isPengawas ? 'Pending' : 'Rejected'} right/>
              <H label="Progress" col="pct"/>
              <H label={isPengawas ? 'Avg Latensi' : 'Avg Durasi'} col={isPengawas ? 'lat' : 'dur'} right/>
              <H label="Kecepatan" col="kecepatan" right/>
              <H label="Status"/>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={10} style={{ textAlign:'center', padding:'32px', color:'var(--text4)', fontSize:13 }}>Tidak ada data</td></tr>
              : filtered.map((p, i) =>
                  isPengawas
                    ? <PengawasRow key={p.email||i} p={p} rank={i+1}/>
                    : <PencacahRow key={p.email||i} p={p} rank={i+1}/>
                )
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export function EvaluasiPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');
  const [activeTab, setActiveTab] = useState('pencacah');
  const [sortBy,  setSortBy]  = useState('approved');
  const [sortDir, setSortDir] = useState('desc');

  const { selectedKec } = useKecamatan();

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/evaluasi')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Reset sort saat ganti tab
  useEffect(() => {
    setSortBy('approved'); setSortDir('desc');
  }, [activeTab]);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
        {Array(5).fill(0).map((_,i) => <Card key={i}><Skeleton h={80}/></Card>)}
      </div>
      <Card><Skeleton h={400}/></Card>
    </div>
  );

  if (error) return (
    <Card accent="crit">
      <div style={{ fontSize:13, color:'#f87171', fontWeight:600 }}>Gagal memuat data evaluasi</div>
      <div style={{ fontSize:12, color:'var(--text3)', marginTop:6 }}>{error}</div>
      <div style={{ fontSize:11, color:'var(--text4)', marginTop:4 }}>
        Pastikan sudah upload: <code>python convert_assignment.py</code> lalu <code>python upload_assignment.py</code>
      </div>
    </Card>
  );

  const { summary = {}, pencacah = [], pengawas = [] } = data || {};
  
  // Belum ada data assignment - tampilkan placeholder informatif
  if (!pencacah.length && !pengawas.length) return (
    <Card>
      <div style={{ textAlign:'center', padding:'48px 24px' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text1)', marginBottom:8 }}>
          Data evaluasi belum tersedia
        </div>
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16, lineHeight:1.7 }}>
          Upload data assignment dari lokal terlebih dahulu:
        </div>
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 20px', display:'inline-block', textAlign:'left' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--indigo3)', marginBottom:6 }}>
            python convert_assignment.py --input assignment_merged__1_.csv
          </div>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--indigo3)' }}>
            python upload_assignment.py --input assignment_stats.json --drop
          </div>
        </div>
      </div>
    </Card>
  );
  const kecLabel = selectedKec === 'all' ? null
    : selectedKec.split(' ').map(w => w[0]+w.slice(1).toLowerCase()).join(' ');

  // Summary cards
  const totalPcl = pencacah.length;
  const totalPws = pengawas.length;
  const totalApprPcl = pencacah.reduce((a,p) => a+p.approved, 0);
  const totalApprPws = pengawas.reduce((a,p) => a+p.approved, 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <Users size={11} color="var(--indigo3)" strokeWidth={2}/>
            <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Pencacah</span>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:'var(--indigo3)', fontFamily:'var(--mono)' }}>{totalPcl}</div>
          <div style={{ fontSize:10, color:'var(--text4)', marginTop:4 }}>{totalApprPcl} approved</div>
        </Card>
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <Shield size={11} color="var(--purple)" strokeWidth={2}/>
            <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Pengawas</span>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:'var(--purple)', fontFamily:'var(--mono)' }}>{totalPws}</div>
          <div style={{ fontSize:10, color:'var(--text4)', marginTop:4 }}>{totalApprPws} diapprove</div>
        </Card>
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <BarChart2 size={11} color="var(--text3)" strokeWidth={2}/>
            <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Total Assignment</span>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:'var(--text1)', fontFamily:'var(--mono)' }}>{(summary.totalAssignment||0).toLocaleString('id')}</div>
          <div style={{ fontSize:10, color:'var(--text4)', marginTop:4 }}>{summary.totalKecamatan} kecamatan</div>
        </Card>
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <CheckCircle size={11} color="#10b981" strokeWidth={2}/>
            <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Total Approved</span>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:'#10b981', fontFamily:'var(--mono)' }}>{(summary.approved||0).toLocaleString('id')}</div>
          <div style={{ fontSize:10, color:'var(--text4)', marginTop:4 }}>
            {summary.totalAssignment ? Math.round(summary.approved/summary.totalAssignment*100) : 0}% dari total
          </div>
        </Card>
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <Clock size={11} color="#f59e0b" strokeWidth={2}/>
            <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Menunggu Approve</span>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:'#f59e0b', fontFamily:'var(--mono)' }}>{(summary.submit||0).toLocaleString('id')}</div>
          <div style={{ fontSize:10, color:'var(--text4)', marginTop:4 }}>belum ditinjau pengawas</div>
        </Card>
      </div>

      {/* Tab + tabel */}
      <Card>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          {/* Tab selector */}
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:9, padding:3, gap:2 }}>
            {[
              { key:'pencacah', label:`📋 Pencacah (${totalPcl})`, color:'var(--indigo3)' },
              { key:'pengawas', label:`🛡 Pengawas (${totalPws})`, color:'var(--purple)' },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ padding:'6px 16px', fontSize:12, fontWeight:activeTab===t.key?600:400, borderRadius:7, border:'none', cursor:'pointer',
                         background:activeTab===t.key?'var(--bg5)':'transparent',
                         color:activeTab===t.key?t.color:'var(--text3)', transition:'all .15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {kecLabel && <Badge variant="info"><MapPin size={9} strokeWidth={2}/> {kecLabel}</Badge>}
            {/* Search */}
            <div style={{ position:'relative' }}>
              <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }}/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama / email…"
                style={{ padding:'6px 10px 6px 26px', fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text1)', outline:'none', fontFamily:'var(--font)', width:200 }}/>
            </div>
          </div>
        </div>

        {/* Keterangan kolom kontekstual */}
        {activeTab === 'pengawas' && (
          <div style={{ fontSize:10, color:'var(--text4)', marginBottom:10, padding:'6px 10px', background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)', borderRadius:7 }}>
            💡 <strong>Avg Latensi</strong>: rata-rata hari dari tugas disubmit pencacah hingga diapprove pengawas.
            Hijau &lt;3 hari · Kuning &lt;7 hari · Merah ≥7 hari
          </div>
        )}

        <PetugasTable
          data={activeTab === 'pencacah' ? pencacah : pengawas}
          role={activeTab === 'pencacah' ? 'Pencacah' : 'Pengawas'}
          selectedKec={selectedKec}
          search={search}
          sortBy={sortBy} setSortBy={setSortBy}
          sortDir={sortDir} setSortDir={setSortDir}
        />

        <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid var(--border)', fontSize:9, color:'var(--text4)' }}>
          Data per {new Date(summary?.generatedAt || Date.now()).toLocaleDateString('id-ID')} · {(summary?.totalAssignment||0).toLocaleString('id')} total assignment
        </div>
      </Card>
    </div>
  );
}