/**
 * src/components/DesaFilter.jsx
 * ──────────────────────────────
 * Custom dropdown desa dengan search bar — identik style dengan KecamatanFilter.
 */
import { useState, useRef, useEffect } from 'react';
import { Home, ChevronDown, X, Check, Search } from 'lucide-react';

export default function DesaFilter({ value, onChange, desaList, disabled }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref                 = useRef(null);
  const searchRef           = useRef(null);
  const isFiltered          = !!value;

  // Tutup saat klik luar
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Reset search & tutup saat list berubah (ganti kecamatan)
  useEffect(() => { setOpen(false); setSearch(''); }, [desaList]);

  // Fokus search input saat buka
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (!open) setSearch('');
  }, [open]);

  const select = val => { onChange(val); setOpen(false); setSearch(''); };

  if (!desaList || desaList.length === 0) return null;

  const filtered = search
    ? desaList.filter(d => d.toLowerCase().includes(search.toLowerCase()))
    : desaList;

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
        <Home size={11} strokeWidth={2} color="inherit"/>
        <span style={{
          fontSize: 11, fontWeight: isFiltered ? 600 : 400,
          fontFamily: 'var(--font)', whiteSpace: 'nowrap',
          maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
          color: 'inherit',
        }}>
          {isFiltered ? value : 'Semua Desa'}
        </span>
        {isFiltered ? (
          <span
            onClick={e => { e.stopPropagation(); select(''); }}
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
          minWidth: 230, overflow: 'hidden',
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
              placeholder={`Cari dari ${desaList.length} desa…`}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
                // Enter = pilih item pertama di list
                if (e.key === 'Enter' && filtered.length > 0) select(filtered[0]);
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

          {/* Semua Desa — hanya tampil kalau tidak ada search */}
          {!search && (
            <div
              onClick={() => select('')}
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'8px 12px', cursor:'pointer', fontSize:12,
                color: !isFiltered ? 'var(--orange3)' : 'var(--text2)',
                fontWeight: !isFiltered ? 600 : 400,
                background: !isFiltered ? 'var(--orange-dim2)' : 'transparent',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e => { if(isFiltered) e.currentTarget.style.background='var(--bg3)'; }}
              onMouseLeave={e => { if(isFiltered) e.currentTarget.style.background='transparent'; }}
            >
              <span>Semua Desa</span>
              {!isFiltered && <Check size={12} strokeWidth={2.5} color="var(--orange3)"/>}
            </div>
          )}

          {/* Daftar desa */}
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding:'16px 12px', textAlign:'center',
                             fontSize:11, color:'var(--text4)' }}>
                Tidak ditemukan
              </div>
            ) : filtered.map(d => {
              const isActive = value === d;
              // Highlight kata yang dicari
              const getLabel = () => {
                if (!search) return <span>{d}</span>;
                const idx = d.toLowerCase().indexOf(search.toLowerCase());
                if (idx < 0) return <span>{d}</span>;
                return (
                  <span>
                    {d.slice(0, idx)}
                    <mark style={{ background:'var(--orange-dim)', color:'var(--orange3)',
                                    borderRadius:2, padding:'0 1px' }}>
                      {d.slice(idx, idx + search.length)}
                    </mark>
                    {d.slice(idx + search.length)}
                  </span>
                );
              };
              return (
                <div
                  key={d}
                  onClick={() => select(d)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 12px', cursor: 'pointer', fontSize: 12,
                    color: isActive ? 'var(--orange3)' : 'var(--text2)',
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? 'var(--orange-dim2)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background='var(--bg3)'; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background='transparent'; }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <Home size={9} strokeWidth={2} color={isActive ? 'var(--orange3)' : 'var(--text4)'}/>
                    {getLabel()}
                  </div>
                  {isActive && <Check size={12} strokeWidth={2.5} color="var(--orange3)"/>}
                </div>
              );
            })}
          </div>

          {/* Footer: jumlah hasil */}
          {search && (
            <div style={{
              padding: '6px 12px', borderTop: '1px solid var(--border)',
              fontSize: 9, color: 'var(--text4)',
            }}>
              {filtered.length} dari {desaList.length} desa
            </div>
          )}
        </div>
      )}
    </div>
  );
}