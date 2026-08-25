// Firebase Firestore Cloud Sync for Malwa Concrete Operations
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDocs,
} from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { TaskItem, User, StageAssignmentConfig } from '../types';
import { INITIAL_USERS } from '../data/initialData';

// Initialize Firebase App & Firestore
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== '(default)'
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

// Configure persistent authentication state across browser tabs, sessions, and devices
export const initFirebaseAuth = async (): Promise<FirebaseUser | null> => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    if (!auth.currentUser) {
      const userCredential = await signInAnonymously(auth);
      return userCredential.user;
    }
    return auth.currentUser;
  } catch (error) {
    console.warn('Firebase Auth persistence/sign-in notice:', error);
    return auth.currentUser;
  }
};

// Immediately initialize auth persistence in background
initFirebaseAuth();

const TASKS_COLLECTION = 'malwa_tasks';
const USERS_COLLECTION = 'malwa_employees';
const SETTINGS_COLLECTION = 'malwa_settings';

/**
 * Save / Update a task in cloud Firestore
 */
export const saveCloudTask = async (task: TaskItem): Promise<boolean> => {
  try {
    if (!task || !task.Task_ID) return false;
    const cleanTask = JSON.parse(JSON.stringify(task)); // sanitize undefined
    await setDoc(doc(db, TASKS_COLLECTION, task.Task_ID), {
      ...cleanTask,
      lastSyncedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Failed to save task to Firestore:', error);
    return false;
  }
};

/**
 * Delete a task from cloud Firestore
 */
export const deleteCloudTask = async (taskId: string): Promise<boolean> => {
  try {
    if (!taskId) return false;
    await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
    return true;
  } catch (error) {
    console.error('Failed to delete task from Firestore:', error);
    return false;
  }
};

/**
 * Subscribe to real-time task updates across all devices (Mobile + Desktop)
 */
export const subscribeCloudTasks = (onUpdate: (tasks: TaskItem[]) => void) => {
  try {
    const q = query(collection(db, TASKS_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cloudTasks: TaskItem[] = [];
        snapshot.forEach((d) => {
          cloudTasks.push(d.data() as TaskItem);
        });
        // Sort newest first
        cloudTasks.sort((a, b) => {
          const tA = new Date(a.Created_At || a.Due_Date || 0).getTime();
          const tB = new Date(b.Created_At || b.Due_Date || 0).getTime();
          return tB - tA;
        });
        onUpdate(cloudTasks);
      },
      (error) => {
        console.warn('Firestore tasks subscription error:', error);
      }
    );
    return unsubscribe;
  } catch (error) {
    console.warn('Could not establish Firestore tasks subscription:', error);
    return () => {};
  }
};

/**
 * Save / Update a user in cloud Firestore
 */
export const saveCloudUser = async (user: User): Promise<boolean> => {
  try {
    if (!user || !user.User_ID) return false;
    const cleanUser = JSON.parse(JSON.stringify(user));
    await setDoc(doc(db, USERS_COLLECTION, user.User_ID), {
      ...cleanUser,
      lastSyncedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Failed to save user to Firestore:', error);
    return false;
  }
};

/**
 * Delete a user from cloud Firestore
 */
export const deleteCloudUser = async (userId: string): Promise<boolean> => {
  try {
    if (!userId) return false;
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
    return true;
  } catch (error) {
    console.error('Failed to delete user from Firestore:', error);
    return false;
  }
};

/**
 * Subscribe to real-time users across all devices
 */
export const subscribeCloudUsers = (onUpdate: (users: User[]) => void) => {
  try {
    const q = query(collection(db, USERS_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          // Initial seed if cloud has no users yet
          for (const u of INITIAL_USERS) {
            await saveCloudUser(u);
          }
          onUpdate(INITIAL_USERS);
          return;
        }
        const cloudUsers: User[] = [];
        snapshot.forEach((d) => {
          cloudUsers.push(d.data() as User);
        });
        onUpdate(cloudUsers);
      },
      (error) => {
        console.warn('Firestore users subscription error:', error);
      }
    );
    return unsubscribe;
  } catch (error) {
    console.warn('Could not establish Firestore users subscription:', error);
    return () => {};
  }
};

/**
 * Save stage assignment config to cloud
 */
export const saveCloudStageConfig = async (config: StageAssignmentConfig): Promise<boolean> => {
  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, 'stage_config'), config, { merge: true });
    return true;
  } catch (error) {
    console.error('Failed to save stage config to Firestore:', error);
    return false;
  }
};

/**
 * Subscribe to stage assignment config
 */
export const subscribeCloudStageConfig = (onUpdate: (config: StageAssignmentConfig) => void) => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, 'stage_config');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as StageAssignmentConfig);
        }
      },
      (error) => {
        console.warn('Firestore stage config subscription error:', error);
      }
    );
    return unsubscribe;
  } catch (error) {
    console.warn('Could not establish Firestore stage config subscription:', error);
    return () => {};
  }
};
