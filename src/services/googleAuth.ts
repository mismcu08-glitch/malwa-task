import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export interface GoogleUserStub {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

type AuthSubscriber = (user: GoogleUserStub | null, token: string | null) => void;

// Scopes required for Google Sheets Realtime Sync Database
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: GoogleUserStub | null = null;

class GoogleAuthService {
  private listeners: Set<AuthSubscriber> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedToken = sessionStorage.getItem('malwa_temp_gauth_token');
        const savedUser = sessionStorage.getItem('malwa_temp_gauth_user');
        if (savedToken && savedUser) {
          cachedAccessToken = savedToken;
          cachedUser = JSON.parse(savedUser);
        }
      } catch (e) {
        // In-memory cache is primary
      }

      onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          cachedUser = {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          };
          if (!cachedAccessToken && !isSigningIn) {
            // Token will be refreshed on next manual interaction or remains in memory
          }
        } else {
          cachedAccessToken = null;
          cachedUser = null;
          try {
            sessionStorage.removeItem('malwa_temp_gauth_token');
            sessionStorage.removeItem('malwa_temp_gauth_user');
          } catch (e) {
            // ignore
          }
        }
        this.notify();
      });
    }
  }

  public subscribeGoogleAuth(cb: AuthSubscriber): () => void {
    this.listeners.add(cb);
    cb(cachedUser, cachedAccessToken);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(cachedUser, cachedAccessToken));
  }

  public async googleSignIn(): Promise<{ user: GoogleUserStub; accessToken: string }> {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error('Failed to obtain Google Sheets OAuth access token.');
      }

      cachedAccessToken = token;
      cachedUser = {
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      };

      try {
        sessionStorage.setItem('malwa_temp_gauth_token', token);
        sessionStorage.setItem('malwa_temp_gauth_user', JSON.stringify(cachedUser));
      } catch (e) {
        // ignore
      }

      this.notify();
      return { user: cachedUser, accessToken: token };
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      throw error;
    } finally {
      isSigningIn = false;
    }
  }

  public async googleLogout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error', e);
    }
    cachedAccessToken = null;
    cachedUser = null;
    try {
      sessionStorage.removeItem('malwa_temp_gauth_token');
      sessionStorage.removeItem('malwa_temp_gauth_user');
    } catch (e) {
      // ignore
    }
    this.notify();
  }

  public getAccessToken(): string | null {
    return cachedAccessToken;
  }

  public getCurrentUser(): GoogleUserStub | null {
    return cachedUser;
  }
}

export const googleAuthService = new GoogleAuthService();
export const googleSignIn = () => googleAuthService.googleSignIn();
export const googleLogout = () => googleAuthService.googleLogout();
export const getAccessToken = () => googleAuthService.getAccessToken();
export const subscribeGoogleAuth = (cb: AuthSubscriber) =>
  googleAuthService.subscribeGoogleAuth(cb);

