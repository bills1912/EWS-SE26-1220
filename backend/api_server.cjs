/**
 * api_server.js — EWS SE2026 Backend API
 * =========================================
 * Express server yang menjadi jembatan antara
 * dashboard React dan MongoDB Atlas.
 *
 * Endpoints:
 *   GET /api/statistik          → semua data agregat (summary, pace, anomali, dll)
 *   GET /api/responden          → list responden (paginated, filterable)
 *   GET /api/responden/:id      → detail satu responden
 *   GET /api/petugas            → list petugas
 *   POST /api/refresh           → trigger rekomputasi statistik
 *
 * Usage:
 *   npm install express mongodb cors dotenv
 *   node api_server.js
 *   # atau: PORT=4000 node api_server.js
 */

const express = require('express');
const cors    = require('cors');
const { MongoClient } = require('mongodb');

const URI     = process.env.MONGO_URI || 'mongodb+srv://ricardozalukhu1925:kuran1925@cluster0.lhmox.mongodb.net/?appName=Cluster0';
const DB_NAME = process.env.DB_NAME   || 'ews_se2026';
const PORT    = process.env.PORT      || 3001;

const app    = express();
let   client = null;
let   db     = null;

app.use(cors());
app.use(express.json());

// ── Koneksi MongoDB (singleton) ───────────────────────────────────────────
async function getDB() {
  if (db) return db;
  client = new MongoClient(URI);
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
    res.status(503).json({ error: 'Database tidak dapat dijangkau', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/statistik
// Kembalikan 1 dokumen statistik lengkap (summary, pace, anomali, heatmap, dll)
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
// Query params:
//   page=1, limit=15
//   kecamatan=Batang Onang
//   status=SUBMITTED|APPROVED|REJECTED
//   anomaly=crit|warn    (filter yang ada anomali)
//   q=kata kunci         (search nama kepala / no KK / usaha / petugas)
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/responden', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '15')));
    const skip  = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.kecamatan) filter.kecamatan = req.query.kecamatan;
    if (req.query.desa)      filter.desa      = req.query.desa;
    if (req.query.petugas)   filter.petugas   = req.query.petugas;
    if (req.query.status)    filter.status    = req.query.status.toUpperCase();
    if (req.query.anomaly === 'anomaly') filter.anomaly = { $in: ['crit','warn'] };
    if (req.query.anomaly === 'clean')   filter.anomaly = null;
    if (req.query.kbli)      filter.kbli      = req.query.kbli;

    // Text search
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
    const total = await coll.countDocuments(filter);
    const docs  = await coll
      .find(filter, { projection: { _id: 0 } })
      .sort({ no: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: docs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/responden/:id
// Detail satu record berdasarkan field "id" (bukan MongoDB _id)
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
// List petugas dengan statistik ringkasan
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
// Daftar kecamatan unik yang ada di data
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
app.listen(PORT, () => {
  console.log(`[EWS SE2026 API] Berjalan di http://localhost:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /api/statistik`);
  console.log(`    GET  /api/responden?page=1&limit=15&kecamatan=...&status=...&q=...`);
  console.log(`    GET  /api/responden/:id`);
  console.log(`    GET  /api/petugas`);
  console.log(`    GET  /api/kecamatan`);
  console.log(`    GET  /api/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (client) await client.close();
  process.exit(0);
});
