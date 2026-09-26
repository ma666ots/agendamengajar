import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize or reuse Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

let cachedAccessToken: string | null = null;
let cachedExpiry: number | null = null;
let cachedUser: any = null;

const GOOGLE_TOKEN_KEY = 'agenda_guru_google_access_token';
const GOOGLE_USER_KEY = 'agenda_guru_google_user';
const GOOGLE_EXPIRY_KEY = 'agenda_guru_google_token_expiry';

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'));
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GSI load failed')));
      setTimeout(() => {
        if ((window as any).google?.accounts?.oauth2) resolve();
      }, 300);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

async function signInWithGIS(): Promise<{ user: any; accessToken: string }> {
  await loadGsiScript();
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services tidak tersedia di browser.');
  }

  const clientId = firebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('OAuth Client ID tidak ditemukan.');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        callback: async (response: any) => {
          if (response.error) {
            return reject(new Error(response.error_description || response.error));
          }
          if (!response.access_token) {
            return reject(new Error('Tidak memperoleh access token dari Google.'));
          }

          const accessToken = response.access_token;
          const expiresInSec = Number(response.expires_in) || 3500;
          const expiryDate = Date.now() + expiresInSec * 1000;

          cachedAccessToken = accessToken;
          cachedExpiry = expiryDate;

          let userInfo: any = {
            displayName: 'Pengguna Google',
            email: '',
            photoURL: '',
            uid: 'google-user',
          };
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              userInfo = {
                uid: uData.sub || 'google-user',
                email: uData.email || '',
                displayName: uData.name || uData.email || 'Pengguna Google',
                photoURL: uData.picture || '',
              };
            }
          } catch (e) {
            console.warn('Failed to fetch userinfo from Google:', e);
          }

          cachedUser = userInfo;
          if (typeof window !== 'undefined') {
            localStorage.setItem(GOOGLE_TOKEN_KEY, accessToken);
            localStorage.setItem(GOOGLE_EXPIRY_KEY, String(expiryDate));
            localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(userInfo));
          }

          try {
            await fetch('/api/google/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ accessToken, user: userInfo, expiryDate }),
            });
          } catch (err) {
            console.warn('Gagal sinkron token ke backend session:', err);
          }

          resolve({ user: userInfo, accessToken });
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

export const googleAuthService = {
  getAccessToken(): string | null {
    const now = Date.now();
    // Check in-memory cache first with 60-second grace window
    if (cachedAccessToken && cachedExpiry && now < cachedExpiry - 60000) {
      return cachedAccessToken;
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(GOOGLE_TOKEN_KEY);
      const storedExpiry = localStorage.getItem(GOOGLE_EXPIRY_KEY);
      if (stored) {
        const exp = storedExpiry ? Number(storedExpiry) : 0;
        if (exp && now < exp - 60000) {
          cachedAccessToken = stored;
          cachedExpiry = exp;
          return stored;
        } else if (exp && now >= exp - 60000) {
          // Token expired, clear invalid credential
          this.clearAuth();
          return null;
        } else {
          // If no expiry recorded, assume expired legacy token and clear
          this.clearAuth();
          return null;
        }
      }
    }
    return null;
  },

  isTokenValid(): boolean {
    return Boolean(this.getAccessToken());
  },

  async ensureValidAccessToken(): Promise<string> {
    const token = this.getAccessToken();
    if (token) return token;
    const res = await this.signInWithGoogle();
    return res.accessToken;
  },

  clearAuth(): void {
    cachedAccessToken = null;
    cachedExpiry = null;
    cachedUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
      localStorage.removeItem(GOOGLE_EXPIRY_KEY);
      localStorage.removeItem(GOOGLE_USER_KEY);
    }
    fetch('/api/google/disconnect', { method: 'POST' }).catch(() => {});
  },

  getUser(): any {
    if (cachedUser) return cachedUser;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(GOOGLE_USER_KEY);
      if (stored) {
        try {
          cachedUser = JSON.parse(stored);
          return cachedUser;
        } catch {
          // ignore
        }
      }
    }
    return auth.currentUser || null;
  },

  /**
   * Client-side Google Sign-In with direct Google Identity Services (GIS) and Firebase popup fallback
   */
  async signInWithGoogle(): Promise<{ user: any; accessToken: string }> {
    // 1. Direct Google Identity Services (accounts.google.com) - Never blocked by *.firebaseapp.com DNS issues
    try {
      return await signInWithGIS();
    } catch (gisError: any) {
      console.warn('Direct Google Identity Services error, fallbacking to Firebase Auth:', gisError?.message);
    }

    // 2. Fallback to Firebase Auth signInWithPopup
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Tidak dapat memperoleh access token Google dari otentikasi.');
      }

      const expiryDate = Date.now() + 3500 * 1000;
      cachedAccessToken = credential.accessToken;
      cachedExpiry = expiryDate;
      cachedUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(GOOGLE_TOKEN_KEY, credential.accessToken);
        localStorage.setItem(GOOGLE_EXPIRY_KEY, String(expiryDate));
        localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(cachedUser));
      }

      // Synchronize token and user session to server
      try {
        await fetch('/api/google/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credential.accessToken}`,
          },
          body: JSON.stringify({
            accessToken: credential.accessToken,
            user: cachedUser,
            expiryDate,
          }),
        });
      } catch (err) {
        console.warn('Gagal sinkron token ke backend session:', err);
      }

      return {
        user: cachedUser,
        accessToken: credential.accessToken,
      };
    } catch (err: any) {
      console.error('All Google Sign-In methods failed:', err);
      throw err;
    }
  },

  async signOut(): Promise<void> {
    this.clearAuth();
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }
  },

  initAuthListener(
    onSuccess: (user: any, token?: string) => void,
    onLoggedOut: () => void
  ) {
    // Initial check from localStorage
    const storedUser = this.getUser();
    const storedToken = this.getAccessToken();
    if (storedUser && storedToken) {
      onSuccess(storedUser, storedToken);
    }

    return onAuthStateChanged(auth, async user => {
      if (user) {
        const currentUserData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        cachedUser = currentUserData;
        const token = this.getAccessToken();
        if (typeof window !== 'undefined') {
          localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(currentUserData));
        }
        onSuccess(currentUserData, token || undefined);
      } else {
        // If not in Firebase auth, check if localStorage still has valid token
        const token = this.getAccessToken();
        const stored = this.getUser();
        if (!token && !stored) {
          cachedUser = null;
          cachedAccessToken = null;
          onLoggedOut();
        }
      }
    });
  },
};
