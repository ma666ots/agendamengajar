import {
  TeacherProfile,
  Kelas,
  Siswa,
  JadwalMengajar,
  AgendaMengajar,
  PenilaianSession,
  CloudflareConfig,
} from '../types';
import { apiService, AppData } from '../services/apiService';
import {
  initialProfile,
  initialKelas,
  initialSiswa,
  initialJadwal,
  initialAgenda,
  initialPenilaianExtra,
} from '../data/initialData';

// Preference / UI keys only (not main app domain data)
const PREF_KEYS = {
  CLOUDFLARE_CONFIG: 'agenda_guru_cloudflare_config',
};

/**
 * Load all application data asynchronously from the database REST API
 */
export const loadAllData = async (): Promise<AppData> => {
  try {
    return await apiService.fetchAppData();
  } catch (err) {
    console.error('Failed to load data from database API:', err);
    // Return fallback initial structure if backend error occurs
    return {
      profile: initialProfile,
      kelas: initialKelas,
      siswa: initialSiswa,
      jadwal: initialJadwal,
      agenda: initialAgenda,
      penilaianExtra: initialPenilaianExtra,
    };
  }
};

/**
 * Save complete application state to database REST API
 */
export const saveAllData = async (data: AppData): Promise<AppData> => {
  return await apiService.saveAllData(data);
};

export const loadProfile = async (): Promise<TeacherProfile> => {
  try {
    return await apiService.getProfile();
  } catch {
    return initialProfile;
  }
};

export const saveProfile = async (profile: TeacherProfile): Promise<TeacherProfile> => {
  return await apiService.saveProfile(profile);
};

export const loadKelas = async (): Promise<Kelas[]> => {
  try {
    const appData = await apiService.fetchAppData();
    return appData.kelas;
  } catch {
    return initialKelas;
  }
};

export const saveKelas = async (data: Kelas): Promise<Kelas[]> => {
  return await apiService.saveKelas(data);
};

export const loadSiswa = async (): Promise<Siswa[]> => {
  try {
    const appData = await apiService.fetchAppData();
    return appData.siswa;
  } catch {
    return initialSiswa;
  }
};

export const saveSiswa = async (data: Siswa): Promise<Siswa[]> => {
  return await apiService.saveSiswa(data);
};

export const loadJadwal = async (): Promise<JadwalMengajar[]> => {
  try {
    const appData = await apiService.fetchAppData();
    return appData.jadwal;
  } catch {
    return initialJadwal;
  }
};

export const saveJadwal = async (data: JadwalMengajar): Promise<JadwalMengajar[]> => {
  return await apiService.saveJadwal(data);
};

export const loadAgenda = async (): Promise<AgendaMengajar[]> => {
  try {
    const appData = await apiService.fetchAppData();
    return appData.agenda;
  } catch {
    return initialAgenda;
  }
};

export const saveAgenda = async (data: AgendaMengajar): Promise<AgendaMengajar[]> => {
  return await apiService.saveAgenda(data);
};

export const loadPenilaianExtra = async (): Promise<PenilaianSession[]> => {
  try {
    const appData = await apiService.fetchAppData();
    return appData.penilaianExtra;
  } catch {
    return initialPenilaianExtra;
  }
};

export const savePenilaianExtra = async (data: PenilaianSession): Promise<PenilaianSession[]> => {
  return await apiService.savePenilaianExtra(data);
};

export const resetAllData = async (): Promise<AppData> => {
  return await apiService.resetData();
};

/**
 * Cloudflare Worker & D1 Database Configuration (Stored as UI Preference)
 */
export const getCloudflareConfig = (): CloudflareConfig => {
  try {
    const data = localStorage.getItem(PREF_KEYS.CLOUDFLARE_CONFIG);
    return data
      ? JSON.parse(data)
      : { workerUrl: '', apiKey: '', autoSync: true };
  } catch {
    return { workerUrl: '', apiKey: '', autoSync: true };
  }
};

export const saveCloudflareConfig = (config: CloudflareConfig) => {
  localStorage.setItem(PREF_KEYS.CLOUDFLARE_CONFIG, JSON.stringify(config));
};

/**
 * Generate complete MySQL Database Script (.sql)
 */
export const generateSqlDump = (data: AppData): string => {
  const profile = data.profile || initialProfile;
  const kelas = data.kelas || [];
  const siswa = data.siswa || [];
  const jadwal = data.jadwal || [];
  const agenda = data.agenda || [];
  const penilaianExtra = data.penilaianExtra || [];

  let sql = `-- ===================================================\n`;
  sql += `-- DATABASE DUMP - AGENDA MENGAJAR GURU\n`;
  sql += `-- Created on: ${new Date().toLocaleString('id-ID')}\n`;
  sql += `-- Sekolah: ${profile.namaSekolah}\n`;
  sql += `-- Guru: ${profile.namaGuru} (NIP: ${profile.nip})\n`;
  sql += `-- ===================================================\n\n`;

  sql += `CREATE DATABASE IF NOT EXISTS db_agenda_guru;\nUSE db_agenda_guru;\n\n`;

  // Profile Table
  sql += `-- Tabel Profile Guru\n`;
  sql += `DROP TABLE IF EXISTS teacher_profile;\n`;
  sql += `CREATE TABLE teacher_profile (\n`;
  sql += `  id INT PRIMARY KEY AUTO_INCREMENT,\n`;
  sql += `  nama_guru VARCHAR(150),\n`;
  sql += `  nip VARCHAR(50),\n`;
  sql += `  mapel_utama VARCHAR(100),\n`;
  sql += `  nama_sekolah VARCHAR(150),\n`;
  sql += `  alamat_sekolah TEXT,\n`;
  sql += `  nama_kepsek VARCHAR(150),\n`;
  sql += `  nip_kepsek VARCHAR(50),\n`;
  sql += `  tahun_ajaran VARCHAR(20),\n`;
  sql += `  semester VARCHAR(10),\n`;
  sql += `  pin VARCHAR(10)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  sql += `INSERT INTO teacher_profile (nama_guru, nip, mapel_utama, nama_sekolah, alamat_sekolah, nama_kepsek, nip_kepsek, tahun_ajaran, semester, pin) VALUES\n`;
  sql += `('${escapeSql(profile.namaGuru)}', '${escapeSql(profile.nip)}', '${escapeSql(profile.mapelUtama)}', '${escapeSql(profile.namaSekolah)}', '${escapeSql(profile.alamatSekolah)}', '${escapeSql(profile.namaKepsek)}', '${escapeSql(profile.nipKepsek)}', '${escapeSql(profile.tahunAjaran)}', '${escapeSql(profile.semester)}', '${escapeSql(profile.pin)}');\n\n`;

  // Kelas Table
  sql += `-- Tabel Kelas\n`;
  sql += `DROP TABLE IF EXISTS classes;\n`;
  sql += `CREATE TABLE classes (\n`;
  sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
  sql += `  nama_kelas VARCHAR(50),\n`;
  sql += `  tingkat VARCHAR(10),\n`;
  sql += `  jurusan VARCHAR(100),\n`;
  sql += `  tahun_ajaran VARCHAR(20)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (kelas.length > 0) {
    sql += `INSERT INTO classes (id, nama_kelas, tingkat, jurusan, tahun_ajaran) VALUES\n`;
    sql += kelas.map(k => `('${k.id}', '${escapeSql(k.namaKelas)}', '${escapeSql(k.tingkat)}', '${escapeSql(k.jurusan)}', '${escapeSql(k.tahunAjaran)}')`).join(',\n') + `;\n\n`;
  }

  // Siswa Table
  sql += `-- Tabel Siswa\n`;
  sql += `DROP TABLE IF EXISTS students;\n`;
  sql += `CREATE TABLE students (\n`;
  sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
  sql += `  kelas_id VARCHAR(50),\n`;
  sql += `  nis VARCHAR(30),\n`;
  sql += `  nisn VARCHAR(30),\n`;
  sql += `  nama VARCHAR(150),\n`;
  sql += `  jenis_kelamin ENUM('L', 'P'),\n`;
  sql += `  FOREIGN KEY (kelas_id) REFERENCES classes(id) ON DELETE CASCADE\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (siswa.length > 0) {
    sql += `INSERT INTO students (id, kelas_id, nis, nisn, nama, jenis_kelamin) VALUES\n`;
    sql += siswa.map(s => `('${s.id}', '${s.kelasId}', '${escapeSql(s.nis)}', '${escapeSql(s.nisn || '')}', '${escapeSql(s.nama)}', '${s.jenisKelamin}')`).join(',\n') + `;\n\n`;
  }

  // Jadwal Table
  sql += `-- Tabel Jadwal Mengajar\n`;
  sql += `DROP TABLE IF EXISTS schedules;\n`;
  sql += `CREATE TABLE schedules (\n`;
  sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
  sql += `  kelas_id VARCHAR(50),\n`;
  sql += `  mapel VARCHAR(100),\n`;
  sql += `  hari VARCHAR(15),\n`;
  sql += `  jam_ke VARCHAR(20),\n`;
  sql += `  jam_mulai VARCHAR(10),\n`;
  sql += `  jam_selesai VARCHAR(10),\n`;
  sql += `  ruangan VARCHAR(50)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (jadwal.length > 0) {
    sql += `INSERT INTO schedules (id, kelas_id, mapel, hari, jam_ke, jam_mulai, jam_selesai, ruangan) VALUES\n`;
    sql += jadwal.map(j => `('${j.id}', '${j.kelasId}', '${escapeSql(j.mapel)}', '${j.hari}', '${escapeSql(j.jamKe)}', '${j.jamMulai}', '${j.jamSelesai}', '${escapeSql(j.ruangan)}')`).join(',\n') + `;\n\n`;
  }

  // Agenda Table
  sql += `-- Tabel Agenda Mengajar & Refleksi\n`;
  sql += `DROP TABLE IF EXISTS agendas;\n`;
  sql += `CREATE TABLE agendas (\n`;
  sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
  sql += `  jadwal_id VARCHAR(50),\n`;
  sql += `  kelas_id VARCHAR(50),\n`;
  sql += `  mapel VARCHAR(100),\n`;
  sql += `  tanggal DATE,\n`;
  sql += `  pertemuan_ke INT,\n`;
  sql += `  materi TEXT,\n`;
  sql += `  capaian_pembelajaran TEXT,\n`;
  sql += `  indikator TEXT,\n`;
  sql += `  catatan_kejadian TEXT,\n`;
  sql += `  refleksi_guru TEXT,\n`;
  sql += `  tindak_lanjut TEXT,\n`;
  sql += `  ada_penilaian TINYINT(1) DEFAULT 0,\n`;
  sql += `  created_at DATETIME\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (agenda.length > 0) {
    sql += `INSERT INTO agendas (id, jadwal_id, kelas_id, mapel, tanggal, pertemuan_ke, materi, capaian_pembelajaran, indikator, catatan_kejadian, refleksi_guru, tindak_lanjut, ada_penilaian, created_at) VALUES\n`;
    sql += agenda.map(a => `('${a.id}', '${a.jadwalId}', '${a.kelasId}', '${escapeSql(a.mapel)}', '${a.tanggal}', ${a.pertemuanKe}, '${escapeSql(a.materi)}', '${escapeSql(a.capaianPembelajaran)}', '${escapeSql(a.indikator)}', '${escapeSql(a.catatanKejadian)}', '${escapeSql(a.refleksiGuru)}', '${escapeSql(a.tindakLanjut)}', ${a.adaPenilaian ? 1 : 0}, '${a.created_at.substring(0, 19).replace('T', ' ')}')`).join(',\n') + `;\n\n`;
  }

  // Attendance Table
  sql += `-- Tabel Presensi Siswa\n`;
  sql += `DROP TABLE IF EXISTS attendance;\n`;
  sql += `CREATE TABLE attendance (\n`;
  sql += `  id INT PRIMARY KEY AUTO_INCREMENT,\n`;
  sql += `  agenda_id VARCHAR(50),\n`;
  sql += `  siswa_id VARCHAR(50),\n`;
  sql += `  status ENUM('hadir', 'sakit', 'ijin', 'alpa', 'dispen', 'magang'),\n`;
  sql += `  keterangan TEXT,\n`;
  sql += `  FOREIGN KEY (agenda_id) REFERENCES agendas(id) ON DELETE CASCADE\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  let attendanceValues: string[] = [];
  agenda.forEach(a => {
    a.presensi.forEach(p => {
      attendanceValues.push(`('${a.id}', '${p.siswaId}', '${p.status}', '${escapeSql(p.keterangan || '')}')`);
    });
  });
  if (attendanceValues.length > 0) {
    sql += `INSERT INTO attendance (agenda_id, siswa_id, status, keterangan) VALUES\n`;
    sql += attendanceValues.join(',\n') + `;\n\n`;
  }

  // Grades Table
  sql += `-- Tabel Penilaian\n`;
  sql += `DROP TABLE IF EXISTS grades_sessions;\n`;
  sql += `CREATE TABLE grades_sessions (\n`;
  sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
  sql += `  agenda_id VARCHAR(50) NULL,\n`;
  sql += `  kelas_id VARCHAR(50),\n`;
  sql += `  mapel VARCHAR(100),\n`;
  sql += `  tanggal DATE,\n`;
  sql += `  jenis_penilaian VARCHAR(30),\n`;
  sql += `  nama_penilaian VARCHAR(150),\n`;
  sql += `  kkm INT DEFAULT 75\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  sql += `DROP TABLE IF EXISTS grade_details;\n`;
  sql += `CREATE TABLE grade_details (\n`;
  sql += `  id INT PRIMARY KEY AUTO_INCREMENT,\n`;
  sql += `  session_id VARCHAR(50),\n`;
  sql += `  siswa_id VARCHAR(50),\n`;
  sql += `  nilai FLOAT,\n`;
  sql += `  catatan TEXT,\n`;
  sql += `  FOREIGN KEY (session_id) REFERENCES grades_sessions(id) ON DELETE CASCADE\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  const allPenilaian: PenilaianSession[] = [
    ...agenda.filter(a => a.adaPenilaian && a.penilaian).map(a => a.penilaian!),
    ...penilaianExtra,
  ];

  if (allPenilaian.length > 0) {
    sql += `INSERT INTO grades_sessions (id, agenda_id, kelas_id, mapel, tanggal, jenis_penilaian, nama_penilaian, kkm) VALUES\n`;
    sql += allPenilaian.map(p => `('${p.id}', ${p.agendaId ? `'${p.agendaId}'` : 'NULL'}, '${p.kelasId}', '${escapeSql(p.mapel)}', '${p.tanggal}', '${escapeSql(p.jenisPenilaian)}', '${escapeSql(p.namaPenilaian)}', ${p.kkm})`).join(',\n') + `;\n\n`;

    let gradeDetailsValues: string[] = [];
    allPenilaian.forEach(p => {
      p.daftarNilai.forEach(n => {
        gradeDetailsValues.push(`('${p.id}', '${n.siswaId}', ${n.nilai}, '${escapeSql(n.catatan || '')}')`);
      });
    });

    if (gradeDetailsValues.length > 0) {
      sql += `INSERT INTO grade_details (session_id, siswa_id, nilai, catatan) VALUES\n`;
      sql += gradeDetailsValues.join(',\n') + `;\n\n`;
    }
  }

  return sql;
};

// Generate PHP API Backend Handler Code
export const generatePhpScript = (): string => {
  return `<?php
/**
 * REST API Backend PHP untuk Agenda Mengajar Guru
 * Tipe Database: MySQL / MariaDB
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = "localhost";
$db_name = "db_agenda_guru";
$username = "root";
$password = "";

try {
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name, $username, $password);
    $conn->exec("set names utf8mb4");
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $exception) {
    echo json_encode(["status" => "error", "message" => "Database connection error: " . $exception->getMessage()]);
    exit();
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch($action) {
    case 'get_dashboard_stats':
        $stmt_kelas = $conn->query("SELECT COUNT(*) as total FROM classes");
        $stmt_siswa = $conn->query("SELECT COUNT(*) as total FROM students");
        $stmt_agenda = $conn->query("SELECT COUNT(*) as total FROM agendas");
        
        echo json_encode([
            "total_kelas" => $stmt_kelas->fetch(PDO::FETCH_ASSOC)['total'],
            "total_siswa" => $stmt_siswa->fetch(PDO::FETCH_ASSOC)['total'],
            "total_agenda" => $stmt_agenda->fetch(PDO::FETCH_ASSOC)['total']
        ]);
        break;

    default:
        echo json_encode(["status" => "ok", "app" => "API Agenda Mengajar Guru", "version" => "1.0"]);
        break;
}
?>`;
};

function escapeSql(str: string): string {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

export const generateCloudflareWorkerScript = (): string => {
  return `/**
 * CLOUDFLARE WORKER BACKEND (D1 DATABASE & KV)
 * Deploy ke Cloudflare Workers untuk Utama / Primary Database
 */
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const apiKeyHeader = request.headers.get("X-Api-Key") || request.headers.get("Authorization");
    
    if (env.API_KEY && apiKeyHeader !== env.API_KEY && apiKeyHeader !== \`Bearer \${env.API_KEY}\`) {
      return new Response(JSON.stringify({ error: "Unauthorized: API Key Cloudflare tidak valid" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      // GET /api/data
      if (request.method === "GET" && (url.pathname.endsWith("/data") || url.pathname.endsWith("/sync"))) {
        let data = null;
        if (env.AGENDA_KV) {
          const raw = await env.AGENDA_KV.get("APP_STATE");
          if (raw) data = JSON.parse(raw);
        } else if (env.DB) {
          const stmt = await env.DB.prepare("SELECT data FROM app_store WHERE id = 'latest'").first();
          if (stmt && stmt.data) data = JSON.parse(stmt.data);
        }
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // POST /api/data
      if (request.method === "POST" && (url.pathname.endsWith("/data") || url.pathname.endsWith("/sync"))) {
        const payload = await request.json();
        payload.updated_at = new Date().toISOString();

        if (env.AGENDA_KV) {
          await env.AGENDA_KV.put("APP_STATE", JSON.stringify(payload));
        }
        if (env.DB) {
          await env.DB.exec("CREATE TABLE IF NOT EXISTS app_store (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT)");
          await env.DB.prepare("INSERT INTO app_store (id, data, updated_at) VALUES ('latest', ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
            .bind(JSON.stringify(payload), payload.updated_at)
            .run();
        }
        return new Response(JSON.stringify({
          success: true,
          message: "Data berhasil disimpan permanen di Cloudflare D1 Database!",
          updated_at: payload.updated_at
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ status: "online", service: "Cloudflare D1 Agenda Guru Backend API", version: "3.0" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};`;
};
