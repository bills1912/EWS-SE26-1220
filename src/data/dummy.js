export const SUMMARY = {
  total: 3847,
  submitted: 2914,
  approved: 712,
  rejected: 221,
  usaha: 1243,
  kbliMissing: 618,
  anomali: 9,
  kecamatan: 12,
  lastUpdate: '21 Jun 2026 · 14:32 WIB',
};

export const PACE = [
  { kec: 'Padang Bolak',          n: 387, target: 450, pct: 86, trend: 'up',   status: 'ok'   },
  { kec: 'Portibi',               n: 362, target: 400, pct: 90, trend: 'up',   status: 'ok'   },
  { kec: 'Simangambat',           n: 321, target: 380, pct: 84, trend: 'up',   status: 'ok'   },
  { kec: 'Halongonan',            n: 278, target: 350, pct: 79, trend: 'flat', status: 'warn' },
  { kec: 'Dolok',                 n: 241, target: 300, pct: 80, trend: 'up',   status: 'ok'   },
  { kec: 'Dolok Sigompulon',      n: 189, target: 280, pct: 67, trend: 'down', status: 'warn' },
  { kec: 'Batang Onang',          n: 162, target: 250, pct: 65, trend: 'down', status: 'warn' },
  { kec: 'Halongonan Timur',      n: 148, target: 240, pct: 62, trend: 'down', status: 'warn' },
  { kec: 'Padang Bolak Julu',     n: 134, target: 220, pct: 61, trend: 'down', status: 'crit' },
  { kec: 'Ujung Batu',            n: 118, target: 210, pct: 56, trend: 'down', status: 'crit' },
  { kec: 'Padang Bolak Tenggara', n:  92, target: 180, pct: 51, trend: 'down', status: 'crit' },
  { kec: 'Hulu Sihapas',          n:  79, target: 160, pct: 49, trend: 'down', status: 'crit' },
];

export const ANOMALI = [
  { id:1, sev:'crit', category:'Durasi Anomali',   petugas:'Hendri Siregar',   kec:'Portibi',          title:'247 entri selesai rata-rata 0,9 menit',          detail:'Jauh di bawah threshold minimum 5 menit per kuesioner. Indikasi kuat pengisian tidak valid. Perlu klarifikasi langsung ke petugas dan review manual sample.', ts:'2 jam lalu' },
  { id:2, sev:'crit', category:'KBLI Kosong',       petugas:'Sistem',           kec:'Semua kecamatan',  title:'618 usaha tanpa kode KBLI',                       detail:'Nama usaha terisi tetapi kolom kbli_akhir kosong. Tidak bisa diklasifikasi untuk agregasi nasional SE2026. Prioritas perbaikan tertinggi.', ts:'1 jam lalu' },
  { id:3, sev:'crit', category:'Rejection Spike',   petugas:'PML Padang Bolak', kec:'Padang Bolak',     title:'Tingkat rejection 22,4% — 3× rata-rata nasional', detail:'Dari 387 records di Padang Bolak, 87 di-reject pengawas. Kemungkinan gap SOP antara PCL dan PML. Perlu supervisi lapangan segera.', ts:'3 jam lalu' },
  { id:4, sev:'warn', category:'Outlier Pendapatan',petugas:'Zainal Bakti H.',  kec:'Batang Onang',     title:'4 record pendapatan usaha >Rp 1M/bulan',          detail:'Nilai tertinggi Rp 6,3 miliar. Kemungkinan salah satuan — tahunan diinput di kolom bulanan. Perlu konfirmasi ulang ke PCL.', ts:'4 jam lalu' },
  { id:5, sev:'warn', category:'PCL Tidak Aktif',   petugas:'Asrin Nasution',   kec:'Hulu Sihapas',     title:'Tidak ada pendataan sejak 2 hari lalu',           detail:'Target harian 8 records tidak tercapai selama 2 hari berturut-turut. Perlu konfirmasi kondisi lapangan dan backup PCL jika diperlukan.', ts:'18 jam lalu' },
  { id:6, sev:'warn', category:'Domisili Mismatch', petugas:'Ria Asnita',       kec:'Halongonan Timur', title:'34 responden tidak sesuai KK',                    detail:'Kolom domisili terisi "Tidak Sesuai KK" pada 34 records. Perlu cross-check dengan data kependudukan Disdukcapil setempat.', ts:'5 jam lalu' },
  { id:7, sev:'info', category:'Pace Ahead',        petugas:'Bulan P. Harahap', kec:'Portibi',          title:'Portibi 8% di atas target mingguan',              detail:'Bisa dipertimbangkan realokasi kapasitas ke kecamatan tertinggal (Hulu Sihapas, Padang Bolak Tenggara) untuk pemerataan progress.', ts:'30 mnt lalu' },
  { id:8, sev:'info', category:'Lonjakan Data',     petugas:'Sistem',           kec:'Simangambat',      title:'127 records masuk dalam 1 hari di Simangambat',   detail:'Lonjakan pada 18 Juni. Perlu dipastikan apakah terjadi input batch atau peningkatan operasional lapangan yang wajar.', ts:'1 hari lalu' },
];

export const KBLI_DATA = [
  { kode:'01291', label:'Perkebunan karet & tanaman lainnya', n:142, cat:'A', catLabel:'Pertanian'   },
  { kode:'01262', label:'Perkebunan kelapa sawit',            n:128, cat:'A', catLabel:'Pertanian'   },
  { kode:'01122', label:'Tanaman padi sawah & ladang',        n: 74, cat:'A', catLabel:'Pertanian'   },
  { kode:'47112', label:'Perdagangan eceran berbagai produk', n: 38, cat:'G', catLabel:'Perdagangan' },
  { kode:'56304', label:'Warung / kedai kopi',                n: 29, cat:'I', catLabel:'Akomodasi'   },
  { kode:'56101', label:'Restoran & rumah makan',             n: 24, cat:'I', catLabel:'Akomodasi'   },
  { kode:'01411', label:'Peternakan sapi potong',             n: 18, cat:'A', catLabel:'Pertanian'   },
  { kode:'47192', label:'Perdagangan eceran lainnya',         n: 14, cat:'G', catLabel:'Perdagangan' },
  { kode:'56102', label:'Warung makan / kantin',              n: 12, cat:'I', catLabel:'Akomodasi'   },
  { kode:'22129', label:'Industri barang karet lainnya',      n:  9, cat:'C', catLabel:'Industri'    },
  { kode:'82921', label:'Jasa foto kopi & stationery',        n:  8, cat:'N', catLabel:'Jasa'        },
  { kode:'10794', label:'Industri kerupuk & sejenisnya',      n:  6, cat:'C', catLabel:'Industri'    },
];

export const PETUGAS = [
  { nama:'Zainal Sagala',    kec:'Padang Bolak',      total:198, approved:142, rejected:0, dur:237, flag:'ok'   },
  { nama:'Bulan P. Harahap', kec:'Portibi',           total:187, approved:132, rejected:0, dur:280, flag:'ok'   },
  { nama:'Pangihutan H.',    kec:'Padang Bolak',      total:176, approved: 98, rejected:0, dur:185, flag:'ok'   },
  { nama:'Taslim Harahap',   kec:'Simangambat',       total:162, approved:124, rejected:0, dur:131, flag:'ok'   },
  { nama:'Iwan',             kec:'Halongonan',        total:148, approved: 82, rejected:0, dur: 34, flag:'ok'   },
  { nama:'Hajarul A. Rambe', kec:'Dolok',             total:134, approved: 74, rejected:0, dur:576, flag:'warn' },
  { nama:'Dapid Harahap',    kec:'Dolok Sigompulon',  total:189, approved: 48, rejected:0, dur:638, flag:'warn' },
  { nama:'Solehuddin Srg',   kec:'Batang Onang',      total:201, approved:  0, rejected:0, dur:758, flag:'warn' },
  { nama:'Alberto Silalahi', kec:'Halongonan Timur',  total:143, approved:  0, rejected:0, dur:220, flag:'warn' },
  { nama:'Hendri Siregar',   kec:'Portibi',           total:247, approved:  0, rejected:0, dur:  1, flag:'crit' },
  { nama:'Asrin Nasution',   kec:'Hulu Sihapas',      total: 72, approved:  0, rejected:0, dur: 62, flag:'warn' },
  { nama:'Ria Asnita',       kec:'Halongonan Timur',  total: 74, approved:  3, rejected:0, dur:395, flag:'ok'   },
];

export const HEATMAP = {
  days: ['Sen 16/6','Sel 17/6','Rab 18/6','Kam 19/6','Jum 20/6','Sab 21/6'],
  rows: [
    { kec:'Padang Bolak',          vals:[68,82,74,79,55,29] },
    { kec:'Portibi',               vals:[91,78,65,72,48, 8] },
    { kec:'Simangambat',           vals:[55,72,87,61,34,12] },
    { kec:'Halongonan',            vals:[62,58,71,55,26, 6] },
    { kec:'Dolok',                 vals:[48,61,57,49,22, 4] },
    { kec:'Dolok Sigompulon',      vals:[42,44,38,31,28, 6] },
    { kec:'Batang Onang',          vals:[38,29,42,30,17, 6] },
    { kec:'Halongonan Timur',      vals:[31,28,36,27,20, 6] },
    { kec:'Padang Bolak Julu',     vals:[28,22,31,24,18, 4] },
    { kec:'Ujung Batu',            vals:[24,19,28,21,16, 4] },
    { kec:'Padang Bolak Tenggara', vals:[18,16,22,17,12, 3] },
    { kec:'Hulu Sihapas',          vals:[14,12,19,14, 8, 2] },
  ],
};

export const DAILY_TREND = [
  { day:'15/6', n:307 },
  { day:'16/6', n:458 },
  { day:'17/6', n:400 },
  { day:'18/6', n:414 },
  { day:'19/6', n:280 },
  { day:'20/6', n:312 },
  { day:'21/6', n:198 },
];

export const KATEGORI_USAHA = [
  { cat:'A — Pertanian',                    n:378, color:'#10b981' },
  { cat:'G — Perdagangan',                  n: 92, color:'#6366f1' },
  { cat:'I — Akomodasi & Makan',            n: 74, color:'#f59e0b' },
  { cat:'C — Industri Pengolahan',          n: 38, color:'#a78bfa' },
  { cat:'O & Q — Pemerintahan & Kesehatan', n: 24, color:'#14b8a6' },
  { cat:'Lainnya',                          n: 19, color:'#5a6285' },
];

// ── Outlier data for box plots ──
export const OUTLIER_DURASI = {
  label: 'Durasi Pengisian (menit)',
  unit: 'menit',
  q0: 0.2, q1: 4, median: 17.6, q3: 112, q4: 758,
  mean: 44.3,
  iqr: 108,
  fenceLo: 0, fenceHi: 274,
  outliers: [310, 395, 450, 520, 576, 638, 700, 758],
  anomalyThresholdLo: 2,
  anomalyThresholdHi: 240,
  dist: [
    { range:'0–2',    n:583, anomaly:true  },
    { range:'2–10',   n:210, anomaly:false },
    { range:'10–30',  n:188, anomaly:false },
    { range:'30–60',  n:142, anomaly:false },
    { range:'60–120', n:128, anomaly:false },
    { range:'120–240',n: 96, anomaly:false },
    { range:'>240',   n:248, anomaly:true  },
  ],
};

export const OUTLIER_PENDAPATAN = {
  label: 'Pendapatan Usaha (juta Rp/bulan)',
  unit: 'juta Rp',
  q0: 0.5, q1: 3, median: 15, q3: 48, q4: 6300,
  mean: 38.2,
  iqr: 45,
  fenceLo: 0, fenceHi: 115.5,
  outliers: [180, 240, 350, 480, 650, 900, 1200, 6300],
  anomalyThresholdHi: 115.5,
  dist: [
    { range:'0–5',    n: 94, anomaly:false },
    { range:'5–20',   n:162, anomaly:false },
    { range:'20–50',  n: 53, anomaly:false },
    { range:'50–115', n: 24, anomaly:false },
    { range:'>115',   n: 31, anomaly:true  },
  ],
};

export const OUTLIER_JUMLAK_AK = {
  label: 'Jumlah Anggota Keluarga (orang)',
  unit: 'orang',
  q0: 1, q1: 2, median: 4, q3: 6, q4: 22,
  mean: 4.1,
  iqr: 4,
  fenceLo: 0, fenceHi: 12,
  outliers: [13,14,15,17,19,22],
  anomalyThresholdHi: 12,
  dist: [
    { range:'1–2',  n:412, anomaly:false },
    { range:'3–4',  n:891, anomaly:false },
    { range:'5–6',  n:724, anomaly:false },
    { range:'7–9',  n:348, anomaly:false },
    { range:'10–12',n: 68, anomaly:false },
    { range:'>12',  n: 24, anomaly:true  },
  ],
};

// ── Responden / record preview ──
function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
const KECS = ['Padang Bolak','Portibi','Simangambat','Halongonan','Dolok','Dolok Sigompulon','Batang Onang','Halongonan Timur','Padang Bolak Julu','Ujung Batu'];
const PCLS = ['Zainal Sagala','Bulan P. Harahap','Pangihutan H.','Taslim Harahap','Iwan','Hendri Siregar','Dapid Harahap','Solehuddin Srg','Ria Asnita','Asrin Nasution'];
const DESAS = ['Tanjung Morang','Siunggam','Sigama','Batu Gana','Paran Tonga','Pinarik','Sipiongot','Langkimat','Aek Godang','Sihapas'];
const USAHAS = ['Kebun sawit','Warung sembako','Bengkel motor','Warung kopi','Kebun karet','Restoran Padang','Toko pakaian','Peternakan sapi','Sawah padi','Kedai mie'];
const KBLIS_SAMPLE = ['01262','01291','01122','47112','56304','56101','01411','45200','10630','','',''];
const STATUSES = ['SUBMITTED','SUBMITTED','SUBMITTED','APPROVED','APPROVED','REJECTED'];

const seed = [
  { id:'SE26-0001', nama:'Ahmad Fauzi',    kec:'Padang Bolak',     desa:'Tanjung Morang', pcl:'Zainal Sagala',    status:'APPROVED',   dur: 28, pendapatan:12000000,  ak:4, usaha:'Kebun sawit',    kbli:'01262', anomaly:null },
  { id:'SE26-0002', nama:'Siti Rahmah',    kec:'Portibi',          desa:'Siunggam',        pcl:'Hendri Siregar',   status:'SUBMITTED',  dur:  1, pendapatan:3500000,   ak:3, usaha:'Warung sembako', kbli:'47112', anomaly:'crit' },
  { id:'SE26-0003', nama:'Budi Santoso',   kec:'Simangambat',      desa:'Sigama',          pcl:'Taslim Harahap',  status:'APPROVED',   dur: 45, pendapatan:8000000,   ak:5, usaha:'Bengkel motor',  kbli:'45200', anomaly:null },
  { id:'SE26-0004', nama:'Nurhasanah',     kec:'Batang Onang',     desa:'Batu Gana',       pcl:'Dapid Harahap',   status:'SUBMITTED',  dur: 18, pendapatan:6300000000,ak:4, usaha:'Kebun karet',    kbli:'01291', anomaly:'warn' },
  { id:'SE26-0005', nama:'Ramlan Hrp',     kec:'Halongonan',       desa:'Paran Tonga',     pcl:'Iwan',            status:'APPROVED',   dur: 32, pendapatan:25000000,  ak:6, usaha:'Restoran Padang',kbli:'56101', anomaly:null },
  { id:'SE26-0006', nama:'Elisa Nst',      kec:'Dolok',            desa:'Pinarik',         pcl:'Hajarul A. Rambe',status:'SUBMITTED',  dur:  0, pendapatan:2000000,   ak:3, usaha:'Warung kopi',    kbli:'56304', anomaly:'crit' },
  { id:'SE26-0007', nama:'Sofyan Muda',    kec:'Portibi',          desa:'Sipiongot',       pcl:'Hendri Siregar',   status:'SUBMITTED',  dur:  1, pendapatan:5000000,   ak:5, usaha:'Toko pakaian',   kbli:'',      anomaly:'crit' },
  { id:'SE26-0008', nama:'Marlina Srg',    kec:'Padang Bolak',     desa:'Langkimat',       pcl:'Pangihutan H.',   status:'REJECTED',   dur: 12, pendapatan:7500000,   ak:7, usaha:'Sawah padi',     kbli:'01122', anomaly:'warn' },
  { id:'SE26-0009', nama:'Harun Nst',      kec:'Hulu Sihapas',     desa:'Aek Godang',      pcl:'Asrin Nasution',  status:'SUBMITTED',  dur:  9, pendapatan:4200000,   ak:4, usaha:'Peternakan sapi',kbli:'01411', anomaly:null },
  { id:'SE26-0010', nama:'Yusra Hrp',      kec:'Dolok Sigompulon', desa:'Sihapas',         pcl:'Solehuddin Srg',  status:'SUBMITTED',  dur:720, pendapatan:18000000,  ak:3, usaha:'Kebun sawit',    kbli:'01262', anomaly:'warn' },
  { id:'SE26-0011', nama:'Patimah Nst',    kec:'Ujung Batu',       desa:'Tanjung Morang',  pcl:'Ria Asnita',      status:'APPROVED',   dur: 55, pendapatan:22000000,  ak:5, usaha:'Warung makan',   kbli:'56102', anomaly:null },
  { id:'SE26-0012', nama:'Ridwan Srg',     kec:'Halongonan Timur', desa:'Sigama',          pcl:'Ria Asnita',      status:'SUBMITTED',  dur: 24, pendapatan:9000000,   ak:22, usaha:'Kebun karet',   kbli:'01291', anomaly:'warn' },
  { id:'SE26-0013', nama:'Aminah Hrp',     kec:'Padang Bolak Julu',desa:'Batu Gana',       pcl:'Bulan P. Harahap',status:'APPROVED',   dur: 38, pendapatan:14000000,  ak:4, usaha:'Kedai mie',      kbli:'56102', anomaly:null },
  { id:'SE26-0014', nama:'Zulkifli Muda',  kec:'Simangambat',      desa:'Paran Tonga',     pcl:'Taslim Harahap',  status:'SUBMITTED',  dur:  1, pendapatan:6000000,   ak:3, usaha:'Kebun sawit',    kbli:'',      anomaly:'crit' },
  { id:'SE26-0015', nama:'Rosmani Srg',    kec:'Padang Bolak',     desa:'Pinarik',         pcl:'Zainal Sagala',   status:'REJECTED',   dur: 16, pendapatan:11000000,  ak:5, usaha:'Warung sembako', kbli:'47112', anomaly:null },
  { id:'SE26-0016', nama:'Parlindungan H.',kec:'Portibi',          desa:'Sipiongot',       pcl:'Hendri Siregar',   status:'SUBMITTED',  dur:  1, pendapatan:2500000,   ak:4, usaha:'Sawah padi',     kbli:'01122', anomaly:'crit' },
  { id:'SE26-0017', nama:'Nurhayati',      kec:'Halongonan',       desa:'Langkimat',       pcl:'Iwan',            status:'APPROVED',   dur: 41, pendapatan:31000000,  ak:6, usaha:'Toko pakaian',   kbli:'47112', anomaly:null },
  { id:'SE26-0018', nama:'Irwan Nst',      kec:'Dolok',            desa:'Aek Godang',      pcl:'Hajarul A. Rambe',status:'SUBMITTED',  dur:601, pendapatan:7000000,   ak:3, usaha:'Bengkel motor',  kbli:'45200', anomaly:'warn' },
  { id:'SE26-0019', nama:'Saripa Hrp',     kec:'Batang Onang',     desa:'Sihapas',         pcl:'Dapid Harahap',   status:'APPROVED',   dur: 22, pendapatan:480000000, ak:4, usaha:'Kebun sawit',    kbli:'01262', anomaly:'warn' },
  { id:'SE26-0020', nama:'Khoirul Umam',   kec:'Padang Bolak',     desa:'Tanjung Morang',  pcl:'Pangihutan H.',   status:'APPROVED',   dur: 29, pendapatan:16000000,  ak:5, usaha:'Restoran Padang',kbli:'56101', anomaly:null },
  { id:'SE26-0021', nama:'Fitri Ramadhani',kec:'Simangambat',      desa:'Siunggam',        pcl:'Bulan P. Harahap',status:'SUBMITTED',  dur:  1, pendapatan:4800000,   ak:3, usaha:'Warung kopi',    kbli:'56304', anomaly:'crit' },
  { id:'SE26-0022', nama:'Agus Salim',     kec:'Halu Sihapas',     desa:'Pinarik',         pcl:'Asrin Nasution',  status:'SUBMITTED',  dur: 14, pendapatan:5500000,   ak:4, usaha:'Sawah padi',     kbli:'01122', anomaly:null },
  { id:'SE26-0023', nama:'Dermawan Nst',   kec:'Ujung Batu',       desa:'Sipiongot',       pcl:'Ria Asnita',      status:'APPROVED',   dur: 47, pendapatan:28000000,  ak:6, usaha:'Kebun karet',    kbli:'01291', anomaly:null },
  { id:'SE26-0024', nama:'Elida Sari',     kec:'Dolok Sigompulon', desa:'Langkimat',       pcl:'Solehuddin Srg',  status:'SUBMITTED',  dur:745, pendapatan:9500000,   ak:5, usaha:'Warung sembako', kbli:'47112', anomaly:'warn' },
  { id:'SE26-0025', nama:'Hamdan Hrp',     kec:'Halongonan Timur', desa:'Batu Gana',       pcl:'Ria Asnita',      status:'SUBMITTED',  dur: 19, pendapatan:7800000,   ak:4, usaha:'Peternakan sapi',kbli:'01411', anomaly:null },
];
export const RESPONDEN = seed;

export const TICKER_PHRASES = [
  '● EWS SE2026 · Padang Lawas Utara',
  '9 anomali aktif terdeteksi',
  '3.847 records terproses',
  '618 KBLI belum terisi',
  'Rejection spike Padang Bolak 22%',
  'PCL Hulu Sihapas tidak aktif 2 hari',
  'Sistem memperbarui data setiap 5 menit',
  'SE2026 · BPS Sumatera Utara',
  'Terintegrasi MATA SE26',
];
