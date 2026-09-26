import React from 'react';
import {
  LayoutGrid,
  CalendarDays,
  CalendarCheck,
  Users,
  BookOpenCheck,
  GraduationCap,
  Settings,
  Lock,
  ChevronRight,
  Sparkles,
  School,
  Cloud,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { ActiveTab, TeacherProfile } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  profile: TeacherProfile;
  onLockClick: () => void;
  onOpenAgendaModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile,
  isCollapsed,
  setIsCollapsed,
  profile,
  onLockClick,
  onOpenAgendaModal,
}) => {
  const teacherInitials = profile.namaGuru
    ? profile.namaGuru
        .split(' ')
        .filter(p => !p.includes('.') && !p.includes(','))
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase() || 'AS'
    : 'AS';

  const navItems = [
    {
      section: 'UTAMA',
      items: [
        {
          id: 'dashboard' as ActiveTab,
          label: 'Dashboard',
          icon: LayoutGrid,
        },
        {
          id: 'laporan' as ActiveTab,
          label: 'Agenda Mengajar',
          icon: BookOpenCheck,
        },
      ],
    },
    {
      section: 'DATA MASTER',
      items: [
        {
          id: 'jadwal' as ActiveTab,
          label: 'Jadwal Mengajar',
          icon: CalendarDays,
        },
        {
          id: 'kelas_siswa' as ActiveTab,
          label: 'Kelas & Siswa',
          icon: Users,
        },
      ],
    },
    {
      section: 'PENILAIAN & REKAP',
      items: [
        {
          id: 'rekap_presensi' as ActiveTab,
          label: 'Rekap Presensi',
          icon: CalendarCheck,
        },
        {
          id: 'penilaian' as ActiveTab,
          label: 'Rekap Nilai',
          icon: GraduationCap,
        },
        {
          id: 'backup' as ActiveTab,
          label: 'Backup Data',
          icon: Cloud,
        },
      ],
    },
    {
      section: 'PENGATURAN',
      items: [
        {
          id: 'pengaturan' as ActiveTab,
          label: 'Pengaturan & Profil',
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop for Mobile */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 bg-white border-r border-slate-100 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } w-64 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`overflow-y-auto flex-1 ${isCollapsed ? 'p-3' : 'p-5'}`}>
          {/* Logo Header & Collapse Toggle */}
          <div
            className={`flex items-center ${
              isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'
            } mb-6`}
          >
            <div
              className={`flex items-center gap-3 cursor-pointer ${
                isCollapsed ? 'justify-center' : ''
              }`}
              onClick={() => isCollapsed && setIsCollapsed(false)}
              title={isCollapsed ? 'Klik untuk memperluas sidebar' : undefined}
            >
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-200 shrink-0 overflow-hidden">
                {profile.logoSekolahUrl ? (
                  <img
                    src={profile.logoSekolahUrl}
                    alt="Logo Sekolah"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-0.5 rounded-2xl bg-white"
                  />
                ) : (
                  <School className="w-5 h-5 stroke-[2.25]" />
                )}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <span className="text-lg font-bold text-slate-800 tracking-tight block">
                    Agenda<span className="text-indigo-600 font-extrabold">Guru</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block -mt-1 truncate max-w-[110px]">
                    {profile.namaSekolah || 'Sistem Jurnal Mengajar'}
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse/Expand Toggle Button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
              className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Quick Action Button for Agenda */}
          <div className="mb-6">
            {!isCollapsed ? (
              <button
                onClick={() => {
                  onOpenAgendaModal();
                  setIsOpenMobile(false);
                }}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-semibold text-sm shadow-md shadow-indigo-200 transition-all active:scale-98 cursor-pointer group"
              >
                <Sparkles className="w-4 h-4 text-sky-200 group-hover:rotate-12 transition-transform" />
                <span>+ Buat Agenda Baru</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onOpenAgendaModal();
                  setIsOpenMobile(false);
                }}
                title="Buat Agenda Baru"
                className="w-10 h-10 mx-auto flex items-center justify-center bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl shadow-md shadow-indigo-200 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-6 text-sm font-medium">
            {navItems.map((group, groupIdx) => (
              <div key={groupIdx}>
                {!isCollapsed ? (
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-3">
                    {group.section}
                  </p>
                ) : (
                  <div className="h-px bg-slate-100 my-2 mx-1" />
                )}
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive =
                      activeTab === item.id ||
                      (item.id === 'laporan' && activeTab === 'agenda');

                    if (isCollapsed) {
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsOpenMobile(false);
                          }}
                          title={item.label}
                          className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                            isActive
                              ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-200'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {isActive && (
                            <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-indigo-600 rounded-full" />
                          )}
                        </button>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsOpenMobile(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-200'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-4 h-4 ${
                              isActive ? 'text-white' : 'text-slate-400'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 ${
                            isActive
                              ? 'text-indigo-200'
                              : 'text-slate-300 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer Profile & Lock */}
        {!isCollapsed ? (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200 overflow-hidden">
                  {profile.fotoProfilUrl ? (
                    <img
                      src={profile.fotoProfilUrl}
                      alt={profile.namaGuru}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    teacherInitials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{profile.namaGuru}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {profile.nip.length >= 18 ? 'NIPPPK.' : 'NIP.'} {profile.nip}
                  </p>
                </div>
              </div>
              <button
                onClick={onLockClick}
                title="Kunci Aplikasi"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col items-center gap-2">
            <div
              title={`${profile.namaGuru} (${profile.nip})`}
              className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200 overflow-hidden"
            >
              {profile.fotoProfilUrl ? (
                <img
                  src={profile.fotoProfilUrl}
                  alt={profile.namaGuru}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                teacherInitials
              )}
            </div>
            <button
              onClick={onLockClick}
              title="Kunci Aplikasi"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
