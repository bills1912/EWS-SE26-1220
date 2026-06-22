import { useState } from 'react';
import {
  ShieldAlert, Users, MapPin, BarChart2, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ScatterChart, Scatter, ZAxis, CartesianGrid,
} from 'recharts';
import { Card, SectionTitle, Badge, PulseDot } from '../components/ui.jsx';
import { ANOMALI, OUTLIER_DURASI, OUTLIER_PENDAPATAN, OUTLIER_JUMLAK_AK } from '../data/dummy.js';

function OutlierModal({ outlier, metricLabel, unit, onClose }) {
  if (!outlier) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Badge variant="crit"><AlertTriangle size={9} strokeWidth={2} /> Outlier terdeteksi</Badge>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>{outlier.id}</span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 }}>{outlier.nama}</h3>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{metricLabel}</div>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <div style={{
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Nilai outlier</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#f87171', fontFamily: 'var(--mono)' }}>
              {outlier.value} <span style={{ fontSize: 13, color: 'var(--text3)' }}>{unit}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>Kecamatan</div>
              <div style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 600 }}>{outlier.kec}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>Desa</div>
              <div style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 600 }}>{outlier.desa}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>PCL</div>
              <div style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 600 }}>{outlier.pcl}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>Status</div>
              <Badge variant={outlier.status === 'APPROVED' ? 'ok' : 'neutral'}>{outlier.status}</Badge>
            </div>
            {outlier.usaha && (
              <div style={{ gridColumn: '1/-1', background: 'var(--bg3)', borderRadius: 8, padding: '9px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>Nama Usaha</div>
                <div style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 600 }}>{outlier.usaha}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 22px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   BOX PLOT — pure SVG, no recharts
══════════════════════════════════════ */
function BoxPlot({ data, width = '100%' }) {
  const [tooltip, setTooltip] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [selectedOutlier, setSelectedOutlier] = useState(null);

  const W = 760, H = 150;
  const PAD = 70;
  const plotW = W - PAD * 2;

  const logMin = 0;
  const logMax = data.q4;
  const toX = (v) => PAD + ((v - logMin) / (logMax - logMin)) * plotW;

  const q1x  = toX(data.q1);
  const medx = toX(data.median);
  const q3x  = toX(data.q3);
  const loFx = toX(data.fenceLo);
  const hiFx = toX(data.fenceHi);
  const meanx = toX(data.mean);

  const CY = 66, BH = 40;
  const by1 = CY - BH / 2, by2 = CY + BH / 2;
  const ticks = [data.q0, data.q1, data.median, data.q3, data.fenceHi, data.q4];

  const showTip = (e, label, value) => {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, label, value });
  };
  const hideTip = () => { setTooltip(null); setHovered(null); };

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 1000, height: 'auto', display: 'block', overflow: 'visible' }}>
        {ticks.map((t, i) => (
          <line key={i} x1={toX(t)} y1={by1 - 6} x2={toX(t)} y2={by2 + 6} stroke="var(--border2)" strokeWidth={1} strokeDasharray="3,3" />
        ))}

        <line x1={loFx} y1={CY} x2={q1x} y2={CY} stroke="var(--text3)" strokeWidth={2} />
        <line x1={q3x}  y1={CY} x2={hiFx} y2={CY} stroke="var(--text3)" strokeWidth={2} />

        <line x1={loFx} y1={by1 + 8} x2={loFx} y2={by2 - 8}
          stroke="var(--text3)" strokeWidth={hovered === 'fenceLo' ? 4 : 2} style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => { setHovered('fenceLo'); showTip(e, 'Batas bawah (fence)', data.fenceLo); }}
          onMouseMove={(e) => showTip(e, 'Batas bawah (fence)', data.fenceLo)}
          onMouseLeave={hideTip} />
        <line x1={hiFx} y1={by1 + 8} x2={hiFx} y2={by2 - 8}
          stroke="var(--text3)" strokeWidth={hovered === 'fenceHi' ? 4 : 2} style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => { setHovered('fenceHi'); showTip(e, 'Batas atas (fence)', data.fenceHi); }}
          onMouseMove={(e) => showTip(e, 'Batas atas (fence)', data.fenceHi)}
          onMouseLeave={hideTip} />

        <rect x={q1x} y={by1} width={q3x - q1x} height={BH} rx={5}
          fill={hovered === 'iqr' ? 'rgba(99,102,241,0.32)' : 'rgba(99,102,241,0.18)'}
          stroke="rgba(99,102,241,0.5)" strokeWidth={2} style={{ cursor: 'pointer', transition: 'fill .15s' }}
          onMouseEnter={(e) => { setHovered('iqr'); showTip(e, 'IQR (Q1–Q3)', `${data.q1} – ${data.q3}`); }}
          onMouseMove={(e) => showTip(e, 'IQR (Q1–Q3)', `${data.q1} – ${data.q3}`)}
          onMouseLeave={hideTip} />

        <line x1={medx} y1={by1} x2={medx} y2={by2}
          stroke="#818cf8" strokeWidth={hovered === 'median' ? 6 : 3.5} style={{ cursor: 'pointer', transition: 'stroke-width .15s' }}
          onMouseEnter={(e) => { setHovered('median'); showTip(e, 'Median', data.median); }}
          onMouseMove={(e) => showTip(e, 'Median', data.median)}
          onMouseLeave={hideTip} />

        <polygon
          points={`${meanx},${CY - 9} ${meanx + 7},${CY} ${meanx},${CY + 9} ${meanx - 7},${CY}`}
          fill="#f59e0b" opacity={hovered === 'mean' ? 1 : 0.9}
          stroke={hovered === 'mean' ? '#fff' : 'none'} strokeWidth={1.5} style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => { setHovered('mean'); showTip(e, 'Mean', data.mean); }}
          onMouseMove={(e) => showTip(e, 'Mean', data.mean)}
          onMouseLeave={hideTip} />

        {data.outliers.map((o, i) => (
          <circle key={i} cx={toX(o.value)} cy={CY} r={hovered === `out${i}` ? 9.5 : 7}
            fill="rgba(244,63,94,0.8)" stroke="rgba(244,63,94,0.3)" strokeWidth={2.5}
            style={{ cursor: 'pointer', transition: 'r .15s' }}
            onMouseEnter={(e) => { setHovered(`out${i}`); showTip(e, o.nama, o.value); }}
            onMouseMove={(e) => showTip(e, o.nama, o.value)}
            onMouseLeave={hideTip}
            onClick={() => setSelectedOutlier(o)} />
        ))}

        {data.anomalyThresholdLo !== undefined && data.anomalyThresholdLo > 0 && (
          <line x1={toX(data.anomalyThresholdLo)} y1={by1 - 12} x2={toX(data.anomalyThresholdLo)} y2={by2 + 12} stroke="#f43f5e" strokeWidth={2} strokeDasharray="5,4" />
        )}
        {data.anomalyThresholdHi && (
          <line x1={toX(data.anomalyThresholdHi)} y1={by1 - 12} x2={toX(data.anomalyThresholdHi)} y2={by2 + 12} stroke="#f43f5e" strokeWidth={2} strokeDasharray="5,4" />
        )}

        {[
          { x: q1x,  lbl: `Q1\n${data.q1}` },
          { x: medx, lbl: `Med\n${data.median}` },
          { x: q3x,  lbl: `Q3\n${data.q3}` },
          { x: hiFx, lbl: `Fence\n${data.fenceHi}` },
        ].map(({ x, lbl }, i) => {
          const [l1, l2] = lbl.split('\n');
          return (
            <g key={i}>
              <text x={x} y={by2 + 20} textAnchor="middle" fontSize={9.5} fill="var(--text4)">{l1}</text>
              <text x={x} y={by2 + 32} textAnchor="middle" fontSize={11} fill="var(--text3)" fontFamily="var(--mono)">{l2}</text>
            </g>
          );
        })}

        {data.outliers.length > 0 && (
          <text x={toX(data.outliers[data.outliers.length - 1].value)} y={by1 - 16} textAnchor="middle" fontSize={10.5} fill="#f87171">
            outlier ({data.q4} max)
          </text>
        )}

        <text x={meanx} y={by1 - 16} textAnchor="middle" fontSize={10} fill="#f59e0b">mean {data.mean}</text>

        {data.anomalyThresholdLo !== undefined && data.anomalyThresholdLo > 0 && (
          <text x={toX(data.anomalyThresholdLo)} y={H - 6} textAnchor="middle" fontSize={9.5} fill="#f43f5e">min {data.anomalyThresholdLo}</text>
        )}
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y - 40, transform: 'translateX(-50%)',
          background: 'var(--bg5)', border: '1px solid var(--border2)', borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: 'var(--text1)', whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 10, boxShadow: 'var(--shadow)',
        }}>
          <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 2 }}>{tooltip.label}</div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{tooltip.value} {data.unit}</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
        {[
          { color: 'rgba(99,102,241,0.6)', label: 'IQR (Q1–Q3)', type: 'rect' },
          { color: '#818cf8',              label: 'Median',        type: 'line' },
          { color: '#f59e0b',              label: 'Mean',          type: 'diamond' },
          { color: '#f43f5e',              label: 'Outlier',       type: 'circle' },
          { color: '#f43f5e',              label: 'Batas anomali', type: 'dash' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
            {l.type === 'rect' && <span style={{ width: 16, height: 9, background: l.color, border: '1px solid rgba(99,102,241,0.5)', borderRadius: 2, display: 'inline-block' }} />}
            {l.type === 'line' && <span style={{ width: 16, height: 2.5, background: l.color, display: 'inline-block' }} />}
            {l.type === 'diamond' && <span style={{ width: 10, height: 10, background: l.color, display: 'inline-block', transform: 'rotate(45deg)' }} />}
            {l.type === 'circle' && <span style={{ width: 10, height: 10, background: l.color, borderRadius: '50%', display: 'inline-block' }} />}
            {l.type === 'dash' && <span style={{ width: 16, height: 2, background: 'transparent', borderTop: `2px dashed ${l.color}`, display: 'inline-block' }} />}
            {l.label}
          </div>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text4)', marginLeft: 'auto' }}>💡 Klik titik merah untuk lihat detail responden</span>
      </div>

      <OutlierModal outlier={selectedOutlier} metricLabel={data.label} unit={data.unit} onClose={() => setSelectedOutlier(null)} />
    </div>
  );
}

/* ══════════════════════════════════════
   DISTRIBUTION BAR CHART
══════════════════════════════════════ */
function DistChart({ data }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
        <div style={{ color: 'var(--indigo3)', fontWeight: 600, fontFamily: 'var(--mono)' }}>{payload[0].value} records</div>
        {payload[0].payload.anomaly && <div style={{ color: '#f87171', fontSize: 10, marginTop: 2 }}>⚠ Range anomali</div>}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="n" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.anomaly ? 'rgba(244,63,94,0.7)' : 'rgba(99,102,241,0.55)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ══════════════════════════════════════
   STATS ROW
══════════════════════════════════════ */
function StatRow({ data }) {
  const stats = [
    { label: 'Min',    val: data.q0 },
    { label: 'Q1',     val: data.q1 },
    { label: 'Median', val: data.median },
    { label: 'Mean',   val: data.mean },
    { label: 'Q3',     val: data.q3 },
    { label: 'Max',    val: data.q4 },
    { label: 'IQR',    val: data.iqr },
    { label: 'Fence ↑',val: data.fenceHi },
    { label: 'Outlier',val: data.outliers.length, danger: true },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: 'var(--bg3)', border: `1px solid ${s.danger ? 'rgba(244,63,94,0.25)' : 'var(--border)'}`, borderRadius: 8, padding: '6px 12px', minWidth: 60 }}>
          <div style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: s.danger ? '#f87171' : 'var(--text1)' }}>{s.val}</div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════
   ANOMALY CARD
══════════════════════════════════════ */
function AnomalyCard({ item }) {
  const c = item.sev === 'crit'
    ? { dot: '#f43f5e', bg: 'rgba(244,63,94,0.05)', border: 'rgba(244,63,94,0.16)' }
    : item.sev === 'warn'
    ? { dot: '#f59e0b', bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.16)' }
    : { dot: '#818cf8', bg: 'rgba(99,102,241,0.05)', border: 'rgba(99,102,241,0.16)' };
  const sevMap = { crit: 'crit', warn: 'warn', info: 'info' };

  return (
    <div style={{ display: 'flex', gap: 14, padding: '13px 15px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 11 }}>
      <div style={{ paddingTop: 2 }}><PulseDot color={c.dot} size={8} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 5 }}>
          <Badge variant="neutral" style={{ fontSize: 9 }}>{item.category}</Badge>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{item.title}</span>
          <Badge variant={sevMap[item.sev]}>
            {item.sev === 'crit' ? 'Kritis' : item.sev === 'warn' ? 'Perlu cek' : 'Info'}
          </Badge>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text4)' }}>{item.ts}</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 9 }}>{item.detail}</p>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
            <Users size={10} strokeWidth={2} />{item.petugas}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
            <MapPin size={10} strokeWidth={2} />{item.kec}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════ */
export function AnomalyPage() {
  const crit = ANOMALI.filter(a => a.sev === 'crit');
  const warn = ANOMALI.filter(a => a.sev === 'warn');
  const info = ANOMALI.filter(a => a.sev === 'info');

  const outlierSets = [
    { data: OUTLIER_DURASI,     title: 'Distribusi durasi pengisian kuesioner' },
    { data: OUTLIER_PENDAPATAN, title: 'Distribusi pendapatan usaha (juta Rp/bln)' },
    { data: OUTLIER_JUMLAK_AK,  title: 'Distribusi jumlah anggota keluarga (orang)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Outlier analytics section ── */}
      <Card>
        <SectionTitle icon={BarChart2} right={<Badge variant="warn">Analisis distribusi & outlier</Badge>}>
          Diagram analisis statistik anomali
        </SectionTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {outlierSets.map(({ data, title }) => (
            <div key={data.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={12} color="#f59e0b" strokeWidth={2} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text1)' }}>{title}</span>
                <Badge variant="crit" style={{ marginLeft: 'auto' }}>{data.outliers.length} outlier</Badge>
              </div>

              {/* Stats row */}
              <StatRow data={data} />

              {/* Box plot */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>Box plot</div>
                <BoxPlot data={data} />
              </div>

              {/* Distribution bar */}
              <div>
                <div style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>
                  Distribusi frekuensi <span style={{ color: '#f87171' }}>(merah = zona anomali)</span>
                </div>
                <DistChart data={data.dist} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Alert cards ── */}
      {crit.length > 0 && (
        <Card accent="crit">
          <SectionTitle icon={ShieldAlert} right={<Badge variant="crit">{crit.length} kritis</Badge>}>Peringatan kritis — tindak segera</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {crit.map(a => <AnomalyCard key={a.id} item={a} />)}
          </div>
        </Card>
      )}
      {warn.length > 0 && (
        <Card accent="warn">
          <SectionTitle icon={ShieldAlert} right={<Badge variant="warn">{warn.length} perlu cek</Badge>}>Perlu perhatian</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {warn.map(a => <AnomalyCard key={a.id} item={a} />)}
          </div>
        </Card>
      )}
      {info.length > 0 && (
        <Card>
          <SectionTitle icon={ShieldAlert} right={<Badge variant="info">{info.length} informasi</Badge>}>Informasi & notifikasi</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {info.map(a => <AnomalyCard key={a.id} item={a} />)}
          </div>
        </Card>
      )}
    </div>
  );
}
