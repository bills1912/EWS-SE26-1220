/**
 * src/components/DesaFilter.jsx
 * ──────────────────────────────
 * Custom dropdown desa — style identik dengan KecamatanFilter,
 * mengikuti tema BPS (orange accent via CSS var --indigo3 → --orange3).
 */
import { useState, useRef, useEffect } from 'react';
import { Home, ChevronDown, X, Check } from 'lucide-react';

export default function DesaFilter({ value, onChange, desaList, disabled }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const isFiltered      = !!value;

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Tutup kalau list berubah (ganti kecamatan)
  useEffect(() => { setOpen(false); }, [desaList]);

  const select = val => { onChange(val); setOpen(false); };

  if (!desaList || desaList.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px 5px 9px',
          background: isFiltered ? 'var(--orange-dim)' : 'var(--bg3)',
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
        {isFiltered
          ? (
            <span
              onClick={e => { e.stopPropagation(); select(''); }}
              style={{ display:'flex', alignItems:'center', padding:1, borderRadius:99,
                       background:'rgba(232,84,28,0.25)', cursor:'pointer' }}
            >
              <X size={9} strokeWidth={3} color="var(--orange3)"/>
            </span>
          )
          : (
            <ChevronDown size={10} strokeWidth={2} color="var(--text3)"
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}/>
          )
        }
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          minWidth: 220, overflow: 'hidden',
          animation: 'fadeSlideDown .12s ease',
        }}>
          {/* Semua Desa */}
          <div
            onClick={() => select('')}
            style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'9px 12px', cursor:'pointer', fontSize:12,
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

          {/* Daftar desa */}
          <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
            {desaList.map(d => {
              const isActive = value === d;
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
                    <span>{d}</span>
                  </div>
                  {isActive && <Check size={12} strokeWidth={2.5} color="var(--orange3)"/>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}