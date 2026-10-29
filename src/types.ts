export type PresensiStatus = 'hadir' | 'sakit' | 'ijin' | 'alpa' | 'dispen' | 'magang';

export interface PresensiDetail {
  siswaId: string;
  status: PresensiStatus;
  keterangan?: string;
  catatan?: string;
}

export type GradeHuruf =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D'
  | 'E';

export interface NilaiSiswa {
  siswaId: string;
  nilai: number;
  gradeHuruf?: GradeHuruf | string;
  statusTugas?: 'Sudah' | 'Belum'; // Penilaian ceklis / penugasan (Sudah/Belum mengumpulkan)
  catatan?: string;
  keterangan?: string;
}

export interface TeacherProfile {
  namaGuru: string;
  nip: string;
  mapelUtama: string;
  namaSekolah: string;
  alamatSekolah: string;
  namaKepsek: string;
  nipKepsek: string;
  logoSekolahUrl?: string;
  fotoProfilUrl?: string;
  tahunAjaran: string;
  semester: 'Ganjil' | 'Genap';
  pin: string; // 4-digit numeric PIN
}

export interface Kelas {
  id: string;
  namaKelas: string;
  tingkat: string;
  jurusan: string;
  tahunAjaran: string;
  waliKelas?: string;
  jumlahSiswa?: number;
}

export interface Siswa {
  id: string;
  kelasId: string;
  nis: string;
  nisn?: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  isMagang?: boolean;
}

export type HariName = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat';

export interface JadwalMengajar {
  id: string;
  kelasId: string;
  mapel: string;
  hari: HariName;
  jamKe: string; // e.g., "1 - 3"
  jamMulai: string; // e.g., "07:00"
  jamSelesai: string; // e.g., "09:15"
  ruangan: string;
}

export interface PenilaianSession {
  id: string;
  agendaId?: string;
  kelasId: string;
  mapel: string;
  tanggal: string;
  jenisPenilaian: 'Formatif' | 'Sumatif' | 'Tugas' | 'UH' | 'UTS' | 'UAS' | 'Ceklis';
  skalaPenilaian?: 'angka' | 'huruf' | 'ceklis'; // 'angka' (0-100), 'huruf' (A+, A, A-, B, dst), atau 'ceklis' (Sudah / Belum)
  namaPenilaian: string;
  kkm: number;
  daftarNilai: NilaiSiswa[];
}

export interface AgendaMengajar {
  id: string;
  jadwalId: string;
  kelasId: string;
  mapel: string;
  tanggal: string; // YYYY-MM-DD
  pertemuanKe: number;
  materi: string;
  capaianPembelajaran: string; // CP / KD
  indikator: string;
  catatanKejadian: string;
  refleksiGuru: string;
  tindakLanjut: string;
  presensi: PresensiDetail[];
  adaPenilaian: boolean;
  penilaian?: PenilaianSession;
  created_at: string;
  updated_at?: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'jadwal'
  | 'kelas_siswa'
  | 'agenda'
  | 'penilaian'
  | 'rekap_presensi'
  | 'laporan'
  | 'backup'
  | 'pengaturan';

export interface ClassBackupInfo {
  kelasId: string;
  namaKelas: string;
  classFolderId?: string;
  classFolderUrl?: string;
  docId?: string;
  docUrl?: string;
  sheetId?: string;
  sheetUrl?: string;
  lastSynced?: string;
  status: 'synced' | 'pending' | 'error';
  errorMessage?: string;
}

export interface GoogleBackupStatus {
  isAuthenticated: boolean;
  userEmail?: string;
  rootFolderId?: string;
  rootFolderUrl?: string;
  lastBackupTime?: string;
  totalAgendas: number;
  totalPresensi: number;
  totalNilai: number;
  classBackups: Record<string, ClassBackupInfo>;
  statusMessage?: string;
  isBackingUp: boolean;
  lastError?: string;
}

export interface CloudflareConfig {
  workerUrl: string;
  apiKey: string;
  autoSync: boolean;
  lastSyncTime?: string;
  isCustomServer?: boolean;
}

export interface CloudflareSyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error';
  message: string;
  lastSync?: string;
}

export interface GoogleConnectionInfo {
  email: string;
  displayName?: string;
  photoURL?: string;
  connectedAt?: string;
}

export interface AppData {
  profile: TeacherProfile;
  kelas: Kelas[];
  siswa: Siswa[];
  jadwal: JadwalMengajar[];
  agenda: AgendaMengajar[];
  penilaianExtra?: PenilaianSession[];
  googleConnection?: GoogleConnectionInfo | null;
  updatedAt?: string;
}
