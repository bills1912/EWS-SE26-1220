// src/pages/WilayahMapPage.jsx
// Tab baru: Peta Progress Wilayah — choropleth sub-SLS (Leaflet) + panel detail
// pencacah/pengawas/progress per sub-SLS. Data digabung backend dari
// geo_subsls (batas wilayah) + assignment_subsls (progress), join by idsubsls.
//
// Terintegrasi dengan KecamatanContext (selector kecamatan global di Topbar —
// tidak ada dropdown kecamatan duplikat di halaman ini) dan komponen ui.jsx
// (Card, SectionTitle, Badge, PulseDot) yang sama dipakai tab lain.
//
// Dependency baru: leaflet, react-leaflet (sudah ditambahkan ke package.json).
// Tambahkan baris ini SEKALI SAJA di entry point app (main.jsx):
//     import 'leaflet/dist/leaflet.css';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON as LeafletGeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Users, TrendingUp, X, Loader2, RefreshCw,
  Layers, Building2, ShieldCheck, Home, ClipboardList,
} from 'lucide-react';
import { Card, SectionTitle, Badge, PulseDot } from '../components/ui.jsx';
import { useKecamatan } from '../context/KecamatanContext.jsx';
import DesaFilter from '../components/DesaFilter.jsx';
import PetugasFilter from '../components/PetugasFilter.jsx';
import SubSlsFilter from '../components/SubSlsFilter.jsx';
import { useIsMobile } from '../hooks/useBreakpoint.js';

const TOKEN_KEY = 'ews_token';

function getBaseURL() {
  return (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
}

async function apiFetch(path) {
  const BASE_URL = getBaseURL();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('Token tidak ditemukan. Silakan login.');
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server API.');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Basemap Google (Hybrid = satelit+label, Satellite = citra polos ala
// Google Earth) — pakai XYZ tile endpoint Google langsung. Ini pola yang umum
// dipakai utk internal tool/prototyping, TAPI perlu dicatat: ini bukan jalur
// resmi Google Maps Platform (tidak lewat API key/billing resmi), jadi utk
// pemakaian produksi jangka panjang idealnya migrasi ke Google Maps JS API
// atau layanan tile berbayar resmi supaya sesuai Terms of Service Google.
const BASEMAP_TILES = {
  hybrid: {
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    label: 'Hybrid',
    sub: 'Satelit + jalan/label',
  },
  satellite: {
    url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    label: 'Satelit',
    sub: 'Citra polos (ala Google Earth)',
  },
};
const GOOGLE_SUBDOMAINS = ['mt0', 'mt1', 'mt2', 'mt3'];

// ── Skala warna ────────────────────────────────────────────────────────────
// Progress: merah (0%) -> kuning (50%) -> hijau (100%)
function colorForProgress(pct) {
  if (pct == null) return '#3a3f52'; // abu-abu = belum ada data sama sekali
  const p = Math.max(0, Math.min(100, pct));
  if (p < 50) {
    const t = p / 50;
    return lerpColor('#ef4444', '#fbbf24', t);
  }
  const t = (p - 50) / 50;
  return lerpColor('#fbbf24', '#34d399', t);
}

// Total assignment: biru muda -> biru tua, skala relatif thd max
function colorForTotal(total, maxTotal) {
  if (!total) return '#3a3f52';
  const t = Math.max(0, Math.min(1, total / (maxTotal || 1)));
  return lerpColor('#bfdbfe', '#1d4ed8', t);
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// ── Kartu ringkasan angka di atas (pakai Card dari ui.jsx, konsisten dgn tab lain)
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <Card style={{ flex:'1 1 160px', padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <Icon size={13} color={color || 'var(--text4)'}/>
        <span style={{ fontSize:9.5, fontWeight:700, color:'var(--text4)',
          textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize:24, fontWeight:800, color: color || 'var(--text1)', fontFamily:'var(--mono)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{sub}</div>}
    </Card>
  );
}

// ── Legend skala warna, pojok bawah peta ───────────────────────────────────
function MapLegend({ mode, label }) {
  const stops = mode === 'total'
    ? [{c:'#bfdbfe',l:'Sedikit'},{c:'#3b82f6',l:'Sedang'},{c:'#1d4ed8',l:'Banyak'}]
    : [{c:'#ef4444',l:'0%'},{c:'#fbbf24',l:'50%'},{c:'#34d399',l:'100%'}];
  const title = label || (mode === 'progress' ? 'Progress Pencacahan' : 'Jumlah Assignment');
  return (
    <div style={{ position:'absolute', bottom:12, left:12, zIndex:1000, maxWidth:'calc(100% - 24px)',
      background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:10,
      padding:'8px 12px', boxShadow:'0 4px 16px rgba(0,0,0,0.4)', fontSize:10.5 }}>
      <div style={{ fontWeight:700, color:'var(--text2)', marginBottom:6, fontSize:9.5,
        textTransform:'uppercase', letterSpacing:'0.05em' }}>
        {title}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        {stops.map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:s.c }}/>
            <span style={{ color:'var(--text3)' }}>{s.l}</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:4 }}>
          <div style={{ width:12, height:12, borderRadius:3, background:'#3a3f52' }}/>
          <span style={{ color:'var(--text4)' }}>Belum ada data</span>
        </div>
      </div>
    </div>
  );
}

// ── Panel detail sub-SLS yang diklik ───────────────────────────────────────
function SubSlsDetailPanel({ data, onClose }) {
  if (!data) return null;
  const p = data.properties;
  const Row = ({ label, value, color }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0',
      borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:11, color:'var(--text3)' }}>{label}</span>
      <span style={{ fontSize:11.5, fontWeight:700, color: color || 'var(--text1)',
        fontFamily:'var(--mono)' }}>{value}</span>
    </div>
  );
  return (
    <div style={{ position:'absolute', top:12, right:12, zIndex:1000,
      width:'min(300px, calc(100% - 24px))', /* cap 300px di layar lebar, otomatis
      menyempit dgn margin 12px kiri-kanan di layar sempit — tidak pernah overflow */
      maxHeight:'calc(100% - 24px)', overflowY:'auto',
      background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:14,
      boxShadow:'0 12px 32px rgba(0,0,0,0.5)', animation:'wilayahPanelIn .2s ease both' }}>
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'flex-start', gap:8 }}>
        <MapPin size={15} color="var(--orange3)" style={{ marginTop:2, flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{p.desa || '—'}</div>
          <div style={{ fontSize:10.5, color:'var(--text4)', marginTop:2 }}>
            {p.kecamatan} · SLS {p.sls}
          </div>
          <div style={{ fontSize:9, color:'var(--text4)', fontFamily:'var(--mono)', marginTop:2 }}>
            {p.idsubsls}
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
          padding:4, borderRadius:6, flexShrink:0 }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
          onMouseLeave={e=>e.currentTarget.style.background='none'}>
          <X size={14} color="var(--text3)"/>
        </button>
      </div>

      <div style={{ padding:'12px 16px' }}>
        {p.progressPct === null ? (
          <div style={{ padding:'10px', background:'rgba(148,163,184,0.1)', borderRadius:8,
            fontSize:11, color:'var(--text4)', textAlign:'center' }}>
            Belum ada assignment tercatat di sub-SLS ini
          </div>
        ) : (
          <>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'var(--text4)', fontWeight:600,
                  textTransform:'uppercase', letterSpacing:'0.05em' }}>Progress</span>
                <span style={{ fontSize:13, fontWeight:800, color: colorForProgress(p.progressPct) }}>
                  {p.progressPct}%
                </span>
              </div>
              <div style={{ height:8, borderRadius:99, background:'var(--bg3)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${p.progressPct}%`,
                  background: colorForProgress(p.progressPct), borderRadius:99,
                  transition:'width .3s' }}/>
              </div>
            </div>

            <Row label="Total Assignment" value={p.total} />
            <Row label="Approved" value={p.approved} color="#34d399" />
            <Row label="Submit"   value={p.submit}   color="#fbbf24" />
            <Row label="Rejected" value={p.reject}   color="#f87171" />
            <Row label="Draft"    value={p.draft}    color="#60a5fa" />
            <Row label="Open"     value={p.open}     color="var(--text4)" />
            {p.editedByAdmin > 0 && (
              <Row label="Edit oleh Admin" value={p.editedByAdmin} color="#f59e0b" />
            )}
            {p.completedByAdmin > 0 && (
              <Row label="Diselesaikan oleh Admin" value={p.completedByAdmin} color="#10b981" />
            )}

            <div style={{ height:1, background:'var(--border)', margin:'10px 0' }}/>

            {(p.prelistKeluargaTotal > 0 || p.prelistUsahaTotal > 0) && (
              <>
                {p.prelistKeluargaTotal > 0 && (
                  <Row label="Assignment Keluarga"
                    value={`${p.assignmentKeluargaSelesai}/${p.prelistKeluargaTotal} (${p.assignmentKeluargaPct}%)`}
                    color="#38bdf8" />
                )}
                {p.prelistKeluargaTotal > 0 && p.additionalKeluargaTotal > 0 && (
                  <div style={{ fontSize:9.5, color:'var(--text4)', marginTop:-4, marginBottom:6, paddingLeft:2 }}>
                    ({p.prelistKeluargaSelesai} prelist + {p.additionalKeluargaSelesai} baru dari {p.additionalKeluargaTotal} ditemukan)
                  </div>
                )}
                {p.prelistUsahaTotal > 0 && (
                  <Row label="Assignment Usaha"
                    value={`${p.assignmentUsahaSelesai}/${p.prelistUsahaTotal} (${p.assignmentUsahaPct}%)`}
                    color="#a78bfa" />
                )}
                {p.prelistUsahaTotal > 0 && p.additionalUsahaTotal > 0 && (
                  <div style={{ fontSize:9.5, color:'var(--text4)', marginTop:-4, marginBottom:6, paddingLeft:2 }}>
                    ({p.prelistUsahaSelesai} prelist + {p.additionalUsahaSelesai} baru dari {p.additionalUsahaTotal} ditemukan)
                  </div>
                )}
                <div style={{ height:1, background:'var(--border)', margin:'10px 0' }}/>
              </>
            )}

            <Row label="Assignment Usaha Ditemukan" value={p.usahaAssignmentCount} color="#a78bfa" />
            <Row label="Total Usaha" value={p.totalUsahaDitemukan} color="#a78bfa" />
            {p.usahaMaxCount > 0 && (
              <Row label="Usaha Terbanyak" value={`${p.usahaMaxCount} (${p.usahaMaxDesa||'—'})`} color="#a78bfa" />
            )}
          </>
        )}

        <div style={{ height:1, background:'var(--border)', margin:'12px 0' }}/>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <div style={{ width:26, height:26, borderRadius:8, background:'rgba(96,165,250,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Users size={13} color="#60a5fa"/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase',
              letterSpacing:'0.05em', fontWeight:600 }}>Pencacah</div>
            <div style={{ fontSize:11.5, fontWeight:700, color:'var(--text1)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {p.pencacahNama || '—'}
            </div>
            {p.pencacahEmail && (
              <div style={{ fontSize:9.5, color:'var(--text4)', overflow:'hidden',
                textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.pencacahEmail}</div>
            )}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:8, background:'rgba(167,139,250,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ShieldCheck size={13} color="#a78bfa"/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase',
              letterSpacing:'0.05em', fontWeight:600 }}>Pengawas</div>
            <div style={{ fontSize:11.5, fontWeight:700, color:'var(--text1)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {p.pengawasNama || '—'}
            </div>
            {p.pengawasEmail && (
              <div style={{ fontSize:9.5, color:'var(--text4)', overflow:'hidden',
                textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.pengawasEmail}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auto-fit/zoom peta ke bounds data yang lagi ditampilkan ────────────────
// PENTING: komponen ini di-render sbg CHILD dari <MapContainer>, dan pakai
// hook useMap() (pola resmi react-leaflet) — bukan ref dari komponen induk.
// Ini menghindari race condition timing waktu MapContainer di-mount ULANG
// (mis. saat ganti kecamatan, yang bikin peta unmount total krn state
// loading, lalu mount lagi) — ref dari luar (mapRef.current) sempat
// null/stale persis di momen itu, sedangkan useMap() dijamin SELALU
// mengembalikan instance peta yang valid, karena cuma bisa dipanggil
// dari dalam pohon komponen yang memang sudah ter-mount oleh MapContainer.
function AutoFitBounds({ data }) {
  const map = useMap();
  useEffect(() => {
    if (!data || !data.features.length) return;
    try {
      const bounds = L.geoJSON(data).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
    } catch (e) {
      console.warn('[WilayahMapPage] Gagal fit bounds:', e);
    }
  }, [data, map]);
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
export function WilayahMapPage() {
  const isMobile = useIsMobile();
  const { selectedKec } = useKecamatan(); // dikontrol dari dropdown global di Topbar
  const [geoData, setGeoData]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [colorMode, setColorMode]   = useState('progress'); // 'progress' | 'total'
  const [basemapMode, setBasemapMode] = useState('hybrid'); // 'hybrid' | 'satellite'
  const [viewMode, setViewMode] = useState('progress'); // 'progress' | 'prelist' — tab utama
  const [prelistType, setPrelistType] = useState('keluarga'); // 'keluarga' | 'usaha' — sub-toggle utk tab prelist
  const [selectedDesa, setSelectedDesa] = useState(''); // '' = semua desa, konvensi sama dgn DesaFilter
  const [selectedPencacah, setSelectedPencacah] = useState(''); // '' = semua pencacah
  const [selectedPengawas, setSelectedPengawas] = useState(''); // '' = semua pengawas
  const [selectedSubSls, setSelectedSubSls] = useState([]); // [] = semua sub-SLS, ARRAY krn multi-select
  const [selectedFeature, setSelectedFeature] = useState(null);
  const geoLayerRef = useRef(null);
  const mapRef = useRef(null);

  const fetchGeo = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(selectedKec !== 'all' ? { kec: selectedKec } : {});
    apiFetch(`/api/wilayah/geojson?${params}`)
      .then(result => { setGeoData(result); setLoading(false); })
      .catch(e => { setError(e.message || 'Gagal memuat data peta.'); setLoading(false); });
  };

  useEffect(() => { fetchGeo(); /* eslint-disable-next-line */ }, [selectedKec]);
  // Reset semua filter turunan tiap kali kecamatan (global) berganti — daftar2nya ikut berubah
  useEffect(() => { setSelectedDesa(''); setSelectedPencacah(''); setSelectedPengawas(''); setSelectedSubSls([]); }, [selectedKec]);

  // Daftar desa/pencacah/pengawas unik dari data yang sudah ke-fetch (tidak
  // perlu request baru ke server tiap ganti filter — semua turunan client-side)
  const desaList = useMemo(() => {
    if (!geoData) return [];
    return [...new Set(geoData.features.map(f => f.properties.desa).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'id'));
  }, [geoData]);

  const pencacahList = useMemo(() => {
    if (!geoData) return [];
    return [...new Set(geoData.features.map(f => f.properties.pencacahNama).filter(v => v && v !== '—'))]
      .sort((a, b) => a.localeCompare(b, 'id'));
  }, [geoData]);

  const pengawasList = useMemo(() => {
    if (!geoData) return [];
    return [...new Set(geoData.features.map(f => f.properties.pengawasNama).filter(v => v && v !== '—'))]
      .sort((a, b) => a.localeCompare(b, 'id'));
  }, [geoData]);

  // Daftar sub-SLS utk SubSlsFilter — 1 entri per feature (idsubsls = join
  // key unik). `primary` = label nama yg ditampilkan (desa · SLS · Sub NN),
  // `searchText` gabungan semua field yg boleh dicari (nama + kode), biar
  // filter bisa nemu baik dari nama maupun dari kode idsubsls-nya.
  const subSlsList = useMemo(() => {
    if (!geoData) return [];
    return geoData.features
      .map(f => {
        const p = f.properties;
        const subSuffix = (p.idsubsls || '').slice(-2);
        const primary = `${p.desa || '—'} · SLS ${p.sls || '—'} · Sub ${subSuffix}`;
        return {
          idsubsls: p.idsubsls,
          primary,
          searchText: `${primary} ${p.idsubsls} ${p.kecamatan || ''}`.toLowerCase(),
        };
      })
      .sort((a, b) => a.primary.localeCompare(b.primary, 'id'));
  }, [geoData]);

  // Data yang benar-benar dirender di peta + dipakai hitung kartu ringkasan —
  // hasil filter desa/pencacah/pengawas/sub-SLS (client-side, semua AND) di
  // atas geoData yang sudah difilter kecamatan (server-side). selectedSubSls
  // array kosong = tidak membatasi apa2 (sama spt filter lain, '' = semua).
  const displayData = useMemo(() => {
    if (!geoData) return null;
    if (!selectedDesa && !selectedPencacah && !selectedPengawas && selectedSubSls.length === 0) return geoData;
    const subSlsSet = selectedSubSls.length > 0 ? new Set(selectedSubSls) : null;
    return {
      ...geoData,
      features: geoData.features.filter(f =>
        (!selectedDesa     || f.properties.desa         === selectedDesa) &&
        (!selectedPencacah || f.properties.pencacahNama  === selectedPencacah) &&
        (!selectedPengawas || f.properties.pengawasNama  === selectedPengawas) &&
        (!subSlsSet         || subSlsSet.has(f.properties.idsubsls))
      ),
    };
  }, [geoData, selectedDesa, selectedPencacah, selectedPengawas, selectedSubSls]);

  const maxTotal = useMemo(() => {
    if (!displayData) return 1;
    return Math.max(1, ...displayData.features.map(f => f.properties.total || 0));
  }, [displayData]);

  const avgProgress = useMemo(() => {
    if (!displayData || !displayData.features.length) return 0;
    const withData = displayData.features.filter(f => f.properties.progressPct !== null);
    if (!withData.length) return 0;
    return Math.round(withData.reduce((a,f) => a + f.properties.progressPct, 0) / withData.length * 10) / 10;
  }, [displayData]);

  const totalAssignment = useMemo(() => {
    if (!displayData) return 0;
    return displayData.features.reduce((a,f) => a + (f.properties.total || 0), 0);
  }, [displayData]);

  // Statistik ringkasan utk tab "Distribusi Prelist" — dihitung sesuai
  // prelistType (keluarga/usaha) yang lagi aktif. "total"/"selesai" di sini
  // pakai metrik GABUNGAN (prelist + assignment tambahan yg ditemukan &
  // selesai), penyebut tetap total prelist saja — sesuai definisi resmi.
  const prelistStats = useMemo(() => {
    if (!displayData) return { total: 0, selesai: 0, avgPct: 0, subslsAda: 0 };
    const totalKey   = prelistType === 'keluarga' ? 'prelistKeluargaTotal'      : 'prelistUsahaTotal';
    const selesaiKey = prelistType === 'keluarga' ? 'assignmentKeluargaSelesai' : 'assignmentUsahaSelesai';
    const pctKey     = prelistType === 'keluarga' ? 'assignmentKeluargaPct'     : 'assignmentUsahaPct';
    let total = 0, selesai = 0, subslsAda = 0;
    const pcts = [];
    displayData.features.forEach(f => {
      const t = f.properties[totalKey] || 0;
      total   += t;
      selesai += f.properties[selesaiKey] || 0;
      if (t > 0) { subslsAda++; pcts.push(f.properties[pctKey] ?? 0); }
    });
    const avgPct = pcts.length ? Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length*10)/10 : 0;
    return { total, selesai, avgPct, subslsAda };
  }, [displayData, prelistType]);



  const styleFeature = (feature) => {
    const p = feature.properties;
    let fillColor;
    if (viewMode === 'prelist') {
      const pct = prelistType === 'keluarga' ? p.assignmentKeluargaPct : p.assignmentUsahaPct;
      const hasPrelist = (prelistType === 'keluarga' ? p.prelistKeluargaTotal : p.prelistUsahaTotal) > 0;
      fillColor = hasPrelist ? colorForProgress(pct) : '#3a3f52';
    } else {
      fillColor = colorMode === 'progress'
        ? colorForProgress(p.progressPct)
        : colorForTotal(p.total, maxTotal);
    }
    const isSelected = selectedFeature?.properties?.idsubsls === p.idsubsls;
    return {
      fillColor,
      // Opacity lebih rendah drpd sebelumnya (dulu di atas basemap gelap polos) —
      // biar citra satelit/hybrid di baliknya tetap kelihatan jelas lokasinya.
      fillOpacity: isSelected ? 0.75 : 0.45,
      color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.55)',
      weight: isSelected ? 2.5 : 1,
    };
  };

  const onEachFeature = (feature, layer) => {
    layer.on({
      click: () => setSelectedFeature(feature),
      mouseover: (e) => { e.target.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.65 }); },
      mouseout:  (e) => { if (geoLayerRef.current) geoLayerRef.current.resetStyle(e.target); },
    });
    const p = feature.properties;
    const tooltipBody = viewMode === 'prelist'
      ? (() => {
          const total   = prelistType === 'keluarga' ? p.prelistKeluargaTotal      : p.prelistUsahaTotal;
          const selesai = prelistType === 'keluarga' ? p.assignmentKeluargaSelesai : p.assignmentUsahaSelesai;
          const pct     = prelistType === 'keluarga' ? p.assignmentKeluargaPct     : p.assignmentUsahaPct;
          const label   = prelistType === 'keluarga' ? 'Assignment Keluarga' : 'Assignment Usaha';
          return total > 0 ? `${label}: ${pct}% (${selesai}/${total} selesai)` : `${label}: tidak ada`;
        })()
      : (p.progressPct !== null ? `Progress: ${p.progressPct}% (${p.total} assignment)` : 'Belum ada data');
    layer.bindTooltip(
      `<strong>${p.desa}</strong><br/>${p.sls}<br/>` + tooltipBody,
      { sticky: true }
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Header */}
      <SectionTitle
        icon={MapPin}
        right={
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {selectedKec !== 'all' && <Badge variant="info">{selectedKec}</Badge>}
            <button onClick={fetchGeo} disabled={loading}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
                fontSize:11, fontWeight:600, borderRadius:8, border:'1px solid var(--border2)',
                background:'var(--bg3)', color:'var(--text2)', cursor: loading ? 'default':'pointer' }}>
              <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}/>
              Refresh
            </button>
          </div>
        }
      >
        Peta Progress Wilayah — per Sub-SLS
      </SectionTitle>

      {/* Tab utama: Progress Wilayah vs Distribusi Prelist */}
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid var(--border)' }}>
        {[
          { key:'progress', label:'Progress Wilayah', icon: TrendingUp },
          { key:'prelist',  label:'Distribusi Prelist', icon: ClipboardList },
        ].map(t => {
          const Icon = t.icon;
          const active = viewMode === t.key;
          return (
            <button key={t.key} onClick={() => setViewMode(t.key)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px',
                fontSize:12, fontWeight:600, border:'none', cursor:'pointer',
                borderBottom: active ? '2px solid var(--orange)' : '2px solid transparent',
                marginBottom:-1, background:'transparent',
                color: active ? 'var(--orange3)' : 'var(--text3)' }}>
              <Icon size={13}/>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Kartu ringkasan */}
      {viewMode === 'progress' ? (
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <StatCard icon={Layers} label="Total Sub-SLS" value={displayData?.features.length ?? '—'} color="var(--text1)"/>
          <StatCard icon={TrendingUp} label="Rata-rata Progress" value={`${avgProgress}%`} color={colorForProgress(avgProgress)}/>
          <StatCard icon={Building2} label="Total Assignment" value={totalAssignment.toLocaleString('id')} color="#60a5fa"/>
          <StatCard icon={ShieldCheck} label="Sub-SLS Ada Data"
            value={displayData
              ? `${displayData.features.filter(f => f.properties.progressPct !== null).length}/${displayData.features.length}`
              : '—'} color="#34d399"/>
        </div>
      ) : (
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <StatCard icon={prelistType==='keluarga' ? Home : Building2}
            label={`Total Prelist ${prelistType==='keluarga' ? 'Keluarga' : 'Usaha'}`}
            value={prelistStats.total.toLocaleString('id')}
            color={prelistType==='keluarga' ? '#38bdf8' : '#a78bfa'}/>
          <StatCard icon={ShieldCheck} label="Sudah Selesai" value={prelistStats.selesai.toLocaleString('id')} color="#34d399"/>
          <StatCard icon={TrendingUp} label="Rata-rata Progress Prelist" value={`${prelistStats.avgPct}%`} color={colorForProgress(prelistStats.avgPct)}/>
          <StatCard icon={Layers} label="Sub-SLS Ada Prelist"
            value={displayData ? `${prelistStats.subslsAda}/${displayData.features.length}` : '—'} color="var(--text1)"/>
        </div>
      )}

      {/* Filter Desa/Pencacah/Pengawas/Sub-SLS — komponen shared/serupa DesaFilter */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:10.5, color:'var(--text4)', fontWeight:600 }}>Filter:</span>
        <DesaFilter
          value={selectedDesa}
          onChange={setSelectedDesa}
          desaList={desaList}
          disabled={loading}
        />
        <PetugasFilter
          value={selectedPencacah}
          onChange={setSelectedPencacah}
          list={pencacahList}
          disabled={loading}
          label="Pencacah"
          icon={Users}
        />
        <PetugasFilter
          value={selectedPengawas}
          onChange={setSelectedPengawas}
          list={pengawasList}
          disabled={loading}
          label="Pengawas"
          icon={ShieldCheck}
        />
        <div style={{ width:1, height:20, background:'var(--border2)' }}/>
        <SubSlsFilter
          value={selectedSubSls}
          onChange={setSelectedSubSls}
          list={subSlsList}
          disabled={loading}
        />
        {selectedKec === 'all' && (desaList.length > 0 || pencacahList.length > 0) && (
          <span style={{ fontSize:9.5, color:'var(--text4)', fontStyle:'italic' }}>
            Tip: pilih kecamatan dulu di atas biar daftar lebih ringkas
          </span>
        )}
      </div>

      {/* Toggle mode warna (beda tergantung tab) + basemap */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        {viewMode === 'progress' ? (
          <>
            <span style={{ fontSize:10.5, color:'var(--text4)', fontWeight:600 }}>Tampilkan warna:</span>
            {[
              { key:'progress', label:'Persentase Progress' },
              { key:'total', label:'Jumlah Assignment' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setColorMode(opt.key)}
                style={{ padding:'6px 12px', fontSize:11, fontWeight:600, borderRadius:8,
                  border: colorMode===opt.key ? '1px solid var(--orange)' : '1px solid var(--border2)',
                  background: colorMode===opt.key ? 'rgba(232,84,28,0.12)' : 'var(--bg2)',
                  color: colorMode===opt.key ? 'var(--orange3)' : 'var(--text3)', cursor:'pointer' }}>
                {opt.label}
              </button>
            ))}
          </>
        ) : (
          <>
            <span style={{ fontSize:10.5, color:'var(--text4)', fontWeight:600 }}>Jenis prelist:</span>
            {[
              { key:'keluarga', label:'Keluarga (DTSEN)', icon: Home },
              { key:'usaha', label:'Usaha (UB/UM/UMK/UMKM)', icon: Building2 },
            ].map(opt => {
              const Icon = opt.icon;
              return (
                <button key={opt.key} onClick={() => setPrelistType(opt.key)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', fontSize:11, fontWeight:600, borderRadius:8,
                    border: prelistType===opt.key ? '1px solid var(--orange)' : '1px solid var(--border2)',
                    background: prelistType===opt.key ? 'rgba(232,84,28,0.12)' : 'var(--bg2)',
                    color: prelistType===opt.key ? 'var(--orange3)' : 'var(--text3)', cursor:'pointer' }}>
                  <Icon size={12}/>
                  {opt.label}
                </button>
              );
            })}
          </>
        )}

        <div style={{ width:1, height:20, background:'var(--border2)', margin:'0 4px' }}/>

        <span style={{ fontSize:10.5, color:'var(--text4)', fontWeight:600 }}>Peta dasar:</span>
        {Object.entries(BASEMAP_TILES).map(([key, cfg]) => (
          <button key={key} onClick={() => setBasemapMode(key)} title={cfg.sub}
            style={{ padding:'6px 12px', fontSize:11, fontWeight:600, borderRadius:8,
              border: basemapMode===key ? '1px solid var(--orange)' : '1px solid var(--border2)',
              background: basemapMode===key ? 'rgba(232,84,28,0.12)' : 'var(--bg2)',
              color: basemapMode===key ? 'var(--orange3)' : 'var(--text3)', cursor:'pointer' }}>
            {cfg.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize:9.5, color:'var(--text4)', marginTop:-10 }}>
        {BASEMAP_TILES[basemapMode].sub}
      </div>

      {/* Peta */}
      <Card style={{ padding:0, position:'relative', width:'100%', height: isMobile ? 380 : 600, overflow:'hidden' }}>
        {loading && (
          <div style={{ position:'absolute', inset:0, zIndex:1000, display:'flex',
            alignItems:'center', justifyContent:'center', background:'var(--bg1)', gap:8 }}>
            <Loader2 size={16} color="var(--orange3)" style={{ animation:'spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:12, color:'var(--text3)' }}>Memuat peta wilayah…</span>
          </div>
        )}
        {error && !loading && (
          <div style={{ position:'absolute', inset:0, zIndex:1000, display:'flex',
            flexDirection:'column', alignItems:'center', justifyContent:'center',
            background:'var(--bg1)', gap:8, padding:24, textAlign:'center' }}>
            <span style={{ fontSize:12, color:'#f87171' }}>{error}</span>
            <button onClick={fetchGeo} style={{ padding:'6px 14px', fontSize:11, fontWeight:600,
              borderRadius:8, border:'1px solid var(--border2)', background:'var(--bg2)',
              color:'var(--text2)', cursor:'pointer' }}>Coba lagi</button>
          </div>
        )}
        {displayData && !loading && !error && (
          <MapContainer
            ref={mapRef}
            center={[1.65, 99.75]}
            zoom={10}
            style={{ width:'100%', height:'100%', background:'var(--bg1)' }}
          >
            <TileLayer
              key={basemapMode /* force reload layer saat basemap diganti */}
              url={BASEMAP_TILES[basemapMode].url}
              subdomains={GOOGLE_SUBDOMAINS}
              maxZoom={20}
              attribution='&copy; Google'
            />
            <LeafletGeoJSON
              key={`${selectedKec}-${selectedDesa}-${selectedPencacah}-${selectedPengawas}-${selectedSubSls.join(',')}-${colorMode}-${viewMode}-${prelistType}` /* recreate layer TOTAL saat filter (kec/desa/pencacah/pengawas/subSls) ATAU mode warna/tab/jenis prelist berubah — react-leaflet TIDAK otomatis re-render geometri hanya krn prop `data` berubah, harus lewat key. Ini juga sekalian cegah Leaflet resetStyle() balik ke fungsi warna lama yg ke-cache */}
              ref={geoLayerRef}
              data={displayData}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
            <AutoFitBounds data={displayData}/>
          </MapContainer>
        )}
        {displayData && !loading && !error && (
          <MapLegend
            mode={viewMode === 'prelist' ? 'progress' : colorMode}
            label={viewMode === 'prelist' ? `Progress Prelist ${prelistType==='keluarga'?'Keluarga':'Usaha'}` : undefined}
          />
        )}
        {selectedFeature && (
          <SubSlsDetailPanel data={selectedFeature} onClose={() => setSelectedFeature(null)}/>
        )}
      </Card>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes wilayahPanelIn { from { opacity:0; transform: translateX(8px); } to { opacity:1; transform:none; } }
        .leaflet-tooltip { background: var(--bg2) !important; color: var(--text1) !important;
          border: 1px solid var(--border2) !important; font-size: 11px !important; }
        .leaflet-container { font-family: inherit; }
      `}</style>
    </div>
  );
}