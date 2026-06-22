/**
 * backend/api_server.cjs — EWS SE2026 Backend API
 * =================================================
 * Express server untuk Railway deployment.
 * PORT otomatis dari environment Railway ($PORT).
 *
 * Endpoints:
 *   GET /api/statistik
 *   GET /api/responden
 *   GET /api/responden/:id
 *   GET /api/petugas
 *   GET /api/kecamatan
 *   GET /api/health
 */

const express   = require('express');
const cors      = require('cors');
const { MongoClient } = require('mongodb');

const URI     = process.env.MONGO_URI || 'YOUR_MONGO_URI_HERE';
const DB_NAME = process.env.DB_NAME   || 'ews_se2026';
const PORT    = process.env.PORT      || 3001;

// Izinkan CORS dari domain Railway frontend
// Tambah ALLOWED_ORIGIN di Railway Variables jika perlu
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const app    = express();
let   client = null;
let   db     = null;

app.use(cors({
  origin: (origin, cb) => {
    // Izinkan semua jika ALLOWED_ORIGINS tidak di-set (untuk dev)
    if (!ALLOWED_ORIGINS.length || !origin) return cb(null, true);
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: origin tidak diizinkan — ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// ── Koneksi MongoDB (singleton) ───────────────────────────────────────────
async function getDB() {
  if (db) return db;
  client = new MongoClient(URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[MongoDB] Terhubung ke ${DB_NAME}`);
  return db;
}

// ── Middleware: pastikan DB terhubung ─────────────────────────────────────
app.use(async (req, res, next) => {
  try {
    await getDB();
    next();
  } catch (err) {
    console.error('[MongoDB] Koneksi gagal:', err.message);
    res.status(503).json({ error: 'Database tidak dapat dijangkau', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/statistik
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/statistik', async (req, res) => {
  try {
    const doc = await db.collection('statistik_se2026')
      .findOne({ _id: 'statistik_utama' }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: 'Statistik belum digenerate. Jalankan upload_to_mongo.py dahulu.' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/responden
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/responden', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '15')));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.kecamatan) filter.kecamatan = req.query.kecamatan;
    if (req.query.desa)      filter.desa      = req.query.desa;
    if (req.query.petugas)   filter.petugas   = req.query.petugas;
    if (req.query.status)    filter.status    = req.query.status.toUpperCase();
    if (req.query.anomaly === 'anomaly') filter.anomaly = { $in: ['crit','warn'] };
    if (req.query.anomaly === 'clean')   filter.anomaly = null;
    if (req.query.kbli)      filter.kbli      = req.query.kbli;

    if (req.query.q) {
      const q = req.query.q;
      filter.$or = [
        { namaKepala: { $regex: q, $options: 'i' } },
        { namaUsaha:  { $regex: q, $options: 'i' } },
        { noKK:       { $regex: q, $options: 'i' } },
        { petugas:    { $regex: q, $options: 'i' } },
        { id:         { $regex: q, $options: 'i' } },
      ];
    }

    const coll  = db.collection('isian_se2026');
    const [total, docs] = await Promise.all([
      coll.countDocuments(filter),
      coll.find(filter, { projection: { _id: 0 } })
          .sort({ no: 1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
    ]);

    res.json({ total, page, limit, totalPages: Math.ceil(total / limit), data: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/responden/:id
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/responden/:id', async (req, res) => {
  try {
    const doc = await db.collection('isian_se2026')
      .findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: `Record ${req.params.id} tidak ditemukan` });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/petugas
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/petugas', async (req, res) => {
  try {
    const filter = {};
    if (req.query.kec) filter.kec = req.query.kec;
    const docs = await db.collection('petugas_se2026')
      .find(filter, { projection: { _id: 0 } })
      .sort({ total: -1 })
      .toArray();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/kecamatan
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/kecamatan', async (req, res) => {
  try {
    const list = await db.collection('isian_se2026').distinct('kecamatan');
    res.json(list.filter(k => k && k !== '—').sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/health
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    const total = await db.collection('isian_se2026').countDocuments();
    res.json({ status: 'ok', db: DB_NAME, totalRecords: total, ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// ── Start server ─────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[EWS SE2026 API] http://0.0.0.0:${PORT}`);
  console.log(`  DB    : ${DB_NAME}`);
  console.log(`  CORS  : ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : 'semua origin (dev mode)'}`);
});

process.on('SIGINT',  async () => { if (client) await client.close(); process.exit(0); });
process.on('SIGTERM', async () => { if (client) await client.close(); process.exit(0); });
