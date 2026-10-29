import React, { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  FileSpreadsheet,
  Share2,
  Copy,
  Check,
  X,
  Calendar,
  BookOpen,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  TeacherProfile,
  Kelas,
  Siswa,
  AgendaMengajar,
} from '../types';
import {
  captureElementToCanvas,
  downloadCanvasAsPng,
  copyCanvasToClipboard,
} from '../utils/screenshotUtils';
import { formatCityName, copyToClipboardSafe } from './ShareablePresensiModal';

interface ShareableJurnalModalProps {
  isOpen: boolean;
  onClose: () => void;
  kelasList: Kelas[];
  currentKelasId: string;
  onSelectKelas?: (kelasId: string) => void;
  siswaList: Siswa[];
  agendaList: AgendaMengajar[];
  profile: TeacherProfile;
  singleAgenda?: AgendaMengajar | null;
}

export const ShareableJurnalModal: React.FC<ShareableJurnalModalProps> = ({
  isOpen,
  onClose,
  kelasList,
  currentKelasId,
  onSelectKelas,
  siswaList,
  agendaList,
  profile,
  singleAgenda,
}) => {
  const [selectedKId, setSelectedKId] = useState<string>(() => {
    if (singleAgenda) return singleAgenda.kelasId;
    if (currentKelasId && currentKelasId !== 'all') return currentKelasId;
    return kelasList[0]?.id || '';
  });

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [copiedScreenshot, setCopiedScreenshot] = useState(false);

  // Sync if currentKelasId prop changes and is not 'all'
  React.useEffect(() => {
    if (singleAgenda) {
      setSelectedKId(singleAgenda.kelasId);
    } else if (currentKelasId && currentKelasId !== 'all') {
      setSelectedKId(currentKelasId);
    } else if (!selectedKId && kelasList.length > 0) {
      setSelectedKId(kelasList[0].id);
    }
  }, [currentKelasId, singleAgenda, kelasList]);

  const activeKelas = useMemo(() => {
    return (
      kelasList.find(k => k.id === selectedKId) ||
      kelasList[0] || {
        id: '',
        namaKelas: 'Semua Kelas',
        tingkat: '',
        jurusan: '',
        tahunAjaran: profile.tahunAjaran || '2025/2026',
      }
    );
  }, [kelasList, selectedKId]);

  // Agendas for active class
  const classAgendas = useMemo(() => {
    if (singleAgenda) return [singleAgenda];
    return agendaList
      .filter(a => a.kelasId === selectedKId)
      .sort((a, b) => (a.pertemuanKe || 0) - (b.pertemuanKe || 0));
  }, [agendaList, selectedKId, singleAgenda]);

  const classStudents = useMemo(() => {
    return siswaList.filter(s => s.kelasId === selectedKId);
  }, [siswaList, selectedKId]);

  if (!isOpen) return null;

  const handleSelectKelasChange = (kId: string) => {
    setSelectedKId(kId);
    if (onSelectKelas) onSelectKelas(kId);
  };

  // Safe Print via iframe
  const handlePrint = () => {
    try {
      const printableElement = document.getElementById('printable-jurnal-card');
      if (!printableElement) {
        window.print();
        return;
      }

      let printFrame = document.getElementById(
        'print-jurnal-sandbox-frame'
      ) as HTMLIFrameElement | null;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'print-jurnal-sandbox-frame';
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

      const styles = Array.from(
        document.querySelectorAll('style, link[rel="stylesheet"]')
      )
        .map(el => el.outerHTML)
        .join('\n');

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Jurnal Agenda Mengajar - ${activeKelas.namaKelas}</title>
            ${styles}
            <style>
              body { background: white !important; padding: 20px; font-family: system-ui, sans-serif; }
              @page { size: A4 portrait; margin: 12mm; }
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

  // Direct High-Quality PDF Download via jsPDF
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      // School Kop Surat Header
      const schoolName = (
        profile.namaSekolah || 'SMK NEGERI 2 MAGELANG'
      ).toUpperCase();
      const schoolAddress =
        profile.alamatSekolah || 'Jl. A Yani 135A Magelang Utara, Kota Magelang';

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
      doc.text(
        `${classAgendas.length} PERTEMUAN`,
        pageWidth - 14,
        14,
        { align: 'right' }
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const todayStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
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
      const docTitle = singleAgenda
        ? `JURNAL AGENDA MENGAJAR (PERTEMUAN KE-${singleAgenda.pertemuanKe || 1})`
        : 'JURNAL AGENDA MENGAJAR GURU';
      doc.text(docTitle, pageWidth / 2, 30, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(79, 70, 229);
      doc.text(`Kelas ${activeKelas.namaKelas}`, pageWidth / 2, 34.5, {
        align: 'center',
      });

      // Metadata Info Box
      const tahunAjaran =
        profile.tahunAjaran || activeKelas.tahunAjaran || '2025/2026';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const metaY = 39.5;
      doc.text(
        `Mata Pelajaran : ${profile.mapelUtama || 'Pemrograman Web'}`,
        14,
        metaY
      );
      doc.text(`Kelas          : ${activeKelas.namaKelas}`, 14, metaY + 4);
      doc.text(
        `Guru Pengampu  : ${profile.namaGuru} (${profile.nip?.length >= 18 ? 'NIPPPK' : 'NIP'}: ${profile.nip || '-'})`,
        14,
        metaY + 8
      );
      doc.text(`Tahun Ajaran   : ${tahunAjaran}`, pageWidth / 2 + 10, metaY);
      doc.text(`Semester       : ${profile.semester || 'Ganjil'}`, pageWidth / 2 + 10, metaY + 4);
      doc.text(
        `Total Pertemuan: ${classAgendas.length} Pertemuan`,
        pageWidth / 2 + 10,
        metaY + 8
      );

      // Build Table
      const headerRow = [
        'No',
        'Tgl / Pertemuan',
        'Materi & Capaian Pembelajaran',
        'Presensi (S/I/A/D/M)',
        'Refleksi / Catatan Kejadian',
      ];

      const body = classAgendas.map((ag, idx) => {
        const sakit = ag.presensi.filter(p => p.status === 'sakit').length;
        const ijin = ag.presensi.filter(p => p.status === 'ijin').length;
        const alpa = ag.presensi.filter(p => p.status === 'alpa').length;
        const dispen = ag.presensi.filter(p => p.status === 'dispen').length;
        const magang = ag.presensi.filter(p => p.status === 'magang').length;
        const hadir = ag.presensi.filter(p => p.status === 'hadir').length;

        let presensiText = `H:${hadir} | S:${sakit} | I:${ijin} | A:${alpa}`;
        if (dispen > 0) presensiText += ` | D:${dispen}`;
        if (magang > 0) presensiText += ` | M:${magang}`;

        let materiText = ag.materi;
        if (ag.capaianPembelajaran) {
          materiText += `\nCP: ${ag.capaianPembelajaran}`;
        }

        const refleksiText =
          ag.refleksiGuru || ag.catatanKejadian || ag.tindakLanjut || '-';

        return [
          idx + 1,
          `P-${ag.pertemuanKe}\n${ag.tanggal}`,
          materiText,
          presensiText,
          refleksiText,
        ];
      });

      autoTable(doc, {
        startY: metaY + 14,
        head: [headerRow],
        body,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 27, 75],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center',
          valign: 'middle',
          cellPadding: 2,
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: 'top',
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
          2: { halign: 'left', cellWidth: 68 },
          3: { halign: 'center', cellWidth: 32 },
          4: { halign: 'left' },
        },
        didDrawPage: () => {
          const str = `Halaman ${doc.getNumberOfPages()}`;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(str, pageWidth - 14, 290, { align: 'right' });
          doc.text(
            `Dicetak melalui Sistem Agenda & Presensi Mengajar Guru`,
            14,
            290
          );
        },
      });

      // Signature section on the last page
      const finalY = (doc as any).lastAutoTable?.finalY || 160;
      let signY = finalY + 12;
      if (signY + 35 > pageHeight - 14) {
        doc.addPage();
        signY = 25;
      }

      const cityName = formatCityName(
        profile.alamatSekolah,
        profile.namaSekolah
      );

      // Kepala Sekolah (Kiri)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('Mengetahui,', 20, signY);
      doc.text(`Kepala ${profile.namaSekolah || 'Sekolah'}`, 20, signY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(profile.namaKepsek || '( ................................... )', 20, signY + 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `NIP. ${profile.nipKepsek || '-'}`,
        20,
        signY + 26.5
      );

      // Guru Mata Pelajaran (Kanan)
      const signX = pageWidth - 70;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`${cityName}, ${todayStr}`, signX, signY);
      doc.text('Guru Mata Pelajaran,', signX, signY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(profile.namaGuru || 'Ahmad Syaefudin, S.Kom', signX, signY + 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${profile.nip?.length >= 18 ? 'NIPPPK.' : 'NIP.'} ${profile.nip || '-'}`,
        signX,
        signY + 26.5
      );

      const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(
        `Jurnal_Mengajar_${safeKelas}_${new Date().toISOString().split('T')[0]}.pdf`
      );
    } catch (err) {
      console.error('Error generating Jurnal PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    const rows = classAgendas.map((ag, idx) => {
      const sakit = ag.presensi.filter(p => p.status === 'sakit').length;
      const ijin = ag.presensi.filter(p => p.status === 'ijin').length;
      const alpa = ag.presensi.filter(p => p.status === 'alpa').length;
      const dispen = ag.presensi.filter(p => p.status === 'dispen').length;
      const magang = ag.presensi.filter(p => p.status === 'magang').length;
      const hadir = ag.presensi.filter(p => p.status === 'hadir').length;

      return {
        No: idx + 1,
        'Pertemuan Ke': ag.pertemuanKe,
        Tanggal: ag.tanggal,
        'Materi Pembelajaran': ag.materi,
        'Capaian Pembelajaran (CP)': ag.capaianPembelajaran || '-',
        'Jumlah Hadir (H)': hadir,
        'Jumlah Sakit (S)': sakit,
        'Jumlah Izin (I)': ijin,
        'Jumlah Alpa (A)': alpa,
        'Jumlah Dispen (D)': dispen,
        'Jumlah Magang (M)': magang,
        'Refleksi Guru': ag.refleksiGuru || '-',
        'Catatan Kejadian': ag.catatanKejadian || '-',
        'Tindak Lanjut': ag.tindakLanjut || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jurnal_Mengajar');

    const safeKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(
      workbook,
      `Jurnal_Mengajar_${safeKelas}_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  // WhatsApp Message Generator
  const generateWAMessage = () => {
    let msg = `📋 *LAPORAN JURNAL AGENDA MENGAJAR GURU* 📋\n\n`;
    msg += `🏫 *Sekolah*       : ${profile.namaSekolah || 'Sekolah'}\n`;
    msg += `👥 *Kelas*          : ${activeKelas.namaKelas}\n`;
    msg += `📚 *Mata Pelajaran* : ${profile.mapelUtama || 'Pemrograman Web'}\n`;
    msg += `👨‍🏫 *Guru Pengampu* : ${profile.namaGuru} (${profile.nip?.length >= 18 ? 'NIPPPK' : 'NIP'}: ${profile.nip || '-'})\n`;
    msg += `🗓️ *Total Sesi*     : ${classAgendas.length} Pertemuan\n\n`;

    msg += `📌 *RINGKASAN MATERI PEMBELAJARAN:*\n`;
    classAgendas.forEach((ag, i) => {
      const hadir = ag.presensi.filter(p => p.status === 'hadir').length;
      const sakit = ag.presensi.filter(p => p.status === 'sakit').length;
      const ijin = ag.presensi.filter(p => p.status === 'ijin').length;
      const alpa = ag.presensi.filter(p => p.status === 'alpa').length;
      const dispen = ag.presensi.filter(p => p.status === 'dispen').length;
      const magang = ag.presensi.filter(p => p.status === 'magang').length;

      let statStr = `H:${hadir}`;
      if (sakit > 0) statStr += ` S:${sakit}`;
      if (ijin > 0) statStr += ` I:${ijin}`;
      if (alpa > 0) statStr += ` A:${alpa}`;
      if (dispen > 0) statStr += ` D:${dispen}`;
      if (magang > 0) statStr += ` M:${magang}`;

      msg += `${i + 1}. *P-${ag.pertemuanKe}* (${ag.tanggal})\n`;
      msg += `   • Materi: ${ag.materi}\n`;
      msg += `   • Kehadiran: [${statStr}]\n`;
      if (ag.refleksiGuru) msg += `   • Catatan: _${ag.refleksiGuru}_\n`;
    });

    msg += `\n_Dicetak dan divalidasi melalui Sistem Agenda Guru Mandiri._`;
    return msg;
  };

  const handleCopyWA = async () => {
    const text = generateWAMessage();
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2500);
    }
  };

  const handleCaptureScreenshot = async (mode: 'download' | 'copy') => {
    const el = document.getElementById('printable-jurnal-card');
    if (!el) return;
    setIsCapturingScreenshot(true);
    try {
      const cleanKelas = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Jurnal_Mengajar_${cleanKelas}_${new Date().toISOString().split('T')[0]}.png`;
      const canvas = await captureElementToCanvas(el, { scale: 2 });
      if (mode === 'download') {
        downloadCanvasAsPng(canvas, filename);
      } else {
        const ok = await copyCanvasToClipboard(canvas);
        if (ok) {
          setCopiedScreenshot(true);
          setTimeout(() => setCopiedScreenshot(false), 2500);
        }
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const todayStrFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] my-auto">
        {/* Top Bar Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 no-print">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>
                {singleAgenda
                  ? `Jurnal Pertemuan Ke-${singleAgenda.pertemuanKe} - ${activeKelas.namaKelas}`
                  : `Jurnal Agenda Mengajar - ${activeKelas.namaKelas}`}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Dokumen jurnal mengajar guru resmi siap unduh PDF, cetak, atau bagikan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
          {/* Class Selector Tabs */}
          {!singleAgenda && kelasList.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-500 mr-1 shrink-0">
                Pilih Kelas:
              </span>
              {kelasList.map(k => {
                const isSelected = k.id === selectedKId;
                const count = agendaList.filter(a => a.kelasId === k.id).length;
                return (
                  <button
                    key={k.id}
                    onClick={() => handleSelectKelasChange(k.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{k.namaKelas}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-sky-200" />
              <span>{isExportingPdf ? 'Membuat PDF...' : 'Unduh PDF Resmi'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Cetak langsung ke printer atau dialog browser"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak Dokumen</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ekspor tabel jurnal ke format Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleCopyWA}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Salin ringkasan ke format pesan WhatsApp"
            >
              {copiedWA ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-white" />
                  <span>WhatsApp</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleCaptureScreenshot('download')}
              disabled={isCapturingScreenshot}
              className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-xl transition-all cursor-pointer"
              title="Unduh sebagai Gambar PNG"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0">
          <div
            id="printable-jurnal-card"
            className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6 max-w-4xl mx-auto print:p-0 print:border-0 print:shadow-none"
          >
            {/* KOP SURAT RESMI */}
            <div className="flex items-center justify-between pb-4 border-b-4 border-double border-black gap-3">
              {profile.logoSekolahUrl ? (
                <img
                  src={profile.logoSekolahUrl}
                  alt="Logo Sekolah"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center font-bold text-xs border border-black shrink-0">
                  LOGO
                </div>
              )}
              <div className="text-center flex-1 px-2">
                <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-800">
                  PEMERINTAH DAERAH DAERAH ISTIMEWA / PROVINSI
                </h2>
                <h1 className="text-base sm:text-xl font-extrabold uppercase tracking-tight text-black">
                  {profile.namaSekolah || 'SMK NEGERI 2 MAGELANG'}
                </h1>
                <p className="text-[11px] sm:text-xs italic text-slate-600 mt-0.5">
                  {profile.alamatSekolah || 'Jl. A Yani 135A Magelang Utara, Kota Magelang'}
                </p>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 mt-0.5">
                  Tahun Ajaran {profile.tahunAjaran || activeKelas.tahunAjaran || '2025/2026'} • Semester{' '}
                  {profile.semester || 'Ganjil'}
                </p>
              </div>
              {profile.fotoProfilUrl ? (
                <div className="w-14 h-18 sm:w-16 sm:h-20 border border-slate-300 rounded overflow-hidden shrink-0 shadow-2xs p-0.5 bg-white">
                  <img
                    src={profile.fotoProfilUrl}
                    alt="Foto Guru"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-xs"
                  />
                </div>
              ) : (
                <div className="w-14 sm:w-16 opacity-0 shrink-0" />
              )}
            </div>

            {/* Document Title & Meta */}
            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-lg font-bold uppercase underline tracking-wide text-slate-900 font-serif">
                {singleAgenda
                  ? `JURNAL AGENDA MENGAJAR (PERTEMUAN KE-${singleAgenda.pertemuanKe || 1})`
                  : `JURNAL AGENDA MENGAJAR GURU - KELAS ${activeKelas.namaKelas}`}
              </h3>
              <p className="text-xs text-slate-600">
                Mata Pelajaran: <strong>{profile.mapelUtama || 'Pemrograman Web'}</strong> | Guru Pengampu:{' '}
                <strong>{profile.namaGuru}</strong> (
                {profile.nip?.length >= 18 ? 'NIPPPK' : 'NIP'}: {profile.nip || '-'})
              </p>
            </div>

            {/* Table of Agendas */}
            <div className="overflow-x-auto rounded-xl border border-black">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold">
                    <th className="border border-black p-2 w-8">No</th>
                    <th className="border border-black p-2 w-24">Tgl / Jam</th>
                    <th className="border border-black p-2">Materi & Capaian Pembelajaran</th>
                    <th className="border border-black p-2 w-32">Presensi (S/I/A/D/M)</th>
                    <th className="border border-black p-2">Refleksi / Catatan Kejadian</th>
                  </tr>
                </thead>
                <tbody>
                  {classAgendas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                        Belum ada agenda mengajar yang tersimpan untuk kelas ini.
                      </td>
                    </tr>
                  ) : (
                    classAgendas.map((ag, idx) => {
                      const sakit = ag.presensi.filter(p => p.status === 'sakit').length;
                      const ijin = ag.presensi.filter(p => p.status === 'ijin').length;
                      const alpa = ag.presensi.filter(p => p.status === 'alpa').length;
                      const dispen = ag.presensi.filter(p => p.status === 'dispen').length;
                      const magang = ag.presensi.filter(p => p.status === 'magang').length;
                      const hadir = ag.presensi.filter(p => p.status === 'hadir').length;

                      return (
                        <tr key={ag.id} className="hover:bg-slate-50 transition-colors">
                          <td className="border border-black p-2 text-center font-semibold">
                            {idx + 1}
                          </td>
                          <td className="border border-black p-2 text-center">
                            <span className="font-bold text-slate-900 block">{ag.tanggal}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold inline-block mt-0.5">
                              P-{ag.pertemuanKe}
                            </span>
                            {ag.jamPelajaran && (
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                {ag.jamPelajaran}
                              </span>
                            )}
                          </td>
                          <td className="border border-black p-2">
                            <p className="font-bold text-slate-900">{ag.materi}</p>
                            {ag.capaianPembelajaran && (
                              <p className="text-[11px] text-slate-600 mt-1 italic leading-snug">
                                <strong className="not-italic text-slate-700">CP:</strong>{' '}
                                {ag.capaianPembelajaran}
                              </p>
                            )}
                            {ag.indikator && (
                              <p className="text-[10px] text-slate-500 mt-1">
                                <strong>Indikator:</strong> {ag.indikator}
                              </p>
                            )}
                          </td>
                          <td className="border border-black p-2 text-center text-[11px]">
                            <div className="font-bold text-emerald-700">Hadir: {hadir}</div>
                            <div className="text-[10px] text-slate-700 mt-0.5">
                              S: {sakit} | I: {ijin} | A: {alpa}
                            </div>
                            {(dispen > 0 || magang > 0) && (
                              <div className="text-[10px] text-purple-700 font-semibold mt-0.5">
                                {dispen > 0 && `D: ${dispen} `}
                                {magang > 0 && `M: ${magang}`}
                              </div>
                            )}
                          </td>
                          <td className="border border-black p-2 text-[11px] leading-relaxed">
                            {ag.refleksiGuru ? (
                              <div className="mb-1">
                                <strong className="text-slate-700">Refleksi:</strong> {ag.refleksiGuru}
                              </div>
                            ) : null}
                            {ag.catatanKejadian ? (
                              <div className="text-slate-600">
                                <strong className="text-slate-700">Catatan:</strong> {ag.catatanKejadian}
                              </div>
                            ) : null}
                            {!ag.refleksiGuru && !ag.catatanKejadian && (
                              <span className="text-slate-400 italic">Pembelajaran berlangsung tertib lancar.</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SIGNATURE SECTION */}
            <div className="grid grid-cols-2 gap-8 text-xs pt-8 border-t border-slate-200">
              <div className="text-center space-y-16">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold text-slate-900">Kepala {profile.namaSekolah || 'Sekolah'}</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900">
                    {profile.namaKepsek || '( .......................................... )'}
                  </p>
                  <p className="text-slate-500 font-mono text-[10px]">
                    NIP. {profile.nipKepsek || '-'}
                  </p>
                </div>
              </div>

              <div className="text-center space-y-16">
                <div>
                  <p>
                    {formatCityName(profile.alamatSekolah, profile.namaSekolah)}, {todayStrFormatted}
                  </p>
                  <p className="font-bold text-slate-900">Guru Mata Pelajaran</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900">{profile.namaGuru}</p>
                  <p className="text-slate-500 font-mono text-[10px]">
                    {profile.nip?.length >= 18 ? 'NIPPPK.' : 'NIP.'} {profile.nip || '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
