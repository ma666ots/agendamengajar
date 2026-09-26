import { AppData } from './apiService';
import { cloudflareService } from './cloudflareService';
import { googleDriveService } from './googleDriveService';
import { googleDocsService } from './googleDocsService';
import { googleSheetsService } from './googleSheetsService';
import { googleAuthService } from './googleAuthService';
import { GoogleBackupStatus, ClassBackupInfo, AgendaMengajar, PenilaianSession, TeacherProfile, Kelas, Siswa } from '../types';

/**
 * Backup Service
 * Hybrid Architecture Orchestrator:
 * 1. Cloud Firestore / D1 is Primary Database (Source of Truth).
 * 2. Google Workspace (Drive, Docs, Sheets, JSON Archive) serves as automated digital archive/backup.
 */

export interface BackupResult {
  cloudflareSuccess: boolean;
  googleSuccess: boolean;
  message: string;
  googleBackupStatus?: GoogleBackupStatus;
}

export const backupService = {
  /**
   * Perform retry execution max 3 times for a given operation
   */
  async retry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: any;
    for (let i = 1; i <= maxAttempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (i < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000 * i));
        }
      }
    }
    throw lastError;
  },

  /**
   * Full Backup Pass for all classes across Google Drive, Docs & Sheets.
   * Utilizes high-speed server-side batch sync to avoid 20+ sequential browser round-trips.
   */
  async runFullGoogleBackup(
    appData: AppData,
    onProgress?: (step: string) => void
  ): Promise<GoogleBackupStatus> {
    onProgress?.('Menghubungkan ke Google Workspace...');

    const token = googleAuthService.getAccessToken();
    if (!token) {
      const statusRes = await fetch('/api/google/status').catch(() => null);
      const statusJson = statusRes ? await statusRes.json().catch(() => ({})) : {};
      if (!statusJson?.isAuthenticated) {
        return {
          isAuthenticated: false,
          totalAgendas: (appData.agenda || []).length,
          totalPresensi: 0,
          totalNilai: 0,
          classBackups: {},
          statusMessage: 'Google Workspace belum terhubung atau sesi telah kadaluarsa',
          lastError: 'Google Workspace belum terhubung atau otentikasi telah kadaluarsa',
          isBackingUp: false,
        };
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attempt high-speed server sync first
    try {
      onProgress?.('Menyinkronkan folder Google Drive, Docs, & Sheets...');
      const response = await fetch('/api/google/sync-full', {
        method: 'POST',
        headers,
        body: JSON.stringify({ appData }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.status) {
          onProgress?.('Sinkronisasi Google Workspace selesai!');
          return result.status;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 401 || errJson.needsReauth) {
          googleAuthService.clearAuth();
          throw new Error(errJson.error || 'Sesi otentikasi Google telah kadaluarsa atau tidak valid. Silakan hubungkan kembali akun Google Anda.');
        }
        console.warn('Server sync-full error, falling back:', errJson.error || response.statusText);
      }
    } catch (serverErr: any) {
      if (serverErr?.message?.includes('otentikasi') || serverErr?.message?.includes('credentials')) {
        throw serverErr;
      }
      console.warn('Server sync-full encountered error, attempting fallback:', serverErr);
    }

    // Fallback: client-side sequential sync with granular progress
    const classBackups: Record<string, ClassBackupInfo> = {};
    let totalAgendasCount = 0;
    let totalPresensiCount = 0;
    let totalNilaiCount = 0;

    (appData.agenda || []).forEach(ag => {
      totalAgendasCount++;
      totalPresensiCount += (ag.presensi || []).length;
    });

    const allPenilaian: PenilaianSession[] = [
      ...(appData.agenda || []).filter(a => a.adaPenilaian && a.penilaian).map(a => a.penilaian!),
      ...(appData.penilaianExtra || []),
    ];
    allPenilaian.forEach(p => {
      totalNilaiCount += (p.daftarNilai || []).length;
    });

    try {
      onProgress?.('Mempersiapkan folder utama di Google Drive...');
      const rootFolder = await this.retry(() => googleDriveService.getOrCreateRootFolder());

      const kelasList = appData.kelas || [];
      for (let idx = 0; idx < kelasList.length; idx++) {
        const k = kelasList[idx];
        onProgress?.(`Menyinkronkan kelas (${idx + 1}/${kelasList.length}): ${k.namaKelas}...`);
        try {
          const classFolder = await this.retry(() =>
            googleDriveService.getOrCreateClassFolder(rootFolder.id, k.namaKelas)
          );

          const agendaDoc = await this.retry(() =>
            googleDriveService.getOrCreateAgendaDoc(classFolder.id)
          );

          const akademikSheet = await this.retry(() =>
            googleDriveService.getOrCreateAkademikSheet(classFolder.id)
          );

          const classAgendas = (appData.agenda || []).filter(a => a.kelasId === k.id);
          await this.retry(() =>
            googleDocsService.syncClassAgendas(agendaDoc.id, classAgendas, k, appData.profile)
          );

          await this.retry(() =>
            googleSheetsService.syncPresensi(akademikSheet.id, classAgendas, appData.siswa || [])
          );

          const classPenilaian = allPenilaian.filter(p => p.kelasId === k.id);
          await this.retry(() =>
            googleSheetsService.syncNilai(akademikSheet.id, classPenilaian, appData.siswa || [])
          );

          classBackups[k.id] = {
            kelasId: k.id,
            namaKelas: k.namaKelas,
            classFolderId: classFolder.id,
            classFolderUrl: classFolder.webViewLink,
            docId: agendaDoc.id,
            docUrl: agendaDoc.webViewLink,
            sheetId: akademikSheet.id,
            sheetUrl: akademikSheet.webViewLink,
            lastSynced: new Date().toLocaleTimeString('id-ID'),
            status: 'synced',
          };
        } catch (classErr: any) {
          console.error(`Error backing up class ${k.namaKelas}:`, classErr);
          if (classErr?.isAuthError || classErr?.status === 401 || classErr?.message?.includes('otentikasi') || classErr?.message?.includes('credentials')) {
            googleAuthService.clearAuth();
            throw new Error('Sesi otentikasi Google telah kadaluarsa atau tidak valid. Silakan hubungkan kembali akun Google Anda.');
          }
          classBackups[k.id] = {
            kelasId: k.id,
            namaKelas: k.namaKelas,
            status: 'error',
            errorMessage: classErr?.message || 'Gagal backup kelas',
          };
        }
      }

      onProgress?.('Sinkronisasi selesai!');
      return {
        isAuthenticated: true,
        rootFolderId: rootFolder.id,
        rootFolderUrl: rootFolder.webViewLink,
        lastBackupTime: new Date().toLocaleString('id-ID'),
        totalAgendas: totalAgendasCount,
        totalPresensi: totalPresensiCount,
        totalNilai: totalNilaiCount,
        classBackups,
        statusMessage: 'Backup Google Workspace berhasil diperbarui!',
        isBackingUp: false,
      };
    } catch (err: any) {
      const isAuth =
        err?.isAuthError ||
        err?.status === 401 ||
        err?.message?.includes('otentikasi') ||
        err?.message?.includes('credentials') ||
        err?.message?.includes('kadaluarsa');

      if (isAuth) {
        console.warn('Google Workspace auth expired or not active:', err?.message || err);
      } else {
        console.error('Failed full Google Backup pass:', err);
      }

      return {
        isAuthenticated: false,
        totalAgendas: totalAgendasCount,
        totalPresensi: totalPresensiCount,
        totalNilai: totalNilaiCount,
        classBackups,
        statusMessage: isAuth
          ? 'Sesi Google Workspace telah kadaluarsa. Silakan hubungkan kembali akun Google Anda.'
          : 'Gagal melakukan backup ke Google Workspace',
        lastError: err?.message || 'Terjadi kesalahan pada integrasi Google API',
        isBackingUp: false,
      };
    }
  },

  /**
   * Pull and restore data from Google Drive (Two-Way Sync / Recovery)
   */
  async restoreFromGoogleDrive(): Promise<{ success: boolean; message: string; data?: any; file?: any }> {
    const token = googleAuthService.getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/google/restore-from-drive', {
      method: 'POST',
      headers,
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      if (res.status === 401 || result.needsReauth) {
        googleAuthService.clearAuth();
        throw new Error(result.error || 'Sesi otentikasi Google telah kadaluarsa atau tidak valid. Silakan hubungkan kembali akun Google Anda.');
      }
      throw new Error(result.error || 'Gagal memulihkan data dari Google Drive');
    }
    return result;
  },

  /**
   * Unified Handler when saving an Agenda:
   * 1. Save to Cloudflare D1 first.
   * 2. If Cloudflare fails -> throw Error (abort).
   * 3. If Cloudflare succeeds -> asynchronously attempt Google Workspace backup update.
   */
  async saveAgendaWithBackup(
    agenda: AgendaMengajar,
    allAppData: AppData
  ): Promise<BackupResult> {
    // 1. Cloudflare D1 Save (Must succeed)
    let updatedAgendas;
    try {
      updatedAgendas = await cloudflareService.saveAgenda(agenda);
    } catch (err: any) {
      throw new Error(`Gagal menyimpan ke Database Utama (Cloudflare D1): ${err?.message || 'Server error'}`);
    }

    // Update in-memory appData
    allAppData.agenda = updatedAgendas;

    // 2. Google Workspace Backup (Async with Retry if authenticated)
    let googleSuccess = false;
    let googleMessage = '';
    let backupStatus: GoogleBackupStatus | undefined;

    if (googleAuthService.getAccessToken()) {
      try {
        backupStatus = await this.runFullGoogleBackup(allAppData);
        googleSuccess = Boolean(backupStatus.isAuthenticated && !backupStatus.lastError);
        googleMessage = googleSuccess
          ? 'Data tersimpan di Cloudflare D1 & Backup Google Workspace diperbarui!'
          : 'Data berhasil tersimpan di Database Utama.';
      } catch (err: any) {
        console.warn('Google Workspace Backup notification:', err?.message || err);
        googleSuccess = false;
        googleMessage = 'Data tersimpan di Database Utama.';
      }
    } else {
      googleMessage = 'Data tersimpan di Database Utama (Cloudflare D1).';
    }

    return {
      cloudflareSuccess: true,
      googleSuccess,
      message: googleMessage,
      googleBackupStatus: backupStatus,
    };
  },

  /**
   * Unified Handler when saving Penilaian Extra:
   * 1. Save to Cloudflare D1 first.
   * 2. Attempt Google Workspace backup update.
   */
  async savePenilaianWithBackup(
    penilaian: PenilaianSession,
    allAppData: AppData
  ): Promise<BackupResult> {
    let updatedPenilaian;
    try {
      updatedPenilaian = await cloudflareService.savePenilaianExtra(penilaian);
    } catch (err: any) {
      throw new Error(`Gagal menyimpan ke Database Utama (Cloudflare D1): ${err?.message || 'Server error'}`);
    }

    allAppData.penilaianExtra = updatedPenilaian;

    let googleSuccess = false;
    let googleMessage = '';
    let backupStatus: GoogleBackupStatus | undefined;

    if (googleAuthService.getAccessToken()) {
      try {
        backupStatus = await this.runFullGoogleBackup(allAppData);
        googleSuccess = Boolean(backupStatus.isAuthenticated && !backupStatus.lastError);
        googleMessage = googleSuccess
          ? 'Penilaian tersimpan di Cloudflare D1 & Google Sheets diperbarui!'
          : 'Penilaian tersimpan di Database Utama.';
      } catch (err: any) {
        googleSuccess = false;
        googleMessage = 'Penilaian tersimpan di Database Utama.';
      }
    } else {
      googleMessage = 'Penilaian tersimpan di Database Utama (Cloudflare D1).';
    }

    return {
      cloudflareSuccess: true,
      googleSuccess,
      message: googleMessage,
      googleBackupStatus: backupStatus,
    };
  },
};
