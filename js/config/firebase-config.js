/**
 * Konfigurasi Firebase untuk proyek "Pertarungan Empat Kerajaan Hitungan".
 *
 * CATATAN KEAMANAN:
 * Firebase Web API key BUKAN rahasia dan memang terlihat di sisi klien.
 * Keamanan data ditentukan oleh Firebase Authentication + Firestore Rules
 * (lihat firestore.rules).
 *
 * JANGAN PERNAH menaruh service account / private key di repository ini.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyAe3zbYpesjcwY1K6R42jbk_87GzQlexP0",
  authDomain: "game-kerajaan-matematika.firebaseapp.com",
  projectId: "game-kerajaan-matematika",
  storageBucket: "game-kerajaan-matematika.firebasestorage.app",
  messagingSenderId: "1050902681238",
  appId: "1:1050902681238:web:797da6c0ea651fbcea54b7",
  measurementId: "G-MVWR9G39PY"
};

/** Ubah ke true untuk memakai Firebase Local Emulator Suite. */
export const USE_EMULATOR = false;

export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080
};

/** Mode development: mengaktifkan log teknis di console. */
export const IS_DEV =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1';