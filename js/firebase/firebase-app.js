/**
 * Inisialisasi Firebase (SDK modular via CDN, tanpa build step).
 * Semua modul lain mengambil instance dari sini.
 */

import { initializeApp, getApps }
  from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { firebaseConfig, USE_EMULATOR, EMULATOR_PORTS, IS_DEV }
  from '../config/firebase-config.js';

let app = null;
let auth = null;
let db = null;
let initError = null;

function configLooksValid(cfg) {
  return Boolean(
    cfg &&
    typeof cfg.apiKey === 'string' &&
    cfg.apiKey.length > 10 &&
    !cfg.apiKey.startsWith('GANTI_') &&
    typeof cfg.projectId === 'string' &&
    cfg.projectId.length > 0 &&
    cfg.projectId !== 'PROJECT_ID'
  );
}

function initialize() {
  if (app || initError) return;

  if (!configLooksValid(firebaseConfig)) {
    initError = new Error(
      'Firebase belum dikonfigurasi. Salin js/config/firebase-config.example.js ' +
      'menjadi js/config/firebase-config.js lalu isi dengan konfigurasi proyek Anda.'
    );
    return;
  }

  try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    if (USE_EMULATOR) {
      connectAuthEmulator(auth, `http://127.0.0.1:${EMULATOR_PORTS.auth}`, {
        disableWarnings: true
      });
      connectFirestoreEmulator(db, '127.0.0.1', EMULATOR_PORTS.firestore);
      devLog('Firebase Emulator aktif.');
    }

    // Persistensi lokal agar siswa dapat melanjutkan dari perangkat yang sama.
    setPersistence(auth, browserLocalPersistence).catch((e) => devLog('setPersistence', e));
  } catch (e) {
    initError = e;
  }
}

initialize();

/** Log teknis hanya pada mode development. */
export function devLog(...args) {
  if (IS_DEV) console.log('[MathKingdom]', ...args);
}

export function devWarn(...args) {
  if (IS_DEV) console.warn('[MathKingdom]', ...args);
}

export function devError(...args) {
  if (IS_DEV) console.error('[MathKingdom]', ...args);
}

/** @returns {boolean} apakah Firebase siap dipakai. */
export function isFirebaseReady() {
  return Boolean(app && auth && db);
}

/** @returns {Error|null} error inisialisasi, jika ada. */
export function getInitError() {
  return initError;
}

export function getFirebaseAuth() {
  if (!auth) throw initError || new Error('Firebase Auth belum siap.');
  return auth;
}

export function getDb() {
  if (!db) throw initError || new Error('Cloud Firestore belum siap.');
  return db;
}

export function getFirebaseApp() {
  if (!app) throw initError || new Error('Firebase App belum siap.');
  return app;
}

export { IS_DEV };