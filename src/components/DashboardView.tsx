import React, { useRef, useState } from 'react';
import {
  Users,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  ArrowRight,
  TrendingUp,
  School,
  FileCheck,
  AlertCircle,
  Camera,
  Upload,
  Pencil,
} from 'lucide-react';
import {
  TeacherProfile,
  Kelas,
  Siswa,
  JadwalMengajar,
  AgendaMengajar,
  HariName,
  ActiveTab,
  PenilaianSession,
} from '../types';
import { compressImage } from '../utils/imageUtils';

interface DashboardViewProps {
  profile: TeacherProfile;
  kelasList: Kelas[];
  siswaList: Siswa[];
  jadwalList: JadwalMengajar[];
  agendaList: AgendaMengajar[];
  penilaianExtraList?: PenilaianSession[];
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAgendaWithJadwal: (jadwal: JadwalMengajar) => void;
  onOpenAgendaModal: () => void;
  onEditAgenda?: (agenda: AgendaMengajar) => void;
  onSaveProfile?: (p: TeacherProfile) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  kelasList,
  siswaList,
  jadwalList,
  agendaList,
  penilaianExtraList = [],
  setActiveTab,
  onOpenAgendaWithJadwal,
  onOpenAgendaModal,
  onEditAgenda,
  onSaveProfile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const teacherInitials = profile.namaGuru
    ? profile.namaGuru
        .split(' ')
        .filter(p => !p.includes('.') && !p.includes(','))
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase() || 'AS'
    : 'AS';

  const handleQuickUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSaveProfile) {
      try {
        setIsCompressing(true);
        const compressed = await compressImage(file, 600, 600, 0.88);
        onSaveProfile({
          ...profile,
          fotoProfilUrl: compressed,
        });
      } catch (err) {
        console.error('Gagal memproses foto profil:', err);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  // Determine today's day name in Indonesian (Senin - Jumat)
  const dayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const daysMap: (HariName | null)[] = [null, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', null];
  const todayName: HariName | null = daysMap[dayIndex] ?? null;

  // Jadwal Hari Ini
  const jadwalHariIni = todayName ? jadwalList.filter(j => j.hari === todayName) : [];

  // Statistics
  const totalKelas = kelasList.length;
  const totalSiswa = siswaList.length;
  const totalAgenda = agendaList.length;

  // Kehadiran Rata-rata
  let totalPresensiCount = 0;
  let totalHadirCount = 0;
  agendaList.forEach(a => {
    a.presensi.forEach(p => {
      totalPresensiCount++;
      if (p.status === 'hadir') totalHadirCount++;
    });
  });
  const avgAttendancePercent =
    totalPresensiCount > 0 ? Math.round((totalHadirCount / totalPresensiCount) * 100) : 100;

  // Total Penilaian Done (unique across agenda and standalone penilaian)
  const allUniquePenilaianIds = new Set<string>();
  agendaList.filter(a => a.adaPenilaian && a.penilaian).forEach(a => {
    allUniquePenilaianIds.add(a.penilaian!.id || `pen-ag-${a.id}`);
  });
  penilaianExtraList.forEach(p => {
    allUniquePenilaianIds.add(p.id);
  });
  const totalPenilaian = allUniquePenilaianIds.size;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 p-6 md:p-8 rounded-3xl flex items-center justify-between border border-blue-100/60 relative overflow-hidden shadow-2xs">
        <div className="flex items-center gap-5 z-10">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-indigo-200 overflow-hidden border-2 border-indigo-200">
              {profile.fotoProfilUrl ? (
                <img
                  src={profile.fotoProfilUrl}
                  alt={profile.namaGuru}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{teacherInitials}</span>
              )}
            </div>
            {onSaveProfile && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload Foto Guru Asli"
                  disabled={isCompressing}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-white hover:bg-slate-50 text-indigo-600 rounded-full border border-indigo-200 shadow-md flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQuickUploadFoto}
                  className="hidden"
                />
              </>
            )}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              Selamat datang kembali, {profile.namaGuru} 👋
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              {profile.namaSekolah} • Tahun Ajaran {profile.tahunAjaran} ({profile.semester})
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-3 z-10">
          <button
            onClick={onOpenAgendaModal}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-indigo-200 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-sky-200" />
            <span>Isi Agenda Mengajar</span>
          </button>
        </div>
        {/* Subtle Background Pattern */}
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-linear-to-l from-indigo-100/40 to-transparent pointer-events-none" />
      </div>

      {/* Top 6 Stat Cards (Matching Tailwindadmin Color Pastel Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Total Kelas */}
        <div
          onClick={() => setActiveTab('kelas_siswa')}
          className="bg-emerald-50/70 hover:bg-emerald-50 p-4 rounded-2xl border border-emerald-100/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-102"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-xs">
            <School className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-emerald-600 mb-0.5">Total Kelas</span>
          <span className="text-2xl font-extrabold text-emerald-700">{totalKelas}</span>
        </div>

        {/* Card 2: Total Siswa */}
        <div
          onClick={() => setActiveTab('kelas_siswa')}
          className="bg-sky-50/70 hover:bg-sky-50 p-4 rounded-2xl border border-sky-100/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-102"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-2 shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-sky-600 mb-0.5">Total Siswa</span>
          <span className="text-2xl font-extrabold text-sky-700">{totalSiswa}</span>
        </div>

        {/* Card 3: Jadwal Hari Ini */}
        <div
          onClick={() => setActiveTab('jadwal')}
          className="bg-indigo-50/70 hover:bg-indigo-50 p-4 rounded-2xl border border-indigo-100/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-102"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-indigo-600 mb-0.5">Jadwal Hari Ini</span>
          <span className="text-2xl font-extrabold text-indigo-700">{jadwalHariIni.length}</span>
        </div>

        {/* Card 4: Total Agenda */}
        <div
          onClick={() => setActiveTab('laporan')}
          className="bg-rose-50/70 hover:bg-rose-50 p-4 rounded-2xl border border-rose-100/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-102"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center mb-2 shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-rose-500 mb-0.5">Agenda Terisi</span>
          <span className="text-2xl font-extrabold text-rose-600">{totalAgenda}</span>
        </div>

        {/* Card 5: Kehadiran Rata-rata */}
        <div
          onClick={() => setActiveTab('rekap_presensi')}
          className="bg-amber-50/70 hover:bg-amber-50 p-4 rounded-2xl border border-amber-100/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-102"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-2 shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-amber-600 mb-0.5">Avg Kehadiran</span>
          <span className="text-2xl font-extrabold text-amber-700">{avgAttendancePercent}%</span>
        </div>

        {/* Card 6: Penilaian */}
        <div
          onClick={() => setActiveTab('penilaian')}
          className="bg-purple-50/70 hover:bg-purple-50 p-4 rounded-2xl border border-purple-100/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-102"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-xs">
            <Award className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-purple-600 mb-0.5">Penilaian</span>
          <span className="text-2xl font-extrabold text-purple-700">{totalPenilaian}</span>
        </div>
      </div>

      {/* Main Content Grid: Jadwal Hari Ini & Timeline Agenda Terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jadwal Hari Ini Widget (2 cols on lg) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span>Jadwal Mengajar Hari Ini ({todayName})</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Klik tombol <span className="font-semibold text-indigo-600">"Mulai Agenda"</span> untuk mengisi presensi & jurnal kelas.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('jadwal')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Semua Jadwal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {jadwalHariIni.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 my-4">
              <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">Tidak Ada Jadwal Mengajar Hari Ini</p>
              <p className="text-xs text-slate-400 mt-1">
                Hari ini ({todayName}) tidak ada jam mengajar terjadwal. Anda tetap dapat mengisi agenda kelas lain via menu utama.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jadwalHariIni.map((item, idx) => {
                const kelas = kelasList.find(k => k.id === item.kelasId);
                const isAlreadyFilled = agendaList.some(
                  a => a.jadwalId === item.id && a.tanggal === new Date().toISOString().substring(0, 10)
                );

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50/80 hover:bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                        J{item.jamKe}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">
                            {kelas?.namaKelas || 'Kelas'}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {item.ruangan}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-600 mt-0.5">{item.mapel}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {item.jamMulai} - {item.jamSelesai} WIB
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isAlreadyFilled ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold">
                          <FileCheck className="w-4 h-4" />
                          <span>Sudah Diisi</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onOpenAgendaWithJadwal(item)}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Mulai Agenda</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Agenda Timeline Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 text-base">Agenda Terbaru</h3>
            <button
              onClick={() => setActiveTab('laporan')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          {agendaList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">Belum ada agenda tersimpan.</div>
          ) : (
            <div className="space-y-4 relative before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-100">
              {[...agendaList]
                .sort((a, b) => {
                  const dateDiff = (b.tanggal || '').localeCompare(a.tanggal || '');
                  if (dateDiff !== 0) return dateDiff;
                  return (b.pertemuanKe || 0) - (a.pertemuanKe || 0);
                })
                .slice(0, 5)
                .map(agenda => {
                const kelas = kelasList.find(k => k.id === agenda.kelasId);
                const totalHadir = agenda.presensi.filter(p => p.status === 'hadir').length;
                const totalSiswaInAgenda = agenda.presensi.length;

                return (
                  <div key={agenda.id} className="flex items-start gap-3 relative text-xs">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 border-2 border-indigo-500 text-indigo-600 font-bold flex items-center justify-center shrink-0 z-10">
                      P{agenda.pertemuanKe}
                    </div>
                    <div className="flex-1 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{kelas?.namaKelas || 'Kelas'}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">{agenda.tanggal}</span>
                          {onEditAgenda && (
                            <button
                              type="button"
                              onClick={() => onEditAgenda(agenda)}
                              className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Agenda Pertemuan Ini"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-600 font-medium mt-1 line-clamp-1">{agenda.materi}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 text-[10px]">
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Hadir: {totalHadir}/{totalSiswaInAgenda}
                        </span>
                        {agenda.adaPenilaian && (
                          <span className="text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-md">
                            Ada Nilai
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
