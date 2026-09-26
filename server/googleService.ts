import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const TOKEN_PATH = path.join(process.cwd(), 'data', 'google_tokens.json');

// Ensure data folder exists
const dataDir = path.dirname(TOKEN_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Scopes required for Drive, Docs, and Sheets
export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Helper to read firebase-applet-config.json if available
export function getFirebaseAppletConfig() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json:', err);
  }
  return null;
}

export function isOAuthConfigured() {
  const firebaseConfig = getFirebaseAppletConfig();
  const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig?.oAuthClientId;
  return Boolean(clientId && clientId !== 'dummy-client-id' && clientId.trim() !== '');
}

export function getOAuth2Client(origin?: string) {
  const firebaseConfig = getFirebaseAppletConfig();
  const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig?.oAuthClientId || 'dummy-client-id';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret';
  const baseUrl = origin || process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/google/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

export function saveTokens(tokens: any) {
  try {
    let existing: any = {};
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      } catch {}
    }
    const combined = { ...existing, ...tokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(combined, null, 2), 'utf-8');

    // Also persist in db.json as backup
    try {
      if (fs.existsSync(DB_PATH)) {
        const dbContent = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        dbContent.googleTokens = combined;
        fs.writeFileSync(DB_PATH, JSON.stringify(dbContent, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('Could not mirror tokens to db.json:', e);
    }

    return combined;
  } catch (err) {
    console.error('Failed to save Google OAuth tokens:', err);
    return tokens;
  }
}

export function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const raw = fs.readFileSync(TOKEN_PATH, 'utf-8');
      return JSON.parse(raw);
    }
    if (fs.existsSync(DB_PATH)) {
      const dbContent = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (dbContent.googleTokens) {
        return dbContent.googleTokens;
      }
    }
  } catch (err) {
    console.error('Failed to load Google OAuth tokens:', err);
  }
  return null;
}

export function clearTokens() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
    if (fs.existsSync(DB_PATH)) {
      const dbContent = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (dbContent.googleTokens) {
        delete dbContent.googleTokens;
        fs.writeFileSync(DB_PATH, JSON.stringify(dbContent, null, 2), 'utf-8');
      }
    }
  } catch (err) {
    console.error('Failed to clear Google OAuth tokens:', err);
  }
}

export function isAuthError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.response?.status;
  if (status === 401 || status === 403) return true;
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('invalid authentication credentials') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid credentials') ||
    msg.includes('token has expired') ||
    msg.includes('unauthorized') ||
    msg.includes('login cookie or other valid authentication credential') ||
    msg.includes('request had invalid authentication credentials')
  ) {
    return true;
  }
  return false;
}

export function getAuthenticatedAuth(bearerToken?: string) {
  const firebaseConfig = getFirebaseAppletConfig();
  const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig?.oAuthClientId;
  const oauth2Client = new google.auth.OAuth2(clientId);

  if (bearerToken && bearerToken.trim() !== '') {
    oauth2Client.setCredentials({ access_token: bearerToken.trim() });
    return oauth2Client;
  }

  const tokens = loadTokens();
  if (tokens && tokens.access_token) {
    // If token has an expiry date, is expired, and has no refresh token, purge it
    if (tokens.expiry_date && Number(tokens.expiry_date) < Date.now() && !tokens.refresh_token) {
      console.warn('Stored Google token in google_tokens.json/db.json has expired. Clearing.');
      clearTokens();
      return null;
    }
    // If token has no expiry date and no refresh token, assume expired legacy token and clear
    if (!tokens.expiry_date && !tokens.refresh_token) {
      clearTokens();
      return null;
    }
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }
  return null;
}

/**
 * GOOGLE DRIVE API FUNCTIONS
 */

export async function findOrCreateFolder(auth: any, folderName: string, parentFolderId?: string) {
  const drive = google.drive({ version: 'v3', auth });

  let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentFolderId) {
    q += ` and '${parentFolderId}' in parents`;
  }

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, webViewLink)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }

  // Create folder if not found
  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    fileMetadata.parents = [parentFolderId];
  }

  const created = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name, mimeType, webViewLink',
  });

  return created.data;
}

export async function findOrCreateFile(
  auth: any,
  fileName: string,
  mimeType: 'application/vnd.google-apps.document' | 'application/vnd.google-apps.spreadsheet',
  parentFolderId: string
) {
  const drive = google.drive({ version: 'v3', auth });

  const q = `mimeType='${mimeType}' and name='${fileName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed=false`;

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, webViewLink)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }

  // Create file inside folder if not found
  const fileMetadata = {
    name: fileName,
    mimeType,
    parents: [parentFolderId],
  };

  const created = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name, mimeType, webViewLink',
  });

  return created.data;
}

/**
 * GOOGLE DOCS API FUNCTIONS
 */

export async function syncAgendasToGoogleDoc(
  auth: any,
  docId: string,
  agendas: any[],
  kelas: any,
  profile: any
) {
  const docs = google.docs({ version: 'v1', auth });

  // 1. Get current document content
  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body?.content || [];

  // Construct text content for all agendas formatted like teacher's agenda book
  let fullText = `DOCUMENT AGENDA MENGAJAR GURU\n`;
  fullText += `Kelas: ${kelas.namaKelas || 'Semua Kelas'} | Jurusan: ${kelas.jurusan || '-'}\n`;
  fullText += `Guru Pengampu: ${profile.namaGuru || '-'} (NIP: ${profile.nip || '-'})\n`;
  fullText += `Sekolah: ${profile.namaSekolah || '-'} | Tahun Ajaran: ${profile.tahunAjaran || '-'} (${profile.semester || '-'})\n`;
  fullText += `================================================================================\n\n`;

  if (agendas.length === 0) {
    fullText += `(Belum ada agenda mengajar yang tercatat untuk kelas ini)\n`;
  } else {
    agendas.forEach((a, index) => {
      fullText += `AGENDA KE-${index + 1} | [AGENDA_ID: ${a.id}]\n`;
      fullText += `--------------------------------------------------------------------------------\n`;
      fullText += `Tanggal         : ${a.tanggal || '-'}\n`;
      fullText += `Pertemuan Ke    : Pertemuan ${a.pertemuanKe || 1}\n`;
      fullText += `Mata Pelajaran  : ${a.mapel || profile.mapelUtama || '-'}\n`;
      fullText += `Materi          : ${a.materi || '-'}\n`;
      fullText += `Capaian Pembel. : ${a.capaianPembelajaran || '-'}\n`;
      fullText += `Indikator       : ${a.indikator || '-'}\n`;
      fullText += `Catatan Kejadian: ${a.catatanKejadian || '-'}\n`;
      fullText += `Refleksi Guru   : ${a.refleksiGuru || '-'}\n`;
      fullText += `Tindak Lanjut   : ${a.tindakLanjut || '-'}\n`;
      fullText += `Presensi Hadir  : ${ (a.presensi || []).filter((p: any) => p.status === 'hadir').length } siswa\n`;
      fullText += `Status Penilaian: ${a.adaPenilaian ? 'Ada Penilaian' : 'Tidak Ada'}\n`;
      fullText += `================================================================================\n\n`;
    });
  }

  // Find document end index
  let endIndex = 1;
  content.forEach(element => {
    if (element.endIndex) {
      endIndex = Math.max(endIndex, element.endIndex);
    }
  });

  const requests: any[] = [];

  // Delete existing content if > 2 characters
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }

  // Insert updated text
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });

  return { success: true, message: `Berhasil menyinkronkan ${agendas.length} agenda ke Google Docs` };
}

/**
 * GOOGLE SHEETS API FUNCTIONS
 */

export async function syncPresensiToGoogleSheet(
  auth: any,
  spreadsheetId: string,
  agendaList: any[],
  siswaList: any[]
) {
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Ensure sheet "Presensi" exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetExists = (spreadsheet.data.sheets || []).some(
    s => s.properties?.title === 'Presensi'
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: 'Presensi' },
            },
          },
        ],
      },
    });
  }

  // Build rows array with Header
  const headers = ['ID Presensi', 'ID Agenda', 'Tanggal', 'Nama Siswa', 'NIS', 'Status', 'Keterangan'];
  const rows: any[][] = [headers];

  // Map siswa by ID for fast lookup
  const siswaMap: Record<string, any> = {};
  siswaList.forEach(s => {
    siswaMap[s.id] = s;
  });

  agendaList.forEach(agenda => {
    (agenda.presensi || []).forEach((p: any) => {
      const siswa = siswaMap[p.siswaId] || {};
      const idPresensi = `${agenda.id}_${p.siswaId}`;
      rows.push([
        idPresensi,
        agenda.id,
        agenda.tanggal || '',
        siswa.nama || 'Siswa',
        siswa.nis || '-',
        p.status || 'hadir',
        p.keterangan || '-',
      ]);
    });
  });

  // Overwrite entire "Presensi" range
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Presensi!A1:G1000',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  return { success: true, message: `Presensi (${rows.length - 1} baris) tersinkronisasi ke Google Sheets!` };
}

export async function syncNilaiToGoogleSheet(
  auth: any,
  spreadsheetId: string,
  penilaianList: any[],
  siswaList: any[]
) {
  const sheets = google.sheets({ version: 'v4', auth });

  // Ensure sheet "Nilai" exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetExists = (spreadsheet.data.sheets || []).some(
    s => s.properties?.title === 'Nilai'
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: 'Nilai' },
            },
          },
        ],
      },
    });
  }

  const headers = [
    'ID Penilaian',
    'Tanggal',
    'Jenis Penilaian',
    'Nama Penilaian',
    'Nama Siswa',
    'NIS',
    'Nilai',
    'KKM',
    'Catatan',
  ];
  const rows: any[][] = [headers];

  const siswaMap: Record<string, any> = {};
  siswaList.forEach(s => {
    siswaMap[s.id] = s;
  });

  penilaianList.forEach(pSession => {
    (pSession.daftarNilai || []).forEach((nItem: any) => {
      const siswa = siswaMap[nItem.siswaId] || {};
      const idNilaiUnique = `${pSession.id}_${nItem.siswaId}`;
      rows.push([
        idNilaiUnique,
        pSession.tanggal || '',
        pSession.jenisPenilaian || 'Formatif',
        pSession.namaPenilaian || '-',
        siswa.nama || 'Siswa',
        siswa.nis || '-',
        nItem.nilai || 0,
        pSession.kkm || 75,
        nItem.catatan || '-',
      ]);
    });
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Nilai!A1:I1000',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  return { success: true, message: `Nilai (${rows.length - 1} baris) tersinkronisasi ke Google Sheets!` };
}

/**
 * GOOGLE DRIVE BACKUP JSON (Two-Way Sync / Archive)
 */

export async function saveBackupJsonToDrive(auth: any, rootFolderId: string, appData: any) {
  const drive = google.drive({ version: 'v3', auth });
  const backupPayload = JSON.stringify({
    version: '1.0',
    updatedAt: new Date().toISOString(),
    source: 'Agenda Mengajar Guru App',
    profile: appData.profile,
    kelas: appData.kelas,
    siswa: appData.siswa,
    jadwal: appData.jadwal,
    agenda: appData.agenda,
    penilaianExtra: appData.penilaianExtra,
  }, null, 2);

  const listRes = await drive.files.list({
    q: `name='backup_agenda_guru.json' and '${rootFolderId}' in parents and trashed=false`,
    fields: 'files(id, name, webViewLink, modifiedTime)',
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    const fileId = listRes.data.files[0].id!;
    const updated = await drive.files.update({
      fileId,
      media: {
        mimeType: 'application/json',
        body: Readable.from([backupPayload]),
      },
      fields: 'id, name, webViewLink, modifiedTime',
    });
    return updated.data;
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: 'backup_agenda_guru.json',
        parents: [rootFolderId],
        mimeType: 'application/json',
      },
      media: {
        mimeType: 'application/json',
        body: Readable.from([backupPayload]),
      },
      fields: 'id, name, webViewLink, modifiedTime',
    });
    return created.data;
  }
}

export async function getBackupJsonFromDrive(auth: any, rootFolderId: string) {
  const drive = google.drive({ version: 'v3', auth });
  const listRes = await drive.files.list({
    q: `name='backup_agenda_guru.json' and '${rootFolderId}' in parents and trashed=false`,
    fields: 'files(id, name, webViewLink, modifiedTime, size)',
  });

  if (!listRes.data.files || listRes.data.files.length === 0) {
    return null;
  }

  const fileInfo = listRes.data.files[0];
  const readRes = await drive.files.get(
    { fileId: fileInfo.id!, alt: 'media' },
    { responseType: 'text' }
  );

  let parsed: any;
  if (typeof readRes.data === 'string') {
    parsed = JSON.parse(readRes.data);
  } else {
    parsed = readRes.data;
  }

  return {
    file: fileInfo,
    data: parsed,
  };
}

/**
 * HIGH-SPEED SERVER-SIDE FULL SYNC
 * Runs directly on the server to avoid 20+ browser HTTP roundtrips.
 */
export async function runFullServerGoogleSync(auth: any, appData: any) {
  // 1. Get or Create Root Folder
  let rootFolder;
  try {
    rootFolder = await findOrCreateFolder(auth, 'Agenda Mengajar Guru');
  } catch (err: any) {
    if (isAuthError(err)) {
      clearTokens();
    }
    throw err;
  }
  const rootFolderId = rootFolder.id!;
  const rootFolderUrl = rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;

  // 2. Save complete JSON archive to Drive
  let backupFile: any = null;
  try {
    backupFile = await saveBackupJsonToDrive(auth, rootFolderId, appData);
  } catch (err: any) {
    if (isAuthError(err)) {
      clearTokens();
      throw err;
    }
    console.warn('Could not save JSON backup file to Drive:', err);
  }

  // 3. Process classes in parallel/concurrent batches
  const classBackups: Record<string, any> = {};
  const kelasList = appData.kelas || [];

  const allPenilaian = [
    ...(appData.agenda || []).filter((a: any) => a.adaPenilaian && a.penilaian).map((a: any) => a.penilaian!),
    ...(appData.penilaianExtra || []),
  ];

  // Process classes concurrently (max 3 at a time) for high speed
  const processClass = async (k: any) => {
    try {
      const classFolder = await findOrCreateFolder(auth, k.namaKelas, rootFolderId);
      const classFolderId = classFolder.id!;

      const agendaDoc = await findOrCreateFile(
        auth,
        'Agenda Mengajar',
        'application/vnd.google-apps.document',
        classFolderId
      );

      const akademikSheet = await findOrCreateFile(
        auth,
        'Data Akademik',
        'application/vnd.google-apps.spreadsheet',
        classFolderId
      );

      const classAgendas = (appData.agenda || []).filter((a: any) => a.kelasId === k.id);
      await syncAgendasToGoogleDoc(auth, agendaDoc.id!, classAgendas, k, appData.profile || {});
      await syncPresensiToGoogleSheet(auth, akademikSheet.id!, classAgendas, appData.siswa || []);

      const classPenilaian = allPenilaian.filter((p: any) => p.kelasId === k.id);
      await syncNilaiToGoogleSheet(auth, akademikSheet.id!, classPenilaian, appData.siswa || []);

      classBackups[k.id] = {
        kelasId: k.id,
        namaKelas: k.namaKelas,
        classFolderId: classFolder.id,
        classFolderUrl: classFolder.webViewLink || `https://drive.google.com/drive/folders/${classFolder.id}`,
        docId: agendaDoc.id,
        docUrl: agendaDoc.webViewLink || `https://docs.google.com/document/d/${agendaDoc.id}/edit`,
        sheetId: akademikSheet.id,
        sheetUrl: akademikSheet.webViewLink || `https://docs.google.com/spreadsheets/d/${akademikSheet.id}/edit`,
        lastSynced: new Date().toLocaleTimeString('id-ID'),
        status: 'synced',
      };
    } catch (err: any) {
      if (isAuthError(err)) {
        clearTokens();
        throw err;
      }
      console.error(`Error syncing class ${k.namaKelas}:`, err);
      classBackups[k.id] = {
        kelasId: k.id,
        namaKelas: k.namaKelas,
        status: 'error',
        errorMessage: err?.message || 'Gagal sinkronisasi kelas',
      };
    }
  };

  // Run in chunks of 2 for stability & rate-limiting
  for (let i = 0; i < kelasList.length; i += 2) {
    const chunk = kelasList.slice(i, i + 2);
    await Promise.all(chunk.map((k: any) => processClass(k)));
  }

  let totalAgendasCount = 0;
  let totalPresensiCount = 0;
  (appData.agenda || []).forEach((ag: any) => {
    totalAgendasCount++;
    totalPresensiCount += (ag.presensi || []).length;
  });

  let totalNilaiCount = 0;
  allPenilaian.forEach((p: any) => {
    totalNilaiCount += (p.daftarNilai || []).length;
  });

  return {
    isAuthenticated: true,
    rootFolderId,
    rootFolderUrl,
    backupFileUrl: backupFile?.webViewLink,
    lastBackupTime: new Date().toLocaleString('id-ID'),
    totalAgendas: totalAgendasCount,
    totalPresensi: totalPresensiCount,
    totalNilai: totalNilaiCount,
    classBackups,
    statusMessage: 'Sinkronisasi Google Workspace & Drive berhasil 100%!',
    isBackingUp: false,
  };
}
