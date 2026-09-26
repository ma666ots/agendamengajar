import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import {
  initialProfile,
  initialKelas,
  initialSiswa,
  initialJadwal,
  initialAgenda,
  initialPenilaianExtra,
} from './src/data/initialData.js';

import {
  getOAuth2Client,
  isOAuthConfigured,
  saveTokens,
  loadTokens,
  clearTokens,
  getAuthenticatedAuth,
  findOrCreateFolder,
  findOrCreateFile,
  syncAgendasToGoogleDoc,
  syncPresensiToGoogleSheet,
  syncNilaiToGoogleSheet,
  saveBackupJsonToDrive,
  getBackupJsonFromDrive,
  runFullServerGoogleSync,
  SCOPES,
  isAuthError,
} from './server/googleService.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure DB directory and file exist
function getDbData(): any {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = {
        profile: initialProfile,
        kelas: initialKelas,
        siswa: initialSiswa,
        jadwal: initialJadwal,
        agenda: initialAgenda,
        penilaianExtra: initialPenilaianExtra,
        updatedAt: new Date().toISOString(),
        googleBackupStatus: null,
        googleConnection: null,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    // Ensure baseline agendas (including 15 Sept agendas) are never missing
    const agendaMap = new Map();
    initialAgenda.forEach((a: any) => {
      if (a && a.id) agendaMap.set(a.id, a);
    });
    if (Array.isArray(parsed.agenda)) {
      parsed.agenda.forEach((a: any) => {
        if (a && a.id) agendaMap.set(a.id, a);
      });
    }
    const mergedAgenda = Array.from(agendaMap.values());

    return {
      profile: parsed.profile || initialProfile,
      kelas: Array.isArray(parsed.kelas) ? parsed.kelas : initialKelas,
      siswa: Array.isArray(parsed.siswa) ? parsed.siswa : initialSiswa,
      jadwal: Array.isArray(parsed.jadwal) ? parsed.jadwal : initialJadwal,
      agenda: mergedAgenda,
      penilaianExtra: Array.isArray(parsed.penilaianExtra) ? parsed.penilaianExtra : initialPenilaianExtra,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      googleBackupStatus: parsed.googleBackupStatus || null,
      googleConnection: parsed.googleConnection || null,
    };
  } catch (err) {
    console.error('Error reading DB file, returning initial dataset:', err);
    return {
      profile: initialProfile,
      kelas: initialKelas,
      siswa: initialSiswa,
      jadwal: initialJadwal,
      agenda: initialAgenda,
      penilaianExtra: initialPenilaianExtra,
      updatedAt: new Date().toISOString(),
      googleBackupStatus: null,
      googleConnection: null,
    };
  }
}

function saveDbData(data: any) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing DB file:', err);
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // CORS Headers for API
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Reverse proxy for Firebase Auth Handler (avoids *.firebaseapp.com timeout on restricted ISPs)
  app.use('/__/auth', async (req, res) => {
    try {
      const targetUrl = `https://gen-lang-client-0285229819.firebaseapp.com/__/auth${req.url}`;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Accept': req.headers['accept'] || '*/*',
          'User-Agent': (req.headers['user-agent'] as string) || 'Mozilla/5.0 (Firebase-Auth-Proxy)',
        },
      });

      res.status(response.status);
      response.headers.forEach((val, headerKey) => {
        const lower = headerKey.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(lower)) {
          res.setHeader(headerKey, val);
        }
      });
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.warn('Firebase Auth proxy fallback triggered:', err?.message);
      try {
        const fallbackUrl = `https://gen-lang-client-0285229819.web.app/__/auth${req.url}`;
        const fbRes = await fetch(fallbackUrl);
        res.status(fbRes.status);
        const fbBuf = await fbRes.arrayBuffer();
        res.send(Buffer.from(fbBuf));
      } catch (e2) {
        res.status(504).send('Firebase Auth handler unreachable');
      }
    }
  });

  // REST API ENDPOINTS

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // GET /api/data - Retrieve all database state
  app.get('/api/data', (req, res) => {
    const db = getDbData();
    res.json({ success: true, data: db });
  });

  // POST /api/data - Save/Overwrite all database state
  app.post('/api/data', (req, res) => {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Payload tidak boleh kosong' });
    }
    const current = getDbData();
    const agendaMap = new Map();
    (current.agenda || []).forEach((a: any) => {
      if (a && a.id) agendaMap.set(a.id, a);
    });
    (payload.agenda || []).forEach((a: any) => {
      if (a && a.id) agendaMap.set(a.id, a);
    });
    const mergedAgenda = Array.from(agendaMap.values());

    const updatedDb = {
      profile: payload.profile || current.profile,
      kelas: Array.isArray(payload.kelas) ? payload.kelas : current.kelas,
      siswa: Array.isArray(payload.siswa) ? payload.siswa : current.siswa,
      jadwal: Array.isArray(payload.jadwal) ? payload.jadwal : current.jadwal,
      agenda: mergedAgenda,
      penilaianExtra: Array.isArray(payload.penilaianExtra) ? payload.penilaianExtra : current.penilaianExtra,
    };
    saveDbData(updatedDb);
    res.json({ success: true, message: 'Database berhasil diperbarui secara permanen!', data: updatedDb });
  });

  // GET & POST /api/profile
  app.get('/api/profile', (req, res) => {
    const db = getDbData();
    res.json({ success: true, data: db.profile });
  });

  app.post('/api/profile', (req, res) => {
    const profile = req.body;
    const db = getDbData();
    db.profile = profile;
    saveDbData(db);
    res.json({ success: true, message: 'Profile berhasil disimpan', data: db.profile });
  });

  // GET, POST, DELETE /api/kelas
  app.get('/api/kelas', (req, res) => {
    const db = getDbData();
    res.json({ success: true, data: db.kelas });
  });

  app.post('/api/kelas', (req, res) => {
    const kelasItem = req.body;
    const db = getDbData();
    const index = db.kelas.findIndex((k: any) => k.id === kelasItem.id);
    if (index >= 0) {
      db.kelas[index] = kelasItem;
    } else {
      db.kelas.push(kelasItem);
    }
    saveDbData(db);
    res.json({ success: true, message: 'Kelas berhasil disimpan', data: db.kelas });
  });

  app.delete('/api/kelas/:id', (req, res) => {
    const { id } = req.params;
    const db = getDbData();
    db.kelas = db.kelas.filter((k: any) => k.id !== id);
    db.siswa = db.siswa.filter((s: any) => s.kelasId !== id);
    db.jadwal = db.jadwal.filter((j: any) => j.kelasId !== id);
    db.agenda = db.agenda.filter((a: any) => a.kelasId !== id);
    db.penilaianExtra = db.penilaianExtra.filter((p: any) => p.kelasId !== id);
    saveDbData(db);
    res.json({ success: true, message: 'Kelas dan relasinya berhasil dihapus', data: db });
  });

  // GET, POST, DELETE /api/siswa
  app.get('/api/siswa', (req, res) => {
    const db = getDbData();
    res.json({ success: true, data: db.siswa });
  });

  app.post('/api/siswa', (req, res) => {
    const siswaItem = req.body;
    const db = getDbData();
    const index = db.siswa.findIndex((s: any) => s.id === siswaItem.id);
    if (index >= 0) {
      db.siswa[index] = siswaItem;
    } else {
      db.siswa.push(siswaItem);
    }
    saveDbData(db);
    res.json({ success: true, message: 'Siswa berhasil disimpan', data: db.siswa });
  });

  app.post('/api/siswa/batch', (req, res) => {
    const batch: any[] = req.body;
    if (!Array.isArray(batch)) {
      return res.status(400).json({ success: false, error: 'Expected array of siswa' });
    }
    const db = getDbData();
    db.siswa = [...db.siswa, ...batch];
    saveDbData(db);
    res.json({ success: true, message: `${batch.length} siswa berhasil diimport`, data: db.siswa });
  });

  app.delete('/api/siswa/:id', (req, res) => {
    const { id } = req.params;
    const db = getDbData();
    db.siswa = db.siswa.filter((s: any) => s.id !== id);
    db.agenda = db.agenda.map((a: any) => ({
      ...a,
      presensi: a.presensi ? a.presensi.filter((p: any) => p.siswaId !== id) : [],
    }));
    db.penilaianExtra = db.penilaianExtra.map((p: any) => ({
      ...p,
      daftarNilai: p.daftarNilai ? p.daftarNilai.filter((n: any) => n.siswaId !== id) : [],
    }));
    saveDbData(db);
    res.json({ success: true, message: 'Siswa berhasil dihapus', data: db });
  });

  // GET, POST, DELETE /api/jadwal
  app.get('/api/jadwal', (req, res) => {
    const db = getDbData();
    res.json({ success: true, data: db.jadwal });
  });

  app.post('/api/jadwal', (req, res) => {
    const j = req.body;
    const db = getDbData();
    const index = db.jadwal.findIndex((item: any) => item.id === j.id);
    if (index >= 0) {
      db.jadwal[index] = j;
    } else {
      db.jadwal.push(j);
    }
    saveDbData(db);
    res.json({ success: true, message: 'Jadwal berhasil disimpan', data: db.jadwal });
  });

  app.delete('/api/jadwal/:id', (req, res) => {
    const { id } = req.params;
    const db = getDbData();
    db.jadwal = db.jadwal.filter((j: any) => j.id !== id);
    saveDbData(db);
    res.json({ success: true, message: 'Jadwal berhasil dihapus', data: db.jadwal });
  });

  // GET, POST, DELETE /api/agenda
  app.get('/api/agenda', (req, res) => {
    const db = getDbData();
    res.json({ success: true, data: db.agenda });
  });

  app.post('/api/agenda', (req, res) => {
    const ag = req.body;
    const db = getDbData();
    const index = db.agenda.findIndex((item: any) => item.id === ag.id);
    if (index >= 0) {
      db.agenda[index] = ag;
    } else {
      db.agenda.unshift(ag);
    }
    saveDbData(db);
    res.json({ success: true, message: 'Agenda mengajar berhasil disimpan', data: db.agenda });
  });

  app.delete('/api/agenda/:id', (req, res) => {
    const { id } = req.params;
    const db = getDbData();
    db.agenda = db.agenda.filter((a: any) => a.id !== id);
    saveDbData(db);
    res.json({ success: true, message: 'Agenda berhasil dihapus', data: db.agenda });
  });

  // GET, POST, DELETE /api/penilaian-extra
  app.get('/api/penilaian-extra', (req, res) => {
    const db = getDbData();
    res.json({ success: true, data: db.penilaianExtra });
  });

  app.post('/api/penilaian-extra', (req, res) => {
    const p = req.body;
    const db = getDbData();
    const index = db.penilaianExtra.findIndex((item: any) => item.id === p.id);
    if (index >= 0) {
      db.penilaianExtra[index] = p;
    } else {
      db.penilaianExtra.unshift(p);
    }
    saveDbData(db);
    res.json({ success: true, message: 'Penilaian ekstra berhasil disimpan', data: db.penilaianExtra });
  });

  app.delete('/api/penilaian-extra/:id', (req, res) => {
    const { id } = req.params;
    const db = getDbData();
    db.penilaianExtra = db.penilaianExtra.filter((p: any) => p.id !== id);
    saveDbData(db);
    res.json({ success: true, message: 'Penilaian ekstra berhasil dihapus', data: db.penilaianExtra });
  });

  // POST /api/reset
  app.post('/api/reset', (req, res) => {
    const initialDb = {
      profile: initialProfile,
      kelas: initialKelas,
      siswa: initialSiswa,
      jadwal: initialJadwal,
      agenda: initialAgenda,
      penilaianExtra: initialPenilaianExtra,
      updatedAt: new Date().toISOString(),
    };
    saveDbData(initialDb);
    res.json({ success: true, message: 'Seluruh database berhasil direset ke data awal!', data: initialDb });
  });

  // Helper for origin determination
  const getRequestOrigin = (req: express.Request) => {
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    return `${proto}://${host}`;
  };

  // GOOGLE WORKSPACE API & OAUTH ENDPOINTS

  // GET /api/google/auth-url
  app.get('/api/google/auth-url', (req, res) => {
    try {
      if (!isOAuthConfigured()) {
        return res.status(400).json({
          success: false,
          error: 'Google OAuth Client ID belum dikonfigurasi di lingkungan server. Silakan setujui otorisasi OAuth terlebih dahulu.',
        });
      }
      const origin = getRequestOrigin(req);
      const oauth2Client = getOAuth2Client(origin);
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });
      res.json({ success: true, url });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal membuat URL otentikasi Google' });
    }
  });

  // GET /api/google/callback
  app.get('/api/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Kode otentikasi Google tidak ditemukan');
    }
    try {
      const origin = getRequestOrigin(req);
      const oauth2Client = getOAuth2Client(origin);
      const { tokens } = await oauth2Client.getToken(code);
      saveTokens(tokens);
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;">
            <h2>Google Workspace Connected!</h2>
            <p>Otentikasi Google Drive, Docs & Sheets berhasil.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.status(500).send(`Gagal memproses otentikasi Google: ${err?.message || 'Error'}`);
    }
  });

  // Helper to extract bearer token from request
  const getBearerToken = (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return undefined;
  };

  // Helper to respond with proper 401 when auth error occurs
  const handleGoogleError = (res: express.Response, err: any, defaultMessage: string) => {
    if (isAuthError(err)) {
      console.warn(`[Google Auth] Sesi otentikasi telah kadaluarsa atau tidak valid (${defaultMessage}):`, err?.message || err);
      clearTokens();
      return res.status(401).json({
        success: false,
        error: 'Otentikasi Google Workspace telah kadaluarsa atau tidak valid. Silakan hubungkan kembali akun Google Anda.',
        needsReauth: true,
      });
    }
    console.error(`Google API Error [${defaultMessage}]:`, err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || defaultMessage,
    });
  };

  // GET /api/google/status
  app.get('/api/google/status', (req, res) => {
    const bearer = getBearerToken(req);
    let tokens = loadTokens();

    // Check expiration if stored and no refresh_token
    if (tokens && tokens.expiry_date && Number(tokens.expiry_date) < Date.now() && !tokens.refresh_token) {
      clearTokens();
      tokens = null;
    }

    if ((!tokens || !tokens.access_token) && bearer) {
      tokens = { access_token: bearer, ...(tokens || {}) };
    }
    const isAuthenticated = Boolean(tokens && tokens.access_token);
    res.json({
      success: true,
      isConfigured: isOAuthConfigured(),
      isAuthenticated,
      hasRefreshToken: Boolean(tokens && tokens.refresh_token),
      tokenExpiry: tokens ? tokens.expiry_date : null,
      user: tokens?.user || null,
    });
  });

  // POST /api/google/session (Save token from client-side Firebase Auth)
  app.post('/api/google/session', (req, res) => {
    const { accessToken, user, expiryDate } = req.body;
    if (!accessToken) {
      return res.status(400).json({ success: false, error: 'Access token diperlukan' });
    }
    const tokenData = {
      access_token: accessToken,
      token_type: 'Bearer',
      expiry_date: expiryDate || Date.now() + 3600 * 1000,
      user: user || null,
      saved_at: new Date().toISOString(),
    };
    saveTokens(tokenData);
    res.json({ success: true, message: 'Google session berhasil disimpan', user });
  });

  // POST /api/google/disconnect
  app.post('/api/google/disconnect', (req, res) => {
    clearTokens();
    res.json({ success: true, message: 'Koneksi Google Workspace telah terputus' });
  });

  // POST /api/google/drive/root-folder
  app.post('/api/google/drive/root-folder', async (req, res) => {
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa', needsReauth: true });
    }
    try {
      const folder = await findOrCreateFolder(auth, 'Agenda Mengajar Guru');
      res.json({ success: true, folder });
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal mengakses Google Drive');
    }
  });

  // POST /api/google/drive/class-folder
  app.post('/api/google/drive/class-folder', async (req, res) => {
    const { rootFolderId, namaKelas } = req.body;
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa', needsReauth: true });
    }
    try {
      const folder = await findOrCreateFolder(auth, namaKelas || 'Kelas Tanpa Nama', rootFolderId);
      res.json({ success: true, folder });
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal membuat folder kelas');
    }
  });

  // POST /api/google/drive/doc-file
  app.post('/api/google/drive/doc-file', async (req, res) => {
    const { classFolderId, fileName } = req.body;
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa', needsReauth: true });
    }
    try {
      const file = await findOrCreateFile(auth, fileName || 'Agenda Mengajar', 'application/vnd.google-apps.document', classFolderId);
      res.json({ success: true, file });
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal membuat file Google Docs');
    }
  });

  // POST /api/google/drive/sheet-file
  app.post('/api/google/drive/sheet-file', async (req, res) => {
    const { classFolderId, fileName } = req.body;
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa', needsReauth: true });
    }
    try {
      const file = await findOrCreateFile(auth, fileName || 'Data Akademik', 'application/vnd.google-apps.spreadsheet', classFolderId);
      res.json({ success: true, file });
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal membuat file Google Sheets');
    }
  });

  // POST /api/google/docs/sync-agendas
  app.post('/api/google/docs/sync-agendas', async (req, res) => {
    const { docId, agendas, kelas, profile } = req.body;
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa', needsReauth: true });
    }
    try {
      const result = await syncAgendasToGoogleDoc(auth, docId, agendas || [], kelas || {}, profile || {});
      res.json(result);
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal menyinkronkan Google Docs');
    }
  });

  // POST /api/google/sheets/sync-presensi
  app.post('/api/google/sheets/sync-presensi', async (req, res) => {
    const { sheetId, agendaList, siswaList } = req.body;
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa', needsReauth: true });
    }
    try {
      const result = await syncPresensiToGoogleSheet(auth, sheetId, agendaList || [], siswaList || []);
      res.json(result);
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal menyinkronkan Presensi Google Sheets');
    }
  });

  // POST /api/google/sheets/sync-nilai
  app.post('/api/google/sheets/sync-nilai', async (req, res) => {
    const { sheetId, penilaianList, siswaList } = req.body;
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa', needsReauth: true });
    }
    try {
      const result = await syncNilaiToGoogleSheet(auth, sheetId, penilaianList || [], siswaList || []);
      res.json(result);
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal menyinkronkan Nilai Google Sheets');
    }
  });

  // POST /api/google/sync-full (High-speed server-side full backup pass)
  app.post('/api/google/sync-full', async (req, res) => {
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa. Silakan hubungkan kembali akun Google Anda.',
        needsReauth: true,
      });
    }
    try {
      const appData = req.body.appData || getDbData();
      const status = await runFullServerGoogleSync(auth, appData);
      
      // Save last backup status to local db as well
      const db = getDbData();
      db.googleBackupStatus = status;
      saveDbData(db);

      res.json({ success: true, status });
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal melakukan sinkronisasi Google Workspace');
    }
  });

  // POST /api/google/restore-from-drive (Pull & Restore data from Google Drive into App)
  app.post('/api/google/restore-from-drive', async (req, res) => {
    const auth = getAuthenticatedAuth(getBearerToken(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Google Workspace belum terhubung' });
    }
    try {
      const rootFolder = await findOrCreateFolder(auth, 'Agenda Mengajar Guru');
      const backupResult = await getBackupJsonFromDrive(auth, rootFolder.id!);

      if (!backupResult || !backupResult.data) {
        return res.status(404).json({
          success: false,
          error: 'File backup_agenda_guru.json tidak ditemukan di folder Agenda Mengajar Guru pada Google Drive Anda.',
        });
      }

      const driveData = backupResult.data;
      const current = getDbData();

      // Non-destructive merge of agenda
      const agendaMap = new Map();
      (current.agenda || []).forEach((a: any) => {
        if (a && a.id) agendaMap.set(a.id, a);
      });
      (driveData.agenda || []).forEach((a: any) => {
        if (a && a.id) agendaMap.set(a.id, a);
      });
      const mergedAgenda = Array.from(agendaMap.values());

      // Merge students
      const siswaMap = new Map();
      (current.siswa || []).forEach((s: any) => {
        if (s && s.id) siswaMap.set(s.id, s);
      });
      (driveData.siswa || []).forEach((s: any) => {
        if (s && s.id) siswaMap.set(s.id, s);
      });
      const mergedSiswa = Array.from(siswaMap.values());

      // Merge kelas
      const kelasMap = new Map();
      (current.kelas || []).forEach((k: any) => {
        if (k && k.id) kelasMap.set(k.id, k);
      });
      (driveData.kelas || []).forEach((k: any) => {
        if (k && k.id) kelasMap.set(k.id, k);
      });
      const mergedKelas = Array.from(kelasMap.values());

      const updatedDb = {
        profile: driveData.profile || current.profile,
        kelas: mergedKelas.length > 0 ? mergedKelas : current.kelas,
        siswa: mergedSiswa.length > 0 ? mergedSiswa : current.siswa,
        jadwal: Array.isArray(driveData.jadwal) && driveData.jadwal.length > 0 ? driveData.jadwal : current.jadwal,
        agenda: mergedAgenda,
        penilaianExtra: Array.isArray(driveData.penilaianExtra) && driveData.penilaianExtra.length > 0 ? driveData.penilaianExtra : current.penilaianExtra,
        updatedAt: new Date().toISOString(),
      };

      saveDbData(updatedDb);

      res.json({
        success: true,
        message: `Berhasil memulihkan data dari Google Drive! (${mergedAgenda.length} agenda, ${mergedKelas.length} kelas, ${mergedSiswa.length} siswa)`,
        file: backupResult.file,
        data: updatedDb,
      });
    } catch (err: any) {
      handleGoogleError(res, err, 'Gagal memulihkan data dari Google Drive');
    }
  });

  // Vite Middleware for development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server database REST API running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
