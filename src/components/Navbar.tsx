import React, { useState, useEffect } from 'react';
import { Search, Lock, Menu, Calendar, ShieldCheck, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { TeacherProfile } from '../types';

interface NavbarProps {
  profile: TeacherProfile;
  onLockClick: () => void;
  onOpenMobileSidebar: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  onLockClick,
  onOpenMobileSidebar,
  isSidebarCollapsed = false,
  onToggleSidebar,
  searchQuery,
  setSearchQuery,
}) => {
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    setCurrentDateStr(now.toLocaleDateString('id-ID', options));
  }, []);

  const teacherInitials = profile.namaGuru
    ? profile.namaGuru
        .split(' ')
        .filter(p => !p.includes('.') && !p.includes(','))
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase() || 'AS'
    : 'AS';

  return (
    <header className="h-20 px-4 md:px-8 bg-transparent flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-slate-600 hover:bg-white rounded-xl lg:hidden border border-slate-200/60 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop sidebar collapse/expand toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            className="hidden lg:flex p-2 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-xl border border-slate-200/60 shadow-2xs transition-all cursor-pointer items-center justify-center"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Search Input */}
        <div className="relative w-48 sm:w-72 md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari kelas, siswa, materi..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all"
          />
        </div>
      </div>

      {/* Date & Quick Lock Badge */}
      <div className="flex items-center gap-3 sm:gap-5">
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-full text-xs font-semibold text-slate-600 shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>{currentDateStr}</span>
        </div>

        {/* PIN Security Status Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-[11px] font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sesi Privat Aktif</span>
        </div>

        {/* Lock Button */}
        <button
          onClick={onLockClick}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          title="Kunci Aplikasi"
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Kunci</span>
        </button>

        {/* Teacher Avatar Badge */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200/80">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border-2 border-indigo-200 overflow-hidden shadow-2xs">
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
          <div className="hidden xl:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-tight">{profile.namaGuru}</p>
            <p className="text-[10px] text-slate-400 font-medium">{profile.mapelUtama || profile.namaSekolah}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
