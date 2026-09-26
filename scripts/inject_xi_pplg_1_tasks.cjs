const fs = require('fs');
const path = require('path');

const KELAS_ID = 'k-xi-pplg-1';

const rawCsv = `No;Nama Peserta (PPLG1);HTML Dasar (6/8);HTML Praktek;Ulangan Bootstrap;IBM;Bootstrap Praktek
1;AHMAD DWI NUR HIDAYAT;84;B;48;done;B
2;AHMAD FATHAN ALVARO;84;B;0;done;B
3;AIRA DWIKA GASILIA;79;A;53;done;B
4;AKMAL NI'AM ZULFAN;0;-;53;done;-
5;ALKASI SAHDIKA;78;B;0;done;B
6;ANINDIYA MUSTIKA NARESWARI;54;B;42;done;B-
7;AZ-AZAHRA SUCI MAHARANI;85;B;0;done;B
8;BRYAN PRATAMA NUGRAHA;88;C;0;-;B
9;CEDRIC ALI DZAKI SUGIHARTOKO;-;-;0;-;-
10;CHARENITO ASYRAF RIZKI AKBAR;-;-;41;done;B
11;CLAIRINE FARRA NATHANIA;71;C;53;done;B-
12;DESTIANA HAKIKI;79;B;47;done;B-
13;DEVI SANDRA AULIYA;-;-;53;done;-
14;DINAS VIRYA GARA PUTRA;-;-;41;-;B
15;DODDY NATHANAEL NUGROHO;84;-;64;-;B
16;ELANG PAMUNGKAS;85;B;62;done;B+
17;FASHA PUTRI AZZAHRA;86;A;0;done;B
18;ISNAIN AHMAD JAUHARI;94;B;0;done;B
19;KEISHA FEBRIANA;91;A;0;done;B
20;KENZIE DAMAR RADHIKA FAUSI;-;-;0;belum;-
21;KEZIA YUSTINA FEBRIYANTI;86;A+;0;done;B-
22;MAHESWARA HARTANTO;70;C;70;done;B
23;MUHAMAD ALVIS SAFITRA;83;B;51;-;B-
24;MUHAMMAD DEAZKA;88;B;0;done;B
25;MUHAMMAD FABIAN ZAHIR ATALLAH;90;B-;53;-;B+
26;MUHAMMAD FACHRI ROHMAN;90;B;0;done;B+
27;MUHAMMAD REFAN SYAHPUTRA;90;B;0;-;B-
28;MUHAMMAD RIZQI KURNIAWAN;88;B-;0;done;B+
29;MUHAMMAD TAUFIQ HIDAYAT;88;B;52;done;B+
30;NAJWA KHOIRUNNISA;79;B;49;-;B-
31;NAJWA SWETA RAHMADISTY RAHARJO;-;B;57;-;B-
32;PRAWIRA DWIMADYA;-;-;0;-;-
33;SATRIA ADI WIBOWO OLII;88;B;0;done;B
34;SYIFA SALSABILA MAHESWARI;88;B;0;done;B
35;WINNER HANA SAVERIO;85;C;0;done;B`;

const gradeToNumberMap = {
  'A+': 95,
  'A': 90,
  'A-': 85,
  'B+': 80,
  'B': 75,
  'B-': 70,
  'C+': 65,
  'C': 60,
  'C-': 55,
  'D': 50,
  'E': 40
};

async function main() {
  const dbPath = path.join(__dirname, '..', 'data', 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  const students = db.siswa.filter(s => s.kelasId === KELAS_ID);
  console.log(`Found ${students.length} students for ${KELAS_ID}`);

  const lines = rawCsv.trim().split('\n');
  const rows = lines.slice(1).map(l => l.split(';').map(c => c.trim()));

  // 1. Session: HTML Dasar (6/8)
  const htmlDasarSession = {
    id: 'pen-xi-pplg1-html-dasar',
    kelasId: KELAS_ID,
    namaPenilaian: 'HTML Dasar (6/8)',
    jenisPenilaian: 'Tugas',
    skalaPenilaian: 'angka',
    mapel: 'Pemrograman Web',
    tanggal: '2025-08-06',
    kkm: 75,
    daftarNilai: []
  };

  // 2. Session: HTML Praktek
  const htmlPraktekSession = {
    id: 'pen-xi-pplg1-html-praktek',
    kelasId: KELAS_ID,
    namaPenilaian: 'HTML Praktek',
    jenisPenilaian: 'Tugas',
    skalaPenilaian: 'huruf',
    mapel: 'Pemrograman Web',
    tanggal: '2025-08-13',
    kkm: 75,
    daftarNilai: []
  };

  // 3. Session: Ulangan Bootstrap
  const ulanganBootstrapSession = {
    id: 'pen-xi-pplg1-ulangan-bootstrap',
    kelasId: KELAS_ID,
    namaPenilaian: 'Ulangan Bootstrap',
    jenisPenilaian: 'UH',
    skalaPenilaian: 'angka',
    mapel: 'Pemrograman Web',
    tanggal: '2025-08-27',
    kkm: 75,
    daftarNilai: []
  };

  // 4. Session: IBM
  const ibmSession = {
    id: 'pen-xi-pplg1-ibm',
    kelasId: KELAS_ID,
    namaPenilaian: 'IBM',
    jenisPenilaian: 'Ceklis',
    skalaPenilaian: 'ceklis',
    mapel: 'Pemrograman Web',
    tanggal: '2025-09-03',
    kkm: 75,
    daftarNilai: []
  };

  // 5. Session: Bootstrap Praktek
  const bootstrapPraktekSession = {
    id: 'pen-xi-pplg1-bootstrap-praktek',
    kelasId: KELAS_ID,
    namaPenilaian: 'Bootstrap Praktek',
    jenisPenilaian: 'Tugas',
    skalaPenilaian: 'huruf',
    mapel: 'Pemrograman Web',
    tanggal: '2025-09-10',
    kkm: 75,
    daftarNilai: []
  };

  rows.forEach((row, idx) => {
    const no = parseInt(row[0], 10);
    const namaFromCsv = row[1];
    const valHtmlDasar = row[2];
    const valHtmlPraktek = row[3];
    const valUlanganBootstrap = row[4];
    const valIbm = row[5];
    const valBootstrapPraktek = row[6];

    // Find student by index or matching name
    let student = students[idx];
    if (!student || student.nama.toLowerCase() !== namaFromCsv.toLowerCase()) {
      const found = students.find(s => s.nama.toLowerCase() === namaFromCsv.toLowerCase());
      if (found) student = found;
    }

    if (!student) {
      console.warn(`Student not found for row ${no}: ${namaFromCsv}`);
      return;
    }

    const sId = student.id;

    // 1. HTML Dasar (numeric)
    let numHtmlDasar = 0;
    let statusHtmlDasar = 'Belum';
    if (valHtmlDasar && valHtmlDasar !== '-' && !isNaN(parseFloat(valHtmlDasar))) {
      numHtmlDasar = parseFloat(valHtmlDasar);
      statusHtmlDasar = numHtmlDasar > 0 ? 'Sudah' : 'Belum';
    }
    htmlDasarSession.daftarNilai.push({
      siswaId: sId,
      nilai: numHtmlDasar,
      statusTugas: statusHtmlDasar,
      catatan: valHtmlDasar === '-' ? 'Belum mengumpulkan' : ''
    });

    // 2. HTML Praktek (letter grade)
    let gradeHtmlPraktek = undefined;
    let statusHtmlPraktek = 'Belum';
    let numericHtmlPraktek = 0;
    if (valHtmlPraktek && valHtmlPraktek !== '-') {
      gradeHtmlPraktek = valHtmlPraktek;
      statusHtmlPraktek = 'Sudah';
      numericHtmlPraktek = gradeToNumberMap[valHtmlPraktek] || 75;
    }
    htmlPraktekSession.daftarNilai.push({
      siswaId: sId,
      gradeHuruf: gradeHtmlPraktek,
      nilai: numericHtmlPraktek,
      statusTugas: statusHtmlPraktek,
      catatan: valHtmlPraktek === '-' ? 'Belum praktek' : ''
    });

    // 3. Ulangan Bootstrap (numeric)
    let numUlangan = 0;
    let statusUlangan = 'Belum';
    if (valUlanganBootstrap && valUlanganBootstrap !== '-' && !isNaN(parseFloat(valUlanganBootstrap))) {
      numUlangan = parseFloat(valUlanganBootstrap);
      statusUlangan = numUlangan > 0 ? 'Sudah' : 'Belum';
    }
    ulanganBootstrapSession.daftarNilai.push({
      siswaId: sId,
      nilai: numUlangan,
      statusTugas: statusUlangan,
      catatan: valUlanganBootstrap === '-' ? 'Belum ulangan' : ''
    });

    // 4. IBM (checklist / status)
    const isDoneIbm = (valIbm || '').toLowerCase() === 'done';
    ibmSession.daftarNilai.push({
      siswaId: sId,
      statusTugas: isDoneIbm ? 'Sudah' : 'Belum',
      nilai: isDoneIbm ? 100 : 0,
      catatan: isDoneIbm ? 'Sertifikasi / Kursus IBM Selesai' : (valIbm === 'belum' ? 'Sedang proses' : 'Belum selesai')
    });

    // 5. Bootstrap Praktek (letter grade)
    let gradeBootstrapPraktek = undefined;
    let statusBootstrapPraktek = 'Belum';
    let numericBootstrapPraktek = 0;
    if (valBootstrapPraktek && valBootstrapPraktek !== '-') {
      gradeBootstrapPraktek = valBootstrapPraktek;
      statusBootstrapPraktek = 'Sudah';
      numericBootstrapPraktek = gradeToNumberMap[valBootstrapPraktek] || 75;
    }
    bootstrapPraktekSession.daftarNilai.push({
      siswaId: sId,
      gradeHuruf: gradeBootstrapPraktek,
      nilai: numericBootstrapPraktek,
      statusTugas: statusBootstrapPraktek,
      catatan: valBootstrapPraktek === '-' ? 'Belum praktek' : ''
    });
  });

  const newSessions = [
    htmlDasarSession,
    htmlPraktekSession,
    ulanganBootstrapSession,
    ibmSession,
    bootstrapPraktekSession
  ];

  // Filter out mock/dummy sessions for XI PPLG 1 ('pen-xi-pplg1-tugas1' & 'pen-xi-pplg1-proyek'),
  // keep 'pen-xi-pplg1-presensi', and remove any previous versions of these 5 sessions
  const newSessionIds = new Set(newSessions.map(s => s.id));
  const dummyIds = new Set(['pen-xi-pplg1-tugas1', 'pen-xi-pplg1-proyek']);

  db.penilaianExtra = db.penilaianExtra.filter(p => {
    if (p.kelasId === KELAS_ID) {
      if (dummyIds.has(p.id)) return false;
      if (newSessionIds.has(p.id)) return false;
    }
    return true;
  });

  // Prepend or add new sessions
  db.penilaianExtra.unshift(...newSessions);
  db.updatedAt = new Date().toISOString();

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`✅ Berhasil menginjeksi 5 sesi penilaian ke data/db.json! Total penilaian sekarang: ${db.penilaianExtra.length}`);

  // Try updating Firestore app_data/current if configured
  try {
    const { initializeApp } = require('firebase/app');
    const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');
    const firebaseConfig = require('../firebase-applet-config.json');
    if (firebaseConfig && firebaseConfig.projectId) {
      const app = initializeApp(firebaseConfig);
      const fsDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      const primaryDoc = doc(fsDb, 'app_data', 'current');
      const cleanPenilaianExtra = JSON.parse(JSON.stringify(db.penilaianExtra));
      await setDoc(primaryDoc, {
        penilaianExtra: cleanPenilaianExtra,
        updatedAt: db.updatedAt
      }, { merge: true });
      console.log('✅ Berhasil menyelaraskan penilaianExtra ke Firestore app_data/current!');
    }
  } catch (fsErr) {
    console.warn('⚠️ Catatan Firestore (sinkronisasi lokal berhasil):', fsErr.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
