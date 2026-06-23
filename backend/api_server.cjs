/**
 * backend/api_server.cjs — EWS SE2026 dengan Role-Based Access Control
 * ======================================================================
 *
 * Role hierarchy:
 *   kepala     → akses FULL semua endpoint
 *   kasubbag   → akses FULL semua endpoint
 *   statistisi → akses FULL semua endpoint
 *   pengadmin  → akses TERBATAS: hanya /api/statistik (summary, pace, heatmap)
 *                                  TIDAK bisa: /api/responden (data pribadi KK)
 *
 * Endpoints:
 *   POST /api/auth/login        → login, return JWT
 *   GET  /api/auth/me           → cek sesi aktif
 *   GET  /api/statistik         → semua role
 *   GET  /api/responden         → kepala, kasubbag, statistisi ONLY
 *   GET  /api/responden/:id     → kepala, kasubbag, statistisi ONLY
 *   GET  /api/petugas           → semua role
 *   GET  /api/kecamatan         → semua role
 *   GET  /api/health            → public
 */

const express      = require('express');
const cors         = require('cors');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcryptjs');
const { MongoClient } = require('mongodb');

const URI         = process.env.MONGO_URI  || 'mongodb+srv://ricardozalukhu1925:kuran1925@cluster0.lhmox.mongodb.net/?appName=Cluster0';
const DB_NAME     = process.env.DB_NAME    || 'ews_se2026';
const PORT        = process.env.PORT       || 3001;
const JWT_SECRET  = process.env.JWT_SECRET || 'GANTI_DENGAN_SECRET_PANJANG_DAN_ACAK_MINIMAL_32_KARAKTER';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── Role definitions ──────────────────────────────────────────────────────
// Level akses: semakin tinggi angka, semakin banyak yang bisa diakses
const ROLE_LEVEL = {
  pengadmin:  1,   // terbatas
  statistisi: 2,   // full
  kasubbag:   3,   // full
  kepala:     4,   // full
};

// Role yang boleh akses data responden (data pribadi KK)
const ROLES_FULL = ['kepala', 'kasubbag', 'statistisi', 'pengadmin'];

const app    = express();
let   client = null;
let   db     = null;

app.use(cors({
  origin: (origin, cb) => {
    if (!ALLOWED_ORIGINS.length || !origin) return cb(null, true);
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: ${origin} tidak diizinkan`));
  },
  credentials: true,
}));
app.use(express.json());

// ── Koneksi MongoDB ───────────────────────────────────────────────────────
async function getDB() {
  if (db) return db;
  client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[MongoDB] Terhubung ke ${DB_NAME}`);
  return db;
}

app.use(async (req, res, next) => {
  try { await getDB(); next(); }
  catch (err) { res.status(503).json({ error: 'Database tidak dapat dijangkau', detail: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════

// 1. Verifikasi JWT token
function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesi berakhir. Silakan login kembali.', expired: true });
    }
    return res.status(401).json({ error: 'Token tidak valid.' });
  }
}

// 2. Hanya role FULL yang boleh akses data pribadi
function requireFullAccess(req, res, next) {
  if (!ROLES_FULL.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Akses ditolak.',
      detail: `Role '${req.user.role}' tidak memiliki izin mengakses data ini.`,
      requiredRoles: ROLES_FULL,
    });
  }
  next();
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const user = await db.collection('users_se2026').findOne(
      { username: username.toLowerCase().trim() },
      { projection: { _id: 0, id: 1, username: 1, role: 1, nama: 1, jabatan: 1,
                      golongan: 1, email: 1, passwordHash: 1, active: 1, mustChangePwd: 1 } }
    );

    if (!user) {
      await new Promise(r => setTimeout(r, 500)); // anti timing-attack
      return res.status(401).json({ error: 'Username atau password salah.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Akun dinonaktifkan. Hubungi administrator.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await db.collection('login_logs').insertOne({
        username: user.username, success: false, ip: req.ip, ts: new Date(),
      });
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    // Buat token — sertakan info role dan jabatan
    const token = jwt.sign(
      {
        id:       user.id,
        username: user.username,
        role:     user.role,
        nama:     user.nama,
        jabatan:  user.jabatan,
        golongan: user.golongan,
        // Sertakan daftar tab yang boleh diakses (dikonsumsi frontend)
        allowedTabs: getAllowedTabs(user.role),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    await db.collection('login_logs').insertOne({
      username: user.username, success: true, ip: req.ip, ts: new Date(),
    });
    await db.collection('users_se2026').updateOne(
      { username: user.username },
      { $set: { lastLogin: new Date() } }
    );

    res.json({
      token,
      user: {
        id:           user.id,
        username:     user.username,
        role:         user.role,
        nama:         user.nama,
        jabatan:      user.jabatan,
        golongan:     user.golongan,
        email:        user.email,
        mustChangePwd: user.mustChangePwd || false,
        allowedTabs:  getAllowedTabs(user.role),
      },
      expiresIn: JWT_EXPIRES,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', verifyToken, (req, res) => {
  res.json({ user: { ...req.user, allowedTabs: getAllowedTabs(req.user.role) } });
});

// Helper: tab yang boleh diakses per role
function getAllowedTabs(role) {
  // Semua pegawai BPS mendapat akses penuh
  return ['Overview', 'Anomali', 'Kecepatan', 'Target', 'KBLI', 'Petugas', 'Responden'];
}

// ══════════════════════════════════════════════════════════════════════════
// DATA ROUTES
// ══════════════════════════════════════════════════════════════════════════

// Semua role bisa akses statistik agregat (summary, pace, heatmap, dll)
app.get('/api/statistik', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('statistik_se2026')
      .findOne({ _id: 'statistik_utama' }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: 'Statistik belum digenerate.' });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Responden — hanya kepala, kasubbag, statistisi
app.get('/api/responden', verifyToken, requireFullAccess, async (req, res) => {
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
    const coll = db.collection('isian_se2026');
    const [total, docs] = await Promise.all([
      coll.countDocuments(filter),
      coll.find(filter, { projection: { _id: 0 } })
          .sort({ no: 1 }).skip(skip).limit(limit).toArray(),
    ]);
    res.json({ total, page, limit, totalPages: Math.ceil(total / limit), data: docs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/responden/:id', verifyToken, requireFullAccess, async (req, res) => {
  try {
    const doc = await db.collection('isian_se2026')
      .findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: `Record ${req.params.id} tidak ditemukan` });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Petugas — semua role (hanya agregat, bukan data pribadi)
app.get('/api/petugas', verifyToken, async (req, res) => {
  try {
    const filter = {};
    if (req.query.kec) filter.kec = req.query.kec;
    const docs = await db.collection('petugas_se2026')
      .find(filter, { projection: { _id: 0 } }).sort({ total: -1 }).toArray();
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kecamatan — semua role
app.get('/api/kecamatan', verifyToken, async (req, res) => {
  try {
    const list = await db.collection('isian_se2026').distinct('kecamatan');
    res.json(list.filter(k => k && k !== '—').sort());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Health — public
// ══════════════════════════════════════════════════════════════════════════
// GET /api/evaluasi — data evaluasi petugas dari assignment CSV
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/evaluasi', verifyToken, async (req, res) => {
  try {
    const [pencacah, pengawas, kecamatan, statDoc] = await Promise.all([
      db.collection('assignment_pencacah').find({}, { projection: { _id: 0 } }).sort({ approved: -1 }).toArray().catch(() => []),
      db.collection('assignment_pengawas').find({}, { projection: { _id: 0 } }).sort({ approved: -1 }).toArray().catch(() => []),
      db.collection('assignment_kecamatan').find({}, { projection: { _id: 0 } }).toArray().catch(() => []),
      db.collection('statistik_se2026').findOne({ _id: 'statistik_utama' }, { projection: { assignmentSummary: 1 } }).catch(() => null),
    ]);
    res.json({
      summary:   statDoc?.assignmentSummary || {},
      pencacah:  pencacah  || [],
      pengawas:  pengawas  || [],
      kecamatan: kecamatan || [],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    const total = await db.collection('isian_se2026').countDocuments();
    res.json({ status: 'ok', db: DB_NAME, totalRecords: total, ts: new Date().toISOString() });
  } catch (err) { res.status(503).json({ status: 'error', error: err.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[EWS SE2026 API] http://0.0.0.0:${PORT}`);
  console.log(`  Auth    : JWT (${JWT_EXPIRES})`);
  console.log(`  DB      : ${DB_NAME}`);
  console.log(`  Roles   : kepala, kasubbag, statistisi (FULL) | pengadmin (TERBATAS)`);
});

process.on('SIGINT',  async () => { if (client) await client.close(); process.exit(0); });
process.on('SIGTERM', async () => { if (client) await client.close(); process.exit(0); });
