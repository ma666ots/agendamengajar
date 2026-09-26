// Utility for Generative Agenda and Curriculum Progression
// Supports automatic generation when entering code "oke123"

export interface GeneratedAgendaContent {
  materi: string;
  capaianPembelajaran: string;
  indikator: string;
  catatanKejadian: string;
  refleksiGuru: string;
  tindakLanjut: string;
}

export interface AttendanceSummary {
  hadir: number;
  sakit: number;
  ijin: number;
  alpa: number;
  dispen: number;
  magang: number;
  total: number;
}

// Curriculum Topics for Kelas XI (Pemrograman Web / PPLG)
const KURIKULUM_XI: Record<number, { materi: string; cp: string; indikator: string }> = {
  1: {
    materi: "Kontrak Belajar, Pengenalan Lingkungan Pemrograman Web & Arsitektur Client-Server",
    cp: "Peserta didik mampu memahami alur kerja arsitektur web client-server, instalasi text editor, browser devtools, serta menyepakati kontrak belajar dan asesmen.",
    indikator: "1. Mampu menjelaskan konsep client, server, dan protokol HTTP\n2. Mampu menyiapkan lingkungan pengembangan web lokal\n3. Mampu menaati tata tertib lab dan kontrak belajar.",
  },
  2: {
    materi: "Struktur Dasar Dokumen HTML5, Tag Semantik & Hirarki Elemen",
    cp: "Peserta didik mampu menyusun struktur halaman web standar menggunakan tag semantik HTML5 dengan hirarki penulisan kode yang valid.",
    indikator: "1. Mampu membuat kerangka dasar HTML5 (!DOCTYPE, html, head, body)\n2. Mampu menerapkan heading h1-h6 dan paragraf secara tepat\n3. Mampu menggunakan elemen semantik (header, nav, main, footer).",
  },
  3: {
    materi: "Format Teks, List (Ordered & Unordered), dan Tautan Antarhalaman (Hyperlink)",
    cp: "Peserta didik mampu mengelola navigasi dokumen web antarmuka dan memformat teks daftar secara terstruktur.",
    indikator: "1. Mampu membuat daftar bernomor (ol) dan tanpa nomor (ul)\n2. Mampu menghubungkan tautan internal dan eksternal menggunakan anchor link (a)\n3. Mampu membuat menu navigasi website sederhana.",
  },
  4: {
    materi: "Penyisipan Media Digital (Gambar, Audio, Video) & Elemen Iframe Responsif",
    cp: "Peserta didik mampu mengintegrasikan ragam konten multimedia digital pada halaman web dengan atribut rasio yang optimal.",
    indikator: "1. Mampu menyisipkan gambar dengan atribut alt, width, dan height\n2. Mampu mengoperasikan pemutar audio dan video HTML5\n3. Mampu menyematkan peta atau video luar menggunakan tag iframe responsif.",
  },
  5: {
    materi: "Penyusunan Tabel Data & Elemen Formulir Input (Form) Interaktif HTML",
    cp: "Peserta didik mampu merancang tata letak tabel data berstruktur serta formulir interaktif pengumpulan data pengguna.",
    indikator: "1. Mampu membuat tabel dengan thead, tbody, colspan, dan rowspan\n2. Mampu menyusun berbagai kontrol input (text, email, password, number, radio, checkbox)\n3. Mampu melengkapi form dengan tombol submit dan validasi HTML5.",
  },
  6: {
    materi: "Dasar-Dasar Styling CSS3, Selektor & Model Kotak (Box Model)",
    cp: "Peserta didik mampu menerapkan pewarnaan, tipografi, dan pengaturan ruang elemen menggunakan selektor CSS serta pemahaman Box Model.",
    indikator: "1. Mampu menghubungkan berkas eksternal CSS ke halaman HTML\n2. Mampu memahami perbedaan margin, border, padding, dan content\n3. Mampu menerapkan selektor class, id, serta pseudo-class dasar.",
  },
  7: {
    materi: "Tata Letak Halaman Web Modern Menggunakan CSS Flexbox & Responsive Layout",
    cp: "Peserta didik mampu merancang tampilan web responsif yang menyesuaikan ukuran layar perangkat menggunakan teknik CSS Flexbox.",
    indikator: "1. Mampu mengonfigurasi flex container dan flex items (justify-content, align-items)\n2. Mampu membuat tata letak grid kartu informasi (cards layout)\n3. Mampu menerapkan media queries sederhana untuk tampilan mobile dan desktop.",
  },
  8: {
    materi: "Pengenalan Dasar Pemrograman Server-Side dengan PHP: Sintaks, Variabel, Tipe Data & Echo/Print",
    cp: "Peserta didik mampu memahami konsep pemrograman web sisi server (server-side scripting) menggunakan PHP serta mengimplementasikan sintaks dasar dan penanganan variabel.",
    indikator: "1. Mampu menuliskan sintaks pembuka dan penutup PHP dengan benar\n2. Mampu mendeklarasikan variabel dan tipe data dasar PHP\n3. Mampu menampilkan output dinamis ke antarmuka web menggunakan echo dan print.",
  },
  9: {
    materi: "Struktur Kontrol Logika PHP: Percabangan (IF-ELSE, SWITCH) & Perulangan (FOR, WHILE, FOREACH)",
    cp: "Peserta didik mampu mengimplementasikan alur logika pengambilan keputusan dan pengulangan proses data pada bahasa pemrograman PHP.",
    indikator: "1. Mampu membuat logika kondisi if, else if, dan switch-case\n2. Mampu menjalankan perulangan for dan while untuk pencetakan data berulang\n3. Mampu memanfaatkan foreach untuk membaca elemen array asosiatif.",
  },
  10: {
    materi: "Pengelolaan Array, Fungsi Modular & Pengolahan Data Form (Method GET & POST)",
    cp: "Peserta didik mampu mengorganisasi data menggunakan array multidimensi serta menangani pengiriman data dari formulir web menggunakan method GET dan POST.",
    indikator: "1. Mampu membuat fungsi buatan sendiri (user-defined function) dengan parameter dan return value\n2. Mampu menangani request data form ($_GET dan $_POST) secara aman\n3. Mampu melakukan sanitasi input data sederhana.",
  },
  11: {
    materi: "Koneksi PHP ke Basis Data Relasional MySQL / MariaDB (MySQLi & PDO)",
    cp: "Peserta didik mampu menghubungkan script backend PHP dengan basis data MySQL serta mengelola status koneksi secara terstruktur.",
    indikator: "1. Mampu mengonfigurasi parameter host, user, password, dan nama database\n2. Mampu mendeteksi dan menangani galat (error handling) saat kegagalan koneksi\n3. Mampu memisahkan berkas konfigurasi koneksi secara modular (koneksi.php).",
  },
  12: {
    materi: "Operasi CRUD Sederhana: Implementasi Create (Tambah Data) & Read (Tampil Data)",
    cp: "Peserta didik mampu membangun alur penambahan rekaman data baru ke database dan menampilkannya kembali dalam bentuk tabel antarmuka web.",
    indikator: "1. Mampu menulis query INSERT INTO dan mengeksekusinya via PHP\n2. Mampu menulis query SELECT dan mengulang hasil query ke baris tabel HTML\n3. Mampu memberikan notifikasi status penyimpanan data berhasil.",
  },
  13: {
    materi: "Operasi CRUD Lanjutan: Implementasi Update (Edit Data) & Delete (Hapus Data)",
    cp: "Peserta didik mampu menyempurnakan fitur pengelolaan data dengan menyediakan formulir ubah data berdasar ID serta mekanisme konfirmasi penghapusan.",
    indikator: "1. Mampu mengambil data rekaman berdasarkan parameter URL ID\n2. Mampu mengeksekusi query UPDATE data form\n3. Mampu membuat dialog konfirmasi sebelum query DELETE dijalankan.",
  },
  14: {
    materi: "Manajemen Autentikasi Pengguna: Session, Cookies, Enkripsi Password & Proteksi Halaman Admin",
    cp: "Peserta didik mampu menerapkan sistem autentikasi login pengguna dengan validasi keamanan enkripsi password dan pembatasan akses halaman privat.",
    indikator: "1. Mampu menggunakan password_hash() dan password_verify()\n2. Mampu menginisiasi session_start() dan menyimpan data user login\n3. Mampu membatasi akses URL admin bagi pengguna yang belum terautentikasi.",
  },
  15: {
    materi: "Penyempurnaan Antarmuka Web dengan Framework CSS & Pembuatan Fitur Upload Berkas",
    cp: "Peserta didik mampu mempercantik tampilan sistem web berbasis framework antarmuka serta mengimplementasikan fitur unggah dokumen/foto ke direktori server.",
    indikator: "1. Mampu mengintegrasikan template Tailwind / Bootstrap pada sistem PHP\n2. Mampu mengonfigurasi form enctype multipart/form-data\n3. Mampu memvalidasi ekstensi dan batas ukuran file yang diunggah.",
  },
  16: {
    materi: "Pembuatan Laporan Data (Cetak PDF / Excel) & Asesmen Sumatif Proyek Mini Web",
    cp: "Peserta didik mampu mengintegrasikan pustaka pencetakan laporan tabular serta mempresentasikan hasil karya sistem web dinamis secara menyeluruh.",
    indikator: "1. Mampu mengonversi data tabel ke format siap cetak (print view / PDF)\n2. Mampu mendemonstrasikan seluruh alur CRUD dan autentikasi sistem\n3. Mampu menjawab pertanyaan teknis saat sesi evaluasi hasil karya.",
  },
};

// Curriculum Topics for Kelas XII (Pemrograman Web Lanjutan / Fullstack / PPLG)
const KURIKULUM_XII: Record<number, { materi: string; cp: string; indikator: string }> = {
  1: {
    materi: "Kontrak Belajar, Orientasi Kurikulum, dan Pengenalan Arsitektur Aplikasi Web Modern (Client-Server & MVC)",
    cp: "Peserta didik mampu memahami alur arsitektur web modern, pemisahan layer Model-View-Controller (MVC), dan standar industri pengembangan aplikasi.",
    indikator: "1. Mampu mengidentifikasi peran Model, View, dan Controller\n2. Mampu menjelaskan arsitektur monolithic vs decoupled API\n3. Mampu menyepakati alur kerja proyek dan kontrak belajar semester.",
  },
  2: {
    materi: "Setup Lingkungan Pengembangan Web (Dev Environment), Package Manager & Struktur Folder Framework Backend",
    cp: "Peserta didik mampu melakukan inisialisasi lingkungan kerja backend menggunakan runtime modern, instalasi dependensi, dan memahami struktur folder proyek.",
    indikator: "1. Mampu mengoperasikan package manager (npm / composer)\n2. Mampu mengonfigurasi berkas environment variables (.env)\n3. Mampu menjalankan local development server backend secara lancar.",
  },
  3: {
    materi: "Konsep RESTful API: Perancangan Endpoint, Routing, Controller, dan Response Berformat JSON",
    cp: "Peserta didik mampu membuat routing endpoint RESTful API terstandarisasi dengan kode status HTTP dan format balasan data JSON.",
    indikator: "1. Mampu mendesain skema URI endpoint (GET, POST, PUT, DELETE)\n2. Mampu mengisolasi logika bisnis pada controller handler\n3. Mampu mengembalikan response JSON konsisten dengan status HTTP yang tepat.",
  },
  4: {
    materi: "Pengujian Endpoint API dengan Postman dan Validasi Data Request Input",
    cp: "Peserta didik mampu menguji API menggunakan tool Postman/Thunder Client serta menerapkan skema validasi ketat pada request body dan headers.",
    indikator: "1. Mampu menyusun koleksi request pengujian endpoint\n2. Mampu menerapkan skema validasi tipe data dan data wajib (required)\n3. Mampu mengembalikan pesan galat validasi yang deskriptif.",
  },
  5: {
    materi: "Model dan Migrasi Basis Data Relasional: Perancangan Skema Tabel dan Tipe Kolom",
    cp: "Peserta didik mampu merancang skema tabel database relasional menggunakan migration tools / ORM modern secara terstruktur.",
    indikator: "1. Mampu menulis skrip migrasi tabel dan menentukan tipe data kolom\n2. Mampu menetapkan primary key, foreign key, dan indeks unik\n3. Mampu menjalankan eksekusi dan rollback migrasi database.",
  },
  6: {
    materi: "Manajemen Relasi Tabel (One-to-Many & Many-to-Many) Menggunakan ORM / Query Builder",
    cp: "Peserta didik mampu menghubungkan antar entitas tabel relasional serta mengeksekusi query join relasi data secara efisien.",
    indikator: "1. Mampu mendefinisikan relasi antar entitas pada berkas model\n2. Mampu memuat relasi data (eager loading vs lazy loading)\n3. Mampu mencegah masalah inefisiensi query (N+1 query problem).",
  },
  7: {
    materi: "Operasi CRUD Lengkap: Implementasi Create & Read dengan Paginasi dan Sorting Data",
    cp: "Peserta didik mampu membangun endpoint penyimpanan data baru serta pembacaan kumpulan data dengan fitur paginasi dan pengurutan dinamis.",
    indikator: "1. Mampu menyimpan data relasional ke database via ORM\n2. Mampu membatasi jumlah data per halaman (limit & offset)\n3. Mampu mengurutkan rekaman data berdasar kolom tertentu.",
  },
  8: {
    materi: "Operasi CRUD Lengkap: Implementasi Update & Delete dengan Soft Delete / Hard Delete",
    cp: "Peserta didik mampu menyempurnakan fitur manipulasi data backend dengan penanganan pembaruan parsial serta mekanisme penghapusan aman.",
    indikator: "1. Mampu memperbarui data berdasar identifier unik\n2. Mampu menerapkan soft delete (penanda deleted_at) untuk preservasi data\n3. Mampu mengembalikan response konfirmasi penghapusan data.",
  },
  9: {
    materi: "Sistem Autentikasi Pengguna: Hashing Password dengan Bcrypt dan Manajemen Registrasi Akun",
    cp: "Peserta didik mampu menerapkan registrasi pengguna dengan pengamanan kata sandi menggunakan algoritma hashing satu arah (Bcrypt).",
    indikator: "1. Mampu membuat endpoint pendaftaran akun pengguna baru\n2. Mampu melakukan hashing password dengan salt rounds yang aman\n3. Mampu mencegah duplikasi akun melalui validasi email/username unik.",
  },
  10: {
    materi: "Finalisasi Proyek Akhir Aplikasi Web Terintegrasi dan Dokumentasi API (Swagger / Postman Collection)",
    cp: "Peserta didik mampu menuntaskan pengembangan proyek aplikasi web skala penuh (fullstack) serta menyusun dokumentasi teknis API yang terstandarisasi.",
    indikator: "1. Mampu mengintegrasikan seluruh modul backend dan frontend secara seamless\n2. Mampu menyusun dokumentasi endpoint API lengkap dengan contoh payload request/response\n3. Mampu melakukan uji kelayakan akhir sebelum peluncuran sistem.",
  },
  11: {
    materi: "Autentikasi Token JWT (JSON Web Token): Pembuatan Token Login dan Verifikasi Payload",
    cp: "Peserta didik mampu merancang sistem autentikasi stateless berbasis token JWT lengkap dengan payload identitas dan masa kedaluwarsa token.",
    indikator: "1. Mampu memverifikasi kecocokan kredensial login\n2. Mampu menerbitkan token JWT dengan secret key yang aman\n3. Mampu menguraikan payload token pada permintaan berikutnya.",
  },
  12: {
    materi: "Middleware Keamanan dan Otorisasi Hak Akses (Role-Based Access Control / RBAC)",
    cp: "Peserta didik mampu mengamankan endpoint privat dengan middleware otorisasi berbasis peran (misal: Administrator, Guru, Siswa).",
    indikator: "1. Mampu membuat middleware inspeksi header Authorization Bearer\n2. Mampu menolak request jika token tidak valid atau kedaluwarsa\n3. Mampu membatasi akses hak tindakan berdasar role pengguna.",
  },
  13: {
    materi: "Pengelolaan Upload File, Validasi MIME Type, dan Penyimpanan Media pada Server",
    cp: "Peserta didik mampu mengelola unggahan media berkas digital, validasi tipe MIME, serta penyimpanan berkas statis pada server aplikasi.",
    indikator: "1. Mampu menangani request berformat multipart/form-data\n2. Mampu memfilter format ekstensi dan ukuran batas maksimal berkas\n3. Mampu menyimpan nama berkas unik dan menautkannya ke database.",
  },
  14: {
    materi: "Integrasi Frontend SPA: Setup Framework Frontend, Komponen UI, dan State Management",
    cp: "Peserta didik mampu membangun antarmuka web modern berbasis Single Page Application (SPA) dan mengelola status aplikasi secara reaktif.",
    indikator: "1. Mampu menyusun struktur komponen modular antarmuka\n2. Mampu mengelola state lokal dan state global aplikasi\n3. Mampu mengonfigurasi client-side routing antar halaman.",
  },
  15: {
    materi: "Data Fetching Frontend: Mengkonsumsi REST API Backend (GET, POST) dengan Handling Loading State",
    cp: "Peserta didik mampu melakukan integrasi konsumsi endpoint REST API dari sisi frontend serta mengelola visual feedback proses pemuatan data.",
    indikator: "1. Mampu melakukan asynchronous data request (Fetch / Axios)\n2. Mampu menampilkan skeleton / spinner saat request berlangsung\n3. Mampu menangani pesan kesalahan jaringan secara user-friendly.",
  },
  16: {
    materi: "Penyimpanan Token pada Sisi Klien, Auth Guard Routing, dan Logout Session",
    cp: "Peserta didik mampu mengamankan penyimpanan token autentikasi di peramban serta memproteksi rute antarmuka pengguna.",
    indikator: "1. Mampu menyimpan token pada secure storage browser\n2. Mampu membuat auth guard untuk mencegah akses rute tak terotorisasi\n3. Mampu menghapus token dan membersihkan state aplikasi saat logout.",
  },
  17: {
    materi: "Pengujian Terintegrasi (End-to-End Testing), Penanganan Bug & Optimasi Kode Aplikasi Web",
    cp: "Peserta didik mampu melakukan pengujian komprehensif alur kerja sistem, identifikasi bug, serta optimasi efisiensi kode program.",
    indikator: "1. Mampu menguji alur kerja pengguna dari hulu ke hilir\n2. Mampu mendeteksi dan menyelesaikan galat fungsional (bug fixing)\n3. Mampu merapikan kode sesuai standar konvensi penulisan bersih.",
  },
  18: {
    materi: "Asesmen Sumatif / Evaluasi Tengah Semester: Review Proyek Web Portofolio & Penilaian Kinerja",
    cp: "Peserta didik mampu mendemonstrasikan kemajuan proyek web portofolio, memaparkan arsitektur sistem, dan menerima masukan evaluasi teknis.",
    indikator: "1. Mampu mempresentasikan arsitektur dan fungsionalitas aplikasi\n2. Mampu menjawab pertanyaan teknis seputar struktur database dan API\n3. Mampu mencatat rekomendasi perbaikan untuk penyempurnaan proyek.",
  },
  19: {
    materi: "Penyempurnaan Fitur dan Refactoring Kode Proyek Web Berdasarkan Feedback Evaluasi",
    cp: "Peserta didik mampu melakukan refactoring kode, penanganan bug, dan optimasi performa arsitektur aplikasi web fullstack berdasarkan hasil evaluasi proyek tengah semester.",
    indikator: "1. Mampu mengidentifikasi celah atau bug pada endpoint API dan antarmuka pengguna\n2. Mampu menerapkan prinsip clean code dan optimasi query database\n3. Mampu mendokumentasikan log perbaikan kode (changelog) dengan rapi.",
  },
  20: {
    materi: "Optimasi Kinerja Aplikasi Web, Konfigurasi Server Production, dan Deployment Cloud",
    cp: "Peserta didik mampu mempersiapkan konfigurasi environment production, build bundling antarmuka, serta mendeploy sistem ke layanan cloud hosting.",
    indikator: "1. Mampu melakukan proses build produksi aplikasi frontend dan backend\n2. Mampu mengonfigurasi variabel lingkungan server production\n3. Mampu memverifikasi keberhasilan akses aplikasi pada domain publik.",
  },
};

/**
 * Main generator function that generates coherent, continuous curriculum content
 * when code "oke123" is entered.
 */
export function generateCurriculumAgenda(
  tingkat: 'XI' | 'XII' | string,
  pertemuanKe: number,
  mapel: string = 'Pemrograman Web',
  attendance?: AttendanceSummary,
  userTopicOverride?: string
): GeneratedAgendaContent {
  const isKelasXII = tingkat.includes('XII') || tingkat.includes('12');
  const dataset = isKelasXII ? KURIKULUM_XII : KURIKULUM_XI;

  // Find exact meeting topic or interpolate
  let topic = dataset[pertemuanKe];
  if (!topic) {
    // If beyond max in dataset, cycle or build sequential advanced topic
    const maxKeys = Object.keys(dataset).map(Number).sort((a, b) => a - b);
    const lastKey = maxKeys[maxKeys.length - 1];
    const baseTopic = dataset[lastKey];

    topic = {
      materi: `Pengembangan Lanjutan Pertemuan Ke-${pertemuanKe}: Implementasi Fitur Tambahan & Optimasi Proyek Web`,
      cp: `Peserta didik mampu mengimplementasikan fitur fungsional lanjutan, mengintegrasikan komponen sistem web, serta melakukan pengujian fungsionalitas.`,
      indikator: `1. Mampu merancang fitur pelengkap antarmuka dan backend\n2. Mampu menguji keandalan sistem secara mandiri\n3. Mampu menyelesaikan lembar kerja praktikum pertemuan ke-${pertemuanKe}.`,
    };
  }

  // Format attendance notes if summary provided
  let attendanceNote = '';
  if (attendance) {
    const parts: string[] = [];
    if (attendance.hadir > 0) parts.push(`${attendance.hadir} siswa hadir tepat waktu`);
    if (attendance.sakit > 0) parts.push(`${attendance.sakit} siswa izin sakit`);
    if (attendance.ijin > 0) parts.push(`${attendance.ijin} siswa izin urusan dinas/keluarga`);
    if (attendance.dispen > 0) parts.push(`${attendance.dispen} siswa dispensasi kegiatan sekolah`);
    if (attendance.magang > 0) parts.push(`${attendance.magang} siswa melaksanakan PKL / Magang Industri`);
    if (attendance.alpa > 0) parts.push(`${attendance.alpa} siswa tanpa keterangan (alpa)`);
    attendanceNote = parts.length > 0 ? ` Presensi: ${parts.join(', ')}.` : '';
  }

  const catatanKejadian = `Pembelajaran materi pertemuan ke-${pertemuanKe} di Lab Komputer berlangsung dengan tertib, interaktif, dan kondusif. Siswa antusias mempraktikkan materi melalui lembar kerja dan panduan guru.${attendanceNote}`;

  const refleksiGuru = `Siswa menunjukkan pemahaman yang baik dan antusiasme tinggi terhadap materi praktikum. Sebagian besar siswa dapat menyelesaikan tahapan kerja mandiri dengan lancar, sementara siswa yang mengalami kendala teknis mendapatkan pendampingan langsung oleh guru.`;

  const nextPertemuan = pertemuanKe + 1;
  const nextTopic = dataset[nextPertemuan];
  const nextMateriBrief = nextTopic ? nextTopic.materi.split(':')[0] : `materi lanjutan pertemuan ke-${nextPertemuan}`;

  const tindakLanjut = `Memberikan latihan mandiri / pengayaan berbasis studi kasus, serta mempersiapkan modul pengantar untuk ${nextMateriBrief} pada pertemuan ke-${nextPertemuan}.`;

  return {
    materi: userTopicOverride && userTopicOverride.trim().length > 3 && userTopicOverride.toLowerCase() !== 'oke123'
      ? userTopicOverride
      : topic.materi,
    capaianPembelajaran: topic.cp,
    indikator: topic.indikator,
    catatanKejadian,
    refleksiGuru,
    tindakLanjut,
  };
}

/**
 * Checks if an input string is the generative secret code 'oke123'
 */
export function isGenerativeCode(input: string): boolean {
  if (!input) return false;
  const clean = input.trim().toLowerCase().replace(/\s+/g, '');
  return clean === 'oke123' || clean === 'oke-123' || clean === '#oke123';
}
