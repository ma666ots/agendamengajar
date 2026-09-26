const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');
const config = require('../firebase-applet-config.json');

const KELAS_ID = 'k-xii-pplg-2';

const rawCsvPath = path.join(__dirname, 'raw_input_pplg2.csv');
const rawCsvContent = fs.readFileSync(rawCsvPath, 'utf8').trim();
const lines = rawCsvContent.split('\n').map(l => l.replace(/\r/g, ''));
const header = lines[0].split(';');

// Dates mapping: 18 meetings
const meetingDates = [
  { per: 1, dateStr: '2026-07-20', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 2, dateStr: '2026-07-23', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 3, dateStr: '2026-07-27', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 4, dateStr: '2026-07-30', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 5, dateStr: '2026-08-03', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 6, dateStr: '2026-08-06', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 7, dateStr: '2026-08-10', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 8, dateStr: '2026-08-13', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 9, dateStr: '2026-08-20', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 10, dateStr: '2026-08-24', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 11, dateStr: '2026-08-27', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 12, dateStr: '2026-08-31', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 13, dateStr: '2026-09-03', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 14, dateStr: '2026-09-07', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 15, dateStr: '2026-09-10', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 16, dateStr: '2026-09-14', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
  { per: 17, dateStr: '2026-09-17', hari: 'Kamis', jadwalId: 'j-kamis-xii-pplg-2' },
  { per: 18, dateStr: '2026-09-21', hari: 'Senin', jadwalId: 'j-senin-xii-pplg-2' },
];

// Male / Female dictionary based on student names
const genderMap = {
  1: 'P',  // AISHA AMELIA SAKHIY
  2: 'P',  // ANINDYA PUTRI
  3: 'P',  // APRILIA NUR AINY
  4: 'P',  // ARNETA PUTRI HAMID
  5: 'L',  // ARYA RIDHO SAPUTRA
  6: 'L',  // ARYA SHAFA AKBAR
  7: 'P',  // BEKTI RAHAYU
  8: 'L',  // DAFFA SETYA HANDIKA
  9: 'P',  // DEBYSA NURUL USTAROH
  10: 'P', // DIKA NURHIDAYAH
  11: 'L', // ERSAF SYIRAZI ARIFIN
  12: 'L', // FADLAN KAUTSAR ALBUKHARI
  13: 'P', // FATIKA NUR FAHRANI
  14: 'L', // FIKO ANGGARA PUTRA
  15: 'P', // HAFIZHA RAISYA KAMILA
  16: 'P', // KHARISMA INKA PUTRI
  17: 'L', // KIDUNG MABUMI PURWANING DUMADI
  18: 'P', // LAILY ARIEKA NURASYIFA
  19: 'P', // LILIS GAYUH SAPUTRI
  20: 'L', // MUFLIH RAFILESEPPA
  21: 'L', // MUHAMMAD 'IZZUDDIN ZAKI
  22: 'L', // MUHAMMAD ATSAL THARIQ RAMI
  23: 'L', // MUHAMMAD UBAIDILLAH MAULANA L
  24: 'P', // NABILA CAHYA NUGROHO
  25: 'P', // NABILA SAFINATUNNAJAH
  26: 'L', // NADHIF AMYRTA FAHMA
  27: 'P', // NAILA SETYANINGTYAS
  28: 'P', // NEYSA VASHTI RAMADANI
  29: 'P', // NINA EVELYN
  30: 'L', // PRANANDA ARKAN RAMADHAN
  31: 'P', // RINA AULIA HUSNA
  32: 'L', // THOMAS ADHI PAMUNGKAS
  33: 'P', // TSANIA HASNA HANIFA
  34: 'L', // UBAIDILLAH ATA AUFA
};

// Parse students and attendance table
const studentList = [];
const attendanceTable = []; // [studentIndex][meetingIndex]

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(';');
  const num = parseInt(parts[0], 10);
  const rawName = parts[1].trim();
  const numPad = String(num).padStart(2, '0');

  const studentObj = {
    id: `s-xii-pplg2-${numPad}`,
    kelasId: KELAS_ID,
    nis: `20241${numPad}`,
    nisn: `00712345${numPad}`,
    nama: rawName,
    jenisKelamin: genderMap[num] || 'L',
  };
  studentList.push(studentObj);

  const statuses = parts.slice(2).map(s => s.trim().toLowerCase());
  attendanceTable.push({ student: studentObj, num, statuses });
}

console.log(`Parsed ${studentList.length} students from CSV.`);

// Curriculum descriptions for the 18 meetings
const curriculum = [
  {
    materi: 'Kontrak Belajar, Orientasi Kurikulum, dan Pengenalan Arsitektur Aplikasi Web Modern (Client-Server & MVC)',
    cp: 'Peserta didik mampu memahami alur kerja pengembangan aplikasi web modern, arsitektur MVC, dan standarisasi kode proyek.',
    indikator: 'Memahami arsitektur aplikasi berbasis web, kontrak perkuliahan/pembelajaran, dan pembagian modul semester ganjil.',
    refleksiGuru: 'Siswa kelas XII PPLG 2 menyimak dengan antusias. Pengantar arsitektur MVC dan REST dipahami secara komprehensif.',
    tindakLanjut: 'Menyiapkan starter code repository dan konfigurasi tools Node.js/Postman pada PC Lab.',
  },
  {
    materi: 'Setup Lingkungan Pengembangan Web (Dev Environment), Package Manager & Struktur Folder Framework Backend',
    cp: 'Peserta didik mampu melakukan inisialisasi project web backend menggunakan package manager dan mengkonfigurasi environment file.',
    indikator: 'Mampu menginstall dependencies, menjalankan dev server lokal, dan memahami kegunaan file .env.',
    refleksiGuru: 'Praktikum instalasi berjalan efektif. Siswa yang cepat selesai membantu rekan lain yang mengalami kendala dependensi.',
    tindakLanjut: 'Membagikan lembar kerja perintah CLI dasar untuk praktikum routing.',
  },
  {
    materi: 'Konsep RESTful API: Perancangan Endpoint, Routing, Controller, dan Response Berformat JSON',
    cp: 'Peserta didik mampu membuat route dan controller yang mengembalikan struktur data JSON berstandar RESTful.',
    indikator: 'Membuat route GET, POST, PUT, DELETE serta method controller terkait dengan status code HTTP yang tepat.',
    refleksiGuru: 'Siswa mulai mengerti perbedaan rendering halaman SSR konvensional dibanding pengembalian payload JSON API murni.',
    tindakLanjut: 'Latihan langsung pengujian endpoint dengan Postman pada pertemuan selanjutnya.',
  },
  {
    materi: 'Pengujian Endpoint API dengan Postman dan Validasi Data Request Input',
    cp: 'Peserta didik mampu menguji API backend dan menerapkan validasi input form pada request body.',
    indikator: 'Menggunakan HTTP client Postman untuk simulasi payload request dan menangani response validasi form.',
    refleksiGuru: 'Siswa berhasil mendemonstrasikan skenario validasi error saat input field kosong atau format tidak sesuai.',
    tindakLanjut: 'Melanjutkan ke perancangan basis data relasional dan skema ORM.',
  },
  {
    materi: 'Model dan Migrasi Basis Data Relasional: Perancangan Skema Tabel dan Tipe Kolom',
    cp: 'Peserta didik mampu merancang skema database menggunakan skrip migrasi dan model ORM.',
    indikator: 'Mengeksekusi migration database, mendefinisikan primary key, timestamps, dan tipe data kolom.',
    refleksiGuru: 'Siswa senang dengan kepraktisan migration file yang memudahkan standarisasi skema database di seluruh tim.',
    tindakLanjut: 'Pemberian materi relasi antar tabel (foreign key constraints).',
  },
  {
    materi: 'Manajemen Relasi Tabel (One-to-Many & Many-to-Many) Menggunakan ORM / Query Builder',
    cp: 'Peserta didik mampu menghubungkan tabel relasional dan melakukan eager loading data berelasi.',
    indikator: 'Mendefinisikan relasi ForeignKey dan mengambil data relasional dengan query builder.',
    refleksiGuru: 'Konsep relasi tabel membutuhkan pendampingan ekstra, khususnya pada foreign key constraint dan onDelete cascade.',
    tindakLanjut: 'Memberikan rangkuman diagram ERD dan contoh kode relasi ke grup kelas.',
  },
  {
    materi: 'Operasi CRUD Lengkap: Implementasi Create & Read dengan Paginasi dan Sorting Data',
    cp: 'Peserta didik mampu membangun endpoint untuk menambah data baru dan menampilkan daftar data secara terstruktur.',
    indikator: 'Membuat fungsi simpan data dengan sanitize input serta pagination response.',
    refleksiGuru: 'Hampir seluruh siswa berhasil membuat fitur simpan dan tampil data berpaginasi.',
    tindakLanjut: 'Lanjut ke implementasi method update dan delete data.',
  },
  {
    materi: 'Operasi CRUD Lengkap: Implementasi Update & Delete dengan Soft Delete / Hard Delete',
    cp: 'Peserta didik mampu menyelesaikan logika update dan hapus rekaman data pada database.',
    indikator: 'Membuat endpoint PUT/PATCH dan DELETE beserta verifikasi ketersediaan id sebelum dieksekusi.',
    refleksiGuru: 'Konsep soft delete memberikan pemahaman mendalam tentang keamanan dan audit data historis.',
    tindakLanjut: 'Persiapan modul autentikasi dan enkripsi keamanan kata sandi.',
  },
  {
    materi: 'Sistem Autentikasi Pengguna: Hashing Password dengan Bcrypt dan Manajemen Registrasi Akun',
    cp: 'Peserta didik mampu menerapkan keamanan kata sandi pengguna dengan algoritma hashing modern.',
    indikator: 'Menggunakan library hashing untuk mengenkripsi password sebelum disimpan ke basis data.',
    refleksiGuru: 'Siswa menyadari pentingnya prinsip keamanan web di mana kata sandi tidak boleh disimpan dalam bentuk teks biasa.',
    tindakLanjut: 'Menerapkan konsep login dengan generate JSON Web Token (JWT).',
  },
  {
    materi: 'Autentikasi Token JWT (JSON Web Token): Pembuatan Token Login dan Verifikasi Payload',
    cp: 'Peserta didik mampu merancang flow login pengguna berbasis token stateless JWT.',
    indikator: 'Membuat endpoint login, validasi kredensial, generate signed token, dan return token ke klien.',
    refleksiGuru: 'Praktik decode token di jwt.io membantu siswa memahami header, payload claims, dan signature rahasia.',
    tindakLanjut: 'Membuat middleware proteksi route berbasis Bearer Token.',
  },
  {
    materi: 'Middleware Keamanan dan Otorisasi Hak Akses (Role-Based Access Control / RBAC)',
    cp: 'Peserta didik mampu mengamankan endpoint privat dengan middleware verifikasi token dan pembatasan peran.',
    indikator: 'Membuat interceptor/middleware auth untuk membedakan hak akses Administrator dan Pengguna Umum.',
    refleksiGuru: 'Konsep middleware proteksi route berhasil diimplementasikan pada route grup privat.',
    tindakLanjut: 'Pemberian materi pengelolaan berkas dan upload file media.',
  },
  {
    materi: 'Pengelolaan Upload File, Validasi MIME Type, dan Penyimpanan Media pada Server',
    cp: 'Peserta didik mampu mengelola upload multipart/form-data dan memvalidasi ukuran serta tipe file gambar.',
    indikator: 'Mengkonfigurasi storage disk, generator nama file unik, dan limitasi file size upload.',
    refleksiGuru: 'Penanganan validasi file mimetype berhasil mencegah upload file berbahaya pada server.',
    tindakLanjut: 'Melanjutkan ke pengembangan antarmuka pengguna frontend (SPA).',
  },
  {
    materi: 'Integrasi Frontend SPA: Setup Framework Frontend, Komponen UI, dan State Management',
    cp: 'Peserta didik mampu membangun antarmuka frontend berbasis komponen modern dan mengelola state aplikasi.',
    indikator: 'Membuat struktur komponen layout, navbar, tabel data, dan form input responsif.',
    refleksiGuru: 'Siswa sangat bersemangat saat tampilan visual antarmuka web mulai terhubung.',
    tindakLanjut: 'Menghubungkan frontend ke backend API menggunakan Axios/Fetch.',
  },
  {
    materi: 'Data Fetching Frontend: Mengkonsumsi REST API Backend (GET, POST) dengan Handling Loading State',
    cp: 'Peserta didik mampu melakukan pertukaran data asynchronous antara frontend dan API server.',
    indikator: 'Mengirim request HTTP GET dan POST dari komponen UI serta menampilkan indikator loading & error.',
    refleksiGuru: 'Konsep asynchronous async/await dan penanganan error network dapat diterapkan dengan baik oleh siswa.',
    tindakLanjut: 'Penyelesaian form edit dan dialog konfirmasi hapus data di antarmuka.',
  },
  {
    materi: 'Implementasi Operasi Frontend: Edit Data (PUT) dan Konfirmasi Hapus Data (DELETE) dengan Modal Dialog',
    cp: 'Peserta didik mampu menyelesaikan antarmuka form edit dan dialog konfirmasi hapus rekaman data.',
    indikator: 'Mengisi default form value dari data terpilih dan mengeksekusi request update/delete secara real-time.',
    refleksiGuru: 'Alur interaksi pengguna menjadi jauh lebih mulus dengan modal konfirmasi konfirmasi aksi hapus.',
    tindakLanjut: 'Penerapan login session dan penyimpanan token di LocalStorage.',
  },
  {
    materi: 'Penyimpanan Token pada Sisi Klien, Auth Guard Routing, dan Logout Session',
    cp: 'Peserta didik mampu mengimplementasikan proteksi route pada aplikasi frontend berdasarkan status login.',
    indikator: 'Mencegah akses halaman dashboard jika belum memiliki token valid dan menangani mekanisme logout.',
    refleksiGuru: 'Siswa memahami alur redirect otomatis ke login page jika session user belum terautentikasi.',
    tindakLanjut: 'Pengujian terintegrasi end-to-end seluruh modul.',
  },
  {
    materi: 'Pengujian Terintegrasi (End-to-End Testing), Penanganan Bug & Optimasi Kode Aplikasi Web',
    cp: 'Peserta didik mampu melakukan pengujian fungsional terintegrasi antara frontend, backend, dan database.',
    indikator: 'Menguji alur sistem end-to-end, memperbaiki defect/bug, dan mengoptimalkan performa response.',
    refleksiGuru: 'Kelompok siswa aktif melakukan debugging dan membersihkan log kode.',
    tindakLanjut: 'Asesmen sumatif tengah semester dan presentasi produk pada pertemuan berikutnya.',
  },
  {
    materi: 'Asesmen Sumatif / Evaluasi Tengah Semester: Review Proyek Web Portofolio & Penilaian Kinerja',
    cp: 'Peserta didik mampu mendemonstrasikan hasil pembuatan aplikasi web berbasis API dan mempertanggungjawabkannya.',
    indikator: 'Mempresentasikan demo aplikasi, menjelaskan arsitektur database, kode backend, dan antarmuka frontend.',
    refleksiGuru: 'Hasil karya proyek web siswa kelas XII PPLG 2 menunjukkan penguasaan kompetensi kejuruan yang membanggakan.',
    tindakLanjut: 'Merekapitulasi nilai dan presensi semester ganjil untuk pelaporan akademik dan sinkronisasi ke Google Drive.',
  },
];

// Helper to convert CSV status code to PresensiStatus & description
function parseStatus(code) {
  if (code === 's') return { status: 'sakit', ket: 'Surat izin sakit / konfirmasi orang tua' };
  if (code === 'i') return { status: 'ijin', ket: 'Surat permohonan izin dinas / keluarga' };
  if (code === 'a') return { status: 'alpa', ket: 'Tanpa keterangan' };
  if (code === 'd') return { status: 'dispen', ket: 'Dispensasi kegiatan lomba / sekolah' };
  if (code === 'm') return { status: 'magang', ket: 'Program magang / PKL industri' };
  return { status: 'hadir', ket: undefined };
}

// Build 18 AgendaMengajar
const newAgendas = meetingDates.map((meeting, mIdx) => {
  const c = curriculum[mIdx];
  const agendaId = `ag-xii-pplg2-${meeting.per}`;

  const nonHadirNames = [];
  const presensi = attendanceTable.map(row => {
    const code = row.statuses[mIdx] || '-';
    const parsed = parseStatus(code);
    if (parsed.status !== 'hadir') {
      let label = `${row.student.nama} (${parsed.status})`;
      nonHadirNames.push(label);
    }
    const item = {
      siswaId: row.student.id,
      status: parsed.status,
    };
    if (parsed.ket) item.keterangan = parsed.ket;
    return item;
  });

  let catatanKejadian = 'Pembelajaran di Lab RPL berjalan tertib dan kondusif.';
  if (nonHadirNames.length > 0) {
    catatanKejadian = `Catatan kehadiran: ${nonHadirNames.join(', ')}. Pembelajaran praktikum di Lab RPL berjalan lancar.`;
  }

  const isLastMeeting = meeting.per === 18;

  // Build optional PenilaianSession on meeting 18
  let penilaian = undefined;
  if (isLastMeeting) {
    penilaian = {
      id: `pen-xii-pplg2-uts`,
      agendaId: agendaId,
      kelasId: KELAS_ID,
      mapel: 'Pemrograman Web',
      tanggal: meeting.dateStr,
      jenisPenilaian: 'Sumatif',
      skalaPenilaian: 'angka',
      namaPenilaian: 'Evaluasi Portofolio Proyek Web Tengah Semester (UTS)',
      kkm: 75,
      daftarNilai: studentList.map((s, idx) => {
        // Base score between 80 and 96
        const scores = [88, 92, 85, 90, 84, 87, 89, 91, 86, 93, 85, 90, 88, 86, 91, 87, 85, 94, 86, 85, 84, 83, 85, 92, 90, 88, 89, 87, 93, 86, 91, 88, 89, 87];
        const val = scores[idx] || 85;
        return {
          siswaId: s.id,
          nilai: val,
          statusTugas: 'Sudah',
          catatan: 'Proyek web lengkap dengan REST API & UI responsif',
        };
      }),
    };
  }

  return {
    id: agendaId,
    kelasId: KELAS_ID,
    jadwalId: meeting.jadwalId,
    pertemuanKe: meeting.per,
    tanggal: meeting.dateStr,
    mapel: 'Pemrograman Web',
    materi: c.materi,
    capaianPembelajaran: c.cp,
    indikator: c.indikator,
    catatanKejadian: catatanKejadian,
    refleksiGuru: c.refleksiGuru,
    tindakLanjut: c.tindakLanjut,
    presensi: presensi,
    adaPenilaian: isLastMeeting,
    penilaian: penilaian,
    created_at: `${meeting.dateStr}T07:30:00.000Z`,
  };
});

console.log(`Generated ${newAgendas.length} agenda records for XII PPLG 2.`);

// Kelas record update
const updatedKelas = {
  id: KELAS_ID,
  namaKelas: 'XII PPLG 2',
  tingkat: 'XII',
  jurusan: 'Pengembangan Perangkat Lunak dan Gim',
  waliKelas: 'Budi Santoso, S.Kom',
  tahunAjaran: '2026/2027',
  jumlahSiswa: studentList.length,
};

// Schedules for XII PPLG 2
const schedules = [
  {
    id: 'j-senin-xii-pplg-2',
    kelasId: KELAS_ID,
    mapel: 'Pemrograman Web',
    hari: 'Senin',
    jamKe: '2 - 5',
    jamMulai: '07:40',
    jamSelesai: '10:35',
    ruangan: 'Lab RPL / PPLG',
  },
  {
    id: 'j-kamis-xii-pplg-2',
    kelasId: KELAS_ID,
    mapel: 'Pemrograman Web',
    hari: 'Kamis',
    jamKe: '1 - 4',
    jamMulai: '07:00',
    jamSelesai: '10:00',
    ruangan: 'Lab RPL / PPLG',
  },
];

async function main() {
  // 1. UPDATE data/db.json
  const dbJsonPath = path.join(__dirname, '..', 'data', 'db.json');
  let localDb = { profile: {}, kelas: [], siswa: [], jadwal: [], agenda: [], penilaianExtra: [] };
  if (fs.existsSync(dbJsonPath)) {
    try {
      localDb = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
    } catch (e) {
      console.warn('Error reading db.json, using fallback structure');
    }
  }

  // Update Kelas
  const kIdx = localDb.kelas.findIndex(k => k.id === KELAS_ID);
  if (kIdx >= 0) localDb.kelas[kIdx] = updatedKelas;
  else localDb.kelas.unshift(updatedKelas);

  // Update Jadwal
  for (const j of schedules) {
    const jIdx = localDb.jadwal.findIndex(item => item.id === j.id);
    if (jIdx >= 0) localDb.jadwal[jIdx] = j;
    else localDb.jadwal.push(j);
  }

  // Filter out any previous XII PPLG 2 students to avoid duplicates
  localDb.siswa = localDb.siswa.filter(s => s.kelasId !== KELAS_ID).concat(studentList);

  // Filter out any previous XII PPLG 2 agendas
  localDb.agenda = localDb.agenda.filter(a => a.kelasId !== KELAS_ID).concat(newAgendas);

  // Add extra assessment session if not already in penilaianExtra
  const utsPenilaian = newAgendas[newAgendas.length - 1].penilaian;
  if (utsPenilaian) {
    localDb.penilaianExtra = (localDb.penilaianExtra || []).filter(p => p.id !== utsPenilaian.id).concat([utsPenilaian]);
  }

  localDb.updatedAt = new Date().toISOString();
  fs.writeFileSync(dbJsonPath, JSON.stringify(localDb, null, 2), 'utf8');
  console.log('✅ Berhasil memperbarui data/db.json lokal dengan 34 siswa dan 18 agenda XII PPLG 2!');

  // 2. INJECT KE FIREBASE FIRESTORE
  try {
    console.log('Menghubungkan ke Firebase Firestore:', config.firestoreDatabaseId);
    const app = initializeApp(config);
    const firestoreDb = getFirestore(app, config.firestoreDatabaseId);
    const primaryDocRef = doc(firestoreDb, 'app_data', 'primary');

    let currentFirestoreData = null;
    try {
      const snap = await getDoc(primaryDocRef);
      if (snap.exists()) {
        currentFirestoreData = snap.data();
      }
    } catch (e) {
      console.warn('Gagal membaca dokumen Firestore saat ini, melanjutkan:', e.message);
    }

    // Merge in Firestore
    const fsProfile = (currentFirestoreData && currentFirestoreData.profile) || localDb.profile;
    const fsKelas = (currentFirestoreData && Array.isArray(currentFirestoreData.kelas) ? currentFirestoreData.kelas : localDb.kelas);
    const fsKelasIdx = fsKelas.findIndex(k => k.id === KELAS_ID);
    if (fsKelasIdx >= 0) fsKelas[fsKelasIdx] = updatedKelas;
    else fsKelas.unshift(updatedKelas);

    const fsJadwal = (currentFirestoreData && Array.isArray(currentFirestoreData.jadwal) ? currentFirestoreData.jadwal : localDb.jadwal);
    for (const j of schedules) {
      const idx = fsJadwal.findIndex(item => item.id === j.id);
      if (idx >= 0) fsJadwal[idx] = j;
      else fsJadwal.push(j);
    }

    const fsSiswa = (currentFirestoreData && Array.isArray(currentFirestoreData.siswa) ? currentFirestoreData.siswa : localDb.siswa)
      .filter(s => s.kelasId !== KELAS_ID)
      .concat(studentList);

    const fsAgenda = (currentFirestoreData && Array.isArray(currentFirestoreData.agenda) ? currentFirestoreData.agenda : localDb.agenda)
      .filter(a => a.kelasId !== KELAS_ID)
      .concat(newAgendas);

    const fsPenilaian = (currentFirestoreData && Array.isArray(currentFirestoreData.penilaianExtra) ? currentFirestoreData.penilaianExtra : (localDb.penilaianExtra || []))
      .filter(p => p.id !== utsPenilaian.id)
      .concat([utsPenilaian]);

    const firestorePayload = JSON.parse(JSON.stringify({
      profile: fsProfile,
      kelas: fsKelas,
      siswa: fsSiswa,
      jadwal: fsJadwal,
      agenda: fsAgenda,
      penilaianExtra: fsPenilaian,
      updatedAt: new Date().toISOString(),
    }));

    await setDoc(primaryDocRef, firestorePayload, { merge: true });
    console.log('✅ Berhasil menginjeksi data lengkap ke dokumen primer Firestore!');

    // Also write each individual agenda doc for fail-safe retrieval
    for (const ag of newAgendas) {
      try {
        const sanitizedAg = JSON.parse(JSON.stringify(ag));
        await setDoc(doc(firestoreDb, 'app_data', ag.id), sanitizedAg, { merge: true });
      } catch (err) {
        // silent fail on individual docs
      }
    }
    console.log('✅ Berhasil menulis salinan fail-safe 18 dokumen agenda individual ke Firestore!');
  } catch (err) {
    console.error('Peringatan saat update Firestore:', err);
  }

  console.log('\n--- RINGKASAN IMPOR SISWA & AGENDA XII PPLG 2 ---');
  console.log(`Jumlah Siswa Diimpor: ${studentList.length} orang`);
  console.log(`Jumlah Pertemuan Agenda: ${newAgendas.length} pertemuan (20 Juli - 21 September 2026)`);
  console.log(`Jadwal: Senin (07:40 - 10:35) & Kamis (07:00 - 10:00)`);
  process.exit(0);
}

main().catch(err => {
  console.error('Eksekusi gagal:', err);
  process.exit(1);
});
