import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Upload,
  UserPlus,
  School,
  X,
  Check,
  Search,
  Download,
  AlertCircle,
  Briefcase,
  Building2,
} from 'lucide-react';
import { Kelas, Siswa } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface KelasSiswaViewProps {
  kelasList: Kelas[];
  siswaList: Siswa[];
  onSaveKelas: (kelas: Kelas) => void;
  onDeleteKelas: (id: string) => void;
  onSaveSiswa: (siswa: Siswa) => void;
  onDeleteSiswa: (id: string) => void;
  onImportSiswaBatch: (siswaArray: Siswa[]) => void;
}

export const KelasSiswaView: React.FC<KelasSiswaViewProps> = ({
  kelasList,
  siswaList,
  onSaveKelas,
  onDeleteKelas,
  onSaveSiswa,
  onDeleteSiswa,
  onImportSiswaBatch,
}) => {
  const [selectedKelasId, setSelectedKelasId] = useState<string>(kelasList[0]?.id || '');
  const [searchSiswaQuery, setSearchSiswaQuery] = useState<string>('');

  // Modals state
  const [isKelasModalOpen, setIsKelasModalOpen] = useState<boolean>(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);

  const [isSiswaModalOpen, setIsSiswaModalOpen] = useState<boolean>(false);
  const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importRawText, setImportRawText] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<
    { nis: string; nisn: string; nama: string; jk: 'L' | 'P' }[]
  >([]);

  // Deleting Confirm States
  const [deletingKelas, setDeletingKelas] = useState<Kelas | null>(null);
  const [deletingSiswa, setDeletingSiswa] = useState<Siswa | null>(null);

  // Selected class
  const activeKelas = kelasList.find(k => k.id === selectedKelasId) || kelasList[0];

  // Magang Filter Tab
  const [magangFilter, setMagangFilter] = useState<'all' | 'reguler' | 'magang'>('all');

  // All students in selected class
  const allSiswaInKelas = siswaList.filter(s => s.kelasId === selectedKelasId);
  const countMagangInKelas = allSiswaInKelas.filter(s => s.isMagang).length;
  const countRegulerInKelas = allSiswaInKelas.length - countMagangInKelas;

  // Students in selected class (filtered)
  const filteredSiswaInKelas = allSiswaInKelas
    .filter(s => {
      if (magangFilter === 'magang') return Boolean(s.isMagang);
      if (magangFilter === 'reguler') return !s.isMagang;
      return true;
    })
    .filter(
      s =>
        s.nama.toLowerCase().includes(searchSiswaQuery.toLowerCase()) ||
        s.nis.includes(searchSiswaQuery)
    );

  // Form State Kelas
  const [namaKelas, setNamaKelas] = useState('');
  const [tingkat, setTingkat] = useState('X');
  const [jurusan, setJurusan] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('2025/2026');

  // Form State Siswa
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [namaSiswa, setNamaSiswa] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<'L' | 'P'>('L');
  const [isMagang, setIsMagang] = useState<boolean>(false);

  // Quick direct toggle magang on student row
  const handleToggleMagang = (s: Siswa) => {
    const updatedSiswa: Siswa = {
      ...s,
      isMagang: !s.isMagang,
    };
    onSaveSiswa(updatedSiswa);
  };

  // Open Kelas Modal
  const handleOpenKelasModal = (k?: Kelas) => {
    if (k) {
      setEditingKelas(k);
      setNamaKelas(k.namaKelas);
      setTingkat(k.tingkat);
      setJurusan(k.jurusan);
      setTahunAjaran(k.tahunAjaran);
    } else {
      setEditingKelas(null);
      setNamaKelas('');
      setTingkat('X');
      setJurusan('');
      setTahunAjaran('2025/2026');
    }
    setIsKelasModalOpen(true);
  };

  const handleSaveKelasSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKelas) return;

    const k: Kelas = {
      id: editingKelas ? editingKelas.id : `k-${Date.now()}`,
      namaKelas,
      tingkat,
      jurusan,
      tahunAjaran,
    };

    onSaveKelas(k);
    if (!editingKelas) setSelectedKelasId(k.id);
    setIsKelasModalOpen(false);
  };

  // Open Siswa Modal
  const handleOpenSiswaModal = (s?: Siswa) => {
    if (s) {
      setEditingSiswa(s);
      setNis(s.nis);
      setNisn(s.nisn || '');
      setNamaSiswa(s.nama);
      setJenisKelamin(s.jenisKelamin);
      setIsMagang(Boolean(s.isMagang));
    } else {
      setEditingSiswa(null);
      setNis('');
      setNisn('');
      setNamaSiswa('');
      setJenisKelamin('L');
      setIsMagang(false);
    }
    setIsSiswaModalOpen(true);
  };

  const handleSaveSiswaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaSiswa || !selectedKelasId) return;

    const s: Siswa = {
      id: editingSiswa ? editingSiswa.id : `s-${Date.now()}`,
      kelasId: selectedKelasId,
      nis,
      nisn,
      nama: namaSiswa,
      jenisKelamin,
      isMagang,
    };

    onSaveSiswa(s);
    setIsSiswaModalOpen(false);
  };

  // Handle Excel File Upload (.xlsx, .xls, .csv, .ods)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          alert('Sheet dalam file Excel tidak terdeteksi.');
          return;
        }

        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rows || rows.length === 0) {
          alert('File Excel kosong atau tidak berisi data.');
          return;
        }

        // Find header row index by scanning first 10 rows
        let headerRowIndex = 0;
        let nisCol = -1;
        let nisnCol = -1;
        let namaCol = -1;
        let jkCol = -1;

        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const rowStr = rows[r].map(cell => String(cell || '').toLowerCase().trim());
          const foundNama = rowStr.findIndex(
            cell => cell.includes('nama') || cell.includes('siswa') || cell.includes('student')
          );

          if (foundNama !== -1) {
            headerRowIndex = r;
            namaCol = foundNama;
            nisCol = rowStr.findIndex(cell => cell.includes('nis') && !cell.includes('nisn'));
            nisnCol = rowStr.findIndex(cell => cell.includes('nisn'));
            jkCol = rowStr.findIndex(
              cell =>
                cell.includes('jk') ||
                cell.includes('l/p') ||
                cell.includes('kelamin') ||
                cell.includes('gender')
            );
            break;
          }
        }

        // Fallback column positions if no header found
        if (namaCol === -1) {
          if (rows[0].length >= 4) {
            nisCol = 0;
            nisnCol = 1;
            namaCol = 2;
            jkCol = 3;
          } else if (rows[0].length === 3) {
            nisCol = 0;
            namaCol = 1;
            jkCol = 2;
          } else {
            nisCol = 0;
            namaCol = 1;
          }
        }

        const parsedList: { nis: string; nisn: string; nama: string; jk: 'L' | 'P' }[] = [];

        for (let r = headerRowIndex + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          const rawNama = namaCol >= 0 ? String(row[namaCol] || '').trim() : '';
          if (
            !rawNama ||
            rawNama.toLowerCase().includes('nama') ||
            rawNama.toLowerCase().includes('total')
          ) {
            continue;
          }

          const rawNis = nisCol >= 0 ? String(row[nisCol] || '').trim() : '';
          const rawNisn = nisnCol >= 0 ? String(row[nisnCol] || '').trim() : '';
          const rawJk = jkCol >= 0 ? String(row[jkCol] || '').trim() : '';

          let gender: 'L' | 'P' = 'L';
          if (rawJk) {
            const upperJk = rawJk.toUpperCase();
            if (
              upperJk.startsWith('P') ||
              upperJk.includes('PEREMPUAN') ||
              upperJk.includes('FEMALE') ||
              upperJk === '2'
            ) {
              gender = 'P';
            }
          }

          parsedList.push({
            nis: rawNis || `${2025000 + parsedList.length + 1}`,
            nisn: rawNisn,
            nama: rawNama,
            jk: gender,
          });
        }

        if (parsedList.length === 0) {
          alert('Tidak ada data siswa yang valid dibaca. Pastikan kolom Nama terisi.');
        }

        setParsedPreview(parsedList);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        alert('Gagal membaca file Excel. Pastikan format file .xlsx, .xls, atau .csv valid.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Download Official Excel Template
  const handleDownloadExcelTemplate = () => {
    const templateRows = [
      ['NIS', 'NISN', 'NAMA LENGKAP', 'JENIS KELAMIN (L/P)'],
      ['2025001', '0081234561', 'Ahmad Rizky Pratama', 'L'],
      ['2025002', '0081234562', 'Anisa Rahmawati', 'P'],
      ['2025003', '0081234563', 'Budi Santoso', 'L'],
      ['2025004', '0081234564', 'Citra Dewi Kartika', 'P'],
      ['2025005', '0081234565', 'Dhani Ferdiansyah', 'L'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateRows);
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 18 },
      { wch: 32 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');

    const className = activeKelas?.namaKelas ? activeKelas.namaKelas.replace(/[^a-zA-Z0-9]/g, '_') : 'Siswa';
    XLSX.writeFile(workbook, `Template_Impor_Siswa_${className}.xlsx`);
  };

  // Process Raw Text Fallback (Paste CSV / Tab-separated)
  const handleParseImportText = (text: string) => {
    setImportRawText(text);
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const parsed = lines
      .map((line, index) => {
        const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length < 2) return null;

        if (
          index === 0 &&
          (parts[0].toLowerCase().includes('nis') || parts[1].toLowerCase().includes('nama'))
        ) {
          return null;
        }

        let itemNis = '';
        let itemNisn = '';
        let itemNama = '';
        let itemJk: 'L' | 'P' = 'L';

        if (parts.length >= 4) {
          itemNis = parts[0];
          itemNisn = parts[1];
          itemNama = parts[2];
          itemJk = parts[3].toUpperCase().startsWith('P') ? 'P' : 'L';
        } else if (parts.length === 3) {
          itemNis = parts[0];
          itemNama = parts[1];
          itemJk = parts[2].toUpperCase().startsWith('P') ? 'P' : 'L';
        } else {
          itemNis = parts[0];
          itemNama = parts[1];
        }

        if (!itemNama) return null;

        return {
          nis: itemNis || `${2025000 + index}`,
          nisn: itemNisn,
          nama: itemNama,
          jk: itemJk,
        };
      })
      .filter(Boolean) as { nis: string; nisn: string; nama: string; jk: 'L' | 'P' }[];

    setParsedPreview(parsed);
  };

  const handleExecuteImport = () => {
    if (parsedPreview.length === 0 || !selectedKelasId) return;

    const newSiswaList: Siswa[] = parsedPreview.map((item, idx) => ({
      id: `s-imp-${Date.now()}-${idx}`,
      kelasId: selectedKelasId,
      nis: item.nis,
      nisn: item.nisn,
      nama: item.nama,
      jenisKelamin: item.jk,
    }));

    onImportSiswaBatch(newSiswaList);
    setIsImportModalOpen(false);
    setImportRawText('');
    setSelectedFileName('');
    setParsedPreview([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Manajemen Data Kelas & Siswa</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola daftar kelas, data induk siswa, dan fasilitas impor data siswa sekaligus.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenKelasModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kelas</span>
          </button>
          <button
            onClick={() => {
              setImportRawText('');
              setParsedPreview([]);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Impor Siswa Excel</span>
          </button>
          <button
            onClick={() => handleOpenSiswaModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Select Kelas Bar & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* List of Kelas Chips */}
        <div className="md:col-span-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 shrink-0 uppercase tracking-wider pl-2 pr-1">
            Kelas:
          </span>
          {kelasList.map(k => {
            const isSelected = k.id === selectedKelasId;
            const countSiswa = siswaList.filter(s => s.kelasId === k.id).length;

            return (
              <div
                key={k.id}
                onClick={() => setSelectedKelasId(k.id)}
                className={`px-4 py-2.5 rounded-2xl cursor-pointer transition-all flex items-center gap-3 shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                }`}
              >
                <div>
                  <p className="text-xs">{k.namaKelas}</p>
                  <p
                    className={`text-[10px] font-normal ${
                      isSelected ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {countSiswa} Siswa
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenKelasModal(k);
                    }}
                    className={`p-1 rounded-md hover:bg-black/10 ${
                      isSelected ? 'text-white' : 'text-slate-400'
                    }`}
                    title="Edit Kelas"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  {kelasList.length > 1 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setDeletingKelas(k);
                      }}
                      className={`p-1 rounded-md hover:bg-black/10 ${
                        isSelected ? 'text-rose-200' : 'text-rose-400'
                      }`}
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Class Info Card */}
        <div className="bg-indigo-50/70 p-4 rounded-3xl border border-indigo-100/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Kelas Aktif</p>
            <p className="text-base font-extrabold text-indigo-900">{activeKelas?.namaKelas || '-'}</p>
            <p className="text-xs text-indigo-600">{activeKelas?.jurusan}</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-indigo-700">
              {filteredSiswaInKelas.length}
            </span>
            <span className="text-[10px] text-indigo-500 block">Siswa</span>
          </div>
        </div>
      </div>

      {/* Student List Table Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchSiswaQuery}
                onChange={e => setSearchSiswaQuery(e.target.value)}
                placeholder="Cari NIS atau Nama Siswa..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Filter Magang / Reguler Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMagangFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  magangFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Semua ({allSiswaInKelas.length})
              </button>
              <button
                type="button"
                onClick={() => setMagangFilter('reguler')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  magangFilter === 'reguler'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Reguler ({countRegulerInKelas})
              </button>
              <button
                type="button"
                onClick={() => setMagangFilter('magang')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  magangFilter === 'magang'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-indigo-600 hover:text-indigo-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Magang ({countMagangInKelas})</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span>
              Laki-laki:{' '}
              <strong className="text-slate-800">
                {filteredSiswaInKelas.filter(s => s.jenisKelamin === 'L').length}
              </strong>
            </span>
            <span>•</span>
            <span>
              Perempuan:{' '}
              <strong className="text-slate-800">
                {filteredSiswaInKelas.filter(s => s.jenisKelamin === 'P').length}
              </strong>
            </span>
            {countMagangInKelas > 0 && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold">
                  <Building2 className="w-3 h-3" />
                  {countMagangInKelas} Magang
                </span>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100 pb-3">
                <th className="pb-3 font-semibold pl-3 w-12">No</th>
                <th className="pb-3 font-semibold">NIS</th>
                <th className="pb-3 font-semibold">NISN</th>
                <th className="pb-3 font-semibold">Nama Lengkap Siswa</th>
                <th className="pb-3 font-semibold text-center">L/P</th>
                <th className="pb-3 font-semibold text-center">Status Magang / PKL</th>
                <th className="pb-3 font-semibold text-right pr-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSiswaInKelas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada data siswa di kelas ini dengan filter tersebut.
                  </td>
                </tr>
              ) : (
                filteredSiswaInKelas.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 pl-3 font-semibold text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 font-bold text-slate-700">{s.nis}</td>
                    <td className="py-3.5 text-slate-500">{s.nisn || '-'}</td>
                    <td className="py-3.5 font-semibold text-slate-800 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{s.nama}</span>
                        {s.isMagang && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Building2 className="w-3 h-3" />
                            Magang
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          s.jenisKelamin === 'L'
                            ? 'bg-sky-50 text-sky-600 border border-sky-100'
                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}
                      >
                        {s.jenisKelamin}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleMagang(s)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                          s.isMagang
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 ring-2 ring-indigo-500/20'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                        title={
                          s.isMagang
                            ? 'Siswa sedang magang. Klik untuk menonaktifkan magang (kembali reguler)'
                            : 'Siswa reguler. Klik untuk mengaktifkan status magang / PKL'
                        }
                      >
                        {/* Toggle switch visual */}
                        <span
                          className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors ${
                            s.isMagang ? 'bg-indigo-900/40 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <span className="bg-white w-3 h-3 rounded-full shadow-md" />
                        </span>
                        <span>{s.isMagang ? 'Sedang Magang' : 'Reguler (Kelas)'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 text-right pr-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenSiswaModal(s)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                          title="Edit Siswa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingSiswa(s)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD Kelas */}
      {isKelasModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">
                {editingKelas ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
              </h3>
              <button
                onClick={() => setIsKelasModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKelasSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Kelas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={namaKelas}
                  onChange={e => setNamaKelas(e.target.value)}
                  placeholder="Contoh: X RPL 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat</label>
                  <select
                    value={tingkat}
                    onChange={e => setTingkat(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                  <input
                    type="text"
                    value={tahunAjaran}
                    onChange={e => setTahunAjaran(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jurusan / Keahlian</label>
                <input
                  type="text"
                  value={jurusan}
                  onChange={e => setJurusan(e.target.value)}
                  placeholder="Contoh: Rekayasa Perangkat Lunak"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsKelasModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CRUD Siswa */}
      {isSiswaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">
                {editingSiswa ? 'Edit Data Siswa' : `Tambah Siswa (${activeKelas?.namaKelas})`}
              </h3>
              <button
                onClick={() => setIsSiswaModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSiswaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Siswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={namaSiswa}
                  onChange={e => setNamaSiswa(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIS</label>
                  <input
                    type="text"
                    value={nis}
                    onChange={e => setNis(e.target.value)}
                    placeholder="2025001"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NISN</label>
                  <input
                    type="text"
                    value={nisn}
                    onChange={e => setNisn(e.target.value)}
                    placeholder="008123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="jk"
                      value="L"
                      checked={jenisKelamin === 'L'}
                      onChange={() => setJenisKelamin('L')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Laki-Laki (L)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="jk"
                      value="P"
                      checked={jenisKelamin === 'P'}
                      onChange={() => setJenisKelamin('P')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Perempuan (P)</span>
                  </label>
                </div>
              </div>

              {/* Status Magang / PKL Toggle in Modal */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800">Status Magang / PKL Industri</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Aktifkan jika siswa sedang menjalankan magang/PKL. Saat aktif, presensi siswa di seluruh agenda otomatis terkunci sebagai Magang dan tidak dapat diubah di menu presensi harian.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMagang(!isMagang)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                    isMagang ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSiswaModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impor Siswa Excel / CSV */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>Impor Siswa ke Kelas {activeKelas?.namaKelas}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload file Excel (.xlsx / .xls) atau CSV. Data akan otomatis diproses ke kelas ini.
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Template Download Banner */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0 font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Belum punya format file Excel?</h4>
                    <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                      Unduh template resmi .xlsx kami yang sudah rapi dengan kolom NIS, NISN, Nama, dan L/P.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Template (.xlsx)</span>
                </button>
              </div>

              {/* Upload Zone */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Upload File Excel (.xlsx, .xls, .csv):
                </label>
                <div className="p-5 border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl transition-all flex flex-col items-center justify-center text-center cursor-pointer relative group">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.ods"
                    onChange={handleExcelFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-12 h-12 bg-emerald-100/80 group-hover:bg-emerald-200/80 text-emerald-700 rounded-2xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedFileName ? (
                      <span className="text-emerald-700">File Terpilih: {selectedFileName}</span>
                    ) : (
                      'Klik atau Tarik File Excel di Sini'
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mendukung format Microsoft Excel (.xlsx, .xls) & CSV
                  </p>
                </div>
              </div>

              {/* Alternative Text Paste */}
              <details className="text-xs group">
                <summary className="font-semibold text-slate-500 hover:text-slate-700 cursor-pointer select-none">
                  Atau Paste/Salin Teks Langsung (CSV/Tabbed)
                </summary>
                <div className="mt-2.5">
                  <textarea
                    rows={4}
                    value={importRawText}
                    onChange={e => handleParseImportText(e.target.value)}
                    placeholder={`Contoh format per baris:\n2025001, 0081234, Ahmad Rizky, L\n2025002, 0081235, Anisa Rahma, P`}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </details>

              {/* Preview Table & Stats */}
              {parsedPreview.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-800">
                        Hasil Deteksi: {parsedPreview.length} Siswa Siap Diimpor
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                      <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                        L: {parsedPreview.filter(p => p.jk === 'L').length}
                      </span>
                      <span className="bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-lg border border-rose-100">
                        P: {parsedPreview.filter(p => p.jk === 'P').length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setParsedPreview([]);
                          setSelectedFileName('');
                          setImportRawText('');
                        }}
                        className="text-rose-500 hover:underline cursor-pointer"
                      >
                        Bersihkan
                      </button>
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 pl-3">No</th>
                          <th className="p-2.5">NIS</th>
                          <th className="p-2.5">NISN</th>
                          <th className="p-2.5">Nama Lengkap Siswa</th>
                          <th className="p-2.5 text-center">L/P</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 pl-3 font-medium text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-700">{item.nis}</td>
                            <td className="p-2.5 font-mono text-slate-500">{item.nisn || '-'}</td>
                            <td className="p-2.5 font-semibold text-slate-800">{item.nama}</td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                  item.jk === 'P'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {item.jk}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={parsedPreview.length === 0}
                  onClick={handleExecuteImport}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Simpan & Impor {parsedPreview.length} Siswa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Kelas */}
      <ConfirmModal
        isOpen={Boolean(deletingKelas)}
        title="Hapus Kelas"
        message={`Apakah Anda yakin ingin menghapus kelas ${deletingKelas?.namaKelas}? Seluruh data siswa dan agenda yang terkait dengan kelas ini akan ikut terhapus.`}
        confirmText="Ya, Hapus Kelas"
        cancelText="Batal"
        danger={true}
        onClose={() => setDeletingKelas(null)}
        onConfirm={() => {
          if (deletingKelas) {
            onDeleteKelas(deletingKelas.id);
            setDeletingKelas(null);
          }
        }}
      />

      {/* Confirmation Modal for Delete Siswa */}
      <ConfirmModal
        isOpen={Boolean(deletingSiswa)}
        title="Hapus Data Siswa"
        message={`Apakah Anda yakin ingin menghapus data siswa ${deletingSiswa?.nama}? Riwayat presensi dan nilai siswa ini akan terhapus.`}
        confirmText="Ya, Hapus Siswa"
        cancelText="Batal"
        danger={true}
        onClose={() => setDeletingSiswa(null)}
        onConfirm={() => {
          if (deletingSiswa) {
            onDeleteSiswa(deletingSiswa.id);
            setDeletingSiswa(null);
          }
        }}
      />
    </div>
  );
};
