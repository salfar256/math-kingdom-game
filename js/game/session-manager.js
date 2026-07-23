/**
 * Orkestrasi satu sesi latihan:
 * - menyusun daftar soal;
 * - mencatat setiap percobaan;
 * - memperbarui penguasaan fakta di memori;
 * - menyimpan hasil ke Firestore satu kali di akhir sesi (hemat biaya);
 * - antrean sinkronisasi bila internet terputus.
 */

import {
  MODES, SESSION_CONFIG, BOSS_CONFIG, STORAGE_KEYS, MASTERY_STATUS, SLOW_RESPONSE_MS
} from '../config/game-config.js';
import { selectAdaptiveQuestions, CorrectionQueue } from './adaptive-engine.js';
import { updateFactMastery, createEmptyFactRecord, summarizeMastery } from './mastery-engine.js';
import { checkAnswer, toQuestion, getFactPool, generateExpertQuestion } from './question-generator.js';
import { calculatePoints, calculateSessionBonus, calculateSessionXp } from './reward-engine.js';
import { saveSession, saveFactsBatch } from '../firebase/firestore-service.js';
import { makeId, safeStorage, shuffle, percent } from '../utils/helpers.js';
import { dayKey } from '../utils/date-utils.js';
import { devLog, devError } from '../firebase/firebase-app.js';

export class SessionManager {
  /**
   * @param {object} options
   * @param {string} options.uid
   * @param {string} options.classId
   * @param {Map<string,object>} options.factMap fakta siswa (dimodifikasi di memori)
   * @param {string} options.mode
   * @param {string[]} options.operations
   * @param {number} options.questionCount
   * @param {number[]|null} options.targets
   * @param {string} options.characterId
   * @param {number|null} options.durationMs untuk mode kecepatan
   */
  constructor(options = {}) {
    const {
      uid,
      classId = '',
      factMap = new Map(),
      mode = MODES.PRACTICE,
      operations = [],
      questionCount = SESSION_CONFIG.practiceQuestions,
      targets = null,
      characterId = 'adventurer',
      durationMs = null,
      assignedFactIds = new Set()
    } = options;

    this.uid = uid;
    this.classId = classId;
    this.factMap = factMap;
    this.mode = mode;
    this.operations = operations;
    this.characterId = characterId;
    this.durationMs = durationMs;
    this.sessionId = makeId('ses');

    this.questions = this.#buildQuestions(questionCount, targets, assignedFactIds);
    this.plannedCount = this.questions.length;

    this.correctionQueue = new CorrectionQueue();
    this.index = 0;
    this.currentQuestion = null;
    this.questionStartedAt = 0;
    this.helpLevel = 0;
    this.isAwaitingAnswer = false;
    this.finished = false;

    this.attempts = [];
    this.stats = {
      total: 0, correct: 0, wrong: 0, skipped: 0,
      corrections: 0, score: 0, combo: 0, maxCombo: 0,
      sumResponseMs: 0, responseCount: 0
    };

    this.newlyMastered = [];
    this.newlyAutomatic = [];
    this.weakFactIds = new Set();
    this.changedFactIds = new Set();

    this.startedAt = new Date();
    this.endOfSessionDrained = false;
    this.bossHp = null;   // diperbarui arena; memicu fase 2 digit boss
  }

  #buildQuestions(count, targets, assignedFactIds) {
    if (this.mode === MODES.PLACEMENT) {
      return this.#buildPlacementQuestions(count);
    }
    if (this.mode === MODES.EXPERT) {
      // Mode Expert: soal 2 digit, jawab sebanyak-banyaknya dalam 60 detik.
      const out = [];
      for (let i = 0; i < 200; i++) out.push(generateExpertQuestion());
      return out;
    }
    return selectAdaptiveQuestions({
      factMap: this.factMap,
      operations: this.operations,
      count,
      targets,
      assignedFactIds
    });
  }

  /**
   * Tes awal: sampel merata dari keempat operasi, dari mudah ke sulit.
   * Tidak adaptif berdasarkan riwayat (siswa belum punya riwayat).
   */
  #buildPlacementQuestions(count) {
    const perOp = Math.ceil(count / this.operations.length);
    const out = [];

    for (const op of this.operations) {
      const pool = shuffle(getFactPool([op]));
      // Urutkan dari operand kecil ke besar agar terasa menanjak.
      const easy = pool.filter((f) => Math.max(f.operandA, f.operandB) <= 5);
      const hard = pool.filter((f) => Math.max(f.operandA, f.operandB) > 5);
      const half = Math.ceil(perOp / 2);
      out.push(...shuffle(easy).slice(0, half).map((f) => toQuestion(f)));
      out.push(...shuffle(hard).slice(0, perOp - half).map((f) => toQuestion(f)));
    }

    return shuffle(out).slice(0, count);
  }

  /* ============ ALUR SOAL ============ */

  /** Ambil soal berikutnya. @returns {object|null} null jika sesi selesai */
  /** Arena melaporkan sisa hati boss agar fase 2 digit bisa dipicu. */
  setBossHp(hp) {
    this.bossHp = typeof hp === 'number' ? hp : null;
  }

  nextQuestion() {
    if (this.finished) return null;

    // FASE AKHIR BOSS: saat hati boss tinggal sedikit, ia mengamuk dan
    // melemparkan hitungan dua digit. Dipicu lewat setBossHp() dari arena.
    if (this.mode === MODES.BOSS && this.bossHp !== null
        && this.bossHp <= BOSS_CONFIG.twoDigitAtHp) {
      return this.#serve(generateExpertQuestion());
    }

    // Prioritas 1: antrean koreksi yang sudah waktunya.
    const correction = this.correctionQueue.take(this.stats.total);
    if (correction) {
      return this.#serve(correction);
    }

    // Prioritas 2: soal terjadwal.
    if (this.index < this.questions.length) {
      const q = this.questions[this.index];
      this.index += 1;
      return this.#serve(q);
    }

    // Prioritas 3: uji ulang akhir sesi.
    if (!this.endOfSessionDrained) {
      const retests = this.correctionQueue.drainEndOfSession();
      this.endOfSessionDrained = true;
      if (retests.length > 0) {
        this.questions.push(...retests);
        const q = this.questions[this.index];
        this.index += 1;
        return this.#serve(q);
      }
    }

    // Prioritas 4: koreksi yang belum sempat muncul.
    if (this.correctionQueue.size > 0) {
      const forced = this.correctionQueue.take(Number.MAX_SAFE_INTEGER);
      if (forced) return this.#serve(forced);
    }

    this.finished = true;
    return null;
  }

  #serve(question) {
    this.currentQuestion = question;
    this.questionStartedAt = performance.now();
    this.helpLevel = 0;
    this.isAwaitingAnswer = true;
    return question;
  }

  /** Naikkan tingkat bantuan (maksimal 4). */
  useHelp() {
    this.helpLevel = Math.min(4, this.helpLevel + 1);
    return this.helpLevel;
  }

  /**
   * Kirim jawaban siswa.
   * Aman terhadap pengiriman ganda (dijaga isAwaitingAnswer).
   * @returns {object|null}
   */
  submitAnswer(rawAnswer) {
    if (!this.isAwaitingAnswer || !this.currentQuestion) return null;
    this.isAwaitingAnswer = false;

    const q = this.currentQuestion;
    const responseMs = Math.max(0, Math.round(performance.now() - this.questionStartedAt));
    const result = checkAnswer(q, rawAnswer);
    const isCorrection = Boolean(q.isCorrection || q.isRetest);

    // Statistik sesi.
    this.stats.total += 1;
    if (result.correct) {
      this.stats.correct += 1;
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      if (isCorrection) this.stats.corrections += 1;

      // Benar TAPI lama dipikirkan -> tetap perlu dilatih. Kelancaran adalah
      // tujuannya: jawaban yang butuh waktu lama berarti belum otomatis.
      if (responseMs >= SLOW_RESPONSE_MS) this.weakFactIds.add(q.factId);
    } else {
      this.stats.wrong += 1;
      this.stats.combo = 0;
      this.weakFactIds.add(q.factId);
    }
    this.stats.sumResponseMs += responseMs;
    this.stats.responseCount += 1;

    // Poin.
    const { points, breakdown } = calculatePoints({
      correct: result.correct,
      responseMs,
      helpLevel: this.helpLevel,
      isCorrection,
      combo: this.stats.combo,
      characterId: this.characterId
    });
    this.stats.score += points;

    // Perbarui penguasaan fakta (tes awal tidak mengubah status penguasaan,
    // hanya dicatat sebagai riwayat awal).
    let masteryResult = null;
    if (this.mode !== MODES.PLACEMENT) {
      masteryResult = this.#updateFact(q, result.correct, responseMs);
    } else {
      this.#recordPlacementFact(q, result.correct, responseMs);
    }

    // Antrean koreksi.
    if (!result.correct) {
      this.correctionQueue.add(q, this.stats.total);
    } else if (isCorrection) {
      this.correctionQueue.addEndOfSession(q);
      this.weakFactIds.delete(q.factId);
    }

    // Catat attempt untuk disimpan nanti.
    this.attempts.push({
      factId: q.factId,
      operation: q.operation,
      operandA: q.operandA,
      operandB: q.operandB,
      displayedQuestion: q.displayedQuestion,
      expectedAnswer: q.expectedAnswer,
      studentAnswer: result.given,
      correct: result.correct,
      responseMs,
      helpLevel: this.helpLevel,
      isCorrection
    });

    return {
      correct: result.correct,
      expected: result.expected,
      given: result.given,
      responseMs,
      points,
      breakdown,
      combo: this.stats.combo,
      isCorrection,
      helpLevel: this.helpLevel,
      question: q,
      mastery: masteryResult
    };
  }

  #updateFact(question, correct, responseMs) {
    const existing = this.factMap.get(question.factId) ||
      createEmptyFactRecord(question);

    const { fact, newlyMastered, newlyAutomatic, statusChanged, previousStatus } =
      updateFactMastery(existing, {
        correct,
        responseMs,
        helpLevel: this.helpLevel,
        sessionId: this.sessionId,
        now: new Date()
      });

    fact.id = question.factId;
    this.factMap.set(question.factId, fact);
    this.changedFactIds.add(question.factId);

    if (newlyMastered) this.newlyMastered.push(question.factId);
    if (newlyAutomatic) this.newlyAutomatic.push(question.factId);
    if (fact.status === MASTERY_STATUS.NEEDS_REVIEW ||
        fact.status === MASTERY_STATUS.LEARNING) {
      this.weakFactIds.add(question.factId);
    }

    return { statusChanged, previousStatus, status: fact.status, newlyMastered, newlyAutomatic };
  }

  /** Tes awal hanya mencatat riwayat, tanpa menaikkan status penguasaan. */
  #recordPlacementFact(question, correct, responseMs) {
    const existing = this.factMap.get(question.factId) || createEmptyFactRecord(question);
    const f = { ...existing };
    f.id = question.factId;
    f.totalAttempts = (f.totalAttempts || 0) + 1;
    if (correct) {
      f.correctAttempts = (f.correctAttempts || 0) + 1;
      f.consecutiveCorrect = (f.consecutiveCorrect || 0) + 1;
      f.consecutiveWrong = 0;
      f.averageResponseMs = f.averageResponseMs > 0
        ? Math.round((f.averageResponseMs + responseMs) / 2)
        : responseMs;
    } else {
      f.wrongAttempts = (f.wrongAttempts || 0) + 1;
      f.consecutiveWrong = (f.consecutiveWrong || 0) + 1;
      f.consecutiveCorrect = 0;
      this.weakFactIds.add(question.factId);
    }
    f.lastSeenAt = new Date();
    f.status = correct ? MASTERY_STATUS.DEVELOPING : MASTERY_STATUS.LEARNING;
    f.nextReviewAt = new Date();

    const key = dayKey();
    f.practiceDays = Array.isArray(f.practiceDays) ? f.practiceDays : [];
    if (!f.practiceDays.includes(key)) f.practiceDays.push(key);
    f.daysPracticed = f.practiceDays.length;

    this.factMap.set(question.factId, f);
    this.changedFactIds.add(question.factId);
  }

  /** Lewati soal (hanya diizinkan pada tes awal). */
  skipQuestion() {
    if (!this.isAwaitingAnswer || !this.currentQuestion) return null;
    this.isAwaitingAnswer = false;
    this.stats.skipped += 1;
    this.stats.total += 1;
    this.stats.combo = 0;
    this.weakFactIds.add(this.currentQuestion.factId);
    return { skipped: true, question: this.currentQuestion };
  }

  /** Hentikan sesi lebih awal (tombol keluar / waktu habis). */
  stop() {
    this.finished = true;
    this.isAwaitingAnswer = false;
  }

  /* ============ RINGKASAN & PENYIMPANAN ============ */

  get accuracy() {
    const answered = this.stats.correct + this.stats.wrong;
    return answered > 0 ? this.stats.correct / answered : 0;
  }

  get averageResponseMs() {
    return this.stats.responseCount > 0
      ? Math.round(this.stats.sumResponseMs / this.stats.responseCount)
      : 0;
  }

  /** Ringkasan sesi untuk ditampilkan & disimpan. */
  buildSummary({ completedDaily = false } = {}) {
    const accuracy = this.accuracy;
    const { bonus, breakdown } = calculateSessionBonus({ accuracy, completedDaily });
    const totalScore = this.stats.score + bonus;

    let xpEarned = calculateSessionXp({
      correct: this.stats.correct,
      corrections: this.stats.corrections,
      newMastered: this.newlyMastered.length,
      newAutomatic: this.newlyAutomatic.length,
      completed: true
    });
    // Mode Expert: XP dua kali lipat.
    if (this.mode === MODES.EXPERT) xpEarned *= 2;

    return {
      sessionId: this.sessionId,
      classId: this.classId,
      mode: this.mode,
      operation: this.operations.length === 1 ? this.operations[0] : 'mixed',
      startedAt: this.startedAt,
      totalQuestions: this.stats.total,
      correct: this.stats.correct,
      wrong: this.stats.wrong,
      skipped: this.stats.skipped,
      corrections: this.stats.corrections,
      accuracy: percent(this.stats.correct, this.stats.correct + this.stats.wrong, 1),
      accuracyRatio: accuracy,
      averageResponseMs: this.averageResponseMs,
      score: totalScore,
      scoreBonus: bonus,
      scoreBonusBreakdown: breakdown,
      maxCombo: this.stats.maxCombo,
      xpEarned,
      factsMastered: this.newlyMastered.length,
      factsAutomatic: this.newlyAutomatic.length,
      newlyMasteredIds: this.newlyMastered.slice(0, 30),
      weakFactIds: Array.from(this.weakFactIds).slice(0, 30)
    };
  }

  /** Evaluasi kemenangan boss. */
  evaluateBoss(enemyHp, playerHp = 1) {
    const reasons = [];
    if (enemyHp > 0) reasons.push('Hati boss belum habis. Jawab benar untuk menyerang!');
    if (playerHp <= 0) reasons.push('Hatimu habis lebih dulu. Coba lagi!');
    return { victory: reasons.length === 0, reasons };
  }

  /**
   * Simpan sesi + fakta yang berubah ke Firestore.
   * Bila gagal, data dimasukkan ke antrean sinkronisasi lokal.
   * @returns {Promise<{saved: boolean, queued: boolean, error: Error|null}>}
   */
  async persist(summary) {
    const changedFacts = Array.from(this.changedFactIds)
      .map((id) => this.factMap.get(id))
      .filter(Boolean)
      .map((f) => serializeFact(f));

    const sessionDoc = {
      classId: this.classId,
      mode: this.mode,
      operation: summary.operation,
      startedAt: this.startedAt,
      totalQuestions: summary.totalQuestions,
      correct: summary.correct,
      wrong: summary.wrong,
      skipped: summary.skipped,
      accuracy: summary.accuracy,
      averageResponseMs: summary.averageResponseMs,
      score: summary.score,
      xpEarned: summary.xpEarned,
      factsMastered: summary.factsMastered,
      factsAutomatic: summary.factsAutomatic
    };

    try {
      await saveSession(this.uid, this.sessionId, sessionDoc, this.attempts);
      await saveFactsBatch(this.uid, changedFacts);
      devLog('Sesi tersimpan.');
      return { saved: true, queued: false, error: null };
    } catch (error) {
      devError('Gagal menyimpan sesi:', error);
      queueForSync({
        uid: this.uid,
        sessionId: this.sessionId,
        sessionDoc,
        attempts: this.attempts,
        facts: changedFacts
      });
      return { saved: false, queued: true, error };
    }
  }
}

/** Bersihkan objek fakta agar aman ditulis ke Firestore. */
export function serializeFact(fact) {
  return {
    id: fact.id,
    operation: fact.operation,
    operandA: fact.operandA,
    operandB: fact.operandB,
    answer: fact.answer,
    familyId: fact.familyId,
    status: fact.status,
    totalAttempts: Math.round(fact.totalAttempts || 0),
    correctAttempts: Math.round(fact.correctAttempts || 0),
    wrongAttempts: Math.round(fact.wrongAttempts || 0),
    consecutiveCorrect: Math.round(fact.consecutiveCorrect || 0),
    consecutiveWrong: Math.round(fact.consecutiveWrong || 0),
    averageResponseMs: Math.round(fact.averageResponseMs || 0),
    fastestResponseMs: Math.round(fact.fastestResponseMs || 0),
    helpUsedCount: Math.round(fact.helpUsedCount || 0),
    daysPracticed: Math.round(fact.daysPracticed || 0),
    practiceDays: Array.isArray(fact.practiceDays) ? fact.practiceDays.slice(-60) : [],
    lastSeenAt: fact.lastSeenAt || null,
    lastCorrectAt: fact.lastCorrectAt || null,
    nextReviewAt: fact.nextReviewAt || null
  };
}

/* ============ ANTREAN SINKRONISASI ============ */

export function queueForSync(payload) {
  const queue = safeStorage.get(STORAGE_KEYS.syncQueue, []);
  const list = Array.isArray(queue) ? queue : [];
  list.push({ ...payload, queuedAt: Date.now() });
  // Batasi agar localStorage tidak penuh.
  while (list.length > 10) list.shift();
  safeStorage.set(STORAGE_KEYS.syncQueue, list);
}

export function getSyncQueue() {
  const queue = safeStorage.get(STORAGE_KEYS.syncQueue, []);
  return Array.isArray(queue) ? queue : [];
}

export function clearSyncQueue() {
  safeStorage.remove(STORAGE_KEYS.syncQueue);
}

/**
 * Coba kirim ulang seluruh antrean.
 * @returns {Promise<{sent: number, failed: number}>}
 */
export async function flushSyncQueue(uid) {
  const queue = getSyncQueue().filter((item) => item.uid === uid);
  if (queue.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await saveSession(item.uid, item.sessionId, item.sessionDoc, item.attempts || []);
      await saveFactsBatch(item.uid, item.facts || []);
      sent += 1;
    } catch (e) {
      devError('Sinkronisasi tertunda gagal:', e);
      remaining.push(item);
    }
  }

  const others = getSyncQueue().filter((item) => item.uid !== uid);
  safeStorage.set(STORAGE_KEYS.syncQueue, [...others, ...remaining]);

  return { sent, failed: remaining.length };
}

/** Ringkasan penguasaan siswa (dipakai profil & leaderboard). */
export function buildMasterySummary(factMap) {
  return summarizeMastery(factMap);
}