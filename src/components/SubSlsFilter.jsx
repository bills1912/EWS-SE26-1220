/**
 * src/components/SubSlsFilter.jsx
 * ──────────────────────────────
 * Custom dropdown MULTI-SELECT untuk sub-SLS — style & interaksi dasarnya
 * identik dengan DesaFilter.jsx/PetugasFilter.jsx (search bar, animasi,
 * warna), tapi beda di 3 hal krn kebutuhan multi-pilih:
 *   1. value adalah ARRAY of idsubsls (bukan string tunggal)
 *   2. klik item men-TOGGLE checkbox, dropdown TETAP TERBUKA (bukan
 *      langsung close spt filter single-select lain)
 *   3. ada aksi cepat "Pilih semua (hasil pencarian)" / "Hapus semua"
 *
 * Tiap opsi menampilkan NAMA (kecamatan · desa · SLS · Sub) DAN KODE
 * idsubsls sekaligus dalam 1 baris list (label utama + kode mono di
 * bawahnya) — supaya bisa dicari dari nama ATAU kodenya.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { Layers, ChevronDown, X, Check, Search } from 'lucide-react';

export default function SubSlsFilter({ value = [], onChange, list, disabled, label = 'Sub-SLS' }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref                 = useRef(null);
  const searchRef           = useRef(null);
  const isFiltered          = value.length > 0;
  const labelLower          = label.toLowerCase();

  // Tutup saat klik luar
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Reset search & tutup saat list berubah (ganti kecamatan) — TIDAK reset
  // `value` di sini krn itu tanggung jawab parent (WilayahMapPage sudah
  // reset selectedSubSls sendiri tiap ganti kecamatan, sama spt filter lain)
  useEffect(() => { setOpen(false); setSearch(''); }, [list]);

  // Fokus search input saat buka
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (!open) setSearch('');
  }, [open]);

  // Toggle 1 item — TIDAK menutup dropdown (beda dgn filter single-select)
  const toggle = id => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };
  const clearAll = () => onChange([]);

  // PENTING: useMemo ini WAJIB dipanggil sebelum early-return di bawah —
  // hook tidak boleh dipanggil kondisional/setelah return, atau jumlah hook
  // beda antar render (kasus list kosong vs terisi) & React error "Rendered
  // more hooks than during the previous render". `list` di-fallback ke []
  // di dalam supaya tetap aman dipanggil sebelum guard `!list` di bawah.
  const filtered = useMemo(() => {
    const src = list || [];
    if (!search) return src;
    const q = search.toLowerCase();
    return src.filter(d => d.searchText.includes(q));
  }, [list, search]);

  if (!list || list.length === 0) return null;

  const selectAllFiltered = () => {
    const ids = filtered.map(d => d.idsubsls);
    const merged = new Set([...value, ...ids]);
    onChange([...merged]);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px 5px 9px',
          background: isFiltered ? 'var(--orange-dim2)' : 'var(--bg3)',
          border: `1px solid ${isFiltered ? 'rgba(232,84,28,0.45)' : 'var(--border)'}`,
          borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
          outline: 'none', opacity: disabled ? 0.5 : 1,
          color: isFiltered ? 'var(--orange3)' : 'var(--text3)',
          transition: 'all .15s',
        }}
      >
        <Layers size={11} strokeWidth={2} color="inherit"/>
        <span style={{
          fontSize: 11, fontWeight: isFiltered ? 600 : 400,
          fontFamily: 'var(--font)', whiteSpace: 'nowrap',
          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
          color: 'inherit',
        }}>
          {isFiltered ? `${value.length} ${label} dipilih` : `Semua ${label}`}
        </span>
        {isFiltered ? (
          <span
            onClick={e => { e.stopPropagation(); clearAll(); }}
            style={{ display:'flex', alignItems:'center', padding:1,
                     borderRadius:99, background:'rgba(232,84,28,0.25)', cursor:'pointer' }}
          >
            <X size={9} strokeWidth={3} color="var(--orange3)"/>
          </span>
        ) : (
          <ChevronDown size={10} strokeWidth={2} color="var(--text3)"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}/>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          minWidth: 300, overflow: 'hidden',
          animation: 'fadeSlideDown .12s ease',
        }}>

          {/* Search bar */}
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Search size={11} color="var(--text4)" strokeWidth={2} style={{ flexShrink:0 }}/>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Cari nama atau kode dari ${list.length} sub-SLS…`}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
                // Enter = toggle item pertama hasil pencarian (dropdown tetap terbuka)
                if (e.key === 'Enter' && filtered.length > 0) toggle(filtered[0].idsubsls);
              }}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 11, color: 'var(--text1)', fontFamily: 'var(--font)',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background:'none', border:'none', cursor:'pointer',
                          display:'flex', alignItems:'center', padding:0 }}>
                <X size={9} strokeWidth={3} color="var(--text4)"/>
              </button>
            )}
          </div>

          {/* Aksi cepat: pilih semua (hasil pencarian) / hapus semua */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'6px 12px', borderBottom:'1px solid var(--border)',
            background:'var(--bg3)',
          }}>
            <button onClick={selectAllFiltered}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                        fontSize:10, fontWeight:600, color:'var(--orange3)' }}>
              Pilih semua {search ? `(${filtered.length} hasil)` : `(${list.length})`}
            </button>
            <button onClick={clearAll} disabled={!isFiltered}
              style={{ background:'none', border:'none', padding:0,
                        fontSize:10, fontWeight:600,
                        color: isFiltered ? 'var(--text3)' : 'var(--text4)',
                        cursor: isFiltered ? 'pointer' : 'default' }}>
              Hapus semua
            </button>
          </div>

          {/* Daftar sub-SLS */}
          <div style={{ maxHeight: 300, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding:'16px 12px', textAlign:'center',
                             fontSize:11, color:'var(--text4)' }}>
                Tidak ditemukan
              </div>
            ) : filtered.map(d => {
              const isActive = value.includes(d.idsubsls);
              const getLabel = () => {
                if (!search) return <span>{d.primary}</span>;
                const idx = d.primary.toLowerCase().indexOf(search.toLowerCase());
                if (idx < 0) return <span>{d.primary}</span>;
                return (
                  <span>
                    {d.primary.slice(0, idx)}
                    <mark style={{ background:'var(--orange-dim)', color:'var(--orange3)',
                                    borderRadius:2, padding:'0 1px' }}>
                      {d.primary.slice(idx, idx + search.length)}
                    </mark>
                    {d.primary.slice(idx + search.length)}
                  </span>
                );
              };
              return (
                <div
                  key={d.idsubsls}
                  onClick={() => toggle(d.idsubsls)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 12px', cursor: 'pointer',
                    background: isActive ? 'var(--orange-dim2)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background='var(--bg3)'; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background='transparent'; }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width:14, height:14, borderRadius:4, flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border: `1.5px solid ${isActive ? 'var(--orange3)' : 'var(--border2)'}`,
                    background: isActive ? 'var(--orange3)' : 'transparent',
                    transition:'all .12s',
                  }}>
                    {isActive && <Check size={10} strokeWidth={3} color="var(--bg1)"/>}
                  </div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:12, fontWeight: isActive ? 600 : 400,
                                   color: isActive ? 'var(--orange3)' : 'var(--text2)',
                                   overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {getLabel()}
                    </div>
                    <div style={{ fontSize:9, fontFamily:'var(--mono)', color:'var(--text4)',
                                   overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {d.idsubsls}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: jumlah hasil + terpilih */}
          <div style={{
            padding: '6px 12px', borderTop: '1px solid var(--border)',
            fontSize: 9, color: 'var(--text4)',
            display:'flex', justifyContent:'space-between',
          }}>
            <span>{filtered.length} dari {list.length} {labelLower}</span>
            {isFiltered && <span style={{ color:'var(--orange3)', fontWeight:600 }}>{value.length} dipilih</span>}
          </div>
        </div>
      )}
    </div>
  );
}