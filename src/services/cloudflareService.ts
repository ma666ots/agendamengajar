import {
  TeacherProfile,
  Kelas,
  Siswa,
  JadwalMengajar,
  AgendaMengajar,
  PenilaianSession,
} from '../types';
import { apiService, AppData } from './apiService';

/**
 * Cloudflare D1 Service
 * Serves as the Primary Database (Single Source of Truth) for all app operations.
 */
export const cloudflareService = {
  /**
   * Fetch complete state from Cloudflare D1 / Primary DB API
   */
  async getAppData(): Promise<AppData> {
    return await apiService.fetchAppData();
  },

  /**
   * Save complete state to Cloudflare D1 / Primary DB API
   */
  async saveAppData(data: AppData): Promise<AppData> {
    return await apiService.saveAllData(data);
  },

  /**
   * Profile CRUD
   */
  async saveProfile(profile: TeacherProfile): Promise<TeacherProfile> {
    return await apiService.saveProfile(profile);
  },

  /**
   * Kelas CRUD
   */
  async saveKelas(kelasItem: Kelas): Promise<Kelas[]> {
    return await apiService.saveKelas(kelasItem);
  },

  async deleteKelas(id: string): Promise<AppData> {
    return await apiService.deleteKelas(id);
  },

  /**
   * Siswa CRUD
   */
  async saveSiswa(siswaItem: Siswa): Promise<Siswa[]> {
    return await apiService.saveSiswa(siswaItem);
  },

  async importSiswaBatch(batch: Siswa[]): Promise<Siswa[]> {
    return await apiService.importSiswaBatch(batch);
  },

  async deleteSiswa(id: string): Promise<AppData> {
    return await apiService.deleteSiswa(id);
  },

  /**
   * Jadwal CRUD
   */
  async saveJadwal(jadwalItem: JadwalMengajar): Promise<JadwalMengajar[]> {
    return await apiService.saveJadwal(jadwalItem);
  },

  async deleteJadwal(id: string): Promise<JadwalMengajar[]> {
    return await apiService.deleteJadwal(id);
  },

  /**
   * Agenda CRUD
   */
  async saveAgenda(agendaItem: AgendaMengajar): Promise<AgendaMengajar[]> {
    return await apiService.saveAgenda(agendaItem);
  },

  async deleteAgenda(id: string): Promise<AgendaMengajar[]> {
    return await apiService.deleteAgenda(id);
  },

  /**
   * Penilaian Extra CRUD
   */
  async savePenilaianExtra(penilaianItem: PenilaianSession): Promise<PenilaianSession[]> {
    return await apiService.savePenilaianExtra(penilaianItem);
  },

  async deletePenilaianExtra(id: string): Promise<PenilaianSession[]> {
    return await apiService.deletePenilaianExtra(id);
  },

  /**
   * Reset All Database Data
   */
  async resetData(): Promise<AppData> {
    return await apiService.resetData();
  },
};
