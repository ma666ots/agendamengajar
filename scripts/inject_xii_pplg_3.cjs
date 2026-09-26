const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');
const config = require('../firebase-applet-config.json');

const rawStudents = [
  { no: 1, nama: 'AHMAD TAHER AL-ABIYYU', jk: 'L' },
  { no: 2, nama: 'AMANDA YUFITA AGUSTINA', jk: 'P' },
  { no: 3, nama: 'ANANDA NURUL AISYA', jk: 'P' },
  { no: 4, nama: 'ARIQ RIFQI KURNIAWAN', jk: 'L' },
  { no: 5, nama: 'AZAREL PRAYNANDO IMMANUEL', jk: 'L' },
  { no: 6, nama: 'CHOLIDUN NIAM', jk: 'L' },
  { no: 7, nama: 'CHOLISATUL ASTURIYAH', jk: 'P' },
  { no: 8, nama: 'FINOLA RAYSHA CAMILLA', jk: 'P' },
  { no: 9, nama: 'Firyaal Nabiilah Sakiinah', jk: 'P' },
  { no: 10, nama: 'FITRIA AGUSTINA', jk: 'P' },
  { no: 11, nama: 'Gabriel Agastya Ganesha Narendra', jk: 'L' },
  { no: 12, nama: 'INTAN KUSUMAWATI', jk: 'P' },
  { no: 13, nama: 'JIHAN KUSUMA DEWI', jk: 'P' },
  { no: 14, nama: 'Keyzahra Aulia Ramadhani', jk: 'P' },
  { no: 15, nama: 'KHANSA MAURA FEBI', jk: 'P' },
  { no: 16, nama: 'KHOSYI SUFI', jk: 'L' },
  { no: 17, nama: 'LALA JENI RAFIKA', jk: 'P' },
  { no: 18, nama: 'MOSES YUDA CHRISTIANO', jk: 'L' },
  { no: 19, nama: 'Muhammad Fauzan Febrian Wibowo', jk: 'L' },
  { no: 20, nama: 'MUHAMMAD IBRAHIMOVIC', jk: 'L' },
  { no: 21, nama: 'MUHAMMAD KHOIRUL ANAM', jk: 'L' },
  { no: 22, nama: 'MUHAMMAD RIDHO ARYA SATYA', jk: 'L' },
  { no: 23, nama: 'NADIA FIDA AFITA SARI', jk: 'P' },
  { no: 24, nama: 'NANDA ARIYANI DEVI', jk: 'P' },
  { no: 25, nama: 'NISRINA ALMA LAURA', jk: 'P' },
  { no: 26, nama: 'NOVA WIDYA MILASARI', jk: 'P' },
  { no: 27, nama: 'PANDU WIBOWO', jk: 'L' },
  { no: 28, nama: 'RAKHA ALVANDY MURGIARTONO', jk: 'L' },
  { no: 29, nama: 'Rara Arka Nala', jk: 'P' },
  { no: 30, nama: 'RASTI AULIA RAMADANI', jk: 'P' },
  { no: 31, nama: 'RIO NUGROHO', jk: 'L' },
  { no: 32, nama: 'RIZKY KENZO SYAHDAYANA', jk: 'L' },
  { no: 33, nama: 'SAKTI SELGINOV', jk: 'L' },
  { no: 34, nama: 'SALSABILA MUYASAROH', jk: 'P' },
  { no: 35, nama: 'SELVI NOVELIA WULANDARI', jk: 'P' },
];

const KELAS_ID = 'k-xii-pplg-3';

const newKelas = {
  id: KELAS_ID,
  namaKelas: 'XII PPLG 3',
  tingkat: 'XII',
  jurusan: 'Pengembangan Perangkat Lunak dan Gim',
  waliKelas: 'Kurniawan Basuki, S.Pd., M.T',
  tahunAjaran: '2026/2027',
  jumlahSiswa: 35,
};

const newJadwal = [
  {
    id: 'j-xii-pplg-3-senin',
    kelasId: KELAS_ID,
    hari: 'Senin',
    jamKe: '1 - 4',
    jamMulai: '07:00',
    jamSelesai: '09:45',
    mapel: 'Pemrograman Web',
    ruangan: 'Lab RPL / PPLG 2',
  },
  {
    id: 'j-xii-pplg-3-selasa',
    kelasId: KELAS_ID,
    hari: 'Selasa',
    jamKe: '1 - 4',
    jamMulai: '07:00',
    jamSelesai: '09:45',
    mapel: 'Pemrograman Web',
    ruangan: 'Lab RPL / PPLG 2',
  },
];

const newSiswaList = rawStudents.map(s => {
  const numPad = String(s.no).padStart(2, '0');
  return {
    id: `s-xii-pplg3-${numPad}`,
    kelasId: KELAS_ID,
    nis: `2024${numPad}`,
    nisn: `00712345${numPad}`,
    nama: s.nama,
    jenisKelamin: s.jk,
  };
});

// Column attendance records:
// 1: 29 JULI: Rio (31) = m, Sakti (33) = m
// 2: 11 agust: Jihan (13) = s, Moses (18) = s, Rio (31) = m, Sakti (33) = m
// 3: 12 agust: Rio (31) = m, Sakti (33) = m
// 4: Column 6 (19 Agust): Lala (17) = s, Ibrahimovic (20) = s, Ridho (22) = s, Nanda (24) = s, Rio (31) = m, Sakti (33) = m
// 5: 01-Sep: Rio (31) = m, Sakti (33) = m
// 6: 02-Sep: Finola (8) = s, Rio (31) = m, Sakti (33) = m
// 7: 08-Sep: Ridho (22) = s, Nanda (24) = s, Rio (31) = m, Sakti (33) = m
// 8: 09-Sep: All present!

function buildPresensi(customStatuses = {}) {
  return newSiswaList.map((siswa, idx) => {
    const studentNo = idx + 1;
    const custom = customStatuses[studentNo];
    if (custom === 's') {
      return {
        siswaId: siswa.id,
        status: 'sakit',
        keterangan: 'Surat izin sakit / konfirmasi orang tua',
      };
    }
    if (custom === 'm') {
      return {
        siswaId: siswa.id,
        status: 'magang',
        keterangan: 'Program magang / PKL industri',
      };
    }
    if (custom === 'i') {
      return {
        siswaId: siswa.id,
        status: 'izin',
        keterangan: 'Surat dispensasi izin',
      };
    }
    if (custom === 'a') {
      return {
        siswaId: siswa.id,
        status: 'alpa',
        keterangan: 'Tanpa keterangan',
      };
    }
    return {
      siswaId: siswa.id,
      status: 'hadir',
    };
  });
}

const newAgendas = [
  {
    id: 'ag-xii-pplg3-1',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-selasa',
    pertemuanKe: 1,
    tanggal: '2025-07-29',
    mapel: 'Pemrograman Web',
    materi: 'Kontrak Belajar & Orientasi Framework Web Modern (MVC & RESTful Architecture)',
    capaianPembelajaran: 'Peserta didik mampu memahami arsitektur aplikasi web modern dan alur kerja pengembangan perangkat lunak berbasis API.',
    indikator: 'Memahami arsitektur MVC, konsep routing, dan struktur project backend/frontend.',
    catatanKejadian: 'Pertemuan perdana berjalan tertib. 2 siswa melaksanakan program magang/PKL industri (Rio Nugroho, Sakti Selginov).',
    refleksiGuru: 'Siswa kelas XII PPLG 3 antusias dan siap melanjutkan materi web tingkat lanjut.',
    tindakLanjut: 'Mempersiapkan modul konfigurasi environment dan tools Postman.',
    adaPenilaian: false,
    presensi: buildPresensi({ 31: 'm', 33: 'm' }),
    created_at: '2025-07-29T07:15:00.000Z',
  },
  {
    id: 'ag-xii-pplg3-2',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-senin',
    pertemuanKe: 2,
    tanggal: '2025-08-11',
    mapel: 'Pemrograman Web',
    materi: 'Implementasi Routing, Controller, dan Response Data JSON pada Backend API',
    capaianPembelajaran: 'Peserta didik mampu merancang endpoint API dan mengelola request-response.',
    indikator: 'Membuat route handler, controller method, dan response status code yang valid.',
    catatanKejadian: 'Praktikum berjalan lancar. 2 siswa sakit (Jihan Kusuma Dewi, Moses Yuda Christiano) dan 2 siswa magang (Rio, Sakti).',
    refleksiGuru: 'Sebagian besar siswa berhasil menguji endpoint API menggunakan Postman.',
    tindakLanjut: 'Lanjut ke materi koneksi database dan query builder/ORM.',
    adaPenilaian: false,
    presensi: buildPresensi({ 13: 's', 18: 's', 31: 'm', 33: 'm' }),
    created_at: '2025-08-11T07:15:00.000Z',
  },
  {
    id: 'ag-xii-pplg3-3',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-selasa',
    pertemuanKe: 3,
    tanggal: '2025-08-12',
    mapel: 'Pemrograman Web',
    materi: 'Model, Migrasi Database, dan Manajemen Relasi Tabel (One-to-Many & Many-to-Many)',
    capaianPembelajaran: 'Peserta didik mampu memodelkan data relasional dan menerapkan migrasi database.',
    indikator: 'Mampu mengeksekusi skrip migrasi dan relasi tabel foreign key.',
    catatanKejadian: 'Siswa aktif berdiskusi dalam kelompok. 2 siswa magang (Rio Nugroho, Sakti Selginov).',
    refleksiGuru: 'Pemahaman skema relasi database sudah baik dan terstruktur.',
    tindakLanjut: 'Penugasan pembuatan skema database untuk proyek aplikasi inventaris.',
    adaPenilaian: false,
    presensi: buildPresensi({ 31: 'm', 33: 'm' }),
    created_at: '2025-08-12T07:15:00.000Z',
  },
  {
    id: 'ag-xii-pplg3-4',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-selasa',
    pertemuanKe: 4,
    tanggal: '2025-08-19',
    mapel: 'Pemrograman Web',
    materi: 'Operasi CRUD (Create, Read, Update, Delete) Lanjutan dengan Validasi Data Form',
    capaianPembelajaran: 'Peserta didik mampu mengimplementasikan logika CRUD dengan validasi input yang ketat.',
    indikator: 'Menulis fungsi penyimpanan, pembaruan, dan validasi form request.',
    catatanKejadian: '4 siswa izin sakit (Lala Jeni, M. Ibrahimovic, M. Ridho Arya, Nanda Ariyani) dan 2 siswa magang.',
    refleksiGuru: 'Perlu pendampingan khusus pada penanganan error response validasi.',
    tindakLanjut: 'Membagikan materi rekaman video demo dan tugas mandiri ke siswa yang berhalangan hadir.',
    adaPenilaian: false,
    presensi: buildPresensi({ 17: 's', 20: 's', 22: 's', 24: 's', 31: 'm', 33: 'm' }),
    created_at: '2025-08-19T07:15:00.000Z',
  },
  {
    id: 'ag-xii-pplg3-5',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-senin',
    pertemuanKe: 5,
    tanggal: '2025-09-01',
    mapel: 'Pemrograman Web',
    materi: 'Autentikasi Pengguna: JWT Token, Session, & Hashing Password dengan Bcrypt',
    capaianPembelajaran: 'Peserta didik mampu mengamankan aplikasi web dengan sistem autentikasi dan otorisasi.',
    indikator: 'Mengimplementasikan registrasi pengguna, enkripsi kata sandi, dan verifikasi login token.',
    catatanKejadian: 'Materi keamanan web disimak antusias oleh siswa. 2 siswa magang (Rio, Sakti).',
    refleksiGuru: 'Siswa sangat tertarik pada mekanisme token authorization header.',
    tindakLanjut: 'Praktikum middleware proteksi endpoint pada pertemuan berikutnya.',
    adaPenilaian: false,
    presensi: buildPresensi({ 31: 'm', 33: 'm' }),
    created_at: '2025-09-01T07:15:00.000Z',
  },
  {
    id: 'ag-xii-pplg3-6',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-selasa',
    pertemuanKe: 6,
    tanggal: '2025-09-02',
    mapel: 'Pemrograman Web',
    materi: 'Middleware Otorisasi Role-Based Access Control (RBAC: Admin vs User)',
    capaianPembelajaran: 'Peserta didik mampu membatasi hak akses halaman dan endpoint berdasarkan peran pengguna.',
    indikator: 'Membuat middleware pemeriksa role dan interceptor request API.',
    catatanKejadian: '1 siswa izin sakit (Finola Raysha Camilla), 2 siswa magang (Rio, Sakti). Pembelajaran kondusif.',
    refleksiGuru: 'Siswa berhasil membedakan otorisasi admin dan user biasa.',
    tindakLanjut: 'Persiapan integrasi backend dengan antarmuka frontend SPA.',
    adaPenilaian: false,
    presensi: buildPresensi({ 8: 's', 31: 'm', 33: 'm' }),
    created_at: '2025-09-02T07:15:00.000Z',
  },
  {
    id: 'ag-xii-pplg3-7',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-senin',
    pertemuanKe: 7,
    tanggal: '2025-09-08',
    mapel: 'Pemrograman Web',
    materi: 'Integrasi Frontend SPA dengan REST API (State Management & Data Fetching)',
    capaianPembelajaran: 'Peserta didik mampu menghubungkan antarmuka web SPA dengan layanan backend API.',
    indikator: 'Mampu mengonsumsi API, menangani asynchronous promise, dan me-render data dinamis.',
    catatanKejadian: '2 siswa sakit (M. Ridho Arya Satya, Nanda Ariyani Devi), 2 siswa magang (Rio, Sakti).',
    refleksiGuru: 'Proses data fetching dan handling status loading berjalan dengan baik.',
    tindakLanjut: 'Finalisasi proyek mini web kelas XII dan persiapan presentasi pengujian.',
    adaPenilaian: false,
    presensi: buildPresensi({ 22: 's', 24: 's', 31: 'm', 33: 'm' }),
    created_at: '2025-09-08T07:15:00.000Z',
  },
  {
    id: 'ag-xii-pplg3-8',
    kelasId: KELAS_ID,
    jadwalId: 'j-xii-pplg-3-selasa',
    pertemuanKe: 8,
    tanggal: '2025-09-09',
    mapel: 'Pemrograman Web',
    materi: 'Pengujian Aplikasi Web (Blackbox Testing), Debugging, & Presentasi Proyek Mini',
    capaianPembelajaran: 'Peserta didik mampu mengevaluasi kinerja sistem web dan mempresentasikan hasil karya perangkat lunak.',
    indikator: 'Melakukan pengujian fitur fungsional, pencatatan bug, dan deployment lokal.',
    catatanKejadian: 'Seluruh 35 siswa hadir lengkap 100%. Presentasi proyek berjalan memuaskan.',
    refleksiGuru: 'Seluruh kelompok berhasil menyelesaikan portofolio aplikasi web fullstack sesuai kriteria.',
    tindakLanjut: 'Penilaian proyek dan pemberian apresiasi hasil karya siswa.',
    adaPenilaian: true,
    presensi: buildPresensi({}), // Semua hadir!
    created_at: '2025-09-09T07:15:00.000Z',
  },
];

const newPenilaian = {
  id: 'pen-xii-pplg3-tugas1',
  agendaId: 'ag-xii-pplg3-8',
  kelasId: KELAS_ID,
  mapel: 'Pemrograman Web',
  tanggal: '2025-09-09',
  jenisPenilaian: 'Tugas',
  skalaPenilaian: 'angka',
  namaPenilaian: 'Proyek Mini Pemrograman Web REST API',
  kkm: 75,
  daftarNilai: newSiswaList.map((siswa, idx) => ({
    siswaId: siswa.id,
    nilai: 85 + ((idx * 7) % 13), // 85 - 97
    catatan: 'Tuntas memuaskan',
  })),
};

async function main() {
  console.log('--- Injeksi Data XII PPLG 3 ---');

  // 1. Update data/db.json
  const dbJsonPath = path.join(__dirname, '..', 'data', 'db.json');
  let localDb = { profile: {}, kelas: [], siswa: [], jadwal: [], agenda: [], penilaianExtra: [] };
  if (fs.existsSync(dbJsonPath)) {
    try {
      localDb = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
    } catch (e) {
      console.warn('Error reading db.json, using template');
    }
  }

  // Merge Kelas
  const existingKelasIdx = localDb.kelas.findIndex(k => k.id === KELAS_ID);
  if (existingKelasIdx >= 0) {
    localDb.kelas[existingKelasIdx] = newKelas;
  } else {
    localDb.kelas.unshift(newKelas); // Put at front
  }

  // Merge Jadwal
  for (const j of newJadwal) {
    const idx = localDb.jadwal.findIndex(item => item.id === j.id);
    if (idx >= 0) localDb.jadwal[idx] = j;
    else localDb.jadwal.push(j);
  }

  // Merge Siswa (filter out any previous XII PPLG 3 students to prevent duplicates)
  localDb.siswa = localDb.siswa.filter(s => s.kelasId !== KELAS_ID).concat(newSiswaList);

  // Merge Agenda (filter out any previous XII PPLG 3 agendas)
  localDb.agenda = localDb.agenda.filter(a => a.kelasId !== KELAS_ID).concat(newAgendas);

  // Merge Penilaian
  localDb.penilaianExtra = (localDb.penilaianExtra || []).filter(p => p.id !== newPenilaian.id).concat([newPenilaian]);

  localDb.updatedAt = new Date().toISOString();

  fs.writeFileSync(dbJsonPath, JSON.stringify(localDb, null, 2), 'utf8');
  console.log('✅ Berhasil update data/db.json!');

  // 2. Inject to Firebase Firestore Real Database!
  console.log('Connecting to Firebase Firestore:', config.firestoreDatabaseId);
  const app = initializeApp(config);
  const firestoreDb = getFirestore(app, config.firestoreDatabaseId);

  const primaryDocRef = doc(firestoreDb, 'app_data', 'primary');
  let currentFirestoreData = null;
  try {
    const snap = await getDoc(primaryDocRef);
    if (snap.exists()) {
      currentFirestoreData = snap.data();
    }
  } catch (err) {
    console.warn('Could not read existing doc in Firestore:', err.message);
  }

  const firestorePayload = {
    profile: (currentFirestoreData && currentFirestoreData.profile) || localDb.profile,
    kelas: localDb.kelas,
    siswa: localDb.siswa,
    jadwal: localDb.jadwal,
    agenda: localDb.agenda,
    penilaianExtra: localDb.penilaianExtra,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(primaryDocRef, firestorePayload, { merge: true });
  console.log('✅ Berhasil injeksi ke Database Real Firebase Firestore!');
  console.log(`Summary: ${newSiswaList.length} siswa, ${newAgendas.length} pertemuan agenda, 2 jadwal disuntikkan.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Injeksi gagal:', err);
  process.exit(1);
});
