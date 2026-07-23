/**
 * Layanan autentikasi.
 * - Siswa  : Anonymous Authentication.
 * - Guru   : Email/Password + verifikasi dokumen teachers/{uid}.
 *
 * Role TIDAK PERNAH diambil dari URL atau localStorage.
 * Role guru hanya sah bila dokumen teachers/{uid}.active === true di Firestore.
 */

import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { getFirebaseAuth, getDb, devLog, devError } from './firebase-app.js';

/* ============ AKUN SISWA (nama + kode kelas + PIN) ============
 * Di balik layar memakai Email/Password Firebase dengan alamat sintetis
 * yang deterministik, sehingga siswa bisa masuk kembali ke akun yang sama
 * dari perangkat mana pun tanpa perlu email sungguhan.
 */

/** Bentuk email sintetis deterministik dari nama + kode kelas. */
export function buildStudentEmail(nickname, classCode) {
  const nick = String(nickname).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]/g, '').slice(0, 24) || 'siswa';
  const code = String(classCode).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${nick}.${code}@siswa.empatkerajaan.app`;
}

/** PIN 6 digit -> password Firebase (minimal 6 karakter terpenuhi). */
function pinToPassword(pin) {
  return `pin-${pin}`;
}

/** Daftarkan akun siswa baru. @returns {Promise<string>} uid */
export async function registerStudentAccount(nickname, classCode, pin) {
  const auth = getFirebaseAuth();
  const email = buildStudentEmail(nickname, classCode);
  const cred = await createUserWithEmailAndPassword(auth, email, pinToPassword(pin));
  devLog('Akun siswa dibuat:', cred.user.uid);
  return cred.user.uid;
}

/** Masuk ke akun siswa yang sudah ada. @returns {Promise<string>} uid */
export async function loginStudentAccount(nickname, classCode, pin) {
  const auth = getFirebaseAuth();
  const email = buildStudentEmail(nickname, classCode);
  const cred = await signInWithEmailAndPassword(auth, email, pinToPassword(pin));
  devLog('Siswa masuk kembali:', cred.user.uid);
  return cred.user.uid;
}

/** Masuk sebagai siswa (anonim). @returns {Promise<string>} uid */
export async function signInStudent() {
  const auth = getFirebaseAuth();
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    return auth.currentUser.uid;
  }
  const cred = await signInAnonymously(auth);
  devLog('Siswa masuk anonim:', cred.user.uid);
  return cred.user.uid;
}

/**
 * Masuk sebagai guru. Jika dokumen teachers/{uid} tidak ada atau tidak aktif,
 * pengguna langsung dikeluarkan kembali.
 * @returns {Promise<{uid: string, profile: object}>}
 */
export async function signInTeacher(email, password) {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const profile = await fetchTeacherProfile(uid);
  if (!profile || profile.active !== true) {
    await fbSignOut(auth);
    const err = new Error('NOT_A_TEACHER');
    err.code = 'app/not-a-teacher';
    throw err;
  }
  devLog('Guru masuk:', uid);
  return { uid, profile };
}

/** Ambil dokumen teachers/{uid}. @returns {Promise<object|null>} */
export async function fetchTeacherProfile(uid) {
  try {
    const snap = await getDoc(doc(getDb(), 'teachers', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    devError('fetchTeacherProfile gagal:', e);
    return null;
  }
}

/** Verifikasi bahwa pengguna yang sedang masuk benar-benar guru aktif. */
export async function verifyTeacherRole() {
  const user = getCurrentUser();
  if (!user || user.isAnonymous) return null;
  const profile = await fetchTeacherProfile(user.uid);
  if (!profile || profile.active !== true) return null;
  return { uid: user.uid, profile };
}

export function getCurrentUser() {
  try {
    return getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
}

export function getCurrentUid() {
  const u = getCurrentUser();
  return u ? u.uid : null;
}

export async function signOut() {
  try {
    await fbSignOut(getFirebaseAuth());
  } catch (e) {
    devError('signOut gagal:', e);
  }
}

/** Menunggu status auth pertama kali terselesaikan. @returns {Promise<User|null>} */
export function waitForAuth(timeoutMs = 10000) {
  return new Promise((resolve) => {
    let settled = false;
    let unsub = () => {};

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub();
      resolve(null);
    }, timeoutMs);

    try {
      unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsub();
        resolve(user);
      }, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Pantau perubahan status auth. @returns {Function} fungsi unsubscribe */
export function watchAuth(callback) {
  try {
    return onAuthStateChanged(getFirebaseAuth(), callback);
  } catch {
    callback(null);
    return () => {};
  }
}