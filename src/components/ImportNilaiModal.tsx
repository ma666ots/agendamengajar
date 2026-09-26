import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  Check,
  AlertCircle,
  Sparkles,
  Info,
  CheckSquare,
  Calculator,
} from 'lucide-react';
import { Kelas, Siswa, PenilaianSession, NilaiSiswa } from '../types';

interface ImportNilaiModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeKelas: Kelas;
  siswaList: Siswa[];
  defaultMapel: string;
  onSavePenilaian: (session: PenilaianSession) => void;
  existingSession?: PenilaianSession | null;
}

interface ParsedRow {
  siswaId: string;
  nama: string;
  nis: string;
  nilai: number;
  statusTugas?: 'Sudah' | 'Belum';
  catatan?: string;
  matched: boolean;
}

export const ImportNilaiModal: React.FC<ImportNilaiModalProps> = ({
  isOpen,
  onClose,
  activeKelas,
  siswaList,
  defaultMapel,
  onSavePenilaian,
  existingSession,
}) => {
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[][] | null>(null);
  const [detectedScoreCols, setDetectedScoreCols] = useState<{ index: number; name: string }[]>([]);
  const [selectedScoreColIdx, setSelectedScoreColIdx] = useState<number>(-1);

  const [namaPenilaian, setNamaPenilaian] = useState<string>(
    existingSession?.namaPenilaian || ''
  );
  const [jenisPenilaian, setJenisPenilaian] = useState<
    'Formatif' | 'Sumatif' | 'Tugas' | 'UH' | 'UTS' | 'UAS' | 'Ceklis'
  >(existingSession?.jenisPenilaian || 'Tugas');
  const [skalaPenilaian, setSkalaPenilaian] = useState<'angka' | 'ceklis'>(
    existingSession?.skalaPenilaian || 'angka'
  );
  const [mapel, setMapel] = useState<string>(existingSession?.mapel || defaultMapel || 'Mata Pelajaran');
  const [tanggal, setTanggal] = useState<string>(
    existingSession?.tanggal || new Date().toISOString().substring(0, 10)
  );
  const [kkm, setKkm] = useState<number>(existingSession?.kkm || 75);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter siswa belonging to this class
  const classSiswa = siswaList.filter(s => s.kelasId === activeKelas.id);

  // 1. Download Template Excel (.xlsx) pre-populated with class students
  const handleDownloadTemplate = (mode: 'angka' | 'ceklis') => {
    const data = classSiswa.map((s, idx) => ({
      No: idx + 1,
      NIS: s.nis || '',
      NISN: s.nisn || '',
      'Nama Siswa': s.nama,
      [mode === 'angka' ? 'Nilai (0-100)' : 'Status Pengumpulan (Sudah/Belum)']:
        mode === 'angka' ? '' : 'Sudah',
      'Catatan Guru': '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 }, // No
      { wch: 12 }, // NIS
      { wch: 15 }, // NISN
      { wch: 32 }, // Nama Siswa
      { wch: 30 }, // Nilai / Status
      { wch: 25 }, // Catatan Guru
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = mode === 'angka' ? 'Nilai_Angka' : 'Ceklis_Tugas';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const safeClassName = activeKelas.namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename =
      mode === 'angka'
        ? `Template_Nilai_Angka_${safeClassName}.xlsx`
        : `Template_Ceklis_Tugas_${safeClassName}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Process rows helper with multi-column support
  const processRowsData = (rows: any[][], preferredCol?: number, defaultTitle?: string) => {
    if (!rows || rows.length === 0) {
      setErrorMessage('Data kosong atau tidak memiliki baris.');
      return;
    }

    // Detect header row
    let headerRowIndex = 0;
    let namaCol = -1;
    let nisCol = -1;
    let nisnCol = -1;
    let catatanCol = -1;

    for (let i = 0; i < Math.min(6, rows.length); i++) {
      const rowStr = rows[i].map((c: any) => String(c).toLowerCase().trim());
      if (
        rowStr.some(
          (c: string) =>
            c.includes('nama') ||
            c.includes('siswa') ||
            c.includes('nilai') ||
            c.includes('status') ||
            c.includes('ceklis')
        )
      ) {
        headerRowIndex = i;
        namaCol = rowStr.findIndex((c: string) => c.includes('nama') || c.includes('siswa'));
        nisCol = rowStr.findIndex((c: string) => c === 'nis' || (c.includes('nis') && !c.includes('nisn')));
        nisnCol = rowStr.findIndex((c: string) => c.includes('nisn'));
        catatanCol = rowStr.findIndex(
          (c: string) =>
            c.includes('catatan') ||
            c.includes('keterangan') ||
            c.includes('evaluasi') ||
            c.includes('note')
        );
        break;
      }
    }

    if (namaCol === -1) {
      namaCol = 1;
    }

    const headerRow = rows[headerRowIndex] || [];
    const candidateCols: { index: number; name: string }[] = [];

    headerRow.forEach((colVal: any, colIdx: number) => {
      const colName = String(colVal || '').trim();
      const colLower = colName.toLowerCase();
      if (!colName) return;
      if (colIdx === namaCol || colIdx === nisCol || colIdx === nisnCol || colIdx === catatanCol) return;
      if (colLower === 'no' || colLower === 'nomor' || colLower === '#') return;
      candidateCols.push({ index: colIdx, name: colName });
    });

    setDetectedScoreCols(candidateCols);

    let activeColIdx = preferredCol !== undefined && preferredCol >= 0 ? preferredCol : -1;
    if (activeColIdx === -1) {
      // Pick first candidate that says nilai or skor, else first candidate, else col 2
      const matchedNilai = candidateCols.find(c => c.name.toLowerCase().includes('nilai') || c.name.toLowerCase().includes('skor'));
      if (matchedNilai) {
        activeColIdx = matchedNilai.index;
      } else if (candidateCols.length > 0) {
        activeColIdx = candidateCols[0].index;
      } else {
        activeColIdx = namaCol + 1;
      }
    }

    setSelectedScoreColIdx(activeColIdx);

    const activeColObj = candidateCols.find(c => c.index === activeColIdx);
    const resolvedTitle = activeColObj ? activeColObj.name : defaultTitle;
    if (resolvedTitle && (!namaPenilaian || candidateCols.some(c => c.name === namaPenilaian))) {
      setNamaPenilaian(resolvedTitle);
    }

    const results: ParsedRow[] = [];
    let hasChecklistValues = false;

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c: any) => String(c).trim() === '')) continue;

      const rawNama = String(namaCol !== -1 && row[namaCol] ? row[namaCol] : '').trim();
      const rawNis = String(nisCol !== -1 && row[nisCol] ? row[nisCol] : '').trim();
      const rawNisn = String(nisnCol !== -1 && row[nisnCol] ? row[nisnCol] : '').trim();
      const rawNilai = row[activeColIdx];
      const rawCatatan = catatanCol !== -1 && row[catatanCol] ? String(row[catatanCol]).trim() : '';

      let parsedNilai = 0;
      let parsedStatus: 'Sudah' | 'Belum' | undefined = undefined;

      const strVal = String(rawNilai ?? '').toLowerCase().trim();
      const sudahMatches = ['sudah', 'selesai', 'lengkap', 'done', 'y', 'ya', 'v', 'ok', 'ada', 'tuntas'];
      const belumMatches = ['belum', 'tidak', 't', 'n', 'no', 'x', 'kurang', 'kosong', 'alpa', 'remedial'];

      if (sudahMatches.includes(strVal)) {
        parsedStatus = 'Sudah';
        parsedNilai = 100;
        hasChecklistValues = true;
      } else if (belumMatches.includes(strVal)) {
        parsedStatus = 'Belum';
        parsedNilai = 0;
        hasChecklistValues = true;
      } else if (typeof rawNilai === 'number') {
        parsedNilai = rawNilai;
      } else if (typeof rawNilai === 'string' && rawNilai.trim() !== '') {
        const cleanNum = rawNilai.replace(',', '.').replace(/[^0-9.]/g, '');
        parsedNilai = parseFloat(cleanNum) || 0;
      }

      // Match with existing student in active class
      let matchedStudent = classSiswa.find(
        s =>
          (rawNis && s.nis && s.nis.trim() === rawNis) ||
          (rawNisn && s.nisn && s.nisn.trim() === rawNisn)
      );

      if (!matchedStudent && rawNama) {
        matchedStudent = classSiswa.find(
          s =>
            s.nama.toLowerCase().trim() === rawNama.toLowerCase() ||
            s.nama.toLowerCase().includes(rawNama.toLowerCase()) ||
            rawNama.toLowerCase().includes(s.nama.toLowerCase())
        );
      }

      if (matchedStudent) {
        results.push({
          siswaId: matchedStudent.id,
          nama: matchedStudent.nama,
          nis: matchedStudent.nis,
          nilai: Math.min(100, Math.max(0, parsedNilai)),
          statusTugas: parsedStatus,
          catatan: rawCatatan,
          matched: true,
        });
      } else if (rawNama) {
        results.push({
          siswaId: `unmatched-${r}`,
          nama: rawNama,
          nis: rawNis || '-',
          nilai: Math.min(100, Math.max(0, parsedNilai)),
          statusTugas: parsedStatus,
          catatan: rawCatatan,
          matched: false,
        });
      }
    }

    // Fill missing students
    const missingStudents = classSiswa.filter(
      s => !results.some(res => res.siswaId === s.id)
    );

    missingStudents.forEach(ms => {
      results.push({
        siswaId: ms.id,
        nama: ms.nama,
        nis: ms.nis,
        nilai: 0,
        statusTugas: 'Belum',
        catatan: 'Belum ada data di file',
        matched: true,
      });
    });

    if (results.length === 0) {
      setErrorMessage('Tidak ada baris data nilai atau nama siswa yang dapat diproses.');
    } else {
      setParsedRows(results);
      if (hasChecklistValues && results.every(r => r.nilai === 0 || r.nilai === 100)) {
        setSkalaPenilaian('ceklis');
        setJenisPenilaian('Ceklis');
      } else {
        setSkalaPenilaian('angka');
      }
    }
  };

  // 2. Read & Parse uploaded Excel / CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();

    reader.onload = evt => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          setErrorMessage('Sheet dalam file Excel tidak terdeteksi.');
          return;
        }

        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        setRawRows(rows);
        const defaultTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/template_nilai_/i, '')
          .replace(/template_ceklis_/i, '')
          .replace(/_/g, ' ');
        processRowsData(rows, undefined, defaultTitle);
      } catch (err: any) {
        console.error('Error parsing excel:', err);
        setErrorMessage('Gagal membaca file Excel. Pastikan format file valid.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle direct text / CSV paste
  const handleProcessPastedText = () => {
    setErrorMessage(null);
    if (!pastedText.trim()) {
      setErrorMessage('Silakan tempel teks CSV, TSV, atau data tabel terlebih dahulu.');
      return;
    }
    try {
      const workbook = XLSX.read(pastedText, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      setRawRows(rows);
      processRowsData(rows, undefined, 'Nilai Tugas Impor');
    } catch (err: any) {
      console.error('Error parsing pasted text:', err);
      // Fallback manual split
      const lines = pastedText.trim().split('\n').map(l => l.split(/[\t;,]/).map(c => c.trim()));
      setRawRows(lines);
      processRowsData(lines, undefined, 'Nilai Tugas Impor');
    }
  };

  // Handle column selection switch
  const handleSelectScoreColumn = (newColIdx: number) => {
    if (!rawRows) return;
    const colObj = detectedScoreCols.find(c => c.index === newColIdx);
    if (colObj) {
      setNamaPenilaian(colObj.name);
    }
    processRowsData(rawRows, newColIdx, colObj?.name);
  };

  // 3. Save Import Session
  const handleSave = () => {
    if (!namaPenilaian.trim()) {
      setErrorMessage('Silakan isi Nama Penilaian / Judul Tugas terlebih dahulu.');
      return;
    }

    const matchedOnly = parsedRows.filter(r => r.matched);
    if (matchedOnly.length === 0) {
      setErrorMessage('Tidak ada data siswa yang cocok untuk disimpan.');
      return;
    }

    const isChecklist = skalaPenilaian === 'ceklis';

    const daftarNilai: NilaiSiswa[] = matchedOnly.map(r => ({
      siswaId: r.siswaId,
      nilai: isChecklist ? (r.statusTugas === 'Belum' ? 0 : 100) : r.nilai,
      statusTugas: isChecklist ? (r.statusTugas || (r.nilai > 0 ? 'Sudah' : 'Belum')) : undefined,
      catatan: r.catatan,
    }));

    const session: PenilaianSession = {
      id: existingSession ? existingSession.id : `pen-ex-${Date.now()}`,
      agendaId: existingSession?.agendaId,
      kelasId: activeKelas.id,
      mapel,
      tanggal,
      jenisPenilaian: isChecklist ? 'Ceklis' : jenisPenilaian,
      skalaPenilaian,
      namaPenilaian,
      kkm: isChecklist ? 100 : kkm,
      daftarNilai,
    };

    onSavePenilaian(session);
    onClose();
  };

  const matchedCount = parsedRows.filter(r => r.matched).length;
  const avgScore =
    matchedCount > 0
      ? Math.round(
          parsedRows
            .filter(r => r.matched)
            .reduce((acc, curr) => acc + curr.nilai, 0) / matchedCount
        )
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Impor Nilai / Ceklis Tugas (Excel / CSV)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelas: <strong className="text-slate-800">{activeKelas.namaKelas}</strong> ({classSiswa.length} Siswa Terdaftar)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step 1: Download Templates */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                Langkah 1: Unduh Format Template
              </span>
              <h4 className="text-xs font-bold text-indigo-950">
                Pilih format template Excel yang sesuai dengan kebutuhan penilaian Anda:
              </h4>
              <p className="text-[11px] text-slate-500">
                Template otomatis memuat seluruh nama siswa dan NIS di kelas {activeKelas.namaKelas}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadTemplate('angka')}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Template Nilai Angka</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate('ceklis')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Template Ceklis Tugas</span>
              </button>
            </div>
          </div>

          {/* Step 2: Input Method (Upload or Direct Paste) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Langkah 2: Masukkan Data Nilai (Unggah atau Tempel Teks)
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputMode === 'file'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📁 Unggah File
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputMode === 'paste'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📋 Tempel Teks / CSV
                </button>
              </div>
            </div>

            {inputMode === 'file' ? (
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
                <Upload className="w-8 h-8 text-indigo-600" />
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800">
                    {selectedFileName ? selectedFileName : 'Pilih file Excel (.xlsx, .xls) atau CSV'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Klik untuk menelusuri file dari perangkat Anda
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Tempelkan data CSV, TSV (tab-separated), atau salinan tabel spreadsheet di sini...&#10;Contoh:&#10;Nama Siswa;HTML Dasar;HTML Praktek;Ulangan Bootstrap;IBM;Bootstrap Praktek&#10;AHMAD DWI NUR HIDAYAT;85;90;88;92;86"
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleProcessPastedText}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Proses Data Teks</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 3: Configure Assessment Details & Preview Results */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Langkah 3: Atur Rincian Tugas & Pratinjau Nilai
                </span>
                {detectedScoreCols.length > 1 && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-800 shrink-0">
                      Pilih Kolom Tugas:
                    </span>
                    <select
                      value={selectedScoreColIdx}
                      onChange={e => handleSelectScoreColumn(parseInt(e.target.value))}
                      className="text-xs font-bold text-amber-950 bg-white border border-amber-300 rounded-lg px-2 py-0.5 focus:outline-none cursor-pointer"
                    >
                      {detectedScoreCols.map(c => (
                        <option key={c.index} value={c.index}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Assessment Form Config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Judul Tugas / Penilaian:
                  </label>
                  <input
                    type="text"
                    value={namaPenilaian}
                    onChange={e => setNamaPenilaian(e.target.value)}
                    placeholder="Contoh: Tugas 1 - Dasar HTML & CSS"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Skala Penilaian:
                  </label>
                  <select
                    value={skalaPenilaian}
                    onChange={e => setSkalaPenilaian(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="angka">Nilai Angka (0-100)</option>
                    <option value="ceklis">Ceklis Tugas (Sudah/Belum)</option>
                  </select>
                </div>

                {skalaPenilaian === 'angka' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">KKM:</label>
                    <input
                      type="number"
                      value={kkm}
                      onChange={e => setKkm(parseInt(e.target.value) || 75)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Status Ceklis:</label>
                    <div className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold text-center">
                      Sudah / Belum
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-semibold text-slate-600">
                  {matchedCount} dari {classSiswa.length} Siswa Cocok
                </span>
                {skalaPenilaian === 'angka' ? (
                  <span className="font-bold text-emerald-600">
                    Rata-Rata Kelas: {avgScore}
                  </span>
                ) : (
                  <span className="font-bold text-emerald-600">
                    Sudah: {parsedRows.filter(r => r.statusTugas === 'Sudah' || r.nilai > 0).length} Siswa
                  </span>
                )}
              </div>

              {/* Table Preview */}
              <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0">
                    <tr>
                      <th className="p-2.5 pl-3">No</th>
                      <th className="p-2.5">NIS</th>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5 text-center">
                        {skalaPenilaian === 'ceklis' ? 'Status Pengumpulan' : 'Nilai'}
                      </th>
                      <th className="p-2.5">Catatan</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.matched ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                        <td className="p-2.5 pl-3 text-slate-400 font-semibold">{i + 1}</td>
                        <td className="p-2.5 text-slate-500 font-mono text-[11px]">{r.nis}</td>
                        <td className="p-2.5 font-bold text-slate-800">{r.nama}</td>
                        <td className="p-2.5 text-center font-black text-slate-900">
                          {skalaPenilaian === 'ceklis' ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.statusTugas === 'Sudah' || r.nilai > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.statusTugas || (r.nilai > 0 ? 'Sudah' : 'Belum')}
                            </span>
                          ) : (
                            r.nilai
                          )}
                        </td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{r.catatan || '-'}</td>
                        <td className="p-2.5 text-center">
                          {r.matched ? (
                            <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-center gap-0.5">
                              <Check className="w-3 h-3" /> Cocok
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold text-[10px]">Tidak Cocok</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={parsedRows.length === 0}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
              parsedRows.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Simpan Data Penilaian</span>
          </button>
        </div>
      </div>
    </div>
  );
};
