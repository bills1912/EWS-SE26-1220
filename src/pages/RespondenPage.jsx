import { useState, useMemo } from 'react';
import {
  Search, X, AlertTriangle, CheckCircle, Clock,
  User, MapPin, Briefcase, Tag, DollarSign,
  Users, Filter, ExternalLink,
} from 'lucide-react';
import { Card, SectionTitle, Badge } from '../components/ui.jsx';
import { RESPONDEN } from '../data/dummy.js';

const fmt = (n) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  return `Rp ${n.toLocaleString('id')}`;
};

const STATUS_CFG = {
  APPROVED:  { variant:'ok',      label:'Approved',  icon:CheckCircle },
  SUBMITTED: { variant:'neutral', label:'Submitted', icon:Clock       },
  REJECTED:  { variant:'crit',    label:'Rejected',  icon:X           },
};

const ANOMALY_CFG = {
  crit: { label:'Anomali kritis', variant:'crit' },
  warn: { label:'Perlu cek',      variant:'warn' },
};

function anomalyReasons(r) {
  const reasons = [];
  if (r.dur <= 2  && r.dur >= 0) reasons.push({ text:`Durasi terlalu cepat (${r.dur} mnt)`, sev:'crit' });
  if (r.dur > 480) reasons.push({ text:`Durasi sangat lama (${r.dur} mnt)`, sev:'warn' });
  if (!r.kbli)     reasons.push({ text:'KBLI tidak terisi', sev:'crit' });
  if (r.pendapatan > 500_000_000) reasons.push({ text:`Pendapatan outlier (${fmt(r.pendapatan)}/bln)`, sev:'warn' });
  if (r.ak > 12)   reasons.push({ text:`Jumlah AK tidak wajar (${r.ak} orang)`, sev:'warn' });
  return reasons;
}

/* ── Detail Modal ── */
function DetailModal({ row, onClose }) {
  if (!row) return null;
  const reasons = anomalyReasons(row);
  const sCfg = STATUS_CFG[row.status] || STATUS_CFG.SUBMITTED;
  const SIcon = sCfg.icon;

  const fields = [
    { label:'ID Record',         val:row.id,          icon:Tag         },
    { label:'Nama responden',    val:row.nama,         icon:User        },
    { label:'Kecamatan',         val:row.kec,          icon:MapPin      },
    { label:'Desa/Kelurahan',    val:row.desa,         icon:MapPin      },
    { label:'Nama usaha',        val:row.usaha||'—',   icon:Briefcase   },
    { label:'Kode KBLI',         val:row.kbli||'—',    icon:Tag         },
    { label:'Pendapatan/bulan',  val:fmt(row.pendapatan), icon:DollarSign },
    { label:'Jumlah AK (KK)',    val:`${row.ak} orang`, icon:Users       },
    { label:'PCL',               val:row.pcl,          icon:User        },
    { label:'Durasi pengisian',  val:`${row.dur} menit`, icon:Clock      },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:'20px 24px 0', display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>{row.id}</span>
              <Badge variant={sCfg.variant}><SIcon size={10} strokeWidth={2} /> {sCfg.label}</Badge>
              {row.anomaly && <Badge variant={ANOMALY_CFG[row.anomaly].variant}>{ANOMALY_CFG[row.anomaly].label}</Badge>}
            </div>
            <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text1)', marginBottom:2 }}>{row.nama}</h2>
            <div style={{ fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:4 }}>
              <MapPin size={11} strokeWidth={2} /> {row.desa}, {row.kec}
            </div>
          </div>
          <button onClick={onClose} style={{ padding:8, borderRadius:8, color:'var(--text3)', background:'var(--bg3)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Anomaly flags */}
        {reasons.length > 0 && (
          <div style={{ margin:'16px 24px 0', padding:'12px 14px', background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.18)', borderRadius:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, fontSize:11, fontWeight:600, color:'#f87171' }}>
              <AlertTriangle size={12} strokeWidth={2} /> Anomali terdeteksi
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {reasons.map((r, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:r.sev==='crit'?'#f43f5e':'#f59e0b', flexShrink:0 }} />
                  <span style={{ color:'var(--text2)' }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fields grid */}
        <div style={{ padding:'16px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {fields.map(f => {
            const FIcon = f.icon;
            const isOutlier =
              (f.label === 'Durasi pengisian' && (row.dur <= 2 || row.dur > 480)) ||
              (f.label === 'Pendapatan/bulan' && row.pendapatan > 500_000_000) ||
              (f.label === 'Jumlah AK (KK)' && row.ak > 12) ||
              (f.label === 'Kode KBLI' && !row.kbli);
            return (
              <div key={f.label} style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px', border:`1px solid ${isOutlier ? 'rgba(244,63,94,0.25)' : 'var(--border)'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, marginBottom:5 }}>
                  <FIcon size={10} strokeWidth={2} /> {f.label}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color: isOutlier ? '#f87171' : 'var(--text1)', fontFamily: f.label.includes('KBLI') || f.label.includes('ID') ? 'var(--mono)' : 'inherit' }}>
                  {f.val || <span style={{ color:'var(--text4)', fontStyle:'italic' }}>kosong</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'0 24px 20px', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:8, fontSize:12, fontWeight:500, color:'var(--text2)', background:'var(--bg3)', border:'1px solid var(--border)', cursor:'pointer' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Responden Page ── */
export default function RespondenPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAnomaly, setFilterAnomaly] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    return RESPONDEN.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.nama.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.kec.toLowerCase().includes(q) || r.pcl.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchAnomaly = filterAnomaly === 'all' || (filterAnomaly === 'anomaly' ? !!r.anomaly : !r.anomaly);
      return matchSearch && matchStatus && matchAnomaly;
    });
  }, [search, filterStatus, filterAnomaly]);

  const totals = useMemo(() => ({
    total: RESPONDEN.length,
    anomaly: RESPONDEN.filter(r => r.anomaly).length,
    approved: RESPONDEN.filter(r => r.status === 'APPROVED').length,
    rejected: RESPONDEN.filter(r => r.status === 'REJECTED').length,
  }), []);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Summary strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          { label:'Total ditampilkan', val:totals.total, color:'var(--indigo2)' },
          { label:'Dengan anomali',    val:totals.anomaly, color:'#f87171' },
          { label:'Approved',          val:totals.approved, color:'#34d399' },
          { label:'Rejected',          val:totals.rejected, color:'#f87171' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:22, fontWeight:700, color:s.color, fontFamily:'var(--mono)' }}>{s.val}</span>
            <span style={{ fontSize:11, color:'var(--text3)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <Card>
        <SectionTitle icon={Users} right={<Badge variant="neutral">{filtered.length} records</Badge>}>
          Preview hasil pendataan responden
        </SectionTitle>

        {/* Controls */}
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          {/* Search */}
          <div style={{ flex:1, minWidth:200, position:'relative' }}>
            <Search size={13} strokeWidth={2} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, ID, kecamatan, PCL..."
              style={{
                width:'100%', padding:'8px 10px 8px 32px', fontSize:12,
                background:'var(--bg3)', border:'1px solid var(--border)',
                borderRadius:8, color:'var(--text1)', outline:'none',
                fontFamily:'var(--font)',
              }}
            />
          </div>

          {/* Status filter */}
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
            {[['all','Semua'],['APPROVED','Approved'],['SUBMITTED','Submitted'],['REJECTED','Rejected']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilterStatus(val)} style={{
                padding:'5px 12px', fontSize:11, fontWeight:filterStatus===val?600:400, borderRadius:6, border:'none', cursor:'pointer',
                background:filterStatus===val?'var(--bg5)':'transparent',
                color:filterStatus===val?'var(--text1)':'var(--text3)',
                transition:'all .15s',
              }}>{lbl}</button>
            ))}
          </div>

          {/* Anomaly filter */}
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
            {[['all','Semua'],['anomaly','Ada anomali'],['clean','Normal']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilterAnomaly(val)} style={{
                padding:'5px 12px', fontSize:11, fontWeight:filterAnomaly===val?600:400, borderRadius:6, border:'none', cursor:'pointer',
                background:filterAnomaly===val?(val==='anomaly'?'rgba(244,63,94,0.18)':'var(--bg5)'):'transparent',
                color:filterAnomaly===val?(val==='anomaly'?'#f87171':'var(--text1)'):'var(--text3)',
                transition:'all .15s',
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['ID','Nama Responden','Kecamatan','PCL','Usaha','KBLI','Pendapatan','Durasi','Status','Anomali'].map(h => (
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, fontWeight:700, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const sCfg = STATUS_CFG[r.status] || STATUS_CFG.SUBMITTED;
                const reasons = anomalyReasons(r);
                const isAnomaly = reasons.length > 0;
                const SIcon = sCfg.icon;
                const durColor = r.dur <= 2 ? '#f87171' : r.dur > 480 ? '#fbbf24' : 'var(--text2)';
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{
                      borderBottom:'1px solid var(--border)',
                      background: isAnomaly ? 'rgba(244,63,94,0.025)' : 'transparent',
                      cursor:'pointer', transition:'background .12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = isAnomaly ? 'rgba(244,63,94,0.025)' : 'transparent'}
                  >
                    <td style={{ padding:'10px 10px', fontSize:10, color:'var(--text4)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>{r.id}</td>
                    <td style={{ padding:'10px 10px', fontSize:12, color:'var(--text1)', fontWeight:500, whiteSpace:'nowrap' }}>{r.nama}</td>
                    <td style={{ padding:'10px 10px', fontSize:11, color:'var(--text2)', whiteSpace:'nowrap' }}>{r.kec}</td>
                    <td style={{ padding:'10px 10px', fontSize:11, color:'var(--text3)', whiteSpace:'nowrap' }}>{r.pcl}</td>
                    <td style={{ padding:'10px 10px', fontSize:11, color:'var(--text2)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.usaha || <span style={{ color:'var(--text4)', fontStyle:'italic' }}>—</span>}</td>
                    <td style={{ padding:'10px 10px' }}>
                      {r.kbli
                        ? <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--indigo3)' }}>{r.kbli}</span>
                        : <span style={{ fontSize:10, color:'#f87171', fontWeight:600 }}>kosong</span>}
                    </td>
                    <td style={{ padding:'10px 10px', fontSize:11, fontFamily:'var(--mono)', color: r.pendapatan > 500_000_000 ? '#fbbf24' : 'var(--text2)', whiteSpace:'nowrap' }}>
                      {fmt(r.pendapatan)}
                    </td>
                    <td style={{ padding:'10px 10px', fontSize:11, fontFamily:'var(--mono)', color:durColor, fontWeight:600 }}>{r.dur}m</td>
                    <td style={{ padding:'10px 10px' }}>
                      <Badge variant={sCfg.variant}><SIcon size={9} strokeWidth={2} /> {sCfg.label}</Badge>
                    </td>
                    <td style={{ padding:'10px 10px' }}>
                      {isAnomaly
                        ? <Badge variant={reasons.some(x=>x.sev==='crit')?'crit':'warn'}>
                            <AlertTriangle size={9} strokeWidth={2} />
                            {reasons.length} flag
                          </Badge>
                        : <span style={{ fontSize:10, color:'var(--text4)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text4)', fontSize:13 }}>
              Tidak ada record yang sesuai filter
            </div>
          )}
        </div>
      </Card>

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
