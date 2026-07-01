/**
 * src/components/CrosscheckTable.jsx
 * ─────────────────────────────────────────────────────────────────
 * Tabel crosscheck untuk verifikasi lapangan.
 * Fitur: search real-time, pagination 10/halaman, export CSV.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';

const TOKEN_KEY  = 'ews_token';
const PAGE_SIZE  = 10;
const BASE = () =>
  (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

async function fetchCrosscheck(type, params = {}) {
  const qs  = new URLSearchParams(params);
  const res = await fetch(`${BASE()}/api/crosscheck/${type}?${qs}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function exportCSV(data, filename, columns) {
  const header = columns.map(c => c.label).join(',');
  const rows   = data.map(row =>
    columns.map(c => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')],
    { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// Kolom per tipe
const COLUMNS = {
  nikKK: [
    { key:'no',     label:'No' },
    { key:'id',     label:'ID' },
    { key:'nama',   label:'Nama Kepala Keluarga' },
    { key:'nik',    label:'NIK (9999)' },
    { key:'noKK',   label:'No KK' },
    { key:'kec',    label:'Kecamatan' },
    { key:'desa',   label:'Desa' },
    { key:'sls',    label:'SLS' },
    { key:'pcl',    label:'PCL (Pencacah)' },
    { key:'pml',    label:'PML (Pengawas)' },
    { key:'status', label:'Status' },
  ],
  nikAK: [
    { key:'id',       label:'ID' },
    { key:'namaKK',   label:'Nama Kepala Keluarga' },
    { key:'namaAK',   label:'Nama Anggota' },
    { key:'nikAK',    label:'NIK AK (9999)' },
    { key:'hubungan', label:'Hub. Keluarga' },
    { key:'kec',      label:'Kecamatan' },
    { key:'desa',     label:'Desa' },
    { key:'pcl',      label:'PCL (Pencacah)' },
    { key:'pml',      label:'PML (Pengawas)' },
    { key:'status',   label:'Status' },
  ],
  rekening: [
    { key:'id',       label:'ID' },
    { key:'nama',     label:'Nama Kepala Keluarga' },
    { key:'noKK',     label:'No KK' },
    { key:'kec',      label:'Kecamatan' },
    { key:'desa',     label:'Desa' },
    { key:'sls',      label:'SLS' },
    { key:'jumlahAk', label:'Jml AK' },
    { key:'jawaban',  label:'Jawaban Rekening' },
    { key:'pcl',      label:'PCL (Pencacah)' },
    { key:'pml',      label:'PML (Pengawas)' },
    { key:'status',   label:'Status' },
  ],
  tidakTahu: [
    { key:'id',      label:'ID' },
    { key:'namaKK',  label:'Nama Kepala Keluarga' },
    { key:'noKK',    label:'No KK' },
    { key:'jumlah',  label:'Jml Temuan' },
    { key:'fields',  label:'Field Bermasalah' },
    { key:'kec',     label:'Kecamatan' },
    { key:'desa',    label:'Desa' },
    { key:'pcl',     label:'PCL (Pencacah)' },
    { key:'pml',     label:'PML (Pengawas)' },
    { key:'status',  label:'Status' },
  ],
};

const STATUS_COLOR = {
  APPROVED:  '#10b981',
  SUBMITTED: '#f59e0b',
  REJECTED:  '#f43f5e',
};
const MONO_KEYS = new Set(['nik', 'nikAK', 'noKK', 'id', 'no']);

export function CrosscheckTable({ type, accentColor = '#f43f5e', kecFilter = 'all' }) {
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const debounceRef           = useRef(null);

  const cols = COLUMNS[type] || [];

  // Fetch dengan debounce untuk search
  const load = useCallback(async (pg, q) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchCrosscheck(type, {
        page: pg, limit: PAGE_SIZE,
        ...(q ? { q } : {}),
        ...(kecFilter && kecFilter !== 'all' ? { kec: kecFilter } : {}),
      });
      setRows(r.data || []);
      setTotal(r.total || 0);
      setPages(r.totalPages || 1);
      setPage(pg);
      // Tampilkan warning dari server jika ada (misal: anggotaKeluarga tidak tersimpan)
      if (r.warning) setError('⚠ ' + r.warning);
      else setError(null);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [type, kecFilter]);

  // Load awal
  useEffect(() => { load(1, search); }, [type, kecFilter]);

  // Search dengan debounce 300ms
  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, val), 300);
  };

  const clearSearch = () => { setSearch(''); load(1, ''); };

  // Export: ambil semua data (limit besar)
  const handleExport = async () => {
    try {
      const r = await fetchCrosscheck(type, {
        page: 1, limit: 500,
        ...(search ? { q: search } : {}),
        ...(kecFilter && kecFilter !== 'all' ? { kec: kecFilter } : {}),
      });
      const filename = `crosscheck_${type}_${new Date().toISOString().slice(0,10)}.csv`;
      exportCSV(r.data || [], filename, cols);
    } catch (e) { alert('Gagal export: ' + e.message); }
  };

  // Paginasi — tampilkan maks 5 halaman di sekitar halaman aktif
  const pageNums = () => {
    const nums = [];
    const delta = 2;
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= delta) {
        nums.push(i);
      } else if (nums[nums.length - 1] !== '…') {
        nums.push('…');
      }
    }
    return nums;
  };

  if (!cols.length) return null;

  const startIdx = (page - 1) * PAGE_SIZE + 1;
  const endIdx   = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>

        {/* Search */}
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={11} style={{ position:'absolute', left:9, top:'50%',
            transform:'translateY(-50%)', color:'var(--text4)', pointerEvents:'none' }}/>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari nama, desa, kecamatan, petugas…"
            style={{ width:'100%', padding:'7px 32px 7px 28px', fontSize:11,
              background:'var(--bg3)', border:`1px solid ${search ? accentColor+'60' : 'var(--border)'}`,
              borderRadius:8, color:'var(--text1)', outline:'none', fontFamily:'var(--font)',
              transition:'border-color .15s' }}
          />
          {search && (
            <button onClick={clearSearch} style={{ position:'absolute', right:8, top:'50%',
              transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', padding:2, borderRadius:99,
              color:'var(--text4)' }}>
              <X size={10} strokeWidth={2.5}/>
            </button>
          )}
        </div>

        {/* Info */}
        <span style={{ fontSize:10, color:'var(--text3)', whiteSpace:'nowrap', flexShrink:0 }}>
          {loading ? 'Memuat…' : total > 0
            ? `${startIdx}–${endIdx} dari ${total.toLocaleString('id')}`
            : '0 data'
          }
          {search && !loading && ` (hasil pencarian "${search}")`}
        </span>

        {/* Export */}
        <button onClick={handleExport} disabled={total === 0}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
            fontSize:11, borderRadius:8,
            border:`1px solid ${accentColor}40`,
            background: total === 0 ? 'var(--bg3)' : `${accentColor}10`,
            color: total === 0 ? 'var(--text4)' : accentColor,
            cursor: total === 0 ? 'default' : 'pointer',
            fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
          <Download size={11} strokeWidth={2}/> Export CSV
        </button>
      </div>

      {/* ── Tabel ───────────────────────────────────────────────────── */}
      <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid var(--border)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
              <th style={{ padding:'7px 10px', textAlign:'center', fontSize:9, width:36,
                fontWeight:700, color:'var(--text4)' }}>#</th>
              {cols.map(c => (
                <th key={c.key} style={{ padding:'7px 10px', textAlign:'left', fontSize:9,
                  fontWeight:700, color:'var(--text4)', textTransform:'uppercase',
                  letterSpacing:'0.07em', whiteSpace:'nowrap' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={cols.length + 1}
                style={{ padding:'24px', textAlign:'center', color:'#f87171', fontSize:11 }}>
                Gagal memuat data: {error}
              </td></tr>
            ) : loading ? (
              // Skeleton rows
              Array(PAGE_SIZE).fill(0).map((_, i) => (
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td colSpan={cols.length + 1} style={{ padding:'8px 10px' }}>
                    <div style={{ height:14, borderRadius:4, width:`${60+Math.random()*30}%`,
                      background:'var(--bg3)', animation:'shimmer 1.4s infinite',
                      backgroundSize:'200% 100%',
                      backgroundImage:'linear-gradient(90deg,var(--bg3) 25%,var(--bg4) 50%,var(--bg3) 75%)' }}/>
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={cols.length + 1}
                style={{ padding:'32px', textAlign:'center', color:'var(--text4)', fontSize:12 }}>
                {search ? `Tidak ditemukan hasil untuk "${search}"` : 'Tidak ada data'}
              </td></tr>
            ) : rows.map((row, i) => (
              <tr key={i}
                style={{ borderBottom:'1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.04)',
                  transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background =
                  i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.04)'}
              >
                {/* Nomor urut global */}
                <td style={{ padding:'8px 10px', textAlign:'center', fontSize:10,
                  color:'var(--text3)', fontFamily:'var(--mono)', width:36, flexShrink:0 }}>
                  {startIdx + i}
                </td>
                {cols.map(c => {
                  const val = row[c.key];
                  const isNIK    = c.key === 'nik' || c.key === 'nikAK';
                  const isMono   = MONO_KEYS.has(c.key);
                  const isStatus = c.key === 'status';
                  return (
                    <td key={c.key} style={{
                      padding:'8px 10px',
                      maxWidth: 200, overflow:'hidden', textOverflow:'ellipsis',
                      whiteSpace: c.key === 'jawaban' ? 'normal' : 'nowrap',
                    }}>
                      {c.key === 'jumlah' ? (
                        <span style={{ background:'rgba(27,63,139,0.12)', color:'var(--blue3)',
                          padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700 }}>
                          {val}
                        </span>
                      ) : c.key === 'fields' ? (
                        <span style={{ fontSize:10, color:'var(--text2)', whiteSpace:'normal',
                          lineHeight:1.5 }}>
                          {val}
                        </span>
                      ) : isNIK ? (
                        <span style={{ background:`${accentColor}15`, color:accentColor,
                          padding:'2px 8px', borderRadius:4, fontFamily:'var(--mono)',
                          fontSize:10, fontWeight:700 }}>
                          {val || '—'}
                        </span>
                      ) : isStatus ? (
                        <span style={{ fontSize:10, fontWeight:600,
                          color: STATUS_COLOR[val] || 'var(--text3)',
                          background: (STATUS_COLOR[val] || 'var(--text4)') + '18',
                          padding:'2px 8px', borderRadius:99 }}>
                          {val || '—'}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: isMono ? 10 : 11,
                          color: 'var(--text2)',
                          fontFamily: isMono ? 'var(--mono)' : 'inherit',
                        }}>
                          {val ?? '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {pages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginTop:12, flexWrap:'wrap', gap:8 }}>

          <span style={{ fontSize:10, color:'var(--text3)' }}>
            Halaman {page} dari {pages}
          </span>

          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
            {/* Prev */}
            <PagBtn disabled={page === 1} onClick={() => load(page - 1, search)}
              accent={accentColor}>
              <ChevronLeft size={12}/>
            </PagBtn>

            {/* Nomor halaman */}
            {pageNums().map((n, i) =>
              n === '…' ? (
                <span key={`e${i}`} style={{ padding:'0 4px', fontSize:11,
                  color:'var(--text4)' }}>…</span>
              ) : (
                <PagBtn key={n} active={n === page} accent={accentColor}
                  onClick={() => load(n, search)}>
                  {n}
                </PagBtn>
              )
            )}

            {/* Next */}
            <PagBtn disabled={page === pages} onClick={() => load(page + 1, search)}
              accent={accentColor}>
              <ChevronRight size={12}/>
            </PagBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// Tombol pagination
function PagBtn({ children, onClick, disabled, active, accent }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 30, height: 30, padding: '0 6px',
        fontSize: 11, borderRadius: 6,
        border: active ? `1px solid ${accent}` : '1px solid var(--border)',
        background: active ? accent : disabled ? 'var(--bg3)' : 'var(--bg3)',
        color: active ? '#fff' : disabled ? 'var(--text4)' : 'var(--text2)',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--mono)', fontWeight: active ? 700 : 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  );
}