import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppData, AgendaMengajar } from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured
export const db =
  firebaseConfig.firestoreDatabaseId &&
  firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

const PRIMARY_DATA_DOC = doc(db, 'app_data', 'primary');

/**
 * Recursively strips `undefined` values and ensures the data structure
 * contains only Firestore-supported field values (preventing "Unsupported field value: undefined").
 */
export function sanitizeForFirestore<T>(data: T): T {
  const deepClean = (val: any): any => {
    if (val === undefined) return null;
    if (val === null || typeof val !== 'object') return val;
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)) {
      return val.filter(item => item !== undefined).map(deepClean);
    }
    const cleanObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        const cleaned = deepClean(v);
        if (cleaned !== undefined) {
          cleanObj[k] = cleaned;
        }
      }
    }
    return cleanObj;
  };

  const cleaned = deepClean(data);
  try {
    return JSON.parse(JSON.stringify(cleaned));
  } catch {
    return cleaned;
  }
}

export const firestoreService = {
  isConfigured(): boolean {
    return Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
  },

  /**
   * Fetch primary app data directly from Firestore with fail-safe agenda recovery
   */
  async getPersistentAppData(): Promise<AppData | null> {
    try {
      const snap = await getDoc(PRIMARY_DATA_DOC);
      let data: AppData | null = null;
      if (snap.exists()) {
        data = snap.data() as AppData;
      }

      // Safeguard: Check individual backup agenda docs if available
      try {
        const agendaMap = new Map<string, AgendaMengajar>();
        if (data && Array.isArray(data.agenda)) {
          data.agenda.forEach(a => {
            if (a && a.id) agendaMap.set(a.id, a);
          });
        }

        // Specifically ensure known recent critical agendas are retrieved if missing
        const criticalIds = ['ag-k1-7', 'ag-xii-pplg3-9', 'ag-xii-pplg2-18'];
        for (const cId of criticalIds) {
          if (!agendaMap.has(cId)) {
            const indSnap = await getDoc(doc(db, 'app_data', cId)).catch(() => null);
            if (indSnap && indSnap.exists()) {
              const agItem = indSnap.data() as AgendaMengajar;
              if (agItem && agItem.id) {
                agendaMap.set(agItem.id, agItem);
              }
            }
          }
        }

        if (data) {
          data.agenda = Array.from(agendaMap.values());
        }
      } catch (err) {
        console.warn('Agenda recovery check warning:', err);
      }

      return data;
    } catch (err) {
      console.warn('Could not read from Firestore primary doc:', err);
      return null;
    }
  },

  /**
   * Save complete AppData state to Firestore with non-destructive agenda merge
   */
  async savePersistentAppData(data: AppData): Promise<void> {
    try {
      // First read existing to prevent accidental loss of agendas if caller had an older list
      let finalAgendas = Array.isArray(data.agenda) ? [...data.agenda] : [];
      try {
        const existingSnap = await getDoc(PRIMARY_DATA_DOC).catch(() => null);
        if (existingSnap && existingSnap.exists()) {
          const existingData = existingSnap.data() as AppData;
          if (Array.isArray(existingData.agenda)) {
            const agendaMap = new Map<string, AgendaMengajar>();
            // Keep existing ones
            existingData.agenda.forEach(a => {
              if (a && a.id) agendaMap.set(a.id, a);
            });
            // Incoming ones override/add
            finalAgendas.forEach(a => {
              if (a && a.id) agendaMap.set(a.id, a);
            });
            finalAgendas = Array.from(agendaMap.values());
          }
        }
      } catch (e) {
        // Continue with caller's agenda list if pre-fetch fails
      }

      const payload: AppData = {
        profile: data.profile || ({} as any),
        kelas: Array.isArray(data.kelas) ? data.kelas : [],
        siswa: Array.isArray(data.siswa) ? data.siswa : [],
        jadwal: Array.isArray(data.jadwal) ? data.jadwal : [],
        agenda: finalAgendas,
        penilaianExtra: Array.isArray(data.penilaianExtra) ? data.penilaianExtra : [],
        googleConnection: data.googleConnection !== undefined ? data.googleConnection : null,
        updatedAt: new Date().toISOString(),
      };
      const sanitizedPayload = sanitizeForFirestore(payload);
      await setDoc(PRIMARY_DATA_DOC, sanitizedPayload, { merge: true });

      // Save each agenda as an individual redundant document under /app_data/
      for (const ag of finalAgendas) {
        if (ag && ag.id) {
          const sanitizedAg = sanitizeForFirestore(ag);
          setDoc(doc(db, 'app_data', ag.id), sanitizedAg, { merge: true }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to save to Firestore primary doc:', err);
    }
  },

  /**
   * Save an individual agenda directly to Firestore
   */
  async saveIndividualAgenda(agenda: AgendaMengajar): Promise<void> {
    try {
      if (!agenda || !agenda.id) return;
      const sanitizedAgenda = sanitizeForFirestore(agenda);
      await setDoc(doc(db, 'app_data', agenda.id), sanitizedAgenda, { merge: true });
    } catch (err) {
      console.warn('Failed to save individual agenda doc:', err);
    }
  },

  /**
   * Delete an individual agenda directly in Firestore
   */
  async deleteIndividualAgenda(id: string): Promise<void> {
    try {
      if (!id) return;
      await deleteDoc(doc(db, 'app_data', id)).catch(() => {});
    } catch (err) {
      console.warn('Failed to delete individual agenda doc:', err);
    }
  },

  /**
   * Real-time listener for multi-device sync
   */
  subscribeToAppData(onUpdate: (data: AppData) => void) {
    try {
      return onSnapshot(
        PRIMARY_DATA_DOC,
        snap => {
          if (snap.exists()) {
            onUpdate(snap.data() as AppData);
          }
        },
        error => {
          console.warn('Firestore snapshot error:', error);
        }
      );
    } catch (e) {
      console.warn('Failed to subscribe to Firestore snapshot:', e);
      return () => {};
    }
  },
};
