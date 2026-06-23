/**
 * src/components/KecamatanFilter.jsx
 * ====================================
 * Custom dropdown kecamatan — fully themed, tidak pakai native <select>.
 * Muncul di Topbar, pilihan berlaku ke semua halaman via KecamatanContext.
 */
import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, X, Check } from 'lucide-react';
import { useKecamatan } from '../context/KecamatanContext.jsx';

export default function KecamatanFilter() {
  const { selectedKec, setSelectedKec, KECAMATAN_LIST } = useKecamatan();
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const isFiltered        = selectedKec !== 'all';

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = isFiltered
    ? selectedKec.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')
    : 'Semua Kecamatan';

  const select = (val) => { setSelectedKec(val); setOpen(false); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px 5px 9px',
          background: isFiltered ? 'rgba(99,102,241,0.12)' : 'var(--bg3)',
          border: `1px solid ${isFiltered ? 'rgba(99,102,241,0.45)' : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer',
          transition: 'all .15s', outline: 'none',
          color: isFiltered ? 'var(--indigo3)' : 'var(--text3)',
        }}
      >
        <MapPin size={11} strokeWidth={2} color="inherit"/>
        <span style={{
          fontSize: 11, fontWeight: isFiltered ? 600 : 400,
          fontFamily: 'var(--font)', whiteSpace: 'nowrap', maxWidth: 130,
          overflow: 'hidden', textOverflow: 'ellipsis', color: 'inherit',
        }}>
          {label}
        </span>
        {isFiltered
          ? (
            <span
              onClick={e => { e.stopPropagation(); select('all'); }}
              style={{ display:'flex', alignItems:'center', padding: 1, borderRadius: 99,
                       background: 'rgba(99,102,241,0.25)', cursor: 'pointer' }}
            >
              <X size={9} strokeWidth={3} color="var(--indigo3)"/>
            </span>
          )
          : <ChevronDown size={10} strokeWidth={2} color="var(--text3)"
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}/>
        }
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          minWidth: 210, overflow: 'hidden',
          animation: 'fadeSlideDown .12s ease',
        }}>
          {/* Semua kecamatan */}
          <div
            onClick={() => select('all')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', cursor: 'pointer', fontSize: 12,
              color: !isFiltered ? 'var(--indigo3)' : 'var(--text2)',
              fontWeight: !isFiltered ? 600 : 400,
              background: !isFiltered ? 'rgba(99,102,241,0.08)' : 'transparent',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => { if(isFiltered) e.currentTarget.style.background='var(--bg3)'; }}
            onMouseLeave={e => { if(isFiltered) e.currentTarget.style.background='transparent'; }}
          >
            <span>Semua Kecamatan</span>
            {!isFiltered && <Check size={12} strokeWidth={2.5} color="var(--indigo3)"/>}
          </div>

          {/* List kecamatan */}
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
            {KECAMATAN_LIST.map(k => {
              const isActive = selectedKec === k;
              const niceName = k.split(' ').map(w => w[0]+w.slice(1).toLowerCase()).join(' ');
              return (
                <div
                  key={k}
                  onClick={() => select(k)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                    color: isActive ? 'var(--indigo3)' : 'var(--text2)',
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background='var(--bg3)'; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background='transparent'; }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <MapPin size={9} strokeWidth={2} color={isActive ? 'var(--indigo3)' : 'var(--text4)'}/>
                    <span>{niceName}</span>
                  </div>
                  {isActive && <Check size={12} strokeWidth={2.5} color="var(--indigo3)"/>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}