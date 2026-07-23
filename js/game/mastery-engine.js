/**
 * Mesin penguasaan fakta.
 *
 * Prinsip:
 * - Satu jawaban benar TIDAK pernah langsung membuat fakta dikuasai.
 * - Jawaban benar dengan bantuan bernilai lebih kecil.
 * - Penguasaan membutuhkan sesi/hari yang berbeda.
 * - Kegagalan retensi menurunkan status.
 */

import {
  MASTERY_STATUS, MASTERY_CONFIG, SPACED_INTERVALS_MS, CORRECT_PER_FACT
} from '../config/game-config.js';
import { buildFact, getAllFactsFor } from './question-generator.js';
import { dayKey, toMillis } from '../utils/date-utils.js';

/** Buat rekaman fakta baru (belum pernah dikerjakan). */
export function createEmptyFactRecord(question) {
  const base = buildFact(question.operation, question.operandA, question.operandB);
  return {
    id: base.factId,
    operation: base.operation,
    operandA: base.operandA,
    operandB: base.operandB,
    answer: base.answer,
    familyId: base.familyId,
    status: MASTERY_STATUS.UNSEEN,
    totalAttempts: 0,
    correctAttempts: 0,
    wrongAttempts: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    averageResponseMs: 0,
    fastestResponseMs: 0,
    helpUsedCount: 0,
    daysPracticed: 0,
    practiceDays: [],
    sessionsSeen: 0,
    lastSeenAt: null,
    lastCorrectAt: null,
    nextReviewAt: null
  };
}

/** Akurasi fakta 0–1. */
export function factAccuracy(fact) {
  if (!fact || !fact.totalAttempts) return 0;
  return fact.correctAttempts / fact.totalAttempts;
}

/**
 * Perbarui rekaman fakta setelah satu percobaan.
 *
 * @param {object} fact rekaman fakta (akan disalin, bukan dimutasi)
 * @param {object} attempt { correct, responseMs, helpLevel, sessionId, now }
 * @returns {{fact: object, statusChanged: boolean, previousStatus: string, newlyMastered: boolean, newlyAutomatic: boolean}}
 */
export function updateFactMastery(fact, attempt) {
  const now = attempt.now instanceof Date ? attempt.now : new Date();
  const f = { ...fact, practiceDays: Array.isArray(fact.practiceDays) ? [...fact.practiceDays] : [] };
  const previousStatus = f.status || MASTERY_STATUS.UNSEEN;

  const correct = Boolean(attempt.correct);
  const helpLevel = Number(attempt.helpLevel || 0);
  const responseMs = Math.max(0, Number(attempt.responseMs || 0));
  const usedHelp = helpLevel > 0;

  const previousAvg = f.averageResponseMs || 0;

  f.totalAttempts += 1;
  f.lastSeenAt = now;

  if (correct) {
    // Jawaban dengan bantuan dihitung sebagian saja.
    f.correctAttempts += usedHelp ? MASTERY_CONFIG.helpCorrectWeight : 1;
    f.consecutiveCorrect += usedHelp ? 0 : 1;
    f.consecutiveWrong = 0;
    f.lastCorrectAt = now;

    // Rata-rata waktu hanya dihitung dari jawaban benar tanpa bantuan.
    if (!usedHelp && responseMs > 0) {
      const n = countUnaidedCorrect(f);
      f.averageResponseMs = n <= 1
        ? responseMs
        : Math.round(((previousAvg * (n - 1)) + responseMs) / n);
      if (!f.fastestResponseMs || responseMs < f.fastestResponseMs) {
        f.fastestResponseMs = responseMs;
      }
    }
  } else {
    f.wrongAttempts += 1;
    f.consecutiveWrong += 1;
    f.consecutiveCorrect = 0;
  }

  if (usedHelp) f.helpUsedCount += 1;

  // Catat hari latihan (maksimal 60 entri terakhir agar dokumen tidak membengkak).
  const key = dayKey(now);
  if (!f.practiceDays.includes(key)) {
    f.practiceDays.push(key);
    if (f.practiceDays.length > 60) f.practiceDays = f.practiceDays.slice(-60);
    f.daysPracticed = f.practiceDays.length;
  }

  // Catat sesi berbeda.
  if (attempt.sessionId && f.lastSessionId !== attempt.sessionId) {
    f.sessionsSeen = (f.sessionsSeen || 0) + 1;
    f.lastSessionId = attempt.sessionId;
  }

  const slowedDown =
    previousAvg > 0 &&
    responseMs > previousAvg * MASTERY_CONFIG.demoteSlowFactor &&
    (previousStatus === MASTERY_STATUS.MASTERED || previousStatus === MASTERY_STATUS.AUTOMATIC);

  f.status = evaluateStatus(f, { previousStatus, correct, slowedDown });
  f.nextReviewAt = scheduleNextReview(f, { correct, now });

  return {
    fact: f,
    statusChanged: f.status !== previousStatus,
    previousStatus,
    newlyMastered:
      f.status === MASTERY_STATUS.MASTERED &&
      previousStatus !== MASTERY_STATUS.MASTERED &&
      previousStatus !== MASTERY_STATUS.AUTOMATIC,
    newlyAutomatic:
      f.status === MASTERY_STATUS.AUTOMATIC &&
      previousStatus !== MASTERY_STATUS.AUTOMATIC
  };
}

function countUnaidedCorrect(f) {
  // Perkiraan: correctAttempts sudah memperhitungkan bobot bantuan.
  return Math.max(1, Math.round(f.correctAttempts));
}

/** Tentukan status baru berdasarkan seluruh riwayat fakta. */
export function evaluateStatus(f, { previousStatus, correct, slowedDown }) {
  const C = MASTERY_CONFIG;
  const acc = factAccuracy(f);
  const days = f.daysPracticed || 0;
  const sessions = f.sessionsSeen || 0;
  const avg = f.averageResponseMs || Infinity;

  // Turun status: salah berulang atau melambat drastis.
  if (f.consecutiveWrong >= C.demoteConsecutiveWrong || slowedDown) {
    return MASTERY_STATUS.NEEDS_REVIEW;
  }

  if (!correct && f.consecutiveWrong >= 1) {
    if (previousStatus === MASTERY_STATUS.AUTOMATIC) return MASTERY_STATUS.MASTERED;
    if (previousStatus === MASTERY_STATUS.MASTERED) return MASTERY_STATUS.NEEDS_REVIEW;
  }

  // Naik ke automatic.
  if (f.correctAttempts >= C.automaticMinCorrect &&
      days >= C.automaticMinDays &&
      acc >= C.automaticMinAccuracy &&
      avg <= C.automaticMaxAvgMs) {
    return MASTERY_STATUS.AUTOMATIC;
  }

  // Naik ke mastered.
  if (f.correctAttempts >= C.masteredMinCorrect &&
      sessions >= C.masteredMinSessions &&
      acc >= C.masteredMinAccuracy &&
      avg <= C.masteredMaxAvgMs) {
    return MASTERY_STATUS.MASTERED;
  }

  // Developing.
  if (f.correctAttempts >= C.developingMinCorrect && acc >= C.developingMinAccuracy) {
    return MASTERY_STATUS.DEVELOPING;
  }

  if (f.totalAttempts > 0) return MASTERY_STATUS.LEARNING;
  return MASTERY_STATUS.UNSEEN;
}

/**
 * Jadwalkan pengulangan berikutnya.
 * @returns {Date}
 */
export function scheduleNextReview(fact, { correct, now = new Date() } = {}) {
  const base = now instanceof Date ? now.getTime() : Date.now();

  if (!correct) {
    // Dijadwalkan segera; antrean koreksi dalam sesi menangani pengulangan pendek.
    return new Date(base);
  }

  const interval = SPACED_INTERVALS_MS[fact.status];
  if (typeof interval !== 'number') return new Date(base + SPACED_INTERVALS_MS.learning);
  return new Date(base + interval);
}

/** Apakah fakta sudah jatuh tempo untuk diulang. */
export function isDue(fact, now = Date.now()) {
  if (!fact) return false;
  if (!fact.nextReviewAt) return true;
  return toMillis(fact.nextReviewAt) <= now;
}

/** Apakah fakta tergolong lemah (perlu banyak latihan). */
export function isWeak(fact) {
  if (!fact) return true;
  const s = fact.status;
  return s === MASTERY_STATUS.UNSEEN ||
         s === MASTERY_STATUS.LEARNING ||
         s === MASTERY_STATUS.NEEDS_REVIEW ||
         (s === MASTERY_STATUS.DEVELOPING && factAccuracy(fact) < 0.75);
}

/** Apakah fakta sudah dikuasai (mastered atau automatic). */
export function isMastered(fact) {
  if (!fact) return false;
  return fact.status === MASTERY_STATUS.MASTERED ||
         fact.status === MASTERY_STATUS.AUTOMATIC;
}

/**
 * Ringkasan penguasaan seluruh fakta.
 * @param {Map<string,object>} factMap
 * @returns {object}
 */
export function summarizeMastery(factMap) {
  const counts = {
    unseen: 0, learning: 0, developing: 0,
    mastered: 0, automatic: 0, needs_review: 0
  };
  const byOperation = {};

  for (const fact of factMap.values()) {
    const status = fact.status || MASTERY_STATUS.UNSEEN;
    if (counts[status] !== undefined) counts[status] += 1;

    const op = fact.operation;
    if (!byOperation[op]) {
      byOperation[op] = { total: 0, mastered: 0, attempts: 0, correct: 0, sumMs: 0, msCount: 0 };
    }
    const b = byOperation[op];
    b.total += 1;
    if (isMastered(fact)) b.mastered += 1;
    b.attempts += fact.totalAttempts || 0;
    b.correct += fact.correctAttempts || 0;
    if (fact.averageResponseMs > 0) {
      b.sumMs += fact.averageResponseMs;
      b.msCount += 1;
    }
  }

  for (const op of Object.keys(byOperation)) {
    const b = byOperation[op];
    b.accuracy = b.attempts > 0 ? b.correct / b.attempts : 0;
    b.averageResponseMs = b.msCount > 0 ? Math.round(b.sumMs / b.msCount) : 0;
  }

  const totalMastered = counts.mastered + counts.automatic;
  return { counts, byOperation, totalMastered, totalTracked: factMap.size };
}

/**
 * Progres per operasi dengan TOTAL POOL TETAP (mis. penjumlahan = 90 poin),
 * memakai skema yang SAMA PERSIS dengan getKingdomProgress() di sisi siswa
 * (js/game/game-engine.js). Dipakai dashboard guru agar angka yang dilihat
 * guru selalu sinkron dengan progres yang dilihat siswa sendiri -- sebelumnya
 * dashboard guru memakai summarizeMastery() yang hanya menghitung fakta yang
 * PERNAH DICOBA sebagai penyebut (bukan total pool sesungguhnya), sehingga
 * mis. "Penjumlahan 0/11" padahal total sebenarnya 90 poin (45 hitungan x2).
 */
export function summarizeProgressByOperation(factMap, operations) {
  const out = {};
  for (const op of operations) {
    const allFacts = getAllFactsFor(op);
    const factCount = allFacts.length;
    const total = factCount * CORRECT_PER_FACT;

    let points = 0;
    let mastered = 0;
    let attempts = 0;
    let correct = 0;
    let sumMs = 0;
    let msCount = 0;

    for (const base of allFacts) {
      const record = factMap.get(base.factId);
      if (!record) continue;

      const benar = Math.min(record.correctAttempts || 0, CORRECT_PER_FACT);
      points += benar;
      if (benar >= CORRECT_PER_FACT) mastered += 1;
      attempts += record.totalAttempts || 0;
      correct += record.correctAttempts || 0;
      if (record.averageResponseMs > 0) { sumMs += record.averageResponseMs; msCount += 1; }
    }

    out[op] = {
      total,
      points,
      factCount,
      mastered,
      accuracy: attempts > 0 ? correct / attempts : 0,
      averageResponseMs: msCount > 0 ? Math.round(sumMs / msCount) : 0
    };
  }
  return out;
}