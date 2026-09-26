import React from 'react';
import {
  TeacherProfile,
  Kelas,
  Siswa,
  AgendaMengajar,
  PenilaianSession,
} from '../types';
import { numberToGradeHuruf } from '../utils/gradeUtils';
import { formatCityName } from './ShareablePresensiModal';

interface PrintDocumentProps {
  type: 'jurnal' | 'presensi' | 'nilai' | 'short_pertemuan';
  profile: TeacherProfile;
  kelas?: Kelas;
  siswaList: Siswa[];
  agendaList: AgendaMengajar[];
  penilaianList: PenilaianSession[];
  selectedAgenda?: AgendaMengajar;
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  type,
  profile,
  kelas,
  siswaList,
  agendaList,
  penilaianList,
  selectedAgenda,
}) => {
  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const studentsInKelas = siswaList.filter(s => s.kelasId === kelas?.id);
  const sortedAgendaList = [...agendaList].sort(
    (a, b) => (a.pertemuanKe || 0) - (b.pertemuanKe || 0)
  );

  return (
    <div className="bg-white text-black p-8 font-serif leading-normal max-w-4xl mx-auto border border-slate-200 rounded-xl my-4 print:border-none print:p-0 print:my-0">
      {/* KOP SURAT SEKOLAH */}
      <div className="flex items-center justify-between pb-4 border-b-4 border-double border-black mb-6 gap-2">
        {profile.logoSekolahUrl ? (
          <img
            src={profile.logoSekolahUrl}
            alt="Logo Sekolah"
            referrerPolicy="no-referrer"
            className="w-20 h-20 object-contain shrink-0"
          />
        ) : (
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center font-bold text-xs border border-black shrink-0">
            LOGO
          </div>
        )}
        <div className="text-center flex-1 px-4">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider">PEMERINTAH DAERAH DAERAH ISTIMEWA / PROVINSI</h2>
          <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight">{profile.namaSekolah}</h1>
          <p className="text-xs italic mt-0.5">{profile.alamatSekolah}</p>
          <p className="text-[11px] mt-0.5">
            Tahun Ajaran {profile.tahunAjaran} • Semester {profile.semester}
          </p>
        </div>
        {profile.fotoProfilUrl ? (
          <div className="w-16 h-20 border border-slate-300 rounded overflow-hidden shrink-0 shadow-2xs p-0.5 bg-white">
            <img
              src={profile.fotoProfilUrl}
              alt="Foto Guru"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-xs"
            />
          </div>
        ) : (
          <div className="w-16 h-16 opacity-0 shrink-0" />
        )}
      </div>

      {/* DOCUMENT TITLE & METADATA */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold uppercase underline tracking-wide">
          {type === 'jurnal' && `JURNAL AGENDA MENGAJAR GURU - KELAS ${kelas?.namaKelas || ''}`}
          {type === 'presensi' && `REKAP PRESENSI KEHADIRAN SISWA - KELAS ${kelas?.namaKelas || ''}`}
          {type === 'nilai' && `REKAPITULASI HASIL PENILAIAN - KELAS ${kelas?.namaKelas || ''}`}
          {type === 'short_pertemuan' && `AGENDA MENGAJAR & PRESENSI (PERTEMUAN KE-${selectedAgenda?.pertemuanKe || '1'})`}
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Mata Pelajaran: <strong>{selectedAgenda?.mapel || profile.mapelUtama}</strong> | Guru Pengampu:{' '}
          <strong>{profile.namaGuru}</strong> (NIP: {profile.nip})
        </p>
      </div>

      {/* ---------------- 1. TYPE: JURNAL AGENDA ---------------- */}
      {type === 'jurnal' && (
        <table className="w-full text-xs border-collapse border border-black mb-8">
          <thead>
            <tr className="bg-slate-100 text-center">
              <th className="border border-black p-2 w-8">No</th>
              <th className="border border-black p-2 w-24">Tgl / Jam</th>
              <th className="border border-black p-2">Materi & Capaian Pembelajaran</th>
              <th className="border border-black p-2 w-28">Presensi (S/I/A/D/M)</th>
              <th className="border border-black p-2">Refleksi / Catatan</th>
            </tr>
          </thead>
          <tbody>
            {sortedAgendaList.map((ag, idx) => {
              const sakit = ag.presensi.filter(p => p.status === 'sakit').length;
              const ijin = ag.presensi.filter(p => p.status === 'ijin').length;
              const alpa = ag.presensi.filter(p => p.status === 'alpa').length;
              const dispen = ag.presensi.filter(p => p.status === 'dispen').length;
              const magang = ag.presensi.filter(p => p.status === 'magang').length;

              return (
                <tr key={ag.id}>
                  <td className="border border-black p-2 text-center">{idx + 1}</td>
                  <td className="border border-black p-2 text-center">
                    <strong>{ag.tanggal}</strong>
                    <br />
                    <span className="text-[10px]">P-{ag.pertemuanKe}</span>
                  </td>
                  <td className="border border-black p-2">
                    <p className="font-bold">{ag.materi}</p>
                    {ag.capaianPembelajaran && (
                      <p className="text-[10px] italic text-slate-700 mt-0.5">CP: {ag.capaianPembelajaran}</p>
                    )}
                  </td>
                  <td className="border border-black p-2 text-center text-[11px]">
                    S: {sakit} | I: {ijin} | A: {alpa}
                    {dispen > 0 && ` | D: ${dispen}`}
                    {magang > 0 && ` | M: ${magang}`}
                  </td>
                  <td className="border border-black p-2 text-[11px]">
                    {ag.refleksiGuru || ag.catatanKejadian || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ---------------- 2. TYPE: REKAP PRESENSI ---------------- */}
      {type === 'presensi' && (
        <table className="w-full text-xs border-collapse border border-black mb-8">
          <thead>
            <tr className="bg-slate-100 text-center">
              <th className="border border-black p-2 w-8">No</th>
              <th className="border border-black p-2 w-20">NIS</th>
              <th className="border border-black p-2">Nama Siswa</th>
              <th className="border border-black p-2 w-12">L/P</th>
              <th className="border border-black p-2 w-12">Sakit</th>
              <th className="border border-black p-2 w-12">Izin</th>
              <th className="border border-black p-2 w-12">Alpa</th>
              <th className="border border-black p-2 w-16">% Hadir</th>
            </tr>
          </thead>
          <tbody>
            {studentsInKelas.map((s, idx) => {
              let sakit = 0,
                ijin = 0,
                alpa = 0,
                hadir = 0,
                totalP = 0;

              agendaList.forEach(ag => {
                const p = ag.presensi.find(item => item.siswaId === s.id);
                if (p) {
                  totalP++;
                  if (p.status === 'hadir') hadir++;
                  if (p.status === 'sakit') sakit++;
                  if (p.status === 'ijin') ijin++;
                  if (p.status === 'alpa') alpa++;
                }
              });

              const pct = totalP > 0 ? Math.round((hadir / totalP) * 100) : 100;

              return (
                <tr key={s.id}>
                  <td className="border border-black p-2 text-center">{idx + 1}</td>
                  <td className="border border-black p-2 text-center">{s.nis}</td>
                  <td className="border border-black p-2 font-bold">{s.nama}</td>
                  <td className="border border-black p-2 text-center">{s.jenisKelamin}</td>
                  <td className="border border-black p-2 text-center">{sakit}</td>
                  <td className="border border-black p-2 text-center">{ijin}</td>
                  <td className="border border-black p-2 text-center">{alpa}</td>
                  <td className="border border-black p-2 text-center font-bold">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ---------------- 3. TYPE: REKAP NILAI ---------------- */}
      {type === 'nilai' && (
        <table className="w-full text-xs border-collapse border border-black mb-8">
          <thead>
            <tr className="bg-slate-100 text-center">
              <th className="border border-black p-2 w-8">No</th>
              <th className="border border-black p-2 w-20">NIS</th>
              <th className="border border-black p-2">Nama Siswa</th>
              {penilaianList.map(p => (
                <th key={p.id} className="border border-black p-2">
                  {p.namaPenilaian}
                </th>
              ))}
              <th className="border border-black p-2 w-16">Rata2</th>
            </tr>
          </thead>
          <tbody>
            {studentsInKelas.map((s, idx) => {
              let totalScore = 0;
              let count = 0;

              return (
                <tr key={s.id}>
                  <td className="border border-black p-2 text-center">{idx + 1}</td>
                  <td className="border border-black p-2 text-center">{s.nis}</td>
                  <td className="border border-black p-2 font-bold">{s.nama}</td>
                  {penilaianList.map(p => {
                    const grade = p.daftarNilai.find(n => n.siswaId === s.id);
                    const isHuruf = p.skalaPenilaian === 'huruf';
                    const score = grade ? grade.nilai : 0;
                    if (grade) {
                      totalScore += score;
                      count++;
                    }

                    return (
                      <td key={p.id} className="border border-black p-2 text-center font-semibold">
                        {isHuruf
                          ? grade?.gradeHuruf || (grade ? numberToGradeHuruf(grade.nilai) : '-')
                          : score}
                      </td>
                    );
                  })}
                  <td className="border border-black p-2 text-center font-bold">
                    {count > 0 ? (
                      <span>
                        {Math.round(totalScore / count)}{' '}
                        <span className="text-[10px] font-bold">
                          ({numberToGradeHuruf(Math.round(totalScore / count))})
                        </span>
                      </span>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ---------------- 4. TYPE: SHORT PERTEMUAN ---------------- */}
      {type === 'short_pertemuan' && selectedAgenda && (
        <div className="space-y-4 text-xs mb-8">
          <div className="p-4 border border-black rounded-lg space-y-2">
            <p>
              <strong>Tanggal:</strong> {selectedAgenda.tanggal} | <strong>Pertemuan Ke:</strong>{' '}
              {selectedAgenda.pertemuanKe}
            </p>
            <p>
              <strong>Materi:</strong> {selectedAgenda.materi}
            </p>
            {selectedAgenda.capaianPembelajaran && (
              <p>
                <strong>Capaian Pembelajaran:</strong> {selectedAgenda.capaianPembelajaran}
              </p>
            )}
            {selectedAgenda.refleksiGuru && (
              <p>
                <strong>Refleksi Guru:</strong> {selectedAgenda.refleksiGuru}
              </p>
            )}
          </div>

          <h4 className="font-bold uppercase border-b border-black pb-1">Daftar Kehadiran Siswa:</h4>
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-1.5 w-8">No</th>
                <th className="border border-black p-1.5">Nama Siswa</th>
                <th className="border border-black p-1.5 w-24">Status</th>
                <th className="border border-black p-1.5">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {studentsInKelas.map((s, idx) => {
                const p = selectedAgenda.presensi.find(item => item.siswaId === s.id);
                return (
                  <tr key={s.id}>
                    <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-black p-1.5 font-bold">{s.nama}</td>
                    <td className="border border-black p-1.5 text-center uppercase font-bold">
                      {p?.status || 'hadir'}
                    </td>
                    <td className="border border-black p-1.5">{p?.keterangan || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SIGNATURE SECTION (Standard Indonesian School Formalities) */}
      <div className="grid grid-cols-2 gap-8 text-xs pt-8 border-t border-slate-200">
        <div className="text-center">
          <p>Mengetahui,</p>
          <p className="font-bold">Kepala Sekolah</p>
          <div className="h-16" />
          <p className="font-bold underline">{profile.namaKepsek || '........................'}</p>
          <p>NIP. {profile.nipKepsek || '........................'}</p>
        </div>

        <div className="text-center">
          <p>{formatCityName(profile.alamatSekolah, profile.namaSekolah)}, {currentDateStr}</p>
          <p className="font-bold">Guru Mata Pelajaran</p>
          <div className="h-16" />
          <p className="font-bold underline">{profile.namaGuru}</p>
          <p>{profile.nip.length >= 18 ? 'NIPPPK.' : 'NIP.'} {profile.nip}</p>
        </div>
      </div>
    </div>
  );
};
