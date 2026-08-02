/**
 * src/components/CustomDatePicker.jsx
 * ────────────────────────────────────
 * Date picker custom — ganti <input type="date"> bawaan browser (gayanya
 * inkonsisten & selalu terang meski tema web-nya gelap) dgn kalender
 * bergaya sama persis dgn dropdown filter lain di app ini (DesaFilter/
 * PetugasFilter/KecamatanFilter/SubSlsFilter): panel var(--bg2) melayang,
 * animasi fadeSlideDown, trigger button senada.
 *
 * Auto-flip posisi: kalau trigger-nya deket tepi kanan layar (mis. input
 * "tanggal akhir" di ujung kanan toolbar), panel otomatis buka ke KIRI
 * (right:0) drpd ke kanan (left:0) spy tidak kepotong di luar viewport.
 */
import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const PANEL_WIDTH = 232;
const BULAN_ID_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI_ID_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

export default function CustomDatePicker({ value, onChange, min, max, isMobile, placeholder = 'Pilih tanggal' }) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState('left'); // 'left' = panel buka ke kanan (left:0), 'right' = buka ke kiri (right:0)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const wrapRef = useRef(null);
  const btnRef  = useRef(null);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Sinkronkan bulan yg ditampilkan tiap value berubah dari luar (mis. klik
  // tombol quick-range "7 hari") — biar buka kalender langsung nunjukkin
  // bulan yg relevan, bukan bulan lama yg ketinggalan
  useEffect(() => {
    if (value) {
      const d = new Date(`${value}T00:00:00`);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value]);

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      // Ukur ruang yg tersisa di kanan trigger SEBELUM buka — kalau panel
      // (232px) bakal kepotong tepi kanan viewport, buka ke kiri sebaliknya
      const rect = btnRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.left;
      setAlign(spaceRight < PANEL_WIDTH + 16 ? 'right' : 'left');
    }
    setOpen(v => !v);
  };

  const fmtDisplay = (iso) => {
    if (!iso) return placeholder;
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  };

  const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const pad2 = n => String(n).padStart(2, '0');
  const dayIso = d => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const isDisabled = d => {
    const iso = dayIso(d);
    return (min && iso < min) || (max && iso > max);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Batas navigasi bulan — jangan biarkan geser ke bulan yg sepenuhnya di luar min/max
  const prevDisabled = min && new Date(y, m, 0) < new Date(`${min}T00:00:00`) &&
                        new Date(y, m, 0).getMonth() !== new Date(`${min}T00:00:00`).getMonth();
  const nextDisabled = max && new Date(y, m + 1, 1) > new Date(`${max}T00:00:00`) &&
                        new Date(y, m + 1, 1).getMonth() !== new Date(`${max}T00:00:00`).getMonth();

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button ref={btnRef} onClick={toggleOpen}
        style={{ display:'flex', alignItems:'center', gap:6, padding: isMobile ? '7px 10px' : '5px 10px',
                 fontSize: isMobile ? 13 : 11, fontFamily:'var(--font)', borderRadius:7,
                 border:`1px solid ${open ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`,
                 background:'var(--bg3)', color: value ? 'var(--text1)' : 'var(--text4)',
                 cursor:'pointer', whiteSpace:'nowrap', transition:'border-color .15s' }}>
        <Calendar size={11} color={value ? '#a78bfa' : 'var(--text4)'}/>
        {fmtDisplay(value)}
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', [align]:0, zIndex:2000,
                       background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12,
                       boxShadow:'0 10px 32px rgba(0,0,0,0.4)', padding:12, width:PANEL_WIDTH,
                       maxWidth:'calc(100vw - 24px)', animation:'fadeSlideDown .12s ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <button onClick={() => !prevDisabled && setViewMonth(new Date(y, m - 1, 1))} disabled={prevDisabled}
              style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6,
                       width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center',
                       cursor: prevDisabled ? 'default' : 'pointer', opacity: prevDisabled ? 0.35 : 1 }}>
              <ChevronLeft size={12} color="var(--text3)"/>
            </button>
            <div style={{ fontSize:11.5, fontWeight:700, color:'var(--text1)' }}>{BULAN_ID_FULL[m]} {y}</div>
            <button onClick={() => !nextDisabled && setViewMonth(new Date(y, m + 1, 1))} disabled={nextDisabled}
              style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6,
                       width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center',
                       cursor: nextDisabled ? 'default' : 'pointer', opacity: nextDisabled ? 0.35 : 1 }}>
              <ChevronRight size={12} color="var(--text3)"/>
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {HARI_ID_SHORT.map(h => (
              <div key={h} style={{ fontSize:8.5, fontWeight:700, color:'var(--text4)', textAlign:'center' }}>{h}</div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={i}/>;
              const iso = dayIso(d);
              const disabled = isDisabled(d);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button key={i} disabled={disabled}
                  onClick={() => { onChange(iso); setOpen(false); }}
                  style={{
                    aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10.5, fontWeight: isSelected ? 700 : 400, borderRadius:7,
                    border: isToday && !isSelected ? '1px solid rgba(167,139,250,0.55)' : '1px solid transparent',
                    background: isSelected ? '#a78bfa' : 'transparent',
                    color: disabled ? 'var(--text4)' : isSelected ? '#fff' : 'var(--text2)',
                    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
                    transition:'background .1s, color .1s',
                  }}
                  onMouseEnter={e => { if (!disabled && !isSelected) e.currentTarget.style.background = 'var(--bg3)'; }}
                  onMouseLeave={e => { if (!disabled && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                >{d}</button>
              );
            })}
          </div>

          {value && (
            <button onClick={() => { onChange(''); setOpen(false); }}
              style={{ marginTop:10, width:'100%', padding:'5px', fontSize:9.5, fontWeight:600,
                       borderRadius:6, border:'1px solid var(--border)', background:'transparent',
                       color:'var(--text4)', cursor:'pointer' }}>
              Hapus tanggal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
