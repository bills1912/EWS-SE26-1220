import {
  ShieldAlert, Users, MapPin, BarChart2, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ScatterChart, Scatter, ZAxis, CartesianGrid,
} from 'recharts';
import { Card, SectionTitle, Badge, PulseDot } from '../components/ui.jsx';
import { ANOMALI, OUTLIER_DURASI, OUTLIER_PENDAPATAN, OUTLIER_JUMLAK_AK } from '../data/dummy.js';

/* ══════════════════════════════════════
   BOX PLOT — pure SVG, no recharts
══════════════════════════════════════ */
function BoxPlot({ data, width = '100%' }) {
  const W = 500, H = 90;
  const PAD = 60;
  const plotW = W - PAD * 2;

  // Map value → x position
  const logMin = 0;
  const logMax = data.q4;
  const toX = (v) => PAD + ((v - logMin) / (logMax - logMin)) * plotW;

  const q0x  = toX(data.q0);
  const q1x  = toX(data.q1);
  const medx = toX(data.median);
  const q3x  = toX(data.q3);
  const q4x  = toX(data.q4);
  const loFx = toX(data.fenceLo);
  const hiFx = toX(data.fenceHi);
  const meanx = toX(data.mean);

  // Y coords
  const CY = 44, BH = 28;
  const by1 = CY - BH / 2, by2 = CY + BH / 2;

  const ticks = [data.q0, data.q1, data.median, data.q3, data.fenceHi, data.q4];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', display: 'block' }}>
        {/* Grid lines */}
        {ticks.map((t, i) => (
          <line key={i} x1={toX(t)} y1={by1 - 4} x2={toX(t)} y2={by2 + 4} stroke="var(--border2)" strokeWidth={1} strokeDasharray="3,3" />
        ))}

        {/* IQR fence whiskers */}
        <line x1={loFx} y1={CY} x2={q1x} y2={CY} stroke="var(--text3)" strokeWidth={1.5} />
        <line x1={q3x}  y1={CY} x2={hiFx} y2={CY} stroke="var(--text3)" strokeWidth={1.5} />
        <line x1={loFx} y1={by1 + 6} x2={loFx} y2={by2 - 6} stroke="var(--text3)" strokeWidth={1.5} />
        <line x1={hiFx} y1={by1 + 6} x2={hiFx} y2={by2 - 6} stroke="var(--text3)" strokeWidth={1.5} />

        {/* IQR box */}
        <rect x={q1x} y={by1} width={q3x - q1x} height={BH} fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.5)" strokeWidth={1.5} rx={3} />

        {/* Median line */}
        <line x1={medx} y1={by1} x2={medx} y2={by2} stroke="#818cf8" strokeWidth={2.5} />

        {/* Mean diamond */}
        <polygon
          points={`${meanx},${CY - 6} ${meanx + 5},${CY} ${meanx},${CY + 6} ${meanx - 5},${CY}`}
          fill="#f59e0b" opacity={0.9}
        />

        {/* Outlier dots */}
        {data.outliers.map((v, i) => (
          <circle key={i} cx={toX(v)} cy={CY} r={5} fill="rgba(244,63,94,0.8)" stroke="rgba(244,63,94,0.3)" strokeWidth={2} />
        ))}

        {/* Anomaly threshold lines */}
        {data.anomalyThresholdLo !== undefined && data.anomalyThresholdLo > 0 && (
          <line x1={toX(data.anomalyThresholdLo)} y1={by1 - 8} x2={toX(data.anomalyThresholdLo)} y2={by2 + 8} stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="4,3" />
        )}
        {data.anomalyThresholdHi && (
          <line x1={toX(data.anomalyThresholdHi)} y1={by1 - 8} x2={toX(data.anomalyThresholdHi)} y2={by2 + 8} stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="4,3" />
        )}

        {/* Labels below */}
        {[
          { x: q1x,   lbl: `Q1\n${data.q1}` },
          { x: medx,  lbl: `Med\n${data.median}` },
          { x: q3x,   lbl: `Q3\n${data.q3}` },
          { x: hiFx,  lbl: `Fence\n${data.fenceHi}` },
        ].map(({ x, lbl }, i) => {
          const [l1, l2] = lbl.split('\n');
          return (
            <g key={i}>
              <text x={x} y={by2 + 14} textAnchor="middle" fontSize={7} fill="var(--text4)">{l1}</text>
              <text x={x} y={by2 + 22} textAnchor="middle" fontSize={7.5} fill="var(--text3)" fontFamily="var(--mono)">{l2}</text>
            </g>
          );
        })}

        {/* Outlier label */}
        {data.outliers.length > 0 && (
          <text x={toX(data.outliers[data.outliers.length - 1])} y={by1 - 10} textAnchor="middle" fontSize={8} fill="#f87171">
            outlier ({data.q4} max)
          </text>
        )}

        {/* Mean label */}
        <text x={meanx} y={by1 - 10} textAnchor="middle" fontSize={7.5} fill="#f59e0b">mean {data.mean}</text>

        {/* Threshold label */}
        {data.anomalyThresholdLo !== undefined && data.anomalyThresholdLo > 0 && (
          <text x={toX(data.anomalyThresholdLo)} y={H - 4} textAnchor="middle" fontSize={7} fill="#f43f5e">min {data.anomalyThresholdLo}</text>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        {[
          { color: 'rgba(99,102,241,0.6)', label: 'IQR (Q1–Q3)', type: 'rect' },
          { color: '#818cf8',              label: 'Median',        type: 'line' },
          { color: '#f59e0b',              label: 'Mean',          type: 'diamond' },
          { color: '#f43f5e',              label: 'Outlier',       type: 'circle' },
          { color: '#f43f5e',              label: 'Batas anomali', type: 'dash' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text3)' }}>
            {l.type === 'rect' && <span style={{ width: 14, height: 8, background: l.color, border: '1px solid rgba(99,102,241,0.5)', borderRadius: 2, display: 'inline-block' }} />}
            {l.type === 'line' && <span style={{ width: 14, height: 2, background: l.color, display: 'inline-block' }} />}
            {l.type === 'diamond' && <span style={{ width: 8, height: 8, background: l.color, display: 'inline-block', transform: 'rotate(45deg)' }} />}
            {l.type === 'circle' && <span style={{ width: 8, height: 8, background: l.color, borderRadius: '50%', display: 'inline-block' }} />}
            {l.type === 'dash' && <span style={{ width: 14, height: 2, background: 'transparent', borderTop: `2px dashed ${l.color}`, display: 'inline-block' }} />}
            {l.label}
          </div>
        ))}
      </div>
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
