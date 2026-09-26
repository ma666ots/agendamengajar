import { AgendaMengajar, TeacherProfile, Kelas } from '../types';
import { googleAuthService } from './googleAuthService';

/**
 * Google Docs Service
 * Handles formatting and updating Google Docs document for Agenda Mengajar per class.
 */

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = googleAuthService.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const googleDocsService = {
  /**
   * Sync class agendas to Google Doc
   */
  async syncClassAgendas(
    docId: string,
    agendas: AgendaMengajar[],
    kelas: Kelas,
    profile: TeacherProfile
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/google/docs/sync-agendas', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        docId,
        agendas,
        kelas,
        profile,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: any = new Error(err.error || 'Gagal menyinkronkan agenda ke Google Docs');
      if (res.status === 401 || err.needsReauth) {
        error.isAuthError = true;
        googleAuthService.clearAuth();
      }
      throw error;
    }

    return await res.json();
  },

  /**
   * Sync a single Agenda entry (add/update) in Google Doc
   */
  async syncSingleAgenda(
    docId: string,
    agenda: AgendaMengajar,
    profile: TeacherProfile
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/google/docs/sync-single-agenda', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        docId,
        agenda,
        profile,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: any = new Error(err.error || 'Gagal menyimpan agenda ke Google Docs');
      if (res.status === 401 || err.needsReauth) {
        error.isAuthError = true;
        googleAuthService.clearAuth();
      }
      throw error;
    }

    return await res.json();
  },

  /**
   * Delete single Agenda entry from Google Doc by agendaId
   */
  async deleteSingleAgenda(docId: string, agendaId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/google/docs/delete-agenda', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        docId,
        agendaId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal menghapus agenda dari Google Docs');
    }

    return await res.json();
  },
};
