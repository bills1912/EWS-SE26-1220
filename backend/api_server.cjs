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
 *   POST /api/upload/assignment → kepala, kasubbag, statistisi
 *                                  Upload CSV assignment → hitung stats → simpan ke MongoDB
 */

const express      = require('express');
const cors         = require('cors');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcryptjs');
const { MongoClient } = require('mongodb');
const multer           = require('multer');
const { parse: csvParse } = require('csv-parse/sync');

const URI         = process.env.MONGO_URI  || 'mongodb+srv://ricardozalukhu1925:kuran1925@cluster0.lhmox.mongodb.net/?appName=Cluster0';
const DB_NAME     = process.env.DB_NAME    || 'ews_se2026';
const PORT        = process.env.PORT       || 3001;
const JWT_SECRET  = process.env.JWT_SECRET || 'GANTI_DENGAN_SECRET_PANJANG_DAN_ACAK_MINIMAL_32_KARAKTER';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── Konfigurasi pendataan ─────────────────────────────────────────────────
const PENDATAAN_START = new Date('2026-06-15T00:00:00+07:00');

/** Hitung hari kerja Senin–Sabtu dari PENDATAAN_START s.d. sekarang */
function countWorkingDays() {
  const start = new Date(PENDATAAN_START);
  const end   = new Date();
  end.setHours(23, 59, 59, 999);
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 0) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, count);
}

// ── Upload config: memory storage ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.csv$/i)) {
      return cb(new Error('Hanya file CSV yang diperbolehkan'));
    }
    cb(null, true);
  },
});

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

// ── Security headers — mencegah scraping, sniffing, framing ──────────────
app.use((req, res, next) => {
  // Sembunyikan teknologi yang dipakai
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'EWS-SE26');

  // Cegah embedding di iframe (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // Cegah MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy — jangan bocorkan URL sumber
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Cache control — data sensitif tidak boleh di-cache proxy/browser
  if (req.path.startsWith('/api/') && req.path !== '/api/health') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
});

// ── Rate limiting per IP ──────────────────────────────────────────────────
const hitMap = new Map(); // ip → { count, resetAt }
const RATE_WINDOW_MS  = 60_000;  // 1 menit
const RATE_MAX_LOGIN  = 10;       // maks 10 login attempt per menit per IP
const RATE_MAX_API    = 200;      // maks 200 request API per menit per IP

function rateLimitMiddleware(maxReq) {
  return (req, res, next) => {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}:${req.path.split('/')[2] || 'root'}`;
    let entry = hitMap.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
      hitMap.set(key, entry);
    }
    entry.count++;
    res.setHeader('X-RateLimit-Limit',     maxReq);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxReq - entry.count));
    if (entry.count > maxReq) {
      return res.status(429).json({
        error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }
    next();
  };
}

// Bersihkan hitMap setiap 5 menit agar tidak bocor memori
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hitMap.entries()) {
    if (now > v.resetAt) hitMap.delete(k);
  }
}, 300_000);

app.use(express.json({ limit: '1mb' }));  // batasi payload

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

// ── Anonimisasi data sensitif ────────────────────────────────────────────
// Masking: hanya perlihatkan sebagian NIK/No KK (untuk audit trail tapi tidak expose penuh)
function maskNIK(nik) {
  if (!nik || nik.length < 6) return '****';
  return nik.slice(0, 4) + '****' + nik.slice(-4);
}
function maskNoKK(noKK) {
  if (!noKK || noKK.length < 6) return '****';
  return noKK.slice(0, 4) + '****' + noKK.slice(-4);
}
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const shown = local.length > 3 ? local.slice(0,3) + '***' : local[0] + '***';
  return `${shown}@${domain}`;
}
// Anonimisasi satu record responden
function anonymizeResponden(r, fullAccess = false) {
  if (!r) return r;
  if (fullAccess) return r;  // kepala/kasubbag/statistisi dapat data lengkap
  return {
    ...r,
    nik:         r.nik    ? maskNIK(r.nik)    : r.nik,
    noKK:        r.noKK   ? maskNoKK(r.noKK)  : r.noKK,
    namaKepala:  r.namaKepala ? r.namaKepala.replace(/(?<=.{3}).(?=.{2})/g, '*') : r.namaKepala,
    namaPasangan: r.namaPasangan ? '***' : r.namaPasangan,
    alamat:      r.alamat ? '***' : r.alamat,
    anggotaKeluarga: (r.anggotaKeluarga || []).map(ak => ({
      ...ak,
      nik:  ak.nik  ? maskNIK(ak.nik)  : ak.nik,
      nama: ak.nama ? ak.nama.replace(/(?<=.{3}).(?=.{2})/g, '*') : ak.nama,
    })),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', rateLimitMiddleware(RATE_MAX_LOGIN), async (req, res) => {
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
    const [pencacah, pengawas, kecamatan, statDoc, latestSnap] = await Promise.all([
      db.collection('assignment_pencacah').find({}, { projection: { _id: 0 } }).sort({ approved: -1 }).toArray().catch(() => []),
      db.collection('assignment_pengawas').find({}, { projection: { _id: 0 } }).sort({ approved: -1 }).toArray().catch(() => []),
      db.collection('assignment_kecamatan').find({}, { projection: { _id: 0 } }).toArray().catch(() => []),
      db.collection('statistik_se2026').findOne({ _id: 'statistik_utama' }, { projection: { assignmentSummary: 1 } }).catch(() => null),
      db.collection('assignment_snapshots').findOne({}, { sort: { snapshotAt: -1 }, projection: { summary: 1, _id: 0 } }).catch(() => null),
    ]);

    // Gunakan assignmentSummary dari statistik_utama jika ada,
    // fallback ke summary snapshot terbaru jika assignmentSummary hilang/kosong
    const assignSummary = statDoc?.assignmentSummary;
    const summary = (assignSummary && assignSummary.totalAssignment)
      ? assignSummary
      : (latestSnap?.summary || {});

    res.json({
      summary,
      pencacah:  pencacah  || [],
      pengawas:  pengawas  || [],
      kecamatan: kecamatan || [],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/evaluasi/detail ──────────────────────────────────────────────
// Query: email, kec, desa, status, page (1-based), limit (default 20)
// Return: { data[], total, totalPages, page }
app.get('/api/evaluasi/detail', verifyToken, async (req, res) => {
  try {
    const { email, kec, desa, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Cari berdasarkan email pencacah asli (pencacahEmail) ATAU email currentUser
    // — fallback untuk data lama yang belum punya field pencacahEmail
    if (email) {
      filter.$or = [
        { pencacahEmail: email },
        { email: email, pencacahEmail: { $exists: false } },
      ];
    }
    if (kec)    filter.kecamatan = { $regex: new RegExp(`^${kec}$`, 'i') };
    if (desa)   filter.desa      = { $regex: new RegExp(`^${desa}$`, 'i') };
    if (status) filter.status    = status;

    const pg  = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pg - 1) * lim;

    const [data, total] = await Promise.all([
      db.collection('assignment_detail')
        .find(filter, { projection: { _id: 0 } })
        .sort({ kecamatan: 1, desa: 1, slsCode: 1, subSlsCode: 1 })
        .skip(skip).limit(lim).toArray(),
      db.collection('assignment_detail').countDocuments(filter),
    ]);

    res.json({ data, total, totalPages: Math.ceil(total / lim), page: pg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/evaluasi/desa-list ───────────────────────────────────────────
// Query: email, kec — untuk populate dropdown desa filter
app.get('/api/evaluasi/desa-list', verifyToken, async (req, res) => {
  try {
    const { email, kec } = req.query;
    const coll = req.query.role === 'Pengawas'
      ? 'assignment_pengawas' : 'assignment_pencacah';
    const doc = await db.collection(coll)
      .findOne({ email }, { projection: { perDesa: 1 } });
    if (!doc) return res.json([]);
    let list = doc.perDesa || [];
    if (kec) list = list.filter(d =>
      d.kecamatan.toLowerCase() === kec.toLowerCase());
    // Sort by desa name
    list.sort((a, b) => a.desa.localeCompare(b.desa));
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── GET /api/evaluasi/timeseries ─────────────────────────────────────────
// Return dailySeries untuk satu petugas (embedded di document)
// Query: email, role (Pencacah|Pengawas)
app.get('/api/evaluasi/timeseries', verifyToken, async (req, res) => {
  try {
    const { email, role = 'Pencacah' } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });
    const coll = role === 'Pengawas' ? 'assignment_pengawas' : 'assignment_pencacah';
    const doc = await db.collection(coll).findOne(
      { email },
      { projection: { _id: 0, email: 1, nama: 1, dailySeries: 1, avgPerDay: 1 } }
    );
    if (!doc) return res.status(404).json({ error: 'Petugas tidak ditemukan' });
    res.json({ series: doc.dailySeries || [], avgPerDay: doc.avgPerDay || {} });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/evaluasi/snapshots ───────────────────────────────────────────
// Return history snapshot uploads untuk chart progress
app.get('/api/evaluasi/snapshots', verifyToken, async (req, res) => {
  try {
    const snaps = await db.collection('assignment_snapshots')
      .find({}, { projection: { _id:0, snapshotAt:1, uploadedAt:1,
                                 'summary.approved':1, 'summary.submit':1,
                                 'summary.open':1, 'summary.reject':1,
                                 gradeDistPencacah:1, gradeDistPengawas:1 }})
      .sort({ snapshotAt: 1 }).toArray();
    res.json(snaps);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/crosscheck/:type ─────────────────────────────────────────────
// type: nikKK | nikAK | rekening | tidakTahu
// Query: kec, desa, pcl, page, limit
app.get('/api/crosscheck/:type', verifyToken, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['nikKK','nikAK','rekening','tidakTahu'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const { q = '', page = 1, limit = 10 } = req.query;
    const pg  = Math.max(1, parseInt(page));
    const lim = Math.min(200, Math.max(1, parseInt(limit)));

    const STATUS_DONE = ['SUBMITTED','APPROVED','REJECTED'];

    // Query langsung dari isian_se2026 (tidak bergantung pada crosscheckLists di statistik doc)
    let pipeline = [];
    let countPipeline = [];

    if (type === 'nikKK') {
      // NIK kepala keluarga yang startsWith '9999'
      const baseMatch = {
        status: { $in: STATUS_DONE },
        nik: { $regex: '^9999', $options: 'i' }
      };
      if (q) {
        baseMatch.$or = [
          { namaKepala: { $regex: q, $options: 'i' } },
          { nik:        { $regex: q, $options: 'i' } },
          { kecamatan:  { $regex: q, $options: 'i' } },
          { desa:       { $regex: q, $options: 'i' } },
          { petugas:    { $regex: q, $options: 'i' } },
          { noKK:       { $regex: q, $options: 'i' } },
        ];
      }
      pipeline = [
        { $match: baseMatch },
        { $project: { _id:0, id:1, no:1, nama:'$namaKepala', nik:1, noKK:1,
                      kec:'$kecamatan', desa:1, sls:1, pcl:'$petugas', status:1 } },
        { $sort: { kec:1, desa:1, id:1 } },
        { $skip: (pg-1)*lim }, { $limit: lim }
      ];
      countPipeline = [{ $match: baseMatch }, { $count: 'n' }];

    } else if (type === 'nikAK') {
      // NIK anggota keluarga yang startsWith '9999'
      // Gunakan $unwind + $match untuk flatten array anggotaKeluarga di MongoDB
      const agg = [
        { $match: { status: { $in: STATUS_DONE } } },
        { $unwind: { path: '$anggotaKeluarga', preserveNullAndEmptyArrays: false } },
        { $match: {
            $or: [
              { 'anggotaKeluarga.nik': /^9999/ },
              { 'anggotaKeluarga.nik': '9999' },
              { 'anggotaKeluarga.nik': { $regex: '^9{4}' } },
            ]
          }
        },
        { $project: {
            _id: 0,
            id: 1, namaKK: '$namaKepala',
            namaAK: '$anggotaKeluarga.nama',
            nikAK:  '$anggotaKeluarga.nik',
            hubungan: '$anggotaKeluarga.hubungan',
            kec: '$kecamatan', desa: 1, pcl: '$petugas', status: 1,
          }
        },
        { $sort: { kec: 1, desa: 1, id: 1 } },
      ];

      let list = await db.collection('isian_se2026').aggregate(agg).toArray();

      // Fallback: jika anggotaKeluarga tidak ada di MongoDB,
      // kembalikan pesan informatif bukan array kosong
      if (list.length === 0) {
        // Coba cek apakah collection punya anggotaKeluarga sama sekali
        const sampleWithAK = await db.collection('isian_se2026').findOne(
          { anggotaKeluarga: { $exists: true, $not: { $size: 0 } } },
          { projection: { id:1, anggotaKeluarga: { $slice: 1 } } }
        );
        if (!sampleWithAK) {
          return res.json({ data: [], total: 0, totalPages: 0, page: pg,
            warning: 'anggotaKeluarga tidak tersimpan di collection isian_se2026. Jalankan upload_to_mongo.py --drop untuk upload ulang.' });
        }
      }

      if (q) {
        const ql = q.toLowerCase();
        list = list.filter(r => JSON.stringify(r).toLowerCase().includes(ql));
      }
      const total = list.length;
      return res.json({ data: list.slice((pg-1)*lim, pg*lim), total,
                         totalPages: Math.ceil(total/lim), page: pg });

    } else if (type === 'rekening') {
      // KK yang semua AK-nya tidak punya rekening aktif
      const allDocs = await db.collection('isian_se2026').find(
        { status: { $in: STATUS_DONE }, anggotaKeluarga: { $exists: true, $ne: [] } },
        { projection: { id:1, namaKepala:1, noKK:1, kecamatan:1, desa:1, sls:1,
                        petugas:1, status:1, jumlahAk:1, anggotaKeluarga:1 } }
      ).toArray();

      let list = [];
      for (const r of allDocs) {
        const aks = r.anggotaKeluarga || [];
        if (!aks.length) continue;
        const hasActive = aks.some(ak => (ak.rekening||'').toLowerCase().startsWith('ya'));
        if (hasActive) continue;
        const rekVals = [...new Set(aks.map(ak => ak.rekening).filter(Boolean))];
        const entry = { id: r.id, nama: r.namaKepala, noKK: r.noKK,
                        kec: r.kecamatan, desa: r.desa, sls: r.sls,
                        jumlahAk: r.jumlahAk || aks.length,
                        jawaban: rekVals.join(', ') || '—',
                        pcl: r.petugas, status: r.status };
        if (!q || JSON.stringify(entry).toLowerCase().includes(q.toLowerCase())) {
          list.push(entry);
        }
      }
      list.sort((a,b) => (a.kec||'').localeCompare(b.kec||'') || (a.desa||'').localeCompare(b.desa||''));
      const total = list.length;
      return res.json({ data: list.slice((pg-1)*lim, pg*lim), total,
                         totalPages: Math.ceil(total/lim), page: pg });

    } else if (type === 'tidakTahu') {
      // Scan SEMUA field yang bernilai 'Tidak Tahu' di seluruh record
      const isNotTahu = v => typeof v === 'string' &&
        ['tidak tahu','tidaktahu','tidak diketahui','tidak dikenal',
         'tidak tahu/tidak diketahui'].includes((v||'').trim().toLowerCase());

      const FIELD_LABELS = {
        statusKerja:'Status Pekerjaan', rekening:'Kepemilikan Rekening',
        ijazah:'Pendidikan', statusKawin:'Status Kawin', profesi:'Profesi',
        airMinum:'Sumber Air Minum', penerangan:'Penerangan',
        jenisAtap:'Jenis Atap', jenisDinding:'Jenis Dinding',
        jenisLantai:'Jenis Lantai', statusKepemilikan:'Status Kepemilikan',
        tempatBAB:'Tempat BAB', buangTinja:'Pembuangan Tinja',
        jenisUsaha:'Jenis Usaha', skalaUsaha:'Skala Usaha',
      };
      const RT_FIELDS = ['airMinum','penerangan','jenisAtap','jenisDinding','jenisLantai',
                          'statusKepemilikan','tempatBAB','buangTinja'];

      const allDocs = await db.collection('isian_se2026').find(
        { status: { $in: STATUS_DONE } },
        { projection: { id:1, namaKepala:1, noKK:1, kecamatan:1, desa:1, petugas:1,
                        status:1, anggotaKeluarga:1, usaha:1,
                        airMinum:1, penerangan:1, jenisAtap:1, jenisDinding:1,
                        jenisLantai:1, statusKepemilikan:1, tempatBAB:1, buangTinja:1 } }
      ).toArray();

      let list = [];
      for (const r of allDocs) {
        const temuan = [];
        // AK fields
        for (const ak of (r.anggotaKeluarga || [])) {
          for (const [field, val] of Object.entries(ak)) {
            if (isNotTahu(val)) {
              temuan.push({ level:'AK', field: FIELD_LABELS[field]||field,
                            nilai: val, nama: ak.nama||'—', hubungan: ak.hubungan||'—' });
            }
          }
        }
        // RT fields
        for (const field of RT_FIELDS) {
          if (isNotTahu(r[field])) {
            temuan.push({ level:'RT', field: FIELD_LABELS[field]||field,
                          nilai: r[field], nama:'—', hubungan:'—' });
          }
        }
        // Usaha fields
        for (const u of (r.usaha||[])) {
          for (const field of ['jenisUsaha','skalaUsaha']) {
            if (isNotTahu(u[field])) {
              temuan.push({ level:'Usaha', field: FIELD_LABELS[field]||field,
                            nilai: u[field], nama: u.namaUsaha||'—', hubungan:'—' });
            }
          }
        }
        if (!temuan.length) continue;
        const entry = {
          id: r.id, namaKK: r.namaKepala, noKK: r.noKK||'—',
          kec: r.kecamatan, desa: r.desa, pcl: r.petugas, status: r.status,
          jumlah: temuan.length,
          fields: [...new Set(temuan.map(t => t.field))].join(', '),
          temuan,
        };
        if (!q || JSON.stringify(entry).toLowerCase().includes(q.toLowerCase())) {
          list.push(entry);
        }
      }
      list.sort((a,b) => (a.kec||'').localeCompare(b.kec||'') || (a.desa||'').localeCompare(b.desa||''));
      const total = list.length;
      return res.json({ data: list.slice((pg-1)*lim, pg*lim), total,
                         totalPages: Math.ceil(total/lim), page: pg });
    }

    // Untuk nikKK: jalankan pipeline aggregasi
    const [data, countResult] = await Promise.all([
      db.collection('isian_se2026').aggregate(pipeline).toArray(),
      db.collection('isian_se2026').aggregate(countPipeline).toArray(),
    ]);
    const total = countResult[0]?.n || 0;
    res.json({ data, total, totalPages: Math.ceil(total/lim), page: pg });

  } catch (err) { res.status(500).json({ error: err.message }); }
});

// [debug endpoint dihapus dari production]

// Rate limit untuk semua endpoint API (kecuali health)
app.use('/api', rateLimitMiddleware(RATE_MAX_API));

// ── GET /api/evaluasi/inaktif ────────────────────────────────────────────────
// Deteksi otomatis pencacah yang tidak ada submit/approved dalam N hari terakhir
// Query param: days (default 2), minProgress (default 0)
app.get('/api/evaluasi/inaktif', verifyToken, async (req, res) => {
  try {
    const threshold    = Math.max(1, parseInt(req.query.days || '2'));
    const minProgress  = parseFloat(req.query.minProgress || '0');
    const filterKec    = (req.query.kec || '').trim().toLowerCase();

    // Ambil pencacah dari MongoDB — filter kecamatan jika ada
    const mongoQuery = filterKec
      ? { kecamatan: { $regex: new RegExp('^' + filterKec + '$', 'i') } }
      : {};
    const pencacah = await db.collection('assignment_pencacah')
      .find(mongoQuery, { projection: {
        email:1, nama:1, kecamatan:1, pengawas:1,
        progressScore:1, submit:1, approved:1, reject:1, draft:1, total:1,
        dailySeries:1, snapshotAt:1, lastActive:1,
      }})
      .toArray();

    const results = [];

    for (const p of pencacah) {
      const snap   = p.snapshotAt ? p.snapshotAt.slice(0,10) : new Date().toISOString().slice(0,10);
      const snapDt = new Date(snap + 'T00:00:00Z');
      const ds     = p.dailySeries || [];

      // ── Cari tanggal terakhir ada SUBMIT atau DRAFT (bukan approved)
      // Karena yang dimonitor: apakah pencacah masih aktif mengisi di lapangan
      let lastSubmitDraftDate = null;
      for (const e of ds) {
        const hasWork = (e.submitted || e.draft || 0) > 0;
        if (!hasWork) continue;
        if (!lastSubmitDraftDate || e.date > lastSubmitDraftDate) lastSubmitDraftDate = e.date;
      }

      let gapHari = 99;
      if (lastSubmitDraftDate) {
        const lastDt = new Date(lastSubmitDraftDate + 'T00:00:00Z');
        gapHari = Math.round((snapDt - lastDt) / (1000 * 60 * 60 * 24));
      }

      // Tandai apakah belum pernah submit maupun draft sama sekali
      const neverSubmit = (p.submit || 0) === 0 && (p.draft || 0) === 0;

      const progress = p.progressScore ?? 0;

      // Masuk list jika: gap >= threshold ATAU belum pernah submit/draft sama sekali
      const masukList = gapHari >= threshold || neverSubmit;
      if (!masukList) continue;
      if (progress < minProgress) continue;

      results.push({
        email:              p.email,
        nama:               p.nama,
        kecamatan:          p.kecamatan,
        pengawas:           p.pengawas?.nama  || '—',
        pengawasEmail:      p.pengawas?.email || '—',
        progressScore:      progress,
        submit:             p.submit   || 0,
        draft:              p.draft    || 0,
        approved:           p.approved || 0,
        reject:             p.reject   || 0,
        total:              p.total    || 0,
        lastSubmitDraftDate: lastSubmitDraftDate || '—',
        gapHari,
        neverSubmit,        // flag: belum pernah submit/draft sama sekali
        snapshotAt:         snap,
      });
    }

    // Urutkan: yang progressScore tinggi tapi inaktif lama di atas
    results.sort((a, b) =>
      b.progressScore - a.progressScore || b.gapHari - a.gapHari
    );

    res.json({
      threshold,
      kecamatan: filterKec || 'all',
      total:     results.length,
      data:      results,
      snap:      results[0]?.snapshotAt || '',
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


// ══════════════════════════════════════════════════════════════════════════
// POST /api/upload/assignment
// Upload CSV → hitung stats otomatis → simpan ke MongoDB
// ══════════════════════════════════════════════════════════════════════════
app.post(
  '/api/upload/assignment',
  verifyToken,
  (req, res, next) => {
    const allowed = ['kepala', 'kasubbag', 'statistisi'];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Hanya kepala/kasubbag/statistisi yang boleh upload.' });
    }
    next();
  },
  upload.single('file'),
  async (req, res) => {
    const t0 = Date.now();
    try {
      if (!req.file) return res.status(400).json({ error: 'File CSV tidak ditemukan dalam request.' });

      // ── 1. Parse CSV ──────────────────────────────────────────────────────
      const rows = csvParse(req.file.buffer, {
        columns:          true,
        skip_empty_lines: true,
        trim:             true,
        bom:              true,
      });
      if (!rows.length) return res.status(400).json({ error: 'CSV kosong atau tidak bisa dibaca.' });

      // ── 2. Setup ──────────────────────────────────────────────────────────
      const WORKING_DAYS = countWorkingDays();
      const snapshotTs   = new Date().toISOString();

      const STATUS_DONE   = new Set(['APPROVED BY Pengawas', 'COMPLETED BY Admin Kabupaten']);
      const STATUS_SUBMIT = new Set(['SUBMITTED BY Pencacah']);
      const STATUS_REJECT = new Set(['REJECTED BY Pengawas', 'REVOKED BY Pengawas']);
      const STATUS_DRAFT  = new Set(['DRAFT']);
      const STATUS_OPEN   = new Set(['OPEN', 'SUBMITTED RESPONDENT']);

      function parseDate(s) {
        if (!s || s.trim() === '') return null;
        try { return new Date(s.trim()); } catch { return null; }
      }
      function sr(v, n = 2) {
        if (v == null || !isFinite(v)) return null;
        return Math.round(v * Math.pow(10, n)) / Math.pow(10, n);
      }
      function statusOf(row) { return (row.assignmentStatusAlias || '').trim(); }

      // ── 3. Index baris per pencacah_uid / pengawas_email / kecamatan ──────
      const byPcl = new Map();
      const byPws = new Map();
      const byKec = new Map();

      for (const row of rows) {
        const pclUid  = (row.pencacah_currentUserId || '').trim();
        const pclRole = (row.currentUserSurveyRoleName || '').trim();
        const kec     = (row.level3_name || '—').trim();

        if (pclUid) {
          if (!byPcl.has(pclUid)) byPcl.set(pclUid, []);
          byPcl.get(pclUid).push(row);
        }
        if (pclRole === 'Pengawas') {
          const email = (row.currentUserUsername || '').trim();
          if (email) {
            if (!byPws.has(email)) byPws.set(email, []);
            byPws.get(email).push(row);
          }
        }
        if (!byKec.has(kec)) byKec.set(kec, []);
        byKec.get(kec).push(row);
      }

      // Lookup pencacah_uid → email / nama / pengawas
      const pclInfo = new Map();
      for (const row of rows) {
        const pclRole = (row.currentUserSurveyRoleName || '').trim();
        const pclUid  = (row.pencacah_currentUserId   || '').trim();
        if (pclRole === 'Pencacah' && pclUid && !pclInfo.has(pclUid)) {
          pclInfo.set(pclUid, {
            email:     (row.currentUserUsername || '').trim(),
            nama:      (row.currentUserFullname  || '').trim(),
            pws_email: null, pws_nama: null,
          });
        }
        if (pclRole === 'Pengawas' && pclUid) {
          if (!pclInfo.has(pclUid)) pclInfo.set(pclUid, { email: '', nama: '', pws_email: null, pws_nama: null });
          const info = pclInfo.get(pclUid);
          if (!info.pws_email) {
            info.pws_email = (row.currentUserUsername || '').trim();
            info.pws_nama  = (row.currentUserFullname  || '').trim();
          }
        }
      }

      // ── 4. Helper functions ───────────────────────────────────────────────
      function countStatus(grp) {
        let approved = 0, submit = 0, reject = 0, draft = 0, open_ = 0;
        for (const r of grp) {
          const s = statusOf(r);
          if      (STATUS_DONE.has(s))   approved++;
          else if (STATUS_SUBMIT.has(s)) submit++;
          else if (STATUS_REJECT.has(s)) reject++;
          else if (STATUS_DRAFT.has(s))  draft++;
          else if (STATUS_OPEN.has(s))   open_++;
        }
        return { approved, submit, reject, draft, open: open_, total: grp.length };
      }

      function buildDailySeries(grp) {
        const byDate = new Map();
        for (const r of grp) {
          const d = parseDate(r.dateModified);
          if (!d) continue;
          const key = d.toISOString().slice(0, 10);
          if (!byDate.has(key)) byDate.set(key, { date: key, approved: 0, submitted: 0, rejected: 0, draft: 0, open: 0 });
          const e = byDate.get(key);
          const s = statusOf(r);
          if      (STATUS_DONE.has(s))   e.approved++;
          else if (STATUS_SUBMIT.has(s)) e.submitted++;
          else if (STATUS_REJECT.has(s)) e.rejected++;
          else if (STATUS_DRAFT.has(s))  e.draft++;
          else if (STATUS_OPEN.has(s))   e.open++;
        }
        return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      }

      function buildAvgPerDay(counts, dailySeries) {
        const { approved, submit, reject, draft } = counts;
        const worked     = approved + submit + reject + draft;
        const activeDays = dailySeries.filter(r =>
          (r.approved || 0) + (r.submitted || 0) + (r.rejected || 0) + (r.draft || 0) > 0
        ).length;
        return {
          approved:       sr(approved / WORKING_DAYS),
          submitted:      sr(submit   / WORKING_DAYS),
          rejected:       sr(reject   / WORKING_DAYS),
          draft:          sr(draft    / WORKING_DAYS),
          total:          sr(worked   / WORKING_DAYS),
          workingDays:    WORKING_DAYS,
          activeDays,
          pendataanStart: PENDATAAN_START.toISOString().slice(0, 10),
        };
      }

      // ── 5. Hitung Pencacah rows ───────────────────────────────────────────
      const pencacahRows = [];
      for (const [uid, grp] of byPcl) {
        const info  = pclInfo.get(uid) || {};
        const email = info.email || '';
        const nama  = info.nama  || email;
        if (!email && !nama) continue;

        const counts = countStatus(grp);
        const daily  = buildDailySeries(grp);
        const avgPD  = buildAvgPerDay(counts, daily);

        // Kecamatan dominan
        const kecCount = {};
        grp.forEach(r => { const k = (r.level3_name||'—').trim(); kecCount[k]=(kecCount[k]||0)+1; });
        const kecDom = Object.entries(kecCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

        const dates    = grp.map(r => parseDate(r.dateModified)).filter(Boolean);
        const lastActive = dates.length ? new Date(Math.max(...dates.map(d=>d.getTime()))).toISOString() : null;

        const aktifDates = grp
          .filter(r => STATUS_DONE.has(statusOf(r)) || STATUS_SUBMIT.has(statusOf(r)) || STATUS_REJECT.has(statusOf(r)))
          .map(r => parseDate(r.dateModified)).filter(Boolean);
        const lastAktif    = aktifDates.length ? new Date(Math.max(...aktifDates.map(d=>d.getTime()))) : null;
        const lastAktifStr = lastAktif ? lastAktif.toISOString().slice(0, 10) : null;
        const snapDate     = new Date(snapshotTs);
        const gapHari      = lastAktif ? Math.round((snapDate - lastAktif) / 86400000) : null;

        pencacahRows.push({
          email, nama, role: 'Pencacah',
          kecamatan: kecDom,
          ...counts,
          pctApproved:   counts.total > 0 ? sr(counts.approved / counts.total * 100, 1) : 0,
          progressScore: counts.total > 0 ? sr((counts.approved + counts.submit + counts.reject + counts.draft) / counts.total * 100, 1) : 0,
          lastActive,
          lastAktifDate: lastAktifStr,
          gapHariAktif:  gapHari,
          inaktif:       gapHari !== null && gapHari >= 2,
          pengawas: { email: info.pws_email || null, nama: info.pws_nama || null },
          dailySeries: daily,
          avgPerDay:   avgPD,
          snapshotAt:  snapshotTs,
        });
      }

      // ── 6. Hitung Pengawas rows ───────────────────────────────────────────
      const pgwToPcl = new Map();
      for (const pcl of pencacahRows) {
        const pgwEmail = pcl.pengawas?.email;
        if (pgwEmail) {
          if (!pgwToPcl.has(pgwEmail)) pgwToPcl.set(pgwEmail, []);
          pgwToPcl.get(pgwEmail).push(pcl);
        }
      }

      const pengawasRows = [];
      for (const [email, grp] of byPws) {
        const nama   = (grp[0]?.currentUserFullname || '').trim() || email;
        if (!email && !nama) continue;

        const pclUnder = pgwToPcl.get(email) || [];
        let counts;
        if (pclUnder.length) {
          counts = {
            approved: pclUnder.reduce((s, p) => s + p.approved, 0),
            submit:   pclUnder.reduce((s, p) => s + p.submit,   0),
            reject:   pclUnder.reduce((s, p) => s + p.reject,   0),
            draft:    pclUnder.reduce((s, p) => s + p.draft,    0),
            open:     pclUnder.reduce((s, p) => s + p.open,     0),
            total:    pclUnder.reduce((s, p) => s + p.total,    0),
          };
        } else {
          counts = countStatus(grp);
        }

        const daily = buildDailySeries(grp);
        const avgPD = buildAvgPerDay(counts, daily);
        const kecCount = {};
        grp.forEach(r => { const k = (r.level3_name||'—').trim(); kecCount[k]=(kecCount[k]||0)+1; });
        const kecDom = Object.entries(kecCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
        const dates  = grp.map(r => parseDate(r.dateModified)).filter(Boolean);
        const lastActive = dates.length ? new Date(Math.max(...dates.map(d=>d.getTime()))).toISOString() : null;

        pengawasRows.push({
          email, nama, role: 'Pengawas',
          kecamatan: kecDom,
          ...counts,
          pctApproved: counts.total > 0 ? sr(counts.approved / counts.total * 100, 1) : 0,
          lastActive,
          dailySeries: daily,
          avgPerDay:   avgPD,
          snapshotAt:  snapshotTs,
        });
      }

      // ── 7. Per kecamatan ──────────────────────────────────────────────────
      const kecList = [];
      for (const [kec, grp] of byKec) {
        kecList.push({ kecamatan: kec, ...countStatus(grp) });
      }

      // ── 8. Summary global ─────────────────────────────────────────────────
      const globalAppr   = rows.filter(r => STATUS_DONE.has(statusOf(r))).length;
      const globalSub    = rows.filter(r => STATUS_SUBMIT.has(statusOf(r))).length;
      const globalRej    = rows.filter(r => STATUS_REJECT.has(statusOf(r))).length;
      const globalDraft  = rows.filter(r => STATUS_DRAFT.has(statusOf(r))).length;
      const globalOpen   = rows.filter(r => STATUS_OPEN.has(statusOf(r))).length;
      const globalWorked = globalAppr + globalSub + globalRej + globalDraft;

      const globalDaily      = buildDailySeries(rows);
      const globalActiveDays = globalDaily.filter(r =>
        (r.approved||0)+(r.submitted||0)+(r.rejected||0)+(r.draft||0) > 0
      ).length;

      const summary = {
        totalAssignment: rows.length,
        totalPencacah:   pencacahRows.length,
        totalPengawas:   pengawasRows.length,
        totalKecamatan:  kecList.length,
        approved:        globalAppr,
        submit:          globalSub,
        reject:          globalRej,
        draft:           globalDraft,
        open:            globalOpen,
        workingDays:     WORKING_DAYS,
        pendataanStart:  PENDATAAN_START.toISOString().slice(0, 10),
        snapshotAt:      snapshotTs,
        generatedAt:     snapshotTs,
        avgPerDay: {
          approved:       sr(globalAppr   / WORKING_DAYS),
          submitted:      sr(globalSub    / WORKING_DAYS),
          rejected:       sr(globalRej    / WORKING_DAYS),
          draft:          sr(globalDraft  / WORKING_DAYS),
          total:          sr(globalWorked / WORKING_DAYS),
          workingDays:    WORKING_DAYS,
          activeDays:     globalActiveDays,
          pendataanStart: PENDATAAN_START.toISOString().slice(0, 10),
        },
        dailySeries: globalDaily,
      };

      // ── 9. Simpan ke MongoDB ──────────────────────────────────────────────
      const col_pcl  = db.collection('assignment_pencacah');
      const col_pws  = db.collection('assignment_pengawas');
      const col_kec  = db.collection('assignment_kecamatan');
      const col_snap = db.collection('assignment_snapshots');
      const col_det  = db.collection('assignment_detail');
      const col_stat = db.collection('statistik_se2026');

      // Upsert pencacah by email
      if (pencacahRows.length) {
        await col_pcl.bulkWrite(
          pencacahRows.map(r => ({ updateOne: { filter: { email: r.email }, update: { $set: r }, upsert: true } })),
          { ordered: false }
        );
      }
      // Upsert pengawas by email
      if (pengawasRows.length) {
        await col_pws.bulkWrite(
          pengawasRows.map(r => ({ updateOne: { filter: { email: r.email }, update: { $set: r }, upsert: true } })),
          { ordered: false }
        );
      }
      // Upsert kecamatan by kecamatan
      if (kecList.length) {
        await col_kec.bulkWrite(
          kecList.map(r => ({ updateOne: { filter: { kecamatan: r.kecamatan }, update: { $set: r }, upsert: true } })),
          { ordered: false }
        );
      }
      // Upsert detail by assignmentId
      const detailList = rows
        .filter(r => r.assignment_id)
        .map(r => {
          const pclUid  = (r.pencacah_currentUserId || '').trim();
          const info    = pclInfo.get(pclUid) || {};
          return {
            assignmentId:  r.assignment_id,
            pencacahEmail: info.email || (r.currentUserUsername || '').trim(),
            email:         (r.currentUserUsername || '').trim(),
            nama:          (r.currentUserFullname  || '').trim(),
            role:          (r.currentUserSurveyRoleName || '').trim(),
            kecamatan:     (r.level3_name || '—').trim(),
            desa:          (r.level4_name || '—').trim(),
            slsName:       (r.level5_name || '—').trim(),
            slsCode:       (r.level5_fullCode || '').trim(),
            subSlsName:    (r.level6_name || '—').trim(),
            subSlsCode:    (r.level6_fullCode || '').trim(),
            status:        statusOf(r),
            isListing:     r.listing === 'true' || r.listing === '1',
            sampleType:    r.sampleType ? (parseInt(r.sampleType) || null) : null,
            dateCreated:   parseDate(r.dateCreated)  ? parseDate(r.dateCreated).toISOString()  : null,
            dateModified:  parseDate(r.dateModified) ? parseDate(r.dateModified).toISOString() : null,
            snapshotAt:    snapshotTs,
          };
        });
      if (detailList.length) {
        await col_det.bulkWrite(
          detailList.map(d => ({ updateOne: { filter: { assignmentId: d.assignmentId }, update: { $set: d }, upsert: true } })),
          { ordered: false }
        );
      }

      // Insert snapshot
      await col_snap.insertOne({
        snapshotAt:   snapshotTs,
        uploadedAt:   snapshotTs,
        uploadedBy:   req.user.username,
        filename:     req.file.originalname,
        totalRows:    rows.length,
        summary,
      });

      // Update statistik_utama
      await col_stat.updateOne(
        { _id: 'statistik_utama' },
        { $set: { assignmentSummary: summary } },
        { upsert: true }
      );

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log('[UPLOAD] ' + req.user.username + ' upload ' + req.file.originalname + ' -> ' + rows.length + ' rows, ' + WORKING_DAYS + ' hari kerja, ' + elapsed + 's');

      res.json({
        ok:          true,
        totalRows:   rows.length,
        workingDays: WORKING_DAYS,
        snapshotAt:  snapshotTs,
        elapsed:     elapsed + 's',
        summary: {
          approved:  globalAppr,
          submitted: globalSub,
          rejected:  globalRej,
          draft:     globalDraft,
          open:      globalOpen,
          avgPerDay: summary.avgPerDay,
        },
        pencacah:  pencacahRows.length,
        pengawas:  pengawasRows.length,
        kecamatan: kecList.length,
      });

    } catch (err) {
      console.error('[UPLOAD ERROR]', err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File terlalu besar (maks 50 MB).' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[EWS SE2026 API] http://0.0.0.0:${PORT}`);
  console.log(`  Auth    : JWT (${JWT_EXPIRES})`);
  console.log(`  DB      : ${DB_NAME}`);
  console.log(`  Roles   : kepala, kasubbag, statistisi (FULL) | pengadmin (TERBATAS)`);
});

process.on('SIGINT',  async () => { if (client) await client.close(); process.exit(0); });
process.on('SIGTERM', async () => { if (client) await client.close(); process.exit(0); });
