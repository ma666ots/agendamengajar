import { JadwalMengajar, HariName } from '../types';

export const HARI_LIST: HariName[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

/**
 * Get Indonesian day name for a given Date
 */
export function getIndonesianDayName(date: Date = new Date()): HariName | null {
  const dayIndex = date.getDay(); // 0 = Minggu, 1 = Senin, ..., 5 = Jumat, 6 = Sabtu
  const map: Record<number, HariName> = {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
  };
  return map[dayIndex] || null;
}

/**
 * Convert HH:MM string to minutes from midnight
 */
export function timeStringToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Check if a schedule is currently active right now (same day and current time between jamMulai & jamSelesai)
 */
export function isScheduleActiveNow(jadwal: JadwalMengajar, date: Date = new Date()): boolean {
  const today = getIndonesianDayName(date);
  if (!today || jadwal.hari !== today) return false;

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = timeStringToMinutes(jadwal.jamMulai);
  const endMinutes = timeStringToMinutes(jadwal.jamSelesai);

  if (startMinutes === 0 && endMinutes === 0) return true;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Check if a schedule is upcoming today (same day and current time is before jamMulai)
 */
export function isScheduleUpcomingToday(jadwal: JadwalMengajar, date: Date = new Date()): boolean {
  const today = getIndonesianDayName(date);
  if (!today || jadwal.hari !== today) return false;

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = timeStringToMinutes(jadwal.jamMulai);

  return currentMinutes < startMinutes;
}

/**
 * Find the most relevant active schedule according to current day & time:
 * 1. Schedule that is currently in session right now
 * 2. Next upcoming schedule today
 * 3. First schedule for today
 * 4. If today is weekend / no schedule today, next school day's first schedule (e.g. Senin)
 * 5. Fallback to first schedule in list (never random)
 */
export function findActiveSchedule(
  jadwalList: JadwalMengajar[],
  date: Date = new Date()
): JadwalMengajar | null {
  if (!jadwalList || jadwalList.length === 0) return null;

  const today = getIndonesianDayName(date);

  if (today) {
    const todaySchedules = jadwalList.filter(j => j.hari === today);
    if (todaySchedules.length > 0) {
      // 1. Is any class in session right now?
      const activeNow = todaySchedules.find(j => isScheduleActiveNow(j, date));
      if (activeNow) return activeNow;

      // 2. Is there an upcoming class today?
      const currentMinutes = date.getHours() * 60 + date.getMinutes();
      const upcoming = todaySchedules
        .filter(j => timeStringToMinutes(j.jamMulai) > currentMinutes)
        .sort((a, b) => timeStringToMinutes(a.jamMulai) - timeStringToMinutes(b.jamMulai));
      if (upcoming.length > 0) return upcoming[0];

      // 3. Otherwise return the latest or first today
      return todaySchedules[0];
    }
  }

  // Today is weekend or no schedule for today
  // Find next school day with schedules
  const currentDayIndex = date.getDay(); // 0 = Minggu, 6 = Sabtu
  const nextDaysOrder: HariName[] =
    currentDayIndex === 6 || currentDayIndex === 0
      ? ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
      : HARI_LIST.slice(currentDayIndex - 1).concat(HARI_LIST.slice(0, currentDayIndex - 1));

  for (const day of nextDaysOrder) {
    const daySchedules = jadwalList.filter(j => j.hari === day);
    if (daySchedules.length > 0) {
      return daySchedules[0];
    }
  }

  return jadwalList[0] || null;
}
