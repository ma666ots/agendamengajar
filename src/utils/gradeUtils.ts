export type GradeHuruf =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D'
  | 'E';

export interface GradeOption {
  grade: GradeHuruf;
  minScore: number;
  maxScore: number;
  defaultScore: number;
  label: string;
  predikat: string;
  badgeClass: string;
  pillClass: string;
  borderClass: string;
}

export const GRADE_HURUF_LIST: GradeOption[] = [
  {
    grade: 'A+',
    minScore: 95,
    maxScore: 100,
    defaultScore: 98,
    label: 'A+',
    predikat: 'Sangat Baik Sekali (Istimewa)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    pillClass: 'bg-emerald-600 text-white',
    borderClass: 'border-emerald-500',
  },
  {
    grade: 'A',
    minScore: 90,
    maxScore: 94,
    defaultScore: 92,
    label: 'A',
    predikat: 'Sangat Baik',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pillClass: 'bg-emerald-500 text-white',
    borderClass: 'border-emerald-400',
  },
  {
    grade: 'A-',
    minScore: 85,
    maxScore: 89,
    defaultScore: 87,
    label: 'A-',
    predikat: 'Hampir Sangat Baik',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    pillClass: 'bg-teal-600 text-white',
    borderClass: 'border-teal-400',
  },
  {
    grade: 'B+',
    minScore: 80,
    maxScore: 84,
    defaultScore: 82,
    label: 'B+',
    predikat: 'Baik Sekali',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    pillClass: 'bg-sky-600 text-white',
    borderClass: 'border-sky-400',
  },
  {
    grade: 'B',
    minScore: 75,
    maxScore: 79,
    defaultScore: 77,
    label: 'B',
    predikat: 'Baik (Standar Tuntas)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    pillClass: 'bg-blue-600 text-white',
    borderClass: 'border-blue-400',
  },
  {
    grade: 'B-',
    minScore: 70,
    maxScore: 74,
    defaultScore: 72,
    label: 'B-',
    predikat: 'Cukup Baik',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    pillClass: 'bg-indigo-600 text-white',
    borderClass: 'border-indigo-400',
  },
  {
    grade: 'C+',
    minScore: 65,
    maxScore: 69,
    defaultScore: 67,
    label: 'C+',
    predikat: 'Hampir Cukup',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    pillClass: 'bg-amber-600 text-white',
    borderClass: 'border-amber-400',
  },
  {
    grade: 'C',
    minScore: 60,
    maxScore: 64,
    defaultScore: 62,
    label: 'C',
    predikat: 'Cukup',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    pillClass: 'bg-amber-500 text-white',
    borderClass: 'border-amber-400',
  },
  {
    grade: 'C-',
    minScore: 55,
    maxScore: 59,
    defaultScore: 57,
    label: 'C-',
    predikat: 'Kurang Cukup',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    pillClass: 'bg-orange-500 text-white',
    borderClass: 'border-orange-400',
  },
  {
    grade: 'D',
    minScore: 40,
    maxScore: 54,
    defaultScore: 45,
    label: 'D',
    predikat: 'Kurang (Perlu Bimbingan)',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    pillClass: 'bg-rose-500 text-white',
    borderClass: 'border-rose-400',
  },
  {
    grade: 'E',
    minScore: 0,
    maxScore: 39,
    defaultScore: 30,
    label: 'E',
    predikat: 'Sangat Kurang',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    pillClass: 'bg-rose-700 text-white',
    borderClass: 'border-rose-500',
  },
];

/**
 * Konversi nilai numerik (0-100) menjadi predikat Grade Huruf (A+, A, A-, dst.)
 */
export function numberToGradeHuruf(score: number): GradeHuruf {
  const rounded = Math.round(score);
  for (const item of GRADE_HURUF_LIST) {
    if (rounded >= item.minScore && rounded <= item.maxScore) {
      return item.grade;
    }
  }
  return score >= 95 ? 'A+' : 'E';
}

/**
 * Konversi Grade Huruf (A+, A, A-, dst.) menjadi skor numerik default (0-100)
 */
export function gradeHurufToNumber(grade: GradeHuruf | string): number {
  const normalized = normalizeGradeHuruf(grade);
  if (!normalized) return 75;
  const found = GRADE_HURUF_LIST.find(g => g.grade === normalized);
  return found ? found.defaultScore : 75;
}

/**
 * Normalisasi string input (misal 'a+', 'A -', 'b', dll) ke GradeHuruf yang valid
 */
export function normalizeGradeHuruf(input?: string | null): GradeHuruf | null {
  if (!input) return null;
  const clean = input.trim().toUpperCase().replace(/\s+/g, '');
  const found = GRADE_HURUF_LIST.find(g => g.grade === clean);
  return found ? found.grade : null;
}

/**
 * Mengambil styling badge untuk Grade Huruf
 */
export function getGradeBadgeStyle(grade: string | GradeHuruf): string {
  const norm = normalizeGradeHuruf(grade);
  if (!norm) return 'bg-slate-100 text-slate-700 border-slate-200';
  const found = GRADE_HURUF_LIST.find(g => g.grade === norm);
  return found ? found.badgeClass : 'bg-slate-100 text-slate-700 border-slate-200';
}

/**
 * Mengambil deskripsi predikat untuk Grade Huruf
 */
export function getGradePredikat(grade: string | GradeHuruf): string {
  const norm = normalizeGradeHuruf(grade);
  if (!norm) return '-';
  const found = GRADE_HURUF_LIST.find(g => g.grade === norm);
  return found ? found.predikat : '-';
}
