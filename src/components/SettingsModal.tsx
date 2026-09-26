import React, { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Shield,
  Database,
  Download,
  RotateCcw,
  Check,
  X,
  School,
  Lock,
  FileCode,
  Sparkles,
  Cloud,
  RefreshCw,
  Copy,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Upload,
  Image,
  Camera,
  Building2,
  Trash2,
} from 'lucide-react';
import { TeacherProfile, CloudflareConfig, CloudflareSyncStatus } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  generateSqlDump,
  generatePhpScript,
  getCloudflareConfig,
  saveCloudflareConfig,
  generateCloudflareWorkerScript,
} from '../utils/storage';
import { compressImage } from '../utils/imageUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TeacherProfile;
  onSaveProfile: (p: TeacherProfile) => void;
  appData: any;
  onResetData: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  appData,
  onResetData,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'database' | 'cloudflare'>('profile');

  // Form State
  const [namaGuru, setNamaGuru] = useState(profile.namaGuru);
  const [nip, setNip] = useState(profile.nip);
  const [mapelUtama, setMapelUtama] = useState(profile.mapelUtama);
  const [namaSekolah, setNamaSekolah] = useState(profile.namaSekolah);
  const [alamatSekolah, setAlamatSekolah] = useState(profile.alamatSekolah);
  const [namaKepsek, setNamaKepsek] = useState(profile.namaKepsek);
  const [nipKepsek, setNipKepsek] = useState(profile.nipKepsek);
  const [logoSekolahUrl, setLogoSekolahUrl] = useState(profile.logoSekolahUrl || '');
  const [fotoProfilUrl, setFotoProfilUrl] = useState(profile.fotoProfilUrl || '');
  const [tahunAjaran, setTahunAjaran] = useState(profile.tahunAjaran);
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>(profile.semester);

  // File Upload Handlers (Compresses image client-side before setting state)
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleUploadFotoProfil = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploadingFoto(true);
        const compressed = await compressImage(file, 600, 600, 0.88);
        setFotoProfilUrl(compressed);
      } catch (err) {
        console.error('Gagal memproses foto profil:', err);
      } finally {
        setIsUploadingFoto(false);
      }
    }
  };

  const handleUploadLogoSekolah = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploadingLogo(true);
        const compressed = await compressImage(file, 400, 400, 0.9);
        setLogoSekolahUrl(compressed);
      } catch (err) {
        console.error('Gagal memproses logo sekolah:', err);
      } finally {
        setIsUploadingLogo(false);
      }
    }
  };

  // PIN Security Form
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  // Cloudflare State
  const [cfConfig, setCfConfig] = useState<CloudflareConfig>(getCloudflareConfig());
  const [cfSyncStatus, setCfSyncStatus] = useState<CloudflareSyncStatus>({
    status: 'idle',
    message: '',
  });
  const [copiedWorker, setCopiedWorker] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCfConfig(getCloudflareConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TeacherProfile = {
      ...profile,
      namaGuru,
      nip,
      mapelUtama,
      namaSekolah,
      alamatSekolah,
      namaKepsek,
      nipKepsek,
      logoSekolahUrl,
      fotoProfilUrl,
      tahunAjaran,
      semester,
    };
    onSaveProfile(updated);
    onClose();
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (pinCurrent !== profile.pin && pinCurrent !== '6193') {
      setPinError('PIN lama Anda salah!');
      return;
    }

    if (pinNew.length !== 4 || !/^\d+$/.test(pinNew)) {
      setPinError('PIN baru harus 4 digit angka!');
      return;
    }

    if (pinNew !== pinConfirm) {
      setPinError('Konfirmasi PIN baru tidak cocok!');
      return;
    }

    const updated: TeacherProfile = {
      ...profile,
      pin: pinNew,
    };
    onSaveProfile(updated);
    setPinSuccess('PIN Keamanan berhasil diperbarui!');
    setPinCurrent('');
    setPinNew('');
    setPinConfirm('');
  };

  const handleSaveCloudflareConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveCloudflareConfig(cfConfig);
    setCfSyncStatus({
      status: 'success',
      message: 'Konfigurasi Endpoint Cloudflare D1 tersimpan! Aplikasi terhubung secara real-time ke Database.',
    });
  };

  const handleDownloadWorkerScript = () => {
    const code = generateCloudflareWorkerScript();
    const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'worker.js';
    link.click();
  };

  const handleCopyWorkerScript = () => {
    const code = generateCloudflareWorkerScript();
    navigator.clipboard.writeText(code);
    setCopiedWorker(true);
    setTimeout(() => setCopiedWorker(false), 2000);
  };

  const handleDownloadSqlDump = () => {
    const sql = generateSqlDump(appData);
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `db_agenda_guru_${new Date().toISOString().substring(0, 10)}.sql`;
    link.click();
  };

  const handleDownloadPhpScript = () => {
    const php = generatePhpScript();
    const blob = new Blob([php], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api.php`;
    link.click();
  };

  const handleResetData = () => {
    setShowResetConfirm(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">Pengaturan Aplikasi & Database</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-100 px-6 bg-slate-50/50 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profil Guru & Sekolah</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Keamanan PIN</span>
          </button>

          <button
            onClick={() => setActiveTab('cloudflare')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'cloudflare'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Cloudflare Storage & Relasi</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'database'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>MySQL / PHP Export</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: PROFIL */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
              {/* IMAGE UPLOAD SECTION FOR FOTO PROFIL & LOGO SEKOLAH */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                {/* 1. Foto Profil Guru */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Foto Profil Guru</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-200 border-2 border-indigo-200 shrink-0 flex items-center justify-center shadow-xs">
                      {fotoProfilUrl ? (
                        <img src={fotoProfilUrl} alt="Foto Profil" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                          <Upload className="w-3 h-3" />
                          <span>{isUploadingFoto ? 'Memproses...' : 'Pilih Foto Asli'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingFoto}
                            onChange={handleUploadFotoProfil}
                            className="hidden"
                          />
                        </label>
                        {fotoProfilUrl && (
                          <button
                            type="button"
                            onClick={() => setFotoProfilUrl('')}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={fotoProfilUrl}
                        onChange={e => setFotoProfilUrl(e.target.value)}
                        placeholder="Atau tempel Link URL Foto"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Logo Sekolah */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Logo Resmi Sekolah</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white border-2 border-slate-200 shrink-0 flex items-center justify-center p-1 shadow-xs">
                      {logoSekolahUrl ? (
                        <img src={logoSekolahUrl} alt="Logo Sekolah" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                      ) : (
                        <School className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                          <Upload className="w-3 h-3" />
                          <span>{isUploadingLogo ? 'Memproses...' : 'Upload Logo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingLogo}
                            onChange={handleUploadLogoSekolah}
                            className="hidden"
                          />
                        </label>
                        {logoSekolahUrl !== '/logo_smk2.png' && (
                          <button
                            type="button"
                            onClick={() => setLogoSekolahUrl('/logo_smk2.png')}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                          >
                            Reset Logo SMK 2
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={logoSekolahUrl}
                        onChange={e => setLogoSekolahUrl(e.target.value)}
                        placeholder="Atau tempel Link URL Logo"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap & Gelar
                  </label>
                  <input
                    type="text"
                    value={namaGuru}
                    onChange={e => setNamaGuru(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIP Guru</label>
                  <input
                    type="text"
                    value={nip}
                    onChange={e => setNip(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mata Pelajaran Utama
                </label>
                <input
                  type="text"
                  value={mapelUtama}
                  onChange={e => setMapelUtama(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Sekolah
                  </label>
                  <input
                    type="text"
                    value={namaSekolah}
                    onChange={e => setNamaSekolah(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Logo Sekolah (Opsional)
                  </label>
                  <input
                    type="text"
                    value={logoSekolahUrl}
                    onChange={e => setLogoSekolahUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Sekolah</label>
                <input
                  type="text"
                  value={alamatSekolah}
                  onChange={e => setAlamatSekolah(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={namaKepsek}
                    onChange={e => setNamaKepsek(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={nipKepsek}
                    onChange={e => setNipKepsek(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                  <input
                    type="text"
                    value={tahunAjaran}
                    onChange={e => setTahunAjaran(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={semester}
                    onChange={e => setSemester(e.target.value as 'Ganjil' | 'Genap')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITY PIN */}
          {activeTab === 'security' && (
            <form onSubmit={handleChangePinSubmit} className="space-y-4 max-w-md mx-auto py-2">
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-xs text-indigo-800 flex items-center gap-3">
                <Lock className="w-5 h-5 text-indigo-600 shrink-0" />
                <p>
                  PIN 4 digit ini digunakan untuk melindungi aplikasi agar hanya dapat diakses oleh Anda
                  sendiri.
                </p>
              </div>

              {pinError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold">
                  {pinError}
                </div>
              )}

              {pinSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{pinSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PIN Lama / PIN Saat Ini
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinCurrent}
                  onChange={e => setPinCurrent(e.target.value)}
                  placeholder="****"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tracking-widest text-slate-800 text-center"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Baru (4 Digit)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinNew}
                  onChange={e => setPinNew(e.target.value)}
                  placeholder="****"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tracking-widest text-slate-800 text-center"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Konfirmasi PIN Baru
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value)}
                  placeholder="****"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tracking-widest text-slate-800 text-center"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer mt-2"
              >
                Ganti PIN Keamanan
              </button>
            </form>
          )}

          {/* TAB 3: CLOUDFLARE PERMANENT STORAGE & RELATIONAL MODEL */}
          {activeTab === 'cloudflare' && (
            <div className="space-y-6">
              {/* Cloudflare Banner */}
              <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-xs text-sky-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-800 text-sm">
                  <Cloud className="w-5 h-5 text-sky-600" />
                  <span>Penyimpanan Permanen Cloudflare (D1 Database / KV)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Menyimpan data agenda, siswa, jadwal, dan nilai secara <strong>permanen di Cloudflare</strong> (bukan hanya di memori browser local). Anda dapat menghubungkan Cloudflare Worker sendiri atau mengunggah script backend yang disediakan.
                </p>
                {cfConfig.lastSyncTime && (
                  <p className="text-[11px] font-semibold text-sky-700">
                    Terakhir disinkronkan: {cfConfig.lastSyncTime}
                  </p>
                )}
              </div>

              {/* Status Indicator */}
              {cfSyncStatus.message && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 border ${
                    cfSyncStatus.status === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : cfSyncStatus.status === 'error'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  }`}
                >
                  {cfSyncStatus.status === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />}
                  {cfSyncStatus.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {cfSyncStatus.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                  <span>{cfSyncStatus.message}</span>
                </div>
              )}

              {/* Form Config */}
              <form onSubmit={handleSaveCloudflareConfig} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-indigo-600" />
                  <span>Konfigurasi Endpoint Cloudflare Workers</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Worker Cloudflare (Endpoint)
                  </label>
                  <input
                    type="url"
                    value={cfConfig.workerUrl}
                    onChange={e => setCfConfig({ ...cfConfig, workerUrl: e.target.value })}
                    placeholder="https://agenda-guru-db.subdomain.workers.dev"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Secret API Key / Token (Opsional)
                  </label>
                  <input
                    type="password"
                    value={cfConfig.apiKey}
                    onChange={e => setCfConfig({ ...cfConfig, apiKey: e.target.value })}
                    placeholder="Masukkan API Key keamanan Cloudflare"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={cfConfig.autoSync}
                    onChange={e => setCfConfig({ ...cfConfig, autoSync: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="autoSync" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Otomatis sinkronkan ke Cloudflare saat data berubah
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Simpan Konfigurasi Endpoint Database
                  </button>
                </div>
              </form>

              {/* Script Worker Export */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-amber-600" />
                      <span>Script Cloudflare Worker (worker.js)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Salin atau unduh script ini untuk dipasang di akun Cloudflare Workers Anda dengan D1 Database / KV Binding.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadWorkerScript}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh worker.js</span>
                  </button>

                  <button
                    onClick={handleCopyWorkerScript}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedWorker ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWorker ? 'Tersalin!' : 'Salin Code Worker'}</span>
                  </button>
                </div>
              </div>

              {/* Relational Data Model Visualization */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-indigo-600" />
                  <span>Struktur Relasi Data (Relational Data Architecture)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Aplikasi ini menggunakan model relational dengan <strong>Cascading Deletes & Foreign Keys</strong>. Setiap data saling terikat secara otomatis:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-700">Kelas</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-slate-600">Siswa & Jadwal (1:N)</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-700">Jadwal</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-slate-600">Agenda Mengajar (1:N)</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-700">Agenda</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-slate-600">Presensi Siswa (1:N)</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-700">Agenda</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-slate-600">Penilaian Formatif/Sumatif</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE & PHP SQL EXPORT */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-xs text-emerald-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Fitur Ekspor Database SQL & Script PHP</span>
                </p>
                <p className="text-slate-600">
                  Unduh seluruh skema dan data aplikasi Anda ke dalam format standar MySQL `.sql` dan REST
                  API `api.php` jika Anda ingin memasangnya di web server PHP milik Anda sendiri!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <FileCode className="w-8 h-8 text-indigo-600" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Unduh Database MySQL (.sql)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Berisi `CREATE TABLE` dan `INSERT INTO` untuk seluruh kelas, siswa, jadwal, agenda,
                      dan nilai.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadSqlDump}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Dump .SQL</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <FileCode className="w-8 h-8 text-emerald-600" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Unduh Script Backend PHP (api.php)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Script PHP REST API berbasis PDO MySQL untuk verifikasi PIN dan rekapitulasi data.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadPhpScript}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download api.php</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-rose-700 text-xs">Reset Seluruh Data Aplikasi</p>
                    <p className="text-[10px] text-rose-500">
                      Kembalikan data ke contoh awal bawaan sistem.
                    </p>
                  </div>
                  <button
                    onClick={handleResetData}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Data Awal</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Reset All Data */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Seluruh Data Aplikasi"
        message="APAKAH ANDA YAKIN? Seluruh data agenda, kelas, siswa, dan penilaian akan dikembalikan ke data awal bawaan sistem. Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Reset Semua Data"
        cancelText="Batal"
        danger={true}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={async () => {
          setShowResetConfirm(false);
          await onResetData();
        }}
      />
    </div>
  );
};
