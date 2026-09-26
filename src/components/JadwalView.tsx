import React, { useState } from 'react';
import { Plus, Calendar, Clock, Edit2, Trash2, MapPin, BookOpen, School, X, Check } from 'lucide-react';
import { JadwalMengajar, Kelas, HariName } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface JadwalViewProps {
  jadwalList: JadwalMengajar[];
  kelasList: Kelas[];
  onSaveJadwal: (jadwal: JadwalMengajar) => void;
  onDeleteJadwal: (id: string) => void;
  onOpenAgendaWithJadwal: (jadwal: JadwalMengajar) => void;
}

const HARI_OPTIONS: HariName[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

export const JadwalView: React.FC<JadwalViewProps> = ({
  jadwalList,
  kelasList,
  onSaveJadwal,
  onDeleteJadwal,
  onOpenAgendaWithJadwal,
}) => {
  const [selectedHari, setSelectedHari] = useState<string>('Semua');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingJadwal, setEditingJadwal] = useState<JadwalMengajar | null>(null);
  const [deletingJadwalId, setDeletingJadwalId] = useState<string | null>(null);

  // Form State
  const [kelasId, setKelasId] = useState<string>(kelasList[0]?.id || '');
  const [mapel, setMapel] = useState<string>('');
  const [hari, setHari] = useState<HariName>('Senin');
  const [jamKe, setJamKe] = useState<string>('1 - 3');
  const [jamMulai, setJamMulai] = useState<string>('07:00');
  const [jamSelesai, setJamSelesai] = useState<string>('09:15');
  const [ruangan, setRuangan] = useState<string>('Lab Komputer 1');

  const filteredJadwal =
    selectedHari === 'Semua'
      ? jadwalList
      : jadwalList.filter(j => j.hari === selectedHari);

  const handleOpenModal = (item?: JadwalMengajar) => {
    if (item) {
      setEditingJadwal(item);
      setKelasId(item.kelasId);
      setMapel(item.mapel);
      setHari(item.hari);
      setJamKe(item.jamKe);
      setJamMulai(item.jamMulai);
      setJamSelesai(item.jamSelesai);
      setRuangan(item.ruangan);
    } else {
      setEditingJadwal(null);
      setKelasId(kelasList[0]?.id || '');
      setMapel('');
      setHari('Senin');
      setJamKe('1 - 3');
      setJamMulai('07:00');
      setJamSelesai('09:15');
      setRuangan('Lab Komputer 1');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kelasId || !mapel) return;

    const newJadwal: JadwalMengajar = {
      id: editingJadwal ? editingJadwal.id : `j-${Date.now()}`,
      kelasId,
      mapel,
      hari,
      jamKe,
      jamMulai,
      jamSelesai,
      ruangan,
    };

    onSaveJadwal(newJadwal);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Jadwal Mengajar Mingguan</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola alokasi waktu mengajar, mata pelajaran, dan lokasi ruangan kelas.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Jadwal Baru</span>
        </button>
      </div>

      {/* Filter Tabs Hari */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedHari('Semua')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedHari === 'Semua'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
        >
          Semua Hari ({jadwalList.length})
        </button>
        {HARI_OPTIONS.map(h => {
          const count = jadwalList.filter(j => j.hari === h).length;
          return (
            <button
              key={h}
              onClick={() => setSelectedHari(h)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedHari === h
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              {h} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid Cards Jadwal */}
      {filteredJadwal.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-2xs">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-700">Belum Ada Jadwal Mengajar</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Silakan klik "Tambah Jadwal Baru" untuk memasukkan jam mengajar Anda ke sistem.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJadwal.map(item => {
            const kelas = kelasList.find(k => k.id === item.kelasId);

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {item.hari} • Jam {item.jamKe}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(item)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Edit Jadwal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingJadwalId(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus Jadwal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base mb-1">{kelas?.namaKelas || 'Kelas'}</h3>
                  <p className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5 mb-3">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{item.mapel}</span>
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <p className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Waktu: <strong className="text-slate-700">{item.jamMulai} - {item.jamSelesai}</strong>
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Ruangan: <strong className="text-slate-700">{item.ruangan}</strong>
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onOpenAgendaWithJadwal(item)}
                    className="w-full py-2 bg-slate-50 hover:bg-indigo-600 text-slate-700 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white"
                  >
                    <span>Mulai Agenda Kelas Ini</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal CRUD Jadwal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">
                {editingJadwal ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Mengajar'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Kelas <span className="text-rose-500">*</span>
                </label>
                <select
                  value={kelasId}
                  onChange={e => setKelasId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.namaKelas} ({k.jurusan})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mapel}
                  onChange={e => setMapel(e.target.value)}
                  placeholder="Contoh: Pemrograman Web"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hari</label>
                  <select
                    value={hari}
                    onChange={e => setHari(e.target.value as HariName)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {HARI_OPTIONS.map(h => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Ke</label>
                  <input
                    type="text"
                    value={jamKe}
                    onChange={e => setJamKe(e.target.value)}
                    placeholder="Contoh: 1 - 3"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={jamMulai}
                    onChange={e => setJamMulai(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={jamSelesai}
                    onChange={e => setJamSelesai(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ruangan</label>
                <input
                  type="text"
                  value={ruangan}
                  onChange={e => setRuangan(e.target.value)}
                  placeholder="Contoh: Lab Komputer 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
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
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Jadwal */}
      <ConfirmModal
        isOpen={Boolean(deletingJadwalId)}
        title="Hapus Jadwal Mengajar"
        message="Apakah Anda yakin ingin menghapus jadwal mengajar ini?"
        confirmText="Ya, Hapus Jadwal"
        cancelText="Batal"
        danger={true}
        onClose={() => setDeletingJadwalId(null)}
        onConfirm={() => {
          if (deletingJadwalId) {
            onDeleteJadwal(deletingJadwalId);
            setDeletingJadwalId(null);
          }
        }}
      />
    </div>
  );
};
