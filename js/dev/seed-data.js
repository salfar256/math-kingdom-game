/**
 * Data contoh untuk pengembangan.
 *
 * ⚠️ PERINGATAN
 * Skrip ini HANYA boleh dijalankan pada lingkungan pengembangan
 * (localhost atau Firebase Emulator). Skrip menolak berjalan di produksi.
 *
 * Cara memakai:
 *   1. Jalankan aplikasi di localhost
 *   2. Masuk sebagai GURU terlebih dahulu (skrip butuh izin guru)
 *   3. Buka Console peramban (F12), lalu jalankan:
 *
 *      const seed = await import('./js/dev/seed-data.js');
 *      await seed.seedAll();
 *
 * Skrip ini TIDAK memakai Firebase Admin SDK dan TIDAK membutuhkan
 * service account.
 */

import {
  doc, setDoc, writeBatch, serverTimestamp, collection
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { getDb, IS_DEV } from '../firebase/firebase-app.js';
import { getCurrentUid, verifyTeacherRole } from '../firebase/auth-service.js';
import { getAllFactsFor } from '../game/question-generator.js';
import { OPERATION_LIST, MASTERY_STATUS, CHARACTERS } from '../config/game-config.js';
import { makeId, randInt, pickRandom, shuffle } from '../utils/helpers.js';
import { dayKey } from '../utils/date-utils.js';

const KELAS_CONTOH = {
  name: 'Kelas 7A',
  classCode: 'DEMO01'
};

const SISWA_CONTOH = [
  { nama: 'Andi Pratama',   karakter: 'knight',     kemampuan: 0.92, hari: 22, level: 9 },
  { nama: 'Bella Safira',   karakter: 'mage',       kemampuan: 0.78, hari: 18, level: 7 },
  { nama: 'Citra Dewi',     karakter: 'healer',     kemampuan: 0.65, hari: 12, level: 5 },
  { nama: 'Doni Kurniawan', karakter: 'archer',     kemampuan: 0.48, hari: 8,  level: 3 },
  { nama: 'Eka Putri',      karakter: 'adventurer', kemampuan: 0.30, hari: 4,  level: 2 }
];

/** Pemeriksaan keamanan: tolak berjalan di produksi. */
function pastikanDevelopment() {
  const host = location.hostname;
  const aman = IS_DEV || host === 'localhost' || host === '127.0.0.1';

  if (!aman) {
    throw new Error(
      'DITOLAK: seed-data.js hanya boleh dijalankan pada localhost atau emulator. ' +
      `Host saat ini: ${host}`
    );
  }

  console.warn(
    '%c⚠️ MODE PENGEMBANGAN',
    'background:#f5b301;color:#1b1400;font-size:14px;padding:4px 8px;font-weight:bold;'
  );
  console.warn('Skrip ini akan menulis data contoh ke Firestore. Jangan jalankan di produksi.');
}

/** Buat kelas contoh. Membutuhkan pengguna yang sedang masuk adalah guru. */
export async function seedClass() {
  pastikanDevelopment();

  const teacher = await verifyTeacherRole();
  if (!teacher) {
    throw new Error(
      'Anda harus masuk sebagai GURU terlebih dahulu. ' +
      'Buka teacher.html, masuk, lalu jalankan skrip ini dari halaman itu.'
    );
  }

  const db = getDb();
  const classId = 'demo_kelas_7a';
  const batch = writeBatch(db);

  batch.set(doc(db, 'classes', classId), {
    name: KELAS_CONTOH.name,
    classCode: KELAS_CONTOH.classCode,
    teacherUid: teacher.uid,
    createdAt: serverTimestamp(),
    active: true,
    settings: {
      dailyTargetQuestions: 40,
      speedDurationMs: 30000,
      enabledOperations: OPERATION_LIST,
      leaderboardEnabled: true
    }
  });

  batch.set(doc(db, 'classCodes', KELAS_CONTOH.classCode), {
    classId,
    teacherUid: teacher.uid,
    createdAt: serverTimestamp()
  });

  await batch.commit();

  console.log(`✅ Kelas contoh dibuat: ${KELAS_CONTOH.name} (kode: ${KELAS_CONTOH.classCode})`);
  return { classId, classCode: KELAS_CONTOH.classCode, teacherUid: teacher.uid };
}

/**
 * Buat roster siswa dummy di kelas contoh.
 *
 * Catatan: siswa dummy ini hanya ada di roster kelas (untuk menguji tampilan
 * dashboard dan papan peringkat). Mereka tidak memiliki akun Authentication,
 * karena akun anonim hanya dapat dibuat oleh pengguna itu sendiri.
 */
export async function seedStudents(classId = 'demo_kelas_7a') {
  pastikanDevelopment();

  const teacher = await verifyTeacherRole();
  if (!teacher) throw new Error('Harus masuk sebagai guru.');

  const db = getDb();
  const batch = writeBatch(db);
  const hasil = [];

  for (let i = 0; i < SISWA_CONTOH.length; i++) {
    const s = SISWA_CONTOH[i];
    const uid = `demo_siswa_${i + 1}`;
    const totalSoal = s.hari * randInt(30, 50);
    const akurasi = Math.round(s.kemampuan * 100 * 10) / 10;
    const faktaDikuasai = Math.round(s.kemampuan * 180);

    const hariLalu = randInt(0, 2);
    const terakhir = new Date(Date.now() - hariLalu * 86400000);

    batch.set(doc(db, 'classes', classId, 'students', uid), {
      displayName: s.nama,
      characterId: s.karakter,
      joinedAt: serverTimestamp(),
      active: true,
      level: s.level,
      xp: s.level * 400 + randInt(0, 300),
      streak: randInt(1, s.hari),
      lastPracticeAt: terakhir,
      accuracy: akurasi,
      factsMastered: faktaDikuasai,
      totalQuestions: totalSoal,
      daysActive: s.hari,
      hideFromLeaderboard: false
    });

    hasil.push({ uid, nama: s.nama, akurasi, faktaDikuasai });
  }

  await batch.commit();

  console.log(`✅ ${SISWA_CONTOH.length} siswa contoh ditambahkan ke roster.`);
  console.table(hasil);
  return hasil;
}

/**
 * Buat data fakta & sesi untuk pengguna yang sedang masuk (siswa).
 * Berguna untuk menguji halaman profil dan peta fakta dengan cepat.
 *
 * Jalankan dari game.html setelah masuk sebagai siswa.
 */
export async function seedMyProgress({ kemampuan = 0.7, hari = 14 } = {}) {
  pastikanDevelopment();

  const uid = getCurrentUid();
  if (!uid) throw new Error('Harus masuk sebagai siswa terlebih dahulu.');

  const db = getDb();
  const semuaFakta = [];
  for (const op of OPERATION_LIST) semuaFakta.push(...getAllFactsFor(op));

  const dipilih = shuffle(semuaFakta).slice(0, Math.round(semuaFakta.length * 0.7));
  const hariLatihan = [];
  for (let i = hari - 1; i >= 0; i--) {
    hariLatihan.push(dayKey(new Date(Date.now() - i * 86400000)));
  }

  // Tulis fakta dalam beberapa batch.
  const UKURAN_BATCH = 400;
  let ditulis = 0;

  for (let i = 0; i < dipilih.length; i += UKURAN_BATCH) {
    const batch = writeBatch(db);
    const potongan = dipilih.slice(i, i + UKURAN_BATCH);

    for (const fakta of potongan) {
      const percobaan = randInt(2, 12);
      const benar = Math.round(percobaan * (kemampuan + (Math.random() - 0.5) * 0.3));
      const benarBersih = Math.max(0, Math.min(percobaan, benar));
      const akurasi = percobaan > 0 ? benarBersih / percobaan : 0;
      const waktuRata = Math.round(1500 + (1 - akurasi) * 6000);

      let status;
      if (percobaan < 2) status = MASTERY_STATUS.LEARNING;
      else if (akurasi >= 0.9 && waktuRata < 3000) status = MASTERY_STATUS.AUTOMATIC;
      else if (akurasi >= 0.8) status = MASTERY_STATUS.MASTERED;
      else if (akurasi >= 0.6) status = MASTERY_STATUS.DEVELOPING;
      else if (akurasi < 0.4) status = MASTERY_STATUS.NEEDS_REVIEW;
      else status = MASTERY_STATUS.LEARNING;

      const hariFakta = shuffle(hariLatihan).slice(0, randInt(1, Math.min(6, hari)));

      batch.set(doc(db, 'students', uid, 'facts', fakta.factId), {
        operation: fakta.operation,
        operandA: fakta.operandA,
        operandB: fakta.operandB,
        answer: fakta.answer,
        familyId: fakta.familyId,
        status,
        totalAttempts: percobaan,
        correctAttempts: benarBersih,
        wrongAttempts: percobaan - benarBersih,
        consecutiveCorrect: akurasi > 0.7 ? randInt(1, 4) : 0,
        consecutiveWrong: akurasi < 0.5 ? randInt(1, 2) : 0,
        averageResponseMs: waktuRata,
        fastestResponseMs: Math.round(waktuRata * 0.6),
        helpUsedCount: randInt(0, 3),
        daysPracticed: hariFakta.length,
        practiceDays: hariFakta,
        lastSeenAt: new Date(Date.now() - randInt(0, 3) * 86400000),
        lastCorrectAt: new Date(Date.now() - randInt(0, 4) * 86400000),
        nextReviewAt: new Date(Date.now() + randInt(-2, 5) * 86400000),
        updatedAt: serverTimestamp()
      });
      ditulis += 1;
    }

    await batch.commit();
  }

  // Beberapa sesi contoh.
  const sesiBatch = writeBatch(db);
  for (let i = 0; i < Math.min(10, hari); i++) {
    const sesiId = makeId('demo_ses');
    const total = randInt(20, 40);
    const benar = Math.round(total * (kemampuan + (Math.random() - 0.5) * 0.2));

    sesiBatch.set(doc(db, 'students', uid, 'sessions', sesiId), {
      classId: '',
      mode: pickRandom(['practice', 'battle', 'speed', 'mixed']),
      operation: pickRandom(OPERATION_LIST),
      startedAt: new Date(Date.now() - i * 86400000),
      completedAt: new Date(Date.now() - i * 86400000 + 720000),
      totalQuestions: total,
      correct: benar,
      wrong: total - benar,
      skipped: 0,
      accuracy: Math.round((benar / total) * 1000) / 10,
      averageResponseMs: randInt(2000, 6000),
      score: benar * 12,
      xpEarned: benar * 5,
      factsMastered: randInt(0, 4),
      factsAutomatic: randInt(0, 2)
    });
  }
  await sesiBatch.commit();

  // Profil.
  const totalSoal = hari * randInt(30, 45);
  await setDoc(doc(db, 'students', uid), {
    level: Math.max(1, Math.round(kemampuan * 10)),
    xp: Math.round(kemampuan * 4000),
    streak: randInt(1, hari),
    lastPracticeAt: new Date(),
    totalQuestions: totalSoal,
    totalCorrect: Math.round(totalSoal * kemampuan),
    daysActive: hari,
    practiceDays: hariLatihan,
    placementDone: true,
    placementResult: {
      accuracy: Math.round(kemampuan * 60 * 10) / 10,
      correct: 24, wrong: 14, skipped: 2,
      averageResponseMs: 7000,
      takenAt: new Date(Date.now() - hari * 86400000)
    },
    sessionsCompleted: hari,
    updatedAt: serverTimestamp()
  }, { merge: true });

  console.log(`✅ ${ditulis} fakta dan 10 sesi contoh dibuat untuk ${uid}.`);
  console.log('Muat ulang halaman untuk melihat hasilnya.');
  return { facts: ditulis, uid };
}

/** Jalankan seluruh proses seeding (guru). */
export async function seedAll() {
  pastikanDevelopment();

  console.log('🌱 Memulai seeding data contoh…\n');

  const klass = await seedClass();
  await seedStudents(klass.classId);

  console.log('\n✅ Selesai.');
  console.log(`\nKode kelas untuk diuji: ${klass.classCode}`);
  console.log('Buka student.html di jendela penyamaran, lalu masuk dengan kode itu.');
  console.log('\nUntuk membuat progres siswa contoh, masuk sebagai siswa lalu jalankan:');
  console.log('  const seed = await import("./js/dev/seed-data.js");');
  console.log('  await seed.seedMyProgress({ kemampuan: 0.7, hari: 14 });');

  return klass;
}

/** Hapus seluruh data contoh. */
export async function clearSeed(classId = 'demo_kelas_7a') {
  pastikanDevelopment();

  const teacher = await verifyTeacherRole();
  if (!teacher) throw new Error('Harus masuk sebagai guru.');

  const db = getDb();
  const batch = writeBatch(db);

  for (let i = 0; i < SISWA_CONTOH.length; i++) {
    batch.delete(doc(db, 'classes', classId, 'students', `demo_siswa_${i + 1}`));
  }
  batch.delete(doc(db, 'classCodes', KELAS_CONTOH.classCode));
  batch.delete(doc(db, 'classes', classId));

  await batch.commit();
  console.log('✅ Data contoh dihapus.');
}