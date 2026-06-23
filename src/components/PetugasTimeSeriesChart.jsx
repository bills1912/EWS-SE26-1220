/**
 * src/components/PetugasTimeSeriesChart.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Chart aktivitas harian per petugas — approved, submitted, rejected, draft.
 * Data dari field dailySeries yang embedded di document pencacah/pengawas.
 * Bisa dipakai di row expand EvaluasiPage.
 */
import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';

const TOKEN_KEY = 'ews_token';
const BASE = () => (window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

async function fetchSeries(email, role) {
  const res = await fetch(`${BASE()}/api/evaluasi/timeseries?email=${encodeURIComponent(email)}&role=${role}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Format tanggal singkat: "22 Jun"
function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// Tooltip custom
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border2)',
      borderRadius: 10, padding: '10px 14px', fontSize: 11,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text1)', marginBottom: 8, fontSize: 12 }}>
        <Calendar size={10} style={{ marginRight: 4 }}/>{fmtDate(label)}
      </div>
      {payload.map(p => (
        p.value > 0 && (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24,
                                        color: p.color, marginBottom: 3 }}>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{p.value}</span>
          </div>
        )
      ))}
    </div>
  );
}

export function PetugasTimeSeriesChart({ email, role = 'Pencacah', nama }) {
  const [series, setSeries]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mode, setMode]       = useState('bar'); // 'bar' | 'line' | 'area'

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    fetchSeries(email, role)
      .then(data => {
        // Isi tanggal yang tidak ada aktivitas = 0 (fill gap)
        if (!data.length) { setSeries([]); setLoading(false); return; }
        const min = data[0].date;
        const max = data[data.length - 1].date;
        const map = Object.fromEntries(data.map(d => [d.date, d]));
        const filled = [];
        let cur = new Date(min);
        const end = new Date(max);
        while (cur <= end) {
          const key = cur.toISOString().slice(0,10);
          filled.push(map[key] || { date: key, approved: 0, submitted: 0, rejected: 0, draft: 0, open: 0 });
          cur.setDate(cur.getDate() + 1);
        }
        setSeries(filled);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [email, role]);

  if (loading) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
                   color: 'var(--text4)', fontSize: 12, gap: 8 }}>
      <div style={{ width: 14, height: 14, border: '2px solid var(--orange3)',
                     borderTopColor: 'transparent', borderRadius: '50%',
                     animation: 'spin 0.7s linear infinite' }}/>
      Memuat data aktivitas…
    </div>
  );

  if (error || !series) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', gap: 8,
                   color: 'var(--text4)', fontSize: 11 }}>
      <AlertCircle size={14} color="#f43f5e"/> Gagal memuat time series
    </div>
  );

  if (series.length === 0) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', gap: 8,
                   color: 'var(--text4)', fontSize: 11 }}>
      <AlertCircle size={14}/> Belum ada aktivitas tercatat
    </div>
  );

  // Hitung cumulative approved (untuk line overlay)
  let cumApproved = 0;
  const dataWithCum = series.map(d => {
    cumApproved += (d.approved || 0);
    return { ...d, cumApproved };
  });

  // Stats ringkas
  const totalApproved  = series.reduce((a, d) => a + (d.approved  || 0), 0);
  const totalSubmitted = series.reduce((a, d) => a + (d.submitted || 0), 0);
  const totalRejected  = series.reduce((a, d) => a + (d.rejected  || 0), 0);
  const totalDraft     = series.reduce((a, d) => a + (d.draft     || 0), 0);
  const activeDays     = series.filter(d => (d.approved||0)+(d.submitted||0)+(d.rejected||0)+(d.draft||0) > 0).length;
  const avgPerDay      = activeDays > 0 ? Math.round(totalApproved / activeDays * 10) / 10 : 0;

  const COLORS = {
    approved:  '#10b981',
    submitted: '#f59e0b',
    rejected:  '#f43f5e',
    draft:     'var(--blue3)',
  };

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                     marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={11} color="var(--orange3)" strokeWidth={2}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)',
                          textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Aktivitas harian
          </span>
          <span style={{ fontSize: 9, color: 'var(--text4)' }}>
            {series[0]?.date} s/d {series[series.length-1]?.date}
          </span>
        </div>
        {/* Mode toggle */}
        <div style={{ display: 'flex', background: 'var(--bg3)', border: '1px solid var(--border)',
                       borderRadius: 6, padding: 2, gap: 1 }}>
          {[['bar','Bar'],['line','Line']].map(([k,l]) => (
            <button key={k} onClick={() => setMode(k)}
              style={{ padding: '3px 10px', fontSize: 10, borderRadius: 4, border: 'none',
                        cursor: 'pointer', fontFamily: 'var(--font)',
                        background: mode === k ? 'var(--orange)' : 'transparent',
                        color: mode === k ? '#fff' : 'var(--text3)',
                        fontWeight: mode === k ? 600 : 400, transition: 'all .15s' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary mini stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Approved', val: totalApproved,  color: '#10b981' },
          { label: 'Submitted',val: totalSubmitted, color: '#f59e0b' },
          { label: 'Rejected', val: totalRejected,  color: '#f43f5e' },
          { label: 'Draft',    val: totalDraft,      color: 'var(--blue3)' },
          { label: 'Hari Aktif',val: activeDays,    color: 'var(--text2)' },
          { label: 'Avg/Hari', val: avgPerDay,       color: 'var(--orange3)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)',
                                       borderRadius: 8, padding: '5px 10px', minWidth: 70 }}>
            <div style={{ fontSize: 8, color: 'var(--text4)', textTransform: 'uppercase',
                           letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: 'var(--mono)' }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={dataWithCum} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
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
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right" orientation="right"
            tick={{ fontSize: 9, fill: 'var(--text4)' }}
            axisLine={false} tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip/>}/>
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
            formatter={v => <span style={{ color: 'var(--text3)' }}>{v}</span>}
          />

          {mode === 'bar' ? (
            <>
              <Bar yAxisId="left" dataKey="approved"  name="Approved"  stackId="a" fill={COLORS.approved}
                   radius={[0,0,0,0]} maxBarSize={40}/>
              <Bar yAxisId="left" dataKey="submitted" name="Submitted" stackId="a" fill={COLORS.submitted}
                   maxBarSize={40}/>
              <Bar yAxisId="left" dataKey="rejected"  name="Rejected"  stackId="a" fill={COLORS.rejected}
                   maxBarSize={40}/>
              <Bar yAxisId="left" dataKey="draft"     name="Draft"     stackId="a" fill={COLORS.draft}
                   radius={[2,2,0,0]} maxBarSize={40}/>
            </>
          ) : (
            <>
              <Line yAxisId="left" type="monotone" dataKey="approved"  name="Approved"
                    stroke={COLORS.approved}  strokeWidth={2} dot={{ r:3, fill:COLORS.approved }}
                    activeDot={{ r:5 }}/>
              <Line yAxisId="left" type="monotone" dataKey="submitted" name="Submitted"
                    stroke={COLORS.submitted} strokeWidth={2} dot={{ r:3, fill:COLORS.submitted }}
                    activeDot={{ r:5 }} strokeDasharray="4 2"/>
              <Line yAxisId="left" type="monotone" dataKey="rejected"  name="Rejected"
                    stroke={COLORS.rejected}  strokeWidth={2} dot={{ r:3, fill:COLORS.rejected }}
                    activeDot={{ r:5 }} strokeDasharray="2 2"/>
              <Line yAxisId="left" type="monotone" dataKey="draft"     name="Draft"
                    stroke={COLORS.draft}     strokeWidth={1.5} dot={false}
                    strokeDasharray="3 3"/>
            </>
          )}

          {/* Cumulative approved — selalu tampil sebagai line */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumApproved"
            name="Kumulatif Approved"
            stroke="var(--orange3)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 9, color: 'var(--text4)', marginTop: 6 }}>
        Sumbu kanan (--) = kumulatif approved · Bar/Line = aktivitas per hari ·
        Tanggal = dateModified assignment
      </div>
    </div>
  );
}
