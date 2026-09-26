import { AgendaMengajar, PenilaianSession, Siswa } from '../types';
import { googleAuthService } from './googleAuthService';

/**
 * Google Sheets Service
 * Handles updating 'Data Akademik' spreadsheet for Presensi and Nilai sheets per class.
 */

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = googleAuthService.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const googleSheetsService = {
  /**
   * Sync Presensi data to Sheet 1 ("Presensi")
   */
  async syncPresensi(
    sheetId: string,
    agendaList: AgendaMengajar[],
    siswaList: Siswa[]
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/google/sheets/sync-presensi', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sheetId,
        agendaList,
        siswaList,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: any = new Error(err.error || 'Gagal menyinkronkan data Presensi ke Google Sheets');
      if (res.status === 401 || err.needsReauth) {
        error.isAuthError = true;
        googleAuthService.clearAuth();
      }
      throw error;
    }

    return await res.json();
  },

  /**
   * Sync Nilai data to Sheet 2 ("Nilai")
   */
  async syncNilai(
    sheetId: string,
    penilaianList: PenilaianSession[],
    siswaList: Siswa[]
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/google/sheets/sync-nilai', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sheetId,
        penilaianList,
        siswaList,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: any = new Error(err.error || 'Gagal menyinkronkan data Nilai ke Google Sheets');
      if (res.status === 401 || err.needsReauth) {
        error.isAuthError = true;
        googleAuthService.clearAuth();
      }
      throw error;
    }

    return await res.json();
  },
};
