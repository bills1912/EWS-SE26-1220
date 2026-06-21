import {
  ShieldAlert, Users, MapPin, Zap, Tag,
  BarChart2, FileWarning, Target as TargetIcon,
  TrendingUp, TrendingDown, Minus, Building2,
  CheckCircle, XCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, SectionTitle, ProgressBar, Badge, PulseDot, statusColor, statusLabel, statusVariant } from '../components/ui.jsx';
import { ANOMALI, PACE, KBLI_DATA, PETUGAS, KATEGORI_USAHA, SUMMARY, HEATMAP } from '../data/dummy.js';

/* ───── ANOMALI PAGE ───── */
function AnomalyCard({ item }) {
  const c = item.sev === 'crit'
    ? { dot: '#f43f5e', bg: 'rgba(244,63,94,0.05)', border: 'rgba(244,63,94,0.16)' }
    : item.sev === 'warn'
    ? { dot: '#f59e0b', bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.16)' }
    : { dot: '#818cf8', bg: 'rgba(99,102,241,0.05)', border: 'rgba(99,102,241,0.16)' };

  const sevMap = { crit: 'crit', warn: 'warn', info: 'info' };

  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 16px',
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
        <PulseDot color={c.dot} size={8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 6 }}>
          <Badge variant="neutral" style={{ fontSize: 9 }}>{item.category}</Badge>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{item.title}</span>
          <Badge variant={sevMap[item.sev]}>
            {item.sev === 'crit' ? 'Kritis' : item.sev === 'warn' ? 'Perlu cek' : 'Info'}
          </Badge>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text4)' }}>{item.ts}</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 10 }}>{item.detail}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
            <Users size={10} strokeWidth={2} /> {item.petugas}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
            <MapPin size={10} strokeWidth={2} /> {item.kec}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AnomalyPage() {
  const crit = ANOMALI.filter(a => a.sev === 'crit');
  const warn = ANOMALI.filter(a => a.sev === 'warn');
  const info = ANOMALI.filter(a => a.sev === 'info');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

/* ───── KECEPATAN PAGE ───── */
function HeatmapSmall({ data }) {
  const max = Math.max(...data.rows.flatMap(r => r.vals));
  const cell = (v) => {
    if (!v) return { bg: 'var(--bg4)', color: 'var(--text4)' };
    const p = v / max;
    if (p < 0.25) return { bg: 'rgba(99,102,241,0.15)', color: 'var(--text3)' };
    if (p < 0.5)  return { bg: 'rgba(99,102,241,0.32)', color: 'var(--text2)' };
    if (p < 0.75) return { bg: 'rgba(99,102,241,0.55)', color: 'var(--text1)' };
    return { bg: '#5a5cf8', color: '#fff' };
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ fontSize: 9, color: 'var(--text4)', textAlign: 'left', width: 140, paddingBottom: 6, fontWeight: 500 }} />
            {data.days.map(d => <th key={d} style={{ fontSize: 9, color: 'var(--text4)', textAlign: 'center', fontWeight: 500, paddingBottom: 6 }}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => (
            <tr key={row.kec}>
              <td style={{ fontSize: 10, color: 'var(--text2)', paddingRight: 8, paddingBottom: 3, whiteSpace: 'nowrap', fontWeight: 500 }}>{row.kec}</td>
              {row.vals.map((v, i) => {
                const s = cell(v);
                return (
                  <td key={i} style={{ padding: '2px' }}>
                    <div style={{ background: s.bg, color: s.color, borderRadius: 5, padding: '5px 3px', fontSize: 9, fontWeight: 600, fontFamily: 'var(--mono)', textAlign: 'center', minWidth: 26 }}>
                      {v || '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KecepatanPage() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card>
        <SectionTitle icon={Zap}>Realisasi vs target per kecamatan</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PACE.map((p, i) => {
            const TIcon = p.trend === 'up' ? TrendingUp : p.trend === 'down' ? TrendingDown : Minus;
            const tColor = p.trend === 'up' ? '#10b981' : p.trend === 'down' ? '#f43f5e' : '#5a6285';
            return (
              <div key={p.kec}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TIcon size={11} color={tColor} strokeWidth={2} />
                    {p.kec}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    <span style={{ fontWeight: 700, color: statusColor(p.status) }}>{p.n}</span>
                    <span style={{ color: 'var(--text4)' }}> / {p.target}</span>
                  </span>
                </div>
                <ProgressBar pct={p.pct} color={statusColor(p.status)} delay={i * 55} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={BarChart2}>Heatmap pendataan harian</SectionTitle>
        <HeatmapSmall data={HEATMAP} />
      </Card>
    </div>
  );
}

/* ───── TARGET PAGE ───── */
export function TargetPage() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {PACE.map((p, i) => (
          <Card key={p.kec} style={{ animationDelay: `${i * 40}ms` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', marginBottom: 2 }}>{p.kec}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Target: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{p.target}</span> records</div>
              </div>
              <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
              <span style={{
                fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em',
                color: statusColor(p.status), fontFamily: 'var(--mono)',
              }}>{p.pct}%</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>tercapai</span>
            </div>
            <ProgressBar pct={p.pct} color={statusColor(p.status)} height={6} delay={i * 55} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                Realisasi: <span style={{ color: 'var(--text2)', fontWeight: 600, fontFamily: 'var(--mono)' }}>{p.n}</span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                Gap: <span style={{ color: statusColor(p.status), fontWeight: 600, fontFamily: 'var(--mono)' }}>{p.target - p.n}</span>
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───── KBLI PAGE ───── */
const CAT_COLOR = { A: '#10b981', G: '#6366f1', I: '#f59e0b', C: '#a78bfa', N: '#14b8a6' };

export function KBLIPage() {
  const maxN = Math.max(...KBLI_DATA.map(k => k.n));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
      <Card>
        <SectionTitle icon={Tag} right={<Badge variant="info">{KBLI_DATA.reduce((a, b) => a + b.n, 0)} terklasifikasi</Badge>}>
          Distribusi KBLI terisi
        </SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {KBLI_DATA.map((k, i) => (
            <div key={k.kode} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10,
            }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                color: CAT_COLOR[k.cat] || 'var(--indigo3)', width: 44, flexShrink: 0,
              }}>{k.kode}</span>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text2)' }}>{k.label}</span>
              <Badge variant="neutral">{k.cat}</Badge>
              <div style={{ width: 72, flexShrink: 0 }}>
                <ProgressBar pct={(k.n / maxN) * 100} color={CAT_COLOR[k.cat] || 'var(--indigo)'} delay={i * 60} />
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text1)',
                fontFamily: 'var(--mono)', width: 30, textAlign: 'right', flexShrink: 0,
              }}>{k.n}</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card accent="crit">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <FileWarning size={16} color="#f43f5e" strokeWidth={1.8} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#f87171' }}>{SUMMARY.kbliMissing} usaha tanpa KBLI</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
            Usaha dengan nama terisi namun kolom <span style={{ fontFamily: 'var(--mono)', color: 'var(--indigo3)' }}>kbli_akhir</span> kosong.
            Tidak bisa diklasifikasi untuk agregasi nasional SE2026. Prioritas utama untuk di-review dan dilengkapi.
          </p>
        </Card>

        <Card>
          <SectionTitle icon={Building2}>Kategori usaha (berdasar KBLI)</SectionTitle>
          {KATEGORI_USAHA.map((c, i) => (
            <div key={c.cat} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                  {c.cat}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text1)', fontFamily: 'var(--mono)' }}>{c.n}</span>
              </div>
              <ProgressBar pct={(c.n / 378) * 100} color={c.color} delay={i * 80} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ───── PETUGAS PAGE ───── */
const FLAG_CFG = {
  crit: { label: '⚠ Anomali', variant: 'crit' },
  warn: { label: 'Perlu cek', variant: 'warn' },
  ok:   { label: 'Normal', variant: 'ok' },
};

export function PetugasPage() {
  const sorted = [...PETUGAS].sort((a, b) => {
    const order = { crit: 0, warn: 1, ok: 2 };
    return order[a.flag] - order[b.flag];
  });
  return (
    <Card>
      <SectionTitle icon={Users} right={<span style={{ fontSize: 10, color: 'var(--text3)' }}>{PETUGAS.length} petugas aktif</span>}>
        Monitor petugas lapangan
      </SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Petugas', 'Kecamatan', 'Total', 'Approved', 'Rejected', 'Avg Durasi', 'Approval %', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left',
                  fontSize: 9, fontWeight: 700, color: 'var(--text4)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const approvalPct = p.approved > 0 ? Math.round((p.approved / p.total) * 100) : 0;
              const durColor = p.dur < 5 ? '#f43f5e' : p.dur > 500 ? '#f59e0b' : 'var(--text2)';
              const cfg = FLAG_CFG[p.flag];
              return (
                <tr key={p.nama} style={{
                  borderBottom: '1px solid var(--border)',
                  background: p.flag === 'crit' ? 'rgba(244,63,94,0.03)' : 'transparent',
                  transition: 'background .12s',
                }}>
                  <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--text1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.nama}</td>
                  <td style={{ padding: '11px 12px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{p.kec}</td>
                  <td style={{ padding: '11px 12px', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text2)', fontWeight: 500 }}>{p.total}</td>
                  <td style={{ padding: '11px 12px', fontSize: 12, fontFamily: 'var(--mono)', color: p.approved > 0 ? '#34d399' : 'var(--text4)', fontWeight: p.approved > 0 ? 600 : 400 }}>{p.approved}</td>
                  <td style={{ padding: '11px 12px', fontSize: 12, fontFamily: 'var(--mono)', color: p.rejected > 0 ? '#f87171' : 'var(--text4)' }}>{p.rejected}</td>
                  <td style={{ padding: '11px 12px', fontSize: 12, fontFamily: 'var(--mono)', color: durColor, fontWeight: 600 }}>{p.dur}m</td>
                  <td style={{ padding: '11px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 50 }}>
                        <ProgressBar pct={approvalPct} color={approvalPct > 50 ? '#10b981' : approvalPct > 20 ? '#f59e0b' : '#f43f5e'} height={4} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{approvalPct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
