/**
 * Mesin adaptif: memilih soal berdasarkan prioritas & pengulangan berjeda.
 *
 * Komposisi target per sesi:
 *   60% fakta lemah, 25% fakta jatuh tempo, 15% fakta yang sudah dikuasai.
 */

import {
  MASTERY_STATUS, PRIORITY_WEIGHTS, SESSION_MIX, CORRECTION_QUEUE
} from '../config/game-config.js';
import { getFactPool, toQuestion } from './question-generator.js';
import { isDue, isWeak, isMastered, factAccuracy } from './mastery-engine.js';
import { toMillis } from '../utils/date-utils.js';
import { shuffle, randInt, clamp } from '../utils/helpers.js';

/**
 * Hitung prioritas sebuah fakta. Nilai lebih besar = lebih mendesak.
 *
 * @param {object|null} fact rekaman fakta siswa (null = belum pernah dikerjakan)
 * @param {object} ctx { now, recentFactIds, assignedFactIds }
 */
export function calculateFactPriority(fact, ctx = {}) {
  const W = PRIORITY_WEIGHTS;
  const now = ctx.now || Date.now();
  const recent = ctx.recentFactIds || new Set();
  const assigned = ctx.assignedFactIds || new Set();

  let score = 0;

  if (!fact || fact.status === MASTERY_STATUS.UNSEEN || !fact.totalAttempts) {
    score += W.unseen;
    if (assigned.has(fact ? fact.id : null)) score += W.teacherAssignment;
    return score;
  }

  // 1. Bobot kesalahan.
  const acc = factAccuracy(fact);
  score += W.error * (1 - acc);
  if (fact.consecutiveWrong > 0) {
    score += W.error * 0.5 * clamp(fact.consecutiveWrong / 3, 0, 1);
  }

  // 2. Bobot kelambatan.
  const avg = fact.averageResponseMs || 0;
  if (avg > 0) {
    const slowness = clamp((avg - 2000) / 6000, 0, 1);
    score += W.slowness * slowness;
  }

  // 3. Bobot lama tidak muncul.
  const lastSeen = toMillis(fact.lastSeenAt);
  if (lastSeen > 0) {
    const days = (now - lastSeen) / 86400000;
    score += W.staleness * clamp(days / 7, 0, 1);
  } else {
    score += W.staleness * 0.5;
  }

  // 4. Bobot kebutuhan retensi (sudah jatuh tempo).
  if (isDue(fact, now)) {
    const dueMs = now - toMillis(fact.nextReviewAt || fact.lastSeenAt);
    score += W.retention * clamp(dueMs / (3 * 86400000), 0.3, 1);
  }

  // 5. Tugas guru.
  if (assigned.has(fact.id)) score += W.teacherAssignment;

  // 6. Penalti bila baru saja muncul.
  if (recent.has(fact.id)) score += W.recentlyShownPenalty;

  // Fakta otomatis tetap sesekali diulang, tapi prioritasnya rendah.
  if (fact.status === MASTERY_STATUS.AUTOMATIC && !isDue(fact, now)) {
    score *= 0.25;
  }

  return score;
}

/**
 * Pilih daftar soal untuk satu sesi.
 *
 * @param {object} params
 * @param {Map<string,object>} params.factMap rekaman fakta siswa
 * @param {string[]} params.operations operasi yang diaktifkan
 * @param {number} params.count jumlah soal
 * @param {number[]|null} params.targets angka fokus (opsional)
 * @param {Set<string>} params.assignedFactIds fakta dari tugas guru
 * @returns {Array<object>} daftar soal siap tampil
 */
export function selectAdaptiveQuestions({
  factMap = new Map(),
  operations = [],
  count = 20,
  targets = null,
  assignedFactIds = new Set()
} = {}) {
  const now = Date.now();
  let pool = getFactPool(operations);

  if (Array.isArray(targets) && targets.length > 0) {
    const filtered = pool.filter((f) => factMatchesTargets(f, targets));
    if (filtered.length >= Math.max(8, count / 2)) pool = filtered;
  }

  if (pool.length === 0) return [];

  const recentFactIds = new Set();

  // Beri skor pada seluruh kandidat.
  const scored = pool.map((baseFact) => {
    const record = factMap.get(baseFact.factId) || null;
    return {
      baseFact,
      record,
      priority: calculateFactPriority(
        record ? { ...record, id: baseFact.factId } : null,
        { now, recentFactIds, assignedFactIds }
      )
    };
  });

  // Kelompokkan.
  const weak = [];
  const due = [];
  const strong = [];

  for (const item of scored) {
    const r = item.record;
    if (!r || isWeak({ ...r, id: item.baseFact.factId })) weak.push(item);
    else if (isDue(r, now)) due.push(item);
    else if (isMastered(r)) strong.push(item);
    else weak.push(item);
  }

  const byPriority = (a, b) => b.priority - a.priority;
  weak.sort(byPriority);
  due.sort(byPriority);
  strong.sort(byPriority);

  const nWeak = Math.round(count * SESSION_MIX.weak);
  const nDue = Math.round(count * SESSION_MIX.review);
  const nStrong = count - nWeak - nDue;

  const chosen = [];
  const usedIds = new Set();

  pushUnique(chosen, usedIds, weak, nWeak);
  pushUnique(chosen, usedIds, due, nDue);
  pushUnique(chosen, usedIds, strong, nStrong);

  // Lengkapi kekurangan dari sisa kandidat berprioritas tertinggi.
  if (chosen.length < count) {
    const rest = scored
      .filter((s) => !usedIds.has(s.baseFact.factId))
      .sort(byPriority);
    pushUnique(chosen, usedIds, rest, count - chosen.length);
  }

  // Jika pool lebih kecil dari jumlah soal, izinkan pengulangan terkontrol.
  let questions = shuffle(chosen).map((item) => toQuestion(item.baseFact));
  while (questions.length < count && questions.length > 0) {
    const extra = questions[questions.length % questions.length === 0 ? 0 : randInt(0, questions.length - 1)];
    questions.push({ ...extra });
  }

  return spaceOutRepeats(questions.slice(0, count));
}

function pushUnique(target, usedIds, source, n) {
  let added = 0;
  for (const item of source) {
    if (added >= n) break;
    const id = item.baseFact.factId;
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    target.push(item);
    added += 1;
  }
  return added;
}

/** Hindari dua soal identik berdekatan. */
function spaceOutRepeats(questions) {
  const out = questions.slice();
  for (let i = 1; i < out.length; i++) {
    if (out[i].factId !== out[i - 1].factId) continue;
    for (let j = i + 1; j < out.length; j++) {
      if (out[j].factId !== out[i - 1].factId) {
        [out[i], out[j]] = [out[j], out[i]];
        break;
      }
    }
  }
  return out;
}

function factMatchesTargets(fact, targets) {
  const set = new Set(targets.map(Number));
  return set.has(fact.operandA) || set.has(fact.operandB) || set.has(fact.answer);
}

/**
 * Antrean koreksi dalam sesi.
 * Soal yang salah dimasukkan kembali setelah 3–5 soal.
 */
export class CorrectionQueue {
  constructor() {
    this.pending = [];      // { question, dueAtIndex }
    this.endOfSession = [];
  }

  /** Tambahkan soal yang dijawab salah. */
  add(question, currentIndex) {
    const gap = randInt(CORRECTION_QUEUE.minGap, CORRECTION_QUEUE.maxGap);
    this.pending.push({
      question: { ...question, isCorrection: true },
      dueAtIndex: currentIndex + gap
    });
  }

  /** Tandai soal yang berhasil diperbaiki untuk diuji ulang di akhir sesi. */
  addEndOfSession(question) {
    if (!CORRECTION_QUEUE.endOfSessionRetest) return;
    if (this.endOfSession.some((q) => q.factId === question.factId)) return;
    this.endOfSession.push({ ...question, isRetest: true });
  }

  /** Ambil soal koreksi yang sudah waktunya muncul. @returns {object|null} */
  take(currentIndex) {
    const idx = this.pending.findIndex((p) => p.dueAtIndex <= currentIndex);
    if (idx === -1) return null;
    const [item] = this.pending.splice(idx, 1);
    return item.question;
  }

  /** Ambil seluruh soal uji ulang akhir sesi. */
  drainEndOfSession() {
    const out = this.endOfSession.slice();
    this.endOfSession = [];
    return out;
  }

  get size() {
    return this.pending.length;
  }

  hasAny() {
    return this.pending.length > 0 || this.endOfSession.length > 0;
  }
}

/**
 * Rekomendasi latihan berikutnya untuk siswa.
 * @returns {Array<{operation: string, reason: string, factIds: string[]}>}
 */
export function recommendPractice(factMap, limitPerOp = 5) {
  const byOp = {};
  const now = Date.now();

  for (const [id, fact] of factMap.entries()) {
    const record = { ...fact, id };
    if (!isWeak(record) && !isDue(record, now)) continue;
    const op = fact.operation;
    if (!byOp[op]) byOp[op] = [];
    byOp[op].push({ id, priority: calculateFactPriority(record, { now }) });
  }

  const out = [];
  for (const [operation, items] of Object.entries(byOp)) {
    items.sort((a, b) => b.priority - a.priority);
    const top = items.slice(0, limitPerOp);
    out.push({
      operation,
      count: items.length,
      reason: items.length > 10
        ? 'Banyak fakta yang masih perlu latihan.'
        : 'Beberapa fakta perlu diulang.',
      factIds: top.map((t) => t.id)
    });
  }

  out.sort((a, b) => b.count - a.count);
  return out;
}