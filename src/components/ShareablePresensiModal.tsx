import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Share2,
  Printer,
  Copy,
  Check,
  Download,
  X,
  Users,
  Send,
  UserCheck,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  FileText,
  Loader2,
  Camera,
} from 'lucide-react';
import { Kelas, Siswa, AgendaMengajar, TeacherProfile, PresensiStatus } from '../types';
import {
  captureElementToCanvas,
  downloadCanvasAsPng,
  copyCanvasToClipboard,
} from '../utils/screenshotUtils';

interface ShareablePresensiModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeKelas: Kelas;
  siswaList: Siswa[];
  agendas: AgendaMengajar[];
  profile: TeacherProfile;
  filterDescription?: string;
  kelasList?: Kelas[];
  onSelectKelas?: (kelas: Kelas) => void;
}

// Ultra-reliable clipboard helper with multiple fallbacks for iframes & secure/insecure contexts
export const copyToClipboardSafe = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to fallback
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
};

export const formatCityName = (alamat?: string, namaSekolah?: string): string => {
  const combined = `${alamat || ''} ${namaSekolah || ''}`;
  if (/Magelang/i.test(combined)) {
    return 'Magelang';
  }
  if (!alamat) return 'Magelang';

  const matchKota = alamat.match(/(?:Kota|Kabupaten|Kab\.)\s+([A-Za-z\s]+?)(?:,|$|\.)/i);
  if (matchKota && matchKota[1]?.trim()) {
    return matchKota[1].trim();
  }

  const parts = alamat.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    const cleaned = lastPart.replace(/^(Kota|Kabupaten|Kab\.)\s+/i, '').replace(/\b\d{5}\b/g, '').trim();
    if (cleaned.length > 1) {
      return cleaned;
    }
  }

  return 'Magelang';
};

export const ShareablePresensiModal: React.FC<ShareablePresensiModalProps> = ({
  isOpen,
  onClose,
  activeKelas,
  siswaList,
  agendas,
  profile,
  filterDescription,
  kelasList,
  onSelectKelas,
}) => {
  const [activeTab, setActiveTab] = useState<'card' | 'whatsapp' | 'individual'>('card');
  const [copiedWA, setCopiedWA] = useState<boolean>(false);
  const [copiedIndividualWA, setCopiedIndividualWA] = useState<boolean>(false);
  const [filterAttendance, setFilterAttendance] = useState<'all' | 'perfect' | 'has_absence'>('all');
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>(siswaList[0]?.id || '');
  const [nomorHpOrtu, setNomorHpOrtu] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState<boolean>(false);
  const [copiedScreenshot, setCopiedScreenshot] = useState<boolean>(false);

  // Filter students for the active class and sort alphabetically
  const classSiswa = useMemo(() => {
    return siswaList
      .filter(s => s.kelasId === activeKelas.id)
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [siswaList, activeKelas.id]);

  // Ensure selected student is valid
  const currentSiswa = useMemo(() => {
    return classSiswa.find(s => s.id === selectedSiswaId) || classSiswa[0] || null;
  }, [classSiswa, selectedSiswaId]);

  // Helper to extract presensi status from an agenda
  const getPresensiStatus = (agenda: AgendaMengajar, siswaId: string) => {
    const item = (agenda.presensi || []).find(p => p.siswaId === siswaId);
    if (!item) {
      return { status: 'hadir' as PresensiStatus, keterangan: '' };
    }
    return {
      status: item.status || 'hadir',
      keterangan: item.keterangan || '',
    };
  };

  // Student Attendance Statistics
  const studentStats = useMemo(() => {
    return classSiswa.map(s => {
      let h = 0;
      let sk = 0;
      let ij = 0;
      let al = 0;
      let dp = 0;
      let mg = 0;

      const absenceDetails: Array<{
        pertemuanKe: number;
        tanggal: string;
        materi: string;
        status: PresensiStatus;
        keterangan: string;
      }> = [];

      agendas.forEach(ag => {
        const { status, keterangan } = getPresensiStatus(ag, s.id);
        if (status === 'hadir') h++;
        else if (status === 'sakit') {
          sk++;
          absenceDetails.push({ pertemuanKe: ag.pertemuanKe, tanggal: ag.tanggal, materi: ag.materi, status, keterangan });
        } else if (status === 'ijin') {
          ij++;
          absenceDetails.push({ pertemuanKe: ag.pertemuanKe, tanggal: ag.tanggal, materi: ag.materi, status, keterangan });
        } else if (status === 'alpa') {
          al++;
          absenceDetails.push({ pertemuanKe: ag.pertemuanKe, tanggal: ag.tanggal, materi: ag.materi, status, keterangan });
        } else if (status === 'dispen') {
          dp++;
          absenceDetails.push({ pertemuanKe: ag.pertemuanKe, tanggal: ag.tanggal, materi: ag.materi, status, keterangan });
        } else if (status === 'magang') {
          mg++;
          absenceDetails.push({ pertemuanKe: ag.pertemuanKe, tanggal: ag.tanggal, materi: ag.materi, status, keterangan });
        } else {
          h++;
        }
      });

      const total = agendas.length;
      // Dispen dimasukkan tidak ikut tatap muka kelas, sehingga % Hadir murni tatap muka kelas
      const persenHadir = total > 0 ? Math.round((h / total) * 100) : 100;
      const isPerfect = sk === 0 && ij === 0 && al === 0 && dp === 0 && mg === 0;

      return {
        siswa: s,
        hadir: h,
        sakit: sk,
        ijin: ij,
        alpa: al,
        dispen: dp,
        magang: mg,
        totalPertemuan: total,
        persenHadir,
        isPerfect,
        absenceDetails,
      };
    });
  }, [classSiswa, agendas]);

  // Overall class summary statistics
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

    const totalEntries = studentStats.length * (agendas.length || 1);
    const overallRate = totalEntries > 0 ? Math.round((totalH / totalEntries) * 100) : 100;
    const perfectCount = studentStats.filter(st => st.isPerfect).length;

    return {
      totalH,
      totalS,
      totalI,
      totalA,
      totalD,
      totalM,
      overallRate,
      perfectCount,
      totalStudents: studentStats.length,
      totalMeetings: agendas.length,
    };
  }, [studentStats, agendas]);

  // Filtered students for display in printable card table
  const displayedStudents = useMemo(() => {
    return studentStats.filter(st => {
      if (filterAttendance === 'perfect') return st.isPerfect;
      if (filterAttendance === 'has_absence') return !st.isPerfect;
      return true;
    });
  }, [studentStats, filterAttendance]);

  // Generate WhatsApp formatted text for whole class
  const generateWhatsAppMessage = () => {
    let msg = `📢 *LAPORAN REKAPITULASI PRESENSI SISWA* 📢\n\n`;
    msg += `🏫 *Sekolah*       : ${profile.namaSekolah || 'Sekolah'}\n`;
    msg += `👥 *Kelas*          : ${activeKelas.namaKelas}\n`;
    msg += `📚 *Mata Pelajaran* : ${profile.mapelUtama || 'Mata Pelajaran'}\n`;
    msg += `📅 *Periode*        : ${filterDescription || 'Semua Pertemuan'}\n`;
    msg += `🗓️ *Total Pertemuan*: ${agendas.length} Kali Tatap Muka\n`;
    msg += `👥 *Jumlah Siswa*   : ${classSiswa.length} Siswa\n\n`;

    msg += `📊 *RINGKASAN KEHADIRAN KELAS:*\n`;
    msg += `• Rata-rata Kehadiran : *${classKpi.overallRate}%*\n`;
    msg += `• Total Hadir (H)     : ${classKpi.totalH}\n`;
    msg += `• Total Sakit (S)     : ${classKpi.totalS}\n`;
    msg += `• Total Izin (I)      : ${classKpi.totalI}\n`;
    msg += `• Total Alpa (A)      : ${classKpi.totalA}\n`;
    if (classKpi.totalD > 0) msg += `• Total Dispen (D)    : ${classKpi.totalD}\n`;
    if (classKpi.totalM > 0) msg += `• Total Magang (M)    : ${classKpi.totalM}\n`;
    msg += `• Siswa Hadir 100%    : *${classKpi.perfectCount}* dari ${classKpi.totalStudents} siswa\n\n`;

    const unperfectStudents = studentStats.filter(st => !st.isPerfect);
    if (unperfectStudents.length === 0) {
      msg += `🌟 *CATATAN KEHADIRAN:*\n`;
      msg += `_Alhamdulillah, seluruh siswa kelas ${activeKelas.namaKelas} hadir 100% pada periode ini._ ✨\n\n`;
    } else {
      msg += `⚠️ *DAFTAR SISWA DENGAN CATATAN KETIDAKHADIRAN:*\n`;
      unperfectStudents.forEach((st, i) => {
        const notes = [];
        if (st.sakit > 0) notes.push(`${st.sakit}S`);
        if (st.ijin > 0) notes.push(`${st.ijin}I`);
        if (st.alpa > 0) notes.push(`${st.alpa}A`);
        if (st.dispen > 0) notes.push(`${st.dispen}D`);
        if (st.magang > 0) notes.push(`${st.magang}M`);
        msg += `${i + 1}. *${st.siswa.nama}* [${notes.join(', ')}] ➔ Hadir: *${st.persenHadir}%*\n`;
      });
      msg += `\n`;
    }

    msg += `💬 *Catatan Guru:*\n`;
    msg += `Bagi siswa yang berhalangan hadir atau memiliki catatan alpa/sakit, dimohon untuk tetap melengkapi catatan materi dan tugas pembelajaran. Terima kasih atas kerja sama Bapak/Ibu Wali Siswa. 🙏\n\n`;
    msg += `_Guru Mata Pelajaran:_\n*${profile.namaGuru}*\n${profile.nip?.length >= 18 ? 'NIPPPK' : 'NIP'}: ${profile.nip || '-'}`;

    return msg;
  };

  // Generate Individual WhatsApp Message for Single Student (to Parents)
  const currentStudentStats = useMemo(() => {
    if (!currentSiswa) return null;
    return studentStats.find(st => st.siswa.id === currentSiswa.id) || null;
  }, [currentSiswa, studentStats]);

  const generateIndividualWhatsApp = () => {
    if (!currentSiswa || !currentStudentStats) return '';
    let msg = `📄 *LAPORAN REKAPITULASI KEHADIRAN SISWA*\n\n`;
    msg += `Yth. Bapak/Ibu Orang Tua / Wali dari ananda:\n`;
    msg += `👤 *Nama Siswa*   : *${currentSiswa.nama}*\n`;
    msg += `🆔 *NIS / NISN*    : ${currentSiswa.nis || currentSiswa.nisn || '-'}\n`;
    msg += `🏫 *Kelas*         : ${activeKelas.namaKelas}\n`;
    msg += `📚 *Mata Pelajaran*: ${profile.mapelUtama || 'Mata Pelajaran'}\n`;
    msg += `📅 *Periode*       : ${filterDescription || 'Semua Pertemuan'}\n\n`;

    msg += `📊 *Rincian Kehadiran Ananda:*\n`;
    msg += `• Total Tatap Muka : ${currentStudentStats.totalPertemuan} Pertemuan\n`;
    msg += `• Tingkat Kehadiran: *${currentStudentStats.persenHadir}%*\n`;
    msg += `• Jumlah Hadir     : ${currentStudentStats.hadir} kali\n`;
    msg += `• Sakit (S)        : ${currentStudentStats.sakit} kali\n`;
    msg += `• Izin (I)         : ${currentStudentStats.ijin} kali\n`;
    msg += `• Alpa / Tanpa Ket.: ${currentStudentStats.alpa} kali\n`;
    if (currentStudentStats.dispen > 0) msg += `• Dispensasi (D)   : ${currentStudentStats.dispen} kali\n`;
    if (currentStudentStats.magang > 0) msg += `• Magang / PKL (M) : ${currentStudentStats.magang} kali\n`;

    if (currentStudentStats.absenceDetails.length > 0) {
      msg += `\n📋 *Riwayat Ketidakhadiran:*\n`;
      currentStudentStats.absenceDetails.forEach(dt => {
        const statusLabel =
          dt.status === 'sakit'
            ? 'Sakit'
            : dt.status === 'ijin'
            ? 'Izin'
            : dt.status === 'alpa'
            ? 'Alpa'
            : dt.status === 'dispen'
            ? 'Dispensasi'
            : 'Magang / PKL';
        msg += `• P${dt.pertemuanKe} (${dt.tanggal}): [${statusLabel}]${dt.keterangan ? ` - "${dt.keterangan}"` : ''}\n`;
      });
    }

    msg += `\n`;
    if (currentStudentStats.isPerfect) {
      msg += `✨ *Apresiasi:* Terima kasih atas kedisiplinan ananda yang senantiasa hadir tepat waktu dan aktif dalam proses pembelajaran. Pertahankan semangat belajarnya! 🌟\n\n`;
    } else if (currentStudentStats.alpa > 0) {
      msg += `⚠️ *Perhatian:* Mohon bantuan dan kerja sama Bapak/Ibu untuk memantau kehadiran ananda agar tidak tertinggal materi dan tetap memenuhi standar kehadiran sekolah. 🙏\n\n`;
    } else {
      msg += `💬 *Pemberitahuan:* Demikian laporan kehadiran ananda kami sampaikan sebagai sarana komunikasi antara pihak sekolah dan orang tua di rumah. 🙏\n\n`;
    }

    msg += `Salam hormat,\n*${profile.namaGuru}*\n_${profile.namaSekolah}_`;
    return msg;
  };

  // Actions
  const handleCopyWhatsApp = async () => {
    const text = generateWhatsAppMessage();
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2500);
    }
  };

  const handleOpenWhatsAppWeb = () => {
    const text = encodeURIComponent(generateWhatsAppMessage());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    const text = generateWhatsAppMessage();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rekap Presensi ${activeKelas.namaKelas}`,
          text: text,
        });
      } catch {
        // Ignored or cancelled by user
      }
    } else {
      handleOpenWhatsAppWeb();
    }
  };

  const handleCopyIndividualWA = async () => {
    const text = generateIndividualWhatsApp();
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setCopiedIndividualWA(true);
      setTimeout(() => setCopiedIndividualWA(false), 2500);
    }
  };

  const handleSendIndividualWhatsApp = () => {
    const text = encodeURIComponent(generateIndividualWhatsApp());
    const cleanPhone = nomorHpOrtu.replace(/[^0-9]/g, '');
    let phoneParam = '';
    if (cleanPhone) {
      // Convert Indonesian 08xx to 628xx
      phoneParam = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;
    }
    const url = phoneParam
      ? `https://api.whatsapp.com/send?phone=${phoneParam}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
  };

  // Export Excel (.xlsx) with all attendance records
  const handleExportExcel = () => {
    const rows = studentStats.map((st, i) => {
      const rowData: Record<string, any> = {
        No: i + 1,
        NIS: st.siswa.nis || '',
        NISN: st.siswa.nisn || '',
        'Nama Siswa': st.siswa.nama,
        'Jenis Kelamin': st.siswa.jenisKelamin,
      };

      // Add each meeting status as a column
      agendas.forEach(ag => {
        const { status } = getPresensiStatus(ag, st.siswa.id);
        const colTitle = `P${ag.pertemuanKe} (${ag.tanggal})`;
        rowData[colTitle] =
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
            : 'M';
      });

      rowData['Total Hadir (H)'] = st.hadir;
      rowData['Total Sakit (S)'] = st.sakit;
      rowData['Total Izin (I)'] = st.ijin;
      rowData['Total Alpa (A)'] = st.alpa;
      rowData['Total Dispen (D)'] = st.dispen;
      rowData['Total Magang (M)'] = st.magang;
      rowData['% Kehadiran'] = `${st.persenHadir}%`;
      rowData['Keterangan'] = st.isPerfect ? 'Hadir 100%' : st.alpa > 0 ? 'Perlu Perhatian' : 'Tertib';

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap_Presensi');

    const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Rekap_Presensi_${safeKelas}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const isLandscape = agendas.length > 4;
      const orientation = isLandscape ? 'landscape' : 'portrait';
      const doc = new jsPDF(orientation, 'mm', 'a4');
      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;

      // School Kop Surat Header
      const schoolName = (profile.namaSekolah || 'SMK NEGERI 2 MAGELANG').toUpperCase();
      const schoolAddress = profile.alamatSekolah || 'Jl. A Yani 135A Magelang Utara, Kota Magelang';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(schoolName, 14, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(schoolAddress, 14, 19);

      // Total info & Date on right
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(67, 56, 202);
      doc.text(`${agendas.length} PERTEMUAN`, pageWidth - 14, 14, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(todayStr, pageWidth - 14, 19, { align: 'right' });

      // Double divider line
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.7);
      doc.line(14, 22.5, pageWidth - 14, 22.5);
      doc.setLineWidth(0.2);
      doc.line(14, 23.5, pageWidth - 14, 23.5);

      // Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('LAPORAN REKAPITULASI PRESENSI KEHADIRAN SISWA', pageWidth / 2, 30, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(79, 70, 229);
      doc.text(`Kelas ${activeKelas.namaKelas}`, pageWidth / 2, 34.5, { align: 'center' });

      // Metadata Info Box
      const tahunAjaran = profile.tahunAjaran || activeKelas.tahunAjaran || '2025/2026';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const metaY = 39.5;
      doc.text(`Mata Pelajaran : ${profile.mapelUtama || 'Pemrograman Web'}`, 14, metaY);
      doc.text(`Kelas          : ${activeKelas.namaKelas}`, 14, metaY + 4);
      doc.text(`Tahun Ajaran   : ${tahunAjaran}`, (pageWidth / 2) - 10, metaY);
      doc.text(`Filter Presensi: ${filterAttendance === 'all' ? 'Semua Siswa' : filterAttendance === 'perfect' ? 'Kehadiran 100%' : 'Ada Izin/Sakit/Alpa'} (${displayedStudents.length} Siswa)`, (pageWidth / 2) - 10, metaY + 4);

      // Statistics Banner
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, metaY + 7, pageWidth - 28, 8, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      const statText = `Rata-rata Kehadiran: ${classKpi.overallRate}%  |  Siswa 100% Hadir: ${classKpi.perfectCount}  |  Total Alpa: ${classKpi.totalAlpa}  |  Total Sakit/Izin: ${classKpi.totalSakit + classKpi.totalIjin}`;
      doc.text(statText, pageWidth / 2, metaY + 12.2, { align: 'center' });

      // Build table
      const headerRow = ['No', 'NIS', 'Nama Siswa'];
      agendas.forEach(ag => {
        headerRow.push(`P${ag.pertemuanKe}`);
      });
      headerRow.push('H', 'S', 'I', 'A', 'D', 'M', '% Hadir');

      const body = displayedStudents.map((st, idx) => {
        const row: (string | number)[] = [
          idx + 1,
          st.siswa.nis || '-',
          st.siswa.nama
        ];
        agendas.forEach(ag => {
          const { status } = getPresensiStatus(ag, st.siswa.id);
          const code = status === 'hadir' ? 'H' : status === 'sakit' ? 'S' : status === 'ijin' ? 'I' : status === 'alpa' ? 'A' : status === 'dispen' ? 'D' : 'M';
          row.push(code);
        });
        row.push(st.hadir, st.sakit, st.ijin, st.alpa, st.dispen, st.magang, `${st.persenHadir}%`);
        return row;
      });

      autoTable(doc, {
        startY: metaY + 17,
        head: [headerRow],
        body,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 27, 75],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: isLandscape ? 7 : 7.5,
          halign: 'center',
          valign: 'middle',
          cellPadding: 1.8,
        },
        styles: {
          fontSize: isLandscape ? 6.5 : 7,
          cellPadding: 1.6,
          valign: 'middle',
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'center', cellWidth: isLandscape ? 16 : 18 },
          2: { halign: 'left', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.column.index !== 2 && data.section === 'body') {
            data.cell.styles.halign = 'center';
          }
          if (data.section === 'body' && typeof data.cell.raw === 'string') {
            if (data.cell.raw === 'A') {
              data.cell.styles.textColor = [190, 18, 60];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'H' || data.cell.raw === '100%') {
              data.cell.styles.textColor = [5, 150, 105];
            }
          }
        },
        didDrawPage: () => {
          const str = `Halaman ${doc.getNumberOfPages()}`;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(str, pageWidth - 14, isLandscape ? 203 : 290, { align: 'right' });
          doc.text(`Dicetak melalui Sistem Agenda & Penilaian Guru`, 14, isLandscape ? 203 : 290);
        }
      });

      // Signature section on the last page
      const finalY = (doc as any).lastAutoTable?.finalY || 140;
      let signY = finalY + 10;
      if (signY + 28 > pageHeight - 14) {
        doc.addPage();
        signY = 22;
      }

      const signX = pageWidth - 65;
      const cityName = formatCityName(profile.alamatSekolah, profile.namaSekolah);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`${cityName}, ${todayStr}`, signX, signY);
      doc.text('Guru Mata Pelajaran,', signX, signY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(profile.namaGuru || 'Ahmad, S.Kom', signX, signY + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`NIP. ${profile.nipGuru || '-'}`, signX, signY + 24);

      const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Rekap_Presensi_${safeKelas}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating Presensi PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    try {
      const printableElement = document.getElementById('printable-presensi-card');
      if (!printableElement) {
        window.print();
        return;
      }

      let printFrame = document.getElementById('print-presensi-sandbox-frame') as HTMLIFrameElement | null;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'print-presensi-sandbox-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow?.document;
      if (!frameDoc) {
        handleDownloadPdf();
        return;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Rekap Presensi - ${activeKelas.namaKelas}</title>
            ${styles}
            <style>
              body { background: white !important; padding: 20px; font-family: system-ui, sans-serif; }
              @page { size: auto; margin: 10mm; }
              .no-print { display: none !important; }
            </style>
          </head>
          <body>
            ${printableElement.outerHTML}
          </body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame?.contentWindow?.focus();
          printFrame?.contentWindow?.print();
        } catch {
          handleDownloadPdf();
        }
      }, 400);
    } catch {
      handleDownloadPdf();
    }
  };

  // Capture Presensi Card as Image (Download or Copy to Clipboard)
  const handleCapturePresensiScreenshot = async (mode: 'download' | 'copy') => {
    const el = document.getElementById('printable-presensi-card');
    if (!el) return;
    setIsCapturingScreenshot(true);
    try {
      const cleanKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Rekap_Presensi_${cleanKelas}_${new Date().toISOString().split('T')[0]}.png`;
      const canvas = await captureElementToCanvas(el, { scale: 2 });
      if (mode === 'download') {
        downloadCanvasAsPng(canvas, filename);
      } else {
        const ok = await copyCanvasToClipboard(canvas);
        if (ok) {
          setCopiedScreenshot(true);
          setTimeout(() => setCopiedScreenshot(false), 2500);
        } else {
          downloadCanvasAsPng(canvas, filename);
        }
      }
    } catch (err) {
      console.error('Error capturing presensi screenshot:', err);
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Styles for isolated print formatting */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-presensi-card, #printable-presensi-card * {
            visibility: visible;
          }
          #printable-presensi-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 p-5 text-white flex items-center justify-between shrink-0 no-print">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
              <Share2 className="w-4 h-4 text-amber-400" />
              <span>Pusat Berbagi & Laporan Rekap Presensi</span>
            </div>
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <span>{activeKelas.namaKelas} — {filterDescription || 'Rekapitulasi Presensi'}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Navigation Tabs */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl self-start">
              <button
                onClick={() => setActiveTab('card')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'card'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Dokumen Cetak & Ringkasan</span>
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Format WhatsApp Kelas</span>
              </button>
              <button
                onClick={() => setActiveTab('individual')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'individual'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Slip Per Siswa (Orang Tua)</span>
              </button>
            </div>

            {/* Optional Class Picker */}
            {kelasList && kelasList.length > 1 && onSelectKelas && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pl-1">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Kelas:</span>
                {kelasList.map(k => (
                  <button
                    key={k.id}
                    onClick={() => onSelectKelas(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      k.id === activeKelas.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {k.namaKelas}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-700">{agendas.length}</span> Pertemuan • <span className="font-bold text-slate-700">{classSiswa.length}</span> Siswa
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: CARD & PRINTABLE REPORT */}
          {activeTab === 'card' && (
            <div className="space-y-6">
              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 no-print">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-400 mr-1">Tampilkan:</span>
                  <button
                    onClick={() => setFilterAttendance('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      filterAttendance === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({classKpi.totalStudents})
                  </button>
                  <button
                    onClick={() => setFilterAttendance('perfect')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      filterAttendance === 'perfect'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Hadir 100% ({classKpi.perfectCount})
                  </button>
                  <button
                    onClick={() => setFilterAttendance('has_absence')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      filterAttendance === 'has_absence'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Ada Izin/Sakit/Alpa ({classKpi.totalStudents - classKpi.perfectCount})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleCapturePresensiScreenshot('copy')}
                    disabled={isCapturingScreenshot}
                    className={`px-3 py-2 rounded-xl text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all ${
                      copiedScreenshot
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    title="Salin gambar rekap presensi langsung ke clipboard untuk ditempel di WhatsApp"
                  >
                    {copiedScreenshot ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tersalin ke WA!</span>
                      </>
                    ) : isCapturingScreenshot ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyalin...</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin ke WA</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleCapturePresensiScreenshot('download')}
                    disabled={isCapturingScreenshot}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-60"
                    title="Simpan rekap presensi sebagai file gambar .png"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Screenshot PNG</span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all"
                    title="Download file Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isExportingPdf}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-60"
                    title="Download dokumen PDF resmi (.pdf)"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Membuat PDF...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all"
                    title="Cetak langsung ke printer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak</span>
                  </button>
                </div>
              </div>

              {/* Printable Document Container */}
              <div
                id="printable-presensi-card"
                className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6 print:p-0 print:border-0 print:shadow-none"
              >
                {/* School Header Kop */}
                <div className="flex items-center justify-between pb-6 border-b-2 border-slate-800">
                  <div className="space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                      {profile.namaSekolah || 'SEKOLAH INDONESIA'}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">{profile.alamatSekolah || 'Alamat Sekolah'}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 pt-1">
                      <span>Mata Pelajaran: <strong>{profile.mapelUtama || 'Mata Pelajaran'}</strong></span>
                      <span>•</span>
                      <span>Kelas: <strong>{activeKelas.namaKelas}</strong></span>
                      <span>•</span>
                      <span>Semester: <strong>{profile.semester} ({profile.tahunAjaran})</strong></span>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-xs border border-slate-200">
                      REKAP PRESENSI
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                  </div>
                </div>

                {/* KPI Metrics Highlight */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                      Rata-Rata Kehadiran
                    </span>
                    <span className="text-2xl font-black text-indigo-900 mt-0.5 block">
                      {classKpi.overallRate}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                      Hadir 100%
                    </span>
                    <span className="text-2xl font-black text-emerald-900 mt-0.5 block">
                      {classKpi.perfectCount} <span className="text-xs font-normal text-emerald-600">siswa</span>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-center">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                      Sakit / Izin
                    </span>
                    <span className="text-2xl font-black text-amber-900 mt-0.5 block">
                      {classKpi.totalS + classKpi.totalI} <span className="text-xs font-normal text-amber-600">kali</span>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100 text-center">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                      Alpa / Tanpa Ket.
                    </span>
                    <span className="text-2xl font-black text-rose-900 mt-0.5 block">
                      {classKpi.totalA} <span className="text-xs font-normal text-rose-600">kali</span>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      Total Pertemuan
                    </span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">
                      {classKpi.totalMeetings} <span className="text-xs font-normal text-slate-500">pertemuan</span>
                    </span>
                  </div>
                </div>

                {/* Student Attendance Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                        <th className="p-2.5 text-center w-10">No</th>
                        <th className="p-2.5">NIS</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5 text-center">L/P</th>
                        <th className="p-2.5 text-center text-emerald-700">H</th>
                        <th className="p-2.5 text-center text-amber-700">S</th>
                        <th className="p-2.5 text-center text-sky-700">I</th>
                        <th className="p-2.5 text-center text-rose-700">A</th>
                        <th className="p-2.5 text-center text-purple-700">D</th>
                        <th className="p-2.5 text-center text-indigo-700">M</th>
                        <th className="p-2.5 text-center bg-slate-200/60 font-black">% Hadir</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedStudents.map((st, i) => (
                        <tr key={st.siswa.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 text-center text-slate-400 font-mono">{i + 1}</td>
                          <td className="p-2.5 font-mono text-slate-500">{st.siswa.nis || '-'}</td>
                          <td className="p-2.5 font-bold text-slate-900">{st.siswa.nama}</td>
                          <td className="p-2.5 text-center text-slate-500">{st.siswa.jenisKelamin}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-700">{st.hadir}</td>
                          <td className="p-2.5 text-center text-amber-700 font-semibold">{st.sakit}</td>
                          <td className="p-2.5 text-center text-sky-700 font-semibold">{st.ijin}</td>
                          <td className="p-2.5 text-center text-rose-700 font-bold">{st.alpa}</td>
                          <td className="p-2.5 text-center text-purple-700 font-semibold">{st.dispen}</td>
                          <td className="p-2.5 text-center text-indigo-700 font-semibold">{st.magang}</td>
                          <td className="p-2.5 text-center font-black text-slate-900 bg-slate-50/50">
                            {st.persenHadir}%
                          </td>
                          <td className="p-2.5 text-center">
                            {st.isPerfect ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                100%
                              </span>
                            ) : st.alpa > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                                Alpa ({st.alpa})
                              </span>
                            ) : st.dispen > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                                Dispen ({st.dispen})
                              </span>
                            ) : st.magang > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                                Magang ({st.magang})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                {st.sakit + st.ijin} Izin/Sakit
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signatures Section */}
                <div className="pt-8 flex items-start justify-between text-xs text-slate-800">
                  <div className="text-center space-y-16">
                    <p>Mengetahui,<br />Kepala {profile.namaSekolah || 'Sekolah'}</p>
                    <div>
                      <p className="font-extrabold underline">{profile.namaKepsek || '( .......................................... )'}</p>
                      <p className="text-[10px] text-slate-500 font-mono">NIP: {profile.nipKepsek || '-'}</p>
                    </div>
                  </div>

                  <div className="text-center space-y-16">
                    <p>
                      {formatCityName(profile.alamatSekolah, profile.namaSekolah)}, {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
                      <br />Guru Mata Pelajaran
                    </p>
                    <div>
                      <p className="font-extrabold underline">{profile.namaGuru}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{profile.nip?.length >= 18 ? 'NIPPPK' : 'NIP'}: {profile.nip || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP FORMAT */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80 flex items-start gap-3">
                <Send className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 space-y-1">
                  <p className="font-bold">Format Pesan WhatsApp untuk Grup Kelas / Wali Murid</p>
                  <p className="text-emerald-700 leading-relaxed">
                    Pesan berikut telah disusun dengan rapi dan terstruktur, menyertakan ringkasan kehadiran, statistik kelas, dan catatan ketidakhadiran siswa. Siap dikirimkan ke grup WhatsApp kelas atau wali murid.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Total Karakter: <strong className="text-slate-800">{generateWhatsAppMessage().length}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyWhatsApp}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    {copiedWA ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Tersalin ke Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Pesan WA</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleOpenWhatsAppWeb}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka di WhatsApp Web / App</span>
                  </button>

                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={handleNativeShare}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Bagikan...</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-slate-900 text-emerald-300 p-5 rounded-3xl font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto select-all shadow-inner border border-slate-800">
                {generateWhatsAppMessage()}
              </div>
            </div>
          )}

          {/* TAB 3: INDIVIDUAL STUDENT SLIP (FOR PARENTS) */}
          {activeTab === 'individual' && (
            <div className="space-y-6">
              {/* Header Description & Selector */}
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>Kirim Laporan Kehadiran Khusus ke Orang Tua Siswa</span>
                  </h4>
                  <p className="text-xs text-indigo-700">
                    Pilih siswa untuk membuat pesan personal yang santun untuk dikirimkan langsung ke nomor WhatsApp orang tua/wali siswa.
                  </p>
                </div>

                {/* Student Selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Pilih Siswa:</label>
                  <select
                    value={selectedSiswaId}
                    onChange={e => setSelectedSiswaId(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[260px]"
                  >
                    {classSiswa.map(s => {
                      const st = studentStats.find(item => item.siswa.id === s.id);
                      const tag = st ? (st.isPerfect ? '✓ 100%' : `${st.persenHadir}% [${st.alpa}A/${st.sakit}S]`) : '';
                      return (
                        <option key={s.id} value={s.id}>
                          {s.nama} ({tag})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Student Overview Card */}
              {currentStudentStats && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-7 gap-2.5 text-center">
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Kehadiran</span>
                    <span className="text-xl font-black text-indigo-700 mt-0.5 block">{currentStudentStats.persenHadir}%</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-emerald-600 block uppercase">Hadir</span>
                    <span className="text-xl font-black text-emerald-700 mt-0.5 block">{currentStudentStats.hadir}x</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-amber-600 block uppercase">Sakit</span>
                    <span className="text-xl font-black text-amber-700 mt-0.5 block">{currentStudentStats.sakit}x</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-sky-600 block uppercase">Izin</span>
                    <span className="text-xl font-black text-sky-700 mt-0.5 block">{currentStudentStats.ijin}x</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase">Alpa</span>
                    <span className="text-xl font-black text-rose-700 mt-0.5 block">{currentStudentStats.alpa}x</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-purple-600 block uppercase">Dispen</span>
                    <span className="text-xl font-black text-purple-700 mt-0.5 block">{currentStudentStats.dispen}x</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-indigo-600 block uppercase">Magang</span>
                    <span className="text-xl font-black text-indigo-700 mt-0.5 block">{currentStudentStats.magang}x</span>
                  </div>
                </div>
              )}

              {/* Target Phone Input & Send WhatsApp */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200">
                <div className="flex-1 max-w-md">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nomor WhatsApp Orang Tua / Wali (Opsional):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nomorHpOrtu}
                      onChange={e => setNomorHpOrtu(e.target.value)}
                      placeholder="Contoh: 08123456789 atau 628123456789"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-indigo-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Kosongkan jika ingin memilih kontak langsung di aplikasi WhatsApp.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={handleCopyIndividualWA}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    {copiedIndividualWA ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Pesan</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSendIndividualWhatsApp}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Kirim ke WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Individual Message Preview */}
              <div className="bg-slate-900 text-emerald-300 p-5 rounded-3xl font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto select-all shadow-inner border border-slate-800">
                {generateIndividualWhatsApp()}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 no-print">
          <div className="text-xs text-slate-500 font-medium">
            Mata Pelajaran: <strong>{profile.mapelUtama || 'Mata Pelajaran'}</strong> • {profile.namaSekolah}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
