/**
 * Google Drive Service
 * Handles folder structure and file discovery/creation in Google Drive.
 * Root Folder: Agenda Mengajar Guru/
 * Class Folder: {Nama Kelas}/
 * Documents:
 *   - Agenda Mengajar (Google Docs)
 *   - Data Akademik (Google Sheets)
 */

import { googleAuthService } from './googleAuthService';

export interface DriveFileRef {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = googleAuthService.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const googleDriveService = {
  /**
   * Helper to execute fetch with auto retry max 3 times
   */
  async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, delayMs = 1000): Promise<T> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (err: any) {
        if (err?.isAuthError || err?.message?.includes('otentikasi') || err?.message?.includes('credentials')) {
          throw err;
        }
        attempt++;
        if (attempt >= maxAttempts) throw err;
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw new Error('Retries exhausted');
  },

  /**
   * Get or Create Root Folder "Agenda Mengajar Guru/"
   */
  async getOrCreateRootFolder(): Promise<DriveFileRef> {
    return this.withRetry(async () => {
      const res = await fetch('/api/google/drive/root-folder', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.error || 'Gagal membuat/mencari folder utama Google Drive');
        if (res.status === 401 || err.needsReauth) {
          e.isAuthError = true;
          googleAuthService.clearAuth();
        }
        throw e;
      }
      const json = await res.json();
      return json.folder;
    });
  },

  /**
   * Get or Create Class Subfolder "{Nama Kelas}/" inside Root Folder
   */
  async getOrCreateClassFolder(rootFolderId: string, namaKelas: string): Promise<DriveFileRef> {
    return this.withRetry(async () => {
      const res = await fetch('/api/google/drive/class-folder', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rootFolderId, namaKelas }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.error || `Gagal membuat/mencari folder kelas ${namaKelas}`);
        if (res.status === 401 || err.needsReauth) {
          e.isAuthError = true;
          googleAuthService.clearAuth();
        }
        throw e;
      }
      const json = await res.json();
      return json.folder;
    });
  },

  /**
   * Get or Create Google Doc file "Agenda Mengajar" inside Class Folder
   */
  async getOrCreateAgendaDoc(classFolderId: string): Promise<DriveFileRef> {
    return this.withRetry(async () => {
      const res = await fetch('/api/google/drive/doc-file', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ classFolderId, fileName: 'Agenda Mengajar' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.error || 'Gagal membuat/mencari Google Docs Agenda Mengajar');
        if (res.status === 401 || err.needsReauth) {
          e.isAuthError = true;
          googleAuthService.clearAuth();
        }
        throw e;
      }
      const json = await res.json();
      return json.file;
    });
  },

  /**
   * Get or Create Google Sheet file "Data Akademik" inside Class Folder
   */
  async getOrCreateAkademikSheet(classFolderId: string): Promise<DriveFileRef> {
    return this.withRetry(async () => {
      const res = await fetch('/api/google/drive/sheet-file', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ classFolderId, fileName: 'Data Akademik' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.error || 'Gagal membuat/mencari Google Sheets Data Akademik');
        if (res.status === 401 || err.needsReauth) {
          e.isAuthError = true;
          googleAuthService.clearAuth();
        }
        throw e;
      }
      const json = await res.json();
      return json.file;
    });
  },
};
