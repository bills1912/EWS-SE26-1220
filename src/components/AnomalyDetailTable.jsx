// src/components/AnomalyDetailTable.jsx
// Tabel anomali SE2026 — 3 tab (Usaha / Keluarga / Missing Value)
// Dropdown multiselect kode anomali + tombol Lihat Responden per baris

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ChevronDown, X, ArrowRight,
  ShieldAlert, Search, ChevronLeft, ChevronRight,
  ChevronsUpDown, ChevronUp,
} from 'lucide-react';
// Badge tidak dipakai

// ── Konstanta daftar anomali ─────────────────────────────────────────────
const ANOMALI_USAHA = [
  { code:'A1', label:'Biaya Produksi Dominan',            short:'A1' },
  { code:'A2', label:'Keuntungan Usaha Negatif',          short:'A2' },
  { code:'A3', label:'Penyertaan Modal Korporasi',        short:'A3' },
  { code:'A4', label:'Data Keuangan MBG',                 short:'A4' },
  { code:'A5', label:'Hubungan Aset, Pekerja & Produksi', short:'A5' },
  { code:'A6', label:'Internet Usaha Menengah & Besar',   short:'A6' },
  { code:'A7', label:'Laporan Keuangan UMB',              short:'A7' },
  { code:'A8', label:'Perbedaan KBLI 2 Digit',            short:'A8' },
];
const ANOMALI_KELUARGA = [
  { code:'K1', label:'Status Cerai / Belum Kawin',                   short:'K1' },
  { code:'K2', label:'Kepala Keluarga < 10 Th di Rumah Sendiri',     short:'K2' },
  { code:'K3', label:'Semua Anggota Keluarga Disabilitas',           short:'K3' },
  { code:'K4', label:'Luas Lantai Ekstrem',                          short:'K4' },
  { code:'K5', label:'Selisih Pendapatan Negatif',                   short:'K5' },
  { code:'K6', label:'Listrik Rendah & Ada Barang Mewah',            short:'K6' },
  { code:'K7', label:'Jumlah Anggota Keluarga Ekstrem',              short:'K7' },
];
const ANOMALI_MISSING = [
  { code:'M1', label:'Missing Pendapatan',     short:'M1' },
  { code:'M2', label:'Missing Pengeluaran',    short:'M2' },
  { code:'M4', label:'Missing Nilai Aset Tetap', short:'M4' },
];

const OPTIONS_MAP = { usaha: ANOMALI_USAHA, keluarga: ANOMALI_KELUARGA, missing: ANOMALI_MISSING };
const TAB_LABELS  = { usaha: 'Anomali Usaha', keluarga: 'Anomali Keluarga', missing: 'Missing Value' };

// Kategori lapangan usaha KBLI 2025 (A–V)
const KBLI_KATEGORI = [
  { kode:'A', label:'Pertanian, Kehutanan, dan Perikanan' },
  { kode:'B', label:'Pertambangan dan Penggalian' },
  { kode:'C', label:'Industri Pengolahan' },
  { kode:'D', label:'Penyediaan Listrik, Gas, Uap/Air Panas, dan Udara Dingin' },
  { kode:'E', label:'Penyediaan Air; Pengelolaan Air Limbah, Penanganan Limbah' },
  { kode:'F', label:'Konstruksi' },
  { kode:'G', label:'Perdagangan Besar dan Eceran' },
  { kode:'H', label:'Transportasi dan Penyimpanan' },
  { kode:'I', label:'Aktivitas Penyediaan Akomodasi dan Makan Minum' },
  { kode:'J', label:'Aktivitas Penerbitan, Penyiaran, serta Produksi dan Distribusi Konten' },
  { kode:'K', label:'Aktivitas Telekomunikasi, Pemrograman Komputer, dan Jasa Informasi' },
  { kode:'L', label:'Aktivitas Keuangan dan Asuransi' },
  { kode:'M', label:'Aktivitas Real Estat' },
  { kode:'N', label:'Aktivitas Profesional, Ilmiah, dan Teknis' },
  { kode:'O', label:'Aktivitas Administratif dan Penunjang Usaha' },
  { kode:'P', label:'Administrasi Pemerintahan dan Pertahanan' },
  { kode:'Q', label:'Pendidikan' },
  { kode:'R', label:'Aktivitas Kesehatan Manusia dan Aktivitas Sosial' },
  { kode:'S', label:'Kesenian, Olahraga, dan Rekreasi' },
  { kode:'T', label:'Aktivitas Jasa Lainnya' },
  { kode:'U', label:'Aktivitas Rumah Tangga sebagai Pemberi Kerja' },
  { kode:'V', label:'Aktivitas Badan Internasional dan Ekstra Internasional' },
];

// ── Colour per code prefix ───────────────────────────────────────────────
const CODE_COLOR = { A:'#f43f5e', K:'#f59e0b', M:'#6366f1' };
function codeColor(code) { return CODE_COLOR[code?.[0]] || '#94a3b8'; }

// ── API helper — persis sama dengan useEWSData.js ────────────────────────
// BASE_URL dari window.__API_URL__ (di-inject index.html), bukan prop/env

const TOKEN_KEY = 'ews_token';

function getBaseURL() {
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__.replace(/\/$/, '');
  }
  const env = import.meta.env.VITE_API_URL;
  if (env && env !== 'undefined' && env !== '') {
    return env.replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

async function apiFetch(path) {
  const BASE_URL = getBaseURL();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('Token tidak ditemukan. Silakan login.');
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server API.');
  }
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('ews:unauthorized'));
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Custom multiselect dropdown ──────────────────────────────────────────
function MultiSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen]   = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const triggerRef        = useRef(null);
  const dropRef           = useRef(null);
  const [pos, setPos]     = useState({ top:0, left:0, width:0 });

  // Tutup hanya kalau klik di luar trigger DAN di luar dropdown
  useEffect(() => {
    const handler = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target);
      const inDrop    = dropRef.current?.contains(e.target);
      if (!inTrigger && !inDrop) { setOpen(false); setSearchQ(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const calcPos = () => {
    if (!triggerRef.current) return;
    const r      = triggerRef.current.getBoundingClientRect();
    const vh     = window.innerHeight;
    const estH   = 44 + options.length * 36 + 12;
    const spaceBelow = vh - r.bottom - 8;
    const top    = spaceBelow >= Math.min(estH, 300)
      ? r.bottom + 6
      : Math.max(8, r.top - Math.min(estH, 300) - 6);
    setPos({ top, left: r.left, width: Math.max(r.width, 270),
             maxH: Math.min(estH, spaceBelow >= Math.min(estH,300) ? estH : r.top - 14) });
  };

  const openDropdown = () => { calcPos(); setOpen(o => !o); };

  // Update posisi saat scroll/resize agar dropdown mengikuti trigger
  useEffect(() => {
    if (!open) return;
    const update = () => calcPos();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, options.length]);

  const toggle = (e, code) => {
    e.preventDefault();
    e.stopPropagation();
    if (value.includes(code)) onChange(value.filter(c => c !== code));
    else onChange([...value, code]);
  };

  const selectAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (value.length === options.length) onChange([]);
    else onChange(options.map(o => o.code));
  };

  const clearAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div ref={triggerRef} style={{ position:'relative', minWidth:220 }}>
      {/* Trigger */}
      <div
        onMouseDown={(e) => { e.preventDefault(); openDropdown(); }}
        style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'7px 10px', borderRadius:8, cursor:'pointer',
          background:'var(--bg3)', border:`1px solid ${open ? 'var(--indigo)' : 'var(--border)'}`,
          fontSize:12, color:'var(--text2)', userSelect:'none',
          transition:'border-color .15s',
          boxShadow: open ? '0 0 0 2px rgba(99,102,241,0.18)' : 'none',
        }}
      >
        <ShieldAlert size={12} style={{ color:'var(--indigo)', flexShrink:0 }}/>
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
          {value.length === 0
            ? <span style={{ color:'var(--text4)' }}>{placeholder}</span>
            : value.length === options.length
              ? 'Semua anomali'
              : value.map(c => options.find(o => o.code===c)?.short || c).join(', ')
          }
        </span>
        {value.length > 0 && (
          <X size={12} onMouseDown={clearAll} style={{ color:'var(--text4)', flexShrink:0, cursor:'pointer' }}/>
        )}
        <ChevronDown size={12} style={{ flexShrink:0, opacity:.6,
          transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .2s' }}/>
      </div>

      {/* Dropdown — portal ke body agar tidak terclip */}
      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position:'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            maxHeight: pos.maxH ? `${Math.max(pos.maxH, 120)}px` : '70vh',
            overflowY: 'auto',
            zIndex:99999,
            background:'var(--bg2)', border:'1px solid var(--border2)',
            borderRadius:10, padding:'6px',
            boxShadow:'0 16px 48px rgba(0,0,0,.6)',
            animation:'dropIn .15s ease both',
          }}
        >
          <style>{`@keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>

          {/* Search */}
          <div style={{ padding:'4px 4px 6px', borderBottom:'1px solid var(--border)', marginBottom:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6,
              padding:'5px 8px', borderRadius:6, background:'var(--bg3)',
              border:'1px solid var(--border)' }}>
              <Search size={11} style={{ color:'var(--text4)', flexShrink:0 }}/>
              <input
                autoFocus
                placeholder="Cari anomali..."
                value={searchQ}
                onMouseDown={e => e.stopPropagation()}
                onChange={e => setSearchQ(e.target.value)}
                style={{ border:'none', background:'transparent', outline:'none',
                  fontSize:11, color:'var(--text2)', width:'100%' }}
              />
              {searchQ && <X size={10} onMouseDown={e=>{e.preventDefault();e.stopPropagation();setSearchQ('');}}
                style={{color:'var(--text4)',cursor:'pointer',flexShrink:0}}/>}
            </div>
          </div>

          {/* Pilih semua */}
          <div
            onMouseDown={selectAll}
            style={{
              display:'flex', alignItems:'center', gap:8, padding:'7px 8px',
              borderRadius:6, cursor:'pointer', fontSize:11, color:'var(--text3)',
              fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase',
              borderBottom:'1px solid var(--border)', marginBottom:4,
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <div style={{
              width:14, height:14, borderRadius:4, flexShrink:0,
              border:'1.5px solid var(--border2)',
              background: value.length === options.length ? 'var(--indigo)' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {value.length === options.length && <X size={9} color="white" strokeWidth={3}/>}
            </div>
            {value.length === options.length ? 'Batalkan semua' : 'Pilih semua'}
          </div>

          {options.filter(opt =>
            !searchQ || opt.code.toLowerCase().includes(searchQ.toLowerCase()) ||
            opt.label.toLowerCase().includes(searchQ.toLowerCase())
          ).map(opt => {
            const checked = value.includes(opt.code);
            return (
              <div
                key={opt.code}
                onMouseDown={(e) => toggle(e, opt.code)}
                style={{
                  display:'flex', alignItems:'center', gap:8, padding:'7px 8px',
                  borderRadius:6, cursor:'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <div style={{
                  width:14, height:14, borderRadius:4, flexShrink:0,
                  border:`1.5px solid ${checked ? codeColor(opt.code) : 'var(--border2)'}`,
                  background: checked ? codeColor(opt.code) : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all .15s',
                }}>
                  {checked && <X size={9} color="white" strokeWidth={3}/>}
                </div>
                <span style={{
                  fontFamily:'var(--mono)', fontSize:10, fontWeight:700,
                  color: codeColor(opt.code), minWidth:22,
                }}>
                  {opt.code}
                </span>
                <span style={{ flex:1, fontSize:11, color:'var(--text2)' }}>{opt.label}</span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Dropdown kategori KBLI (multi select + search, tanpa checkbox) ───────
function KategoriSelect({ value, onChange }) {
  // value: array of kode (misal ['A','G','I'])
  const [open, setOpen]     = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [pos,  setPos]      = useState({ top:0, left:0, width:0 });
  const trigRef             = useRef(null);
  const dropRef             = useRef(null);

  const calcPos = () => {
    if (!trigRef.current) return;
    const r  = trigRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const estH = 52 + 16 + KBLI_KATEGORI.length * 34 + 12;
    const spaceBelow = vh - r.bottom - 8;
    const top = spaceBelow >= Math.min(estH, 360)
      ? r.bottom + 6
      : Math.max(8, r.top - Math.min(estH, 360) - 6);
    setPos({ top, left: r.left, width: Math.max(r.width, 310),
             maxH: Math.min(estH, spaceBelow >= Math.min(estH,360) ? estH : r.top - 14) });
  };

  useEffect(() => {
    const close = (e) => {
      if (!trigRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
        setOpen(false); setSearchQ('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => calcPos();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  const toggle = (kode) => {
    if (value.includes(kode)) onChange(value.filter(k => k !== kode));
    else onChange([...value, kode]);
  };

  const filtered = KBLI_KATEGORI.filter(k =>
    !searchQ || k.kode.toLowerCase().includes(searchQ.toLowerCase()) ||
    k.label.toLowerCase().includes(searchQ.toLowerCase())
  );

  const triggerLabel = () => {
    if (!value.length) return <span style={{ color:'var(--text4)' }}>Semua kategori</span>;
    if (value.length === KBLI_KATEGORI.length) return 'Semua kategori';
    if (value.length <= 3) return value.map(k => (
      <span key={k} style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#f97316',
        background:'rgba(249,115,22,0.12)', padding:'1px 5px', borderRadius:4,
        marginRight:3, fontSize:10 }}>{k}</span>
    ));
    return <><span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#f97316' }}>
      {value.slice(0,2).join(', ')}
    </span><span style={{ color:'var(--text4)', fontSize:10 }}> +{value.length-2} lainnya</span></>;
  };

  return (
    <div ref={trigRef} style={{ position:'relative' }}>
      <div
        onMouseDown={(e) => { e.preventDefault(); calcPos(); setOpen(o => !o); }}
        style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'7px 10px', borderRadius:8, cursor:'pointer',
          background:'var(--bg3)', border:`1px solid ${open ? '#f97316' : 'var(--border)'}`,
          fontSize:12, color:'var(--text2)', userSelect:'none',
          transition:'border-color .15s', minWidth:190,
          boxShadow: open ? '0 0 0 2px rgba(249,115,22,0.18)' : 'none',
        }}
      >
        <span style={{ fontSize:11, color:'#f97316' }}>◈</span>
        <span style={{ flex:1, overflow:'hidden', display:'flex', alignItems:'center', flexWrap:'nowrap', gap:2 }}>
          {triggerLabel()}
        </span>
        {value.length > 0 && (
          <X size={12} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
            style={{ color:'var(--text4)', cursor:'pointer', flexShrink:0 }}/>
        )}
        <ChevronDown size={12} style={{ flexShrink:0, opacity:.6,
          transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .2s' }}/>
      </div>

      {open && createPortal(
        <div ref={dropRef} style={{
          position:'fixed', top: pos.top, left: pos.left, minWidth: pos.width,
          maxHeight: pos.maxH ? `${Math.max(pos.maxH, 150)}px` : '70vh',
          overflowY:'auto', zIndex:99999,
          background:'var(--bg2)', border:'1px solid var(--border2)',
          borderRadius:10, padding:'6px',
          boxShadow:'0 16px 48px rgba(0,0,0,.6)', animation:'dropIn .15s ease both',
        }}>
          {/* Search */}
          <div style={{ padding:'4px 4px 6px', borderBottom:'1px solid var(--border)', marginBottom:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6,
              padding:'5px 8px', borderRadius:6, background:'var(--bg3)',
              border:'1px solid var(--border)' }}>
              <Search size={11} style={{ color:'var(--text4)', flexShrink:0 }}/>
              <input
                autoFocus
                placeholder="Cari kategori..."
                onMouseDown={e => e.stopPropagation()}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{ border:'none', background:'transparent', outline:'none',
                  fontSize:11, color:'var(--text2)', width:'100%' }}
              />
            </div>
          </div>
          {/* Semua */}
          {!searchQ && (
            <div
              onMouseDown={(e) => { e.preventDefault(); onChange(value.length === KBLI_KATEGORI.length ? [] : KBLI_KATEGORI.map(k=>k.kode)); }}
              style={{
                display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
                borderRadius:6, cursor:'pointer', fontSize:11, color:'var(--text3)',
                borderBottom:'1px solid var(--border)', marginBottom:4, fontWeight:600,
                background: value.length === KBLI_KATEGORI.length ? 'rgba(249,115,22,0.1)' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background=value.length===KBLI_KATEGORI.length?'rgba(249,115,22,0.1)':'transparent'}
            >
              {value.length === KBLI_KATEGORI.length ? 'Batalkan semua' : 'Pilih semua'}
            </div>
          )}
          {filtered.map(k => {
            const active = value.includes(k.kode);
            return (
              <div key={k.kode}
                onMouseDown={(e) => { e.preventDefault(); toggle(k.kode); }}
                style={{
                  display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                  borderRadius:6, cursor:'pointer',
                  background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                  transition:'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background=active?'rgba(249,115,22,0.18)':'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background=active?'rgba(249,115,22,0.1)':'transparent'}
              >
                <span style={{
                  fontFamily:'var(--mono)', fontSize:12, fontWeight:800, minWidth:18, textAlign:'center',
                  color: active ? '#f97316' : 'var(--text3)',
                  transition:'color .12s',
                }}>{k.kode}</span>
                <span style={{ fontSize:11, color: active ? 'var(--text1)' : 'var(--text2)', lineHeight:1.4,
                  fontWeight: active ? 600 : 400 }}>{k.label}</span>
                {active && <span style={{ marginLeft:'auto', color:'#f97316', fontSize:13, flexShrink:0 }}>✓</span>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Flag badge ────────────────────────────────────────────────────────────
function FlagBadge({ flag }) {
  const [hover, setHover] = useState(false);
  const [pos,   setPos]   = useState({ above: true, left: 0 });
  const badgeRef          = useRef(null);

  const handleEnter = () => {
    if (badgeRef.current) {
      const r  = badgeRef.current.getBoundingClientRect();
      const above = r.top > 160; // cukup ruang di atas?
      // Pastikan tooltip tidak keluar kanan layar
      const left = Math.min(r.left, window.innerWidth - 330);
      setPos({ above, top: above ? r.top - 6 : r.bottom + 6, left });
    }
    setHover(true);
  };

  return (
    <div
      ref={badgeRef}
      style={{ position:'relative', display:'inline-block' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{
        display:'inline-flex', alignItems:'center', gap:3,
        padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:700,
        fontFamily:'var(--mono)', cursor:'default',
        background: `${codeColor(flag.code)}22`,
        color: codeColor(flag.code),
        border: `1px solid ${codeColor(flag.code)}44`,
      }}>
        {flag.code}
      </span>
      {hover && createPortal(
        <div style={{
          position:'fixed',
          top: pos.above ? undefined : pos.top,
          bottom: pos.above ? (window.innerHeight - pos.top) : undefined,
          left: pos.left,
          zIndex:99999,
          background:'var(--bg2)', border:'1px solid var(--border2)',
          borderRadius:8, padding:'8px 10px', minWidth:240, maxWidth:320,
          boxShadow:'0 8px 24px rgba(0,0,0,.5)', fontSize:11, color:'var(--text2)',
          lineHeight:1.5, pointerEvents:'none',
          animation:'dropIn .12s ease both',
        }}>
          <div style={{ fontWeight:700, marginBottom:3, color: codeColor(flag.code) }}>
            {flag.code}
          </div>
          {flag.usaha && (
            <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>
              Usaha: {flag.usaha}
            </div>
          )}
          {flag.ket}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Baris tabel ──────────────────────────────────────────────────────────
function AnomalyRow({ rec, onNavigate, idx }) {
  const isEven = idx % 2 === 0;
  return (
    <tr style={{ background: isEven ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
      <td style={td}>{rec.no || '—'}</td>
      <td style={{ ...td, fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>{rec.id}</td>
      <td style={{ ...td, fontWeight:600, color:'var(--text1)' }}>{rec.namaKepala}</td>
      <td style={td}>{rec.kecamatan}</td>
      <td style={td}>{rec.desa}</td>
      <td style={td}>
        <span style={{
          display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:600,
          background: rec.status?.includes('APPROVED') ? 'rgba(16,185,129,0.12)'
            : rec.status?.includes('SUBMIT') ? 'rgba(245,158,11,0.12)'
            : 'rgba(148,163,184,0.1)',
          color: rec.status?.includes('APPROVED') ? '#34d399'
            : rec.status?.includes('SUBMIT') ? '#fbbf24'
            : 'var(--text3)',
        }}>
          {rec.status?.replace('SUBMITTED BY Pencacah','SUBMIT').replace('APPROVED BY Pengawas','APPROVED') || '—'}
        </span>
      </td>
      <td style={{ ...td, maxWidth:220 }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
          {rec.flags.map((f, i) => <FlagBadge key={i} flag={f}/>)}
        </div>
      </td>
      <td style={{ ...td, textAlign:'right', paddingRight:12 }}>
        <div style={{ display:'flex', gap:6, justifyContent:'flex-end', alignItems:'center' }}>
          {/* Tombol ke halaman Responden EWS */}
          <button
            onClick={() => onNavigate(rec.id)}
            style={{
              display:'inline-flex', alignItems:'center', gap:5,
              padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:700,
              cursor:'pointer', whiteSpace:'nowrap',
              background:'linear-gradient(135deg,#f97316,#e2621b)',
              color:'#fff', border:'none',
              boxShadow:'0 2px 8px rgba(249,115,22,0.35)',
              transition:'all .18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(249,115,22,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(249,115,22,0.35)'; }}
          >
            Lihat <ArrowRight size={11}/>
          </button>
          {/* Tombol ke Fasih — hanya kalau URL tersedia */}
          {rec.fasihUrl && (
            <a
              href={rec.fasihUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka di Fasih-SM"
              style={{
                display:'inline-flex', alignItems:'center', gap:5,
                padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:700,
                cursor:'pointer', whiteSpace:'nowrap', textDecoration:'none',
                background:'linear-gradient(135deg,#1d6fa4,#155d8a)',
                color:'#fff', border:'none',
                boxShadow:'0 2px 8px rgba(29,111,164,0.35)',
                transition:'all .18s ease',
                letterSpacing:'0.02em',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(29,111,164,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(29,111,164,0.35)'; }}
            >
              Fasih <ArrowRight size={11}/>
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

const td = {
  padding:'9px 10px', fontSize:12, color:'var(--text2)',
  borderBottom:'1px solid rgba(255,255,255,0.04)', verticalAlign:'middle',
};
const th = {
  padding:'8px 10px', fontSize:10, fontWeight:700, color:'var(--text4)',
  textTransform:'uppercase', letterSpacing:'0.07em',
  borderBottom:'1px solid var(--border)', textAlign:'left', whiteSpace:'nowrap',
};

// ── Main Component ────────────────────────────────────────────────────────
export function AnomalyDetailTable({ kecFilter }) {
  const [tab,            setTab]          = useState('usaha');
  const [codes,          setCodes]        = useState([]);
  const [filterKategori, setFilterKategori] = useState([]);
  const [page,           setPage]         = useState(1);
  const [data,           setData]         = useState(null);
  const [loading,        setLoading]      = useState(false);
  const [error,          setError]        = useState(null);
  const [search,         setSearch]       = useState('');
  const [filterStatus,   setFilterStatus] = useState('all');
  const [sortCol,        setSortCol]      = useState('');
  const [sortDir,        setSortDir]      = useState('asc');
  const [tabSummary,     setTabSummary]   = useState({ usaha:0, keluarga:0, missing:0 });

  const options = OPTIONS_MAP[tab] || [];

  // Reset page & codes saat ganti tab
  const switchTab = (t) => { setTab(t); setCodes([]); setFilterKategori([]); setPage(1); setData(null); setSearch(''); setFilterStatus('all'); setSortCol(''); setSortDir('asc'); };

  // Fetch ringkasan jumlah RESPONDEN per tab — pakai filter yang SAMA dengan tabel
  // agar badge dan total header selalu konsisten
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      ...(kecFilter && kecFilter !== 'all' ? { kec: kecFilter } : {}),
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
      ...(filterKategori.length ? { kategori: filterKategori.join(',') } : {}),
      ...(codes.length ? { codes: codes.join(',') } : {}),
    });
    apiFetch(`/api/anomali/summary?${params}`)
      .then(result => { if (!cancelled) setTabSummary(result); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [kecFilter, filterStatus, filterKategori.join(','), codes.join(',')]);

  // Fetch dengan satu useEffect terpadu — tidak pakai useCallback untuk hindari loop
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      tab, page, limit: 25,
      ...(codes.length ? { codes: codes.join(',') } : {}),
      ...(kecFilter && kecFilter !== 'all' ? { kec: kecFilter } : {}),
      ...(filterKategori.length ? { kategori: filterKategori.join(',') } : {}),
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
    });

    apiFetch(`/api/anomali/detail?${params}`)
      .then(result => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(e    => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [tab, codes.join(','), page, kecFilter, filterKategori.join(','), filterStatus]);

  const navigate = (id) => {
    sessionStorage.setItem('ews_goto_responden', id);
    window.dispatchEvent(new CustomEvent('ews:goto', {
      detail: { tab: 'Responden', respondentId: id }
    }));
    setTimeout(() => {
      document.querySelectorAll('button,[role="tab"]').forEach(b => {
        if (b.textContent?.trim() === 'Responden') b.click();
      });
    }, 50);
  };

  const rawRows  = data?.data || [];
  const total    = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const summary  = data?.summary || {};

  // Client-side search — filter di atas data yang sudah dipaginasi dari server
  const searchQ = search.trim().toLowerCase();
  const filtered = searchQ
    ? rawRows.filter(r =>
        (r.namaKepala||'').toLowerCase().includes(searchQ) ||
        (r.id||'').toLowerCase().includes(searchQ) ||
        (r.kecamatan||'').toLowerCase().includes(searchQ) ||
        (r.desa||'').toLowerCase().includes(searchQ) ||
        (r.petugas||'').toLowerCase().includes(searchQ) ||
        r.flags.some(f => (f.code||'').toLowerCase().includes(searchQ) ||
                          (f.ket||'').toLowerCase().includes(searchQ) ||
                          (f.usaha||'').toLowerCase().includes(searchQ))
      )
    : rawRows;

  // Client-side sort
  const rows = sortCol
    ? [...filtered].sort((a, b) => {
        let va, vb;
        if (sortCol === 'no')         { va = parseInt(a.no)||0;  vb = parseInt(b.no)||0; }
        else if (sortCol === 'id')    { va = a.id||'';           vb = b.id||''; }
        else if (sortCol === 'nama')  { va = a.namaKepala||'';   vb = b.namaKepala||''; }
        else if (sortCol === 'kec')   { va = a.kecamatan||'';    vb = b.kecamatan||''; }
        else if (sortCol === 'desa')  { va = a.desa||'';         vb = b.desa||''; }
        else if (sortCol === 'status'){ va = a.status||'';       vb = b.status||''; }
        else if (sortCol === 'flags') { va = a.flags.length;     vb = b.flags.length; }
        else { va = ''; vb = ''; }
        if (typeof va === 'number') return sortDir === 'asc' ? va-vb : vb-va;
        return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'id')
                                 : String(vb).localeCompare(String(va), 'id');
      })
    : filtered;

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    const active = sortCol === col;
    return (
      <span style={{ marginLeft:3, verticalAlign:'middle', opacity: active ? 1 : 0.3 }}>
        {active
          ? (sortDir === 'asc'
              ? <ChevronUp size={10} strokeWidth={2.5}/>
              : <ChevronDown size={10} strokeWidth={2.5}/>)
          : <ChevronsUpDown size={10} strokeWidth={2}/>}
      </span>
    );
  };

  return (
    <div style={{
      background:'var(--bg2)', border:'1px solid var(--border)',
      borderRadius:14, overflow:'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:'14px 18px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      }}>
        <AlertTriangle size={15} style={{ color:'#f43f5e' }}/>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>
          Daftar Anomali Responden
        </span>
        {total > 0 && (
          <span style={{
            padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
            background:'rgba(244,63,94,0.12)', color:'#f87171',
          }}>
            {total.toLocaleString('id')} responden
          </span>
        )}
      </div>

      {/* Tabs — full-wide capsule style */}
      <div style={{
        padding:'8px 12px',
        borderBottom:'1px solid var(--border)',
        background:'var(--bg3)',
      }}>
        <div style={{
          display:'grid',
          gridTemplateColumns:`repeat(${Object.keys(TAB_LABELS).length}, 1fr)`,
          background:'var(--bg4)',
          borderRadius:10,
          padding:3,
          gap:2,
        }}>
          {Object.entries(TAB_LABELS).map(([key, label]) => {
            const active = tab === key;
            // n = jumlah RESPONDEN unik di tab ini (bukan jumlah kasus flag)
            const n = tabSummary[key] || 0;
            return (
              <button
                key={key}
                onClick={() => switchTab(key)}
                style={{
                  padding:'8px 12px',
                  borderRadius:8,
                  fontSize:12,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'var(--text4)',
                  background: active
                    ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                    : 'transparent',
                  border: active ? '1px solid #f97316' : '1px solid transparent',
                  cursor:'pointer',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  gap:6,
                  transition:'all .18s ease',
                  boxShadow: active
                    ? '0 2px 10px rgba(249,115,22,0.35)'
                    : 'none',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text2)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text4)'; }}
              >
                {label}
                {n > 0 && (
                  <span style={{
                    padding:'1px 6px', borderRadius:10, fontSize:9, fontWeight:700,
                    background: active ? 'rgba(255,255,255,0.25)' : 'rgba(249,115,22,0.12)',
                    color: active ? '#fff' : '#f97316',
                    transition:'all .18s',
                  }}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        padding:'10px 14px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
        background:'rgba(255,255,255,0.01)',
      }}>
        <MultiSelect
          options={options}
          value={codes}
          onChange={v => { setCodes(v); setPage(1); }}
          placeholder={`Filter anomali (${options.length} jenis)`}
        />
        {/* Filter Kategori KBLI — hanya untuk tab Usaha */}
        {tab === 'usaha' && (
          <KategoriSelect
            value={filterKategori}
            onChange={v => { setFilterKategori(Array.isArray(v) ? v : v ? [v] : []); setPage(1); }}
          />
        )}
        {tab === 'usaha' && filterKategori.length > 0 && filterKategori.length <= 4 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {filterKategori.map(k => (
              <span key={k} style={{
                display:'inline-flex', alignItems:'center', gap:4,
                padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                background:'rgba(249,115,22,0.12)', color:'#f97316',
                border:'1px solid rgba(249,115,22,0.25)',
              }}>
                {k}
                <X size={9} style={{ cursor:'pointer' }}
                  onClick={() => setFilterKategori(filterKategori.filter(x=>x!==k))}/>
              </span>
            ))}
          </div>
        )}

        {codes.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {codes.map(c => {
              const cnt = summary[c] || 0;
              return (
                <span key={c} style={{
                  display:'inline-flex', alignItems:'center', gap:4,
                  padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                  background:`${codeColor(c)}15`, color:codeColor(c),
                  border:`1px solid ${codeColor(c)}30`,
                }}>
                  {c}{cnt > 0 && <span style={{ opacity:.7 }}>({cnt})</span>}
                  <X size={9} style={{ cursor:'pointer' }}
                    onClick={() => setCodes(codes.filter(x=>x!==c))}/>
                </span>
              );
            })}
          </div>
        )}
        {/* Filter Status — pill toggle */}
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          {[
            { val:'all',       label:'Semua' },
            { val:'APPROVED',  label:'Approved' },
            { val:'SUBMITTED', label:'Submitted' },
            { val:'REJECTED',  label:'Rejected' },
          ].map(({ val, label }) => {
            const active = filterStatus === val;
            const color  = val === 'APPROVED'  ? '#34d399'
                         : val === 'SUBMITTED' ? '#fbbf24'
                         : val === 'REJECTED'  ? '#f87171'
                         : 'var(--text3)';
            return (
              <button key={val}
                onClick={() => { setFilterStatus(val); setPage(1); }}
                style={{
                  padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:700,
                  cursor:'pointer', border:'none', transition:'all .15s',
                  background: active
                    ? (val === 'APPROVED'  ? 'rgba(52,211,153,0.18)'
                       : val === 'SUBMITTED' ? 'rgba(251,191,36,0.18)'
                       : val === 'REJECTED'  ? 'rgba(248,113,113,0.18)'
                       : 'var(--bg4)')
                    : 'transparent',
                  color: active ? color : 'var(--text4)',
                  boxShadow: active ? `0 0 0 1px ${color}44` : 'none',
                }}
              >{label}</button>
            );
          })}
        </div>

        {/* Search input */}
        <div style={{ display:'flex', alignItems:'center', gap:6,
          padding:'5px 10px', borderRadius:8, background:'var(--bg3)',
          border:'1px solid var(--border)', flex:'0 0 200px' }}>
          <Search size={11} style={{ color:'var(--text4)', flexShrink:0 }}/>
          <input
            placeholder="Cari nama, ID, kecamatan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border:'none', background:'transparent', outline:'none',
              fontSize:11, color:'var(--text2)', width:'100%' }}
          />
          {search && (
            <X size={10} onClick={() => setSearch('')}
              style={{ color:'var(--text4)', cursor:'pointer', flexShrink:0 }}/>
          )}
        </div>

        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text4)' }}>
          {loading ? 'Memuat...'
            : search && filtered.length !== rawRows.length
              ? `${filtered.length} dari ${rawRows.length} (hal ini)`
              : total > 0 ? `${total.toLocaleString('id')} ditemukan` : ''}
        </span>
      </div>

      {/* Tabel */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
          <thead>
            <tr style={{ background:'var(--bg3)' }}>
              {[
                { label:'No',          col:'no',     w:40  },
                { label:'ID',          col:'id',     w:90  },
                { label:'Nama',        col:'nama',   w:null },
                { label:'Kecamatan',   col:'kec',    w:null },
                { label:'Desa',        col:'desa',   w:null },
                { label:'Status',      col:'status', w:90  },
                { label:'Kode Anomali',col:'flags',  w:null },
                { label:'',            col:'',       w:160  },
              ].map(({ label, col, w }, i) => (
                <th key={i}
                  onClick={col ? () => handleSort(col) : undefined}
                  style={{
                    ...th,
                    ...(i===7 ? { textAlign:'right', paddingRight:12 } : {}),
                    ...(w ? { width: w } : {}),
                    cursor: col ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (col) e.currentTarget.style.color='var(--text2)'; }}
                  onMouseLeave={e => { if (col) e.currentTarget.style.color=''; }}
                >
                  {label}{col && <SortIcon col={col}/>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding:'32px', textAlign:'center', color:'var(--text4)', fontSize:12 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:14,height:14,borderRadius:'50%',
                    border:'2px solid var(--bg4)',borderTopColor:'var(--indigo)',
                    animation:'spin .8s linear infinite' }}/>
                  Menghitung anomali...
                </div>
              </td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={8} style={{ padding:'24px', textAlign:'center', color:'#f87171', fontSize:12 }}>
                ✗ {error}
              </td></tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:28 }}>✓</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text2)' }}>
                    Tidak ada anomali{codes.length ? ' untuk filter ini' : ''}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text4)' }}>
                    {codes.length ? 'Coba pilih kode anomali lain' : `Semua responden di tab ${TAB_LABELS[tab]} bersih`}
                  </div>
                </div>
              </td></tr>
            )}
            {!loading && rows.map((rec, i) => (
              <AnomalyRow key={rec.id} rec={rec} idx={i} onNavigate={navigate}/>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding:'10px 16px', borderTop:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'var(--bg3)',
        }}>
          <span style={{ fontSize:11, color:'var(--text4)' }}>
            Hal {page} dari {totalPages} ({total.toLocaleString('id')} total)
          </span>
          <div style={{ display:'flex', gap:4 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p-1))}
              disabled={page <= 1}
              style={paginBtn(page <= 1)}
            >
              <ChevronLeft size={13}/>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages-4, page-2)) + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} style={paginBtn(false, p===page)}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p+1))}
              disabled={page >= totalPages}
              style={paginBtn(page >= totalPages)}
            >
              <ChevronRight size={13}/>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes dropIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}

function paginBtn(disabled, active) {
  return {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:28, height:28, borderRadius:6, border:'1px solid var(--border)',
    fontSize:11, fontWeight: active ? 700 : 400, cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? 'var(--indigo)' : 'var(--bg2)',
    color: disabled ? 'var(--text4)' : active ? '#fff' : 'var(--text2)',
    opacity: disabled ? 0.4 : 1, transition:'background .15s',
  };
}