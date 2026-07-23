/**
 * Layanan kelas: pencarian kode kelas, pendaftaran siswa,
 * dan operasi kelas untuk guru.
 *
 * classCodes/{CODE} dipakai sebagai index lookup supaya siswa anonim
 * dapat memvalidasi kode kelas tanpa izin membaca seluruh koleksi classes.
 */

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, orderBy,
  serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { getDb, devLog, devError } from './firebase-app.js';
import { makeClassCode } from '../utils/helpers.js';

/**
 * Cari kelas berdasarkan kode.
 * @returns {Promise<{id: string, ...}|null>}
 */
export async function findClassByCode(code) {
  const upper = String(code || '').toUpperCase().trim();
  if (!upper) return null;

  const db = getDb();
  const codeSnap = await getDoc(doc(db, 'classCodes', upper));
  if (!codeSnap.exists()) return null;

  const classId = codeSnap.data().classId;
  if (!classId) return null;

  const classSnap = await getDoc(doc(db, 'classes', classId));
  if (!classSnap.exists()) return null;

  return { id: classSnap.id, ...classSnap.data() };
}

/**
 * Daftarkan siswa ke kelas: tulis profil siswa + roster kelas.
 * Dijalankan sebagai dua penulisan yang keduanya diizinkan oleh Rules.
 */
export async function enrollStudent(uid, classId, { displayName, characterId }) {
  const db = getDb();
  const batch = writeBatch(db);

  batch.set(doc(db, 'students', uid), {
    displayName,
    characterId,
    activeClassId: classId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  batch.set(doc(db, 'classes', classId, 'students', uid), {
    displayName,
    characterId,
    joinedAt: serverTimestamp(),
    active: true,
    level: 1,
    xp: 0,
    streak: 0
  }, { merge: true });

  await batch.commit();
  devLog(`Siswa ${uid} terdaftar di kelas ${classId}.`);
}

/* ============ OPERASI GURU ============ */

/** Ambil semua kelas milik seorang guru. */
export async function getTeacherClasses(teacherUid) {
  const q = query(
    collection(getDb(), 'classes'),
    where('teacherUid', '==', teacherUid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Buat kelas baru beserta index kode kelasnya. */
export async function createClass(teacherUid, name, settings = {}) {
  const db = getDb();

  let code = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = makeClassCode(6);
    const exists = await getDoc(doc(db, 'classCodes', candidate));
    if (!exists.exists()) { code = candidate; break; }
  }
  if (!code) throw new Error('Gagal membuat kode kelas unik. Coba lagi.');

  const classRef = doc(collection(db, 'classes'));
  const batch = writeBatch(db);

  batch.set(classRef, {
    name,
    classCode: code,
    teacherUid,
    createdAt: serverTimestamp(),
    active: true,
    settings: {
      dailyTargetQuestions: 40,
      speedDurationMs: 30000,
      enabledOperations: ['addition', 'subtraction', 'multiplication', 'division'],
      ...settings
    }
  });

  batch.set(doc(db, 'classCodes', code), {
    classId: classRef.id,
    teacherUid,
    createdAt: serverTimestamp()
  });

  await batch.commit();
  devLog(`Kelas dibuat: ${classRef.id} (${code})`);
  return { id: classRef.id, classCode: code, name };
}

/** Ambil daftar siswa dalam sebuah kelas (dari roster ringkas). */
export async function getClassStudents(classId) {
  const snap = await getDocs(collection(getDb(), 'classes', classId, 'students'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function updateClassName(classId, name) {
  await updateDoc(doc(getDb(), 'classes', classId), { name });
}

export async function updateClassSettings(classId, settings) {
  await updateDoc(doc(getDb(), 'classes', classId), { settings });
}

/** Hapus kelas: roster, index kode, lalu dokumen kelas. */
export async function deleteClass(classId, classCode) {
  const db = getDb();

  const students = await getDocs(collection(db, 'classes', classId, 'students'));
  const batch = writeBatch(db);
  students.docs.forEach((d) => batch.delete(d.ref));
  if (classCode) batch.delete(doc(db, 'classCodes', String(classCode).toUpperCase()));
  batch.delete(doc(db, 'classes', classId));
  await batch.commit();

  devLog(`Kelas ${classId} dihapus.`);
}

/** Ambil detail seorang siswa untuk dashboard guru. */
export async function getStudentDetail(studentUid) {
  const db = getDb();
  try {
    const profileSnap = await getDoc(doc(db, 'students', studentUid));
    if (!profileSnap.exists()) return null;

    const factSnap = await getDocs(collection(db, 'students', studentUid, 'facts'));
    const facts = factSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return { uid: studentUid, profile: profileSnap.data(), facts };
  } catch (e) {
    devError('getStudentDetail gagal:', e);
    return null;
  }
}