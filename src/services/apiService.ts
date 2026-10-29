import {
  TeacherProfile,
  Kelas,
  Siswa,
  JadwalMengajar,
  AgendaMengajar,
  PenilaianSession,
  AppData,
} from '../types';
import {
  initialProfile,
  initialKelas,
  initialSiswa,
  initialJadwal,
  initialAgenda,
  initialPenilaianExtra,
} from '../data/initialData';

export type { AppData };

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'agenda_guru_local_app_data_v1';

function getLocalFallback(): AppData {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.siswa?.length || parsed.kelas?.length || parsed.profile?.namaGuru)) {
        // Ensure XII PPLG 3 and XI PPLG 1 students are up to date
        if (Array.isArray(parsed.siswa)) {
          const hasOldMock = parsed.siswa.some((s: any) => s.kelasId === 'k-xii-pplg-3' && (s.nama === 'AHMAD TAHER AL-ABIYYU' || !s.nama.includes('AHMAD DWI NUR HIDAYAT')));
          if (hasOldMock) {
            parsed.siswa = [
              ...parsed.siswa.filter((s: any) => s.kelasId !== 'k-xii-pplg-3'),
              ...initialSiswa.filter(s => s.kelasId === 'k-xii-pplg-3'),
            ];
          }
          if (!parsed.siswa.some((s: any) => s.kelasId === 'k-xi-pplg-1')) {
            parsed.siswa = [
              ...parsed.siswa.filter((s: any) => s.kelasId !== 'k-xi-pplg-1'),
              ...initialSiswa.filter(s => s.kelasId === 'k-xi-pplg-1'),
            ];
          }
        }
        if (Array.isArray(parsed.kelas)) {
          parsed.kelas = parsed.kelas.map((k: any) => k.id === 'k-xi-pplg-1' ? { ...k, jumlahSiswa: 35 } : k);
        }
        // Merge initial agendas so verified meetings are never dropped or corrupted
        const initialVerifiedIds = new Set(
          initialAgenda
            .filter(
              a =>
                a.kelasId === 'k-xi-pplg-1' ||
                a.kelasId === 'k-xi-pplg-2' ||
                a.kelasId === 'k1' ||
                a.kelasId === 'k-xii-pplg-3'
            )
            .map(a => a.id)
        );
        const agendaMap = new Map<string, AgendaMengajar>();
        if (Array.isArray(parsed.agenda)) {
          parsed.agenda.forEach((a: AgendaMengajar) => {
            if (a && a.id && !initialVerifiedIds.has(a.id)) agendaMap.set(a.id, a);
          });
        }
        initialAgenda.forEach(a => agendaMap.set(a.id, a));
        parsed.agenda = Array.from(agendaMap.values());
        return parsed;
      }
    }
  } catch {
    // ignore json error
  }
  return {
    profile: initialProfile,
    kelas: initialKelas,
    siswa: initialSiswa,
    jadwal: initialJadwal,
    agenda: initialAgenda,
    penilaianExtra: initialPenilaianExtra,
    updatedAt: new Date().toISOString(),
  };
}

function saveLocalFallback(data: AppData) {
  try {
    if (typeof window !== 'undefined') {
      const existingRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw);
          if (existing && Array.isArray(existing.agenda)) {
            const map = new Map<string, AgendaMengajar>();
            existing.agenda.forEach((a: any) => {
              if (a && a.id) map.set(a.id, a);
            });
            (data.agenda || []).forEach((a: any) => {
              if (a && a.id) map.set(a.id, a);
            });
            data.agenda = Array.from(map.values());
          }
        } catch {}
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

/**
  * Helper to perform HTTP JSON requests with error handling
  */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorText = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorText = errJson.error;
      } else if (errJson && errJson.message) {
        errorText = errJson.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorText);
  }

  return response.json() as Promise<T>;
}

export const apiService = {
  /**
   * Get cached local storage fallback
   */
  getLocalFallback(): AppData {
    return getLocalFallback();
  },

  /**
   * Fetch complete database state
   */
  async fetchAppData(): Promise<AppData> {
    try {
      const res = await request<{ success: boolean; data: AppData }>(`${API_BASE}/data`);
      if (res && res.data) {
        saveLocalFallback(res.data);
        return res.data;
      }
    } catch {
      // Fallback in static SPA / offline mode
    }
    return getLocalFallback();
  },

  /**
   * Save complete database state
   */
  async saveAllData(data: AppData): Promise<AppData> {
    saveLocalFallback(data);
    try {
      const res = await request<{ success: boolean; data: AppData }>(`${API_BASE}/data`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.data;
    } catch {
      // Return cached data gracefully
      return data;
    }
  },

  /**
   * Profile API
   */
  async getProfile(): Promise<TeacherProfile> {
    try {
      const res = await request<{ success: boolean; data: TeacherProfile }>(`${API_BASE}/profile`);
      return res.data;
    } catch {
      return getLocalFallback().profile;
    }
  },

  async saveProfile(profile: TeacherProfile): Promise<TeacherProfile> {
    const current = getLocalFallback();
    current.profile = profile;
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: TeacherProfile }>(`${API_BASE}/profile`, {
        method: 'POST',
        body: JSON.stringify(profile),
      });
      return res.data;
    } catch {
      return profile;
    }
  },

  /**
   * Kelas API
   */
  async saveKelas(kelasItem: Kelas): Promise<Kelas[]> {
    const current = getLocalFallback();
    const idx = (current.kelas || []).findIndex(k => k.id === kelasItem.id);
    if (idx >= 0) {
      current.kelas[idx] = kelasItem;
    } else {
      current.kelas = [...(current.kelas || []), kelasItem];
    }
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: Kelas[] }>(`${API_BASE}/kelas`, {
        method: 'POST',
        body: JSON.stringify(kelasItem),
      });
      if (res && res.data) {
        current.kelas = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.kelas;
  },

  async deleteKelas(id: string): Promise<AppData> {
    const current = getLocalFallback();
    current.kelas = (current.kelas || []).filter(k => k.id !== id);
    current.siswa = (current.siswa || []).filter(s => s.kelasId !== id);
    current.jadwal = (current.jadwal || []).filter(j => j.kelasId !== id);
    current.agenda = (current.agenda || []).filter(a => a.kelasId !== id);
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: AppData }>(`${API_BASE}/kelas/${id}`, {
        method: 'DELETE',
      });
      if (res && res.data) {
        saveLocalFallback(res.data);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current;
  },

  /**
   * Siswa API
   */
  async saveSiswa(siswaItem: Siswa): Promise<Siswa[]> {
    const current = getLocalFallback();
    const idx = (current.siswa || []).findIndex(s => s.id === siswaItem.id);
    if (idx >= 0) {
      current.siswa[idx] = siswaItem;
    } else {
      current.siswa = [...(current.siswa || []), siswaItem];
    }
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: Siswa[] }>(`${API_BASE}/siswa`, {
        method: 'POST',
        body: JSON.stringify(siswaItem),
      });
      if (res && res.data) {
        current.siswa = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.siswa;
  },

  async importSiswaBatch(batch: Siswa[]): Promise<Siswa[]> {
    const current = getLocalFallback();
    current.siswa = [...(current.siswa || []), ...batch];
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: Siswa[] }>(`${API_BASE}/siswa/batch`, {
        method: 'POST',
        body: JSON.stringify(batch),
      });
      if (res && res.data) {
        current.siswa = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.siswa;
  },

  async deleteSiswa(id: string): Promise<AppData> {
    const current = getLocalFallback();
    current.siswa = (current.siswa || []).filter(s => s.id !== id);
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: AppData }>(`${API_BASE}/siswa/${id}`, {
        method: 'DELETE',
      });
      if (res && res.data) {
        saveLocalFallback(res.data);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current;
  },

  /**
   * Jadwal API
   */
  async saveJadwal(jadwalItem: JadwalMengajar): Promise<JadwalMengajar[]> {
    const current = getLocalFallback();
    const idx = (current.jadwal || []).findIndex(j => j.id === jadwalItem.id);
    if (idx >= 0) {
      current.jadwal[idx] = jadwalItem;
    } else {
      current.jadwal = [...(current.jadwal || []), jadwalItem];
    }
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: JadwalMengajar[] }>(`${API_BASE}/jadwal`, {
        method: 'POST',
        body: JSON.stringify(jadwalItem),
      });
      if (res && res.data) {
        current.jadwal = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.jadwal;
  },

  async deleteJadwal(id: string): Promise<JadwalMengajar[]> {
    const current = getLocalFallback();
    current.jadwal = (current.jadwal || []).filter(j => j.id !== id);
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: JadwalMengajar[] }>(`${API_BASE}/jadwal/${id}`, {
        method: 'DELETE',
      });
      if (res && res.data) {
        current.jadwal = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.jadwal;
  },

  /**
   * Agenda API
   */
  async saveAgenda(agendaItem: AgendaMengajar): Promise<AgendaMengajar[]> {
    const current = getLocalFallback();
    const idx = (current.agenda || []).findIndex(a => a.id === agendaItem.id);
    if (idx >= 0) {
      current.agenda[idx] = agendaItem;
    } else {
      current.agenda = [agendaItem, ...(current.agenda || [])];
    }
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: AgendaMengajar[] }>(`${API_BASE}/agenda`, {
        method: 'POST',
        body: JSON.stringify(agendaItem),
      });
      if (res && res.data) {
        current.agenda = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.agenda;
  },

  async deleteAgenda(id: string): Promise<AgendaMengajar[]> {
    const current = getLocalFallback();
    current.agenda = (current.agenda || []).filter(a => a.id !== id);
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: AgendaMengajar[] }>(`${API_BASE}/agenda/${id}`, {
        method: 'DELETE',
      });
      if (res && res.data) {
        current.agenda = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.agenda;
  },

  /**
   * Penilaian Extra API
   */
  async savePenilaianExtra(penilaianItem: PenilaianSession): Promise<PenilaianSession[]> {
    const current = getLocalFallback();
    const idx = (current.penilaianExtra || []).findIndex(p => p.id === penilaianItem.id);
    if (idx >= 0) {
      current.penilaianExtra[idx] = penilaianItem;
    } else {
      current.penilaianExtra = [...(current.penilaianExtra || []), penilaianItem];
    }
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: PenilaianSession[] }>(`${API_BASE}/penilaian-extra`, {
        method: 'POST',
        body: JSON.stringify(penilaianItem),
      });
      if (res && res.data) {
        current.penilaianExtra = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.penilaianExtra;
  },

  async deletePenilaianExtra(id: string): Promise<PenilaianSession[]> {
    const current = getLocalFallback();
    current.penilaianExtra = (current.penilaianExtra || []).filter(p => p.id !== id);
    saveLocalFallback(current);
    try {
      const res = await request<{ success: boolean; data: PenilaianSession[] }>(`${API_BASE}/penilaian-extra/${id}`, {
        method: 'DELETE',
      });
      if (res && res.data) {
        current.penilaianExtra = res.data;
        saveLocalFallback(current);
        return res.data;
      }
    } catch {
      // fallback
    }
    return current.penilaianExtra;
  },

  /**
   * Reset All Database Data
   */
  async resetData(): Promise<AppData> {
    const res = await request<{ success: boolean; data: AppData }>(`${API_BASE}/reset`, {
      method: 'POST',
    });
    if (res && res.data) {
      saveLocalFallback(res.data);
      return res.data;
    }
    return getLocalFallback();
  },
};
