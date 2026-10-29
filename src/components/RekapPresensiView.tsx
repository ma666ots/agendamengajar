import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  CalendarCheck,
  Calendar,
  Filter,
  Download,
  Share2,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Users,
  Eye,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import {
  Kelas,
  Siswa,
  AgendaMengajar,
  TeacherProfile,
  PresensiStatus,
} from '../types';
import { initialProfile } from '../data/initialData';
import { ShareablePresensiModal, copyToClipboardSafe } from './ShareablePresensiModal';

interface RekapPresensiViewProps {
  profile?: TeacherProfile;
  kelasList: Kelas[];
  siswaList: Siswa[];
  agendaList: AgendaMengajar[];
  onOpenAgendaDetail?: (agenda: AgendaMengajar) => void;
  onEditAgenda?: (agenda: AgendaMengajar) => void;
}

export const RekapPresensiView: React.FC<RekapPresensiViewProps> = ({
  profile = initialProfile,
  kelasList,
  siswaList,
  agendaList = [],
  onOpenAgendaDetail,
  onEditAgenda,
}) => {
  // 1. Selected Class State
  const [selectedKelasId, setSelectedKelasId] = useState<string>(() => {
    const classWithData = kelasList.find(k =>
      agendaList.some(a => a.kelasId === k.id) || siswaList.some(s => s.kelasId === k.id)
    );
    return classWithData?.id || kelasList[0]?.id || '';
  });

  // Filter States
  const [filterMode, setFilterMode] = useState<'semua' | 'bulan' | 'rentang'>('semua');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // format: 'YYYY-MM'
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unperfect' | 'perfect'>('all');

  // Interactive Modals State
  const [selectedAgendaDetail, setSelectedAgendaDetail] = useState<AgendaMengajar | null>(null);
  const [modalFilter, setModalFilter] = useState<'all' | 'absent' | 'hadir'>('all');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalCopied, setModalCopied] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // Active Class Info
  const activeKelas = useMemo(() => {
    return (
      kelasList.find(k => k.id === selectedKelasId) ||
      kelasList[0] || { id: '', namaKelas: 'Pilih Kelas', tingkat: '', jurusan: '', tahunAjaran: '' }
    );
  }, [kelasList, selectedKelasId]);

  // Students in selected class
  const activeSiswa = useMemo(() => {
    return siswaList
      .filter(s => s.kelasId === selectedKelasId)
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [siswaList, selectedKelasId]);

  // Agendas for this class, sorted by pertemuanKe ascending
  const classAgendas = useMemo(() => {
    return agendaList
      .filter(a => a.kelasId === selectedKelasId)
      .sort((a, b) => {
        const pDiff = (a.pertemuanKe || 0) - (b.pertemuanKe || 0);
        if (pDiff !== 0) return pDiff;
        return (a.tanggal || '').localeCompare(b.tanggal || '');
      });
  }, [agendaList, selectedKelasId]);

  // Extract unique available months from the class agendas
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, { key: string; label: string; count: number }>();
    classAgendas.forEach(a => {
      if (a.tanggal && a.tanggal.length >= 7) {
        const monthKey = a.tanggal.substring(0, 7); // 'YYYY-MM'
        const dateObj = new Date(a.tanggal);
        const monthLabel = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
          : monthKey;

        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, { key: monthKey, label: monthLabel, count: 1 });
        } else {
          const current = monthsMap.get(monthKey)!;
          current.count += 1;
        }
      }
    });
    return Array.from(monthsMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [classAgendas]);

  // Filtered agendas according to month or custom date range
  const filteredAgendas = useMemo(() => {
    return classAgendas.filter(a => {
      if (!a.tanggal) return true;

      if (filterMode === 'bulan' && selectedMonth !== 'all') {
        return a.tanggal.startsWith(selectedMonth);
      }

      if (filterMode === 'rentang') {
        if (startDate && a.tanggal < startDate) return false;
        if (endDate && a.tanggal > endDate) return false;
        return true;
      }

      return true;
    });
  }, [classAgendas, filterMode, selectedMonth, startDate, endDate]);

  // Helper to find student status in a given agenda
  const getPresensiStatus = (agenda: AgendaMengajar, siswaId: string) => {
    const item = (agenda.presensi || []).find(p => p.siswaId === siswaId);
    if (!item) {
      // Default to hadir if not marked otherwise
      return { status: 'hadir' as PresensiStatus, keterangan: '' };
    }
    return {
      status: item.status || 'hadir',
      keterangan: item.keterangan || '',
    };
  };

  // Student Attendance Statistics Computation
  const studentStats = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        hadir: number;
        sakit: number;
        ijin: number;
        alpa: number;
        dispen: number;
        magang: number;
        totalPertemuan: number;
        persenHadir: number;
      }
    >();

    activeSiswa.forEach(s => {
      let h = 0;
      let sk = 0;
      let ij = 0;
      let al = 0;
      let dp = 0;
      let mg = 0;

      filteredAgendas.forEach(ag => {
        const { status } = getPresensiStatus(ag, s.id);
        if (status === 'hadir') h++;
        else if (status === 'sakit') sk++;
        else if (status === 'ijin') ij++;
        else if (status === 'alpa') al++;
        else if (status === 'dispen') dp++;
        else if (status === 'magang') mg++;
        else h++;
      });

      const total = filteredAgendas.length;
      // Dispen, Sakit, Izin, Alpa, Magang dihitung tidak ikut tatap muka kelas
      const pct = total > 0 ? Math.round((h / total) * 100) : 100;

      statsMap.set(s.id, {
        hadir: h,
        sakit: sk,
        ijin: ij,
        alpa: al,
        dispen: dp,
        magang: mg,
        totalPertemuan: total,
        persenHadir: pct,
      });
    });

    return statsMap;
  }, [activeSiswa, filteredAgendas]);

  // Overall Class KPI Statistics
  const classKpi = useMemo(() => {
    let totalH = 0;
    let totalS = 0;
    let totalI = 0;
    let totalA = 0;
    let totalD = 0;
    let totalM = 0;

    studentStats.forEach(st => {
      totalH += st.hadir;
      totalS += st.sakit;
      totalI += st.ijin;
      totalA += st.alpa;
      totalD += st.dispen;
      totalM += st.magang;
    });

    const totalRecords = activeSiswa.length * filteredAgendas.length;
    const avgPct =
      totalRecords > 0
        ? Math.round((totalH / totalRecords) * 1000) / 10
        : 100;

    return {
      totalH,
      totalS,
      totalI,
      totalA,
      totalD,
      totalM,
      avgPct,
      hasMagang: totalM > 0,
    };
  }, [studentStats, activeSiswa.length, filteredAgendas.length]);

  // Filtered Students (Search & Condition)
  const displayedStudents = useMemo(() => {
    return activeSiswa.filter(s => {
      // Search filter
      if (searchStudent.trim()) {
        const query = searchStudent.toLowerCase();
        const matchName = s.nama.toLowerCase().includes(query);
        const matchNis = (s.nis || '').toLowerCase().includes(query);
        if (!matchName && !matchNis) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const st = studentStats.get(s.id);
        if (!st) return true;
        if (statusFilter === 'unperfect') {
          return st.persenHadir < 100 || st.sakit > 0 || st.ijin > 0 || st.alpa > 0 || st.dispen > 0 || st.magang > 0;
        }
        if (statusFilter === 'perfect') {
          return st.persenHadir === 100 && st.sakit === 0 && st.ijin === 0 && st.alpa === 0 && st.dispen === 0 && st.magang === 0;
        }
      }

      return true;
    });
  }, [activeSiswa, searchStudent, statusFilter, studentStats]);

  // Format Helper for Date
  const formatDateShort = (isoDate: string) => {
    if (!isoDate) return '-';
    try {
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  };

  const formatDateFull = (isoDate: string) => {
    if (!isoDate) return '-';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  // Badge Renderer
  const renderStatusBadge = (status: PresensiStatus, keterangan?: string) => {
    switch (status) {
      case 'hadir':
        return (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 shadow-2xs hover:scale-110 transition-transform"
            title="Hadir"
          >
            H
          </span>
        );
      case 'sakit':
        return (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 text-amber-700 font-bold text-xs border border-amber-300 shadow-2xs hover:scale-110 transition-transform cursor-help"
            title={keterangan ? `Sakit: ${keterangan}` : 'Sakit'}
          >
            S
          </span>
        );
      case 'ijin':
        return (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs border border-sky-300 shadow-2xs hover:scale-110 transition-transform cursor-help"
            title={keterangan ? `Ijin: ${keterangan}` : 'Ijin'}
          >
            I
          </span>
        );
      case 'alpa':
        return (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-50 text-rose-700 font-extrabold text-xs border border-rose-300 shadow-2xs hover:scale-110 transition-transform cursor-help"
            title={keterangan ? `Alpa: ${keterangan}` : 'Tanpa Keterangan (Alpa)'}
          >
            A
          </span>
        );
      case 'dispen':
        return (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-bold text-xs border border-purple-300 shadow-2xs hover:scale-110 transition-transform cursor-help"
            title={keterangan ? `Dispensasi: ${keterangan}` : 'Dispensasi Sekolah'}
          >
            D
          </span>
        );
      case 'magang':
        return (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-300 shadow-2xs hover:scale-110 transition-transform cursor-help"
            title={keterangan ? `Magang: ${keterangan}` : 'Program Magang / PKL'}
          >
            M
          </span>
        );
      default:
        return (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 font-bold text-xs"
            title="Hadir"
          >
            H
          </span>
        );
    }
  };

  // Export Matrix to Excel (.xlsx)
  const handleExportExcel = () => {
    if (activeSiswa.length === 0) {
      alert('Tidak ada data siswa untuk diekspor.');
      return;
    }

    const rows = activeSiswa.map((s, idx) => {
      const rowData: Record<string, any> = {
        No: idx + 1,
        NIS: s.nis || '-',
        NISN: s.nisn || '-',
        'Nama Siswa': s.nama,
        'L/P': s.jenisKelamin || 'L',
      };

      // Add each meeting column
      filteredAgendas.forEach(ag => {
        const { status } = getPresensiStatus(ag, s.id);
        const colTitle = `P${ag.pertemuanKe} (${formatDateShort(ag.tanggal)})`;
        const letter =
          status === 'hadir'
            ? 'H'
            : status === 'sakit'
            ? 'S'
            : status === 'ijin'
            ? 'I'
            : status === 'alpa'
            ? 'A'
            : status === 'dispen'
            ? 'D'
            : status === 'magang'
            ? 'M'
            : 'H';
        rowData[colTitle] = letter;
      });

      const st = studentStats.get(s.id);
      rowData['Total Hadir (H)'] = st?.hadir || 0;
      rowData['Total Sakit (S)'] = st?.sakit || 0;
      rowData['Total Izin (I)'] = st?.ijin || 0;
      rowData['Total Alpa (A)'] = st?.alpa || 0;
      rowData['Total Dispen (D)'] = st?.dispen || 0;
      rowData['Total Magang (M)'] = st?.magang || 0;
      rowData['% Kehadiran'] = `${st?.persenHadir || 100}%`;
      rowData['Status'] =
        (st?.persenHadir || 100) >= 90
          ? 'Sangat Baik'
          : (st?.persenHadir || 100) >= 75
          ? 'Baik'
          : 'Perlu Perhatian';

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap_Presensi');

    const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filterInfo =
      filterMode === 'bulan' && selectedMonth !== 'all'
        ? `_${selectedMonth}`
        : filterMode === 'rentang' && startDate
        ? `_${startDate}_sd_${endDate || 'now'}`
        : '';
    XLSX.writeFile(workbook, `Rekap_Presensi_${safeKelas}${filterInfo}.xlsx`);
  };

  // Filter description for reporting and sharing
  const filterDescription = useMemo(() => {
    if (filterMode === 'bulan' && selectedMonth !== 'all') {
      const matchMonth = availableMonths.find(m => m.key === selectedMonth);
      return matchMonth ? `Bulan ${matchMonth.label}` : selectedMonth;
    }
    if (filterMode === 'rentang' && (startDate || endDate)) {
      return `Periode ${startDate || 'Awal'} s.d. ${endDate || 'Sekarang'}`;
    }
    return `Seluruh Pertemuan (${filteredAgendas.length} Pertemuan)`;
  }, [filterMode, selectedMonth, availableMonths, startDate, endDate, filteredAgendas.length]);

  // Generate WhatsApp / Text summary for entire class
  const generateShareText = () => {
    let text = `*REKAPITULASI PRESENSI KEHADIRAN SISWA*\n`;
    text += `Sekolah: ${profile.namaSekolah}\n`;
    text += `Kelas: *${activeKelas.namaKelas}* (${activeKelas.jurusan || ''})\n`;
    text += `Guru Pengampu: ${profile.namaGuru}\n`;
    text += `Tahun Ajaran: ${profile.tahunAjaran} (${profile.semester})\n`;
    text += `Periode Rekap: ${filterDescription} (${filteredAgendas.length} Pertemuan)\n\n`;

    text += `*RINGKASAN KEHADIRAN KELAS:*\n`;
    text += `• Rata-rata Kehadiran: *${classKpi.avgPct}%*\n`;
    text += `• Total Hadir (H): ${classKpi.totalH}\n`;
    text += `• Total Sakit (S): ${classKpi.totalS}\n`;
    text += `• Total Izin (I): ${classKpi.totalI}\n`;
    text += `• Total Alpa (A): ${classKpi.totalA}\n`;
    if (classKpi.hasMagang) {
      text += `• Total Magang (M): ${classKpi.totalM}\n`;
    }
    text += `\n*CATATAN KETIDAKHADIRAN SISWA:*\n`;

    const unperfectStudents = activeSiswa.filter(s => {
      const st = studentStats.get(s.id);
      return st && (st.sakit > 0 || st.ijin > 0 || st.alpa > 0 || st.dispen > 0 || st.magang > 0);
    });

    if (unperfectStudents.length === 0) {
      text += `_Alhamdulillah, seluruh siswa hadir 100% pada periode ini._\n`;
    } else {
      unperfectStudents.forEach((s, i) => {
        const st = studentStats.get(s.id)!;
        const notes = [];
        if (st.sakit > 0) notes.push(`${st.sakit} Sakit`);
        if (st.ijin > 0) notes.push(`${st.ijin} Izin`);
        if (st.alpa > 0) notes.push(`${st.alpa} Alpa`);
        if (st.dispen > 0) notes.push(`${st.dispen} Dispen`);
        if (st.magang > 0) notes.push(`${st.magang} Magang`);
        text += `${i + 1}. ${s.nama} (${notes.join(', ')}) -> Hadir: ${st.persenHadir}%\n`;
      });
    }

    return text;
  };

  const handleCopyShare = async () => {
    const text = generateShareText();
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    }
  };

  // Helper to get stats for a single meeting
  const getMeetingStats = (agenda: AgendaMengajar) => {
    let hadir = 0;
    let sakit = 0;
    let ijin = 0;
    let alpa = 0;
    let dispen = 0;
    let magang = 0;

    activeSiswa.forEach(s => {
      const { status } = getPresensiStatus(agenda, s.id);
      if (status === 'hadir') hadir++;
      else if (status === 'sakit') sakit++;
      else if (status === 'ijin') ijin++;
      else if (status === 'alpa') alpa++;
      else if (status === 'dispen') dispen++;
      else if (status === 'magang') magang++;
      else hadir++;
    });

    const total = activeSiswa.length;
    const persen = total > 0 ? Math.round(((hadir + dispen + magang) / total) * 100) : 100;
    return { hadir, sakit, ijin, alpa, dispen, magang, total, persen };
  };

  // Stats for the currently selected meeting in modal
  const selectedAgendaStats = useMemo(() => {
    if (!selectedAgendaDetail) return null;
    return getMeetingStats(selectedAgendaDetail);
  }, [selectedAgendaDetail, activeSiswa]);

  // Students list inside the detail modal with filtering
  const modalStudents = useMemo(() => {
    if (!selectedAgendaDetail) return [];
    return activeSiswa.filter(s => {
      const { status } = getPresensiStatus(selectedAgendaDetail, s.id);
      if (modalFilter === 'absent' && (status === 'hadir' || status === 'magang')) return false;
      if (modalFilter === 'hadir' && status !== 'hadir' && status !== 'magang') return false;
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase();
        if (!s.nama.toLowerCase().includes(q) && !(s.nis || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [selectedAgendaDetail, activeSiswa, modalFilter, modalSearch]);

  // Generate WhatsApp message for single meeting
  const generateMeetingShareText = () => {
    if (!selectedAgendaDetail || !selectedAgendaStats) return '';
    let text = `*PRESENSI KEHADIRAN SISWA - KELAS ${activeKelas.namaKelas}*\n`;
    text += `Sekolah: ${profile.namaSekolah}\n`;
    text += `Pertemuan: Ke-${selectedAgendaDetail.pertemuanKe} (${formatDateFull(selectedAgendaDetail.tanggal)})\n`;
    if (selectedAgendaDetail.mapel) text += `Mata Pelajaran: ${selectedAgendaDetail.mapel}\n`;
    if (selectedAgendaDetail.jamKe) text += `Jam Ke: ${selectedAgendaDetail.jamKe}\n`;
    text += `Materi: *${selectedAgendaDetail.materi}*\n\n`;
    text += `*Ringkasan Kehadiran:*\n`;
    text += `• Hadir: ${selectedAgendaStats.hadir}/${selectedAgendaStats.total} Siswa (${selectedAgendaStats.persen}%)\n`;
    if (selectedAgendaStats.sakit > 0) text += `• Sakit (S): ${selectedAgendaStats.sakit}\n`;
    if (selectedAgendaStats.ijin > 0) text += `• Izin (I): ${selectedAgendaStats.ijin}\n`;
    if (selectedAgendaStats.alpa > 0) text += `• Alpa (A): ${selectedAgendaStats.alpa}\n`;
    if (selectedAgendaStats.dispen > 0) text += `• Dispen (D): ${selectedAgendaStats.dispen}\n`;
    if (selectedAgendaStats.magang > 0) text += `• Magang (M): ${selectedAgendaStats.magang}\n`;

    const absentStudents = activeSiswa.filter(s => {
      const { status } = getPresensiStatus(selectedAgendaDetail, s.id);
      return status !== 'hadir' && status !== 'magang';
    });

    if (absentStudents.length > 0) {
      text += `\n*Daftar Siswa Tidak Hadir / Keterangan:*\n`;
      absentStudents.forEach((s, i) => {
        const { status, keterangan } = getPresensiStatus(selectedAgendaDetail, s.id);
        const statusLabel =
          status === 'sakit'
            ? 'Sakit'
            : status === 'ijin'
            ? 'Izin'
            : status === 'alpa'
            ? 'Alpa'
            : 'Dispensasi';
        text += `${i + 1}. ${s.nama} [${statusLabel}]${keterangan ? ` - ${keterangan}` : ''}\n`;
      });
    } else {
      text += `\n_Seluruh siswa hadir 100% pada pertemuan ini._\n`;
    }
    return text;
  };

  // Copy WhatsApp summary for the specific meeting opened in modal
  const handleCopyMeetingShare = async () => {
    const text = generateMeetingShareText();
    if (!text) return;
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2500);
    }
  };

  // Open WhatsApp Web for the specific meeting
  const handleOpenMeetingWhatsApp = () => {
    const text = generateMeetingShareText();
    if (!text) return;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions Toolbar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-600" />
            <span>Matriks Rekap Presensi Siswa</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Format matriks visual per pertemuan dan tanggal, dilengkapi kalkulasi otomatis persentase kehadiran, filter bulan/rentang tanggal, serta ekspor Excel.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Ekspor Seluruh Matriks Presensi ke File Excel (.xlsx)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Bagikan Ringkasan Presensi ke WhatsApp / Wali Siswa"
          >
            <Share2 className="w-4 h-4" />
            <span>Bagikan / Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* 2. Class Selector Tabs (Matches exact style in image.png) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {kelasList.map(k => {
          const isSelected = k.id === selectedKelasId;
          const count = agendaList.filter(a => a.kelasId === k.id).length;
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

      {/* 3. Filter Bar (Perbulan, Rentang Tanggal, & Search) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Filter Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filter Periode:</span>
            </span>

            <button
              onClick={() => {
                setFilterMode('semua');
                setSelectedMonth('all');
                setStartDate('');
                setEndDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'semua'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Pertemuan ({classAgendas.length})
            </button>

            <button
              onClick={() => setFilterMode('bulan')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'bulan'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Per Bulan</span>
            </button>

            <button
              onClick={() => setFilterMode('rentang')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'rentang'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Rentang Tanggal</span>
            </button>
          </div>

          {/* Search Student Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama siswa / NIS..."
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            {searchStudent && (
              <button
                onClick={() => setSearchStudent('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Controls based on selected filterMode */}
        {filterMode === 'bulan' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 animate-fadeIn">
            <span className="text-[11px] font-semibold text-slate-500">Pilih Bulan:</span>
            <button
              onClick={() => setSelectedMonth('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                selectedMonth === 'all'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua Bulan
            </button>
            {availableMonths.map(m => (
              <button
                key={m.key}
                onClick={() => setSelectedMonth(m.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                  selectedMonth === m.key
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <span>{m.label}</span>
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    selectedMonth === m.key ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {m.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {filterMode === 'rentang' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-500">Dari Tanggal:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-500">Sampai Tanggal:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer underline ml-2"
              >
                Reset Tanggal
              </button>
            )}
          </div>
        )}

        {/* Quick Filter Status Siswa Tabs */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <span>Tampilkan Siswa:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                statusFilter === 'all'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({activeSiswa.length})
            </button>
            <span>•</span>
            <button
              onClick={() => setStatusFilter('unperfect')}
              className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                statusFilter === 'unperfect'
                  ? 'bg-amber-50 text-amber-700 font-bold'
                  : 'text-slate-500 hover:text-amber-700'
              }`}
            >
              Pernah Tidak Hadir (S/I/A)
            </button>
            <span>•</span>
            <button
              onClick={() => setStatusFilter('perfect')}
              className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                statusFilter === 'perfect'
                  ? 'bg-emerald-50 text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Kehadiran 100%
            </button>
          </div>
          <span className="text-[11px] text-slate-400">
            Menampilkan {filteredAgendas.length} sesi pertemuan
          </span>
        </div>
      </div>

      {/* 4. KPI Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-slate-400">Pertemuan</span>
          <span className="text-xl font-extrabold text-slate-800 mt-0.5">
            {filteredAgendas.length} Sesi
          </span>
        </div>

        <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-emerald-600">Avg Kehadiran</span>
          <span className="text-xl font-extrabold text-emerald-700 mt-0.5">
            {classKpi.avgPct}%
          </span>
        </div>

        <div className="bg-emerald-50/30 p-3.5 rounded-2xl border border-emerald-100/60 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-emerald-600">Total Hadir (H)</span>
          <span className="text-xl font-extrabold text-emerald-700 mt-0.5">{classKpi.totalH}</span>
        </div>

        <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-amber-600">Sakit (S)</span>
          <span className="text-xl font-extrabold text-amber-700 mt-0.5">{classKpi.totalS}</span>
        </div>

        <div className="bg-sky-50/50 p-3.5 rounded-2xl border border-sky-100 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-sky-600">Izin (I)</span>
          <span className="text-xl font-extrabold text-sky-700 mt-0.5">{classKpi.totalI}</span>
        </div>

        <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-rose-500">Alpa (A)</span>
          <span className="text-xl font-extrabold text-rose-600 mt-0.5">{classKpi.totalA}</span>
        </div>

        <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-purple-600">Dispen (D)</span>
          <span className="text-xl font-extrabold text-purple-700 mt-0.5">{classKpi.totalD}</span>
        </div>

        <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-indigo-600">Magang (M)</span>
          <span className="text-xl font-extrabold text-indigo-700 mt-0.5">{classKpi.totalM}</span>
        </div>
      </div>

      {/* 5. Matriks Rekap Presensi Siswa (Full Width) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-base">
                Matriks Rekap Presensi Siswa: {activeKelas?.namaKelas}
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                {filteredAgendas.length} Pertemuan
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik kolom <strong>P1, P2, dst</strong> atau sel status untuk membuka rincian lengkap materi & kehadiran per siswa pada pertemuan tersebut.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Ekspor Seluruh Nilai Matriks ke File Excel Lengkap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Tampilan Siap Cetak / Bagikan"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Bagikan Rekap</span>
            </button>
          </div>
        </div>

          {/* Legend / Keterangan Warna */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs text-slate-600">
            <span className="font-bold text-slate-700 text-[11px]">Keterangan:</span>
            <div className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                H
              </span>
              <span className="text-[11px]">Hadir</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center">
                S
              </span>
              <span className="text-[11px]">Sakit</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 font-bold text-[10px] flex items-center justify-center">
                I
              </span>
              <span className="text-[11px]">Ijin</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px] flex items-center justify-center">
                A
              </span>
              <span className="text-[11px]">Alpa</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 font-bold text-[10px] flex items-center justify-center">
                D
              </span>
              <span className="text-[11px]">Dispen</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center justify-center">
                M
              </span>
              <span className="text-[11px]">Magang / PKL</span>
            </div>
          </div>

          {/* Matrix Table with Sticky Columns */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[720px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-slate-50 text-slate-600 shadow-2xs">
                <tr className="border-b border-slate-200/80">
                  <th className="p-3 pl-4 whitespace-nowrap bg-slate-50 sticky left-0 z-30 min-w-[45px]">
                    No
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[190px] bg-slate-50 sticky left-[45px] z-30 shadow-r">
                    Nama Siswa
                  </th>

                  {/* Column for each meeting - Clickable with detail info */}
                  {filteredAgendas.map(ag => {
                    const stats = getMeetingStats(ag);
                    return (
                      <th
                        key={ag.id}
                        onClick={() => {
                          setSelectedAgendaDetail(ag);
                          setModalFilter('all');
                          setModalSearch('');
                        }}
                        className="p-2 text-center whitespace-nowrap min-w-[70px] border-l border-slate-200/60 cursor-pointer hover:bg-indigo-50/90 transition-all group select-none relative"
                        title={`Pertemuan ${ag.pertemuanKe} (${formatDateFull(ag.tanggal)})\nMapel: ${ag.mapel || '-'}\nMateri: ${ag.materi}\nHadir: ${stats.hadir}/${stats.total} (${stats.persen}%)\n\n👉 Klik untuk melihat rincian materi & presensi lengkap pertemuan ini.`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-extrabold text-slate-800 text-[11px] group-hover:text-indigo-600 transition-colors">
                            P{ag.pertemuanKe}
                          </span>
                          <Eye className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                        </div>
                        <div className="text-[9px] font-medium text-slate-400 group-hover:text-indigo-600 mt-0.5">
                          {formatDateShort(ag.tanggal)}
                        </div>
                        <div className="mt-1 flex items-center justify-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold group-hover:scale-105 transition-transform ${
                              stats.hadir === stats.total
                                ? 'bg-emerald-100 text-emerald-800'
                                : stats.alpa > 0
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {stats.hadir}/{stats.total}
                          </span>
                        </div>
                      </th>
                    );
                  })}

                  {/* Summary Columns on right */}
                  <th className="p-2 text-center whitespace-nowrap bg-emerald-50/70 font-bold text-emerald-800 min-w-[40px] border-l border-slate-200">
                    H
                  </th>
                  <th className="p-2 text-center whitespace-nowrap bg-amber-50/70 font-bold text-amber-800 min-w-[40px]">
                    S
                  </th>
                  <th className="p-2 text-center whitespace-nowrap bg-sky-50/70 font-bold text-sky-800 min-w-[40px]">
                    I
                  </th>
                  <th className="p-2 text-center whitespace-nowrap bg-rose-50/70 font-bold text-rose-800 min-w-[40px]">
                    A
                  </th>
                  <th className="p-2 text-center whitespace-nowrap bg-purple-50/70 font-bold text-purple-800 min-w-[40px]">
                    D
                  </th>
                  <th className="p-2 text-center whitespace-nowrap bg-indigo-50/70 font-bold text-indigo-800 min-w-[40px]">
                    M
                  </th>
                  <th className="p-3 text-center whitespace-nowrap bg-indigo-50/70 font-bold text-indigo-950 min-w-[68px]">
                    % Hadir
                  </th>
                  <th className="p-3 text-center pr-4 whitespace-nowrap font-bold text-slate-700 min-w-[95px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayedStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10 + filteredAgendas.length}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      {searchStudent
                        ? `Tidak ada siswa dengan kata kunci "${searchStudent}"`
                        : 'Belum ada siswa di kelas ini.'}
                    </td>
                  </tr>
                ) : (
                  displayedStudents.map((s, idx) => {
                    const st = studentStats.get(s.id) || {
                      hadir: 0,
                      sakit: 0,
                      ijin: 0,
                      alpa: 0,
                      dispen: 0,
                      magang: 0,
                      totalPertemuan: 0,
                      persenHadir: 100,
                    };

                    const isPerfect = st.persenHadir === 100 && st.sakit === 0 && st.ijin === 0 && st.alpa === 0 && st.dispen === 0 && st.magang === 0;

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* No */}
                        <td className="p-3 pl-4 whitespace-nowrap text-slate-500 font-medium bg-white group-hover:bg-slate-50/80 sticky left-0 z-10">
                          {idx + 1}
                        </td>

                        {/* Nama Siswa */}
                        <td className="p-3 whitespace-nowrap font-bold text-slate-800 bg-white group-hover:bg-slate-50/80 sticky left-[45px] z-10 shadow-r">
                          <div className="flex items-center gap-1.5">
                            <span>{s.nama}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({s.jenisKelamin || 'L'})
                            </span>
                          </div>
                          {s.nis && (
                            <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                              NIS: {s.nis}
                            </div>
                          )}
                        </td>

                        {/* Each Meeting Status Cell - Clickable to open meeting detail */}
                        {filteredAgendas.map(ag => {
                          const { status, keterangan } = getPresensiStatus(ag, s.id);
                          return (
                            <td
                              key={ag.id}
                              onClick={() => {
                                setSelectedAgendaDetail(ag);
                                setModalFilter('all');
                                setModalSearch('');
                              }}
                              className="p-1.5 text-center whitespace-nowrap border-l border-slate-100 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                              title={`${s.nama} • P${ag.pertemuanKe} (${formatDateShort(ag.tanggal)}): ${status.toUpperCase()}${keterangan ? ' - ' + keterangan : ''}\n👉 Klik untuk rincian pertemuan.`}
                            >
                              <div className="flex items-center justify-center">
                                {renderStatusBadge(status, keterangan)}
                              </div>
                            </td>
                          );
                        })}

                        {/* Totals Columns */}
                        <td className="p-2 text-center whitespace-nowrap font-bold text-emerald-700 bg-emerald-50/20 border-l border-slate-100">
                          {st.hadir}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap font-bold text-amber-700 bg-amber-50/20">
                          {st.sakit > 0 ? (
                            <span className="text-amber-700">{st.sakit}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap font-bold text-sky-700 bg-sky-50/20">
                          {st.ijin > 0 ? (
                            <span className="text-sky-700">{st.ijin}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap font-extrabold text-rose-600 bg-rose-50/20">
                          {st.alpa > 0 ? (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                              {st.alpa}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap font-bold text-purple-700 bg-purple-50/20">
                          {st.dispen > 0 ? (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-md font-bold">
                              {st.dispen}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap font-bold text-indigo-700 bg-indigo-50/20">
                          {st.magang > 0 ? (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-bold">
                              {st.magang}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Percent Attendance */}
                        <td className="p-3 text-center whitespace-nowrap font-extrabold bg-indigo-50/30 text-indigo-900">
                          {st.persenHadir}%
                        </td>

                        {/* Status Badge */}
                        <td className="p-3 text-center pr-4 whitespace-nowrap">
                          {st.persenHadir >= 95 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sangat Baik</span>
                            </span>
                          ) : st.persenHadir >= 80 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md font-bold text-[10px]">
                              <span>Baik</span>
                            </span>
                          ) : st.persenHadir >= 75 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px]">
                              <span>Cukup</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-extrabold text-[10px]">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>Perlu Perhatian</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* 6. Modal Detail Pertemuan Presensi (P1, P2, dst) */}
      {selectedAgendaDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-extrabold text-xs border border-indigo-200">
                    Pertemuan Ke-{selectedAgendaDetail.pertemuanKe}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {formatDateFull(selectedAgendaDetail.tanggal)}
                  </span>
                  {selectedAgendaDetail.mapel && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {selectedAgendaDetail.mapel}
                    </span>
                  )}
                  {selectedAgendaDetail.jamKe && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px]">
                      Jam: {selectedAgendaDetail.jamKe}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-800 text-base mt-1.5 leading-snug">
                  {selectedAgendaDetail.materi || 'Materi Pembelajaran'}
                </h3>
                {selectedAgendaDetail.kegiatanPembelajaran && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">
                    "{selectedAgendaDetail.kegiatanPembelajaran}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onEditAgenda && (
                  <button
                    type="button"
                    onClick={() => {
                      const ag = selectedAgendaDetail;
                      setSelectedAgendaDetail(null);
                      onEditAgenda(ag);
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Edit Agenda & Presensi Pertemuan Ini"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Agenda</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedAgendaDetail(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Attendance Mini Stats Breakdown */}
            {selectedAgendaStats && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="bg-white p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 block">Hadir</span>
                  <span className="text-sm font-extrabold text-emerald-600">
                    {selectedAgendaStats.hadir}/{selectedAgendaStats.total}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 block">Sakit</span>
                  <span className="text-sm font-extrabold text-amber-600">
                    {selectedAgendaStats.sakit}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 block">Izin</span>
                  <span className="text-sm font-extrabold text-sky-600">
                    {selectedAgendaStats.ijin}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 block">Alpa</span>
                  <span className="text-sm font-extrabold text-rose-600">
                    {selectedAgendaStats.alpa}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 block">Dispen</span>
                  <span className="text-sm font-extrabold text-indigo-600">
                    {selectedAgendaStats.dispen}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 block">Kehadiran</span>
                  <span className="text-sm font-extrabold text-indigo-900">
                    {selectedAgendaStats.persen}%
                  </span>
                </div>
              </div>
            )}

            {/* Filter Tabs & Search in Modal */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setModalFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    modalFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({activeSiswa.length})
                </button>
                <button
                  onClick={() => setModalFilter('absent')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    modalFilter === 'absent'
                      ? 'bg-rose-500 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-rose-600'
                  }`}
                >
                  Tidak Hadir (
                  {activeSiswa.length -
                    (selectedAgendaStats?.hadir || 0) -
                    (selectedAgendaStats?.magang || 0)}
                  )
                </button>
                <button
                  onClick={() => setModalFilter('hadir')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    modalFilter === 'hadir'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Hadir ({selectedAgendaStats?.hadir || 0})
                </button>
              </div>

              <div className="relative flex-1 sm:max-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder="Cari siswa..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-indigo-500"
                />
              </div>
            </div>

            {/* Attendance breakdown student list in modal */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1 max-h-[380px]">
              {modalStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Tidak ada data siswa yang cocok dengan filter.
                </div>
              ) : (
                modalStudents.map((s, idx) => {
                  const { status, keterangan } = getPresensiStatus(selectedAgendaDetail, s.id);
                  return (
                    <div
                      key={s.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-[11px] w-5 text-right font-medium">
                          {idx + 1}.
                        </span>
                        <div>
                          <div className="font-bold text-slate-800">{s.nama}</div>
                          <div className="text-[10px] text-slate-400">
                            NIS: {s.nis || '-'} • {s.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-right">
                        {keterangan && (
                          <span
                            className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md italic max-w-[200px] truncate"
                            title={keterangan}
                          >
                            "{keterangan}"
                          </span>
                        )}
                        {renderStatusBadge(status, keterangan)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopyMeetingShare}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Salin Rincian Presensi Pertemuan ini ke WhatsApp"
                >
                  {modalCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Salin Ringkasan WA</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleOpenMeetingWhatsApp}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Buka Langsung di WhatsApp Web / App"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Kirim ke WhatsApp</span>
                </button>

                {onOpenAgendaDetail && (
                  <button
                    onClick={() => {
                      const ag = selectedAgendaDetail;
                      setSelectedAgendaDetail(null);
                      onOpenAgendaDetail(ag);
                    }}
                    className="px-3 py-2 text-slate-500 hover:text-indigo-600 text-xs font-semibold cursor-pointer"
                  >
                    Buka di Jurnal Mengajar →
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedAgendaDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Bagikan & Cetak Rekap Presensi */}
      <ShareablePresensiModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        activeKelas={activeKelas}
        siswaList={activeSiswa}
        agendas={filteredAgendas}
        profile={profile}
        filterDescription={filterDescription}
      />
    </div>
  );
};
