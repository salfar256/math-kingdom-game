/**
 * Akses data Firestore untuk siswa: profil, fakta, sesi, attempt.
 *
 * Prinsip hemat biaya:
 * - Fakta dimuat sekali per sesi, disimpan di memori, ditulis batch di akhir.
 * - Attempt ditulis dalam satu batch, bukan per ketukan tombol.
 * - Maksimal 500 operasi per batch (batas Firestore) -> dipecah otomatis.
 */

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, orderBy, limit,
  writeBatch, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { getDb, devLog, devError } from './firebase-app.js';

const MAX_BATCH = 450; // aman di bawah batas 500

/* ============ PROFIL SISWA ============ */

export async function getStudentProfile(uid) {
  const snap = await getDoc(doc(getDb(), 'students', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Buat atau perbarui profil siswa (merge). */
export async function upsertStudentProfile(uid, data) {
  const payload = {
    ...data,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(getDb(), 'students', uid), payload, { merge: true });
  return payload;
}

export async function updateStudentProfile(uid, patch) {
  await updateDoc(doc(getDb(), 'students', uid), {
    ...patch,
    updatedAt: serverTimestamp()
  });
}

/* ============ FAKTA ============ */

/** Muat seluruh fakta siswa. Dipanggil sekali saat game dimulai. */
export async function loadAllFacts(uid) {
  const map = new Map();
  try {
    const snap = await getDocs(collection(getDb(), 'students', uid, 'facts'));
    snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
    devLog(`Memuat ${map.size} fakta.`);
  } catch (e) {
    devError('loadAllFacts gagal:', e);
    throw e;
  }
  return map;
}

/**
 * Simpan sekumpulan fakta yang berubah dalam batch.
 * @param {string} uid
 * @param {Array<object>} facts objek fakta yang wajib punya properti .id
 */
export async function saveFactsBatch(uid, facts) {
  if (!Array.isArray(facts) || facts.length === 0) return 0;
  const db = getDb();
  let written = 0;

  for (let i = 0; i < facts.length; i += MAX_BATCH) {
    const chunk = facts.slice(i, i + MAX_BATCH);
    const batch = writeBatch(db);
    for (const fact of chunk) {
      const { id, ...rest } = fact;
      batch.set(
        doc(db, 'students', uid, 'facts', id),
        { ...rest, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
    written += chunk.length;
  }
  devLog(`Menyimpan ${written} fakta.`);
  return written;
}

/* ============ SESI ============ */

/** Simpan ringkasan sesi + seluruh attempt dalam batch. */
export async function saveSession(uid, sessionId, summary, attempts = []) {
  const db = getDb();
  const sessionRef = doc(db, 'students', uid, 'sessions', sessionId);

  const firstBatch = writeBatch(db);
  firstBatch.set(sessionRef, {
    ...summary,
    completedAt: serverTimestamp()
  }, { merge: true });

  const firstChunk = attempts.slice(0, MAX_BATCH - 1);
  for (const attempt of firstChunk) {
    const aRef = doc(collection(sessionRef, 'attempts'));
    firstBatch.set(aRef, { ...attempt, createdAt: serverTimestamp() });
  }
  await firstBatch.commit();

  for (let i = MAX_BATCH - 1; i < attempts.length; i += MAX_BATCH) {
    const chunk = attempts.slice(i, i + MAX_BATCH);
    const batch = writeBatch(db);
    for (const attempt of chunk) {
      const aRef = doc(collection(sessionRef, 'attempts'));
      batch.set(aRef, { ...attempt, createdAt: serverTimestamp() });
    }
    await batch.commit();
  }

  devLog(`Sesi ${sessionId} tersimpan dengan ${attempts.length} attempt.`);
  return sessionId;
}

/** Ambil N sesi terakhir siswa. */
export async function getRecentSessions(uid, n = 30) {
  const q = query(
    collection(getDb(), 'students', uid, 'sessions'),
    orderBy('completedAt', 'desc'),
    limit(n)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ============ ROSTER KELAS ============ */

/** Perbarui ringkasan siswa di roster kelas (untuk dashboard guru). */
export async function updateClassRoster(classId, uid, data) {
  await setDoc(
    doc(getDb(), 'classes', classId, 'students', uid),
    data,
    { merge: true }
  );
}

/* ============ RESET PROGRES (GURU) ============ */

/**
 * Hapus seluruh fakta & sesi seorang siswa.
 * Dipanggil oleh guru pemilik kelas setelah konfirmasi.
 */
export async function resetStudentProgress(uid) {
  const db = getDb();

  const factSnap = await getDocs(collection(db, 'students', uid, 'facts'));
  const factDocs = factSnap.docs;
  for (let i = 0; i < factDocs.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    factDocs.slice(i, i + MAX_BATCH).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const sessionSnap = await getDocs(collection(db, 'students', uid, 'sessions'));
  for (const s of sessionSnap.docs) {
    const attemptSnap = await getDocs(collection(s.ref, 'attempts'));
    const aDocs = attemptSnap.docs;
    for (let i = 0; i < aDocs.length; i += MAX_BATCH) {
      const batch = writeBatch(db);
      aDocs.slice(i, i + MAX_BATCH).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(s.ref);
  }

  await updateDoc(doc(db, 'students', uid), {
    level: 1,
    xp: 0,
    streak: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    daysActive: 0,
    placementDone: false,
    updatedAt: serverTimestamp()
  });

  devLog(`Progres siswa ${uid} direset.`);
}

export { serverTimestamp, increment, where };