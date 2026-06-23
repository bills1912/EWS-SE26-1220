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
      // AK dengan statusKerja 'Tidak Tahu'
      const allDocs = await db.collection('isian_se2026').find(
        { status: { $in: STATUS_DONE }, 'anggotaKeluarga.statusKerja': 'Tidak Tahu' },
        { projection: { id:1, namaKepala:1, kecamatan:1, desa:1, petugas:1, status:1, anggotaKeluarga:1 } }
      ).toArray();

      let list = [];
      for (const r of allDocs) {
        for (const ak of (r.anggotaKeluarga || [])) {
          if (ak.statusKerja === 'Tidak Tahu') {
            const entry = { id: r.id, namaKK: r.namaKepala, namaAK: ak.nama,
                            hubungan: ak.hubungan, umur: ak.umur,
                            kec: r.kecamatan, desa: r.desa, pcl: r.petugas, status: r.status };
            if (!q || JSON.stringify(entry).toLowerCase().includes(q.toLowerCase())) {
              list.push(entry);
            }
          }
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

// ── GET /api/debug/nikak ─────────────────────────────────────────────────
// Debug endpoint: cek struktur anggotaKeluarga di MongoDB
app.get('/api/debug/nikak', verifyToken, async (req, res) => {
  try {
    // Total docs
    const total = await db.collection('isian_se2026').countDocuments({});

    // Cek apakah anggotaKeluarga ada di MongoDB
    const sampleNoAK = await db.collection('isian_se2026').findOne(
      { anggotaKeluarga: { $exists: false } }, { projection: { id:1 } }
    );
    const sampleWithAK = await db.collection('isian_se2026').findOne(
      { anggotaKeluarga: { $exists: true, $not: { $size: 0 } } },
      { projection: { id:1, 'anggotaKeluarga': { $slice: 1 } } }
    );

    // Hitung docs dengan anggotaKeluarga
    const withAK   = await db.collection('isian_se2026').countDocuments(
      { anggotaKeluarga: { $exists: true, $not: { $size: 0 } } }
    );

    // Cari NIK 9999 dengan berbagai cara
    const byRegex  = await db.collection('isian_se2026').countDocuments(
      { 'anggotaKeluarga.nik': { $regex: '^9999' } }
    );
    const byExact  = await db.collection('isian_se2026').countDocuments(
      { 'anggotaKeluarga.nik': '9999' }
    );

    // Sample AK fields dari doc pertama yang punya AK
    const akSample = sampleWithAK?.anggotaKeluarga?.[0] || null;
    const akFields = akSample ? Object.keys(akSample) : [];

    res.json({
      total_docs: total,
      docs_with_ak: withAK,
      docs_without_ak_field: sampleNoAK ? 'ADA (field anggotaKeluarga tidak tersimpan di semua doc)' : 'TIDAK ADA (semua doc punya field)',
      sample_ak_fields: akFields,
      sample_ak_nik: akSample?.nik,
      query_regex_9999: byRegex,
      query_exact_9999: byExact,
      verdict: byRegex > 0 ? 'DATA ADA di MongoDB' : 
               withAK  > 0 ? 'Field ada tapi NIK 9999 tidak ketemu' :
                              'anggotaKeluarga TIDAK TERSIMPAN di MongoDB',
    });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack }); }
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
