import React, { useState, useEffect } from 'react';
import { AppData } from '../services/apiService';
import { backupService } from '../services/backupService';
import { googleAuthService } from '../services/googleAuthService';
import { firestoreService } from '../services/firestoreService';
import { GoogleBackupStatus } from '../types';
import {
  Cloud,
  FileText,
  FileSpreadsheet,
  FolderGit2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Database,
  ShieldCheck,
  HardDrive,
  Clock,
  Layers,
  Users,
  Award,
  Link as LinkIcon,
  LogIn,
  LogOut,
  Info,
  Download,
  UploadCloud,
  FolderDown,
} from 'lucide-react';

interface BackupDashboardViewProps {
  appData: AppData;
  onRefreshData?: () => void;
}

export const BackupDashboardView: React.FC<BackupDashboardViewProps> = ({
  appData,
  onRefreshData,
}) => {
  const [googleStatus, setGoogleStatus] = useState<GoogleBackupStatus | null>(
    appData.googleBackupStatus || null
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string>('');
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    isAuthenticated: boolean;
    user?: any;
  }>({
    isAuthenticated: Boolean(appData.googleConnection?.email || googleAuthService.getUser()?.email),
    user: appData.googleConnection || googleAuthService.getUser() || undefined,
  });

  // Keep authStatus & googleStatus in sync when appData changes
  useEffect(() => {
    if (appData.googleConnection?.email) {
      setAuthStatus({
        isAuthenticated: true,
        user: appData.googleConnection,
      });
    }
    if (appData.googleBackupStatus) {
      setGoogleStatus(appData.googleBackupStatus);
    }
  }, [appData.googleConnection, appData.googleBackupStatus]);

  // Calculate App Totals
  const totalAgendas = (appData.agenda || []).length;
  let totalPresensi = 0;
  (appData.agenda || []).forEach(a => {
    totalPresensi += (a.presensi || []).length;
  });

  let totalNilai = 0;
  (appData.agenda || []).forEach(a => {
    if (a.adaPenilaian && a.penilaian?.daftarNilai) {
      totalNilai += a.penilaian.daftarNilai.length;
    }
  });
  (appData.penilaianExtra || []).forEach(p => {
    totalNilai += (p.daftarNilai || []).length;
  });

  // Check Google Auth Status & Backup Status on load
  const checkGoogleAuth = async () => {
    const localToken = googleAuthService.getAccessToken();
    const localUser = googleAuthService.getUser() || appData.googleConnection;

    if (localUser?.email && localToken) {
      setAuthStatus({
        isAuthenticated: true,
        user: {
          email: localUser.email,
          displayName: localUser.displayName,
          photoURL: localUser.photoURL,
        },
      });
    } else {
      setAuthStatus({
        isAuthenticated: false,
        user: localUser || null,
      });
    }

    try {
      const headers: Record<string, string> = {};
      if (localToken) {
        headers['Authorization'] = `Bearer ${localToken}`;
      }
      const res = await fetch('/api/google/status', { headers });
      const json = await res.json();
      if (json.success) {
        if (json.isAuthenticated || localToken) {
          const userObj = json.user || localUser || appData.googleConnection || { email: 'Akun Google Terhubung' };
          setAuthStatus({
            isAuthenticated: true,
            user: userObj,
          });

          if (!json.isAuthenticated && localToken && userObj) {
            fetch('/api/google/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localToken}`,
              },
              body: JSON.stringify({
                accessToken: localToken,
                user: userObj,
              }),
            }).catch(() => {});
          }
        } else {
          setAuthStatus({
            isAuthenticated: false,
            user: localUser || appData.googleConnection || null,
          });
        }
      }

      // If status is empty, fetch from /api/data
      const dataRes = await fetch('/api/data');
      if (dataRes.ok) {
        const dJson = await dataRes.json();
        if (dJson.googleBackupStatus) {
          setGoogleStatus(prev => prev || dJson.googleBackupStatus);
        }
      }
    } catch (err) {
      console.error('Failed to check Google auth status:', err);
    }
  };

  useEffect(() => {
    checkGoogleAuth();
    const unsubscribe = googleAuthService.initAuthListener(
      user => {
        setAuthStatus(prev => ({
          ...prev,
          isAuthenticated: true,
          user: {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
        }));
      },
      () => {
        if (!appData.googleConnection?.email) {
          setAuthStatus({ isAuthenticated: false, user: undefined });
        }
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  // Connect Google OAuth Handler
  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setConnectError(null);
    setSyncSuccessMessage(null);
    try {
      const res = await googleAuthService.signInWithGoogle();
      if (res && res.user) {
        const connInfo = {
          email: res.user.email || '',
          displayName: res.user.displayName || '',
          photoURL: res.user.photoURL || '',
          connectedAt: new Date().toISOString(),
        };
        setAuthStatus({
          isAuthenticated: true,
          user: connInfo,
        });
        await firestoreService.savePersistentAppData({
          ...appData,
          googleConnection: connInfo,
        });
        if (onRefreshData) onRefreshData();
        await checkGoogleAuth();
      }
    } catch (err: any) {
      console.error('Error connecting Google account:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        let msg = err?.message || 'Gagal menghubungkan akun Google.';
        if (msg.includes('firebaseapp.com') || msg.includes('took too long') || msg.includes('network') || msg.includes('failed')) {
          msg = 'Koneksi otentikasi Google terhambat oleh jaringan/DNS. Tenang, seluruh agenda & nilai Anda tetap 100% tersimpan aman di Cloud Firestore.';
        }
        setConnectError(msg);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Google Handler
  const handleDisconnectGoogle = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan koneksi akun Google Workspace?')) return;
    try {
      await googleAuthService.signOut();
      setAuthStatus({ isAuthenticated: false, user: undefined });
      setGoogleStatus(null);
      setSyncSuccessMessage(null);
      await firestoreService.savePersistentAppData({
        ...appData,
        googleConnection: null,
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to disconnect Google:', err);
    }
  };

  // Manual Trigger Full Sync (Push to Drive)
  const handleRunFullSync = async () => {
    setIsSyncing(true);
    setConnectError(null);
    setSyncSuccessMessage(null);
    setSyncProgressMsg('Menghubungkan ke Google Workspace...');
    try {
      let token = googleAuthService.getAccessToken();
      if (!token) {
        setSyncProgressMsg('Menghubungkan otentikasi Google Workspace...');
        const res = await googleAuthService.signInWithGoogle();
        token = res.accessToken;
        setAuthStatus({
          isAuthenticated: true,
          user: res.user,
        });
      }
      let status = await backupService.runFullGoogleBackup(appData, msg => {
        setSyncProgressMsg(msg);
      });

      // If token expired during sync pass, prompt fresh sign-in once and retry
      if (!status.isAuthenticated && (status.lastError?.includes('otentikasi') || status.lastError?.includes('kadaluarsa') || status.lastError?.includes('credentials'))) {
        setSyncProgressMsg('Menyegarkan otentikasi Google Workspace...');
        try {
          const res = await googleAuthService.signInWithGoogle();
          setAuthStatus({
            isAuthenticated: true,
            user: res.user,
          });
          setSyncProgressMsg('Melanjutkan sinkronisasi data ke Google Workspace...');
          status = await backupService.runFullGoogleBackup(appData, msg => {
            setSyncProgressMsg(msg);
          });
        } catch (authRetryErr: any) {
          if (authRetryErr?.code !== 'auth/popup-closed-by-user') {
            console.warn('Re-auth retry was cancelled or failed:', authRetryErr);
          }
        }
      }

      setGoogleStatus(status);

      if (status.isAuthenticated && !status.lastError) {
        // Save status permanently to Firestore
        await firestoreService.savePersistentAppData({
          ...appData,
          googleBackupStatus: status,
        });

        setSyncSuccessMessage('Sinkronisasi Google Workspace berhasil! Folder "Agenda Mengajar Guru" serta dokumen Google Docs dan Google Sheets untuk semua kelas telah diperbarui di Google Drive.');
        if (onRefreshData) onRefreshData();
      } else if (status.lastError) {
        if (status.lastError.includes('otentikasi') || status.lastError.includes('kadaluarsa') || status.lastError.includes('credentials')) {
          setAuthStatus({ isAuthenticated: false, user: null });
        }
        setConnectError(status.lastError);
      }
    } catch (err: any) {
      console.error('Full backup failed:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        let msg = err?.message || 'Terjadi kesalahan';
        if (msg.includes('firebaseapp.com') || msg.includes('took too long') || msg.includes('network') || msg.includes('failed')) {
          msg = 'Koneksi ke otentikasi Google terhambat jaringan/DNS. Data Anda tetap tersimpan utuh di Cloud Firestore.';
        } else if (msg.includes('otentikasi') || msg.includes('credentials') || msg.includes('kadaluarsa')) {
          setAuthStatus({ isAuthenticated: false, user: null });
          msg = 'Sesi otentikasi Google telah kadaluarsa atau tidak valid. Silakan klik tombol "Hubungkan Akun Google" di atas untuk menghubungkan kembali.';
        }
        setConnectError('Gagal sinkronisasi arsip Google: ' + msg);
      }
    } finally {
      setIsSyncing(false);
      setSyncProgressMsg('');
    }
  };

  // Pull / Restore from Google Drive (Two-Way Sync)
  const handleRestoreFromDrive = async () => {
    if (!confirm('Tarik data cadangan dari Google Drive ke dalam aplikasi? Data agenda, kelas, dan siswa yang ada di Google Drive akan digabungkan ke aplikasi.')) {
      return;
    }
    setIsRestoring(true);
    setConnectError(null);
    setSyncSuccessMessage(null);
    try {
      const res = await backupService.restoreFromGoogleDrive();
      if (res.data) {
        // Save to Firestore
        await firestoreService.savePersistentAppData({
          ...res.data,
          googleConnection: appData.googleConnection,
        });
      }
      setSyncSuccessMessage(res.message || 'Berhasil memulihkan data dari Google Drive ke aplikasi!');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Restore from drive failed:', err);
      let msg = err?.message || 'File cadangan belum tersedia di Drive. Lakukan sinkronisasi terlebih dahulu.';
      if (msg.includes('otentikasi') || msg.includes('credentials') || msg.includes('kadaluarsa')) {
        setAuthStatus({ isAuthenticated: false, user: null });
        msg = 'Sesi otentikasi Google telah kadaluarsa. Silakan hubungkan kembali akun Google Anda.';
      }
      setConnectError('Gagal menarik data dari Google Drive: ' + msg);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* TOP NOTIFICATION / REASSURANCE BANNER */}
      <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-emerald-950 text-sm block">
              Database Cloud Firebase Firestore Aktif &amp; Otomatis Tersimpan
            </span>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              Seluruh data agenda mengajar, jadwal, siswa, presensi, dan nilai Anda <strong>sudah tersimpan permanen di cloud</strong> tanpa perlu login ke Google. Data tidak akan hilang saat preview di-refresh atau dibuka lewat Share Link.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Data Anda 100% Aman</span>
        </div>
      </div>

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Penyimpanan Dua Arah: Cloud Firestore &amp; Google Workspace</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Backup Data &amp; Sinkronisasi Cloud
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
            Sinkronkan data agenda mengajar ke Google Drive (Google Docs &amp; Sheets), atau tarik kembali data cadangan dari Google Drive ke dalam aplikasi kapan saja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
          {!authStatus.isAuthenticated ? (
            <button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-2"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>{isConnecting ? 'Membuka Google Login...' : 'Hubungkan Google Account (Opsional)'}</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {authStatus.user?.email && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
                  {authStatus.user.photoURL ? (
                    <img
                      src={authStatus.user.photoURL}
                      alt="Avatar"
                      className="w-5 h-5 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {(authStatus.user.email || 'G').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Terhubung
                    </span>
                    <span className="max-w-[140px] truncate text-slate-300">{authStatus.user.email}</span>
                  </div>
                </div>
              )}

              {/* Push to Drive Button */}
              <button
                onClick={handleRunFullSync}
                disabled={isSyncing || isRestoring}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-2"
                title="Kirim dan sinkronkan semua data aplikasi ke Google Drive, Docs & Sheets"
              >
                <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Kirim ke Drive'}</span>
              </button>

              {/* Pull from Drive Button (Two-way sync) */}
              <button
                onClick={handleRestoreFromDrive}
                disabled={isSyncing || isRestoring}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-2"
                title="Tarik data cadangan dari Google Drive ke dalam aplikasi"
              >
                <FolderDown className={`w-4 h-4 ${isRestoring ? 'animate-bounce' : ''}`} />
                <span>{isRestoring ? 'Menarik data...' : 'Tarik dr Drive'}</span>
              </button>

              <button
                onClick={handleDisconnectGoogle}
                title="Putuskan Google Account"
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SYNC PROGRESS BANNER */}
      {(isSyncing || isRestoring) && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
          <div className="flex-1 font-semibold">
            {isSyncing
              ? (syncProgressMsg || 'Sedang menyinkronkan folder Google Drive, Docs, & Sheets...')
              : 'Sedang membaca file cadangan dari Google Drive dan memperbarui data aplikasi...'}
          </div>
        </div>
      )}

      {/* SUCCESS NOTIFICATION */}
      {syncSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1 font-medium">{syncSuccessMessage}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {googleStatus?.rootFolderUrl && (
              <a
                href={googleStatus.rootFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Google Drive</span>
              </a>
            )}
            <button
              onClick={() => setSyncSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {connectError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{connectError}</div>
          <button
            onClick={() => setConnectError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* TOP METRICS SUMMARY GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Firebase Firestore Cloud Database Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Database Cloud
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-slate-800">Firestore</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                Permanen
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">Aman saat Sleep / Republish</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
        </div>

        {/* Total Agenda */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Tercatat
            </span>
            <span className="text-2xl font-black text-slate-800">{totalAgendas}</span>
            <p className="text-[11px] text-slate-500">Agenda Mengajar</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Total Presensi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Tercatat
            </span>
            <span className="text-2xl font-black text-slate-800">{totalPresensi}</span>
            <p className="text-[11px] text-slate-500">Baris Data Presensi</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Total Nilai */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Tercatat
            </span>
            <span className="text-2xl font-black text-slate-800">{totalNilai}</span>
            <p className="text-[11px] text-slate-500">Entri Nilai Akademik</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* GOOGLE WORKSPACE DRIVE & FILES DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Google Drive Root Info Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Folder Google Drive</h3>
                <p className="text-xs text-slate-400">Penyimpanan Dokumen Utama</p>
              </div>
            </div>
            {authStatus.isAuthenticated ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" /> Disconnected
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Nama Folder:</span>
              <span className="font-bold text-slate-800">Agenda Mengajar Guru/</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Waktu Sync Terakhir:</span>
              <span className="font-semibold text-slate-700">
                {googleStatus?.lastBackupTime || 'Tersedia di Google Drive'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-400">Status Google Docs &amp; Sheets:</span>
              <span className="font-semibold text-indigo-600">
                {googleStatus?.statusMessage || (authStatus.isAuthenticated ? 'Siap digunakan' : 'Perlu Login')}
              </span>
            </div>
          </div>

          {/* Prominent Direct Google Drive Link */}
          {(googleStatus?.rootFolderUrl || authStatus.isAuthenticated) && (
            <a
              href={googleStatus?.rootFolderUrl || 'https://drive.google.com/drive/folders/14Vek4Pw91cJ4mpZ6TYno6JT1kDDVu5bJ'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-indigo-100"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka Folder di Google Drive</span>
            </a>
          )}
        </div>

        {/* Sync Status Banner */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Aturan Sinkronisasi Dua Arah (Cloud &amp; Drive)</span>
              </h3>
              <span className="text-xs text-slate-400 font-medium">Auto-retry &amp; Batch Fast Sync</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1. Database Utama: Cloud Firestore</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Setiap agenda, jadwal, presensi &amp; nilai langsung tersimpan real-time ke Firestore. Data dijamin permanen dan tidak hilang saat aplikasi ditutup.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span>2. Salinan &amp; Pemulihan: Google Drive</span>
                </div>
                <p className="text-indigo-700/80 text-[11px] leading-relaxed">
                  Ekspor otomatis ke Google Docs (Agenda) dan Google Sheets (Nilai/Presensi), serta file arsip lengkap. Anda dapat menarik data kembali kapan saja.
                </p>
              </div>
            </div>
          </div>

          {googleStatus?.lastError && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Catatan Backup: {googleStatus.lastError}</span>
            </div>
          )}
        </div>
      </div>

      {/* CLASS BACKUP TABLE (DOCS & SHEETS PER KELAS) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Daftar Dokumen Kelas di Google Workspace</h2>
            <p className="text-xs text-slate-400">
              Setiap kelas memiliki 1 Google Docs (Agenda Mengajar) dan 1 Google Sheets (Data Akademik: Presensi &amp; Nilai)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">Total Kelas:</span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
              {(appData.kelas || []).length} Kelas
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-6">Nama Kelas</th>
                <th className="py-3.5 px-6">Google Docs (Agenda)</th>
                <th className="py-3.5 px-6">Google Sheets (Presensi &amp; Nilai)</th>
                <th className="py-3.5 px-6">Status Sync</th>
                <th className="py-3.5 px-6 text-right">Folder Kelas di Drive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {(appData.kelas || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada kelas yang terdaftar. Tambahkan kelas di menu Kelas &amp; Siswa.
                  </td>
                </tr>
              ) : (
                (appData.kelas || []).map(k => {
                  const info = googleStatus?.classBackups?.[k.id];
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <FolderGit2 className="w-4 h-4 text-indigo-600" />
                          <span>{k.namaKelas}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {info?.docUrl ? (
                          <a
                            href={info.docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 font-bold hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Agenda Mengajar</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Dokumen dibuat saat sync</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {info?.sheetUrl ? (
                          <a
                            href={info.sheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-600 font-bold hover:underline"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Data Akademik</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Spreadsheet dibuat saat sync</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {info?.status === 'synced' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Tersinkron ({info.lastSynced})
                          </span>
                        ) : info?.status === 'error' ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Error Sync
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                            Siap Backup
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        {info?.classFolderUrl ? (
                          <a
                            href={info.classFolderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span>Buka Folder</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BackupDashboardView;
