import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit2,
  Award,
  Check,
  X,
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Upload,
  Download,
  Share2,
  FileSpreadsheet,
  CheckSquare,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  CalendarCheck,
  Eye,
  EyeOff,
  ClipboardList,
  Camera,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Copy,
} from 'lucide-react';
import {
  Kelas,
  Siswa,
  AgendaMengajar,
  PenilaianSession,
  NilaiSiswa,
  TeacherProfile,
  GradeHuruf,
} from '../types';
import {
  GRADE_HURUF_LIST,
  numberToGradeHuruf,
  gradeHurufToNumber,
  normalizeGradeHuruf,
  getGradeBadgeStyle,
  getGradePredikat,
} from '../utils/gradeUtils';
import { initialProfile } from '../data/initialData';
import { ConfirmModal } from './ConfirmModal';
import { ImportNilaiModal } from './ImportNilaiModal';
import { ShareableNilaiModal } from './ShareableNilaiModal';
import { ScreenshotPreviewModal } from './ScreenshotPreviewModal';
import {
  captureElementToCanvas,
  downloadCanvasAsPng,
  copyCanvasToClipboard,
} from '../utils/screenshotUtils';

export interface PenilaianItem extends PenilaianSession {
  isFromAgenda?: boolean;
  agendaId?: string;
  pertemuanKe?: number;
}

interface InputNilaiViewProps {
  profile?: TeacherProfile;
  kelasList: Kelas[];
  siswaList: Siswa[];
  agendaList?: AgendaMengajar[];
  penilaianExtraList: PenilaianSession[];
  onSavePenilaianExtra: (session: PenilaianSession) => void;
  onDeletePenilaianExtra: (id: string) => void;
  onSaveAgenda?: (agenda: AgendaMengajar) => void;
  onNavigateToPresensi?: () => void;
}

export const InputNilaiView: React.FC<InputNilaiViewProps> = ({
  profile = initialProfile,
  kelasList,
  siswaList,
  agendaList = [],
  penilaianExtraList,
  onSavePenilaianExtra,
  onDeletePenilaianExtra,
  onSaveAgenda,
  onNavigateToPresensi,
}) => {
  const [selectedKelasId, setSelectedKelasId] = useState<string>(() => {
    const classWithData = kelasList.find(
      k =>
        (penilaianExtraList || []).some(p => p.kelasId === k.id) ||
        (agendaList || []).some(
          a => a.adaPenilaian && (a.kelasId === k.id || a.penilaian?.kelasId === k.id)
        ) ||
        (siswaList || []).some(s => s.kelasId === k.id)
    );
    return classWithData?.id || kelasList[0]?.id || '';
  });

  // Keep selectedKelasId valid if kelasList changes
  useEffect(() => {
    if (kelasList.length > 0 && !kelasList.some(k => k.id === selectedKelasId)) {
      const classWithData = kelasList.find(
        k =>
          (penilaianExtraList || []).some(p => p.kelasId === k.id) ||
          (agendaList || []).some(
            a => a.adaPenilaian && (a.kelasId === k.id || a.penilaian?.kelasId === k.id)
          ) ||
          (siswaList || []).some(s => s.kelasId === k.id)
      );
      setSelectedKelasId(classWithData?.id || kelasList[0].id);
    }
  }, [kelasList, selectedKelasId, penilaianExtraList, agendaList, siswaList]);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSession, setEditingSession] = useState<PenilaianItem | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Import & Share Modals State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareTargetSessionId, setShareTargetSessionId] = useState<string>('ALL');
  const [showTaskCards, setShowTaskCards] = useState<boolean>(false);

  // Screenshot Matrix State
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState<boolean>(false);
  const [isScreenshotMenuOpen, setIsScreenshotMenuOpen] = useState<boolean>(false);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [screenshotToast, setScreenshotToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  // Close screenshot dropdown when clicked outside
  useEffect(() => {
    if (!isScreenshotMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.screenshot-menu-container')) {
        setIsScreenshotMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isScreenshotMenuOpen]);

  // Clear toast automatically
  useEffect(() => {
    if (!screenshotToast) return;
    const timer = setTimeout(() => {
      setScreenshotToast(null);
    }, 3800);
    return () => clearTimeout(timer);
  }, [screenshotToast]);

  // Modal Form State
  const [mapel, setMapel] = useState<string>('Pemrograman Web');
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().substring(0, 10));
  const [jenisPenilaian, setJenisPenilaian] = useState<
    'Formatif' | 'Sumatif' | 'Tugas' | 'UH' | 'UTS' | 'UAS' | 'Ceklis'
  >('Tugas');
  const [skalaPenilaian, setSkalaPenilaian] = useState<'angka' | 'huruf' | 'ceklis'>('angka');
  const [namaPenilaian, setNamaPenilaian] = useState<string>('');
  const [kkm, setKkm] = useState<number>(75);
  const [nilaiMap, setNilaiMap] = useState<Record<string, number>>({});
  const [statusMap, setStatusMap] = useState<Record<string, 'Sudah' | 'Belum'>>({});
  const [gradeHurufMap, setGradeHurufMap] = useState<Record<string, GradeHuruf>>({});

  const activeKelas = kelasList.find(k => k.id === selectedKelasId) || kelasList[0];
  const activeSiswa = siswaList.filter(s => s.kelasId === selectedKelasId);

  // Helper: check if session is checklist
  const isSessionChecklist = (sess: PenilaianSession) => {
    if (sess.skalaPenilaian === 'ceklis' || sess.jenisPenilaian === 'Ceklis') return true;
    if (sess.skalaPenilaian === 'angka' || sess.skalaPenilaian === 'huruf') return false;
    const hasNumeric = sess.daftarNilai.some(n => typeof n.nilai === 'number' && n.nilai > 0);
    const hasLetter = sess.daftarNilai.some(n => Boolean(n.gradeHuruf));
    if (hasNumeric || hasLetter) return false;
    return sess.daftarNilai.some(n => n.statusTugas !== undefined);
  };

  // Helper: check if session is letter-based
  const isSessionHuruf = (sess: PenilaianSession) => {
    if (sess.skalaPenilaian === 'huruf') return true;
    if (sess.skalaPenilaian === 'angka' || sess.skalaPenilaian === 'ceklis') return false;
    return sess.daftarNilai.some(n => Boolean(n.gradeHuruf));
  };

  // 1. All combined sessions across all classes
  const allSessions: PenilaianItem[] = useMemo(() => {
    const list: PenilaianItem[] = [];
    const seenIds = new Set<string>();

    // Extra / standalone sessions
    (penilaianExtraList || []).forEach(p => {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        const resolvedSkala: 'angka' | 'huruf' | 'ceklis' =
          p.skalaPenilaian ||
          (isSessionChecklist(p) ? 'ceklis' : isSessionHuruf(p) ? 'huruf' : 'angka');
        list.push({
          ...p,
          skalaPenilaian: resolvedSkala,
          isFromAgenda: Boolean(p.agendaId),
        });
      }
    });

    // Sessions from Agenda Mengajar
    (agendaList || [])
      .filter(ag => ag.adaPenilaian && ag.penilaian)
      .forEach(ag => {
        const p = ag.penilaian!;
        const sessId = p.id || `pen-ag-${ag.id}`;
        const alreadyExists = list.some(
          existing => existing.id === sessId || (existing.agendaId && existing.agendaId === ag.id)
        );
        if (!alreadyExists && !seenIds.has(sessId)) {
          seenIds.add(sessId);
          const resolvedSkala: 'angka' | 'huruf' | 'ceklis' =
            p.skalaPenilaian ||
            (p.jenisPenilaian === 'Ceklis'
              ? 'ceklis'
              : isSessionHuruf(p)
              ? 'huruf'
              : 'angka');
          list.push({
            ...p,
            id: sessId,
            agendaId: ag.id,
            kelasId: p.kelasId || ag.kelasId,
            mapel: p.mapel || ag.mapel,
            tanggal: p.tanggal || ag.tanggal,
            jenisPenilaian: p.jenisPenilaian || 'Formatif',
            skalaPenilaian: resolvedSkala,
            namaPenilaian: p.namaPenilaian || `Penilaian Pertemuan ${ag.pertemuanKe}`,
            isFromAgenda: true,
            pertemuanKe: ag.pertemuanKe,
          });
        }
      });

    return list;
  }, [agendaList, penilaianExtraList]);

  // 2. Filter sessions for the currently selected class
  const sessionsInKelas: PenilaianItem[] = useMemo(() => {
    return allSessions
      .filter(p => p.kelasId === selectedKelasId)
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [allSessions, selectedKelasId]);

  // Count numeric vs checklist sessions
  const numericSessions = sessionsInKelas.filter(s => !isSessionChecklist(s));
  const checklistSessions = sessionsInKelas.filter(s => isSessionChecklist(s));

  const handleOpenModal = (p?: PenilaianItem) => {
    if (p) {
      const isChecklist = isSessionChecklist(p);
      const isHuruf = p.skalaPenilaian === 'huruf' || (!isChecklist && p.daftarNilai.some(n => Boolean(n.gradeHuruf)));
      setEditingSession(p);
      setMapel(p.mapel);
      setTanggal(p.tanggal);
      setJenisPenilaian(p.jenisPenilaian);
      setSkalaPenilaian(isChecklist ? 'ceklis' : isHuruf ? 'huruf' : 'angka');
      setNamaPenilaian(p.namaPenilaian);
      setKkm(p.kkm || 75);

      const nMap: Record<string, number> = {};
      const sMap: Record<string, 'Sudah' | 'Belum'> = {};
      const gMap: Record<string, GradeHuruf> = {};

      p.daftarNilai.forEach(n => {
        nMap[n.siswaId] = n.nilai;
        sMap[n.siswaId] = n.statusTugas || (n.nilai > 0 ? 'Sudah' : 'Belum');
        gMap[n.siswaId] = normalizeGradeHuruf(n.gradeHuruf) || numberToGradeHuruf(n.nilai);
      });

      setNilaiMap(nMap);
      setStatusMap(sMap);
      setGradeHurufMap(gMap);
    } else {
      setEditingSession(null);
      setMapel(profile.mapelUtama || 'Pemrograman Web');
      setTanggal(new Date().toISOString().substring(0, 10));
      setJenisPenilaian('Tugas');
      setSkalaPenilaian('angka');
      setNamaPenilaian('');
      setKkm(75);

      const nMap: Record<string, number> = {};
      const sMap: Record<string, 'Sudah' | 'Belum'> = {};
      const gMap: Record<string, GradeHuruf> = {};

      activeSiswa.forEach(s => {
        nMap[s.id] = 80;
        sMap[s.id] = 'Sudah';
        gMap[s.id] = 'B+';
      });

      setNilaiMap(nMap);
      setStatusMap(sMap);
      setGradeHurufMap(gMap);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPenilaian || !selectedKelasId) return;

    const isChecklist = skalaPenilaian === 'ceklis';
    const isHuruf = skalaPenilaian === 'huruf';

    const daftarNilai: NilaiSiswa[] = activeSiswa.map(s => {
      if (isChecklist) {
        const isDone = (statusMap[s.id] || 'Sudah') === 'Sudah';
        return {
          siswaId: s.id,
          nilai: isDone ? 100 : 0,
          statusTugas: isDone ? 'Sudah' : 'Belum',
        };
      } else if (isHuruf) {
        const grade = gradeHurufMap[s.id] || 'B+';
        const numScore = gradeHurufToNumber(grade);
        return {
          siswaId: s.id,
          nilai: numScore,
          gradeHuruf: grade,
          statusTugas: undefined,
        };
      } else {
        const score = nilaiMap[s.id] ?? 80;
        return {
          siswaId: s.id,
          nilai: score,
          gradeHuruf: numberToGradeHuruf(score),
          statusTugas: undefined,
        };
      }
    });

    const session: PenilaianSession = {
      id: editingSession ? editingSession.id : `pen-ex-${Date.now()}`,
      agendaId: editingSession?.agendaId,
      kelasId: selectedKelasId,
      mapel,
      tanggal,
      jenisPenilaian: isChecklist ? 'Ceklis' : jenisPenilaian,
      skalaPenilaian,
      namaPenilaian,
      kkm: isChecklist ? 100 : isHuruf ? 75 : kkm,
      daftarNilai,
    };

    if (editingSession?.isFromAgenda && editingSession.agendaId) {
      const targetAgenda = agendaList.find(a => a.id === editingSession.agendaId);
      if (targetAgenda && onSaveAgenda) {
        onSaveAgenda({
          ...targetAgenda,
          adaPenilaian: true,
          penilaian: session,
        });
      } else {
        onSavePenilaianExtra(session);
      }
    } else {
      onSavePenilaianExtra(session);
    }

    setIsModalOpen(false);
  };

  const handleOpenShareModal = (sessionId?: string) => {
    setShareTargetSessionId(sessionId || 'ALL');
    setIsShareModalOpen(true);
  };

  // Toggle checklist status directly from table
  const handleToggleChecklist = (sessionId: string, siswaId: string) => {
    const targetSession = sessionsInKelas.find(s => s.id === sessionId);
    if (!targetSession) return;

    const updatedDaftarNilai = targetSession.daftarNilai.map(n => {
      if (n.siswaId === siswaId) {
        const isCurrentDone = n.statusTugas === 'Sudah' || (!n.statusTugas && n.nilai > 0);
        return {
          ...n,
          statusTugas: (isCurrentDone ? 'Belum' : 'Sudah') as 'Sudah' | 'Belum',
          nilai: isCurrentDone ? 0 : 100,
        };
      }
      return n;
    });

    const updatedSession: PenilaianItem = {
      ...targetSession,
      daftarNilai: updatedDaftarNilai,
    };

    if (updatedSession.isFromAgenda && updatedSession.agendaId) {
      const targetAgenda = agendaList.find(a => a.id === updatedSession.agendaId);
      if (targetAgenda && onSaveAgenda) {
        onSaveAgenda({
          ...targetAgenda,
          adaPenilaian: true,
          penilaian: updatedSession,
        });
      } else {
        onSavePenilaianExtra(updatedSession);
      }
    } else {
      onSavePenilaianExtra(updatedSession);
    }
  };

  // Matrix Excel Export with each task/assignment title and checklist state
  const handleExportMatrixExcel = () => {
    if (!activeKelas) return;

    const rows = activeSiswa.map((s, idx) => {
      const rowData: Record<string, any> = {
        No: idx + 1,
        NIS: s.nis || '',
        NISN: s.nisn || '',
        'Nama Siswa': s.nama,
        'Jenis Kelamin': s.jenisKelamin,
      };

      let numericTotal = 0;
      let numericCount = 0;
      let tugasSelesai = 0;
      const totalTugas = sessionsInKelas.length;

      sessionsInKelas.forEach(sess => {
        const isChecklist = isSessionChecklist(sess);
        const isHuruf = isSessionHuruf(sess);
        const gradeItem = sess.daftarNilai.find(n => n.siswaId === s.id);

        if (isChecklist) {
          const isDone =
            gradeItem?.statusTugas === 'Sudah' ||
            (!gradeItem?.statusTugas && typeof gradeItem?.nilai === 'number' && gradeItem.nilai > 0);
          if (isDone) tugasSelesai++;
          rowData[`${sess.namaPenilaian} (Ceklis)`] = isDone ? 'Sudah' : 'Belum';
        } else if (isHuruf) {
          const letter = gradeItem?.gradeHuruf;
          const isDone =
            Boolean(letter) &&
            letter !== '-' &&
            gradeItem?.statusTugas !== 'Belum' &&
            !gradeItem?.catatan?.includes('Belum');
          if (isDone) {
            tugasSelesai++;
            numericTotal += gradeItem?.nilai || 75;
            numericCount++;
          }
          rowData[`${sess.namaPenilaian} (Huruf)`] = letter || '-';
        } else {
          const isDone =
            gradeItem &&
            gradeItem.statusTugas !== 'Belum' &&
            !gradeItem.catatan?.includes('Belum') &&
            (gradeItem.nilai > 0 || gradeItem.catatan === 'Nilai 0');
          const score = gradeItem ? gradeItem.nilai : 0;
          if (isDone) {
            tugasSelesai++;
            numericTotal += score;
            numericCount++;
          }
          rowData[`${sess.namaPenilaian} (KKM ${sess.kkm})`] = isDone ? score : 'Belum';
        }
      });

      if (numericCount > 0) {
        const avg = Math.round(numericTotal / numericCount);
        rowData['Rata-Rata Nilai'] = avg;
        rowData['Predikat'] = avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 75 ? 'C' : 'D';
        rowData['Status Ketuntasan'] = avg >= 75 && tugasSelesai === totalTugas ? 'TUNTAS' : 'BELUM TUNTAS';
      }

      rowData['Tugas Ceklis (Kelengkapan)'] = `${tugasSelesai}/${totalTugas} Tugas Selesai`;

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Matriks_Nilai');

    const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Matriks_Nilai_Lengkap_${safeKelas}.xlsx`);
  };

  // Matrix Screenshot Handler (Download PNG / Copy to Clipboard / Preview)
  const handleCaptureMatrix = async (mode: 'download' | 'copy' | 'preview') => {
    if (!matrixContainerRef.current || !activeKelas) return;
    setIsScreenshotMenuOpen(false);
    setIsCapturingScreenshot(true);

    try {
      const cleanClassName = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
      const todayStr = new Date().toISOString().split('T')[0];
      const defaultFileName = `Matriks_Rekap_Nilai_${cleanClassName}_${todayStr}.png`;

      const canvas = await captureElementToCanvas(matrixContainerRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      if (mode === 'preview') {
        setPreviewCanvas(canvas);
        setIsPreviewModalOpen(true);
      } else if (mode === 'download') {
        downloadCanvasAsPng(canvas, defaultFileName);
        setScreenshotToast({
          message: '✓ File screenshot berhasil diunduh sebagai gambar PNG jernih!',
          type: 'success',
        });
      } else if (mode === 'copy') {
        const ok = await copyCanvasToClipboard(canvas);
        if (ok) {
          setScreenshotToast({
            message: '✓ Screenshot berhasil disalin ke clipboard! Silakan paste (Ctrl+V) di WhatsApp Web.',
            type: 'success',
          });
        } else {
          // If browser restricts clipboard write (e.g. iframe policy), fallback to download
          downloadCanvasAsPng(canvas, defaultFileName);
          setScreenshotToast({
            message: '✓ Screenshot diunduh sebagai file PNG (karena clipboard browser dibatasi).',
            type: 'info',
          });
        }
      }
    } catch (err) {
      console.error('Error capturing matrix screenshot:', err);
      setScreenshotToast({
        message: 'Gagal mengambil screenshot matriks. Silakan coba kembali.',
        type: 'error',
      });
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const targetDeletingSession = allSessions.find(s => s.id === deletingSessionId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            <span>Rekap Nilai Siswa</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dukung penilaian angka (0-100) dan ceklis penugasan (Sudah/Belum), dilengkapi ekspor & laporan siap bagikan.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToPresensi && (
            <button
              onClick={onNavigateToPresensi}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Buka Matriks Rekap Presensi Kehadiran Siswa"
            >
              <CalendarCheck className="w-4 h-4 text-indigo-600" />
              <span>Matriks Presensi</span>
            </button>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Impor Nilai atau Ceklis Tugas dari File Excel"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Impor Nilai Excel</span>
          </button>

          <button
            onClick={() => handleOpenShareModal('ALL')}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Buka Pusat Berbagi Nilai (Slip Siswa, WA, & Print PDF)"
          >
            <Share2 className="w-4 h-4" />
            <span>Bagikan Nilai ke Siswa</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Penilaian / Tugas</span>
          </button>
        </div>
      </div>

      {/* Class Selector Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {kelasList.map(k => {
          const isSelected = k.id === selectedKelasId;
          const count = allSessions.filter(s => s.kelasId === k.id).length;
          return (
            <button
              key={k.id}
              onClick={() => setSelectedKelasId(k.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
              }`}
            >
              <span>{k.namaKelas}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count} sesi
              </span>
            </button>
          );
        })}
      </div>

      {/* Top Relocated Management Toolbar & Collapsible Task Drawer */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  Daftar Tugas & Penilaian ({sessionsInKelas.length} Komponen)
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {activeKelas?.namaKelas}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {numericSessions.length} Format Angka • {sessionsInKelas.filter(s => isSessionHuruf(s)).length} Format Huruf • {checklistSessions.length} Ceklis Tugas
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTaskCards(!showTaskCards)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                showTaskCards
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {showTaskCards ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Sembunyikan Kartu Tugas</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Kelola Kartu Tugas ({sessionsInKelas.length})</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Impor Nilai</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>+ Tugas Baru</span>
            </button>
          </div>
        </div>

        {/* Collapsible Cards Drawer: Displayed in horizontal responsive grid */}
        {showTaskCards && (
          <div className="pt-4 border-t border-slate-100">
            {sessionsInKelas.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Belum ada data tugas / penilaian di kelas ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 animate-in fade-in duration-200">
                {sessionsInKelas.map(session => {
                  const isChecklist = isSessionChecklist(session);
                  const isHuruf = isSessionHuruf(session);
                  const validScores = session.daftarNilai.map(n => n.nilai);
                  const avgScore =
                    validScores.length > 0
                      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                      : 0;

                  const sudahCount = session.daftarNilai.filter(
                    n => n.statusTugas === 'Sudah' || (!n.statusTugas && n.nilai > 0)
                  ).length;
                  const totalSiswaSesi = session.daftarNilai.length;
                  const belumCount = totalSiswaSesi - sudahCount;

                  return (
                    <div
                      key={session.id}
                      className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:bg-white shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          {isChecklist ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <CheckSquare className="w-2.5 h-2.5 text-amber-700" />
                              <span>Ceklis</span>
                            </span>
                          ) : isHuruf ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                              <Award className="w-2.5 h-2.5 text-teal-700" />
                              <span>Huruf</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                              <span>KKM {session.kkm}</span>
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-slate-400">{session.tanggal}</span>
                        </div>

                        <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">
                          {session.namaPenilaian}
                        </h4>
                        <p className="text-[11px] text-indigo-600 font-semibold mt-0.5 truncate">
                          {session.mapel}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
                          {isChecklist ? (
                            <>
                              <span>Sudah: <strong className="text-emerald-700">{sudahCount}</strong></span>
                              <span>Belum: <strong className="text-rose-600">{belumCount}</strong></span>
                            </>
                          ) : isHuruf ? (
                            <>
                              <span>Min: <strong className="text-slate-700">B</strong></span>
                              <span>Rata2: <strong className="text-purple-700 font-bold">{numberToGradeHuruf(avgScore)}</strong></span>
                            </>
                          ) : (
                            <>
                              <span>KKM: <strong className="text-slate-700">{session.kkm}</strong></span>
                              <span>Rata2: <strong className="text-emerald-600 font-bold">{avgScore}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-slate-200/60">
                        <button
                          onClick={() => handleOpenShareModal(session.id)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border border-amber-200/60"
                          title="Bagikan Nilai Sesi Ini"
                        >
                          <Share2 className="w-3 h-3 text-amber-600" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(session)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border border-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingSessionId(session.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          title="Hapus Penilaian"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Width Matrix Rekap Nilai Table (w-full 100%) */}
      <div
        ref={matrixContainerRef}
        id="matriks-rekap-nilai-table"
        className="w-full bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4"
      >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Matriks Rekap Nilai Siswa: {activeKelas?.namaKelas}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Menyertakan seluruh judul tugas & penilaian (angka maupun ceklis sudah/belum mengumpulkan).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Menu Screenshot Matriks */}
              <div className="relative screenshot-menu-container no-screenshot">
                <button
                  onClick={() => setIsScreenshotMenuOpen(prev => !prev)}
                  disabled={isCapturingScreenshot}
                  className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                  title="Ambil tangkapan layar (screenshot) matriks nilai ini sebagai gambar PNG"
                >
                  {isCapturingScreenshot ? (
                    <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-sky-600" />
                  )}
                  <span>{isCapturingScreenshot ? 'Mengambil...' : 'Screenshot'}</span>
                  <ChevronDown className="w-3 h-3 text-sky-600" />
                </button>

                {/* Dropdown Menu Screenshot */}
                {isScreenshotMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Opsi Tangkapan Layar (HD)
                    </div>

                    <button
                      onClick={() => handleCaptureMatrix('copy')}
                      className="w-full px-3.5 py-2.5 text-left text-xs text-slate-700 hover:bg-sky-50/80 hover:text-sky-900 flex items-start gap-2.5 transition-colors cursor-pointer group"
                    >
                      <Copy className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-sky-900 flex items-center gap-1.5">
                          <span>Salin ke WhatsApp</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded">Populer</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Langsung paste (Ctrl+V) di WhatsApp Web / WA Desktop
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleCaptureMatrix('download')}
                      className="w-full px-3.5 py-2.5 text-left text-xs text-slate-700 hover:bg-sky-50/80 hover:text-sky-900 flex items-start gap-2.5 transition-colors cursor-pointer group"
                    >
                      <Download className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-sky-900">
                          Download Gambar PNG
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Simpan file gambar jernih 2x ke komputer / HP
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleCaptureMatrix('preview')}
                      className="w-full px-3.5 py-2.5 text-left text-xs text-slate-700 hover:bg-sky-50/80 hover:text-sky-900 flex items-start gap-2.5 transition-colors cursor-pointer group border-t border-slate-50"
                    >
                      <ImageIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-sky-900">
                          Pratinjau Gambar
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Lihat hasil sebelum dibagikan ke orang tua/grup
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleExportMatrixExcel}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 no-screenshot"
                title="Ekspor Seluruh Nilai Matriks ke File Excel Lengkap"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ekspor Excel</span>
              </button>
              <button
                onClick={() => handleOpenShareModal('ALL')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 no-screenshot"
                title="Tampilan Menarik untuk Siswa (Print / WA)"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Bagikan Rekap</span>
              </button>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 no-screenshot">
                {sessionsInKelas.length} Komponen
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-100">
                  <th className="p-3 pl-4 whitespace-nowrap">No</th>
                  <th className="p-3 whitespace-nowrap min-w-[150px]">Nama Siswa</th>
                  {sessionsInKelas.map(sess => {
                    const isChecklist = isSessionChecklist(sess);
                    const isHuruf = isSessionHuruf(sess);
                    return (
                      <th key={sess.id} className="p-3 text-center whitespace-nowrap min-w-[110px]">
                        <div className="font-bold text-slate-800">
                          {sess.namaPenilaian.length > 20
                            ? `${sess.namaPenilaian.substring(0, 20)}...`
                            : sess.namaPenilaian}
                        </div>
                        <div className="text-[10px] font-normal text-slate-400 flex items-center justify-center gap-1 mt-0.5">
                          {isChecklist ? (
                            <span className="text-amber-600 font-semibold">Ceklis Tugas</span>
                          ) : isHuruf ? (
                            <span className="text-teal-600 font-semibold">Format Huruf</span>
                          ) : (
                            <span>KKM {sess.kkm}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {numericSessions.length > 0 && (
                    <th className="p-3 text-center whitespace-nowrap bg-indigo-50/50 font-bold text-indigo-950">
                      Rata-Rata
                    </th>
                  )}
                  <th className="p-3 text-center whitespace-nowrap font-bold text-slate-800 bg-amber-50/40 min-w-[110px]">
                    <div>Tugas Ceklis</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      Kelengkapan ({sessionsInKelas.length} Tugas)
                    </div>
                  </th>
                  <th className="p-3 text-center pr-4 whitespace-nowrap font-bold text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeSiswa.length === 0 ? (
                  <tr>
                    <td colSpan={5 + sessionsInKelas.length} className="py-8 text-center text-slate-400">
                      Belum ada siswa di kelas ini.
                    </td>
                  </tr>
                ) : (
                  activeSiswa.map((s, idx) => {
                    let numericTotal = 0;
                    let numericCount = 0;
                    let tugasSelesai = 0;
                    const totalTugas = sessionsInKelas.length;

                    sessionsInKelas.forEach(sess => {
                      const isChecklist = isSessionChecklist(sess);
                      const isHuruf = isSessionHuruf(sess);
                      const gradeItem = sess.daftarNilai.find(n => n.siswaId === s.id);

                      if (!gradeItem) return;

                      if (isChecklist) {
                        const isDone =
                          gradeItem.statusTugas === 'Sudah' ||
                          (!gradeItem.statusTugas && typeof gradeItem.nilai === 'number' && gradeItem.nilai > 0);
                        if (isDone) tugasSelesai++;
                      } else if (isHuruf) {
                        const letter = gradeItem.gradeHuruf;
                        const isDone =
                          Boolean(letter) &&
                          letter !== '-' &&
                          gradeItem.statusTugas !== 'Belum' &&
                          !gradeItem.catatan?.includes('Belum');
                        if (isDone) {
                          tugasSelesai++;
                          const score = gradeItem.nilai || 75;
                          numericTotal += score;
                          numericCount++;
                        }
                      } else {
                        const isDone =
                          gradeItem.statusTugas !== 'Belum' &&
                          !gradeItem.catatan?.includes('Belum') &&
                          (gradeItem.nilai > 0 || gradeItem.catatan === 'Nilai 0');
                        if (isDone) {
                          tugasSelesai++;
                          numericTotal += gradeItem.nilai;
                          numericCount++;
                        }
                      }
                    });

                    const avg = numericCount > 0 ? Math.round(numericTotal / numericCount) : 0;
                    const allDone = totalTugas === 0 || tugasSelesai === totalTugas;
                    const isTuntas = (numericCount === 0 || avg >= 75) && allDone;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="p-3 pl-4 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                          <div className="text-xs font-bold text-slate-900">{s.nama}</div>
                          {s.nis && <div className="text-[10px] text-slate-400 font-normal">NIS: {s.nis}</div>}
                        </td>

                        {sessionsInKelas.map(sess => {
                          const isChecklist = isSessionChecklist(sess);
                          const isHuruf = isSessionHuruf(sess);
                          const gradeItem = sess.daftarNilai.find(n => n.siswaId === s.id);

                          return (
                            <td key={sess.id} className="p-3 text-center whitespace-nowrap">
                              {isChecklist ? (
                                (() => {
                                  const isDone =
                                    gradeItem?.statusTugas === 'Sudah' ||
                                    (!gradeItem?.statusTugas && (gradeItem?.nilai ?? 0) > 0);

                                  if (isDone) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleChecklist(sess.id, s.id)}
                                        className="inline-block h-7 leading-7 px-3.5 font-bold text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-700 transition-all cursor-pointer hover:scale-105 whitespace-nowrap text-center"
                                        title="Status: Sudah - Klik untuk ubah ke Belum"
                                      >
                                        Sudah
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleChecklist(sess.id, s.id)}
                                        className="inline-block h-7 leading-7 px-3.5 font-bold text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-700 transition-all cursor-pointer hover:scale-105 whitespace-nowrap text-center"
                                        title="Status: Belum Mengumpulkan - Klik untuk tandai Sudah"
                                      >
                                        Belum
                                      </button>
                                    );
                                  }
                                })()
                              ) : isHuruf ? (
                                (() => {
                                  const isMissingHuruf =
                                    !gradeItem?.gradeHuruf ||
                                    gradeItem.gradeHuruf === '-' ||
                                    gradeItem.statusTugas === 'Belum' ||
                                    gradeItem.catatan?.includes('Belum');

                                  if (isMissingHuruf) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenModal(sess)}
                                        className="inline-block h-7 leading-7 px-3.5 font-bold text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-700 transition-all cursor-pointer hover:scale-105 whitespace-nowrap text-center"
                                        title={`Nilai praktik ${sess.namaPenilaian} untuk ${s.nama} belum ada. Klik untuk input.`}
                                      >
                                        Belum
                                      </button>
                                    );
                                  }
                                  const letter =
                                    normalizeGradeHuruf(gradeItem.gradeHuruf) || gradeItem.gradeHuruf;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenModal(sess)}
                                      className={`inline-block h-7 leading-7 px-3 min-w-[38px] font-black text-xs rounded-xl border shadow-2xs cursor-pointer hover:scale-105 transition-transform text-center ${getGradeBadgeStyle(
                                        letter
                                      )}`}
                                      title={`${letter} (${getGradePredikat(letter)}) - Skor: ${gradeItem?.nilai ?? 0} (Klik untuk edit)`}
                                    >
                                      {letter}
                                    </button>
                                  );
                                })()
                              ) : (
                                (() => {
                                  const isMissingNumeric =
                                    !gradeItem ||
                                    gradeItem.statusTugas === 'Belum' ||
                                    gradeItem.catatan === 'Belum mengumpulkan' ||
                                    gradeItem.catatan === 'Belum ulangan' ||
                                    (gradeItem.nilai === 0 && gradeItem.catatan !== 'Nilai 0');

                                  if (isMissingNumeric) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenModal(sess)}
                                        className="inline-block h-7 leading-7 px-3.5 font-bold text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-700 transition-all cursor-pointer hover:scale-105 whitespace-nowrap text-center"
                                        title={`Nilai ${sess.namaPenilaian} untuk ${s.nama} belum masuk. Klik untuk input.`}
                                      >
                                        Belum
                                      </button>
                                    );
                                  }
                                  const val = gradeItem.nilai;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenModal(sess)}
                                      className={`inline-block h-7 leading-7 px-3 min-w-[44px] font-black text-xs rounded-xl cursor-pointer hover:scale-105 transition-transform text-center ${
                                        val >= sess.kkm
                                          ? 'text-slate-800 bg-slate-50 border border-slate-200'
                                          : 'text-rose-700 bg-rose-50 border border-rose-200'
                                      }`}
                                      title={`Nilai: ${val} (KKM: ${sess.kkm}) - Klik untuk edit`}
                                    >
                                      {val}
                                    </button>
                                  );
                                })()
                              )}
                            </td>
                          );
                        })}

                        {numericSessions.length > 0 && (
                          <td className="p-3 text-center font-black text-indigo-900 text-sm bg-indigo-50/30 whitespace-nowrap">
                            {numericCount > 0 ? (
                              <span className="inline-block h-7 leading-7 px-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 font-black text-xs text-center">
                                {avg} ({numberToGradeHuruf(avg)})
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        )}

                        <td className="p-3 text-center whitespace-nowrap bg-amber-50/20">
                          {tugasSelesai === totalTugas ? (
                            <span
                              className="inline-block h-7 leading-7 px-3 font-extrabold text-xs rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap text-center"
                              title={`Lengkap: Seluruh ${totalTugas} tugas sudah diselesaikan`}
                            >
                              {tugasSelesai}/{totalTugas}
                            </span>
                          ) : tugasSelesai >= Math.ceil(totalTugas * 0.7) ? (
                            <span
                              className="inline-block h-7 leading-7 px-3 font-extrabold text-xs rounded-full bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap text-center"
                              title={`${tugasSelesai} dari ${totalTugas} tugas selesai (${totalTugas - tugasSelesai} belum)`}
                            >
                              {tugasSelesai}/{totalTugas}
                            </span>
                          ) : (
                            <span
                              className="inline-block h-7 leading-7 px-3 font-extrabold text-xs rounded-full bg-rose-600 text-white shadow-xs border border-rose-700 whitespace-nowrap text-center"
                              title={`Perhatian: Baru ${tugasSelesai} dari ${totalTugas} tugas selesai (${totalTugas - tugasSelesai} belum)`}
                            >
                              {tugasSelesai}/{totalTugas}
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-center pr-4 whitespace-nowrap">
                          <span
                            className={`inline-block h-7 leading-7 px-3.5 rounded-full text-xs font-bold whitespace-nowrap text-center ${
                              isTuntas
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isTuntas ? 'Tuntas' : 'Belum Tuntas'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Modal Add / Edit Penilaian */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">
                {editingSession ? 'Edit Sesi Penilaian / Tugas' : 'Tambah Penilaian / Tugas Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Grading Mode Selector: Angka vs Huruf vs Ceklis */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sistem Skala Penilaian:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSkalaPenilaian('angka')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      skalaPenilaian === 'angka'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Calculator className="w-4 h-4" />
                    <span>Nilai Angka (0 - 100)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSkalaPenilaian('huruf')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      skalaPenilaian === 'huruf'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Award className="w-4 h-4 text-purple-600" />
                    <span>Format Huruf (A, B, C...)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSkalaPenilaian('ceklis')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      skalaPenilaian === 'ceklis'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Ceklis Penugasan</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
                  <input
                    type="text"
                    value={mapel}
                    onChange={e => setMapel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Penilaian</label>
                  <select
                    value={jenisPenilaian}
                    onChange={e => setJenisPenilaian(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  >
                    <option value="Tugas">Tugas / PR</option>
                    <option value="Formatif">Formatif</option>
                    <option value="Sumatif">Sumatif</option>
                    <option value="UH">Ulangan Harian (UH)</option>
                    <option value="UTS">UTS / PTS</option>
                    <option value="UAS">UAS / PAS</option>
                    <option value="Ceklis">Ceklis Pengumpulan</option>
                  </select>
                </div>

                <div className={skalaPenilaian === 'angka' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Tugas / Penilaian
                  </label>
                  <input
                    type="text"
                    value={namaPenilaian}
                    onChange={e => setNamaPenilaian(e.target.value)}
                    placeholder="Contoh: Tugas 1 - Portofolio Web"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    required
                  />
                </div>

                {skalaPenilaian === 'angka' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">KKM</label>
                    <input
                      type="number"
                      value={kkm}
                      onChange={e => setKkm(parseInt(e.target.value) || 75)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* Table input score or checklist toggle per student */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    Daftar Siswa ({activeSiswa.length} Siswa):
                  </label>
                  <div className="flex items-center gap-2">
                    {skalaPenilaian === 'ceklis' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const updated: Record<string, 'Sudah' | 'Belum'> = {};
                            activeSiswa.forEach(s => (updated[s.id] = 'Sudah'));
                            setStatusMap(updated);
                          }}
                          className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                        >
                          ✓ Semua Sudah
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated: Record<string, 'Sudah' | 'Belum'> = {};
                            activeSiswa.forEach(s => (updated[s.id] = 'Belum'));
                            setStatusMap(updated);
                          }}
                          className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer"
                        >
                          ✗ Semua Belum
                        </button>
                      </>
                    ) : skalaPenilaian === 'huruf' ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-500 mr-0.5">Set:</span>
                        {(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'] as GradeHuruf[]).map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              const updated: Record<string, GradeHuruf> = {};
                              activeSiswa.forEach(s => (updated[s.id] = g));
                              setGradeHurufMap(updated);
                            }}
                            className="text-[10px] font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 cursor-pointer"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3 h-3 text-emerald-600" />
                        <span>Impor via Excel</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="p-2.5 pl-3">No</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5 w-44 text-center">
                          {skalaPenilaian === 'ceklis'
                            ? 'Status Pengumpulan'
                            : skalaPenilaian === 'huruf'
                            ? 'Grade Huruf (A+ s/d E)'
                            : 'Nilai (0 - 100)'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeSiswa.map((s, idx) => (
                        <tr key={s.id} className="hover:bg-white">
                          <td className="p-2 pl-3 font-semibold text-slate-400">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-800">{s.nama}</td>
                          <td className="p-2 text-center">
                            {skalaPenilaian === 'ceklis' ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setStatusMap({ ...statusMap, [s.id]: 'Sudah' })}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                    (statusMap[s.id] || 'Sudah') === 'Sudah'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Sudah</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatusMap({ ...statusMap, [s.id]: 'Belum' })}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                    statusMap[s.id] === 'Belum'
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  <X className="w-3 h-3" />
                                  <span>Belum</span>
                                </button>
                              </div>
                            ) : skalaPenilaian === 'huruf' ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <select
                                  value={gradeHurufMap[s.id] || 'B+'}
                                  onChange={e =>
                                    setGradeHurufMap({
                                      ...gradeHurufMap,
                                      [s.id]: e.target.value as GradeHuruf,
                                    })
                                  }
                                  className={`font-black text-xs px-2 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 ${getGradeBadgeStyle(
                                    gradeHurufMap[s.id] || 'B+'
                                  )}`}
                                >
                                  {GRADE_HURUF_LIST.map(opt => (
                                    <option key={opt.grade} value={opt.grade}>
                                      {opt.grade} ({opt.predikat})
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  ~{gradeHurufToNumber(gradeHurufMap[s.id] || 'B+')}
                                </span>
                              </div>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={nilaiMap[s.id] ?? 80}
                                onChange={e =>
                                  setNilaiMap({
                                    ...nilaiMap,
                                    [s.id]: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Penilaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Penilaian Extra / Agenda */}
      <ConfirmModal
        isOpen={Boolean(deletingSessionId)}
        title={targetDeletingSession?.isFromAgenda ? 'Hapus Penilaian Agenda' : 'Hapus Penilaian Mandiri'}
        message={
          targetDeletingSession?.isFromAgenda
            ? `Apakah Anda yakin ingin menghapus data penilaian pada agenda pertemuan ke-${targetDeletingSession.pertemuanKe || ''}? Agenda mengajar tetap tersimpan.`
            : 'Apakah Anda yakin ingin menghapus data penilaian mandiri ini?'
        }
        confirmText="Hapus"
        cancelText="Batal"
        isDanger={true}
        onConfirm={() => {
          if (deletingSessionId) {
            const sessionToDelete = allSessions.find(s => s.id === deletingSessionId);
            if (sessionToDelete?.isFromAgenda && sessionToDelete.agendaId) {
              const targetAgenda = agendaList.find(a => a.id === sessionToDelete.agendaId);
              if (targetAgenda && onSaveAgenda) {
                onSaveAgenda({
                  ...targetAgenda,
                  adaPenilaian: false,
                  penilaian: undefined,
                });
              }
            } else {
              onDeletePenilaianExtra(deletingSessionId);
            }
            setDeletingSessionId(null);
          }
        }}
        onCancel={() => setDeletingSessionId(null)}
      />

      {/* Import Modal */}
      <ImportNilaiModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeKelas={activeKelas}
        siswaList={siswaList}
        defaultMapel={profile.mapelUtama}
        onSavePenilaian={newSession => {
          onSavePenilaianExtra(newSession);
        }}
      />

      {/* Shareable Report & Export Modal */}
      <ShareableNilaiModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        activeKelas={activeKelas}
        siswaList={siswaList}
        sessionsList={sessionsInKelas}
        profile={profile}
        initialSessionId={shareTargetSessionId}
      />

      {/* Screenshot Preview Modal */}
      <ScreenshotPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        canvas={previewCanvas}
        title={`Matriks Rekap Nilai Siswa - ${activeKelas?.namaKelas}`}
        defaultFileName={`Matriks_Nilai_${activeKelas?.namaKelas?.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.png`}
      />

      {/* Floating Screenshot Toast Notification */}
      {screenshotToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 pointer-events-none">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold text-white border pointer-events-auto ${
              screenshotToast.type === 'success'
                ? 'bg-emerald-600 border-emerald-500 shadow-emerald-500/20'
                : screenshotToast.type === 'error'
                ? 'bg-rose-600 border-rose-500 shadow-rose-500/20'
                : 'bg-sky-600 border-sky-500 shadow-sky-500/20'
            }`}
          >
            <span>{screenshotToast.message}</span>
            <button
              onClick={() => setScreenshotToast(null)}
              className="text-white/80 hover:text-white cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
