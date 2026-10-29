import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Calendar,
  Clock,
  BookOpenCheck,
  Sparkles,
  Users,
  Award,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  FileText,
  Smile,
  ShieldAlert,
  Pencil,
  Building2,
  Lock,
} from 'lucide-react';
import {
  JadwalMengajar,
  Kelas,
  Siswa,
  AgendaMengajar,
  PresensiDetail,
  PresensiStatus,
  NilaiSiswa,
  PenilaianSession,
  GradeHuruf,
  HariName,
} from '../types';
import {
  GRADE_HURUF_LIST,
  numberToGradeHuruf,
  gradeHurufToNumber,
  getGradeBadgeStyle,
} from '../utils/gradeUtils';
import {
  generateCurriculumAgenda,
  isGenerativeCode,
  AttendanceSummary,
} from '../utils/agendaCurriculumGenerator';
import {
  findActiveSchedule,
  getIndonesianDayName,
  isScheduleActiveNow,
  isScheduleUpcomingToday,
  HARI_LIST,
} from '../utils/scheduleUtils';

interface AgendaFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetJadwal: JadwalMengajar | null;
  editingAgenda?: AgendaMengajar | null;
  jadwalList: JadwalMengajar[];
  kelasList: Kelas[];
  siswaList: Siswa[];
  agendaList?: AgendaMengajar[];
  onSaveAgenda: (agenda: AgendaMengajar) => void;
}

export const AgendaFlowModal: React.FC<AgendaFlowModalProps> = ({
  isOpen,
  onClose,
  presetJadwal,
  editingAgenda = null,
  jadwalList,
  kelasList,
  siswaList,
  agendaList = [],
  onSaveAgenda,
}) => {
  // Step indicator (1: Pilih Jadwal, 2: Presensi, 3: Agenda, 4: Refleksi, 5: Opsi Penilaian & Simpan)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().substring(0, 10));
  const [pertemuanKe, setPertemuanKe] = useState<number>(1);

  // Attendance details per student
  const [presensiMap, setPresensiMap] = useState<Record<string, { status: PresensiStatus; ket: string }>>({});

  // Agenda details
  const [materi, setMateri] = useState<string>('');
  const [capaianPembelajaran, setCapaianPembelajaran] = useState<string>('');
  const [indikator, setIndikator] = useState<string>('');
  const [catatanKejadian, setCatatanKejadian] = useState<string>('');

  // Reflection details
  const [refleksiGuru, setRefleksiGuru] = useState<string>('');
  const [tindakLanjut, setTindakLanjut] = useState<string>('');

  // Generative AI Code State ("oke123")
  const [generativeCode, setGenerativeCode] = useState<string>('');
  const [generativeSuccessMessage, setGenerativeSuccessMessage] = useState<string | null>(null);

  // Step 1 Schedule Filter: 'Aktif' (hari ini / sedang aktif) | 'Semua' | HariName
  const [dayFilter, setDayFilter] = useState<'Aktif' | 'Semua' | HariName>('Aktif');

  // Assessment option
  const [adaPenilaian, setAdaPenilaian] = useState<boolean>(false);
  const [jenisPenilaian, setJenisPenilaian] = useState<
    'Formatif' | 'Sumatif' | 'Tugas' | 'UH' | 'UTS' | 'UAS'
  >('Formatif');
  const [skalaPenilaian, setSkalaPenilaian] = useState<'angka' | 'huruf'>('angka');
  const [namaPenilaian, setNamaPenilaian] = useState<string>('');
  const [kkm, setKkm] = useState<number>(75);
  const [nilaiMap, setNilaiMap] = useState<Record<string, { nilai: number; catatan: string }>>({});
  const [gradeHurufMap, setGradeHurufMap] = useState<Record<string, GradeHuruf>>({});

  // Initialize state when modal opens or preset schedule/editing agenda changes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);

      if (editingAgenda) {
        // Mode EDIT: Muat data dari agenda yang sedang diedit
        const matchedJadwal =
          jadwalList.find(j => j.id === editingAgenda.jadwalId) ||
          jadwalList.find(j => j.kelasId === editingAgenda.kelasId) ||
          presetJadwal ||
          jadwalList[0];

        if (matchedJadwal) {
          setSelectedJadwalId(matchedJadwal.id);
        }

        setTanggal(editingAgenda.tanggal);
        setPertemuanKe(editingAgenda.pertemuanKe || 1);
        setMateri(editingAgenda.materi || '');
        setCapaianPembelajaran(editingAgenda.capaianPembelajaran || '');
        setIndikator(editingAgenda.indikator || '');
        setCatatanKejadian(editingAgenda.catatanKejadian || '');
        setRefleksiGuru(editingAgenda.refleksiGuru || '');
        setTindakLanjut(editingAgenda.tindakLanjut || '');

        const targetKelasId = matchedJadwal?.kelasId || editingAgenda.kelasId;
        const studentsInClass = siswaList.filter(s => s.kelasId === targetKelasId);

        const newPresensiMap: Record<string, { status: PresensiStatus; ket: string }> = {};
        const newNilaiMap: Record<string, { nilai: number; catatan: string }> = {};
        const newGradeHurufMap: Record<string, GradeHuruf> = {};

        // Load existing presensi
        studentsInClass.forEach(s => {
          const p = editingAgenda.presensi?.find(item => item.siswaId === s.id);
          if (s.isMagang) {
            // Siswa berstatus magang di Data Siswa: otomatis terkunci ke status magang
            newPresensiMap[s.id] = {
              status: 'magang',
              ket: p?.keterangan || 'Magang / PKL Industri (Terkunci via Data Siswa)',
            };
          } else if (p) {
            // Jika siswa sudah tidak magang di Data Siswa, kembalikan ke hadir jika sebelumnya magang
            const resolvedStatus = p.status === 'magang' ? 'hadir' : p.status;
            newPresensiMap[s.id] = { status: resolvedStatus, ket: p.keterangan || '' };
          } else {
            newPresensiMap[s.id] = { status: 'hadir', ket: '' };
          }

          // Load existing penilaian if any
          const n = editingAgenda.penilaian?.daftarNilai?.find(item => item.siswaId === s.id);
          if (n) {
            newNilaiMap[s.id] = { nilai: n.nilai, catatan: n.catatan || '' };
            newGradeHurufMap[s.id] = n.gradeHuruf || numberToGradeHuruf(n.nilai);
          } else {
            newNilaiMap[s.id] = { nilai: 80, catatan: '' };
            newGradeHurufMap[s.id] = 'B+';
          }
        });

        setPresensiMap(newPresensiMap);
        setNilaiMap(newNilaiMap);
        setGradeHurufMap(newGradeHurufMap);

        if (editingAgenda.adaPenilaian && editingAgenda.penilaian) {
          setAdaPenilaian(true);
          setJenisPenilaian((editingAgenda.penilaian.jenisPenilaian as any) || 'Formatif');
          setSkalaPenilaian(editingAgenda.penilaian.skalaPenilaian || 'angka');
          setNamaPenilaian(editingAgenda.penilaian.namaPenilaian || '');
          setKkm(editingAgenda.penilaian.kkm || 75);
        } else {
          setAdaPenilaian(false);
          setSkalaPenilaian('angka');
          setNamaPenilaian('');
          setKkm(75);
        }
      } else {
        // Mode BARU: Pilih kelas aktif sesuai jadwal hari ini & jam mengajar saat ini (jangan random)
        const activeJadwal = presetJadwal || findActiveSchedule(jadwalList);
        if (activeJadwal) {
          setSelectedJadwalId(activeJadwal.id);
          setupPresensiAndNilaiForJadwal(activeJadwal.id);
        }
        setTanggal(new Date().toISOString().substring(0, 10));
        setDayFilter('Aktif');
      }
    }
  }, [isOpen, editingAgenda, presetJadwal, jadwalList]);

  // Helper to calculate next pertemuan number for selected class
  const getNextPertemuanKeForJadwal = (jId: string) => {
    const j = jadwalList.find(item => item.id === jId);
    if (!j) return 1;
    const agendasForKelas = (agendaList || []).filter(a => a.kelasId === j.kelasId);
    if (agendasForKelas.length === 0) return 1;
    const maxP = agendasForKelas.reduce((max, a) => Math.max(max, a.pertemuanKe || 0), 0);
    return maxP + 1;
  };

  const setupPresensiAndNilaiForJadwal = (jId: string) => {
    const j = jadwalList.find(item => item.id === jId);
    if (!j) return;

    // Auto-calculate Pertemuan Ke- based on this class's history
    const autoP = getNextPertemuanKeForJadwal(jId);
    setPertemuanKe(autoP);

    const studentsInClass = siswaList.filter(s => s.kelasId === j.kelasId);

    // Default: siswa magang otomatis 'magang', siswa lainnya 'hadir'
    const newPresensiMap: Record<string, { status: PresensiStatus; ket: string }> = {};
    const newNilaiMap: Record<string, { nilai: number; catatan: string }> = {};
    const newGradeHurufMap: Record<string, GradeHuruf> = {};

    studentsInClass.forEach(s => {
      newPresensiMap[s.id] = {
        status: s.isMagang ? 'magang' : 'hadir',
        ket: s.isMagang ? 'Magang / PKL Industri (Terkunci via Data Siswa)' : '',
      };
      newNilaiMap[s.id] = { nilai: 80, catatan: '' };
      newGradeHurufMap[s.id] = 'B+';
    });

    setPresensiMap(newPresensiMap);
    setNilaiMap(newNilaiMap);
    setGradeHurufMap(newGradeHurufMap);
    setMateri('');
    setCapaianPembelajaran('');
    setIndikator('');
    setCatatanKejadian('');
    setRefleksiGuru('');
    setTindakLanjut('');
    setAdaPenilaian(false);
    setSkalaPenilaian('angka');
    setNamaPenilaian('');
  };

  if (!isOpen) return null;

  const currentJadwal = jadwalList.find(j => j.id === selectedJadwalId) || jadwalList[0];
  const currentKelas = kelasList.find(k => k.id === currentJadwal?.kelasId);
  const currentStudents = siswaList.filter(s => s.kelasId === currentJadwal?.kelasId);

  // Quick Action: Set All Hadir (Siswa yang sedang Magang tetap berstatus Magang)
  const handleSetAllHadir = () => {
    const updated = { ...presensiMap };
    currentStudents.forEach(s => {
      if (s.isMagang) {
        updated[s.id] = { status: 'magang', ket: 'Magang / PKL Industri (Terkunci via Data Siswa)' };
      } else {
        updated[s.id] = { status: 'hadir', ket: '' };
      }
    });
    setPresensiMap(updated);
  };

  // Change individual attendance status
  const handleStatusChange = (siswaId: string, status: PresensiStatus) => {
    const targetStudent = currentStudents.find(s => s.id === siswaId);
    if (targetStudent?.isMagang) {
      // Siswa sedang magang di Data Siswa -> tidak dapat diubah di presensi
      return;
    }
    setPresensiMap(prev => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        status,
        ket: status === 'hadir' ? '' : prev[siswaId]?.ket || '',
      },
    }));
  };

  // Change attendance note
  const handleKetChange = (siswaId: string, ket: string) => {
    setPresensiMap(prev => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        ket,
      },
    }));
  };

  // Change individual grade
  const handleNilaiChange = (siswaId: string, val: number) => {
    setNilaiMap(prev => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        nilai: val,
      },
    }));
  };

  // Apply generative curriculum code "oke123"
  const handleApplyGenerativeCode = (inputCode: string = 'oke123') => {
    const isCode = isGenerativeCode(inputCode);
    if (!isCode && inputCode.trim().length === 0) return;

    // Calculate current attendance statistics for realistic event note
    const summary: AttendanceSummary = {
      hadir: currentStudents.filter(s => (presensiMap[s.id]?.status || 'hadir') === 'hadir').length,
      sakit: currentStudents.filter(s => presensiMap[s.id]?.status === 'sakit').length,
      ijin: currentStudents.filter(s => presensiMap[s.id]?.status === 'ijin').length,
      alpa: currentStudents.filter(s => presensiMap[s.id]?.status === 'alpa').length,
      dispen: currentStudents.filter(s => presensiMap[s.id]?.status === 'dispen').length,
      magang: currentStudents.filter(s => presensiMap[s.id]?.status === 'magang').length,
      total: currentStudents.length,
    };

    const tingkat = currentKelas?.tingkat || (currentKelas?.namaKelas?.includes('XII') ? 'XII' : 'XI');
    const generated = generateCurriculumAgenda(
      tingkat,
      pertemuanKe,
      currentJadwal?.mapel || 'Pemrograman Web',
      summary,
      !isCode ? inputCode : undefined
    );

    setMateri(generated.materi);
    setCapaianPembelajaran(generated.capaianPembelajaran);
    setIndikator(generated.indikator);
    setCatatanKejadian(generated.catatanKejadian);
    setRefleksiGuru(generated.refleksiGuru);
    setTindakLanjut(generated.tindakLanjut);

    setGenerativeSuccessMessage(
      `✨ Berhasil diisi secara generatif dengan kode "oke123"! Materi, CP, Indikator, Catatan & Refleksi otomatis diisi untuk Pertemuan ke-${pertemuanKe} (${currentKelas?.namaKelas || 'Kelas'}).`
    );
    setGenerativeCode('');
    setTimeout(() => {
      setGenerativeSuccessMessage(null);
    }, 6000);
  };

  // Final Save Handler
  const handleSave = () => {
    if (!currentJadwal || !currentKelas) return;

    const presensiList: PresensiDetail[] = currentStudents.map(s => ({
      siswaId: s.id,
      status: presensiMap[s.id]?.status || 'hadir',
      keterangan: presensiMap[s.id]?.ket || '',
    }));

    const agendaId = editingAgenda ? editingAgenda.id : `ag-${Date.now()}`;

    let penilaianSession: PenilaianSession | undefined = undefined;
    if (adaPenilaian) {
      const isHuruf = skalaPenilaian === 'huruf';
      const daftarNilai: NilaiSiswa[] = currentStudents.map(s => {
        if (isHuruf) {
          const letter = gradeHurufMap[s.id] || 'B+';
          return {
            siswaId: s.id,
            nilai: gradeHurufToNumber(letter),
            gradeHuruf: letter,
            catatan: nilaiMap[s.id]?.catatan || '',
          };
        } else {
          const num = nilaiMap[s.id]?.nilai ?? 80;
          return {
            siswaId: s.id,
            nilai: num,
            gradeHuruf: numberToGradeHuruf(num),
            catatan: nilaiMap[s.id]?.catatan || '',
          };
        }
      });

      penilaianSession = {
        id: editingAgenda?.penilaian?.id || `pen-${Date.now()}`,
        agendaId,
        kelasId: currentKelas.id,
        mapel: currentJadwal.mapel,
        tanggal,
        jenisPenilaian,
        skalaPenilaian,
        namaPenilaian: namaPenilaian || `Penilaian Pertemuan ${pertemuanKe}`,
        kkm: isHuruf ? 75 : kkm,
        daftarNilai,
      };
    }

    const savedAgenda: AgendaMengajar = {
      ...(editingAgenda || {}),
      id: agendaId,
      jadwalId: currentJadwal.id,
      kelasId: currentKelas.id,
      mapel: currentJadwal.mapel,
      tanggal,
      pertemuanKe,
      materi: materi || 'Materi Pembelajaran',
      capaianPembelajaran,
      indikator,
      catatanKejadian,
      refleksiGuru,
      tindakLanjut,
      presensi: presensiList,
      adaPenilaian,
      penilaian: penilaianSession,
      created_at: editingAgenda?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSaveAgenda(savedAgenda);
    onClose();
  };

  // Attendance summary counts
  const presensiValues = Object.values(presensiMap) as { status: PresensiStatus; ket: string }[];
  const hadirCount = presensiValues.filter(p => p.status === 'hadir').length;
  const sakitCount = presensiValues.filter(p => p.status === 'sakit').length;
  const ijinCount = presensiValues.filter(p => p.status === 'ijin').length;
  const alpaCount = presensiValues.filter(p => p.status === 'alpa').length;
  const dispenCount = presensiValues.filter(p => p.status === 'dispen').length;
  const magangCount = presensiValues.filter(p => p.status === 'magang').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header & Wizard Steps */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                editingAgenda
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
              }`}>
                {editingAgenda ? 'MODE EDIT AGENDA' : 'ALUR AGENDA MENGAJAR'}
              </span>
              {editingAgenda && (
                <span className="text-[10px] font-semibold text-slate-500">
                  {currentKelas?.namaKelas} • {tanggal}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-800 mt-1 flex items-center gap-2">
              {editingAgenda && <Pencil className="w-4 h-4 text-amber-600 shrink-0" />}
              <span>
                {editingAgenda ? `Edit Agenda: Pertemuan ${pertemuanKe}` : `Langkah ${currentStep} dari 5:`}{' '}
                {!editingAgenda && (
                  <>
                    {currentStep === 1 && 'Pilih Jadwal & Pertemuan'}
                    {currentStep === 2 && 'Presensi Kehadiran Kelas'}
                    {currentStep === 3 && 'Jurnal Agenda & Materi'}
                    {currentStep === 4 && 'Refleksi Guru & Tindak Lanjut'}
                    {currentStep === 5 && 'Opsi Penilaian & Finalisasi'}
                  </>
                )}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyGenerativeCode('oke123')}
              title="Auto-isi agenda dan materi berkelanjutan dengan kode oke123"
              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Auto-Isi</span>
              <span>"oke123"</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer hover:bg-slate-200/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Navigation Pills */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { step: 1, label: '1. Jadwal & Info' },
            { step: 2, label: `2. Presensi (${hadirCount}/${currentStudents.length})` },
            { step: 3, label: '3. Agenda & Materi' },
            { step: 4, label: '4. Refleksi' },
            { step: 5, label: adaPenilaian ? '5. Nilai & Simpan' : '5. Simpan' },
          ].map(s => {
            const isActive = currentStep === s.step;
            const isDone = currentStep > s.step;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDone
                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5 shrink-0">
          <div
            className="bg-indigo-600 h-1.5 transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>

        {/* Step Content Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ================= STEP 1: PILIH JADWAL ================= */}
          {currentStep === 1 && (() => {
            const todayName = getIndonesianDayName(new Date());
            const activeNowSchedule = jadwalList.find(j => isScheduleActiveNow(j));
            const jadwalHariIni = todayName ? jadwalList.filter(j => j.hari === todayName) : [];
            const defaultActiveJadwal = findActiveSchedule(jadwalList);

            // Filter schedules to display based on dayFilter
            let displayedJadwal = jadwalList;
            if (dayFilter === 'Aktif') {
              if (jadwalHariIni.length > 0) {
                displayedJadwal = [...jadwalHariIni].sort((a, b) => {
                  const aActive = isScheduleActiveNow(a) ? -1 : 0;
                  const bActive = isScheduleActiveNow(b) ? -1 : 0;
                  return aActive - bActive;
                });
              } else if (defaultActiveJadwal) {
                displayedJadwal = jadwalList.filter(j => j.hari === defaultActiveJadwal.hari);
              }
            } else if (dayFilter !== 'Semua') {
              displayedJadwal = jadwalList.filter(j => j.hari === dayFilter);
            }

            return (
              <div className="space-y-4">
                {/* Active Schedule Notification / Banner */}
                {activeNowSchedule ? (
                  <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 rounded-2xl border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-start sm:items-center gap-3">
                      <span className="relative flex h-3.5 w-3.5 mt-0.5 sm:mt-0 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-emerald-800 tracking-wider">
                            KBM SEDANG BERLANGSUNG SEKARANG
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                            {activeNowSchedule.jamMulai} - {activeNowSchedule.jamSelesai} WIB
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold mt-0.5">
                          {kelasList.find(k => k.id === activeNowSchedule.kelasId)?.namaKelas} • {activeNowSchedule.mapel} ({activeNowSchedule.ruangan})
                        </p>
                      </div>
                    </div>
                    {selectedJadwalId !== activeNowSchedule.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJadwalId(activeNowSchedule.id);
                          setupPresensiAndNilaiForJadwal(activeNowSchedule.id);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs transition-all active:scale-95"
                      >
                        Pilih Kelas Ini
                      </button>
                    )}
                  </div>
                ) : todayName && jadwalHariIni.length > 0 ? (
                  <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200 flex items-center justify-between gap-3 text-xs text-indigo-900 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        <strong>Jadwal Mengajar Hari Ini ({todayName}):</strong> Menampilkan {jadwalHariIni.length} kelas aktif. Kelas dipilih otomatis sesuai jadwal mengajar.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-2.5 text-xs text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Hari ini ({todayName || 'Akhir Pekan'}) tidak ada jam mengajar aktif. Menampilkan jadwal untuk hari KBM berikutnya ({defaultActiveJadwal?.hari || 'Senin'}).
                    </span>
                  </div>
                )}

                {/* Day Filter Pills */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Pilih Kelas Sesuai Jadwal:
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {displayedJadwal.length} kelas ditampilkan
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setDayFilter('Aktif')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        dayFilter === 'Aktif'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {jadwalHariIni.length > 0 ? `Kelas Aktif Hari Ini (${todayName})` : 'Jadwal Aktif'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
                        {jadwalHariIni.length > 0 ? jadwalHariIni.length : (defaultActiveJadwal ? 1 : 0)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDayFilter('Semua')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        dayFilter === 'Semua'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>Semua Jadwal ({jadwalList.length})</span>
                    </button>

                    {HARI_LIST.map(h => {
                      const count = jadwalList.filter(j => j.hari === h).length;
                      if (count === 0) return null;
                      const isToday = h === todayName;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setDayFilter(h)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                            dayFilter === h
                              ? 'bg-indigo-600 text-white shadow-xs font-bold'
                              : isToday
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          <span>{h}</span>
                          <span className="text-[10px] opacity-75">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Schedules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayedJadwal.map(j => {
                    const kelas = kelasList.find(k => k.id === j.kelasId);
                    const isSelected = j.id === selectedJadwalId;
                    const isActiveNow = isScheduleActiveNow(j);
                    const isToday = j.hari === todayName;
                    const nextP = getNextPertemuanKeForJadwal(j.id);
                    const isAlreadyFilled = agendaList.some(
                      a => a.jadwalId === j.id && a.tanggal === tanggal
                    );

                    return (
                      <div
                        key={j.id}
                        onClick={() => {
                          setSelectedJadwalId(j.id);
                          setupPresensiAndNilaiForJadwal(j.id);
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden ${
                          isSelected
                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/40'
                            : isActiveNow
                            ? 'bg-emerald-50/70 hover:bg-emerald-50 text-slate-800 border-emerald-400 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isSelected
                                  ? 'bg-indigo-500/80 text-white'
                                  : isToday
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {j.hari} • Jam {j.jamKe}
                            </span>
                            {isActiveNow && (
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-emerald-400 text-slate-900'
                                    : 'bg-emerald-600 text-white animate-pulse'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                <span>AKTIF SEKARANG</span>
                              </span>
                            )}
                            {isToday && !isActiveNow && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? 'bg-indigo-400/50 text-white'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}
                              >
                                Hari Ini
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[11px] font-semibold flex items-center gap-1 ${
                              isSelected ? 'text-indigo-200' : 'text-slate-500'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>
                              {j.jamMulai} - {j.jamSelesai}
                            </span>
                          </span>
                        </div>

                        {/* Class & Subject */}
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between">
                            <p className="font-extrabold text-sm">{kelas?.namaKelas || 'Kelas'}</p>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                isSelected
                                  ? 'bg-indigo-500 text-white'
                                  : 'bg-slate-200/80 text-slate-600'
                              }`}
                            >
                              {j.ruangan}
                            </span>
                          </div>
                          <p
                            className={`text-xs font-semibold mt-0.5 ${
                              isSelected ? 'text-indigo-100' : 'text-indigo-600'
                            }`}
                          >
                            {j.mapel}
                          </p>
                        </div>

                        {/* Footer info: Next meeting & attendance status */}
                        <div
                          className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] ${
                            isSelected
                              ? 'border-indigo-500/50 text-indigo-100'
                              : 'border-slate-200 text-slate-500'
                          }`}
                        >
                          <span className="font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Agenda ke-{nextP}</span>
                          </span>

                          {isAlreadyFilled ? (
                            <span
                              className={`font-bold flex items-center gap-1 ${
                                isSelected ? 'text-emerald-200' : 'text-emerald-700'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Terisi Hari Ini</span>
                            </span>
                          ) : (
                            <span className="opacity-80">
                              {kelas?.jumlahSiswa ? `${kelas.jumlahSiswa} Siswa` : 'Siap Diisi'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Date & Meeting inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Mengajar
                    </label>
                    <input
                      type="date"
                      value={tanggal}
                      onChange={e => setTanggal(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Pertemuan Ke-
                      </label>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Otomatis (Kelas {currentKelas?.namaKelas || ''})</span>
                      </span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={pertemuanKe}
                      onChange={e => setPertemuanKe(parseInt(e.target.value) || 1)}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-extrabold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Nomor pertemuan dihitung otomatis secara berurutan untuk {currentKelas?.namaKelas || 'kelas ini'}.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ================= STEP 2: PRESENSI KELAS ================= */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    Presensi Siswa: {currentKelas?.namaKelas} ({currentStudents.length} Siswa)
                  </h3>
                  <div className="flex flex-wrap gap-2 text-[11px] mt-1.5 font-semibold">
                    <span className="text-emerald-600">Hadir: {hadirCount}</span>
                    <span>•</span>
                    <span className="text-amber-600">Sakit: {sakitCount}</span>
                    <span>•</span>
                    <span className="text-blue-600">Ijin: {ijinCount}</span>
                    <span>•</span>
                    <span className="text-rose-600">Alpa: {alpaCount}</span>
                    <span>•</span>
                    <span className="text-purple-600">Dispen: {dispenCount}</span>
                    {magangCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-indigo-600 font-bold flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          Magang: {magangCount} (Terkunci)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSetAllHadir}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Semua Hadir</span>
                </button>
              </div>

              {/* Informative Banner when Magang Students are present */}
              {magangCount > 0 && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center gap-2.5 text-xs text-indigo-700">
                  <Building2 className="w-4 h-4 shrink-0 text-indigo-600" />
                  <span>
                    Terdapat <strong>{magangCount} siswa</strong> berstatus <strong>Magang / PKL</strong>. Kehadiran otomatis berstatus Magang dan terkunci (diatur melalui menu Data Siswa).
                  </span>
                </div>
              )}

              {/* Student Attendance List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {currentStudents.map((s, idx) => {
                  const isStudentMagang = Boolean(s.isMagang);
                  const currentStatus = isStudentMagang ? 'magang' : (presensiMap[s.id]?.status || 'hadir');
                  const currentKet = presensiMap[s.id]?.ket || '';

                  return (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                        isStudentMagang
                          ? 'bg-indigo-50/40 border-indigo-100/90'
                          : 'bg-slate-50/70 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-6 text-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 text-xs">{s.nama}</p>
                            {isStudentMagang && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                <Building2 className="w-3 h-3" />
                                Sedang Magang
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            NIS: {s.nis} ({s.jenisKelamin})
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        {isStudentMagang ? (
                          /* Siswa Magang: Tampilan terkunci, tidak ada pilihan tombol */
                          <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs shadow-2xs select-none"
                            title="Status kehadiran terkunci karena siswa sedang magang di Data Siswa. Edit di menu Data Siswa untuk mengubah."
                          >
                            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>Magang / PKL</span>
                            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Lock className="w-3 h-3 text-indigo-500" /> Terkunci (Data Siswa)
                            </span>
                          </div>
                        ) : (
                          /* Siswa Reguler: Pilihan presensi murni (Magang ditiadakan dari pilihan presensi) */
                          <>
                            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                              {(
                                [
                                  { id: 'hadir', label: 'Hadir', color: 'bg-emerald-500 text-white' },
                                  { id: 'sakit', label: 'Sakit', color: 'bg-amber-500 text-white' },
                                  { id: 'ijin', label: 'Ijin', color: 'bg-blue-500 text-white' },
                                  { id: 'alpa', label: 'Alpa', color: 'bg-rose-500 text-white' },
                                  { id: 'dispen', label: 'Dispen', color: 'bg-purple-500 text-white' },
                                ] as const
                              ).map(st => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => handleStatusChange(s.id, st.id)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                    currentStatus === st.id
                                      ? st.color
                                      : 'text-slate-500 hover:bg-slate-100'
                                  }`}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>

                            {/* Note input if not hadir */}
                            {currentStatus !== 'hadir' && (
                              <input
                                type="text"
                                value={currentKet}
                                onChange={e => handleKetChange(s.id, e.target.value)}
                                placeholder="Ket..."
                                className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none w-32"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= STEP 3: AGENDA & MATERI ================= */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {/* Generative AI Assistant Box */}
              <div className="p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xs shrink-0 mt-0.5 sm:mt-0">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">
                          Generatif Agenda & Materi Pembelajaran
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white shadow-xs tracking-wider">
                          KODE: oke123
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Ketik kode <strong>"oke123"</strong> untuk mengisi otomatis materi, CP, indikator, catatan kejadian, & refleksi berkelanjutan (Pertemuan ke-{pertemuanKe}).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyGenerativeCode('oke123')}
                    className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow cursor-pointer transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0 active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Isi "oke123"</span>
                  </button>
                </div>

                {/* Input for the code */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={generativeCode}
                      onChange={e => {
                        const val = e.target.value;
                        setGenerativeCode(val);
                        if (isGenerativeCode(val)) {
                          handleApplyGenerativeCode(val);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyGenerativeCode(generativeCode || 'oke123');
                        }
                      }}
                      placeholder="Ketik kode: oke123 (lalu tekan Enter atau klik Terapkan)"
                      className="w-full pl-3 pr-24 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyGenerativeCode(generativeCode || 'oke123')}
                      className="absolute right-1 top-1 bottom-1 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-indigo-200"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      <span>Terapkan</span>
                    </button>
                  </div>
                </div>

                {/* Success Notification Banner */}
                {generativeSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{generativeSuccessMessage}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Materi Pembelajaran <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-indigo-600 font-semibold">
                    (Tips: Ketik "oke123" di sini untuk auto-generate langsung)
                  </span>
                </div>
                <input
                  type="text"
                  value={materi}
                  onChange={e => {
                    const val = e.target.value;
                    setMateri(val);
                    if (isGenerativeCode(val)) {
                      handleApplyGenerativeCode('oke123');
                    }
                  }}
                  placeholder="Contoh: Pembuatan REST API dengan Express.js atau ketik 'oke123'"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Capaian Pembelajaran (CP / KD)
                </label>
                <textarea
                  rows={2}
                  value={capaianPembelajaran}
                  onChange={e => setCapaianPembelajaran(e.target.value)}
                  placeholder="Contoh: Siswa mampu merancang dan menerapkan arsitektur RESTful web service..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Indikator Ketercapaian
                </label>
                <textarea
                  rows={2}
                  value={indikator}
                  onChange={e => setIndikator(e.target.value)}
                  placeholder="Contoh: Dapat membuat route GET, POST, PUT, DELETE"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Kejadian / Kendala Kelas (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={catatanKejadian}
                  onChange={e => setCatatanKejadian(e.target.value)}
                  placeholder="Contoh: Jaringan komputer di Lab 1 sempat mati 10 menit..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 4: REFLEKSI GURU ================= */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-sky-50 rounded-2xl border border-sky-100 text-xs text-sky-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Tuliskan catatan refleksi proses belajar mengajar untuk evaluasi dan perbaikan kualitas pembelajaran selanjutnya.</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyGenerativeCode('oke123')}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[11px] font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1.5 self-start sm:self-auto active:scale-95 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Isi Refleksi ("oke123")</span>
                </button>
              </div>

              {generativeSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{generativeSuccessMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Refleksi Pembelajaran Guru
                </label>
                <textarea
                  rows={3}
                  value={refleksiGuru}
                  onChange={e => setRefleksiGuru(e.target.value)}
                  placeholder="Contoh: Siswa sangat aktif saat sesi praktikum, namun perlu penjelasan ulang tentang async await..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tindak Lanjut / Penugasan
                </label>
                <textarea
                  rows={2}
                  value={tindakLanjut}
                  onChange={e => setTindakLanjut(e.target.value)}
                  placeholder="Contoh: Memberikan modul tambahan praktikum mandiri di rumah..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 5: OPSI PENILAIAN & SIMPAN ================= */}
          {currentStep === 5 && (
            <div className="space-y-5">
              {/* Toggle Ada Penilaian */}
              <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-purple-900 text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span>Sertakan Penilaian Pada Pertemuan Ini?</span>
                  </h3>
                  <p className="text-xs text-purple-600 mt-0.5">
                    Aktifkan jika Anda mengambil nilai praktikum/tugas saat jam pelajaran ini.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adaPenilaian}
                    onChange={e => setAdaPenilaian(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {adaPenilaian && (
                <div className="space-y-4 pt-2">
                  {/* Pilihan Format Penilaian */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Format Penilaian:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSkalaPenilaian('angka')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          skalaPenilaian === 'angka'
                            ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Nilai Angka (0 - 100)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkalaPenilaian('huruf')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          skalaPenilaian === 'huruf'
                            ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 text-purple-600" />
                        <span>Format Huruf (A, B, C...)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jenis Penilaian
                      </label>
                      <select
                        value={jenisPenilaian}
                        onChange={e =>
                          setJenisPenilaian(
                            e.target.value as 'Formatif' | 'Sumatif' | 'Tugas' | 'UH' | 'UTS' | 'UAS'
                          )
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value="Formatif">Formatif</option>
                        <option value="Sumatif">Sumatif</option>
                        <option value="Tugas">Tugas Praktikum</option>
                        <option value="UH">Ulangan Harian</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Penilaian
                      </label>
                      <input
                        type="text"
                        value={namaPenilaian}
                        onChange={e => setNamaPenilaian(e.target.value)}
                        placeholder="Contoh: Kuis Praktikum Express API"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Input Nilai Siswa Table */}
                  <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/50">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0">
                        <tr>
                          <th className="p-2.5 pl-3">No</th>
                          <th className="p-2.5">Nama Siswa</th>
                          <th className="p-2.5 w-36 text-center">
                            {skalaPenilaian === 'huruf' ? 'Grade Huruf' : 'Nilai (0 - 100)'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentStudents.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-white">
                            <td className="p-2 pl-3 font-semibold text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{s.nama}</span>
                                {s.isMagang && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> Magang
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              {skalaPenilaian === 'huruf' ? (
                                <select
                                  value={gradeHurufMap[s.id] || 'B+'}
                                  onChange={e =>
                                    setGradeHurufMap({
                                      ...gradeHurufMap,
                                      [s.id]: e.target.value as GradeHuruf,
                                    })
                                  }
                                  className={`font-black text-xs px-2 py-1 rounded-lg border cursor-pointer ${getGradeBadgeStyle(
                                    gradeHurufMap[s.id] || 'B+'
                                  )}`}
                                >
                                  {GRADE_HURUF_LIST.map(opt => (
                                    <option key={opt.grade} value={opt.grade}>
                                      {opt.grade} ({opt.predikat})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={nilaiMap[s.id]?.nilai ?? 80}
                                  onChange={e =>
                                    handleNilaiChange(s.id, parseInt(e.target.value) || 0)
                                  }
                                  className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center"
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Summary Card Before Save */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                <p className="font-bold text-slate-800 border-b border-slate-200 pb-1">
                  Ringkasan Agenda Siap Disimpan:
                </p>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <p>
                    Kelas: <strong>{currentKelas?.namaKelas}</strong>
                  </p>
                  <p>
                    Mata Pelajaran: <strong>{currentJadwal?.mapel}</strong>
                  </p>
                  <p>
                    Tanggal / Ke: <strong>{tanggal} (P-{pertemuanKe})</strong>
                  </p>
                  <p>
                    Kehadiran: <strong>{hadirCount}/{currentStudents.length} Hadir</strong>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          <div className="flex items-center gap-2">
            {editingAgenda && currentStep < 5 && (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Langsung simpan perubahan tanpa harus ke langkah 5"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Lanjut</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-200 cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{editingAgenda ? 'Simpan Perubahan Agenda' : 'Simpan Agenda Mengajar'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
