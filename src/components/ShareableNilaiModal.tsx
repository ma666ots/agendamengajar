import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Award,
  Share2,
  Printer,
  Copy,
  Check,
  Download,
  X,
  FileSpreadsheet,
  Trophy,
  Users,
  CheckCircle2,
  AlertTriangle,
  Send,
  UserCheck,
  BookOpen,
  FileText,
  Loader2,
} from 'lucide-react';
import { Kelas, Siswa, PenilaianSession, TeacherProfile, GradeHuruf } from '../types';
import {
  numberToGradeHuruf,
  getGradeBadgeStyle,
  getGradePredikat,
  normalizeGradeHuruf,
} from '../utils/gradeUtils';
import { formatCityName } from './ShareablePresensiModal';

export interface PenilaianSessionExtended extends PenilaianSession {
  isFromAgenda?: boolean;
  pertemuanKe?: number;
}

interface ShareableNilaiModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeKelas: Kelas;
  siswaList: Siswa[];
  sessionsList: PenilaianSessionExtended[];
  profile: TeacherProfile;
  initialSessionId?: string;
}

export const ShareableNilaiModal: React.FC<ShareableNilaiModalProps> = ({
  isOpen,
  onClose,
  activeKelas,
  siswaList,
  sessionsList,
  profile,
  initialSessionId,
}) => {
  const [activeTab, setActiveTab] = useState<'card' | 'whatsapp' | 'individual'>('card');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialSessionId || (sessionsList[0]?.id ? sessionsList[0].id : 'ALL')
  );
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>(siswaList[0]?.id || '');
  const [copiedWA, setCopiedWA] = useState<boolean>(false);
  const [copiedIndividualWA, setCopiedIndividualWA] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TUNTAS' | 'REMEDIAL'>('ALL');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  if (!isOpen) return null;

  // Filter students of this class
  const classSiswa = siswaList.filter(s => s.kelasId === activeKelas.id);

  // Helper: check if a session is a checklist assignment (Sudah/Belum)
  const isSessionChecklist = (sess: PenilaianSessionExtended) => {
    if (sess.skalaPenilaian === 'ceklis' || sess.jenisPenilaian === 'Ceklis') return true;
    if (sess.skalaPenilaian === 'angka' || sess.skalaPenilaian === 'huruf') return false;
    const hasNumeric = sess.daftarNilai.some(d => typeof d.nilai === 'number' && d.nilai > 0);
    const hasLetter = sess.daftarNilai.some(d => Boolean(d.gradeHuruf));
    if (hasNumeric || hasLetter) return false;
    return sess.daftarNilai.some(d => d.statusTugas !== undefined);
  };

  // Helper: check if a session uses letter grading (A+, A, B, etc.)
  const isSessionHuruf = (sess: PenilaianSessionExtended) => {
    if (sess.skalaPenilaian === 'huruf') return true;
    if (sess.skalaPenilaian === 'angka' || sess.skalaPenilaian === 'ceklis') return false;
    return sess.daftarNilai.some(d => Boolean(d.gradeHuruf));
  };

  // Selected session or ALL sessions aggregated
  const isAllSessions = selectedSessionId === 'ALL';
  const currentSession = sessionsList.find(s => s.id === selectedSessionId);
  const isCurrentSessionChecklist = currentSession ? isSessionChecklist(currentSession) : false;
  const isCurrentSessionHuruf = currentSession ? isSessionHuruf(currentSession) : false;
  const numericSessions = sessionsList.filter(s => !isSessionChecklist(s));

  // Calculate scores and details per student
  const studentGrades = classSiswa.map(s => {
    if (isAllSessions) {
      let numericTotal = 0;
      let numericCount = 0;
      let checklistCompleted = 0;
      const checklistTotal = sessionsList.length;

      const breakdown = sessionsList.map(sess => {
        const grade = sess.daftarNilai.find(n => n.siswaId === s.id);
        const isChecklist = isSessionChecklist(sess);
        const isHuruf = isSessionHuruf(sess);

        if (isChecklist) {
          const isDone =
            grade?.statusTugas === 'Sudah' ||
            (!grade?.statusTugas && typeof grade?.nilai === 'number' && grade.nilai > 0);
          if (isDone) checklistCompleted++;

          return {
            sessionId: sess.id,
            sessionName: sess.namaPenilaian,
            jenisPenilaian: sess.jenisPenilaian,
            skalaPenilaian: 'ceklis' as const,
            kkm: sess.kkm,
            gradeHuruf: undefined,
            statusTugas: isDone ? ('Sudah' as const) : ('Belum' as const),
            isTuntas: isDone,
            score: isDone ? 100 : 0,
            catatan: grade?.catatan,
          };
        } else if (isHuruf) {
          const hasLetter = Boolean(grade?.gradeHuruf) && grade?.gradeHuruf !== '-';
          const letter = hasLetter
            ? normalizeGradeHuruf(grade!.gradeHuruf!) || grade!.gradeHuruf!
            : undefined;
          const isDone = Boolean(hasLetter && grade?.statusTugas !== 'Belum' && !grade?.catatan?.includes('Belum'));
          if (isDone) checklistCompleted++;

          const score = grade?.nilai ?? 0;
          if (hasLetter && score > 0) {
            numericTotal += score;
            numericCount++;
          }
          const isTuntas = score >= 70;

          return {
            sessionId: sess.id,
            sessionName: sess.namaPenilaian,
            jenisPenilaian: sess.jenisPenilaian,
            skalaPenilaian: 'huruf' as const,
            kkm: 70,
            gradeHuruf: letter,
            statusTugas: isDone ? ('Sudah' as const) : ('Belum' as const),
            isTuntas,
            score,
            catatan: grade?.catatan,
          };
        } else {
          const isDone = Boolean(
            grade &&
            grade.statusTugas !== 'Belum' &&
            !grade.catatan?.includes('Belum') &&
            (grade.nilai > 0 || grade.catatan === 'Nilai 0')
          );
          if (isDone) checklistCompleted++;

          const score = grade?.nilai ?? 0;
          if (isDone) {
            numericTotal += score;
            numericCount++;
          }
          const kkmRef = sess.kkm || 75;
          const isTuntas = score >= kkmRef;

          return {
            sessionId: sess.id,
            sessionName: sess.namaPenilaian,
            jenisPenilaian: sess.jenisPenilaian,
            skalaPenilaian: 'angka' as const,
            kkm: kkmRef,
            gradeHuruf: numberToGradeHuruf(score),
            score,
            statusTugas: isDone ? ('Sudah' as const) : ('Belum' as const),
            isTuntas,
            catatan: grade?.catatan,
          };
        }
      });

      const avg = numericCount > 0 ? Math.round(numericTotal / numericCount) : 0;
      const kkmRef = sessionsList.find(sess => !isSessionChecklist(sess))?.kkm || 75;

      const predikat = numberToGradeHuruf(avg);

      const allChecklistDone = checklistTotal === 0 || checklistCompleted === checklistTotal;
      const isTuntas = (numericCount === 0 || avg >= kkmRef) && allChecklistDone;

      return {
        siswa: s,
        nilai: avg,
        gradeHuruf: predikat,
        hasNumericScores: numericCount > 0,
        isChecklist: false,
        isHuruf: false,
        isTuntas,
        predikat,
        breakdown,
        checklistCompleted,
        checklistTotal,
        kkm: kkmRef,
        catatan: undefined as string | undefined,
      };
    } else {
      // Single session grade
      const isChecklist = isCurrentSessionChecklist;
      const isHuruf = isCurrentSessionHuruf;
      const grade = currentSession?.daftarNilai.find(n => n.siswaId === s.id);
      const kkmRef = currentSession?.kkm || 75;

      if (isChecklist) {
        const isDone =
          grade?.statusTugas === 'Sudah' ||
          (grade?.statusTugas === undefined && (grade?.nilai ?? 0) > 0);

        return {
          siswa: s,
          nilai: isDone ? 100 : 0,
          gradeHuruf: undefined,
          statusTugas: isDone ? ('Sudah' as const) : ('Belum' as const),
          isChecklist: true,
          isHuruf: false,
          hasNumericScores: false,
          isTuntas: isDone,
          predikat: isDone ? 'Tuntas' : 'Belum',
          catatan: grade?.catatan,
          kkm: kkmRef,
          checklistCompleted: isDone ? 1 : 0,
          checklistTotal: 1,
          breakdown: [
            {
              sessionId: currentSession?.id || '',
              sessionName: currentSession?.namaPenilaian || '',
              jenisPenilaian: currentSession?.jenisPenilaian || 'Tugas',
              skalaPenilaian: 'ceklis' as const,
              kkm: kkmRef,
              gradeHuruf: undefined,
              statusTugas: isDone ? ('Sudah' as const) : ('Belum' as const),
              isTuntas: isDone,
              score: isDone ? 100 : 0,
              catatan: grade?.catatan,
            },
          ],
        };
      } else if (isHuruf) {
        const letter = grade?.gradeHuruf
          ? normalizeGradeHuruf(grade.gradeHuruf) || grade.gradeHuruf
          : numberToGradeHuruf(grade?.nilai ?? 75);
        const score = grade?.nilai ?? 75;
        const isTuntas = score >= 70;

        return {
          siswa: s,
          nilai: score,
          gradeHuruf: letter,
          statusTugas: undefined,
          isChecklist: false,
          isHuruf: true,
          hasNumericScores: true,
          isTuntas,
          predikat: letter,
          catatan: grade?.catatan,
          kkm: 70,
          checklistCompleted: 0,
          checklistTotal: 0,
          breakdown: [
            {
              sessionId: currentSession?.id || '',
              sessionName: currentSession?.namaPenilaian || '',
              jenisPenilaian: currentSession?.jenisPenilaian || 'Tugas',
              skalaPenilaian: 'huruf' as const,
              kkm: 70,
              gradeHuruf: letter,
              score,
              statusTugas: undefined,
              isTuntas,
              catatan: grade?.catatan,
            },
          ],
        };
      } else {
        const score = grade?.nilai ?? 0;
        const predikat = numberToGradeHuruf(score);

        return {
          siswa: s,
          nilai: score,
          gradeHuruf: predikat,
          statusTugas: undefined,
          isChecklist: false,
          isHuruf: false,
          hasNumericScores: true,
          isTuntas: score >= kkmRef,
          predikat,
          catatan: grade?.catatan,
          kkm: kkmRef,
          checklistCompleted: 0,
          checklistTotal: 0,
          breakdown: [
            {
              sessionId: currentSession?.id || '',
              sessionName: currentSession?.namaPenilaian || '',
              jenisPenilaian: currentSession?.jenisPenilaian || 'Tugas',
              skalaPenilaian: 'angka' as const,
              kkm: kkmRef,
              gradeHuruf: predikat,
              score,
              statusTugas: undefined,
              isTuntas: score >= kkmRef,
              catatan: grade?.catatan,
            },
          ],
        };
      }
    }
  });

  // Sort by score for ranking (if numeric available)
  const rankedStudents = [...studentGrades].sort((a, b) => b.nilai - a.nilai);

  // Top achievers (only for numeric assessments)
  const showPodium = !isCurrentSessionChecklist || isAllSessions;
  const topAchievers = showPodium ? rankedStudents.filter(r => r.nilai > 0).slice(0, 3) : [];

  // Statistics
  const validScores = studentGrades.filter(s => s.hasNumericScores).map(s => s.nilai);
  const totalStudents = studentGrades.length;
  const avgClass =
    validScores.length > 0
      ? Math.round(validScores.reduce((acc, curr) => acc + curr, 0) / validScores.length)
      : 0;
  const maxScore = validScores.length > 0 ? Math.max(...validScores) : 0;
  const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
  const tuntasCount = studentGrades.filter(s => s.isTuntas).length;
  const tuntasPercentage =
    totalStudents > 0 ? Math.round((tuntasCount / totalStudents) * 100) : 0;

  // Filtered students for display
  const displayedStudents = studentGrades.filter(s => {
    if (filterStatus === 'TUNTAS') return s.isTuntas;
    if (filterStatus === 'REMEDIAL') return !s.isTuntas;
    return true;
  });

  // Current target session title & mapel
  const activeTitle = isAllSessions
    ? 'Rekapitulasi Semua Nilai & Tugas'
    : currentSession?.namaPenilaian || 'Penilaian Siswa';
  const activeMapel = isAllSessions
    ? profile.mapelUtama || 'Mata Pelajaran'
    : currentSession?.mapel || profile.mapelUtama;
  const activeKKM = isAllSessions ? 75 : currentSession?.kkm || 75;
  const activeTanggal = isAllSessions
    ? new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })
    : currentSession?.tanggal || '';

  // Generate WhatsApp formatted text with all tasks and scores
  const generateWhatsAppMessage = () => {
    let msg = `🏆 *LAPORAN HASIL PENILAIAN & TUGAS SISWA* 🏆\n`;
    msg += `🏫 *Sekolah*       : ${profile.namaSekolah || 'Sekolah'}\n`;
    msg += `📚 *Mata Pelajaran* : ${activeMapel}\n`;
    msg += `👥 *Kelas*          : ${activeKelas.namaKelas}\n`;
    msg += `📝 *Materi/Topik*   : ${activeTitle}\n`;
    if (!isCurrentSessionChecklist) {
      msg += `🎯 *KKM Acuan*      : ${activeKKM}\n`;
    }
    msg += `📅 *Tanggal*        : ${activeTanggal}\n\n`;

    msg += `📊 *STATISTIK KELAS:*\n`;
    if (validScores.length > 0) {
      msg += `• Rata-rata Nilai : *${avgClass}*\n`;
      msg += `• Tertinggi / Terendah: *${maxScore}* / *${minScore}*\n`;
    }
    msg += `• Tingkat Ketuntasan: *${tuntasPercentage}%* (${tuntasCount} dari ${totalStudents} siswa tuntas)\n\n`;

    if (topAchievers.length > 0 && showPodium) {
      msg += `🌟 *TOP ACHIEVERS / BINTANG KELAS:* 🌟\n`;
      topAchievers.forEach((ach, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        msg += `${medal} *Juara ${i + 1}*: ${ach.siswa.nama} (Rata-rata: *${ach.nilai}*)\n`;
      });
      msg += `\n`;
    }

    // Detail per student with individual tasks
    if (isAllSessions) {
      msg += `📋 *RINCIAN PENILAIAN & TUGAS LENGKAP SISWA:*\n`;
      displayedStudents.forEach((st, idx) => {
        msg += `\n*${idx + 1}. ${st.siswa.nama}* (NIS: ${st.siswa.nis || '-'})\n`;
        st.breakdown?.forEach(item => {
          if (item.skalaPenilaian === 'ceklis') {
            const icon = item.statusTugas === 'Sudah' ? '✅' : '❌';
            msg += `   • ${item.sessionName}: ${icon} *${item.statusTugas || 'Belum'}*\n`;
          } else if (item.skalaPenilaian === 'huruf') {
            const icon = item.isTuntas ? '🟢' : '🔴';
            msg += `   • ${item.sessionName}: *Grade ${item.gradeHuruf || item.score}* ${icon}\n`;
          } else {
            const icon = (item.score ?? 0) >= item.kkm ? '🟢' : '🔴';
            msg += `   • ${item.sessionName}: *${item.score ?? 0}* ${icon}\n`;
          }
        });
        if (st.hasNumericScores) {
          msg += `   ➔ *Rata-Rata Nilai*: *${st.nilai}* [Grade ${st.gradeHuruf || st.predikat}] - *${st.isTuntas ? 'TUNTAS' : 'REMEDIAL'}*\n`;
        }
        if (st.checklistTotal && st.checklistTotal > 0) {
          msg += `   ➔ *Kelengkapan Tugas*: ${st.checklistCompleted} dari ${st.checklistTotal} tugas selesai\n`;
        }
      });
    } else {
      // Single session
      msg += `📋 *DAFTAR HASIL NILAI SISWA:*\n`;
      displayedStudents.forEach((st, idx) => {
        if (st.isChecklist) {
          const statusIcon = st.isTuntas ? '✅' : '❌';
          msg += `${idx + 1}. ${st.siswa.nama} - ${statusIcon} *${st.statusTugas} Mengumpulkan*\n`;
        } else if (st.isHuruf) {
          const statusIcon = st.isTuntas ? '✅' : '⚠️';
          const statusText = st.isTuntas ? 'TUNTAS' : 'REMEDIAL';
          msg += `${idx + 1}. ${st.siswa.nama} - *Grade ${st.gradeHuruf}* [${getGradePredikat(st.gradeHuruf as GradeHuruf)}] ${statusIcon} ${statusText}\n`;
        } else {
          const statusIcon = st.isTuntas ? '✅' : '⚠️';
          const statusText = st.isTuntas ? 'TUNTAS' : 'REMEDIAL';
          msg += `${idx + 1}. ${st.siswa.nama} - *${st.nilai}* [${st.predikat}] ${statusIcon} ${statusText}\n`;
        }
      });
    }

    msg += `\n💬 *Catatan Guru:*\n`;
    msg += `Bagi siswa yang belum tuntas atau belum mengumpulkan tugas, silakan segera melengkapi dan mengikuti pendampingan remedial. Tetap semangat belajar! ✨\n\n`;
    msg += `_Guru Pengampu:_\n*${profile.namaGuru}*\n${profile.nip?.length >= 18 ? 'NIPPPK' : 'NIP'}: ${profile.nip || '-'}`;

    return msg;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(generateWhatsAppMessage());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Individual Student Report
  const targetStudent = studentGrades.find(s => s.siswa.id === selectedSiswaId) || studentGrades[0];

  const generateIndividualWhatsApp = () => {
    if (!targetStudent) return '';
    let msg = `📄 *LAPORAN HASIL PENILAIAN & TUGAS SISWA*\n\n`;
    msg += `Yth. Orang Tua / Wali dari ananda:\n`;
    msg += `👤 *Nama Siswa*  : *${targetStudent.siswa.nama}*\n`;
    msg += `🆔 *NIS / NISN*   : ${targetStudent.siswa.nis || targetStudent.siswa.nisn || '-'}\n`;
    msg += `🏫 *Kelas*        : ${activeKelas.namaKelas}\n`;
    msg += `📚 *Mata Pelajaran*: ${activeMapel}\n\n`;

    if (isAllSessions) {
      msg += `📋 *Rincian Setiap Tugas & Penilaian:*\n`;
      targetStudent.breakdown?.forEach(item => {
        if (item.skalaPenilaian === 'ceklis') {
          const icon = item.statusTugas === 'Sudah' ? '✅' : '❌';
          msg += `• ${item.sessionName}: ${icon} *${item.statusTugas || 'Belum'}*\n`;
        } else if (item.skalaPenilaian === 'huruf') {
          const icon = item.isTuntas ? '🟢' : '🔴';
          msg += `• ${item.sessionName}: *Grade ${item.gradeHuruf || item.score}* ${icon}\n`;
        } else {
          const icon = (item.score ?? 0) >= item.kkm ? '🟢' : '🔴';
          msg += `• ${item.sessionName}: *${item.score ?? 0}* ${icon} (KKM ${item.kkm})\n`;
        }
      });

      if (targetStudent.hasNumericScores) {
        msg += `\n📊 *Nilai Akhir Rata-Rata*: *${targetStudent.nilai}* [Grade ${targetStudent.gradeHuruf || targetStudent.predikat}]\n`;
      }
      if (targetStudent.checklistTotal && targetStudent.checklistTotal > 0) {
        msg += `📦 *Tugas Selesai*: *${targetStudent.checklistCompleted}* dari *${targetStudent.checklistTotal}* tugas\n`;
      }
      msg += `📌 *Status*: *${targetStudent.isTuntas ? '✅ TUNTAS' : '⚠️ PERLU PERBAIKAN / REMEDIAL'}*\n`;
    } else {
      msg += `📋 *Hasil Penilaian:*\n`;
      msg += `• Materi : *${activeTitle}*\n`;
      if (targetStudent.isChecklist) {
        msg += `• Status Pengumpulan: *${targetStudent.statusTugas === 'Sudah' ? '✅ SUDAH MENGUMPULKAN' : '❌ BELUM MENGUMPULKAN'}*\n`;
      } else if (targetStudent.isHuruf) {
        msg += `• Grade  : *${targetStudent.gradeHuruf}* (${getGradePredikat(targetStudent.gradeHuruf as GradeHuruf)})\n`;
        msg += `• Status : *${targetStudent.isTuntas ? '✅ TUNTAS' : '⚠️ PERLU REMEDIAL'}*\n`;
      } else {
        msg += `• Nilai  : *${targetStudent.nilai}* (KKM: ${activeKKM})\n`;
        msg += `• Predikat: *Predikat ${targetStudent.predikat}*\n`;
        msg += `• Status : *${targetStudent.isTuntas ? '✅ TUNTAS' : '⚠️ PERLU REMEDIAL'}*\n`;
      }
    }

    if (targetStudent.catatan) {
      msg += `• Catatan: _${targetStudent.catatan}_\n`;
    }

    msg += `\nDemikian laporan hasil belajar ini disampaikan. Terima kasih atas dukungan Bapak/Ibu di rumah.\n\n`;
    msg += `Salam hormat,\n*${profile.namaGuru}*\n_${profile.namaSekolah}_`;

    return msg;
  };

  const handleCopyIndividualWA = () => {
    const text = generateIndividualWhatsApp();
    navigator.clipboard.writeText(text);
    setCopiedIndividualWA(true);
    setTimeout(() => setCopiedIndividualWA(false), 2500);
  };

  // Export Excel (.xlsx) with every assignment title included
  const handleExportExcel = () => {
    let rows: Record<string, any>[] = [];

    if (isAllSessions) {
      rows = studentGrades.map((st, i) => {
        const rowData: Record<string, any> = {
          No: i + 1,
          NIS: st.siswa.nis || '',
          NISN: st.siswa.nisn || '',
          'Nama Siswa': st.siswa.nama,
          'Jenis Kelamin': st.siswa.jenisKelamin,
        };

        // Add each individual assessment/task title as a column
        st.breakdown?.forEach(item => {
          if (item.skalaPenilaian === 'ceklis') {
            rowData[`${item.sessionName} (Ceklis)`] = item.statusTugas || 'Belum';
          } else if (item.skalaPenilaian === 'huruf') {
            rowData[`${item.sessionName} (Grade)`] = item.gradeHuruf || item.score;
          } else {
            rowData[`${item.sessionName} (KKM ${item.kkm})`] = item.score ?? 0;
          }
        });

        if (st.hasNumericScores) {
          rowData['Nilai Rata-Rata'] = st.nilai;
          rowData['Predikat / Grade'] = st.gradeHuruf || st.predikat;
        }
        if (st.checklistTotal && st.checklistTotal > 0) {
          rowData['Tugas Ceklis Selesai'] = `${st.checklistCompleted}/${st.checklistTotal}`;
        }
        rowData['Status Ketuntasan'] = st.isTuntas ? 'TUNTAS' : 'REMEDIAL';

        return rowData;
      });
    } else {
      // Single session export
      rows = studentGrades.map((st, i) => ({
        No: i + 1,
        NIS: st.siswa.nis || '',
        NISN: st.siswa.nisn || '',
        'Nama Siswa': st.siswa.nama,
        'Jenis Kelamin': st.siswa.jenisKelamin,
        [isCurrentSessionChecklist
          ? 'Status Pengumpulan'
          : isCurrentSessionHuruf
          ? 'Grade Huruf'
          : 'Nilai Siswa']: isCurrentSessionChecklist
          ? st.statusTugas || 'Belum'
          : isCurrentSessionHuruf
          ? st.gradeHuruf || st.nilai
          : st.nilai,
        Predikat: st.predikat,
        'Status Ketuntasan': st.isTuntas ? 'TUNTAS' : 'REMEDIAL',
        'KKM Acuan': activeKKM,
        'Catatan Evaluasi': st.catatan || '',
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap_Nilai');

    const safeTitle = activeTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Rekap_Nilai_${safeKelas}_${safeTitle}.xlsx`);
  };

  // Professional PDF Export using jsPDF & autoTable
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      // Choose orientation: Landscape for multi-column rekap, Portrait for single session
      const isLandscape = isAllSessions && sessionsList.length > 2;
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

      // KKM & Date on right
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(67, 56, 202);
      doc.text(`KKM ACUAN: ${activeKKM}`, pageWidth - 14, 14, { align: 'right' });
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
      doc.text('LAPORAN HASIL PENILAIAN & TUGAS SISWA', pageWidth / 2, 30, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(79, 70, 229);
      doc.text(activeTitle, pageWidth / 2, 34.5, { align: 'center' });

      // Metadata Info Box
      const tahunAjaran = profile.tahunAjaran || activeKelas.tahunAjaran || '2025/2026';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const metaY = 39.5;
      doc.text(`Mata Pelajaran : ${activeMapel}`, 14, metaY);
      doc.text(`Kelas          : ${activeKelas.namaKelas}`, 14, metaY + 4);
      doc.text(`Tahun Ajaran   : ${tahunAjaran}`, (pageWidth / 2) - 10, metaY);
      doc.text(`Filter Status  : ${filterStatus === 'ALL' ? 'Semua Siswa' : filterStatus === 'TUNTAS' ? 'Tuntas Saja' : 'Remedial Saja'} (${displayedStudents.length} Siswa)`, (pageWidth / 2) - 10, metaY + 4);

      // Statistics Banner
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, metaY + 7, pageWidth - 28, 8, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      const statText = `Total Siswa: ${totalStudents}  |  Tuntas: ${tuntasCount} (${tuntasPercentage}%)  |  Remedial/Belum: ${totalStudents - tuntasCount}  |  Rata-rata: ${validScores.length > 0 ? avgClass : '-'}`;
      doc.text(statText, pageWidth / 2, metaY + 12.2, { align: 'center' });

      // Table Setup
      let head: string[][] = [];
      let body: (string | number)[][] = [];

      if (isAllSessions) {
        const headerRow = ['No', 'NIS', 'Nama Siswa'];
        sessionsList.forEach(s => {
          headerRow.push(s.namaPenilaian);
        });
        if (numericSessions.length > 0) headerRow.push('Rata-Rata');
        headerRow.push('Ceklis');
        headerRow.push('Status');
        head = [headerRow];

        body = displayedStudents.map((st, idx) => {
          const row: (string | number)[] = [
            idx + 1,
            st.siswa.nis || '-',
            st.siswa.nama,
          ];

          st.breakdown?.forEach(item => {
            if (item.skalaPenilaian === 'ceklis') {
              row.push(item.statusTugas === 'Sudah' ? '✓ Sudah' : '✕ Belum');
            } else if (item.skalaPenilaian === 'huruf') {
              row.push(
                item.gradeHuruf && item.gradeHuruf !== '-' && item.statusTugas !== 'Belum'
                  ? item.gradeHuruf
                  : '✕ Belum'
              );
            } else {
              const isDone =
                !item.catatan?.includes('Belum') &&
                item.statusTugas !== 'Belum' &&
                ((item.score ?? 0) > 0 || item.catatan === 'Nilai 0');
              row.push(isDone ? (item.score ?? 0) : '✕ Belum');
            }
          });

          if (numericSessions.length > 0) {
            row.push(st.hasNumericScores ? `${st.nilai} (${st.gradeHuruf || st.predikat})` : '-');
          }
          row.push(`${st.checklistCompleted || 0}/${st.checklistTotal || sessionsList.length}`);
          row.push(st.isTuntas ? 'TUNTAS' : 'REMEDIAL');

          return row;
        });
      } else {
        const colLabel = isCurrentSessionChecklist ? 'Status' : isCurrentSessionHuruf ? 'Grade' : 'Nilai';
        head = [['No', 'NIS', 'Nama Siswa', 'L/P', colLabel, 'Predikat', 'Status', 'Catatan']];
        body = displayedStudents.map((st, idx) => [
          idx + 1,
          st.siswa.nis || '-',
          st.siswa.nama,
          st.siswa.jenisKelamin || '-',
          isCurrentSessionChecklist ? (st.statusTugas || 'Belum') : isCurrentSessionHuruf ? (st.gradeHuruf || '-') : st.nilai,
          st.predikat,
          st.isTuntas ? 'TUNTAS' : 'REMEDIAL',
          st.catatan || '-'
        ]);
      }

      autoTable(doc, {
        startY: metaY + 17,
        head,
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
            if (data.cell.raw.includes('✕') || data.cell.raw === 'REMEDIAL') {
              data.cell.styles.textColor = [190, 18, 60];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw.includes('✓') || data.cell.raw === 'TUNTAS') {
              data.cell.styles.textColor = [5, 150, 105];
              data.cell.styles.fontStyle = 'bold';
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
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Magelang, ${todayStr}`, signX, signY);
      doc.text('Guru Mata Pelajaran,', signX, signY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(profile.namaGuru || 'Ahmad, S.Kom', signX, signY + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`NIP. ${profile.nipGuru || '-'}`, signX, signY + 24);

      // Trigger immediate download
      const safeTitle = activeTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Laporan_Nilai_${safeKelas}_${safeTitle}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    try {
      const printableElement = document.getElementById('printable-report-card');
      if (!printableElement) {
        window.print();
        return;
      }

      // Create an invisible iframe for isolated printing (avoids modal container clipping)
      let printFrame = document.getElementById('print-sandbox-frame') as HTMLIFrameElement | null;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'print-sandbox-frame';
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
            <title>Laporan Nilai - ${activeKelas.namaKelas}</title>
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
          // If iframe printing blocked by sandbox, automatically fallback to direct PDF download
          handleDownloadPdf();
        }
      }, 400);
    } catch {
      handleDownloadPdf();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Styles for isolated print formatting */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report-card, #printable-report-card * {
            visibility: visible;
          }
          #printable-report-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[94vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 no-print">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold mb-1 border border-indigo-400/20">
              <Share2 className="w-3 h-3" />
              <span>Pusat Berbagi & Laporan Nilai Siswa</span>
            </div>
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <span>{activeKelas.namaKelas} — {activeTitle}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Navigation Tabs & Selection Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl self-start">
            <button
              onClick={() => setActiveTab('card')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'card'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Kartu Hasil Belajar</span>
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Format WhatsApp</span>
            </button>
            <button
              onClick={() => setActiveTab('individual')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'individual'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Slip Per Siswa</span>
            </button>
          </div>

          {/* Sesi Penilaian Dropdown Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Pilih Materi/Tugas:</label>
            <select
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[280px]"
            >
              <option value="ALL">📊 Rekapitulasi Semua Nilai & Tugas</option>
              {sessionsList.map(s => {
                const isChecklist = isSessionChecklist(s);
                return (
                  <option key={s.id} value={s.id}>
                    {s.namaPenilaian} {isChecklist ? '(Ceklis Sudah/Belum)' : `(${s.jenisPenilaian})`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: CARD & PRINTABLE REPORT */}
          {activeTab === 'card' && (
            <div className="space-y-6">
              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 no-print">
                {/* Filter Tuntas Buttons */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-400 mr-1">Tampilkan:</span>
                  <button
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      filterStatus === 'ALL'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({totalStudents})
                  </button>
                  <button
                    onClick={() => setFilterStatus('TUNTAS')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      filterStatus === 'TUNTAS'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Tuntas ({tuntasCount})
                  </button>
                  <button
                    onClick={() => setFilterStatus('REMEDIAL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      filterStatus === 'REMEDIAL'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Remedial / Belum ({totalStudents - tuntasCount})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                    title="Download file Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isExportingPdf}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-60"
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
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                    title="Cetak langsung ke printer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak</span>
                  </button>
                </div>
              </div>

              {/* Printable Document Container */}
              <div
                id="printable-report-card"
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
                      <span>Mata Pelajaran: <strong>{activeMapel}</strong></span>
                      <span>•</span>
                      <span>Kelas: <strong>{activeKelas.namaKelas}</strong></span>
                      <span>•</span>
                      <span>Tahun Ajaran: <strong>{activeKelas.tahunAjaran || profile.tahunAjaran}</strong></span>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    {!isCurrentSessionChecklist && (
                      <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold inline-block">
                        KKM: {activeKKM}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">{activeTanggal}</p>
                  </div>
                </div>

                {/* Banner Judul Penilaian */}
                <div className="text-center py-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight">
                    LAPORAN HASIL PENILAIAN & TUGAS SISWA
                  </h3>
                  <p className="text-xs text-indigo-600 font-semibold">{activeTitle}</p>
                  {isAllSessions && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Menampilkan rincian setiap tugas dan penilaian harian (nilai angka maupun ceklis penugasan).
                    </p>
                  )}
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                      {validScores.length > 0 ? 'Rata-Rata Kelas' : 'Total Siswa'}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-indigo-900 mt-0.5 block">
                      {validScores.length > 0 ? avgClass : totalStudents}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                      {validScores.length > 0 ? 'Tertinggi / Terendah' : 'Komponen Tugas'}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5 block">
                      {validScores.length > 0 ? (
                        <>
                          {maxScore} <span className="text-xs font-normal text-emerald-600">/ {minScore}</span>
                        </>
                      ) : (
                        sessionsList.length
                      )}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-center">
                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">
                      Tingkat Tuntas
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-sky-900 mt-0.5 block">
                      {tuntasPercentage}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-center">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                      Remedial / Belum
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5 block">
                      {totalStudents - tuntasCount} <span className="text-xs font-normal text-amber-600">siswa</span>
                    </span>
                  </div>
                </div>

                {/* Top Achievers Banner (if numeric grades present) */}
                {topAchievers.length > 0 && showPodium && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                        Bintang Kelas / Top Achievers
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {topAchievers.map((ach, idx) => (
                        <div
                          key={ach.siswa.id}
                          className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-amber-200/80 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {ach.siswa.nama}
                              </p>
                              <p className="text-[10px] text-slate-400">Peringkat {idx + 1}</p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-amber-700">{ach.nilai}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Grades Table: Supports multi-column assignments with title headers */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <tr>
                        <th className="p-3 pl-4 font-bold whitespace-nowrap">No</th>
                        <th className="p-3 font-bold whitespace-nowrap">NIS</th>
                        <th className="p-3 font-bold whitespace-nowrap min-w-[160px]">Nama Lengkap Siswa</th>

                        {/* If ALL sessions, list each session title as its own column */}
                        {isAllSessions ? (
                          <>
                            {sessionsList.map(sess => {
                              const isChecklist = isSessionChecklist(sess);
                              const isHuruf = isSessionHuruf(sess);
                              return (
                                <th
                                  key={sess.id}
                                  className="p-3 text-center font-bold whitespace-nowrap min-w-[120px]"
                                >
                                  <div className="text-slate-900 font-extrabold">{sess.namaPenilaian}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    {isChecklist ? (
                                      <span className="text-amber-600 font-semibold">Ceklis (Sudah/Belum)</span>
                                    ) : isHuruf ? (
                                      <span className="text-purple-600 font-semibold">Format Huruf</span>
                                    ) : (
                                      `KKM ${sess.kkm}`
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                            <th className="p-3 text-center font-bold whitespace-nowrap bg-indigo-50/60 text-indigo-950">
                              Rata-Rata
                            </th>
                            <th className="p-3 text-center font-bold whitespace-nowrap">Tugas</th>
                            <th className="p-3 text-center font-bold whitespace-nowrap">Grade</th>
                            <th className="p-3 text-center font-bold whitespace-nowrap pr-4">Status</th>
                          </>
                        ) : (
                          // Single session
                          <>
                            <th className="p-3 text-center font-bold whitespace-nowrap">
                              {isCurrentSessionChecklist
                                ? 'Status Pengumpulan Tugas'
                                : isCurrentSessionHuruf
                                ? 'Grade Huruf'
                                : 'Nilai'}
                            </th>
                            {!isCurrentSessionChecklist && (
                              <th className="p-3 text-center font-bold whitespace-nowrap">
                                {isCurrentSessionHuruf ? 'Predikat' : 'Grade'}
                              </th>
                            )}
                            <th className="p-3 text-center font-bold whitespace-nowrap">Status</th>
                            <th className="p-3 pr-4 font-bold whitespace-nowrap">Catatan</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedStudents.length === 0 ? (
                        <tr>
                          <td colSpan={isAllSessions ? sessionsList.length + 7 : 7} className="p-6 text-center text-slate-400">
                            Tidak ada data siswa sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        displayedStudents.map((st, i) => (
                          <tr key={st.siswa.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-semibold text-slate-400">{i + 1}</td>
                            <td className="p-3 text-slate-500 font-mono text-[11px]">
                              {st.siswa.nis || st.siswa.nisn || '-'}
                            </td>
                            <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{st.siswa.nama}</td>

                            {isAllSessions ? (
                              <>
                                {st.breakdown?.map(item => (
                                  <td key={item.sessionId} className="p-3 text-center whitespace-nowrap">
                                    {item.skalaPenilaian === 'ceklis' ? (
                                      item.statusTugas === 'Sudah' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-2xs border border-emerald-700">
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                          <span>Sudah</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-rose-600 text-white shadow-xs border border-rose-700">
                                          <X className="w-3.5 h-3.5 stroke-[3]" />
                                          <span>Belum</span>
                                        </span>
                                      )
                                    ) : item.skalaPenilaian === 'huruf' ? (
                                      item.gradeHuruf && item.gradeHuruf !== '-' && item.statusTugas !== 'Belum' ? (
                                        <span
                                          className={`inline-block font-black text-xs px-3 py-1 rounded-xl border shadow-2xs ${getGradeBadgeStyle(
                                            item.gradeHuruf
                                          )}`}
                                          title={`Predikat: ${getGradePredikat(item.gradeHuruf as GradeHuruf)}`}
                                        >
                                          {item.gradeHuruf}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-rose-600 text-white shadow-xs border border-rose-700">
                                          <X className="w-3.5 h-3.5 stroke-[3]" />
                                          <span>Belum</span>
                                        </span>
                                      )
                                    ) : (
                                      !item.catatan?.includes('Belum') && item.statusTugas !== 'Belum' && (item.score > 0 || item.catatan === 'Nilai 0') ? (
                                        <span
                                          className={`font-black text-xs px-3 py-1 rounded-xl ${
                                            item.isTuntas
                                              ? 'text-slate-800 bg-slate-50 border border-slate-200'
                                              : 'text-rose-700 bg-rose-50 border border-rose-200'
                                          }`}
                                        >
                                          {item.score}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-rose-600 text-white shadow-xs border border-rose-700">
                                          <X className="w-3.5 h-3.5 stroke-[3]" />
                                          <span>Belum</span>
                                        </span>
                                      )
                                    )}
                                  </td>
                                ))}
                                <td className="p-3 text-center font-black text-indigo-900 text-sm bg-indigo-50/30 whitespace-nowrap">
                                  {st.hasNumericScores ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span>{st.nilai}</span>
                                      <span
                                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${getGradeBadgeStyle(
                                          st.gradeHuruf || numberToGradeHuruf(st.nilai)
                                        )}`}
                                      >
                                        {st.gradeHuruf || numberToGradeHuruf(st.nilai)}
                                      </span>
                                    </div>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  {st.checklistTotal && st.checklistTotal > 0 ? (
                                    st.checklistCompleted === st.checklistTotal ? (
                                      <span className="inline-flex items-center gap-1 font-black text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        <Check className="w-3 h-3 stroke-[3] text-emerald-700" />
                                        <span>{st.checklistCompleted}/{st.checklistTotal}</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                                        <span>{st.checklistCompleted}/{st.checklistTotal}</span>
                                      </span>
                                    )
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getGradeBadgeStyle(
                                      st.gradeHuruf || st.predikat
                                    )}`}
                                  >
                                    {st.gradeHuruf || st.predikat}
                                  </span>
                                </td>
                                <td className="p-3 text-center pr-4 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                      st.isTuntas
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    {st.isTuntas ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Tuntas</span>
                                      </>
                                    ) : (
                                      <>
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>Remedial</span>
                                      </>
                                    )}
                                  </span>
                                </td>
                              </>
                            ) : (
                              // Single session row
                              <>
                                <td className="p-3 text-center whitespace-nowrap">
                                  {st.isChecklist ? (
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                                        st.isTuntas
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                                      }`}
                                    >
                                      {st.isTuntas ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>Sudah Mengumpulkan</span>
                                        </>
                                      ) : (
                                        <>
                                          <X className="w-3.5 h-3.5 text-rose-600" />
                                          <span>Belum Mengumpulkan</span>
                                        </>
                                      )}
                                    </span>
                                  ) : st.isHuruf ? (
                                    <span
                                      className={`inline-block font-black text-sm px-3 py-1 rounded-lg border shadow-2xs ${getGradeBadgeStyle(
                                        st.gradeHuruf || 'B'
                                      )}`}
                                    >
                                      {st.gradeHuruf}
                                    </span>
                                  ) : (
                                    <span className="font-black text-slate-900 text-sm">{st.nilai}</span>
                                  )}
                                </td>
                                {!st.isChecklist && (
                                  <td className="p-3 text-center whitespace-nowrap">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getGradeBadgeStyle(
                                        st.gradeHuruf || st.predikat
                                      )}`}
                                    >
                                      {st.isHuruf
                                        ? getGradePredikat((st.gradeHuruf || 'B') as GradeHuruf)
                                        : st.gradeHuruf || st.predikat}
                                    </span>
                                  </td>
                                )}
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                      st.isTuntas
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    {st.isTuntas ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Tuntas</span>
                                      </>
                                    ) : (
                                      <>
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>Belum / Remedial</span>
                                      </>
                                    )}
                                  </span>
                                </td>
                                <td className="p-3 pr-4 text-slate-500 text-[11px]">
                                  {st.catatan || (st.isTuntas ? 'Tugas Selesai' : 'Perlu melengkapi tugas')}
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="pt-6 flex justify-between text-xs text-slate-700 print:pt-8">
                  <div className="text-center">
                    <p>Mengetahui,</p>
                    <p className="font-semibold">Kepala Sekolah</p>
                    <div className="h-16" />
                    <p className="font-bold underline">{profile.namaKepsek || '( ................................... )'}</p>
                    <p className="text-[11px] text-slate-500">NIP: {profile.nipKepsek || '-'}</p>
                  </div>

                  <div className="text-center">
                    <p>{formatCityName(profile.alamatSekolah, profile.namaSekolah)}, {activeTanggal}</p>
                    <p className="font-semibold">Guru Pengampu</p>
                    <div className="h-16" />
                    <p className="font-bold underline">{profile.namaGuru}</p>
                    <p className="text-[11px] text-slate-500">{profile.nip?.length >= 18 ? 'NIPPPK' : 'NIP'}: {profile.nip || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP FORMAT */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-emerald-600" />
                    <span>Format Pengumuman WhatsApp Lengkap Rincian Tugas</span>
                  </h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Memuat setiap judul tugas (angka dan ceklis sudah/belum) agar siswa tahu persis tugas mana yang belum selesai.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyWhatsApp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedWA ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedWA ? 'Tersalin!' : 'Salin Pesan WA'}</span>
                  </button>
                  <button
                    onClick={handleOpenWhatsApp}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Buka WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Textarea Preview */}
              <div className="bg-slate-900 text-emerald-400 p-5 rounded-3xl font-mono text-xs leading-relaxed max-h-[520px] overflow-y-auto whitespace-pre-wrap border border-slate-800 selection:bg-emerald-800 selection:text-white">
                {generateWhatsAppMessage()}
              </div>
            </div>
          )}

          {/* TAB 3: INDIVIDUAL STUDENT REPORT SLIP */}
          {activeTab === 'individual' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-700">Pilih Siswa:</label>
                  <select
                    value={selectedSiswaId}
                    onChange={e => setSelectedSiswaId(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[280px]"
                  >
                    {classSiswa.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.nis || 'No NIS'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyIndividualWA}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedIndividualWA ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedIndividualWA ? 'Tersalin!' : 'Salin Pesan untuk Wali Siswa'}</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Slip Siswa</span>
                  </button>
                </div>
              </div>

              {/* Individual Student Report Card */}
              {targetStudent && (
                <div
                  id="printable-report-card"
                  className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-md max-w-2xl mx-auto space-y-6"
                >
                  {/* Card Header */}
                  <div className="text-center pb-4 border-b border-slate-100">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 font-bold">
                      <Award className="w-6 h-6" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-lg">
                      SLIP LAPORAN HASIL PENILAIAN & TUGAS
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.namaSekolah}</p>
                  </div>

                  {/* Student Bio */}
                  <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 block">Nama Siswa:</span>
                      <strong className="text-slate-800 text-sm">{targetStudent.siswa.nama}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Kelas:</span>
                      <strong className="text-slate-800">{activeKelas.namaKelas}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">NIS / NISN:</span>
                      <strong className="text-slate-800">
                        {targetStudent.siswa.nis || targetStudent.siswa.nisn || '-'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Mata Pelajaran:</span>
                      <strong className="text-slate-800">{activeMapel}</strong>
                    </div>
                  </div>

                  {/* Breakdown of Every Single Assignment & Test */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Rincian Semua Tugas & Penilaian:
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {targetStudent.breakdown?.length || 0} Komponen
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {targetStudent.breakdown?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{item.sessionName}</p>
                            <span className="text-[10px] text-slate-400">
                              {item.skalaPenilaian === 'ceklis'
                                ? 'Penugasan Ceklis'
                                : item.skalaPenilaian === 'huruf'
                                ? 'Format Huruf (A, B, C...)'
                                : `Penilaian Angka • KKM ${item.kkm}`}
                            </span>
                          </div>

                          <div className="text-right">
                            {item.skalaPenilaian === 'ceklis' ? (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                                  item.statusTugas === 'Sudah'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.statusTugas === 'Sudah' ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Sudah Selesai</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="w-3 h-3 text-rose-600" />
                                    <span>Belum Mengumpulkan</span>
                                  </>
                                )}
                              </span>
                            ) : item.skalaPenilaian === 'huruf' ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-xs font-black px-2 py-0.5 rounded-md border ${getGradeBadgeStyle(
                                    item.gradeHuruf || 'B'
                                  )}`}
                                >
                                  Grade {item.gradeHuruf || item.score}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                                    item.isTuntas
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {item.isTuntas ? 'Tuntas' : 'Remedial'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-slate-900 text-sm">{item.score}</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                                    item.isTuntas
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {item.isTuntas ? 'Tuntas' : 'Remedial'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-indigo-900 block">
                        Status Keseluruhan Belajar:
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {targetStudent.hasNumericScores && (
                          <span className="text-2xl font-black text-indigo-950">
                            Rata-Rata: {targetStudent.nilai}
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            targetStudent.isTuntas
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {targetStudent.isTuntas ? 'TUNTAS' : 'PERLU PERBAIKAN'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {targetStudent.checklistTotal && targetStudent.checklistTotal > 0 ? (
                        <div>
                          <span className="text-[11px] text-slate-500 block">Tugas Selesai</span>
                          <span className="text-lg font-black text-indigo-700">
                            {targetStudent.checklistCompleted} / {targetStudent.checklistTotal}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[11px] text-slate-500 block">Predikat</span>
                          <span className="text-2xl font-black text-indigo-700">
                            {targetStudent.predikat}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Teacher Feedback / Notes */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <span className="font-bold text-slate-700">Catatan Guru:</span>
                    <p className="text-slate-600 italic">
                      {targetStudent.catatan ||
                        (targetStudent.isTuntas
                          ? 'Selamat! Seluruh penilaian dan tugas telah dipenuhi dengan baik. Terus pertahankan prestasimu!'
                          : 'Masih ada tugas yang belum dikumpulkan atau nilai yang perlu remedial. Mohon segera hubungi guru untuk penyelesaian.')}
                    </p>
                  </div>

                  {/* Signature */}
                  <div className="pt-4 flex justify-between items-end text-xs text-slate-700">
                    <div>
                      <p className="text-slate-400">Orang Tua / Wali Siswa,</p>
                      <div className="h-12" />
                      <p className="font-semibold underline">( ....................................... )</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">{activeTanggal}</p>
                      <p className="font-semibold">Guru Pengampu,</p>
                      <div className="h-12" />
                      <p className="font-bold underline">{profile.namaGuru}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 no-print">
          <p className="text-xs text-slate-500">
            {classSiswa.length} Siswa Terdaftar • {sessionsList.length} Judul Penilaian & Tugas
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
