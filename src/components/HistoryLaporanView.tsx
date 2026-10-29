import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Search,
  Calendar,
  BookOpen,
  CheckCircle2,
  Eye,
  Trash2,
  X,
  FileCheck,
  School,
  Download,
  CalendarCheck,
  Sparkles,
  Pencil,
} from 'lucide-react';
import {
  TeacherProfile,
  Kelas,
  Siswa,
  AgendaMengajar,
  PenilaianSession,
} from '../types';
import { ShareableJurnalModal } from './ShareableJurnalModal';
import { ShareablePresensiModal } from './ShareablePresensiModal';
import { ShareableNilaiModal } from './ShareableNilaiModal';
import { ConfirmModal } from './ConfirmModal';

interface HistoryLaporanViewProps {
  profile: TeacherProfile;
  kelasList: Kelas[];
  siswaList: Siswa[];
  agendaList: AgendaMengajar[];
  penilaianList: PenilaianSession[];
  onDeleteAgenda: (id: string) => void;
  onEditAgenda?: (agenda: AgendaMengajar) => void;
  onNavigateToPresensi?: () => void;
  onOpenAgendaModal?: () => void;
}

export const HistoryLaporanView: React.FC<HistoryLaporanViewProps> = ({
  profile,
  kelasList,
  siswaList,
  agendaList,
  penilaianList,
  onDeleteAgenda,
  onEditAgenda,
  onNavigateToPresensi,
  onOpenAgendaModal,
}) => {
  const [selectedKelasId, setSelectedKelasId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('last_selected_kelas_id');
      if (saved && (saved === 'all' || kelasList.some(k => k.id === saved))) {
        return saved;
      }
    }
    return 'all';
  });
  const [sortDescending, setSortDescending] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleSelectKelas = (id: string) => {
    setSelectedKelasId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('last_selected_kelas_id', id);
    }
  };

  // Shareable / Print Modals State
  const [isJurnalModalOpen, setIsJurnalModalOpen] = useState<boolean>(false);
  const [isPresensiModalOpen, setIsPresensiModalOpen] = useState<boolean>(false);
  const [isNilaiModalOpen, setIsNilaiModalOpen] = useState<boolean>(false);
  const [selectedSingleAgenda, setSelectedSingleAgenda] = useState<AgendaMengajar | null>(null);
  const [modalKelasId, setModalKelasId] = useState<string>('');
  const [deletingAgendaId, setDeletingAgendaId] = useState<string | null>(null);

  const currentModalTargetId =
    modalKelasId ||
    (selectedKelasId !== 'all' ? selectedKelasId : (kelasList[0]?.id || ''));

  const activePrintKelas =
    kelasList.find(k => k.id === currentModalTargetId) ||
    kelasList[0] || {
      id: '',
      namaKelas: 'Semua Kelas',
      tingkat: '',
      jurusan: '',
      tahunAjaran: profile.tahunAjaran || '2025/2026',
    };

  // Agendas filtered by class and search, sorted by date then pertemuanKe
  const filteredAgendas = agendaList
    .filter(a => selectedKelasId === 'all' || a.kelasId === selectedKelasId)
    .filter(
      a =>
        (a.materi || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.tanggal || '').includes(searchQuery)
    )
    .sort((a, b) => {
      const dateDiff = (b.tanggal || '').localeCompare(a.tanggal || '');
      if (dateDiff !== 0) return sortDescending ? dateDiff : -dateDiff;
      const pDiff = (b.pertemuanKe || 0) - (a.pertemuanKe || 0);
      return sortDescending ? pDiff : -pDiff;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Agenda Mengajar</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Arsip lengkap jurnal mengajar, rekapitulasi presensi, dan rekap nilai siap cetak PDF resmi.
          </p>
        </div>

        {/* Quick Actions & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onOpenAgendaModal && (
            <button
              onClick={onOpenAgendaModal}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-sky-200 group-hover:rotate-12 transition-transform" />
              <span>+ Buat Agenda Baru</span>
            </button>
          )}

          {onNavigateToPresensi && (
            <button
              onClick={onNavigateToPresensi}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              <span>Matriks Presensi</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedSingleAgenda(null);
              setModalKelasId(selectedKelasId !== 'all' ? selectedKelasId : (kelasList[0]?.id || ''));
              setIsJurnalModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Jurnal Kelas</span>
          </button>

          <button
            onClick={() => {
              setModalKelasId(selectedKelasId !== 'all' ? selectedKelasId : (kelasList[0]?.id || ''));
              setIsPresensiModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap Presensi</span>
          </button>

          <button
            onClick={() => {
              setModalKelasId(selectedKelasId !== 'all' ? selectedKelasId : (kelasList[0]?.id || ''));
              setIsNilaiModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap Nilai</span>
          </button>
        </div>
      </div>

      {/* Select Kelas Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => handleSelectKelas('all')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-2 ${
            selectedKelasId === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
        >
          <span>Semua Kelas</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              selectedKelasId === 'all' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {agendaList.length} Agenda
          </span>
        </button>

        {kelasList.map(k => {
          const isSelected = k.id === selectedKelasId;
          const countAgenda = agendaList.filter(a => a.kelasId === k.id).length;

          return (
            <button
              key={k.id}
              onClick={() => handleSelectKelas(k.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <span>{k.namaKelas}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                  isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {countAgenda} Agenda
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input & Timeline List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari materi atau tanggal..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSortDescending(!sortDescending)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{sortDescending ? 'Urutan: Terbaru' : 'Urutan: Pertemuan 1+'}</span>
            </button>

            <span className="text-xs font-semibold text-slate-500">
              Menampilkan {filteredAgendas.length} Pertemuan
            </span>
          </div>
        </div>

        {filteredAgendas.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-xs">Belum Ada Riwayat Agenda</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {selectedKelasId !== 'all'
                ? 'Tidak ada agenda pada kelas ini. Silakan pilih kelas lain atau beralih ke "Semua Kelas".'
                : 'Agenda mengajar yang Anda simpan akan muncul di sini.'}
            </p>
            {selectedKelasId !== 'all' && (
              <button
                type="button"
                onClick={() => handleSelectKelas('all')}
                className="mt-3 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Lihat Semua Kelas ({agendaList.length} Agenda)
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAgendas.map(agenda => {
              const totalHadir = agenda.presensi.filter(p => p.status === 'hadir').length;
              const totalSiswaInAgenda = agenda.presensi.length;
              const kelasObj = kelasList.find(k => k.id === agenda.kelasId);

              return (
                <div
                  key={agenda.id}
                  className="p-4 bg-slate-50/70 hover:bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      P{agenda.pertemuanKe}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{agenda.materi}</span>
                        {selectedKelasId === 'all' && kelasObj && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {kelasObj.namaKelas}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                          {agenda.tanggal}
                        </span>
                      </div>

                      {agenda.capaianPembelajaran && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          CP: {agenda.capaianPembelajaran}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] mt-2">
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Hadir: {totalHadir}/{totalSiswaInAgenda}
                        </span>

                        {agenda.adaPenilaian && (
                          <span className="text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                            Ada Nilai ({agenda.penilaian?.namaPenilaian})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onEditAgenda && (
                      <button
                        onClick={() => onEditAgenda(agenda)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                        title="Edit Agenda, Materi, Presensi & Nilai"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedSingleAgenda(agenda);
                        setModalKelasId(agenda.kelasId);
                        setIsJurnalModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                      title="Lihat Rincian, Unduh PDF, atau Cetak Pertemuan Ini"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ringkasan & Cetak</span>
                    </button>

                    <button
                      onClick={() => setDeletingAgendaId(agenda.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus Agenda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Dedicated Jurnal Mengajar Print & Export Modal */}
      <ShareableJurnalModal
        isOpen={isJurnalModalOpen}
        onClose={() => {
          setIsJurnalModalOpen(false);
          setSelectedSingleAgenda(null);
        }}
        kelasList={kelasList}
        currentKelasId={currentModalTargetId}
        onSelectKelas={kId => setModalKelasId(kId)}
        siswaList={siswaList}
        agendaList={agendaList}
        profile={profile}
        singleAgenda={selectedSingleAgenda}
      />

      {/* 2. Official Rekap Presensi Print & Export Modal */}
      <ShareablePresensiModal
        isOpen={isPresensiModalOpen}
        onClose={() => setIsPresensiModalOpen(false)}
        activeKelas={activePrintKelas}
        siswaList={siswaList}
        agendas={agendaList.filter(a => a.kelasId === activePrintKelas.id)}
        profile={profile}
        kelasList={kelasList}
        onSelectKelas={k => setModalKelasId(k.id)}
      />

      {/* 3. Official Rekap Nilai Print & Export Modal */}
      <ShareableNilaiModal
        isOpen={isNilaiModalOpen}
        onClose={() => setIsNilaiModalOpen(false)}
        activeKelas={activePrintKelas}
        siswaList={siswaList}
        sessionsList={penilaianList.filter(p => p.kelasId === activePrintKelas.id)}
        profile={profile}
        kelasList={kelasList}
        onSelectKelas={k => setModalKelasId(k.id)}
      />

      {/* Confirmation Modal for Agenda Delete */}
      <ConfirmModal
        isOpen={Boolean(deletingAgendaId)}
        title="Hapus Agenda Mengajar"
        message="Apakah Anda yakin ingin menghapus riwayat agenda mengajar ini? Data presensi dan jurnal yang tersimpan untuk pertemuan ini akan terhapus."
        confirmText="Ya, Hapus Agenda"
        cancelText="Batal"
        danger={true}
        onClose={() => setDeletingAgendaId(null)}
        onConfirm={() => {
          if (deletingAgendaId) {
            onDeleteAgenda(deletingAgendaId);
            setDeletingAgendaId(null);
          }
        }}
      />
    </div>
  );
};
