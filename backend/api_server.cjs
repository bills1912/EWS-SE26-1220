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

// ── Hari kerja WIB (UTC+7), Senin–Sabtu, sejak 15 Juni 2026 ─────────────
const PENDATAAN_START_STR = '2026-06-15';

function todayWIB() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

function countWorkingDays() {
  const endStr  = todayWIB();
  let cur       = new Date(PENDATAAN_START_STR + 'T12:00:00Z');
  const endDate = new Date(endStr + 'T12:00:00Z');
  let count     = 0;
  while (cur <= endDate) {
    count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(1, count);
}

function sr(v, n = 2) {
  if (v == null || !isFinite(v)) return null;
  return Math.round(v * Math.pow(10, n)) / Math.pow(10, n);
}

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

  try {
    const coll = db.collection('isian_se2026');
    await coll.createIndex({ status: 1 });
    await coll.createIndex({ status: 1, kecamatan: 1 });
    await coll.createIndex({ kecamatan: 1 });
    await coll.createIndex({ id: 1 });
    console.log('[MongoDB] Index siap (status, kecamatan)');
  } catch (e) {
    console.warn('[MongoDB] Gagal membuat index:', e.message);
  }

  // Build lookup cache: nama pencacah → { namaPengawas, emailPengawas, emailPencacah }
  try {
    await buildPetugasCache();
  } catch (e) {
    console.warn('[MongoDB] Gagal build petugas cache:', e.message);
  }

  return db;
}

// ── Cache lookup petugas: namaPencacah/emailPencacah → info lengkap ──────────
// Dibangun dari assignment_pencacah (nama → pengawas) + assignment_pengawas
// (email pencacah → nama pengawas) untuk coverage lengkap
let petugasCache = null; // Map: key (nama.lower atau email.lower) → { namaPencacah, emailPencacah, namaPengawas, emailPengawas }

async function buildPetugasCache() {
  petugasCache = new Map();

  // Key = subSlsCode (idsubsls_25_2 di XLSX = kode_subsls di isian_se2026)
  // Ini paling akurat: setiap sub-SLS punya PCL dan PML yang fixed
  const all_docs = await db.collection('nama_petugas_se2026').find({}).toArray();

  if (all_docs.length === 0) {
    console.warn('[MongoDB] nama_petugas_se2026 kosong! Jalankan upload_nama_petugas.py terlebih dahulu.');
    return;
  }

  for (const d of all_docs) {
    if (d.type === 'subsls' && d.subSlsCode) {
      // Index by subSlsCode — ini primary lookup untuk /api/responden dan /api/crosscheck
      petugasCache.set(d.subSlsCode.trim(), {
        namaPencacah:  d.namaPcl      || d.namaFasihPcl || '',
        emailPencacah: d.emailPcl     || '',
        namaPengawas:  d.namaPml      || d.namaFasihPml || '',
        emailPengawas: d.emailPml     || '',
      });
    } else if (d.type === 'pcl' && d.emailPcl) {
      // Index by email PCL — fallback jika kode_subsls tidak ada di doc
      petugasCache.set(d.emailPcl.toLowerCase().trim(), {
        namaPencacah:  d.namaPcl      || d.namaFasihPcl || '',
        emailPencacah: d.emailPcl     || '',
        namaPengawas:  d.namaPml      || d.namaFasihPml || '',
        emailPengawas: d.emailPml     || '',
      });
    } else if (d.type === 'pml' && d.emailPml) {
      // Index by email PML — untuk lookup nama PML di evaluasi
      petugasCache.set(`pml_${d.emailPml.toLowerCase().trim()}`, {
        namaPengawas:  d.namaPml      || d.namaFasihPml || '',
        emailPengawas: d.emailPml     || '',
      });
    }
  }

  const nSubsls = all_docs.filter(d => d.type === 'subsls').length;
  const nPcl    = all_docs.filter(d => d.type === 'pcl').length;
  const nPml    = all_docs.filter(d => d.type === 'pml').length;
  console.log(`[MongoDB] Petugas cache: ${nSubsls} sub-SLS, ${nPcl} PCL, ${nPml} PML → ${petugasCache.size} entri`);
}

// Fungsi enrich: tambahkan namaPencacah & namaPengawas ke satu record
// Match pertama by nama (field petugas di isian_se2026), fallback by email
function enrichPetugas(doc) {
  if (!petugasCache || !doc) return doc;

  // Ambil kodeSubsls: dari field langsung, atau parse dari codeIdentity
  const kodeSubsls = (doc.kodeSubsls || '').trim()
    || ((doc.codeIdentity || '').split(' ')[0] || '').trim();

  const bySubsls = kodeSubsls ? petugasCache.get(kodeSubsls) : null;
  const byEmail  = doc.emailPencacah ? petugasCache.get((doc.emailPencacah || '').toLowerCase().trim()) : null;
  const info     = bySubsls || byEmail;
  if (!info) return doc;
  return {
    ...doc,
    namaPencacah:  info.namaPencacah  || '',
    emailPencacah: info.emailPencacah || doc.emailPencacah || '',
    namaPengawas:  info.namaPengawas  || '',
    emailPengawas: info.emailPengawas || '',
  };
}

// Debug endpoint — cek isi cache dan sample dokumen
app.get('/api/petugas/debug', verifyToken, requireFullAccess, async (req, res) => {
  try {
    // Cek collection ada
    const collections = await db.listCollections().toArray();
    const collNames = collections.map(c => c.name);

    // Sample dari assignment_pencacah
    const samplePcl = await db.collection('assignment_pencacah')
      .findOne({}, { projection: { _id:0, nama:1, email:1, pengawas:1 } });

    // Sample dari assignment_pengawas
    const samplePws = await db.collection('assignment_pengawas')
      .findOne({}, { projection: { _id:0, nama:1, email:1, subSlsDetail:{ $slice:1 } } });

    // Cek cache
    const cacheSize = petugasCache ? petugasCache.size : null;
    // Sample 3 entry dari cache
    const cacheSample = [];
    if (petugasCache) {
      let i = 0;
      for (const [k, v] of petugasCache.entries()) {
        if (i++ >= 3) break;
        cacheSample.push({ key: k, value: v });
      }
    }

    // Test lookup untuk 'Fadlan'
    const fadlan = petugasCache ? petugasCache.get('fadlan') : null;

    res.json({
      collections: collNames.filter(n => n.includes('assignment') || n.includes('isian')),
      samplePcl,
      samplePws,
      cacheSize,
      cacheSample,
      fadlanLookup: fadlan,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Refresh cache manual — semua role bisa trigger (tidak ada data sensitif)
app.post('/api/petugas/cache/refresh', verifyToken, async (req, res) => {
  try {
    await buildPetugasCache();
    res.json({ ok: true, size: petugasCache?.size || 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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
    res.json({ total, page, limit, totalPages: Math.ceil(total / limit),
      data: docs.map(enrichPetugas) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/responden/:id', verifyToken, requireFullAccess, async (req, res) => {
  try {
    const doc = await db.collection('isian_se2026')
      .findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: `Record ${req.params.id} tidak ditemukan` });
    res.json(enrichPetugas(doc));
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

    const assignSummary = statDoc?.assignmentSummary;
    const rawSummary = (assignSummary && assignSummary.totalAssignment)
      ? assignSummary : (latestSnap?.summary || {});

    // Rekalkulasi FRESH setiap request — pakai WIB bukan UTC server
    const WORKING_DAYS = countWorkingDays();
    const appr  = rawSummary.approved || 0;
    const sub   = rawSummary.submit   || 0;
    const rej   = rawSummary.reject   || 0;
    const draft = rawSummary.draft    || 0;
    const dailySeries = rawSummary.dailySeries || [];
    const activeDays  = dailySeries.filter(r =>
      (r.approved||0)+(r.submitted||0)+(r.rejected||0)+(r.draft||0) > 0).length;

    const summary = {
      ...rawSummary,
      workingDays:    WORKING_DAYS,
      todayWIB:       todayWIB(),
      pendataanStart: PENDATAAN_START_STR,
      // Metrik Usaha Ditemukan (data7) — passthrough dari convert_assignment.py,
      // fallback 0 untuk snapshot lama yang belum punya field ini
      usahaAssignmentCount: rawSummary.usahaAssignmentCount || 0,
      totalUsahaDitemukan:  rawSummary.totalUsahaDitemukan  || 0,
      avgPerDay: {
        approved:  sr(appr  / WORKING_DAYS),
        submitted: sr(sub   / WORKING_DAYS),
        rejected:  sr(rej   / WORKING_DAYS),
        draft:     sr(draft / WORKING_DAYS),
        total:     sr((appr+sub+rej+draft) / WORKING_DAYS),
        workingDays: WORKING_DAYS, activeDays,
      },
      avgPerDayPencacah: {
        total: sr((appr+sub+rej+draft) / WORKING_DAYS),
        submitted: sr(sub / WORKING_DAYS), draft: sr(draft / WORKING_DAYS),
        workingDays: WORKING_DAYS,
      },
      avgPerDayPengawas: {
        total: sr((appr+rej) / WORKING_DAYS),
        approved: sr(appr / WORKING_DAYS), rejected: sr(rej / WORKING_DAYS),
        workingDays: WORKING_DAYS,
      },
    };

    // Build reverse map emailPml → namaPml dari cache (key: pml_${email})
    const pmlNameMap = new Map();
    if (petugasCache) {
      for (const [k, v] of petugasCache.entries()) {
        if (k.startsWith('pml_') && v.namaPengawas) {
          pmlNameMap.set(k.replace('pml_', ''), v.namaPengawas);
        }
      }
    }

    // Rekalkulasi per individu + enrich nama dari petugasCache (nama SOBAT resmi)
    const pencacahFixed = (pencacah || []).map(p => {
      const pS=p.submit||0, pD=p.draft||0, pA=p.approved||0, pR=p.reject||0, pT=p.total||0;
      // Lookup nama resmi dari cache — by email (paling reliable)
      const cacheByEmail = petugasCache && p.email ? petugasCache.get(p.email.toLowerCase().trim()) : null;
      const cacheByNama  = petugasCache && p.nama  ? petugasCache.get(p.nama.toLowerCase().trim())  : null;
      const cache = cacheByEmail || cacheByNama;
      return { ...p,
        // Override nama dengan nama SOBAT resmi jika ada
        nama:          cache?.namaPencacah  || p.nama,
        namaSobat:     cache?.namaPencacah  || p.nama,
        pengawas: {
          ...( p.pengawas || {} ),
          nama:  cache?.namaPengawas  || p.pengawas?.nama  || '',
          email: cache?.emailPengawas || p.pengawas?.email || '',
        },
        progressScore: pT>0 ? sr((pS+pD+pA+pR)/pT*100,1) : 0,
        // Metrik Usaha Ditemukan (data7) — auto-passthrough dari convert_assignment.py,
        // fallback 0 untuk snapshot lama yang belum punya field ini
        usahaAssignmentCount: p.usahaAssignmentCount || 0,
        totalUsahaDitemukan:  p.totalUsahaDitemukan  || 0,
        avgPerDay: { ...(p.avgPerDay||{}),
          total: sr((pS+pD+pA+pR)/WORKING_DAYS), submitted: sr(pS/WORKING_DAYS),
          draft: sr(pD/WORKING_DAYS), approved: sr(pA/WORKING_DAYS),
          rejected: sr(pR/WORKING_DAYS), workingDays: WORKING_DAYS,
        },
      };
    });
    const pengawasFixed = (pengawas || []).map(p => {
      const pA=p.approved||0, pR=p.reject||0, pT=p.total||0;
      // Lookup nama pengawas dari reverse map (by emailPml)
      const emailKey = (p.email || '').toLowerCase().trim();
      const namaFromXlsx = pmlNameMap.get(emailKey) || null;
      // Fallback: cari by email di cache langsung (jika pengawas juga terdaftar sebagai PCL)
      const cacheEntry = petugasCache ? petugasCache.get(emailKey) : null;
      return { ...p,
        nama:      namaFromXlsx || p.username || p.nama,
        namaSobat: namaFromXlsx || p.username || p.nama,
        progressScore: pT>0 ? sr((pA+pR)/pT*100,1) : 0,
        // Metrik Usaha Ditemukan (data7) — sudah agregat dari pencacah di convert_assignment.py
        usahaAssignmentCount: p.usahaAssignmentCount || 0,
        totalUsahaDitemukan:  p.totalUsahaDitemukan  || 0,
        avgPerDay: { ...(p.avgPerDay||{}),
          total: sr((pA+pR)/WORKING_DAYS), approved: sr(pA/WORKING_DAYS),
          rejected: sr(pR/WORKING_DAYS), workingDays: WORKING_DAYS,
        },
      };
    });

    res.json({
      summary,
      pencacah:  pencacahFixed,
      pengawas:  pengawasFixed,
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
      { projection: { _id: 0, email: 1, nama: 1,
          dailySeries: 1, approved: 1, submit: 1, reject: 1, draft: 1 } }
    );
    if (!doc) return res.status(404).json({ error: 'Petugas tidak ditemukan' });

    // Rekalkulasi avgPerDay DINAMIS — pakai workingDays hari ini (WIB)
    const WORKING_DAYS = countWorkingDays();
    const isPws = role === 'Pengawas';
    const appr  = doc.approved || 0;
    const sub   = doc.submit   || 0;
    const rej   = doc.reject   || 0;
    const draft = doc.draft    || 0;

    const dailySeries = doc.dailySeries || [];
    const activeDays  = dailySeries.filter(r =>
      (r.approved||0)+(r.submitted||0)+(r.rejected||0)+(r.draft||0) > 0).length;

    // Pencacah: avg = submit+draft | Pengawas: avg = approved+rejected
    const avgPerDay = {
      approved:    sr(appr  / WORKING_DAYS),
      submitted:   sr(sub   / WORKING_DAYS),
      rejected:    sr(rej   / WORKING_DAYS),
      draft:       sr(draft / WORKING_DAYS),
      total:       isPws
        ? sr((appr+rej)   / WORKING_DAYS)
        : sr((sub+draft)  / WORKING_DAYS),
      workingDays: WORKING_DAYS,
      activeDays,
      todayWIB:    todayWIB(),
    };

    res.json({ series: dailySeries, avgPerDay });
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
// Helper enrich PCL/PML untuk crosscheck — lookup by kodeSubsls (dari raw doc)
function enrichCrosscheck(entry, rawDoc) {
  if (!petugasCache) return entry;
  // Cari by kodeSubsls dari raw doc (paling akurat)
  const kode = (rawDoc && rawDoc.kodeSubsls || '').trim()
    || ((rawDoc && rawDoc.codeIdentity || '').split(' ')[0] || '').trim();
  const byKode  = kode ? petugasCache.get(kode) : null;
  // Fallback: by email pencacah jika ada
  const byEmail = (rawDoc && rawDoc.emailPencacah)
    ? petugasCache.get((rawDoc.emailPencacah || '').toLowerCase().trim()) : null;
  const info = byKode || byEmail;
  if (!info) return entry;
  return { ...entry,
    pcl: info.namaPencacah || entry.pcl || '',
    pml: info.namaPengawas || entry.pml || '',
  };
}

// type: nikKK | nikAK | rekening | tidakTahu
// Query: kec, desa, pcl, page, limit
app.get('/api/crosscheck/:type', verifyToken, async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['nikKK','nikAK','rekening','tidakTahu'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const { q = '', page = 1, limit = 10, kec = '' } = req.query;
    const pg  = Math.max(1, parseInt(page));
    const lim = Math.min(200, Math.max(1, parseInt(limit)));
    const fKec = kec.trim();

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
      if (fKec) baseMatch.kecamatan = { $regex: new RegExp('^' + fKec + '$', 'i') };
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
                      kec:'$kecamatan', desa:1, sls:1, pcl:'$petugas', status:1, kodeSubsls:1, emailPencacah:1 } },
        { $sort: { kec:1, desa:1, id:1 } },
        { $skip: (pg-1)*lim }, { $limit: lim }
      ];
      countPipeline = [{ $match: baseMatch }, { $count: 'n' }];

    } else if (type === 'nikAK') {
      // NIK anggota keluarga yang startsWith '9999'
      // Gunakan $unwind + $match untuk flatten array anggotaKeluarga di MongoDB
      const matchNikAK = { status: { $in: STATUS_DONE } };
      if (fKec) matchNikAK.kecamatan = { $regex: new RegExp('^' + fKec + '$', 'i') };
      const agg = [
        { $match: matchNikAK },
        { $unwind: { path: '$anggotaKeluarga', preserveNullAndEmptyArrays: false } },
        { $match: {
            $and: [
              { $or: [
                  { 'anggotaKeluarga.nik': /^9999/ },
                  { 'anggotaKeluarga.nik': '9999' },
                  { 'anggotaKeluarga.nik': { $regex: '^9{4}' } },
                ]
              },
              // Exclude Kepala Keluarga — sudah ditangani oleh endpoint nikKK
              { 'anggotaKeluarga.hubungan': { $not: /kepala keluarga/i } },
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
            kodeSubsls: 1, emailPencacah: 1,
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
      const pageNikAK = list.slice((pg-1)*lim, pg*lim).map(r => enrichCrosscheck(r, r));
      return res.json({ data: pageNikAK, total,
                         totalPages: Math.ceil(total/lim), page: pg });

    } else if (type === 'rekening') {
      // KK yang semua AK-nya tidak punya rekening aktif
      const matchRekening = { status: { $in: STATUS_DONE }, anggotaKeluarga: { $exists: true, $ne: [] } };
      if (fKec) matchRekening.kecamatan = { $regex: new RegExp('^' + fKec + '$', 'i') };
      const allDocs = await db.collection('isian_se2026').find(
        matchRekening,
        { projection: { id:1, namaKepala:1, noKK:1, kecamatan:1, desa:1, sls:1,
                        petugas:1, status:1, jumlahAk:1, anggotaKeluarga:1,
                        kodeSubsls:1, emailPencacah:1 } }
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
                        pcl: r.petugas, status: r.status, _rawDoc: r };
        if (!q || JSON.stringify(entry).toLowerCase().includes(q.toLowerCase())) {
          list.push(entry);
        }
      }
      list.sort((a,b) => (a.kec||'').localeCompare(b.kec||'') || (a.desa||'').localeCompare(b.desa||''));
      const total = list.length;
      const pageNikAK = list.slice((pg-1)*lim, pg*lim).map(r => enrichCrosscheck(r, r._rawDoc));
      return res.json({ data: pageNikAK, total,
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

      const matchTT = { status: { $in: STATUS_DONE } };
      if (fKec) matchTT.kecamatan = { $regex: new RegExp('^' + fKec + '$', 'i') };
      const allDocs = await db.collection('isian_se2026').find(
        matchTT,
        { projection: { id:1, namaKepala:1, noKK:1, kecamatan:1, desa:1, petugas:1,
                        status:1, anggotaKeluarga:1, usaha:1,
                        airMinum:1, penerangan:1, jenisAtap:1, jenisDinding:1,
                        jenisLantai:1, statusKepemilikan:1, tempatBAB:1, buangTinja:1,
                        kodeSubsls:1, emailPencacah:1 } }
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
          temuan, _rawDoc: r,
        };
        if (!q || JSON.stringify(entry).toLowerCase().includes(q.toLowerCase())) {
          list.push(entry);
        }
      }
      list.sort((a,b) => (a.kec||'').localeCompare(b.kec||'') || (a.desa||'').localeCompare(b.desa||''));
      const total = list.length;
      const pageNikAK = list.slice((pg-1)*lim, pg*lim).map(r => enrichCrosscheck(r, r._rawDoc));
      return res.json({ data: pageNikAK, total,
                         totalPages: Math.ceil(total/lim), page: pg });
    }

    // Untuk nikKK: jalankan pipeline aggregasi
    const [data, countResult] = await Promise.all([
      db.collection('isian_se2026').aggregate(pipeline).toArray(),
      db.collection('isian_se2026').aggregate(countPipeline).toArray(),
    ]);
    const total = countResult[0]?.n || 0;
    // Inject pml dari petugasCache
    const enrichedData = data.map(r => enrichCrosscheck(r, r));
    res.json({ data: enrichedData, total, totalPages: Math.ceil(total/lim), page: pg });

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

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[EWS SE2026 API] http://0.0.0.0:${PORT}`);
  console.log(`  Auth    : JWT (${JWT_EXPIRES})`);
  console.log(`  DB      : ${DB_NAME}`);
  console.log(`  Roles   : kepala, kasubbag, statistisi (FULL) | pengadmin (TERBATAS)`);
});

process.on('SIGINT',  async () => { if (client) await client.close(); process.exit(0); });
process.on('SIGTERM', async () => { if (client) await client.close(); process.exit(0); });

// ══════════════════════════════════════════════════════════════════════════
// GET /api/anomali — generate anomali ON-THE-FLY dari isian_se2026
// type: durasi | pendapatan | jumlahAk | kbli | all
// ══════════════════════════════════════════════════════════════════════════

function calcFence(sorted, mult) {
  mult = mult || 1.5;
  var n = sorted.length;
  if (n < 4) return { lo: 0, hi: Infinity, q1: 0, q3: 0, med: 0, mean: 0, iqr: 0 };
  var q1  = sorted[Math.floor(n / 4)];
  var med = sorted[Math.floor(n / 2)];
  var q3  = sorted[Math.floor(3 * n / 4)];
  var iqr = q3 - q1;
  var mean = sorted.reduce(function(a,b){ return a+b; }, 0) / n;
  return { q1: q1, med: med, q3: q3, iqr: iqr, mean: mean,
           lo: Math.max(0, q1 - mult * iqr), hi: q3 + mult * iqr };
}

function fmtCurrency(v) {
  if (v >= 1e9) return 'Rp ' + (v/1e9).toFixed(1) + ' M';
  if (v >= 1e6) return 'Rp ' + (v/1e6).toFixed(0) + ' jt';
  return 'Rp ' + (v/1e3).toFixed(0) + ' rb';
}

app.get('/api/anomali', verifyToken, requireFullAccess, async function(req, res) {
  try {
    var type     = req.query.type  || 'all';
    var fKec     = (req.query.kec  || '').trim();
    var pg       = Math.max(1, parseInt(req.query.page  || '1'));
    var lim      = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
    var STATUS_DONE = ['SUBMITTED','APPROVED','REJECTED'];

    var baseMatch = { status: { $in: STATUS_DONE } };
    if (fKec) baseMatch.kecamatan = { $regex: new RegExp('^' + fKec + '$', 'i') };

    var docs = await db.collection('isian_se2026').find(baseMatch, {
      projection: {
        _id:0, id:1, no:1, namaKepala:1, kecamatan:1, desa:1,
        petugas:1, status:1, mulai:1, selesai:1, durMenit:1,
        jumlahAk:1, jumlahUsaha:1, namaUsaha:1, kbli:1,
        nilaiPendapatanRaw:1, usaha:1,
      }
    }).toArray();

    var results = [];

    // 1. DURASI — anomali = TERLALU SINGKAT (outlier bawah)
    if (type === 'all' || type === 'durasi') {
      var durs = docs.map(function(r){ return r.durMenit; })
                     .filter(function(d){ return d != null && d > 0; })
                     .sort(function(a,b){ return a-b; });
      var fDur = calcFence(durs);
      var CRIT_DUR = 2;
      docs.forEach(function(r) {
        var dur = r.durMenit;
        if (!dur || dur <= 0) return;
        var sev = null;
        if (dur <= CRIT_DUR) sev = 'crit';
        else if (fDur.lo > CRIT_DUR && dur < fDur.lo) sev = 'warn';
        if (!sev) return;
        results.push({
          id: r.id, no: r.no, namaKepala: r.namaKepala,
          kecamatan: r.kecamatan, desa: r.desa,
          petugas: r.petugas, status: r.status,
          type: 'durasi', sev: sev, nilai: dur,
          label: 'Durasi ' + dur + ' mnt (terlalu singkat)',
          fenceLo: Math.round(fDur.lo), q1: fDur.q1, med: fDur.med, q3: fDur.q3,
        });
      });
    }

    // 2. PENDAPATAN — anomali = TERLALU TINGGI (outlier atas)
    if (type === 'all' || type === 'pendapatan') {
      var pends = docs.map(function(r){ return r.nilaiPendapatanRaw || 0; })
                      .filter(function(v){ return v > 0; })
                      .sort(function(a,b){ return a-b; });
      var fPend = calcFence(pends);
      var CRIT_PEND = 500000000;
      docs.forEach(function(r) {
        var val = r.nilaiPendapatanRaw || 0;
        if (!val) return;
        var sev = null;
        if (val > CRIT_PEND) sev = 'crit';
        else if (val > fPend.hi) sev = 'warn';
        if (!sev) return;
        results.push({
          id: r.id, no: r.no, namaKepala: r.namaKepala,
          kecamatan: r.kecamatan, desa: r.desa,
          petugas: r.petugas, status: r.status,
          type: 'pendapatan', sev: sev, nilai: val,
          label: 'Pendapatan ' + fmtCurrency(val) + ' (outlier atas)',
          namaUsaha: r.namaUsaha || '—',
        });
      });
    }

    // 3. JUMLAH AK — anomali = terlalu banyak
    if (type === 'all' || type === 'jumlahAk') {
      var aks = docs.map(function(r){ return parseInt(r.jumlahAk)||0; })
                    .filter(function(v){ return v > 0; })
                    .sort(function(a,b){ return a-b; });
      var fAk = calcFence(aks);
      var CRIT_AK = 15;
      docs.forEach(function(r) {
        var val = parseInt(r.jumlahAk) || 0;
        if (!val) return;
        var sev = null;
        if (val >= CRIT_AK) sev = 'crit';
        else if (val > fAk.hi) sev = 'warn';
        if (!sev) return;
        results.push({
          id: r.id, no: r.no, namaKepala: r.namaKepala,
          kecamatan: r.kecamatan, desa: r.desa,
          petugas: r.petugas, status: r.status,
          type: 'jumlahAk', sev: sev, nilai: val,
          label: val + ' anggota keluarga',
        });
      });
    }

    // 4. KBLI KOSONG
    if (type === 'all' || type === 'kbli') {
      docs.forEach(function(r) {
        var noKbli = (r.usaha || []).filter(function(u){
          return u.namaUsaha && u.namaUsaha !== '—' && !u.kbli;
        });
        if (!noKbli.length) return;
        results.push({
          id: r.id, no: r.no, namaKepala: r.namaKepala,
          kecamatan: r.kecamatan, desa: r.desa,
          petugas: r.petugas, status: r.status,
          type: 'kbli', sev: 'crit', nilai: noKbli.length,
          label: noKbli.length + ' usaha tanpa KBLI',
          usaha: noKbli.map(function(u){ return u.namaUsaha; }).join(', '),
        });
      });
    }

    results.sort(function(a,b) {
      if (a.sev !== b.sev) return a.sev === 'crit' ? -1 : 1;
      return b.nilai - a.nilai;
    });

    var total = results.length;
    var byType = {};
    results.forEach(function(r){ byType[r.type] = (byType[r.type]||0)+1; });

    res.json({
      total: total,
      nCrit: results.filter(function(r){ return r.sev==='crit'; }).length,
      nWarn: results.filter(function(r){ return r.sev==='warn'; }).length,
      byType: byType,
      totalPages: Math.ceil(total/lim),
      page: pg,
      data: results.slice((pg-1)*lim, pg*lim),
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/anomali/boxplot ──────────────────────────────────────────────
// Distribusi durasi untuk boxplot — outlier = terlalu CEPAT (bawah)
app.get('/api/anomali/boxplot', verifyToken, async function(req, res) {
  try {
    var fKec = (req.query.kec || '').trim();
    var STATUS_DONE = ['SUBMITTED','APPROVED','REJECTED'];
    var match = { status: { $in: STATUS_DONE }, durMenit: { $gt: 0 } };
    if (fKec) match.kecamatan = { $regex: new RegExp('^' + fKec + '$', 'i') };

    var docs = await db.collection('isian_se2026')
      .find(match, { projection: {
        _id:0, id:1, no:1, namaKepala:1, kecamatan:1, desa:1,
        petugas:1, status:1, durMenit:1, fasihUrl:1,
      }}).toArray();

    var sorted = docs.map(function(d){ return d.durMenit; })
                     .sort(function(a,b){ return a-b; });
    var n = sorted.length;
    if (!n) return res.json({ stats: null, points: [] });

    var fence  = calcFence(sorted);
    var CRIT_MAX = 2;

    var points = docs.map(function(r) {
      var anomaly = null;
      if (r.durMenit <= CRIT_MAX) anomaly = 'crit';
      else if (fence.lo > CRIT_MAX && r.durMenit < fence.lo) anomaly = 'warn';
      return {
        id: r.id, no: r.no, namaKepala: r.namaKepala,
        kecamatan: r.kecamatan, desa: r.desa,
        petugas: r.petugas, status: r.status,
        nilai: r.durMenit, anomaly: anomaly,
        fasihUrl: r.fasihUrl || '',
      };
    });

    res.json({
      stats: {
        n: n, min: sorted[0], q1: fence.q1,
        median: fence.med, q3: fence.q3, max: sorted[n-1],
        mean: Math.round(fence.mean), iqr: fence.iqr,
        fenceLo: Math.round(fence.lo),
        fenceHi: Math.round(fence.hi),
        critMax: CRIT_MAX,
        nCrit: points.filter(function(p){ return p.anomaly==='crit'; }).length,
        nWarn: points.filter(function(p){ return p.anomaly==='warn'; }).length,
      },
      points: points,
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/anomali/detail — Daftar anomali SE2026-L per responden (on-the-fly)
// ══════════════════════════════════════════════════════════════════════════

function parseNum(v) {
  if (v == null || v === '' || v === 'None' || v === 'nan') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v).trim()
    .replace(/m²|m2|%/g, '')
    .replace(/^Rp\s*/i, '')
    .replace(/\s/g, '');
  var jtMatch = s.match(/^([\d.]+)\s*jt$/i);
  if (jtMatch) return parseFloat(jtMatch[1]) * 1000000;
  var rbMatch = s.match(/^([\d.]+)\s*rb$/i);
  if (rbMatch) return parseFloat(rbMatch[1]) * 1000;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    var parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
  }
  return parseFloat(s) || 0;
}
function is9999(v) { return v === 9999 || v === '9999' || String(v).trim() === '9999'; }

function kbliToKategori(kbli) {
  if (!kbli) return '';
  var n = parseInt(String(kbli).slice(0,2), 10);
  if (isNaN(n)) return '';
  var ranges = [
    [1,3,'A'],[5,9,'B'],[10,33,'C'],[35,35,'D'],[36,39,'E'],
    [41,43,'F'],[45,47,'G'],[49,53,'H'],[55,56,'I'],[58,63,'J'],
    [64,66,'K'],[68,68,'L'],[69,75,'M'],[77,82,'N'],[84,84,'O'],
    [85,85,'P'],[86,88,'Q'],[90,93,'R'],[94,96,'S'],[97,98,'T'],[99,99,'U'],
  ];
  for (var i=0;i<ranges.length;i++) {
    if (n >= ranges[i][0] && n <= ranges[i][1]) return ranges[i][2];
  }
  return '';
}

function checkAnomaliUsaha(r) {
  const flags = [];
  const usahaList = r.usaha || [];
  if (!usahaList.length) return flags;

  for (const u of usahaList) {
    const nama      = u.namaUsaha || '—';
    const skala     = (u.skalaUsaha || '').toUpperCase();
    const kbliAkhir = (u.kbli || '').slice(0,2);
    const kbliSbr   = (u.kbliSbr || '').slice(0,2);
    const badan     = (u.badanUsaha  || '').toLowerCase();
    const internet  = (u.internet    || '').toLowerCase();
    const lapKeu    = (u.lapKeuangan || '').toLowerCase();
    const peranMBG  = (u.peranMBG || u.mitraKdkmp || '').toLowerCase();

    const gaji       = parseNum(u.gaji);
    const biayaProd  = parseNum(u.biayaProduksi);
    const operasional= parseNum(u.operasional);
    const nonOp      = parseNum(u.nonOperasional);
    const totKeluar  = parseNum(u.totalPengeluaranRaw) || parseNum(u.totalPengeluaran);
    const totPend    = parseNum(u.nilaiPendapatanRaw)  || parseNum(u.nilaiPendapatan);
    const totAset    = parseNum(u.totalAset) || parseNum(u.asetUsaha);
    const tk         = parseInt(u.totalTK || '0') || 0;
    const korPubik   = parseNum(u.modalKorPublik);

    // A1: Biaya Produksi Dominan — biaya_produksi > 50% total pengeluaran (R26b/R30b)
    if (totKeluar > 0 && biayaProd > 0 && biayaProd / totKeluar > 0.5) {
      flags.push({ code:'A1', usaha: nama,
        ket: `Biaya produksi ${Math.round(biayaProd/totKeluar*100)}% dari total pengeluaran (R26b/R30b) — periksa R13.a dan R13.b1` });
    }

    // A2: Keuntungan Usaha Negatif — R27c/R31c < R26f/R30f
    if (totPend > 0 && totKeluar > 0 && totPend < totKeluar) {
      flags.push({ code:'A2', usaha: nama,
        ket: `Pengeluaran Rp ${(totKeluar/1e6).toFixed(1)} jt > Pendapatan Rp ${(totPend/1e6).toFixed(1)} jt — pastikan R27 lebih besar dari R26` });
    }

    // A3: Penyertaan Modal Korporasi — R11a=13 tapi R29c/R29d/R33c/R33d > 0
    const isBukanBU    = badan.includes('bukan badan') || badan.includes('13.');
    const korNonPubik  = parseNum(u.modalKorNonPublik);
    const korPubDirikan= parseNum(u.modalKorPublikDidirikan);
    const korNonDirikan= parseNum(u.modalKorNonPublikDidirikan);
    if (isBukanBU && (korPubik>0 || korNonPubik>0 || korPubDirikan>0 || korNonDirikan>0)) {
      const det = [
        korPubik>0      ? `R29c=${korPubik}%`      : '',
        korNonPubik>0   ? `R29d=${korNonPubik}%`   : '',
        korPubDirikan>0 ? `R33c=${korPubDirikan}%`  : '',
        korNonDirikan>0 ? `R33d=${korNonDirikan}%`  : '',
      ].filter(Boolean).join(', ');
      flags.push({ code:'A3', usaha: nama,
        ket: `Bukan badan usaha (R11a=13) tapi ada penyertaan korporasi: ${det}` });
    }

    // A4: Data Keuangan MBG — SPPG/supplier dengan rasio tidak wajar
    const isMBG = peranMBG.includes('sppg') || peranMBG.includes('supplier') ||
                  peranMBG.includes('1.') || peranMBG.includes('2.');
    if (isMBG && totPend > 0 && totKeluar > 0) {
      const rasioMBG = totPend / totKeluar;
      if (rasioMBG > 10 || rasioMBG < 0.1) {
        flags.push({ code:'A4', usaha: nama,
          ket: `MBG (${u.peranMBG||u.mitraKdkmp}): rasio pendapatan/pengeluaran ${rasioMBG.toFixed(1)}x tidak wajar — pastikan memang SPPG` });
      }
    }

    // A5: Hubungan Aset, Pekerja, Produksi — inkonsistensi signifikan
    if (totPend > 5e8 && tk === 0 && totAset === 0) {
      flags.push({ code:'A5', usaha: nama,
        ket: `Pendapatan Rp ${(totPend/1e6).toFixed(0)} jt tapi TK=0 dan Aset=Rp 0 — periksa R24, R28/R32` });
    }
    if (tk > 50 && totPend > 0 && totPend / tk < 500000) {
      flags.push({ code:'A5', usaha: nama,
        ket: `TK ${tk} orang tapi pendapatan/TK hanya Rp ${(totPend/tk/1e3).toFixed(0)} rb — tidak proporsional` });
    }

    // A6: Internet Usaha Menengah & Besar — R16a=2 (Tidak) untuk UMB
    const isUMB = skala.includes('UMB') || skala.includes('MENENGAH') || skala.includes('BESAR');
    if (isUMB && (internet.includes('2.') || internet === 'tidak' || internet === '2')) {
      flags.push({ code:'A6', usaha: nama,
        ket: `Skala ${u.skalaUsaha} tapi tidak menggunakan internet (R16a=Tidak)` });
    }

    // A7: Laporan Keuangan UMB — R11d=2 (Tidak) untuk skala menengah/besar
    if (isUMB && (lapKeu.includes('2.') || lapKeu === 'tidak' || lapKeu === '2')) {
      flags.push({ code:'A7', usaha: nama,
        ket: `Skala ${u.skalaUsaha} tapi tidak punya laporan/catatan keuangan (R11d=Tidak)` });
    }

    // A8: Perbedaan Kategori — konversi KBLI ke huruf kategori A-V, bandingkan
    const katAkhir = (u.kategori || '').toUpperCase().trim();
    const katSbr   = kbliToKategori(u.kbliSbr || '');
    if (katAkhir && katSbr && katAkhir !== katSbr) {
      flags.push({ code:'A8', usaha: nama,
        ket: `Kategori pendataan ${katAkhir} (KBLI ${u.kbli||'—'}) vs SBR ${katSbr} (KBLI ${u.kbliSbr}) — verifikasi R13.g` });
    }
  }
  return flags;
}

function checkAnomaliKeluarga(r) {
  const flags = [];
  const anggota  = r.anggotaKeluarga || [];
  const jumlahAk = parseInt(r.jumlahAk || r.jumlahAkKK || '0') || 0;
  const luasLantai = parseNum(r.luasLantai);
  const luasPerKap = jumlahAk > 0 ? luasLantai / jumlahAk : 0;
  const aset = r.asetRumahTangga || {};

  const totalPendKlrg = parseNum(r.totalPendapatanKeluarga) || parseNum(r.pendapatanKeluarga) || parseNum(r.totalPendapatan);
  const totalPengKlrg = parseNum(r.pengeluaranKeluarga) || parseNum(r.totalPengeluaranKeluarga);
  const pungListrik   = parseNum(r.pengeluaranListrik) || parseNum(aset.listrikSebulan);
  const statusKep     = (r.statusKepemilikan || '').toLowerCase();
  const penerangan    = (r.penerangan || r.sumberPenerangan || '').toLowerCase();

  const kepKep   = anggota.find(a => (a.hubungan||'').toLowerCase().includes('kepala')) || {};
  const pasangan = anggota.find(a => {
    const h = (a.hubungan||'').toLowerCase();
    return h.includes('istri') || h.includes('suami') || h.includes('pasangan');
  });

  // K1: Status Cerai / Belum Kawin — KK cerai/belum kawin tapi ada pasangan
  const kawKep = (kepKep.statusKawin || '').toLowerCase();
  if (pasangan && (kawKep.includes('cerai') || kawKep.includes('belum'))) {
    flags.push({ code:'K1',
      ket: `KK "${kepKep.statusKawin}" tapi ada ${pasangan.hubungan} (${pasangan.nama}) — periksa status perkawinan` });
  }

  // K2: KK < 10 Th di Rumah Sendiri
  const umurKep = parseInt(kepKep.umur || '99') || 99;
  if (umurKep < 10 && statusKep.includes('milik')) {
    flags.push({ code:'K2',
      ket: `Umur KK ${umurKep} tahun tapi tinggal di rumah milik sendiri — periksa data kepala keluarga` });
  }

  // K4: Luas Lantai Ekstrem — < 3 m²/kapita atau > 200 m²/kapita
  if (jumlahAk > 0 && luasLantai > 0) {
    if (luasPerKap < 3) {
      flags.push({ code:'K4',
        ket: `Luas/kapita ${luasPerKap.toFixed(1)} m² (${luasLantai} m², ${jumlahAk} AK) — terlalu sempit (< 3 m²/kapita)` });
    } else if (luasPerKap > 200) {
      flags.push({ code:'K4',
        ket: `Luas/kapita ${luasPerKap.toFixed(1)} m² (${luasLantai} m², ${jumlahAk} AK) — sangat besar (> 200 m²/kapita)` });
    }
  }

  // K5: Selisih Pendapatan Negatif — pengeluaran > pendapatan keluarga
  if (totalPendKlrg > 0 && totalPengKlrg > 0 && totalPendKlrg < totalPengKlrg) {
    flags.push({ code:'K5',
      ket: `Pengeluaran Rp ${(totalPengKlrg/1e6).toFixed(1)} jt > Pendapatan Rp ${(totalPendKlrg/1e6).toFixed(1)} jt (defisit Rp ${((totalPengKlrg-totalPendKlrg)/1e6).toFixed(1)} jt)` });
  }

  // K6: Listrik Rendah & Ada Barang Mewah — R15a < 100.000 tapi punya kulkas/AC/laptop
  const punyaMewah   = (aset.kulkas > 0 || aset.ac > 0 || aset.laptop > 0);
  const listrikRendah= pungListrik > 0 && pungListrik < 100000;
  const listrikNonPLN= penerangan.includes('non-pln') || penerangan.includes('bukan listrik') || penerangan.includes('3.');
  if (punyaMewah && (listrikRendah || listrikNonPLN)) {
    const detail = [
      aset.kulkas > 0 ? `kulkas(${aset.kulkas})` : '',
      aset.ac > 0     ? `AC(${aset.ac})`         : '',
      aset.laptop > 0 ? `laptop(${aset.laptop})`  : '',
    ].filter(Boolean).join(', ');
    flags.push({ code:'K6',
      ket: `Punya ${detail} tapi listrik Rp ${(pungListrik/1e3).toFixed(0)} rb/bln${listrikNonPLN?' (Non-PLN/Bukan listrik)':''} — pastikan memang memiliki aset tersebut` });
  }

  // K7: Jumlah AK Ekstrem — > 10 orang
  if (jumlahAk > 10) {
    flags.push({ code:'K7', ket: `Jumlah AK ${jumlahAk} orang (> 10) — periksa isian Blok III` });
  }
  return flags;
}

function checkMissingValue(r) {
  const flags = [];
  const usahaList = r.usaha || [];
  for (const u of usahaList) {
    const nama = u.namaUsaha || '—';
    // M1: R27a/R31a atau R27b/R31b = 9999
    if (is9999(u.nilaiPendapatanRaw) || is9999(u.pendapatanLain)) {
      flags.push({ code:'M1', usaha: nama,
        ket: 'Rincian pendapatan (R27a/R31a atau R27b/R31b) = 9999 — tidak dapat memberikan informasi' });
    }
    // M2: R26a/R30a, R26b/R30b, R26c/R30c, R26d/R30d, atau R26e/R30e = 9999
    const fieldKeluar = [
      { key:'gaji', label:'gaji (R26a/R30a)' },
      { key:'biayaProduksi', label:'biaya produksi (R26b/R30b)' },
      { key:'operasional', label:'operasional (R26d/R30d)' },
      { key:'nonOperasional', label:'non-operasional (R26e/R30e)' },
    ];
    for (const f of fieldKeluar) {
      if (is9999(u[f.key])) {
        flags.push({ code:'M2', usaha: nama, ket: `Missing ${f.label} = 9999` });
        break; // satu flag per usaha
      }
    }
    // M4: R28a/R32a atau R28b/R32b = 9999
    if (is9999(u.asetTanah) || is9999(u.asetLain) || is9999(u.totalAset)) {
      flags.push({ code:'M4', usaha: nama,
        ket: 'Nilai aset (R28a/R32a atau R28b/R32b) = 9999 — tidak dapat memberikan informasi' });
    }
  }
  return flags;
}

const ANOMALI_DEF_USAHA  = { A1:'Biaya Produksi Dominan', A2:'Keuntungan Usaha Negatif',
  A3:'Penyertaan Modal Korporasi', A4:'Data Keuangan MBG',
  A5:'Hubungan Aset, Pekerja & Produksi', A6:'Internet Usaha Menengah & Besar',
  A7:'Laporan Keuangan UMB', A8:'Perbedaan KBLI 2 Digit' };
const ANOMALI_DEF_KLRG   = { K1:'Status Cerai/Belum Kawin', K2:'KK < 10 Th di Rumah Sendiri',
  K3:'Semua AK Disabilitas', K4:'Luas Lantai Ekstrem',
  K5:'Selisih Pendapatan Negatif', K6:'Listrik Rendah & Ada Barang Mewah',
  K7:'Jumlah AK Ekstrem' };
const ANOMALI_DEF_MISSING = { M1:'Missing Pendapatan', M2:'Missing Pengeluaran', M4:'Missing Nilai Aset Tetap' };

// ══════════════════════════════════════════════════════════════════════════
// Cache in-memory untuk hasil anomali — hindari hitung ulang setiap request
// TTL 3 menit: cukup fresh untuk monitoring real-time, tapi hindari beban
// hitung ulang saat banyak user buka halaman Anomali bersamaan
// ══════════════════════════════════════════════════════════════════════════
const ANOMALI_CACHE_TTL_MS = 3 * 60 * 1000; // 3 menit
const anomaliCache = new Map(); // key: `${tab}|${kec}` -> { data, computedAt }

function getCacheKey(tab, kec) {
  return `${tab}|${(kec || '').toLowerCase()}`;
}

async function computeAnomaliForTab(tab, fKec) {
  const VALID_STATUS = ['SUBMITTED','APPROVED','REJECTED'];
  const match = { status: { $in: VALID_STATUS } };
  if (fKec) match.kecamatan = { $regex: new RegExp('^' + fKec + '$', 'i') };

  const baseFields = {
    _id:0, id:1, no:1, namaKepala:1, kecamatan:1, desa:1, sls:1,
    petugas:1, status:1, fasihUrl:1, assignmentId:1,
  };
  const projection = tab === 'keluarga'
    ? { ...baseFields, anggotaKeluarga:1, jumlahAk:1, jumlahAkKK:1, luasLantai:1,
        totalPendapatanKeluarga:1, pendapatanKeluarga:1, pengeluaranKeluarga:1,
        pengeluaranListrik:1, statusKepemilikan:1, asetRumahTangga:1,
        penerangan:1, sumberPenerangan:1 }
    : { ...baseFields, usaha:1 };

  const docs = await db.collection('isian_se2026').find(match, { projection }).toArray();

  const results = [];
  for (const r of docs) {
    const flags = tab === 'usaha' ? checkAnomaliUsaha(r)
               : tab === 'keluarga' ? checkAnomaliKeluarga(r)
               : checkMissingValue(r);
    if (!flags.length) continue;
    results.push({
      id: r.id, no: r.no, namaKepala: r.namaKepala,
      kecamatan: r.kecamatan, desa: r.desa, sls: r.sls,
      petugas: r.petugas, status: r.status, flags,
      fasihUrl: r.fasihUrl || '', assignmentId: r.assignmentId || '',
      // simpan kategori/kbli usaha untuk filter kategori tanpa re-scan
      _usahaKatKbli: tab === 'usaha'
        ? (r.usaha || []).map(u => ({ kategori: (u.kategori||'').toUpperCase(), kbli: (u.kbli||'').toUpperCase() }))
        : undefined,
    });
  }
  return results;
}

async function getCachedAnomali(tab, fKec) {
  const key = getCacheKey(tab, fKec);
  const cached = anomaliCache.get(key);
  const now = Date.now();
  if (cached && (now - cached.computedAt) < ANOMALI_CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await computeAnomaliForTab(tab, fKec);
  anomaliCache.set(key, { data, computedAt: now });
  return data;
}

// Bersihkan cache setiap upload baru via endpoint ini (opsional, panggil manual jika perlu)
app.post('/api/anomali/cache/clear', verifyToken, requireFullAccess, async function(req, res) {
  anomaliCache.clear();
  res.json({ ok: true, message: 'Cache anomali dibersihkan' });
});

app.get('/api/anomali/detail', verifyToken, requireFullAccess, async function(req, res) {
  try {
    const tab      = req.query.tab      || 'usaha';
    const codes    = req.query.codes    ? req.query.codes.split(',').map(s=>s.trim()).filter(Boolean) : [];
    const fKec     = (req.query.kec     || '').trim();
    const fKategori= req.query.kategori
      ? req.query.kategori.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean)
      : [];
    const fStatus = (req.query.status || '').trim().toUpperCase();
    const pg    = Math.max(1, parseInt(req.query.page  || '1'));
    const lim   = Math.min(100, Math.max(1, parseInt(req.query.limit || '25')));

    // Ambil dari cache (atau hitung jika cache expired/kosong)
    // Catatan: cache tidak terpisah per status karena status difilter di-memory
    // dari hasil cache (lebih murah daripada query ulang ke MongoDB)
    let results = await getCachedAnomali(tab, fKec);

    // Filter status (in-memory, dari hasil cache)
    if (fStatus && ['SUBMITTED','APPROVED','REJECTED'].includes(fStatus)) {
      results = results.filter(r => r.status === fStatus);
    }

    // Filter kategori KBLI (in-memory)
    if (tab === 'usaha' && fKategori.length > 0) {
      results = results.filter(r => {
        const usahaKat = r._usahaKatKbli || [];
        return usahaKat.some(u => fKategori.some(k => u.kategori === k || u.kbli.startsWith(k)));
      });
    }

    // Filter codes (in-memory)
    if (codes.length) {
      results = results
        .map(r => ({ ...r, flags: r.flags.filter(f => codes.includes(f.code)) }))
        .filter(r => r.flags.length > 0);
    }

    results = [...results].sort((a,b) => b.flags.length - a.flags.length);

    const summary = {};
    for (const r of results)
      for (const f of r.flags)
        summary[f.code] = (summary[f.code]||0) + 1;

    const total = results.length;
    const pageData = results.slice((pg-1)*lim, pg*lim)
      .map(({ _usahaKatKbli, ...rest }) => rest); // buang field internal

    res.json({
      total, summary,
      definitions: tab==='usaha' ? ANOMALI_DEF_USAHA : tab==='keluarga' ? ANOMALI_DEF_KLRG : ANOMALI_DEF_MISSING,
      totalPages: Math.ceil(total/lim),
      page: pg,
      data: pageData,
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/anomali/summary — total RESPONDEN (bukan kasus) per tab ──────
// Dipakai untuk badge angka di tab Anomali Usaha/Keluarga/Missing Value
app.get('/api/anomali/summary', verifyToken, requireFullAccess, async function(req, res) {
  try {
    const fKec      = (req.query.kec      || '').trim();
    const fStatus   = (req.query.status   || '').trim().toUpperCase();
    const fKategori = req.query.kategori
      ? req.query.kategori.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean) : [];
    const codes     = req.query.codes
      ? req.query.codes.split(',').map(s=>s.trim()).filter(Boolean) : [];

    // Ambil data dari cache untuk ketiga tab sekaligus
    const [usahaRaw, keluargaRaw, missingRaw] = await Promise.all([
      getCachedAnomali('usaha',    fKec),
      getCachedAnomali('keluarga', fKec),
      getCachedAnomali('missing',  fKec),
    ]);

    // Fungsi filter in-memory — sama persis dengan logika di /api/anomali/detail
    function applyFilters(results, tab) {
      let r = results;
      if (fStatus && ['SUBMITTED','APPROVED','REJECTED'].includes(fStatus))
        r = r.filter(x => x.status === fStatus);
      if (tab === 'usaha' && fKategori.length > 0)
        r = r.filter(x => (x._usahaKatKbli||[]).some(u => fKategori.some(k => u.kategori===k || u.kbli.startsWith(k))));
      if (codes.length)
        r = r.map(x => ({ ...x, flags: x.flags.filter(f => codes.includes(f.code)) }))
             .filter(x => x.flags.length > 0);
      return r;
    }

    res.json({
      usaha:    applyFilters(usahaRaw,    'usaha').length,
      keluarga: applyFilters(keluargaRaw, 'keluarga').length,
      missing:  applyFilters(missingRaw,  'missing').length,
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});
