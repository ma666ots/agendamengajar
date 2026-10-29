/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TeacherProfile,
  Kelas,
  Siswa,
  JadwalMengajar,
  AgendaMengajar,
  PenilaianSession,
  ActiveTab,
} from './types';
import { apiService } from './services/apiService';
import { firestoreService } from './services/firestoreService';
import {
  initialProfile,
  initialKelas,
  initialSiswa,
  initialJadwal,
  initialAgenda,
  initialPenilaianExtra,
} from './data/initialData';

import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { JadwalView } from './components/JadwalView';
import { KelasSiswaView } from './components/KelasSiswaView';
import { InputNilaiView } from './components/InputNilaiView';
import { RekapPresensiView } from './components/RekapPresensiView';
import { HistoryLaporanView } from './components/HistoryLaporanView';
import { BackupDashboardView } from './components/BackupDashboardView';
import { AgendaFlowModal } from './components/AgendaFlowModal';
import { SettingsModal } from './components/SettingsModal';
import { PinLockModal } from './components/PinLockModal';
import { backupService } from './services/backupService';
import { generateCurriculumAgenda, isGenerativeCode } from './utils/agendaCurriculumGenerator';
import { findActiveSchedule } from './utils/scheduleUtils';
import { Database, Loader2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function App() {
  // PIN Lock State - default to locked so user MUST enter PIN before app access
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // App Data State (Database Single Source of Truth)
  const [profile, setProfile] = useState<TeacherProfile>(initialProfile);
  const [kelasList, setKelasList] = useState<Kelas[]>(initialKelas);
  const [siswaList, setSiswaList] = useState<Siswa[]>(initialSiswa);
  const [jadwalList, setJadwalList] = useState<JadwalMengajar[]>(initialJadwal);
  const [agendaList, setAgendaList] = useState<AgendaMengajar[]>(initialAgenda);
  const [penilaianExtraList, setPenilaianExtraList] = useState<PenilaianSession[]>(
    initialPenilaianExtra
  );

  // Database Connection & Loading State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isDataLoadedRef = useRef<boolean>(false);

  // UI Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isOpenMobileSidebar, setIsOpenMobileSidebar] = useState<boolean>(false);
  const [isCollapsedSidebar, setIsCollapsedSidebar] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleToggleSidebar = () => {
    setIsCollapsedSidebar(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Modals state
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState<boolean>(false);
  const [presetJadwalForAgenda, setPresetJadwalForAgenda] = useState<JadwalMengajar | null>(null);
  const [editingAgenda, setEditingAgenda] = useState<AgendaMengajar | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Initial Database Fetch on App Startup (Firestore Primary Cloud Database + Local Cache)
  const loadDataFromDatabase = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      // 1. Fetch persistent cloud Firestore, server database, and local cache in parallel
      const [firestoreData, serverData] = await Promise.all([
        firestoreService.getPersistentAppData().catch(() => null),
        apiService.fetchAppData().catch(() => null),
      ]);
      const localData = apiService.getLocalFallback();

      // Primary source: Firestore takes precedence if available, else server, else local
      const primaryData = firestoreData || serverData || localData;

      // Profile
      const rawProfile = primaryData?.profile || initialProfile;
      let prof = { ...rawProfile };
      if (prof.fotoProfilUrl === '/foto_guru.jpg') {
        prof.fotoProfilUrl = '';
      }
      if (prof.logoSekolahUrl === '/logo_smk2.jpg' || !prof.logoSekolahUrl) {
        prof.logoSekolahUrl = '/logo_smk2.png';
      }
      if (
        prof.namaGuru === 'Hendra Wijaya, S.Pd., M.T.' ||
        prof.namaSekolah === 'SMK Negeri 1 Jakarta'
      ) {
        prof = {
          ...initialProfile,
          pin: rawProfile.pin || initialProfile.pin,
        };
      }
      setProfile(prof);

      // Kelas list: Ensure XI PPLG 1 and XI PPLG 2 have jumlahSiswa = 35
      let kelas =
        Array.isArray(primaryData?.kelas) && primaryData.kelas.length > 0
          ? primaryData.kelas
          : initialKelas;
      kelas = kelas.map(k => {
        if (k.id === 'k-xi-pplg-1' || k.id === 'k-xi-pplg-2') {
          return { ...k, jumlahSiswa: 35 };
        }
        return k;
      });
      setKelasList(kelas);

      // Agenda list: Merge agendas from all available sources
      // For k-xi-pplg-1, k-xi-pplg-2, k1, and k-xii-pplg-3, enforce the verified meetings from initialAgenda
      const initialVerifiedAgendas = initialAgenda.filter(
        a =>
          a.kelasId === 'k-xi-pplg-1' ||
          a.kelasId === 'k-xi-pplg-2' ||
          a.kelasId === 'k1' ||
          a.kelasId === 'k-xii-pplg-3'
      );
      const initialVerifiedIds = new Set(initialVerifiedAgendas.map(a => a.id));

      const agendaMap = new Map<string, AgendaMengajar>();
      if (Array.isArray(localData?.agenda)) {
        localData.agenda.forEach(a => {
          if (a && a.id && !initialVerifiedIds.has(a.id)) agendaMap.set(a.id, a);
        });
      }
      if (Array.isArray(serverData?.agenda)) {
        serverData.agenda.forEach(a => {
          if (a && a.id && !initialVerifiedIds.has(a.id)) agendaMap.set(a.id, a);
        });
      }
      if (Array.isArray(firestoreData?.agenda)) {
        firestoreData.agenda.forEach(a => {
          if (a && a.id && !initialVerifiedIds.has(a.id)) agendaMap.set(a.id, a);
        });
      }
      // Put verified initialAgenda into map
      initialAgenda.forEach(a => {
        if (a && a.id) agendaMap.set(a.id, a);
      });
      // Also preserve any newly user-created agenda (e.g. custom date or recent session)
      [...(localData?.agenda || []), ...(serverData?.agenda || []), ...(firestoreData?.agenda || [])].forEach(a => {
        if (a && a.id && !agendaMap.has(a.id)) {
          agendaMap.set(a.id, a);
        }
      });

      // Auto-update & enrich any existing agenda that only contains 1 word or placeholder,
      // ensuring continuous, sustainable curriculum progression
      const enrichedAgendas = Array.from(agendaMap.values()).map(a => {
        const words = (a.materi || '').trim().split(/\s+/).filter(Boolean);
        const isOneWord = words.length <= 1;
        const isSpecificShort =
          a.materi?.trim().toLowerCase() === 'php' ||
          a.materi?.trim().toLowerCase() === 'ok' ||
          a.materi?.trim().toLowerCase() === 'project' ||
          a.materi?.trim().toLowerCase() === 'oke123';

        if (isOneWord || isSpecificShort) {
          const k = kelas.find(kItem => kItem.id === a.kelasId);
          const tingkat = k?.tingkat || (a.kelasId.includes('xii') ? 'XII' : 'XI');
          const enriched = generateCurriculumAgenda(tingkat, a.pertemuanKe || 1, a.mapel || 'Pemrograman Web');
          return {
            ...a,
            materi: enriched.materi,
            capaianPembelajaran: a.capaianPembelajaran && a.capaianPembelajaran.length > 10 ? a.capaianPembelajaran : enriched.capaianPembelajaran,
            indikator: a.indikator && a.indikator.length > 5 ? a.indikator : enriched.indikator,
            catatanKejadian: a.catatanKejadian && a.catatanKejadian.length > 5 ? a.catatanKejadian : enriched.catatanKejadian,
            refleksiGuru: a.refleksiGuru && a.refleksiGuru.length > 5 ? a.refleksiGuru : enriched.refleksiGuru,
            tindakLanjut: a.tindakLanjut && a.tindakLanjut.length > 5 ? a.tindakLanjut : enriched.tindakLanjut,
          };
        }
        return a;
      });
      setAgendaList(enrichedAgendas);

      // Siswa list: Ensure XI PPLG 1 and XII PPLG 3 use the authentic student names
      let siswa =
        Array.isArray(primaryData?.siswa) && primaryData.siswa.length > 0
          ? primaryData.siswa
          : initialSiswa;

      const hasOldMockSiswa = siswa.some(
        s => s.kelasId === 'k-xii-pplg-3' && (s.nama === 'AHMAD TAHER AL-ABIYYU' || !s.nama.includes('AHMAD DWI NUR HIDAYAT'))
      );
      const newK12Siswa = initialSiswa.filter(s => s.kelasId === 'k-xii-pplg-3');
      if ((hasOldMockSiswa || !siswa.some(s => s.kelasId === 'k-xii-pplg-3')) && newK12Siswa.length > 0) {
        siswa = [
          ...siswa.filter(s => s.kelasId !== 'k-xii-pplg-3'),
          ...newK12Siswa,
        ];
      }

      const newK11Siswa = initialSiswa.filter(s => s.kelasId === 'k-xi-pplg-1');
      if (!siswa.some(s => s.kelasId === 'k-xi-pplg-1') && newK11Siswa.length > 0) {
        siswa = [
          ...siswa.filter(s => s.kelasId !== 'k-xi-pplg-1'),
          ...newK11Siswa,
        ];
      }

      const newK11Pplg2Siswa = initialSiswa.filter(s => s.kelasId === 'k-xi-pplg-2');
      if ((!siswa.some(s => s.kelasId === 'k-xi-pplg-2') || siswa.filter(s => s.kelasId === 'k-xi-pplg-2').length < 35) && newK11Pplg2Siswa.length > 0) {
        siswa = [
          ...siswa.filter(s => s.kelasId !== 'k-xi-pplg-2'),
          ...newK11Pplg2Siswa,
        ];
      }
      // Detect students currently with magang status from agendas for initial setup if not yet explicitly set
      const magangStudentIdSet = new Set<string>();
      enrichedAgendas.forEach(ag => {
        ag.presensi?.forEach(p => {
          if (p.status === 'magang') magangStudentIdSet.add(p.siswaId);
        });
      });

      siswa = siswa.map(s => ({
        ...s,
        isMagang: typeof s.isMagang === 'boolean' ? s.isMagang : magangStudentIdSet.has(s.id),
      }));

      setSiswaList(siswa);

      // Jadwal list
      const jadwal = Array.isArray(primaryData?.jadwal) ? primaryData.jadwal : initialJadwal;
      setJadwalList(jadwal);

      // Penilaian extra list: Merge across sources
      const penilaianMap = new Map<string, PenilaianSession>();
      if (Array.isArray(localData?.penilaianExtra)) {
        localData.penilaianExtra.forEach(p => {
          if (p && p.id) penilaianMap.set(p.id, p);
        });
      }
      initialPenilaianExtra.forEach(p => {
        if (p && p.id) penilaianMap.set(p.id, p);
      });
      if (Array.isArray(serverData?.penilaianExtra)) {
        serverData.penilaianExtra.forEach(p => {
          if (p && p.id) penilaianMap.set(p.id, p);
        });
      }
      if (Array.isArray(firestoreData?.penilaianExtra)) {
        firestoreData.penilaianExtra.forEach(p => {
          if (p && p.id) penilaianMap.set(p.id, p);
        });
      }
      // Ensure Ulangan PHP session for XI PPLG 1 is always included
      const ulanganPhpSession = initialPenilaianExtra.find(p => p.id === 'pen-xi-pplg1-ulangan-php');
      if (ulanganPhpSession) {
        penilaianMap.set('pen-xi-pplg1-ulangan-php', ulanganPhpSession);
      }
      // Purge obsolete dummy tasks for XI PPLG 1, 2, & 3
      penilaianMap.delete('pen-xi-pplg1-tugas1');
      penilaianMap.delete('pen-xi-pplg1-proyek');
      penilaianMap.delete('pen-xi-pplg1-presensi');
      penilaianMap.delete('pen-xi-pplg2-tugas-html-2');
      penilaianMap.delete('pen-ex-1');

      const penilaian = Array.from(penilaianMap.values());
      setPenilaianExtraList(penilaian);

      // Sync down to server API and local storage so all layers match
      const completeSync = {
        profile: prof,
        kelas,
        siswa,
        jadwal,
        agenda: enrichedAgendas,
        penilaianExtra: penilaian,
        updatedAt: new Date().toISOString(),
      };
      apiService.saveAllData(completeSync).catch(() => {});
    } catch (err: any) {
      console.error('Failed to load initial data from Database API:', err);
      setFetchError(err?.message || 'Gagal terhubung ke Database Cloud.');
    } finally {
      isDataLoadedRef.current = true;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLocked(true);
    loadDataFromDatabase();
  }, []);

  // Auto-sync every state change to Firebase Firestore and Local backend (Debounced 1s)
  useEffect(() => {
    if (isLoading || !isDataLoadedRef.current) return;
    const timer = setTimeout(() => {
      firestoreService.savePersistentAppData({
        profile,
        kelas: kelasList,
        siswa: siswaList,
        jadwal: jadwalList,
        agenda: agendaList,
        penilaianExtra: penilaianExtraList,
      });
      apiService
        .saveAllData({
          profile,
          kelas: kelasList,
          siswa: siswaList,
          jadwal: jadwalList,
          agenda: agendaList,
          penilaianExtra: penilaianExtraList,
        })
        .catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [profile, kelasList, siswaList, jadwalList, agendaList, penilaianExtraList, isLoading]);

  const handleUnlockSuccess = () => {
    setIsLocked(false);
  };

  const handleLockClick = () => {
    setIsLocked(true);
  };

  // Profile Save (Database Auto-Save)
  const handleSaveProfile = async (newProfile: TeacherProfile) => {
    setProfile(newProfile);
    try {
      const updated = await apiService.saveProfile(newProfile);
      if (updated) setProfile(updated);
    } catch (err) {
      console.error('Failed to save profile in database:', err);
    }
  };

  // Kelas CRUD (Relational Database Auto-Save & Cascading Delete)
  const handleSaveKelas = async (k: Kelas) => {
    const exists = kelasList.some(item => item.id === k.id);
    const updatedLocally = exists
      ? kelasList.map(item => (item.id === k.id ? k : item))
      : [...kelasList, k];
    setKelasList(updatedLocally);

    try {
      const res = await apiService.saveKelas(k);
      if (res) setKelasList(res);
    } catch (err) {
      console.error('Failed to save kelas in database:', err);
    }
  };

  const handleDeleteKelas = async (id: string) => {
    const nextKelas = kelasList.filter(k => k.id !== id);
    const nextSiswa = siswaList.filter(s => s.kelasId !== id);
    const nextJadwal = jadwalList.filter(j => j.kelasId !== id);
    const nextAgenda = agendaList.filter(a => a.kelasId !== id);
    const nextPenilaian = penilaianExtraList.filter(p => p.kelasId !== id);

    setKelasList(nextKelas);
    setSiswaList(nextSiswa);
    setJadwalList(nextJadwal);
    setAgendaList(nextAgenda);
    setPenilaianExtraList(nextPenilaian);

    const currentData = {
      profile,
      kelas: nextKelas,
      siswa: nextSiswa,
      jadwal: nextJadwal,
      agenda: nextAgenda,
      penilaianExtra: nextPenilaian,
      updatedAt: new Date().toISOString(),
    };
    firestoreService.savePersistentAppData(currentData).catch(() => {});

    try {
      const fullDb = await apiService.deleteKelas(id);
      if (fullDb) {
        setKelasList(fullDb.kelas);
        setSiswaList(fullDb.siswa);
        setJadwalList(fullDb.jadwal);
        setAgendaList(fullDb.agenda);
        setPenilaianExtraList(fullDb.penilaianExtra);
      }
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to delete kelas in database:', err);
    }
  };

  // Siswa CRUD (Database Auto-Save & Relational Clean)
  const handleSaveSiswa = async (s: Siswa) => {
    const exists = siswaList.some(item => item.id === s.id);
    const updatedLocally = exists
      ? siswaList.map(item => (item.id === s.id ? s : item))
      : [...siswaList, s];
    setSiswaList(updatedLocally);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: updatedLocally,
      jadwal: jadwalList,
      agenda: agendaList,
      penilaianExtra: penilaianExtraList,
      updatedAt: new Date().toISOString(),
    };
    firestoreService.savePersistentAppData(currentData).catch(() => {});

    try {
      const res = await apiService.saveSiswa(s);
      if (res) setSiswaList(res);
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to save siswa in database:', err);
    }
  };

  const handleDeleteSiswa = async (id: string) => {
    const nextSiswa = siswaList.filter(s => s.id !== id);
    const nextAgenda = agendaList.map(a => ({
      ...a,
      presensi: a.presensi ? a.presensi.filter(p => p.siswaId !== id) : [],
    }));
    const nextPenilaian = penilaianExtraList.map(p => ({
      ...p,
      daftarNilai: p.daftarNilai ? p.daftarNilai.filter(n => n.siswaId !== id) : [],
    }));

    setSiswaList(nextSiswa);
    setAgendaList(nextAgenda);
    setPenilaianExtraList(nextPenilaian);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: nextSiswa,
      jadwal: jadwalList,
      agenda: nextAgenda,
      penilaianExtra: nextPenilaian,
      updatedAt: new Date().toISOString(),
    };
    firestoreService.savePersistentAppData(currentData).catch(() => {});

    try {
      const fullDb = await apiService.deleteSiswa(id);
      if (fullDb) {
        setSiswaList(fullDb.siswa);
        setAgendaList(fullDb.agenda);
        setPenilaianExtraList(fullDb.penilaianExtra);
      }
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to delete siswa in database:', err);
    }
  };

  const handleImportSiswaBatch = async (newSiswaBatch: Siswa[]) => {
    const updated = [...siswaList, ...newSiswaBatch];
    setSiswaList(updated);
    const currentData = {
      profile,
      kelas: kelasList,
      siswa: updated,
      jadwal: jadwalList,
      agenda: agendaList,
      penilaianExtra: penilaianExtraList,
      updatedAt: new Date().toISOString(),
    };
    firestoreService.savePersistentAppData(currentData).catch(() => {});
    try {
      const res = await apiService.importSiswaBatch(newSiswaBatch);
      if (res) setSiswaList(res);
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to import siswa batch in database:', err);
    }
  };

  // Jadwal CRUD
  const handleSaveJadwal = async (j: JadwalMengajar) => {
    const exists = jadwalList.some(item => item.id === j.id);
    const updatedLocally = exists
      ? jadwalList.map(item => (item.id === j.id ? j : item))
      : [...jadwalList, j];
    setJadwalList(updatedLocally);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: siswaList,
      jadwal: updatedLocally,
      agenda: agendaList,
      penilaianExtra: penilaianExtraList,
      updatedAt: new Date().toISOString(),
    };
    firestoreService.savePersistentAppData(currentData).catch(() => {});

    try {
      const res = await apiService.saveJadwal(j);
      if (res) setJadwalList(res);
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to save jadwal in database:', err);
    }
  };

  const handleDeleteJadwal = async (id: string) => {
    const updated = jadwalList.filter(j => j.id !== id);
    setJadwalList(updated);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: siswaList,
      jadwal: updated,
      agenda: agendaList,
      penilaianExtra: penilaianExtraList,
      updatedAt: new Date().toISOString(),
    };
    firestoreService.savePersistentAppData(currentData).catch(() => {});

    try {
      const res = await apiService.deleteJadwal(id);
      if (res) setJadwalList(res);
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to delete jadwal in database:', err);
    }
  };

  // Agenda Save, Edit & Delete (Database Auto-Save)
  const handleOpenAgendaWithJadwal = (j: JadwalMengajar) => {
    setEditingAgenda(null);
    setPresetJadwalForAgenda(j);
    setIsAgendaModalOpen(true);
  };

  const handleOpenAgendaModal = () => {
    // Determine the active schedule right now based on day & time (not random)
    const activeJadwal = findActiveSchedule(jadwalList);
    setEditingAgenda(null);
    setPresetJadwalForAgenda(activeJadwal);
    setIsAgendaModalOpen(true);
  };

  const handleEditAgenda = (agenda: AgendaMengajar) => {
    setEditingAgenda(agenda);
    const matchedJadwal =
      jadwalList.find(j => j.id === agenda.jadwalId) ||
      jadwalList.find(j => j.kelasId === agenda.kelasId) ||
      null;
    setPresetJadwalForAgenda(matchedJadwal);
    setIsAgendaModalOpen(true);
  };

  // Backup Notification State
  const [backupNotification, setBackupNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Auto hide backup notification
  useEffect(() => {
    if (backupNotification) {
      const timer = setTimeout(() => setBackupNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [backupNotification]);

  const handleSaveAgenda = async (ag: AgendaMengajar) => {
    // If agenda has 1 word or generative code, auto enrich with continuous curriculum
    let preparedAgenda = { ...ag };
    const words = (preparedAgenda.materi || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1 || isGenerativeCode(preparedAgenda.materi)) {
      const k = kelasList.find(kItem => kItem.id === preparedAgenda.kelasId);
      const tingkat = k?.tingkat || (preparedAgenda.kelasId.includes('xii') ? 'XII' : 'XI');
      const enriched = generateCurriculumAgenda(tingkat, preparedAgenda.pertemuanKe || 1, preparedAgenda.mapel || 'Pemrograman Web');
      preparedAgenda = {
        ...preparedAgenda,
        materi: enriched.materi,
        capaianPembelajaran: preparedAgenda.capaianPembelajaran && preparedAgenda.capaianPembelajaran.length > 10 ? preparedAgenda.capaianPembelajaran : enriched.capaianPembelajaran,
        indikator: preparedAgenda.indikator && preparedAgenda.indikator.length > 5 ? preparedAgenda.indikator : enriched.indikator,
        catatanKejadian: preparedAgenda.catatanKejadian && preparedAgenda.catatanKejadian.length > 5 ? preparedAgenda.catatanKejadian : enriched.catatanKejadian,
        refleksiGuru: preparedAgenda.refleksiGuru && preparedAgenda.refleksiGuru.length > 5 ? preparedAgenda.refleksiGuru : enriched.refleksiGuru,
        tindakLanjut: preparedAgenda.tindakLanjut && preparedAgenda.tindakLanjut.length > 5 ? preparedAgenda.tindakLanjut : enriched.tindakLanjut,
      };
    }

    const exists = agendaList.some(item => item.id === preparedAgenda.id);
    const updatedLocally = exists
      ? agendaList.map(item => (item.id === preparedAgenda.id ? preparedAgenda : item))
      : [preparedAgenda, ...agendaList];
    setAgendaList(updatedLocally);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: siswaList,
      jadwal: jadwalList,
      agenda: updatedLocally,
      penilaianExtra: penilaianExtraList,
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediately save to Cloud Firestore (both individual doc and primary container) & LocalStorage
    firestoreService.saveIndividualAgenda(preparedAgenda).catch(() => {});
    firestoreService.savePersistentAppData(currentData).catch(err => {
      console.warn('Direct Firestore save failed, fallbacking:', err);
    });
    apiService.saveAgenda(preparedAgenda).catch(() => {});
    apiService.saveAllData(currentData).catch(() => {});

    try {
      const result = await backupService.saveAgendaWithBackup(preparedAgenda, currentData);
      if (result.cloudflareSuccess) {
        if (!result.googleSuccess) {
          setBackupNotification({
            type: 'warning',
            message: 'Agenda tersimpan aman di Database. Backup Google Workspace terkendala (periksa akun Google).',
          });
        } else {
          setBackupNotification({
            type: 'success',
            message: 'Agenda berhasil disimpan di Database & disinkronkan ke Google Workspace!',
          });
        }
      }
    } catch (err: any) {
      console.warn('Backup pipeline warning:', err);
      setBackupNotification({
        type: 'success',
        message: 'Agenda tersimpan di Database Cloud & Lokal.',
      });
    }
  };

  const handleDeleteAgenda = async (id: string) => {
    const updated = agendaList.filter(ag => ag.id !== id);
    setAgendaList(updated);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: siswaList,
      jadwal: jadwalList,
      agenda: updated,
      penilaianExtra: penilaianExtraList,
      updatedAt: new Date().toISOString(),
    };

    firestoreService.deleteIndividualAgenda(id).catch(() => {});
    firestoreService.savePersistentAppData(currentData).catch(() => {});
    try {
      const res = await apiService.deleteAgenda(id);
      if (res) setAgendaList(res);
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to delete agenda in database:', err);
    }
  };

  // Penilaian Extra CRUD
  const handleSavePenilaianExtra = async (p: PenilaianSession) => {
    const exists = penilaianExtraList.some(item => item.id === p.id);
    const updatedLocally = exists
      ? penilaianExtraList.map(item => (item.id === p.id ? p : item))
      : [p, ...penilaianExtraList];
    setPenilaianExtraList(updatedLocally);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: siswaList,
      jadwal: jadwalList,
      agenda: agendaList,
      penilaianExtra: updatedLocally,
      updatedAt: new Date().toISOString(),
    };

    firestoreService.savePersistentAppData(currentData).catch(() => {});
    apiService.savePenilaianExtra(p).catch(() => {});
    apiService.saveAllData(currentData).catch(() => {});

    try {
      const result = await backupService.savePenilaianWithBackup(p, currentData);
      if (result.cloudflareSuccess) {
        if (!result.googleSuccess) {
          setBackupNotification({
            type: 'warning',
            message: 'Penilaian tersimpan di Database. Backup Google Workspace terkendala.',
          });
        } else {
          setBackupNotification({
            type: 'success',
            message: 'Penilaian tersimpan di Database & Google Sheets!',
          });
        }
      }
    } catch (err: any) {
      console.warn('Backup exception:', err);
      setBackupNotification({
        type: 'success',
        message: 'Penilaian tersimpan di Database.',
      });
    }
  };

  const handleDeletePenilaianExtra = async (id: string) => {
    const updated = penilaianExtraList.filter(p => p.id !== id);
    setPenilaianExtraList(updated);

    const currentData = {
      profile,
      kelas: kelasList,
      siswa: siswaList,
      jadwal: jadwalList,
      agenda: agendaList,
      penilaianExtra: updated,
      updatedAt: new Date().toISOString(),
    };

    firestoreService.savePersistentAppData(currentData).catch(() => {});
    try {
      const res = await apiService.deletePenilaianExtra(id);
      if (res) setPenilaianExtraList(res);
      apiService.saveAllData(currentData).catch(() => {});
    } catch (err) {
      console.error('Failed to delete penilaian extra in database:', err);
    }
  };

  // Reset Database Data
  const handleResetData = async () => {
    try {
      setIsLoading(true);
      const fullDb = await apiService.resetData();
      if (fullDb) {
        setProfile(fullDb.profile);
        setKelasList(fullDb.kelas);
        setSiswaList(fullDb.siswa);
        setJadwalList(fullDb.jadwal);
        setAgendaList(fullDb.agenda);
        setPenilaianExtraList(fullDb.penilaianExtra);
      }
    } catch (err) {
      console.error('Failed to reset data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Tab Switching
  const handleTabSelect = (tab: ActiveTab) => {
    if (tab === 'pengaturan') {
      setIsSettingsModalOpen(true);
    } else if (tab === 'agenda') {
      setActiveTab('laporan');
    } else {
      setActiveTab(tab);
    }
  };

  // Initial Database Loading Screen
  if (isLoading && !profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="flex flex-col items-center text-center space-y-4 max-w-sm bg-slate-800/80 p-8 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Memuat Database Server...</h2>
            <p className="text-xs text-slate-400 mt-1">
              Menghubungkan ke REST API Database sebagai sumber data utama.
            </p>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-700 font-sans antialiased flex flex-col">
      {/* PIN Security Modal overlay if locked */}
      {isLocked && (
        <PinLockModal currentPin={profile.pin} onUnlockSuccess={handleUnlockSuccess} />
      )}

      {/* Database Error Banner if endpoint disconnected */}
      {fetchError && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Koneksi Database Terputus: {fetchError}</span>
          </div>
          <button
            onClick={loadDataFromDatabase}
            className="px-2.5 py-1 bg-white text-rose-700 rounded-lg text-[11px] font-bold hover:bg-rose-50 cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Coba Lagi</span>
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-screen">
        {/* SIDEBAR */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabSelect}
          isOpenMobile={isOpenMobileSidebar}
          setIsOpenMobile={setIsOpenMobileSidebar}
          isCollapsed={isCollapsedSidebar}
          setIsCollapsed={setIsCollapsedSidebar}
          profile={profile}
          onLockClick={handleLockClick}
          onOpenAgendaModal={handleOpenAgendaModal}
        />

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* NAVBAR */}
          <Navbar
            profile={profile}
            onLockClick={handleLockClick}
            onOpenMobileSidebar={() => setIsOpenMobileSidebar(true)}
            isSidebarCollapsed={isCollapsedSidebar}
            onToggleSidebar={handleToggleSidebar}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          {/* TAB VIEW CONTENT CONTAINER */}
          <div className="px-4 md:px-8 pb-12 flex-1">
            {activeTab === 'dashboard' && (
              <DashboardView
                profile={profile}
                kelasList={kelasList}
                siswaList={siswaList}
                jadwalList={jadwalList}
                agendaList={agendaList}
                penilaianExtraList={penilaianExtraList}
                setActiveTab={handleTabSelect}
                onOpenAgendaWithJadwal={handleOpenAgendaWithJadwal}
                onOpenAgendaModal={handleOpenAgendaModal}
                onEditAgenda={handleEditAgenda}
                onSaveProfile={handleSaveProfile}
              />
            )}

            {activeTab === 'jadwal' && (
              <JadwalView
                jadwalList={jadwalList}
                kelasList={kelasList}
                onSaveJadwal={handleSaveJadwal}
                onDeleteJadwal={handleDeleteJadwal}
                onOpenAgendaWithJadwal={handleOpenAgendaWithJadwal}
              />
            )}

            {activeTab === 'kelas_siswa' && (
              <KelasSiswaView
                kelasList={kelasList}
                siswaList={siswaList}
                onSaveKelas={handleSaveKelas}
                onDeleteKelas={handleDeleteKelas}
                onSaveSiswa={handleSaveSiswa}
                onDeleteSiswa={handleDeleteSiswa}
                onImportSiswaBatch={handleImportSiswaBatch}
              />
            )}

            {activeTab === 'rekap_presensi' && (
              <RekapPresensiView
                profile={profile}
                kelasList={kelasList}
                siswaList={siswaList}
                agendaList={agendaList}
                onEditAgenda={handleEditAgenda}
                onOpenAgendaDetail={(agenda) => {
                  handleEditAgenda(agenda);
                }}
              />
            )}

            {activeTab === 'penilaian' && (
              <InputNilaiView
                profile={profile}
                kelasList={kelasList}
                siswaList={siswaList}
                agendaList={agendaList}
                penilaianExtraList={penilaianExtraList}
                onSavePenilaianExtra={handleSavePenilaianExtra}
                onDeletePenilaianExtra={handleDeletePenilaianExtra}
                onSaveAgenda={handleSaveAgenda}
                onNavigateToPresensi={() => setActiveTab('rekap_presensi')}
              />
            )}

            {(activeTab === 'laporan' || activeTab === 'agenda') && (
              <HistoryLaporanView
                profile={profile}
                kelasList={kelasList}
                siswaList={siswaList}
                agendaList={agendaList}
                penilaianList={[
                  ...agendaList.filter(a => a.adaPenilaian && a.penilaian).map(a => a.penilaian!),
                  ...penilaianExtraList,
                ]}
                onDeleteAgenda={handleDeleteAgenda}
                onEditAgenda={handleEditAgenda}
                onNavigateToPresensi={() => setActiveTab('rekap_presensi')}
                onOpenAgendaModal={handleOpenAgendaModal}
              />
            )}

            {activeTab === 'backup' && (
              <BackupDashboardView
                appData={{
                  profile,
                  kelas: kelasList,
                  siswa: siswaList,
                  jadwal: jadwalList,
                  agenda: agendaList,
                  penilaianExtra: penilaianExtraList,
                }}
                onRefreshData={loadDataFromDatabase}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Backup Notification Toast */}
      {backupNotification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-3 transition-all animate-bounce ${
            backupNotification.type === 'warning'
              ? 'bg-amber-900 text-amber-100 border-amber-700'
              : backupNotification.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-700'
              : 'bg-emerald-900 text-emerald-100 border-emerald-700'
          }`}
        >
          {backupNotification.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : backupNotification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{backupNotification.message}</span>
        </div>
      )}

      {/* Main Agenda Flow Step Wizard Modal */}
      <AgendaFlowModal
        isOpen={isAgendaModalOpen}
        onClose={() => {
          setIsAgendaModalOpen(false);
          setEditingAgenda(null);
        }}
        presetJadwal={presetJadwalForAgenda}
        editingAgenda={editingAgenda}
        jadwalList={jadwalList}
        kelasList={kelasList}
        siswaList={siswaList}
        agendaList={agendaList}
        onSaveAgenda={handleSaveAgenda}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        appData={{
          profile,
          kelas: kelasList,
          siswa: siswaList,
          jadwal: jadwalList,
          agenda: agendaList,
          penilaianExtra: penilaianExtraList,
        }}
        onResetData={handleResetData}
      />
    </div>
  );
}
