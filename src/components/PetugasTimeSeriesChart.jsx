/**
 * src/components/PetugasTimeSeriesChart.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Chart aktivitas harian per petugas.
 * Fitur:
 *  - Bar stacked / Line per status (toggle)
 *  - Reference lines rata-rata per status (animated reveal)
 *  - Indikator rata2 per hari di atas chart (animated counter)
 *  - Kumulatif approved di sumbu kanan
 */
import { useState, useEffect, useRef } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  Area,
} from 'recharts';
import { TrendingUp, Calendar, AlertCircle, Minus } from 'lucide-react';

const TOKEN_KEY = 'ews_token';
const BASE = () =>
  (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

async function fetchSeries(email, role) {
  const res = await fetch(
    `${BASE()}/api/evaluasi/timeseries?email=${encodeURIComponent(email)}&role=${role}`,
    { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { series: [...], avgPerDay: {...} }
}

const fmtDate = str => {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

// Animated counter hook
function useCountUp(target, duration = 600) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const t0  = useRef(null);
  useEffect(() => {
    const end = parseFloat(target) || 0;
    t0.current = null;
    const tick = ts => {
      if (!t0.current) t0.current = ts;
      const p = Math.min((ts - t0.current) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(end * e * 100) / 100);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// Animated number display
function ANum({ value, decimals = 1 }) {
  const v = useCountUp(value);
  return <>{v.toFixed(decimals)}</>;
}

// Warna per status
const CLR = {
  approved:  '#10b981',
  submitted: '#f59e0b',
  rejected:  '#f43f5e',
  draft:     '#4b72c8',    // --blue3
};

const LABEL = {
  approved:  'Approved',
  submitted: 'Submitted',
  rejected:  'Rejected',
  draft:     'Draft',
};

// Tooltip custom
function CustomTooltip({ active, payload, label, avgPerDay }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border2)',
      borderRadius: 10, padding: '10px 14px', fontSize: 11,
      boxShadow: '0 6px 24px rgba(0,0,0,0.3)', minWidth: 180,
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text1)', marginBottom: 8,
                     display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={10}/>{fmtDate(label)}
      </div>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{
          display: 'flex', justifyContent: 'space-between', gap: 20,
          color: p.color, marginBottom: 3, alignItems: 'center',
        }}>
          <span style={{ fontWeight: 500 }}>{p.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{p.value}</span>
            {/* Bandingkan dengan rata-rata */}
            {avgPerDay && p.dataKey !== 'cumProgress' && avgPerDay[p.dataKey] != null && (
              <span style={{
                fontSize: 9, color: p.value >= avgPerDay[p.dataKey] ? '#10b981' : '#f43f5e',
                background: p.value >= avgPerDay[p.dataKey] ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                padding: '1px 5px', borderRadius: 99,
              }}>
                {p.value >= avgPerDay[p.dataKey] ? '↑' : '↓'} avg {avgPerDay[p.dataKey]}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Indikator rata-rata per status (bar horizontal animasi)
function AvgIndicator({ label, value, color, maxVal }) {
  const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4,
                     alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 2, background: color, borderRadius: 99 }}/>
          <span style={{ fontSize: 9, color: 'var(--text4)', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color }}>
          <ANum value={value}/>
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, background: color,
          width: `${pct}%`,
          transition: 'width 0.8s cubic-bezier(.22,.68,0,1.2)',
        }}/>
      </div>
      <div style={{ fontSize: 8, color: 'var(--text4)', marginTop: 2 }}>per hari aktif</div>
    </div>
  );
}

// Label custom untuk reference line
function RefLabel({ viewBox, value, color, label }) {
  return (
    <g>
      <text
        x={viewBox.width + viewBox.x - 2}
        y={viewBox.y - 4}
        textAnchor="end"
        fill={color}
        fontSize={8}
        fontWeight={600}
      >
        avg {label}={value}
      </text>
    </g>
  );
}

export function PetugasTimeSeriesChart({ email, role = 'Pencacah', nama }) {
  const [series,    setSeries]    = useState(null);
  const [avgPerDay, setAvgPerDay] = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [mode,      setMode]      = useState('bar');
  // Pilih status mana yang ditampilkan reference line-nya
  const [showAvg, setShowAvg] = useState({
    approved: true, submitted: true, rejected: true, draft: false,
  });

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    setSeries(null);
    fetchSeries(email, role)
      .then(({ series: raw, avgPerDay: avg }) => {
        if (!raw || !raw.length) { setSeries([]); setAvgPerDay(avg || {}); setLoading(false); return; }
        // Fill gap hari tanpa aktivitas
        const map = Object.fromEntries(raw.map(r => [r.date, r]));
        const filled = [];
        let cur = new Date(raw[0].date);
        const end = new Date(raw[raw.length - 1].date);
        while (cur <= end) {
          const k = cur.toISOString().slice(0, 10);
          filled.push(map[k] || { date: k, approved: 0, submitted: 0, rejected: 0, draft: 0, open: 0 });
          cur.setDate(cur.getDate() + 1);
        }
        // Kumulatif = semua yang sudah pernah dikerjakan pencacah:
        // approved + submitted (menunggu approve) + draft (sedang diisi) + rejected (dikembalikan)
        let cum = 0;
        const withCum = filled.map(r => {
          cum += (r.approved || 0) + (r.submitted || 0) + (r.draft || 0) + (r.rejected || 0);
          return { ...r, cumProgress: cum };
        });
        setSeries(withCum);
        setAvgPerDay(avg || {});
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [email, role]);

  if (loading) return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                   gap: 8, color: 'var(--text4)', fontSize: 12 }}>
      <div style={{ width: 14, height: 14, border: '2px solid var(--orange3)',
                     borderTopColor: 'transparent', borderRadius: '50%',
                     animation: 'spin 0.7s linear infinite' }}/>
      Memuat aktivitas harian…
    </div>
  );

  if (error) return (
    <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 6,
                   color: 'var(--text4)', fontSize: 11 }}>
      <AlertCircle size={13} color="#f43f5e"/> {error}
    </div>
  );

  if (!series || series.length === 0) return (
    <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 6,
                   color: 'var(--text4)', fontSize: 11 }}>
      <AlertCircle size={13}/> Belum ada aktivitas harian tercatat
    </div>
  );

  // Max value untuk skala AvgIndicator
  const maxAvg = Math.max(
    avgPerDay.approved  || 0,
    avgPerDay.submitted || 0,
    avgPerDay.draft     || 0,
    1
  );

  const activeDays = avgPerDay.activeDays || 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                     marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={11} color="var(--orange3)" strokeWidth={2}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)',
                          textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Aktivitas harian
          </span>
          <span style={{ fontSize: 9, color: 'var(--text4)' }}>
            {series[0]?.date} → {series[series.length-1]?.date}
            {activeDays > 0 && ` · ${activeDays} hari aktif`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'var(--bg3)',
                         border: '1px solid var(--border)', borderRadius: 6, padding: 2, gap: 1 }}>
            {[['bar','Bar'],['line','Line']].map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)} style={{
                padding: '3px 10px', fontSize: 10, borderRadius: 4, border: 'none',
                cursor: 'pointer', fontFamily: 'var(--font)',
                background: mode===k ? 'var(--orange)' : 'transparent',
                color: mode===k ? '#fff' : 'var(--text3)',
                fontWeight: mode===k ? 600 : 400, transition: 'all .15s',
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Rata-rata per hari — indikator animasi */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)',
                     borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: 'var(--text4)', fontWeight: 700,
                       textTransform: 'uppercase', letterSpacing: '0.07em',
                       marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Minus size={10} strokeWidth={2.5}/> Rata-rata per hari aktif
          <span style={{ fontSize: 8, color: 'var(--text4)', fontWeight: 400,
                          background: 'var(--bg4)', padding: '1px 6px', borderRadius: 99 }}>
            Klik label untuk toggle garis referensi
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {['approved','submitted','rejected','draft'].map(key => (
            <div key={key} onClick={() => setShowAvg(prev => ({...prev, [key]: !prev[key]}))}
              style={{ cursor: 'pointer', flex: 1, minWidth: 80,
                        opacity: showAvg[key] ? 1 : 0.4, transition: 'opacity .2s' }}>
              <AvgIndicator
                label={LABEL[key]}
                value={avgPerDay[key] || 0}
                color={CLR[key]}
                maxVal={maxAvg}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={series} margin={{ top: 8, right: 48, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 9, fill: 'var(--text4)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 9, fill: 'var(--text4)' }}
            axisLine={false} tickLine={false}
            allowDecimals={false} width={28}
          />
          <YAxis
            yAxisId="right" orientation="right"
            tick={{ fontSize: 9, fill: 'rgba(232,84,28,0.6)' }}
            axisLine={false} tickLine={false}
            width={32} allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip avgPerDay={avgPerDay}/>}/>

          {/* Reference lines rata-rata — hanya tampil jika showAvg aktif */}
          {['approved','submitted','rejected','draft'].map(key =>
            showAvg[key] && (avgPerDay[key] || 0) > 0 && (
              <ReferenceLine
                key={key}
                yAxisId="left"
                y={avgPerDay[key]}
                stroke={CLR[key]}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                strokeOpacity={0.75}
                label={<RefLabel color={CLR[key]} label={LABEL[key]} value={avgPerDay[key]}/>}
              />
            )
          )}

          {/* Data bars / lines */}
          {mode === 'bar' ? (
            <>
              <Bar yAxisId="left" dataKey="approved"  name="Approved"  stackId="s"
                   fill={CLR.approved}  maxBarSize={36}/>
              <Bar yAxisId="left" dataKey="submitted" name="Submitted" stackId="s"
                   fill={CLR.submitted} maxBarSize={36}/>
              <Bar yAxisId="left" dataKey="rejected"  name="Rejected"  stackId="s"
                   fill={CLR.rejected}  maxBarSize={36}/>
              <Bar yAxisId="left" dataKey="draft"     name="Draft"     stackId="s"
                   fill={CLR.draft} radius={[2,2,0,0]} maxBarSize={36}/>
            </>
          ) : (
            <>
              <Line yAxisId="left" type="monotone" dataKey="approved"  name="Approved"
                    stroke={CLR.approved}  strokeWidth={2.5}
                    dot={{ r:3, fill:CLR.approved, strokeWidth:0 }} activeDot={{ r:5 }}/>
              <Line yAxisId="left" type="monotone" dataKey="submitted" name="Submitted"
                    stroke={CLR.submitted} strokeWidth={2}
                    dot={{ r:3, fill:CLR.submitted, strokeWidth:0 }} activeDot={{ r:5 }}
                    strokeDasharray="5 2"/>
              <Line yAxisId="left" type="monotone" dataKey="rejected"  name="Rejected"
                    stroke={CLR.rejected}  strokeWidth={2}
                    dot={{ r:3, fill:CLR.rejected, strokeWidth:0 }} activeDot={{ r:5 }}
                    strokeDasharray="2 2"/>
              <Line yAxisId="left" type="monotone" dataKey="draft"     name="Draft"
                    stroke={CLR.draft}     strokeWidth={1.5}
                    dot={false} strokeDasharray="3 3"/>
            </>
          )}

          {/* Kumulatif approved — sumbu kanan, selalu tampil */}
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="cumProgress"
            name="Kumulatif (appr+sub+draft+rej)"
            stroke="rgba(232,84,28,0.7)"
            strokeWidth={1.5}
            fill="rgba(232,84,28,0.06)"
            dot={false}
            strokeDasharray="5 3"
          />

          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 10 }}
            formatter={v => <span style={{ color: 'var(--text3)' }}>{v}</span>}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 9, color: 'var(--text4)', marginTop: 4, display: 'flex',
                     gap: 12, flexWrap: 'wrap' }}>
        <span>Sumbu kanan (area) = kumulatif dikerjakan (approved + submitted + draft + rejected)</span>
        <span>Garis putus-putus = rata-rata harian (klik label untuk toggle)</span>
        <span>Tanggal dari dateModified assignment</span>
      </div>
    </div>
  );
}